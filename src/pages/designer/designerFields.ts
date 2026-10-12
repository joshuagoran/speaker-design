// What the Designer's settings share: the row their number fields wrap in, and how a size or position shows.

/** A row of number fields that wraps onto more lines where the pane is narrow. */
export const FIELD_ROW = "flex flex-wrap gap-x-3 gap-y-3 mb-3";

/** A size or position in inches as a field shows it: to the hundredth (no float noise such as 7.420000000000002). */
export const shownIn = (v: number) => Math.round(v * 100) / 100;
