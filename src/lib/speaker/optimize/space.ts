// The Speaker optimizer's search space: the units it
// varies (a chamber's cones, a datasheet driver), each unit's candidate parts, the crossovers in the box, the box's
// size groups and the shapes that hold a set of chamber volumes, and each band's top amp power. Pure.
import type {
  BandFilter,
  BandId,
  ChamberVent,
  Dims3,
  DimensionLockMode,
  DriverKind,
  DriverRef,
  FacePoint,
  SpeakerBand,
  SpeakerChamber,
  SpeakerDriver,
  SpeakerOptimizerCatalog,
  SpeakerOptimizerLocks,
  SpeakerSpec,
} from "../../../types";
import { chamberClearFace, clearDepthIn } from "../chamberAir";
import { hfBandOf } from "../speakerResponse";
import { isConeKind, isWooferKind } from "../driverParts";
import { crossingPairs } from "../stackResponse";
import {
  driverAcrossIn,
  driverHorn,
  driverSpots,
  driversOnBaffle,
  onTop,
  speakerLayout,
} from "../speakerLayout";
import { takesHornMountAt } from "../../build/hornMount";
import { inSearchSpace, rangeOf } from "../../optimizer/searchSpace";
import { DEFAULT_PA } from "../../defaults";
import {
  CD_OPTIONS,
  FILL_OPTIONS,
  HIFI_TWEETERS,
  HIFI_WOOFERS,
  HORN_OPTIONS,
  MID_OPTIONS,
  SPEAKER_SUB_OPTIONS,
  SUB_OPTIONS,
  hornById,
} from "../../data";
import { byId } from "../../tables";
import { CHAMBER_LOAD, DRIVER_KIND, VENT_KIND } from "../../../constants/speakerSpec";
import { HIFI_DRIVE } from "../../../constants/hifiEngine";
import { SPEAKER_STEPS } from "../../../constants/speakerSteps";
import { hfProgramWatts, programWatts } from "../../power";

/** The app catalog as the optimizer's candidates (`SpeakerOptimizerInput.catalog` absent). */
export const SPEAKER_OPTIMIZER_CATALOG: SpeakerOptimizerCatalog = {
  sub: SUB_OPTIONS,
  mid: MID_OPTIONS,
  compression: CD_OPTIONS,
  woofer: HIFI_WOOFERS,
  tweeter: HIFI_TWEETERS,
  coaxial: FILL_OPTIONS,
  horns: HORN_OPTIONS,
};

/** A driver entry's lock key: its chamber's index and its index in the chamber. */
export const driverRef = (chamber: number, entry: number): DriverRef => `${chamber}.${entry}`;

/** `x` on a step: the nearest multiple of it. */
export const onStep = (x: number, step: number) => Math.round(x / step) * step;

/** A value the search changed, on its field's step; a value it kept stays exactly as it was. */
export const steppedIf = (changed: boolean, x: number, step: number) =>
  changed ? onStep(x, step) : x;

/** A chamber's cones, as one unit: every cone entry changes part together (the model takes alike cones). */
export interface ConeUnit {
  kind: "cone";
  chamber: number;
  /** the cone entries' indexes in the chamber */
  entries: readonly number[];
  driverKind: DriverKind;
  /** the cones' band, and a coaxial's HF band after it */
  bands: readonly BandId[];
  /** the candidate parts' ids, your part among them */
  drivers: readonly string[];
  /** its chamber's volume can change (a direct chamber the search may size) */
  sized: boolean;
  /** its vent can change (unlocked, vented or radiators) */
  venting: boolean;
}

/** A datasheet driver entry (a compression driver, a tweeter) with its horn: one unit. */
export interface HfUnit {
  kind: "hf";
  chamber: number;
  entry: number;
  band: BandId;
  /** the candidates: a driver and its horn (null: none), your pair among them */
  parts: readonly { driverId: string; hornId: string | null }[];
}

export type SearchUnit = ConeUnit | HfUnit;

/** The bands a unit feeds. */
export const unitBands = (u: SearchUnit): readonly BandId[] =>
  u.kind === "cone" ? u.bands : [u.band];

/** A crossover in the box: the lower band's lowpass meets the upper band's highpass; the factors it tries on both. */
export interface CrossoverPair {
  lower: number;
  upper: number;
  /** the corner factors it tries, 1 (yours) among them; [1] when locked */
  factors: readonly number[];
}

/** The crossover factors the search tries: ×0.71 to ×1.41 of yours, about a third of an octave apart. */
export const CROSSOVER_FACTORS = [0.71, 0.8, 0.89, 1, 1.12, 1.26, 1.41];
/** The lowest corner a searched crossover takes, Hz. */
const CROSSOVER_MIN_HZ = 20;

/** The size a free axis may take, as factors of yours: from LOW to HIGH. */
const SIZE_FACTORS: [number, number] = [0.7, 1.5];

