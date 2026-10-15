// The room `hornDesignOf` reads for a chamber in a test (lib/speaker/hornDesign `HornDesignRoom`): its set net air (1 L
// where it is Auto), and a clear face of its outside size less the walls (3/4″ plywood), or the face given.
import type { HornDesignRoom } from "../src/lib/speaker/hornDesign";
import type { Dims2, SpeakerChamber } from "../src/types";

const WALL_IN = 0.75;

export const roomOf = (
  chamber: Pick<SpeakerChamber, "dims" | "netLiters">,
  face: Dims2 = { w: chamber.dims.w - 2 * WALL_IN, h: chamber.dims.h - 2 * WALL_IN },
): HornDesignRoom => ({ netLiters: chamber.netLiters ?? 1, face });
