// Cutlist for the Hi-fi speaker: the box's six panels at its wall thickness, the slot shelf, and the cutouts and
// bought parts as notes on their rows. lib/pa/cutlist lays them out on sheets as it does the PA boxes. The flush box's
// panels and notes are shared with the Designer's flush cabinets (lib/speaker/speakerBuild).
import type {
  CornerJoint,
  CutBoxId,
  CutPart,
  CutlistSettings,
  Dims2,
  Dims3,
  HifiCutPartsConfig,
  PanelMaterial,
  PassiveRadiatorChoice,
  RadiatorPanel,
  RoundPort,
  SizedSlotPort,
} from "../../types";
import { cutoutNote, formatInches } from "../pa/calc";
import { GRAIN_PRESETS, NOTE_SEP } from "../pa/cutlist";
import { HIFI_DRIVER_CUTOUT_IN } from "../../data/catalog/driver-cutouts";
import {
  driverLayout,
  hifiPortElbows,
  hifiVentPort,
  passiveRadiatorShape,
  tweeterOffset,
} from "./hifi";

/** A driver's cutout note from its nominal size: the typical cutout, or the datasheet's where none is on file. */
export const sizedCutout = (size: number) => {
  const c = HIFI_DRIVER_CUTOUT_IN[size];
  return c != null ? cutoutNote(c) : "driver cutout: use the datasheet's (no typical size on file)";
};
/** Notes joined into one row's note, the empty ones left out. */
export const joinNotes = (notes: readonly (string | false | null | undefined)[]) =>
  notes.filter((n): n is string => !!n).join(NOTE_SEP);

/**
 * How far a flush box's baffle edge sits above the box bottom, in: a butt-jointed baffle covers the front edges, a
 * rabbeted or mitered one sits t/2 up in the rabbets.
 */
const baffleEdgeIn = (joint: CornerJoint, t: number) => (joint === "butt" ? 0 : t / 2);
/**
 * A height on a flush box's baffle, as the cutlist marks it on the loose panel: up from the baffle's own bottom edge
 * (`baffleEdgeIn`), from a height up from the box bottom.
 */
export const aboveBaffleEdge = (fromBoxBottom: number, joint: CornerJoint, t: number) =>
  `${formatInches(fromBoxBottom - baffleEdgeIn(joint, t))}″ above the bottom edge`;
/** A part's offset across a pair's baffle in words: inward or outward of center (mirror the pair); none at 0. */
export const offsetWords = (off: number) =>
  off
    ? `, ${formatInches(Math.abs(off))}″ ${off > 0 ? "inward" : "outward"} of center (mirror the pair)`
    : "";
/** A tweeter's faceplate cutout note, at its center (`at`, words) and offset across (`off`, in). */
export const tweeterCutoutNote = (faceplate: Dims2, at: string, off: number) =>
  `tweeter: ${formatInches(faceplate.w)} × ${formatInches(faceplate.h)}″ cutout (faceplate; use the datasheet's), center ${at}${offsetWords(off)}`;
/** The words for a port too long to fit its box. */
const TOO_LONG = "too long for this box (see the Hi-fi page)";
/** A slot's openings on the baffle, at the floor (`at`, words): one, or `n` alike (the Hi-fi page's slot is one). */
export const slotOpeningNote = (port: Pick<SizedSlotPort, "w" | "h" | "n">, at: string) =>
  `${port.n > 1 ? `${port.n} × ` : ""}slot: ${formatInches(port.w)} × ${formatInches(port.h)}″ opening, centered, ${at}`;
/** A slot's shelves as a cutlist row of `box`: each its slot's roof, running back from the baffle; `fits` false when too long. */
export const slotShelfPart = (
  box: CutBoxId,
  port: Pick<SizedSlotPort, "w" | "h" | "len" | "n">,
  t: number,
  fits: boolean,
): CutPart => ({
  box,
  part: "slotShelf",
  qty: port.n,
  a: port.w,
  b: port.len,
  t,
  note: joinNotes([
    `roof of the slot: underside ${formatInches(port.h)}″ above the bottom panel`,
    "runs back from the baffle",
    !fits && TOO_LONG,
  ]),
});
/** A round port's holes on its panel. */
export const roundPortHoleNote = (port: Pick<RoundPort, "n" | "dia">) =>
  `port: ${port.n} × hole for the ${formatInches(port.dia)}″ tube (size it to the tube's outside)`;
