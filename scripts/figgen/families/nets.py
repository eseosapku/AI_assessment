"""The net of a solid: which solid it folds into, its faces, edges and vertices, and (Lower
Secondary) the area of card it takes.

Cube nets are the eleven true ones, turned and flipped at random; the test folds each one.
"""
from __future__ import annotations

import math
import random

from matplotlib.patches import Polygon

from ..core import count, FILL_2, INK, NAMES, mcq, new_figure, short

ID = "nets"
KIND = "maths.solid"
SUBJECT = "mathematics"
BANDS = ("P", "LS")
CONCEPTS = tuple(f"mathematics.{c}" for c in (
    "shapes-nets", "construction-polygons-nets", "3d-shapes", "solids-properties", "surface-area-triangular-prisms-pyramids",
))
AVOID = r"quadrilaterals and polygons"  # topics that teach none of it, read by name

SOLIDS = ["cube", "cuboid", "triangular prism", "square-based pyramid", "tetrahedron"]
COUNTS = {"cube": (6, 12, 8), "cuboid": (6, 12, 8), "triangular prism": (5, 9, 6), "square-based pyramid": (5, 8, 5),
          "tetrahedron": (4, 6, 4)}
# The eleven cube nets as squares (column, row).
CUBE_NETS = (
    [[(0, 1), (1, 1), (2, 1), (3, 1), (a, 0), (b, 2)] for a, b in ((0, 0), (0, 1), (0, 2), (0, 3), (1, 1), (1, 2))]
    + [[(0, 0), (1, 0), (1, 1), (2, 1), (3, 1), (c, 2)] for c in (1, 2, 3)]
    + [[(0, 0), (1, 0), (1, 1), (2, 1), (2, 2), (3, 2)], [(0, 0), (1, 0), (2, 0), (2, 1), (3, 1), (4, 1)]]
)
H3 = math.sqrt(3) / 2


def _turn(cells, k: int, mirror: bool):
    out = []
    for x, y in cells:
        if mirror:
            x = -x
        for _ in range(k):
            x, y = -y, x
        out.append((x, y))
    mx, my = min(c[0] for c in out), min(c[1] for c in out)
    return sorted([x - mx, y - my] for x, y in out)


def stages(p: dict) -> tuple[int, int] | None:
    """Nets of solids: Stage 4 on."""
    return (4, 6) if p["band"] == "P" else None


def sample(rng: random.Random) -> dict:
    band = rng.choice(BANDS)
    solid = rng.choice(SOLIDS)
    p = {"band": band, "name": rng.choice(NAMES), "solid": solid}
    if solid == "cube":
        s = rng.randint(2, 9)
        p.update(cells=_turn(rng.choice(CUBE_NETS), rng.randrange(4), rng.random() < 0.5), size=s, dims=[s, s, s])
    elif solid == "cuboid":
        while True:  # no edge more than two and a half times another, so no face is a thin strip
            l, w, h = rng.sample(range(3, 10), 3)
            if max(l, w, h) <= 2.5 * min(l, w, h):
                break
        p.update(dims=[l, w, h])
    else:
        p.update(size=rng.randint(3, 9), length=rng.randint(6, 12))
    return p


