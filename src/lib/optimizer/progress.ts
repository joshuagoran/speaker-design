import type { OptimizerProgressCallback } from "../../types";

/** How often a search passes its progress on, ms (about ten times a second). */
export const PROGRESS_EVERY_MS = 100;

/**
 * A progress reporter for a search: passes `done` of `total` (and the best so far, in words, when given) on at most every
 * `everyMs` (a `final` report always goes through), and costs nothing without a callback. Reporting never changes what
 * the search does.
 */
export function throttledProgress(
  onProgress: OptimizerProgressCallback | undefined,
  everyMs = PROGRESS_EVERY_MS,
) {
  let last = -Infinity;
  return (done: number, total: number, final = false, best?: string) => {
    if (!onProgress) return;
    const now = Date.now();
    if (!final && now - last < everyMs) return;
    last = now;
    onProgress(best === undefined ? { done, total } : { done, total, best });
  };
}
