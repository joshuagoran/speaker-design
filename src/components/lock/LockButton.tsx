import { LockIcon } from "./LockIcon";

/** Tailwind classes for a lock button in its on or off state. */
export const lockButtonClass = (on: boolean) =>
  `inline-flex items-center justify-center gap-0.5 min-w-[32px] h-8 px-1.5 rounded border text-xs ${on ? "border-stone-900 bg-stone-900 text-stone-50" : "border-stone-300 text-stone-500 bg-panel hover:border-stone-500 hover:text-stone-500"}`;

interface Props {
  on: boolean;
  onClick: () => void;
  /** what the lock keeps, in words, for the label ("the sub driver") */
  what: string;
}

/** Button that pins one optimizer variable to its current value. */
export function LockButton({ on, onClick, what }: Props) {
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
