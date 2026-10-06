import { OptimizerControls } from "./sections/OptimizerControls";
import { MobileSummaryStrip } from "./sections/MobileSummaryStrip";
import { StackViewer } from "./sections/StackViewer";
import { SystemSummary } from "./sections/SystemSummary";
import { SubSection } from "./sections/SubSection";
import { MidSection } from "./sections/MidSection";
import { HornSection } from "./sections/HornSection";
import { SettingsPanel } from "./sections/SettingsPanel";
import { DispersionSection } from "./sections/DispersionSection";
import { TotalsSection } from "./sections/TotalsSection";
import { DetailsSection } from "./sections/DetailsSection";
import { SavedConfigs } from "../../components/saved-configs/SavedConfigs";
import { SettingsLayout } from "../../components/ui/SettingsLayout";
import { settingsSheetRoomClass } from "../../components/ui/SettingsSheetTabs";
import { useElementWidth } from "../../hooks/useElementWidth";
import { PA_TWO_COLUMN_PX } from "../../styles/layout";
import type { PaPlanner } from "./hooks/usePaPlanner";

interface Props {
  planner: PaPlanner;
}

/**
 * PA stack page: saved configurations, optimizer, 3D view, the system summary, the Sub / Mid-bass / Horn results, the
 * dispersion map, totals and details, beside the settings panel. When the results pane is wide enough they take two
 * columns with aligned rows (3D view | summary, Sub | Mid-bass, Dispersion and Totals | Horn), the 3D view as tall as
 * the summary beside it; narrower, one column in reading order.
 */
export function PaStackPage({ planner }: Props) {
  const { isSettingsSheetOpen, store, fbUser, importSeed, snapshot, restore } = planner;
  // measured on the results, not the viewport: the settings column's width is draggable
  const [results, resultsWidth] = useElementWidth(0);
  const wide = resultsWidth >= PA_TWO_COLUMN_PX;
  /** a cell's classes: `place` (its row and column) applies in two columns only */
  const cell = (place: string, always = "") => `min-w-0 ${always} ${wide ? place : ""}`;
  return (
    <SettingsLayout
      className={settingsSheetRoomClass(isSettingsSheetOpen)}
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
          <div ref={results} className="flex flex-col gap-8">
            <div
              className={
                wide ? "grid grid-cols-2 gap-x-4 gap-y-5 items-start" : "flex flex-col gap-5"
              }
            >
              {/* in two columns the summary beside it sets the row's height, and the view fills its cell */}
              <div className={cell("col-start-1 row-start-1 self-stretch relative min-h-[320px]")}>
                <StackViewer
                  planner={planner}
                  boxClassName={wide ? "absolute inset-0" : undefined}
                />
              </div>
              <div className={cell("col-start-2 row-start-1")}>
                <SystemSummary planner={planner} />
              </div>
              <div className={cell("col-start-1 row-start-2")}>
                <SubSection planner={planner} />
              </div>
              <div className={cell("col-start-2 row-start-2")}>
                <MidSection planner={planner} />
              </div>
              <div className={cell("col-start-2 row-start-3")}>
                <HornSection planner={planner} />
              </div>
              <div className={cell("col-start-1 row-start-3", "flex flex-col gap-8")}>
                <DispersionSection planner={planner} />
                <TotalsSection planner={planner} />
              </div>
            </div>
            <DetailsSection planner={planner} />
          </div>
        </>
      }
      settings={<SettingsPanel planner={planner} />}
    />
  );
}
