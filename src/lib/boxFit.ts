// A box's width and height kept at least what its parts need: the one rule the sliders, the model, the 3D view and saves
// share (Hi-fi: lib/hifi/boxLayout hifiBoxMin; PA: lib/pa/chips subBoxMin, lib/pa/calc midBoxMin). The size the user
// set is kept as set; the fitted size is worked out from it wherever the box is read.
import type { Dims2, Dims3, SliderSpec } from "../types";

/**
 * A size rounded up to its slider's step (a hair under a step counts as on it), and never under the slider's minimum;
 * a size that isn't a number (a part missing a field) gives the slider's minimum.
 */
export const upToStep = (x: number, s: Pick<SliderSpec, "min" | "step">) =>
  Number.isFinite(x) ? Math.max(s.min, Math.ceil(x / s.step - 1e-9) * s.step) : s.min;

/** The width and height sliders' minimums for a box whose parts need `need`: each up to its step. */
export const boxSliderMins = (
  need: Dims2,
  sliders: { w: Pick<SliderSpec, "min" | "step">; h: Pick<SliderSpec, "min" | "step"> },
): Dims2 => ({ w: upToStep(need.w, sliders.w), h: upToStep(need.h, sliders.h) });

/**
 * `dims` with its width and height raised to `mins` where under them; the same object when it already fits (a minimum
 * that isn't a number leaves its side alone).
 */
export function fitBox<D extends Dims3>(dims: D, mins: Dims2): D {
  const short = (v: number, min: number) => v < min;
  if (!short(dims.w, mins.w) && !short(dims.h, mins.h)) return dims;
  return {
    ...dims,
    w: short(dims.w, mins.w) ? mins.w : dims.w,
    h: short(dims.h, mins.h) ? mins.h : dims.h,
  };
}
