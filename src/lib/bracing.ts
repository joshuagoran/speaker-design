// Bracing by rule, for any box (lib/pa/bracing lays out the PA boxes' panels; the Hi-fi page reads the plate model).
//
// The plate: each panel, and each bay of it between supports, is a thin (Kirchhoff) plate. Hinged (simply supported)
// on all four edges, its first mode (m = n = 1) is the orthotropic rectangular plate's,
//     ω² ρh = π⁴ [D₁/a⁴ + 2H/(a²b²) + D₂/b⁴]
// (A. W. Leissa, "Vibration of Plates", NASA SP-160, 1969, the chapter on anisotropic plates), with Huber's
// approximation H = √(D₁D₂) for plywood (M. T. Huber, 1923; as in S. G. Lekhnitskii, "Anisotropic Plates", 1968),
// which makes the bracket a square:
//     f₁₁ = (π/2) (√D₁/a² + √D₂/b²) / √(ρh),    Dᵢ = Eᵢh³ / (12(1 − ν²)).
// An isotropic panel (MDF, E₁ = E₂) gives the familiar f₁₁ = (π/2) √(D/ρh) (1/a² + 1/b²). The weaker modulus is taken
// across the shorter span (the span that sets the mode), so the face grain's direction on the box never reads high.
// ρh is the panel's weight per area from the catalog (lib/panel), the same number the box weights use.
// A glued edge sits between hinged and clamped (a clamped square's first mode is 1.82 × the hinged one's, 36 against
// 19.74 in Leissa's tables): the panel glued on across the joint bends with the edge and holds it as a rotational
// spring (EDGE_FIXITY, a low estimate), so each bay's edges on the box's joints take their neighbors' springs, and its
// edges on a rib, a brace or a duct part stay hinged (baysHz; lib/plateModes works the modes out). A screwed back's
// joints hold nothing. The driver's cutout is cut out of the baffle's bay round it; the duct's own stiffness and the
// air load are left out. No finite elements.
//
// A window brace or a rib holds the panel in a line: a support like an edge. Each is also a beam, and its own first
// mode is checked against the target too: a rib (a strip of the panel's stock glued on edge, RIB_DEPTH_IN deep), and
// each rail of a window brace (a frame across the box with its center cut out, rails WINDOW_RAIL_IN wide, one along
// each wall it touches), over the bay it bridges and carrying its share of the panel, f = (π/2) √(EI/μ) / L² hinged.
// The glued panel beside it works with it as a flange, so EI is the T section's (Eurocode 5's effective flange width,
// the parallel-axis theorem: teeBeam, ribFirstModeHz). A strip's end is held where it meets one on the next panel in
// the corner (RING_FIXITY): a frame's rails always, ribs when the next panel's ribs stand on the same lines (a ring).
// The panel reads the lowest of its bays and its strips, and never under its bare plate.
//
// No brace or rib goes through the driver, the vent or the hardware: the box's keep-out (BoxKeepOut) holds the
// driver's basket and magnet with a clearance, the vent's parts and air, and the recesses of the handles, the input
// dish and the horn posts (a rib glued over a handle's hole would block it), so ribs move off a recess as they move
// off the driver, either way across the panel. A window brace goes where its frame clears them all, nearest
// the even spacing; one across x whose plane crosses the driver leaves its front rail out round it (the frame opens to
// the baffle), so it holds the top, bottom and back but not the baffle. A rib must clear them over its whole run, or
// stop at a duct part that holds the panel (a slot's shelf), or stop short of one, at most RIB_FREE_END_IN short of
// the edge or part it would reach (behind the driver's basket ring); a rib that stops short still counts as a line
// across the whole panel, a little high for the bays at its free end. A panel nothing can reach is reported under the
// target.
import type {
  BoxAxis,
  BoxBracing,
  BoxKeepOut,
  BoxRegion,
  BracePanel,
  BracePanelId,
  BracePlan,
  BraceStyleId,
  EdgeHold,
  PanelNominal,
  PanelResonance,
  PanelRibs,
  PlateStock,
} from "../types";
import { panelNominalNear } from "./panel";
import { beamHz, holedPlateHz, restrainedPlateHz } from "./plateModes";

const IN_M = 0.0254;
/** lb/ft² to kg/m² */
const LB_FT2_KG_M2 = 0.45359237 / 0.09290304;

/**
 * Birch plywood's bending moduli, Pa: the mean values UPM gives for 18 mm, 13-ply WISA birch plywood at 10 ± 2 %
 * moisture, with the face grain along and across the span (WISA-Form Birch technical fact sheet, 01/2015, "Design
 * Data": EₘII 10 048 N/mm², Eₘ⊥ 7 452 N/mm²; the sheet doesn't name the test, which for plywood bending is EN 310).
 * Its 21 mm, 15-ply row (9 858 / 7 642) shows the trend: thinner birch ply is a little stiffer along the grain and a
 * little softer across it; the same pair stands for every thickness. Poisson's ratio is left out: the two cross-ply
 * ratios' product is well under 0.01.
 */
export const BIRCH_PLY_STIFFNESS: Pick<PlateStock, "eStrong" | "eWeak" | "nu"> = {
  eStrong: 10.048e9,
  eWeak: 7.452e9,
  nu: 0,
};
/**
 * MDF's bending modulus, Pa: EN 622-5's least for general-purpose MDF (type MDF, dry) over 12 to 19 mm thick
 * (2 200 N/mm², tested to EN 310); boards on sale are stiffer (EGGER's MDF-ST data sheet gives over 2 700 N/mm² at
 * 12–19 mm), so this reads low. No grain: the same both ways. Poisson's ratio 0.25.
 */
export const MDF_STIFFNESS: Pick<PlateStock, "eStrong" | "eWeak" | "nu"> = {
  eStrong: 2.2e9,
  eWeak: 2.2e9,
  nu: 0.25,
};

/** A window brace's rails, inches: the frame left round the cut-out center. */
export const WINDOW_RAIL_IN = 2;
/** A rib's depth off the panel, inches; its width is the panel's stock. */
export const RIB_DEPTH_IN = 2.5;
/**
 * The farthest a rib may stop short of the edge or duct part its run would reach, to clear the keep-out (the driver's
 * basket ring beside a side), inches; its end there is free.
 */
