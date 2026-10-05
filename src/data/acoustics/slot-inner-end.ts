// The inner end correction of a slot vent that runs along a wall (a bottom slot along the floor, or a folded slot's rear
// channel up the back panel) and opens into the box, in slot heights. Its mouth is the slot's open end: one side the wall
// it runs along, the other the shelf (`t` thick) that forms it, with the box open beyond the shelf; a facing wall (the
// back wall, or the lid over a folded slot) is `gap` away, and the box spans `span` across the mouth (its inside height
// for a bottom slot, its inside depth for a folded slot's mouth under the lid).
//
// Computed, not measured: the low-frequency acoustic mass of the incompressible flow from the duct into the box, with
// the box air compressing uniformly (Rayleigh, Theory of Sound II §§ 303–306; the method behind Kergomard & Garcia's 2D
// duct-discontinuity corrections, J. Sound Vib. 114 (1987) 465–479), over plane flow; in the box's 2D section, a slot as
// wide as the box. tests/slot-flow.ts solves it, and `vp run slot-inner-end` rewrites the values below. Checks
// (tests/slot-inner-end.test.ts): with the space over the shelf walled off it gives the modal (piston) correction of a
// mouth in a closed duct, a little under it as a piston bounds the flow's mass from above; and a folded slot's inner end
// is this mouth's correction plus the sharp 90° bend's, −0.42 to −0.44 slot heights (SHARP_BEND_CORRECTION below).

/**
 * The table's axes and values: `ecOverH[gap][span][wall]` is the correction over the slot height, at the slot height
 * over the gap to the facing wall (`gap`), over the box's span (`span`), and the shelf's thickness over the slot height
 * (`wall`); the shelf runs `run` slot heights to the mouth.
 */
export const SLOT_INNER_END = {
  gap: [1 / 24, 1 / 12, 1 / 6, 1 / 3, 1 / 2, 2 / 3, 1, 4 / 3, 2, 4],
  span: [1 / 24, 1 / 12, 1 / 8, 1 / 6, 1 / 4, 1 / 3],
  wall: [1 / 8, 1 / 4, 1 / 2, 1],
  run: 4,
  ecOverH: [
    [[1.445, 1.482, 1.535, 1.606], [1.118, 1.153, 1.203, 1.267], [0.941, 0.973, 1.018, 1.072], [0.816, 0.844, 0.883, 0.925], [0.630, 0.652, 0.678, 0.698], [0.490, 0.506, 0.520, 0.520]],
    [[1.488, 1.527, 1.584, 1.661], [1.141, 1.179, 1.233, 1.304], [0.970, 1.004, 1.054, 1.114], [0.849, 0.880, 0.924, 0.972], [0.669, 0.694, 0.724, 0.745], [0.531, 0.549, 0.564, 0.558]],
    [[1.647, 1.691, 1.759, 1.855], [1.200, 1.242, 1.305, 1.391], [1.017, 1.057, 1.115, 1.189], [0.900, 0.936, 0.988, 1.049], [0.730, 0.760, 0.798, 0.827], [0.598, 0.620, 0.641, 0.629]],
    [[1.980, 2.039, 2.134, 2.285], [1.367, 1.422, 1.509, 1.642], [1.133, 1.184, 1.263, 1.376], [0.995, 1.042, 1.113, 1.206], [0.819, 0.859, 0.914, 0.964], [0.694, 0.726, 0.761, 0.753]],
    [[2.258, 2.333, 2.460, 2.676], [1.542, 1.612, 1.730, 1.923], [1.269, 1.335, 1.441, 1.609], [1.107, 1.168, 1.264, 1.404], [0.905, 0.956, 1.030, 1.113], [0.771, 0.813, 0.864, 0.874]],
    [[2.489, 2.582, 2.744, 3.031], [1.707, 1.795, 1.946, 2.208], [1.407, 1.489, 1.628, 1.860], [1.228, 1.304, 1.429, 1.628], [0.999, 1.063, 1.162, 1.288], [0.849, 0.902, 0.972, 1.008]],
    [[2.866, 2.996, 3.232, 3.674], [2.004, 2.128, 2.352, 2.765], [1.671, 1.788, 1.999, 2.377], [1.468, 1.579, 1.773, 2.109], [1.201, 1.296, 1.455, 1.691], [1.018, 1.098, 1.218, 1.326]],
    [[3.172, 3.340, 3.655, 4.258], [2.263, 2.426, 2.728, 3.301], [1.911, 2.067, 2.354, 2.888], [1.695, 1.843, 2.113, 2.599], [1.403, 1.534, 1.762, 2.128], [1.196, 1.308, 1.487, 1.690]],
    [[3.665, 3.913, 4.388, 5.320], [2.706, 2.947, 3.410, 4.310], [2.333, 2.567, 3.014, 3.872], [2.102, 2.329, 2.755, 3.560], [1.783, 1.989, 2.367, 3.026], [1.545, 1.727, 2.043, 2.480]],
    [[4.711, 5.201, 6.171, 8.103], [3.696, 4.181, 5.138, 7.037], [3.302, 3.779, 4.720, 6.574], [3.057, 3.526, 4.445, 6.239], [2.710, 3.156, 4.018, 5.634], [2.437, 2.853, 3.635, 4.938]],
  ],
} as const;

/**
 * A sharp (mitred) 90° bend's length correction against the duct's centreline, in duct widths: the low-frequency mass of
 * a right-angle bend is a potential-flow problem, and its conformal map gives the corner square of an L-shaped channel
 * 0.56 of a straight square's resistance where the centreline counts a whole one (the same 0.56 squares as an L-shaped
 * resistor's corner). Bends' low-frequency acoustics: Miles, J. Acoust. Soc. Am. 19 (1947) 572–579; Dequand et al.,
 * "Acoustics of 90 degree sharp bends", Acta Acustica 89 (2003) 1025–1037.
 */
export const SHARP_BEND_CORRECTION = -0.44;
