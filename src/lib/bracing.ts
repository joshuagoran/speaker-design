// Bracing by rule, for any box (lib/pa/bracing lays out the PA boxes' panels; the Hi-fi page reads the plate model).
//
// The plate: each panel, and each bay of it between supports, is a thin (Kirchhoff) plate SIMPLY SUPPORTED on all four
// edges. Glued edges sit between simply supported and clamped (a clamped square's first mode is 1.82 × the simply
// supported one's, 36 against 19.74 in Leissa's tables), so this reads low: the safe side for a rule that adds braces.
// Its first mode (m = n = 1) is Leissa's orthotropic rectangular plate,
//     ω² ρh = π⁴ [D₁/a⁴ + 2H/(a²b²) + D₂/b⁴],
// (A. W. Leissa, "Vibration of Plates", NASA SP-160, 1969, §11.2), with Huber's approximation H = √(D₁D₂) for plywood
// (M. T. Huber, 1923; as in S. G. Lekhnitskii, "Anisotropic Plates", 1968), which makes it a square:
//     f₁₁ = (π/2) (√D₁/a² + √D₂/b²) / √(ρh),    Dᵢ = Eᵢh³ / (12(1 − ν²)).
// An isotropic panel (MDF, E₁ = E₂) gives the familiar f₁₁ = (π/2) √(D/ρh) (1/a² + 1/b²). The weaker modulus is taken
// across the shorter span (the span that sets the mode), so the face grain's direction on the box never reads high.
// ρh is the panel's weight per area from the catalogue (data/catalog/plywood), the same number the box weights use.
// Holes (the driver's cutout), the duct's own stiffness and the air load are left out. No finite elements.
//
// A window brace or a rib holds the panel in a line: a support like an edge. A window brace (a frame across the box
// with its centre cut out, rails WINDOW_RAIL_IN wide) is stiff in its plane and holds the four walls it touches. A rib
// (a strip of the panel's stock glued on edge, RIB_DEPTH_IN deep) is a beam: its own first mode, simply supported over
// the bay it bridges and carrying its share of the panel, f = (π/2) √(EI/μ) / L², is checked against the target too,
// and the panel reads the lower of the two.
import type {
  BoxAxis,
  BoxBracing,
  BracePanel,
  BracePanelId,
  BraceStyleId,
  PanelResonance,
  PanelRibs,
  PanelStock,
} from "../types";

const IN_M = 0.0254;
/** lb/ft² to kg/m² */
const LB_FT2_KG_M2 = 0.45359237 / 0.09290304;

/**
 * Birch plywood's bending moduli, Pa: the mean values for 18 mm, 13-ply WISA birch plywood, along and across the face
 * grain (UPM, WISA-Form Birch technical fact sheet: EₘII 10 048 N/mm², Eₘ⊥ 7 452 N/mm², tested to EN 310). Thinner
 * birch ply is a little stiffer along the grain and a little softer across it; the same pair stands for both. Poisson's
 * ratio is left out: the two cross-ply ratios' product is well under 0.01.
 */
export const BIRCH_PLY_STIFFNESS: Pick<PanelStock, "eStrong" | "eWeak" | "nu"> = {
  eStrong: 10.048e9,
  eWeak: 7.452e9,
  nu: 0,
};
/**
 * MDF's bending modulus, Pa: EN 622-5's least for general-purpose MDF 12–19 mm thick (2 200 N/mm², tested to EN 310);
 * boards on sale are often stiffer, so this reads low. No grain: the same both ways. Poisson's ratio 0.25.
 */
export const MDF_STIFFNESS: Pick<PanelStock, "eStrong" | "eWeak" | "nu"> = {
  eStrong: 2.2e9,
  eWeak: 2.2e9,
  nu: 0.25,
};

