"""Coastal features (UP): two drawings side by side, as textbooks show them. On the left, a headland seen from the
side, worn back by the waves in its stages: a cave at the foot of the cliff, an arch through the headland, a stack
standing apart, and a stump just above the sea. On the right, a map of a bay with a beach of sand, and a spit of sand
growing across a river's mouth, with longshore drift marked. Five or six features are lettered A to F, in a
shuffled order, and never named; the arch and the stack always are, and at least one of the beach and the spit.

Which letter shows the stage that comes after a cave, an arch or a stack (a fixed order a teacher would agree with:
cave, arch, stack, stump); which letter shows a feature formed by deposition (one of the beach and the spit, beside
features of erosion only); which letter shows a named feature.
"""
from __future__ import annotations

import math
import random

from matplotlib.patches import Polygon, Rectangle

from ..core import INK, NAMES, new_figure
from ._bio_parts import letter, letter_choice, spline, tube

ID = "coast_features"
KIND = "geo.section"
SUBJECT = "geography"
BANDS = ("UP",)  # no Lower Secondary book teaches coasts
CONCEPTS = tuple(f"geography.{c}" for c in ("coastal-erosion-landforms", "coastal-deposition-landforms",
                                            "coastal-processes", "erosion-transport"))
# A topic whose sections the book lists is reached only if its name or a section names coasts or waves.
NEEDS = r"coast|wave erosion|wave action|\bwaves?\b|shore|beach"
# Ocean resources and fishing chapters share no landform; nor do coral reef sections on their own.
AVOID = r"fish|resource|ocean current|marine"

EROSION = ["cave", "arch", "stack", "stump"]
DEPOSITION = ["beach", "spit"]
NEXT = {"cave": "arch", "arch": "stack", "stack": "stump"}
ARTICLE = {"cave": "a", "arch": "an", "stack": "a", "stump": "a", "beach": "a", "spit": "a"}
ROCK, SEA, SAND, LAND = "#cdb68f", "#9cc8ee", "#efdc9c", "#e3ecd2"


def sample(rng: random.Random) -> dict:
    while True:
        shown = ["arch", "stack"] + [f for f in ("cave", "stump") if rng.random() < 0.7]
        shown += [f for f in DEPOSITION if rng.random() < 0.6]
        if 5 <= len(shown) <= 6 and set(shown) & set(DEPOSITION):
            break
    letters = list("ABCDEF"[:len(shown)])
    rng.shuffle(letters)
    return {"band": rng.choice(BANDS), "labels": dict(sorted(zip(letters, shown)))}


# --- drawing ----------------------------------------------------------------------------------------

LEVEL = 1.0  # sea level in the side view


