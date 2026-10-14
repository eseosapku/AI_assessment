"""Heating and cooling curves (LS, UP): ice warmed at a steady rate through melting and boiling, or a
melted solid (stearic acid, naphthalene, lauric acid) cooling through its freezing point. How long
it took to melt or freeze, the start or freezing temperature, the state during a stage, and at UP the
energy a heater supplied, water's specific heat capacity, and why the temperature stays level.

Every corner of the graph sits on a gridline crossing, the plateaus at the substance's true melting
or boiling point. Ice's stages keep water's proportions: warming the water takes about 1.25 times as
long as melting the ice (c ≈ 4,200 J/(kg °C) against L ≈ 334,000 J/kg), so the heater's power and
the water's mass can be chosen to give believable values of both.
"""
from __future__ import annotations

import math
import random
from fractions import Fraction

from ..core import GRID, INK, NAMES, exact, mcq, measure, new_figure, short

ID = "heating_curve"
KIND = "graph.line"
SUBJECT = "physics"
BANDS = ("LS", "UP")
CONCEPTS = tuple(f"physics.{c}" for c in ("changes-of-state", "heat-and-temperature", "internal-energy", "heat-capacity-and-specific-heat",
                                          "states-of-matter"))
# Integrated Science teaches this too (P3n): its Lower Secondary topics are reached by these.
ALSO = tuple(f"science.{c}" for c in ('changes-of-state', 'states-of-matter', 'thermal-energy-transfer'))
# Not climate, radiation, insulation, pressure, density, circuits or farming.
AVOID = r"^chapter 9: heat transfer$|^thermal energy transfers$|climate|greenhouse|global warming|radiation|insulat|pressure|environmental|plant growth|gas laws|resistors|pascal|agriculture|density|making measurements|glossary|thinking and working scientifically|science in context|scientific method|science skills"
MELTS = {"stearic acid": 69, "naphthalene": 80, "lauric acid": 44}
STATES = ["solid only", "solid and liquid", "liquid only", "liquid and gas"]
SETTINGS = ["in the school laboratory", "at the science club", "for a class practical", "during a physics lesson", "for a science fair"]


def sample(rng: random.Random) -> dict:
    band = rng.choice(BANDS)
    if rng.random() < 0.5:
        T0 = rng.choice([-30, -20, -10])
        melt = rng.randint(3, 8)
        warm = rng.choice([w for w in range(4, 13) if 1.1 <= w / melt <= 1.45] or [round(1.25 * melt)])
        t1 = max(1, round(melt * -T0 * 2100 / 334000))  # warming ice takes 2,100 J/kg per degree; melting it, 334,000 J/kg
        t = [0, t1, t1 + melt, t1 + melt + warm, t1 + melt + warm + rng.randint(2, 4)]
        return {"band": band, "kind": "ice", "substance": "water", "corners": [[t[0], T0], [t[1], 0], [t[2], 0], [t[3], 100], [t[4], 100]]}
    substance = rng.choice(list(MELTS))
    mp = MELTS[substance]
    t1, freeze, t3 = rng.randint(2, 5), rng.randint(4, 9), rng.randint(3, 6)
    hot, cold = mp + rng.choice([10, 12, 15, 16, 20]), mp - rng.choice([10, 12, 14, 15, 18, 20])
    return {"band": band, "kind": "cooling", "substance": substance,
            "corners": [[0, hot], [t1, mp], [t1 + freeze, mp], [t1 + freeze + t3, cold]]}


def temperature(p: dict, t: float) -> float:
    """The drawn curve: straight stretches for ice heated at a steady rate; a cooling liquid or solid
    loses heat fastest when hottest, so each falling stretch curves like exp(-1.5 s), still falling as
    it ends rather than levelling into a false plateau."""
    c = p["corners"]
    for (ta, Ta), (tb, Tb) in zip(c, c[1:]):
        if ta <= t <= tb:
            s = (t - ta) / (tb - ta)
            if p["kind"] == "cooling" and Ta != Tb:
                return Ta + (Tb - Ta) * (1 - math.exp(-1.5 * s)) / (1 - math.exp(-1.5))
            return Ta + (Tb - Ta) * s
    raise ValueError(t)


