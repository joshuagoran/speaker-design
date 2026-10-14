import { LockButton } from "../../components/lock/LockButton";
import { DimensionLock } from "../../components/lock/DimensionLock";
import type { KeepGroup } from "../../components/optimizer/KeepList";
import { DesignOptimizerSettings } from "../../components/optimizer/DesignOptimizerSettings";
import { SPEAKER_GOAL_TEXT } from "../../constants/speakerOptimizer";
import { SPEAKER_OPTIMIZER_TEXT } from "../../constants/speakerOptimizerText";
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
 * The Speaker page's Optimizer fold (`DesignOptimizerSettings`): the budget and weight limits, and a lock per part and
 * per box axis in the Keep list.
 */
export function SpeakerOptimizerSettings({ optimizer: o }: Props) {
  const groups: KeepGroup[] = keysOf(T.groups).map((group) => ({
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
  return (
    <DesignOptimizerSettings
      optimizer={o}
      goalDefs={SPEAKER_GOAL_TEXT}
      text={T}
      limits={[
        {
          key: "budget",
          label: T.budget,
          field: T.budgetField,
          value: o.budget,
          onChange: o.setBudget,
          startAt: o.budgetStart,
          min: 0,
          step: 25,
          unit: "$",
        },
        {
          key: "weight",
          label: T.weight,
          field: T.weightField,
          value: o.maxLb,
          onChange: o.setMaxLb,
          startAt: o.weightStart,
          min: 1,
          step: 5,
          unit: "lb",
        },
      ]}
      keep={{ groups, lockBar: o.lockBar }}
    />
  );
}
