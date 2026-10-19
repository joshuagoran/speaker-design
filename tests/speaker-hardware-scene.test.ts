// The Speaker page's views draw the box's hardware (handles, input dish, horn posts) from the same builder the PA page's
// 3D view uses (stack-view/buildHardware): each setting adds its meshes at the faces the build plans, the front drawing
// shows the parts that stand out of the sides and the lid, and the weight and the cutlist count the parts that are drawn.
import { describe, expect, test } from "vite-plus/test";
import * as THREE from "three";
import { buildSpeakerScene } from "../src/components/stack-view/buildSpeakerScene";
import { HARDWARE_MESH_NAME, hardwareFrontMarks } from "../src/components/stack-view/buildHardware";
import { ROUNDOVER_IN } from "../src/components/stack-view/stackHeights";
import { templateSpeaker } from "../src/pages/speaker/speakerTemplates";
import { SPEAKER_TEMPLATE } from "../src/constants/speakerStarts";
import { NO_HANDLES } from "../src/constants/hardware";
import { cabinetBuild, speakerCutParts } from "../src/lib/speaker/speakerBuild";
import { chamberHardwareBox, speakerLayout } from "../src/lib/speaker/speakerLayout";
import { DEFAULT_PA } from "../src/lib/defaults";
import { HANDLES } from "../src/data/catalog/cabinet-hardware";
import { HARDWARE_MESHES } from "../src/data/meshes";
import type { BoxHandles, SpeakerCabinet, SpeakerSpec } from "../src/types";

/** The speaker's meshes named for hardware (the flange and its hole's mask, the plate or the studs), in the scene. */
function hardwareMeshes(spec: Pick<SpeakerSpec, "cabinet" | "look">, cutaway = false) {
  const scene = buildSpeakerScene({ spec, cutaway });
  scene.updateMatrixWorld(true);
  const meshes: THREE.Mesh[] = [];
  scene.traverse((o) => {
    if (o instanceof THREE.Mesh && o.name === HARDWARE_MESH_NAME) meshes.push(o);
  });
  return meshes;
}

/** A PA sub box with its handles set to `handles` and its input dish; null: no hardware at all. */
function withHardware(cabinet: SpeakerCabinet, handles: BoxHandles | null): SpeakerCabinet {
  return { ...cabinet, handles, inputDish: handles !== null };
}

const sub = templateSpeaker(SPEAKER_TEMPLATE.paSubBox);
const [HANDLE] = HANDLES;

