import { LockButton } from "../../components/lock/LockButton";
import { DimensionLock } from "../../components/lock/DimensionLock";
import type { KeepGroup, KeepRow } from "../../components/optimizer/KeepList";
import { DesignOptimizerSettings } from "../../components/optimizer/DesignOptimizerSettings";
import { STACK_GOAL_TEXT, STACK_OPTIMIZER_TEXT } from "../../constants/stackOptimizer";
import { SIZE_AXES } from "../speaker/speakerKeeps";
import { MEMBER_LOCKS } from "./stackKeeps";
import type { StackOptimizer } from "./useStackOptimizer";

const T = STACK_OPTIMIZER_TEXT;

interface Props {
  optimizer: StackOptimizer;
  /** each member's name, numbered, in the stack's order */
  names: readonly string[];
}

/** The optimizer fold's one-line summary: the goals, the target, the limits and the locks. */
export function stackOptimizerSummary(
  o: Pick<StackOptimizer, "goals" | "targetDb" | "budget" | "maxLb" | "maxHeightIn" | "lockBar">,
): string {
  return [
    o.goals.length
      ? o.goals.map((g) => STACK_GOAL_TEXT[g].short.toLowerCase()).join(", ")
      : T.summaryNoGoal,
    T.summaryTarget(o.targetDb),
    T.summaryBudget(o.budget),
    T.summaryWeight(o.maxLb),
    T.summaryHeight(o.maxHeightIn),
    ...(o.lockBar.nLocks ? [T.summaryKeeps(o.lockBar.nLocks)] : []),
  ].join(" · ");
}

/**
 * The Stack page's Optimizer fold (`DesignOptimizerSettings`): the budget, weight and height limits, and the Keep list:
 * for each speaker a lock on the whole speaker, one on each of its parts and one per box axis, then for each member a
 * lock on its crossover, level and delay.
 */
export function StackOptimizerSettings({ optimizer: o, names }: Props) {
  const speakers: KeepGroup[] = o.keeps.map(({ speaker, items }) => ({
    title: speaker.name,
    rows: [
      {
        key: "keep",
        label: T.keepWhole,
        control: (
          <LockButton
            on={o.isSpeakerKept(speaker.id)}
            what={`${speaker.name}, whole`}
            onClick={() => o.toggleSpeakerKept(speaker.id)}
          />
        ),
      },
      ...items.map((item): KeepRow => ({
        key: `${item.kind}:${item.ref}`,
        label: item.label,
        control: (
          <LockButton
            on={o.isKept(speaker.id, item)}
            what={`${speaker.name}, ${item.label}`}
            onClick={() => o.toggleKeep(speaker.id, item)}
          />
        ),
      })),
      ...SIZE_AXES.map((axis): KeepRow => ({
        key: axis,
        label: T.boxAxis[axis],
        control: (
          <DimensionLock
            mode={o.sizeLock(speaker.id, axis)}
            what={`${speaker.name}, ${T.boxAxis[axis]}`}
            onChange={(mode) => o.setSizeLock(speaker.id, axis, mode)}
          />
        ),
      })),
    ],
  }));
  const members: KeepGroup = {
    title: T.members,
    tip: T.membersTip,
    rows: names.flatMap((name, k) =>
      MEMBER_LOCKS.map((kind): KeepRow => ({
        key: `${kind}:${k}`,
        label: `${name} ${T.memberLock[kind]}`,
        control: (
          <LockButton
            on={o.isMemberKept(kind, k)}
            what={`${name} ${T.memberLock[kind]}`}
            onClick={() => o.toggleMemberKept(kind, k)}
          />
        ),
      })),
    ),
  };
  return (
    <DesignOptimizerSettings
      optimizer={o}
      goalDefs={STACK_GOAL_TEXT}
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
        {
          key: "height",
          label: T.height,
          field: T.heightField,
          value: o.maxHeightIn,
          onChange: o.setMaxHeightIn,
          startAt: o.heightStart,
          min: 1,
          step: 1,
          unit: "in",
        },
      ]}
      keep={{ groups: [...speakers, members], lockBar: o.lockBar }}
    />
  );
}
