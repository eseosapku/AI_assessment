"""Perimeter, area and volume (UP), as Cambridge IGCSE "Perimeter, area and volume" (perimeter and area in two
dimensions, three-dimensional objects, surface areas and volumes of solids) and WAEC "Mensuration" teach them.

Kinds of figure, each with its dimensions printed and, for a cone or a sphere, its formulas:
- prism: a triangular prism whose end is a right-angled triangle (a Pythagorean triple), its length printed. Its volume;
  its total surface area.
- cylinder: a cylinder with radius and height printed. Its volume, its curved surface area, its total surface area --
  in terms of π.
- cone: a cone with radius, height and slant height printed (a triple), V = ⅓πr²h and curved area πrl printed. Its
  volume or its curved surface area, in terms of π.
- sphere: a sphere with its radius printed, V = 4/3 πr³ and A = 4πr² printed. Its volume or its surface area.
- semi: a flat shape, a rectangle with a semicircle on one end. Its area or its perimeter, in terms of π.
"""
from __future__ import annotations

import math
import random
from fractions import Fraction

from matplotlib.patches import Arc, Ellipse, Polygon, Wedge

from ..core import FILL_2, INK, NAMES, new_figure, short

ID = "solid_mensuration"
KIND = "maths.solid"
SUBJECT = "mathematics"
BANDS = ("UP",)
CONCEPTS = ("mathematics.composite-solids-surface-area", "mathematics.surface-area-triangular-prisms-pyramids",
            "mathematics.volume-cubes-cuboids", "mathematics.surface-area-cubes-cuboids", "mathematics.perimeter-2d-shapes")
# A topic whose sections the book lists is reached only if its name or a section names perimeter, area or volume.
NEEDS = r"perimeter|area|volume|mensuration|solids?"
AVOID = r"integrat|differentiation|scale drawing|coordinate|line and midpoint|circular measure|similar"

PI = "π"
TRIPLES = [(3, 4, 5), (6, 8, 10), (5, 12, 13), (9, 12, 15), (8, 15, 17), (12, 16, 20), (4, 3, 5), (8, 6, 10),
           (12, 5, 13), (15, 8, 17), (7, 24, 25), (10, 24, 26)]
LEADS = {"prism": ["{n} makes a tent shaped like the triangular prism shown.", "{n} measures a triangular prism.",
                   "{n} builds a wooden wedge, the triangular prism shown.", "{n} designs a box shaped like a triangular prism."],
         "cylinder": ["{n} measures a cylindrical water tank.", "{n} makes a tin shaped like the cylinder shown.",
                      "{n} studies the cylinder shown.", "{n} designs a cylindrical drum."],
         "cone": ["{n} makes a party hat shaped like the cone shown.", "{n} measures a solid cone.",
                  "{n} studies the cone shown.", "{n} designs a cone-shaped funnel."],
         "sphere": ["{n} measures a ball, the sphere shown.", "{n} studies the sphere shown.",
                    "{n} makes a clay sphere.", "{n} paints a spherical globe."],
         "semi": ["{n} designs a garden bed: a rectangle with a semicircle on one end.",
                  "{n} draws a shape made of a rectangle and a semicircle.",
                  "{n} plans a stage: a rectangle with a semicircle at one end.",
                  "{n} cuts a card shaped like a rectangle with a semicircle on one end."]}


def concepts_for(p: dict) -> tuple[str, ...]:
    if p["sub"] == "semi":
        return ("mathematics.perimeter-2d-shapes", "mathematics.composite-solids-surface-area")
    return ("mathematics.composite-solids-surface-area", "mathematics.surface-area-triangular-prisms-pyramids",
            "mathematics.volume-cubes-cuboids", "mathematics.surface-area-cubes-cuboids")


def sample(rng: random.Random) -> dict:
    sub = rng.choice(["prism", "cylinder", "cone", "sphere", "semi"])
    p = {"band": "UP", "sub": sub, "name": rng.choice(NAMES)}
    if sub == "prism":
        a, b, c = rng.choice(TRIPLES)
        p.update(tri=[a, b, c], length=rng.randint(4, 30), ask=rng.choice(["volume", "surface"]))
    elif sub == "cylinder":
        p.update(r=rng.randint(2, 15), h=rng.randint(3, 25), ask=rng.choice(["volume", "curved", "total"]))
    elif sub == "cone":
        r, h, l = rng.choice([(3, 4, 5), (6, 8, 10), (5, 12, 13), (9, 12, 15), (8, 15, 17), (12, 9, 15), (12, 16, 20),
                              (8, 6, 10), (12, 5, 13), (15, 8, 17)])
        p.update(r=r, h=h, l=l, ask=rng.choice(["volume", "curved"]))
    elif sub == "sphere":
        p.update(r=rng.randint(1, 20), ask=rng.choice(["volume", "surface"]))
    else:
        p.update(length=rng.randint(5, 30), width=rng.choice([2, 4, 6, 8, 10, 12, 14, 16, 18, 20]), ask=rng.choice(["area", "perimeter"]))
    return p


