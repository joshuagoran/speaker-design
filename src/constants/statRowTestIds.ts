/**
 * The detail rows' hooks for the layout check. No imports: tests/mobile-check.mjs loads this file straight into Node.
 */
export const STAT_ROW_TEST_IDS = {
  /** one detail row: its label, then its value with the caption under it */
  row: "stat-row",
  /** the small caption under a value */
  note: "stat-row-note",
} as const;
