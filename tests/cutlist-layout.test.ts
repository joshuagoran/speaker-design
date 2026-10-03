import { describe, test } from "vite-plus/test";
import assert from "node:assert";
import { PLYWOOD_SHEETS, cutParts } from "../src/lib/pa/calc";
import {
  FROM_OFFCUT,
  cutStats,
  GRAIN_PRESETS,
  SEARCH_RUNS,
  layoutCutlist,
  offcutOf,
  packSheets,
  savedCutlist,
  waterfallStrips,
} from "../src/lib/pa/cutlist";
import { DEFAULT_PA } from "../src/lib/defaults";
import type { CutPart, CutlistSettings, PackedSheet, PlacedPart, PortStyle } from "../src/types";
import { close } from "./helpers";

const EPS = 1e-6;
/** One stack of the starting design's parts. */
const parts = (
  joint: CutlistSettings["joint"] = "butt",
  portStyle: PortStyle = DEFAULT_PA.portStyle,
) =>
  cutParts({
    sub: DEFAULT_PA.sub,
    mid: DEFAULT_PA.mid,
    subBox: DEFAULT_PA.cDim,
    midDims: DEFAULT_PA.mDim,
    wall: DEFAULT_PA.wall,
    inset: DEFAULT_PA.inset,
    joint,
    portStyle,
    cVent: DEFAULT_PA.cVent,
    layout: DEFAULT_PA.layout,
  }).parts;
const settings = (o: Partial<CutlistSettings> = {}): CutlistSettings => ({
  sheet: "4x8",
  stacks: 2,
  kerf: DEFAULT_PA.kerf,
  trim: 0,
  grain: GRAIN_PRESETS.wrap,
  waterfall: false,
  joint: "butt",
  offcut: "strip",
  cuts: "sheets",
  ...o,
});

/** True when the parts can be separated by straight cuts running edge to edge of each piece, recursively. */
function guillotine(items: PlacedPart<CutPart>[], kerf: number): boolean {
  if (items.length <= 1) return true;
  for (const axis of ["x", "y"] as const) {
    const size = axis === "x" ? "w" : "h";
    // a cut just after a part's far edge, if no other part straddles it
    for (const it of items) {
      const at = it[axis] + it[size];
      const before = items.filter((o) => o[axis] + o[size] <= at + EPS),
        after = items.filter((o) => o[axis] >= at + kerf - EPS);
      if (before.length && after.length && before.length + after.length === items.length)
        return guillotine(before, kerf) && guillotine(after, kerf);
    }
  }
  return false;
}
const checkSheet = (sh: PackedSheet, S: { w: number; h: number }, kerf: number, trim: number) => {
  for (const it of sh.items) {
    assert.ok(it.x >= trim - EPS && it.y >= trim - EPS, "inside the trim");
    assert.ok(
      it.x + it.w <= S.w - trim + EPS && it.y + it.h <= S.h - trim + EPS,
      "inside the trim",
    );
  }
  for (let i = 0; i < sh.items.length; i++)
    for (let j = i + 1; j < sh.items.length; j++) {
      const A = sh.items[i],
        B = sh.items[j];
      assert.ok(
        A.x + A.w + kerf <= B.x + EPS ||
          B.x + B.w + kerf <= A.x + EPS ||
          A.y + A.h + kerf <= B.y + EPS ||
          B.y + B.h + kerf <= A.y + EPS,
        "kerf between parts",
      );
    }
  assert.ok(guillotine(sh.items, kerf), "cuttable with through-cuts");
};

describe("layoutCutlist", () => {
  for (const sheet of ["4x8", "5x5"] as const)
    for (const kerf of [3 / 32, 0.125, 0.25])
      for (const trim of [0, 0.25])
        test(`${sheet}, ${kerf}″ kerf, ${trim}″ trim: every sheet is guillotine-cuttable, kerfed and inside the trim`, () => {
          const s = settings({ sheet, kerf, trim, stacks: 4 });
          const L = layoutCutlist(parts(), s);
          for (const g of L.groups) {
            assert.equal(g.tooBig.length, 0);
            for (const sh of g.sheets) checkSheet(sh, PLYWOOD_SHEETS[sheet], kerf, trim);
          }
        });

  test("grain-locked parts lie along the sheet's length; Any parts turn freely", () => {
    const L = layoutCutlist(parts(), settings({ stacks: 4 }));
    for (const g of L.groups)
      for (const it of g.sheets.flatMap((s) => s.items)) {
        if (!it.grain) continue;
        const along = it.grain === "b" ? it.b : it.a;
        assert.ok(!it.crossed, `${it.part} fits along the grain`);
        close(null, it.h, along, EPS, `${it.part} along the grain`);
      }
    const locked = L.parts.filter((p) => p.grain).map((p) => p.part);
    assert.deepEqual(new Set(locked), new Set(["Side", "Top / bottom", "Back", "Baffle"]));
  });

  test("a locked part that only fits across the grain is placed across and flagged", () => {
    // locked with 40 along the length, its 60 would have to fit the 48″ width: only the other way round fits
    const r = { a: 40, b: 60, grain: "a" as const };
    const p = packSheets([r], PLYWOOD_SHEETS["4x8"], 0.125);
    const it = p.sheets[0].items[0];
    assert.ok(it.crossed);
    close(null, it.h, 60, EPS);
  });

  test("cleats and dividers come from offcuts, not the sheet count", () => {
    const L = layoutCutlist(parts("butt", "vslots"), settings());
    assert.ok(L.fromOffcut.some((p) => p.part === "Baffle cleat"));
    assert.ok(L.fromOffcut.some((p) => p.part === "Duct divider"));
    for (const g of L.groups)
      for (const it of g.sheets.flatMap((s) => s.items)) assert.ok(!FROM_OFFCUT.has(it.part));
    // the 1/2″ dividers were the only 1/2″ parts: no 1/2″ sheet any more
    assert.deepEqual(
      L.groups.map((g) => g.t),
      [0.75],
    );
  });

  test("the same input gives the same layout", () => {
    const a = layoutCutlist(parts(), settings({ stacks: 4 }), { runs: SEARCH_RUNS }),
      b = layoutCutlist(parts(), settings({ stacks: 4 }), { runs: SEARCH_RUNS });
    assert.deepEqual(a, b);
  });

  test("the longer search never needs more sheets than the quick one", () => {
    for (const stacks of [1, 2, 4]) {
      const n = (runs?: number) =>
        layoutCutlist(parts(), settings({ stacks }), { runs, countsOnly: true }).groups.reduce(
          (a, g) => a + g.sheets.length,
          0,
        );
      assert.ok(n(SEARCH_RUNS) <= n());
    }
  });
});

