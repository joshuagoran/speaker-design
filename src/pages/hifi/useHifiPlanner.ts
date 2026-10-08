import { HIFI_TWEETERS, HIFI_WOOFERS, HORN_OPTIONS } from "../../lib/data";
import { DEFAULT_HIFI, DEFAULT_HIFI_LOOK, DEFAULT_PORT_SIZE } from "../../lib/defaults";
import { portAfterToggle } from "../../lib/hifi/hifi";
import { byId, byIdOrThrow } from "../../lib/tables";
import { useConfigStore, type ConfigStore } from "../../components/saved-configs/useConfigStore";
import { deriveHifiDesign } from "./hifiDesign";
import { useHifiOptimizer } from "./useHifiOptimizer";
import type { HifiOptimizer } from "./useHifiOptimizer";
import type {
  Dims3,
  DispersionPlane,
  HifiBoxKind,
  HifiCardConfig,
  HifiDesign,
  HifiDesignState,
  HifiPlacement,
  HifiPort,
  HifiTweeter,
  HifiWaveguide,
  HifiWoofer,
  CrossoverOrder,
  ListeningSeat,
  PanelMaterial,
  PanelNominal,
  PortMemory,
  RadiatorSelection,
  SavedHifiConfig,
  Setter,
} from "../../types";
import { useEffect, useMemo, useRef, useState } from "react";
import { CATALOG_TABLE_NAMES } from "../../constants/catalogTables";
import { useHifiCutlistOptions } from "../cutlist/useHifiCutlistOptions";
import type { CutlistOptions } from "../pa-stack/hooks/useCutlistOptions";
import type { CabinetStyle } from "../pa-stack/hooks/useCabinetStyle";
import { panelFor, panelIn, restoredPanel } from "../../lib/panel";

/** Everything the Hi-fi page reads: the design state and its setters, the model derived from it, the optimizer, and saving. */
export interface HifiPlanner
  extends
    HifiDesignState,
    HifiDesign,
    HifiOptimizer,
    Pick<CabinetStyle, "cabinetFinish" | "setCabinetFinish" | "baffleColor" | "setBaffleColor"> {
  setWoofer: Setter<HifiWoofer>;
  setTweeter: Setter<HifiTweeter>;
  setSelectedWaveguide: Setter<HifiWaveguide>;
  setBoxType: Setter<HifiBoxKind>;
  setBoxDims: Setter<Dims3>;
  setWallPanel: Setter<PanelNominal>;
  setPanelMaterial: Setter<PanelMaterial>;
  setPortSpec: Setter<HifiPort>;
  /** The port after the "1 port / 2 ports / Slot" toggle, keeping the size each shape last had. */
  togglePort: (to: Parameters<typeof portAfterToggle>[1]) => void;
  setRadiatorSelection: Setter<RadiatorSelection>;
  setCrossoverHz: Setter<number>;
  setCrossoverOrder: Setter<CrossoverOrder>;
  setWooferAmpWatts: Setter<number>;
  setTweeterAmpWatts: Setter<number>;
  setBaffleStepCompensationDb: Setter<number>;
  setPlacement: Setter<HifiPlacement>;
  setDistanceToWallFt: Setter<number>;
  setSpeakerSpacingFt: Setter<number>;
  setToeInDeg: Setter<number>;
  setListeningSeat: Setter<ListeningSeat>;
  setEarHeightIn: Setter<number>;
  setStandHeightIn: Setter<number>;
  setDispersionPlane: Setter<DispersionPlane>;
  setRoundoverIn: Setter<number>;
  setTweeterOffsetIn: Setter<number>;
  waveguideChoices: HifiWaveguide[];
  store: ConfigStore;
  /** the Hi-fi Cutlist page's choices, remembered in this browser; its measured panel thicknesses size the box */
  cutlist: CutlistOptions;
  /** The fields of the design a card applies: what the optimizer starts from, and what undo and preview go back to. */
  snapshot: () => HifiCardConfig;
  /** Sets those fields from a card or a snapshot. */
  applyDesign: (c: HifiCardConfig) => void;
  /** The whole design and room, for saving. */
  savedConfigSnapshot: () => SavedHifiConfig;
  /** Sets whatever the saved config has, and drops any optimizer result, preview and undo. */
  restoreSavedConfig: (c: Partial<SavedHifiConfig>) => void;
}

