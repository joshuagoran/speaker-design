// Warning chips for each planner section: pure functions of the numbers the page already has.
// Each returns [kind, head, body, id][] with kind "ok" | "warn" | "bad" and id the check's (CHIP_IDS). Tested in tests/chips.test.ts.

import type {
  Chip,
  ChipId,
  Dims3,
  FillChipsInput,
  HornChipsInput,
  MidChipsInput,
  PortStyle,
  SubChipsInput,
  VentSpec,
} from "../../types";
import { isRoundPort, maxFoldedSlotIn, maxStraightSlotIn, minFoldedSlotIn } from "./calc";
import { subTubeSpan, tubeLayout, type TubeDriver } from "./tubes";
import { ELBOW_COUNTS, mergeSpans, ownSpans, type ElbowCount } from "../tubeFold";
import { PA_SLIDERS } from "../../constants/paSliders";
import { crossoverSlopeName } from "../../constants/crossovers";

// Longest duct each layout can hold, leaving an opening at least as wide as the duct. A bottom slot runs straight
// while it fits (maxStraight) and folds up the back wall past that, so it holds the longer of the two; a fold is never
// shorter than its floor run plus the least rise (minFold), so the lengths between the two fit neither way, nor longer
// than leaves a slot height under the lid (maxFold). Round tubes run straight, then take one elbow up the back wall and
// a second forward under the lid (lib/pa/tubes), each count with its own lengths (`ways`, labeled for the chip).
// `spans` lists the lengths that fit, shortest first.
export function ductFit(
  subBox: Dims3,
  portStyle: PortStyle,
  cVent: VentSpec,
  PT: number,
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
            const span = subTubeSpan(subBox, portStyle, cVent, PT, drv, e);
            return span ? [{ span, what: TUBE_WAYS[e] }] : [];
          })
        : [{ span: [0, maxSide] as const, what: "a side duct" }];
  const spans = mergeSpans(ways.map((w) => w.span));
  const fit = Math.max(0, ...spans.map(([, b]) => b));
  // the lengths a solver tunes over, one way at a time (each turn steps the tuning): a slot's two ways never overlap;
  // a tube's counts are cut to where each is the fewest that fit (the model's count), a slider step past the fewer
  const tune: (readonly [number, number])[] = isRoundPort(portStyle)
    ? ownSpans(
        ELBOW_COUNTS.map((e) => subTubeSpan(subBox, portStyle, cVent, PT, drv, e)),
        PA_SLIDERS.ductLen.step,
      ).map((w) => w.span)
    : ways.map((w) => w.span);
  return { maxStraight, minFold, maxFold, maxSide, fit, spans, ways, tune };
}
/**
 * ductFit's `fit` alone (the longest duct the layout holds), without the spans and their labels: the exact search's
 * pruning asks it of every box it tries.
 */
export function ductFitMax(
  subBox: Dims3,
  portStyle: PortStyle,
  cVent: VentSpec,
  PT: number,
  drv: TubeDriver,
) {
  if (portStyle === "slots") {
    const maxFold = maxFoldedSlotIn(subBox, cVent.slotH, PT);
    return Math.max(
      0,
      maxStraightSlotIn(subBox, cVent.slotH, PT),
      maxFold >= minFoldedSlotIn(subBox, PT) ? maxFold : 0,
    );
  }
  if (!isRoundPort(portStyle)) return Math.max(0, subBox.d - PT - cVent.throat);
  let fit = 0;
  for (const e of ELBOW_COUNTS) {
    const span = subTubeSpan(subBox, portStyle, cVent, PT, drv, e);
    if (span) fit = Math.max(fit, span[1]);
  }
  return fit;
}
/** How the duct-fit chip names a tube with each count of elbows. */
const TUBE_WAYS = {
  0: "a straight tube",
  1: "a tube with an elbow up the back wall",
  2: "a tube with a second elbow under the lid",
} as const satisfies Record<ElbowCount, string>;
/**
 * The duct-length slider's top: its own, or a bottom slot's longest fold or the longest tube where that runs past it.
 * The settings panel and the optimizers take this one limit, so every card's duct is a length the slider can show.
 */
