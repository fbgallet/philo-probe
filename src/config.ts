// Loading and validating config/experiment.yaml, plus the batteries and the
// referential it points at. Every guard that protects a result lives here
// rather than in the documentation, because documentation does not fail a run.

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { z } from "zod";

export const ROOT = join(import.meta.dirname, "..");

const localized = z.record(z.string(), z.string());

const promptItemSchema = z.object({
  id: z.string(),
  family: z.string(),
  toned: z.boolean().optional(),
  anchorAxis: z.string().optional(),
  band: z.enum(["far", "near"]).optional(),
  userType: z.string().optional(),
  situation: z.string().optional(),
  form: z.string().optional(),
  text: localized,
});
export type PromptItem = z.infer<typeof promptItemSchema>;

const conditionSchema = z.object({
  id: z.string(),
  instruction: localized.optional(),
  payload: z.enum(["themes", "questions"]).optional(),
  scope: z.enum(["core", "all"]).optional(),
  intro: localized.optional(),
});
export type Condition = z.infer<typeof conditionSchema>;

const configSchema = z.object({
  panel: z.array(z.object({ id: z.string(), family: z.string() })).min(1),
  judge: z.object({
    model: z.string(),
    allowSelfGrading: z.boolean().default(false),
    second: z.string().optional(),
    agreementSample: z.number().int().positive().default(30),
  }),
  languages: z.array(z.string()).min(1),
  draws: z.number().int().positive(),
  turns: z.number().int().positive().default(1),
  temperature: z.number().default(1),
  wordCap: z.number().int().positive(),
  maxTokens: z.number().int().positive(),
  relaunches: z.record(z.string(), z.array(z.string())).default({}),
  batteries: z.array(z.string()).min(1),
  tones: z.array(z.string()).default(["neutral"]),
  tonedLanguages: z.array(z.string()).default([]),
  conditions: z.array(conditionSchema).min(1),
  referential: z.object({
    axes: z.string(),
    figures: z.string(),
    attractors: z.array(z.string()).default([]),
  }),
});
export type ExperimentConfig = z.infer<typeof configSchema>;

const axisSchema = z.object({
  id: z.string(),
  relation: z.string(),
  core: z.boolean(),
  label: localized,
  question: localized,
  poles: z.array(z.object({ id: z.string(), label: localized })),
});
export type Axis = z.infer<typeof axisSchema>;

const figureSchema = z.object({
  id: z.string(),
  kind: z.string(),
  names: z.array(z.string()),
  birth: z.number().optional(),
  nationality: z.string().optional(),
});
export type Figure = z.infer<typeof figureSchema>;

export interface Loaded {
  config: ExperimentConfig;
  prompts: PromptItem[];
  tonePrefixes: Record<string, Record<string, string>>;
  axes: Axis[];
  figures: Figure[];
  /** True when the annotator shares a family with a tested model. */
  selfGraded: boolean;
}

function fail(message: string): never {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
}

