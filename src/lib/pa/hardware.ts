// The PA boxes' hardware from presets: two recessed handles at the box's center of gravity (one each side, moved by the
// offsets), the input dish with its two Speakons low on the back, centered, and on the mid (top) box the horn's binding
// posts on the lid. Each part's recess takes room inside the box (its liters come off the net volume) and must stay
// clear of the driver, the vent, the other parts and the panels' edges and joints. The parts are placed first and the
// braces and ribs after them, around their recesses (lib/bracing keeps out of hardwareKeepOut), so a brace or rib in a
// part's way is a fault the check still reports, not a reason to move the part.
import type {
  BoxBracing,
  BoxHandles,
  BoxHardwarePlan,
  BoxKeepOut,
  BoxRegion,
  CabinetPart,
  CogMass,
  Dims3,
  HandleChoice,
  HardwareBoxId,
  HardwareKind,
  HardwareObstacle,
  HardwarePanel,
  PaHardware,
  PaLayout,
  PlacedHardware,
} from "../../types";
import { HANDLES, HORN_POSTS, INPUT_JACK, INPUT_PLATE } from "../../data/catalog/cabinet-hardware";
import { HANDLE_OFFSET_SLIDER, NO_HANDLES } from "../../constants/hardware";
import { PLYWOOD_MATERIAL } from "../../constants/panelSizes";
import { panelLbPerSqFt } from "../panel";
import { bracingRegions } from "../bracing";

/** Cubic inches to liters. */
const IN3_TO_L = 16.387 / 1000;
/** The baffle's ply, in (3/4″ whatever the walls, as everywhere in the PA boxes). */
const BAFFLE_IN = 0.75;
/** The baffle's weight, lb/ft² (3/4″ ply, as the box weights take it). */
const BAFFLE_LB_PER_SQFT = 2.3;
/**
 * How far a cutout stays in from each inside edge of its panel, in: the joints, the back's rabbet and the baffle's
 * 3/4″ cleats take that strip.
 */
export const HARDWARE_EDGE_CLEAR_IN = 0.75;
/** How far a flange stays in from the panel's outside edges, in: the 1/4″ roundovers. */
export const HARDWARE_FLANGE_EDGE_IN = 0.25;
/**
 * The least room a part takes behind its panel for the fit check, in: its hole goes through, so a brace or rib glued
 * over it blocks it even where the recess is shallower than the wall.
 */
const FIT_MIN_DEPTH_IN = 0.1;
/**
 * The depth the fit check takes for the horn's binding-post cup, in from the lid's outside face: Parts Express doesn't
 * list it (the catalog keeps it null, so its recess counts no volume), and a cup reaching an inch down is the
 * conservative guess that still lets a brace or the mid's magnet under the lid show up as a clash.
 */
export const HORN_POSTS_FIT_DEPTH_IN = 1;
/** The step the presets move a part by while they look for a clear place, in. */
const SCAN_STEP_IN = 0.25;
/** Share of a driver's mounting depth behind the baffle's front where its weight sits (the magnet is at the back). */
const DRIVER_MASS_DEPTH_SHARE = 0.5;

/** Each box's handles on first load and in saves from before the setting: the 30769 at the center of gravity. */
export const DEFAULT_HARDWARE: PaHardware = {
  sub: { model: "30769", upIn: 0, backIn: 0 },
  mid: { model: "30769", upIn: 0, backIn: 0 },
};

/** The handle choices in the settings' order: none, then the catalog's. */
export const HANDLE_CHOICES: readonly HandleChoice[] = [NO_HANDLES, ...HANDLES.map((h) => h.id)];
/** A handle model's part; null for no handles. */
export const handlePart = (id: HandleChoice): CabinetPart | null =>
  HANDLES.find((h) => h.id === id) ?? null;
const isHandleChoice = (x: unknown): x is HandleChoice => HANDLE_CHOICES.some((c) => c === x);
const offset = (x: unknown) =>
  typeof x === "number" && Number.isFinite(x)
    ? Math.min(HANDLE_OFFSET_SLIDER.max, Math.max(HANDLE_OFFSET_SLIDER.min, x))
    : 0;
