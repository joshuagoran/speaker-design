// Warning chips for the Speaker and Stack pages: pure functions of the numbers the page already has.
// Each returns [kind, head, body, id][] with kind "ok" | "warn" | "bad" and id the check's (CHIP_IDS).

import type {
  BoxHardwarePlan,
  ChipSeverity,
  Dims3,
  PortStyle,
  SubSize,
  VentSpec,
} from "../../types";
import {
  isRoundPort,
  maxFoldedSlotIn,
  maxStraightSlotIn,
  minFoldedSlotIn,
} from "../acoustics/boxModels";
import { subTubeSpan, tubeLayout, type TubeDriver } from "../build/tubes";
import { ELBOW_COUNTS, mergeSpans, ownSpans, type ElbowCount } from "../build/tubeFold";
import { PA_SLIDERS } from "../../constants/paSliders";
import {
  HARDWARE_ADVICE,
  HARDWARE_FIT_TITLES,
  HARDWARE_KIND_NAMES,
  hardwareClashLine,
  hardwareFitsLine,
  HARDWARE_OBSTACLE_NAMES,
  HARDWARE_PANEL_WORDS,
} from "../../constants/hardware";

// Longest duct each layout can hold, leaving an opening at least as wide as the duct. A bottom slot runs straight
// while it fits (maxStraight) and folds up the back wall past that, so it holds the longer of the two; a fold is never
// shorter than its floor run plus the least rise (minFold), so the lengths between the two fit neither way, nor longer
// than leaves a slot height under the lid (maxFold). Round tubes run straight, then take one elbow up the back wall and
// a second forward under the lid (lib/build/tubes), each count with its own lengths (`ways`, labeled for the chip); they run
// from the baffle front, `inset` behind the frame front, where the slots and side ducts run from the frame front.
// `spans` lists the lengths that fit, shortest first.
export function ductFit(
  subBox: Dims3,
  portStyle: PortStyle,
  cVent: VentSpec,
  PT: number,
  inset: number,
  drv: TubeDriver,
) {
  const inD = subBox.d - PT,
    sH = cVent.slotH;
  const maxStraight = maxStraightSlotIn(subBox, sH, PT); // bottom slot, straight
  const minFold = minFoldedSlotIn(subBox, PT); // bottom slot, folded at the least rise
  const maxFold = maxFoldedSlotIn(subBox, sH, PT); // bottom slot, folded up to a slot height under the lid
  const maxSide = inD - cVent.throat; // side ducts
  const ways: { span: readonly [number, number]; what: string }[] =
    portStyle === "slots"
      ? [
          { span: [0, maxStraight] as const, what: "a straight slot" },
          { span: [minFold, maxFold] as const, what: "a slot folded up the back wall" },
        ].filter(({ span: [a, b] }) => b >= a)
      : isRoundPort(portStyle)
        ? ELBOW_COUNTS.flatMap((e) => {
            const span = subTubeSpan(subBox, portStyle, cVent, PT, inset, drv, e);
            return span ? [{ span, what: TUBE_WAYS[e] }] : [];
          })
        : [{ span: [0, maxSide] as const, what: "a side duct" }];
  const spans = mergeSpans(ways.map((w) => w.span));
  const fit = Math.max(0, ...spans.map(([, b]) => b));
  // the lengths a solver tunes over, one way at a time (each turn steps the tuning): a slot's two ways never overlap;
  // a tube's counts are cut to where each is the fewest that fit (the model's count), a slider step past the fewer
  const tune: (readonly [number, number])[] = isRoundPort(portStyle)
    ? ownSpans(
        ELBOW_COUNTS.map((e) => subTubeSpan(subBox, portStyle, cVent, PT, inset, drv, e)),
        PA_SLIDERS.ductLen.step,
      ).map((w) => w.span)
    : ways.map((w) => w.span);
  return { maxStraight, minFold, maxFold, maxSide, fit, spans, ways, tune };
}
/** How the duct-fit chip names a tube with each count of elbows. */
const TUBE_WAYS = {
  0: "a straight tube",
  1: "a tube with an elbow up the back wall",
  2: "a tube with a second elbow under the lid",
} as const satisfies Record<ElbowCount, string>;
/** Whether a duct `len` long fits the layout: inside one of ductFit's spans. */
export const ductFits = (spans: ReturnType<typeof ductFit>["spans"], len: number) =>
  spans.some(([a, b]) => len >= a - 1e-9 && len <= b + 1e-9);
/** A check's severity, title and detail, without its id: a check two sections share (each with its own id). */
export type ChipBody = [severity: ChipSeverity, title: string, detail: string];

/**
 * The duct-fit check of a PA sub box (ductFit): the duct longer than the layout holds, or in a gap between the lengths
 * its ways hold. Null when it fits. The sub section and the Speaker page's chamber checks share it.
 */
