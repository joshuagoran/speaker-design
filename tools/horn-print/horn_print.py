"""Turn a hornlab.io waveguide STEP into a 3D-printable horn: wall, lip, ribs, seam flanges, throat fins,
a mounting foot, a throat part T and four quarters Q1-Q4, with STEP/STL exports, checks, previews and a
PRINT_README.md.

The inner (acoustic) surface is the STEP's own faces; material is only added outside it. The BEM JSON export
from hornlab.io gives the exact inner profiles used for the checks (and the mouth plane / rollback end).

Steps (each one runs in its own process; `all` runs them in order):
  wall                                     STEP solid (+ an outer layer if --wall is thicker than the STEP)
  body lip | seams | ribs | feet | holes   features fused one group at a time
  split T | split Qall                     throat part and the quarter ring (lap joint between them)
  quarter 1 | 2 | 3 | 4                    the quarters
  export | check | render | readme

Usage: python -I horn_print.py --step H.step --bem H.json --out DIR [options] <stage> [arg]
Keep --out outside the repository.
"""
import argparse
import json
import math
import os
import subprocess
import sys
import time

# ----------------------------------------------------------------------------
# Options: (name, default, type, choices, help). All can be set on the command line.
# ----------------------------------------------------------------------------
OPTS = [
    ("step", None, str, None, "hornlab.io STEP solid of the horn (required)"),
    ("bem", None, str, None, "hornlab.io BEM JSON export of the same design (required)"),
    ("out", "horn-print-out", str, None, "output folder (keep it outside the repository)"),
    ("wall", "step", str, None, "wall thickness in mm, or 'step' to keep the STEP shell; it can only grow"),
    ("seam_trim", 2.0, float, None, "a thicker wall's outer layer stops this far off the seam planes"),
    ("d_in", 3.5, float, None, "features start this deep inside the wall (capped to half the wall)"),
    ("lip", "auto", str, ("auto", "ring", "none"), "mouth lip: auto = ring unless the profile rolls back "
                                                   "or the horn has a mouth flange"),
    ("lip_out", 5.0, float, None, "lip ring width past the outer wall"),
    ("lip_depth", 6.0, float, None, "lip ring depth along the axis"),
    ("rib_t", 6.0, float, None, "rib thickness"),
    ("rib_h", 15.0, float, None, "rib height above the wall at the rear end"),
    ("rib_h_end", 5.0, float, None, "rib height at the mouth end (with --rib-taper)"),
    ("rib_taper", True, bool, None, "taper the ribs from --rib-h to --rib-h-end"),
    ("rib_ramp", 15.0, float, None, "length of the ramp at the rear end of each rib"),
    ("rib_angles", "none", str, None, "rib planes in degrees from +x, e.g. 60,120,240,300; none (or empty) for "
                                     "no ribs"),
    ("seam_t", 3.0, float, None, "seam flange and throat fin thickness on each side of a seam"),
    ("seam_h", 15.0, float, None, "seam flange and throat fin height above the wall"),
    ("bolt_d", 4.5, float, None, "seam bolt hole diameter (M4 clearance)"),
    ("dowel_d", 4.0, float, None, "seam dowel hole diameter"),
    ("bolt_f", "0.2,0.55,0.85", str, None, "seam bolt positions, fractions of the seam flange length"),
    ("dowel_f", "0.37,0.72", str, None, "seam dowel positions, fractions of the seam flange length"),
    ("fin_root_r", 8.0, float, None, "radius of the round where a throat fin meets the driver flange face"),
    ("split_z", 55.0, float, None, "T / quarter split: outer shoulder z"),
    ("joint_l", 12.0, float, None, "lap length; the inner seam is at split-z + joint-l"),
    ("joint_rad_clr", 0.10, float, None, "lap joint radial clearance"),
    ("joint_ax_clr", 0.20, float, None, "lap joint axial clearance at the outer shoulder"),
    ("feet", "none", str, ("center", "pair", "none"), "mounting foot under the mouth; none by default, since the "
                                                      "plywood throat mount carries the horn"),
    ("foot_x", 120.0, float, None, "pair: feet at plus and minus this x"),
    ("foot_w", None, float, None, "foot width; default 120 (center) or 50 (pair)"),
    ("foot_depth", 45.0, float, None, "foot depth along the axis"),
    ("foot_t", 8.0, float, None, "foot plate thickness"),
    ("foot_web_h", 16.0, float, None, "center foot web height"),
    ("foot_fastener", None, str, ("m6", "screws"), "foot fastener; default m6 (center) or screws (pair)"),
    ("build_vol", "256,256,260", str, None, "printer build volume x,y,z in mm"),
    ("stl_tol", 0.05, float, None, "STL chord tolerance in mm"),
    ("stl_ang", 0.2, float, None, "STL angular tolerance in radians"),
]
STAGES = ("wall", "body", "split", "quarter", "export", "check", "render", "readme", "all")
BODY_STEP_NAMES = ("lip", "seams", "ribs", "feet", "holes")
STAGE_ARGS = {"body": BODY_STEP_NAMES, "split": ("T", "Qall"), "quarter": ("1", "2", "3", "4")}
RHO = {"PETG": 1.27, "ASA": 1.07}
EST_WALLS, EST_LINE, EST_INFILL = 4, 0.45, 0.40   # print estimate: 4 wall loops of 0.45 mm, 40 % gyroid core
SCREW_D, SCREW_CSK = 4.5, 9.0       # #8 wood screw, 90 deg countersink
M6_D, M6_CB, M6_FLOOR = 6.6, 13.0, 3.0
MIN_WALL = 3.0
TOP_SMOOTH = 3.0               # Gaussian smoothing (mm) of the seam spine top line, so the round can follow it
ROUND_EPS = 0.01               # OCC cannot fillet both top edges at exactly half the thickness
FIN_HOLE_WALL = 1.0            # least material between a throat fin and a driver bolt hole under the ply
WASHER_PAST = 6.0              # a 1/4 in washer reaches about this far past the driver bolt hole's edge
M4_WASHER_R = 4.5              # M4 washer radius: seam bolts sit this far plus the top round below the top
FOOT_WEB_T = 12.0              # center foot web thickness
PLY_T = 12.0                   # throat mount: 1/2 in birch ply
PLY_CLR = 1.0                  # throat mount clearances (top edge under the side fins, slot past the fin)
PLY_GAP = 3.0                  # throat mount gusset clearance below the horn
SADDLE_CLR = 1.5               # throat mount saddle radius past the neck
FOOT_CLR = 5.0                 # throat mount base and gusset stop this far short of a foot
GUSSET_MIN = 20.0              # shortest useful gusset leg
IN = 25.4
PARTS = ["T", "Q1", "Q2", "Q3", "Q4"]
QUAD = {1: (1, 1), 2: (-1, 1), 3: (-1, -1), 4: (1, -1)}
README_NAME = "PRINT_README.md"
CHECK_STEP_DEG = 15.0          # radial planes for the STEP inner-surface check
# ----------------------------------------------------------------------------

T0 = time.time()
A = None        # parsed options
WORK = None


def log(*a):
    print(f"[{time.time() - T0:6.1f}s]", *a, flush=True)


def fail(msg):
    raise SystemExit(f"horn_print: error: {msg}")


def flist(s):
    return tuple(float(v) for v in str(s).split(","))


def angle_list(s):
    """Comma-separated angles, or () for 'none' or an empty string."""
    return () if str(s).strip().lower() in ("", "none") else flist(s)


class HelpFormatter(argparse.RawDescriptionHelpFormatter, argparse.ArgumentDefaultsHelpFormatter):
    def _get_help_string(self, action):
        return action.help if action.default is None else super()._get_help_string(action)


def parse(argv):
    p = argparse.ArgumentParser(prog="horn_print.py", description=__doc__, formatter_class=HelpFormatter)
    for k, v, typ, choices, hlp in OPTS:
        name = "--" + k.replace("_", "-")
        if typ is bool:
            p.add_argument(name, dest=k, action=argparse.BooleanOptionalAction, default=v, help=hlp)
        else:
            p.add_argument(name, dest=k, type=typ, default=v, choices=choices, help=hlp,
                           required=k in ("step", "bem"))
    p.add_argument("stage", choices=STAGES, help="stage to run (all = every stage in order)")
    p.add_argument("arg", nargs="?", help="body: " + "|".join(BODY_STEP_NAMES) + "; split: T|Qall; quarter: 1-4")
    a = p.parse_args(argv)
    if a.stage in STAGE_ARGS:
        if a.arg not in STAGE_ARGS[a.stage]:
            p.error(f"stage {a.stage} needs one of: {', '.join(STAGE_ARGS[a.stage])}")
    elif a.arg is not None:
        p.error(f"stage {a.stage} takes no argument")
    if a.wall != "step":
        try:
            float(a.wall)
        except ValueError:
            p.error("--wall must be a number or 'step'")
    for k in ("rib_angles", "bolt_f", "dowel_f", "build_vol"):
        try:
            (angle_list if k == "rib_angles" else flist)(getattr(a, k))
        except ValueError:
            p.error(f"--{k.replace('_', '-')} must be comma-separated numbers")
    for k in ("seam_t", "seam_h", "fin_root_r"):
        if getattr(a, k) <= 0:
            p.error(f"--{k.replace('_', '-')} must be more than 0")
    return a


def resolve_defaults():
    """Defaults that depend on the foot: foot size and fastener."""
    if A.foot_w is None:
        A.foot_w = 120.0 if A.feet == "center" else 50.0
    if A.foot_fastener is None:
        A.foot_fastener = "m6" if A.feet == "center" else "screws"


# Parse the options before the heavy imports, so --help and option errors work without the CAD install.
ARGS = parse(sys.argv[1:]) if __name__ == "__main__" else None

import numpy as np  # noqa: E402
from build123d import (Align, Box, Compound, Edge, Face, Location, Plane, Solid, Vector, Wire,  # noqa: E402
                       export_brep, export_step, extrude, import_brep, import_step, loft, make_face,
                       thicken)


# ---------------------------------------------------------------- inputs
def design():
    """BEM JSON: profiles (r, z) and the build settings, with clear errors for unsupported input."""
    try:
        d = json.load(open(A.bem))
        dz = d["design"]
    except (OSError, ValueError, KeyError) as e:
        fail(f"cannot read the BEM JSON {A.bem}: {e}")
    pr = dz.get("profile") or {}
    if pr.get("units") != "mm":
        fail(f"design.profile.units is {pr.get('units')!r}; only 'mm' is supported")
    P = {}
    for k in ("h", "v"):
        pts = pr.get(k)
        if not pts or len(pts) < 10:
            fail(f"design.profile.{k} is missing or too short in {A.bem}")
        P[k] = np.array([[q["r"], q["z"]] for q in pts])
    build = (dz.get("parameters") or {}).get("build")
    if not build:
        fail("design.parameters.build is missing: re-export the BEM JSON from hornlab.io with the build settings")
    tf, mf = build.get("throatFlange") or {}, build.get("mouthFlange") or {}
    if not tf.get("enabled"):
        fail("the design has no throat (driver) flange; this tool needs one for the throat fins and part T")
    return P, dz, tf, mf


def profiles():
    P, dz, tf, mf = design()
    z_mouth = max(P["h"][:, 1].max(), P["v"][:, 1].max())
    rollback = P["h"][-1, 1] < z_mouth - 0.5
    z_end = min(P["h"][-1, 1], P["v"][-1, 1])
    return P, z_mouth, rollback, z_end, dz


