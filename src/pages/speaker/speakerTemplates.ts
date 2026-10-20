// The Speaker page's templates: each builds a new speaker from the catalog and the defaults (lib/defaults), through the L1
// read adapters where a page already designs that box. A template sets only the first values: the spec keeps no
// template or role. Pure.
import type {
  AdapterBandId,
  BandFilter,
  ChamberBracing,
  ChamberLoad,
  GenericTop,
  GenericTopBands,
  GenericVentedBox,
  Dims2,
  HifiDesignState,
  Horn,
  HornSegment,
  PaLayout,
  PaDesign,
  SpeakerBand,
  SpeakerCabinet,
  SpeakerChamber,
  SpeakerDriver,
  SpeakerDriverParts,
  SpeakerPart,
  SpeakerSpec,
  SpecIdentity,
} from "../../types";
import { layersFromPa } from "../../lib/speaker/paSpec";
import { speakerFromHifi } from "../../lib/speaker/hifiSpec";
import { speakerFromFill } from "../../lib/speaker/fillSpec";
import {
  DIRECT_LOAD,
  FLUSH_BOX,
  flushBracing,
  NO_FILTERS,
  NO_HARDWARE,
  lrFilter,
  speakerIdentity,
} from "../../lib/speaker/specParts";
import {
  driverAcrossIn,
  hornFace,
  settledCabinet,
  speakerLayout,
} from "../../lib/speaker/speakerLayout";
import { takesHornMountAt } from "../../lib/build/hornMount";
import { PA_PANEL_TARGET_HZ } from "../../lib/build/boxBracing";
import { defaultBraceStyleNear } from "../../lib/build/bracing";
import { HIFI_COAXES, HORN_OPTIONS } from "../../lib/data";
import { driverLayout, tweeterOnGuide, waveguideFor } from "../../lib/speaker/twoWay";
import { byId, byIdOrThrow } from "../../lib/tables";
import {
  DEFAULT_FILL,
  DEFAULT_HIFI,
  DEFAULT_HIFI_LOOK,
  DEFAULT_MONITOR,
  DEFAULT_PA,
  GENERIC_HORN_SUB,
  GENERIC_HORN_TOP,
  GENERIC_SUB,
  GENERIC_TOPS,
  PA_V2_MID_BOX,
  PA_V2_SUB_BIN,
  TH18_XOC1,
} from "../../lib/defaults";
import { DEFAULT_COVERAGE_LAYOUT } from "../../lib/acoustics/coverageLayout";
import { CATALOG_TABLE_NAMES } from "../../constants/catalogTables";
import { PLYWOOD_MATERIAL } from "../../constants/panelSizes";
import { HIFI_DRIVE } from "../../constants/hifiEngine";
import { HORN_PROFILE } from "../../constants/hornEngine";
import { CM2_PER_IN2, MM_PER_IN } from "../../constants/units";
import {
  CABINET_CONSTRUCTION,
  CABINET_TOP,
  CHAMBER_LOAD,
  DRIVER_KIND,
  FILL_PANEL,
  HORN_DRIVE,
  HORN_PATH,
  HORN_PLACEMENT,
  PORT_SHAPE,
  SLOT_PLACE,
  SPEAKER_BAND,
  SPEAKER_BAND_NAMES,
  SPEAKER_PART,
  VENT_KIND,
} from "../../constants/speakerSpec";
import {
  SPEAKER_TEMPLATE,
  SPEAKER_START_SPEAKER_NAMES,
  type SpeakerTemplate,
} from "../../constants/speakerStarts";
import { DRAFT_SPEAKER_ID, emptySpeaker } from "./useSpeakerPage";
import { DEFAULT_VENTS } from "./speakerParts";
import { conesAreaCm2, throatAreaCm2 } from "../../lib/speaker/hornThroat";
import { withGoalHorn } from "./chamberLoad";

/** The PA layout with the tower's one speaker. */
const TOWER = "tower" satisfies PaLayout;

/** The default PA design (DEFAULT_PA) with every field set, its parts by id, in `layout`. */
export function defaultPaDesign(layout: PaLayout = DEFAULT_PA.layout): PaDesign {
  const {
    format,
    cabinet,
    sub,
    mid,
    midBox,
    cd,
    horn,
    midSize: _midSize,
    plywoodSheetKind: _sheet,
    boxSetCount: _sets,
    ...rest
  } = DEFAULT_PA;
  return {
    ...rest,
    format: format.id,
    cabinet: cabinet.id,
    sub: sub.id,
    mid: mid.id,
    midBox: midBox.id,
    cd: cd.id,
    horn: horn.id,
    layout,
  };
}

