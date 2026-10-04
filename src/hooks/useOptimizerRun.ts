import { useEffect, useRef, useState } from "react";
import { isOptimizerCancel } from "../lib/makeOptimizerRunner";
import type { OptimizerProgress, OptimizerRunOptions } from "../types";

/**
 * A search's result, whether one is running, how far it has got, and the message of the last one that failed; with
 * `cancelOptimizerSearch` to stop a running one (back to idle, no error).
 */
export function useOptimizerRun<Result>() {
  const [optimizerResult, setOptimizerResult] = useState<Result | null>(null);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizerError, setOptimizerError] = useState("");
  const [optimizerProgress, setOptimizerProgress] = useState<OptimizerProgress | null>(null);
  // the running search's controller; a run whose controller has been replaced or cleared no longer touches the state
  const running = useRef<AbortController | null>(null);
  // leaving the page stops a running search
  useEffect(() => () => running.current?.abort(), []);
  /** runs `search`; ignored while one is already running (the Run button is disabled then, this guards the call) */
  const runOptimizerSearch = async (search: (options: OptimizerRunOptions) => Promise<Result>) => {
    if (isOptimizing || running.current) return;
    const ctl = new AbortController();
    running.current = ctl;
    setIsOptimizing(true);
    setOptimizerError("");
    setOptimizerProgress(null);
    try {
      const out = await search({
        signal: ctl.signal,
        onProgress: (p) => {
          if (running.current === ctl) setOptimizerProgress(p);
        },
      });
      if (running.current === ctl) setOptimizerResult(out);
    } catch (e) {
      // a cancel goes back to idle quietly; anything else is a failure (the runner rejects with an Error)
      if (running.current === ctl && !isOptimizerCancel(e))
        setOptimizerError("The search failed: " + (e instanceof Error ? e.message : String(e)));
    }
    if (running.current === ctl) {
      running.current = null;
      setIsOptimizing(false);
      setOptimizerProgress(null);
    }
  };
  /** stops the running search: its worker is stopped and the page goes back to idle, keeping the last result */
  const cancelOptimizerSearch = () => {
    const ctl = running.current;
    if (!ctl) return;
    running.current = null;
    ctl.abort();
    setIsOptimizing(false);
    setOptimizerProgress(null);
  };
  const clearOptimizerResult = () => setOptimizerResult(null);
  return {
    optimizerResult,
    isOptimizing,
    optimizerError,
    optimizerProgress,
    runOptimizerSearch,
    cancelOptimizerSearch,
    clearOptimizerResult,
  };
}