def load_step():
    """STEP faces sorted into inner (acoustic) B-spline faces, outer wall faces and lip / roll-end faces.
    The throat flange back face comes from build.throatFlange.thickness; a mouth flange stays in the solid."""
    P, dz, tf, mf = design()
    try:
        s = import_step(A.step)
    except Exception as e:  # noqa: BLE001 (any reader error is fatal here)
        fail(f"cannot read the STEP {A.step}: {e}")
    fb = float(tf.get("thickness", 0))
    if not any(f.geom_type.name == "PLANE" and abs(f.center().Z - fb) < 0.05 for f in s.faces()):
        fail(f"no flange back face at z = {fb} (build.throatFlange.thickness) in the STEP")
    z_mouth = max(P["h"][:, 1].max(), P["v"][:, 1].max())
    inner, outer, lipf = [], [], []
    for f in s.faces():
        if f.geom_type.name != "BSPLINE":
            continue
        bb = f.bounding_box()
        if bb.min.Z < 1:
            inner.append(f)
        elif abs(bb.min.Z - fb) < 1:
            outer.append(f)
        else:
            lipf.append(f)
    if not inner or not outer:
        fail(f"unexpected STEP layout: {len(inner)} inner and {len(outer)} outer B-spline faces")
    ib = Compound(inner).bounding_box()
    if ib.min.Z > 0.5 or abs(ib.max.Z - z_mouth) > 0.5:
        fail(f"the inner faces span z {ib.min.Z:.2f}..{ib.max.Z:.2f}, but the BEM profile spans 0..{z_mouth:.2f}: "
             "STEP and JSON do not match")
    return s, inner, outer, lipf, fb


def info(name):
    return json.load(open(f"{WORK}/{name}.json"))


def wall_t():
    return info("step_info")["wall_t"]


# ---------------------------------------------------------------- 2D helpers
def edge_points(e, n):
    """n points along an edge, evenly spaced in its parameter (fast OCP evaluation), as an (n, 3) array."""
    from OCP.BRepAdaptor import BRepAdaptor_Curve
    c = BRepAdaptor_Curve(e.wrapped)
    out = np.empty((n, 3))
    for i, u in enumerate(np.linspace(c.FirstParameter(), c.LastParameter(), n)):
        q = c.Value(float(u))
        out[i] = (q.X(), q.Y(), q.Z())
    return out


def local_uv(xyz, o, a):
    """(u, z) of 3D points in a feature plane with origin o and lateral axis a."""
    return np.c_[(xyz - [o.X, o.Y, o.Z]) @ [a.X, a.Y, a.Z], xyz[:, 2]]

def plane_for(theta=None, x0=None, side=None):
    """Feature plane. Radial at angle theta (deg, 0 = +x), or the plane x = x0 with lateral axis (0, side, 0)."""
    if theta is not None:
        t = math.radians(theta)
        a = Vector(math.cos(t), math.sin(t), 0)
        o = Vector(0, 0, 0)
    else:
        a = Vector(0, side, 0)
        o = Vector(x0, 0, 0)
    return Plane(origin=o, x_dir=a, z_dir=a.cross(Vector(0, 0, 1))), o, a


def section_curve(inner, theta=None, x0=None, side=None, fast=False):
    """Inner-surface curve in a feature plane, as (u, z) points ordered from the throat along the profile
    (handles profiles that roll back), resampled every ~1 mm."""
    pl, o, a = plane_for(theta, x0, side)
    cut = Face.make_rect(4000, 4000, pl)
    segs = []
    for f in inner:
        sec = f.intersect(cut)
        if sec is None:
            continue
        for e in sec.edges():
            if fast:      # parameter-even sampling (checks)
                pts = local_uv(edge_points(e, 300), o, a)
            else:         # length-even sampling (feature geometry)
                pts = np.array([[(p - o).dot(a), p.Z] for p in (e.position_at(t) for t in np.linspace(0, 1, 300))])
            if pts[:, 0].mean() > 0.5:
                segs.append(pts)
    uniq = []
    for sg in segs:
        ends = sg[[0, -1]]
        if any(np.allclose(ends, u[[0, -1]], atol=0.02) or np.allclose(ends, u[[-1, 0]], atol=0.02) for u in uniq):
            continue
        uniq.append(sg)
    i0 = min(range(len(uniq)), key=lambda i: min(uniq[i][0, 1], uniq[i][-1, 1]))
    cur = uniq.pop(i0)
    if cur[0, 1] > cur[-1, 1]:
        cur = cur[::-1]
    chain = [cur]
    while uniq:
        end = chain[-1][-1]
        j = min(range(len(uniq)), key=lambda i: min(np.linalg.norm(uniq[i][0] - end), np.linalg.norm(uniq[i][-1] - end)))
        sg = uniq.pop(j)
        if np.linalg.norm(sg[-1] - end) < np.linalg.norm(sg[0] - end):
            sg = sg[::-1]
        if np.linalg.norm(sg[0] - end) > 0.5:
            break
        chain.append(sg[1:])
    pts = np.vstack(chain)
    d = np.r_[0, np.cumsum(np.hypot(*np.diff(pts, axis=0).T))]
    keep = np.r_[True, np.diff(d) > 1e-6]
    pts, d = pts[keep], d[keep]
    s = np.linspace(0, d[-1], max(50, int(d[-1] / 1.0)))
    return np.c_[np.interp(s, d, pts[:, 0]), np.interp(s, d, pts[:, 1])]


def normals(c):
    t = np.gradient(c, axis=0)
    t /= np.linalg.norm(t, axis=1)[:, None]
    return np.c_[t[:, 1], -t[:, 0]]   # into the wall (away from the air) for a curve ordered from the throat


def limit_offset(d1, c, n, frac=0.6, win=12):
    """Cap per-point offsets at frac x the local bend radius (wall side), smoothed so the edge stays fair."""
    cap = frac * bend_radius(c, n)
    k = np.ones(2 * win + 1)
    lo = np.array([cap[max(0, i - win):i + win + 1].min() for i in range(len(cap))])   # running min
    lo = np.convolve(np.pad(lo, win, mode="edge"), k / k.sum(), mode="valid")           # then average
    return np.minimum(d1, lo)


def bend_radius(c, n, step=6):
    """Radius of curvature where the center lies on the wall side (offsets toward it shrink); inf elsewhere."""
    R = np.full(len(c), np.inf)
    for i in range(step, len(c) - step):
        p0, p1, p2 = c[i - step], c[i], c[i + step]
        a, b, cc = np.linalg.norm(p1 - p0), np.linalg.norm(p2 - p1), np.linalg.norm(p2 - p0)
        cr = (p1 - p0)[0] * (p2 - p0)[1] - (p1 - p0)[1] * (p2 - p0)[0]
        if abs(cr) < 1e-9:
            continue
        r = a * b * cc / (2 * abs(cr))
        center_dir = (p0 + p2) / 2 - p1
        if center_dir @ n[i] > 0:
            R[i] = r
    return R


def clip_start(c, z0):
    """Drop the part of an ordered curve before it first reaches z0 (interpolating the first point)."""
    k = int(np.argmax(c[:, 1] >= z0))
    if k == 0:
        return c, 0
    p0, p1 = c[k - 1], c[k]
    f = (z0 - p0[1]) / (p1[1] - p0[1])
    return np.vstack([p0 + f * (p1 - p0), c[k:]]), k - 1


def prefix_until(c, zmax):
    k = int(np.argmax(c[:, 1] > zmax)) if (c[:, 1] > zmax).any() else len(c)
    return c[:k]


def band(c, d0, d1, z0, zmax=None):
    """Region between in-plane offsets d0 and d1 (scalar or per point of c) of curve c. Both edges are cut at
    z = z0, so the feature starts with a flat end on that plane (the quarters' bed plane).
    Returns (segments for solid_from_poly, curve, normals, d1 per point), the last three from z0 on."""
    n = normals(c)
    d1 = np.broadcast_to(np.asarray(d1, dtype=float), (len(c),)).copy()
    if zmax is not None:
        k = len(prefix_until(c, zmax))
        c, n, d1 = c[:k], n[:k], d1[:k]
    a, _ = clip_start(c + d0 * n, z0)
    b, _ = clip_start(c + d1[:, None] * n, z0)
    k = int(np.argmax(c[:, 1] >= z0))
    return [a, np.array([a[-1], b[-1]]), b[::-1], np.array([b[0], a[0]])], c[k:], n[k:], d1[k:]


def thin(c, n=150):
    if len(c) <= n:
        return c
    return c[np.unique(np.linspace(0, len(c) - 1, n).round().astype(int))]


def solid_from_poly(segs, thick, theta=None, x0=None, side=None):
    pl, _, _ = plane_for(theta, x0, side)
    edges = []
    for sg in segs:
        sg = np.asarray(sg, dtype=float)
        pts = [pl.from_local_coords((float(u), float(v))) for u, v in (thin(sg) if len(sg) > 2 else sg)]
        edges.append(Edge.make_line(pts[0], pts[1]) if len(pts) == 2 else Edge.make_spline(pts))
    return extrude(make_face(Wire(edges)), amount=thick / 2, both=True)


def segs_cross(p, q):
    """True if polyline p crosses polyline q (proper segment intersections)."""
    def cross(u, v):
        return u[..., 0] * v[..., 1] - u[..., 1] * v[..., 0]

    a1, a2 = p[:-1], p[1:]
    for b1, b2 in zip(q[:-1], q[1:]):
        d1 = cross(a2 - a1, b1 - a1)
        d2 = cross(a2 - a1, b2 - a1)
        d3 = cross(b2 - b1, a1 - b1)
        d4 = cross(b2 - b1, a2 - b1)
        if np.any((d1 * d2 < -1e-9) & (d3 * d4 < -1e-9)):
            return True
    return False


def resample(p, step=1.0):
    d = np.r_[0, np.cumsum(np.hypot(*np.diff(p, axis=0).T))]
    s = np.linspace(0, d[-1], max(20, int(d[-1] / step)))
    return np.c_[np.interp(s, d, p[:, 0]), np.interp(s, d, p[:, 1])]


def smooth_line(p, sigma=TOP_SMOOTH):
    """Gaussian smoothing along a whole polyline (resampled every 1 mm). Odd reflection at both ends keeps the
    end points in place. Straight and gently curved runs barely move (well under 0.1 mm); kinks, where an offset
    is capped at a tight bend (near a roll), become rounds."""
    p = resample(p)
    w = min(int(3 * sigma), len(p) - 2)
    k = np.exp(-0.5 * (np.arange(-w, w + 1) / sigma) ** 2)
    k /= k.sum()
    q = np.vstack([2 * p[0] - p[1:w + 1][::-1], p, 2 * p[-1] - p[-w - 1:-1][::-1]])
    return np.c_[np.convolve(q[:, 0], k, "valid"), np.convolve(q[:, 1], k, "valid")]


def arc_pts(ctr, p0, p1, n=16):
    """Counterclockwise arc around ctr from p0 to p1, ending exactly on both points."""
    a0, a1 = math.atan2(p0[1] - ctr[1], p0[0] - ctr[0]), math.atan2(p1[1] - ctr[1], p1[0] - ctr[0])
    if a1 < a0:
        a1 += 2 * math.pi
    t = np.linspace(a0, a1, n)
    pts = ctr + np.linalg.norm(p0 - ctr) * np.c_[np.cos(t), np.sin(t)]
    pts[0], pts[-1] = p0, p1
    return pts


