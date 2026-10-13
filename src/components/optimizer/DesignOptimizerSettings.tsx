import { Button } from "../ui/Button";
import { LimitField } from "../ui/LimitField";
import { Notice } from "../ui/Notice";
import { NumberField } from "../ui/NumberField";
import { SettingsFold } from "../ui/SettingsFold";
import { GoalPicker } from "./GoalPicker";
import { KeepDetails } from "./KeepDetails";
import { KeepList, type KeepGroup } from "./KeepList";
import { LockBarButtons } from "./LockBarButtons";
import { RunRow } from "./RunRow";
import {
  keepLinesFrom,
  SPEAKER_GOAL_KEEPS,
  SPEAKER_KEEP_WORDS,
} from "../../lib/optimizer/goalKeeps";
import { OPTIMIZER_PANEL_TEXT } from "../../constants/optimizerText";
import type { OptimizerProgress, SpeakerGoal } from "../../types";

/** The words the fold takes from a page's optimizer text. */
export interface OptimizerFoldText {
  target: string;
  targetUnit: string;
  /** says what your design plays, in whole dB */
  targetYours: (db: string) => string;
  targetUseYours: string;
  noLimit: string;
  limit: string;
  keep: string;
  keepHint: string;
  run: string;
  undoLoad: string;
  summaryKeeps: (n: number) => string;
}

/** What the fold reads of a page's optimizer (`useDesignOptimizer`, with the page's locks beside it). */
export interface OptimizerFoldState {
  goals: readonly SpeakerGoal[];
  tapGoal: (goal: SpeakerGoal) => void;
  targetDb: number;
  targetIsYours: boolean;
  yoursDb: number | null;
  setTarget: (db: number) => void;
  useYoursForTarget: () => void;
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
}

interface Props {
  optimizer: OptimizerFoldState;
  /** every goal, with its short and long name */
  goalDefs: Record<SpeakerGoal, { short: string; name: string }>;
  text: OptimizerFoldText;
  limits: readonly LimitRow[];
  /** the Keep list: its groups, and the lock buttons' count and actions */
  keep: {
    groups: readonly KeepGroup[];
    lockBar: Parameters<typeof LockBarButtons>[0];
  };
}

/**
 * An optimizer fold: goals in tap order, the target level at 1 m with "Use yours", the limits, the Keep list (a lock
 * per part), and the Find designs button with its progress and Cancel. The Speaker and Stack pages share it; each gives
 * its goals' words, its limits and its Keep groups.
 */
export function DesignOptimizerSettings({ optimizer: o, goalDefs, text: T, limits, keep }: Props) {
  const modeled = o.yoursDb !== null;
  return (
    <>
      <GoalPicker defs={goalDefs} selected={o.goals} onTap={o.tapGoal} />
      <KeepDetails
        lines={keepLinesFrom(SPEAKER_GOAL_KEEPS, o.goals, goalDefs, SPEAKER_KEEP_WORDS, modeled)}
      />
      <NumberField
        label={T.target}
        value={o.targetDb}
        step={1}
        unit={T.targetUnit}
        onChange={o.setTarget}
        className="mt-3 mb-1"
      />
      {modeled && (
        <div className="flex flex-wrap items-center gap-2 mb-4 text-xs text-stone-500">
          {T.targetYours(Math.round(o.yoursDb ?? 0).toString())}
          {!o.targetIsYours && (
            <Button size="xs" onClick={o.useYoursForTarget}>
              {T.targetUseYours}
            </Button>
          )}
        </div>
      )}
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
          words={{ none: T.noLimit, limit: T.limit, field: l.field }}
        />
      ))}
      <SettingsFold
        title={T.keep}
        summary={keep.lockBar.nLocks ? T.summaryKeeps(keep.lockBar.nLocks) : undefined}
      >
        <p className="text-xs text-stone-500 mb-2">{T.keepHint}</p>
        <div className="flex items-center gap-2 mb-3">
          <LockBarButtons {...keep.lockBar} />
        </div>
        <KeepList groups={keep.groups} />
      </SettingsFold>
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
