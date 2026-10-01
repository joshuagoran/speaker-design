import { Button } from "../ui/Button.jsx";

/** Run button with search statistics. */
export function RunRow({ busy, hasGoal, onRun, stats, note, children }) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-3">
      <Button variant="primary" onClick={onRun} disabled={busy || !hasGoal} className="px-4">{busy ? "Searching…" : hasGoal ? "Find 3 designs" : "SelectField a goal first"}</Button>
      {stats && !busy && <span className="text-xs text-stone-500">Searched {stats.evaluated.toLocaleString()} designs in {(stats.ms / 1000).toFixed(1)} s{note}</span>}
      {children}
    </div>
  );
}