def spine_profile(c, n, top, d_in, fb):
    """Outline of one seam spine in its plane: the throat fin from the driver flange face (z = fb) and the seam
    flange on to the mouth, as one band from d_in to the top line. A concave round (--fin-root-r) joins the top
    line to the flange face. Returns (segments for solid_from_poly, the round's foot on the face, its tangent
    point on the top line); index 2 of the segments is the top line."""
    rr = A.fin_root_r
    a, _ = clip_start(c + d_in * n, fb - 1)          # 1 mm into the flange
    nt = normals(top)
    cz = top[:, 1] + rr * nt[:, 1]                    # z of the round's center for each top-line point
    if cz[0] >= fb + rr or not (cz >= fb + rr).any():
        fail(f"cannot fit the R{rr:g} fin root round between the fin top and the driver flange face")
    i = int(np.argmax(cz >= fb + rr))
    f = (fb + rr - cz[i - 1]) / (cz[i] - cz[i - 1])
    tp = top[i - 1] + f * (top[i] - top[i - 1])
    nn = nt[i - 1] + f * (nt[i] - nt[i - 1])
    ctr = tp + rr * nn / np.linalg.norm(nn)
    ctr[1] = fb + rr
    foot = np.array([ctr[0], fb])
    low = np.array([foot[0], fb - 1])
    segs = [a, np.array([a[-1], top[-1]]), np.vstack([top[i:][::-1], tp]), arc_pts(ctr, tp, foot),
            np.array([foot, low]), np.array([low, a[0]])]
    return segs, foot, tp


def round_top(tool, th, c, d_in):
    """Full round on the spine's top edges (radius half the thickness, less ROUND_EPS). The edges on the
    inner (wall) side are never touched. Falls back to a chamfer if OCC cannot build the round."""
    pl, o, ax = plane_for(theta=th)
    tops = []
    for e in tool.edges():
        if e.geom_type.name == "LINE":
            continue
        p = e.position_at(0.5)
        if abs(abs((p - o).dot(pl.z_dir)) - A.seam_t) > 1e-3:
            continue
        if np.min(np.linalg.norm(c - [(p - o).dot(ax), p.Z], axis=1)) > d_in + 1:
            tops.append(e)
    r = A.seam_t - ROUND_EPS
    for kind, make in (("round", lambda: tool.fillet(r, tops)),
                       ("chamfer", lambda: tool.chamfer(A.seam_t / 2, None, tops))):
        try:
            out = make()
        except Exception:  # noqa: BLE001 (OCC reports a failed fillet as a generic error)
            continue
        if out.is_valid and abs(out.volume) < tool.volume:
            if kind != "round":
                log(f"spine at {th:g} deg: the full round does not build; using a {A.seam_t / 2:g} mm chamfer")
            return out, kind
    log(f"spine at {th:g} deg: neither a round nor a chamfer builds on the top edges; left square")
    return tool, "square"


def spine_half():
    """Half-width of what sits on a seam plane at the throat: the fin, or a strip rib (thicker wall) if wider."""
    return max(A.seam_t, A.seam_trim + 1.0)


def driver_holes(tf):
    """Driver bolt holes and where each bolt head sits: 'ply' (the washer on the throat mount, wholly below its
    top edge) or 'flange' (the washer on the horn flange face, wholly above it). Stops if a washer would
    straddle the top edge. Returns (holes, top edge y, hole radius)."""
    n_b, rb, hr = int(tf.get("holeCount", 4)), float(tf.get("boltCircle", 0)) / 2, float(tf.get("holeDiameter", 0)) / 2
    top_y, wr = -(spine_half() + PLY_CLR), hr + WASHER_PAST
    out = []
    for k in range(n_b):
        ha = (float(tf.get("holeAngle", 45)) + k * 360 / n_b) % 360
        x, y = rb * math.cos(math.radians(ha)), rb * math.sin(math.radians(ha))
        if y + wr <= top_y:
            seat = "ply"
        elif y - wr >= top_y:
            seat = "flange"
        else:
            fail(f"the driver bolt hole at {ha:g} deg (y = {y:.1f}) straddles the throat mount's top edge "
                 f"(y = {top_y:g}): a 1/4 in washer (r = {wr:.1f}) would sit half on the ply")
        out.append({"angle": ha, "x": x, "y": y, "seat": seat, "washer_r": wr})
    return out, top_y, hr


def flange_holes_clear(foot_u, fin_angles, holes, hr):
    """Clearance (mm) between the driver bolts and the throat fins' footprints on the flange face: a washer on
    the flange face needs its full radius clear of a fin; a hole under the ply needs FIN_HOLE_WALL of material.
    Returns (worst margin, fin angle, hole angle, least washer clearance of the flange-face bolts)."""
    worst, washer = (math.inf, None, None), math.inf
    for th in fin_angles:
        for h in holes:
            d = math.radians(h["angle"] - th)
            rb = math.hypot(h["x"], h["y"])
            u, w = rb * math.cos(d), abs(rb * math.sin(d))
            dist = math.hypot(max(0.0, u - foot_u[th], -u), max(0.0, w - A.seam_t))   # center to footprint
            need = h["washer_r"] if h["seat"] == "flange" else hr + FIN_HOLE_WALL
            if h["seat"] == "flange":
                washer = min(washer, dist - h["washer_r"])
            if dist - need < worst[0]:
                worst = (dist - need, th, h["angle"])
    return worst + (washer,)


# ---------------------------------------------------------------- stage: wall
def stage_wall():
    s, inner, outer, lipf, fb = load_step()
    P, z_mouth, rollback, z_end, _ = profiles()
    log(f"STEP: {len(inner)} inner, {len(outer)} outer, {len(lipf)} lip/end, flange back z = {fb:.2f}; "
        f"mouth z = {z_mouth:.2f}, rollback = {rollback}")
    from OCP.BRep import BRep_Tool
    from OCP.GeomAPI import GeomAPI_ProjectPointOnSurf
    from OCP.gp import gp_Pnt
    ds = []
    for fo in outer:
        fi = min(inner, key=lambda f: (f.center() - fo.center()).length)
        srf = BRep_Tool.Surface_s(fi.wrapped)
        for u in np.linspace(0.05, 0.95, 7):
            for v in np.linspace(0.05, 0.95, 7):
                p = fo.position_at(u, v)
                ds.append(GeomAPI_ProjectPointOnSurf(gp_Pnt(p.X, p.Y, p.Z), srf).LowerDistance())
    step_wall = float(np.median(ds))
    wt = step_wall if A.wall == "step" else float(A.wall)
    if wt < step_wall - 0.01:
        fail(f"--wall {wt:g} is thinner than the STEP shell ({step_wall:.2f} mm); the tool only adds material "
             "outside the inner surface. Use --wall step or a value of at least the STEP shell.")
    if wt < MIN_WALL:
        fail(f"the wall is {wt:.2f} mm; at least {MIN_WALL} mm is needed for the features and the lap joint")
    add = wt - step_wall
    d_in = min(A.d_in, wt / 2)
    if d_in < A.d_in:
        log(f"--d-in {A.d_in} is more than half the wall; using {d_in:.2f}")
    _, _, tf, mf = design()
    log(f"STEP wall {step_wall:.3f} (min {min(ds):.3f}, max {max(ds):.3f}); building {wt:.2f}")
    bb = s.bounding_box()
    json.dump({"step_wall": step_wall, "wall_min": min(ds), "wall_max": max(ds), "wall_t": wt, "added": add,
               "d_in": d_in, "throat_flange": tf, "mouth_flange": bool(mf.get("enabled")),
               "outer_ext": max(Compound(outer).bounding_box().max.X - Compound(inner).bounding_box().max.X,
                                Compound(outer).bounding_box().max.Y - Compound(inner).bounding_box().max.Y),
               "flange_back": fb, "z_mouth": z_mouth, "rollback": bool(rollback), "z_end": z_end,
               "step_bbox": [bb.min.X, bb.min.Y, bb.min.Z, bb.max.X, bb.max.Y, bb.max.Z],
               "faces": {"inner": len(inner), "outer": len(outer), "lip_or_end": len(lipf),
                         "other": len(s.faces()) - len(inner) - len(outer) - len(lipf)}},
              open(f"{WORK}/step_info.json", "w"), indent=1)
    if add < 0.01:
        export_brep(s, f"{WORK}/wall.brep")
        return
    adds = []
    for fo in outer:
        c = fo.center()
        box = Box(600, 600, 600, align=(Align.MIN, Align.MIN, Align.MIN)).locate(
            Location((A.seam_trim, A.seam_trim, -50)))
        if c.X < 0:
            box = box.mirror(Plane.YZ)
        if c.Y < 0:
            box = box.mirror(Plane.XZ)
        adds.append(thicken(fo, add) & box)
    w = s.fuse(*adds)
    log("outer layer fused", w.is_valid, len(w.solids()))
    export_brep(w, f"{WORK}/wall.brep")


# ---------------------------------------------------------------- stage: body
def mouth_points(inner, z_mouth):
    edges = [e for f in inner for e in f.edges()
             if abs(e.bounding_box().min.Z - z_mouth) < 0.01 and abs(e.bounding_box().max.Z - z_mouth) < 0.01]
    pts = sorted((math.atan2(p.Y, p.X), p.X, p.Y) for e in edges for p in (e.position_at(t) for t in np.linspace(0, 1, 120)))
    P, last = [], None
    for a, x, y in pts:
        if last is None or a - last > 1e-4:
            P.append((x, y))
            last = a
    P = np.array(P)
    if np.hypot(*(P[0] - P[-1])) < 1e-3:
        P = P[:-1]
    t = np.roll(P, -1, 0) - np.roll(P, 1, 0)
    t /= np.linalg.norm(t, axis=1)[:, None]
    n = np.c_[t[:, 1], -t[:, 0]]
    if (n * P).sum(1).mean() < 0:
        n = -n
    return P, n


def ring_face(P, n, d, z):
    Q = P + d * n
    return make_face(Wire([Edge.make_spline([Vector(x, y, z) for x, y in Q], periodic=True)]))


def rib_heights(cc, h0, h1):
    """Rib height along the clipped curve: smooth (cosine) taper from h0 to h1, 45 deg ramp at the rear end."""
    s = np.r_[0, np.cumsum(np.hypot(*np.diff(cc, axis=0).T))]
    h = h1 + (h0 - h1) * 0.5 * (1 + np.cos(np.pi * s / s[-1])) if A.rib_taper else np.full(len(s), h0)
    return np.minimum(h, 1.0 + s * (h0 - 1.0) / A.rib_ramp)


