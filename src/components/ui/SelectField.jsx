import { FormField } from "./FormField.jsx";
import { useId } from "react";

/** group: optional (option) => heading; options with the same heading are listed together under it, in order of first appearance */
export function SelectField({ label, options, value, onChange, extra, group }) {
  const opt = (o) => (
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
        onChange={(e) => onChange(options.find((o) => o.id === e.target.value))}
        className="w-full px-3 py-2 rounded border border-stone-300 bg-white text-sm hover:border-stone-500"
      >
        {groups
          ? groups.map((g) => (
              <optgroup key={g} label={g}>
                {options.filter((o) => group(o) === g).map(opt)}
              </optgroup>
            ))
          : options.map(opt)}
      </select>
    </FormField>
  );
}
