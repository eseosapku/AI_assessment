"""Equilibrium of a rigid body (AL, Further Mathematics "Equilibrium of a rigid body"): moments and centres of mass.

Three kinds of figure:
- lamina: a uniform lamina drawn on a centimetre grid with axes Ox and Oy -- an L-shape made of two rectangles, or a
  rectangle with a rectangular hole cut out. The x- or y-coordinate of its centre of mass (exact; a fraction is fine).
- beam: a uniform beam AB resting horizontally on two supports C and D, its weight and a load printed in newtons at
  marked distances. The reaction at C or at D (taking moments), or the load that makes the beam about to tip.
- rod: a light or uniform rod AB with weights hanging at its ends. Where to place a single support so it balances.
Every distance is a whole number of centimetres or metres, every key exact.
"""
from __future__ import annotations

import random
from fractions import Fraction

from matplotlib.patches import Polygon, Rectangle

from ..core import FILL_2, INK, NAMES, function_axes, new_figure
from ._mech import answer, arrow, fmt, hatch

ID = "rigid_body_m"
KIND = "physics.force"
SUBJECT = "mathematics"
BANDS = ("AL",)
CONCEPTS = ("mathematics.centres-mass-rods-laminas", "mathematics.moment-force")
# A topic whose sections the book lists is reached only if its name or a section names moments or centres of mass
# ("momentum" is not "moment").
NEEDS = r"\bmoments?\b|centres? of mass|rigid body"
AVOID = r"^(?!.*(rigid|moment|centre of mass|equilibrium))"

LEADS = {"lamina": ["{n} cuts a uniform lamina from a sheet of card, as shown on the grid.",
                    "{n} draws a uniform lamina on a centimetre grid.", "{n} makes a uniform metal plate shaped as shown.",
                    "{n} studies the uniform lamina shown, with axes Ox and Oy."],
         "beam": ["{n} rests a uniform beam AB on two supports C and D.", "{n} places a plank AB on two trestles C and D.",
                  "{n} sets a uniform beam AB horizontally on supports at C and D.",
                  "{n} loads a uniform beam AB that rests on supports C and D."],
         "rod": ["{n} hangs weights from the ends of a rod AB.", "{n} balances a rod AB with weights at its ends.",
                 "{n} wants to balance the rod AB, with weights at its ends, on one support.",
                 "{n} finds the balance point of a rod AB carrying weights at its ends."]}


