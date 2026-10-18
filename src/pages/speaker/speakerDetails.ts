// The Speaker page's Details fold: every note on its charts and tiles, as short bullets grouped by chart (the response,
// the maximum output, the price, the bracing and weight, the views and the checks). Built from the build and the views.
import { SPEAKER_DETAILS_TEXT as T } from "../../constants/speakerResults";
import { braceNoteLines } from "../../lib/bracingNotes";
import { braceShortfalls, strengthShortfalls } from "../../lib/bracing";
import { formatHz } from "../../lib/format";
import { SPEAKER_TEXT } from "../../constants/speakerPage";
import { bracingText } from "./speakerText";
import type { BoxBracing } from "../../types";

/** One group of the fold: its heading and its bullets. */
export type DetailsGroup = readonly [heading: string, lines: readonly string[]];

/** What the fold reads: each chamber's bracing, whether a chart marks a tuning, the price, and a straight horn's sections. */
export interface SpeakerDetailsInput {
  /**
   * each chamber's bracing, in the spec's order (lib/speaker/speakerBuild), and whether it has none
   * (lib/speaker/fitChips `chamberUnbraced`)
   */
  bracing: readonly {
    unbraced: boolean;
    bracing: Pick<BoxBracing, "targetHz" | "windows" | "ribs" | "panels">;
  }[];
  /** a chart marks a ported chamber's tuning (Fb) */
  fb: boolean;
  /** some parts have no price: the total is a lower bound */
  pricePartial: boolean;
  /** the views show a straight horn's sections */
  sections: boolean;
}

/** The fold's groups, in the results pane's order. */
export function speakerDetails({
  bracing,
  fb,
  pricePartial,
  sections,
}: SpeakerDetailsInput): DetailsGroup[] {
  const bracingLines = bracing.flatMap(({ unbraced, bracing: b }, i) => {
    const n = i + 1;
    if (unbraced) return [T.unbracedLine(n)];
    const target = formatHz(b.targetHz);
    const short = braceShortfalls(b).length > 0 || strengthShortfalls(b).length > 0;
    return [
      T.bracedLine(n, target),
      T.bracesLine(n, bracingText(b)),
      ...(short
        ? [T.underLine(n, target), ...braceNoteLines(`${SPEAKER_TEXT.chamber} ${n}`, b)]
        : []),
    ];
  });
  return [
    [T.response, [...T.responseLines, ...(fb ? [T.fbLine] : [])]],
    [T.maxOutput, T.maxOutputLines],
    [T.price, [...T.priceLines, ...(pricePartial ? [T.partialLine] : [])]],
    [T.bracing, [...bracingLines, T.netAirLine, T.weightLine]],
    [T.views, [...T.viewsLines, ...(sections ? T.sectionLines : [])]],
    [T.checks, T.checksLines],
  ];
}
