import { test } from "vite-plus/test";
import assert from "node:assert";
import { compareDrivers } from "../src/lib/pa/compareDrivers";
import { designProblems, evaluateDesign, paSearchDesign } from "../src/lib/pa/optimize";
import { CD_OPTIONS, HORN_OPTIONS, MID_OPTIONS, SUB_OPTIONS } from "../src/lib/data";
import { paCurrent } from "./optimizer-dump-cases";

test("compare drivers: every option once, yours as the planner models it, the ones that pass first", () => {
  const cur = paSearchDesign({ cur: paCurrent("lil block stack") });
  const lim = { maxLb: 125, budget: 1100 };
  const counts = { sub: SUB_OPTIONS, mid: MID_OPTIONS, cd: CD_OPTIONS, horn: HORN_OPTIONS };
  for (const part of ["sub", "mid", "cd", "horn"] as const) {
    const rows = compareDrivers(cur, part, lim);
    assert.deepStrictEqual(
      rows.map((r) => r.id).sort(),
      counts[part].map((o) => o.id).sort(),
      `${part}: every option once`,
    );
    const yours = rows.filter((r) => r.yours);
    assert.strictEqual(yours.length, 1, `${part}: one row is yours`);
    const m = evaluateDesign(cur);
    assert.ok(m && yours[0].m, `${part}: yours is modelled`);
    assert.strictEqual(yours[0].m.out, m.out);
    assert.deepStrictEqual(yours[0].problems, designProblems(m, lim));
    const firstFailing = rows.findIndex((r) => r.problems.length > 0);
    assert.ok(
      firstFailing < 0 || rows.slice(firstFailing).every((r) => r.problems.length > 0),
      `${part}: the ones that pass come first`,
    );
  }
});
