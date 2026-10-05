import { DispersionPlaneToggle } from "../../../components/ui/DispersionPlaneToggle";
import { dispersionPlaneName } from "../../../constants/dispersionPlanes";
import { DispersionMap } from "../../../components/charts/DispersionMap";
import type { PaPlanner } from "../hooks/usePaPlanner";
import { FONT } from "../../../styles/fonts";

interface Props {
  planner: Pick<
    PaPlanner,
    | "dispersionPlane"
    | "setDispersionPlane"
    | "hornModel"
    | "midHornCrossoverHz"
    | "dispersionMapDistanceM"
    | "paDispersion"
    | "midHornGapIn"
    | "midHornNullAngleDeg"
  >;
}

/** The stack's dispersion map, horizontal or vertical, with the mid-to-horn spacing note; shown just above the totals. */
export function DispersionSection({ planner }: Props) {
  const {
    dispersionPlane,
    setDispersionPlane,
    hornModel,
    midHornCrossoverHz,
    dispersionMapDistanceM,
    paDispersion,
    midHornGapIn,
    midHornNullAngleDeg,
  } = planner;
  // as when it sat in the horn results: only while the horn can be modelled
  if (!hornModel || !paDispersion) return null;
  return (
    <section className="min-w-0" style={{ fontFamily: FONT }}>
      <DispersionPlaneToggle value={dispersionPlane} onChange={setDispersionPlane} />
      <DispersionMap
        map={paDispersion}
        title={
          dispersionPlane === "v"
            ? `${dispersionPlaneName("v")} dispersion at ${dispersionMapDistanceM} m: below (−) to above (+) the horn axis`
            : `${dispersionPlaneName("h")} dispersion at ${dispersionMapDistanceM} m, at horn height (0° is on axis)`
        }
      />
      <div className="text-xs text-stone-500 mt-1">
        Mid and horn centers {midHornGapIn.toFixed(1)}″ apart:{" "}
        {midHornNullAngleDeg
          ? `the first null at the ${midHornCrossoverHz} Hz crossover is about ${midHornNullAngleDeg.toFixed(0)}° above and below the horn axis.`
          : `under half a wavelength at ${midHornCrossoverHz} Hz, so no null at the crossover.`}
      </div>
    </section>
  );
}
