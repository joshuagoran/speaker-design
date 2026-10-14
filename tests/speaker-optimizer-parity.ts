// The parity runs of tests/speaker-optimize.test.ts: the PA and Hi-fi optimizers' cards on the PA tower and Hi-fi 2-way
// templates, read as speaker specs (the L1 adapters) and scored by the Speaker optimizer's own evaluation, beside the
// Speaker optimizer's cards on the same goal. Each side's best on the goal, among the designs that keep what the goal
// keeps of the template (by the speaker model).
import { optimizePaStack } from "../src/lib/pa/optimize";
import { optimizeHifiSpeaker } from "../src/lib/hifi/optimize";
import { optimizeSpeaker } from "../src/lib/speaker/optimize/optimizeSpeaker";
import { evaluateSpeaker, outerSize } from "../src/lib/speaker/optimize/evaluate";
import { isConeKind } from "../src/lib/speaker/driverParts";
import { WOOFER_OPTIONS } from "../src/pages/speaker/speakerParts";
import { byId } from "../src/lib/tables";
import { layersFromPa } from "../src/lib/speaker/paSpec";
import { speakerFromHifi } from "../src/lib/speaker/hifiSpec";
import { speakerIdentity } from "../src/lib/speaker/specParts";
import { defaultPaDesign, templateSpeaker } from "../src/pages/speaker/speakerTemplates";
import { DEFAULT_COVERAGE_LAYOUT } from "../src/lib/pa/coverageLayout";
import { DEFAULT_HIFI, DEFAULT_HIFI_LOOK } from "../src/lib/defaults";
import {
  FILL_OPTIONS,
  HIFI_PASSIVES,
  HIFI_TWEETERS,
  HIFI_WOOFERS,
  hifiDriverByIdOrThrow,
} from "../src/lib/data";
import { panelFor, panelIn } from "../src/lib/panel";
import { keepsFrom, SPEAKER_GOAL_KEEPS } from "../src/lib/optimizer/goalKeeps";
import { keepGap } from "../src/lib/optimizer/shortfall";
import { SPEAKER_PART } from "../src/constants/speakerSpec";
import { SPEAKER_TEMPLATE } from "../src/constants/speakerStarts";
import type {
  HifiCardConfig,
  HifiOptimizerInput,
  SpeakerGoal,
  SpeakerDriver,
  SpeakerOptimizerMetrics,
  SpeakerSpec,
} from "../src/types";

const ID = { id: "parity", name: "Parity" };

/** A goal the PA and Hi-fi optimizers offer too. */
export type LegacyGoal = Exclude<SpeakerGoal, "smaller">;

/** A goal's number from a design's metrics: lower is better. */
export const goalValue = (g: SpeakerGoal, m: SpeakerOptimizerMetrics) =>
  ({
    cheaper: m.price,
    lighter: m.lb,
    smaller: m.volumeL,
    lower: m.f3 ?? Infinity,
    louder: -(m.musicDb ?? -Infinity),
  })[g];

/** One side's best design on the goal that keeps what the goal keeps of the template. */
export interface ParitySide {
  value: number | null;
  /** the cards, the ones inside the Speaker optimizer's space, and of those the ones that keep the goal's keeps */
  cards: number;
  inSpace: number;
  keeping: number;
}

export interface ParityRun {
  template: string;
  goal: SpeakerGoal;
  start: number;
  speaker: ParitySide;
  legacy: ParitySide;
}

/** The best of these specs on the goal among the ones that keep what it keeps of `start`. */
function best(specs: readonly SpeakerSpec[], template: SpeakerSpec, g: SpeakerGoal): ParitySide {
  const start = evaluateSpeaker(template).metrics;
  const keep = keepsFrom(SPEAKER_GOAL_KEEPS, start.musicDb ?? 0, start.f3 ?? Infinity)[g];
  const inside = specs.filter((s) => inSpace(s, template, start));
  const values = inside.flatMap((s) => {
    const m = evaluateSpeaker(s).metrics;
    const gap = keepGap(keep, { db: m.musicDb ?? -Infinity, f3: m.f3 ?? Infinity });
    return gap === 0 ? [goalValue(g, m)] : [];
  });
  return {
    value: values.length ? Math.min(...values) : null,
    cards: specs.length,
    inSpace: inside.length,
    keeping: values.length,
  };
}

/** A cone's nominal size, in (null for a datasheet driver or an unknown id). */
const coneSize = (d: SpeakerDriver) =>
  isConeKind(d.kind)
    ? (byId(WOOFER_OPTIONS, d.driverId)?.size ?? byId(FILL_OPTIONS, d.driverId)?.size ?? null)
    : null;

/**
 * Whether a design is inside the Speaker optimizer's space from the template: the same chambers and driver entries,
 * each cone of the same nominal size, the same plywood, and the box ×0.7 to ×1.5 the template on each axis.
 */
