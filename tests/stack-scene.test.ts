// The Stack page's 3D view (stack-view/buildMembersScene) on the PA presets: the members stand where the stack places
// them, so the scene is as tall as the stack's height (lib/speaker/speakerTotals, the PA stack height less the
// plinth: tests/stack-totals.test.ts), from its base at the floor.
import { describe, expect, test } from "vite-plus/test";
import * as THREE from "three";
import {
  buildMembersScene,
  MEMBER_GROUP_NAME,
} from "../src/components/stack-view/buildMembersScene";
import { stackTotals } from "../src/lib/speaker/speakerTotals";
import { stackLayout } from "../src/lib/speaker/stackLayout";
import { presetLayers } from "../src/pages/stack/stackPresets";
import { STACK_PRESET } from "../src/constants/stackPresets";
import type { PaLayout } from "../src/types";

const PRESETS = [
  [STACK_PRESET.paStack, "stack"],
  [STACK_PRESET.paPole, "pole"],
  [STACK_PRESET.paSatellite, "satellite"],
  [STACK_PRESET.paTower, "tower"],
] as const satisfies readonly (readonly [string, PaLayout])[];

/** How far the drawn scene may run past the stack's height, in: the parts drawn proud of the box (a horn's lip). */
const DRAWN_IN = 1;

describe("Stack 3D view: the PA presets stand as the stack places them", () => {
  for (const [preset] of PRESETS)
    test(preset, () => {
      const { stack, speakers } = presetLayers(preset, { id: "test", name: "test" });
      const root = buildMembersScene({ stack, speakers, cutaway: false });
      const box = new THREE.Box3().setFromObject(root);
      const { heightIn } = stackTotals(stack, speakers);
      expect(Math.abs(box.min.y)).toBeLessThan(DRAWN_IN);
      expect(Math.abs(box.max.y - heightIn)).toBeLessThan(DRAWN_IN);
      // the fronts on the stack's front (three's +z), the boxes behind it
      expect(Math.abs(box.max.z)).toBeLessThan(DRAWN_IN);
      // one group per member, at its place in the stack
      const groups = root.children.filter((c) => c.name === MEMBER_GROUP_NAME);
      const placed = stackLayout(stack, speakers);
      expect(groups.length).toBe(placed.length);
      groups.forEach((g, k) => expect(g.position.y).toBeCloseTo(placed[k].at.y, 9));
    });
});
