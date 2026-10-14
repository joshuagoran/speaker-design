// The speaker spec (lib/speaker): every golden design reads into it with its key facts (boxes, drivers,
// vents, crossovers, layout), and horn chambers read into designs the horn engine models.
import { PA_FLOOR } from "./speaker-cases";
import { test } from "vite-plus/test";
import assert from "node:assert";
import { configs, fillConfigs, type GoldenConfig } from "./golden-configs";
import { layersFromPa } from "../src/lib/speaker/paSpec";
import { layersFromHifi, speakerFromHifi } from "../src/lib/speaker/hifiSpec";
import { layersFromFill } from "../src/lib/speaker/fillSpec";
import { hornDesignOf } from "../src/lib/speaker/hornDesign";
import { chamberClearFace } from "../src/lib/speaker/chamberAir";
import { speakerIdentity } from "../src/lib/speaker/specParts";
import { expandPlacements } from "../src/lib/speaker/spaceLayout";
import { paSearchDesign } from "../src/lib/pa/optimize";
import { towerMidDims, towerSpec } from "../src/lib/pa/tower";
import { boxInternalLiters, midGrossLiters } from "../src/lib/pa/calc";
import { needsWaveguide } from "../src/lib/hifi/hifi";
import { panelNominalNear } from "../src/lib/panel";
import { savedHardware } from "../src/lib/pa/hardware";
import { byIdOrThrow } from "../src/lib/tables";
import { CATALOG_TABLE_NAMES } from "../src/constants/catalogTables";
import { hornGrid, hornModel } from "../src/lib/acoustics/hornModel";
import { deriveHifiDesign } from "../src/lib/hifi/hifiDesign";
import {
  FILL_OPTIONS,
  HIFI_COAXES,
  HIFI_TWEETERS,
  HIFI_WAVEGUIDES,
  HORN_OPTIONS,
  MID_BOXES,
} from "../src/lib/data";
import { DEFAULT_FILL, DEFAULT_HIFI, DEFAULT_HIFI_LOOK, DEFAULT_PA } from "../src/lib/defaults";
import { crossoverSlopeName } from "../src/constants/crossovers";
import { HIFI_DRIVE, HIFI_PORT_MAX_MS, HIFI_SUBSONIC_TYPE } from "../src/constants/hifiEngine";
import { HORN_PROFILE } from "../src/constants/hornEngine";
import { HORN_MOUNT_DEFAULT } from "../src/constants/hornMount";
import {
  MID_GAP_IN,
  PLINTH_HEIGHT_IN,
  SATELLITE_COLUMN_H_IN,
  TOWER_MID_HEIGHT_IN,
} from "../src/constants/paLayouts";
import { CM_PER_IN } from "../src/constants/units";
import {
  AUTO_DELAY,
  CABINET_CONSTRUCTION,
  CABINET_TOP,
  CHAMBER_LOAD,
  DRIVER_KIND,
  HORN_DRIVE,
  HORN_ENGINE_GAP,
  HORN_PATH,
  HORN_PLACEMENT,
  PA_SLOT_FINS,
  PORT_SHAPE,
  SPACE_ITEM,
  SPEAKER_BAND,
  SPEAKER_PART,
  VENT_KIND,
} from "../src/constants/speakerSpec";
import type {
  BandId,
  DesignLayers,
  DriverKind,
  FillDesignState,
  HifiDesignState,
  HornPlacement,
  PaLayout,
  PaPlannerDesign,
  PortStyle,
  SpeakerChamber,
  SpeakerPart,
  SpeakerPort,
  SpeakerSpec,
} from "../src/types";

/**
 * A golden PA design as the planner holds it: the search's defaults, and what the planner sets that an older seed
 * lacks (its mid box's size, the panel its walls are, the horn mount and spacer it starts on, its handles).
 */
function paDesign(c: GoldenConfig): PaPlannerDesign {
  const cfg = paSearchDesign({ cur: c });
  return {
    ...cfg,
    mDim: c.mDim || (MID_BOXES.find((b) => b.id === c.midBox) || MID_BOXES[0]).box,
    panel: c.panel ?? panelNominalNear(cfg.wall),
    hornMount: c.hornMount ?? HORN_MOUNT_DEFAULT,
    spacerH: c.spacerH ?? DEFAULT_PA.spacerH,
    hardware: savedHardware(c.hardware),
    divider: c.divider ?? DEFAULT_PA.divider,
  };
}

/** Every chamber's drivers of a kind. */
const driversOf = (s: SpeakerSpec, kind: DriverKind) =>
  s.cabinet.chambers.flatMap((ch) => ch.drivers.filter((d) => d.kind === kind));
