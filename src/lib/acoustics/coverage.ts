// Audience coverage: level across the floor from both stacks, seen from above. Each box is the dispersion model's
// stack (sub, mid and horn through their crossovers, with their directivity), driven at the models' own output
// curves, placed and aimed on the floor.
// Outdoors the floor is a mirror (half-space), less what the ground and any crowd absorb, and the air absorbs along
// every path. Indoors the room is a rectangular box, each side and the ceiling of its own material:
// - Below the room's crossover (twice its Schroeder frequency, 80–200 Hz) the modes of the room carry the sound
//   (roomModes.ts), every driver of every box adding with phase.
// - Above it, the image sources: the floor mirror, one mirrored copy of every box in each reflecting side (each with
//   its own floor bounce) and in the ceiling, each less what its surface absorbs at that frequency; plus a diffuse
//   reverberant field from everything the boxes radiate, the same everywhere. The two hand over in a crossfade.
// Below COHERENT_BELOW_HZ the image paths sum with phase, so the two stacks interfere; above it a band average, or one
// frequency, adds the separate paths (each box, each reflection) by power: their comb filtering is finer than the map.
// Stages and risers (stageAcoustics.ts): each face and top a driver sees adds its image (a face with its floor bounce
// too), kept at a point where its reflection lands on that face and faded out across the face's edges; and a stage in
// the way of a path takes off its barrier loss. They are image paths: indoors, below the crossover, the modal sum and the diffuse field don't see them.
import {
  MODAL_SUBPOINTS,
  MODAL_SUBPOINTS_WHOLE_BAND,
  SPEED_OF_SOUND,
} from "../../constants/acoustics";
import {
  logSpacedFrequencies,
  pistonPattern,
  waveguideGain,
  waveguideHalfAngles,
} from "./directivity";
import { METERS_PER_FOOT as FT } from "../../constants/units";
import {
  BARRIER_BRIGHT_N,
  BARRIER_CAP_NEPERS,
  barrierCapped,
  barrierNepers,
  edgeFade,
  faceSide,
  fresnelRadius,
  lineDetour,
  outlineDepth,
  sizeFade,
  stageGeometry,
  type Detour,
  type SceneStage,
  type StageBlock,
  type StageReflector,
} from "./stageAcoustics";
import { COVERAGE_EDGE_DB } from "../../constants/coverageLevel";
import {
  airDbPerM,
  floorReflection,
  modalCrossoverHz,
  modalTopHz,
  modalWeight,
  roomAbsorption,
  roomSizeM,
  ROOM_SURFACES,
  STAGE_MATERIAL,
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
  Complex,
  CoverageBand,
  CoverageGrid,
  CoverageRoom,
  CoverageStack,
  CoverageStats,
  FloorPlacement,
  FloorPoint,
  FrequencyPoint,
  PaStackGeometry,
} from "../../types";

const C = SPEED_OF_SOUND;

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
/** Grid columns across the room. */
export const COVERAGE_GRID_COLS = 40;
/** frequencies averaged per band */
export const BAND_POINTS = 10;
/**
 * The map's quick pass while something is dragged on it: a third of the columns, this many band points, and no modal
 * sub-points. The full pass follows when the drag ends.
 */
export const QUICK_GRID_COLS = Math.round(COVERAGE_GRID_COLS / 3);
export const QUICK_BAND_POINTS = 4;
/** Below this the paths sum with phase, in a band average or at one frequency; above it they add by power. */
export const COHERENT_BELOW_HZ = 500;
/** the single-frequency view's range, Hz: above `COHERENT_BELOW_HZ` it adds by power, as the bands do */
export const SINGLE_FREQ_RANGE: [number, number] = [20, 16000];
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
/** pressure → nepers per meter from dB per meter */
const NEPER_PER_DB = Math.LN10 / 20;

/**
 * The reflections a path has taken, as an index into a slot's `refl`: 2 × the surface (0 none, then 1 + its place in
 * ROOM_SURFACES, then the stages' faces and tops after the room's: REFL_ROOM / 2 + the scene's reflector) + 1 when it
 * also bounces off the floor.
 */
const reflIndex = (surface: number, floor: boolean) => 2 * surface + (floor ? 1 : 0);
const REFL_ROOM = 2 * (ROOM_SURFACES.length + 1);
const stageReflIndex = (reflector: number, floor: boolean) =>
  REFL_ROOM + reflIndex(reflector, floor);

/** A horn's coverage, as the map radiates it: its −6 dB angles, degrees, and its mouth, inches. */
export type HornCoverage = Omit<PaStackGeometry["horn"], "zIn">;

