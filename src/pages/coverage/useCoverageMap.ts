import { useEffect, useMemo, useRef, useState } from "react";
import { subMusicThroughLowpass } from "../../lib/pa/calc";
import {
  balanceLevels,
  balancedTarget,
  bandTarget,
  coverageBoxes,
  coverageFrequencies,
  coverageResponse,
  coverageScene,
  coverageSlots,
  coverageStats,
  levelAtPoint,
} from "../../lib/pa/coverage";
import { LISTENER_TARGET_DB } from "../../lib/pa/optimize";
import { runCoverageGrid } from "../../lib/pa/runCoverage";
import type { PaPlanner } from "../pa-stack/hooks/usePaPlanner";
import type {
  CoverageBox,
  CoverageGrid,
  CoverageLayout,
  CoverageLevels,
  CoverageRequest,
  CoverageStack,
  CoverageStats,
  FrequencyPoint,
  BalancedLevels,
} from "../../types";

/** Grid columns across the room: coarse while something is being dragged, fine once it settles. */
const COARSE_COLS = 20,
  FINE_COLS = 40;
const FT = 0.3048;

/** The planner fields the map reads. */
export type CoverageInputs = Pick<
  PaPlanner,
  | "stackGeometry"
  | "subBox"
  | "subModelled"
  | "subAmpVoltage"
  | "subMidCrossoverHz"
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
  grid: CoverageGrid | null;
  /** whether the grid shown is from an older layout or still coarse */
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
  /** what a grid level is compared against: the target less the gain (the grid is at the limit) */
  gridTarget: number;
  /** the balanced target against frequency, for the response chart */
  targetCurve: FrequencyPoint[];
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
    () => (stackGeometry ? { ...stackGeometry, footprint: { w: subBox.w, d: subBox.d } } : null),
    [stackGeometry, subBox.w, subBox.d],
  );
  // each band at the planner's own limit (the sub at its music limit through its lowpass, the mid and horn as the
  // system chart draws them), then balanced: the weakest band sets the level
  const balanced = useMemo<BalancedLevels | null>(
    () =>
      midModelled
        ? balanceLevels(
            {
              sub: subModelled
                ? subMusicThroughLowpass(
                    subModelled.mdl,
                    subModelled.lim,
                    subAmpVoltage,
                    subMidCrossoverHz,
                  )
                : null,
              mid: midModelled.max,
              horn: hornModel ? hornModel.curve : [],
            },
            balance,
          )
        : null,
    [subModelled, subAmpVoltage, subMidCrossoverHz, midModelled, hornModel, balance],
  );
  const levels = balanced && balanced.levels;
  const { room, stacks, subs, cluster, band, freqHz, earFt, listener, levelMode } = layout;
  const base = useMemo<Omit<CoverageRequest, "cols"> | null>(
    () =>
      stack && levels
        ? { stack, levels, layout: { room, stacks, subs, cluster, band, freqHz, earFt } }
        : null,
    [stack, levels, room, stacks, subs, cluster, band, freqHz, earFt],
  );

  // the worker queue: one job at a time, and only the newest waiting job is kept
  const [shown, setShown] = useState<{
    grid: CoverageGrid;
    base: Omit<CoverageRequest, "cols">;
    cols: number;
  } | null>(null);
  const [error, setError] = useState("");
  const busy = useRef(false);
  const want = useRef<{ base: Omit<CoverageRequest, "cols">; cols: number } | null>(null);
  const current = useRef(base);
  const isDragging = useRef(dragging);
  const pump = () => {
    if (busy.current || !want.current) return;
    const job = want.current;
    want.current = null;
    busy.current = true;
    runCoverageGrid({ ...job.base, cols: job.cols })
      .then(
        (grid) => {
          setShown({ grid, base: job.base, cols: job.cols });
          setError("");
        },
        (e: unknown) => setError(e instanceof Error ? e.message : String(e)),
      )
      .finally(() => {
        busy.current = false;
        if (
          !want.current &&
          job.base === current.current &&
          job.cols < FINE_COLS &&
          !isDragging.current
        )
          want.current = { base: job.base, cols: FINE_COLS };
        pump();
      });
  };
  useEffect(() => {
    current.current = base;
    if (!base) return;
    want.current = { base, cols: COARSE_COLS };
    pump();
  }, [base]);
  useEffect(() => {
    isDragging.current = dragging;
    if (!dragging && shown && shown.base === current.current && shown.cols < FINE_COLS) {
      want.current = { base: shown.base, cols: FINE_COLS };
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
  const listenerAtLimit = useMemo(() => {
    if (!scene || !stack || !levels) return null;
    const { freqs, coherent } = coverageFrequencies(band, freqHz);
    return levelAtPoint(
      scene,
      coverageSlots(stack, levels, freqs, coherent),
      listener.x * FT,
      listener.y * FT,
      earFt * FT,
    );
  }, [scene, stack, levels, band, freqHz, listener, earFt]);
  const target = bandTarget(LISTENER_TARGET_DB, band, freqHz, balance);
  // a gain only ever turns the system down: it can't play past its limit
  const gain =
    levelMode === "listener" && listenerAtLimit != null ? Math.min(0, target - listenerAtLimit) : 0;
  const responseAtLimit = useMemo(
    () => (scene && levels ? coverageResponse(scene, levels, listener, earFt) : []),
    [scene, levels, listener, earFt],
  );
  const response = useMemo(
    () => responseAtLimit.map((o) => ({ f: o.f, spl: o.spl + gain })),
    [responseAtLimit, gain],
  );
  const grid = base ? (shown?.grid ?? null) : null;
  const gridTarget = target - gain;
  const stats = useMemo(
    () => (grid ? coverageStats(grid, room, boxes, gridTarget) : null),
    [grid, room, boxes, gridTarget],
  );
  const targetCurve = useMemo(
    () => response.map((o) => ({ f: o.f, spl: balancedTarget(LISTENER_TARGET_DB, o.f, balance) })),
    [response, balance],
  );
  return {
    stack,
    levels,
    pads: balanced && balanced.pads,
    boxes,
    grid,
    isRefining: !!base && (!shown || shown.base !== base || shown.cols < FINE_COLS),
    error,
    stats,
    listenerDb: listenerAtLimit != null ? listenerAtLimit + gain : null,
    response,
    target,
    gain,
    gridTarget,
    targetCurve,
  };
}
