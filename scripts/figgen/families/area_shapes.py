"""Area and perimeter: a shape on squared paper (Primary), or a labelled L-shape, triangle,
parallelogram or trapezium (Lower Secondary).

`vertices(p)` are the corners in units of the figure (cm or m); the drawing draws them and the
answers come from the same numbers, so a test can check every area by the shoelace formula.
"""
from __future__ import annotations

import math
import random

from matplotlib.patches import Polygon, Rectangle

from ..core import FILL_2, GRID, INK, NAMES, new_figure, num, short

ID = "area_shapes"
KIND = "maths.geometry"
SUBJECT = "mathematics"
BANDS = ("P", "LS")
CONCEPTS = tuple(f"mathematics.{c}" for c in (
    "perimeter-2d-shapes", "parallelogram-trapezium-area", "shapes-square-rectangle-triangle", "mensuration",
    "problem-solving-areas-volumes", "grid", "hectares",
))

# what the shape is, and its unit
THINGS = [("garden", "m"), ("vegetable plot", "m"), ("classroom floor", "m"), ("field", "m"), ("piece of card", "cm"),
          ("floor tile", "cm"), ("table top", "cm"), ("poster", "cm")]
WORDS = {"m": "metres", "cm": "centimetres"}


def stages(p: dict) -> tuple[int, int] | None:
    """Area and perimeter by counting squares: Stage 3 on."""
    return (3, 6) if p["band"] == "P" else None


def sample(rng: random.Random) -> dict:
    band = rng.choice(BANDS)
    thing, unit = rng.choice(THINGS)
    base = {"band": band, "name": rng.choice(NAMES), "thing": thing, "unit": unit}
    if band == "P":
        w, h = rng.randint(3, 8), rng.randint(2, 6)
        cw, ch = (rng.randint(1, w - 1), rng.randint(1, h - 1)) if rng.random() < 0.7 else (0, 0)
        return {**base, "shape": "grid", "w": w, "h": h, "cw": cw, "ch": ch}
    shape = rng.choice(["L", "L", "triangle", "parallelogram", "trapezium"])
    if shape == "L":
        w, h = rng.randint(6, 14), rng.randint(5, 12)
        cw, ch = rng.randint(2, w - 2), rng.randint(2, h - 2)
        p = {**base, "shape": "L", "w": w, "h": h, "cw": cw, "ch": ch}
        p["sides"] = [w, h - ch, cw, ch, w - cw, h]
        p["missing"] = rng.randrange(6)
        return p
    if shape == "triangle":
        b, h = rng.randint(4, 14), rng.randint(3, 10)
        return {**base, "shape": "triangle", "b": b, "h": h, "o": rng.randint(0, b)}
    if shape == "parallelogram":
        return {**base, "shape": "parallelogram", "b": rng.randint(4, 12), "h": rng.randint(3, 8), "o": rng.randint(1, 4)}
    b = rng.randint(6, 14)
    a = rng.randint(3, b - 2)
    return {**base, "shape": "trapezium", "a": a, "b": b, "h": rng.randint(3, 8), "o": rng.randint(0, b - a)}


def vertices(p: dict) -> list[tuple[float, float]]:
    s = p["shape"]
    if s in ("grid", "L"):
        w, h, cw, ch = p["w"], p["h"], p["cw"], p["ch"]
        if not cw:
            return [(0, 0), (w, 0), (w, h), (0, h)]
        return [(0, 0), (w, 0), (w, h - ch), (w - cw, h - ch), (w - cw, h), (0, h)]
    if s == "triangle":
        return [(0, 0), (p["b"], 0), (p["o"], p["h"])]
    if s == "parallelogram":
        return [(0, 0), (p["b"], 0), (p["b"] + p["o"], p["h"]), (p["o"], p["h"])]
    return [(0, 0), (p["b"], 0), (p["o"] + p["a"], p["h"]), (p["o"], p["h"])]


def _area(p: dict) -> float:
    pts = vertices(p)
    return abs(sum(x0 * y1 - x1 * y0 for (x0, y0), (x1, y1) in zip(pts, pts[1:] + pts[:1]))) / 2


