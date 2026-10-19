// The Speaker optimizer's full evaluation: a spec through the page's own code (speakerResponse, speakerLimits,
// cabinetBuild, speakerPrice, speakerBounds, the fit checks), its numbers, and what it fails against your design and
// the limits. Every card and the near miss read these, on the design as the card loads it. Pure.
import type {
  BandId,
  Dims3,
  FrequencyPoint,
  SpeakerLimits,
  SpeakerOptimizerLimits,
  SpeakerOptimizerLocks,
  SpeakerOptimizerMetrics,
  SpeakerResponse,
  SpeakerSpec,
} from "../../../types";
import { speakerResponse, passbandCenterHz, passbandDb } from "../speakerResponse";
import { speakerLimits } from "../speakerLimits";
import {
  cabinetBuild,
  hifiVentFits,
  speakerPurchasedParts,
  type CabinetBuild,
} from "../speakerBuild";
import { purchasedTotal } from "../../cutlistCsv";
import {
  driverAcrossIn,
  driverHorn,
  driverSpots,
  driversOnBaffle,
  hornFitsWhereSet,
  onTop,
  speakerBounds,
} from "../speakerLayout";
import { chamberFitChips } from "../fitChips";
import { keepUpChip, speakerKeepUps } from "../keepUp";
import { KEEP_UP_SLACK_DB } from "../../pa/chips";
import { LITERS_PER_CUBIC_IN } from "../../../constants/units";
import { SPEAKER_PROBLEM } from "../../../constants/speakerOptimizer";
import { PURCHASED_PART } from "../../../constants/purchasedParts";

/** What a design fails, by id (`SPEAKER_PROBLEM`). */
export type SpeakerProblem = (typeof SPEAKER_PROBLEM)[keyof typeof SPEAKER_PROBLEM];

/** The purchased parts cut from stock (a port's pipe and elbows): their price doesn't depend on which design. */
const STOCK_PARTS: ReadonlySet<string> = new Set([
  PURCHASED_PART.portTube,
  PURCHASED_PART.portElbow,
]);

/** How far a fit may miss and still count, in (rounding). */
const FIT_SLACK_IN = 1e-6;
/** How far a box may miss its size lock on an axis (past a "max", either way on an "exact") and still hold it, in (rounding). */
export const SIZE_SLACK_IN = 0.01;
/** The maximum-output curve a card carries: every this many points of the response's grid. */
const CURVE_EVERY = 4;
/** A level, dB, below the passband that sets the F3. */
const F3_DB = 3;

/** What a design must keep to fail nothing new against your design: what is modeled, what fits. */
export interface SpeakerFacts {
  /** the bands the response models */
  bands: ReadonlySet<BandId>;
  /** each chamber: the model runs it with no gap */
  chambers: readonly boolean[];
  /** each chamber's drivers: each fits where it is set */
  drivers: readonly (readonly boolean[])[];
  /** each chamber: its vent fits by the Hi-fi rule (`hifiVentFits`) */
  vents: readonly boolean[];
  /** each chamber: none of its fit chips is bad (`chamberFitChips`) */
  chips: readonly boolean[];
}

/** A design through the page's code: the runs, the numbers, the facts the checks compare, and its warnings. */
export interface SpeakerEval {
  spec: SpeakerSpec;
  response: SpeakerResponse;
  limits: SpeakerLimits;
  build: CabinetBuild;
  metrics: SpeakerOptimizerMetrics;
  facts: SpeakerFacts;
  /** each band that limits first at its crossover (keep-up), in words */
  warnings: string[];
  /** the purchased parts with no price, by model: two prices compare only when these are the same */
  unpriced: string;
}

/**
 * The F3: the lowest frequency where the curve first reaches its passband (`passbandDb`) less F3_DB, Hz, between grid
 * points on a log scale; null for an empty curve.
 */
export function f3Of(curve: readonly FrequencyPoint[]): number | null {
  if (!curve.length) return null;
  const edge = passbandDb(curve) - F3_DB;
  const i = curve.findIndex((o) => o.spl >= edge);
  if (i < 0) return null;
  if (i === 0) return curve[0].f;
  const a = curve[i - 1],
    b = curve[i];
  const t = (edge - a.spl) / (b.spl - a.spl);
  return Math.exp(Math.log(a.f) + t * (Math.log(b.f) - Math.log(a.f)));
}