/** How a radiator spreads its sound: a piston of radius `a`, m (a cone), or a horn of its coverage. */
export type CoveragePattern =
  | { a: number; horn?: undefined }
  | { horn: HornCoverage; a?: undefined };

/**
 * What radiates in a scene, by id: one kind of driver of one box (the PA stack's sub, mid or horn; a band of a placed
 * stack member), its pattern; its output at each frequency comes with the slots (`sceneSlots`).
 */
export interface CoverageVoice {
  id: string;
  pattern: CoveragePattern;
}

/** A driver as a scene places it: its voice, where it is (m: x across from the center line, y down the room, z up), its aim. */
export interface SceneDriver {
  voice: CoverageVoice["id"];
  x: number;
  y: number;
  z: number;
  /** its axis: yaw from straight down the room (+ toward +x) and pitch (+ up), radians */
  yaw: number;
  pitch: number;
  /**
   * how much farther it is than its box's reference driver from the box's alignment point, m: the DSP delays the box's
   * other drivers by this against it, so the sum takes it off this driver's path (0 where its feed carries its delay)
   */
  alignM: number;
}

/** One radiator in the sum: a box's driver, or its image in the floor, a side or the ceiling. Meters and radians. */
interface SceneSource extends Pick<SceneDriver, "voice" | "x" | "y" | "z" | "alignM"> {
  /** the path it belongs to: one box, or one image of it */
  path: number;
  /** its axis's yaw and pitch, as cosines and sines */
  cy: number;
  sy: number;
  cp: number;
  sp: number;
  /** a horn (its voice's pattern), not a piston */
  horn: boolean;
  /** the reflections along this path (see reflIndex): the slot has what they keep at its frequency */
  refl: number;
  /** it bounces off the room's floor */
  floor: boolean;
  /** the stage face or top it is an image in (its index in the scene's `reflectors`), or −1 */
  reflector: number;
  /** the driver it images, m: a stage image's legs run from there */
  ox: number;
  oy: number;
  oz: number;
}

/** Everything that radiates, ready to sum at any point. */
export interface CoverageScene {
  room: CoverageRoom;
  voices: CoverageVoice[];
  sources: SceneSource[];
  paths: number;
  /** indoors: the room's modes, the drivers as the modal sum sees them, and where it hands over to the images, Hz */
  modal: { modes: RoomModes; sources: ModalSource[]; crossoverHz: number } | null;
  /** the stages, as the barrier reads them, and their faces and tops that reflect */
  blocks: StageBlock[];
  reflectors: StageReflector[];
}

/**
 * One frequency of a sum: each voice's complex output at 1 m, whether the paths add with phase, what the directivity
 * needs at this frequency (each piston's ka, each horn's half angles, the box's rear shadow), and the room there: what
 * each reflection keeps, the air's absorption, the diffuse field and the modal sum.
 */
export interface CoverageSlot {
  f: number;
  /** its share of the band average's weight: 1 for a band point, 1/M for each of the M frequencies a point splits into */
  share: number;
  k: number;
  coherent: boolean;
  out: Partial<Record<CoverageVoice["id"], Complex>>;
  ka: Partial<Record<CoverageVoice["id"], number>>;
  hornHalf: Partial<Record<CoverageVoice["id"], [h: number, v: number]>>;
  shadow: number;
  /** pressure each kind of path keeps after its reflections, by SceneSource.refl */
  refl: Float64Array;
  /** how much of each stage's barrier loss (dB) holds here: none where the stage is small against the wavelength */
  stageFade: Float64Array;
  /** air absorption, nepers per meter (pressure) */
  air: number;
  /** the reverberant field's mean square, the same everywhere: 0 outdoors */
  diffuse: number;
  /** the modal sum, below the room's crossover (null above it, and outdoors) */
  modal: ModalSlot | null;
}

/** Where a driver's image in a stage's face or top is, and its aim. */
function stageImage(
  d: SceneDriver,
  r: StageReflector,
): Pick<SceneDriver, "x" | "y" | "z" | "yaw" | "pitch"> {
  if (!r.face) return { ...d, z: 2 * r.top - d.z, pitch: -d.pitch };
  const { nx, ny } = r.face,
    side = faceSide(r.face, d.x, d.y),
    // its aim on the plan, mirrored in the face
    hx = Math.sin(d.yaw),
    hy = Math.cos(d.yaw),
    along = hx * nx + hy * ny;
  return {
    ...d,
    x: d.x - 2 * side * nx,
    y: d.y - 2 * side * ny,
    yaw: Math.atan2(hx - 2 * along * nx, hy - 2 * along * ny),
  };
}

