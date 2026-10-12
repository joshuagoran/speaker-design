import type { FacePoint } from "../../types";
import { NumberField } from "../../components/ui/NumberField";
import { ToggleGroup } from "../../components/ui/ToggleGroup";
import { Tooltip } from "../../components/ui/Tooltip";
import { entriesOf } from "../../lib/records";
import { DESIGNER_TEXT, SET_BY, SET_BY_NAMES } from "../../constants/designer";

/** A row of number fields that wraps onto more lines where the pane is narrow (as the chamber's). */
const ROW = "flex flex-wrap gap-x-3 gap-y-3 mb-3";

/** A position as the fields show it, to the hundredth of an inch. */
const shown = (v: number) => Math.round(v * 100) / 100;

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
        label={<Tooltip tip={DESIGNER_TEXT.placeTip}>{label}</Tooltip>}
        className="mb-2"
        value={value ? SET_BY.custom : SET_BY.auto}
        onChange={(v) =>
          onChange(
            v === SET_BY.auto
              ? undefined
              : (value ?? { ...auto, xIn: shown(auto.xIn), yIn: shown(auto.yIn) }),
          )
        }
        options={entriesOf(SET_BY_NAMES)}
      />
      {value && children}
      <div className={ROW}>
        <NumberField
          label={DESIGNER_TEXT.fromLeft}
          value={shown(at.xIn + widthIn / 2)}
          disabled={!value}
          step={0.25}
          onChange={(v) => value && onChange({ ...value, xIn: v - widthIn / 2 })}
        />
        <NumberField
          label={DESIGNER_TEXT.fromBottom}
          value={shown(at.yIn)}
          disabled={!value}
          step={0.25}
          onChange={(yIn) => value && onChange({ ...value, yIn })}
        />
      </div>
    </>
  );
}
