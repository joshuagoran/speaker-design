import { BUTTON_SIZE_CLASSES } from "./buttonStyles.js";

/** Segment-style button that shows a pressed state. */
export function ToggleButton({ on, size = "md", className = "", ...p }) {
  return (
    <button
      type="button"
      aria-pressed={!!on}
      {...p}
      className={`rounded border ${BUTTON_SIZE_CLASSES[size]} ${on ? "border-stone-900 bg-stone-900 text-stone-50" : "border-stone-300 bg-white hover:border-stone-500"} ${className}`}
    />
  );
}
