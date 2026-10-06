// Design optimizer: finds three buildable systems that beat the current design on a goal, inside the
// user's limits and locks. Pure (no DOM); runs in a Web Worker or on the main thread.
//
// Search, coarse to exact (docs/optimizer-plan.md):
//   1. screen sub driver x net volume x tuning x highpass with an ideal vent (coarse model grid)
//   2. build real boxes for the best seeds: dimensions inside the limits, each vent style and size,
//      duct length solved for the tuning; keep the smallest vent that doesn't limit
//   3. mid designs per driver at a few Qtc targets, crossover options, horn pairs; combine with the subs
//   4. evaluate the finalists with the planner's own functions and pick three different cards
import { PA_SLIDERS } from "../../constants/paSliders";
import {
  boxModel,
  closedBox,
  subGeometry,
  subSystem,
  midSystem,
  subwooferLimits,
  ampVoltage,
  hornResponse,
  subWeightLb,
  ventSpeedLimit,
  midWeightLb,
  boxInternalLiters,
  cutParts,
  nearestPoint,
  subMusicOutputAt,
  linkwitzRileyLowpass,
  pistonBeamWidthDeg,
  keeleFrequency,
  maxOutputCurve,
  subBassLevel,
  STUFFING_VOLUME_GAIN,
} from "./calc";
import {
  subChips,
  midChips,
  hornChips,
  ductFit,
  ductLenSliderMax,
  subDriverClearanceNeededIn,
  subBaffleFits,
  KEEP_UP_SLACK_DB,
} from "./chips";
import { SUB_OPTIONS, MID_OPTIONS, CD_OPTIONS, HORN_OPTIONS, subDriversOfSize } from "../data";
import { PORT_TUBES } from "../../data/catalog/port-tubes";
import type {
  ChangeName,
  CutlistSettings,
  Dims3,
  SliderSpec,
  DimensionLockMode,
  HornHf,
  MidDriver,
  PaBoxGeometry,
  PaDesignConfig,
  PaChipId,
  PaChosen,
  PaEvaluation,
  PaExactHook,
  PaGoal,
  PaHornEntry,
  PaMetricsSummary,
  PaNearMiss,
  PaOptimizedField,
  PaOptimizedFields,
  PaOptimizerCard,
  PaMetric,
  PaOptimizerInput,
  OptimizerProgressCallback,
  PaOptimizerLocks,
  PaOptimizerResult,
  PaPoolEntry,
  PaProblem,
  PaProblemLimits,
  PaResolvedLocks,
  PaRoom,
  PaScore,
  PortStyle,
  SubDriver,
  SubLimits,
  SubSystemModelled,
  VentedBoxModel,
  VentSpec,
} from "../../types";
import { keysOf } from "../records";
import { selectCards, type SelectedCard } from "../optimizer/selectCards";
import { byId, byIdOrThrow } from "../tables";
import { DEFAULT_PA } from "../defaults";
import { layoutCutlist, savedCutlist } from "./cutlist";
import { savedCrossoverOrder } from "../../constants/crossovers";
import { keepGap, outOfReachNotice, type Keep } from "../optimizer/shortfall";
import { goalKeeps, PA_UNMODELLED_F3_HZ } from "../optimizer/goalKeeps";
import { LIMIT_CHIP_IDS } from "../../constants/chipIds";
import { SUB_LIMITED_BY } from "../../constants/limits";
import {
  CARD_LABELS,
  CARD_WHY,
  CHANGE_NAMES,
  DESIGN_PROBLEM_TEXT,
  GOAL_SHORT_NAMES,
  SHARED_GOAL_NAMES,
} from "../../constants/optimizerText";
import { ampForGain, onSlider, type AmpSteps } from "../optimizer/ampSteps";
import { throttledProgress } from "../optimizer/progress";
import { CATALOG_TABLE_NAMES } from "../../constants/catalogTables";
import { UI_TEXT } from "../../constants/uiText";
import { PLYWOOD_MATERIAL } from "../../constants/panelSizes";
import { panelChoicesIn, savedPanelExactIn } from "../panel";

const r2 = (x: number, q = 0.5) => Math.round(x / q) * q;

type ProblemLimits = PaProblemLimits;
type Score = PaScore;
type Metric = PaMetric;
/** A sub and its box volume, tuning and highpass from the coarse screen. */
interface Seed {
  sub: SubDriver;
  V: number;
  Fb: number;
  hpf: number;
  out: number;
  f3: number;
  lb: number;
  price: number;
}
/** A real sub box with its vent and model. */
interface SubCandidate {
  c: PaDesignConfig;
  s: SubSystemModelled;
  sub: SubDriver;
  lb: number;
  out: number;
}
/** A mid's level at a crossover, dB: its limit and its response at the searched power. */
interface MidLevel {
  max: number;
  sig: number;
}
/**
 * A mid driver in a box at one crossover, with its level there, and per upper crossover the horn pairs it can keep up
 * with (cheapest first) and its loudest limit at its own crossover with any of them.
 */
interface MidEntry {
  m: MidDriver;
  bx: Dims3;
  t: number;
  xoLo: number;
  lo: MidLevel;
  pairs: Record<number, MidPair[]>;
  loudest: Record<number, number>;
  qtc: number;
  lb: number;
}
type HornEntry = PaHornEntry;
/** A horn pair a mid keeps up with: the mid's amp once it does, and its limit at the lower crossover then, dB. */
interface MidPair {
  hp: HornEntry;
  mAmpW: number;
  lo: number;
}
/** A whole design the combine step offers for evaluation. */
interface Combo extends Score {
  c: PaDesignConfig;
  ch: number;
}
type PoolEntry = PaPoolEntry;
/** A card as `choose` picks it: the design, its label and its why. */
type PlannedCard = SelectedCard<PoolEntry, PaGoal>;
type ResolvedLocks = PaResolvedLocks;
type AmpKey = "ampW" | "mAmpW" | "hfAmpW";

// Slider ranges in the planner, used when a dimension is free.
export const SUB_BOX_RANGE: Record<keyof Dims3, [number, number]> = {
  w: [PA_SLIDERS.subW.min, PA_SLIDERS.subW.max],
  h: [PA_SLIDERS.subH.min, PA_SLIDERS.subH.max],
  d: [PA_SLIDERS.subD.min, PA_SLIDERS.subD.max],
};
export const MID_BOX_RANGE: Record<keyof Dims3, [number, number]> = {
  w: [PA_SLIDERS.midW.min, PA_SLIDERS.midW.max],
  h: [PA_SLIDERS.midH.min, PA_SLIDERS.midH.max],
  d: [PA_SLIDERS.midD.min, PA_SLIDERS.midD.max],
};
export const rangeOf = (
  mode: DimensionLockMode | undefined,
  cur: number,
  [lo, hi]: [number, number],
): [number, number] =>
  mode === "exact" ? [cur, cur] : mode === "max" ? [lo, Math.min(hi, cur)] : [lo, hi];

// Clean music-limit SPL per stack at 1 m (45 Hz) for ~105 dB at the listener: distance, two stacks (+6 dB),
// room gain. A rule of thumb, shown to the user as such.
export const ROOMS: Record<PaRoom, { d: number; gain: number; name: string; short: string }> = {
  500: { d: 5, gain: 3, name: "500 sq ft", short: "500" },
  750: { d: 6, gain: 3, name: "750 sq ft", short: "750" },
  1000: { d: 7, gain: 3, name: "1000 sq ft", short: "1000" },
  outdoor: { d: 10, gain: 0, name: UI_TEXT.outdoors, short: UI_TEXT.outdoors },
};
/** The level the planner aims for at the listener, dB SPL. */
export const LISTENER_TARGET_DB = 105;
export const roomRequiredSpl = (room: PaRoom) => {
  const r = ROOMS[room] || ROOMS[1000];
  return LISTENER_TARGET_DB + 20 * Math.log10(r.d) - 6 - r.gain;
};

export const OPTIMIZER_GOALS: Record<PaGoal, { short: string; name: string; why: string }> = {
  cheaper: {
    short: GOAL_SHORT_NAMES.cheaper,
    name: "Same output, cheaper",
    why: "Cheapest drivers that still reach the target.",
  },
  lighter: {
    short: GOAL_SHORT_NAMES.lighter,
    name: "Same output, lighter",
    why: "Lightest boxes that still reach the target.",
  },
  lower: {
    short: GOAL_SHORT_NAMES.lower,
    name: SHARED_GOAL_NAMES.lower,
    why: "Lowest F3 that keeps the target output.",
  },
  louder: {
    short: GOAL_SHORT_NAMES.louder,
    name: SHARED_GOAL_NAMES.louder,
    why: "Most output inside your limits.",
  },
};
const ALT_LABEL: Record<PaGoal, string> = { ...GOAL_SHORT_NAMES, lower: "Goes lower" };
/** How the PA notice names its level, F3 and the pair, when the first card only comes closest. */
export const PA_REACH_WORDS = { level: "of output", f3: "an F3", both: "output and bass" };
const ALT_ORDER: Record<PaGoal, PaGoal[]> = {
  cheaper: ["lighter", "louder"],
  lighter: ["cheaper", "louder"],
  lower: ["louder", "cheaper"],
  louder: ["cheaper", "lighter"],
};

// Vent sizes per style, smallest area first: the round styles from the port-tube catalogue (stock pipe), the rectangular
// ones (ply ducts, cut to any size) from the search's own grid of slot heights and duct throats.
// "round1" and "round4" are the one-tube and four-corner-tube layouts (the geometry treats every round style alike, from `nt` and
// `dia`), so they take the tubes of that count; "round2" tries every tube count, as it always has.
const tubesOf = (count?: number) =>
  PORT_TUBES.filter(({ nt }) => count === undefined || nt === count).map(({ nt, dia }) => ({
    nt,
    dia,
  }));
