// Read adapter: the PA page's design (PaPlannerDesign) as speaker specs, a stack and a space. Pure; nothing is
// written.
//
// Stack, pole and satellite: a sub box (one vented chamber) and a mid/high box (one sealed chamber, the horn on its
// lid), each its own cabinet. Tower: one cabinet of three chambers stacked: the sub, the mid and the horn section,
// the horn in the baffle. The crossover between the sub and the tops is the stack's; the one inside a box is the
// box's.
import type {
  AdapterBandId,
  CoverageLayout,
  FacePoint,
  HornPlacement,
  PaLayout,
  PaPlannerDesign,
  DesignLayers,
  PortStyle,
  SpacePlacement,
  SpaceVenue,
  SpeakerBand,
  SpeakerCabinet,
  SpeakerChamber,
  SpeakerDriver,
  SpeakerPart,
  SpeakerPort,
  SpeakerSpec,
  SpecIdentity,
  StackMember,
  StackPose,
  StackSpec,
  SubDriver,
} from "../../types";
import { HORN_OPTIONS, SUB_OPTIONS } from "../data";
import { byIdOrThrow } from "../tables";
import { STUFFING_VOLUME_GAIN, slotFinsOf, subDriverCenter, ventSpeedLimit } from "../pa/calc";
import { modelTubeElbows } from "../pa/tubes";
import { towerMidDims, towerSpec } from "../pa/tower";
import { takesHornMount } from "../pa/hornMount";
import { PA_PANEL_TARGET_HZ } from "../pa/bracing";
import { defaultBraceStyleNear } from "../bracing";
import { DEFAULT_BACK_JOINT } from "../../constants/bracing";
import { CATALOG_TABLE_NAMES } from "../../constants/catalogTables";
import { PLYWOOD_MATERIAL } from "../../constants/panelSizes";
import { MID_GAP_IN, PLINTH_HEIGHT_IN, SATELLITE_COLUMN_H_IN } from "../../constants/paLayouts";
import { HIFI_DRIVE } from "../../constants/hifiEngine";
import { AUTO_BALANCE_MODE } from "../../constants/autoBalance";
import {
  AUTO_DELAY,
  CABINET_CONSTRUCTION,
  CABINET_TOP,
  DRIVER_KIND,
  HORN_PLACEMENT,
  PORT_SHAPE,
  SPACE_ITEM,
  SPEAKER_BAND,
  SPEAKER_BAND_NAMES,
  SPEAKER_PART,
  VENT_KIND,
} from "../../constants/speakerSpec";
import {
  BASE_POSE,
  DIRECT_LOAD,
  NO_FILTERS,
  lrFilter,
  roomCenter,
  spacePlacement,
  speakerIdentity,
  stackMember,
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
  divider: cfg.divider,
});

