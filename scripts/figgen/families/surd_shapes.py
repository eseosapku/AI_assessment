"""Exact lengths and areas in surds (LS, UP), as Rwanda S2 "Indices and Surds", Cambridge IGCSE & O Level Additional
Mathematics "Simplifying expressions involving indices" (surds), Rwanda S4 Core "Set of real numbers" (powers and
radicals) and S4 Subsidiary "Arithmetics" (roots) teach them: surds met in shapes, kept exact.

Four kinds of figure:
- triangle: a right-angled triangle drawn on a centimetre grid, its two shorter sides along grid lines. The exact
  length of the hypotenuse in simplest surd form (Pythagoras, then simplifying): a short answer, or an MCQ whose wrong
  options swap the number and the root, or slip on one of them.
- square: a square whose area is printed (50 cm²). Its exact side length in simplest surd form; its perimeter.
- rectangle: a rectangle whose sides are printed as surds (√12 cm by √3 cm, 2√3 cm by 5√3 cm, (4 + √3) cm by
  (4 − √3) cm). Its area (a whole number), or its perimeter in surd form.
- divide (UP): a rectangle with its area and one side (√m cm) printed: the other side with a rational denominator.
"""
from __future__ import annotations

import math
import random

from matplotlib.patches import Polygon, Rectangle

from ..core import FILL_2, INK, NAMES, mcq, new_figure, short

ID = "surd_shapes"
KIND = "maths.geometry"
SUBJECT = "mathematics"
BANDS = ("LS", "UP")
CONCEPTS = ("mathematics.surd-definition", "mathematics.surds-multiplication", "mathematics.surds-division-rationalising",
            "mathematics.powers-radicals")
# A topic whose sections the book lists is reached only if its name or a section is about surds, radicals or roots.
NEEDS = r"surd|radical|\broots?\b|irrational"
AVOID = r"glossary|equations? involving|logarithm"

RT = "√"
TRI_LEADS = ["{n} draws a right-angled triangle on a centimetre grid.", "{n} plots a right-angled triangle on squared paper.",
             "{n} marks a right-angled triangle on a 1 cm grid.", "{n} sketches a right-angled triangle on a grid of 1 cm squares."]
SQ_LEADS = ["{n} draws a square with the area shown.", "{n} cuts out a square of the area shown.",
            "{n} marks out a square garden bed of the area shown.", "{n} designs a square tile with the area shown."]
RECT_LEADS = ["{n} draws a rectangle with the side lengths shown.", "{n} cuts a rectangular card with the sides shown.",
              "{n} marks out a rectangular plot with the sides shown.", "{n} measures a rectangle with the sides shown."]
DIV_LEADS = ["{n} draws a rectangle with the area and one side shown.", "{n} knows a rectangle's area and one side, as shown.",
             "{n} marks a rectangle of the area shown, with one side given.", "{n} cuts a rectangle of the area shown."]

WHERE = ["in a maths lesson", "for homework", "on the board", "in a group", "for a quiz", "in an exercise book"]


def simplify(n: int) -> tuple[int, int]:
    """√n as k√m with m square-free."""
    k = 1
    for d in range(math.isqrt(n), 1, -1):
        if n % (d * d) == 0:
            k, n = d, n // (d * d)
            break
    return k, n


def surd(k: int, m: int) -> str:
    if m == 1:
        return str(k)
    return f"{'' if k == 1 else k}{RT}{m}"


def surd_forms(k: int, m: int) -> list[str]:
    """k√m in every fair typed form: 2√5, 2 √5, 2sqrt5, 2 sqrt 5, 2sqrt(5), 2√(5), 2 root 5, 2*sqrt(5)."""
    if m == 1:
        return [str(k)]
    c = "" if k == 1 else str(k)
    out = [surd(k, m), f"{c} {RT}{m}".strip(), f"{c}{RT}({m})", f"{c}sqrt{m}", f"{c}sqrt({m})", f"{c} sqrt {m}".strip(),
           f"{c} sqrt({m})".strip(), f"{c} root {m}".strip(), f"{c}root{m}"]
    if c:
        out += [f"{c}*sqrt({m})", f"{c}×{RT}{m}", f"{c} × {RT}{m}"]
    return list(dict.fromkeys(out))


def with_unit(forms: list[str], unit: str) -> list[str]:
    return forms + [f"{f} {unit}" for f in forms] + [f"{f}{unit}" for f in forms]


