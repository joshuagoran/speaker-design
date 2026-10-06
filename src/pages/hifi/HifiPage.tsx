import { alpha } from "../../styles/palette";
import { usePalette } from "../../hooks/useTheme";
import { CrossoverSlopeButtons } from "../../components/ui/CrossoverSlopeButtons";
import { WarningChips } from "../../components/chips/WarningChips";
import { StatTile } from "../../components/stats/StatTile";
import { STATS, statLabel, type StatName } from "../../components/optimizer/StatRow";
import {
  HIFI_WOOFERS_BY_SIZE,
  HIFI_PASSIVES_BY_SIZE,
  tweeterKind,
  TWEETER_GROUP_LABELS,
  TWEETER_KIND_LABELS,
  HIFI_TWEETERS_BY_TYPE,
} from "./hifiDriverLists";
import { HifiResultCard } from "./HifiResultCard";
import { ToggleButton } from "../../components/ui/ToggleButton";
import { ToggleGroup } from "../../components/ui/ToggleGroup";
import { DispersionPlaneToggle } from "../../components/ui/DispersionPlaneToggle";
import { dispersionPlaneName } from "../../constants/dispersionPlanes";
import { Button } from "../../components/ui/Button";
import { Tooltip } from "../../components/ui/Tooltip";
import { Card } from "../../components/ui/Card";
import { SectionHeading } from "../../components/ui/SectionHeading";
import { NumberField } from "../../components/ui/NumberField";
import { SelectField } from "../../components/ui/SelectField";
import { Slider } from "../../components/ui/Slider";
import { Notice } from "../../components/ui/Notice";
import { DetailsDropdown } from "../../components/ui/DetailsDropdown";
import { ResponseChart } from "../../components/charts/ResponseChart";
import { DispersionMap } from "../../components/charts/DispersionMap";
import { RoomView } from "../../components/drawings/RoomView";
import { HifiFront } from "../../components/drawings/HifiFront";
import { OptimizerBar } from "../../components/optimizer/OptimizerBar";
import { HIFI_OPTIMIZER_PANEL, optimizerPanelNote } from "../../constants/optimizerPanels";
import { GoalPicker } from "../../components/optimizer/GoalPicker";
import { KeepDetails } from "../../components/optimizer/KeepDetails";
import { RunRow } from "../../components/optimizer/RunRow";
import { ResultCards } from "../../components/optimizer/ResultCards";
import { SavedConfigs } from "../../components/saved-configs/SavedConfigs";
import { HIFI_TOP, HIFI_BOT } from "../../constants/chartScales";
import { passiveRadiatorMassMax } from "../../lib/data";
import {
  SPEAKER_PLACEMENTS as HIFI_PLACES,
  hifiPanelResonances,
  tweeterOffset,
  tweeterOffsetMax,
} from "../../lib/hifi/hifi";
import { PanelResonanceTable } from "../../components/stats/PanelResonanceTable";
import { roundoverOnsetHz } from "../../lib/hifi/diffraction";
import { formatDims, formatHz, formatInches } from "../../lib/format";
import { crossoverSlopeName } from "../../constants/crossovers";
import { PANEL_NOMINAL_NAMES } from "../../constants/panelSizes";
import { PANEL_NOMINAL_OPTIONS, formatThickness } from "../../lib/panel";
import { SettingsColumn, SettingsSection } from "../../components/ui/SettingsColumn";
import { useFolds } from "../../hooks/useFolds";
import { HIFI_SETTINGS_SECTIONS } from "../../constants/settingsSections";
import type { HifiSettingsSection } from "../../constants/settingsSections";
import {
  HIFI_AMP_WATTS_MAX,
  HIFI_AMP_WATTS_STEPS,
  HIFI_OPTIMIZER_GOALS,
} from "../../lib/hifi/optimize";
import { HIFI_KEEP_WORDS, keepLines } from "../../lib/optimizer/goalKeeps";
import { OPTIMIZER_PANEL_TEXT } from "../../constants/optimizerText";
import type { HifiPlanner } from "./useHifiPlanner";
import type { Dims3 } from "../../types";
import { entriesOf, keysOf } from "../../lib/records";
import { xmaxRows } from "../../lib/xmax";
import {
  PAGE_WIDTH,
  RESULT_MAX_WIDTH,
  RESULTS_TWO_COLUMN_PX,
  resultsCellClass,
  resultsGridClass,
} from "../../styles/layout";
import { useWidthAtLeast } from "../../hooks/useElementWidth";
import { SettingsLayout } from "../../components/ui/SettingsLayout";
import { UI_TEXT } from "../../constants/uiText";
import { HIFI_RESULT_HEADINGS } from "../../constants/hifiResults";

