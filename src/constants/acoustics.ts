/** The speed of sound in air at 20 °C, m/s: the value every model in the app uses. */
export const SPEED_OF_SOUND = 343;

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

/** The density of air, kg/m³: the value the PA box models and the horn engine use. */
export const AIR_DENSITY = 1.18;

/**
 * A vented box's leakage and its vent's losses, each as a quality factor Q at the vent's tuning Fb: the box models'
 * defaults (lib/acoustics/boxModels boxModel's QL and Qp) and the horn engine's. A lower Q means more loss.
 */
export const BOX_LEAK_Q = 7;
export const BOX_PORT_Q = 50;
