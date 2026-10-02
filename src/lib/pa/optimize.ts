// Design optimizer: finds three buildable systems that beat the current design on a goal, inside the
// user's limits and locks. Pure (no DOM); runs in a Web Worker or on the main thread.
//
// Search, coarse to exact (docs/optimizer-plan.md):
//   1. screen sub driver x net volume x tuning x highpass with an ideal vent (coarse model grid)
//   2. build real boxes for the best seeds: dimensions inside the limits, each vent style and size,
//      duct length solved for the tuning; keep the smallest vent that doesn't limit
//   3. mid designs per driver at a few Qtc targets, crossover options, horn pairs; combine with the subs
//   4. evaluate the finalists with the planner's own functions and pick three different cards
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
  midWeightLb,
  boxInternalLiters,
  cutParts,
  packSheets,
  PLYWOOD_SHEETS,
  nearestPoint,
  subMusicOutputAt,
  linkwitzRiley24Lowpass,
  pistonBeamWidthDeg,
  keeleFrequency,
  maxOutputCurve,
  STUFFING_VOLUME_GAIN,
} from "./calc";
import {
  subChips,
  midChips,
  hornChips,
  ductFit,
  subDriverClearanceNeededIn,
  driverClearance,
} from "./chips";
import { SUB_OPTIONS, MID_OPTIONS, CD_OPTIONS, HORN_OPTIONS } from "../data";
import type {
  CompressionDriver,
  CutPart,
  Dims3,
  DimensionLockMode,
  Horn,
  HornHf,
  MidDriver,
  PaBoxGeometry,
  PaDesignConfig,
  PaEvaluation,
  PaGoal,
  PaMaxPoint,
  PaMetricsSummary,
  PaNearMiss,
  PaOptimizedField,
  PaOptimizedFields,
  PaOptimizerCard,
  PaOptimizerInput,
  PaOptimizerLocks,
  PaOptimizerResult,
  PaRoom,
  PortStyle,
  SubDriver,
  SubLimitWho,
  SubLimits,
  SubSystemModelled,
  VentedBoxModel,
  VentSpec,
} from "../../types";
import { keysOf } from "../records";

const byId = <T extends { id: string }>(list: readonly T[], id: string) =>
  list.find((o) => o.id === id);
const r2 = (x: number, q = 0.5) => Math.round(x / q) * q;

/** The limits a design is checked against: the heaviest box, the driver budget and the warnings let through. */
interface ProblemLimits {
  maxLb: number;
  budget: number;
  allow?: Set<string>;
}
/** The numbers the goals rank by. */
interface Score {
  price: number;
  heaviest: number;
  out: number;
  f3: number;
}
/** A score plus how many things differ from the current design and how many warnings it has (`w`, once evaluated). */
interface Metric extends Score {
  ch: number;
  w?: number;
}
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
/** A mid driver in a box at one crossover, with its limit curve. */
interface MidEntry {
  m: MidDriver;
  bx: Dims3;
  t: number;
  xoLo: number;
  atXo: number;
  max: PaMaxPoint[];
  qtc: number;
  lb: number;
}
/** A compression driver on a horn, with its level at the crossover. */
interface HornEntry {
  cd: CompressionDriver;
  h: Horn;
  at: number;
  price: number;
  horn: number;
  same: boolean;
}
/** A whole design the combine step offers for evaluation. */
interface Combo extends Score {
  c: PaDesignConfig;
  ch: number;
}
/** An evaluated design. */
interface PoolEntry {
  c: PaDesignConfig;
  m: PaEvaluation;
  ch: number;
}
interface PlannedCard {
  p: PoolEntry;
  label: string;
  why: string;
}
/** The locks with both box-dimension modes present. */
interface ResolvedLocks extends PaOptimizerLocks {
  subDim: Partial<Record<keyof Dims3, DimensionLockMode>>;
  midDim: Partial<Record<keyof Dims3, DimensionLockMode>>;
}
type AmpKey = "ampW" | "mAmpW" | "hfAmpW";

