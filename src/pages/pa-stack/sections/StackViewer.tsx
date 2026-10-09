import { StackView3D } from "../../../components/stack-view/StackView3D";
import { Viewer3DCard } from "../../../components/stack-view/Viewer3DCard";
import type { PaPlanner } from "../hooks/usePaPlanner";

interface Props {
  planner: Pick<
    PaPlanner,
    | "portStyle"
    | "hornOption"
    | "compressionDriver"
    | "plinthHeightIn"
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

/** The PA stack in its 3D view card (cutaway and full screen). */
export function StackViewer({
  planner,
  boxClassName = "relative h-[300px] md:h-[clamp(320px,56vh,560px)]",
}: Props) {
  const {
    portStyle,
    hornOption,
    compressionDriver,
    plinthHeightIn,
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
  return (
    <Viewer3DCard boxClassName={boxClassName}>
      {(cutaway) => (
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
      )}
    </Viewer3DCard>
  );
}
