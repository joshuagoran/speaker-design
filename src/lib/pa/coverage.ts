// Audience coverage: level across the floor from both stacks, seen from above. Each box is the dispersion model's
// stack (sub, mid and horn through their crossovers, with their directivity), driven at the planner's own output
// curves, placed and aimed on the floor. The floor is a mirror (half-space); each solid wall adds one mirrored copy of
// every box (first-order image sources, each with its own floor bounce), less its absorption. Higher-order reflections
// between walls, and so room modes, are left out.
// Below COHERENT_BELOW_HZ everything sums with phase, so the two stacks interfere; above it a band average adds the
// separate paths (each box, each reflection) by power, as their comb filtering averages out across a band.
import {
  baffleStepGain,
  logSpacedFrequencies,
  pistonPattern,
  waveguideGain,
  waveguideHalfAngles,
  type Complex,
} from "../hifi/hifi";
import { paStackSources, type StackBand, type StackSource } from "./dispersion";
import type {
  CoverageBand,
  CoverageBox,
  CoverageGrid,
  CoverageLayout,
  CoverageLevels,
  CoverageRequest,
  CoverageRoom,
  CoverageStack,
  CoverageStats,
  BalancedLevels,
  FloorPoint,
  FrequencyPoint,
  MusicBalance,
} from "../../types";

const C = 343,
  FT = 0.3048,
  IN = 0.0254;

/** The bands the map averages over, Hz. */
export const COVERAGE_BANDS: Record<
  Exclude<CoverageBand, "one">,
  { name: string; lo: number; hi: number }
> = {
  sub: { name: "Sub", lo: 30, hi: 80 },
  kick: { name: "Kick", lo: 80, hi: 160 },
  mid: { name: "Mid", lo: 160, hi: 2000 },
  high: { name: "High", lo: 2000, hi: 16000 },
};
/** frequencies averaged per band */
const BAND_POINTS = 10;
/** Below this the paths sum with phase in a band average; a single frequency always does. */
export const COHERENT_BELOW_HZ = 500;
/** the single-frequency view's range, Hz: above it the interference is finer than the grid */
export const SINGLE_FREQ_RANGE: [number, number] = [20, 500];
/** each box's DSP time-aligns its drivers on its axis this far out, m (as the dispersion map does) */
const ALIGN_DISTANCE_M = 10;
/** pressure the floor reflects: a hard floor indoors, ground outdoors */
const FLOOR_REFLECTION = { indoors: 0.95, outdoors: 0.85 };
/** A box shadows what's behind its cone: rule of thumb, −3 dB here and 6 dB/oct above. */
const BOX_SHADOW_HZ = 150;
/** Stats leave out the floor this close to a box, ft. */
const STATS_CLEARANCE_FT = 4;
/** The listener response: the PA charts' x axis. */
export const RESPONSE_FREQS = logSpacedFrequencies(15, 20000, 120);

/** One radiator in the sum: a box's driver, or its image in the floor or a wall. Metres and radians. */
interface SceneSource {
  /** the path it belongs to: one box, or one image of it */
  path: number;
  x: number;
  y: number;
  z: number;
  aim: number;
  /** reflection loss along this path, pressure */
  gain: number;
  src: StackSource;
  /** the delay that time-aligns it with the box's other drivers, as a distance, m */
  alignM: number;
}

/** Everything that radiates, ready to sum at any point. */
export interface CoverageScene {
  stack: CoverageStack;
  sources: SceneSource[];
  paths: number;
}

/**
 * One frequency of a sum: each band's complex output at 1 m, whether the paths add with phase, and what the
 * directivity needs at this frequency (each piston's ka, the horn's half angles, the box's rear shadow).
 */
export interface CoverageSlot {
  f: number;
  k: number;
  coherent: boolean;
  out: Partial<Record<StackBand, Complex>>;
  ka: Partial<Record<StackBand, number>>;
  hornHalf: [h: number, v: number];
  shadow: number;
}

