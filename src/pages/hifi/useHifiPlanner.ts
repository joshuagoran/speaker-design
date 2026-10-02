import { HORN_OPTIONS } from "../../lib/data";
import { DEFAULT_HIFI, DEFAULT_PORT_SIZE } from "../../lib/defaults";
import { portAfterToggle } from "../../lib/hifi/hifi";
import { readStoredJson, writeStoredJson } from "../../lib/storage";
import { useConfigStore, type ConfigStore } from "../../components/saved-configs/useConfigStore";
import type {
  Dims3,
  DispersionPlane,
  HifiBoxKind,
  HifiCardConfig,
  HifiDesignState,
  HifiGoal,
  HifiOptimizerCard,
  HifiOptimizerLocks,
  HifiOptimizerResult,
  HifiPlacement,
  HifiPort,
  HifiTweeter,
  HifiWaveguide,
  HifiWoofer,
  CrossoverOrder,
  ListeningSeat,
  PanelMaterial,
  PortMemory,
  RadiatorSelection,
  Setter,
} from "../../types";
import { useEffect, useRef, useState } from "react";

/** The optimizer locks as the page holds them: the box-dimension modes are always present. */
export interface HifiPlannerLocks extends HifiOptimizerLocks {
  dim: NonNullable<HifiOptimizerLocks["dim"]>;
}

/** The card being previewed, and the design to go back to when the preview ends. */
export interface HifiDesignPreview {
  label: string;
  before: HifiCardConfig;
  card: HifiOptimizerCard;
}

export interface HifiPlanner extends HifiDesignState {
  setWoofer: Setter<HifiWoofer>;
  setTweeter: Setter<HifiTweeter>;
  setSelectedWaveguide: Setter<HifiWaveguide>;
  setBoxType: Setter<HifiBoxKind>;
  setBoxDims: Setter<Dims3>;
  setWallThicknessIn: Setter<number>;
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
  isOptimizerOn: boolean;
  optimizerGoals: HifiGoal[];
  setOptimizerGoals: Setter<HifiGoal[]>;
  optimizerBudget: number;
  setOptimizerBudget: (v: number) => void;
  optimizerLocks: HifiPlannerLocks;
  optimizerResult: HifiOptimizerResult | null;
  setOptimizerResult: Setter<HifiOptimizerResult | null>;
  isOptimizing: boolean;
  setIsOptimizing: Setter<boolean>;
  optimizerError: string;
  setOptimizerError: Setter<string>;
  designPreview: HifiDesignPreview | null;
  setDesignPreview: Setter<HifiDesignPreview | null>;
  undoSnapshot: HifiCardConfig | null;
  setUndoSnapshot: Setter<HifiCardConfig | null>;
  setIsOptimizerOn: (v: boolean) => void;
  setOptimizerLocks: (f: (p: HifiPlannerLocks) => HifiPlannerLocks) => void;
  waveguideChoices: HifiWaveguide[];
  store: ConfigStore;
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
  const [wallThicknessIn, setWallThicknessIn] = useState(DEFAULT_HIFI.wallThicknessIn);
  const [panelMaterial, setPanelMaterial] = useState<PanelMaterial>(DEFAULT_HIFI.panelMaterial);
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
  const store = useConfigStore("hifiConfigs");
  // optimizer: same rules and layout as the PA planner's (switch, locks on the controls, goals in tap order)
  const [isOptimizerOn, setIsOptimizerOnState] = useState(() => readStoredJson("hifi.opt", false));
  const setIsOptimizerOn = (v: boolean) => {
    setIsOptimizerOnState(v);
    writeStoredJson("hifi.opt", v);
  };
  const [optimizerGoals, setOptimizerGoals] = useState<HifiGoal[]>([]);
  const [optimizerBudget, setOptimizerBudgetState] = useState(() =>
    readStoredJson("hifi.budget", 800),
  );
  const setOptimizerBudget = (v: number) => {
    setOptimizerBudgetState(v);
    writeStoredJson("hifi.budget", v);
  };
  const [optimizerLocks, setOptimizerLocksState] = useState<HifiPlannerLocks>(() => {
    const l = readStoredJson<HifiOptimizerLocks>("hifi.locks", {}) || {};
    return { ...l, dim: { ...l.dim } };
  });
  const setOptimizerLocks = (f: (p: HifiPlannerLocks) => HifiPlannerLocks) =>
    setOptimizerLocksState((p) => {
      const n = f(p);
      writeStoredJson("hifi.locks", n);
      return n;
    });
  const [optimizerResult, setOptimizerResult] = useState<HifiOptimizerResult | null>(null);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizerError, setOptimizerError] = useState("");
  const [designPreview, setDesignPreview] = useState<HifiDesignPreview | null>(null);
  const [undoSnapshot, setUndoSnapshot] = useState<HifiCardConfig | null>(null);
  return {
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
  };
}
