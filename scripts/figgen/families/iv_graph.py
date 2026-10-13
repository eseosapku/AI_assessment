"""Current–voltage characteristics (UP, AL): a fixed resistor (a straight line through the origin), a
filament lamp (a curve: its resistance R0 + a|V| grows as it heats) or a diode (no current until 0.6 V, none
backwards). The resistance at a marked point, which component it is, and whether it obeys Ohm's law.

The marked point P lies on the drawn curve at a gridline crossing, so V/I is a whole number of ohms.
Its voltage is kept as an exact string ("0.8"), so a test can rebuild V/I as a fraction.
"""
from __future__ import annotations

import math
import random
import re
from fractions import Fraction

from ..core import GRID, INK, NAMES, curve, exact, mcq, measure, new_figure, short

ID = "iv_graph"
KIND = "graph.line"
SUBJECT = "physics"
BANDS = ("UP", "AL")
CONCEPTS = tuple(f"physics.{c}" for c in ("ohms-law", "electrical-resistance", "basic-electronic-components"))
# Not fields or capacitors.
AVOID = r"field|electrostatic|static electricity|charged particle|coulomb|capacitance"
WHAT = {"resistor": "a fixed resistor", "lamp": "a filament lamp", "diode": "a diode"}
DIODE_ON = 0.6  # volts before a diode conducts


def current(p: dict, V: float) -> float:
    """The current in mA at V volts."""
    if p["kind"] == "resistor":
        return V * 1000 / p["R"]
    if p["kind"] == "lamp":
        return V * 1000 / (p["R0"] + p["a"] * abs(V))
    return max(0.0, p["g"] * (V - DIODE_ON))


def view(p: dict) -> tuple[float, float, float, float]:
    if p["kind"] == "diode":
        return -1.0, 1.4, 0, current(p, 1.4)
    vmax = 10 if p["kind"] == "resistor" else 12
    return -vmax, vmax, -current(p, vmax), current(p, vmax)


def ystep(p: dict) -> int:
    if p["kind"] == "diode":
        return p["g"] // 5
    top = view(p)[3]
    return 10 if top <= 120 else 25 if top <= 250 else 50 if top <= 600 else 100


def _points(p: dict) -> list[str]:
    """The voltages where the curve crosses a gridline crossing and V/I is a whole number of ohms."""
    volts = ["0.8", "1", "1.2"] if p["kind"] == "diode" else [str(v) for v in range(1, 10)]
    out = []
    for v in volts:
        i = current(p, float(v))
        if i > 0 and abs(i - round(i)) < 1e-9 and round(i) % ystep(p) == 0 and (Fraction(v) * 1000 / round(i)).denominator == 1:
            out.append(v)
    return out


def sample(rng: random.Random) -> dict:
    band = rng.choice(BANDS)
    while True:
        kind = rng.choice(["resistor", "lamp", "diode"])
        if kind == "resistor":
            p = {"band": band, "kind": kind, "R": rng.choice([10, 20, 25, 40, 50, 100])}
        elif kind == "lamp":
            p = {"band": band, "kind": kind, "R0": rng.choice([5, 10, 20]), "a": rng.choice([2, 5, 10])}  # ohms cold, ohms more per volt
        else:
            p = {"band": band, "kind": kind, "g": rng.choice([50, 100, 125, 200, 250, 500])}  # mA per volt once on
        points = _points(p)
        if points:
            v = rng.choice(points)
            p["point"] = [v, round(current(p, float(v)))]
            return p


def draw(p: dict):
    x0, x1, _, y1 = view(p)
    step = ystep(p)
    fig, ax = new_figure(6.0, 5.0)
    if p["kind"] == "diode":
        ax.set_xticks([round(-1 + 0.2 * i, 1) for i in range(13)])
    else:
        ax.set_xticks(range(int(x0), int(x1) + 1, 2))
        ax.set_xticks(range(int(x0), int(x1) + 1), minor=True)
    top = step * math.ceil(y1 / step - 1e-9)
    bottom = -step if p["kind"] == "diode" else -top  # a diode passes no current backwards: one row below zero shows it
    # Numbers on every gridline, or every other one when there would be more than a dozen.
    ax.set_yticks(range(bottom, top + 1, step), minor=True)
    ax.set_yticks([t for t in range(bottom, top + 1, step) if (top - bottom) // step <= 12 or (t // step) % 2 == 0])
    ax.grid(True, which="both", color=GRID, linewidth=0.6)
    ax.set_axisbelow(True)
    ax.set_xlim(x0, x1)
    ax.set_ylim(bottom, top)
    # The axes cross at the origin; the numbers stay on the frame, clear of each other.
    ax.plot([x0, x1], [0, 0], color=INK, linewidth=1.0)
    ax.plot([0, 0], [bottom, top], color=INK, linewidth=1.0)
    curve(ax, lambda V: current(p, V), x0, x1, bottom, top, n=1200)
    V, I = float(p["point"][0]), p["point"][1]
    ax.plot([V], [I], marker="o", markersize=6, color=INK, zorder=5)
    ax.annotate("P", (V, I), xytext=(-12, 8), textcoords="offset points", ha="center", va="center", fontsize=12, fontweight="bold")
    ax.set_xlabel("Voltage (V)", loc="right")
    ax.set_ylabel("Current (mA)", loc="top")
    ax.tick_params(labelsize=8)
    return fig


def _readable(p: dict) -> list[str]:
    """Other voltages where the current sits on a gridline, so it reads exactly; for a diode, below
    0.6 V too, where no current flows."""
    volts = ["0.2", "0.4", "0.8", "1", "1.2"] if p["kind"] == "diode" else [str(v) for v in range(1, 10)]
    out = []
    for v in volts:
        i = current(p, float(v))
        if v != p["point"][0] and abs(i - round(i)) < 1e-9 and round(i) % ystep(p) == 0:
            out.append(v)
    return out


PLACES = ["in the school laboratory", "at the science club", "for a class project", "with a variable power supply",
          "with a milliammeter and a voltmeter", "for a science fair"]


def questions(p: dict, rng: random.Random) -> list:
    name, friend = rng.sample(NAMES, 2)
    V, I = Fraction(p["point"][0]), Fraction(p["point"][1], 1000)
    R = V / I
    obeys = "the current is proportional to the voltage"
    changes = "its resistance changes as the voltage changes"
    key = f"Yes: {obeys}" if p["kind"] == "resistor" else f"No: {changes}"
    # Yes or No, by either reason: the key cannot be told from the options alone.
    ohm_options = [f"{a}: {r}" for a in ("Yes", "No") for r in (obeys, changes)]
    qs = [
        short(f"{name} measured the current through a component {rng.choice(PLACES)}. What is its resistance at the point P?",
              exact(R), measure(R, "Ω")),
        mcq("Which component gives this graph?", WHAT[p["kind"]], [w for k, w in WHAT.items() if k != p["kind"]] + ["a light-dependent resistor"],
            rng),
        mcq("Does the component obey Ohm's law?", key, [o for o in ohm_options if o != key], rng),
    ]
    others = _readable(p)
    if others:
        v = rng.choice(others)
        ma = round(current(p, float(v)))
        qs.append(short(f"{friend} sets the voltage to {v} V. What current flows through the component, in mA?", ma,
                        measure(ma, "mA") + [f for f in measure(Fraction(ma, 1000), "A") if re.search("[A-Za-z]", f)]))  # amps, with the unit
    return qs