/**
 * A cone kind's candidates: same kind and nominal size (or the next size up or down with `nearSizes`), with a US price
 * and T/S, each driver once (`inSearchSpace`); your part always. `ownSize` (in) is your part's nominal size where the catalog has it outside
 * the search space (a template's own driver, as the driver comparison lists its options); absent, such a part keeps
 * only itself. A size that doesn't fit the box fails the fit check (`driverFits` in evaluate).
 */
export function coneCandidates(
  kind: DriverKind,
  current: string,
  catalog: SpeakerOptimizerCatalog,
  { ownSize, nearSizes = false }: { ownSize?: number; nearSizes?: boolean } = {},
): string[] {
  const table: readonly { id: string; size: number; price: number | null; variantOf?: string }[] =
    kind === DRIVER_KIND.sub
      ? catalog.sub
      : kind === DRIVER_KIND.mid
        ? catalog.mid
        : kind === DRIVER_KIND.woofer
          ? catalog.woofer
          : kind === DRIVER_KIND.coaxial
            ? catalog.coaxial
            : [];
  const size = byId(table, current)?.size ?? ownSize;
  if (size === undefined) return [current];
  // with `nearSizes`: your size and the next size up and down the table has
  const sizes = [...new Set(table.filter(inSearchSpace).map((d) => d.size))].sort((a, b) => a - b);
  const at = sizes.indexOf(size);
  const near = new Set(nearSizes && at >= 0 ? sizes.slice(Math.max(0, at - 1), at + 2) : [size]);
  const ids = table
    .filter((d) => d.id === current || (inSearchSpace(d) && near.has(d.size) && d.price !== null))
    .map((d) => d.id);
  // a coaxial with an HF section keeps one (its HF band would lose its model)
  if (kind === DRIVER_KIND.coaxial && byId(catalog.coaxial, current)?.hf)
    return ids.filter((id) => id === current || byId(catalog.coaxial, id)?.hf);
  return ids;
}

/** A datasheet driver's candidates with their horns (see the plan's search space). */
export function hfCandidates(
  driver: SpeakerDriver,
  catalog: SpeakerOptimizerCatalog,
  driverLocked: boolean,
  hornLocked: boolean,
): { driverId: string; hornId: string | null }[] {
  const own = { driverId: driver.driverId, hornId: driver.horn?.hornId ?? null };
  if (driver.kind === DRIVER_KIND.compression) {
    const cur = byId(catalog.compression, driver.driverId);
    const cds = driverLocked
      ? [cur].filter((c) => c !== undefined)
      : catalog.compression.filter((c) => c.id === driver.driverId || (c.hf && c.price !== null));
    const horns: (string | null)[] =
      hornLocked || !driver.horn
        ? [own.hornId]
        : catalog.horns
            .filter((h) => h.id === own.hornId || h.price !== null)
            .map((h): string | null => h.id);
    const pairs = cds.flatMap((cd) =>
      horns.flatMap((hornId) => {
        const mine = cd.id === own.driverId && hornId === own.hornId;
        const horn = hornId === null ? null : hornById(hornId);
        return mine || horn === null || horn?.exit === cd.exit ? [{ driverId: cd.id, hornId }] : [];
      }),
    );
    return pairs.some((p) => p.driverId === own.driverId && p.hornId === own.hornId)
      ? pairs
      : [own, ...pairs];
  }
  if (driver.kind === DRIVER_KIND.tweeter) {
    const cur = byId(catalog.tweeter, driver.driverId);
    if (driverLocked || !cur) return [own];
    // the waveguide stays: on one, the tweeter keeps its exit
    return catalog.tweeter
      .filter(
        (t) =>
          t.id === cur.id ||
          (t.type === cur.type && t.price !== null && (!driver.horn || t.exit === cur.exit)),
      )
      .map((t) => ({ driverId: t.id, hornId: own.hornId }));
  }
  return [own];
}

