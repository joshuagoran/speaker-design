import { Button } from "../ui/Button";
import { LockIcon } from "../lock/LockIcon";

interface Props {
  /** how many locks are set, and how many there can be */
  nLocks: number;
  lockMax: number;
  onLockAll: () => void;
  onClear: () => void;
}

/** The lock-everything and clear-locks buttons of an optimizer: the Speaker fold's Keep list. */
export function LockBarButtons({ nLocks, lockMax, onLockAll, onClear }: Props) {
  const clear = nLocks ? `Clear all ${nLocks} lock${nLocks > 1 ? "s" : ""}` : "No locks set";
  return (
    <>
      <Button
        onClick={onLockAll}
        disabled={nLocks >= lockMax}
        aria-label="Lock everything"
        tip="Lock all, then unlock what the optimizer can change"
        className="inline-flex items-center gap-1"
      >
        <LockIcon locked={true} />
        <span className="text-xs">All</span>
      </Button>
      <Button
        onClick={onClear}
        disabled={!nLocks}
        aria-label={clear}
        tip={clear}
        className="inline-flex items-center gap-1"
      >
        <LockIcon locked={false} />
        {nLocks ? <span className="text-xs">{nLocks}</span> : null}
      </Button>
    </>
  );
}
