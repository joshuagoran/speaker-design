import { HIFI_WOOFERS_BY_SIZE, HIFI_PASSIVES_BY_SIZE, isCompressionDriver, HIFI_TWEETERS_BY_TYPE } from "./hifiDriverLists.js";
import { HifiResultCard } from "./HifiResultCard.jsx";
import { ToggleButton } from "../../components/ui/ToggleButton.jsx";
import { Button } from "../../components/ui/Button.jsx";
import { Tooltip } from "../../components/ui/Tooltip.jsx";
import { Card } from "../../components/ui/Card.jsx";
import { SectionHeading } from "../../components/ui/SectionHeading.jsx";
import { NumberField } from "../../components/ui/NumberField.jsx";
import { SelectField } from "../../components/ui/SelectField.jsx";
import { Slider } from "../../components/ui/Slider.jsx";
import { Notice } from "../../components/ui/Notice.jsx";
import { ResponseChart } from "../../components/charts/ResponseChart.jsx";
import { DispersionMap } from "../../components/charts/DispersionMap.jsx";
import { RoomView } from "../../components/drawings/RoomView.jsx";
import { HifiFront } from "../../components/drawings/HifiFront.jsx";
import { LockButton } from "../../components/lock/LockButton.jsx";
import { DimensionLock } from "../../components/lock/DimensionLock.jsx";
import { CHIP_BACKGROUND_CLASSES } from "../../components/optimizer/OptimizerResultCard.jsx";
import { OptimizerBar } from "../../components/optimizer/OptimizerBar.jsx";
import { GoalPicker } from "../../components/optimizer/GoalPicker.jsx";
import { RunRow } from "../../components/optimizer/RunRow.jsx";
import { ResultCards } from "../../components/optimizer/ResultCards.jsx";
import { StatLabel } from "../../components/optimizer/StatRow.jsx";
import { useConfigStore } from "../../components/saved-configs/useConfigStore.js";
import { SavedConfigs } from "../../components/saved-configs/SavedConfigs.jsx";
import { HIFI_TOP, HIFI_BOT } from "../../constants/chartScales.js";
import { METERS_PER_FOOT } from "../../constants/units.js";
import { HORN_OPTIONS, HIFI_WOOFERS, HIFI_TWEETERS, HIFI_PASSIVES, passiveRadiatorMassMax } from "../../lib/data.js";
import { hifiSystem, hifiChips, hifiResponseAt, hifiDispersionMap, logSpacedFrequencies, linkwitzRileyFilter, SPEAKER_PLACEMENTS as HIFI_PLACES } from "../../lib/hifi/hifi.js";
import { optimizeHifiSpeaker, HIFI_OPTIMIZER_GOALS, HIFI_LOCK_KEYS } from "../../lib/hifi/optimize.js";
const { useState } = React;

