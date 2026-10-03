/** Formats an amount as whole US dollars, e.g. $1,234. */
export const formatDollars = (x: number): string => `$${Math.round(x).toLocaleString()}`;

/** Formats a level difference with its sign and one decimal, e.g. +1.5 or −3.0 (a true minus sign). */
export const formatSigned = (v: number): string =>
  (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v).toFixed(1);
