import { useId } from "react";
import { FormField } from "./FormField";

interface Props {
  value: string;
  onChange: (value: string) => void;
  /** the name over the box; absent, `ariaLabel` names it for screen readers (a box in a row of controls) */
  label?: React.ReactNode;
  ariaLabel?: string;
  placeholder?: string;
  maxLength?: number;
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
  /** the box's height and width classes: a full-width field by default */
  className?: string;
}

/** A one-line text box: a labeled field, or a bare box in a row of controls (a save's or rename's name). */
export function TextField({
  value,
  onChange,
  label,
  ariaLabel,
  placeholder,
  maxLength,
  onKeyDown,
  className = "py-2 w-full",
}: Props) {
  const id = useId();
  const input = (
    <input
      id={id}
      aria-label={label === undefined ? ariaLabel : undefined}
      value={value}
      placeholder={placeholder}
      maxLength={maxLength}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      className={`px-3 rounded border border-stone-300 bg-panel text-sm ${className}`}
    />
  );
  return label === undefined ? (
    input
  ) : (
    <FormField label={label} htmlFor={id}>
      {input}
    </FormField>
  );
}
