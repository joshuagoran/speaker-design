import { useState } from "react";

/** A search's result, whether one is running, and the message of the last one that failed. */
export function useOptimizerRun<Result>() {
  const [optimizerResult, setOptimizerResult] = useState<Result | null>(null);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizerError, setOptimizerError] = useState("");
  /** runs `search`; ignored while one is already running (the Run button is disabled then, this guards the call) */
  const runOptimizerSearch = async (search: () => Promise<Result>) => {
    if (isOptimizing) return;
    setIsOptimizing(true);
    setOptimizerError("");
    try {
      setOptimizerResult(await search());
    } catch (e) {
      // the runner rejects with an Error (see makeOptimizerRunner)
      setOptimizerError("The search failed: " + (e instanceof Error ? e.message : String(e)));
    }
    setIsOptimizing(false);
  };
  const clearOptimizerResult = () => setOptimizerResult(null);
  return {
    optimizerResult,
    isOptimizing,
    optimizerError,
    runOptimizerSearch,
    clearOptimizerResult,
  };
}
