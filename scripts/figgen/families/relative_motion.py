"""Frames of reference and Galilean velocity addition (UP), for Rwanda S5 "Relativity Concepts and Postulates of Special
Relativity" (its sections: frames of reference, the Galilean transformation). Two kinds:

- train: a train moving along a track (speed relative to the ground printed), a passenger walking along it (speed
  relative to the train, forwards or backwards) and a car on the road beside it (speed relative to the ground, either
  way). u' = u − v printed. Asks the passenger's speed relative to the ground, the car's speed relative to the train, and
  which way the passenger moves for someone standing on the ground.
- river: a boat crossing nowhere but going upstream or downstream on a river (the water's speed relative to the bank and
  the boat's speed relative to the water printed), a swimmer on the bank. Asks the boat's speed relative to the bank, the
  time to pass a printed stretch of bank, and which way the boat moves for the swimmer.

Every speed is a whole number; to the right is positive, printed.
"""
from __future__ import annotations

import random
from fractions import Fraction

from matplotlib.patches import FancyArrowPatch, Polygon, Rectangle

from ..core import INK, NAMES, exact, mcq, new_figure, short

ID = "relative_motion"
KIND = "physics.force"
SUBJECT = "physics"
BANDS = ("UP",)
CONCEPTS = ("physics.relativity",)
# A topic whose sections the book lists is reached only if one names relativity, frames of reference or Galileo.
NEEDS = r"relativ|frames? of reference|galilean"
AVOID = r"glossary|quantum|photoelectric|nuclear|radioactiv"
WAYS = ["forwards, the way the train moves", "backwards, the opposite way to the train", "it does not move"]
BOAT_WAYS = ["downstream", "upstream", "neither: it stays level with the swimmer"]


def sample(rng: random.Random) -> dict:
    if rng.random() < 0.55:
        v = rng.choice([10, 12, 15, 20, 25, 30])
        u = rng.choice([1, 2, 3])
        return {"band": "UP", "kind": "train", "v": v, "u": u, "walk": rng.choice(["forwards", "backwards"]),
                "w": rng.choice([x for x in (8, 18, 22, 28, 35) if x != v]), "car": rng.choice(["same", "opposite"]),
                "dir": rng.choice([1, -1])}
    water = rng.choice([1, 2, 3])
    boat = rng.choice([b for b in (2, 3, 4, 5, 6) if b != water])
    up = rng.choice([True, False])
    bank = abs(boat - water) if up else boat + water
    return {"band": "UP", "kind": "river", "water": water, "boat": boat, "up": up,
            "metres": bank * rng.choice([10, 15, 20, 30, 40, 60]), "dir": rng.choice([1, -1])}


def _arrow(ax, x, y, d, label, length=1.6):
    a, b = (x, x + d * length)
    ax.add_patch(FancyArrowPatch((a, y), (b, y), arrowstyle="-|>", mutation_scale=16, color=INK, linewidth=1.6))
    ax.text((a + b) / 2, y + 0.28, label, ha="center", va="bottom", fontsize=10)


