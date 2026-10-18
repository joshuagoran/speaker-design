// The Speaker page's own band names (lib/speaker/bandNames): "Full range" for one band, low to high for more, and a name
// the user typed kept.
import { describe, expect, test } from "vite-plus/test";
import { autoBandName, autoNamed, withAutoNames } from "../src/lib/speaker/bandNames";
import { AUTO_BAND_NAMES } from "../src/constants/speakerSpec";
import { SPEAKER_TEXT } from "../src/constants/speakerPage";

const names = (count: number) => Array.from({ length: count }, (_, i) => autoBandName(i, count));

describe("band names the page gives", () => {
  test("one band plays everything; more run low to high", () => {
    expect(names(1)).toEqual([AUTO_BAND_NAMES.fullRange]);
    expect(names(2)).toEqual([AUTO_BAND_NAMES.low, AUTO_BAND_NAMES.high]);
    expect(names(3)).toEqual([AUTO_BAND_NAMES.low, AUTO_BAND_NAMES.mid, AUTO_BAND_NAMES.high]);
    expect(names(4)).toEqual([
      AUTO_BAND_NAMES.low,
      AUTO_BAND_NAMES.lowMid,
      AUTO_BAND_NAMES.highMid,
      AUTO_BAND_NAMES.high,
    ]);
    expect(names(5)[2]).toBe(AUTO_BAND_NAMES.midN(2));
  });
  test("a second band renames the full-range band; a typed name stays", () => {
    const two = withAutoNames([{ name: AUTO_BAND_NAMES.fullRange }, { name: autoBandName(1, 2) }]);
    expect(two.map((b) => b.name)).toEqual(names(2));
    const kept = withAutoNames([{ name: "Sub" }, { name: AUTO_BAND_NAMES.mid }, { name: "Top" }]);
    expect(kept.map((b) => b.name)).toEqual(["Sub", AUTO_BAND_NAMES.mid, "Top"]);
  });
  test("an earlier build's generated name counts as the page's", () => {
    expect(autoNamed(SPEAKER_TEXT.newBandName(3))).toBe(true);
    expect(autoNamed("Kick")).toBe(false);
    expect(withAutoNames([{ name: SPEAKER_TEXT.newBandName(1) }])[0]?.name).toBe(
      AUTO_BAND_NAMES.fullRange,
    );
  });
});
