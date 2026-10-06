import { alpha } from "../../styles/palette";
import { usePalette } from "../../hooks/useTheme";
import { WarningChips } from "../../components/chips/WarningChips";
import { StatRowGrid } from "../../components/stats/StatRowGrid";
import { MAX_SPL_TIP, STATS } from "../../components/optimizer/StatRow";
import { StatTileGrid } from "../../components/stats/StatTileGrid";
import { ToggleGroup } from "../../components/ui/ToggleGroup";
import { CrossoverSlopeButtons } from "../../components/ui/CrossoverSlopeButtons";
import { Tooltip } from "../../components/ui/Tooltip";
import { Card } from "../../components/ui/Card";
import { SelectField } from "../../components/ui/SelectField";
import { Slider } from "../../components/ui/Slider";
import { ResponseChart } from "../../components/charts/ResponseChart";
import { fillChips } from "../../lib/pa/chips";
import { FILL_OPTIONS } from "../../lib/data";
import { fillSystem, nearestPoint } from "../../lib/pa/calc";
import type { FillsPlanner } from "./useFillsPlanner";
import { xmaxBandCurves, xmaxRows } from "../../lib/xmax";
import { LIMIT_NAMES } from "../../constants/limits";
import { PAGE_WIDTH, READING_WIDTH } from "../../styles/layout";
import { SettingsLayout } from "../../components/ui/SettingsLayout";
import { GXD4 } from "../../data/catalog/amps";
import { UI_TEXT } from "../../constants/uiText";
import { SettingsColumn } from "../../components/ui/SettingsColumn";

interface Props {
  fills: FillsPlanner;
}

const fillSizes = FILL_OPTIONS.map((o) => o.size);
/** the catalogue's fill size range, e.g. "8–12″" */
const FILL_SIZE_RANGE = `${Math.min(...fillSizes)}–${Math.max(...fillSizes)}″`;

/** Fills page: choose and size the fill speakers. */
export function FillsPage({ fills }: Props) {
  const pal = usePalette();
  const {
    driver,
    setDriver,
    boxType,
    setBoxType,
    boxDims,
    setBoxDim,
    portSpec,
    setPortField,
    highpassHz,
    setHighpassHz,
    highpassOrder,
    setHighpassOrder,
    ampWatts,
    setAmpWatts,
    maxPortAirSpeedMs,
    setMaxPortAirSpeedMs,
  } = fills;
  const thieleSmall = driver.ts;
  const fillConfig = {
    boxType,
    dim: boxDims,
    port: portSpec,
    hp: highpassHz,
    hpOrder: highpassOrder,
    ampW: ampWatts,
    portMax: maxPortAirSpeedMs,
  };
  const fill = fillSystem(driver, fillConfig);
  if (!fill)
    return (
      <main className={`${PAGE_WIDTH} pb-16 text-sm`}>
        This box can't be modelled: its port has no area or length.
      </main>
    );
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
  } = fill;
  const maxCurveNearest = (f: number) => nearestPoint(maxCurve, f);
  // the limit curve at the ends of an estimated Xmax, shaded on the chart (the box models whenever `fill` did)
  const maxBand = xmaxBandCurves(
    thieleSmall.xmax,
    (Xmax) => fillSystem({ ...driver, ts: { ...thieleSmall, Xmax } }, fillConfig)?.max ?? [],
  );
  const driverDisplacement =
    thieleSmall.disp != null ? thieleSmall.disp : driver.size >= 10 ? 1.5 : 1;
  const hfSpec = driver.hf;
  const maxAt60HzDb = maxCurveNearest(60).spl,
    maxAt150HzDb = maxCurveNearest(150).spl;
  const warningChips = fillChips({
    drv: driver,
    dim: boxDims,
    Fb: ventedModel ? ventedModel.Fb : null,
    Qtc: sealedModel ? sealedModel.Qtc : null,
    hp: highpassHz,
    hpOrder: highpassOrder,
    portLimited,
    portMax: maxPortAirSpeedMs,
    f3: f3Hz,
    hf: hfSpec,
    hfLimW: hfPowerLimitWatts,
    ampW: ampWatts,
    pad: hfPadDb,
  });
  return (
    <SettingsLayout
      results={
        <div className="min-w-0 flex flex-col gap-4">
          <p className="text-sm text-stone-500">
            <Tooltip
              tip={`Passive ${FILL_SIZE_RANGE} coaxial fills or booth monitors, highpassed to the subs. One amp channel each (or a pair in parallel).`}
            >
              Passive fills
            </Tooltip>
          </p>
          <StatTileGrid
            className=""
            tiles={[
              [STATS.netVolume, netLiters.toFixed(0), "L"],
              ventedModel
                ? [STATS.tuningFb, ventedModel.Fb.toFixed(0), "Hz"]
                : [STATS.qtc, sealedModel.Qtc.toFixed(2), ""],
              ["F3", f3Hz.toFixed(0), "Hz"],
              ["Max @ 60 Hz", maxAt60HzDb.toFixed(1), "dB"],
              ["Max @ 150 Hz", maxAt150HzDb.toFixed(1), "dB"],
              ["Weight", weightLb.toFixed(0), "lb"],
            ]}
          />
          <ResponseChart
            fmax={300}
            series={[
              {
                curve: maxCurve,
                band: maxBand,
                label: driver.name,
                stroke: pal.cyan,
                tint: alpha(pal.cyan, 0.07),
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
                `${UI_TEXT.splConditions}, modelled`,
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
                `sine, ${LIMIT_NAMES[maxCurveNearest(100).who]}-limited`,
                MAX_SPL_TIP,
              ],
              ...xmaxRows(thieleSmall),
              ["Price", driver.price ? `$${driver.price}` : "—", driver.src],
            ]}
          />
          <WarningChips chips={warningChips} />
          <p className={`${READING_WIDTH} text-xs text-stone-500`}>
            <span className="font-medium text-stone-500">{driver.name}.</span> {driver.note}{" "}
            <Tooltip
              tip={`Specs from usspeaker.com, Sep 2026. Box weight assumes 1/2″ birch. Displacement ${thieleSmall.disp != null ? "as published" : `not published; ${driverDisplacement} L assumed`}.`}
            >
              Spec notes
            </Tooltip>
          </p>
        </div>
      }
      settings={
        <SettingsColumn bodyClassName="md:pb-4">
          <SelectField
            label="Coaxial driver"
            options={FILL_OPTIONS}
            value={driver}
            onChange={setDriver}
          />
          <ToggleGroup
            label="Box"
            value={boxType}
            onChange={setBoxType}
            options={
              [
                ["vented", "Vented"],
                ["sealed", "Sealed"],
              ] as const
            }
            wrap={false}
            className="mb-2"
          />
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
              label="Highpass to the subs"
              value={highpassHz}
              min={50}
              max={160}
              step={5}
              unit=" Hz"
              onChange={setHighpassHz}
            />
            <CrossoverSlopeButtons
              order={highpassOrder}
              onChange={setHighpassOrder}
              label="Highpass slope"
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
              {`A freed ${GXD4.model} channel with two 8 Ω fills in parallel gives about ${GXD4.w4 / 2} W each.`}
            </div>
          </Card>
        </SettingsColumn>
      }
    />
  );
}
