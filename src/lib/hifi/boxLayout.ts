// Where a Hi-fi speaker's vent and passive radiators sit, inches: x across from the box's center line (+ to the right
// seen from the front: the left speaker's inside), y up from the box bottom. The 2D front drawing and the 3D view both
// read these.
import { HIFI_BOX_LAYOUT } from "../../constants/hifiLayout";
import { passiveRadiatorShape } from "./hifi";
import type {
  Dims2,
  Dims3,
  PassiveRadiatorChoice,
  RadiatorPanel,
  RoundPort,
  SlotPort,
} from "../../types";

/** A round opening's center and radius. */
export interface RoundSpot {
  x: number;
  y: number;
  r: number;
}

/** The round ports' openings: side by side across the center line, low on the baffle. */
export const roundPortSpots = ({ n, dia }: Pick<RoundPort, "n" | "dia">): RoundSpot[] =>
  Array.from({ length: n }, (_, i) => ({
    x: (i - (n - 1) / 2) * (dia + HIFI_BOX_LAYOUT.portGapIn),
    y: dia / 2 + HIFI_BOX_LAYOUT.portLiftIn,
    r: dia / 2,
  }));

/** The slot's opening on the front: the inside width, from the bottom panel up to the slot's roof. */
export const slotOpening = (dim: Pick<Dims3, "w">, wall: number, { h }: Pick<SlotPort, "h">) => ({
  w: dim.w - 2 * wall,
  h,
  /** its bottom */
  y: wall,
});

/** The side of the box a radiator on a side panel is on: the speaker's outside (−x) or inside (+x). */
export type RadiatorSide = -1 | 1;

/** One passive radiator: the panel it's on (and, on a side, which side), its center height and its cone's shape. */
export interface RadiatorSpot {
  panel: RadiatorPanel;
  side?: RadiatorSide;
  y: number;
  shape: Dims2;
}

/**
 * The passive radiators on their panel, each centered across it and stacked up from the bottom (`passiveRadiatorFits`
 * checks they fit). On the sides the pair is mirror-imaged: one goes on the outside, an even count splits evenly, and an
 * odd count puts the extra one on the outside (the Cutlist page's notes say the same).
 */
export function radiatorSpots(
  pr: Pick<PassiveRadiatorChoice, "drv" | "n">,
  panel: RadiatorPanel,
  wall: number,
): RadiatorSpot[] {
  const shape = passiveRadiatorShape(pr.drv);
  const stack = (count: number) =>
    Array.from(
      { length: count },
      (_, i) =>
        wall +
        HIFI_BOX_LAYOUT.radiatorMarginIn +
        (i + 0.5) * (shape.h + HIFI_BOX_LAYOUT.radiatorGapIn),
    );
  if (panel !== "side") return stack(pr.n).map((y) => ({ panel, y, shape }));
  const outside = Math.ceil(pr.n / 2);
  return [
    ...stack(outside).map((y) => ({ panel, side: -1 as const, y, shape })),
    ...stack(pr.n - outside).map((y) => ({ panel, side: 1 as const, y, shape })),
  ];
}
