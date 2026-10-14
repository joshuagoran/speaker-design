import { RESULT_MAX_WIDTH } from "../../styles/layout";

/** One row of a `DetailList`: its key, its name line and, under it, its detail line. */
export interface DetailRow {
  id: string;
  title: React.ReactNode;
  detail?: React.ReactNode;
}

/**
 * A list of rows in a single column at every width: each row's name, and under it its detail. A row's text wraps at word
 * boundaries across the whole width; it is never set in a narrow column beside the name (a long name would squeeze it
 * to a letter a line).
 */
export function DetailList({ rows }: { rows: readonly DetailRow[] }) {
  return (
    <ul className={`${RESULT_MAX_WIDTH} text-sm`}>
      {rows.map((r) => (
        <li key={r.id} className="border-b border-stone-300 py-1">
          <div className="font-medium break-words">{r.title}</div>
          {r.detail != null && <div className="text-xs text-stone-500 break-words">{r.detail}</div>}
        </li>
      ))}
    </ul>
  );
}
