import fs from "node:fs";
import { optimizePaStack } from "../src/lib/pa/optimize";
import { optimizeHifiSpeaker } from "../src/lib/hifi/optimize";
import { HIFI_PASSIVES, HIFI_TWEETERS, HIFI_WOOFERS, MID_BOXES } from "../src/lib/data";
import { DEFAULT_HIFI } from "../src/lib/defaults";
import type { HifiOptimizerInput, PaGoal, PaOptimizerCurrent } from "../src/types";
import type { DumpKind, Json } from "./optimizer-dump-merge";

// The cases behind tests/optimizer-dump.json: the cards both optimizers pick for a fixed set of designs and goal sets.
// The order of each kind's cases is the order of its array in the dump; shards only change which worker computes a
// case, never where it lands.

/** Every number to 3 decimals, so the dump compares designs, not float noise. */
const round = (x: unknown): Json =>
  typeof x === "number"
    ? Math.round(x * 1000) / 1000
    : Array.isArray(x)
      ? x.map(round)
      : x && typeof x === "object"
        ? Object.fromEntries(Object.entries(x).map(([k, v]) => [k, round(v)]))
        : // boundary: what is left are JSON primitives (strings, booleans, null, undefined)
          (x as Json);

const GOALS: readonly PaGoal[] = ["cheaper", "lighter", "lower", "louder"];
/** Every goal set the page offers: each goal alone, and each pair with the primary first. */
const goalSets: PaGoal[][] = [
  ...GOALS.map((g) => [g]),
  ...GOALS.flatMap((a) => GOALS.filter((b) => b !== a).map((b) => [a, b])),
];

// boundary: the seed file is saved configurations, as the planner stores them (older ones lack mDim)
const seeds = JSON.parse(
  fs.readFileSync(new URL("../data/configs-seed.json", import.meta.url), "utf8"),
) as (Omit<PaOptimizerCurrent, "mDim"> &
  Partial<Pick<PaOptimizerCurrent, "mDim">> & {
    name: string;
  })[];

const hifiDefault: HifiOptimizerInput["cur"] = {
  woofer: DEFAULT_HIFI.woofer.id,
  tweeter: DEFAULT_HIFI.tweeter.id,
  box: DEFAULT_HIFI.boxType,
  dim: DEFAULT_HIFI.boxDims,
  wall: DEFAULT_HIFI.wallThicknessIn,
  port: DEFAULT_HIFI.portSpec,
  xo: DEFAULT_HIFI.crossoverHz,
  order: DEFAULT_HIFI.crossoverOrder,
  wAmpW: DEFAULT_HIFI.wooferAmpWatts,
  tAmpW: DEFAULT_HIFI.tweeterAmpWatts,
  bsc: DEFAULT_HIFI.baffleStepCompensationDb,
  place: DEFAULT_HIFI.placement,
  wallFt: DEFAULT_HIFI.distanceToWallFt,
  portMax: 17,
  guide: null,
};
const hifiConfigs: { name: string; cur: HifiOptimizerInput["cur"] }[] = [
  { name: "DEFAULT_HIFI", cur: hifiDefault },
  {
    name: "radiator",
    cur: {
      ...hifiDefault,
      box: "radiator",
      dim: { w: 9, h: 16, d: 11 },
      pr: DEFAULT_HIFI.radiatorSelection,
      xo: 2200,
    },
  },
  {
    // crossed too low for the tweeter: fails a check
    name: "sealed, 1/2 in ply, 1 kHz crossover",
    cur: { ...hifiDefault, box: "sealed", dim: { w: 10, h: 17, d: 12 }, wall: 0.5, xo: 1000 },
  },
];

/** A saved design as the PA search reads it (older saves lack mDim: their mid box's own). */
export function paCurrent(name: string): PaOptimizerCurrent {
  const found = seeds.find((x) => x.name === name);
  if (!found) throw new Error(`no saved design "${name}"`);
  const { name: _name, ...seed } = found;
  return {
    ...seed,
    mDim: seed.mDim ?? (MID_BOXES.find((b) => b.id === seed.midBox) || MID_BOXES[0]).box,
  };
}

/** PA: each seed × the page's default budget and the tests' (which leaves room for a "Smallest change" card) × goal set. */
const paCases = seeds.flatMap(({ name }) => {
  const cur = paCurrent(name);
  return [900, 1100].flatMap((budget) =>
    goalSets.map((goals) => (): Json => {
      const r = optimizePaStack({ cur, room: 1000, maxLb: 125, budget, goals, locks: {} });
      return round({
        seed: name,
        budget,
        goals,
        cards: r.cards.map((k) => ({
          label: k.label,
          why: k.why,
          config: k.config,
          metrics: k.metrics,
          changed: k.changed,
        })),
        nearMiss: r.nearMiss && {
          options: r.nearMiss.options,
          closest: r.nearMiss.closest && {
            config: r.nearMiss.closest.config,
            metrics: r.nearMiss.closest.metrics,
          },
          blocking: r.nearMiss.blocking,
        },
        goalMissing: r.goalMissing,
      });
    }),
  );
});

/** Hi-fi: each design × goal set. */
const hifiCases = hifiConfigs.flatMap(({ name, cur }) =>
  goalSets.map((goals) => (): Json => {
    const r = optimizeHifiSpeaker({
      cur,
      woofers: HIFI_WOOFERS,
      tweeters: HIFI_TWEETERS,
      passives: HIFI_PASSIVES,
      goals,
      locks: {},
      budget: 800,
    });
    return round({
      config: name,
      goals,
      cards: r.cards.map((k) => ({
        label: k.label,
        why: k.why,
        config: k.config,
        metrics: k.metrics,
        changed: k.changed,
      })),
      goalMissing: r.goalMissing,
    });
  }),
);

/** Each kind's cases, in dump order. */
export const DUMP_CASES: Record<DumpKind, (() => Json)[]> = { pa: paCases, hifi: hifiCases };

/** The case indices of one shard of a kind: case i goes to shard i mod shards. */
export const shardCases = (kind: DumpKind, shard: number, shards: number): number[] =>
  DUMP_CASES[kind].map((_, i) => i).filter((i) => i % shards === shard);
