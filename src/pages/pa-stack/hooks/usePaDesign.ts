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
import { savedCutlist } from "../../../lib/pa/cutlist";
import { savedCrossoverOrder } from "../../../constants/crossovers";
import { savedPortStyle } from "../../../constants/portStyles";
import { savedStackBraceStyle } from "../../../constants/bracing";
import { savedHardware } from "../../../lib/pa/hardware";
import { musicBalanceToSave, savedMusicBalance } from "../../../lib/pa/musicBalance";
import { DUCT_DIVIDER_DEFAULT, PLYWOOD_MATERIAL } from "../../../constants/panelSizes";
import { isPanelNominal, panelFor, panelIn, savedPanelExactIn } from "../../../lib/panel";
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
  /** the walls' exact thickness, in: the nominal size at the Cutlist page's measured thickness (lib/panel) */
  wallThicknessIn: number;
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
    subVentSpec: subVentState,
    setSubVentSpec,
    ductDividerPanel,
    setDuctDividerPanel,
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
    midBelowSubDb,
    setMidBelowSubDb,
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
    hornBelowMidDb,
    setHornBelowMidDb,
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
    wallPanel,
    setWallPanel,
    braceStyle,
    setBraceStyle,
    effectiveBraceStyle,
    baffleInsetIn,
    setBaffleInsetIn,
    baffleColor,
    setBaffleColor,
    cabinetFinish,
    setCabinetFinish,
    spacerHeightIn,
    setSpacerHeightIn,
    hardware,
    setHardware,
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
    panelExactIn,
    setPanelExactIn,
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

  /** The walls' exact thickness and plywood thickness, in. */
  const wallThicknessIn = panelIn(wallPanel, PLYWOOD_MATERIAL, panelExactIn);
  const PT = wallThicknessIn;
  // the side ducts' dividers at their size's measured thickness, carried on the vent every model and view reads
  const ductDividerIn = panelIn(ductDividerPanel, PLYWOOD_MATERIAL, panelExactIn);
  const subVentSpec = useMemo(
    () => ({ ...subVentState, div: ductDividerIn }),
    [subVentState, ductDividerIn],
  );
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
        braceStyle: effectiveBraceStyle,
        baffleInsetIn,
        spacerHeightIn,
        hardware,
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
      effectiveBraceStyle,
      baffleInsetIn,
      spacerHeightIn,
      hardware,
      dispersionPlane,
    ],
  );
  const { effectiveMidBoxDims, port, subModeled } = derived;
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
    panel: wallPanel,
    divider: ductDividerPanel,
    inset: baffleInsetIn,
    ...(braceStyle ? { braceStyle } : {}),
    xoLo: subMidCrossoverHz,
    xoHi: midHornCrossoverHz,
    xoLoOrder: subMidCrossoverOrder,
    xoHiOrder: midHornCrossoverOrder,
    mAmpW: midAmpWatts,
    ...musicBalanceToSave(midBelowSubDb, hornBelowMidDb),
    hfAmpW: hornAmpWatts,
    layout,
    hardware,
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
    exactIn: panelExactIn,
    summary: `${subDriver.name} · ${subBox.w}×${subBox.h}×${subBox.d}″ · ${port.area.toFixed(0)} in² · ${subModeled ? subModeled.mdl.Fb.toFixed(1) + " Hz" : "—"}`,
  });
  const restore = (c: Partial<PaDesignConfig>) => {
    // the measured thicknesses saved with the design (none in older saves: the nominal sizes), then its walls' size
    const exactIn = savedPanelExactIn(c.exactIn);
    setPanelExactIn(exactIn);
    setWallPanel(panelFor(c, PLYWOOD_MATERIAL, exactIn) ?? DEFAULT_PA.panel);
    setBaffleInsetIn(typeof c.inset === "number" ? c.inset : DEFAULT_PA.inset);
    // the stack's style; a save from earlier builds names the sub's instead; neither: the plywood's default
    setBraceStyle(savedStackBraceStyle(c));
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
    setDuctDividerPanel(isPanelNominal(c.divider) ? c.divider : DUCT_DIVIDER_DEFAULT);
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
    const balance = savedMusicBalance(c);
    if (balance.midBelowSubDb !== null) setMidBelowSubDb(balance.midBelowSubDb);
    if (typeof c.hfAmpW === "number") setHornAmpWatts(c.hfAmpW);
    if (balance.hornBelowMidDb !== null) setHornBelowMidDb(balance.hornBelowMidDb);
    if (typeof c.cutaway === "boolean") setCutaway(c.cutaway);
    if (c.layout) setLayout(c.layout);
    // each box's handles; a save from before them: the defaults
    setHardware(savedHardware(c.hardware));
    if (c.baffleColor) setBaffleColor(c.baffleColor);
    setCabinetFinish(c.cabFinish || DEFAULT_PA.cabFinish);
    setSpacerHeightIn(typeof c.spacerH === "number" ? c.spacerH : DEFAULT_PA.spacerH);
    if (c.joint) setCornerJoint(c.joint);
    const cl = savedCutlist(c);
    setKerfIn(cl.kerf);
    setEdgeTrimIn(cl.trim);
    setGrain(cl.grain);
    setWaterfall(cl.waterfall);
    setOffcutShape(cl.offcut);
    setCutStyle(cl.cuts);
    if (c.portStyle) setPortStyle(savedPortStyle(c.portStyle));
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
    ductDividerPanel,
    setDuctDividerPanel,
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
    midBelowSubDb,
    setMidBelowSubDb,
    setMidBoxDim,
    midSize,
    setMidSize,
    hornOption,
    setHornOption,
    compressionDriver,
    setCompressionDriver,
    hornAmpWatts,
    setHornAmpWatts,
    hornBelowMidDb,
    setHornBelowMidDb,
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
    wallPanel,
    setWallPanel,
    wallThicknessIn,
    braceStyle,
    setBraceStyle,
    effectiveBraceStyle,
    baffleInsetIn,
    setBaffleInsetIn,
    baffleColor,
    setBaffleColor,
    cabinetFinish,
    setCabinetFinish,
    spacerHeightIn,
    setSpacerHeightIn,
    hardware,
    setHardware,
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
    panelExactIn,
    setPanelExactIn,
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
