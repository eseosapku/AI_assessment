"""Means of transport and communication (P, Primary Social Studies), of three kinds.

- sort (P1 to P6): six pictures in two rows, each in a box of its own with a letter (A to F) in its top corner and its
  name printed under it: means of transport from a fixed table, each of one kind only (land: bicycle, motorbike, car,
  bus, lorry, train; water: boat, canoe, ship; air: plane, helicopter). Which letter shows a means of transport that
  travels on water (or flies in the air)? Asked only of a kind with exactly one picture. How many pictures show land
  (water, air) transport?
- mixed (P1 to P6): six such pictures, two or three of them means of communication (phone, radio, television,
  newspaper, computer). How many pictures show means of communication? Which letter shows the one means of transport
  that travels on water (flies in the air)? How many show land transport?
- journey (P3 to P6): a table of four ways to make one trip between invented places (bicycle, motorbike, bus, car),
  with a small picture, the time in minutes and the fare in francs. Which way is the fastest, which the cheapest (one
  each, never a near thing: 5 minutes and 100 Frw clear of the next), how much more one way costs than another, and
  (upper) how many minutes longer one takes, or what two or three friends pay together.

The pictures are drawn as a Primary book draws them: big simple shapes in plain colours.
"""
from __future__ import annotations

import math
import random

from matplotlib.patches import Circle, Ellipse, FancyBboxPatch, Polygon, Rectangle

from ..core import INK, NAMES, Question, count, mcq, money, new_figure, short

ID = "transport_communication_p"
KIND = "diagram.template"
SUBJECT = "social-studies"
BANDS = ("P",)
SORT = ("social-studies.transport-types-means",)
MIXED = ("social-studies.transport-types-means", "social-studies.communication-tools-media")
JOURNEY = ("social-studies.transport-types-means", "social-studies.transport-services")
CONCEPTS = ("social-studies.transport-types-means", "social-studies.communication-tools-media",
            "social-studies.transport-services")
# A topic whose sections the book lists is reached only if its name or a section names transport or communication.
NEEDS = r"transport|communication"
# Never a religious, values or behaviour topic, and never one that only shares a concept word.
AVOID = (r"\bgod\b|god's|bible|qur'?an|prayer|faith|\bsin\b|creation|commandment|charity|"
         r"democracy and governance|community helpers|rights|historical events|conflict|genocide|values|behaviour|"
         r"peace|harmony")

KINDS = {"bicycle": "land", "motorbike": "land", "car": "land", "bus": "land", "lorry": "land", "train": "land",
         "boat": "water", "canoe": "water", "ship": "water", "plane": "air", "helicopter": "air",
         "phone": "communication", "radio": "communication", "television": "communication",
         "newspaper": "communication", "computer": "communication"}
BY_KIND = {k: [n for n, v in KINDS.items() if v == k] for k in ("land", "water", "air", "communication")}
ONE_WAY = {"water": "a means of transport that travels on water", "air": "a means of transport that flies in the air"}
HOW_MANY = {"land": "land transport", "water": "water transport", "air": "air transport",
            "communication": "means of communication"}

# A trip's four ways: the time in minutes and the fare in francs, lowest and highest, for a short trip (lower) and a
# long one (upper). The bicycle is never the fastest; any of the other three may be.
WAYS = {"lower": {"bicycle": ((30, 60), (100, 500)), "motorbike": ((10, 30), (300, 1000)),
                  "bus": ((15, 40), (200, 600)), "car": ((10, 30), (1500, 3000))},
        "upper": {"bicycle": ((70, 120), (500, 1500)), "motorbike": ((30, 60), (1000, 2500)),
                  "bus": ((35, 70), (500, 1500)), "car": ((30, 60), (3000, 6000))}}
PLACES = ["Hill Village", "Lake Village", "River Village", "Sunny Village", "Green Village", "Rock Village"]
TOWNS = ["the town market", "the bus park", "the district office", "the hospital", "the big school", "the town centre"]


def stages(p: dict) -> tuple[int, int]:
    return (3, 6) if p["sub"] == "journey" else (1, 6)


def concepts_for(p: dict) -> tuple[str, ...]:
    return {"sort": SORT, "mixed": MIXED, "journey": JOURNEY}[p["sub"]]


