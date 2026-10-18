import type { FacePoint } from "../../types";
import { NumberField } from "../../components/ui/NumberField";
import { ToggleGroup } from "../../components/ui/ToggleGroup";
import { Tooltip } from "../../components/ui/Tooltip";
import { entriesOf } from "../../lib/records";
import { SPEAKER_TEXT, SET_BY, SET_BY_NAMES } from "../../constants/speakerPage";
import { POSITION_LABELS, POSITION_TIPS } from "../../constants/speakerSettings";
import { shownIn } from "./speakerFields";
import { SPEAKER_STEPS } from "../../constants/speakerSteps";
import { PAIR_ROW } from "../../styles/layout";

interface Props<P extends FacePoint> {
  label: React.ReactNode;
  /** the set position, from the chamber's center line and its bottom; undefined: its rule places it (Auto) */
  value: P | undefined;
  /** where its rule puts it: Auto shows it, and Custom starts from it */
  auto: P;
  onChange: (position: P | undefined) => void;
  /** more fields for a set position (a vent's panel), under the toggle */
  children?: React.ReactNode;
}

/**
 * A part's place on its chamber: Auto (its rule places it; the fields show where, read-only) or Custom (set), its center
 * left or right of the chamber's center and up from its bottom, as a driver's.
 */
export function PlaceFields<P extends FacePoint>({
  label,
  value,
  auto,
  onChange,
  children,
}: Props<P>) {
  const at = value ?? auto;
  return (
    <>
      <ToggleGroup
        label={<Tooltip tip={SPEAKER_TEXT.placeTip}>{label}</Tooltip>}
        value={value ? SET_BY.custom : SET_BY.auto}
        onChange={(v) =>
          onChange(
            v === SET_BY.auto
              ? undefined
              : (value ?? { ...auto, xIn: shownIn(auto.xIn), yIn: shownIn(auto.yIn) }),
          )
        }
        options={entriesOf(SET_BY_NAMES)}
      />
      {value && children}
      <div className={PAIR_ROW}>
        <NumberField
          label={<Tooltip tip={POSITION_TIPS.partX}>{POSITION_LABELS.x}</Tooltip>}
          value={shownIn(at.xIn)}
          disabled={!value}
          step={SPEAKER_STEPS.sizeIn}
          fill
          onChange={(xIn) => value && onChange({ ...value, xIn })}
        />
        <NumberField
          label={<Tooltip tip={POSITION_TIPS.partY}>{POSITION_LABELS.y}</Tooltip>}
          value={shownIn(at.yIn)}
          disabled={!value}
          step={SPEAKER_STEPS.sizeIn}
          fill
          onChange={(yIn) => value && onChange({ ...value, yIn })}
        />
      </div>
    </>
  );
}
