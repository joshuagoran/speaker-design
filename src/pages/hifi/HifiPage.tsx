import { PAL } from "../../styles/palette";
import { WarningChips } from "../../components/chips/WarningChips";
import { StatTile } from "../../components/stats/StatTile";
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
import { Button } from "../../components/ui/Button";
import { Tooltip } from "../../components/ui/Tooltip";
import { Card } from "../../components/ui/Card";
import { SectionHeading } from "../../components/ui/SectionHeading";
import { NumberField } from "../../components/ui/NumberField";
import { SelectField } from "../../components/ui/SelectField";
import { Slider } from "../../components/ui/Slider";
import { Notice } from "../../components/ui/Notice";
import { ResponseChart } from "../../components/charts/ResponseChart";
import { DispersionMap } from "../../components/charts/DispersionMap";
import { RoomView } from "../../components/drawings/RoomView";
import { HifiFront } from "../../components/drawings/HifiFront";
import { LockButton } from "../../components/lock/LockButton";
import { DimensionLock } from "../../components/lock/DimensionLock";
import { OptimizerBar } from "../../components/optimizer/OptimizerBar";
import { GoalPicker } from "../../components/optimizer/GoalPicker";
import { RunRow } from "../../components/optimizer/RunRow";
import { ResultCards } from "../../components/optimizer/ResultCards";
import { SavedConfigs } from "../../components/saved-configs/SavedConfigs";
import { HIFI_TOP, HIFI_BOT } from "../../constants/chartScales";
import { METERS_PER_FOOT } from "../../constants/units";
import {
  HIFI_WOOFERS,
  HIFI_TWEETERS,
  HIFI_PASSIVES,
  passiveRadiatorMassMax,
  ownGuideCfg,
} from "../../lib/data";
import { byId } from "../../lib/tables";
import {
  hifiSystem,
  hifiChips,
  hifiResponseAt,
  hifiDispersionMap,
  logSpacedFrequencies,
  linkwitzRileyFilter,
  needsWaveguide,
  SPEAKER_PLACEMENTS as HIFI_PLACES,
} from "../../lib/hifi/hifi";
import { HIFI_OPTIMIZER_GOALS, HIFI_LOCK_KEYS } from "../../lib/hifi/optimize";
import { runHifiOptimizer } from "../../lib/hifi/runOptimizer";
import type { HifiPlanner } from "./useHifiPlanner";
import type { Dims3, HifiGoal, HifiLockKey, HifiOptimizerCard } from "../../types";
import { entriesOf } from "../../lib/records";

interface Props {
  hifi: HifiPlanner;
}

