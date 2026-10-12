import type { SpacePlacement, SpaceVenue } from "../../types";
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
}

/** The picker's id for a placement on its own (a placement's index for one it follows). */
const ALONE_ID = "alone";

/** A value kept between `lo` and `hi`. */
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** A value rounded to a tenth, as a field shows it. */
const tenth = (v: number) => Math.round(v * 10) / 10;

/**
 * One placement's settings: whom it mirrors, where it stands, its lift and aim, a mirror image, and the front end's
 * level and delay on its feed. A placement that follows another shows only its own feed.
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
}: Props) {
  const alone: SelectOption = { id: ALONE_ID, name: SPACE_TEXT.followsNone };
  // it can follow an earlier placement only
  const leads = [alone, ...names.slice(0, index).map((name, i) => ({ id: String(i), name }))];
  const follows = placement.follows !== null;
  /** how far either side of the center line its spot may go, ft */
  const half = room.widthFt / 2;
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
              label={<Tooltip tip={SPACE_TEXT.acrossTip}>{SPACE_TEXT.across}</Tooltip>}
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
              label={<Tooltip tip={SPACE_TEXT.liftTip}>{SPACE_TEXT.lift}</Tooltip>}
              value={shownIn(placement.liftIn)}
              min={0}
              max={SPACE_LIFT_MAX_IN}
              step={1}
              onChange={(liftIn) => onEdit((p) => ({ ...p, liftIn }))}
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
              onClick={() => onEdit((p) => ({ ...p, mirror: !p.mirror }))}
            >
              {SPACE_TEXT.mirror}
            </ToggleButton>
            <Button onClick={onMirrorPair}>{SPACE_TEXT.addPair}</Button>
          </div>
        </>
      )}
      <div className={FIELD_ROW}>
        <NumberField
          label={<Tooltip tip={SPACE_TEXT.feedTip}>{SPACE_TEXT.level}</Tooltip>}
          value={tenth(placement.levelDb)}
          step={0.5}
          onChange={(levelDb) => onEdit((p) => ({ ...p, levelDb }))}
        />
        <NumberField
          label={SPACE_TEXT.delay}
          value={tenth(placement.delayMs)}
          min={0}
          step={0.1}
          onChange={(delayMs) => onEdit((p) => ({ ...p, delayMs }))}
        />
      </div>
    </Card>
  );
}
