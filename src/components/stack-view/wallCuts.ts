// Openings in a chamber's top or bottom wall (a drawn horn's mouth or vent on those walls): where they are, and the pieces
// a panel is built from so the opening is clear (a real hole, as the baffle's and the back's are). Pure; no WebGL.

/**
 * An opening across part of the top or the bottom wall: from `x0` to `x1` across (the shell group's x), and from
 * `fromIn` to `toIn` back from the baffle's inside face, in.
 */
export interface WallOpening {
  x0: number;
  x1: number;
  fromIn: number;
  toIn: number;
}

/** The openings in a shell's top and bottom walls. */
export interface WallOpenings {
  top: readonly WallOpening[];
  bottom: readonly WallOpening[];
}

/** No openings. */
export const NO_WALL_OPENINGS: WallOpenings = { top: [], bottom: [] };

/** A rectangle in a horizontal panel: `x0` to `x1` across, `z0` to `z1` front to back (z up toward the front). */
export interface PanelRect {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}

/** The opening as a rectangle, where the baffle's inside face is at `innerZ`. */
export const openingRect = (innerZ: number, o: WallOpening): PanelRect => ({
  x0: o.x0,
  x1: o.x1,
  z0: innerZ - Math.max(o.fromIn, o.toIn),
  z1: innerZ - Math.min(o.fromIn, o.toIn),
});

/** Two numbers closer than this are one place, in. */
const SAME_IN = 1e-6;

/**
 * The rectangles a panel is built from with `cuts` taken out of it: the panel cut into slabs front to back at each
 * cut's ends, each slab without the cuts across it. Slabs of the same pieces join. The cuts keep inside the panel; one
 * outside it leaves the panel as it is.
 */
export function panelPieces(panel: PanelRect, cuts: readonly PanelRect[]): PanelRect[] {
  const clipped = cuts
    .map((c) => ({
      x0: Math.max(panel.x0, c.x0),
      x1: Math.min(panel.x1, c.x1),
      z0: Math.max(panel.z0, c.z0),
      z1: Math.min(panel.z1, c.z1),
    }))
    .filter((c) => c.x1 - c.x0 > SAME_IN && c.z1 - c.z0 > SAME_IN);
  const stops = [...new Set([panel.z0, panel.z1, ...clipped.flatMap((c) => [c.z0, c.z1])])].sort(
    (p, q) => p - q,
  );
  const slabs: PanelRect[] = [];
  for (let k = 0; k + 1 < stops.length; k++) {
    const [z0, z1] = [stops[k], stops[k + 1]];
    if (z1 - z0 <= SAME_IN) continue;
    // the cuts across this slab, left to right
    const across = clipped
      .filter((c) => c.z0 <= z0 + SAME_IN && c.z1 >= z1 - SAME_IN)
      .sort((p, q) => p.x0 - q.x0);
    let x = panel.x0;
    for (const c of across) {
      if (c.x0 - x > SAME_IN) slabs.push({ x0: x, x1: c.x0, z0, z1 });
      x = Math.max(x, c.x1);
    }
    if (panel.x1 - x > SAME_IN) slabs.push({ x0: x, x1: panel.x1, z0, z1 });
  }
  // slabs with the same across-range, one behind the other, are one piece
  const joined: PanelRect[] = [];
  for (const s of slabs) {
    const same = joined.find(
      (j) =>
        Math.abs(j.x0 - s.x0) < SAME_IN &&
        Math.abs(j.x1 - s.x1) < SAME_IN &&
        Math.abs(j.z1 - s.z0) < SAME_IN,
    );
    if (same) same.z1 = s.z1;
    else joined.push({ ...s });
  }
  return joined;
}
