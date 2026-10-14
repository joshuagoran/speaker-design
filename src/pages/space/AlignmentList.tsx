import { delayText, type AlignmentRow } from "../../lib/speaker/spaceAlignment";
import { formatHz, formatSigned } from "../../lib/format";
import { FILTER_TYPE_NAMES } from "../../constants/speakerPage";
import { SPACE_TEXT } from "../../constants/space";
import { RESULT_MAX_WIDTH } from "../../styles/layout";

/** A filter in words: its corner and slope. */
const filterText = (f: NonNullable<AlignmentRow["highpass"]>) =>
  `${formatHz(f.hz)} ${FILTER_TYPE_NAMES[f.type]}`;

/** A row's filters in words: its high-pass and low-pass, or full range. */
const filtersText = (r: Pick<AlignmentRow, "highpass" | "lowpass">) =>
  [
    r.highpass && SPACE_TEXT.highpass(filterText(r.highpass)),
    r.lowpass && SPACE_TEXT.lowpass(filterText(r.lowpass)),
  ]
    .filter(Boolean)
    .join(", ") || SPACE_TEXT.fullRange;

/**
 * One placed speaker's alignment rows, one row per box and band in a single column at every width: the box and band
 * name, and under it the filters, level and delay. A row's text wraps at word boundaries across the whole width; it is
 * never set in a narrow column beside the name (a long speaker or band name would squeeze it to a letter a line).
 */
export function AlignmentList({ rows }: { rows: readonly AlignmentRow[] }) {
  /** a stack's members are numbered; a speaker alone isn't */
  const numbered = rows.some((o) => o.member !== rows[0]?.member);
  return (
    <ul className={`${RESULT_MAX_WIDTH} text-sm`}>
      {rows.map((r) => (
        <li
          key={`${r.member}/${r.box}/${r.bands.map((b) => b.id).join("+")}`}
          className="border-b border-stone-300 py-1"
        >
          <div className="font-medium break-words">
            {numbered ? `${r.member + 1}. ` : ""}
            {r.box}: {r.bands.map((b) => b.name).join(" + ")}
          </div>
          <div className="text-xs text-stone-500 break-words">
            {filtersText(r)} · {SPACE_TEXT.levelIs(formatSigned(r.levelDb))} ·{" "}
            {delayText(r.delayMs)}
          </div>
        </li>
      ))}
    </ul>
  );
}
