"""Thales' theorem (LS), as Rwanda S2 "Thales' Theorem" teaches it: the mid-point theorem, Thales' theorem in triangles
and in trapezia, and its converse.

Four kinds of figure, lengths printed in centimetres, parallel lines marked with arrows:
- triangle: triangle ABC with D on AB and E on AC, DE parallel to BC. AD, DB and AE printed: find EC
  (AD/DB = AE/EC); or AD, AB and DE printed: find BC (AD/AB = DE/BC).
- midpoint: D and E are the mid-points of AB and AC (equal marks on the halves), BC (or DE) printed: the other.
- trapezium: trapezium ABCD with AB parallel to DC, and EF parallel to them, E on AD and F on BC; AE, ED and BF
  printed: find FC.
- converse: triangle ABC with D on AB and E on AC, four lengths printed, nothing marked parallel: is DE parallel to BC?
Every length asked is a whole number or a short decimal.
"""
from __future__ import annotations

import random
from fractions import Fraction

from matplotlib.patches import Polygon

from ..core import FILL_2, INK, NAMES, new_figure, short

ID = "thales"
KIND = "maths.geometry"
SUBJECT = "mathematics"
BANDS = ("LS",)
CONCEPTS = ("mathematics.similarity-thales-theorem", "mathematics.thales-theorem-trapezia", "mathematics.midpoint-theorem")
# A topic whose sections the book lists is reached only if its name or a section names Thales, similarity or mid-points.
NEEDS = r"thales|similar|mid ?-?point theorem|parallel projection"
AVOID = r"trigonometry|bearings|projection$"

LEADS = {"triangle": ["{n} draws triangle ABC with DE parallel to BC.", "{n} cuts triangle ABC with a line DE parallel to BC.",
                      "{n} marks D on AB and E on AC so that DE is parallel to BC.", "{n} sketches triangle ABC and the parallel line DE."],
         "midpoint": ["{n} joins the mid-points D and E of two sides of triangle ABC.",
                      "{n} marks the mid-points D of AB and E of AC.", "{n} draws the line joining two mid-points of triangle ABC.",
                      "{n} studies triangle ABC with D and E the mid-points of AB and AC."],
         "trapezium": ["{n} draws trapezium ABCD with EF parallel to its parallel sides.",
                       "{n} cuts trapezium ABCD with a line EF parallel to AB and DC.",
                       "{n} marks E on AD and F on BC so that EF is parallel to AB and DC.",
                       "{n} sketches a trapezium ABCD and a line EF parallel to its bases."],
         "converse": ["{n} measures the lengths on triangle ABC shown.", "{n} marks D on AB and E on AC with the lengths shown.",
                      "{n} draws a line DE across triangle ABC with the lengths shown.",
                      "{n} checks the lengths on triangle ABC."]}


def sample(rng: random.Random) -> dict:
    sub = rng.choice(["triangle", "triangle", "midpoint", "trapezium", "converse"])
    p = {"band": "LS", "sub": sub, "name": rng.choice(NAMES)}
    if sub == "triangle":
        ask = rng.choice(["EC", "BC"])
        while True:
            ad, db = rng.randint(2, 9), rng.randint(2, 9)
            ae, de = Fraction(rng.randint(2, 12)), Fraction(rng.randint(3, 12))
            if not 0.3 <= ad / (ad + db) <= 0.7:
                continue  # D well away from A and B, so their letters and lengths keep apart
            if ask == "EC" and (ae * db / ad * 10).denominator == 1 and ad != ae:
                p.update(ask=ask, ad=ad, db=db, ae=int(ae))
                return p
            if ask == "BC" and (de * (ad + db) / ad * 10).denominator == 1:
                p.update(ask=ask, ad=ad, ab=ad + db, de=int(de))
                return p
    if sub == "midpoint":
        bc = rng.randint(4, 24)
        p.update(ask=rng.choice(["DE", "BC"]), bc=bc)
        return p
    if sub == "trapezium":
        while True:
            ae, ed, bf = rng.randint(2, 9), rng.randint(2, 9), rng.randint(2, 12)
            if (Fraction(bf * ed, ae) * 10).denominator == 1 and ae != bf and 0.3 <= ae / (ae + ed) <= 0.7:
                p.update(ae=ae, ed=ed, bf=bf)
                return p
    while True:
        ad, db, ae = rng.randint(2, 9), rng.randint(2, 9), rng.randint(2, 9)
        parallel = rng.random() < 0.5
        if not 0.3 <= ad / (ad + db) <= 0.7:
            continue
        if parallel:
            ec = Fraction(ae * db, ad)
            if ec.denominator != 1:
                continue
            ec = int(ec)
        else:
            ec = rng.randint(2, 12)
            if not 0.25 <= ae / (ae + ec) <= 0.75 or abs(Fraction(ad, db) - Fraction(ae, ec)) < Fraction(1, 5):
                continue  # a near miss would not show on a drawing
        p.update(ad=ad, db=db, ae=ae, ec=ec)
        return p


