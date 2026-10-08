import { StackView3D } from "../../../components/stack-view/StackView3D";
import type { PaPlanner } from "../hooks/usePaPlanner";

interface Props {
  planner: Pick<
    PaPlanner,
    | "isFull3d"
    | "setIsFull3d"
    | "portStyle"
    | "hornOption"
    | "compressionDriver"
    | "plinthHeightIn"
    | "cutaway"
    | "layout"
    | "wallThicknessIn"
    | "baffleInsetIn"
    | "baffleColor"
    | "hornColor"
    | "hornMount"
    | "cabinetFinish"
    | "spacerHeightIn"
    | "midWithBox"
    | "subWithBox"
    | "portGeom"
    | "subBracing"
    | "midBracing"
    | "subKeepOut"
    | "midKeepOut"
    | "subHardware"
    | "midHardware"
  >;
  /** the view's size and position while it isn't full screen (default: a fixed height for one column) */
  boxClassName?: string;
}

/** The 3D view with its full-screen toggle. */
export function StackViewer({
  planner,
  boxClassName = "relative h-[300px] md:h-[clamp(320px,56vh,560px)]",
}: Props) {
  const {
    isFull3d,
    setIsFull3d,
    portStyle,
    hornOption,
    compressionDriver,
    plinthHeightIn,
    cutaway,
    layout,
    wallThicknessIn,
    baffleInsetIn,
    baffleColor,
    hornColor,
    hornMount,
    cabinetFinish,
    spacerHeightIn,
    midWithBox,
    subWithBox,
    portGeom,
    subBracing,
    midBracing,
    subKeepOut,
    midKeepOut,
    subHardware,
    midHardware,
  } = planner;
  const fullScreenLabel = isFull3d ? "Close full screen" : "Full screen";
  return (
    <>
      <section
        className={
          isFull3d
            ? "fixed inset-0 z-50 bg-stone-50"
            : `rounded-lg overflow-hidden border border-stone-300 bg-stone-50 ${boxClassName}`
        }
      >
        <button
          onClick={() => setIsFull3d((v) => !v)}
          aria-label={fullScreenLabel}
          title={fullScreenLabel}
          className="absolute top-2 right-2 z-10 w-9 h-9 inline-flex items-center justify-center rounded border border-stone-300 bg-panel/90 hover:border-stone-500"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            {isFull3d ? (
              <path d="M4 4l8 8M12 4l-8 8" />
            ) : (
              <path d="M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10" />
            )}
          </svg>
        </button>
        <StackView3D
          sub={subWithBox}
          mid={midWithBox}
          horn={hornOption}
          cd={compressionDriver}
          plinth={plinthHeightIn}
          cutaway={cutaway}
          portStyle={portStyle}
          layout={layout}
          baffleColor={baffleColor}
          hornColor={hornColor}
          hornMount={hornMount}
          portGeom={portGeom}
          wall={wallThicknessIn}
          inset={baffleInsetIn}
          cabFinish={cabinetFinish}
          spacerH={spacerHeightIn}
          subBracing={subBracing}
          midBracing={midBracing}
          subKeepOut={subKeepOut}
          midKeepOut={midKeepOut}
          subHardware={subHardware}
          midHardware={midHardware}
        />
      </section>
    </>
  );
}
