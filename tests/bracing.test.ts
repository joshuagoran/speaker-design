import { test } from "vite-plus/test";
import assert from "node:assert";
import {
  BIRCH_PLY_STIFFNESS,
  MDF_STIFFNESS,
  defaultBraceStyle,
  plateFirstModeHz,
  ribFirstModeHz,
} from "../src/lib/bracing";
import { PA_BRACING_CROSSOVER_HZ, PA_PANEL_TARGET_HZ } from "../src/lib/pa/bracing";
import { XO_LO_OPTIONS } from "../src/lib/pa/optimize";
import {
  cutParts,
  internalWoodLiters,
  midBoxBracing,
  paPanelStock,
  subBoxBracing,
} from "../src/lib/pa/calc";
import { subWoodIn3 } from "../src/lib/pa/exactSub";
import { savedBraceStyle } from "../src/constants/bracing";
import { DEFAULT_PA } from "../src/lib/defaults";
import { buildStackScene } from "../src/components/stack-view/buildStackScene";
import { SUB_OPTIONS, MID_OPTIONS } from "../src/lib/data";
import { close, vent } from "./helpers";

import { SCENE_CASE_NAMES, sceneCases } from "./scene-cases";
import type { BraceStyleId, PortStyle } from "../src/types";

const IN3_L = 16.387 / 1000;
const STYLES: BraceStyleId[] = ["window", "ribs", "both"];

test("plate: an isotropic square is the textbook (π/2)·√(D/ρh)·2/a²", (t) => {
  const s = { t: 0.75, lbPerSqFt: 3.4, ...MDF_STIFFNESS };
  const a = 20 * 0.0254,
    h = 0.75 * 0.0254;
  const D = (MDF_STIFFNESS.eStrong * h ** 3) / (12 * (1 - 0.25 ** 2));
  const rhoH = (3.4 * 0.45359237) / 0.09290304;
  close(t, plateFirstModeHz(20, 20, s), (Math.PI / 2) * Math.sqrt(D / rhoH) * (2 / a ** 2), 1e-9);
});

test("plate: thicker, smaller or stiffer reads higher; the weak modulus sets the short span", () => {
  const s = paPanelStock(0.75);
  assert.ok(plateFirstModeHz(20, 30, s) > plateFirstModeHz(20, 31, s));
  assert.ok(plateFirstModeHz(20, 30, s) > plateFirstModeHz(20, 30, paPanelStock(0.5)));
  assert.ok(plateFirstModeHz(20, 30, s) === plateFirstModeHz(30, 20, s), "orientation-free");
  const strongAcross = { ...s, eWeak: BIRCH_PLY_STIFFNESS.eStrong };
  assert.ok(plateFirstModeHz(20, 30, strongAcross) > plateFirstModeHz(20, 30, s));
  // a rib carrying less panel rings higher
  assert.ok(ribFirstModeHz(24, 4, s) > ribFirstModeHz(24, 8, s));
});

test("the PA target is twice the highest sub-to-mid crossover the optimizers try", () => {
  assert.strictEqual(PA_BRACING_CROSSOVER_HZ, Math.max(...XO_LO_OPTIONS));
  assert.strictEqual(PA_PANEL_TARGET_HZ, 2 * PA_BRACING_CROSSOVER_HZ);
});

test("default style: ribs for ⅝″ and thinner, window braces above", () => {
  assert.strictEqual(defaultBraceStyle(0.5), "ribs");
  assert.strictEqual(defaultBraceStyle(0.625), "ribs");
  assert.strictEqual(defaultBraceStyle(0.75), "window");
  assert.strictEqual(savedBraceStyle("both"), "both");
  assert.strictEqual(savedBraceStyle("rib"), undefined);
  assert.strictEqual(savedBraceStyle(undefined), undefined);
});

test("the starting sub needs bracing, and every style lifts every panel over the target", () => {
  for (const wall of [0.75, 0.5])
    for (const style of STYLES) {
      const b = subBoxBracing(
        DEFAULT_PA.cDim,
        wall,
        DEFAULT_PA.inset,
        DEFAULT_PA.portStyle,
        DEFAULT_PA.cVent,
        style,
      );
      const tag = `${wall} ${style}`;
      assert.ok(
        b.panels.some((p) => p.bareHz < PA_PANEL_TARGET_HZ),
        `${tag}: some panel starts low`,
      );
      assert.ok(b.meets, `${tag}: every panel clears ${PA_PANEL_TARGET_HZ} Hz`);
      for (const p of b.panels) assert.ok(p.hz >= PA_PANEL_TARGET_HZ, `${tag} ${p.id}`);
      if (style === "window") assert.strictEqual(b.ribs.length, 0, `${tag}: no ribs`);
    }
});

