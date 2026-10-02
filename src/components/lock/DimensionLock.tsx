import { LockIcon } from "./LockIcon.tsx";
import { lockButtonClass } from "./LockButton.tsx";
import type { DimensionLockMode } from "../../types.ts";

/** Order in which a dimension lock cycles: free, max, exact. */
export const NEXT_DIMENSION_LOCK_MODE: Record<DimensionLockMode, DimensionLockMode> = {
  free: "max",
  max: "exact",
  exact: "free",
};

interface Props {
  mode?: DimensionLockMode;
  onChange: (mode: DimensionLockMode) => void;
  /** what the lock keeps, for the label ("Sub width") */
  what: string;
}

/** Three-state lock on a box dimension: free, at most this, or exactly this. */
export function DimensionLock({ mode = "free", onChange, what }: Props) {
  const tip = `${what}: ${mode === "free" ? "unlocked, the optimizer may change it" : mode === "max" ? "up to this value" : "locked at exactly this value"} (tap to change)`;
  return (
    <button
      type="button"
      onClick={() => onChange(NEXT_DIMENSION_LOCK_MODE[mode])}
      aria-label={tip}
      title={tip}
      className={lockButtonClass(mode !== "free")}
    >
      <LockIcon locked={mode !== "free"} />
      {mode === "max" ? <span>≤</span> : mode === "exact" ? <span>=</span> : null}
    </button>
  );
}