def _side(ax) -> dict:
    """The headland from the side. Returns where each feature's leader ends."""
    ax.add_patch(Polygon([(0.2, 0.25), (0.2, 3.4), (3.85, 3.4), (4.15, 3.05), (4.25, 0.25)], closed=True,
                         facecolor=ROCK, edgecolor=INK, linewidth=1.2, zorder=1, gid="headland"))
    for y in (1.75, 2.45, 3.0):  # bedding in the cliff
        ax.plot([0.2, 4.1 if y < 3 else 3.95], [y, y], color="#8d7a58", linewidth=0.7, zorder=1.1)
    ax.plot([0.2, 3.85], [3.4, 3.4], color="#5f8a3a", linewidth=2.2, zorder=1.2)  # grass on the cliff top
    ax.add_patch(Polygon([(1.35 + 0.4 * math.cos(math.radians(a)), LEVEL + 0.85 * math.sin(math.radians(a)))
                          for a in range(0, 181, 10)], closed=True, facecolor="#3b3125", edgecolor=INK, linewidth=1.0,
                         zorder=1.5, gid="part:cave"))
    # the arch: an opening right through the headland near its end, the sky and the sea seen through it
    hole = spline([(2.68, LEVEL - 0.3), (2.8, 1.55), (3.0, 2.2), (3.25, 2.4), (3.5, 2.2), (3.68, 1.55), (3.8, LEVEL - 0.3)],
                  closed=False, per=8)
    ax.add_patch(Polygon(hole, closed=True, facecolor="#eef5fc", edgecolor=INK, linewidth=1.0, zorder=1.5,
                         gid="part:arch"))
    ax.add_patch(Polygon([(4.75, 0.25), (4.85, 2.85), (5.05, 3.05), (5.3, 2.85), (5.42, 0.25)], closed=True, facecolor=ROCK,
                         edgecolor=INK, linewidth=1.2, zorder=1, gid="part:stack"))
    ax.add_patch(Polygon([(6.0, 0.25), (6.08, 1.3), (6.3, 1.42), (6.55, 1.28), (6.66, 0.25)], closed=True, facecolor=ROCK,
                         edgecolor=INK, linewidth=1.2, zorder=1, gid="part:stump"))
    ax.add_patch(Rectangle((0.2, 0.25), 6.75, LEVEL - 0.25, facecolor=SEA, edgecolor="none", alpha=0.9, zorder=2,
                           gid="sea"))
    ax.plot([0.2, 6.95], [LEVEL, LEVEL], color="#2a6bb8", linewidth=1.2, zorder=2.1, gid="sea-level")
    ax.text(3.6, 4.85, "A headland seen from the side", ha="center", va="center", fontsize=10.5)
    return {"cave": ((0.75, 4.2), (1.35, 1.35)), "arch": ((2.55, 4.2), (3.25, 1.75)), "stack": ((5.05, 4.2), (5.08, 2.3)),
            "stump": ((6.35, 2.65), (6.32, 1.18))}


OX = 7.75  # where the map starts