/** The boxes on the floor: both stacks, and the center pair of subs when the subs stand there. Feet and degrees. */
export function coverageBoxes(
  layout: Pick<CoverageLayout, "stacks" | "subs" | "cluster">,
  stack: Pick<CoverageStack, "sub" | "footprint">,
): CoverageBox[] {
  const [left, right] = layout.stacks;
  const out: CoverageBox[] = [
    { ...left, kind: "stack", label: "L" },
    { ...right, kind: "stack", label: "R" },
  ];
  if (layout.subs === "center" && stack.sub) {
    const half = stack.footprint.w / 24;
    for (const sg of [-1, 1])
      out.push({
        x: layout.cluster.x + sg * half,
        y: layout.cluster.y,
        aim: 0,
        kind: "sub",
        label: "S",
      });
  }
  return out;
}

/** The sources to sum: each box's drivers, plus their images in the floor and in every solid wall. */
export function coverageScene(
  stack: CoverageStack,
  layout: Pick<CoverageLayout, "room" | "stacks" | "subs" | "cluster">,
): CoverageScene {
  const { room } = layout;
  const all = paStackSources(stack);
  const W = room.widthFt * FT,
    L = room.lengthFt * FT;
  const wallGain = Math.sqrt(1 - Math.min(1, Math.max(0, room.absorption)));
  const floorGain = room.outdoors ? FLOOR_REFLECTION.outdoors : FLOOR_REFLECTION.indoors;
  const sources: SceneSource[] = [];
  let paths = 0;
  for (const box of coverageBoxes(layout, stack)) {
    const drivers = all.filter((o) =>
      box.kind === "sub" ? o.band === "sub" : layout.subs === "stacks" || o.band !== "sub",
    );
    if (!drivers.length) continue;
    const refZ = (drivers.find((o) => o.horn) ?? drivers[0]).z * IN;
    const x = box.x * FT,
      y = box.y * FT,
      aim = (box.aim * Math.PI) / 180;
    const images = [{ x, y, aim, gain: 1 }];
    if (!room.outdoors) {
      if (room.walls.left) images.push({ x: -W - x, y, aim: -aim, gain: wallGain });
      if (room.walls.right) images.push({ x: W - x, y, aim: -aim, gain: wallGain });
      if (room.walls.front) images.push({ x, y: -y, aim: Math.PI - aim, gain: wallGain });
      if (room.walls.back) images.push({ x, y: 2 * L - y, aim: Math.PI - aim, gain: wallGain });
    }
    // the floor is a half-space: the box and each wall image has its mirror below the floor
    for (const im of images)
      for (const [zs, floor] of [
        [1, 1],
        [-1, floorGain],
      ] as const) {
        for (const src of drivers) {
          const z = src.z * IN;
          sources.push({
            path: paths,
            x: im.x,
            y: im.y,
            z: zs * z,
            aim: im.aim,
            gain: im.gain * floor,
            src,
            alignM: Math.hypot(ALIGN_DISTANCE_M, refZ - z) - ALIGN_DISTANCE_M,
          });
        }
        paths++;
      }
  }
  return { stack, sources, paths };
}

/** A curve's level at `f`, dB, interpolated on log frequency; null outside the curve (the band is silent there). */
export function curveLevelAt(curve: readonly FrequencyPoint[], f: number): number | null {
  const n = curve.length;
  if (!n || f < curve[0].f || f > curve[n - 1].f) return null;
  let lo = 0,
    hi = n - 1;
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (curve[m].f <= f) lo = m;
    else hi = m;
  }
  const a = curve[lo],
    b = curve[hi];
  if (b.f === a.f) return a.spl;
  const t = Math.log(f / a.f) / Math.log(b.f / a.f);
  return a.spl + (b.spl - a.spl) * t;
}

/**
 * The bands as a balanced system plays them at its limit: the mid `tilt` dB under the sub at the low crossover, the
 * horn `hfTilt` dB under the mid at the high one (the planner's music balance). The band with the least to spare sets
 * the level; the others are turned down to match. A band without a curve is left out of the balance.
 */
