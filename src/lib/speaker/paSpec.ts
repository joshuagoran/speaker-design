// Read adapter: the PA page's design (PaPlannerDesign) as speaker specs and a system spec. Pure; nothing is written.
//
// Stack, pole and satellite: a sub box (one vented chamber) and a mid/high box (one sealed chamber, the horn on its
// lid), each its own cabinet. Tower: one cabinet of three chambers stacked: the sub, the mid and the horn section,
// the horn in the baffle. The crossover between the sub and the tops is the system's; the one inside a box is the
// box's.
import type {
  CoverageLayout,
  FacePoint,
  HornPlacement,
  PaLayout,
  PaPlannerDesign,
  PortStyle,
  SourcePose,
  SpeakerBand,
  SpeakerCabinet,
  SpeakerChamber,
  SpeakerDriver,
  SpeakerPart,
  SpeakerPort,
  SpeakerSpec,
  SpecIdentity,
  SubDriver,
  SystemSource,
  SystemSpec,
  SystemWithSpeakers,
} from "../../types";
import { HORN_OPTIONS, SUB_OPTIONS, mainsDsp } from "../data";
import { byIdOrThrow } from "../tables";
import { STUFFING_VOLUME_GAIN, slotFolds, subDriverCenter } from "../pa/calc";
import { modelTubeElbows } from "../pa/tubes";
import { towerMidDims, towerSpec } from "../pa/tower";
import { takesHornMount } from "../pa/hornMount";
import { CATALOG_TABLE_NAMES } from "../../constants/catalogTables";
import { PLYWOOD_MATERIAL } from "../../constants/panelSizes";
import { MID_GAP_IN, PLINTH_HEIGHT_IN, SATELLITE_COLUMN_H_IN } from "../../constants/paLayouts";
import { HIFI_DRIVE } from "../../constants/hifiEngine";
import {
  AUTO_DELAY,
  DRIVER_KIND,
  FRONT_END_KIND,
  HORN_PLACEMENT,
  PA_SLOT_FINS,
  PORT_SHAPE,
  SOURCE_ROLE,
  SPEAKER_BAND,
  SPEAKER_PART,
  VENT_KIND,
} from "../../constants/speakerSpec";
import {
  DIRECT_LOAD,
  NO_FILTERS,
  channelCounter,
  lrFilter,
  speakerIdentity,
  stuffingPctOf,
} from "./specParts";

/** The sub's round tubes as a round port: `nt` tubes of `dia`, `len` long, with the elbows the model takes. */
const roundTubes = (cfg: PaPlannerDesign, sub: SubDriver): SpeakerPort => ({
  shape: PORT_SHAPE.round,
  n: cfg.cVent.nt,
  dia: cfg.cVent.dia,
  len: cfg.cVent.len,
  elbows: modelTubeElbows(cfg.cDim, cfg.portStyle, cfg.cVent, cfg.wall, cfg.inset, sub),
  flared: true,
  corners: cfg.portStyle === "round4",
});

/** The sub's side ducts: `n` of them, each `throat` wide and `len` long, with their dividers. */
const sideDucts = (cfg: PaPlannerDesign, n: 1 | 2): SpeakerPort => ({
  shape: PORT_SHAPE.duct,
  n,
  throat: cfg.cVent.throat,
  len: cfg.cVent.len,
  div: cfg.cVent.div,
});

/** The sub's vent as a chamber's port, by port style. */
const PA_PORTS: Record<PortStyle, (cfg: PaPlannerDesign, sub: SubDriver) => SpeakerPort> = {
  // the letterbox: split by its fins, folded up the back wall when too long to run straight
  slots: (cfg) => ({
    shape: PORT_SHAPE.slot,
    n: 1,
    h: cfg.cVent.slotH,
    len: cfg.cVent.len,
    fins: PA_SLOT_FINS,
    folded: slotFolds(cfg.cDim, cfg.cVent, cfg.wall),
  }),
  vslots: (cfg) => sideDucts(cfg, 2),
  vslot1: (cfg) => sideDucts(cfg, 1),
  round1: roundTubes,
  round2: roundTubes,
  round4: roundTubes,
};

/** The sub box: one vented chamber at the cabinet's bottom, the sub where the 3D view puts it. */
function subChamber(cfg: PaPlannerDesign): SpeakerChamber {
  const sub = byIdOrThrow(SUB_OPTIONS, cfg.sub, CATALOG_TABLE_NAMES.subs);
  // in from the box's inside corner: to the center line, and up from the outside bottom
  const center = subDriverCenter(cfg.cDim, cfg.wall, cfg.portStyle, cfg.cVent, sub.size);
  const position = { xIn: center.x - (cfg.cDim.w / 2 - cfg.wall), yIn: center.y + cfg.wall };
  return {
    at: { xIn: 0, yIn: 0 },
    dims: cfg.cDim,
    netLiters: null,
    stuffingPct: 0,
    vent: { kind: VENT_KIND.vented, port: PA_PORTS[cfg.portStyle](cfg, sub) },
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
const midDriver = (cfg: PaPlannerDesign, yIn: number): SpeakerDriver => ({
  kind: DRIVER_KIND.mid,
  driverId: cfg.mid,
  count: 1,
  position: { xIn: 0, yIn },
  bands: [SPEAKER_BAND.mid],
  horn: null,
});

/** The compression driver on its horn, placed on the lid or in the baffle, with the lid's mount where it applies. */
function hornDriver(
  cfg: PaPlannerDesign,
  placement: HornPlacement,
  position: FacePoint,
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
      mount: takesHornMount(horn, cfg.layout) ? cfg.hornMount : null,
    },
  };
}

