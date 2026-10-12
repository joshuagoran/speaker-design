import { Button } from "./Button";
import { Notice } from "./Notice";
import { Tooltip } from "./Tooltip";
import {
  DEFAULT_MUSIC_TILT,
  SUB_CROSSOVER_MAX_HZ,
  type AutoBalance,
} from "../../lib/speaker/autoBalance";
import { AUTO_BALANCE_STATUS, AUTO_BALANCE_TEXT } from "../../constants/autoBalance";

interface Props<L> {
  /** the balance the design takes now (lib/speaker/autoBalance) */
  balance: AutoBalance<L>;
  /** sets the balanced Levels: one edit, as any other */
  onApply: (levels: L) => void;
  /** what the tooltip adds for this page (the Stack page: the member levels) */
  tipExtra?: string;
  className?: string;
}

/**
 * The Speaker and Stack pages' "Auto balance": sets the band Levels for music. Off, with a word why, when there is one
 * band or less to balance, or when the model cannot calculate a band (then the Levels stay).
 */
export function AutoBalanceButton<L>({ balance, onApply, tipExtra, className = "" }: Props<L>) {
  const tip = AUTO_BALANCE_TEXT.tip(
    DEFAULT_MUSIC_TILT.tilt,
    DEFAULT_MUSIC_TILT.hfTilt,
    SUB_CROSSOVER_MAX_HZ,
  );
  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="primary"
          disabled={balance.status !== AUTO_BALANCE_STATUS.balanced}
          onClick={() => {
            if (balance.status === AUTO_BALANCE_STATUS.balanced) onApply(balance.levels);
          }}
        >
          {AUTO_BALANCE_TEXT.button}
        </Button>
        <Tooltip tip={tipExtra ? `${tip} ${tipExtra}` : tip} className="text-xs text-stone-500">
          {AUTO_BALANCE_TEXT.what}
        </Tooltip>
      </div>
      {balance.status === AUTO_BALANCE_STATUS.oneBand && (
        <p className="text-xs text-stone-500 mt-1">{AUTO_BALANCE_TEXT.oneBand}</p>
      )}
      {balance.status === AUTO_BALANCE_STATUS.unmodeled && (
        <Notice>{AUTO_BALANCE_TEXT.unmodeled(balance.names)}</Notice>
      )}
    </div>
  );
}
