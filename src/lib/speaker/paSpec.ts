// Read adapter: the PA page's design (PaDesignConfig) as speaker specs and a system spec. Pure; nothing is written.
//
// Stack, pole and satellite: a sub box (one vented chamber) and a mid/high box (one sealed chamber, the horn on its
// lid). Tower: one cabinet of three chambers, bottom to top: the sub, the mid and the horn section, the horn in the
// baffle. The crossover between the sub and the tops is the system's; the one inside a box is the box's.
import type {
  CoverageLayout,
  DriverPosition,
  HornPlacement,
  PaDesignConfig,
  PaLayout,
  PortStyle,
  SourcePose,
  SpeakerBand,
  SpeakerCabinet,
  SpeakerChamber,
  SpeakerDriver,
  SpeakerPort,
  SpeakerSpec,
  SpeakerTemplate,
  SpecIdentity,
  SystemSource,
  SystemSpec,
  SystemWithSpeakers,
  VentSpec,
} from "../../types";
import { HORN_OPTIONS, SUB_OPTIONS, mainsDsp } from "../data";
import { byIdOrThrow } from "../tables";
import { subDriverCenter } from "../pa/calc";
import { towerMidDims, towerSpec } from "../pa/tower";
import { takesHornMount } from "../pa/hornMount";
import { panelNominalNear } from "../panel";
import { DEFAULT_PA } from "../defaults";
import { CATALOG_TABLE_NAMES } from "../../constants/catalogTables";
import { HORN_MOUNT_DEFAULT } from "../../constants/hornMount";
import { PLYWOOD_MATERIAL } from "../../constants/panelSizes";
import { MID_GAP_IN, SATELLITE_COLUMN_H_IN } from "../../constants/paLayouts";
import { HIFI_DRIVE } from "../../constants/hifiEngine";
import {
  AUTO_DELAY,
  DRIVER_KIND,
  HORN_PLACEMENT,
  PORT_SHAPE,
  SOURCE_ROLE,
  SPEAKER_BAND,
  SPEAKER_TEMPLATE,
  VENT_KIND,
} from "../../constants/speakerSpec";
import { DIRECT_LOAD, NO_FILTERS, channelCounter, lrFilter, speakerIdentity } from "./specParts";

/** The sub's round tubes as a round port: `nt` tubes of `dia`, `len` long (the elbows follow from the box). */
const roundTubes = (v: VentSpec): SpeakerPort => ({
  shape: PORT_SHAPE.round,
  n: v.nt,
  dia: v.dia,
  len: v.len,
});

/** The sub's side ducts: `n` of them, each `throat` wide and `len` long, with their dividers. */
const sideDucts = (v: VentSpec, n: 1 | 2): SpeakerPort => ({
  shape: PORT_SHAPE.duct,
  n,
  throat: v.throat,
  len: v.len,
  div: v.div,
});

/** The sub's vent as a chamber's port, by port style. */
const PA_PORTS: Record<PortStyle, (v: VentSpec) => SpeakerPort> = {
  slots: (v) => ({ shape: PORT_SHAPE.slot, n: 1, h: v.slotH, len: v.len }),
  vslots: (v) => sideDucts(v, 2),
  vslot1: (v) => sideDucts(v, 1),
  round1: roundTubes,
  round2: roundTubes,
  round4: roundTubes,
};

/** The sub box: one vented chamber, the sub where the 3D view puts it. */
function subChamber(cfg: PaDesignConfig): SpeakerChamber {
  const sub = byIdOrThrow(SUB_OPTIONS, cfg.sub, CATALOG_TABLE_NAMES.subs);
  // in from the box's inside corner: to the center line, and up from the outside bottom
  const center = subDriverCenter(cfg.cDim, cfg.wall, cfg.portStyle, cfg.cVent, sub.size);
  const position = { xIn: center.x - (cfg.cDim.w / 2 - cfg.wall), yIn: center.y + cfg.wall };
  return {
    dims: cfg.cDim,
    netLiters: null,
    vent: { kind: VENT_KIND.vented, port: PA_PORTS[cfg.portStyle](cfg.cVent) },
    load: DIRECT_LOAD,
    drivers: [
      {
        kind: DRIVER_KIND.sub,
        driverId: cfg.sub,
        count: 1,
        position,
        bands: [SPEAKER_BAND.low],
        horn: null,
      },
    ],
  };
}

/** The mid driver at a height on its chamber's baffle, centered across. */
const midDriver = (cfg: PaDesignConfig, yIn: number): SpeakerDriver => ({
  kind: DRIVER_KIND.mid,
  driverId: cfg.mid,
  count: 1,
  position: { xIn: 0, yIn },
  bands: [SPEAKER_BAND.mid],
  horn: null,
});