/** The sub's vent as a chamber's port, by port style. */
const PA_PORTS: Record<PortStyle, (cfg: PaPlannerDesign, sub: SubDriver) => SpeakerPort> = {
  // the letterbox: split by its fins (the PA rule folds it up the back wall when too long to run straight)
  slots: (cfg) => ({
    shape: PORT_SHAPE.slot,
    n: 1,
    h: cfg.cVent.slotH,
    len: cfg.cVent.len,
    fins: slotFinsOf(cfg.cVent, cfg.cDim.w - 2 * cfg.wall, cfg.wall),
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
    vent: {
      kind: VENT_KIND.vented,
      port: PA_PORTS[cfg.portStyle](cfg, sub),
      // the design's setting, more for flared tubes (as the PA page takes it)
      maxSpeedMs: ventSpeedLimit(cfg.portStyle, cfg.portMax),
    },
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

/**
 * The plywood shell: the PA's frame with its inset baffle (an inset of 0 too), the design's panels, inset and bracing,
 * the box's `hardware` (its handles, as the PA page sets them), and the `top` given (flat but on the tower, whose horn
 * can arch it); the PA boxes stand upright with sharp-edged baffles.
 */
const paCabinet = (
  cfg: PaPlannerDesign,
  chambers: SpeakerCabinet["chambers"],
  hardware: SpeakerCabinet["hardware"],
  top: SpeakerCabinet["top"] = CABINET_TOP.flat,
): SpeakerCabinet => ({
  hardware,
  chambers,
  panel: { nominal: cfg.panel, material: PLYWOOD_MATERIAL, thicknessIn: cfg.wall },
  construction: CABINET_CONSTRUCTION.frameInset,
  top,
  insetIn: cfg.inset,
  roundoverIn: 0,
  tiltDeg: 0,
  // the PA page's style (the plywood's where it sets none), back joint and panel target
  braceStyle: cfg.braceStyle ?? defaultBraceStyleNear(cfg.wall),
  backJoint: cfg.backJoint ?? DEFAULT_BACK_JOINT,
  braceTargetHz: PA_PANEL_TARGET_HZ,
});

/** An active band: its own amp channel of `ampW`, its filters in the DSP. */
const activeBand = (
  id: AdapterBandId,
  filters: Pick<SpeakerBand, "highpass" | "lowpass">,
  levelDb: number,
  ampW: SpeakerBand["ampW"],
): SpeakerBand => ({
  id,
  name: SPEAKER_BAND_NAMES[id],
  ...filters,
  levelDb,
  drive: HIFI_DRIVE.active,
  ampW,
});

/** The sub band's own filter: the subsonic highpass; on the sub amp. */
const subBand = (cfg: PaPlannerDesign, lowpass: SpeakerBand["lowpass"]) =>
  activeBand(
    SPEAKER_BAND.low,
    { highpass: { hz: cfg.hpf, type: cfg.hpType }, lowpass },
    0,
    cfg.ampW,
  );

/**
 * The horn band: above the mid-to-horn crossover, `hfTilt` below the mid band, which is `midDb` below the box's top; on
 * the HF amp.
 */
const hornBand = (cfg: PaPlannerDesign, midDb: number) =>
  activeBand(
    SPEAKER_BAND.high,
    { highpass: lrFilter(cfg.xoHi, cfg.xoHiOrder), lowpass: null },
    -(midDb + cfg.hfTilt),
    cfg.hfAmpW,
  );

/** One PA box as a speaker spec. */
const paSpeaker = (
  cfg: PaPlannerDesign,
  design: SpecIdentity,
  part: SpeakerPart,
  cabinet: SpeakerCabinet,
  bands: SpeakerSpec["bands"],
  input: SpeakerSpec["input"],
): SpeakerSpec => ({
  ...speakerIdentity(design, part),
  cabinet,
  bands,
  input,
  look: { cabFinish: cfg.cabFinish, baffleColor: cfg.baffleColor, hornColor: cfg.hornColor },
});

/** The sub box's input range: below the crossover to the tops (its own subsonic stays in its band). */
const subInput = (cfg: PaPlannerDesign): SpeakerSpec["input"] => ({
  highpass: null,
  lowpass: lrFilter(cfg.xoLo, cfg.xoLoOrder),
});

/** The mid/high box's input range: above the crossover to the subs. */
const topInput = (cfg: PaPlannerDesign): SpeakerSpec["input"] => ({
  highpass: lrFilter(cfg.xoLo, cfg.xoLoOrder),
  lowpass: null,
});

/** The sub box of the stack, pole and satellite layouts. */
const subSpeaker = (cfg: PaPlannerDesign, design: SpecIdentity) =>
  paSpeaker(
    cfg,
    design,
    SPEAKER_PART.sub,
    paCabinet(cfg, [subChamber(cfg)], cfg.hardware.sub),
    [subBand(cfg, null)],
    subInput(cfg),
  );

/** The mid/high box: the mid in a sealed box, the horn on its lid, crossed inside the box. */
const topSpeaker = (cfg: PaPlannerDesign, design: SpecIdentity) =>
  paSpeaker(
    cfg,
    design,
    SPEAKER_PART.top,
    paCabinet(
      cfg,
      [
        sealedChamber({ xIn: 0, yIn: 0 }, cfg.mDim, [
          midDriver(cfg, cfg.mDim.h / 2),
          hornDriver(cfg, HORN_PLACEMENT.top, { xIn: 0, yIn: 0 }),
        ]),
      ],
      cfg.hardware.mid,
    ),
    [
      activeBand(
        SPEAKER_BAND.mid,
        { highpass: null, lowpass: lrFilter(cfg.xoHi, cfg.xoHiOrder) },
        0,
        cfg.mAmpW,
      ),
      hornBand(cfg, 0),
    ],
    topInput(cfg),
  );

/**
 * The tower: the sub, the mid chamber and the horn section stacked in one shell, all three bands crossed inside it.
 * Each partition is the top wall of the chamber below it (`SpeakerChamber.dims`), as `towerSpec` builds them, and the
 * top is arched where `towerSpec` arches it (a round horn narrower than the cabinet).
 */
function towerSpeaker(cfg: PaPlannerDesign, design: SpecIdentity): SpeakerSpec {
  const horn = byIdOrThrow(HORN_OPTIONS, cfg.horn, CATALOG_TABLE_NAMES.horns);
  const tower = towerSpec(cfg.cDim, cfg.wall, horn);
  const midDims = towerMidDims(cfg.cDim);
  /** the horn section's floor: the mid chamber's top */
  const hornFloor = cfg.cDim.h + midDims.h;
  return paSpeaker(
    cfg,
    design,
    SPEAKER_PART.tower,
    paCabinet(
      cfg,
      [
        subChamber(cfg),
        sealedChamber({ xIn: 0, yIn: cfg.cDim.h }, midDims, [
          midDriver(cfg, tower.midCenter - cfg.cDim.h),
        ]),
        sealedChamber(
          { xIn: 0, yIn: hornFloor },
          { w: cfg.cDim.w, h: tower.hornSectionH, d: cfg.cDim.d },
          [hornDriver(cfg, HORN_PLACEMENT.baffle, { xIn: 0, yIn: tower.hornCenter - hornFloor })],
        ),
      ],
      // the tower's one cabinet takes the sub box's hardware (lib/pa/hardware boxTakesHardware)
      cfg.hardware.sub,
      tower.archTop ? CABINET_TOP.arched : CABINET_TOP.flat,
    ),
    [
      subBand(cfg, lrFilter(cfg.xoLo, cfg.xoLoOrder)),
      activeBand(
        SPEAKER_BAND.mid,
        {
          highpass: lrFilter(cfg.xoLo, cfg.xoLoOrder),
          lowpass: lrFilter(cfg.xoHi, cfg.xoHiOrder),
        },
        -cfg.tilt,
        cfg.mAmpW,
      ),
      hornBand(cfg, cfg.tilt),
    ],
    // every crossover is inside the tower
    NO_FILTERS,
  );
}

/**
 * The PA design's stack: the sub with the top on it (a gap, or the pole's spacer), the top on its stand beside the sub
 * (satellite), or the tower alone. The crossover between the sub and the top is each member's. The sub's delay is
 * auto (`AUTO_DELAY`): in phase with the top's mid at the crossover, as the coverage page aligns it, the top waiting
 * where the sub has to play early. The top sits `tilt` below the sub, as the tower's mid band does.
 */
function paStack(cfg: PaPlannerDesign, design: SpecIdentity): StackSpec {
  const idOf = (part: SpeakerPart) => speakerIdentity(design, part).id;
  const sub: StackMember = {
    ...stackMember(idOf(SPEAKER_PART.sub), subInput(cfg)),
    delayMs: AUTO_DELAY,
  };
  const top = (pose: StackPose): StackMember => ({
    ...stackMember(idOf(SPEAKER_PART.top), topInput(cfg), pose),
    levelDb: -cfg.tilt,
  });
  /** the top `yIn` above the sub's top */
  const onSub = (yIn: number): StackMember[] => [sub, top({ ...BASE_POSE, yIn, on: 0 })];
  const MEMBERS: Record<PaLayout, () => StackMember[]> = {
    stack: () => onSub(MID_GAP_IN),
    pole: () => onSub(cfg.spacerH),
    // the top's stand stands on the floor, the sub on its plinth: the stack's base is the plinth's top
    satellite: () => [
      sub,
      top({
        ...BASE_POSE,
        xIn: (cfg.cDim.w + cfg.mDim.w) / 2,
        yIn: SATELLITE_COLUMN_H_IN - PLINTH_HEIGHT_IN,
      }),
    ],
    tower: () => [stackMember(idOf(SPEAKER_PART.tower), NO_FILTERS)],
  };
  return { ...design, members: MEMBERS[cfg.layout](), notes: "" };
}

/** The coverage page's floor as the PA design's space takes it: where the stacks stand, the room and the listener. */
export type PaFloor = Pick<
  CoverageLayout,
  "stacks" | "mirror" | "room" | "listener" | "earFt" | "targetDb" | "levelRef"
>;

/**
 * The coverage page's floor as a venue: its room, listener, ear height and target, measured where the page measures it.
 */
export function paVenue(floor: PaFloor): SpaceVenue {
  const { room } = floor;
  return {
    room,
    listener: floor.listener,
    alignAt: roomCenter(room),
    earFt: floor.earFt,
    targetDb: floor.targetDb,
    // as the coverage page: its target in the sub band, measured where it measures it, under the PA music balance
    levelRef: floor.levelRef,
    balance: AUTO_BALANCE_MODE.moreBass,
  };
}

/**
 * The PA design read in: its speakers, its stack (`paStack`) and its space on the coverage page's floor: the stacks at
 * its spots (`stacks`, left then right; where the page mirrors them, one mirrored placement stands for both)
 * on their plinths. Satellite places no stack: one sub on its plinth midway, and the tops on their stands at the spots,
 * each on its own input range, `tilt` under the sub as in the stack. Each band's amp power is the design's; the venue
 * is the page's room and listener (`paVenue`).
 */
export function layersFromPa(
  cfg: PaPlannerDesign,
  design: SpecIdentity,
  floor: PaFloor,
): DesignLayers {
  const stack = paStack(cfg, design);
  const tower = cfg.layout === "tower";
  const speakers = tower
    ? [towerSpeaker(cfg, design)]
    : [subSpeaker(cfg, design), topSpeaker(cfg, design)];
  const [subId, topId] = speakers.map((s) => s.id);
  const [left, right] = floor.stacks;
  const stackItem = { kind: SPACE_ITEM.stack, id: stack.id } as const;
  const speakerItem = (id: SpeakerSpec["id"]) => ({ kind: SPACE_ITEM.speaker, id }) as const;
  /** the placements of `item` at the left and right spots: one mirrored placement where the page mirrors them */
  const pair = (item: SpacePlacement["item"], liftIn: number) =>
    floor.mirror
      ? [spacePlacement(left, item, liftIn, { yawDeg: left.aim, mirrored: true })]
      : [
          spacePlacement(left, item, liftIn, { yawDeg: left.aim }),
          spacePlacement(right, item, liftIn, { yawDeg: right.aim, mirror: true }),
        ];
  const placements: SpacePlacement[] =
    cfg.layout === "satellite"
      ? [
          spacePlacement(
            { x: (left.x + right.x) / 2, y: (left.y + right.y) / 2 },
            speakerItem(subId),
            PLINTH_HEIGHT_IN,
          ),
          ...pair(speakerItem(topId), SATELLITE_COLUMN_H_IN).map((p) => ({
            ...p,
            levelDb: -cfg.tilt,
          })),
        ]
      : pair(stackItem, PLINTH_HEIGHT_IN);
  return {
    speakers,
    stack,
    space: {
      ...design,
      placements,
      venue: paVenue(floor),
    },
  };
}
