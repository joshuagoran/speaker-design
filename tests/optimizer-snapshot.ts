import { DUMP_CASES, hifiCaseIndex, paCaseIndex } from "./optimizer-dump-cases";
import type { DumpKind, Json } from "./optimizer-dump-merge";

// The snapshot test's runs: a quick slice of the optimizer dump's cases, by their place in the dump.

/** Where the snapshot test's cards are stored. */
export const SNAPSHOT_FILE = new URL("./optimizer-snapshot.json", import.meta.url);

// PA at the $1100 budget, every goal covered at about 2 s a run: lil block stack on cheaper and lighter, rectangle sub
// on lower and louder, lil tower (which fails a check) on cheaper and lower
const PA = [
  paCaseIndex("lil block stack", 1100, ["cheaper"]),
  paCaseIndex("lil block stack", 1100, ["lighter"]),
  paCaseIndex("rectangle sub", 1100, ["lower"]),
  paCaseIndex("rectangle sub", 1100, ["louder"]),
  paCaseIndex("lil tower", 1100, ["cheaper"]),
  paCaseIndex("lil tower", 1100, ["lower"]),
];
// Hi-fi (a run takes about 10 s): the radiator design on lower
const HIFI = [hifiCaseIndex("radiator", ["lower"])];
const CASES: Record<DumpKind, number[]> = { pa: PA, hifi: HIFI };

/** The slice's cards, each kind's in case order. */
export const snapshotRuns = (): Record<DumpKind, Json[]> => ({
  pa: CASES.pa.map((i) => DUMP_CASES.pa[i]()),
  hifi: CASES.hifi.map((i) => DUMP_CASES.hifi[i]()),
});

/** A run on its own line, each of its cards on a line of its own (so a changed card is one changed line). */
function runLines(run: Json): string {
  if (!run || typeof run !== "object" || Array.isArray(run) || !Array.isArray(run.cards))
    return `  ${JSON.stringify(run)}`;
  const { cards, ...head } = run;
  const open = `  ${JSON.stringify(head).slice(0, -1)},"cards":[`;
  return cards.length
    ? `${open}\n${cards.map((k) => `    ${JSON.stringify(k)}`).join(",\n")}\n  ]}`
    : `${open}]}`;
}

/** The snapshot file's text: the runs of each kind, a card a line. */
export const snapshotText = (runs: Record<DumpKind, Json[]>): string =>
  `{\n${Object.entries(runs)
    .map(([kind, list]) => ` ${JSON.stringify(kind)}: [\n${list.map(runLines).join(",\n")}\n ]`)
    .join(",\n")}\n}\n`;
