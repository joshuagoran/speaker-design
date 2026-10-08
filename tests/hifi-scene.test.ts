// The Hi-fi speaker's 3D scene (stack-view/buildHifiScene), built from the props the Hi-fi page passes for a design
// (pages/hifi/hifiSceneProps): the box at the design's size, each vent, the passive radiators on each panel, each kind
// of tweeter and waveguide, and a freestanding waveguide on its mount (the aluminum plate, or the brackets it gives way
// to).
import { describe, expect, test } from "vite-plus/test";
import * as THREE from "three";
import {
  buildHifiScene,
  hifiCompressionDriver,
  HIFI_MESH_NAMES,
  type HifiSceneProps,
} from "../src/components/stack-view/buildHifiScene";
import { HIFI_CABINET_MESH_NAMES } from "../src/components/stack-view/buildHifiCabinet";
import {
  ADAPTER_MESH_NAME,
  CD_MESH_NAME,
  HORN_MESH_NAME,
} from "../src/components/stack-view/buildHorn";
import { BRACKET_MESH_NAME } from "../src/components/stack-view/buildBracket";
import { PLATE_MESH_NAMES, plateFit } from "../src/components/stack-view/buildPlate";
import { hifiSceneProps } from "../src/pages/hifi/hifiSceneProps";
import { deriveHifiDesign } from "../src/pages/hifi/hifiDesign";
import { DEFAULT_HIFI, DEFAULT_HIFI_LOOK } from "../src/lib/defaults";
import {
  CD_OPTIONS,
  HIFI_TWEETERS,
  HIFI_WAVEGUIDES,
  HORN_OPTIONS,
  cdBodySteps,
} from "../src/lib/data";
import { needsWaveguide } from "../src/lib/hifi/hifi";
import { radiatorSpots, roundPortSpots } from "../src/lib/hifi/boxLayout";
import { HIFI_GENERIC_BODIES } from "../src/constants/hifiScene";
import { HORN_MESHES } from "../src/data/meshes";
import { byIdOrThrow } from "../src/lib/tables";
import { HIFI_ROUNDOVER_CHOICES } from "../src/constants/hifiLayout";
import type { HifiDesignState, HifiWaveguide, RadiatorPanel } from "../src/types";

const EPS = 1e-6;

const WAVEGUIDES = HIFI_WAVEGUIDES;
const waveguide = (id: string) => byIdOrThrow(WAVEGUIDES, id, "waveguides");
const tweeter = (id: string) => byIdOrThrow(HIFI_TWEETERS, id, "tweeters");

/** The scene props the Hi-fi page passes for the default design with `over` changed. */
function propsFor(over: Partial<HifiDesignState>, extra: Partial<HifiSceneProps> = {}) {
  const state = { ...DEFAULT_HIFI, ...over };
  const d = deriveHifiDesign(state);
  const system = d.speakerModel?.speakerSystem;
  if (!system) throw new Error("the design can't be modeled");
  return { ...hifiSceneProps(state, d, system, DEFAULT_HIFI_LOOK, false), ...extra };
}

/** Every object named `name` (meshes and groups). */
function named(g: THREE.Object3D, name: string) {
  const out: THREE.Object3D[] = [];
  g.updateMatrixWorld(true);
  g.traverse((o) => o.name === name && out.push(o));
  return out;
}
/** The bounding box of every object named one of `names`. */
function boxOf(g: THREE.Object3D, ...names: string[]) {
  const box = new THREE.Box3();
  names.flatMap((n) => named(g, n)).forEach((o) => box.expandByObject(o));
  return box;
}
const scene = (p: HifiSceneProps) => buildHifiScene(p);
const cabinetBox = (g: THREE.Object3D) =>
  boxOf(g, HIFI_CABINET_MESH_NAMES.baffle, HIFI_CABINET_MESH_NAMES.shell);

