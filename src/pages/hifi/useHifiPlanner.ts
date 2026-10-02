import { HORN_OPTIONS, HIFI_WOOFERS, HIFI_TWEETERS } from "../../lib/data";
import { useConfigStore } from "../../components/saved-configs/useConfigStore";
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
  PanelMaterial,
  RadiatorSelection,
} from "../../types";
import { useState } from "react";

type Setter<T> = React.Dispatch<React.SetStateAction<T>>;

/** Where the listener sits: feet across the room (x) and back from the speakers (y). */
export interface ListeningSeat {
  x: number;
  y: number;
}

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

/** Per-viewer settings kept in local storage; a missing or unreadable value gives `fb`, and a failed write is ignored. */
export interface HifiStorage {
  get<T>(k: string, fb: T): T;
  set(k: string, v: unknown): void;
}

export interface HifiPlanner {
  woofer: HifiWoofer;
  setWoofer: Setter<HifiWoofer>;
  tweeter: HifiTweeter;
  setTweeter: Setter<HifiTweeter>;
  selectedWaveguide: Horn;
  setSelectedWaveguide: Setter<Horn>;
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
  storage: HifiStorage;
  waveguideChoices: Horn[];
  store: ReturnType<typeof useConfigStore>;
}

/** The Hi-fi page's design, room and optimizer state. Held by App so it survives switching tabs. */
export function useHifiPlanner(): HifiPlanner {
  const waveguideChoices = HORN_OPTIONS.filter((h) => h.exit === 1 && h.hf && h.hf.covH && h.size);
  const [woofer, setWoofer] = useState(HIFI_WOOFERS.find((o) => o.pick) || HIFI_WOOFERS[0]);
  const [tweeter, setTweeter] = useState(HIFI_TWEETERS.find((o) => o.pick) || HIFI_TWEETERS[0]);
  const [selectedWaveguide, setSelectedWaveguide] = useState(
    waveguideChoices.find((g) => g.id === "st260") || waveguideChoices[0],
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
  const storage: HifiStorage = {
    get: (k, fb) => {
      try {
        const v = localStorage.getItem(k);
        return v == null ? fb : JSON.parse(v);
      } catch {
        return fb;
      }
    },
    set: (k, v) => {
      try {
        localStorage.setItem(k, JSON.stringify(v));
      } catch {}
    },
  };
  const [isOptimizerOn, setIsOptimizerOnState] = useState(() => storage.get("hifi.opt", false));
  const setIsOptimizerOn = (v: boolean) => {
    setIsOptimizerOnState(v);
    storage.set("hifi.opt", v);
  };
  const [optimizerGoals, setOptimizerGoals] = useState<HifiGoal[]>([]);
  const [optimizerBudget, setOptimizerBudget] = useState(() => storage.get("hifi.budget", 800));
  const [optimizerLocks, setOptimizerLocksState] = useState<HifiPlannerLocks>(() => {
    const l = storage.get<HifiOptimizerLocks>("hifi.locks", {}) || {};
    return { ...l, dim: { ...l.dim } };
  });
  const setOptimizerLocks = (f: (p: HifiPlannerLocks) => HifiPlannerLocks) =>
    setOptimizerLocksState((p) => {
      const n = f(p);
      storage.set("hifi.locks", n);
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
    storage,
    waveguideChoices,
    store,
  };
}
