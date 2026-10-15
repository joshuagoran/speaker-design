// The driver board of a horn-loaded chamber: the panel at the back of the bay (the front chamber), behind the throat,
// that the drivers mount on. It is one piece of the walls' plywood, or two glued face to face (`SpeakerHorn.doubleBoard`).
// The cones stand flush with the front of the last piece the drivers bolt to: with one piece, at the bay's end; with
// two, the first piece's cutouts open in front of them, so the cones stand one piece's thickness (a wall) behind the
// bay's end. That setback adds to the front chamber's air and to the depth the drivers need. Pure.
import type { SpeakerChamber, SpeakerHorn, SpeakerPanel } from "../../types";
import { DRIVER_BOARD_PIECES } from "../../constants/hornThroat";
import { CHAMBER_LOAD } from "../../constants/speakerSpec";

/** How many pieces of the walls' plywood make the horn's driver board: two when doubled, else one. */
export const driverBoardPieces = (horn: Pick<SpeakerHorn, "doubleBoard">) =>
  horn.doubleBoard ? DRIVER_BOARD_PIECES.double : DRIVER_BOARD_PIECES.wall;

/** The horn's driver board thickness, in: its pieces, each as thick as a wall. */
export const driverBoardIn = (wallIn: number, horn: Pick<SpeakerHorn, "doubleBoard">) =>
  wallIn * driverBoardPieces(horn);

/** The chamber's driver board thickness, in: its horn's; 0 for a chamber with no horn built into it. */
export const chamberBoardIn = (
  panel: Pick<SpeakerPanel, "thicknessIn">,
  chamber: Pick<SpeakerChamber, "load">,
) =>
  chamber.load.kind === CHAMBER_LOAD.horn ? driverBoardIn(panel.thicknessIn, chamber.load.horn) : 0;

/**
 * How far the cones stand behind the bay's end, in: the pieces of the board in front of the one the drivers bolt to, each
 * a wall thick (0 for one piece).
 */
export const driverSetbackIn = (wallIn: number, horn: Pick<SpeakerHorn, "doubleBoard">) =>
  wallIn * (driverBoardPieces(horn) - 1);

/** The chamber's cone setback, in (`driverSetbackIn`); 0 for a chamber with no horn built into it. */
export const chamberSetbackIn = (
  panel: Pick<SpeakerPanel, "thicknessIn">,
  chamber: Pick<SpeakerChamber, "load">,
) =>
  chamber.load.kind === CHAMBER_LOAD.horn
    ? driverSetbackIn(panel.thicknessIn, chamber.load.horn)
    : 0;
