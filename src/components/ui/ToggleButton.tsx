import { BUTTON_SIZE_CLASSES, HOVER_TRANSITION, PRESSED_CLASSES } from "./buttonStyles";
import type { ButtonSize } from "./buttonStyles";

interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  on?: boolean;
  size?: ButtonSize;
}

/** A toggle's colors by its state: pressed (kept, dimmed, while disabled), disabled as a disabled `Button`, or off. */
const stateClasses = (on: boolean, disabled: boolean) =>
  on
    ? `${PRESSED_CLASSES}${disabled ? " opacity-60" : ""}`
    : disabled
      ? "border-stone-300 bg-stone-300 text-stone-500"
      : "border-stone-300 bg-panel hover:border-stone-500";

/**
 * Segment-style button that shows a pressed state. Disabled and off, it looks as a disabled `Button` (gray fill,
 * readable text); disabled and pressed, it keeps the pressed colors, dimmed, so the current choice still shows.
 */
export function ToggleButton({
  on = false,
  size = "md",
  disabled = false,
  className = "",
  ...p
}: Props) {
  return (
    <button
      type="button"
      aria-pressed={on}
      disabled={disabled}
      {...p}
      className={`rounded border ${HOVER_TRANSITION} disabled:cursor-not-allowed ${BUTTON_SIZE_CLASSES[size]} ${stateClasses(on, disabled)} ${className}`}
    />
  );
}
