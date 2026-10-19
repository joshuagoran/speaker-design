// Each driver joins the optimizers' search spaces once, as its standard version: an entry that is another impedance
// version of one (`variantOf`) stays in the pickers only (lib/optimizer/searchSpace inSearchSpace).
import { test } from "vite-plus/test";
import assert from "node:assert";
import { SUB_OPTIONS } from "../src/lib/data";
import { byId } from "../src/lib/tables";
const variants = SUB_OPTIONS.filter((s) => s.variantOf !== undefined);
test("every variant names a standard entry of the same maker and size", () => {
  assert.ok(variants.length > 0, "the catalog has variants");
  for (const v of variants) {
    const std = v.variantOf === undefined ? undefined : byId(SUB_OPTIONS, v.variantOf);
    assert.ok(std, `${v.id} names ${v.variantOf}`);
    assert.equal(std.variantOf, undefined, `${v.id}: its standard entry is no variant`);
    assert.equal(std.maker, v.maker, v.id);
    assert.equal(std.size, v.size, v.id);
  }
});