describe("the box", () => {
  test("is the design's size, on the floor, centered, at every roundover", () => {
    for (const boxDims of [
      { w: 9, h: 15, d: 11 },
      { w: 8, h: 15, d: 7 },
      { w: 16, h: 44, d: 16 },
    ])
      for (const roundoverIn of [0, 0.75, 2]) {
        const p = propsFor({ boxDims, roundoverIn });
        const b = cabinetBox(scene(p));
        const tag = `${JSON.stringify(boxDims)} r ${roundoverIn}`;
        expect(b.min.x, tag).toBeCloseTo(-boxDims.w / 2, 6);
        expect(b.max.x, tag).toBeCloseTo(boxDims.w / 2, 6);
        expect(b.min.y, tag).toBeCloseTo(0, 6);
        expect(b.max.y, tag).toBeCloseTo(boxDims.h, 6);
        expect(b.min.z, tag).toBeCloseTo(-boxDims.d / 2, 6);
        expect(b.max.z, tag).toBeCloseTo(boxDims.d / 2, 6);
      }
  });

  test("the woofer sits at the model's height", () => {
    const p = propsFor({});
    const woofer = boxOf(scene(p), HIFI_MESH_NAMES.woofer);
    expect(woofer.getCenter(new THREE.Vector3()).y).toBeCloseTo(p.lay.wooferIn, 6);
  });
});

describe("the baffle's flat face", () => {
  /** The flat face: its triangles' area, and its outline's less its holes' (as the geometry draws them). */
  function faceAreas(g: THREE.Object3D) {
    const [face] = named(g, HIFI_CABINET_MESH_NAMES.baffle).filter(
      (o): o is THREE.Mesh<THREE.ShapeGeometry> =>
        o instanceof THREE.Mesh && o.geometry instanceof THREE.ShapeGeometry,
    );
    if (!face) throw new Error("no flat face");
    // three keeps what it triangulated on the geometry (its typings here don't list it)
    const params: { shapes?: unknown; curveSegments?: number } = Reflect.get(
      face.geometry,
      "parameters",
    );
    const shape = Array.isArray(params.shapes) ? params.shapes[0] : params.shapes;
    if (!(shape instanceof THREE.Shape)) throw new Error("no face shape");
    const { shape: outline, holes } = shape.extractPoints(params.curveSegments ?? 12);
    const area = (pts: THREE.Vector2[]) => Math.abs(THREE.ShapeUtils.area(pts));
    const expected =
      area(outline) - holes.reduce((sum: number, h: THREE.Vector2[]) => sum + area(h), 0);
    const pos = face.geometry.getAttribute("position");
    const index = face.geometry.getIndex();
    if (!index) throw new Error("an unindexed face");
    let drawn = 0;
    for (let i = 0; i < index.count; i += 3) {
      const [a, b, c] = [i, i + 1, i + 2].map((k) =>
        new THREE.Vector3().fromBufferAttribute(pos, index.getX(k)),
      );
      drawn += Math.abs((b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y)) / 2;
    }
    return { drawn, expected };
  }

  test("triangulates to its outline less its holes at every roundover, with every vent and tweeter", () => {
    const vents: Partial<HifiDesignState>[] = [
      { boxType: "sealed" },
      { boxType: "vented", portSpec: { n: 1, dia: 2, len: 6 } },
      { boxType: "vented", portSpec: { n: 2, dia: 2, len: 6 } },
      { boxType: "vented", portSpec: { shape: "slot", n: 1, h: 1, len: 6 } },
      // radiators on the baffle (the page puts them on the back), under the drivers of a box tall enough for both
      { boxType: "radiator", boxDims: { w: 12, h: 40, d: 11 } },
    ];
    const tweeters: Partial<HifiDesignState>[] = [
      {},
      { tweeter: tweeter("ft17h") },
      { tweeter: tweeter("lt22") },
      { tweeter: tweeter("de250"), selectedWaveguide: waveguide("diy_os90x70") },
    ];
    for (const roundoverIn of HIFI_ROUNDOVER_CHOICES)
      for (const vent of vents)
        for (const t of tweeters) {
          const p = propsFor({ ...vent, ...t, roundoverIn }, { radiatorPanel: "baffle" });
          const { drawn, expected } = faceAreas(scene(p));
          const tag = `r ${roundoverIn} ${JSON.stringify(vent)} ${p.tweeter.type}`;
          expect(expected, tag).toBeGreaterThan(0);
          expect(drawn / expected, tag).toBeCloseTo(1, 6);
        }
  });
});

