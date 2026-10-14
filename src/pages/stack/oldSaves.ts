// The one read adapter for old saves (docs/speaker-designer-plan.md, L1 "Old saves" and L3f): a save from the PA page
// (`configs`) or the Hi-fi page (`hifiConfigs`) opens as speakers and a stack. The PA and Hi-fi pages go away at L3f;
// after that this is the only code that reads their saves. Pure.
//
// The rules for each saved field are the pages' own, and most still live beside the code they serve, because the PA
// and Hi-fi pages' loads use them too: `savedHardware` (lib/pa/hardware), `savedHornColor` (lib/pa/hornColor),
// `savedHornMount` (lib/pa/hornMount), `savedMusicBalance` (lib/pa/musicBalance), `savedPortStyle`
// (constants/portStyles), `savedCrossoverOrder` (constants/crossovers), `savedBackJoint` and `savedStackBraceStyle`
// (constants/bracing), and `restoredPanel`, `savedPanelExactIn` and `panelFor` (lib/panel; `panelFor` names the size of
// a save from before the panel sizes by its wall thickness, 0.75 in as 3/4). `savedVentSpec` is here already; the others
// move here when the PA and Hi-fi pages go.
import type {
  HifiBoxKind,
  PaDesignConfig,
  PaPlannerDesign,
  SavedConfig,
  SavedHifiConfig,
  SpeakerSpec,
  StackDesign,
  HifiDesignState,
  VentSpec,
} from "../../types";
import {
  HIFI_WAVEGUIDES,
  MID_BOXES,
  MID_OPTIONS,
  CD_OPTIONS,
  HORN_OPTIONS,
  SUB_OPTIONS,
  hifiDriverById,
} from "../../lib/data";
import { byId } from "../../lib/tables";
import { DEFAULT_HIFI, DEFAULT_HIFI_LOOK, DEFAULT_PA } from "../../lib/defaults";
import { HIGHPASS_ALIGNMENTS, midBoxMin } from "../../lib/pa/calc";
import { subBoxMin } from "../../lib/pa/chips";
import { boxSliderMins, fitBox } from "../../lib/boxFit";
import { savedHardware } from "../../lib/pa/hardware";
import { savedHornColor } from "../../lib/pa/hornColor";
import { savedHornMount } from "../../lib/pa/hornMount";
import { savedMusicBalance } from "../../lib/pa/musicBalance";
import { DEFAULT_COVERAGE_LAYOUT } from "../../lib/pa/coverageLayout";
import {
  isPanelNominal,
  panelFor,
  panelIn,
  restoredPanel,
  savedPanelExactIn,
} from "../../lib/panel";
import { paLayers } from "./stackPresets";
import { layersFromHifi } from "../../lib/speaker/hifiSpec";
import { savedCrossoverOrder } from "../../constants/crossovers";
import { savedPortStyle } from "../../constants/portStyles";
import { savedBackJoint, savedStackBraceStyle } from "../../constants/bracing";
import { DUCT_DIVIDER_DEFAULT, PLYWOOD_MATERIAL } from "../../constants/panelSizes";
import { PA_SLIDERS } from "../../constants/paSliders";
import { PA_LAYOUT_NAMES } from "../../constants/paLayouts";
import { keysOf } from "../../lib/records";
import { OLD_SAVE_COLLECTIONS, OLD_SAVE_KIND, type OldSaveKind } from "../../constants/speakerSpec";
import { defaultPaDesign } from "../speaker/speakerTemplates";
import { DRAFT_STACK_ID } from "./stackSaves";

/** A saved vent with every field a number: one an older save lacks (or holds as anything else) takes the default's. */
export function savedVentSpec(v: Partial<VentSpec>): VentSpec {
  const d = DEFAULT_PA.cVent;
  const num = (x: number | undefined, fallback: number) =>
    typeof x === "number" && Number.isFinite(x) ? x : fallback;
  return {
    ...v,
    slotH: num(v.slotH, d.slotH),
    nt: num(v.nt, d.nt),
    dia: num(v.dia, d.dia),
    throat: num(v.throat, d.throat),
    len: num(v.len, d.len),
  };
}

/** A number the save holds, else the fallback. */
const savedNumber = (x: unknown, fallback: number) =>
  typeof x === "number" && Number.isFinite(x) ? x : fallback;

/**
 * An old PA save as the PA page loads it, every field set: what it holds, checked as the PA page's `restore` checks it,
 * and the PA page's starting design (`DEFAULT_PA`) for the rest. Each box is fitted to at least what its parts need, as
 * the page shows and models it. The cutlist choices keep the defaults: the speakers don't read them.
 */
