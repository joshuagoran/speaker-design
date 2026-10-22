// PA stack dispersion: sub, mid and horn stacked vertically, each through its LR24/LR48 crossover filters, with
// its own directivity (sub and mid as pistons, the horn as constant coverage above its control frequency)
// and its path length to the listener. The DSP is time-aligned on the horn axis at the listening distance,
// so the map shows lobing at the crossovers (vertical) and beaming (horizontal). Bands are level-matched.
import { mouthGain, mouthPlane, pistonDirectivity, waveguideDirectivity } from "./directivity";
import type { CoveragePattern } from "./coverage";

/**
 * A source's directivity (pressure, 1 on axis) at `th` radians off its horizontal axis and `tv` above it: a horn as a
 * waveguide, a horn's mouth plane by plane (`mouthGain`), a piston by its total off-axis angle. The PA stack's sources
 * and the Speaker and Stack pages' share it.
 */
export function patternDirectivity(p: CoveragePattern, f: number, th: number, tv: number): number {
  if (p.horn)
    return waveguideDirectivity(f, p.horn.covH, p.horn.covV, p.horn.wIn, p.horn.hIn, th, tv);
  if (p.mouth) {
    const { wIn, hIn, wallH, wallV } = p.mouth;
    return mouthGain(th, tv, [mouthPlane(f, wIn, wallH), mouthPlane(f, hIn, wallV)]);
  }
  return pistonDirectivity(f, p.a, Math.acos(Math.cos(th) * Math.cos(tv)));
}
