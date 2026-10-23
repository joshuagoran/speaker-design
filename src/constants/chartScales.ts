/**
 * Top of every maximum-output chart, dB SPL: the Speaker and Stack pages' maximum-output charts and the Speaker
 * optimizer's cards. A PA horn on its amp reaches about 131 dB at 1 m on the saved PA designs, a Hi-fi compression driver on a
 * waveguide about 126 dB.
 */
export const MAX_OUTPUT_TOP = 140;

/** Bottom of every maximum-output chart, dB SPL. */
export const MAX_OUTPUT_BOT = 80;

/** Low end of the frequency charts' axis, Hz: the PA stack's, which every frequency chart shares, the dispersion maps too. */
export const FREQ_AXIS_MIN_HZ = 15;

/** High end of the frequency charts' axis, Hz. */
export const FREQ_AXIS_MAX_HZ = 20000;

/** The title under every frequency axis. */
export const FREQUENCY_AXIS_TITLE = "frequency, Hz";

/**
 * Top of every sensitivity and response chart (the Speaker page's 2.83 V, 1 m response and the Stack page's response),
 * so designs and charts compare by eye.
 */
export const HIFI_TOP = 120;

/** Bottom of every sensitivity and response chart. */
export const HIFI_BOT = 50;

/** Every dispersion map spans −90° to +90° off axis, sampled every 5°. */
export const DISPERSION_ANGLE_MAX_DEG = 90;

/** The angle step of every dispersion map's data, degrees. */
export const DISPERSION_ANGLE_STEP_DEG = 5;

/** Gridlines on a dispersion map's angle axis, degrees apart. */
export const DISPERSION_GRID_DEG = 15;

/** Labels on a dispersion map's angle axis, degrees apart. */
export const DISPERSION_LABEL_DEG = 30;

/** How far out a stack's or speaker's dispersion map is worked out, m (the Speaker and Stack pages'). */
export const DISPERSION_DISTANCE_M = 10;

/**
 * How many log-spaced frequencies a dispersion map samples between the frequency axis's ends (about 9 per octave). The
 * maps are flat below about 85 Hz (the default designs first fall 1 dB off axis there), so their low end is one color.
 */
export const DISPERSION_FREQ_POINTS = 94;

/**
 * The coverage map's color scale, dB against the target: fixed, so layouts compare by eye. A room spans about 15 dB, so
 * the scale covers only that: white at −12 dB (no coverage), magenta at the target, dark magenta at +6 dB (too loud).
 */
export const COVERAGE_MAP_DB: [lo: number, hi: number] = [-12, 6];

/** Every dB heat map (the dispersion maps, the coverage map) draws a thin contour line every this many dB. */
export const CONTOUR_STEP_DB = 3;

/**
 * The fixed scale of every sheet drawing on the Cutlist page, CSS px per inch: a 4 × 8 ft sheet draws 192 px wide at any
 * window width (narrower only where the screen is), so sheets and layouts compare by eye.
 */
export const SHEET_PX_PER_IN = 4;

/** The font size of the panel labels on the sheet drawings, CSS px. */
export const SHEET_LABEL_PX = 12;

/**
 * The folded-horn path chart's gridline spacings to pick from, in along the path and in² of area (owner-approved
 * exception to fixed axes: the chart scales to its drawing and its straight horn, `foldPathAxes`).
 */
export const FOLD_PATH_GRID_STEPS_IN = [5, 10, 20, 25, 50, 100] as const;
export const FOLD_AREA_GRID_STEPS_IN2 = [25, 50, 100, 200, 250, 500, 1000] as const;

/** The most gridlines the folded-horn path chart draws on each axis. */
export const FOLD_CHART_MAX_LINES = 8;