def sample(rng: random.Random) -> dict:
    sub = rng.choice(["lamina", "beam", "rod"])
    p = {"band": "AL", "sub": sub, "name": rng.choice(NAMES)}
    if sub == "lamina":
        shape = rng.choice(["L", "hole"])
        while True:
            if shape == "L":
                w1, h1 = rng.randint(2, 6), rng.randint(4, 8)  # the upright
                w2, h2 = rng.randint(2, 6), rng.randint(1, h1 - 2)  # the foot, to its right
                rects = [[0, 0, w1, h1], [w1, 0, w2, h2]]
                hole = None
            else:
                W, H = rng.randint(5, 9), rng.randint(4, 8)
                hw, hh = rng.randint(1, W - 3), rng.randint(1, H - 3)
                hx, hy = rng.randint(1, W - hw - 1), rng.randint(1, H - hh - 1)
                rects = [[0, 0, W, H]]
                hole = [hx, hy, hw, hh]
                if 2 * hx + hw == W and 2 * hy + hh == H:
                    continue  # a hole in the middle leaves the centre where it was
            p.update(shape=shape, rects=rects, hole=hole, ask=rng.choice(["x", "y"]))
            return p
    if sub == "beam":
        while True:
            L = rng.randint(4, 10)
            c, d = rng.randint(0, L // 2 - 1), rng.randint(L // 2 + 1, L)
            W = rng.choice(range(40, 301, 20))
            P = rng.choice(range(20, 201, 10))
            xp = rng.randint(0, L)
            rd = (Fraction(W * L, 2) - W * c + P * (xp - c)) / (d - c)  # moments about C
            rc = W + P - rd
            if rd > 0 and rc > 0 and (rd * 10).denominator == 1 and (rc * 10).denominator == 1 and xp not in (c, d):
                p.update(L=L, c=c, d=d, W=W, P=P, xp=xp, ask=rng.choice(["C", "D"]))
                return p
    while True:
        L = rng.choice([1, 2, 3, 4, 5, 6])
        W = rng.choice([0, 10, 20, 30, 40])
        p1, p2 = rng.choice(range(10, 81, 5)), rng.choice(range(10, 81, 5))
        x = (Fraction(W * L, 2) + p2 * L) / (W + p1 + p2)
        if p1 != p2 and (x * 100).denominator == 1:
            p.update(L=L, W=W, P1=p1, P2=p2)
            return p


# --- the mechanics --------------------------------------------------------------------------------------------

def lamina_centre(p: dict) -> tuple[Fraction, Fraction]:
    area, mx, my = Fraction(0), Fraction(0), Fraction(0)
    for x, y, w, h in p["rects"]:
        a = Fraction(w * h)
        area += a
        mx += a * (x + Fraction(w, 2))
        my += a * (y + Fraction(h, 2))
    if p["hole"]:
        x, y, w, h = p["hole"]
        a = Fraction(w * h)
        area -= a
        mx -= a * (x + Fraction(w, 2))
        my -= a * (y + Fraction(h, 2))
    return mx / area, my / area


def beam_reactions(p: dict) -> tuple[Fraction, Fraction]:
    L, c, d, W, P, xp = p["L"], p["c"], p["d"], p["W"], p["P"], p["xp"]
    rd = (Fraction(W * L, 2) - W * c + P * (xp - c)) / (d - c)
    return W + P - rd, rd


# --- drawing ------------------------------------------------------------------------------------------------

def _draw_lamina(p: dict):
    xs = [x + w for x, y, w, h in p["rects"]]
    ys = [y + h for x, y, w, h in p["rects"]]
    X, Y = max(xs) + 1, max(ys) + 1
    fig, ax = new_figure(min(6.4, 0.55 * X + 1.6), min(6.0, 0.55 * Y + 1.2))
    function_axes(ax, 0, X, 0, Y)
    ax.set_xlim(-0.6, X + 0.5)
    ax.set_ylim(-0.6, Y + 0.5)
    for i, (x, y, w, h) in enumerate(p["rects"]):
        ax.add_patch(Rectangle((x, y), w, h, facecolor=FILL_2, edgecolor="none", zorder=1, gid=f"behind-rect:{i}"))
    if p["shape"] == "L":
        (x1, y1, w1, h1), (x2, y2, w2, h2) = p["rects"]
        outline = [(0, 0), (w1 + w2, 0), (w1 + w2, h2), (w1, h2), (w1, h1), (0, h1)]
    else:
        (x1, y1, w1, h1), = p["rects"]
        outline = [(0, 0), (w1, 0), (w1, h1), (0, h1)]
        hx, hy, hw, hh = p["hole"]
        ax.add_patch(Rectangle((hx, hy), hw, hh, facecolor="white", edgecolor=INK, linewidth=1.6, zorder=2, gid="behind-hole"))
    ax.add_patch(Polygon(outline, closed=True, fill=False, edgecolor=INK, linewidth=1.8, zorder=3, gid="behind-outline"))
    ax.set_xlabel("x (cm)", fontsize=10)
    ax.set_ylabel("y (cm)", fontsize=10)
    ax.set_aspect("equal")
    return fig


def _draw_beam(p: dict):
    L, c, d, W, P, xp = p["L"], p["c"], p["d"], p["W"], p["P"], p["xp"]
    s = 7.0 / L
    fig, ax = new_figure(7.6, 3.6)
    ax.add_patch(Rectangle((0, 0), L * s, 0.25, facecolor="#d9c49a", edgecolor=INK, linewidth=1.6, gid="behind-beam"))
    for x, lab in ((c, "C"), (d, "D")):
        X = x * s
        ax.add_patch(Polygon([(X, 0), (X - 0.22, -0.4), (X + 0.22, -0.4)], closed=True, facecolor=FILL_2, edgecolor=INK,
                             linewidth=1.3, gid=f"behind-support:{lab}"))
        ax.text(X, -0.62, lab, ha="center", va="center", fontsize=12, fontweight="bold", gid=f"pt:{lab}")
    ax.text(-0.25, 0.12, "A", ha="right", va="center", fontsize=12, fontweight="bold", gid="pt:A")
    ax.text(L * s + 0.25, 0.12, "B", ha="left", va="center", fontsize=12, fontweight="bold", gid="pt:B")
    arrow(ax, L * s / 2, 0.25, L * s / 2, -1.05, gid="weight")
    ax.text(L * s / 2 + 0.12, -0.9, f"{W} N", ha="left", va="center", fontsize=11, gid="W")
    arrow(ax, xp * s, 1.35, xp * s, 0.28, gid="load")
    ax.text(xp * s + 0.12, 1.2, f"{P} N", ha="left", va="center", fontsize=11, gid="P")
    marks = sorted({0, c, d, xp, L})
    y = 1.85
    ax.plot([0, L * s], [y, y], color=INK, linewidth=0.8, gid="behind-scale")
    for x in marks:
        ax.plot([x * s, x * s], [y - 0.08, y + 0.08], color=INK, linewidth=0.8, gid="behind-scale")
    for a, b in zip(marks, marks[1:]):
        ax.text((a + b) / 2 * s, y + 0.2, f"{b - a} m", ha="center", va="bottom", fontsize=10, gid=f"gap:{a}")
    ax.text(L * s, -1.35, "uniform beam, weight acting at its centre", ha="right", va="center", fontsize=9, gid="note")
    ax.set_xlim(-0.7, L * s + 0.7)
    ax.set_ylim(-1.55, 2.45)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def _draw_rod(p: dict):
    L, W, p1, p2 = p["L"], p["W"], p["P1"], p["P2"]
    fig, ax = new_figure(7.0, 3.2)
    R = 6.0
    ax.add_patch(Rectangle((0, 0), R, 0.16, facecolor="#d9c49a", edgecolor=INK, linewidth=1.6, gid="behind-rod"))
    for x, lab, w in ((0, "A", p1), (R, "B", p2)):
        ax.plot([x, x], [0, -0.7], color=INK, linewidth=1.0, gid=f"string:{lab}")
        ax.add_patch(Rectangle((x - 0.3, -1.25), 0.6, 0.55, facecolor=FILL_2, edgecolor=INK, linewidth=1.3,
                               gid=f"behind-weight:{lab}"))
        ax.text(x, -0.975, f"{w} N", ha="center", va="center", fontsize=10, gid=f"w:{lab}")
        ax.text(x + (-0.35 if lab == "A" else 0.35), 0.35, lab, ha="center", va="center", fontsize=12, fontweight="bold",
                gid=f"pt:{lab}")
    ax.plot([0, R], [0.75, 0.75], color=INK, linewidth=0.8, gid="behind-scale")
    for x in (0, R):
        ax.plot([x, x], [0.67, 0.83], color=INK, linewidth=0.8, gid="behind-scale")
    ax.text(R / 2, 0.95, f"AB = {L} m", ha="center", va="bottom", fontsize=11, gid="L")
    note = "light rod" if W == 0 else f"uniform rod, weight {W} N"
    ax.text(R / 2, -0.55, note, ha="center", va="center", fontsize=11, gid="note")
    ax.set_xlim(-0.8, R + 0.8)
    ax.set_ylim(-1.45, 1.4)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def draw(p: dict):
    return {"lamina": _draw_lamina, "beam": _draw_beam, "rod": _draw_rod}[p["sub"]](p)


# --- questions ----------------------------------------------------------------------------------------------

def questions(p: dict, rng: random.Random) -> list:
    sub, name = p["sub"], p["name"]
    lead = rng.choice(LEADS[sub]).format(n=name)
    if sub == "lamina":
        cx, cy = lamina_centre(p)
        v = cx if p["ask"] == "x" else cy
        return [answer(f"{lead} Find the {p['ask']}-coordinate of the centre of mass of the lamina, in centimetres.", v, "cm")]
    if sub == "beam":
        rc, rd = beam_reactions(p)
        v = rc if p["ask"] == "C" else rd
        return [answer(f"{lead} Find the magnitude of the reaction at {p['ask']}, in newtons.", v, "N")]
    L, W, p1, p2 = p["L"], p["W"], p["P1"], p["P2"]
    x = (Fraction(W * L, 2) + p2 * L) / (W + p1 + p2)
    return [answer(f"{lead} How far from A, in metres, must the support be for the rod to balance horizontally?", x, "m")]