/** A window brace's rails, inches: the frame left round the cut-out centre. */
export const WINDOW_RAIL_IN = 2;
/** A rib's depth off the panel, inches; its width is the panel's stock. */
export const RIB_DEPTH_IN = 2.5;
/** The narrowest bay a window brace or rib may leave, inches (room to glue and clamp it). */
export const MIN_BAY_IN = 4;
/** The most braces and ribs the rule adds to one box. */
const MAX_BRACE_STEPS = 40;
/** The ribs' default stock reaches this thick, inches (⅝″ / 15 mm and thinner); thicker walls default to window braces. */
export const RIB_DEFAULT_MAX_IN = 0.625;

/** The style a wall takes when none is chosen: ribs for ⅝″ / 15 mm and thinner, window braces for thicker. */
export const defaultBraceStyle = (t: number): BraceStyleId =>
  t <= RIB_DEFAULT_MAX_IN + 1e-9 ? "ribs" : "window";

/** The first mode of a simply supported thin plate `a` × `b` inches, Hz (the header's formula). */
export function plateFirstModeHz(a: number, b: number, s: PanelStock): number {
  const long = Math.max(a, b) * IN_M,
    short = Math.min(a, b) * IN_M,
    h = s.t * IN_M;
  const k = h ** 3 / (12 * (1 - s.nu * s.nu));
  const rhoH = s.lbPerSqFt * LB_FT2_KG_M2;
  return (
    ((Math.PI / 2) * (Math.sqrt(s.eStrong * k) / long ** 2 + Math.sqrt(s.eWeak * k) / short ** 2)) /
    Math.sqrt(rhoH)
  );
}

/**
 * A rib's first mode as a beam simply supported over `span` inches, carrying `tributary` inches of the panel beside it,
 * Hz: the rib alone (no help from the panel as a flange, so it reads low), at the stock's weaker modulus.
 */
export function ribFirstModeHz(span: number, tributary: number, s: PanelStock): number {
  const w = s.t * IN_M,
    d = RIB_DEPTH_IN * IN_M,
    L = span * IN_M;
  const kgM2 = s.lbPerSqFt * LB_FT2_KG_M2;
  const mu = kgM2 * d + kgM2 * tributary * IN_M; // the rib's own mass and the panel strip it carries, kg/m
  return ((Math.PI / 2) * Math.sqrt((s.eWeak * w * d ** 3) / 12 / mu)) / L ** 2;
}

const EPS = 1e-6;
/** The widest gap along `span` between its ends and the points inside it. */
function widestGap(span: number, pts: readonly number[]) {
  const s = pts.filter((p) => p > EPS && p < span - EPS).sort((a, b) => a - b);
  let prev = 0,
    most = 0;
  for (const p of s) {
    most = Math.max(most, p - prev);
    prev = p;
  }
  return Math.max(most, span - prev);
}
/**
 * `n` ribs placed among the existing supports `fixed` along `span`: each goes to the gap whose bays are widest, so the
 * widest bay is as narrow as it can be; within a gap they are evenly spaced. Returns their positions and the narrowest
 * bay they leave.
 */
function fillGaps(span: number, fixed: readonly number[], n: number) {
  const s = [0, ...fixed.filter((p) => p > EPS && p < span - EPS).sort((a, b) => a - b), span];
  const gaps = s.slice(1).map((p, i) => ({ a: s[i], len: p - s[i], k: 0 }));
  for (let j = 0; j < n; j++) {
    let best = gaps[0];
    for (const g of gaps) if (g.len / (g.k + 1) > best.len / (best.k + 1)) best = g;
    best.k++;
  }
  const at: number[] = [];
  let narrowest = Infinity;
  for (const g of gaps)
    if (g.k) {
      narrowest = Math.min(narrowest, g.len / (g.k + 1));
      for (let i = 1; i <= g.k; i++) at.push(g.a + (i * g.len) / (g.k + 1));
    }
  return { at, narrowest };
}
/** `n` window braces evenly across an axis `L` long. */
const evenly = (L: number, n: number) =>
  Array.from({ length: n }, (_, i) => ((i + 1) * L) / (n + 1));

