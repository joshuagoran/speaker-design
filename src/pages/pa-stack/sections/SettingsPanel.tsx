import { PA_SLIDERS, PA_THROAT_MAX_VSLOT1 } from "../../../constants/paSliders";
import { ToggleButton } from "../../../components/ui/ToggleButton";
import { Tooltip } from "../../../components/ui/Tooltip";
import { SwatchPicker } from "../../../components/ui/SwatchPicker";
import { Card } from "../../../components/ui/Card";
import { SelectField } from "../../../components/ui/SelectField";
import { Slider } from "../../../components/ui/Slider";
import {
  CD_OPTIONS,
  HORN_OPTIONS,
  PAINT_SWATCHES,
  CABINET_FINISHES,
  cabinetFinishOf,
} from "../../../lib/data";
import { HIGHPASS_ALIGNMENTS, isRoundPort } from "../../../lib/pa/calc";
import { AMP_WATTS_MAX, AMP_WATTS_STEPS } from "../../../lib/pa/optimize";
import { ductFit, ductLenSliderMax } from "../../../lib/pa/chips";
import type { PaPlanner } from "../hooks/usePaPlanner";
import { entriesOf, keysOf } from "../../../lib/records";
import { CrossoverSlopeButtons } from "../../../components/ui/CrossoverSlopeButtons";
import { FONT } from "../../../styles/fonts";
import { SLOT_LAYOUT_NAMES } from "../../../constants/portStyles";
import { UI_TEXT } from "../../../constants/uiText";

interface Props {
  planner: Pick<
    PaPlanner,
    | "isSettingsSheetOpen"
    | "setSettingsSheetOpen"
    | "activeTab"
    | "setActiveTab"
    | "tabClass"
    | "subDriver"
    | "setSubDriver"
    | "portStyle"
    | "setPortStyle"
    | "subBoxDims"
    | "subVentSpec"
    | "subHighpassHz"
    | "setSubHighpassHz"
    | "subHighpassType"
    | "setSubHighpassType"
    | "subAmpWatts"
    | "setSubAmpWatts"
    | "maxPortAirSpeedMs"
    | "setMaxPortAirSpeedMs"
    | "setSubBoxDim"
    | "setSubVentField"
    | "midDriver"
    | "setMidDriver"
    | "midBoxDims"
    | "midAmpWatts"
    | "setMidAmpWatts"
    | "midBandTiltDb"
    | "setMidBandTiltDb"
    | "setMidBoxDim"
    | "midSize"
    | "setMidSize"
    | "hornOption"
    | "setHornOption"
    | "compressionDriver"
    | "setCompressionDriver"
    | "hornAmpWatts"
    | "setHornAmpWatts"
    | "hornBandTiltDb"
    | "setHornBandTiltDb"
    | "subMidCrossoverHz"
    | "setSubMidCrossoverHz"
    | "midHornCrossoverHz"
    | "setMidHornCrossoverHz"
    | "subMidCrossoverOrder"
    | "setSubMidCrossoverOrder"
    | "midHornCrossoverOrder"
    | "setMidHornCrossoverOrder"
    | "cutaway"
    | "setCutaway"
    | "layout"
    | "setLayout"
    | "wallThicknessIn"
    | "setWallThicknessIn"
    | "baffleInsetIn"
    | "setBaffleInsetIn"
    | "baffleColor"
    | "setBaffleColor"
    | "cabinetFinish"
    | "setCabinetFinish"
    | "spacerHeightIn"
    | "setSpacerHeightIn"
    | "subDriverChoices"
    | "midDriverChoices"
    | "hornExitMismatch"
    | "port"
    | "renderLockButton"
    | "renderDimensionLock"
  >;
}

