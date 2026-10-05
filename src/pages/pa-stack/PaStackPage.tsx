import { OptimizerControls } from "./sections/OptimizerControls";
import { MobileSummaryStrip } from "./sections/MobileSummaryStrip";
import { StackViewer } from "./sections/StackViewer";
import { SubSection } from "./sections/SubSection";
import { MidSection } from "./sections/MidSection";
import { HornSection } from "./sections/HornSection";
import { SettingsPanel } from "./sections/SettingsPanel";
import { DispersionSection } from "./sections/DispersionSection";
import { TotalsSection } from "./sections/TotalsSection";
import { DetailsSection } from "./sections/DetailsSection";
import { SavedConfigs } from "../../components/saved-configs/SavedConfigs";
import { SettingsLayout } from "../../components/ui/SettingsLayout";
import type { PaPlanner } from "./hooks/usePaPlanner";

interface Props {
  planner: PaPlanner;
}

/** PA stack page: saved configurations, optimizer, 3D view, the Sub / Mid-bass / Horn results, the dispersion map, totals and details, beside the settings panel. */
export function PaStackPage({ planner }: Props) {
  const { isSettingsSheetOpen, store, fbUser, importSeed, snapshot, restore } = planner;
  return (
    <SettingsLayout
      className={isSettingsSheetOpen ? "max-md:pb-[52dvh]" : "max-md:pb-24"}
      results={
        <>
          <SavedConfigs
            bare
            store={store}
            snapshot={snapshot}
            restore={restore}
            extra={
              fbUser && (
                <button onClick={importSeed} className="hover:underline">
                  Import saved configs
                </button>
              )
            }
          />
          <OptimizerControls planner={planner} />
          <MobileSummaryStrip planner={planner} />
          <div className="flex flex-col gap-8">
            <div className="flex flex-col gap-5">
              <StackViewer planner={planner} />
              <SubSection planner={planner} />
              <MidSection planner={planner} />
              <HornSection planner={planner} />
              <DispersionSection planner={planner} />
            </div>
            <TotalsSection planner={planner} />
            <DetailsSection planner={planner} />
          </div>
        </>
      }
      settings={<SettingsPanel planner={planner} />}
    />
  );
}
