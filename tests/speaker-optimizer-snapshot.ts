import { optimizeSpeaker } from "../src/lib/speaker/optimize/optimizeSpeaker";
import { evaluateSpeaker } from "../src/lib/speaker/optimize/evaluate";
import { templateSpeaker } from "../src/pages/speaker/speakerTemplates";
import { SPEAKER_TEMPLATE, type SpeakerTemplate } from "../src/constants/speakerStarts";
import type { SpeakerGoal, SpeakerSpec } from "../src/types";
import type { Json } from "./optimizer-dump-merge";

// The Speaker optimizer snapshot's runs: a few templates and goals, the target at the template's level and no budget or
// weight limit. tests/speaker-optimizer-snapshot.test.ts checks them against tests/speaker-optimizer-snapshot.json.

/** Where the snapshot's cards are stored. */
export const SPEAKER_SNAPSHOT_FILE = new URL("./speaker-optimizer-snapshot.json", import.meta.url);

/** The runs: a template and its goals in tap order. */
const CASES: readonly { template: SpeakerTemplate; goals: SpeakerGoal[] }[] = [
  { template: SPEAKER_TEMPLATE.hifiTwoWay, goals: ["cheaper"] },
  { template: SPEAKER_TEMPLATE.paTowerBaffleHorn, goals: ["louder"] },
  { template: SPEAKER_TEMPLATE.paSubBox, goals: ["lighter"] },
  { template: SPEAKER_TEMPLATE.monitorCoax, goals: ["lower", "cheaper"] },
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

/** What the snapshot keeps of a design: its parts, sizes, vents and bands. */
const designOf = (s: SpeakerSpec) => ({
  chambers: s.cabinet.chambers.map((c) => ({
    at: c.at,
    dims: c.dims,
    net: c.netLiters,
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

/** The runs' cards, in case order. */
export function speakerSnapshotRuns(): Json[] {
  return CASES.map(({ template, goals }) => {
    const spec = templateSpeaker(template);
    const m = evaluateSpeaker(spec).metrics;
    const r = optimizeSpeaker(spec, goals, { targetDb: m.musicDb ?? 0, budget: null, maxLb: null });
    return round({
      template,
      goals,
      cards: r.cards.map((k) => ({
        label: k.label,
        slot: k.slot,
        metrics: k.metrics,
        changed: k.changed,
        design: designOf(k.spec),
      })),
      goalMissing: r.goalMissing,
      nearMiss: r.nearMiss && { options: r.nearMiss.options, blocking: r.nearMiss.blocking },
    });
  });
}

/** The snapshot file's text: a run's head on a line, each of its cards on a line of its own. */
export function speakerSnapshotText(runs: Json[]): string {
  const lines = runs.map((run) => {
    if (!run || typeof run !== "object" || Array.isArray(run) || !Array.isArray(run.cards))
      return ` ${JSON.stringify(run)}`;
    const { cards, ...head } = run;
    const open = ` ${JSON.stringify(head).slice(0, -1)},"cards":[`;
    return cards.length
      ? `${open}\n${cards.map((k) => `  ${JSON.stringify(k)}`).join(",\n")}\n ]}`
      : `${open}]}`;
  });
  return `[\n${lines.join(",\n")}\n]\n`;
}
