import { Button } from "../ui/Button";
import { Ellipsis } from "../ui/Ellipsis";
import type { OptimizerProgress, PaOptimizerResult } from "../../types";

interface Props {
  busy: boolean;
  hasGoal: boolean;
  onRun: () => void;
  /** the run button's words when idle with a goal picked */
  runLabel?: string;
  /** a second run button beside the first (the PA's Fully optimize); `running` when the search running is its own */
  alt?: { label: string; onRun: () => void; running: boolean };
  /** stops the running search; without it there is no Cancel button */
  onCancel?: () => void;
  /** how far the running search has got; null before its first report */
  progress?: OptimizerProgress | null;
  /** what the last search covered; null before the first one */
  stats: Pick<PaOptimizerResult["stats"], "evaluated" | "ms"> | null | undefined;
  note?: React.ReactNode;
  children?: React.ReactNode;
}

/** Run button with search statistics; while searching, a Cancel button and the search's progress. */
export function RunRow({
  busy,
  hasGoal,
  onRun,
  runLabel = "Find 3 designs",
  alt,
  onCancel,
  progress,
  stats,
  note,
  children,
}: Props) {
  const label = (idle: string, mine: boolean) =>
    busy && mine ? <Searching /> : hasGoal ? idle : "Pick a goal first";
  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="primary" onClick={onRun} disabled={busy || !hasGoal} className="px-4">
          {label(runLabel, !alt?.running)}
        </Button>
        {alt && (
          <Button onClick={alt.onRun} disabled={busy || !hasGoal} className="px-4">
            {label(alt.label, alt.running)}
          </Button>
        )}
        {busy && onCancel && (
          <Button onClick={onCancel} className="min-h-10 min-w-10">
            Cancel
          </Button>
        )}
        {stats && !busy && (
          <span className="text-xs text-stone-500">
            Searched {stats.evaluated.toLocaleString()} designs in {(stats.ms / 1000).toFixed(1)} s
            {note}
          </span>
        )}
        {children}
      </div>
      {busy && <SearchProgress progress={progress ?? null} />}
    </div>
  );
}

function Searching() {
  return (
    <span>
      Searching
      <Ellipsis />
    </span>
  );
}

/** A slim bar on a fixed 0–100 % track and one line of words; both keep their size as the numbers change. */
function SearchProgress({ progress }: { progress: OptimizerProgress | null }) {
  const pct =
    progress && progress.total > 0
      ? Math.min(100, Math.max(0, (100 * progress.done) / progress.total))
      : 0;
  return (
    <div className="mt-2 w-full max-w-md" data-testid="search-progress">
      <div
        className="h-1.5 w-full overflow-hidden rounded bg-stone-300"
        role="progressbar"
        aria-label="Search progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
      >
        <div
          className="h-full bg-cmy-a transition-[width] duration-150 motion-reduce:transition-none"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-1 h-4 truncate text-xs leading-4 tabular-nums text-stone-500">
        {/* a share, not counts: a search's units (boxes, grid points) aren't the designs its result counts */}
        {progress && progress.total > 0 ? `${Math.floor(pct)} %` : "starting"}
        {progress && progress.best ? ` · best so far: ${progress.best}` : ""}
      </div>
    </div>
  );
}