/** The chamber holding a driver of a kind. */
function chamberOf(s: SpeakerSpec, kind: DriverKind): SpeakerChamber {
  const found = s.cabinet.chambers.find((ch) => ch.drivers.some((d) => d.kind === kind));
  assert.ok(found, `${s.name}: no chamber with a ${kind}`);
  return found;
}
function bandOf(s: SpeakerSpec, id: BandId) {
  const found = s.bands.find((b) => b.id === id);
  assert.ok(found, `${s.name}: no ${id} band`);
  return found;
}
/** A design's speaker by its part. */
function speakerOf({ stack, speakers }: DesignLayers, part: SpeakerPart) {
  const id = speakerIdentity(stack, part).id;
  const found = speakers.find((s) => s.id === id);
  assert.ok(found, `no ${part} speaker`);
  return found;
}

/** The port shape each PA port style reads as. */
const PA_PORT_SHAPE: Record<PortStyle, SpeakerPort["shape"]> = {
  slots: PORT_SHAPE.slot,
  vslots: PORT_SHAPE.duct,
  vslot1: PORT_SHAPE.duct,
  round1: PORT_SHAPE.round,
  round2: PORT_SHAPE.round,
  round4: PORT_SHAPE.round,
};
/**
 * How many speakers each layout's stack holds, how many placements its space has (the left and right are one mirrored
 * placement), and how many boxes the model stands from them.
 */
const PA_MEMBER_COUNT: Record<PaLayout, number> = { stack: 2, pole: 2, satellite: 2, tower: 1 };
const PA_PLACEMENT_COUNT: Record<PaLayout, number> = { stack: 1, pole: 1, satellite: 2, tower: 1 };
const PA_BOX_COUNT: Record<PaLayout, number> = { stack: 2, pole: 2, satellite: 3, tower: 2 };

/** Whether the design's horn arches the tower's top (lib/pa/tower `towerSpec`). */
const towerArches = (cfg: PaPlannerDesign) =>
  towerSpec(cfg.cDim, cfg.wall, byIdOrThrow(HORN_OPTIONS, cfg.horn, CATALOG_TABLE_NAMES.horns))
    .archTop;

/** The golden PA designs, and a pole layout (no seed has one). */
const paCases: GoldenConfig[] = [
  ...configs,
  { ...configs[0], name: "pole: tops on spacers", layout: "pole", spacerH: 18 },
];