export const ductLenSliderMax = (
  subBox: Dims3,
  portStyle: PortStyle,
  cVent: VentSpec,
  PT: number,
  drv: TubeDriver,
) =>
  portStyle === "slots"
    ? Math.max(PA_SLIDERS.ductLen.max, maxFoldedSlotIn(subBox, cVent.slotH, PT))
    : isRoundPort(portStyle)
      ? Math.max(PA_SLIDERS.ductLen.max, ductFit(subBox, portStyle, cVent, PT, drv).fit)
      : PA_SLIDERS.ductLen.max;
/** Whether a duct `len` long fits the layout: inside one of ductFit's spans. */
export const ductFits = (spans: ReturnType<typeof ductFit>["spans"], len: number) =>
  spans.some(([a, b]) => len >= a - 1e-9 && len <= b + 1e-9);
// Clear baffle a driver needs: the sub's cone plus its frame.
export const subDriverClearanceNeededIn = (subSize: number) => subSize + 1.9;
export function driverClearance(subBox: Dims3, portStyle: PortStyle, cVent: VentSpec, PT: number) {
  const nSide = portStyle === "vslot1" ? 1 : portStyle === "vslots" ? 2 : 0;
  return {
    clearW: subBox.w - nSide * (cVent.throat + 0.43 + PT),
    clearH: subBox.h - (portStyle === "slots" ? cVent.slotH + PT : 0),
  };
}

/**
 * Whether the sub's baffle holds its driver and vents: the driver's clearance after the vents (driverClearance), and
 * round tubes' flares clear of the walls, each other and the driver's frame (tubeLayout). The optimizers keep only these.
 */
export const subBaffleFits = (
  subBox: Dims3,
  portStyle: PortStyle,
  cVent: VentSpec,
  PT: number,
  sub: TubeDriver,
) => {
  const { clearW, clearH } = driverClearance(subBox, portStyle, cVent, PT);
  return (
    Math.min(clearW, clearH) >= subDriverClearanceNeededIn(sub.size) &&
    (!isRoundPort(portStyle) || tubeLayout(subBox, portStyle, cVent, PT, sub.size).fits)
  );
};

/** How far a band may fall short of the band below at their crossover before its chip says it runs out first, dB. */
export const KEEP_UP_SLACK_DB = 0.5;

/** The title the sub, mid and fill share for a driver its baffle has no room for. */
const DRIVER_WONT_FIT = "Driver won't fit";
/** The title of the sub's tube-layout chip, when the round tubes' flares don't fit the baffle round the driver. */
const TUBES_WONT_FIT = "Tubes won't fit";
/** The title of the sub's duct-fit chip, past the layout's room or in the lengths a bottom slot can't take either way. */
const DUCT_TOO_LONG = "Duct too long";
/** The title the sub and mid share when the driver's program rating sets the level. */
const THERMALLY_LIMITED = "Thermally limited";