/** The compression driver on its horn, placed on the lid or in the baffle, with the lid's mount where it applies. */
function hornDriver(
  cfg: PaDesignConfig,
  placement: HornPlacement,
  position: DriverPosition,
): SpeakerDriver {
  const horn = byIdOrThrow(HORN_OPTIONS, cfg.horn, CATALOG_TABLE_NAMES.horns);
  return {
    kind: DRIVER_KIND.compression,
    driverId: cfg.cd,
    count: 1,
    position,
    bands: [SPEAKER_BAND.high],
    horn: {
      hornId: cfg.horn,
      placement,
      mount: takesHornMount(horn, cfg.layout) ? (cfg.hornMount ?? HORN_MOUNT_DEFAULT) : null,
    },
  };
}

/** A sealed chamber of `dims` with these drivers. */
const sealedChamber = (
  dims: SpeakerChamber["dims"],
  drivers: SpeakerChamber["drivers"],
): SpeakerChamber => ({
  dims,
  netLiters: null,
  vent: { kind: VENT_KIND.sealed },
  load: DIRECT_LOAD,
  drivers,
});

/** The plywood shell: the design's panels, inset and bracing; the PA boxes stand upright with sharp-edged baffles. */
const paCabinet = (cfg: PaDesignConfig, chambers: SpeakerCabinet["chambers"]): SpeakerCabinet => ({
  chambers,
  panel: {
    nominal: cfg.panel ?? panelNominalNear(cfg.wall),
    material: PLYWOOD_MATERIAL,
    thicknessIn: cfg.wall,
  },
  insetIn: cfg.inset,
  roundoverIn: 0,
  tiltDeg: 0,
  braceStyle: cfg.braceStyle,
  backJoint: cfg.backJoint,
});

/** The sub band's own filter: the subsonic highpass. */
const subBand = (cfg: PaDesignConfig): SpeakerBand => ({
  id: SPEAKER_BAND.low,
  highpass: { hz: cfg.hpf, type: cfg.hpType },
  lowpass: null,
  levelDb: 0,
});

/** The horn band: above the mid-to-horn crossover, `hfTilt` below the mid band, which is `midDb` below the box's top. */
const hornBand = (cfg: PaDesignConfig, midDb: number): SpeakerBand => ({
  id: SPEAKER_BAND.high,
  highpass: lrFilter(cfg.xoHi, cfg.xoHiOrder),
  lowpass: null,
  levelDb: -(midDb + cfg.hfTilt),
});

/** One PA box as a speaker spec. */
function paSpeaker(
  cfg: PaDesignConfig,
  system: SpecIdentity,
  template: SpeakerTemplate,
  cabinet: SpeakerCabinet,
  bands: SpeakerSpec["bands"],
): SpeakerSpec {
  return {
    ...speakerIdentity(system, template),
    template,
    cabinet,
    bands,
    drive: HIFI_DRIVE.active,
    look: { cabFinish: cfg.cabFinish, baffleColor: cfg.baffleColor, hornColor: cfg.hornColor },
  };
}

/** The sub box of the stack, pole and satellite layouts. */
const subSpeaker = (cfg: PaDesignConfig, system: SpecIdentity) =>
  paSpeaker(cfg, system, SPEAKER_TEMPLATE.sub, paCabinet(cfg, [subChamber(cfg)]), [subBand(cfg)]);

/** The mid/high box: the mid in a sealed box, the horn on its lid, crossed inside the box. */
const topSpeaker = (cfg: PaDesignConfig, system: SpecIdentity) =>
  paSpeaker(
    cfg,
    system,
    SPEAKER_TEMPLATE.top,
    paCabinet(cfg, [
      sealedChamber(cfg.mDim, [
        midDriver(cfg, cfg.mDim.h / 2),
        hornDriver(cfg, HORN_PLACEMENT.top, { xIn: 0, yIn: 0 }),
      ]),
    ]),
    [
      {
        id: SPEAKER_BAND.mid,
        highpass: null,
        lowpass: lrFilter(cfg.xoHi, cfg.xoHiOrder),
        levelDb: 0,
      },
      hornBand(cfg, 0),
    ],
  );

/** The tower: the sub, the mid chamber and the horn section in one shell, all three bands crossed inside it. */
function towerSpeaker(cfg: PaDesignConfig, system: SpecIdentity): SpeakerSpec {
  const horn = byIdOrThrow(HORN_OPTIONS, cfg.horn, CATALOG_TABLE_NAMES.horns);
  const tower = towerSpec(cfg.cDim, cfg.wall, horn);
  const midDims = towerMidDims(cfg.cDim);
  /** the horn section's floor: the mid chamber's top */
  const hornFloor = cfg.cDim.h + midDims.h;
  return paSpeaker(
    cfg,
    system,
    SPEAKER_TEMPLATE.tower,
    paCabinet(cfg, [
      subChamber(cfg),
      sealedChamber(midDims, [midDriver(cfg, tower.midCenter - cfg.cDim.h)]),
      sealedChamber({ w: cfg.cDim.w, h: tower.hornSectionH, d: cfg.cDim.d }, [
        hornDriver(cfg, HORN_PLACEMENT.baffle, { xIn: 0, yIn: tower.hornCenter - hornFloor }),
      ]),
    ]),
    [
      { ...subBand(cfg), lowpass: lrFilter(cfg.xoLo, cfg.xoLoOrder) },
      {
        id: SPEAKER_BAND.mid,
        highpass: lrFilter(cfg.xoLo, cfg.xoLoOrder),
        lowpass: lrFilter(cfg.xoHi, cfg.xoHiOrder),
        levelDb: -cfg.tilt,
      },
      hornBand(cfg, cfg.tilt),
    ],
  );
}