/** Hi-fi page: 2-way home speakers with an active crossover. */
export function HifiPage() {
  const guides = HORN_OPTIONS.filter((h) => h.exit === 1 && h.hf && h.hf.covH && h.size);
  const [w, setW] = useState(HIFI_WOOFERS.find((o) => o.pick) || HIFI_WOOFERS[0]);
  const [t, setT] = useState(HIFI_TWEETERS.find((o) => o.pick) || HIFI_TWEETERS[0]);
  const [guideSel, setGuide] = useState(guides.find((g) => g.id === "st260") || guides[0]);
  const [box, setBox] = useState("vented");
  const [dim, setDim] = useState({ w: 9, h: 15, d: 11 });
  const [wall, setWall] = useState(0.75);
  const [mat, setMat] = useState("ply");
  const [port, setPort] = useState({ n: 1, dia: 2, len: 6 });
  const [prSel, setPrSel] = useState({ id: "sb16pfcr", n: 2, addG: 0 });
  const [xo, setXo] = useState(2000);
  const [order, setOrder] = useState(4);
  const [wAmpW, setWAmpW] = useState(100);
  const [tAmpW, setTAmpW] = useState(50);
  const [bsc, setBsc] = useState(3);
  const [place, setPlace] = useState("free");
  const [wallFt, setWallFt] = useState(2);
  const [spacing, setSpacing] = useState(7);
  const [toe, setToe] = useState(15);
  const [seat, setSeat] = useState({ x: 0, y: 8 });
  const [earIn, setEarIn] = useState(38);
  const [standIn, setStandIn] = useState(24);
  const [plane, setPlane] = useState("h");
  const store = useConfigStore("hifiConfigs");
  // optimizer: same rules and layout as the PA planner's (switch, locks on the controls, goals in tap order)
  const ls = { get: (k, fb) => { try { const v = localStorage.getItem(k); return v == null ? fb : JSON.parse(v); } catch { return fb; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} } };
  const [hOn, setHOnRaw] = useState(() => ls.get("hifi.opt", false));
  const setHOn = (v) => { setHOnRaw(v); ls.set("hifi.opt", v); };
  const [hGoals, setHGoals] = useState([]);
  const [hBudget, setHBudget] = useState(() => ls.get("hifi.budget", 800));
  const [hLocks, setHLocksRaw] = useState(() => { const l = ls.get("hifi.locks", {}) || {}; return { ...l, dim: { ...(l.dim || {}) } }; });
  const setHLocks = (f) => setHLocksRaw((p) => { const n = f(p); ls.set("hifi.locks", n); return n; });
  const [hRes, setHRes] = useState(null);
  const [hBusy, setHBusy] = useState(false);
  const [hPreview, setHPreview] = useState(null);   // { label, before, card }
  const [hUndo, setHUndo] = useState(null);
  const setD = (k, v) => setDim((p) => ({ ...p, [k]: v }));
  const setP = (k, v) => setPort((p) => ({ ...p, [k]: v }));
  const guide = t.type === "compression" || t.needsWaveguide ? { covH: guideSel.hf.covH, covV: guideSel.hf.covV || guideSel.hf.covH, w: guideSel.size.w, h: guideSel.size.h, name: guideSel.name, freestanding: !guideSel.rect } : null;
  const prDrv = HIFI_PASSIVES.find((o) => o.id === prSel.id) || HIFI_PASSIVES[0];
  const pr = { drv: prDrv, n: prSel.n, addG: Math.min(prSel.addG, passiveRadiatorMassMax(prDrv)) };
  const cfg = { box, dim, wall, mat, port, pr, xo, order, wAmpW, tAmpW, bsc, place, wallFt, portMax: 17, guide };
  const tt = guide ? { ...t, faceplate: { w: guide.w, h: guide.h } } : t;
  const sys = hifiSystem(w, tt, cfg);
  if (!sys) return <main className="max-w-6xl mx-auto px-4 md:px-8 pb-16 text-sm">This woofer can't be modelled (its parameters aren't published).</main>;
  const F = hifiChips(sys, w, tt, cfg);
  // the seat, relative to each speaker (left at -spacing/2, toed in toward the middle)
  const geoOf = (sign) => {
    const sx = (sign * spacing) / 2, vx = seat.x - sx, vy = seat.y, d = Math.hypot(vx, vy);
    const axis = (-sign * toe * Math.PI) / 180, ang = Math.atan2(vx, vy) - axis;
    return { th: Math.abs(ang), eyeIn: earIn - standIn, distM: d * METERS_PER_FOOT };
  };
  const gL = geoOf(-1), gR = geoOf(1);
  const freqs = logSpacedFrequencies(15, 20000, 220);
  const rL = hifiResponseAt(sys, w, tt, cfg, gL, freqs), rR = hifiResponseAt(sys, w, tt, cfg, gR, freqs);
  const on = hifiResponseAt(sys, w, tt, cfg, { th: 0, eyeIn: sys.lay.tweeterIn, distM: 1 }, freqs);
  const pair = rL.map((o, i) => ({ f: o.f, spl: 10 * Math.log10(Math.pow(10, o.spl / 10) + Math.pow(10, rR[i].spl / 10)) }));
  const seatDist = (gL.distM + gR.distM) / 2;
  const atSeat = sys.maxLevel - 20 * Math.log10(seatDist) + 3;
  const tMax = freqs.map((f) => ({ f, spl: sys.tLevel + 20 * Math.log10(Math.max(1e-6, Math.hypot(linkwitzRileyFilter(f, xo, order, "hp").re, linkwitzRileyFilter(f, xo, order, "hp").im))) }));
  const map = hifiDispersionMap(sys, w, tt, cfg, plane, Math.max(1, seatDist));
  const pairCost = 2 * ((w.price || 0) + (t.price || 0) + (guide ? guideSel.price || 0 : 0) + (box === "radiator" ? pr.n * (prDrv.price || 0) : 0));
  const tile = (k, v, u) => (
    <div key={k} className="bg-stone-50 px-3 py-2.5">
      <div className="text-xs uppercase tracking-wider text-stone-500 font-semibold"><StatLabel k={k} /></div>
      <div className="text-xl font-medium tabular-nums mt-0.5 break-words">{v}<span className="text-xs text-stone-500 ml-0.5">{u}</span></div>
    </div>
  );
  const hLk = (key, what) => (hOn ? <LockButton on={!!hLocks[key]} what={what} onClick={() => setHLocks((p) => ({ ...p, [key]: !p[key] }))} /> : null);
  const hDl = (dm, what) => (hOn ? <DimensionLock mode={hLocks.dim[dm] || "free"} what={what} onChange={(m) => setHLocks((p) => ({ ...p, dim: { ...p.dim, [dm]: m } }))} /> : null);
  const snapH = () => ({ woofer: w.id, tweeter: t.id, box, dim, port, pr: box === "radiator" ? prSel : undefined, wall, xo, wAmpW, tAmpW });
  // Everything on the page, for saving (undefined fields dropped: the stores reject them)
  const savedSnapH = () => JSON.parse(JSON.stringify({ ...snapH(), guide: guideSel.id, mat, order, bsc, place, wallFt, spacing, toe, seat, earIn, standIn,
    summary: `${w.name} + ${t.name} · ${dim.w}×${dim.h}×${dim.d}″ · ${box === "radiator" ? "passive radiator" : box}` }));
  const restoreH = (c) => {
    const pick = (list, id) => list.find((o) => o.id === id);
    const ok = (f, v) => { if (v !== undefined) f(v); };
    ok(setW, pick(HIFI_WOOFERS, c.woofer)); ok(setT, pick(HIFI_TWEETERS, c.tweeter)); ok(setGuide, pick(guides, c.guide));
    [[setBox, c.box], [setDim, c.dim], [setPort, c.port], [setPrSel, c.pr], [setWall, c.wall], [setMat, c.mat], [setXo, c.xo], [setOrder, c.order],
     [setWAmpW, c.wAmpW], [setTAmpW, c.tAmpW], [setBsc, c.bsc], [setPlace, c.place], [setWallFt, c.wallFt], [setSpacing, c.spacing], [setToe, c.toe],
     [setSeat, c.seat], [setEarIn, c.earIn], [setStandIn, c.standIn]].forEach(([f, v]) => ok(f, v));
    setHPreview(null); setHUndo(null); setHRes(null);
  };
  const applyH = (c) => {
    setW(HIFI_WOOFERS.find((o) => o.id === c.woofer)); setT(HIFI_TWEETERS.find((o) => o.id === c.tweeter));
    setBox(c.box); setDim(c.dim); if (c.port) setPort(c.port); if (c.pr) setPrSel(c.pr); setWall(c.wall); setXo(c.xo); setWAmpW(c.wAmpW); setTAmpW(c.tAmpW);
  };
  const runH = () => {
    setHBusy(true);
    const base = hPreview ? hPreview.before : snapH();
    setTimeout(() => {
      try { setHRes(optimizeHifiSpeaker({ cur: { ...cfg, ...base }, woofers: HIFI_WOOFERS, tweeters: HIFI_TWEETERS, passives: HIFI_PASSIVES, goals: hGoals, locks: hLocks, budget: hBudget, seatM: seatDist, guidePrice: guideSel.price || 0 })); }
      finally { setHBusy(false); }
    }, 30);
  };
  const previewH = (k) => { const before = hPreview ? hPreview.before : snapH(); applyH(k.config); setHPreview({ label: k.label, before, card: k }); };
  const backH = () => { if (hPreview) applyH(hPreview.before); setHPreview(null); };
  const loadH = (k) => { const before = hPreview ? hPreview.before : snapH(); applyH(k.config); setHPreview(null); setHUndo(before); };
  const tapG = (g) => setHGoals((p) => (p.includes(g) ? p.filter((x) => x !== g) : [...p, g]));
  const nLocks = HIFI_LOCK_KEYS.filter((k) => hLocks[k]).length + Object.values(hLocks.dim).filter((m) => m && m !== "free").length;
  const allLocks = { ...Object.fromEntries(HIFI_LOCK_KEYS.map((k) => [k, true])), dim: { w: "exact", h: "exact", d: "exact" } };
  const optBar = (
    <OptimizerBar on={hOn} onToggle={() => setHOn(!hOn)} hint="Find cheaper, lighter, deeper or louder designs inside your limits."
      nLocks={nLocks} lockMax={HIFI_LOCK_KEYS.length + 3} onLockAll={() => setHLocks(() => allLocks)} onClear={() => setHLocks(() => ({ dim: {} }))} />
  );
  const optPanel = hOn && (
    <Card pad="lg" className="mt-3">
      <SectionHeading>Find a better design</SectionHeading>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
        <div className="mt-3">
          <NumberField label={<>Driver budget, pair <span className="text-xs">(woofers + tweeters{guide ? " + waveguides" : ""}, at the listed prices)</span></>} value={hBudget} min={50} step={25} unit="$" onChange={(n) => { setHBudget(n); ls.set("hifi.budget", n); }} className="" />
        </div>
        <GoalPicker defs={HIFI_OPTIMIZER_GOALS} selected={hGoals} onTap={tapG} />
      </div>
      <RunRow busy={hBusy} hasGoal={hGoals.length > 0} onRun={runH} stats={hRes && hRes.stats} note={hRes && hRes.cards.length ? " · every design shown passes the checks (warnings are listed on the card)" : ""}>
        {hUndo && !hPreview && <Button size="md" onClick={() => { applyH(hUndo); setHUndo(null); }}>Undo load</Button>}
      </RunRow>
      {hRes && !hBusy && hRes.curProblems.length > 0 && <Notice>Your design fails: {hRes.curProblems.join("; ")}. Fixes may cost or weigh more.</Notice>}
      {hRes && !hBusy && <ResultCards cards={hRes.cards} render={(k, i) => <HifiResultCard key={i} k={k} i={i} n={hRes.cards.length} curCurve={hRes.curCurve} guide={guide} previewing={hPreview && hPreview.card === k} onPreview={() => previewH(k)} onLoad={() => loadH(k)} />} />}
      {hRes && !hBusy && hRes.goalMissing && <Notice>{hRes.goalMissing}</Notice>}
      {hRes && !hBusy && !hRes.cards.length && !hRes.goalMissing && <div className="mt-3 text-sm text-orange-900">Nothing fits all your limits. A bigger budget or fewer locks would open it up.</div>}
    </Card>
  );
  return (
    <main className="max-w-6xl mx-auto px-4 md:px-8 pb-16 grid grid-cols-1 md:grid-cols-5 gap-8" style={{ fontFamily: "var(--font)" }}>
      <div className="md:col-span-5 min-w-0">
        <SavedConfigs bare store={store} snapshot={savedSnapH} restore={restoreH} />
        {optBar}
        {optPanel}
        {hPreview && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded bg-stone-900 text-white border-t-4 border-cmy-y px-3 py-2 text-sm font-semibold">
            <span className="flex-1">Previewing “{hPreview.label}”</span>
            <button onClick={() => loadH(hPreview.card)} className="px-3 py-1.5 rounded border border-stone-900 bg-white text-stone-900">Keep</button>
            <button onClick={backH} className="px-3 py-1.5 rounded border border-stone-900 bg-white text-stone-900">Back</button>
          </div>
        )}
      </div>
      <div className="min-w-0 md:col-span-3 flex flex-col gap-4">
        <div className="flex gap-4 items-center">
        <div className="shrink-0"><HifiFront dim={dim} w={w} t={tt} lay={sys.lay} vented={sys.vented} port={port} pr={sys.radiator ? pr : null} guide={guide} /></div>
        <div className="flex-1 min-w-0 grid gap-px rounded-lg overflow-hidden border border-stone-300 bg-stone-300 grid-cols-2 sm:grid-cols-3 [&>*:last-child:nth-child(odd)]:col-span-2 sm:[&>*:last-child:nth-child(odd)]:col-span-1">
          {tile("Net volume", sys.net.toFixed(1), "L")}
          {sys.Fb != null ? tile("Tuning Fb", sys.Fb.toFixed(0), "Hz") : tile("Qtc", sys.Qtc.toFixed(2), "")}
          {tile("F3 in room", sys.f3.toFixed(0), "Hz")}
          {tile("Max at the seat", atSeat.toFixed(0), "dB")}
          {tile("Weight", sys.lb.toFixed(0), "lb")}
          {tile("Pair", `$${Math.round(pairCost)}`, "")}
        </div>
        </div>
        <ResponseChart fmin={15} fmax={20000} top={HIFI_TOP} bot={HIFI_BOT} step={10} yLabel="dB SPL at 2.83 V"
          series={[{ curve: on, label: "On axis, 1 m", stroke: PAL.ink, tint: PAL.alpha(PAL.ink, 0) }, { curve: pair, label: `Pair at the seat (${(seatDist / METERS_PER_FOOT).toFixed(1)} ft)`, stroke: PAL.cyan, tint: PAL.alpha(PAL.cyan, 0.06) }]}
          marks={[{ f: xo, label: "XO" }, { f: sys.bsF3, label: "Baffle step" }, ...(sys.Fb ? [{ f: sys.Fb, label: "Fb" }] : [])]} />
        <ResponseChart fmin={15} fmax={20000} top={HIFI_TOP} bot={HIFI_BOT} step={10} yLabel="max dB SPL @ 1 m"
          series={[{ curve: sys.wMax, label: w.name, stroke: PAL.magenta, tint: PAL.alpha(PAL.magenta, 0.06) }, { curve: tMax, label: t.name, stroke: PAL.cyan, tint: PAL.alpha(PAL.cyan, 0.06) }]} marks={[{ f: xo, label: "XO" }]} />
        <div className="flex flex-col gap-1.5">
          {F.map(([kind, head, body]) => (
            <div key={head} className={`block text-xs leading-relaxed px-3 py-2 rounded border ${CHIP_BACKGROUND_CLASSES[kind] || CHIP_BACKGROUND_CLASSES.ok}`}>
              <b className={`font-semibold mr-1.5 ${kind === "ok" ? "text-green-800" : kind === "warn" ? "text-amber-700" : "text-red-700"}`}>{head}</b>
              <span className="text-stone-500">{body}</span>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
          <RoomView spacing={spacing} toe={toe} seat={seat} setSeat={setSeat} angles={[(gL.th * 180) / Math.PI, (gR.th * 180) / Math.PI]} />
          <div className="text-sm text-stone-500 leading-relaxed">
            <div className="text-xs uppercase tracking-wider text-stone-500 font-semibold mb-1">At the seat</div>
            <div>{(seatDist / METERS_PER_FOOT).toFixed(1)} ft from the pair</div>
            <div>Off axis: L {((gL.th * 180) / Math.PI).toFixed(0)}°, R {((gR.th * 180) / Math.PI).toFixed(0)}°</div>
            <div>Ears {earIn - standIn - sys.lay.tweeterIn >= 0 ? "above" : "below"} tweeter {Math.abs(earIn - standIn - sys.lay.tweeterIn).toFixed(1)}″</div>
            <div><Tooltip tip={`Clean up to about ${atSeat.toFixed(0)} dB at the seat with both speakers playing.`}>Max level</Tooltip> {atSeat.toFixed(0)} dB</div>
          </div>
        </div>
        <div>
          <div className="flex gap-1 mb-2">{[["Horizontal", "h"], ["Vertical", "v"]].map(([l, v]) => <ToggleButton key={v} onClick={() => setPlane(v)} on={plane === v}>{l}</ToggleButton>)}</div>
          <DispersionMap map={map} title={plane === "h" ? "Horizontal dispersion, one speaker (0° is on axis)" : "Vertical dispersion: below (−) to above (+) the tweeter axis"} />
        </div>
        <details className="text-xs text-stone-500 rounded border border-stone-300 bg-stone-50 px-3 py-2">
          <summary className="cursor-pointer text-sm text-stone-900 py-1">Details</summary>
          <div className="leading-relaxed mt-1 flex flex-col gap-1.5">
            <div>Woofer {sys.lay.wooferIn.toFixed(1)}″ and tweeter {sys.lay.tweeterIn.toFixed(1)}″ from the bottom, {sys.lay.spacingIn.toFixed(1)}″ apart. {sys.gross.toFixed(1)} L gross, {sys.net.toFixed(1)} L net{sys.hpf ? `; DSP highpass ${sys.hpf} Hz (BW24) below the port tuning` : ""}.</div>
            <div>Tweeter trimmed {sys.trim.toFixed(1)} dB in the DSP to match the woofer; baffle step centered at {sys.bsF3.toFixed(0)} Hz{bsc ? `, ${bsc} dB boost` : ""}.</div>
            <div><Tooltip tip={w.note}><span className="font-medium text-stone-900">{w.name}</span></Tooltip></div>
            <div><Tooltip tip={t.note}><span className="font-medium text-stone-900">{t.name}</span></Tooltip></div>
            {guide && <div><Tooltip tip={guideSel.note}><span className="font-medium text-stone-900">{guide.name}</span></Tooltip></div>}
          </div>
        </details>
      </div>
      <aside className="min-w-0 md:col-span-2">
        <SelectField label={`Woofer · ${w.size}″`} options={HIFI_WOOFERS_BY_SIZE} value={w} onChange={setW} extra={hLk("woofer", "the woofer")} group={(o) => `${o.size}″ woofers`} />
        <SelectField label={`Tweeter · ${isCompressionDriver(t) ? "compression driver" : "dome"}`} options={HIFI_TWEETERS_BY_TYPE} value={t} onChange={setT} extra={hLk("tweeter", "the tweeter")} group={(o) => (isCompressionDriver(o) ? "Compression drivers (on a waveguide)" : "Dome tweeters")} />
        {guide && <SelectField label="Waveguide" options={guides} value={guideSel} onChange={setGuide} />}
        <div className="grid grid-cols-[5.5rem_1fr_auto] items-center gap-x-2 gap-y-2 mb-3 text-sm">
          <span className="text-stone-500">Material</span>
          <div className="flex flex-wrap gap-1">{[["Birch ply", "ply"], ["MDF", "mdf"]].map(([l, v]) => <ToggleButton key={v} onClick={() => setMat(v)} on={mat === v}>{l}</ToggleButton>)}</div>
          <span />
          <span className="text-stone-500">Thickness</span>
          <div className="flex flex-wrap gap-1">{[[0.75, "3/4″"], [0.5, "1/2″"]].map(([v, l]) => <ToggleButton key={v} onClick={() => setWall(v)} on={wall === v}>{l}</ToggleButton>)}</div>
          <span>{hLk("wall", "the panel thickness")}</span>
        </div>
        <Card className="mb-4">
          <Slider label="Width" value={dim.w} min={6} max={16} step={0.25} unit="″" onChange={(v) => setD("w", v)} extra={hDl("w", "Width")} />
          <Slider label="Height" value={dim.h} min={9} max={44} step={0.25} unit="″" onChange={(v) => setD("h", v)} extra={hDl("h", "Height")} />
          <Slider label="Depth" value={dim.d} min={6} max={16} step={0.25} unit="″" onChange={(v) => setD("d", v)} extra={hDl("d", "Depth")} />
          <div className="flex items-center justify-between gap-2 mb-1 mt-1"><span className="text-sm text-stone-500">Ports</span>{hLk("box", "sealed, ported or radiator")}</div>
          <div className="grid grid-cols-3 gap-1 mb-3">{[["Sealed", "sealed", 0, "Sealed"], ["1 port", "vented", 1, "One round port"], ["2 ports", "vented", 2, "Two round ports"], ["Slot", "vented", "slot", "Slot vent along the bottom of the baffle"], ["1 PR", "radiator", 1, "One passive radiator"], ["2 PR", "radiator", 2, "Two passive radiators"]].map(([l, v, n, tip]) => {
            const slotOn = port.shape === "slot";
            const on = box === v && (v === "sealed" || (v === "vented" ? (n === "slot" ? slotOn : !slotOn && port.n === n) : pr.n === n));
            return <ToggleButton key={l} size="xs" className="min-w-0 whitespace-nowrap" title={tip} aria-label={tip} on={on} onClick={() => { setBox(v); if (v === "vented") setPort((p) => (n === "slot" ? { ...p, shape: "slot", h: p.h || 1, len: p.len } : { ...p, shape: "round", n })); if (v === "radiator") setPrSel((p) => ({ ...p, n })); }}>{l}</ToggleButton>;
          })}</div>
          {box === "vented" && (<>
            {port.shape === "slot"
              ? <Slider label={`Slot height (${sys.slotW.toFixed(1)}″ wide)`} value={port.h || 1} min={0.5} max={3} step={0.125} unit="″" onChange={(v) => setP("h", v)} />
              : <Slider label="Port diameter" value={port.dia} min={1} max={4} step={0.25} unit="″" onChange={(v) => setP("dia", v)} />}
            <Slider label={port.shape === "slot" ? "Slot length" : "Port length (centerline)"} value={port.len} min={1} max={30} step={0.25} unit="″" onChange={(v) => setP("len", v)} />
          </>)}
          {box === "radiator" && (<>
            <SelectField label={`Passive radiator · ${prDrv.shape ? "5 × 8″ oval" : `${prDrv.size}″`}`} options={HIFI_PASSIVES_BY_SIZE} value={prDrv} onChange={(o) => setPrSel((p) => ({ ...p, id: o.id, addG: Math.min(p.addG, passiveRadiatorMassMax(o)) }))} group={(o) => (o.shape ? "Oval radiators" : `${o.size}″ radiators`)} />
            <Slider label="Added mass, each" value={pr.addG} min={0} max={passiveRadiatorMassMax(prDrv)} step={5} unit=" g" onChange={(v) => setPrSel((p) => ({ ...p, addG: v }))} />
          </>)}
          <div className="text-xs text-stone-500">{sys.gross.toFixed(1)} L gross{sys.vented ? `, ${sys.pArea.toFixed(1)} in² of ${sys.slot ? "slot" : "port"}` : sys.radiator ? `; radiators on the back tune it to ${sys.Fb.toFixed(0)} Hz, with a notch at ${sys.Fp.toFixed(0)} Hz (their own resonance)${prDrv.xmaxKind === "mechanical" ? ". Its travel limit is the mechanical one; no linear figure is published" : ""}` : ", lightly stuffed"}.</div>
        </Card>
        <Card className="mb-4">
          <Slider label="Crossover" value={xo} min={800} max={4000} step={50} unit=" Hz" onChange={setXo} extra={hLk("xo", "the crossover")} />
          <div className="flex gap-1 mb-3">{[[4, "LR24"], [8, "LR48"]].map(([v, l]) => <ToggleButton key={v} size="xs" onClick={() => setOrder(v)} on={order === v}>{l}</ToggleButton>)}</div>
          <Slider label="Baffle-step boost" value={bsc} min={0} max={6} step={0.5} unit=" dB" onChange={setBsc} />
          <Slider label="Woofer amp @ 8 Ω" value={wAmpW} min={10} max={500} step={10} unit=" W" onChange={setWAmpW} extra={hLk("wAmpW", "the woofer amp power")} />
          <Slider label="Tweeter amp @ 8 Ω" value={tAmpW} min={5} max={200} step={5} unit=" W" onChange={setTAmpW} extra={hLk("tAmpW", "the tweeter amp power")} />
        </Card>
        <Card>
          <div className="text-sm text-stone-500 mb-1">Placement</div>
          <div className="flex flex-wrap gap-1 mb-3">{Object.entries(HIFI_PLACES).map(([k, p]) => <ToggleButton key={k} onClick={() => setPlace(k)} on={place === k}>{p.name}</ToggleButton>)}</div>
          {place !== "free" && <Slider label="Distance to the wall" value={wallFt} min={0.5} max={6} step={0.25} unit=" ft" onChange={setWallFt} />}
          <Slider label="Speaker spacing" value={spacing} min={3} max={14} step={0.5} unit=" ft" onChange={setSpacing} />
          <Slider label="Toe-in" value={toe} min={0} max={35} step={1} unit="°" onChange={setToe} />
          <Slider label="Box bottom height (stand)" value={standIn} min={0} max={40} step={1} unit="″" onChange={setStandIn} />
          <Slider label="Ear height" value={earIn} min={24} max={60} step={1} unit="″" onChange={setEarIn} />
        </Card>
      </aside>
    </main>
  );
}
