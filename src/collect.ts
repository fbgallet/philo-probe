// Collect answers from the panel. Resumable: every answer is appended to
// data/runs.jsonl keyed by cell, and re-running only fills the gaps.
//
//   npm run collect -- --dry-run        print the grid, a sample message and a
//                                       cost estimate, send nothing
//   npm run collect                     run it
//   npm run collect -- --limit 50       stop after 50 answers

import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { ROOT, buildUserMessage, loadExperiment, renderPayload, type Condition, type PromptItem } from "./config.ts";
import { openRouter, priceTable } from "./client.ts";

const { values } = parseArgs({
  args: process.argv.slice(2).filter((a) => a !== "--"),
  options: {
    "dry-run": { type: "boolean" },
    limit: { type: "string" },
    concurrency: { type: "string" },
    config: { type: "string" },
  },
});

const { config, prompts, tonePrefixes, axes, selfGraded } = loadExperiment(values.config);
const DATA = join(ROOT, "data");
const RUNS = join(DATA, "runs.jsonl");
mkdirSync(DATA, { recursive: true });

interface Cell {
  model: string;
  family: string;
  lang: string;
  promptId: string;
  tone: string;
  condition: string;
  draw: number;
}
const key = (c: Cell) => [c.model, c.lang, c.promptId, c.tone, c.condition, c.draw].join("|");

function grid(): Cell[] {
  const cells: Cell[] = [];
  for (const model of config.panel)
    for (const lang of config.languages)
      for (const item of prompts) {
        const toned =
          item.toned && (config.tonedLanguages.length === 0 || config.tonedLanguages.includes(lang));
        const tones = toned ? config.tones : ["neutral"];
        for (const tone of tones)
          for (const condition of config.conditions)
            for (let draw = 1; draw <= config.draws; draw++)
              cells.push({
                model: model.id,
                family: model.family,
                lang,
                promptId: item.id,
                tone,
                condition: condition.id,
                draw,
              });
      }
  return cells;
}

const itemById = new Map(prompts.map((p) => [p.id, p] as const));
const conditionById = new Map(config.conditions.map((c) => [c.id, c] as const));
const payloadCache = new Map<string, string | undefined>();
function payloadFor(condition: Condition, lang: string): string | undefined {
  const k = `${condition.id}|${lang}`;
  if (!payloadCache.has(k)) payloadCache.set(k, renderPayload(condition, axes, lang));
  return payloadCache.get(k);
}

function messageFor(cell: Cell): string {
  const condition = conditionById.get(cell.condition)!;
  return buildUserMessage({
    item: itemById.get(cell.promptId) as PromptItem,
    lang: cell.lang,
    tone: cell.tone,
    condition,
    payload: payloadFor(condition, cell.lang),
    wordCap: config.wordCap,
    tonePrefixes,
  });
}

const done = new Set<string>(
  existsSync(RUNS)
    ? readFileSync(RUNS, "utf8")
        .split("\n")
        .filter(Boolean)
        .flatMap((l) => {
          try {
            return [(JSON.parse(l) as { key: string }).key];
          } catch {
            return [];
          }
        })
    : [],
);

const cells = grid();
const remaining = cells.filter((c) => !done.has(key(c)));
// --limit caps THIS run, it does not shrink the grid: the counts below report
// the grid, so a capped run cannot be mistaken for a finished one.
const todo = values.limit ? remaining.slice(0, Number.parseInt(values.limit, 10)) : remaining;

console.log(
  `Grid: ${config.panel.length} models × ${config.languages.length} languages × ${prompts.length} questions ` +
    `× ${config.conditions.length} conditions × ${config.draws} draws` +
    (config.turns > 1 ? ` × ${config.turns} turns` : ""),
);
console.log(
  `${cells.length} cells · ${cells.length - remaining.length} already collected · ${remaining.length} left` +
    (todo.length < remaining.length ? ` · ${todo.length} this run (--limit)` : ""),
);
if (selfGraded) console.log(`⚠ self-graded run: the annotator shares a provider with a tested model.`);

