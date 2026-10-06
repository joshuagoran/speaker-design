import { PA_SLIDERS, PA_THROAT_MAX_VSLOT1 } from "../../../constants/paSliders";
import { ToggleButton } from "../../../components/ui/ToggleButton";
import { ToggleGroup } from "../../../components/ui/ToggleGroup";
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
import { HIGHPASS_ALIGNMENTS, isRoundPort, ventSpeedLimit } from "../../../lib/pa/calc";
import { AMP_WATTS_MAX, AMP_WATTS_STEPS } from "../../../lib/pa/optimize";
import { ductFit, ductLenSliderMax } from "../../../lib/pa/chips";
import type { PaPlanner } from "../hooks/usePaPlanner";
import { entriesOf, keysOf } from "../../../lib/records";
import { CrossoverSlopeButtons } from "../../../components/ui/CrossoverSlopeButtons";
import { SettingsColumn, SettingsSection } from "../../../components/ui/SettingsColumn";
import {
  SETTINGS_SHEET_CLASS,
  SettingsSheetTabs,
  settingsSheetBodyClass,
} from "../../../components/ui/SettingsSheetTabs";
import { useFolds } from "../../../hooks/useFolds";
import { formatDims, formatHz } from "../../../lib/format";
import { crossoverSlopeName } from "../../../constants/crossovers";
import { PA_LAYOUT_NAMES } from "../../../constants/paLayouts";
import { PA_SETTINGS_RENAMED, PA_SETTINGS_SECTIONS } from "../../../constants/settingsSections";
import { PA_SETTINGS_TABS } from "../../../constants/paSettingsTabs";
import type { PaSettingsSection } from "../../../constants/settingsSections";
import { SLOT_LAYOUT_NAMES } from "../../../constants/portStyles";
import { UI_TEXT } from "../../../constants/uiText";
import {
  BRACE_STYLE_NAMES,
  BRACE_STYLE_SUMMARY,
  BRACE_STYLE_TIPS,
} from "../../../constants/bracing";
import { defaultBraceStyle } from "../../../lib/bracing";
import { braceNoteLines } from "../../../lib/bracingNotes";
import { PANEL_NOMINAL_NAMES } from "../../../constants/panelSizes";
import { PANEL_NOMINAL_OPTIONS } from "../../../lib/panel";

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
    | "ductDividerPanel"
    | "setDuctDividerPanel"
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
    | "wallPanel"
    | "effectiveBraceStyle"
    | "setBraceStyle"
    | "subBracing"
    | "midBracing"
    | "setWallPanel"
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
    | "subModeled"
    | "effectiveMidBoxDims"
    | "renderLockButton"
    | "renderDimensionLock"
  >;
}