# --- drawing ------------------------------------------------------------------------------------------------

def _arrow_mark(ax, p0, p1, n: int = 1) -> None:
    """Small arrowheads in the middle of a segment: the mark for parallel lines."""
    mx, my = (p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2
    dx, dy = p1[0] - p0[0], p1[1] - p0[1]
    L = (dx * dx + dy * dy) ** 0.5
    ux, uy = dx / L, dy / L
    for k in range(n):
        cx, cy = mx + (k - (n - 1) / 2) * 0.16 * ux, my + (k - (n - 1) / 2) * 0.16 * uy
        ax.plot([cx - 0.12 * ux + 0.08 * uy, cx, cx - 0.12 * ux - 0.08 * uy],
                [cy - 0.12 * uy - 0.08 * ux, cy, cy - 0.12 * uy + 0.08 * ux], color=INK, linewidth=1.3, gid="behind-mark")


def _tick(ax, p0, p1, n: int = 1) -> None:
    mx, my = (p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2
    dx, dy = p1[0] - p0[0], p1[1] - p0[1]
    L = (dx * dx + dy * dy) ** 0.5
    ux, uy = dx / L, dy / L
    for k in range(n):
        cx, cy = mx + (k - (n - 1) / 2) * 0.1 * ux, my + (k - (n - 1) / 2) * 0.1 * uy
        ax.plot([cx - 0.1 * uy, cx + 0.1 * uy], [cy + 0.1 * ux, cy - 0.1 * ux], color=INK, linewidth=1.3, gid="behind-tick")


def _lerp(a, b, t):
    return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)


def _side_text(ax, a, b, text, out, gid):
    """A length beside segment ab, pushed out on the side away from the point `out`."""
    mx, my = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2
    dx, dy = b[0] - a[0], b[1] - a[1]
    L = (dx * dx + dy * dy) ** 0.5
    nx, ny = -dy / L, dx / L
    if (out[0] - mx) * nx + (out[1] - my) * ny > 0:
        nx, ny = -nx, -ny
    half_w, half_h = 0.09 * len(text) + 0.05, 0.16  # the text's half size in drawing units, at 12 pt
    gap = abs(nx) * half_w + abs(ny) * half_h + 0.08  # far enough along the normal that no corner touches the side
    ax.text(mx + gap * nx, my + gap * ny, text, ha="center", va="center", fontsize=12, gid=gid)


def _num(v) -> str:
    return format(float(v), "g")


def _draw_triangle(p: dict):
    fig, ax = new_figure(6.0, 4.6)
    A, B, C = (2.2, 4.0), (0.0, 0.0), (5.4, 0.0)
    sub = p["sub"]
    if sub == "midpoint":
        t = 0.5
    elif sub == "triangle" and p["ask"] == "BC":
        t = p["ad"] / p["ab"]
    else:
        t = p["ad"] / (p["ad"] + p["db"])
    D = _lerp(A, B, t)
    u = t if sub != "converse" else p["ae"] / (p["ae"] + p["ec"])
    E = _lerp(A, C, u)
    ax.add_patch(Polygon([A, B, C], closed=True, facecolor=FILL_2, edgecolor=INK, linewidth=1.8, gid="behind-tri"))
    ax.plot([D[0], E[0]], [D[1], E[1]], color=INK, linewidth=1.6, gid="DE")
    centre = ((A[0] + B[0] + C[0]) / 3, (A[1] + B[1] + C[1]) / 3)
    for pt, lab, off in ((A, "A", (0, 0.3)), (B, "B", (-0.3, -0.15)), (C, "C", (0.3, -0.15)), (D, "D", (-0.32, 0.05)),
                         (E, "E", (0.32, 0.05))):
        ax.text(pt[0] + off[0], pt[1] + off[1], lab, ha="center", va="center", fontsize=13, fontweight="bold", gid=f"pt:{lab}")
    if sub != "converse":
        _arrow_mark(ax, D, E)
        _arrow_mark(ax, B, C)
    if sub == "midpoint":
        _tick(ax, A, D, 1)
        _tick(ax, D, B, 1)
        _tick(ax, A, E, 2)
        _tick(ax, E, C, 2)
        if p["ask"] == "DE":
            _side_text(ax, B, C, f"{p['bc']} cm", A, "len:BC")
        else:
            ax.text((D[0] + E[0]) / 2, D[1] - 0.3, f"{_num(Fraction(p['bc'], 2))} cm", ha="center", va="center", fontsize=12,
                    gid="len:DE")
    elif sub == "triangle" and p["ask"] == "BC":
        _side_text(ax, A, D, f"{p['ad']} cm", C, "len:AD")
        ax.text(-0.75, 2.0, f"AB = {p['ab']} cm", ha="center", va="center", fontsize=12, gid="len:AB")
        ax.text((D[0] + E[0]) / 2, D[1] + 0.3, f"{p['de']} cm", ha="center", va="center", fontsize=12, gid="len:DE")
    else:
        _side_text(ax, A, D, f"{p['ad']} cm", C, "len:AD")
        _side_text(ax, D, B, f"{p['db']} cm", C, "len:DB")
        _side_text(ax, A, E, f"{p['ae']} cm", B, "len:AE")
        if sub == "converse":
            _side_text(ax, E, C, f"{p['ec']} cm", B, "len:EC")
    ax.set_xlim(-1.6, 6.4)
    ax.set_ylim(-0.6, 4.5)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def _draw_trapezium(p: dict):
    fig, ax = new_figure(6.0, 4.4)
    A, B, C, D = (1.0, 3.6), (3.8, 3.6), (5.4, 0.0), (0.0, 0.0)
    t = p["ae"] / (p["ae"] + p["ed"])
    E, F = _lerp(A, D, t), _lerp(B, C, t)
    ax.add_patch(Polygon([A, B, C, D], closed=True, facecolor=FILL_2, edgecolor=INK, linewidth=1.8, gid="behind-trap"))
    ax.plot([E[0], F[0]], [E[1], F[1]], color=INK, linewidth=1.6, gid="EF")
    for seg in ((A, B), (E, F), (D, C)):
        _arrow_mark(ax, *seg)
    for pt, lab, off in ((A, "A", (-0.2, 0.25)), (B, "B", (0.2, 0.25)), (C, "C", (0.3, -0.15)), (D, "D", (-0.3, -0.15)),
                         (E, "E", (-0.32, 0.0)), (F, "F", (0.32, 0.0))):
        ax.text(pt[0] + off[0], pt[1] + off[1], lab, ha="center", va="center", fontsize=13, fontweight="bold", gid=f"pt:{lab}")
    _side_text(ax, A, E, f"{p['ae']} cm", C, "len:AE")
    _side_text(ax, E, D, f"{p['ed']} cm", C, "len:ED")
    _side_text(ax, B, F, f"{p['bf']} cm", D, "len:BF")
    ax.set_xlim(-1.2, 6.6)
    ax.set_ylim(-0.6, 4.2)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def draw(p: dict):
    return _draw_trapezium(p) if p["sub"] == "trapezium" else _draw_triangle(p)


# --- questions ----------------------------------------------------------------------------------------------

def _cm(v) -> list[str]:
    s = _num(v)
    return [s, f"{s} cm", f"{s}cm"]


def questions(p: dict, rng: random.Random) -> list:
    sub, name = p["sub"], p["name"]
    lead = rng.choice(LEADS[sub]).format(n=name)
    if sub == "triangle":
        if p["ask"] == "EC":
            v = Fraction(p["ae"] * p["db"], p["ad"])
            return [short(f"{lead} Find the length EC.", _num(v), _cm(v))]
        v = Fraction(p["de"] * p["ab"], p["ad"])
        return [short(f"{lead} Find the length BC.", _num(v), _cm(v))]
    if sub == "midpoint":
        if p["ask"] == "DE":
            v = Fraction(p["bc"], 2)
            return [short(f"{lead} Find the length DE.", _num(v), _cm(v))]
        return [short(f"{lead} Find the length BC.", str(p["bc"]), _cm(p["bc"]))]
    if sub == "trapezium":
        v = Fraction(p["bf"] * p["ed"], p["ae"])
        return [short(f"{lead} Find the length FC.", _num(v), _cm(v))]
    yes = Fraction(p["ad"], p["db"]) == Fraction(p["ae"], p["ec"])
    return [short(f"{lead} Is DE parallel to BC? Answer yes or no.", "yes" if yes else "no",
                  ["yes", "Yes"] if yes else ["no", "No"])]
