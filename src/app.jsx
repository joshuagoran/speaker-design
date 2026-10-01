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
import { StackView3D } from "./components/StackView3D.jsx";



function StackPlanner() {
  const viewOf = () => (window.location.hash === "#notes" ? "notes" : window.location.hash === "#fills" ? "fills" : window.location.hash === "#hifi" ? "hifi" : window.location.hash === "#cutlist" ? "cutlist" : "planner");
  const [view, setView] = useState(viewOf);
  useEffect(() => {
    const on = () => setView(viewOf());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  const [sub, setSub] = useState(SUB_OPTIONS.find((o) => o.id === "sbnero18"));
  const [mid, setMid] = useState(MID_OPTIONS.find((o) => o.id === "sbnero12"));
  const [horn, setHorn] = useState(HORN_OPTIONS.find((h) => h.id === "a400g2"));
  const [cd, setCd] = useState(CD_OPTIONS.find((c) => c.id === "de360"));
  const [midBox, setMidBox] = useState(MID_BOXES.find((o) => o.id === "b15"));   // last preset loaded
  const [mDim, setMDim] = useState({ ...MID_BOXES.find((o) => o.id === "b15").box });
  const [xoLo, setXoLo] = useState(120);         // sub -> mid crossover, LR24
  const [xoHi, setXoHi] = useState(900);         // mid -> horn crossover, LR24
  const [paPlane, setPaPlane] = useState("v");    // dispersion map: vertical (lobing) or horizontal
  const [mAmpW, setMAmpW] = useState(400);       // amp power per mid channel, into 8 Ω
  const [tilt, setTilt] = useState(6);           // how much less the mid band needs than the sub band, dB
  const [hfAmpW, setHfAmpW] = useState(100);     // amp power per HF channel, rated into 8 Ω
  const [hfTilt, setHfTilt] = useState(6);       // how much less the horn band needs than the mid band, dB
  const setM = (k, v) => setMDim((p) => ({ ...p, [k]: v }));
  const plinth = 3; // fixed, matches the duct height
  const [cutaway, setCutaway] = useState(false);
  const [cabinet] = useState(CABINETS[0]);
  const [portStyle, setPortStyle] = useState("slots");
  const [layout, setLayout] = useState("stack");
  const format = FORMATS[0];   // 18″ sub + compression driver; mid is 12″ or 15″
  const [midSize, setMidSize] = useState(12);
  const [wall, setWall] = useState(0.75);   // side/top/bottom/back ply, in
  const [inset, setInset] = useState(0.75); // how far the baffles sit back from the frame front, in
  const [baffleColor, setBaffleColor] = useState(PAINT_SWATCHES.find(([, name]) => name === "Dusty pink")[0]);
  const [cabFinish, setCabFinish] = useState("birch");
  const [spacerH, setSpacerH] = useState(20);
  const [showDetails, setShowDetails] = useState(false);
  // phones: settings live in a bottom sheet with tabs; result sections fold (remembered per viewer)
  const [sheetOpen, setSheetOpen] = useState(false);
  const [tab, setTab] = useState("sub");
  const tabCls = (t) => (tab === t ? "" : "max-md:hidden");
  const [folds, setFolds] = useState(() => {
    try { return { sub: true, mid: false, horn: false, totals: false, ...JSON.parse(localStorage.getItem("planner.folds") || "{}") }; }
    catch { return { sub: true, mid: false, horn: false, totals: false }; }
  });
  const toggleFold = (id) => setFolds((f) => { const n = { ...f, [id]: !f[id] }; try { localStorage.setItem("planner.folds", JSON.stringify(n)); } catch {} return n; });
  const foldCls = (id) => (folds[id] ? "" : "max-md:hidden");
  const [full3d, setFull3d] = useState(false);
  // optimizer: switch, inputs and locks remembered per viewer
  const lsGet = (k, fb) => { try { const v = localStorage.getItem(k); return v == null ? fb : JSON.parse(v); } catch { return fb; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
  const [optOn, setOptOnRaw] = useState(() => lsGet("planner.opt", false));
  const setOptOn = (v) => { setOptOnRaw(v); lsSet("planner.opt", v); };
  // goals start empty on every load (not restored), so a search always starts from a goal you just picked
  const [optIn, setOptIn] = useState(() => { const { budgetPer, goal, goals, ...o } = lsGet("planner.optIn", {}) || {};
    return { room: 1000, maxLb: 125, budget: 900, ...o, goals: [] }; });
  const setOpt = (o) => setOptIn((p) => { const n = { ...p, ...o }; lsSet("planner.optIn", n); return n; });
  const [locks, setLocksRaw] = useState(() => { const l = lsGet("planner.locks", {}) || {}; return { ...l, subDim: { ...(l.subDim || {}) }, midDim: { ...(l.midDim || {}) } }; });
  const setLocks = (f) => setLocksRaw((p) => { const n = f(p); lsSet("planner.locks", n); return n; });
  const lk = (key, what) => optOn ? <LockButton on={!!locks[key]} what={what} onClick={() => setLocks((p) => ({ ...p, [key]: !p[key] }))} /> : null;
  const dl = (box, dim, what) => optOn ? <DimensionLock mode={locks[box][dim] || "free"} what={what} onChange={(m) => setLocks((p) => ({ ...p, [box]: { ...p[box], [dim]: m } }))} /> : null;
  const [optRes, setOptRes] = useState(null);
  const [optBusy, setOptBusy] = useState(false);
  const [optErr, setOptErr] = useState("");
  const [preview, setPreview] = useState(null);   // { label, before }
  const [undoSnap, setUndoSnap] = useState(null);
  const [toast, setToast] = useState("");
  useEffect(() => {
    if (!full3d) return;
    const esc = (e) => { if (e.key === "Escape") setFull3d(false); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [full3d]);
  const [joint, setJoint] = useState("butt");       // cutlist corner joints
  const [sheetKind, setSheetKind] = useState("4x8");
  const [sets, setSets] = useState(2);   // "tops on spacers": spacer height, in   // "birch", "walnut" or a paint hex
  // Every cabinet is custom; the preset list below is only a starting point.
  const [cDim, setCDim] = useState({ w: 28, h: 32, d: 24 });
  const [cVent, setCVent] = useState({ slotH: 3, nt: 2, dia: 6, throat: 3, len: 14 });
  const [hpf, setHpf] = useState(33);
  const [hpType, setHpType] = useState("BW24");   // sub highpass alignment
  const [ampW, setAmpW] = useState(800);   // amp power per sub channel, into 8 Ω
  const [portMax, setPortMax] = useState(20);   // peak port air speed allowed, m/s
  const setC = (k, v) => setCDim((p) => ({ ...p, [k]: v }));
  const setV = (k, v) => setCVent((p) => ({ ...p, [k]: v }));

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
  const midDims = layout === "tower" ? { w: cDim.w, h: 15.5, d: cDim.d } : mDim;
  const midSel = { ...mid, box: midDims };
  const subList = SUB_OPTIONS.filter((o) => o.size === format.sub);
  const midList = MID_OPTIONS.filter((o) => (o.size || 12) === midSize);
  const boxList = MID_BOXES.filter((b) => (b.size || 12) === midSize && b.id !== "b13");
  const subBox = cDim;
  const subSel = { ...sub, box: subBox };
  useEffect(() => {
    const pickOf = (list) => list.find((o) => o.pick) || list[0];
    if (subList.length) setSub(pickOf(subList));
    if (midList.length) setMid(pickOf(midList));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [format]);
  // Switching 12/15 picks that size's default driver and box; restoring a config sets them itself.
  const skipSizeReset = useRef(true);
  useEffect(() => {
    if (skipSizeReset.current) { skipSizeReset.current = false; return; }
    const pickOf = (list) => list.find((o) => o.pick) || list[0];
    if (midList.length) setMid(pickOf(midList));
    if (boxList.length) { const b = pickOf(boxList); setMidBox(b); setMDim({ ...b.box }); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [midSize]);
  const mismatch = horn.exit !== cd.exit;

  // Port geometry, matching what the 3D view draws, so the table and the
  // model describe the same box.
  const PT = wall;
  const { port, grossL, netL, AMP_V, mdl, lim } = subSystem(sub, mid, {
    subBox, midDims: mDim, wall, inset, portStyle, cVent, hpf, hpType, ampW, portMax, layout });
  // Max SPL for a sine at each frequency (each frequency meets its own port and excursion limits);
  // the broadband limit above is what applies to music.
  const maxCurve = mdl ? maxCurveOf(mdl.curve, sub.ts, AMP_V, portMax) : null;
  const maxNear = (f) => maxCurve.reduce((b, o) => (Math.abs(o.f - f) < Math.abs(b.f - f) ? o : b));

  // ---- mid-bass: sealed box ----
  const { V: MID_V, grossL: midGrossL, netL: midNetL, effL: midEffL, mdl: mMdl, vTherm: vMidTherm, max: midMax, useV: midUseV } =
    midSystem(mid, { midDims, wall, inset, xoLo, xoHi, mAmpW });
  // 3/4" baffle at 2.3 lb/ft\u00b2, other panels and one brace at the chosen ply, plus 2 lb of hardware
  const midCabLb = midWeightLb(midDims, wall);
  const midLbLoaded = midCabLb + (mid.lb || 0);
  const midNear = (f) => midMax.reduce((b, o) => (Math.abs(o.f - f) < Math.abs(b.f - f) ? o : b));
  // Sub through its lowpass at the crossover, for the system chart. Its own limits scale with the filter.
  const subSys = mdl ? subThroughLowpass(mdl, sub.ts, AMP_V, portMax, xoLo) : null;
  // What the mid actually has to match: the sub at its music limit (one drive level for
  // the whole band), through its lowpass, less the music-balance allowance.
  // ---- horn + compression driver ----
  // Datasheet model, not T/S: on-horn sensitivity + 10 log P, shaped by the LR24
  // highpass at the crossover and a 12 dB/oct rolloff below the horn's loading limit.
  // Power: amp voltage into the driver's impedance, capped at program (2 x AES), derated
  // 6 dB per octave when crossing below the frequency the AES rating was measured at.
  const hf = cd.hf, hz = horn.hf || {};
  const hornModel = hornResponse(hf, hz, xoHi, hfAmpW);
  const hornAt = (f) => hornModel.curve.reduce((b, o) => (Math.abs(o.f - f) < Math.abs(b.f - f) ? o : b)).spl;
  // mid beamwidth at the horn crossover, as a rigid piston: -6 dB where ka sin(theta) = 2.2
  const midBeam = mid.ts ? pistonBeamWidthDeg(mid.ts.Sd, xoHi) : null;
  // Horizontal beamwidth against frequency: mid as a rigid piston, horn at its rated coverage down
  // to Keele's pattern-control limit and proportionally wider below. Rules of thumb.
  const beamCurves = (() => {
    const hz0 = horn.hf || {};
    const fK = hz0.covH && horn.size ? keeleFrequency(hz0.covH, horn.size.w) : null;
    const midB = [], hornB = [];
    for (let i = 0; i < 160; i++) {
      const f = 200 * Math.pow(10000 / 200, i / 159);
      if (mid.ts) midB.push({ f, spl: pistonBeamWidthDeg(mid.ts.Sd, f) });
      if (fK && f >= (hz0.lowHz || 0) * 0.7) hornB.push({ f, spl: hornBeamWidthDeg(hz0.covH, fK, f) });
    }
    return { midB, hornB, fK };
  })();

  const subMusicAtXo = mdl && lim ? subMusicOutputAt(mdl, lim, AMP_V, xoLo) : null;

  const portGeom = { ductH: cVent.slotH, nPorts: cVent.nt, portR: cVent.dia / 2, tubeLen: cVent.len, throat: cVent.throat };

  // One named snapshot of the whole system.
  const snapshot = () => ({
    format: format.id, sub: sub.id, mid: mid.id, midBox: midBox.id, cd: cd.id, horn: horn.id,
    cabinet: cabinet.id, portStyle, cDim, cVent, hpf, hpType, ampW, portMax, mDim, wall, inset, xoLo, xoHi, mAmpW, tilt, hfAmpW, hfTilt,
    layout, cutaway, baffleColor, cabFinish, spacerH, joint,
    summary: `${sub.name} · ${subBox.w}×${subBox.h}×${subBox.d}″ · ${port.area.toFixed(0)} in² · ${mdl ? mdl.Fb.toFixed(1) + " Hz" : "—"}`
  });
  const restore = (c) => {
    const find = (list, id, fb) => list.find((o) => o.id === id) || fb;
    if (c.wall === 0.5 || c.wall === 0.75) setWall(c.wall); else setWall(0.75);
    setInset(typeof c.inset === "number" ? c.inset : 0.75);
    if (c.sub) setSub(find(SUB_OPTIONS, c.sub, sub));
    if (c.mid) { const m = find(MID_OPTIONS, c.mid, mid); skipSizeReset.current = (m.size || 12) !== midSize; setMidSize(m.size || 12); setMid(m); }
    if (c.midBox) setMidBox(find(MID_BOXES, c.midBox, midBox));
    if (c.cd) setCd(find(CD_OPTIONS, c.cd, cd));
    if (c.horn) setHorn(find(HORN_OPTIONS, c.horn, horn));
    if (c.cDim) setCDim(c.cDim);
    if (c.cVent) setCVent(c.cVent);
    if (typeof c.hpf === "number") setHpf(c.hpf);
    if (c.hpType && HIGHPASS_ALIGNMENTS[c.hpType]) setHpType(c.hpType);
    if (typeof c.ampW === "number") setAmpW(c.ampW);
    if (typeof c.portMax === "number") setPortMax(c.portMax);
    if (c.mDim) setMDim(c.mDim); else if (c.midBox) { const b = MID_BOXES.find((x) => x.id === c.midBox); if (b) setMDim({ ...b.box }); }
    if (typeof c.xoLo === "number") setXoLo(c.xoLo);
    if (typeof c.xoHi === "number") setXoHi(c.xoHi);
    if (typeof c.mAmpW === "number") setMAmpW(c.mAmpW);
    if (typeof c.tilt === "number") setTilt(c.tilt);
    if (typeof c.hfAmpW === "number") setHfAmpW(c.hfAmpW);
    if (typeof c.hfTilt === "number") setHfTilt(c.hfTilt);
    if (typeof c.cutaway === "boolean") setCutaway(c.cutaway);
    if (c.layout) setLayout(c.layout);
    if (c.baffleColor) setBaffleColor(c.baffleColor);
    setCabFinish(c.cabFinish || "birch");
    setSpacerH(typeof c.spacerH === "number" ? c.spacerH : 20);
    if (c.joint) setJoint(c.joint);
    if (c.portStyle) setPortStyle(c.portStyle);
  };
  // ---- optimizer actions ----
  const today = () => new Date().toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const runOpt = async (over) => {
    const inp = { ...optIn, ...(over && over.nativeEvent ? {} : over || {}) };
    if (over && !over.nativeEvent) setOpt(over);
    if (!inp.goals.length) return;
    setOptBusy(true); setOptErr("");
    try {
      const cur = preview ? preview.before : snapshot();
      setOptRes(await runPaOptimizer({ cur, room: inp.room, maxLb: inp.maxLb, budget: inp.budget, goals: inp.goals, locks }));
    } catch (e) { setOptErr("The search failed: " + ((e && e.message) || e)); }
    setOptBusy(false);
  };
  // a result only sets the fields the search changes; finish, colours, layout and balance stay as they are now
  const optPreview = (k) => {
    const before = preview ? preview.before : snapshot();
    restore({ ...snapshot(), ...pickOptimizedFields(k.config) }); setPreview({ label: k.label, before, card: k });
  };
  const optBack = () => { if (preview) restore(preview.before); setPreview(null); };
  const optLoad = async (k) => {
    const before = preview ? preview.before : snapshot();
    restore({ ...snapshot(), ...pickOptimizedFields(k.config) }); setPreview(null); setUndoSnap(before);
    let msg = `Loaded "${k.label}".`;
    if (db) {
      const name = `Before optimizer, ${today()}`;
      try { await db.collection("configs").doc().set({ ...before, name, savedAt: Date.now() }); msg += ` Your previous design was saved as "${name}".`; }
      catch { msg += " Undo brings your previous design back."; }
    } else msg += " Undo brings your previous design back.";
    setToast(msg);
  };
  const optUndo = () => { if (undoSnap) restore(undoSnap); setUndoSnap(null); setToast(""); };
  const optSave = async (k) => {
    if (!db) return;
    const name = window.prompt("Name this design", `${k.label} · ${today()}`);
    if (!name) return;
    const m = k.metrics;
    try {
      await db.collection("configs").doc().set({ ...snapshot(), ...pickOptimizedFields(k.config), name: name.slice(0, 60), savedAt: Date.now(),
        summary: `${k.names.sub} · ${k.config.cDim.w}×${k.config.cDim.h}×${k.config.cDim.d}″ · ${m.Fb.toFixed(1)} Hz` });
      setToast(`Saved "${name.slice(0, 60)}".`);
    } catch { setToast("Couldn't save — try again"); }
  };
  const curOut = optOn ? (() => { try { const m = evaluateConfig(preview ? preview.before : snapshot()); return m ? m.out : null; } catch { return null; } })() : null;

  const subLbLoaded = subWeightLb(subBox, wall, sub.lb);

  const midL = midGrossL;
  const subTopH = plinth + subBox.h;
  const isTower = layout === "tower";
  const baseH = layout === "satellite" ? 34 : layout === "pole" ? subTopH + spacerH : isTower ? subTopH : subTopH + 0.4;
  const archT = isTower && !!horn.profile && !horn.scaleX && subBox.w / 2 - 0.75 > horn.size.w / 2;
  const stackH = isTower ? baseH + 15.5 + (archT ? subBox.w - 0.75 : horn.size.h + 2) : baseH + midDims.h + 1.2 + horn.size.h + 2;
  const hornCenter = isTower ? baseH + 15.5 + (archT ? subBox.w / 2 - 0.75 : (horn.size.h + 2) / 2) : baseH + midDims.h + 1.2 + 1 + horn.size.h / 2;
  // driver heights for the dispersion map: mid centered in its box (or the tower's mid section), sub at its box center
  const midCenter = isTower ? baseH + 15.5 / 2 : baseH + midDims.h / 2;
  const PA_MAP_M = 10;
  const paMap = mid.ts && hz.covH && horn.size ? paDispersionMap({
    sub: sub.ts ? { zIn: plinth + subBox.h / 2, Sd: sub.ts.Sd } : null, mid: { zIn: midCenter, Sd: mid.ts.Sd },
    horn: { zIn: hornCenter, covH: hz.covH, covV: hz.covV || hz.covH, wIn: horn.size.w, hIn: horn.size.h }, xoLo, xoHi, order: 4,
  }, paPlane, PA_MAP_M) : null;
  const mhGap = hornCenter - midCenter, mhNull = firstNullAngleDeg(mhGap, xoHi);

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
      {view === "notes" ? <NotesPage /> : view === "fills" ? <FillsPage /> : view === "hifi" ? <HifiPage /> : view === "cutlist" ? <CutlistPage {...{ sub, mid, subBox, midDims, wall, inset, joint, setJoint, sheetKind, setSheetKind, sets, setSets, portStyle, cVent, layout }} /> : <>

      <SavedConfigs store={store} snapshot={snapshot} restore={restore}
        extra={fbUser && <button onClick={importSeed} className="hover:underline">Import saved configs</button>} />

      <section className="max-w-6xl mx-auto px-4 md:px-8 pb-3" style={{ fontFamily: "var(--font)" }}>
        {(() => {
          const n = Object.entries(locks).reduce((a, [k, v]) => a + (k.endsWith("Dim") ? Object.values(v).filter((m) => m && m !== "free").length : v ? 1 : 0), 0);
          // lock everything (box sizes exact), then unlock the one or two things you want the optimizer to change
          const all = { ...Object.fromEntries(LOCK_KEYS.map((k) => [k, true])), subDim: { w: "exact", h: "exact", d: "exact" }, midDim: { w: "exact", h: "exact", d: "exact" } };
          return <OptimizerBar on={optOn} onToggle={() => setOptOn(!optOn)} hint="Find cheaper, lighter or louder designs inside your limits."
            nLocks={n} lockMax={LOCK_KEYS.length + 6} onLockAll={() => setLocks(() => all)} onClear={() => setLocks(() => ({ subDim: {}, midDim: {} }))} />;
        })()}
      </section>
      {optOn && <OptimizerPanel optIn={optIn} setOpt={setOpt} run={runOpt} busy={optBusy} res={optRes} err={optErr} curOut={curOut} 
        previewCard={preview && preview.card} canSave={!!db}
        onPreview={optPreview} onLoad={optLoad} onSave={optSave} />}
      {preview && (
        <div className="fixed top-0 inset-x-0 z-50 bg-stone-900 text-white border-b-4 border-cmy-y px-4 py-2 flex flex-wrap items-center justify-center gap-3 text-sm" style={{ fontFamily: "var(--font)" }}>
          <span>Previewing: <b className="font-semibold">{preview.label}</b></span>
          <Button variant="primary" size="xs" onClick={() => optLoad(preview.card)}>Load</Button>
          <button onClick={optBack} className="px-3 py-1.5 rounded border border-stone-900 bg-white">Back</button>
        </div>
      )}
      {toast && (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-20 md:bottom-6 z-50 w-[calc(100%-2rem)] max-w-xl bg-stone-900 text-stone-50 rounded-lg px-4 py-2.5 flex items-center gap-3 text-sm shadow-lg" style={{ fontFamily: "var(--font)" }} role="status">
          <span className="flex-1">{toast}</span>
          {undoSnap && <button onClick={optUndo} className="px-3 py-1.5 rounded border border-stone-500">Undo</button>}
          <button onClick={() => setToast("")} aria-label="Dismiss" className="px-2 py-1.5 rounded border border-stone-900">✕</button>
        </div>
      )}
      {mdl && lim && (
        <div className="md:hidden sticky top-0 z-30 bg-stone-50/95 backdrop-blur border-b border-stone-300 px-4 py-1.5 grid grid-cols-4 gap-2 text-center" style={{ fontFamily: "var(--font)" }}>
          {[["Fb", `${mdl.Fb.toFixed(1)}`, "Hz"], ["35 Hz", `${maxNear(35).spl.toFixed(0)}`, "dB"], ["Sub", `${subLbLoaded.toFixed(0)}`, "lb"], ["Limit", { "port air speed": "port", "cone travel (Xmax)": "Xmax", "driver program rating": "thermal", "amplifier power": "amp" }[lim.who] || lim.who, ""]].map(([k, v, u]) => (
            <div key={k}><div className="text-xs uppercase tracking-wider text-stone-500">{k}</div><div className="text-sm font-medium tabular-nums">{v}<span className="text-xs text-stone-500 ml-0.5">{u}</span></div></div>
          ))}
        </div>
      )}
      <main className={`max-w-6xl mx-auto px-4 md:px-8 pb-16 grid ${sheetOpen ? "max-md:pb-[52dvh]" : "max-md:pb-24"} grid-cols-1 md:grid-cols-5 gap-8`}>
        <div className="min-w-0 md:col-span-3 flex flex-col gap-5">
        <section className={full3d ? "fixed inset-0 z-50 bg-stone-50" : "relative rounded-lg overflow-hidden border border-stone-300 bg-stone-50 h-[300px] md:h-[clamp(320px,56vh,560px)]"}>
          <button onClick={() => setFull3d((v) => !v)} aria-label={full3d ? "Close full screen" : "Full screen"} title={full3d ? "Close full screen" : "Full screen"}
            className="absolute top-2 right-2 z-10 w-9 h-9 inline-flex items-center justify-center rounded border border-stone-300 bg-white/90 hover:border-stone-500">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {full3d ? <path d="M4 4l8 8M12 4l-8 8" /> : <path d="M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10" />}
            </svg>
          </button>
          <StackView3D sub={subSel} mid={midSel} horn={horn} plinth={plinth} cutaway={cutaway} portStyle={portStyle} layout={layout} baffleColor={baffleColor} portGeom={portGeom} wall={wall} inset={inset} cabFinish={cabFinish} spacerH={spacerH} />
        </section>

        <section className="mt-1" style={{ fontFamily: "var(--font)" }}>
          <FoldHeading id="sub" title="Sub" folds={folds} toggle={toggleFold} className="mb-3 md:hidden" />
          <div className={foldCls("sub")}>
          {mdl && lim && (
            <div className="grid gap-px mb-4 rounded-lg overflow-hidden border border-stone-300 bg-stone-300 grid-cols-2 sm:grid-cols-[repeat(auto-fit,minmax(112px,1fr))] [&>*:last-child:nth-child(odd)]:col-span-2 sm:[&>*:last-child:nth-child(odd)]:col-span-1">
              {[
                ["Net volume", netL.toFixed(0), "L"],
                ["Tuning Fb", mdl.Fb.toFixed(1), "Hz"],
                ["System F3", mdl.f3.toFixed(0), "Hz"],
                ["Max SPL @ 35 Hz", maxNear(35).spl.toFixed(1), "dB"],
                ["Weight", subLbLoaded.toFixed(0), "lb"],
              ].map(([k, v, u]) => (
                <div key={k} className="bg-stone-50 px-3 py-2.5">
                  <div className="text-xs uppercase tracking-wider text-stone-500 font-semibold"><StatLabel k={k} /></div>
                  <div className="text-xl font-medium tabular-nums mt-0.5 break-words">{v}<span className="text-xs text-stone-500 ml-0.5">{u}</span></div>
                </div>
              ))}
            </div>
          )}
          {mdl && lim && <div className="mb-4"><ResponseChart fmax={20000} series={[{ curve: subSys, label: "Sub", stroke: PAL.ink, tint: PAL.alpha(PAL.ink, 0.07) }, ...(midMax ? [{ curve: midMax, label: "Mid-bass", stroke: PAL.magenta, tint: PAL.alpha(PAL.magenta, 0.06) }] : []), ...(hornModel ? [{ curve: hornModel.curve, label: "Horn", stroke: PAL.cyan, tint: PAL.alpha(PAL.cyan, 0.06) }] : [])]} marks={[{ f: mdl.Fb, label: "Fb" }, { f: xoLo, label: "XO" }, { f: xoHi, label: "XO" }]} /></div>}
          {mdl ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-0.5 text-sm">
              {[
                ["Gross internal", `${grossL.toFixed(0)} L`],
                ["Port area", `${port.area.toFixed(1)} in²`, `${((port.area / (sub.ts.Sd / 6.4516)) * 100).toFixed(0)}% of cone area`],
                ["Hydraulic diameter", `${port.dh.toFixed(2)}″`, port.dh < 2 ? "low — flare the mouths" : "acceptable with flares"],
                ["Midband sensitivity", `${(mdl.ref - 20 * Math.log10(AMP_V / 2.83)).toFixed(1)} dB`, "2.83 V, half space, 1 m"],
                ...[30, 35, 45, 60].map((f) => { const m = maxNear(f);
                  return [`Max SPL at ${f} Hz`, `${m.spl.toFixed(1)} dB`, `sine, ${m.who}-limited`]; }),
                ["First limit, music", lim.who, `at ${Math.round(lim.W / 10) * 10} W`, `at ${Math.round(lim.W / 10) * 10} W${lim.who === "cone travel (Xmax)" ? `, reached first at ${mdl.peakXF.toFixed(0)} Hz` : lim.who === "port air speed" ? `, reached first at ${mdl.peakVelF.toFixed(0)} Hz` : ""}; the two rows below are at this power.`],
                ["Peak port velocity", `${lim.vel.toFixed(1)} m/s`, `at ${mdl.peakVelF.toFixed(0)} Hz`],
                ["Peak excursion", `${(mdl.peakX * lim.V / AMP_V).toFixed(1)} mm`, `${lim.xPct.toFixed(0)}% of Xmax, at ${mdl.peakXF.toFixed(0)} Hz`],
              ]
.map(([k, v, note, tip]) => <StatRow key={k} k={k} v={v} note={note} tip={tip} />)}
            </div>
          ) : (
            <p className="text-sm text-stone-500 ">
              {sub.name} can't be modelled yet: its parameters are incomplete. {sub.note}
            </p>
          )}
          {mdl && lim && (
            <div className="flex flex-col gap-1.5 mt-4">
              {(() => {
                const F = subChips({ subSize: format.sub, subBox, portStyle, cVent, PT, subLbLoaded, lim, peakXF: mdl.peakXF, aes: sub.ts.aes, ampW });
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
          <FoldHeading id="mid" title="Mid-bass" folds={folds} toggle={toggleFold} className="mb-3" />
          <div className={foldCls("mid")}>
          {mMdl ? (<>
            <div className="grid gap-px mb-4 rounded-lg overflow-hidden border border-stone-300 bg-stone-300 grid-cols-2 sm:grid-cols-[repeat(auto-fit,minmax(112px,1fr))] [&>*:last-child:nth-child(odd)]:col-span-2 sm:[&>*:last-child:nth-child(odd)]:col-span-1">
              {[
                ["Net volume", midNetL.toFixed(0), "L"],
                ["Box resonance Fc", mMdl.Fc.toFixed(0), "Hz"],
                ["Box F3", mMdl.f3.toFixed(0), "Hz"],
                [`Max SPL @ ${xoLo} Hz`, midNear(xoLo).spl.toFixed(1), "dB"],
                ["Weight", midLbLoaded.toFixed(0), "lb"],
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
                ["Qtc", mMdl.Qtc.toFixed(2), mMdl.Qtc > 0.8 ? "peaky" : mMdl.Qtc < 0.5 ? "very damped" : "well damped"],
                ["Midband sensitivity", `${(mMdl.ref - 20 * Math.log10(MID_V / 2.83)).toFixed(1)} dB`, "2.83 V, half space, 1 m"],
                ...[xoLo, 200, 500].map((f) => { const m = midNear(f);
                  return [`Max SPL at ${f} Hz`, `${m.spl.toFixed(1)} dB`, `sine, ${m.who}-limited`]; }),
                ["Peak excursion", `${(mMdl.peakX * midUseV / MID_V).toFixed(1)} mm`, `${(mMdl.peakX * midUseV / MID_V / mid.ts.Xmax * 100).toFixed(0)}% of Xmax`, `At ${Math.round(midUseV * midUseV / 8)} W, with the ${xoLo} Hz highpass.`],
              ]
.map(([k, v, note, tip]) => <StatRow key={k} k={k} v={v} note={note} tip={tip} />)}
            </div>
            <div className="flex flex-col gap-1.5 mt-4">
              {(() => {
                const F = midChips({ midSize, midDims, Qtc: mMdl.Qtc, f3: mMdl.f3, peakX: mMdl.peakX, xoLo, ts: mid.ts, V: MID_V, useV: midUseV, vTherm: vMidTherm, mAmpW,
                  subMusicAtXo, tilt, midAtXo: subMusicAtXo != null ? midNear(xoLo) : null });
                return F.map(([kind, head, body]) => (
                  <div key={head} className={`block text-xs leading-relaxed px-3 py-2 rounded border ${CHIP_BACKGROUND_CLASSES[kind] || CHIP_BACKGROUND_CLASSES.ok}`}>
                    <b className={`font-semibold mr-1.5 ${kind === "ok" ? "text-green-800" : kind === "warn" ? "text-amber-700" : "text-red-700"}`}>{head}</b>
                    <span className="text-stone-500">{body}</span>
                  </div>
                ));
              })()}
            </div>
          </>) : (
            <p className="text-sm text-stone-500">{mid.name} can't be modelled yet: its parameters are incomplete. {mid.note}</p>
          )}
          </div>
        </section>

        <section className="mt-2" style={{ fontFamily: "var(--font)" }}>
          <FoldHeading id="horn" title="Horn" folds={folds} toggle={toggleFold} className="mb-3" />
          <div className={foldCls("horn")}>
          {hornModel ? (<>
            <div className="grid gap-px mb-4 rounded-lg overflow-hidden border border-stone-300 bg-stone-300 grid-cols-2 sm:grid-cols-[repeat(auto-fit,minmax(112px,1fr))] [&>*:last-child:nth-child(odd)]:col-span-2 sm:[&>*:last-child:nth-child(odd)]:col-span-1">
              {[
                ["Sensitivity", hf.sens.toFixed(1), "dB"],
                ["Power used", Math.round(hornModel.P), "W"],
                ["Max SPL", hornModel.flat.toFixed(1), "dB"],
                ["Coverage", hz.covH ? `${hz.covH}\u00b0\u00d7${hz.covV || "?"}\u00b0` : "\u2014", ""],
                ["Mid beam at XO", midBeam ? Math.round(midBeam) : "\u2014", midBeam ? "\u00b0" : ""],
              ].map(([k, v, u]) => (
                <div key={k} className="bg-stone-50 px-3 py-2.5">
                  <div className="text-xs uppercase tracking-wider text-stone-500 font-semibold"><StatLabel k={k} /></div>
                  <div className="text-xl font-medium tabular-nums mt-0.5 break-words">{v}<span className="text-xs text-stone-500 ml-0.5">{u}</span></div>
                </div>
              ))}
            </div>
            <div className="mb-4">
              <ResponseChart fmin={200} fmax={10000} top={180} bot={0} step={30} H={220} yLabel="horizontal beamwidth, °"
                series={[...(beamCurves.midB.length ? [{ curve: beamCurves.midB, label: `Mid-bass ${midSize}″`, stroke: PAL.magenta, tint: PAL.alpha(PAL.magenta, 0) }] : []), ...(beamCurves.hornB.length ? [{ curve: beamCurves.hornB, label: horn.name, stroke: PAL.cyan, tint: PAL.alpha(PAL.cyan, 0) }] : [])]}
                marks={[{ f: xoHi, label: "XO" }, ...(beamCurves.fK ? [{ f: beamCurves.fK, label: "horn control" }] : [])]} />
            </div>
            {paMap && (<div className="mb-4">
              <div className="flex gap-1 mb-2">{[["v", "Vertical"], ["h", "Horizontal"]].map(([v, l]) => <ToggleButton key={v} size="xs" on={paPlane === v} onClick={() => setPaPlane(v)}>{l}</ToggleButton>)}</div>
              <DispersionMap map={paMap} title={paPlane === "v" ? `Vertical dispersion at ${PA_MAP_M} m: below (−) to above (+) the horn axis` : `Horizontal dispersion at ${PA_MAP_M} m, at horn height (0° is on axis)`} />
              <div className="text-xs text-stone-500 mt-1">Mid and horn centers {mhGap.toFixed(1)}″ apart: {mhNull ? `the first null at the ${xoHi} Hz crossover is about ${mhNull.toFixed(0)}° above and below the horn axis.` : `under half a wavelength at ${xoHi} Hz, so no null at the crossover.`}</div>
            </div>)}
            <div className="flex flex-col gap-1.5">
              {(() => {
                const F = hornChips({ hf, hz, horn, xoHi, hornModel, hfAmpW, midAtXoHi: midMax ? midNear(xoHi).spl : null, hfTilt, hornAtXo: hornAt(xoHi), midBeam, fK: beamCurves.fK });
                return F.map(([kind, head, body]) => (
                  <div key={head} className={`block text-xs leading-relaxed px-3 py-2 rounded border ${CHIP_BACKGROUND_CLASSES[kind] || CHIP_BACKGROUND_CLASSES.ok}`}>
                    <b className={`font-semibold mr-1.5 ${kind === "ok" ? "text-green-800" : kind === "warn" ? "text-amber-700" : "text-red-700"}`}>{head}</b>
                    <span className="text-stone-500">{body}</span>
                  </div>
                ));
              })()}
            </div>
          </>) : (
            <p className="text-sm text-stone-500">{cd.name} can't be modelled yet: sensitivity or power rating missing.</p>
          )}
          </div>
        </section>

        </div>

        <aside className={`min-w-0 md:col-span-2 max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:z-40 max-md:bg-stone-50 max-md:border-t max-md:border-stone-300 max-md:rounded-t-xl max-md:shadow-sheet`} style={{ fontFamily: "var(--font)" }} aria-label="Settings">
          <div className="md:hidden flex gap-1 px-3 pt-2 pb-2" role="tablist">
            {[["sub", "Sub"], ["mid", "Mid"], ["horn", "Horn"], ["look", "Look"]].map(([t, label]) => (
              <button key={t} role="tab" aria-selected={sheetOpen && tab === t}
                onClick={() => { if (sheetOpen && tab === t) setSheetOpen(false); else { setTab(t); setSheetOpen(true); } }}
                className={`flex-1 px-2 py-2 rounded border text-sm ${sheetOpen && tab === t ? "border-stone-900 bg-stone-900 text-stone-50" : "border-stone-300 bg-stone-50"}`}>{label}</button>
            ))}
            {sheetOpen && <button onClick={() => setSheetOpen(false)} aria-label="Close settings" className="px-3 rounded border border-stone-300 bg-stone-50 text-sm">✕</button>}
          </div>
          <div className={`max-md:overflow-y-auto max-md:overscroll-contain max-md:px-4 max-md:pt-1 max-md:pb-4 max-md:max-h-[45dvh] ${sheetOpen ? "" : "max-md:hidden"}`}>
          <div className={tabCls("look")}>
          <div className="mb-5">
            <div className="text-sm text-stone-500 mb-1 flex items-center justify-between gap-2"><span>Plywood (baffles stay 3/4″)</span>{lk("wall", "the plywood")}</div>
            <div className="flex gap-1">
              {[[0.75, "3/4″ birch"], [0.5, "1/2″ birch, braced"]].map(([t, label]) => (
                <ToggleButton key={t} onClick={() => setWall(t)} on={wall === t}>{label}</ToggleButton>
              ))}
            </div>
            <div className="mt-3"><Slider label="Baffle inset" value={inset} min={0} max={1.5} step={0.25} unit="″" onChange={setInset} /></div>
          </div>
          </div>
          <div className={tabCls("sub")}>
          <SelectField label="Sub driver" options={subList} value={sub} onChange={setSub} extra={lk("sub", "the sub driver")} />
          </div>
          <div className={tabCls("look")}>
          <SwatchPicker label="Cabinet finish" value={cabFinish} onChange={setCabFinish} swatches={PAINT_SWATCHES} presets={CABINET_FINISHES} titlePrefix="Painted: "
            note={CABINET_FINISHES[cabFinish] ? CABINET_FINISHES[cabFinish].name : `painted ${cabFinish}`} />
          </div>
          <div className={tabCls("look")}>
          <SwatchPicker label="Baffle colour" value={baffleColor} onChange={setBaffleColor} swatches={PAINT_SWATCHES} note={baffleColor} />
          </div>
          <div className={tabCls("look")}>
          <div className="mb-5">
            <div className="text-sm text-stone-500 mb-1">View</div>
            <div className="flex gap-1">
              {[["Finished", false], ["Cutaway", true]].map(([label, v]) => (
                <ToggleButton key={label} onClick={() => setCutaway(v)} on={cutaway === v}>{label}</ToggleButton>
              ))}
            </div>
          </div>
          </div>
          <div className={tabCls("look")}>
          <div className="mb-5">
            <div className="text-sm text-stone-500 mb-1">Layout</div>
            <div className="flex gap-1">
              {[["Two stacks", "stack"], ["Tops on spacers", "pole"], ["Tower", "tower"], ["One sub + satellites", "satellite"]].map(([label, v]) => (
                <ToggleButton key={v} onClick={() => setLayout(v)} on={layout === v}>{label}</ToggleButton>
              ))}
            </div>
            {layout === "pole" && <div className="mt-3"><Slider label="Spacer height" value={spacerH} min={4} max={36} step={1} unit="″" onChange={setSpacerH} /></div>}
          </div>
          </div>
          <div className={tabCls("sub")}>
          <div className="mb-5">
            <div className="text-sm text-stone-500 mb-1">Cabinet</div>
            <Card>
              <Slider label="Width"  value={cDim.w} min={18} max={40} step={0.5} unit="″" onChange={(v) => setC("w", v)} extra={dl("subDim", "w", "Sub width")} />
              <Slider label="Height" value={cDim.h} min={18} max={42} step={0.5} unit="″" onChange={(v) => setC("h", v)} extra={dl("subDim", "h", "Sub height")} />
              <Slider label="Depth"  value={cDim.d} min={14} max={32} step={0.5} unit="″" onChange={(v) => setC("d", v)} extra={dl("subDim", "d", "Sub depth")} />
            </Card>
          </div>
          </div>
          <div className={tabCls("sub")}>
          <div className="mb-5">
            <div className="text-sm text-stone-500 mb-1 flex items-center justify-between gap-2"><span>Vent</span>{lk("vent", "the vent style")}</div>
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
                <Slider label="Slot height" value={cVent.slotH} min={1.5} max={9} step={0.25} unit="″" onChange={(v) => setV("slotH", v)} />}
              {(portStyle === "vslots" || portStyle === "vslot1") &&
                <Slider label="Duct throat" value={cVent.throat} min={1} max={portStyle === "vslot1" ? 10 : 7} step={0.25} unit="″" onChange={(v) => setV("throat", v)} />}
              {portStyle.startsWith("round") && <>
                <Slider label="Tubes" value={cVent.nt} min={1} max={6} step={1} unit="" onChange={(v) => setV("nt", v)} />
                <Slider label="Tube diameter" value={cVent.dia} min={3} max={10} step={0.25} unit="″" onChange={(v) => setV("dia", v)} />
              </>}
              <Slider label="Duct length" value={cVent.len} min={3} max={30} step={0.5} unit="″" onChange={(v) => setV("len", v)} />
              <Slider label="Port velocity limit" value={portMax} min={12} max={30} step={0.5} unit=" m/s" onChange={setPortMax} />
              <div className="text-xs text-stone-500">{port.desc}. {port.area.toFixed(1)} in&#178;.</div>
            </Card>
          </div>
          <div className="mb-5">
            <div className="text-sm text-stone-500 mb-1">Sub highpass and amp</div>
            <Card>
              <Slider label={`Highpass (${hpType})`} value={hpf} min={20} max={50} step={1} unit=" Hz" onChange={setHpf} extra={lk("hpf", "the highpass")} />
              <div className="flex flex-wrap gap-1 -mt-1 mb-3">
                {Object.keys(HIGHPASS_ALIGNMENTS).map((t) => (
                  <ToggleButton key={t} onClick={() => setHpType(t)} on={hpType === t} size="xs">{t}</ToggleButton>
                ))}
              </div>
              <Slider label="Amp power per channel @ 8 Ω" value={ampW} min={200} max={3000} step={50} unit=" W" onChange={setAmpW} extra={lk("ampW", "the sub amp power")} />
            </Card>
          </div>
          </div>
          <div className={tabCls("mid")}>
          <div className="mb-2">
            <div className="text-sm text-stone-500 mb-1">Mid-bass size</div>
            <div className="flex gap-1">
              {[12, 15].map((n) => (
                <ToggleButton key={n} onClick={() => setMidSize(n)} on={midSize === n}>{n}″</ToggleButton>
              ))}
            </div>
          </div>
          <SelectField label={`Mid-bass ${midSize}″`} options={midList} value={mid} onChange={setMid} extra={lk("mid", "the mid-bass driver")} />
          <div className="mb-5">
            <div className="text-sm text-stone-500 mb-1">Mid-bass cabinet (sealed)</div>
            <Card>
              {layout === "tower" ? (
                <div className="text-xs text-stone-500 mb-3">Tower layout: the mid chamber is the sub's footprint, {cDim.w}″ × 15.5″ × {cDim.d}″.</div>
              ) : (<>
                <Slider label="Width"  value={mDim.w} min={10} max={24} step={0.5} unit="″" onChange={(v) => setM("w", v)} extra={dl("midDim", "w", "Mid width")} />
                <Slider label="Height" value={mDim.h} min={10} max={24} step={0.5} unit="″" onChange={(v) => setM("h", v)} extra={dl("midDim", "h", "Mid height")} />
                <Slider label="Depth"  value={mDim.d} min={8} max={24} step={0.5} unit="″" onChange={(v) => setM("d", v)} extra={dl("midDim", "d", "Mid depth")} />
              </>)}
              <Slider label="Crossover, sub to mid" value={xoLo} min={60} max={250} step={5} unit=" Hz" onChange={setXoLo} extra={lk("xoLo", "the sub-to-mid crossover")} />
              <Slider label="Crossover, mid to horn" value={xoHi} min={500} max={2000} step={50} unit=" Hz" onChange={setXoHi} extra={lk("xoHi", "the mid-to-horn crossover")} />
              <Slider label="Mid amp power per channel @ 8 Ω" value={mAmpW} min={50} max={2000} step={25} unit=" W" onChange={setMAmpW} extra={lk("mAmpW", "the mid amp power")} />
              <Slider label={<Tooltip tip="0 dB asks the mid to match the sub flat out. Bass-heavy music usually carries 6–10 dB less from 200 Hz to 1 kHz than at 40–60 Hz.">Music balance: mid band needs less by</Tooltip>} value={tilt} min={0} max={12} step={1} unit=" dB" onChange={setTilt} />
            </Card>
          </div>
          </div>
          <div className={tabCls("horn")}>
          <SelectField label="Compression driver" options={CD_OPTIONS} value={cd} onChange={setCd} extra={lk("cd", "the compression driver")} />
          <SelectField label="Horn" options={HORN_OPTIONS} value={horn} onChange={setHorn} extra={lk("horn", "the horn")} />
          <Card className="mb-4">
            <Slider label="HF amp power per channel @ 8 Ω" value={hfAmpW} min={10} max={500} step={5} unit=" W" onChange={setHfAmpW} extra={lk("hfAmpW", "the HF amp power")} />
            <Slider label="Music balance: HF band needs less by" value={hfTilt} min={0} max={12} step={1} unit=" dB" onChange={setHfTilt} />
          </Card>
          {mismatch && <div className="text-sm text-red-700 mb-4">Horn throat and driver exit don't match ({horn.exit}″ vs {cd.exit}″).</div>}
          </div>
          </div>
        </aside>


        <section className="min-w-0 md:col-span-5 mt-6" style={{ fontFamily: "var(--font)" }}>
          <FoldHeading id="totals" title="Totals for the current selection" folds={folds} toggle={toggleFold} className="mb-2" />
          <div className={foldCls("totals")}>
          {(() => {
            const subBoxLb = subLbLoaded - (sub.lb || 0); // same estimate as the stats row
            const midBoxLb = midCabLb;   // same estimate as the mid-bass stats row
            const rows = [
              ["Sub column", sub.price, sub.lb, subBoxLb, subBox.h],
              ["Mid-bass box", mid.price, mid.lb, midBoxLb, midDims.h],
              ["Compression driver", cd.price, cd.lb || 0, 0, 0],
              ["Horn", horn.price, (horn.lb || 0) + 1, 0, horn.size.h + 1],
            ];
            const sum = (i) => rows.reduce((a, r) => a + (r[i] || 0), 0);
            const stackLb = sum(2) + sum(3) + (plinth ? 6 : 0);
            return (
              <div className="overflow-x-auto max-w-3xl"><table className="text-sm w-full min-w-[340px] border-collapse">
                <thead><tr className="text-stone-500 text-left border-b border-stone-300">
                  <th className="py-1 pr-4 font-normal">Per stack</th><th className="py-1 pr-4 font-normal text-right">Drivers $</th><th className="py-1 pr-4 font-normal text-right">Driver lb</th><th className="py-1 pr-4 font-normal text-right">Cabinet lb</th><th className="py-1 pr-4 font-normal text-right">Box lb</th><th className="py-1 font-normal text-right">Height in</th>
                </tr></thead>
                <tbody>
                  {rows.map(([n, pr, dl, cl, h]) => (
                    <tr key={n} className="border-b border-stone-300"><td className="py-1 pr-4">{n}</td><td className="py-1 pr-4 text-right tabular-nums">{pr ? `$${pr}` : "—"}</td><td className="py-1 pr-4 text-right tabular-nums">{dl.toFixed(0)}</td><td className="py-1 pr-4 text-right tabular-nums">{cl ? cl.toFixed(0) : "—"}</td><td className="py-1 pr-4 text-right tabular-nums">{(dl + cl).toFixed(0)}</td><td className="py-1 text-right tabular-nums">{h.toFixed(1)}</td></tr>
                  ))}
                  <tr className="font-medium"><td className="py-1 pr-4">One stack{plinth ? ` + ${plinth}" plinth` : ""}</td><td className="py-1 pr-4 text-right tabular-nums">${sum(1).toLocaleString()}</td><td className="py-1 pr-4 text-right tabular-nums">{sum(2).toFixed(0)}</td><td className="py-1 pr-4 text-right tabular-nums">{(sum(3) + (plinth ? 6 : 0)).toFixed(0)}</td><td className="py-1 pr-4 text-right tabular-nums">{stackLb.toFixed(0)}</td><td className="py-1 text-right tabular-nums">{stackH.toFixed(0)}</td></tr>
                  <tr className="font-medium text-stone-900"><td className="py-1 pr-4">Pair</td><td className="py-1 pr-4 text-right tabular-nums">${(2 * sum(1)).toLocaleString()}</td><td className="py-1 pr-4 text-right tabular-nums">{(2 * sum(2)).toFixed(0)}</td><td className="py-1 pr-4 text-right tabular-nums">{(2 * (sum(3) + (plinth ? 6 : 0))).toFixed(0)}</td><td className="py-1 pr-4 text-right tabular-nums">{(2 * stackLb).toFixed(0)}</td><td></td></tr>
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
              {sub.name} in a {subBox.w}×{subBox.h}×{subBox.d} in cabinet, {grossL.toFixed(0)} L gross, {netL.toFixed(0)} L net.
              Vent: {port.desc}. 3/4″ baffle set {inset}″ behind the frame, {wall === 0.5 ? "1/2″" : "3/4″"} birch walls, 1/4″ roundovers on the front edges.
            </p>
          </div>
          <div>
            <SectionHeading className="mb-2">Mid-bass cube</SectionHeading>
            <p className="text-sm text-stone-900">
              {mid.name} in a {midDims.w}×{midDims.h}×{midDims.d} in sealed box, gross {midL.toFixed(0)} L, lightly stuffed.
              Covers {xoLo} Hz to {xoHi} Hz. Same construction, flush-mounted driver.
            </p>
            {mid.note && <p className="text-sm text-stone-500 mt-2"><span className="font-medium text-stone-900">{mid.name}.</span> {mid.note}</p>}
          </div>
          <div>
            <SectionHeading className="mb-2">Horn</SectionHeading>
            <p className="text-sm text-stone-900">
              {horn.name} with {cd.name}, crossed at {xoHi} Hz (maker suggests {horn.xo}). Sits on a short block so the mouth clears the cube.
              Total stack height about {stackH.toFixed(0)} in, horn center at {hornCenter.toFixed(0)} in.
            </p>
            {cd.note && <p className="text-sm text-stone-500 mt-2"><span className="font-medium text-stone-900">{cd.name}.</span> {cd.note}</p>}
            {horn.note && <p className="text-sm text-stone-500 mt-2"><span className="font-medium text-stone-900">{horn.name}.</span> {horn.note}</p>}
          </div>
        </section>}

      </main>
      </>}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(React.createElement(StackPlanner));
