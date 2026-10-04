import fs from "node:fs";

// Merges the optimizer dump's shards into tests/optimizer-dump.json. Kept apart from the cases (it imports nothing
// from src/), since tests/optimizer-dump.config.ts loads it.

export type Json = number | string | boolean | null | undefined | Json[] | { [k: string]: Json };

/** The dump's parts, in its key order. */
export const DUMP_KINDS = ["pa", "hifi"] as const;
export type DumpKind = (typeof DUMP_KINDS)[number];

/** The env vars that tell a shard (tests/optimizer-dump.ts) which cases are its own; set per project by the config. */
export const DUMP_ENV = {
  kind: "OPTIMIZER_DUMP_KIND",
  shard: "OPTIMIZER_DUMP_SHARD",
  shards: "OPTIMIZER_DUMP_SHARDS",
} as const;

export const DUMP_FILE = new URL("./optimizer-dump.json", import.meta.url);
/** Where each shard leaves its cases until the run's end merges them (gitignored). */
export const PARTIAL_DIR = new URL("./.optimizer-dump/", import.meta.url);

/** One shard's output: its kind's case count, and its own cases by index. */
export type DumpPartial = { kind: DumpKind; total: number; cases: [number, Json][] };

export const clearPartials = (): void => fs.rmSync(PARTIAL_DIR, { recursive: true, force: true });

/**
 * Writes the dump from the shards' partial files. A kind with partials is replaced by them (all its cases must be
 * there); a kind without any keeps what the dump already holds, so one kind can be regenerated alone.
 */
export function mergeDump(): void {
  const partials = fs.existsSync(PARTIAL_DIR)
    ? fs
        .readdirSync(PARTIAL_DIR)
        .filter((f) => f.endsWith(".json"))
        // boundary: the shard files are DumpPartial, written by tests/optimizer-dump.ts
        .map((f) => JSON.parse(fs.readFileSync(new URL(f, PARTIAL_DIR), "utf8")) as DumpPartial)
    : [];
  // boundary: the dump is this function's own output, keyed by kind
  const old = fs.existsSync(DUMP_FILE)
    ? (JSON.parse(fs.readFileSync(DUMP_FILE, "utf8")) as Partial<Record<DumpKind, Json[]>>)
    : {};
  const dump = Object.fromEntries(
    DUMP_KINDS.map((kind) => {
      const mine = partials.filter((p) => p.kind === kind);
      if (!mine.length) {
        const kept = old[kind];
        if (!kept)
          throw new Error(`optimizer dump: no ${kind} cases yet; run vp run optimizer-dump`);
        return [kind, kept];
      }
      const total = mine[0].total;
      const cases: Json[] = Array.from({ length: total });
      const seen = new Set<number>();
      for (const p of mine) {
        if (p.total !== total)
          throw new Error(`optimizer dump: ${kind} shards disagree on the case count`);
        for (const [i, c] of p.cases) {
          seen.add(i);
          cases[i] = c;
        }
      }
      if (seen.size !== total)
        throw new Error(`optimizer dump: ${kind} has ${seen.size} of ${total} cases`);
      return [kind, cases];
    }),
  );
  fs.writeFileSync(DUMP_FILE, JSON.stringify(dump, null, 1) + "\n");
}
