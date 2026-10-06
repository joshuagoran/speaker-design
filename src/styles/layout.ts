/**
 * The page's width and side gutters. The header and every page share them, so the tabs line up; on large screens the
 * page grows to 1920 px.
 */
export const PAGE_WIDTH = "w-full max-w-[120rem] mx-auto px-4 md:px-8";

/** The width text-heavy content keeps inside a wide page, so its lines stay readable. */
export const READING_WIDTH = "max-w-6xl";

/** Tailwind's `md` breakpoint as a media query: from here up the app shows two panes and folds the PA settings. */
export const MD_UP = "(min-width: 768px)";

/**
 * The PA Design page's results pane width, px, from which its results take two columns (the 3D view beside the summary,
 * Sub beside Mid-bass, Dispersion and Totals beside Horn). Measured on the pane, not the viewport: the settings column's
 * width is draggable.
 */
export const PA_TWO_COLUMN_PX = 1200;
