import { NumberField } from "./NumberField";
import { ToggleGroup } from "./ToggleGroup";
import { WithLock, type LockControl } from "./LockButton";
import { entriesOf } from "../../lib/records";
import { SET_BY, SET_BY_NAMES } from "../../constants/speakerPage";

interface Props {
  /** the name over the Auto / Manual choice */
  label: React.ReactNode;
  /** whether its rule sets the value (Auto); false: typed (Manual) */
  auto: boolean;
  /** what Auto shows: the value its rule sets, in words */
  autoText: string;
  /** the typed value, shown in the field under Manual */
  value: number;
  /** the field's name under Manual */
  fieldLabel: React.ReactNode;
  unit?: React.ReactNode;
  min?: number;
  step?: number;
  /** picks Auto (true) or Manual (false); Manual starts from the value Auto set */
  onAuto: (auto: boolean) => void;
  onChange: (value: number) => void;
  /** an optimizer lock beside the Auto / Manual choice */
  lock?: LockControl;
}

/** A value its rule sets (Auto, shown as text) or typed (Manual, a number field): a stack member's Auto delay. */
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
  lock,
}: Props) {
  return (
    <>
      <WithLock lock={lock}>
        <ToggleGroup
          label={label}
          value={auto ? SET_BY.auto : SET_BY.custom}
          onChange={(v) => onAuto(v === SET_BY.auto)}
          options={entriesOf(SET_BY_NAMES)}
        />
      </WithLock>
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
