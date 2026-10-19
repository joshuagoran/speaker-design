import { useMemo } from "react";
import { Button } from "../../components/ui/Button";
import { Notice } from "../../components/ui/Notice";
import { Tooltip } from "../../components/ui/Tooltip";
import { OptimizerCurveChart } from "../../components/charts/OptimizerCurveChart";
import { StackFront } from "../../components/drawings/StackFront";
import { CardFrame } from "../../components/optimizer/CardFrame";
import { CardTile, CardTiles } from "../../components/optimizer/CardTile";
import { Delta } from "../../components/optimizer/Delta";
import { STATS } from "../../components/stats/StatLabel";
import { formatDims } from "../../lib/format";
import { stackListenHeightIn } from "../../lib/speaker/stackResponse";
import { priceText } from "../../lib/speaker/speakerTotals";
import { FREQ_AXIS_MAX_HZ, FREQ_AXIS_MIN_HZ } from "../../constants/chartScales";
import { STACK_OPTIMIZER_TEXT } from "../../constants/stackOptimizer";
import { UI_TEXT } from "../../constants/uiText";
import { driverSummary } from "../speaker/speakerText";
import type { StackOptimizerCard, StackOptimizerResult } from "../../types";

const T = STACK_OPTIMIZER_TEXT;

interface Props {
  card: StackOptimizerCard;
  /** its place among the cards, and how many there are */
  index: number;
  total: number;
  /** your stack's maximum output, drawn dashed beside the card's; null when it can't be modeled */
  current: StackOptimizerResult["current"];
  /** loads the card; null: Load is off (the cards are stale) */
  onLoad: (() => void) | null;
}

/**
 * One suggested stack: what it is, its front view, its maximum output against yours, its numbers with their change, what
 * it changes (in total and in each speaker) and Load.
 */
export function StackResultCard({ card, index, total, current, onLoad }: Props) {
  const m = card.metrics;
  const d = card.delta;
  const { stack, speakers } = card.design;
  const listenHeightIn = useMemo(() => stackListenHeightIn(stack, speakers), [stack, speakers]);
  /** each speaker that changed, by name */
  const changedSpeakers = card.speakers.flatMap(({ id, changed }) => {
    const name = speakers.find((s) => s.id === id)?.name;
    return name && changed.length ? [{ id, name, changed }] : [];
  });
  return (
    <CardFrame
      label={card.label}
      index={index}
      total={total}
      title={stack.members
        .map((member) => {
          const speaker = speakers.find((s) => s.id === member.speakerId);
          return speaker ? driverSummary(speaker.cabinet) : "—";
        })
        .join(" · ")}
    >
      <p className="text-xs text-stone-500">{card.why}</p>
      <div className="grid grid-cols-[2fr_3fr] gap-2 items-end">
        <div className="aspect-square w-full">
          <StackFront stack={stack} speakers={speakers} listenHeightIn={listenHeightIn} />
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
      <CardTiles>
        <CardTile
          label={STATS.partsPrice.label}
          value={priceText({ dollars: m.price, partial: m.pricePartial })}
          delta={<Delta v={d?.price} unit="$" lowerIsBetter />}
        />
        <CardTile
          label={T.tile.weight}
          value={`${m.lb.toFixed(0)} lb`}
          delta={<Delta v={d?.lb} unit=" lb" lowerIsBetter digits={1} />}
        />
        <CardTile
          label={STATS.stackHeight.label}
          value={`${m.heightIn.toFixed(0)} in`}
          delta={<Delta v={d?.heightIn} unit=" in" lowerIsBetter digits={1} />}
        />
        <CardTile
          label={T.tile.level}
          value={m.musicDb === null ? "—" : `${m.musicDb.toFixed(1)} dB`}
          delta={<Delta v={d?.musicDb} unit=" dB" digits={1} />}
        />
        <CardTile
          label={T.tile.f3}
          value={m.f3 === null ? "—" : `${m.f3.toFixed(0)} Hz`}
          delta={<Delta v={d?.f3} unit=" Hz" lowerIsBetter />}
        />
        <CardTile
          label={T.tile.volume}
          value={`${m.volumeL.toFixed(0)} L`}
          delta={<Delta v={d?.volumeL} unit=" L" lowerIsBetter />}
        />
      </CardTiles>
      <div className="text-xs text-stone-500">
        {T.boxes}: {m.boxes.map((b) => (b ? formatDims(b.sizeIn) : "—")).join(" · ")}
      </div>
      {card.warnings.map((w) => (
        <Notice key={w}>{w}</Notice>
      ))}
      <div className="text-xs text-stone-500">
        {T.changes}: {card.changed.length ? card.changed.join(", ") : T.changesNone}
      </div>
      {changedSpeakers.length > 0 && (
        <ul className="text-xs text-stone-500 -mt-1.5">
          {changedSpeakers.map(({ id, name, changed }) => (
            <li key={id}>
              {name}: {changed.join(", ")}
            </li>
          ))}
        </ul>
      )}
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