// s: { subSize, subBox, portStyle, cVent, PT, subLbLoaded, lim, peakXF, aes, ampW }
export function subChips(s: SubChipsInput): Chip<ChipId<"sub">>[] {
  const { subSize, subDepthIn, subBox, portStyle, cVent, PT, subLbLoaded, lim, peakXF, aes, ampW } =
    s;
  const sub = { size: subSize, depthIn: subDepthIn };
  const F: Chip<ChipId<"sub">>[] = [];
  const need = subDriverClearanceNeededIn(subSize);
  const { clearW, clearH } = driverClearance(subBox, portStyle, cVent, PT);
  if (Math.min(clearW, clearH) < need)
    F.push([
      "bad",
      DRIVER_WONT_FIT,
      `The driver needs about ${need.toFixed(1)}″ of clear baffle. The vents leave ${clearW.toFixed(1)}″ × ${clearH.toFixed(1)}″.`,
      "subDriverFit",
    ]);
  const { fit, spans, ways } = ductFit(subBox, portStyle, cVent, PT, sub);
  if (cVent.len > fit)
    F.push([
      "bad",
      DUCT_TOO_LONG,
      `${cVent.len.toFixed(1)}″ does not fit. This layout holds about ${fit.toFixed(1)}″` +
        (portStyle === "slots"
          ? ", folded up the back wall."
          : isRoundPort(portStyle) && ways.length > 1
            ? `, with ${ways.length === 2 ? "an elbow" : "two elbows"}.`
            : "."),
      "subDuctFit",
    ]);
  else if (!ductFits(spans, cVent.len)) {
    // in a gap: the longest way short of it and the shortest past it
    const below = ways.filter(({ span }) => span[1] < cVent.len).at(-1),
      above = ways.find(({ span }) => span[0] > cVent.len);
    F.push([
      "bad",
      DUCT_TOO_LONG,
      `${cVent.len.toFixed(1)}″ is past the ${(below?.span[1] ?? 0).toFixed(1)}″ ${below?.what ?? "the duct"} holds ` +
        `but short of the ${(above?.span[0] ?? fit).toFixed(1)}″ ${above?.what ?? "the duct"} needs. Make it shorter or longer.`,
      "subDuctFit",
    ]);
  }
  if (isRoundPort(portStyle) && !tubeLayout(subBox, portStyle, cVent, PT, subSize).fits)
    F.push([
      "bad",
      TUBES_WONT_FIT,
      `${cVent.nt} × ${cVent.dia}″ flared tubes do not fit the baffle beside the driver. Use fewer or narrower tubes, or a wider box.`,
      "subTubeFit",
    ]);
  F.push(
    subLbLoaded > 125
      ? [
          "warn",
          "Over 125 lb",
          `${subLbLoaded.toFixed(0)} lb loaded. This is more than one person can lift.`,
          "subWeight",
        ]
      : ["ok", "Inside 125 lb", `${subLbLoaded.toFixed(0)} lb loaded.`, "subWeight"],
  );
  F.push(
    lim.who === "port"
      ? [
          "warn",
          "Port-limited",
          `The vent chokes at ${Math.round(lim.W)} W, below the driver's ${2 * aes} W program rating. Make the port larger or longer.`,
          "subPortLimited",
        ]
      : lim.who === "Xmax"
        ? [
            "warn",
            "Excursion-limited",
            `The cone reaches Xmax at ${Math.round(lim.W)} W (first at ${peakXF.toFixed(0)} Hz), below the ${2 * aes} W program rating. Use a bigger box or a higher tuning. A bigger port does not help.`,
            "subExcursionLimited",
          ]
        : lim.who === "amp"
          ? [
              "warn",
              "Amp-limited",
              `The ${ampW} W amp reaches its limit before the port, the cone or the ${2 * aes} W program rating (2 × ${aes} W AES).`,
              "subAmpLimited",
            ]
          : [
              "ok",
              THERMALLY_LIMITED,
              `Reaches its ${2 * aes} W program rating (2 × ${aes} W AES) before the port or the cone reaches its limit.`,
              "subThermalLimited",
            ],
  );
  return F;
}

