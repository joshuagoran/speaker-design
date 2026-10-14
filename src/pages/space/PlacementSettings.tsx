import { useState } from "react";
import type { SpacePlacement, SpaceVenue } from "../../types";
import { Notice } from "../../components/ui/Notice";
import { Button } from "../../components/ui/Button";
import { CardFold } from "../../components/ui/CardFold";
import { NumberField } from "../../components/ui/NumberField";
import { SelectField, type SelectOption } from "../../components/ui/SelectField";
import { ToggleButton } from "../../components/ui/ToggleButton";
import { Tooltip } from "../../components/ui/Tooltip";
import { byId } from "../../lib/tables";
import { wrapYawDeg } from "../../lib/speaker/spaceLayout";
import {
  placementDomId,
  SPACE_LIFT_MAX_IN,
  SPACE_PITCH_DEG,
  SPACE_TEXT,
} from "../../constants/space";
import { formatSigned } from "../../lib/format";
import { INCHES_PER_FOOT } from "../../constants/units";
import { FIELD_ROW, shownIn } from "../speaker/speakerFields";

interface Props {
  index: number;
  placement: SpacePlacement;
  /** whether the item shows its controls, and the change when the person opens or closes it */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** each placement's name, in the space's order */
  names: readonly string[];
  /** the room, whose floor bounds its spot */
  room: Pick<SpaceVenue["room"], "widthFt" | "lengthFt">;
  onEdit: (edit: (p: SpacePlacement) => SpacePlacement) => void;
  onRemove: () => void;
  /** sets its delay and level to play with placement `to` at the listener; false when there is nothing to align to */
  onAlign: (to: number) => boolean;
}

/** A value kept between `lo` and `hi`. */
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** A value rounded to a tenth, as a field shows it. */
const tenth = (v: number) => Math.round(v * 10) / 10;

/**
 * One placement's settings: where it stands (all in feet), its aim, a flip, whether it is a mirrored pair (the box
 * stands again on the other side of the center line), and its level and delay on its feed.
 */