describe("the vent", () => {
  test("sealed: no port", () => {
    const g = scene(propsFor({ boxType: "sealed" }));
    expect(named(g, HIFI_MESH_NAMES.port)).toHaveLength(0);
    expect(named(g, HIFI_MESH_NAMES.slotShelf)).toHaveLength(0);
  });

  test("round ports: a flanged tube at each opening the 2D drawing places", () => {
    for (const n of [1, 2]) {
      const p = propsFor({ boxType: "vented", portSpec: { n, dia: 2, len: 6 } });
      const g = scene(p);
      const flanges = named(g, HIFI_MESH_NAMES.port).filter(
        (o) => o instanceof THREE.Mesh && o.geometry.type === "ShapeGeometry",
      );
      expect(flanges).toHaveLength(n);
      const spots = roundPortSpots({ n, dia: 2 });
      flanges.forEach((f, i) => {
        expect(f.position.x).toBeCloseTo(spots[i].x, 6);
        expect(f.position.y).toBeCloseTo(spots[i].y, 6);
      });
      const tubes = named(g, HIFI_MESH_NAMES.port).filter(
        (o) => o instanceof THREE.Mesh && o.geometry.type === "CylinderGeometry",
      );
      expect(tubes).toHaveLength(n); // straight: one length each
    }
  });

  test("a round port too long to run straight folds up the back wall, as the model folds it", () => {
    const p = propsFor({ boxType: "vented", portSpec: { n: 1, dia: 2, len: 14 } });
    const g = scene(p);
    const elbows = named(g, HIFI_MESH_NAMES.port).filter(
      (o) => o instanceof THREE.Mesh && o.geometry.type === "TorusGeometry",
    );
    expect(elbows.length).toBeGreaterThan(0);
    // the tube stays inside the box
    const tube = boxOf(g, HIFI_MESH_NAMES.port);
    expect(tube.min.z).toBeGreaterThan(-p.dim.d / 2);
  });

  test("slot: an opening the inside width along the bottom, under a shelf as long as the slot", () => {
    const p = propsFor({ boxType: "vented", portSpec: { shape: "slot", n: 1, h: 1, len: 6 } });
    const g = scene(p);
    expect(named(g, HIFI_MESH_NAMES.port)).toHaveLength(0);
    const [shelf] = named(g, HIFI_MESH_NAMES.slotShelf);
    expect(shelf).toBeDefined();
    const b = new THREE.Box3().setFromObject(shelf);
    expect(b.max.x - b.min.x).toBeCloseTo(p.dim.w - 2 * p.wall, 6);
    expect(b.min.y).toBeCloseTo(p.wall + 1, 6); // its underside: the slot's height above the bottom panel
    expect(b.max.z).toBeCloseTo(p.dim.d / 2 - p.wall, 6); // from the baffle's back face
    expect(b.min.z).toBeCloseTo(p.dim.d / 2 - p.wall - 6, 6); // the slot's length behind it
  });
});