// s: { midSize, midDims, Qtc, f3, peakX, xoLo, ts (Xmax, aes), V (amp volts), useV, vTherm, mAmpW,
//      subMusicAtXo (dB or null), tilt, midAtXo ({spl, who} of the mid max curve at xoLo) }
export function midChips(s: MidChipsInput): Chip<ChipId<"mid">>[] {
  const {
    midSize,
    midDims,
    Qtc,
    f3,
    peakX,
    xoLo,
    ts,
    V,
    useV,
    vTherm,
    mAmpW,
    subMusicAtXo,
    tilt,
    midAtXo,
  } = s;
  const F: Chip<ChipId<"mid">>[] = [];
  const need = midSize + 1.2;
  if (Math.min(midDims.w, midDims.h) < need)
    F.push([
      "bad",
      DRIVER_WONT_FIT,
      `A ${midSize}″ driver needs about ${need.toFixed(1)}″ of baffle; the smallest face is ${Math.min(midDims.w, midDims.h)}″.`,
      "midDriverFit",
    ]);
  F.push(
    Qtc > 0.8
      ? [
          "warn",
          `Qtc ${Qtc.toFixed(2)}`,
          "Peaky and loose. The box is small for this driver.",
          "midQtc",
        ]
      : Qtc < 0.5
        ? [
            "warn",
            `Qtc ${Qtc.toFixed(2)}`,
            "Very damped. This is fine above the crossover, but a smaller box also works.",
            "midQtc",
          ]
        : ["ok", `Qtc ${Qtc.toFixed(2)}`, "Well damped.", "midQtc"],
  );
  if (f3 > xoLo)
    F.push([
      "warn",
      "Rolls off above the crossover",
      `The box is 3 dB down at ${f3.toFixed(0)} Hz, above the ${xoLo} Hz crossover. Raise the crossover or add volume.`,
      "midRollOff",
    ]);
  const xPct = ((peakX * useV) / V / ts.Xmax) * 100;
  F.push(
    xPct > 100
      ? [
          "warn",
          "Excursion-limited",
          `The cone reaches Xmax at ${Math.round(Math.pow((V * 100) / ((peakX / ts.Xmax) * 100), 2) / 8)} W, below ${vTherm < V ? `its ${2 * ts.aes} W program rating` : `the ${mAmpW} W amp`}. Raise the crossover.`,
          "midExcursionLimited",
        ]
      : vTherm < V
        ? [
            "ok",
            THERMALLY_LIMITED,
            `Reaches its ${2 * ts.aes} W program rating (2 × ${ts.aes} W AES) before Xmax. The ${mAmpW} W amp has more power than it can use.`,
            "midThermalLimited",
          ]
        : [
            "ok",
            "Amp-limited",
            `The ${mAmpW} W amp reaches its limit before Xmax or the ${2 * ts.aes} W program rating.`,
            "midAmpLimited",
          ],
  );
  if (subMusicAtXo != null && midAtXo) {
    const needDb = subMusicAtXo - tilt,
      m = midAtXo,
      gap = m.spl - needDb;
    // amp power that would close the gap, if the amp is what's short
    const wNeed = Math.pow(V * Math.pow(10, -gap / 20), 2) / 8;
    F.push(
      gap < -KEEP_UP_SLACK_DB
        ? [
            "warn",
            "Mid reaches its limit first",
            `${(-gap).toFixed(1)} dB short at ${xoLo} Hz of the sub at its music limit, less ${tilt} dB for the mid band. ` +
              (m.who === "amp"
                ? wNeed <= 2 * ts.aes
                  ? `About ${Math.ceil(wNeed / 25) * 25} W per mid channel is enough.`
                  : "More amp power does not help. The driver reaches its program rating first."
                : m.who === "thermal"
                  ? "Use a driver with more power handling, or a higher crossover."
                  : "Use a higher crossover, or a driver with more excursion."),
            "midKeepsUp",
          ]
        : [
            "ok",
            "Keeps up with the sub",
            `${gap.toFixed(1)} dB to spare at ${xoLo} Hz against the sub at its music limit, less ${tilt} dB for the mid band.` +
              (m.who === "amp" && gap > 1
                ? ` About ${Math.max(25, Math.ceil(wNeed / 25) * 25)} W per mid channel is still enough.`
                : ""),
            "midKeepsUp",
          ],
    );
  }
  return F;
}