export function loadExperiment(configPath = join(ROOT, "config", "experiment.yaml")): Loaded {
  if (!existsSync(configPath)) fail(`No config at ${configPath}`);
  const parsed = configSchema.safeParse(parse(readFileSync(configPath, "utf8")));
  if (!parsed.success) {
    fail(
      `config/experiment.yaml is invalid:\n` +
        parsed.error.issues.map((i) => `   ${i.path.join(".")}: ${i.message}`).join("\n"),
    );
  }
  const config = parsed.data;

  // ── Guard: the annotator must not grade its own family ────────────────────
  // An annotator drawn from a tested family is not an independent measurement.
  // Rather than warn in a README nobody reads, refuse — or stamp every result.
  const judgeFamily = config.judge.model.split("/")[0];
  const clash = config.panel.find((m) => m.id.split("/")[0] === judgeFamily);
  const selfGraded = Boolean(clash);
  if (clash && !config.judge.allowSelfGrading) {
    fail(
      `The annotator (${config.judge.model}) belongs to the same provider as a tested model (${clash.id}).\n` +
        `   A model grading its own output is not evidence. Either choose an annotator from\n` +
        `   another provider, or set judge.allowSelfGrading: true — every result will then be\n` +
        `   stamped "self-graded", which is honest but much weaker.`,
    );
  }

  // ── Batteries ─────────────────────────────────────────────────────────────
  const promptsDir = join(ROOT, "config", "prompts");
  const known = readdirSync(promptsDir).filter((f) => f.endsWith(".yaml"));
  const prompts: PromptItem[] = [];
  for (const battery of config.batteries) {
    const file = `${battery}.yaml`;
    if (!known.includes(file))
      fail(`Unknown battery "${battery}". Available: ${known.map((f) => f.replace(".yaml", "")).join(", ")}`);
    const raw = parse(readFileSync(join(promptsDir, file), "utf8")) as { items?: unknown };
    const items = z.array(promptItemSchema).safeParse(raw.items ?? []);
    if (!items.success) fail(`${file} is invalid: ${items.error.issues[0]?.message}`);
    prompts.push(...items.data);
  }
  if (!prompts.length) fail("No questions selected: check `batteries` in experiment.yaml.");

  // Every item must cover every language actually asked for, or a cell would
  // silently disappear from the grid.
  const missing = prompts.flatMap((p) =>
    config.languages.filter((l) => !p.text[l]).map((l) => `${p.id}/${l}`),
  );
  if (missing.length)
    fail(
      `${missing.length} question(s) have no text in a requested language:\n` +
        `   ${missing.slice(0, 8).join(", ")}${missing.length > 8 ? "…" : ""}\n` +
        `   Either translate them, or drop the language from experiment.yaml.`,
    );

  const tonesFile = join(promptsDir, "tones.yaml");
  const tonePrefixes = existsSync(tonesFile)
    ? ((parse(readFileSync(tonesFile, "utf8")) as { tones?: Record<string, Record<string, string>> })
        .tones ?? {})
    : {};
  for (const tone of config.tones) {
    if (tone === "neutral") continue;
    if (!tonePrefixes[tone]) fail(`Tone "${tone}" has no prefix in config/prompts/tones.yaml.`);
  }

  // ── Referential ───────────────────────────────────────────────────────────
  const needsReferential = config.conditions.some((c) => c.payload);
  const axesPath = join(ROOT, config.referential.axes);
  const figuresPath = join(ROOT, config.referential.figures);
  if (needsReferential && !existsSync(axesPath))
    fail(`A condition needs a payload but ${config.referential.axes} is missing.`);
  const axes = existsSync(axesPath)
    ? z.array(axisSchema).parse(JSON.parse(readFileSync(axesPath, "utf8")))
    : [];
  const figures = existsSync(figuresPath)
    ? z.array(figureSchema).parse(JSON.parse(readFileSync(figuresPath, "utf8")))
    : [];

  for (const c of config.conditions) {
    if (c.payload && !c.intro) fail(`Condition ${c.id} carries a payload but no intro sentence.`);
    for (const l of config.languages) {
      if (c.instruction && !c.instruction[l]) fail(`Condition ${c.id} has no instruction in "${l}".`);
      if (c.intro && !c.intro[l]) fail(`Condition ${c.id} has no intro in "${l}".`);
    }
  }
  if (config.turns > 1)
    for (const l of config.languages) {
      const r = config.relaunches[l];
      if (!r || r.length < config.turns - 1)
        fail(`turns: ${config.turns} needs at least ${config.turns - 1} relaunches in "${l}".`);
    }

  return { config, prompts, tonePrefixes, axes, figures, selfGraded };
}

// ── Message assembly ─────────────────────────────────────────────────────────

/** The payload block for a condition, rendered in the corpus's own language
 *  when available and in English otherwise. */
export function renderPayload(condition: Condition, axes: Axis[], lang: string): string | undefined {
  if (!condition.payload) return undefined;
  const l = axes[0]?.label[lang] ? lang : "en";
  const selected = condition.scope === "core" ? axes.filter((a) => a.core) : axes;
  if (condition.payload === "themes") return selected.map((a) => `- ${a.label[l]}`).join("\n");

  const relations = [...new Set(selected.map((a) => a.relation))];
  const blocks: string[] = [];
  for (const relation of relations) {
    const group = selected.filter((a) => a.relation === relation);
    blocks.push(
      `## ${relation}`,
      ...group.map(
        (a) => `- [${a.id}] ${a.label[l]} — ${a.question[l]}\n  ${a.poles.map((p) => p.label[l]).join(" | ")}`,
      ),
      "",
    );
  }
  if (condition.scope === "core" && axes.length > selected.length)
    blocks.push(`(${axes.length - selected.length} further axes exist beyond these nodal ones.)`);
  return blocks.join("\n").trim();
}

export function buildUserMessage(opts: {
  item: PromptItem;
  lang: string;
  tone: string;
  condition: Condition;
  payload?: string;
  wordCap: number;
  tonePrefixes: Record<string, Record<string, string>>;
}): string {
  const { item, lang, tone, condition, payload, wordCap, tonePrefixes } = opts;
  const prefix = tone === "neutral" ? "" : (tonePrefixes[tone]?.[lang] ?? "");
  const parts = [prefix + item.text[lang]];
  if (condition.instruction) parts.push(condition.instruction[lang]!);
  if (payload) parts.push(`${condition.intro![lang]}\n\n${payload}`);
  parts.push(cap(lang, wordCap));
  return parts.join("\n\n");
}

/** The length instruction, in the question's language. Chinese counts
 *  characters, the unit it actually uses. */
function cap(lang: string, words: number): string {
  switch (lang) {
    case "fr":
      return `Réponds en ${words} mots au maximum.`;
    case "es":
      return `Responde en ${words} palabras como máximo.`;
    case "de":
      return `Antworte in höchstens ${words} Wörtern.`;
    case "zh":
      return `请用不超过 ${Math.round(words * 1.4)} 字作答。`;
    default:
      return `Answer in at most ${words} words.`;
  }
}
