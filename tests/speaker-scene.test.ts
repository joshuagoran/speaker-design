// The Designer's 3D scene of any speaker spec (stack-view/buildSpeakerScene), built from the read adapters' specs of
// golden PA and Hi-fi designs (the PA sub, the mid/high box, the tower, a Hi-fi speaker on a waveguide, a coaxial):
// each chamber, driver, horn and port where the spec and its layout (lib/speaker/speakerLayout) put them, the walls the
// tower's chambers share, a horn-loaded chamber's mouth and flare, and every geometry the build makes reachable from the
// scene (the 3D view frees what it can reach: stack-view/SceneView3D).
import { describe, expect, test, vi } from "vite-plus/test";
import * as THREE from "three";
import {
  buildSpeakerScene,
  speakerSceneKey,
  SPEAKER_GROUP_NAMES,
  SPEAKER_MESH_NAMES,
} from "../src/components/stack-view/buildSpeakerScene";
import { HORN_MESH_NAME } from "../src/components/stack-view/buildHorn";
import { HIFI_MESH_NAMES } from "../src/components/stack-view/buildHifiScene";
import { VENT_MESH_NAME } from "../src/components/stack-view/buildBraces";
import { ROUNDOVER_IN } from "../src/components/stack-view/stackHeights";
import {
  driverSpots,
  hornFlare,
  onTop,
  drawsArchedTop,
  radiatorsAt,
  roundPortsAt,
  speakerLayout,
  ventMoved,
  type PlacedChamber,
} from "../src/lib/speaker/speakerLayout";
import { chamberNetLiters } from "../src/lib/speaker/chamberAir";
import { PANEL } from "../src/constants/cutParts";
import { HIFI_BOX_LAYOUT } from "../src/constants/hifiLayout";
import { layersFromPa } from "../src/lib/speaker/paSpec";
import { speakerFromHifi } from "../src/lib/speaker/hifiSpec";
import { speakerIdentity } from "../src/lib/speaker/specParts";
import { paSearchDesign } from "../src/lib/pa/optimize";
import { panelNominalNear } from "../src/lib/panel";
import { HIFI_COAXES, HIFI_TWEETERS, HIFI_WAVEGUIDES, MID_BOXES } from "../src/lib/data";
import { byIdOrThrow } from "../src/lib/tables";
import { DEFAULT_HIFI, DEFAULT_HIFI_LOOK, DEFAULT_PA } from "../src/lib/defaults";
import { HORN_MOUNT_DEFAULT } from "../src/constants/hornMount";
import {
  CABINET_CONSTRUCTION,
  CABINET_TOP,
  CHAMBER_LOAD,
  DRIVER_KIND,
  HORN_DRIVE,
  HORN_PATH,
  HORN_PLACEMENT,
  PORT_SHAPE,
  SPEAKER_PART,
  VENT_KIND,
} from "../src/constants/speakerSpec";
import { HORN_PROFILE } from "../src/constants/hornEngine";
import { configs, type GoldenConfig } from "./golden-configs";
import type {
  CoverageLayout,
  HifiDesignState,
  PaPlannerDesign,
  SpeakerChamber,
  SpeakerPart,
  SpeakerSpec,
} from "../src/types";

const EPS = 1e-6;

/** The coverage page's stack spots (they don't change the speakers). */
const STACKS: CoverageLayout["stacks"] = [
  { x: -9, y: 3, aim: 12 },
  { x: 9, y: 3, aim: -12 },
];
const IDENTITY = { id: "golden", name: "Golden" };

/** A golden PA design as the planner holds it (as tests/speaker-spec.test.ts reads it). */
function paDesign(c: GoldenConfig): PaPlannerDesign {
  const cfg = paSearchDesign({ cur: c });
  return {
    ...cfg,
    mDim: c.mDim || (MID_BOXES.find((b) => b.id === c.midBox) || MID_BOXES[0]).box,
    panel: c.panel ?? panelNominalNear(cfg.wall),
    hornMount: c.hornMount ?? HORN_MOUNT_DEFAULT,
    spacerH: c.spacerH ?? DEFAULT_PA.spacerH,
  };
}
/** A PA design's speaker of `part`, read through the adapter. */
function paSpeaker(c: GoldenConfig, part: SpeakerPart): SpeakerSpec {
  const read = layersFromPa(paDesign(c), IDENTITY, STACKS);
  const id = speakerIdentity(IDENTITY, part).id;
  const found = read.speakers.find((s) => s.id === id);
  if (!found) throw new Error(`no ${part} in ${c.name}`);
  return found;
}
/** The Hi-fi design with `over` changed, read through the adapter. */
const hifiSpeaker = (over: Partial<HifiDesignState>) =>
  speakerFromHifi({ ...DEFAULT_HIFI, ...over }, DEFAULT_HIFI_LOOK, IDENTITY);

/** The spec with its waveguide moved off the top into the baffle, near the top (as the Designer can set it). */
function inBaffle(spec: SpeakerSpec): SpeakerSpec {
  const [chamber] = spec.cabinet.chambers;
  return {
    ...spec,
    cabinet: {
      ...spec.cabinet,
      chambers: [
        {
          ...chamber,
          drivers: chamber.drivers.map((d) =>
            d.horn
              ? {
                  ...d,
                  position: { xIn: 0, yIn: chamber.dims.h - 6 },
                  horn: { ...d.horn, placement: HORN_PLACEMENT.baffle },
                }
              : d,
          ),
        },
      ],
    },
  };
}

const golden = (name: string) => {
  const found = configs.find((c) => c.name === name);
  if (!found) throw new Error(`no golden ${name}`);
  return found;
};
const [defaultPa] = configs;
const coax = HIFI_COAXES.find((c) => c.tweeter);
if (!coax?.tweeter) throw new Error("no coaxial with its HF part");

