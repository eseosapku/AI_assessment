"""Pressure (LS, UP): a U-tube manometer of water, one arm piped to a gas supply or to a flask a pump is
emptying, the other open to the air, its levels on a centimetre scale; or a block resting on one face,
its sides labelled and its three visible faces lettered P, Q and R. The height difference and the
pressure difference ρgh (g and the density of water stated), which side is at the higher pressure;
the pressure on the face (F/A), and which face would give the greatest or the least.

Every level is on a centimetre mark; every pressure is a whole number of pascals. The story fits the
levels: a supply pushes harder than the air, a flask being pumped out less hard.
"""
from __future__ import annotations

import random

from matplotlib.patches import Polygon, Rectangle

from ..core import FILL, FILL_2, INK, NAMES, mcq, measure, new_figure, short

ID = "pressure"
KIND = "physics.force"
SUBJECT = "physics"
BANDS = ("LS", "UP")
CONCEPTS = tuple(f"physics.{c}" for c in ("pressure", "atmospheric-pressure", "manometer-pressure-measurement"))
# Integrated Science teaches this too (P3n): its Lower Secondary topics are reached by these.
ALSO = tuple(f"science.{c}" for c in ('pressure',))
# Not measurement alone, plant growth, farming or natural disasters.
AVOID = r"earthquake|measurement|plant growth|agriculture|environmental|glossary|thinking and working scientifically|science in context|scientific method|science skills"
SUPPLIES = ["the laboratory gas supply", "a biogas digester", "the gas tap on the bench"]
PUMPED = ["a flask that a vacuum pump is emptying", "a flask from which a pump is drawing the air", "a flask a hand pump is emptying"]
FACES = ["face P", "face Q", "face R"]


def sample(rng: random.Random) -> dict:
    band = rng.choice(BANDS)
    if rng.random() < 0.5:
        mid, d = rng.randint(8, 14), rng.randint(1, 6)
        left, right = (mid - d, mid + d) if rng.random() < 0.5 else (mid + d, mid - d)
        return {"band": band, "kind": "manometer", "left": left, "right": right}
    while True:
        a, b, c = sorted(rng.sample([5, 10, 20, 25, 40, 50], 3), reverse=True)
        face = list(rng.choice([(a, b), (a, c), (b, c)]))
        weight = rng.choice([20, 40, 50, 60, 80, 100, 120, 200])
        if (weight * 10000) % (face[0] * face[1]) == 0:
            return {"band": band, "kind": "block", "dims": [a, b, c], "face": face, "weight": weight}


def _manometer(p: dict):
    fig, ax = new_figure(4.8, 5.0)
    L, R = p["left"], p["right"]
    bottom = min(L, R) - 3
    for x in (2, 6):  # the two arms
        ax.plot([x - 0.5, x - 0.5], [bottom, 22], color=INK, linewidth=1.6)
        ax.plot([x + 0.5, x + 0.5], [bottom, 22], color=INK, linewidth=1.6)
    ax.plot([1.5, 6.5], [bottom - 1, bottom - 1], color=INK, linewidth=1.6)
    ax.plot([2.5, 5.5], [bottom, bottom], color=INK, linewidth=1.6)
    ax.plot([1.5, 1.5], [bottom - 1, bottom], color=INK, linewidth=1.6)
    ax.plot([6.5, 6.5], [bottom - 1, bottom], color=INK, linewidth=1.6)
    ax.add_patch(Rectangle((1.5, bottom - 1), 5, 1, facecolor=FILL, edgecolor="none"))
    ax.add_patch(Rectangle((1.5, bottom), 1, L - bottom, facecolor=FILL, edgecolor="none"))
    ax.add_patch(Rectangle((5.5, bottom), 1, R - bottom, facecolor=FILL, edgecolor="none"))
    # The gas arm is closed to the air, and piped from its top to the gas.
    ax.plot([1.5, 2.5], [22.0, 22.0], color=INK, linewidth=1.6)
    ax.plot([2.0, 2.0, 0.3], [22.0, 23.2, 23.2], color=INK, linewidth=1.6)
    ax.text(0.3, 23.55, "to the gas supply" if L < R else "to the flask", ha="left", va="bottom", fontsize=10)
    ax.text(6.8, 21.6, "open to\nthe air", ha="left", va="center", fontsize=10, linespacing=1.0)
    # A dashed line from each water surface to the scale, so each level is read off a mark: to the scale's
    # ticks, or on the right, where a number may stand at that height, to just past it.
    ax.plot([2.5, 3.6], [L, L], color=INK, linewidth=0.9, linestyle=(0, (3, 2)))
    ax.plot([5.5, 4.15 if R % 5 else 5.0], [R, R], color=INK, linewidth=0.9, linestyle=(0, (3, 2)))
    # The centimetre scale between the arms.
    for y in range(bottom + 1, 22):  # the scale starts above the bend, clear of its line
        ax.plot([3.6, 3.6 + (0.5 if y % 5 == 0 else 0.25)], [y, y], color=INK, linewidth=0.8)
        if y % 5 == 0:
            ax.text(4.25, y, f"{y}", ha="left", va="center", fontsize=8)
    ax.plot([3.6, 3.6], [bottom, 21], color=INK, linewidth=0.8)
    ax.text(3.6, 21.4, "cm", ha="left", va="bottom", fontsize=8)
    ax.set_xlim(-0.5, 9.8)
    ax.set_ylim(bottom - 1.5, 25)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def _letter(ax, cx, cy, size, letter, away):
    """A face's letter at its middle, or, on a face too thin to hold it, beside it on a short leader."""
    if size >= 0.75:
        ax.text(cx, cy, letter, ha="center", va="center", fontsize=12, fontweight="bold")
        return
    (dx, dy), ha, va = away
    ax.plot([cx, cx + 0.6 * dx], [cy, cy + 0.6 * dy], color=INK, linewidth=0.8)
    ax.text(cx + 0.75 * dx, cy + 0.75 * dy, letter, ha=ha, va=va, fontsize=12, fontweight="bold")


