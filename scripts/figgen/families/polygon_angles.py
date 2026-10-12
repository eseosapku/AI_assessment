"""A convex polygon with all its interior angles labelled but one (LS, UP).

The polygon is built from its angles -- turning by each exterior angle in turn, with side
lengths solved so it closes -- so it is drawn exactly as labelled.
"""
from __future__ import annotations

import math
import random

from matplotlib.patches import Arc

from ..core import INK, new_figure, short

ID = "polygon_angles"
KIND = "maths.geometry"
SUBJECT = "mathematics"
BANDS = ("LS", "UP")
CONCEPTS = tuple(f"mathematics.{c}" for c in ("polygons", "symmetry-polygons", "calculating-angles", "triangle-exterior-angle", "2d-shapes"))

NAMES = {4: "quadrilateral", 5: "pentagon", 6: "hexagon"}


def sample(rng: random.Random) -> dict:
    band = rng.choice(BANDS)
    n = rng.choice([4, 5] if band == "LS" else [5, 6])
    while True:
        # Exterior angles that sum to 360, each 15-120 degrees, in fives: interior 60-165.
        cuts = sorted(rng.sample(range(5, 360, 5), n - 1))
        ext = [b - a for a, b in zip([0, *cuts], [*cuts, 360])]
        if all(15 <= e <= 120 for e in ext):
            angles = [180 - e for e in ext]
            sides = _sides(ext, rng)
            if sides:
                return {"band": band, "angles": angles, "sides": sides, "unknown": rng.randrange(n)}


def _sides(ext: list[int], rng: random.Random) -> list[float] | None:
    """Side lengths that close the polygon: all but the last two chosen, those two solved for."""
    n = len(ext)
    heading = _headings(ext)
    d = [(math.cos(math.radians(h)), math.sin(math.radians(h))) for h in heading]
    for _ in range(50):
        free = [rng.uniform(1.0, 2.0) for _ in range(n - 2)]
        sx = -sum(f * v[0] for f, v in zip(free, d))
        sy = -sum(f * v[1] for f, v in zip(free, d))
        (ax, ay), (bx, by) = d[n - 2], d[n - 1]
        det = ax * by - ay * bx
        if abs(det) < 1e-9:
            return None
        u = (sx * by - sy * bx) / det
        w = (ax * sy - ay * sx) / det
        sides = [*free, u, w]
        if min(sides) >= 0.8 and max(sides) <= 3.0:
            return [round(v, 4) for v in sides]
    return None


def _headings(ext: list[int]) -> list[int]:
    """Direction of each side, in degrees: side i leaves vertex i, turning there by ext[i]."""
    return [sum(ext[1:i + 1]) for i in range(len(ext))]


def vertices(p: dict) -> list[tuple[float, float]]:
    """Corners in order, anticlockwise: vertex i is where the angle p["angles"][i] is."""
    heading = _headings([180 - a for a in p["angles"]])
    pts, x, y = [], 0.0, 0.0
    for s, h in zip(p["sides"], heading):
        pts.append((x, y))
        x, y = x + s * math.cos(math.radians(h)), y + s * math.sin(math.radians(h))
    return pts


def draw(p: dict):
    # Drawn at twice the size, so the labels (a fixed distance in) sit close to their own corners.
    pts = [(2.2 * x, 2.2 * y) for x, y in vertices(p)]
    n = len(pts)
    fig, ax = new_figure(5.4, 4.4)
    xs, ys = [q[0] for q in pts] + [pts[0][0]], [q[1] for q in pts] + [pts[0][1]]
    ax.plot(xs, ys, color=INK, linewidth=1.8)
    # Each angle marked by an arc at its own corner, its label on the corner's bisector, so no
    # label can be read as another corner's.
    for i, (vx, vy) in enumerate(pts):
        qx, qy = pts[(i + 1) % n]
        a_next = math.degrees(math.atan2(qy - vy, qx - vx))
        ax.add_patch(Arc((vx, vy), 0.7, 0.7, theta1=a_next, theta2=a_next + p["angles"][i], color=INK, linewidth=1.1))
        mid = math.radians(a_next + p["angles"][i] / 2)
        r = 0.9 if p["angles"][i] < 100 else 0.82
        label = "x" if i == p["unknown"] else f"{p['angles'][i]}°"
        ax.text(vx + r * math.cos(mid), vy + r * math.sin(mid), label, ha="center", va="center", fontsize=11,
                style="italic" if label == "x" else "normal")
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def questions(p: dict, rng: random.Random) -> list:
    angles, u = p["angles"], p["unknown"]
    n = len(angles)
    known = [f"{a}°" for i, a in enumerate(angles) if i != u]
    listed = f"{', '.join(known[:-1])} and {known[-1]}"
    words = ("Three", "Four", "Five")[n - 4]
    x = angles[u]
    return [
        short(f"{words} of the angles of this {NAMES[n]} are {listed}. Find the angle x.", x, [f"{x}°"]),
        short(f"What is the sum of the interior angles of a {NAMES[n]}?", (n - 2) * 180, [f"{(n - 2) * 180}°"]),
        short(f"The {NAMES[n]} has angles {listed} and x. What is the exterior angle at the corner marked x?", 180 - x, [f"{180 - x}°"]),
    ]