// Slider ranges in the planner, used when a dimension is free.
export const SUB_BOX_RANGE: Record<keyof Dims3, [number, number]> = {
  w: [18, 40],
  h: [18, 42],
  d: [14, 32],
};
export const MID_BOX_RANGE: Record<keyof Dims3, [number, number]> = {
  w: [10, 24],
  h: [10, 24],
  d: [8, 24],
};
const rangeOf = (
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
  outdoor: { d: 10, gain: 0, name: "Outdoors", short: "Outdoors" },
};
export const roomRequiredSpl = (room: PaRoom) => {
  const r = ROOMS[room] || ROOMS[1000];
  return 105 + 20 * Math.log10(r.d) - 6 - r.gain;
};

export const OPTIMIZER_GOALS: Record<PaGoal, { short: string; name: string; why: string }> = {
  cheaper: {
    short: "Cheaper",
    name: "Same output, cheaper",
    why: "Cheapest drivers that still reach the target.",
  },
  lighter: {
    short: "Lighter",
    name: "Same output, lighter",
    why: "Lightest boxes that still reach the target.",
  },
  lower: { short: "Lower", name: "Go lower", why: "Lowest F3 that keeps the target output." },
  louder: { short: "Louder", name: "Louder", why: "Most output inside your limits." },
};
const ALT_LABEL: Record<PaGoal, string> = {
  cheaper: "Cheaper",
  lighter: "Lighter",
  lower: "Goes lower",
  louder: "Louder",
};
const ALT_ORDER: Record<PaGoal, PaGoal[]> = {
  cheaper: ["lighter", "louder"],
  lighter: ["cheaper", "louder"],
  lower: ["louder", "cheaper"],
  louder: ["cheaper", "lighter"],
};

// Vent sizes per style, smallest area first.
const TUBES = [
  [1, 3],
  [1, 4],
  [2, 3],
  [2, 3.5],
  [1, 5],
  [2, 4],
  [3, 4],
  [2, 5],
  [4, 4],
  [2, 6],
  [3, 5],
  [4, 5],
  [3, 6],
  [4, 6],
];
// "round1" and "round4" are the one-tube and four-corner-tube layouts (the geometry treats every round style alike, from `nt` and
// `dia`), so they take the tubes of that count; "round2" tries every tube count, as it always has.
const tubesOf = (count?: number) =>
  TUBES.filter(([nt]) => count === undefined || nt === count).map(([nt, dia]) => ({ nt, dia }));
const VENT_SIZES: Record<PortStyle, Partial<VentSpec>[]> = {
  round1: tubesOf(1),
  round2: tubesOf(),
  round4: tubesOf(4),
  slots: [2, 2.5, 3, 3.5, 4, 4.5, 5, 6].map((slotH) => ({ slotH })),
  folded: [2, 2.5, 3, 3.5, 4, 4.5, 5].map((slotH) => ({ slotH })),
  vslots: [1, 1.25, 1.5, 1.75, 2, 2.5, 3].map((throat) => ({ throat })),
  vslot1: [1.5, 2, 2.5, 3, 3.5, 4, 5].map((throat) => ({ throat })),
};
/** The vent sizes the search tries for a style, smallest area first. */
export const ventSizesFor = (style: PortStyle) => VENT_SIZES[style];

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

