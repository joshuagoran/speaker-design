// Cutlist layout: a guillotine sheet packer (straight through-cuts only), grain direction per panel, waterfall
// strips and the offcut the least-full sheet keeps.
import type {
  CutBoxId,
  CutPart,
  CutPartId,
  CutStats,
  CutlistChoices,
  CutlistGroup,
  CutlistLayout,
  CutlistSettings,
  GrainDir,
  GrainPanel,
  GrainPreset,
  GrainSettings,
  Offcut,
  OffcutShape,
  PaDesignConfig,
  PackRect,
  PackedSheet,
  PackedSheets,
  PlacedPart,
  PlywoodSheet,
} from "../../types";
import { PLYWOOD_SHEETS, formatInches } from "./calc";
import { keysOf } from "../records";
import { CUT_BOX_NAMES, CUT_BOX_TAGS } from "../../constants/cutParts";

type SheetSize = Pick<PlywoodSheet, "w" | "h">;
type Rect = Pick<PlacedPart<PackRect>, "x" | "y" | "w" | "h">;

/** Saw kerf choices, inches. */
export const KERF_OPTIONS = [
  { v: 3 / 32, label: "3/32″", tip: "Thin-kerf blade, or a track saw (about 2.2 mm)" },
  { v: 0.125, label: "1/8″", tip: "Full-kerf table saw blade" },
  { v: 0.25, label: "1/4″", tip: "CNC with a 1/4″ bit" },
] as const;
/** Edge trim choices, inches off each factory edge. */
export const TRIM_OPTIONS = [0, 0.25] as const;

export const GRAIN_PRESETS: Record<GrainPreset, GrainSettings> = {
  wrap: { side: "b", topBottom: "b", baffle: "b", back: "b" },
  horizontal: { side: "a", topBottom: "a", baffle: "a", back: "a" },
  none: { side: "any", topBottom: "any", baffle: "any", back: "any" },
};
/** The preset these settings match, or null when they are mixed. */
export const grainPresetOf = (g: GrainSettings): GrainPreset | null =>
  keysOf(GRAIN_PRESETS).find((k) => keysOf(g).every((p) => GRAIN_PRESETS[k][p] === g[p])) ?? null;

/** Which grain setting each part follows; parts not listed take either direction. */
export const GRAIN_PANEL_OF: Partial<Record<CutPartId, GrainPanel>> = {
  side: "side",
  topBottom: "topBottom",
  bottom: "topBottom",
  baffle: "baffle",
  back: "back",
};
/** The narrowest offcut worth reporting, inches. */
export const MIN_OFFCUT_IN = 3;
/** Small parts cut from offcuts, left out of the sheet count. */
export const FROM_OFFCUT: ReadonlySet<CutPartId> = new Set(["baffleCleat", "ductDivider"]);
/** The note on those parts' rows in the cutlist. */
export const FROM_OFFCUT_NOTE = "from offcuts; not in the sheet count";

/** What joins a cutlist row's notes into its `note`; the page shows each as its own line (`noteLines`). */
export const NOTE_SEP = "; ";
/**
 * A row's note as its lines, as the Cutlist page lists them: split at each `NOTE_SEP` outside brackets, so a note such
 * as "5.6″ driver cutout (typical; use the datasheet's)" stays one line.
 */
export const noteLines = (note: string): string[] => {
  const lines: string[] = [];
  let depth = 0,
    from = 0;
  for (let i = 0; i < note.length; i++) {
    const c = note[i];
    if (c === "(") depth++;
    else if (c === ")") depth = Math.max(0, depth - 1);
    else if (depth === 0 && note.startsWith(NOTE_SEP, i)) {
      lines.push(note.slice(from, i));
      from = i + NOTE_SEP.length;
      i = from - 1;
    }
  }
  lines.push(note.slice(from));
  return lines.filter((l) => l.length > 0);
};

/**
 * A cutlist row's identity, which its pieces on the sheets carry too (a placed piece keeps its part's fields): the page
 * matches a row to its drawn pieces by it, also after the layout worker has copied them.
 */
export const cutRowKey = (p: Pick<CutPart, "box" | "part" | "a" | "b" | "t">) =>
  `${p.box}|${p.part}|${p.a}|${p.b}|${p.t}`;

/**
 * The cutlist's rows, one per `cutRowKey`: rows of the same part at the same size (a box's two cleat pairs when its
 * inside is square) become one, their quantities added and their notes joined, so every row gets its own tag and its
 * pieces on the sheets point back to it alone.
 */