def _draw_train(p: dict):
    fig, ax = new_figure(7.6, 5.0)
    d = p["dir"]
    ax.plot([0, 10], [1.0, 1.0], color=INK, linewidth=1.4, gid="track")
    ax.add_patch(Rectangle((2.2, 1.15), 5.6, 1.6, facecolor="#e7e9eb", edgecolor=INK, linewidth=1.3))
    for x in (2.9, 7.1):
        ax.add_patch(Polygon([(x - 0.25, 1.15), (x + 0.25, 1.15), (x, 0.95)], closed=True, facecolor=INK))
    ax.text(2.35, 2.5, "train", ha="left", va="center", fontsize=10)
    # the train's speed: an arrow above its roof, its label above the arrow
    _arrow(ax, 4.2 if d > 0 else 5.8, 3.05, d, f"train: {p['v']} m/s relative to the ground")
    # the passenger: a stick figure standing in the carriage, an arrow at head height, the label under the feet
    px = 5.0
    ax.plot([px, px], [1.75, 2.15], color=INK, linewidth=1.4, gid="passenger-body")
    ax.add_patch(Rectangle((px - 0.08, 2.15), 0.16, 0.16, facecolor="white", edgecolor=INK, linewidth=1.0))
    wd = d if p["walk"] == "forwards" else -d
    a, b = (px + 0.3, px + 1.3) if wd > 0 else (px - 0.3, px - 1.3)
    ax.add_patch(FancyArrowPatch((a, 2.05), (b, 2.05), arrowstyle="-|>", mutation_scale=14, color=INK, linewidth=1.5))
    ax.text(5.0, 1.42, f"passenger walks at {p['u']} m/s relative to the train", ha="center", va="center", fontsize=9.5)
    # the road below the track and the car on it
    ax.plot([0, 10], [0.55, 0.55], color="#888888", linewidth=0.8, linestyle=(0, (5, 4)), gid="road")
    ax.add_patch(Rectangle((0.4, 0.0), 1.2, 0.42, facecolor="#cdd6dd", edgecolor=INK, linewidth=1.1))
    ax.text(1.0, 0.21, "car", ha="center", va="center", fontsize=9)
    cd = d if p["car"] == "same" else -d
    a, b = (1.9, 3.5) if cd > 0 else (3.5, 1.9)
    ax.add_patch(FancyArrowPatch((a, 0.21), (b, 0.21), arrowstyle="-|>", mutation_scale=16, color=INK, linewidth=1.6))
    ax.text(3.8, 0.21, f"car: {p['w']} m/s relative to the ground", ha="left", va="center", fontsize=10)
    ax.text(0.0, 4.15, "Everything moves along one straight line.", ha="left", va="center", fontsize=9.5)
    ax.text(0.0, -0.55, "Galilean transformation: velocity seen from a moving frame  u′ = u − v", ha="left", va="center",
            fontsize=10, style="italic")
    ax.set_xlim(-0.1, 10.1)
    ax.set_ylim(-0.8, 4.4)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def _draw_river(p: dict):
    fig, ax = new_figure(7.6, 4.0)
    d = p["dir"]  # the way the water flows
    ax.add_patch(Rectangle((0, 0.6), 10, 2.0, facecolor="#dceaf5", edgecolor="none"))
    ax.plot([0, 10], [0.6, 0.6], color=INK, linewidth=1.2, gid="bank-near")
    ax.plot([0, 10], [2.6, 2.6], color=INK, linewidth=1.2, gid="bank-far")
    _arrow(ax, 6.5 if d > 0 else 8.1, 2.0, d, f"water: {p['water']} m/s relative to the bank")
    ax.add_patch(Polygon([(2.6, 1.0), (4.2, 1.0), (4.5, 1.25), (4.2, 1.5), (2.6, 1.5)] if (d > 0) != p["up"] else
                         [(4.5, 1.0), (2.9, 1.0), (2.6, 1.25), (2.9, 1.5), (4.5, 1.5)], closed=True, facecolor="#c9a46b",
                         edgecolor=INK, linewidth=1.1))
    bd = -d if p["up"] else d
    _arrow(ax, 3.55 - 0.8 * bd, 1.65, bd, f"boat: {p['boat']} m/s relative to the water", length=1.6)
    ax.plot([0.6, 0.6], [0.15, 0.55], color=INK, linewidth=1.4, gid="swimmer")
    ax.text(0.85, 0.3, "swimmer on the bank", ha="left", va="center", fontsize=9.5)
    ax.text(0.0, 3.3, f"The boat travels along the river past {p['metres']} m of bank.", ha="left", va="center", fontsize=10)
    ax.text(0.0, -0.25, "Galilean transformation: velocity relative to the bank = velocity relative to the water + "
            "velocity of the water", ha="left", va="center", fontsize=9.5, style="italic")
    ax.set_xlim(-0.1, 10.1)
    ax.set_ylim(-0.5, 3.6)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def draw(p: dict):
    return _draw_train(p) if p["kind"] == "train" else _draw_river(p)


SETTINGS = ["in a lesson on frames of reference", "for homework", "while revising in Huye", "for a class test in Kigali",
            "at the physics club in Musanze", "in a lesson on relativity"]


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    setting = rng.choice(SETTINGS)
    if p["kind"] == "train":
        v, u, w = p["v"], p["u"], p["w"]
        ground = v + u if p["walk"] == "forwards" else v - u
        car = abs(w - v) if p["car"] == "same" else w + v
        # seen from the train, the car moves the way the train goes only if it is faster in that same direction
        way = WAYS[0] if p["car"] == "same" and w > v else WAYS[1]
        return [short(f"{who} drew this train and road {setting}. How fast is the passenger moving relative to the ground, "
                      f"in m/s?", ground, [str(ground), f"{ground} m/s"]),
                short("How fast is the car moving relative to the train, in m/s?", car, [str(car), f"{car} m/s"]),
                mcq("For a passenger sitting still on the train, which way does the car appear to move?", way, WAYS, rng)]
    water, boat = p["water"], p["boat"]
    bank = boat - water if p["up"] else boat + water
    t = Fraction(p["metres"], abs(bank))
    if p["up"] and boat < water:
        way = BOAT_WAYS[0]
    else:
        way = BOAT_WAYS[1] if p["up"] else BOAT_WAYS[0]
    return [short(f"{who} watched this boat on a river {setting}. How fast is the boat moving relative to the bank, in m/s?",
                  abs(bank), [str(abs(bank)), f"{abs(bank)} m/s"]),
            short(f"How many seconds does the boat take to pass the {p['metres']} m of bank?", exact(t),
                  [exact(t), f"{exact(t)} s", f"{exact(t)} seconds"]),
            mcq("For the swimmer standing on the bank, which way does the boat move?", way, BOAT_WAYS, rng)]
