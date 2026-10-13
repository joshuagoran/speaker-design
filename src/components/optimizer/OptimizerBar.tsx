import { ToggleButton } from "../ui/ToggleButton";
import { LockBarButtons } from "./LockBarButtons";
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
  /** one line under the bar while the optimizer is on (e.g. the plywood it designs in, when yours is another) */
  note?: React.ReactNode;
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
  note,
  children,
}: Props) {
  return (
    <div className={`${RESULT_MAX_WIDTH} flex flex-wrap items-center gap-2`}>
      <ToggleButton on={on} onClick={onToggle}>
        Optimizer: {on ? "on" : "off"}
      </ToggleButton>
      {on && (
        <LockBarButtons nLocks={nLocks} lockMax={lockMax} onLockAll={onLockAll} onClear={onClear} />
      )}
      {!on && <span className="text-xs text-stone-500">{hint}</span>}
      {children}
      {on && note && <span className="w-full text-xs text-stone-500">{note}</span>}
    </div>
  );
}
