const { useEffect, useRef, useState } = React;
import { ToggleButton } from "./components/ui/ToggleButton.jsx";
import { Button } from "./components/ui/Button.jsx";
import { Tooltip } from "./components/ui/Tooltip.jsx";
import { SwatchPicker } from "./components/ui/SwatchPicker.jsx";
import { Card } from "./components/ui/Card.jsx";
import { SectionHeading } from "./components/ui/SectionHeading.jsx";
import { SelectField } from "./components/ui/SelectField.jsx";
import { Slider } from "./components/ui/Slider.jsx";
import { FoldHeading } from "./components/ui/FoldHeading.jsx";
import { ResponseChart } from "./components/charts/ResponseChart.jsx";
import { DispersionMap } from "./components/charts/DispersionMap.jsx";
import { LockButton } from "./components/lock/LockButton.jsx";
import { LOCK_KEYS } from "./constants/lockKeys.js";
import { DimensionLock } from "./components/lock/DimensionLock.jsx";
import { runPaOptimizer } from "./lib/pa/runOptimizer.js";
import { CHIP_BACKGROUND_CLASSES } from "./components/optimizer/OptimizerResultCard.jsx";
import { OptimizerPanel } from "./components/optimizer/OptimizerPanel.jsx";
import { OptimizerBar } from "./components/optimizer/OptimizerBar.jsx";
import { StatLabel, StatRow } from "./components/optimizer/StatRow.jsx";
import { useConfigStore } from "./components/saved-configs/useConfigStore.js";
import { SavedConfigs } from "./components/saved-configs/SavedConfigs.jsx";
import { subChips, midChips, hornChips } from "./lib/pa/chips.js";
import { evaluateDesign as evaluateConfig, pickOptimizedFields } from "./lib/pa/optimize.js";
import { SUB_OPTIONS, MID_OPTIONS, MID_BOXES, CD_OPTIONS, HORN_OPTIONS, PAINT_SWATCHES, CABINET_FINISHES, CABINETS, FORMATS } from "./lib/data.js";
import { paDispersionMap, firstNullAngleDeg } from "./lib/pa/dispersion.js";
import { subSystem, maxOutputCurve as maxCurveOf, hornResponse, pistonBeamWidthDeg, keeleFrequency, hornBeamWidthDeg, subWeightLb, midWeightLb, HIGHPASS_ALIGNMENTS, midSystem, subThroughLowpass, subMusicOutputAt } from "./lib/pa/calc.js";
import { NotesPage } from "./pages/notes/NotesPage.jsx";
import { FillsPage } from "./pages/fills/FillsPage.jsx";
import { CutlistPage } from "./pages/cutlist/CutlistPage.jsx";
import { HifiPage } from "./pages/hifi/HifiPage.jsx";
import { StackView3D } from "./components/stack-view/StackView3D.jsx";



