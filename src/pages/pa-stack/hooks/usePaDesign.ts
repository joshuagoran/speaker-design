import { useSubwooferDesign } from "./useSubwooferDesign";
import { useMidDesign } from "./useMidDesign";
import { useHornDesign } from "./useHornDesign";
import { useCrossovers } from "./useCrossovers";
import { useCabinetStyle } from "./useCabinetStyle";
import { useCutlistOptions } from "./useCutlistOptions";
import {
  SUB_OPTIONS,
  MID_OPTIONS,
  MID_BOXES,
  CD_OPTIONS,
  HORN_OPTIONS,
  midBoxesOfSize,
  midDriversOfSize,
} from "../../../lib/data";
import { byId } from "../../../lib/tables";
import { DEFAULT_MID_BY_SIZE, DEFAULT_PA } from "../../../lib/defaults";
import { paDispersionMap, firstNullAngleDeg } from "../../../lib/pa/dispersion";
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
} from "../../../lib/pa/calc";
import type {
  Dims3,
  DispersionPlane,
  FrequencyPoint,
  HifiDispersionMap,
  HornHf,
  HornResponse,
  MidBox,
  MidDriver,
  PaDesignConfig,
  PaMaxPoint,
  PaPortGeometry,
  MidSystemModelled,
  SubDriver,
  SubSystemModelled,
  VentGeometry,
} from "../../../types";
import type { CabinetStyle } from "./useCabinetStyle";
import type { Crossovers } from "./useCrossovers";
import type { CutlistOptions } from "./useCutlistOptions";
import type { HornDesign } from "./useHornDesign";
import type { MidDesign } from "./useMidDesign";
import type { SubwooferDesign } from "./useSubwooferDesign";
import { useEffect, useRef } from "react";

/** What `usePaDesign` returns: every design state and setter, plus the models and sizes derived from them. */
export interface PaDesign
  extends SubwooferDesign, MidDesign, HornDesign, Crossovers, CabinetStyle, CutlistOptions {
  /** the mid chamber's size: the tower layout fixes it to the sub's footprint */
  effectiveMidBoxDims: Dims3;
  midWithBox: MidDriver & { box: Dims3 };
  subDriverChoices: SubDriver[];
  midDriverChoices: MidDriver[];
  midBoxChoices: MidBox[];
  subBox: Dims3;
  subWithBox: SubDriver & { box: Dims3 };
  /** set by `restore` so the mid size effect leaves a restored config's driver and box alone */
  skipSizeReset: React.RefObject<boolean>;
  hornExitMismatch: boolean;
  /** plywood thickness, in */
  PT: number;
  port: VentGeometry;
  subGrossLiters: number;
  subNetLiters: number;
  subAmpVoltage: number;
  /** the sub's model, music limit and curves; null when the driver has no T/S or the box or vent can't be modelled */
  subModelled:
    | (Pick<SubSystemModelled, "mdl" | "lim"> & {
        /** the most a sine can play at each frequency */
        maxCurve: PaMaxPoint[];
        /** the sub through its lowpass at the crossover, for the system chart */
        throughLowpass: FrequencyPoint[];
      })
    | null;
  midVoltage: number;
  midGrossL: number;
  midNetL: number;
  midEffL: number;
  /** the mid's model and limit curve; null when the driver has no T/S */
  midModelled: MidSystemModelled | null;
  midThermalVoltage: number;
  midUsedVoltage: number;
  midCabinetLb: number;
  midWeightLoadedLb: number;
  hornSpec: Partial<HornHf>;
  hornModel: HornResponse | null;
  midBeamWidthDeg: number | null;
  /** beamwidth in degrees against frequency for the mid and the horn, and the horn's pattern-control frequency */
  beamCurves: { midB: FrequencyPoint[]; hornB: FrequencyPoint[]; fK: number | null };
  subMusicAtCrossover: number | null;
  portGeom: PaPortGeometry;
  snapshot: () => PaDesignConfig;
  /** loads a saved or optimizer design; fields an older config lacks keep their defaults */
  restore: (c: Partial<PaDesignConfig>) => void;
  subWeightLoadedLb: number;
  midBoxLiters: number;
  subTopHeightIn: number;
  isTower: boolean;
  stackBaseHeightIn: number;
  hasArchedTop: boolean;
  stackHeightIn: number;
  hornCenterHeightIn: number;
  midCenterHeightIn: number;
  dispersionMapDistanceM: number;
  paDispersion: HifiDispersionMap | null;
  midHornGapIn: number;
  midHornNullAngleDeg: number | null;
}