/** What `braceBox` takes: the box's inside spans, its panels, the target, the style and the window braces' stock. */
export interface BraceBoxInput {
  inner: Record<BoxAxis, number>;
  panels: readonly BracePanel[];
  targetHz: number;
  style: BraceStyleId;
  braceStock: PanelStock;
}
type RibState = Partial<Record<BracePanelId, { across: BoxAxis; n: number }>>;
const AXES: readonly BoxAxis[] = ["x", "y", "z"];

/**
 * The braces a box takes by rule, one at a time, until every panel's first resonance clears `targetHz` (or nothing more
 * fits or helps). Each step adds the window brace or rib that most cuts the panels' summed shortfall under the target
 * per inch³ of wood. By style:
 * - window: window braces only;
 * - ribs: ribs on the panels that take them, after the window braces the baffle needs (a rib can't cross the driver);
 * - both: window braces and ribs side by side, whichever does more for the wood.
 * A window brace goes evenly across its axis; ribs fill a panel's widest bays between the supports it already has (the
 * box's own duct parts, `fixedU` / `fixedV`, and the window braces), so none goes where a part already holds it.
 */
export function braceBox({
  inner,
  panels,
  targetHz,
  style,
  braceStock,
}: BraceBoxInput): BoxBracing {
  const windows: Record<BoxAxis, number> = { x: 0, y: 0, z: 0 };
  const ribs: RibState = {};
  const winAt = (a: BoxAxis, n = windows[a]) => evenly(inner[a], n);
  const onPanel = (p: BracePanel, axis: BoxAxis, n: number, off: number, span: number) =>
    winAt(axis, n)
      .map((x) => x - off)
      .filter((x) => x > EPS && x < span - EPS);

  const evalPanel = (p: BracePanel, w: Record<BoxAxis, number>, r: RibState) => {
    const supU = [...p.fixedU, ...onPanel(p, p.u, w[p.u], p.offU, p.spanU)],
      supV = [...p.fixedV, ...onPanel(p, p.v, w[p.v], p.offV, p.spanV)];
    const rib = r[p.id];
    const ribU = rib && rib.across === p.u ? fillGaps(p.spanU, supU, rib.n).at : [],
      ribV = rib && rib.across === p.v ? fillGaps(p.spanV, supV, rib.n).at : [];
    const gu = widestGap(p.spanU, [...supU, ...ribU]),
      gv = widestGap(p.spanV, [...supV, ...ribV]);
    let hz = plateFirstModeHz(gu, gv, p.stock);
    // a rib bridges the widest bay of the supports that cross it, carrying the widest bay of panel beside it
    if (ribU.length) hz = Math.min(hz, ribFirstModeHz(widestGap(p.spanV, supV), gu, p.stock));
    if (ribV.length) hz = Math.min(hz, ribFirstModeHz(widestGap(p.spanU, supU), gv, p.stock));
    return hz;
  };

  // a window brace's rails across the two other axes, in³
  const windowWood = (a: BoxAxis) => {
    const [P, Q] = AXES.filter((b) => b !== a).map((b) => inner[b]);
    const R = WINDOW_RAIL_IN;
    return (P * Q - Math.max(0, P - 2 * R) * Math.max(0, Q - 2 * R)) * braceStock.t;
  };
  const ribLen = (p: BracePanel, across: BoxAxis) => (across === p.u ? p.spanV : p.spanU);
  const ribWood = (p: BracePanel, across: BoxAxis) => p.stock.t * RIB_DEPTH_IN * ribLen(p, across);

  type Move = { kind: "window"; axis: BoxAxis } | { kind: "rib"; p: BracePanel; across: BoxAxis };
  const windowMoves = (scope: readonly BracePanel[]): Move[] =>
    AXES.filter(
      (a) =>
        scope.some((p) => p.u === a || p.v === a) &&
        inner[a] / (windows[a] + 2) >= MIN_BAY_IN - EPS,
    ).map((axis) => ({ kind: "window", axis }));
  const ribMoves = (): Move[] =>
    panels.flatMap((p) =>
      !p.ribs
        ? []
        : [p.u, p.v]
            .filter((across) => {
              const cur = ribs[p.id];
              if (cur && cur.across !== across) return false;
              const span = across === p.u ? p.spanU : p.spanV,
                off = across === p.u ? p.offU : p.offV;
              const fixed = [
                ...(across === p.u ? p.fixedU : p.fixedV),
                ...onPanel(p, across, windows[across], off, span),
              ];
              return fillGaps(span, fixed, (cur?.n ?? 0) + 1).narrowest >= MIN_BAY_IN - EPS;
            })
            .map((across): Move => ({ kind: "rib", p, across })),
    );
  const apply = (m: Move, w: Record<BoxAxis, number>, r: RibState) => {
    if (m.kind === "window") w[m.axis]++;
    else r[m.p.id] = { across: m.across, n: (r[m.p.id]?.n ?? 0) + 1 };
  };
  const short = (hz: number) => Math.max(0, 1 - hz / targetHz);
  const touches = (m: Move, p: BracePanel) =>
    m.kind === "window" ? p.u === m.axis || p.v === m.axis : m.p === p;
  const phase = (moves: () => Move[], scope: readonly BracePanel[]) => {
    for (let step = 0; step < MAX_BRACE_STEPS; step++) {
      // each panel's resonance now; a move changes only the panels it touches
      const now = scope.map((p) => evalPanel(p, windows, ribs));
      if (now.every((hz) => short(hz) <= 0)) return;
      let best: Move | null = null,
        bestRate = 0;
      for (const m of moves()) {
        const w = { ...windows },
          r: RibState = { ...ribs };
        apply(m, w, r);
        let gain = 0;
        scope.forEach((p, i) => {
          if (touches(m, p)) gain += short(now[i]) - short(evalPanel(p, w, r));
        });
        const rate = gain / (m.kind === "window" ? windowWood(m.axis) : ribWood(m.p, m.across));
        if (gain > 1e-12 && rate > bestRate) {
          best = m;
          bestRate = rate;
        }
      }
      if (!best) return;
      apply(best, windows, ribs);
    }
  };
  if (style === "window") phase(() => windowMoves(panels), panels);
  else if (style === "ribs") {
    const unribbed = panels.filter((p) => !p.ribs);
    phase(() => windowMoves(unribbed), unribbed);
    phase(ribMoves, panels);
  } else phase(() => [...windowMoves(panels), ...ribMoves()], panels);

  const none = { x: 0, y: 0, z: 0 };
  const res: PanelResonance[] = panels.map((p) => ({
    id: p.id,
    bareHz: evalPanel(p, none, {}),
    hz: evalPanel(p, windows, ribs),
  }));
  const ribList: PanelRibs[] = panels.flatMap((p) => {
    const r = ribs[p.id];
    if (!r) return [];
    const span = r.across === p.u ? p.spanU : p.spanV,
      off = r.across === p.u ? p.offU : p.offV;
    const fixed = [
      ...(r.across === p.u ? p.fixedU : p.fixedV),
      ...onPanel(p, r.across, windows[r.across], off, span),
    ];
    return [
      {
        panel: p.id,
        across: r.across,
        at: fillGaps(span, fixed, r.n).at,
        len: ribLen(p, r.across),
      },
    ];
  });
  return {
    style,
    targetHz,
    windows: { x: winAt("x"), y: winAt("y"), z: winAt("z") },
    ribs: ribList,
    panels: res,
    windowIn3: AXES.reduce((a, ax) => a + windows[ax] * windowWood(ax), 0),
    ribIn3: ribList.reduce((a, r) => {
      const p = panels.find((q) => q.id === r.panel);
      return a + (p ? p.stock.t * RIB_DEPTH_IN * r.len * r.at.length : 0);
    }, 0),
    meets: res.every((p) => p.hz >= targetHz - 1e-9),
  };
}
