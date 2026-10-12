// The Designer's templates: each builds a new speaker from the catalog and the defaults (lib/defaults), through the L1
// read adapters where a page already designs that box. A template sets only the first values: the spec keeps no
// template or role (docs/speaker-designer-plan.md, owner decisions). Pure.
import type {
  AdapterBandId,
  HifiDesignState,
  HornSegment,
  PaLayout,
  PaPlannerDesign,
  SpeakerBand,
  SpeakerCabinet,
  SpeakerChamber,
  SpeakerDriver,
  SpeakerPart,
  SpeakerSpec,
  SpecIdentity,
} from "../../types";
import { layersFromPa } from "../../lib/speaker/paSpec";
import { speakerFromHifi } from "../../lib/speaker/hifiSpec";
import { speakerFromFill } from "../../lib/speaker/fillSpec";
import { lrFilter, speakerIdentity } from "../../lib/speaker/specParts";
import { takesHornMountAt } from "../../lib/pa/hornMount";
import { PA_PANEL_TARGET_HZ } from "../../lib/pa/bracing";
import { defaultBraceStyleNear } from "../../lib/bracing";
import { HIFI_COAXES, HORN_OPTIONS } from "../../lib/data";
import { driverLayout, tweeterOnGuide, waveguideFor } from "../../lib/hifi/hifi";
import { byId, byIdOrThrow } from "../../lib/tables";
import {
  DEFAULT_FILL,
  DEFAULT_HIFI,
  DEFAULT_HIFI_LOOK,
  DEFAULT_MONITOR,
  DEFAULT_PA,
  PA_V2_MID_BOX,
  PA_V2_SUB_BIN,
} from "../../lib/defaults";
import { DEFAULT_COVERAGE_LAYOUT } from "../coverage/useCoverageLayout";
import { CATALOG_TABLE_NAMES } from "../../constants/catalogTables";
import { PLYWOOD_MATERIAL } from "../../constants/panelSizes";
import { HIFI_DRIVE } from "../../constants/hifiEngine";
import { HORN_PROFILE } from "../../constants/hornEngine";
import { MM_PER_IN } from "../../constants/units";
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
  SPEAKER_BAND,
  SPEAKER_BAND_NAMES,
  SPEAKER_PART,
  VENT_KIND,
} from "../../constants/speakerSpec";
import {
  DESIGNER_TEMPLATE,
  DESIGNER_START_SPEAKER_NAMES,
  type DesignerTemplate,
} from "../../constants/designerStarts";
import { DRAFT_SPEAKER_ID, emptySpeaker } from "./useDesigner";

/** The PA layout with the tower's one speaker. */
const TOWER = "tower" satisfies PaLayout;