function inSpace(s: SpeakerSpec, template: SpeakerSpec, start: SpeakerOptimizerMetrics): boolean {
  const chambers = template.cabinet.chambers;
  if (s.cabinet.chambers.length !== chambers.length) return false;
  const sameSizes = s.cabinet.chambers.every((c, k) =>
    c.drivers.every((d, j) => {
      const t = chambers[k].drivers[j];
      return !!t && d.kind === t.kind && coneSize(d) === coneSize(t);
    }),
  );
  const size = outerSize(s).sizeIn;
  return (
    sameSizes &&
    // the plywood stays (the owner's list of what the optimizer changes leaves it out)
    s.cabinet.panel.thicknessIn === template.cabinet.panel.thicknessIn &&
    (["w", "h", "d"] as const).every(
      (k) => size[k] >= start.sizeIn[k] * 0.7 - 0.01 && size[k] <= start.sizeIn[k] * 1.5 + 0.01,
    )
  );
}

/** The PA tower: the PA optimizer (a 500 sq ft room, so its target is your output) against the Speaker optimizer. */
export function paTowerParity(goal: LegacyGoal): ParityRun {
  const cur = defaultPaDesign("tower");
  const spec = templateSpeaker(SPEAKER_TEMPLATE.paTowerBaffleHorn);
  const start = evaluateSpeaker(spec).metrics;
  const pa = optimizePaStack({
    cur,
    room: 500,
    maxLb: 1000,
    budget: 5000,
    goals: [goal],
    locks: {},
  });
  const towerId = speakerIdentity(ID, SPEAKER_PART.tower).id;
  const legacy = pa.cards.flatMap((k) => {
    const read = layersFromPa({ ...cur, ...k.config }, ID, DEFAULT_COVERAGE_LAYOUT);
    return read.speakers.filter((s) => s.id === towerId);
  });
  const ours = optimizeSpeaker(spec, [goal], {
    targetDb: start.musicDb ?? 0,
    budget: null,
    maxLb: null,
  });
  return {
    template: SPEAKER_TEMPLATE.paTowerBaffleHorn,
    goal,
    start: goalValue(goal, start),
    speaker: best(
      ours.cards.map((c) => c.spec),
      spec,
      goal,
    ),
    legacy: best(legacy, spec, goal),
  };
}

/** The Hi-fi page's starting design as its optimizer takes it (as the optimizer dump's). */
const HIFI_CUR: HifiOptimizerInput["cur"] = {
  woofer: DEFAULT_HIFI.woofer.id,
  tweeter: DEFAULT_HIFI.tweeter.id,
  box: DEFAULT_HIFI.boxType,
  dim: DEFAULT_HIFI.boxDims,
  wall: panelIn(DEFAULT_HIFI.wallPanel, DEFAULT_HIFI.panelMaterial),
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

/** A Hi-fi card as the Hi-fi page applies it (useHifiPlanner `applyDesign`), read as a speaker. */
function hifiCardSpec(c: HifiCardConfig): SpeakerSpec {
  return speakerFromHifi(
    {
      ...DEFAULT_HIFI,
      woofer: hifiDriverByIdOrThrow("woofer", c.woofer),
      tweeter: hifiDriverByIdOrThrow("tweeter", c.tweeter),
      boxType: c.box,
      boxDims: c.dim,
      portSpec: c.port ?? DEFAULT_HIFI.portSpec,
      radiatorSelection: c.pr ?? DEFAULT_HIFI.radiatorSelection,
      wallPanel:
        panelFor(
          { wall: c.wall, panel: DEFAULT_HIFI.wallPanel },
          DEFAULT_HIFI.panelMaterial,
          DEFAULT_HIFI.panelExactIn,
        ) ?? DEFAULT_HIFI.wallPanel,
      crossoverHz: c.xo,
      wooferAmpWatts: c.wAmpW,
      tweeterAmpWatts: c.tAmpW,
    },
    DEFAULT_HIFI_LOOK,
    ID,
  );
}

/** The Hi-fi 2-way: the Hi-fi optimizer (no budget limit to speak of) against the Speaker optimizer. */
export function hifiParity(goal: LegacyGoal): ParityRun {
  const spec = templateSpeaker(SPEAKER_TEMPLATE.hifiTwoWay);
  const start = evaluateSpeaker(spec).metrics;
  const hifi = optimizeHifiSpeaker({
    cur: HIFI_CUR,
    woofers: HIFI_WOOFERS,
    tweeters: HIFI_TWEETERS,
    passives: HIFI_PASSIVES,
    goals: [goal],
    locks: {},
    budget: 5000,
  });
  const ours = optimizeSpeaker(spec, [goal], {
    targetDb: start.musicDb ?? 0,
    budget: null,
    maxLb: null,
  });
  return {
    template: SPEAKER_TEMPLATE.hifiTwoWay,
    goal,
    start: goalValue(goal, start),
    speaker: best(
      ours.cards.map((c) => c.spec),
      spec,
      goal,
    ),
    legacy: best(
      hifi.cards.map((k) => hifiCardSpec(k.config)),
      spec,
      goal,
    ),
  };
}
