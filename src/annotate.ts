// Blind annotation of the collected answers, in four independent passes.
//
//   npm run annotate                    all passes, resumable
//   npm run annotate -- --pass orient    one pass
//   npm run annotate -- --agreement      re-annotate a sample with the second
//                                        annotator and report how far they agree
//
// Two properties matter more than anything else here, and both are enforced in
// code rather than promised in prose:
//
//   1. The annotator never learns which model, which condition or which draw
//      produced the answer it reads. It receives the text, nothing else, in an
//      order unrelated to the grid.
//   2. Passes are independent. Asking one call to both extract what is written
//      and infer what tradition it follows lets the second contaminate the
//      first, so they are separate calls with separate prompts.

import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { parse } from "yaml";
import { z } from "zod";
import { ROOT, loadExperiment } from "./config.ts";
import { openRouter } from "./client.ts";

const { values } = parseArgs({
  args: process.argv.slice(2).filter((a) => a !== "--"),
  options: {
    pass: { type: "string" },
    judge: { type: "string" },
    agreement: { type: "boolean" },
    limit: { type: "string" },
    concurrency: { type: "string" },
    config: { type: "string" },
  },
});

const { config, axes } = loadExperiment(values.config);
const DATA = join(ROOT, "data");
const RUNS = join(DATA, "runs.jsonl");
mkdirSync(DATA, { recursive: true });

const judge = values.judge ?? config.judge.model;
const concurrency = values.concurrency ? Number.parseInt(values.concurrency, 10) : 8;
const limit = values.limit ? Number.parseInt(values.limit, 10) : undefined;
const client = openRouter();

interface RunRow {
  key: string;
  lang: string;
  response: string;
}

function readJsonl<T>(path: string): T[] {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8")
    .split("\n")
    .filter((l) => l.trim())
    .flatMap((l) => {
      try {
        return [JSON.parse(l) as T];
      } catch {
        return [];
      }
    });
}

const runs = readJsonl<RunRow>(RUNS);
if (!runs.length) {
  console.error("\n✖ No answers to annotate. Run `npm run collect` first.\n");
  process.exit(1);
}

// ── Prompts ──────────────────────────────────────────────────────────────────

function prompt(name: string): { system: string; user: string } {
  const path = join(ROOT, "config", "annotation", `${name}.md`);
  const raw = readFileSync(path, "utf8");
  const [system, user] = raw.split(/^---$/m);
  if (!user) {
    console.error(`\n✖ ${name}.md needs a "---" line between the system prompt and the template.\n`);
    process.exit(1);
  }
  return { system: system!.trim(), user: user.trim() };
}

const fill = (tpl: string, vars: Record<string, string>) =>
  Object.entries(vars).reduce((s, [k, v]) => s.replaceAll(`{{${k}}}`, v), tpl);

const orientationVocabulary = (() => {
  const path = join(ROOT, "config", "orientations.yaml");
  const raw = parse(readFileSync(path, "utf8")) as { orientations?: { id: string; gloss: string }[] };
  const list = raw.orientations ?? [];
  return { ids: new Set(list.map((o) => o.id)), block: list.map((o) => `- ${o.id}: ${o.gloss}`).join("\n") };
})();

const axesBlock = axes.map((a) => `- ${a.id} — ${a.label.en}: ${a.question.en}`).join("\n");

// ── Passes ───────────────────────────────────────────────────────────────────

const role = z.enum(["passing-mention", "position-attributed", "argument-used"]);

interface Pass {
  name: string;
  file: string;
  schema: z.ZodType<unknown>;
  /** Extra template variables beyond the answer itself. */
  vars?: (row: RunRow, previous: Record<string, unknown>) => Record<string, string> | null;
  /** Some passes need an earlier pass's output (map needs the questions). */
  needs?: string;
  clean?: (parsed: any) => unknown;
}

