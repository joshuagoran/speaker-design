// The driver comparison's ids and words: the Speaker page's Compare block and the PA optimizer's table share the table
// (components/ui/CompareTable). Code compares the ids, never the words.

/** The Speaker page's sort keys: one per column of its table. */
export const DRIVER_COMPARE_SORT = {
  name: "name",
  price: "price",
  lb: "lb",
  level: "level",
  f3: "f3",
  max: "max",
  checks: "checks",
} as const;
export type DriverCompareSort = (typeof DRIVER_COMPARE_SORT)[keyof typeof DRIVER_COMPARE_SORT];

/** A sort's directions, by id, as `aria-sort` names them. */
export const SORT_DIRECTION = { ascending: "ascending", descending: "descending" } as const;
export type SortDirection = (typeof SORT_DIRECTION)[keyof typeof SORT_DIRECTION];

/** The mark after the sorted heading, by direction. */
export const SORT_MARKS = { ascending: " ▲", descending: " ▼" } as const satisfies Record<
  SortDirection,
  string
>;

/** The words: the settings' button, the block's heading, line and Close, the table's headings and cells. */
export const DRIVER_COMPARE_TEXT = {
  compare: "Compare",
  heading: "Compare drivers",
  /** the line: how a row previews, by the verb (`hover` with a mouse, `tap` on a phone) */
  line: (verb: string) => `${verb} a row to see it on the charts.`,
  hover: "Hover",
  tap: "Tap",
  /** the second line from md up, where a click swaps the row in */
  clickToSwap: "Click to swap.",
  /** the Speaker page's button on a phone: puts the previewed row in */
  swap: "Swap",
  close: "Close",
  yours: "yours",
  passes: "passes",
  /** the PA table's button */
  use: "Use",
  /** the PA table's part price heading */
  price: "Its price",
  checks: "Checks",
  /** the Speaker page's headings, short for the settings column */
  heads: {
    price: "Price",
    lb: "Weight",
    /** its band's level: the band's name first ("Low dB") */
    level: (band: string) => `${band} dB`,
    f3: "F3",
    max: "Max dB",
  },
} as const;
