import { useEffect, useMemo, useRef, useState } from "react";
import { highpassPhase, subMusicThroughLowpass } from "../../lib/pa/calc";
import { COVERAGE_LEVEL_REF } from "../../constants/coverageLevel";
import {
  audienceAverage,
  autoSubDelayMs,
  balanceLevels,
  balancedTarget,
  bandTarget,
  coverageBoxes,
  coverageLevelAt,
  coverageResponse,
  coverageScene,
  coverageStats,
  oneMeterSpot,
  withOwnPhase,
} from "../../lib/pa/coverage";
import { runCoverageGrid } from "../../lib/pa/runCoverage";
import type { PaPlanner } from "../pa-stack/hooks/usePaPlanner";
import type {
  CoverageBox,
  CoverageGrid,
  CoverageGridView,
  CoverageLayout,
  CoverageLevelRef,
  CoverageLevels,
  CoverageRequest,
  CoverageStack,
  CoverageStats,
  FrequencyPoint,
  BalancedLevels,
  MusicBalance,
  SubPlacement,
} from "../../types";

/** Grid columns across the room: coarse while something is being dragged, fine once it settles. */
const COARSE_COLS = 20,
  FINE_COLS = 40;

/** A grid to compute: the worker's request, and the music balance its target follows. */
interface CoverageJob {
  req: Omit<CoverageRequest, "cols">;
  balance: MusicBalance;
}

/** The planner fields the map reads. */
export type CoverageInputs = Pick<
  PaPlanner,
  | "stackGeometry"
  | "subBox"
  | "effectiveMidBoxDims"
  | "subModeled"
  | "subAmpVoltage"
  | "subMidCrossoverHz"
  | "subMidCrossoverOrder"
  | "subHighpassHz"
  | "subHighpassType"
  | "midHornCrossoverOrder"
  | "midModeled"
  | "hornModel"
  | "midHornCrossoverHz"
  | "midBandTiltDb"
  | "hornBandTiltDb"
>;

/** The map's results: the floor grid (null until the first one arrives), the boxes, the listener's level and response. */
export interface CoverageMap {
  stack: CoverageStack | null;
  /** the sub's delay against the tops, ms: in phase with the mid at the crossover (null without a sub to match) */
  subDelayMs: number | null;
  levels: CoverageLevels | null;
  /** how far each band is turned down to balance the system */
  pads: BalancedLevels["pads"] | null;
  boxes: CoverageBox[];
  /** where the subs stand: the layout's choice, or in the stacks when the sub has no model */
  subs: SubPlacement;
  /** the grid on show (null until the first one arrives), with the room and target it was computed for */
  view: CoverageGridView | null;
  /** whether the grid shown is from an older layout or still coarse (false once its update has failed) */
  isRefining: boolean;
  error: string;
  stats: CoverageStats | null;
  /** the listener's level in the band, and the response there, at the system's level (the gain applied) */
  listenerDb: number | null;
  response: FrequencyPoint[];
  /** the target the readouts compare against: the band's, under the music balance */
  target: number;
  /** the system's gain, dB: 0 at its limit, less when turned down so the reference gets the target */
  gain: number;
  /** the level at the reference at the system's level, dB (null until it can be worked out) */
  refDb: number | null;
  /** the target `refDb` is held to, dB: `target`, or for the audience average the target of the grid on show */
  refTarget: number;
  /** the balanced target against frequency, for the response chart */
  targetCurve: FrequencyPoint[];
}

/**
 * The system's gain, dB: what brings the reference's level (at the limit) down to the target, or 0 (its limit) when
 * the reference doesn't reach it. A gain only ever turns the system down: it can't play past its limit.
 */
const systemGain = (target: number, atLimit: number | null) =>
  atLimit != null ? Math.min(0, target - atLimit) : 0;

/**
 * A request's level at the limit at a reference worked out from points alone: at the listener (given only when it is
 * the reference), or the mean of the two stacks' 1 m levels; null for the audience average, which needs the grid.
 */
function pointRefAtLimit(
  req: CoverageJob["req"],
  ref: CoverageLevelRef,
  listener: CoverageLayout["listener"] | null,
): number | null {
  if (ref === COVERAGE_LEVEL_REF.listener) return listener && coverageLevelAt(req, listener);
  if (ref === COVERAGE_LEVEL_REF.stacks) {
    const { stacks, room } = req.layout;
    const [a, b] = stacks.map((s) =>
      coverageLevelAt(req, oneMeterSpot(s, req.stack.footprint, room)),
    );
    return (a + b) / 2;
  }
  return null;
}

