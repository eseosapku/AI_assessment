"""Two places with north lines: a bearing to work out, and the bearing back (LS, UP).

The angle printed is measured from the nearest of N, E, S and W -- never the bearing itself --
so the student turns it into a three-figure bearing.
"""
from __future__ import annotations

import math
import random

from matplotlib.patches import Arc

from ..core import INK, new_figure, short

ID = "bearings"
KIND = "maths.geometry"
SUBJECT = "mathematics"
BANDS = ("LS", "UP")
CONCEPTS = tuple(f"mathematics.{c}" for c in ("bearings", "regular-polygons-bearings", "scale-drawing-concept", "scale-drawings-actual-distance"))

PLACES = ["school", "market", "health centre", "church", "well", "bus stop", "farm", "police station", "mosque", "bridge"]
REFS = {0: "N", 90: "E", 180: "S", 270: "W"}


def sample(rng: random.Random) -> dict:
    band = rng.choice(BANDS)
    a, b = rng.sample(PLACES, 2)
    theta = rng.choice([t for t in range(1, 360) if 10 <= t % 90 <= 80])
    ref = min(REFS, key=lambda r: min(abs(theta - r), 360 - abs(theta - r)))
    given = min(abs(theta - ref), 360 - abs(theta - ref))
    return {"band": band, "from": a, "to": b, "theta": theta, "ref": ref, "given": given}


def positions(p: dict) -> tuple[tuple[float, float], tuple[float, float]]:
    t = math.radians(p["theta"])
    return (0.0, 0.0), (3.0 * math.sin(t), 3.0 * math.cos(t))


def _north(ax, x: float, y: float) -> None:
    ax.annotate("", xy=(x, y + 1.3), xytext=(x, y), arrowprops={"arrowstyle": "-|>", "color": INK, "linewidth": 1.4})
    ax.text(x, y + 1.45, "N", ha="center", va="bottom", fontsize=12, fontweight="bold")


def draw(p: dict):
    (ax_, ay), (bx, by) = positions(p)
    fig, ax = new_figure(5.6, 5.6)
    # Compass lines at the first place, north marked; a north line at the second for the way back.
    for dx, dy in ((0, -1.3), (1.3, 0), (-1.3, 0)):
        ax.plot([ax_, ax_ + dx], [ay, ay + dy], color=INK, linewidth=0.9, linestyle=(0, (4, 3)))
    _north(ax, ax_, ay)
    _north(ax, bx, by)
    ax.plot([ax_, bx], [ay, by], color=INK, linewidth=1.8)
    # Each name on the far side of its place from the line, clear of the line and the angle.
    ux, uy = (bx - ax_) / 3.0, (by - ay) / 3.0
    for (x, y), name, (dx, dy) in (((ax_, ay), p["from"], (-ux, -uy)), ((bx, by), p["to"], (ux, uy))):
        ax.plot(x, y, "o", color=INK, markersize=6)
        ax.text(x + 0.45 * dx, y + 0.45 * dy, name.capitalize(), fontsize=11,
                ha="left" if dx > 0.25 else "right" if dx < -0.25 else "center",
                va="bottom" if dy > 0.25 else "top" if dy < -0.25 else "center")
    # The printed angle: from the nearest compass direction to the line, an arc between them.
    theta, ref = p["theta"], p["ref"]
    start, end = 90 - ref, 90 - theta  # matplotlib angles: anticlockwise from east
    lo, hi = sorted((start, end)) if abs(start - end) < 180 else sorted((start, end + 360 if end < start else end - 360))
    ax.add_patch(Arc((ax_, ay), 1.4, 1.4, theta1=lo, theta2=hi, color=INK, linewidth=1.2))
    mid = math.radians((lo + hi) / 2)
    ax.text(ax_ + 1.0 * math.cos(mid), ay + 1.0 * math.sin(mid), f"{p['given']}°", ha="center", va="center", fontsize=11)
    xs, ys = [ax_, bx], [ay, by]
    ax.set_xlim(min(xs) - 2.2, max(xs) + 2.2)
    ax.set_ylim(min(ys) - 1.8, max(ys) + 2.0)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def _forms(t: int) -> list[str]:
    return [f"{t:03d}°", f"{t:03d}", str(t), f"{t}°", f"{t:03d} degrees"]


def questions(p: dict, rng: random.Random) -> list:
    t, a, b = p["theta"], p["from"], p["to"]
    back = (t + 180) % 360
    return [
        short(f"Find the bearing of the {b} from the {a}.", f"{t:03d}°", _forms(t)[1:]),
        short(f"The bearing of the {b} from the {a} is {t:03d}°. Find the bearing of the {a} from the {b}.", f"{back:03d}°",
              _forms(back)[1:]),
    ]