/** Whether a driver sees a stage's face (it stands on the face's outer side) or its top (it is above it). */
const seesReflector = (r: StageReflector, d: SceneDriver) =>
  r.face ? faceSide(r.face, d.x, d.y) > 1e-6 : d.z > r.top + 1e-6;

/**
 * The sources to sum from boxes of drivers: each box's drivers, plus their images in the floor and in every reflecting
 * side and the ceiling, and in each stage face (with its floor bounce, on a floor stage) and top they see (a path
 * each); indoors, also the room's modes and the drivers as the modal sum sees them.
 */
export function sceneOf(
  room: CoverageRoom,
  voices: CoverageVoice[],
  boxes: readonly (readonly SceneDriver[])[],
  stages: readonly SceneStage[] = [],
): CoverageScene {
  const { blocks, reflectors } = stageGeometry(stages);
  const all = boxes.flat();
  const [W, L, ceiling] = roomSizeM(room);
  // a ceiling lower than the tallest driver can't be: it sits just over it
  const H = Math.max(ceiling, Math.max(0, ...all.map((o) => o.z)) + 0.3);
  const indoors = !room.outdoors;
  const crossoverHz = indoors ? modalCrossoverHz(room) : 0;
  const modes = indoors
    ? roomModes([W, L, H], (MODE_SPAN * 2 * Math.PI * modalTopHz(crossoverHz)) / C)
    : null;
  const modalSources: ModalSource[] = [];
  const reflects = (i: number) => indoors && room.materials[ROOM_SURFACES[i]] !== "open";
  const horns = new Set(voices.filter((v) => v.pattern.horn).map((v) => v.id));
  const sources: SceneSource[] = [];
  const source = (
    d: SceneDriver,
    path: number,
    at: Pick<SceneDriver, "x" | "y" | "z" | "yaw" | "pitch">,
    refl: number,
    floor: boolean,
    reflector = -1,
  ): SceneSource => ({
    voice: d.voice,
    x: at.x,
    y: at.y,
    z: at.z,
    alignM: d.alignM,
    path,
    cy: Math.cos(at.yaw),
    sy: Math.sin(at.yaw),
    cp: Math.cos(at.pitch),
    sp: Math.sin(at.pitch),
    horn: horns.has(d.voice),
    refl,
    floor,
    reflector,
    ox: d.x,
    oy: d.y,
    oz: d.z,
  });
  let paths = 0;
  for (const drivers of boxes) {
    if (!drivers.length) continue;
    // the box, and its image in each reflecting side: front, back, left, right as in ROOM_SURFACES
    const sides: { surface: number; at: (d: SceneDriver) => SceneDriver }[] = [
      { surface: 0, at: (d) => d },
      { surface: 1, at: (d) => ({ ...d, y: -d.y, yaw: Math.PI - d.yaw }) },
      { surface: 2, at: (d) => ({ ...d, y: 2 * L - d.y, yaw: Math.PI - d.yaw }) },
      { surface: 3, at: (d) => ({ ...d, x: -W - d.x, yaw: -d.yaw }) },
      { surface: 4, at: (d) => ({ ...d, x: W - d.x, yaw: -d.yaw }) },
    ];
    const images = sides.filter((im) => !im.surface || reflects(im.surface - 1));
    // the floor is a half-space: the box and each side's image has its mirror below the floor
    for (const im of images)
      for (const floor of [false, true]) {
        for (const d of drivers) {
          const at = im.at(d);
          sources.push(
            source(
              d,
              paths,
              floor ? { ...at, z: -at.z, pitch: -at.pitch } : at,
              reflIndex(im.surface, floor),
              floor,
            ),
          );
        }
        paths++;
      }
    // the ceiling's image, first order only
    if (reflects(4)) {
      for (const d of drivers)
        sources.push(
          source(d, paths, { ...d, z: 2 * H - d.z, pitch: -d.pitch }, reflIndex(5, false), false),
        );
      paths++;
    }
    // each stage face or top the box's drivers see; a floor stage's face also with the floor bounce (a riser's face
    // meets its stage's top, not the floor: once only)
    for (const [r, reflector] of reflectors.entries()) {
      const seen = drivers.filter((d) => seesReflector(reflector, d));
      if (!seen.length) continue;
      for (const floor of reflector.face && !reflector.base ? [false, true] : [false]) {
        for (const d of seen) {
          const at = stageImage(d, reflector);
          sources.push(
            source(
              d,
              paths,
              floor ? { ...at, z: -at.z, pitch: -at.pitch } : at,
              stageReflIndex(r, floor),
              floor,
              r,
            ),
          );
        }
        paths++;
      }
    }
    if (modes)
      for (const d of drivers)
        modalSources.push(modalSource(modes, d.voice, d.alignM, d.x + W / 2, d.y, d.z));
  }
  return {
    room,
    voices,
    sources,
    paths,
    modal: modes ? { modes, sources: modalSources, crossoverHz } : null,
    blocks,
    reflectors,
  };
}

