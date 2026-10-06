import { describe, test } from "vite-plus/test";
import assert from "node:assert";
import { PLYWOOD_SHEETS, cutParts, formatInches } from "../src/lib/pa/calc";
import {
  GRAIN_PRESETS,
  KERF_OPTIONS,
  TRIM_OPTIONS,
  cutRowKey,
  cutRowTags,
  cutRows,
  layoutCutlist,
  noteLines,
} from "../src/lib/pa/cutlist";
import { hifiCutParts, settingsForMaterial } from "../src/lib/hifi/cutlist";
import { RADIATOR_PANEL, driverLayout } from "../src/lib/hifi/hifi";
import { deriveHifiDesign } from "../src/pages/hifi/hifiDesign";
import { DEFAULT_HIFI, DEFAULT_PA } from "../src/lib/defaults";
import { CUT_BOX_TAGS } from "../src/constants/cutParts";
import type {
  CornerJoint,
  CutPart,
  CutPartId,
  CutlistSettings,
  HifiDesignState,
  RadiatorPanel,
} from "../src/types";
import { close } from "./helpers";
import { panelIn } from "../src/lib/panel";
import { checkSheet } from "./guillotine";

const JOINTS: CornerJoint[] = ["butt", "rabbet", "miter"];
const PANELS: RadiatorPanel[] = ["baffle", "back", "side"];

/** The default Hi-fi walls' thickness, inches. */
const T0 = panelIn(DEFAULT_HIFI.wallPanel, DEFAULT_HIFI.panelMaterial);

/** The Hi-fi state with some fields changed, as the cutlist sees it. */
const design = (o: Partial<HifiDesignState> = {}) => deriveHifiDesign({ ...DEFAULT_HIFI, ...o });
const partsOf = (
  o: Partial<HifiDesignState> = {},
  joint: CornerJoint = "butt",
  prPanel: RadiatorPanel = RADIATOR_PANEL,
) => {
  const d = design(o);
  return hifiCutParts({
    cfg: d.speakerConfig,
    woofer: o.woofer ?? DEFAULT_HIFI.woofer,
    tweeter: d.tweeterWithWaveguide,
    joint,
    prPanel,
  });
};
const get = (P: CutPart[], id: CutPartId) => {
  const p = P.find((q) => q.part === id);
  assert.ok(p, `${id} row`);
  return p;
};
/** A pair's cutlist settings (the Hi-fi page's default), with changes. */
const settings = (o: Partial<CutlistSettings> = {}): CutlistSettings => ({
  sheet: "4x8",
  stacks: 2,
  kerf: 0.125,
  trim: 0,
  grain: GRAIN_PRESETS.wrap,
  waterfall: false,
  joint: "butt",
  offcut: "strip",
  cuts: "sheets",
  ...o,
});

/** The box designs the tests run over: each port and radiator kind, both wall thicknesses and materials. */
const DESIGNS: [string, Partial<HifiDesignState>][] = [
  ["round port", {}],
  ["sealed, 1/2″ MDF", { boxType: "sealed", wallPanel: "1/2", panelMaterial: "mdf" }],
  ["18 mm birch measured at 0.689″", { panelExactIn: { "3/4": 0.689 } }],
  ["slot", { portSpec: { shape: "slot", n: 1, h: 1.5, len: 7 } }],
  ["2 radiators", { boxType: "radiator" }],
  ["oval radiator", { boxType: "radiator", radiatorSelection: { id: "sb15sfcr", n: 1, addG: 0 } }],
  ["tall MDF box", { boxDims: { w: 12, h: 40, d: 14 }, panelMaterial: "mdf" }],
];

