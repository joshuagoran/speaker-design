import { ToggleButton } from "./ToggleButton";
import type { ButtonSize } from "./buttonStyles";

/** One choice of a `ToggleGroup`: its value, its label, and optionally a tooltip. */
export type ToggleOption<T> = readonly [value: T, label: React.ReactNode, tip?: string];

interface Props<T extends string | number | boolean> {
  /** the name over the buttons; absent when a row label beside the group names it */
  label?: React.ReactNode;
  /** the pressed choice; null when none of them is (a custom mix the choices don't name) */
  value: T | null;
  onChange: (v: T) => void;
  options: readonly ToggleOption<T>[];
  /** choices that can't be picked now, and why (shown as their tooltip) when one reason covers them */
  disabled?: { values: readonly T[]; why?: string };
  size?: ButtonSize;
  /** whether the buttons wrap onto more lines when they don't fit (default); false keeps them on one */
  wrap?: boolean;
  className?: string;
}

/** A labeled row of toggle buttons, one pressed: the value's choices. */
export function ToggleGroup<T extends string | number | boolean>({
  label,
  value,
  onChange,
  options,
  disabled,
  size = "md",
  wrap = true,
  className = "",
}: Props<T>) {
  return (
    <div className={className}>
      {label != null && <div className="text-sm text-stone-500 mb-1">{label}</div>}
      <div className={wrap ? "flex flex-wrap gap-1" : "flex gap-1"}>
        {options.map(([v, l, tip]) => {
          const off = disabled?.values.includes(v) ?? false;
          return (
            <ToggleButton
              key={String(v)}
              size={size}
              on={value === v}
              onClick={() => onChange(v)}
              disabled={off}
              title={off ? (disabled?.why ?? tip) : tip}
            >
              {l}
            </ToggleButton>
          );
        })}
      </div>
    </div>
  );
}