/** The box's outer size with the horns on its top, in, and its volume, L. */
export function outerSize(spec: Pick<SpeakerSpec, "cabinet">): { sizeIn: Dims3; volumeL: number } {
  const b = speakerBounds(spec.cabinet);
  const sizeIn = { w: b.maxX - b.minX, h: b.maxY, d: b.layout.size.d };
  return { sizeIn, volumeL: sizeIn.w * sizeIn.h * sizeIn.d * LITERS_PER_CUBIC_IN };
}

/** Whether each driver of each chamber fits where it is set: on the baffle inside the clear face, a horn where it sits. */
function driverFits(spec: SpeakerSpec): boolean[][] {
  const { layout } = speakerBounds(spec.cabinet);
  return layout.chambers.map((placed) =>
    placed.chamber.drivers.map((d) => {
      if (!hornFitsWhereSet(placed, d)) return false;
      // a horn's fit is its own rule's (`hornFits`); a cone or a plate must sit inside the clear face
      if (driverHorn(d) || onTop(d) || !driversOnBaffle(placed.chamber)) return true;
      const r = driverAcrossIn(d) / 2;
      const { clear } = placed;
      return driverSpots(placed, d).every(
        (s) =>
          s.xIn - r >= clear.x - FIT_SLACK_IN &&
          s.xIn + r <= clear.x + clear.w + FIT_SLACK_IN &&
          s.yIn - r >= clear.y - FIT_SLACK_IN &&
          s.yIn + r <= clear.y + clear.h + FIT_SLACK_IN,
      );
    }),
  );
}

/** The band's name in the spec (its id when it has none). */
const bandName = (spec: Pick<SpeakerSpec, "bands">, id: BandId | undefined) =>
  spec.bands.find((b) => b.id === id)?.name ?? id ?? "";

/** The bands that limit first at their crossover in the box (keep-up), each as its check's title. */
function keepUpWarnings(spec: SpeakerSpec, response: SpeakerResponse, limits: SpeakerLimits) {
  return speakerKeepUps(spec.bands, response, limits)
    .filter((k) => k.gapDb < -KEEP_UP_SLACK_DB)
    .map(
      (k) =>
        keepUpChip(
          k,
          bandName(spec, response.bands[k.lower]?.id),
          bandName(spec, response.bands[k.upper]?.id),
        )[1],
    );
}

/**
 * The speaker's F3: its lowest band's (the lowest passband) own F3. Not the sum's: a speaker whose bands sit at
 * different levels (the PA music tilt) has its summed passband in its loudest band.
 */
export function speakerF3(response: Pick<SpeakerResponse, "bands">): number | null {
  const low = response.bands.reduce<{ curve: FrequencyPoint[]; hz: number } | null>((best, b) => {
    const hz = passbandCenterHz(b.curve);
    return !best || hz < best.hz ? { curve: b.curve, hz } : best;
  }, null);
  return low ? f3Of(low.curve) : null;
}

/** The design's numbers from its runs. */
function metricsOf(
  spec: SpeakerSpec,
  response: SpeakerResponse,
  limits: SpeakerLimits,
  build: CabinetBuild,
): SpeakerOptimizerMetrics {
  const price = purchasedTotal(speakerPurchasedParts(spec.cabinet));
  const band = limits.bands.find((b) => b.id === limits.band);
  return {
    price: price.dollars,
    pricePartial: price.partial,
    lb: build.lb,
    ...outerSize(spec),
    musicDb: limits.musicDb,
    band: limits.band,
    who: band?.who ?? null,
    f3: speakerF3(response),
  };
}

/** The full evaluation of a spec, as the page shows it (its input range as the feed). */
export function evaluateSpeaker(spec: SpeakerSpec): SpeakerEval {
  const response = speakerResponse(spec, { feed: spec.input });
  const limits = speakerLimits(spec, response, { feed: spec.input });
  const build = cabinetBuild(spec.cabinet);
  const fitChips = chamberFitChips(spec.cabinet, build);
  return {
    spec,
    response,
    limits,
    build,
    metrics: metricsOf(spec, response, limits, build),
    facts: {
      bands: new Set(response.bands.map((b) => b.id)),
      chambers: response.chambers.map((c) => c.gaps.length === 0),
      drivers: driverFits(spec),
      vents: spec.cabinet.chambers.map((c) => hifiVentFits(spec.cabinet, c)),
      chips: fitChips.map((list) => list.every(([severity]) => severity !== "bad")),
    },
    warnings: keepUpWarnings(spec, response, limits),
    unpriced: [
      ...new Set(
        speakerPurchasedParts(spec.cabinet)
          .filter((r) => r.unit === null)
          // a port's pipe is the same unpriced stock at any length or bore: one entry for its kind
          .map((r) => (STOCK_PARTS.has(r.kind) ? r.kind : `${r.kind}:${r.model}`)),
      ),
    ]
      .sort()
      .join("|"),
  };
}