/** The PA page's starting design (DEFAULT_PA) as the planner holds it, its parts by id, in `layout`. */
export function defaultPaDesign(layout: PaLayout = DEFAULT_PA.layout): PaPlannerDesign {
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

/** One speaker of the PA page's starting design in `layout`, under the template's identity. */
function paSpeaker(layout: PaLayout, part: SpeakerPart, identity: SpecIdentity): SpeakerSpec {
  // the speakers alone are read: where the stacks stand (the coverage page's) does not change them
  const read = layersFromPa(defaultPaDesign(layout), identity, DEFAULT_COVERAGE_LAYOUT.stacks);
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

/** The coaxial monitor: the coaxial in the Fills page's box, crossed at its HF section's recommended minimum. */
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
 * Hi-fi rule spaces a tweeter on its waveguide (the Hi-fi page stands a round waveguide on the box top instead).
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
  backJoint: DEFAULT_PA.backJoint,
  braceStyle: defaultBraceStyleNear(DEFAULT_PA.wall),
  braceTargetHz: PA_PANEL_TARGET_HZ,
  // the PA v2 boxes' handles are not designed yet
  hardware: null,
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
 * A slot on each front side of a PA v2 box: `widthMm` wide, the opening's height (`longIn`) tall, `lengthMm` long. The
 * spec takes the slot's narrow size as its height and its long size as its width: the model reads only the area and the
 * opening's rectangle, and the views draw a Hi-fi slot along the bottom (a slot's place is not movable yet).
 */
const sideSlots = (
  widthMm: number,
  longIn: number,
  lengthMm: number,
  folded: boolean,
): SpeakerChamber["vent"] => ({
  kind: VENT_KIND.vented,
  port: {
    shape: PORT_SHAPE.slot,
    n: 2,
    h: stepped(inches(widthMm)),
    w: stepped(longIn),
    len: stepped(inches(lengthMm)),
    folded,
  },
  maxSpeedMs: DEFAULT_PA.portMax,
});

/**
 * The PA v2 sub bin with `count` 18″ stacked in its one throat (Hornresp's Nd): each driver's share of the opening,
 * flare, rear air and slots; the sub's subsonic in its band, its input range below the PA's crossover to the mids.
 */
function paV2SubBin(count: 1 | 2, identity: SpecIdentity): SpeakerSpec {
  const bin = PA_V2_SUB_BIN;
  const t = DEFAULT_PA.wall;
  const openingIn = inches(bin.openingMm) * count;
  const throat = bin.sub.ts.Sd * count;
  const mouth = bin.mouthCm2 * count;
  const area = (step: number) => throat + ((mouth - throat) * step) / bin.flareSteps;
  const segments: HornSegment[] = Array.from({ length: bin.flareSteps }, (_, i) => ({
    profile: HORN_PROFILE.conical,
    s1: area(i),
    s2: area(i + 1),
    length: bin.flareCm / bin.flareSteps,
  }));
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
    vent: sideSlots(bin.slotWidthMm, openingIn, bin.slotLengthMm, true),
    load: {
      kind: CHAMBER_LOAD.horn,
      horn: {
        throatChamber: 0,
        segments,
        portOffset: 0,
        drive: { kind: HORN_DRIVE.front },
        path: HORN_PATH.straight,
      },
    },
    // stacked up the throat, each in its share of the opening
    drivers: Array.from({ length: count }, (_, i) => ({
      kind: DRIVER_KIND.sub,
      driverId: bin.sub.id,
      count: 1,
      position: { xIn: 0, yIn: t + (inches(bin.openingMm) * (2 * i + 1)) / 2 },
      bands: [SPEAKER_BAND.low],
      horn: null,
    })),
  };
  return {
    ...identity,
    cabinet: paV2Cabinet(chamber),
    bands: [paV2Band(SPEAKER_BAND.low, { highpass: bin.subsonic, lowpass: null }, DEFAULT_PA.ampW)],
    input: { highpass: null, lowpass: lrFilter(DEFAULT_PA.xoLo, DEFAULT_PA.xoLoOrder) },
    look: { cabFinish: DEFAULT_PA.cabFinish, baffleColor: DEFAULT_PA.baffleColor },
  };
}

/**
 * The PA v2 mid box: two 10″ in one throat, crossed to the HF at the R-OSSE's lowest crossover; its input range above
 * the PA's crossover to the subs.
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
    vent: sideSlots(box.slotWidthMm, openingIn, box.slotLengthMm, false),
    load: {
      kind: CHAMBER_LOAD.horn,
      horn: {
        throatChamber: box.throatChamberL,
        segments: [
          {
            profile: HORN_PROFILE.exponential,
            s1: box.throatCm2,
            s2: box.mouthCm2,
            length: box.flareCm,
          },
        ],
        portOffset: 0,
        drive: { kind: HORN_DRIVE.front },
        path: HORN_PATH.straight,
      },
    },
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
  };
  const hfHz = box.hfHorn.hf?.minXo ?? DEFAULT_PA.xoHi;
  return {
    ...identity,
    cabinet: paV2Cabinet(chamber),
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

/** Each template's speaker, from its identity. */
const TEMPLATES: Record<DesignerTemplate, (identity: SpecIdentity) => SpeakerSpec> = {
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
};

/** The templates in the picker's order. */
export const DESIGNER_TEMPLATES: readonly DesignerTemplate[] = Object.values(DESIGNER_TEMPLATE);

/** A template's speaker, as a draft under the template's name. */
export const templateSpeaker = (template: DesignerTemplate): SpeakerSpec =>
  TEMPLATES[template]({ id: DRAFT_SPEAKER_ID, name: DESIGNER_START_SPEAKER_NAMES[template] });