export function paDesignFromSaved(c: Partial<PaDesignConfig>): PaPlannerDesign {
  const base = defaultPaDesign(c.layout ?? DEFAULT_PA.layout);
  const exactIn = savedPanelExactIn(c.exactIn);
  const panel = panelFor(c, PLYWOOD_MATERIAL, exactIn) ?? DEFAULT_PA.panel;
  const wall = panelIn(panel, PLYWOOD_MATERIAL, exactIn);
  const divider = isPanelNominal(c.divider) ? c.divider : DUCT_DIVIDER_DEFAULT;
  const portStyle = c.portStyle ? savedPortStyle(c.portStyle) : base.portStyle;
  const sub = (c.sub && byId(SUB_OPTIONS, c.sub)) || byId(SUB_OPTIONS, base.sub);
  const mid = (c.mid && byId(MID_OPTIONS, c.mid)) || byId(MID_OPTIONS, base.mid);
  const midBox = c.midBox ? byId(MID_BOXES, c.midBox) : undefined;
  const cVent: VentSpec = {
    ...(c.cVent ? savedVentSpec(c.cVent) : base.cVent),
    div: panelIn(divider, PLYWOOD_MATERIAL, exactIn),
  };
  const cDim = c.cDim ?? base.cDim;
  const mDim = c.mDim ?? (midBox ? { ...midBox.box } : base.mDim);
  const layout = c.layout ?? base.layout;
  const balance = savedMusicBalance(c);
  // absent in the save: the plywood's bracing style and the horn's catalog finish (the fields stay out)
  const braceStyle = savedStackBraceStyle(c);
  const hornColor = savedHornColor(c);
  const { braceStyle: _brace, hornColor: _color, ...rest } = base;
  return {
    ...rest,
    ...(braceStyle ? { braceStyle } : {}),
    ...(hornColor ? { hornColor } : {}),
    sub: sub?.id ?? base.sub,
    mid: mid?.id ?? base.mid,
    midBox: midBox?.id ?? base.midBox,
    cd: (c.cd && byId(CD_OPTIONS, c.cd)?.id) || base.cd,
    horn: (c.horn && byId(HORN_OPTIONS, c.horn)?.id) || base.horn,
    portStyle,
    // each box at least what its parts need (the tower's mid chamber is the sub's footprint, so it is kept as set)
    cDim: sub
      ? fitBox(
          cDim,
          boxSliderMins(subBoxMin(portStyle, cVent, wall, sub.size), {
            w: PA_SLIDERS.subW,
            h: PA_SLIDERS.subH,
          }),
        )
      : cDim,
    mDim:
      mid && layout !== "tower"
        ? fitBox(
            mDim,
            boxSliderMins(midBoxMin(mid.size), { w: PA_SLIDERS.midW, h: PA_SLIDERS.midH }),
          )
        : mDim,
    cVent,
    hpf: savedNumber(c.hpf, base.hpf),
    hpType: c.hpType && HIGHPASS_ALIGNMENTS[c.hpType] ? c.hpType : base.hpType,
    ampW: savedNumber(c.ampW, base.ampW),
    portMax: savedNumber(c.portMax, base.portMax),
    wall,
    panel,
    divider,
    inset: savedNumber(c.inset, DEFAULT_PA.inset),
    backJoint: savedBackJoint(c.backJoint) ?? DEFAULT_PA.backJoint,
    xoLo: savedNumber(c.xoLo, base.xoLo),
    xoHi: savedNumber(c.xoHi, base.xoHi),
    xoLoOrder: savedCrossoverOrder(c.xoLoOrder),
    xoHiOrder: savedCrossoverOrder(c.xoHiOrder),
    mAmpW: savedNumber(c.mAmpW, base.mAmpW),
    tilt: balance.midBelowSubDb ?? base.tilt,
    hfAmpW: savedNumber(c.hfAmpW, base.hfAmpW),
    hfTilt: balance.hornBelowMidDb ?? base.hfTilt,
    layout,
    hardware: savedHardware(c.hardware),
    baffleColor: c.baffleColor || base.baffleColor,
    hornMount: savedHornMount(c.hornMount),
    cabFinish: c.cabFinish || DEFAULT_PA.cabFinish,
    spacerH: savedNumber(c.spacerH, DEFAULT_PA.spacerH),
    exactIn,
  };
}

