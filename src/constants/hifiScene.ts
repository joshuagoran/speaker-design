// The Hi-fi speaker's 3D view (stack-view/buildHifiScene): how it draws the parts the catalogue gives only a front size
// for, inches or ratios. Every part's position and front size comes from the design (lib/hifi); these only give it a
// body.
import type { CompressionDriver } from "../types";

/**
 * GENERIC bodies, for parts the catalogue gives no body for: typical proportions so each reads as what it is, not its
 * true size. Replace one with the part's own data (a `body` in its catalog table) when a datasheet gives it.
 */
export const HIFI_GENERIC_BODIES = {
  /**
   * A compression driver the PA catalogue doesn't list (the Hi-fi table gives only its diameter, as the faceplate):
   * the DE250's depth for its diameter (62 / 120 mm), and the common 1-inch driver's two M6 bolts on a 76 mm circle.
   */
  compressionDriver: {
    depthPerDia: 62 / 120,
    bolts: { n: 2, thread: "M6", circle: 76 / 25.4 },
  } satisfies { depthPerDia: number; bolts: CompressionDriver["body"]["bolts"] },
  /** a woofer's body behind the baffle, drawn in the cutaway, per inch of its nominal size: basket depth, magnet */
  woofer: { depthPerSize: 0.45, magnetDiaPerSize: 0.55, magnetDepthPerSize: 0.2 },
  /** a woofer's cutout for a size `HIFI_DRIVER_CUTOUT_IN` doesn't list, per inch of nominal size */
  cutoutPerSize: 0.86,
  /** a dome, horn-loaded or ribbon tweeter's body behind its faceplate, drawn in the cutaway: per inch of faceplate width, and its depth */
  tweeter: { diaPerFace: 0.75, depthIn: 1.2 },
  /** a coaxial's HF driver behind its woofer's magnet, drawn in the cutaway, per inch of the woofer's nominal size */
  coaxHf: { diaPerSize: 0.32, depthPerSize: 0.22 },
} as const;

/** How the 3D view draws the drivers' fronts. */
export const HIFI_FRONT_PARTS = {
  /** a woofer's frame across, per inch of nominal size (the 2D front drawing's woofer circle too) */
  wooferFramePerSize: 0.95,
  /** the frame's thickness proud of the baffle */
  wooferFrameIn: 0.15,
  /** the frame's inner edge for the cutout's radius: it laps over the cutout's edge to the cone's surround */
  wooferFrameLip: 0.96,
  /** a tweeter's faceplate (or a ribbon's waveguide plate) set flush into the baffle: its thickness */
  faceplateIn: 0.2,
  /** a round faceplate's or rectangular plate's corner radius */
  plateCornerIn: 0.25,
  /** a dome's height for its radius, and its surround: a ring this much wider than the dome, this thick */
  domeRise: 0.6,
  domeSurround: { rPerDome: 1.08, tubeIn: 0.06 },
  /** a waveguide set into the baffle: its cutout's corner radius for the mouth's smaller side */
  guideCornerPerSize: 0.15,
  /** a round port's flared lip: its width on the baffle (its cutout is the tube's outside, HIFI_BOX_LAYOUT) */
  portFlangeIn: 0.3,
  /** a passive radiator's frame round its cone, inside its outline (the cutout is this much smaller) */
  radiatorFrameIn: 0.3,
  /** a horn-loaded tweeter's flare: its depth behind the faceplate, and its throat for its mouth */
  flareDepthIn: 0.6,
  flareThroat: 0.35,
  /** a ribbon's diaphragm in its plate: its width and height for the plate's, and how far back it sits */
  ribbon: { w: 0.12, h: 0.6, setBackIn: 0.35 },
  /**
   * a coaxial's HF in its woofer's center, in place of the dust cap (the 2D front drawing's too): its horn's mouth and
   * throat for the cone's radius, how far it stands proud of the cone (its mouth stays behind the woofer's frame), and
   * the phase plug's radius for the throat's (its tip at the horn's mouth)
   */
  coax: {
    hornMouthPerCone: 0.34,
    hornThroatPerCone: 0.14,
    hornRisePerCone: 0.06,
    plugPerThroat: 0.75,
  },
} as const;
