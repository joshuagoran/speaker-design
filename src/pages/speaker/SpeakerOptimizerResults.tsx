import { DesignOptimizerResults } from "../../components/optimizer/DesignOptimizerResults";
import { SPEAKER_OPTIMIZER_TEXT } from "../../constants/speakerOptimizerText";
import { SpeakerResultCard } from "./SpeakerResultCard";
import { speakerNearMissText } from "./speakerText";
import type { SpeakerOptimizer } from "./useSpeakerOptimizer";

interface Props {
  optimizer: Pick<SpeakerOptimizer, "result" | "stale" | "isOptimizing" | "search" | "load">;
}

/** The Speaker page's optimizer results, at the top of the results pane (`DesignOptimizerResults`). */
export function SpeakerOptimizerResults({ optimizer }: Props) {
  return (
    <DesignOptimizerResults
      optimizer={optimizer}
      text={SPEAKER_OPTIMIZER_TEXT}
      closestText={speakerNearMissText}
      renderCard={(card, i, total, onLoad) => (
        <SpeakerResultCard
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
