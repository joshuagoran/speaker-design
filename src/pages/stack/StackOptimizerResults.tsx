import { DesignOptimizerResults } from "../../components/optimizer/DesignOptimizerResults";
import { STACK_OPTIMIZER_TEXT } from "../../constants/stackOptimizer";
import { nearMissFacts, nearMissSentence } from "../speaker/speakerText";
import { StackResultCard } from "./StackResultCard";
import type { StackOptimizer } from "./useStackOptimizer";
import type { StackNearMiss } from "../../types";

interface Props {
  optimizer: Pick<StackOptimizer, "result" | "stale" | "isOptimizing" | "search" | "load">;
}

/**
 * The near miss's closest stack in a sentence: its weight, price, level at 1 m and height. Empty when there is none.
 * Ends in a space.
 */
export function stackNearMissText({
  closest,
  closestIsYours,
}: Pick<StackNearMiss, "closest" | "closestIsYours">): string {
  if (!closest) return "";
  return nearMissSentence(
    [...nearMissFacts(closest.metrics), `${closest.metrics.heightIn.toFixed(0)} in tall`],
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
