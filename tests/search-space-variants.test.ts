// Each driver joins the optimizers' search spaces once, as its standard version: an entry that is another impedance
// version of one (`variantOf`) stays in the pickers only (lib/optimizer/searchSpace inSearchSpace).
import { test } from "vite-plus/test";
import assert from "node:assert";
import { SUB_OPTIONS } from "../src/lib/data";
import { byId } from "../src/lib/tables";
import { paSearchSubs } from "../src/lib/pa/optimize";
import { SPEAKER_OPTIMIZER_CATALOG, searchUnits } from "../src/lib/speaker/optimize/space";
import { templateSpeaker } from "../src/pages/speaker/speakerTemplates";
import { SPEAKER_TEMPLATE } from "../src/constants/speakerStarts";
import { DRIVER_KIND } from "../src/constants/speakerSpec";
import type { SpeakerSpec } from "../src/types";

const variants = SUB_OPTIONS.filter((s) => s.variantOf !== undefined);
const isVariant = (id: string) => byId(SUB_OPTIONS, id)?.variantOf !== undefined;

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

test("no optimizer search space holds a variant: PA (quick and exact), Speaker and Stack", () => {
  for (const cur of SUB_OPTIONS)
    for (const allSizes of [false, true]) {
      const ids = paSearchSubs(cur.id, false, Infinity, allSizes).map((s) => s.id);
      assert.ok(ids.length > 0, cur.id);
      assert.deepEqual(ids.filter(isVariant), [], `PA, from ${cur.id}`);
    }
  // a locked sub stays your own, a variant included
  for (const v of variants) assert.deepEqual(paSearchSubs(v.id, true, Infinity, false), [v]);
  // the Speaker and Stack optimizers' units (the Stack runs each speaker's search): your part, and no other variant
  const base = templateSpeaker(SPEAKER_TEMPLATE.paSubBox);
  for (const cur of SUB_OPTIONS) {
    const spec: SpeakerSpec = {
      ...base,
      cabinet: {
        ...base.cabinet,
        chambers: base.cabinet.chambers.map((c) => ({
          ...c,
          drivers: c.drivers.map((d) =>
            d.kind === DRIVER_KIND.sub ? { ...d, driverId: cur.id } : d,
          ),
        })),
      },
    };
    const units = searchUnits(spec, {}, SPEAKER_OPTIMIZER_CATALOG);
    for (const u of units)
      if (u.kind === "cone")
        assert.deepEqual(
          u.drivers.filter((id) => id !== cur.id && isVariant(id)),
          [],
          `Speaker, from ${cur.id}`,
        );
  }
});
