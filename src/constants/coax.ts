// Coaxial drivers in the Hi-fi engine (lib/data coaxParts): the fill catalogue's coaxials as a woofer and a coincident HF
// part.
import type { TweeterType } from "../types";

/** The tweeter type of a coaxial's HF section: it sits at its woofer's center. */
export const COAXIAL_TWEETER_TYPE = "coaxial" as const satisfies TweeterType;

/** The HF figures a coaxial's maker may not publish, by id, as a gap's line names them. */
export const COAX_GAP_NAMES = {
  /** no HF section data at all: the woofer alone is modeled */
  hf: "HF section",
  /** no recommended minimum crossover */
  hfXo: "HF minimum crossover",
  /** no HF coverage: no conical waveguide; the HF radiates as a bare exit (`COAX_HF_EXIT_IN`) */
  hfCov: "HF coverage",
} as const;

/** The gap ids, for code that decides on one. */
export const COAX_GAP = {
  hf: "hf",
  hfXo: "hfXo",
  hfCov: "hfCov",
} as const satisfies { [K in keyof typeof COAX_GAP_NAMES]: K };

/**
 * The HF exit the directivity takes for a coaxial whose maker publishes no coverage, inches: the fill table gives no
 * exit, and coaxial HF exits run 1–1.4 in. Only read where there is no conical waveguide (`COAX_GAP_NAMES.hfCov`).
 */
export const COAX_HF_EXIT_IN = 1;