/** One speaker of the default PA design in `layout`, under the template's identity. */
function paSpeaker(layout: PaLayout, part: SpeakerPart, identity: SpecIdentity): SpeakerSpec {
  // the speakers alone are read: where the stacks stand (the default coverage layout) does not change them
  const read = layersFromPa(defaultPaDesign(layout), identity, DEFAULT_COVERAGE_LAYOUT);
  const id = speakerIdentity(identity, part).id;
  const found = read.speakers.find((s) => s.id === id);
  if (!found) throw new Error(`The PA ${layout} layout has no ${part} speaker`);
  return { ...found, ...identity };
}

/**
 * The tower with the horn freestanding on top (T1): the PA tower's sub and mid chamber (`TOWER_MID_HEIGHT_IN` tall, a
 * setting: it sets the mid's air and the tower's height), its horn on the mid chamber's lid with its mouth on the front
 * plane, on the PA's mount where the driver bolts straight to the horn; a flat top. Any horn can sit there.
 */
function towerTopHorn(identity: SpecIdentity): SpeakerSpec {
  const tower = paSpeaker(TOWER, SPEAKER_PART.tower, identity);
  const [sub, mid, section] = tower.cabinet.chambers;
  const hornDriver = section?.drivers.find((d) => d.kind === DRIVER_KIND.compression);
  if (!sub || !mid || !hornDriver?.horn) throw new Error("The PA tower has no horn section");
  const horn = byIdOrThrow(HORN_OPTIONS, hornDriver.horn.hornId, CATALOG_TABLE_NAMES.horns);
  const onTop: SpeakerDriver = {
    ...hornDriver,
    position: { xIn: 0, yIn: 0 },
    horn: {
      ...hornDriver.horn,
      placement: HORN_PLACEMENT.top,
      mount: takesHornMountAt(horn, HORN_PLACEMENT.top) ? DEFAULT_PA.hornMount : null,
    },
  };
  return {
    ...tower,
    cabinet: {
      ...tower.cabinet,
      chambers: [sub, { ...mid, drivers: [...mid.drivers, onTop] }],
      top: CABINET_TOP.flat,
    },
  };
}

/** A Hi-fi design state on the page's defaults, with these parts, crossover and vented box. */
const hifiState = (
  parts: Pick<HifiDesignState, "woofer" | "tweeter" | "crossoverHz">,
  box: Pick<HifiDesignState, "boxDims" | "portSpec">,
  wallPanel: HifiDesignState["wallPanel"] = DEFAULT_HIFI.wallPanel,
): HifiDesignState => ({
  ...DEFAULT_HIFI,
  ...parts,
  boxType: VENT_KIND.vented,
  ...box,
  wallPanel,
});

/** The monitors' input range: the crossover to the subs. */
const monitorInput = (): SpeakerSpec["input"] => ({
  highpass: lrFilter(DEFAULT_MONITOR.highpass.hz, DEFAULT_MONITOR.highpass.order),
  lowpass: null,
});

/** A booth monitor: its Hi-fi design with the monitors' input range. */
const monitor = (state: HifiDesignState, identity: SpecIdentity): SpeakerSpec => ({
  ...speakerFromHifi(state, DEFAULT_HIFI_LOOK, identity),
  input: monitorInput(),
});

/** The coaxial monitor: the coaxial in the default fill design's box, crossed at its HF section's recommended minimum. */
function monitorCoax(identity: SpecIdentity): SpeakerSpec {
  const coax = byId(
    HIFI_COAXES.map((c) => ({ ...c, id: c.woofer.id })),
    DEFAULT_MONITOR.coax.id,
  );
  if (!coax?.tweeter) throw new Error(`${DEFAULT_MONITOR.coax.name} has no HF data`);
  const crossoverHz = DEFAULT_MONITOR.coax.hf?.xo ?? DEFAULT_HIFI.crossoverHz;
  return monitor(
    hifiState(
      { woofer: coax.woofer, tweeter: coax.tweeter, crossoverHz },
      DEFAULT_MONITOR.coaxBox,
      FILL_PANEL,
    ),
    identity,
  );
}