describe("passive radiators", () => {
  const radiatorsOn = (panel: RadiatorPanel, n: number) => {
    const p = propsFor(
      { boxType: "radiator", radiatorSelection: { ...DEFAULT_HIFI.radiatorSelection, n } },
      { radiatorPanel: panel },
    );
    if (!p.radiators) throw new Error("no radiators");
    return {
      p,
      groups: named(scene(p), HIFI_MESH_NAMES.radiator),
      spots: radiatorSpots(p.radiators, panel, p.wall),
    };
  };

  test("on the back (the page's panel): stacked up its center, facing back", () => {
    const { p, groups, spots } = radiatorsOn("back", 2);
    expect(p.radiatorPanel).toBe("back");
    expect(groups).toHaveLength(2);
    groups.forEach((g, i) => {
      expect(g.position.z).toBeCloseTo(-p.dim.d / 2, 6);
      expect(g.position.x).toBeCloseTo(0, 6);
      expect(g.position.y).toBeCloseTo(spots[i].y, 6);
      expect(g.getWorldDirection(new THREE.Vector3()).z).toBeCloseTo(-1, 6);
    });
  });

  test("on the baffle: on its face, facing forward", () => {
    const { p, groups } = radiatorsOn("baffle", 1);
    expect(groups).toHaveLength(1);
    expect(groups[0].position.z).toBeCloseTo(p.dim.d / 2, 6);
    expect(groups[0].getWorldDirection(new THREE.Vector3()).z).toBeCloseTo(1, 6);
  });

  test("on the sides: one on the outside, an even count split, an odd one's extra outside", () => {
    for (const [n, outside, inside] of [
      [1, 1, 0],
      [2, 1, 1],
      [3, 2, 1],
    ] as const) {
      const { p, groups } = radiatorsOn("side", n);
      const xs = groups.map((g) => g.position.x);
      expect(
        xs.filter((x) => Math.abs(x + p.dim.w / 2) < EPS),
        `${n}`,
      ).toHaveLength(outside);
      expect(
        xs.filter((x) => Math.abs(x - p.dim.w / 2) < EPS),
        `${n}`,
      ).toHaveLength(inside);
      for (const g of groups) {
        const facing = g.getWorldDirection(new THREE.Vector3());
        expect(facing.x).toBeCloseTo(Math.sign(g.position.x), 6);
      }
    }
  });
});

