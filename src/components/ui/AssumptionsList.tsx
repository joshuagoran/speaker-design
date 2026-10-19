import { DetailsDropdown } from "./DetailsDropdown";

interface Props {
  /** each group: its heading and its lines */
  groups: readonly (readonly [heading: string, lines: readonly string[]])[];
  /** the fold's summary line (default: the Coverage page's, "Assumptions") */
  summary?: string;
  /** the groups side by side as the fold widens (two, then three columns); default: one under another */
  columns?: boolean;
}

/**
 * How a map is modeled, as groups of lines, folded away until opened (the PA Coverage page's and the Space page's), or a
 * page's notes grouped by chart (the Speaker page's Details, in columns).
 */
export function AssumptionsList({ groups, summary = "Assumptions", columns = false }: Props) {
  const list = groups.map(([heading, lines]) => (
    <div key={heading}>
      <div className="text-stone-900 mb-0.5">{heading}</div>
      <ul className="list-disc pl-5 flex flex-col gap-1">
        {lines.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
    </div>
  ));
  return (
    <DetailsDropdown summary={summary}>
      {columns ? (
        // columns pack the groups by height; a group never splits across two
        <div className="sm:columns-2 xl:columns-3 gap-x-6 [&>*]:break-inside-avoid [&>*]:pb-3">
          {list}
        </div>
      ) : (
        list
      )}
    </DetailsDropdown>
  );
}
