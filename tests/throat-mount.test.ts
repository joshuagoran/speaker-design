// How a compression driver meets its waveguide: bolt-on or screw-on on each side, direct when they match, else through
// the catalogue's adapter (priced into the Hi-fi cost and the optimizer's), and the screw-on drivers in the model.
import { describe, expect, test } from "vite-plus/test";
import {
  HIFI_TWEETERS,
  HIFI_WAVEGUIDES,
  HIFI_WOOFERS,
  MOUNT_ADAPTERS,
  driverMountKind,
  hornMountKind,
  throatAdapterPrice,
  throatJoin,
  waveguideSpecOf,
} from "../src/lib/data";
import { hifiChips, hifiSystem } from "../src/lib/hifi/hifi";
import { optimizeHifiSpeaker } from "../src/lib/hifi/optimize";
import { deriveHifiDesign } from "../src/pages/hifi/hifiDesign";
import { DEFAULT_HIFI } from "../src/lib/defaults";
import { byIdOrThrow } from "../src/lib/tables";
import { CATALOG_TABLE_NAMES } from "../src/constants/catalogTables";
import type { HifiOptimizerCurrent, HifiTweeter, HifiWaveguide } from "../src/types";

const tweeter = (id: string) => byIdOrThrow(HIFI_TWEETERS, id, CATALOG_TABLE_NAMES.hifiTweeters);
const guide = (id: string) => byIdOrThrow(HIFI_WAVEGUIDES, id, "waveguides");
const adapter = (id: string) => byIdOrThrow(MOUNT_ADAPTERS, id, CATALOG_TABLE_NAMES.mountAdapters);
const de250 = tweeter("de250"); // bolt-on
const d220ti = tweeter("d220ti"); // screw-on
const me10 = guide("me10"); // bolt-on
const hm1725 = guide("hm1725"); // screw-on
const screwOnDrivers = HIFI_TWEETERS.filter((t) => driverMountKind(t) === "thread");

describe("the parts", () => {
  test("two or three screw-on 1-inch compression drivers, priced at a US vendor, with the model's specs", () => {
    expect(screwOnDrivers.length).toBeGreaterThanOrEqual(2);
    for (const t of screwOnDrivers) {
      expect(t.type, t.id).toBe("compression");
      expect(t.exit, t.id).toBe(1);
      expect(t.price, t.id).toBeGreaterThan(0);
      expect(t.src, t.id).toMatch(/parts-express|usspeaker|eminence\.com/i);
      expect(t.hf.sens, t.id).toBeGreaterThan(100);
      expect(t.hf.aes, t.id).toBeGreaterThan(0);
      expect(t.hf.minXo ?? 0, t.id).toBeGreaterThan(0);
      expect(t.hf.imp, t.id).toBeGreaterThan(0);
    }
  });

  test("an adapter each way, priced at a US vendor", () => {
    expect(adapter("b2sa")).toMatchObject({ driver: "bolts", horn: "thread" });
    expect(adapter("s2ba")).toMatchObject({ driver: "thread", horn: "bolts" });
    for (const a of MOUNT_ADAPTERS) {
      expect(a.price ?? 0, a.id).toBeGreaterThan(0);
      expect(a.src, a.id).toMatch(/Parts Express/);
    }
  });

  test("the screw-on horns and drivers read as screw-on; the rest bolt on", () => {
    expect(hornMountKind(waveguideSpecOf(hm1725))).toBe("thread");
    expect(hornMountKind(waveguideSpecOf(guide("h07e")))).toBe("thread");
    expect(hornMountKind(waveguideSpecOf(me10))).toBe("bolts");
    expect(driverMountKind(d220ti)).toBe("thread");
    expect(driverMountKind(de250)).toBe("bolts");
  });
});

describe("the matching rule", () => {
  const spec = (h: HifiWaveguide) => waveguideSpecOf(h);
  test("screw-on on screw-on and bolt-on on bolt-on: direct, no adapter, nothing added", () => {
    expect(throatJoin(d220ti, spec(hm1725))).toEqual({ adapter: null });
    expect(throatJoin(de250, spec(me10))).toEqual({ adapter: null });
    expect(throatAdapterPrice(d220ti, spec(hm1725))).toBe(0);
    expect(throatAdapterPrice(de250, spec(me10))).toBe(0);
  });

  test("bolt-on driver on a screw-on horn: the bolt-to-screw adapter, its price added", () => {
    expect(throatJoin(de250, spec(hm1725))?.adapter?.id).toBe("b2sa");
    expect(throatAdapterPrice(de250, spec(hm1725))).toBe(adapter("b2sa").price);
  });

  test("screw-on driver on a bolt-on horn: the screw-to-bolt adapter, its price added", () => {
    expect(throatJoin(d220ti, spec(me10))?.adapter?.id).toBe("s2ba");
    expect(throatAdapterPrice(d220ti, spec(me10))).toBe(adapter("s2ba").price);
  });

  test("with no adapter between the two kinds the pair doesn't fit (and adds nothing)", () => {
    expect(throatJoin(d220ti, spec(me10), [])).toBeNull();
    expect(throatJoin(de250, spec(hm1725), [adapter("s2ba")])).toBeNull();
    // matching pairs need none
    expect(throatJoin(de250, spec(me10), [])).toEqual({ adapter: null });
  });

  test("a tweeter off the catalogue waveguide (null) adds nothing", () => {
    expect(throatAdapterPrice(d220ti, null)).toBe(0);
  });
});

