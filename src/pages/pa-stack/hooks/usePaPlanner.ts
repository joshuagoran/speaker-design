import { useStackViewOptions } from "./useStackViewOptions.ts";
import type { StackViewOptions } from "./useStackViewOptions.ts";
import { usePhoneLayout } from "./usePhoneLayout.ts";
import type { PhoneLayout } from "./usePhoneLayout.ts";
import { useSavedConfigs } from "./useSavedConfigs.ts";
import type { SavedConfigs } from "./useSavedConfigs.ts";
import { usePaOptimizer } from "./usePaOptimizer.tsx";
import type { PaOptimizer } from "./usePaOptimizer.tsx";
import { usePaDesign } from "./usePaDesign.ts";
import type { PaDesign } from "./usePaDesign.ts";

/** Everything the PA stack and cutlist pages read, flat. */
export interface PaPlanner
  extends StackViewOptions, PhoneLayout, SavedConfigs, PaDesign, PaOptimizer {}

/**
 * Everything the PA stack and cutlist pages need, in one flat object. It is created once in App, so the
 * design, optimizer and view state survive switching between pages.
 */
export function usePaPlanner(): PaPlanner {
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
