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
import { useWidthAtLeast } from "../../hooks/useElementWidth";
import { RESULTS_TWO_COLUMN_PX } from "../../styles/layout";
import type { PaPlanner } from "./hooks/usePaPlanner";

interface Props {
  planner: PaPlanner;
}

/**
 * PA stack page: saved configurations, optimizer, 3D view, the system summary, the Sub / Mid-bass / Horn results, the
 * dispersion map, totals and details, beside the settings panel. When the results pane is wide enough they take two
 * columns with aligned rows (3D view | summary, Sub | Mid-bass, Dispersion and Totals | Horn), the 3D view as tall as
 * the summary beside it; narrower, one column in reading order, the summary opening the Sub fold.
 */
export function PaStackPage({ planner }: Props) {
  const { isSettingsSheetOpen, store, fbUser, importSeed, snapshot, restore } = planner;
  // measured on the results, not the viewport: the settings column's width is draggable
  const [results, wide] = useWidthAtLeast(RESULTS_TWO_COLUMN_PX);
  // the summary sits beside the 3D view only when there is one; in one column it opens the Sub fold
  const besideView = wide && !!planner.subModelled;
  /** a cell's classes: `place` (its row and column) applies in two columns only */
  const cell = (place: string) => (wide ? `min-w-0 ${place}` : "min-w-0");
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
              {/* beside the summary, the summary sets the row's height and the view fills its cell */}
              <div
                className={cell(
                  besideView
                    ? "col-start-1 row-start-1 self-stretch relative min-h-[320px]"
                    : "col-span-2 row-start-1",
                )}
              >
                <StackViewer
                  planner={planner}
                  boxClassName={besideView ? "absolute inset-0" : undefined}
                />
              </div>
              {besideView && (
                <div className={cell("col-start-2 row-start-1")}>
                  <SystemSummary planner={planner} />
                </div>
              )}
              <div className={cell("col-start-1 row-start-2")}>
                <SubSection
                  planner={planner}
                  summary={!besideView && <SystemSummary planner={planner} className="mb-4" />}
                />
              </div>
              <div className={cell("col-start-2 row-start-2")}>
                <MidSection planner={planner} />
              </div>
              <div className={cell("col-start-2 row-start-3")}>
                <HornSection planner={planner} />
              </div>
              <div className={`flex flex-col gap-8 ${cell("col-start-1 row-start-3")}`}>
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