/**
 * Settings: sliders and pickers for the sub, mid-bass, horn, crossovers and amps, and the build. From md up a sticky
 * column of fold sections, each with a one-line summary while folded; a bottom sheet with tabs on phones.
 */
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
    ductDividerPanel,
    setDuctDividerPanel,
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
    wallPanel,
    effectiveBraceStyle,
    setBraceStyle,
    subBracing,
    midBracing,
    setWallPanel,
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
    subModeled,
    effectiveMidBoxDims,
    renderLockButton,
    renderDimensionLock,
  } = planner;
  const folds = useFolds(
    "planner.settingsFolds",
    keysOf(PA_SETTINGS_SECTIONS),
    PA_SETTINGS_RENAMED,
  );
  // the duct lengths that fit: a bottom slot straight, then folded up the back wall; round tubes straight, then with one
  // or two elbows (the lengths between fit neither way, and the slider skips them)
  const ductLens = ductFit(subBoxDims, portStyle, subVentSpec, wallThicknessIn, subDriver);
  const finishName = cabinetFinishOf(cabinetFinish)?.name ?? `painted ${cabinetFinish}`;
  // a note under the Bracing setting wherever a box's bracing departs from the style, naming the box and the panel
  const braceNotes = [
    ...braceNoteLines(PA_SETTINGS_TABS.sub, subBracing),
    ...(midBracing ? braceNoteLines(PA_SETTINGS_TABS.mid, midBracing) : []),
  ];
  const summaries: Record<PaSettingsSection, string> = {
    sub: [
      subDriver.name,
      formatDims(subBoxDims),
      subModeled && `tuned to ${subModeled.mdl.Fb.toFixed(0)} Hz`,
      port.desc,
    ]
      .filter(Boolean)
      .join(", "),
    mid: `${midDriver.name}, ${formatDims(effectiveMidBoxDims)} sealed`,
    horn: `${compressionDriver.name} on ${hornOption.name}`,
    xo: [
      `${formatHz(subMidCrossoverHz)} ${crossoverSlopeName(subMidCrossoverOrder)}`,
      `${formatHz(midHornCrossoverHz)} ${crossoverSlopeName(midHornCrossoverOrder)}`,
      `highpass ${subHighpassHz} Hz`,
      `amps ${subAmpWatts} / ${midAmpWatts} / ${hornAmpWatts} W`,
    ].join(" · "),
    build: `${PA_LAYOUT_NAMES[layout]}, ${finishName}, ${PANEL_NOMINAL_NAMES[wallPanel].short} ply, braced with ${BRACE_STYLE_SUMMARY[effectiveBraceStyle]}`,
  };
  const section = (id: PaSettingsSection, children: React.ReactNode) => (
    <SettingsSection
      id={id}
      title={PA_SETTINGS_SECTIONS[id]}
      folds={folds}
      foldsAt="desktop"
      summary={summaries[id]}
    >
      {children}
    </SettingsSection>
  );
  return (
    <SettingsColumn
      folds={folds}
      foldsAt="desktop"
      className={SETTINGS_SHEET_CLASS}
      bodyClassName={settingsSheetBodyClass(isSettingsSheetOpen)}
      top={
        <SettingsSheetTabs
          tabs={entriesOf(PA_SETTINGS_TABS)}
          open={isSettingsSheetOpen}
          active={activeTab}
          onOpen={(t) => {
            setActiveTab(t);
            setSettingsSheetOpen(true);
          }}
          onClose={() => setSettingsSheetOpen(false)}
        />
      }
    >
      {section(
        "sub",
        <div className={tabClass("sub")}>
          <SelectField
            label="Sub driver"
            options={subDriverChoices}
            value={subDriver}
            onChange={setSubDriver}
            extra={renderLockButton("sub", "the sub driver")}
          />
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
                <>
                  <Slider
                    label="Duct throat"
                    value={subVentSpec.throat}
                    min={PA_SLIDERS.throat.min}
                    max={portStyle === "vslot1" ? PA_THROAT_MAX_VSLOT1 : PA_SLIDERS.throat.max}
                    step={PA_SLIDERS.throat.step}
                    unit="″"
                    onChange={(v) => setSubVentField("throat", v)}
                  />
                  <ToggleGroup
                    label={
                      <Tooltip tip="Two plywood dividers per duct brace the inner wall to the side wall. Thicker dividers make the vent smaller, so it tunes lower. The Cutlist uses the measured thickness.">
                        Dividers
                      </Tooltip>
                    }
                    value={ductDividerPanel}
                    onChange={setDuctDividerPanel}
                    options={PANEL_NOMINAL_OPTIONS}
                  />
                </>
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
                max={ductLenSliderMax(
                  subBoxDims,
                  portStyle,
                  subVentSpec,
                  wallThicknessIn,
                  subDriver,
                )}
                step={PA_SLIDERS.ductLen.step}
                unit="″"
                onChange={(v) => setSubVentField("len", v)}
                // a bottom slot and round tubes skip the lengths that fit no way, and stop at the longest
                ranges={
                  portStyle === "slots" || isRoundPort(portStyle) ? ductLens.spans : undefined
                }
              />
              <Slider
                label="Port velocity limit, sharp edge"
                value={maxPortAirSpeedMs}
                min={12}
                max={30}
                step={0.5}
                unit=" m/s"
                onChange={setMaxPortAirSpeedMs}
              />
              <div className="text-xs text-stone-500">
                {port.desc}. {port.area.toFixed(1)} in&#178;.
                {isRoundPort(portStyle) &&
                  ` Flared tubes run to ${ventSpeedLimit(portStyle, maxPortAirSpeedMs).toFixed(1)} m/s.`}
              </div>
            </Card>
          </div>
        </div>,
      )}
      {section(
        "mid",
        <div className={tabClass("mid")}>
          <ToggleGroup
            label="Mid-bass size"
            value={midSize}
            onChange={setMidSize}
            options={([12, 15] as const).map((n) => [n, `${n}″`] as const)}
            wrap={false}
            className="mb-2"
          />
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
                <div className="text-xs text-stone-500">
                  Tower layout: the mid chamber has the sub's footprint, {subBoxDims.w}″ × 15.5″ ×{" "}
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
            </Card>
          </div>
        </div>,
      )}
      {section(
        "horn",
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
          {hornExitMismatch && (
            <div className="text-sm text-red-700 mb-4">
              Horn throat and driver exit don't match ({hornOption.exit}″ vs{" "}
              {compressionDriver.exit}″).
            </div>
          )}
        </div>,
      )}
      {section(
        "xo",
        <>
          <div className={tabClass("mid")}>
            <div className="mb-5">
              <div className="text-sm text-stone-500 mb-1">Crossovers</div>
              <Card>
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
              </Card>
            </div>
          </div>
          <div className={tabClass("sub")}>
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
            <div className="mb-5">
              <div className="text-sm text-stone-500 mb-1">{UI_TEXT.midBass} amp</div>
              <Card>
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
                    <Tooltip tip="At 0 dB, the mid must match the sub at full power. Bass-heavy music has 6–10 dB less at 200 Hz–1 kHz than at 40–60 Hz.">
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
            <div className="mb-5">
              <div className="text-sm text-stone-500 mb-1">Horn amp</div>
              <Card>
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
            </div>
          </div>
        </>,
      )}
      {section(
        "build",
        <div className={tabClass("build")}>
          <div className="mb-5">
            <ToggleGroup
              label={
                <span className="flex items-center justify-between gap-2">
                  <Tooltip tip="Birch plywood for the sides, top, bottom and back. Thinner walls get more braces. The Cutlist uses the measured thickness.">
                    Plywood (baffles stay ¾″)
                  </Tooltip>
                </span>
              }
              value={wallPanel}
              onChange={setWallPanel}
              options={PANEL_NOMINAL_OPTIONS}
            />
            <div className="mt-3">
              <ToggleGroup
                label="Bracing"
                value={effectiveBraceStyle}
                // the plywood's own default is stored as no choice, so it follows the plywood
                onChange={(v) => setBraceStyle(v === defaultBraceStyle(wallPanel) ? undefined : v)}
                options={keysOf(BRACE_STYLE_NAMES).map(
                  (id) => [id, BRACE_STYLE_NAMES[id], BRACE_STYLE_TIPS[id]] as const,
                )}
              />
              {braceNotes.map((n) => (
                <div key={n} className="text-xs text-stone-500">
                  {n}
                </div>
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
          <SwatchPicker
            label="Cabinet finish"
            value={cabinetFinish}
            onChange={setCabinetFinish}
            swatches={PAINT_SWATCHES}
            presets={CABINET_FINISHES}
            titlePrefix="Painted: "
            note={finishName}
          />
          <SwatchPicker
            label="Baffle color"
            value={baffleColor}
            onChange={setBaffleColor}
            swatches={PAINT_SWATCHES}
            note={baffleColor}
          />
          <ToggleGroup
            label="View"
            value={cutaway}
            onChange={setCutaway}
            options={
              [
                [false, "Finished"],
                [true, "Cutaway"],
              ] as const
            }
            wrap={false}
            className="mb-5"
          />
          <div className="mb-5">
            <ToggleGroup
              label="Layout"
              value={layout}
              onChange={setLayout}
              options={entriesOf(PA_LAYOUT_NAMES)}
            />
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
        </div>,
      )}
    </SettingsColumn>
  );
}
