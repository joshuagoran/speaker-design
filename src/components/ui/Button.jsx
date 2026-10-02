import { BUTTON_SIZE_CLASSES, BUTTON_VARIANT_CLASSES } from "./buttonStyles.ts";

/** Disabled = grey fill with dark text (readable), never faded with opacity */
export function Button({ variant = "secondary", size = "md", className = "", ...p }) {
  return (
    <button
      type="button"
      {...p}
      className={`rounded border ${BUTTON_SIZE_CLASSES[size]} ${BUTTON_VARIANT_CLASSES[variant]} disabled:border-stone-300 disabled:bg-stone-300 disabled:text-stone-500 disabled:cursor-not-allowed ${className}`}
    />
  );
}
