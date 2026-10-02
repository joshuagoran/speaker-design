import { useEffect, useState } from "react";
import { Button } from "../ui/Button";

/** "Searching" with dots that count up, in a fixed width so the button doesn't jump. */
function Searching() {
  const [n, setN] = useState(1);
  useEffect(() => {
    const id = setInterval(() => setN((k) => (k % 3) + 1), 400);
    return () => clearInterval(id);
  }, []);
  return (
    <span>
      Searching<span className="inline-block w-[3ch] text-left">{".".repeat(n)}</span>
    </span>
  );
}

/** Run button with search statistics. */
export function RunRow({ busy, hasGoal, onRun, stats, note, children }) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-3">
      <Button variant="primary" onClick={onRun} disabled={busy || !hasGoal} className="px-4">
        {busy ? <Searching /> : hasGoal ? "Find 3 designs" : "Pick a goal first"}
      </Button>
      {stats && !busy && (
        <span className="text-xs text-stone-500">
          Searched {stats.evaluated.toLocaleString()} designs in {(stats.ms / 1000).toFixed(1)} s
          {note}
        </span>
      )}
      {children}
    </div>
  );
}
