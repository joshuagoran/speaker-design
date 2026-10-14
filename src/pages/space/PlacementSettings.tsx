import { useState } from "react";
import type { SpacePlacement, SpaceVenue } from "../../types";
import { Notice } from "../../components/ui/Notice";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { NumberField } from "../../components/ui/NumberField";
import { SelectField, type SelectOption } from "../../components/ui/SelectField";
import { ToggleButton } from "../../components/ui/ToggleButton";
import { Tooltip } from "../../components/ui/Tooltip";
import { byId } from "../../lib/tables";
import {
  SPACE_LIFT_MAX_IN,
  SPACE_PITCH_DEG,
  SPACE_TEXT,
  SPACE_YAW_DEG,
} from "../../constants/space";
import { INCHES_PER_FOOT } from "../../constants/units";
import { FIELD_ROW, shownIn } from "../speaker/speakerFields";

interface Props {
  index: number;
  placement: SpacePlacement;
  /** each placement's name, in the space's order */
  names: readonly string[];
  /** the room, whose floor bounds its spot */
  room: Pick<SpaceVenue["room"], "widthFt" | "lengthFt">;
  onEdit: (edit: (p: SpacePlacement) => SpacePlacement) => void;
  /** sets the placement it follows (an index), or none */
  onFollows: (follows: SpacePlacement["follows"]) => void;
  onRemove: () => void;
  onMirrorPair: () => void;
  /** the space's placement groups (one on its own, or a mirror pair), by their leads (lib/speaker/fillAlign) */
  groups: readonly (readonly number[])[];
  /** sets its delay and level to play with placement `to` and its copy at the listener; false when there is nothing to align to */
  onAlign: (to: number) => boolean;
}

/** The picker's id for a placement on its own (a placement's index for one it follows). */
const ALONE_ID = "alone";

/** A value kept between `lo` and `hi`. */
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** A value rounded to a tenth, as a field shows it. */
const tenth = (v: number) => Math.round(v * 10) / 10;

/**
 * One placement's settings: whom it mirrors, where it stands (all in feet), its aim, a flip, and its level and delay on
 * its feed. A placement that follows another shows none of them: it takes its lead's, mirrored.
 */
export function PlacementSettings({
  index,
  placement,
  names,
  room,
  onEdit,
  onFollows,
  onRemove,
  onMirrorPair,
  groups,
  onAlign,
}: Props) {
  /** the last alignment found nothing to align to */
  const [alignFailed, setAlignFailed] = useState(false);
  /** the group picked to align to, by its lead's index; null: the first one listed */
  const [alignPick, setAlignPick] = useState<string | null>(null);
  // it aligns to any group but its own: each listed by its lead, named by its placements
  const targets: SelectOption[] = groups
    .filter((g) => !g.includes(index))
    .map((g) => ({ id: String(g[0]), name: SPACE_TEXT.pairName(g.map((i) => names[i] ?? "")) }));
  const alignTo = (alignPick !== null ? byId(targets, alignPick) : undefined) ?? targets[0];
  const alone: SelectOption = { id: ALONE_ID, name: SPACE_TEXT.followsNone };
  // it can follow an earlier placement only
  const leads = [alone, ...names.slice(0, index).map((name, i) => ({ id: String(i), name }))];
  const follows = placement.follows !== null;
  /** how far either side of the center line its spot may go, ft */
  const half = room.widthFt / 2;
  /** the highest height above the floor, ft */
  const heightMaxFt = SPACE_LIFT_MAX_IN / INCHES_PER_FOOT;
  return (
    <Card className="mb-3">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h4 className="font-semibold min-w-0 truncate">{names[index]}</h4>
        <Button size="xs" onClick={onRemove}>
          {SPACE_TEXT.remove}
        </Button>
      </div>
      {index > 0 && (
        <SelectField
          label={<Tooltip tip={SPACE_TEXT.followsTip}>{SPACE_TEXT.follows}</Tooltip>}
          options={leads}
          value={placement.follows === null ? alone : byId(leads, String(placement.follows))}
          onChange={(o) => onFollows(o.id === ALONE_ID ? null : Number(o.id))}
        />
      )}
      {!follows && (
        <>
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
              min={-SPACE_YAW_DEG}
              max={SPACE_YAW_DEG}
              step={1}
              onChange={(yawDeg) => onEdit((p) => ({ ...p, aim: { ...p.aim, yawDeg } }))}
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
            <Button title={SPACE_TEXT.addPairTip} onClick={onMirrorPair}>
              {SPACE_TEXT.addPair}
            </Button>
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
        </>
      )}
    </Card>
  );
}