export function balanceLevels(levels: CoverageLevels, b: MusicBalance): BalancedLevels {
  const sub = levels.sub && curveLevelAt(levels.sub, b.xoLo),
    midLo = curveLevelAt(levels.mid, b.xoLo),
    midHi = curveLevelAt(levels.mid, b.xoHi),
    horn = curveLevelAt(levels.horn, b.xoHi);
  // gm: the mid's gain; the sub's follows from it, and the horn's from the mid's. Each must be 0 or less.
  let gm = 0;
  if (sub != null && midLo != null) gm = Math.min(gm, sub - b.tilt - midLo);
  if (horn != null && midHi != null) gm = Math.min(gm, horn + b.hfTilt - midHi);
  const pads = {
    sub: sub != null && midLo != null ? Math.min(0, midLo + gm + b.tilt - sub) : 0,
    mid: gm,
    horn: horn != null && midHi != null ? Math.min(0, midHi + gm - b.hfTilt - horn) : 0,
  };
  const shift = (c: FrequencyPoint[], db: number) => c.map((o) => ({ f: o.f, spl: o.spl + db }));
  return {
    levels: {
      sub: levels.sub && shift(levels.sub, pads.sub),
      mid: shift(levels.mid, pads.mid),
      horn: shift(levels.horn, pads.horn),
    },
    pads,
  };
}

/** The target at a frequency under the same music balance: the full target in the sub's band, less the tilts above. */
export const balancedTarget = (target: number, f: number, b: MusicBalance) =>
  f < b.xoLo ? target : f < b.xoHi ? target - b.tilt : target - b.tilt - b.hfTilt;

/** A band's target: the balanced target at the band's center (or at the one frequency). */
export function bandTarget(target: number, band: CoverageBand, freqHz: number, b: MusicBalance) {
  const f = band === "one" ? freqHz : Math.sqrt(COVERAGE_BANDS[band].lo * COVERAGE_BANDS[band].hi);
  return balancedTarget(target, f, b);
}

/**
 * Each band's output at each frequency: its level from the planner's curve (which already carries the crossover's
 * magnitude) with its crossover's phase, taken off the floor for the sub and mid (the map adds the floor itself).
 */
export function coverageSlots(
  stack: CoverageStack,
  levels: CoverageLevels,
  freqs: readonly number[],
  allCoherent: boolean,
): CoverageSlot[] {
  const srcs = paStackSources(stack);
  const { horn } = stack;
  return freqs.map((f) => {
    const k = (2 * Math.PI * f) / C;
    const out: CoverageSlot["out"] = {},
      ka: CoverageSlot["ka"] = {};
    for (const o of srcs) {
      if (!o.horn) ka[o.band] = k * o.a;
      const curve = levels[o.band];
      const db = curve && curveLevelAt(curve, f);
      if (db == null) continue;
      // the sub's and mid's curves are half-space (on the floor); in the open a box radiates into full space below
      // its baffle step, and the floor image puts the floor back. The horn's datasheet sensitivity is free-field.
      const amp = Math.pow(10, db / 20) * (o.horn ? 1 : baffleStepGain(f, stack.footprint.w)),
        h = o.filt(f),
        m = Math.hypot(h.re, h.im);
      out[o.band] = m > 1e-12 ? { re: (amp * h.re) / m, im: (amp * h.im) / m } : { re: amp, im: 0 };
    }
    return {
      f,
      k,
      coherent: allCoherent || f < COHERENT_BELOW_HZ,
      out,
      ka,
      hornHalf: waveguideHalfAngles(f, horn.covH, horn.covV, horn.wIn, horn.hIn),
      shadow: 1 / Math.hypot(1, f / BOX_SHADOW_HZ),
    };
  });
}

/** The frequencies a band averages, or the one frequency, and whether they all sum with phase. */
export function coverageFrequencies(
  band: CoverageBand,
  freqHz: number,
): { freqs: number[]; coherent: boolean } {
  if (band === "one") return { freqs: [freqHz], coherent: true };
  const b = COVERAGE_BANDS[band];
  return { freqs: logSpacedFrequencies(b.lo, b.hi, BAND_POINTS), coherent: false };
}

// scratch space for the sum: per source geometry (GEO values each), per path pressure
const GEO = 5;
let geo = new Float64Array(0),
  pre = new Float64Array(0),
  pim = new Float64Array(0);

