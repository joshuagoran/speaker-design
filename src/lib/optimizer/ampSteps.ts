// Turning an amp down in its slider's steps, for both optimizers: a band that runs out first caps the design's level,
// and the amp of the band below comes down until it keeps up. Each engine keeps its own sliders' steps and minimums.

/** An amp slider's step and its lowest setting, W. */
export interface AmpSteps {
  step: number;
  min: number;
}

/** A power on the slider: floored to its step; null under its minimum. */
export function onSlider(watts: number, s: AmpSteps): number | null {
  const w = Math.floor(watts / s.step) * s.step;
  return w >= s.min ? w : null;
}

/**
 * The power that moves a band `db` from where `watts` puts it (negative: down; an amp moves its band 1 dB per dB of
 * power), on the slider: floored to its step, null under its minimum.
 */
export const ampForGain = (watts: number, db: number, s: AmpSteps): number | null =>
  onSlider(watts * 10 ** (db / 10), s);
