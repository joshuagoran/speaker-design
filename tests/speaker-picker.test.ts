// The Speaker page's driver picker (src/pages/speaker/speakerParts): one woofer list over the PA subs, the PA mid-bass
// drivers and the Hi-fi woofers, with the size as a filter; a new woofer takes the largest size that fits its chamber.
import { assert, test } from "vite-plus/test";
import {
  WOOFER_OPTIONS,
  WOOFER_SIZES,
  withWoofer,
  wooferClearIn,
  wooferFor,
  wooferSizeOf,
} from "../src/pages/speaker/speakerParts";
import { HIFI_WOOFERS, MID_OPTIONS, SPEAKER_SUB_OPTIONS } from "../src/lib/data";
import { DRIVER_KIND } from "../src/constants/speakerSpec";
import type { SpeakerDriver } from "../src/types";

test("driver picker: every woofer of the catalog tables (the Speaker page's subs, mids and hi-fi woofers) is in the one list, smallest first", () => {
  assert.equal(
    WOOFER_OPTIONS.length,
    SPEAKER_SUB_OPTIONS.length + MID_OPTIONS.length + HIFI_WOOFERS.length,
  );
  for (const d of [...SPEAKER_SUB_OPTIONS, ...MID_OPTIONS, ...HIFI_WOOFERS])
    assert.equal(wooferSizeOf({ driverId: d.id }), d.size, d.name);
  assert.deepEqual(
    WOOFER_SIZES,
    [...WOOFER_SIZES].sort((a, b) => a - b),
  );
  assert.ok(WOOFER_OPTIONS.every((o, i) => i === 0 || WOOFER_OPTIONS[i - 1].size <= o.size));
});

test("driver picker: a new woofer is the largest size that fits the chamber's clear width", () => {
  const fit = wooferFor(14);
  assert.equal(fit.size, Math.max(...WOOFER_SIZES.filter((s) => s <= 14)));
  assert.equal(wooferFor(1).size, WOOFER_SIZES[0], "the smallest when none fits");
});

test("driver picker: a woofer from the list sets its catalog kind and keeps the count, place and first band", () => {
  const coax: SpeakerDriver = {
    kind: DRIVER_KIND.coaxial,
    driverId: "x",
    count: 2,
    position: { xIn: 1, yIn: 3 },
    bands: ["low", "high"],
    horn: null,
  };
  const sub = WOOFER_OPTIONS.find((o) => o.kind === DRIVER_KIND.sub);
  if (!sub) throw new Error("no sub in the list");
  const d = withWoofer(coax, sub);
  assert.equal(d.kind, DRIVER_KIND.sub);
  assert.equal(d.driverId, sub.id);
  assert.equal(d.count, 2);
  assert.deepEqual(d.position, coax.position);
  assert.deepEqual(d.bands, ["low"]);
});

test("driver picker: a wide, short chamber takes no woofer taller than it is", () => {
  const wall = 0.75;
  const room = wooferClearIn({ dims: { w: 24, h: 10, d: 16 } }, wall);
  assert.equal(room, 10 - 2 * wall);
  const fit = wooferFor(room);
  assert.ok(fit.size <= room, `${fit.size} in in a ${room} in clear height`);
  assert.notEqual(fit.size, 18);
});
