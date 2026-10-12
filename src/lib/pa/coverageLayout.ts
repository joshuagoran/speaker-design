// The PA floor's starting layout: the room, where the stacks stand, the listener and the target. The Coverage page
// starts from it and resets to it (pages/coverage/useCoverageLayout); the Stack page (StackPage) and the Speaker page's
// PA starts (speakerStarts, speakerTemplates) pass it to `layersFromPa` as the PA design's floor; the Space page's saves
// (pages/space/spaceSaves) pass it to `paVenue`.
import { COVERAGE_LEVEL_REF } from "../../constants/coverageLevel";
import { LISTENER_TARGET_DB } from "./optimize";
import type { CoverageLayout } from "../../types";

/**
 * A dance floor about 1500 sq ft with a 14 ft drywall ceiling, block walls all round, an empty floor; the stacks a
 * few feet off the front wall, toed in a little.
 */
export const DEFAULT_COVERAGE_LAYOUT: CoverageLayout = {
  room: {
    widthFt: 34,
    lengthFt: 44,
    ceilingFt: 14,
    materials: {
      front: "concrete",
      back: "concrete",
      left: "concrete",
      right: "concrete",
      ceiling: "drywall",
    },
    crowd: "empty",
    outdoors: false,
  },
  stacks: [
    { x: -9, y: 3, aim: 12 },
    { x: 9, y: 3, aim: -12 },
  ],
  subs: "stacks",
  cluster: { x: 0, y: 2.5 },
  mirror: true,
  band: "sub",
  freqHz: 50,
  targetDb: LISTENER_TARGET_DB,
  levelRef: COVERAGE_LEVEL_REF.audience,
  earFt: 5.3,
  listener: { x: 3, y: 24 },
};
