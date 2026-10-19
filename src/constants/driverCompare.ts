// The driver comparison's ids and words: the Speaker page's Compare block and the PA optimizer's table share the table
// (components/ui/CompareTable). Code compares the ids, never the words.

/** The Speaker page's sort keys: one per column of its table. */
export const DRIVER_COMPARE_SORT = {
  name: "name",
  price: "price",
  total: "total",
  lb: "lb",
  level: "level",
  f3: "f3",
  max: "max",
  checks: "checks",
} as const;
export type DriverCompareSort = (typeof DRIVER_COMPARE_SORT)[keyof typeof DRIVER_COMPARE_SORT];

/** A sort's direction, as `aria-sort` names it. */
export type SortDirection = "ascending" | "descending";

/** The mark after the sorted heading, by direction. */
export const SORT_MARKS = { ascending: " ▲", descending: " ▼" } as const satisfies Record<
  SortDirection,
  string
>;

/** The words: the settings' button, the block's heading, line and Close, the table's headings and cells. */
export const DRIVER_COMPARE_TEXT = {
  compare: "Compare",
  heading: "Compare drivers",
  line: "Each option in your design, all else the same. Hover a row to see it on the charts.",
  close: "Close",
  yours: "yours",
  passes: "passes",
  use: "Use",
  price: "Its price",
  total: "Speaker price",
  lb: "Speaker weight",
  /** its band's level: the band's name first ("Low band level") */
  level: (band: string) => `${band} band level`,
  f3: "F3",
  max: "Max output",
  checks: "Checks",
} as const;
