import { useEffect, useMemo, useRef, useState } from "react";
import { subMusicThroughLowpass } from "../../lib/pa/calc";
import {
  balanceLevels,
  balancedTarget,
  bandTarget,
  coverageBoxes,
  coverageLevelAt,
  coverageResponse,
  coverageScene,
  coverageStats,
} from "../../lib/pa/coverage";
import { LISTENER_TARGET_DB } from "../../lib/pa/optimize";
import { runCoverageGrid } from "../../lib/pa/runCoverage";
import type { PaPlanner } from "../pa-stack/hooks/usePaPlanner";
import type {
  CoverageBox,
  CoverageGrid,
  CoverageGridView,
  CoverageLayout,
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
  | "subModelled"
  | "subAmpVoltage"
  | "subMidCrossoverHz"
  | "subMidCrossoverOrder"
  | "midHornCrossoverOrder"
  | "midModelled"
  | "hornModel"
  | "midHornCrossoverHz"
  | "midBandTiltDb"
  | "hornBandTiltDb"
>;

/** The map's results: the floor grid (null until the first one arrives), the boxes, the listener's level and response. */
export interface CoverageMap {
  stack: CoverageStack | null;
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
  /** the system's gain, dB: 0 at its limit, less when turned down so the listener gets the target */
  gain: number;
  /** the balanced target against frequency, for the response chart */
  targetCurve: FrequencyPoint[];
}

/**
 * The system's gain, dB: 0 at its limit, or what brings the listener's level (at the limit) down to the target. A gain
 * only ever turns the system down: it can't play past its limit.
 */
const systemGain = (mode: CoverageLayout["levelMode"], target: number, atLimit: number | null) =>
  mode === "listener" && atLimit != null ? Math.min(0, target - atLimit) : 0;

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
    subModelled,
    subAmpVoltage,
    subMidCrossoverHz,
    midModelled,
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
  const stack = useMemo<CoverageStack | null>(
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
  // system chart draws them), then balanced: the weakest band sets the level
  const balanced = useMemo<BalancedLevels | null>(
    () =>
      midModelled && stack
        ? balanceLevels(
            {
              sub: subModelled
                ? subMusicThroughLowpass(
                    subModelled.mdl,
                    subModelled.lim,
                    subAmpVoltage,
                    subMidCrossoverHz,
                    stack.orderLo,
                  )
                : null,
              mid: midModelled.max,
              horn: hornModel ? hornModel.curve : [],
            },
            balance,
            stack,
          )
        : null,
    [subModelled, subAmpVoltage, subMidCrossoverHz, midModelled, hornModel, balance, stack],
  );
  const levels = balanced && balanced.levels;
  const { room, stacks, cluster, band, freqHz, earFt, listener, levelMode } = layout;
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
  const target = bandTarget(LISTENER_TARGET_DB, band, freqHz, balance);
  const gain = systemGain(levelMode, target, listenerAtLimit);
  const responseAtLimit = useMemo(
    () => (scene && levels ? coverageResponse(scene, levels, listener, earFt) : []),
    [scene, levels, listener, earFt],
  );
  const response = useMemo(
    () => responseAtLimit.map((o) => ({ f: o.f, spl: o.spl + gain })),
    [responseAtLimit, gain],
  );
  // the grid on show, with the room, target and gain of the job it came from (an older one while the next computes)
  const drawn = job ? shown : null;
  const drawnAtLimit = useMemo(
    () =>
      !drawn
        ? null
        : drawn.job === job
          ? listenerAtLimit
          : coverageLevelAt(drawn.job.req, listener),
    [drawn, job, listenerAtLimit, listener],
  );
  const view = useMemo<CoverageGridView | null>(() => {
    if (!drawn) return null;
    const { req, balance: b } = drawn.job;
    const t = bandTarget(LISTENER_TARGET_DB, req.layout.band, req.layout.freqHz, b),
      g = systemGain(levelMode, t, drawnAtLimit);
    return { grid: drawn.grid, room: req.layout.room, target: t - g, gain: g };
  }, [drawn, drawnAtLimit, levelMode]);
  const stats = useMemo(() => {
    if (!view || !drawn) return null;
    const { stack: s, layout: l } = drawn.job.req;
    return coverageStats(view.grid, view.room, coverageBoxes(l, s), view.target);
  }, [view, drawn]);
  const targetCurve = useMemo(
    () => response.map((o) => ({ f: o.f, spl: balancedTarget(LISTENER_TARGET_DB, o.f, balance) })),
    [response, balance],
  );
  const jobFailed = !!job && failed?.job === job;
  return {
    stack,
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
    targetCurve,
  };
}
