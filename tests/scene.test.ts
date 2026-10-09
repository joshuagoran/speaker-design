import { describe, expect, test } from "vite-plus/test";
import * as THREE from "three";
import { buildStackScene, type Props } from "../src/components/stack-view/buildStackScene";
import { derivePaDesign } from "../src/pages/pa-stack/hooks/paDesign";
import { DEFAULT_PA } from "../src/lib/defaults";
import { SCENE_CASE_NAMES, sceneCases, scenePropsOf } from "./scene-cases";
import { VENT_MESH_NAME } from "../src/components/stack-view/buildBraces";
import { modelTubeElbows, subTubeLegs, subTubeSpan } from "../src/lib/pa/tubes";
import { HORN_MESHES } from "../src/data/meshes";
import { HORN_OPTIONS } from "../src/lib/data";
import { HORN_MESH_NAME } from "../src/components/stack-view/buildHorn";
import { MM_IN } from "../src/components/stack-view/geometry";
import type { PartMesh } from "../src/types";

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
    backJoint: DEFAULT_PA.backJoint,
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
      // the default 8″ tube, 11″ long, in a 19″ deep box: 17.5″ from the baffle front to the back wall holds 9.5″
      // straight, so it takes an elbow: a run back, a quarter-torus and a riser (behind the driver, and with its
      // flare clear of the back wall; an 18″ deep box has no room for that riser)
      const g = buildStackScene({
        ...base,
        sub: { ...base.sub, box: { ...base.sub.box, d: 19 } },
        portStyle: "round1",
        portGeom: undefined,
      });
      expect(tubes(g)).toBe(2);
      expect(portMeshes(g, "TorusGeometry")).toBe(1);
      expect(bells(g)).toBe(2);
    });

    test("round4 has four tubes with eight bells", () => {
      const g = withPort("round4");
      expect(tubes(g)).toBe(4);
      expect(bells(g)).toBe(8);
    });

    test("the tubes and their flares stay inside the length the model takes, at every baffle inset", () => {
      // round1 and round2, straight and with one elbow in the default box, and round2 with two in a deeper one, each at
      // its longest (the straight mouth a diameter from the back wall, the riser that ends in the mouth a flare's
      // reach off the back wall, the return leg a flare's reach under the lid): the outer flare's lip is flush with the baffle front, the inner mouth keeps
      // the model's gap to the back wall or the lid, and nothing goes into a panel
      const wall = 0.75,
        drv = DEFAULT_PA.sub;
      const cases = [
        ["round1", 1, 6, 0],
        ["round1", 1, 6, 1],
        ["round2", 2, 4.25, 0],
        ["round2", 2, 4.25, 1],
        ["round2", 2, 4.25, 2],
      ] as const;
      for (const inset of [0, 0.75, 1.5])
        for (const [style, nt, dia, e] of cases) {
          const at = `${style} ${e} elbow inset ${inset}`;
          const box = e === 2 ? { ...DEFAULT_PA.cDim, d: 24 } : DEFAULT_PA.cDim;
          const front = box.d / 2,
            backFace = -box.d / 2 + wall,
            lidFace = base.plinth + box.h - wall;
          const span = subTubeSpan(box, style, { nt, dia }, wall, inset, drv, e);
          if (!span) throw new Error(`${at}: no span`);
          const v = { nt, dia, len: span[1] };
          expect(modelTubeElbows(box, style, v, wall, inset, drv), at).toBe(e);
          const legs = subTubeLegs(box, style, v, wall, inset, drv, e);
          const g = buildStackScene({
            ...base,
            sub: { ...base.sub, box },
            wall,
            inset,
            portStyle: style,
            portGeom: { nPorts: nt, portR: dia / 2, tubeLen: v.len },
          });
          const b = new THREE.Box3();
          g.traverse((o) => o.name === VENT_MESH_NAME && b.expandByObject(o));
          expect(b.max.z, at).toBeCloseTo(front - inset, 9);
          expect(b.min.z, at).toBeGreaterThanOrEqual(backFace - 1e-9);
          expect(b.max.y, at).toBeLessThanOrEqual(lidFace + 1e-9);
          // straight: the inner flare's lip the model's gap from the back wall
          if (e === 0) expect(b.min.z, at).toBeCloseTo(backFace + legs.gap, 9);
          // one elbow: the riser's flare just clears the back wall, its lip the model's gap under the lid
          if (e === 1) expect(b.min.z, at).toBeCloseTo(backFace, 9);
          if (e === 1) expect(b.max.y, at).toBeCloseTo(lidFace - legs.gap, 9);
          // two: the riser (no mouth) against the back wall, the return leg's flare just clearing the lid
          if (e === 2) expect(b.min.z, at).toBeCloseTo(backFace, 9);
          if (e === 2) expect(b.max.y, at).toBeCloseTo(lidFace, 9);
        }
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

  test("every horn's center is where the planner says, in each layout", () => {
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

  test("a meshed horn's axis is where the planner says, even when its mesh is lopsided", () => {
    const UP = 40; // grid steps the mouth reaches further up than down
    for (const [id, mesh] of Object.entries(HORN_MESHES)) {
      const horn = HORN_OPTIONS.find((h) => h.id === id);
      if (!mesh || !horn) throw new Error(`no horn for the mesh ${id}`);
      const lopsided: PartMesh = {
        ...mesh,
        max: [mesh.max[0], mesh.max[1] + UP * mesh.unitMm, mesh.max[2]],
        positions: mesh.positions.map((v, i) => (i % 3 === 1 && v > 0 ? v + UP : v)),
      };
      const tall = { ...horn, size: { ...horn.size, h: horn.size.h + UP * mesh.unitMm * MM_IN } };
      HORN_MESHES[id] = lopsided;
      try {
        for (const layout of ["stack", "pole", "satellite", "tower"] as const) {
          const at = `${id} ${layout}`;
          const p = { ...byName(SCENE_CASE_NAMES.defaultPa), horn: tall, layout };
          const g = buildStackScene(p);
          const derived = derivedHeights(p);
          const [body] = g.children.filter(
            (o): o is THREE.Mesh => o instanceof THREE.Mesh && o.name === HORN_MESH_NAME,
          );
          if (!body) throw new Error(`${at}: no horn`);
          // the mesh's origin, the driver's axis, at the planner's horn center
          expect(body.position.y, at).toBeCloseTo(derived.hornCenterHeightIn, 6);
          if (layout === "tower") continue;
          // and the horn's bottom on the lift above the mid box, its top the stack's top
          const box = new THREE.Box3().setFromObject(body);
          expect(box.max.y, at).toBeCloseTo(derived.stackHeightIn, 2);
          expect(box.max.y - box.min.y, at).toBeCloseTo(tall.size.h, 2);
        }
      } finally {
        HORN_MESHES[id] = mesh;
      }
    }
  });

  test("the stack is as tall as the planner says, for each horn shape and layout", () => {
    const base = byName(SCENE_CASE_NAMES.defaultPa);
    const horns = [...new Set(sceneCases.map((c) => c.props.horn))].flatMap((horn) => [
      horn,
      { ...horn, profile: undefined, rect: undefined }, // no profile: a rectangular flare at its own mouth
      { ...horn, profile: undefined, rect: true }, // the full-width rectangular concept
    ]);
    for (const layout of ["stack", "pole", "satellite", "tower"] as const) {
      for (const horn of horns) {
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
