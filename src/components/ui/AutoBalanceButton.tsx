import { Button } from "./Button";
import { Notice } from "./Notice";
import { Tooltip } from "./Tooltip";
import { ToggleGroup, type ToggleOption } from "./ToggleGroup";
import {
  PA_MUSIC_TILT,
  SUB_CROSSOVER_MAX_HZ,
  type AutoBalance,
} from "../../lib/speaker/autoBalance";
import {
  AUTO_BALANCE_MODE,
  AUTO_BALANCE_MODE_LABEL,
  AUTO_BALANCE_STATUS,
  AUTO_BALANCE_TEXT,
  type AutoBalanceMode,
} from "../../constants/autoBalance";
import { FREQ_AXIS_MAX_HZ, FREQ_AXIS_MIN_HZ } from "../../constants/chartScales";

interface Props<L> {
  /** the balance the design takes now, for the picked option (lib/speaker/autoBalance): whether it can balance, and why not */
  balance: AutoBalance<L>;
  /** sets the balanced Levels, worked out from the design as it is at the click: one edit, as any other */
  onApply: () => void;
  /** the picked option: flat (the default) or the PA music tilt */
  mode: AutoBalanceMode;
  onMode: (mode: AutoBalanceMode) => void;
  /** what the tooltip adds for this page (the Stack page: the member levels) */
  tipExtra?: string;
  className?: string;
}

/** Each option's tooltip. */
const MODE_TIP: Record<AutoBalanceMode, string> = {
  [AUTO_BALANCE_MODE.flat]: AUTO_BALANCE_TEXT.flatTip,
  [AUTO_BALANCE_MODE.paMusic]: AUTO_BALANCE_TEXT.paMusicTip(
    PA_MUSIC_TILT.tilt,
    PA_MUSIC_TILT.hfTilt,
    SUB_CROSSOVER_MAX_HZ,
  ),
};

/** The toggle's options, flat first (the default). */
const MODE_OPTIONS: readonly ToggleOption<AutoBalanceMode>[] = [
  AUTO_BALANCE_MODE.flat,
  AUTO_BALANCE_MODE.paMusic,
].map((m) => [m, AUTO_BALANCE_MODE_LABEL[m], MODE_TIP[m]] as const);

/**
 * The Speaker and Stack pages' "Auto balance": sets the band Levels, flat or with the PA music tilt (the toggle next to
 * it). Off, with a word why, when there is one band or less to balance, or when the model cannot calculate a band (then
 * the Levels stay), or when a crossover is outside the model's frequency range.
 */
export function AutoBalanceButton<L>({
  balance,
  onApply,
  mode,
  onMode,
  tipExtra,
  className = "",
}: Props<L>) {
  const tip = MODE_TIP[mode];
  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="primary"
          disabled={balance.status !== AUTO_BALANCE_STATUS.balanced}
          onClick={onApply}
        >
          {AUTO_BALANCE_TEXT.button}
        </Button>
        <ToggleGroup size="xs" value={mode} onChange={onMode} options={MODE_OPTIONS} />
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
      {balance.status === AUTO_BALANCE_STATUS.outOfRange && (
        <Notice>{AUTO_BALANCE_TEXT.outOfRange(FREQ_AXIS_MIN_HZ, FREQ_AXIS_MAX_HZ)}</Notice>
      )}
    </div>
  );
}
