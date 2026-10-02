import { useId } from "react";

/** Decimals a slider readout needs: 0 for whole steps, else as many as the step has (0.5 -> 1, 0.25 -> 2) */
export const countDecimals = (step: number) => {
  const t = String(step);
  const i = t.indexOf(".");
  return i < 0 ? 0 : t.length - i - 1;
};

interface Props {
  label: React.ReactNode;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (value: number) => void;
  extra?: React.ReactNode;
}

/** Labelled range slider with a numeric readout. */
export function Slider({ label, value, min, max, step, unit, onChange, extra }: Props) {
  const id = useId();
  const shown = typeof value === "number" ? value.toFixed(countDecimals(step)) : value;
  return (
    <div className="mb-3">
      <div className="flex justify-between items-center gap-3 mb-1">
        <span className="flex items-center gap-2">
          <label htmlFor={id} className="text-sm text-stone-500">
            {label}
          </label>
          {extra}
        </span>
        <span className="text-sm tabular-nums font-medium">
          {shown}
          {unit}
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-valuetext={`${shown}${unit || ""}`}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-stone-900"
      />
    </div>
  );
}
