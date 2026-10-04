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
import { isRoundPort } from "./calc";
import { SLOT_LAYOUT_NAMES } from "../../constants/portStyles";

// Longest duct each layout can hold, leaving an opening at least as wide as the duct.
export function ductFit(subBox: Dims3, portStyle: PortStyle, cVent: VentSpec, PT: number) {
  const inD = subBox.d - PT,
    inH = subBox.h - 2 * PT,
    sH = cVent.slotH;
  const maxStraight = inD - sH; // bottom slot
  const maxFold = inD - (sH + PT) + sH / 2 + (inH - sH - 1); // floor run + rise up the back
  const maxSide = inD - cVent.throat; // side ducts
  const maxTube = subBox.d - 0.75 - 2 * PT - cVent.dia / 2; // round tubes off the baffle
  const fit =
    portStyle === "slots"
      ? maxStraight
      : portStyle === "folded"
        ? maxFold
        : isRoundPort(portStyle)
          ? maxTube
          : maxSide;
  return { maxStraight, maxFold, maxSide, maxTube, fit };
}
// Clear baffle a driver needs: the sub's cone plus its frame.
export const subDriverClearanceNeededIn = (subSize: number) => subSize + 1.9;
export function driverClearance(subBox: Dims3, portStyle: PortStyle, cVent: VentSpec, PT: number) {
  const nSide = portStyle === "vslot1" ? 1 : portStyle === "vslots" ? 2 : 0;
  return {
    clearW: subBox.w - nSide * (cVent.throat + 0.43 + PT),
    clearH: subBox.h - (portStyle === "slots" || portStyle === "folded" ? cVent.slotH + PT : 0),
  };
}

/** How far a band may fall short of the band below at their crossover before its chip says it runs out first, dB. */
export const KEEP_UP_SLACK_DB = 0.5;

/** The title the sub, mid and fill share for a driver its baffle has no room for. */
const DRIVER_WONT_FIT = "Driver won't fit";
/** The title the sub and mid share when the driver's program rating sets the level. */
const THERMALLY_LIMITED = "Thermally limited";

