import { FormField } from "./FormField";
import { HOVER_TRANSITION } from "./buttonStyles";
import { useEffect, useId, useState } from "react";
import { useUnitSystem } from "../../hooks/useUnits";
import { fromShown, shownStep, toShown } from "../../lib/units";
import type { Quantity } from "../../types";

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
  /**
   * what the value measures, when the Units setting changes it: `value`, `min`, `max` and `step` stay in the stored
   * unit, and the box shows and reads them in the unit the page shows (`unit` is the caller's, from `useUnits`)
   */
  quantity?: Quantity;
}

/**
 * Number input with a unit. Clearing the box does not force 0: the value only changes once a number is typed. A number
 * outside `min`–`max` waits while it is typed, and on leaving the box it is moved to the nearest end. With a
 * `quantity`, the box converts at its edge: it shows the value in the page's unit and hands back the stored unit.
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
  quantity,
}: Props) {
  const id = useId();
  const system = useUnitSystem();
  /** a stored amount as the box shows it, and a typed number in the stored unit */
  const show = (v: number) => (quantity ? toShown(quantity, system, v) : v);
  const read = (n: number) => (quantity ? fromShown(quantity, system, n) : n);
  const shown = show(value);
  const [raw, setRaw] = useState(String(shown));
  /** `n` (stored unit) moved into `min`–`max` */
  const inRange = (n: number) => Math.min(max ?? Infinity, Math.max(min ?? -Infinity, n));
  /** whether typed text `r` is the stored `v` (within the display's rounding) */
  const holds = (r: string, v: number) => {
    const n = parseFloat(r);
    return n === show(v) || (quantity !== undefined && show(read(n)) === show(v));
  };
  // the box keeps what is typed while it reads as the value (a metric box rounds), and shows a new value otherwise
  useEffect(() => {
    setRaw((r) => (holds(r, value) ? r : String(show(value))));
  }, [value, quantity, system]);
  return (
    <FormField label={label} htmlFor={id} className={className}>
      <div className={`flex items-center gap-2 text-sm ${fill ? "" : "flex-wrap"}`}>
        <input
          id={id}
          type="number"
          inputMode="decimal"
          value={raw}
          min={min === undefined ? undefined : show(min)}
          max={max === undefined ? undefined : show(max)}
          step={quantity ? shownStep(quantity, system, step) : step}
          disabled={disabled}
          onChange={(e) => {
            setRaw(e.target.value);
            const n = read(parseFloat(e.target.value));
            if (Number.isFinite(n) && inRange(n) === n) onChange(n);
          }}
          onBlur={() => {
            const n = read(parseFloat(raw));
            if (!Number.isFinite(n) || inRange(n) === n) return setRaw(String(shown));
            onChange(inRange(n));
            setRaw(String(show(inRange(n))));
          }}
          className={`${fill ? "w-full min-w-0" : "w-24"} px-3 py-2 font-value rounded border border-stone-300 bg-panel ${HOVER_TRANSITION} ${disabled ? "text-stone-500 cursor-not-allowed" : "hover:border-stone-500"}`}
        />
        {unit}
      </div>
    </FormField>
  );
}
