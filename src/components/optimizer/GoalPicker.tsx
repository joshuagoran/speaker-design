import { ToggleButton } from "../ui/ToggleButton";
import { RankBadge } from "./RankBadge";

interface Props<G extends string> {
  /** every goal, with its short and long name */
  defs: Record<G, { short: string; name: string }>;
  /** the goals picked, in priority order */
  selected: readonly G[];
  onTap: (goal: G) => void;
}

/** Row of goal toggles for an optimizer. */
export function GoalPicker<G extends string>({ defs, selected, onTap }: Props<G>) {
  return (
    <div className="mt-3">
      <div className="text-sm text-stone-500 mb-1">
        Goal <span className="text-xs">(choose one or more, in priority order)</span>
      </div>
      <div className="flex flex-wrap gap-1" role="group" aria-label="Goal">
        {/* boundary: Object.entries types the keys as string; they are the goals `defs` is keyed by */}
        {(Object.entries(defs) as [G, { short: string; name: string }][]).map(([k, g]) => {
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
    </div>
  );
}
