import { Button } from "../ui/Button";
import { Tooltip } from "../ui/Tooltip";
import { OptimizerCurveChart } from "../charts/OptimizerCurveChart";
import { BoxFront } from "../drawings/BoxFront";
import { formatDollars } from "../../lib/format";
import { formatThickness } from "../../lib/pa/calc";
import { Delta } from "./Delta";
import { STATS } from "./StatRow";
import { LIMIT_CHIP_IDS } from "../../constants/chipIds";
import { OPTIMIZER_PANEL_TEXT } from "../../constants/optimizerText";
import { Ellipsis } from "../ui/Ellipsis";
import { useCutlistLayout } from "../../hooks/useCutlistLayout";
import type { PaMetricsDelta, PaOptimizerCard, PaOptimizerResult } from "../../types";
import { FONT } from "../../styles/fonts";

interface Props {
  result: PaOptimizerCard;
  /** its place among the cards, and how many there are */
  index: number;
  total: number;
  /** the current design's curve and box, drawn faintly behind the card's own */
  currentDesign: PaOptimizerResult["cur"];
  onPreview: () => void;
  onLoad: () => void;
  onSave: () => void;
  previewing: boolean;
  canSave: boolean;
}

/** One suggested design with its numbers, preview and load buttons. */
export function OptimizerResultCard({
  result,
  index,
  total,
  currentDesign,
  onPreview,
  onLoad,
  onSave,
  previewing,
  canSave,
}: Props) {
  const config = result.config,
    metrics = result.metrics,
    deltas: Partial<PaMetricsDelta> = result.delta || {};
  const tile = (label: string, v: React.ReactNode, delta: React.ReactNode) => (
    <div className="bg-stone-50 border border-stone-300 rounded px-2 py-1.5">
      <div className="text-xs uppercase tracking-wider text-stone-500 font-semibold">{label}</div>
      <div className="tabular-nums">{v}</div>
      {delta}
    </div>
  );
  const { build } = result,
    { stacks } = build.cutlist;
  // the quick count shows at once, marked "~"; the worker's full search (the Cutlist tab's) replaces it
  const exact = useCutlistLayout({ parts: build.parts, settings: build.cutlist, countsOnly: true });
  const counts = exact ? exact.groups.map((g) => ({ t: g.t, n: g.sheets.length })) : build.sheets;
  const sheets = (
    <span title={exact ? undefined : "Quick estimate; exact count follows."}>
      {counts
        .map((x) => `${exact ? "" : "~"}${x.n} sheet${x.n > 1 ? "s" : ""} ${formatThickness(x.t)}`)
        .join(" + ")}
      {stacks > 1 && ` for ${stacks} stacks`}
      {!exact && <Ellipsis />}
    </span>
  );
  return (
    <div
      className={`bg-panel border rounded-lg p-3.5 flex flex-col gap-2.5 min-w-full md:min-w-0 snap-start ${previewing ? "border-stone-900 ring-1 ring-stone-900" : "border-stone-300"}`}
    >
      <div className="text-xs uppercase tracking-wider font-bold text-stone-500">
        {result.label} · {index + 1} of {total}
      </div>
      <h3 className="text-lg leading-snug" style={{ fontFamily: FONT, fontWeight: 700 }}>
        {result.names.sub} · {config.cDim.w} × {config.cDim.h} × {config.cDim.d}″
      </h3>
      <div className="grid grid-cols-[2fr_3fr] gap-2 items-end">
        {result.geom && <BoxFront g={result.geom} cur={currentDesign && currentDesign.geom} />}
        {result.curve && (
          <OptimizerCurveChart curve={result.curve} cur={currentDesign && currentDesign.curve} />
        )}
      </div>
      <div className="text-xs text-stone-500">
        Mid {result.names.mid} · {result.names.cd} on {result.names.horn} · amps {config.ampW} /{" "}
        {config.mAmpW} / {config.hfAmpW} W
      </div>
      <div className="grid grid-cols-2 gap-1.5 [&>*:last-child:nth-child(odd)]:col-span-2">
        {tile(
          "Drivers",
          formatDollars(metrics.price),
          <Delta v={deltas.price} unit="$" lowerIsBetter />,
        )}
        {tile(
          "Heaviest",
          `${metrics.heaviest.toFixed(0)} lb`,
          <Delta v={deltas.heaviest} unit=" lb" lowerIsBetter />,
        )}
        {tile(
          "Output",
          `${metrics.out.toFixed(1)} dB`,
          <Delta v={deltas.out} unit=" dB" digits={1} />,
        )}
        {tile(
          STATS.subBass.label,
          `${metrics.subBass.toFixed(1)} dB`,
          <Delta v={deltas.subBass} unit=" dB" digits={1} />,
        )}
        {tile(
          "F3",
          `${metrics.f3.toFixed(0)} Hz`,
          <Delta v={deltas.f3} unit=" Hz" lowerIsBetter />,
        )}
      </div>
      <div className="text-xs leading-snug">
        <b className="font-semibold">{OPTIMIZER_PANEL_TEXT.limitedBy}</b> {result.limitedBy}
      </div>
      {result.warnings
        .filter(([, , , id]) => !LIMIT_CHIP_IDS.has(id))
        .map(([, h, b, id]) => (
          <div
            key={id}
            className="text-xs border border-l-4 rounded px-2 py-1 bg-amber-50 border-amber-200 border-l-amber-300"
          >
            <b className="font-semibold text-amber-700 mr-1">{h}</b>
            {b}
          </div>
        ))}
      <div className="text-xs text-stone-500">
        ✓ Duct fits · {sheets} · Qtc {build.qtc.toFixed(2)}
      </div>
      <div className="text-xs text-stone-500">
        Changes: {result.changed.length ? result.changed.join(", ") : "none"}
      </div>
      {!result.priceKnown && (
        <div className="text-xs text-stone-500">
          <Tooltip tip="Some drivers have no price; the real total is higher.">
            Partial prices
          </Tooltip>
        </div>
      )}
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
        <Button
          onClick={onSave}
          disabled={!canSave}
          title={canSave ? "" : "Sign in to save"}
          className="flex-1"
        >
          Save
        </Button>
      </div>
    </div>
  );
}
