// Panel thickness: the one place the boxes read their wall thickness and panel weight from. A design picks a nominal
// size (PANEL_NOMINAL_NAMES); the Cutlist page keeps the measured thickness of each (PanelExactIn), and everything that
// depends on the walls (box volume, cutlist sizes and joints, the 3D view, weights) is worked out at `panelIn`.
import { PANEL_STOCK } from "../data/catalog/plywood";
import { PANEL_NOMINAL_NAMES } from "../constants/panelSizes";
import type {
  PaDesignConfig,
  PanelExactIn,
  PanelMaterial,
  PanelNominal,
  PanelStockMaterial,
} from "../types";
import { keysOf } from "./records";

/** Every nominal size, thickest first, as the settings offer them. */
export const PANEL_NOMINALS = keysOf(PANEL_STOCK);

/** Whether a stored value is a nominal size's id. */
export const isPanelNominal = (v: unknown): v is PanelNominal =>
  typeof v === "string" && Object.hasOwn(PANEL_STOCK, v);

/** The thickness a nominal size starts at in a material before the Cutlist page has a measured one, inches. */
export const defaultPanelIn = (n: PanelNominal, mat: PanelMaterial) => PANEL_STOCK[n][mat].t;

/**
 * The thickness the boxes are worked out at for a nominal size, inches: the Cutlist page's measured one, else the
 * material's default.
 */
export const panelIn = (n: PanelNominal, mat: PanelMaterial, exact: PanelExactIn = {}) =>
  exact[n] ?? defaultPanelIn(n, mat);

/** Each nominal size's thickness, thickest size first and each thickness once: the walls the optimizers try. */
export const panelChoicesIn = (mat: PanelMaterial, exact: PanelExactIn = {}) => [
  ...new Set(PANEL_NOMINALS.map((n) => panelIn(n, mat, exact))),
];

/**
 * The thickness a measurement may set for a nominal size, inches: within a tenth of the size. That takes in the usual
 * undersized sheets (18 mm birch at 0.689″, 23/32″, 15/32″) while keeping ½″ under the extra-brace line and ⅝″ over
 * it, and no size can be measured at another size's nominal thickness.
 */
export const panelExactRange = (n: PanelNominal) => ({
  min: +(PANEL_STOCK[n].in * 0.9).toFixed(3),
  max: +(PANEL_STOCK[n].in * 1.1).toFixed(3),
});

/** Each material's default thickness and weight per size, thinnest first, built once: the optimizers weigh every candidate. */
const WEIGHT_POINTS: Record<PanelMaterial, PanelStockMaterial[]> = {
  ply: PANEL_NOMINALS.map((n) => PANEL_STOCK[n].ply).sort((a, b) => a.t - b.t),
  mdf: PANEL_NOMINALS.map((n) => PANEL_STOCK[n].mdf).sort((a, b) => a.t - b.t),
};

/**
 * A panel's weight at a thickness, lb/ft²: the catalogue's weight at a size's default thickness, linear between two
 * sizes, and in proportion to the nearest size beyond the thinnest or thickest. A measured 18 mm sheet (0.689″) weighs
 * between the ⅝″ and ¾″ entries.
 */
export function panelLbPerSqFt(t: number, mat: PanelMaterial): number {
  const pts = WEIGHT_POINTS[mat];
  const at = pts.find((p) => p.t === t);
  if (at) return at.lb;
  const lo = pts[0],
    hi = pts[pts.length - 1];
  if (t < lo.t) return (lo.lb * t) / lo.t;
  if (t > hi.t) return (hi.lb * t) / hi.t;
  const i = pts.findIndex((p) => p.t > t),
    a = pts[i - 1],
    b = pts[i];
  return a.lb + ((b.lb - a.lb) * (t - a.t)) / (b.t - a.t);
}

/**
 * The nominal size a wall thickness stands for, without the Cutlist page's measurements: the size nearest it (a measured
 * sheet stays within a tenth of its own size, `panelExactRange`; on the exact midpoint, the thicker size).
 */
