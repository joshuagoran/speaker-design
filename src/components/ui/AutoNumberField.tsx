import { NumberField } from "./NumberField";
import { ToggleGroup } from "./ToggleGroup";
import { entriesOf } from "../../lib/records";
import { SET_BY, SET_BY_NAMES } from "../../constants/speakerPage";

interface Props {
  /** the name over the Auto / Custom choice */
  label: React.ReactNode;
  /** whether its rule sets the value (Auto); false: typed (Custom) */
  auto: boolean;
  /** what Auto shows: the value its rule sets, in words */
  autoText: string;
  /** the typed value, shown in the field under Custom */
  value: number;
  /** the field's name under Custom */
  fieldLabel: React.ReactNode;
  unit?: React.ReactNode;
  min?: number;
  step?: number;
  /** picks Auto (true) or Custom (false); Custom starts from the value Auto set */
  onAuto: (auto: boolean) => void;
  onChange: (value: number) => void;
}

/** A value its rule sets (Auto, shown as text) or typed (Custom, a number field): an Auto delay or level. */
export function AutoNumberField({
  label,
  auto,
  autoText,
  value,
  fieldLabel,
  unit,
  min,
  step,
  onAuto,
  onChange,
}: Props) {
  return (
    <>
      <ToggleGroup
        label={label}
        value={auto ? SET_BY.auto : SET_BY.custom}
        onChange={(v) => onAuto(v === SET_BY.auto)}
        options={entriesOf(SET_BY_NAMES)}
      />
      {auto ? (
        <p className="text-xs text-stone-500 tabular-nums">{autoText}</p>
      ) : (
        <NumberField
          label={fieldLabel}
          value={value}
          min={min}
          step={step}
          unit={unit}
          onChange={onChange}
        />
      )}
    </>
  );
}
