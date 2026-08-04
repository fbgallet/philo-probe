// Draw the study's four figures, straight from the collected data.
//
//   npm run charts -- --data results --config results/experiment.reference.yaml --out results
//
// The figures are GENERATED, never drawn. A chart made by hand is a third place
// where the truth can drift, on top of the data and the prose — and this study
// has already had its counts go stale in silence once. Re-run this and any
// figure that disagrees with the text becomes visible immediately.
//
// Output is plain SVG: no JavaScript, no web font, no external request. It
// embeds in a printable page, in the markdown, or in a design tool as an asset.

import { mkdirSync, writeFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { parseArgs } from "node:util";
import { ROOT, loadExperiment } from "./config.ts";
import { contactSheet } from "./contact-sheet.ts";
import { byKey, nameFolder, norm, readJsonl, type RunRow } from "./dataset.ts";

const { values } = parseArgs({
  args: process.argv.slice(2).filter((a) => a !== "--"),
  options: { data: { type: "string" }, config: { type: "string" }, out: { type: "string" } },
});
const resolve = (p: string) => (isAbsolute(p) ? p : join(ROOT, p));
const { config, prompts, figures } = loadExperiment(
  values.config ? resolve(values.config) : undefined,
);
const DATA = resolve(values.data ?? "data");
const OUT = resolve(values.out ?? "reports");

const runs = readJsonl<RunRow>(DATA, "runs.jsonl");
if (!runs.length) {
  console.error("\n✖ No answers found. Run `npm run collect` first.\n");
  process.exit(1);
}
const judge = config.judge.model;
const orientation = byKey(readJsonl<any>(DATA, "orient.jsonl"), judge);
const rubric = byKey(readJsonl<any>(DATA, "rubric.jsonl"), judge);
const mappings = byKey(readJsonl<any>(DATA, "map.jsonl"), judge);
const extraction = byKey(readJsonl<any>(DATA, "extract.jsonl"), judge);

const promptById = new Map(prompts.map((p) => [p.id, p] as const));

// ── Language ────────────────────────────────────────────────────────────────
// Every label the figures carry, in both languages the study publishes in.

type Locale = "fr" | "en";
const LOCALES: Locale[] = ["fr", "en"];

const REGISTERS = [
  "philosophical-argument",
  "doctrinal-summary",
  "practical-advice",
  "therapeutic-support",
] as const;

const T = {
  fr: {
    registers: ["raisonnement", "exposé doctrinal", "conseil pratique", "soutien émotionnel"],
    c1Title: "Le mode dominant de la réponse, selon ce sur quoi porte la question",
    c1Note: "Part des réponses ; condition nue, ton neutre. Un problème nommé fait raisonner ; une situation vécue fait conseiller.",
    c1Rows: {
      expert: "un problème déterminé, formulation de spécialiste",
      curious: "un problème déterminé, formulation de curieux",
      student: "un problème déterminé, demande d'aide au devoir",
      P1: "aucun problème précis : « par où commencer ? »",
      P3: "une situation personnelle : le travail sans sens",
      P5: "une situation personnelle : la vérité qui blesse",
      P4: "une situation personnelle : la mort du père",
    },
    c2Title: "La même situation, posée sous trois formes",
    c2Note: "Situation reproduite mot pour mot d'une forme à l'autre. Aucune ne dépasse 1 % de raisonnement.",
    c2Rows: {
      F1: "réflexive : que devrais-je me demander ?",
      F2: "normative : qu'est-il juste de faire, et pourquoi ?",
      F3: "doctrinale : qu'a dit la philosophie ?",
    },
    c3Title: "Ce que change une carte des problèmes",
    c3Left: "mise en problème (0 à 4)",
    c3Right: "questions sans problème identifiable",
    c3Note: "Matière appariée : mêmes questions, même langue, ton neutre, 240 réponses par condition.",
    c3Rows: {
      BARE: "question nue",
      NUDGE: "consigne de diversité",
      LIST: "liste de 80 thèmes",
      MAP_CORE: "carte de 29 questions",
      MAP_FULL: "carte de 80 questions",
    },
    c4Title: "Les auteurs cités, et ceux avec qui l'on raisonne",
    c4Note: "Condition nue, ton neutre. Mentions, et part où un argument de l'auteur est réellement mobilisé.",
    c4Legend: ["mentions", "dont un argument est mobilisé"],
    scale: "part des réponses",
  },
  en: {
    registers: ["reasoning", "doctrinal summary", "practical advice", "emotional support"],
    c1Title: "The dominant mode of the answer, by what the question bears on",
    c1Note: "Share of answers; bare condition, neutral tone. A named problem draws reasoning; a lived situation draws advice.",
    c1Rows: {
      expert: "a determinate problem, specialist phrasing",
      curious: "a determinate problem, curious-reader phrasing",
      student: "a determinate problem, homework request",
      P1: "no precise problem: “where should I start?”",
      P3: "a personal situation: work without meaning",
      P5: "a personal situation: the truth that hurts",
      P4: "a personal situation: a father's death",
    },
    c2Title: "The same situation, put in three forms",
    c2Note: "The situation is reproduced word for word across forms. None passes 1 % reasoning.",
    c2Rows: {
      F1: "reflective: what should I ask myself?",
      F2: "normative: what is the right thing to do, and why?",
      F3: "doctrinal: what has philosophy said?",
    },
    c3Title: "What a problem map changes",
    c3Left: "problem framing (0 to 4)",
    c3Right: "questions with no identifiable problem",
    c3Note: "Matched material: same questions, same language, neutral tone, 240 answers per condition.",
    c3Rows: {
      BARE: "bare question",
      NUDGE: "diversity instruction",
      LIST: "list of 80 themes",
      MAP_CORE: "map of 29 questions",
      MAP_FULL: "map of 80 questions",
    },
    c4Title: "The authors cited, and those actually reasoned with",
    c4Note: "Bare condition, neutral tone. Mentions, and the share where an argument of theirs is actually deployed.",
    c4Legend: ["mentions", "of which an argument is used"],
    scale: "share of answers",
  },
} as const;

// ── Palette ─────────────────────────────────────────────────────────────────
// Ordered from reasoning to emotional support, deliberately not a rainbow: the
// eye should read a single gradient from "argues" to "comforts". Distinguishable
// in greyscale, since this page is meant to be printed.

const INK = "#1c1917";
const MUTED = "#78716c";
const RULE = "#e7e5e4";
const REG_FILL = ["#1e3a5f", "#5b7fa6", "#e0a458", "#c96a52"];
const ACCENT = "#1e3a5f";
const ACCENT_SOFT = "#a8bdd4";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const FONT =
  "ui-sans-serif, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

function svg(width: number, height: number, body: string, title: string, note: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" font-family="${FONT}" role="img" aria-label="${esc(title)}">
<title>${esc(title)}</title>
<rect width="${width}" height="${height}" fill="#ffffff"/>
<text x="24" y="34" font-size="16" font-weight="600" fill="${INK}">${esc(title)}</text>
<text x="24" y="${height - 16}" font-size="11" fill="${MUTED}">${esc(note)}</text>
${body}
</svg>
`;
}

/** Legend chips, laid out left to right. */
function legend(x: number, y: number, labels: readonly string[], fills: readonly string[]): string {
  let cursor = x;
  return labels
    .map((label, i) => {
      const box = `<rect x="${cursor}" y="${y - 9}" width="10" height="10" rx="2" fill="${fills[i]}"/>`;
      const text = `<text x="${cursor + 15}" y="${y}" font-size="11" fill="${MUTED}">${esc(label)}</text>`;
      cursor += 15 + label.length * 6.1 + 18;
      return box + text;
    })
    .join("\n");
}


/** A figure that renders empty is worse than no figure: it looks authoritative
 *  and says nothing. Every chart asserts it actually found its data, so a
 *  renamed condition or family breaks the build instead of the reader's trust. */
function require(condition: unknown, message: string): void {
  if (!condition) {
    console.error(`\n\u2716 ${message}\n`);
    process.exit(1);
  }
}

// ── The four figures ────────────────────────────────────────────────────────

interface Bucket {
  registers: number[];
  n: number;
  rubricSum: number;
  rubricN: number;
}
const emptyBucket = (): Bucket => ({ registers: [0, 0, 0, 0], n: 0, rubricSum: 0, rubricN: 0 });

function bucketBy(pick: (r: RunRow) => string | undefined): Map<string, Bucket> {
  const out = new Map<string, Bucket>();
  for (const row of runs) {
    const key = pick(row);
    if (!key) continue;
    const or = orientation.get(row.key);
    const idx = REGISTERS.indexOf(or?.register);
    const b = out.get(key) ?? out.set(key, emptyBucket()).get(key)!;
    if (idx >= 0) {
      b.registers[idx]! += 1;
      b.n += 1;
    }
    const ru = rubric.get(row.key);
    if (typeof ru?.score === "number") {
      b.rubricSum += ru.score;
      b.rubricN += 1;
    }
  }
  return out;
}

/** 100 % stacked horizontal bars, one row per group. */
function stackedChart(
  rows: Array<{ label: string; bucket: Bucket }>,
  loc: Locale,
  title: string,
  note: string,
): string {
  const t = T[loc];
  const labelW = 330;
  const barW = 430;
  const rowH = 30;
  const top = 76;
  const width = labelW + barW + 60;
  const height = top + rows.length * rowH + 60;

  const body: string[] = [legend(24, 60, t.registers, REG_FILL)];

  rows.forEach((row, i) => {
    const y = top + i * rowH;
    body.push(
      `<text x="${labelW - 12}" y="${y + 15}" font-size="11.5" text-anchor="end" fill="${INK}">${esc(row.label)}</text>`,
    );
    if (!row.bucket.n) return;
    let x = labelW;
    row.bucket.registers.forEach((count, r) => {
      const share = count / row.bucket.n;
      const w = share * barW;
      if (w <= 0) return;
      body.push(
        `<rect x="${x.toFixed(1)}" y="${y}" width="${w.toFixed(1)}" height="20" fill="${REG_FILL[r]}"/>`,
      );
      // Only label a slice wide enough to hold the text without collision.
      if (w > 34)
        body.push(
          `<text x="${(x + w / 2).toFixed(1)}" y="${y + 14}" font-size="10.5" text-anchor="middle" fill="${r === 2 ? INK : "#ffffff"}">${Math.round(share * 100)} %</text>`,
        );
      x += w;
    });
    body.push(
      `<text x="${labelW + barW + 10}" y="${y + 14}" font-size="10" fill="${MUTED}">n=${row.bucket.n}</text>`,
    );
  });

  return svg(width, height, body.join("\n"), title, note);
}

