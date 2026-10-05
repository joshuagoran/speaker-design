interface Props {
  lines: readonly string[];
  /** the drop-down's own label */
  summary?: string;
}

/**
 * A Details drop-down in an optimizer panel, one line each: under the goals, what the picked goals keep from your design;
 * under the run buttons, the grid Fully optimize searches.
 */
export function KeepDetails({ lines, summary = "Details" }: Props) {
  return (
    <details className="mt-2 text-xs text-stone-500 rounded border border-stone-300 bg-stone-50 px-3 py-1">
      <summary className="cursor-pointer text-sm text-stone-900 py-2.5">{summary}</summary>
      <div className="leading-relaxed mt-0.5 mb-1 flex flex-col gap-0.5">
        {lines.length ? (
          lines.map((line) => <div key={line}>{line}</div>)
        ) : (
          <div>Pick a goal to see how far it may move from your design.</div>
        )}
      </div>
    </details>
  );
}
