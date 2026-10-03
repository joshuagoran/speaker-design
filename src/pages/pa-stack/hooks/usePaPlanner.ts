import { useStackViewOptions } from "./useStackViewOptions";
import type { StackViewOptions } from "./useStackViewOptions";
import { usePhoneLayout } from "./usePhoneLayout";
import type { PhoneLayout } from "./usePhoneLayout";
import { useSavedConfigs } from "./useSavedConfigs";
import type { SavedConfigs } from "./useSavedConfigs";
import { usePaOptimizer } from "./usePaOptimizer";
import type { PaOptimizer } from "./usePaOptimizer";
import { usePaDesign } from "./usePaDesign";
import type { PaDesign } from "./usePaDesign";

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
    cutlist: { sheet: design.plywoodSheetKind, stacks: design.boxSetCount },
  });
  return { ...viewOptions, ...phoneLayout, ...savedConfigs, ...design, ...optimizer };
}
