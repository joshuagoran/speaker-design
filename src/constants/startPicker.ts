// What the start picker (src/components/ui/StartPicker) shows on every page that has one: the Speaker, Stack and Space pages.

/** The picker's groups: the templates, then the designs you have now. */
export const START_PICKER_GROUPS = {
  templates: "Templates",
  current: "Your current designs",
} as const;

/** The start picker's label and its button (the Node checks find them by these). */
export const START_PICKER_TEXT = {
  startFrom: "Start from",
  startOver: "Start over from this",
} as const;
