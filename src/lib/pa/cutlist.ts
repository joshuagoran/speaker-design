// Cutlist layout: a guillotine sheet packer (straight through-cuts only), grain direction per panel, waterfall
// strips and the offcut the least-full sheet keeps.
import type {
  CutPart,
  CutPartName,
  CutlistGroup,
  CutlistLayout,
  CutlistSettings,
  GrainDir,
  GrainPanel,
  GrainPreset,
  GrainSettings,
  Offcut,
  OffcutShape,
  PackRect,
  PackedSheet,
  PackedSheets,
  PlacedPart,
} from "../../types";
import { PLYWOOD_SHEETS, formatInches } from "./calc";

/** Saw kerf choices, inches. */
export const KERF_OPTIONS = [
  { v: 3 / 32, label: "3/32″", tip: "Thin-kerf blade, or a track saw (about 2.2 mm)" },
  { v: 0.125, label: "1/8″", tip: "Full-kerf table saw blade" },
  { v: 0.25, label: "1/4″", tip: "CNC with a 1/4″ bit" },
] as const;
/** Edge trim choices, inches off each factory edge. */
export const TRIM_OPTIONS = [0, 0.25] as const;

export const GRAIN_PRESETS: Record<GrainPreset, GrainSettings> = {
  wrap: { Side: "b", "Top / bottom": "b", Baffle: "b", Back: "b" },
  horizontal: { Side: "a", "Top / bottom": "a", Baffle: "a", Back: "a" },
  none: { Side: "any", "Top / bottom": "any", Baffle: "any", Back: "any" },
};
/** The preset these settings match, or null when they are mixed. */
export const grainPresetOf = (g: GrainSettings): GrainPreset | null =>
  (Object.keys(GRAIN_PRESETS) as GrainPreset[]).find((k) =>
    // boundary cast: Object.keys loses the record's key type
    (Object.keys(g) as GrainPanel[]).every((p) => GRAIN_PRESETS[k][p] === g[p]),
  ) ?? null;

/** Which grain setting each part follows; parts not listed take either direction. */
export const GRAIN_PANEL_OF: Partial<Record<CutPartName, GrainPanel>> = {
  Side: "Side",
  "Top / bottom": "Top / bottom",
  Bottom: "Top / bottom",
  Baffle: "Baffle",
  Back: "Back",
};
/** The narrowest offcut worth reporting, inches. */
export const MIN_OFFCUT_IN = 3;
/** Small parts cut from offcuts, left out of the sheet count. */
export const FROM_OFFCUT: ReadonlySet<CutPartName> = new Set(["Baffle cleat", "Duct divider"]);

/** Reads saved grain settings, falling back to the default for anything missing or unknown. */
export const savedGrain = (g: Partial<Record<GrainPanel, unknown>> | undefined): GrainSettings => {
  const out = { ...GRAIN_PRESETS.wrap };
  if (g)
    for (const p of Object.keys(out) as GrainPanel[]) {
      const v = g[p];
      if (v === "a" || v === "b" || v === "any") out[p] = v;
    }
  return out;
};

// ---------------------------------------------------------------
// Guillotine packer
// ---------------------------------------------------------------
type FitRule = "area" | "short" | "long" | "corner";
type SplitRule = "shortLeft" | "longLeft" | "minArea" | "maxArea" | "shortAxis" | "longAxis";
const FITS: FitRule[] = ["area", "short", "long", "corner"];
const SPLITS: SplitRule[] = [
  "shortLeft",
  "longLeft",
  "minArea",
  "maxArea",
  "shortAxis",
  "longAxis",
];
const EPS = 1e-9;

interface Free {
  x: number;
  y: number;
  w: number;
  h: number;
}
interface Item<R> {
  r: R;
  /** the [w, h] it may be placed at; h runs along the sheet's length */
  opts: [number, number][];
  crossed: boolean;
  area: number;
}
interface Run<R> {
  sheets: { free: Free[]; items: PlacedPart<R>[]; area: number }[];
}

export interface PackOptions {
  /** squared off each edge, inches */
  trim?: number;
  /** how many packing runs to try: the first `DETERMINISTIC_RUNS` are the sorted orders, the rest a seeded random search */
  runs?: number;
  /** a safety stop on slow machines, ms; within it the result depends only on the input */
  capMs?: number;
  seed?: number;
}
/** Every sorted order with every fit and split rule, first-fit and best-fit sheet choice. */
export const DETERMINISTIC_RUNS = 6 * FITS.length * SPLITS.length * 2;
/** The Cutlist tab's and the optimizer cards' search: the same runs, so their sheet counts agree (about 50 ms on average). */
export const SEARCH_RUNS = 5000;
/** The time cap on that search, ms. */
export const SEARCH_CAP_MS = 1500;