/**
 * The 8″ + horn monitor: the compression driver on the small horn in the baffle, mounted tight above the woofer, as the
 * Hi-fi rule spaces a tweeter on its waveguide (a hi-fi design stands a round waveguide on the box top instead).
 */
function monitorHorn(identity: SpecIdentity): SpeakerSpec {
  const state: HifiDesignState = {
    ...hifiState(
      {
        woofer: DEFAULT_MONITOR.woofer,
        tweeter: DEFAULT_MONITOR.tweeter,
        crossoverHz: DEFAULT_MONITOR.crossoverHz,
      },
      DEFAULT_MONITOR.hornBox,
    ),
    selectedWaveguide: DEFAULT_MONITOR.waveguide,
  };
  const spec = monitor(state, identity);
  const guide = waveguideFor(state.tweeter, state.selectedWaveguide);
  const inBaffle = (chamber: SpeakerChamber): SpeakerChamber => {
    const lay = driverLayout(
      state.woofer,
      tweeterOnGuide(state.tweeter, guide),
      chamber.dims,
      false,
    );
    return {
      ...chamber,
      drivers: chamber.drivers.map((d): SpeakerDriver => {
        if (d.kind === DRIVER_KIND.woofer)
          return { ...d, position: { ...d.position, yIn: lay.wooferIn } };
        if (d.kind === DRIVER_KIND.tweeter && d.horn)
          return {
            ...d,
            position: { ...d.position, yIn: lay.tweeterIn },
            horn: { ...d.horn, placement: HORN_PLACEMENT.baffle },
          };
        return d;
      }),
    };
  };
  return { ...spec, cabinet: { ...spec.cabinet, chambers: spec.cabinet.chambers.map(inBaffle) } };
}

/** A length in mm, in inches. */
const inches = (mm: number) => mm / MM_PER_IN;

/** How finely a template's box and slot sizes are given, in: an eighth, as a saw is set. */
const SIZE_STEP_IN = 1 / 8;

/** A length, in, to the nearest step. */
const stepped = (inchesIn: number) => Math.round(inchesIn / SIZE_STEP_IN) * SIZE_STEP_IN;

/**
 * A PA v2 box's plywood shell around one horn chamber: the PA's frame and panels, its mouth flush with the front (no
 * inset: every mouth of the stack is on one plane), a flat top.
 */
const paV2Cabinet = (chamber: SpeakerChamber): SpeakerCabinet => ({
  chambers: [chamber],
  panel: { nominal: DEFAULT_PA.panel, material: PLYWOOD_MATERIAL, thicknessIn: DEFAULT_PA.wall },
  construction: CABINET_CONSTRUCTION.frameInset,
  top: CABINET_TOP.flat,
  insetIn: 0,
  roundoverIn: 0,
  tiltDeg: 0,
  // the PA v2 boxes' handles are not designed yet
  ...NO_HARDWARE,
});

/** A PA v2 box's chamber bracing, should it turn into a Box: the PA's back joint, its plywood's style and target. */
const PA_V2_BRACING: ChamberBracing = {
  backJoint: DEFAULT_PA.backJoint,
  braceStyle: defaultBraceStyleNear(DEFAULT_PA.wall),
  braceTargetHz: PA_PANEL_TARGET_HZ,
};

/** A PA v2 box's horn load: front-loaded on a straight path, its segments (the front chamber follows its walls). */
const paV2Horn = (segments: HornSegment[]): ChamberLoad => ({
  kind: CHAMBER_LOAD.horn,
  horn: {
    segments,
    portOffset: 0,
    drive: { kind: HORN_DRIVE.front },
    path: HORN_PATH.straight,
  },
});

/** An active band on the PA's DSP. */
const paV2Band = (
  id: AdapterBandId,
  filters: Pick<SpeakerBand, "highpass" | "lowpass">,
  ampW: SpeakerBand["ampW"],
): SpeakerBand => ({
  id,
  name: SPEAKER_BAND_NAMES[id],
  ...filters,
  levelDb: 0,
  drive: HIFI_DRIVE.active,
  ampW,
});

