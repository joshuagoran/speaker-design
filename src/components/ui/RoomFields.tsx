import { useUnits } from "../../hooks/useUnits";
import { ToggleGroup } from "./ToggleGroup";
import { NumberField } from "./NumberField";
import { SelectField } from "./SelectField";
import { Tooltip } from "./Tooltip";
import { ROOM_MATERIAL_OPTIONS } from "../../lib/acoustics/roomAcoustics";
import { UI_TEXT } from "../../constants/uiText";
import { FIELD_ROW } from "../../styles/layout";
import type { CoverageRoom, FloorCrowd, RoomMaterial, RoomSurface } from "../../types";

/** Room size limits, ft. */
export const ROOM_WIDTH_FT: [number, number] = [6, 100];
export const ROOM_LENGTH_FT: [number, number] = [6, 100];
export const ROOM_CEILING_FT: [number, number] = [6, 40];

/** A surface whose material is set, and the name its field shows. */
export type SurfaceName = readonly [RoomSurface, string];

/** Each surface whose material is set, and the name its field shows by default. */
const SURFACES: readonly SurfaceName[] = [
  ["front", "Behind the stacks"],
  ["back", "Far end"],
  ["left", "Left side"],
  ["right", "Right side"],
  ["ceiling", "Ceiling"],
];

/** The changes a room's fields make. */
export interface RoomActions {
  setRoomSize: (size: Pick<CoverageRoom, "widthFt" | "lengthFt">) => void;
  setMaterial: (surface: RoomSurface, material: RoomMaterial) => void;
  setCeilingFt: (ft: number) => void;
  setCrowd: (crowd: FloorCrowd) => void;
  setOutdoors: (outdoors: boolean) => void;
}

interface Props {
  room: CoverageRoom;
  actions: RoomActions;
  /** the surfaces' field names, when a page names them its own way (default: SURFACES) */
  surfaces?: readonly SurfaceName[];
  /** a tooltip on a surface's field name */
  surfaceTips?: Partial<Record<RoomSurface, string>>;
}

/** A coverage room's settings: indoors or out, its size, each surface's material, and the dance floor. */
export function RoomFields({ room, actions, surfaces = SURFACES, surfaceTips = {} }: Props) {
  const units = useUnits();
  return (
    <>
      <ToggleGroup
        label="Room"
        value={room.outdoors}
        onChange={actions.setOutdoors}
        options={
          [
            [false, "Indoors"],
            [true, UI_TEXT.outdoors],
          ] as const
        }
        wrap={false}
      />
      <div className={FIELD_ROW}>
        <NumberField
          label={room.outdoors ? "Area width" : UI_TEXT.roomWidth}
          value={room.widthFt}
          min={ROOM_WIDTH_FT[0]}
          max={ROOM_WIDTH_FT[1]}
          step={1}
          quantity="roomLength"
          unit={units.unit("roomLength")}
          onChange={(widthFt) => actions.setRoomSize({ widthFt, lengthFt: room.lengthFt })}
        />
        <NumberField
          label={room.outdoors ? "Area length" : "Length"}
          value={room.lengthFt}
          min={ROOM_LENGTH_FT[0]}
          max={ROOM_LENGTH_FT[1]}
          step={1}
          quantity="roomLength"
          unit={units.unit("roomLength")}
          onChange={(lengthFt) => actions.setRoomSize({ widthFt: room.widthFt, lengthFt })}
        />
      </div>
      {!room.outdoors && (
        <>
          <NumberField
            label="Ceiling height"
            value={room.ceilingFt}
            min={ROOM_CEILING_FT[0]}
            max={ROOM_CEILING_FT[1]}
            step={1}
            quantity="roomLength"
            unit={units.unit("roomLength")}
            onChange={actions.setCeilingFt}
          />
          <div className="grid grid-cols-2 gap-3">
            {surfaces.map(([surface, name]) => (
              <SelectField
                key={surface}
                label={
                  surfaceTips[surface] ? <Tooltip tip={surfaceTips[surface]}>{name}</Tooltip> : name
                }
                options={ROOM_MATERIAL_OPTIONS}
                value={ROOM_MATERIAL_OPTIONS.find((o) => o.id === room.materials[surface])}
                onChange={(o) => actions.setMaterial(surface, o.id)}
              />
            ))}
          </div>
        </>
      )}
      <ToggleGroup
        label="Dance floor"
        value={room.crowd}
        onChange={actions.setCrowd}
        options={
          [
            ["empty", "Empty"],
            ["full", "Full"],
          ] as const
        }
        wrap={false}
      />
    </>
  );
}