/** The golden designs' specs the scene is checked on. */
const CASES: { name: string; spec: SpeakerSpec }[] = [
  { name: "PA sub (letterbox)", spec: paSpeaker(defaultPa, SPEAKER_PART.sub) },
  { name: "PA sub, side ducts", spec: paSpeaker(golden("synthetic: vslots"), SPEAKER_PART.sub) },
  { name: "PA sub, corner tubes", spec: paSpeaker(golden("synthetic: 4 round"), SPEAKER_PART.sub) },
  {
    name: "PA sub, folded slot, flush",
    spec: paSpeaker({ ...golden("synthetic: slots, folded"), inset: 0 }, SPEAKER_PART.sub),
  },
  { name: "PA mid/high box", spec: paSpeaker(defaultPa, SPEAKER_PART.top) },
  { name: "PA tower", spec: paSpeaker({ ...defaultPa, layout: "tower" }, SPEAKER_PART.tower) },
  {
    name: "Hi-fi on a waveguide (on top)",
    spec: hifiSpeaker({
      tweeter: byIdOrThrow(HIFI_TWEETERS, "de250", "tweeters"),
      selectedWaveguide: byIdOrThrow(HIFI_WAVEGUIDES, "diy_os90x70", "waveguides"),
    }),
  },
  {
    name: "Hi-fi on a waveguide (in the baffle), vented",
    spec: inBaffle(
      hifiSpeaker({
        tweeter: byIdOrThrow(HIFI_TWEETERS, "de250", "tweeters"),
        selectedWaveguide: byIdOrThrow(HIFI_WAVEGUIDES, "diy_os90x70", "waveguides"),
        boxType: "vented",
        boxDims: { w: 10, h: 20, d: 11 },
      }),
    ),
  },
  { name: "Hi-fi default, radiators", spec: hifiSpeaker({ boxType: "radiator" }) },
  {
    name: "Hi-fi coaxial",
    spec: hifiSpeaker({
      woofer: coax.woofer,
      tweeter: coax.tweeter,
      boxDims: { w: 13, h: 16, d: 11 },
    }),
  },
];

/** Every object named `name`, world matrices updated. */
function named(g: THREE.Object3D, name: string) {
  const out: THREE.Object3D[] = [];
  g.updateMatrixWorld(true);
  g.traverse((o) => o.name === name && out.push(o));
  return out;
}
const worldOf = (o: THREE.Object3D) => o.getWorldPosition(new THREE.Vector3());
const boxOf = (...objects: THREE.Object3D[]) => {
  const box = new THREE.Box3();
  objects.forEach((o) => box.expandByObject(o));
  return box;
};
/** Where a chamber's front is: the cabinet's front plane (the deepest chamber's half depth). */
const frontZ = (spec: SpeakerSpec) => speakerLayout(spec.cabinet).size.d / 2;

describe("each golden design's spec", () => {
  for (const { name, spec } of CASES)
    test(`${name}: chambers and drivers where the spec puts them`, () => {
      const layout = speakerLayout(spec.cabinet);
      for (const cutaway of [false, true]) {
        const g = buildSpeakerScene({ spec, cutaway });
        const chambers = named(g, SPEAKER_GROUP_NAMES.chamber);
        expect(chambers).toHaveLength(spec.cabinet.chambers.length);
        layout.chambers.forEach((placed, i) => {
          const at = worldOf(chambers[i]);
          // the chamber's center line and bottom, and its front on the cabinet's front plane
          expect(at.x, `${name}: chamber ${i} x`).toBeCloseTo(placed.cx, 6);
          expect(at.y, `${name}: chamber ${i} y`).toBeCloseTo(placed.y0, 6);
          expect(at.z + placed.dims.d / 2).toBeCloseTo(frontZ(spec), 6);
        });
        // every driver at its spot: on the baffle, or its horn on the chamber's top, back from the front by its yIn
        const drivers = named(g, SPEAKER_GROUP_NAMES.driver);
        const expected = layout.chambers.flatMap((placed: PlacedChamber) =>
          placed.chamber.drivers.flatMap((d) =>
            driverSpots(placed, d).map((s) => ({
              x: s.xIn,
              y: s.yIn,
              z: onTop(d) ? -d.position.yIn : 0,
              chamber: placed,
            })),
          ),
        );
        expect(drivers).toHaveLength(expected.length);
        drivers.forEach((o, i) => {
          const at = worldOf(o),
            want = expected[i];
          expect(at.x, `${name}: driver ${i} x`).toBeCloseTo(want.x, 6);
          expect(at.y, `${name}: driver ${i} y`).toBeCloseTo(want.y, 6);
          expect(at.z - (frontZ(spec) - want.chamber.dims.d / 2)).toBeCloseTo(want.z, 6);
          // each driver draws something, on the closed box and in the cutaway alike
          let meshes = 0;
          o.traverse((m) => m instanceof THREE.Mesh && meshes++);
          if (!cutaway) expect(meshes, `${name}: driver ${i} parts`).toBeGreaterThan(0);
        });
      }
    });

  test("the cabinet is the chambers' bounds, on the floor and centered", () => {
    for (const { name, spec } of CASES) {
      const g = buildSpeakerScene({ spec, cutaway: false });
      const shells = named(g, SPEAKER_GROUP_NAMES.shell);
      const { size } = speakerLayout(spec.cabinet);
      // the shell's own panels: everything in it but the drivers (a horn on the top stands above it)
      const panels = shells.flatMap((s) =>
        s.children.filter((c) => c.name !== SPEAKER_GROUP_NAMES.chamber),
      );
      const box = boxOf(...panels);
      // the PA's frame draws its roundover's bevel proud of the outline, as the PA page does
      const proud =
        spec.cabinet.construction === CABINET_CONSTRUCTION.frameInset ? ROUNDOVER_IN : 0;
      expect(box.min.y, name).toBeCloseTo(-proud, 6);
      // an arched top's crown is a curve's vertex, stored in single precision
      expect(box.max.y, name).toBeCloseTo(size.h + proud, 4);
      expect(box.min.x, name).toBeCloseTo(-size.w / 2 - proud, 6);
      expect(box.max.x, name).toBeCloseTo(size.w / 2 + proud, 6);
      expect(box.max.z, name).toBeCloseTo(size.d / 2, 6);
    }
  });
});

