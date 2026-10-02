import { HORN_OPTIONS, HIFI_WOOFERS, HIFI_TWEETERS } from "../../lib/data";
import { byId, defaultOf } from "../../lib/tables";
import { readStoredJson, writeStoredJson } from "../../lib/storage";
import { useConfigStore, type ConfigStore } from "../../components/saved-configs/useConfigStore";
import type {
  Dims3,
  DispersionPlane,
  HifiBoxKind,
  HifiCardConfig,
  HifiGoal,
  HifiOptimizerCard,
  HifiOptimizerLocks,
  HifiOptimizerResult,
  HifiPlacement,
  HifiPort,
  HifiTweeter,
  HifiWoofer,
  CrossoverOrder,
  Horn,
  HornHf,
  ListeningSeat,
  PanelMaterial,
  RadiatorSelection,
  Setter,
} from "../../types";
import { useState } from "react";

/** The optimizer locks as the page holds them: the box-dimension modes are always present. */
export interface HifiPlannerLocks extends HifiOptimizerLocks {
  dim: NonNullable<HifiOptimizerLocks["dim"]>;
}

/** A horn the page can use as a waveguide: one with its coverage specs, which `waveguideChoices` keeps. */
export type HifiWaveguide = Horn & { hf: HornHf };

/** The card being previewed, and the design to go back to when the preview ends. */
export interface HifiDesignPreview {
  label: string;
  before: HifiCardConfig;
  card: HifiOptimizerCard;
}

export interface HifiPlanner {
  woofer: HifiWoofer;
  setWoofer: Setter<HifiWoofer>;
  tweeter: HifiTweeter;
  setTweeter: Setter<HifiTweeter>;
  selectedWaveguide: HifiWaveguide;
  setSelectedWaveguide: Setter<HifiWaveguide>;
  boxType: HifiBoxKind;
  setBoxType: Setter<HifiBoxKind>;
  boxDims: Dims3;
  setBoxDims: Setter<Dims3>;
  wallThicknessIn: number;
  setWallThicknessIn: Setter<number>;
  panelMaterial: PanelMaterial;
  setPanelMaterial: Setter<PanelMaterial>;
  portSpec: HifiPort;
  setPortSpec: Setter<HifiPort>;
  radiatorSelection: RadiatorSelection;
  setRadiatorSelection: Setter<RadiatorSelection>;
  crossoverHz: number;
  setCrossoverHz: Setter<number>;
  crossoverOrder: CrossoverOrder;
  setCrossoverOrder: Setter<CrossoverOrder>;
  wooferAmpWatts: number;
  setWooferAmpWatts: Setter<number>;
  tweeterAmpWatts: number;
  setTweeterAmpWatts: Setter<number>;
  baffleStepCompensationDb: number;
  setBaffleStepCompensationDb: Setter<number>;
  placement: HifiPlacement;
  setPlacement: Setter<HifiPlacement>;
  distanceToWallFt: number;
  setDistanceToWallFt: Setter<number>;
  speakerSpacingFt: number;
  setSpeakerSpacingFt: Setter<number>;
  toeInDeg: number;
  setToeInDeg: Setter<number>;
  listeningSeat: ListeningSeat;
  setListeningSeat: Setter<ListeningSeat>;
  earHeightIn: number;
  setEarHeightIn: Setter<number>;
  standHeightIn: number;
  setStandHeightIn: Setter<number>;
  dispersionPlane: DispersionPlane;
  setDispersionPlane: Setter<DispersionPlane>;
  isOptimizerOn: boolean;
  optimizerGoals: HifiGoal[];
  setOptimizerGoals: Setter<HifiGoal[]>;
  optimizerBudget: number;
  setOptimizerBudget: Setter<number>;
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
  const [woofer, setWoofer] = useState(() => defaultOf(HIFI_WOOFERS, "hi-fi woofers"));
  const [tweeter, setTweeter] = useState(() => defaultOf(HIFI_TWEETERS, "hi-fi tweeters"));
  const [selectedWaveguide, setSelectedWaveguide] = useState(
    () => byId(waveguideChoices, "st260") ?? waveguideChoices[0],
  );
  const [boxType, setBoxType] = useState<HifiBoxKind>("vented");
  const [boxDims, setBoxDims] = useState<Dims3>({ w: 9, h: 15, d: 11 });
  const [wallThicknessIn, setWallThicknessIn] = useState(0.75);
  const [panelMaterial, setPanelMaterial] = useState<PanelMaterial>("ply");
  const [portSpec, setPortSpec] = useState<HifiPort>({ n: 1, dia: 2, len: 6 });
  const [radiatorSelection, setRadiatorSelection] = useState<RadiatorSelection>({
    id: "sb16pfcr",
    n: 2,
    addG: 0,
  });
  const [crossoverHz, setCrossoverHz] = useState(2000);
  const [crossoverOrder, setCrossoverOrder] = useState<CrossoverOrder>(4);
  const [wooferAmpWatts, setWooferAmpWatts] = useState(100);
  const [tweeterAmpWatts, setTweeterAmpWatts] = useState(50);
  const [baffleStepCompensationDb, setBaffleStepCompensationDb] = useState(3);
  const [placement, setPlacement] = useState<HifiPlacement>("free");
  const [distanceToWallFt, setDistanceToWallFt] = useState(2);
  const [speakerSpacingFt, setSpeakerSpacingFt] = useState(7);
  const [toeInDeg, setToeInDeg] = useState(15);
  const [listeningSeat, setListeningSeat] = useState<ListeningSeat>({ x: 0, y: 8 });
  const [earHeightIn, setEarHeightIn] = useState(38);
  const [standHeightIn, setStandHeightIn] = useState(24);
  const [dispersionPlane, setDispersionPlane] = useState<DispersionPlane>("h");
  const store = useConfigStore("hifiConfigs");
  // optimizer: same rules and layout as the PA planner's (switch, locks on the controls, goals in tap order)
  const [isOptimizerOn, setIsOptimizerOnState] = useState(() => readStoredJson("hifi.opt", false));
  const setIsOptimizerOn = (v: boolean) => {
    setIsOptimizerOnState(v);
    writeStoredJson("hifi.opt", v);
  };
  const [optimizerGoals, setOptimizerGoals] = useState<HifiGoal[]>([]);
  const [optimizerBudget, setOptimizerBudget] = useState(() => readStoredJson("hifi.budget", 800));
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
