"""Magnetic force on currents (AL), for AS "Magnetic fields and electromagnetism". Two kinds:

- angle: a uniform magnetic field to the right across a square region, a straight wire crossing it at 30°, 90° or 150°
  to the field, its current arrowed; B, I, the length in the field and F = BIL sin θ printed (sin 30° = sin 150° = 0.5).
  Asks the force, its direction (into or out of the page, by Fleming's left-hand rule, the rule's fingers printed) and
  the force with the wire turned to 90°.
- parallel: two long parallel wires P and Q, their currents arrowed (the same way or opposite), the flux density that
  P's current makes at Q printed; F = BIL printed. Asks whether they attract or repel (by the drawing), the force on a
  printed length of Q, and the force if both currents are doubled (the field at Q doubles too).
"""
from __future__ import annotations

import math
import random
from fractions import Fraction

from ..core import INK, NAMES, exact, measure, mcq, new_figure, short

ID = "magnetic_force"
KIND = "physics.field"
SUBJECT = "physics"
BANDS = ("AL",)
CONCEPTS = tuple(f"physics.{c}" for c in ("force-on-current-carrying-conductor", "magnetic-flux-density", "magnetic-fields"))
# A topic whose sections the book lists is reached only if one names magnetic force, flux density or fields.
NEEDS = r"magnetic force|flux density|magnetic field|currents crossing|forces between currents|electromagnetism"
AVOID = r"glossary|induction|charged particles|alternating|transformer|generator|electric field|gravitational"
TESLA = ["0.02", "0.04", "0.05", "0.1", "0.2", "0.25", "0.4", "0.5"]
SIN = {30: Fraction(1, 2), 90: Fraction(1), 150: Fraction(1, 2)}


def sample(rng: random.Random) -> dict:
    if rng.random() < 0.6:
        return {"band": "AL", "kind": "angle", "theta": rng.choice([30, 90, 150]), "tesla": rng.choice(TESLA),
                "amps": rng.choice(["1.5", "2.0", "2.5", "3.0", "4.0", "5.0"]), "cm": rng.choice([5, 10, 20, 25, 40, 50]),
                "up": rng.choice([True, False])}
    return {"band": "AL", "kind": "parallel", "same": rng.choice([True, False]), "micro": rng.choice([10, 20, 40, 50, 80]),
            "amps": rng.choice([2, 4, 5, 8, 10]), "cm": rng.choice([20, 50, 100])}


def force(p: dict) -> Fraction:
    return Fraction(p["tesla"]) * Fraction(p["amps"]) * Fraction(p["cm"], 100) * SIN[p["theta"]]


def angle_direction(p: dict) -> str:
    """F along I L x B, with B to the right: a current with an upward part feels a force into the page. At 30°, 90° and
    150° the wire rises to the left or right, so the current runs up it exactly when p["up"]."""
    return "into the page" if p["up"] else "out of the page"


