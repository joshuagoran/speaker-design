import { HOVER_TRANSITION, PRESSED_CLASSES } from "./buttonStyles";
import { LOCK_TEXT } from "../../constants/uiText";

/** Material Symbols "lock" / "lock_open" (filled), drawn inline so they never depend on a font loading */
const LOCKED_ICON_PATH =
  "M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z";
const UNLOCKED_ICON_PATH =
  "M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6h2c0-1.66 1.34-3 3-3s3 1.34 3 3v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z";

/** One optimizer lock as a setting's lock button shows it. */
export interface LockControl {
  /** what it locks, in words ("width", "B&C 18SW115"): the screen reader's "Lock the …" */
  name: string;
  locked: boolean;
  /** a size lock's mode beside the padlock (≤ or =); absent for an on/off lock */
  mark?: string;
  /** whether a tap unlocks it (an on/off lock: while it is locked; a size lock: on its last mode) */
  unlocks: boolean;
  /** shown locked by another lock that holds it (a woofer's size under its model's lock); a tap does nothing */
  disabled?: boolean;
  onClick: () => void;
}

/**
 * A small padlock button beside a setting: pressed while the optimizer keeps that setting as it is. A size lock shows
 * its mode (≤ or =) beside the padlock. No tooltip: its screen-reader name says what a tap does.
 */
export function LockButton({ name, locked, mark, unlocks, disabled, onClick }: LockControl) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={locked}
      aria-label={unlocks ? LOCK_TEXT.unlock(name) : LOCK_TEXT.lock(name)}
      className={`inline-flex shrink-0 items-center justify-center gap-0.5 min-w-9 h-9 px-1.5 rounded border text-xs font-semibold ${HOVER_TRANSITION} ${locked ? PRESSED_CLASSES : "border-stone-300 text-stone-500 bg-panel hover:border-stone-500"} ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
    >
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
        <path
          d={locked ? LOCKED_ICON_PATH : UNLOCKED_ICON_PATH}
          fill="currentColor"
          fillRule="evenodd"
        />
      </svg>
      {mark && <span aria-hidden="true">{mark}</span>}
    </button>
  );
}

interface WithLockProps {
  /** the setting's lock; null or absent: the setting alone, as it is without one */
  lock?: LockControl | null;
  children: React.ReactNode;
}

/** A setting with its lock button at its right, level with the field's box. */
export function WithLock({ lock, children }: WithLockProps) {
  if (!lock) return <>{children}</>;
  return (
    <div className="flex items-end gap-1.5 min-w-0">
      <div className="min-w-0 flex-1">{children}</div>
      <LockButton {...lock} />
    </div>
  );
}
