"""Turn a hornlab.io waveguide STEP into a 3D-printable horn: wall, lip, ribs, seam flanges, gussets,
a mounting foot, a throat part T and four quarters Q1-Q4, with STEP/STL exports, checks, previews and a README.

The inner (acoustic) surface is the STEP's own faces; material is only added outside it. The BEM JSON export
from hornlab.io gives the exact inner profiles used for the checks (and the mouth plane / rollback end).

Steps (each one runs in its own process; `all` runs them in order):
  wall                                     STEP solid (+ an outer layer if --wall is thicker than the STEP)
  body lip | seams | ribs | feet | holes   features fused one group at a time
  split T | split Qall                     throat part and the quarter ring (lap joint between them)
  quarter 1 | 2 | 3 | 4                    the quarters
  export | check | render | readme

Usage: python -I horn_print.py --step H.step --bem H.json --out DIR [options] <step> [arg]
"""
import argparse
import json
import math
import os
import subprocess
import sys
import time

import numpy as np

# ----------------------------------------------------------------------------
# Defaults (all overridable on the command line)
# ----------------------------------------------------------------------------
D = dict(
    step="os-maybe-build.step", bem="bem-30pt.json", out="print",
    wall="step",            # wall thickness (mm) or "step" to keep the STEP's shell
    seam_trim=2.0,          # outer layer stops this far off the seam planes (strip ribs close it)
    d_in=3.5,               # features start this deep inside the wall (in-plane)
    lip="auto",             # auto (ring unless the profile rolls back) | ring | none
    lip_out=5.0, lip_depth=6.0,
    rib_t=6.0, rib_h=15.0, rib_h_end=5.0, rib_taper=True, rib_ramp=15.0,
    rib_angles="60,120,240,300",
    seam_t=6.0, seam_h=15.0,
    bolt_d=4.5, dowel_d=4.0,
    bolt_f="0.2,0.55,0.85", dowel_f="0.37,0.72",   # positions along each seam (fraction of its length)
    gusset_t=6.0, gusset_r=60.0, gusset_h=35.0,
    split_z=55.0, joint_l=12.0, joint_rad_clr=0.10, joint_ax_clr=0.20,
    feet="center",          # center | pair | none
    foot_x=120.0,           # pair: foot centres at +-foot_x
    foot_w=None,            # default 120 (center) / 50 (pair)
    foot_depth=45.0, foot_t=8.0, foot_web_h=16.0,
    foot_fastener=None,     # m6 | screws (default m6 for center, screws for pair)
    build_vol="256,256,260",
    stl_tol=0.05, stl_ang=0.2,
)
RHO = {"PETG": 1.27, "ASA": 1.07}
SCREW_D, SCREW_CSK = 4.5, 9.0       # #8 wood screw, 90 deg countersink
M6_D, M6_CB, M6_FLOOR = 6.6, 13.0, 3.0
GUSSET_EDGE = 3.0
PARTS = ["T", "Q1", "Q2", "Q3", "Q4"]
QUAD = {1: (1, 1), 2: (-1, 1), 3: (-1, -1), 4: (1, -1)}
# ----------------------------------------------------------------------------

from build123d import (Align, Box, Compound, Edge, Face, Location, Plane, Solid, Vector, Wire,  # noqa: E402
                       export_brep, export_step, extrude, import_brep, import_step, loft, make_face,
                       offset, thicken)

T0 = time.time()
A = None        # parsed options
WORK = None


def log(*a):
    print(f"[{time.time() - T0:6.1f}s]", *a, flush=True)


def flist(s):
    return tuple(float(v) for v in str(s).split(","))


def parse(argv):
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    for k, v in D.items():
        name = "--" + k.replace("_", "-")
        if isinstance(v, bool):
            p.add_argument(name, dest=k, action=argparse.BooleanOptionalAction, default=v)
        elif isinstance(v, float):
            p.add_argument(name, dest=k, type=float, default=v)
        else:
            p.add_argument(name, dest=k, default=v)
    p.add_argument("stage")
    p.add_argument("arg", nargs="?")
    a = p.parse_args(argv)
    if a.foot_w is None:
        a.foot_w = 120.0 if a.feet == "center" else 50.0
    a.foot_w = float(a.foot_w)
    if a.foot_fastener is None:
        a.foot_fastener = "m6" if a.feet == "center" else "screws"
    return a