def _draw_angle(p: dict):
    fig, ax = new_figure(6.0, 5.6)
    for y in (-2.4, -1.2, 0.0, 1.2, 2.4):
        ax.annotate("", xy=(3.0, y), xytext=(-3.0, y), arrowprops=dict(arrowstyle="-|>", color="#777777", lw=1.0))
    ax.text(3.15, 2.4, "B", ha="left", va="center", fontsize=13, fontweight="bold", color="#555555")
    th = math.radians(p["theta"])
    ux, uy = math.cos(th), math.sin(th)
    ax.plot([-2.9 * ux, 2.9 * ux], [-2.9 * uy, 2.9 * uy], color=INK, linewidth=3.0, gid="wire")
    s = 1 if p["up"] else -1  # the current runs up the wire, or down it
    ax.annotate("", xy=(s * 1.5 * ux, s * 1.5 * uy), xytext=(s * 0.5 * ux, s * 0.5 * uy),
                arrowprops=dict(arrowstyle="-|>", color=INK, lw=2.2, mutation_scale=22))
    # the current's label 0.55 from the wire, on the side away from the angle's arc
    nx, ny = uy, -ux
    ax.text(s * 1.0 * ux + 0.55 * nx, s * 1.0 * uy + 0.55 * ny, "I", ha="center", va="center", fontsize=13,
            fontweight="bold", gid="current")
    # the angle between the wire and the field, from the field's direction to the wire
    arc = [(0.9 * math.cos(math.radians(a)), 0.9 * math.sin(math.radians(a))) for a in range(0, p["theta"] + 1, 3)]
    ax.plot([x for x, _ in arc], [y for _, y in arc], color=INK, linewidth=1.0, gid="arc")
    # the angle's label beside its arc, in a gap between field lines
    ax.text(*{30: (1.55, 0.5), 90: (1.25, 0.62), 150: (0.55, 1.62)}[p["theta"]], f"{p['theta']}°", ha="center", va="center",
            fontsize=11, gid="angle")
    ax.text(-3.3, -3.4, f"B = {p['tesla']} T     I = {p['amps']} A     length of wire in the field = {p['cm']} cm",
            ha="left", va="center", fontsize=10.5)
    ax.text(-3.3, -3.95, "F = BIL sin θ, θ = angle between wire and field;  sin 30° = sin 150° = 0.5", ha="left",
            va="center", fontsize=10)
    ax.text(-3.3, 3.45, "The magnetic field is in the plane of the page", ha="left", va="center", fontsize=10)
    ax.set_xlim(-3.4, 3.6)
    ax.set_ylim(-4.25, 3.75)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def _draw_parallel(p: dict):
    fig, ax = new_figure(5.6, 5.0)
    for x, name, up in ((-1.4, "P", True), (1.4, "Q", p["same"])):
        ax.plot([x, x], [-2.6, 2.6], color=INK, linewidth=3.0, gid=f"wire:{name}")
        y0, y1 = (-0.5, 0.7) if up else (0.7, -0.5)
        ax.annotate("", xy=(x, y1), xytext=(x, y0), arrowprops=dict(arrowstyle="-|>", color=INK, lw=2.2, mutation_scale=22))
        ax.text(x, 2.95, f"wire {name}", ha="center", va="center", fontsize=12, fontweight="bold")
        ax.text(x + (-0.35 if name == "P" else 0.35), 0.1, f"{p['amps']} A", ha="right" if name == "P" else "left",
                va="center", fontsize=11)
    ax.text(-2.6, -3.15, f"flux density at wire Q due to the current in P = {p['micro']} μT", ha="left", va="center",
            fontsize=10.5)
    ax.text(-2.6, -3.65, "F = BIL  (1 μT = 10⁻⁶ T)", ha="left", va="center", fontsize=10.5)
    ax.set_xlim(-2.8, 2.8)
    ax.set_ylim(-3.95, 3.3)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def draw(p: dict):
    return _draw_angle(p) if p["kind"] == "angle" else _draw_parallel(p)


SETTINGS = ["in an AS physics lesson", "while revising for an examination", "for homework", "at the physics club in Huye",
            "in a lesson in Kigali", "on a revision card"]
VERBS = ["drew", "sketched", "was given", "studied", "set up"]
FLEMING = "(Fleming's left-hand rule: first finger along the field, second finger along the current, thumb gives the force.)"
WAYS = ["into the page", "out of the page", "along the field", "against the field"]


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    setting = rng.choice(SETTINGS)
    if p["kind"] == "angle":
        F = force(p)
        key = angle_direction(p)
        at90 = Fraction(p["tesla"]) * Fraction(p["amps"]) * Fraction(p["cm"], 100)
        qs = [short(f"{who} {rng.choice(VERBS)} this wire at {p['theta']}° to a magnetic field {setting}. What is the size of the "
                    "force on the wire, in N?",
                    exact(F), measure(F, "N")),
              mcq(f"{FLEMING} In which direction is the force on the wire?", key, WAYS, rng)]
        if p["theta"] != 90:
            qs.append(short("The wire is turned until it is at 90° to the field, with the same current and length in the "
                            "field. What is the force on it now, in N?", exact(at90), measure(at90, "N")))
        else:
            qs.append(short("The current is halved. What is the force on the wire now, in N?", exact(at90 / 2),
                            measure(at90 / 2, "N")))
        return qs
    F = Fraction(p["micro"]) * p["amps"] * Fraction(p["cm"], 100)  # in μN, B in μT
    key = "they attract" if p["same"] else "they repel"
    micro = lambda v: [exact(v), f"{exact(v)} μN", f"{exact(v)}μN", f"{exact(v)} micronewtons", f"{exact(v)} uN"]  # noqa: E731
    return [mcq(f"{who} {rng.choice(VERBS)} these two long parallel wires, each carrying {p['amps']} A, {setting}. Do the "
                "wires attract or repel each other?", key,
                ["they attract", "they repel", "there is no force between them"], rng),
            short(f"What is the force on {p['cm']} cm of wire Q, in μN?", exact(F), micro(F)),
            short("Both currents are doubled. What is the force on the same length of wire Q now, in μN?", exact(4 * F),
                  micro(4 * F))]
