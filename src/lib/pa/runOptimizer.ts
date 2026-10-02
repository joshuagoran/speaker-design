import { optimizePaStack } from "./optimize.ts";
// the optimizer's worker, bundled separately by Vite and inlined in the page (it starts from a Blob URL)
import OptimizerWorker from "./optimize.worker.ts?worker&inline";
import type {
  OptimizerRequest,
  OptimizerResponse,
  PaOptimizerInput,
  PaOptimizerResult,
} from "../../types.ts";

/** The worker, once started, and whether workers turned out to be unavailable. */
let optWorker: Worker | null = null,
  optNoWorker = false,
  optSeq = 0;

export function runPaOptimizer(input: PaOptimizerInput): Promise<PaOptimizerResult> {
  const id = ++optSeq;
  const local = () =>
    new Promise<PaOptimizerResult>((res, rej) =>
      setTimeout(() => {
        try {
          res(optimizePaStack(input));
        } catch (e) {
          rej(e);
        }
      }, 30),
    );
  if (optNoWorker) return local();
  try {
    if (!optWorker) {
      if (typeof Worker === "undefined") throw new Error("no worker");
      optWorker = new OptimizerWorker();
    }
  } catch {
    optNoWorker = true;
    return local();
  }
  const w = optWorker;
  return new Promise<PaOptimizerResult>((res, rej) => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const done = () => {
      clearTimeout(timer!); // null until the timer starts, which clearTimeout accepts
      w.removeEventListener("message", onMsg);
      w.removeEventListener("error", onErr);
    };
    const onMsg = (e: MessageEvent<OptimizerResponse>) => {
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
    w.postMessage({ id, input } satisfies OptimizerRequest);
  });
}