describe("the Speaker page's 3D view draws the hardware", () => {
  test("the PA sub box's template has hardware, and each of its parts adds meshes", () => {
    expect(sub.cabinet.handles).not.toBeNull();
    expect(sub.cabinet.inputDish).toBe(true);
    const plan = cabinetBuild(sub.cabinet).chambers[0].hardware;
    expect(plan).not.toBeNull();
    const meshes = hardwareMeshes(sub);
    expect(meshes.length).toBeGreaterThanOrEqual(plan?.parts.length ?? Infinity);
  });

  test("no hardware setting, no hardware mesh", () => {
    expect(hardwareMeshes({ ...sub, cabinet: withHardware(sub.cabinet, null) })).toHaveLength(0);
  });

  test("handles on: two handles, one each side, at the height the setting gives", () => {
    const hardware: BoxHandles = { model: HANDLE.id, upIn: 2, backIn: 1 };
    const cabinet = withHardware(sub.cabinet, hardware);
    const spec = { ...sub, cabinet };
    const plan = cabinetBuild(cabinet).chambers[0].hardware;
    const handles = plan?.parts.filter((p) => p.kind === "handle") ?? [];
    expect(handles.map((p) => p.panel).sort()).toEqual(["sideL", "sideR"]);
    // the maker's model draws two meshes a handle (its flange and recess, and the hole's mask), a plain one more
    const model = HARDWARE_MESHES[HANDLE.id];
    const meshes = hardwareMeshes(spec);
    const [placed] = speakerLayout(cabinet).chambers;
    const on = chamberHardwareBox(cabinet, placed);
    for (const p of handles) {
      const side = p.panel === "sideL" ? -1 : 1;
      // the part's face: past the frame's roundover on its side, at its height and depth along the box
      const face = new THREE.Vector3(
        on.cx + side * (on.box.w / 2 + ROUNDOVER_IN),
        on.y0 + p.v,
        on.box.d / 2 - p.u,
      );
      const near = meshes.filter((m) => {
        const box = new THREE.Box3().setFromObject(m).expandByScalar(0.6);
        return box.containsPoint(face);
      });
      expect(near.length, `a ${p.panel} handle at ${p.v.toFixed(2)} up`).toBeGreaterThanOrEqual(
        model ? 1 : 2,
      );
    }
    // moving the handles up moves their meshes up
    const higher = withHardware(sub.cabinet, { ...hardware, upIn: 6 });
    const top = (specOf: typeof spec) =>
      Math.max(...hardwareMeshes(specOf).map((m) => new THREE.Box3().setFromObject(m).max.y));
    expect(top({ ...sub, cabinet: higher })).toBeGreaterThan(top(spec) + 1);
  });

  test("handles none: the dish and the posts stay, the handles go", () => {
    const withBoth = hardwareMeshes({
      ...sub,
      cabinet: withHardware(sub.cabinet, { model: HANDLE.id, upIn: 0, backIn: 0 }),
    });
    const noHandles = hardwareMeshes({
      ...sub,
      cabinet: withHardware(sub.cabinet, { model: NO_HANDLES, upIn: 0, backIn: 0 }),
    });
    const plan = cabinetBuild(withHardware(sub.cabinet, { model: NO_HANDLES, upIn: 0, backIn: 0 }))
      .chambers[0].hardware;
    expect(plan?.parts.some((p) => p.kind === "handle")).toBe(false);
    expect(plan?.parts.some((p) => p.kind === "plate")).toBe(true);
    expect(noHandles.length).toBeGreaterThan(0);
    expect(noHandles.length).toBeLessThan(withBoth.length);
  });

  test("a box with a horn on its lid draws the horn's posts there", () => {
    const top = templateSpeaker(SPEAKER_TEMPLATE.paMidHighBox);
    const plan = cabinetBuild(top.cabinet).chambers[0].hardware;
    const posts = plan?.parts.filter((p) => p.panel === "top") ?? [];
    expect(posts.length).toBeGreaterThan(0);
    const meshes = hardwareMeshes(top);
    const height = speakerLayout(top.cabinet).size.h;
    expect(
      meshes.some((m) => new THREE.Box3().setFromObject(m).max.y >= height - 1e-6),
      "a mesh on the lid",
    ).toBe(true);
  });

  test("the cutaway shows each recess inside the box as well", () => {
    const plain = hardwareMeshes(sub, false);
    const cut = hardwareMeshes(sub, true);
    expect(cut.length).toBeGreaterThanOrEqual(plain.length);
  });

  test("the weight and the cutlist count the parts the views draw", () => {
    const build = cabinetBuild(sub.cabinet);
    const plan = build.chambers[0].hardware;
    expect(plan).not.toBeNull();
    // one weight, from the parts drawn: the plan's, in the chamber's total
    expect(build.chambers[0].lb.hardware).toBe(plan?.lb);
    expect(build.chambers[0].lb.total).toBeCloseTo(
      build.chambers[0].lb.wood + build.chambers[0].lb.drivers + (plan?.lb ?? 0),
      9,
    );
    // the cutlist's hardware line lists the parts bought, the same as the plan's
    const cut = speakerCutParts(sub.cabinet, "butt");
    const line = cut.also.find((l) => /hardware/i.test(l));
    expect(line).toBeTruthy();
    for (const { part } of plan?.bought ?? []) expect(line).toContain(part.name);
    // no hardware: none in the weight, none in the cutlist
    const bare = withHardware(sub.cabinet, null);
    expect(cabinetBuild(bare).chambers[0].lb.hardware).toBe(0);
    expect(speakerCutParts(bare, "butt").also.some((l) => /hardware/i.test(l))).toBe(false);
  });

  test("the PA hardware's default handle is the one the template draws", () => {
    expect(sub.cabinet.handles).toEqual(DEFAULT_PA.hardware.sub);
  });
});

describe("the Speaker page's front drawing shows the hardware", () => {
  test("a handle on each side, standing out of it at its height", () => {
    const cabinet = withHardware(sub.cabinet, { model: HANDLE.id, upIn: 3, backIn: 0 });
    const plan = cabinetBuild(cabinet).chambers[0].hardware;
    expect(plan).not.toBeNull();
    if (!plan) return;
    const [placed] = speakerLayout(cabinet).chambers;
    const on = chamberHardwareBox(cabinet, placed);
    const marks = hardwareFrontMarks(plan, on.box, on.y0, on.cx);
    const handles = marks.filter((m) => m.kind === "handle");
    expect(handles).toHaveLength(2);
    const [left, right] = [...handles].sort((a, b) => a.x - b.x);
    // outside the box's sides, and as high as the plan puts them
    expect(left.x + left.w / 2).toBeLessThan(on.cx - on.box.w / 2);
    expect(right.x - right.w / 2).toBeGreaterThan(on.cx + on.box.w / 2);
    const rows = plan.parts.filter((p) => p.kind === "handle").map((p) => on.y0 + p.v);
    for (const m of handles) expect(rows.some((y) => Math.abs(y - m.y) < 1e-9)).toBe(true);
    // the dish faces the back: not in the front view
    expect(marks.every((m) => m.kind !== "plate")).toBe(true);
    // no hardware, no marks
    expect(cabinetBuild(withHardware(cabinet, null)).chambers[0].hardware).toBeNull();
  });
});
