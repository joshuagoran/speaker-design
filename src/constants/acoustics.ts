/** The speed of sound in air at 20 °C, m/s: the value every model in the planner uses. */
export const SPEED_OF_SOUND = 343;

/** The density of air, kg/m³: the value the PA box models and the horn engine use. */
export const AIR_DENSITY = 1.18;

/**
 * A vented box's leakage and its vent's losses, each as a quality factor Q at the vent's tuning Fb: the box models'
 * defaults (lib/pa/calc boxModel's QL and Qp) and the horn engine's. A lower Q means more loss.
 */
export const BOX_LEAK_Q = 7;
export const BOX_PORT_Q = 50;
