/** Top of every Hi-fi dB chart, so designs and charts compare by eye. */
export const HIFI_TOP = 130;

/** Bottom of every Hi-fi dB chart. */
export const HIFI_BOT = 50;

/** Every dispersion map spans −90° to +90° off axis, sampled every 5°. */
export const DISPERSION_ANGLE_MAX_DEG = 90;

/** The angle step of every dispersion map's data, degrees. */
export const DISPERSION_ANGLE_STEP_DEG = 5;

/** Gridlines on a dispersion map's angle axis, degrees apart. */
export const DISPERSION_GRID_DEG = 15;

/** Labels on a dispersion map's angle axis, degrees apart. */
export const DISPERSION_LABEL_DEG = 30;

/**
 * Low end of every dispersion map's frequency axis, Hz: the one frequency chart that starts above the PA stack's 15 Hz,
 * since below it the maps are flat. The default designs first fall more than 1 dB off axis (anywhere within ±90°, either
 * plane) at about 85 Hz (PA vertical, the sub/mid crossover lobe), 440 Hz (PA horizontal), 490 Hz (Hi-fi vertical) and
 * 690 Hz (Hi-fi horizontal); 50 Hz is the round value below the lowest.
 */
export const DISPERSION_FREQ_MIN_HZ = 50;

/** High end of every dispersion map's frequency axis, Hz (the PA stack's). */
export const DISPERSION_FREQ_MAX_HZ = 20000;

/** How many log-spaced frequencies a dispersion map samples between its axis ends (about 9 per octave). */
export const DISPERSION_FREQ_POINTS = 78;

/** The coverage map's colour scale, dB SPL: fixed at the PA response chart's 80–135 dB, so layouts compare by eye. */
export const COVERAGE_MAP_DB: [lo: number, hi: number] = [80, 135];
