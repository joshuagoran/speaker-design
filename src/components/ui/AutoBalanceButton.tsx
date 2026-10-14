import { Button } from "./Button";
import { Notice } from "./Notice";
import { Tooltip } from "./Tooltip";
import { ToggleGroup, type ToggleOption } from "./ToggleGroup";
import { BAND_BALANCE_TIP, type AutoBalance } from "../../lib/speaker/autoBalance";
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
  /** the picked option: flat (the default) or More bass */
  mode: AutoBalanceMode;
  onMode: (mode: AutoBalanceMode) => void;
  /** what the tooltip adds for this page (the Stack page: the member levels) */
  tipExtra?: string;
  /** what the page adds when the button is on (the Stack page: a speaker that members share with different crossovers) */
  notes?: readonly string[];
  className?: string;
}

/** The toggle's options, flat first (the default). */
const MODE_OPTIONS: readonly ToggleOption<AutoBalanceMode>[] = [
  AUTO_BALANCE_MODE.flat,
  AUTO_BALANCE_MODE.moreBass,
].map((m) => [m, AUTO_BALANCE_MODE_LABEL[m]] as const);

/**
 * The Speaker and Stack pages' band balance: the "Band balance" toggle (flat, or More bass) and the "Auto balance"
 * button under it. With More bass, a line under the button gives each band's level, from the lowest band. The button is
 * off, with a word why, when there is one band or less to balance, or when the model cannot calculate a band (then
 * the Levels stay), or when a crossover is outside the model's frequency range.
 */
export function AutoBalanceButton<L>({
  balance,
  onApply,
  mode,
  onMode,
  tipExtra,
  notes = [],
  className = "",
}: Props<L>) {
  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-2">
        <span className="text-sm font-label text-stone-500">
          <Tooltip tip={tipExtra ? `${BAND_BALANCE_TIP} ${tipExtra}` : BAND_BALANCE_TIP}>
            {AUTO_BALANCE_TEXT.label}
          </Tooltip>
        </span>
        <ToggleGroup size="xs" value={mode} onChange={onMode} options={MODE_OPTIONS} />
      </div>
      <Button
        variant="primary"
        disabled={balance.status !== AUTO_BALANCE_STATUS.balanced}
        onClick={onApply}
      >
        {AUTO_BALANCE_TEXT.button}
      </Button>
      {balance.status === AUTO_BALANCE_STATUS.balanced && mode === AUTO_BALANCE_MODE.moreBass && (
        <p className="text-xs text-stone-500 mt-1">{AUTO_BALANCE_TEXT.levels(balance.bands)}</p>
      )}
      {balance.status === AUTO_BALANCE_STATUS.balanced &&
        notes.map((note) => <Notice key={note}>{note}</Notice>)}
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
