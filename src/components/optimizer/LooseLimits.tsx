import { ToggleButton } from "../ui/ToggleButton";

/** A near miss's option: what the button says, and the limits it changes. */
interface Option<S> {
  text: string;
  /** the new value, in the button's title (none: no title) */
  tip?: string;
  set: S;
}

interface Props<S> {
  options: readonly Option<S>[];
  /** runs the search again with these limits changed */
  onPick: (set: S) => void;
  /** the lead-in (shown before the buttons) */
  lead?: string;
}

/** The near miss's option buttons: each loosens one limit and runs the search again. */
export function LooseLimits<S>({ options, onPick, lead }: Props<S>) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs text-stone-500">
      {lead}
      {options.map((o) => (
        <ToggleButton key={o.text} on={false} title={o.tip} onClick={() => onPick(o.set)}>
          {o.text}
        </ToggleButton>
      ))}
    </div>
  );
}
