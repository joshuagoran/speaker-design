import type { HornFinish } from "../types";

/** The horn color picker's preset that clears the picked color and returns to the horn's catalog finish. */
export const HORN_COLOR_CATALOG = "catalog";
/** That preset's label. */
export const HORN_COLOR_CATALOG_LABEL = "Catalog";

/** Each horn finish's name in the picker's note; a horn without a finish is printed. */
export const HORN_FINISH_NAMES: Record<HornFinish | "printed", string> = {
  black: "black",
  printed: "cream",
};