// ── Cost estimate ────────────────────────────────────────────────────────────
// Rough, and deliberately printed before anything is sent: a grid that looks
// innocent in YAML can be a hundred dollars.
async function estimate(sample: Cell[]): Promise<void> {
  const prices = await priceTable(config.panel.map((m) => m.id)).catch(() => new Map());
  const inputTokens = sample.reduce((sum, c) => sum + messageFor(c).length / 4, 0) / sample.length;
  const outTokens = config.wordCap * 1.6;
  let total = 0;
  for (const model of config.panel) {
    const share = todo.filter((c) => c.model === model.id).length * config.turns;
    const p = prices.get(model.id);
    if (!p) continue;
    total += share * ((inputTokens * p.prompt) + (outTokens * p.completion));
  }
  console.log(
    prices.size
      ? `Estimated collection cost: ~$${total.toFixed(2)} (${Math.round(inputTokens)} input / ${Math.round(outTokens)} output tokens per answer, live prices).\n` +
          `Annotation adds roughly one call per answer per pass.`
      : `Cost estimate unavailable (could not fetch prices).`,
  );
}

const client = openRouter();

async function main() {
  if (todo.length) await estimate(todo.slice(0, 50));

  if (values["dry-run"]) {
    const shown = new Map<string, Cell>();
    for (const c of cells) shown.set(`${c.condition}/${c.lang}`, c);
    for (const [label, c] of [...shown].slice(0, 6)) {
      const msg = messageFor(c);
      console.log(
        `\n─── ${label} · ${c.promptId} · tone ${c.tone} ───\n` +
          (msg.length > 700 ? `${msg.slice(0, 420)}\n[…]\n${msg.slice(-200)}` : msg),
      );
    }
    console.log(`\nDry run: nothing sent.`);
    return;
  }
  if (!todo.length) return;

  const concurrency = values.concurrency ? Number.parseInt(values.concurrency, 10) : 6;
  let n = 0;
  let failures = 0;
  let truncated = 0;

  await pool(todo, concurrency, async (cell) => {
    const messages: { role: "user" | "assistant"; content: string }[] = [
      { role: "user", content: messageFor(cell) },
    ];
    const turns: { message: string; response: string; finishReason?: string }[] = [];

    for (let turn = 1; turn <= config.turns; turn++) {
      if (turn > 1) {
        const relaunch = config.relaunches[cell.lang]?.[turn - 2];
        if (!relaunch) break;
        messages.push({ role: "user", content: relaunch });
      }
      const res = await retry(key(cell), () =>
        client.chat({
          model: cell.model,
          messages,
          temperature: config.temperature,
          maxTokens: config.maxTokens,
          effort: config.effort,
        }),
      );
      if (!res) return void (failures += 1);
      const content = res.choices[0]?.message?.content ?? "";
      const finishReason = res.choices[0]?.finish_reason;
      if (!content.trim()) return void (failures += 1);
      if (finishReason && finishReason !== "stop") truncated += 1;
      turns.push({ message: messages[messages.length - 1]!.content, response: content, finishReason });
      messages.push({ role: "assistant", content });
    }

    if (!turns.length) return void (failures += 1);
    appendFileSync(
      RUNS,
      JSON.stringify({
        key: key(cell),
        ...cell,
        turns,
        // Convenience mirror of the first turn: every metric in the reference
        // study is computed on it.
        message: turns[0]!.message,
        response: turns[0]!.response,
        finishReason: turns[0]!.finishReason,
        words: countWords(turns[0]!.response, cell.lang),
        selfGraded,
        collectedAt: new Date().toISOString(),
      }) + "\n",
    );
    n += 1;
    if (n % 25 === 0 || n === todo.length) console.log(`  [${n}/${todo.length}] collected`);
  });

  console.log(`Done: ${n} collected, ${failures} failed (re-run to retry).`);
  if (truncated)
    console.log(
      `⚠ ${truncated} answer(s) did not stop on their own. Raise maxTokens: a cut answer\n` +
        `  never reaches its conclusion and biases every metric computed on it.`,
    );
}

function countWords(text: string, lang: string): number {
  if (lang === "zh") return (text.match(/[一-鿿]/g) ?? []).length;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

async function pool<T>(items: T[], size: number, fn: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (next < items.length) await fn(items[next++]!);
    }),
  );
}

async function retry<T>(label: string, fn: () => Promise<T>, attempts = 3): Promise<T | undefined> {
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === attempts) {
        console.warn(`  ✖ ${label}: ${(err as Error).message}`);
        return undefined;
      }
      await new Promise((r) => setTimeout(r, 1000 * i * i));
    }
  }
  return undefined;
}

await main();
