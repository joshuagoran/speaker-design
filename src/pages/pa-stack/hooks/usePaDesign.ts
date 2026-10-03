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
  midDriversOfSize,
  subDriversOfSize,
} from "../../../lib/data";
import { byId } from "../../../lib/tables";
import { DEFAULT_MID_BY_SIZE, DEFAULT_PA } from "../../../lib/defaults";
import { HIGHPASS_ALIGNMENTS } from "../../../lib/pa/calc";
import { KERF_OPTIONS, TRIM_OPTIONS, savedGrain } from "../../../lib/pa/cutlist";
import { savedCrossoverOrder } from "../../../constants/crossovers";
import type { Dims3, DispersionPlane, MidDriver, PaDesignConfig, SubDriver } from "../../../types";
import { derivePaDesign } from "./paDesign";
import type { PaDerivedDesign } from "./paDesign";
import type { CabinetStyle } from "./useCabinetStyle";
import type { Crossovers } from "./useCrossovers";
import type { CutlistOptions } from "./useCutlistOptions";
import type { HornDesign } from "./useHornDesign";
import type { MidDesign } from "./useMidDesign";
import type { SubwooferDesign } from "./useSubwooferDesign";
import { useEffect, useMemo, useRef } from "react";

/** What `usePaDesign` returns: every design state and setter, plus the models and sizes derived from them. */
export interface PaDesign
  extends
    SubwooferDesign,
    MidDesign,
    HornDesign,
    Crossovers,
    CabinetStyle,
    CutlistOptions,
    PaDerivedDesign {
  midWithBox: MidDriver & { box: Dims3 };
  subDriverChoices: SubDriver[];
  midDriverChoices: MidDriver[];
  subBox: Dims3;
  subWithBox: SubDriver & { box: Dims3 };
  /** set by `restore` so the mid size effect leaves a restored config's driver and box alone */
  skipSizeReset: React.RefObject<boolean>;
  hornExitMismatch: boolean;
  /** plywood thickness, in */
  PT: number;
  snapshot: () => PaDesignConfig;
  /** loads a saved or optimizer design; fields an older config lacks keep their defaults */
  restore: (c: Partial<PaDesignConfig>) => void;
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
  const {
    subMidCrossoverHz,
    setSubMidCrossoverHz,
    midHornCrossoverHz,
    setMidHornCrossoverHz,
    subMidCrossoverOrder,
    setSubMidCrossoverOrder,
    midHornCrossoverOrder,
    setMidHornCrossoverOrder,
  } = useCrossovers();
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
    kerfIn,
    setKerfIn,
    edgeTrimIn,
    setEdgeTrimIn,
    grain,
    setGrain,
    waterfall,
    setWaterfall,
    offcutShape,
    setOffcutShape,
    cutStyle,
    setCutStyle,
  } = useCutlistOptions();
  const subDriverChoices = subDriversOfSize(format.sub);
  const midDriverChoices = midDriversOfSize(midSize);
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

  /** Plywood thickness, in. */
  const PT = wallThicknessIn;
  // derived once per change to the inputs below, not on every render of every tab (App holds this planner)
  const derived = useMemo(
    () =>
      derivePaDesign({
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
        baffleInsetIn,
        spacerHeightIn,
        dispersionPlane,
      }),
    [
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
      baffleInsetIn,
      spacerHeightIn,
      dispersionPlane,
    ],
  );
  const { effectiveMidBoxDims, port, subModelled } = derived;
  const midWithBox = { ...midDriver, box: effectiveMidBoxDims };
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
    xoLoOrder: subMidCrossoverOrder,
    xoHiOrder: midHornCrossoverOrder,
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
    kerf: kerfIn,
    trim: edgeTrimIn,
    grain,
    waterfall,
    offcut: offcutShape,
    cuts: cutStyle,
    summary: `${subDriver.name} · ${subBox.w}×${subBox.h}×${subBox.d}″ · ${port.area.toFixed(0)} in² · ${subModelled ? subModelled.mdl.Fb.toFixed(1) + " Hz" : "—"}`,
  });
  const restore = (c: Partial<PaDesignConfig>) => {
    if (c.wall === 0.5 || c.wall === 0.75) setWallThicknessIn(c.wall);
    else setWallThicknessIn(DEFAULT_PA.wall);
    setBaffleInsetIn(typeof c.inset === "number" ? c.inset : DEFAULT_PA.inset);
    if (c.sub) setSubDriver(byId(SUB_OPTIONS, c.sub) ?? subDriver);
    if (c.mid) {
      const m = byId(MID_OPTIONS, c.mid) ?? midDriver;
      skipSizeReset.current = m.size !== midSize;
      setMidSize(m.size);
      setMidDriver(m);
    }
    const savedMidBox = c.midBox ? byId(MID_BOXES, c.midBox) : undefined;
    if (savedMidBox) setMidBoxPreset(savedMidBox);
    if (c.cd) setCompressionDriver(byId(CD_OPTIONS, c.cd) ?? compressionDriver);
    if (c.horn) setHornOption(byId(HORN_OPTIONS, c.horn) ?? hornOption);
    if (c.cDim) setSubBoxDims(c.cDim);
    if (c.cVent) setSubVentSpec(c.cVent);
    if (typeof c.hpf === "number") setSubHighpassHz(c.hpf);
    if (c.hpType && HIGHPASS_ALIGNMENTS[c.hpType]) setSubHighpassType(c.hpType);
    if (typeof c.ampW === "number") setSubAmpWatts(c.ampW);
    if (typeof c.portMax === "number") setMaxPortAirSpeedMs(c.portMax);
    if (c.mDim) setMidBoxDims(c.mDim);
    else if (savedMidBox) setMidBoxDims({ ...savedMidBox.box });
    if (typeof c.xoLo === "number") setSubMidCrossoverHz(c.xoLo);
    if (typeof c.xoHi === "number") setMidHornCrossoverHz(c.xoHi);
    setSubMidCrossoverOrder(savedCrossoverOrder(c.xoLoOrder));
    setMidHornCrossoverOrder(savedCrossoverOrder(c.xoHiOrder));
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
    setKerfIn(KERF_OPTIONS.find((k) => k.v === c.kerf)?.v ?? DEFAULT_PA.kerf);
    setEdgeTrimIn(TRIM_OPTIONS.find((v) => v === c.trim) ?? DEFAULT_PA.trim);
    setGrain(savedGrain(c.grain));
    // older designs: waterfall strips come on with mitre joints
    setWaterfall(typeof c.waterfall === "boolean" ? c.waterfall : c.joint === "miter");
    setOffcutShape(c.offcut === "panel" ? "panel" : DEFAULT_PA.offcut);
    setCutStyle(c.cuts === "rips" ? "rips" : DEFAULT_PA.cuts);
    if (c.portStyle) setPortStyle(c.portStyle);
  };
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
    subMidCrossoverOrder,
    setSubMidCrossoverOrder,
    midHornCrossoverOrder,
    setMidHornCrossoverOrder,
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
    kerfIn,
    setKerfIn,
    edgeTrimIn,
    setEdgeTrimIn,
    grain,
    setGrain,
    waterfall,
    setWaterfall,
    offcutShape,
    setOffcutShape,
    cutStyle,
    setCutStyle,
    ...derived,
    midWithBox,
    subDriverChoices,
    midDriverChoices,
    subBox,
    subWithBox,
    skipSizeReset,
    hornExitMismatch,
    PT,
    snapshot,
    restore,
  };
}
