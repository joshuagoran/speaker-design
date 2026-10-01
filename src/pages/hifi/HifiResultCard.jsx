import { passiveRadiatorOf } from "./hifiDriverLists.js";
import { Button } from "../../components/ui/Button.jsx";
import { OptimizerCurveChart } from "../../components/charts/OptimizerCurveChart.jsx";
import { HifiFront } from "../../components/drawings/HifiFront.jsx";
import { formatDollars } from "../../lib/format.js";
import { Delta } from "../../components/optimizer/Delta.jsx";
import { HIFI_TOP, HIFI_BOT } from "../../constants/chartScales.js";
import { HIFI_WOOFERS, HIFI_TWEETERS } from "../../lib/data.js";

/** A result card, laid out like the PA optimizer's: what it is, a front view and its bass against yours, the four numbers with deltas. */
export function HifiResultCard({ k, i, n, curCurve, guide, previewing, onPreview, onLoad }) {
  const c = k.config, m = k.metrics, d = k.delta || {};
  const cw = HIFI_WOOFERS.find((o) => o.id === k.woofer), ct = HIFI_TWEETERS.find((o) => o.id === k.tweeter);
  const tile = (label, v, delta) => (
    <div className="bg-stone-50 border border-stone-300 rounded px-2 py-1.5">
      <div className="text-xs uppercase tracking-wider text-stone-500 font-semibold">{label}</div>
      <div className="tabular-nums">{v}</div>{delta}
    </div>
  );
  const who = { Xmax: "cone travel", port: "port air speed", radiator: "radiator travel", thermal: "the woofer's power rating", amp: "the amp" }[k.whoW] || k.whoW;
  return (
    <div className={`bg-white border rounded-lg p-3.5 flex flex-col gap-2.5 min-w-full md:min-w-0 snap-start ${previewing ? "border-stone-900 ring-1 ring-stone-900" : "border-stone-300"}`}>
      <div className="text-xs uppercase tracking-wider font-bold text-stone-500">{k.label} · {i + 1} of {n}</div>
      <h3 className="text-lg leading-snug" style={{ fontFamily: "var(--font)", fontWeight: 700 }}>{cw.size}″ {k.names.woofer} · {c.dim.w} × {c.dim.h} × {c.dim.d}″</h3>
      <div className="grid grid-cols-[2fr_3fr] gap-2 items-end">
        <HifiFront dim={c.dim} w={cw} t={ct} lay={k.lay} vented={c.box === "vented"} port={c.port} pr={passiveRadiatorOf(c)} guide={k.guided ? guide : null} small />
        <OptimizerCurveChart curve={k.curve} cur={curCurve} fmin={15} fmax={20000} band={null} top={HIFI_TOP} bot={HIFI_BOT} />
      </div>
      <div className="text-xs text-stone-500">{k.names.tweeter} · {c.box}{c.box === "vented" && c.port.shape === "slot" ? ` (${c.port.h}″ slot, ${c.port.len}″ long)` : c.box === "vented" ? ` (${c.port.n} × ${c.port.dia}″ port, ${c.port.len}″${c.port.elbows ? `, ${c.port.elbows} elbow${c.port.elbows > 1 ? "s" : ""}` : ""})` : c.box === "radiator" && passiveRadiatorOf(c) ? ` (${c.pr.n} × ${passiveRadiatorOf(c).drv.name}, +${c.pr.addG} g)` : ""} · {c.wall === 0.5 ? "1/2″" : "3/4″"} · XO {c.xo} Hz · amps {c.wAmpW} / {c.tAmpW} W</div>
      <div className="grid grid-cols-2 gap-1.5">
        {tile("Drivers, pair", formatDollars(m.price), <Delta v={d.price} unit="$" lowerIsBetter />)}
        {tile("Weight", `${m.lb.toFixed(0)} lb`, <Delta v={d.lb} unit=" lb" lowerIsBetter digits={1} />)}
        {tile("At the seat", `${m.level.toFixed(1)} dB`, <Delta v={d.level} unit=" dB" digits={1} />)}
        {tile("F3 in room", `${m.f3.toFixed(0)} Hz`, <Delta v={d.f3} unit=" Hz" lowerIsBetter />)}
      </div>
      <div className="text-xs leading-snug"><b className="font-semibold">Limited by:</b> {who}</div>
      {k.warnings.filter((h) => !/^Woofer limited by/.test(h)).map((h) => <div key={h} className="text-xs border border-l-4 rounded px-2 py-1 bg-amber-50 border-amber-200 border-l-amber-300"><b className="font-semibold text-amber-700">{h}</b></div>)}
      <div className="text-xs text-stone-500">Changes: {k.changed.length ? k.changed.join(", ") : "none"}</div>
      <div className="flex gap-1.5 mt-auto">
        <button onClick={onPreview} className="flex-1 px-3 py-2 rounded border text-sm border-stone-300 bg-stone-50 hover:border-stone-500">Preview</button>
        <Button variant="primary" onClick={onLoad} className="flex-1">Load</Button>
      </div>
    </div>
  );
}
