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
import type { PaPlanner } from "./hooks/usePaPlanner";

interface Props {
  planner: PaPlanner;
}

/** PA stack page: saved configurations, optimizer, 3D view, the Sub / Mid-bass / Horn results, the settings panel, then the dispersion map, totals and details. */
export function PaStackPage({ planner }: Props) {
  const { isSettingsSheetOpen, store, fbUser, importSeed, snapshot, restore } = planner;
  return (
    <>
      <SavedConfigs
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
      <main
        className={`max-w-6xl mx-auto px-4 md:px-8 pb-16 grid ${isSettingsSheetOpen ? "max-md:pb-[52dvh]" : "max-md:pb-24"} grid-cols-1 md:grid-cols-5 gap-8`}
      >
        <div className="min-w-0 md:col-span-3 flex flex-col gap-5">
          <StackViewer planner={planner} />
          <SubSection planner={planner} />
          <MidSection planner={planner} />
          <HornSection planner={planner} />
          <DispersionSection planner={planner} />
        </div>

        <SettingsPanel planner={planner} />

        <TotalsSection planner={planner} />
        <DetailsSection planner={planner} />
      </main>
    </>
  );
}