const VENT_SIZES: Record<PortStyle, Partial<VentSpec>[]> = {
  round1: tubesOf(1),
  round2: tubesOf(),
  round4: tubesOf(4),
  slots: [2, 2.5, 3, 3.5, 4, 4.5, 5, 6].map((slotH) => ({ slotH })),
  vslots: [1, 1.25, 1.5, 1.75, 2, 2.5, 3].map((throat) => ({ throat })),
  vslot1: [1.5, 2, 2.5, 3, 3.5, 4, 5].map((throat) => ({ throat })),
};
/** The vent sizes the search tries for a style, smallest area first. */
export const ventSizesFor = (style: PortStyle) => VENT_SIZES[style];
/** Every vent style. */
export const VENT_STYLES = keysOf(VENT_SIZES);

// Clean output: the lowest music-limit level from 40 to 90 Hz, so a peak in the response can't win.
export const SUB_BAND_HZ = [40, 90];
export function bandOutputDb(
  mdl: Pick<VentedBoxModel, "curve">,
  lim: Pick<SubLimits, "V">,
  AMP_V: number,
) {
  const sc = 20 * Math.log10(lim.V / AMP_V);
  let lo = Infinity;
  for (const o of mdl.curve)
    if (o.f >= SUB_BAND_HZ[0] && o.f <= SUB_BAND_HZ[1] && o.spl + sc < lo) lo = o.spl + sc;
  return lo;
}

// The numbers evaluateDesign reads from a config. A saved design from an older version can lack some of them, and a missing
// one would flow through the model as NaN.
const REQUIRED_NUMBERS = [
  "hpf",
  "ampW",
  "portMax",
  "wall",
  "inset",
  "xoLo",
  "xoHi",
  "mAmpW",
  "tilt",
  "hfTilt",
  "hfAmpW",
] as const satisfies readonly (keyof PaDesignConfig)[];
const hasDims = (d: Partial<Dims3> | undefined) =>
  d !== undefined && Number.isFinite(d.w) && Number.isFinite(d.h) && Number.isFinite(d.d);

// The vent fields a layout reads: the slot height for the slots, the throat for the side ducts, the tubes' count and
// diameter for the round ones, and the length for all of them. A known layout with all of its fields is a vent that can be modelled.
const VENT_FIELDS: Record<PortStyle, readonly (keyof VentSpec)[]> = {
  slots: ["slotH", "len"],
  vslots: ["throat", "len"],
  vslot1: ["throat", "len"],
  round1: ["nt", "dia", "len"],
  round2: ["nt", "dia", "len"],
  round4: ["nt", "dia", "len"],
};
const hasVent = (style: PortStyle | undefined, vent: Partial<VentSpec> | undefined) =>
  style !== undefined &&
  Object.hasOwn(VENT_FIELDS, style) &&
  vent !== undefined &&
  VENT_FIELDS[style].every((k) => Number.isFinite(vent[k]));

// ---- the planner's evaluation of a whole config (same functions, same order as the page) ----
// Null for a design it can't evaluate: an unknown driver, a config missing a number, a box size or a vent it needs, or a box with no model.
export function evaluateDesign(c: PaDesignConfig): PaEvaluation | null {
  // boundary: the type says every field is there, but a saved or handed-over config may not have them all
  if (
    !REQUIRED_NUMBERS.every((k) => Number.isFinite(c[k])) ||
    !hasDims(c.cDim) ||
    !hasDims(c.mDim) ||
    !hasVent(c.portStyle, c.cVent)
  )
    return null;
  const sub = byId(SUB_OPTIONS, c.sub),
    mid = byId(MID_OPTIONS, c.mid),
    cd = byId(CD_OPTIONS, c.cd),
    horn = byId(HORN_OPTIONS, c.horn);
  if (!sub || !sub.ts || !mid || !mid.ts || !cd || !horn) return null;
  const midDims = c.layout === "tower" ? { w: c.cDim.w, h: 15.5, d: c.cDim.d } : c.mDim;
  // boundary: a save from before the slope setting has no orders, and reads as LR24
  const xoLoOrder = savedCrossoverOrder(c.xoLoOrder),
    xoHiOrder = savedCrossoverOrder(c.xoHiOrder);
  const s = subSystem(sub, mid, {
    subBox: c.cDim,
    midDims,
    wall: c.wall,
    inset: c.inset,
    portStyle: c.portStyle,
    cVent: c.cVent,
    hpf: c.hpf,
    hpType: c.hpType,
    ampW: c.ampW,
    portMax: c.portMax,
    layout: c.layout,
  });
  const ms = midSystem(mid, {
    midDims,
    wall: c.wall,
    inset: c.inset,
    xoLo: c.xoLo,
    xoHi: c.xoHi,
    xoLoOrder,
    xoHiOrder,
    mAmpW: c.mAmpW,
  });
  const subLb = subWeightLb(c.cDim, c.wall, sub.lb),
    midLb = midWeightLb(midDims, c.wall) + (mid.lb || 0);
  if (!s.mdl || !ms.mdl) return null; // a vent or box with no geometry has no model to evaluate
  const subMusic = subMusicOutputAt(s.mdl, s.lim, s.AMP_V, c.xoLo, xoLoOrder);
  const hz: Partial<HornHf> = horn.hf || {};
  const hornModel = hornResponse(cd.hf, hz, c.xoHi, c.hfAmpW, xoHiOrder);
  const mm = ms.mdl,
    midAtXo = nearestPoint(ms.max, c.xoLo),
    midAtHi = nearestPoint(ms.max, c.xoHi).spl;
  const hornAtXo = hornModel ? nearestPoint(hornModel.curve, c.xoHi).spl : null;
  const chips = {
    sub: subChips({
      subSize: sub.size,
      subDepthIn: sub.depthIn,
      subBox: c.cDim,
      portStyle: c.portStyle,
      cVent: c.cVent,
      PT: c.wall,
      subLbLoaded: subLb,
      lim: s.lim,
      peakXF: s.mdl.peakXF,
      aes: sub.ts.aes,
      ampW: c.ampW,
    }),
    mid: midChips({
      midSize: mid.size,
      midDims,
      Qtc: mm.Qtc,
      f3: mm.f3,
      peakX: mm.peakX,
      xoLo: c.xoLo,
      ts: mid.ts,
      V: ms.V,
      useV: ms.useV,
      vTherm: ms.vTherm,
      mAmpW: c.mAmpW,
      subMusicAtXo: subMusic,
      tilt: c.tilt,
      midAtXo,
    }),
    horn: hornModel
      ? hornChips({
          hf: hornModel.hf,
          hz,
          horn,
          xoHi: c.xoHi,
          hornModel,
          hfAmpW: c.hfAmpW,
          midAtXoHi: midAtHi,
          hfTilt: c.hfTilt,
          hornAtXo,
          midBeam: pistonBeamWidthDeg(mid.ts.Sd, c.xoHi),
          fK: hz.covH && horn.size ? keeleFrequency(hz.covH, horn.size.w) : null,
        })
      : [],
  };
  // the driver budget: sub + mid + compression driver (the horn isn't a driver; printed ones are ~$50)
  const parts = [sub, mid, cd];
  return {
    price: parts.reduce((a, o) => a + (o.price || 0), 0),
    priceKnown: parts.every((o) => o.price != null),
    hornPrice: horn.price || 0,
    subLb,
    midLb,
    heaviest: Math.max(subLb, midLb),
    out: bandOutputDb(s.mdl, s.lim, s.AMP_V),
    spl45: s.lim.spl45,
    spl35: s.lim.spl35,
    subBass: subBassLevel(maxOutputCurve(s.mdl.curve, sub.ts, s.AMP_V, c.portMax)),
    f3: s.mdl.f3,
    Fb: s.mdl.Fb,
    who: s.lim.who,
    limW: s.lim.W,
    netL: s.netL,
    qtc: mm.Qtc,
    midF3: mm.f3,
    midGap: midAtXo.spl - (subMusic - c.tilt),
    hornGap: hornAtXo != null ? hornAtXo - (midAtHi - c.hfTilt) : null,
    mismatch: horn.exit !== cd.exit,
    port: s.port,
    chips,
    // for the card's chart: the sub's clean music-limit level, 20-200 Hz (the curve bandOut takes its minimum from)
    curve: s.mdl.curve
      .filter((o, i) => i % 5 === 0 && o.f >= 20 && o.f <= 200)
      .map((o): [number, number] => [
        +o.f.toFixed(1),
        +(o.spl + 20 * Math.log10(s.lim.V / s.AMP_V)).toFixed(2),
      ]),
  };
}

// Reasons a config can't be a card (hard limits and the planner's own warnings that matter for a build).
// Warnings a card may carry (shown on it). Anything else the planner warns about rules a design out, unless
// lim.allow lists it (a warning the current design has from parts the user locked, so nothing can fix it).
const SOFT_OK = new Set<PaChipId>([
  "subWeight",
  "subAmpLimited",
  "subExcursionLimited",
  "subThermalLimited",
  "midAmpLimited",
  "midExcursionLimited",
  "midThermalLimited",
  "midQtc",
  "hornAmpLimited",
  "hornWiderThanRated",
  "hornMidNarrower",
  "hornMidWider",
]);
/** What a design fails, by id with its words: the checks' bad and warning chips, then the search's own tests. */
export function designProblemList(m: PaEvaluation | null, lim: ProblemLimits): PaProblem[] {
  if (!m) return [{ id: "unmodelled", text: DESIGN_PROBLEM_TEXT.unmodelled }];
  const out: PaProblem[] = [];
  for (const k of ["sub", "mid", "horn"] as const)
    for (const [kind, head, , id] of m.chips[k]) {
      if (
        kind === "bad" ||
        (kind === "warn" && !SOFT_OK.has(id) && !(lim.allow && lim.allow.has(id)))
      )
        out.push({ id, text: head });
    }
  if (m.qtc < 0.5 || m.qtc > 0.8) out.push({ id: "midQtc", text: `mid Qtc ${m.qtc.toFixed(2)}` });
  if (m.mismatch) out.push({ id: "exitMismatch", text: DESIGN_PROBLEM_TEXT.exitMismatch });
  if (m.heaviest > lim.maxLb + 1e-9)
    out.push({ id: "overWeight", text: `${m.heaviest.toFixed(0)} lb box` });
  if (m.price > lim.budget + 1e-9)
    out.push({ id: "overBudget", text: `drivers $${Math.round(m.price)} per stack` });
  return out;
}
/** What a design fails, in words. */
export const designProblems = (m: PaEvaluation | null, lim: ProblemLimits) =>
  designProblemList(m, lim).map((p) => p.text);

