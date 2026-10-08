// A box's width and height kept at least what its parts need: the one rule the sliders, the stored size, the model and
// the 3D view share (Hi-fi: lib/hifi/boxLayout hifiBoxMin; PA: lib/pa/chips subBoxMin, lib/pa/calc midBoxMin).
import type { Dims2, Dims3 } from "../types";

/** A slider's range and step, inches. */
export interface BoxSlider {
  min: number;
  max: number;
  step: number;
}

/** A size rounded up to its slider's step (a hair under a step counts as on it), and never under the slider's minimum. */
export const upToSliderStep = (x: number, s: Pick<BoxSlider, "min" | "step">) =>
  Math.max(s.min, Math.ceil(x / s.step - 1e-9) * s.step);

/** The width and height sliders' minimums for a box whose parts need `need`: each up to its step. */
export const boxSliderMins = (
  need: Dims2,
  sliders: { w: Pick<BoxSlider, "min" | "step">; h: Pick<BoxSlider, "min" | "step"> },
): Dims2 => ({ w: upToSliderStep(need.w, sliders.w), h: upToSliderStep(need.h, sliders.h) });

/** `dims` with its width and height raised to `mins` where under them; the same object when it already fits. */
export function fitBox<D extends Dims3>(dims: D, mins: Dims2): D {
  if (dims.w >= mins.w && dims.h >= mins.h) return dims;
  return { ...dims, w: Math.max(dims.w, mins.w), h: Math.max(dims.h, mins.h) };
}
