import { HOVER_TRANSITION } from "./buttonStyles";
import type { SelectOption } from "./SelectField";

interface Props<T extends SelectOption> {
  /** what it picks, as screen readers hear it */
  ariaLabel: string;
  options: readonly T[];
  /** the picked option's id; "" shows the prompt */
  value: string;
  onChange: (option: T) => void;
  /** the first line, shown while nothing is picked (it can't be picked) */
  prompt: string;
  /** the heading each option is listed under; absent: one plain list */
  group?: (option: T) => string;
  /** its tooltip: what picking does */
  title?: string;
  disabled?: boolean;
  /** its width classes (default: grows to fill the row) */
  className?: string;
}

/**
 * A bare select in a row of controls (a saved design's list, a template list): no label over it, a prompt as its first
 * line. A labeled select in a settings column is `SelectField`.
 */
export function RowSelect<T extends SelectOption>({
  ariaLabel,
  options,
  value,
  onChange,
  prompt,
  group,
  title,
  disabled,
  className = "min-w-0 max-w-full flex-1",
}: Props<T>) {
  const opt = (o: T) => (
    <option key={o.id} value={o.id}>
      {o.name}
    </option>
  );
  const groups = group
    ? [...new Set(options.map(group))].map((heading) => ({
        heading,
        items: options.filter((o) => group(o) === heading),
      }))
    : null;
  return (
    <select
      aria-label={ariaLabel}
      title={title}
      value={value}
      disabled={disabled}
      onChange={(e) => {
        const picked = options.find((o) => o.id === e.target.value);
        if (picked) onChange(picked);
      }}
      className={`h-[38px] px-2 rounded border border-stone-300 bg-panel text-sm hover:border-stone-500 disabled:text-stone-500 ${HOVER_TRANSITION} ${className}`}
    >
      <option value="" disabled>
        {prompt}
      </option>
      {groups
        ? groups.map(({ heading, items }) => (
            <optgroup key={heading} label={heading}>
              {items.map(opt)}
            </optgroup>
          ))
        : options.map(opt)}
    </select>
  );
}
