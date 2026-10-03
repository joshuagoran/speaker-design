import { test } from "vite-plus/test";
import assert from "node:assert";
import {
  SUB_OPTIONS,
  MID_OPTIONS,
  FILL_OPTIONS,
  CD_OPTIONS,
  HIFI_WOOFERS,
  HIFI_PASSIVES,
} from "../src/lib/data";
import { ESTIMATE, comparableXmax, xmaxBandOf, xmaxByFormula } from "../src/lib/xmax";
import type { ThieleSmall } from "../src/types";
import { close, tsModel } from "./helpers";

// Datasheet values that disagree with the driver's own Mms/Sd/Fs/Bl/Re by more than the tolerance.
// Keep each with a note; the model uses Mms/Bl/Re/Sd/Fs/Qms, not the listed Vas/Qes.
const KNOWN: Record<string, string> = {
  "bc18ps:Vas": "datasheet Vas 245 L vs 283 L from Mms/Sd/Fs; noted on the driver",
  "es12nlw9300:Qes": "datasheet Qes 0.45 vs 0.394 from Bl/Mms/Re/Fs; Qtc reads ~12% low",
  "lv123f:Vas": "datasheet Vas 42 L vs 37.3 L",
  "cindcx10:Vas": "published Vas doesn't fit Mms/Sd (noted on the driver); derived is 1.53x",
};
const all = [...SUB_OPTIONS, ...MID_OPTIONS, ...FILL_OPTIONS];
const need = ["Fs", "Qms", "Sd", "Mms", "Bl", "Re", "Xmax", "aes"] as const;

test("every driver with T/S has the fields the models use", (t) => {
  for (const o of all)
    if (o.ts && o.ts.Bl)
      for (const k of need) assert.ok(Number.isFinite(o.ts[k]) && o.ts[k] > 0, `${o.id}.${k}`);
});
test("T/S internal consistency (Qts, Qes, Vas) or a listed exception", (t) => {
  const bad: string[] = [];
  for (const o of all) {
    const ts: ThieleSmall = o.ts;
    if (!ts || !ts.Bl || !ts.Mms) continue;
    const m = tsModel(o.ts);
    if (ts.Qes && ts.Qms && ts.Qts) {
      const q = (ts.Qes * ts.Qms) / (ts.Qes + ts.Qms);
      if (Math.abs(q / ts.Qts - 1) > 0.05) bad.push(`${o.id}:Qts`);
    }
    if (ts.Qes && Math.abs(m.Qes / ts.Qes - 1) > 0.1) bad.push(`${o.id}:Qes`);
    if (ts.Vas && Math.abs(m.VasL / ts.Vas - 1) > 0.1) bad.push(`${o.id}:Vas`);
  }
  const unexplained = bad.filter((k) => !KNOWN[k]);
  assert.deepEqual(unexplained, [], "new mismatches: add a note to KNOWN or fix the data");
});
test("prices and weights are positive where given; ids are unique", (t) => {
  const ids = new Set<string>();
  for (const o of [...all, ...CD_OPTIONS]) {
    assert.ok(!ids.has(o.id), `duplicate ${o.id}`);
    ids.add(o.id);
    if (o.price != null) assert.ok(o.price > 0, `${o.id} price`);
    if (o.lb != null) assert.ok(o.lb > 0, `${o.id} lb`);
  }
});

// A published Xmax that its own formula, from the published coil and gap heights, misses by more than 0.5 mm.
const XMAX_KNOWN: Record<string, string> = {
  by12lx60:
    "Beyma's sheet prints Xmax 9 but its own Lvc 20 / Hag 10 give 7.86 by its printed formula",
  ciare_hwb200:
    "Ciare prints Xmax 7 but its own Hvc 16 / Hg 8 give 6.0 by its printed Hg/4 formula (HW205, same motor, prints 6)",
};
const woofers = [...all, ...HIFI_WOOFERS];

test("published Xmax fits its formula from Hvc and Hg (±0.5 mm) or a listed exception", (t) => {
  const bad: string[] = [];
  for (const o of woofers) {
    const { pub, Hvc, Hg } = o.ts;
    if (Hvc == null || Hg == null || pub.Xmax == null || pub.formula === "unstated") continue;
    const want = xmaxByFormula(pub.formula, Hvc, Hg);
    if (Math.abs(pub.Xmax - want) > 0.5) bad.push(`${o.id}: ${pub.Xmax} vs ${want.toFixed(2)}`);
  }
  assert.deepEqual(
    bad.filter((k) => !XMAX_KNOWN[k.split(":")[0]]),
    [],
    "add a note to XMAX_KNOWN or fix the data",
  );
});

test("every driver's comparable Xmax: derived from heights where both are given, centred in its band", (t) => {
  for (const o of woofers) {
    const { Xmax, xmax, Hvc, Hg } = o.ts;
    assert.ok(xmax.lo > 0 && xmax.lo <= Xmax && Xmax <= xmax.hi, o.id);
    if (Hvc != null && Hg != null) {
      assert.equal(xmax.basis, "derived", o.id);
      close(t, Xmax, comparableXmax(Hvc, Hg), 1e-9, o.id);
    } else assert.notEqual(xmax.basis, "derived", o.id);
  }
  for (const p of HIFI_PASSIVES) {
    assert.ok(p.xmax.lo > 0 && p.xmax.lo <= p.Xmax && p.Xmax <= p.xmax.hi, p.id);
    assert.equal(p.xmax.basis, "published", p.id);
    assert.equal(p.Xmax, p.pub.Xmax ?? p.pub.Xlim, p.id);
  }
});

test("xmax: derived, converted and estimated bands", (t) => {
  const name = "Test 1";
  // (31 − 15)/2 + 15/4
  close(
    t,
    xmaxBandOf({ pub: { Xmax: 12, formula: "hg/4" }, Hvc: 31, Hg: 15 }, name).lo,
    11.75,
    1e-9,
  );
  // an Hg/4 figure is already on the scale; an Hg/3 one drops Hg/12
  assert.deepEqual(xmaxBandOf({ pub: { Xmax: 12, formula: "hg/4" } }, name), {
    basis: "converted",
    lo: 12,
    hi: 12,
  });
  close(
    t,
    xmaxBandOf({ pub: { Xmax: 9.25, formula: "hg/3" }, Hg: 10.5 }, name).lo,
    9.25 - 10.5 / 12,
    1e-9,
  );
  // Hg/3 without the gap height can't be converted: estimated
  assert.equal(xmaxBandOf({ pub: { Xmax: 9.25, formula: "hg/3" } }, name).basis, "estimated");
  const pro = xmaxBandOf({ pub: { Xmax: 10, formula: "unstated" } }, name),
    hifi = xmaxBandOf({ pub: { Xmax: 10, formula: "unstated" } }, "Dayton Audio X");
  assert.deepEqual(
    [pro.lo, pro.hi],
    ESTIMATE.XmaxPro.map((k) => k * 10),
  );
  assert.deepEqual(
    [hifi.lo, hifi.hi],
    ESTIMATE.XmaxHifi.map((k) => k * 10),
  );
  assert.throws(() => xmaxBandOf({ pub: { Xmax: null, formula: "unstated" } }, name));
});