/** An old Hi-fi save as the Hi-fi page loads it: what it holds, and the Hi-fi page's starting design for the rest. */
export function hifiDesignFromSaved(c: Partial<SavedHifiConfig>): {
  state: HifiDesignState;
  look: SpeakerSpec["look"];
} {
  const d = DEFAULT_HIFI;
  const panelMaterial = c.mat ?? d.panelMaterial;
  // the size the save names, at the thickness it was saved at (no measurements of this browser's)
  const walls = restoredPanel(c, panelMaterial, d.panelExactIn);
  const state: HifiDesignState = {
    ...d,
    woofer: (c.woofer !== undefined && hifiDriverById("woofer", c.woofer)) || d.woofer,
    tweeter: (c.tweeter !== undefined && hifiDriverById("tweeter", c.tweeter)) || d.tweeter,
    selectedWaveguide: (c.guide && byId(HIFI_WAVEGUIDES, c.guide)) || d.selectedWaveguide,
    boxType: c.box ?? d.boxType,
    boxDims: c.dim ?? d.boxDims,
    wallPanel: walls?.panel ?? d.wallPanel,
    panelExactIn: walls?.exactIn ?? d.panelExactIn,
    panelMaterial,
    portSpec: c.port ?? d.portSpec,
    radiatorSelection: c.pr ?? d.radiatorSelection,
    crossoverHz: c.xo ?? d.crossoverHz,
    crossoverOrder: c.order ?? d.crossoverOrder,
    wooferAmpWatts: c.wAmpW ?? d.wooferAmpWatts,
    tweeterAmpWatts: c.tAmpW ?? d.tweeterAmpWatts,
    baffleStepCompensationDb: c.bsc ?? d.baffleStepCompensationDb,
    placement: c.place ?? d.placement,
    distanceToWallFt: c.wallFt ?? d.distanceToWallFt,
    speakerSpacingFt: c.spacing ?? d.speakerSpacingFt,
    toeInDeg: c.toe ?? d.toeInDeg,
    listeningSeat: c.seat ?? d.listeningSeat,
    earHeightIn: c.earIn ?? d.earHeightIn,
    standHeightIn: c.standIn ?? d.standHeightIn,
    // saves from before these had sharp edges and a centered tweeter
    roundoverIn: c.roundover ?? d.roundoverIn,
    tweeterOffsetIn: c.tweeterOffset ?? d.tweeterOffsetIn,
  };
  return {
    state,
    // and before the look: the defaults
    look: {
      cabFinish: c.cabFinish || DEFAULT_HIFI_LOOK.cabFinish,
      baffleColor: c.baffleColor || DEFAULT_HIFI_LOOK.baffleColor,
    },
  };
}

/**
 * An old save as the Stack page lists it: which page it is from, and the document. Its id is unique across both
 * collections: the collection and the document's id.
 */
export interface OldSave extends Pick<SavedConfig, "id" | "name"> {
  kind: OldSaveKind;
  doc: SavedConfig;
}

/** The documents of an old-save collection as the Stack page lists them. */
export const oldSavesOf = (kind: OldSaveKind, docs: readonly SavedConfig[]): OldSave[] =>
  docs.map((doc) => ({ id: `${OLD_SAVE_COLLECTIONS[kind]}/${doc.id}`, name: doc.name, kind, doc }));

/** Whether a field the save holds reads as a size: absent, or a box of three finite numbers. */
const sizeOk = (x: unknown) =>
  x === undefined ||
  (typeof x === "object" &&
    x !== null &&
    ["w", "h", "d"].every((k) => {
      const v: unknown = Reflect.get(x, k);
      return typeof v === "number" && Number.isFinite(v);
    }));

/** Whether a field the save holds is absent or one of `ids`. */
const oneOf = (x: unknown, ids: readonly string[]) =>
  x === undefined || (typeof x === "string" && ids.includes(x));

/** The box kinds a Hi-fi save can hold. */
const HIFI_BOX_KINDS: readonly HifiBoxKind[] = ["sealed", "vented", "radiator"];

/** Whether the document reads as its page's save: the fields the speakers can't do without, where it holds them. */
const readsAs = (kind: OldSaveKind, doc: SavedConfig) =>
  kind === OLD_SAVE_KIND.pa
    ? oneOf(doc.layout, keysOf(PA_LAYOUT_NAMES)) && sizeOk(doc.cDim) && sizeOk(doc.mDim)
    : oneOf(doc.box, HIFI_BOX_KINDS) && sizeOk(doc.dim);

/**
 * An old save opened as a new, unsaved stack named as the save: the PA design's speakers and stack (on the PA floor's
 * starting layout, with its music balance in the band Levels), or the Hi-fi speaker in a stack of one. Null for a document that doesn't read as its page's save
 * (a layout or box kind it can't have, a size that isn't numbers), or that the adapters can't read in.
 */
export function stackFromOldSave({ kind, doc }: Pick<OldSave, "kind" | "doc">): StackDesign | null {
  if (!readsAs(kind, doc)) return null;
  const identity = { id: DRAFT_STACK_ID, name: doc.name };
  try {
    if (kind === OLD_SAVE_KIND.pa) {
      // the music balance worked out once, now, and saved in the band Levels (as the current PA design is)
      const { stack, speakers } = paLayers(
        paDesignFromSaved(doc),
        identity,
        DEFAULT_COVERAGE_LAYOUT,
      );
      return { stack, speakers };
    }
    const { state, look } = hifiDesignFromSaved(doc);
    const { stack, speakers } = layersFromHifi(state, look, identity);
    return { stack, speakers };
  } catch {
    // a document written elsewhere, with values no page wrote: it doesn't open (the page says so)
    return null;
  }
}
