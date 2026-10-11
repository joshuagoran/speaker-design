// Where a Hi-fi speaker's vent and passive radiators sit, inches: x across from the box's center line (+ to the right
// seen from the front: the left speaker's inside), y up from the box bottom. The 2D front drawing and the 3D view both
// read these.
import { HIFI_BOX_LAYOUT, HIFI_BOX_SLIDERS } from "../../constants/hifiLayout";
import { HIFI_FRONT_PARTS } from "../../constants/hifiScene";
import { isCoax, passiveRadiatorShape, RADIATOR_PANEL, tweeterOnGuide, waveguideFor } from "./hifi";
import { HIFI_PASSIVES, passiveRadiatorMassMax } from "../data";
import { byId } from "../tables";
import { panelIn } from "../panel";
import { boxSliderMins, fitBox } from "../boxFit";
import type {
  Dims2,
  Dims3,
  HifiConfig,
  HifiDesignState,
  HifiTweeter,
  HifiWoofer,
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

/**
 * An AMT's plate seen from the front (`HIFI_FRONT_PARTS.amt`): the opening onto its folded diaphragm, `margin` in from
 * every edge of the `plate`, and the folds' centers along the opening's long side (each fold spans its short side),
 * from its center.
 */
export function amtOpening(plate: Dims2) {
  const A = HIFI_FRONT_PARTS.amt;
  const w = Math.max(plate.w - 2 * A.marginIn, A.foldPitchIn),
    h = Math.max(plate.h - 2 * A.marginIn, A.foldPitchIn);
  const tall = h >= w,
    long = tall ? h : w;
  const n = Math.max(1, Math.floor(long / A.foldPitchIn));
  const folds = Array.from({ length: n }, (_, i) => ((i + 0.5) * long) / n - long / 2);
  return { w, h, tall, folds };
}

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

/**
 * The smallest box width and height that hold the design's parts as the layout places them, inches:
 * - across: the woofer (its nominal size and `wooferWidthIn`), the tweeter's faceplate or a waveguide set into the baffle
 *   (with the walls and `faceplateWidthIn`; a waveguide on the box top, or a coaxial's HF, needs none), the row of round ports as
 *   `roundPortSpots` places it (each cut to its tube's outside) inside the walls, and radiators on the baffle or back
 *   (as `passiveRadiatorFits` sizes them);
 * - up: the tweeter (unless on the box top or a coaxial's) and the woofer down from the top as `driverLayout` stacks them, the woofer's
 *   bottom clear of the vent along the bottom of the baffle (a slot with its shelf, or round ports) or of radiators on
 *   the baffle, and radiators stacked on the back (or, on the sides, the outside's share of them: their depth isn't
 *   checked here).
 * `tweeter` is the tweeter with its waveguide's mouth as the faceplate (`HifiDesign.tweeterWithWaveguide`).
 */
export function hifiBoxMin({
  woofer,
  tweeter,
  onTop,
  cfg,
  wall,
  radiatorPanel,
}: {
  woofer: Pick<HifiWoofer, "size" | "id">;
  tweeter: Pick<HifiTweeter, "faceplate" | "id">;
  onTop: boolean;
  cfg: Pick<HifiConfig, "box" | "port" | "pr">;
  wall: number;
  radiatorPanel: RadiatorPanel;
}): Dims2 {
  const L = HIFI_BOX_LAYOUT;
  // a tweeter on the box top, or a coaxial's HF at its woofer's center, takes no room of its own on the baffle
  const face = onTop || isCoax(woofer, tweeter) ? null : tweeter.faceplate;
  const pr = cfg.box === "radiator" && cfg.pr ? cfg.pr : null;
  const prShape = pr && passiveRadiatorShape(pr.drv);
  const prStack = pr && prShape ? pr.n * (prShape.h + L.radiatorGapIn) : 0;
  const prAcross =
    prShape && radiatorPanel !== "side" ? prShape.w + L.radiatorWidthIn + 2 * wall : 0;
  // what the woofer's bottom stands on: the slot and its shelf, round ports, or radiators stacked on the baffle
  const port = cfg.box === "vented" ? cfg.port : null;
  // the round ports' row: from the first spot's left edge to the last one's right, each cut to its tube's outside
  const ports = port && port.shape !== "slot" ? roundPortSpots(port) : [];
  const portRow = ports.length
    ? ports[ports.length - 1].x - ports[0].x + 2 * (ports[0].r + L.portTubeWallIn) + 2 * wall
    : 0;
  const w = Math.max(
    woofer.size + L.wooferWidthIn,
    face ? face.w + 2 * wall + L.faceplateWidthIn : 0,
    prAcross,
    portRow,
  );
  const below =
    port?.shape === "slot"
      ? port.h + wall
      : port
        ? port.dia + L.portLiftIn
        : pr && radiatorPanel === "baffle"
          ? wall + L.radiatorMarginIn + prStack
          : 0;
  const drivers =
    L.topMarginIn + (face ? face.h + L.driverGapIn : 0) + woofer.size + L.wooferFloorIn + below;
  const prPanelH =
    pr && prShape
      ? radiatorPanel === "back"
        ? 2 * wall + prStack
        : radiatorPanel === "side"
          ? 2 * wall + Math.ceil(pr.n / 2) * (prShape.h + L.radiatorGapIn)
          : 0
      : 0;
  const h = Math.max(drivers, prPanelH);
  return { w, h };
}

/** The page's state the box fit reads. */
type HifiBoxFitState = Pick<
  HifiDesignState,
  | "woofer"
  | "tweeter"
  | "selectedWaveguide"
  | "boxType"
  | "boxDims"
  | "wallPanel"
  | "panelExactIn"
  | "panelMaterial"
  | "portSpec"
  | "radiatorSelection"
>;

/**
 * The box as the Hi-fi model takes it, from the page's state: the waveguide in use and the tweeter on it, the
 * radiators (their added mass kept under the most allowed), the walls' exact thickness, and the size the user set fitted
 * to at least what the parts need (each up to its slider's step). A design made too small by a part or wall change, or
 * saved that way, is modeled, drawn and saved at the fitted size. The page (pages/hifi/hifiDesign) and the speaker spec
 * (lib/speaker/hifiSpec) both read it.
 */
export function hifiBoxFit(state: HifiBoxFitState) {
  const { woofer, tweeter, selectedWaveguide, boxType, boxDims, radiatorSelection } = state;
  const waveguideSpec = waveguideFor(tweeter, selectedWaveguide);
  const radiatorDriver = byId(HIFI_PASSIVES, radiatorSelection.id) ?? HIFI_PASSIVES[0];
  const radiator: PassiveRadiatorChoice = {
    drv: radiatorDriver,
    n: radiatorSelection.n,
    addG: Math.min(radiatorSelection.addG, passiveRadiatorMassMax(radiatorDriver)),
  };
  const wallThicknessIn = panelIn(state.wallPanel, state.panelMaterial, state.panelExactIn);
  const tweeterWithWaveguide = tweeterOnGuide(tweeter, waveguideSpec);
  const boxMin = boxSliderMins(
    hifiBoxMin({
      woofer,
      tweeter: tweeterWithWaveguide,
      onTop: !!waveguideSpec?.freestanding,
      cfg: { box: boxType, port: state.portSpec, pr: radiator },
      wall: wallThicknessIn,
      radiatorPanel: RADIATOR_PANEL,
    }),
    HIFI_BOX_SLIDERS,
  );
  return {
    waveguideSpec,
    radiator,
    wallThicknessIn,
    tweeterWithWaveguide,
    boxMin,
    dim: fitBox(boxDims, boxMin),
  };
}