/** The search's units for a spec under its locks. A band fed by more than one unit holds them all as they are. */
export function searchUnits(
  spec: SpeakerSpec,
  locks: SpeakerOptimizerLocks,
  catalog: SpeakerOptimizerCatalog,
): SearchUnit[] {
  const lockedDrivers = new Set(locks.drivers ?? []);
  const lockedHorns = new Set(locks.horns ?? []);
  const lockedSizes = new Set(locks.sizes ?? []);
  const lockedVents = new Set(locks.vents ?? []);
  const units: SearchUnit[] = [];
  spec.cabinet.chambers.forEach((chamber, k) => {
    const cones = chamber.drivers.flatMap((d, j) => (isConeKind(d.kind) ? [j] : []));
    if (cones.length) {
      const first = chamber.drivers[cones[0]];
      const alike = cones.every((j) => {
        const d = chamber.drivers[j];
        return (
          d.kind === first.kind && d.driverId === first.driverId && d.bands[0] === first.bands[0]
        );
      });
      const hf = first.kind === DRIVER_KIND.coaxial ? hfBandOf(first) : null;
      const bands = [first.bands[0], ...(hf && hf !== first.bands[0] ? [hf] : [])].filter(
        (b) => b !== undefined,
      );
      const locked = !alike || cones.some((j) => lockedDrivers.has(driverRef(k, j)));
      const direct = chamber.load.kind === CHAMBER_LOAD.direct;
      // a woofer on the baffle may move a size up or down unless its size is locked (a horn's throat holds its size)
      const nearSizes =
        direct && isWooferKind(first.kind) && !cones.some((j) => lockedSizes.has(driverRef(k, j)));
      units.push({
        kind: "cone",
        chamber: k,
        entries: cones,
        driverKind: first.kind,
        bands,
        drivers: locked
          ? [first.driverId]
          : coneCandidates(first.kind, first.driverId, catalog, { nearSizes }),
        sized: alike && direct,
        venting: alike && direct && !lockedVents.has(k) && chamber.vent.kind !== VENT_KIND.sealed,
      });
    }
    chamber.drivers.forEach((d, j) => {
      if (isConeKind(d.kind)) return;
      const band = hfBandOf(d);
      if (band === null) return;
      units.push({
        kind: "hf",
        chamber: k,
        entry: j,
        band,
        parts: hfCandidates(
          d,
          catalog,
          lockedDrivers.has(driverRef(k, j)),
          lockedHorns.has(driverRef(k, j)),
        ),
      });
    });
  });
  // a band fed by two units: neither can be scored alone, so both stay
  const feeds = new Map<BandId, number>();
  for (const u of units) for (const b of unitBands(u)) feeds.set(b, (feeds.get(b) ?? 0) + 1);
  return units.map((u): SearchUnit => {
    if (unitBands(u).every((b) => feeds.get(b) === 1)) return u;
    if (u.kind === "hf") return { ...u, parts: u.parts.slice(0, 1).map(() => hfOwn(spec, u)) };
    const own = spec.cabinet.chambers[u.chamber].drivers[u.entries[0]].driverId;
    return { ...u, drivers: [own], sized: false, venting: false };
  });
}

/** An HF unit's own pair, from the spec. */
function hfOwn(spec: SpeakerSpec, u: HfUnit) {
  const d = spec.cabinet.chambers[u.chamber].drivers[u.entry];
  return { driverId: d.driverId, hornId: d.horn?.hornId ?? null };
}

/** The crossovers in the box, each with the factors it tries (a side locked, or a filter in two pairs: [1]). */
export function crossoverPairs(
  spec: Pick<SpeakerSpec, "bands">,
  locks: SpeakerOptimizerLocks,
): CrossoverPair[] {
  const pairs = crossingPairs(
    spec.bands.map((b) => ({ crossover: { highpass: b.highpass, lowpass: b.lowpass } })),
  );
  const count = (pick: (p: (typeof pairs)[number]) => number, i: number) =>
    pairs.filter((p) => pick(p) === i).length;
  return pairs.map(({ lower, upper }) => {
    const lp = spec.bands[lower],
      hp = spec.bands[upper];
    const free =
      !(locks.lowpass ?? []).includes(lp.id) &&
      !(locks.highpass ?? []).includes(hp.id) &&
      count((p) => p.lower, lower) === 1 &&
      count((p) => p.upper, upper) === 1;
    return { lower, upper, factors: free ? CROSSOVER_FACTORS : [1] };
  });
}

/** A filter's corner moved by `factor`, on the corner field's step (yours as it is at 1). */
export const movedFilter = (f: BandFilter, factor: number): BandFilter =>
  factor === 1
    ? f
    : { ...f, hz: Math.max(CROSSOVER_MIN_HZ, onStep(f.hz * factor, SPEAKER_STEPS.filterHz)) };

/** Whether a band's highpass is a protection filter the search moves with the tuning (not a crossover, not locked). */
export function isSubsonic(
  spec: Pick<SpeakerSpec, "bands">,
  pairs: readonly CrossoverPair[],
  locks: SpeakerOptimizerLocks,
  band: BandId,
): boolean {
  const i = spec.bands.findIndex((b) => b.id === band);
  return (
    i >= 0 &&
    spec.bands[i].highpass !== null &&
    !pairs.some((p) => p.upper === i) &&
    !(locks.highpass ?? []).includes(band)
  );
}

// ---- the box's size ----

/** One shape of the box: the width and depth factors, and each size group's height factor. */
export interface BoxShape {
  sx: number;
  sz: number;
  /** each group's height factor, in `SizeModel.groups` order */
  g: readonly number[];
}

