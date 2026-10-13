import { Fragment, useEffect, useRef } from "react";
import { Notice } from "../ui/Notice";
import { SectionHeading } from "../ui/SectionHeading";
import { LooseLimits } from "./LooseLimits";
import { NoFitNotice } from "./NoFitNotice";
import { ResultCards } from "./ResultCards";
import { OPTIMIZER_PANEL_TEXT } from "../../constants/optimizerText";
import { MD_UP, RESULT_MAX_WIDTH } from "../../styles/layout";

/** The words the results block takes from a page's optimizer text. */
export interface OptimizerResultsText {
  /** the block's heading */
  results: string;
  /** the notice over cards searched for a design edited since */
  stale: string;
  /** the notice when your design fails: the problems, joined */
  failing: (problems: string) => string;
}

/** The near miss as the block reads it: the limits that would help (each a button) and what blocks the closest design. */
interface NearMissView<Limits> {
  options: readonly { text: string; set: Limits }[];
  blocking: readonly string[];
}

/** A search's result as the block reads it: the cards, your design's failures and the near miss. */
interface ResultView<Card, Near> {
  cards: readonly Card[];
  current: { problems: readonly string[] } | null;
  goalMissing: string | null;
  nearMiss: Near | null;
}

interface Props<Card, Limits, Near extends NearMissView<Limits>> {
  /** the page's optimizer: the result (null: none yet), whether it is stale, the search and Load */
  optimizer: {
    result: ResultView<Card, Near> | null;
    stale: boolean;
    isOptimizing: boolean;
    search: (set: Limits) => void;
    load: (card: Card) => void;
  };
  text: OptimizerResultsText;
  /** draws one card: its place among the cards, how many there are, and Load (null: off, the cards are stale) */
  renderCard: (
    card: Card,
    index: number,
    total: number,
    onLoad: (() => void) | null,
  ) => React.ReactNode;
  /** the near miss's closest design in a sentence (ends in a space; empty for none) */
  closestText: (nearMiss: Near) => string;
}

/**
 * The optimizer's results, at the top of the results pane: your design's failures, the cards, the notice when nothing
 * beats your design, and the near miss with the limits that would help. Nothing while a search runs or before one has;
 * a notice, and Load off, once the design changed after the search. The Speaker and Stack pages share it.
 */
export function DesignOptimizerResults<Card, Limits, Near extends NearMissView<Limits>>({
  optimizer,
  text,
  renderCard,
  closestText,
}: Props<Card, Limits, Near>) {
  const { result, stale, isOptimizing, search, load } = optimizer;
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
      <SectionHeading className="mb-3">{text.results}</SectionHeading>
      {stale && <Notice>{text.stale}</Notice>}
      {current && current.problems.length > 0 && (
        <Notice>{text.failing(current.problems.join("; "))}</Notice>
      )}
      <ResultCards
        cards={cards}
        render={(card, i) => (
          <Fragment key={i}>
            {renderCard(card, i, cards.length, stale ? null : () => load(card))}
          </Fragment>
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
          closest={closestText(nearMiss)}
          blocking={nearMiss.blocking}
          options={nearMiss.options}
          onPick={search}
        />
      )}
    </section>
  );
}