test("speaker spec: every golden PA design reads into a stack with its boxes, drivers, vents and crossovers", () => {
  for (const c of paCases) {
    const cfg = paDesign(c);
    const read = layersFromPa(cfg, { id: "pa", name: c.name }, PA_FLOOR);
    const { stack, space, speakers } = read;
    const tower = cfg.layout === "tower";
    assert.equal(stack.members.length, PA_MEMBER_COUNT[cfg.layout], c.name);
    assert.equal(space.placements.length, PA_PLACEMENT_COUNT[cfg.layout], c.name);
    assert.equal(expandPlacements(space.placements).length, PA_BOX_COUNT[cfg.layout], c.name);
    for (const m of stack.members)
      assert.ok(
        speakers.some((sp) => sp.id === m.speakerId),
        `${c.name}: a member names a speaker`,
      );
    const subBox = speakerOf(read, tower ? SPEAKER_PART.tower : SPEAKER_PART.sub);
    const topBox = speakerOf(read, tower ? SPEAKER_PART.tower : SPEAKER_PART.top);
    assert.equal(speakers.length, tower ? 1 : 2, c.name);

    // the sub box: its size, vent and driver
    const subChamber = chamberOf(subBox, DRIVER_KIND.sub);
    assert.deepEqual(subChamber.at, { xIn: 0, yIn: 0 }, c.name);
    assert.deepEqual(subChamber.dims, cfg.cDim, c.name);
    assert.ok(subChamber.vent.kind === VENT_KIND.vented, c.name);
    const port = subChamber.vent.port;
    assert.equal(port.shape, PA_PORT_SHAPE[cfg.portStyle], c.name);
    assert.equal(port.len, cfg.cVent.len, c.name);
    // the PA's port details: the letterbox's fins (its fold is the PA rule's, from its length), the tubes' flares and
    // layout
    if (port.shape === PORT_SHAPE.slot)
      assert.deepEqual(
        [port.h, port.fins, port.folded],
        [cfg.cVent.slotH, PA_SLOT_FINS, undefined],
        c.name,
      );
    else if (port.shape === PORT_SHAPE.duct) assert.equal(port.throat, cfg.cVent.throat, c.name);
    else {
      assert.deepEqual([port.n, port.dia], [cfg.cVent.nt, cfg.cVent.dia], c.name);
      assert.equal(typeof port.elbows, "number", `${c.name}: the tubes carry their elbows`);
      assert.deepEqual([port.flared, port.corners], [true, cfg.portStyle === "round4"], c.name);
    }
    assert.equal(subChamber.stuffingPct, 0, `${c.name}: the sub is bare`);
    const [sub] = driversOf(subBox, DRIVER_KIND.sub);
    assert.deepEqual([sub.driverId, sub.count, sub.bands], [cfg.sub, 1, [SPEAKER_BAND.low]]);
    assert.ok(
      sub.position.yIn > 0 && sub.position.yIn < cfg.cDim.h,
      `${c.name}: sub on the baffle`,
    );
    assert.ok(Math.abs(sub.position.xIn) < cfg.cDim.w / 2, `${c.name}: sub on the baffle`);

    // the mid chamber: sealed, the design's size (the tower's: the sub's footprint)
    const midChamber = chamberOf(topBox, DRIVER_KIND.mid);
    assert.equal(midChamber.vent.kind, VENT_KIND.sealed, c.name);
    assert.equal(midChamber.stuffingPct, 15, `${c.name}: the PA stuffs its mids 15%`);
    assert.deepEqual(midChamber.dims, tower ? towerMidDims(cfg.cDim) : cfg.mDim, c.name);
    assert.equal(driversOf(topBox, DRIVER_KIND.mid)[0].driverId, cfg.mid, c.name);

    // the horn: on the mid box's lid, flush with its front, or in the tower's baffle
    const [cd] = driversOf(topBox, DRIVER_KIND.compression);
    assert.equal(cd.driverId, cfg.cd, c.name);
    assert.equal(cd.horn?.hornId, cfg.horn, c.name);
    if (tower)
      assert.deepEqual([cd.horn?.placement, cd.horn?.mount], [HORN_PLACEMENT.baffle, null]);
    else {
      assert.equal(cd.horn?.placement, HORN_PLACEMENT.top, c.name);
      assert.deepEqual(cd.position, { xIn: 0, yIn: 0 }, c.name);
    }

    // the crossovers: the subsonic on the sub band; sub to mid in the tower's bands or between the boxes; mid to horn
    // in the top's bands
    const lo = { hz: cfg.xoLo, type: crossoverSlopeName(cfg.xoLoOrder) };
    const hi = { hz: cfg.xoHi, type: crossoverSlopeName(cfg.xoHiOrder) };
    assert.deepEqual(bandOf(subBox, SPEAKER_BAND.low).highpass, { hz: cfg.hpf, type: cfg.hpType });
    if (tower) {
      assert.deepEqual(bandOf(topBox, SPEAKER_BAND.low).lowpass, lo, c.name);
      assert.deepEqual(bandOf(topBox, SPEAKER_BAND.mid).highpass, lo, c.name);
    } else {
      const subMember = stack.members.find((m) => m.speakerId === subBox.id);
      const topMember = stack.members.find((m) => m.speakerId === topBox.id);
      assert.deepEqual(subMember?.crossover.lowpass, lo, c.name);
      assert.deepEqual(topMember?.crossover.highpass, lo, c.name);
      assert.equal(topMember?.levelDb, -cfg.tilt, c.name);
      assert.equal(subMember?.delayMs, AUTO_DELAY, `${c.name}: the sub aligned to the top`);
    }
    assert.deepEqual(bandOf(topBox, SPEAKER_BAND.mid).lowpass, hi, c.name);
    assert.deepEqual(bandOf(topBox, SPEAKER_BAND.high).highpass, hi, c.name);
    assert.ok(
      [...subBox.bands, ...topBox.bands].every((b) => b.drive === HIFI_DRIVE.active),
      c.name,
    );

    // the stacks (and satellite's sub) stand on the plinth; the amp power as the design powers each band
    for (const p of space.placements)
      if (p.item.kind === SPACE_ITEM.stack || p.item.id === subBox.id)
        assert.equal(p.liftIn, PLINTH_HEIGHT_IN, c.name);
    assert.deepEqual(
      [
        bandOf(subBox, SPEAKER_BAND.low).ampW,
        bandOf(topBox, SPEAKER_BAND.mid).ampW,
        bandOf(topBox, SPEAKER_BAND.high).ampW,
      ],
      [cfg.ampW, cfg.mAmpW, cfg.hfAmpW],
      c.name,
    );
    assert.equal(subBox.cabinet.panel.thicknessIn, cfg.wall, c.name);

    // the PA's frame and inset baffle on every box; the tower's top arched where its horn arches it, else flat; the
    // vents placed by their rule
    const archTop = tower && towerArches(cfg);
    for (const box of speakers) {
      assert.equal(box.cabinet.construction, CABINET_CONSTRUCTION.frameInset, c.name);
      assert.equal(box.cabinet.insetIn, cfg.inset, c.name);
      assert.equal(box.cabinet.top, archTop ? CABINET_TOP.arched : CABINET_TOP.flat, c.name);
    }
    assert.ok(!("position" in port), `${c.name}: the sub's vent placed by its rule`);
  }
});

test("speaker spec: a tower whose round horn is narrower than the cabinet has an arched top", () => {
  const tower = paCases.map(paDesign).find((cfg) => cfg.layout === "tower" && towerArches(cfg));
  assert.ok(tower, "a golden tower with an arched top");
  const [spec] = layersFromPa(tower, { id: "pa", name: "tower" }, PA_FLOOR).speakers;
  assert.equal(spec.cabinet.top, CABINET_TOP.arched);
});

