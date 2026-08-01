// Turn the collected answers and their annotations into the report.
//
//   npm run analyze                  writes reports/report.md and the CSVs
//
// No API call: everything here is arithmetic on what the previous steps wrote,
// so it can be re-run freely while you change how you want to read the data.
//
// Two rules are enforced rather than recommended. Counts are never compared
// across groups of different sizes without rarefaction, because a group with
// four times more answers trivially names more authors. And any answer that
// did not stop on its own is reported at the top, because a truncated answer
// never reaches its conclusion.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, loadExperiment, type Figure } from "./config.ts";

const { config, prompts, axes, figures, selfGraded } = loadExperiment();
const DATA = join(ROOT, "data");
const REPORTS = join(ROOT, "reports");
mkdirSync(REPORTS, { recursive: true });

function readJsonl<T>(name: string): T[] {
  const path = join(DATA, name);
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

interface RunRow {
  key: string;
  model: string;
  family: string;
  lang: string;
  promptId: string;
  tone: string;
  condition: string;
  draw: number;
  response: string;
  words: number;
  finishReason?: string;
}

const runs = readJsonl<RunRow>("runs.jsonl");
if (!runs.length) {
  console.error("\n✖ No answers found. Run `npm run collect` first.\n");
  process.exit(1);
}

const judge = config.judge.model;
const byKey = <T extends { key: string; judge: string }>(rows: T[]) => {
  const m = new Map<string, T>();
  for (const r of rows) {
    const kept = m.get(r.key);
    // The configured annotator wins when several have seen the same answer.
    if (!kept || (kept.judge !== judge && r.judge === judge)) m.set(r.key, r);
  }
  return m;
};

const extraction = byKey(readJsonl<any>("extract.jsonl"));
const orientation = byKey(readJsonl<any>("orient.jsonl"));
const mappings = byKey(readJsonl<any>("map.jsonl"));
const rubric = byKey(readJsonl<any>("rubric.jsonl"));

// ── Name canonicalisation ────────────────────────────────────────────────────
// "Descartes", "René Descartes" and "Rene Descartes" are one man. Counted
// apart they inflate every diversity metric. Resolution: the figure registry
// first, then the surname alone, but only when no two observed full names
// share that surname with different first names.

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/^(the|le|la|les|el)\s+/, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const registry = new Map<string, Figure>();
for (const f of figures)
  for (const name of f.names) {
    const n = norm(name);
    if (n && !registry.has(n)) registry.set(n, f);
    const last = n.split(" ").at(-1);
    if (last && last.length > 2 && !registry.has(last)) registry.set(last, f);
  }

const observed = new Set<string>();
for (const row of runs) {
  const ex = extraction.get(row.key);
  for (const f of ex?.figures ?? []) observed.add(norm(f.name));
}
const firstsBySurname = new Map<string, Set<string>>();
for (const n of observed) {
  if (!n.includes(" ")) continue;
  const surname = n.split(" ").at(-1)!;
  (firstsBySurname.get(surname) ?? firstsBySurname.set(surname, new Set()).get(surname)!).add(n.split(" ")[0]!);
}
const foldable = new Set([...firstsBySurname].filter(([, f]) => f.size <= 1).map(([s]) => s));

function canonical(raw: string): string {
  const n = norm(raw);
  if (!n) return "";
  const direct = registry.get(n);
  if (direct) return `id:${direct.id}`;
  const surname = n.split(" ").at(-1)!;
  if (surname !== n && foldable.has(surname)) {
    const bySurname = registry.get(surname);
    return bySurname ? `id:${bySurname.id}` : surname;
  }
  return n;
}

// ── Grouping ─────────────────────────────────────────────────────────────────

const REGISTERS = ["philosophical-argument", "doctrinal-summary", "practical-advice", "therapeutic-support"];
const NO_TRADITION = new Set(["ECLECTIC_NONE", "THERAPEUTIC", "PRACTICAL_CHECKLIST"]);
const attractors = new Set(config.referential.attractors);
const familyOfPrompt = new Map(prompts.map((p) => [p.id, p.family] as const));
const anchorOfPrompt = new Map(prompts.map((p) => [p.id, p.anchorAxis] as const));

interface Group {
  answers: RunRow[];
  perAnswerFigures: string[][];
  counts: Map<string, number>;
  registers: Map<string, number>;
  orientations: Map<string, number>;
  noTradition: number;
  oriented: number;
  scores: number[];
  mapped: number;
  none: number;
  basin: number;
  onAnchor: number;
}
const emptyGroup = (): Group => ({
  answers: [],
  perAnswerFigures: [],
  counts: new Map(),
  registers: new Map(),
  orientations: new Map(),
  noTradition: 0,
  oriented: 0,
  scores: [],
  mapped: 0,
  none: 0,
  basin: 0,
  onAnchor: 0,
});

function collect(keyOf: (r: RunRow) => string | undefined): Map<string, Group> {
  const groups = new Map<string, Group>();
  for (const row of runs) {
    const k = keyOf(row);
    if (k === undefined) continue;
    const g = groups.get(k) ?? groups.set(k, emptyGroup()).get(k)!;
    g.answers.push(row);

    const ex = extraction.get(row.key);
    if (ex) {
      const names = new Set<string>(ex.figures.map((f: any) => canonical(f.name)).filter(Boolean));
      g.perAnswerFigures.push([...names]);
      for (const n of names) g.counts.set(n, (g.counts.get(n) ?? 0) + 1);
    }
    const or = orientation.get(row.key);
    if (or) {
      g.oriented += 1;
      g.registers.set(or.register, (g.registers.get(or.register) ?? 0) + 1);
      const ids: string[] = or.orientations.map((o: any) => o.id);
      for (const id of new Set(ids)) g.orientations.set(id, (g.orientations.get(id) ?? 0) + 1);
      if (ids.length && ids.every((i) => NO_TRADITION.has(i))) g.noTradition += 1;
    }
    const rb = rubric.get(row.key);
    if (rb) g.scores.push(rb.score);
    const mp = mappings.get(row.key);
    if (mp) {
      const anchor = anchorOfPrompt.get(row.promptId);
      for (const m of mp.mappings) {
        g.mapped += 1;
        if (m.axisId === "NONE") g.none += 1;
        else {
          if (attractors.has(m.axisId)) g.basin += 1;
          if (anchor && m.axisId === anchor) g.onAnchor += 1;
        }
      }
    }
  }
  return groups;
}

/** Mean distinct figures over n answers, averaged over seeded draws: the only
 *  honest way to compare groups that do not have the same size. */
function rarefy(perAnswer: string[][], n: number, repeats = 200): number | null {
  if (perAnswer.length < n) return null;
  let seed = 23;
  const rng = () => {
    seed = (seed + 0x6d2b79f5) >>> 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  let total = 0;
  for (let r = 0; r < repeats; r++) {
    const pool = [...perAnswer];
    const seen = new Set<string>();
    for (let i = 0; i < n; i++) {
      const j = i + Math.floor(rng() * (pool.length - i));
      [pool[i], pool[j]] = [pool[j]!, pool[i]!];
      for (const f of pool[i]!) seen.add(f);
    }
    total += seen.size;
  }
  return total / repeats;
}

const pct = (n: number, d: number) => (d ? `${Math.round((100 * n) / d)} %` : "—");
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const label = (key: string) => (key.startsWith("id:") ? key.slice(3) : key);

// ── Report ───────────────────────────────────────────────────────────────────

const byCondition = collect((r) => r.condition);
const byModel = collect((r) => r.model);
const byFamilyOfPrompt = collect((r) => familyOfPrompt.get(r.promptId));
const commonN = Math.min(...[...byCondition.values()].map((g) => g.perAnswerFigures.length));

const annotated = runs.filter((r) => extraction.has(r.key)).length;
const truncated = runs.filter((r) => r.finishReason && r.finishReason !== "stop");
const md: string[] = [
  `# philo-probe — results`,
  ``,
  `${runs.length} answers from ${config.panel.length} model(s) in ${config.languages.length} language(s), `,
  `${annotated} annotated by \`${judge}\`.`,
  ``,
];
if (selfGraded)
  md.push(
    `> ⚠ **Self-graded run.** The annotator shares a provider with a tested model, so`,
    `> these numbers are not an independent measurement.`,
    ``,
  );
if (truncated.length) {
  const perModel = new Map<string, number>();
  for (const r of truncated) perModel.set(r.model, (perModel.get(r.model) ?? 0) + 1);
  md.push(
    `> ⚠ **${truncated.length} answer(s) did not stop on their own** (${[...perModel]
      .map(([m, n]) => `${m}: ${n}`)
      .join(", ")}). Raise \`maxTokens\`: a truncated answer never reaches its`,
    `> conclusion, and every metric computed on it is biased.`,
    ``,
  );
}

md.push(
  `## Register, by condition`,
  ``,
  `What the answer *is*: does it argue, report doctrines, advise, or comfort?`,
  ``,
  `| condition | answers | ` + REGISTERS.map((r) => r.split("-")[0]).join(" | ") + ` | problematisation |`,
  `|---|---|` + REGISTERS.map(() => "---|").join("") + `---|`,
);
for (const [name, g] of byCondition)
  md.push(
    `| ${name} | ${g.answers.length} | ` +
      REGISTERS.map((r) => pct(g.registers.get(r) ?? 0, g.oriented)).join(" | ") +
      ` | ${Number.isNaN(mean(g.scores)) ? "—" : mean(g.scores).toFixed(2)} |`,
  );

md.push(
  ``,
  `## Register, by kind of question`,
  ``,
  `| question family | answers | ` + REGISTERS.map((r) => r.split("-")[0]).join(" | ") + ` |`,
  `|---|---|` + REGISTERS.map(() => "---|").join(""),
);
for (const [name, g] of byFamilyOfPrompt)
  md.push(
    `| ${name} | ${g.answers.length} | ` + REGISTERS.map((r) => pct(g.registers.get(r) ?? 0, g.oriented)).join(" | ") + ` |`,
  );

md.push(
  ``,
  `## Authors, by condition`,
  ``,
  `Distinct authors are rarefied to ${commonN} answers per condition: comparing raw`,
  `counts across groups of different sizes measures the group size.`,
  ``,
  `| condition | distinct authors (@${commonN}) | mentions/answer | top-10 share | no tradition |`,
  `|---|---|---|---|---|`,
);
for (const [name, g] of byCondition) {
  const counts = [...g.counts.values()].sort((a, b) => b - a);
  const total = counts.reduce((a, b) => a + b, 0);
  const top10 = counts.slice(0, 10).reduce((a, b) => a + b, 0);
  md.push(
    `| ${name} | ${rarefy(g.perAnswerFigures, commonN)?.toFixed(1) ?? "—"} | ` +
      `${(total / (g.answers.length || 1)).toFixed(1)} | ${pct(top10, total)} | ${pct(g.noTradition, g.oriented)} |`,
  );
}

if (mappings.size) {
  md.push(
    ``,
    `## Where the raised questions land`,
    ``,
    `Attractor basin declared before collection: ${[...attractors].join(", ") || "(none)"}.`,
    `"unplaceable" is the share of raised questions that fit no axis at all: they`,
    `are usually introspection prompts rather than problems.`,
    ``,
    `| condition | questions mapped | unplaceable | in basin (of placeable) | on the question's own axis |`,
    `|---|---|---|---|---|`,
  );
  for (const [name, g] of byCondition) {
    const placeable = g.mapped - g.none;
    md.push(
      `| ${name} | ${g.mapped} | ${pct(g.none, g.mapped)} | ${placeable >= 20 ? pct(g.basin, placeable) : "n<20"} | ${g.onAnchor ? pct(g.onAnchor, g.mapped) : "—"} |`,
    );
  }
}

if (config.panel.length > 1) {
  md.push(
    ``,
    `## The models do not behave alike`,
    ``,
    `| model | argues | advises | problematisation | words | favourite author |`,
    `|---|---|---|---|---|---|`,
  );
  for (const [name, g] of byModel) {
    const top = [...g.counts.entries()].sort((a, b) => b[1] - a[1])[0];
    md.push(
      `| ${name} | ${pct(g.registers.get("philosophical-argument") ?? 0, g.oriented)} | ` +
        `${pct(g.registers.get("practical-advice") ?? 0, g.oriented)} | ` +
        `${Number.isNaN(mean(g.scores)) ? "—" : mean(g.scores).toFixed(2)} | ` +
        `${Math.round(mean(g.answers.map((a) => a.words)))} | ${top ? label(top[0]) : "—"} |`,
    );
  }
}

md.push(
  ``,
  `## Most-named authors`,
  ``,
  `| author | mentions | in passing | position attributed | argument used |`,
  `|---|---|---|---|---|`,
);
const roleTotals = new Map<string, { total: number; passing: number; position: number; argument: number }>();
for (const row of runs)
  for (const f of extraction.get(row.key)?.figures ?? []) {
    const k = canonical(f.name);
    const e = roleTotals.get(k) ?? { total: 0, passing: 0, position: 0, argument: 0 };
    e.total += 1;
    if (f.role === "passing-mention") e.passing += 1;
    if (f.role === "position-attributed") e.position += 1;
    if (f.role === "argument-used") e.argument += 1;
    roleTotals.set(k, e);
  }
for (const [k, e] of [...roleTotals.entries()].sort((a, b) => b[1].total - a[1].total).slice(0, 20))
  md.push(
    `| ${label(k)} | ${e.total} | ${pct(e.passing, e.total)} | ${pct(e.position, e.total)} | ${pct(e.argument, e.total)} |`,
  );

md.push(
  ``,
  `## What is not measured here`,
  ``,
  `- Only the first turn of each conversation, unless \`turns\` was raised.`,
  `- The map conditions inject the referential as a document. A companion that`,
  `  queries it on demand, with the reasons attached to each position, is a`,
  `  different and untested object.`,
  `- The annotator is a language model. Run \`npm run annotate -- --agreement\``,
  `  and publish the figures alongside these.`,
  ``,
);

const report = md.join("\n");
writeFileSync(join(REPORTS, "report.md"), report + "\n");

// CSVs for plotting, one row per group.
const csv = [
  "scope,group,answers,argues,advises,problematisation,distinct_authors,unplaceable,basin",
  ...[...byCondition].map(([name, g]) => {
    const placeable = g.mapped - g.none;
    return [
      "condition",
      name,
      g.answers.length,
      ((100 * (g.registers.get("philosophical-argument") ?? 0)) / (g.oriented || 1)).toFixed(1),
      ((100 * (g.registers.get("practical-advice") ?? 0)) / (g.oriented || 1)).toFixed(1),
      Number.isNaN(mean(g.scores)) ? "" : mean(g.scores).toFixed(3),
      rarefy(g.perAnswerFigures, commonN)?.toFixed(2) ?? "",
      g.mapped ? ((100 * g.none) / g.mapped).toFixed(1) : "",
      placeable ? ((100 * g.basin) / placeable).toFixed(1) : "",
    ].join(",");
  }),
].join("\n");
writeFileSync(join(REPORTS, "conditions.csv"), csv + "\n");

console.log(report.split("\n").slice(0, 30).join("\n"));
console.log(`\nreports/report.md · reports/conditions.csv`);
