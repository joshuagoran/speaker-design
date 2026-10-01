import { passiveRadiatorOf } from "./hifiDriverLists.js";
import { Button } from "../../components/ui/Button.jsx";
import { OptimizerCurveChart } from "../../components/charts/OptimizerCurveChart.jsx";
import { HifiFront } from "../../components/drawings/HifiFront.jsx";
import { formatDollars } from "../../lib/format.js";
import { Delta } from "../../components/optimizer/Delta.jsx";
import { HIFI_TOP, HIFI_BOT } from "../../constants/chartScales.js";
import { HIFI_WOOFERS, HIFI_TWEETERS, ownGuideCfg } from "../../lib/data.js";

/** A result card, laid out like the PA optimizer's: what it is, a front view and its bass against yours, the four numbers with deltas. */
export function HifiResultCard({
  result,
  index,
  total,
  currentCurve,
  waveguide,
  previewing,
  onPreview,
  onLoad,
}) {
  const config = result.config,
    metrics = result.metrics,
    deltas = result.delta || {};
  const woofer = HIFI_WOOFERS.find((o) => o.id === result.woofer),
    tweeter = HIFI_TWEETERS.find((o) => o.id === result.tweeter);
  const tile = (label, v, delta) => (
    <div className="bg-stone-50 border border-stone-300 rounded px-2 py-1.5">
      <div className="text-xs uppercase tracking-wider text-stone-500 font-semibold">{label}</div>
      <div className="tabular-nums">{v}</div>
      {delta}
    </div>
  );
  const limitedBy =
    {
      Xmax: "cone travel",
      port: "port air speed",
      radiator: "radiator travel",
      thermal: "the woofer's power rating",
      amp: "the amp",
    }[result.whoW] || result.whoW;
  return (
    <div
      className={`bg-white border rounded-lg p-3.5 flex flex-col gap-2.5 min-w-full md:min-w-0 snap-start ${previewing ? "border-stone-900 ring-1 ring-stone-900" : "border-stone-300"}`}
    >
      <div className="text-xs uppercase tracking-wider font-bold text-stone-500">
        {result.label} · {index + 1} of {total}
      </div>
      <h3 className="text-lg leading-snug" style={{ fontFamily: "var(--font)", fontWeight: 700 }}>
        {woofer.size}″ {result.names.woofer} · {config.dim.w} × {config.dim.h} × {config.dim.d}″
      </h3>
      <div className="grid grid-cols-[2fr_3fr] gap-2 items-end">
        <HifiFront
          dim={config.dim}
          w={woofer}
          t={tweeter}
          lay={result.lay}
          vented={config.box === "vented"}
          port={config.port}
          pr={passiveRadiatorOf(config)}
          guide={result.ownGuide ? ownGuideCfg(tweeter) : result.guided ? waveguide : null}
          small
        />
        <OptimizerCurveChart
          curve={result.curve}
          cur={currentCurve}
          fmin={15}
          fmax={20000}
          band={null}
          top={HIFI_TOP}
          bot={HIFI_BOT}
        />
      </div>
      <div className="text-xs text-stone-500">
        {result.names.tweeter} · {config.box}
        {config.box === "vented" && config.port.shape === "slot"
          ? ` (${config.port.h}″ slot, ${config.port.len}″ long)`
          : config.box === "vented"
            ? ` (${config.port.n} × ${config.port.dia}″ port, ${config.port.len}″${config.port.elbows ? `, ${config.port.elbows} elbow${config.port.elbows > 1 ? "s" : ""}` : ""})`
            : config.box === "radiator" && passiveRadiatorOf(config)
              ? ` (${config.pr.n} × ${passiveRadiatorOf(config).drv.name}, +${config.pr.addG} g)`
              : ""}{" "}
        · {config.wall === 0.5 ? "1/2″" : "3/4″"} · XO {config.xo} Hz · amps {config.wAmpW} /{" "}
        {config.tAmpW} W
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {tile(
          "Drivers, pair",
          formatDollars(metrics.price),
          <Delta v={deltas.price} unit="$" lowerIsBetter />,
        )}
        {tile(
          "Weight",
          `${metrics.lb.toFixed(0)} lb`,
          <Delta v={deltas.lb} unit=" lb" lowerIsBetter digits={1} />,
        )}
        {tile(
          "At the seat",
          `${metrics.level.toFixed(1)} dB`,
          <Delta v={deltas.level} unit=" dB" digits={1} />,
        )}
        {tile(
          "F3 in room",
          `${metrics.f3.toFixed(0)} Hz`,
          <Delta v={deltas.f3} unit=" Hz" lowerIsBetter />,
        )}
      </div>
      <div className="text-xs leading-snug">
        <b className="font-semibold">Limited by:</b> {limitedBy}
      </div>
      {result.warnings
        .filter((h) => !/^Woofer limited by/.test(h))
        .map((h) => (
          <div
            key={h}
            className="text-xs border border-l-4 rounded px-2 py-1 bg-amber-50 border-amber-200 border-l-amber-300"
          >
            <b className="font-semibold text-amber-700">{h}</b>
          </div>
        ))}
      <div className="text-xs text-stone-500">
        Changes: {result.changed.length ? result.changed.join(", ") : "none"}
      </div>
      <div className="flex gap-1.5 mt-auto">
        <button
          onClick={onPreview}
          className="flex-1 px-3 py-2 rounded border text-sm border-stone-300 bg-stone-50 hover:border-stone-500"
        >
          Preview
        </button>
        <Button variant="primary" onClick={onLoad} className="flex-1">
          Load
        </Button>
      </div>
    </div>
  );
}