/** The points either side of `f` in a curve that spans it, and how far `f` lies between them on log frequency. */
function bracket<P extends Pick<FrequencyPoint, "f">>(
  curve: readonly P[],
  f: number,
): [a: P, b: P, t: number] {
  let lo = 0,
    hi = curve.length - 1;
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (curve[m].f <= f) lo = m;
    else hi = m;
  }
  const a = curve[lo],
    b = curve[hi];
  return [a, b, b.f === a.f ? 0 : Math.log(f / a.f) / Math.log(b.f / a.f)];
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
  const [a, b, t] = bracket(curve, f);
  return a.spl + (b.spl - a.spl) * t;
}

/** A band's center, Hz, where its target is read (the one frequency for "one"). */
export const bandCenterHz = (band: CoverageBand, freqHz: number) =>
  band === "one" ? freqHz : Math.sqrt(COVERAGE_BANDS[band].lo * COVERAGE_BANDS[band].hi);

/** A band's frequency range, Hz (the one frequency for "one": `lo` = `hi`). */
export const bandRangeHz = (
  band: CoverageBand,
  freqHz: number,
): Pick<(typeof COVERAGE_BANDS)["sub"], "lo" | "hi"> =>
  band === "one" ? { lo: freqHz, hi: freqHz } : COVERAGE_BANDS[band];

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
 * Each voice's output at each frequency (`outputs`, from the frequency and its index in `freqs`), and the scene's room
 * at that frequency. `shares` is each frequency's share of the band average's weight (`coverageFrequencies`); every
 * frequency weighs 1 without it.
 */
export function sceneSlots(
  scene: CoverageScene,
  freqs: readonly number[],
  allCoherent: boolean,
  outputs: (f: number, i: number) => CoverageSlot["out"],
  shares?: readonly number[],
): CoverageSlot[] {
  const { room, modal, voices } = scene;
  // how many of each voice's drivers play: the boxes' own (not their images), for the reverberant field
  const count: Partial<Record<CoverageVoice["id"], number>> = {};
  for (const s of scene.sources) if (s.refl === 0) count[s.voice] = (count[s.voice] ?? 0) + 1;
  return freqs.map((f, i) => {
    const k = (2 * Math.PI * f) / C;
    const out = { ...outputs(f, i) },
      ka: CoverageSlot["ka"] = {},
      hornHalf: CoverageSlot["hornHalf"] = {};
    for (const { id, pattern } of voices)
      if (pattern.horn) {
        const { covH, covV, wIn, hIn } = pattern.horn;
        hornHalf[id] = waveguideHalfAngles(f, covH, covV, wIn, hIn);
      } else ka[id] = k * pattern.a;
    // a voice more than SILENT_DB under the loudest adds nothing the map can show: leave it out of the sums
    const loudest = Math.max(0, ...Object.values(out).map((v) => (v ? Math.hypot(v.re, v.im) : 0)));
    for (const { id } of voices) {
      const v = out[id];
      if (v && Math.hypot(v.re, v.im) < loudest * SILENT) delete out[id];
    }
    const shadow = 1 / Math.hypot(1, f / BOX_SHADOW_HZ);
    // what each kind of path keeps: its side or ceiling's reflection, times the floor's when it bounces off it too
    const floor = floorReflection(room, f),
      refl = new Float64Array(REFL_ROOM + 2 * scene.reflectors.length);
    for (let s = 0; s <= ROOM_SURFACES.length; s++) {
      const g = !s
        ? 1
        : room.outdoors
          ? 0
          : surfaceReflection(room.materials[ROOM_SURFACES[s - 1]], f);
      refl[reflIndex(s, false)] = g;
      refl[reflIndex(s, true)] = g * floor;
    }
    // a stage's face or top, outdoors too: its material, less where it is small against the wavelength
    const stageMaterial = surfaceReflection(STAGE_MATERIAL, f);
    for (const [r, { size }] of scene.reflectors.entries()) {
      const g = stageMaterial * sizeFade(f, size);
      refl[stageReflIndex(r, false)] = g;
      refl[stageReflIndex(r, true)] = g * floor;
    }
    // a stage's barrier loss fades by the same high-pass, squared, on its height above the floor
    const stageFade = new Float64Array(scene.blocks.length);
    for (const [b, { top }] of scene.blocks.entries()) stageFade[b] = sizeFade(f, top) ** 2;
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
        for (const { id } of voices) {
          const v = out[id],
            half = hornHalf[id];
          if (!v) continue;
          const q = half ? hornQ(half) : pistonQ(ka[id] ?? 0, shadow);
          diffuse +=
            ((count[id] ?? 0) * 16 * Math.PI * (v.re * v.re + v.im * v.im) * (1 - abs.alpha) ** 2) /
            (q * abs.area);
        }
      if (weight > 0) {
        // each driver's jωρQ: 4π × its free-field pressure at 1 m, its alignment delay taken off (see levelAtPoint)
        const u = new Float64Array(2 * modal.sources.length);
        for (const [j, s] of modal.sources.entries()) {
          const v = out[s.voice];
          if (!v) continue;
          const c = Math.cos(k * s.alignM),
            sn = Math.sin(k * s.alignM);
          u[2 * j] = 4 * Math.PI * (v.re * c - v.im * sn);
          u[2 * j + 1] = 4 * Math.PI * (v.re * sn + v.im * c);
        }
        // what each surface reflects, as the image sources have it (MODAL_SURFACES: the five sides, then the floor)
        const reflection = [...ROOM_SURFACES.map((_, s) => refl[reflIndex(s + 1, false)]), floor];
        ms = modalSlot(modal.modes, k, abs.t60, u, reflection, weight);
      }
    }
    return {
      f,
      share: shares?.[i] ?? 1,
      k,
      coherent: allCoherent || f < COHERENT_BELOW_HZ,
      out,
      ka,
      hornHalf,
      shadow,
      refl,
      stageFade,
      air: airDbPerM(f) * NEPER_PER_DB,
      diffuse,
      modal: ms,
    };
  });
}

