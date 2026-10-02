import { describe, expect, it } from "vite-plus/test";
import {
  CD_OPTIONS,
  DEFAULT_BAFFLE_COLOR,
  FILL_OPTIONS,
  HIFI_TWEETERS,
  HIFI_WOOFERS,
  HORN_OPTIONS,
  MID_BOXES,
  MID_OPTIONS,
  PAINT_SWATCHES,
  SUB_OPTIONS,
  midBoxesOfSize,
  midDriversOfSize,
} from "../src/lib/data";
import { byId, byIdOrThrow, defaultOf } from "../src/lib/tables";

const picks = (table: readonly { pick?: boolean }[]) => table.filter((o) => o.pick).length;

describe("default picks", () => {
  // one `pick` per table; the mid drivers and mid boxes carry one per size class instead
  const single = {
    SUB_OPTIONS,
    CD_OPTIONS,
    HORN_OPTIONS,
    FILL_OPTIONS,
    HIFI_WOOFERS,
    HIFI_TWEETERS,
  };
  for (const [name, table] of Object.entries(single))
    it(`${name} has exactly one pick`, () => expect(picks(table)).toBe(1));

  it("each mid size class has exactly one driver pick and one box pick", () => {
    for (const size of [10, 12, 15] as const) {
      const drivers = midDriversOfSize(size);
      // 10 in mids have no default of their own: the first listed stands in
      expect(picks(drivers), `mid drivers ${size}`).toBe(size === 10 ? 0 : 1);
    }
    for (const size of [12, 15] as const) expect(picks(midBoxesOfSize(size))).toBe(1);
    expect(picks(MID_OPTIONS)).toBe(2);
    expect(picks(MID_BOXES)).toBe(2);
  });

  it("defaultOf matches the defaults the planner used before the helper", () => {
    expect(defaultOf(SUB_OPTIONS).id).toBe("sbnero18");
    expect(defaultOf(midDriversOfSize(12)).id).toBe("sbnero12");
    expect(defaultOf(midBoxesOfSize(12)).id).toBe("b15");
    expect(defaultOf(midDriversOfSize(15)).id).toBe("bc15ndl76");
    expect(defaultOf(midBoxesOfSize(15)).id).toBe("b18");
    expect(defaultOf(CD_OPTIONS).id).toBe("de360");
    expect(defaultOf(HORN_OPTIONS).id).toBe("a400g2");
    expect(defaultOf(FILL_OPTIONS).id).toBe("bc10cxn64");
    expect(defaultOf(HIFI_WOOFERS).id).toBe("sb17nrx");
    expect(defaultOf(HIFI_TWEETERS).id).toBe("sb26stcn");
    expect(PAINT_SWATCHES.find(([, name]) => name === "Dusty pink")?.[0]).toBe(
      DEFAULT_BAFFLE_COLOR,
    );
  });
});

describe("table helpers", () => {
  it("defaultOf falls back to the first entry and throws on an empty table", () => {
    expect(defaultOf<{ id: string; pick?: boolean }>([{ id: "a" }, { id: "b" }]).id).toBe("a");
    expect(() => defaultOf<{ pick?: boolean }>([], "widgets")).toThrow("widgets");
  });
  it("byId answers undefined; byIdOrThrow names the table", () => {
    expect(byId(SUB_OPTIONS, "nope")).toBeUndefined();
    expect(byIdOrThrow(SUB_OPTIONS, "sbnero18", "subwoofers").id).toBe("sbnero18");
    expect(() => byIdOrThrow(SUB_OPTIONS, "nope", "subwoofers")).toThrow(/subwoofers.*nope/);
  });
});
