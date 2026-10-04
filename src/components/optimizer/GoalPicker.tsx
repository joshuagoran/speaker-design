import { ToggleButton } from "../ui/ToggleButton";
import { RankBadge } from "./RankBadge";
import { entriesOf } from "../../lib/records";

interface Props<G extends string> {
  /** every goal, with its short and long name */
  defs: Record<G, { short: string; name: string }>;
  /** the goals picked, in priority order */
  selected: readonly G[];
  onTap: (goal: G) => void;
  /** the Details drop-down's lines for the picked goals: what they keep from your design, in the optimizer's words */
  details: readonly string[];
}

/** Row of goal toggles for an optimizer, and a Details drop-down saying what the picked goals keep from your design. */
export function GoalPicker<G extends string>({ defs, selected, onTap, details }: Props<G>) {
  return (
    <div className="mt-3">
      <div className="text-sm text-stone-500 mb-1">
        Goal <span className="text-xs">(choose one or more, in priority order)</span>
      </div>
      <div className="flex flex-wrap gap-1" role="group" aria-label="Goal">
        {entriesOf(defs).map(([k, g]) => {
          const i = selected.indexOf(k);
          return (
            <ToggleButton
              key={k}
              title={g.name}
              on={i >= 0}
              className="relative"
              onClick={() => onTap(k)}
            >
              {selected.length > 1 && i >= 0 && <RankBadge n={i + 1} />}
              {g.short}
            </ToggleButton>
          );
        })}
      </div>
      <details className="mt-2 text-xs text-stone-500 rounded border border-stone-300 bg-stone-50 px-3 py-1">
        <summary className="cursor-pointer text-sm text-stone-900 py-2.5">Details</summary>
        <div className="leading-relaxed mt-0.5 mb-1 flex flex-col gap-0.5">
          {selected.length ? (
            details.map((line) => <div key={line}>{line}</div>)
          ) : (
            <div>Pick a goal to see how far it may move from your design.</div>
          )}
        </div>
      </details>
    </div>
  );
}
