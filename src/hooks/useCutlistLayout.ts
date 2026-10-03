import { useEffect, useState } from "react";
import { startCutlistLayout } from "../lib/pa/runCutlist";
import type { CutlistLayout, CutlistRequest } from "../types";

/**
 * The full cutlist search for this request, from a worker; null until it is done. A new request cancels the one
 * before, so clicking through settings never queues stale searches.
 */
export function useCutlistLayout(req: CutlistRequest): CutlistLayout | null {
  // the request as one string: the search restarts only when it changes
  const key = JSON.stringify(req);
  const [done, setDone] = useState<{ key: string; out: CutlistLayout } | null>(null);
  useEffect(() => {
    const job = startCutlistLayout(req);
    job.done.then(
      (out) => setDone({ key, out }),
      () => {}, // the caller keeps showing its quick layout
    );
    return job.cancel;
  }, [key]);
  return done && done.key === key ? done.out : null;
}