export function ductFitChip(
  subBox: Dims3,
  portStyle: PortStyle,
  cVent: VentSpec,
  PT: number,
  inset: number,
  sub: TubeDriver,
): ChipBody | null {
  const { fit, spans, ways } = ductFit(subBox, portStyle, cVent, PT, inset, sub);
  if (cVent.len > fit)
    return [
      "bad",
      DUCT_TOO_LONG,
      `${cVent.len.toFixed(1)}″ does not fit. This layout holds ${fit.toFixed(1)}″` +
        (portStyle === "slots"
          ? ", folded up the back wall."
          : isRoundPort(portStyle) && ways.length > 1
            ? `, with ${ways.length === 2 ? "an elbow" : "two elbows"}.`
            : "."),
    ];
  if (!ductFits(spans, cVent.len)) {
    // in a gap: the longest way short of it and the shortest past it
    const below = ways.filter(({ span }) => span[1] < cVent.len).at(-1),
      above = ways.find(({ span }) => span[0] > cVent.len);
    return [
      "bad",
      DUCT_TOO_LONG,
      `${cVent.len.toFixed(1)}″ is past the ${(below?.span[1] ?? 0).toFixed(1)}″ ${below?.what ?? "the vent"} holds ` +
        `but short of the ${(above?.span[0] ?? fit).toFixed(1)}″ ${above?.what ?? "the vent"} needs.`,
    ];
  }
  return null;
}

/** The tube-layout check of a PA sub box: round tubes' flares that don't fit beside the driver. Null when they fit. */
export function tubeFitChip(
  subBox: Dims3,
  portStyle: PortStyle,
  cVent: VentSpec,
  PT: number,
  subSize: SubSize,
): ChipBody | null {
  return isRoundPort(portStyle) && !tubeLayout(subBox, portStyle, cVent, PT, subSize).fits
    ? [
        "bad",
        TUBES_WONT_FIT,
        `${cVent.nt} × ${cVent.dia}″ flared tubes do not fit beside the driver. Use fewer or narrower tubes.`,
      ]
    : null;
}

/** How far a band may fall short of the band below at their crossover before its chip says it runs out first, dB. */
export const KEEP_UP_SLACK_DB = 0.5;

/** The title of the sub's tube-layout chip, when the round tubes' flares don't fit the baffle round the driver. */
const TUBES_WONT_FIT = "Tubes do not fit";
/** The title of the sub's duct-fit chip, past the layout's room or in the lengths a bottom slot can't take either way. */
const DUCT_TOO_LONG = "Vent too long";
/**
 * An HF section through a passive pad `pad` dB on the amp it shares: the amp power at which it reaches its program
 * rating `ratingW` (`hfLimW`, W into the channel's load) against the amp's `ampW`. The Speaker page's check.
 */
export function hfHeadroomChip(
  pad: number,
  ratingW: number,
  hfLimW: number,
  ampW: number,
): ChipBody {
  return hfLimW < ampW
    ? [
        "warn",
        "HF limits first",
        `With a ${pad.toFixed(0)} dB pad, the HF reaches its ${Math.round(ratingW)} W rating at ${Math.round(hfLimW)} W of the ${ampW} W amp.`,
      ]
    : [
        "ok",
        "HF has headroom",
        `With a ${pad.toFixed(0)} dB pad, the HF reaches its rating at ${Math.round(hfLimW)} W of amp.`,
      ];
}

/** `hardwareChip` without its id, the box named `box` ("Sub"), or null where the row names it (the Speaker page's chamber checks). */
export function hardwareFitChip(plan: BoxHardwarePlan, box: string | null): ChipBody {
  /** text after the box's name, or starting the sentence where the row already names the box */
  const lead = (text: string) =>
    box ? `${box} ${text}` : `${text.charAt(0).toUpperCase()}${text.slice(1)}`;
  // the two handles mirror each other: one line for both when they hit the same things
  const lines: string[] = [];
  for (const p of plan.parts) {
    if (!p.hits.length) continue;
    const both =
      p.kind === "handle" &&
      plan.parts.filter((o) => o.kind === "handle" && o.hits.join() === p.hits.join()).length === 2;
    if (both && p.panel === "sideR") continue;
    const where = both
      ? `${HARDWARE_KIND_NAMES.handle}s`
      : `${HARDWARE_PANEL_WORDS[p.panel]} ${HARDWARE_KIND_NAMES[p.kind]}`;
    lines.push(
      hardwareClashLine(
        lead(`${where} (${p.part.name})`),
        both,
        p.hits.map((h) => HARDWARE_OBSTACLE_NAMES[h]).join(", "),
        HARDWARE_ADVICE[p.kind],
      ),
    );
  }
  const title = (t: string) => (box ? `${box}: ${t}` : t);
  return lines.length
    ? ["warn", title(HARDWARE_FIT_TITLES.clash), lines.join(" ")]
    : ["ok", title(HARDWARE_FIT_TITLES.fits), hardwareFitsLine(plan.liters.toFixed(2))];
}