def draw(p: dict):
    if p["kind"] == "manometer":
        return _manometer(p)
    a, b, c = p["dims"]
    w, h = p["face"]
    depth = next(d for d in (a, b, c) if d not in (w, h))
    fig, ax = new_figure(5.4, 4.4)
    s = 6 / max(a, b, c)
    W, H, D = w * s, depth * s, h * s * 0.5  # resting on its w by h face: the front is w by depth, the top w by h
    ax.add_patch(Polygon([(0, 0), (W, 0), (W, H), (0, H)], closed=True, facecolor=FILL_2, edgecolor=INK, linewidth=1.6))
    ax.add_patch(Polygon([(0, H), (W, H), (W + D, H + D), (D, H + D)], closed=True, facecolor="white", edgecolor=INK, linewidth=1.6))
    ax.add_patch(Polygon([(W, 0), (W + D, D), (W + D, H + D), (W, H)], closed=True, facecolor=FILL, edgecolor=INK, linewidth=1.6))
    ax.plot([-0.15, W + D + 1.0], [0, 0], color=INK, linewidth=1.2)  # the ground, clear of the side labels
    ax.text(W / 2, -0.4, f"{w} cm", ha="center", va="top", fontsize=11)
    ax.text(-0.3, H / 2, f"{depth} cm", ha="right", va="center", fontsize=11)
    ax.text(D / 2 - 0.3, H + D / 2, f"{h} cm", ha="right", va="center", fontsize=11)
    _letter(ax, W / 2, H / 2, min(W, H), "P", ((0, -1), "center", "top"))
    _letter(ax, W / 2 + D / 2, H + D / 2, min(W, D), "Q", ((0, 1), "center", "bottom"))
    _letter(ax, W + D / 2, H / 2 + D / 2, min(D, H), "R", ((1, 0), "left", "center"))
    ax.set_xlim(-2.6, W + D + 1.6)
    ax.set_ylim(-1.6, H + D + 1.2)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def questions(p: dict, rng: random.Random) -> list:
    name = rng.choice(NAMES)
    if p["kind"] == "manometer":
        h = abs(p["left"] - p["right"])
        pa = 100 * h  # ρgh = 1000 × 10 × h/100
        gas_higher = p["left"] < p["right"]  # the gas pushes its side down
        source = rng.choice(SUPPLIES if gas_higher else PUMPED)
        # Either side, by either level: the key cannot be told from the options alone.
        higher = [f"{side}: the water level on its side is {lev}" for side in ("the gas", "the open air") for lev in ("lower", "higher")]
        return [
            short(f"{name} joined a water manometer to {source}. What is the difference in height of the water levels, in cm?", h,
                  measure(h, "cm")),
            short("Take g = 10 N/kg and the density of water as 1000 kg/m³. What is the difference in pressure, in pascals?", pa,
                  measure(pa, "Pa")),
            mcq("Which is at the higher pressure, and why?", higher[0] if gas_higher else higher[2],
                [o for o in higher if o != (higher[0] if gas_higher else higher[2])], rng),
        ]
    a, b, c = p["dims"]
    w, h = p["face"]
    depth = next(d for d in (a, b, c) if d not in (w, h))
    pa = p["weight"] * 10000 // (w * h)
    areas = dict(zip(FACES, (w * depth, w * h, h * depth)))  # as drawn: P the front, Q the top, R the side
    most = rng.random() < 0.5
    key = (min if most else max)(areas, key=areas.get)
    return [
        short(f"{name}'s block weighs {p['weight']} N and rests on its {max(w, h)} cm by {min(w, h)} cm face. What pressure does it put "
              "on the ground, in pascals?", pa, measure(pa, "Pa")),
        mcq(f"On which face, P, Q or R, should the block rest to put the {'greatest' if most else 'least'} pressure on the ground?", key,
            [f for f in FACES if f != key] + ["the same on every face"], rng),
    ]
