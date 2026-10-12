import { BUTTON_SIZE_CLASSES, HOVER_TRANSITION, PRESSED_CLASSES } from "./buttonStyles";
import type { ButtonSize } from "./buttonStyles";

interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  on?: boolean;
  size?: ButtonSize;
}

/** Segment-style button that shows a pressed state. */
export function ToggleButton({ on, size = "md", className = "", ...p }: Props) {
  return (
    <button
      type="button"
      aria-pressed={!!on}
      {...p}
      className={`rounded border ${HOVER_TRANSITION} disabled:opacity-40 disabled:cursor-not-allowed ${BUTTON_SIZE_CLASSES[size]} ${on ? PRESSED_CLASSES : "border-stone-300 bg-panel hover:border-stone-500"} ${className}`}
    />
  );
}
