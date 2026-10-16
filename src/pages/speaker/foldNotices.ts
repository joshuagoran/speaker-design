// The notices a folded horn's failed checks give (lib/speaker/hornBoards `FoldChecks`), each with what to change. Pure.
import type { FoldChecks } from "../../lib/speaker/hornBoards";
import { SPEAKER_TEXT } from "../../constants/speakerPage";
import { FOLD_MIN_PASSAGE_IN } from "../../constants/hornBoards";
import { formatInches } from "../../lib/format";

/** One notice per failed check, in the checks' order. */
export function foldNotices(checks: FoldChecks): string[] {
  const out: string[] = [];
  if (checks.broken) out.push(SPEAKER_TEXT.foldBroken);
  if (checks.outside !== null) out.push(SPEAKER_TEXT.foldOutside(checks.outside + 1));
  if (checks.crossing)
    out.push(SPEAKER_TEXT.foldCrossing(checks.crossing[0] + 1, checks.crossing[1] + 1));
  if (checks.thin !== null) out.push(SPEAKER_TEXT.foldThin(formatInches(FOLD_MIN_PASSAGE_IN)));
  if (checks.choke !== null) out.push(SPEAKER_TEXT.foldChoke);
  const d = checks.drivers;
  if (d && !d.facesPassage) out.push(SPEAKER_TEXT.foldNotFacing);
  if (d && !d.widthFits) out.push(SPEAKER_TEXT.foldWidth);
  if (d && !d.cutoutFits) out.push(SPEAKER_TEXT.foldCutout);
  if (d && !d.magnetClear) out.push(SPEAKER_TEXT.foldMagnet);
  if (d && !d.coneRoom) out.push(SPEAKER_TEXT.foldCone);
  if (d && !d.nearClosed) out.push(SPEAKER_TEXT.foldDeadEnd);
  return out;
}
