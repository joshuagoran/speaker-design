import { test } from "vite-plus/test";
import assert from "node:assert";
import { deriveHifiDesign } from "../src/pages/hifi/hifiDesign";
import { DEFAULT_HIFI } from "../src/lib/defaults";
import { close } from "./helpers";

test("a seat at the speakers floors the seat distance at 1 m, so the level stays finite", (t) => {
  const d = deriveHifiDesign({
    ...DEFAULT_HIFI,
    speakerSpacingFt: 0,
    listeningSeat: { x: 0, y: 0 },
  });
  assert.strictEqual(d.seatDistanceM, 1);
  assert.ok(d.speakerModel, "the default drivers can be modelled");
  const m = d.speakerModel;
  assert.ok(Number.isFinite(m.maxLevelAtSeatDb));
  // at 1 m the level is the system's clean output plus 3 dB for two speakers
  close(t, m.maxLevelAtSeatDb, m.speakerSystem.maxLevel + 3, 1e-9);
});

test("every seat closer than 1 m gives the same level and dispersion map", () => {
  const at = (y: number) =>
    deriveHifiDesign({ ...DEFAULT_HIFI, speakerSpacingFt: 0, listeningSeat: { x: 0, y } });
  const a = at(0.5),
    b = at(2.5); // 0.15 m and 0.76 m
  assert.strictEqual(a.seatDistanceM, 1);
  assert.strictEqual(b.seatDistanceM, 1);
  assert.ok(a.speakerModel && b.speakerModel);
  assert.strictEqual(a.speakerModel.maxLevelAtSeatDb, b.speakerModel.maxLevelAtSeatDb);
  assert.deepStrictEqual(a.speakerModel.dispersion, b.speakerModel.dispersion);
});

test("beyond 1 m the seat distance is the average of the two speakers' distances", (t) => {
  const d = deriveHifiDesign(DEFAULT_HIFI);
  close(t, d.seatDistanceM, (d.leftGeometry.distM + d.rightGeometry.distM) / 2, 1e-12);
  assert.ok(d.seatDistanceM > 1);
});