/**
 * A slot on each front side of a PA v2 box: `widthMm` wide, `lengthMm` long, as tall as the box's clear face (an open
 * slot always runs it). The spec takes the slot's narrow size as its height: the model reads only the area and the
 * opening's rectangle. `place` puts the openings up the front sides, beside the horn mouth, where the views draw them
 * (lib/speaker/speakerLayout slotOpeningsAt), a column of the horn's face each.
 */
const sideSlots = (widthMm: number, lengthMm: number, folded: boolean): SpeakerChamber["vent"] => ({
  kind: VENT_KIND.vented,
  port: {
    shape: PORT_SHAPE.slot,
    n: 2,
    h: stepped(inches(widthMm)),
    len: stepped(inches(lengthMm)),
    folded,
    place: SLOT_PLACE.sides,
  },
  maxSpeedMs: DEFAULT_PA.portMax,
});

/**
 * The face a PA v2 box's horn has, in: its chamber's clear face less the side slots' columns, as the layout sets it
 * (lib/speaker/speakerLayout hornFace), so the mouth the template sets fills it exactly.
 */
function paV2HornFace(chamber: SpeakerChamber): Dims2 {
  const cabinet = paV2Cabinet(chamber);
  const [placed] = speakerLayout(cabinet).chambers;
  const face = hornFace(placed, cabinet.panel.thicknessIn);
  return { w: face.w, h: face.h };
}

/**
 * The PA v2 sub bin with `count` 18″ stacked in its one throat (Hornresp's Nd): one straight-sided (parabolic) flare from
 * the throat its compression ratio sets (the side walls' back edges over the cones' outer parts) to a mouth that fills
 * the face between the slots, both at the box's inside height; each driver's share of the opening, rear air and slots;
 * the sub's subsonic in its band, its input range below the PA's crossover to the mids.
 */
function paV2SubBin(count: 1 | 2, identity: SpecIdentity): SpeakerSpec {
  const bin = PA_V2_SUB_BIN;
  const t = DEFAULT_PA.wall;
  const openingIn = inches(bin.openingMm) * count;
  const chamber: SpeakerChamber = {
    at: { xIn: 0, yIn: 0 },
    dims: {
      w: stepped(inches(bin.widthMm)),
      h: stepped(openingIn + 2 * t),
      d: stepped(inches(bin.depthMm)),
    },
    // the rear chamber and the wedges beside the flare: a shape the box models cannot work out
    netLiters: bin.rearLiters * count,
    stuffingPct: 0,
    vent: sideSlots(bin.slotWidthMm, bin.slotLengthMm, true),
    load: DIRECT_LOAD,
    // stacked up the throat, each in its share of the opening
    drivers: Array.from({ length: count }, (_, i) => ({
      kind: DRIVER_KIND.sub,
      driverId: bin.sub.id,
      count: 1,
      position: { xIn: 0, yIn: t + (inches(bin.openingMm) * (2 * i + 1)) / 2 },
      bands: [SPEAKER_BAND.low],
      horn: null,
    })),
    bracing: PA_V2_BRACING,
  };
  const face = paV2HornFace(chamber);
  const segments: HornSegment[] = [
    {
      profile: HORN_PROFILE.parabolic,
      s1: throatAreaCm2(conesAreaCm2(chamber.drivers), bin.compression),
      s2: face.w * face.h * CM2_PER_IN2,
      length: bin.flareCm,
    },
  ];
  return {
    ...identity,
    cabinet: paV2Cabinet({ ...chamber, load: paV2Horn(segments) }),
    bands: [paV2Band(SPEAKER_BAND.low, { highpass: bin.subsonic, lowpass: null }, DEFAULT_PA.ampW)],
    input: { highpass: null, lowpass: lrFilter(DEFAULT_PA.xoLo, DEFAULT_PA.xoLoOrder) },
    look: { cabFinish: DEFAULT_PA.cabFinish, baffleColor: DEFAULT_PA.baffleColor },
  };
}

/**
 * The PA v2 mid box: two 10″ in one throat (its area from the compression ratio), crossed to the HF at the R-OSSE's
 * lowest crossover; its input range above the PA's crossover to the subs.
 */
