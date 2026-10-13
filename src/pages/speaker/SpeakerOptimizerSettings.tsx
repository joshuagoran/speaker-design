import { Button } from "../../components/ui/Button";
import { LimitField } from "../../components/ui/LimitField";
import { Notice } from "../../components/ui/Notice";
import { NumberField } from "../../components/ui/NumberField";
import { SettingsFold } from "../../components/ui/SettingsFold";
import { LockButton } from "../../components/lock/LockButton";
import { DimensionLock } from "../../components/lock/DimensionLock";
import { GoalPicker } from "../../components/optimizer/GoalPicker";
import { KeepDetails } from "../../components/optimizer/KeepDetails";
import { KeepList, type KeepGroup } from "../../components/optimizer/KeepList";
import { LockBarButtons } from "../../components/optimizer/LockBarButtons";
import { RunRow } from "../../components/optimizer/RunRow";
import {
  SPEAKER_KEEP_WORDS,
  SPEAKER_GOAL_KEEPS,
  keepLinesFrom,
} from "../../lib/optimizer/goalKeeps";
import { SPEAKER_GOAL_TEXT, SPEAKER_OPTIMIZER_TEXT } from "../../constants/speakerOptimizer";
import { OPTIMIZER_PANEL_TEXT } from "../../constants/optimizerText";
import { keysOf } from "../../lib/records";
import { SIZE_AXES } from "./speakerKeeps";
import type { SpeakerOptimizer } from "./useSpeakerOptimizer";

const T = SPEAKER_OPTIMIZER_TEXT;

interface Props {
  optimizer: SpeakerOptimizer;
}

/** The optimizer fold's one-line summary: the goals, the target, the limits and the locks. */
export function optimizerSummary(
  o: Pick<SpeakerOptimizer, "goals" | "targetDb" | "budget" | "maxLb" | "lockBar">,
): string {
  return [
    o.goals.length
      ? o.goals.map((g) => SPEAKER_GOAL_TEXT[g].short.toLowerCase()).join(", ")
      : T.summaryNoGoal,
    T.summaryTarget(o.targetDb),
    T.summaryBudget(o.budget),
    T.summaryWeight(o.maxLb),
    ...(o.lockBar.nLocks ? [T.summaryKeeps(o.lockBar.nLocks)] : []),
  ].join(" · ");
}

/**
 * The Speaker page's Optimizer fold: goals in tap order, the target level at 1 m, the budget and weight limits, the
 * Keep list (a lock per part and per box axis), and Find designs with its progress and Cancel.
 */
export function SpeakerOptimizerSettings({ optimizer: o }: Props) {
  const keep: KeepGroup[] = keysOf(T.groups).map((group) => ({
    title: T.groups[group],
    rows:
      group === "size"
        ? SIZE_AXES.map((axis) => ({
            key: axis,
            label: T.axis[axis],
            control: (
              <DimensionLock
                mode={o.sizeLock(axis)}
                what={T.axis[axis]}
                onChange={(mode) => o.setSizeLock(axis, mode)}
              />
            ),
          }))
        : o.items
            .filter((item) => item.group === group)
            .map((item) => ({
              key: `${item.kind}:${item.ref}`,
              label: item.label,
              control: (
                <LockButton
                  on={o.isKept(item)}
                  what={item.label}
                  onClick={() => o.toggleKeep(item)}
                />
              ),
            })),
  }));
  const modeled = o.yoursDb !== null;
  return (
    <>
      <GoalPicker defs={SPEAKER_GOAL_TEXT} selected={o.goals} onTap={o.tapGoal} />
      <KeepDetails
        lines={keepLinesFrom(
          SPEAKER_GOAL_KEEPS,
          o.goals,
          SPEAKER_GOAL_TEXT,
          SPEAKER_KEEP_WORDS,
          modeled,
        )}
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
      <LimitField
        label={T.budget}
        value={o.budget}
        onChange={o.setBudget}
        startAt={o.budgetStart}
        min={0}
        step={25}
        unit="$"
        words={{ none: T.noLimit, limit: T.limit, field: T.budgetField }}
      />
      <LimitField
        label={T.weight}
        value={o.maxLb}
        onChange={o.setMaxLb}
        startAt={o.weightStart}
        min={1}
        step={5}
        unit="lb"
        words={{ none: T.noLimit, limit: T.limit, field: T.weightField }}
      />
      <SettingsFold
        title={T.keep}
        summary={o.lockBar.nLocks ? T.summaryKeeps(o.lockBar.nLocks) : undefined}
      >
        <p className="text-xs text-stone-500 mb-2">{T.keepHint}</p>
        <div className="flex items-center gap-2 mb-3">
          <LockBarButtons {...o.lockBar} />
        </div>
        <KeepList groups={keep} />
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
