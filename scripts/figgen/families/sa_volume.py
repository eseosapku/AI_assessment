"""Surface area to volume (LS, UP): three lettered cubes of agar, whole centimetres a side, drawn in perspective with
a side labelled. The surface area, the volume and the surface-area-to-volume ratio of a cube, and in which cube
acid would reach the centre first.

The ratio of a cube of side a is 6/a, exact for sides 1 to 6 cm; the smallest cube has the most surface for its
volume.
"""
from __future__ import annotations

import random
from fractions import Fraction

from matplotlib.patches import Polygon

from ..core import INK, NAMES, exact, mcq, new_figure, short

ID = "sa_volume"
KIND = "maths.solid"
SUBJECT = "biology"
BANDS = ("LS", "UP")
CONCEPTS = tuple(f"biology.{c}" for c in ("size-surface-area-volume-ratio", "gas-exchange", "cell-membranes-transport"))
AVOID = r"enzyme|genetic|inherit|immun|disease|reproduc|digest|photosynth|hormone|ecolog|population|plant|classification|living things|human nutrition|proteins|specialized tissues"
# A topic whose sections the book lists is reached only if one names what this figure teaches.
NEEDS = r"surface area|volume ratio|diffusion|exchange surface|gas exchange"
S = 0.55  # drawing units a centimetre


def sample(rng: random.Random) -> dict:
    sides = sorted(rng.sample(range(1, 7), 3))
    rng.shuffle(sides)
    letters = rng.choice(["ABC", "PQR", "XYZ"])
    cubes = [{"letter": letter, "side": s} for letter, s in zip(letters, sides)]
    asks = rng.sample(letters, 3)
    return {"band": rng.choice(BANDS), "cubes": cubes, "sa": asks[0], "vol": asks[1], "ratio": asks[2]}


def _cube(ax, x, a):
    s = a * S
    d = s * 0.45  # the depth drawn back at 45°
    front = [(x, 0), (x + s, 0), (x + s, s), (x, s)]
    top = [(x, s), (x + s, s), (x + s + d, s + d), (x + d, s + d)]
    side = [(x + s, 0), (x + s + d, d), (x + s + d, s + d), (x + s, s)]
    for face, shade in ((front, "#e9e4d4"), (top, "#f5f1e6"), (side, "#d8d1bb")):
        ax.add_patch(Polygon(face, closed=True, facecolor=shade, edgecolor=INK, linewidth=1.2))
    ax.text(x + s / 2, -0.25, f"{a} cm", ha="center", va="top", fontsize=10)
    return x + s + d


def draw(p: dict):
    fig, ax = new_figure(7.0, 3.6)
    x = 0.3
    for c in p["cubes"]:
        right = _cube(ax, x, c["side"])
        ax.text(x + c["side"] * S * 0.5, c["side"] * S * 1.45 + 0.35, c["letter"], ha="center", va="bottom", fontsize=14,
                fontweight="bold")
        x = right + 0.9
    top = max(c["side"] for c in p["cubes"]) * S * 1.45 + 1.2
    ax.set_xlim(0, x)
    ax.set_ylim(-0.9, top)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


SETTINGS = ["in a biology practical", "for a class investigation", "in the school laboratory", "at the science club"]


def questions(p: dict, rng: random.Random) -> list:
    who, friend = rng.sample(NAMES, 2)
    side = {c["letter"]: c["side"] for c in p["cubes"]}
    a, b, c = p["sa"], p["vol"], p["ratio"]
    sa, vol, ratio = 6 * side[a] ** 2, side[b] ** 3, Fraction(6, side[c])
    r = exact(ratio)
    small = min(side, key=side.get)
    qs = [short(f"{who} cut cubes of agar jelly {rng.choice(SETTINGS)}. What is the surface area of cube {a}, in cm²?", sa,
                [str(sa), f"{sa} cm²", f"{sa} cm2"]),
          short(f"What is the volume of cube {b}, in cm³?", vol, [str(vol), f"{vol} cm³", f"{vol} cm3"]),
          short(f"What is the surface area to volume ratio of cube {c}? Give it as a number to 1.", r,
                [r, f"{r}:1", f"{r} : 1", f"{r} to 1"])]
    if p["band"] == "UP" or rng.random() < 0.5:
        qs.append(mcq(f"{friend} puts the cubes, coloured with an indicator, into acid. In which cube does the acid reach the centre first?",
                      small, [x for x in side if x != small], rng))
    return qs
