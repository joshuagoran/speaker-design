import { DesignOptimizerSettings } from "../../components/optimizer/DesignOptimizerSettings";
import { SPEAKER_GOAL_TEXT } from "../../constants/speakerOptimizer";
import { SPEAKER_OPTIMIZER_TEXT } from "../../constants/speakerOptimizerText";
import type { SpeakerOptimizer } from "./useSpeakerOptimizer";

const T = SPEAKER_OPTIMIZER_TEXT;

interface Props {
  optimizer: SpeakerOptimizer;
}

/** The optimizer fold's one-line summary: the goals, the target, the limits and the locks. */
export function optimizerSummary(
  o: Pick<SpeakerOptimizer, "goals" | "targetDb" | "budget" | "maxLb" | "nLocks">,
): string {
  return [
    o.goals.length
      ? o.goals.map((g) => SPEAKER_GOAL_TEXT[g].short.toLowerCase()).join(", ")
      : T.summaryNoGoal,
    T.summaryTarget(o.targetDb),
    T.summaryBudget(o.budget),
    T.summaryWeight(o.maxLb),
    ...(o.nLocks ? [T.summaryKeeps(o.nLocks)] : []),
  ].join(" · ");
}

/** The Speaker page's Optimizer fold (`DesignOptimizerSettings`): the budget and weight limits. */
export function SpeakerOptimizerSettings({ optimizer: o }: Props) {
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
    />
  );
}