describe("ports and radiators", () => {
  test("each vent's parts stay inside its chamber", () => {
    for (const { name, spec } of CASES) {
      const g = buildSpeakerScene({ spec, cutaway: true });
      const layout = speakerLayout(spec.cabinet);
      const chambers = named(g, SPEAKER_GROUP_NAMES.chamber);
      layout.chambers.forEach((placed, i) => {
        const parts = [
          ...named(chambers[i], VENT_MESH_NAME),
          ...named(chambers[i], HIFI_MESH_NAMES.port),
          ...named(chambers[i], HIFI_MESH_NAMES.slotShelf),
        ];
        if (!parts.length) return;
        const box = boxOf(...parts);
        expect(box.min.x, name).toBeGreaterThanOrEqual(placed.x0 - EPS);
        expect(box.max.x, name).toBeLessThanOrEqual(placed.x0 + placed.dims.w + EPS);
        expect(box.min.y, name).toBeGreaterThanOrEqual(placed.y0 - EPS);
        expect(box.max.y, name).toBeLessThanOrEqual(placed.y0 + placed.dims.h + EPS);
      });
    }
  });

  test("the PA sub's vent is drawn by its port style; the Hi-fi box's port and radiators by the Hi-fi's", () => {
    const vent = (spec: SpeakerSpec) =>
      named(buildSpeakerScene({ spec, cutaway: true }), VENT_MESH_NAME).length;
    for (const c of CASES.filter((c) => c.name.startsWith("PA sub")))
      expect(vent(c.spec), c.name).toBeGreaterThan(0);
    const vented = CASES.find((c) => c.name.endsWith("vented"));
    if (!vented) throw new Error("no vented case");
    expect(
      named(buildSpeakerScene({ spec: vented.spec, cutaway: true }), HIFI_MESH_NAMES.port).length,
    ).toBeGreaterThan(0);
    const radiators = CASES.find((c) => c.name.endsWith("radiators"));
    if (!radiators) throw new Error("no radiator case");
    const g = buildSpeakerScene({ spec: radiators.spec, cutaway: false });
    const placed = named(g, HIFI_MESH_NAMES.radiator);
    expect(placed.length).toBeGreaterThan(0);
    // on the back panel
    for (const r of placed)
      expect(worldOf(r).z).toBeCloseTo(-speakerLayout(radiators.spec.cabinet).size.d / 2, 6);
  });
});

