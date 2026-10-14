/**
 * The short color change on hover and focus that every shared control takes (buttons, toggles, folds, fields, cards,
 * chart legends): 150 ms, and none when the device asks for reduced motion.
 */
export const HOVER_TRANSITION =
  "transition-[color,background-color,border-color,opacity] duration-150 ease-out motion-reduce:transition-none";

/** A pressed toggle (radio choice), icon button, sheet tab, lock or project tab: ink, the page's black. */
export const PRESSED_CLASSES = "border-stone-900 bg-stone-900 text-stone-50";

/** Shared controls: one look for toggle (segment) buttons and for action buttons */
export const BUTTON_SIZE_CLASSES = { md: "px-3 py-2 text-sm", xs: "px-2.5 py-1 text-xs" };

export type ButtonSize = keyof typeof BUTTON_SIZE_CLASSES;

/**
 * Tailwind classes for each Button variant: primary for an action (add, save, start over, export, run), in brand cyan
 * as CLAUDE.md gives actions; secondary for the rest (remove, reset, collapse), neutral.
 */
export const BUTTON_VARIANT_CLASSES = {
  primary: "border-cmy-c bg-cmy-c text-stone-50 font-semibold hover:border-stone-900",
  secondary: "border-stone-300 bg-panel hover:border-stone-500",
  /** a run that stands apart from the usual one (Fully optimize), in brand magenta */
  special: "border-cmy-m bg-cmy-m text-stone-50 font-semibold italic",
};

export type ButtonVariant = keyof typeof BUTTON_VARIANT_CLASSES;