/**
 * A sealed chamber at `at` in its cabinet, of `dims`, with these drivers: stuffed as the PA stuffs its mids where it
 * holds the mid, else bare (the horn section).
 */
const sealedChamber = (
  at: SpeakerChamber["at"],
  dims: SpeakerChamber["dims"],
  drivers: SpeakerChamber["drivers"],
): SpeakerChamber => ({
  at,
  dims,
  netLiters: null,
  stuffingPct: drivers.some((d) => d.kind === DRIVER_KIND.mid)
    ? stuffingPctOf(STUFFING_VOLUME_GAIN)
    : 0,
  vent: { kind: VENT_KIND.sealed },
  load: DIRECT_LOAD,
  drivers,
});

/** The plywood shell: the design's panels, inset and bracing; the PA boxes stand upright with sharp-edged baffles. */
const paCabinet = (cfg: PaPlannerDesign, chambers: SpeakerCabinet["chambers"]): SpeakerCabinet => ({
  chambers,
  panel: { nominal: cfg.panel, material: PLYWOOD_MATERIAL, thicknessIn: cfg.wall },
  insetIn: cfg.inset,
  roundoverIn: 0,
  tiltDeg: 0,
  braceStyle: cfg.braceStyle,
  backJoint: cfg.backJoint,
});

/** An active band: its own amp channel, its filters in the DSP. */
const activeBand = (
  id: SpeakerBand["id"],
  filters: Pick<SpeakerBand, "highpass" | "lowpass">,
  levelDb: number,
): SpeakerBand => ({ id, ...filters, levelDb, drive: HIFI_DRIVE.active });

/** The sub band's own filter: the subsonic highpass. */
const subBand = (cfg: PaPlannerDesign, lowpass: SpeakerBand["lowpass"]) =>
  activeBand(SPEAKER_BAND.low, { highpass: { hz: cfg.hpf, type: cfg.hpType }, lowpass }, 0);

/** The horn band: above the mid-to-horn crossover, `hfTilt` below the mid band, which is `midDb` below the box's top. */
const hornBand = (cfg: PaPlannerDesign, midDb: number) =>
  activeBand(
    SPEAKER_BAND.high,
    { highpass: lrFilter(cfg.xoHi, cfg.xoHiOrder), lowpass: null },
    -(midDb + cfg.hfTilt),
  );

/** One PA box as a speaker spec. */
const paSpeaker = (
  cfg: PaPlannerDesign,
  system: SpecIdentity,
  part: SpeakerPart,
  cabinet: SpeakerCabinet,
  bands: SpeakerSpec["bands"],
): SpeakerSpec => ({
  ...speakerIdentity(system, part),
  cabinet,
  bands,
  look: { cabFinish: cfg.cabFinish, baffleColor: cfg.baffleColor, hornColor: cfg.hornColor },
});

/** The sub box of the stack, pole and satellite layouts. */
const subSpeaker = (cfg: PaPlannerDesign, system: SpecIdentity) =>
  paSpeaker(cfg, system, SPEAKER_PART.sub, paCabinet(cfg, [subChamber(cfg)]), [subBand(cfg, null)]);

/** The mid/high box: the mid in a sealed box, the horn on its lid, crossed inside the box. */
const topSpeaker = (cfg: PaPlannerDesign, system: SpecIdentity) =>
  paSpeaker(
    cfg,
    system,
    SPEAKER_PART.top,
    paCabinet(cfg, [
      sealedChamber({ xIn: 0, yIn: 0 }, cfg.mDim, [
        midDriver(cfg, cfg.mDim.h / 2),
        hornDriver(cfg, HORN_PLACEMENT.top, { xIn: 0, yIn: 0 }),
      ]),
    ]),
    [
      activeBand(
        SPEAKER_BAND.mid,
        { highpass: null, lowpass: lrFilter(cfg.xoHi, cfg.xoHiOrder) },
        0,
      ),
      hornBand(cfg, 0),
    ],
  );

/**
 * The tower: the sub, the mid chamber and the horn section stacked in one shell, all three bands crossed inside it.
 * Each partition is the top wall of the chamber below it (`SpeakerChamber.dims`), as `towerSpec` builds them.
 */
