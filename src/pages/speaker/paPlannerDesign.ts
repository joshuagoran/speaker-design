import type { PaPlannerDesign } from "../../types";
import type { PaPlanner } from "../pa-stack/hooks/usePaPlanner";

/** The PA design as the planner holds it, every field set. */
export const paPlannerDesign = (planner: PaPlanner): PaPlannerDesign => ({
  ...planner.snapshot(),
  panel: planner.wallPanel,
  hornMount: planner.hornMount,
  spacerH: planner.spacerHeightIn,
  hardware: planner.hardware,
  divider: planner.ductDividerPanel,
});
