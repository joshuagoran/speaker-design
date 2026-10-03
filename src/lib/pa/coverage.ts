// Audience coverage: level across the floor from both stacks, seen from above. Each box is the dispersion model's
// stack (sub, mid and horn through their crossovers, with their directivity), driven at the planner's own output
// curves, placed and aimed on the floor.
// Outdoors the floor is a mirror (half-space), less what the ground and any crowd absorb, and the air absorbs along
// every path. Indoors the room is a rectangular box, each side and the ceiling of its own material:
// - Below the room's crossover (twice its Schroeder frequency, 80–200 Hz) the modes of the room carry the sound
//   (roomModes.ts), every driver of every box adding with phase.
// - Above it, the image sources: the floor mirror, one mirrored copy of every box in each reflecting side (each with
//   its own floor bounce) and in the ceiling, each less what its surface absorbs at that frequency; plus a diffuse
//   reverberant field from everything the boxes radiate, the same everywhere. The two hand over in a crossfade.
// Below COHERENT_BELOW_HZ the image paths sum with phase, so the two stacks interfere; above it a band average adds
// the separate paths (each box, each reflection) by power, as their comb filtering averages out across a band.
import {
  baffleStepGain,
  logSpacedFrequencies,
  pistonPattern,
  waveguideGain,
  waveguideHalfAngles,
  type Complex,
} from "../hifi/hifi";
import { METERS_PER_FOOT as FT } from "../../constants/units";
import { paStackSources, type StackBand, type StackSource } from "./dispersion";
import {
  airDbPerM,
  floorReflection,
  modalCrossoverHz,
  modalTopHz,
  modalWeight,
  roomAbsorption,
  roomSizeM,
  ROOM_SURFACES,
  surfaceReflection,
} from "./roomAcoustics";
import {
  modalPressure2,
  modalSlot,
  modalSource,
  roomModes,
  type ModalSlot,
  type ModalSource,
  type RoomModes,
} from "./roomModes";
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
  PaStackGeometry,
} from "../../types";

/** speed of sound, m/s (20 °C) */
export const SPEED_OF_SOUND = 343;
const C = SPEED_OF_SOUND,
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
export const BAND_POINTS = 10;
/** Below this the paths sum with phase in a band average; a single frequency always does. */
export const COHERENT_BELOW_HZ = 500;
/** the single-frequency view's range, Hz: above it the interference is finer than the grid */
export const SINGLE_FREQ_RANGE: [number, number] = [20, 500];
/** each box's DSP time-aligns its drivers on its axis this far out, m (as the dispersion model does) */
export const ALIGN_DISTANCE_M = 10;
/** A box shadows what's behind its cone: rule of thumb, −3 dB here and 6 dB/oct above. */
export const BOX_SHADOW_HZ = 150;
/**
 * The modal sum takes modes up to this many times the highest wavenumber it is evaluated at, so the direct sound near
 * a box isn't smoothed away by the cutoff.
 */
const MODE_SPAN = 2;
/** Stats leave out the floor this close to a box, ft. */
export const STATS_CLEARANCE_FT = 4;
/** The listener response: the PA charts' x axis. */
export const RESPONSE_FREQS = logSpacedFrequencies(15, 20000, 120);
/** A band this far (pressure) under the loudest at a frequency is left out of its sum: −80 dB. */
const SILENT = 1e-4;
/** pressure → nepers per metre from dB per metre */
const NEPER_PER_DB = Math.LN10 / 20;

/**
 * The reflections a path has taken, as an index into a slot's `refl`: 2 × the surface (0 none, then 1 + its place in
 * ROOM_SURFACES) + 1 when it also bounces off the floor.
 */
const reflIndex = (surface: number, floor: boolean) => 2 * surface + (floor ? 1 : 0);
const REFL_KINDS = 2 * (ROOM_SURFACES.length + 1);

/** One radiator in the sum: a box's driver, or its image in the floor, a side or the ceiling. Metres and radians. */
interface SceneSource {
  /** the path it belongs to: one box, or one image of it */
  path: number;
  x: number;
  y: number;
  z: number;
  aim: number;
  /** the reflections along this path (see reflIndex): the slot has what they keep at its frequency */
  refl: number;
  src: StackSource;
  /**
   * how much farther it is than the box's reference driver from the box's alignment point, m: the DSP delays the
   * box's other drivers by this against it, so the sum takes it off this driver's path
   */
  alignM: number;
}