/** Mean-square level at a point (metres, z above the floor) over the slots, dB SPL. */
export function levelAtPoint(
  scene: CoverageScene,
  slots: readonly CoverageSlot[],
  px: number,
  py: number,
  pz: number,
): number {
  const { sources, paths } = scene,
    n = sources.length;
  if (geo.length < GEO * n) geo = new Float64Array(GEO * n);
  if (pre.length < paths) {
    pre = new Float64Array(paths);
    pim = new Float64Array(paths);
  }
  // distance, angles off the source's axis (horizontal, vertical), sine of the total angle (a piston's pattern
  // stops at 90°), and whether the point is behind the box
  for (let i = 0; i < n; i++) {
    const s = sources[i],
      dx = px - s.x,
      dy = py - s.y,
      dz = pz - s.z,
      rh = Math.hypot(dx, dy),
      a = Math.atan2(dx, dy) - s.aim,
      th = Math.atan2(Math.sin(a), Math.cos(a)),
      tv = Math.atan2(dz, rh),
      c = Math.cos(th) * Math.cos(tv),
      g = GEO * i;
    geo[g] = Math.max(0.3, Math.hypot(rh, dz));
    geo[g + 1] = th;
    geo[g + 2] = tv;
    geo[g + 3] = c <= 0 ? 1 : Math.sqrt(1 - c * c);
    geo[g + 4] = Math.abs(th) > Math.PI / 2 ? 1 : 0;
  }
  let acc = 0;
  for (const sl of slots) {
    pre.fill(0, 0, paths);
    pim.fill(0, 0, paths);
    for (let i = 0; i < n; i++) {
      const s = sources[i],
        v = sl.out[s.src.band];
      if (!v) continue;
      const g = GEO * i,
        r = geo[g];
      let d: number;
      if (s.src.horn) d = waveguideGain(geo[g + 1], geo[g + 2], sl.hornHalf);
      else {
        d = pistonPattern((sl.ka[s.src.band] ?? 0) * geo[g + 3]);
        if (geo[g + 4]) d *= sl.shadow;
      }
      const mag = (d * s.gain) / r,
        ph = -sl.k * (r + s.alignM),
        c = Math.cos(ph),
        sn = Math.sin(ph);
      pre[s.path] += mag * (v.re * c - v.im * sn);
      pim[s.path] += mag * (v.re * sn + v.im * c);
    }
    if (sl.coherent) {
      let re = 0,
        im = 0;
      for (let p = 0; p < paths; p++) {
        re += pre[p];
        im += pim[p];
      }
      acc += re * re + im * im;
    } else for (let p = 0; p < paths; p++) acc += pre[p] * pre[p] + pim[p] * pim[p];
  }
  return 10 * Math.log10(Math.max(1e-12, acc / Math.max(1, slots.length)));
}

/** The grid's row count for `cols` columns across the room. */
export const gridRows = (room: Pick<CoverageRoom, "widthFt" | "lengthFt">, cols: number) =>
  Math.max(8, Math.min(3 * cols, Math.round((cols * room.lengthFt) / room.widthFt)));

/** Level at the center of every cell across the floor, at ear height. */
export function coverageGrid(
  scene: CoverageScene,
  slots: readonly CoverageSlot[],
  room: Pick<CoverageRoom, "widthFt" | "lengthFt">,
  earFt: number,
  cols: number,
): CoverageGrid {
  const rows = gridRows(room, cols),
    W = room.widthFt * FT,
    L = room.lengthFt * FT,
    z = earFt * FT;
  const db = new Float32Array(cols * rows);
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cols; i++)
      db[j * cols + i] = levelAtPoint(
        scene,
        slots,
        -W / 2 + ((i + 0.5) * W) / cols,
        ((j + 0.5) * L) / rows,
        z,
      );
  return { cols, rows, db };
}

/** The floor map for a request: what the worker runs. */
export function computeCoverageGrid({
  stack,
  levels,
  layout,
  cols,
}: CoverageRequest): CoverageGrid {
  const { freqs, coherent } = coverageFrequencies(layout.band, layout.freqHz);
  return coverageGrid(
    coverageScene(stack, layout),
    coverageSlots(stack, levels, freqs, coherent),
    layout.room,
    layout.earFt,
    cols,
  );
}

