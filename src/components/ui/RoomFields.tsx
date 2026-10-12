import { ToggleGroup } from "./ToggleGroup";
import { Slider } from "./Slider";
import { SelectField } from "./SelectField";
import { ROOM_MATERIAL_OPTIONS } from "../../lib/pa/roomAcoustics";
import { UI_TEXT } from "../../constants/uiText";
import type { CoverageRoom, FloorCrowd, RoomMaterial, RoomSurface } from "../../types";

/** Room size limits, ft. */
export const ROOM_WIDTH_FT: [number, number] = [16, 80];
export const ROOM_LENGTH_FT: [number, number] = [16, 100];
export const ROOM_CEILING_FT: [number, number] = [8, 40];

/** Each surface whose material is set, and the name its field shows. */
const SURFACES: [RoomSurface, string][] = [
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
}

/** A coverage room's settings: indoors or out, its size, each surface's material, and the dance floor. */
export function RoomFields({ room, actions }: Props) {
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
        className="mb-3"
      />
      <Slider
        label={room.outdoors ? "Area width" : "Width"}
        value={room.widthFt}
        min={ROOM_WIDTH_FT[0]}
        max={ROOM_WIDTH_FT[1]}
        step={1}
        unit=" ft"
        onChange={(widthFt) => actions.setRoomSize({ widthFt, lengthFt: room.lengthFt })}
      />
      <Slider
        label={room.outdoors ? "Area length" : "Length"}
        value={room.lengthFt}
        min={ROOM_LENGTH_FT[0]}
        max={ROOM_LENGTH_FT[1]}
        step={1}
        unit=" ft"
        onChange={(lengthFt) => actions.setRoomSize({ widthFt: room.widthFt, lengthFt })}
      />
      {!room.outdoors && (
        <>
          <Slider
            label="Ceiling height"
            value={room.ceilingFt}
            min={ROOM_CEILING_FT[0]}
            max={ROOM_CEILING_FT[1]}
            step={1}
            unit=" ft"
            onChange={actions.setCeilingFt}
          />
          <div className="grid grid-cols-2 gap-x-3">
            {SURFACES.map(([surface, name]) => (
              <SelectField
                key={surface}
                label={name}
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
