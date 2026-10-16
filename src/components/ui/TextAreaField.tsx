import { HOVER_TRANSITION } from "./buttonStyles";
import { useId } from "react";
import { FormField } from "./FormField";

interface Props {
  value: string;
  onChange: (value: string) => void;
  label: React.ReactNode;
  /** how many lines of text the box shows */
  rows?: number;
}

/** A labeled box for many lines of text, such as a pasted file. */
export function TextAreaField({ value, onChange, label, rows = 6 }: Props) {
  const id = useId();
  return (
    <FormField label={label} htmlFor={id}>
      <textarea
        id={id}
        value={value}
        rows={rows}
        spellCheck={false}
        onChange={(e) => onChange(e.target.value)}
        className={`block w-full px-3 py-2 font-value rounded border border-stone-300 bg-panel text-xs hover:border-stone-500 ${HOVER_TRANSITION}`}
      />
    </FormField>
  );
}
