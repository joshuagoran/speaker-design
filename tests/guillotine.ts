// The sheet checks every cutlist layout must pass: inside the trim, a kerf between parts, and cuttable with straight
// through-cuts (guillotine). Shared by the PA and Hi-fi cutlist tests.
import assert from "node:assert";
import type { CutPart, PackedSheet, PlacedPart } from "../src/types";

const EPS = 1e-6;

/** True when the parts can be separated by straight cuts running edge to edge of each piece, recursively. */
export function guillotine(items: PlacedPart<CutPart>[], kerf: number): boolean {
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

export const checkSheet = (
  sh: PackedSheet,
  S: { w: number; h: number },
  kerf: number,
  trim: number,
) => {
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