/** The Hi-fi page's design, room and optimizer state. Held by App so it survives switching tabs. */
export function useHifiPlanner(): HifiPlanner {
  // boundary cast: the filter keeps only horns that have `hf`
  const waveguideChoices = HORN_OPTIONS.filter(
    (h) => h.exit === 1 && h.hf && h.hf.covH && h.size,
  ) as HifiWaveguide[];
  const [woofer, setWoofer] = useState<HifiWoofer>(DEFAULT_HIFI.woofer);
  const [tweeter, setTweeter] = useState<HifiTweeter>(DEFAULT_HIFI.tweeter);
  const [selectedWaveguide, setSelectedWaveguide] = useState<HifiWaveguide>(
    DEFAULT_HIFI.selectedWaveguide,
  );
  const [boxType, setBoxType] = useState<HifiBoxKind>(DEFAULT_HIFI.boxType);
  const [boxDims, setBoxDims] = useState<Dims3>(DEFAULT_HIFI.boxDims);
  const [wallPanel, setWallPanel] = useState<PanelNominal>(DEFAULT_HIFI.wallPanel);
  const [panelMaterial, setPanelMaterial] = useState<PanelMaterial>(DEFAULT_HIFI.panelMaterial);
  const cutlist = useHifiCutlistOptions();
  const { panelExactIn } = cutlist;
  // the walls' exact thickness: the nominal size at the Cutlist page's measured thickness (lib/panel)
  const wallThicknessIn = panelIn(wallPanel, panelMaterial, panelExactIn);
  const [portSpec, setPortSpec] = useState<HifiPort>(DEFAULT_HIFI.portSpec);
  // the last round diameter and slot height, so toggling the port shape and back keeps what the user had
  // (not persisted, like portSpec itself)
  const portMemory = useRef<PortMemory>(DEFAULT_PORT_SIZE);
  useEffect(() => {
    portMemory.current =
      portSpec.shape === "slot"
        ? { ...portMemory.current, h: portSpec.h }
        : { ...portMemory.current, dia: portSpec.dia };
  }, [portSpec]);
  const togglePort = (to: Parameters<typeof portAfterToggle>[1]) =>
    setPortSpec((p) => portAfterToggle(p, to, portMemory.current));
  const [radiatorSelection, setRadiatorSelection] = useState<RadiatorSelection>(
    DEFAULT_HIFI.radiatorSelection,
  );
  const [crossoverHz, setCrossoverHz] = useState(DEFAULT_HIFI.crossoverHz);
  const [crossoverOrder, setCrossoverOrder] = useState<CrossoverOrder>(DEFAULT_HIFI.crossoverOrder);
  const [wooferAmpWatts, setWooferAmpWatts] = useState(DEFAULT_HIFI.wooferAmpWatts);
  const [tweeterAmpWatts, setTweeterAmpWatts] = useState(DEFAULT_HIFI.tweeterAmpWatts);
  const [baffleStepCompensationDb, setBaffleStepCompensationDb] = useState(
    DEFAULT_HIFI.baffleStepCompensationDb,
  );
  const [placement, setPlacement] = useState<HifiPlacement>(DEFAULT_HIFI.placement);
  const [distanceToWallFt, setDistanceToWallFt] = useState(DEFAULT_HIFI.distanceToWallFt);
  const [speakerSpacingFt, setSpeakerSpacingFt] = useState(DEFAULT_HIFI.speakerSpacingFt);
  const [toeInDeg, setToeInDeg] = useState(DEFAULT_HIFI.toeInDeg);
  const [listeningSeat, setListeningSeat] = useState<ListeningSeat>(DEFAULT_HIFI.listeningSeat);
  const [earHeightIn, setEarHeightIn] = useState(DEFAULT_HIFI.earHeightIn);
  const [standHeightIn, setStandHeightIn] = useState(DEFAULT_HIFI.standHeightIn);
  const [dispersionPlane, setDispersionPlane] = useState<DispersionPlane>(
    DEFAULT_HIFI.dispersionPlane,
  );
  const [roundoverIn, setRoundoverIn] = useState(DEFAULT_HIFI.roundoverIn);
  const [tweeterOffsetIn, setTweeterOffsetIn] = useState(DEFAULT_HIFI.tweeterOffsetIn);
  // the 3D view's look (PA's pickers and finishes, this design's own choice); outside the model, so it isn't derived
  const [cabinetFinish, setCabinetFinish] = useState<string>(DEFAULT_HIFI_LOOK.cabFinish);
  const [baffleColor, setBaffleColor] = useState<string>(DEFAULT_HIFI_LOOK.baffleColor);
  const store = useConfigStore("hifiConfigs");
  const snapshot = (): HifiCardConfig => ({
    woofer: woofer.id,
    tweeter: tweeter.id,
    box: boxType,
    dim: boxDims,
    port: portSpec,
    pr: boxType === "radiator" ? radiatorSelection : undefined,
    wall: wallThicknessIn,
    xo: crossoverHz,
    wAmpW: wooferAmpWatts,
    tAmpW: tweeterAmpWatts,
  });
  // Everything in the design and room, for saving (undefined fields dropped: the stores reject them)
  const savedConfigSnapshot = (): SavedHifiConfig =>
    JSON.parse(
      JSON.stringify({
        ...snapshot(),
        panel: wallPanel,
        guide: selectedWaveguide.id,
        mat: panelMaterial,
        order: crossoverOrder,
        bsc: baffleStepCompensationDb,
        place: placement,
        wallFt: distanceToWallFt,
        spacing: speakerSpacingFt,
        toe: toeInDeg,
        seat: listeningSeat,
        earIn: earHeightIn,
        standIn: standHeightIn,
        roundover: roundoverIn,
        tweeterOffset: tweeterOffsetIn,
        cabFinish: cabinetFinish,
        baffleColor,
        summary: `${woofer.name} + ${tweeter.name} · ${boxDims.w}×${boxDims.h}×${boxDims.d}″ · ${boxType === "radiator" ? "passive radiator" : boxType}`,
      }),
    );
  const applyDesign = (c: HifiCardConfig) => {
    // a card's or snapshot's driver ids come from these lists
    setWoofer(byIdOrThrow(HIFI_WOOFERS, c.woofer, CATALOG_TABLE_NAMES.hifiWoofers));
    setTweeter(byIdOrThrow(HIFI_TWEETERS, c.tweeter, CATALOG_TABLE_NAMES.hifiTweeters));
    setBoxType(c.box);
    setBoxDims(c.dim);
    if (c.port) setPortSpec(c.port);
    if (c.pr) setRadiatorSelection(c.pr);
    // a card or snapshot names its walls by thickness: the current size while it is at that thickness (two sizes can
    // be measured alike), else the size measured (or nominally) at it
    setWallPanel(
      panelFor({ wall: c.wall, panel: wallPanel }, panelMaterial, panelExactIn) ?? wallPanel,
    );
    setCrossoverHz(c.xo);
    setWooferAmpWatts(c.wAmpW);
    setTweeterAmpWatts(c.tAmpW);
  };
  const state: HifiDesignState = {
    woofer,
    tweeter,
    selectedWaveguide,
    boxType,
    boxDims,
    wallPanel,
    panelExactIn,
    panelMaterial,
    portSpec,
    radiatorSelection,
    crossoverHz,
    crossoverOrder,
    wooferAmpWatts,
    tweeterAmpWatts,
    baffleStepCompensationDb,
    placement,
    distanceToWallFt,
    speakerSpacingFt,
    toeInDeg,
    listeningSeat,
    earHeightIn,
    standHeightIn,
    dispersionPlane,
    roundoverIn,
    tweeterOffsetIn,
  };
  // derived once per change to a state field, not on every render of every tab (App holds this planner)
  const design = useMemo(
    () =>
      deriveHifiDesign({
        woofer,
        tweeter,
        selectedWaveguide,
        boxType,
        boxDims,
        wallPanel,
        panelExactIn,
        panelMaterial,
        portSpec,
        radiatorSelection,
        crossoverHz,
        crossoverOrder,
        wooferAmpWatts,
        tweeterAmpWatts,
        baffleStepCompensationDb,
        placement,
        distanceToWallFt,
        speakerSpacingFt,
        toeInDeg,
        listeningSeat,
        earHeightIn,
        standHeightIn,
        dispersionPlane,
        roundoverIn,
        tweeterOffsetIn,
      }),
    [
      woofer,
      tweeter,
      selectedWaveguide,
      boxType,
      boxDims,
      wallPanel,
      panelExactIn,
      panelMaterial,
      portSpec,
      radiatorSelection,
      crossoverHz,
      crossoverOrder,
      wooferAmpWatts,
      tweeterAmpWatts,
      baffleStepCompensationDb,
      placement,
      distanceToWallFt,
      speakerSpacingFt,
      toeInDeg,
      listeningSeat,
      earHeightIn,
      standHeightIn,
      dispersionPlane,
      roundoverIn,
      tweeterOffsetIn,
    ],
  );
  const optimizer = useHifiOptimizer({
    snapshot,
    applyDesign,
    speakerConfig: design.speakerConfig,
    compressionWaveguide: design.compressionWaveguide,
    seatDistanceM: design.seatDistanceM,
    guidePrice: selectedWaveguide.price || 0,
    panelExactIn,
  });
  const restoreSavedConfig = (c: Partial<SavedHifiConfig>) => {
    const pick = <T extends { id: string }>(list: readonly T[], id: string | undefined) =>
      id === undefined ? undefined : byId(list, id);
    // each saved field sets its own state when the saved config has it; the setter and the field share a type
    const ok = <T>(set: Setter<T>, v: T | undefined) => {
      if (v !== undefined) set(v);
    };
    ok(setWoofer, pick(HIFI_WOOFERS, c.woofer));
    ok(setTweeter, pick(HIFI_TWEETERS, c.tweeter));
    ok(setSelectedWaveguide, pick(waveguideChoices, c.guide));
    ok(setBoxType, c.box);
    ok(setBoxDims, c.dim);
    ok(setPortSpec, c.port);
    ok(setRadiatorSelection, c.pr);
    // the size the save names, measured at the thickness it was saved at (the measurements live in this browser)
    const walls = restoredPanel(c, c.mat ?? panelMaterial, panelExactIn);
    if (walls) {
      setWallPanel(walls.panel);
      cutlist.setPanelExactIn(walls.exactIn);
    }
    ok(setPanelMaterial, c.mat);
    ok(setCrossoverHz, c.xo);
    ok(setCrossoverOrder, c.order);
    ok(setWooferAmpWatts, c.wAmpW);
    ok(setTweeterAmpWatts, c.tAmpW);
    ok(setBaffleStepCompensationDb, c.bsc);
    ok(setPlacement, c.place);
    ok(setDistanceToWallFt, c.wallFt);
    ok(setSpeakerSpacingFt, c.spacing);
    ok(setToeInDeg, c.toe);
    ok(setListeningSeat, c.seat);
    ok(setEarHeightIn, c.earIn);
    ok(setStandHeightIn, c.standIn);
    // configs saved before these existed had sharp edges and a centered tweeter
    setRoundoverIn(c.roundover ?? DEFAULT_HIFI.roundoverIn);
    setTweeterOffsetIn(c.tweeterOffset ?? DEFAULT_HIFI.tweeterOffsetIn);
    // and before the look: the defaults
    setCabinetFinish(c.cabFinish || DEFAULT_HIFI_LOOK.cabFinish);
    setBaffleColor(c.baffleColor || DEFAULT_HIFI_LOOK.baffleColor);
    optimizer.clearOptimizerResults();
  };
  return {
    ...state,
    ...design,
    ...optimizer,
    setWoofer,
    setTweeter,
    setSelectedWaveguide,
    setBoxType,
    setBoxDims,
    setWallPanel,
    setPanelMaterial,
    setPortSpec,
    togglePort,
    setRadiatorSelection,
    setCrossoverHz,
    setCrossoverOrder,
    setWooferAmpWatts,
    setTweeterAmpWatts,
    setBaffleStepCompensationDb,
    setPlacement,
    setDistanceToWallFt,
    setSpeakerSpacingFt,
    setToeInDeg,
    setListeningSeat,
    setEarHeightIn,
    setStandHeightIn,
    setDispersionPlane,
    setRoundoverIn,
    setTweeterOffsetIn,
    cabinetFinish,
    setCabinetFinish,
    baffleColor,
    setBaffleColor,
    waveguideChoices,
    store,
    cutlist,
    snapshot,
    applyDesign,
    savedConfigSnapshot,
    restoreSavedConfig,
  };
}