function chartModes(loc: Locale): string {
  const t = T[loc];
  // Bare condition, neutral tone: the same slice the article's table reports.
  // Widening it to every tone shifts the shares by a few points and the figure
  // would then quietly contradict the prose.
  const bare = (r: RunRow) => r.condition === "BARE" && r.tone === "neutral";
  const buckets = bucketBy((r) => {
    if (!bare(r)) return undefined;
    const p = promptById.get(r.promptId);
    if (!p) return undefined;
    if (p.family === "anchored") return p.userType;
    if (["P1", "P3", "P4", "P5"].includes(p.id)) return p.id;
    return undefined;
  });
  const order: Array<keyof typeof t.c1Rows> = ["expert", "curious", "student", "P1", "P3", "P5", "P4"];
  const rows = order
    .filter((k) => buckets.has(k))
    .map((k) => ({ label: t.c1Rows[k], bucket: buckets.get(k)! }));
  require(rows.length === order.length, `chart 1: expected ${order.length} groups, found ${rows.length} — a prompt family or condition name has changed`);
  return stackedChart(rows, loc, t.c1Title, t.c1Note);
}

function chartCrossed(loc: Locale): string {
  const t = T[loc];
  const buckets = bucketBy((r) => promptById.get(r.promptId)?.form);
  const rows = (["F1", "F2", "F3"] as const)
    .filter((f) => buckets.has(f))
    .map((f) => {
      const b = buckets.get(f)!;
      const mean = b.rubricN ? b.rubricSum / b.rubricN : 0;
      const score = loc === "fr" ? mean.toFixed(2).replace(".", ",") : mean.toFixed(2);
      return { label: `${t.c2Rows[f]}  ·  ${score}/4`, bucket: b };
    });
  require(rows.length === 3, `chart 2: expected 3 forms, found ${rows.length}`);
  return stackedChart(rows, loc, t.c2Title, t.c2Note);
}

