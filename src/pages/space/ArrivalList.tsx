import { DetailList } from "../../components/ui/DetailList";
import { delayDistanceIn } from "../../lib/speaker/spaceAlignment";
import type { ArrivalStatus, ListenerArrival } from "../../lib/speaker/solveFeeds";
import { formatSigned } from "../../lib/format";
import { ARRIVAL_STATUS, SPACE_TEXT } from "../../constants/space";
import { INCHES_PER_FOOT } from "../../constants/units";

/** Each arrival status's text color: the status colors. */
const STATUS_CLASS = {
  [ARRIVAL_STATUS.onTime]: "text-green-700",
  [ARRIVAL_STATUS.close]: "text-orange-700",
  [ARRIVAL_STATUS.off]: "text-red-700",
} as const satisfies Record<ArrivalStatus, string>;

interface Props {
  arrivals: readonly ListenerArrival[];
  /** each placement's name, in the space's order */
  names: readonly string[];
}

/**
 * Each placement's arrival at the listener against the latest main, in ms and the distance it equals (ft), in its status
 * color: one row a placement, or one a box for a pair whose boxes differ.
 */
export function ArrivalList({ arrivals, names }: Props) {
  return (
    <DetailList
      rows={arrivals.map((a) => ({
        id: `${a.placement}${a.side ?? ""}`,
        title: (
          <span className={`${STATUS_CLASS[a.status]} tabular-nums`}>
            {SPACE_TEXT.arrivalIs(
              `${names[a.placement] ?? ""}${a.side ? ` ${a.side}` : ""}`,
              formatSigned(a.afterMainsMs),
              formatSigned(delayDistanceIn(a.afterMainsMs) / INCHES_PER_FOOT),
            )}
          </span>
        ),
      }))}
    />
  );
}