def _plan(ax) -> dict:
    """A map of a bay with a beach, and a spit across a river's mouth. Returns where each feature's leader ends."""
    m = lambda pts: [(OX + u, v) for u, v in pts]  # noqa: E731
    ax.add_patch(Rectangle((OX, 0.25), 5.4, 4.3, facecolor=SEA, edgecolor="none", zorder=0.5, gid="map-sea"))
    coast = spline([(0.0, 2.05), (0.55, 2.2), (1.05, 2.95), (2.0, 3.25), (2.95, 2.9), (3.35, 2.35), (3.6, 2.3)],
                   closed=False, per=8)
    land = m(coast + [(3.75, 2.6), (3.85, 3.3), (3.9, 4.55), (0.0, 4.55)])
    ax.add_patch(Polygon(land, closed=True, facecolor=LAND, edgecolor=INK, linewidth=1.0, zorder=1, gid="land"))
    ax.add_patch(Polygon(m([(4.35, 4.55), (4.4, 3.3), (4.6, 2.75), (4.95, 2.48), (5.4, 2.42), (5.4, 4.55)]), closed=True,
                         facecolor=LAND, edgecolor=INK, linewidth=1.0, zorder=1, gid="land"))
    # the beach: a strip of sand along the bay's shore
    inner = [q for q in coast if 0.75 <= q[0] <= 3.15]
    outer = []
    for i, (u, v) in enumerate(inner):
        a, b = inner[max(i - 1, 0)], inner[min(i + 1, len(inner) - 1)]
        du, dv = b[0] - a[0], b[1] - a[1]
        ln = math.hypot(du, dv) or 1.0
        outer.append((u + dv / ln * 0.22, v - du / ln * 0.22))
    ax.add_patch(Polygon(m(inner + outer[::-1]), closed=True, facecolor=SAND, edgecolor="#8a7440", linewidth=0.8,
                         zorder=1.5, gid="part:beach"))
    # the spit: sand growing east from the shore across the river's mouth, its end curved back towards the land
    spit = tube(spline([(3.45, 2.3), (3.9, 2.17), (4.3, 2.1), (4.58, 2.13), (4.72, 2.27), (4.7, 2.42)], closed=False,
                       per=8), 0.15)
    ax.add_patch(Polygon(m(spit), closed=True, facecolor=SAND, edgecolor="#8a7440", linewidth=0.8, zorder=1.6,
                         gid="part:spit"))
    # the river, flowing out to the sea through the gap the spit leaves
    river = [(4.12, 4.55), (4.12, 3.5), (4.2, 2.95), (4.36, 2.62)]
    ax.plot(*zip(*m(river)), color="#2a6bb8", linewidth=2.2, zorder=1.7, gid="river")
    # longshore drift along the shore, towards the spit
    for u0 in (0.9, 2.3):
        ax.annotate("", xy=(OX + u0 + 0.85, 1.55), xytext=(OX + u0, 1.55), zorder=3, gid="drift",
                    arrowprops=dict(arrowstyle="-|>,head_length=0.5,head_width=0.25", color=INK, lw=1.3,
                                    shrinkA=0, shrinkB=0))
    ax.text(OX + 2.1, 1.2, "longshore drift", ha="center", va="center", fontsize=9.5, style="italic", zorder=3)
    ax.text(OX + 4.6, 0.65, "Sea", ha="center", va="center", fontsize=10.5, style="italic", zorder=3)
    ax.text(OX + 1.2, 4.0, "Land", ha="center", va="center", fontsize=10.5, style="italic", zorder=3)
    ax.plot([OX, OX + 5.4, OX + 5.4, OX, OX], [0.25, 0.25, 4.55, 4.55, 0.25], color=INK, linewidth=1.0, zorder=4,
            gid="map-frame")
    ax.text(OX + 2.7, 4.85, "A map of a bay and a river's mouth", ha="center", va="center", fontsize=10.5)
    mid = inner[len(inner) // 2]
    o = outer[len(outer) // 2]
    return {"beach": ((OX + 1.95, 2.3), (OX + (mid[0] + o[0]) / 2, (mid[1] + o[1]) / 2)),
            "spit": ((OX + 3.6, 1.45), (OX + 4.0, 2.15))}


def draw(p: dict):
    fig, ax = new_figure(9.8, 4.0)
    slots = {**_side(ax), **_plan(ax)}
    for L, name in p["labels"].items():
        at, end = slots[name]
        letter(ax, L, at, end, gap=0.25, size=14)
    ax.set_xlim(0.1, 13.25)
    ax.set_ylim(0.15, 5.1)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


# --- questions --------------------------------------------------------------------------------------

INTROS = ["{name} drew a headland and a map of a nearby bay {setting}.",
          "{name} sketched these coastal features {setting}.",
          "{name} copied these drawings of a coast {setting}.",
          "{name} is revising coastal landforms from these drawings {setting}."]
SETTINGS = ["after a trip to the coast at Mombasa", "from photographs of the coast of Tanzania", "for a geography lesson",
            "for homework", "for a revision poster", "after a film about the coast of Ghana",
            "at the geography club in Huye", "for a class display in Kigali"]


def questions(p: dict, rng: random.Random) -> list:
    labels = p["labels"]
    at = {v: k for k, v in labels.items()}
    intro = rng.choice(INTROS).format(name=rng.choice(NAMES), setting=rng.choice(SETTINGS))
    eroded = sorted(at[f] for f in EROSION if f in at)
    prev = rng.choice([f for f in NEXT if NEXT[f] in at])
    key1 = at[NEXT[prev]]
    near = [at[f] for f in (prev, "stump" if NEXT[prev] != "stump" else "stack") if f in at]
    qs = [letter_choice(f"{intro} Which letter shows the stage that comes after {ARTICLE[prev]} {prev} in the erosion "
                        "of a headland?", key1, near + [L for L in eroded if L != key1])]
    dep = rng.choice([f for f in DEPOSITION if f in at])
    qs.append(letter_choice("Which letter shows a feature formed by deposition?", at[dep],
                            [L for L in eroded if L != key1] + eroded))
    rest = [f for f in labels.values() if at[f] not in (key1, at[dep])]
    name = rng.choice(sorted(rest))
    others = [L for L in sorted(labels) if L != at[name]]
    rng.shuffle(others)
    qs.append(letter_choice(f"Which letter shows {ARTICLE[name]} {name}?", at[name], others))
    return qs
