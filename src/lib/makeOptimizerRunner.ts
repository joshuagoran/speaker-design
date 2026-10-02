import type { OptimizerRequest, OptimizerResponse } from "../types";

/** Runs an optimizer in its worker, falling back to the main thread where workers are unavailable. */
export function makeOptimizerRunner<I, R>(
  WorkerCtor: new () => Worker,
  optimizeLocal: (input: I) => R,
): (input: I) => Promise<R> {
  let optWorker: Worker | null = null,
    optNoWorker = false,
    optSeq = 0;
  return function run(input: I): Promise<R> {
    const id = ++optSeq;
    const local = () =>
      new Promise<R>((res, rej) =>
        setTimeout(() => {
          try {
            res(optimizeLocal(input));
          } catch (e) {
            rej(e);
          }
        }, 30),
      );
    if (optNoWorker) return local();
    try {
      if (!optWorker) {
        if (typeof Worker === "undefined") throw new Error("no worker");
        optWorker = new WorkerCtor();
      }
    } catch {
      optNoWorker = true;
      return local();
    }
    const w = optWorker;
    return new Promise<R>((res, rej) => {
      let timer: ReturnType<typeof setTimeout> | null = null;
      const done = () => {
        clearTimeout(timer!); // null until the timer starts, which clearTimeout accepts
        w.removeEventListener("message", onMsg);
        w.removeEventListener("error", onErr);
      };
      const onMsg = (e: MessageEvent<OptimizerResponse<R>>) => {
        if (e.data.id !== id) return;
        done();
        if (e.data.error) rej(new Error(e.data.error));
        else res(e.data.out!);
      };
      const onErr = () => {
        done();
        optNoWorker = true;
        if (optWorker === w) optWorker = null;
        local().then(res, rej);
      };
      // a hung worker: stop it and report, rather than leaving the button on "Searching…"
      timer = setTimeout(() => {
        done();
        try {
          w.terminate();
        } catch {}
        if (optWorker === w) optWorker = null;
        rej(new Error("took longer than 60 s"));
      }, 60000);
      w.addEventListener("message", onMsg);
      w.addEventListener("error", onErr);
      w.postMessage({ id, input } satisfies OptimizerRequest<I>);
    });
  };
}