interface Props {
  hifi: HifiPlanner;
}

/** The roundover radii on offer, inches (0: sharp edges); a router bit's usual sizes. */
const ROUNDOVER_CHOICES = [0, 0.5, 0.75, 1, 1.5, 2] as const;

/** The panel materials on offer: the material id and the button's label. */
const MATERIAL_CHOICES = [
  ["ply", "Birch ply"],
  ["mdf", "MDF"],
] as const;

/** The Ports row's choices: the button's label, the box type, the port or radiator count (or a slot), and its tip. */
const PORT_CHOICES = [
  ["Sealed", "sealed", 0, "Sealed"],
  ["1 port", "vented", 1, "One round port"],
  ["2 ports", "vented", 2, "Two round ports"],
  ["Slot", "vented", "slot", "Slot vent along the bottom of the baffle"],
  ["1 PR", "radiator", 1, "One passive radiator"],
  ["2 PR", "radiator", 2, "Two passive radiators"],
] as const;

/**
 * Hi-fi page: 2-way home speakers with an active crossover. When the results pane is wide enough the results take two
 * columns with aligned rows (summary | warnings, Response | Max output, Dispersion | Seat position), Details below;
 * narrower, one column in reading order.
 */
export function HifiPage({ hifi }: Props) {
  const pal = usePalette();
  // measured on the results, not the viewport: the settings column's width is draggable
  const [resultsGrid, wide] = useWidthAtLeast(RESULTS_TWO_COLUMN_PX);
  const cell = (place: string) => resultsCellClass(wide, place);
  const {
    woofer,
    setWoofer,
    tweeter,
    setTweeter,
    selectedWaveguide,
    setSelectedWaveguide,
    boxType,
    setBoxType,
    boxDims,
    setBoxDims,
    wallThicknessIn,
    wallPanel,
    setWallPanel,
    panelMaterial,
    setPanelMaterial,
    portSpec,
    setPortSpec,
    togglePort,
    setRadiatorSelection,
    crossoverHz,
    setCrossoverHz,
    crossoverOrder,
    setCrossoverOrder,
    wooferAmpWatts,
    setWooferAmpWatts,
    tweeterAmpWatts,
    setTweeterAmpWatts,
    baffleStepCompensationDb,
    setBaffleStepCompensationDb,
    placement,
    setPlacement,
    distanceToWallFt,
    setDistanceToWallFt,
    speakerSpacingFt,
    setSpeakerSpacingFt,
    toeInDeg,
    setToeInDeg,
    listeningSeat,
    setListeningSeat,
    earHeightIn,
    setEarHeightIn,
    standHeightIn,
    setStandHeightIn,
    dispersionPlane,
    setDispersionPlane,
    roundoverIn,
    setRoundoverIn,
    tweeterOffsetIn,
    setTweeterOffsetIn,
    speakerConfig,
    isOptimizerOn,
    optimizerGoals,
    toggleOptimizerGoal,
    optimizerBudget,
    setOptimizerBudget,
    renderLockButton,
    renderDimensionLock,
    lockBar,
    optimizerResult,
    isOptimizing,
    optimizerError,
    optimizerProgress,
    cancelOptimizerSearch,
    designPreview,
    undoSnapshot,
    setIsOptimizerOn,
    runOptimizerSearch,
    previewOptimizerResult,
    exitPreview,
    loadOptimizerResult,
    undoOptimizerLoad,
    waveguideChoices,
    store,
    savedConfigSnapshot,
    restoreSavedConfig,
    waveguideSpec,
    radiatorDriver,
    radiator,
    tweeterWithWaveguide,
    leftGeometry,
    rightGeometry,
    seatDistanceFt,
    pairCostUsd,
    speakerModel,
  } = hifi;
  const folds = useFolds("hifi.settingsFolds", keysOf(HIFI_SETTINGS_SECTIONS));
  const setBoxDim = (k: keyof Dims3, v: number) => setBoxDims((p) => ({ ...p, [k]: v }));
  const setPortField = (k: "h" | "dia" | "len", v: number) =>
    setPortSpec((p) => ({ ...p, [k]: v }));
  if (!speakerModel)
    return (
      <main className={`${PAGE_WIDTH} pb-16 text-sm`}>
        Cannot model this woofer: no published parameters.
      </main>
    );
  const {
    speakerSystem,
    warningChips,
    maxLevelAtSeatDb,
    onAxisResponse,
    pairResponse,
    tweeterMaxCurve,
    dispersion,
    edgeRippleDb,
  } = speakerModel;
  // the offset the model uses (kept on the baffle), and where a roundover starts to work
  const tweeterOffsetUsed = tweeterOffset(speakerConfig, tweeterWithWaveguide, speakerSystem.lay);
  const roundoverOnset = roundoverOnsetHz(roundoverIn);
  const roundoverTooDeep = roundoverIn > wallThicknessIn + 1e-9;
  const slotWidthNote =
    speakerSystem.kind === "vented" && speakerSystem.slotW != null
      ? ` (${speakerSystem.slotW.toFixed(1)}″ wide)`
      : "";
  const slotOn = portSpec.shape === "slot";
  const isPortChoiceOn = ([, v, n]: (typeof PORT_CHOICES)[number]) =>
    boxType === v &&
    (v === "sealed" ||
      (v === "vented" ? (n === "slot" ? slotOn : !slotOn && portSpec.n === n) : radiator.n === n));
  const edgesText = roundoverIn ? `${formatInches(roundoverIn)} roundover` : "sharp edges";
  const summaries: Record<HifiSettingsSection, string> = {
    drivers: [
      woofer.name,
      tweeter.name,
      waveguideSpec && !tweeter.ownGuide && selectedWaveguide.name,
    ]
      .filter(Boolean)
      .join(", "),
    box: [
      formatDims(boxDims),
      `${speakerSystem.gross.toFixed(1)} L`,
      PORT_CHOICES.find(isPortChoiceOn)?.[3].toLowerCase(),
      `${PANEL_NOMINAL_NAMES[wallPanel].short} ${MATERIAL_CHOICES.find(([v]) => v === panelMaterial)?.[1]}`,
      edgesText,
    ]
      .filter(Boolean)
      .join(", "),
    xo: [
      `${formatHz(crossoverHz)} ${crossoverSlopeName(crossoverOrder)}`,
      `baffle step +${baffleStepCompensationDb} dB`,
      `amps ${wooferAmpWatts} / ${tweeterAmpWatts} W`,
    ].join(" · "),
    room: `${HIFI_PLACES[placement].name}, ${speakerSpacingFt} ft apart, toe-in ${toeInDeg}°`,
  };
  const section = (id: HifiSettingsSection, children: React.ReactNode) => (
    <SettingsSection
      id={id}
      title={HIFI_SETTINGS_SECTIONS[id]}
      folds={folds}
      summary={summaries[id]}
    >
      {children}
    </SettingsSection>
  );
  const tile = (k: StatName, v: string, u: string) => (
    <StatTile key={statLabel(k)} label={k} value={v} unit={u} />
  );
  const optimizerBar = (
    <OptimizerBar
      on={isOptimizerOn}
      onToggle={() => setIsOptimizerOn(!isOptimizerOn)}
      hint="Find cheaper, lighter, deeper or louder designs."
      note={wallPanel !== HIFI_OPTIMIZER_PANEL && optimizerPanelNote(HIFI_OPTIMIZER_PANEL)}
      {...lockBar}
    />
  );
  const optimizerPanel = isOptimizerOn && (
    <Card pad="lg" className="mt-3">
      <SectionHeading>{OPTIMIZER_PANEL_TEXT.heading}</SectionHeading>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
        <div className="mt-3">
          <NumberField
            label={
              <>
                Driver budget, pair{" "}
                <span className="text-xs">
                  (woofers + tweeters{waveguideSpec ? " + waveguides" : ""}, at the listed prices)
                </span>
              </>
            }
            value={optimizerBudget}
            min={50}
            step={25}
            unit="$"
            onChange={setOptimizerBudget}
            className=""
          />
        </div>
        <GoalPicker
          defs={HIFI_OPTIMIZER_GOALS}
          selected={optimizerGoals}
          onTap={toggleOptimizerGoal}
        />
        <KeepDetails
          lines={keepLines(
            optimizerGoals,
            HIFI_OPTIMIZER_GOALS,
            HIFI_KEEP_WORDS,
            // the page models your design; the optimizer may still not (a radiator missing from the tables)
            !optimizerResult || optimizerResult.cur !== null,
          )}
        />
      </div>
      <RunRow
        busy={isOptimizing}
        hasGoal={optimizerGoals.length > 0}
        onRun={runOptimizerSearch}
        onCancel={cancelOptimizerSearch}
        progress={optimizerProgress}
        stats={optimizerResult && optimizerResult.stats}
        note={optimizerResult && optimizerResult.cards.length ? OPTIMIZER_PANEL_TEXT.cardsPass : ""}
      >
        {undoSnapshot && !designPreview && (
          <Button size="md" onClick={undoOptimizerLoad}>
            Undo load
          </Button>
        )}
      </RunRow>
      {optimizerError && !isOptimizing && <Notice>{optimizerError}</Notice>}
      {optimizerResult && !isOptimizing && optimizerResult.curProblems.length > 0 && (
        <Notice>
          Your design fails: {optimizerResult.curProblems.join("; ")}. Fixes may cost or weigh more.
        </Notice>
      )}
      {optimizerResult && !isOptimizing && (
        <ResultCards
          cards={optimizerResult.cards}
          render={(k, i) => (
            <HifiResultCard
              key={i}
              result={k}
              index={i}
              total={optimizerResult.cards.length}
              currentCurve={optimizerResult.curCurve}
              waveguide={waveguideSpec}
              previewing={designPreview && designPreview.card === k}
              onPreview={() => previewOptimizerResult(k)}
              onLoad={() => loadOptimizerResult(k)}
            />
          )}
        />
      )}
      {optimizerResult && !isOptimizing && optimizerResult.goalMissing && (
        <Notice>{optimizerResult.goalMissing}</Notice>
      )}
      {optimizerResult &&
        !isOptimizing &&
        !optimizerResult.cards.length &&
        !optimizerResult.goalMissing && (
          <div className="mt-3 text-sm text-orange-900">
            {OPTIMIZER_PANEL_TEXT.noFit}. Raise the budget or remove locks.
          </div>
        )}
    </Card>
  );
  return (
    <SettingsLayout
      results={
        <>
          <div className={`${RESULT_MAX_WIDTH} min-w-0 mb-8`}>
            <SavedConfigs
              bare
              store={store}
              snapshot={savedConfigSnapshot}
              restore={restoreSavedConfig}
            />
            {optimizerBar}
            {optimizerPanel}
            {designPreview && (
              <div className="mt-3 flex flex-wrap items-center gap-2 rounded bg-stone-900 text-stone-50 border-t-4 border-cmy-y px-3 py-2 text-sm font-semibold">
                <span className="flex-1">Previewing “{designPreview.label}”</span>
                <button
                  onClick={() => loadOptimizerResult(designPreview.card)}
                  className="px-3 py-1.5 rounded border border-stone-900 bg-panel text-stone-900"
                >
                  Keep
                </button>
                <button
                  onClick={exitPreview}
                  className="px-3 py-1.5 rounded border border-stone-900 bg-panel text-stone-900"
                >
                  Back
                </button>
              </div>
            )}
          </div>
          <div className="min-w-0 flex flex-col gap-8">
            <div ref={resultsGrid} className={resultsGridClass(wide)}>
              <div className={cell("col-start-1 row-start-1")}>
                <div className={`${RESULT_MAX_WIDTH} flex gap-4 items-center`}>
                  <div className="shrink-0">
                    <HifiFront
                      dim={boxDims}
                      w={woofer}
                      t={tweeterWithWaveguide}
                      lay={speakerSystem.lay}
                      vented={speakerSystem.kind === "vented"}
                      port={portSpec}
                      pr={speakerSystem.kind === "radiator" ? radiator : null}
                      guide={waveguideSpec}
                      roundoverIn={roundoverIn}
                      tweeterOffsetIn={tweeterOffsetUsed}
                    />
                  </div>
                  <div className="flex-1 min-w-0 grid gap-px rounded-lg overflow-hidden border border-stone-300 bg-stone-300 grid-cols-2 sm:grid-cols-3 [&>*:last-child:nth-child(odd)]:col-span-2 sm:[&>*:last-child:nth-child(odd)]:col-span-1">
                    {tile(STATS.netVolume, speakerSystem.net.toFixed(1), "L")}
                    {speakerSystem.kind === "sealed"
                      ? tile(STATS.qtc, speakerSystem.Qtc.toFixed(2), "")
                      : tile(STATS.tuningFb, speakerSystem.Fb.toFixed(0), "Hz")}
                    {tile(STATS.f3InRoom, speakerSystem.f3.toFixed(0), "Hz")}
                    {tile(STATS.maxAtSeat, maxLevelAtSeatDb.toFixed(0), "dB")}
                    {tile("Weight", speakerSystem.lb.toFixed(0), "lb")}
                    {tile(STATS.pairPrice, `$${Math.round(pairCostUsd)}`, "")}
                  </div>
                </div>
              </div>
              <div className={cell("col-start-2 row-start-1")}>
                <WarningChips chips={warningChips} />
              </div>
              <section className={cell("col-start-1 row-start-2")}>
                <SectionHeading className="mb-3">{HIFI_RESULT_HEADINGS.response}</SectionHeading>
                <ResponseChart
                  fmin={15}
                  fmax={20000}
                  top={HIFI_TOP}
                  bot={HIFI_BOT}
                  step={10}
                  yLabel="dB SPL at 2.83 V"
                  series={[
                    {
                      curve: onAxisResponse,
                      label: "On axis, 1 m",
                      stroke: pal.ink,
                      tint: alpha(pal.ink, 0),
                    },
                    {
                      curve: pairResponse,
                      label: `Pair at the seat (${seatDistanceFt.toFixed(1)} ft)`,
                      stroke: pal.cyan,
                      tint: alpha(pal.cyan, 0.06),
                    },
                  ]}
                  marks={[
                    { f: crossoverHz, label: "XO" },
                    { f: speakerSystem.bsF3, label: "Baffle step" },
                    ...(speakerSystem.Fb ? [{ f: speakerSystem.Fb, label: "Fb" }] : []),
                  ]}
                />
              </section>
              <section className={cell("col-start-2 row-start-2")}>
                <SectionHeading className="mb-3">{HIFI_RESULT_HEADINGS.maxOutput}</SectionHeading>
                <ResponseChart
                  fmin={15}
                  fmax={20000}
                  top={HIFI_TOP}
                  bot={HIFI_BOT}
                  step={10}
                  series={[
                    {
                      curve: speakerSystem.wMax,
                      band: speakerSystem.wMaxBand,
                      label: woofer.name,
                      stroke: pal.magenta,
                      tint: alpha(pal.magenta, 0.06),
                    },
                    {
                      curve: tweeterMaxCurve,
                      label: tweeter.name,
                      stroke: pal.cyan,
                      tint: alpha(pal.cyan, 0.06),
                    },
                  ]}
                  marks={[{ f: crossoverHz, label: "XO" }]}
                />
              </section>
              {/* beside the dispersion map, the map sets the row's height and the room view fills the rest */}
              <section className={cell("col-start-2 row-start-3 self-stretch flex flex-col")}>
                <SectionHeading className="mb-3">{HIFI_RESULT_HEADINGS.seat}</SectionHeading>
                <div
                  className={
                    wide
                      ? "flex-1 flex gap-4 items-start"
                      : `${RESULT_MAX_WIDTH} grid grid-cols-1 sm:grid-cols-2 gap-4 items-start`
                  }
                >
                  <div className={wide ? "relative flex-1 self-stretch min-h-[280px]" : undefined}>
                    <RoomView
                      spacing={speakerSpacingFt}
                      toe={toeInDeg}
                      seat={listeningSeat}
                      setSeat={setListeningSeat}
                      className={wide ? "absolute inset-0 w-full h-full" : undefined}
                      angles={[
                        (leftGeometry.th * 180) / Math.PI,
                        (rightGeometry.th * 180) / Math.PI,
                      ]}
                    />
                  </div>
                  <div
                    className={`text-sm text-stone-500 leading-relaxed ${wide ? "w-48 shrink-0" : ""}`}
                  >
                    <div>{seatDistanceFt.toFixed(1)} ft from the pair</div>
                    <div>
                      Off axis: L {((leftGeometry.th * 180) / Math.PI).toFixed(0)}°, R{" "}
                      {((rightGeometry.th * 180) / Math.PI).toFixed(0)}°
                    </div>
                    <div>
                      Ears{" "}
                      {earHeightIn - standHeightIn - speakerSystem.lay.tweeterIn >= 0
                        ? "above"
                        : "below"}{" "}
                      tweeter{" "}
                      {Math.abs(earHeightIn - standHeightIn - speakerSystem.lay.tweeterIn).toFixed(
                        1,
                      )}
                      ″
                    </div>
                    <div>
                      <Tooltip
                        tip={`Clean up to about ${maxLevelAtSeatDb.toFixed(0)} dB at the seat with both speakers playing.`}
                      >
                        Max level
                      </Tooltip>{" "}
                      {maxLevelAtSeatDb.toFixed(0)} dB
                    </div>
                  </div>
                </div>
              </section>
              <section className={`${RESULT_MAX_WIDTH} ${cell("col-start-1 row-start-3")}`}>
                <SectionHeading className="mb-3">{HIFI_RESULT_HEADINGS.dispersion}</SectionHeading>
                <DispersionPlaneToggle value={dispersionPlane} onChange={setDispersionPlane} />
                <DispersionMap
                  map={dispersion}
                  title={
                    dispersionPlane === "h"
                      ? `${dispersionPlaneName("h")} dispersion, one speaker: outside (−) to inside (+), 0° on axis`
                      : `${dispersionPlaneName("v")} dispersion: below (−) to above (+) the tweeter axis`
                  }
                />
              </section>
            </div>
            <DetailsDropdown summary={UI_TEXT.details}>
              <div>
                Woofer {speakerSystem.lay.wooferIn.toFixed(1)}″ and tweeter{" "}
                {speakerSystem.lay.tweeterIn.toFixed(1)}″ from the bottom,{" "}
                {speakerSystem.lay.spacingIn.toFixed(1)}″ apart. {speakerSystem.gross.toFixed(1)} L
                gross, {speakerSystem.net.toFixed(1)} L net
                {speakerSystem.hpf
                  ? `; DSP highpass ${speakerSystem.hpf} Hz (BW24) below the port tuning`
                  : ""}
                .
              </div>
              <div>
                Tweeter trimmed {speakerSystem.trim.toFixed(1)} dB in the DSP to match the woofer;
                baffle step centered at {speakerSystem.bsF3.toFixed(0)} Hz
                {baffleStepCompensationDb ? `, ${baffleStepCompensationDb} dB boost` : ""}.
              </div>
              <div>
                Edge diffraction: ±{edgeRippleDb.toFixed(1)} dB of ripple from 1 to 5 kHz on axis (
                {edgesText}, tweeter{" "}
                {tweeterOffsetUsed
                  ? `${formatInches(Math.abs(tweeterOffsetUsed))} ${tweeterOffsetUsed > 0 ? "inward" : "outward"} of center`
                  : "centered"}
                ), in the responses and the dispersion map.
              </div>
              <div>
                <Tooltip tip={woofer.note}>
                  <span className="font-medium text-stone-900">{woofer.name}</span>
                </Tooltip>
                {xmaxRows(woofer.ts).map(([k, v, note, tip]) => (
                  <span key={k}>
                    {" · "}
                    <Tooltip tip={tip}>{k}</Tooltip> {v} ({note})
                  </span>
                ))}
              </div>
              <div>
                <Tooltip tip={tweeter.note}>
                  <span className="font-medium text-stone-900">{tweeter.name}</span>
                </Tooltip>
              </div>
              {waveguideSpec && !tweeter.ownGuide && (
                <div>
                  <Tooltip tip={selectedWaveguide.note}>
                    <span className="font-medium text-stone-900">{waveguideSpec.name}</span>
                  </Tooltip>
                </div>
              )}
              <div>
                <span className="font-medium text-stone-900">Panels.</span> Each panel&rsquo;s first
                resonance as a thin plate simply supported at its edges (glued edges are stiffer, so
                this reads low). The woofer plays through these up to the crossover, so there is no
                bracing rule here as on the PA boxes; a brace across the largest panels lifts them.
                <PanelResonanceTable
                  caption="First resonance, unbraced"
                  panels={hifiPanelResonances(boxDims, wallThicknessIn, panelMaterial)}
                  braced={false}
                />
              </div>
            </DetailsDropdown>
          </div>
        </>
      }
      settings={
        <SettingsColumn folds={folds}>
          {section(
            "drivers",
            <>
              <SelectField
                label={`Woofer · ${woofer.size}″`}
                options={HIFI_WOOFERS_BY_SIZE}
                value={woofer}
                onChange={setWoofer}
                extra={renderLockButton("woofer", "the woofer")}
                group={(o) => `${o.size}″ woofers`}
              />
              <SelectField
                label={`Tweeter · ${TWEETER_KIND_LABELS[tweeterKind(tweeter)]}`}
                options={HIFI_TWEETERS_BY_TYPE}
                value={tweeter}
                onChange={setTweeter}
                extra={renderLockButton("tweeter", "the tweeter")}
                group={(o) => TWEETER_GROUP_LABELS[tweeterKind(o)]}
              />
              {waveguideSpec && !tweeter.ownGuide && (
                <SelectField
                  label="Waveguide"
                  options={waveguideChoices}
                  value={selectedWaveguide}
                  onChange={setSelectedWaveguide}
                />
              )}
            </>,
          )}
          {section(
            "box",
            <>
              <div className="grid grid-cols-[5.5rem_1fr] items-center gap-x-2 gap-y-2 mb-3 text-sm">
                <span className="text-stone-500">Material</span>
                <ToggleGroup
                  value={panelMaterial}
                  onChange={setPanelMaterial}
                  options={MATERIAL_CHOICES}
                />
                <span className="text-stone-500">Thickness</span>
                <ToggleGroup
                  value={wallPanel}
                  onChange={setWallPanel}
                  options={PANEL_NOMINAL_OPTIONS}
                />
              </div>
              <Card className="mb-4">
                <Slider
                  label="Width"
                  value={boxDims.w}
                  min={6}
                  max={16}
                  step={0.25}
                  unit="″"
                  onChange={(v) => setBoxDim("w", v)}
                  extra={renderDimensionLock("dim", "w", "Width")}
                />
                <Slider
                  label="Height"
                  value={boxDims.h}
                  min={9}
                  max={44}
                  step={0.25}
                  unit="″"
                  onChange={(v) => setBoxDim("h", v)}
                  extra={renderDimensionLock("dim", "h", "Height")}
                />
                <Slider
                  label="Depth"
                  value={boxDims.d}
                  min={6}
                  max={16}
                  step={0.25}
                  unit="″"
                  onChange={(v) => setBoxDim("d", v)}
                  extra={renderDimensionLock("dim", "d", "Depth")}
                />
                <div className="flex items-center justify-between gap-2 mb-1 mt-1">
                  <span className="text-sm text-stone-500">Ports</span>
                  {renderLockButton("box", "sealed, ported or radiator")}
                </div>
                <div className="grid grid-cols-3 gap-1 mb-3">
                  {PORT_CHOICES.map((choice) => {
                    const [l, v, n, tip] = choice;
                    const on = isPortChoiceOn(choice);
                    return (
                      <ToggleButton
                        key={l}
                        size="xs"
                        className="min-w-0 whitespace-nowrap"
                        title={tip}
                        aria-label={tip}
                        on={on}
                        onClick={() => {
                          setBoxType(v);
                          if (v === "vented") togglePort(n);
                          if (v === "radiator") setRadiatorSelection((p) => ({ ...p, n }));
                        }}
                      >
                        {l}
                      </ToggleButton>
                    );
                  })}
                </div>
                {boxType === "vented" && (
                  <>
                    {portSpec.shape === "slot" ? (
                      <Slider
                        label={`Slot height${slotWidthNote}`}
                        value={portSpec.h}
                        min={0.5}
                        max={3}
                        step={0.125}
                        unit="″"
                        onChange={(v) => setPortField("h", v)}
                      />
                    ) : (
                      <Slider
                        label="Port diameter"
                        value={portSpec.dia}
                        min={1}
                        max={4}
                        step={0.25}
                        unit="″"
                        onChange={(v) => setPortField("dia", v)}
                      />
                    )}
                    <Slider
                      label={portSpec.shape === "slot" ? "Slot length" : "Port length (centerline)"}
                      value={portSpec.len}
                      min={1}
                      max={30}
                      step={0.25}
                      unit="″"
                      onChange={(v) => setPortField("len", v)}
                    />
                  </>
                )}
                {boxType === "radiator" && (
                  <>
                    <SelectField
                      label={`Passive radiator · ${radiatorDriver.shape ? "5 × 8″ oval" : `${radiatorDriver.size}″`}`}
                      options={HIFI_PASSIVES_BY_SIZE}
                      value={radiatorDriver}
                      onChange={(o) =>
                        setRadiatorSelection((p) => ({
                          ...p,
                          id: o.id,
                          addG: Math.min(p.addG, passiveRadiatorMassMax(o)),
                        }))
                      }
                      group={(o) => (o.shape ? "Oval radiators" : `${o.size}″ radiators`)}
                    />
                    <Slider
                      label="Added mass, each"
                      value={radiator.addG}
                      min={0}
                      max={passiveRadiatorMassMax(radiatorDriver)}
                      step={5}
                      unit=" g"
                      onChange={(v) => setRadiatorSelection((p) => ({ ...p, addG: v }))}
                    />
                  </>
                )}
                <div className="text-xs text-stone-500">
                  {speakerSystem.gross.toFixed(1)} L gross
                  {speakerSystem.kind === "vented"
                    ? `, ${speakerSystem.pArea.toFixed(1)} in² of ${speakerSystem.slotW != null ? "slot" : "port"}`
                    : speakerSystem.kind === "radiator"
                      ? `; radiators on the back tune it to ${speakerSystem.Fb.toFixed(0)} Hz, with a notch at ${speakerSystem.Fp.toFixed(0)} Hz (their resonance)${radiatorDriver.pub.Xmax == null ? `. Travel limit: the ${radiatorDriver.Xmax} mm mechanical one (no linear value published)` : ""}`
                      : ", lightly stuffed"}
                  .
                </div>
              </Card>
              <Card className="mb-4">
                <div className="text-sm text-stone-500 mb-1">Edge roundover</div>
                <div className="grid grid-cols-6 gap-1 mb-3">
                  {ROUNDOVER_CHOICES.map((r) => (
                    <ToggleButton
                      key={r}
                      size="xs"
                      className="min-w-0 whitespace-nowrap"
                      title={
                        r
                          ? `${formatInches(r)} roundover on the baffle edges`
                          : "Sharp baffle edges"
                      }
                      on={roundoverIn === r}
                      onClick={() => setRoundoverIn(r)}
                    >
                      {r ? formatInches(r) : "Sharp"}
                    </ToggleButton>
                  ))}
                </div>
                <Slider
                  label="Tweeter offset (+ inward)"
                  value={tweeterOffsetIn}
                  min={-3}
                  max={3}
                  step={0.25}
                  unit="″"
                  onChange={setTweeterOffsetIn}
                />
                <div className="text-xs text-stone-500 leading-relaxed">
                  Edges ripple the response ±{edgeRippleDb.toFixed(1)} dB from 1 to 5 kHz on axis.{" "}
                  {roundoverIn
                    ? `The roundover reduces it above ${(roundoverOnset / 1000).toFixed(1)} kHz`
                    : "A roundover reduces it (1½″ works above 2 kHz)"}
                  . An off-center tweeter spreads the ripple. The pair is mirror-imaged
                  {speakerSystem.lay.onTop
                    ? " (the waveguide on top stays centered)"
                    : `, at most ${tweeterOffsetMax(speakerConfig, tweeterWithWaveguide).toFixed(2)}″ either way on this baffle`}
                  .
                  {roundoverTooDeep && (
                    <span className="text-orange-900">
                      {" "}
                      {formatInches(roundoverIn)} is more than the{" "}
                      {formatThickness(wallThicknessIn)} panel. Double the baffle or add hardwood
                      edge strips.
                    </span>
                  )}
                </div>
              </Card>
            </>,
          )}
          {section(
            "xo",
            <>
              <Card className="mb-4">
                <Slider
                  label="Crossover"
                  value={crossoverHz}
                  min={800}
                  max={4000}
                  step={50}
                  unit=" Hz"
                  onChange={setCrossoverHz}
                  extra={renderLockButton("xo", "the crossover")}
                />
                <CrossoverSlopeButtons
                  order={crossoverOrder}
                  onChange={setCrossoverOrder}
                  label="Crossover slope"
                />
                <Slider
                  label="Baffle-step boost"
                  value={baffleStepCompensationDb}
                  min={0}
                  max={6}
                  step={0.5}
                  unit=" dB"
                  onChange={setBaffleStepCompensationDb}
                />
                <Slider
                  label="Woofer amp @ 8 Ω"
                  value={wooferAmpWatts}
                  min={HIFI_AMP_WATTS_STEPS.wAmpW.min}
                  max={HIFI_AMP_WATTS_MAX.wAmpW}
                  step={HIFI_AMP_WATTS_STEPS.wAmpW.step}
                  unit=" W"
                  onChange={setWooferAmpWatts}
                  extra={renderLockButton("wAmpW", "the woofer amp power")}
                />
                <Slider
                  label="Tweeter amp @ 8 Ω"
                  value={tweeterAmpWatts}
                  min={HIFI_AMP_WATTS_STEPS.tAmpW.min}
                  max={HIFI_AMP_WATTS_MAX.tAmpW}
                  step={HIFI_AMP_WATTS_STEPS.tAmpW.step}
                  unit=" W"
                  onChange={setTweeterAmpWatts}
                  extra={renderLockButton("tAmpW", "the tweeter amp power")}
                />
              </Card>
            </>,
          )}
          {section(
            "room",
            <>
              <Card className="mb-4">
                <ToggleGroup
                  label="Placement"
                  value={placement}
                  onChange={setPlacement}
                  options={entriesOf(HIFI_PLACES).map(([k, p]) => [k, p.name] as const)}
                  className="mb-3"
                />
                {placement !== "free" && (
                  <Slider
                    label="Distance to the wall"
                    value={distanceToWallFt}
                    min={0.5}
                    max={6}
                    step={0.25}
                    unit=" ft"
                    onChange={setDistanceToWallFt}
                  />
                )}
                <Slider
                  label="Speaker spacing"
                  value={speakerSpacingFt}
                  min={3}
                  max={14}
                  step={0.5}
                  unit=" ft"
                  onChange={setSpeakerSpacingFt}
                />
                <Slider
                  label="Toe-in"
                  value={toeInDeg}
                  min={0}
                  max={35}
                  step={1}
                  unit="°"
                  onChange={setToeInDeg}
                />
                <Slider
                  label="Box bottom height (stand)"
                  value={standHeightIn}
                  min={0}
                  max={40}
                  step={1}
                  unit="″"
                  onChange={setStandHeightIn}
                />
                <Slider
                  label="Ear height"
                  value={earHeightIn}
                  min={24}
                  max={60}
                  step={1}
                  unit="″"
                  onChange={setEarHeightIn}
                />
              </Card>
            </>,
          )}
        </SettingsColumn>
      }
    />
  );
}
