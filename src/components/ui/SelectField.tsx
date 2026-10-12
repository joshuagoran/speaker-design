import { FormField } from "./FormField";
import { HOVER_TRANSITION } from "./buttonStyles";
import { useId } from "react";
import { byId } from "../../lib/tables";

/** What a select lists: each option has an id, a name and optionally a price. */
export interface SelectOption {
  id: string;
  name: string;
  price?: number | null;
}

interface Props<T extends SelectOption> {
  label: React.ReactNode;
  options: readonly T[];
  value: T | null | undefined;
  onChange: (option: T) => void;
  extra?: React.ReactNode;
  group?: (option: T) => string;
  /** the row's classes: its bottom margin by default */
  className?: string;
}

/** group: optional (option) => heading; options with the same heading are listed together under it, in order of first appearance */
export function SelectField<T extends SelectOption>({
  label,
  options,
  value,
  onChange,
  extra,
  group,
  className,
}: Props<T>) {
  const opt = (o: T) => (
    <option key={o.id} value={o.id}>
      {o.name}
      {o.price ? ` — $${o.price}` : ""}
    </option>
  );
  const groups = group
    ? [...new Set(options.map(group))].map((g) => ({
        heading: g,
        items: options.filter((o) => group(o) === g),
      }))
    : null;
  const id = useId();
  return (
    <FormField label={label} htmlFor={id} extra={extra} className={className}>
      <select
        id={id}
        value={value?.id ?? ""}
        onChange={(e) => {
          const picked = byId(options, e.target.value);
          if (picked) onChange(picked);
        }}
        // the same height as a text or number field, so a select and a field side by side line up
        className={`w-full h-[38px] px-3 py-2 font-value rounded border border-stone-300 bg-panel text-sm hover:border-stone-500 ${HOVER_TRANSITION}`}
      >
        {groups
          ? groups.map(({ heading, items }) => (
              <optgroup key={heading} label={heading}>
                {items.map(opt)}
              </optgroup>
            ))
          : options.map(opt)}
      </select>
    </FormField>
  );
}
