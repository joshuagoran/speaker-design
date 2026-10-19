// The Hi-fi speaker's 3D scene (stack-view/buildHifiScene), built from a Hi-fi design's numbers (`propsFor`): the box at the design's size, each vent, the passive radiators on each panel, each kind
// of tweeter and waveguide, and a freestanding waveguide on its mount (the aluminum plate, or the brackets it gives way
// to).
import { describe, expect, test } from "vite-plus/test";
import { HIFI_WAVEGUIDES } from "../src/lib/data";
import { HORN_MESHES } from "../src/data/meshes";
const WAVEGUIDES = HIFI_WAVEGUIDES;
describe("the tweeter", () => {
  // every small Hi-fi-only waveguide, with a bolt-on driver (the DE250) and a screw-on one (the D220Ti)
  const smallGuides = WAVEGUIDES.filter((h) => h.scope === "hifi");
  test("the small Hi-fi-only waveguides are several, each without a mesh or profile", () => {
    expect(smallGuides.length).toBeGreaterThanOrEqual(3);
    for (const h of smallGuides) {
      expect(HORN_MESHES[h.id], h.id).toBeUndefined();
      expect(h.profile, h.id).toBeUndefined();
    }
  });
});
