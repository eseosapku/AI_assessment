"""Circuits (LS, UP, AL): a cell or battery with resistors in series, in parallel, or one in series with a
parallel pair, an ammeter and a voltmeter, in standard symbols. The total resistance, the ammeter and
voltmeter readings, and the power in a resistor.

The battery's voltage and the resistances are chosen so that every resistance, current, voltage and
power is exact to two decimal places.
"""
from __future__ import annotations

import random
from fractions import Fraction

from matplotlib.patches import Circle, Rectangle

from ..core import INK, NAMES, exact, measure, new_figure, short

ID = "circuit"
KIND = "physics.circuit"
SUBJECT = "physics"
BANDS = ("LS", "UP", "AL")
CONCEPTS = tuple(f"physics.{c}" for c in ("electric-current", "potential-difference", "electrical-resistance", "ohms-law", "resistors-in-circuits",
                                          "circuit-symbols-and-diagrams", "electrical-energy-and-power", "kirchhoffs-laws"))
# Integrated Science teaches this too (P3n): its Lower Secondary topics are reached by these.
ALSO = tuple(f"science.{c}" for c in ('electrical-components', 'electricity-basics', 'simple-circuits'))
# Direct-current circuits: not fields, capacitors, alternating current, induction, motors or generators.
AVOID = r"^p2:|installation|transmission|field|electrostatic|static electricity|charged particle|coulomb|capacitance|alternating|induction|telecommunication|magnetic effect|motor effect|generators|electromagnetic forces|^magnetism$|work, energy|glossary|thinking and working scientifically|science in context|scientific method|science skills"
OHMS = [1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 24, 30, 40, 60]
VOLTS = [Fraction(3, 2), Fraction(3), Fraction(9, 2), Fraction(6), Fraction(9), Fraction(12), Fraction(24)]


def solve(kind: str, volts: Fraction, R: list[Fraction]):
    if kind == "series":
        total = sum(R)
        return total, volts / total, [volts / total] * len(R)
    if kind == "parallel":
        total = 1 / sum(1 / r for r in R)
        return total, volts / total, [volts / r for r in R]
    par = 1 / (1 / R[1] + 1 / R[2])
    total = R[0] + par
    current = volts / total
    return total, current, [current, current * par / R[1], current * par / R[2]]


def _exact2(v: Fraction) -> bool:
    return (v * 100).denominator == 1


def sample(rng: random.Random) -> dict:
    band = rng.choice(BANDS)
    kinds = {"LS": ["series", "parallel"], "UP": ["series", "parallel", "mixed"], "AL": ["parallel", "mixed"]}[band]
    kind = rng.choice(kinds)  # chosen once, so the retries below cannot favour the kind that fits most often
    n = 3 if kind == "mixed" else rng.choice([2, 3]) if kind == "series" else 2
    while True:
        R = [Fraction(rng.choice(OHMS)) for _ in range(n)]
        volts = rng.choice(VOLTS)
        total, current, currents = solve(kind, volts, R)
        if not all(_exact2(v) for v in [total, current, *currents, *(c * r for c, r in zip(currents, R)), *(c * c * r for c, r in zip(currents, R))]):
            continue
        if current > 5:
            continue
        ammeter = None if kind == "series" or rng.random() < 0.5 else rng.choice([1, 2] if kind == "mixed" else [0, 1])
        # Across a parallel pair a voltmeter would read the battery's printed voltage: none is drawn.
        voltmeter = None if kind == "parallel" else rng.randrange(n) if kind == "series" else rng.choice([0, 1])
        return {"band": band, "kind": kind, "volts": exact(volts), "resistors": [int(r) for r in R], "ammeter": ammeter, "voltmeter": voltmeter}


def _wire(ax, *pts):
    ax.plot([x for x, _ in pts], [y for _, y in pts], color=INK, linewidth=1.5, solid_capstyle="round")


def _resistor(ax, x, y, label, above):
    ax.add_patch(Rectangle((x - 0.7, y - 0.22), 1.4, 0.44, facecolor="white", edgecolor=INK, linewidth=1.5, zorder=3))
    ax.text(x, y + (0.42 if above else -0.42), label, ha="center", va="bottom" if above else "top", fontsize=10)


def _meter(ax, x, y, letter):
    ax.add_patch(Circle((x, y), 0.36, facecolor="white", edgecolor=INK, linewidth=1.5, zorder=3))
    ax.text(x, y, letter, ha="center", va="center", fontsize=11, fontweight="bold", zorder=4)