def _label(ax, a, b, text: str, outward: bool = True) -> None:
    """A length beside the middle of side a-b, outside the shape (the corners run anticlockwise)."""
    (x0, y0), (x1, y1) = a, b
    dx, dy = x1 - x0, y1 - y0
    L = math.hypot(dx, dy)
    nx, ny = dy / L, -dx / L
    off = 0.25 if outward else -0.25
    sx, sy = (nx, ny) if outward else (-nx, -ny)
    # Aligned away from the side, so the text never runs onto it.
    ax.text((x0 + x1) / 2 + off * nx, (y0 + y1) / 2 + off * ny, text, fontsize=11,
            ha="left" if sx > 0.5 else "right" if sx < -0.5 else "center",
            va="bottom" if sy > 0.5 else "top" if sy < -0.5 else "center")


def draw(p: dict):
    pts = vertices(p)
    xs, ys = [q[0] for q in pts], [q[1] for q in pts]
    W, H = max(xs) - min(xs), max(ys) - min(ys)
    fig, ax = new_figure(min(7.5, 1.6 + 0.5 * W), min(6.0, 1.4 + 0.5 * H))
    u = p["unit"]
    if p["shape"] == "grid":
        for x in range(-1, int(W) + 2):
            ax.plot([x, x], [-1, H + 1], color=GRID, linewidth=0.8)
        for y in range(-1, int(H) + 2):
            ax.plot([-1, W + 1], [y, y], color=GRID, linewidth=0.8)
    # The fill under the squares (they are for counting), the outline once, on top.
    ax.add_patch(Polygon(pts, closed=True, facecolor=FILL_2, edgecolor="none", zorder=0.5))
    ax.plot([q[0] for q in pts + pts[:1]], [q[1] for q in pts + pts[:1]], color=INK, linewidth=2, zorder=3)
    if p["shape"] == "L":
        for i in range(6):
            _label(ax, pts[i], pts[(i + 1) % 6], "y" if i == p["missing"] else f"{p['sides'][i]} {u}")
    elif p["shape"] in ("triangle", "parallelogram", "trapezium"):
        _label(ax, pts[0], pts[1], f"{p['b']} {u}")
        if p["shape"] == "trapezium":
            _label(ax, pts[2], pts[3], f"{p['a']} {u}")
        # The height: dashed, square to the base, from the top corner down.
        hx = p["o"] if p["shape"] != "trapezium" else p["o"] + p["a"] / 2
        ax.plot([hx, hx], [0, p["h"]], color=INK, linewidth=1, linestyle=(0, (4, 3)))
        ax.add_patch(Rectangle((hx, 0), 0.35 if hx + 0.35 <= W else -0.35, 0.35, fill=False, edgecolor=INK, linewidth=1))
        side = 1 if hx < W - 1.2 else -1
        ax.text(hx + side * 0.25, p["h"] / 2, f"{p['h']} {u}", ha="left" if side > 0 else "right", va="center", fontsize=11)
    ax.set_xlim(min(xs) - 1.6, max(xs) + 1.6)
    ax.set_ylim(min(ys) - 1.2, max(ys) + 1.2)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def _area_forms(v: str, unit: str) -> list[str]:
    return [v, f"{v} {unit}²", f"{v} {unit}2", f"{v} {unit}^2", f"{v}{unit}²", f"{v}{unit}2", f"{v} square {WORDS[unit]}"]


def _length_forms(v: str, unit: str) -> list[str]:
    return [v, f"{v} {unit}", f"{v}{unit}"]


def questions(p: dict, rng: random.Random) -> list:
    name, thing, u = p["name"], p["thing"], p["unit"]
    area = num(_area(p))
    lead = f"{name}'s {thing} is this shape."
    if p["shape"] == "grid":
        lead = f"{name} draws a plan of a {thing} on squared paper. Each square is 1 {u} by 1 {u}."
    qs = [short(f"{lead} What is its area?", area, _area_forms(area, u))]
    if p["shape"] in ("grid", "L"):
        pts = vertices(p)
        per = num(sum(math.dist(a, b) for a, b in zip(pts, pts[1:] + pts[:1])))
        qs.append(short(f"What is the perimeter of {name}'s {thing}?", per, _length_forms(per, u)))
    if p["shape"] == "L":
        y = str(p["sides"][p["missing"]])
        qs.append(short(f"What is the length of the side marked y on {name}'s {thing}?", y, _length_forms(y, u)))
    return qs