// a small seeded generator, so the same input gives the same layout
const mulberry32 = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

/** The orientations a part may take on a W × H area: locked parts one, others both. */
function orient<R extends PackRect>(r: R, W: number, H: number): Item<R> | null {
  const fits = ([w, h]: [number, number]) => w <= W + EPS && h <= H + EPS;
  const area = r.a * r.b;
  if (r.grain === "a" || r.grain === "b") {
    const along: [number, number] = r.grain === "b" ? [r.a, r.b] : [r.b, r.a];
    if (fits(along)) return { r, opts: [along], crossed: false, area };
    const across: [number, number] = [along[1], along[0]];
    return fits(across) ? { r, opts: [across], crossed: true, area } : null;
  }
  const opts = (
    [
      [r.a, r.b],
      [r.b, r.a],
    ] as [number, number][]
  ).filter(fits);
  if (opts.length === 2 && Math.abs(r.a - r.b) < EPS) opts.pop();
  return opts.length ? { r, opts, crossed: false, area } : null;
}

const ORDERS: ((p: Item<PackRect>, q: Item<PackRect>) => number)[] = [
  (p, q) => q.area - p.area,
  (p, q) => maxSide(q) - maxSide(p) || minSide(q) - minSide(p),
  (p, q) => minSide(q) - minSide(p) || maxSide(q) - maxSide(p),
  (p, q) => q.r.a + q.r.b - (p.r.a + p.r.b),
  (p, q) => tallest(q) - tallest(p) || q.area - p.area,
  (p, q) => widest(q) - widest(p) || q.area - p.area,
];
const maxSide = (i: Item<PackRect>) => Math.max(i.r.a, i.r.b);
const minSide = (i: Item<PackRect>) => Math.min(i.r.a, i.r.b);
const tallest = (i: Item<PackRect>) => Math.max(...i.opts.map((o) => o[1]));
const widest = (i: Item<PackRect>) => Math.max(...i.opts.map((o) => o[0]));

/** One greedy pass: each part goes in the free rectangle the fit rule likes best, and the rest splits by the split rule. */
function runOnce<R extends PackRect>(
  items: Item<R>[],
  Wk: number,
  Hk: number,
  kerf: number,
  trim: number,
  fit: FitRule,
  split: SplitRule,
  bestSheet: boolean,
  minDim: number,
): Run<R> {
  const sheets: Run<R>["sheets"] = [];
  const newSheet = () => {
    sheets.push({ free: [{ x: 0, y: 0, w: Wk, h: Hk }], items: [], area: 0 });
    return sheets.length - 1;
  };
  for (const it of items) {
    let best: { si: number; fi: number; w: number; h: number; s1: number; s2: number } | null =
      null;
    const scan = (si: number) => {
      const free = sheets[si].free;
      for (let fi = 0; fi < free.length; fi++) {
        const fr = free[fi];
        for (const [w, h] of it.opts) {
          const wk = w + kerf,
            hk = h + kerf;
          if (wk > fr.w + EPS || hk > fr.h + EPS) continue;
          const rw = fr.w - wk,
            rh = fr.h - hk;
          // corner: the free rectangle nearest the sheet's top, then its left
          const s1 =
            fit === "area"
              ? fr.w * fr.h - wk * hk
              : fit === "short"
                ? Math.min(rw, rh)
                : fit === "long"
                  ? Math.max(rw, rh)
                  : fr.y;
          const s2 = fit === "corner" ? fr.x : fit === "long" ? Math.min(rw, rh) : Math.max(rw, rh);
          if (!best || s1 < best.s1 - EPS || (s1 < best.s1 + EPS && s2 < best.s2 - EPS))
            best = { si, fi, w, h, s1, s2 };
        }
      }
    };
    for (let si = 0; si < sheets.length; si++) {
      scan(si);
      if (best && !bestSheet) break;
    }
    if (!best) scan(newSheet());
    // orient() only keeps orientations that fit an empty sheet
    if (!best) continue;
    const { si, fi, w, h } = best,
      sh = sheets[si],
      fr = sh.free[fi];
    sh.items.push({ ...it.r, x: fr.x + trim, y: fr.y + trim, w, h, crossed: it.crossed });
    sh.area += w * h;
    sh.free.splice(fi, 1);
    const wk = w + kerf,
      hk = h + kerf,
      rw = fr.w - wk,
      rh = fr.h - hk;
    const horizontal =
      split === "shortLeft"
        ? rw <= rh
        : split === "longLeft"
          ? rw > rh
          : split === "minArea"
            ? wk * rh > rw * hk
            : split === "maxArea"
              ? wk * rh <= rw * hk
              : split === "shortAxis"
                ? fr.w <= fr.h
                : fr.w > fr.h;
    // horizontal: the cut below the part runs the whole free width; vertical: the cut beside it runs the whole height
    const below = { x: fr.x, y: fr.y + hk, w: horizontal ? fr.w : wk, h: rh };
    const beside = { x: fr.x + wk, y: fr.y, w: rw, h: horizontal ? hk : fr.h };
    for (const f of [below, beside])
      if (f.w >= minDim - EPS && f.h >= minDim - EPS) sh.free.push(f);
  }
  return { sheets };
}