def _faces(p: dict) -> list[list[tuple[float, float]]]:
    s = p["solid"]
    if s == "cube":
        return [[(c, r), (c + 1, r), (c + 1, r + 1), (c, r + 1)] for c, r in p["cells"]]
    if s == "cuboid":
        l, w, h = (v / max(p["dims"]) * 1.6 for v in p["dims"])
        rect = lambda x, y, a, b: [(x, y), (x + a, y), (x + a, y + b), (x, y + b)]  # noqa: E731
        return [rect(w, 0, l, h), rect(w, h, l, w), rect(w, h + w, l, h), rect(w, 2 * h + w, l, w),
                rect(0, h + w, w, h), rect(w + l, h + w, w, h)]
    if s == "triangular prism":
        a, L = 1.0, p["length"] / p["size"]
        rects = [[(i * a, 0), ((i + 1) * a, 0), ((i + 1) * a, L), (i * a, L)] for i in range(3)]
        return rects + [[(a, L), (2 * a, L), (1.5 * a, L + H3 * a)], [(a, 0), (2 * a, 0), (1.5 * a, -H3 * a)]]
    if s == "square-based pyramid":
        a, t = 1.0, 1.2
        return [[(0, 0), (a, 0), (a, a), (0, a)], [(0, 0), (a, 0), (a / 2, -t)], [(a, 0), (a, a), (a + t, a / 2)],
                [(a, a), (0, a), (a / 2, a + t)], [(0, a), (0, 0), (-t, a / 2)]]
    pts = {"l": (0, 0), "r": (2, 0), "t": (1, 2 * H3), "ml": (0.5, H3), "mr": (1.5, H3), "mb": (1, 0)}
    return [[pts["l"], pts["mb"], pts["ml"]], [pts["mb"], pts["r"], pts["mr"]], [pts["ml"], pts["mr"], pts["t"]],
            [pts["ml"], pts["mb"], pts["mr"]]]


def draw(p: dict):
    faces = _faces(p)
    xs = [x for f in faces for x, _ in f]
    ys = [y for f in faces for _, y in f]
    fig, ax = new_figure(min(7.0, 1.2 + 1.1 * (max(xs) - min(xs))), min(6.0, 1.0 + 1.1 * (max(ys) - min(ys))))
    for f in faces:
        ax.add_patch(Polygon(f, closed=True, facecolor=FILL_2, edgecolor=INK, linewidth=1.6))
    if p["solid"] == "cuboid":
        # Each length once, outside the net: l under the bottom face, h and w on the left side face.
        l, w, h = p["dims"]
        (x0, y0), (x1, _), _, _ = faces[0]
        ax.text((x0 + x1) / 2, y0 - 0.06, f"{l} cm", ha="center", va="top", fontsize=11)
        (sx0, sy0), (sx1, _), (_, sy2), _ = faces[4]
        ax.text(sx0 - 0.06, (sy0 + sy2) / 2, f"{h} cm", ha="right", va="center", fontsize=11)
        ax.text((sx0 + sx1) / 2, sy2 + 0.06, f"{w} cm", ha="center", va="bottom", fontsize=11)
    ax.set_xlim(min(xs) - 0.7, max(xs) + 0.5)
    ax.set_ylim(min(ys) - 0.4, max(ys) + 0.4)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def questions(p: dict, rng: random.Random) -> list:
    solid, name = p["solid"], p["name"]
    size = {"cube": f" Each square has sides of {p.get('size')} cm.", "cuboid": "",
            "triangular prism": f" The triangles have sides of {p.get('size')} cm.",
            "square-based pyramid": f" The square has sides of {p.get('size')} cm.",
            "tetrahedron": f" Each triangle has sides of {p.get('size')} cm."}[solid]
    # A cube is a cuboid too: never offer both.
    others = [s for s in SOLIDS if s != solid and not (solid == "cube" and s == "cuboid") and not (solid == "cuboid" and s == "cube")]
    qs = [mcq(f"{name} cuts this net out of card.{size} Which solid does it fold to make?", solid, rng.sample(others, 3), rng)]
    feature = rng.randrange(3)
    word = ("faces", "edges", "vertices")[feature]
    qs.append(count(f"How many {word} does the solid made from {name}'s net have?", COUNTS[solid][feature], word))
    if p["band"] == "LS" and solid in ("cube", "cuboid"):
        l, w, h = p["dims"]
        area = 2 * (l * w + l * h + w * h)
        qs.append(short(f"{size.strip()} What is the total area of card in {name}'s net?".lstrip(), area,
                        [f"{area} cm²", f"{area} cm2", f"{area} cm^2", f"{area}cm²", f"{area}cm2"]))
    return qs
