"""Algebraic fractions met in shapes and journeys (LS, UP), as Rwanda S3 "Algebraic Fractions" (simplifying, adding
fractions with linear denominators) and the WAEC/JAMB algebra syllabuses teach them.

Two kinds of figure, every expression printed in the figure:
- area: a rectangle whose area (a quadratic such as x² + 7x + 12) and one side (x + 3) are printed. Its other side is
  the algebraic fraction (x² + 7x + 12)/(x + 3) simplified. (MCQ: the sign and the number varied, 2 by 2.)
- journey: a route from A to B through C, each leg's distance and speed printed (60 km at x km/h, then 40 km at
  (x + 10) km/h). The total time as one fraction (MCQ: the numerators paired wrongly, or the denominators added).
"""
from __future__ import annotations

import random

from matplotlib.patches import Circle, Rectangle

from ..core import FILL_2, INK, NAMES, mcq, new_figure

ID = "algebraic_fraction"
KIND = "maths.geometry"
SUBJECT = "mathematics"
BANDS = ("LS", "UP")
CONCEPTS = ("mathematics.algebraic-fractions", "mathematics.algebraic-fractions-linear-denominators",
            "mathematics.algebraic-fractions-simplifying")
# A topic whose sections the book lists is reached only if its name or a section names algebraic fractions.
NEEDS = r"algebraic fraction|algebraic process|fractions? with|algebra"
AVOID = r"integrat|indices|gradient function|differentiat|inequalit"

MINUS = "−"
AREA_LEADS = ["{n} draws a rectangle with the area and one side shown.", "{n} plans a rectangular plot with the area shown.",
              "{n} cuts a rectangular card with the area and width shown.", "{n} designs a rectangular mat with the area shown."]
TRIP_LEADS = ["{n} travels from A to B through C, as shown.", "{n} cycles from A to C and then on to B.",
              "{n} drives from A to B, stopping at C on the way.", "{n} rides a motorbike from A through C to B."]


def lin(a: int, c: int) -> str:
    """ax + c as printed: x + 3, x − 2, 2x + 5."""
    head = "x" if a == 1 else f"{a}x"
    return head if c == 0 else f"{head} + {c}" if c > 0 else f"{head} {MINUS} {-c}"


def quad(p: int, q: int) -> str:
    """(x + p)(x + q) expanded: x² + (p + q)x + pq."""
    b, c = p + q, p * q
    out = "x²"
    if b:
        out += f" + {'' if b == 1 else b}x" if b > 0 else f" {MINUS} {'' if b == -1 else -b}x"
    if c:
        out += f" + {c}" if c > 0 else f" {MINUS} {-c}"
    return out


def sample(rng: random.Random) -> dict:
    band = rng.choice(BANDS)
    sub = rng.choice(["area", "journey"])
    p = {"band": band, "sub": sub, "name": rng.choice(NAMES)}
    if sub == "area":
        p_, q_ = rng.sample(range(1, 10), 2)
        p.update(p=p_, q=q_)
    else:
        d1, d2 = rng.choice(range(20, 130, 10)), rng.choice(range(20, 130, 10))
        k = rng.choice([5, 10, 15, 20])
        if d1 == d2:
            d2 += 10
        p.update(d1=d1, d2=d2, k=k, faster=rng.choice(["second", "first"]))
    return p


# --- drawing ------------------------------------------------------------------------------------------------

def _draw_area(p: dict):
    fig, ax = new_figure(5.6, 3.6)
    ax.add_patch(Rectangle((0, 0), 4.8, 2.2, facecolor=FILL_2, edgecolor=INK, linewidth=2.0, gid="behind-rect"))
    ax.text(2.4, 1.1, f"Area = ({quad(p['p'], p['q'])}) cm²", ha="center", va="center", fontsize=12, gid="area")
    ax.text(-0.2, 1.1, f"({lin(1, p['p'])}) cm", ha="right", va="center", fontsize=12, gid="side")
    ax.text(2.4, -0.3, "length ?", ha="center", va="center", fontsize=12, gid="ask")
    ax.set_xlim(-2.4, 5.1)
    ax.set_ylim(-0.6, 2.5)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def speeds(p: dict) -> tuple[tuple[int, int], tuple[int, int]]:
    """The two legs' speeds as (a, c) for ax + c km/h: one leg at x, the other k faster."""
    return ((1, 0), (1, p["k"])) if p["faster"] == "second" else ((1, p["k"]), (1, 0))


def _draw_journey(p: dict):
    fig, ax = new_figure(7.2, 2.8)
    A, C, B = (0.0, 0.0), (3.4, 0.0), (6.8, 0.0)
    ax.plot([A[0], B[0]], [0, 0], color=INK, linewidth=2.0, gid="road")
    (a1, c1), (a2, c2) = speeds(p)
    for pt, lab in ((A, "A"), (C, "C"), (B, "B")):
        ax.add_patch(Circle(pt, 0.12, facecolor="white", edgecolor=INK, linewidth=1.6, zorder=3))
        ax.text(pt[0], -0.45, lab, ha="center", va="center", fontsize=13, fontweight="bold", gid=f"pt:{lab}")
    for (x0, x1), d, (a, c), i in (((A[0], C[0]), p["d1"], (a1, c1), 1), ((C[0], B[0]), p["d2"], (a2, c2), 2)):
        mid = (x0 + x1) / 2
        ax.text(mid, 0.38, f"{d} km", ha="center", va="center", fontsize=12, gid=f"dist:{i}")
        sp = lin(a, c) if c == 0 else f"({lin(a, c)})"
        ax.text(mid, 0.85, f"speed {sp} km/h", ha="center", va="center", fontsize=11, gid=f"speed:{i}")
    ax.text(3.4, -1.0, "time = distance ÷ speed", ha="center", va="center", fontsize=11, gid="rule")
    ax.set_xlim(-0.5, 7.3)
    ax.set_ylim(-1.3, 1.2)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def draw(p: dict):
    return _draw_area(p) if p["sub"] == "area" else _draw_journey(p)


# --- questions ----------------------------------------------------------------------------------------------

def frac_text(num: str, den: str) -> str:
    return f"({num})/({den})"


def questions(p: dict, rng: random.Random) -> list:
    name = p["name"]
    if p["sub"] == "area":
        q_, p_ = p["q"], p["p"]
        lead = rng.choice(AREA_LEADS).format(n=name)
        opts = [lin(1, q_), lin(1, -q_), lin(1, p_), lin(1, -p_)]
        return [mcq(f"{lead} Which expression gives its length, in cm?", opts[0], opts[1:], rng)]
    d1, d2, k = p["d1"], p["d2"], p["k"]
    (a1, c1), (a2, c2) = speeds(p)
    # d1/(x + c1) + d2/(x + c2) = (d1(x + c2) + d2(x + c1)) / ((x + c1)(x + c2))
    num = lin(d1 + d2, d1 * c2 + d2 * c1)
    wrong = lin(d1 + d2, d1 * c1 + d2 * c2)  # each distance paired with its own leg's number: the slip
    den = "x(x + " + str(k) + ")"
    added = lin(2, k)  # the denominators added
    opts = [frac_text(num, den), frac_text(wrong, den), frac_text(num, added), frac_text(wrong, added)]
    if wrong == num:
        opts = [frac_text(num, den), frac_text(lin(d1 + d2, 0), den), frac_text(num, added), frac_text(lin(d1 + d2, 0), added)]
    lead = rng.choice(TRIP_LEADS).format(n=name)
    return [mcq(f"{lead} Which single fraction gives the total time, in hours?", opts[0], opts[1:], rng)]
