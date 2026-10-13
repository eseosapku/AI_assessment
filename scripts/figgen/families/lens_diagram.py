"""Ray diagrams for a converging lens (UP, AL): the lens on squared paper with both principal foci,
an object arrow, the two construction rays (parallel to the axis then through F, and straight
through the centre) and the image they make: real and inverted beyond F, or, with the object inside
F, virtual and upright, found by tracing the rays back. The image distance and height, the
magnification, the focal length, and what kind of image it is.

Distances are in squares, 1/f = 1/u + 1/v with real distances positive, and the object is placed
so the image's tip falls on a gridline crossing.
"""
from __future__ import annotations

import random
from fractions import Fraction

from ..core import GRID, INK, NAMES, exact, mcq, measure, new_figure, short

ID = "lens_diagram"
KIND = "physics.ray"
SUBJECT = "physics"
BANDS = ("UP", "AL")
CONCEPTS = tuple(f"physics.{c}" for c in ("lens-formula-and-ray-diagrams", "lenses", "thin-lenses", "optical-instruments"))
# Not mirrors, sound or light's particle nature.
AVOID = r"\bsound|seismic|ultrasound|mirror|particle nature"
KINDS = [f"{a} and {b}" for a in ("Real", "Virtual") for b in ("inverted", "upright")]


def image(p: dict) -> tuple[Fraction, Fraction]:
    """The image distance v (negative for a virtual image, on the object's side) and its height."""
    f, u, h = Fraction(p["f"]), Fraction(p["u"]), Fraction(p["h"])
    v = 1 / (1 / f - 1 / u)
    return v, -h * v / u


def sample(rng: random.Random) -> dict:
    while True:
        p = {"band": rng.choice(BANDS), "f": rng.randint(2, 8), "u": rng.randint(1, 20), "h": rng.choice([1, 2, 3, 4]),
             "scale": rng.choice([1, 2, 5])}
        if p["u"] == p["f"]:
            continue
        v, hi = image(p)
        width = max(v, p["f"]) + 3 - min(-p["u"], v, -p["f"]) + 2  # squares across the drawing, both foci in it
        if (v.denominator == 1 and hi.denominator == 1 and 1 <= abs(v) <= 20 and abs(hi) <= 8 and width <= 36
                and (abs(v / p["u"]) * 100).denominator == 1):
            return p


def _clip(x0: float, y0: float, dx: float, dy: float, box) -> tuple[float, float]:
    """Where the ray from (x0, y0) along (dx, dy) leaves the box."""
    xl, xr, yb, yt = box
    ts = []
    if dx > 0:
        ts.append((xr - x0) / dx)
    if dx < 0:
        ts.append((xl - x0) / dx)
    if dy > 0:
        ts.append((yt - y0) / dy)
    if dy < 0:
        ts.append((yb - y0) / dy)
    t = min(ts)
    return x0 + t * dx, y0 + t * dy


def _hits(box, seg) -> bool:
    """Whether a segment (in display points) passes through a label's box, padded a little."""
    (x0, y0), (x1, y1) = seg
    box = box.padded(2)
    return any(box.contains(x0 + (x1 - x0) * i / 80, y0 + (y1 - y0) * i / 80) for i in range(81))


def _place(ax, renderer, segs, placed, x, y, text, tries):
    """Puts a label at the first of its places that no ray, arrow or other label crosses and the frame
    holds; failing all, at the first."""
    frame = ax.get_window_extent(renderer)
    for dx, dy, ha, va in tries:
        t = ax.text(x + dx, y + dy, text, ha=ha, va=va, fontsize=10, fontweight="bold" if text == "F" else "normal")
        box = t.get_window_extent(renderer)
        if (frame.x0 <= box.x0 and box.x1 <= frame.x1 and frame.y0 <= box.y0 and box.y1 <= frame.y1
                and not any(_hits(box, sg) for sg in segs) and not any(box.overlaps(b) for b in placed)):
            placed.append(box)
            return
        t.remove()
    dx, dy, ha, va = tries[0]
    ax.text(x + dx, y + dy, text, ha=ha, va=va, fontsize=10)


def _arrow(ax, x: float, top: float, dashed: bool = False):
    ax.annotate("", xy=(x, top), xytext=(x, 0), arrowprops=dict(arrowstyle="-|>", color=INK, lw=2.0, mutation_scale=16,
                                                                  linestyle="--" if dashed else "-", shrinkA=0, shrinkB=0))


