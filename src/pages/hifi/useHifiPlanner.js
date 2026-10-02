import { HORN_OPTIONS, HIFI_WOOFERS, HIFI_TWEETERS } from "../../lib/data.ts";
import { useConfigStore } from "../../components/saved-configs/useConfigStore.js";
import { useState } from "react";

/** The Hi-fi page's design, room and optimizer state. Held by App so it survives switching tabs. */
export function useHifiPlanner() {
  const waveguideChoices = HORN_OPTIONS.filter((h) => h.exit === 1 && h.hf && h.hf.covH && h.size);
  const [woofer, setWoofer] = useState(HIFI_WOOFERS.find((o) => o.pick) || HIFI_WOOFERS[0]);
  const [tweeter, setTweeter] = useState(HIFI_TWEETERS.find((o) => o.pick) || HIFI_TWEETERS[0]);
  const [selectedWaveguide, setSelectedWaveguide] = useState(
    waveguideChoices.find((g) => g.id === "st260") || waveguideChoices[0],
  );
  const [boxType, setBoxType] = useState("vented");
  const [boxDims, setBoxDims] = useState({ w: 9, h: 15, d: 11 });
  const [wallThicknessIn, setWallThicknessIn] = useState(0.75);
  const [panelMaterial, setPanelMaterial] = useState("ply");
  const [portSpec, setPortSpec] = useState({ n: 1, dia: 2, len: 6 });
  const [radiatorSelection, setRadiatorSelection] = useState({ id: "sb16pfcr", n: 2, addG: 0 });
  const [crossoverHz, setCrossoverHz] = useState(2000);
  const [crossoverOrder, setCrossoverOrder] = useState(4);
  const [wooferAmpWatts, setWooferAmpWatts] = useState(100);
  const [tweeterAmpWatts, setTweeterAmpWatts] = useState(50);
  const [baffleStepCompensationDb, setBaffleStepCompensationDb] = useState(3);
  const [placement, setPlacement] = useState("free");
  const [distanceToWallFt, setDistanceToWallFt] = useState(2);
  const [speakerSpacingFt, setSpeakerSpacingFt] = useState(7);
  const [toeInDeg, setToeInDeg] = useState(15);
  const [listeningSeat, setListeningSeat] = useState({ x: 0, y: 8 });
  const [earHeightIn, setEarHeightIn] = useState(38);
  const [standHeightIn, setStandHeightIn] = useState(24);
  const [dispersionPlane, setDispersionPlane] = useState("h");
  const store = useConfigStore("hifiConfigs");
  // optimizer: same rules and layout as the PA planner's (switch, locks on the controls, goals in tap order)
  const storage = {
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
  const setIsOptimizerOn = (v) => {
    setIsOptimizerOnState(v);
    storage.set("hifi.opt", v);
  };
  const [optimizerGoals, setOptimizerGoals] = useState([]);
  const [optimizerBudget, setOptimizerBudget] = useState(() => storage.get("hifi.budget", 800));
  const [optimizerLocks, setOptimizerLocksState] = useState(() => {
    const l = storage.get("hifi.locks", {}) || {};
    return { ...l, dim: { ...(l.dim || {}) } };
  });
  const setOptimizerLocks = (f) =>
    setOptimizerLocksState((p) => {
      const n = f(p);
      storage.set("hifi.locks", n);
      return n;
    });
  const [optimizerResult, setOptimizerResult] = useState(null);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [designPreview, setDesignPreview] = useState(null); // { label, before, card }
  const [undoSnapshot, setUndoSnapshot] = useState(null);
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
