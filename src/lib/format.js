/** Formats an amount as whole US dollars, e.g. $1,234. */
export const formatDollars = (x) => `$${Math.round(x).toLocaleString()}`;