def draw(p: dict):
    kind, R, n = p["kind"], p["resistors"], len(p["resistors"])
    fig, ax = new_figure(6.6, 4.6)
    H = 4.0
    # The cell on the left side: long thin plate (+) above, short thick plate below.
    _wire(ax, (0, 0), (0, 1.8))
    _wire(ax, (0, 2.2), (0, H))
    ax.plot([-0.55, 0.55], [2.2, 2.2], color=INK, linewidth=1.5)
    ax.plot([-0.25, 0.25], [1.8, 1.8], color=INK, linewidth=3.5)
    ax.text(-0.75, 2.0, f"{p['volts']} V", ha="right", va="center", fontsize=11)
    label = lambda i: f"R{i + 1} = {R[i]} Ω"  # noqa: E731
    # The bottom wire, with the ammeter in it when it reads the whole current.
    if p["ammeter"] is None:
        _wire(ax, (0, 0), (4.64, 0))
        _meter(ax, 5.0, 0, "A")
        _wire(ax, (5.36, 0), (10, 0))
    else:
        _wire(ax, (0, 0), (10, 0))
    _wire(ax, (10, 0), (10, H))
    if kind == "series":
        xs = [3.0, 7.0] if n == 2 else [2.4, 5.0, 7.6]
        pts = [(0, H)] + [pt for x in xs for pt in ((x - 0.7, H), (x + 0.7, H))] + [(10, H)]
        for a, b in zip(pts[::2], pts[1::2]):
            _wire(ax, a, b)
        for i, x in enumerate(xs):
            _resistor(ax, x, H, label(i), above=False)
        v = xs[p["voltmeter"]]
        _wire(ax, (v - 1.0, H), (v - 1.0, H + 1.1), (v - 0.36, H + 1.1))
        _wire(ax, (v + 0.36, H + 1.1), (v + 1.0, H + 1.1), (v + 1.0, H))
        _meter(ax, v, H + 1.1, "V")
        top = H + 1.6
    else:
        # A parallel pair between nodes a and b; in a mixed circuit, R1 in series before it.
        a, b = (3.0, 8.0) if kind == "parallel" else (4.6, 9.0)
        first = 0 if kind == "parallel" else 1
        if kind == "mixed":
            _wire(ax, (0, H), (1.5, H))
            _resistor(ax, 2.2, H, label(0), above=False)
            _wire(ax, (2.9, H), (a, H))
        else:
            _wire(ax, (0, H), (a, H))
        _wire(ax, (b, H), (10, H))
        mid = (a + b) / 2
        for j, y in enumerate((H, H + 1.6)):
            i = first + j
            rx = mid - (0.8 if p["ammeter"] == i else 0)
            _wire(ax, (a, y), (rx - 0.7, y))
            _resistor(ax, rx, y, label(i), above=j == 1)
            if p["ammeter"] == i:
                _wire(ax, (rx + 0.7, y), (rx + 1.24, y))
                _meter(ax, rx + 1.6, y, "A")
                _wire(ax, (rx + 1.96, y), (b, y))
            else:
                _wire(ax, (rx + 0.7, y), (b, y))
        _wire(ax, (a, H), (a, H + 1.6))
        _wire(ax, (b, H), (b, H + 1.6))
        if kind == "mixed" and p["voltmeter"] == 0:
            _wire(ax, (1.2, H), (1.2, H + 1.1), (1.84, H + 1.1))
            _wire(ax, (2.56, H + 1.1), (3.2, H + 1.1), (3.2, H))
            _meter(ax, 2.2, H + 1.1, "V")
        elif p["voltmeter"] is not None:
            # Across the parallel pair, below it inside the loop.
            _wire(ax, (a, H), (a, H - 1.4), (mid - 0.36, H - 1.4))
            _wire(ax, (mid + 0.36, H - 1.4), (b, H - 1.4), (b, H))
            _meter(ax, mid, H - 1.4, "V")
        top = H + 2.4
    ax.set_xlim(-2.4, 10.6)
    ax.set_ylim(-0.7, top)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def third(p: dict, currents: list, R: list, rng: random.Random):
    """The voltmeter's reading; in a parallel circuit, which has none, the current in a branch not metered."""
    if p["kind"] == "parallel":
        j = rng.choice([0, 1]) if p["ammeter"] is None else 1 - p["ammeter"]
        return short(f"What is the current in resistor R{j + 1}?", exact(currents[j]), measure(currents[j], "A"))
    pd = currents[p["voltmeter"]] * R[p["voltmeter"]]
    return short("What does the voltmeter read?", exact(pd), measure(pd, "V"))


def questions(p: dict, rng: random.Random) -> list:
    R = [Fraction(r) for r in p["resistors"]]
    total, current, currents = solve(p["kind"], Fraction(p["volts"]), R)
    name = rng.choice(NAMES)
    where = rng.choice(["in the school laboratory", "at the science club", "for a class practical", "on a circuit board", "for a science fair",
                        "during a physics lesson"])
    amp = currents[p["ammeter"]] if p["ammeter"] is not None else current
    k = rng.randrange(len(R))
    power = currents[k] ** 2 * R[k]
    qs = [
        short(f"{name} built this circuit with a {p['volts']} V {'cell' if Fraction(p['volts']) <= 2 else 'battery'} {where}. "
              f"What is the total resistance of the {['two', 'three'][len(R) - 2]} resistors?", exact(total), measure(total, "Ω")),
        short("What does the ammeter read?", exact(amp), measure(amp, "A")),
        third(p, currents, R, rng),
        short(f"What is the power in resistor R{k + 1}?", exact(power), measure(power, "W")),
    ]
    if p["band"] == "AL" and p["kind"] == "mixed" and p["ammeter"] is not None:
        # Kirchhoff: the current into a junction equals the current out, so the other branch carries the rest.
        j = ({1, 2} if p["kind"] == "mixed" else {0, 1}).difference({p["ammeter"]}).pop()
        qs.append(short(f"The current from the battery is {exact(current)} A. What is the current in resistor R{j + 1}?", exact(currents[j]),
                        measure(currents[j], "A")))
    return qs