/** Fewer sheets first, then the emptiest sheet as empty as it can be (a bigger offcut). */
const runScore = (r: Run<PackRect>) => [r.sheets.length, Math.min(...r.sheets.map((s) => s.area))];
const better = (p: number[], q: number[] | null) =>
  !q || p[0] < q[0] || (p[0] === q[0] && p[1] < q[1] - EPS);

/**
 * Packs parts onto sheets with straight through-cuts only (guillotine), `kerf` between parts and `trim` off each edge.
 * Locked parts (`grain` "a" or "b") keep that dimension along the sheet's length (`h`); others rotate freely. It tries
 * several orders, fit rules and split rules, then a seeded random search, and stops early at the area bound.
 */
export function packSheets<R extends PackRect>(
  rects: R[],
  sheet: { w: number; h: number },
  kerf: number,
  { trim = 0, runs: maxRuns = DETERMINISTIC_RUNS, capMs = Infinity, seed = 1 }: PackOptions = {},
): PackedSheets<R> {
  const W = sheet.w - 2 * trim,
    H = sheet.h - 2 * trim,
    Wk = W + kerf,
    Hk = H + kerf;
  const items: Item<R>[] = [],
    tooBig: R[] = [];
  for (const r of rects) {
    const it = orient(r, W, H);
    if (it) items.push(it);
    else tooBig.push(r);
  }
  if (!items.length) return { sheets: [], tooBig };
  const minDim = Math.min(...items.map((i) => Math.min(...i.opts.flat()))) + kerf;
  const bound = Math.max(
    1,
    Math.ceil(
      items.reduce((s, i) => s + (i.opts[0][0] + kerf) * (i.opts[0][1] + kerf), 0) / (Wk * Hk) -
        EPS,
    ),
  );
  let best: Run<R> | null = null,
    bestScore: number[] | null = null,
    bestRules: [Item<R>[], FitRule, SplitRule, boolean] | null = null;
  const tryRun = (order: Item<R>[], fit: FitRule, split: SplitRule, bestSheet: boolean) => {
    const r = runOnce(order, Wk, Hk, kerf, trim, fit, split, bestSheet, minDim);
    const s = runScore(r);
    if (better(s, bestScore) || (bestScore && s[0] === bestScore[0] && s[1] <= bestScore[1])) {
      // equal scores move the search along too, so it can cross plateaus
      best = r;
      bestScore = s;
      bestRules = [order, fit, split, bestSheet];
    }
  };
  const t0 = now();
  let runs = 0;
  const sorted = ORDERS.map((o) => items.slice().sort(o));
  done: for (const order of sorted)
    for (const fit of FITS)
      for (const split of SPLITS)
        for (const bestSheet of [false, true]) {
          if (runs++ >= maxRuns) break done;
          tryRun(order, fit, split, bestSheet);
        }
  // randomized restarts until the budget: mostly a few swaps in the best order so far (a local search), sometimes a
  // fresh order with its sort key jittered and random rules
  const rnd = mulberry32(seed);
  const pick = <T>(xs: readonly T[]) => xs[Math.floor(rnd() * xs.length)];
  while (bestScore && bestRules && bestScore[0] > bound && runs++ < maxRuns && now() - t0 < capMs) {
    // boundary cast: TypeScript can't see the assignment inside the tryRun closure, so it narrows these to never
    const [order0, fit0, split0, sheet0] = bestRules as [Item<R>[], FitRule, SplitRule, boolean];
    if (rnd() < 0.8 && items.length > 1) {
      const order = order0.slice();
      for (let n = 1 + Math.floor(rnd() * 3); n > 0; n--) {
        const i = Math.floor(rnd() * order.length),
          j = Math.floor(rnd() * order.length);
        [order[i], order[j]] = [order[j], order[i]];
      }
      tryRun(
        order,
        rnd() < 0.7 ? fit0 : pick(FITS),
        rnd() < 0.7 ? split0 : pick(SPLITS),
        rnd() < 0.8 ? sheet0 : !sheet0,
      );
    } else {
      const order = items
        .map((i) => ({ i, k: i.area * (0.6 + 0.8 * rnd()) }))
        .sort((p, q) => q.k - p.k)
        .map((x) => x.i);
      tryRun(order, pick(FITS), pick(SPLITS), rnd() < 0.5);
    }
  }
  // boundary cast: TypeScript can't see the assignment inside the tryRun closure, so it narrows `best` to null
  const won = best as Run<R> | null;
  return { sheets: won ? won.sheets.map((s) => ({ items: s.items })) : [], tooBig };
}
const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

