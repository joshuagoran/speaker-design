import { SEARCH_CAP_MS, SEARCH_RUNS, layoutCutlist } from "./cutlist";
import type {
  CutlistLayout,
  CutlistRequest,
  OptimizerRequest,
  OptimizerResponse,
} from "../../types";
// the packer's worker, bundled separately by Vite and inlined in the page (it starts from a Blob URL)
import CutlistWorker from "./cutlist.worker.ts?worker&inline";

/** A cutlist layout being worked out: `done` settles with it, `cancel` stops the job (its promise then never settles). */
export interface CutlistJob {
  done: Promise<CutlistLayout>;
  cancel: () => void;
}

/**
 * Starts the full cutlist search in a worker of its own, so canceling a stale job just terminates it. Where workers
 * are unavailable it runs on the main thread with the time cap.
 */
export function startCutlistLayout(req: CutlistRequest): CutlistJob {
  let worker: Worker | null = null,
    timer: ReturnType<typeof setTimeout> | undefined;
  const local = (res: (out: CutlistLayout) => void, rej: (e: unknown) => void) => {
    timer = setTimeout(() => {
      try {
        res(
          layoutCutlist(req.parts, req.settings, {
            runs: SEARCH_RUNS,
            capMs: SEARCH_CAP_MS,
            countsOnly: req.countsOnly,
          }),
        );
      } catch (e) {
        rej(e);
      }
    }, 30);
  };
  const done = new Promise<CutlistLayout>((res, rej) => {
    try {
      if (typeof Worker === "undefined") throw new Error("no worker");
      worker = new CutlistWorker();
    } catch {
      local(res, rej);
      return;
    }
    const w = worker;
    w.onmessage = (e: MessageEvent<OptimizerResponse<CutlistLayout>>) => {
      w.terminate();
      if ("error" in e.data) rej(new Error(e.data.error));
      else res(e.data.out);
    };
    w.onerror = () => {
      w.terminate();
      local(res, rej);
    };
    w.postMessage({ id: 1, input: req } satisfies OptimizerRequest<CutlistRequest>);
  });
  return {
    done,
    cancel: () => {
      worker?.terminate();
      clearTimeout(timer);
    },
  };
}
