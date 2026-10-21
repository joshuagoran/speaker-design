import { DetailsDropdown } from "./DetailsDropdown";
import { MarkedText } from "./MarkedText";

/** One line of a group: a sentence, or a heading line with its own lines indented under it. A control's name is marked `**name**`. */
export type AssumptionLine = string | readonly [line: string, sublines: readonly string[]];

interface Props {
  /** each group: its heading and its lines */
  groups: readonly (readonly [heading: string, lines: readonly AssumptionLine[]])[];
  /** the fold's summary line (default: "Assumptions") */
  summary?: string;
  /** the groups side by side as the fold widens (two, then three columns); default: one under another */
  columns?: boolean;
}

/**
 * How a map is modeled, as groups of lines, folded away until opened (the Space page's), or a
 * page's notes grouped by chart (the Speaker page's Details, in columns).
 */
export function AssumptionsList({ groups, summary = "Assumptions", columns = false }: Props) {
  const list = groups.map(([heading, lines]) => (
    <div key={heading}>
      <div className="text-stone-900 mb-0.5">{heading}</div>
      <ul className="list-disc pl-5 flex flex-col gap-1">
        {lines.map((l) =>
          typeof l === "string" ? (
            <li key={l}>
              <MarkedText text={l} />
            </li>
          ) : (
            <li key={l[0]}>
              {l[0]}
              <ul className="list-[circle] pl-5 mt-1 flex flex-col gap-1">
                {l[1].map((sub) => (
                  <li key={sub}>
                    <MarkedText text={sub} />
                  </li>
                ))}
              </ul>
            </li>
          ),
        )}
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
