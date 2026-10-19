// The Speaker and Stack pages' dispersion check words and figures (lib/speaker/dispersionCheck): whether the band under
// a crossover is as wide there as the band over it. The upper band is named by its display name.

/** The widest a beam is taken to be, degrees: a cone this small, or a dome, covers a half sphere. */
export const DISPERSION_FULL_BEAM_DEG = 180;

/** The coverage taken for a dome (and for a driver with no horn), degrees. */
export const DISPERSION_DOME_COVERAGE_DEG = 160;

/** Where a cone's beam starts to narrow: ka, the cone's circumference over the wavelength. */
export const DISPERSION_NARROW_KA = 2.2;

/** The share of the upper band's coverage the lower band's beam must reach to match it. */
export const DISPERSION_MATCH_SHARE = 0.75;

/** How the check knows the upper band's coverage, by id: a rated horn, a coaxial with none published, or a dome. */
export const DISPERSION_COVERAGE = {
  rated: "rated",
  unpublished: "unpublished",
  dome: "dome",
} as const;

export const DISPERSION_TEXT = {
  /** the lower band is narrower than the upper band: the upper band's name */
  warnTitle: (high: string) => `Narrower than ${high} at the crossover`,
  /** the beam, degrees; the upper band's name; its coverage as `coverage` says it; the crossover, Hz */
  warnTip: (deg: number, high: string, coverage: string, xo: number) =>
    `About ${deg}° against ${high}'s ${coverage}: an off-axis dip below ${xo} Hz. Use a lower crossover.`,
  /** the lower band is wide enough: the upper band's name */
  okTitle: (high: string) => `Matches ${high} at the crossover`,
  okTip: (deg: number, xo: number) => `About ${deg}° wide at ${xo} Hz.`,
  /** the upper band's coverage in a warning: a rated figure, degrees; none published; a dome */
  coverage: {
    rated: (deg: number) => `${deg}°`,
    unpublished: "unpublished coverage, taken as wide",
    dome: "wide dome",
  },
} as const;
