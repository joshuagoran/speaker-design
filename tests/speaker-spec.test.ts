// The speaker designer's spec (lib/speaker): every golden design reads into it with its key facts (boxes, drivers,
// vents, crossovers, layout), and a horn chamber reads into a design the horn engine models.
import { test } from "vite-plus/test";
import assert from "node:assert";
import { configs, fillConfigs, type GoldenConfig } from "./golden-configs";
import { systemFromPa } from "../src/lib/speaker/paSpec";
import { speakerFromHifi, systemFromHifi } from "../src/lib/speaker/hifiSpec";
import { speakerFromFill } from "../src/lib/speaker/fillSpec";
import { hornDesignOf } from "../src/lib/speaker/hornDesign";
import { paSearchDesign } from "../src/lib/pa/optimize";
import { towerMidDims } from "../src/lib/pa/tower";
import { needsWaveguide } from "../src/lib/hifi/hifi";
import { hornGrid, hornModel } from "../src/lib/acoustics/hornModel";
import {
  FILL_OPTIONS,
  HIFI_COAXES,
  HIFI_TWEETERS,
  HIFI_WAVEGUIDES,
  MID_BOXES,
} from "../src/lib/data";
import { DEFAULT_FILL, DEFAULT_HIFI, DEFAULT_HIFI_LOOK, DEFAULT_PA } from "../src/lib/defaults";
import { crossoverSlopeName } from "../src/constants/crossovers";
import { HIFI_DRIVE } from "../src/constants/hifiEngine";
import { HORN_PROFILE } from "../src/constants/hornEngine";
import { MID_GAP_IN, SATELLITE_COLUMN_H_IN } from "../src/constants/paLayouts";
import { CM_PER_M, METERS_PER_INCH } from "../src/constants/units";
import {
  CHAMBER_LOAD,
  DRIVER_KIND,
  HORN_DRIVE,
  HORN_ENGINE_GAP,
  HORN_PATH,
  HORN_PLACEMENT,
  PORT_SHAPE,
  SPEAKER_BAND,
  SPEAKER_TEMPLATE,
  VENT_KIND,
} from "../src/constants/speakerSpec";
import type {
  BandId,
  CoverageLayout,
  DriverKind,
  FillDesignState,
  HifiDesignState,
  PaDesignConfig,
  PaLayout,
  PortStyle,
  SpeakerChamber,
  SpeakerPort,
  SpeakerSpec,
  SpeakerTemplate,
} from "../src/types";

/** The coverage page's stack spots, left then right (its default layout's). */
const STACKS: CoverageLayout["stacks"] = [
  { x: -9, y: 3, aim: 12 },
  { x: 9, y: 3, aim: -12 },
];

