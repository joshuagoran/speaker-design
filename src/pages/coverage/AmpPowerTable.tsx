import { useMemo } from "react";
import { AMP_POWER_TEXT, PAST_LIMIT_ON_PEAKS } from "../../constants/ampPower";
import { SUB_LIMIT_NAMES } from "../../constants/limits";
import { SectionHeading } from "../../components/ui/SectionHeading";
import { DRIVER_PART_NAMES } from "../../constants/optimizerText";
import { UI_TEXT } from "../../constants/uiText";
import { formatSigned, formatWatts } from "../../lib/format";
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

const th = "py-1 pr-3 font-normal whitespace-nowrap";
const td = "py-1 pr-3 align-top whitespace-nowrap";
/** A peak figure's color: the status red once the peaks pass the limit. */
const tone = (r: Pick<ChannelPower, "pastLimit">) =>
  r.pastLimit ? "text-red-700" : "text-stone-900";

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
    <div>
      <SectionHeading className="mb-1">{AMP_POWER_TEXT.heading}</SectionHeading>
      <div className="overflow-x-auto">
        <table className="text-sm w-full min-w-[740px] table-fixed border-collapse tabular-nums">
          {/* wide enough at the least width that no cell wraps */}
          <colgroup>
            <col className="w-[19%]" />
            <col className="w-[10%]" />
            <col className="w-[10%]" />
            <col className="w-[11%]" />
            <col className="w-[15%]" />
            <col className="w-[35%]" />
          </colgroup>
          <thead>
            <tr className="text-stone-500 text-left border-b border-stone-300">
              <th className={th}>{AMP_POWER_TEXT.driver}</th>
              <th className={`${th} text-right`}>{AMP_POWER_TEXT.avg}</th>
              <th className={`${th} text-right`}>{AMP_POWER_TEXT.peak}</th>
              <th className={`${th} text-right`}>{AMP_POWER_TEXT.maxPeak}</th>
              <th className={`${th} text-right`}>{AMP_POWER_TEXT.headroom}</th>
              <th className={th}>{AMP_POWER_TEXT.limit}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.channel} className="border-b border-stone-300">
                <td className={td}>{CHANNEL_NAMES[r.channel]}</td>
                <td className={`${td} text-right`}>{formatWatts(r.avgW)}</td>
                <td className={`${td} text-right ${tone(r)}`}>{formatWatts(r.peakW)}</td>
                <td className={`${td} text-right`}>{formatWatts(r.maxPeakW)}</td>
                {/* rounded first, so a value just under 0 reads 0.0, never −0.0 */}
                <td className={`${td} text-right ${tone(r)}`}>
                  {formatSigned(Math.round(r.peakHeadroomDb * 10) / 10)} dB
                </td>
                {/* the sub section's "First limit" words, with a capital; the amp's rating where it isn't the limit */}
                <td className={td}>
                  <div className="first-letter:uppercase">
                    {SUB_LIMIT_NAMES[r.who]}
                    {r.who !== "amp" && `, ${AMP_POWER_TEXT.amp} ${formatWatts(r.ampW)}`}
                  </div>
                  {/* always there, hidden while the peaks fit, so the rows keep their height */}
                  <div
                    className={`text-xs text-red-700 ${r.pastLimit ? "" : "invisible"}`}
                    aria-hidden={!r.pastLimit}
                  >
                    {PAST_LIMIT_ON_PEAKS[r.who]}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-stone-500 mt-1">{AMP_POWER_TEXT.crestNote}</p>{" "}
    </div>
  );
}
