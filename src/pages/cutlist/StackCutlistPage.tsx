import type { StackPlanner } from "../stack/useStack";
import { stackCutParts, stackPurchasedParts } from "../../lib/speaker/stackBuild";
import { CutlistPage } from "./CutlistPage";
import { useStoredCutlistOptions } from "./useStoredCutlistOptions";
import { CUTLIST_PROJECT } from "../../constants/cutlistProjects";
import { EMPTY_SPEAKER } from "../../lib/defaults";

interface Props {
  stack: Pick<StackPlanner, "design">;
}

/**
 * The Stack Cutlist page: every member's parts, each under its member's box, packed on the same sheets (the PA page's
 * cutlist packs its sub and mid boxes so), with the stack's own cutlist choices. A measured panel thickness applies to
 * every member whose walls are that size; the walls' size and material shown are the first member's.
 */
export function StackCutlistPage({ stack }: Props) {
  const options = useStoredCutlistOptions(CUTLIST_PROJECT.stack);
  const { design } = stack;
  const { parts, also } = stackCutParts(
    design.stack,
    design.speakers,
    options.cornerJoint,
    options.panelExactIn,
  );
  const purchased = stackPurchasedParts(design.stack, design.speakers);
  const first = design.speakers.find((s) => s.id === design.stack.members[0]?.speakerId);
  const panel = first?.cabinet.panel ?? EMPTY_SPEAKER.cabinet.panel;
  return (
    <CutlistPage
      project={CUTLIST_PROJECT.stack}
      options={options}
      parts={parts}
      also={also}
      purchased={purchased}
      csvName={`${design.stack.name || "stack"} cutlist.csv`}
      wall={options.panelExactIn[panel.nominal] ?? panel.thicknessIn}
      panel={panel.nominal}
      material={panel.material}
    />
  );
}