/** Two panels sharing one row of labels: a 0–4 mean, and a percentage. */
function chartConditions(loc: Locale): string {
  const t = T[loc];
  const order = ["BARE", "NUDGE", "LIST", "MAP_CORE", "MAP_FULL"] as const;

  const framing = new Map<string, { sum: number; n: number }>();
  const unmapped = new Map<string, { none: number; n: number }>();
  // Matched material only: the same eight open questions, the chart's own
  // language, neutral tone. The five conditions were only ever crossed there,
  // so pooling the anchored battery into BARE — which the article's table does —
  // compares 1,296 answers on named problems against 240 on open questions.
  const OPEN_FAMILIES = new Set(["panorama", "lived", "dilemma", "meta"]);
  for (const row of runs) {
    const p = promptById.get(row.promptId);
    if (!p || !OPEN_FAMILIES.has(p.family)) continue;
    if (row.lang !== loc || row.tone !== "neutral") continue;
    const ru = rubric.get(row.key);
    if (typeof ru?.score === "number") {
      const f = framing.get(row.condition) ?? framing.set(row.condition, { sum: 0, n: 0 }).get(row.condition)!;
      f.sum += ru.score;
      f.n += 1;
    }
    for (const m of mappings.get(row.key)?.mappings ?? []) {
      const u = unmapped.get(row.condition) ?? unmapped.set(row.condition, { none: 0, n: 0 }).get(row.condition)!;
      u.n += 1;
      if (!m.axisId || m.axisId === "NONE") u.none += 1;
    }
  }

  const labelW = 200;
  const panelW = 210;
  const gap = 54;
  const rowH = 32;
  const top = 96;
  const width = labelW + panelW * 2 + gap + 48;
  const height = top + order.length * rowH + 60;

  const body: string[] = [
    `<text x="${labelW}" y="70" font-size="11.5" font-weight="600" fill="${INK}">${esc(t.c3Left)}</text>`,
    `<text x="${labelW + panelW + gap}" y="70" font-size="11.5" font-weight="600" fill="${INK}">${esc(t.c3Right)}</text>`,
  ];

  require(framing.size >= order.length && unmapped.size >= order.length, `chart 3: only ${framing.size} conditions carry a score — condition names have changed`);

  const maxFraming = 4;
  order.forEach((cond, i) => {
    const y = top + i * rowH;
    const label = t.c3Rows[cond];
    const isMap = cond.startsWith("MAP_");
    body.push(
      `<text x="${labelW - 14}" y="${y + 14}" font-size="11.5" text-anchor="end" fill="${INK}" font-weight="${isMap ? 600 : 400}">${esc(label)}</text>`,
    );

    const f = framing.get(cond);
    if (f?.n) {
      const mean = f.sum / f.n;
      const w = (mean / maxFraming) * panelW;
      body.push(
        `<rect x="${labelW}" y="${y}" width="${w.toFixed(1)}" height="19" fill="${isMap ? ACCENT : ACCENT_SOFT}"/>`,
        `<text x="${(labelW + w + 7).toFixed(1)}" y="${y + 14}" font-size="10.5" fill="${MUTED}">${loc === "fr" ? mean.toFixed(2).replace(".", ",") : mean.toFixed(2)}</text>`,
      );
    }

    const u = unmapped.get(cond);
    if (u?.n) {
      const share = u.none / u.n;
      const x0 = labelW + panelW + gap;
      const w = share * panelW;
      body.push(
        `<rect x="${x0}" y="${y}" width="${w.toFixed(1)}" height="19" fill="${isMap ? ACCENT : ACCENT_SOFT}"/>`,
        `<text x="${(x0 + w + 7).toFixed(1)}" y="${y + 14}" font-size="10.5" fill="${MUTED}">${Math.round(share * 100)} %</text>`,
      );
    }
  });

  // A 0–4 scale under the left panel, so the bars are readable as absolutes.
  const axisY = top + order.length * rowH + 6;
  body.push(`<line x1="${labelW}" y1="${axisY}" x2="${labelW + panelW}" y2="${axisY}" stroke="${RULE}"/>`);
  for (let v = 0; v <= 4; v += 1) {
    const x = labelW + (v / 4) * panelW;
    body.push(
      `<line x1="${x}" y1="${axisY}" x2="${x}" y2="${axisY + 4}" stroke="${RULE}"/>`,
      `<text x="${x}" y="${axisY + 16}" font-size="9.5" text-anchor="middle" fill="${MUTED}">${v}</text>`,
    );
  }

  return svg(width, height, body.join("\n"), t.c3Title, t.c3Note);
}

