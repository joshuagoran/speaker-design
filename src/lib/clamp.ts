/** `value` limited to the range `lo`–`hi` (`hi` wins when `lo` > `hi`). */
export const clamp = (value: number, lo: number, hi: number): number =>
  Math.min(hi, Math.max(lo, value));