const PASSES: Pass[] = [
  {
    name: "extract",
    file: "extract",
    schema: z.object({
      figures: z.array(z.object({ name: z.string(), role })).default([]),
      schools: z.array(z.object({ name: z.string(), role })).default([]),
      works: z.array(z.string()).default([]),
      questions: z.array(z.string()).default([]),
    }),
  },
  {
    name: "orient",
    file: "orient",
    schema: z.object({
      orientations: z
        .array(
          z.object({
            id: z.string(),
            named: z.boolean(),
            confidence: z.number().int().min(1).max(5),
            evidence: z.string().default(""),
          }),
        )
        .default([]),
      register: z.enum([
        "philosophical-argument",
        "doctrinal-summary",
        "therapeutic-support",
        "practical-advice",
      ]),
    }),
    vars: () => ({ orientations: orientationVocabulary.block }),
    // The vocabulary is closed: an invented id is dropped and reported rather
    // than folded into a neighbouring category.
    clean: (p) => ({ ...p, orientations: p.orientations.filter((o: { id: string }) => orientationVocabulary.ids.has(o.id)) }),
  },
  {
    name: "map",
    file: "map",
    needs: "extract",
    schema: z.object({
      mappings: z.array(
        z.object({
          question: z.string(),
          axisId: z.string(),
          confidence: z.number().int().min(1).max(5),
        }),
      ),
    }),
    vars: (_row, previous) => {
      const questions = (previous.extract as { questions?: string[] } | undefined)?.questions ?? [];
      if (!questions.length) return null; // nothing raised: nothing to place
      return {
        axes: axesBlock,
        questions: questions.map((q, i) => `${i + 1}. ${q}`).join("\n"),
      };
    },
  },
  { name: "rubric", file: "rubric", schema: z.object({ score: z.number().int().min(0).max(4), distinctPositions: z.number().int().min(0), justification: z.string() }) },
];

function fileFor(pass: string): string {
  return join(DATA, `${pass}.jsonl`);
}

/** Deterministic shuffle: the annotator reads in an order unrelated to the
 *  grid, and the order is reproducible from the data alone. */
function shuffled<T>(items: T[], seed: number): T[] {
  let a = seed >>> 0;
  const rng = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

async function runPass(pass: Pass, rows: RunRow[], annotator: string): Promise<void> {
  const doneKeys = new Set(
    readJsonl<{ key: string; judge: string }>(fileFor(pass.name)).map((r) => `${r.key}|${r.judge}`),
  );
  const previousByKey = new Map<string, Record<string, unknown>>();
  if (pass.needs) {
    for (const r of readJsonl<{ key: string; judge: string }>(fileFor(pass.needs)))
      previousByKey.set(r.key, { [pass.needs]: r });
  }

  let todo = shuffled(rows, 7).filter((r) => !doneKeys.has(`${r.key}|${annotator}`));
  if (limit) todo = todo.slice(0, limit);
  console.log(`${pass.name}: ${todo.length} answer(s) to annotate with ${annotator}.`);
  if (!todo.length) return;

  const { system, user } = prompt(pass.file);
  let n = 0;
  let offVocabulary = 0;
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, todo.length) }, async () => {
      while (next < todo.length) {
        const row = todo[next++]!;
        const extra = pass.vars ? pass.vars(row, previousByKey.get(row.key) ?? {}) : {};
        if (extra === null) continue;
        const filled = fill(user, { response: row.response, ...extra });
        const parsed = await retry(`${pass.name} ${row.key}`, async () => {
          const res = await client.chat({
            model: annotator,
            messages: [
              { role: "system", content: system },
              { role: "user", content: filled },
            ],
            temperature: 0.1,
            json: true,
            effort: config.judge.effort,
          });
          const content = res.choices[0]?.message?.content ?? "";
          return pass.schema.parse(JSON.parse(extractJson(content)));
        });
        n += 1;
        if (!parsed) continue;
        const cleaned = pass.clean ? pass.clean(parsed) : parsed;
        if (pass.name === "orient" && (parsed as any).orientations.length !== (cleaned as any).orientations.length)
          offVocabulary += 1;
        appendJsonl(fileFor(pass.name), {
          key: row.key,
          judge: annotator,
          annotatedAt: new Date().toISOString(),
          ...(cleaned as object),
        });
        if (n % 50 === 0 || n === todo.length) console.log(`  [${n}/${todo.length}] ${pass.name}`);
      }
    }),
  );
  if (offVocabulary)
    console.log(`  ⚠ ${offVocabulary} answer(s) drew an orientation outside the closed vocabulary; dropped.`);
}

