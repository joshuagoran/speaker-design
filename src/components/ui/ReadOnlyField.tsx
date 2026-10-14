import { useId } from "react";
import { FormField } from "./FormField";

interface Props {
  label: React.ReactNode;
  /** the value as shown: a number worked out elsewhere */
  value: number;
  unit?: React.ReactNode;
  className?: string;
}

/** A value you read but do not set: the same label, box and unit as a number field, without the input. */
export function ReadOnlyField({ label, value, unit, className = "" }: Props) {
  const id = useId();
  return (
    <FormField label={label} htmlFor={id} className={className}>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <output
          id={id}
          className="w-24 px-3 py-2 font-value rounded border border-stone-300 bg-panel text-stone-500"
        >
          {value}
        </output>
        {unit}
      </div>
    </FormField>
  );
}
