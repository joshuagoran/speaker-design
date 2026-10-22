import { DesignOptimizerSettings } from "../../components/optimizer/DesignOptimizerSettings";
import { STACK_GOAL_TEXT, STACK_OPTIMIZER_TEXT } from "../../constants/stackOptimizer";
import type { StackOptimizer } from "./useStackOptimizer";

const T = STACK_OPTIMIZER_TEXT;

interface Props {
  optimizer: StackOptimizer;
}

/** The optimizer fold's one-line summary: the goals, the target, the limits and the locks. */
export function stackOptimizerSummary(
  o: Pick<StackOptimizer, "goals" | "targetDb" | "budget" | "maxLb" | "maxHeightIn" | "nLocks">,
): string {
  return [
    o.goals.length
      ? o.goals.map((g) => STACK_GOAL_TEXT[g].short.toLowerCase()).join(", ")
      : T.summaryNoGoal,
    T.summaryTarget(o.targetDb),
    T.summaryBudget(o.budget),
    T.summaryWeight(o.maxLb),
    T.summaryHeight(o.maxHeightIn),
    ...(o.nLocks ? [T.summaryKeeps(o.nLocks)] : []),
  ].join(" · ");
}

/** The Stack page's Optimizer fold (`DesignOptimizerSettings`): the budget, weight and height limits. */
export function StackOptimizerSettings({ optimizer: o }: Props) {
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
    />
  );
}
