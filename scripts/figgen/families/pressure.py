"""Pressure (LS, UP): a U-tube manometer of water joined to a gas supply, its levels on a centimetre
scale; or a block resting on one face, its sides and weight labelled. The height difference and the
pressure difference ρgh (g and the density of water stated), which side is at the higher pressure; the
pressure on the face (F/A) and which face would give the most.

Every level is on a centimetre mark; every pressure is a whole number of pascals.
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
# Not measurement alone, plant growth, farming or natural disasters.
AVOID = r"earthquake|measurement|plant growth|agriculture|environmental"


def sample(rng: random.Random) -> dict:
    band = rng.choice(BANDS)
    if rng.random() < 0.5:
        while True:
            mid = rng.randint(8, 14)
            d = rng.randint(1, 6)
            left, right = (mid - d, mid + d) if rng.random() < 0.7 else (mid + d, mid - d)
            return {"band": band, "kind": "manometer", "left": left, "right": right}
    while True:
        a, b, c = sorted(rng.sample([5, 10, 20, 25, 40, 50], 3), reverse=True)
        faces = [(a, b), (a, c), (b, c)]
        face = list(rng.choice(faces))
        weight = rng.choice([20, 40, 50, 60, 80, 100, 120, 200])
        if (weight * 10000) % (face[0] * face[1]) == 0:
            return {"band": band, "kind": "block", "dims": [a, b, c], "face": face, "weight": weight}


def draw(p: dict):
    if p["kind"] == "manometer":
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
        ax.plot([1.0, 0.0], [22, 23.2], color=INK, linewidth=1.6)  # the pipe to the gas supply
        ax.text(0.0, 23.6, "to gas supply", ha="left", va="bottom", fontsize=10)
        ax.text(6.0, 22.6, "open to the air", ha="center", va="bottom", fontsize=10)
        # The centimetre scale between the arms.
        for y in range(bottom + 1, 22):  # the scale starts above the bend, clear of its line
            ax.plot([3.6, 3.6 + (0.5 if y % 5 == 0 else 0.25)], [y, y], color=INK, linewidth=0.8)
            if y % 5 == 0:
                ax.text(4.25, y, f"{y}", ha="left", va="center", fontsize=8)
        ax.plot([3.6, 3.6], [bottom, 21], color=INK, linewidth=0.8)
        ax.text(3.6, 21.4, "cm", ha="left", va="bottom", fontsize=8)
        ax.set_xlim(-0.5, 8.0)
        ax.set_ylim(bottom - 1.5, 25)
        ax.set_aspect("equal")
        ax.axis("off")
        return fig
    a, b, c = p["dims"]
    w, h = p["face"]
    third = [d for d in (a, b, c) if d not in (w, h)] or [c]
    depth = third[0] if len(third) == 1 else c
    fig, ax = new_figure(5.4, 4.4)
    s = 6 / max(a, b, c)
    W, H, D = w * s, depth * s, h * s * 0.5  # the face it rests on is w by h: drawn as width w, depth h
    ax.add_patch(Polygon([(0, 0), (W, 0), (W, H), (0, H)], closed=True, facecolor=FILL_2, edgecolor=INK, linewidth=1.6))
    ax.add_patch(Polygon([(0, H), (W, H), (W + D, H + D), (D, H + D)], closed=True, facecolor="white", edgecolor=INK, linewidth=1.6))
    ax.add_patch(Polygon([(W, 0), (W + D, D), (W + D, H + D), (W, H)], closed=True, facecolor=FILL, edgecolor=INK, linewidth=1.6))
    ax.plot([-1, W + D + 1.5], [0, 0], color=INK, linewidth=1.2)
    ax.text(W / 2, -0.45, f"{w} cm", ha="center", va="top", fontsize=11)
    ax.text(W + D / 2 + 0.25, D / 2 - 0.15, f"{h} cm", ha="left", va="top", fontsize=11)
    ax.text(-0.25, H / 2, f"{depth} cm", ha="right", va="center", fontsize=11)
    ax.text(W / 2, H / 2, f"weight\n{p['weight']} N", ha="center", va="center", fontsize=11, fontweight="bold")
    ax.set_xlim(-2.6, W + D + 1.6)
    ax.set_ylim(-1.4, H + D + 0.6)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def questions(p: dict, rng: random.Random) -> list:
    name = rng.choice(NAMES)
    if p["kind"] == "manometer":
        h = abs(p["left"] - p["right"])
        pa = 100 * h  # ρgh = 1000 × 10 × h/100
        return [
            short(f"{name} joined a water manometer to {rng.choice(['the laboratory gas supply', 'a biogas digester', 'a cylinder of cooking gas'])}. "
                  "What is the difference in height of the water levels, in cm?", h,
                  measure(h, "cm")),
            short("Take g = 10 N/kg and the density of water as 1000 kg/m³. What is the difference in pressure, in pascals?", pa,
                  measure(pa, "Pa")),
            mcq("Which is at the higher pressure?", "the gas supply" if p["left"] < p["right"] else "the open air",
                ["the open air" if p["left"] < p["right"] else "the gas supply", "both are at the same pressure",
                 "it cannot be told from the levels"], rng),
        ]
    a, b, c = p["dims"]
    w, h = p["face"]
    pa = p["weight"] * 10000 // (w * h)
    faces = sorted([(a, b), (a, c), (b, c)], key=lambda f: f[0] * f[1])
    label = lambda f: f"the {max(f)} cm by {min(f)} cm face"  # noqa: E731
    return [
        short(f"{name}'s block rests on its {max(w, h)} cm by {min(w, h)} cm face. What pressure does it put on the ground, in pascals?",
              pa, measure(pa, "Pa")),
        mcq("On which face should the block rest to put the greatest pressure on the ground?", label(faces[0]),
            [label(faces[1]), label(faces[2]), "it is the same on every face"], rng),
    ]
