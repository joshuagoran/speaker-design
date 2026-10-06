import type {
  OptimizerProgressCallback,
  OptimizerRequest,
  OptimizerMessage,
  OptimizerRunOptions,
} from "../types";

/** How long a worker may go without a word (progress included) before the search is stopped as hung, ms. */
export const OPTIMIZER_STALL_MS = 60_000;

/** What a canceled search rejects with; the page tells it from a failure by its class (`isOptimizerCancel`). */
export class OptimizerCanceled extends Error {
  override name = "AbortError";
  constructor() {
    super("the search was canceled");
  }
}

/** Whether a search stopped because it was canceled, rather than failed. */
export const isOptimizerCancel = (e: unknown): e is OptimizerCanceled =>
  e instanceof OptimizerCanceled;

/**
 * Runs an optimizer in its worker, falling back to the main thread where workers are unavailable. The worker may post
 * progress for a request any number of times before its result. A run stops when its `signal` aborts (the worker is
 * terminated; the next run makes a new one) or when the worker goes `stallMs` without a message.
 */
export function makeOptimizerRunner<I, R>(
  WorkerCtor: new () => Worker,
  optimizeLocal: (input: I, onProgress?: OptimizerProgressCallback) => R,
  stallMs = OPTIMIZER_STALL_MS,
): (input: I, options?: OptimizerRunOptions) => Promise<R> {
  let optWorker: Worker | null = null,
    optNoWorker = false,
    optSeq = 0;
  return function run(input: I, { onProgress, signal }: OptimizerRunOptions = {}): Promise<R> {
    if (signal?.aborted) return Promise.reject(new OptimizerCanceled());
    const id = ++optSeq;
    // On the main thread the search can't be interrupted once it starts (it holds the thread): a cancel before then
    // stops it, one during it only drops the result. Progress reaches the callback synchronously as the search runs.
    const local = () =>
      new Promise<R>((res, rej) => {
        const onAbort = () => {
          clearTimeout(timer);
          rej(new OptimizerCanceled());
        };
        const timer = setTimeout(() => {
          signal?.removeEventListener("abort", onAbort);
          try {
            const out = optimizeLocal(input, onProgress);
            if (signal?.aborted) rej(new OptimizerCanceled());
            else res(out);
          } catch (e) {
            rej(e);
          }
        }, 30);
        signal?.addEventListener("abort", onAbort, { once: true });
      });
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
      const done = () => {
        clearTimeout(stall);
        w.removeEventListener("message", onMsg);
        w.removeEventListener("error", onErr);
        signal?.removeEventListener("abort", onAbort);
      };
      // stops the worker; the next run makes a new one
      const stop = () => {
        done();
        try {
          w.terminate();
        } catch {}
        if (optWorker === w) optWorker = null;
      };
      // a hung worker: stop it and report, rather than leaving the button on "Searching…". A search that keeps
      // reporting progress may run as long as it needs.
      let stall: ReturnType<typeof setTimeout> | undefined;
      const watch = () => {
        clearTimeout(stall);
        stall = setTimeout(() => {
          stop();
          rej(new Error(`no word from the search for ${Math.round(stallMs / 1000)} s`));
        }, stallMs);
      };
      const onMsg = (e: MessageEvent<OptimizerMessage<R>>) => {
        const m = e.data;
        if (m.id !== id) return;
        if ("progress" in m) {
          watch();
          onProgress?.(m.progress);
          return;
        }
        done();
        if ("error" in m) rej(new Error(m.error));
        else res(m.out);
      };
      const onErr = () => {
        done();
        optNoWorker = true;
        if (optWorker === w) optWorker = null;
        local().then(res, rej);
      };
      const onAbort = () => {
        stop();
        rej(new OptimizerCanceled());
      };
      watch();
      w.addEventListener("message", onMsg);
      w.addEventListener("error", onErr);
      signal?.addEventListener("abort", onAbort, { once: true });
      w.postMessage({ id, input } satisfies OptimizerRequest<I>);
    });
  };
}

/**
 * Runs a search's parts side by side under the caller's signal: when one part fails, the others are stopped too (their
 * workers terminated), so a failed run leaves no jobs behind for the next run to queue after.
 */
export async function runParts<T>(
  signal: AbortSignal | undefined,
  parts: (signal: AbortSignal) => Promise<T>[],
): Promise<T[]> {
  const ctl = new AbortController();
  const follow = () => ctl.abort();
  if (signal?.aborted) ctl.abort();
  else signal?.addEventListener("abort", follow, { once: true });
  try {
    return await Promise.all(
      parts(ctl.signal).map((p) =>
        p.catch((e: unknown) => {
          ctl.abort();
          throw e;
        }),
      ),
    );
  } finally {
    signal?.removeEventListener("abort", follow);
  }
}
