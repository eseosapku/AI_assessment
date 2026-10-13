"""The motor effect and induction (UP): a wire between the N and S poles of a magnet. As a motor, it
carries a current, shown by an arrow along it or, seen end-on, by ⊙ (out of the page) or ⊗ (into
it). As a generator, the wire is seen end-on and moved across the field. The direction of the force
or of the induced current, what makes it bigger, the rule that gives it, and its size (F = BIL, or
emf = BLv).

The directions are cross products: the force on the wire is along I L × B, and the induced current
along v × B, with the field from N to S.
"""
from __future__ import annotations

import random
from fractions import Fraction

from matplotlib.patches import Circle, Rectangle

from ..core import FILL_2, INK, NAMES, exact, mcq, measure, new_figure, short

ID = "motor_rule"
KIND = "physics.field"
SUBJECT = "physics"
BANDS = ("UP",)
CONCEPTS = tuple(f"physics.{c}" for c in ("force-on-current-carrying-conductor", "magnetic-fields", "electric-motors",
                                          "electromagnetic-induction", "generators"))
# Not electric or gravitational fields, nor the Earth's magnetism alone.
AVOID = r"electric field|gravitational|electrostatic|static electricity|coulomb"
VEC = {"right": (1, 0, 0), "left": (-1, 0, 0), "up": (0, 1, 0), "down": (0, -1, 0), "out of the page": (0, 0, 1), "into the page": (0, 0, -1)}
ACROSS = {"right": ("up", "down"), "left": ("up", "down"), "up": ("right", "left"), "down": ("right", "left")}  # in the page, across the field
TESLA = ["0.05", "0.1", "0.2", "0.25", "0.4", "0.5"]


def _cross(a, b):
    return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])


def _named(v) -> str:
    return next(k for k, u in VEC.items() if u == tuple(v))


def direction(p: dict) -> str:
    along = p["current"] if p["mode"] == "motor" else p["motion"]
    return _named(_cross(VEC[along], VEC[p["field"]]))


def sample(rng: random.Random) -> dict:
    field = rng.choice(list(ACROSS))
    p = {"band": "UP", "mode": rng.choice(["motor", "motor", "generator"]), "field": field, "tesla": rng.choice(TESLA),
         "cm": rng.choice([4, 5, 8, 10, 20])}
    if p["mode"] == "motor":
        p["view"] = rng.choice(["page", "end"])
        p["current"] = rng.choice(ACROSS[field] if p["view"] == "page" else ("out of the page", "into the page"))
        p["amps"] = rng.choice([1, 2, 3, 4, 5, 6])
    else:
        p["view"] = "end"
        p["motion"] = rng.choice(ACROSS[field])
        p["speed"] = rng.choice([1, 2, 3, 4, 5])
    return p


def _arrow(ax, tail, head):
    ax.annotate("", xy=head, xytext=tail, arrowprops=dict(arrowstyle="-|>", color=INK, lw=1.8, mutation_scale=20, shrinkA=0, shrinkB=0))