describe("horns", () => {
  test("the mid/high box carries its horn on its lid; the tower sets its horn in the baffle", () => {
    const top = CASES.find((c) => c.name === "PA mid/high box");
    const tower = CASES.find((c) => c.name === "PA tower");
    if (!top || !tower) throw new Error("no PA case");
    const lid = top.spec.cabinet.chambers[0].dims.h;
    const onLid = boxOf(
      ...named(buildSpeakerScene({ spec: top.spec, cutaway: false }), HORN_MESH_NAME),
    );
    expect(onLid.min.y).toBeGreaterThan(lid);
    const inBaffle = boxOf(
      ...named(buildSpeakerScene({ spec: tower.spec, cutaway: false }), HORN_MESH_NAME),
    );
    const [, , hornChamber] = tower.spec.cabinet.chambers;
    expect(inBaffle.min.y).toBeGreaterThan(hornChamber.at.yIn - EPS);
    expect(inBaffle.max.y).toBeLessThan(hornChamber.at.yIn + hornChamber.dims.h + EPS);
    // its mouth on the front plane
    expect(inBaffle.max.z).toBeCloseTo(frontZ(tower.spec), 1);
  });

  test("a Hi-fi waveguide stands on the top or sits in the baffle, as its placement says", () => {
    for (const c of CASES.filter((x) => x.name.startsWith("Hi-fi on a waveguide"))) {
      const [chamber] = c.spec.cabinet.chambers;
      const tweeter = chamber.drivers.find((d) => d.kind === DRIVER_KIND.tweeter);
      if (!tweeter?.horn) throw new Error(`${c.name}: no waveguide`);
      const box = boxOf(
        ...named(buildSpeakerScene({ spec: c.spec, cutaway: false }), HORN_MESH_NAME),
      );
      if (tweeter.horn.placement === HORN_PLACEMENT.top)
        expect(box.min.y, c.name).toBeGreaterThan(chamber.dims.h);
      else expect(box.max.y, c.name).toBeLessThan(chamber.dims.h + EPS);
    }
  });

  test("a coaxial draws its HF horn in its woofer's center", () => {
    const c = CASES.find((x) => x.name === "Hi-fi coaxial");
    if (!c) throw new Error("no coaxial case");
    const [chamber] = c.spec.cabinet.chambers;
    const [woofer] = chamber.drivers;
    const [hf] = named(
      buildSpeakerScene({ spec: c.spec, cutaway: false }),
      HIFI_MESH_NAMES.coaxHorn,
    );
    expect(worldOf(hf).y).toBeCloseTo(woofer.position.yIn, 6);
    expect(worldOf(hf).x).toBeCloseTo(0, 6);
  });

  test("a horn-loaded chamber has its mouth on the baffle and its flare behind it; a folded path is a placeholder", () => {
    const sub = paSpeaker(defaultPa, SPEAKER_PART.sub);
    const [base] = sub.cabinet.chambers;
    const segments = [
      { profile: HORN_PROFILE.exponential, s1: 500, s2: 1500, length: 20 },
      { profile: HORN_PROFILE.conical, s1: 1500, s2: 2000, length: 10 },
    ];
    const hornChamber = (path: (typeof HORN_PATH)[keyof typeof HORN_PATH]): SpeakerChamber => ({
      ...base,
      netLiters: 40,
      vent: { kind: VENT_KIND.sealed },
      load: {
        kind: CHAMBER_LOAD.horn,
        horn: {
          throatChamber: 2,
          segments,
          portOffset: 0,
          drive: { kind: HORN_DRIVE.front },
          path,
        },
      },
    });
    for (const path of [HORN_PATH.straight, HORN_PATH.folded]) {
      const spec = { ...sub, cabinet: { ...sub.cabinet, chambers: [hornChamber(path)] } };
      const solid = buildSpeakerScene({ spec, cutaway: false });
      const flare = named(solid, SPEAKER_MESH_NAMES.hornFlare);
      expect(flare).toHaveLength(segments.length);
      const box = boxOf(...flare);
      expect(box.max.z).toBeCloseTo(frontZ(spec) - spec.cabinet.insetIn, 6);
      expect(box.min.z).toBeGreaterThan(-base.dims.d / 2);
      // the front-loaded horn's driver sits at its throat, inside: drawn only in the cutaway
      expect(named(solid, SPEAKER_MESH_NAMES.hornDriver)).toHaveLength(0);
      expect(
        named(buildSpeakerScene({ spec, cutaway: true }), SPEAKER_MESH_NAMES.hornDriver),
      ).toHaveLength(1);
      const [placed] = speakerLayout(spec.cabinet).chambers;
      expect(hornFlare(spec.cabinet, placed)?.placeholder).toBe(path === HORN_PATH.folded);
      expect(hornFlare(spec.cabinet, placed)?.mouthClipped).toBe(false);
    }
    // a mouth larger than the clear face: cut to it, flagged, the flare shrunk to meet it
    const big = hornChamber(HORN_PATH.straight);
    if (big.load.kind !== CHAMBER_LOAD.horn) throw new Error("no horn");
    const huge = {
      ...big,
      load: {
        ...big.load,
        horn: { ...big.load.horn, segments: [{ ...segments[0], s2: 40_000 }] },
      },
    };
    const spec = { ...sub, cabinet: { ...sub.cabinet, chambers: [huge] } };
    const [placed] = speakerLayout(spec.cabinet).chambers;
    const flare = hornFlare(spec.cabinet, placed);
    expect(flare?.mouthClipped).toBe(true);
    expect(flare?.mouth.w).toBeLessThanOrEqual(placed.clear.w + EPS);
    expect(flare?.mouth.h).toBeLessThanOrEqual(placed.clear.h + EPS);
    const end = flare?.segments[0].mouth;
    expect((end?.w ?? 0) * (end?.h ?? 0)).toBeCloseTo(
      (flare?.mouth.w ?? 0) * (flare?.mouth.h ?? 0),
      6,
    );
  });
});

test("the tower's chambers share their walls: one shell, a partition at each chamber's floor", () => {
  const tower = CASES.find((c) => c.name === "PA tower");
  if (!tower) throw new Error("no tower case");
  const g = buildSpeakerScene({ spec: tower.spec, cutaway: true });
  expect(named(g, SPEAKER_GROUP_NAMES.shell)).toHaveLength(1);
  const T = tower.spec.cabinet.panel.thicknessIn;
  const floors = tower.spec.cabinet.chambers.slice(1).map((c) => c.at.yIn);
  const walls = named(g, SPEAKER_MESH_NAMES.partition).map((w) => boxOf(w));
  expect(walls).toHaveLength(floors.length);
  walls.forEach((w, i) => {
    // the lower chamber's top wall: its top face at the upper chamber's floor
    expect(w.max.y).toBeCloseTo(floors[i], 6);
    expect(w.min.y).toBeCloseTo(floors[i] - T, 6);
  });
});

