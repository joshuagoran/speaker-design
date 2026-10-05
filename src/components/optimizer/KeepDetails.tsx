import { UI_TEXT } from "../../constants/uiText";
import { DetailsDropdown } from "../ui/DetailsDropdown";

/** The Details drop-down under an optimizer's goals: what the picked goals keep from your design, one line each. */
export function KeepDetails({ lines }: { lines: readonly string[] }) {
  return (
    <div className="mt-2">
      <DetailsDropdown summary={UI_TEXT.details}>
        {lines.length ? (
          lines.map((line) => <div key={line}>{line}</div>)
        ) : (
          <div>Pick a goal to see how far it may move from your design.</div>
        )}
      </DetailsDropdown>
    </div>
  );
}