const savedBox = (x: unknown, fallback: BoxHandles): BoxHandles => {
  if (typeof x !== "object" || x === null) return fallback;
  const model = Reflect.get(x, "model");
  return {
    model: isHandleChoice(model) ? model : fallback.model,
    upIn: offset(Reflect.get(x, "upIn")),
    backIn: offset(Reflect.get(x, "backIn")),
  };
};
/** A saved design's hardware: each box's handles where they read right, else the defaults (older saves have none). */
export function savedHardware(x: unknown): PaHardware {
  if (typeof x !== "object" || x === null) return DEFAULT_HARDWARE;
  return {
    sub: savedBox(Reflect.get(x, "sub"), DEFAULT_HARDWARE.sub),
    mid: savedBox(Reflect.get(x, "mid"), DEFAULT_HARDWARE.mid),
  };
}

/** Whether a box has hardware of its own: the tower's mid chamber is part of the sub's cabinet. */
export const boxTakesHardware = (box: HardwareBoxId, layout: PaLayout | undefined) =>
  box === "sub" || layout !== "tower";

/**
 * A listed size (a part's cutout or flange) as it is mounted: `across` the panel (front to back on a side, left to right
 * on the back and the lid) and `up` it (front to back on the lid), by the part's `upright`.
 */
export const mountedSize = (s: { w: number; h: number }, part: Pick<CabinetPart, "upright">) =>
  part.upright === "w" ? { across: s.h, up: s.w } : { across: s.w, up: s.h };
/** A part's cutout as mounted (mountedSize); none for a part that mounts in another. */
export const mountedCutout = (part: CabinetPart) =>
  part.cutout ? mountedSize(part.cutout, part) : null;
/** A part's flange as mounted; its cutout where no flange is listed. */
export const mountedFlange = (part: CabinetPart) =>
  part.flange ? mountedSize(part.flange, part) : mountedCutout(part);

/** The liters a part's recess takes inside a box with walls `t` thick: its cutout over the depth past the wall. */
export const partRecessLiters = (part: CabinetPart, t: number) =>
  part.cutout && part.depthIn !== null
    ? part.cutout.w * part.cutout.h * Math.max(0, part.depthIn - t) * IN3_TO_L
    : 0;

/** The parts a box is fitted with, each with its count: handles (two), the dish and its two jacks, the mid's posts. */
export function hardwareBought(
  hw: PaHardware,
  box: HardwareBoxId,
  layout: PaLayout | undefined,
): BoxHardwarePlan["bought"] {
  return boxTakesHardware(box, layout) ? boughtWith(box, handlePart(hw[box].model)) : [];
}
/** A box's parts with its handle model (null: none). */
function boughtWith(box: HardwareBoxId, handle: CabinetPart | null): BoxHardwarePlan["bought"] {
  return [
    ...(handle ? [{ part: handle, qty: 2 }] : []),
    { part: INPUT_PLATE, qty: 1 },
    { part: INPUT_JACK, qty: 2 },
    ...(box === "mid" ? [{ part: HORN_POSTS, qty: 1 }] : []),
  ];
}
/** The liters a box's recesses take (none for a box without hardware, or with no `hw`). */
export const hardwareLiters = (
  hw: PaHardware | undefined,
  box: HardwareBoxId,
  t: number,
  layout: PaLayout | undefined,
) =>
  hw
    ? hardwareBought(hw, box, layout).reduce((a, b) => a + b.qty * partRecessLiters(b.part, t), 0)
    : 0;
/** A box's hardware weight, lb (a part with no listed weight counts none). */
export const hardwareLb = (
  hw: PaHardware | undefined,
  box: HardwareBoxId,
  layout: PaLayout | undefined,
) => (hw ? hardwareBought(hw, box, layout).reduce((a, b) => a + b.qty * (b.part.lb ?? 0), 0) : 0);
/** A box's hardware price, $. */
export const hardwarePrice = (
  hw: PaHardware | undefined,
  box: HardwareBoxId,
  layout: PaLayout | undefined,
) => (hw ? hardwareBought(hw, box, layout).reduce((a, b) => a + b.qty * b.part.price, 0) : 0);