/** A golden PA design as the planner holds it: the search's defaults, and an older seed's mid box size. */
const paDesign = (c: GoldenConfig): PaDesignConfig => ({
  ...paSearchDesign({ cur: c }),
  mDim: c.mDim || (MID_BOXES.find((b) => b.id === c.midBox) || MID_BOXES[0]).box,
});

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
function speakerOf(speakers: readonly SpeakerSpec[], template: SpeakerTemplate) {
  const found = speakers.find((s) => s.template === template);
  assert.ok(found, `no ${template} speaker`);
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
/** How many sources each layout places. */
const PA_SOURCE_COUNT: Record<PaLayout, number> = { stack: 4, pole: 4, satellite: 3, tower: 2 };

/** The golden PA designs, and a pole layout (no seed has one). */
const paCases: GoldenConfig[] = [
  ...configs,
  { ...configs[0], name: "pole: tops on spacers", layout: "pole", spacerH: 18 },
];

test("speaker spec: every golden PA design reads into a system with its boxes, drivers, vents and crossovers", () => {
  for (const c of paCases) {
    const cfg = paDesign(c);
    const { system, speakers } = systemFromPa(cfg, { id: "pa", name: c.name }, STACKS);
    const tower = cfg.layout === "tower";
    assert.equal(system.sources.length, PA_SOURCE_COUNT[cfg.layout], c.name);
    for (const s of system.sources)
      assert.ok(
        speakers.some((sp) => sp.id === s.speakerId),
        `${c.name}: a source names a speaker`,
      );
    const subBox = speakerOf(speakers, tower ? SPEAKER_TEMPLATE.tower : SPEAKER_TEMPLATE.sub);
    const topBox = speakerOf(speakers, tower ? SPEAKER_TEMPLATE.tower : SPEAKER_TEMPLATE.top);
    assert.equal(speakers.length, tower ? 1 : 2, c.name);
    if (tower) assert.equal(subBox.cabinet.chambers.length, 3, `${c.name}: sub, mid and horn`);

    // the sub box: its size, vent and driver
    const subChamber = chamberOf(subBox, DRIVER_KIND.sub);
    assert.deepEqual(subChamber.dims, cfg.cDim, c.name);
    assert.equal(subChamber.vent.kind, VENT_KIND.vented, c.name);
    assert.ok(subChamber.vent.kind === VENT_KIND.vented);
    const port = subChamber.vent.port;
    assert.equal(port.shape, PA_PORT_SHAPE[cfg.portStyle], c.name);
    assert.equal(port.len, cfg.cVent.len, c.name);
    if (port.shape === PORT_SHAPE.slot) assert.equal(port.h, cfg.cVent.slotH, c.name);
    else if (port.shape === PORT_SHAPE.duct) assert.equal(port.throat, cfg.cVent.throat, c.name);
    else assert.deepEqual([port.n, port.dia], [cfg.cVent.nt, cfg.cVent.dia], c.name);
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
    assert.deepEqual(midChamber.dims, tower ? towerMidDims(cfg.cDim) : cfg.mDim, c.name);
    assert.equal(driversOf(topBox, DRIVER_KIND.mid)[0].driverId, cfg.mid, c.name);

    // the horn: on the mid box's lid, or in the tower's baffle
    const [cd] = driversOf(topBox, DRIVER_KIND.compression);
    assert.equal(cd.driverId, cfg.cd, c.name);
    assert.equal(cd.horn?.hornId, cfg.horn, c.name);
    assert.equal(
      cd.horn?.placement,
      tower ? HORN_PLACEMENT.baffle : HORN_PLACEMENT.top,
      `${c.name}: horn placement`,
    );
    if (tower) assert.equal(cd.horn?.mount, null, `${c.name}: no lid mount in the tower`);

    // the crossovers: the subsonic on the sub band; sub to mid in the tower's bands or between the boxes; mid to horn
    // in the top's bands
    const lo = { hz: cfg.xoLo, type: crossoverSlopeName(cfg.xoLoOrder) };
    const hi = { hz: cfg.xoHi, type: crossoverSlopeName(cfg.xoHiOrder) };
    assert.deepEqual(bandOf(subBox, SPEAKER_BAND.low).highpass, { hz: cfg.hpf, type: cfg.hpType });
    if (tower) {
      assert.deepEqual(bandOf(topBox, SPEAKER_BAND.low).lowpass, lo, c.name);
      assert.deepEqual(bandOf(topBox, SPEAKER_BAND.mid).highpass, lo, c.name);
    } else {
      const subSource = system.sources.find((s) => s.speakerId === subBox.id);
      const topSource = system.sources.find((s) => s.speakerId === topBox.id);
      assert.deepEqual(subSource?.filters.lowpass, lo, c.name);
      assert.deepEqual(topSource?.filters.highpass, lo, c.name);
      assert.equal(topSource?.levelDb, -cfg.tilt, c.name);
    }
    assert.deepEqual(bandOf(topBox, SPEAKER_BAND.mid).lowpass, hi, c.name);
    assert.deepEqual(bandOf(topBox, SPEAKER_BAND.high).highpass, hi, c.name);

    // the amps, as the design powers each band
    assert.deepEqual(
      system.amps.map((a) => a.watts),
      [cfg.ampW, cfg.mAmpW, cfg.hfAmpW],
    );
    assert.equal(subBox.cabinet.panel.thicknessIn, cfg.wall, c.name);
  }
});

test("speaker spec: each PA layout stands the tops where the planner draws them", () => {
  const base = paDesign(configs[0]);
  const tops = (layout: PaLayout, spacerH?: number) => {
    const { system, speakers } = systemFromPa(
      { ...base, layout, spacerH },
      { id: "pa", name: "layout" },
      STACKS,
    );
    const topId = speakerOf(speakers, SPEAKER_TEMPLATE.top).id;
    return { sources: system.sources, tops: system.sources.filter((s) => s.speakerId === topId) };
  };
  const stack = tops("stack");
  for (const t of stack.tops) {
    assert.ok(t.pose.on !== null);
    assert.equal(stack.sources[t.pose.on].speakerId, stack.sources[0].speakerId, "on its sub");
    assert.equal(t.pose.liftIn, MID_GAP_IN);
  }
  assert.ok(tops("pole", 18).tops.every((t) => t.pose.liftIn === 18 && t.pose.on !== null));
  const sat = tops("satellite");
  assert.ok(
    sat.tops.every((t) => t.pose.on === null && t.pose.liftIn === SATELLITE_COLUMN_H_IN),
    "on their stands",
  );
  assert.deepEqual(
    sat.tops.map((t) => [t.pose.x, t.mirror]),
    [
      [STACKS[0].x, false],
      [STACKS[1].x, true],
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

test("speaker spec: every golden fill reads in as a coaxial in its box", () => {
  for (const c of fillConfigs) {
    const state = fillState(c);
    const spec = speakerFromFill(state, { id: "fill", name: c.name });
    const [chamber] = spec.cabinet.chambers;
    assert.deepEqual(chamber.dims, state.boxDims, c.name);
    assert.equal(chamber.vent.kind, c.boxType, c.name);
    if (chamber.vent.kind === VENT_KIND.vented)
      assert.deepEqual(chamber.vent.port, { shape: PORT_SHAPE.round, ...state.portSpec }, c.name);
    const [coax] = driversOf(spec, DRIVER_KIND.coaxial);
    assert.deepEqual([coax.driverId, coax.count], [c.drv, 1], c.name);
    assert.deepEqual(coax.bands, [SPEAKER_BAND.low, SPEAKER_BAND.high]);
    assert.deepEqual(bandOf(spec, SPEAKER_BAND.low).highpass, {
      hz: state.highpassHz,
      type: crossoverSlopeName(state.highpassOrder),
    });
    assert.equal(spec.drive, HIFI_DRIVE.passive);
  }
});

const waveguideTweeter = HIFI_TWEETERS.find((t) => needsWaveguide(t) && !t.ownGuide);
const roundGuide = HIFI_WAVEGUIDES.find((h) => !h.rect);
const coax = HIFI_COAXES.find((c) => c.tweeter);
assert.ok(waveguideTweeter && roundGuide && coax?.tweeter, "the catalog has each case");

/** Hi-fi designs covering each box kind, port shape, waveguide placement, a coaxial and the engine knobs. */
const hifiCases: { name: string; state: HifiDesignState }[] = [
  { name: "DEFAULT_HIFI", state: DEFAULT_HIFI },
  { name: "sealed", state: { ...DEFAULT_HIFI, boxType: VENT_KIND.sealed } },
  { name: "radiator", state: { ...DEFAULT_HIFI, boxType: VENT_KIND.radiator } },
  {
    name: "slot",
    state: { ...DEFAULT_HIFI, portSpec: { shape: PORT_SHAPE.slot, n: 1, h: 1, len: 6 } },
  },
  {
    name: "compression driver on a round waveguide",
    state: { ...DEFAULT_HIFI, tweeter: waveguideTweeter, selectedWaveguide: roundGuide },
  },
  {
    // no Hi-fi waveguide has a rectangular mouth yet: the round one, made rectangular
    name: "compression driver on a rectangular waveguide",
    state: {
      ...DEFAULT_HIFI,
      tweeter: waveguideTweeter,
      selectedWaveguide: { ...roundGuide, rect: true },
    },
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

test("speaker spec: Hi-fi designs read in with their box, drivers, waveguide and crossover", () => {
  for (const { name, state } of hifiCases) {
    const spec = speakerFromHifi(state, DEFAULT_HIFI_LOOK, { id: "hifi", name });
    const [chamber] = spec.cabinet.chambers;
    assert.equal(spec.cabinet.chambers.length, 1, name);
    assert.deepEqual(chamber.dims, state.boxDims, name);
    assert.equal(chamber.vent.kind, state.boxType, name);
    if (chamber.vent.kind === VENT_KIND.vented) assert.deepEqual(chamber.vent.port, state.portSpec);
    if (chamber.vent.kind === VENT_KIND.radiator)
      assert.deepEqual(chamber.vent.radiators, state.radiatorSelection);
    if (state.woofer.id === state.tweeter.id) {
      const drivers = chamber.drivers;
      assert.deepEqual(
        drivers.map((d) => [d.kind, d.driverId, d.bands]),
        [[DRIVER_KIND.coaxial, state.woofer.id, [SPEAKER_BAND.low, SPEAKER_BAND.high]]],
        name,
      );
    } else {
      const [woofer] = driversOf(spec, DRIVER_KIND.woofer);
      const [tweeter] = driversOf(spec, DRIVER_KIND.tweeter);
      assert.equal(woofer.driverId, state.woofer.id, name);
      assert.equal(tweeter.driverId, state.tweeter.id, name);
      if (needsWaveguide(state.tweeter) && !state.tweeter.ownGuide) {
        assert.equal(tweeter.horn?.hornId, state.selectedWaveguide.id, name);
        assert.equal(
          tweeter.horn?.placement,
          state.selectedWaveguide.rect ? HORN_PLACEMENT.baffle : HORN_PLACEMENT.top,
          `${name}: a round waveguide stands on the box, a rectangle sits in the baffle`,
        );
      } else assert.equal(tweeter.horn, null, `${name}: a dome on the baffle`);
    }
    const xo = { hz: state.crossoverHz, type: crossoverSlopeName(state.crossoverOrder) };
    assert.deepEqual(bandOf(spec, SPEAKER_BAND.low).lowpass, xo, name);
    assert.deepEqual(bandOf(spec, SPEAKER_BAND.high).highpass, xo, name);
    assert.deepEqual(
      bandOf(spec, SPEAKER_BAND.low).highpass,
      state.subHighpass
        ? { hz: state.subHighpass.hz, type: crossoverSlopeName(state.subHighpass.order) }
        : null,
      name,
    );
    assert.equal(spec.drive, state.drive ?? HIFI_DRIVE.active, name);
    assert.equal(spec.cabinet.tiltDeg, state.tiltDeg ?? 0, name);

    // the pair: mirrored, toed in, an amp per band when active
    const { system } = systemFromHifi(state, DEFAULT_HIFI_LOOK, { id: "hifi", name });
    assert.deepEqual(
      system.sources.map((s) => [s.pose.x, s.pose.aim, s.mirror]),
      [
        [-state.speakerSpacingFt / 2, state.toeInDeg, false],
        [state.speakerSpacingFt / 2, -state.toeInDeg, true],
      ],
      name,
    );
    assert.equal(system.amps.length, spec.drive === HIFI_DRIVE.passive ? 1 : 2, name);
    assert.equal(system.venue?.placement, state.placement, name);
  }
});

/** A front-loaded, folded bass bin: the PA default sub at the throat, a vented rear chamber. */
const bassBin: SpeakerChamber = {
  dims: { w: 24, h: 32, d: 30 },
  netLiters: 120,
  vent: { kind: VENT_KIND.vented, port: { shape: PORT_SHAPE.round, n: 2, dia: 4, len: 8 } },
  load: {
    kind: CHAMBER_LOAD.horn,
    horn: {
      throatChamber: 2,
      segments: [
        { profile: HORN_PROFILE.exponential, s1: 600, s2: 2400, length: 60 },
        { profile: HORN_PROFILE.conical, s1: 2400, s2: 6000, length: 50 },
      ],
      portOffset: 30,
      drive: { kind: HORN_DRIVE.front },
      path: HORN_PATH.folded,
    },
  },
  drivers: [
    {
      kind: DRIVER_KIND.sub,
      driverId: DEFAULT_PA.sub.id,
      count: 1,
      position: { xIn: 0, yIn: 16 },
      bands: [SPEAKER_BAND.low],
      horn: null,
    },
  ],
};

test("speaker spec: a horn chamber reads into a horn design the engine models", () => {
  const result = hornDesignOf(bassBin, { count: 1, angle: 2 });
  assert.ok(result.ok, "a front-loaded horn with one driver, net air and round ports");
  const { design } = result;
  assert.equal(design.driver, DEFAULT_PA.sub.ts);
  assert.equal(design.rear.liters, 120);
  // two 4″ tubes: 8π in², in cm²
  const cmPerIn = METERS_PER_INCH * CM_PER_M;
  assert.ok(
    design.rear.port && Math.abs(design.rear.port.area - 8 * Math.PI * cmPerIn * cmPerIn) < 1e-9,
  );
  assert.ok(load(bassBin).segments === design.segments);
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

/** The bin's horn (it has one). */
function load(chamber: SpeakerChamber) {
  assert.ok(chamber.load.kind === CHAMBER_LOAD.horn);
  return chamber.load.horn;
}

test("speaker spec: chambers the horn engine can't take yet say why", () => {
  const at = { count: 1, angle: 2 } as const;
  const gapOf = (chamber: SpeakerChamber) => {
    const result = hornDesignOf(chamber, at);
    return result.ok ? null : result.gap;
  };
  const horn = load(bassBin);
  assert.equal(
    gapOf({
      ...bassBin,
      load: {
        kind: CHAMBER_LOAD.horn,
        horn: { ...horn, drive: { kind: HORN_DRIVE.tapped, frontTap: 0, rearTap: 1 } },
      },
    }),
    HORN_ENGINE_GAP.tapped,
  );
  assert.equal(gapOf({ ...bassBin, netLiters: null }), HORN_ENGINE_GAP.netLiters);
  assert.equal(
    gapOf({ ...bassBin, drivers: [{ ...bassBin.drivers[0], count: 2 }] }),
    HORN_ENGINE_GAP.driver,
  );
  assert.equal(
    gapOf({
      ...bassBin,
      vent: { kind: VENT_KIND.vented, port: { shape: PORT_SHAPE.slot, n: 1, h: 2, len: 10 } },
    }),
    HORN_ENGINE_GAP.vent,
  );
  // today's PA boxes: the box models work out their net air; the mid/high box has two drivers
  const { speakers } = systemFromPa(paDesign(configs[0]), { id: "pa", name: "gaps" }, STACKS);
  assert.equal(
    gapOf(chamberOf(speakerOf(speakers, SPEAKER_TEMPLATE.sub), DRIVER_KIND.sub)),
    HORN_ENGINE_GAP.netLiters,
  );
  assert.equal(
    gapOf(chamberOf(speakerOf(speakers, SPEAKER_TEMPLATE.top), DRIVER_KIND.mid)),
    HORN_ENGINE_GAP.driver,
  );
});