test("speaker spec: the tower's chambers stack in one shell and share their partitions", () => {
  const seed = configs.find((c) => c.layout === "tower");
  assert.ok(seed, "a tower seed");
  const cfg = paDesign(seed);
  const tower = speakerOf(
    layersFromPa(cfg, { id: "pa", name: "tower" }, PA_FLOOR),
    SPEAKER_PART.tower,
  );
  const [subChamber, midChamber, hornChamber] = tower.cabinet.chambers;
  assert.deepEqual(
    tower.cabinet.chambers.map((c) => c.at),
    [
      { xIn: 0, yIn: 0 },
      { xIn: 0, yIn: cfg.cDim.h },
      { xIn: 0, yIn: cfg.cDim.h + TOWER_MID_HEIGHT_IN },
    ],
  );
  // the mid in the middle of its chamber; the horn in the middle of its section, or of an arched top's half circle
  const horn = HORN_OPTIONS.find((h) => h.id === cfg.horn);
  assert.ok(horn);
  const spec = towerSpec(cfg.cDim, cfg.wall, horn);
  assert.equal(driversOf(tower, DRIVER_KIND.mid)[0].position.yIn, TOWER_MID_HEIGHT_IN / 2);
  assert.equal(
    driversOf(tower, DRIVER_KIND.compression)[0].position.yIn,
    spec.archTop ? cfg.cDim.w / 2 - cfg.wall : hornChamber.dims.h / 2,
  );
  // the mid's air: one wall less than a box of its own, as the PA model has it (the partition under it is the sub's)
  const t = cfg.wall;
  const clear = chamberClearFace(tower.cabinet, midChamber);
  assert.ok(
    Math.abs(
      boxInternalLiters(clear.w + 2 * t, clear.h + 2 * t, midChamber.dims.d, t, cfg.inset) -
        midGrossLiters(midChamber.dims, t, cfg.inset, cfg.layout),
    ) < 1e-9,
  );
  assert.equal(chamberClearFace(tower.cabinet, subChamber).h, cfg.cDim.h - 2 * t);
});

test("speaker spec: each PA layout stands the tops where the planner draws them, a channel each", () => {
  const base = paDesign(configs[0]);
  const read = (layout: PaLayout, spacerH = base.spacerH) =>
    layersFromPa({ ...base, layout, spacerH }, { id: "pa", name: "layout" }, PA_FLOOR);
  const topOf = (r: DesignLayers) => {
    const top = r.stack.members.find((m) => m.speakerId === speakerOf(r, SPEAKER_PART.top).id);
    assert.ok(top);
    return top;
  };
  const stack = read("stack");
  const top = topOf(stack);
  assert.ok(top.pose.on !== null);
  assert.equal(stack.stack.members[top.pose.on].speakerId, speakerOf(stack, SPEAKER_PART.sub).id);
  assert.equal(top.pose.yIn, MID_GAP_IN);
  // the stack at both spots: one mirrored placement, the right box its mirror image
  assert.deepEqual(
    expandPlacements(stack.space.placements).map((p) => [p.item, p.x, p.mirror]),
    [
      [{ kind: SPACE_ITEM.stack, id: stack.stack.id }, PA_FLOOR.stacks[0].x, false],
      [{ kind: SPACE_ITEM.stack, id: stack.stack.id }, PA_FLOOR.stacks[1].x, true],
    ],
  );
  const pole = topOf(read("pole", 18));
  assert.ok(pole.pose.yIn === 18 && pole.pose.on !== null);
  // satellite: the top on its stand beside the sub in the stack; in the space, the tops alone on their stands
  const satRead = read("satellite");
  const sat = topOf(satRead);
  assert.equal(sat.pose.on, null, "on its stand");
  assert.equal(sat.pose.yIn, SATELLITE_COLUMN_H_IN - PLINTH_HEIGHT_IN);
  const topId = speakerOf(satRead, SPEAKER_PART.top).id;
  assert.deepEqual(
    expandPlacements(satRead.space.placements)
      .filter((p) => p.item.id === topId)
      .map((p) => [p.item.kind, p.liftIn, p.x, p.mirror]),
    [
      [SPACE_ITEM.speaker, SATELLITE_COLUMN_H_IN, PA_FLOOR.stacks[0].x, false],
      [SPACE_ITEM.speaker, SATELLITE_COLUMN_H_IN, PA_FLOOR.stacks[1].x, true],
    ],
  );
});

/** A golden fill as the Fills page holds it: the page's defaults where the case sets none. */
function fillState(c: (typeof fillConfigs)[number]): FillDesignState {
  const driver = FILL_OPTIONS.find((d) => d.id === c.drv);
  assert.ok(driver, c.name);
  return {
    ...DEFAULT_FILL,
    driver,
    boxType: c.boxType,
    boxDims: c.dim ?? DEFAULT_FILL.boxDims,
    portSpec: c.port ?? DEFAULT_FILL.portSpec,
    highpassHz: c.hp ?? DEFAULT_FILL.highpassHz,
  };
}

