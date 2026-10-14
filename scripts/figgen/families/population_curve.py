"""Population curves (LS, UP): the growth of a population of yeast, bacteria, flour beetles or rabbits after
it is put in a new place: a lag, an exponential (log) phase, a slowing and a stationary phase at the carrying
capacity, with the phases lettered. Which letter is the exponential phase, the carrying capacity, the
population at a time, and at UP the mean rate of increase between two times.

The curve runs smoothly through knots on gridlines without overshooting them; every value asked is a knot.
"""
from __future__ import annotations

import random
from fractions import Fraction

from ..core import GRID, INK, NAMES, exact, mcq, new_figure, short

ID = "population_curve"
KIND = "graph.line"
SUBJECT = "biology"
BANDS = ("LS", "UP")
CONCEPTS = tuple(f"biology.{c}" for c in ("population-characteristics", "population-size-limiting-factors",
                                           "interdependence-organisms-environment"))
AVOID = r"cell|enzyme|genetic|inherit|immun|disease|reproduc|excretion|digest|photosynth|respiration"
# organism, its place, the time unit, the time step, the count's unit
ORGANISMS = [("yeast", "a flask of sugar solution", "hours", 2, "millions of cells per cm³"),
             ("bacteria", "a flask of nutrient broth", "hours", 2, "millions of cells per cm³"),
             ("flour beetles", "a container of flour", "days", 10, "beetles"),
             ("rabbits", "a small island", "months", 3, "rabbits")]
SHAPES = [[1, 2, 5, 12, 18, 20, 20, 20], [1, 1, 3, 8, 16, 19, 20, 20], [2, 3, 6, 12, 17, 20, 20, 20]]  # 20ths of the capacity


def sample(rng: random.Random) -> dict:
    k = rng.randrange(len(ORGANISMS))
    _, _, unit, tstep, _ = ORGANISMS[k]
    ystep = rng.choice([1, 2, 5, 10])
    shape = rng.choice(SHAPES)
    times = [i * 2 for i in range(len(shape) - 1)] + [18]
    knots = [[t * tstep, v * ystep] for t, v in zip(times, shape)]
    letters = rng.choice([["A", "B", "C"], ["P", "Q", "R"], ["W", "X", "Y"]])
    phases = dict(zip(letters, ["lag", "exponential", "stationary"]))
    grow = [i for i in range(1, len(knots) - 2) if knots[i][1] < knots[-1][1]]
    i = rng.choice(grow)
    pairs = [(a, b) for a in range(len(knots)) for b in range(a + 1, len(knots))
             if knots[b][1] > knots[a][1] and (Fraction(knots[b][1] - knots[a][1], knots[b][0] - knots[a][0]) * 100).denominator == 1]
    a, b = rng.choice(pairs)
    return {"band": rng.choice(BANDS), "organism": k, "xstep": 2 * tstep, "ystep": ystep, "knots": knots, "K": 20 * ystep,
            "phases": phases, "ask": knots[i][0], "between": [knots[a][0], knots[b][0]]}


def _pchip(xs, ys, n=400):
    h = [xs[i + 1] - xs[i] for i in range(len(xs) - 1)]
    d = [(ys[i + 1] - ys[i]) / h[i] for i in range(len(h))]
    m = [d[0]] + [0.0 if d[i - 1] * d[i] <= 0 else 3 * (h[i - 1] + h[i]) / ((2 * h[i] + h[i - 1]) / d[i - 1] + (h[i] + 2 * h[i - 1]) / d[i])
                  for i in range(1, len(d))] + [d[-1] if d[-1] else 0.0]
    px, py = [], []
    for k in range(n + 1):
        x = xs[0] + (xs[-1] - xs[0]) * k / n
        i = next((j for j in range(len(h)) if x <= xs[j + 1]), len(h) - 1)
        t = (x - xs[i]) / h[i]
        h00, h10, h01, h11 = 2 * t ** 3 - 3 * t ** 2 + 1, t ** 3 - 2 * t ** 2 + t, -2 * t ** 3 + 3 * t ** 2, t ** 3 - t ** 2
        px.append(x)
        py.append(h00 * ys[i] + h10 * h[i] * m[i] + h01 * ys[i + 1] + h11 * h[i] * m[i + 1])
    return px, py


def draw(p: dict):
    fig, ax = new_figure(6.6, 4.4)
    xs, ys = [k[0] for k in p["knots"]], [k[1] for k in p["knots"]]
    end, top = xs[-1], p["K"] + 4 * p["ystep"]
    ax.set_xticks(range(0, end + 1, p["xstep"]))
    ax.set_yticks(range(0, top + 1, p["ystep"] * 2))
    ax.set_yticks(range(0, top + 1, p["ystep"]), minor=True)
    ax.grid(True, which="both", color=GRID, linewidth=0.5)
    ax.set_axisbelow(True)
    ax.set_xlim(0, end)
    ax.set_ylim(0, top)
    px, py = _pchip(xs, ys)
    ax.plot(px, py, color=INK, linewidth=1.9)
    letters = list(p["phases"])
    spots = [(xs[0] + xs[1]) / 2, (xs[2] + xs[3]) / 2, (xs[-2] + xs[-1]) / 2]  # the lag, the steepest rise, the plateau
    for letter, x in zip(letters, spots):
        y = py[min(range(len(px)), key=lambda j: abs(px[j] - x))]
        dx = -0.04 * end if letter == letters[1] else 0
        ax.text(x + dx, y + 1.6 * p["ystep"], letter, ha="center", va="bottom", fontsize=13, fontweight="bold")
    _, _, unit, _, count = ORGANISMS[p["organism"]]
    ax.set_xlabel(f"Time ({unit})")
    ax.set_ylabel(f"Population ({count})")
    ax.tick_params(labelsize=8)
    return fig


SETTINGS = ["in a biology lesson", "for a class project", "in an ecology study", "at the science club"]


def questions(p: dict, rng: random.Random) -> list:
    who, friend = rng.sample(NAMES, 2)
    name, place, unit, _, count = ORGANISMS[p["organism"]]
    letters = list(p["phases"])
    expo = letters[1]
    at = dict((t, v) for t, v in p["knots"])
    t = p["ask"]
    qs = [mcq(f"{who} followed {name} put into {place} {rng.choice(SETTINGS)}. Which letter shows the exponential (log) phase?",
              expo, [x for x in letters if x != expo] + ["none of them"], rng),
          short("What is the carrying capacity of this environment?", p["K"], [str(p["K"]), f"{p['K']} {count}"]),
          short(f"What was the population after {t} {unit}?", at[t], [str(at[t]), f"{at[t]} {count}"])]
    if p["band"] == "UP":
        a, b = p["between"]
        r = Fraction(at[b] - at[a], b - a)
        per = unit[:-1]
        qs.append(short(f"{friend} works out the mean rate of increase between {a} and {b} {unit}. What is it, in {count} per {per}?",
                        exact(r), [exact(r), f"{exact(r)} {count} per {per}"]))
    return qs