// ---- search ----
// input: { cur (the planner's snapshot), room, maxLb, budget (drivers per stack), goals, locks }
// goals: one or more of GOALS, in tap order. The first ranks the designs; the main card must also beat your
// design on every other one (e.g. ["cheaper", "lighter"]: the cheapest design that's also lighter). `goal` alone still works.
// locks: { sub, mid, cd, horn, vent, wall, hpf, xoLo, xoHi, ampW, mAmpW, hfAmpW, subDim: {w,h,d}, midDim: {w,h,d} }
// (dims: "free"|"max"|"exact"; an unlocked amp is searched up to AMP_MAX)
// The fields a result sets; everything else (finish, colours, layout, balance) stays as the page has it.
// the planner's amp sliders top out here; an unlocked amp is searched up to these
export const AMP_WATTS_MAX = { ampW: 3000, mAmpW: 2000, hfAmpW: 500 };
// and their steps and minimums: an amp the search turns down stays on a step, never under the minimum
export const AMP_WATTS_STEPS: Record<AmpKey, AmpSteps> = {
  ampW: { step: 50, min: 200 },
  mAmpW: { step: 25, min: 50 },
  hfAmpW: { step: 5, min: 10 },
};
export const OPTIMIZED_FIELDS: readonly PaOptimizedField[] = [
  "sub",
  "mid",
  "cd",
  "horn",
  "cDim",
  "cVent",
  "portStyle",
  "hpf",
  "mDim",
  "wall",
  "xoLo",
  "xoHi",
  "ampW",
  "mAmpW",
  "hfAmpW",
];
export const pickOptimizedFields = (c: PaDesignConfig) =>
  // boundary cast: Object.fromEntries types its result as an index signature; these are exactly the optimized fields
  Object.fromEntries(OPTIMIZED_FIELDS.map((k) => [k, c[k]])) as PaOptimizedFields;

// Progress: the screen's grid points one by one make the first half of the bar; the steps after it share the second half
// by their rough share of the work (the boxes for the seeds, the mid designs, the combine step, the finalists).
const PA_STEP_SHARES = { boxes: 0.5, mids: 0.3, combine: 0.1, finalists: 0.1 } as const;
type PaStep = keyof typeof PA_STEP_SHARES;
// where each step starts in that half: the shares before it
const PA_STEP_START: Record<PaStep, number> = { boxes: 0, mids: 0.5, combine: 0.8, finalists: 0.9 };

/** How far under the target an alternative card's output may be, dB. */
export const ALT_OUTPUT_DB = 1.5;
/** Two designs on the same sub, vent style, mid and plywood are the same card unless their sub boxes' volumes differ by this share. */
export const SAME_VOLUME = 0.15;
/** The crossovers the search tries when they aren't locked, Hz. */
export const XO_LO_OPTIONS = [90, 100, 110, 120, 140];
export const XO_HI_OPTIONS = [800, 900, 1000, 1200, 1500];
/** The plywoods the search tries when the plywood isn't locked: each nominal size at your design's measured thickness, in. */
export const wallOptions = (cur: Pick<PaDesignConfig, "exactIn">) =>
  panelChoicesIn(PLYWOOD_MATERIAL, savedPanelExactIn(cur.exactIn));
/** The plywoods a search tries: your design's own (its measured thickness) while the plywood is locked, else every size. */
export const paSearchWalls = (
  cur: Pick<PaDesignConfig, "wall" | "exactIn">,
  locks: Pick<PaOptimizerLocks, "wall">,
) => (locks.wall ? [cur.wall] : wallOptions(cur));
/** The highpasses the search tries for a tuning when the highpass isn't locked: 0.85× and 1× the tuning, 20 Hz at least. */
export const highpassOptions = (fb: number) => [
  Math.max(20, Math.round(fb * 0.85)),
  Math.max(20, Math.round(fb)),
];

/** Your design as the search reads it. */
export function paSearchDesign(input: Pick<PaOptimizerInput, "cur">): PaDesignConfig {
  // older saved configs can lack some fields; they fall back to the planner's starting design
  const { xoLo, xoHi, tilt, hfTilt, ampW, mAmpW, hfAmpW, hpType, portMax, wall, inset, layout } =
    DEFAULT_PA;
  // the crossover slopes are the design's own: every candidate keeps them (the search varies only the frequencies)
  return {
    xoLo,
    xoHi,
    tilt,
    hfTilt,
    ampW,
    mAmpW,
    hfAmpW,
    hpType,
    portMax,
    wall,
    inset,
    layout,
    ...input.cur,
    xoLoOrder: savedCrossoverOrder(input.cur.xoLoOrder),
    xoHiOrder: savedCrossoverOrder(input.cur.xoHiOrder),
  };
}
/** The amps the search runs at: a locked amp as it is, an unlocked one at the top of its slider. */
export const paSearchAmps = (cur: PaDesignConfig, locks: PaOptimizerLocks) => ({
  ampW: locks.ampW ? cur.ampW : AMP_WATTS_MAX.ampW,
  mAmpW: locks.mAmpW ? cur.mAmpW : AMP_WATTS_MAX.mAmpW,
  hfAmpW: locks.hfAmpW ? cur.hfAmpW : AMP_WATTS_MAX.hfAmpW,
});

/**
 * The quick search; `onProgress` hears how far it has got (coarse: grid points, then work units per step). With `exact`,
 * the exact search (lib/pa/optimizeExact) adds its grid's designs to this search's pool and reports its own progress.
 */