/** The response at a spot on the floor (feet), each frequency summed as a band average would sum it. */
export function coverageResponse(
  scene: CoverageScene,
  levels: CoverageLevels,
  at: FloorPoint,
  earFt: number,
): FrequencyPoint[] {
  return coverageSlots(scene.stack, levels, RESPONSE_FREQS, false).map((sl) => ({
    f: sl.f,
    spl: levelAtPoint(scene, [sl], at.x * FT, at.y * FT, earFt * FT),
  }));
}

/** The grid's level at a spot (feet), interpolated between cell centers. */
export function gridLevelAt(
  grid: CoverageGrid,
  room: Pick<CoverageRoom, "widthFt" | "lengthFt">,
  at: FloorPoint,
): number {
  const { cols, rows, db } = grid;
  const gx = Math.max(
    0,
    Math.min(cols - 1, ((at.x + room.widthFt / 2) / room.widthFt) * cols - 0.5),
  );
  const gy = Math.max(0, Math.min(rows - 1, (at.y / room.lengthFt) * rows - 0.5));
  const i0 = Math.floor(gx),
    j0 = Math.floor(gy),
    i1 = Math.min(cols - 1, i0 + 1),
    j1 = Math.min(rows - 1, j0 + 1),
    tx = gx - i0,
    ty = gy - j0;
  const top = db[j0 * cols + i0] * (1 - tx) + db[j0 * cols + i1] * tx,
    bot = db[j1 * cols + i0] * (1 - tx) + db[j1 * cols + i1] * tx;
  return top * (1 - ty) + bot * ty;
}

/** How much of the floor reaches the target, leaving out the space right in front of each box. */
export function coverageStats(
  grid: CoverageGrid,
  room: Pick<CoverageRoom, "widthFt" | "lengthFt">,
  boxes: readonly FloorPoint[],
  target: number,
): CoverageStats {
  const { cols, rows, db } = grid;
  const vals: number[] = [];
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cols; i++) {
      const x = -room.widthFt / 2 + ((i + 0.5) * room.widthFt) / cols,
        y = ((j + 0.5) * room.lengthFt) / rows;
      if (boxes.some((b) => Math.hypot(x - b.x, y - b.y) < STATS_CLEARANCE_FT)) continue;
      vals.push(db[j * cols + i] - target);
    }
  if (!vals.length) return { within3: 0, within6: 0, spread: 0 };
  vals.sort((a, b) => a - b);
  const share = (t: number) => vals.filter((v) => v >= t).length / vals.length;
  return {
    within3: share(-3),
    within6: share(-6),
    spread: vals[Math.floor(vals.length * 0.9)] - vals[Math.floor(vals.length * 0.1)],
  };
}

/**
 * Where the grid crosses `level` (marching squares): line segments between cell centers, in cell units
 * ([x1, y1, x2, y2], cell (i, j) centered at (i + 0.5, j + 0.5)).
 */
export function contourSegments(grid: CoverageGrid, level: number): number[][] {
  const { cols, rows, db } = grid;
  const out: number[][] = [];
  const v = (i: number, j: number) => db[j * cols + i] - level;
  // where the level crosses the edge between two corners
  const cross = (i0: number, j0: number, i1: number, j1: number) => {
    const a = v(i0, j0),
      b = v(i1, j1),
      t = a / (a - b);
    return [i0 + 0.5 + (i1 - i0) * t, j0 + 0.5 + (j1 - j0) * t];
  };
  for (let j = 0; j < rows - 1; j++)
    for (let i = 0; i < cols - 1; i++) {
      const tl = v(i, j) >= 0,
        tr = v(i + 1, j) >= 0,
        br = v(i + 1, j + 1) >= 0,
        bl = v(i, j + 1) >= 0;
      const pts: number[][] = [];
      if (tl !== tr) pts.push(cross(i, j, i + 1, j));
      if (tr !== br) pts.push(cross(i + 1, j, i + 1, j + 1));
      if (br !== bl) pts.push(cross(i + 1, j + 1, i, j + 1));
      if (bl !== tl) pts.push(cross(i, j + 1, i, j));
      // two crossings: one segment; four (a saddle): pair them up in order around the cell
      for (let k = 0; k + 1 < pts.length; k += 2) out.push([...pts[k], ...pts[k + 1]]);
    }
  return out;
}