describe("offcut", () => {
  for (const shape of ["strip", "panel"] as const)
    test(`${shape}: never costs a sheet, and the offcut is clear of parts`, () => {
      let seen = 0;
      for (const stacks of [1, 2, 4]) {
        const s = settings({ stacks, offcut: shape });
        const plain = layoutCutlist(parts(), s, { countsOnly: true }),
          kept = layoutCutlist(parts(), s);
        const S = PLYWOOD_SHEETS[s.sheet];
        for (const [i, g] of kept.groups.entries()) {
          assert.equal(g.sheets.length, plain.groups[i].sheets.length);
          const o = g.offcut;
          if (!o) continue; // the last sheet is too full to leave one worth keeping
          seen++;
          assert.equal(o.sheet, g.sheets.length - 1, "on the last sheet");
          if (shape === "strip") close(null, o.h, S.h, EPS, "full length");
          else close(null, o.w, S.w, EPS, "full width");
          for (const it of g.sheets[o.sheet].items)
            assert.ok(
              it.x + it.w + s.kerf <= o.x + EPS ||
                o.x + o.w + s.kerf <= it.x + EPS ||
                it.y + it.h + s.kerf <= o.y + EPS ||
                o.y + o.h + s.kerf <= it.y + EPS,
              "a kerf from every part",
            );
          // at least as good as the sheet the packer gave
          const before = offcutOf(
            plain.groups[i].sheets.reduce((a, b) =>
              b.items.reduce((x, it) => x + it.w * it.h, 0) <
              a.items.reduce((x, it) => x + it.w * it.h, 0)
                ? b
                : a,
            ),
            0,
            S,
            s.kerf,
            s.trim,
            shape,
          );
          if (before)
            assert.ok(
              (shape === "strip" ? o.w : o.h) >= (shape === "strip" ? before.w : before.h) - EPS,
            );
        }
      }
      assert.ok(seen > 0, "some layout keeps an offcut");
    });

  test("offcutOf: the widest gap, a kerf off each part it borders", () => {
    const sheet = {
      items: [{ a: 10, b: 96, x: 0, y: 0, w: 10, h: 96 }],
    };
    const o = offcutOf(sheet, 0, { w: 48, h: 96 }, 0.125, 0, "strip");
    assert.ok(o);
    close(null, o.x, 10.125, EPS);
    close(null, o.w, 48 - 10.125, EPS);
  });
});

describe("waterfall", () => {
  test("butt: one side-top-side strip per box replaces the sides and top", () => {
    const P = parts("butt");
    const { parts: out, notes } = waterfallStrips(
      P,
      { kerf: 0.125, joint: "butt" },
      { w: 48, h: 96 },
    );
    assert.deepEqual(notes, []);
    for (const box of ["Sub", "Mid"]) {
      const side = P.find((p) => p.box === box && p.part === "Side"),
        top = P.find((p) => p.box === box && p.part === "Top / bottom"),
        strip = out.find((p) => p.box === box && p.part === "Side-top-side strip"),
        bottom = out.find((p) => p.box === box && p.part === "Bottom");
      assert.ok(side && top && strip && bottom);
      assert.ok(
        !out.some((p) => p.box === box && (p.part === "Side" || p.part === "Top / bottom")),
      );
      close(null, strip.b, 2 * side.b + top.b + 2 * 0.125, EPS);
      assert.deepEqual(strip.pieces, [side.b, top.b, side.b]);
      assert.equal(strip.grain, "b");
      assert.equal(bottom.qty, 1);
    }
  });

  test("a strip longer than the sheet falls back to separate panels, with a note", () => {
    const { parts: out, notes } = waterfallStrips(
      parts("miter"),
      { kerf: 0.125, joint: "miter" },
      {
        w: 60,
        h: 60,
      },
    );
    assert.ok(notes.some((n) => n.startsWith("Sub:")));
    assert.ok(out.some((p) => p.box === "Sub" && p.part === "Side"));
  });

  test("the laid-out strip is grain-locked along the sheet and drawn with its pieces", () => {
    const L = layoutCutlist(parts("miter"), settings({ waterfall: true, joint: "miter" }));
    const strips = L.groups
      .flatMap((g) => g.sheets.flatMap((s) => s.items))
      .filter((it) => it.pieces);
    assert.equal(strips.length, 2 * 2, "sub and mid, two stacks");
    for (const it of strips) close(null, it.h, it.b, EPS);
  });
});

