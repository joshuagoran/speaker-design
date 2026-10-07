import { useMemo } from "react";
import { AMP_POWER_TEXT } from "../../constants/ampPower";
import { AMP_LIMIT_NAMES } from "../../constants/limits";
import { DRIVER_PART_NAMES } from "../../constants/optimizerText";
import { UI_TEXT } from "../../constants/uiText";
import { formatWatts } from "../../lib/format";
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

const th = "py-1 pr-3 font-normal";
const td = "py-1 pr-3 align-top";

/**
 * Amp power per driver at the target: the model's power at each driver's max, brought down by the headroom to it, and
 * the peaks on club music. A row whose peaks ask for more than its amp has is flagged.
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
  const notAmp = rows.filter((r) => r.who !== "amp").map((r) => CHANNEL_NAMES[r.channel]);
  return (
    <div>
      <div className="overflow-x-auto">
        <table className="text-sm w-full min-w-[620px] table-fixed border-collapse tabular-nums">
          <caption className="text-left text-stone-900 font-medium pb-1">
            {AMP_POWER_TEXT.heading}
          </caption>
          <colgroup>
            <col className="w-[18%]" />
            <col className="w-[13%]" />
            <col className="w-[15%]" />
            <col className="w-[22%]" />
            <col className="w-[12%]" />
            <col className="w-[20%]" />
          </colgroup>
          <thead>
            <tr className="text-stone-500 text-left border-b border-stone-300">
              <th className={th}>{AMP_POWER_TEXT.driver}</th>
              <th className={`${th} text-right`}>{AMP_POWER_TEXT.avg}</th>
              <th className={`${th} text-right`}>{AMP_POWER_TEXT.peak}</th>
              <th className={th}>{AMP_POWER_TEXT.amp}</th>
              <th className={`${th} text-right`}>{AMP_POWER_TEXT.headroom}</th>
              <th className={th}>{AMP_POWER_TEXT.limit}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.channel} className="border-b border-stone-300">
                <td className={td}>{CHANNEL_NAMES[r.channel]}</td>
                <td className={`${td} text-right`}>{formatWatts(r.avgW)}</td>
                <td className={`${td} text-right`}>
                  <div className={r.clips ? "text-red-700" : "text-stone-900"}>
                    {formatWatts(r.peakW)}
                  </div>
                  {/* always there, hidden when the peaks fit, so the rows keep their height */}
                  <div
                    className={`text-xs text-red-700 ${r.clips ? "" : "invisible"}`}
                    aria-hidden={!r.clips}
                  >
                    {AMP_POWER_TEXT.clips}
                  </div>
                </td>
                <td className={`${td} text-stone-500`}>
                  {formatWatts(r.avgW)} avg / {formatWatts(r.peakW)} peak of {formatWatts(r.ampW)}
                </td>
                <td className={`${td} text-right`}>{r.headroomDb.toFixed(1)} dB</td>
                <td className={td}>{AMP_LIMIT_NAMES[r.who]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-stone-500 mt-1">{AMP_POWER_TEXT.crestNote}</p>
      <p className="text-xs text-stone-500">
        {notAmp.length ? `${AMP_POWER_TEXT.notAmp} ${notAmp.join(", ")}.` : AMP_POWER_TEXT.allAmp}
      </p>
    </div>
  );
}