function paV2MidBox(identity: SpecIdentity): SpeakerSpec {
  const box = PA_V2_MID_BOX;
  const t = DEFAULT_PA.wall;
  const openingIn = inches(box.openingMm);
  const center = t + openingIn / 2;
  const chamber: SpeakerChamber = {
    at: { xIn: 0, yIn: 0 },
    dims: {
      w: stepped(inches(box.widthMm)),
      h: stepped(openingIn + 2 * t),
      d: stepped(inches(box.depthMm)),
    },
    // the rear chamber, the sealed wedges left out
    netLiters: box.rearLiters,
    stuffingPct: 0,
    vent: sideSlots(box.slotWidthMm, box.slotLengthMm, false),
    load: DIRECT_LOAD,
    // one above the other, `coneSpacingMm` apart about the opening's center
    drivers: Array.from({ length: box.drivers }, (_, i) => ({
      kind: DRIVER_KIND.mid,
      driverId: box.mid.id,
      count: 1,
      position: {
        xIn: 0,
        yIn: center + inches(box.coneSpacingMm) * (i - (box.drivers - 1) / 2),
      },
      bands: [SPEAKER_BAND.mid],
      horn: null,
    })),
    bracing: PA_V2_BRACING,
  };
  const hfHz = box.hfHorn.hf?.minXo ?? DEFAULT_PA.xoHi;
  // the mouth fills the face between the slots, at the box's inside height
  const face = paV2HornFace(chamber);
  const segments: HornSegment[] = [
    {
      profile: HORN_PROFILE.exponential,
      s1: throatAreaCm2(conesAreaCm2(chamber.drivers), box.compression),
      s2: face.w * face.h * CM2_PER_IN2,
      length: box.flareCm,
    },
  ];
  return {
    ...identity,
    cabinet: paV2Cabinet({ ...chamber, load: paV2Horn(segments) }),
    bands: [
      paV2Band(
        SPEAKER_BAND.mid,
        { highpass: null, lowpass: lrFilter(hfHz, DEFAULT_PA.xoHiOrder) },
        box.ampW,
      ),
    ],
    input: { highpass: lrFilter(DEFAULT_PA.xoLo, DEFAULT_PA.xoLoOrder), lowpass: null },
    look: { cabFinish: DEFAULT_PA.cabFinish, baffleColor: DEFAULT_PA.baffleColor },
  };
}

/**
 * TH18 (`TH18_XOC1`): its box from its plans (a flush box of 18 mm birch ply, the walls' ¾″ size measured at 18 mm), its
 * one PD.1850/3, its record's sections as the straight horn and its drive, the plans' boards drawn as its fold (sealed:
 * a drawn horn's vent is in its drawing), and its goals. On the PA's sub band with the sub bin's subsonic, below the
 * PA's crossover.
 */
function th18(identity: SpecIdentity): SpeakerSpec {
  const th = TH18_XOC1;
  const t = inches(th.wallMm);
  const h = inches(th.outerMm.h);
  const chamber: SpeakerChamber = {
    at: { xIn: 0, yIn: 0 },
    dims: { w: inches(th.outerMm.w), h, d: inches(th.outerMm.d) },
    netLiters: null,
    stuffingPct: 0,
    vent: DEFAULT_VENTS.sealed,
    load: {
      kind: CHAMBER_LOAD.horn,
      horn: {
        segments: th.segments,
        portOffset: 0,
        drive: th.drive,
        path: HORN_PATH.folded,
        goals: th.goals,
        fold: th.fold,
      },
    },
    drivers: [
      {
        kind: DRIVER_KIND.sub,
        driverId: th.driver.id,
        count: 1,
        position: { xIn: 0, yIn: h / 2 },
        bands: [SPEAKER_BAND.low],
        horn: null,
      },
    ],
    bracing: flushBracing(t),
  };
  return {
    ...identity,
    cabinet: {
      chambers: [chamber],
      panel: { nominal: DEFAULT_PA.panel, material: PLYWOOD_MATERIAL, thicknessIn: t },
      ...FLUSH_BOX,
      ...NO_HARDWARE,
      roundoverIn: 0,
      tiltDeg: 0,
    },
    bands: [
      paV2Band(
        SPEAKER_BAND.low,
        { highpass: PA_V2_SUB_BIN.subsonic, lowpass: null },
        DEFAULT_PA.ampW,
      ),
    ],
    input: { highpass: null, lowpass: lrFilter(DEFAULT_PA.xoLo, DEFAULT_PA.xoLoOrder) },
    look: { cabFinish: DEFAULT_PA.cabFinish, baffleColor: DEFAULT_PA.baffleColor },
  };
}