export function PlacementSettings({
  index,
  placement,
  open,
  onOpenChange,
  names,
  room,
  onEdit,
  onRemove,
  onAlign,
}: Props) {
  /** the last alignment found nothing to align to */
  const [alignFailed, setAlignFailed] = useState(false);
  /** the placement picked to align to, by its index; null: the first one listed */
  const [alignPick, setAlignPick] = useState<string | null>(null);
  // it aligns to any placement but its own (a mirrored pair is one placement)
  const targets: SelectOption[] = names.flatMap((name, i) =>
    i === index ? [] : [{ id: String(i), name }],
  );
  const alignTo = (alignPick !== null ? byId(targets, alignPick) : undefined) ?? targets[0];
  /** how far either side of the center line its spot may go, ft */
  const half = room.widthFt / 2;
  /** the highest height above the floor, ft */
  const heightMaxFt = SPACE_LIFT_MAX_IN / INCHES_PER_FOOT;
  // the folded row: a pair says so, then the spot of the box as set and the level
  const where = SPACE_TEXT.placementSummary(
    formatSigned(placement.x),
    placement.y.toFixed(1),
    formatSigned(placement.levelDb),
  );
  const summary = placement.mirrored ? `${SPACE_TEXT.pairSummary} · ${where}` : where;
  return (
    <CardFold
      id={placementDomId(index)}
      title={names[index] ?? ""}
      summary={summary}
      open={open}
      onOpenChange={onOpenChange}
    >
      <div className="flex justify-end mb-3">
        <Button size="xs" onClick={onRemove}>
          {SPACE_TEXT.remove}
        </Button>
      </div>
      <div className={FIELD_ROW}>
        <NumberField
          label={<Tooltip tip={SPACE_TEXT.fromCenterTip}>{SPACE_TEXT.fromCenter}</Tooltip>}
          value={shownIn(placement.x)}
          min={-half}
          max={half}
          step={0.5}
          onChange={(x) => onEdit((p) => ({ ...p, x: clamp(x, -half, half) }))}
        />
        <NumberField
          label={SPACE_TEXT.down}
          value={shownIn(placement.y)}
          min={0}
          max={room.lengthFt}
          step={0.5}
          onChange={(y) => onEdit((p) => ({ ...p, y: clamp(y, 0, room.lengthFt) }))}
        />
        <NumberField
          label={<Tooltip tip={SPACE_TEXT.heightTip}>{SPACE_TEXT.height}</Tooltip>}
          value={shownIn(placement.liftIn / INCHES_PER_FOOT)}
          min={0}
          max={heightMaxFt}
          step={0.5}
          onChange={(heightFt) =>
            onEdit((p) => ({
              ...p,
              liftIn: clamp(heightFt, 0, heightMaxFt) * INCHES_PER_FOOT,
            }))
          }
        />
      </div>
      <div className={FIELD_ROW}>
        <NumberField
          label={<Tooltip tip={SPACE_TEXT.yawTip}>{SPACE_TEXT.yaw}</Tooltip>}
          value={placement.aim.yawDeg}
          step={1}
          onChange={(yawDeg) =>
            onEdit((p) => ({ ...p, aim: { ...p.aim, yawDeg: wrapYawDeg(yawDeg) } }))
          }
        />
        <NumberField
          label={<Tooltip tip={SPACE_TEXT.pitchTip}>{SPACE_TEXT.pitch}</Tooltip>}
          value={placement.aim.pitchDeg}
          min={-SPACE_PITCH_DEG}
          max={SPACE_PITCH_DEG}
          step={1}
          onChange={(pitchDeg) => onEdit((p) => ({ ...p, aim: { ...p.aim, pitchDeg } }))}
        />
      </div>
      <div className="flex flex-wrap gap-2 mb-3">
        <ToggleButton
          on={placement.mirror}
          title={SPACE_TEXT.mirrorTip}
          onClick={() => onEdit((p) => ({ ...p, mirror: !p.mirror }))}
        >
          {SPACE_TEXT.mirror}
        </ToggleButton>
        <ToggleButton
          on={placement.mirrored}
          title={SPACE_TEXT.mirroredTip}
          onClick={() => onEdit((p) => ({ ...p, mirrored: !p.mirrored }))}
        >
          {SPACE_TEXT.mirrored}
        </ToggleButton>
      </div>
      <div className={FIELD_ROW}>
        <NumberField
          label={<Tooltip tip={SPACE_TEXT.feedTip}>{SPACE_TEXT.level}</Tooltip>}
          value={tenth(placement.levelDb)}
          step={0.5}
          onChange={(levelDb) => onEdit((p) => ({ ...p, levelDb }))}
        />
        <NumberField
          label={<Tooltip tip={SPACE_TEXT.delayTip}>{SPACE_TEXT.delay}</Tooltip>}
          value={tenth(placement.delayMs)}
          min={0}
          step={0.1}
          onChange={(delayMs) => onEdit((p) => ({ ...p, delayMs }))}
        />
      </div>
      {alignTo && (
        <div className="mb-3">
          <div className={FIELD_ROW}>
            <SelectField
              label={<Tooltip tip={SPACE_TEXT.alignToTip}>{SPACE_TEXT.alignTo}</Tooltip>}
              options={targets}
              value={alignTo}
              onChange={(o) => {
                setAlignPick(o.id);
                setAlignFailed(false);
              }}
            />
          </div>
          <Button size="xs" onClick={() => setAlignFailed(!onAlign(Number(alignTo.id)))}>
            {SPACE_TEXT.align}
          </Button>
          {alignFailed && (
            <div className="mt-2">
              <Notice>{SPACE_TEXT.alignFillNone}</Notice>
            </div>
          )}
        </div>
      )}
    </CardFold>
  );
}
