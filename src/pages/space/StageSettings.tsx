import { useUnits } from "../../hooks/useUnits";
import { useState } from "react";
import type { SpaceStage, SpaceVenue, StageShape } from "../../types";
import { Button } from "../../components/ui/Button";
import { CardFold } from "../../components/ui/CardFold";
import { IconButton, TrashIcon } from "../../components/ui/IconButton";
import { NumberField } from "../../components/ui/NumberField";
import { SelectField } from "../../components/ui/SelectField";
import { ToggleGroup, type ToggleOption } from "../../components/ui/ToggleGroup";
import { Tooltip } from "../../components/ui/Tooltip";
import { byId } from "../../lib/tables";
import { listedStages, stageById, stagesOn } from "../../lib/speaker/spaceStages";
import { stageBox } from "./stageEdits";
import type { SpacePlanner } from "./useSpace";
import { shownIn } from "../speaker/speakerFields";
import { FIELD_ROW } from "../../styles/layout";
import {
  SPACE_TEXT,
  STAGE_HEIGHT_FT,
  STAGE_MIN_SIDE_FT,
  STAGE_ON_FLOOR,
  STAGE_SHAPE,
  stageDomId,
} from "../../constants/space";

interface Props {
  stages: readonly SpaceStage[];
  /** each stage's name, by id */
  names: ReadonlyMap<SpaceStage["id"], string>;
  /** the room, whose floor bounds a stage's place and size */
  room: Pick<SpaceVenue["room"], "widthFt" | "lengthFt">;
  /** the stages whose items show their controls, and the change when the person opens or closes one */
  open: readonly SpaceStage["id"][];
  onOpenChange: (id: SpaceStage["id"], open: boolean) => void;
  actions: SpacePlanner["stages"];
  /** a stage was added: its id */
  onAdded: (id: SpaceStage["id"]) => void;
}

/** The Shape choices. */
const SHAPES: readonly ToggleOption<StageShape>[] = [
  [STAGE_SHAPE.rectangle, SPACE_TEXT.rectangle],
  [STAGE_SHAPE.polygon, SPACE_TEXT.polygon],
];

/** A length as a summary shows it, ft: at most two decimals. */

/**
 * The Stages section: the choice of a new stage on the floor or a riser on a floor stage and its Add button, then each
 * stage's item (each floor stage, then its risers): its shape, place, size, and height.
 */
export function StageSettings({
  stages,
  names,
  room,
  open,
  onOpenChange,
  actions,
  onAdded,
}: Props) {
  const choices = [
    { id: STAGE_ON_FLOOR, name: SPACE_TEXT.stageOnFloor },
    ...stagesOn(stages, null).map((s) => ({
      id: s.id,
      name: SPACE_TEXT.riserOn(names.get(s.id) ?? ""),
    })),
  ];
  const [pickId, setPickId] = useState<string>(STAGE_ON_FLOOR);
  const pick = byId(choices, pickId) ?? choices[0];
  const half = room.widthFt / 2;
  const units = useUnits();
  return (
    <>
      <SelectField
        label={SPACE_TEXT.addStage}
        options={choices}
        value={pick}
        onChange={(o) => setPickId(o.id)}
      />
      <Button
        variant="primary"
        onClick={() => {
          onAdded(actions.add(pick.id === STAGE_ON_FLOOR ? null : pick.id));
        }}
      >
        {SPACE_TEXT.addStage}
      </Button>
      {listedStages(stages).map((stage) => {
        const name = names.get(stage.id) ?? "";
        const box = stageBox(stage);
        const host = stageById(stages, stage.on);
        const where = host
          ? SPACE_TEXT.stageOn(names.get(host.id) ?? "")
          : SPACE_TEXT.stageFromFront(units.format("roomLength", box.y));
        return (
          <CardFold
            key={stage.id}
            id={stageDomId(stage.id)}
            title={name}
            summary={SPACE_TEXT.stageSummary(
              units.format("roomLength", box.w),
              units.format("roomLength", box.d),
              units.format("roomLength", stage.heightFt),
              where,
            )}
            open={open.includes(stage.id)}
            onOpenChange={(o) => onOpenChange(stage.id, o)}
            actions={
              <IconButton
                size="sm"
                danger
                label={SPACE_TEXT.removeStage(name)}
                onClick={() => actions.remove(stage.id)}
              >
                <TrashIcon />
              </IconButton>
            }
          >
            <ToggleGroup
              label={SPACE_TEXT.shape}
              value={stage.shape}
              onChange={(shape) => actions.setShape(stage.id, shape)}
              options={SHAPES}
            />
            <div className={FIELD_ROW}>
              <NumberField
                label={
                  <Tooltip tip={SPACE_TEXT.stageFromCenterTip}>{SPACE_TEXT.fromCenter}</Tooltip>
                }
                value={shownIn(box.x)}
                min={-half}
                max={half}
                step={0.5}
                quantity="roomLength"
                unit={units.unit("roomLength")}
                onChange={(x) => actions.setBox(stage.id, { x })}
              />
              <NumberField
                label={<Tooltip tip={SPACE_TEXT.stageFromFrontTip}>{SPACE_TEXT.down}</Tooltip>}
                value={shownIn(box.y)}
                min={0}
                max={room.lengthFt}
                step={0.5}
                quantity="roomLength"
                unit={units.unit("roomLength")}
                onChange={(y) => actions.setBox(stage.id, { y })}
              />
            </div>
            <div className={FIELD_ROW}>
              <NumberField
                label={SPACE_TEXT.width}
                value={shownIn(box.w)}
                min={STAGE_MIN_SIDE_FT}
                max={room.widthFt}
                step={0.5}
                quantity="roomLength"
                unit={units.unit("roomLength")}
                onChange={(w) => actions.setBox(stage.id, { w })}
              />
              <NumberField
                label={SPACE_TEXT.depth}
                value={shownIn(box.d)}
                min={STAGE_MIN_SIDE_FT}
                max={room.lengthFt}
                step={0.5}
                quantity="roomLength"
                unit={units.unit("roomLength")}
                onChange={(d) => actions.setBox(stage.id, { d })}
              />
              <NumberField
                label={<Tooltip tip={SPACE_TEXT.stageHeightTip}>{SPACE_TEXT.stageHeight}</Tooltip>}
                value={shownIn(stage.heightFt)}
                min={STAGE_HEIGHT_FT[0]}
                max={STAGE_HEIGHT_FT[1]}
                step={0.5}
                quantity="roomLength"
                unit={units.unit("roomLength")}
                onChange={(h) => actions.setHeight(stage.id, h)}
              />
            </div>
          </CardFold>
        );
      })}
    </>
  );
}
