import { SectionHeading } from "../../../components/ui/SectionHeading.jsx";

/** Toggle for, and text of, the written details of the sub, mid-bass cube and horn. */
export function DetailsSection({ planner }) {
  const {
    showDetails,
    setShowDetails,
    subDriver,
    midDriver,
    hornOption,
    compressionDriver,
    subMidCrossoverHz,
    midHornCrossoverHz,
    wallThicknessIn,
    baffleInsetIn,
    effectiveMidBoxDims,
    subBox,
    port,
    subGrossLiters,
    subNetLiters,
    midBoxLiters,
    stackHeightIn,
    hornCenterHeightIn,
  } = planner;
  return (
    <>
      <div className="min-w-0 md:col-span-5 mt-4" style={{ fontFamily: "var(--font)" }}>
        <button
          onClick={() => setShowDetails((v) => !v)}
          aria-expanded={showDetails}
          className="text-sm px-3 py-1.5 rounded border border-stone-300 hover:border-stone-500"
        >
          {showDetails ? "Hide" : "Show"} sub, mid-bass and horn details
        </button>
      </div>
      {showDetails && (
        <section
          className="min-w-0 md:col-span-5 grid grid-cols-1 md:grid-cols-3 gap-6"
          style={{ fontFamily: "var(--font)" }}
        >
          <div>
            <SectionHeading className="mb-2">Sub</SectionHeading>
            <p className="text-sm text-stone-900">
              {subDriver.name} in a {subBox.w}×{subBox.h}×{subBox.d} in cabinet,{" "}
              {subGrossLiters.toFixed(0)} L gross, {subNetLiters.toFixed(0)} L net. Vent:{" "}
              {port.desc}. 3/4″ baffle set {baffleInsetIn}″ behind the frame,{" "}
              {wallThicknessIn === 0.5 ? "1/2″" : "3/4″"} birch walls, 1/4″ roundovers on the front
              edges.
            </p>
          </div>
          <div>
            <SectionHeading className="mb-2">Mid-bass cube</SectionHeading>
            <p className="text-sm text-stone-900">
              {midDriver.name} in a {effectiveMidBoxDims.w}×{effectiveMidBoxDims.h}×
              {effectiveMidBoxDims.d} in sealed box, gross {midBoxLiters.toFixed(0)} L, lightly
              stuffed. Covers {subMidCrossoverHz} Hz to {midHornCrossoverHz} Hz. Same construction,
              flush-mounted driver.
            </p>
            {midDriver.note && (
              <p className="text-sm text-stone-500 mt-2">
                <span className="font-medium text-stone-900">{midDriver.name}.</span>{" "}
                {midDriver.note}
              </p>
            )}
          </div>
          <div>
            <SectionHeading className="mb-2">Horn</SectionHeading>
            <p className="text-sm text-stone-900">
              {hornOption.name} with {compressionDriver.name}, crossed at {midHornCrossoverHz} Hz
              (maker suggests {hornOption.xo}). Sits on a short block so the mouth clears the cube.
              Total stack height about {stackHeightIn.toFixed(0)} in, horn center at{" "}
              {hornCenterHeightIn.toFixed(0)} in.
            </p>
            {compressionDriver.note && (
              <p className="text-sm text-stone-500 mt-2">
                <span className="font-medium text-stone-900">{compressionDriver.name}.</span>{" "}
                {compressionDriver.note}
              </p>
            )}
            {hornOption.note && (
              <p className="text-sm text-stone-500 mt-2">
                <span className="font-medium text-stone-900">{hornOption.name}.</span>{" "}
                {hornOption.note}
              </p>
            )}
          </div>
        </section>
      )}
    </>
  );
}
