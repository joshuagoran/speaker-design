import { UI_TEXT } from "../../constants/uiText";
import { DetailsDropdown } from "../ui/DetailsDropdown";

interface Props {
  lines: readonly string[];
  /** more lines after a gap: on the PA page, what Improve and Fully optimize search */
  more?: readonly string[];
}

/** The Details drop-down under an optimizer's goals: what the picked goals keep from your design, one line each. */
export function KeepDetails({ lines, more = [] }: Props) {
  return (
    <div className="mt-2">
      <DetailsDropdown summary={UI_TEXT.details}>
        {lines.length ? (
          lines.map((line) => <div key={line}>{line}</div>)
        ) : (
          <div>Pick a goal to see how far it may move from your design.</div>
        )}
        {more.length > 0 && (
          <div className="mt-1 flex flex-col gap-1.5">
            {more.map((line) => (
              <div key={line}>{line}</div>
            ))}
          </div>
        )}
      </DetailsDropdown>
    </div>
  );
}
