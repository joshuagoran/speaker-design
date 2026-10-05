// The PA sub's round port tubes (`round1`, `round2`, `round4`): where they sit on the baffle, how they fold to fit
// (the shared rule in lib/tubeFold), and their end correction. The model, the chips, the optimizers, the cutlist and the
// 3D view all take the tubes from here, so they agree.
import type { Dims3, PortStyle, SubDriver, VentSpec } from "../../types";
import { SUB_DEPTH_FALLBACK_IN, SUB_FRAME_DIA_IN } from "../../data/catalog/driver-cutouts";
import { TUBE_FLARE_RADIUS_IN, TUBE_WALL_END } from "../../data/acoustics/tube-ends";
import { PORT_ELBOWS, PORT_PIPES } from "../../data/catalog/port-tubes";
import { SHARP_BEND_CORRECTION } from "../../data/acoustics/slot-inner-end";
import {
  tubeElbows,
  tubeLegs,
  tubeSpan,
  ELBOW_COUNTS,
  type ElbowCount,
  type TubeLegs,
  type TubeRoom,
} from "../tubeFold";

/** What the tubes read of the sub driver: its size class and, where the datasheet gives it, its mounting depth. */
export type TubeDriver = Pick<SubDriver, "size" | "depthIn">;
/** The tube fields a layout reads. */
export type TubeVent = Pick<VentSpec, "nt" | "dia" | "len">;

/** The baffle's front, inches behind the frame's (the inset ventGeometry's side ducts and the tubes are measured from). */
export const TUBE_BAFFLE_INSET_IN = 0.75;
// Clear baffle between a tube's flare and the walls' inside faces (the 3/4" baffle cleats behind are cleared by the
// pipe's own wall and this), and between two flares or a flare and the driver's frame.
const EDGE_IN = 0.25;
const GAP_IN = 0.5;

/** The driver's mounting depth, inches: its datasheet's, else its size class's fallback. */
export const subDriverDepthIn = (d: TubeDriver) => d.depthIn ?? SUB_DEPTH_FALLBACK_IN[d.size];

/** A point on the baffle, inches: across from its centre line, and up from the inside face of the floor. */
export interface BafflePoint {
  x: number;
  y: number;
}
/**
 * The tubes on the baffle: each tube's axis, the driver's centre and frame radius, and whether every flare clears the
 * walls, the other flares and the driver's frame.
 */
export interface TubeLayout {
  tubes: BafflePoint[];
  driver: BafflePoint & { r: number };
  fits: boolean;
}

/**
 * Where the driver sits on a round-tube sub's baffle: in the middle for the corner tubes (`round4`), else high, a
 * square's width under the lid or an inch over its frame, whichever is lower, so the tubes have the bottom.
 */
export function tubeDriverOnBaffle(
  box: Pick<Dims3, "w" | "h">,
  style: PortStyle,
  t: number,
  size: TubeDriver["size"],
): TubeLayout["driver"] {
  const iw = box.w - 2 * t,
    ih = box.h - 2 * t,
    r = SUB_FRAME_DIA_IN[size] / 2;
  return { x: 0, y: style === "round4" ? ih / 2 : ih - Math.min(iw / 2, r + 1), r };
}

/**
 * The tubes on the baffle. `round4` puts them in the corners round a centred driver (at most four); the others put
 * them in one row along the bottom under the driver, spread evenly from one side wall to the other (one tube in the
 * middle), so they sit as far out from under the driver as they can. A flare is the tube's radius plus
 * TUBE_FLARE_RADIUS_IN.
 */