def draw(p: dict):
    fig, ax = new_figure(5.6, 5.4)
    sideways = p["field"] in ("right", "left")  # poles left and right, else above and below
    north_first = p["field"] in ("right", "down")  # N on the left, or on top
    for sign in (-1, 1):
        if sideways:
            box, centre = Rectangle((1.6 if sign > 0 else -4.2, -2.0), 2.6, 4.0), (sign * 2.9, 0)
        else:
            box, centre = Rectangle((-2.0, 1.6 if sign > 0 else -4.2), 4.0, 2.6), (0, sign * 2.9)
        north = (sign < 0) == north_first if sideways else (sign > 0) == north_first
        box.set(facecolor=FILL_2 if north else "white", edgecolor=INK, linewidth=1.6)
        ax.add_patch(box)
        ax.text(*centre, "N" if north else "S", ha="center", va="center", fontsize=22, fontweight="bold")
    if p["view"] == "page":
        # The wire runs across the gap, across the field, with the current's arrow on it.
        u = VEC[p["current"]][:2]
        ends = [(-3.4 * u[0], -3.4 * u[1]), (3.4 * u[0], 3.4 * u[1])]
        ax.plot([ends[0][0], ends[1][0]], [ends[0][1], ends[1][1]], color=INK, linewidth=2.2)
        _arrow(ax, (-0.4 * u[0], -0.4 * u[1]), (0.6 * u[0], 0.6 * u[1]))
        at = (0.25, 2.8) if sideways else (2.7, 0.25)
        ax.text(*at, f"I = {p['amps']} A", ha="left" if sideways else "center", va="center" if sideways else "bottom", fontsize=12)
    else:
        ax.add_patch(Circle((0, 0), 0.36, facecolor="white", edgecolor=INK, linewidth=1.8, zorder=3))
        if p["mode"] == "motor":
            if p["current"] == "out of the page":
                ax.plot([0], [0], marker="o", markersize=5, color=INK, zorder=4)
            else:
                ax.plot([-0.22, 0.22], [-0.22, 0.22], color=INK, linewidth=1.8, zorder=4)
                ax.plot([-0.22, 0.22], [0.22, -0.22], color=INK, linewidth=1.8, zorder=4)
            ax.text(0, -0.6, f"I = {p['amps']} A", ha="center", va="top", fontsize=12)
        else:
            u = VEC[p["motion"]][:2]
            _arrow(ax, (0.45 * u[0], 0.45 * u[1]), (1.4 * u[0], 1.4 * u[1]))
            # The speed beyond the arrow's tip; the word "wire" on the other side of it.
            if sideways:
                ax.text(0, 1.55 * u[1], f"v = {p['speed']} m/s", ha="center", va="bottom" if u[1] > 0 else "top", fontsize=11)
                ax.text(0, -0.55 * u[1], "wire", ha="center", va="top" if u[1] > 0 else "bottom", fontsize=10)
            else:
                ax.text(1.55 * u[0], 0, f"v = {p['speed']} m/s", ha="left" if u[0] > 0 else "right", va="center", fontsize=11)
                ax.text(0, -0.55, "wire", ha="center", va="top", fontsize=10)
    ax.text(-4.4, -4.6, f"B = {p['tesla']} T", ha="left", va="top", fontsize=12)
    ax.set_xlim(-4.6, 4.6)
    ax.set_ylim(-5.3, 4.6)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def _options(key: str, rng: random.Random) -> list[str]:
    """The key and its opposite, and both ways along one other axis."""
    axis = tuple(map(abs, VEC[key]))
    other = rng.choice([a for a in ((1, 0, 0), (0, 1, 0), (0, 0, 1)) if a != axis])
    return [_named(tuple(-c for c in VEC[key])), _named(other), _named(tuple(-c for c in other))]


SETTINGS = ["in the school laboratory", "at the science club", "for a class practical", "during a physics lesson", "for a science fair"]


def questions(p: dict, rng: random.Random) -> list:
    name, friend = rng.sample(NAMES, 2)
    key = direction(p)
    metres = Fraction(p["cm"], 100)
    setting = rng.choice(SETTINGS + [f"to show how {'a motor' if p['mode'] == 'motor' else 'a generator'} works"])
    if p["mode"] == "motor":
        first = mcq(f"{name} set up this wire and magnet {setting}. In which direction is the force on the wire?", key,
                    _options(key, rng), rng)
        thing = "the force on the wire"
        size = Fraction(p["tesla"]) * p["amps"] * metres
        amount = short(f"{friend} measures {p['cm']} cm of the wire inside the field. What is the size of the force on the wire?",
                       exact(size), measure(size, "N"))
    else:
        first = mcq(f"{name} moves the wire across the magnet's field {setting}. In which direction is the current induced in the "
                    "wire?", key, _options(key, rng), rng)
        thing = "the induced current"
        size = Fraction(p["tesla"]) * metres * p["speed"]
        amount = short(f"{friend} measures {p['cm']} cm of the wire inside the field. What emf is induced across the wire?",
                       exact(size), measure(size, "V"))
    if rng.random() < 0.5:
        changes = [f"a {s} magnet with its poles {w}" for s in ("stronger", "weaker") for w in ("the same way round", "swapped")]
    elif p["mode"] == "motor":
        changes = [f"a {s} current {w}" for s in ("larger", "smaller") for w in ("in the same direction", "in the opposite direction")]
    else:
        changes = [f"moving the wire {s} {w}" for s in ("faster", "more slowly") for w in ("in the same direction", "in the opposite direction")]
    bigger = mcq(f"Which change makes {thing} bigger without changing its direction?", changes[0], changes[1:], rng)
    rules = [f"{w} {h} rule" for w in ("Fleming's", "the") for h in ("left-hand", "right-hand")]
    rules = [r.replace("the left-hand rule", "the left-hand grip rule").replace("the right-hand rule", "the right-hand grip rule") for r in rules]
    rule_key = "Fleming's left-hand rule" if p["mode"] == "motor" else "Fleming's right-hand rule"
    rule = mcq(f"Which rule gives the direction of {thing}?", rule_key, [r for r in rules if r != rule_key], rng)
    return [first, bigger, rule, amount]
