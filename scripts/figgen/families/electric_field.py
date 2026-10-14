"""Electric fields (LS, UP, AL): two parallel plates joined to a supply, their field lines drawn without
arrows, a charged drop between them; or, at UP and AL, a charge Q with its radial field lines arrowed and a
point P. The direction of the field, E = V/d, the direction and size of the force on a charge (F = qE), the
sign of Q from its field lines, and E = kQ/r² at P.

The plates' signs are drawn, not their field's direction, so the field has to be worked out; the point
charge is drawn without its sign, so its sign has to be read from the arrows.
"""
from __future__ import annotations

import math
import random
from fractions import Fraction

from matplotlib.patches import Circle, FancyArrowPatch

from ..core import FILL_2, INK, NAMES, article, exact, mcq, measure, new_figure, short

ID = "electric_field"
KIND = "physics.field"
SUBJECT = "physics"
BANDS = ("LS", "UP", "AL")
CONCEPTS = tuple(f"physics.{c}" for c in ("electric-field", "electric-field-strength", "electric-potential", "potential-difference",
                                          "electrostatics", "applications-of-electrostatics"))
# Not gravitational or magnetic fields alone, nor circuits.
AVOID = r"gravitational|magnet|circuit|resistor|kirchhoff"
DIRS = {"up": (0, 1), "down": (0, -1), "left": (-1, 0), "right": (1, 0)}
WAYS = {"up": "up the page", "down": "down the page", "left": "left across the page", "right": "right across the page"}
THINGS = ["charged oil drop", "charged dust grain", "charged pollen grain", "charged plastic bead"]
SETTINGS = ["in the school laboratory", "at the science club", "for a class practical", "during a physics lesson", "for a science fair"]


def sample(rng: random.Random) -> dict:
    band = rng.choice(BANDS)
    if band == "LS" or rng.random() < 0.55:
        return {"band": band, "kind": "plates", "volts": rng.choice([100, 200, 500, 1000, 2000, 5000]), "gap_cm": rng.choice([1, 2, 4, 5, 10]),
                "top": rng.choice("+-"), "charge": rng.choice("+-")}
    return {"band": band, "kind": "point", "sign": rng.choice("+-"), "nC": rng.randint(1, 5), "r_cm": rng.choice([10, 20, 30]),
            "at": rng.choice(list(DIRS))}


def _arrowhead(ax, x, y, dx, dy):
    ax.add_patch(FancyArrowPatch((x - 0.01 * dx, y - 0.01 * dy), (x + 0.01 * dx, y + 0.01 * dy), arrowstyle="-|>", mutation_scale=16,
                                 color=INK, lw=1.2))


