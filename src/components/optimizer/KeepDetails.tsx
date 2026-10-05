interface Props {
  lines: readonly string[];
  /** more lines after a gap: on the PA page, what Improve and Fully optimize search */
  more?: readonly string[];
}

/** The Details drop-down under an optimizer's goals: what the picked goals keep from your design, one line each. */
export function KeepDetails({ lines, more = [] }: Props) {
  return (
    <details className="mt-2 text-xs text-stone-500 rounded border border-stone-300 bg-stone-50 px-3 py-1">
      <summary className="cursor-pointer text-sm text-stone-900 py-2.5">Details</summary>
      <div className="leading-relaxed mt-0.5 mb-1 flex flex-col gap-0.5">
        {lines.length ? (
          lines.map((line) => <div key={line}>{line}</div>)
        ) : (
          <div>Pick a goal to see how far it may move from your design.</div>
        )}
        {more.length > 0 && (
          <div className="mt-2 flex flex-col gap-0.5">
            {more.map((line) => (
              <div key={line}>{line}</div>
            ))}
          </div>
        )}
      </div>
    </details>
  );
}