def build_features(inner, lipf):
    si = info("step_info")
    wt, fb, z_mouth, rollback, z_end = si["wall_t"], si["flange_back"], si["z_mouth"], si["rollback"], si["z_end"]
    d_in, mflange, tf = si["d_in"], si["mouth_flange"], si["throat_flange"]
    rib_z0 = A.split_z + A.joint_ax_clr
    g = {"lip": [], "seams": [], "ribs": [], "feet": []}
    out = {"notes": []}
    if A.lip == "ring" and (rollback or mflange):
        fail("--lip ring needs a plain mouth: this design " + ("rolls back" if rollback else "has a mouth flange"))
    lip = A.lip if A.lip != "auto" else ("none" if rollback or mflange else "ring")
    out["lip"] = lip
    if mflange:
        out["notes"].append("The STEP's mouth flange is kept as designed; no lip is added.")
    y_lid = si["step_bbox"][1]
    if lip == "ring":
        bb_in = Compound(inner).bounding_box()
        ext, cross, crest = 0.0, 0.0, z_mouth
        if lipf:
            bb = Compound(lipf).bounding_box()
            ext = max(bb.max.X - bb_in.max.X, bb.max.Y - bb_in.max.Y, 0.0)
            crest = bb.max.Z
            above = [abs(p.X) - bb_in.max.X for f in lipf for u in np.linspace(0, 1, 81) for v in np.linspace(0, 1, 81)
                     for p in [f.position_at(u, v)] if p.Z > z_mouth + 1e-4 and abs(p.Y) < 2]
            cross = max(above) if above else 0.0
        ext = max(ext, si["outer_ext"] + si["added"])     # a thicker wall can reach past the lip roll
        P, n2 = mouth_points(inner, z_mouth)
        f_out = ring_face(P, n2, ext + A.lip_out, z_mouth)
        f_in = ring_face(P, n2, max(0.02, min(0.3, 0.5 * cross)), z_mouth)
        g["lip"].append(extrude(f_out - f_in, amount=A.lip_depth, dir=(0, 0, -1)))
        lb = f_out.bounding_box()
        y_lid = min(y_lid, lb.min.Y)
        out.update(lip_roll_extent=ext, lip_roll_crest=crest, lip_outer=[lb.size.X, lb.size.Y])
    out["y_lid"] = y_lid

    rib_angles = angle_list(A.rib_angles)
    seams = (0.0, 90.0, 180.0, 270.0)
    curves = {th: section_curve(inner, theta=th) for th in sorted(set(seams) | set(rib_angles))}
    # strip ribs on T where the outer layer leaves the seam planes bare
    if si["added"] > 0.01:
        for th in seams:
            sg, *_ = band(curves[th], d_in, wt + 1.5, fb - 0.5, zmax=A.split_z + 1.0)
            g["seams"].append(solid_from_poly(sg, 2 * A.seam_trim + 2.0, theta=th))
    # seam spines: a throat fin on T from the driver flange face, then the seam flange on the quarters, in one
    # outline with one (smoothed) top line, so fin and flange read as one spine; the T / quarter split cuts it
    seam_info, fin = {}, {"angles": list(seams), "thick": 2 * A.seam_t, "root_r": A.fin_root_r,
                          "foot_u": {}, "reach_ply": {}, "root_tangent_z": {}, "round": {}}
    for th in seams:
        c = curves[th]
        n = normals(c)
        d1 = limit_offset(np.full(len(c), wt + A.seam_h), c, n)
        top = smooth_line(c + d1[:, None] * n)
        sg, foot_pt, tan_pt = spine_profile(c, n, top, d_in, fb)
        if segs_cross(sg[2], c):
            fail(f"seam flange or throat fin at {th:g} deg would cross the inner surface")
        tool, kind = round_top(solid_from_poly(sg, 2 * A.seam_t, theta=th), th, c, d_in)
        g["seams"].append(tool)
        _, cc, nn, _ = band(c, d_in, d1, rib_z0)
        dd = np.array([np.min(np.linalg.norm(top - q, axis=1)) for q in cc])   # flange height over the inner surface
        seam_info[th] = (cc, nn, dd)
        outline = np.vstack([sg[2], sg[3]])
        ply = outline[(outline[:, 1] >= fb - 1e-6) & (outline[:, 1] <= fb + PLY_T)]
        fin["foot_u"][th] = float(foot_pt[0])
        fin["reach_ply"][th] = float(ply[:, 0].max())
        fin["root_tangent_z"][th] = float(tan_pt[1])
        fin["round"][th] = kind
        if th == 270.0:       # the bottom spine: the throat mount gusset stays clear of it
            fin["bottom_top_line"] = [[round(float(u), 2), round(float(z), 2)] for u, z in top]
    fr = float(tf.get("diameter", 0)) / 2
    if max(fin["foot_u"].values()) > fr - 1:
        fail(f"a throat fin's root round reaches r = {max(fin['foot_u'].values()):.1f}, past the driver flange "
             f"(r = {fr:g}); use a smaller --fin-root-r or --seam-h")
    dholes, _, hr = driver_holes(tf)
    margin, cth, cha, washer = flange_holes_clear(fin["foot_u"], seams, dholes, hr)
    if margin < 0:
        fail(f"the throat fin at {cth:g} deg would hit the driver bolt at {cha:g} deg (its hole or washer; "
             f"{-margin:.1f} mm short): use a smaller --fin-root-r or --seam-h")
    fin["hole_margin"] = margin
    fin["washer_clear"] = None if washer == math.inf else washer
    for th in rib_angles:
        c = curves[th]
        n = normals(c)
        k = int(np.argmax(c[:, 1] >= rib_z0))
        d1_full = np.full(len(c), wt + A.rib_h)
        d1_full[k:] = wt + rib_heights(c[k:], A.rib_h, A.rib_h_end)
        d1 = limit_offset(d1_full, c, n)
        sg, *_ = band(c, d_in, d1, rib_z0)
        if segs_cross(sg[2], c):
            fail(f"rib at {th:g} deg would cross the inner surface")
        g["ribs"].append(solid_from_poly(sg, A.rib_t, theta=th))

    # feet
    front = (z_end - 0.3) if rollback else z_mouth
    z0 = front - A.foot_depth
    top = y_lid + A.foot_t
    holes, foot = [], {"mode": A.feet, "front_z": front, "z0": z0, "fastener": A.foot_fastener}
    if A.feet == "center":
        g["feet"].append(Box(A.foot_w, A.foot_t, A.foot_depth, align=(Align.CENTER, Align.MIN, Align.MIN)).locate(
            Location((0, y_lid, z0))))
        u_mid, u_top = -(y_lid + A.foot_t / 2), -top
        u_web = u_top - A.foot_web_h
        hole_z = z0 + 14.0 if A.foot_fastener == "m6" else z0 + 7.0
        web_z0 = hole_z + (12.0 if A.foot_fastener == "m6" else 9.0)
        cin = section_curve(inner, theta=270.0)
        cin = cin[: int(np.argmax(cin[:, 1])) + 1]                # main branch, bottom center
        zs = np.linspace(front, web_z0, 40)
        u_edge = np.maximum(u_web, np.interp(zs, cin[:, 1], cin[:, 0]) + d_in)   # never into the air
        pts = [[u_mid, web_z0], [u_mid, front]]
        if rollback:          # step up into the seam flange behind the roll end, clear of the acoustic edge
            u_r = -y_lid - 10.0
            pts += [[u_r, front], [u_r, front + 3.0], [u_web, front + 3.0]]
        pts += [[u, z] for u, z in zip(u_edge, zs)]
        pts = np.array(pts)
        g["feet"].append(solid_from_poly([np.array([pts[i], pts[(i + 1) % len(pts)]]) for i in range(len(pts))],
                                         FOOT_WEB_T, x0=0.0, side=-1))
        bolt_u, bolt_z = u_top - 7.0, (web_z0 + front) / 2
        holes.append(("bolt", Solid.make_cylinder(A.bolt_d / 2, FOOT_WEB_T + 4,
                                                  Plane(origin=(-(FOOT_WEB_T / 2 + 2), -bolt_u, bolt_z), z_dir=(1, 0, 0)))))
        foot.update(width=A.foot_w, depth=A.foot_depth, thick=A.foot_t, web_h=A.foot_web_h, web_t=FOOT_WEB_T,
                    web_z=[web_z0, front], seam_bolt_z=bolt_z, hole_z=hole_z)
        if A.foot_fastener == "m6":
            cb = A.foot_t - M6_FLOOR
            holes.append(("foot", Solid.make_cylinder(M6_D / 2, A.foot_t + 2, Plane(origin=(0, y_lid - 1, hole_z), z_dir=(0, 1, 0)))))
            holes.append(("foot", Solid.make_cylinder(M6_CB / 2, cb + 1, Plane(origin=(0, top - cb, hole_z), z_dir=(0, 1, 0)))))
            foot.update(counterbore_depth=cb)
        else:
            for x, z in ((-A.foot_w * 0.375, front - A.foot_depth / 2), (A.foot_w * 0.375, front - A.foot_depth / 2), (0.0, hole_z)):
                holes += csk_holes(x, z, y_lid, top)
        foot["gap_to_wall_at_hole"] = gap_to_wall(inner, 0.0, hole_z, top, wt)
    elif A.feet == "pair":
        for fx in (A.foot_x, -A.foot_x):
            g["feet"].append(Box(A.foot_w, A.foot_t, A.foot_depth, align=(Align.CENTER, Align.MIN, Align.MIN)).locate(
                Location((fx, y_lid, z0))))
            c = section_curve(inner, x0=fx, side=-1)
            c = c[: int(np.argmax(c[:, 1])) + 1]
            c = c[(c[:, 1] <= front)]
            if len(c) > 5 and c[:, 1].min() < front - 5:
                a, _ = clip_start(c + d_in * normals(c), z0)
                p0, p1 = [-(y_lid + A.foot_t / 2), z0], [-(y_lid + A.foot_t / 2), front - 1.0]
                g["feet"].append(solid_from_poly([np.array([p0, a[0]]), a, np.array([a[-1], p1]), np.array([p1, p0])],
                                                 A.rib_t, x0=fx, side=-1))
            else:
                out["notes"].append(f"no web for the foot at x = {fx:.0f}: no wall above it in z {z0:.0f}..{front:.0f}")
            for dx in (-14.0, 14.0):
                holes += csk_holes(fx + dx, front - 24.0, y_lid, top)
        foot.update(width=A.foot_w, depth=A.foot_depth, thick=A.foot_t, x=A.foot_x)
    out["foot"] = foot

    # seam holes: bolts and dowels by fraction of the seam flange length; move back if the flange is low there
    seam_holes = []
    for th, (cc, nn, dd) in seam_info.items():
        pl, _, _ = plane_for(theta=th)
        s = np.r_[0, np.cumsum(np.hypot(*np.diff(cc, axis=0).T))]
        hole_off = wt + A.seam_h / 2
        ok = dd >= hole_off + M4_WASHER_R + A.seam_t   # washer clear of the top round here
        placed = []
        for kind, fr, dia in [("bolt", f, A.bolt_d) for f in flist(A.bolt_f)] + [("dowel", f, A.dowel_d) for f in flist(A.dowel_f)]:
            free = ok & np.all([abs(s - q) >= 14.0 for q in placed] or [np.ones(len(s), bool)], axis=0)
            i = int(np.argmin(np.where(free, abs(s - fr * s[-1]), np.inf)))
            placed.append(s[i])
            uv = cc[i] + hole_off * nn[i]
            ctr = pl.from_local_coords((float(uv[0]), float(uv[1])))
            holes.append((kind, Solid.make_cylinder(dia / 2, 2 * A.seam_t + 4, Plane(origin=ctr, z_dir=pl.z_dir).offset(-(A.seam_t + 2)))))
            seam_holes.append({"seam": th, "kind": kind, "z": float(cc[i][1]), "u": float(uv[0])})
    out["seam_holes"] = seam_holes
    out["counts"] = {k: sum(1 for h in holes if h[0] == k) for k in ("bolt", "dowel", "foot")}
    out["fins"] = fin
    return g, [h[1] for h in holes], out