/**
 * The frequencies a band averages, or the one frequency, each with its share of the average's weight, and whether
 * they all sum with phase. A band takes `BAND_POINTS` points, log-spaced from its bottom to its top, each weighing 1.
 * In a band view, a point below the top of the room's modal crossfade (`modalCrossoverHz`, null outdoors) splits into
 * M frequencies, log-spaced across the point's share of the band (a ratio of one point to the next, centered on the
 * point), each weighing 1/M of it: one point near a room mode then doesn't draw a lobe pattern of its own, and the
 * band's weight per point stays 1. The first and last points' shares would reach past the band's edges, so each share
 * is clamped to the band's range (the sub-points then space evenly across the clamped share, still weighing 1/M each,
 * and the point's total weight stays 1): no frequency falls below the band's bottom or above its top. M is `subpoints`,
 * else `MODAL_SUBPOINTS`, or `MODAL_SUBPOINTS_WHOLE_BAND` for a band that lies wholly below the top of the crossfade.
 * The one-frequency view never splits, and sums with phase only below `COHERENT_BELOW_HZ`. `points` (the quick pass's
 * fewer) takes the place of `BAND_POINTS`.
 */
export function coverageFrequencies(
  band: CoverageBand,
  freqHz: number,
  modalCrossoverHz: number | null = null,
  subpoints?: number,
  points = BAND_POINTS,
): { freqs: number[]; shares: number[]; coherent: boolean } {
  if (band === "one") return { freqs: [freqHz], shares: [1], coherent: freqHz < COHERENT_BELOW_HZ };
  const b = COVERAGE_BANDS[band];
  const modalTop = modalCrossoverHz === null ? 0 : modalTopHz(modalCrossoverHz);
  /** M, how many frequencies a point in the modal range splits into */
  const split = subpoints ?? (b.hi < modalTop ? MODAL_SUBPOINTS_WHOLE_BAND : MODAL_SUBPOINTS);
  /** the ratio of one band point to the next */
  const pointRatio = Math.pow(b.hi / b.lo, 1 / (points - 1));
  const freqs: number[] = [],
    shares: number[] = [];
  for (const f of logSpacedFrequencies(b.lo, b.hi, points)) {
    if (split > 1 && f < modalTop) {
      /** the point's share of the band, Hz: a ratio either side of it, clamped to the band's edges */
      const from = Math.max(b.lo, f / Math.sqrt(pointRatio)),
        to = Math.min(b.hi, f * Math.sqrt(pointRatio));
      for (let j = 0; j < split; j++) {
        freqs.push(from * Math.pow(to / from, (j + 0.5) / split));
        shares.push(1 / split);
      }
    } else {
      freqs.push(f);
      shares.push(1);
    }
  }
  return { freqs, shares, coherent: false };
}

