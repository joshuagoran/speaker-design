import { test } from "vite-plus/test";
import assert from "node:assert";
import { boxParts, packSheets, formatInches, PLYWOOD_SHEETS } from "../src/lib/pa/calc.ts";
import { close } from "./helpers.ts";

const get = (P, name) => P.find((p) => p.part === name);
for (const joint of ["butt", "rabbet", "miter"]) {
  test(`boxParts ${joint}: panels reassemble to the outer box`, (t) => {
    const W = 22,
      H = 30,
      D = 20,
      tt = 0.75,
      { P } = boxParts("Sub", W, H, D, tt, 0.75, joint);
    const side = get(P, "Side"),
      top = get(P, "Top / bottom"),
      back = get(P, "Back");
    close(t, Math.max(side.a, side.b), H, 1e-9);
    close(t, Math.min(side.a, side.b), D, 1e-9);
    const overlap = joint === "butt" ? 2 * tt : joint === "rabbet" ? tt : 0; // how much of W the sides supply
    close(t, top.b + overlap, W, 1e-9, "width");
    close(t, back.a, W - tt, 1e-9);
    close(t, back.b, H - tt, 1e-9); // inner opening + two t/2 rabbets
    const baffle = get(P, "Baffle");
    close(t, baffle.a, W - 2 * tt, 1e-9);
    close(t, baffle.b, H - 2 * tt, 1e-9);
  });
}
test("packSheets: no overlaps, inside the sheet, kerf kept, count at least the area bound", (t) => {
  const rects = [];
  for (let i = 0; i < 6; i++)
    rects.push(
      { a: 20, b: 30, box: "Sub", part: "Side" },
      { a: 15, b: 15, box: "Mid", part: "Side" },
      { a: 0.75, b: 26, box: "Sub", part: "Cleat" },
    );
  for (const S of Object.values(PLYWOOD_SHEETS)) {
    const k = 0.125,
      { sheets, tooBig } = packSheets(rects, S, k);
    assert.equal(tooBig.length, 0);
    assert.equal(
      sheets.reduce((a, s) => a + s.items.length, 0),
      rects.length,
      "all placed",
    );
    const area = rects.reduce((a, r) => a + r.a * r.b, 0);
    assert.ok(sheets.length >= Math.ceil(area / (S.w * S.h)));
    for (const s of sheets) {
      for (const it of s.items)
        assert.ok(
          it.x >= 0 && it.y >= 0 && it.x + it.w <= S.w + 1e-9 && it.y + it.h <= S.h + 1e-9,
          "inside",
        );
      for (let i = 0; i < s.items.length; i++)
        for (let j = i + 1; j < s.items.length; j++) {
          const A = s.items[i],
            B = s.items[j];
          const sep =
            A.x + A.w + k <= B.x + 1e-9 ||
            B.x + B.w + k <= A.x + 1e-9 ||
            A.y + A.h + k <= B.y + 1e-9 ||
            B.y + B.h + k <= A.y + 1e-9;
          assert.ok(sep, "no overlap incl. kerf");
        }
    }
  }
});
test("packSheets: oversize parts are reported, not dropped silently", (t) => {
  const { tooBig } = packSheets(
    [{ a: 70, b: 70, box: "Sub", part: "Big" }],
    PLYWOOD_SHEETS["5x5"],
    0.125,
  );
  assert.equal(tooBig.length, 1);
});
test("f8: nearest 1/16 in, reduced", (t) => {
  assert.equal(formatInches(12.625), "12 5/8");
  assert.equal(formatInches(0.75), "3/4");
  assert.equal(formatInches(3), "3");
  assert.equal(formatInches(1.03), "1");
});