# ---------------------------------------------------------------- inputs
def load_step():
    s = import_step(A.step)
    planes = [f for f in s.faces() if f.geom_type.name == "PLANE"]
    flange_back = max(f.center().Z for f in planes)
    inner, outer, lipf = [], [], []
    for f in s.faces():
        if f.geom_type.name != "BSPLINE":
            continue
        bb = f.bounding_box()
        if bb.min.Z < 1:
            inner.append(f)
        elif abs(bb.min.Z - flange_back) < 1:
            outer.append(f)
        else:
            lipf.append(f)
    return s, inner, outer, lipf, flange_back


def profiles():
    d = json.load(open(A.bem))
    pr = d["design"]["profile"]
    P = {k: np.array([[p["r"], p["z"]] for p in pr[k]]) for k in ("h", "v")}   # (r, z)
    z_mouth = max(P["h"][:, 1].max(), P["v"][:, 1].max())
    rollback = P["h"][-1, 1] < z_mouth - 0.5
    z_end = min(P["h"][-1, 1], P["v"][-1, 1])
    return P, z_mouth, rollback, z_end, d


def info(name):
    return json.load(open(f"{WORK}/{name}.json"))


def wall_t():
    return info("step_info")["wall_t"]


# ---------------------------------------------------------------- 2D helpers
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


