// Room acoustics for the coverage map: what the walls, ceiling, floor, crowd and air absorb, and the numbers the
// room's modes and its reverberant field follow from (Sabine's reverberation time, the Schroeder frequency).
import { METERS_PER_FOOT as FT } from "../../constants/units";
import { FLOOR_ALPHA, OCTAVE_HZ, ROOM_MATERIALS } from "../../data/acoustics/materials";
import { AIR_DB_PER_M, AIR_HZ } from "../../data/acoustics/air-absorption";
import type { CoverageRoom, FloorCrowd, OctaveRow, RoomMaterial, RoomSurface } from "../../types";

/** The materials in the order the pickers list them. */
export const ROOM_MATERIAL_OPTIONS: readonly { id: RoomMaterial; name: string }[] = (
  ["concrete", "drywall", "wood", "glass", "curtain", "open"] as const
).map((id) => ({ id, name: ROOM_MATERIALS[id].name }));

/** The surfaces the room's materials are set for, in the order the image sources take them. */
export const ROOM_SURFACES = [
  "front",
  "back",
  "left",
  "right",
  "ceiling",
] as const satisfies readonly RoomSurface[];

/** An octave-band row's value at `f`, interpolated on log frequency and held flat past the ends. */
export function octaveValueAt(row: OctaveRow, f: number): number {
  const t = Math.log2(f / OCTAVE_HZ[0]);
  if (t <= 0) return row[0];
  if (t >= row.length - 1) return row[row.length - 1];
  const i = Math.floor(t);
  return row[i] + (row[i + 1] - row[i]) * (t - i);
}

/** A material's absorption coefficient at `f`. */
export const materialAlpha = (m: RoomMaterial, f: number) =>
  octaveValueAt(ROOM_MATERIALS[m].alpha, f);

/** The floor's absorption coefficient at `f`, empty or full. */
export const floorAlpha = (crowd: FloorCrowd, f: number) => octaveValueAt(FLOOR_ALPHA[crowd], f);

/** The pressure a surface reflects at `f`: √(1 − α). */
export const surfaceReflection = (m: RoomMaterial, f: number) =>
  Math.sqrt(Math.max(0, 1 - materialAlpha(m, f)));

/** Air absorption at `f`, dB per meter: the ISO 9613-1 table (data/acoustics) interpolated on log-log axes, its end segments carried on. */
export function airDbPerM(f: number): number {
  const n = AIR_HZ.length;
  let i = 0;
  while (i < n - 2 && f > AIR_HZ[i + 1]) i++;
  const t = Math.log(f / AIR_HZ[i]) / Math.log(AIR_HZ[i + 1] / AIR_HZ[i]);
  return Math.exp(
    Math.log(AIR_DB_PER_M[i]) + t * (Math.log(AIR_DB_PER_M[i + 1]) - Math.log(AIR_DB_PER_M[i])),
  );
}

/** pressure the floor reflects: a hard floor indoors, ground outdoors */
export const FLOOR_REFLECTION = { indoors: 0.95, outdoors: 0.85 };
/**
 * A full dance floor's floor bounce against an empty one's: unchanged below 200 Hz, where a person is small against
 * the wavelength (1.7 m and up), falling on log frequency to 0.3 at 1 kHz and above, where the audience row absorbs
 * about 90 % (√(1 − 0.9) ≈ 0.3).
 */
export const CROWD_BOUNCE = { loHz: 200, hiHz: 1000, hi: 0.3 };

/** The pressure the floor reflects at `f`, by the ground and the crowd on it. */
export function floorReflection(room: Pick<CoverageRoom, "outdoors" | "crowd">, f: number) {
  const base = room.outdoors ? FLOOR_REFLECTION.outdoors : FLOOR_REFLECTION.indoors;
  if (room.crowd === "empty" || f <= CROWD_BOUNCE.loHz) return base;
  if (f >= CROWD_BOUNCE.hiHz) return base * CROWD_BOUNCE.hi;
  const t = Math.log(f / CROWD_BOUNCE.loHz) / Math.log(CROWD_BOUNCE.hiHz / CROWD_BOUNCE.loHz);
  return base * (1 + (CROWD_BOUNCE.hi - 1) * t);
}

