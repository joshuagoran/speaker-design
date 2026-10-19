import type { HighpassType, TweeterType } from "../types";

/**
 * The Hi-fi engine's drive options, by id, and their names: an amp channel per driver behind a DSP crossover, or one
 * amp channel and a passive network (lib/hifi tweeterAmpWatts). A design that names none is active.
 */
export const HIFI_DRIVE_NAMES = {
  active: "External, two amp channels",
  passive: "Internal, one amp channel",
} as const;

/** The drive ids, for code that decides on one. */
export const HIFI_DRIVE = {
  active: "active",
  passive: "passive",
} as const satisfies { [K in keyof typeof HIFI_DRIVE_NAMES]: K };

/** The port air speed the Hi-fi woofer's clean level stops at, m/s, sine peak (lib/hifi hifiWooferPrep). */
export const HIFI_PORT_MAX_MS = 17;

/** The automatic subsonic's alignment (lib/hifi hifiBox): a vented or radiator box's highpass at 0.75 × its tuning. */
export const HIFI_SUBSONIC_TYPE = "BW24" satisfies HighpassType;

/**
 * The tweeter type of a planar ribbon, on its own waveguide: a square plate with a slot. Tell a ribbon by this, not by
 * `ownGuide`, which a coaxial's HF section carries too.
 */
export const RIBBON_TWEETER_TYPE = "ribbon" as const satisfies TweeterType;

/**
 * The tweeter type of an AMT (air motion transformer): a folded diaphragm behind a flat plate with a tall opening. It is
 * modeled as a ribbon is, on its plate as its own waveguide (`ownGuide`), but drawn and listed as its own kind.
 */
export const AMT_TWEETER_TYPE = "amt" as const satisfies TweeterType;
