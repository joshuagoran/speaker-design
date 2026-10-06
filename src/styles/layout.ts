/**
 * The page's width and side gutters. The header and every page share them, so the tabs line up; the page uses the full
 * window width at every size, and individual elements that would stretch badly carry their own max width.
 */
export const PAGE_WIDTH = "w-full px-4 md:px-8";

/**
 * The widest one result block grows (a chart, a row of stat tiles, a detail list, the notices, the cutlist), so on a
 * very wide screen it keeps the proportions it had in a 1920 px window instead of stretching across the whole pane.
 */
export const RESULT_MAX_WIDTH = "max-w-[90rem]";

/** The width text-heavy content keeps inside a wide page, so its lines stay readable. */
export const READING_WIDTH = "max-w-6xl";

/** Tailwind's `md` breakpoint as a media query: from here up the app shows two panes and folds the PA settings. */
export const MD_UP = "(min-width: 768px)";

/**
 * The results pane width, px, from which a page's results take two columns: PA Design (the 3D view beside the summary,
 * Sub beside Mid-bass, Dispersion and Totals beside Horn), Hi-fi Design (the summary beside the warnings, Response
 * beside Max output, Dispersion beside Seat position) and Cutlist (the parts list beside the sheet layout). Measured
 * on the pane, not the viewport, so dragging the settings divider switches every page alike; at the default settings
 * width it switches at a 1400 px viewport.
 */
export const RESULTS_TWO_COLUMN_PX = 858;

/** The results grid of PA and Hi-fi Design: two columns with aligned rows when `wide`, else one column. */
export const resultsGridClass = (wide: boolean) =>
  wide ? "grid grid-cols-2 gap-x-4 gap-y-5 items-start" : "flex flex-col gap-5";

/** A results-grid cell's classes: `place` (its row and column) applies in two columns only. */
export const resultsCellClass = (wide: boolean, place: string) =>
  wide ? `min-w-0 ${place}` : "min-w-0";