test("speaker spec: every golden fill reads in as a coaxial in its box, the highpass to the subs as its crossover", () => {
  for (const c of fillConfigs) {
    const state = fillState(c);
    const read = layersFromFill(state, { id: "fill", name: c.name });
    const { stack, speakers } = read;
    const [spec] = speakers;
    const [chamber] = spec.cabinet.chambers;
    assert.deepEqual(chamber.dims, state.boxDims, c.name);
    assert.deepEqual(
      [spec.cabinet.construction, spec.cabinet.top, spec.cabinet.insetIn],
      [CABINET_CONSTRUCTION.flushBox, CABINET_TOP.flat, 0],
      c.name,
    );
    assert.equal(chamber.vent.kind, c.boxType, c.name);
    if (chamber.vent.kind === VENT_KIND.vented)
      assert.deepEqual(chamber.vent.port, { shape: PORT_SHAPE.round, ...state.portSpec }, c.name);
    const [coax] = driversOf(spec, DRIVER_KIND.coaxial);
    assert.deepEqual([coax.driverId, coax.count], [c.drv, 1], c.name);
    assert.deepEqual(coax.bands, [SPEAKER_BAND.low, SPEAKER_BAND.high]);
    assert.ok(spec.bands.every((b) => b.drive === HIFI_DRIVE.passive));
    // the highpass to the subs is the stack's; the bands cross only at the coaxial's own crossover
    const [low, high] = spec.bands;
    const xo = state.driver.hf?.xo;
    assert.equal(low.highpass, null, c.name);
    assert.deepEqual(
      [low.lowpass?.hz ?? null, high.highpass?.hz ?? null],
      [xo ?? null, xo ?? null],
      c.name,
    );
    assert.deepEqual(stack.members[0].crossover.highpass, {
      hz: state.highpassHz,
      type: crossoverSlopeName(state.highpassOrder),
    });
    assert.ok(
      spec.bands.every((b) => b.ampW === state.ampWatts),
      c.name,
    );
  }
});

const waveguideTweeter = HIFI_TWEETERS.find((t) => needsWaveguide(t) && !t.ownGuide);
const roundGuide = HIFI_WAVEGUIDES.find((h) => !h.rect);
const coax = HIFI_COAXES.find((c) => c.tweeter);
assert.ok(waveguideTweeter && roundGuide && coax?.tweeter, "the catalog has each case");

/**
 * Hi-fi designs covering each box kind, port shape, waveguide placement, a coaxial, the engine knobs and a box too
 * small for its parts; `horn` is where the waveguide goes, where there is one.
 */
const hifiCases: { name: string; state: HifiDesignState; horn?: HornPlacement }[] = [
  { name: "DEFAULT_HIFI", state: DEFAULT_HIFI },
  { name: "sealed", state: { ...DEFAULT_HIFI, boxType: VENT_KIND.sealed } },
  { name: "radiator", state: { ...DEFAULT_HIFI, boxType: VENT_KIND.radiator } },
  {
    name: "slot",
    state: { ...DEFAULT_HIFI, portSpec: { shape: PORT_SHAPE.slot, n: 1, h: 1, len: 6 } },
  },
  {
    name: "too small for its parts",
    state: { ...DEFAULT_HIFI, boxDims: { w: 4, h: 6, d: 8 } },
  },
  {
    // a round waveguide stands free on the box top
    name: "compression driver on a round waveguide",
    state: { ...DEFAULT_HIFI, tweeter: waveguideTweeter, selectedWaveguide: roundGuide },
    horn: HORN_PLACEMENT.top,
  },
  {
    // no Hi-fi waveguide has a rectangular mouth yet: the round one made rectangular, which sits in the baffle
    name: "compression driver on a rectangular waveguide",
    state: {
      ...DEFAULT_HIFI,
      tweeter: waveguideTweeter,
      selectedWaveguide: { ...roundGuide, rect: true },
    },
    horn: HORN_PLACEMENT.baffle,
  },
  {
    name: "coaxial",
    state: { ...DEFAULT_HIFI, woofer: coax.woofer, tweeter: coax.tweeter },
  },
  {
    name: "passive, sub highpass, tilted",
    state: {
      ...DEFAULT_HIFI,
      drive: HIFI_DRIVE.passive,
      subHighpass: { hz: 70, order: 4 },
      tiltDeg: 8,
    },
  },
];

