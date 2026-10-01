import { ToggleButton } from "../ui/ToggleButton.jsx";
import { RankBadge } from "./RankBadge.jsx";

/** Row of goal toggles for an optimizer. */
export function GoalPicker({ defs, selected, onTap }) {
  return (
    <div className="mt-3">
      <div className="text-sm text-stone-500 mb-1">Goal <span className="text-xs">(choose one or more, in priority order)</span></div>
      <div className="flex flex-wrap gap-1" role="group" aria-label="Goal">{Object.entries(defs).map(([k, g]) => { const i = selected.indexOf(k); return <ToggleButton key={k} title={g.name} on={i >= 0} className="relative" onClick={() => onTap(k)}>{selected.length > 1 && i >= 0 && <RankBadge n={i + 1} />}{g.short}</ToggleButton>; })}</div>
    </div>
  );
}