/** The driver as the center of gravity reads it: its center on the baffle (box axes), weight (lb) and mounting depth (in). */
export interface HardwareDriver {
  center: { x: number; y: number };
  lb: number;
  depthIn: number;
}
/** A box's inside spans on the box axes, as the bracing's (lib/pa/calc paInner). */
const insideOf = (box: Dims3, t: number, inset: number) => ({
  x: box.w - 2 * t,
  y: box.h - 2 * t,
  z: box.d - inset - BAFFLE_IN - t,
});

/**
 * A box's center of gravity, in from its outside: `y` up from the bottom, `z` back from the front. The walls (each at
 * its middle), the baffle, the driver (its weight at half its mounting depth) and `more` (the vent's panels, where
 * they sit: lib/pa/calc subVentMasses) count; the braces spread through the box and are left out.
 */
export function boxCenterOfGravity(
  box: Dims3,
  t: number,
  inset: number,
  drv: HardwareDriver,
  more: readonly CogMass[] = [],
) {
  const { w, h, d } = box;
  const wallLb = panelLbPerSqFt(t, PLYWOOD_MATERIAL) / 144;
  const sides = 2 * d * h * wallLb,
    topBottom = 2 * w * d * wallLb,
    back = w * h * wallLb,
    baffle = (w - 2 * t) * (h - 2 * t) * (BAFFLE_LB_PER_SQFT / 144);
  const masses: [number, number, number][] = [
    [sides + topBottom, h / 2, d / 2],
    [back, h / 2, d - t / 2],
    [baffle, h / 2, inset + BAFFLE_IN / 2],
    [drv.lb, t + drv.center.y, inset + DRIVER_MASS_DEPTH_SHARE * drv.depthIn],
    ...more.map((m): [number, number, number] => [m.lb, m.y, m.z]),
  ];
  const total = masses.reduce((a, [m]) => a + m, 0);
  return {
    y: masses.reduce((a, [m, y]) => a + m * y, 0) / total,
    z: masses.reduce((a, [m, , z]) => a + m * z, 0) / total,
  };
}

const EPS = 1e-6;
const overlaps = (a: BoxRegion, b: BoxRegion) =>
  (["x", "y", "z"] as const).every((k) => a[k][0] < b[k][1] - EPS && b[k][0] < a[k][1] - EPS);
/** A region with its depth off the panel at least FIT_MIN_DEPTH_IN, for the fit check. */
function fitRegion(r: BoxRegion, panel: HardwarePanel, inner: Record<"x" | "y" | "z", number>) {
  const grow = (s: readonly [number, number], far: boolean, span: number) =>
    s[1] - s[0] >= FIT_MIN_DEPTH_IN
      ? s
      : far
        ? ([span - FIT_MIN_DEPTH_IN, span] as const)
        : ([0, FIT_MIN_DEPTH_IN] as const);
  if (panel === "sideL") return { ...r, x: grow(r.x, false, inner.x) };
  if (panel === "sideR") return { ...r, x: grow(r.x, true, inner.x) };
  if (panel === "back") return { ...r, z: grow(r.z, true, inner.z) };
  return { ...r, y: grow(r.y, true, inner.y) };
}

/** What a box's parts must keep clear of, inside: its window braces, ribs, driver and vent. */
interface Obstacles {
  window: BoxRegion[];
  rib: BoxRegion[];
  driver: readonly BoxRegion[];
  vent: readonly BoxRegion[];
}
function obstaclesOf(
  bracing: BoxBracing | null,
  keepOut: BoxKeepOut,
  inner: Record<"x" | "y" | "z", number>,
  t: number,
): Obstacles {
  return {
    window: bracing
      ? bracingRegions({ windows: bracing.windows, notch: bracing.notch, ribs: [] }, inner, t)
      : [],
    rib: bracing
      ? bracingRegions(
          { windows: { x: [], y: [], z: [] }, notch: null, ribs: bracing.ribs },
          inner,
          t,
        )
      : [],
    driver: keepOut.driver,
    vent: keepOut.vent,
  };
}