test("speaker spec: Hi-fi designs read in with their fitted box, drivers, waveguide and crossover", () => {
  for (const { name, state, horn } of hifiCases) {
    const spec = speakerFromHifi(state, DEFAULT_HIFI_LOOK, { id: "hifi", name });
    const [chamber] = spec.cabinet.chambers;
    assert.equal(spec.cabinet.chambers.length, 1, name);
    // the box the page models, drawn and saved: the size set, fitted to what its parts need
    assert.deepEqual(chamber.dims, deriveHifiDesign(state).speakerConfig.dim, name);
    assert.equal(chamber.vent.kind, state.boxType, name);
    assert.deepEqual(
      [spec.cabinet.construction, spec.cabinet.top, spec.cabinet.insetIn],
      [CABINET_CONSTRUCTION.flushBox, CABINET_TOP.flat, 0],
      name,
    );
    // the port and the radiators placed by the Hi-fi rule
    if (chamber.vent.kind === VENT_KIND.vented)
      assert.ok(!("position" in chamber.vent.port), `${name}: the port placed by its rule`);
    if (chamber.vent.kind === VENT_KIND.radiator)
      assert.ok(!("position" in chamber.vent), `${name}: the radiators placed by their rule`);
    if (chamber.vent.kind === VENT_KIND.vented) {
      const { port } = chamber.vent;
      assert.deepEqual([port.shape, port.len], [state.portSpec.shape, state.portSpec.len], name);
      if (port.shape !== PORT_SHAPE.slot && port.shape !== PORT_SHAPE.duct)
        assert.equal(typeof port.elbows, "number", `${name}: the round port carries its elbows`);
    }
    if (chamber.vent.kind === VENT_KIND.radiator)
      assert.deepEqual(chamber.vent.radiators, state.radiatorSelection);
    if (state.woofer.id === state.tweeter.id) {
      assert.deepEqual(
        chamber.drivers.map((d) => [d.kind, d.driverId, d.bands]),
        [[DRIVER_KIND.coaxial, state.woofer.id, [SPEAKER_BAND.low, SPEAKER_BAND.high]]],
        name,
      );
    } else {
      const [woofer] = driversOf(spec, DRIVER_KIND.woofer);
      const [tweeter] = driversOf(spec, DRIVER_KIND.tweeter);
      assert.equal(woofer.driverId, state.woofer.id, name);
      assert.equal(tweeter.driverId, state.tweeter.id, name);
      assert.equal(tweeter.horn?.placement ?? null, horn ?? null, name);
      if (horn) assert.equal(tweeter.horn?.hornId, state.selectedWaveguide.id, name);
    }
    const xo = { hz: state.crossoverHz, type: crossoverSlopeName(state.crossoverOrder) };
    assert.deepEqual(bandOf(spec, SPEAKER_BAND.low).lowpass, xo, name);
    assert.deepEqual(bandOf(spec, SPEAKER_BAND.high).highpass, xo, name);
    // the box's own subsonic on the low band: the model's (a sub highpass, the system's, would take its place there)
    const subsonic = bandOf(spec, SPEAKER_BAND.low).highpass;
    if (state.boxType === VENT_KIND.sealed) assert.equal(subsonic, null, `${name}: no subsonic`);
    else if (state.subHighpass) assert.ok(subsonic, `${name}: a subsonic`);
    else {
      const modeled = deriveHifiDesign(state).speakerModel?.speakerSystem.hpf;
      assert.ok(modeled, name);
      assert.deepEqual(subsonic, { hz: modeled, type: HIFI_SUBSONIC_TYPE }, name);
    }
    const passive = state.drive === HIFI_DRIVE.passive;
    assert.ok(
      spec.bands.every((b) => b.drive === (passive ? HIFI_DRIVE.passive : HIFI_DRIVE.active)),
      name,
    );
    assert.equal(spec.cabinet.tiltDeg, state.tiltDeg ?? 0, name);

    // the pair: one mirrored placement, toed in, the sub highpass as the stack's crossover, a channel per band when active
    const read = layersFromHifi(state, DEFAULT_HIFI_LOOK, { id: "hifi", name });
    const { space, stack } = read;
    assert.deepEqual(
      space.placements.map((p) => [p.x, p.y, p.aim, p.mirror, p.mirrored]),
      [
        [
          -state.speakerSpacingFt / 2,
          state.distanceToWallFt,
          { yawDeg: state.toeInDeg, pitchDeg: 0 },
          false,
          true,
        ],
      ],
      name,
    );
    // the model's two boxes: the right one the mirror image of the left
    assert.deepEqual(
      expandPlacements(space.placements).map((p) => [p.x, p.y, p.aim, p.mirror]),
      [
        [
          -state.speakerSpacingFt / 2,
          state.distanceToWallFt,
          { yawDeg: state.toeInDeg, pitchDeg: 0 },
          false,
        ],
        [
          state.speakerSpacingFt / 2,
          state.distanceToWallFt,
          { yawDeg: -state.toeInDeg, pitchDeg: 0 },
          true,
        ],
      ],
      name,
    );
    assert.equal(stack.members.length, 1, name);
    for (const m of stack.members)
      assert.deepEqual(
        m.crossover.highpass,
        state.subHighpass
          ? { hz: state.subHighpass.hz, type: crossoverSlopeName(state.subHighpass.order) }
          : null,
        name,
      );
    // a passive pair shares the woofer's amp; an active one has a tweeter amp
    assert.deepEqual(
      read.speakers[0].bands.map((b) => b.ampW),
      [state.wooferAmpWatts, passive ? state.wooferAmpWatts : state.tweeterAmpWatts],
      name,
    );
    // the seat: the listening distance in front of the speakers, across as set
    const seat = { x: state.listeningSeat.x, y: state.distanceToWallFt + state.listeningSeat.y };
    assert.deepEqual(space.venue.listener, seat, name);
    assert.equal(space.venue.earFt, state.earHeightIn / 12, name);
    // a living room round the pair and the seat
    assert.ok(space.venue.room.widthFt >= state.speakerSpacingFt, name);
    assert.ok(space.venue.room.lengthFt > seat.y, name);
  }
});

