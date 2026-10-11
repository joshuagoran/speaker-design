// The PA boxes' strength checks (lib/bracing applies them with the resonance target): the panels, ribs and window
// braces' rails in bending under two loads.
//
// - The driver's pressure inside the box, reversing at the bass frequency for the box's whole life (a fatigue check):
//   the driver at Xmax compresses the air adiabatically, p = γ P₀ Sd Xmax / V (γ = 1.4, P₀ = 101 325 Pa), V the
//   inside less the driver. It is the sealed box's pressure: a vent unloads the box near its tuning, so this reads high.
// - A load on the lid (a box stacked on it, a person sitting on it, the bumps of a truck): STACK_LOAD_N spread over it.
//
// A bay's bending stress is a rectangular plate's under a uniform load, σ = β q b² / t² (b its shorter side, t its
// thickness; W. C. Young & R. G. Budynas, "Roark's Formulas for Stress and Strain", 7th ed., Table 11.4: case 1a, all
// edges simply supported, at the center, and case 8a, all edges fixed, at the middle of a long edge; a glued edge
// sits between, so β is the larger of the two). A rib or rail is a beam carrying its strip of panel, hinged over its
// span (M = w L² / 8, the larger midspan moment) as its T section (lib/bracing's teeBeam), σ = M / Z.
//
// The limits are Eurocode 5's design strengths for plywood (EN 1995-1-1:2004, f_d = k_mod f_k / γ_M, γ_M = 1.2 for
// plywood, Table 2.3; k_mod for service class 1, Table 3.1) from birch plywood's characteristic bending strength across
// the face grain (the weaker way), 34.1 N/mm² (UPM WISA-Form Birch technical fact sheet, 18 mm, 01/2015: f_m⊥; along
// the grain 40.2 N/mm²), the sheet lib/bracing's moduli come from.
// - The pressure: short-term (k_mod 0.9) and fatigue, k_fat = 1 − (1 − R) / (a (b − R)) log₁₀(β N) (EN 1995-2:2004,
//   Annex A, eq. A.1; bending a = 9.5, b = 1.1, Table A.1), the stress reversing (R = −1), FATIGUE_CYCLES cycles and
//   β = 1 (a cracked panel is no danger to anyone).
// - The lid: medium-term (k_mod 0.8).

/** Birch plywood's characteristic bending strength across the face grain, Pa (header). */
export const PLY_BENDING_STRENGTH_PA = 34.1e6;
/** Eurocode 5's partial factor for plywood (header). */
const GAMMA_M = 1.2;
/** The load's duration in Eurocode 5's terms (header): short-term for the pressure, medium-term for a lid's load. */
const KMOD_SHORT = 0.9;
const KMOD_MEDIUM = 0.8;
/** The pressure's cycles in a box's life: about 700 hours at 40 Hz. */
export const FATIGUE_CYCLES = 1e8;
/** The fatigue factor for those cycles, the stress reversing (header). */
export const FATIGUE_FACTOR = 1 - (2 / (9.5 * (1.1 + 1))) * Math.log10(FATIGUE_CYCLES);
/** The stress limit under the driver's pressure, Pa (about 5 N/mm²). */
export const PRESSURE_STRESS_LIMIT_PA =
  (FATIGUE_FACTOR * KMOD_SHORT * PLY_BENDING_STRENGTH_PA) / GAMMA_M;
/** The stress limit under a load on the lid, Pa (about 23 N/mm²). */
export const LID_STRESS_LIMIT_PA = (KMOD_MEDIUM * PLY_BENDING_STRENGTH_PA) / GAMMA_M;
/**
 * The load on a lid, N: a 100 lb box stacked on it with the bumps of a truck doubling its weight, or a person of
 * about 100 kg sitting on it.
 */
export const STACK_LOAD_N = 1000;

const ATMOSPHERE_PA = 101325;
const AIR_GAMMA = 1.4;
/**
 * The pressure in a box when the driver moves Xmax, Pa (header): `sdCm2` the cone's area (cm²), `xmaxMm` its excursion
 * (mm), `liters` the box's air.
 */
export const driverPressurePa = (sdCm2: number, xmaxMm: number, liters: number) =>
  liters > 0 ? (AIR_GAMMA * ATMOSPHERE_PA * (sdCm2 * 1e-4 * xmaxMm * 1e-3)) / (liters * 1e-3) : 0;

/** Roark's Table 11.4 β against the plate's long side over its short side: case 1a (center) and case 8a (edge). */
const BETA_ASPECT = [1, 1.2, 1.4, 1.6, 1.8, 2, 3, 4, 5, Infinity];
const BETA_HINGED = [0.2874, 0.3762, 0.453, 0.5172, 0.5688, 0.6102, 0.7134, 0.741, 0.7476, 0.75];
const BETA_FIXED = [0.3078, 0.3834, 0.4356, 0.468, 0.4872, 0.4974, 0.5, 0.5, 0.5, 0.5];
/** β for a plate `a` × `b` (either order): the larger of the hinged and fixed cases, interpolated (header). */
export function plateStressFactor(a: number, b: number) {
  const r = Math.max(a, b) / Math.min(a, b);
  const at = (ys: number[]) => {
    for (let i = 1; i < BETA_ASPECT.length; i++)
      if (r <= BETA_ASPECT[i]) {
        const x0 = BETA_ASPECT[i - 1],
          x1 = BETA_ASPECT[i];
        return x1 === Infinity ? ys[i] : ys[i - 1] + ((ys[i] - ys[i - 1]) * (r - x0)) / (x1 - x0);
      }
    return ys[ys.length - 1];
  };
  return Math.max(at(BETA_HINGED), at(BETA_FIXED));
}
