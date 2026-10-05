import { StackView3D } from "../../../components/stack-view/StackView3D";
import type { PaPlanner } from "../hooks/usePaPlanner";

interface Props {
  planner: Pick<
    PaPlanner,
    | "isFull3d"
    | "setIsFull3d"
    | "portStyle"
    | "hornOption"
    | "plinthHeightIn"
    | "cutaway"
    | "layout"
    | "wallThicknessIn"
    | "baffleInsetIn"
    | "baffleColor"
    | "cabinetFinish"
    | "spacerHeightIn"
    | "midWithBox"
    | "subWithBox"
    | "portGeom"
  >;
}

/** The 3D view with its full-screen toggle. */
export function StackViewer({ planner }: Props) {
  const {
    isFull3d,
    setIsFull3d,
    portStyle,
    hornOption,
    plinthHeightIn,
    cutaway,
    layout,
    wallThicknessIn,
    baffleInsetIn,
    baffleColor,
    cabinetFinish,
    spacerHeightIn,
    midWithBox,
    subWithBox,
    portGeom,
  } = planner;
  const fullScreenLabel = isFull3d ? "Close full screen" : "Full screen";
  return (
    <>
      <section
        className={
          isFull3d
            ? "fixed inset-0 z-50 bg-stone-50"
            : "relative rounded-lg overflow-hidden border border-stone-300 bg-stone-50 h-[300px] md:h-[clamp(320px,56vh,560px)]"
        }
      >
        <button
          onClick={() => setIsFull3d((v) => !v)}
          aria-label={fullScreenLabel}
          title={fullScreenLabel}
          className="absolute top-2 right-2 z-10 w-9 h-9 inline-flex items-center justify-center rounded border border-stone-300 bg-white/90 hover:border-stone-500"
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
          plinth={plinthHeightIn}
          cutaway={cutaway}
          portStyle={portStyle}
          layout={layout}
          baffleColor={baffleColor}
          portGeom={portGeom}
          wall={wallThicknessIn}
          inset={baffleInsetIn}
          cabFinish={cabinetFinish}
          spacerH={spacerHeightIn}
        />
      </section>
    </>
  );
}