// s: { hf, hz, horn, xoHi, hornModel, hfAmpW, midAtXoHi (dB or null), hfTilt, hornAtXo (dB), midBeam (deg or null), fK (Hz or null) }
export function hornChips(s: HornChipsInput): Chip<ChipId<"horn">>[] {
  const { hf, hz, horn, xoHi, hornModel, hfAmpW, midAtXoHi, hfTilt, hornAtXo, midBeam, fK } = s;
  const F: Chip<ChipId<"horn">>[] = [];
  if (hf.minXo && xoHi < hf.minXo)
    F.push([
      "warn",
      "Below the driver's minimum crossover",
      `${xoHi} Hz, below the ${hf.minXo} Hz minimum. Power is derated and distortion increases. Measure before you use it.`,
      "hornDriverMinXo",
    ]);
  if (hz.minXo && xoHi < hz.minXo)
    F.push([
      "warn",
      "Below the horn's crossover range",
      `${horn.name} is specified from about ${hz.minXo} Hz.`,
      "hornMinXo",
    ]);
  if (hz.lowHz && hz.lowHz > xoHi * 0.8)
    F.push([
      "warn",
      "Horn stops loading near the crossover",
      `Horn loading decreases below about ${hz.lowHz} Hz. The driver works harder at the crossover.`,
      "hornLoading",
    ]);
  F.push(
    hornModel.who === "amp"
      ? [
          "ok",
          "Amp-limited",
          `${Math.round(hornModel.pAmp)} W into ${hornModel.imp} Ω from the ${hfAmpW} W amp, under the ${Math.round(hornModel.pProg)} W program limit${hornModel.derate < 1 ? " (derated for the low crossover)" : ""}.`,
          "hornAmpLimited",
        ]
      : [
          "ok",
          "Program-limited",
          `Capped at ${Math.round(hornModel.pProg)} W: 2 × ${hf.aes} W AES${hornModel.derate < 1 ? `, derated ${(-10 * Math.log10(hornModel.derate)).toFixed(1)} dB because ${xoHi} Hz is below the ${hf.aesXo} Hz the rating assumes` : ""}.`,
          "hornProgramLimited",
        ],
  );
  if (midAtXoHi != null && hornAtXo != null) {
    const need = midAtXoHi - hfTilt,
      gap = hornAtXo - need;
    const wNeed = hfAmpW * Math.pow(10, -gap / 10);
    F.push(
      gap < -KEEP_UP_SLACK_DB
        ? [
            "warn",
            "Horn reaches its limit first",
            `${(-gap).toFixed(1)} dB short at ${xoHi} Hz of the mid at its limit, less ${hfTilt} dB for the HF band. ` +
              (hornModel.who === "amp" && (wNeed * 8) / hornModel.imp <= hornModel.pProg
                ? `About ${Math.ceil(wNeed / 25) * 25} W per HF channel is enough.`
                : "The driver's rating is the limit. Raise the crossover or select a more sensitive driver."),
            "hornKeepsUp",
          ]
        : [
            "ok",
            "Keeps up with the mid",
            `${gap.toFixed(1)} dB to spare at ${xoHi} Hz against the mid, less ${hfTilt} dB for the HF band.`,
            "hornKeepsUp",
          ],
    );
  }
  if (midBeam && hz.covH && midBeam < hz.covH * 0.75)
    F.push([
      "warn",
      "Mid narrower than the horn at the crossover",
      `About ${Math.round(midBeam)}° against the horn's ${hz.covH}°. The mid already beams, so off-axis sound dips below the crossover. Use a lower crossover or a smaller mid.`,
      "hornMidNarrower",
    ]);
  if (fK && xoHi < fK * 0.85)
    F.push([
      "warn",
      "Horn wider than rated at the crossover",
      `${horn.name} holds ${hz.covH}° down to about ${Math.round(fK / 10) * 10} Hz (from its ${horn.size.w}″ mouth); at ${xoHi} Hz it spreads wider.`,
      "hornWiderThanRated",
    ]);
  if (midBeam && hz.covH && midBeam > hz.covH * 1.4)
    F.push([
      "warn",
      "Mid much wider than the horn at the crossover",
      `About ${Math.round(midBeam)}° against the horn's ${hz.covH}°. Off-axis energy drops through the crossover. Use a higher crossover or a wider horn. At this frequency, a 12″ is almost omnidirectional.`,
      "hornMidWider",
    ]);
  return F;
}