function StackPlanner() {
  const viewOf = () => (window.location.hash === "#notes" ? "notes" : window.location.hash === "#fills" ? "fills" : window.location.hash === "#hifi" ? "hifi" : window.location.hash === "#cutlist" ? "cutlist" : "planner");
  const [view, setView] = useState(viewOf);
  useEffect(() => {
    const on = () => setView(viewOf());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  const [subDriver, setSubDriver] = useState(SUB_OPTIONS.find((o) => o.id === "sbnero18"));
  const [midDriver, setMidDriver] = useState(MID_OPTIONS.find((o) => o.id === "sbnero12"));
  const [hornOption, setHornOption] = useState(HORN_OPTIONS.find((h) => h.id === "a400g2"));
  const [compressionDriver, setCompressionDriver] = useState(CD_OPTIONS.find((c) => c.id === "de360"));
  const [midBoxPreset, setMidBoxPreset] = useState(MID_BOXES.find((o) => o.id === "b15"));   // last preset loaded
  const [midBoxDims, setMidBoxDims] = useState({ ...MID_BOXES.find((o) => o.id === "b15").box });
  const [subMidCrossoverHz, setSubMidCrossoverHz] = useState(120);         // sub -> mid crossover, LR24
  const [midHornCrossoverHz, setMidHornCrossoverHz] = useState(900);         // mid -> horn crossover, LR24
  const [dispersionPlane, setDispersionPlane] = useState("v");    // dispersion map: vertical (lobing) or horizontal
  const [midAmpWatts, setMidAmpWatts] = useState(400);       // amp power per mid channel, into 8 Ω
  const [midBandTiltDb, setMidBandTiltDb] = useState(6);           // how much less the mid band needs than the sub band, dB
  const [hornAmpWatts, setHornAmpWatts] = useState(100);     // amp power per HF channel, rated into 8 Ω
  const [hornBandTiltDb, setHornBandTiltDb] = useState(6);       // how much less the horn band needs than the mid band, dB
  const setMidBoxDim = (k, v) => setMidBoxDims((p) => ({ ...p, [k]: v }));
  const plinthHeightIn = 3; // fixed, matches the duct height
  const [cutaway, setCutaway] = useState(false);
  const [cabinet] = useState(CABINETS[0]);
  const [portStyle, setPortStyle] = useState("slots");
  const [layout, setLayout] = useState("stack");
  const format = FORMATS[0];   // 18″ sub + compression driver; mid is 12″ or 15″
  const [midSize, setMidSize] = useState(12);
  const [wallThicknessIn, setWallThicknessIn] = useState(0.75);   // side/top/bottom/back ply, in
  const [baffleInsetIn, setBaffleInsetIn] = useState(0.75); // how far the baffles sit back from the frame front, in
  const [baffleColor, setBaffleColor] = useState(PAINT_SWATCHES.find(([, name]) => name === "Dusty pink")[0]);
  const [cabinetFinish, setCabinetFinish] = useState("birch");
  const [spacerHeightIn, setSpacerHeightIn] = useState(20);
  const [showDetails, setShowDetails] = useState(false);
  // phones: settings live in a bottom sheet with tabs; result sections fold (remembered per viewer)
  const [isSettingsSheetOpen, setSettingsSheetOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("sub");
  const tabClass = (t) => (activeTab === t ? "" : "max-md:hidden");
  const [expandedSections, setExpandedSections] = useState(() => {
    try { return { sub: true, mid: false, horn: false, totals: false, ...JSON.parse(localStorage.getItem("planner.folds") || "{}") }; }
    catch { return { sub: true, mid: false, horn: false, totals: false }; }
  });
  const toggleSection = (id) => setExpandedSections((f) => { const n = { ...f, [id]: !f[id] }; try { localStorage.setItem("planner.folds", JSON.stringify(n)); } catch {} return n; });
  const sectionClass = (id) => (expandedSections[id] ? "" : "max-md:hidden");
  const [isFull3d, setIsFull3d] = useState(false);
  // optimizer: switch, inputs and locks remembered per viewer
  const readStoredJson = (k, fb) => { try { const v = localStorage.getItem(k); return v == null ? fb : JSON.parse(v); } catch { return fb; } };
  const writeStoredJson = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
  const [isOptimizerOn, setIsOptimizerOnState] = useState(() => readStoredJson("planner.opt", false));
  const setIsOptimizerOn = (v) => { setIsOptimizerOnState(v); writeStoredJson("planner.opt", v); };
  // goals start empty on every load (not restored), so a search always starts from a goal you just picked
  const [optimizerInput, setOptimizerInputState] = useState(() => { const { budgetPer, goal, goals, ...o } = readStoredJson("planner.optIn", {}) || {};
    return { room: 1000, maxLb: 125, budget: 900, ...o, goals: [] }; });
  const updateOptimizerInput = (o) => setOptimizerInputState((p) => { const n = { ...p, ...o }; writeStoredJson("planner.optIn", n); return n; });
  const [optimizerLocks, setOptimizerLocksState] = useState(() => { const l = readStoredJson("planner.locks", {}) || {}; return { ...l, subDim: { ...(l.subDim || {}) }, midDim: { ...(l.midDim || {}) } }; });
  const setOptimizerLocks = (f) => setOptimizerLocksState((p) => { const n = f(p); writeStoredJson("planner.locks", n); return n; });
  const renderLockButton = (key, what) => isOptimizerOn ? <LockButton on={!!optimizerLocks[key]} what={what} onClick={() => setOptimizerLocks((p) => ({ ...p, [key]: !p[key] }))} /> : null;
  const renderDimensionLock = (box, dim, what) => isOptimizerOn ? <DimensionLock mode={optimizerLocks[box][dim] || "free"} what={what} onChange={(m) => setOptimizerLocks((p) => ({ ...p, [box]: { ...p[box], [dim]: m } }))} /> : null;
  const [optimizerResult, setOptimizerResult] = useState(null);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizerError, setOptimizerError] = useState("");
  const [designPreview, setDesignPreview] = useState(null);   // { label, before }
  const [undoSnapshot, setUndoSnapshot] = useState(null);
  const [toastMessage, setToastMessage] = useState("");
  useEffect(() => {
    if (!isFull3d) return;
    const esc = (e) => { if (e.key === "Escape") setIsFull3d(false); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [isFull3d]);
  const [cornerJoint, setCornerJoint] = useState("butt");       // cutlist corner joints
  const [plywoodSheetKind, setPlywoodSheetKind] = useState("4x8");
  const [boxSetCount, setBoxSetCount] = useState(2);   // how many sets of boxes the cutlist covers
  // Every cabinet is custom; the preset list below is only a starting point.
  const [subBoxDims, setSubBoxDims] = useState({ w: 28, h: 32, d: 24 });
  const [subVentSpec, setSubVentSpec] = useState({ slotH: 3, nt: 2, dia: 6, throat: 3, len: 14 });
  const [subHighpassHz, setSubHighpassHz] = useState(33);
  const [subHighpassType, setSubHighpassType] = useState("BW24");   // sub highpass alignment
  const [subAmpWatts, setSubAmpWatts] = useState(800);   // amp power per sub channel, into 8 Ω
  const [maxPortAirSpeedMs, setMaxPortAirSpeedMs] = useState(20);   // peak port air speed allowed, m/s
  const setSubBoxDim = (k, v) => setSubBoxDims((p) => ({ ...p, [k]: v }));
  const setSubVentField = (k, v) => setSubVentSpec((p) => ({ ...p, [k]: v }));

  // ---- saved configurations, backed by the artifact's document store ----
  const store = useConfigStore("configs");
  const { db, saved, fb, fbUser, cfgMsg, setCfgMsg, signIn, signOut } = store;
  // One-time copy of the configs saved in the claude.ai artifact (data/configs-seed.json).
  const importSeed = async () => {
    if (!db) return;
    setCfgMsg("Importing…");
    try {
      const rows = await (await fetch("configs-seed.json")).json();
      const have = new Set((saved || []).map((c) => c.name));
      let n = 0;
      for (const { id, ...c } of rows) {
        if (have.has(c.name)) continue;
        await db.collection("configs").doc(id).set(c); n++;
      }
      setCfgMsg(n ? `Imported ${n}` : "Nothing new to import");
    } catch { setCfgMsg("Couldn't import"); }
    setTimeout(() => setCfgMsg(""), 2500);
  };
  // In the tower layout the mid chamber is the sub's footprint, 15.5 in tall.
  const effectiveMidBoxDims = layout === "tower" ? { w: subBoxDims.w, h: 15.5, d: subBoxDims.d } : midBoxDims;
  const midWithBox = { ...midDriver, box: effectiveMidBoxDims };
  const subDriverChoices = SUB_OPTIONS.filter((o) => o.size === format.sub);
  const midDriverChoices = MID_OPTIONS.filter((o) => (o.size || 12) === midSize);
  const midBoxChoices = MID_BOXES.filter((b) => (b.size || 12) === midSize && b.id !== "b13");
  const subBox = subBoxDims;
  const subWithBox = { ...subDriver, box: subBox };
  useEffect(() => {
    const pickOf = (list) => list.find((o) => o.pick) || list[0];
    if (subDriverChoices.length) setSubDriver(pickOf(subDriverChoices));
    if (midDriverChoices.length) setMidDriver(pickOf(midDriverChoices));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [format]);
  // Switching 12/15 picks that size's default driver and box; restoring a config sets them itself.
  const skipSizeReset = useRef(true);
  useEffect(() => {
    if (skipSizeReset.current) { skipSizeReset.current = false; return; }
    const pickOf = (list) => list.find((o) => o.pick) || list[0];
    if (midDriverChoices.length) setMidDriver(pickOf(midDriverChoices));
    if (midBoxChoices.length) { const b = pickOf(midBoxChoices); setMidBoxPreset(b); setMidBoxDims({ ...b.box }); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [midSize]);
  const hornExitMismatch = hornOption.exit !== compressionDriver.exit;

  // Port geometry, matching what the 3D view draws, so the table and the
  // model describe the same box.
  const PT = wallThicknessIn;
  const { port, grossL: subGrossLiters, netL: subNetLiters, AMP_V: subAmpVoltage, mdl: subModel, lim: subLimits } = subSystem(subDriver, midDriver, {
    subBox, midDims: midBoxDims, wall: wallThicknessIn, inset: baffleInsetIn, portStyle, cVent: subVentSpec, hpf: subHighpassHz, hpType: subHighpassType, ampW: subAmpWatts, portMax: maxPortAirSpeedMs, layout });
  // Max SPL for a sine at each frequency (each frequency meets its own port and excursion limits);
  // the broadband limit above is what applies to music.
  const subMaxCurve = subModel ? maxCurveOf(subModel.curve, subDriver.ts, subAmpVoltage, maxPortAirSpeedMs) : null;
  const subMaxCurveNearest = (f) => subMaxCurve.reduce((b, o) => (Math.abs(o.f - f) < Math.abs(b.f - f) ? o : b));

  // ---- mid-bass: sealed box ----
  const { V: midVoltage, grossL: midGrossL, netL: midNetL, effL: midEffL, mdl: midModel, vTherm: midThermalVoltage, max: midMaxCurve, useV: midUsedVoltage } =
    midSystem(midDriver, { midDims: effectiveMidBoxDims, wall: wallThicknessIn, inset: baffleInsetIn, xoLo: subMidCrossoverHz, xoHi: midHornCrossoverHz, mAmpW: midAmpWatts });
  // 3/4" baffle at 2.3 lb/ft\u00b2, other panels and one brace at the chosen ply, plus 2 lb of hardware
  const midCabinetLb = midWeightLb(effectiveMidBoxDims, wallThicknessIn);
  const midWeightLoadedLb = midCabinetLb + (midDriver.lb || 0);
  const midMaxCurveNearest = (f) => midMaxCurve.reduce((b, o) => (Math.abs(o.f - f) < Math.abs(b.f - f) ? o : b));
  // Sub through its lowpass at the crossover, for the system chart. Its own limits scale with the filter.
  const subThroughLowpassCurve = subModel ? subThroughLowpass(subModel, subDriver.ts, subAmpVoltage, maxPortAirSpeedMs, subMidCrossoverHz) : null;
  // What the mid actually has to match: the sub at its music limit (one drive level for
  // the whole band), through its lowpass, less the music-balance allowance.
  // ---- horn + compression driver ----
  // Datasheet model, not T/S: on-horn sensitivity + 10 log P, shaped by the LR24
  // highpass at the crossover and a 12 dB/oct rolloff below the horn's loading limit.
  // Power: amp voltage into the driver's impedance, capped at program (2 x AES), derated
  // 6 dB per octave when crossing below the frequency the AES rating was measured at.
  const compressionDriverSpec = compressionDriver.hf, hornSpec = hornOption.hf || {};
  const hornModel = hornResponse(compressionDriverSpec, hornSpec, midHornCrossoverHz, hornAmpWatts);
  const hornSplAt = (f) => hornModel.curve.reduce((b, o) => (Math.abs(o.f - f) < Math.abs(b.f - f) ? o : b)).spl;
  // mid beamwidth at the horn crossover, as a rigid piston: -6 dB where ka sin(theta) = 2.2
  const midBeamWidthDeg = midDriver.ts ? pistonBeamWidthDeg(midDriver.ts.Sd, midHornCrossoverHz) : null;
  // Horizontal beamwidth against frequency: mid as a rigid piston, horn at its rated coverage down
  // to Keele's pattern-control limit and proportionally wider below. Rules of thumb.
  const beamCurves = (() => {
    const hz0 = hornOption.hf || {};
    const fK = hz0.covH && hornOption.size ? keeleFrequency(hz0.covH, hornOption.size.w) : null;
    const midB = [], hornB = [];
    for (let i = 0; i < 160; i++) {
      const f = 200 * Math.pow(10000 / 200, i / 159);
      if (midDriver.ts) midB.push({ f, spl: pistonBeamWidthDeg(midDriver.ts.Sd, f) });
      if (fK && f >= (hz0.lowHz || 0) * 0.7) hornB.push({ f, spl: hornBeamWidthDeg(hz0.covH, fK, f) });
    }
    return { midB, hornB, fK };
  })();

  const subMusicAtCrossover = subModel && subLimits ? subMusicOutputAt(subModel, subLimits, subAmpVoltage, subMidCrossoverHz) : null;

  const portGeom = { ductH: subVentSpec.slotH, nPorts: subVentSpec.nt, portR: subVentSpec.dia / 2, tubeLen: subVentSpec.len, throat: subVentSpec.throat };

  // One named snapshot of the whole system.
  const snapshot = () => ({
    format: format.id, sub: subDriver.id, mid: midDriver.id, midBox: midBoxPreset.id, cd: compressionDriver.id, horn: hornOption.id,
    cabinet: cabinet.id, portStyle, cDim: subBoxDims, cVent: subVentSpec, hpf: subHighpassHz, hpType: subHighpassType, ampW: subAmpWatts, portMax: maxPortAirSpeedMs, mDim: midBoxDims, wall: wallThicknessIn, inset: baffleInsetIn, xoLo: subMidCrossoverHz, xoHi: midHornCrossoverHz, mAmpW: midAmpWatts, tilt: midBandTiltDb, hfAmpW: hornAmpWatts, hfTilt: hornBandTiltDb,
    layout, cutaway, baffleColor, cabFinish: cabinetFinish, spacerH: spacerHeightIn, joint: cornerJoint,
    summary: `${subDriver.name} · ${subBox.w}×${subBox.h}×${subBox.d}″ · ${port.area.toFixed(0)} in² · ${subModel ? subModel.Fb.toFixed(1) + " Hz" : "—"}`
  });
  const restore = (c) => {
    const find = (list, id, fb) => list.find((o) => o.id === id) || fb;
    if (c.wall === 0.5 || c.wall === 0.75) setWallThicknessIn(c.wall); else setWallThicknessIn(0.75);
    setBaffleInsetIn(typeof c.inset === "number" ? c.inset : 0.75);
    if (c.sub) setSubDriver(find(SUB_OPTIONS, c.sub, subDriver));
    if (c.mid) { const m = find(MID_OPTIONS, c.mid, midDriver); skipSizeReset.current = (m.size || 12) !== midSize; setMidSize(m.size || 12); setMidDriver(m); }
    if (c.midBox) setMidBoxPreset(find(MID_BOXES, c.midBox, midBoxPreset));
    if (c.cd) setCompressionDriver(find(CD_OPTIONS, c.cd, compressionDriver));
    if (c.horn) setHornOption(find(HORN_OPTIONS, c.horn, hornOption));
    if (c.cDim) setSubBoxDims(c.cDim);
    if (c.cVent) setSubVentSpec(c.cVent);
    if (typeof c.hpf === "number") setSubHighpassHz(c.hpf);
    if (c.hpType && HIGHPASS_ALIGNMENTS[c.hpType]) setSubHighpassType(c.hpType);
    if (typeof c.ampW === "number") setSubAmpWatts(c.ampW);
    if (typeof c.portMax === "number") setMaxPortAirSpeedMs(c.portMax);
    if (c.mDim) setMidBoxDims(c.mDim); else if (c.midBox) { const b = MID_BOXES.find((x) => x.id === c.midBox); if (b) setMidBoxDims({ ...b.box }); }
    if (typeof c.xoLo === "number") setSubMidCrossoverHz(c.xoLo);
    if (typeof c.xoHi === "number") setMidHornCrossoverHz(c.xoHi);
    if (typeof c.mAmpW === "number") setMidAmpWatts(c.mAmpW);
    if (typeof c.tilt === "number") setMidBandTiltDb(c.tilt);
    if (typeof c.hfAmpW === "number") setHornAmpWatts(c.hfAmpW);
    if (typeof c.hfTilt === "number") setHornBandTiltDb(c.hfTilt);
    if (typeof c.cutaway === "boolean") setCutaway(c.cutaway);
    if (c.layout) setLayout(c.layout);
    if (c.baffleColor) setBaffleColor(c.baffleColor);
    setCabinetFinish(c.cabFinish || "birch");
    setSpacerHeightIn(typeof c.spacerH === "number" ? c.spacerH : 20);
    if (c.joint) setCornerJoint(c.joint);
    if (c.portStyle) setPortStyle(c.portStyle);
  };
  // ---- optimizer actions ----
  const today = () => new Date().toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const startOptimizerSearch = async (over) => {
    const inp = { ...optimizerInput, ...(over && over.nativeEvent ? {} : over || {}) };
    if (over && !over.nativeEvent) updateOptimizerInput(over);
    if (!inp.goals.length) return;
    setIsOptimizing(true); setOptimizerError("");
    try {
      const cur = designPreview ? designPreview.before : snapshot();
      setOptimizerResult(await runPaOptimizer({ cur, room: inp.room, maxLb: inp.maxLb, budget: inp.budget, goals: inp.goals, locks: optimizerLocks }));
    } catch (e) { setOptimizerError("The search failed: " + ((e && e.message) || e)); }
    setIsOptimizing(false);
  };
  // a result only sets the fields the search changes; finish, colours, layout and balance stay as they are now
  const previewOptimizerResult = (k) => {
    const before = designPreview ? designPreview.before : snapshot();
    restore({ ...snapshot(), ...pickOptimizedFields(k.config) }); setDesignPreview({ label: k.label, before, card: k });
  };
  const exitPreview = () => { if (designPreview) restore(designPreview.before); setDesignPreview(null); };
  const loadOptimizerResult = async (k) => {
    const before = designPreview ? designPreview.before : snapshot();
    restore({ ...snapshot(), ...pickOptimizedFields(k.config) }); setDesignPreview(null); setUndoSnapshot(before);
    let msg = `Loaded "${k.label}".`;
    if (db) {
      const name = `Before optimizer, ${today()}`;
      try { await db.collection("configs").doc().set({ ...before, name, savedAt: Date.now() }); msg += ` Your previous design was saved as "${name}".`; }
      catch { msg += " Undo brings your previous design back."; }
    } else msg += " Undo brings your previous design back.";
    setToastMessage(msg);
  };
  const undoOptimizerLoad = () => { if (undoSnapshot) restore(undoSnapshot); setUndoSnapshot(null); setToastMessage(""); };
  const saveOptimizerResult = async (k) => {
    if (!db) return;
    const name = window.prompt("Name this design", `${k.label} · ${today()}`);
    if (!name) return;
    const m = k.metrics;
    try {
      await db.collection("configs").doc().set({ ...snapshot(), ...pickOptimizedFields(k.config), name: name.slice(0, 60), savedAt: Date.now(),
        summary: `${k.names.sub} · ${k.config.cDim.w}×${k.config.cDim.h}×${k.config.cDim.d}″ · ${m.Fb.toFixed(1)} Hz` });
      setToastMessage(`Saved "${name.slice(0, 60)}".`);
    } catch { setToastMessage("Couldn't save — try again"); }
  };
  const currentDesignOutput = isOptimizerOn ? (() => { try { const m = evaluateConfig(designPreview ? designPreview.before : snapshot()); return m ? m.out : null; } catch { return null; } })() : null;

  const subWeightLoadedLb = subWeightLb(subBox, wallThicknessIn, subDriver.lb);

  const midBoxLiters = midGrossL;
  const subTopHeightIn = plinthHeightIn + subBox.h;
  const isTower = layout === "tower";
  const stackBaseHeightIn = layout === "satellite" ? 34 : layout === "pole" ? subTopHeightIn + spacerHeightIn : isTower ? subTopHeightIn : subTopHeightIn + 0.4;
  const hasArchedTop = isTower && !!hornOption.profile && !hornOption.scaleX && subBox.w / 2 - 0.75 > hornOption.size.w / 2;
  const stackHeightIn = isTower ? stackBaseHeightIn + 15.5 + (hasArchedTop ? subBox.w - 0.75 : hornOption.size.h + 2) : stackBaseHeightIn + effectiveMidBoxDims.h + 1.2 + hornOption.size.h + 2;
  const hornCenterHeightIn = isTower ? stackBaseHeightIn + 15.5 + (hasArchedTop ? subBox.w / 2 - 0.75 : (hornOption.size.h + 2) / 2) : stackBaseHeightIn + effectiveMidBoxDims.h + 1.2 + 1 + hornOption.size.h / 2;
  // driver heights for the dispersion map: mid centered in its box (or the tower's mid section), sub at its box center
  const midCenterHeightIn = isTower ? stackBaseHeightIn + 15.5 / 2 : stackBaseHeightIn + effectiveMidBoxDims.h / 2;
  const dispersionMapDistanceM = 10;
  const paDispersion = midDriver.ts && hornSpec.covH && hornOption.size ? paDispersionMap({
    sub: subDriver.ts ? { zIn: plinthHeightIn + subBox.h / 2, Sd: subDriver.ts.Sd } : null, mid: { zIn: midCenterHeightIn, Sd: midDriver.ts.Sd },
    horn: { zIn: hornCenterHeightIn, covH: hornSpec.covH, covV: hornSpec.covV || hornSpec.covH, wIn: hornOption.size.w, hIn: hornOption.size.h }, xoLo: subMidCrossoverHz, xoHi: midHornCrossoverHz, order: 4,
  }, dispersionPlane, dispersionMapDistanceM) : null;
  const midHornGapIn = hornCenterHeightIn - midCenterHeightIn, midHornNullAngleDeg = firstNullAngleDeg(midHornGapIn, midHornCrossoverHz);

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900" style={{ fontFamily: "var(--font)" }}>
      <header className="px-4 md:px-8 pt-6 md:pt-8 pb-4 max-w-6xl mx-auto">
        {(() => {
          // two levels: the project (PA stack or hi-fi), then the PA stack's own pages
          const go = (v, href) => (e) => { e.preventDefault(); try { history.replaceState(null, "", v === "planner" ? " " : href); } catch {} setView(v); window.scrollTo(0, 0); };
          const pa = view !== "hifi";
          const top = [["planner", "PA Stack", "#", pa], ["hifi", "Hi-fi", "#hifi", !pa]];
          const sub = [["planner", "Design", "#"], ["cutlist", "Cutlist", "#cutlist"], ["fills", "Fills", "#fills"], ["notes", "Notes", "#notes"]];
          return (<>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <h1 className="text-3xl md:text-4xl leading-tight font-extrabold tracking-tight">SpeakNow</h1>
            <nav className="flex gap-1" style={{ fontFamily: "var(--font)" }} aria-label="Projects">
              {top.map(([v, label, href, on]) => (
                <a key={v} href={href} aria-current={on ? "page" : undefined} onClick={go(v, href)}
                  className={`px-4 py-2 rounded border-2 text-base font-semibold ${on ? "border-stone-900 bg-stone-900 text-stone-50" : "border-stone-300 hover:border-stone-500"}`}>{label}</a>
              ))}
            </nav>
            </div>
            {pa && (
              <nav className="flex gap-4 mt-3 border-b border-stone-300" style={{ fontFamily: "var(--font)" }} aria-label="PA stack pages">
                {sub.map(([v, label, href]) => (
                  <a key={v} href={href} aria-current={view === v ? "page" : undefined} onClick={go(v, href)}
                    className={`py-2 -mb-px border-b-2 text-sm ${view === v ? "border-stone-900 font-semibold" : "border-transparent text-stone-500 hover:text-stone-900"}`}>{label}</a>
                ))}
              </nav>
            )}
          </>);
        })()}
      </header>
      {view === "notes" ? <NotesPage /> : view === "fills" ? <FillsPage /> : view === "hifi" ? <HifiPage /> : view === "cutlist" ? <CutlistPage {...{ sub: subDriver, mid: midDriver, subBox, midDims: effectiveMidBoxDims, wall: wallThicknessIn, inset: baffleInsetIn, joint: cornerJoint, setJoint: setCornerJoint, sheetKind: plywoodSheetKind, setSheetKind: setPlywoodSheetKind, sets: boxSetCount, setSets: setBoxSetCount, portStyle, cVent: subVentSpec, layout }} /> : <>

      <SavedConfigs store={store} snapshot={snapshot} restore={restore}
        extra={fbUser && <button onClick={importSeed} className="hover:underline">Import saved configs</button>} />

      <section className="max-w-6xl mx-auto px-4 md:px-8 pb-3" style={{ fontFamily: "var(--font)" }}>
        {(() => {
          const n = Object.entries(optimizerLocks).reduce((a, [k, v]) => a + (k.endsWith("Dim") ? Object.values(v).filter((m) => m && m !== "free").length : v ? 1 : 0), 0);
          // lock everything (box sizes exact), then unlock the one or two things you want the optimizer to change
          const all = { ...Object.fromEntries(LOCK_KEYS.map((k) => [k, true])), subDim: { w: "exact", h: "exact", d: "exact" }, midDim: { w: "exact", h: "exact", d: "exact" } };
          return <OptimizerBar on={isOptimizerOn} onToggle={() => setIsOptimizerOn(!isOptimizerOn)} hint="Find cheaper, lighter or louder designs inside your limits."
            nLocks={n} lockMax={LOCK_KEYS.length + 6} onLockAll={() => setOptimizerLocks(() => all)} onClear={() => setOptimizerLocks(() => ({ subDim: {}, midDim: {} }))} />;
        })()}
      </section>
      {isOptimizerOn && <OptimizerPanel optIn={optimizerInput} setOpt={updateOptimizerInput} run={startOptimizerSearch} busy={isOptimizing} res={optimizerResult} err={optimizerError} curOut={currentDesignOutput} 
        previewCard={designPreview && designPreview.card} canSave={!!db}
        onPreview={previewOptimizerResult} onLoad={loadOptimizerResult} onSave={saveOptimizerResult} />}
      {designPreview && (
        <div className="fixed top-0 inset-x-0 z-50 bg-stone-900 text-white border-b-4 border-cmy-y px-4 py-2 flex flex-wrap items-center justify-center gap-3 text-sm" style={{ fontFamily: "var(--font)" }}>
          <span>Previewing: <b className="font-semibold">{designPreview.label}</b></span>
          <Button variant="primary" size="xs" onClick={() => loadOptimizerResult(designPreview.card)}>Load</Button>
          <button onClick={exitPreview} className="px-3 py-1.5 rounded border border-stone-900 bg-white">Back</button>
        </div>
      )}
      {toastMessage && (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-20 md:bottom-6 z-50 w-[calc(100%-2rem)] max-w-xl bg-stone-900 text-stone-50 rounded-lg px-4 py-2.5 flex items-center gap-3 text-sm shadow-lg" style={{ fontFamily: "var(--font)" }} role="status">
          <span className="flex-1">{toastMessage}</span>
          {undoSnapshot && <button onClick={undoOptimizerLoad} className="px-3 py-1.5 rounded border border-stone-500">Undo</button>}
          <button onClick={() => setToastMessage("")} aria-label="Dismiss" className="px-2 py-1.5 rounded border border-stone-900">✕</button>
        </div>
      )}
      {subModel && subLimits && (
        <div className="md:hidden sticky top-0 z-30 bg-stone-50/95 backdrop-blur border-b border-stone-300 px-4 py-1.5 grid grid-cols-4 gap-2 text-center" style={{ fontFamily: "var(--font)" }}>
          {[["Fb", `${subModel.Fb.toFixed(1)}`, "Hz"], ["35 Hz", `${subMaxCurveNearest(35).spl.toFixed(0)}`, "dB"], ["Sub", `${subWeightLoadedLb.toFixed(0)}`, "lb"], ["Limit", { "port air speed": "port", "cone travel (Xmax)": "Xmax", "driver program rating": "thermal", "amplifier power": "amp" }[subLimits.who] || subLimits.who, ""]].map(([k, v, u]) => (
            <div key={k}><div className="text-xs uppercase tracking-wider text-stone-500">{k}</div><div className="text-sm font-medium tabular-nums">{v}<span className="text-xs text-stone-500 ml-0.5">{u}</span></div></div>
          ))}
        </div>
      )}
      <main className={`max-w-6xl mx-auto px-4 md:px-8 pb-16 grid ${isSettingsSheetOpen ? "max-md:pb-[52dvh]" : "max-md:pb-24"} grid-cols-1 md:grid-cols-5 gap-8`}>
        <div className="min-w-0 md:col-span-3 flex flex-col gap-5">
        <section className={isFull3d ? "fixed inset-0 z-50 bg-stone-50" : "relative rounded-lg overflow-hidden border border-stone-300 bg-stone-50 h-[300px] md:h-[clamp(320px,56vh,560px)]"}>
          <button onClick={() => setIsFull3d((v) => !v)} aria-label={isFull3d ? "Close full screen" : "Full screen"} title={isFull3d ? "Close full screen" : "Full screen"}
            className="absolute top-2 right-2 z-10 w-9 h-9 inline-flex items-center justify-center rounded border border-stone-300 bg-white/90 hover:border-stone-500">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {isFull3d ? <path d="M4 4l8 8M12 4l-8 8" /> : <path d="M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10" />}
            </svg>
          </button>
          <StackView3D sub={subWithBox} mid={midWithBox} horn={hornOption} plinth={plinthHeightIn} cutaway={cutaway} portStyle={portStyle} layout={layout} baffleColor={baffleColor} portGeom={portGeom} wall={wallThicknessIn} inset={baffleInsetIn} cabFinish={cabinetFinish} spacerH={spacerHeightIn} />
        </section>

        <section className="mt-1" style={{ fontFamily: "var(--font)" }}>
          <FoldHeading id="sub" title="Sub" folds={expandedSections} toggle={toggleSection} className="mb-3 md:hidden" />
          <div className={sectionClass("sub")}>
          {subModel && subLimits && (
            <div className="grid gap-px mb-4 rounded-lg overflow-hidden border border-stone-300 bg-stone-300 grid-cols-2 sm:grid-cols-[repeat(auto-fit,minmax(112px,1fr))] [&>*:last-child:nth-child(odd)]:col-span-2 sm:[&>*:last-child:nth-child(odd)]:col-span-1">
              {[
                ["Net volume", subNetLiters.toFixed(0), "L"],
                ["Tuning Fb", subModel.Fb.toFixed(1), "Hz"],
                ["System F3", subModel.f3.toFixed(0), "Hz"],
                ["Max SPL @ 35 Hz", subMaxCurveNearest(35).spl.toFixed(1), "dB"],
                ["Weight", subWeightLoadedLb.toFixed(0), "lb"],
              ].map(([k, v, u]) => (
                <div key={k} className="bg-stone-50 px-3 py-2.5">
                  <div className="text-xs uppercase tracking-wider text-stone-500 font-semibold"><StatLabel k={k} /></div>
                  <div className="text-xl font-medium tabular-nums mt-0.5 break-words">{v}<span className="text-xs text-stone-500 ml-0.5">{u}</span></div>
                </div>
              ))}
            </div>
          )}
          {subModel && subLimits && <div className="mb-4"><ResponseChart fmax={20000} series={[{ curve: subThroughLowpassCurve, label: "Sub", stroke: PAL.ink, tint: PAL.alpha(PAL.ink, 0.07) }, ...(midMaxCurve ? [{ curve: midMaxCurve, label: "Mid-bass", stroke: PAL.magenta, tint: PAL.alpha(PAL.magenta, 0.06) }] : []), ...(hornModel ? [{ curve: hornModel.curve, label: "Horn", stroke: PAL.cyan, tint: PAL.alpha(PAL.cyan, 0.06) }] : [])]} marks={[{ f: subModel.Fb, label: "Fb" }, { f: subMidCrossoverHz, label: "XO" }, { f: midHornCrossoverHz, label: "XO" }]} /></div>}
          {subModel ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-0.5 text-sm">
              {[
                ["Gross internal", `${subGrossLiters.toFixed(0)} L`],
                ["Port area", `${port.area.toFixed(1)} in²`, `${((port.area / (subDriver.ts.Sd / 6.4516)) * 100).toFixed(0)}% of cone area`],
                ["Hydraulic diameter", `${port.dh.toFixed(2)}″`, port.dh < 2 ? "low — flare the mouths" : "acceptable with flares"],
                ["Midband sensitivity", `${(subModel.ref - 20 * Math.log10(subAmpVoltage / 2.83)).toFixed(1)} dB`, "2.83 V, half space, 1 m"],
                ...[30, 35, 45, 60].map((f) => { const m = subMaxCurveNearest(f);
                  return [`Max SPL at ${f} Hz`, `${m.spl.toFixed(1)} dB`, `sine, ${m.who}-limited`]; }),
                ["First limit, music", subLimits.who, `at ${Math.round(subLimits.W / 10) * 10} W`, `at ${Math.round(subLimits.W / 10) * 10} W${subLimits.who === "cone travel (Xmax)" ? `, reached first at ${subModel.peakXF.toFixed(0)} Hz` : subLimits.who === "port air speed" ? `, reached first at ${subModel.peakVelF.toFixed(0)} Hz` : ""}; the two rows below are at this power.`],
                ["Peak port velocity", `${subLimits.vel.toFixed(1)} m/s`, `at ${subModel.peakVelF.toFixed(0)} Hz`],
                ["Peak excursion", `${(subModel.peakX * subLimits.V / subAmpVoltage).toFixed(1)} mm`, `${subLimits.xPct.toFixed(0)}% of Xmax, at ${subModel.peakXF.toFixed(0)} Hz`],
              ]
.map(([k, v, note, tip]) => <StatRow key={k} k={k} v={v} note={note} tip={tip} />)}
            </div>
          ) : (
            <p className="text-sm text-stone-500 ">
              {subDriver.name} can't be modelled yet: its parameters are incomplete. {subDriver.note}
            </p>
          )}
          {subModel && subLimits && (
            <div className="flex flex-col gap-1.5 mt-4">
              {(() => {
                const F = subChips({ subSize: format.sub, subBox, portStyle, cVent: subVentSpec, PT, subLbLoaded: subWeightLoadedLb, lim: subLimits, peakXF: subModel.peakXF, aes: subDriver.ts.aes, ampW: subAmpWatts });
                return F.map(([kind, head, body]) => (
                  <div key={head} className={`block text-xs leading-relaxed px-3 py-2 rounded border ${CHIP_BACKGROUND_CLASSES[kind] || CHIP_BACKGROUND_CLASSES.ok}`}>
                    <b className={`font-semibold mr-1.5 ${kind === "ok" ? "text-green-800" : kind === "warn" ? "text-amber-700" : "text-red-700"}`}>{head}</b>
                    <span className="text-stone-500">{body}</span>
                  </div>
                ));
              })()}
            </div>
          )}
          </div>
        </section>

        <section className="mt-2" style={{ fontFamily: "var(--font)" }}>
          <FoldHeading id="mid" title="Mid-bass" folds={expandedSections} toggle={toggleSection} className="mb-3" />
          <div className={sectionClass("mid")}>
          {midModel ? (<>
            <div className="grid gap-px mb-4 rounded-lg overflow-hidden border border-stone-300 bg-stone-300 grid-cols-2 sm:grid-cols-[repeat(auto-fit,minmax(112px,1fr))] [&>*:last-child:nth-child(odd)]:col-span-2 sm:[&>*:last-child:nth-child(odd)]:col-span-1">
              {[
                ["Net volume", midNetL.toFixed(0), "L"],
                ["Box resonance Fc", midModel.Fc.toFixed(0), "Hz"],
                ["Box F3", midModel.f3.toFixed(0), "Hz"],
                [`Max SPL @ ${subMidCrossoverHz} Hz`, midMaxCurveNearest(subMidCrossoverHz).spl.toFixed(1), "dB"],
                ["Weight", midWeightLoadedLb.toFixed(0), "lb"],
              ].map(([k, v, u]) => (
                <div key={k} className="bg-stone-50 px-3 py-2.5">
                  <div className="text-xs uppercase tracking-wider text-stone-500 font-semibold"><StatLabel k={k} /></div>
                  <div className="text-xl font-medium tabular-nums mt-0.5 break-words">{v}<span className="text-xs text-stone-500 ml-0.5">{u}</span></div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-0.5 text-sm">
              {[
                ["Gross internal", `${midGrossL.toFixed(0)} L`, `acts like ${midEffL.toFixed(0)} L stuffed`],
                ["Qtc", midModel.Qtc.toFixed(2), midModel.Qtc > 0.8 ? "peaky" : midModel.Qtc < 0.5 ? "very damped" : "well damped"],
                ["Midband sensitivity", `${(midModel.ref - 20 * Math.log10(midVoltage / 2.83)).toFixed(1)} dB`, "2.83 V, half space, 1 m"],
                ...[subMidCrossoverHz, 200, 500].map((f) => { const m = midMaxCurveNearest(f);
                  return [`Max SPL at ${f} Hz`, `${m.spl.toFixed(1)} dB`, `sine, ${m.who}-limited`]; }),
                ["Peak excursion", `${(midModel.peakX * midUsedVoltage / midVoltage).toFixed(1)} mm`, `${(midModel.peakX * midUsedVoltage / midVoltage / midDriver.ts.Xmax * 100).toFixed(0)}% of Xmax`, `At ${Math.round(midUsedVoltage * midUsedVoltage / 8)} W, with the ${subMidCrossoverHz} Hz highpass.`],
              ]
.map(([k, v, note, tip]) => <StatRow key={k} k={k} v={v} note={note} tip={tip} />)}
            </div>
            <div className="flex flex-col gap-1.5 mt-4">
              {(() => {
                const F = midChips({ midSize, midDims: effectiveMidBoxDims, Qtc: midModel.Qtc, f3: midModel.f3, peakX: midModel.peakX, xoLo: subMidCrossoverHz, ts: midDriver.ts, V: midVoltage, useV: midUsedVoltage, vTherm: midThermalVoltage, mAmpW: midAmpWatts,
                  subMusicAtXo: subMusicAtCrossover, tilt: midBandTiltDb, midAtXo: subMusicAtCrossover != null ? midMaxCurveNearest(subMidCrossoverHz) : null });
                return F.map(([kind, head, body]) => (
                  <div key={head} className={`block text-xs leading-relaxed px-3 py-2 rounded border ${CHIP_BACKGROUND_CLASSES[kind] || CHIP_BACKGROUND_CLASSES.ok}`}>
                    <b className={`font-semibold mr-1.5 ${kind === "ok" ? "text-green-800" : kind === "warn" ? "text-amber-700" : "text-red-700"}`}>{head}</b>
                    <span className="text-stone-500">{body}</span>
                  </div>
                ));
              })()}
            </div>
          </>) : (
            <p className="text-sm text-stone-500">{midDriver.name} can't be modelled yet: its parameters are incomplete. {midDriver.note}</p>
          )}
          </div>
        </section>

        <section className="mt-2" style={{ fontFamily: "var(--font)" }}>
          <FoldHeading id="horn" title="Horn" folds={expandedSections} toggle={toggleSection} className="mb-3" />
          <div className={sectionClass("horn")}>
          {hornModel ? (<>
            <div className="grid gap-px mb-4 rounded-lg overflow-hidden border border-stone-300 bg-stone-300 grid-cols-2 sm:grid-cols-[repeat(auto-fit,minmax(112px,1fr))] [&>*:last-child:nth-child(odd)]:col-span-2 sm:[&>*:last-child:nth-child(odd)]:col-span-1">
              {[
                ["Sensitivity", compressionDriverSpec.sens.toFixed(1), "dB"],
                ["Power used", Math.round(hornModel.P), "W"],
                ["Max SPL", hornModel.flat.toFixed(1), "dB"],
                ["Coverage", hornSpec.covH ? `${hornSpec.covH}\u00b0\u00d7${hornSpec.covV || "?"}\u00b0` : "\u2014", ""],
                ["Mid beam at XO", midBeamWidthDeg ? Math.round(midBeamWidthDeg) : "\u2014", midBeamWidthDeg ? "\u00b0" : ""],
              ].map(([k, v, u]) => (
                <div key={k} className="bg-stone-50 px-3 py-2.5">
                  <div className="text-xs uppercase tracking-wider text-stone-500 font-semibold"><StatLabel k={k} /></div>
                  <div className="text-xl font-medium tabular-nums mt-0.5 break-words">{v}<span className="text-xs text-stone-500 ml-0.5">{u}</span></div>
                </div>
              ))}
            </div>
            <div className="mb-4">
              <ResponseChart fmin={200} fmax={10000} top={180} bot={0} step={30} H={220} yLabel="horizontal beamwidth, °"
                series={[...(beamCurves.midB.length ? [{ curve: beamCurves.midB, label: `Mid-bass ${midSize}″`, stroke: PAL.magenta, tint: PAL.alpha(PAL.magenta, 0) }] : []), ...(beamCurves.hornB.length ? [{ curve: beamCurves.hornB, label: hornOption.name, stroke: PAL.cyan, tint: PAL.alpha(PAL.cyan, 0) }] : [])]}
                marks={[{ f: midHornCrossoverHz, label: "XO" }, ...(beamCurves.fK ? [{ f: beamCurves.fK, label: "horn control" }] : [])]} />
            </div>
            {paDispersion && (<div className="mb-4">
              <div className="flex gap-1 mb-2">{[["v", "Vertical"], ["h", "Horizontal"]].map(([v, l]) => <ToggleButton key={v} size="xs" on={dispersionPlane === v} onClick={() => setDispersionPlane(v)}>{l}</ToggleButton>)}</div>
              <DispersionMap map={paDispersion} title={dispersionPlane === "v" ? `Vertical dispersion at ${dispersionMapDistanceM} m: below (−) to above (+) the horn axis` : `Horizontal dispersion at ${dispersionMapDistanceM} m, at horn height (0° is on axis)`} />
              <div className="text-xs text-stone-500 mt-1">Mid and horn centers {midHornGapIn.toFixed(1)}″ apart: {midHornNullAngleDeg ? `the first null at the ${midHornCrossoverHz} Hz crossover is about ${midHornNullAngleDeg.toFixed(0)}° above and below the horn axis.` : `under half a wavelength at ${midHornCrossoverHz} Hz, so no null at the crossover.`}</div>
            </div>)}
            <div className="flex flex-col gap-1.5">
              {(() => {
                const F = hornChips({ hf: compressionDriverSpec, hz: hornSpec, horn: hornOption, xoHi: midHornCrossoverHz, hornModel, hfAmpW: hornAmpWatts, midAtXoHi: midMaxCurve ? midMaxCurveNearest(midHornCrossoverHz).spl : null, hfTilt: hornBandTiltDb, hornAtXo: hornSplAt(midHornCrossoverHz), midBeam: midBeamWidthDeg, fK: beamCurves.fK });
                return F.map(([kind, head, body]) => (
                  <div key={head} className={`block text-xs leading-relaxed px-3 py-2 rounded border ${CHIP_BACKGROUND_CLASSES[kind] || CHIP_BACKGROUND_CLASSES.ok}`}>
                    <b className={`font-semibold mr-1.5 ${kind === "ok" ? "text-green-800" : kind === "warn" ? "text-amber-700" : "text-red-700"}`}>{head}</b>
                    <span className="text-stone-500">{body}</span>
                  </div>
                ));
              })()}
            </div>
          </>) : (
            <p className="text-sm text-stone-500">{compressionDriver.name} can't be modelled yet: sensitivity or power rating missing.</p>
          )}
          </div>
        </section>

        </div>

        <aside className={`min-w-0 md:col-span-2 max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:z-40 max-md:bg-stone-50 max-md:border-t max-md:border-stone-300 max-md:rounded-t-xl max-md:shadow-sheet`} style={{ fontFamily: "var(--font)" }} aria-label="Settings">
          <div className="md:hidden flex gap-1 px-3 pt-2 pb-2" role="tablist">
            {[["sub", "Sub"], ["mid", "Mid"], ["horn", "Horn"], ["look", "Look"]].map(([t, label]) => (
              <button key={t} role="tab" aria-selected={isSettingsSheetOpen && activeTab === t}
                onClick={() => { if (isSettingsSheetOpen && activeTab === t) setSettingsSheetOpen(false); else { setActiveTab(t); setSettingsSheetOpen(true); } }}
                className={`flex-1 px-2 py-2 rounded border text-sm ${isSettingsSheetOpen && activeTab === t ? "border-stone-900 bg-stone-900 text-stone-50" : "border-stone-300 bg-stone-50"}`}>{label}</button>
            ))}
            {isSettingsSheetOpen && <button onClick={() => setSettingsSheetOpen(false)} aria-label="Close settings" className="px-3 rounded border border-stone-300 bg-stone-50 text-sm">✕</button>}
          </div>
          <div className={`max-md:overflow-y-auto max-md:overscroll-contain max-md:px-4 max-md:pt-1 max-md:pb-4 max-md:max-h-[45dvh] ${isSettingsSheetOpen ? "" : "max-md:hidden"}`}>
          <div className={tabClass("look")}>
          <div className="mb-5">
            <div className="text-sm text-stone-500 mb-1 flex items-center justify-between gap-2"><span>Plywood (baffles stay 3/4″)</span>{renderLockButton("wall", "the plywood")}</div>
            <div className="flex gap-1">
              {[[0.75, "3/4″ birch"], [0.5, "1/2″ birch, braced"]].map(([t, label]) => (
                <ToggleButton key={t} onClick={() => setWallThicknessIn(t)} on={wallThicknessIn === t}>{label}</ToggleButton>
              ))}
            </div>
            <div className="mt-3"><Slider label="Baffle inset" value={baffleInsetIn} min={0} max={1.5} step={0.25} unit="″" onChange={setBaffleInsetIn} /></div>
          </div>
          </div>
          <div className={tabClass("sub")}>
          <SelectField label="Sub driver" options={subDriverChoices} value={subDriver} onChange={setSubDriver} extra={renderLockButton("sub", "the sub driver")} />
          </div>
          <div className={tabClass("look")}>
          <SwatchPicker label="Cabinet finish" value={cabinetFinish} onChange={setCabinetFinish} swatches={PAINT_SWATCHES} presets={CABINET_FINISHES} titlePrefix="Painted: "
            note={CABINET_FINISHES[cabinetFinish] ? CABINET_FINISHES[cabinetFinish].name : `painted ${cabinetFinish}`} />
          </div>
          <div className={tabClass("look")}>
          <SwatchPicker label="Baffle colour" value={baffleColor} onChange={setBaffleColor} swatches={PAINT_SWATCHES} note={baffleColor} />
          </div>
          <div className={tabClass("look")}>
          <div className="mb-5">
            <div className="text-sm text-stone-500 mb-1">View</div>
            <div className="flex gap-1">
              {[["Finished", false], ["Cutaway", true]].map(([label, v]) => (
                <ToggleButton key={label} onClick={() => setCutaway(v)} on={cutaway === v}>{label}</ToggleButton>
              ))}
            </div>
          </div>
          </div>
          <div className={tabClass("look")}>
          <div className="mb-5">
            <div className="text-sm text-stone-500 mb-1">Layout</div>
            <div className="flex gap-1">
              {[["Two stacks", "stack"], ["Tops on spacers", "pole"], ["Tower", "tower"], ["One sub + satellites", "satellite"]].map(([label, v]) => (
                <ToggleButton key={v} onClick={() => setLayout(v)} on={layout === v}>{label}</ToggleButton>
              ))}
            </div>
            {layout === "pole" && <div className="mt-3"><Slider label="Spacer height" value={spacerHeightIn} min={4} max={36} step={1} unit="″" onChange={setSpacerHeightIn} /></div>}
          </div>
          </div>
          <div className={tabClass("sub")}>
          <div className="mb-5">
            <div className="text-sm text-stone-500 mb-1">Cabinet</div>
            <Card>
              <Slider label="Width"  value={subBoxDims.w} min={18} max={40} step={0.5} unit="″" onChange={(v) => setSubBoxDim("w", v)} extra={renderDimensionLock("subDim", "w", "Sub width")} />
              <Slider label="Height" value={subBoxDims.h} min={18} max={42} step={0.5} unit="″" onChange={(v) => setSubBoxDim("h", v)} extra={renderDimensionLock("subDim", "h", "Sub height")} />
              <Slider label="Depth"  value={subBoxDims.d} min={14} max={32} step={0.5} unit="″" onChange={(v) => setSubBoxDim("d", v)} extra={renderDimensionLock("subDim", "d", "Sub depth")} />
            </Card>
          </div>
          </div>
          <div className={tabClass("sub")}>
          <div className="mb-5">
            <div className="text-sm text-stone-500 mb-1 flex items-center justify-between gap-2"><span>Vent</span>{renderLockButton("vent", "the vent style")}</div>
            <div className="flex flex-wrap gap-1">
              {[["Rectangular", !portStyle.startsWith("round"), "slots"], ["Round tubes", portStyle.startsWith("round"), "round2"]].map(([label, on, v]) => (
                <ToggleButton key={label} onClick={() => { if (!on) setPortStyle(v); }} on={on}>{label}</ToggleButton>
              ))}
            </div>
            {!portStyle.startsWith("round") && (
              <div className="flex flex-wrap gap-1 mt-1">
                {[["slots", "Bottom"], ["folded", "Bottom, folded"], ["vslots", "Both sides"], ["vslot1", "One side"]].map(([v, label]) => {
                  const on = portStyle === v;
                  return <ToggleButton key={v} onClick={() => setPortStyle(v)} on={on} size="xs">{label}</ToggleButton>;
                })}
              </div>
            )}
            <Card className="mt-2">
              {(portStyle === "slots" || portStyle === "folded") &&
                <Slider label="Slot height" value={subVentSpec.slotH} min={1.5} max={9} step={0.25} unit="″" onChange={(v) => setSubVentField("slotH", v)} />}
              {(portStyle === "vslots" || portStyle === "vslot1") &&
                <Slider label="Duct throat" value={subVentSpec.throat} min={1} max={portStyle === "vslot1" ? 10 : 7} step={0.25} unit="″" onChange={(v) => setSubVentField("throat", v)} />}
              {portStyle.startsWith("round") && <>
                <Slider label="Tubes" value={subVentSpec.nt} min={1} max={6} step={1} unit="" onChange={(v) => setSubVentField("nt", v)} />
                <Slider label="Tube diameter" value={subVentSpec.dia} min={3} max={10} step={0.25} unit="″" onChange={(v) => setSubVentField("dia", v)} />
              </>}
              <Slider label="Duct length" value={subVentSpec.len} min={3} max={30} step={0.5} unit="″" onChange={(v) => setSubVentField("len", v)} />
              <Slider label="Port velocity limit" value={maxPortAirSpeedMs} min={12} max={30} step={0.5} unit=" m/s" onChange={setMaxPortAirSpeedMs} />
              <div className="text-xs text-stone-500">{port.desc}. {port.area.toFixed(1)} in&#178;.</div>
            </Card>
          </div>
          <div className="mb-5">
            <div className="text-sm text-stone-500 mb-1">Sub highpass and amp</div>
            <Card>
              <Slider label={`Highpass (${subHighpassType})`} value={subHighpassHz} min={20} max={50} step={1} unit=" Hz" onChange={setSubHighpassHz} extra={renderLockButton("hpf", "the highpass")} />
              <div className="flex flex-wrap gap-1 -mt-1 mb-3">
                {Object.keys(HIGHPASS_ALIGNMENTS).map((t) => (
                  <ToggleButton key={t} onClick={() => setSubHighpassType(t)} on={subHighpassType === t} size="xs">{t}</ToggleButton>
                ))}
              </div>
              <Slider label="Amp power per channel @ 8 Ω" value={subAmpWatts} min={200} max={3000} step={50} unit=" W" onChange={setSubAmpWatts} extra={renderLockButton("ampW", "the sub amp power")} />
            </Card>
          </div>
          </div>
          <div className={tabClass("mid")}>
          <div className="mb-2">
            <div className="text-sm text-stone-500 mb-1">Mid-bass size</div>
            <div className="flex gap-1">
              {[12, 15].map((n) => (
                <ToggleButton key={n} onClick={() => setMidSize(n)} on={midSize === n}>{n}″</ToggleButton>
              ))}
            </div>
          </div>
          <SelectField label={`Mid-bass ${midSize}″`} options={midDriverChoices} value={midDriver} onChange={setMidDriver} extra={renderLockButton("mid", "the mid-bass driver")} />
          <div className="mb-5">
            <div className="text-sm text-stone-500 mb-1">Mid-bass cabinet (sealed)</div>
            <Card>
              {layout === "tower" ? (
                <div className="text-xs text-stone-500 mb-3">Tower layout: the mid chamber is the sub's footprint, {subBoxDims.w}″ × 15.5″ × {subBoxDims.d}″.</div>
              ) : (<>
                <Slider label="Width"  value={midBoxDims.w} min={10} max={24} step={0.5} unit="″" onChange={(v) => setMidBoxDim("w", v)} extra={renderDimensionLock("midDim", "w", "Mid width")} />
                <Slider label="Height" value={midBoxDims.h} min={10} max={24} step={0.5} unit="″" onChange={(v) => setMidBoxDim("h", v)} extra={renderDimensionLock("midDim", "h", "Mid height")} />
                <Slider label="Depth"  value={midBoxDims.d} min={8} max={24} step={0.5} unit="″" onChange={(v) => setMidBoxDim("d", v)} extra={renderDimensionLock("midDim", "d", "Mid depth")} />
              </>)}
              <Slider label="Crossover, sub to mid" value={subMidCrossoverHz} min={60} max={250} step={5} unit=" Hz" onChange={setSubMidCrossoverHz} extra={renderLockButton("xoLo", "the sub-to-mid crossover")} />
              <Slider label="Crossover, mid to horn" value={midHornCrossoverHz} min={500} max={2000} step={50} unit=" Hz" onChange={setMidHornCrossoverHz} extra={renderLockButton("xoHi", "the mid-to-horn crossover")} />
              <Slider label="Mid amp power per channel @ 8 Ω" value={midAmpWatts} min={50} max={2000} step={25} unit=" W" onChange={setMidAmpWatts} extra={renderLockButton("mAmpW", "the mid amp power")} />
              <Slider label={<Tooltip tip="0 dB asks the mid to match the sub flat out. Bass-heavy music usually carries 6–10 dB less from 200 Hz to 1 kHz than at 40–60 Hz.">Music balance: mid band needs less by</Tooltip>} value={midBandTiltDb} min={0} max={12} step={1} unit=" dB" onChange={setMidBandTiltDb} />
            </Card>
          </div>
          </div>
          <div className={tabClass("horn")}>
          <SelectField label="Compression driver" options={CD_OPTIONS} value={compressionDriver} onChange={setCompressionDriver} extra={renderLockButton("cd", "the compression driver")} />
          <SelectField label="Horn" options={HORN_OPTIONS} value={hornOption} onChange={setHornOption} extra={renderLockButton("horn", "the horn")} />
          <Card className="mb-4">
            <Slider label="HF amp power per channel @ 8 Ω" value={hornAmpWatts} min={10} max={500} step={5} unit=" W" onChange={setHornAmpWatts} extra={renderLockButton("hfAmpW", "the HF amp power")} />
            <Slider label="Music balance: HF band needs less by" value={hornBandTiltDb} min={0} max={12} step={1} unit=" dB" onChange={setHornBandTiltDb} />
          </Card>
          {hornExitMismatch && <div className="text-sm text-red-700 mb-4">Horn throat and driver exit don't match ({hornOption.exit}″ vs {compressionDriver.exit}″).</div>}
          </div>
          </div>
        </aside>


        <section className="min-w-0 md:col-span-5 mt-6" style={{ fontFamily: "var(--font)" }}>
          <FoldHeading id="totals" title="Totals for the current selection" folds={expandedSections} toggle={toggleSection} className="mb-2" />
          <div className={sectionClass("totals")}>
          {(() => {
            const subBoxLb = subWeightLoadedLb - (subDriver.lb || 0); // same estimate as the stats row
            const midBoxLb = midCabinetLb;   // same estimate as the mid-bass stats row
            const rows = [
              ["Sub column", subDriver.price, subDriver.lb, subBoxLb, subBox.h],
              ["Mid-bass box", midDriver.price, midDriver.lb, midBoxLb, effectiveMidBoxDims.h],
              ["Compression driver", compressionDriver.price, compressionDriver.lb || 0, 0, 0],
              ["Horn", hornOption.price, (hornOption.lb || 0) + 1, 0, hornOption.size.h + 1],
            ];
            const sum = (i) => rows.reduce((a, r) => a + (r[i] || 0), 0);
            const stackLb = sum(2) + sum(3) + (plinthHeightIn ? 6 : 0);
            return (
              <div className="overflow-x-auto max-w-3xl"><table className="text-sm w-full min-w-[340px] border-collapse">
                <thead><tr className="text-stone-500 text-left border-b border-stone-300">
                  <th className="py-1 pr-4 font-normal">Per stack</th><th className="py-1 pr-4 font-normal text-right">Drivers $</th><th className="py-1 pr-4 font-normal text-right">Driver lb</th><th className="py-1 pr-4 font-normal text-right">Cabinet lb</th><th className="py-1 pr-4 font-normal text-right">Box lb</th><th className="py-1 font-normal text-right">Height in</th>
                </tr></thead>
                <tbody>
                  {rows.map(([n, pr, dl, cl, h]) => (
                    <tr key={n} className="border-b border-stone-300"><td className="py-1 pr-4">{n}</td><td className="py-1 pr-4 text-right tabular-nums">{pr ? `$${pr}` : "—"}</td><td className="py-1 pr-4 text-right tabular-nums">{dl.toFixed(0)}</td><td className="py-1 pr-4 text-right tabular-nums">{cl ? cl.toFixed(0) : "—"}</td><td className="py-1 pr-4 text-right tabular-nums">{(dl + cl).toFixed(0)}</td><td className="py-1 text-right tabular-nums">{h.toFixed(1)}</td></tr>
                  ))}
                  <tr className="font-medium"><td className="py-1 pr-4">One stack{plinthHeightIn ? ` + ${plinthHeightIn}" plinth` : ""}</td><td className="py-1 pr-4 text-right tabular-nums">${sum(1).toLocaleString()}</td><td className="py-1 pr-4 text-right tabular-nums">{sum(2).toFixed(0)}</td><td className="py-1 pr-4 text-right tabular-nums">{(sum(3) + (plinthHeightIn ? 6 : 0)).toFixed(0)}</td><td className="py-1 pr-4 text-right tabular-nums">{stackLb.toFixed(0)}</td><td className="py-1 text-right tabular-nums">{stackHeightIn.toFixed(0)}</td></tr>
                  <tr className="font-medium text-stone-900"><td className="py-1 pr-4">Pair</td><td className="py-1 pr-4 text-right tabular-nums">${(2 * sum(1)).toLocaleString()}</td><td className="py-1 pr-4 text-right tabular-nums">{(2 * sum(2)).toFixed(0)}</td><td className="py-1 pr-4 text-right tabular-nums">{(2 * (sum(3) + (plinthHeightIn ? 6 : 0))).toFixed(0)}</td><td className="py-1 pr-4 text-right tabular-nums">{(2 * stackLb).toFixed(0)}</td><td></td></tr>
                </tbody>
              </table></div>
            );
          })()}
          </div>
        </section>
        <div className="min-w-0 md:col-span-5 mt-4" style={{ fontFamily: "var(--font)" }}>
          <button onClick={() => setShowDetails((v) => !v)} aria-expanded={showDetails}
            className="text-sm px-3 py-1.5 rounded border border-stone-300 hover:border-stone-500">{showDetails ? "Hide" : "Show"} sub, mid-bass and horn details</button>
        </div>
        {showDetails && <section className="min-w-0 md:col-span-5 grid grid-cols-1 md:grid-cols-3 gap-6" style={{ fontFamily: "var(--font)" }}>
          <div>
            <SectionHeading className="mb-2">Sub</SectionHeading>
            <p className="text-sm text-stone-900">
              {subDriver.name} in a {subBox.w}×{subBox.h}×{subBox.d} in cabinet, {subGrossLiters.toFixed(0)} L gross, {subNetLiters.toFixed(0)} L net.
              Vent: {port.desc}. 3/4″ baffle set {baffleInsetIn}″ behind the frame, {wallThicknessIn === 0.5 ? "1/2″" : "3/4″"} birch walls, 1/4″ roundovers on the front edges.
            </p>
          </div>
          <div>
            <SectionHeading className="mb-2">Mid-bass cube</SectionHeading>
            <p className="text-sm text-stone-900">
              {midDriver.name} in a {effectiveMidBoxDims.w}×{effectiveMidBoxDims.h}×{effectiveMidBoxDims.d} in sealed box, gross {midBoxLiters.toFixed(0)} L, lightly stuffed.
              Covers {subMidCrossoverHz} Hz to {midHornCrossoverHz} Hz. Same construction, flush-mounted driver.
            </p>
            {midDriver.note && <p className="text-sm text-stone-500 mt-2"><span className="font-medium text-stone-900">{midDriver.name}.</span> {midDriver.note}</p>}
          </div>
          <div>
            <SectionHeading className="mb-2">Horn</SectionHeading>
            <p className="text-sm text-stone-900">
              {hornOption.name} with {compressionDriver.name}, crossed at {midHornCrossoverHz} Hz (maker suggests {hornOption.xo}). Sits on a short block so the mouth clears the cube.
              Total stack height about {stackHeightIn.toFixed(0)} in, horn center at {hornCenterHeightIn.toFixed(0)} in.
            </p>
            {compressionDriver.note && <p className="text-sm text-stone-500 mt-2"><span className="font-medium text-stone-900">{compressionDriver.name}.</span> {compressionDriver.note}</p>}
            {hornOption.note && <p className="text-sm text-stone-500 mt-2"><span className="font-medium text-stone-900">{hornOption.name}.</span> {hornOption.note}</p>}
          </div>
        </section>}

      </main>
      </>}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(React.createElement(StackPlanner));
