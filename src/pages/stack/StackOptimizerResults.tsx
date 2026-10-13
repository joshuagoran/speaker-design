import { DesignOptimizerResults } from "../../components/optimizer/DesignOptimizerResults";
import {
  STACK_NEAR_MISS_TEXT,
  STACK_OPTIMIZER_TEXT,
  STACK_PROBLEM_TEXT,
} from "../../constants/stackOptimizer";
import { nearMissFacts, nearMissSentence } from "../speaker/speakerText";
import { StackResultCard } from "./StackResultCard";
import type { StackOptimizer } from "./useStackOptimizer";
import type { StackNearMiss } from "../../types";

interface Props {
  optimizer: Pick<StackOptimizer, "result" | "stale" | "isOptimizing" | "search" | "load">;
}

/**
 * The near miss's closest stack in a sentence: its weight (its heaviest box's where the weight limit, which is per box,
 * blocks it), price, level at 1 m and height. Empty when there is none. Ends in a space.
 */
export function stackNearMissText({
  closest,
  closestIsYours,
  blocking,
}: Pick<StackNearMiss, "closest" | "closestIsYours" | "blocking">): string {
  if (!closest) return "";
  const m = closest.metrics;
  const weight = blocking.includes(STACK_PROBLEM_TEXT.weight)
    ? STACK_NEAR_MISS_TEXT.heaviest(Math.max(0, ...m.boxes.map((b) => b?.lb ?? 0)).toFixed(0))
    : undefined;
  return nearMissSentence(
    [...nearMissFacts(m, weight), `${m.heightIn.toFixed(0)} in tall`],
    closestIsYours,
  );
}

/** The Stack page's optimizer results, at the top of the results pane (`DesignOptimizerResults`). */
export function StackOptimizerResults({ optimizer }: Props) {
  return (
    <DesignOptimizerResults
      optimizer={optimizer}
      text={STACK_OPTIMIZER_TEXT}
      closestText={stackNearMissText}
      renderCard={(card, i, total, onLoad) => (
        <StackResultCard
          card={card}
          index={i}
          total={total}
          current={optimizer.result?.current ?? null}
          onLoad={onLoad}
        />
      )}
    />
  );
}
