"""Gas laws (UP, AL): Boyle's law, pressure against volume for air trapped in a syringe at a steady
temperature, its readings on lattice points of the curve pV = constant; or Charles's law, volume against
temperature in kelvin at a steady pressure, a straight line through the origin. A reading, pV, the pressure
or volume at a new volume or temperature, and the temperature in °C.

Every reading lies on a gridline crossing, and every answer is exact to two decimal places.
"""
from __future__ import annotations

import random
from fractions import Fraction

from ..core import GRID, INK, NAMES, curve, exact, measure, new_figure, short

ID = "gas_law"
KIND = "graph.line"
SUBJECT = "physics"
BANDS = ("UP", "AL")
CONCEPTS = tuple(f"physics.{c}" for c in ("ideal-gas-law", "kinetic-theory-of-matter", "pressure"))
# Not liquids' pressure, manometers or the atmosphere alone.
AVOID = r"manometer|pascal|archimedes|liquid|atmospheric|density"
TRAPPED = ["air trapped in a sealed syringe", "air in a bicycle pump with its end sealed", "air trapped in a glass tube by a column of oil"]


def sample(rng: random.Random) -> dict:
    band = rng.choice(BANDS)
    if rng.random() < 0.5:
        k = rng.choice([1200, 2400, 3600, 4800, 6000])
        pts = [[V, k // V] for V in range(5, 56, 5) if k % V == 0 and (k // V) % 20 == 0 and 20 <= k // V <= 300]
        pts = sorted(rng.sample(pts, min(len(pts), rng.choice([3, 4]))))  # the readings taken: three or four of them
        return {"band": band, "kind": "boyle", "k": k, "points": pts}
    c = rng.choice(["0.1", "0.2", "0.25", "0.5"])
    pts = [[T, exact(Fraction(c) * T)] for T in sorted(rng.sample([200, 250, 300, 350, 400], rng.choice([3, 4])))]
    return {"band": band, "kind": "charles", "c": c, "points": pts}


def draw(p: dict):
    fig, ax = new_figure(6.0, 4.6)
    if p["kind"] == "boyle":
        ax.set_xticks(range(0, 61, 10))
        ax.set_xticks(range(0, 61, 5), minor=True)
        ax.set_yticks(range(0, 301, 40))
        ax.set_yticks(range(0, 301, 20), minor=True)
        ax.set_xlim(0, 60)
        ax.set_ylim(0, 300)
        curve(ax, lambda V: p["k"] / V, 1, 60, 0, 300)
        for V, P in p["points"]:
            ax.plot([V], [P], marker="x", markersize=7, color=INK, mew=1.6)
        ax.set_xlabel("Volume (cm³)")
        ax.set_ylabel("Pressure (kPa)")
    else:
        c = Fraction(p["c"])
        top = float(c * 450)
        ax.set_xticks(range(0, 451, 50))
        ax.set_yticks([float(c * 50 * k) for k in range(10)], [exact(c * 50 * k) for k in range(10)])
        ax.set_xlim(0, 450)
        ax.set_ylim(0, top)
        first = min(T for T, _ in p["points"])  # measured from the first reading; extrapolated back to 0 K
        ax.plot([0, first], [0, float(c * first)], color=INK, linewidth=1.2, linestyle=(0, (5, 4)))
        ax.plot([first, 450], [float(c * first), float(c * 450)], color=INK, linewidth=1.8)
        for T, V in p["points"]:
            ax.plot([T], [float(Fraction(V))], marker="x", markersize=7, color=INK, mew=1.6)
        ax.set_xlabel("Temperature (K)")
        ax.set_ylabel("Volume (cm³)")
    ax.grid(True, which="both", color=GRID, linewidth=0.5)
    ax.set_axisbelow(True)
    ax.tick_params(labelsize=9)
    return fig


def questions(p: dict, rng: random.Random) -> list:
    name, friend = rng.sample(NAMES, 2)
    if p["kind"] == "boyle":
        k = p["k"]
        V1, P1 = rng.choice(p["points"])
        far = [V for V in (2, 4, 8, 10, 15, 25, 50, 75, 80, 100, 120, 150) if (Fraction(k, V) * 100).denominator == 1
               and V not in [v for v, _ in p["points"]]]
        V2 = rng.choice(far)
        return [short(f"{name} measured the pressure of {rng.choice(TRAPPED)} at a steady temperature. What is the pressure when the volume "
                      f"is {V1} cm³?", P1, measure(P1, "kPa")),
                short("What is pressure × volume for this gas, in kPa cm³?", k, [str(k), f"{k:,}", f"{k} kPa cm³", f"{k} kPa cm3"]),
                short(f"{friend} changes the volume slowly to {V2} cm³ at the same temperature. What is the pressure now?",
                      exact(Fraction(k, V2)), measure(Fraction(k, V2), "kPa"))]
    c = Fraction(p["c"])
    T1 = rng.choice([T for T, _ in p["points"]])
    T2 = rng.choice([500, 600, 700, 800])
    return [short(f"{name} heated some trapped air at a steady pressure. What is its volume at {T1} K?", exact(c * T1), measure(c * T1, "cm³")),
            short(f"What is the temperature in °C when the volume is {exact(c * T1)} cm³?", T1 - 273, measure(T1 - 273, "°C")),
            short(f"{friend} heats the air to {T2} K at the same pressure. What will its volume be?", exact(c * T2), measure(c * T2, "cm³"))]