def sample(rng: random.Random) -> dict:
    band = rng.choice(BANDS)
    kind = rng.choice(["triangle", "square", "rectangle"] + (["divide"] if band == "UP" else []))
    p = {"band": band, "sub": kind, "name": rng.choice(NAMES)}
    if kind == "triangle":
        while True:
            a, b = rng.randint(1, 9), rng.randint(1, 8)
            k, m = simplify(a * a + b * b)
            if m > 1 and (k > 1 or rng.random() < 0.3):
                break
        p.update(a=a, b=b, flip=rng.choice([0, 1]))
        return p
    if kind == "square":
        while True:
            k, m = rng.randint(2, 10), rng.choice([2, 3, 5, 6, 7, 10, 11, 13])
            if k * k * m <= 500:
                break
        p.update(area=k * k * m)
        return p
    if kind == "rectangle":
        form = rng.choice(["roots", "like", "conjugate"])
        if form == "roots":  # √(a m) by √(b m) where a b is a square: the area is whole
            while True:
                m = rng.choice([2, 3, 5, 6, 7])
                a, b = rng.sample([1, 2, 3, 4, 5, 6, 8, 9], 2)
                if math.isqrt(a * b) ** 2 == a * b and a * m <= 75 and b * m <= 75:
                    break
            p.update(form=form, sides=[a * m, b * m])
        elif form == "like":
            p.update(form=form, m=rng.choice([2, 3, 5, 6, 7, 10, 11]), coef=rng.sample([2, 3, 4, 5, 6, 7], 2))
        else:
            m = rng.choice([2, 3, 5, 6, 7])
            c = rng.choice([x for x in (2, 3, 4, 5, 6, 7, 8, 9) if x * x > m])
            p.update(form=form, m=m, c=c)
        p["ask"] = rng.choice(["area", "perimeter"]) if form != "roots" else "area"
        return p
    p.update(m=rng.choice([2, 3, 5, 6, 7, 10, 11]), area=rng.randint(2, 50))
    return p


# --- drawing ------------------------------------------------------------------------------------------------

def _draw_triangle(p: dict):
    a, b = p["a"], p["b"]
    W, H = a + 2, b + 2
    fig, ax = new_figure(min(7.0, 0.62 * W + 1.4), min(6.0, 0.62 * H + 1.0))
    for x in range(W + 1):
        ax.plot([x, x], [0, H], color="#d0d0d0", linewidth=0.7, zorder=0, gid="behind-grid")
    for y in range(H + 1):
        ax.plot([0, W], [y, y], color="#d0d0d0", linewidth=0.7, zorder=0, gid="behind-grid")
    x0, y0 = 1, 1
    pts = [(x0, y0), (x0 + a, y0), (x0, y0 + b)] if not p["flip"] else [(x0 + a, y0), (x0, y0), (x0 + a, y0 + b)]
    ax.add_patch(Polygon(pts, closed=True, facecolor=FILL_2, edgecolor=INK, linewidth=2.0, zorder=2, gid="behind-tri"))
    right = pts[0]
    sx = 1 if right[0] == x0 else -1
    ax.plot([right[0] + 0.3 * sx, right[0] + 0.3 * sx, right[0]], [right[1], right[1] + 0.3, right[1] + 0.3], color=INK,
            linewidth=1.2, zorder=3, gid="behind-rightangle")
    ax.text(0.15, H - 0.35, "1 square = 1 cm", ha="left", va="center", fontsize=10, gid="key",
            bbox={"boxstyle": "square,pad=0.15", "facecolor": "white", "edgecolor": "none"})
    ax.set_xlim(0, W)
    ax.set_ylim(0, H)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def _side_label(ax, x, y, text, gid, **kw):
    ax.text(x, y, text, fontsize=13, gid=gid, **kw)


def _draw_square(p: dict):
    fig, ax = new_figure(4.4, 3.8)
    ax.add_patch(Rectangle((0, 0), 2.6, 2.6, facecolor=FILL_2, edgecolor=INK, linewidth=2.0, gid="behind-square"))
    _side_label(ax, 1.3, 1.3, f"Area = {p['area']} cm²", "area", ha="center", va="center")
    ax.set_xlim(-0.4, 3.0)
    ax.set_ylim(-0.4, 3.0)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def rect_sides(p: dict) -> tuple[str, str]:
    if p["sub"] == "divide":
        return f"{RT}{p['m']} cm", "?"
    if p["form"] == "roots":
        return f"{RT}{p['sides'][0]} cm", f"{RT}{p['sides'][1]} cm"
    if p["form"] == "like":
        return f"{surd(p['coef'][0], p['m'])} cm", f"{surd(p['coef'][1], p['m'])} cm"
    return f"({p['c']} + {RT}{p['m']}) cm", f"({p['c']} − {RT}{p['m']}) cm"


def _draw_rect(p: dict):
    fig, ax = new_figure(5.6, 3.6)
    ax.add_patch(Rectangle((0, 0), 3.8, 2.2, facecolor=FILL_2, edgecolor=INK, linewidth=2.0, gid="behind-rect"))
    w, h = rect_sides(p)
    _side_label(ax, 1.9, -0.22, w, "side:w", ha="center", va="top")
    if p["sub"] == "divide":
        _side_label(ax, 4.0, 1.1, "?", "side:h", ha="left", va="center")
        _side_label(ax, 1.9, 1.1, f"Area = {p['area']} cm²", "area", ha="center", va="center")
    else:
        _side_label(ax, 4.0, 1.1, h, "side:h", ha="left", va="center")
    ax.set_xlim(-0.3, 6.6)
    ax.set_ylim(-0.75, 2.5)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def draw(p: dict):
    return {"triangle": _draw_triangle, "square": _draw_square}.get(p["sub"], _draw_rect)(p)


