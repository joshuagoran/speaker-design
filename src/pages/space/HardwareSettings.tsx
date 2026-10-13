import type { SpaceDesign } from "../../types";
import { Card } from "../../components/ui/Card";
import { CardHeading } from "../../components/ui/CardHeading";
import { NumberField } from "../../components/ui/NumberField";
import { StatRowGrid } from "../../components/stats/StatRowGrid";
import { ampPowerGroups } from "../../lib/speaker/spaceHardware";
import { delayText, type AlignmentRow } from "../../lib/speaker/spaceAlignment";
import { formatHz, formatSigned } from "../../lib/format";
import { FILTER_TYPE_NAMES } from "../../constants/speakerPage";
import { NO_DELAY_MS, SPACE_TEXT } from "../../constants/space";
import type { SpacePlanner } from "./useSpace";

/** The new amp power's smallest step, W. */
const AMP_POWER_STEP_W = 50;

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

interface Props {
  design: SpaceDesign;
  /** the alignment list's rows (`spaceAlignment`) */
  alignment: readonly AlignmentRow[];
  /** each placement's name, in the space's order */
  names: readonly string[];
  space: Pick<SpacePlanner, "setAmpPower">;
}

/**
 * The amp power of each band of each placed speaker, which the model uses; and what the space asks of each box and band
 * ahead of its amp: its filters, level and delay, to set wherever the user processes the signal.
 */
export function HardwareSettings({ design, alignment, names, space }: Props) {
  const speakers = ampPowerGroups(design);
  /** the alignment rows by the placements that play them (a mirror pair once), in order */
  const cards = [...new Set(alignment.map((r) => r.placements.join()))].map((key) => {
    const rows = alignment.filter((r) => r.placements.join() === key);
    return { key, rows, title: SPACE_TEXT.pairName(rows[0].placements.map((k) => names[k])) };
  });
  return (
    <>
      <h4 className="font-semibold mb-1">{SPACE_TEXT.ampPower}</h4>
      <p className="text-xs text-stone-500 mb-2">{SPACE_TEXT.ampPowerHint}</p>
      {speakers.map(({ speaker, groups }) => (
        <Card key={speaker.id} className="mb-3">
          <CardHeading className="mb-2">{speaker.name}</CardHeading>
          {groups.map(({ bands, watts }) => (
            <NumberField
              key={bands.join()}
              label={SPACE_TEXT.ampPowerFor(
                bands.map((id) => speaker.bands.find((b) => b.id === id)?.name ?? id).join(" + "),
              )}
              value={watts}
              min={1}
              step={AMP_POWER_STEP_W}
              unit="W"
              onChange={(w) => space.setAmpPower(speaker.id, bands, w)}
            />
          ))}
        </Card>
      ))}
      <h4 className="font-semibold mt-2 mb-1">{SPACE_TEXT.alignment}</h4>
      <p className="text-xs text-stone-500 mb-2">{SPACE_TEXT.alignmentHint}</p>
      {cards.map(({ key, rows, title }) => (
        <Card key={key} className="mb-3">
          <CardHeading className="mb-2 min-w-0 truncate">{title}</CardHeading>
          <StatRowGrid
            rows={rows.map((r) => [
              `${rows.some((o) => o.member !== r.member) ? `${r.member + 1}. ` : ""}${r.box}: ${r.bands
                .map((b) => b.name)
                .join(" + ")}`,
              filtersText(r),
              `${SPACE_TEXT.levelIs(formatSigned(r.levelDb))} · ${delayText(r.delayMs)}`,
            ])}
          />
        </Card>
      ))}
      {alignment.some((r) => r.crossoverDelayMs >= NO_DELAY_MS) && (
        <p className="text-xs text-stone-500 mb-3">{SPACE_TEXT.offsetNote}</p>
      )}
      {alignment.some((r) => r.delayMs - r.crossoverDelayMs >= NO_DELAY_MS) && (
        <p className="text-xs text-stone-500 mb-3">{SPACE_TEXT.placementNote}</p>
      )}
    </>
  );
}
