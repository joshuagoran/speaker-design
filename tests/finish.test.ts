import { test } from "vite-plus/test";
import assert from "node:assert";
import { CABINET_FINISHES, cabinetFinishOf } from "../src/lib/data";

test("cabinetFinishOf: named finishes by id, anything else (a paint colour) is undefined", () => {
  assert.equal(cabinetFinishOf("birch"), CABINET_FINISHES.birch);
  assert.equal(cabinetFinishOf("walnut"), CABINET_FINISHES.walnut);
  assert.equal(cabinetFinishOf("#4a5d4e"), undefined);
  assert.equal(cabinetFinishOf(""), undefined);
  // names on every object must not read as finishes
  for (const v of ["constructor", "toString", "__proto__", "hasOwnProperty"])
    assert.equal(cabinetFinishOf(v), undefined, v);
});