/** A round port's tubes as bought, with the elbows each takes (null: too long for the box). */
export const roundPortLine = (port: Pick<RoundPort, "n" | "dia" | "len">, elbows: number | null) =>
  `${port.n} × ${formatInches(port.dia)}″ port tube per speaker, ${formatInches(port.len)}″ long (buy, flared)${elbows == null ? `; ${TOO_LONG}` : elbows ? `, with ${elbows} elbow${elbows > 1 ? "s" : ""}` : ""}`;
/** The radiators' cutouts, on the panel they mount on (a side panel: split between the two, mirrored for a pair). */
export function radiatorCutoutNote(
  pr: Pick<PassiveRadiatorChoice, "drv" | "n">,
  panel: RadiatorPanel,
): string {
  const shape = pr.drv.shape;
  const one = shape
    ? `${formatInches(shape.w)} × ${formatInches(shape.h)}″ oval passive radiator cutout (use the datasheet's)`
    : `passive radiator ${sizedCutout(passiveRadiatorShape(pr.drv).w)}`;
  return panel !== "side"
    ? `${pr.n} × ${one}`
    : pr.n === 1
      ? `one side only (mirror the pair): ${one}`
      : pr.n % 2 === 0
        ? `${pr.n / 2} in each side: ${one}`
        : `${pr.n} split between the sides: ${one}`;
}
/** The baffle's roundover note: routed after glue-up but on a butt joint, and the warning past the stock's depth. */
export const roundoverNote = (r: number, t: number, joint: CornerJoint) =>
  r > 0 &&
  `${formatInches(r)}″ roundover on the front edges${joint === "butt" ? "" : " (rout after glue-up)"}${r > t + 1e-9 ? `${NOTE_SEP}roundover deeper than the ${formatInches(t)}″ stock: double the baffle up or glue hardwood strips along its edges` : ""}`;

/** The notes a flush box's panels carry: their cutouts and fittings, by panel. */
export interface FlushBoxNotes {
  side?: string;
  baffle: readonly (string | false | null | undefined)[];
  back?: string;
}

/**
 * A flush box's four panel rows (label `box`), the outside W × H × D at walls `t`, by joint:
 * - butt: the baffle and back cover the whole front and rear; the sides run full height between them, the top and
 *   bottom sit between the sides. The baffle's front edges are one piece, so a roundover cuts into it alone.
 * - rabbet: the sides run full height and depth, rabbeted t × t/2 on all four edges for the top, bottom, baffle and
 *   back; the top and bottom are rabbeted front and rear for the baffle and back.
 * - miter: the sides, top and bottom wrap the box with 45° corners, rabbeted front and rear for the baffle and back.
 */