/** A part about to be placed: what it is, its panel, and its cutout's center on the box axes (the two in the panel). */
interface Draft {
  kind: HardwareKind;
  part: CabinetPart;
  panel: HardwarePanel;
  /** the cutout's center in the panel's plane, box axes (the panel's own axis is ignored) */
  at: { x: number; y: number; z: number };
}
/** The cutout's size on the box axes as mounted: a side's across along z (front to back) by up along y, the back's x by y, the lid's x by z. */
function cutoutSpan(d: Draft) {
  const c = mountedCutout(d.part) ?? { across: 0, up: 0 };
  const f = mountedFlange(d.part) ?? c;
  return d.panel === "sideL" || d.panel === "sideR"
    ? { z: c.across, y: c.up, x: 0, fz: f.across, fy: f.up, fx: 0 }
    : d.panel === "back"
      ? { x: c.across, y: c.up, z: 0, fx: f.across, fy: f.up, fz: 0 }
      : { x: c.across, z: c.up, y: 0, fx: f.across, fz: f.up, fy: 0 };
}
/** The room a part's recess takes inside, box axes, reaching `depthIn` from the panel's outside face (its listed depth). */
function recessOf(
  d: Draft,
  inner: Record<"x" | "y" | "z", number>,
  t: number,
  depthIn = d.part.depthIn ?? 0,
): BoxRegion {
  const s = cutoutSpan(d);
  const p = Math.max(0, depthIn - t);
  const span = (k: "x" | "y" | "z", w: number) => [d.at[k] - w / 2, d.at[k] + w / 2] as const;
  switch (d.panel) {
    case "sideL":
      return { x: [0, p], y: span("y", s.y), z: span("z", s.z) };
    case "sideR":
      return { x: [inner.x - p, inner.x], y: span("y", s.y), z: span("z", s.z) };
    case "back":
      return { x: span("x", s.x), y: span("y", s.y), z: [inner.z - p, inner.z] };
    case "top":
      return { x: span("x", s.x), y: [inner.y - p, inner.y], z: span("z", s.z) };
  }
}
/** Whether a part's cutout and flange stay off its panel's edges and joints (HARDWARE_EDGE_CLEAR_IN, the roundovers). */
function clearOfEdges(
  d: Draft,
  box: Dims3,
  inner: Record<"x" | "y" | "z", number>,
  t: number,
  inset: number,
) {
  const s = cutoutSpan(d);
  const e = HARDWARE_EDGE_CLEAR_IN,
    f = HARDWARE_FLANGE_EDGE_IN;
  // in the panel's plane: each axis the cutout spans, inside, and the flange on the outside face
  const out = { x: t, y: t, z: inset + BAFFLE_IN };
  const outer = { x: box.w, y: box.h, z: box.d };
  const axes = (["x", "y", "z"] as const).filter((k) => s[k] > 0);
  return axes.every((k) => {
    const half = s[k] / 2,
      fHalf = (k === "x" ? s.fx : k === "y" ? s.fy : s.fz) / 2,
      c = d.at[k];
    const o = out[k] + c;
    return (
      c - half >= e - EPS &&
      c + half <= inner[k] - e + EPS &&
      o - fHalf >= f - EPS &&
      o + fHalf <= outer[k] - f + EPS
    );
  });
}

/** What a part placed at its draft runs into: the edges, then each obstacle, then the parts already placed. */
function hitsOf(
  d: Draft,
  box: Dims3,
  inner: Record<"x" | "y" | "z", number>,
  t: number,
  inset: number,
  obs: Obstacles,
  placed: readonly PlacedHardware[],
): HardwareObstacle[] {
  const r = fitOf(d, inner, t);
  const hits: HardwareObstacle[] = [];
  if (!clearOfEdges(d, box, inner, t, inset)) hits.push("edge");
  for (const k of ["window", "rib", "driver", "vent"] as const)
    if (obs[k].some((o) => overlaps(r, o))) hits.push(k);
  if (placed.some((p) => overlaps(r, p.fit))) hits.push("part");
  return hits;
}
/** The room a part's fit check takes: its recess at least FIT_MIN_DEPTH_IN deep (the posts' cup HORN_POSTS_FIT_DEPTH_IN). */
function fitOf(d: Draft, inner: Record<"x" | "y" | "z", number>, t: number) {
  // the horn posts' cup has no listed depth: the fit check takes HORN_POSTS_FIT_DEPTH_IN
  const fitDepth = d.part.depthIn ?? (d.kind === "posts" ? HORN_POSTS_FIT_DEPTH_IN : 0);
  return fitRegion(recessOf(d, inner, t, fitDepth), d.panel, inner);
}

