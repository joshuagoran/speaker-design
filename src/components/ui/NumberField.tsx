import { FormField } from "./FormField";
import { HOVER_TRANSITION } from "./buttonStyles";
import { useEffect, useId, useState } from "react";

interface Props {
  label: React.ReactNode;
  value: number;
  onChange: (value: number) => void;
  unit?: React.ReactNode;
  min?: number;
  max?: number;
  step?: number;
  /** shown grayed and read-only: a value worked out elsewhere */
  disabled?: boolean;
  /** the box fills its row's cell (a grid of fields) instead of its own fixed width */
  fill?: boolean;
  className?: string;
}

/**
 * Number input with a unit. Clearing the box does not force 0: the value only changes once a number is typed. A number
 * outside `min`–`max` waits while it is typed, and on leaving the box it is moved to the nearest end.
 */
export function NumberField({
  label,
  value,
  onChange,
  unit,
  min,
  max,
  step,
  disabled = false,
  fill = false,
  className = "",
}: Props) {
  const id = useId();
  const [raw, setRaw] = useState(String(value));
  /** `n` moved into `min`–`max` */
  const inRange = (n: number) => Math.min(max ?? Infinity, Math.max(min ?? -Infinity, n));
  useEffect(() => {
    setRaw((r) => (parseFloat(r) === value ? r : String(value)));
  }, [value]);
  return (
    <FormField label={label} htmlFor={id} className={className}>
      <div className={`flex items-center gap-2 text-sm ${fill ? "" : "flex-wrap"}`}>
        <input
          id={id}
          type="number"
          inputMode="decimal"
          value={raw}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          onChange={(e) => {
            setRaw(e.target.value);
            const n = parseFloat(e.target.value);
            if (Number.isFinite(n) && inRange(n) === n) onChange(n);
          }}
          onBlur={() => {
            const n = parseFloat(raw);
            if (!Number.isFinite(n) || inRange(n) === n) return setRaw(String(value));
            onChange(inRange(n));
            setRaw(String(inRange(n)));
          }}
          className={`${fill ? "w-full min-w-0" : "w-24"} px-3 py-2 font-value rounded border border-stone-300 bg-panel ${HOVER_TRANSITION} ${disabled ? "text-stone-500 cursor-not-allowed" : "hover:border-stone-500"}`}
        />
        {unit}
      </div>
    </FormField>
  );
}