// ---- the planner's evaluation of a whole config (same functions, same order as the page) ----
export function evaluateDesign(c: PaDesignConfig): PaEvaluation | null {
  const sub = byId(SUB_OPTIONS, c.sub),
    mid = byId(MID_OPTIONS, c.mid),
    cd = byId(CD_OPTIONS, c.cd),
    horn = byId(HORN_OPTIONS, c.horn);
  if (!sub || !sub.ts || !mid || !mid.ts || !cd || !horn) return null;
  const midDims = c.layout === "tower" ? { w: c.cDim.w, h: 15.5, d: c.cDim.d } : c.mDim;
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
    mAmpW: c.mAmpW,
  });
  const subLb = subWeightLb(c.cDim, c.wall, sub.lb),
    midLb = midWeightLb(midDims, c.wall) + (mid.lb || 0);
  if (!s.mdl || !ms.mdl) return null; // a vent or box with no geometry has no model to evaluate
  const subMusic = subMusicOutputAt(s.mdl, s.lim, s.AMP_V, c.xoLo);
  const hz: Partial<HornHf> = horn.hf || {};
  const hornModel = hornResponse(cd.hf, hz, c.xoHi, c.hfAmpW);
  const mm = ms.mdl,
    midAtXo = nearestPoint(ms.max, c.xoLo),
    midAtHi = nearestPoint(ms.max, c.xoHi).spl;
  const hornAtXo = hornModel ? nearestPoint(hornModel.curve, c.xoHi).spl : null;
  const chips = {
    sub: subChips({
      subSize: sub.size,
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
      midSize: mid.size || 12,
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
const SOFT_OK = new Set([
  "Over 125 lb",
  "Amp-limited",
  "Excursion-limited",
  "Thermally limited",
  "Horn wider than rated at the crossover",
  "Mid narrower than the horn at the crossover",
  "Mid much wider than the horn at the crossover",
]);
export function designProblems(m: PaEvaluation | null, lim: ProblemLimits) {
  const out: string[] = [];
  if (!m) return ["can't be modelled"];
  for (const k of ["sub", "mid", "horn"] as const)
    for (const [kind, head] of m.chips[k]) {
      if (
        kind === "bad" ||
        (kind === "warn" &&
          !SOFT_OK.has(head) &&
          !head.startsWith("Qtc") &&
          !(lim.allow && lim.allow.has(head)))
      )
        out.push(head);
    }
  if (m.qtc < 0.5 || m.qtc > 0.8) out.push(`mid Qtc ${m.qtc.toFixed(2)}`);
  if (m.mismatch) out.push("horn and driver exits differ");
  if (m.heaviest > lim.maxLb + 1e-9) out.push(`${m.heaviest.toFixed(0)} lb box`);
  if (m.price > lim.budget + 1e-9) out.push(`drivers $${Math.round(m.price)} per stack`);
  return out;
}

// ---- search ----
// input: { cur (the planner's snapshot), room, maxLb, budget (drivers per stack), goals, locks }
// goals: one or more of GOALS, in tap order. The first ranks the designs; the main card must also beat your
// design on every other one (e.g. ["cheaper", "lighter"]: the cheapest design that's also lighter). `goal` alone still works.
// locks: { sub, mid, cd, horn, vent, wall, hpf, xoLo, xoHi, ampW, mAmpW, hfAmpW, subDim: {w,h,d}, midDim: {w,h,d} }
// (dims: "free"|"max"|"exact"; an unlocked amp is searched up to AMP_MAX)
// The fields a result sets; everything else (finish, colours, layout, balance) stays as the page has it.
// the planner's amp sliders top out here; an unlocked amp is searched up to these
export const AMP_WATTS_MAX = { ampW: 3000, mAmpW: 2000, hfAmpW: 500 };
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

export function optimizePaStack(input: PaOptimizerInput): PaOptimizerResult {
  const t0 = Date.now();
  const { room = 1000 } = input;
  const goals = (
    input.goals && input.goals.length ? input.goals : [input.goal || "cheaper"]
  ).filter((g, i, a) => OPTIMIZER_GOALS[g] && a.indexOf(g) === i);
  const goal = goals[0],
    also = goals.slice(1);
  // older saved configs can lack some fields; the page always has them, with these defaults
  const cur: PaDesignConfig = {
    xoLo: 120,
    xoHi: 900,
    tilt: 6,
    hfTilt: 6,
    ampW: 800,
    mAmpW: 400,
    hfAmpW: 100,
    hpType: "BW24",
    portMax: 20,
    wall: 0.75,
    inset: 0.75,
    layout: "stack",
    ...input.cur,
  };
  const locks: ResolvedLocks = { subDim: {}, midDim: {}, ...(input.locks || {}) };
  const budget = input.budget; // drivers per stack
  const lim: Required<ProblemLimits> = { maxLb: input.maxLb, budget, allow: new Set<string>() };
  // Unlocked amps are searched at the top of their slider (so the drivers, not the amp, set the limit), then every
  // card comes back at the least power that keeps its output and keeps each band up with the one below.
  const amps = {
    ampW: locks.ampW ? cur.ampW : AMP_WATTS_MAX.ampW,
    mAmpW: locks.mAmpW ? cur.mAmpW : AMP_WATTS_MAX.mAmpW,
    hfAmpW: locks.hfAmpW ? cur.hfAmpW : AMP_WATTS_MAX.hfAmpW,
  };
  const base = { ...cur, ...amps };
  const curM = evaluateDesign(cur);
  // horn loading is fixable by the horn, the driver or the crossover; only when all three are locked and the
  // current design already has the warning is it allowed through
  const hornLoadOk = !!(
    locks.horn &&
    locks.cd &&
    locks.xoHi &&
    curM &&
    curM.chips.horn.some(([, h]) => h === "Horn stops loading near the crossover")
  );
  if (hornLoadOk) lim.allow.add("Horn stops loading near the crossover");
  const need = roomRequiredSpl(room);
  const target = Math.max(curM ? curM.out : need, need);
  const curF3 = curM ? curM.f3 : 40;
  let evals = 0;

  // candidate lists
  const curSub = byId(SUB_OPTIONS, cur.sub),
    curMid = byId(MID_OPTIONS, cur.mid);
  const priced = (o: { ts: object; price: number | null }) => o.ts && o.price != null;
  const subs = locks.sub
    ? [curSub!]
    : SUB_OPTIONS.filter(
        (o) => o.size === (curSub ? curSub.size : 18) && priced(o) && o.price <= budget,
      );
  const walls = locks.wall ? [cur.wall] : [0.75, 0.5];
  const styles: PortStyle[] = locks.vent ? [cur.portStyle] : ["slots", "vslots", "round2"];
  const xoLos = locks.xoLo ? [cur.xoLo] : [90, 100, 110, 120, 140];
  const xoHis = locks.xoHi ? [cur.xoHi] : [800, 900, 1000, 1200, 1500];
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
  for (const sub of subs)
    for (const V of vols)
      for (const Fb of fbs) {
        const hps = locks.hpf
          ? [cur.hpf]
          : [Math.max(20, Math.round(Fb * 0.85)), Math.max(20, Math.round(Fb))];
        for (const hpf of hps) {
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
  const midForGeom = (curMid || MID_OPTIONS.find((o) => o.ts))!;
  for (const sd of seedSet) {
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
            const hi = ductFit(box, style, mk(size, 0), t).fit,
              lo = 2;
            if (hi < lo + 0.25) continue;
            const fbShort = geom(mk(size, lo)).Fb,
              fbLong = geom(mk(size, hi)).Fb;
            if (sd.Fb > fbShort) continue; // vent too small to tune this high: next size
            if (sd.Fb < fbLong) break; // too big for the room it has: bigger won't fit either
            let a = lo,
              b = hi;
            for (let i = 0; i < 12; i++) {
              const m = (a + b) / 2;
              if (geom(mk(size, m)).Fb > sd.Fb) a = m;
              else b = m;
            }
            const cVent = mk(size, Math.min(Math.floor(hi * 4) / 4, r2((a + b) / 2, 0.25))); // never past the fit
            const { clearW, clearH } = driverClearance(box, style, cVent, t);
            if (Math.min(clearW, clearH) < subDriverClearanceNeededIn(sd.sub.size)) continue;
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
            const portOk = s.lim.who !== "port air speed" && s.lim.vel <= 0.9 * cur.portMax;
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
              Math.pow((fallback.s.AMP_V * (0.9 * cur.portMax)) / fallback.s.mdl.peakVel, 2) / 8;
            const ampW = Math.floor(vW / 50) * 50;
            if (ampW >= 200) {
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
              if (s.mdl && s.lim.who !== "port air speed")
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
    ? [curMid!]
    : MID_OPTIONS.filter((o) => (o.size || 12) >= 12 && priced(o) && o.price! <= budget);
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
      need = (m.size || 12) + 1.2;
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
  const midTable: MidEntry[] = []; // { m, bx, t, xoLo, atXo, curve (no lowpass), qtc, f3, lb }
  for (const m of mids)
    for (const t of walls)
      for (const bx of midBoxes(m, t)) {
        if (!bx) continue;
        const disp = m.ts.disp != null ? m.ts.disp : m.size === 15 ? 4 : 2.5;
        const eff =
          Math.max(5, boxInternalLiters(bx.w, bx.h, bx.d, t, cur.inset) - disp) *
          STUFFING_VOLUME_GAIN;
        for (const xoLo of xoLos) {
          const V = ampVoltage(amps.mAmpW),
            mdl = closedBox(m.ts, eff, xoLo, null, V, { N: 120 });
          evals++;
          if (!mdl || mdl.Qtc < 0.5 || mdl.Qtc > 0.8 || mdl.f3 > xoLo) continue;
          const max = maxOutputCurve(mdl.curve, m.ts, V, Infinity);
          midTable.push({
            m,
            bx,
            t,
            xoLo,
            atXo: nearestPoint(max, xoLo).spl,
            max,
            qtc: mdl.Qtc,
            lb: midWeightLb(bx, t) + (m.lb || 0),
          });
        }
      }
  // horn pairs per xoHi, with their level at the crossover
  const cds = locks.cd
    ? [byId(CD_OPTIONS, cur.cd)!]
    : CD_OPTIONS.filter((o) => o.hf && o.hf.sens != null && o.price != null);
  const horns = locks.horn
    ? [byId(HORN_OPTIONS, cur.horn)!]
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
        const hm = hornResponse(cd.hf, hz, xoHi, amps.hfAmpW);
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
    // `same` is a boolean and true - false is 1; the casts only tell the checker so
    hornTable[xoHi].sort(
      (a, b) =>
        (b.same as unknown as number) - (a.same as unknown as number) ||
        a.price - b.price ||
        a.horn - b.horn,
    );
  }

  // combine: for each sub and crossover pair, the mid and horn that keep up, best for each objective
  const changes = (c: PaDesignConfig) =>
    (["sub", "mid", "cd", "horn", "portStyle", "wall"] as const).filter((k) => c[k] !== cur[k])
      .length;
  const combos: Combo[] = [];
  const slack = { budget: budget * 1.25, lb: input.maxLb * 1.25 };
  for (const sc of subCands) {
    if (sc.lb > slack.lb || sc.sub.price > slack.budget) continue;
    for (const xoLo of xoLos) {
      const need = subMusicOutputAt(sc.s.mdl, sc.s.lim, sc.s.AMP_V, xoLo) - cur.tilt;
      const okMids: (MidEntry | null)[] = midTable.filter(
        (e) => e.xoLo === xoLo && e.t === sc.c.wall && e.atXo - need >= -0.5 && e.lb <= slack.lb,
      );
      if (cur.layout === "tower") okMids.push(null);
      const choices: (MidEntry | null)[] = [];
      // the casts: filter drops the null the tower layout adds, which the checker can't see
      const byPrice = (okMids.filter(Boolean) as MidEntry[]).sort(
        (a, b) => a.m.price! - b.m.price! || a.lb - b.lb,
      )[0];
      const byLb = (okMids.filter(Boolean) as MidEntry[]).sort(
        (a, b) => a.lb - b.lb || a.m.price! - b.m.price!,
      )[0];
      const same = (okMids.filter((e) => e && e.m.id === cur.mid) as MidEntry[]).sort(
        (a, b) => a.lb - b.lb,
      )[0];
      for (const e of [byPrice, byLb, same]) if (e && !choices.includes(e)) choices.push(e);
      if (cur.layout === "tower") choices.push(null);
      for (const e of choices)
        for (const xoHi of xoHis) {
          const midHi = e
            ? nearestPoint(e.max, xoHi).spl + 20 * Math.log10(linkwitzRiley24Lowpass(xoHi, xoHi))
            : null;
          const hp = hornTable[xoHi].find(
            (p) => midHi == null || p.at - (midHi - cur.hfTilt) >= -0.5,
          );
          if (!hp) continue;
          const c = {
            ...sc.c,
            xoLo,
            xoHi,
            mid: e ? e.m.id : cur.mid,
            mDim: e ? e.bx : cur.mDim,
            cd: hp.cd.id,
            horn: hp.h.id,
          };
          const price = sc.sub.price + (e ? e.m.price! : curMid!.price || 0) + hp.price;
          const heaviest = Math.max(sc.lb, e ? e.lb : 0);
          combos.push({ c, price, heaviest, out: sc.out, f3: sc.s.mdl.f3, ch: changes(c) });
        }
    }
  }

  // 4. exact evaluation of the best combos for each objective
  // objective per goal; small nudges toward fewer changes and fewer warnings (w)
  const obj: Record<PaGoal, (x: Metric) => number> = {
    cheaper: (x) => x.price + 5 * x.ch + 25 * (x.w || 0),
    lighter: (x) => x.heaviest + 0.5 * x.ch + 2 * (x.w || 0),
    lower: (x) => x.f3 + 0.1 * x.ch + 0.7 * (x.w || 0),
    louder: (x) => -x.out + 0.05 * x.ch + 0.5 * (x.w || 0),
  };
  const goalOk: Record<PaGoal, (x: Score) => boolean> = {
    cheaper: (x) => x.out >= target - 0.5 && x.f3 <= curF3 + 2,
    lighter: (x) => x.out >= target - 0.5 && x.f3 <= curF3 + 2,
    lower: (x) => x.out >= target - 1.5,
    louder: (x) => x.f3 <= curF3 + 3,
  };
  // an alternative has to beat the first card on its own axis by a margin that matters
  const beats: Record<PaGoal, (x: Score, y: Score) => boolean> = {
    cheaper: (x, y) => x.price < y.price,
    lighter: (x, y) => x.heaviest <= y.heaviest - 3,
    lower: (x, y) => x.f3 <= y.f3 - 2,
    louder: (x, y) => x.out >= y.out + 1,
  };
  const finalists = new Map<string, Combo>();
  const inLimits = (x: Score) => x.price <= budget + 1e-9 && x.heaviest <= input.maxLb + 1e-9;
  const add = (list: Combo[], n: number) =>
    list.slice(0, n).forEach((x) => finalists.set(JSON.stringify(x.c), x));
  for (const g of keysOf(obj)) {
    const ranked = combos.filter(goalOk[g]).sort((a, b) => obj[g](a) - obj[g](b));
    add(ranked.filter(inLimits), 14); // candidates for the cards
    add(ranked, 4); // and a few just outside the limits, for the near-miss message
  }
  if (also.length && curM) {
    const cm = { price: curM.price, heaviest: curM.heaviest, out: curM.out, f3: curM.f3 };
    const ranked = combos
      .filter((x) => goals.every((g) => goalOk[g](x)) && also.every((g) => beats[g](x, cm)))
      .sort((a, b) => obj[goal](a) - obj[goal](b));
    add(ranked.filter(inLimits), 14);
    add(ranked, 4);
  }
  const pool: PoolEntry[] = [];
  for (const x of finalists.values()) {
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
          ([kind, head]) => kind === "warn" && !/limited$/.test(head) && head !== "Over 125 lb",
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
  const choose = (L: ProblemLimits, tgt: number) => {
    const ok = pool.filter((p) => designProblems(p.m, L).length === 0);
    const meets = (p: PoolEntry) =>
      goals.every((g) => goalOk[g]({ ...metric(p), out: p.m.out + (target - tgt) }));
    const beatsAll = (p: PoolEntry) => goals.every((g) => trueVsCur(g, p));
    const cards: PlannedCard[] = [];
    const first = ok
      .filter((p) => meets(p) && beatsAll(p))
      .sort((a, b) => obj[goal](metric(a)) - obj[goal](metric(b)))[0];
    if (first) cards.push({ p: first, label: goalLabel, why: goalWhy });
    // your design fails a check: the goal's best design that passes, labelled as a fix (it may cost or weigh more)
    else if (curFails) {
      const fix = ok.filter(meets).sort((a, b) => obj[goal](metric(a)) - obj[goal](metric(b)))[0];
      if (fix) cards.push({ p: fix, label: "Fixes your design", why: FIX_WHY[goal] });
    }
    const vol = (c: PaDesignConfig) => c.cDim.w * c.cDim.h * c.cDim.d;
    const differs = (p: PoolEntry) =>
      cards.every(
        (k) =>
          k.p.c.sub !== p.c.sub ||
          k.p.c.portStyle !== p.c.portStyle ||
          k.p.c.mid !== p.c.mid ||
          k.p.c.wall !== p.c.wall ||
          Math.abs(vol(p.c) / vol(k.p.c) - 1) >= 0.15,
      );
    // the smallest change that already beats your design on the goal (e.g. the same boxes on 1/2" ply)
    if (curMet) {
      const small = ok
        .filter((p) => p.ch <= 1 && differs(p) && meets(p) && beatsAll(p))
        .sort((a, b) => obj[goal](metric(a)) - obj[goal](metric(b)))[0];
      if (small)
        cards.push({
          p: small,
          label: "Smallest change",
          why: "Changes one thing from your design.",
        });
    }
    // stacked goals: single-goal options first, so you can see what dropping the others buys
    const axes = [...(also.length ? goals : []), ...ALT_ORDER[goal], ...keysOf(ALT_LABEL)].filter(
      (a, i, arr) => arr.indexOf(a) === i && (also.length || a !== goal),
    );
    for (const alt of axes) {
      if (cards.length >= 3) break;
      const q = ok
        .filter(
          (p) =>
            differs(p) &&
            p.m.out >= tgt - 1.5 &&
            trueVsCur(alt, p) &&
            (!first || beats[alt](metric(p), metric(first))),
        )
        .sort((a, b) => obj[alt](metric(a)) - obj[alt](metric(b)))[0];
      if (q)
        cards.push({
          p: q,
          label: ALT_LABEL[alt],
          why: {
            louder: "More output than your design.",
            lower: "Goes lower than your design.",
            cheaper: "Costs less than your design, close to the target.",
            lighter: "Lighter than your design, close to the target.",
          }[alt],
        });
    }
    return cards.length ? { cards, goalMissing: !first && !curFails } : null;
  };

  // Unlocked amps: the least power per channel (in the sliders' steps) that still reaches the target and keeps
  // each band up with the one below it. Sub first (a quieter sub asks less of the mid), then mid, then HF.
  const shrinkAmps = (p: PoolEntry, tgtOut: number): PoolEntry => {
    let c = { ...p.c },
      m = p.m;
    const ok = (cc: PaDesignConfig, mm: PaEvaluation | null) =>
      mm && designProblems(mm, lim).length === 0;
    const lowest = (key: AmpKey, lo: number, step: number, good: (m: PaEvaluation) => boolean) => {
      if (locks[key] || c[key] <= lo) return;
      const floor = { ...c, [key]: lo },
        fm = evaluateDesign(floor);
      evals++;
      if (ok(floor, fm) && good(fm!)) {
        c = floor;
        m = fm!;
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
        if (ok(cc, mm) && good(mm!)) b = mid;
        else a = mid;
      }
      const cc = { ...c, [key]: b },
        mm = evaluateDesign(cc);
      evals++;
      if (ok(cc, mm) && good(mm!)) {
        c = cc;
        m = mm!;
      }
    };
    lowest("ampW", 200, 50, (mm) => mm.out >= tgtOut - 0.01);
    lowest("mAmpW", 50, 25, (mm) => mm.midGap >= 0);
    lowest("hfAmpW", 10, 5, (mm) => mm.hornGap == null || mm.hornGap >= 0);
    return { ...p, c, m };
  };
  const choose0 = choose;
  const chooseAmps = (L: ProblemLimits, tgt: number) => {
    const res = choose0(L, tgt);
    if (!res) return res;
    const cs = res.cards;
    // output-first cards keep all the output they found; the others come down to the target
    const keepOut = (k: PlannedCard) =>
      (goals.some((g) => ["louder", "lower"].includes(g)) && k === cs[0]) ||
      k.label === ALT_LABEL.louder ||
      k.label === ALT_LABEL.lower ||
      k.label === "Smallest change";
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
  if (!cards) {
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
    const worked = tries.filter((x) => choose(x.L, x.t));
    const closest = pool
      .slice()
      .sort(
        (a, b) =>
          designProblems(a.m, lim).length - designProblems(b.m, lim).length ||
          obj[goal](metric(a)) - obj[goal](metric(b)),
      )[0];
    const lightest = subCands.length ? Math.min(...subCands.map((x) => x.lb)) : null;
    nearMiss = {
      options: worked.map(({ text, set }) => ({ text, set })),
      closest: closest ? card(closest, "Closest", "", curM, cur) : null,
      blocking: closest
        ? designProblems(closest.m, lim).length
          ? designProblems(closest.m, lim)
          : [
              `the closest design reaches ${closest.m.out.toFixed(1)} dB, short of the ${target.toFixed(0)} dB target`,
            ]
        : lightest != null
          ? [
              `nothing inside the limits reaches the target (the lightest working sub box is ${Math.round(lightest)} lb)`,
            ]
          : ["no sub fits these limits and locks"],
    };
  }
  return {
    target,
    need,
    curM: curM && summary(curM),
    curProblems: designProblems(curM, lim),
    cur: curM ? { curve: curM.curve, geom: boxGeometry(cur) } : null,
    cards: cards ? cards.map((k) => card(k.p, k.label, k.why, curM, cur)) : [],
    goals,
    goalMissing:
      chosen && chosen.goalMissing
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
  f3: m.f3,
  Fb: m.Fb,
  who: m.who,
});
const WHO: Record<SubLimitWho, string> = {
  "port air speed": "port air speed",
  "cone travel (Xmax)": "cone travel",
  "driver program rating": "the driver's program rating",
  "amplifier power": "amplifier power",
};

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
    midSize: mid ? mid.size || 12 : 12,
    portStyle: c.portStyle,
    cVent: c.cVent,
    wall: c.wall,
  };
}

function card(
  p: PoolEntry,
  label: string,
  why: string,
  curM: PaEvaluation | null,
  cur: PaDesignConfig,
): PaOptimizerCard {
  const { c, m } = p;
  const sub = byId(SUB_OPTIONS, c.sub)!,
    mid = byId(MID_OPTIONS, c.mid)!,
    cd = byId(CD_OPTIONS, c.cd)!,
    horn = byId(HORN_OPTIONS, c.horn)!;
  const midDims = c.layout === "tower" ? { w: c.cDim.w, h: 15.5, d: c.cDim.d } : c.mDim;
  const { parts } = cutParts({
    sub,
    mid,
    subBox: c.cDim,
    midDims,
    wall: c.wall,
    inset: c.inset,
    joint: cur.joint || "butt",
    portStyle: c.portStyle,
    cVent: c.cVent,
    layout: c.layout,
  });
  const byT: Record<string, CutPart[]> = {};
  parts.forEach((q) => {
    for (let i = 0; i < q.qty; i++) (byT[q.t] = byT[q.t] || []).push(q);
  });
  const sheets = Object.keys(byT).map((t) => ({
    t: +t,
    n: packSheets(byT[t], PLYWOOD_SHEETS["4x8"], 0.125).sheets.length,
  }));
  const changed: string[] = [];
  if (c.sub !== cur.sub) changed.push("sub driver");
  if (c.cDim.w !== cur.cDim.w || c.cDim.h !== cur.cDim.h || c.cDim.d !== cur.cDim.d)
    changed.push("sub box");
  if (c.portStyle !== cur.portStyle || c.cVent.len !== cur.cVent.len) changed.push("vent");
  if (c.wall !== cur.wall) changed.push("plywood");
  if (c.mid !== cur.mid) changed.push("mid driver");
  if (c.mDim.w !== cur.mDim.w || c.mDim.h !== cur.mDim.h || c.mDim.d !== cur.mDim.d)
    changed.push("mid box");
  if (c.cd !== cur.cd || c.horn !== cur.horn) changed.push("HF");
  if (c.hpf !== cur.hpf) changed.push("highpass");
  if (c.xoLo !== cur.xoLo || c.xoHi !== cur.xoHi) changed.push("crossovers");
  if (c.ampW !== cur.ampW || c.mAmpW !== cur.mAmpW || c.hfAmpW !== cur.hfAmpW)
    changed.push("amp power");
  return {
    label,
    why,
    config: c,
    metrics: summary(m),
    delta: curM
      ? {
          price: m.price - curM.price,
          heaviest: m.heaviest - curM.heaviest,
          out: m.out - curM.out,
          f3: m.f3 - curM.f3,
        }
      : null,
    names: { sub: sub.name, mid: mid.name, cd: cd.name, horn: horn.name },
    vent: m.port.desc,
    limitedBy: WHO[m.who] || m.who,
    warnings: [...m.chips.sub, ...m.chips.mid, ...m.chips.horn]
      .filter(([k]) => k !== "ok")
      .map(([, h, b]): [string, string] => [h, b]),
    build: { qtc: m.qtc, sheets: sheets.sort((a, b) => b.t - a.t) },
    changed,
    priceKnown: m.priceKnown,
    curve: m.curve,
    geom: boxGeometry(c),
  };
}