export function optimizePaStack(
  input: PaOptimizerInput,
  onProgress?: OptimizerProgressCallback,
  exact?: PaExactHook,
): PaOptimizerResult {
  const t0 = Date.now();
  const report = throttledProgress(onProgress);
  // set once the screen's grid is known: its point count, which is also the units the later steps share
  let screenUnits = 1;
  /** reports item `i` of `n` in a step after the screen */
  const stepAt = (step: PaStep, i: number, n: number) =>
    report(
      Math.round(
        screenUnits * (1 + PA_STEP_START[step] + (PA_STEP_SHARES[step] * i) / Math.max(n, 1)),
      ),
      2 * screenUnits,
    );
  const { room = 1000 } = input;
  const goals = (
    input.goals && input.goals.length ? input.goals : [input.goal || "cheaper"]
  ).filter((g, i, a) => OPTIMIZER_GOALS[g] && a.indexOf(g) === i);
  const goal = goals[0],
    also = goals.slice(1);
  const cur = paSearchDesign(input);
  // the cards count sheets as the Cutlist tab does
  const cl: CutlistSettings = {
    ...savedCutlist(cur),
    sheet: input.cutlist?.sheet ?? DEFAULT_PA.plywoodSheetKind,
    stacks: input.cutlist?.stacks ?? 1,
    joint: cur.joint || DEFAULT_PA.joint,
  };
  const locks: ResolvedLocks = { subDim: {}, midDim: {}, ...input.locks };
  const budget = input.budget; // drivers per stack
  const lim: Required<ProblemLimits> = { maxLb: input.maxLb, budget, allow: new Set<PaChipId>() };
  // Unlocked amps are searched at the top of their slider (so the drivers, not the amp, set the limit), turned down where
  // the band above can't keep up (the combine step), then every card comes back at the least power that keeps its output
  // and keeps each band up with the one below.
  const amps = paSearchAmps(cur, locks);
  const base = { ...cur, ...amps };
  const curM = evaluateDesign(cur);
  // horn loading is fixable by the horn, the driver or the crossover; only when all three are locked and the
  // current design already has the warning is it allowed through
  const hornLoadOk = !!(
    locks.horn &&
    locks.cd &&
    locks.xoHi &&
    curM &&
    curM.chips.horn.some(([, , , id]) => id === "hornLoading")
  );
  if (hornLoadOk) lim.allow.add("hornLoading");
  const need = roomRequiredSpl(room);
  const target = Math.max(curM ? curM.out : need, need);
  const curF3 = curM ? curM.f3 : PA_UNMODELLED_F3_HZ;
  let evals = 0;

  // candidate lists
  const curSub = byId(SUB_OPTIONS, cur.sub),
    curMid = byId(MID_OPTIONS, cur.mid);
  const priced = <T extends { ts: object; price: number | null }>(
    o: T,
  ): o is T & { price: number } => !!o.ts && o.price != null;
  // a locked driver that isn't in the tables leaves nothing to search. The exact search runs this one too: its designs
  // join the exact search's pool, so Fully optimize's cards are never behind Improve's (the two grids differ)
  const subs = locks.sub
    ? curSub
      ? [curSub]
      : []
    : subDriversOfSize(curSub ? curSub.size : 18).filter((o) => priced(o) && o.price <= budget);
  const walls = paSearchWalls(cur, locks);
  const styles: PortStyle[] = locks.vent ? [cur.portStyle] : ["slots", "vslots", "round2"];
  const xoLos = locks.xoLo ? [cur.xoLo] : XO_LO_OPTIONS;
  const xoHis = locks.xoHi ? [cur.xoHi] : XO_HI_OPTIONS;
  const sr = {
    w: rangeOf(locks.subDim.w, cur.cDim.w, SUB_BOX_RANGE.w),
    h: rangeOf(locks.subDim.h, cur.cDim.h, SUB_BOX_RANGE.h),
    d: rangeOf(locks.subDim.d, cur.cDim.d, SUB_BOX_RANGE.d),
  };
  const AMP_V = ampVoltage(amps.ampW);

  // box shapes inside the limits with gross volume near G, lightest first, a few distinct depths
  const allExact = sr.w[0] === sr.w[1] && sr.h[0] === sr.h[1] && sr.d[0] === sr.d[1];
  const shapes = (G: number, t: number, lb: number, size: number, n = 3) => {
    if (allExact) {
      const box = { w: sr.w[0], h: sr.h[0], d: sr.d[0] };
      return [{ box, lb: subWeightLb(box, t, lb) }];
    }
    const out: { box: Dims3; lb: number }[] = [];
    // whole inches from the bottom of the range, plus the top itself (a half-inch "up to" value stays reachable)
    const step = (lo: number, hi: number) => {
      if (lo === hi) return [lo];
      const v = Array.from({ length: Math.floor(hi - lo) + 1 }, (_, i) => lo + i);
      if (v[v.length - 1] !== hi) v.push(hi);
      return v;
    };
    for (const w of step(...sr.w))
      for (const h of step(...sr.h)) {
        if (
          w < subDriverClearanceNeededIn(size) - 0.01 ||
          h < subDriverClearanceNeededIn(size) - 0.01
        )
          continue;
        const D = (G * 1000) / 16.387 / ((w - 2 * t) * (h - 2 * t)); // inner depth needed
        const d = r2(D + cur.inset + 0.75 + t, 0.5);
        if (d < sr.d[0] || d > sr.d[1]) continue;
        if (
          sr.d[0] === sr.d[1] &&
          Math.abs(boxInternalLiters(w, h, sr.d[0], t, cur.inset) - G) / G > 0.06
        )
          continue;
        const box = { w, h, d: sr.d[0] === sr.d[1] ? sr.d[0] : d };
        out.push({ box, lb: subWeightLb(box, t, lb) });
      }
    out.sort((a, b) => a.lb - b.lb);
    const pick: { box: Dims3; lb: number }[] = [];
    for (const o of out) {
      if (
        pick.every(
          (p) =>
            Math.abs(p.box.d - o.box.d) >= 2 ||
            Math.abs(p.box.h / p.box.w - o.box.h / o.box.w) > 0.2,
        )
      )
        pick.push(o);
      if (pick.length >= n) break;
    }
    return pick;
  };

  // 1. screening with an ideal vent (big, never limits), coarse grid
  const seeds: Seed[] = [];
  const Vmax = boxInternalLiters(sr.w[1], sr.h[1], sr.d[1], 0.5, cur.inset),
    Vmin = Math.max(40, boxInternalLiters(sr.w[0], sr.h[0], sr.d[0], 0.75, cur.inset));
  const vols = [];
  if (allExact)
    vols.push(
      Math.max(20, boxInternalLiters(sr.w[0], sr.h[0], sr.d[0], cur.wall, cur.inset) * 0.9 - 10),
    ); // the one box, roughly net
  else
    for (let i = 0; i < 10; i++)
      vols.push(Vmin * Math.pow(Math.max(Vmax * 0.85, Vmin * 1.01) / Vmin, i / 9));
  const fbs = [28, 31, 34, 37, 40, 43];
  // the grid's points: a highpass per tuning when it's locked, else two
  screenUnits = Math.max(1, subs.length * vols.length * fbs.length * (locks.hpf ? 1 : 2));
  let screened = 0;
  for (const sub of subs)
    for (const V of vols)
      for (const Fb of fbs) {
        const hps = locks.hpf ? [cur.hpf] : highpassOptions(Fb);
        for (const hpf of hps) {
          report(screened++, 2 * screenUnits);
          const Sp = 80,
            Leff = (Sp * 0.00064516 * 343 * 343) / ((2 * Math.PI * Fb) ** 2 * (V / 1000));
          const Lp = Leff / 0.0254 - 1.46 * Math.sqrt(Sp / Math.PI);
          if (Lp <= 0) continue;
          const mdl = boxModel(sub.ts, V, Sp, Lp, hpf, AMP_V, cur.hpType, { N: 70 });
          evals++;
          if (!mdl) continue;
          const L = subwooferLimits(mdl, sub.ts, AMP_V, Infinity);
          const sh = shapes(V + (sub.ts.disp || 10) + 0.08 * V + 3, 0.75, sub.lb, sub.size, 1)[0];
          seeds.push({
            sub,
            V,
            Fb,
            hpf,
            out: bandOutputDb(mdl, L, AMP_V),
            f3: mdl.f3,
            lb: sh ? sh.lb : Infinity,
            price: sub.price,
          });
        }
      }
  const pickSeeds = (key: (x: Seed) => number, n: number, ok: (x: Seed) => boolean) =>
    seeds
      .filter(ok)
      .sort((a, b) => key(a) - key(b))
      .slice(0, n);
  const meets = (x: Seed) => x.out >= target - 0.5 && x.f3 <= curF3 + 2;
  // the current design itself (its sub, volume, tuning and highpass): small changes such as plywood or a vent
  // size are always tried, even when the grid above has no point near it
  const curSeed =
    curM && curSub && curSub.ts && subs.includes(curSub)
      ? [
          {
            sub: curSub,
            V: curM.netL,
            Fb: curM.Fb,
            hpf: cur.hpf,
            out: curM.out,
            f3: curM.f3,
            lb: curM.subLb,
            price: curSub.price,
          },
        ]
      : [];
  const seedSet = new Set([
    ...curSeed,
    ...pickSeeds((x) => x.price * 100 + x.lb, 10, meets),
    ...pickSeeds((x) => x.lb, 10, meets),
    ...pickSeeds(
      (x) => x.f3,
      8,
      (x) => x.out >= target - 1.5,
    ),
    ...pickSeeds(
      (x) => -x.out,
      8,
      (x) => x.f3 <= curF3 + 3,
    ),
  ]);

  // 2. real boxes and vents for the seeds
  const subCands: SubCandidate[] = [];
  // the sub's geometry reads only the sub's own cut parts; the mid just has to exist for the cut list, so with no known
  // current mid the first table entry will do
  const midForGeom = curMid ?? MID_OPTIONS[0];
  let seedNo = 0;
  for (const sd of seedSet) {
    stepAt("boxes", seedNo++, seedSet.size);
    for (const t of walls) {
      const G = sd.V + (sd.sub.ts.disp || 10) + 0.08 * sd.V + 3;
      for (const { box } of shapes(G, t, sd.sub.lb, sd.sub.size)) {
        for (const style of styles) {
          const mk = (size: Partial<VentSpec>, len: number): VentSpec => ({
            ...cur.cVent,
            ...size,
            len,
          });
          const geom = (cVent: VentSpec) =>
            subGeometry(sd.sub, midForGeom, {
              subBox: box,
              midDims: cur.mDim,
              wall: t,
              inset: cur.inset,
              portStyle: style,
              cVent,
              layout: cur.layout,
            });
          let pushed = false,
            fallback: { c: PaDesignConfig; cVent: VentSpec; s: SubSystemModelled } | null = null;
          for (const size of ventSizesFor(style)) {
            // the lengths that fit, inside the duct-length slider, one way at a time: a bottom slot runs straight, then
            // (past the lengths that fit neither way) folds up the back wall; round tubes take each elbow count apart,
            // since each elbow steps the tuning
            const spans = ductFit(box, style, mk(size, 0), t, sd.sub)
              .tune.map(
                ([a, b]) =>
                  [
                    Math.max(a, PA_SLIDERS.ductLen.min),
                    Math.min(b, ductLenSliderMax(box, style, mk(size, 0), t, sd.sub)),
                  ] as const,
              )
              .filter(([a, b]) => b >= a + 0.25);
            const first = spans[0],
              last = spans[spans.length - 1];
            if (!first || !last) continue;
            const fbShort = geom(mk(size, first[0])).Fb,
              fbLong = geom(mk(size, last[1])).Fb;
            if (sd.Fb > fbShort) continue; // vent too small to tune this high: next size
            if (sd.Fb < fbLong) break; // too big for the room it has: bigger won't fit either
            // the shortest span that reaches the tuning (a slot's spans have the lengths that fit neither way between
            // them): a straight slot when one tunes it, else the fold, at its shortest when even that tunes lower
            const [lo, hi] =
              spans.find(([, b]) => b === last[1] || geom(mk(size, b)).Fb <= sd.Fb) ?? last;
            let a = lo,
              b = hi;
            for (let i = 0; i < 12; i++) {
              const m = (a + b) / 2;
              if (geom(mk(size, m)).Fb > sd.Fb) a = m;
              else b = m;
            }
            // to the quarter inch, never out of its span (a slot rounded across its fold would land where it fits neither way)
            const cVent = mk(
              size,
              Math.max(
                Math.ceil(lo * 4) / 4,
                Math.min(Math.floor(hi * 4) / 4, r2((a + b) / 2, 0.25)),
              ),
            );
            if (!subBaffleFits(box, style, cVent, t, sd.sub)) continue;
            const c = {
              ...base,
              sub: sd.sub.id,
              cDim: box,
              wall: t,
              portStyle: style,
              cVent,
              hpf: sd.hpf,
            };
            const s = subSystem(sd.sub, midForGeom, {
              subBox: box,
              midDims: cur.mDim,
              wall: t,
              inset: cur.inset,
              portStyle: style,
              cVent,
              hpf: sd.hpf,
              hpType: cur.hpType,
              ampW: amps.ampW,
              portMax: cur.portMax,
              layout: cur.layout,
            });
            evals++;
            if (!s.mdl) continue;
            const portOk =
              s.lim.who !== "port" && s.lim.vel <= 0.9 * ventSpeedLimit(style, cur.portMax);
            if (!portOk) {
              fallback = { c, cVent, s };
              continue;
            } // try the next size up
            subCands.push({
              c,
              s,
              sub: sd.sub,
              lb: subWeightLb(box, t, sd.sub.lb),
              out: bandOutputDb(s.mdl, s.lim, s.AMP_V),
            });
            pushed = true;
            break; // smallest vent that doesn't limit
          }
          // no vent keeps up at full power (an unlocked amp searched at its maximum): the biggest vent that fits,
          // with the amp turned down to where the port still has a 10% air-speed margin
          if (!pushed && fallback && !locks.ampW) {
            const vW =
              Math.pow(
                (fallback.s.AMP_V * (0.9 * ventSpeedLimit(style, cur.portMax))) /
                  fallback.s.mdl.peakVel,
                2,
              ) / 8;
            const ampW = onSlider(vW, AMP_WATTS_STEPS.ampW);
            if (ampW !== null) {
              const c = { ...fallback.c, ampW };
              const s = subSystem(sd.sub, midForGeom, {
                subBox: box,
                midDims: cur.mDim,
                wall: t,
                inset: cur.inset,
                portStyle: style,
                cVent: fallback.cVent,
                hpf: sd.hpf,
                hpType: cur.hpType,
                ampW,
                portMax: cur.portMax,
                layout: cur.layout,
              });
              evals++;
              if (s.mdl && s.lim.who !== "port")
                subCands.push({
                  c,
                  s,
                  sub: sd.sub,
                  lb: subWeightLb(box, t, sd.sub.lb),
                  out: bandOutputDb(s.mdl, s.lim, s.AMP_V),
                });
            }
          }
        }
      }
    }
  }

  // 3. mid designs: each driver at a few Qtc targets, boxes inside the limits, per crossover
  const mids = locks.mid
    ? curMid
      ? [curMid]
      : []
    : MID_OPTIONS.filter((o) => o.size >= 12 && priced(o) && o.price <= budget);
  const mr = {
    w: rangeOf(locks.midDim.w, cur.mDim.w, MID_BOX_RANGE.w),
    h: rangeOf(locks.midDim.h, cur.mDim.h, MID_BOX_RANGE.h),
    d: rangeOf(locks.midDim.d, cur.mDim.d, MID_BOX_RANGE.d),
  };
  const midBoxes = (m: MidDriver, t: number): (Dims3 | null)[] => {
    if (cur.layout === "tower") return [null]; // follows the sub's footprint
    const ts = m.ts,
      Sd = ts.Sd / 1e4,
      Mms = ts.Mms / 1e3,
      Cms = 1 / ((2 * Math.PI * ts.Fs) ** 2 * Mms);
    const Vas = 1.18 * 343 * 343 * Sd * Sd * Cms * 1000,
      Qes = (2 * Math.PI * ts.Fs * Mms * ts.Re) / (ts.Bl * ts.Bl),
      Qts = (Qes * ts.Qms) / (Qes + ts.Qms);
    const disp = ts.disp != null ? ts.disp : m.size === 15 ? 4 : 2.5,
      need = m.size + 1.2;
    const out: Dims3[] = [];
    const exact = mr.w[0] === mr.w[1] && mr.h[0] === mr.h[1] && mr.d[0] === mr.d[1];
    if (exact) return [{ w: mr.w[0], h: mr.h[0], d: mr.d[0] }];
    for (const q of [0.55, 0.62, 0.7, 0.77]) {
      const r = (q / Qts) ** 2 - 1;
      if (r <= 0) continue;
      const G = Vas / r / STUFFING_VOLUME_GAIN + disp;
      let best: { bx: Dims3; lb: number } | null = null;
      for (let w = Math.max(mr.w[0], Math.ceil(need)); w <= mr.w[1]; w++)
        for (let h = Math.max(mr.h[0], Math.ceil(need)); h <= mr.h[1]; h++) {
          const D = (G * 1000) / 16.387 / ((w - 2 * t) * (h - 2 * t)),
            d = r2(D + cur.inset + 0.75 + t, 0.5);
          if (d < mr.d[0] || d > mr.d[1] || d < 6) continue;
          const bx = { w, h, d },
            lb = midWeightLb(bx, t);
          if (!best || lb < best.lb) best = { bx, lb };
        }
      if (best && !out.some((o) => o.w === best.bx.w && o.h === best.bx.h && o.d === best.bx.d))
        out.push(best.bx);
    }
    return out;
  };
  // horn pairs per xoHi, with their level at the crossover
  // (a locked driver or horn that isn't in the tables leaves nothing to search, like a locked sub or mid)
  const curCd = byId(CD_OPTIONS, cur.cd),
    curHorn = byId(HORN_OPTIONS, cur.horn);
  const cds = locks.cd
    ? curCd
      ? [curCd]
      : []
    : CD_OPTIONS.filter((o) => o.hf && o.hf.sens != null && o.price != null);
  const horns = locks.horn
    ? curHorn
      ? [curHorn]
      : []
    : HORN_OPTIONS.filter((h) => h.price != null);
  const hornTable: Record<number, HornEntry[]> = {};
  for (const xoHi of xoHis) {
    hornTable[xoHi] = [];
    for (const cd of cds)
      for (const h of horns) {
        if (h.exit !== cd.exit) continue;
        const hz: Partial<HornHf> = h.hf || {};
        if (!cd.hf) continue; // a locked driver with no published spec can't be modelled
        if ((cd.hf.minXo && xoHi < cd.hf.minXo) || (hz.minXo && xoHi < hz.minXo)) continue;
        if (hz.lowHz && hz.lowHz > xoHi * 0.8 && !hornLoadOk) continue; // horn stops loading near the crossover
        const hm = hornResponse(cd.hf, hz, xoHi, amps.hfAmpW, cur.xoHiOrder);
        evals++;
        if (!hm) continue;
        hornTable[xoHi].push({
          cd,
          h,
          at: nearestPoint(hm.curve, xoHi).spl,
          price: cd.price || 0,
          horn: h.price || 0,
          same: cd.id === cur.cd && h.id === cur.horn,
        });
      }
    hornTable[xoHi].sort((a, b) => a.price - b.price || a.horn - b.horn);
  }
  const midPrice = (e: MidEntry) => e.m.price ?? 0; // an unpriced mid (only a locked one gets here) counts as 0
  const curMidPrice = curMid?.price || 0;
  // the upper crossover's lowpass at its own frequency, dB, per xoHi
  const lowpassAtXo: Record<number, number> = Object.fromEntries(
    xoHis.map((f) => [f, 20 * Math.log10(linkwitzRileyLowpass(f, f, cur.xoHiOrder))]),
  );
  // the horn pairs a mid at these levels (at xoLo, and at xoHi through its lowpass) keeps up with, cheapest first. A
  // horn that runs out first caps the mid when its amp is free: the mid comes down to the highest power (slider steps)
  // where it stands no more than the check's slack above the horn, and its level at xoLo with it.
  const pairsAt = (lo: MidLevel, hi: MidLevel, xoHi: number): MidPair[] =>
    hornTable[xoHi].flatMap((hp) => {
      const room = hp.at + cur.hfTilt + KEEP_UP_SLACK_DB;
      const mAmpW =
        hi.max <= room
          ? amps.mAmpW
          : locks.mAmpW
            ? null
            : ampForGain(amps.mAmpW, room - hi.sig, AMP_WATTS_STEPS.mAmpW);
      if (mAmpW === null) return [];
      return [{ hp, mAmpW, lo: Math.min(lo.max, lo.sig + 10 * Math.log10(mAmpW / amps.mAmpW)) }];
    });
  const midTable: MidEntry[] = [];
  for (const [mi, m] of mids.entries())
    for (const [ti, t] of walls.entries())
      for (const bx of midBoxes(m, t)) {
        stepAt("mids", mi * walls.length + ti, mids.length * walls.length);
        if (!bx) continue;
        const disp = m.ts.disp != null ? m.ts.disp : m.size === 15 ? 4 : 2.5;
        const eff =
          Math.max(5, boxInternalLiters(bx.w, bx.h, bx.d, t, cur.inset) - disp) *
          STUFFING_VOLUME_GAIN;
        for (const xoLo of xoLos) {
          const V = ampVoltage(amps.mAmpW),
            mdl = closedBox(m.ts, eff, xoLo, null, V, {
              N: 120,
              hpOrder: cur.xoLoOrder,
              lpOrder: cur.xoHiOrder, // no lowpass here: it is applied at each xoHi below
            });
          evals++;
          if (!mdl || mdl.Qtc < 0.5 || mdl.Qtc > 0.8 || mdl.f3 > xoLo) continue;
          const max = maxOutputCurve(mdl.curve, m.ts, V, Infinity);
          const levelAt = (f: number, lp = 0): MidLevel => ({
            max: nearestPoint(max, f).spl + lp,
            sig: nearestPoint(mdl.curve, f).spl + lp,
          });
          const lo = levelAt(xoLo);
          const pairs: Record<number, MidPair[]> = Object.fromEntries(
            xoHis.map((f) => [f, pairsAt(lo, levelAt(f, lowpassAtXo[f]), f)]),
          );
          midTable.push({
            m,
            bx,
            t,
            xoLo,
            lo,
            pairs,
            loudest: Object.fromEntries(
              xoHis.map((f) => [f, Math.max(...pairs[f].map((p) => p.lo))]),
            ),
            qtc: mdl.Qtc,
            lb: midWeightLb(bx, t) + (m.lb || 0),
          });
        }
      }
  // per lower crossover and plywood, the table's entries (with their place in it) by price and by weight, the table's
  // order on ties: the combine step scans them with early exits
  const midOrder = (key: (e: MidEntry) => number) => {
    const groups: Record<string, { e: MidEntry; i: number }[]> = {};
    midTable.forEach((e, i) => (groups[`${e.xoLo} ${e.t}`] ??= []).push({ e, i }));
    for (const g of Object.values(groups)) g.sort((a, b) => key(a.e) - key(b.e));
    return (xoLo: number, t: number) => groups[`${xoLo} ${t}`] ?? [];
  };
  const midsByPrice = midOrder(midPrice),
    midsByLb = midOrder((e) => e.lb);

  // combine: for each sub and crossover pair, the mid and horn that keep up, best for each objective.
  // A band that runs out first caps the design's level instead of ruling it out, when the amp of the band below it is
  // free: the mid comes down to the highest power (slider steps) where the horn keeps up, then the sub to the highest where
  // that mid keeps up. An amp moves its band 1 dB per dB of power, up to what cone, port or coil allowed at the searched
  // power (the sub's whole band at once, the mid's per frequency); each card's amps are trimmed further at the end.
  const changes = (c: PaDesignConfig) =>
    (["sub", "mid", "cd", "horn", "portStyle", "wall"] as const).filter((k) => c[k] !== cur[k])
      .length;
  const combos: Combo[] = [];
  const slack = { budget: budget * 1.25, lb: input.maxLb * 1.25 };
  // the sub's amp and output once a mid `gap` dB short at the crossover keeps up (null: the amp is locked or would go
  // under its slider). Keeping up means within the check's slack, so the sub comes down only that far.
  const subFor = (sc: SubCandidate, gap: number) => {
    if (gap >= -KEEP_UP_SLACK_DB) return { ampW: sc.c.ampW, out: sc.out };
    const ampW = locks.ampW
      ? null
      : ampForGain(sc.s.lim.W, gap + KEEP_UP_SLACK_DB, AMP_WATTS_STEPS.ampW);
    return ampW === null ? null : { ampW, out: sc.out + 10 * Math.log10(ampW / sc.s.lim.W) };
  };
  for (const [ci, sc] of subCands.entries()) {
    stepAt("combine", ci, subCands.length);
    if (sc.lb > slack.lb || sc.sub.price > slack.budget) continue;
    for (const xoLo of xoLos) {
      const need = subMusicOutputAt(sc.s.mdl, sc.s.lim, sc.s.AMP_V, xoLo, cur.xoLoOrder) - cur.tilt;
      // each mid with the output it leaves the sub
      const okMids = midTable.flatMap((e) => {
        const s =
          e.xoLo === xoLo && e.t === sc.c.wall && e.lb <= slack.lb
            ? subFor(sc, e.lo.max - need)
            : null;
        return s ? [{ e, out: s.out }] : [];
      });
      // the tower layout takes the mid as it is, so it needs the current mid to exist
      const towerMid = cur.layout === "tower" && curMid !== undefined;
      // the current mid at its loudest
      const same = okMids
        .filter((x) => x.e.m.id === cur.mid)
        .sort((a, b) => b.out - a.out || a.e.lb - b.e.lb)[0];
      // the mids chosen at each upper crossover; their combos then go in mid by mid (the ranking keeps that order on ties)
      const choices = new Map<MidEntry | null, number[]>();
      const fullOut = new Map(okMids.map((x) => [x.e, x.out]));
      // a mid's output at a level `lo` at xoLo (at its full level, the output found above); -Infinity: none
      const outAt = (e: MidEntry, lo: number) =>
        lo === e.lo.max ? (fullOut.get(e) ?? -Infinity) : (subFor(sc, lo - need)?.out ?? -Infinity);
      for (const xoHi of xoHis) {
        // the most output any mid keeps with any pair: it rises with the mid's level, so the loudest level sets it
        const loudest = okMids.reduce<MidEntry | undefined>(
          (a, { e }) => (!a || e.loudest[xoHi] > a.loudest[xoHi] ? e : a),
          undefined,
        );
        const top = loudest ? outAt(loudest, loudest.loudest[xoHi]) : -Infinity;
        const cheapestPair = hornTable[xoHi].length ? hornTable[xoHi][0].price : Infinity;
        // the price of mid `e` with the cheapest pair it reaches `level` with; null when none does for `most` or less (the
        // pairs go cheapest first, so the scan stops there)
        const pricedAt = (e: MidEntry, level: number, most: number) => {
          for (const q of e.pairs[xoHi]) {
            const price = midPrice(e) + q.hp.price;
            if (price > most) return null;
            if (outAt(e, q.lo) >= level) return price;
          }
          return null;
        };
        // mid `e` is one of this sub's and reaches `level` with the pair that leaves it loudest
        const reaches = (e: MidEntry, level: number) => {
          const out = fullOut.has(e) ? outAt(e, e.loudest[xoHi]) : -Infinity;
          return out > -Infinity && out >= level;
        };
        // of the mids that reach `level` with some pair, each priced with the cheapest pair that does: the cheapest (then
        // the lightest, then the first in the table), scanned by price until the mid with the cheapest horn costs more;
        // and the lightest (then the cheapest), scanned by weight
        const bestAt = (level: number) => {
          if (top === -Infinity || level > top) return []; // none does
          let cheap: { e: MidEntry; i: number; price: number } | undefined;
          for (const { e, i } of midsByPrice(xoLo, sc.c.wall)) {
            if (cheap && midPrice(e) + cheapestPair > cheap.price) break;
            if (!reaches(e, level)) continue;
            const c = pricedAt(e, level, cheap ? cheap.price : Infinity);
            if (
              c !== null &&
              (!cheap ||
                c < cheap.price ||
                (c === cheap.price && (e.lb < cheap.e.lb || (e.lb === cheap.e.lb && i < cheap.i))))
            )
              cheap = { e, i, price: c };
          }
          let light: typeof cheap;
          for (const { e, i } of midsByLb(xoLo, sc.c.wall)) {
            if (light && e.lb > light.e.lb) break;
            if (!reaches(e, level)) continue;
            const l = pricedAt(e, level, light ? light.price : Infinity);
            if (l !== null && (!light || l < light.price)) light = { e, i, price: l };
          }
          return [cheap, light];
        };
        // chosen with the horn in view (a mid the horn can't keep up with comes down, and the sub with it): the cheapest
        // and the lightest that keep the target, and that keep the most output; and the current mid at its loudest
        for (const x of [...bestAt(target - 0.5), ...bestAt(top - 1e-9), same]) {
          if (!x) continue;
          const his = choices.get(x.e) ?? [];
          if (!his.includes(xoHi)) choices.set(x.e, [...his, xoHi]);
        }
      }
      if (towerMid) choices.set(null, xoHis);
      for (const [e, his] of choices)
        for (const xoHi of his) {
          // each pair with the amps and output once every band keeps up (the tower's mid isn't checked here)
          const fits = e
            ? e.pairs[xoHi].flatMap(({ hp, mAmpW, lo }) => {
                const s = subFor(sc, lo - need);
                return s ? [{ hp, mAmpW, ...s }] : [];
              })
            : hornTable[xoHi].map((hp) => ({
                hp,
                ampW: sc.c.ampW,
                mAmpW: amps.mAmpW,
                out: sc.out,
              }));
          // the cheapest pair that keeps the target, the cheapest that keeps the most output, and the current one (the
          // smaller change)
          const topHf = Math.max(...fits.map((x) => x.out));
          const picks = new Set([
            fits.find((x) => x.out >= target - 0.5),
            fits.find((x) => x.out >= topHf - 1e-9),
            fits.find((x) => x.hp.same),
          ]);
          for (const x of picks) {
            if (!x) continue;
            const { hp } = x;
            const c = {
              ...sc.c,
              ampW: x.ampW,
              mAmpW: x.mAmpW,
              xoLo,
              xoHi,
              mid: e ? e.m.id : cur.mid,
              mDim: e ? e.bx : cur.mDim,
              cd: hp.cd.id,
              horn: hp.h.id,
            };
            const price = sc.sub.price + (e ? midPrice(e) : curMidPrice) + hp.price;
            const heaviest = Math.max(sc.lb, e ? e.lb : 0);
            combos.push({ c, price, heaviest, out: x.out, f3: sc.s.mdl.f3, ch: changes(c) });
          }
        }
    }
  }

  // 4. exact evaluation of the best combos for each objective
  // objective per goal; small nudges toward fewer changes and fewer warnings (w). Cheaper ranks fewest warnings
  // first (a warning outweighs any price), then strictly the price, with weight then changes only breaking ties: prices
  // differ by whole cents, and 1e-6 a lb plus 1e-8 a change (six at most) stay under a cent for any box under 9000 lb
  const obj: Record<PaGoal, (x: Metric) => number> = {
    cheaper: (x) => 1e6 * (x.w || 0) + x.price + 1e-6 * x.heaviest + 1e-8 * x.ch,
    lighter: (x) => x.heaviest + 0.5 * x.ch + 2 * (x.w || 0),
    lower: (x) => x.f3 + 0.1 * x.ch + 0.7 * (x.w || 0),
    louder: (x) => -x.out + 0.05 * x.ch + 0.5 * (x.w || 0),
  };
  // what each goal keeps from your design: the output it has to reach and the F3 it can't pass
  const keep: Record<PaGoal, Keep> = goalKeeps(target, curF3);
  const goalGap = (g: PaGoal, x: Score) => keepGap(keep[g], { db: x.out, f3: x.f3 });
  const goalOk = (g: PaGoal, x: Score) => goalGap(g, x) === 0;
  // an alternative has to beat the first card on its own axis by a margin that matters
  const beats: Record<PaGoal, (x: Score, y: Score) => boolean> = {
    cheaper: (x, y) => x.price < y.price,
    lighter: (x, y) => x.heaviest <= y.heaviest - 3,
    lower: (x, y) => x.f3 <= y.f3 - 2,
    louder: (x, y) => x.out >= y.out + 1,
  };
  const finalists = new Map<string, Combo>();
  const inLimits = (x: Score) => x.price <= budget + 1e-9 && x.heaviest <= input.maxLb + 1e-9;
  // the near miss's retries: 10 % more budget or weight
  const inLooser = (x: Score) =>
    x.price <= budget + Math.ceil(input.budget * 0.1) + 1e-9 &&
    x.heaviest <= Math.ceil(input.maxLb * 1.1) + 1e-9;
  const add = (list: Combo[], n: number) =>
    list.slice(0, n).forEach((x) => finalists.set(JSON.stringify(x.c), x));
  for (const g of keysOf(obj)) {
    const ranked = combos.filter((x) => goalOk(g, x)).sort((a, b) => obj[g](a) - obj[g](b));
    add(ranked.filter(inLimits), 14); // candidates for the cards
    add(ranked, 4); // and a few just outside the limits, for the near-miss message
    add(ranked.filter(inLooser), 6); // and inside the loosened limits the near miss offers
  }
  // the designs inside the limits that come closest to every goal, for the closest card when none keeps them
  const gapSum = (x: Score) => goals.reduce((sum, g) => sum + goalGap(g, x), 0);
  add(
    combos.filter(inLimits).sort((a, b) => gapSum(a) - gapSum(b)),
    8,
  );
  if (also.length && curM) {
    const cm = { price: curM.price, heaviest: curM.heaviest, out: curM.out, f3: curM.f3 };
    const ranked = combos
      .filter((x) => goals.every((g) => goalOk(g, x)) && also.every((g) => beats[g](x, cm)))
      .sort((a, b) => obj[goal](a) - obj[goal](b));
    add(ranked.filter(inLimits), 14);
    add(ranked, 4);
  }
  const pool: PoolEntry[] = [];
  for (const [fi, x] of [...finalists.values()].entries()) {
    stepAt("finalists", fi, finalists.size);
    const m = evaluateDesign(x.c);
    evals++;
    if (m) pool.push({ c: x.c, m, ch: changes(x.c) });
  }
  // one-change tweaks of the current design, evaluated as they are: the other plywood
  if (!locks.wall && curM)
    for (const w of walls)
      if (w !== cur.wall) {
        const c = { ...base, wall: w },
          m = evaluateDesign(c);
        evals++;
        if (m) pool.push({ c, m, ch: changes(c) });
      }
  const warnCount = (m: PaEvaluation) =>
    (["sub", "mid", "horn"] as const).reduce(
      (a, k) =>
        a +
        m.chips[k].filter(
          ([kind, , , id]) => kind === "warn" && !LIMIT_CHIP_IDS.has(id) && id !== "subWeight",
        ).length,
      0,
    );
  const metric = (p: PoolEntry): Metric => ({
    price: p.m.price,
    heaviest: p.m.heaviest,
    out: p.m.out,
    f3: p.m.f3,
    ch: p.ch,
    w: warnCount(p.m),
  });

  // Every card's label has to be true against your design (the deltas it shows): a "Cheaper" card costs less,
  // a "Lighter" one weighs less, and so on. If nothing beats your design on the goal, that card is left out.
  const curMet: Score | null = curM
    ? { price: curM.price, heaviest: curM.heaviest, out: curM.out, f3: curM.f3 }
    : null;
  const curFails = !curM || designProblems(curM, lim).length > 0;
  const FIX_WHY: Record<PaGoal, string> = {
    cheaper: "Cheapest design that passes the checks.",
    lighter: "Lightest design that passes the checks.",
    lower: "Lowest F3 that passes the checks.",
    louder: "Loudest design that passes the checks.",
  };
  const THAN: Record<PaGoal, string> = {
    cheaper: "cheaper",
    lighter: "lighter",
    lower: "lower",
    louder: "louder",
  };
  const goalLabel = also.length
    ? goals.map((g, i) => (i ? THAN[g] : OPTIMIZER_GOALS[g].short)).join(" + ")
    : OPTIMIZER_GOALS[goal].name;
  const goalWhy = also.length
    ? `${OPTIMIZER_GOALS[goal].why.replace(/\.$/, "")}, and ${also.map((g) => ({ cheaper: "costs less", lighter: "weighs less", lower: "goes lower", louder: "is louder" })[g]).join(" and ")} than your design.`
    : OPTIMIZER_GOALS[goal].why;
  const trueVsCur = (axis: PaGoal, p: PoolEntry) => !curMet || beats[axis](metric(p), curMet);
  const ALT_WHY: Record<PaGoal, string> = {
    louder: "More output than your design.",
    lower: CARD_WHY.altLower,
    cheaper: "Costs less than your design, close to the target.",
    lighter: "Lighter than your design, close to the target.",
  };
  // stacked goals: single-goal options first, so you can see what dropping the others buys
  const altAxes = [...(also.length ? goals : []), ...ALT_ORDER[goal], ...keysOf(ALT_LABEL)].filter(
    (a, i, arr) => arr.indexOf(a) === i && (also.length || a !== goal),
  );
  const chooseFrom = (L: ProblemLimits, tgt: number): PaChosen | null => {
    const ok = pool.filter((p) => designProblems(p.m, L).length === 0);
    const vol = (c: PaDesignConfig) => c.cDim.w * c.cDim.h * c.cDim.d;
    const relaxed = (p: PoolEntry) => ({ ...metric(p), out: p.m.out + (target - tgt) });
    const { cards, goalMissing, fixMisses } = selectCards<PoolEntry, PaGoal>({
      pool: ok,
      goal,
      goals,
      objective: (g, p) => obj[g](metric(p)),
      beatsCurrent: trueVsCur,
      beats: (g, a, b) => beats[g](metric(a), metric(b)),
      // the output is held to the retry's relaxed target
      meets: (p) => goals.every((g) => goalOk(g, relaxed(p))),
      shortfall: (p) => goals.reduce((sum, g) => sum + goalGap(g, relaxed(p)), 0),
      differs: (p, chosen) =>
        chosen.every(
          (k) =>
            k.c.sub !== p.c.sub ||
            k.c.portStyle !== p.c.portStyle ||
            k.c.mid !== p.c.mid ||
            k.c.wall !== p.c.wall ||
            Math.abs(vol(p.c) / vol(k.c) - 1) >= SAME_VOLUME,
        ),
      changeCount: (p) => p.ch,
      currentFails: curFails,
      hasCurrent: !!curMet,
      altAxes,
      // alternatives stay close to the target
      altFilter: (_g, p) => p.m.out >= tgt - ALT_OUTPUT_DB,
      labels: {
        first: { label: goalLabel, why: goalWhy },
        // your design fails a check: the goal's best design that passes (it may cost or weigh more)
        fix: { label: CARD_LABELS.fix, why: FIX_WHY[goal] },
        // nothing that passes keeps what the goals keep: the one that comes closest (the notice says what it misses)
        closest: {
          label: CARD_LABELS.closest,
          why: CARD_WHY.closest,
        },
        alt: (g) => ({ label: ALT_LABEL[g], why: ALT_WHY[g] }),
      },
    });
    return cards.length ? { cards, goalMissing, fixMisses } : null;
  };
  // the exact search adds designs to the pool until no design on its grid beats a pick
  const choose = exact
    ? exact.close(chooseFrom, {
        cur,
        base,
        amps,
        locks,
        lim,
        goals,
        target,
        keep,
        curMet,
        curFails,
        xoHis,
        mids,
        midBoxes,
        hornTable,
        altAxes,
        obj,
        beats,
        metric,
        changes,
        pool,
      })
    : chooseFrom;

  // Unlocked amps: the least power per channel (in the sliders' steps) that still reaches the target and keeps
  // each band up with the one below it. Sub first (a quieter sub asks less of the mid), then mid, then HF.
  const shrinkAmps = (p: PoolEntry, tgtOut: number): PoolEntry => {
    let c = { ...p.c },
      m = p.m;
    const ok = (mm: PaEvaluation | null): mm is PaEvaluation =>
      mm !== null && designProblems(mm, lim).length === 0;
    const lowest = (key: AmpKey, good: (m: PaEvaluation) => boolean) => {
      const { min: lo, step } = AMP_WATTS_STEPS[key];
      if (locks[key] || c[key] <= lo) return;
      const floor = { ...c, [key]: lo },
        fm = evaluateDesign(floor);
      evals++;
      if (ok(fm) && good(fm)) {
        c = floor;
        m = fm;
        return;
      } // the slider minimum is enough
      let a = lo,
        b = c[key]; // a fails, b is known good
      while (b - a > step) {
        const mid = Math.round((a + b) / 2 / step) * step,
          cc = { ...c, [key]: mid },
          mm = evaluateDesign(cc);
        evals++;
        if (mid <= a || mid >= b) break;
        if (ok(mm) && good(mm)) b = mid;
        else a = mid;
      }
      const cc = { ...c, [key]: b },
        mm = evaluateDesign(cc);
      evals++;
      if (ok(mm) && good(mm)) {
        c = cc;
        m = mm;
      }
    };
    lowest("ampW", (mm) => mm.out >= tgtOut - 0.01);
    lowest("mAmpW", (mm) => mm.midGap >= 0);
    lowest("hfAmpW", (mm) => mm.hornGap == null || mm.hornGap >= 0);
    return { ...p, c, m };
  };
  // Every card on the planner's sliders, so it loads as a design the planner can show: a box side or the duct length
  // off its slider's step is rounded to the steps either side (and one further, since rounding the duct retunes the
  // box), each try checked with the planner's model. The try that fails nothing the card didn't, keeping each goal's keep
  // the card kept, that does best on the card's own goal wins; with none, the card stays as it is. (Fully optimize
  // cuts the depth and the duct to exact volumes and tunings; Improve rounds its ducts to the quarter inch.)
  const onStep = (x: number, s: SliderSpec) => Math.abs(x / s.step - Math.round(x / s.step)) < 1e-9;
  // a value's tries: your design's own value and a value already on its step and in range stay as they are (only what
  // the search chose is rounded); with no step in range (a locked side off its step), the value stays too
  const nearSteps = (x: number, s: SliderSpec, [lo, hi]: [number, number], own: number) => {
    const inRange = (v: number) =>
      v >= Math.max(lo, s.min) - 1e-9 && v <= Math.min(hi, s.max) + 1e-9;
    if (x === own || (onStep(x, s) && inRange(x))) return [x];
    const below = Math.floor(x / s.step) * s.step;
    const tries = [below - s.step, below, below + s.step, below + 2 * s.step].filter(inRange);
    return tries.length ? tries : [x];
  };
  const SUB_SIDE: Record<keyof Dims3, SliderSpec> = {
    w: PA_SLIDERS.subW,
    h: PA_SLIDERS.subH,
    d: PA_SLIDERS.subD,
  };
  const onSliders = (p: PoolEntry, axis: PaGoal): PoolEntry => {
    const sides = (["w", "h", "d"] as const).map((k) =>
      nearSteps(p.c.cDim[k], SUB_SIDE[k], sr[k], cur.cDim[k]),
    );
    // the duct slider runs on to a bottom slot's longest fold (lengths in the gap between straight and folded fail its
    // duct-fit chip, so no try lands there)
    const lenMax = ductLenSliderMax(
      p.c.cDim,
      p.c.portStyle,
      p.c.cVent,
      p.c.wall,
      byIdOrThrow(SUB_OPTIONS, p.c.sub, CATALOG_TABLE_NAMES.subs),
    );
    const lens = nearSteps(
      p.c.cVent.len,
      { ...PA_SLIDERS.ductLen, max: lenMax },
      [PA_SLIDERS.ductLen.min, lenMax],
      cur.cVent.len,
    );
    if (sides.every((o) => o.length === 1) && lens.length === 1) return p;
    // a try may fail only what the card already fails (the near miss names its blockers from these)
    const had = new Set(designProblemList(p.m, lim).map((x) => x.id));
    const kept = goals.filter((g) => goalGap(g, p.m) === 0);
    let best: PoolEntry | null = null;
    for (const w of sides[0])
      for (const h of sides[1])
        for (const d of sides[2])
          for (const len of lens) {
            const c = { ...p.c, cDim: { w, h, d }, cVent: { ...p.c.cVent, len } },
              m = evaluateDesign(c);
            evals++;
            if (!m || designProblemList(m, lim).some((x) => !had.has(x.id))) continue;
            if (kept.some((g) => goalGap(g, m) > 0)) continue;
            const q = { c, m, ch: changes(c) };
            if (!best || obj[axis](metric(q)) < obj[axis](metric(best))) best = q;
          }
    return best ?? p;
  };
  const axisOf = (k: PlannedCard) => (k.slot.kind === "alt" ? k.slot.axis : goal);

  const choose0 = choose;
  const chooseAmps = (L: ProblemLimits, tgt: number) => {
    const res = choose0(L, tgt);
    if (!res) return res;
    const cs = res.cards.map((k) => ({ ...k, p: onSliders(k.p, axisOf(k)) }));
    // output-first cards keep all the output they found; the others come down to the target
    const keepOut = (k: PlannedCard) =>
      (goals.some((g) => ["louder", "lower"].includes(g)) && k === cs[0]) ||
      (k.slot.kind === "alt" && (k.slot.axis === "louder" || k.slot.axis === "lower")) ||
      k.slot.kind === "smallest";
    return {
      ...res,
      cards: cs.map((k) => ({
        ...k,
        p: shrinkAmps(k.p, keepOut(k) ? k.p.m.out : Math.min(k.p.m.out, tgt)),
      })),
    };
  };

  const chosen = chooseAmps(lim, target),
    cards = chosen ? chosen.cards : null;
  let nearMiss: PaNearMiss | null = null;
  const GOAL_MISSING: Record<PaGoal, string> = {
    cheaper: "Nothing cheaper than your design passes the checks.",
    lighter: "Nothing lighter than your design passes the checks.",
    lower: "Nothing goes lower than your design and keeps the output.",
    louder: "Nothing louder than your design passes the checks.",
  };
  // the notice when the first card is only the closest: what the goals keep that nothing passing reaches
  const outOfReach = (m: Pick<Score, "out" | "f3">) =>
    outOfReachNotice(
      goals.map((g) => keep[g]),
      { db: m.out, f3: m.f3 },
      PA_REACH_WORDS,
    );
  // no card, or only the closest: what loosening a limit would buy
  if (!cards || (chosen && chosen.fixMisses)) {
    const tries = [
      {
        text: `Allow ${Math.ceil(input.maxLb * 1.1)} lb`,
        set: { maxLb: Math.ceil(input.maxLb * 1.1) },
        L: { ...lim, maxLb: Math.ceil(input.maxLb * 1.1) },
        t: target,
      },
      {
        text: `Budget +$${Math.ceil(input.budget * 0.1)}`,
        set: { budget: input.budget + Math.ceil(input.budget * 0.1) },
        L: { ...lim, budget: budget + Math.ceil(input.budget * 0.1) },
        t: target,
      },
    ];
    const worked = tries.filter((x) => {
      const r = choose(x.L, x.t);
      return r && !r.fixMisses;
    });
    const nearest = pool
      .slice()
      .sort(
        (a, b) =>
          designProblems(a.m, lim).length - designProblems(b.m, lim).length ||
          obj[goal](metric(a)) - obj[goal](metric(b)),
      )[0];
    const closest = nearest && onSliders(nearest, goal);
    // only when there is no closest design to name (the exact search's lightest box takes a long scan of the grid)
    const lightestLb = () =>
      [
        exact ? exact.lightestSubLb() : null,
        subCands.length ? Math.min(...subCands.map((x) => x.lb)) : null,
      ].reduce<number | null>((a, b) => (a === null ? b : b === null ? a : Math.min(a, b)), null);
    nearMiss = {
      options: worked.map(({ text, set }) => ({ text, set })),
      closest: closest
        ? card(
            closest,
            { label: CARD_LABELS.nearMiss, why: "", slot: { kind: "closest" } },
            curM,
            cur,
            cl,
          )
        : null,
      blocking: closest
        ? designProblems(closest.m, lim).length
          ? designProblems(closest.m, lim)
          : [
              `the closest design reaches ${closest.m.out.toFixed(1)} dB, short of the ${target.toFixed(0)} dB target`,
            ]
        : (() => {
            const lightest = lightestLb();
            return lightest != null
              ? [
                  `nothing inside the limits reaches the target (the lightest working sub box is ${Math.round(lightest)} lb)`,
                ]
              : ["no sub fits these limits and locks"];
          })(),
    };
  }
  report(2 * screenUnits, 2 * screenUnits, true);
  return {
    target,
    need,
    curM: curM && summary(curM),
    curProblems: designProblems(curM, lim),
    cur: curM ? { curve: curM.curve, geom: boxGeometry(cur) } : null,
    cards: cards ? cards.map((k) => card(k.p, k, curM, cur, cl)) : [],
    goals,
    goalMissing:
      chosen && chosen.fixMisses
        ? outOfReach(chosen.cards[0].p.m)
        : chosen && chosen.goalMissing
          ? also.length
            ? `Nothing ${goals.map((g) => THAN[g]).join(" and ")} than your design passes the checks.`
            : GOAL_MISSING[goal]
          : null,
    nearMiss,
    stats: {
      evaluated: evals,
      ms: Date.now() - t0,
      subs: subCands.length,
      combos: combos.length,
      pool: pool.length,
    },
  };
}