/** The PA default sub (B&C 18NBX100: Sd 1210 cm², Re 5.2 Ω), `count` of them. */
const subs = (count: number): SpeakerChamber["drivers"] => [
  {
    kind: DRIVER_KIND.sub,
    driverId: DEFAULT_PA.sub.id,
    count,
    position: { xIn: 0, yIn: 16 },
    bands: [SPEAKER_BAND.low],
    horn: null,
  },
];

/** A front-loaded, folded bass bin: one sub at the throat, a vented rear chamber with two round tubes. */
const bassBin: SpeakerChamber = {
  at: { xIn: 0, yIn: 0 },
  dims: { w: 24, h: 32, d: 30 },
  netLiters: 120,
  stuffingPct: 0,
  vent: {
    kind: VENT_KIND.vented,
    port: { shape: PORT_SHAPE.round, n: 2, dia: 4, len: 8 },
    maxSpeedMs: HIFI_PORT_MAX_MS,
  },
  load: {
    kind: CHAMBER_LOAD.horn,
    horn: {
      segments: [
        { profile: HORN_PROFILE.exponential, s1: 600, s2: 2400, length: 60 },
        { profile: HORN_PROFILE.conical, s1: 2400, s2: 6000, length: 50 },
      ],
      portOffset: 30,
      drive: { kind: HORN_DRIVE.front },
      path: HORN_PATH.folded,
    },
  },
  drivers: subs(1),
};

/** The bin's horn (it has one). */
function hornOf(chamber: SpeakerChamber) {
  assert.ok(chamber.load.kind === CHAMBER_LOAD.horn);
  return chamber.load.horn;
}

test("speaker spec: a horn chamber reads into a horn design the engine models", () => {
  const result = hornDesignOf(bassBin, { count: 1, angle: 2 });
  assert.ok(result.ok, "a front-loaded horn with one driver, net air and round ports");
  const { design } = result;
  assert.equal(design.driver, DEFAULT_PA.sub.ts);
  assert.equal(design.drivers, 1);
  assert.equal(design.rear.liters, 120);
  assert.ok(design.rear.port);
  // two 4″ tubes: 8π in²; 8″ long, plus 0.61 radii for the inner end (the engine's radiation load adds the outer
  // end): 9.22″
  assert.ok(Math.abs(design.rear.port.area - 8 * Math.PI * CM_PER_IN * CM_PER_IN) < 1e-9);
  assert.ok(Math.abs(design.rear.port.length - 9.22 * CM_PER_IN) < 1e-9);
  assert.equal(design.segments, hornOf(bassBin).segments);
  const model = hornModel(design, hornGrid(), 2.83);
  assert.ok(model, "the engine takes it");
  assert.ok(model.fb !== null && model.curve.every((p) => Number.isFinite(p.spl)));

  // a direct chamber is a design with no horn
  const direct = hornDesignOf(
    { ...bassBin, load: { kind: CHAMBER_LOAD.direct } },
    { count: 1, angle: 2 },
  );
  assert.ok(direct.ok && direct.design.segments.length === 0);
  assert.ok(hornModel(direct.design, hornGrid(), 2.83));
});

