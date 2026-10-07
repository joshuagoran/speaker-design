import type { Dims3 } from "../types";

/** Formats an amount as whole US dollars, e.g. $1,234. */
export const formatDollars = (x: number): string => `$${Math.round(x).toLocaleString()}`;

/** Formats a level difference with its sign and one decimal (or `digits`), e.g. +1.5 or −3.0 (a true minus sign). */
export const formatSigned = (v: number, digits = 1): string =>
  (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v).toFixed(digits);

const INCH_FRACTIONS: Partial<Record<number, string>> = { 0.25: "¼", 0.5: "½", 0.75: "¾" };
/** Formats inches the way a woodworker writes them: ¾″, 1½″, 2″; other sizes in decimals, e.g. 1.3″. */
export const formatInches = (v: number): string => {
  const whole = Math.floor(v + 1e-9),
    frac = INCH_FRACTIONS[+(v - whole).toFixed(3)];
  return frac ? `${whole || ""}${frac}″` : `${+v.toFixed(2)}″`;
};

/** Formats a frequency in whole hertz: 900 Hz, 1150 Hz (never kHz: 1150 Hz reads better than 1.15 kHz). */
export const formatHz = (f: number): string => `${Math.round(f)} Hz`;

/** Formats a box's outside size, width × height × depth, e.g. 22 × 30 × 20″. */
export const formatDims = ({ w, h, d }: Dims3): string =>
  `${+w.toFixed(2)} × ${+h.toFixed(2)} × ${+d.toFixed(2)}″`;

/** A stress in Pa as N/mm², to a tenth (the strength notes). */
export const formatStress = (pa: number) => `${(pa / 1e6).toFixed(1)} N/mm²`;