def csk_holes(x, z, y_lid, top):
    h = (SCREW_CSK - SCREW_D) / 2
    return [("foot", Solid.make_cylinder(SCREW_D / 2, A.foot_t + 2, Plane(origin=(x, y_lid - 1, z), z_dir=(0, 1, 0)))),
            ("foot", Solid.make_cone(SCREW_D / 2, SCREW_CSK / 2 + 0.5, h + 0.5, Plane(origin=(x, top - h, z), z_dir=(0, 1, 0))))]


def gap_to_wall(inner, x, z, top, wt):
    """Clear height from the foot top up to the outer wall above (x, z) on the bottom side."""
    try:
        c = section_curve(inner, x0=x, side=-1) if x else section_curve(inner, theta=270.0)
    except Exception:
        return None
    c = c[: int(np.argmax(c[:, 1])) + 1]
    if z < c[:, 1].min() or z > c[:, 1].max():
        return None
    return float(-top - (np.interp(z, c[:, 1], c[:, 0]) + wt))


BODY_STEPS = [("lip", "wall", "b1"), ("seams", "b1", "b2"), ("ribs", "b2", "b3"), ("feet", "b3", "b4"), ("holes", "b4", "body")]


def stage_body(step):
    s, inner, outer, lipf, fb = load_step()
    g, holes, out = build_features(inner, lipf)
    log("features", {k: len(v) for k, v in g.items()}, "holes", len(holes))
    json.dump(out, open(f"{WORK}/body_info.json", "w"), indent=1)
    for name, src, dst in BODY_STEPS:
        if name != step:
            continue
        b = import_brep(f"{WORK}/{src}.brep")
        t = time.time()
        tools = holes if name == "holes" else g[name]
        if tools:
            b = b.cut(*tools) if name == "holes" else b.fuse(*tools)
        if len(b.solids()) == 1:
            b = b.solids()[0]
        log(name, "valid", b.is_valid, "solids", len(b.solids()), f"{time.time() - t:.1f}s")
        export_brep(b, f"{WORK}/{dst}.brep")


# ---------------------------------------------------------------- stage: split
def contour_points(inner, z, d):
    """(x, y) points around the closed contour at height z, d (normal) outside the inner surface, by angle."""
    cut = Face.make_rect(4000, 4000, Plane(origin=(0, 0, z)))
    pts = []
    for f in inner:
        sec = f.intersect(cut)
        if sec is None:
            continue
        for e in sec.edges():
            for t in np.linspace(0, 1, 60):
                p = e.position_at(t)
                nn = f.normal_at(p)
                if nn.X * p.X + nn.Y * p.Y < 0:
                    nn = -nn
                nxy2 = nn.X ** 2 + nn.Y ** 2
                pts.append((math.atan2(p.Y, p.X), p.X + d * nn.X / nxy2, p.Y + d * nn.Y / nxy2))
    pts.sort()
    out, last = [], None
    for a, x, y in pts:
        if last is None or a - last > 1e-3:
            out.append((x, y))
            last = a
    if abs(pts[-1][0] - pts[0][0] - 2 * math.pi) < 2e-3:
        out = out[:-1]
    return out


def mid_contour(inner, z, d):
    """Closed contour at height z, d (normal) outside the inner surface."""
    return Edge.make_spline([Vector(x, y, z) for x, y in contour_points(inner, z, d)], periodic=True)


def plug(inner, d):
    w0 = Wire([mid_contour(inner, A.split_z - 1, d)])
    w1 = Wire([mid_contour(inner, A.split_z + A.joint_l, d)])
    return loft([make_face(w0), make_face(w1)], ruled=True)


def stage_split(which):
    s, inner, *_ = load_step()
    body = import_brep(f"{WORK}/body.brep")
    mid = wall_t() / 2
    if which == "T":
        reg = Box(2000, 2000, A.split_z + 100, align=(Align.CENTER, Align.CENTER, Align.MAX)).locate(
            Location((0, 0, A.split_z))).fuse(plug(inner, mid))
    else:
        reg = Box(2000, 2000, 500, align=(Align.CENTER, Align.CENTER, Align.MIN)).locate(
            Location((0, 0, A.split_z + A.joint_ax_clr))).cut(plug(inner, mid + A.joint_rad_clr))
    out = body & reg
    if len(out.solids()) == 1:
        out = out.solids()[0]
    log(which, "valid", out.is_valid, "solids", len(out.solids()), "vol", round(out.volume))
    export_brep(out, f"{WORK}/{which}.brep")


def stage_quarter(k):
    q = import_brep(f"{WORK}/Qall.brep")
    sx, sy = QUAD[k]
    box = Box(1000, 1000, 1000, align=(Align.MIN, Align.MIN, Align.CENTER))
    if sx < 0:
        box = box.mirror(Plane.YZ)
    if sy < 0:
        box = box.mirror(Plane.XZ)
    out = q & box
    if len(out.solids()) == 1:
        out = out.solids()[0]
    log(f"Q{k}", "valid", out.is_valid, "solids", len(out.solids()), "vol", round(out.volume))
    export_brep(out, f"{WORK}/Q{k}.brep")


# ---------------------------------------------------------------- exports and checks
def write_stl(sh, path, tol, ang):
    """Fresh mesh (any stored triangulation dropped) at the given chord / angular tolerance; binary STL."""
    from OCP.BRepMesh import BRepMesh_IncrementalMesh
    from OCP.BRepTools import BRepTools
    from OCP.StlAPI import StlAPI_Writer
    BRepTools.Clean_s(sh.wrapped)
    BRepMesh_IncrementalMesh(sh.wrapped, tol, False, ang, True).Perform()
    w = StlAPI_Writer()
    w.ASCIIMode = False
    assert w.Write(sh.wrapped, path)


def stage_export():
    export_step(import_brep(f"{WORK}/body.brep"), f"{A.out}/horn_assembled.step")
    parts = {p: import_brep(f"{WORK}/{p}.brep") for p in PARTS}
    export_step(Compound(list(parts.values())), f"{A.out}/horn_parts_assembly.step")
    for p, sh in parts.items():
        export_step(sh, f"{A.out}/part_{p}.step")
        write_stl(sh, f"{A.out}/part_{p}.stl", A.stl_tol, A.stl_ang)
        log("exported", p)


def fit_orientation(m, vol):
    """First bed placement that fits: up axis z, then x, then y; rotation about the vertical 0..89 deg."""
    V = m.vertices
    bed = sorted(vol[:2])
    for up, name in ((2, "z up"), (0, "x up"), (1, "y up")):
        h = float(np.ptp(V[:, up]))
        if h > vol[2]:
            continue
        Q = V[:, [i for i in range(3) if i != up]]
        for deg in range(90):
            t = math.radians(deg)
            q = Q @ np.array([[math.cos(t), math.sin(t)], [-math.sin(t), math.cos(t)]])
            w, d = float(np.ptp(q[:, 0])), float(np.ptp(q[:, 1]))
            if sorted([w, d])[0] <= bed[0] and sorted([w, d])[1] <= bed[1]:
                return name, deg, w, d, h
    return None