describe("the tweeter", () => {
  test("a dome: its faceplate flush in the baffle and the dome on it, at the model's height and offset", () => {
    const p = propsFor({ tweeterOffsetIn: 0.5 });
    const g = scene(p);
    expect(p.tweeter.type).toBe("dome");
    const plate = boxOf(g, HIFI_MESH_NAMES.faceplate);
    expect(plate.max.z).toBeCloseTo(p.dim.d / 2, 6);
    expect(plate.max.x - plate.min.x).toBeCloseTo(p.tweeter.faceplate.w, 2);
    const c = plate.getCenter(new THREE.Vector3());
    expect(c.x).toBeCloseTo(p.tweeterOffsetIn, 6);
    expect(p.tweeterOffsetIn).toBeGreaterThan(0);
    expect(c.y).toBeCloseTo(p.lay.tweeterIn, 6);
    expect(named(g, HIFI_MESH_NAMES.dome).length).toBeGreaterThan(0);
    expect(named(g, HORN_MESH_NAME)).toHaveLength(0);
  });

  test("a horn-loaded tweeter: its faceplate round its flare", () => {
    const g = scene(propsFor({ tweeter: tweeter("ft17h") }));
    expect(named(g, HIFI_MESH_NAMES.flare)).toHaveLength(1);
    expect(named(g, HIFI_MESH_NAMES.faceplate)).toHaveLength(1);
    expect(named(g, HIFI_MESH_NAMES.dome)).toHaveLength(0);
  });

  test("a ribbon: its own waveguide's plate flush in the baffle, the diaphragm in its throat", () => {
    const t = tweeter("lt32");
    const p = propsFor({ tweeter: t });
    const g = scene(p);
    expect(p.guide?.freestanding).toBe(false);
    expect(p.waveguide).toBeNull();
    const plate = boxOf(g, HIFI_MESH_NAMES.faceplate);
    expect(plate.max.x - plate.min.x).toBeCloseTo(t.ownGuide?.w ?? 0, 6);
    expect(plate.max.z).toBeCloseTo(p.dim.d / 2, 6);
    expect(named(g, HIFI_MESH_NAMES.ribbon)).toHaveLength(1);
    expect(named(g, HORN_MESH_NAME)).toHaveLength(0);
  });

  test("the DIY OS 90×70 with the DE250: its mesh on the box top, on the aluminum plate, with the PA driver's body", () => {
    const p = propsFor({ tweeter: tweeter("de250"), selectedWaveguide: waveguide("diy_os90x70") });
    const g = scene(p);
    expect(p.lay.onTop).toBe(true);
    const [horn] = named(g, HORN_MESH_NAME);
    expect(horn instanceof THREE.Mesh && horn.geometry.type).toBe("BufferGeometry");
    expect(HORN_MESHES.diy_os90x70).toBeDefined();
    const hornBox = new THREE.Box3().setFromObject(horn);
    expect(hornBox.min.y).toBeGreaterThan(p.dim.h);
    expect(hornBox.max.z).toBeCloseTo(p.dim.d / 2, 4); // its mouth on the box's front plane
    expect(named(g, PLATE_MESH_NAMES.plate).length).toBeGreaterThan(0);
    expect(named(g, BRACKET_MESH_NAME)).toHaveLength(0);
    // the PA catalogue's DE250 body
    const pa = byIdOrThrow(CD_OPTIONS, "de250", "compression drivers");
    const front = named(g, CD_MESH_NAME)[0];
    expect(front instanceof THREE.Mesh && front.geometry).toBeInstanceOf(THREE.CylinderGeometry);
    if (front instanceof THREE.Mesh && front.geometry instanceof THREE.CylinderGeometry)
      expect(front.geometry.parameters.radiusTop * 2).toBeCloseTo(cdBodySteps(pa.body)[0][0], 6);
    // the plate's foot stays on the box top
    expect(boxOf(g, PLATE_MESH_NAMES.foot).min.y).toBeGreaterThanOrEqual(p.dim.h - EPS);
  });

  test("the ST260: its turned profile on the box top", () => {
    const p = propsFor({ tweeter: tweeter("de250"), selectedWaveguide: waveguide("st260") });
    const [horn] = named(scene(p), HORN_MESH_NAME);
    expect(horn instanceof THREE.Mesh && horn.geometry.type).toBe("LatheGeometry");
  });

  test("a compression driver the PA catalogue doesn't list gets the generic body, its own diameter across", () => {
    const t = tweeter("de10");
    expect(CD_OPTIONS.some((c) => c.id === t.id)).toBe(false);
    const cd = hifiCompressionDriver(t);
    expect(cd.body.dia).toBe(t.faceplate.w);
    expect(cd.body.depth).toBeCloseTo(
      t.faceplate.w * HIFI_GENERIC_BODIES.compressionDriver.depthPerDia,
      9,
    );
    expect(cd.body.bolts).toEqual(HIFI_GENERIC_BODIES.compressionDriver.bolts);
    const g = scene(propsFor({ tweeter: t, selectedWaveguide: waveguide("diy_os90x70") }));
    expect(named(g, CD_MESH_NAME).length).toBeGreaterThan(0);
  });

  test("a horn on a throat adapter takes the adapter's bracket on the box top", () => {
    const horn = WAVEGUIDES.find((h) => h.adapter);
    if (!horn) throw new Error("no waveguide with an adapter");
    const g = scene(propsFor({ tweeter: tweeter("de250"), selectedWaveguide: horn }));
    expect(named(g, ADAPTER_MESH_NAME).length).toBeGreaterThan(0);
    expect(named(g, PLATE_MESH_NAMES.plate)).toHaveLength(0);
  });

  test("where the plate can't hold the driver, the clamped L-bracket holds it (PA's fallback)", () => {
    // every Hi-fi compression driver on every waveguide it bolts straight to, with the box under it
    const combos = HIFI_TWEETERS.filter(needsWaveguide).flatMap((t) =>
      WAVEGUIDES.filter((h) => !h.adapter).map((h) => ({ t, h })),
    );
    const dim = DEFAULT_HIFI.boxDims;
    const misfit = combos.find(({ t, h }) => plateFit(h, hifiCompressionDriver(t), dim.w) === null);
    const fit = combos.find(({ t, h }) => plateFit(h, hifiCompressionDriver(t), dim.w) !== null);
    if (!fit) throw new Error("no driver the plate holds");
    const onPlate = scene(propsFor({ tweeter: fit.t, selectedWaveguide: fit.h }));
    expect(named(onPlate, PLATE_MESH_NAMES.plate).length).toBeGreaterThan(0);
    // the Hi-fi list may hold no driver the plate can't hold: then PA's DE360 on the ST260 (whose bolts the plate
    // can't take, the PA view's own fallback case) stands in, as a tweeter of the same id
    const fallback = misfit ?? { t: { ...fit.t, id: "de360" }, h: waveguide("st260") };
    const p = propsFor({ tweeter: fallback.t, selectedWaveguide: fallback.h });
    expect(plateFit(fallback.h, hifiCompressionDriver(fallback.t), p.dim.w)).toBeNull();
    const g = scene(p);
    expect(named(g, PLATE_MESH_NAMES.plate)).toHaveLength(0);
    expect(named(g, BRACKET_MESH_NAME).length).toBeGreaterThan(0);
  });

  test("a waveguide set into the baffle sits flush, with no mount", () => {
    // the full-width rectangle stands in for a set-in waveguide (none in the Hi-fi list yet)
    const rect = byIdOrThrow(HORN_OPTIONS, "athRect", "horns");
    const set: HifiWaveguide = { ...rect, hf: { covH: 90, covV: 40, minXo: null, lowHz: 1000 } };
    const base = propsFor({ tweeter: tweeter("de250") });
    const p: HifiSceneProps = {
      ...base,
      guide: { w: set.size.w, h: set.size.h, freestanding: false },
      waveguide: set,
      dim: { ...base.dim, w: set.size.w + 2 },
      lay: { ...base.lay, onTop: undefined, tweeterIn: base.dim.h - 1 - set.size.h / 2 },
    };
    const g = scene(p);
    const horn = boxOf(g, HORN_MESH_NAME);
    expect(horn.max.z).toBeCloseTo(p.dim.d / 2, 4);
    expect(horn.getCenter(new THREE.Vector3()).y).toBeCloseTo(p.lay.tweeterIn, 1);
    expect(named(g, PLATE_MESH_NAMES.plate)).toHaveLength(0);
    expect(named(g, BRACKET_MESH_NAME)).toHaveLength(0);
  });
});

describe("the cutaway", () => {
  test("drops the cones and shows the drivers' bodies inside", () => {
    const p = propsFor({});
    const solid = scene(p),
      cut = scene({ ...p, cutaway: true });
    const meshes = (g: THREE.Object3D) => {
      let n = 0;
      g.traverse((o) => o instanceof THREE.Mesh && n++);
      return n;
    };
    expect(named(solid, HIFI_MESH_NAMES.tweeterBody)).toHaveLength(0);
    expect(named(cut, HIFI_MESH_NAMES.tweeterBody)).toHaveLength(1);
    const wooferParts = (g: THREE.Object3D) => meshes(named(g, HIFI_MESH_NAMES.woofer)[0]);
    expect(wooferParts(cut)).not.toBe(wooferParts(solid));
    // the box is the same size either way
    expect(cabinetBox(cut).equals(cabinetBox(solid))).toBe(true);
  });
});