/** A source standing on the floor at a stack's spot, `liftIn` up (a stand). */
const onFloor = (spot: CoverageLayout["stacks"][number], liftIn = 0): SourcePose => ({
  ...spot,
  on: null,
  liftIn,
});

/** The system around its sources: an amp per band at the design's power, the mains rack's DSP, no venue. */
const paSystem = (
  cfg: PaDesignConfig,
  system: SpecIdentity,
  sources: SystemSpec["sources"],
): SystemSpec => ({
  ...system,
  sources,
  amps: [
    { id: SPEAKER_BAND.low, model: null, watts: cfg.ampW },
    { id: SPEAKER_BAND.mid, model: null, watts: cfg.mAmpW },
    { id: SPEAKER_BAND.high, model: null, watts: cfg.hfAmpW },
  ],
  dsp: mainsDsp().id,
  venue: null,
});

/**
 * The PA design as a system: its speakers and its sources, the tops at the coverage page's stack spots (`stacks`, left
 * then right). Stack and pole: a sub under each top, the top on it (on the pole's spacer). Satellite: one sub on the
 * floor midway, the tops on their stands. Tower: a tower at each spot. Each band has an amp, as the design powers it;
 * the DSP is the mains rack's.
 */
export function systemFromPa(
  cfg: PaDesignConfig,
  system: SpecIdentity,
  stacks: CoverageLayout["stacks"],
): SystemWithSpeakers {
  const channel = channelCounter();
  /** each speaker's id, as `speakerIdentity` gives it: a source names a speaker that is built only when used */
  const idOf = (template: SpeakerTemplate) => speakerIdentity(system, template).id;
  const subSource = (pose: SourcePose, mirror: boolean): SystemSource => ({
    speakerId: idOf(SPEAKER_TEMPLATE.sub),
    role: SOURCE_ROLE.sub,
    pose,
    mirror,
    filters: { highpass: null, lowpass: lrFilter(cfg.xoLo, cfg.xoLoOrder) },
    delayMs: AUTO_DELAY,
    levelDb: 0,
    channels: [channel(SPEAKER_BAND.low, [SPEAKER_BAND.low])],
  });
  const topSource = (pose: SourcePose, mirror: boolean): SystemSource => ({
    speakerId: idOf(SPEAKER_TEMPLATE.top),
    role: SOURCE_ROLE.main,
    pose,
    mirror,
    filters: { highpass: lrFilter(cfg.xoLo, cfg.xoLoOrder), lowpass: null },
    delayMs: 0,
    levelDb: -cfg.tilt,
    channels: [
      channel(SPEAKER_BAND.mid, [SPEAKER_BAND.mid]),
      channel(SPEAKER_BAND.high, [SPEAKER_BAND.high]),
    ],
  });
  const towerSource = (pose: SourcePose, mirror: boolean): SystemSource => ({
    speakerId: idOf(SPEAKER_TEMPLATE.tower),
    role: SOURCE_ROLE.main,
    pose,
    mirror,
    filters: NO_FILTERS,
    delayMs: 0,
    levelDb: 0,
    channels: [SPEAKER_BAND.low, SPEAKER_BAND.mid, SPEAKER_BAND.high].map((band) =>
      channel(band, [band]),
    ),
  });
  const [left, right] = stacks;
  /** a sub and a top on it at each spot, the top `liftIn` above the sub (sources: sub 0, top 1, sub 2, top 3) */
  const stacked = (liftIn: number): SystemWithSpeakers => ({
    speakers: [subSpeaker(cfg, system), topSpeaker(cfg, system)],
    system: paSystem(cfg, system, [
      subSource(onFloor(left), false),
      topSource({ ...left, on: 0, liftIn }, false),
      subSource(onFloor(right), true),
      topSource({ ...right, on: 2, liftIn }, true),
    ]),
  });
  const LAYOUTS: Record<PaLayout, () => SystemWithSpeakers> = {
    stack: () => stacked(MID_GAP_IN),
    pole: () => stacked(cfg.spacerH ?? DEFAULT_PA.spacerH),
    satellite: () => ({
      speakers: [subSpeaker(cfg, system), topSpeaker(cfg, system)],
      system: paSystem(cfg, system, [
        subSource(onFloor({ x: (left.x + right.x) / 2, y: (left.y + right.y) / 2, aim: 0 }), false),
        topSource(onFloor(left, SATELLITE_COLUMN_H_IN), false),
        topSource(onFloor(right, SATELLITE_COLUMN_H_IN), true),
      ]),
    }),
    tower: () => ({
      speakers: [towerSpeaker(cfg, system)],
      system: paSystem(cfg, system, [
        towerSource(onFloor(left), false),
        towerSource(onFloor(right), true),
      ]),
    }),
  };
  return LAYOUTS[cfg.layout]();
}
