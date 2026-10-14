import { LooseLimits } from "./LooseLimits";
import { OPTIMIZER_PANEL_TEXT } from "../../constants/optimizerText";
import { FONT } from "../../styles/fonts";
import { GAP_Y_TIGHT } from "../../styles/layout";

interface Props<S> {
  /** the closest design in a sentence (ends in a space); empty for none */
  closest: string;
  /** what blocks it */
  blocking: readonly string[];
  options: readonly { text: string; set: S }[];
  onPick: (set: S) => void;
}

/** The notice when no design fits the limits: the closest design, what blocks it and the limits that would help. */
export function NoFitNotice<S>({ closest, blocking, options, onPick }: Props<S>) {
  return (
    <div className={`rounded-lg border border-orange-300 bg-orange-50 px-3 py-3 ${GAP_Y_TIGHT}`}>
      <h3 className="text-base" style={{ fontFamily: FONT, fontWeight: 700 }}>
        {OPTIMIZER_PANEL_TEXT.noFit}
      </h3>
      <div className="text-xs text-orange-900">
        {closest}
        Blocked by: {blocking.join("; ")}.
      </div>
      {options.length > 0 && <LooseLimits options={options} onPick={onPick} />}
    </div>
  );
}
