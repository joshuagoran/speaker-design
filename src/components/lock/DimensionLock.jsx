import { LockIcon } from "./LockIcon.jsx";
import { lockButtonClass } from "./LockButton.jsx";

/** Order in which a dimension lock cycles: free, max, exact. */
export const NEXT_DIMENSION_LOCK_MODE = { free: "max", max: "exact", exact: "free" };

/** Three-state lock on a box dimension: free, at most this, or exactly this. */
export function DimensionLock({ mode = "free", onChange, what }) {
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
