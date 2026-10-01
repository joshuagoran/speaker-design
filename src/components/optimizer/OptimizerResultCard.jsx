import { Button } from "../ui/Button.jsx";
import { Tooltip } from "../ui/Tooltip.jsx";
import { OptimizerCurveChart } from "../charts/OptimizerCurveChart.jsx";
import { BoxFront } from "../drawings/BoxFront.jsx";
import { formatDollars } from "../../lib/format.js";
import { Delta } from "./Delta.jsx";

/** status notes: a light tint of the status colour with a matching border */
export const CHIP_BACKGROUND_CLASSES = { ok: "bg-green-50 border-green-200 border-l-4 border-l-green-300", warn: "bg-amber-50 border-amber-200 border-l-4 border-l-amber-300", bad: "bg-red-50 border-red-200 border-l-4 border-l-red-300" };

/** One suggested design with its numbers, preview and load buttons. */
export function OptimizerResultCard({ k, i, n, cur, onPreview, onLoad, onSave, previewing, canSave }) {
  const c = k.config, m = k.metrics, d = k.delta || {};
  const tile = (label, v, delta) => (
    <div className="bg-stone-50 border border-stone-300 rounded px-2 py-1.5">
      <div className="text-xs uppercase tracking-wider text-stone-500 font-semibold">{label}</div>
      <div className="tabular-nums">{v}</div>{delta}
    </div>
  );
  const sheets = k.build.sheets.map((x) => `${x.n} sheet${x.n > 1 ? "s" : ""} ${x.t === 0.5 ? "1/2″" : x.t === 0.75 ? "3/4″" : x.t + "″"}`).join(" + ");
  return (
    <div className={`bg-white border rounded-lg p-3.5 flex flex-col gap-2.5 min-w-full md:min-w-0 snap-start ${previewing ? "border-stone-900 ring-1 ring-stone-900" : "border-stone-300"}`}>
      <div className="text-xs uppercase tracking-wider font-bold text-stone-500">{k.label} · {i + 1} of {n}</div>
      <h3 className="text-lg leading-snug" style={{ fontFamily: "var(--font)", fontWeight: 700 }}>{k.names.sub} · {c.cDim.w} × {c.cDim.h} × {c.cDim.d}″</h3>
      <div className="grid grid-cols-[2fr_3fr] gap-2 items-end">
        {k.geom && <BoxFront g={k.geom} cur={cur && cur.geom} />}
        {k.curve && <OptimizerCurveChart curve={k.curve} cur={cur && cur.curve} />}
      </div>
      <div className="text-xs text-stone-500">Mid {k.names.mid} · {k.names.cd} on {k.names.horn} · amps {c.ampW} / {c.mAmpW} / {c.hfAmpW} W</div>
      <div className="grid grid-cols-2 gap-1.5">
        {tile("Drivers", formatDollars(m.price), <Delta v={d.price} unit="$" lowerIsBetter />)}
        {tile("Heaviest", `${m.heaviest.toFixed(0)} lb`, <Delta v={d.heaviest} unit=" lb" lowerIsBetter />)}
        {tile("Output", `${m.out.toFixed(1)} dB`, <Delta v={d.out} unit=" dB" digits={1} />)}
        {tile("F3", `${m.f3.toFixed(0)} Hz`, <Delta v={d.f3} unit=" Hz" lowerIsBetter />)}
      </div>
      <div className="text-xs leading-snug"><b className="font-semibold">Limited by:</b> {k.limitedBy}</div>
      {k.warnings.filter(([h]) => !/limited$/.test(h)).map(([h, b]) => (
        <div key={h} className="text-xs border border-l-4 rounded px-2 py-1 bg-amber-50 border-amber-200 border-l-amber-300"><b className="font-semibold text-amber-700 mr-1">{h}</b>{b}</div>
      ))}
      <div className="text-xs text-stone-500">✓ Duct fits · {sheets} · Qtc {k.build.qtc.toFixed(2)}</div>
      <div className="text-xs text-stone-500">Changes: {k.changed.length ? k.changed.join(", ") : "none"}</div>
      {!k.priceKnown && <div className="text-xs text-stone-500"><Tooltip tip="Some drivers have no listed price, so the total is a lower bound.">Partial prices</Tooltip></div>}
      <div className="flex gap-1.5 mt-auto">
        <button onClick={onPreview} className="flex-1 px-3 py-2 rounded border text-sm border-stone-300 bg-stone-50 hover:border-stone-500">Preview</button>
        <Button variant="primary" onClick={onLoad} className="flex-1">Load</Button>
        <Button onClick={onSave} disabled={!canSave} title={canSave ? "" : "Sign in to save"} className="flex-1">Save</Button>
      </div>
    </div>
  );
}
