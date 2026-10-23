import { useUnitSettings } from "../../hooks/useUnits";
import { delayText, type AlignmentRow } from "../../lib/speaker/spaceAlignment";
import { formatHz, formatSigned } from "../../lib/format";
import { FILTER_TYPE_NAMES } from "../../constants/speakerPage";
import { SPACE_TEXT } from "../../constants/space";
import { DetailList } from "../../components/ui/DetailList";

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
 * One placed speaker's DSP rows, one row per DSP output (`DetailList`): the box and band name, and under it the
 * filters, total Gain and delay; a passive row lists its Pads in the box under that.
 */
export function AlignmentList({ rows }: { rows: readonly AlignmentRow[] }) {
  /** a stack's members are numbered; a speaker alone isn't */
  const numbered = rows.some((o) => o.member !== rows[0]?.member);
  const unitSettings = useUnitSettings();
  return (
    <DetailList
      rows={rows.map((r) => ({
        id: `${r.member}/${r.box}/${r.bands.map((b) => b.id).join("+")}`,
        title: `${numbered ? `${r.member + 1}. ` : ""}${r.box}: ${r.bands.map((b) => b.name).join(" + ")}`,
        detail: (
          <>
            <div>{`${filtersText(r)} · ${SPACE_TEXT.gainIs(formatSigned(r.gainDb))} · ${delayText(r.delayMs, unitSettings)}`}</div>
            {r.pads.length > 0 && (
              <div>
                {SPACE_TEXT.padsAre(
                  r.pads.map((p) => SPACE_TEXT.padIs(p.name, formatSigned(p.padDb))),
                )}
              </div>
            )}
          </>
        ),
      }))}
    />
  );
}
