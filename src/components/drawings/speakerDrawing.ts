// What the Speaker page's two section drawings share (drawings/SpeakerSide, drawings/SpeakerTop): their size, the
// drivers' proportions and the fills each part takes, from the palette.
import type { BandId, SpeakerSpec } from "../../types";
import { alpha, type Palette } from "../../styles/palette";
import { bandColor } from "../../lib/speaker/bandColor";

/** The drawing's size, px, and its margin (as the front drawing's). */
export const VIEW_PX = 150;
export const PAD_PX = 4;
/** The light fill a driver takes inside its band's outline (as the front drawing's). */
const DRIVER_FILL_ALPHA = 0.18;
/** A cone's motor against its cutout, and where along its depth the basket meets it, as shares. */
export const MOTOR_SHARE = 0.4;
export const BASKET_SHARE = 0.55;
/** How deep a tweeter or a compression driver with no horn is drawn behind the baffle, in. */
export const SMALL_DRIVER_DEPTH_IN = 2;
/** A horn's throat against its mouth, drawn as a share of the mouth's size. */
export const THROAT_SHARE = 0.15;
/** The dash of a measure line, or of a part drawn above or below the cut. */
export const DASH = "3 2";

/**
 * The fills the section drawings give each part: a wall cut through, the clear inside, a horn's air, a vent's air, a
 * brace seen through (light), an opening (the page's background), and a driver in its band's color.
 */
export function sectionStyles(pal: Palette, bands: SpeakerSpec["bands"]) {
  return {
    wall: { fill: pal.edge, stroke: pal.ink, strokeWidth: 1.2 },
    inner: { fill: pal.panel, stroke: pal.muted, strokeWidth: 0.8 },
    air: { fill: alpha(pal.muted, 0.12), stroke: pal.ink, strokeWidth: 0.8 },
    vent: { fill: alpha(pal.muted, 0.3), stroke: pal.muted, strokeWidth: 0.8 },
    brace: { fill: alpha(pal.muted, 0.25), stroke: pal.muted, strokeWidth: 0.6 },
    gap: { fill: pal.white, stroke: "none" },
    inBand: (band: BandId | undefined) => {
      const { stroke } = bandColor(bands, band ?? "", pal);
      return { fill: alpha(stroke, DRIVER_FILL_ALPHA), stroke, strokeWidth: 1.2 };
    },
  };
}