/** Settings: sliders and pickers for the sub, mid-bass, horn and the look. A bottom sheet with tabs on phones. */
export function SettingsPanel({ planner }: Props) {
  const {
    isSettingsSheetOpen,
    setSettingsSheetOpen,
    activeTab,
    setActiveTab,
    tabClass,
    subDriver,
    setSubDriver,
    portStyle,
    setPortStyle,
    subBoxDims,
    subVentSpec,
    subHighpassHz,
    setSubHighpassHz,
    subHighpassType,
    setSubHighpassType,
    subAmpWatts,
    setSubAmpWatts,
    maxPortAirSpeedMs,
    setMaxPortAirSpeedMs,
    setSubBoxDim,
    setSubVentField,
    midDriver,
    setMidDriver,
    midBoxDims,
    midAmpWatts,
    setMidAmpWatts,
    midBandTiltDb,
    setMidBandTiltDb,
    setMidBoxDim,
    midSize,
    setMidSize,
    hornOption,
    setHornOption,
    compressionDriver,
    setCompressionDriver,
    hornAmpWatts,
    setHornAmpWatts,
    hornBandTiltDb,
    setHornBandTiltDb,
    subMidCrossoverHz,
    setSubMidCrossoverHz,
    midHornCrossoverHz,
    setMidHornCrossoverHz,
    subMidCrossoverOrder,
    setSubMidCrossoverOrder,
    midHornCrossoverOrder,
    setMidHornCrossoverOrder,
    cutaway,
    setCutaway,
    layout,
    setLayout,
    wallThicknessIn,
    setWallThicknessIn,
    baffleInsetIn,
    setBaffleInsetIn,
    baffleColor,
    setBaffleColor,
    cabinetFinish,
    setCabinetFinish,
    spacerHeightIn,
    setSpacerHeightIn,
    subDriverChoices,
    midDriverChoices,
    hornExitMismatch,
    port,
    renderLockButton,
    renderDimensionLock,
  } = planner;
  // a bottom slot's duct lengths: straight, then folded up the back wall (the lengths between fit neither way)
  const slotFit =
    portStyle === "slots" ? ductFit(subBoxDims, portStyle, subVentSpec, wallThicknessIn) : null;
  return (
    <>
      <aside
        className={`min-w-0 md:col-span-2 max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:z-40 max-md:bg-stone-50 max-md:border-t max-md:border-stone-300 max-md:rounded-t-lg max-md:shadow-sheet`}
        style={{ fontFamily: FONT }}
        aria-label="Settings"
      >
        <div className="md:hidden flex gap-1 px-3 pt-2 pb-2" role="tablist">
          {(
            [
              ["sub", "Sub"],
              ["mid", "Mid"],
              ["horn", "Horn"],
              ["look", "Look"],
            ] as const
          ).map(([t, label]) => (
            <button
              key={t}
              role="tab"
              aria-selected={isSettingsSheetOpen && activeTab === t}
              onClick={() => {
                if (isSettingsSheetOpen && activeTab === t) setSettingsSheetOpen(false);
                else {
                  setActiveTab(t);
                  setSettingsSheetOpen(true);
                }
              }}
              className={`flex-1 px-2 py-2 rounded border text-sm ${isSettingsSheetOpen && activeTab === t ? "border-stone-900 bg-stone-900 text-stone-50" : "border-stone-300 bg-stone-50"}`}
            >
              {label}
            </button>
          ))}
          {isSettingsSheetOpen && (
            <button
              onClick={() => setSettingsSheetOpen(false)}
              aria-label={UI_TEXT.closeSettings}
              className="px-3 rounded border border-stone-300 bg-stone-50 text-sm"
            >
              ✕
            </button>
          )}
        </div>
        <div
          className={`max-md:overflow-y-auto max-md:overscroll-contain max-md:px-4 max-md:pt-1 max-md:pb-4 max-md:max-h-[45dvh] ${isSettingsSheetOpen ? "" : "max-md:hidden"}`}
        >
          <div className={tabClass("look")}>
            <div className="mb-5">
              <div className="text-sm text-stone-500 mb-1 flex items-center justify-between gap-2">
                <span>Plywood (baffles stay 3/4″)</span>
                {renderLockButton("wall", "the plywood")}
              </div>
              <div className="flex gap-1">
                {(
                  [
                    [0.75, "3/4″ birch"],
                    [0.5, "1/2″ birch, braced"],
                  ] as const
                ).map(([t, label]) => (
                  <ToggleButton
                    key={t}
                    onClick={() => setWallThicknessIn(t)}
                    on={wallThicknessIn === t}
                  >
                    {label}
                  </ToggleButton>
                ))}
              </div>
              <div className="mt-3">
                <Slider
                  label="Baffle inset"
                  value={baffleInsetIn}
                  min={0}
                  max={1.5}
                  step={0.25}
                  unit="″"
                  onChange={setBaffleInsetIn}
                />
              </div>
            </div>
          </div>
          <div className={tabClass("sub")}>
            <SelectField
              label="Sub driver"
              options={subDriverChoices}
              value={subDriver}
              onChange={setSubDriver}
              extra={renderLockButton("sub", "the sub driver")}
            />
          </div>
          <div className={tabClass("look")}>
            <SwatchPicker
              label="Cabinet finish"
              value={cabinetFinish}
              onChange={setCabinetFinish}
              swatches={PAINT_SWATCHES}
              presets={CABINET_FINISHES}
              titlePrefix="Painted: "
              note={cabinetFinishOf(cabinetFinish)?.name ?? `painted ${cabinetFinish}`}
            />
          </div>
          <div className={tabClass("look")}>
            <SwatchPicker
              label="Baffle colour"
              value={baffleColor}
              onChange={setBaffleColor}
              swatches={PAINT_SWATCHES}
              note={baffleColor}
            />
          </div>
          <div className={tabClass("look")}>
            <div className="mb-5">
              <div className="text-sm text-stone-500 mb-1">View</div>
              <div className="flex gap-1">
                {(
                  [
                    ["Finished", false],
                    ["Cutaway", true],
                  ] as const
                ).map(([label, v]) => (
                  <ToggleButton key={label} onClick={() => setCutaway(v)} on={cutaway === v}>
                    {label}
                  </ToggleButton>
                ))}
              </div>
            </div>
          </div>
          <div className={tabClass("look")}>
            <div className="mb-5">
              <div className="text-sm text-stone-500 mb-1">Layout</div>
              <div className="flex gap-1">
                {(
                  [
                    ["Two stacks", "stack"],
                    ["Tops on spacers", "pole"],
                    ["Tower", "tower"],
                    ["One sub + satellites", "satellite"],
                  ] as const
                ).map(([label, v]) => (
                  <ToggleButton key={v} onClick={() => setLayout(v)} on={layout === v}>
                    {label}
                  </ToggleButton>
                ))}
              </div>
              {layout === "pole" && (
                <div className="mt-3">
                  <Slider
                    label="Spacer height"
                    value={spacerHeightIn}
                    min={4}
                    max={36}
                    step={1}
                    unit="″"
                    onChange={setSpacerHeightIn}
                  />
                </div>
              )}
            </div>
          </div>
          <div className={tabClass("sub")}>
            <div className="mb-5">
              <div className="text-sm text-stone-500 mb-1">Cabinet</div>
              <Card>
                <Slider
                  label="Width"
                  value={subBoxDims.w}
                  min={PA_SLIDERS.subW.min}
                  max={PA_SLIDERS.subW.max}
                  step={PA_SLIDERS.subW.step}
                  unit="″"
                  onChange={(v) => setSubBoxDim("w", v)}
                  extra={renderDimensionLock("subDim", "w", "Sub width")}
                />
                <Slider
                  label="Height"
                  value={subBoxDims.h}
                  min={PA_SLIDERS.subH.min}
                  max={PA_SLIDERS.subH.max}
                  step={PA_SLIDERS.subH.step}
                  unit="″"
                  onChange={(v) => setSubBoxDim("h", v)}
                  extra={renderDimensionLock("subDim", "h", "Sub height")}
                />
                <Slider
                  label="Depth"
                  value={subBoxDims.d}
                  min={PA_SLIDERS.subD.min}
                  max={PA_SLIDERS.subD.max}
                  step={PA_SLIDERS.subD.step}
                  unit="″"
                  onChange={(v) => setSubBoxDim("d", v)}
                  extra={renderDimensionLock("subDim", "d", "Sub depth")}
                />
              </Card>
            </div>
          </div>
          <div className={tabClass("sub")}>
            <div className="mb-5">
              <div className="text-sm text-stone-500 mb-1 flex items-center justify-between gap-2">
                <span>Vent</span>
                {renderLockButton("vent", "the vent style")}
              </div>
              <div className="flex flex-wrap gap-1">
                {(
                  [
                    ["Rectangular", !isRoundPort(portStyle), "slots"],
                    ["Round tubes", isRoundPort(portStyle), "round2"],
                  ] as const
                ).map(([label, on, v]) => (
                  <ToggleButton
                    key={label}
                    onClick={() => {
                      if (!on) setPortStyle(v);
                    }}
                    on={on}
                  >
                    {label}
                  </ToggleButton>
                ))}
              </div>
              {!isRoundPort(portStyle) && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {entriesOf(SLOT_LAYOUT_NAMES).map(([v, label]) => {
                    const on = portStyle === v;
                    return (
                      <ToggleButton key={v} onClick={() => setPortStyle(v)} on={on} size="xs">
                        {label}
                      </ToggleButton>
                    );
                  })}
                </div>
              )}
              <Card className="mt-2">
                {portStyle === "slots" && (
                  <Slider
                    label="Slot height"
                    value={subVentSpec.slotH}
                    min={PA_SLIDERS.slotH.min}
                    max={PA_SLIDERS.slotH.max}
                    step={PA_SLIDERS.slotH.step}
                    unit="″"
                    onChange={(v) => setSubVentField("slotH", v)}
                  />
                )}
                {(portStyle === "vslots" || portStyle === "vslot1") && (
                  <Slider
                    label="Duct throat"
                    value={subVentSpec.throat}
                    min={PA_SLIDERS.throat.min}
                    max={portStyle === "vslot1" ? PA_THROAT_MAX_VSLOT1 : PA_SLIDERS.throat.max}
                    step={PA_SLIDERS.throat.step}
                    unit="″"
                    onChange={(v) => setSubVentField("throat", v)}
                  />
                )}
                {isRoundPort(portStyle) && (
                  <>
                    <Slider
                      label="Tubes"
                      value={subVentSpec.nt}
                      min={PA_SLIDERS.tubes.min}
                      max={PA_SLIDERS.tubes.max}
                      step={PA_SLIDERS.tubes.step}
                      unit=""
                      onChange={(v) => setSubVentField("nt", v)}
                    />
                    <Slider
                      label="Tube diameter"
                      value={subVentSpec.dia}
                      min={PA_SLIDERS.tubeDia.min}
                      max={PA_SLIDERS.tubeDia.max}
                      step={PA_SLIDERS.tubeDia.step}
                      unit="″"
                      onChange={(v) => setSubVentField("dia", v)}
                    />
                  </>
                )}
                <Slider
                  label="Duct length"
                  value={subVentSpec.len}
                  min={PA_SLIDERS.ductLen.min}
                  max={ductLenSliderMax(subBoxDims, portStyle, subVentSpec, wallThicknessIn)}
                  step={PA_SLIDERS.ductLen.step}
                  unit="″"
                  onChange={(v) => setSubVentField("len", v)}
                  // a bottom slot skips the lengths that fit neither way, and stops at the longest fold
                  ranges={slotFit?.spans}
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
                <div className="text-xs text-stone-500">
                  {port.desc}. {port.area.toFixed(1)} in&#178;.
                </div>
              </Card>
            </div>
            <div className="mb-5">
              <div className="text-sm text-stone-500 mb-1">Sub highpass and amp</div>
              <Card>
                <Slider
                  label={`Highpass (${subHighpassType})`}
                  value={subHighpassHz}
                  min={PA_SLIDERS.hpf.min}
                  max={PA_SLIDERS.hpf.max}
                  step={PA_SLIDERS.hpf.step}
                  unit=" Hz"
                  onChange={setSubHighpassHz}
                  extra={renderLockButton("hpf", "the highpass")}
                />
                <div className="flex flex-wrap gap-1 -mt-1 mb-3">
                  {keysOf(HIGHPASS_ALIGNMENTS).map((t) => (
                    <ToggleButton
                      key={t}
                      onClick={() => setSubHighpassType(t)}
                      on={subHighpassType === t}
                      size="xs"
                    >
                      {t}
                    </ToggleButton>
                  ))}
                </div>
                <Slider
                  label="Amp power per channel @ 8 Ω"
                  value={subAmpWatts}
                  min={AMP_WATTS_STEPS.ampW.min}
                  max={AMP_WATTS_MAX.ampW}
                  step={AMP_WATTS_STEPS.ampW.step}
                  unit=" W"
                  onChange={setSubAmpWatts}
                  extra={renderLockButton("ampW", "the sub amp power")}
                />
              </Card>
            </div>
          </div>
          <div className={tabClass("mid")}>
            <div className="mb-2">
              <div className="text-sm text-stone-500 mb-1">Mid-bass size</div>
              <div className="flex gap-1">
                {([12, 15] as const).map((n) => (
                  <ToggleButton key={n} onClick={() => setMidSize(n)} on={midSize === n}>
                    {n}″
                  </ToggleButton>
                ))}
              </div>
            </div>
            <SelectField
              label={`Mid-bass ${midSize}″`}
              options={midDriverChoices}
              value={midDriver}
              onChange={setMidDriver}
              extra={renderLockButton("mid", "the mid-bass driver")}
            />
            <div className="mb-5">
              <div className="text-sm text-stone-500 mb-1">Mid-bass cabinet (sealed)</div>
              <Card>
                {layout === "tower" ? (
                  <div className="text-xs text-stone-500 mb-3">
                    Tower layout: the mid chamber is the sub's footprint, {subBoxDims.w}″ × 15.5″ ×{" "}
                    {subBoxDims.d}″.
                  </div>
                ) : (
                  <>
                    <Slider
                      label="Width"
                      value={midBoxDims.w}
                      min={PA_SLIDERS.midW.min}
                      max={PA_SLIDERS.midW.max}
                      step={PA_SLIDERS.midW.step}
                      unit="″"
                      onChange={(v) => setMidBoxDim("w", v)}
                      extra={renderDimensionLock("midDim", "w", "Mid width")}
                    />
                    <Slider
                      label="Height"
                      value={midBoxDims.h}
                      min={PA_SLIDERS.midH.min}
                      max={PA_SLIDERS.midH.max}
                      step={PA_SLIDERS.midH.step}
                      unit="″"
                      onChange={(v) => setMidBoxDim("h", v)}
                      extra={renderDimensionLock("midDim", "h", "Mid height")}
                    />
                    <Slider
                      label="Depth"
                      value={midBoxDims.d}
                      min={PA_SLIDERS.midD.min}
                      max={PA_SLIDERS.midD.max}
                      step={PA_SLIDERS.midD.step}
                      unit="″"
                      onChange={(v) => setMidBoxDim("d", v)}
                      extra={renderDimensionLock("midDim", "d", "Mid depth")}
                    />
                  </>
                )}
                <Slider
                  label="Crossover, sub to mid"
                  value={subMidCrossoverHz}
                  min={PA_SLIDERS.xoLo.min}
                  max={PA_SLIDERS.xoLo.max}
                  step={PA_SLIDERS.xoLo.step}
                  unit=" Hz"
                  onChange={setSubMidCrossoverHz}
                  extra={renderLockButton("xoLo", "the sub-to-mid crossover")}
                />
                <CrossoverSlopeButtons
                  order={subMidCrossoverOrder}
                  onChange={setSubMidCrossoverOrder}
                  label="Crossover slope, sub to mid"
                />
                <Slider
                  label="Crossover, mid to horn"
                  value={midHornCrossoverHz}
                  min={PA_SLIDERS.xoHi.min}
                  max={PA_SLIDERS.xoHi.max}
                  step={PA_SLIDERS.xoHi.step}
                  unit=" Hz"
                  onChange={setMidHornCrossoverHz}
                  extra={renderLockButton("xoHi", "the mid-to-horn crossover")}
                />
                <CrossoverSlopeButtons
                  order={midHornCrossoverOrder}
                  onChange={setMidHornCrossoverOrder}
                  label="Crossover slope, mid to horn"
                />
                <Slider
                  label="Mid amp power per channel @ 8 Ω"
                  value={midAmpWatts}
                  min={AMP_WATTS_STEPS.mAmpW.min}
                  max={AMP_WATTS_MAX.mAmpW}
                  step={AMP_WATTS_STEPS.mAmpW.step}
                  unit=" W"
                  onChange={setMidAmpWatts}
                  extra={renderLockButton("mAmpW", "the mid amp power")}
                />
                <Slider
                  label={
                    <Tooltip tip="0 dB asks the mid to match the sub flat out. Bass-heavy music usually carries 6–10 dB less from 200 Hz to 1 kHz than at 40–60 Hz.">
                      Music balance: mid band needs less by
                    </Tooltip>
                  }
                  value={midBandTiltDb}
                  min={0}
                  max={12}
                  step={1}
                  unit=" dB"
                  onChange={setMidBandTiltDb}
                />
              </Card>
            </div>
          </div>
          <div className={tabClass("horn")}>
            <SelectField
              label="Compression driver"
              options={CD_OPTIONS}
              value={compressionDriver}
              onChange={setCompressionDriver}
              extra={renderLockButton("cd", "the compression driver")}
            />
            <SelectField
              label="Horn"
              options={HORN_OPTIONS}
              value={hornOption}
              onChange={setHornOption}
              extra={renderLockButton("horn", "the horn")}
            />
            <Card className="mb-4">
              <Slider
                label="HF amp power per channel @ 8 Ω"
                value={hornAmpWatts}
                min={AMP_WATTS_STEPS.hfAmpW.min}
                max={AMP_WATTS_MAX.hfAmpW}
                step={AMP_WATTS_STEPS.hfAmpW.step}
                unit=" W"
                onChange={setHornAmpWatts}
                extra={renderLockButton("hfAmpW", "the HF amp power")}
              />
              <Slider
                label="Music balance: HF band needs less by"
                value={hornBandTiltDb}
                min={0}
                max={12}
                step={1}
                unit=" dB"
                onChange={setHornBandTiltDb}
              />
            </Card>
            {hornExitMismatch && (
              <div className="text-sm text-red-700 mb-4">
                Horn throat and driver exit don't match ({hornOption.exit}″ vs{" "}
                {compressionDriver.exit}″).
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
