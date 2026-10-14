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

/*
 * Spacing: layouts own it. A container spaces its children with one of these rules; a shared control from
 * `src/components/ui` carries no outer margin (`tests/no-control-margins.test.ts` checks it). To change a gap, change
 * the rule here, not the fields.
 */

/**
 * A container of fields, cards, folds and notes, in block layout: 0.75 rem between each child and the one before it
 * (a settings column's body, a settings section's body, a card). A child that renders nothing leaves no gap.
 */
export const GAP_Y = "space-y-3";

/** A tighter column, 0.5 rem, for a field's own helper lines (a hint and a notice under a button). */
export const GAP_Y_TIGHT = "space-y-2";

/**
 * A column in flex layout, 0.75 rem: for a heading and its body, where a child can be hidden with `display: none` (a
 * hidden child leaves no gap, which `GAP_Y` cannot do for a hidden first child).
 */
export const FLEX_GAP_Y = "flex flex-col gap-3";

/** A row of number fields that wraps onto more lines where the pane is narrow: 0.75 rem between fields, both ways. */
export const FIELD_ROW = "flex flex-wrap gap-3";

/** The settings column's body when it holds fold sections: 1 rem between one section and the next, on purpose wider than a field gap. */
export const SECTION_GAP_Y = "space-y-4";

/** `SECTION_GAP_Y` from md up only: the PA settings fold at md and up, and on phones the sheet's tabs group them. */
export const SECTION_GAP_Y_MD_UP = "md:space-y-4";

/** A heading and the line under it that describes it: 0.25 rem apart, so the pair reads as one. */
export const HEADING_GROUP = "space-y-1";

/** Blocks of a settings section that each have their own heading (a list of cards, then the next list): 1.25 rem apart. */
export const BLOCK_GAP_Y = "space-y-5";

/** `GAP_Y` from md up only: a fold body whose children are tab groups, which phones show one at a time. */
export const GAP_Y_MD_UP = "md:space-y-3";

/** `BLOCK_GAP_Y` from md up only: the PA settings' tab groups, side by side in one fold on desktop. */
export const BLOCK_GAP_Y_MD_UP = "md:space-y-5";
