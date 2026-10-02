import { describe, expect, test } from "vite-plus/test";
import fs from "node:fs";
import * as THREE from "three";
import { buildStackScene, type Props } from "../src/components/stack-view/buildStackScene";
import { derivePaDesign } from "../src/pages/pa-stack/hooks/paDesign";
import { DEFAULT_PA } from "../src/lib/defaults";
import { sceneCases, scenePropsOf, dumpScene } from "./scene-cases";

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
    plinthHeightIn: p.plinth,
    layout: p.layout,
    wallThicknessIn: p.wall ?? 0.75,
    baffleInsetIn: p.inset ?? 0.75,
    spacerHeightIn: p.spacerH ?? 20,
    dispersionPlane: "h",
  });
}

describe("stack scene", () => {
  test("the default PA stands on the floor and is as wide and deep as the sub box", () => {
    const p = byName("default PA");
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
    const p = byName("tower");
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
    const p = byName("tower, arched top");
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

    test("round1 has one tube with two bells", () => {
      const g = withPort("round1");
      expect(tubes(g)).toBe(1);
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
    const p = byName("default PA");
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
        const p = { ...byName("default PA"), horn, layout };
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

  test("scene-dump.json matches a fresh build (regenerate with `vp run scene-dump`)", () => {
    const saved: unknown = JSON.parse(
      fs.readFileSync(new URL("./scene-dump.json", import.meta.url), "utf8"),
    );
    const fresh = Object.fromEntries(
      sceneCases.map((c) => [c.name, dumpScene(buildStackScene(c.props))]),
    );
    // through JSON, as the file was written (it turns -0 into 0)
    expect(JSON.parse(JSON.stringify(fresh))).toEqual(saved);
  });
});
