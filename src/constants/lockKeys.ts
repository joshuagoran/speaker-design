/** every on/off lock the optimizer reads (box sizes are separate: subDim, midDim) */
export const LOCK_KEYS = [
  "sub",
  "mid",
  "cd",
  "horn",
  "vent",
  "hpf",
  "xoLo",
  "xoHi",
  "ampW",
  "mAmpW",
  "hfAmpW",
] as const;

export type LockKey = (typeof LOCK_KEYS)[number];