/**
 * Builds the coverage model from the planner's design and the floor layout. The grid runs in a worker, newest
 * request first: coarse while `dragging`, then a fine pass once it settles.
 */
export function useCoverageMap(
  planner: CoverageInputs,
  layout: CoverageLayout,
  dragging: boolean,
): CoverageMap {
  const {
    stackGeometry,
    subBox,
    effectiveMidBoxDims,
    subModeled,
    subAmpVoltage,
    subMidCrossoverHz,
    subHighpassHz,
    subHighpassType,
    midModeled,
    hornModel,
    midHornCrossoverHz,
    midBandTiltDb,
    hornBandTiltDb,
  } = planner;
  const balance = useMemo(
    () => ({
      xoLo: subMidCrossoverHz,
      xoHi: midHornCrossoverHz,
      tilt: midBandTiltDb,
      hfTilt: hornBandTiltDb,
    }),
    [subMidCrossoverHz, midHornCrossoverHz, midBandTiltDb, hornBandTiltDb],
  );
  const geometry = useMemo<Omit<CoverageStack, "subDelayMs"> | null>(
    () =>
      stackGeometry
        ? {
            ...stackGeometry,
            footprint: { w: subBox.w, d: subBox.d },
            midW: effectiveMidBoxDims.w,
          }
        : null,
    [stackGeometry, subBox.w, subBox.d, effectiveMidBoxDims.w],
  );
  // each band at the planner's own limit (the sub at its music limit through its lowpass, the mid and horn as the
  // system chart draws them), with the sub's and mid's own phase, then balanced: the weakest band sets the level
  const balanced = useMemo<BalancedLevels | null>(
    () =>
      midModeled && geometry
        ? balanceLevels(
            {
              sub: subModeled
                ? withOwnPhase(
                    subMusicThroughLowpass(
                      subModeled.mdl,
                      subModeled.lim,
                      subAmpVoltage,
                      subMidCrossoverHz,
                      geometry.orderLo,
                    ),
                    subModeled.mdl.curve,
                    (f) => highpassPhase(f, subHighpassHz, subHighpassType),
                  )
                : null,
              mid: withOwnPhase(midModeled.max, midModeled.mdl.curve),
              horn: hornModel ? hornModel.curve : [],
            },
            balance,
            geometry,
          )
        : null,
    [
      subModeled,
      subAmpVoltage,
      subMidCrossoverHz,
      subHighpassHz,
      subHighpassType,
      midModeled,
      hornModel,
      balance,
      geometry,
    ],
  );
  const levels = balanced && balanced.levels;
  const { room, stacks, cluster, band, freqHz, earFt, listener, targetDb, levelRef } = layout;
  // the listener moves the level only when it is the reference; otherwise it is a probe
  const refListener = levelRef === COVERAGE_LEVEL_REF.listener ? listener : null;
  // the sub delayed as a DSP setup would: in phase with the mid at the crossover
  const subDelayMs = useMemo(
    () => (geometry && levels ? autoSubDelayMs(geometry, levels) : null),
    [geometry, levels],
  );
  const stack = useMemo<CoverageStack | null>(
    () => geometry && { ...geometry, subDelayMs: subDelayMs ?? 0 },
    [geometry, subDelayMs],
  );
  // center subs only when the sub has levels to play: otherwise the subs stay (silent) in the stacks
  const subs = levels?.sub ? layout.subs : "stacks";
  const job = useMemo<CoverageJob | null>(
    () =>
      stack && levels
        ? {
            req: { stack, levels, layout: { room, stacks, subs, cluster, band, freqHz, earFt } },
            balance,
          }
        : null,
    [stack, levels, room, stacks, subs, cluster, band, freqHz, earFt, balance],
  );

  // the worker queue: one job at a time, and only the newest waiting job is kept
  const [shown, setShown] = useState<{ grid: CoverageGrid; job: CoverageJob; cols: number } | null>(
    null,
  );
  // the last job that failed, and why; cleared when a grid arrives
  const [failed, setFailed] = useState<{ job: CoverageJob; message: string } | null>(null);
  const busy = useRef(false);
  const want = useRef<{ job: CoverageJob; cols: number } | null>(null);
  const current = useRef(job);
  const isDragging = useRef(dragging);
  const pump = () => {
    if (busy.current || !want.current) return;
    const next = want.current;
    want.current = null;
    busy.current = true;
    let ok = false;
    runCoverageGrid({ ...next.job.req, cols: next.cols })
      .then(
        (grid) => {
          ok = true;
          setShown({ grid, job: next.job, cols: next.cols });
          setFailed(null);
        },
        (e: unknown) =>
          setFailed({ job: next.job, message: e instanceof Error ? e.message : String(e) }),
      )
      .finally(() => {
        busy.current = false;
        if (
          ok &&
          !want.current &&
          next.job === current.current &&
          next.cols < FINE_COLS &&
          !isDragging.current
        )
          want.current = { job: next.job, cols: FINE_COLS };
        pump();
      });
  };
  useEffect(() => {
    current.current = job;
    if (!job) return;
    want.current = { job, cols: COARSE_COLS };
    pump();
  }, [job]);
  useEffect(() => {
    isDragging.current = dragging;
    if (!dragging && shown && shown.job === current.current && shown.cols < FINE_COLS) {
      want.current = { job: shown.job, cols: FINE_COLS };
      pump();
    }
  }, [dragging]);

  const scene = useMemo(
    () => (stack ? coverageScene(stack, { room, stacks, subs, cluster }) : null),
    [stack, room, stacks, subs, cluster],
  );
  const boxes = useMemo(
    () => (stack ? coverageBoxes({ stacks, subs, cluster }, stack) : []),
    [stack, stacks, subs, cluster],
  );
  const listenerAtLimit = useMemo(
    () => (job ? coverageLevelAt(job.req, listener) : null),
    [job, listener],
  );
  const target = bandTarget(targetDb, band, freqHz, balance);
  const responseAtLimit = useMemo(
    () => (scene && levels ? coverageResponse(scene, levels, listener, earFt) : []),
    [scene, levels, listener, earFt],
  );
  // the reference's level at the limit for the current layout, when points alone give it
  const refAtLimit = useMemo(
    () => (!job ? null : refListener ? listenerAtLimit : pointRefAtLimit(job.req, levelRef, null)),
    // the listener only counts when it is the reference
    [job, levelRef, refListener, listenerAtLimit],
  );
  // the grid on show, with the room, target and gain of the job it came from (an older one while the next computes)
  const drawn = job ? shown : null;
  const view = useMemo<CoverageGridView | null>(() => {
    if (!drawn) return null;
    const { req, balance: b } = drawn.job;
    const atLimit =
      levelRef === COVERAGE_LEVEL_REF.audience
        ? audienceAverage(drawn.grid, req.layout.room, coverageBoxes(req.layout, req.stack))
        : drawn.job === job
          ? refAtLimit
          : pointRefAtLimit(req, levelRef, refListener);
    const t = bandTarget(targetDb, req.layout.band, req.layout.freqHz, b),
      g = systemGain(t, atLimit);
    return { grid: drawn.grid, room: req.layout.room, target: t - g, gain: g, atLimit };
    // the listener only counts when it is the reference
  }, [drawn, job, refAtLimit, levelRef, refListener, targetDb]);
  // the audience average needs the grid, so its gain and target follow the grid on show (an older band's while the
  // next computes), never mixing that grid's average with the current band's target
  const fromGrid = levelRef === COVERAGE_LEVEL_REF.audience;
  const currentAtLimit = fromGrid ? (view ? view.atLimit : null) : refAtLimit;
  const refTarget = fromGrid && view ? view.target + view.gain : target;
  const gain = fromGrid ? (view ? view.gain : 0) : systemGain(target, currentAtLimit);
  const response = useMemo(
    () => responseAtLimit.map((o) => ({ f: o.f, spl: o.spl + gain })),
    [responseAtLimit, gain],
  );
  const stats = useMemo(() => {
    if (!view || !drawn) return null;
    const { stack: s, layout: l } = drawn.job.req;
    return coverageStats(view.grid, view.room, coverageBoxes(l, s), view.target);
  }, [view, drawn]);
  const targetCurve = useMemo(
    () => response.map((o) => ({ f: o.f, spl: balancedTarget(targetDb, o.f, balance) })),
    [response, balance, targetDb],
  );
  const jobFailed = !!job && failed?.job === job;
  return {
    stack,
    subDelayMs,
    levels,
    pads: balanced && balanced.pads,
    boxes,
    subs,
    view,
    isRefining: !!job && !jobFailed && (!shown || shown.job !== job || shown.cols < FINE_COLS),
    error: failed ? failed.message : "",
    stats,
    listenerDb: listenerAtLimit != null ? listenerAtLimit + gain : null,
    response,
    target,
    gain,
    refDb: currentAtLimit != null ? currentAtLimit + gain : null,
    refTarget,
    targetCurve,
  };
}