// scratch space for the sum: per source geometry (GEO values each), per path pressure, the detour over the stages
const GEO = 14;
/** A detour's δk past which no slot's barrier takes anything off (N = δk/π at its bright-side end). */
const BRIGHT_DETOUR_K = BARRIER_BRIGHT_N * Math.PI;
let geo = new Float64Array(0),
  pre = new Float64Array(0),
  pim = new Float64Array(0);
const detour: Detour = { delta: -Infinity, stage: -1 };

/**
 * A stage image's reflection on the way to a point (`stageReflection`): where it lands (m), its first Fresnel zone's
 * scale (2π·d₁d₂/(d₁ + d₂): over k, the zone's radius squared), and how far inside its surface's edges it lands, m (a
 * face's two ends and its top edge; a top's outline, then Infinity twice).
 */
const hit = { x: 0, y: 0, z: 0, zone: 0, in1: Infinity, in2: Infinity, in3: Infinity };

/**
 * Where a stage image's path reflects on its face or top on the way to a point `dist` m from the image (`hit`): false
 * where that point is behind the face or under the top, where it lands under a face's base, or where it lands more
 * than a Fresnel zone (at the lowest wavenumber, `kMin`) past an edge. A face's floor-bounce image hits the face as high
 * as its line crosses the face's plane below the floor or above it.
 */
function stageReflection(
  s: SceneSource,
  r: StageReflector,
  block: StageBlock,
  px: number,
  py: number,
  pz: number,
  dist: number,
  kMin: number,
): boolean {
  let t: number;
  if (!r.face) {
    if (pz <= r.top) return false;
    t = (r.top - s.z) / (pz - s.z);
    hit.z = r.top;
  } else {
    const from = faceSide(r.face, s.x, s.y),
      to = faceSide(r.face, px, py);
    if (to <= 0) return false;
    t = from / (from - to);
    hit.z = Math.abs(s.z + (pz - s.z) * t);
    if (hit.z < r.base) return false;
  }
  hit.x = s.x + (px - s.x) * t;
  hit.y = s.y + (py - s.y) * t;
  // the legs to and from the reflection are t and 1 − t of the path
  hit.zone = 2 * Math.PI * t * (1 - t) * dist;
  const reach = fresnelRadius((2 * Math.PI) / kMin, t * dist, (1 - t) * dist);
  if (!r.face) {
    if (
      hit.x < block.x0 - reach ||
      hit.x > block.x1 + reach ||
      hit.y < block.y0 - reach ||
      hit.y > block.y1 + reach
    )
      return false;
    hit.in1 = outlineDepth(block, hit.x, hit.y);
    hit.in2 = hit.in3 = Infinity;
    return hit.in1 > -reach;
  }
  const along = (hit.x - r.face.ax) * r.face.ux + (hit.y - r.face.ay) * r.face.uy;
  hit.in1 = along;
  hit.in2 = r.face.len - along;
  hit.in3 = r.top - hit.z;
  return Math.min(hit.in1, hit.in2, hit.in3) > -reach;
}

/**
 * The longest detour a source's path to a point takes over the stages (`detour`): the straight line from a box's
 * driver, or from a room image (its last leg, above the floor) and, with a floor bounce, that line mirrored in the
 * floor (the leg before the bounce); a stage image's legs from its driver to the face and from the face on, past its
 * own stage. A wall's leg before it reflects isn't checked, nor a stage face's floor leg.
 */
function sourceDetour(
  scene: CoverageScene,
  s: SceneSource,
  reflects: boolean,
  px: number,
  py: number,
  pz: number,
) {
  const { blocks } = scene;
  detour.delta = -Infinity;
  detour.stage = -1;
  if (s.reflector < 0) {
    lineDetour(blocks, s.x, s.y, s.z, px, py, pz, -1, detour);
    if (s.floor) lineDetour(blocks, s.x, s.y, -s.z, px, py, -pz, -1, detour);
  } else if (reflects) {
    const own = scene.reflectors[s.reflector].stage;
    lineDetour(blocks, s.ox, s.oy, s.oz, hit.x, hit.y, hit.z, own, detour);
    lineDetour(blocks, hit.x, hit.y, hit.z, px, py, pz, own, detour);
  }
}

