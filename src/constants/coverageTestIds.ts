/**
 * The Coverage page's hooks for the layout check. No imports: tests/mobile-check.mjs loads this file straight into Node.
 */
export const COVERAGE_TEST_IDS = {
  /** the floor map's SVG */
  map: "coverage-map",
  /** a stack's toe-in handle on the map */
  aimHandle: "coverage-aim-handle",
  /** the amp power table */
  ampPower: "coverage-amp-power",
} as const;

/** Where the floor layout is stored (per viewer), so the check can start the page in a given band. */
export const COVERAGE_LAYOUT_KEY = "coverage.layout";