test("speaker spec: a PA v2 bin, 2 × 18″ in one flare with folded slots, reads in as two drivers on one throat", () => {
  // the PA v2 plan's sub bin: ~600 cm² of slot per driver, ~680 mm long, folded once; the wedges join the rear chamber
  // (~324 L net); the flare starts at the two cones
  const slotH = 3;
  const slotW = 600 / (CM_PER_IN * CM_PER_IN) / slotH;
  const bin: SpeakerChamber = {
    at: { xIn: 0, yIn: 0 },
    dims: { w: 48, h: 32, d: 30.2 },
    netLiters: 324,
    stuffingPct: 0,
    vent: {
      kind: VENT_KIND.vented,
      port: { shape: PORT_SHAPE.slot, n: 2, h: slotH, w: slotW, len: 680 / (10 * CM_PER_IN) },
      maxSpeedMs: HIFI_PORT_MAX_MS,
    },
    load: {
      kind: CHAMBER_LOAD.horn,
      horn: {
        segments: [
          { profile: HORN_PROFILE.exponential, s1: 2420, s2: 6000, length: 60 },
          { profile: HORN_PROFILE.conical, s1: 6000, s2: 9000, length: 40 },
        ],
        portOffset: 0,
        drive: { kind: HORN_DRIVE.front },
        path: HORN_PATH.straight,
      },
    },
    drivers: subs(2),
  };
  const result = hornDesignOf(bin, { count: 1, angle: 2 });
  assert.ok(result.ok);
  const { design } = result;
  // two of one driver on the throat: the engine wires them in parallel, each cone with its own air load
  assert.equal(design.driver, DEFAULT_PA.sub.ts);
  assert.equal(design.drivers, 2);
  // the catalog's voice-coil inductance rides along to the engine, and the engine uses it
  assert.ok(DEFAULT_PA.sub.ts.Le, "the default sub lists Le");
  assert.equal(design.driver.Le, DEFAULT_PA.sub.ts.Le);
  const [withLe] = hornModel(design, [1000], 2.83)?.curve ?? [];
  const [withoutLe] =
    hornModel({ ...design, driver: { ...design.driver, Le: 0 } }, [1000], 2.83)?.curve ?? [];
  assert.ok(
    withLe && withoutLe && withLe.ze > withoutLe.ze + 5,
    "Le raises the coil's impedance at 1 kHz",
  );
  assert.ok(design.rear.port && Math.abs(design.rear.port.area - 1200) < 1e-9, "1200 cm² of slot");
  // the exit is each opening's rectangle, in cm
  assert.deepEqual(design.rear.port.slot, { width: slotW * CM_PER_IN, height: slotH * CM_PER_IN });
  const model = hornModel(design, hornGrid(), 2.83);
  assert.ok(model, "the engine takes it");
  assert.ok(model.fb !== null && model.curve.every((p) => Number.isFinite(p.spl)));
});

test("speaker spec: chambers the horn engine can't take yet say why", () => {
  const at = { count: 1, angle: 2 } as const;
  const gapOf = (chamber: SpeakerChamber) => {
    const result = hornDesignOf(chamber, at);
    return result.ok ? null : result.gap;
  };
  const horn = hornOf(bassBin);
  const withDrive = (drive: (typeof horn)["drive"]): SpeakerChamber => ({
    ...bassBin,
    load: { kind: CHAMBER_LOAD.horn, horn: { ...horn, drive } },
  });
  assert.equal(
    gapOf(withDrive({ kind: HORN_DRIVE.tapped, frontTap: 0, rearTap: 1 })),
    HORN_ENGINE_GAP.tapped,
  );
  // a back-loaded horn: the cone's front on the baffle, its rear into the throat chamber and the horn
  assert.equal(gapOf(withDrive({ kind: HORN_DRIVE.back })), HORN_ENGINE_GAP.backLoaded);
  assert.equal(gapOf({ ...bassBin, netLiters: null }), HORN_ENGINE_GAP.netLiters);
  assert.equal(
    gapOf({
      ...bassBin,
      drivers: [
        ...subs(1),
        {
          kind: DRIVER_KIND.mid,
          driverId: DEFAULT_PA.mid.id,
          count: 1,
          position: { xIn: 0, yIn: 0 },
          bands: [SPEAKER_BAND.mid],
          horn: null,
        },
      ],
    }),
    HORN_ENGINE_GAP.driver,
    "two kinds of driver in one throat",
  );
  const vented = (port: SpeakerPort): SpeakerChamber => ({
    ...bassBin,
    vent: { kind: VENT_KIND.vented, port, maxSpeedMs: HIFI_PORT_MAX_MS },
  });
  assert.equal(
    gapOf(vented({ shape: PORT_SHAPE.slot, n: 1, h: 2, len: 10 })),
    HORN_ENGINE_GAP.vent,
    "a slot whose width the box sets",
  );
  assert.equal(
    gapOf(vented({ shape: PORT_SHAPE.duct, n: 2, throat: 2, len: 10, div: 0.5, divider: "1/2" })),
    HORN_ENGINE_GAP.vent,
  );
  // today's PA boxes: the box models work out their net air; the mid/high box holds two kinds of driver
  const read = layersFromPa(paDesign(configs[0]), { id: "pa", name: "gaps" }, PA_FLOOR);
  assert.equal(
    gapOf(chamberOf(speakerOf(read, SPEAKER_PART.sub), DRIVER_KIND.sub)),
    HORN_ENGINE_GAP.netLiters,
  );
  assert.equal(
    gapOf(chamberOf(speakerOf(read, SPEAKER_PART.top), DRIVER_KIND.mid)),
    HORN_ENGINE_GAP.driver,
  );
});