/** Chambers whose heights overlap: they scale together, about the group's bottom; the groups above move with them. */
export interface SizeGroup {
  y0: number;
  y1: number;
  chambers: readonly number[];
  /** the chamber whose clear volume sets the group's height (a sized cone unit's); null: the group keeps its height */
  lead: number | null;
  /** the height factors its chambers' height locks allow (`rangeOf`, all of them at once); null: no height lock */
  locked: [number, number] | null;
}

/** What the shapes are worked out from: your chambers' walls and clear sizes, the groups, the axes' freedom. */
export interface SizeModel {
  groups: readonly SizeGroup[];
  /** each chamber's walls on each axis (outside less clear), in, and its clear volume, in³ */
  walls: readonly Dims3[];
  clearIn3: readonly number[];
  /**
   * the factor range each axis may take, of your outer size: the width and depth under every chamber's lock on them
   * (`rangeOf`), the height of the whole box (each group's height locks are its own, `SizeGroup.locked`)
   */
  range: Record<keyof Dims3, [number, number]>;
  /** the axes that can change at all (the height: some group's, unless its locks hold it, `heightFixed`) */
  free: Record<keyof Dims3, boolean>;
  /** each chamber's smallest clear face its drivers and horns fit in, where they keep their places' shares, in */
  minClear: readonly { w: number; h: number }[];
  /** each chamber's clear face now, in */
  clearFaces: readonly { w: number; h: number }[];
  /** your box's outer size (with the top horns), in */
  outer: Dims3;
  /** your chambers' outer surface in total, in² (the weight estimate scales the wood by it) */
  surfaceIn2: number;
}

/** A chamber's outer surface, in². */
const surfaceOf = (d: Dims3) => 2 * (d.w * d.h + d.w * d.d + d.h * d.d);

/** The intersection of factor ranges: the factors every range allows. */
const within = (ranges: readonly [number, number][]): [number, number] => [
  Math.max(...ranges.map((r) => r[0])),
  Math.min(...ranges.map((r) => r[1])),
];

/** Whether a group's height locks hold its height exactly. */
const exactRange = (r: [number, number] | null) => r !== null && r[1] - r[0] < 1e-9;

/** Whether a group keeps its height: no chamber can change size, or its locks hold it exactly. */
const heightFixed = (model: Pick<SizeModel, "free">, group: Pick<SizeGroup, "locked">) =>
  !model.free.h || exactRange(group.locked);

/** The height factors a group may take: its locks' range, else the whole box's. */
const groupRange = (model: Pick<SizeModel, "range">, group: Pick<SizeGroup, "locked">) =>
  group.locked ?? model.range.h;

/** The size model for a spec, its units and its size locks (each chamber's, by its index). */
export function sizeModel(
  spec: SpeakerSpec,
  units: readonly SearchUnit[],
  outer: Dims3,
  size: SpeakerOptimizerLocks["size"] = {},
): SizeModel {
  const { cabinet } = spec;
  const chambers = cabinet.chambers;
  const order = chambers.map((_, i) => i).sort((a, b) => chambers[a].at.yIn - chambers[b].at.yIn);
  const groups: { y0: number; y1: number; chambers: number[] }[] = [];
  for (const i of order) {
    const c = chambers[i];
    const y0 = c.at.yIn,
      y1 = c.at.yIn + c.dims.h;
    const last = groups[groups.length - 1];
    if (last && y0 < last.y1 - 1e-9) {
      last.chambers.push(i);
      last.y1 = Math.max(last.y1, y1);
    } else groups.push({ y0, y1, chambers: [i] });
  }
  const sized = new Set(units.flatMap((u) => (u.kind === "cone" && u.sized ? [u.chamber] : [])));
  const horned = chambers.some((c) => c.load.kind === CHAMBER_LOAD.horn);
  const walls = chambers.map((c) => {
    const face = chamberClearFace(cabinet, c);
    return {
      w: c.dims.w - face.w,
      h: c.dims.h - face.h,
      d: c.dims.d - clearDepthIn(cabinet, c.dims),
    };
  });
  const clearIn3 = chambers.map(
    (c, i) => (c.dims.w - walls[i].w) * (c.dims.h - walls[i].h) * (c.dims.d - walls[i].d),
  );
  const any = sized.size > 0;
  const axis = (mode: DimensionLockMode | undefined): [number, number] =>
    rangeOf(mode, 1, SIZE_FACTORS);
  /** the modes the chambers lock an axis to (free ones left out) */
  const modes = (a: keyof Dims3, list: readonly number[]) =>
    list.flatMap((i) => {
      const mode = size[i]?.[a];
      return mode && mode !== "free" ? [mode] : [];
    });
  const all = chambers.map((_, i) => i);
  // the width and depth scale the whole box: every chamber's lock on them holds them
  const boxAxis = (a: "w" | "d"): [number, number] =>
    within([axis(undefined), ...modes(a, all).map(axis)]);
  return {
    groups: groups.map((g) => {
      const heights = modes("h", g.chambers);
      return {
        ...g,
        // a group with a horn-loaded chamber keeps its height; else its first sized chamber leads it
        lead: g.chambers.some((i) => chambers[i].load.kind === CHAMBER_LOAD.horn)
          ? null
          : (g.chambers.find((i) => sized.has(i)) ?? null),
        locked: heights.length ? within(heights.map(axis)) : null,
      };
    }),
    walls,
    clearIn3,
    range: { w: boxAxis("w"), h: axis(undefined), d: boxAxis("d") },
    free: {
      w: any && !horned && !modes("w", all).includes("exact"),
      h: any,
      d: any && !horned && !modes("d", all).includes("exact"),
    },
    minClear: minClearFaces(spec),
    clearFaces: chambers.map((c, i) => ({ w: c.dims.w - walls[i].w, h: c.dims.h - walls[i].h })),
    outer,
    surfaceIn2: chambers.reduce((sum, c) => sum + surfaceOf(c.dims), 0),
  };
}