def _axis(p: dict) -> tuple[int, int, int]:
    temps = [T for _, T in p["corners"]]
    if p["kind"] == "ice":
        return 10 * (min(temps) // 10) - 10, 110, 10
    return 5 * (min(temps) // 5) - 5, 5 * -(-max(temps) // 5) + 5, 1


def draw(p: dict):
    end = p["corners"][-1][0]
    lo, hi, step = _axis(p)
    fig, ax = new_figure(6.2, 4.8)
    ax.set_xticks(range(0, end + 2, 2 if end <= 22 else 4))
    ax.set_xticks(range(0, end + 2), minor=True)
    label = 10 if step == 1 and hi - lo > 30 else 5 if step == 1 else 20
    ax.set_yticks([y for y in range(lo, hi + 1, step) if y % label == 0])
    ax.set_yticks(range(lo, hi + 1, step), minor=True)
    ax.grid(True, which="both", color=GRID, linewidth=0.5)
    ax.set_axisbelow(True)
    ax.set_xlim(0, end + 1)
    ax.set_ylim(lo, hi)
    ts = [end * i / 600 for i in range(601)]
    ax.plot(ts, [temperature(p, t) for t in ts], color=INK, linewidth=1.8)
    if lo < 0:
        ax.plot([0, end + 1], [0, 0], color=INK, linewidth=0.8)
    ax.set_xlabel("Time (minutes)")
    ax.set_ylabel("Temperature (°C)")
    ax.tick_params(labelsize=8)
    return fig


def _heater(span: int, warm: int, rng: random.Random):
    """A heater's power and the water's mass giving c within 3,800-5,000 J/(kg °C) from the warming
    stretch and a latent heat within 300,000-400,000 J/kg from the melting one, or None."""
    pairs = []
    for P in range(100, 2001, 50):
        for M in map(Fraction, ("0.1", "0.2", "0.25", "0.4", "0.5", "1", "2")):
            c, L = Fraction(P * warm * 60) / (M * 100), Fraction(P * span * 60) / M
            if c.denominator == 1 and 3800 <= c <= 5000 and 300000 <= L <= 400000:
                pairs.append((P, M))
    return rng.choice(pairs) if pairs else None


def questions(p: dict, rng: random.Random) -> list:
    name = rng.choice(NAMES)
    c = p["corners"]
    k = 1  # the plateau where it melts or freezes
    span = c[k + 1][0] - c[k][0]
    stage = rng.randrange(len(c) - 1)
    a = rng.randint(c[stage][0], c[stage + 1][0] - 1)
    b = rng.randint(a + 1, c[stage + 1][0])
    stages = STATES if p["kind"] == "ice" else ["liquid only", "solid and liquid", "solid only"]
    state = mcq(f"What state or states are present between {a} and {b} minutes?", stages[stage], [s for s in STATES if s != stages[stage]], rng)
    minutes = measure(span, "min")
    if p["kind"] == "ice":
        T0 = c[0][1]
        qs = [short(f"{name} heated some ice in a beaker {rng.choice(SETTINGS)}. How long did the ice take to melt?", span, minutes),
              short("What was the temperature of the ice at the start?", T0, measure(T0, "°C")),
              state]
        if p["band"] == "UP":
            heater = _heater(span, c[3][0] - c[2][0], rng)
            P, M = heater if heater else (rng.choice([200, 300, 500, 1000]), None)
            qs.append(short(f"The heater's power is {P} W. If all of its energy goes into the beaker, how much energy did the ice take in "
                            "while it melted?", P * span * 60, measure(P * span * 60, "J")))
            if M is not None:
                cap = Fraction(P * (c[3][0] - c[2][0]) * 60) / (M * 100)
                qs.append(short(f"The beaker held {exact(M)} kg of water and the heater gave out {P} W. If no heat was lost, what specific "
                                "heat capacity does this give for water, in J/(kg °C)?", exact(cap),
                                measure(cap, "J/(kg °C)") + [f"{exact(cap)} J/kg°C", f"{exact(cap)} J/kg °C"]))
        return qs
    substance = p["substance"]
    qs = [short(f"{name} let some melted {substance} cool in a test tube {rng.choice(SETTINGS)}. At what temperature did it freeze?", c[1][1],
                measure(c[1][1], "°C")),
          short(f"How long did the {substance} take to freeze?", span, minutes),
          state]
    return qs