def draw(p: dict):
    f, u, h = p["f"], p["u"], p["h"]
    v, hi = (float(x) for x in image(p))
    yt, yb = max(h, hi) + 1.5, min(0, hi) - 2.5  # room below the axis for the rays and the foci's letters
    xl, xr = min(-u, v, -f) - 2, max(v, f) + 3
    box = (xl, xr, yb, yt)
    width = 7.0
    fig, ax = new_figure(width, max(3.4, min(6.0, width * (yt - yb) / (xr - xl))))
    ax.set_xticks(range(int(xl), int(xr) + 1))
    ax.set_yticks(range(int(yb), int(yt) + 1))
    ax.grid(True, color=GRID, linewidth=0.5)
    ax.set_axisbelow(True)
    ax.tick_params(length=0, labelbottom=False, labelleft=False)
    ax.plot([xl, xr], [0, 0], color=INK, linewidth=1.0)  # the principal axis
    ax.annotate("", xy=(0, yt - 0.3), xytext=(0, yb + 0.3), arrowprops=dict(arrowstyle="<|-|>", color=INK, lw=2.0, mutation_scale=16))
    for x in (-f, f):
        ax.plot([x], [0], marker="o", markersize=4, color=INK)
    _arrow(ax, -u, h)
    # Ray 1: parallel to the axis, then through the far focus. Ray 2: straight through the centre.
    ax.plot([-u, 0], [h, h], color=INK, linewidth=1.3)
    end1 = _clip(0, h, f, -h, box)
    ax.plot([0, end1[0]], [h, end1[1]], color=INK, linewidth=1.3)
    end2 = _clip(-u, h, u, -h, box)
    ax.plot([-u, end2[0]], [h, end2[1]], color=INK, linewidth=1.3)
    if v > 0:
        _arrow(ax, v, hi)
    else:
        # A virtual image: the rays spread out, and seem to come from where their backward lines meet.
        ax.plot([0, v], [h, hi], color=INK, linewidth=1.0, linestyle=(0, (4, 3)))
        ax.plot([0, v], [0, hi], color=INK, linewidth=1.0, linestyle=(0, (4, 3)))
        _arrow(ax, v, hi, dashed=True)
    ax.text(0, -0.04, f"Each square is {p['scale']} cm.", transform=ax.transAxes, ha="left", va="top", fontsize=9)
    ax.set_xlim(xl, xr)
    ax.set_ylim(yb, yt)
    ax.set_aspect("equal")
    # The labels go last, each where no ray, arrow or other label runs through it.
    fig.canvas.draw()
    r = fig.canvas.get_renderer()
    to_screen = ax.transData.transform
    segs = []
    for ln in ax.lines:
        pts = to_screen(list(zip(ln.get_xdata(), ln.get_ydata())))
        segs += list(zip(pts[:-1], pts[1:]))
    for (x0, y0), (x1, y1) in (((-u, 0), (-u, h)), ((v, 0), (v, hi)), ((0, yb + 0.3), (0, yt - 0.3))):
        segs.append(tuple(to_screen([(x0, y0), (x1, y1)])))
    placed = []
    near = [(0, -0.35, "center", "top"), (0, 0.35, "center", "bottom"), (-0.3, -0.35, "right", "top"), (0.3, -0.35, "left", "top"),
            (-0.3, 0.35, "right", "bottom"), (0.3, 0.35, "left", "bottom")]
    for x in (-f, f):
        _place(ax, r, segs, placed, x, 0, "F", near)
    for x, top, text in ((-u, h, "object"), (v, hi, "image")):
        up = 1 if top > 0 else -1
        _place(ax, r, segs, placed, x, top, text,
               [(0, 0.3 * up, "center", "bottom" if up > 0 else "top"), (-0.3, top / -2, "right", "center"), (0.3, top / -2, "left", "center"),
                (0, -0.35 * up - top, "center", "top" if up > 0 else "bottom"), (-0.3, 0.3 * up, "right", "bottom" if up > 0 else "top"),
                (0.3, 0.3 * up, "left", "bottom" if up > 0 else "top"),
                (0.3, -0.35 * up - top, "left", "top" if up > 0 else "bottom"), (-0.3, -0.35 * up - top, "right", "top" if up > 0 else "bottom")])
    return fig


SETTINGS = ["in the school laboratory", "at the science club", "for a class practical", "during a physics lesson", "for a science fair"]


def questions(p: dict, rng: random.Random) -> list:
    name = rng.choice(NAMES)
    v, hi = image(p)
    sc = p["scale"]
    mag = abs(v / p["u"])
    key = KINDS[0] if v > 0 else KINDS[3]
    thing = rng.choice(["a candle flame", "a small bulb", "a lit arrow on a card", "a letter on a lamp box", "a torch bulb", "a glowing LED"])
    return [
        short(f"{name} used a converging lens to form an image of {thing} {rng.choice(SETTINGS)}. How far is the image from the lens?",
              exact(abs(v) * sc), measure(abs(v) * sc, "cm")),
        short(f"The object is {exact(p['h'] * sc)} cm tall. How tall is the image?", exact(abs(hi) * sc), measure(abs(hi) * sc, "cm")),
        short("What is the magnification?", exact(mag), [f"×{exact(mag)}", f"x{exact(mag)}", f"{exact(mag)}x", f"{exact(mag)}×"]),
        mcq("Which describes the image?", key, [k for k in KINDS if k != key], rng),
        short("What is the focal length of the lens?", p["f"] * sc, measure(p["f"] * sc, "cm")),
    ]