def section_curve(inner, theta=None, x0=None, side=None):
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
    """Radius of curvature where the centre lies on the wall side (offsets toward it shrink); inf elsewhere."""
    R = np.full(len(c), np.inf)
    for i in range(step, len(c) - step):
        p0, p1, p2 = c[i - step], c[i], c[i + step]
        a, b, cc = np.linalg.norm(p1 - p0), np.linalg.norm(p2 - p1), np.linalg.norm(p2 - p0)
        cr = (p1 - p0)[0] * (p2 - p0)[1] - (p1 - p0)[1] * (p2 - p0)[0]
        if abs(cr) < 1e-9:
            continue
        r = a * b * cc / (2 * abs(cr))
        centre_dir = (p0 + p2) / 2 - p1
        if centre_dir @ n[i] > 0:
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
    add = wt - step_wall
    log(f"STEP wall {step_wall:.3f} (min {min(ds):.3f}, max {max(ds):.3f}); building {wt:.2f}")
    bb = s.bounding_box()
    json.dump({"step_wall": step_wall, "wall_min": min(ds), "wall_max": max(ds), "wall_t": wt, "added": add,
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
    rib_z0 = A.split_z + A.joint_ax_clr
    g = {"lip": [], "seams": [], "ribs": [], "feet": []}
    out = {"notes": []}
    lip = A.lip if A.lip != "auto" else ("none" if rollback else "ring")
    out["lip"] = lip
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
        P, n2 = mouth_points(inner, z_mouth)
        f_out = ring_face(P, n2, ext + A.lip_out, z_mouth)
        f_in = ring_face(P, n2, max(0.02, min(0.3, 0.5 * cross)), z_mouth)
        g["lip"].append(extrude(f_out - f_in, amount=A.lip_depth, dir=(0, 0, -1)))
        lb = f_out.bounding_box()
        y_lid = min(y_lid, lb.min.Y)
        out.update(lip_roll_extent=ext, lip_roll_crest=crest, lip_outer=[lb.size.X, lb.size.Y])
    out["y_lid"] = y_lid

    rib_angles = flist(A.rib_angles)
    seams = (0.0, 90.0, 180.0, 270.0)
    curves = {th: section_curve(inner, theta=th) for th in sorted(set(seams) | set(rib_angles))}
    # strip ribs on T where the outer layer leaves the seam planes bare
    if si["added"] > 0.01:
        for th in seams:
            sg, *_ = band(curves[th], A.d_in, wt + 1.5, fb - 0.5, zmax=A.split_z + 1.0)
            g["seams"].append(solid_from_poly(sg, 2 * A.seam_trim + 2.0, theta=th))
    seam_info = {}
    for th in seams:
        c = curves[th]
        n = normals(c)
        d1 = limit_offset(np.full(len(c), wt + A.seam_h), c, n)
        sg, cc, nn, dd = band(c, A.d_in, d1, rib_z0)
        if segs_cross(sg[2], c):
            raise SystemExit(f"seam flange {th} crosses the inner surface")
        g["seams"].append(solid_from_poly(sg, 2 * A.seam_t, theta=th))
        seam_info[th] = (cc, nn, dd)
    for th in rib_angles:
        c = curves[th]
        n = normals(c)
        k = int(np.argmax(c[:, 1] >= rib_z0))
        d1_full = np.full(len(c), wt + A.rib_h)
        d1_full[k:] = wt + rib_heights(c[k:], A.rib_h, A.rib_h_end)
        d1 = limit_offset(d1_full, c, n)
        sg, *_ = band(c, A.d_in, d1, rib_z0)
        if segs_cross(sg[2], c):
            raise SystemExit(f"rib {th} crosses the inner surface")
        g["ribs"].append(solid_from_poly(sg, A.rib_t, theta=th))
    for th in seams:   # gussets at 0/90/180/270; the driver bolts are on the diagonals
        c = prefix_until(curves[th], fb + A.gusset_h)
        a, _ = clip_start(c + A.d_in * normals(c), fb - 1)
        e1, e2 = [A.gusset_r, fb + GUSSET_EDGE], [A.gusset_r, fb - 1]
        g["ribs"].append(solid_from_poly([a, np.array([a[-1], e1]), np.array([e1, e2]), np.array([e2, a[0]])],
                                         A.gusset_t, theta=th))

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
        cin = cin[: int(np.argmax(cin[:, 1])) + 1]                # main branch, bottom centre
        zs = np.linspace(front, web_z0, 40)
        u_edge = np.maximum(u_web, np.interp(zs, cin[:, 1], cin[:, 0]) + A.d_in)   # never into the air
        pts = [[u_mid, web_z0], [u_mid, front]]
        if rollback:          # step up into the seam flange behind the roll end, clear of the acoustic edge
            u_r = -y_lid - 10.0
            pts += [[u_r, front], [u_r, front + 3.0], [u_web, front + 3.0]]
        pts += [[u, z] for u, z in zip(u_edge, zs)]
        pts = np.array(pts)
        g["feet"].append(solid_from_poly([np.array([pts[i], pts[(i + 1) % len(pts)]]) for i in range(len(pts))],
                                         2 * A.seam_t, x0=0.0, side=-1))
        bolt_u, bolt_z = u_top - 7.0, (web_z0 + front) / 2
        holes.append(("bolt", Solid.make_cylinder(A.bolt_d / 2, 2 * A.seam_t + 4,
                                                  Plane(origin=(-(A.seam_t + 2), -bolt_u, bolt_z), z_dir=(1, 0, 0)))))
        foot.update(width=A.foot_w, depth=A.foot_depth, thick=A.foot_t, web_h=A.foot_web_h, web_t=2 * A.seam_t,
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
                a, _ = clip_start(c + A.d_in * normals(c), z0)
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
        ok = dd >= hole_off + 6.0                      # flange tall enough for a head / nut here
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
def mid_contour(inner, z, d):
    """Closed contour at height z, d (normal) outside the inner surface."""
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
            out.append(Vector(x, y, z))
            last = a
    if abs(pts[-1][0] - pts[0][0] - 2 * math.pi) < 2e-3:
        out = out[:-1]
    return Edge.make_spline(out, periodic=True)


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
        }
        log(p, res["parts"][p])
    m = trimesh.load(f"{A.out}/part_Q1.stl")
    idx = np.random.default_rng(1).choice(len(m.faces), 300, replace=False)
    res["stl_centroid_dev_Q1_max_mm"] = max(
        BRepExtrema_DistShapeShape(BRepBuilderAPI_MakeVertex(gp_Pnt(*map(float, c))).Vertex(), parts["Q1"].wrapped).Value()
        for c in m.triangles_center[idx])
    body = import_brep(f"{WORK}/body.brep")
    res["body_valid"] = bool(BRepCheck_Analyzer(body.wrapped).IsValid()) and len(body.solids()) == 1

    # inner surface vs the BEM profiles: section just inside each symmetry half-plane
    prof, z_mouth, rollback, z_end, _ = profiles()

    def seg_dist(q, poly):
        a, b = poly[:-1], poly[1:]
        ab = b - a
        t = np.clip(((q - a) * ab).sum(1) / np.maximum((ab * ab).sum(1), 1e-12), 0, 1)
        return float(np.min(np.linalg.norm(a + t[:, None] * ab - q, axis=1)))

    rows, intr = [], 0
    for plane, k in (("H", "h"), ("V", "v")):
        P = prof[k]                                     # (r, z)
        e = P[-1] + [0, 0.2]           # 0.2 mm allowance past the profile end (lip roll crest, lip face)
        air = Path(np.vstack([[0, -1], P, e, [e[0] + 5000, e[1]], [e[0] + 5000, 5000], [0, 5000]]))
        for sgn in (1, -1):
            if plane == "H":
                qs = "Q1" if sgn > 0 else "Q2"
                pl = Plane(origin=(0, 1e-3, 0), x_dir=(1, 0, 0), z_dir=(0, -1, 0))
            else:
                qs = "Q1" if sgn > 0 else "Q4"
                pl = Plane(origin=(1e-3, 0, 0), x_dir=(0, 1, 0), z_dir=(1, 0, 0))
            polys = []
            for pn in ("T", qs):
                sec = parts[pn].intersect(Face.make_rect(4000, 4000, pl))
                for e in ([] if sec is None else sec.edges()):
                    ts = np.linspace(0, 1, max(50, int(e.length / 0.05)))
                    polys.append(np.array([[sgn * e.position_at(t).dot(pl.x_dir), e.position_at(t).Z] for t in ts]))
            allp = np.concatenate(polys)
            cand = allp[(allp[:, 0] > 0) & air.contains_points(allp)]
            intr += sum(1 for q in cand if seg_dist(q, P) > 0.2)
            for i in list(range(1, len(P) - 1, 8)) + [len(P) - 2]:
                d = min(seg_dist(P[i], pp) for pp in polys)
                rows.append((plane, sgn, round(float(P[i, 1]), 3), round(float(P[i, 0]), 3), round(d, 4)))
    res["inner_check"] = rows
    res["inner_max_dev_mm"] = max(r[4] for r in rows)
    res["inner_points"] = len(rows)
    res["inner_failures"] = sum(1 for r in rows if r[4] > 0.2)
    res["air_intrusion_points"] = intr
    log("inner surface max deviation", res["inner_max_dev_mm"], "of", len(rows), "points; air-side points", intr)
    json.dump(res, open(f"{WORK}/check.json", "w"), indent=1)


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
    th = flist(A.rib_angles)[0]
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
                  + (f"{A.rib_h:.0f} -> {A.rib_h_end:.0f} mm" if A.rib_taper else f"{A.rib_h:.0f} mm"))
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
def stage_readme():
    si, bi, ck = info("step_info"), info("body_info"), info("check")
    P = ck["parts"]
    wt = si["wall_t"]
    vol = flist(A.build_vol)
    rows, tot = [], {"v": 0.0, "PETG": 0, "ASA": 0}
    names = {"T": f"Throat: flange + flare to z = {A.split_z + A.joint_l:.0f}", "Q1": "Quarter +x/+y (top)",
             "Q2": "Quarter -x/+y (top)", "Q3": "Quarter -x/-y (bottom)", "Q4": "Quarter +x/-y (bottom)"}
    for p in PARTS:
        d = P[p]
        f = d["fit"]
        how = "flange (z = 0) down" if p == "T" else f"throat end (z = {A.split_z + A.joint_ax_clr:.1f}) down, mouth up"
        if f is None:
            fit = "DOES NOT FIT"
        else:
            rot = "axis-aligned" if f["rot_deg"] == 0 else f"turned {f['rot_deg']} deg on the bed"
            fit = f"{how}; {rot}, footprint {f['footprint'][0]:.1f} x {f['footprint'][1]:.1f}, {f['height']:.1f} high"
        bx = d["bbox_xyz"]
        rows.append(f"| {p} | {names[p]} | {bx[0]:.1f} x {bx[1]:.1f} x {bx[2]:.1f} | {fit} | {d['volume_cm3']:.0f} | "
                    f"{d['mass_g']['PETG']} | {d['mass_g']['ASA']} |")
        tot["v"] += d["volume_cm3"]
        tot["PETG"] += d["mass_g"]["PETG"]
        tot["ASA"] += d["mass_g"]["ASA"]
    rows.append(f"| all | | | | {tot['v']:.0f} | {tot['PETG']} | {tot['ASA']} |")
    ft = bi["foot"]
    cnt = bi["counts"]
    zm = si["z_mouth"]
    lip_txt = ("none added: the profile rolls back, and the outside of the roll is part of the acoustic surface. "
               "The roll is the stiff edge; the ribs and seam flanges follow the wall around under the roll to its end."
               if bi["lip"] == "none" else
               f"{A.lip_out:.0f} mm outward from the outer wall, {A.lip_depth:.0f} mm deep, front face on the mouth plane; "
               f"outside {bi['lip_outer'][0]:.1f} x {bi['lip_outer'][1]:.1f} mm. The inner edge keeps the STEP's lip roll "
               f"(tangent to the flare; crest {bi['lip_roll_crest'] - zm:.3f} mm proud of the lip face).")
    rib_txt = (f"{A.rib_t:.0f} mm thick, {A.rib_h:.0f} mm tall at the rear easing to {A.rib_h_end:.0f} mm at the "
               f"{'roll end' if si['rollback'] else 'lip'} (cosine taper, 45 deg ramp at the rear end)" if A.rib_taper
               else f"{A.rib_t:.0f} mm thick, {A.rib_h:.0f} mm tall")
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
    hw = [f"- {cnt['bolt']} x M4 x 20 bolts, {cnt['bolt']} x M4 nuts, {2 * cnt['bolt']} x M4 washers (seam flanges"
          f"{', incl. 1 through the foot web' if ft['mode'] == 'center' else ''}).",
          f"- {cnt['dowel']} x dowel pins 4 x 12 mm (holes printed at 4.0 mm; drill or ream to a press fit).",
          "- 4 x M6 bolts, nuts and washers for the driver (12 mm horn flange + driver flange + washer + nut; typically M6 x 30-35)."]
    if ft["mode"] == "center" and ft["fastener"] == "m6":
        hw.append("- Foot: 1 x M6 button head bolt (ISO 7380, low head so it sits flush), length to suit, about 20-25 mm "
                  "into the lid; 1 x M6 washer; 1 x M6 threaded insert or T-nut in the box lid.")
    elif ft["mode"] != "none":
        n = 3 if ft["mode"] == "center" else 4
        hw.append(f"- Foot: {n} x #8 countersunk wood screws, 3/4 to 1 in.")
    hw.append("- The rear of the driver rests on a separate L-bracket (not included).")
    notes = "".join(f"- {n}\n" for n in bi["notes"])
    roll_note = ("- Some seam bolts sit under the roll: reach them from behind, through the gap between the roll end "
                 "and the wall. The foot cannot be flush with the mouth plane: the space below the roll belongs to the "
                 "rollback, so the foot starts just behind the roll end.\n" if si["rollback"] else "")
    txt = f"""# Printable horn: {os.path.basename(A.step)}

Built by `horn_print.py` from `{os.path.basename(A.step)}` and `{os.path.basename(A.bem)}`.
The inner (acoustic) surface is the STEP's own faces, untouched; all material is added outside it.
Coordinates: z along the axis (throat z = 0, mouth plane z = {zm:.2f}), x wide, y tall, +y up, foot on -y.

## Parts

| Part | What | Bounding box x y z (mm) | Print orientation (fits {vol[0]:.0f} x {vol[1]:.0f} x {vol[2]:.0f}) | Volume (cm3) | PETG (g) | ASA (g) |
|---|---|---|---|---|---|---|
""" + "\n".join(rows) + f"""

Masses are for solid parts (100 % infill; PETG 1.27, ASA 1.07 g/cm3). Prints with partial infill weigh less.

Files: `horn_assembled.step` (one solid), `horn_parts_assembly.step` (the five parts in place), `part_<P>.step`,
`part_<P>.stl` (chord tolerance {A.stl_tol} mm), `preview_*.png`, `_work/` (intermediate BREPs and check data).

## Geometry

- STEP: {si['faces']['inner']} inner B-spline faces, {si['faces']['outer']} outer, {si['faces']['lip_or_end']} lip/end faces, flange and holes;
  shell {si['step_wall']:.2f} mm{'; the profile rolls back (inner surface ends at z = %.1f)' % si['z_end'] if si['rollback'] else ''}.
- Wall: {wt:.2f} mm{' (STEP shell plus a %.2f mm outer layer)' % si['added'] if si['added'] > 0.01 else ' (the STEP shell as designed)'}.
- Lip: {lip_txt}
- Ribs: radial at {A.rib_angles} deg (two per wide wall), {rib_txt}, from z = {A.split_z + A.joint_ax_clr:.1f}.
- Seam flanges: on the 4 quarter seams, {2 * A.seam_t:.0f} mm thick ({A.seam_t:.0f} per quarter), {A.seam_h:.0f} mm tall
  (kept straight so the M4 heads and nuts have room; lowered only where the wall bends tighter than the flange height).
  They act as the centre rib of each wide wall and the rib of each side wall. 3 M4 holes ({A.bolt_d} mm) and 2 dowel
  holes ({A.dowel_d} mm) per seam.
- Driver flange: from the STEP (130 mm round, 12 mm, 36 mm throat, 4 x 6.6 mm on 101.6 mm at 45 deg). 4 gussets
  ({A.gusset_t:.0f} mm, to r = {A.gusset_r:.0f}, {A.gusset_h:.0f} mm up the wall) at 0/90/180/270 deg, clear of the bolts and the M6 nuts.
- T / quarter joint: lap joint. T keeps the inner {wt / 2:.1f} mm of the wall up to z = {A.split_z + A.joint_l:.0f}, the quarters
  the outer part from z = {A.split_z:.0f}; {A.joint_rad_clr} mm radial and {A.joint_ax_clr} mm axial clearance on hidden faces,
  zero gap at the inner seam. Close the quarters around T's tongue; the flare taper then holds T.
- Foot: {foot_txt}
{notes}
## Hardware

""" + "\n".join(hw) + f"""

## Print notes

- ASA in an enclosed printer; otherwise PETG. Not PLA.
- 4+ perimeters. T at 100 % infill; quarters 40-50 % gyroid (100 % near the joint and the foot).
- T: flange down, no supports. Quarters: throat end down; the inner surface faces up or sideways and needs no
  support. Support the outer wall, {'the underside of the roll, ' if si['rollback'] else 'the lip, '}the ribs and the foot from the build plate
  only (tree supports), never on the inner surface. Use a brim.
{roll_note}
## Checks (`_work/check.json`)

- Solids valid: """ + ", ".join(f"{p} {'yes' if P[p]['valid'] else 'NO'}" for p in PARTS) + f"""; assembled solid {'yes' if ck['body_valid'] else 'NO'}.
- STL watertight: """ + ", ".join(f"{p} {'yes' if P[p]['stl_watertight'] else 'NO'}" for p in PARTS) + f"""; triangle centroids within
  {ck['stl_centroid_dev_Q1_max_mm']:.3f} mm of the solid (Q1, 300 samples).
- Inner surface vs the BEM profiles ({ck['inner_points']} points along both planes, both sides{', including the rollback' if si['rollback'] else ''}):
  max distance {ck['inner_max_dev_mm']:.4f} mm; {ck['air_intrusion_points']} section points more than 0.2 mm on the air side.
- Build volume: """ + ("every part fits (see table)." if all(P[p]["fit"] for p in PARTS) else "SOME PARTS DO NOT FIT.") + "\n"
    open(f"{A.out}/README.md", "w").write(txt)
    log("README written")


# ---------------------------------------------------------------- driver
def stage_all(argv):
    steps = [["wall"]] + [["body", s] for s, *_ in BODY_STEPS] + [["split", "T"], ["split", "Qall"]] + \
            [["quarter", str(k)] for k in (1, 2, 3, 4)] + [["export"], ["check"], ["render"], ["readme"]]
    opts = [a for a in argv if a != "all"]
    for st in steps:
        log("==>", *st)
        subprocess.run([sys.executable, "-I", os.path.abspath(__file__)] + opts + st, check=True)


def main(argv):
    global A, WORK
    A = parse(argv)
    A.out = os.path.abspath(A.out)
    WORK = f"{A.out}/_work"
    os.makedirs(WORK, exist_ok=True)
    st = A.stage
    if st == "all":
        return stage_all(argv)
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
