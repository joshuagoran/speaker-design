import { AMP_POWER_TEXT, PAST_LIMIT_ON_PEAKS } from "../../constants/ampPower";
import { DRIVER_LIMIT_NAMES } from "../../constants/limits";
import { formatSigned, formatWatts } from "../../lib/format";
import type { ChannelPower } from "../../lib/pa/ampPower";

/** One row of the table: its key, its name in the first column, and the channel's power at the target. */
export interface AmpPowerRow {
  key: string;
  name: string;
  power: ChannelPower<string>;
}

interface Props {
  rows: readonly AmpPowerRow[];
  /** the first column's head */
  firstColumn: string;
}

const th = "py-1 pr-3 font-normal whitespace-nowrap";
const td = "py-1 pr-3 align-top whitespace-nowrap";
/** A peak figure's color: the status red once the peaks pass the limit. */
const tone = (r: Pick<ChannelPower, "pastLimit">) =>
  r.pastLimit ? "text-red-700" : "text-stone-900";

/**
 * The amp power table (the PA Coverage page's and the Space page's): each channel's average and peak power at the
 * target, the power at its first limit, the amp's rating, the peak headroom and the limit. A row whose peaks pass its
 * limit is flagged.
 */
export function AmpPowerRows({ rows, firstColumn }: Props) {
  return (
    <div className="overflow-x-auto">
      <table className="text-sm w-full min-w-[760px] table-fixed border-collapse tabular-nums">
        {/* wide enough at the least width that no cell wraps */}
        <colgroup>
          <col className="w-[19%]" />
          <col className="w-[10%]" />
          <col className="w-[10%]" />
          <col className="w-[11%]" />
          <col className="w-[11%]" />
          <col className="w-[14%]" />
          <col className="w-[25%]" />
        </colgroup>
        <thead>
          <tr className="text-stone-500 text-left border-b border-stone-300">
            <th className={th}>{firstColumn}</th>
            <th className={`${th} text-right`}>{AMP_POWER_TEXT.avg}</th>
            <th className={`${th} text-right`}>{AMP_POWER_TEXT.peak}</th>
            <th className={`${th} text-right`}>{AMP_POWER_TEXT.maxPeak}</th>
            <th className={`${th} text-right`}>{AMP_POWER_TEXT.amp}</th>
            <th className={`${th} text-right`}>{AMP_POWER_TEXT.headroom}</th>
            <th className={th}>{AMP_POWER_TEXT.limit}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ key, name, power: r }) => (
            <tr key={key} className="border-b border-stone-300">
              <td className={`${td} truncate`}>{name}</td>
              <td className={`${td} text-right`}>{formatWatts(r.avgW)}</td>
              <td className={`${td} text-right ${tone(r)}`}>{formatWatts(r.peakW)}</td>
              <td className={`${td} text-right`}>{formatWatts(r.maxPeakW)}</td>
              {/* a CD's is into its own impedance (`HornResponse.pAmp`) */}
              <td className={`${td} text-right`}>{formatWatts(r.ampW)}</td>
              {/* rounded first, so a value just under 0 reads 0.0, never −0.0 */}
              <td className={`${td} text-right ${tone(r)}`}>
                {formatSigned(Math.round(r.peakHeadroomDb * 10) / 10)} dB
              </td>
              {/* the sub section's "First limit" words, with a capital */}
              <td className={td}>
                <div className="first-letter:uppercase">{DRIVER_LIMIT_NAMES[r.who]}</div>
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
  );
}
