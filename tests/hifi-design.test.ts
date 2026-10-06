import { test } from "vite-plus/test";
import assert from "node:assert";
import { deriveHifiDesign } from "../src/pages/hifi/hifiDesign";
import { DEFAULT_HIFI } from "../src/lib/defaults";
import { cabs, linkwitzRileyFilter } from "../src/lib/hifi/hifi";
import { close } from "./helpers";

test("a seat at the speakers floors the seat distance at 1 m, so the level stays finite", (t) => {
  const d = deriveHifiDesign({
    ...DEFAULT_HIFI,
    speakerSpacingFt: 0,
    listeningSeat: { x: 0, y: 0 },
  });
  assert.strictEqual(d.seatDistanceM, 1);
  assert.ok(d.speakerModel, "the default drivers can be modeled");
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

test("the seat distance is also given in feet, from the floored meters", (t) => {
  const far = deriveHifiDesign(DEFAULT_HIFI);
  close(t, far.seatDistanceFt * 0.3048, far.seatDistanceM, 1e-12);
  const at = deriveHifiDesign({
    ...DEFAULT_HIFI,
    speakerSpacingFt: 0,
    listeningSeat: { x: 0, y: 0 },
  });
  close(t, at.seatDistanceFt, 1 / 0.3048, 1e-12);
});

test("the tweeter's maximum curve is its level plus the highpass magnitude at each frequency", (t) => {
  const d = deriveHifiDesign(DEFAULT_HIFI);
  assert.ok(d.speakerModel);
  const { speakerSystem, tweeterMaxCurve } = d.speakerModel;
  assert.strictEqual(tweeterMaxCurve.length, 220);
  assert.strictEqual(tweeterMaxCurve[0].f, 15);
  close(t, tweeterMaxCurve[219].f, 20000, 1e-6);
  for (const { f, spl } of tweeterMaxCurve) {
    const hp = linkwitzRileyFilter(f, DEFAULT_HIFI.crossoverHz, DEFAULT_HIFI.crossoverOrder, "hp");
    close(t, spl, speakerSystem.tLevel + 20 * Math.log10(Math.max(1e-6, cabs(hp))), 1e-9);
  }
});

test("every response is worked out on the same 220-point grid", () => {
  const m = deriveHifiDesign(DEFAULT_HIFI).speakerModel;
  assert.ok(m);
  for (const curve of [m.onAxisResponse, m.pairResponse, m.tweeterMaxCurve]) {
    assert.deepStrictEqual(
      curve.map((p) => p.f),
      m.tweeterMaxCurve.map((p) => p.f),
    );
  }
});
