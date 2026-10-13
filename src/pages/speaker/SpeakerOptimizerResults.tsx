import { useEffect, useRef } from "react";
import { Notice } from "../../components/ui/Notice";
import { SectionHeading } from "../../components/ui/SectionHeading";
import { LooseLimits } from "../../components/optimizer/LooseLimits";
import { NoFitNotice } from "../../components/optimizer/NoFitNotice";
import { ResultCards } from "../../components/optimizer/ResultCards";
import { OPTIMIZER_PANEL_TEXT } from "../../constants/optimizerText";
import { SPEAKER_OPTIMIZER_TEXT } from "../../constants/speakerOptimizerText";
import { MD_UP, RESULT_MAX_WIDTH } from "../../styles/layout";
import { SpeakerResultCard } from "./SpeakerResultCard";
import { speakerNearMissText } from "./speakerText";
import type { SpeakerOptimizer } from "./useSpeakerOptimizer";

interface Props {
  optimizer: Pick<SpeakerOptimizer, "result" | "isOptimizing" | "search" | "load">;
}

/**
 * The optimizer's results, at the top of the results pane: your design's failures, the cards, the notice when nothing
 * beats your design, and the near miss with the limits that would help. Nothing while a search runs or before one has.
 */
export function SpeakerOptimizerResults({ optimizer }: Props) {
  const { result, isOptimizing, search, load } = optimizer;
  const top = useRef<HTMLElement>(null);
  // on a phone the settings (and the Find button) are below the results: bring the new cards into view
  useEffect(() => {
    if (result && !window.matchMedia(MD_UP).matches)
      top.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [result]);
  if (!result || isOptimizing) return null;
  const { cards, current, nearMiss, goalMissing } = result;
  return (
    <section ref={top} className={`${RESULT_MAX_WIDTH} min-w-0 mt-5`}>
      <SectionHeading className="mb-3">{SPEAKER_OPTIMIZER_TEXT.results}</SectionHeading>
      {current && current.problems.length > 0 && (
        <Notice>{SPEAKER_OPTIMIZER_TEXT.failing(current.problems.join("; "))}</Notice>
      )}
      <ResultCards
        cards={cards}
        render={(card, i) => (
          <SpeakerResultCard
            key={i}
            card={card}
            index={i}
            total={cards.length}
            current={current}
            onLoad={() => load(card)}
          />
        )}
      />
      {goalMissing && <Notice>{goalMissing}</Notice>}
      {cards.length > 0 && nearMiss && nearMiss.options.length > 0 && (
        <LooseLimits
          lead={OPTIMIZER_PANEL_TEXT.looserLimit}
          options={nearMiss.options}
          onPick={search}
        />
      )}
      {!cards.length && nearMiss && (
        <NoFitNotice
          closest={speakerNearMissText(nearMiss)}
          blocking={nearMiss.blocking}
          options={nearMiss.options}
          onPick={search}
        />
      )}
    </section>
  );
}