# --- drawing ------------------------------------------------------------------------------------------------

DX, DY = 0.55, 0.35  # the receding direction of the oblique drawing, per unit of depth


def _label(ax, x, y, text, gid, **kw):
    ax.text(x, y, text, fontsize=12, gid=gid, **kw)


def _draw_prism(p: dict):
    a, b, c = p["tri"]
    L = p["length"]
    s = 3.0 / max(a, b)
    w, h = b * s, a * s  # the end: right angle at the bottom left, base w, height h
    d = min(4.5, 0.25 * L + 1.8)
    fig, ax = new_figure(6.4, 4.6)
    front = [(0, 0), (w, 0), (0, h)]
    back = [(x + d * DX, y + d * DY) for x, y in front]
    ax.add_patch(Polygon([front[1], back[1], back[2], front[2]], closed=True, facecolor="#e6e9ec", edgecolor=INK,
                         linewidth=1.6, gid="behind-slope"))
    ax.add_patch(Polygon(front, closed=True, facecolor=FILL_2, edgecolor=INK, linewidth=1.8, gid="behind-end"))
    ax.plot([front[2][0], back[2][0]], [front[2][1], back[2][1]], color=INK, linewidth=1.6)
    ax.plot([front[0][0], back[0][0], back[1][0]], [front[0][1], back[0][1], back[1][1]], color=INK, linewidth=1.0,
            linestyle=(0, (4, 3)), gid="hidden")
    ax.plot([back[0][0], back[2][0]], [back[0][1], back[2][1]], color=INK, linewidth=1.0, linestyle=(0, (4, 3)))
    ax.plot([0.25, 0.25, 0], [0, 0.25, 0.25], color=INK, linewidth=1.0)
    _label(ax, w / 2, -0.3, f"{b} cm", "dim:b", ha="center", va="top")
    _label(ax, -0.2, h / 2, f"{a} cm", "dim:a", ha="right", va="center")
    slope = math.degrees(math.atan2(-h, w))
    nx, ny = h / math.hypot(w, h), w / math.hypot(w, h)  # out of the end face, across the sloping face
    hx, hy = d * DX, d * DY  # the hidden edge from the corner at the right angle

    def clear(cx, cy):  # far enough from the hidden edge for the label not to sit on it
        t = max(0.0, min(1.0, (cx * hx + cy * hy) / (hx * hx + hy * hy)))
        return math.hypot(cx - t * hx, cy - t * hy) > 0.5

    spots = [(w * (1 - t) + 0.0, h * t, off) for t in (0.58, 0.45, 0.7, 0.32, 0.8) for off in (0.32, 0.45)]
    cx, cy = next(((x + o * nx, y + o * ny) for x, y, o in spots if clear(x + o * nx, y + o * ny)),
                  (w * 0.42 + 0.32 * nx, h * 0.58 + 0.32 * ny))
    _label(ax, cx, cy, f"{c} cm", "dim:c", ha="center", va="center", rotation=slope, rotation_mode="anchor")
    _label(ax, w + d * DX / 2 + 0.25, d * DY / 2 - 0.25, f"{L} cm", "dim:L", ha="left", va="top")
    ax.set_xlim(-1.4, w + d * DX + 1.6)
    ax.set_ylim(-0.9, h + d * DY + 0.4)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def _draw_cylinder(p: dict):
    fig, ax = new_figure(4.6, 4.8)
    R, H, e = 1.4, 2.8, 0.42
    ax.add_patch(Polygon([(-R, 0), (-R, H), (R, H), (R, 0)], closed=True, facecolor=FILL_2, edgecolor="none",
                         gid="behind-body"))
    ax.plot([-R, -R], [0, H], color=INK, linewidth=1.8)
    ax.plot([R, R], [0, H], color=INK, linewidth=1.8)
    ax.add_patch(Ellipse((0, H), 2 * R, 2 * e, facecolor="#e6e9ec", edgecolor=INK, linewidth=1.8, gid="behind-top"))
    ax.add_patch(Arc((0, 0), 2 * R, 2 * e, theta1=180, theta2=360, color=INK, linewidth=1.8))
    ax.add_patch(Arc((0, 0), 2 * R, 2 * e, theta1=0, theta2=180, color=INK, linewidth=1.0, linestyle=(0, (4, 3))))
    ax.plot([0, R], [H, H], color=INK, linewidth=1.2)
    ax.plot([0], [H], "o", color=INK, markersize=3)
    _label(ax, 0, H + e + 0.2, f"radius {p['r']} cm", "dim:r", ha="center", va="bottom")
    ax.annotate("", xy=(R + 0.35, 0), xytext=(R + 0.35, H), arrowprops={"arrowstyle": "<->", "color": INK, "lw": 1.1})
    ax.plot([R + 0.35, R + 0.35], [0, H], alpha=0, gid="dimline:ends")
    _label(ax, R + 0.5, H / 2, f"{p['h']} cm", "dim:h", ha="left", va="center")
    ax.set_xlim(-R - 0.3, R + 1.9)
    ax.set_ylim(-e - 0.3, H + e + 0.65)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def _formula_box(ax, lines, x, y):
    ax.text(x, y, "\n".join(lines), ha="left", va="top", fontsize=11, linespacing=1.5, gid="formulas",
            bbox={"boxstyle": "round,pad=0.35", "facecolor": "white", "edgecolor": INK, "linewidth": 0.9})


