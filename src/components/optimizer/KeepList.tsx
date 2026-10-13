/** One line of a Keep list: what it names, and the lock button (or dimension lock) that keeps it. */
export interface KeepRow {
  key: string;
  label: React.ReactNode;
  control: React.ReactNode;
}

/** A titled run of Keep rows. */
export interface KeepGroup {
  title: string;
  rows: readonly KeepRow[];
}

interface Props {
  groups: readonly KeepGroup[];
}

/**
 * A "Keep" list for an optimizer whose parts are not fields on one page (the Speaker's drivers, vents and band
 * filters): each line names a part and carries its lock button. Groups with no rows are left out.
 */
export function KeepList({ groups }: Props) {
  return (
    <div className="flex flex-col gap-3">
      {groups
        .filter((g) => g.rows.length > 0)
        .map((g) => (
          <div key={g.title}>
            <h4 className="text-xs font-semibold text-stone-500 mb-1">{g.title}</h4>
            <ul>
              {g.rows.map((r) => (
                <li
                  key={r.key}
                  className="flex items-center justify-between gap-2 border-b border-stone-300 py-1 text-sm"
                >
                  <span className="min-w-0 break-words">{r.label}</span>
                  {r.control}
                </li>
              ))}
            </ul>
          </div>
        ))}
    </div>
  );
}