test("a box whose panels already clear the target takes nothing", () => {
  const b = midBoxBracing({ w: 15, h: 15, d: 15 }, 0.75, 0.75, "stack", undefined);
  assert.ok(b);
  assert.strictEqual(b.windowIn3 + b.ribIn3, 0);
  assert.ok(b.panels.every((p) => p.hz === p.bareHz && p.hz >= PA_PANEL_TARGET_HZ));
  assert.strictEqual(midBoxBracing({ w: 15, h: 15, d: 15 }, 0.75, 0.75, "tower", undefined), null);
});

test("the vent's parts count as supports: a slot's shelf lifts the sides, its fins the bottom", () => {
  const box = { w: 24, h: 32, d: 18 },
    cv = vent({ slotH: 3, len: 14 });
  const hz = (style: PortStyle, id: string) =>
    subBoxBracing(box, 0.75, 0.75, style, cv, "window").panels.find((p) => p.id === id)?.bareHz ??
    NaN;
  assert.ok(hz("slots", "sideL") > hz("round2", "sideL"));
  assert.ok(hz("slots", "bottom") > hz("round2", "bottom"));
  assert.ok(hz("vslots", "sideL") > hz("round2", "sideL"));
  assert.ok(hz("vslot1", "sideR") > hz("vslot1", "sideL"), "one duct, on the right");
  // a short slot (under DUCT_SUPPORT_MIN_SHARE of the depth) is left out
  const short = subBoxBracing(box, 0.75, 0.75, "slots", vent({ slotH: 3, len: 4 }), "window");
  close(
    { name: "short" },
    short.panels.find((p) => p.id === "sideL")?.bareHz ?? NaN,
    hz("round2", "sideL"),
    1e-9,
  );
});

test("the fast wood volume matches the cutlist's for every style and vent", (t) => {
  for (const wall of [0.75, 0.5])
    for (const style of STYLES)
      for (const portStyle of ["slots", "vslots", "vslot1", "round2"] as const) {
        const box = { w: 22, h: 34, d: 22 },
          cVent = vent({ slotH: 3, len: 16, nt: 2, dia: 4, throat: 2 });
        const parts = cutParts({
          sub: SUB_OPTIONS[0],
          mid: MID_OPTIONS[0],
          subBox: box,
          midDims: { w: 15, h: 15, d: 15 },
          wall,
          inset: 0.75,
          joint: "butt",
          portStyle,
          cVent,
          layout: "stack",
          braceStyle: style,
        }).parts;
        close(
          t,
          subWoodIn3(portStyle, box, wall, 0.75, cVent, style) * IN3_L,
          internalWoodLiters(parts, "sub"),
          1e-12,
        );
        const b = subBoxBracing(box, wall, 0.75, portStyle, cVent, style);
        const ribs = parts.filter((p) => p.box === "sub" && p.part === "rib");
        assert.strictEqual(
          ribs.reduce((a, p) => a + p.qty, 0),
          b.ribs.reduce((a, r) => a + r.at.length, 0),
          `${wall} ${style} ${portStyle}: a row per panel's ribs`,
        );
      }
});

test("the 3D view draws the braces and ribs inside the boxes", () => {
  const found = sceneCases.find((c) => c.name === SCENE_CASE_NAMES.defaultPa);
  assert.ok(found);
  const p = found.props;
  const meshes = (o: ReturnType<typeof buildStackScene>) => {
    let n = 0;
    o.traverse(() => n++);
    return n;
  };
  const subBracing = subBoxBracing(
    p.sub.box,
    p.wall ?? 0.75,
    p.inset ?? 0.75,
    p.portStyle,
    DEFAULT_PA.cVent,
    "ribs",
  );
  const parts =
    4 * (subBracing.windows.x.length + subBracing.windows.y.length + subBracing.windows.z.length) +
    subBracing.ribs.reduce((a, r) => a + r.at.length, 0);
  assert.ok(parts > 0);
  assert.strictEqual(
    meshes(buildStackScene({ ...p, subBracing })),
    meshes(buildStackScene(p)) + parts,
  );
});