/**
 * The evaluation with only the bands' amp power changed (`spec` is `ev.spec` with other `ampW`): the response and the
 * build don't read the amps, so only the limits run again.
 */
export function withAmps(ev: SpeakerEval, spec: SpeakerSpec): SpeakerEval {
  const limits = speakerLimits(spec, ev.response, { feed: spec.input });
  return {
    ...ev,
    spec,
    limits,
    metrics: metricsOf(spec, ev.response, limits, ev.build),
    warnings: keepUpWarnings(spec, ev.response, limits),
  };
}

/**
 * The size locks as the checks take them, per axis: the size, in, and whether the box must measure exactly that (an
 * "exact" axis) or at most that (a "max" axis); absent: the axis is free.
 */
export type SizeCaps = Partial<Record<keyof Dims3, { in: number; exact: boolean }>>;

/** The box's size caps from the size locks: your size, as a most on a "max" axis and exactly on an "exact" one. */
export const capsOf = (
  outer: SpeakerOptimizerMetrics["sizeIn"],
  size: SpeakerOptimizerLocks["size"] = {},
): SizeCaps =>
  Object.fromEntries(
    (["w", "h", "d"] as const).flatMap((k) =>
      size[k] === "max" || size[k] === "exact"
        ? [[k, { in: outer[k], exact: size[k] === "exact" }]]
        : [],
    ),
  );

/** Whether an outer size holds the size locks: within SIZE_SLACK_IN of an exact axis, no larger than a max one. */
export const holdsSizeCaps = (sizeIn: Dims3, caps: SizeCaps): boolean =>
  (["w", "h", "d"] as const).every((k) => {
    const cap = caps[k];
    if (!cap) return true;
    const off = sizeIn[k] - cap.in;
    return cap.exact ? Math.abs(off) <= SIZE_SLACK_IN : off <= SIZE_SLACK_IN;
  });

/** A fact your design has that this design lost: true when `now` is false where `then` is true. */
const lost = (then: readonly boolean[], now: readonly boolean[]) =>
  then.some((ok, i) => ok && now[i] === false);

/**
 * What the design fails: against your design (`start`; it may fail nothing new: a chamber or band the model ran, a
 * driver, horn or vent that fit, a fit chip that passed) and against the limits. Your design against itself fails
 * only the limits.
 */
export function problemsOf(
  ev: Pick<SpeakerEval, "facts" | "metrics">,
  start: Pick<SpeakerEval, "facts">,
  limits: Pick<SpeakerOptimizerLimits, "budget" | "maxLb">,
  caps: SizeCaps,
): SpeakerProblem[] {
  const out: SpeakerProblem[] = [];
  const { facts } = ev,
    was = start.facts;
  if ([...was.bands].some((b) => !facts.bands.has(b)) || lost(was.chambers, facts.chambers))
    out.push(SPEAKER_PROBLEM.unmodeled);
  if (was.drivers.some((list, k) => lost(list, facts.drivers[k] ?? [])))
    out.push(SPEAKER_PROBLEM.driverFit);
  if (lost(was.vents, facts.vents)) out.push(SPEAKER_PROBLEM.ventFit);
  if (lost(was.chips, facts.chips)) out.push(SPEAKER_PROBLEM.fitChip);
  const m = ev.metrics;
  if (limits.budget !== null && m.price > limits.budget + 1e-9) out.push(SPEAKER_PROBLEM.budget);
  if (limits.maxLb !== null && m.lb > limits.maxLb + 1e-9) out.push(SPEAKER_PROBLEM.weight);
  if (!holdsSizeCaps(m.sizeIn, caps)) out.push(SPEAKER_PROBLEM.size);
  return out;
}

/**
 * The maximum output with one input as a card's chart takes it (a speaker's or a stack's): [Hz, dB] points, every
 * CURVE_EVERY of the grid.
 */
export const maxCurveOf = (limits: { sum: readonly FrequencyPoint[] }): [number, number][] =>
  limits.sum
    .filter((_, i) => i % CURVE_EVERY === 0)
    .map((o): [number, number] => [Math.round(o.f), Math.round(o.spl * 10) / 10]);
