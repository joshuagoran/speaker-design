import { ToggleButton } from "../ui/ToggleButton";
import { RankBadge } from "./RankBadge";
import { entriesOf } from "../../lib/records";
import { keepText, type KeepGoal, type KeepWords } from "../../lib/optimizer/goalKeeps";

interface Props<G extends KeepGoal> {
  /** every goal, with its short and long name */
  defs: Record<G, { short: string; name: string }>;
  /** the goals picked, in priority order */
  selected: readonly G[];
  onTap: (goal: G) => void;
  /** how this optimizer words what each goal keeps, for the Details drop-down */
  keepWords: KeepWords;
}

/** Row of goal toggles for an optimizer, and a Details drop-down saying what the picked goals keep from your design. */
export function GoalPicker<G extends KeepGoal>({ defs, selected, onTap, keepWords }: Props<G>) {
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
            selected.map((k) => <div key={k}>{keepText(k, defs[k].short, keepWords)}</div>)
          ) : (
            <div>Pick a goal to see how far it may move from your design.</div>
          )}
          {selected.length > 0 && keepWords.note && <div>{keepWords.note}</div>}
        </div>
      </details>
    </div>
  );
}
