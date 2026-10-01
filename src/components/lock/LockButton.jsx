import { LockIcon } from "./LockIcon.jsx";

/** Tailwind classes for a lock button in its on or off state. */
export const lockButtonClass = (on) =>
  `inline-flex items-center justify-center gap-0.5 min-w-[32px] h-8 px-1.5 rounded border text-xs ${on ? "border-stone-900 bg-stone-900 text-stone-50" : "border-stone-300 text-stone-500 bg-white hover:border-stone-500 hover:text-stone-500"}`;

/** Button that pins one optimizer variable to its current value. */
export function LockButton({ on, onClick, what }) {
  const tip = on
    ? `Locked: the optimizer keeps ${what}`
    : `Unlocked: the optimizer may change ${what}`;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      aria-label={tip}
      title={tip}
      className={lockButtonClass(on)}
    >
      <LockIcon locked={on} />
    </button>
  );
}