/** A part placed at its draft: its face position (outside), recess, liters and hits. */
function place(
  d: Draft,
  box: Dims3,
  inner: Record<"x" | "y" | "z", number>,
  t: number,
  inset: number,
  hits: HardwareObstacle[],
): PlacedHardware {
  const out = { x: t + d.at.x, y: t + d.at.y, z: inset + BAFFLE_IN + d.at.z };
  const uv =
    d.panel === "sideL" || d.panel === "sideR"
      ? { u: out.z, v: out.y }
      : d.panel === "back"
        ? { u: out.x, v: out.y }
        : { u: out.x, v: out.z };
  return {
    kind: d.kind,
    part: d.part,
    panel: d.panel,
    ...uv,
    recess: recessOf(d, inner, t),
    fit: fitOf(d, inner, t),
    liters: partRecessLiters(d.part, t),
    hits,
  };
}

/**
 * The first clear place for a part, stepping its center from `from` toward `to` (SCAN_STEP_IN at a time);
 * where none is clear, the place at `from` with what it runs into.
 */
function firstClear(
  draft: (c: number) => Draft,
  from: number,
  to: number,
  box: Dims3,
  inner: Record<"x" | "y" | "z", number>,
  t: number,
  inset: number,
  obs: Obstacles,
  placed: readonly PlacedHardware[],
): PlacedHardware {
  const dir = Math.sign(to - from) || 1;
  const n = Math.max(0, Math.floor(Math.abs(to - from) / SCAN_STEP_IN + EPS));
  for (let i = 0; i <= n; i++) {
    const d = draft(from + dir * i * SCAN_STEP_IN);
    const hits = hitsOf(d, box, inner, t, inset, obs, placed);
    if (!hits.length) return place(d, box, inner, t, inset, hits);
  }
  const d = draft(from);
  return place(d, box, inner, t, inset, hitsOf(d, box, inner, t, inset, obs, placed));
}

/**
 * The handles' preset center (box axes): at the box's center-of-gravity height, and front to back at the place nearest
 * its center of gravity where both handles are clear (stepping back and forward in turn); the center of gravity itself
 * where no place is.
 */
function handlePreset(
  dims: Dims3,
  t: number,
  inset: number,
  handle: CabinetPart,
  driver: HardwareDriver,
  more: readonly CogMass[],
  obs: Obstacles,
  inner: Record<"x" | "y" | "z", number>,
) {
  const cog = boxCenterOfGravity(dims, t, inset, driver, more);
  const y = cog.y - t,
    z0 = cog.z - inset - BAFFLE_IN;
  const clearAt = (z: number) =>
    (["sideL", "sideR"] as const).every(
      (panel) =>
        !hitsOf(
          { kind: "handle", part: handle, panel, at: { x: 0, y, z } },
          dims,
          inner,
          t,
          inset,
          obs,
          [],
        ).length,
    );
  const n = Math.ceil(inner.z / SCAN_STEP_IN);
  for (let i = 0; i <= n; i++)
    for (const z of i ? [z0 + i * SCAN_STEP_IN, z0 - i * SCAN_STEP_IN] : [z0])
      if (clearAt(z)) return { y, z };
  return { y, z: z0 };
}

/**
 * What `planBoxHardware` reads: the box, its walls and inset, its handles, driver, braces and keep-out, and the vent's
 * panels for the center of gravity (none in the mid box).
 */
export interface BoxHardwareInput {
  box: HardwareBoxId;
  dims: Dims3;
  t: number;
  inset: number;
  handles: BoxHandles;
  driver: HardwareDriver;
  bracing: BoxBracing | null;
  keepOut: BoxKeepOut;
  ventMasses?: readonly CogMass[];
}

