/** Shared controls: one look for toggle (segment) buttons and for action buttons */
export const BUTTON_SIZE_CLASSES = { md: "px-3 py-2 text-sm", xs: "px-2.5 py-1 text-xs" };

export type ButtonSize = keyof typeof BUTTON_SIZE_CLASSES;

/** Tailwind classes for each Button variant. */
export const BUTTON_VARIANT_CLASSES = {
  primary: "border-cmy-a bg-cmy-a text-white font-semibold",
  dark: "border-stone-900 bg-stone-900 text-stone-50",
  secondary: "border-stone-300 bg-white hover:border-stone-500",
};

export type ButtonVariant = keyof typeof BUTTON_VARIANT_CLASSES;
