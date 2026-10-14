import { NumberField } from "./NumberField";
import { ToggleGroup } from "./ToggleGroup";

interface Props {
  label: React.ReactNode;
  /** the limit; null: none */
  value: number | null;
  onChange: (value: number | null) => void;
  /** what the limit starts at when it is turned on */
  startAt: number;
  unit?: React.ReactNode;
  min?: number;
  step?: number;
  /** the two choices' words: no limit, and a limit; `field` names the number's box */
  words: { none: string; limit: string; field: string };
  className?: string;
}

/** A limit that can be off: a No limit / Limit choice, and its number when it is on. */
export function LimitField({
  label,
  value,
  onChange,
  startAt,
  unit,
  min,
  step,
  words,
  className = "mb-4",
}: Props) {
  return (
    <div className={className}>
      <ToggleGroup
        label={label}
        value={value !== null}
        onChange={(on) => onChange(on ? (value ?? startAt) : null)}
        options={[
          [false, words.none],
          [true, words.limit],
        ]}
        className="mb-2"
      />
      {value !== null && (
        <NumberField
          label={words.field}
          value={value}
          min={min}
          step={step}
          unit={unit}
          onChange={onChange}
          className=""
        />
      )}
    </div>
  );
}
