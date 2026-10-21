// The Space page's two lanes of floor-map jobs: full passes, and a drag's quick ones (each in its own worker, so a quick
// pass never waits for a full one). One job runs at a time in each, and only the newest waiting job is kept. A result
// shows only when its job is newer than the one on show. Pure: the page runs the jobs.
import { isOptimizerCancel } from "../../lib/makeOptimizerRunner";

/** A job: `seq` orders the jobs as they were asked for. */
interface Job {
  seq: number;
}

/** One lane: whether a job runs in it, and the job waiting for it (only the newest is kept). */
export interface JobLane<J extends Job> {
  busy: boolean;
  want: J | null;
}

/** The two lanes, the last job's `seq`, and the `seq` of the job on show. */
export interface JobLanes<J extends Job, L extends JobLane<J> = JobLane<J>> {
  full: L;
  quick: L;
  seq: number;
  shownSeq: number;
}

/**
 * Asks for a job (`make` takes its `seq`): a drag's quick pass waits in the quick lane, a full pass in the full one, in
 * place of the job that waited there. Returns the job's lane.
 */
export function queueJob<J extends Job, L extends JobLane<J>>(
  lanes: JobLanes<J, L>,
  make: (seq: number) => J,
  quick: boolean,
): L {
  const job = make(++lanes.seq);
  const lane = quick ? lanes.quick : lanes.full;
  lane.want = job;
  return lane;
}

/**
 * A drag begins (`dragging`) or ends. As it begins, the full pass that waits is dropped (the page stops the one under
 * way); as it ends, the quick pass that waits.
 */
export function dragChanged<J extends Job>(lanes: JobLanes<J>, dragging: boolean): void {
  if (dragging) lanes.full.want = null;
  else lanes.quick.want = null;
}

/** The job a lane runs now, or null (one runs, or none waits); the lane is then busy until `jobSettled`. */
export function takeJob<J extends Job>(lane: JobLane<J>): J | null {
  if (lane.busy || !lane.want) return null;
  const job = lane.want;
  lane.want = null;
  lane.busy = true;
  return job;
}

/** What a job's end shows: its grid, a failure's message, or nothing. */
export type JobEnd = { show: true } | { show: false; failure: string | null };

/**
 * A job ended, with its result or `error`: its lane is free. A result shows when its job is no older than the one on
 * show (a quick pass that ends after a newer full pass is dropped). A canceled job shows no failure.
 */
export function jobSettled<J extends Job>(
  lanes: JobLanes<J>,
  lane: JobLane<J>,
  job: J,
  error?: { error: unknown },
): JobEnd {
  lane.busy = false;
  if (error) {
    const e = error.error;
    if (isOptimizerCancel(e)) return { show: false, failure: null };
    return { show: false, failure: e instanceof Error ? e.message : String(e) };
  }
  if (job.seq < lanes.shownSeq) return { show: false, failure: null };
  lanes.shownSeq = job.seq;
  return { show: true };
}
