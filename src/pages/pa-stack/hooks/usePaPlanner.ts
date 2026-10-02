import { useStackViewOptions } from "./useStackViewOptions.ts";
import { usePhoneLayout } from "./usePhoneLayout.ts";
import { useSavedConfigs } from "./useSavedConfigs.ts";
import { usePaOptimizer } from "./usePaOptimizer.tsx";
import { usePaDesign } from "./usePaDesign.ts";

/**
 * Everything the PA stack and cutlist pages need, in one flat object. It is created once in App, so the
 * design, optimizer and view state survive switching between pages.
 */
export function usePaPlanner() {
  const viewOptions = useStackViewOptions();
  const phoneLayout = usePhoneLayout();
  const savedConfigs = useSavedConfigs();
  const design = usePaDesign({ dispersionPlane: viewOptions.dispersionPlane });
  const optimizer = usePaOptimizer({
    snapshot: design.snapshot,
    restore: design.restore,
    db: savedConfigs.db,
  });
  return { ...viewOptions, ...phoneLayout, ...savedConfigs, ...design, ...optimizer };
}