function appendJsonl(path: string, row: unknown): void {
  appendFileSync(path, JSON.stringify(row) + "\n");
}

/** Models wrap JSON in prose or fences often enough to be worth handling. */
function extractJson(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  const body = fenced?.[1] ?? raw;
  const start = body.search(/[[{]/);
  if (start < 0) return body;
  const open = body[start];
  const close = open === "{" ? "}" : "]";
  const end = body.lastIndexOf(close);
  return end > start ? body.slice(start, end + 1) : body.slice(start);
}

async function retry<T>(label: string, fn: () => Promise<T>, attempts = 3): Promise<T | undefined> {
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === attempts) {
        console.warn(`  ✖ ${label}: ${(err as Error).message.slice(0, 140)}`);
        return undefined;
      }
      await new Promise((r) => setTimeout(r, 1000 * i * i));
    }
  }
  return undefined;
}

// ── Agreement between two annotators ─────────────────────────────────────────
// A single annotator can be consistently wrong. Running a second one over a
// sample turns "we trust the annotation" into a number that ships with the
// results.

async function agreement(): Promise<void> {
  const second = config.judge.second;
  if (!second) {
    console.error("\n✖ judge.second is not set in experiment.yaml.\n");
    process.exit(1);
  }
  const sample = shuffled(runs, 13).slice(0, config.judge.agreementSample);
  console.log(`Agreement: re-annotating ${sample.length} answers with ${second}.\n`);
  for (const pass of PASSES.filter((p) => p.name === "extract" || p.name === "orient"))
    await runPass(pass, sample, second);

  const pick = <T extends { key: string; judge: string }>(rows: T[], who: string) =>
    new Map(rows.filter((r) => r.judge === who).map((r) => [r.key, r] as const));
  const exA = pick(readJsonl<any>(fileFor("extract")), judge);
  const exB = pick(readJsonl<any>(fileFor("extract")), second);
  const orA = pick(readJsonl<any>(fileFor("orient")), judge);
  const orB = pick(readJsonl<any>(fileFor("orient")), second);

  const norm = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, " ")
      .trim();
  const shared = [...exA.keys()].filter((k) => exB.has(k));
  const jac = shared.map((k) => {
    const a = new Set<string>(exA.get(k).figures.map((f: any) => norm(f.name)));
    const b = new Set<string>(exB.get(k).figures.map((f: any) => norm(f.name)));
    if (!a.size && !b.size) return 1;
    const inter = [...a].filter((x) => b.has(x)).length;
    return inter / (a.size + b.size - inter);
  });
  const sharedOr = [...orA.keys()].filter((k) => orB.has(k));
  const sameTop = sharedOr.filter((k) => orA.get(k).orientations[0]?.id === orB.get(k).orientations[0]?.id).length;
  const sameRegister = sharedOr.filter((k) => orA.get(k).register === orB.get(k).register).length;
  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
  const pct = (n: number, d: number) => `${d ? Math.round((100 * n) / d) : 0} %`;

  console.log(
    [
      ``,
      `Inter-annotator agreement — A = ${judge}, B = ${second}`,
      `  figures, mean per-answer overlap : ${mean(jac).toFixed(2)} (${shared.length} answers)`,
      `  identical figure sets            : ${pct(jac.filter((j) => j === 1).length, jac.length)}`,
      `  same dominant orientation        : ${pct(sameTop, sharedOr.length)}`,
      `  same register                    : ${pct(sameRegister, sharedOr.length)}`,
      ``,
      `  Publish these numbers with your results. Disagreement on figures is`,
      `  measurement error; disagreement on orientation is interpretation, and`,
      `  the reader is entitled to see how much of it there is.`,
      ``,
    ].join("\n"),
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────

if (values.agreement) {
  await agreement();
} else {
  const selected = values.pass ? PASSES.filter((p) => p.name === values.pass) : PASSES;
  if (!selected.length) {
    console.error(`\n✖ Unknown pass "${values.pass}". Available: ${PASSES.map((p) => p.name).join(", ")}\n`);
    process.exit(1);
  }
  for (const pass of selected) await runPass(pass, runs, judge);
}
