/** The speed of sound in air at 20 °C, m/s: the value every model in the app uses. */
export const SPEED_OF_SOUND = 343;

/**
 * A passband's edge, dB under its level: the usual −3 dB (half-power) corner. A band's level is its curve's mean within
 * this of its highest point, its F3 is where it first comes within this of that level, and a horn's low goal is met
 * within this of its mean.
 */
export const PASSBAND_EDGE_DB = 3;

/**
 * How many frequencies a band average takes in place of each band point in the room-mode range (below the top of the
 * modal crossfade), so that one point near a mode doesn't draw a lobe pattern of its own. Each weighs 1/M of the
 * point's weight.
 */
export const MODAL_SUBPOINTS = 4;

/**
 * The same for a band that lies wholly below the top of the modal crossfade, where every point splits: fewer keep the
 * map's compute time within twice the unsplit one.
 */
export const MODAL_SUBPOINTS_WHOLE_BAND = 2;

/**
 * The baffle step's corner, Hz·m: a box's front radiates into half space above about this over its width in meters,
 * and into full space below it (−3 dB of the 6 dB step there). The step follows the box's size against the wavelength:
 * H. F. Olson, "Direct Radiator Loudspeaker Enclosures", Audio Engineering (1951), measured it for many box shapes.
 * The 115 is a common rule of thumb fitted to such curves, not Olson's own figure: an approximation. Shortcomings: it
 * reads only the width (not the height or the depth, or where the driver sits) and gives one smooth first-order step,
 * with none of the ripple real edges add.
 */
export const BAFFLE_STEP_HZ_M = 115;

/** The density of air, kg/m³: the value every model in the app uses. */
export const AIR_DENSITY = 1.18;

/**
 * A vented box's leakage and its vent's losses, each as a quality factor Q at the vent's tuning Fb: the horn engine's
 * defaults (Small's QL and Qp). A lower Q means more loss.
 */
export const BOX_LEAK_Q = 7;
export const BOX_PORT_Q = 50;

/** The reference pressure for SPL, Pa (0 dB SPL). */
export const SPL_REFERENCE_PA = 2e-5;
