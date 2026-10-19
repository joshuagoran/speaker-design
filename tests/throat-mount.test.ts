// How a compression driver meets its waveguide: bolt-on or screw-on on each side, direct when they match, else through
// the catalogue's adapter (priced into the Hi-fi cost and the optimizer's), and the screw-on drivers in the model.
import { describe, expect, test } from "vite-plus/test";
import {
  HIFI_TWEETERS,
  HIFI_WAVEGUIDES,
  driverMountKind,
  hornMountKind,
  waveguideSpecOf,
} from "../src/lib/data";
import { BOLT_MOUNT, THREAD_MOUNT } from "../src/constants/throatMounts";
import { byIdOrThrow } from "../src/lib/tables";
import { CATALOG_TABLE_NAMES } from "../src/constants/catalogTables";
const tweeter = (id: string) => byIdOrThrow(HIFI_TWEETERS, id, CATALOG_TABLE_NAMES.hifiTweeters);
const guide = (id: string) => byIdOrThrow(HIFI_WAVEGUIDES, id, "waveguides");
const de250 = tweeter("de250"); // bolt-on
const d220ti = tweeter("d220ti"); // screw-on
const me10 = guide("me10"); // bolt-on
const hm1725 = guide("hm1725"); // screw-on
const screwOnDrivers = HIFI_TWEETERS.filter((t) => driverMountKind(t) === THREAD_MOUNT);

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

  test("the screw-on horns and drivers read as screw-on; the rest bolt on", () => {
    expect(hornMountKind(waveguideSpecOf(hm1725))).toBe(THREAD_MOUNT);
    expect(hornMountKind(waveguideSpecOf(guide("h07e")))).toBe(THREAD_MOUNT);
    expect(hornMountKind(waveguideSpecOf(me10))).toBe(BOLT_MOUNT);
    expect(driverMountKind(d220ti)).toBe(THREAD_MOUNT);
    expect(driverMountKind(de250)).toBe(BOLT_MOUNT);
  });
});
