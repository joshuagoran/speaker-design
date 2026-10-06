import {
  subSystem,
  ventSpeedLimit,
  maxOutputCurve as maxCurveOf,
  hornResponse,
  pistonBeamWidthDeg,
  keeleFrequency,
  hornBeamWidthDeg,
  subWeightLb,
  midWeightLb,
  midSystem,
  subBoxBracing,
  midBoxBracing,
  subThroughLowpass,
  subMusicOutputAt,
  phasedCurve,
  ductDividerIn,
} from "../../../lib/pa/calc";
import { paDispersionMap, firstNullAngleDeg } from "../../../lib/pa/dispersion";
import type {
  BandCurves,
  BoxBracing,
  Dims3,
  DispersionPlane,
  FrequencyPoint,
  HifiDispersionMap,
  HornHf,
  HornResponse,
  MidSystemModelled,
  PaMaxPoint,
  PaPortGeometry,
  PaStackGeometry,
  PhasedModel,
  SealedBoxModel,
  SubSystemModelled,
  VentedBoxModel,
  VentGeometry,
} from "../../../types";
import { stackHeights } from "../../../components/stack-view/stackHeights";
import type { CabinetStyle } from "./useCabinetStyle";
import type { Crossovers } from "./useCrossovers";
import type { HornDesign } from "./useHornDesign";
import type { MidDesign } from "./useMidDesign";
import type { SubwooferDesign } from "./useSubwooferDesign";
import { xmaxBandCurves } from "../../../lib/xmax";

/** The design state the PA models read; the music-balance tilts, finish, colours and cutlist options don't enter them. */
type PaDesignInputs = Pick<
  SubwooferDesign,
  | "subDriver"
  | "portStyle"
  | "subBoxDims"
  | "subVentSpec"
  | "subHighpassHz"
  | "subHighpassType"
  | "subAmpWatts"
  | "maxPortAirSpeedMs"
> &
  Pick<MidDesign, "midDriver" | "midBoxDims" | "midAmpWatts"> &
  Pick<HornDesign, "hornOption" | "compressionDriver" | "hornAmpWatts"> &
  Pick<
    Crossovers,
    "subMidCrossoverHz" | "midHornCrossoverHz" | "subMidCrossoverOrder" | "midHornCrossoverOrder"
  > &
  Pick<
    CabinetStyle,
    "plinthHeightIn" | "layout" | "baffleInsetIn" | "spacerHeightIn" | "braceStyle"
  > & {
    dispersionPlane: DispersionPlane;
    /** the walls' exact thickness, in (lib/panel) */
    wallThicknessIn: number;
  };

/** What the PA models and sizes work out from the design state. */
export interface PaDerivedDesign {
  /** the mid chamber's size: the tower layout fixes it to the sub's footprint */
  effectiveMidBoxDims: Dims3;
  port: VentGeometry;
  subGrossLiters: number;
  subNetLiters: number;
  /** the sub box's braces and ribs by rule, with its panels' resonances */
  subBracing: BoxBracing;
  /** the mid box's; null in the tower, whose mid chamber is part of the sub's cabinet */
  midBracing: BoxBracing | null;
  subAmpVoltage: number;
  /**
   * the sub's model (with the box's phase, for the coverage map), music limit and curves; null when the driver has no
   * T/S or the box or vent can't be modelled
   */
  subModelled:
    | (Pick<SubSystemModelled, "lim"> & {
        mdl: PhasedModel<VentedBoxModel>;
        /** the most a sine can play at each frequency */
        maxCurve: PaMaxPoint[];
        /** the sub through its lowpass at the crossover, for the system chart */
        throughLowpass: FrequencyPoint[];
        /** that curve at the ends of an estimated Xmax; null when the driver's Xmax is exact */
        throughLowpassBand: BandCurves<FrequencyPoint> | null;
      })
    | null;
  midVoltage: number;
  midGrossL: number;
  midNetL: number;
  midEffL: number;
  /** the mid's model (with the box's phase, for the coverage map) and limit curve; null when the driver has no T/S */
  midModelled: (Omit<MidSystemModelled, "mdl"> & { mdl: PhasedModel<SealedBoxModel> }) | null;
  /** the mid's limit curve at the ends of an estimated Xmax; null when its Xmax is exact or it has no model */
  midMaxBand: BandCurves<PaMaxPoint> | null;
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
  /** the stack the dispersion and coverage maps sum; null when the mid has no T/S or the horn no coverage */
  stackGeometry: PaStackGeometry | null;
  paDispersion: HifiDispersionMap | null;
  midHornGapIn: number;
  midHornNullAngleDeg: number | null;
}