export const cutRows = (parts: readonly CutPart[]): CutPart[] => {
  const rows = new Map<string, CutPart>();
  for (const p of parts) {
    const k = cutRowKey(p),
      seen = rows.get(k);
    if (!seen) rows.set(k, { ...p });
    else {
      seen.qty += p.qty;
      if (p.note && !noteLines(seen.note).includes(p.note))
        seen.note = seen.note ? `${seen.note}${NOTE_SEP}${p.note}` : p.note;
    }
  }
  return [...rows.values()];
};

/**
 * Each row's tag, numbered per box in table order (S1, S2 … M1 … H1 …), by `cutRowKey`, and the rows grouped by box.
 * Its pieces on the sheets carry the same tag; rows are one per key (`cutRows`), so no two share a tag.
 */
export const cutRowTags = (rows: readonly CutPart[]) => {
  const tags = new Map<string, string>();
  const byBox = new Map<CutBoxId, CutPart[]>();
  for (const p of rows) {
    const list = byBox.get(p.box) ?? [];
    list.push(p);
    byBox.set(p.box, list);
    tags.set(cutRowKey(p), `${CUT_BOX_TAGS[p.box]}${list.length}`);
  }
  return { tags, byBox };
};

/** Reads saved grain settings, falling back to the default for anything missing or unknown. */
const savedGrain = (g: Partial<Record<GrainPanel, unknown>> | undefined): GrainSettings => {
  const out = { ...GRAIN_PRESETS.wrap };
  if (g)
    for (const p of keysOf(out)) {
      const v = g[p];
      if (v === "a" || v === "b" || v === "any") out[p] = v;
    }
  return out;
};

/** The cutlist choices a new design starts with. */
export const CUTLIST_DEFAULTS: CutlistChoices = {
  kerf: 0.125,
  trim: 0,
  grain: GRAIN_PRESETS.wrap,
  waterfall: false,
  offcut: "strip",
  cuts: "sheets",
};

/**
 * A saved design's cutlist choices, each checked against what the page offers; anything missing or unknown falls back
 * to the default (waterfall: on with miter joints, as older designs had none).
 */
export const savedCutlist = (
  c: Pick<PaDesignConfig, keyof CutlistChoices | "joint">,
): CutlistChoices => ({
  kerf: KERF_OPTIONS.find((k) => k.v === c.kerf)?.v ?? CUTLIST_DEFAULTS.kerf,
  trim: TRIM_OPTIONS.find((v) => v === c.trim) ?? CUTLIST_DEFAULTS.trim,
  grain: savedGrain(c.grain),
  waterfall: typeof c.waterfall === "boolean" ? c.waterfall : c.joint === "miter",
  offcut: c.offcut === "panel" ? "panel" : CUTLIST_DEFAULTS.offcut,
  cuts: c.cuts === "rips" ? "rips" : CUTLIST_DEFAULTS.cuts,
});

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

interface Item<R> {
  r: R;
  /** the [w, h] it may be placed at; h runs along the sheet's length */
  opts: [number, number][];
  crossed: boolean;
  area: number;
}
interface Run<R> {
  sheets: { free: Rect[]; items: PlacedPart<R>[]; area: number }[];
}

export interface PackOptions {
  /** squared off each edge, inches */
  trim?: number;
  /** how many packing runs to try: the first `DETERMINISTIC_RUNS` are the sorted orders, the rest a seeded random search */
  runs?: number;
  /** a safety stop for the main thread, ms; without one (as in the worker) the result depends only on the input */
  capMs?: number;
  seed?: number;
  /** rip each sheet into full-length strips before any crosscut (table saw friendly) */
  ripFirst?: boolean;
}
/** Every sorted order with every fit and split rule, first-fit and best-fit sheet choice. */
export const DETERMINISTIC_RUNS = 6 * FITS.length * SPLITS.length * 2;
/** The full search the Cutlist tab and the optimizer cards' exact counts run (about 50 ms on average). */
export const SEARCH_RUNS = 5000;
/** The time cap on that search when it has to run on the main thread, ms. */
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
  const both: [number, number][] = [
    [r.a, r.b],
    [r.b, r.a],
  ];
  const opts = both.filter(fits);
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
  ripFirst: boolean,
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
    // rip first: a free area still the sheet's full length is only ever split by a rip
    const horizontal =
      ripFirst && fr.h >= Hk - EPS
        ? false
        : split === "shortLeft"
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

/** Compares scores in order: negative when `p` is better. */
const compare = (p: number[], q: number[]) => {
  for (let i = 0; i < p.length; i++) if (Math.abs(p[i] - q[i]) > EPS) return p[i] - q[i];
  return 0;
};

/**
 * Packs parts onto sheets with straight through-cuts only (guillotine), `kerf` between parts and `trim` off each edge.
 * Locked parts (`grain` "a" or "b") keep that dimension along the sheet's length (`h`); others rotate freely. It tries
 * several orders, fit rules and split rules, then a seeded random search, and stops early at the area bound.
 */