export function flushBoxPanels(
  box: CutBoxId,
  { w: W, h: H, d: D }: Dims3,
  t: number,
  joint: CornerJoint,
  notes: FlushBoxNotes,
): CutPart[] {
  const half = formatInches(t / 2),
    full = formatInches(t);
  const rabbet = (edges: string) => `rabbet ${full} × ${half} on ${edges}`;
  // sides: depth front to back (a) by height (b); top/bottom: depth (a) by width (b); baffle and back: width by height
  const size: Record<
    CornerJoint,
    { side: [number, number]; top: [number, number]; face: [number, number] }
  > = {
    butt: { side: [D - 2 * t, H], top: [D - 2 * t, W - 2 * t], face: [W, H] },
    rabbet: { side: [D, H], top: [D, W - t], face: [W - t, H - t] },
    miter: { side: [D, H], top: [D, W], face: [W - t, H - t] },
  };
  const s = size[joint];
  const sideNote = {
    butt: "between the baffle and back",
    rabbet: rabbet("all four edges, for the top, bottom, baffle and back"),
    miter: `45° on the top and bottom edges; ${rabbet("the front and rear edges")}`,
  }[joint];
  const topNote = {
    butt: "between the sides",
    rabbet: rabbet("the front and rear edges"),
    miter: `45° on both ends; ${rabbet("the front and rear edges")}`,
  }[joint];
  const faceNote = (where: "front" | "rear") =>
    joint === "butt" ? `covers the ${where} edges` : `sits in the ${where} rabbets`;
  return [
    {
      box,
      part: "side",
      qty: 2,
      a: s.side[0],
      b: s.side[1],
      t,
      note: joinNotes([sideNote, notes.side]),
    },
    { box, part: "topBottom", qty: 2, a: s.top[0], b: s.top[1], t, note: topNote },
    {
      box,
      part: "baffle",
      qty: 1,
      a: s.face[0],
      b: s.face[1],
      t,
      note: joinNotes([faceNote("front"), ...notes.baffle]),
    },
    {
      box,
      part: "back",
      qty: 1,
      a: s.face[0],
      b: s.face[1],
      t,
      note: joinNotes([faceNote("rear"), notes.back]),
    },
  ];
}

/** The Hi-fi box's panels (flushBoxPanels) with its drivers', port's and radiators' cutouts, and the slot's shelf. */
export function hifiCutParts({ cfg, woofer, tweeter, joint, prPanel }: HifiCutPartsConfig): {
  parts: CutPart[];
  also: string[];
} {
  const t = cfg.wall || 0.75,
    box = "hifi" as const;
  // the baffle's cutouts, as heights up from the baffle's own bottom edge, so they can be marked on the loose panel
  const up = (fromBoxBottom: number) => aboveBaffleEdge(fromBoxBottom, joint, t);
  const lay = driverLayout(woofer, tweeter, cfg.dim, !!cfg.guide?.freestanding);
  const tweeterNote = lay.coax
    ? "no tweeter cutout: the coaxial's HF is in the woofer"
    : lay.onTop
      ? "no tweeter cutout: its waveguide sits on the box top"
      : tweeterCutoutNote(tweeter.faceplate, up(lay.tweeterIn), tweeterOffset(cfg, tweeter, lay));
  const wooferNote = `woofer: ${sizedCutout(woofer.size)}, center ${up(lay.wooferIn)}`;

  const ventPort = hifiVentPort({ ...cfg, wall: t });
  const also: string[] = [];
  let portNote: string | null = null;
  const extra: CutPart[] = [];
  // the model's check that the port fits the box (null: too long for it)
  const elbows = ventPort ? hifiPortElbows(cfg.dim, t, ventPort) : 0;
  if (ventPort?.shape === "slot") {
    // the slot runs from the bottom panel's inside face (t up the box) to the shelf
    portNote = slotOpeningNote(ventPort, up(t));
    extra.push(slotShelfPart(box, ventPort, t, elbows != null));
  } else if (ventPort) {
    portNote = roundPortHoleNote(ventPort);
    also.push(roundPortLine(ventPort, elbows));
  }

  // the radiators' cutouts, on the panel they mount on
  const pr = cfg.box === "radiator" && cfg.pr ? cfg.pr : null;
  const prNotes: Partial<Record<RadiatorPanel, string>> = pr
    ? { [prPanel]: radiatorCutoutNote(pr, prPanel) }
    : {};

  const parts: CutPart[] = [
    ...flushBoxPanels(box, cfg.dim, t, joint, {
      side: prNotes.side,
      baffle: [
        wooferNote,
        tweeterNote,
        portNote,
        prNotes.baffle,
        roundoverNote(cfg.roundoverIn || 0, t, joint),
      ],
      back: prNotes.back,
    }),
    ...extra,
  ];
  return { parts, also };
}

/** The settings as a material takes them: MDF has no grain, so every panel turns freely and there is no waterfall. */
export const settingsForMaterial = (s: CutlistSettings, mat: PanelMaterial): CutlistSettings =>
  mat === "mdf" ? { ...s, grain: GRAIN_PRESETS.none, waterfall: false } : s;
