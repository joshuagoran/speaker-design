import fs from "node:fs";
import { optimizePaStack } from "../src/lib/pa/optimize";
import { optimizeHifiSpeaker } from "../src/lib/hifi/optimize";
import { HIFI_PASSIVES, HIFI_TWEETERS, HIFI_WOOFERS, MID_BOXES } from "../src/lib/data";
import { DEFAULT_HIFI } from "../src/lib/defaults";
import type {
  HifiGoal,
  HifiOptimizerInput,
  HifiOptimizerLocks,
  PaGoal,
  PaOptimizerCurrent,
} from "../src/types";

// The fixed designs and goal sets the optimizer dump and the snapshot test run, and each run's record of the cards it
// picks (numbers to 3 decimals).

export type Json = number | string | boolean | null | undefined | Json[] | { [k: string]: Json };
/** Every number to 3 decimals, so the dump compares designs, not float noise. */
export const round = (x: unknown): Json =>
  typeof x === "number"
    ? Math.round(x * 1000) / 1000
    : Array.isArray(x)
      ? x.map(round)
      : x && typeof x === "object"
        ? Object.fromEntries(Object.entries(x).map(([k, v]) => [k, round(v)]))
        : // boundary: what is left are JSON primitives (strings, booleans, null, undefined)
          (x as Json);

export const GOALS: readonly PaGoal[] = ["cheaper", "lighter", "lower", "louder"];
/** Every goal set the page offers: each goal alone, and each pair with the primary first. */
export const goalSets: PaGoal[][] = [
  ...GOALS.map((g) => [g]),
  ...GOALS.flatMap((a) => GOALS.filter((b) => b !== a).map((b) => [a, b])),
];

// boundary: the seed file is saved configurations, as the planner stores them (older ones lack mDim)
export const seeds = JSON.parse(
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
export const hifiConfigs: { name: string; cur: HifiOptimizerInput["cur"] }[] = [
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

/** A saved design as the PA optimizer reads it (older saves lack mDim: the mid box's own). */
export function paCurrent(name: string): PaOptimizerCurrent {
  const seed = seeds.find((x) => x.name === name);
  if (!seed) throw new Error(`no saved design "${name}"`);
  const { name: _name, ...cur } = seed;
  return {
    ...cur,
    mDim: cur.mDim ?? (MID_BOXES.find((b) => b.id === cur.midBox) || MID_BOXES[0]).box,
  };
}

/** The PA search's cards for a saved design, budget and goal set. */
export function paRun(seed: string, budget: number, goals: PaGoal[]): Json {
  const r = optimizePaStack({
    cur: paCurrent(seed),
    room: 1000,
    maxLb: 125,
    budget,
    goals,
    locks: {},
  });
  return round({
    seed,
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
}

/** The Hi-fi search's cards for one of `hifiConfigs`, a goal set and locks. */
export function hifiRun(config: string, goals: HifiGoal[], locks: HifiOptimizerLocks = {}): Json {
  const found = hifiConfigs.find((c) => c.name === config);
  if (!found) throw new Error(`no Hi-fi config "${config}"`);
  const r = optimizeHifiSpeaker({
    cur: found.cur,
    woofers: HIFI_WOOFERS,
    tweeters: HIFI_TWEETERS,
    passives: HIFI_PASSIVES,
    goals,
    locks,
    budget: 800,
  });
  return round({
    config,
    goals,
    // only the locked runs carry their locks (the dump's runs have none)
    ...(Object.keys(locks).length ? { locks } : {}),
    cards: r.cards.map((k) => ({
      label: k.label,
      why: k.why,
      config: k.config,
      metrics: k.metrics,
      changed: k.changed,
    })),
    goalMissing: r.goalMissing,
  });
}

/**
 * The snapshot test's runs, a quick slice of the dump: three saved PA designs on each goal, and a few Hi-fi runs with the
 * drivers locked (so they stay fast).
 */
export function snapshotRuns(): { pa: Json[]; hifi: Json[] } {
  const pa = ["lil block stack", "rectangle sub", "lil tower"].flatMap((name) =>
    GOALS.map((g) => paRun(name, 1100, [g])),
  );
  const drivers = { woofer: true, tweeter: true };
  const hifi = [
    hifiRun("DEFAULT_HIFI", ["cheaper"], drivers),
    hifiRun("DEFAULT_HIFI", ["lower", "lighter"], drivers),
    hifiRun("radiator", ["louder"], drivers),
  ];
  return { pa, hifi };
}
