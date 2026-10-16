import assert from "node:assert";
import type { HornFlare } from "../src/lib/speaker/speakerLayout";
import type { HornPath } from "../src/lib/speaker/hornGeometry";
// The room `hornDesignOf` reads for a chamber in a test (lib/speaker/hornDesign `HornDesignRoom`): its set net air (1 L
// where it is Auto), a clear face of its outside size less the walls (3/4″ plywood), or the face given, and the cones'
// setback on the driver board (none, or the one given). `frontLoadedOf` narrows a result to a front-loaded design.
import type { HornDesignRoom } from "../src/lib/speaker/hornDesign";
import type { Dims2, HornDesignResult, SpeakerChamber } from "../src/types";
import { HORN_LAYOUT } from "../src/constants/acousticNetwork";

const WALL_IN = 0.75;

export const roomOf = (
  chamber: Pick<SpeakerChamber, "dims" | "netLiters">,
  face: Dims2 = { w: chamber.dims.w - 2 * WALL_IN, h: chamber.dims.h - 2 * WALL_IN },
  setbackIn = 0,
): HornDesignRoom => ({ netLiters: chamber.netLiters ?? 1, face, setbackIn });

/** A horn design result that must be a front-loaded design (or a direct radiator): the design. */
export function frontLoadedOf(result: HornDesignResult) {
  if (!result.ok || result.design.layout !== HORN_LAYOUT.frontLoaded)
    throw new Error("a front-loaded design");
  return result.design;
}

/** A flare's straight path; fails for a folded one (its boards draw it instead). */
export function straightPath(flare: Pick<HornFlare, "path"> | null | undefined): HornPath {
  assert.ok(flare?.path, "a straight path");
  return flare.path;
}
