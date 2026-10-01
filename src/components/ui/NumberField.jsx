import { FormField } from "./FormField.jsx";
const { useEffect, useId, useState } = React;

/** Number input with a unit. Clearing the box does not force 0: the value only changes once a number is typed. */
export function NumberField({ label, value, onChange, unit, min, max, step, className = "" }) {
  const id = useId();
  const [raw, setRaw] = useState(String(value));
  useEffect(() => { setRaw((r) => (parseFloat(r) === value ? r : String(value))); }, [value]);
  return (
    <FormField label={label} htmlFor={id} className={className}>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <input id={id} type="number" inputMode="decimal" value={raw} min={min} max={max} step={step}
          onChange={(e) => { setRaw(e.target.value); const n = parseFloat(e.target.value); if (Number.isFinite(n)) onChange(n); }}
          onBlur={() => setRaw(String(value))}
          className="w-24 px-3 py-2 rounded border border-stone-300 bg-white" />
        {unit}
      </div>
    </FormField>
  );
}