export const RIB_FREE_END_IN = 4;
/** The narrowest bay a window brace or rib may leave, inches (room to glue and clamp it). */
export const MIN_BAY_IN = 4;
/** The most moves the rule makes on one box. */
const MAX_BRACE_STEPS = 40;
/**
 * The most ribs one move adds to a panel: a single rib can ring lower than the bare panel (it carries a wide strip of
 * panel), where several ring higher, so the rule weighs adding a few at once.
 */
const RIB_BATCH_MAX = 8;
/** The nominal sizes whose walls default to ribs (⅝″ / 15 mm and ½″ / 12 mm); thicker walls default to window braces. */
export const RIB_DEFAULT_NOMINALS: readonly PanelNominal[] = ["5/8", "1/2"];

/** The style a wall takes when none is chosen, by its nominal size (`RIB_DEFAULT_NOMINALS`). */
export const defaultBraceStyle = (n: PanelNominal): BraceStyleId =>
  RIB_DEFAULT_NOMINALS.includes(n) ? "ribs" : "window";
/**
 * The default for a wall known only by its thickness: the nominal size nearest it. Where the size is known (the page,
 * a saved design, an optimizer's plywood), defaultBraceStyle takes it: a measured ¾″ sheet can sit nearer ⅝″.
 */
export const defaultBraceStyleNear = (t: number) => defaultBraceStyle(panelNominalNear(t));