def _sort(rng: random.Random) -> dict:
    n_w, n_a = rng.choice([(1, 1), (1, 2), (2, 1)])
    items = rng.sample(BY_KIND["land"], 6 - n_w - n_a) + rng.sample(BY_KIND["water"], n_w) + rng.sample(BY_KIND["air"], n_a)
    rng.shuffle(items)
    one = [k for k, n in (("water", n_w), ("air", n_a)) if n == 1]
    many = [k for k, n in (("land", 6 - n_w - n_a), ("water", n_w), ("air", n_a)) if n >= 2]
    return {"band": "P", "sub": "sort", "items": items, "ask_letter": rng.choice(one), "ask_count": [rng.choice(many)]}


def _mixed(rng: random.Random) -> dict:
    n_c = rng.choice([2, 3])
    n_w, n_a = rng.choice([(1, 0), (0, 1), (1, 1)] + ([(2, 1), (1, 2)] if n_c == 2 else []))
    items = (rng.sample(BY_KIND["communication"], n_c) + rng.sample(BY_KIND["land"], 6 - n_c - n_w - n_a)
             + rng.sample(BY_KIND["water"], n_w) + rng.sample(BY_KIND["air"], n_a))
    rng.shuffle(items)
    one = [k for k, n in (("water", n_w), ("air", n_a)) if n == 1]
    return {"band": "P", "sub": "mixed", "items": items, "ask_letter": rng.choice(one),
            "ask_count": ["communication", "land"]}


def _journey(rng: random.Random) -> dict:
    level = rng.choice(["lower", "upper"])
    while True:
        rows = []
        for way, ((t0, t1), (f0, f1)) in WAYS[level].items():
            rows.append([way, rng.randrange(t0, t1 + 1, 5), rng.randrange(f0, f1 + 1, 100)])
        times, fares = sorted(r[1] for r in rows), sorted(r[2] for r in rows)
        if times[1] - times[0] < 5 or fares[1] - fares[0] < 100 or len(set(times)) < 4 or len(set(fares)) < 4:
            continue
        break
    rng.shuffle(rows)
    ways = [r[0] for r in rows]
    fare = {r[0]: r[2] for r in rows}
    time = {r[0]: r[1] for r in rows}
    dear = sorted(rng.sample(ways, 2), key=lambda w: -fare[w])
    slow = sorted(rng.sample(ways, 2), key=lambda w: -time[w])
    return {"band": "P", "sub": "journey", "level": level, "trip": [rng.choice(PLACES), rng.choice(TOWNS)],
            "rows": rows, "ask": {"dear": dear, "slow": slow, "group": [rng.choice(ways), rng.choice([2, 3])]}}


def sample(rng: random.Random) -> dict:
    sub = rng.choice(["sort", "mixed", "journey"])
    return {"sort": _sort, "mixed": _mixed, "journey": _journey}[sub](rng)


# --- the pictures: each centred on (cx, cy), about 2 units wide and 1.3 high at size 1 ------------------------

def _poly(ax, pts, face, lw=1.4, z=3):
    ax.add_patch(Polygon(pts, closed=True, facecolor=face, edgecolor=INK, linewidth=lw, zorder=z))


def _rect(ax, x, y, w, h, face, lw=1.4, z=3):
    ax.add_patch(Rectangle((x, y), w, h, facecolor=face, edgecolor=INK, linewidth=lw, zorder=z))


def _wheel(ax, x, y, r, z=4):
    ax.add_patch(Circle((x, y), r, facecolor="#333333", edgecolor=INK, linewidth=1.2, zorder=z))
    ax.add_patch(Circle((x, y), r * 0.45, facecolor="#bdbdbd", edgecolor=INK, linewidth=0.8, zorder=z + 0.1))


def _waves(ax, cx, cy, s):
    xs = [cx + s * (-1.0 + 2.0 * i / 60) for i in range(61)]
    ax.plot(xs, [cy + s * (-0.5 + 0.05 * math.sin(i / 60 * 6 * math.pi)) for i in range(61)], color="#3b82c4",
            linewidth=2.2, zorder=2)


