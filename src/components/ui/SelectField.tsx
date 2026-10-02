import { FormField } from "./FormField";
import { useId } from "react";

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
}

/** group: optional (option) => heading; options with the same heading are listed together under it, in order of first appearance */
export function SelectField<T extends SelectOption>({
  label,
  options,
  value,
  onChange,
  extra,
  group,
}: Props<T>) {
  // `group!` below: it is set whenever `groups` is; `find(...)!`: the select only offers ids from `options`
  const opt = (o: T) => (
    <option key={o.id} value={o.id}>
      {o.name}
      {o.price ? ` — $${o.price}` : ""}
    </option>
  );
  const groups = group ? [...new Set(options.map(group))] : null;
  const id = useId();
  return (
    <FormField label={label} htmlFor={id} extra={extra}>
      <select
        id={id}
        value={value?.id ?? ""}
        onChange={(e) => onChange(options.find((o) => o.id === e.target.value)!)}
        className="w-full px-3 py-2 rounded border border-stone-300 bg-white text-sm hover:border-stone-500"
      >
        {groups
          ? groups.map((g) => (
              <optgroup key={g} label={g}>
                {options.filter((o) => group!(o) === g).map(opt)}
              </optgroup>
            ))
          : options.map(opt)}
      </select>
    </FormField>
  );
}
