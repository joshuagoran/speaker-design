import { passiveRadiatorOf } from "./hifiDriverLists";
import { Button } from "../../components/ui/Button";
import { OptimizerCurveChart } from "../../components/charts/OptimizerCurveChart";
import { HifiFront } from "../../components/drawings/HifiFront";
import { formatDollars } from "../../lib/format";
import { Delta } from "../../components/optimizer/Delta";
import { HIFI_TOP, HIFI_BOT } from "../../constants/chartScales";
import { LIMIT_CHIP_IDS } from "../../constants/chipIds";
import { WOOFER_LIMITED_BY } from "../../constants/limits";
import { OPTIMIZER_PANEL_TEXT } from "../../constants/optimizerText";
import { STATS } from "../../components/optimizer/StatRow";
import {
  HIFI_WOOFERS,
  HIFI_TWEETERS,
  HIFI_COAX_WOOFERS,
  HIFI_COAX_TWEETERS,
  ownGuideCfg,
} from "../../lib/data";
import { byId, byIdOrThrow } from "../../lib/tables";
import { formatThickness } from "../../lib/panel";
import type { Dims2, HifiMetricsDelta, HifiOptimizerCard, HifiOptimizerResult } from "../../types";
import { FONT } from "../../styles/fonts";
import { CATALOG_TABLE_NAMES } from "../../constants/catalogTables";

interface Props {
  result: HifiOptimizerCard;
  index: number;
  total: number;
  /** your design's curve, drawn dashed beside the card's */
  currentCurve: HifiOptimizerResult["curCurve"];
  /** the waveguide the page has picked, for a card whose tweeter sits on it */
  waveguide: Dims2 | null;
  /** the page passes `designPreview && designPreview.card === result`, so `null` when nothing is previewed */
  previewing: boolean | null;
  onPreview: () => void;
  onLoad: () => void;
}

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
}: Props) {
  const config = result.config,
    metrics = result.metrics,
    deltas: Partial<HifiMetricsDelta> = result.delta || {};
  // a card's driver ids come from these same lists (the optimizer searches them), or the coaxials' for a coaxial design
  const woofer =
      byId(HIFI_WOOFERS, result.woofer) ??
      byIdOrThrow(HIFI_COAX_WOOFERS, result.woofer, CATALOG_TABLE_NAMES.hifiWoofers),
    tweeter =
      byId(HIFI_TWEETERS, result.tweeter) ??
      byIdOrThrow(HIFI_COAX_TWEETERS, result.tweeter, CATALOG_TABLE_NAMES.hifiTweeters);
  const radiator = passiveRadiatorOf(config); // null unless the box is a radiator box with its radiator
  const tile = (label: string, v: string, delta: React.ReactNode) => (
    <div className="bg-stone-50 border border-stone-300 rounded px-2 py-1.5">
      <div className="text-xs uppercase tracking-wider text-stone-500 font-semibold">{label}</div>
      <div className="tabular-nums">{v}</div>
      {delta}
    </div>
  );
  const limitedBy = WOOFER_LIMITED_BY[result.whoW];
  return (
    <div
      className={`bg-panel border rounded-lg p-3.5 flex flex-col gap-2.5 min-w-full md:min-w-0 snap-start ${previewing ? "border-stone-900 ring-1 ring-stone-900" : "border-stone-300"}`}
    >
      <div className="text-xs uppercase tracking-wider font-bold text-stone-500">
        {result.label} · {index + 1} of {total}
      </div>
      <h3 className="text-lg leading-snug" style={{ fontFamily: FONT, fontWeight: 700 }}>
        {woofer.size}″ {result.names.woofer} · {config.dim.w} × {config.dim.h} × {config.dim.d}″
      </h3>
      <div className="grid grid-cols-[2fr_3fr] gap-2 items-end">
        <HifiFront
          dim={config.dim}
          wall={config.wall}
          w={woofer}
          t={tweeter}
          lay={result.lay}
          vented={config.box === "vented"}
          port={config.port}
          pr={radiator}
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
            : radiator
              ? ` (${radiator.n} × ${radiator.drv.name}, +${radiator.addG} g)`
              : ""}{" "}
        · {formatThickness(config.wall)} · XO {config.xo} Hz · amps {config.wAmpW} / {config.tAmpW}{" "}
        W
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
          STATS.f3InRoom.label,
          `${metrics.f3.toFixed(0)} Hz`,
          <Delta v={deltas.f3} unit=" Hz" lowerIsBetter />,
        )}
      </div>
      <div className="text-xs leading-snug">
        <b className="font-semibold">{OPTIMIZER_PANEL_TEXT.limitedBy}</b> {limitedBy}
      </div>
      {result.warnings
        .filter(([, , , id]) => !LIMIT_CHIP_IDS.has(id))
        .map(([, h, , id]) => (
          <div
            key={id}
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