/** Everything that radiates, ready to sum at any point. */
export interface CoverageScene {
  stack: CoverageStack;
  room: CoverageRoom;
  sources: SceneSource[];
  paths: number;
  /** indoors: the room's modes, the drivers as the modal sum sees them, and where it hands over to the images, Hz */
  modal: { modes: RoomModes; sources: ModalSource[]; crossoverHz: number } | null;
}

/**
 * One frequency of a sum: each band's complex output at 1 m, whether the paths add with phase, what the directivity
 * needs at this frequency (each piston's ka, the horn's half angles, the box's rear shadow), and the room there: what
 * each reflection keeps, the air's absorption, the diffuse field and the modal sum.
 */
export interface CoverageSlot {
  f: number;
  k: number;
  coherent: boolean;
  out: Partial<Record<StackBand, Complex>>;
  ka: Partial<Record<StackBand, number>>;
  hornHalf: [h: number, v: number];
  shadow: number;
  /** pressure each kind of path keeps after its reflections, by SceneSource.refl */
  refl: Float64Array;
  /** air absorption, nepers per metre (pressure) */
  air: number;
  /** the reverberant field's mean square, the same everywhere: 0 outdoors */
  diffuse: number;
  /** the modal sum, below the room's crossover (null above it, and outdoors) */
  modal: ModalSlot | null;
}

/** The boxes on the floor: both stacks, and the center subs when they stand there. Feet and degrees. */
export function coverageBoxes(
  layout: Pick<CoverageLayout, "stacks" | "subs" | "cluster">,
  stack: Pick<CoverageStack, "sub" | "footprint">,
): CoverageBox[] {
  const [left, right] = layout.stacks;
  const out: CoverageBox[] = [
    { ...left, kind: "stack", label: "L" },
    { ...right, kind: "stack", label: "R" },
  ];
  if (!stack.sub) return out;
  const { x, y } = layout.cluster;
  if (layout.subs === "single") out.push({ x, y, aim: 0, kind: "sub", label: "S" });
  if (layout.subs === "center") {
    const half = stack.footprint.w / 24;
    for (const sg of [-1, 1]) out.push({ x: x + sg * half, y, aim: 0, kind: "sub", label: "S" });
  }
  return out;
}

/**
 * The sources to sum: each box's drivers, plus their images in the floor and in every reflecting side and the
 * ceiling; indoors, also the room's modes and the drivers as the modal sum sees them.
 */
export function coverageScene(
  stack: CoverageStack,
  layout: Pick<CoverageLayout, "room" | "stacks" | "subs" | "cluster">,
): CoverageScene {
  const { room } = layout;
  const all = paStackSources(stack);
  const [W, L, ceiling] = roomSizeM(room);
  // a ceiling lower than the tallest driver can't be: it sits just over it
  const H = Math.max(ceiling, Math.max(...all.map((o) => o.z * IN)) + 0.3);
  const indoors = !room.outdoors;
  const crossoverHz = indoors ? modalCrossoverHz(room) : 0;
  const modes = indoors
    ? roomModes([W, L, H], (MODE_SPAN * 2 * Math.PI * modalTopHz(crossoverHz)) / C)
    : null;
  const modalSources: ModalSource[] = [];
  const reflects = (i: number) => indoors && room.materials[ROOM_SURFACES[i]] !== "open";
  const sources: SceneSource[] = [];
  let paths = 0;
  for (const box of coverageBoxes(layout, stack)) {
    const drivers = all.filter((o) =>
      box.kind === "sub" ? o.band === "sub" : layout.subs === "stacks" || o.band !== "sub",
    );
    if (!drivers.length) continue;
    const refZ = (drivers.find((o) => o.horn) ?? drivers[0]).z * IN;
    const alignM = (z: number) => Math.hypot(ALIGN_DISTANCE_M, refZ - z) - ALIGN_DISTANCE_M;
    const x = box.x * FT,
      y = box.y * FT,
      aim = (box.aim * Math.PI) / 180;
    // the box, and its image in each reflecting side: front, back, left, right as in ROOM_SURFACES
    const images = [
      { x, y, aim, surface: 0 },
      { x, y: -y, aim: Math.PI - aim, surface: 1 },
      { x, y: 2 * L - y, aim: Math.PI - aim, surface: 2 },
      { x: -W - x, y, aim: -aim, surface: 3 },
      { x: W - x, y, aim: -aim, surface: 4 },
    ].filter((im) => !im.surface || reflects(im.surface - 1));
    // the floor is a half-space: the box and each side's image has its mirror below the floor
    for (const im of images)
      for (const [zs, floor] of [
        [1, false],
        [-1, true],
      ] as const) {
        for (const src of drivers)
          sources.push({
            path: paths,
            x: im.x,
            y: im.y,
            z: zs * src.z * IN,
            aim: im.aim,
            refl: reflIndex(im.surface, floor),
            src,
            alignM: alignM(src.z * IN),
          });
        paths++;
      }
    // the ceiling's image, first order only
    if (reflects(4)) {
      for (const src of drivers)
        sources.push({
          path: paths,
          x,
          y,
          z: 2 * H - src.z * IN,
          aim,
          refl: reflIndex(5, false),
          src,
          alignM: alignM(src.z * IN),
        });
      paths++;
    }
    if (modes)
      for (const src of drivers)
        modalSources.push(
          modalSource(modes, src.band, alignM(src.z * IN), x + W / 2, y, src.z * IN),
        );
  }
  return {
    stack,
    room,
    sources,
    paths,
    modal: modes ? { modes, sources: modalSources, crossoverHz } : null,
  };
}

