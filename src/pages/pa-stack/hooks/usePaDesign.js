import { useSubwooferDesign } from "./useSubwooferDesign.js";
import { useMidDesign } from "./useMidDesign.js";
import { useHornDesign } from "./useHornDesign.js";
import { useCrossovers } from "./useCrossovers.js";
import { useCabinetStyle } from "./useCabinetStyle.js";
import { useCutlistOptions } from "./useCutlistOptions.js";
import {
  SUB_OPTIONS,
  MID_OPTIONS,
  MID_BOXES,
  CD_OPTIONS,
  HORN_OPTIONS,
} from "../../../lib/data.ts";
import { paDispersionMap, firstNullAngleDeg } from "../../../lib/pa/dispersion.js";
import {
  subSystem,
  maxOutputCurve as maxCurveOf,
  hornResponse,
  pistonBeamWidthDeg,
  keeleFrequency,
  hornBeamWidthDeg,
  subWeightLb,
  midWeightLb,
  HIGHPASS_ALIGNMENTS,
  midSystem,
  subThroughLowpass,
  subMusicOutputAt,
} from "../../../lib/pa/calc.js";
import { useEffect, useRef } from "react";

/** The whole PA design: every part and dimension, the models derived from them, and snapshot/restore for saved configurations. */
export function usePaDesign({ dispersionPlane }) {
  const {
    subDriver,
    setSubDriver,
    portStyle,
    setPortStyle,
    subBoxDims,
    setSubBoxDims,
    subVentSpec,
    setSubVentSpec,
    subHighpassHz,
    setSubHighpassHz,
    subHighpassType,
    setSubHighpassType,
    subAmpWatts,
    setSubAmpWatts,
    maxPortAirSpeedMs,
    setMaxPortAirSpeedMs,
    setSubBoxDim,
    setSubVentField,
  } = useSubwooferDesign();
  const {
    midDriver,
    setMidDriver,
    midBoxPreset,
    setMidBoxPreset,
    midBoxDims,
    setMidBoxDims,
    midAmpWatts,
    setMidAmpWatts,
    midBandTiltDb,
    setMidBandTiltDb,
    setMidBoxDim,
    midSize,
    setMidSize,
  } = useMidDesign();
  const {
    hornOption,
    setHornOption,
    compressionDriver,
    setCompressionDriver,
    hornAmpWatts,
    setHornAmpWatts,
    hornBandTiltDb,
    setHornBandTiltDb,
  } = useHornDesign();
  const { subMidCrossoverHz, setSubMidCrossoverHz, midHornCrossoverHz, setMidHornCrossoverHz } =
    useCrossovers();
  const {
    plinthHeightIn,
    cutaway,
    setCutaway,
    cabinet,
    layout,
    setLayout,
    format,
    wallThicknessIn,
    setWallThicknessIn,
    baffleInsetIn,
    setBaffleInsetIn,
    baffleColor,
    setBaffleColor,
    cabinetFinish,
    setCabinetFinish,
    spacerHeightIn,
    setSpacerHeightIn,
  } = useCabinetStyle();
  const {
    cornerJoint,
    setCornerJoint,
    plywoodSheetKind,
    setPlywoodSheetKind,
    boxSetCount,
    setBoxSetCount,
  } = useCutlistOptions();
  /** In the tower layout the mid chamber is the sub's footprint, 15.5 in tall. */
  const effectiveMidBoxDims =
    layout === "tower" ? { w: subBoxDims.w, h: 15.5, d: subBoxDims.d } : midBoxDims;
  const midWithBox = { ...midDriver, box: effectiveMidBoxDims };
  const subDriverChoices = SUB_OPTIONS.filter((o) => o.size === format.sub);
  const midDriverChoices = MID_OPTIONS.filter((o) => (o.size || 12) === midSize);
  const midBoxChoices = MID_BOXES.filter((b) => (b.size || 12) === midSize && b.id !== "b13");
  const subBox = subBoxDims;
  const subWithBox = { ...subDriver, box: subBox };
  useEffect(() => {
    const pickOf = (list) => list.find((o) => o.pick) || list[0];
    if (subDriverChoices.length) setSubDriver(pickOf(subDriverChoices));
    if (midDriverChoices.length) setMidDriver(pickOf(midDriverChoices));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [format]);
  /** Switching 12/15 picks that size's default driver and box; restoring a config sets them itself. */
  const skipSizeReset = useRef(true);
  useEffect(() => {
    if (skipSizeReset.current) {
      skipSizeReset.current = false;
      return;
    }
    const pickOf = (list) => list.find((o) => o.pick) || list[0];
    if (midDriverChoices.length) setMidDriver(pickOf(midDriverChoices));
    if (midBoxChoices.length) {
      const b = pickOf(midBoxChoices);
      setMidBoxPreset(b);
      setMidBoxDims({ ...b.box });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [midSize]);
  const hornExitMismatch = hornOption.exit !== compressionDriver.exit;

  /**
   * Port geometry, matching what the 3D view draws, so the table and the
   * model describe the same box.
   */
  const PT = wallThicknessIn;
  const {
    port,
    grossL: subGrossLiters,
    netL: subNetLiters,
    AMP_V: subAmpVoltage,
    mdl: subModel,
    lim: subLimits,
  } = subSystem(subDriver, midDriver, {
    subBox,
    midDims: midBoxDims,
    wall: wallThicknessIn,
    inset: baffleInsetIn,
    portStyle,
    cVent: subVentSpec,
    hpf: subHighpassHz,
    hpType: subHighpassType,
    ampW: subAmpWatts,
    portMax: maxPortAirSpeedMs,
    layout,
  });
  /**
   * Max SPL for a sine at each frequency (each frequency meets its own port and excursion limits);
   * the broadband limit above is what applies to music.
   */
  const subMaxCurve = subModel
    ? maxCurveOf(subModel.curve, subDriver.ts, subAmpVoltage, maxPortAirSpeedMs)
    : null;
  const subMaxCurveNearest = (f) =>
    subMaxCurve.reduce((b, o) => (Math.abs(o.f - f) < Math.abs(b.f - f) ? o : b));

  // ---- mid-bass: sealed box ----
  const {
    V: midVoltage,
    grossL: midGrossL,
    netL: midNetL,
    effL: midEffL,
    mdl: midModel,
    vTherm: midThermalVoltage,
    max: midMaxCurve,
    useV: midUsedVoltage,
  } = midSystem(midDriver, {
    midDims: effectiveMidBoxDims,
    wall: wallThicknessIn,
    inset: baffleInsetIn,
    xoLo: subMidCrossoverHz,
    xoHi: midHornCrossoverHz,
    mAmpW: midAmpWatts,
  });
  /** 3/4" baffle at 2.3 lb/ft\u00b2, other panels and one brace at the chosen ply, plus 2 lb of hardware */
  const midCabinetLb = midWeightLb(effectiveMidBoxDims, wallThicknessIn);
  const midWeightLoadedLb = midCabinetLb + (midDriver.lb || 0);
  const midMaxCurveNearest = (f) =>
    midMaxCurve.reduce((b, o) => (Math.abs(o.f - f) < Math.abs(b.f - f) ? o : b));
  /** Sub through its lowpass at the crossover, for the system chart. Its own limits scale with the filter. */
  const subThroughLowpassCurve = subModel
    ? subThroughLowpass(subModel, subDriver.ts, subAmpVoltage, maxPortAirSpeedMs, subMidCrossoverHz)
    : null;
  // ---- horn + compression driver ----
  /**
   * Datasheet model, not T/S: on-horn sensitivity + 10 log P, shaped by the LR24
   * highpass at the crossover and a 12 dB/oct rolloff below the horn's loading limit.
   * Power: amp voltage into the driver's impedance, capped at program (2 x AES), derated
   * 6 dB per octave when crossing below the frequency the AES rating was measured at.
   */
  const compressionDriverSpec = compressionDriver.hf,
    hornSpec = hornOption.hf || {};
  const hornModel = hornResponse(compressionDriverSpec, hornSpec, midHornCrossoverHz, hornAmpWatts);
  const hornSplAt = (f) =>
    hornModel.curve.reduce((b, o) => (Math.abs(o.f - f) < Math.abs(b.f - f) ? o : b)).spl;
  /** mid beamwidth at the horn crossover, as a rigid piston: -6 dB where ka sin(theta) = 2.2 */
  const midBeamWidthDeg = midDriver.ts
    ? pistonBeamWidthDeg(midDriver.ts.Sd, midHornCrossoverHz)
    : null;
  /**
   * Horizontal beamwidth against frequency: mid as a rigid piston, horn at its rated coverage down
   * to Keele's pattern-control limit and proportionally wider below. Rules of thumb.
   */
  const beamCurves = (() => {
    const hz0 = hornOption.hf || {};
    const fK = hz0.covH && hornOption.size ? keeleFrequency(hz0.covH, hornOption.size.w) : null;
    const midB = [],
      hornB = [];
    for (let i = 0; i < 160; i++) {
      const f = 200 * Math.pow(10000 / 200, i / 159);
      if (midDriver.ts) midB.push({ f, spl: pistonBeamWidthDeg(midDriver.ts.Sd, f) });
      if (fK && f >= (hz0.lowHz || 0) * 0.7)
        hornB.push({ f, spl: hornBeamWidthDeg(hz0.covH, fK, f) });
    }
    return { midB, hornB, fK };
  })();

  /**
   * What the mid actually has to match: the sub at its music limit (one drive level for the whole
   * band), through its lowpass, less the music-balance allowance.
   */
  const subMusicAtCrossover =
    subModel && subLimits
      ? subMusicOutputAt(subModel, subLimits, subAmpVoltage, subMidCrossoverHz)
      : null;

  const portGeom = {
    ductH: subVentSpec.slotH,
    nPorts: subVentSpec.nt,
    portR: subVentSpec.dia / 2,
    tubeLen: subVentSpec.len,
    throat: subVentSpec.throat,
  };

  /** One named snapshot of the whole system. */
  const snapshot = () => ({
    format: format.id,
    sub: subDriver.id,
    mid: midDriver.id,
    midBox: midBoxPreset.id,
    cd: compressionDriver.id,
    horn: hornOption.id,
    cabinet: cabinet.id,
    portStyle,
    cDim: subBoxDims,
    cVent: subVentSpec,
    hpf: subHighpassHz,
    hpType: subHighpassType,
    ampW: subAmpWatts,
    portMax: maxPortAirSpeedMs,
    mDim: midBoxDims,
    wall: wallThicknessIn,
    inset: baffleInsetIn,
    xoLo: subMidCrossoverHz,
    xoHi: midHornCrossoverHz,
    mAmpW: midAmpWatts,
    tilt: midBandTiltDb,
    hfAmpW: hornAmpWatts,
    hfTilt: hornBandTiltDb,
    layout,
    cutaway,
    baffleColor,
    cabFinish: cabinetFinish,
    spacerH: spacerHeightIn,
    joint: cornerJoint,
    summary: `${subDriver.name} · ${subBox.w}×${subBox.h}×${subBox.d}″ · ${port.area.toFixed(0)} in² · ${subModel ? subModel.Fb.toFixed(1) + " Hz" : "—"}`,
  });
  const restore = (c) => {
    const find = (list, id, fb) => list.find((o) => o.id === id) || fb;
    if (c.wall === 0.5 || c.wall === 0.75) setWallThicknessIn(c.wall);
    else setWallThicknessIn(0.75);
    setBaffleInsetIn(typeof c.inset === "number" ? c.inset : 0.75);
    if (c.sub) setSubDriver(find(SUB_OPTIONS, c.sub, subDriver));
    if (c.mid) {
      const m = find(MID_OPTIONS, c.mid, midDriver);
      skipSizeReset.current = (m.size || 12) !== midSize;
      setMidSize(m.size || 12);
      setMidDriver(m);
    }
    if (c.midBox) setMidBoxPreset(find(MID_BOXES, c.midBox, midBoxPreset));
    if (c.cd) setCompressionDriver(find(CD_OPTIONS, c.cd, compressionDriver));
    if (c.horn) setHornOption(find(HORN_OPTIONS, c.horn, hornOption));
    if (c.cDim) setSubBoxDims(c.cDim);
    if (c.cVent) setSubVentSpec(c.cVent);
    if (typeof c.hpf === "number") setSubHighpassHz(c.hpf);
    if (c.hpType && HIGHPASS_ALIGNMENTS[c.hpType]) setSubHighpassType(c.hpType);
    if (typeof c.ampW === "number") setSubAmpWatts(c.ampW);
    if (typeof c.portMax === "number") setMaxPortAirSpeedMs(c.portMax);
    if (c.mDim) setMidBoxDims(c.mDim);
    else if (c.midBox) {
      const b = MID_BOXES.find((x) => x.id === c.midBox);
      if (b) setMidBoxDims({ ...b.box });
    }
    if (typeof c.xoLo === "number") setSubMidCrossoverHz(c.xoLo);
    if (typeof c.xoHi === "number") setMidHornCrossoverHz(c.xoHi);
    if (typeof c.mAmpW === "number") setMidAmpWatts(c.mAmpW);
    if (typeof c.tilt === "number") setMidBandTiltDb(c.tilt);
    if (typeof c.hfAmpW === "number") setHornAmpWatts(c.hfAmpW);
    if (typeof c.hfTilt === "number") setHornBandTiltDb(c.hfTilt);
    if (typeof c.cutaway === "boolean") setCutaway(c.cutaway);
    if (c.layout) setLayout(c.layout);
    if (c.baffleColor) setBaffleColor(c.baffleColor);
    setCabinetFinish(c.cabFinish || "birch");
    setSpacerHeightIn(typeof c.spacerH === "number" ? c.spacerH : 20);
    if (c.joint) setCornerJoint(c.joint);
    if (c.portStyle) setPortStyle(c.portStyle);
  };
  const subWeightLoadedLb = subWeightLb(subBox, wallThicknessIn, subDriver.lb);

  const midBoxLiters = midGrossL;
  const subTopHeightIn = plinthHeightIn + subBox.h;
  const isTower = layout === "tower";
  const stackBaseHeightIn =
    layout === "satellite"
      ? 34
      : layout === "pole"
        ? subTopHeightIn + spacerHeightIn
        : isTower
          ? subTopHeightIn
          : subTopHeightIn + 0.4;
  const hasArchedTop =
    isTower &&
    !!hornOption.profile &&
    !hornOption.scaleX &&
    subBox.w / 2 - 0.75 > hornOption.size.w / 2;
  const stackHeightIn = isTower
    ? stackBaseHeightIn + 15.5 + (hasArchedTop ? subBox.w - 0.75 : hornOption.size.h + 2)
    : stackBaseHeightIn + effectiveMidBoxDims.h + 1.2 + hornOption.size.h + 2;
  const hornCenterHeightIn = isTower
    ? stackBaseHeightIn + 15.5 + (hasArchedTop ? subBox.w / 2 - 0.75 : (hornOption.size.h + 2) / 2)
    : stackBaseHeightIn + effectiveMidBoxDims.h + 1.2 + 1 + hornOption.size.h / 2;
  /** driver heights for the dispersion map: mid centered in its box (or the tower's mid section), sub at its box center */
  const midCenterHeightIn = isTower
    ? stackBaseHeightIn + 15.5 / 2
    : stackBaseHeightIn + effectiveMidBoxDims.h / 2;
  const dispersionMapDistanceM = 10;
  const paDispersion =
    midDriver.ts && hornSpec.covH && hornOption.size
      ? paDispersionMap(
          {
            sub: subDriver.ts ? { zIn: plinthHeightIn + subBox.h / 2, Sd: subDriver.ts.Sd } : null,
            mid: { zIn: midCenterHeightIn, Sd: midDriver.ts.Sd },
            horn: {
              zIn: hornCenterHeightIn,
              covH: hornSpec.covH,
              covV: hornSpec.covV || hornSpec.covH,
              wIn: hornOption.size.w,
              hIn: hornOption.size.h,
            },
            xoLo: subMidCrossoverHz,
            xoHi: midHornCrossoverHz,
            order: 4,
          },
          dispersionPlane,
          dispersionMapDistanceM,
        )
      : null;
  const midHornGapIn = hornCenterHeightIn - midCenterHeightIn,
    midHornNullAngleDeg = firstNullAngleDeg(midHornGapIn, midHornCrossoverHz);
  return {
    subDriver,
    setSubDriver,
    portStyle,
    setPortStyle,
    subBoxDims,
    setSubBoxDims,
    subVentSpec,
    setSubVentSpec,
    subHighpassHz,
    setSubHighpassHz,
    subHighpassType,
    setSubHighpassType,
    subAmpWatts,
    setSubAmpWatts,
    maxPortAirSpeedMs,
    setMaxPortAirSpeedMs,
    setSubBoxDim,
    setSubVentField,
    midDriver,
    setMidDriver,
    midBoxPreset,
    setMidBoxPreset,
    midBoxDims,
    setMidBoxDims,
    midAmpWatts,
    setMidAmpWatts,
    midBandTiltDb,
    setMidBandTiltDb,
    setMidBoxDim,
    midSize,
    setMidSize,
    hornOption,
    setHornOption,
    compressionDriver,
    setCompressionDriver,
    hornAmpWatts,
    setHornAmpWatts,
    hornBandTiltDb,
    setHornBandTiltDb,
    subMidCrossoverHz,
    setSubMidCrossoverHz,
    midHornCrossoverHz,
    setMidHornCrossoverHz,
    plinthHeightIn,
    cutaway,
    setCutaway,
    cabinet,
    layout,
    setLayout,
    format,
    wallThicknessIn,
    setWallThicknessIn,
    baffleInsetIn,
    setBaffleInsetIn,
    baffleColor,
    setBaffleColor,
    cabinetFinish,
    setCabinetFinish,
    spacerHeightIn,
    setSpacerHeightIn,
    cornerJoint,
    setCornerJoint,
    plywoodSheetKind,
    setPlywoodSheetKind,
    boxSetCount,
    setBoxSetCount,
    effectiveMidBoxDims,
    midWithBox,
    subDriverChoices,
    midDriverChoices,
    midBoxChoices,
    subBox,
    subWithBox,
    skipSizeReset,
    hornExitMismatch,
    PT,
    port,
    subGrossLiters,
    subNetLiters,
    subAmpVoltage,
    subModel,
    subLimits,
    subMaxCurve,
    subMaxCurveNearest,
    midVoltage,
    midGrossL,
    midNetL,
    midEffL,
    midModel,
    midThermalVoltage,
    midMaxCurve,
    midUsedVoltage,
    midCabinetLb,
    midWeightLoadedLb,
    midMaxCurveNearest,
    subThroughLowpassCurve,
    compressionDriverSpec,
    hornSpec,
    hornModel,
    hornSplAt,
    midBeamWidthDeg,
    beamCurves,
    subMusicAtCrossover,
    portGeom,
    snapshot,
    restore,
    subWeightLoadedLb,
    midBoxLiters,
    subTopHeightIn,
    isTower,
    stackBaseHeightIn,
    hasArchedTop,
    stackHeightIn,
    hornCenterHeightIn,
    midCenterHeightIn,
    dispersionMapDistanceM,
    paDispersion,
    midHornGapIn,
    midHornNullAngleDeg,
  };
}
