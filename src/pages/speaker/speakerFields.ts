// What the Speaker page's settings share: how a size or position shows.
import { onStep } from "../../lib/speaker/optimize/space";

/**
 * A size or position in inches as a field shows it, or any value a field shows to the hundredth (a horn's lengths and
 * throat chamber): no float noise such as 7.420000000000002.
 */
export const shownIn = (v: number) => Math.round(v * 100) / 100;

/**
 * A stepped field's shown value and its step, together: the value on the step (as the optimizer builds it, `onStep`),
 * so the field's arrows step from what it shows.
 */
export const onFieldStep = (v: number, step: number) => ({ value: shownIn(onStep(v, step)), step });

/** A value as a field shows it to the tenth (a horn's areas, a chamber's net air): no float noise. */
export const shownTenth = (v: number) => Math.round(v * 10) / 10;