// ---------------------------------------------------------------
// Offcut
// ---------------------------------------------------------------
/**
 * The largest full-length strip (`strip`) or full-width panel (`panel`) left free on a sheet, after a kerf beside each
 * part it borders. Null when there is none.
 */
export function offcutOf(
  sheet: PackedSheet<PackRect>,
  idx: number,
  S: { w: number; h: number },
  kerf: number,
  trim: number,
  shape: OffcutShape,
): Offcut | null {
  const strip = shape === "strip",
    lo = trim,
    hi = (strip ? S.w : S.h) - trim;
  const spans = sheet.items
    .map((it) => (strip ? [it.x, it.x + it.w] : [it.y, it.y + it.h]))
    .sort((p, q) => p[0] - q[0]);
  let best: { from: number; size: number } | null = null,
    at = lo,
    edge = true;
  const gap = (end: number, closes: boolean) => {
    const from = edge ? at : at + kerf;
    const size = end - from - (closes ? kerf : 0);
    if (size > EPS && (!best || size > best.size)) best = { from, size };
  };
  for (const [a, b] of spans) {
    if (a > at + EPS) gap(a, true);
    if (b > at) {
      at = b;
      edge = false;
    }
  }
  gap(hi, false);
  // boundary cast: TypeScript can't see the assignment inside the gap closure, so it narrows `best` to null
  const won = best as { from: number; size: number } | null;
  if (!won) return null;
  return strip
    ? { sheet: idx, x: won.from, y: trim, w: won.size, h: S.h - 2 * trim }
    : { sheet: idx, x: trim, y: won.from, w: S.w - 2 * trim, h: won.size };
}

/**
 * Repacks one sheet's parts to free the widest full-length strip (or tallest full-width panel): the narrowest (or
 * shortest) sheet they still fit on one of, found by bisection. Returns the better of that and the sheet as it is.
 */
function repackForOffcut<R extends PackRect>(
  sheet: PackedSheet<R>,
  idx: number,
  S: { w: number; h: number },
  kerf: number,
  trim: number,
  shape: OffcutShape,
): { sheet: PackedSheet<R>; offcut: Offcut | null } {
  const size = (o: Offcut | null) => (o ? (shape === "strip" ? o.w : o.h) : 0);
  let bestSheet = sheet,
    bestOff = offcutOf(sheet, idx, S, kerf, trim, shape);
  // placed parts repack as they are: a new placement overwrites the position, size and grain flag
  const parts = sheet.items;
  const full = shape === "strip" ? S.w : S.h;
  const fitsIn = (len: number) => {
    const p = packSheets(parts, shape === "strip" ? { w: len, h: S.h } : { w: S.w, h: len }, kerf, {
      trim,
    });
    return p.sheets.length === 1 && !p.tooBig.length ? p.sheets[0] : null;
  };
  let lo = 0,
    hi = full,
    found: PackedSheet<R> | null = null;
  while (hi - lo > 1 / 16) {
    const mid = (lo + hi) / 2,
      s = fitsIn(mid);
    if (s) {
      hi = mid;
      found = s;
    } else lo = mid;
  }
  if (found) {
    const off = offcutOf(found, idx, S, kerf, trim, shape);
    if (size(off) > size(bestOff) + EPS) {
      bestSheet = found;
      bestOff = off;
    }
  }
  return { sheet: bestSheet, offcut: bestOff };
}

// ---------------------------------------------------------------
// The cutlist with settings applied
// ---------------------------------------------------------------
/**
 * Replaces each box's two sides and top with one side-top-side strip, grain along its length, when it fits on the
 * sheet. Mitred panels lose about a kerf at each V-cut; square cuts lose a kerf.
 */
