import { DimensionLock } from "../components/lock/DimensionLock";
import { LockButton } from "../components/lock/LockButton";
import { countLocks } from "../lib/lists";
import { useStoredStateFrom } from "./useStoredState";
import type { Dims3, DimensionLockMode, OptimizerLocks } from "../types";

interface Options<K extends string, B extends string, S> {
  /** where the locks are remembered */
  key: string;
  /** what is read when nothing is stored, and how what is stored becomes the locks the page holds */
  empty: S;
  fromStored: (stored: S) => OptimizerLocks<K, B>;
  /** every lock on (box sizes exact), and every lock off */
  allLocked: OptimizerLocks<K, B>;
  none: OptimizerLocks<K, B>;
  /** lock buttons show only while the optimizer is on */
  enabled: boolean;
}

/**
 * The optimizer's locks, remembered per viewer: setting them, the lock buttons for the controls, and the lock
 * count and lock-all/clear actions for the optimizer bar.
 */
export function useOptimizerLocks<K extends string, B extends string, S>({
  key,
  empty,
  fromStored,
  allLocked,
  none,
  enabled,
}: Options<K, B, S>) {
  const [optimizerLocks, setOptimizerLocks] = useStoredStateFrom(key, empty, fromStored);
  const modesOf = (
    l: OptimizerLocks<K, B>,
  ): Record<B, Partial<Record<keyof Dims3, DimensionLockMode>>> => l;
  const renderLockButton = (lock: K, what: string) =>
    enabled ? (
      <LockButton
        on={!!optimizerLocks[lock]}
        what={what}
        onClick={() => setOptimizerLocks((p) => ({ ...p, [lock]: !p[lock] }))}
      />
    ) : null;
  const renderDimensionLock = (box: B, dim: keyof Dims3, what: string) =>
    enabled ? (
      <DimensionLock
        mode={modesOf(optimizerLocks)[box][dim] || "free"}
        what={what}
        onChange={(m) =>
          setOptimizerLocks((p) => ({ ...p, [box]: { ...modesOf(p)[box], [dim]: m } }))
        }
      />
    ) : null;
  /** the optimizer bar's lock props */
  const lockBar = {
    nLocks: countLocks(optimizerLocks),
    lockMax: countLocks(allLocked),
    onLockAll: () => setOptimizerLocks(allLocked),
    onClear: () => setOptimizerLocks(none),
  };
  return { optimizerLocks, setOptimizerLocks, renderLockButton, renderDimensionLock, lockBar };
}