describe("chambers that touch but don't fill one box: a stepped shell", () => {
  const tower = CASES.find((c) => c.name === "PA tower");
  if (!tower) throw new Error("no tower case");
  const [sub, mid] = tower.spec.cabinet.chambers;
  const T = tower.spec.cabinet.panel.thicknessIn;
  const withChambers = (chambers: SpeakerChamber[]): SpeakerSpec => ({
    ...tower.spec,
    cabinet: { ...tower.spec.cabinet, chambers },
  });
  /** the walls a chamber builds, as the layout gives them */
  const wallsOf = (spec: SpeakerSpec, i: number) => speakerLayout(spec.cabinet).chambers[i].walls;

  test("a narrower box on a wider one: one shared wall (the lower one's top), the upper builds none there", () => {
    const spec = withChambers([sub, { ...mid, dims: { ...mid.dims, w: mid.dims.w - 4 } }]);
    const g = buildSpeakerScene({ spec, cutaway: true });
    const [lower, upper] = named(g, SPEAKER_GROUP_NAMES.shell);
    const partitions = named(g, SPEAKER_MESH_NAMES.partition);
    expect(partitions).toHaveLength(1);
    // the lower chamber's: its top wall where the upper one stands
    expect(named(lower, SPEAKER_MESH_NAMES.partition)).toHaveLength(1);
    const p = boxOf(partitions[0]);
    expect(p.max.y).toBeCloseTo(sub.dims.h, 6);
    expect(p.min.y).toBeCloseTo(sub.dims.h - T, 6);
    expect(p.max.x - p.min.x).toBeCloseTo(mid.dims.w - 4, 6);
    // nothing of the upper chamber's own sits on that wall: no floor of its own
    for (const w of named(upper, SPEAKER_MESH_NAMES.wall))
      expect(boxOf(w).min.y, "the upper chamber's floor").toBeGreaterThan(sub.dims.h - EPS);
    const floor = wallsOf(spec, 1).filter((w) => Math.abs(w.y - sub.dims.h) < EPS && w.w > w.h);
    expect(floor).toHaveLength(0);
  });

  test("side by side: the right chamber has no left wall; the left chamber's right wall is the partition", () => {
    const right = { ...mid, at: { xIn: sub.dims.w, yIn: 0 }, dims: { ...mid.dims, h: sub.dims.h } };
    const spec = withChambers([sub, right]);
    const left = wallsOf(spec, 0).filter((w) => w.h > w.w);
    expect(left.filter((w) => w.shared)).toHaveLength(1);
    const placed = speakerLayout(spec.cabinet).chambers[1];
    expect(wallsOf(spec, 1).some((w) => w.h > w.w && Math.abs(w.x - placed.x0) < EPS)).toBe(false);
    // its clear face reaches the partition, as the model's (chamberClearFace) does
    expect(placed.clear.x).toBeCloseTo(placed.x0, 6);
    expect(
      named(buildSpeakerScene({ spec, cutaway: true }), SPEAKER_MESH_NAMES.partition),
    ).toHaveLength(1);
  });

  test("a wider box on a narrower one keeps its own floor only past the one under it", () => {
    const spec = withChambers([
      { ...sub, dims: { ...sub.dims, w: sub.dims.w - 6 }, at: { xIn: 3, yIn: 0 } },
      { ...mid, at: { xIn: 0, yIn: sub.dims.h } },
    ]);
    const floor = wallsOf(spec, 1).filter((w) => w.w > w.h && Math.abs(w.y - sub.dims.h) < EPS);
    expect(floor.map((w) => w.w)).toEqual([3, 3]);
    expect(floor.every((w) => !w.shared)).toBe(true);
  });

  test("chambers that don't touch are each their own box", () => {
    const spec = withChambers([sub, { ...mid, at: { xIn: 0, yIn: sub.dims.h + 2 } }]);
    const g = buildSpeakerScene({ spec, cutaway: true });
    expect(named(g, SPEAKER_GROUP_NAMES.shell)).toHaveLength(2);
    expect(named(g, SPEAKER_MESH_NAMES.partition)).toHaveLength(0);
    expect(named(g, SPEAKER_MESH_NAMES.wall)).toHaveLength(0);
  });
});

test("the 3D view's key changes with what the scene draws, not with the model's own inputs", () => {
  const tower = CASES.find((c) => c.name === "PA tower");
  if (!tower) throw new Error("no tower case");
  const key = (spec: SpeakerSpec) => speakerSceneKey({ spec, cutaway: false });
  const editChamber = (edit: (c: SpeakerChamber) => SpeakerChamber): SpeakerSpec => ({
    ...tower.spec,
    cabinet: { ...tower.spec.cabinet, chambers: tower.spec.cabinet.chambers.map(edit) },
  });
  const base = key(tower.spec);
  expect(key(editChamber((c) => ({ ...c, stuffingPct: c.stuffingPct + 10, netLiters: 50 })))).toBe(
    base,
  );
  expect(key({ ...tower.spec, bands: [] })).toBe(base);
  expect(key(editChamber((c) => ({ ...c, dims: { ...c.dims, d: c.dims.d + 1 } })))).not.toBe(base);
  expect(key({ ...tower.spec, look: { ...tower.spec.look, baffleColor: "#000000" } })).not.toBe(
    base,
  );
});

test("every geometry a build makes is in the scene, so the view frees it (three-memory pattern)", () => {
  /** the next geometry id: three.js numbers geometries in the order they are made */
  const nextId = () => {
    const probe = new THREE.BufferGeometry();
    probe.dispose();
    return probe.id;
  };
  for (const { name, spec } of CASES)
    for (const cutaway of [false, true]) {
      // once first, so the catalog horns' CAD meshes (built once and shared) are made
      buildSpeakerScene({ spec, cutaway });
      const before = nextId();
      // what the build frees itself (a horn body measured for its throat and dropped)
      const dispose = vi.spyOn(THREE.BufferGeometry.prototype, "dispose");
      let g: THREE.Group;
      try {
        g = buildSpeakerScene({ spec, cutaway });
      } finally {
        dispose.mockRestore();
      }
      const disposed = dispose.mock.calls.length;
      const after = nextId();
      const made = after - before - 1 - disposed;
      const reachable = new Set<number>();
      g.traverse((o) => {
        if (o instanceof THREE.Mesh && o.geometry.id > before && o.geometry.id < after)
          reachable.add(o.geometry.id);
      });
      expect(reachable.size, `${name}${cutaway ? ", cutaway" : ""}`).toBe(made);
    }
});

