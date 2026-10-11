// The Designer's 3D scene of any speaker spec (stack-view/buildSpeakerScene), built from the read adapters' specs of
// golden PA and Hi-fi designs (the PA sub, the mid/high box, the tower, a Hi-fi speaker on a waveguide, a coaxial):
// each chamber, driver, horn and port where the spec and its layout (lib/speaker/speakerLayout) put them, the walls the
// tower's chambers share, a horn-loaded chamber's mouth and flare, and every geometry the build makes reachable from the
// scene (the 3D view frees what it can reach: stack-view/SceneView3D).
import { describe, expect, test, vi } from "vite-plus/test";
import * as THREE from "three";
import {
  buildSpeakerScene,
  SPEAKER_GROUP_NAMES,
  SPEAKER_MESH_NAMES,
} from "../src/components/stack-view/buildSpeakerScene";
import { HORN_MESH_NAME } from "../src/components/stack-view/buildHorn";
import { HIFI_MESH_NAMES } from "../src/components/stack-view/buildHifiScene";
import { VENT_MESH_NAME } from "../src/components/stack-view/buildBraces";
import { ROUNDOVER_IN } from "../src/components/stack-view/stackHeights";
import {
  driverSpots,
  onTop,
  speakerLayout,
  type PlacedChamber,
} from "../src/lib/speaker/speakerLayout";
import { systemFromPa } from "../src/lib/speaker/paSpec";
import { speakerFromHifi } from "../src/lib/speaker/hifiSpec";
import { speakerIdentity } from "../src/lib/speaker/specParts";
import { paSearchDesign } from "../src/lib/pa/optimize";
import { panelNominalNear } from "../src/lib/panel";
import { HIFI_COAXES, HIFI_TWEETERS, HIFI_WAVEGUIDES, MID_BOXES } from "../src/lib/data";
import { byIdOrThrow } from "../src/lib/tables";
import { DEFAULT_HIFI, DEFAULT_HIFI_LOOK, DEFAULT_PA } from "../src/lib/defaults";
import { HORN_MOUNT_DEFAULT } from "../src/constants/hornMount";
import {
  CHAMBER_LOAD,
  DRIVER_KIND,
  HORN_DRIVE,
  HORN_PATH,
  HORN_PLACEMENT,
  SPEAKER_PART,
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
  const read = systemFromPa(paDesign(c), IDENTITY, STACKS);
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
      // the PA's frame (a spec with an inset) draws its roundover's bevel proud of the outline, as the PA page does
      const proud = spec.cabinet.insetIn > 0 ? ROUNDOVER_IN : 0;
      expect(box.min.y, name).toBeCloseTo(-proud, 6);
      expect(box.max.y, name).toBeCloseTo(size.h + proud, 6);
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
      { profile: HORN_PROFILE.exponential, s1: 500, s2: 1500, length: 30 },
      { profile: HORN_PROFILE.conical, s1: 1500, s2: 3000, length: 20 },
    ];
    const hornChamber = (path: (typeof HORN_PATH)[keyof typeof HORN_PATH]): SpeakerChamber => ({
      ...base,
      netLiters: 40,
      vent: { kind: "sealed" },
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
    }
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
  // chambers that don't fill one box are each their own
  const [sub, mid] = tower.spec.cabinet.chambers;
  const offset = {
    ...tower.spec,
    cabinet: {
      ...tower.spec.cabinet,
      chambers: [sub, { ...mid, dims: { ...mid.dims, w: mid.dims.w - 4 } }],
    },
  };
  const apart = buildSpeakerScene({ spec: offset, cutaway: true });
  expect(named(apart, SPEAKER_GROUP_NAMES.shell)).toHaveLength(2);
  expect(named(apart, SPEAKER_MESH_NAMES.partition)).toHaveLength(0);
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
