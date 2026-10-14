import { Button } from "./Button";
import { SelectField, type SelectOption } from "./SelectField";
import { START_PICKER_TEXT } from "../../constants/startPicker";

interface Props<T extends SelectOption> {
  options: readonly T[];
  value: T | null | undefined;
  onChange: (option: T) => void;
  /** the heading each option is listed under */
  group: (option: T) => string;
  /** replaces the design with the picked start */
  onStart: () => void;
  /** a second action beside the start button (empty the design) */
  secondary?: { label: string; onClick: () => void };
  /** what the start does, under the buttons */
  hint: React.ReactNode;
}

/**
 * Where a page's design starts: the "Start from" list with its groups, the primary button that starts over from the
 * pick, an optional second action, and the hint. The Speaker, Stack and Space pages all start this way.
 */
export function StartPicker<T extends SelectOption>({
  options,
  value,
  onChange,
  group,
  onStart,
  secondary,
  hint,
}: Props<T>) {
  return (
    <>
      <SelectField
        label={START_PICKER_TEXT.startFrom}
        options={options}
        value={value}
        onChange={onChange}
        group={group}
      />
      <div className="flex flex-wrap gap-2 mb-2">
        <Button variant="primary" onClick={onStart}>
          {START_PICKER_TEXT.startOver}
        </Button>
        {secondary && <Button onClick={secondary.onClick}>{secondary.label}</Button>}
      </div>
      <p className="text-xs text-stone-500 mb-2">{hint}</p>
    </>
  );
}
