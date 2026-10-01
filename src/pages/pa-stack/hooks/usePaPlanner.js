import { useStackViewOptions } from "./useStackViewOptions.js";
import { usePhoneLayout } from "./usePhoneLayout.js";
import { useSavedConfigs } from "./useSavedConfigs.js";
import { usePaOptimizer } from "./usePaOptimizer.jsx";
import { usePaDesign } from "./usePaDesign.js";

/**
 * Everything the PA stack and cutlist pages need, in one flat object. It is created once in App, so the
 * design, optimizer and view state survive switching between pages.
 */
export function usePaPlanner() {
  const viewOptions = useStackViewOptions();
  const phoneLayout = usePhoneLayout();
  const savedConfigs = useSavedConfigs();
  const design = usePaDesign({ dispersionPlane: viewOptions.dispersionPlane });
  const optimizer = usePaOptimizer({ snapshot: design.snapshot, restore: design.restore, db: savedConfigs.db });
  return { ...viewOptions, ...phoneLayout, ...savedConfigs, ...design, ...optimizer };
}