function towerSpeaker(cfg: PaPlannerDesign, system: SpecIdentity): SpeakerSpec {
  const horn = byIdOrThrow(HORN_OPTIONS, cfg.horn, CATALOG_TABLE_NAMES.horns);
  const tower = towerSpec(cfg.cDim, cfg.wall, horn);
  const midDims = towerMidDims(cfg.cDim);
  /** the horn section's floor: the mid chamber's top */
  const hornFloor = cfg.cDim.h + midDims.h;
  return paSpeaker(
    cfg,
    system,
    SPEAKER_PART.tower,
    paCabinet(cfg, [
      subChamber(cfg),
      sealedChamber({ xIn: 0, yIn: cfg.cDim.h }, midDims, [
        midDriver(cfg, tower.midCenter - cfg.cDim.h),
      ]),
      sealedChamber(
        { xIn: 0, yIn: hornFloor },
        { w: cfg.cDim.w, h: tower.hornSectionH, d: cfg.cDim.d },
        [hornDriver(cfg, HORN_PLACEMENT.baffle, { xIn: 0, yIn: tower.hornCenter - hornFloor })],
      ),
    ]),
    [
      subBand(cfg, lrFilter(cfg.xoLo, cfg.xoLoOrder)),
      activeBand(
        SPEAKER_BAND.mid,
        {
          highpass: lrFilter(cfg.xoLo, cfg.xoLoOrder),
          lowpass: lrFilter(cfg.xoHi, cfg.xoHiOrder),
        },
        -cfg.tilt,
      ),
      hornBand(cfg, cfg.tilt),
    ],
  );
}

/** A source standing on the floor at a stack's spot, `liftIn` up (the plinth, a stand). */
const onFloor = (spot: CoverageLayout["stacks"][number], liftIn: number): SourcePose => ({
  ...spot,
  on: null,
  liftIn,
});

/** The system around its sources: an amp per band at the design's power, the mains rack's DSP, no venue. */
const paSystem = (
  cfg: PaPlannerDesign,
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
  frontEnd: { kind: FRONT_END_KIND.digital, dspId: mainsDsp().id },
  venue: null,
});

/**
 * The PA design as a system: its speakers and its sources, the tops at the coverage page's stack spots (`stacks`, left
 * then right). Stack and pole: a sub on its plinth under each top, the top on it (on the pole's spacer). Satellite:
 * one sub on its plinth midway, the tops on their stands. Tower: a tower on its plinth at each spot. Each band has an
 * amp, as the design powers it; the DSP is the mains rack's.
 */
export function systemFromPa(
  cfg: PaPlannerDesign,
  system: SpecIdentity,
  stacks: CoverageLayout["stacks"],
): SystemWithSpeakers {
  const channel = channelCounter();
  /** each speaker's id, as `speakerIdentity` gives it: a source names a speaker that is built only when used */
  const idOf = (part: SpeakerPart) => speakerIdentity(system, part).id;
  const subSource = (pose: SourcePose, mirror: boolean): SystemSource => ({
    speakerId: idOf(SPEAKER_PART.sub),
    role: SOURCE_ROLE.sub,
    pose,
    mirror,
    filters: { highpass: null, lowpass: lrFilter(cfg.xoLo, cfg.xoLoOrder) },
    delayMs: AUTO_DELAY,
    levelDb: 0,
    channels: [channel(SPEAKER_BAND.low, [SPEAKER_BAND.low])],
  });
  const topSource = (pose: SourcePose, mirror: boolean): SystemSource => ({
    speakerId: idOf(SPEAKER_PART.top),
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
    speakerId: idOf(SPEAKER_PART.tower),
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
      subSource(onFloor(left, PLINTH_HEIGHT_IN), false),
      topSource({ ...left, on: 0, liftIn }, false),
      subSource(onFloor(right, PLINTH_HEIGHT_IN), true),
      topSource({ ...right, on: 2, liftIn }, true),
    ]),
  });
  const LAYOUTS: Record<PaLayout, () => SystemWithSpeakers> = {
    stack: () => stacked(MID_GAP_IN),
    pole: () => stacked(cfg.spacerH),
    satellite: () => ({
      speakers: [subSpeaker(cfg, system), topSpeaker(cfg, system)],
      system: paSystem(cfg, system, [
        subSource(
          onFloor(
            { x: (left.x + right.x) / 2, y: (left.y + right.y) / 2, aim: 0 },
            PLINTH_HEIGHT_IN,
          ),
          false,
        ),
        topSource(onFloor(left, SATELLITE_COLUMN_H_IN), false),
        topSource(onFloor(right, SATELLITE_COLUMN_H_IN), true),
      ]),
    }),
    tower: () => ({
      speakers: [towerSpeaker(cfg, system)],
      system: paSystem(cfg, system, [
        towerSource(onFloor(left, PLINTH_HEIGHT_IN), false),
        towerSource(onFloor(right, PLINTH_HEIGHT_IN), true),
      ]),
    }),
  };
  return LAYOUTS[cfg.layout]();
}
