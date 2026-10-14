"""A capacitor discharging (AL): the voltage across a capacitor against time as it discharges through a
resistor, halving in a whole number of gridlines, its capacitance labelled. The starting voltage, the
starting charge (Q = CV, in mC), the time to halve, and the energy stored at the start (½CV², in mJ).

V halves every half-time, so V₀ and V₀/2 lie on gridlines.
"""
from __future__ import annotations

import random
from fractions import Fraction

from ..core import GRID, INK, NAMES, curve, exact, measure, new_figure, short

ID = "capacitor_discharge"
KIND = "graph.line"
SUBJECT = "physics"
BANDS = ("AL",)
CONCEPTS = tuple(f"physics.{c}" for c in ("capacitors", "energy-stored-in-capacitor", "potential-difference"))
AVOID = r"radioactiv|nuclear|decay|magnet|wave|optic|kirchhoff|resistiv|practical circuits|electronics|alternating|electric current"
USES = ["for a camera flash", "in a laboratory circuit", "in a smoke alarm's backup supply", "in a timer circuit"]


def sample(rng: random.Random) -> dict:
    while True:
        p = {"band": "AL", "V0": rng.choice([6, 8, 10, 12, 16, 20, 24]), "half": rng.choice([2, 3, 4, 5, 10]),
             "C_uF": rng.choice([100, 220, 470, 1000, 2200])}
        if all((x * 100).denominator == 1 for x in (Fraction(p["C_uF"] * p["V0"], 1000), Fraction(p["C_uF"] * p["V0"] ** 2, 2000))):
            return p


def voltage(p: dict, t: float) -> float:
    return p["V0"] * 2 ** (-t / p["half"])


def draw(p: dict):
    end = 4 * p["half"]
    xstep = 2 if p["half"] == 10 else 1
    ystep = 1 if p["V0"] <= 12 else 2
    fig, ax = new_figure(6.0, 4.4)
    ax.set_xticks(range(0, end + 1, xstep * (2 if end // xstep > 12 else 1)))
    ax.set_xticks(range(0, end + 1, xstep), minor=True)
    ax.set_yticks(range(0, p["V0"] + ystep + 1, ystep * (2 if p["V0"] // ystep > 10 else 1)))
    ax.set_yticks(range(0, p["V0"] + ystep + 1, ystep), minor=True)
    ax.grid(True, which="both", color=GRID, linewidth=0.5)
    ax.set_axisbelow(True)
    ax.set_xlim(0, end)
    ax.set_ylim(0, p["V0"] + ystep)
    curve(ax, lambda t: voltage(p, t), 0, end, 0, p["V0"] + ystep)
    ax.text(0.97 * end, p["V0"] * 0.95, f"C = {p['C_uF']} μF", ha="right", va="top", fontsize=11)
    ax.set_xlabel("Time (s)")
    ax.set_ylabel("Voltage across the capacitor (V)")
    ax.tick_params(labelsize=9)
    return fig


def questions(p: dict, rng: random.Random) -> list:
    name, friend = rng.sample(NAMES, 2)
    V0, C = p["V0"], p["C_uF"]
    Q = Fraction(C * V0, 1000)
    E = Fraction(C * V0 * V0, 2000)
    return [short(f"{name} let a {C} μF capacitor {rng.choice(USES)} discharge through a resistor. What was the voltage across it at the start?",
                  V0, measure(V0, "V")),
            short(f"What was the charge on the {C} μF capacitor at the start, in mC?", exact(Q), [f"{exact(Q)} mC", f"{exact(Q)}mC"]),
            short(f"{friend} wants to know how long the voltage takes to fall to half its starting value. How long does it take?", p["half"],
                  measure(p["half"], "s")),
            short(f"How much energy did the capacitor store at the start, in mJ?", exact(E), [f"{exact(E)} mJ", f"{exact(E)}mJ"])]