/** The shells' own panels' bounds: everything in them but the chambers' parts. */
function shellBox(spec: SpeakerSpec) {
  const shells = named(buildSpeakerScene({ spec, cutaway: false }), SPEAKER_GROUP_NAMES.shell);
  return boxOf(
    ...shells.flatMap((s) => s.children.filter((c) => c.name !== SPEAKER_GROUP_NAMES.chamber)),
  );
}
const caseSpec = (name: string) => {
  const found = CASES.find((c) => c.name === name);
  if (!found) throw new Error(`no case ${name}`);
  return found.spec;
};
const withCabinet = (spec: SpeakerSpec, over: Partial<SpeakerSpec["cabinet"]>): SpeakerSpec => ({
  ...spec,
  cabinet: { ...spec.cabinet, ...over },
});
/** The spec with its one chamber's vent changed. */
const withVent = (spec: SpeakerSpec, vent: SpeakerChamber["vent"]): SpeakerSpec => {
  const [chamber] = spec.cabinet.chambers;
  return withCabinet(spec, { chambers: [{ ...chamber, vent }] });
};

describe("the cabinet's construction and top", () => {
  test("the construction, not the inset, picks the cabinet: a PA box with no inset keeps its frame", () => {
    const flush = caseSpec("PA sub, folded slot, flush");
    expect(flush.cabinet.insetIn).toBe(0);
    expect(flush.cabinet.construction).toBe(CABINET_CONSTRUCTION.frameInset);
    // the frame's roundover bevel stands proud of the outline; the flush box's edges don't
    expect(shellBox(flush).min.y).toBeCloseTo(-ROUNDOVER_IN, 6);
    const box = withCabinet(flush, { construction: CABINET_CONSTRUCTION.flushBox });
    expect(shellBox(box).min.y).toBeCloseTo(0, 6);
  });

  test("a flush box takes no inset: its baffle is its front, in the model and the 3D view", () => {
    const box = withCabinet(caseSpec("PA sub, folded slot, flush"), {
      construction: CABINET_CONSTRUCTION.flushBox,
    });
    const inset = withCabinet(box, { insetIn: 3 });
    const [chamber] = box.cabinet.chambers;
    expect(chamberNetLiters(inset.cabinet, chamber, 0)).toBe(
      chamberNetLiters(box.cabinet, chamber, 0),
    );
    expect(speakerSceneKey({ spec: inset, cutaway: false })).toBe(
      speakerSceneKey({ spec: box, cutaway: false }),
    );
  });

  /** whether the spec's (first) shell has a vertex in a top corner of its outline */
  const topCorner = (spec: SpeakerSpec) => {
    const { size } = speakerLayout(spec.cabinet);
    const [shell] = named(buildSpeakerScene({ spec, cutaway: false }), SPEAKER_GROUP_NAMES.shell);
    const v = new THREE.Vector3();
    let found = false;
    for (const panel of shell.children.filter((c) => c.name !== SPEAKER_GROUP_NAMES.chamber))
      panel.traverse((m) => {
        if (!(m instanceof THREE.Mesh)) return;
        const at = m.geometry.getAttribute("position");
        for (let i = 0; i < at.count && !found; i++) {
          v.fromBufferAttribute(at, i).applyMatrix4(m.matrixWorld);
          found = Math.abs(v.x) > size.w / 2 - 1 && v.y > size.h - 1;
        }
      });
    return found;
  };
  /**
   * Whether the shell's own back panel is solid at (x, y), seen from the front: a ray from behind hits a panel within a
   * wall of the cabinet's back face.
   */
  const backSolidAt = (spec: SpeakerSpec, x: number, y: number) => {
    const backZ = frontZ(spec) - speakerLayout(spec.cabinet).size.d;
    const panels = named(
      buildSpeakerScene({ spec, cutaway: false }),
      SPEAKER_GROUP_NAMES.shell,
    ).flatMap((s) => s.children.filter((c) => c.name !== SPEAKER_GROUP_NAMES.chamber));
    const ray = new THREE.Raycaster(new THREE.Vector3(x, y, backZ - 1), new THREE.Vector3(0, 0, 1));
    return ray
      .intersectObjects(panels, true)
      .some((hit) => hit.point.z < backZ + spec.cabinet.panel.thicknessIn + EPS);
  };

  test("an arched top is a semicircle the full width over the tower's one shell", () => {
    const tower = caseSpec("PA tower");
    expect(tower.cabinet.top).toBe(CABINET_TOP.arched);
    expect(drawsArchedTop(tower.cabinet, speakerLayout(tower.cabinet))).toBe(true);
    const flat = withCabinet(tower, { top: CABINET_TOP.flat });
    expect(topCorner(tower)).toBe(false);
    expect(topCorner(flat)).toBe(true);
    expect(speakerSceneKey({ spec: tower, cutaway: false })).not.toBe(
      speakerSceneKey({ spec: flat, cutaway: false }),
    );
  });

  test("the arch goes over the top chamber only: a top chamber less than half the width tall stays flat", () => {
    const tower = caseSpec("PA tower");
    const [sub, mid] = tower.cabinet.chambers;
    const short = withCabinet(tower, {
      chambers: [sub, { ...mid, dims: { ...mid.dims, h: mid.dims.w / 2 - 2 } }],
    });
    const layout = speakerLayout(short.cabinet);
    expect(layout.oneShell).toBe(true);
    expect(layout.chambers[1].dims.h).toBeLessThan(layout.size.w / 2);
    expect(layout.size.h).toBeGreaterThanOrEqual(layout.size.w / 2);
    expect(drawsArchedTop(short.cabinet, layout)).toBe(false);
    expect(topCorner(short)).toBe(true);
  });

  test("an arched back takes its holes: a port on the back of the tower's top chamber", () => {
    const tower = caseSpec("PA tower");
    const [sub, mid, top] = tower.cabinet.chambers;
    const n = 2;
    const vented: SpeakerChamber = {
      ...top,
      vent: {
        kind: VENT_KIND.vented,
        port: { n, dia: 2, len: 6, position: { panel: PANEL.back, xIn: 0, yIn: 6 } },
        maxSpeedMs: 17,
      },
    };
    const withPort = withCabinet(tower, { chambers: [sub, mid, vented] });
    const placed = speakerLayout(withPort.cabinet);
    expect(drawsArchedTop(withPort.cabinet, placed)).toBe(true);
    const [, , topPlaced] = placed.chambers;
    if (vented.vent.kind !== VENT_KIND.vented) throw new Error("no port");
    const { port } = vented.vent;
    if (port.shape === PORT_SHAPE.slot || port.shape === PORT_SHAPE.duct)
      throw new Error("no tubes");
    const { spots } = roundPortsAt(topPlaced, port);
    expect(spots).toHaveLength(n);
    for (const s of spots) {
      const x = topPlaced.cx + s.x,
        y = topPlaced.y0 + s.y;
      expect(backSolidAt(tower, x, y)).toBe(true);
      expect(backSolidAt(withPort, x, y)).toBe(false);
    }
  });
});