def picture(ax, kind: str, cx: float, cy: float, s: float = 1.0) -> None:
    def P(x, y):
        return (cx + x * s, cy + y * s)

    def pts(*xy):
        return [P(x, y) for x, y in xy]

    if kind == "bicycle":
        for x in (-0.6, 0.6):
            ax.add_patch(Circle(P(x, -0.25), 0.38 * s, facecolor="none", edgecolor=INK, linewidth=2.2, zorder=3))
        frame = [(-0.6, -0.25), (-0.05, -0.25), (-0.2, 0.3), (-0.6, -0.25)]
        ax.plot(*zip(*pts(*frame)), color="#c0392b", linewidth=2.6, zorder=4)
        ax.plot(*zip(*pts((-0.2, 0.3), (0.45, 0.3), (-0.05, -0.25))), color="#c0392b", linewidth=2.6, zorder=4)
        ax.plot(*zip(*pts((0.45, 0.3), (0.6, -0.25))), color="#c0392b", linewidth=2.6, zorder=4)
        ax.plot(*zip(*pts((-0.2, 0.3), (-0.24, 0.45))), color=INK, linewidth=2.0, zorder=4)
        ax.plot(*zip(*pts((-0.38, 0.47), (-0.08, 0.47))), color=INK, linewidth=4.0, solid_capstyle="round", zorder=4)
        ax.plot(*zip(*pts((0.45, 0.3), (0.42, 0.5), (0.62, 0.52))), color=INK, linewidth=2.0, zorder=4)
    elif kind == "motorbike":
        _wheel(ax, *P(-0.62, -0.3), 0.3 * s)
        _wheel(ax, *P(0.62, -0.3), 0.3 * s)
        _poly(ax, pts((-0.7, -0.1), (-0.45, 0.15), (0.3, 0.15), (0.5, -0.05), (0.25, -0.25), (-0.35, -0.25)), "#d35400")
        _rect(ax, *P(-0.55, 0.15), 0.55 * s, 0.12 * s, "#333333")
        ax.plot(*zip(*pts((0.42, 0.05), (0.62, -0.3))), color=INK, linewidth=2.4, zorder=3)
        ax.plot(*zip(*pts((0.42, 0.05), (0.38, 0.45), (0.58, 0.48))), color=INK, linewidth=2.4, zorder=3)
        ax.add_patch(Circle(P(0.55, 0.22), 0.07 * s, facecolor="#f7dc6f", edgecolor=INK, linewidth=1.0, zorder=4))
    elif kind == "car":
        _poly(ax, pts((-0.95, -0.3), (0.95, -0.3), (0.95, 0.05), (0.5, 0.1), (0.3, 0.45), (-0.4, 0.45), (-0.6, 0.1),
                      (-0.95, 0.05)), "#2e86c1")
        _poly(ax, pts((-0.48, 0.12), (-0.08, 0.12), (-0.08, 0.38), (-0.33, 0.38)), "#d6eaf8", lw=1.0, z=3.1)
        _poly(ax, pts((0.0, 0.12), (0.42, 0.12), (0.26, 0.38), (0.0, 0.38)), "#d6eaf8", lw=1.0, z=3.1)
        _wheel(ax, *P(-0.55, -0.32), 0.2 * s)
        _wheel(ax, *P(0.55, -0.32), 0.2 * s)
    elif kind == "bus":
        ax.add_patch(FancyBboxPatch(P(-1.0, -0.3), 2.0 * s, 0.85 * s, boxstyle=f"round,pad=0,rounding_size={0.08 * s}",
                                    facecolor="#f4d03f", edgecolor=INK, linewidth=1.4, zorder=3))
        for k in range(4):
            _rect(ax, *P(-0.88 + 0.36 * k, 0.15), 0.28 * s, 0.28 * s, "#d6eaf8", lw=1.0, z=3.1)
        _rect(ax, *P(0.62, -0.2), 0.22 * s, 0.63 * s, "#d6eaf8", lw=1.0, z=3.1)
        _wheel(ax, *P(-0.6, -0.32), 0.17 * s)
        _wheel(ax, *P(0.5, -0.32), 0.17 * s)
    elif kind == "lorry":
        _rect(ax, *P(-1.0, -0.22), 1.35 * s, 0.8 * s, "#27ae60")
        _poly(ax, pts((0.4, -0.22), (1.0, -0.22), (1.0, 0.18), (0.85, 0.4), (0.4, 0.4)), "#c0392b")
        _poly(ax, pts((0.6, 0.12), (0.92, 0.12), (0.82, 0.32), (0.6, 0.32)), "#d6eaf8", lw=1.0, z=3.1)
        _wheel(ax, *P(-0.7, -0.3), 0.18 * s)
        _wheel(ax, *P(-0.3, -0.3), 0.18 * s)
        _wheel(ax, *P(0.7, -0.3), 0.18 * s)
    elif kind == "train":
        ax.plot(*zip(*pts((-1.0, -0.47), (1.0, -0.47))), color=INK, linewidth=2.2, zorder=2)
        for k in range(9):
            x = -0.95 + 0.235 * k
            ax.plot(*zip(*pts((x, -0.52), (x + 0.08, -0.42))), color="#7a5230", linewidth=2.0, zorder=2)
        _rect(ax, *P(-1.0, -0.28), 1.05 * s, 0.6 * s, "#8e44ad")
        for k in range(3):
            _rect(ax, *P(-0.9 + 0.33 * k, 0.05), 0.24 * s, 0.18 * s, "#d6eaf8", lw=1.0, z=3.1)
        _rect(ax, *P(0.12, -0.28), 0.88 * s, 0.45 * s, "#c0392b")
        _rect(ax, *P(0.55, 0.17), 0.45 * s, 0.35 * s, "#c0392b")
        _rect(ax, *P(0.2, 0.17), 0.15 * s, 0.25 * s, "#333333")
        for x in (-0.8, -0.2, 0.3, 0.8):
            _wheel(ax, *P(x, -0.3), 0.13 * s)
    elif kind == "boat":
        _waves(ax, cx, cy, s)
        _poly(ax, pts((-0.95, -0.05), (0.95, -0.05), (0.7, -0.38), (-0.75, -0.38)), "#c0392b")
        _rect(ax, *P(-0.35, -0.05), 0.75 * s, 0.38 * s, "#fdfefe")
        _rect(ax, *P(-0.22, 0.08), 0.18 * s, 0.15 * s, "#d6eaf8", lw=1.0, z=3.1)
        _rect(ax, *P(0.08, 0.08), 0.18 * s, 0.15 * s, "#d6eaf8", lw=1.0, z=3.1)
    elif kind == "canoe":
        _waves(ax, cx, cy, s)
        _poly(ax, pts((-0.18, 0.02), (0.18, 0.02), (0.12, 0.32), (-0.12, 0.32)), "#f4d03f", z=2.5)
        ax.add_patch(Circle(P(0.0, 0.43), 0.12 * s, facecolor="#8d5524", edgecolor=INK, linewidth=1.2, zorder=2.5))
        ax.plot(*zip(*pts((0.05, 0.25), (0.35, 0.4))), color="#8d5524", linewidth=3.0, zorder=2.6)
        ax.plot(*zip(*pts((0.3, 0.55), (0.62, -0.38))), color="#7a5230", linewidth=3.0, zorder=2.7)
        _poly(ax, pts((0.55, -0.3), (0.68, -0.28), (0.66, -0.52), (0.56, -0.53)), "#7a5230", lw=1.0, z=2.7)
        _poly(ax, pts((-1.0, 0.05), (-0.75, -0.15), (-0.4, -0.3), (0.4, -0.3), (0.75, -0.15), (1.0, 0.05)), "#a0522d")
    elif kind == "ship":
        _waves(ax, cx, cy, s)
        _poly(ax, pts((-1.0, -0.02), (1.0, -0.02), (0.8, -0.38), (-0.85, -0.38)), "#34495e")
        _rect(ax, *P(-0.65, -0.02), 1.0 * s, 0.25 * s, "#fdfefe")
        _rect(ax, *P(-0.45, 0.23), 0.6 * s, 0.2 * s, "#fdfefe")
        _rect(ax, *P(0.45, -0.02), 0.2 * s, 0.6 * s, "#e74c3c")
        for k in range(4):
            ax.add_patch(Circle(P(-0.5 + 0.25 * k, 0.1), 0.05 * s, facecolor="#d6eaf8", edgecolor=INK, linewidth=0.8,
                                zorder=3.1))
    elif kind == "plane":
        for x, y, r in ((0.6, 0.45, 0.14), (0.78, 0.48, 0.18), (0.95, 0.44, 0.12)):
            ax.add_patch(Circle(P(x, y), r * s, facecolor="#eaf2f8", edgecolor="#9fb6c8", linewidth=1.0, zorder=2))
        _poly(ax, pts((-0.95, 0.12), (-0.8, 0.5), (-0.65, 0.5), (-0.55, 0.12)), "#2e86c1")
        ax.add_patch(FancyBboxPatch(P(-1.0, -0.12), 1.95 * s, 0.26 * s, boxstyle=f"round,pad=0,rounding_size={0.12 * s}",
                                    facecolor="#fdfefe", edgecolor=INK, linewidth=1.4, zorder=3))
        _poly(ax, pts((-0.2, -0.02), (0.25, -0.02), (-0.05, -0.55), (-0.3, -0.55)), "#2e86c1", z=3.2)
        for k in range(6):
            ax.add_patch(Circle(P(-0.55 + 0.2 * k, 0.03), 0.04 * s, facecolor="#2e86c1", edgecolor="none", zorder=3.1))
    elif kind == "helicopter":
        ax.plot(*zip(*pts((-0.95, 0.5), (0.95, 0.5))), color=INK, linewidth=3.0, zorder=4)
        ax.plot(*zip(*pts((0.1, 0.5), (0.1, 0.3))), color=INK, linewidth=2.4, zorder=4)
        ax.plot(*zip(*pts((-0.4, 0.05), (-0.95, 0.15))), color="#e67e22", linewidth=5.0, zorder=3)
        ax.add_patch(Circle(P(-0.95, 0.15), 0.12 * s, facecolor="none", edgecolor=INK, linewidth=1.6, zorder=4))
        ax.add_patch(Ellipse(P(0.1, 0.0), 1.1 * s, 0.62 * s, facecolor="#e67e22", edgecolor=INK, linewidth=1.4, zorder=3.5))
        ax.add_patch(Ellipse(P(0.38, 0.08), 0.42 * s, 0.32 * s, facecolor="#d6eaf8", edgecolor=INK, linewidth=1.0, zorder=3.6))
        ax.plot(*zip(*pts((-0.35, -0.5), (0.6, -0.5))), color=INK, linewidth=2.4, zorder=3)
        for x in (-0.15, 0.35):
            ax.plot(*zip(*pts((x, -0.5), (x, -0.28))), color=INK, linewidth=2.0, zorder=3)
    elif kind == "phone":
        ax.add_patch(FancyBboxPatch(P(-0.3, -0.6), 0.6 * s, 1.2 * s, boxstyle=f"round,pad=0,rounding_size={0.08 * s}",
                                    facecolor="#333333", edgecolor=INK, linewidth=1.4, zorder=3))
        _rect(ax, *P(-0.23, -0.35), 0.46 * s, 0.82 * s, "#aed6f1", lw=1.0, z=3.1)
        ax.add_patch(Circle(P(0.0, -0.48), 0.06 * s, facecolor="#bdbdbd", edgecolor=INK, linewidth=0.8, zorder=3.1))
    elif kind == "radio":
        ax.plot(*zip(*pts((0.45, 0.35), (0.85, 0.62))), color=INK, linewidth=2.0, zorder=2)
        ax.add_patch(FancyBboxPatch(P(-0.85, -0.45), 1.7 * s, 0.8 * s, boxstyle=f"round,pad=0,rounding_size={0.1 * s}",
                                    facecolor="#a04000", edgecolor=INK, linewidth=1.4, zorder=3))
        for r in (0.3, 0.2, 0.1):
            ax.add_patch(Circle(P(-0.4, -0.05), r * s, facecolor="#555555" if r == 0.3 else "#777777", edgecolor=INK,
                                linewidth=1.0, zorder=3.1))
        _rect(ax, *P(0.1, 0.0), 0.6 * s, 0.2 * s, "#fdebd0", lw=1.0, z=3.1)
        for k in range(2):
            ax.add_patch(Circle(P(0.25 + 0.3 * k, -0.22), 0.08 * s, facecolor="#333333", edgecolor=INK, linewidth=0.8,
                                zorder=3.1))
    elif kind == "television":
        _poly(ax, pts((-0.3, -0.55), (0.3, -0.55), (0.15, -0.35), (-0.15, -0.35)), "#555555")
        _rect(ax, *P(-0.9, -0.35), 1.8 * s, 1.0 * s, "#333333")
        _rect(ax, *P(-0.8, -0.27), 1.6 * s, 0.84 * s, "#85c1e9", lw=1.0, z=3.1)
        ax.add_patch(Circle(P(-0.35, 0.3), 0.14 * s, facecolor="#f7dc6f", edgecolor="none", zorder=3.2))
        _poly(ax, pts((-0.8, -0.27), (-0.3, 0.05), (0.1, -0.15), (0.45, 0.15), (0.8, -0.05), (0.8, -0.27)), "#52be80",
              lw=0, z=3.2)
    elif kind == "newspaper":
        _rect(ax, *P(-0.75, -0.55), 1.5 * s, 1.1 * s, "#fbfcfc")
        _rect(ax, *P(-0.65, 0.3), 1.3 * s, 0.15 * s, "#333333", lw=0, z=3.1)
        _rect(ax, *P(-0.65, -0.05), 0.55 * s, 0.28 * s, "#aab7b8", lw=0.8, z=3.1)
        for k in range(5):
            y = 0.18 - 0.15 * k
            if y > -0.05:
                ax.plot(*zip(*pts((0.05, y), (0.65, y))), color="#7f8c8d", linewidth=2.0, zorder=3.2)
            else:
                ax.plot(*zip(*pts((-0.65, y), (-0.1, y))), color="#7f8c8d", linewidth=2.0, zorder=3.2)
                ax.plot(*zip(*pts((0.05, y), (0.65, y))), color="#7f8c8d", linewidth=2.0, zorder=3.2)
    elif kind == "computer":
        _rect(ax, *P(-0.75, -0.05), 1.3 * s, 0.75 * s, "#333333")
        _rect(ax, *P(-0.68, 0.02), 1.16 * s, 0.6 * s, "#85c1e9", lw=1.0, z=3.1)
        _rect(ax, *P(-0.18, -0.2), 0.16 * s, 0.15 * s, "#555555", lw=1.0)
        _poly(ax, pts((-0.95, -0.6), (0.35, -0.6), (0.25, -0.35), (-0.85, -0.35)), "#d5d8dc")
        for k in range(5):
            ax.plot(*zip(*pts((-0.82 + 0.22 * k, -0.48), (-0.7 + 0.22 * k, -0.48))), color="#7f8c8d", linewidth=2.0,
                    zorder=3.2)
        ax.add_patch(Ellipse(P(0.65, -0.48), 0.22 * s, 0.3 * s, facecolor="#d5d8dc", edgecolor=INK, linewidth=1.2,
                             zorder=3))
    else:
        raise ValueError(kind)