export function waterfallStrips(
  parts: CutPart[],
  s: Pick<CutlistSettings, "kerf" | "joint">,
  usable: { w: number; h: number },
): { parts: CutPart[]; notes: string[] } {
  const notes: string[] = [];
  let out = parts;
  for (const box of new Set(parts.map((p) => p.box))) {
    const side = out.find((p) => p.box === box && p.part === "Side"),
      top = out.find((p) => p.box === box && p.part === "Top / bottom");
    if (!side || !top || side.qty < 2 || top.qty < 1) continue;
    const gap = s.joint === "miter" ? s.kerf * Math.SQRT2 : s.kerf;
    const len = 2 * side.b + top.b + 2 * gap,
      wide = Math.max(side.a, top.a);
    if (len > usable.h + EPS || wide > usable.w + EPS) {
      notes.push(
        `${box}: the side-top-side strip would be ${formatInches(len)}″ long, more than the sheet's ${formatInches(usable.h)}″; sides and top are cut separately.`,
      );
      continue;
    }
    const strip: CutPart = {
      box,
      part: "Side-top-side strip",
      qty: side.qty / 2,
      a: wide,
      b: len,
      t: side.t,
      note: `side ${formatInches(side.b)}, top ${formatInches(top.b)}, side ${formatInches(side.b)}, cut in that order so the grain runs over the top corners; ${side.note}`,
      grain: "b",
      pieces: [side.b, top.b, side.b],
    };
    out = out.flatMap((p) =>
      p === side ? [strip] : p === top ? [{ ...top, part: "Bottom", qty: top.qty / 2 }] : [p],
    );
  }
  return { parts: out, notes };
}

/** Each part with its grain direction from the settings. */
export const withGrain = (parts: CutPart[], grain: GrainSettings): CutPart[] =>
  parts.map((p) => {
    const panel = GRAIN_PANEL_OF[p.part];
    const g: GrainDir = p.grain ?? (panel ? grain[panel] : "any");
    return g === "any" ? { ...p, grain: undefined } : { ...p, grain: g };
  });

export interface LayoutOptions extends Pick<PackOptions, "runs" | "capMs"> {
  /** repack the least-full sheet for the offcut shape */
  offcut?: boolean;
}

/** The cutlist for one stack's parts laid out with the settings: waterfall strips, grain, offcut parts set aside, sheets packed. */
export function layoutCutlist(
  perStack: CutPart[],
  s: CutlistSettings,
  { runs, capMs, offcut = true }: LayoutOptions = {},
): CutlistLayout {
  const S = PLYWOOD_SHEETS[s.sheet],
    usable = { w: S.w - 2 * s.trim, h: S.h - 2 * s.trim };
  const wf = s.waterfall ? waterfallStrips(perStack, s, usable) : { parts: perStack, notes: [] };
  const parts = withGrain(wf.parts, s.grain);
  const fromOffcut = parts.filter((p) => FROM_OFFCUT.has(p.part));
  const byT = new Map<number, CutPart[]>();
  for (const p of parts) {
    if (FROM_OFFCUT.has(p.part)) continue;
    const list = byT.get(p.t) ?? [];
    for (let i = 0; i < p.qty * s.stacks; i++) list.push(p);
    byT.set(p.t, list);
  }
  const groups: CutlistGroup[] = [...byT]
    .sort(([a], [b]) => b - a)
    .map(([t, list]) => {
      const packed = packSheets(list, S, s.kerf, { trim: s.trim, runs, capMs });
      let sheets = packed.sheets,
        off: Offcut | null = null;
      if (offcut && sheets.length) {
        // the least-full sheet goes last and keeps the offcut
        const fill = sheets.map((sh) => sh.items.reduce((a, it) => a + it.w * it.h, 0));
        const k = fill.indexOf(Math.min(...fill));
        sheets = [...sheets.slice(0, k), ...sheets.slice(k + 1), sheets[k]];
        const last = sheets.length - 1;
        const r = repackForOffcut(sheets[last], last, S, s.kerf, s.trim, s.offcut);
        sheets[last] = r.sheet;
        // a sliver isn't worth keeping
        off = r.offcut && Math.min(r.offcut.w, r.offcut.h) >= MIN_OFFCUT_IN ? r.offcut : null;
      }
      return { t, sheets, tooBig: packed.tooBig, offcut: off };
    });
  return { parts, fromOffcut, groups, notes: wf.notes };
}
