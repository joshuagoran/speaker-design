import type { Quantity } from "../../types";
import { Button } from "../ui/Button";
import { LimitField } from "../ui/LimitField";
import { Notice } from "../ui/Notice";
import { NumberField } from "../ui/NumberField";
import { GoalPicker } from "./GoalPicker";
import { RunRow } from "./RunRow";
import { OPTIMIZER_PANEL_TEXT } from "../../constants/optimizerText";
import { LOCK_TEXT } from "../../constants/uiText";
import type { OptimizerProgress, SpeakerGoal } from "../../types";
import { GAP_Y_TIGHT } from "../../styles/layout";

/** The words the fold takes from a page's optimizer text. */
export interface OptimizerFoldText {
  target: string;
  targetUnit: string;
  /** under the goal level while it is louder than your design, by the whole dB between them */
  goalAbove: (db: number) => string;
  noLimit: string;
  limit: string;
  run: string;
  undoLoad: string;
}

/** What the fold reads of a page's optimizer (`useDesignOptimizer`, with the page's locks beside it). */
export interface OptimizerFoldState {
  goals: readonly SpeakerGoal[];
  tapGoal: (goal: SpeakerGoal) => void;
  targetDb: number;
  yoursDb: number | null;
  setTarget: (db: number) => void;
  /** the names of what is locked, in the order of the page, and the button that removes every lock */
  lockedNames: readonly string[];
  clearLocks: () => void;
  isOptimizing: boolean;
  progress: OptimizerProgress | null;
  result: { stats: { evaluated: number; ms: number }; cards: readonly unknown[] } | null;
  canUndo: boolean;
  undoLoad: () => void;
  search: () => void;
  cancel: () => void;
  error: string;
}

/** One limit's field: its words, its start and its step. */
export interface LimitRow {
  key: string;
  label: string;
  /** the number's box */
  field: string;
  value: number | null;
  onChange: (value: number | null) => void;
  /** what the limit starts at when it is turned on */
  startAt: number;
  min: number;
  step: number;
  unit: string;
  /** what the limit measures, when the Units setting changes it (`NumberField`'s) */
  quantity?: Quantity;
}

interface Props {
  optimizer: OptimizerFoldState;
  /** every goal, with its short and long name */
  goalDefs: Record<SpeakerGoal, { short: string; name: string }>;
  text: OptimizerFoldText;
  limits: readonly LimitRow[];
}

/**
 * An optimizer fold: goals in tap order, the goal level at 1 m (with how far it is above your design), the limits, the
 * line of what is locked with Clear locks (the locks are beside the settings), and the Find designs button with its
 * progress and Cancel. The Speaker and Stack pages share it; each gives its goals' words and its limits.
 */
export function DesignOptimizerSettings({ optimizer: o, goalDefs, text: T, limits }: Props) {
  /** how far the goal is above your design's level, in whole dB (0 or less: not above; 0 when it is not modeled) */
  const above = o.yoursDb === null ? 0 : Math.round(o.targetDb - o.yoursDb);
  return (
    <>
      <GoalPicker defs={goalDefs} selected={o.goals} onTap={o.tapGoal} />
      <div className={GAP_Y_TIGHT}>
        <NumberField
          label={T.target}
          value={o.targetDb}
          step={1}
          unit={T.targetUnit}
          onChange={o.setTarget}
        />
        {above > 0 && <p className="text-xs text-stone-500">{T.goalAbove(above)}</p>}
      </div>
      {limits.map((l) => (
        <LimitField
          key={l.key}
          label={l.label}
          value={l.value}
          onChange={l.onChange}
          startAt={l.startAt}
          min={l.min}
          step={l.step}
          unit={l.unit}
          quantity={l.quantity}
          words={{ none: T.noLimit, limit: T.limit, field: l.field }}
        />
      ))}
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="min-w-0 break-words">{LOCK_TEXT.locked(o.lockedNames)}</span>
        <Button size="xs" onClick={o.clearLocks} disabled={!o.lockedNames.length}>
          {LOCK_TEXT.clear}
        </Button>
      </div>
      <RunRow
        busy={o.isOptimizing}
        hasGoal={o.goals.length > 0}
        onRun={() => o.search()}
        runLabel={T.run}
        onCancel={o.cancel}
        progress={o.progress}
        stats={o.result && o.result.stats}
        note={o.result && o.result.cards.length ? OPTIMIZER_PANEL_TEXT.cardsPass : ""}
      >
        {o.canUndo && (
          <Button size="md" onClick={o.undoLoad}>
            {T.undoLoad}
          </Button>
        )}
      </RunRow>
      {o.error && !o.isOptimizing && <Notice>{o.error}</Notice>}
    </>
  );
}
