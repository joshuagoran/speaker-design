// Turning an amp down in its slider's steps, for both optimizers: a band that runs out first caps the design's level,
// and the amp of the band below comes down until it keeps up. Each engine keeps its own sliders' steps and minimums.

/** An amp slider's step and its lowest setting, W. */
export interface AmpSteps {
  step: number;
  min: number;
}
