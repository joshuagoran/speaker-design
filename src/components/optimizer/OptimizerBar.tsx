import { ToggleButton } from "../ui/ToggleButton";
import { Button } from "../ui/Button";
import { LockIcon } from "../lock/LockIcon";
import { RESULT_MAX_WIDTH } from "../../styles/layout";

interface Props {
  on: boolean;
  onToggle: () => void;
  /** shown while the optimizer is off */
  hint: React.ReactNode;
  /** how many locks are set, and how many there can be */
  nLocks: number;
  lockMax: number;
  onLockAll: () => void;
  onClear: () => void;
  children?: React.ReactNode;
}

/** ---- Optimizer pieces shared by the Hi-fi and PA stack panels ---- */
export function OptimizerBar({
  on,
  onToggle,
  hint,
  nLocks,
  lockMax,
  onLockAll,
  onClear,
  children,
}: Props) {
  return (
    <div className={`${RESULT_MAX_WIDTH} flex flex-wrap items-center gap-2`}>
      <ToggleButton on={on} onClick={onToggle}>
        Optimizer: {on ? "on" : "off"}
      </ToggleButton>
      {on && (
        <>
          <Button
            onClick={onLockAll}
            disabled={nLocks >= lockMax}
            aria-label="Lock everything"
            title="Lock everything, then unlock what the optimizer may change"
            className="inline-flex items-center gap-1"
          >
            <LockIcon locked={true} />
            <span className="text-xs">All</span>
          </Button>
          <Button
            onClick={onClear}
            disabled={!nLocks}
            aria-label={
              nLocks ? `Clear all ${nLocks} lock${nLocks > 1 ? "s" : ""}` : "No locks set"
            }
            title={nLocks ? `Clear all ${nLocks} lock${nLocks > 1 ? "s" : ""}` : "No locks set"}
            className="inline-flex items-center gap-1"
          >
            <LockIcon locked={false} />
            {nLocks ? <span className="text-xs">{nLocks}</span> : null}
          </Button>
        </>
      )}
      {!on && <span className="text-xs text-stone-500">{hint}</span>}
      {children}
    </div>
  );
}
