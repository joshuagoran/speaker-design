import { DetailsDropdown } from "./DetailsDropdown";

interface Props {
  /** each group: its heading and its lines */
  groups: readonly (readonly [heading: string, lines: readonly string[]])[];
}

/** How a map is modeled, as groups of lines, folded away until opened (the PA Coverage page's and the Space page's). */
export function AssumptionsList({ groups }: Props) {
  return (
    <DetailsDropdown summary="Assumptions">
      {groups.map(([heading, lines]) => (
        <div key={heading}>
          <div className="text-stone-900 mb-0.5">{heading}</div>
          <ul className="list-disc pl-5 flex flex-col gap-1">
            {lines.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </div>
      ))}
    </DetailsDropdown>
  );
}