export function tubeLayout(
  box: Pick<Dims3, "w" | "h">,
  style: PortStyle,
  v: Pick<VentSpec, "nt" | "dia">,
  t: number,
  size: TubeDriver["size"],
): TubeLayout {
  const iw = box.w - 2 * t,
    ih = box.h - 2 * t;
  const rf = v.dia / 2 + TUBE_FLARE_RADIUS_IN;
  const driver = tubeDriverOnBaffle(box, style, t, size);
  const n = Math.max(0, Math.round(v.nt));
  let tubes: BafflePoint[];
  if (style === "round4") {
    const ox = iw / 2 - rf - EDGE_IN,
      oy = ih / 2 - rf - EDGE_IN;
    tubes = [
      { x: -ox, y: ih / 2 - oy },
      { x: ox, y: ih / 2 - oy },
      { x: -ox, y: ih / 2 + oy },
      { x: ox, y: ih / 2 + oy },
    ].slice(0, n);
  } else {
    const span = iw / 2 - EDGE_IN - rf,
      y = rf + EDGE_IN;
    tubes = Array.from({ length: n }, (_, i) => ({
      x: n > 1 ? -span + (2 * span * i) / (n - 1) : 0,
      y,
    }));
  }
  const inside = (p: BafflePoint) =>
    Math.abs(p.x) + rf <= iw / 2 - EDGE_IN + 1e-9 &&
    p.y - rf >= EDGE_IN - 1e-9 &&
    p.y + rf <= ih - EDGE_IN + 1e-9;
  const clear = (a: BafflePoint, b: BafflePoint, d: number) =>
    Math.hypot(a.x - b.x, a.y - b.y) >= d - 1e-9;
  const fits =
    tubes.length === n &&
    tubes.every(
      (p, i) =>
        inside(p) &&
        clear(p, driver, driver.r + rf + GAP_IN) &&
        tubes.every((q, j) => j <= i || clear(p, q, 2 * rf + GAP_IN)),
    );
  return { tubes, driver, fits };
}

/**
 * The room a tube's centreline has, from the baffle front to the back wall and from the tube's axis up to the lid, with
 * the driver's back as the stop. Every tube of a row sits at one height, so one room serves them all.
 */
export function tubeRoom(
  box: Dims3,
  style: PortStyle,
  v: Pick<VentSpec, "nt" | "dia">,
  t: number,
  drv: TubeDriver,
): TubeRoom {
  const { tubes } = tubeLayout(box, style, v, t, drv.size);
  const y = tubes.length ? Math.max(...tubes.map((p) => p.y)) : v.dia / 2;
  return {
    run: box.d - TUBE_BAFFLE_INSET_IN - t,
    rise: box.h - 2 * t - y,
    stop: subDriverDepthIn(drv),
  };
}

/**
 * The lengths a sub's tubes fit with `e` elbows, or null. The corner tubes (`round4`) only run straight: two of them sit
 * over the other two, so neither pair has a clear back wall to rise up.
 */
export function subTubeSpan(
  box: Dims3,
  style: PortStyle,
  v: Pick<VentSpec, "nt" | "dia">,
  t: number,
  drv: TubeDriver,
  e: ElbowCount,
) {
  if (style === "round4" && e > 0) return null;
  return tubeSpan(tubeRoom(box, style, v, t, drv), v.dia, e);
}

/** The elbows a sub's tubes take at their length: the fewest that fit, or null when none does. */
export function subTubeElbows(
  box: Dims3,
  style: PortStyle,
  v: TubeVent,
  t: number,
  drv: TubeDriver,
): ElbowCount | null {
  const e = tubeElbows(tubeRoom(box, style, v, t, drv), v.dia, v.len);
  return style === "round4" && e !== 0 ? null : e;
}

/**
 * The elbows the model takes: the fitting count, else (a length that fits no count) the fewest whose longest reaches
 * it, else the most any span takes, so a design that won't build still models as the nearest one that would.
 */
export function modelTubeElbows(
  box: Dims3,
  style: PortStyle,
  v: TubeVent,
  t: number,
  drv: TubeDriver,
): ElbowCount {
  const fit = subTubeElbows(box, style, v, t, drv);
  if (fit !== null) return fit;
  const counts = ELBOW_COUNTS.filter((e) => subTubeSpan(box, style, v, t, drv, e) !== null);
  const reach = counts.find((e) => v.len <= (subTubeSpan(box, style, v, t, drv, e)?.[1] ?? 0));
  return reach ?? counts.at(-1) ?? 0;
}

/** The tubes' legs as built with `e` elbows. */
export const subTubeLegs = (
  box: Dims3,
  style: PortStyle,
  v: TubeVent,
  t: number,
  drv: TubeDriver,
  e: ElbowCount,
): TubeLegs => tubeLegs(tubeRoom(box, style, v, t, drv), v.dia, v.len, e);

/**
 * The extra inner end correction of a tube mouth `gap` from a wall (inches, tube radius `r`): TUBE_WALL_END's solve,
 * falling as a power of the gap through its two points.
 */