describe("Hi-fi panels", () => {
  for (const joint of JOINTS)
    for (const [name, o] of DESIGNS)
      test(`${joint}, ${name}: the panels add up to the box's outside size`, () => {
        const s = { ...DEFAULT_HIFI, ...o };
        const B = s.boxDims,
          t = panelIn(s.wallPanel, s.panelMaterial, s.panelExactIn);
        const { parts } = partsOf(o, joint);
        const side = get(parts, "side"),
          top = get(parts, "topBottom"),
          baffle = get(parts, "baffle"),
          back = get(parts, "back");
        // how much of each outside size the other panels supply: butt-jointed sides cover the top's ends and the
        // baffle and back cover the sides' edges; rabbets leave t/2 of each side outside the rabbet; mitres meet at
        // the outside corner, with the baffle and back in rabbets
        const topEnds = { butt: 2 * t, rabbet: t, miter: 0 }[joint];
        const faceEdges = { butt: 0, rabbet: t, miter: t }[joint];
        const sideDepth = { butt: 2 * t, rabbet: 0, miter: 0 }[joint];
        close(null, top.b + topEnds, B.w, 1e-9, "width across the top");
        close(null, baffle.a + faceEdges, B.w, 1e-9, "width across the baffle");
        close(null, side.b, B.h, 1e-9, "height up the side");
        close(null, baffle.b + faceEdges, B.h, 1e-9, "height up the baffle");
        close(null, side.a + sideDepth, B.d, 1e-9, "depth along the side");
        close(null, top.a, side.a, 1e-9, "top as deep as the side");
        assert.deepEqual([back.a, back.b], [baffle.a, baffle.b], "back matches the baffle");
        // the box's inside, which the model's volume uses: (W − 2t) × (H − 2t) × (D − 2t)
        // (the top runs into a t/2 rabbet at each end, or out to the mitred corner)
        const intoSides = { butt: 0, rabbet: t, miter: 2 * t }[joint];
        close(null, top.b - intoSides, B.w - 2 * t, 1e-9, "inside width");
        for (const p of parts) assert.equal(p.t, t, `${p.part} at the wall thickness`);
        assert.deepEqual(
          [side.qty, top.qty, baffle.qty, back.qty],
          [2, 2, 1, 1],
          "one speaker's six panels",
        );
      });

  test("the slot gets its shelf, a round port its bought tube; a sealed box neither", () => {
    const slot = partsOf({ portSpec: { shape: "slot", n: 1, h: 1.5, len: 7 } });
    const shelf = get(slot.parts, "slotShelf");
    close(null, shelf.a, DEFAULT_HIFI.boxDims.w - 2 * T0, 1e-9);
    close(null, shelf.b, 7, 1e-9);
    assert.match(get(slot.parts, "baffle").note, /slot: .*opening/);
    assert.equal(slot.also.length, 0);
    const round = partsOf();
    assert.ok(!round.parts.some((p) => p.part === "slotShelf"));
    assert.match(round.also.join(), /port tube per speaker/);
    assert.match(get(round.parts, "baffle").note, /port: .*hole for/);
    const sealed = partsOf({ boxType: "sealed" });
    assert.ok(!sealed.parts.some((p) => p.part === "slotShelf"));
    assert.equal(sealed.also.length, 0);
    assert.doesNotMatch(get(sealed.parts, "baffle").note, /port|slot/);
  });

  test("the baffle carries the driver cutouts and the roundover", () => {
    const sharp = get(partsOf().parts, "baffle").note;
    assert.match(sharp, /woofer: .*driver cutout \(typical; use the datasheet's\)/);
    assert.match(sharp, /tweeter: .*cutout/);
    assert.doesNotMatch(sharp, /roundover/);
    const round = get(partsOf({ roundoverIn: 0.75 }).parts, "baffle").note;
    assert.match(round, /3\/4″ roundover on the front edges/);
    assert.doesNotMatch(round, /deeper than/);
    const deep = get(partsOf({ roundoverIn: 1.5 }).parts, "baffle").note;
    assert.match(deep, /deeper than the 3\/4″ stock/);
  });

  for (const prPanel of PANELS)
    test(`radiator cutouts on the ${prPanel}: that panel's row carries them, with the count`, () => {
      const { parts } = partsOf({ boxType: "radiator" }, "butt", prPanel);
      for (const id of PANELS) {
        const note = get(parts, id).note;
        if (id === prPanel)
          assert.match(
            note,
            id === "side" ? /1 in each side: passive radiator/ : /2 × passive radiator/,
          );
        else assert.doesNotMatch(note, /passive radiator/, `none on the ${id}`);
      }
    });

  test("one radiator on a side goes in one side only; none without a radiator box", () => {
    const one = partsOf(
      { boxType: "radiator", radiatorSelection: { id: "sb16pfcr", n: 1, addG: 0 } },
      "butt",
      "side",
    );
    assert.match(get(one.parts, "side").note, /one side only/);
    for (const id of PANELS)
      assert.doesNotMatch(get(partsOf({}, "butt", id).parts, id).note, /passive radiator/);
  });

  test("the model's radiator panel is the back", () => {
    const { parts } = partsOf({ boxType: "radiator" });
    assert.match(get(parts, RADIATOR_PANEL).note, /passive radiator/);
    assert.equal(RADIATOR_PANEL, "back");
  });

  for (const joint of JOINTS)
    test(`${joint}: cutout heights are from the baffle's own bottom edge`, () => {
      const o = { portSpec: { shape: "slot", n: 1, h: 1.5, len: 7 } } as const;
      const d = design(o);
      const t = T0;
      const lay = driverLayout(
        DEFAULT_HIFI.woofer,
        d.tweeterWithWaveguide,
        d.speakerConfig.dim,
        !!d.speakerConfig.guide?.freestanding,
      );
      const edge = joint === "butt" ? 0 : t / 2;
      const lines = noteLines(get(partsOf(o, joint).parts, "baffle").note);
      const line = (what: string) => lines.find((l) => l.startsWith(what)) ?? "";
      assert.ok(
        line("woofer:").endsWith(
          `centre ${formatInches(lay.wooferIn - edge)}″ above the bottom edge`,
        ),
        line("woofer:"),
      );
      if (!lay.onTop)
        assert.match(
          line("tweeter:"),
          new RegExp(`centre ${formatInches(lay.tweeterIn - edge)}″ above the bottom edge`),
        );
      assert.ok(
        line("slot:").endsWith(`centred, ${formatInches(t - edge)}″ above the bottom edge`),
        line("slot:"),
      );
    });

  test("a slot too long for the box is flagged on its shelf", () => {
    const fits = get(
      partsOf({ portSpec: { shape: "slot", n: 1, h: 1.5, len: 7 } }).parts,
      "slotShelf",
    );
    assert.doesNotMatch(fits.note, /too long/);
    const long = get(
      partsOf({ portSpec: { shape: "slot", n: 1, h: 1.5, len: 40 } }).parts,
      "slotShelf",
    );
    assert.match(long.note, /too long for this box/);
  });

  test("a row's note lists each note on its own line, brackets kept whole", () => {
    const lines = noteLines(get(partsOf().parts, "baffle").note);
    assert.ok(lines.length >= 3, "the joint, the woofer and the tweeter at least");
    assert.ok(lines.some((l) => /^woofer: .*\(typical; use the datasheet's\)/.test(l)));
    assert.deepEqual(noteLines("a; b (c; d); e"), ["a", "b (c; d)", "e"]);
    assert.deepEqual(noteLines(""), []);
  });

  test("the rows are tagged H1, H2 …", () => {
    const rows = cutRows(partsOf({ portSpec: { shape: "slot", n: 1, h: 1.5, len: 7 } }).parts);
    const { tags } = cutRowTags(rows);
    assert.deepEqual(
      rows.map((p) => tags.get(cutRowKey(p))),
      rows.map((_, i) => `${CUT_BOX_TAGS.hifi}${i + 1}`),
    );
  });
});

describe("Hi-fi layouts", () => {
  for (const joint of JOINTS)
    for (const [name, o] of DESIGNS)
      test(`${joint}, ${name}: every sheet passes the guillotine check at each sheet, kerf and trim`, () => {
        const { parts } = partsOf(o, joint);
        const mat = o.panelMaterial ?? DEFAULT_HIFI.panelMaterial;
        for (const sheet of ["4x8", "5x5"] as const)
          for (const { v: kerf } of KERF_OPTIONS)
            for (const trim of TRIM_OPTIONS)
              for (const cuts of ["sheets", "rips"] as const) {
                const s = settingsForMaterial(
                  settings({ sheet, kerf, trim, joint, cuts, waterfall: joint === "miter" }),
                  mat,
                );
                const L = layoutCutlist(parts, s);
                for (const g of L.groups) {
                  assert.equal(g.tooBig.length, 0);
                  for (const sh of g.sheets) checkSheet(sh, PLYWOOD_SHEETS[sheet], kerf, trim);
                }
              }
      });

  test("MDF ignores grain: no part is locked or turned, and there is no waterfall strip", () => {
    const { parts } = partsOf({ panelMaterial: "mdf" });
    const s = settingsForMaterial(settings({ waterfall: true }), "mdf");
    assert.deepEqual(s.grain, GRAIN_PRESETS.none);
    assert.equal(s.waterfall, false);
    const L = layoutCutlist(parts, s);
    assert.ok(L.parts.every((p) => p.grain === undefined));
    assert.ok(!L.parts.some((p) => p.part === "sideTopSideStrip"));
    for (const g of L.groups)
      for (const sh of g.sheets) assert.ok(sh.items.every((it) => !it.crossed));
    // ply keeps the grain it was given
    const ply = settingsForMaterial(settings(), "ply");
    assert.deepEqual(ply.grain, GRAIN_PRESETS.wrap);
    assert.ok(layoutCutlist(parts, ply).parts.some((p) => p.grain === "b"));
  });

  test("the default pair fits on one 4 × 8 sheet", () => {
    const L = layoutCutlist(partsOf().parts, settings());
    assert.equal(
      L.groups.reduce((a, g) => a + g.sheets.length, 0),
      1,
    );
  });
});

describe("PA cutlist unchanged", () => {
  test("the starting design's rows, sizes and tags", () => {
    const rows = cutRows(
      cutParts({
        sub: DEFAULT_PA.sub,
        mid: DEFAULT_PA.mid,
        subBox: DEFAULT_PA.cDim,
        midDims: DEFAULT_PA.mDim,
        wall: DEFAULT_PA.wall,
        inset: DEFAULT_PA.inset,
        joint: "butt",
        portStyle: DEFAULT_PA.portStyle,
        cVent: DEFAULT_PA.cVent,
        layout: DEFAULT_PA.layout,
      }).parts,
    );
    const { tags } = cutRowTags(rows);
    assert.deepEqual(
      rows.map((p) => [
        tags.get(cutRowKey(p)),
        p.part,
        p.qty,
        Math.min(p.a, p.b),
        Math.max(p.a, p.b),
      ]),
      [
        ["S1", "side", 2, 18, 32],
        ["S2", "topBottom", 2, 18, 22.5],
        ["S3", "back", 1, 23.25, 31.25],
        ["S4", "baffle", 1, 22.5, 26.75],
        ["S5", "baffleCleat", 2, 0.75, 22.5],
        ["S6", "baffleCleat", 2, 0.75, 25.25],
        // one level window brace by rule (the back and baffle need it; the slot shelf already holds the sides low)
        ["S7", "windowBrace", 1, 15.75, 22.5],
        ["S8", "ductShelf", 1, 14, 22.5],
        ["S9", "ductFin", 2, 3, 14],
        ["M1", "side", 2, 15, 15],
        ["M2", "topBottom", 2, 13.5, 15],
        ["M3", "back", 1, 14.25, 14.25],
        ["M4", "baffle", 1, 13.5, 13.5],
        ["M5", "baffleCleat", 2, 0.75, 13.5],
        ["M6", "baffleCleat", 2, 0.75, 12],
      ],
    );
  });
});
