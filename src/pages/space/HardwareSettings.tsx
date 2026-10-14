import type { SpaceDesign } from "../../types";
import { Card } from "../../components/ui/Card";
import { Tooltip } from "../../components/ui/Tooltip";
import { CardHeading } from "../../components/ui/CardHeading";
import { NumberField } from "../../components/ui/NumberField";
import { StatRowGrid } from "../../components/stats/StatRowGrid";
import { ampPowerGroups } from "../../lib/speaker/spaceHardware";
import { delayText, type AlignmentRow } from "../../lib/speaker/spaceAlignment";
import { formatHz, formatSigned } from "../../lib/format";
import { FILTER_TYPE_NAMES } from "../../constants/speakerPage";
import { NO_DELAY_MS, SPACE_TEXT } from "../../constants/space";
import type { SpacePlanner } from "./useSpace";
import { BLOCK_STACK, HEADING_GROUP, STACK } from "../../styles/layout";

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
  /** the alignment rows by the placement that plays them (a mirrored pair is one), in order */
  const cards = [...new Set(alignment.map((r) => r.placement))].map((placement) => ({
    placement,
    rows: alignment.filter((r) => r.placement === placement),
    title: names[placement] ?? "",
  }));
  return (
    <div className={BLOCK_STACK}>
      <div className={STACK}>
        <div className={HEADING_GROUP}>
          <h4 className="font-semibold">
            <Tooltip tip={SPACE_TEXT.ampPowerTip}>{SPACE_TEXT.ampPower}</Tooltip>
          </h4>
          <p className="text-xs text-stone-500">{SPACE_TEXT.ampPowerHint}</p>
        </div>
        {speakers.map(({ speaker, groups }) => (
          <Card key={speaker.id}>
            <CardHeading>{speaker.name}</CardHeading>
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
      </div>
      <div className={STACK}>
        <div className={HEADING_GROUP}>
          <h4 className="font-semibold">
            <Tooltip tip={SPACE_TEXT.alignmentTip}>{SPACE_TEXT.alignment}</Tooltip>
          </h4>
          <p className="text-xs text-stone-500">{SPACE_TEXT.alignmentHint}</p>
        </div>
        {cards.map(({ placement, rows, title }) => (
          <Card key={placement}>
            <CardHeading className="min-w-0 truncate">{title}</CardHeading>
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
          <p className="text-xs text-stone-500">{SPACE_TEXT.offsetNote}</p>
        )}
        {alignment.some((r) => r.delayMs - r.crossoverDelayMs >= NO_DELAY_MS) && (
          <p className="text-xs text-stone-500">{SPACE_TEXT.placementNote}</p>
        )}
      </div>
    </div>
  );
}