/** A rounding step's room on the smallest clear face, in: a built face may round down this much. */
const FIT_MARGIN_IN = SPEAKER_STEPS.sizeIn;

/**
 * Each chamber's smallest clear face: a cone or a plate on the baffle keeps its share of the face across and up (the
 * places scale with the chamber), so the face must keep its radius on both sides of it; a horn in the baffle its own
 * rule's room (`hornFits`: its mouth's height, and its width unless the cutout trims it).
 */
function minClearFaces(spec: SpeakerSpec): { w: number; h: number }[] {
  return speakerLayout(spec.cabinet).chambers.map((placed) => {
    let w = 0,
      h = 0;
    const { clear } = placed;
    for (const d of placed.chamber.drivers) {
      if (onTop(d) || !driversOnBaffle(placed.chamber)) continue;
      const horn = driverHorn(d);
      if (horn) {
        h = Math.max(h, horn.size.h);
        if (!horn.rect) w = Math.max(w, horn.size.w);
        continue;
      }
      const r = driverAcrossIn(d) / 2;
      for (const spot of driverSpots(placed, d)) {
        const u = (spot.xIn - clear.x) / clear.w,
          v = (spot.yIn - clear.y) / clear.h;
        if (u > 0 && u < 1) w = Math.max(w, r / Math.min(u, 1 - u));
        if (v > 0 && v < 1) h = Math.max(h, r / Math.min(v, 1 - v));
      }
    }
    // a driver that fits only tightly (or not at all) now holds its chamber at its size
    return {
      w: w > 0 ? Math.min(w + FIT_MARGIN_IN, clear.w) : 0,
      h: h > 0 ? Math.min(h + FIT_MARGIN_IN, clear.h) : 0,
    };
  });
}

/** The volume factors a sized chamber tries: from the smallest the axes allow to the largest, yours (1) among them. */
export function volumeLadder(model: SizeModel, steps: number): number[] {
  // the height: from the lowest any group may take to the highest
  const heights = model.groups.map((g) => (heightFixed(model, g) ? [1, 1] : groupRange(model, g)));
  const lo = (k: keyof Dims3) =>
    k === "h" ? Math.min(...heights.map((r) => r[0])) : model.free[k] ? model.range[k][0] : 1;
  const hi = (k: keyof Dims3) =>
    k === "h" ? Math.max(...heights.map((r) => r[1])) : model.free[k] ? model.range[k][1] : 1;
  const vMin = lo("w") * lo("h") * lo("d"),
    vMax = hi("w") * hi("h") * hi("d");
  if (vMax - vMin < 1e-9) return [1];
  const out = Array.from(
    { length: steps },
    (_, i) => vMin * Math.pow(vMax / vMin, i / (steps - 1)),
  );
  // yours replaces the step nearest it
  const near = out.reduce(
    (b, v, i) => (Math.abs(Math.log(v)) < Math.abs(Math.log(out[b])) ? i : b),
    0,
  );
  out[near] = 1;
  return out;
}

/**
 * The volume factors a chamber tries of the ladder: the ones its shapes can reach, with its drivers' and horns' room
 * (`minClear`) under the width and height, and the axes' ranges. Yours (1) always.
 */
export function chamberLadder(model: SizeModel, k: number, ladder: readonly number[]): number[] {
  const need = model.minClear[k],
    face = model.clearFaces[k];
  const group = model.groups.find((g) => g.chambers.includes(k));
  const lo = (axis: keyof Dims3) =>
    axis === "h"
      ? !group || heightFixed(model, group)
        ? 1
        : groupRange(model, group)[0]
      : model.free[axis]
        ? model.range[axis][0]
        : 1;
  // the clear width and height can shrink only to the room the drivers and horns need
  const minW = Math.max(lo("w"), face.w > 0 ? need.w / face.w : 0),
    minH = Math.max(lo("h"), face.h > 0 ? need.h / face.h : 0);
  const vMin = minW * minH * lo("d");
  return ladder.filter((v) => v >= vMin - 1e-9 || Math.abs(v - 1) < 1e-9);
}