// s: { drv, dim, Fb (vented) | Qtc (sealed), hp, hpOrder, portLimited, portMax, f3, hf, hfLimW, ampW, pad }
export function fillChips(s: FillChipsInput): Chip<ChipId<"fill">>[] {
  const { drv, dim, Fb, Qtc, hp, hpOrder, portLimited, portMax, f3, hf, hfLimW, ampW, pad } = s;
  const F: Chip<ChipId<"fill">>[] = [];
  if (Math.min(dim.w, dim.h) < drv.size + 1)
    F.push([
      "bad",
      DRIVER_WONT_FIT,
      `An ${drv.size}″ coax needs about ${drv.size + 1}″ of baffle.`,
      "fillDriverFit",
    ]);
  if (Fb != null) {
    F.push(
      Fb < hp * 0.6
        ? [
            "warn",
            `Tuned low (${Fb.toFixed(0)} Hz)`,
            "Tuned well below the highpass, so the port does little. A shorter or wider port tunes higher.",
            "fillTuning",
          ]
        : [
            "ok",
            `Tuned to ${Fb.toFixed(0)} Hz`,
            `with a ${hp} Hz ${crossoverSlopeName(hpOrder)} highpass to the subs.`,
            "fillTuning",
          ],
    );
    if (portLimited)
      F.push([
        "warn",
        "Port-limited",
        `Port air speed reaches ${portMax} m/s somewhere below 300 Hz. Use a wider port.`,
        "fillPortLimited",
      ]);
  } else if (Qtc != null) {
    F.push(
      Qtc > 0.8
        ? ["warn", `Qtc ${Qtc.toFixed(2)}`, "Peaky. Use a bigger box or a vent.", "fillQtc"]
        : Qtc < 0.5
          ? [
              "warn",
              `Qtc ${Qtc.toFixed(2)}`,
              "Very damped, so it rolls off early. This driver suits a vented box.",
              "fillQtc",
            ]
          : ["ok", `Qtc ${Qtc.toFixed(2)}`, "Well damped.", "fillQtc"],
    );
  }
  F.push(
    f3 <= 85
      ? [
          "ok",
          "Some kick",
          `${f3.toFixed(0)} Hz −3 dB with the highpass. The fill gives part of the kick fundamental (50–70 Hz); the subs give the rest.`,
          "fillKick",
        ]
      : [
          "warn",
          "Little kick",
          `${f3.toFixed(0)} Hz −3 dB. The fill gives the kick's attack; the subs give its body.`,
          "fillKick",
        ],
  );
  if (hf && hfLimW != null)
    F.push(
      hfLimW < ampW
        ? [
            "warn",
            "HF limits first",
            `Through a ${pad.toFixed(0)} dB pad the HF reaches its ${2 * hf.aes} W program rating at about ${Math.round(hfLimW)} W of amp, under the ${ampW} W you've set.`,
            "fillHfHeadroom",
          ]
        : [
            "ok",
            "HF has headroom",
            `Through a ${pad.toFixed(0)} dB pad the HF only reaches its program rating at about ${Math.round(hfLimW)} W of amp.`,
            "fillHfHeadroom",
          ],
    );
  else
    F.push([
      "warn",
      "HF not modeled",
      "usspeaker does not publish the HF section's specs.",
      "fillHfUnmodeled",
    ]);
  return F;
}