describe("cut style", () => {
  test("cutStats: rips run the full length, crosscuts the full width", () => {
    const S = { w: 48, h: 96 },
      k = 0.125;
    // two full-length strips, the second crosscut in two
    const strips = [
      { x: 0, y: 0, w: 20, h: 96 },
      { x: 20.125, y: 0, w: 10, h: 40 },
      { x: 20.125, y: 40.125, w: 10, h: 55.875 },
    ];
    assert.deepEqual(cutStats(strips, S, k, 0), { rips: 2, crosscuts: 0, widestCrosscut: 10 });
    // a full-width crosscut first, then rips in each piece
    const panels = [
      { x: 0, y: 0, w: 30, h: 40 },
      { x: 0, y: 40.125, w: 48, h: 20 },
    ];
    assert.deepEqual(cutStats(panels, S, k, 0), { rips: 0, crosscuts: 2, widestCrosscut: 48 });
  });

  for (const sheet of ["4x8", "5x5"] as const)
    test(`${sheet} rip first: no full-width crosscut, still guillotine, and its cost is reported`, () => {
      for (const stacks of [1, 2, 4]) {
        const s = settings({ sheet, stacks, cuts: "rips" });
        const L = layoutCutlist(parts(), s, { runs: SEARCH_RUNS });
        const free = layoutCutlist(parts(), settings({ sheet, stacks }), {
          runs: SEARCH_RUNS,
          countsOnly: true,
        });
        for (const [i, g] of L.groups.entries()) {
          assert.equal(g.cuts.crosscuts, 0);
          for (const sh of g.sheets) checkSheet(sh, PLYWOOD_SHEETS[sheet], s.kerf, s.trim);
          assert.equal(g.fewestSheets, free.groups[i].sheets.length);
          assert.ok(g.sheets.length >= free.groups[i].sheets.length);
        }
      }
    });
});

describe("review fixes", () => {
  test("a ply group with no part that fits gives no sheets, not a crash", () => {
    const big: CutPart = { box: "Sub", part: "Baffle", qty: 1, a: 62, b: 70, t: 0.75, note: "" };
    const L = layoutCutlist([big], settings({ sheet: "5x5", stacks: 1 }));
    assert.equal(L.groups[0].sheets.length, 0);
    assert.equal(L.groups[0].tooBig.length, 1);
    assert.deepEqual(L.groups[0].cuts, { rips: 0, crosscuts: 0, widestCrosscut: 0 });
  });

  test("the offcut repack never turns a part across the grain", () => {
    const crossed = (L: ReturnType<typeof layoutCutlist>) =>
      L.groups.flatMap((g) => g.sheets.flatMap((s) => s.items)).filter((it) => it.crossed).length;
    for (const sheet of ["4x8", "5x5"] as const)
      for (const offcut of ["strip", "panel"] as const)
        for (const grain of ["wrap", "horizontal"] as const)
          for (const stacks of [1, 2]) {
            const s = settings({
              sheet,
              offcut,
              stacks,
              grain: GRAIN_PRESETS[grain],
              waterfall: true,
              joint: "miter",
            });
            const P = parts("miter");
            assert.ok(
              crossed(layoutCutlist(P, s)) <= crossed(layoutCutlist(P, s, { countsOnly: true })),
            );
          }
  });

  test("rip first keeps a long strip even when a wide panel is asked for", () => {
    const L = layoutCutlist(
      parts(),
      settings({ sheet: "5x5", cuts: "rips", offcut: "panel", stacks: 1 }),
    );
    for (const g of L.groups) {
      assert.equal(g.cuts.crosscuts, 0);
      if (g.offcut) close(null, g.offcut.h, PLYWOOD_SHEETS["5x5"].h, EPS, "full length");
    }
  });

  test("savedCutlist: unknown values fall back, older designs get waterfall with mitres", () => {
    const c = savedCutlist({ kerf: 0.2, trim: 0.3, joint: "miter" });
    assert.equal(c.kerf, 0.125);
    assert.equal(c.trim, 0);
    assert.equal(c.waterfall, true);
    assert.equal(savedCutlist({ joint: "miter", waterfall: false }).waterfall, false);
    assert.equal(savedCutlist({ kerf: 0.25 }).kerf, 0.25);
  });
});
