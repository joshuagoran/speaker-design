/** Formats an amount as whole US dollars, e.g. $1,234. */
export const formatDollars = (x: number): string => `$${Math.round(x).toLocaleString()}`;

/** Formats a level difference with its sign and one decimal, e.g. +1.5 or −3.0 (a true minus sign). */
export const formatSigned = (v: number): string =>
  (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v).toFixed(1);

const INCH_FRACTIONS: Partial<Record<number, string>> = { 0.25: "¼", 0.5: "½", 0.75: "¾" };
/** Formats inches the way a woodworker writes them: ¾″, 1½″, 2″; other sizes in decimals, e.g. 1.3″. */
export const formatInches = (v: number): string => {
  const whole = Math.floor(v + 1e-9),
    frac = INCH_FRACTIONS[+(v - whole).toFixed(3)];
  return frac ? `${whole || ""}${frac}″` : `${+v.toFixed(2)}″`;
};
