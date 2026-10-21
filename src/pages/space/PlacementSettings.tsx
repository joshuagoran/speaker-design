import type { SpacePlacement, SpaceVenue } from "../../types";
import { Notice } from "../../components/ui/Notice";
import { Button } from "../../components/ui/Button";
import { CardFold } from "../../components/ui/CardFold";
import { NumberField } from "../../components/ui/NumberField";
import { AutoNumberField } from "../../components/ui/AutoNumberField";
import { ToggleButton } from "../../components/ui/ToggleButton";
import { Tooltip } from "../../components/ui/Tooltip";
import { wrapYawDeg } from "../../lib/speaker/spaceLayout";
import { delayDistanceIn } from "../../lib/speaker/spaceAlignment";
import type { SolvedFeed } from "../../lib/speaker/solveFeeds";
import { AUTO_DELAY, AUTO_LEVEL } from "../../constants/speakerSpec";
import {
  DELAY_NOTE,
  placementDomId,
  SPACE_LIFT_MAX_IN,
  SPACE_PITCH_DEG,
  SPACE_TEXT,
} from "../../constants/space";
import { UI_TEXT } from "../../constants/uiText";
import { formatSigned } from "../../lib/format";
import { INCHES_PER_FOOT } from "../../constants/units";
import { shownIn } from "../speaker/speakerFields";
import { FIELD_ROW } from "../../styles/layout";

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
  /** its delay and level as the space's solver sets them; undefined until the model holds it */
  solved: SolvedFeed | undefined;
  /** whether the space's Auto delay and level are on; off, it has a plain level and delay, and no fill */
  autoDelayLevel: SpaceVenue["autoDelayLevel"];
  /** what its boxes stand right against, by name: the floor, the walls and the other placements */
  coupledWith: readonly string[];
}

/** A value kept between `lo` and `hi`. */
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** A value rounded to a tenth, as a field shows it. */
const tenth = (v: number) => Math.round(v * 10) / 10;

/**
 * One placement's settings: where it stands (all in feet), its aim, whether it is upside down, a flip, whether it is a
 * mirrored pair (the box stands again on the other side of the center line), whether it is a fill, and its level and
 * delay on its feed (Auto or typed; a main's level is always typed). With Auto delay and level off, a plain level and
 * delay and no fill.
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
  solved,
  autoDelayLevel,
  coupledWith,
}: Props) {
  /** the delay and level it plays with, solved or typed */
  const delayMs = solved?.delayMs ?? (placement.delayMs === AUTO_DELAY ? 0 : placement.delayMs);
  const levelDb = solved?.levelDb ?? (placement.levelDb === AUTO_LEVEL ? 0 : placement.levelDb);
  /** how far either side of the center line its spot may go, ft */
  const half = room.widthFt / 2;
  /** the highest height above the floor, ft */
  const heightMaxFt = SPACE_LIFT_MAX_IN / INCHES_PER_FOOT;
  // the folded row: a pair says so, then the spot of the box as set and the level
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
        {autoDelayLevel && (
          <ToggleButton
            on={placement.fill}
            title={SPACE_TEXT.fillTip}
            onClick={() =>
              // a new fill's level starts at Auto; a main keeps the level it plays at, typed
              onEdit((p) => ({
                ...p,
                fill: !p.fill,
                levelDb: p.fill ? tenth(levelDb) : AUTO_LEVEL,
              }))
            }
          >
            {SPACE_TEXT.fill}
          </ToggleButton>
        )}
      </div>
      {!autoDelayLevel ? (
        <div className={FIELD_ROW}>
          <NumberField
            label={<Tooltip tip={SPACE_TEXT.plainFeedTip}>{SPACE_TEXT.level}</Tooltip>}
            value={tenth(levelDb)}
            step={0.5}
            onChange={(db) => onEdit((p) => ({ ...p, levelDb: db }))}
          />
          <NumberField
            label={SPACE_TEXT.delay}
            value={tenth(delayMs)}
            min={0}
            step={0.1}
            onChange={(ms) => onEdit((p) => ({ ...p, delayMs: ms }))}
          />
        </div>
      ) : placement.fill ? (
        <AutoNumberField
          label={<Tooltip tip={SPACE_TEXT.fillLevelTip}>{SPACE_TEXT.level}</Tooltip>}
          auto={placement.levelDb === AUTO_LEVEL}
          autoText={SPACE_TEXT.levelAuto(formatSigned(levelDb))}
          value={tenth(levelDb)}
          fieldLabel={SPACE_TEXT.level}
          step={0.5}
          // a typed level starts from the one Auto set
          onAuto={(auto) => onEdit((p) => ({ ...p, levelDb: auto ? AUTO_LEVEL : tenth(levelDb) }))}
          onChange={(db) => onEdit((p) => ({ ...p, levelDb: db }))}
        />
      ) : (
        <div className={FIELD_ROW}>
          <NumberField
            label={<Tooltip tip={SPACE_TEXT.feedTip}>{SPACE_TEXT.level}</Tooltip>}
            value={tenth(levelDb)}
            step={0.5}
            onChange={(db) => onEdit((p) => ({ ...p, levelDb: db }))}
          />
        </div>
      )}
      {autoDelayLevel && (
        <AutoNumberField
          label={<Tooltip tip={SPACE_TEXT.delayTip}>{SPACE_TEXT.delay}</Tooltip>}
          auto={placement.delayMs === AUTO_DELAY}
          autoText={SPACE_TEXT.delayAuto(
            delayMs.toFixed(1),
            (delayDistanceIn(delayMs) / INCHES_PER_FOOT).toFixed(1),
          )}
          value={tenth(delayMs)}
          fieldLabel={SPACE_TEXT.delay}
          min={0}
          step={0.1}
          // a typed delay starts from the one Auto set
          onAuto={(auto) => onEdit((p) => ({ ...p, delayMs: auto ? AUTO_DELAY : tenth(delayMs) }))}
          onChange={(ms) => onEdit((p) => ({ ...p, delayMs: ms }))}
        />
      )}
      {solved?.delayNote === DELAY_NOTE.clamped && <Notice>{SPACE_TEXT.delayClamped}</Notice>}
      {solved?.delayNote === DELAY_NOTE.noMain && <Notice>{SPACE_TEXT.delayNoMain}</Notice>}
      <ToggleButton
        on={placement.invertPolarity}
        onClick={() => onEdit((p) => ({ ...p, invertPolarity: !p.invertPolarity }))}
      >
        {UI_TEXT.invertPolarity}
      </ToggleButton>
    </CardFold>
  );
}