/**
 * A generic PA box's plywood shell: the PA's frame, panels and inset, its handles and input dish (`hardware`), a flat
 * top, kicked back `tiltDeg`.
 */
const genericCabinet = (
  chambers: SpeakerChamber[],
  hardware: Pick<SpeakerCabinet, "handles" | "inputDish">,
  tiltDeg = 0,
): SpeakerCabinet => ({
  chambers,
  panel: { nominal: DEFAULT_PA.panel, material: PLYWOOD_MATERIAL, thicknessIn: DEFAULT_PA.wall },
  construction: CABINET_CONSTRUCTION.frameInset,
  top: CABINET_TOP.flat,
  insetIn: DEFAULT_PA.inset,
  roundoverIn: 0,
  tiltDeg,
  ...hardware,
});

/** A generic box's look: the PA's finish and baffle paint. */
const PA_LOOK: SpeakerSpec["look"] = {
  cabFinish: DEFAULT_PA.cabFinish,
  baffleColor: DEFAULT_PA.baffleColor,
};

/** A generic sub's handles and input dish: the PA sub's. */
const SUB_HARDWARE: Pick<SpeakerCabinet, "handles" | "inputDish"> = {
  handles: DEFAULT_PA.hardware.sub,
  inputDish: true,
};

/** A generic box's vented chamber: its size and the PA letterbox slot along its floor. */
const genericVentedChamber = (box: GenericVentedBox, drivers: SpeakerDriver[]): SpeakerChamber => ({
  at: { xIn: 0, yIn: 0 },
  dims: box.dims,
  netLiters: null,
  stuffingPct: 0,
  vent: {
    kind: VENT_KIND.vented,
    port: { shape: PORT_SHAPE.slot, n: 1, ...box.slot },
    maxSpeedMs: DEFAULT_PA.portMax,
  },
  load: DIRECT_LOAD,
  drivers,
  bracing: PA_V2_BRACING,
});

/** One generic sub's driver entry, on the low band, its group's center `yIn` up from the chamber's bottom. */
const genericSubDriver = (
  driverId: SpeakerDriverParts["sub"]["id"],
  yIn: number,
): SpeakerDriver => ({
  kind: DRIVER_KIND.sub,
  driverId,
  count: 1,
  position: { xIn: 0, yIn },
  bands: [SPEAKER_BAND.low],
  horn: null,
});

/** A sub's bands and input range: its subsonic on its band, the PA's crossover to the tops as its input range. */
const subBands = (
  subsonic: BandFilter,
  ampW: SpeakerBand["ampW"],
): Pick<SpeakerSpec, "bands" | "input" | "look"> => ({
  bands: [paV2Band(SPEAKER_BAND.low, { highpass: subsonic, lowpass: null }, ampW)],
  input: { highpass: null, lowpass: lrFilter(DEFAULT_PA.xoLo, DEFAULT_PA.xoLoOrder) },
  look: PA_LOOK,
});

/** A generic vented sub (`GENERIC_SUB`): one or two 18″ in one chamber, stacked up the baffle above the slot. */
function genericSub(
  box: (typeof GENERIC_SUB)["single" | "dual"],
  identity: SpecIdentity,
): SpeakerSpec {
  const { sub, subsonic } = GENERIC_SUB;
  const { h } = box.dims;
  // the slot along the floor, the drivers sharing the face above it
  const floorIn = DEFAULT_PA.wall + box.slot.h;
  const share = (h - DEFAULT_PA.wall - floorIn) / box.count;
  const drivers = Array.from({ length: box.count }, (_, i) =>
    genericSubDriver(sub.id, floorIn + share * (i + 0.5)),
  );
  return {
    ...identity,
    cabinet: genericCabinet([genericVentedChamber(box, drivers)], SUB_HARDWARE),
    ...subBands(subsonic, box.ampW),
  };
}

