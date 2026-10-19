import { optimizeStack } from "../src/lib/speaker/optimize/optimizeStack";
import { evaluateStack } from "../src/lib/speaker/optimize/stackEvaluate";
import { presetLayers } from "../src/pages/stack/stackPresets";
import { STACK_PRESET, type StackPreset } from "../src/constants/stackPresets";
import type { SpeakerGoal, SpeakerSpec, StackDesign } from "../src/types";
import type { Json } from "./speaker-optimizer-snapshot";

// The Stack optimizer snapshot's runs: a few presets and goals, the target at the preset's level or at the PA room rule's
// (1000 sq ft), and no budget, weight or height limit. tests/stack-optimizer-snapshot.test.ts checks them against
// tests/stack-optimizer-snapshot.json.

/**
 * The level the runs aim at, dB SPL: a 1000 sq ft room's (105 dB at a listener 7 m off, less 6 dB for the pair and 3 dB
 * of room gain).
 */
const TARGET_DB = 105 + 20 * Math.log10(7) - 6 - 3;

/** Where the snapshot's cards are stored. */
export const STACK_SNAPSHOT_FILE = new URL("./stack-optimizer-snapshot.json", import.meta.url);

/** The runs: a preset, its goals in tap order, and the target (null: the preset's own level). */
const CASES: readonly { preset: StackPreset; goals: SpeakerGoal[]; targetDb: number | null }[] = [
  { preset: STACK_PRESET.paStack, goals: ["cheaper"], targetDb: null },
  { preset: STACK_PRESET.paStack, goals: ["louder"], targetDb: TARGET_DB },
  { preset: STACK_PRESET.paTower, goals: ["lighter"], targetDb: TARGET_DB },
  { preset: STACK_PRESET.hifiPair, goals: ["cheaper"], targetDb: null },
];

/** Every number to 3 decimals, so the snapshot compares designs, not float noise. */
const round = (x: unknown): Json =>
  typeof x === "number"
    ? Math.round(x * 1000) / 1000
    : Array.isArray(x)
      ? x.map(round)
      : x && typeof x === "object"
        ? Object.fromEntries(Object.entries(x).map(([k, v]) => [k, round(v)]))
        : // boundary: what is left are JSON primitives (strings, booleans, null, undefined)
          (x as Json);

/** What the snapshot keeps of a speaker: its parts, sizes, vents and bands. */
const speakerOf = (s: SpeakerSpec) => ({
  id: s.id,
  chambers: s.cabinet.chambers.map((c) => ({
    dims: c.dims,
    vent: c.vent,
    drivers: c.drivers.map((d) => `${d.driverId}${d.horn ? `/${d.horn.hornId}` : ""}`),
  })),
  bands: s.bands.map((b) => ({
    hp: b.highpass?.hz,
    lp: b.lowpass?.hz,
    level: b.levelDb,
    ampW: b.ampW,
  })),
});

/** What the snapshot keeps of a stack: its members' crossovers, levels and delays, and its speakers. */
const designOf = (d: StackDesign) => ({
  members: d.stack.members.map((m) => ({
    hp: m.crossover.highpass?.hz,
    lp: m.crossover.lowpass?.hz,
    level: m.levelDb,
    delay: m.delayMs,
  })),
  speakers: d.speakers.map(speakerOf),
});

/** The runs' cards, in case order. */
export function stackSnapshotRuns(): Json[] {
  return CASES.map(({ preset, goals, targetDb }) => {
    const read = presetLayers(preset, { id: "snapshot", name: "Snapshot" });
    const design: StackDesign = { stack: read.stack, speakers: read.speakers };
    const m = evaluateStack(design).metrics;
    const r = optimizeStack(design, goals, {
      targetDb: targetDb ?? m.musicDb ?? 0,
      budget: null,
      maxLb: null,
      maxHeightIn: null,
    });
    return round({
      preset,
      goals,
      cards: r.cards.map((k) => ({
        label: k.label,
        slot: k.slot,
        metrics: k.metrics,
        changed: k.changed,
        design: designOf(k.design),
      })),
      goalMissing: r.goalMissing,
      nearMiss: r.nearMiss && { options: r.nearMiss.options, blocking: r.nearMiss.blocking },
    });
  });
}
