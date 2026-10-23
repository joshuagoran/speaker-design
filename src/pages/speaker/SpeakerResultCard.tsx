import { useUnits } from "../../hooks/useUnits";
import { Button } from "../../components/ui/Button";
import { Notice } from "../../components/ui/Notice";
import { Tooltip } from "../../components/ui/Tooltip";
import { OptimizerCurveChart } from "../../components/charts/OptimizerCurveChart";
import { SpeakerFront } from "../../components/drawings/SpeakerFront";
import { CardFrame } from "../../components/optimizer/CardFrame";
import { CardTile, CardTiles } from "../../components/optimizer/CardTile";
import { Delta } from "../../components/optimizer/Delta";
import { STATS } from "../../components/stats/StatLabel";
import { formatDb } from "../../lib/format";
import { priceText } from "../../lib/speaker/speakerTotals";
import { FREQ_AXIS_MAX_HZ, FREQ_AXIS_MIN_HZ } from "../../constants/chartScales";
import { WOOFER_LIMITED_BY } from "../../constants/limits";
import { OPTIMIZER_PANEL_TEXT } from "../../constants/optimizerText";
import { SPEAKER_OPTIMIZER_TEXT } from "../../constants/speakerOptimizerText";
import { UI_TEXT } from "../../constants/uiText";
import { bandText, driverSummary } from "./speakerText";
import type { SpeakerOptimizerCard, SpeakerOptimizerResult } from "../../types";

const T = SPEAKER_OPTIMIZER_TEXT;

interface Props {
  card: SpeakerOptimizerCard;
  /** its place among the cards, and how many there are */
  index: number;
  total: number;
  /** your design's maximum output, drawn dashed beside the card's; null when it can't be modeled */
  current: SpeakerOptimizerResult["current"];
  /** loads the card; null: Load is off (the cards are stale) */
  onLoad: (() => void) | null;
}

/** One suggested design: what it is, its maximum output against yours, its numbers with their change, and Load. */
export function SpeakerResultCard({ card, index, total, current, onLoad }: Props) {
  const units = useUnits();
  const m = card.metrics;
  const d = card.delta;
  const limited = m.who && m.band ? card.spec.bands.find((b) => b.id === m.band) : null;
  return (
    <CardFrame
      label={card.label}
      index={index}
      total={total}
      title={`${driverSummary(card.spec.cabinet)} · ${units.dims(m.sizeIn)}`}
    >
      <p className="text-xs text-stone-500">{card.why}</p>
      <div className="grid grid-cols-[2fr_3fr] gap-2 items-end">
        <div className="aspect-square w-full">
          <SpeakerFront spec={card.spec} />
        </div>
        <OptimizerCurveChart
          curve={card.maxCurve}
          cur={current && current.maxCurve}
          fmin={FREQ_AXIS_MIN_HZ}
          fmax={FREQ_AXIS_MAX_HZ}
          band={null}
          label={T.curveLabel}
        />
      </div>
      <div className="text-xs text-stone-500">{card.spec.bands.map(bandText).join(" · ")}</div>
      <CardTiles>
        <CardTile
          label={STATS.partsPrice.label}
          value={priceText({ dollars: m.price, partial: m.pricePartial })}
          delta={<Delta v={d?.price} unit="$" lowerIsBetter />}
        />
        <CardTile
          label={T.tile.weight}
          value={units.format("mass", m.lb, 0)}
          delta={<Delta v={d?.lb} quantity="mass" lowerIsBetter digits={1} />}
        />
        <CardTile
          label={T.tile.level}
          value={m.musicDb === null ? "—" : `${formatDb(m.musicDb)} dB`}
          delta={<Delta v={d?.musicDb} unit=" dB" digits={1} />}
        />
        <CardTile
          label={T.tile.f3}
          value={m.f3 === null ? "—" : `${m.f3.toFixed(0)} Hz`}
          delta={<Delta v={d?.f3} unit=" Hz" lowerIsBetter />}
        />
        <CardTile
          label={T.tile.volume}
          value={units.format("volume", m.volumeL)}
          delta={<Delta v={d?.volumeL} quantity="volume" lowerIsBetter />}
        />
      </CardTiles>
      {m.who && (
        <div className="text-xs leading-snug">
          <b className="font-semibold">{OPTIMIZER_PANEL_TEXT.limitedBy}</b>{" "}
          {limited ? `${limited.name}, ` : ""}
          {WOOFER_LIMITED_BY[m.who]}
        </div>
      )}
      {card.warnings.map((w) => (
        <Notice key={w}>{w}</Notice>
      ))}
      <div className="text-xs text-stone-500">
        {T.changes}: {card.changed.length ? card.changed.join(", ") : T.changesNone}
      </div>
      {m.pricePartial && (
        <div className="text-xs text-stone-500">
          <Tooltip tip={UI_TEXT.partialPricesTip}>{UI_TEXT.partialPrices}</Tooltip>
        </div>
      )}
      <div className="flex gap-1.5 mt-auto">
        <Button
          variant="primary"
          onClick={onLoad ?? undefined}
          disabled={!onLoad}
          className="flex-1"
        >
          {T.load}
        </Button>
      </div>
    </CardFrame>
  );
}