/**
 * A curve's level at `f`, dB, interpolated on log frequency; null for an empty curve (the band is silent). Outside the
 * curve, `skirt` (the band's crossover magnitude against frequency) carries the nearest end on, so the band keeps
 * rolling off past where its curve stops; without it the band is silent there.
 */
export function curveLevelAt(
  curve: readonly FrequencyPoint[],
  f: number,
  skirt?: (f: number) => number,
): number | null {
  const n = curve.length;
  if (!n) return null;
  if (f < curve[0].f || f > curve[n - 1].f) {
    if (!skirt) return null;
    const edge = f < curve[0].f ? curve[0] : curve[n - 1];
    return edge.spl + 20 * Math.log10(Math.max(1e-12, skirt(f)) / Math.max(1e-12, skirt(edge.f)));
  }
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

/** Each band's crossover magnitude against frequency: what carries its curve on past its ends. */
export function bandSkirts(
  stack: PaStackGeometry,
): Partial<Record<StackBand, (f: number) => number>> {
  const out: Partial<Record<StackBand, (f: number) => number>> = {};
  for (const o of paStackSources(stack))
    out[o.band] = (f) => {
      const h = o.filt(f);
      return Math.hypot(h.re, h.im);
    };
  return out;
}

/**
 * The bands as a balanced system plays them at its limit: the mid `tilt` dB under the sub at the low crossover, the
 * horn `hfTilt` dB under the mid at the high one (the planner's music balance). The band with the least to spare sets
 * the level; the others are turned down to match. Each curve is read past its ends along its crossover's skirt, as
 * the map plays it; a band without a curve is left out of the balance.
 */
export function balanceLevels(
  levels: CoverageLevels,
  b: MusicBalance,
  stack: PaStackGeometry,
): BalancedLevels {
  const skirt = bandSkirts(stack);
  const sub = levels.sub && curveLevelAt(levels.sub, b.xoLo, skirt.sub),
    midLo = curveLevelAt(levels.mid, b.xoLo, skirt.mid),
    midHi = curveLevelAt(levels.mid, b.xoHi, skirt.mid),
    horn = curveLevelAt(levels.horn, b.xoHi, skirt.horn);
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
 * A piston's directivity factor Q (on-axis intensity over the mean over all directions) as levelAtPoint radiates it:
 * the pattern at ka·sin θ over the front hemisphere, and behind the box its 90° value less the box's `shadow`.
 */
export function pistonQ(ka: number, shadow: number): number {
  const N = 32;
  let front = 0;
  for (let i = 0; i < N; i++) {
    const th = ((i + 0.5) / N) * (Math.PI / 2);
    front += pistonPattern(ka * Math.sin(th)) ** 2 * Math.sin(th);
  }
  front *= (2 * Math.PI * (Math.PI / 2)) / N;
  const rear = 2 * Math.PI * (pistonPattern(ka) * shadow) ** 2;
  return (4 * Math.PI) / (front + rear);
}

/**
 * A horn's directivity factor from its −6 dB coverage (half angles, radians), by Molloy's estimate
 * Q = 180° / asin(sin(H/2)·sin(V/2)) (Molloy, "Calculation of the directivity index for various types of
 * radiators", JASA 1948). It is for real horns, which put more power off axis than levelAtPoint's smooth pattern
 * (integrated, that pattern would give Q ≈ 40 for a 90° × 40° horn against Molloy's 13).
 */
export const hornQ = ([h, v]: [h: number, v: number]) =>
  Math.PI /
  Math.asin(Math.min(1, Math.sin(Math.min(h, Math.PI / 2)) * Math.sin(Math.min(v, Math.PI / 2))));

/**
 * Each band's output at each frequency: its level from the planner's curve (which already carries the crossover's
 * magnitude, and past the curve's ends rolls off by it) with its crossover's phase, taken off the floor for the sub and
 * mid (the map adds the floor itself); and the scene's room at that frequency.
 */
export function coverageSlots(
  scene: CoverageScene,
  levels: CoverageLevels,
  freqs: readonly number[],
  allCoherent: boolean,
): CoverageSlot[] {
  const { stack, room, modal } = scene;
  const srcs = paStackSources(stack);
  const { horn } = stack;
  const skirts = bandSkirts(stack);
  // how many of each band's drivers play: the boxes' own (not their images), for the reverberant field
  const count: Partial<Record<StackBand, number>> = {};
  for (const s of scene.sources) if (s.refl === 0) count[s.src.band] = (count[s.src.band] ?? 0) + 1;
  return freqs.map((f) => {
    const k = (2 * Math.PI * f) / C;
    const out: CoverageSlot["out"] = {},
      ka: CoverageSlot["ka"] = {};
    for (const o of srcs) {
      if (!o.horn) ka[o.band] = k * o.a;
      const curve = levels[o.band];
      const db = curve && curveLevelAt(curve, f, skirts[o.band]);
      if (db == null) continue;
      // the sub's and mid's curves are half-space (on the floor); in the open a box radiates into full space below
      // its baffle step (each band's from its own box's width), and the floor image puts the floor back. The horn's
      // datasheet sensitivity is free-field.
      const baffleW = o.band === "sub" ? stack.footprint.w : stack.midW,
        amp = Math.pow(10, db / 20) * (o.horn ? 1 : baffleStepGain(f, baffleW)),
        h = o.filt(f),
        m = Math.hypot(h.re, h.im);
      out[o.band] = m > 1e-12 ? { re: (amp * h.re) / m, im: (amp * h.im) / m } : { re: amp, im: 0 };
    }
    // a band more than SILENT_DB under the loudest adds nothing the map can show: leave it out of the sums
    const loudest = Math.max(...Object.values(out).map((v) => Math.hypot(v.re, v.im)));
    for (const o of srcs) {
      const v = out[o.band];
      if (v && Math.hypot(v.re, v.im) < loudest * SILENT) delete out[o.band];
    }
    const hornHalf = waveguideHalfAngles(f, horn.covH, horn.covV, horn.wIn, horn.hIn),
      shadow = 1 / Math.hypot(1, f / BOX_SHADOW_HZ);
    // what each kind of path keeps: its side or ceiling's reflection, times the floor's when it bounces off it too
    const floor = floorReflection(room, f),
      refl = new Float64Array(REFL_KINDS);
    for (let s = 0; s <= ROOM_SURFACES.length; s++) {
      const g = !s
        ? 1
        : room.outdoors
          ? 0
          : surfaceReflection(room.materials[ROOM_SURFACES[s - 1]], f);
      refl[reflIndex(s, false)] = g;
      refl[reflIndex(s, true)] = g * floor;
    }
    let diffuse = 0,
      ms: ModalSlot | null = null;
    if (modal) {
      const abs = roomAbsorption(room, f),
        weight = modalWeight(f, modal.crossoverHz);
      // The reverberant field, Hopkins–Stryker: p² = 4ρcW / R per driver, R = A / (1 − ᾱ) the room constant, from each
      // driver's power W = 4π·p²(1 m) / (ρc·Q). That is everything after the direct sound, the first reflection
      // included; the image sources already carry the first reflections, so it is taken from the second on, one more
      // factor (1 − ᾱ): p² = 16π·p²(1 m)·(1 − ᾱ)² / (Q·A). (The floor-and-side images are second order, counted twice;
      // they are a small part of it.) ρc cancels: levels here are in the curves' own units.
      if (weight < 1)
        for (const { band } of srcs) {
          const v = out[band];
          if (!v) continue;
          const q = band === "horn" ? hornQ(hornHalf) : pistonQ(ka[band] ?? 0, shadow);
          diffuse +=
            ((count[band] ?? 0) *
              16 *
              Math.PI *
              (v.re * v.re + v.im * v.im) *
              (1 - abs.alpha) ** 2) /
            (q * abs.area);
        }
      if (weight > 0) {
        // each driver's jωρQ: 4π × its free-field pressure at 1 m, its alignment delay taken off (see levelAtPoint)
        const u = new Float64Array(2 * modal.sources.length);
        for (const [i, s] of modal.sources.entries()) {
          const v = out[s.band];
          if (!v) continue;
          const c = Math.cos(k * s.alignM),
            sn = Math.sin(k * s.alignM);
          u[2 * i] = 4 * Math.PI * (v.re * c - v.im * sn);
          u[2 * i + 1] = 4 * Math.PI * (v.re * sn + v.im * c);
        }
        // what each surface reflects, as the image sources have it (MODAL_SURFACES: the five sides, then the floor)
        const reflection = [...ROOM_SURFACES.map((_, s) => refl[reflIndex(s + 1, false)]), floor];
        ms = modalSlot(modal.modes, k, abs.t60, u, reflection, weight);
      }
    }
    return {
      f,
      k,
      coherent: allCoherent || f < COHERENT_BELOW_HZ,
      out,
      ka,
      hornHalf,
      shadow,
      refl,
      air: airDbPerM(f) * NEPER_PER_DB,
      diffuse,
      modal: ms,
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

/**
 * Mean-square level at a point (metres, z above the floor) over the slots, dB SPL: at each slot the modal sum, or the
 * image sources and the diffuse field, or both in their crossfade (by power).
 */
export function levelAtPoint(
  scene: CoverageScene,
  slots: readonly CoverageSlot[],
  px: number,
  py: number,
  pz: number,
): number {
  const { sources, paths, modal } = scene,
    n = sources.length;
  if (geo.length < GEO * n) geo = new Float64Array(GEO * n);
  if (pre.length < paths) {
    pre = new Float64Array(paths);
    pim = new Float64Array(paths);
  }
  let geoReady = false;
  let acc = 0;
  for (const sl of slots) {
    const w = sl.modal && modal ? sl.modal.weight : 0;
    if (w > 0 && sl.modal && modal)
      acc +=
        w *
        modalPressure2(modal.modes, modal.sources, sl.modal, px + modal.modes.size[0] / 2, py, pz);
    if (w >= 1) continue;
    if (!geoReady) {
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
      geoReady = true;
    }
    pre.fill(0, 0, paths);
    pim.fill(0, 0, paths);
    for (let i = 0; i < n; i++) {
      const s = sources[i],
        v = sl.out[s.src.band],
        gain = sl.refl[s.refl];
      if (!v || !gain) continue;
      const g = GEO * i,
        r = geo[g];
      let d: number;
      if (s.src.horn) d = waveguideGain(geo[g + 1], geo[g + 2], sl.hornHalf);
      else {
        d = pistonPattern((sl.ka[s.src.band] ?? 0) * geo[g + 3]);
        if (geo[g + 4]) d *= sl.shadow;
      }
      const mag = (d * gain * Math.exp(-sl.air * r)) / r,
        // less the alignment, so the box's drivers arrive together at its alignment point
        ph = -sl.k * (r - s.alignM),
        c = Math.cos(ph),
        sn = Math.sin(ph);
      pre[s.path] += mag * (v.re * c - v.im * sn);
      pim[s.path] += mag * (v.re * sn + v.im * c);
    }
    let ms = sl.diffuse;
    if (sl.coherent) {
      let re = 0,
        im = 0;
      for (let p = 0; p < paths; p++) {
        re += pre[p];
        im += pim[p];
      }
      ms += re * re + im * im;
    } else for (let p = 0; p < paths; p++) ms += pre[p] * pre[p] + pim[p] * pim[p];
    acc += (1 - w) * ms;
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
  const scene = coverageScene(stack, layout);
  return coverageGrid(
    scene,
    coverageSlots(scene, levels, freqs, coherent),
    layout.room,
    layout.earFt,
    cols,
  );
}

/** A request's level at one spot on the floor (feet), at ear height, in its band: what its grid shows there. */
export function coverageLevelAt(
  { stack, levels, layout }: Omit<CoverageRequest, "cols">,
  at: FloorPoint,
): number {
  const { freqs, coherent } = coverageFrequencies(layout.band, layout.freqHz);
  const scene = coverageScene(stack, layout);
  return levelAtPoint(
    scene,
    coverageSlots(scene, levels, freqs, coherent),
    at.x * FT,
    at.y * FT,
    layout.earFt * FT,
  );
}

/** The response at a spot on the floor (feet), each frequency summed as a band average would sum it. */
export function coverageResponse(
  scene: CoverageScene,
  levels: CoverageLevels,
  at: FloorPoint,
  earFt: number,
): FrequencyPoint[] {
  return coverageSlots(scene, levels, RESPONSE_FREQS, false).map((sl) => ({
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
