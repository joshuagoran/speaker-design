import { ToggleButton } from "../../components/ui/ToggleButton.jsx";
import { Tooltip } from "../../components/ui/Tooltip.jsx";
import { Card } from "../../components/ui/Card.jsx";
import { SelectField } from "../../components/ui/SelectField.jsx";
import { Slider } from "../../components/ui/Slider.jsx";
import { ResponseChart } from "../../components/charts/ResponseChart.jsx";
import { CHIP_BACKGROUND_CLASSES } from "../../components/optimizer/OptimizerResultCard.jsx";
import { StatLabel, StatRow } from "../../components/optimizer/StatRow.jsx";
import { fillChips } from "../../lib/pa/chips.js";
import { FILL_OPTIONS } from "../../lib/data.js";
import { fillSystem, nearestPoint } from "../../lib/pa/calc.js";
const { useState } = React;

/** Fills page: choose and size the fill speakers. */
export function FillsPage() {
  const [drv, setDrv] = useState(FILL_OPTIONS.find((o) => o.id === "bc10cxn64"));
  const [boxType, setBoxType] = useState("vented");
  const [dim, setDim] = useState({ w: 11.5, h: 16, d: 11 });
  const [port, setPort] = useState({ n: 1, dia: 3, len: 4 });
  const [hp, setHp] = useState(70);          // highpass to the subs, LR24
  const [ampW, setAmpW] = useState(300);     // per box, rated into 8 Ω
  const [portMax, setPortMax] = useState(20);
  const setD = (k, v) => setDim((p) => ({ ...p, [k]: v }));
  const setP = (k, v) => setPort((p) => ({ ...p, [k]: v }));
  const ts = drv.ts;
  const { gross, pArea, net, vM, sM, max: maxC, sens, f3, pad, hfLimW, lb, portLimited } = fillSystem(drv, { boxType, dim, port, hp, ampW, portMax });
  const near = (f) => nearestPoint(maxC, f);
  const disp = ts.disp != null ? ts.disp : drv.size >= 10 ? 1.5 : 1;
  const hf = drv.hf;
  const kick = near(60).spl, mid = near(150).spl;
  const tile = (k, v, u) => (
    <div key={k} className="bg-stone-50 px-3 py-2.5">
      <div className="text-xs uppercase tracking-wider text-stone-500 font-semibold"><StatLabel k={k} /></div>
      <div className="text-xl font-medium tabular-nums mt-0.5 break-words">{v}<span className="text-xs text-stone-500 ml-0.5">{u}</span></div>
    </div>
  );
  const F = fillChips({ drv, dim, Fb: vM ? vM.Fb : null, Qtc: sM ? sM.Qtc : null, hp, portLimited, portMax, f3, hf, hfLimW, ampW, pad });
  return (
    <main className="max-w-6xl mx-auto px-4 md:px-8 pb-16 grid grid-cols-1 md:grid-cols-5 gap-8" style={{ fontFamily: "var(--font)" }}>
      <div className="min-w-0 md:col-span-3 flex flex-col gap-4">
        <p className="text-sm text-stone-500"><Tooltip tip="Passive 8–10″ coaxial fills or booth monitors, highpassed to the subs. One amp channel each (or a pair in parallel).">Passive fills</Tooltip></p>
        <div className="grid gap-px rounded-lg overflow-hidden border border-stone-300 bg-stone-300 grid-cols-2 sm:grid-cols-[repeat(auto-fit,minmax(112px,1fr))] [&>*:last-child:nth-child(odd)]:col-span-2 sm:[&>*:last-child:nth-child(odd)]:col-span-1">
          {tile("Net volume", net.toFixed(0), "L")}
          {vM ? tile("Tuning Fb", vM.Fb.toFixed(0), "Hz") : tile("Qtc", sM.Qtc.toFixed(2), "")}
          {tile("F3", f3.toFixed(0), "Hz")}
          {tile("Max @ 60 Hz", kick.toFixed(1), "dB")}
          {tile("Max @ 150 Hz", mid.toFixed(1), "dB")}
          {tile("Weight", lb.toFixed(0), "lb")}
        </div>
        <ResponseChart fmax={300} series={[{ curve: maxC, label: drv.name, stroke: PAL.cyan, tint: PAL.alpha(PAL.cyan, 0.07) }]} marks={[{ f: hp, label: "HP" }, ...(vM ? [{ f: vM.Fb, label: "Fb" }] : [])]} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-0.5 text-sm">
          {[
            ["Woofer sensitivity", `${sens.toFixed(1)} dB`, "2.83 V, half space, 1 m, modelled"],
            ["HF sensitivity", hf ? `${hf.sens} dB` : "—", hf ? `pad about ${pad.toFixed(0)} dB to match` : "not published"],
            ["HF coverage", hf && hf.cov ? `${hf.cov}° conical` : "—"],
            ["HF crossover", hf && hf.xo ? `${hf.xo} Hz or higher` : "—", "recommended minimum"],
            ["Max SPL at 100 Hz", `${near(100).spl.toFixed(1)} dB`, `sine, ${near(100).who}-limited`],
            ["Price", drv.price ? `$${drv.price}` : "—", drv.src],
          ]
.map(([k, v, note, tip]) => <StatRow key={k} k={k} v={v} note={note} tip={tip} />)}
        </div>
        <div className="flex flex-col gap-1.5">
          {F.map(([kind, head, body]) => (
            <div key={head} className={`block text-xs leading-relaxed px-3 py-2 rounded border ${CHIP_BACKGROUND_CLASSES[kind] || CHIP_BACKGROUND_CLASSES.ok}`}>
              <b className={`font-semibold mr-1.5 ${kind === "ok" ? "text-green-800" : kind === "warn" ? "text-amber-700" : "text-red-700"}`}>{head}</b>
              <span className="text-stone-500">{body}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-stone-500"><span className="font-medium text-stone-500">{drv.name}.</span> {drv.note} <Tooltip tip={`Specs from usspeaker.com, Sep 2026. Box weight assumes 1/2″ birch. Displacement ${ts.disp != null ? "as published" : `not published; ${disp} L assumed`}.`}>Spec notes</Tooltip></p>
      </div>
      <aside className="min-w-0 md:col-span-2">
        <SelectField label="Coaxial driver" options={FILL_OPTIONS} value={drv} onChange={setDrv} />
        <div className="text-sm text-stone-500 mb-1">Box</div>
        <div className="flex gap-1 mb-2">
          {[["Vented", "vented"], ["Sealed", "sealed"]].map(([l, v]) => (
            <ToggleButton key={v} onClick={() => setBoxType(v)} on={boxType === v}>{l}</ToggleButton>
          ))}
        </div>
        <Card className="mb-4">
          <Slider label="Width" value={dim.w} min={9} max={20} step={0.5} unit="″" onChange={(v) => setD("w", v)} />
          <Slider label="Height" value={dim.h} min={9} max={28} step={0.5} unit="″" onChange={(v) => setD("h", v)} />
          <Slider label="Depth" value={dim.d} min={7} max={20} step={0.5} unit="″" onChange={(v) => setD("d", v)} />
          {boxType === "vented" && (<>
            <Slider label="Ports" value={port.n} min={1} max={3} step={1} unit="" onChange={(v) => setP("n", v)} />
            <Slider label="Port diameter" value={port.dia} min={1.5} max={5} step={0.25} unit="″" onChange={(v) => setP("dia", v)} />
            <Slider label="Port length" value={port.len} min={1} max={14} step={0.25} unit="″" onChange={(v) => setP("len", v)} />
            <Slider label="Port velocity limit" value={portMax} min={12} max={30} step={0.5} unit=" m/s" onChange={setPortMax} />
          </>)}
          <div className="text-xs text-stone-500">{gross.toFixed(0)} L gross{boxType === "sealed" ? ", stuffed" : `, ${pArea.toFixed(1)} in² of port`}.</div>
        </Card>
        <Card>
          <Slider label="Highpass to the subs (LR24)" value={hp} min={50} max={160} step={5} unit=" Hz" onChange={setHp} />
          <Slider label="Amp power per box @ 8 Ω" value={ampW} min={25} max={800} step={25} unit=" W" onChange={setAmpW} />
          <div className="text-xs text-stone-500">A freed GXD4 channel with two 8 Ω fills in parallel gives about 300 W each.</div>
        </Card>
      </aside>
    </main>
  );
}