def stage_check():
    import trimesh
    from matplotlib.path import Path
    from OCP.BRepBuilderAPI import BRepBuilderAPI_MakeVertex
    from OCP.BRepCheck import BRepCheck_Analyzer
    from OCP.BRepExtrema import BRepExtrema_DistShapeShape
    from OCP.gp import gp_Pnt
    vol = flist(A.build_vol)
    res = {"parts": {}}
    parts = {p: import_brep(f"{WORK}/{p}.brep") for p in PARTS}
    for p, sh in parts.items():
        m = trimesh.load(f"{A.out}/part_{p}.stl")
        lo, hi = m.bounds                      # from the fine mesh: B-rep boxes of trimmed B-splines can be loose
        v = sh.volume / 1000
        fit = fit_orientation(m, vol)
        res["parts"][p] = {
            "valid": bool(BRepCheck_Analyzer(sh.wrapped).IsValid()) and len(sh.solids()) == 1,
            "bbox_xyz": [round(float(v), 2) for v in hi - lo],
            "bbox_min": [round(float(v), 2) for v in lo],
            "bbox_max": [round(float(v), 2) for v in hi],
            "fit": None if fit is None else {"up": fit[0], "rot_deg": fit[1], "footprint": [round(fit[2], 1), round(fit[3], 1)], "height": round(fit[4], 1)},
            "volume_cm3": round(v, 1), "mass_g": {k: round(v * r) for k, r in RHO.items()},
            "stl_watertight": bool(m.is_watertight), "stl_faces": len(m.faces), "stl_volume_cm3": round(float(m.volume) / 1000, 1),
            "area_cm2": round(float(m.area) / 100, 1),
        }
        log(p, res["parts"][p])
    m = trimesh.load(f"{A.out}/part_Q1.stl")
    idx = np.random.default_rng(1).choice(len(m.faces), 300, replace=False)
    res["stl_centroid_dev_Q1_max_mm"] = max(
        BRepExtrema_DistShapeShape(BRepBuilderAPI_MakeVertex(gp_Pnt(*map(float, c))).Vertex(), parts["Q1"].wrapped).Value()
        for c in m.triangles_center[idx])
    body = import_brep(f"{WORK}/body.brep")
    res["body_valid"] = bool(BRepCheck_Analyzer(body.wrapped).IsValid()) and len(body.solids()) == 1

    # inner surface: (1) every BEM profile point in the two symmetry planes, both sides;
    # (2) the STEP's own inner surface in radial planes every CHECK_STEP_DEG degrees, sampled every 1 mm.
    # Each part is cut just inside the plane; the reference must lie on the cut (<= 0.2 mm) and no cut point
    # may lie more than 0.2 mm on the air side of the reference.
    prof, z_mouth, rollback, z_end, _ = profiles()
    _, inner, *_ = load_step()

    def seg_dist(q, poly):
        a, b = poly[:-1], poly[1:]
        ab = b - a
        t = np.clip(((q - a) * ab).sum(1) / np.maximum((ab * ab).sum(1), 1e-12), 0, 1)
        return float(np.min(np.linalg.norm(a + t[:, None] * ab - q, axis=1)))

    def compare(ref, pl, sgn, names):
        """ref: (r, z) points. Returns (max distance, points over 0.2 mm, cut points on the air side)."""
        polys = []
        for pn in names:
            sec = parts[pn].intersect(Face.make_rect(4000, 4000, pl))
            for e in ([] if sec is None else sec.edges()):
                pts = local_uv(edge_points(e, max(20, int(e.length / 0.1))), pl.origin, pl.x_dir) * [sgn, 1]
                if pts[:, 0].max() > 0:
                    polys.append(pts)
        d = np.array([min(seg_dist(q, pp) for pp in polys) for q in ref])
        e = ref[-1] + [0, 0.2]          # 0.2 mm allowance past the profile end (lip roll crest, lip face)
        air = Path(np.vstack([[0, -1], ref, e, [e[0] + 5000, e[1]], [e[0] + 5000, 5000], [0, 5000]]))
        allp = np.concatenate(polys)
        cand = allp[(allp[:, 0] > 0) & air.contains_points(allp)]
        intr = sum(1 for q in cand if seg_dist(q, ref) > 0.2)
        return float(d.max()), int((d > 0.2).sum()), intr

    rows = []
    for plane, k in (("H", "h"), ("V", "v")):
        for sgn in (1, -1):
            if plane == "H":
                q = "Q1" if sgn > 0 else "Q2"
                pl = Plane(origin=(0, 1e-3, 0), x_dir=(1, 0, 0), z_dir=(0, -1, 0))
            else:
                q = "Q1" if sgn > 0 else "Q4"
                pl = Plane(origin=(1e-3, 0, 0), x_dir=(0, 1, 0), z_dir=(1, 0, 0))
            dmax, nbad, intr = compare(prof[k], pl, sgn, ("T", q))
            rows.append({"ref": f"BEM profile {plane} {'+' if sgn > 0 else '-'}", "points": len(prof[k]),
                         "max_mm": round(dmax, 4), "over_0.2": nbad, "air_side": intr})
    for th in np.arange(CHECK_STEP_DEG, 360, CHECK_STEP_DEG):
        if th % 90 == 0:
            continue                    # the symmetry planes are covered by the BEM profiles above
        ref = section_curve(inner, theta=float(th), fast=True)
        pl, _, _ = plane_for(theta=float(th))
        q = "Q" + str(1 + int(th // 90))
        dmax, nbad, intr = compare(ref, pl, 1, ("T", q))
        rows.append({"ref": f"STEP surface at {th:g} deg", "points": len(ref), "max_mm": round(dmax, 4),
                     "over_0.2": nbad, "air_side": intr})
    res["inner_check"] = rows
    res["inner_max_dev_mm"] = max(r["max_mm"] for r in rows)
    res["inner_points"] = sum(r["points"] for r in rows)
    res["inner_failures"] = sum(r["over_0.2"] for r in rows)
    res["air_intrusion_points"] = sum(r["air_side"] for r in rows)
    log("inner surface: max", res["inner_max_dev_mm"], "mm over", res["inner_points"], "points;",
        res["inner_failures"], "over 0.2 mm;", res["air_intrusion_points"], "cut points on the air side")

    problems = [f"{p} is not a valid single solid" for p, v in res["parts"].items() if not v["valid"]]
    problems += [f"part_{p}.stl is not watertight" for p, v in res["parts"].items() if not v["stl_watertight"]]
    problems += [f"{p} does not fit the build volume" for p, v in res["parts"].items() if v["fit"] is None]
    if not res["body_valid"]:
        problems.append("the assembled horn is not a valid single solid")
    if res["stl_centroid_dev_Q1_max_mm"] > A.stl_tol + 0.01:
        problems.append("STL triangles are further from the solid than the chord tolerance")
    if res["inner_failures"]:
        problems.append(f"{res['inner_failures']} inner-surface points are more than 0.2 mm off")
    if res["air_intrusion_points"]:
        problems.append(f"{res['air_intrusion_points']} cut points lie on the air side of the inner surface")
    res["problems"] = problems
    json.dump(res, open(f"{WORK}/check.json", "w"), indent=1)
    if problems:
        print("CHECK FAIL: " + "; ".join(problems), flush=True)
        raise SystemExit(1)
    print("CHECK PASS", flush=True)


# ---------------------------------------------------------------- previews
def stage_render():
    import matplotlib
    import trimesh
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from mpl_toolkits.mplot3d.art3d import Poly3DCollection
    cols = {"T": "#d62728", "Q1": "#1f77b4", "Q2": "#2ca02c", "Q3": "#9467bd", "Q4": "#ff7f0e"}
    meshes = {}
    for p in PARTS:
        tmp = f"{WORK}/{p}_coarse.stl"
        write_stl(import_brep(f"{WORK}/{p}.brep"), tmp, 0.6, 0.5)
        meshes[p] = trimesh.load(tmp)
    explode = {"T": (0, 0, -70), "Q1": (45, 45, 0), "Q2": (-45, 45, 0), "Q3": (-45, -45, 0), "Q4": (45, -45, 0)}
    light = np.array([0.4, 0.3, 0.85])
    light /= np.linalg.norm(light)

    def draw(ax, ex, el, az, title):
        tris, fcs = [], []
        for p, m in meshes.items():
            v = m.vertices + (np.array(explode[p]) if ex else 0)
            tri = v[m.faces][:, :, [0, 2, 1]]          # model z (horn axis) -> plot y
            nrm = np.cross(tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0])
            nrm /= np.linalg.norm(nrm, axis=1)[:, None] + 1e-12
            shade = 0.35 + 0.65 * np.abs(nrm @ light)
            tris.append(tri)
            fcs.append(np.clip(np.array(matplotlib.colors.to_rgb(cols[p]))[None, :] * shade[:, None], 0, 1))
        ax.add_collection3d(Poly3DCollection(np.concatenate(tris), facecolors=np.concatenate(fcs), edgecolors="none"))
        lim = 300
        ax.set_xlim(-lim, lim)
        ax.set_ylim(-80 if ex else -20, 260 if ex else 220)
        ax.set_zlim(-lim * 0.7, lim * 0.7)
        ax.set_box_aspect((2 * lim, 340 if ex else 240, 1.4 * lim))
        ax.view_init(elev=el, azim=az)
        ax.set_axis_off()
        ax.set_title(title, fontsize=10)

    key = "T red, Q1 blue, Q2 green, Q3 purple, Q4 orange"
    for name, ex, views in (("assembly", False, [(20, -60), (15, 120)]), ("exploded", True, [(22, -55), (18, 125)])):
        fig = plt.figure(figsize=(16, 8), dpi=110)
        for vi, (el, az) in enumerate(views):
            draw(fig.add_subplot(1, 2, vi + 1, projection="3d"), ex, el, az, f"{name} ({key})")
        plt.tight_layout()
        plt.savefig(f"{A.out}/preview_{name}.png")
        plt.close(fig)
        log("rendered", name)
    fig = plt.figure(figsize=(16, 7), dpi=110)
    ax = fig.add_subplot(1, 2, 1, projection="3d")
    draw(ax, False, 8, 4, "side view, mouth to the right")
    ax.set_xlim(-280, 280); ax.set_zlim(-200, 200); ax.set_box_aspect((560, 240, 400))
    ax2 = fig.add_subplot(1, 2, 2)
    ribs = angle_list(A.rib_angles)
    th = ribs[0] if ribs else 45.0
    pl, _, _ = plane_for(theta=th)
    for p in PARTS:
        sec = import_brep(f"{WORK}/{p}.brep").intersect(Face.make_rect(4000, 4000, pl))
        for f in ([] if sec is None else sec.faces()):
            for wi in [f.outer_wire()] + list(f.inner_wires()):
                pts = np.array([[q.dot(pl.x_dir), q.Z] for q in (wi.position_at(t) for t in np.linspace(0, 1, 800))])
                ax2.fill(pts[:, 1], pts[:, 0], color=cols[p], alpha=0.85, lw=0.4, ec="k")
    ax2.set_aspect("equal")
    ax2.grid(alpha=0.3)
    ax2.set_xlabel("z (mm)")
    ax2.set_ylabel("distance from the axis (mm)")
    ax2.set_title(f"section through a rib (plane at {th:.0f} deg): rib height "
                  + (f"{A.rib_h:.0f} -> {A.rib_h_end:.0f} mm" if A.rib_taper else f"{A.rib_h:.0f} mm") if ribs else
                  f"section halfway between the seams (plane at {th:.0f} deg; no ribs)")
    plt.tight_layout()
    plt.savefig(f"{A.out}/preview_side.png")
    plt.close(fig)
    log("rendered side")

    prof, *_ = profiles()
    fig, axs = plt.subplots(1, 2, figsize=(16, 6.5), dpi=110)
    for ax, k, title, pl in zip(axs, "hv", ("horizontal section (y = 0+)", "vertical section (x = 0+)"),
                                (Plane(origin=(0, 1e-3, 0), x_dir=(1, 0, 0), z_dir=(0, -1, 0)),
                                 Plane(origin=(1e-3, 0, 0), x_dir=(0, 1, 0), z_dir=(1, 0, 0)))):
        for p in PARTS:
            sec = import_brep(f"{WORK}/{p}.brep").intersect(Face.make_rect(4000, 4000, pl))
            for f in ([] if sec is None else sec.faces()):
                for wi in [f.outer_wire()] + list(f.inner_wires()):
                    pts = np.array([[q.dot(pl.x_dir), q.Z] for q in (wi.position_at(t) for t in np.linspace(0, 1, 600))])
                    ax.fill(pts[:, 1], pts[:, 0], color=cols[p], alpha=0.85, lw=0.4, ec="k")
        for sg in (1, -1):
            ax.plot(prof[k][:, 1], sg * prof[k][:, 0], "k--", lw=0.6)
        ax.set_aspect("equal")
        ax.set_title(title + "; dashed = BEM profile; mouth to the right")
        ax.set_xlabel("z (mm)")
        ax.grid(alpha=0.3)
    plt.tight_layout()
    plt.savefig(f"{A.out}/preview_sections.png")
    plt.close(fig)
    log("rendered sections")


# ---------------------------------------------------------------- README
def throat_mount(si, bi, inner):
    """Plywood throat mount sizes from the model: a 1/2 in ply upright against the driver flange's front face,
    on a ply base, with one 45 deg gusset at x = 0 on the mouth side. Heights are above the lid plane (the
    horn's lowest point, y_lid)."""
    tf, fb, wt, fin = si["throat_flange"], si["flange_back"], si["wall_t"], bi["fins"]
    neck = max(math.hypot(x, y) for z in np.linspace(fb, fb + PLY_T, 5) for x, y in contour_points(inner, float(z), wt))
    reach = fin["reach_ply"]["270.0"]
    holes, top_y, _ = driver_holes(tf)
    m = {"neck_r": neck, "saddle_r": math.ceil(neck + SADDLE_CLR), "reach": reach, "top_y": top_y,
         "spine_half": spine_half(), "slot_w": 2 * spine_half() + PLY_CLR, "slot_r": math.ceil(2 * (reach + PLY_CLR)) / 2,
         "axis_h": -bi["y_lid"], "width": float(tf.get("diameter", 0)), "holes": holes}
    line = np.array(fin["bottom_top_line"])          # bottom spine top line: (distance below the axis, z)
    z_face = fb + PLY_T
    ft = bi["foot"]                                  # a foot caps the base and the gusset
    base_cap = gus_cap = math.inf
    if ft["mode"] != "none":
        base_cap = ft["z0"] - FOOT_CLR
        gus_cap = min(base_cap, (ft["web_z"][0] if "web_z" in ft else ft["z0"]) - FOOT_CLR)

    def clear_h(z):                                   # height of the bottom spine above the lid at z
        near = line[np.abs(line[:, 1] - z) <= 0.75]
        return m["axis_h"] - near[:, 0].max() if len(near) else math.inf

    top_max = m["axis_h"] - m["slot_r"] - PLY_GAP
    leg = 0
    for L in range(1, 400):
        if (PLY_T + L > top_max or z_face + L > gus_cap
                or any(PLY_T + L - s > clear_h(z_face + s) - PLY_GAP for s in range(L + 1))):
            break
        leg = L
    leg = 5 * (leg // 5)
    m["gusset_leg"] = leg if leg >= GUSSET_MIN else 0
    m["base_l"] = min(PLY_T + max(m["gusset_leg"], GUSSET_MIN), base_cap - fb)
    m["upright_h"] = m["axis_h"] + m["top_y"] - PLY_T
    return m


def stage_readme():
    si, bi, ck = info("step_info"), info("body_info"), info("check")
    _, inner, *_ = load_step()
    mt = throat_mount(si, bi, inner)
    P = ck["parts"]
    wt = si["wall_t"]
    vol = flist(A.build_vol)
    rows, tot = [], {"v": 0.0, "PETG": 0, "ASA": 0, "est": 0}
    shell_t = EST_WALLS * EST_LINE

    def est_g(d):          # shell (area x wall loops) solid, the rest of the volume at the infill density, in ASA
        v = d["volume_cm3"]
        shell = min(v, d["area_cm2"] * shell_t / 10)
        return round((shell + EST_INFILL * (v - shell)) * RHO["ASA"])

    names = {"T": f"Throat: flange + flare to z = {A.split_z + A.joint_l:.0f}", "Q1": "Quarter +x/+y (top)",
             "Q2": "Quarter -x/+y (top)", "Q3": "Quarter -x/-y (bottom)", "Q4": "Quarter +x/-y (bottom)"}
    for p in PARTS:
        d = P[p]
        f = d["fit"]
        if f is None:
            fit = "DOES NOT FIT"
        else:
            if f["up"] == "z up":
                how = "flange (z = 0) down" if p == "T" else f"throat end (z = {d['bbox_min'][2]:.1f}) down, mouth up"
            else:
                how = f"on its side ({f['up'].split()[0]} axis vertical)"
            rot = "axis-aligned" if f["rot_deg"] == 0 else f"turned {f['rot_deg']} deg on the bed"
            fit = f"{how}; {rot}, footprint {f['footprint'][0]:.1f} x {f['footprint'][1]:.1f}, {f['height']:.1f} high"
        bx = d["bbox_xyz"]
        rows.append(f"| {p} | {names[p]} | {bx[0]:.1f} x {bx[1]:.1f} x {bx[2]:.1f} | {fit} | {d['volume_cm3']:.0f} | "
                    f"{d['mass_g']['PETG']} | {d['mass_g']['ASA']} | {est_g(d)} |")
        tot["v"] += d["volume_cm3"]
        tot["PETG"] += d["mass_g"]["PETG"]
        tot["ASA"] += d["mass_g"]["ASA"]
        tot["est"] += est_g(d)
    rows.append(f"| all | | | | {tot['v']:.0f} | {tot['PETG']} | {tot['ASA']} | {tot['est']} |")
    ft = bi["foot"]
    cnt = bi["counts"]
    zm = si["z_mouth"]
    tf = si["throat_flange"]
    _, dz, _, _ = design()
    throat = (dz.get("parameters") or {}).get("throatDiam")
    n_b, n_d = len(flist(A.bolt_f)), len(flist(A.dowel_f))
    ribs = angle_list(A.rib_angles)
    n_up = sum(1 for th in ribs if 0 < th % 360 < 180)
    fin = bi["fins"]
    fl_t = float(tf.get("thickness", 0))
    fb = si["flange_back"]
    by_kind = {}
    for k, v in fin["round"].items():
        by_kind.setdefault(v, []).append(f"{float(k):g}")
    kind_txt = {"round": f"full-round top (R{A.seam_t - ROUND_EPS:.2f}, half the thickness)",
                "chamfer": f"{A.seam_t / 2:g} mm chamfered top (the full round did not build in OCC)",
                "square": "square top (neither the full round nor a chamfer built in OCC)"}
    top_txt = (kind_txt[next(iter(by_kind))] if len(by_kind) == 1 else
               "; ".join(f"{kind_txt[k]} at {'/'.join(v)} deg" for k, v in by_kind.items()))
    wc = fin.get("washer_clear")
    reach = {k: fin["foot_u"][f"{float(a)}"] for k, a in (("side", 0), ("tb", 90))}
    lip_txt = (("none added: the profile rolls back, and the outside of the roll is part of the acoustic surface. "
                f"The roll is the stiff edge; the {'ribs and ' if ribs else ''}seam flanges follow the wall around under the roll "
                "to its end.")
               if bi["lip"] == "none" and si["rollback"] else
               "none added: the horn has a mouth flange, kept as designed." if bi["lip"] == "none" and si["mouth_flange"]
               else "none (--lip none)." if bi["lip"] == "none" else
               f"{A.lip_out:.0f} mm outward from the outer wall, {A.lip_depth:.0f} mm deep, front face on the mouth plane; "
               f"outside {bi['lip_outer'][0]:.1f} x {bi['lip_outer'][1]:.1f} mm. The inner edge keeps the STEP's lip roll "
               f"(tangent to the flare; crest {bi['lip_roll_crest'] - zm:.3f} mm proud of the lip face).")
    rib_txt = (f"{A.rib_t:g} mm thick, {A.rib_h:.0f} mm tall at the rear easing to {A.rib_h_end:.0f} mm at the "
               f"{'roll end' if si['rollback'] else 'lip'} (cosine taper, 45 deg ramp at the rear end)" if A.rib_taper
               else f"{A.rib_t:g} mm thick, {A.rib_h:g} mm tall")
    rib_line = (f"{len(ribs)} radial ribs at {A.rib_angles} deg ({n_up} on the top wall, {len(ribs) - n_up} on the "
                f"bottom), {rib_txt}, from z = {A.split_z + A.joint_ax_clr:.1f}." if ribs else
                "none (`--rib-angles none`). The seam flanges stiffen the walls.")
    if ft["mode"] == "center":
        fast = ("one 6.6 mm hole for an M6 bolt at x = 0 with a 13 mm counterbore "
                f"{ft.get('counterbore_depth', 0):.0f} mm deep (3 mm floor), split on the Q3/Q4 seam"
                if ft["fastener"] == "m6" else "3 countersunk holes for #8 wood screws")
        gap = ft.get("gap_to_wall_at_hole")
        foot_txt = (f"one center foot spanning the Q3/Q4 seam: {ft['width']:.0f} (x) x {ft['depth']:.0f} (z) x {ft['thick']:.0f} mm "
                    f"plate, bottom on the lid plane y = {bi['y_lid']:.2f}, front at z = {ft['front_z']:.1f}"
                    f"{' (behind the roll end; the mouth plane is z = %.1f)' % zm if si['rollback'] else ' (flush with the mouth plane)'}. "
                    f"A {ft['web_t']:.0f} mm web, {ft['web_h']:.0f} mm tall, on the seam plane (z {ft['web_z'][0]:.0f}..{ft['web_z'][1]:.0f}) "
                    f"joins it to the {'seam flange behind the roll end' if si['rollback'] else 'lip and the bottom seam flange'}; "
                    f"one seam M4 bolt goes through the web and ties the two halves. Fastener: {fast}"
                    + (f"; about {gap:.0f} mm clear above it." if gap else "."))
    elif ft["mode"] == "pair":
        foot_txt = (f"two feet at x = +-{ft['x']:.0f}, {ft['width']:.0f} x {ft['depth']:.0f} x {ft['thick']:.0f} mm, "
                    f"front at z = {ft['front_z']:.1f}, each with a {A.rib_t:.0f} mm web up to the bottom wall and 2 countersunk #8 holes.")
    else:
        foot_txt = "none."
    def m4_len(grip):                                  # grip + 2 washers + nut
        return next(L for L in (12, 16, 20, 25, 30, 35, 40, 50) if L >= grip + 5.6)

    n_web = 1 if ft["mode"] == "center" else 0
    n_seam = cnt["bolt"] - n_web
    ply_h = [h for h in mt["holes"] if h["seat"] == "ply"]
    fl_h = [h for h in mt["holes"] if h["seat"] == "flange"]
    drv = [f"{len(ply_h)} x 1/4-20 x 1-1/4 in through the ply mount and the horn flange"] if ply_h else []
    drv += [f"{len(fl_h)} x 1/4-20 x 3/4 in through the horn flange only"] if fl_h else []
    hw = [f"- {n_seam} x M4 x {m4_len(2 * A.seam_t)} bolts, {n_seam} x M4 nuts, {2 * n_seam} x M4 washers (seam flanges). "
          "They clamp the glued seams."]
    if n_web:
        hw.append(f"- 1 x M4 x {m4_len(FOOT_WEB_T)} bolt, 1 x M4 nut, 2 x M4 washers (through the foot web).")
    hw += [f"- {cnt['dowel']} x dowel pins {A.dowel_d:g} x {2 * A.seam_t:g} mm (holes printed at {A.dowel_d:g} mm; drill or "
           "ream to a press fit).",
           "- ASA slurry for the seams: ASA scraps dissolved in acetone, in a glass jar with a tight lid.",
           f"- Driver: {', and '.join(drv)}, all with washers, into the driver's tapped holes (see the throat mount).",
           "- Throat mount: 1/2 in birch ply for the upright, the base and the gusset; wood glue; #8 wood screws."]
    if ply_h:
        ys = {round(h["y"], 1) for h in ply_h}
        holes_txt = (f"drill only the {len(ply_h)} holes of the {tf.get('boltCircle', 0):g} mm / {tf.get('holeAngle', 0):g} deg "
                     "pattern below the top edge, " + (
                         "at x = " + " and ".join(f"{h['x']:+.1f}" for h in ply_h) + f" mm, {-ply_h[0]['y']:.1f} mm below the axis"
                         if len(ply_h) <= 2 and len(ys) == 1 else
                         "at " + ", ".join(f"(x {h['x']:+.1f}, y {h['y']:+.1f})" for h in ply_h) + " mm")
                     + ". Drill 9/32 in (7 mm).")
    else:
        holes_txt = "none. No driver hole sits below the top edge, so no bolt passes through the ply; clamp the flange to it."
    bolt_txt = " ".join(([f"under the ply, 1/4-20 x 1-1/4 in through the ply and the horn flange into the driver's "
                          f"tapped holes (about {1.25 * IN - PLY_T - fl_t:.1f} mm of thread in the driver)."]
                         if ply_h else [])
                        + ([f"{'Above' if ply_h else 'above'} the ply, 1/4-20 x 3/4 in through the horn flange only (about "
                            f"{0.75 * IN - fl_t:.1f} mm of thread); their washers sit on the flange face, clear of the "
                            f"ply's top edge."] if fl_h else []))
    foot_cap = f" It stops {FOOT_CLR:g} mm short of the foot." if ft["mode"] != "none" else ""
    gusset_txt = (f"one 45 deg ply triangle with {mt['gusset_leg']:g} mm legs, at x = 0 on the mouth side. Glue and screw it "
                  f"to the upright and the base. It stays at least {PLY_GAP:g} mm below the bottom fin and the bottom seam "
                  f"flange{', and ' + format(FOOT_CLR, 'g') + ' mm short of the foot web' if n_web else ''}."
                  if mt["gusset_leg"] else
                  f"none. The foot leaves room for less than {GUSSET_MIN:g} mm of gusset; brace the upright another way.")
    if ft["mode"] == "center" and ft["fastener"] == "m6":
        hw.append("- Foot: 1 x M6 button head bolt (ISO 7380, low head so it sits flush), length to suit, about 20-25 mm "
                  "into the lid; 1 x M6 washer; 1 x M6 threaded insert or T-nut in the box lid.")
    elif ft["mode"] != "none":
        n = 3 if ft["mode"] == "center" else 4
        hw.append(f"- Foot: {n} x #8 countersunk wood screws, 3/4 to 1 in.")
    notes = "".join(f"- {n}\n" for n in bi["notes"])
    has_foot = ft["mode"] != "none"
    sup = ["the outer wall", "the underside of the roll" if si["rollback"] else "the lip"] + \
          (["the ribs"] if ribs else []) + (["the foot"] if has_foot else [])
    support = ", ".join(sup[:-1]) + " and " + sup[-1]
    roll_note = ("- Some seam bolts sit under the roll: reach them from behind, through the gap between the roll end "
                 "and the wall." + (" The foot cannot be flush with the mouth plane: the space below the roll belongs "
                                    "to the rollback, so the foot starts just behind the roll end." if has_foot else "")
                 + "\n" if si["rollback"] else "")
    txt = f"""# Printable horn: {os.path.basename(A.step)}

Built by `horn_print.py` from `{os.path.basename(A.step)}` and `{os.path.basename(A.bem)}`.
The inner (acoustic) surface is the STEP's own faces, untouched; all material is added outside it.
Coordinates: z along the axis (throat z = 0, mouth plane z = {zm:.2f}), x wide, y tall, +y up, foot on -y.

## Parts

| Part | What | Bounding box x y z (mm) | Print orientation (fits {vol[0]:.0f} x {vol[1]:.0f} x {vol[2]:.0f}) | Volume (cm3) | PETG (g) | ASA (g) | ASA, gyroid (g, est.) |
|---|---|---|---|---|---|---|---|
""" + "\n".join(rows) + f"""

PETG and ASA masses are for solid parts (100 % infill; PETG 1.27, ASA 1.07 g/cm3). The last column is a rough
estimate in ASA for the print settings below ({EST_WALLS} wall loops, {EST_INFILL * 100:.0f} % gyroid). It counts a solid shell of
{EST_WALLS} x {EST_LINE} mm = {shell_t:.1f} mm under every surface of the STL (surface area x {shell_t:.1f} mm, capped at the part's
volume) and fills the rest of the volume at {EST_INFILL * 100:.0f} %. It ignores the thicker top and bottom shells and the overlap
where shells meet in thin features, so expect the real print to differ by 10 % or so.

Files: `horn_assembled.step` (one solid), `horn_parts_assembly.step` (the five parts in place), `part_<P>.step`,
`part_<P>.stl` (chord tolerance {A.stl_tol} mm), `preview_*.png`, and `_work/`: `wall.brep`, `b1`-`b4.brep`, `body.brep`,
`T.brep`, `Qall.brep`, `Q1`-`Q4.brep`, `<P>_coarse.stl` (for the previews), `step_info.json`, `body_info.json`,
`check.json`.

## Geometry

- STEP: {si['faces']['inner']} inner B-spline faces, {si['faces']['outer']} outer, {si['faces']['lip_or_end']} lip/end faces, flange and holes;
  shell {si['step_wall']:.2f} mm{'; the profile rolls back (inner surface ends at z = %.1f)' % si['z_end'] if si['rollback'] else ''}.
- Wall: {wt:.2f} mm{' (STEP shell plus a %.2f mm outer layer)' % si['added'] if si['added'] > 0.01 else ' (the STEP shell as designed)'}.
- Lip: {lip_txt}
- Ribs: {rib_line}
- Seam flanges: on the 4 quarter seams, {2 * A.seam_t:g} mm thick ({A.seam_t:g} per quarter), {A.seam_h:g} mm tall, {top_txt}.
  They stay full height for the M4 heads and nuts, and drop only where the wall bends tighter than the flange
  height. The whole top line is smoothed ({TOP_SMOOTH:g} mm Gaussian); that only shows near the roll, where the
  wall bends tight. They act as the center rib of each wide wall and the rib of each side wall.
  {n_b} bolt holes ({A.bolt_d} mm, M4) and {n_d} dowel holes ({A.dowel_d} mm) per seam.
- Throat fins: on T at 0/90/180/270 deg, from the driver flange face (z = {fb:g}) to the split (z = {A.split_z:g}).
  Each fin is {fin['thick']:g} mm thick, with its seam flange's top line and top edges, so fin and seam flange read as
  one spine (with a {A.joint_ax_clr:g} mm gap at the split). An R{fin['root_r']:g} round joins each fin to the flange face; it reaches
  r = {reach['side']:.1f} mm on the side fins and {reach['tb']:.1f} mm on the top and bottom fins.""" + (f"""
  The 1/4 in washers on the flange-face driver bolts clear the fins by {wc:.1f} mm.""" if wc is not None else "") + f"""
- Driver flange: from the STEP ({tf.get('diameter', 0):g} mm round, {fl_t:g} mm thick, {throat:g} mm throat,
  {int(tf.get('holeCount', 4))} x {tf.get('holeDiameter', 0):g} mm holes on {tf.get('boltCircle', 0):g} mm at {tf.get('holeAngle', 0):g} deg).
- T / quarter joint: lap joint. T keeps the inner {wt / 2:.1f} mm of the wall up to z = {A.split_z + A.joint_l:.0f}, the quarters
  the outer part from z = {A.split_z:.0f}; {A.joint_rad_clr} mm radial and {A.joint_ax_clr} mm axial clearance on hidden faces,
  zero gap at the inner seam. Close the quarters around T's tongue; the flare taper then holds T.
- Foot: {foot_txt}{' The plywood throat mount carries the horn.' if not has_foot else ''}
{notes}
## Hardware

""" + "\n".join(hw) + f"""

## Assembly

- Dry-fit first: press the dowels into one side of each seam and close the quarters around T's tongue.
- Glue the seams with ASA slurry. Brush it on both faces of each seam flange, then bolt the seam. The M4 bolts
  clamp it while the slurry cures.
- Wipe any slurry off the inner surface before it sets. Let the seams cure for 24 hours before you load them.
- Acetone fumes are flammable and harmful. Work outdoors or with strong ventilation, away from flames.
- Slurry bonds ASA (and ABS) only. For PETG parts, rely on the bolts or use epoxy.

## Plywood throat mount

A 1/2 in ({PLY_T:g} mm) birch ply upright holds the horn by its driver flange. It sits against the flange's front face,
from z = {fb:g} to {fb + PLY_T:g}. The sizes below come from this model. They are written for a driver with 1/4-20 tapped
holes, such as the N314T.

- Upright: {mt['width']:g} mm wide (the flange diameter). Its top edge sits {-mt['top_y']:g} mm below the horn axis, which
  clears the side fins ({2 * mt['spine_half']:g} mm thick at the throat, centered on the axis) by {PLY_CLR:g} mm.
- Saddle: cut an R{mt['saddle_r']:g} half circle, centered on the axis, for the neck. The neck's outer wall reaches
  r = {mt['neck_r']:.1f} mm between z = {fb:g} and {fb + PLY_T:g}.
- Slot: cut a {mt['slot_w']:g} mm slot at x = 0 from the saddle down to r = {mt['slot_r']:g} mm for the bottom fin. The fin
  reaches r = {mt['reach']:.1f} mm between z = {fb:g} and {fb + PLY_T:g}.
- Holes: {holes_txt}
- Bolts: {bolt_txt}
- Height: with the horn's lowest point on the lid, the axis sits {mt['axis_h']:.1f} mm above the lid. Stand a
  {mt['upright_h']:.0f} mm upright on the base, so its top edge is {mt['axis_h'] + mt['top_y']:.0f} mm above the lid.
- Base: 1/2 in ply, {mt['width']:g} mm wide and {mt['base_l']:g} mm long (z = {fb:g} to {fb + mt['base_l']:g}). Screw it to the lid.
  Glue and screw the upright to the base.{foot_cap}
- Gusset: {gusset_txt}

## Print notes

- ASA in an enclosed printer; otherwise PETG. Not PLA.
- Bambu Studio, Process > Strength: sparse infill pattern Gyroid, sparse infill density about {EST_INFILL * 100:.0f} %,
  {EST_WALLS} wall loops, and 5 or more top and bottom shell layers. Some of these show only in Advanced mode. To set
  them for one part, right-click it > Add settings.
- Use these on every part. T carries the driver; print it at 100 % infill if you want it stiffer (solid mass in
  the table).
- T: flange down, no supports. Quarters: throat end down; the inner surface faces up or sideways and needs no
  support. Support {support} from the build plate
  only (tree supports), never on the inner surface. Use a brim.
{roll_note}
## Checks (`_work/check.json`)

- Solids valid: """ + ", ".join(f"{p} {'yes' if P[p]['valid'] else 'NO'}" for p in PARTS) + f"""; assembled solid {'yes' if ck['body_valid'] else 'NO'}.
- STL watertight: """ + ", ".join(f"{p} {'yes' if P[p]['stl_watertight'] else 'NO'}" for p in PARTS) + f"""; 300 random triangle
  centroids of part_Q1.stl lie within {ck['stl_centroid_dev_Q1_max_mm']:.3f} mm of the Q1 solid.
- Inner surface ({ck['inner_points']} points{', including the rollback' if si['rollback'] else ''}): every BEM profile point in the
  horizontal and vertical symmetry planes (both sides), and the STEP's own inner surface every 1 mm in radial planes
  every {CHECK_STEP_DEG:g} deg. Max distance {ck['inner_max_dev_mm']:.4f} mm; {ck['inner_failures']} points over 0.2 mm;
  {ck['air_intrusion_points']} cut points more than 0.2 mm on the air side. Between those planes the surface is not sampled.
- Build volume: """ + ("every part fits (see table)." if all(P[p]["fit"] for p in PARTS) else "SOME PARTS DO NOT FIT.") + "\n"
    open(f"{A.out}/{README_NAME}", "w").write(txt)
    log(README_NAME, "written")


# ---------------------------------------------------------------- driver
def stage_all(argv):
    steps = [["wall"]] + [["body", s] for s, *_ in BODY_STEPS] + [["split", "T"], ["split", "Qall"]] + \
            [["quarter", str(k)] for k in (1, 2, 3, 4)] + [["export"], ["check"], ["render"], ["readme"]]
    opts = [a for a in argv if a != "all"]
    rc = 0
    for st in steps:
        log("==>", *st)
        r = subprocess.run([sys.executable, "-I", os.path.abspath(__file__)] + opts + st)
        if r.returncode and st != ["check"]:
            raise SystemExit(r.returncode)
        rc = rc or r.returncode
    if rc:
        print("CHECK FAIL: see _work/check.json", flush=True)
    raise SystemExit(rc)


def main(argv):
    global A, WORK
    A = ARGS if ARGS is not None else parse(argv)
    A.out = os.path.abspath(A.out)
    WORK = f"{A.out}/_work"
    st = A.stage
    if st == "all":
        return stage_all(argv)
    design()
    resolve_defaults()
    os.makedirs(WORK, exist_ok=True)
    {"wall": stage_wall, "export": stage_export, "check": stage_check, "render": stage_render,
     "readme": stage_readme}.get(st, lambda: None)()
    if st == "body":
        stage_body(A.arg)
    elif st == "split":
        stage_split(A.arg)
    elif st == "quarter":
        stage_quarter(int(A.arg))
    log("done", st, A.arg or "")


if __name__ == "__main__":
    main(sys.argv[1:])