# --- drawing ------------------------------------------------------------------------------------------------

BOX_W, BOX_H, GAP = 3.0, 2.8, 0.3
RING = 0.25


def _draw_pictures(p: dict):
    fig, ax = new_figure(9.6, 6.6)
    for i, item in enumerate(p["items"]):
        col, row = i % 3, i // 3
        x0, y0 = col * (BOX_W + GAP), (1 - row) * (BOX_H + GAP)
        ax.add_patch(FancyBboxPatch((x0, y0), BOX_W, BOX_H, boxstyle="round,pad=0,rounding_size=0.12",
                                    facecolor="#fbfbf6", edgecolor=INK, linewidth=1.4, zorder=1))
        ax.add_patch(Rectangle((x0, y0), BOX_W, BOX_H, facecolor="none", edgecolor="none", gid=f"box:{i}"))
        picture(ax, item, x0 + BOX_W / 2, y0 + 1.52, 0.95)
        ax.text(x0 + BOX_W / 2, y0 + 0.36, item, ha="center", va="center", fontsize=14, gid=f"name:{i}")
        ax.add_patch(Circle((x0 + 0.38, y0 + BOX_H - 0.36), RING, facecolor="white", edgecolor=INK, linewidth=1.6,
                            zorder=6, gid=f"ring:{i}"))
        ax.text(x0 + 0.38, y0 + BOX_H - 0.36, "ABCDEF"[i], ha="center", va="center", fontsize=15, fontweight="bold",
                zorder=7, gid=f"letter:{i}")
    width = 3 * BOX_W + 2 * GAP
    ax.set_xlim(-0.05, width + 0.05)
    ax.set_ylim(-0.05, 2 * BOX_H + GAP + 0.05)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def fr(n: int) -> str:
    return f"{n:,}".replace(",", " ")


