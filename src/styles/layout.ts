/**
 * The page's width and side gutters. The header and every page share them, so the tabs line up; on large screens the
 * page grows to 1920 px.
 */
export const PAGE_WIDTH = "w-full max-w-[120rem] mx-auto px-4 md:px-8";

/** The width text-heavy content keeps inside a wide page, so its lines stay readable. */
export const READING_WIDTH = "max-w-6xl";

/** Tailwind's `md` breakpoint as a media query: from here up the app shows two panes and folds the PA settings. */
export const MD_UP = "(min-width: 768px)";