/** The width and depth factors a set of volumes tries (each axis inside its range). */
export function shapeCandidates(model: SizeModel, vMean: number): [number, number][] {
  const inside = (k: keyof Dims3, s: number) =>
    (model.free[k] || Math.abs(s - 1) < 1e-9) &&
    s >= model.range[k][0] - 1e-9 &&
    s <= model.range[k][1] + 1e-9;
  const base = [0.85, 1, 1.18];
  const root = Math.sqrt(vMean);
  const pairs: [number, number][] = [
    ...base.flatMap((sx) => base.map((sz): [number, number] => [sx, sz])),
    [root, root],
    [vMean, 1],
    [1, vMean],
  ];
  const seen = new Set<string>();
  return pairs.filter(([sx, sz]) => {
    const key = `${sx.toFixed(4)} ${sz.toFixed(4)}`;
    if (seen.has(key) || !inside("w", sx) || !inside("d", sz)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * The shape that gives each group's lead chamber its volume factor (`v` by group; absent: 1) at width and depth factors
 * `sx`, `sz`: each lead's clear height follows from its clear volume. Null when a height leaves its range, a locked
 * height would move, or a lead has no room.
 */
export function shapeFor(
  spec: Pick<SpeakerSpec, "cabinet">,
  model: SizeModel,
  v: ReadonlyMap<number, number>,
  sx: number,
  sz: number,
): BoxShape | null {
  const chambers = spec.cabinet.chambers;
  const g: number[] = [];
  let height = 0,
    height0 = 0;
  for (const [gi, group] of model.groups.entries()) {
    const ext = group.y1 - group.y0;
    let f = 1;
    if (group.lead !== null) {
      const c = chambers[group.lead],
        wall = model.walls[group.lead];
      const cw = c.dims.w * sx - wall.w,
        cd = c.dims.d * sz - wall.d;
      if (cw <= 0 || cd <= 0) return null;
      const ch = ((v.get(gi) ?? 1) * model.clearIn3[group.lead]) / (cw * cd);
      if (ch <= 0) return null;
      f = (ch + wall.h) / c.dims.h;
      const fixed = heightFixed(model, group);
      if (fixed && Math.abs(f - 1) > 0.01) return null;
      if (fixed) f = 1;
      // its chambers' height locks
      if (group.locked && (f < group.locked[0] - 1e-9 || f > group.locked[1] + 1e-9)) return null;
    }
    // every chamber of the group keeps the room its drivers and horns need
    for (const i of group.chambers) {
      const c = chambers[i],
        wall = model.walls[i],
        need = model.minClear[i];
      if (c.dims.w * sx - wall.w < need.w - 1e-9 && sx < 1) return null;
      if (c.dims.h * f - wall.h < need.h - 1e-9 && f < 1) return null;
    }
    g.push(f);
    height += ext * f;
    height0 += ext;
  }
  const sy = height / height0;
  if (sy < model.range.h[0] - 1e-9 || sy > model.range.h[1] + 1e-9) return null;
  return { sx, sz, g };
}

/** A chamber's place and size on a shape: its boundaries mapped, each on the size step where it moved. */
interface PlacedSize {
  at: FacePoint;
  dims: Dims3;
}

/** Every chamber's place and size on a shape (yours exactly where the shape keeps them). */
export function shapedChambers(
  spec: Pick<SpeakerSpec, "cabinet">,
  model: SizeModel,
  shape: BoxShape,
): PlacedSize[] {
  const step = SPEAKER_STEPS.sizeIn;
  const chambers = spec.cabinet.chambers;
  // each group's new bottom: the groups under it add what they grew
  const bottoms: number[] = [];
  let shift = 0;
  model.groups.forEach((group, gi) => {
    bottoms.push(group.y0 + shift);
    shift += (group.y1 - group.y0) * (shape.g[gi] - 1);
  });
  const groupOf = (i: number) => model.groups.findIndex((gr) => gr.chambers.includes(i));
  const mapY = (gi: number, y: number) => {
    const group = model.groups[gi];
    return bottoms[gi] + (y - group.y0) * shape.g[gi];
  };
  const xMoved = Math.abs(shape.sx - 1) > 1e-9,
    zMoved = Math.abs(shape.sz - 1) > 1e-9;
  return chambers.map((c, i) => {
    const gi = groupOf(i);
    const yMoved =
      Math.abs(shape.g[gi] - 1) > 1e-9 || Math.abs(bottoms[gi] - model.groups[gi].y0) > 1e-9;
    const x0 = steppedIf(xMoved, c.at.xIn * shape.sx, step),
      x1 = steppedIf(xMoved, (c.at.xIn + c.dims.w) * shape.sx, step);
    const y0 = steppedIf(yMoved, mapY(gi, c.at.yIn), step),
      y1 = steppedIf(yMoved, mapY(gi, c.at.yIn + c.dims.h), step);
    return {
      at: { xIn: x0, yIn: y0 },
      dims: { w: x1 - x0, h: y1 - y0, d: steppedIf(zMoved, c.dims.d * shape.sz, step) },
    };
  });
}

/**
 * The estimate of the box's outer size, each chamber's size and the wood's share of the weight on a shape (before it is
 * built).
 */
export function shapeEstimate(
  spec: Pick<SpeakerSpec, "cabinet">,
  model: SizeModel,
  shape: BoxShape,
): { outer: Dims3; chambers: Dims3[]; surfaceRatio: number } {
  let top = 0;
  const sized = spec.cabinet.chambers.map((c, i) => {
    const gi = model.groups.findIndex((gr) => gr.chambers.includes(i));
    return { w: c.dims.w * shape.sx, h: c.dims.h * shape.g[gi], d: c.dims.d * shape.sz };
  });
  const surface = sized.reduce((sum, d) => sum + surfaceOf(d), 0);
  const height0 = model.groups.reduce((sum, gr) => sum + (gr.y1 - gr.y0), 0);
  model.groups.forEach((gr, gi) => (top += (gr.y1 - gr.y0) * shape.g[gi]));
  const box0 = Math.max(...spec.cabinet.chambers.map((c) => c.at.yIn + c.dims.h));
  return {
    outer: {
      w: model.outer.w * shape.sx,
      // the horns on the top stand over the box as they do now
      h: model.outer.h - box0 + box0 * (top / height0),
      d: model.outer.d * shape.sz,
    },
    chambers: sized,
    surfaceRatio: surface / model.surfaceIn2,
  };
}

/** A place scaled by the chamber's change, on the size step where it moved. */
const scaledPoint = (p: FacePoint, fx: number, fy: number): FacePoint => ({
  xIn: steppedIf(Math.abs(fx - 1) > 1e-9, p.xIn * fx, SPEAKER_STEPS.sizeIn),
  yIn: steppedIf(Math.abs(fy - 1) > 1e-9, p.yIn * fy, SPEAKER_STEPS.sizeIn),
});

/**
 * A chamber on its new place and size: its drivers and set vent places move with it (across with the width, up with the
 * height; a horn on the top back with the depth), and a set net air with its clear volume.
 */
export function resizedChamber(
  chamber: SpeakerChamber,
  placed: PlacedSize,
  model: SizeModel,
  index: number,
): SpeakerChamber {
  const fx = placed.dims.w / chamber.dims.w,
    fy = placed.dims.h / chamber.dims.h,
    fz = placed.dims.d / chamber.dims.d;
  const wall = model.walls[index];
  const clear = (placed.dims.w - wall.w) * (placed.dims.h - wall.h) * (placed.dims.d - wall.d);
  const vent: ChamberVent =
    chamber.vent.kind === VENT_KIND.radiator && chamber.vent.position
      ? {
          ...chamber.vent,
          position: { ...chamber.vent.position, ...scaledPoint(chamber.vent.position, fx, fy) },
        }
      : chamber.vent.kind === VENT_KIND.vented &&
          "position" in chamber.vent.port &&
          chamber.vent.port.position
        ? {
            ...chamber.vent,
            port: {
              ...chamber.vent.port,
              position: {
                ...chamber.vent.port.position,
                ...scaledPoint(chamber.vent.port.position, fx, fy),
              },
            },
          }
        : chamber.vent;
  const moved = clear !== model.clearIn3[index];
  return {
    ...chamber,
    at: placed.at,
    dims: placed.dims,
    netLiters:
      chamber.netLiters === null
        ? null
        : steppedIf(moved, (chamber.netLiters * clear) / model.clearIn3[index], SPEAKER_STEPS.netL),
    vent,
    drivers: chamber.drivers.map((d) => ({
      ...d,
      position: onTop(d) ? scaledPoint(d.position, fx, fz) : scaledPoint(d.position, fx, fy),
    })),
  };
}

// ---- parts ----

/** A driver entry with another part (and, for a datasheet driver, its horn), its count, place and bands kept. */
export function withPart(d: SpeakerDriver, driverId: string, hornId: string | null): SpeakerDriver {
  const horn =
    hornId === null || !d.horn
      ? d.horn
      : hornId === d.horn.hornId
        ? d.horn
        : {
            hornId,
            placement: d.horn.placement,
            mount: (() => {
              const h = hornById(hornId);
              return h && takesHornMountAt(h, d.horn.placement)
                ? (d.horn.mount ?? DEFAULT_PA.hornMount)
                : null;
            })(),
          };
  // boundary cast: the id is a row of the same kind's table (the candidates come from it)
  return { ...d, driverId, horn } as SpeakerDriver;
}

/** One part's price and weight as the catalog lists them (an unpriced part counts 0, and says so). */
export function partFacts(
  kind: DriverKind,
  id: string,
): { price: number; priced: boolean; lb: number; weighed: boolean; size: number | null } {
  const row: { price: number | null; lb: number | null; size?: number } | undefined =
    kind === DRIVER_KIND.sub
      ? byId(SPEAKER_SUB_OPTIONS, id)
      : kind === DRIVER_KIND.mid
        ? byId(MID_OPTIONS, id)
        : kind === DRIVER_KIND.woofer
          ? byId(HIFI_WOOFERS, id)
          : kind === DRIVER_KIND.coaxial
            ? byId(FILL_OPTIONS, id)
            : kind === DRIVER_KIND.compression
              ? byId(CD_OPTIONS, id)
              : byId(HIFI_TWEETERS, id);
  return {
    price: row?.price ?? 0,
    priced: row?.price != null,
    lb: row?.lb ?? 0,
    weighed: row?.lb != null,
    size: row?.size ?? null,
  };
}

/** A horn's price and weight (none: 0). */
export function hornFacts(id: string | null): { price: number; lb: number } {
  const h = id === null ? undefined : hornById(id);
  return { price: h?.price ?? 0, lb: h?.lb ?? 0 };
}

// ---- amps ----

/** The amp groups: each active band alone, and every passive band together (they share one channel). */
export function ampGroups(bands: readonly SpeakerBand[], locks: SpeakerOptimizerLocks): BandId[][] {
  const locked = new Set(locks.amps ?? []);
  const passive = bands.filter((b) => b.drive === HIFI_DRIVE.passive).map((b) => b.id);
  const groups = [
    ...bands.filter((b) => b.drive !== HIFI_DRIVE.passive).map((b) => [b.id]),
    ...(passive.length ? [passive] : []),
  ];
  return groups.filter((g) => g.every((id) => !locked.has(id)));
}

/** How far over a driver's program rating the top amp goes (the trim brings it back down). */
const TOP_OVER_RATING = 2;

/**
 * Each band's top amp power, W into the driver's impedance (lib/power): yours, or twice the strongest candidate's
 * program rating (2 × AES) where that is more, on the amp's step; a locked band keeps yours. Passive bands share the
 * highest.
 */
export function topAmps(
  spec: SpeakerSpec,
  units: readonly SearchUnit[],
  groups: readonly BandId[][],
): Map<BandId, number> {
  const rating = new Map<BandId, number>();
  const raise = (band: BandId, w: number) => rating.set(band, Math.max(rating.get(band) ?? 0, w));
  /** a band's crossover, as the limits derate an HF driver's rating at it (none: the rating as published) */
  const xoOf = (band: BandId) => spec.bands.find((b) => b.id === band)?.highpass?.hz ?? Infinity;
  for (const u of units) {
    if (u.kind === "cone") {
      for (const id of u.drivers) {
        const ts =
          u.driverKind === DRIVER_KIND.sub
            ? byId(SPEAKER_SUB_OPTIONS, id)?.ts
            : u.driverKind === DRIVER_KIND.mid
              ? byId(MID_OPTIONS, id)?.ts
              : u.driverKind === DRIVER_KIND.woofer
                ? byId(HIFI_WOOFERS, id)?.ts
                : byId(FILL_OPTIONS, id)?.ts;
        // the program rating, 2 × AES: the amp power is the watts into the driver
        if (ts) raise(u.bands[0], programWatts(ts.aes));
        const coaxHf = u.driverKind === DRIVER_KIND.coaxial ? byId(FILL_OPTIONS, id)?.hf : null;
        if (coaxHf && u.bands[1])
          raise(
            u.bands[1],
            hfProgramWatts({ aes: coaxHf.aes, aesXo: coaxHf.xo }, xoOf(u.bands[1])),
          );
      }
    } else {
      for (const p of u.parts) {
        const hf =
          spec.cabinet.chambers[u.chamber].drivers[u.entry].kind === DRIVER_KIND.compression
            ? byId(CD_OPTIONS, p.driverId)?.hf
            : byId(HIFI_TWEETERS, p.driverId)?.hf;
        if (hf) raise(u.band, hfProgramWatts(hf, xoOf(u.band)));
      }
    }
  }
  const out = new Map(spec.bands.map((b) => [b.id, b.ampW]));
  for (const group of groups) {
    const top = Math.max(
      ...group.map((id) => {
        const own = out.get(id) ?? 0;
        const r = rating.get(id) ?? 0;
        return Math.max(
          own,
          Math.ceil((TOP_OVER_RATING * r) / SPEAKER_STEPS.ampW) * SPEAKER_STEPS.ampW,
        );
      }),
    );
    for (const id of group) out.set(id, top);
  }
  return out;
}
