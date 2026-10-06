import type { HifiLockKey } from "../types";

/** every on/off lock the optimizer reads (box sizes are separate: subDim, midDim) */
export const LOCK_KEYS = [
  "sub",
  "mid",
  "cd",
  "horn",
  "vent",
  "wall",
  "hpf",
  "xoLo",
  "xoHi",
  "ampW",
  "mAmpW",
  "hfAmpW",
] as const;

export type LockKey = (typeof LOCK_KEYS)[number];

/**
 * The locks a viewer starts with on, in both optimizers: the plywood size, so a search keeps the size you chose (at
 * its measured thickness) until you unlock it, and then tries every size.
 */
export const LOCKS_ON_BY_DEFAULT = ["wall"] as const satisfies readonly (LockKey & HifiLockKey)[];

/** Those locks all on (a viewer's starting locks) or all off (the optimizer bar's Clear). */
export const defaultLocks = (on: boolean) =>
  // boundary cast: Object.fromEntries types its result as an index signature; these are exactly those keys
  Object.fromEntries(LOCKS_ON_BY_DEFAULT.map((k) => [k, on])) as Record<
    (typeof LOCKS_ON_BY_DEFAULT)[number],
    boolean
  >;
