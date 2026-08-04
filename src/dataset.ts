// Reading the collected data: the joins and the name folding that every
// consumer must do identically.
//
// This lives apart from analyze.ts because the charts read the same files. A
// chart that folded names differently from the report would contradict the
// numbers in the text while looking authoritative, which is the worst failure
// mode a figure has. One implementation, two consumers.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Figure } from "./config.ts";

export interface RunRow {
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

export function readJsonl<T>(dir: string, name: string): T[] {
  const path = join(dir, name);
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

/** One annotation per answer. The configured annotator wins when several have
 *  seen the same answer, so a reliability sample never skews the main tables. */
export function byKey<T extends { key: string; judge: string }>(rows: T[], judge: string) {
  const m = new Map<string, T>();
  for (const r of rows) {
    const kept = m.get(r.key);
    if (!kept || (kept.judge !== judge && r.judge === judge)) m.set(r.key, r);
  }
  return m;
}

export const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/^(the|le|la|les|el)\s+/, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** "Descartes", "René Descartes" and "Rene Descartes" are one man. Counted
 *  apart they inflate every diversity metric. Resolution: the figure registry
 *  first, then the surname alone, but only when no two observed full names
 *  share that surname with different first names. */
export function nameFolder(
  figures: Figure[],
  observedNames: Iterable<string>,
): (raw: string) => string {
  const registry = new Map<string, Figure>();
  for (const f of figures)
    for (const name of f.names) {
      const n = norm(name);
      if (n && !registry.has(n)) registry.set(n, f);
      const last = n.split(" ").at(-1);
      if (last && last.length > 2 && !registry.has(last)) registry.set(last, f);
    }

  const firstsBySurname = new Map<string, Set<string>>();
  for (const n of observedNames) {
    if (!n.includes(" ")) continue;
    const surname = n.split(" ").at(-1)!;
    (firstsBySurname.get(surname) ?? firstsBySurname.set(surname, new Set()).get(surname)!).add(
      n.split(" ")[0]!,
    );
  }
  const foldable = new Set([...firstsBySurname].filter(([, f]) => f.size <= 1).map(([s]) => s));

  return function canonical(raw: string): string {
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
  };
}
