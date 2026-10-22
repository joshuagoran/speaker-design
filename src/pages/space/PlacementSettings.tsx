import { clamp } from "../../lib/clamp";
import type { SpacePlacement, SpaceVenue } from "../../types";
import { Button } from "../../components/ui/Button";
import { CardFold } from "../../components/ui/CardFold";
import { NumberField } from "../../components/ui/NumberField";
import { ToggleGroup } from "../../components/ui/ToggleGroup";
import { MarkedText } from "../../components/ui/MarkedText";
import { ToggleButton } from "../../components/ui/ToggleButton";
import { Tooltip } from "../../components/ui/Tooltip";
import { wrapYawDeg } from "../../lib/speaker/spaceLayout";
import {
  PLACEMENT_ROLES,
  placementDomId,
  SPACE_LIFT_MAX_IN,
  SPACE_PITCH_DEG,
  SPACE_TEXT,
} from "../../constants/space";
import { UI_TEXT } from "../../constants/uiText";
import { formatSigned, roundDelayMs } from "../../lib/format";
import { INCHES_PER_FOOT } from "../../constants/units";
import { shownIn } from "../speaker/speakerFields";
import { FIELD_ROW } from "../../styles/layout";
import { DELAY_STEP_MS } from "../../constants/speakerSteps";

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
  /** what its boxes stand right against, by name: the floor, the walls and the other placements */
  coupledWith: readonly string[];
  /** the stages its boxes stand on, by name; none: the floor */
  standsOn: readonly string[];
}

/** A value rounded to a tenth, as a field shows it. */
const tenth = (v: number) => Math.round(v * 10) / 10;

/**
 * One placement's settings: where it stands (all in feet), its aim, whether it is upside down, a flip, whether it is a
 * mirrored pair (the box stands again on the other side of the center line), whether it is a main or a fill, and its
 * gain and delay on its feed.
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
  coupledWith,
  standsOn,
}: Props) {
  const { delayMs, levelDb } = placement;
  /** how far either side of the center line its spot may go, ft */
  const half = room.widthFt / 2;
  /** the highest height above the floor, ft */
  const heightMaxFt = SPACE_LIFT_MAX_IN / INCHES_PER_FOOT;
  // the folded row: a pair says so, then the spot of the box as set and the gain
  const where = SPACE_TEXT.placementSummary(
    formatSigned(placement.x),
    placement.y.toFixed(1),
    formatSigned(levelDb),
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
      <div className="flex justify-end">
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
          unit="ft"
          onChange={(x) => onEdit((p) => ({ ...p, x: clamp(x, -half, half) }))}
        />
        <NumberField
          label={SPACE_TEXT.down}
          value={shownIn(placement.y)}
          min={0}
          max={room.lengthFt}
          step={0.5}
          unit="ft"
          onChange={(y) => onEdit((p) => ({ ...p, y: clamp(y, 0, room.lengthFt) }))}
        />
        <NumberField
          label={
            <Tooltip tip={SPACE_TEXT.heightTip}>
              {standsOn.length ? SPACE_TEXT.heightOnStage : SPACE_TEXT.height}
            </Tooltip>
          }
          value={shownIn(placement.liftIn / INCHES_PER_FOOT)}
          min={0}
          max={heightMaxFt}
          step={0.5}
          unit="ft"
          onChange={(heightFt) =>
            onEdit((p) => ({
              ...p,
              liftIn: clamp(heightFt, 0, heightMaxFt) * INCHES_PER_FOOT,
            }))
          }
        />
      </div>
      {standsOn.length > 0 && (
        <p className="text-sm">{SPACE_TEXT.standsOn(standsOn.join(" and "))}</p>
      )}
      <p className="text-sm">
        {coupledWith.length > 0 ? (
          <>
            <Tooltip tip={SPACE_TEXT.coupledTip}>
              <span className="rounded border-2 border-cmy-y px-1">{SPACE_TEXT.coupledWith}</span>
            </Tooltip>{" "}
            {coupledWith.join(", ")}
          </>
        ) : (
          `${SPACE_TEXT.coupledWith} ${SPACE_TEXT.coupledNothing}`
        )}
      </p>
      <div className={FIELD_ROW}>
        <NumberField
          label={<Tooltip tip={SPACE_TEXT.yawTip}>{SPACE_TEXT.yaw}</Tooltip>}
          value={placement.aim.yawDeg}
          step={1}
          unit="°"
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
          unit="°"
          onChange={(pitchDeg) => onEdit((p) => ({ ...p, aim: { ...p.aim, pitchDeg } }))}
        />
        <ToggleButton
          className="self-end"
          on={placement.upsideDown}
          onClick={() => onEdit((p) => ({ ...p, upsideDown: !p.upsideDown }))}
        >
          {SPACE_TEXT.upsideDown}
        </ToggleButton>
      </div>
      <div className="flex flex-wrap gap-2">
        <ToggleButton
          on={placement.mirrored}
          title={SPACE_TEXT.mirroredTip}
          onClick={() => onEdit((p) => ({ ...p, mirrored: !p.mirrored }))}
        >
          {SPACE_TEXT.mirrored}
        </ToggleButton>
      </div>
      <ToggleGroup
        label={<Tooltip tip={<MarkedText text={SPACE_TEXT.roleTip} />}>{SPACE_TEXT.role}</Tooltip>}
        value={placement.fill}
        onChange={(fill) => onEdit((p) => ({ ...p, fill }))}
        options={PLACEMENT_ROLES}
      />
      <div className={FIELD_ROW}>
        <NumberField
          label={<Tooltip tip={SPACE_TEXT.feedTip}>{SPACE_TEXT.gain}</Tooltip>}
          value={tenth(levelDb)}
          step={0.5}
          unit="dB"
          onChange={(db) => onEdit((p) => ({ ...p, levelDb: db }))}
        />
        <NumberField
          label={
            <Tooltip tip={<MarkedText text={SPACE_TEXT.delayTip} />}>{SPACE_TEXT.delay}</Tooltip>
          }
          value={roundDelayMs(delayMs)}
          min={0}
          step={DELAY_STEP_MS}
          unit="ms"
          onChange={(ms) => onEdit((p) => ({ ...p, delayMs: ms }))}
        />
      </div>
      <ToggleButton
        on={placement.invertPolarity}
        onClick={() => onEdit((p) => ({ ...p, invertPolarity: !p.invertPolarity }))}
      >
        {UI_TEXT.invertPolarity}
      </ToggleButton>
    </CardFold>
  );
}