// s: { subSize, subBox, portStyle, cVent, PT, subLbLoaded, lim, peakXF, aes, ampW }
export function subChips(s: SubChipsInput): Chip<ChipId<"sub">>[] {
  const { subSize, subBox, portStyle, cVent, PT, subLbLoaded, lim, peakXF, aes, ampW } = s;
  const F: Chip<ChipId<"sub">>[] = [];
  const need = subDriverClearanceNeededIn(subSize);
  const { clearW, clearH } = driverClearance(subBox, portStyle, cVent, PT);
  if (Math.min(clearW, clearH) < need)
    F.push([
      "bad",
      DRIVER_WONT_FIT,
      `The baffle needs about ${need.toFixed(1)}″ clear; after the vents it has ${clearW.toFixed(1)}″ × ${clearH.toFixed(1)}″.`,
      "subDriverFit",
    ]);
  const { maxFold, fit } = ductFit(subBox, portStyle, cVent, PT);
  if (cVent.len > fit)
    F.push([
      "bad",
      "Duct too long",
      `${cVent.len.toFixed(1)}″ won't fit; this layout holds about ${fit.toFixed(1)}″.` +
        (portStyle === "slots" && cVent.len <= maxFold
          ? ` Switch to ${SLOT_LAYOUT_NAMES.folded}.`
          : ""),
      "subDuctFit",
    ]);
  F.push(
    subLbLoaded > 125
      ? [
          "warn",
          "Over 125 lb",
          `${subLbLoaded.toFixed(0)} lb loaded. Past the one-person lift limit.`,
          "subWeight",
        ]
      : ["ok", "Inside 125 lb", `${subLbLoaded.toFixed(0)} lb loaded.`, "subWeight"],
  );
  F.push(
    lim.who === "port"
      ? [
          "warn",
          "Port-limited",
          `The vent chokes at ${Math.round(lim.W)} W, below the driver's ${2 * aes} W program rating. Open the port up or lengthen it.`,
          "subPortLimited",
        ]
      : lim.who === "Xmax"
        ? [
            "warn",
            "Excursion-limited",
            `The cone reaches Xmax at ${Math.round(lim.W)} W (first at ${peakXF.toFixed(0)} Hz), below the ${2 * aes} W program rating. A bigger box or higher tuning helps; a bigger port does not.`,
            "subExcursionLimited",
          ]
        : lim.who === "amp"
          ? [
              "warn",
              "Amp-limited",
              `The ${ampW} W amp runs out before the port, the cone or the driver's ${2 * aes} W program rating (2 × ${aes} W AES).`,
              "subAmpLimited",
            ]
          : [
              "ok",
              THERMALLY_LIMITED,
              `Reaches its ${2 * aes} W program rating (2 × ${aes} W AES) before the port or the cone gives out.`,
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
          "Peaky and loose; the box is small for this driver.",
          "midQtc",
        ]
      : Qtc < 0.5
        ? [
            "warn",
            `Qtc ${Qtc.toFixed(2)}`,
            "Very damped. Fine above the crossover, but the box could be smaller.",
            "midQtc",
          ]
        : ["ok", `Qtc ${Qtc.toFixed(2)}`, "Well damped.", "midQtc"],
  );
  if (f3 > xoLo)
    F.push([
      "warn",
      "Rolls off above the crossover",
      `The box is 3 dB down at ${f3.toFixed(0)} Hz, above the ${xoLo} Hz crossover. Raise the crossover or use more volume.`,
      "midRollOff",
    ]);
  const xPct = ((peakX * useV) / V / ts.Xmax) * 100;
  F.push(
    xPct > 100
      ? [
          "warn",
          "Excursion-limited",
          `The cone reaches Xmax at ${Math.round(Math.pow((V * 100) / ((peakX / ts.Xmax) * 100), 2) / 8)} W, below ${vTherm < V ? `its ${2 * ts.aes} W program rating` : `the ${mAmpW} W amp`}. A higher crossover helps.`,
          "midExcursionLimited",
        ]
      : vTherm < V
        ? [
            "ok",
            THERMALLY_LIMITED,
            `Reaches its ${2 * ts.aes} W program rating (2 × ${ts.aes} W AES) before Xmax; the ${mAmpW} W amp has more than it can use.`,
            "midThermalLimited",
          ]
        : [
            "ok",
            "Amp-limited",
            `The ${mAmpW} W amp runs out before Xmax or the ${2 * ts.aes} W program rating.`,
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
            "Mid runs out first",
            `${(-gap).toFixed(1)} dB short at ${xoLo} Hz of the sub at its music limit, less ${tilt} dB for the mid band. ` +
              (m.who === "amp"
                ? wNeed <= 2 * ts.aes
                  ? `About ${Math.ceil(wNeed / 25) * 25} W per mid channel would cover it.`
                  : "More amp won't get there: it passes the driver's program rating first."
                : m.who === "thermal"
                  ? "A driver with more power handling, or a higher crossover."
                  : "A higher crossover or a driver with more excursion."),
            "midKeepsUp",
          ]
        : [
            "ok",
            "Keeps up with the sub",
            `${gap.toFixed(1)} dB to spare at ${xoLo} Hz against the sub at its music limit, less ${tilt} dB for the mid band.` +
              (m.who === "amp" && gap > 1
                ? ` About ${Math.max(25, Math.ceil(wNeed / 25) * 25)} W per mid channel would still cover it.`
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
      `${xoHi} Hz against ${hf.minXo} Hz recommended. Power is derated here and distortion rises; check measurements before relying on it.`,
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
      `Loading falls away below about ${hz.lowHz} Hz, so the driver works harder right where it's crossed.`,
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
            "Horn runs out first",
            `${(-gap).toFixed(1)} dB short at ${xoHi} Hz of the mid at its limit, less ${hfTilt} dB for the HF band. ` +
              (hornModel.who === "amp" && (wNeed * 8) / hornModel.imp <= hornModel.pProg
                ? `About ${Math.ceil(wNeed / 25) * 25} W per HF channel would cover it.`
                : "The driver's rating is the limit: raise the crossover or pick a more sensitive driver."),
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
      `About ${Math.round(midBeam)}° against the horn's ${hz.covH}°: the mid is already beaming, so off-axis sound dips just below the crossover. A lower crossover or a smaller mid meets the horn.`,
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
      `About ${Math.round(midBeam)}° against the horn's ${hz.covH}°: off-axis energy steps down through the crossover. A higher crossover narrows the mid, a wider horn meets it; a 12″ at this frequency is still close to omnidirectional.`,
      "hornMidWider",
    ]);
  return F;
}

// s: { drv, dim, Fb (vented) | Qtc (sealed), hp, portLimited, portMax, f3, hf, hfLimW, ampW, pad }
export function fillChips(s: FillChipsInput): Chip<ChipId<"fill">>[] {
  const { drv, dim, Fb, Qtc, hp, portLimited, portMax, f3, hf, hfLimW, ampW, pad } = s;
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
            "Well below the highpass: the port does little. A shorter or wider port tunes higher.",
            "fillTuning",
          ]
        : [
            "ok",
            `Tuned to ${Fb.toFixed(0)} Hz`,
            `with a ${hp} Hz LR24 highpass to the subs.`,
            "fillTuning",
          ],
    );
    if (portLimited)
      F.push([
        "warn",
        "Port-limited",
        `Port air speed reaches ${portMax} m/s somewhere below 300 Hz; a wider port helps.`,
        "fillPortLimited",
      ]);
  } else if (Qtc != null) {
    F.push(
      Qtc > 0.8
        ? ["warn", `Qtc ${Qtc.toFixed(2)}`, "Peaky; a bigger box or a vent.", "fillQtc"]
        : Qtc < 0.5
          ? [
              "warn",
              `Qtc ${Qtc.toFixed(2)}`,
              "Very damped: rolls off early. Good driver for a vented box.",
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
          `${f3.toFixed(0)} Hz −3 dB with the highpass; the kick fundamental (50–70 Hz) is partly there and the subs fill the rest.`,
          "fillKick",
        ]
      : [
          "warn",
          "Little kick",
          `${f3.toFixed(0)} Hz −3 dB; the kick's attack comes through but its body is all subs.`,
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
      "HF not modelled",
      "The HF section's specs aren't published on usspeaker.",
      "fillHfUnmodelled",
    ]);
  return F;
}
