import { test } from "vite-plus/test";
import assert from "node:assert";
import { MID_OPTIONS } from "../src/lib/data";
import { ESTIMATE, xmaxBandOf } from "../src/lib/xmax";
import { close } from "./helpers";

test("xmax: derived, converted and estimated bands", (t) => {
  const name = "Test 1";
  // (31 − 15)/2 + 15/4
  close(
    t,
    xmaxBandOf({ pub: { Xmax: 12, formula: "hg/4" }, Hvc: 31, Hg: 15 }, "bc", name).lo,
    11.75,
    1e-9,
  );
  // an Hg/4 figure is already on the scale; an Hg/3 one drops Hg/12
  assert.deepEqual(xmaxBandOf({ pub: { Xmax: 12, formula: "hg/4" } }, "bc", name), {
    basis: "converted",
    lo: 12,
    hi: 12,
  });
  close(
    t,
    xmaxBandOf({ pub: { Xmax: 9.25, formula: "hg/3" }, Hg: 10.5 }, "bc", name).lo,
    9.25 - 10.5 / 12,
    1e-9,
  );
  // Hg/3 without the gap height can't be converted: a table error
  assert.throws(() => xmaxBandOf({ pub: { Xmax: 9.25, formula: "hg/3" } }, "bc", name));
  // Eminence: between its figure and the figure + Hg/4
  assert.deepEqual(
    xmaxBandOf({ pub: { Xmax: 5, formula: "overhang-or-x10" }, Hg: 8 }, "bc", name),
    {
      basis: "estimated",
      lo: 5,
      hi: 7,
    },
  );
  const pro = xmaxBandOf({ pub: { Xmax: 10, formula: "unstated" } }, "bc", name),
    hifi = xmaxBandOf({ pub: { Xmax: 10, formula: "unstated" } }, "dayton", name);
  assert.deepEqual(
    [pro.lo, pro.hi],
    ESTIMATE.XmaxPro.map((k) => k * 10),
  );
  assert.deepEqual(
    [hifi.lo, hifi.hi],
    ESTIMATE.XmaxHifi.map((k) => k * 10),
  );
  assert.throws(() => xmaxBandOf({ pub: { Xmax: null, formula: "unstated" } }, "bc", name));
});

test("mids: a given impedance is positive, and the 10MB600 carries its datasheet depth", () => {
  for (const d of MID_OPTIONS) {
    const imp = d.ts.imp;
    assert.ok(imp === undefined || imp > 0, d.name);
  }
  // 126 mm, the datasheet drawing's overall depth
  assert.equal(MID_OPTIONS.find((d) => d.id === "es10mb600")?.depthIn, 4.96);
});
