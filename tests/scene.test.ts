import { describe, expect, test } from "vite-plus/test";
import * as THREE from "three";
import { buildStackScene, type Props } from "../src/components/stack-view/buildStackScene";
import { derivePaDesign } from "../src/pages/pa-stack/hooks/paDesign";
import { DEFAULT_PA } from "../src/lib/defaults";
import { SCENE_CASE_NAMES, sceneCases, scenePropsOf } from "./scene-cases";

const byName = (name: string) => {
  const c = sceneCases.find((x) => x.name === name);
  if (!c) throw new Error(`no scene case ${name}`);
  return c.props;
};

/** The scene's box without the scale figure that stands beside it. */
function stackBox(group: THREE.Group) {
  const box = new THREE.Box3();
  group.children.filter((o) => o.name !== "scale-figure").forEach((o) => box.expandByObject(o));
  return box;
}

const meshesOf = (group: THREE.Group) => {
  const out: THREE.Mesh[] = [];
  group.traverse((o) => o instanceof THREE.Mesh && out.push(o));
  return out;
};

/** Port tubes and their flares are the meshes in the port material (the horn throat is a cylinder too). */
const PORT_COLOR = "8a7458";
const portMeshes = (group: THREE.Group, type: string) =>
  meshesOf(group).filter(
    (m) =>
      m.geometry.type === type &&
      !Array.isArray(m.material) &&
      "color" in m.material &&
      m.material.color instanceof THREE.Color &&
      m.material.color.getHexString() === PORT_COLOR,
  ).length;

const count = (group: THREE.Group, type: string) =>
  meshesOf(group).filter((m) => m.geometry.type === type).length;

/** What the planner derives for the same props: the heights the scene has to agree with. */
function derivedHeights(p: Props) {
  return derivePaDesign({
    subDriver: p.sub,
    portStyle: p.portStyle,
    subBoxDims: p.sub.box,
    subVentSpec: DEFAULT_PA.cVent,
    subHighpassHz: DEFAULT_PA.hpf,
    subHighpassType: DEFAULT_PA.hpType,
    subAmpWatts: DEFAULT_PA.ampW,
    maxPortAirSpeedMs: DEFAULT_PA.portMax,
    midDriver: p.mid,
    midBoxDims: p.mid.box,
    midAmpWatts: DEFAULT_PA.mAmpW,
    hornOption: p.horn,
    compressionDriver: DEFAULT_PA.cd,
    hornAmpWatts: DEFAULT_PA.hfAmpW,
    subMidCrossoverHz: DEFAULT_PA.xoLo,
    midHornCrossoverHz: DEFAULT_PA.xoHi,
    subMidCrossoverOrder: DEFAULT_PA.xoLoOrder,
    midHornCrossoverOrder: DEFAULT_PA.xoHiOrder,
    plinthHeightIn: p.plinth,
    layout: p.layout,
    wallThicknessIn: p.wall ?? 0.75,
    braceStyle: undefined,
    baffleInsetIn: p.inset ?? 0.75,
    spacerHeightIn: p.spacerH ?? 20,
    hardware: DEFAULT_PA.hardware,
    dispersionPlane: "h",
  });
}