def _draw_cone(p: dict):
    fig, ax = new_figure(6.4, 4.8)
    R, H, e = 1.8, 2.8, 0.42
    ax.add_patch(Polygon([(-R, 0), (0, H), (R, 0)], closed=True, facecolor=FILL_2, edgecolor="none", gid="behind-body"))
    ax.plot([-R, 0, R], [0, H, 0], color=INK, linewidth=1.8)
    ax.add_patch(Arc((0, 0), 2 * R, 2 * e, theta1=180, theta2=360, color=INK, linewidth=1.8))
    ax.add_patch(Arc((0, 0), 2 * R, 2 * e, theta1=0, theta2=180, color=INK, linewidth=1.0, linestyle=(0, (4, 3))))
    ax.plot([0, 0], [0, H], color=INK, linewidth=1.0, linestyle=(0, (4, 3)))
    ax.plot([0, R], [0, 0], color=INK, linewidth=1.2)
    ax.plot([0.2, 0.2, 0], [0, 0.2, 0.2], color=INK, linewidth=0.9)
    _label(ax, 0, -e - 0.2, f"radius {p['r']} cm", "dim:r", ha="center", va="top")
    _label(ax, 0.12, 0.72, f"{p['h']} cm", "dim:h", ha="left", va="center")
    _label(ax, R / 2 + 0.22, H / 2 + 0.15, f"{p['l']} cm", "dim:l", ha="left", va="bottom")
    _formula_box(ax, ["V = ⅓πr²h", "curved surface area = πrl"], R + 1.2, H + 0.2)
    ax.set_xlim(-R - 0.6, R + 4.6)
    ax.set_ylim(-e - 0.75, H + 0.5)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def _draw_sphere(p: dict):
    fig, ax = new_figure(6.4, 4.4)
    R = 1.7
    ax.add_patch(Ellipse((0, 0), 2 * R, 2 * R, facecolor=FILL_2, edgecolor=INK, linewidth=1.8, gid="behind-ball"))
    ax.add_patch(Arc((0, 0), 2 * R, 0.8, theta1=180, theta2=360, color=INK, linewidth=1.1))
    ax.add_patch(Arc((0, 0), 2 * R, 0.8, theta1=0, theta2=180, color=INK, linewidth=0.9, linestyle=(0, (4, 3))))
    ax.plot([0, R], [0, 0], color=INK, linewidth=1.2)
    ax.plot([0], [0], "o", color=INK, markersize=3)
    _label(ax, 0, -R - 0.15, f"radius {p['r']} cm", "dim:r", ha="center", va="top")
    _formula_box(ax, ["V = (4/3)πr³", "surface area = 4πr²"], R + 0.6, R)
    ax.set_xlim(-R - 0.3, R + 4.0)
    ax.set_ylim(-R - 0.65, R + 0.3)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def _draw_semi(p: dict):
    L, W = p["length"], p["width"]
    s = 4.0 / (L + W / 2)
    l, w = L * s, W * s
    fig, ax = new_figure(6.4, 3.6)
    ax.add_patch(Polygon([(0, 0), (l, 0), (l, w), (0, w)], closed=True, facecolor=FILL_2, edgecolor="none",
                         gid="behind-rect"))
    ax.add_patch(Wedge((l, w / 2), w / 2, -90, 90, facecolor=FILL_2, edgecolor="none", gid="behind-semi"))
    ax.plot([l, 0, 0, l], [0, 0, w, w], color=INK, linewidth=1.8)
    ax.add_patch(Arc((l, w / 2), w, w, theta1=-90, theta2=90, color=INK, linewidth=1.8))
    ax.plot([l, l], [0, w], color=INK, linewidth=1.0, linestyle=(0, (4, 3)))
    _label(ax, l / 2, -0.15, f"{L} cm", "dim:L", ha="center", va="top")
    _label(ax, -0.15, w / 2, f"{W} cm", "dim:W", ha="right", va="center")
    ax.set_xlim(-1.3, l + w / 2 + 0.4)
    ax.set_ylim(-0.75, w + 0.3)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def draw(p: dict):
    return {"prism": _draw_prism, "cylinder": _draw_cylinder, "cone": _draw_cone, "sphere": _draw_sphere,
            "semi": _draw_semi}[p["sub"]](p)


