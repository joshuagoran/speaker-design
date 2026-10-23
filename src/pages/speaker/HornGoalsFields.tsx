import { useEffect, useRef, useState } from "react";
import { MarkedText } from "../../components/ui/MarkedText";
import type { HornGoalFit, HornGoals } from "../../types";
import { Button } from "../../components/ui/Button";
import { NumberField } from "../../components/ui/NumberField";
import { Notice } from "../../components/ui/Notice";
import { Tooltip } from "../../components/ui/Tooltip";
import { SPEAKER_TEXT, HORN_GOAL_LIMIT_NAMES } from "../../constants/speakerPage";
import { HORN_GOAL_FIELDS } from "../../constants/hornGoals";
import { PASSBAND_EDGE_DB } from "../../constants/acoustics";
import { GAP_Y_TIGHT, TRIO_ROW } from "../../styles/layout";
import { SETTINGS_TEXT } from "../../constants/speakerSettings";
import { shownTenth } from "./speakerFields";

/** Each goal field: its goal, label, tooltip and unit. */
const GOAL_FIELDS = [
  { goal: "lowHz", label: SPEAKER_TEXT.hornGoalLow, tip: SPEAKER_TEXT.hornGoalLowTip, unit: "Hz" },
  {
    goal: "highHz",
    label: SPEAKER_TEXT.hornGoalHigh,
    tip: SPEAKER_TEXT.hornGoalHighTip,
    unit: "Hz",
  },
  {
    goal: "targetDb",
    label: SPEAKER_TEXT.hornGoalTarget,
    tip: SPEAKER_TEXT.hornGoalTargetTip,
    unit: "dB",
  },
] as const satisfies readonly {
  goal: keyof HornGoals;
  label: string;
  tip: string;
  unit: string;
}[];

interface Props {
  goals: HornGoals;
  /** how the horn meets them now; null when it cannot be calculated */
  fit: HornGoalFit | null;
  /** the horn's air and the chamber's, L, when the horn holds more than the chamber has; else null */
  overAir: { hornL: number; chamberL: number } | null;
  onGoals: (goals: HornGoals) => void;
  /** sizes the horn for the goals; false when no horn can be calculated. Absent: the drive can't be designed. */
  onDesign?: (goals: HornGoals) => boolean;
}

/**
 * A horn's goals (the band it plays flat, and the level it reaches there), the Start from goals action, and how the
 * horn meets the goals now: its spread, its low edge, its lowest maximum output and the air it holds.
 */
export function HornGoalsFields({ goals, fit, overAir, onGoals, onDesign }: Props) {
  const [designing, setDesigning] = useState(false);
  const [failed, setFailed] = useState(false);
  /** the queued search, cleared if the fields go away first */
  const queued = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (queued.current !== null) clearTimeout(queued.current);
    },
    [],
  );
  const short = fit ? goals.targetDb - fit.maxOutDb : 0;
  /** the band is empty: nothing to design for or check */
  const outOfOrder = goals.highHz <= goals.lowHz;
  return (
    <div className={GAP_Y_TIGHT}>
      {/* the Goals label with Start from goals on its row */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-label text-stone-500">{SPEAKER_TEXT.hornGoals}</span>
        {onDesign && (
          <Button
            variant="primary"
            size="xs"
            className="shrink-0"
            disabled={designing || outOfOrder}
            tip={SETTINGS_TEXT.designTip}
            onClick={() => {
              setDesigning(true);
              // let the button show the work before the search holds the page
              queued.current = setTimeout(() => {
                queued.current = null;
                setFailed(!onDesign(goals));
                setDesigning(false);
              }, 0);
            }}
          >
            {designing ? SPEAKER_TEXT.hornDesigning : SPEAKER_TEXT.hornDesign}
          </Button>
        )}
      </div>
      <div className={TRIO_ROW}>
        {GOAL_FIELDS.map(({ goal, label, tip, unit }) => (
          <NumberField
            key={goal}
            label={<Tooltip tip={tip}>{label}</Tooltip>}
            value={goals[goal]}
            {...HORN_GOAL_FIELDS[goal]}
            unit={unit}
            fill
            onChange={(v) => {
              setFailed(false);
              onGoals({ ...goals, [goal]: v });
            }}
          />
        ))}
      </div>
      {outOfOrder && <Notice>{SPEAKER_TEXT.hornGoalsOrder}</Notice>}
      {failed && <Notice>{SPEAKER_TEXT.hornDesignFailed}</Notice>}
      {fit && (
        <>
          <p className="text-xs text-stone-500">
            <MarkedText
              text={SPEAKER_TEXT.hornFitSpread(
                String(shownTenth(fit.spreadDb)),
                String(goals.lowHz),
                String(goals.highHz),
              )}
            />
          </p>
          {fit.lowEdgeDb < -PASSBAND_EDGE_DB && (
            <Notice>{SPEAKER_TEXT.hornFitLowEdge(String(shownTenth(-fit.lowEdgeDb)))}</Notice>
          )}
          <p className="text-xs text-stone-500">
            <MarkedText
              text={SPEAKER_TEXT.hornFitMaxOut(
                String(shownTenth(fit.maxOutDb)),
                String(Math.round(fit.maxOutHz)),
                HORN_GOAL_LIMIT_NAMES[fit.limit],
              )}
            />
          </p>
          {short > 0 && <Notice>{SPEAKER_TEXT.hornFitShort(String(shownTenth(short)))}</Notice>}
        </>
      )}
      {overAir && (
        <Notice>
          {SPEAKER_TEXT.hornFitAir(
            String(shownTenth(overAir.hornL)),
            String(shownTenth(overAir.chamberL)),
          )}
        </Notice>
      )}
    </div>
  );
}