export const panelNominalNear = (t: number): PanelNominal =>
  PANEL_NOMINALS.reduce((a, n) =>
    Math.abs(PANEL_STOCK[n].in - t) < Math.abs(PANEL_STOCK[a].in - t) ? n : a,
  );

/** Walls thinner than this (inches, halfway from ½″ to ⅝″) are ½″-class stock, which the boxes brace once more. */
const THIN_PANEL_IN = (PANEL_STOCK["1/2"].in + PANEL_STOCK["5/8"].in) / 2;
/** Whether a wall is ½″-class stock, which takes an extra brace. */
export const isThinPanel = (t: number) => t < THIN_PANEL_IN;

/**
 * The nominal size a saved design or an optimizer card is at, from the thickness it was worked out at (`wall`) and the
 * size it names (`panel`, absent in designs saved before the sizes): the named size while its thickness matches; else
 * the size measured at that thickness; else the size that is that thickness nominally (old saves' 0.75 and 0.5); else
 * the named size. Undefined when nothing fits, so the page keeps its default.
 */
export function panelFor(
  c: Partial<Pick<PaDesignConfig, "wall" | "panel">>,
  mat: PanelMaterial,
  exact: PanelExactIn = {},
): PanelNominal | undefined {
  const named = isPanelNominal(c.panel) ? c.panel : undefined;
  const { wall } = c;
  if (wall === undefined || (named && panelIn(named, mat, exact) === wall)) return named;
  return (
    PANEL_NOMINALS.find((n) => panelIn(n, mat, exact) === wall) ??
    PANEL_NOMINALS.find((n) => PANEL_STOCK[n].in === wall) ??
    named
  );
}

/**
 * A saved design's walls as it was saved, for a project that keeps the measurements in this browser (Hi-fi): the size
 * it names, else (saves from before the sizes) the size its `wall` is nominally; and that size's measurement set to its
 * `wall`, so the box comes back at the thickness it was saved at. Undefined when nothing fits, so the page keeps its own.
 */
export function restoredPanel(
  c: Partial<Pick<PaDesignConfig, "wall" | "panel">>,
  mat: PanelMaterial,
  exact: PanelExactIn,
): { panel: PanelNominal; exactIn: PanelExactIn } | undefined {
  const { wall } = c;
  const panel = isPanelNominal(c.panel)
    ? c.panel
    : PANEL_NOMINALS.find((n) => PANEL_STOCK[n].in === wall);
  if (!panel) return undefined;
  const { min, max } = panelExactRange(panel);
  if (wall === undefined || wall < min || wall > max) return { panel, exactIn: exact };
  const { [panel]: _old, ...rest } = exact;
  return {
    panel,
    exactIn: wall === defaultPanelIn(panel, mat) ? rest : { ...rest, [panel]: wall },
  };
}

/** Stored measured thicknesses, each checked: a size whose value is missing or out of range stays at its default. */
export function savedPanelExactIn(v: unknown): PanelExactIn {
  const out: PanelExactIn = {};
  if (typeof v !== "object" || v === null) return out;
  for (const n of PANEL_NOMINALS) {
    const t: unknown = Reflect.get(v, n);
    const { min, max } = panelExactRange(n);
    if (typeof t === "number" && t >= min && t <= max) out[n] = t;
  }
  return out;
}

/** A thickness in a sentence or a column: a nominal size's imperial name (¾″), else three decimals (0.689″). */
export const formatThickness = (t: number) => {
  const n = PANEL_NOMINALS.find((k) => PANEL_STOCK[k].in === t);
  return n ? PANEL_NOMINAL_NAMES[n].short : `${+t.toFixed(3)}″`;
};

/** A nominal size by name, with the thickness it is worked out at beside it when that isn't the size itself. */
export const panelThicknessName = (n: PanelNominal, t: number) =>
  t === PANEL_STOCK[n].in
    ? PANEL_NOMINAL_NAMES[n].name
    : `${PANEL_NOMINAL_NAMES[n].name} at ${formatThickness(t)}`;

/** The nominal sizes as a settings toggle offers them: id and name, thickest first. */
export const PANEL_NOMINAL_OPTIONS = PANEL_NOMINALS.map(
  (n) => [n, PANEL_NOMINAL_NAMES[n].name] as const,
);