/**
 * A box's hardware from the presets: the handles at its center of gravity plus the offsets (one each side), the input
 * dish low on the back, centered (the lowest place clear of the vent and the braces), and on the mid box the horn's
 * posts on the lid, centered, as far back as is clear. Each part says what it runs into.
 */
export function planBoxHardware({
  box,
  dims,
  t,
  inset,
  handles,
  driver,
  bracing,
  keepOut,
  ventMasses = [],
}: BoxHardwareInput): BoxHardwarePlan {
  const inner = insideOf(dims, t, inset);
  // the parts go where the driver, the vent, the edges and each other leave room; the braces go around them after
  const obs = obstaclesOf(null, keepOut, inner, t);
  const placed: PlacedHardware[] = [];
  const handle = handlePart(handles.model);
  if (handle) {
    const at = { ...handlePreset(dims, t, inset, handle, driver, ventMasses, obs, inner), x: 0 };
    at.y += handles.upIn;
    at.z += handles.backIn;
    for (const panel of ["sideL", "sideR"] as const) {
      const d: Draft = { kind: "handle", part: handle, panel, at };
      placed.push(place(d, dims, inner, t, inset, hitsOf(d, dims, inner, t, inset, obs, placed)));
    }
  }
  const plateH = mountedSize(INPUT_PLATE.cutout, INPUT_PLATE).up / 2 + HARDWARE_EDGE_CLEAR_IN;
  placed.push(
    firstClear(
      (y) => ({
        kind: "plate",
        part: INPUT_PLATE,
        panel: "back",
        at: { x: inner.x / 2, y, z: inner.z },
      }),
      plateH,
      inner.y - plateH,
      dims,
      inner,
      t,
      inset,
      obs,
      placed,
    ),
  );
  if (box === "mid") {
    const postsH = mountedSize(HORN_POSTS.cutout, HORN_POSTS).up / 2 + HARDWARE_EDGE_CLEAR_IN;
    placed.push(
      firstClear(
        (z) => ({
          kind: "posts",
          part: HORN_POSTS,
          panel: "top",
          at: { x: inner.x / 2, y: inner.y, z },
        }),
        inner.z - postsH,
        postsH,
        dims,
        inner,
        t,
        inset,
        obs,
        placed,
      ),
    );
  }
  // then each part checked against the braces and ribs as well (they keep out of the recesses, so this finds none unless
  // the bracing was planned without them)
  const full = obstaclesOf(bracing, keepOut, inner, t);
  const parts = placed.map((p, i) => {
    const d: Draft = { kind: p.kind, part: p.part, panel: p.panel, at: atOf(p, inner, t, inset) };
    return { ...p, hits: hitsOf(d, dims, inner, t, inset, full, placed.slice(0, i)) };
  });
  const bought = boughtWith(box, handle);
  return {
    box,
    parts,
    liters: parts.reduce((a, p) => a + p.liters, 0),
    lb: bought.reduce((a, b) => a + b.qty * (b.part.lb ?? 0), 0),
    price: bought.reduce((a, b) => a + b.qty * b.part.price, 0),
    bought,
  };
}

/** A placed part's cutout center back on the box axes (the panel's own axis at its inside face), as its draft had it. */
function atOf(p: PlacedHardware, inner: Record<"x" | "y" | "z", number>, t: number, inset: number) {
  const front = inset + BAFFLE_IN;
  switch (p.panel) {
    case "sideL":
      return { x: 0, y: p.v - t, z: p.u - front };
    case "sideR":
      return { x: inner.x, y: p.v - t, z: p.u - front };
    case "back":
      return { x: p.u - t, y: p.v - t, z: inner.z };
    case "top":
      return { x: p.u - t, y: inner.y, z: p.v - front };
  }
}
/**
 * What no brace or rib may enter for a box's hardware (BoxKeepOut's `hardware`): each part's fit region, its recess at
 * least a hole's depth, so a rib never covers a cutout and a frame never crosses one.
 */
export const hardwareKeepOut = (plan: Pick<BoxHardwarePlan, "parts">): BoxRegion[] =>
  plan.parts.map((p) => p.fit);

/** Whether every part of a plan fits. */
export const hardwareFits = (plan: BoxHardwarePlan) => plan.parts.every((p) => !p.hits.length);
