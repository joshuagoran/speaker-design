/**
 * The PA phone settings sheet's tabs, by id, and the label each shows. The settings column's sections reuse these names.
 * No imports: tests/mobile-check.mjs loads this file straight into Node to tap the tabs by name.
 */
export const PA_SETTINGS_TABS = {
  sub: "Sub",
  mid: "Mid",
  horn: "Horn",
  look: "Look",
} as const;