describe("vent and mouth positions", () => {
  /** each round port's flange (its lip on the panel's outer face), in world coordinates */
  const lips = (spec: SpeakerSpec) =>
    named(buildSpeakerScene({ spec, cutaway: false }), HIFI_MESH_NAMES.port)
      .filter((o) => o instanceof THREE.Mesh && o.geometry instanceof THREE.ShapeGeometry)
      .map(worldOf);
  /** the vented Hi-fi case, its round port, its chamber placed, and the spec with the port changed */
  const vented = () => {
    const spec = caseSpec("Hi-fi on a waveguide (in the baffle), vented");
    const [chamber] = spec.cabinet.chambers;
    if (chamber.vent.kind !== VENT_KIND.vented) throw new Error("no port");
    const { vent } = chamber;
    const { port } = vent;
    // a Hi-fi round port: its shape absent or round, not flared
    if (port.shape === PORT_SHAPE.slot || port.shape === PORT_SHAPE.duct || port.flared)
      throw new Error("no Hi-fi round port");
    const [placed] = speakerLayout(spec.cabinet).chambers;
    const withPort = (over: Pick<typeof port, "position"> & Partial<Pick<typeof port, "len">>) =>
      withVent(spec, { ...vent, port: { ...port, ...over } });
    return { spec, port, placed, withPort };
  };

  test("a round port at a set position: the layout and the 3D view put it there, on the baffle or the back", () => {
    const { spec, port, placed, withPort } = vented();
    // absent: the Hi-fi rule, on the baffle
    expect(roundPortsAt(placed, port).panel).toBe(PANEL.baffle);
    for (const panel of [PANEL.baffle, PANEL.back] as const) {
      const position = { panel, xIn: 2, yIn: 8 };
      const moved = withPort({ position });
      const at = roundPortsAt(placed, { ...port, position });
      expect([at.panel, at.moved]).toEqual([panel, false]);
      const mean = (pick: (s: { x: number; y: number }) => number) =>
        at.spots.reduce((sum, s) => sum + pick(s), 0) / at.spots.length;
      expect(mean((s) => s.x)).toBeCloseTo(2, 9);
      expect(mean((s) => s.y)).toBeCloseTo(8, 9);
      const drawn = lips(moved);
      expect(drawn).toHaveLength(at.spots.length);
      drawn.forEach((w, i) => {
        // seen from the front, on the back too
        expect(w.x, panel).toBeCloseTo(placed.cx + at.spots[i].x, 6);
        expect(w.y, panel).toBeCloseTo(placed.y0 + at.spots[i].y, 6);
        if (panel === PANEL.baffle) expect(w.z, panel).toBeGreaterThan(frontZ(spec) - EPS);
        else expect(w.z, panel).toBeLessThan(frontZ(spec) - placed.dims.d + EPS);
      });
      expect(speakerSceneKey({ spec: moved, cutaway: false })).not.toBe(
        speakerSceneKey({ spec, cutaway: false }),
      );
    }
  });

  test("a set port position past the clear face is moved inside it, and flagged", () => {
    const { port, placed, withPort } = vented();
    const position = { panel: PANEL.baffle, xIn: placed.dims.w, yIn: -5 };
    const at = roundPortsAt(placed, { ...port, position });
    expect(at.moved).toBe(true);
    const lo = { x: placed.clear.x - placed.cx, y: placed.clear.y - placed.y0 };
    for (const s of at.spots) {
      const r = s.r + HIFI_BOX_LAYOUT.portTubeWallIn;
      expect(s.x + r).toBeLessThanOrEqual(lo.x + placed.clear.w + EPS);
      expect(s.y - r).toBeGreaterThanOrEqual(lo.y - EPS);
    }
    const spec = withPort({ position });
    expect(ventMoved(spec.cabinet, speakerLayout(spec.cabinet).chambers[0])).toBe(true);
    expect(ventMoved(spec.cabinet, placed)).toBe(false);
  });

  test("a folded port set in the upper half folds down, inside its chamber, on the baffle or the back", () => {
    const { port, withPort } = vented();
    for (const panel of [PANEL.baffle, PANEL.back] as const) {
      const spec = withPort({ len: 18, position: { panel, xIn: 0, yIn: 15 } });
      const [placed] = speakerLayout(spec.cabinet).chambers;
      const parts = named(buildSpeakerScene({ spec, cutaway: true }), HIFI_MESH_NAMES.port);
      const box = boxOf(...parts);
      expect(box.min.x, panel).toBeGreaterThanOrEqual(placed.x0 - EPS);
      expect(box.max.x, panel).toBeLessThanOrEqual(placed.x0 + placed.dims.w + EPS);
      expect(box.min.y, panel).toBeGreaterThanOrEqual(placed.clear.y - EPS);
      expect(box.max.y, panel).toBeLessThanOrEqual(placed.clear.y + placed.clear.h + EPS);
      // it turned down past the row
      expect(box.min.y, panel).toBeLessThan(placed.y0 + 15 - port.dia);
      expect(box.min.z, panel).toBeGreaterThanOrEqual(frontZ(spec) - placed.dims.d - 0.1);
      expect(box.max.z, panel).toBeLessThanOrEqual(frontZ(spec) + 0.1);
    }
  });

  test("radiators at a set position: the stack's center on its panel", () => {
    const spec = caseSpec("Hi-fi default, radiators");
    const [rule] = speakerLayout(spec.cabinet).chambers;
    const ruled = radiatorsAt(spec.cabinet, rule).spots;
    expect(ruled.length).toBeGreaterThan(0);
    expect(ruled.every((s) => s.panel === PANEL.back)).toBe(true);
    const { chamber } = rule;
    if (chamber.vent.kind !== VENT_KIND.radiator) throw new Error("no radiators");
    // the rule's height, and across by half the room the clear face leaves beside them
    const xIn = (rule.clear.w - ruled[0].shape.w) / 4,
      yIn = ruled.reduce((sum, s) => sum + s.y, 0) / ruled.length;
    expect(xIn).toBeGreaterThan(0);
    const moved = withVent(spec, { ...chamber.vent, position: { panel: PANEL.baffle, xIn, yIn } });
    const [placed] = speakerLayout(moved.cabinet).chambers;
    const { spots, moved: clamped } = radiatorsAt(moved.cabinet, placed);
    expect(clamped).toBe(false);
    expect(spots.length).toBeGreaterThan(0);
    expect(spots.every((s) => s.panel === PANEL.baffle && s.x === xIn)).toBe(true);
    expect(spots.reduce((sum, s) => sum + s.y, 0) / spots.length).toBeCloseTo(yIn, 9);
    const drawn = named(
      buildSpeakerScene({ spec: moved, cutaway: false }),
      HIFI_MESH_NAMES.radiator,
    );
    expect(drawn).toHaveLength(spots.length);
    drawn.forEach((o, i) => {
      const w = worldOf(o);
      expect(w.x).toBeCloseTo(placed.cx + xIn, 6);
      expect(w.y).toBeCloseTo(placed.y0 + spots[i].y, 6);
      // on the baffle's face
      expect(w.z).toBeCloseTo(frontZ(moved), 6);
    });
    // set past the top: moved inside, flagged
    const high = withVent(spec, {
      ...chamber.vent,
      position: { panel: PANEL.baffle, xIn: 0, yIn: placed.dims.h * 2 },
    });
    const [highPlaced] = speakerLayout(high.cabinet).chambers;
    const above = radiatorsAt(high.cabinet, highPlaced);
    expect(above.moved).toBe(true);
    for (const s of above.spots)
      expect(s.y + s.shape.h / 2).toBeLessThanOrEqual(
        highPlaced.clear.y - highPlaced.y0 + highPlaced.clear.h + EPS,
      );
    expect(ventMoved(high.cabinet, highPlaced)).toBe(true);
  });

  test("a horn-loaded chamber's mouth at a set position: there, or moved inside the clear face and flagged", () => {
    const sub = paSpeaker(defaultPa, SPEAKER_PART.sub);
    const [base] = sub.cabinet.chambers;
    const hornAt = (mouthPosition: { xIn: number; yIn: number }): SpeakerSpec =>
      withCabinet(sub, {
        chambers: [
          {
            ...base,
            netLiters: 40,
            vent: { kind: VENT_KIND.sealed },
            load: {
              kind: CHAMBER_LOAD.horn,
              horn: {
                throatChamber: 2,
                segments: [{ profile: HORN_PROFILE.exponential, s1: 100, s2: 400, length: 20 }],
                portOffset: 0,
                drive: { kind: HORN_DRIVE.back },
                path: HORN_PATH.straight,
                mouthPosition,
              },
            },
          },
        ],
      });
    const spec = hornAt({ xIn: 1, yIn: 6 });
    const [placed] = speakerLayout(spec.cabinet).chambers;
    const flare = hornFlare(spec.cabinet, placed);
    if (!flare) throw new Error("no flare");
    expect(flare.mouthMoved).toBe(false);
    expect(flare.mouth.x + flare.mouth.w / 2).toBeCloseTo(placed.cx + 1, 9);
    expect(flare.mouth.y + flare.mouth.h / 2).toBeCloseTo(placed.y0 + 6, 9);
    const [mesh] = named(buildSpeakerScene({ spec, cutaway: false }), SPEAKER_MESH_NAMES.hornFlare);
    expect(worldOf(mesh).x).toBeCloseTo(placed.cx + 1, 6);
    expect(worldOf(mesh).y).toBeCloseTo(placed.y0 + 6, 6);
    // set past the corner: moved into it
    const out = hornAt({ xIn: -placed.dims.w, yIn: placed.dims.h * 2 });
    const moved = hornFlare(out.cabinet, speakerLayout(out.cabinet).chambers[0]);
    if (!moved) throw new Error("no flare");
    expect(moved.mouthMoved).toBe(true);
    expect(moved.mouth.x).toBeCloseTo(placed.clear.x, 9);
    expect(moved.mouth.y + moved.mouth.h).toBeCloseTo(placed.clear.y + placed.clear.h, 9);
  });
});
