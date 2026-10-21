import { Button } from "./Button";
import { Notice } from "./Notice";
import { Tooltip } from "./Tooltip";
import { MarkedText } from "./MarkedText";
import type { AutoBalance } from "../../lib/speaker/autoBalance";
import { AUTO_BALANCE_STATUS, AUTO_BALANCE_TEXT } from "../../constants/autoBalance";
import { FREQ_AXIS_MAX_HZ, FREQ_AXIS_MIN_HZ } from "../../constants/chartScales";
import { GAP_Y_TIGHT } from "../../styles/layout";

interface Props<L> {
  /** the balance the design takes now (lib/speaker/autoBalance): whether it can balance, and why not */
  balance: AutoBalance<L>;
  /** sets the balanced levels, worked out from the design as it is at the click: one edit, as any other */
  onApply: () => void;
  /** the button's tooltip: what it sets on this page */
  tip: string;
  /** what the page says when there are fewer than two bands (or boxes) to balance */
  oneBand: string;
}

/**
 * The Speaker and Stack pages' "Calculate gains" button. It is off, with a word why, when there is one band (or box) or
 * less to balance, when the model cannot calculate a band (then the levels stay), or when a crossover is outside the
 * model's frequency range.
 */
export function CalculateGainsButton<L>({ balance, onApply, tip, oneBand }: Props<L>) {
  return (
    <div className={GAP_Y_TIGHT}>
      <div>
        <Tooltip control tip={<MarkedText text={tip} />}>
          <Button
            variant="primary"
            disabled={balance.status !== AUTO_BALANCE_STATUS.balanced}
            onClick={onApply}
          >
            {AUTO_BALANCE_TEXT.button}
          </Button>
        </Tooltip>
      </div>
      {balance.status === AUTO_BALANCE_STATUS.oneBand && (
        <p className="text-xs text-stone-500">
          <MarkedText text={oneBand} />
        </p>
      )}
      {balance.status === AUTO_BALANCE_STATUS.unmodeled && (
        <Notice>
          <MarkedText text={AUTO_BALANCE_TEXT.unmodeled(balance.names)} />
        </Notice>
      )}
      {balance.status === AUTO_BALANCE_STATUS.outOfRange && (
        <Notice>
          <MarkedText text={AUTO_BALANCE_TEXT.outOfRange(FREQ_AXIS_MIN_HZ, FREQ_AXIS_MAX_HZ)} />
        </Notice>
      )}
    </div>
  );
}
