// The Hi-fi speaker's 3D view (stack-view/buildHifiScene): how it draws the parts the catalogue gives only a front size
// for, inches or ratios. Every part's position and front size comes from the design (lib/speaker/twoWay, lib/build/boxLayout); these only give it a
// body.
import type { CompressionDriver } from "../types";
import { MM_PER_IN } from "./units";

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
    bolts: { n: 2, thread: "M6", circle: 76 / MM_PER_IN },
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
  /**
   * A ribbon's own waveguide (the 2D front drawing's too), from the Radian LT3-WG datasheet photo: a square plate with
   * a flared rectangular throat, wider than tall (the wider horizontal coverage), down to a tall, narrow slot over the
   * ribbon. Each size is for the plate's: the slot, the throat's mouth on the plate's face, and the flare's depth from
   * the face to the slot (41 mm behind a 170 mm plate); the flare's cross-section squareness (a superellipse exponent).
   * The depth is the waveguide's alone, about 1.6″ on the LT3.2-WG: the catalog's "2.5″ deep" for it likely counts
   * the driver on its back too (the cutaway draws that as the GENERIC tweeter body behind the slot).
   */
  ribbon: {
    slot: { w: 0.1, h: 0.35 },
    mouth: { w: 0.78, h: 0.7 },
    depthPerPlate: 0.24,
    flareSquareness: 6,
  },
  /**
   * An AMT's flat plate (the 2D front drawing's too), from Dayton's AMTPRO-4, AMT3-4 and AMTHR-4 drawings: the opening
   * onto the folded diaphragm leaves about the same margin, 21 mm, on every side of each plate, so a tall plate has a
   * tall opening; the opening's corner radius. The diaphragm's folds run across the opening's short side, about
   * 7.6 mm apart: each fold's width and depth, and how far the folds' front sits behind the plate's face.
   */
  amt: {
    marginIn: 0.82,
    openingCornerIn: 0.08,
    foldPitchIn: 0.3,
    foldWidthIn: 0.06,
    foldDepthIn: 0.1,
    setBackIn: 0.22,
  },
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
