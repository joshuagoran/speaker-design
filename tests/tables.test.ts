import { describe, expect, it } from "vite-plus/test";
import { HIFI_TWEETERS, SUB_OPTIONS } from "../src/lib/data";
import { byId, byIdOrThrow } from "../src/lib/tables";
import { CATALOG_TABLE_NAMES } from "../src/constants/catalogTables";

describe("table helpers", () => {
  it("byId answers undefined; byIdOrThrow names the table", () => {
    expect(byId(SUB_OPTIONS, "nope")).toBeUndefined();
    expect(byIdOrThrow(SUB_OPTIONS, "sbnero18", CATALOG_TABLE_NAMES.subs).id).toBe("sbnero18");
    expect(() => byIdOrThrow(SUB_OPTIONS, "nope", CATALOG_TABLE_NAMES.subs)).toThrow(
      new RegExp(`${CATALOG_TABLE_NAMES.subs}.*nope`),
    );
  });
});

describe("tweeter normalisation", () => {
  it("every tweeter has a faceplate size and a radiating diameter", () => {
    for (const t of HIFI_TWEETERS) {
      expect(t.faceplate.w, t.id).toBeGreaterThan(0);
      expect(t.faceplate.h, t.id).toBeGreaterThan(0);
      expect(t.domeIn, t.id).toBeGreaterThan(0);
    }
  });
  it("a round faceplate becomes a square of its diameter; a missing one is 3.5 in square", () => {
    expect(
      byIdOrThrow(HIFI_TWEETERS, "rst28f", CATALOG_TABLE_NAMES.hifiTweeters).faceplate,
    ).toEqual({
      w: 4.125,
      h: 4.125,
    });
    expect(HIFI_TWEETERS.some((t) => t.faceplate.w === 3.5 && t.faceplate.h === 3.5)).toBe(true);
  });
});
