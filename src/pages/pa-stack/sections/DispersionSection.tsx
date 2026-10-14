import { DispersionBlock } from "../../../components/charts/DispersionBlock";
import type { PaPlanner } from "../hooks/usePaPlanner";
import { FONT } from "../../../styles/fonts";
import { READING_WIDTH, RESULT_MAX_WIDTH } from "../../../styles/layout";

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
  // as when it sat in the horn results: only while the horn can be modeled
  if (!hornModel || !paDispersion) return null;
  return (
    <section className={`${RESULT_MAX_WIDTH} min-w-0`} style={{ fontFamily: FONT }}>
      <DispersionBlock
        map={paDispersion}
        plane={dispersionPlane}
        onPlane={setDispersionPlane}
        distM={dispersionMapDistanceM}
        axis="horn"
      />
      <div className={`${READING_WIDTH} text-xs text-stone-500 mt-1`}>
        Mid and horn centers {midHornGapIn.toFixed(1)}″ apart:{" "}
        {midHornNullAngleDeg
          ? `the first null at the ${midHornCrossoverHz} Hz crossover is about ${midHornNullAngleDeg.toFixed(0)}° above and below the horn axis.`
          : `under half a wavelength at ${midHornCrossoverHz} Hz: no null at the crossover.`}
      </div>
    </section>
  );
}
