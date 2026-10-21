// The Space page's floor-map job lanes (pages/space/gridLanes): which job runs, which result shows, and what a drag's
// start and end drop.
import { test } from "vite-plus/test";
import assert from "node:assert";
import {
  dragChanged,
  jobSettled,
  queueJob,
  takeJob,
  type JobLanes,
} from "../src/pages/space/gridLanes";
import { OptimizerCanceled } from "../src/lib/makeOptimizerRunner";

/** A job: its `seq` and whether it is a drag's quick pass. */
interface TestJob {
  seq: number;
  quick: boolean;
}

const newLanes = (): JobLanes<TestJob> => ({
  full: { busy: false, want: null },
  quick: { busy: false, want: null },
  seq: 0,
  shownSeq: 0,
});

const ask = (lanes: JobLanes<TestJob>, quick: boolean) =>
  queueJob(lanes, (seq) => ({ seq, quick }), quick);

test("lanes: one job at a time in each, only the newest waiting job kept", () => {
  const lanes = newLanes();
  const lane = ask(lanes, false);
  const first = takeJob(lane);
  assert.equal(first?.seq, 1);
  ask(lanes, false);
  ask(lanes, false);
  // busy: nothing starts until the first ends
  assert.equal(takeJob(lane), null);
  assert.ok(first && jobSettled(lanes, lane, first).show);
  assert.equal(takeJob(lane)?.seq, 3);
});

test("lanes: a quick result that ends after a newer full one is dropped", () => {
  const lanes = newLanes();
  const quick = takeJob(ask(lanes, true));
  dragChanged(lanes, false);
  const full = takeJob(ask(lanes, false));
  assert.ok(quick && full);
  assert.ok(jobSettled(lanes, lanes.full, full).show);
  assert.deepEqual(jobSettled(lanes, lanes.quick, quick), { show: false, failure: null });
  assert.equal(lanes.quick.busy, false);
});

test("lanes: a canceled job leaves no failure; another error does", () => {
  const lanes = newLanes();
  const job = takeJob(ask(lanes, false));
  assert.ok(job);
  assert.deepEqual(jobSettled(lanes, lanes.full, job, { error: new OptimizerCanceled() }), {
    show: false,
    failure: null,
  });
  assert.equal(lanes.full.busy, false);
  const next = takeJob(ask(lanes, false));
  assert.ok(next);
  assert.deepEqual(jobSettled(lanes, lanes.full, next, { error: new Error("out of memory") }), {
    show: false,
    failure: "out of memory",
  });
});

test("lanes: a drag drops the waiting full pass; its end drops the waiting quick pass and runs a full one", () => {
  const lanes = newLanes();
  // a full pass runs and another waits; the drag begins
  const stopped = takeJob(ask(lanes, false));
  ask(lanes, false);
  dragChanged(lanes, true);
  assert.equal(lanes.full.want, null);
  // quick passes: one runs, one waits
  const running = takeJob(ask(lanes, true));
  ask(lanes, true);
  // the drag ends: the waiting quick pass is dropped, and the full pass of the space at the end waits
  dragChanged(lanes, false);
  assert.equal(lanes.quick.want, null);
  const lane = ask(lanes, false);
  assert.equal(lane, lanes.full);
  // the full pass the drag stopped ends, canceled: the release's full pass starts next
  assert.ok(stopped);
  jobSettled(lanes, lanes.full, stopped, { error: new OptimizerCanceled() });
  const release = takeJob(lane);
  assert.equal(release?.quick, false);
  assert.ok(release && running);
  assert.ok(jobSettled(lanes, lanes.full, release).show);
  assert.equal(jobSettled(lanes, lanes.quick, running).show, false);
});