export function packSheets<R extends PackRect>(
  rects: R[],
  sheet: SheetSize,
  kerf: number,
  {
    trim = 0,
    runs: maxRuns = DETERMINISTIC_RUNS,
    capMs = Infinity,
    seed = 1,
    ripFirst = false,
  }: PackOptions = {},
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
    const r = runOnce(order, Wk, Hk, kerf, trim, fit, split, bestSheet, minDim, ripFirst);
    if (bestScore && r.sheets.length > bestScore[0]) return;
    // fewer sheets, then fewer full-width crosscuts, then the emptiest sheet as empty as it can be (a bigger offcut)
    const s = [
      r.sheets.length,
      r.sheets.reduce((a, sh) => a + fullWidthCrosscuts(sh.items, sheet, kerf, trim), 0),
      Math.min(...r.sheets.map((sh) => sh.area)),
    ];
    if (!bestScore || compare(s, bestScore) <= 0) {
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
// Cut counts
// ---------------------------------------------------------------
interface Span {
  from: number;
  to: number;
  items: Rect[];
}

/** The parts' spans along one axis inside [lo, hi], merged where less than a kerf apart, and the cuts that separate them. */
function spans(items: Rect[], axis: "x" | "y", lo: number, hi: number, kerf: number) {
  const size = axis === "x" ? "w" : "h";
  const bands: Span[] = [];
  for (const it of items.slice().sort((p, q) => p[axis] - q[axis])) {
    const last = bands[bands.length - 1],
      from = it[axis],
      to = it[axis] + it[size];
    if (last && from < last.to + kerf - EPS) {
      last.to = Math.max(last.to, to);
      last.items.push(it);
    } else bands.push({ from, to, items: [it] });
  }
  // one cut between touching bands, two around a gap, one at each end that stops short of the edge
  let cuts = 0;
  bands.forEach((b, i) => {
    if (i === 0 ? b.from > lo + EPS : b.from - bands[i - 1].to > kerf + EPS) cuts++;
    if (i > 0) cuts++;
  });
  const end = bands[bands.length - 1];
  if (end && end.to < hi - EPS) cuts++;
  return { bands, cuts };
}

/**
 * `cutStats(...).crosscuts`, quicker: a full-width crosscut can only come before any rip, so only the top level counts.
 */
function fullWidthCrosscuts(items: Rect[], S: SheetSize, kerf: number, trim: number) {
  if (spans(items, "x", trim, S.w - trim, kerf).cuts) return 0;
  return spans(items, "y", trim, S.h - trim, kerf).cuts;
}

/**
 * How a sheet is cut, reading the layout as a table saw would take it (rips first wherever it can): `rips` run the
 * sheet's full length, `crosscuts` its full width, and `widestCrosscut` is the widest piece any crosscut goes through.
 */
export function cutStats(items: Rect[], S: SheetSize, kerf: number, trim: number): CutStats {
  const out: CutStats = { rips: 0, crosscuts: 0, widestCrosscut: 0 };
  const W0 = trim,
    W1 = S.w - trim,
    H0 = trim,
    H1 = S.h - trim;
  const walk = (its: Rect[], x0: number, x1: number, y0: number, y1: number) => {
    if (!its.length) return;
    const v = spans(its, "x", x0, x1, kerf);
    if (v.cuts) {
      if (y0 <= H0 + EPS && y1 >= H1 - EPS) out.rips += v.cuts;
      for (const b of v.bands) walk(b.items, b.from, b.to, y0, y1);
      return;
    }
    const h = spans(its, "y", y0, y1, kerf);
    if (!h.cuts) return; // one part filling its piece
    if (x0 <= W0 + EPS && x1 >= W1 - EPS) out.crosscuts += h.cuts;
    out.widestCrosscut = Math.max(out.widestCrosscut, x1 - x0);
    for (const b of h.bands) walk(b.items, x0, x1, b.from, b.to);
  };
  walk(items, W0, W1, H0, H1);
  return out;
}

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
  S: SheetSize,
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
  S: SheetSize,
  kerf: number,
  trim: number,
  shape: OffcutShape,
  ripFirst: boolean,
): { sheet: PackedSheet<R>; offcut: Offcut | null } {
  const size = (o: Offcut | null) => (o ? (shape === "strip" ? o.w : o.h) : 0);
  let bestSheet = sheet,
    bestOff = offcutOf(sheet, idx, S, kerf, trim, shape);
  // placed parts repack as they are: a new placement overwrites the position, size and grain flag
  const parts = sheet.items;
  const full = shape === "strip" ? S.w : S.h;
  const crossed = (sh: PackedSheet<R>) => sh.items.filter((it) => it.crossed).length;
  // a smaller sheet only counts as a fit if no part has to turn across the grain to get on it
  const fitsIn = (len: number) => {
    const p = packSheets(parts, shape === "strip" ? { w: len, h: S.h } : { w: S.w, h: len }, kerf, {
      trim,
      ripFirst,
    });
    const sh = p.sheets.length === 1 && !p.tooBig.length ? p.sheets[0] : null;
    return sh && crossed(sh) <= crossed(sheet) ? sh : null;
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
 * sheet. Mitered panels lose about a kerf at each V-cut; square cuts lose a kerf.
 */
export function waterfallStrips(
  parts: CutPart[],
  s: Pick<CutlistSettings, "kerf" | "joint">,
  usable: SheetSize,
): { parts: CutPart[]; notes: string[] } {
  const notes: string[] = [];
  let out = parts;
  for (const box of new Set(parts.map((p) => p.box))) {
    const side = out.find((p) => p.box === box && p.part === "side"),
      top = out.find((p) => p.box === box && p.part === "topBottom");
    if (!side || !top || side.qty < 2 || top.qty < 1) continue;
    const gap = s.joint === "miter" ? s.kerf * Math.SQRT2 : s.kerf;
    const len = 2 * side.b + top.b + 2 * gap,
      wide = Math.max(side.a, top.a);
    if (len > usable.h + EPS || wide > usable.w + EPS) {
      notes.push(
        `${CUT_BOX_NAMES[box]}: the side-top-side strip is ${formatInches(len)}″, longer than the sheet's ${formatInches(usable.h)}″. Cut the sides and top separately.`,
      );
      continue;
    }
    const strip: CutPart = {
      box,
      part: "sideTopSideStrip",
      qty: side.qty / 2,
      a: wide,
      b: len,
      t: side.t,
      note: `side ${formatInches(side.b)}, top ${formatInches(top.b)}, side ${formatInches(side.b)}, cut in that sequence so the grain is continuous over the top corners; ${side.note}`,
      grain: "b",
      pieces: [side.b, top.b, side.b],
    };
    out = out.flatMap((p) =>
      p === side ? [strip] : p === top ? [{ ...top, part: "bottom", qty: top.qty / 2 }] : [p],
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
  /** sheet counts only: skip the offcut repack and the rip-first comparison */
  countsOnly?: boolean;
}

/** The cutlist for one stack's parts laid out with the settings: waterfall strips, grain, offcut parts set aside, sheets packed. */
export function layoutCutlist(
  perStack: CutPart[],
  s: CutlistSettings,
  { runs, capMs, countsOnly = false }: LayoutOptions = {},
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
      const ripFirst = s.cuts === "rips";
      const packed = packSheets(list, S, s.kerf, { trim: s.trim, runs, capMs, ripFirst });
      let sheets = packed.sheets,
        off: Offcut | null = null;
      if (!countsOnly && sheets.length) {
        // the least-full sheet goes last and keeps the offcut
        const fill = sheets.map((sh) => sh.items.reduce((a, it) => a + it.w * it.h, 0));
        const k = fill.indexOf(Math.min(...fill));
        sheets = [...sheets.slice(0, k), ...sheets.slice(k + 1), sheets[k]];
        const last = sheets.length - 1;
        // keeping a full-width panel takes a full-width crosscut, which rip first rules out
        const shape = ripFirst ? "strip" : s.offcut;
        const r = repackForOffcut(sheets[last], last, S, s.kerf, s.trim, shape, ripFirst);
        sheets[last] = r.sheet;
        // a sliver isn't worth keeping
        off = r.offcut && Math.min(r.offcut.w, r.offcut.h) >= MIN_OFFCUT_IN ? r.offcut : null;
      }
      const cuts = sheets
        .map((sh) => cutStats(sh.items, S, s.kerf, s.trim))
        .reduce(
          (a, c) => ({
            rips: a.rips + c.rips,
            crosscuts: a.crosscuts + c.crosscuts,
            widestCrosscut: Math.max(a.widestCrosscut, c.widestCrosscut),
          }),
          { rips: 0, crosscuts: 0, widestCrosscut: 0 },
        );
      // what rip-first costs: the sheet count without it
      const fewestSheets =
        ripFirst && !countsOnly
          ? packSheets(list, S, s.kerf, { trim: s.trim, runs, capMs }).sheets.length
          : null;
      return { t, sheets, tooBig: packed.tooBig, offcut: off, cuts, fewestSheets };
    });
  return { parts, fromOffcut, groups, notes: wf.notes };
}
