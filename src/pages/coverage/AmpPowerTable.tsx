import { useMemo } from "react";
import { AMP_POWER_TEXT } from "../../constants/ampPower";
import { SectionHeading } from "../../components/ui/SectionHeading";
import { AmpPowerRows } from "../../components/stats/AmpPowerRows";
import { DRIVER_PART_NAMES } from "../../constants/optimizerText";
import { UI_TEXT } from "../../constants/uiText";
import {
  channelPower,
  headroomDb,
  hornMax,
  midMax,
  subMax,
  type AmpChannel,
  type ChannelPower,
} from "../../lib/pa/ampPower";
import type { BalancedLevels } from "../../types";
import type { CoverageInputs } from "./useCoverageMap";
import { STACK } from "../../styles/layout";

/** Each channel's name in the table. */
const CHANNEL_NAMES: Record<AmpChannel, string> = {
  sub: UI_TEXT.sub,
  mid: UI_TEXT.midBass,
  horn: DRIVER_PART_NAMES.cd,
};

interface Props {
  /** the planner's models and amps */
  planner: Pick<
    CoverageInputs,
    | "subModeled"
    | "subAmpVoltage"
    | "midModeled"
    | "hornModel"
    | "subMidCrossoverHz"
    | "midHornCrossoverHz"
  >;
  /** how far each band is turned down to balance the system, dB */
  pads: BalancedLevels["pads"];
  /** the system's gain to the target, dB (0 at its limit) */
  gain: number;
}

/**
 * Amp power per driver at the target: the model's power at each driver's max, brought down by the headroom to it, and
 * the peaks on club music. A row whose peaks pass its limit (amp, Xmax, rating or port) is flagged.
 */
export function AmpPowerTable({ planner, pads, gain }: Props) {
  const {
    subModeled,
    subAmpVoltage,
    midModeled,
    hornModel,
    subMidCrossoverHz,
    midHornCrossoverHz,
  } = planner;
  const rows = useMemo(() => {
    const out: ChannelPower[] = [];
    if (subModeled)
      out.push(
        channelPower("sub", subMax(subModeled.lim, subAmpVoltage), headroomDb(gain, pads.sub)),
      );
    const mid =
      midModeled &&
      midMax(midModeled.max, midModeled.mdl.curve, midModeled.V, [
        subMidCrossoverHz,
        midHornCrossoverHz,
      ]);
    if (mid) out.push(channelPower("mid", mid, headroomDb(gain, pads.mid)));
    if (hornModel) out.push(channelPower("horn", hornMax(hornModel), headroomDb(gain, pads.horn)));
    return out;
  }, [
    subModeled,
    subAmpVoltage,
    midModeled,
    hornModel,
    subMidCrossoverHz,
    midHornCrossoverHz,
    pads,
    gain,
  ]);
  if (!rows.length) return null;
  return (
    <div className={STACK}>
      <SectionHeading>{AMP_POWER_TEXT.heading}</SectionHeading>
      <AmpPowerRows
        firstColumn={AMP_POWER_TEXT.driver}
        rows={rows.map((r) => ({ key: r.channel, name: CHANNEL_NAMES[r.channel], power: r }))}
      />
      <p className="text-xs text-stone-500">{AMP_POWER_TEXT.crestNote}</p>
    </div>
  );
}