# --- questions ----------------------------------------------------------------------------------------------

def pi_answer(k: Fraction, unit: str) -> tuple[str, list[str]]:
    """kπ as printed and typed: 48π, 48 π, 48pi, 32π/3."""
    a, b = k.numerator, k.denominator
    key = f"{a}{PI}" if b == 1 else f"{a}{PI}/{b}"
    forms = [key, key.replace(PI, " " + PI), key.replace(PI, "pi"), key.replace(PI, " pi")]
    if b != 1:
        forms += [f"({a}/{b}){PI}", f"{a}/{b} {PI}", f"{a}/{b}{PI}"]
    forms += [f"{f} {unit}" for f in list(forms)]
    return key, list(dict.fromkeys(forms))


def num_answer(v: Fraction, unit: str) -> tuple[str, list[str]]:
    key = format(float(v), "g")
    return key, [key, f"{key} {unit}", f"{key}{unit}"]


def questions(p: dict, rng: random.Random) -> list:
    sub, name = p["sub"], p["name"]
    lead = rng.choice(LEADS[sub]).format(n=name)
    if sub == "prism":
        a, b, c = p["tri"]
        L = p["length"]
        if p["ask"] == "volume":
            key, forms = num_answer(Fraction(a * b, 2) * L, "cm³")
            return [short(f"{lead} Find its volume, in cm³.", key, forms)]
        key, forms = num_answer(Fraction(a * b) + L * (a + b + c), "cm²")
        return [short(f"{lead} Find its total surface area, in cm².", key, forms)]
    if sub == "cylinder":
        r, h = p["r"], p["h"]
        if p["ask"] == "volume":
            key, forms = pi_answer(Fraction(r * r * h), "cm³")
            return [short(f"{lead} Find its volume, in cm³, in terms of π.", key, forms)]
        if p["ask"] == "curved":
            key, forms = pi_answer(Fraction(2 * r * h), "cm²")
            return [short(f"{lead} Find its curved surface area, in cm², in terms of π.", key, forms)]
        key, forms = pi_answer(Fraction(2 * r * r + 2 * r * h), "cm²")
        return [short(f"{lead} It is closed at both ends. Find its total surface area, in cm², in terms of π.", key, forms)]
    if sub == "cone":
        r, h, l = p["r"], p["h"], p["l"]
        if p["ask"] == "volume":
            key, forms = pi_answer(Fraction(r * r * h, 3), "cm³")
            return [short(f"{lead} Find its volume, in cm³, in terms of π.", key, forms)]
        key, forms = pi_answer(Fraction(r * l), "cm²")
        return [short(f"{lead} Find its curved surface area, in cm², in terms of π.", key, forms)]
    if sub == "sphere":
        r = p["r"]
        if p["ask"] == "volume":
            key, forms = pi_answer(Fraction(4 * r ** 3, 3), "cm³")
            return [short(f"{lead} Find its volume, in cm³, in terms of π.", key, forms)]
        key, forms = pi_answer(Fraction(4 * r * r), "cm²")
        return [short(f"{lead} Find its surface area, in cm², in terms of π.", key, forms)]
    L, W = p["length"], p["width"]
    r = W // 2
    if p["ask"] == "area":
        k = Fraction(r * r, 2)
        pk, _ = pi_answer(k, "")
        key = f"{L * W} + {pk}"
        forms = [key, key.replace(" ", ""), key.replace(PI, "pi"), f"{pk} + {L * W}", f"{key} cm²"]
        return [short(f"{lead} Find its area, in cm², in terms of π.", key, forms)]
    pk, _ = pi_answer(Fraction(r), "")
    key = f"{2 * L + W} + {pk}"
    forms = [key, key.replace(" ", ""), key.replace(PI, "pi"), f"{pk} + {2 * L + W}", f"{key} cm"]
    return [short(f"{lead} Find its perimeter, in centimetres, in terms of π.", key, forms)]
