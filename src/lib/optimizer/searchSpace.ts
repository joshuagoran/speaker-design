// Search-space pieces every optimizer shares (the PA quick and exact searches, the Speaker optimizer): a dimension's
// range under its lock, the subsonic highpasses a tuning takes, and the PA vent sizes per style. Pure data and rules.
import type { DimensionLockMode, PortStyle, VentSpec } from "../../types";
import { PORT_TUBES } from "../../data/catalog/port-tubes";
import { keysOf } from "../records";

/**
 * A catalog row the optimizers search: a driver joins every search space once, as its standard version; another
 * impedance version of it (`variantOf`) stays in the pickers only.
 */
export const inSearchSpace = (row: { variantOf?: string }) => row.variantOf === undefined;

/**
 * A dimension's search range under its lock: `exact` holds it at `cur`, `max` lets it go from `lo` up to `cur` (never
 * above `hi`), free takes the whole [lo, hi].
 */
export const rangeOf = (
  mode: DimensionLockMode | undefined,
  cur: number,
  [lo, hi]: [number, number],
): [number, number] =>
  mode === "exact" ? [cur, cur] : mode === "max" ? [lo, Math.min(hi, cur)] : [lo, hi];

/** The highpasses the search tries for a tuning when the highpass isn't locked: 0.85× and 1× the tuning, 20 Hz at least. */
export const highpassOptions = (fb: number) => [
  Math.max(20, Math.round(fb * 0.85)),
  Math.max(20, Math.round(fb)),
];

// Vent sizes per style, smallest area first: the round styles from the port-tube catalog (stock pipe), the rectangular
// ones (ply ducts, cut to any size) from the search's own grid of slot heights and duct throats.
// "round1" and "round4" are the one-tube and four-corner-tube layouts (the geometry treats every round style alike, from `nt` and
// `dia`), so they take the tubes of that count; "round2" tries every tube count, as it always has.
const tubesOf = (count?: number) =>
  PORT_TUBES.filter(({ nt }) => count === undefined || nt === count).map(({ nt, dia }) => ({
    nt,
    dia,
  }));
const VENT_SIZES: Record<PortStyle, Partial<VentSpec>[]> = {
  round1: tubesOf(1),
  round2: tubesOf(),
  round4: tubesOf(4),
  slots: [2, 2.5, 3, 3.5, 4, 4.5, 5, 6].map((slotH) => ({ slotH })),
  vslots: [1, 1.25, 1.5, 1.75, 2, 2.5, 3].map((throat) => ({ throat })),
  // one side duct: from a 1″ throat, as the pair's, since a narrow throat is what tunes a short box low
  vslot1: [1, 1.25, 1.5, 2, 2.5, 3, 3.5, 4, 5].map((throat) => ({ throat })),
};
/** The vent sizes the search tries for a style, smallest area first. */
export const ventSizesFor = (style: PortStyle) => VENT_SIZES[style];
/** Every vent style. */
export const VENT_STYLES = keysOf(VENT_SIZES);