function chartCanon(loc: Locale): string {
  const t = T[loc];
  // Same perimeter as figure 1: bare condition, neutral tone. Pooling every
  // condition would mix in the NUDGE answers, whose bibliographic name-dropping
  // inflates mention counts without a single argument behind them.
  const inScope = (r: RunRow) => r.condition === "BARE" && r.tone === "neutral";
  const observed = new Set<string>();
  for (const row of runs)
    for (const f of extraction.get(row.key)?.figures ?? []) observed.add(norm(f.name));
  const canonical = nameFolder(figures, observed);
  // Display name = the spelling the models themselves use most often, ties
  // broken by length then alphabetically so the figure is reproducible. Reading
  // it off the registry instead would surface matching aliases: the longest
  // entry for Aristotle is "Aristotelianism". The registry holds no localised
  // forms, so a French chart still shows the standard English name.
  const spellings = new Map<string, Map<string, number>>();
  const display = new Map<string, string>();

  const mentions = new Map<string, number>();
  const argued = new Map<string, number>();
  for (const row of runs) {
    if (!inScope(row)) continue;
    for (const f of extraction.get(row.key)?.figures ?? []) {
      const id = canonical(f.name);
      if (!id) continue;
      const seen = spellings.get(id) ?? spellings.set(id, new Map()).get(id)!;
      seen.set(f.name, (seen.get(f.name) ?? 0) + 1);
      mentions.set(id, (mentions.get(id) ?? 0) + 1);
      if (f.role === "argument-used") argued.set(id, (argued.get(id) ?? 0) + 1);
    }
  }

  // The registry's localised label when it has one — "Aristote" in French —
  // otherwise the spelling the models themselves use most often.
  const labelled = new Map(
    figures.flatMap((f) => (f.label?.[loc] ? [[`id:${f.id}`, f.label[loc]!] as const] : [])),
  );
  for (const [id, seen] of spellings)
    display.set(
      id,
      labelled.get(id) ??
        [...seen.entries()].sort(
          (a, b) => b[1] - a[1] || b[0].length - a[0].length || a[0].localeCompare(b[0]),
        )[0]![0],
    );

  const top = [...mentions.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
  require(top.length === 12, `chart 4: expected 12 authors, found ${top.length}`);
  const max = top[0]?.[1] ?? 1;

  const labelW = 140;
  const barW = 380;
  const rowH = 26;
  const headY = 92;
  const width = labelW + barW + 90;
  const height = headY + top.length * rowH + 56;

  const body: string[] = [legend(24, 62, t.c4Legend, [ACCENT_SOFT, ACCENT])];

  top.forEach(([id, count], i) => {
    const y = headY + i * rowH;
    const arg = argued.get(id) ?? 0;
    const w = (count / max) * barW;
    const wa = (arg / max) * barW;
    body.push(
      `<text x="${labelW - 12}" y="${y + 14}" font-size="11.5" text-anchor="end" fill="${INK}">${esc(display.get(id) ?? id)}</text>`,
      `<rect x="${labelW}" y="${y}" width="${w.toFixed(1)}" height="18" fill="${ACCENT_SOFT}"/>`,
      `<rect x="${labelW}" y="${y}" width="${wa.toFixed(1)}" height="18" fill="${ACCENT}"/>`,
      `<text x="${(labelW + w + 8).toFixed(1)}" y="${y + 13}" font-size="10" fill="${MUTED}">${count} · ${Math.round((100 * arg) / count)} %</text>`,
    );
  });

  return svg(width, height, body.join("\n"), t.c4Title, t.c4Note);
}

// ── Write ───────────────────────────────────────────────────────────────────

const FIGURES: Array<[string, (loc: Locale) => string]> = [
  ["1-modes", chartModes],
  ["2-crossed", chartCrossed],
  ["3-conditions", chartConditions],
  ["4-canon", chartCanon],
];

let written = 0;
for (const loc of LOCALES) {
  const dir = join(OUT, "charts", loc);
  mkdirSync(dir, { recursive: true });
  for (const [name, make] of FIGURES) {
    writeFileSync(join(dir, `${name}.svg`), make(loc));
    written += 1;
  }
}
const CAPTIONS: Record<string, string> = {
  "1-modes": "The dominant mode of the answer, by what the question bears on",
  "2-crossed": "The same situation, put in three forms",
  "3-conditions": "What a problem map changes",
  "4-canon": "The authors cited, and those actually reasoned with",
};
const index = join(OUT, "charts", "index.html");
writeFileSync(index, contactSheet(LOCALES, FIGURES.map(([n]) => [n, CAPTIONS[n] ?? n] as [string, string])));

console.log(`\n${written} SVG written to ${join(OUT, "charts")}/{fr,en}/`);
console.log(`Open ${index} to see them all.\n`);