/** The first mode of a simply supported thin plate `a` × `b` inches, Hz (the header's formula). */
export function plateFirstModeHz(a: number, b: number, s: PlateStock): number {
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
 * The panel either side of a rib that works with it as a flange, as shares of the rib's span and of the panel's
 * thickness: EN 1995-1-1:2004 (Eurocode 5) §9.1.2, the effective flange width of glued thin-flanged beams, whose
 * flanges are plywood glued to the webs as a panel is to its rib. For a flange both sides of the web (an I or a T),
 * b_ef = b_w + b_ef,c, with b_ef,c (both sides together) no more than Table 9.1's values for plywood with its face grain
 * along the webs: 0.1 l for shear lag (l the span) and 20 h_f for plate buckling (h_f the flange's thickness, the panel's
 * measured one). Never more than the clear bay beside the rib either. The "12 to 16 thicknesses" rules of thumb come
 * from concrete and steel (ACI 318-19 §6.3.2.1's 8 h each side, EN 1993-1-5 §9.1's 15 εt each side), stiffer in shear
 * against their bending modulus than plywood; plywood's low in-plane shear modulus is what holds Table 9.1's shear-lag
 * share down to a tenth of the span, which sets the flange on a box's short ribs.
 */
export const RIB_FLANGE_SPAN_SHARE = 0.1;
export const RIB_FLANGE_THICKNESSES = 20;

/** A rib's effective flange (the rib's own width and the panel working with it), in: Eurocode 5's rule above. */
export const ribFlangeIn = (span: number, bay: number, t: number) =>
  t + Math.max(0, Math.min(RIB_FLANGE_SPAN_SHARE * span, RIB_FLANGE_THICKNESSES * t, bay - t));

/**
 * The second moment of area of a rib glued on edge with its flange (a T: the flange `b` wide and `h` thick, the rib
 * `w` wide standing `d` off it), about their joint centroid by the parallel-axis theorem, in the units given.
 */
export function teeSecondMoment(b: number, h: number, w: number, d: number) {
  const af = b * h,
    aw = w * d;
  const yf = h / 2,
    yw = h + d / 2;
  const y = (af * yf + aw * yw) / (af + aw);
  return (b * h ** 3) / 12 + af * (y - yf) ** 2 + (w * d ** 3) / 12 + aw * (yw - y) ** 2;
}

/**
 * A rib's first mode as a beam simply supported over `span` inches, carrying `tributary` inches of the panel beside it,
 * Hz: f = (π/2) √(EI/μ) / L², the rib and its effective flange of panel (ribFlangeIn) as one T section
 * (teeSecondMoment), at the stock's weaker modulus for both (plywood's in-plane stiffness either way of the grain is at
 * least that); μ is the rib's own mass and the whole strip of panel it carries, per length. The rib alone (no flange,
 * I = t·d³/12) reads about half the frequency for a box's ribs: a ¾″ rib 2½″ deep with a 3″ flange is 3.9 × as stiff.
 */
export function ribFirstModeHz(span: number, tributary: number, s: PlateStock): number {
  const { EI, mu } = teeBeam(span, tributary, s, s, RIB_DEPTH_IN);
  return ((Math.PI / 2) * Math.sqrt(EI / mu)) / (span * IN_M) ** 2;
}
/**
 * A strip glued on edge to a panel (a rib, or a window brace's rail): its web of `web` stock standing `depth` in off the
 * panel and the panel's effective flange (ribFlangeIn) as one T section over `span` in, carrying `tributary` in of the
 * panel beside it: its EI (N·m², at the weaker modulus) and its mass per length μ (kg/m), as ribFirstModeHz reads them.
 */
export function teeBeam(
  span: number,
  tributary: number,
  panel: PlateStock,
  web: PlateStock,
  depth: number,
) {
  const w = web.t * IN_M,
    d = depth * IN_M,
    b = ribFlangeIn(span, tributary, panel.t) * IN_M;
  const EI = Math.min(panel.eWeak, web.eWeak) * teeSecondMoment(b, panel.t * IN_M, w, d);
  const mu = web.lbPerSqFt * LB_FT2_KG_M2 * d + panel.lbPerSqFt * LB_FT2_KG_M2 * tributary * IN_M;
  return { EI, mu };
}
/**
 * How far a rib or rail is held against turning where it meets one on the next panel round the same line (a ring of
 * ribs, a window brace's frame): the other bends with it, so it resists as a beam over its span with its far end
 * hinged, 3EI/L (the lower of the textbook end cases, as EDGE_FIXITY). A rib ending on a bare panel's face is left
 * hinged: the panel's bending holds a T section that stiff by under 1 % (worked out for the 18 Sound kit's side ribs).
 */
export const RING_FIXITY = 3;

// ---- the geometry: regions inside a box, and the braces' and ribs' own ----

const EPS = 1e-6;
export const BOX_AXES: readonly BoxAxis[] = ["x", "y", "z"];
type Span = readonly [number, number];

/** Whether two regions share some volume (regions that only touch don't). */
export const regionsOverlap = (a: BoxRegion, b: BoxRegion) =>
  BOX_AXES.every((k) => a[k][0] < b[k][1] - EPS && b[k][0] < a[k][1] - EPS);
/** A region from its spans on three different axes. */
export function regionOf(
  a: BoxAxis,
  sa: Span,
  b: BoxAxis,
  sb: Span,
  c: BoxAxis,
  sc: Span,
): BoxRegion {
  const r: Record<BoxAxis, Span> = { x: sa, y: sa, z: sa };
  r[a] = sa;
  r[b] = sb;
  r[c] = sc;
  return r;
}

/**
 * A window brace's rails across `axis` at `at`, `t` thick: one along each wall it touches, the frame's center cut out.
 * With `notch` (across x only) the front rail, on the baffle, is left out over that span of y.
 */
export function windowRails(
  inner: Record<BoxAxis, number>,
  axis: BoxAxis,
  at: number,
  t: number,
  notch: Span | null = null,
): BoxRegion[] {
  const [P, Q] = BOX_AXES.filter((a) => a !== axis);
  const lp = inner[P],
    lq = inner[Q],
    R = WINDOW_RAIL_IN;
  const across: Span = [at - t / 2, at + t / 2];
  const rail = (p: Span, q: Span) => regionOf(axis, across, P, p, Q, q);
  // across x or y the rail at Q's start (Q is z) lies on the baffle
  const front: Span[] = notch
    ? [
        [0, notch[0]],
        [notch[1], lp],
      ]
    : [[0, lp]];
  return [
    ...front.filter(([a, b]) => b - a > EPS).map((p) => rail(p, [0, R])),
    rail([0, lp], [lq - R, lq]),
    rail([0, R], [R, lq - R]),
    rail([lp - R, lp], [R, lq - R]),
  ];
}
/**
 * A window brace's wood across `axis`, in³: the full frame (a notched brace's front rail is counted whole; its gap,
 * under half a liter, is left in, so the box reads a little small).
 */
export const windowWoodIn3 = (inner: Record<BoxAxis, number>, axis: BoxAxis, t: number) => {
  // the two spans across the axis (written out: the optimizers' brace estimate reads this at every step)
  const P = axis === "x" ? inner.y : inner.x,
    Q = axis === "z" ? inner.y : inner.z;
  const R = WINDOW_RAIL_IN;
  return (P * Q - Math.max(0, P - 2 * R) * Math.max(0, Q - 2 * R)) * t;
};

/** The wall each panel is, as its normal axis and end: ribs stand RIB_DEPTH_IN off it, into the box. */
export const PANEL_NORMAL: Record<BracePanelId, { axis: BoxAxis; far: boolean }> = {
  sideL: { axis: "x", far: false },
  sideR: { axis: "x", far: true },
  top: { axis: "y", far: true },
  bottom: { axis: "y", far: false },
  back: { axis: "z", far: true },
  baffle: { axis: "z", far: false },
};
/** The axis a panel's ribs across `across` run along: neither its normal nor `across`. */
export const ribRunAxis = (panel: BracePanelId, across: BoxAxis): BoxAxis =>
  BOX_AXES.find((a) => a !== PANEL_NORMAL[panel].axis && a !== across) ?? across;
/** One rib's region: on `panel`, across `across` at `at`, from `from` along its run for `len`, `t` thick. */
export function ribRegion(
  inner: Record<BoxAxis, number>,
  r: Pick<PanelRibs, "panel" | "across" | "from" | "len">,
  at: number,
  t: number,
): BoxRegion {
  const n = PANEL_NORMAL[r.panel];
  const off: Span = n.far ? [inner[n.axis] - RIB_DEPTH_IN, inner[n.axis]] : [0, RIB_DEPTH_IN];
  return regionOf(n.axis, off, r.across, [at - t / 2, at + t / 2], ribRunAxis(r.panel, r.across), [
    r.from,
    r.from + r.len,
  ]);
}
/** Every window brace's rails and every rib of a box's bracing, as regions (the 3D view draws these). */
export function bracingRegions(
  b: Pick<BoxBracing, "windows" | "notch" | "ribs">,
  inner: Record<BoxAxis, number>,
  t: number,
): BoxRegion[] {
  const out: BoxRegion[] = [];
  for (const axis of BOX_AXES)
    for (const at of b.windows[axis])
      out.push(
        ...windowRails(
          inner,
          axis,
          at,
          t,
          axis === "x" && b.notch?.at.includes(at) ? b.notch.y : null,
        ),
      );
  for (const r of b.ribs) for (const at of r.at) out.push(ribRegion(inner, r, at, t));
  return out;
}

// ---- spacing ----

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
/** `n` evenly across an axis `L` long: where window braces would go with nothing in the way. */
const evenly = (L: number, n: number) =>
  Array.from({ length: n }, (_, i) => ((i + 1) * L) / (n + 1));
/** [lo, hi] less the blocked spans, as the spans left, in order. */
function clearSpans(lo: number, hi: number, blocked: readonly Span[]): Span[] {
  let out: Span[] = hi >= lo ? [[lo, hi]] : [];
  for (const [b0, b1] of blocked)
    out = out.flatMap(([a, b]): Span[] => {
      if (b1 <= a || b0 >= b) return [[a, b]];
      const keep: Span[] = [];
      if (b0 > a) keep.push([a, b0]);
      if (b1 < b) keep.push([b1, b]);
      return keep;
    });
  return out;
}
/** The point of the spans nearest `p` (itself when inside one). */
const nearestIn = (spans: readonly Span[], p: number) => {
  let best = NaN,
    d = Infinity;
  for (const [a, b] of spans) {
    const q = Math.min(b, Math.max(a, p));
    if (Math.abs(q - p) < d) {
      d = Math.abs(q - p);
      best = q;
    }
  }
  return best;
};

/**
 * How far a glued joint holds a panel's edge against turning: a strip of the panel across the joint, its far edge
 * hinged, resists with 3D/L per unit length (D its bending stiffness at the weaker modulus, L its span away from the
 * joint): the lower of the beam's two textbook end cases (3EI/L far end hinged, 4EI/L fixed), so the spring reads
 * low. The panels' own ribs and braces are left out of that strip, on the same side.
 */
export const EDGE_FIXITY = 3;
/** The spring a glued neighbor gives a panel's edge, N·m/rad per m of edge; 0 where nothing holds it. */
export const edgeSpring = (hold: EdgeHold | undefined) =>
  hold
    ? (EDGE_FIXITY * hold.stock.eWeak * (hold.stock.t * IN_M) ** 3) / 12 / (hold.span * IN_M)
    : 0;
/** The lines dividing a span: its ends and the supports inside it, in order. */
const spanLines = (span: number, pts: readonly number[]) => [
  0,
  ...pts.filter((p) => p > EPS && p < span - EPS).sort((a, b) => a - b),
  span,
];
/**
 * A panel's plate resonance between its supports (`acrossU`, `acrossV`: ribs, braces and duct parts), Hz: the lowest
 * of its bays, each a plate whose edges on the panel's own edges take the glued neighbors' springs (`edges`) and whose
 * edges on a rib, brace or duct part are hinged (bays either side of a support move in turn about it, as a plate
 * continuous over hinged lines does), the bay with the driver's cutout read with it (lib/plateModes).
 */
export function baysHz(
  p: Pick<BracePanel, "spanU" | "spanV" | "stock" | "edges" | "hole">,
  acrossU: readonly number[],
  acrossV: readonly number[],
): number {
  const k = {
    u0: edgeSpring(p.edges?.u0),
    u1: edgeSpring(p.edges?.u1),
    v0: edgeSpring(p.edges?.v0),
    v1: edgeSpring(p.edges?.v1),
  };
  const bays = (lines: number[], k0: number, k1: number) => {
    const seen = new Map<string, { from: number; len: number; k0: number; k1: number }>();
    for (let i = 1; i < lines.length; i++) {
      const b = {
        from: lines[i - 1],
        len: lines[i] - lines[i - 1],
        k0: i === 1 ? k0 : 0,
        k1: i === lines.length - 1 ? k1 : 0,
      };
      // bays alike ring alike: one of each (the hole's bay is told apart by where it starts)
      const key = `${b.len.toFixed(6)}|${b.k0}|${b.k1}${p.hole ? `|${b.from}` : ""}`;
      if (b.len > EPS && !seen.has(key)) seen.set(key, b);
    }
    return [...seen.values()];
  };
  const bu = bays(spanLines(p.spanU, acrossU), k.u0, k.u1),
    bv = bays(spanLines(p.spanV, acrossV), k.v0, k.v1);
  let hz = Infinity;
  for (const a of bu)
    for (const b of bv) {
      const springs = { x0: a.k0, x1: a.k1, y0: b.k0, y1: b.k1 };
      const h = p.hole;
      hz = Math.min(
        hz,
        h && h.cx > a.from && h.cx < a.from + a.len && h.cy > b.from && h.cy < b.from + b.len
          ? holedPlateHz(a.len, b.len, p.stock, springs, {
              ...h,
              cx: h.cx - a.from,
              cy: h.cy - b.from,
            })
          : restrainedPlateHz(a.len, b.len, p.stock, springs),
      );
    }
  return hz;
}

/** The panels a box's bracing leaves under its target, each with its first mode (the UI names the box and words them). */
export const braceShortfalls = (b: Pick<BoxBracing, "panels" | "targetHz">): PanelResonance[] =>
  b.panels.filter((p) => p.hz < b.targetHz - 1e-9);

// ---- the rule ----

/** What `braceBox` takes: the box's inside spans, its panels, the target, the style, the braces' stock, the keep-out. */
export interface BraceBoxInput {
  inner: Record<BoxAxis, number>;
  panels: readonly BracePanel[];
  targetHz: number;
  style: BraceStyleId;
  braceStock: PlateStock;
  keepOut: BoxKeepOut;
}
type RibState = BracePlan["ribs"];
type Counts = BracePlan["windows"];
/** One panel's ribs as placed: where, and the run each takes along the panel's other axis (panel coordinates). */
interface PlacedRibs {
  at: number[];
  runs: Span[];
}
/** Ribs meeting at a corner: the lower one butts into the higher's (sides over top and bottom over back). */
const RING_RANK: Record<BracePanelId, number> = {
  sideL: 3,
  sideR: 3,
  top: 2,
  bottom: 2,
  back: 1,
  baffle: 0,
};
/** The panel at each end of a run along an axis. */
const END_PANEL: Record<BoxAxis, readonly [BracePanelId, BracePanelId]> = {
  x: ["sideL", "sideR"],
  y: ["bottom", "top"],
  z: ["baffle", "back"],
};

/**
 * The braces a box takes by rule, one move at a time, until every panel's first resonance clears `targetHz` (or
 * nothing more fits or helps). Each move adds the window brace, or sets the ribs on one panel (more of the same, or
 * ribs the other way in their place), that most cuts the panels' summed shortfall under the target per inch³ of wood.
 * Window braces and Ribs keep to their own kind; a panel that kind can't lift stays under the target (braceShortfalls
 * lists it). By style:
 * - window: window braces only (none lifts a panel the driver or the vent keeps every frame off);
 * - ribs: ribs only, on the panels that take them (not the baffle: no rib can cross the driver);
 * - both: the window braces the baffle needs first (no rib can hold it, and once ribs stand where a frame would go no
 *   frame fits), then window braces and ribs side by side, whichever does more for the wood.
 * Window braces go where their frames clear the keep-out, nearest the even spacing; ribs fill a panel's widest bays
 * between the supports it already has (the box's own duct parts, `fixedU` / `fixedV`, and the window braces).
 */
export function braceBox({
  inner,
  panels,
  targetHz,
  style,
  braceStock,
  keepOut,
}: BraceBoxInput): BoxBracing {
  const t = braceStock.t;
  const hardware = keepOut.hardware ?? [];
  const keep = [...keepOut.driver, ...keepOut.vent, ...hardware];

  // where window braces can go on each axis: the walls' bays less where their frames would meet the keep-out
  const room = (a: BoxAxis) => {
    const probe = (notch: Span | null) => windowRails(inner, a, 0, t, notch);
    // a frame's rails meet a region when they overlap it off the brace's own axis
    const meets = (rails: BoxRegion[], o: BoxRegion) =>
      rails.some((r) =>
        BOX_AXES.every((k) => k === a || (r[k][0] < o[k][1] - EPS && o[k][0] < r[k][1] - EPS)),
      );
    const blocked: Span[] = [];
    const full = probe(null);
    const block = (o: BoxRegion) => blocked.push([o[a][0] - t / 2, o[a][1] + t / 2]);
    for (const o of [...keepOut.vent, ...hardware]) if (meets(full, o)) block(o);
    let notch: { x: Span; y: Span } | null = null;
    const hit = keepOut.driver.filter((o) => meets(full, o));
    if (hit.length) {
      // across x the frame may open to the baffle round the driver (its front rail left out over the driver's
      // widest span), if its other rails clear every part of it
      const ys = hit.map((o) => o.y),
        xs = hit.map((o) => o.x);
      const y: Span = [Math.min(...ys.map((s) => s[0])), Math.max(...ys.map((s) => s[1]))];
      if (a === "x" && !keepOut.driver.some((o) => meets(probe(y), o)))
        notch = { x: [Math.min(...xs.map((s) => s[0])), Math.max(...xs.map((s) => s[1]))], y };
      else hit.forEach(block);
    }
    blocked.sort((p, q) => p[0] - q[0]);
    return { clear: clearSpans(MIN_BAY_IN, inner[a] - MIN_BAY_IN, blocked), notch };
  };
  const rooms = { x: room("x"), y: room("y"), z: room("z") };
  const notched = (a: BoxAxis, p: number) => {
    const n = rooms.x.notch;
    return a === "x" && !!n && p + t / 2 > n.x[0] + EPS && p - t / 2 < n.x[1] - EPS;
  };
  // `n` window braces across `a`: each nearest its even spot in the clear spans, at least a bay apart; null if not
  const winMemo = new Map<string, number[] | null>();
  const winAt = (a: BoxAxis, n: number): number[] | null => {
    if (n === 0) return [];
    const k = a + n;
    const hit = winMemo.get(k);
    if (hit !== undefined) return hit;
    const { clear } = rooms[a];
    let out: number[] | null = null;
    if (clear.length) {
      const at = evenly(inner[a], n)
        .map((p) => nearestIn(clear, p))
        .sort((p, q) => p - q);
      if (at.every((p, i) => i === 0 || p - at[i - 1] >= MIN_BAY_IN - EPS)) out = at;
    }
    winMemo.set(k, out);
    return out;
  };
  const winOrNone = (a: BoxAxis, n: number) => winAt(a, n) ?? [];
  // the window braces' lines on a panel, in from its edge (a notched brace doesn't hold the baffle)
  const onPanel = (p: BracePanel, axis: BoxAxis, n: number, off: number, span: number) =>
    winOrNone(axis, n)
      .filter((x) => p.id !== "baffle" || !notched(axis, x))
      .map((x) => x - off)
      .filter((x) => x > EPS && x < span - EPS);
  const supportsAcross = (p: BracePanel, axis: BoxAxis, w: Counts) =>
    axis === p.u
      ? [...p.fixedU, ...onPanel(p, p.u, w[p.u], p.offU, p.spanU)]
      : [...p.fixedV, ...onPanel(p, p.v, w[p.v], p.offV, p.spanV)];

  // where a rib on `p` across `across` at `at` can run along the panel's other axis: the whole span when the keep-out
  // leaves it clear, else from (or to) a duct part holding the panel, past the keep-out; null when neither
  // per panel and axis, once: the keep-out boxes a rib's strip off that wall meets somewhere, each as its span across
  // the rib's axis and along its run (panel coordinates), and where a rib may start or end
  const bandMemo = new Map<
    string,
    { L: number; boxes: { across: Span; run: Span }[]; starts: number[]; ends: number[] }
  >();
  const ribBand = (p: BracePanel, across: BoxAxis) => {
    const k = p.id + across;
    const hit = bandMemo.get(k);
    if (hit) return hit;
    const alongU = across === p.u;
    const L = alongU ? p.spanV : p.spanU,
      offA = alongU ? p.offU : p.offV,
      offR = alongU ? p.offV : p.offU;
    const runAxis = ribRunAxis(p.id, across);
    const n = PANEL_NORMAL[p.id];
    const band: Span = n.far ? [inner[n.axis] - RIB_DEPTH_IN, inner[n.axis]] : [0, RIB_DEPTH_IN];
    const boxes = keep
      .filter(
        (o) =>
          o[n.axis][0] < band[1] - EPS &&
          band[0] < o[n.axis][1] - EPS &&
          o[runAxis][0] < offR + L - EPS &&
          offR < o[runAxis][1] - EPS,
      )
      .map((o) => ({
        across: [o[across][0] - offA, o[across][1] - offA] as const,
        run: [o[runAxis][0] - offR, o[runAxis][1] - offR] as const,
      }));
    const sup = alongU ? [...p.fixedV, ...p.stopV] : [...p.fixedU, ...p.stopU];
    const starts = [0, ...sup.map((s) => s + t / 2)],
      ends = [L, ...sup.map((s) => s - t / 2)];
    // or just past a keep-out box, RIB_FREE_END_IN at most from where the rib would have started or ended
    const near = (xs: number[], x: number) =>
      x > EPS && x < L - EPS && xs.some((y) => Math.abs(y - x) <= RIB_FREE_END_IN + EPS);
    const out = {
      L,
      boxes,
      starts: [...starts, ...boxes.map((o) => o.run[1]).filter((x) => near(starts, x))],
      ends: [...ends, ...boxes.map((o) => o.run[0]).filter((x) => near(ends, x))],
    };
    bandMemo.set(k, out);
    return out;
  };
  const ribRun = (p: BracePanel, across: BoxAxis, at: number): Span | null => {
    const { L, boxes, starts, ends } = ribBand(p, across);
    const blocked = boxes
      .filter((o) => o.across[0] < at + t / 2 - EPS && at - t / 2 < o.across[1] - EPS)
      .map((o) => o.run);
    if (!blocked.length) return [0, L];
    let best: Span | null = null;
    for (const a of starts)
      for (const b of ends)
        if (
          b - a > EPS &&
          (!best || b - a > best[1] - best[0]) &&
          blocked.every(([b0, b1]) => b1 <= a + EPS || b0 >= b - EPS)
        )
          best = [a, b];
    return best;
  };
  // where on `p` a rib across `across` can stand (ribRun finds it a run): the spans between the keep-out's edges whose
  // middle it can, so ribs move off the driver and the vent as window braces do
  const ribRoom = new Map<string, Span[]>();
  const ribClear = (p: BracePanel, across: BoxAxis): Span[] => {
    const k = p.id + across;
    const hit = ribRoom.get(k);
    if (hit) return hit;
    const alongU = across === p.u;
    const span = alongU ? p.spanU : p.spanV,
      offA = alongU ? p.offU : p.offV;
    const n = PANEL_NORMAL[p.id];
    const band: Span = n.far ? [inner[n.axis] - RIB_DEPTH_IN, inner[n.axis]] : [0, RIB_DEPTH_IN];
    const cuts = keep
      .filter((o) => o[n.axis][0] < band[1] - EPS && band[0] < o[n.axis][1] - EPS)
      .flatMap((o) => [o[across][0] - offA - t / 2, o[across][1] - offA + t / 2])
      .filter((x) => x > EPS && x < span - EPS);
    const edges = [0, ...cuts.sort((a, b) => a - b), span];
    const out: Span[] = [];
    for (let i = 1; i < edges.length; i++) {
      const [a, b] = [edges[i - 1], edges[i]];
      if (b - a > EPS && ribRun(p, across, (a + b) / 2)) {
        const last = out[out.length - 1];
        if (last && Math.abs(last[1] - a) < EPS) out[out.length - 1] = [last[0], b];
        else out.push([a, b]);
      }
    }
    ribRoom.set(k, out);
    return out;
  };
  // a panel's `n` ribs across `across` with the window braces `w`: each nearest its spot in the panel's widest bays
  // (fillGaps) where it can stand, every bay still MIN_BAY_IN or more; where they go and run, or null if they can't
  const ribMemo = new Map<string, PlacedRibs | null>();
  const ribsAt = (p: BracePanel, across: BoxAxis, n: number, w: Counts): PlacedRibs | null => {
    const k = `${p.id}${across}${n}|${w[across]}`;
    const hit = ribMemo.get(k);
    if (hit !== undefined) return hit;
    const span = across === p.u ? p.spanU : p.spanV;
    const sup = supportsAcross(p, across, w);
    const clear = ribClear(p, across);
    const at = clear.length
      ? fillGaps(span, sup, n)
          .at.map((x) => nearestIn(clear, x))
          .sort((a, b) => a - b)
      : [];
    const lines = [0, span, ...sup.filter((s) => s > EPS && s < span - EPS)];
    const spaced =
      at.length === n &&
      at.every(
        (x, i) =>
          (i === 0 || x - at[i - 1] >= MIN_BAY_IN - EPS) &&
          lines.every((s) => Math.abs(x - s) >= MIN_BAY_IN - EPS),
      );
    const runs: Span[] = [];
    let out: PlacedRibs | null = spaced ? { at, runs } : null;
    for (const x of spaced ? at : []) {
      const r = ribRun(p, across, x);
      if (!r) {
        out = null;
        break;
      }
      runs.push(r);
    }
    ribMemo.set(k, out);
    return out;
  };
  const ribsFit = (w: Counts, r: RibState) =>
    panels.every((p) => {
      const s = r[p.id];
      return !s || ribsAt(p, s.across, s.n, w) !== null;
    });

  const panelById = new Map(panels.map((p) => [p.id, p]));
  const otherAxis = (p: BracePanel, a: BoxAxis) => (a === p.u ? p.v : p.u);
  const spanAcross = (p: BracePanel, a: BoxAxis) => (a === p.u ? p.spanU : p.spanV);
  const offAcross = (p: BracePanel, a: BoxAxis) => (a === p.u ? p.offU : p.offV);
  /**
   * A strip's span between the supports crossing it (`sup` along `L`): its widest gap, and whether that gap reaches
   * the panel's start and end (where a corner may hold it).
   */
  const stripSpan = (L: number, sup: readonly number[]) => {
    const lines = spanLines(L, sup);
    let i = 1;
    for (let j = 2; j < lines.length; j++)
      if (lines[j] - lines[j - 1] > lines[i] - lines[i - 1] + EPS) i = j;
    return { len: lines[i] - lines[i - 1], start: i === 1, end: i === lines.length - 1 };
  };
  // a rib's T on `q` across `a` with the braces `w` and its ribs `n`: its EI over its span, for the corner spring it gives
  const ribStiffness = (q: BracePanel, a: BoxAxis, n: number, w: Counts) => {
    const placed = ribsAt(q, a, n, w);
    if (!placed) return 0;
    const span = stripSpan(
      spanAcross(q, otherAxis(q, a)),
      supportsAcross(q, otherAxis(q, a), w),
    ).len;
    const trib = widestGap(spanAcross(q, a), [...supportsAcross(q, a, w), ...placed.at]);
    return (RING_FIXITY * teeBeam(span, trib, q.stock, q.stock, RIB_DEPTH_IN).EI) / (span * IN_M);
  };
  // the spring at one end of `p`'s rib at `x` (panel coordinates) running from `run`: the next panel's rib on the same
  // line, glued to it in the corner (layRibs butts one into the other), else none
  const ringSpring = (
    p: BracePanel,
    a: BoxAxis,
    x: number,
    run: Span,
    end: 0 | 1,
    w: Counts,
    r: RibState,
  ) => {
    const R = ribRunAxis(p.id, a);
    const L = spanAcross(p, otherAxis(p, a));
    if (end === 0 ? run[0] > EPS : run[1] < L - EPS) return 0;
    const q = panelById.get(END_PANEL[R][end]);
    const s = q && r[q.id];
    if (!q || !s || s.across !== a) return 0;
    const placed = ribsAt(q, a, s.n, w);
    const n = PANEL_NORMAL[p.id];
    const at = offAcross(p, a) + x;
    const meets = placed?.at.some((y, i) => {
      const qr = placed.runs[i],
        qL = spanAcross(q, otherAxis(q, a)),
        qOff = otherAxis(q, a) === q.u ? q.offU : q.offV;
      // the other rib reaches this panel's wall
      const reaches = n.far ? qOff + qr[1] >= inner[n.axis] - EPS : qOff + qr[0] <= EPS;
      return (
        Math.abs(offAcross(q, a) + y - at) < t - EPS && reaches && qr[1] - qr[0] > EPS && qL > EPS
      );
    });
    return meets ? ribStiffness(q, a, s.n, w) : 0;
  };
  // a window brace's rail on `q` across `a`: its EI over its span, for the corner spring it gives the next rail
  const railStiffness = (q: BracePanel, a: BoxAxis, w: Counts) => {
    const span = spanAcross(q, otherAxis(q, a));
    const trib = widestGap(spanAcross(q, a), supportsAcross(q, a, w));
    const { EI } = teeBeam(span, trib, q.stock, braceStock, WINDOW_RAIL_IN);
    return (RING_FIXITY * EI) / (span * IN_M);
  };

  // a panel's resonance depends on the window braces, its own ribs and the ribs of the panels its ribs run into (a
  // ring): each case worked out once
  const evalMemo = new Map<string, number>();
  const ribTag = (r: RibState, id: BracePanelId) => {
    const s = r[id];
    return s ? s.across + s.n : "";
  };
  const evalPanel = (p: BracePanel, w: Counts, r: RibState) => {
    const rib = r[p.id];
    const ends = rib ? END_PANEL[ribRunAxis(p.id, rib.across)].map((id) => ribTag(r, id)) : [];
    const k = `${p.id}|${w.x},${w.y},${w.z}|${ribTag(r, p.id)}|${ends.join()}`;
    const hit = evalMemo.get(k);
    if (hit !== undefined) return hit;
    const hz = panelHz(p, w, r);
    evalMemo.set(k, hz);
    return hz;
  };
  /**
   * A panel's first resonance: the lowest of its bays (baysHz), its ribs as beams and its window braces' rails as
   * beams. A rib or rail bridges the widest gap between the supports that cross it, carrying the widest bay of panel
   * beside it; its ends are held where a rib or rail on the next panel meets it (RING_FIXITY), else hinged.
   */
  const panelHz = (p: BracePanel, w: Counts, r: RibState): number => {
    // a strip adds stiffness for little mass, so no panel reads under its bare plate (the strips' beam check leaves
    // out the plate's own two-way bending beside them, so on its own it can)
    const bare = baysHz(p, p.fixedU, p.fixedV);
    const supU = supportsAcross(p, p.u, w),
      supV = supportsAcross(p, p.v, w);
    const rib = r[p.id];
    const placed = rib ? ribsAt(p, rib.across, rib.n, w) : null;
    const ribU = rib && placed && rib.across === p.u ? placed.at : [],
      ribV = rib && placed && rib.across === p.v ? placed.at : [];
    let hz = baysHz(p, [...supU, ...ribU], [...supV, ...ribV]);
    const gap = (a: BoxAxis) =>
      a === p.u ? widestGap(p.spanU, [...supU, ...ribU]) : widestGap(p.spanV, [...supV, ...ribV]);
    if (rib && placed) {
      const a = rib.across,
        o = otherAxis(p, a);
      const sp = stripSpan(spanAcross(p, o), supportsAcross(p, o, w));
      const trib = gap(a);
      const { EI, mu } = teeBeam(sp.len, trib, p.stock, p.stock, RIB_DEPTH_IN);
      placed.at.forEach((x, i) => {
        const k0 = sp.start ? ringSpring(p, a, x, placed.runs[i], 0, w, r) : 0,
          k1 = sp.end ? ringSpring(p, a, x, placed.runs[i], 1, w, r) : 0;
        hz = Math.min(hz, beamHz(EI, mu, sp.len, k0, k1));
      });
    }
    for (const a of [p.u, p.v]) {
      const rails = onPanel(p, a, w[a], offAcross(p, a), spanAcross(p, a));
      if (!rails.length) continue;
      const o = otherAxis(p, a);
      const sp = stripSpan(spanAcross(p, o), supportsAcross(p, o, w));
      const { EI, mu } = teeBeam(sp.len, gap(a), p.stock, braceStock, WINDOW_RAIL_IN);
      // the frame's rail on the panel at each end of this one's run (none on the baffle where a notched frame opens)
      const ends = END_PANEL[o].map((id) => panelById.get(id));
      for (const x of rails) {
        const at = offAcross(p, a) + x;
        const k = ends.map((q, e) =>
          q && (e === 0 ? sp.start : sp.end) && !(q.id === "baffle" && notched(a, at))
            ? railStiffness(q, a, w)
            : 0,
        );
        hz = Math.min(hz, beamHz(EI, mu, sp.len, k[0], k[1]));
      }
    }
    return Math.max(hz, bare);
  };

  const windows: Counts = { x: 0, y: 0, z: 0 };
  const ribs: RibState = {};
  const ribLen = (p: BracePanel, across: BoxAxis) => (across === p.u ? p.spanV : p.spanU);

  type Move =
    | { kind: "window"; axis: BoxAxis }
    | { kind: "rib"; p: BracePanel; across: BoxAxis; n: number }
    | { kind: "ring"; axis: BoxAxis; n: number; on: readonly BracePanel[] };
  const windowMoves = (scope: readonly BracePanel[]): Move[] =>
    BOX_AXES.filter((a) => {
      if (!scope.some((p) => p.u === a || p.v === a) || !winAt(a, windows[a] + 1)) return false;
      return ribsFit({ ...windows, [a]: windows[a] + 1 }, ribs);
    }).map((axis) => ({ kind: "window", axis }));
  // a panel's rib moves depend on its own ribs and the window braces across the axis they divide: listed once each
  const movesMemo = new Map<string, Move[]>();
  // (only on panels under the target: ribs on one already over it gain nothing). A move sets the panel's ribs: more of
  // those it has, or ribs the other way in their place, so a first pick the other way never locks a panel out of the
  // way that lifts it more.
  const ribMoves = (on: readonly BracePanel[]): Move[] => [
    ...on.flatMap((p) =>
      !p.ribs || evalPanel(p, windows, ribs) >= targetHz - 1e-9
        ? []
        : [p.u, p.v].flatMap((across): Move[] => {
            const cur = ribs[p.id];
            const from = cur && cur.across === across ? cur.n : 0;
            const key = `${p.id}${across}${from}|${windows[across]}`;
            const hit = movesMemo.get(key);
            if (hit) return hit;
            const span = across === p.u ? p.spanU : p.spanV;
            const fixed = supportsAcross(p, across, windows);
            const out: Move[] = [];
            for (let n = from + 1; n <= from + RIB_BATCH_MAX; n++) {
              if (fillGaps(span, fixed, n).narrowest < MIN_BAY_IN - EPS) break;
              if (ribsAt(p, across, n, windows)) out.push({ kind: "rib", p, across, n });
            }
            movesMemo.set(key, out);
            return out;
          }),
    ),
    ...ringMoves(on),
  ];
  /**
   * Rings: ribs on every panel round an axis that takes them, `n` on each at the same places, so each meets the next
   * in the corners and they hold each other's ends (RING_FIXITY). Offered when a panel round the axis is under the
   * target and the panels' ribs line up (the same supports across the axis, the keep-out clear of them all).
   */
  const ringMemo = new Map<string, Move[]>();
  const ringMoves = (scope: readonly BracePanel[]): Move[] =>
    BOX_AXES.flatMap((a) => {
      const on = panels.filter((p) => p.ribs && (p.u === a || p.v === a));
      if (
        on.length < 2 ||
        !on.some((p) => scope.includes(p) && evalPanel(p, windows, ribs) < targetHz - 1e-9)
      )
        return [];
      const key = `${a}|${windows[a]}`;
      const hit = ringMemo.get(key);
      if (hit) return hit;
      const out: Move[] = [];
      for (let n = 1; n <= RIB_BATCH_MAX; n++) {
        const placed = on.map((p) => ribsAt(p, a, n, windows));
        if (placed.some((pl) => !pl)) continue;
        const ats = placed.map((pl, i) => (pl?.at ?? []).map((x) => x + offAcross(on[i], a)));
        if (ats.every((xs) => xs.every((x, j) => Math.abs(x - ats[0][j]) < t - EPS)))
          out.push({ kind: "ring", axis: a, n, on });
      }
      ringMemo.set(key, out);
      return out;
    });
  const apply = (m: Move, w: Counts, r: RibState) => {
    if (m.kind === "window") w[m.axis]++;
    else if (m.kind === "rib") r[m.p.id] = { across: m.across, n: m.n };
    else for (const p of m.on) r[p.id] = { across: m.axis, n: m.n };
  };
  const short = (hz: number) => Math.max(0, 1 - hz / targetHz);
  const ribWood = (p: BracePanel, s: RibState[BracePanelId]) =>
    s ? s.n * p.stock.t * RIB_DEPTH_IN * ribLen(p, s.across) : 0;
  // the wood a move adds; a switch that saves wood counts as almost none, so any gain from it wins
  const wood = (m: Move) =>
    m.kind === "window"
      ? windowWoodIn3(inner, m.axis, t)
      : m.kind === "rib"
        ? Math.max(EPS, ribWood(m.p, m) - ribWood(m.p, ribs[m.p.id]))
        : Math.max(
            EPS,
            m.on.reduce(
              (sum, p) => sum + ribWood(p, { across: m.axis, n: m.n }) - ribWood(p, ribs[p.id]),
              0,
            ),
          );
  const phase = (moves: () => Move[], scope: readonly BracePanel[]) => {
    for (let step = 0; step < MAX_BRACE_STEPS; step++) {
      // each panel's resonance now; a move can change its own panels and those whose ribs meet theirs
      const now = scope.map((p) => evalPanel(p, windows, ribs));
      if (now.every((hz) => short(hz) <= 0)) return;
      let best: Move | null = null,
        bestRate = 0;
      for (const m of moves()) {
        const w = { ...windows },
          r = { ...ribs };
        apply(m, w, r);
        let gain = 0;
        scope.forEach((p, i) => {
          gain += short(now[i]) - short(evalPanel(p, w, r));
        });
        const rate = gain / wood(m);
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
  else if (style === "ribs") phase(() => ribMoves(panels), panels);
  else {
    // a frame can't go where ribs already stand (ribsFit), so the panels only frames hold get theirs before any rib
    const unribbed = panels.filter((p) => !p.ribs);
    phase(() => windowMoves(unribbed), unribbed);
    phase(() => [...windowMoves(panels), ...ribMoves(panels)], panels);
  }

  const none: Counts = { x: 0, y: 0, z: 0 };
  const res: PanelResonance[] = panels.map((p) => ({
    id: p.id,
    bareHz: evalPanel(p, none, {}),
    hz: evalPanel(p, windows, ribs),
  }));
  const ribList = layRibs(inner, panels, ribs, (p, s) => ribsAt(p, s.across, s.n, windows), t);
  const win = {
    x: winOrNone("x", windows.x),
    y: winOrNone("y", windows.y),
    z: winOrNone("z", windows.z),
  };
  const notchAt = win.x.filter((x) => notched("x", x));
  return {
    style,
    targetHz,
    windows: win,
    notch: notchAt.length && rooms.x.notch ? { at: notchAt, y: rooms.x.notch.y } : null,
    ribs: ribList,
    panels: res,
    windowIn3: BOX_AXES.reduce((a, ax) => a + windows[ax] * windowWoodIn3(inner, ax, t), 0),
    ribIn3: ribList.reduce((a, r) => {
      const p = panels.find((q) => q.id === r.panel);
      return a + (p ? p.stock.t * RIB_DEPTH_IN * r.len * r.at.length : 0);
    }, 0),
    meets: res.every((p) => p.hz >= targetHz - 1e-9),
  };
}

/**
 * The ribs as built: each panel's, in box coordinates, with a rib that meets another panel's in a corner (the same
 * line round the box) stopping RIB_DEPTH_IN short there, butting into it (RING_RANK says which gives way); a panel's
 * ribs grouped by their run.
 */
function layRibs(
  inner: Record<BoxAxis, number>,
  panels: readonly BracePanel[],
  ribs: RibState,
  placed: (p: BracePanel, s: { across: BoxAxis; n: number }) => PlacedRibs | null,
  t: number,
): PanelRibs[] {
  type One = { panel: BracePanelId; across: BoxAxis; at: number; from: number; to: number };
  const all: One[] = [];
  for (const p of panels) {
    const s = ribs[p.id];
    const pl = s && placed(p, s);
    if (!s || !pl) continue;
    const offA = s.across === p.u ? p.offU : p.offV,
      offR = s.across === p.u ? p.offV : p.offU;
    pl.at.forEach((x, i) =>
      all.push({
        panel: p.id,
        across: s.across,
        at: offA + x,
        from: offR + pl.runs[i][0],
        to: offR + pl.runs[i][1],
      }),
    );
  }
  const reaches = (o: One, axis: BoxAxis, far: boolean) =>
    far ? o.to >= inner[axis] - EPS : o.from <= EPS;
  const laid = all.map((o) => {
    const run = ribRunAxis(o.panel, o.across);
    let { from, to } = o;
    ([false, true] as const).forEach((far, end) => {
      if (!reaches(o, run, far)) return;
      const q = END_PANEL[run][end];
      const n = PANEL_NORMAL[o.panel];
      const meets = all.some(
        (m) =>
          m.panel === q &&
          m.across === o.across &&
          Math.abs(m.at - o.at) < t - EPS &&
          RING_RANK[q] > RING_RANK[o.panel] &&
          reaches(m, n.axis, n.far),
      );
      if (meets) {
        if (far) to -= RIB_DEPTH_IN;
        else from += RIB_DEPTH_IN;
      }
    });
    return { ...o, from, to };
  });
  const groups = new Map<string, PanelRibs>();
  for (const o of laid) {
    const k = `${o.panel}|${o.across}|${o.from}|${o.to}`;
    const g = groups.get(k);
    if (g) g.at.push(o.at);
    else
      groups.set(k, {
        panel: o.panel,
        across: o.across,
        at: [o.at],
        from: o.from,
        len: o.to - o.from,
      });
  }
  return [...groups.values()];
}