def _draw_journey(p: dict):
    fig, ax = new_figure(9.0, 5.6)
    cols = [("Way to travel", 4.2), ("Time", 2.6), ("Fare", 2.6)]
    head_h, row_h = 0.8, 1.05
    width = sum(w for _, w in cols)
    n = len(p["rows"])
    top = head_h + n * row_h
    ax.add_patch(Rectangle((0, top - head_h), width, head_h, facecolor="#dbe9f6", edgecolor="none", zorder=0))
    x = 0.0
    for name, w in cols:
        ax.text(x + w / 2, top - head_h / 2, name, ha="center", va="center", fontsize=14, fontweight="bold")
        x += w
    for k, (way, minutes, fare) in enumerate(p["rows"]):
        y = top - head_h - (k + 0.5) * row_h
        picture(ax, way, 0.85, y, 0.36)
        ax.text(1.65, y, way, ha="left", va="center", fontsize=14, gid=f"way:{k}")
        ax.text(cols[0][1] + cols[1][1] / 2, y, f"{minutes} minutes", ha="center", va="center", fontsize=14)
        ax.text(cols[0][1] + cols[1][1] + cols[2][1] / 2, y, f"{fr(fare)} Frw", ha="center", va="center", fontsize=14)
    for k in range(n + 2):
        yy = top - (head_h + (k - 1) * row_h if k else 0)
        ax.plot([0, width], [yy, yy], color=INK, linewidth=1.6 if k in (0, 1, n + 1) else 0.9)
    x = 0.0
    for _, w in [("", 0.0)] + cols:
        x += w
        ax.plot([x, x], [0, top], color=INK, linewidth=1.4)
    a, b = p["trip"]
    ax.text(width / 2, top + 0.45, f"Ways to travel from {a} to {b}", ha="center", va="center", fontsize=15,
            fontweight="bold")
    ax.set_xlim(-0.05, width + 0.05)
    ax.set_ylim(-0.05, top + 0.85)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def draw(p: dict):
    return _draw_journey(p) if p["sub"] == "journey" else _draw_pictures(p)