/**
 * Mean-square level at a point (meters, z above the floor) over the slots, dB SPL: at each slot the modal sum, or the
 * image sources and the diffuse field, or both in their crossfade (by power).
 */
export function levelAtPoint(
  scene: CoverageScene,
  slots: readonly CoverageSlot[],
  px: number,
  py: number,
  pz: number,
): number {
  const { sources, paths, modal, blocks, reflectors } = scene,
    n = sources.length,
    staged = blocks.length > 0;
  if (geo.length < GEO * n) geo = new Float64Array(GEO * n);
  if (pre.length < paths) {
    pre = new Float64Array(paths);
    pim = new Float64Array(paths);
  }
  let geoReady = false;
  /** the lowest wavenumber the images sum at: its Fresnel zones are the widest */
  let kMin = Infinity;
  for (const sl of slots)
    if (!(sl.modal && modal && sl.modal.weight >= 1)) kMin = Math.min(kMin, sl.k);
  let acc = 0,
    totalShare = 0;
  for (const sl of slots) {
    const w = sl.modal && modal ? sl.modal.weight : 0;
    totalShare += sl.share;
    // a band average: the slots' mean squares, each by its share (never the pressures across frequencies)
    if (w > 0 && sl.modal && modal)
      acc +=
        sl.share *
        w *
        modalPressure2(modal.modes, modal.sources, sl.modal, px + modal.modes.size[0] / 2, py, pz);
    if (w >= 1) continue;
    if (!geoReady) {
      // distance, angles off the source's axis (horizontal, vertical), sine of the total angle (a piston's pattern
      // stops at 90°), whether the point is behind the box, whether the path is there (a stage image's reflection on
      // or near its face), its detour over the stages (and which), and a stage image's Fresnel zone scale and how far
      // inside its surface's edges it reflects. The point in the source's own frame: forward along its axis (its yaw,
      // then its pitch), right, and up.
      for (let i = 0; i < n; i++) {
        const s = sources[i],
          g = GEO * i;
        const dx = px - s.x,
          dy = py - s.y,
          dz = pz - s.z,
          r = Math.hypot(dx, dy, dz);
        geo[g + 5] = 1;
        geo[g + 6] = -Infinity;
        if (staged) {
          const reflector = s.reflector < 0 ? null : reflectors[s.reflector],
            reflects =
              !!reflector &&
              stageReflection(s, reflector, blocks[reflector.stage], px, py, pz, r, kMin);
          if (reflector && !reflects) {
            geo[g + 5] = 0;
            continue;
          }
          sourceDetour(scene, s, reflects, px, py, pz);
          // none at any slot: well on the bright side at the lowest wavenumber; all at the cap from it up
          geo[g + 6] = detour.delta * kMin > BRIGHT_DETOUR_K ? detour.delta : -Infinity;
          geo[g + 7] = detour.stage;
          geo[g + 13] = barrierCapped((detour.delta * kMin) / Math.PI) ? 1 : 0;
          if (reflects) {
            geo[g + 8] = hit.zone;
            geo[g + 9] = hit.in1;
            geo[g + 10] = hit.in2;
            geo[g + 11] = hit.in3;
            geo[g + 12] = Math.min(hit.in1, hit.in2, hit.in3);
          }
        }
        const ahead = dx * s.sy + dy * s.cy,
          fwd = ahead * s.cp + dz * s.sp,
          right = dx * s.cy - dy * s.sy,
          up = dz * s.cp - ahead * s.sp,
          th = Math.atan2(right, fwd),
          tv = Math.atan2(up, Math.hypot(fwd, right)),
          c = r > 0 ? fwd / r : 1;
        geo[g] = Math.max(0.3, r);
        geo[g + 1] = th;
        geo[g + 2] = tv;
        geo[g + 3] = c <= 0 ? 1 : Math.sqrt(Math.max(0, 1 - c * c));
        geo[g + 4] = fwd < 0 ? 1 : 0;
      }
      geoReady = true;
    }
    pre.fill(0, 0, paths);
    pim.fill(0, 0, paths);
    for (let i = 0; i < n; i++) {
      const s = sources[i],
        v = sl.out[s.voice],
        g = GEO * i;
      let gain = sl.refl[s.refl];
      if (!v || !gain || !geo[g + 5]) continue;
      // a stage image fades out across its surface's edges, over the first Fresnel zone (nearer than one zone's
      // radius to an edge: m·|m| < radius²)
      const nearest = geo[g + 12];
      if (s.reflector >= 0 && nearest * Math.abs(nearest) < geo[g + 8] / sl.k) {
        const zone = Math.sqrt(geo[g + 8] / sl.k);
        gain *=
          edgeFade(geo[g + 9], zone) * edgeFade(geo[g + 10], zone) * edgeFade(geo[g + 11], zone);
        if (!gain) continue;
      }
      const r = geo[g];
      // what the air takes off, and a stage in the way: its barrier loss at this path's Fresnel number, N = 2δ/λ = δk/π
      // (nepers)
      let loss = sl.air * r;
      const detourK = geo[g + 6] * sl.k;
      if (detourK > BRIGHT_DETOUR_K)
        loss +=
          sl.stageFade[geo[g + 7]] *
          (geo[g + 13] ? BARRIER_CAP_NEPERS : barrierNepers(detourK / Math.PI));
      const half = s.horn ? sl.hornHalf[s.voice] : undefined;
      let d: number;
      if (half) d = waveguideGain(geo[g + 1], geo[g + 2], half);
      else {
        d = pistonPattern((sl.ka[s.voice] ?? 0) * geo[g + 3]);
        if (geo[g + 4]) d *= sl.shadow;
      }
      const mag = (d * gain * Math.exp(-loss)) / r,
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
    acc += sl.share * (1 - w) * ms;
  }
  return 10 * Math.log10(Math.max(1e-12, acc / Math.max(1, totalShare)));
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

/** The response at a spot on the floor (feet): the level of each slot alone (slots at RESPONSE_FREQS, as a band sums). */
export const slotResponse = (
  scene: CoverageScene,
  slots: readonly CoverageSlot[],
  at: FloorPoint,
  earFt: number,
): FrequencyPoint[] =>
  slots.map((sl) => ({
    f: sl.f,
    spl: levelAtPoint(scene, [sl], at.x * FT, at.y * FT, earFt * FT),
  }));

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

/** The grid's levels over the audience's floor: every cell but those right in front of a box, dB. */
function audienceLevels(
  grid: CoverageGrid,
  room: Pick<CoverageRoom, "widthFt" | "lengthFt">,
  boxes: readonly FloorPoint[],
): number[] {
  const { cols, rows, db } = grid;
  const vals: number[] = [];
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cols; i++) {
      const x = -room.widthFt / 2 + ((i + 0.5) * room.widthFt) / cols,
        y = ((j + 0.5) * room.lengthFt) / rows;
      if (boxes.some((b) => Math.hypot(x - b.x, y - b.y) < STATS_CLEARANCE_FT)) continue;
      vals.push(db[j * cols + i]);
    }
  return vals;
}

/**
 * The audience's average level: the mean of the grid's levels in dB over the floor `coverageStats` counts (null when
 * no cell is left).
 */
export function audienceAverage(
  grid: CoverageGrid,
  room: Pick<CoverageRoom, "widthFt" | "lengthFt">,
  boxes: readonly FloorPoint[],
): number | null {
  const vals = audienceLevels(grid, room, boxes);
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

/** How far out from a stack's front its "1 m" level is read, ft. */
export const ONE_METER_FT = 1 / FT;

/**
 * Where a stack's 1 m level is read: 1 m out from the middle of its front along its aim, kept just inside the room.
 * Feet.
 */
export function oneMeterSpot(
  box: FloorPlacement,
  footprint: CoverageStack["footprint"],
  room: Pick<CoverageRoom, "widthFt" | "lengthFt">,
): FloorPoint {
  const a = (box.aim * Math.PI) / 180,
    r = footprint.d / 24 + ONE_METER_FT,
    edge = 0.25;
  return {
    x: Math.max(
      -room.widthFt / 2 + edge,
      Math.min(room.widthFt / 2 - edge, box.x + Math.sin(a) * r),
    ),
    y: Math.max(edge, Math.min(room.lengthFt - edge, box.y + Math.cos(a) * r)),
  };
}

/** How much of the floor reaches the target, leaving out the space right in front of each box. */
export function coverageStats(
  grid: CoverageGrid,
  room: Pick<CoverageRoom, "widthFt" | "lengthFt">,
  boxes: readonly FloorPoint[],
  target: number,
): CoverageStats {
  const vals = audienceLevels(grid, room, boxes).map((v) => v - target);
  if (!vals.length) return { within3: 0, within6: 0, spread: 0 };
  vals.sort((a, b) => a - b);
  const share = (t: number) => vals.filter((v) => v >= t).length / vals.length;
  return {
    within3: share(-3),
    within6: share(COVERAGE_EDGE_DB),
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
