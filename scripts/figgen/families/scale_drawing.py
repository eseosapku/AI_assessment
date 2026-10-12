"""A plan on a centimetre grid with a scale (P, LS): the real length and width, at Lower Secondary the
real area, and how long a real distance is on the plan.

The plan's sides are whole centimetres (grid squares), so they are counted, never guessed, and every
answer is a whole number.
"""
from __future__ import annotations

import random

from matplotlib.patches import Rectangle

from ..core import FILL_2, GRID, INK, NAMES, new_figure, short

ID = "scale_drawing"
KIND = "maths.measure"
SUBJECT = "mathematics"
BANDS = ("P", "LS")
CONCEPTS = tuple(f"mathematics.{c}" for c in ("scale-drawing-concept", "scale-drawings-actual-distance", "scale-drawings-length",
                                              "direct-proportion-meaning", "ratio-direct-proportion-ls"))
# Plans with a scale: not simplifying ratios, unit conversion, multipliers or Thales.
AVOID = r"simplifying ratios|miles and kilometres|multiplier|thales"
PLACES = {"P": [("classroom", [1, 2]), ("garden", [2, 5]), ("school compound", [5, 10]), ("farm plot", [5, 10])],
          "LS": [("classroom", [1, 2]), ("football pitch", [10, 20]), ("garden", [2, 5]), ("school compound", [10, 20]),
                 ("farm", [20, 50])]}


def stages(p: dict) -> tuple[int, int] | None:
    return (5, 6) if p["band"] == "P" else None


def sample(rng: random.Random) -> dict:
    band = rng.choice(BANDS)
    place, scales = rng.choice(PLACES[band])
    while True:
        w, h = rng.randint(3, 12), rng.randint(2, 8)
        if w != h:
            return {"band": band, "place": place, "scale": rng.choice(scales), "w": w, "h": h, "name": rng.choice(NAMES)}


def draw(p: dict):
    w, h = p["w"], p["h"]
    W, H = w + 2, h + 2
    fig, ax = new_figure(0.45 * W + 0.4, 0.45 * (H + 1.6) + 0.4)
    for x in range(W + 1):
        ax.plot([x, x], [0, H], color=GRID, linewidth=0.6)
    for y in range(H + 1):
        ax.plot([0, W], [y, y], color=GRID, linewidth=0.6)
    ax.add_patch(Rectangle((1, 1), w, h, facecolor=FILL_2, edgecolor=INK, linewidth=2.0))
    ax.text(1 + w / 2, 1 + h / 2, f"Plan of the {p['place']}", ha="center", va="center", fontsize=10,
            fontweight="bold", wrap=True)
    ax.text(0, H + 0.8, f"Scale: 1 cm represents {p['scale']} m", ha="left", va="center", fontsize=11)
    ax.set_xlim(-0.1, W + 0.1)
    ax.set_ylim(-0.1, H + 1.5)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def questions(p: dict, rng: random.Random) -> list:
    w, h, sc, place, name = p["w"], p["h"], p["scale"], p["place"], p["name"]
    long_, short_ = max(w, h), min(w, h)
    unit = lambda v: [f"{v} m", f"{v}m", f"{v} metres"]  # noqa: E731
    qs = [short(f"{name} drew a plan of the {place} on centimetre squares. What is the real length of the {place}?",
                long_ * sc, unit(long_ * sc)),
          short(f"What is the real width of the {place}?", short_ * sc, unit(short_ * sc))]
    if p["band"] == "LS":
        area = w * h * sc * sc
        qs.append(short(f"What is the real area of the {place}?", area, [f"{area} m²", f"{area} m2", f"{area} square metres"]))
    k = rng.randint(2, 15)
    qs.append(short(f"A path beside {name}'s {place} is {k * sc} m long in real life. How long is it on the plan, in centimetres?", k,
                    [f"{k} cm", f"{k}cm"]))
    return qs