# --- questions ----------------------------------------------------------------------------------------------

def _surd_mcq(stem: str, k: int, m: int, rng: random.Random):
    """The swapped-number and slipped-root mistakes, in a 2 by 2 design: k√m, m√k, k√k, m√m (or a slip of one)."""
    free = [x for x in (2, 3, 5, 6, 7, 10, 11, 13) if x != m]
    k2 = m if m != k else k + 1
    m2 = k if k in free else min(free, key=lambda x: (abs(x - m), x))
    opts = [surd(k, m), surd(k2, m2), surd(k, m2), surd(k2, m)]
    vals = [k * k * m, k2 * k2 * m2, k * k * m2, k2 * k2 * m]
    keep = [o for o, v in zip(opts[1:], vals[1:]) if v != vals[0]]
    return mcq(stem, opts[0], list(dict.fromkeys(keep)), rng)


def questions(p: dict, rng: random.Random) -> list:
    name, sub = p["name"], p["sub"]
    if sub == "triangle":
        k, m = simplify(p["a"] ** 2 + p["b"] ** 2)
        lead = rng.choice(TRI_LEADS).format(n=name)[:-1] + " " + rng.choice(WHERE) + "."
        stem = f"{lead} Find the exact length of its longest side, in centimetres, in simplest surd form."
        if rng.random() < 0.5:
            q1 = short(stem, surd(k, m), with_unit(surd_forms(k, m), "cm"))
        else:
            q1 = _surd_mcq(f"{lead} What is the exact length of its longest side, in centimetres?", k, m, rng)
        q2 = short("What is the area, in cm², of the right-angled triangle on the grid?", _half(p["a"] * p["b"]),
                   [f"{_half(p['a'] * p['b'])} cm²", f"{_half(p['a'] * p['b'])} cm2"])
        return [q1, q2]
    if sub == "square":
        k, m = simplify(p["area"])
        lead = rng.choice(SQ_LEADS).format(n=name)[:-1] + " " + rng.choice(WHERE) + "."
        q1 = short(f"{lead} Find its exact side length, in centimetres, in simplest surd form.", surd(k, m),
                   with_unit(surd_forms(k, m), "cm"))
        q2 = short("Find the exact perimeter of the square of the area shown, in centimetres, in simplest surd form.",
                   surd(4 * k, m), with_unit(surd_forms(4 * k, m), "cm"))
        return [q1, q2]
    if sub == "rectangle":
        lead = rng.choice(RECT_LEADS).format(n=name)[:-1] + " " + rng.choice(WHERE) + "."
        if p["form"] == "roots":
            a, b = p["sides"]
            area = math.isqrt(a * b)
            return [short(f"{lead} Find its exact area in cm².", area, [f"{area} cm²", f"{area} cm2", f"{area}cm²"])]
        if p["form"] == "like":
            (c1, c2), m = p["coef"], p["m"]
            if p["ask"] == "area":
                v = c1 * c2 * m
                return [short(f"{lead} Find its exact area in cm².", v, [f"{v} cm²", f"{v} cm2"])]
            return [short(f"{lead} Find its exact perimeter, in centimetres, in simplest surd form.", surd(2 * (c1 + c2), m),
                          with_unit(surd_forms(2 * (c1 + c2), m), "cm"))]
        c, m = p["c"], p["m"]
        if p["ask"] == "area":
            v = c * c - m
            return [short(f"{lead} Find its exact area in cm².", v, [f"{v} cm²", f"{v} cm2"])]
        return [short(f"{lead} Find its exact perimeter in centimetres.", 4 * c, [f"{4 * c} cm", f"{4 * c}cm"])]
    m, A = p["m"], p["area"]
    lead = rng.choice(DIV_LEADS).format(n=name)[:-1] + " " + rng.choice(WHERE) + "."
    g = math.gcd(A, m)
    num, den = A // g, m // g  # A/√m = A√m/m
    if den == 1:
        key = surd(num, m)
        forms = surd_forms(num, m)
    else:
        key = f"{surd(num, m)}/{den}"
        forms = [key, f"({surd(num, m)})/{den}", f"{'' if num == 1 else num}sqrt({m})/{den}",
                 f"{'' if num == 1 else num}sqrt{m}/{den}", f"{'' if num == 1 else num} root {m}/{den}"]
    return [short(f"{lead} Find the exact length of the other side, in centimetres, with a rational denominator.", key,
                  with_unit(forms, "cm"))]


def _half(v: int) -> str:
    return str(v // 2) if v % 2 == 0 else f"{v / 2:g}"
