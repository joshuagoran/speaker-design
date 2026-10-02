import { test } from "vite-plus/test";
import assert from "node:assert";
import { SUB_OPTIONS, MID_OPTIONS, FILL_OPTIONS, CD_OPTIONS } from "../src/lib/data";
import type { ThieleSmall } from "../src/types";
import { tsModel } from "./helpers";

// Datasheet values that disagree with the driver's own Mms/Sd/Fs/Bl/Re by more than the tolerance.
// Keep each with a note; the model uses Mms/Bl/Re/Sd/Fs/Qms, not the listed Vas/Qes.
const KNOWN: Record<string, string> = {
  "bc18ps:Vas": "datasheet Vas 245 L vs 283 L from Mms/Sd/Fs; noted on the driver",
  "es12nlw9300:Qes": "datasheet Qes 0.45 vs 0.394 from Bl/Mms/Re/Fs; Qtc reads ~12% low",
  "lv123f:Vas": "datasheet Vas 42 L vs 37.3 L",
  "bc10nw64:Vas": "datasheet Vas 27.5 L vs 30.6 L",
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