describe("the Hi-fi page", () => {
  const design = (t: HifiTweeter, h: HifiWaveguide) =>
    deriveHifiDesign({ ...DEFAULT_HIFI, tweeter: t, selectedWaveguide: h });
  const parts = (t: HifiTweeter, h: HifiWaveguide) =>
    2 * ((DEFAULT_HIFI.woofer.price || 0) + t.price + (h.price || 0));

  test("the pair cost adds an adapter per speaker when the pair needs one, and none when direct", () => {
    expect(design(d220ti, hm1725).pairCostUsd).toBeCloseTo(parts(d220ti, hm1725), 6);
    expect(design(de250, me10).pairCostUsd).toBeCloseTo(parts(de250, me10), 6);
    const b2sa = adapter("b2sa").price ?? 0;
    expect(design(de250, hm1725).pairCostUsd).toBeCloseTo(parts(de250, hm1725) + 2 * b2sa, 6);
    const s2ba = adapter("s2ba").price ?? 0;
    expect(design(d220ti, me10).pairCostUsd).toBeCloseTo(parts(d220ti, me10) + 2 * s2ba, 6);
  });

  test("a check names the adapter and its price when one is needed; a direct pair gets none", () => {
    const mount = (t: HifiTweeter, h: HifiWaveguide) =>
      design(t, h).speakerModel?.warningChips.find(([, , , id]) => id === "hifiGuideMount");
    const chip = mount(de250, hm1725);
    if (!chip) throw new Error("no adapter check");
    expect(chip[0]).toBe("ok");
    expect(chip[2]).toContain(adapter("b2sa").name);
    expect(chip[2]).toContain(`$${(adapter("b2sa").price ?? 0).toFixed(2)}`);
    expect(mount(d220ti, me10)?.[2]).toContain(adapter("s2ba").name);
    expect(mount(d220ti, hm1725)).toBeUndefined();
    expect(mount(de250, me10)).toBeUndefined();
  });

  test("every screw-on driver is modeled on a screw-on and a bolt-on waveguide", () => {
    const w = DEFAULT_HIFI.woofer;
    for (const t of screwOnDrivers)
      for (const h of [hm1725, me10]) {
        const minXo = t.hf.minXo ?? 0;
        const cfg = {
          ...design(t, h).speakerConfig,
          xo: Math.max(minXo, h.hf.minXo ?? 0, 2500),
        };
        const tt = { ...t, faceplate: { w: h.size.w, h: h.size.h } };
        const s = hifiSystem(w, tt, cfg);
        if (!s) throw new Error(`${t.id} on ${h.id}: not modeled`);
        expect(Number.isFinite(s.tLevel), `${t.id} on ${h.id}`).toBe(true);
        expect(s.tLevel, `${t.id} on ${h.id}`).toBeGreaterThan(90);
        const chips = hifiChips(s, w, tt, cfg);
        expect(chips.some(([k]) => k === "bad")).toBe(false);
      }
  });
});

describe("the Hi-fi optimizer", () => {
  test("prices each card's adapter in, and only offers drivers the waveguide takes", () => {
    const h07e = guide("h07e"); // screw-on
    const tweeters = [de250, d220ti, tweeter("asd1001")];
    const woofer = byIdOrThrow(HIFI_WOOFERS, DEFAULT_HIFI.woofer.id, "woofers");
    const cur: HifiOptimizerCurrent = {
      woofer: woofer.id,
      tweeter: de250.id,
      box: "vented",
      dim: { w: 9, h: 15, d: 11 },
      wall: 0.75,
      port: { n: 1, dia: 2, len: 6 },
      xo: 2500,
      order: 4,
      wAmpW: 100,
      tAmpW: 50,
      bsc: 3,
      place: "free",
      wallFt: 2,
      portMax: 17,
      guide: waveguideSpecOf(h07e),
    };
    const gp = h07e.price || 0;
    const out = optimizeHifiSpeaker({
      cur,
      woofers: [woofer],
      tweeters,
      budget: 2000,
      seatM: 2.6,
      guidePrice: gp,
      goals: ["cheaper"],
      locks: { woofer: true, box: true },
    });
    expect(out.cards.length).toBeGreaterThan(0);
    for (const k of out.cards) {
      const t = byIdOrThrow(tweeters, k.tweeter, "tweeters");
      const want =
        2 * ((woofer.price || 0) + t.price + gp + throatAdapterPrice(t, waveguideSpecOf(h07e)));
      expect(k.metrics.price, `${k.label}: ${t.id}`).toBeCloseTo(want, 6);
      expect(throatJoin(t, waveguideSpecOf(h07e)), t.id).not.toBeNull();
    }
    // your design: the DE250 on the screw-on H07E, through the adapter
    expect(out.cur?.price).toBeCloseTo(
      2 * ((woofer.price || 0) + de250.price + gp + (adapter("b2sa").price ?? 0)),
      6,
    );
  });
});
