import { PAL } from "../../styles/palette.ts";
import { WarningChips } from "../../components/chips/WarningChips.jsx";
import { StatRowGrid } from "../../components/stats/StatRowGrid.jsx";
import { StatTile } from "../../components/stats/StatTile.jsx";
import { ToggleButton } from "../../components/ui/ToggleButton.jsx";
import { Tooltip } from "../../components/ui/Tooltip.jsx";
import { Card } from "../../components/ui/Card.jsx";
import { SelectField } from "../../components/ui/SelectField.jsx";
import { Slider } from "../../components/ui/Slider.jsx";
import { ResponseChart } from "../../components/charts/ResponseChart.jsx";
import { fillChips } from "../../lib/pa/chips.js";
import { FILL_OPTIONS } from "../../lib/data.js";
import { fillSystem, nearestPoint } from "../../lib/pa/calc.js";
import { useState } from "react";

/** Fills page: choose and size the fill speakers. */
export function FillsPage() {
  const [driver, setDriver] = useState(FILL_OPTIONS.find((o) => o.id === "bc10cxn64"));
  const [boxType, setBoxType] = useState("vented");
  const [boxDims, setBoxDims] = useState({ w: 11.5, h: 16, d: 11 });
  const [portSpec, setPortSpec] = useState({ n: 1, dia: 3, len: 4 });
  const [highpassHz, setHighpassHz] = useState(70); // highpass to the subs, LR24
  const [ampWatts, setAmpWatts] = useState(300); // per box, rated into 8 Ω
  const [maxPortAirSpeedMs, setMaxPortAirSpeedMs] = useState(20);
  const setBoxDim = (k, v) => setBoxDims((p) => ({ ...p, [k]: v }));
  const setPortField = (k, v) => setPortSpec((p) => ({ ...p, [k]: v }));
  const thieleSmall = driver.ts;
  const {
    gross: grossLiters,
    pArea: portAreaSqIn,
    net: netLiters,
    vM: ventedModel,
    sM: sealedModel,
    max: maxCurve,
    sens: sensitivityDb,
    f3: f3Hz,
    pad: hfPadDb,
    hfLimW: hfPowerLimitWatts,
    lb: weightLb,
    portLimited,
  } = fillSystem(driver, {
    boxType,
    dim: boxDims,
    port: portSpec,
    hp: highpassHz,
    ampW: ampWatts,
    portMax: maxPortAirSpeedMs,
  });
  const maxCurveNearest = (f) => nearestPoint(maxCurve, f);
  const driverDisplacement =
    thieleSmall.disp != null ? thieleSmall.disp : driver.size >= 10 ? 1.5 : 1;
  const hfSpec = driver.hf;
  const maxAt60HzDb = maxCurveNearest(60).spl,
    maxAt150HzDb = maxCurveNearest(150).spl;
  const tile = (k, v, u) => <StatTile key={k} label={k} value={v} unit={u} />;
  const warningChips = fillChips({
    drv: driver,
    dim: boxDims,
    Fb: ventedModel ? ventedModel.Fb : null,
    Qtc: sealedModel ? sealedModel.Qtc : null,
    hp: highpassHz,
    portLimited,
    portMax: maxPortAirSpeedMs,
    f3: f3Hz,
    hf: hfSpec,
    hfLimW: hfPowerLimitWatts,
    ampW: ampWatts,
    pad: hfPadDb,
  });
  return (
    <main
      className="max-w-6xl mx-auto px-4 md:px-8 pb-16 grid grid-cols-1 md:grid-cols-5 gap-8"
      style={{ fontFamily: "var(--font)" }}
    >
      <div className="min-w-0 md:col-span-3 flex flex-col gap-4">
        <p className="text-sm text-stone-500">
          <Tooltip tip="Passive 8–10″ coaxial fills or booth monitors, highpassed to the subs. One amp channel each (or a pair in parallel).">
            Passive fills
          </Tooltip>
        </p>
        <div className="grid gap-px rounded-lg overflow-hidden border border-stone-300 bg-stone-300 grid-cols-2 sm:grid-cols-[repeat(auto-fit,minmax(112px,1fr))] [&>*:last-child:nth-child(odd)]:col-span-2 sm:[&>*:last-child:nth-child(odd)]:col-span-1">
          {tile("Net volume", netLiters.toFixed(0), "L")}
          {ventedModel
            ? tile("Tuning Fb", ventedModel.Fb.toFixed(0), "Hz")
            : tile("Qtc", sealedModel.Qtc.toFixed(2), "")}
          {tile("F3", f3Hz.toFixed(0), "Hz")}
          {tile("Max @ 60 Hz", maxAt60HzDb.toFixed(1), "dB")}
          {tile("Max @ 150 Hz", maxAt150HzDb.toFixed(1), "dB")}
          {tile("Weight", weightLb.toFixed(0), "lb")}
        </div>
        <ResponseChart
          fmax={300}
          series={[
            {
              curve: maxCurve,
              label: driver.name,
              stroke: PAL.cyan,
              tint: PAL.alpha(PAL.cyan, 0.07),
            },
          ]}
          marks={[
            { f: highpassHz, label: "HP" },
            ...(ventedModel ? [{ f: ventedModel.Fb, label: "Fb" }] : []),
          ]}
        />
        <StatRowGrid
          rows={[
            [
              "Woofer sensitivity",
              `${sensitivityDb.toFixed(1)} dB`,
              "2.83 V, half space, 1 m, modelled",
            ],
            [
              "HF sensitivity",
              hfSpec ? `${hfSpec.sens} dB` : "—",
              hfSpec ? `pad about ${hfPadDb.toFixed(0)} dB to match` : "not published",
            ],
            ["HF coverage", hfSpec && hfSpec.cov ? `${hfSpec.cov}° conical` : "—"],
            [
              "HF crossover",
              hfSpec && hfSpec.xo ? `${hfSpec.xo} Hz or higher` : "—",
              "recommended minimum",
            ],
            [
              "Max SPL at 100 Hz",
              `${maxCurveNearest(100).spl.toFixed(1)} dB`,
              `sine, ${maxCurveNearest(100).who}-limited`,
            ],
            ["Price", driver.price ? `$${driver.price}` : "—", driver.src],
          ]}
        />
        <WarningChips chips={warningChips} />
        <p className="text-xs text-stone-500">
          <span className="font-medium text-stone-500">{driver.name}.</span> {driver.note}{" "}
          <Tooltip
            tip={`Specs from usspeaker.com, Sep 2026. Box weight assumes 1/2″ birch. Displacement ${thieleSmall.disp != null ? "as published" : `not published; ${driverDisplacement} L assumed`}.`}
          >
            Spec notes
          </Tooltip>
        </p>
      </div>
      <aside className="min-w-0 md:col-span-2">
        <SelectField
          label="Coaxial driver"
          options={FILL_OPTIONS}
          value={driver}
          onChange={setDriver}
        />
        <div className="text-sm text-stone-500 mb-1">Box</div>
        <div className="flex gap-1 mb-2">
          {[
            ["Vented", "vented"],
            ["Sealed", "sealed"],
          ].map(([l, v]) => (
            <ToggleButton key={v} onClick={() => setBoxType(v)} on={boxType === v}>
              {l}
            </ToggleButton>
          ))}
        </div>
        <Card className="mb-4">
          <Slider
            label="Width"
            value={boxDims.w}
            min={9}
            max={20}
            step={0.5}
            unit="″"
            onChange={(v) => setBoxDim("w", v)}
          />
          <Slider
            label="Height"
            value={boxDims.h}
            min={9}
            max={28}
            step={0.5}
            unit="″"
            onChange={(v) => setBoxDim("h", v)}
          />
          <Slider
            label="Depth"
            value={boxDims.d}
            min={7}
            max={20}
            step={0.5}
            unit="″"
            onChange={(v) => setBoxDim("d", v)}
          />
          {boxType === "vented" && (
            <>
              <Slider
                label="Ports"
                value={portSpec.n}
                min={1}
                max={3}
                step={1}
                unit=""
                onChange={(v) => setPortField("n", v)}
              />
              <Slider
                label="Port diameter"
                value={portSpec.dia}
                min={1.5}
                max={5}
                step={0.25}
                unit="″"
                onChange={(v) => setPortField("dia", v)}
              />
              <Slider
                label="Port length"
                value={portSpec.len}
                min={1}
                max={14}
                step={0.25}
                unit="″"
                onChange={(v) => setPortField("len", v)}
              />
              <Slider
                label="Port velocity limit"
                value={maxPortAirSpeedMs}
                min={12}
                max={30}
                step={0.5}
                unit=" m/s"
                onChange={setMaxPortAirSpeedMs}
              />
            </>
          )}
          <div className="text-xs text-stone-500">
            {grossLiters.toFixed(0)} L gross
            {boxType === "sealed" ? ", stuffed" : `, ${portAreaSqIn.toFixed(1)} in² of port`}.
          </div>
        </Card>
        <Card>
          <Slider
            label="Highpass to the subs (LR24)"
            value={highpassHz}
            min={50}
            max={160}
            step={5}
            unit=" Hz"
            onChange={setHighpassHz}
          />
          <Slider
            label="Amp power per box @ 8 Ω"
            value={ampWatts}
            min={25}
            max={800}
            step={25}
            unit=" W"
            onChange={setAmpWatts}
          />
          <div className="text-xs text-stone-500">
            A freed GXD4 channel with two 8 Ω fills in parallel gives about 300 W each.
          </div>
        </Card>
      </aside>
    </main>
  );
}