/** The room's size in meters: across (x), down the room (y), up (z). */
export const roomSizeM = (
  room: Pick<CoverageRoom, "widthFt" | "lengthFt" | "ceilingFt">,
): [x: number, y: number, z: number] => [
  room.widthFt * FT,
  room.lengthFt * FT,
  room.ceilingFt * FT,
];

/** What the room absorbs at one frequency, and how long it rings. */
export interface RoomAbsorption {
  /** total absorption, m² (Sabine): every surface's area × its coefficient, plus the air's 4mV */
  area: number;
  /** the surfaces' mean absorption coefficient, area-weighted */
  alpha: number;
  /** Sabine's reverberation time, s */
  t60: number;
  volume: number;
}

/** The room's absorption at `f`: its six surfaces (an open side absorbs everything) and the air. */
export function roomAbsorption(
  room: Pick<CoverageRoom, "widthFt" | "lengthFt" | "ceilingFt" | "materials" | "crowd">,
  f: number,
): RoomAbsorption {
  const [w, l, h] = roomSizeM(room),
    m = room.materials;
  const sides: [number, number][] = [
    [w * h, materialAlpha(m.front, f)],
    [w * h, materialAlpha(m.back, f)],
    [l * h, materialAlpha(m.left, f)],
    [l * h, materialAlpha(m.right, f)],
    [w * l, materialAlpha(m.ceiling, f)],
    [w * l, floorAlpha(room.crowd, f)],
  ];
  const surface = sides.reduce((s, [a]) => s + a, 0),
    absorbed = sides.reduce((s, [a, alpha]) => s + a * alpha, 0),
    volume = w * l * h;
  // the air's power attenuation per meter, m = dB/m ÷ 10·log10(e)
  const area = absorbed + (4 * volume * airDbPerM(f)) / (10 * Math.LOG10E);
  return { area, alpha: absorbed / surface, t60: (0.161 * volume) / area, volume };
}

/** The Schroeder frequency, Hz, 2000·√(T60 / V): above it the room's modes overlap and its field is statistical. */
export const schroederHz = (t60: number, volume: number) => 2000 * Math.sqrt(t60 / volume);

/** Where the map hands over from the modal sum to the image sources, Hz: twice the Schroeder frequency, 80–200 Hz. */
export const MODAL_HZ: [lo: number, hi: number] = [80, 200];
/** The handover is a crossfade (in power) this many octaves wide, centered on the crossover. */
export const MODAL_FADE_OCT = 0.5;

/**
 * The crossover from the modal sum to the image sources for an indoor room, Hz. The Schroeder frequency is taken at
 * 125 Hz's reverberation time (the transition sits in that octave for any room this map covers); twice it is the
 * usual safe margin, held to 80–200 Hz so small or very live rooms don't push the modal sum into the mids and large
 * dead ones still get their lowest modes.
 */
export function modalCrossoverHz(
  room: Pick<CoverageRoom, "widthFt" | "lengthFt" | "ceilingFt" | "materials" | "crowd">,
): number {
  const { t60, volume } = roomAbsorption(room, OCTAVE_HZ[0]);
  return Math.max(MODAL_HZ[0], Math.min(MODAL_HZ[1], 2 * schroederHz(t60, volume)));
}

/** The highest frequency the modal sum is evaluated at for a crossover: the top of the fade. */
export const modalTopHz = (crossoverHz: number) => crossoverHz * Math.pow(2, MODAL_FADE_OCT / 2);

/** The modal sum's share of the level (power) at `f`: 1 below the fade, 0 above it, a raised cosine in log f across it. */
export function modalWeight(f: number, crossoverHz: number): number {
  const t = Math.log2(f / crossoverHz) / MODAL_FADE_OCT + 0.5;
  if (t <= 0) return 1;
  if (t >= 1) return 0;
  return 0.5 + 0.5 * Math.cos(Math.PI * t);
}