export function tubeWallEndCorrection(r: number, gap: number) {
  const [g0, g1] = TUBE_WALL_END.gapOverR,
    [e0, e1] = TUBE_WALL_END.ecOverR;
  const p = Math.log(e0 / e1) / Math.log(g1 / g0);
  const x = Math.max(g0, gap / r);
  return e0 * Math.pow(g0 / x, p) * r;
}

// A quarter-round flare of radius b on a tube of radius r, from the throat to the mouth: as a length of the tube, its air
// is the integral of (r / a)² over its run (a the flare's radius there), short of its run b, and the mouth it radiates
// from is r + b wide, whose end correction in the tube's terms is (r / (r + b))² of its own. Memoised by radius.
const flareCache = new Map<number, number>();
function flareShortfall(r: number) {
  const hit = flareCache.get(r);
  if (hit !== undefined) return hit;
  const b = TUBE_FLARE_RADIUS_IN,
    N = 64;
  // z = b sin θ along the flare (θ from the throat), so a = r + b (1 − cos θ) and dz = b cos θ dθ; Simpson's rule
  let s = 0;
  for (let i = 0; i <= N; i++) {
    const th = (i / N) * (Math.PI / 2);
    const f = (b * Math.cos(th) * r * r) / (r + b * (1 - Math.cos(th))) ** 2;
    s += f * (i === 0 || i === N ? 1 : i % 2 ? 4 : 2);
  }
  const v = b - (s * (Math.PI / 2)) / N / 3;
  if (flareCache.size > 1000) flareCache.clear();
  flareCache.set(r, v);
  return v;
}

/**
 * A sub's round tubes' end correction, inches per tube, both ends: a flanged outer end (0.85 r) and a free inner end
 * (0.61 r), each less its flare's shortfall; a wall facing the inner mouth (TUBE_WALL_END); the neighbouring tubes'
 * mouths, each adding r² / 2s on the baffle and r² / 4s in the box (s the distance between the axes; a point source's
 * pressure over a half space and over a whole one), averaged over the tubes; and SHARP_BEND_CORRECTION diameters per
 * elbow. The elbows are the fitting count unless `elbows` says otherwise.
 */
export function subTubeEndCorrection(
  box: Dims3,
  style: PortStyle,
  v: TubeVent,
  t: number,
  drv: TubeDriver,
  elbows: ElbowCount = modelTubeElbows(box, style, v, t, drv),
) {
  const r = v.dia / 2,
    R = r + TUBE_FLARE_RADIUS_IN;
  const flare = flareShortfall(r);
  const outer = 0.85 * r * (r / R) - flare,
    inner = 0.61 * r * (r / R) - flare;
  const legs = subTubeLegs(box, style, v, t, drv, elbows);
  const wall = tubeWallEndCorrection(r, Math.max(legs.gap, 1e-9));
  const { tubes } = tubeLayout(box, style, v, t, drv.size);
  let near = 0;
  for (const p of tubes)
    for (const q of tubes) if (p !== q) near += 1 / Math.hypot(p.x - q.x, p.y - q.y);
  const mutual = tubes.length ? ((r * r) / tubes.length) * near * (1 / 2 + 1 / 4) : 0;
  return outer + inner + wall + mutual + elbows * SHARP_BEND_CORRECTION * v.dia;
}

/**
 * What a sub's tubes take to build (one sub): the stock pipe and elbow for their size (null where the catalogue has
 * none), the elbows each tube takes, the pipe sticks the tubes are cut from, and the price, or null where a part has no
 * US price.
 */
export function subTubeKit(box: Dims3, style: PortStyle, v: TubeVent, t: number, drv: TubeDriver) {
  const pipe = PORT_PIPES.find((p) => p.dia === v.dia) ?? null,
    elbow = PORT_ELBOWS.find((p) => p.dia === v.dia) ?? null;
  const elbows = modelTubeElbows(box, style, v, t, drv);
  const sticks = pipe ? Math.ceil((v.nt * v.len) / (pipe.stickFt * 12) - 1e-9) : 0;
  const elbowPrice = elbows ? (elbow?.price ?? null) : 0;
  const price =
    pipe && elbowPrice !== null ? sticks * pipe.price + v.nt * elbows * elbowPrice : null;
  return { pipe, elbow, elbows, sticks, price };
}