# --- questions --------------------------------------------------------------------------------------------

VERBS = ["looks at", "studies", "talks about", "is sorting"]
SETTINGS = ["in a Social Studies lesson", "at school", "for homework", "in class", "with a friend", "at home"]
TABLE_VERBS = ["reads", "studies", "looks at", "uses"]


def _letters(stem: str, key: str, others: list, rng: random.Random) -> Question:
    options = sorted([key] + rng.sample(others, 3))
    return Question("mcq", stem, str(options.index(key)), options)


def _minutes(n: int) -> list[str]:
    return [f"{n} minutes", f"{n} min", f"{n}min", f"{n} mins"]


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    if p["sub"] == "journey":
        lead = f"{who} {rng.choice(TABLE_VERBS)} this table {rng.choice(SETTINGS)}."
        rows = p["rows"]
        ways = [r[0] for r in rows]
        time = {r[0]: r[1] for r in rows}
        fare = {r[0]: r[2] for r in rows}
        fastest = min(ways, key=time.get)
        cheapest = min(ways, key=fare.get)
        a, b = p["ask"]["dear"]
        out = [mcq(f"{lead} Which way of travelling is the fastest?", fastest, sorted(ways, key=time.get), rng),
               mcq("Which way of travelling is the cheapest?", cheapest, sorted(ways, key=fare.get), rng),
               short(f"How much more does the trip cost by {a} than by {b}?", fare[a] - fare[b], money(fare[a] - fare[b]))]
        if p["level"] == "upper":
            c, d = p["ask"]["slow"]
            out.append(short(f"How many minutes longer does the trip take by {c} than by {d}?", time[c] - time[d],
                             _minutes(time[c] - time[d])))
            w, n = p["ask"]["group"]
            out.append(short(f"{'Two' if n == 2 else 'Three'} friends travel together by {w}. Each one pays the fare. "
                             f"How much do they pay altogether?", n * fare[w], money(n * fare[w])))
        return out
    items = p["items"]
    kinds = [KINDS[i] for i in items]
    lead = f"{who} {rng.choice(VERBS)} the pictures {rng.choice(SETTINGS)}."
    want = p["ask_letter"]
    key = "ABCDEF"[kinds.index(want)]
    others = [L for L, k in zip("ABCDEF", kinds) if k != want]
    letter_q = _letters(f"Which letter shows {ONE_WAY[want]}?", key, others, rng)
    counts = [count(f"How many pictures show {HOW_MANY[k]}?", kinds.count(k), "pictures") for k in p["ask_count"]]
    if p["sub"] == "sort":
        letter_q.stem = f"{lead} {letter_q.stem}"
        return [letter_q] + counts
    counts[0].stem = f"{lead} {counts[0].stem}"
    return [counts[0], letter_q] + counts[1:]
