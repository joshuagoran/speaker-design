interface Props {
  /** the always-visible line that opens and closes the drop-down */
  summary: React.ReactNode;
  /** the lines shown when open, one block each */
  children: React.ReactNode;
}

/** A page's written Details drop-down: a boxed `<details>` with its summary line and stacked small-text lines. */
export function DetailsDropdown({ summary, children }: Props) {
  return (
    <details className="text-xs text-stone-500 rounded border border-stone-300 bg-stone-50 px-3 py-2">
      <summary className="cursor-pointer text-sm text-stone-900 py-1">{summary}</summary>
      <div className="leading-relaxed mt-1 flex flex-col gap-1.5">{children}</div>
    </details>
  );
}