def _plates(p: dict):
    fig, ax = new_figure(6.2, 4.4)
    for y, sign in ((3.0, p["top"]), (0.0, "-" if p["top"] == "+" else "+")):
        ax.plot([0, 8], [y, y], color=INK, linewidth=4, solid_capstyle="butt")
        for k in range(5):
            ax.text(0.8 + 1.6 * k, y + (0.32 if y > 0 else -0.32), "+" if sign == "+" else "−", ha="center", va="center", fontsize=13,
                    fontweight="bold")
    for x in (1.2, 2.6, 5.4, 6.8):  # field lines, no arrows: the direction is to be worked out
        ax.plot([x, x], [0.08, 2.92], color=INK, linewidth=0.9)
    ax.add_patch(Circle((4.0, 1.5), 0.32, facecolor=FILL_2, edgecolor=INK, linewidth=1.3, zorder=3))
    ax.text(4.0, 1.5, "+" if p["charge"] == "+" else "−", ha="center", va="center", fontsize=13, fontweight="bold", zorder=4)
    ax.annotate("", xy=(8.7, 3.0), xytext=(8.7, 0.0), arrowprops=dict(arrowstyle="<|-|>", color=INK, lw=1.0, mutation_scale=12))
    ax.text(8.9, 1.5, f"{p['gap_cm']} cm", ha="left", va="center", fontsize=11)
    ax.text(4.0, -1.15, f"potential difference between the plates: {p['volts']} V", ha="center", va="center", fontsize=10)
    ax.set_xlim(-0.5, 10.6)
    ax.set_ylim(-1.5, 4.0)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def _point(p: dict):
    fig, ax = new_figure(5.0, 5.0)
    out = p["sign"] == "+"
    # Eight field lines, arrowed near Q; P sits on the one along its axis, its distance given in the question.
    for k in range(8):
        a = math.radians(45 * k)
        c, s = math.cos(a), math.sin(a)
        ax.plot([0.45 * c, 3.6 * c], [0.45 * s, 3.6 * s], color=INK, linewidth=1.0)
        _arrowhead(ax, 1.25 * c, 1.25 * s, c if out else -c, s if out else -s)
    ax.add_patch(Circle((0, 0), 0.32, facecolor=FILL_2, edgecolor=INK, linewidth=1.3, zorder=3))
    ax.text(0, 0, "Q", ha="center", va="center", fontsize=11, fontweight="bold", zorder=4)
    dx, dy = DIRS[p["at"]]
    R = 1.3 + 0.6 * (p["r_cm"] // 10)  # P's distance, drawn to its order
    ax.plot([R * dx], [R * dy], marker="o", markersize=7, color=INK, zorder=4)
    ax.text(R * dx + 0.42 * dy, R * dy + 0.42 * dx, "P", ha="center", va="center", fontsize=12, fontweight="bold")  # beside the line
    ax.set_xlim(-3.8, 3.8)
    ax.set_ylim(-3.8, 3.8)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def draw(p: dict):
    return _plates(p) if p["kind"] == "plates" else _point(p)


def _ways(key: str, rng: random.Random) -> list[str]:
    """The three other directions: up, down, left and right make two axes, both ways."""
    return [WAYS[d] for d in DIRS if WAYS[d] != key]


def questions(p: dict, rng: random.Random) -> list:
    name = rng.choice(NAMES)
    if p["kind"] == "plates":
        field = "down" if p["top"] == "+" else "up"
        push = field if p["charge"] == "+" else ("up" if field == "down" else "down")
        E = Fraction(p["volts"]) / (Fraction(p["gap_cm"]) / 100)
        thing = rng.choice(THINGS)
        qs = [mcq(f"{name} joined two metal plates to a {p['volts']} V supply {rng.choice(SETTINGS)}. Which way does the electric field "
                  "point between the plates?", WAYS[field], _ways(WAYS[field], rng), rng),
              short(f"The plates are {p['gap_cm']} cm apart. What is the electric field strength between them, in V/m?", exact(E),
                    measure(E, "V/m") + [f"{exact(E)} N/C"]),
              mcq(f"{article(thing).capitalize()} {thing} sits between the plates. Which way is the electric force on it?", WAYS[push],
                  _ways(WAYS[push], rng), rng)]
        if p["band"] != "LS":
            charges = [q for q in (1, 2, 3, 4, 5) if (Fraction(q, 10 ** 6) * E * 100).denominator == 1]
            if charges:
                q = rng.choice(charges)
                F = Fraction(q, 10 ** 6) * E
                qs.append(short(f"The {thing} carries a charge of {q} × 10⁻⁶ C. What is the size of the electric force on it?", exact(F),
                                measure(F, "N")))
        return qs
    keys = [f"{s}: the field lines point {d} it" for s in ("Positive", "Negative") for d in ("away from", "towards")]
    key = keys[0] if p["sign"] == "+" else keys[3]
    out = DIRS[p["at"]]
    push = p["at"] if p["sign"] == "+" else next(d for d, v in DIRS.items() if v == (-out[0], -out[1]))
    E = Fraction(9 * 10 ** 9) * p["nC"] / 10 ** 9 / (Fraction(p["r_cm"]) / 100) ** 2
    return [mcq(f"{name} drew the field around a charge Q {rng.choice(SETTINGS)}. Is Q positive or negative?", key,
                [k for k in keys if k != key], rng),
            mcq("Which way is the force on a small positive charge placed at P?", WAYS[push], _ways(WAYS[push], rng), rng),
            short(f"P is {p['r_cm']} cm from Q, and the size of Q is {p['nC']} × 10⁻⁹ C. Take k = 9 × 10⁹ N m² C⁻². "
                  "What is the electric field strength at P?",
                  exact(E), measure(E, "N/C") + [f"{exact(E)} V/m"])]