/** The PA models (sub, mid, horn), beamwidths, dispersion map, weights and stack heights for a design. Pure in its inputs. */
export function derivePaDesign({
  subDriver,
  portStyle,
  subBoxDims,
  subVentSpec,
  subHighpassHz,
  subHighpassType,
  subAmpWatts,
  maxPortAirSpeedMs,
  midDriver,
  midBoxDims,
  midAmpWatts,
  hornOption,
  compressionDriver,
  hornAmpWatts,
  subMidCrossoverHz,
  midHornCrossoverHz,
  subMidCrossoverOrder,
  midHornCrossoverOrder,
  plinthHeightIn,
  layout,
  wallThicknessIn,
  braceStyle,
  baffleInsetIn,
  spacerHeightIn,
  dispersionPlane,
}: PaDesignInputs): PaDerivedDesign {
  const subBox = subBoxDims;
  /** In the tower layout the mid chamber is the sub's footprint, 15.5 in tall. */
  const effectiveMidBoxDims =
    layout === "tower" ? { w: subBoxDims.w, h: 15.5, d: subBoxDims.d } : midBoxDims;
  const subBracing = subBoxBracing(
    subBox,
    wallThicknessIn,
    baffleInsetIn,
    portStyle,
    subVentSpec,
    braceStyle,
  );
  const midBracing = midBoxBracing(
    effectiveMidBoxDims,
    wallThicknessIn,
    baffleInsetIn,
    layout,
    braceStyle,
  );
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
    braceStyle,
    xoLo: subMidCrossoverHz, // the system chart draws the lowpass skirt
    phase: true, // for the coverage map
  });
  const { port, grossL: subGrossLiters, netL: subNetLiters, AMP_V: subAmpVoltage } = subSys;
  const subMdl = subSys.mdl;
  // the vent's own air-speed limit: the setting for a sharp-edged vent, more for flared tubes
  const portSpeedLimit = ventSpeedLimit(portStyle, maxPortAirSpeedMs);
  const subModelled = subMdl
    ? {
        mdl: { ...subSys.mdl, curve: phasedCurve(subSys.mdl.curve) },
        lim: subSys.lim,
        /**
         * Max SPL for a sine at each frequency (each frequency meets its own port and excursion limits);
         * the broadband limit (`lim`) is what applies to music.
         */
        maxCurve: maxCurveOf(subSys.mdl.curve, subDriver.ts, subAmpVoltage, portSpeedLimit),
        /** Sub through its lowpass at the crossover, for the system chart. Its own limits scale with the filter. */
        throughLowpass: subThroughLowpass(
          subSys.mdl,
          subDriver.ts,
          subAmpVoltage,
          portSpeedLimit,
          subMidCrossoverHz,
          subMidCrossoverOrder,
        ),
        throughLowpassBand: xmaxBandCurves(subDriver.ts.xmax, (Xmax) =>
          subThroughLowpass(
            subMdl,
            { ...subDriver.ts, Xmax },
            subAmpVoltage,
            portSpeedLimit,
            subMidCrossoverHz,
            subMidCrossoverOrder,
          ),
        ),
      }
    : null;

  // ---- mid-bass: sealed box ----
  const midSys = midSystem(midDriver, {
    layout,
    braceStyle,
    midDims: effectiveMidBoxDims,
    wall: wallThicknessIn,
    inset: baffleInsetIn,
    xoLo: subMidCrossoverHz,
    xoHi: midHornCrossoverHz,
    xoLoOrder: subMidCrossoverOrder,
    xoHiOrder: midHornCrossoverOrder,
    mAmpW: midAmpWatts,
    phase: true, // for the coverage map
  });
  const {
    V: midVoltage,
    grossL: midGrossL,
    netL: midNetL,
    effL: midEffL,
    vTherm: midThermalVoltage,
    useV: midUsedVoltage,
  } = midSys;
  const midModelled = midSys.mdl
    ? { ...midSys, mdl: { ...midSys.mdl, curve: phasedCurve(midSys.mdl.curve) } }
    : null;
  const midMaxBand = midModelled
    ? xmaxBandCurves(midDriver.ts.xmax, (Xmax) =>
        maxCurveOf(midModelled.mdl.curve, { ...midDriver.ts, Xmax }, midVoltage, Infinity),
      )
    : null;
  /** 3/4" baffle at 2.3 lb/ft\u00b2, other panels, braces and ribs at the chosen ply, plus 2 lb of hardware */
  const midCabinetLb = midWeightLb(effectiveMidBoxDims, wallThicknessIn, midBracing);
  const midWeightLoadedLb = midCabinetLb + (midDriver.lb || 0);
  // ---- horn + compression driver ----
  /**
   * Datasheet model, not T/S: on-horn sensitivity + 10 log P, shaped by the LR24 or LR48
   * highpass at the crossover and a 12 dB/oct rolloff below the horn's loading limit.
   * Power: amp voltage into the driver's impedance, capped at program (2 x AES), derated
   * 6 dB per octave when crossing below the frequency the AES rating was measured at.
   */
  const hornSpec: Partial<HornHf> = hornOption.hf || {};
  const hornModel = hornResponse(
    compressionDriver.hf,
    hornSpec,
    midHornCrossoverHz,
    hornAmpWatts,
    midHornCrossoverOrder,
  );
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
    ? subMusicOutputAt(
        subModelled.mdl,
        subModelled.lim,
        subAmpVoltage,
        subMidCrossoverHz,
        subMidCrossoverOrder,
      )
    : null;

  const portGeom = {
    ductH: subVentSpec.slotH,
    nPorts: subVentSpec.nt,
    portR: subVentSpec.dia / 2,
    tubeLen: subVentSpec.len,
    throat: subVentSpec.throat,
    divider: ductDividerIn(subVentSpec),
  };

  const subWeightLoadedLb = subWeightLb(subBox, wallThicknessIn, subDriver.lb, subBracing);

  const midBoxLiters = midGrossL;
  const isTower = layout === "tower";
  const heights = stackHeights({
    layout,
    plinth: plinthHeightIn,
    subBox,
    midBox: effectiveMidBoxDims,
    horn: hornOption,
    wall: wallThicknessIn,
    spacerH: spacerHeightIn,
  });
  const {
    subTop: subTopHeightIn,
    base: stackBaseHeightIn,
    hasArchedTop,
    stack: stackHeightIn,
    hornCenter: hornCenterHeightIn,
    // driver heights for the dispersion map: mid centered in its box (or the tower's mid section), sub at its box center
    midCenter: midCenterHeightIn,
  } = heights;
  const dispersionMapDistanceM = 10;
  const stackGeometry: PaStackGeometry | null =
    midDriver.ts && hornSpec.covH && hornOption.size
      ? {
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
          orderLo: subMidCrossoverOrder,
          orderHi: midHornCrossoverOrder,
        }
      : null;
  const paDispersion = stackGeometry
    ? paDispersionMap(stackGeometry, dispersionPlane, dispersionMapDistanceM)
    : null;
  const midHornGapIn = hornCenterHeightIn - midCenterHeightIn,
    midHornNullAngleDeg = firstNullAngleDeg(midHornGapIn, midHornCrossoverHz);
  return {
    effectiveMidBoxDims,
    port,
    subGrossLiters,
    subNetLiters,
    subBracing,
    midBracing,
    subAmpVoltage,
    subModelled,
    midVoltage,
    midGrossL,
    midNetL,
    midEffL,
    midModelled,
    midMaxBand,
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
    stackGeometry,
    paDispersion,
    midHornGapIn,
    midHornNullAngleDeg,
  };
}
