import type { FacePoint } from "../../types";
import { NumberField } from "../../components/ui/NumberField";
import { ToggleGroup } from "../../components/ui/ToggleGroup";
import { Tooltip } from "../../components/ui/Tooltip";
import { entriesOf } from "../../lib/records";
import { SPEAKER_TEXT, SET_BY, SET_BY_NAMES } from "../../constants/speakerPage";
import { shownIn } from "./speakerFields";
import { FIELD_ROW } from "../../styles/layout";

interface Props<P extends FacePoint> {
  label: React.ReactNode;
  /** the set position, from the chamber's center line and its bottom; undefined: its rule places it (Auto) */
  value: P | undefined;
  /** where its rule puts it: Auto shows it, and Custom starts from it */
  auto: P;
  /** the chamber's width: the fields show the position from its left side */
  widthIn: number;
  onChange: (position: P | undefined) => void;
  /** more fields for a set position (a vent's panel), under the toggle */
  children?: React.ReactNode;
}

/**
 * A part's place on its chamber: Auto (its rule places it; the fields show where, read-only) or Custom (set), from the
 * chamber's left side and its bottom, as the chamber's own position.
 */
export function PlaceFields<P extends FacePoint>({
  label,
  value,
  auto,
  widthIn,
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
      <div className={FIELD_ROW}>
        <NumberField
          label={SPEAKER_TEXT.fromLeft}
          value={shownIn(at.xIn + widthIn / 2)}
          disabled={!value}
          step={0.25}
          onChange={(v) => value && onChange({ ...value, xIn: v - widthIn / 2 })}
        />
        <NumberField
          label={SPEAKER_TEXT.fromBottom}
          value={shownIn(at.yIn)}
          disabled={!value}
          step={0.25}
          onChange={(yIn) => value && onChange({ ...value, yIn })}
        />
      </div>
    </>
  );
}