/** The whole PA design: every part and dimension, the models derived from them, and snapshot/restore for saved configurations. */
export function usePaDesign({ dispersionPlane }: { dispersionPlane: DispersionPlane }): PaDesign {
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
  const midDriverChoices = midDriversOfSize(midSize);
  const midBoxChoices = midBoxesOfSize(midSize);
  const subBox = subBoxDims;
  const subWithBox = { ...subDriver, box: subBox };
  /** Switching 12/15 picks that size's default driver and box; restoring a config sets them itself. */
  const skipSizeReset = useRef(true);
  useEffect(() => {
    if (skipSizeReset.current) {
      skipSizeReset.current = false;
      return;
    }
    const start = DEFAULT_MID_BY_SIZE[midSize];
    if (start) {
      setMidDriver(start.mid);
      setMidBoxPreset(start.midBox);
      setMidBoxDims({ ...start.midBox.box });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [midSize]);
  const hornExitMismatch = hornOption.exit !== compressionDriver.exit;

  /**
   * Port geometry, matching what the 3D view draws, so the table and the
   * model describe the same box.
   */
  const PT = wallThicknessIn;
  const subSys = subSystem(subDriver, midDriver, {
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
  const { port, grossL: subGrossLiters, netL: subNetLiters, AMP_V: subAmpVoltage } = subSys;
  const subModelled = subSys.mdl
    ? {
        mdl: subSys.mdl,
        lim: subSys.lim,
        /**
         * Max SPL for a sine at each frequency (each frequency meets its own port and excursion limits);
         * the broadband limit (`lim`) is what applies to music.
         */
        maxCurve: maxCurveOf(subSys.mdl.curve, subDriver.ts, subAmpVoltage, maxPortAirSpeedMs),
        /** Sub through its lowpass at the crossover, for the system chart. Its own limits scale with the filter. */
        throughLowpass: subThroughLowpass(
          subSys.mdl,
          subDriver.ts,
          subAmpVoltage,
          maxPortAirSpeedMs,
          subMidCrossoverHz,
        ),
      }
    : null;

  // ---- mid-bass: sealed box ----
  const midSys = midSystem(midDriver, {
    midDims: effectiveMidBoxDims,
    wall: wallThicknessIn,
    inset: baffleInsetIn,
    xoLo: subMidCrossoverHz,
    xoHi: midHornCrossoverHz,
    mAmpW: midAmpWatts,
  });
  const {
    V: midVoltage,
    grossL: midGrossL,
    netL: midNetL,
    effL: midEffL,
    vTherm: midThermalVoltage,
    useV: midUsedVoltage,
  } = midSys;
  const midModelled = midSys.mdl ? midSys : null;
  /** 3/4" baffle at 2.3 lb/ft\u00b2, other panels and one brace at the chosen ply, plus 2 lb of hardware */
  const midCabinetLb = midWeightLb(effectiveMidBoxDims, wallThicknessIn);
  const midWeightLoadedLb = midCabinetLb + (midDriver.lb || 0);
  // ---- horn + compression driver ----
  /**
   * Datasheet model, not T/S: on-horn sensitivity + 10 log P, shaped by the LR24
   * highpass at the crossover and a 12 dB/oct rolloff below the horn's loading limit.
   * Power: amp voltage into the driver's impedance, capped at program (2 x AES), derated
   * 6 dB per octave when crossing below the frequency the AES rating was measured at.
   */
  const hornSpec: Partial<HornHf> = hornOption.hf || {};
  const hornModel = hornResponse(compressionDriver.hf, hornSpec, midHornCrossoverHz, hornAmpWatts);
  /** mid beamwidth at the horn crossover, as a rigid piston: -6 dB where ka sin(theta) = 2.2 */
  const midBeamWidthDeg = midDriver.ts
    ? pistonBeamWidthDeg(midDriver.ts.Sd, midHornCrossoverHz)
    : null;
  /**
   * Horizontal beamwidth against frequency: mid as a rigid piston, horn at its rated coverage down
   * to Keele's pattern-control limit and proportionally wider below. Rules of thumb.
   */
  const beamCurves = (() => {
    const hf = hornOption.hf;
    const fK = hf && hf.covH && hornOption.size ? keeleFrequency(hf.covH, hornOption.size.w) : null;
    const midB: FrequencyPoint[] = [],
      hornB: FrequencyPoint[] = [];
    for (let i = 0; i < 160; i++) {
      const f = 200 * Math.pow(10000 / 200, i / 159);
      if (midDriver.ts) midB.push({ f, spl: pistonBeamWidthDeg(midDriver.ts.Sd, f) });
      if (hf && fK && f >= (hf.lowHz || 0) * 0.7)
        hornB.push({ f, spl: hornBeamWidthDeg(hf.covH, fK, f) });
    }
    return { midB, hornB, fK };
  })();

  /**
   * What the mid actually has to match: the sub at its music limit (one drive level for the whole
   * band), through its lowpass, less the music-balance allowance.
   */
  const subMusicAtCrossover = subModelled
    ? subMusicOutputAt(subModelled.mdl, subModelled.lim, subAmpVoltage, subMidCrossoverHz)
    : null;

  const portGeom = {
    ductH: subVentSpec.slotH,
    nPorts: subVentSpec.nt,
    portR: subVentSpec.dia / 2,
    tubeLen: subVentSpec.len,
    throat: subVentSpec.throat,
  };

  /** One named snapshot of the whole system. */
  const snapshot = (): PaDesignConfig => ({
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
    summary: `${subDriver.name} · ${subBox.w}×${subBox.h}×${subBox.d}″ · ${port.area.toFixed(0)} in² · ${subModelled ? subModelled.mdl.Fb.toFixed(1) + " Hz" : "—"}`,
  });
  const restore = (c: Partial<PaDesignConfig>) => {
    if (c.wall === 0.5 || c.wall === 0.75) setWallThicknessIn(c.wall);
    else setWallThicknessIn(DEFAULT_PA.wall);
    setBaffleInsetIn(typeof c.inset === "number" ? c.inset : DEFAULT_PA.inset);
    if (c.sub) setSubDriver(byId(SUB_OPTIONS, c.sub) ?? subDriver);
    if (c.mid) {
      const m = byId(MID_OPTIONS, c.mid) ?? midDriver;
      skipSizeReset.current = (m.size || 12) !== midSize;
      setMidSize(m.size || 12);
      setMidDriver(m);
    }
    if (c.midBox) setMidBoxPreset(byId(MID_BOXES, c.midBox) ?? midBoxPreset);
    if (c.cd) setCompressionDriver(byId(CD_OPTIONS, c.cd) ?? compressionDriver);
    if (c.horn) setHornOption(byId(HORN_OPTIONS, c.horn) ?? hornOption);
    if (c.cDim) setSubBoxDims(c.cDim);
    if (c.cVent) setSubVentSpec(c.cVent);
    if (typeof c.hpf === "number") setSubHighpassHz(c.hpf);
    if (c.hpType && HIGHPASS_ALIGNMENTS[c.hpType]) setSubHighpassType(c.hpType);
    if (typeof c.ampW === "number") setSubAmpWatts(c.ampW);
    if (typeof c.portMax === "number") setMaxPortAirSpeedMs(c.portMax);
    if (c.mDim) setMidBoxDims(c.mDim);
    else if (c.midBox) {
      const b = byId(MID_BOXES, c.midBox);
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
    setCabinetFinish(c.cabFinish || DEFAULT_PA.cabFinish);
    setSpacerHeightIn(typeof c.spacerH === "number" ? c.spacerH : DEFAULT_PA.spacerH);
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
    subModelled,
    midVoltage,
    midGrossL,
    midNetL,
    midEffL,
    midModelled,
    midThermalVoltage,
    midUsedVoltage,
    midCabinetLb,
    midWeightLoadedLb,
    hornSpec,
    hornModel,
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