/** An HF section's compression driver on its horn in the baffle, the PA's mount where the driver bolts to the horn. */
const hornInBaffle = (horn: Horn, position: SpeakerDriver["position"]): SpeakerDriver => ({
  kind: DRIVER_KIND.compression,
  driverId: GENERIC_TOPS.cd.id,
  count: 1,
  position,
  bands: [SPEAKER_BAND.high],
  horn: {
    hornId: horn.id,
    placement: HORN_PLACEMENT.baffle,
    mount: takesHornMountAt(horn, HORN_PLACEMENT.baffle) ? DEFAULT_PA.hornMount : null,
  },
});

/** A full-range top's two bands: the cone below its crossover (with its protective high-pass), the horn above. */
const topBands = (top: GenericTopBands): SpeakerSpec["bands"] => {
  const xo = lrFilter(top.crossoverHz, DEFAULT_PA.xoHiOrder);
  return [
    paV2Band(SPEAKER_BAND.low, { highpass: top.highpass, lowpass: xo }, top.ampW),
    {
      ...paV2Band(SPEAKER_BAND.high, { highpass: xo, lowpass: null }, top.hfAmpW),
      levelDb: top.hfLevelDb,
    },
  ];
};

/**
 * A generic top or wedge (`GENERIC_TOPS`): the cone low on the baffle and the horn above it, or (a wedge) side by side
 * across a low box; full range, its input range open.
 */
function genericTop(top: GenericTop, identity: SpecIdentity): SpeakerSpec {
  const { w, h } = top.box.dims;
  const t = DEFAULT_PA.wall;
  const floorIn = t + top.box.slot.h;
  const clearH = h - t - floorIn;
  const cone: SpeakerDriver = {
    kind: DRIVER_KIND.mid,
    driverId: top.mid.id,
    count: 1,
    position: { xIn: 0, yIn: 0 },
    bands: [SPEAKER_BAND.low],
    horn: null,
  };
  // half the cone's frame across, and a gap to the clear face's edge
  const coneIn = driverAcrossIn(cone) / 2 + DEFAULT_PA.inset;
  const mid: SpeakerDriver = {
    ...cone,
    position: top.sideBySide
      ? { xIn: -(w / 2 - t - coneIn), yIn: floorIn + clearH / 2 }
      : { xIn: 0, yIn: floorIn + coneIn },
  };
  const hf = hornInBaffle(
    top.horn,
    top.sideBySide
      ? { xIn: w / 2 - t - top.horn.size.w / 2, yIn: floorIn + clearH / 2 }
      : { xIn: 0, yIn: h - t - top.horn.size.h / 2 },
  );
  return {
    ...identity,
    cabinet: genericCabinet([genericVentedChamber(top.box, [mid, hf])], top.hardware, top.tiltDeg),
    bands: topBands(top),
    input: NO_FILTERS,
    look: PA_LOOK,
  };
}

/**
 * The generic 18″ horn sub (`GENERIC_HORN_SUB`): one 18″ in a sealed rear chamber, its folded front-loaded horn laid
 * out from its goals (Start from goals, pages/speaker/chamberLoad `withGoalHorn`), drawn where a fold is found.
 */
function genericHornSub(identity: SpecIdentity): SpeakerSpec {
  const bin = GENERIC_HORN_SUB;
  const chamber: SpeakerChamber = {
    at: { xIn: 0, yIn: 0 },
    dims: bin.dims,
    netLiters: null,
    stuffingPct: 0,
    vent: DEFAULT_VENTS.sealed,
    load: DIRECT_LOAD,
    drivers: [genericSubDriver(bin.sub.id, bin.dims.h / 2)],
    bracing: PA_V2_BRACING,
  };
  const cabinet = genericCabinet([chamber], SUB_HARDWARE);
  const [placed] = speakerLayout(cabinet).chambers;
  const found = withGoalHorn(cabinet, chamber, placed, HORN_DRIVE.front, bin.goals);
  if (!found) throw new Error("The generic horn sub's goals give no horn");
  return {
    ...identity,
    cabinet: { ...cabinet, chambers: [found.chamber] },
    ...subBands(bin.subsonic, bin.ampW),
  };
}

/**
 * The generic 12″ horn top (`GENERIC_HORN_TOP`): the 12″ on a straight front-loaded mid horn (an exponential flare from
 * the throat its compression ratio sets to a mouth that fills the face, a sealed rear chamber), and the HF section above
 * it: the compression driver on its horn in the baffle. Full range above the mid horn's high-pass.
 */