/** Hi-fi page: 2-way home speakers with an active crossover. */
export function HifiPage({ hifi }: Props) {
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
    setWallThicknessIn,
    panelMaterial,
    setPanelMaterial,
    portSpec,
    setPortSpec,
    togglePort,
    radiatorSelection,
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
    isOptimizerOn,
    optimizerGoals,
    setOptimizerGoals,
    optimizerBudget,
    setOptimizerBudget,
    optimizerLocks,
    optimizerResult,
    setOptimizerResult,
    isOptimizing,
    setIsOptimizing,
    optimizerError,
    setOptimizerError,
    designPreview,
    setDesignPreview,
    undoSnapshot,
    setUndoSnapshot,
    setIsOptimizerOn,
    setOptimizerLocks,
    waveguideChoices,
    store,
    snapshot,
    applyDesign,
    savedConfigSnapshot,
    restoreSavedConfig,
  } = hifi;
  const setBoxDim = (k: keyof Dims3, v: number) => setBoxDims((p) => ({ ...p, [k]: v }));
  const setPortField = (k: "h" | "dia" | "len", v: number) =>
    setPortSpec((p) => ({ ...p, [k]: v }));
  /** The waveguide picked for compression drivers (the optimizer tries them on it even while a ribbon is loaded). */
  const compressionWaveguide = {
    covH: selectedWaveguide.hf.covH,
    covV: selectedWaveguide.hf.covV || selectedWaveguide.hf.covH,
    w: selectedWaveguide.size.w,
    h: selectedWaveguide.size.h,
    name: selectedWaveguide.name,
    freestanding: !selectedWaveguide.rect,
  };
  const waveguideSpec = tweeter.ownGuide
    ? ownGuideCfg(tweeter)
    : needsWaveguide(tweeter)
      ? compressionWaveguide
      : null;
  const radiatorDriver = byId(HIFI_PASSIVES, radiatorSelection.id) ?? HIFI_PASSIVES[0];
  const radiator = {
    drv: radiatorDriver,
    n: radiatorSelection.n,
    addG: Math.min(radiatorSelection.addG, passiveRadiatorMassMax(radiatorDriver)),
  };
  const speakerConfig = {
    box: boxType,
    dim: boxDims,
    wall: wallThicknessIn,
    mat: panelMaterial,
    port: portSpec,
    pr: radiator,
    xo: crossoverHz,
    order: crossoverOrder,
    wAmpW: wooferAmpWatts,
    tAmpW: tweeterAmpWatts,
    bsc: baffleStepCompensationDb,
    place: placement,
    wallFt: distanceToWallFt,
    portMax: 17,
    guide: waveguideSpec,
  };
  const tweeterWithWaveguide = waveguideSpec
    ? { ...tweeter, faceplate: { w: waveguideSpec.w, h: waveguideSpec.h } }
    : tweeter;
  const speakerSystem = hifiSystem(woofer, tweeterWithWaveguide, speakerConfig);
  if (!speakerSystem)
    return (
      <main className="max-w-6xl mx-auto px-4 md:px-8 pb-16 text-sm">
        This woofer can't be modelled (its parameters aren't published).
      </main>
    );
  const slotWidthNote =
    speakerSystem.kind === "vented" && speakerSystem.slotW != null
      ? ` (${speakerSystem.slotW.toFixed(1)}″ wide)`
      : "";
  const warningChips = hifiChips(speakerSystem, woofer, tweeterWithWaveguide, speakerConfig);
  // the seat, relative to each speaker (left at -spacing/2, toed in toward the middle)
  const listenerGeometryFor = (sign: -1 | 1) => {
    const sx = (sign * speakerSpacingFt) / 2,
      vx = listeningSeat.x - sx,
      vy = listeningSeat.y,
      d = Math.hypot(vx, vy);
    const axis = (-sign * toeInDeg * Math.PI) / 180,
      ang = Math.atan2(vx, vy) - axis;
    return { th: Math.abs(ang), eyeIn: earHeightIn - standHeightIn, distM: d * METERS_PER_FOOT };
  };
  const leftGeometry = listenerGeometryFor(-1),
    rightGeometry = listenerGeometryFor(1);
  const frequencies = logSpacedFrequencies(15, 20000, 220);
  const leftResponse = hifiResponseAt(
      speakerSystem,
      woofer,
      tweeterWithWaveguide,
      speakerConfig,
      leftGeometry,
      frequencies,
    ),
    rightResponse = hifiResponseAt(
      speakerSystem,
      woofer,
      tweeterWithWaveguide,
      speakerConfig,
      rightGeometry,
      frequencies,
    );
  const onAxisResponse = hifiResponseAt(
    speakerSystem,
    woofer,
    tweeterWithWaveguide,
    speakerConfig,
    { th: 0, eyeIn: speakerSystem.lay.tweeterIn, distM: 1 },
    frequencies,
  );
  const pairResponse = leftResponse.map((o, i) => ({
    f: o.f,
    spl: 10 * Math.log10(Math.pow(10, o.spl / 10) + Math.pow(10, rightResponse[i].spl / 10)),
  }));
  const seatDistanceM = (leftGeometry.distM + rightGeometry.distM) / 2;
  const maxLevelAtSeatDb = speakerSystem.maxLevel - 20 * Math.log10(seatDistanceM) + 3;
  const tweeterMaxCurve = frequencies.map((f) => ({
    f,
    spl:
      speakerSystem.tLevel +
      20 *
        Math.log10(
          Math.max(
            1e-6,
            Math.hypot(
              linkwitzRileyFilter(f, crossoverHz, crossoverOrder, "hp").re,
              linkwitzRileyFilter(f, crossoverHz, crossoverOrder, "hp").im,
            ),
          ),
        ),
  }));
  const dispersion = hifiDispersionMap(
    speakerSystem,
    woofer,
    tweeterWithWaveguide,
    speakerConfig,
    dispersionPlane,
    Math.max(1, seatDistanceM),
  );
  const pairCostUsd =
    2 *
    ((woofer.price || 0) +
      (tweeter.price || 0) +
      (waveguideSpec && !tweeter.ownGuide ? selectedWaveguide.price || 0 : 0) +
      (boxType === "radiator" ? radiator.n * (radiatorDriver.price || 0) : 0));
  const tile = (k: string, v: string, u: string) => (
    <StatTile key={k} label={k} value={v} unit={u} />
  );
  const renderLockButton = (key: HifiLockKey, what: string) =>
    isOptimizerOn ? (
      <LockButton
        on={!!optimizerLocks[key]}
        what={what}
        onClick={() => setOptimizerLocks((p) => ({ ...p, [key]: !p[key] }))}
      />
    ) : null;
  const renderDimensionLock = (dm: keyof Dims3, what: string) =>
    isOptimizerOn ? (
      <DimensionLock
        mode={optimizerLocks.dim[dm] || "free"}
        what={what}
        onChange={(m) => setOptimizerLocks((p) => ({ ...p, dim: { ...p.dim, [dm]: m } }))}
      />
    ) : null;
  const runOptimizerSearch = async () => {
    setIsOptimizing(true);
    setOptimizerError("");
    const base = designPreview ? designPreview.before : snapshot();
    try {
      setOptimizerResult(
        await runHifiOptimizer({
          cur: { ...speakerConfig, ...base, guide: compressionWaveguide },
          woofers: HIFI_WOOFERS,
          tweeters: HIFI_TWEETERS,
          passives: HIFI_PASSIVES,
          goals: optimizerGoals,
          locks: optimizerLocks,
          budget: optimizerBudget,
          seatM: seatDistanceM,
          guidePrice: selectedWaveguide.price || 0,
        }),
      );
    } catch (e) {
      // boundary cast: a catch variable is unknown; whatever was thrown is read for a message, as before
      setOptimizerError("The search failed: " + ((e && (e as Error).message) || e));
    }
    setIsOptimizing(false);
  };
  const previewOptimizerResult = (k: HifiOptimizerCard) => {
    const before = designPreview ? designPreview.before : snapshot();
    applyDesign(k.config);
    setDesignPreview({ label: k.label, before, card: k });
  };
  const exitPreview = () => {
    if (designPreview) applyDesign(designPreview.before);
    setDesignPreview(null);
  };
  const loadOptimizerResult = (k: HifiOptimizerCard) => {
    const before = designPreview ? designPreview.before : snapshot();
    applyDesign(k.config);
    setDesignPreview(null);
    setUndoSnapshot(before);
  };
  const toggleGoal = (g: HifiGoal) =>
    setOptimizerGoals((p) => (p.includes(g) ? p.filter((x) => x !== g) : [...p, g]));
  const lockCount =
    HIFI_LOCK_KEYS.filter((k) => optimizerLocks[k]).length +
    Object.values(optimizerLocks.dim).filter((m) => m && m !== "free").length;
  const allLocksConfig = {
    ...Object.fromEntries(HIFI_LOCK_KEYS.map((k) => [k, true])),
    dim: { w: "exact", h: "exact", d: "exact" } as const,
  };
  const optimizerBar = (
    <OptimizerBar
      on={isOptimizerOn}
      onToggle={() => setIsOptimizerOn(!isOptimizerOn)}
      hint="Find cheaper, lighter, deeper or louder designs inside your limits."
      nLocks={lockCount}
      lockMax={HIFI_LOCK_KEYS.length + 3}
      onLockAll={() => setOptimizerLocks(() => allLocksConfig)}
      onClear={() => setOptimizerLocks(() => ({ dim: {} }))}
    />
  );
  const optimizerPanel = isOptimizerOn && (
    <Card pad="lg" className="mt-3">
      <SectionHeading>Find a better design</SectionHeading>
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
        <GoalPicker defs={HIFI_OPTIMIZER_GOALS} selected={optimizerGoals} onTap={toggleGoal} />
      </div>
      <RunRow
        busy={isOptimizing}
        hasGoal={optimizerGoals.length > 0}
        onRun={runOptimizerSearch}
        stats={optimizerResult && optimizerResult.stats}
        note={
          optimizerResult && optimizerResult.cards.length
            ? " · every design shown passes the checks (warnings are listed on the card)"
            : ""
        }
      >
        {undoSnapshot && !designPreview && (
          <Button
            size="md"
            onClick={() => {
              applyDesign(undoSnapshot);
              setUndoSnapshot(null);
            }}
          >
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
            Nothing fits all your limits. A bigger budget or fewer locks would open it up.
          </div>
        )}
    </Card>
  );
  return (
    <main
      className="max-w-6xl mx-auto px-4 md:px-8 pb-16 grid grid-cols-1 md:grid-cols-5 gap-8"
      style={{ fontFamily: "var(--font)" }}
    >
      <div className="md:col-span-5 min-w-0">
        <SavedConfigs
          bare
          store={store}
          snapshot={savedConfigSnapshot}
          restore={restoreSavedConfig}
        />
        {optimizerBar}
        {optimizerPanel}
        {designPreview && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded bg-stone-900 text-white border-t-4 border-cmy-y px-3 py-2 text-sm font-semibold">
            <span className="flex-1">Previewing “{designPreview.label}”</span>
            <button
              onClick={() => loadOptimizerResult(designPreview.card)}
              className="px-3 py-1.5 rounded border border-stone-900 bg-white text-stone-900"
            >
              Keep
            </button>
            <button
              onClick={exitPreview}
              className="px-3 py-1.5 rounded border border-stone-900 bg-white text-stone-900"
            >
              Back
            </button>
          </div>
        )}
      </div>
      <div className="min-w-0 md:col-span-3 flex flex-col gap-4">
        <div className="flex gap-4 items-center">
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
            />
          </div>
          <div className="flex-1 min-w-0 grid gap-px rounded-lg overflow-hidden border border-stone-300 bg-stone-300 grid-cols-2 sm:grid-cols-3 [&>*:last-child:nth-child(odd)]:col-span-2 sm:[&>*:last-child:nth-child(odd)]:col-span-1">
            {tile("Net volume", speakerSystem.net.toFixed(1), "L")}
            {speakerSystem.kind === "sealed"
              ? tile("Qtc", speakerSystem.Qtc.toFixed(2), "")
              : tile("Tuning Fb", speakerSystem.Fb.toFixed(0), "Hz")}
            {tile("F3 in room", speakerSystem.f3.toFixed(0), "Hz")}
            {tile("Max at the seat", maxLevelAtSeatDb.toFixed(0), "dB")}
            {tile("Weight", speakerSystem.lb.toFixed(0), "lb")}
            {tile("Pair", `$${Math.round(pairCostUsd)}`, "")}
          </div>
        </div>
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
              stroke: PAL.ink,
              tint: PAL.alpha(PAL.ink, 0),
            },
            {
              curve: pairResponse,
              label: `Pair at the seat (${(seatDistanceM / METERS_PER_FOOT).toFixed(1)} ft)`,
              stroke: PAL.cyan,
              tint: PAL.alpha(PAL.cyan, 0.06),
            },
          ]}
          marks={[
            { f: crossoverHz, label: "XO" },
            { f: speakerSystem.bsF3, label: "Baffle step" },
            ...(speakerSystem.Fb ? [{ f: speakerSystem.Fb, label: "Fb" }] : []),
          ]}
        />
        <ResponseChart
          fmin={15}
          fmax={20000}
          top={HIFI_TOP}
          bot={HIFI_BOT}
          step={10}
          yLabel="max dB SPL @ 1 m"
          series={[
            {
              curve: speakerSystem.wMax,
              label: woofer.name,
              stroke: PAL.magenta,
              tint: PAL.alpha(PAL.magenta, 0.06),
            },
            {
              curve: tweeterMaxCurve,
              label: tweeter.name,
              stroke: PAL.cyan,
              tint: PAL.alpha(PAL.cyan, 0.06),
            },
          ]}
          marks={[{ f: crossoverHz, label: "XO" }]}
        />
        <WarningChips chips={warningChips} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
          <RoomView
            spacing={speakerSpacingFt}
            toe={toeInDeg}
            seat={listeningSeat}
            setSeat={setListeningSeat}
            angles={[(leftGeometry.th * 180) / Math.PI, (rightGeometry.th * 180) / Math.PI]}
          />
          <div className="text-sm text-stone-500 leading-relaxed">
            <div className="text-xs uppercase tracking-wider text-stone-500 font-semibold mb-1">
              At the seat
            </div>
            <div>{(seatDistanceM / METERS_PER_FOOT).toFixed(1)} ft from the pair</div>
            <div>
              Off axis: L {((leftGeometry.th * 180) / Math.PI).toFixed(0)}°, R{" "}
              {((rightGeometry.th * 180) / Math.PI).toFixed(0)}°
            </div>
            <div>
              Ears{" "}
              {earHeightIn - standHeightIn - speakerSystem.lay.tweeterIn >= 0 ? "above" : "below"}{" "}
              tweeter{" "}
              {Math.abs(earHeightIn - standHeightIn - speakerSystem.lay.tweeterIn).toFixed(1)}″
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
        <div>
          <div className="flex gap-1 mb-2">
            {(
              [
                ["Horizontal", "h"],
                ["Vertical", "v"],
              ] as const
            ).map(([l, v]) => (
              <ToggleButton
                key={v}
                onClick={() => setDispersionPlane(v)}
                on={dispersionPlane === v}
              >
                {l}
              </ToggleButton>
            ))}
          </div>
          <DispersionMap
            map={dispersion}
            title={
              dispersionPlane === "h"
                ? "Horizontal dispersion, one speaker (0° is on axis)"
                : "Vertical dispersion: below (−) to above (+) the tweeter axis"
            }
          />
        </div>
        <details className="text-xs text-stone-500 rounded border border-stone-300 bg-stone-50 px-3 py-2">
          <summary className="cursor-pointer text-sm text-stone-900 py-1">Details</summary>
          <div className="leading-relaxed mt-1 flex flex-col gap-1.5">
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
              <Tooltip tip={woofer.note}>
                <span className="font-medium text-stone-900">{woofer.name}</span>
              </Tooltip>
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
          </div>
        </details>
      </div>
      <aside className="min-w-0 md:col-span-2">
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
        <div className="grid grid-cols-[5.5rem_1fr_auto] items-center gap-x-2 gap-y-2 mb-3 text-sm">
          <span className="text-stone-500">Material</span>
          <div className="flex flex-wrap gap-1">
            {(
              [
                ["Birch ply", "ply"],
                ["MDF", "mdf"],
              ] as const
            ).map(([l, v]) => (
              <ToggleButton key={v} onClick={() => setPanelMaterial(v)} on={panelMaterial === v}>
                {l}
              </ToggleButton>
            ))}
          </div>
          <span />
          <span className="text-stone-500">Thickness</span>
          <div className="flex flex-wrap gap-1">
            {(
              [
                [0.75, "3/4″"],
                [0.5, "1/2″"],
              ] as const
            ).map(([v, l]) => (
              <ToggleButton
                key={v}
                onClick={() => setWallThicknessIn(v)}
                on={wallThicknessIn === v}
              >
                {l}
              </ToggleButton>
            ))}
          </div>
          <span>{renderLockButton("wall", "the panel thickness")}</span>
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
            extra={renderDimensionLock("w", "Width")}
          />
          <Slider
            label="Height"
            value={boxDims.h}
            min={9}
            max={44}
            step={0.25}
            unit="″"
            onChange={(v) => setBoxDim("h", v)}
            extra={renderDimensionLock("h", "Height")}
          />
          <Slider
            label="Depth"
            value={boxDims.d}
            min={6}
            max={16}
            step={0.25}
            unit="″"
            onChange={(v) => setBoxDim("d", v)}
            extra={renderDimensionLock("d", "Depth")}
          />
          <div className="flex items-center justify-between gap-2 mb-1 mt-1">
            <span className="text-sm text-stone-500">Ports</span>
            {renderLockButton("box", "sealed, ported or radiator")}
          </div>
          <div className="grid grid-cols-3 gap-1 mb-3">
            {(
              [
                ["Sealed", "sealed", 0, "Sealed"],
                ["1 port", "vented", 1, "One round port"],
                ["2 ports", "vented", 2, "Two round ports"],
                ["Slot", "vented", "slot", "Slot vent along the bottom of the baffle"],
                ["1 PR", "radiator", 1, "One passive radiator"],
                ["2 PR", "radiator", 2, "Two passive radiators"],
              ] as const
            ).map(([l, v, n, tip]) => {
              const slotOn = portSpec.shape === "slot";
              const on =
                boxType === v &&
                (v === "sealed" ||
                  (v === "vented"
                    ? n === "slot"
                      ? slotOn
                      : !slotOn && portSpec.n === n
                    : radiator.n === n));
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
                ? `; radiators on the back tune it to ${speakerSystem.Fb.toFixed(0)} Hz, with a notch at ${speakerSystem.Fp.toFixed(0)} Hz (their own resonance)${radiatorDriver.xmaxKind === "mechanical" ? ". Its travel limit is the mechanical one; no linear figure is published" : ""}`
                : ", lightly stuffed"}
            .
          </div>
        </Card>
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
          <div className="flex gap-1 mb-3">
            {(
              [
                [4, "LR24"],
                [8, "LR48"],
              ] as const
            ).map(([v, l]) => (
              <ToggleButton
                key={v}
                size="xs"
                onClick={() => setCrossoverOrder(v)}
                on={crossoverOrder === v}
              >
                {l}
              </ToggleButton>
            ))}
          </div>
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
            min={10}
            max={500}
            step={10}
            unit=" W"
            onChange={setWooferAmpWatts}
            extra={renderLockButton("wAmpW", "the woofer amp power")}
          />
          <Slider
            label="Tweeter amp @ 8 Ω"
            value={tweeterAmpWatts}
            min={5}
            max={200}
            step={5}
            unit=" W"
            onChange={setTweeterAmpWatts}
            extra={renderLockButton("tAmpW", "the tweeter amp power")}
          />
        </Card>
        <Card>
          <div className="text-sm text-stone-500 mb-1">Placement</div>
          <div className="flex flex-wrap gap-1 mb-3">
            {entriesOf(HIFI_PLACES).map(([k, p]) => (
              <ToggleButton key={k} onClick={() => setPlacement(k)} on={placement === k}>
                {p.name}
              </ToggleButton>
            ))}
          </div>
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
      </aside>
    </main>
  );
}