const summary = (m: PaEvaluation): PaMetricsSummary => ({
  price: m.price,
  heaviest: m.heaviest,
  out: m.out,
  spl45: m.spl45,
  subBass: m.subBass,
  f3: m.f3,
  Fb: m.Fb,
  who: m.who,
});

// what the card's front-view drawing needs
export function boxGeometry(c: PaDesignConfig): PaBoxGeometry {
  const sub = byId(SUB_OPTIONS, c.sub),
    mid = byId(MID_OPTIONS, c.mid),
    horn = byId(HORN_OPTIONS, c.horn);
  return {
    sub: c.cDim,
    mid: c.layout === "tower" ? { w: c.cDim.w, h: 15.5, d: c.cDim.d } : c.mDim,
    tower: c.layout === "tower",
    horn: horn && horn.size ? { w: horn.size.w, h: horn.size.h } : null,
    subSize: sub ? sub.size : 18,
    midSize: mid ? mid.size : 12,
    portStyle: c.portStyle,
    cVent: c.cVent,
    wall: c.wall,
  };
}

function card(
  p: PoolEntry,
  role: Pick<PaOptimizerCard, "label" | "why" | "slot">,
  curM: PaEvaluation | null,
  cur: PaDesignConfig,
  cl: CutlistSettings,
): PaOptimizerCard {
  const { c, m } = p;
  const sub = byIdOrThrow(SUB_OPTIONS, c.sub, CATALOG_TABLE_NAMES.subs),
    mid = byIdOrThrow(MID_OPTIONS, c.mid, CATALOG_TABLE_NAMES.mids),
    cd = byIdOrThrow(CD_OPTIONS, c.cd, CATALOG_TABLE_NAMES.compressionDrivers),
    horn = byIdOrThrow(HORN_OPTIONS, c.horn, CATALOG_TABLE_NAMES.horns);
  const midDims = c.layout === "tower" ? { w: c.cDim.w, h: 15.5, d: c.cDim.d } : c.mDim;
  const { parts } = cutParts({
    sub,
    mid,
    subBox: c.cDim,
    midDims,
    wall: c.wall,
    inset: c.inset,
    joint: cl.joint,
    portStyle: c.portStyle,
    cVent: c.cVent,
    layout: c.layout,
  });
  // the quick packing only: the card asks the worker for the exact count afterwards (build.parts and build.cutlist)
  const sheets = layoutCutlist(parts, cl, { countsOnly: true }).groups.map((g) => ({
    t: g.t,
    n: g.sheets.length,
  }));
  const changed: ChangeName[] = [];
  if (c.sub !== cur.sub) changed.push(CHANGE_NAMES.subDriver);
  if (c.cDim.w !== cur.cDim.w || c.cDim.h !== cur.cDim.h || c.cDim.d !== cur.cDim.d)
    changed.push(CHANGE_NAMES.subBox);
  if (c.portStyle !== cur.portStyle || c.cVent.len !== cur.cVent.len)
    changed.push(CHANGE_NAMES.vent);
  if (c.wall !== cur.wall) changed.push(CHANGE_NAMES.plywood);
  if (c.mid !== cur.mid) changed.push(CHANGE_NAMES.midDriver);
  if (c.mDim.w !== cur.mDim.w || c.mDim.h !== cur.mDim.h || c.mDim.d !== cur.mDim.d)
    changed.push(CHANGE_NAMES.midBox);
  if (c.cd !== cur.cd || c.horn !== cur.horn) changed.push(CHANGE_NAMES.hf);
  if (c.hpf !== cur.hpf) changed.push(CHANGE_NAMES.highpass);
  if (c.xoLo !== cur.xoLo || c.xoHi !== cur.xoHi) changed.push(CHANGE_NAMES.crossovers);
  if (c.ampW !== cur.ampW || c.mAmpW !== cur.mAmpW || c.hfAmpW !== cur.hfAmpW)
    changed.push(CHANGE_NAMES.ampPower);
  return {
    label: role.label,
    why: role.why,
    slot: role.slot,
    config: c,
    metrics: summary(m),
    delta: curM
      ? {
          price: m.price - curM.price,
          heaviest: m.heaviest - curM.heaviest,
          out: m.out - curM.out,
          subBass: m.subBass - curM.subBass,
          f3: m.f3 - curM.f3,
        }
      : null,
    names: { sub: sub.name, mid: mid.name, cd: cd.name, horn: horn.name },
    vent: m.port.desc,
    limitedBy: SUB_LIMITED_BY[m.who],
    warnings: [...m.chips.sub, ...m.chips.mid, ...m.chips.horn].filter(([k]) => k !== "ok"),
    build: { qtc: m.qtc, sheets, parts, cutlist: cl },
    changed,
    priceKnown: m.priceKnown,
    curve: m.curve,
    geom: boxGeometry(c),
  };
}