function genericHornTop(identity: SpecIdentity): SpeakerSpec {
  const top = GENERIC_HORN_TOP;
  const midChamber: SpeakerChamber = {
    at: { xIn: 0, yIn: 0 },
    dims: top.dims,
    netLiters: top.rearLiters,
    stuffingPct: 0,
    vent: DEFAULT_VENTS.sealed,
    load: DIRECT_LOAD,
    drivers: [
      {
        kind: DRIVER_KIND.mid,
        driverId: top.mid.id,
        count: 1,
        position: { xIn: 0, yIn: top.dims.h - DEFAULT_PA.wall - top.mid.size / 2 },
        bands: [SPEAKER_BAND.low],
        horn: null,
      },
    ],
    bracing: PA_V2_BRACING,
  };
  const hfChamber: SpeakerChamber = {
    at: { xIn: 0, yIn: top.dims.h },
    dims: { ...top.dims, h: top.hfHeightIn },
    netLiters: null,
    stuffingPct: 0,
    vent: DEFAULT_VENTS.sealed,
    load: DIRECT_LOAD,
    drivers: [hornInBaffle(top.horn, { xIn: 0, yIn: top.hfHeightIn / 2 })],
    bracing: PA_V2_BRACING,
  };
  const cabinet = genericCabinet([midChamber, hfChamber], top.hardware);
  const [placed] = speakerLayout(cabinet).chambers;
  const face = hornFace(placed, cabinet.panel.thicknessIn);
  const segments: HornSegment[] = [
    {
      profile: HORN_PROFILE.exponential,
      s1: throatAreaCm2(conesAreaCm2(midChamber.drivers), top.compression),
      s2: face.w * face.h * CM2_PER_IN2,
      length: top.flareCm,
    },
  ];
  return {
    ...identity,
    cabinet: {
      ...cabinet,
      chambers: [{ ...midChamber, load: paV2Horn(segments) }, hfChamber],
    },
    bands: topBands(top),
    input: NO_FILTERS,
    look: PA_LOOK,
  };
}

/** Each template's speaker, from its identity. */
const TEMPLATES: Record<SpeakerTemplate, (identity: SpecIdentity) => SpeakerSpec> = {
  empty: (identity) => ({ ...emptySpeaker(), ...identity }),
  paSubBox: (identity) => paSpeaker(DEFAULT_PA.layout, SPEAKER_PART.sub, identity),
  paMidHighBox: (identity) => paSpeaker(DEFAULT_PA.layout, SPEAKER_PART.top, identity),
  paTowerBaffleHorn: (identity) => paSpeaker(TOWER, SPEAKER_PART.tower, identity),
  paTowerTopHorn: towerTopHorn,
  hifiTwoWay: (identity) => speakerFromHifi(DEFAULT_HIFI, DEFAULT_HIFI_LOOK, identity),
  monitorCoax,
  monitorHorn,
  fill: (identity) => speakerFromFill(DEFAULT_FILL, identity),
  paV2SubBinOne: (identity) => paV2SubBin(1, identity),
  paV2SubBinTwo: (identity) => paV2SubBin(2, identity),
  paV2MidBox,
  th18,
  genericSub18: (identity) => genericSub(GENERIC_SUB.single, identity),
  genericDualSub18: (identity) => genericSub(GENERIC_SUB.dual, identity),
  genericTop12: (identity) => genericTop(GENERIC_TOPS.twelve, identity),
  genericTop15: (identity) => genericTop(GENERIC_TOPS.fifteen, identity),
  genericWedge12: (identity) => genericTop(GENERIC_TOPS.wedge, identity),
  genericHornSub18: genericHornSub,
  genericHornTop12: genericHornTop,
};

/** The templates in the picker's order. */
export const SPEAKER_TEMPLATES: readonly SpeakerTemplate[] = Object.values(SPEAKER_TEMPLATE);

/**
 * A template's speaker, as a draft under the template's name, its drivers settled on their baffles (lib/speaker/
 * speakerLayout `settledCabinet`: off every port and slot, and each other).
 */
export function templateSpeaker(template: SpeakerTemplate): SpeakerSpec {
  const spec = TEMPLATES[template]({
    id: DRAFT_SPEAKER_ID,
    name: SPEAKER_START_SPEAKER_NAMES[template],
  });
  return { ...spec, cabinet: settledCabinet(spec.cabinet) };
}
