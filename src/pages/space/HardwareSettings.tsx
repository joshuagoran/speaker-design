import type { SpaceDesign } from "../../types";
import { Card } from "../../components/ui/Card";
import { Tooltip } from "../../components/ui/Tooltip";
import { CardHeading } from "../../components/ui/CardHeading";
import { NumberField } from "../../components/ui/NumberField";
import { ampPowerGroups } from "../../lib/speaker/spaceHardware";
import type { AlignmentRow } from "../../lib/speaker/spaceAlignment";
import { NO_DELAY_MS, SPACE_TEXT } from "../../constants/space";
import type { SpacePlanner } from "./useSpace";
import { AlignmentList } from "./AlignmentList";
import { BLOCK_GAP_Y, HEADING_GROUP, GAP_Y } from "../../styles/layout";

/** The new amp power's smallest step, W. */
const AMP_POWER_STEP_W = 50;

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
    <div className={BLOCK_GAP_Y}>
      <div className={GAP_Y}>
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
      <div className={GAP_Y}>
        <div className={HEADING_GROUP}>
          <h4 className="font-semibold">
            <Tooltip tip={SPACE_TEXT.alignmentTip}>{SPACE_TEXT.alignment}</Tooltip>
          </h4>
          <p className="text-xs text-stone-500">{SPACE_TEXT.alignmentHint}</p>
        </div>
        {cards.map(({ placement, rows, title }) => (
          <Card key={placement}>
            <CardHeading className="min-w-0 truncate">{title}</CardHeading>
            <AlignmentList rows={rows} />
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
