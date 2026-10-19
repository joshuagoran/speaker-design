import { afterEach, test } from "vite-plus/test";
import assert from "node:assert";
import { makeOptimizerRunner, isOptimizerCancel } from "../src/lib/makeOptimizerRunner";
import { throttledProgress } from "../src/lib/optimizer/progress";
import type { OptimizerMessage, OptimizerProgress, OptimizerRequest } from "../src/types";

// ---- the runner, with a fake Worker (Vitest runs in Node, which has none) ----

/** What a fake worker does with a request: it posts its messages through `post`. */
type Script = (req: OptimizerRequest<number>, post: (m: OptimizerMessage<number>) => void) => void;

class FakeWorker {
  static script: Script = () => {};
  static made: FakeWorker[] = [];
  terminated = false;
  private listeners = new Map<string, Set<(e: { data: unknown }) => void>>();
  constructor() {
    FakeWorker.made.push(this);
  }
  addEventListener(type: string, fn: (e: { data: unknown }) => void) {
    const set = this.listeners.get(type) ?? new Set();
    set.add(fn);
    this.listeners.set(type, set);
  }
  removeEventListener(type: string, fn: (e: { data: unknown }) => void) {
    this.listeners.get(type)?.delete(fn);
  }
  postMessage(req: OptimizerRequest<number>) {
    FakeWorker.script(req, (m) => {
      if (this.terminated) return;
      for (const fn of this.listeners.get("message") ?? []) fn({ data: m });
    });
  }
  terminate() {
    this.terminated = true;
  }
}
// boundary cast: the fake has just the members the runner uses, not all of Worker's
const FakeCtor = FakeWorker as unknown as new () => Worker;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
// the runner checks that workers exist before making one
Object.assign(globalThis, { Worker: FakeWorker });
afterEach(() => {
  FakeWorker.script = () => {};
  FakeWorker.made = [];
});
// the fallback: what the main thread would compute (it never should, in the worker tests)
const local = (n: number, onProgress?: (p: OptimizerProgress) => void) => {
  onProgress?.({ done: 1, total: 1 });
  return -n;
};

// the best-so-far words the fake worker sends with its last report
const BEST = "$420";
test("runner: progress reaches onProgress in order, then the result comes back unchanged", async () => {
  FakeWorker.script = (req, post) => {
    void (async () => {
      for (let i = 1; i <= 3; i++) {
        await wait(5);
        post({ id: req.id, progress: { done: i, total: 3, best: i === 3 ? BEST : undefined } });
      }
      await wait(5);
      post({ id: req.id + 1000, progress: { done: 99, total: 99 } }); // another request's: ignored
      post({ id: req.id, out: req.input * 2 });
    })();
  };
  const run = makeOptimizerRunner(FakeCtor, local);
  const seen: OptimizerProgress[] = [];
  const out = await run(21, { onProgress: (p) => seen.push(p) });
  assert.equal(out, 42);
  assert.deepEqual(
    seen.map((p) => p.done),
    [1, 2, 3],
  );
  assert.equal(seen[2].best, BEST);
  // without options too, as before
  assert.equal(await run(5), 10);
  assert.equal(FakeWorker.made.length, 1, "one worker for both runs");
});

test("runner: abort terminates the worker, rejects with the cancel error, and the next run gets a new worker", async () => {
  FakeWorker.script = (req, post) => post({ id: req.id, progress: { done: 0, total: 10 } });
  const run = makeOptimizerRunner(FakeCtor, local);
  const ctl = new AbortController();
  const p = run(1, { signal: ctl.signal });
  await wait(10);
  ctl.abort();
  const err = await p.then(
    () => null,
    (e: unknown) => e,
  );
  assert.ok(isOptimizerCancel(err), "a cancel, told apart by its class");
  assert.ok(FakeWorker.made[0].terminated, "the worker is stopped");
  // no fallback to the main thread, and a fresh worker next time
  FakeWorker.script = (req, post) => setTimeout(() => post({ id: req.id, out: 7 }), 5);
  assert.equal(await run(1), 7);
  assert.equal(FakeWorker.made.length, 2);
  // a signal that is already aborted never starts
  const gone = new AbortController();
  gone.abort();
  await assert.rejects(run(1, { signal: gone.signal }), (e) => isOptimizerCancel(e));
});

test("runner: a worker with nothing to say is stopped as stalled; one that keeps reporting runs on", async () => {
  // a 300 ms guard against progress every 20 ms: room for a busy machine's late timers
  const run = makeOptimizerRunner(FakeCtor, local, 300);
  FakeWorker.script = () => {}; // silent
  const err = await run(1).then(
    () => null,
    (e: unknown) => e,
  );
  assert.ok(err instanceof Error && !isOptimizerCancel(err), "a failure, not a cancel");
  assert.ok(FakeWorker.made[0].terminated);
  // progress every 20 ms for 1 s (over three stall windows) keeps it alive
  FakeWorker.script = (req, post) => {
    void (async () => {
      for (let i = 0; i < 50; i++) {
        await wait(20);
        post({ id: req.id, progress: { done: i, total: 50 } });
      }
      post({ id: req.id, out: 3 });
    })();
  };
  assert.equal(await run(1), 3);
});

test("runner: without workers the search runs on the main thread, with progress", async () => {
  Reflect.deleteProperty(globalThis, "Worker");
  try {
    const run = makeOptimizerRunner(FakeCtor, local);
    const seen: OptimizerProgress[] = [];
    assert.equal(await run(4, { onProgress: (p) => seen.push(p) }), -4);
    assert.deepEqual(seen, [{ done: 1, total: 1 }]);
    // a cancel before it starts stops it
    const ctl = new AbortController();
    const p = run(4, { signal: ctl.signal });
    ctl.abort();
    await assert.rejects(p, (e) => isOptimizerCancel(e));
  } finally {
    Object.assign(globalThis, { Worker: FakeWorker });
  }
});

test("throttledProgress passes on at most one report per interval, and always the final one", () => {
  const seen: OptimizerProgress[] = [];
  const report = throttledProgress((p) => seen.push(p), 1e9);
  for (let i = 0; i < 100; i++) report(i, 100);
  report(100, 100, true);
  assert.deepEqual(seen, [
    { done: 0, total: 100 },
    { done: 100, total: 100 },
  ]);
});

// ---- the engines: the same result with and without a progress callback ----
