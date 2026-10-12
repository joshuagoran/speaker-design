import { BUTTON_SIZE_CLASSES, HOVER_TRANSITION, PRESSED_CLASSES } from "./buttonStyles";
import type { ButtonSize } from "./buttonStyles";

interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  on?: boolean;
  size?: ButtonSize;
}

/** Segment-style button that shows a pressed state. Disabled looks as a disabled `Button`: gray fill, readable text. */
export function ToggleButton({ on, size = "md", className = "", ...p }: Props) {
  return (
    <button
      type="button"
      aria-pressed={!!on}
      {...p}
      className={`rounded border ${HOVER_TRANSITION} disabled:border-stone-300 disabled:bg-stone-300 disabled:text-stone-500 disabled:cursor-not-allowed ${BUTTON_SIZE_CLASSES[size]} ${on ? PRESSED_CLASSES : "border-stone-300 bg-panel hover:border-stone-500"} ${className}`}
    />
  );
}