describe("stack scene", () => {
  test("the default PA stands on the floor and is as wide and deep as the sub box", () => {
    const p = byName(SCENE_CASE_NAMES.defaultPa);
    const box = stackBox(buildStackScene(p));
    const { w, d } = p.sub.box;
    expect(box.min.y).toBeCloseTo(0, 6);
    // the frame's roundovers add a quarter inch each side
    expect(box.max.x - box.min.x).toBeGreaterThanOrEqual(w);
    expect(box.max.x - box.min.x).toBeLessThan(w + 1);
    expect(box.max.z - box.min.z).toBeGreaterThanOrEqual(d);
    expect(box.max.z - box.min.z).toBeLessThan(d + 1);
  });

  test("the tower is one shell as wide and deep as the sub box, as tall as the planner says", () => {
    const p = byName(SCENE_CASE_NAMES.tower);
    const box = stackBox(buildStackScene(p));
    const { w, d } = p.sub.box;
    expect(box.max.x - box.min.x).toBeGreaterThanOrEqual(w);
    expect(box.max.x - box.min.x).toBeLessThan(w + 1);
    expect(box.max.z - box.min.z).toBeGreaterThanOrEqual(d);
    expect(box.max.z - box.min.z).toBeLessThan(d + 1);
    expect(box.max.y).toBeGreaterThanOrEqual(derivedHeights(p).stackHeightIn);
    expect(box.max.y).toBeLessThan(derivedHeights(p).stackHeightIn + 1);
  });

  test("the tower's arched top is as tall as the planner says", () => {
    const p = byName(SCENE_CASE_NAMES.archedTower);
    const derived = derivedHeights(p);
    expect(derived.hasArchedTop).toBe(true);
    const box = stackBox(buildStackScene(p));
    expect(box.max.y).toBeGreaterThanOrEqual(derived.stackHeightIn);
    expect(box.max.y).toBeLessThan(derived.stackHeightIn + 1);
  });

  describe("vent ducts and tubes", () => {
    const base = scenePropsOf({
      sub: DEFAULT_PA.sub.id,
      mid: DEFAULT_PA.mid.id,
      horn: DEFAULT_PA.horn.id,
      portStyle: "slots",
      cDim: DEFAULT_PA.cDim,
      cVent: DEFAULT_PA.cVent,
    });
    // no explicit vent geometry, so each style builds its own default tubes
    const withPort = (portStyle: Props["portStyle"]) =>
      buildStackScene({ ...base, portStyle, portGeom: undefined });
    // a tube is a straight cylinder with two flared bells (lathes)
    const tubes = (g: THREE.Group) => portMeshes(g, "CylinderGeometry");
    const bells = (g: THREE.Group) => portMeshes(g, "LatheGeometry");

    test("slots build a shelf and two fins (three duct openings) and no tubes", () => {
      const g = withPort("slots");
      expect(tubes(g)).toBe(0);
      expect(bells(g)).toBe(0);
      const ductH = DEFAULT_PA.cVent.slotH;
      const fins = meshesOf(g).filter(
        (m) =>
          m.geometry instanceof THREE.BoxGeometry &&
          m.geometry.parameters.width === 0.75 &&
          m.geometry.parameters.height === ductH,
      );
      expect(fins).toHaveLength(2);
    });

    test("round1 has one tube with two bells, turned up the back wall when it's too long to run straight", () => {
      // the default 8″ tube, 11″ long, in an 18″ deep box: 16.5″ from the baffle front to the back wall holds 8.5″
      // straight, so it takes an elbow: a run back, a quarter-torus and a riser
      const g = withPort("round1");
      expect(tubes(g)).toBe(2);
      expect(portMeshes(g, "TorusGeometry")).toBe(1);
      expect(bells(g)).toBe(2);
    });

    test("round4 has four tubes with eight bells", () => {
      const g = withPort("round4");
      expect(tubes(g)).toBe(4);
      expect(bells(g)).toBe(8);
    });

    test("the cutaway drops the cones", () => {
      const solid = buildStackScene({ ...base, cutaway: false });
      const ghost = buildStackScene({ ...base, cutaway: true });
      expect(count(solid, "ConeGeometry")).toBe(2); // sub and mid
      expect(count(ghost, "ConeGeometry")).toBe(0);
    });
  });

  test("the mid box and horn sit at the heights the planner derives", () => {
    const p = byName(SCENE_CASE_NAMES.defaultPa);
    const g = buildStackScene(p);
    const derived = derivedHeights(p);
    const { w, h } = p.mid.box;
    // the mid's baffle is the extrusion 3/4 in deep and as wide as the box less two walls
    const midBaffle = meshesOf(g).find(
      (m) =>
        m.geometry.type === "ExtrudeGeometry" &&
        Math.abs(new THREE.Box3().setFromObject(m).getSize(new THREE.Vector3()).x - (w - 1.5)) <
          1e-6 &&
        new THREE.Box3().setFromObject(m).getSize(new THREE.Vector3()).z === 0.75,
    );
    expect(midBaffle).toBeDefined();
    expect(derived.stackBaseHeightIn).toBeCloseTo(p.plinth + p.sub.box.h + 0.4, 6);
    expect(midBaffle?.position.y).toBeCloseTo(derived.midCenterHeightIn, 6);
    expect(h).toBe(derived.effectiveMidBoxDims.h);
    // the horn is the highest mesh and starts on top of the mid box
    const horn = meshesOf(g)
      .filter((m) => m.parent?.name !== "scale-figure" && m.parent === g)
      .reduce((a, b) => (b.position.y > a.position.y ? b : a));
    expect(new THREE.Box3().setFromObject(horn).min.y).toBeGreaterThanOrEqual(
      derived.stackBaseHeightIn + h - 1e-6,
    );
    expect(derived.subTopHeightIn).toBeCloseTo(p.plinth + p.sub.box.h, 6);
  });

  test("every horn's centre is where the planner says, in each layout", () => {
    const horns = [...new Set(sceneCases.map((c) => c.props.horn))];
    for (const layout of ["stack", "pole", "satellite", "tower"] as const) {
      for (const horn of horns) {
        const p = { ...byName(SCENE_CASE_NAMES.defaultPa), horn, layout };
        const g = buildStackScene(p);
        const derived = derivedHeights(p);
        // the horn is the highest mesh directly in the group
        const hornMesh = g.children
          .filter((o): o is THREE.Mesh => o instanceof THREE.Mesh)
          .reduce((a, b) => (b.position.y > a.position.y ? b : a));
        expect(hornMesh.position.y, `${horn.id} ${layout}`).toBeCloseTo(
          derived.hornCenterHeightIn,
          6,
        );
      }
    }
  });

  test("the stack is as tall as the planner says, for each horn shape and layout", () => {
    const base = byName(SCENE_CASE_NAMES.defaultPa);
    const horns = [...new Set(sceneCases.map((c) => c.props.horn))].flatMap((horn) => [
      horn,
      { ...horn, profile: undefined, rect: undefined }, // the plain flared block
      { ...horn, profile: undefined, rect: true }, // a rectangular horn
    ]);
    for (const layout of ["stack", "pole", "satellite", "tower"] as const) {
      for (const horn of horns) {
        // a plain block in the tower pokes out of the shell by its bevel; no horn in the data is one
        if (layout === "tower" && !horn.profile && !horn.rect) continue;
        const p = { ...base, horn, layout };
        const top = stackBox(buildStackScene(p)).max.y;
        const planned = derivedHeights(p).stackHeightIn;
        // the lathe profile overshoots its nominal height by a few hundredths of an inch
        expect(top, `${horn.id} ${layout}`).toBeGreaterThanOrEqual(planned - 1e-6);
        expect(top, `${horn.id} ${layout}`).toBeLessThan(planned + 0.1);
      }
    }
  });

  test("the planner follows the wall thickness: tower height and arch threshold", () => {
    const base = byName(SCENE_CASE_NAMES.archedTower);
    // the two plywood choices the planner offers
    for (const wall of [0.5, 0.75]) {
      const p = { ...base, wall };
      const derived = derivedHeights(p);
      const box = stackBox(buildStackScene(p));
      expect(box.max.y, `wall ${wall}`).toBeGreaterThanOrEqual(derived.stackHeightIn - 1e-6);
      expect(box.max.y, `wall ${wall}`).toBeLessThan(derived.stackHeightIn + 0.1);
    }
    // a box just wide enough for the arch with 1/2 in walls but not with 3/4 in: the wall decides, in the planner and the scene
    const w = base.horn.size.w + 1.2;
    const narrow = { ...base, sub: { ...base.sub, box: { ...base.sub.box, w } } };
    for (const [wall, arched] of [
      [0.5, true],
      [0.75, false],
    ] as const) {
      const p = { ...narrow, wall };
      expect(derivedHeights(p).hasArchedTop, `wall ${wall}`).toBe(arched);
      const top = stackBox(buildStackScene(p)).max.y;
      expect(top, `wall ${wall}`).toBeGreaterThanOrEqual(derivedHeights(p).stackHeightIn - 1e-6);
      expect(top, `wall ${wall}`).toBeLessThan(derivedHeights(p).stackHeightIn + 0.1);
    }
  });
});
