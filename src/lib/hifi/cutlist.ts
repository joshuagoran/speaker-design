// Cutlist for the Hi-fi speaker: the box's six panels at its wall thickness, the slot shelf, and the cutouts and
// bought parts as notes on their rows. lib/pa/cutlist lays them out on sheets as it does the PA boxes.
import type {
  CornerJoint,
  CutPart,
  CutlistSettings,
  HifiCutPartsConfig,
  PanelMaterial,
  RadiatorPanel,
} from "../../types";
import { cutoutNote, formatInches } from "../pa/calc";
import { GRAIN_PRESETS } from "../pa/cutlist";
import { HIFI_DRIVER_CUTOUT_IN } from "../../data/catalog/driver-cutouts";
import {
  driverLayout,
  hifiPortElbows,
  hifiVentPort,
  passiveRadiatorShape,
  tweeterOffset,
} from "./hifi";

/** A driver's cutout note from its nominal size: the typical cutout, or the datasheet's where none is on file. */
const sizedCutout = (size: number) => {
  const c = HIFI_DRIVER_CUTOUT_IN[size];
  return c != null ? cutoutNote(c) : "driver cutout: use the datasheet's (no typical size on file)";
};
const joinNotes = (notes: (string | false | null | undefined)[]) =>
  notes.filter((n): n is string => !!n).join("; ");

/**
 * How each joint puts the box together, as the panels' sizes against the outside W × H × D (t the wall):
 * - butt: the baffle and back cover the whole front and rear; the sides run full height between them, the top and
 *   bottom sit between the sides. The baffle's front edges are one piece, so a roundover cuts into it alone.
 * - rabbet: the sides run full height and depth, rabbeted t × t/2 on all four edges for the top, bottom, baffle and
 *   back; the top and bottom are rabbeted front and rear for the baffle and back.
 * - miter: the sides, top and bottom wrap the box with 45° corners, rabbeted front and rear for the baffle and back.
 */
export function hifiCutParts({ cfg, woofer, tweeter, joint, prPanel }: HifiCutPartsConfig): {
  parts: CutPart[];
  also: string[];
} {
  const { w: W, h: H, d: D } = cfg.dim,
    t = cfg.wall || 0.75,
    box = "hifi" as const;
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

  // the baffle's cutouts, inches from the box bottom (the model's driver layout)
  const lay = driverLayout(woofer, tweeter, cfg.dim, !!cfg.guide?.freestanding);
  const off = tweeterOffset(cfg, tweeter, lay);
  const tweeterNote = lay.onTop
    ? "no tweeter cutout: its waveguide sits on the box top"
    : `tweeter ${formatInches(tweeter.faceplate.w)} × ${formatInches(tweeter.faceplate.h)}″ cutout (faceplate; use the datasheet's), centred ${formatInches(lay.tweeterIn)}″ above the box bottom${off ? `, ${formatInches(Math.abs(off))}″ ${off > 0 ? "inward" : "outward"} of centre (mirror the pair)` : ""}`;
  const wooferNote = `woofer ${sizedCutout(woofer.size)}, centred ${formatInches(lay.wooferIn)}″ above the box bottom`;

  const ventPort = hifiVentPort({ ...cfg, wall: t });
  const also: string[] = [];
  let portNote: string | null = null;
  const extra: CutPart[] = [];
  if (ventPort?.shape === "slot") {
    portNote = `slot opening ${formatInches(ventPort.w)} × ${formatInches(ventPort.h)}″ along the bottom, from the bottom panel's inside face`;
    extra.push({
      box,
      part: "slotShelf",
      qty: 1,
      a: ventPort.w,
      b: ventPort.len,
      t,
      note: `roof of the slot, ${formatInches(ventPort.h)}″ above the bottom; runs back from the baffle`,
    });
  } else if (ventPort) {
    portNote = `${ventPort.n} × port hole for the ${formatInches(ventPort.dia)}″ tube (size it to the tube's outside)`;
    const e = hifiPortElbows(cfg.dim, t, ventPort);
    also.push(
      `${ventPort.n} × ${formatInches(ventPort.dia)}″ port tube per speaker, ${formatInches(ventPort.len)}″ long (buy, flared)${e == null ? "; too long for this box (see the Hi-fi page)" : e ? `, with ${e} elbow${e > 1 ? "s" : ""}` : ""}`,
    );
  }

  // the radiators' cutouts, on the panel they mount on
  const pr = cfg.box === "radiator" && cfg.pr ? cfg.pr : null;
  const prNotes: Partial<Record<RadiatorPanel, string>> = {};
  if (pr) {
    const shape = pr.drv.shape;
    const one = shape
      ? `${formatInches(shape.w)} × ${formatInches(shape.h)}″ oval passive radiator cutout (use the datasheet's)`
      : `passive radiator ${sizedCutout(passiveRadiatorShape(pr.drv).w)}`;
    prNotes[prPanel] =
      prPanel !== "side"
        ? `${pr.n} × ${one}`
        : pr.n === 1
          ? `one side only (mirror the pair): ${one}`
          : pr.n % 2 === 0
            ? `${pr.n / 2} in each side: ${one}`
            : `${pr.n} split between the sides: ${one}`;
  }

  const r = cfg.roundoverIn || 0;
  const roundover =
    r > 0 &&
    `${formatInches(r)}″ roundover on the front edges${joint === "butt" ? "" : " (rout after glue-up)"}${r > t + 1e-9 ? `; deeper than the ${full}″ stock: double the baffle up or glue hardwood strips along its edges` : ""}`;

  const parts: CutPart[] = [
    {
      box,
      part: "side",
      qty: 2,
      a: s.side[0],
      b: s.side[1],
      t,
      note: joinNotes([sideNote, prNotes.side]),
    },
    { box, part: "topBottom", qty: 2, a: s.top[0], b: s.top[1], t, note: topNote },
    {
      box,
      part: "baffle",
      qty: 1,
      a: s.face[0],
      b: s.face[1],
      t,
      note: joinNotes([
        faceNote("front"),
        wooferNote,
        tweeterNote,
        portNote,
        prNotes.baffle,
        roundover,
      ]),
    },
    {
      box,
      part: "back",
      qty: 1,
      a: s.face[0],
      b: s.face[1],
      t,
      note: joinNotes([faceNote("rear"), prNotes.back]),
    },
    ...extra,
  ];
  return { parts, also };
}

/** The settings as a material takes them: MDF has no grain, so every panel turns freely and there is no waterfall. */
export const settingsForMaterial = (s: CutlistSettings, mat: PanelMaterial): CutlistSettings =>
  mat === "mdf" ? { ...s, grain: GRAIN_PRESETS.none, waterfall: false } : s;
