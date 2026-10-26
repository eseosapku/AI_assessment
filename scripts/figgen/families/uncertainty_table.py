"""Uncertainties in AS Level practical work (AL): Cambridge AS & A Level Physics P1 "Practical skills at AS level" and P2
"Planning, analysis and evaluation". Two kinds:

- repeat: a results table of three to five repeated readings of one quantity (the time for 20 oscillations on a
  stopwatch, a wire's diameter on a micrometer, a ball bearing's on vernier calipers, a current on a digital ammeter),
  with the rules printed under it: absolute uncertainty = ½ × range, percentage uncertainty = absolute uncertainty ÷
  mean × 100%, and for y = kxⁿ (k exact) the percentage uncertainty in y is n × that in x. Asks the mean, the absolute
  uncertainty, the percentage uncertainty and the percentage uncertainty in a quantity worked out from a power;
- gradient: six points with error bars on a graph, the line of best fit and the worst acceptable line (through the
  top of the first error bar and the bottom of the last, or the other way round). Asks both gradients, the uncertainty
  in the gradient (their difference, stated in the stem) and the intercept on the y-axis.

The readings are chosen so the mean has the readings' own decimal places and the percentage uncertainty ends within
two decimal places; on the graph every point, error-bar end and line end lies on a gridline crossing.
"""
from __future__ import annotations

import random
from fractions import Fraction

from matplotlib.lines import Line2D
from matplotlib.patches import Rectangle

from ..core import GRID, INK, NAMES, UNIT_WORDS, exact, new_figure, short

ID = "uncertainty_table"
KIND = "table.data"
SUBJECT = "physics"
BANDS = ("AL",)
CONCEPTS = ("physics.measurement-precision-and-uncertainty", "physics.measurement-instrumentation-procedures")
# Only chapters that teach uncertainties: the practical-skills chapters name them in their sections.
NEEDS = r"uncertaint|practical skills|planning, analysis"
AVOID = r"glossary"
MIN_VARIETY = 40

# quantity: what is measured, its symbol, unit, the instrument (with its article), decimal places recorded,
# the range of the mean in recorded steps, the power, and the quantity worked out from it
QUANTITIES = {
    "oscillations": ("time for 20 oscillations of a pendulum", "t", "s", "a stopwatch", 1, (120, 300), 2,
                     "T², where the period T = t ÷ 20", "T²"),
    "diameter": ("diameter of a wire", "d", "mm", "a micrometer screw gauge", 2, (25, 60), 2,
                 "the wire's cross-sectional area A = πd² ÷ 4", "A"),
    "sphere": ("diameter of a ball bearing", "d", "mm", "vernier calipers", 1, (100, 250), 3,
               "the ball bearing's volume V = πd³ ÷ 6", "V"),
    "current": ("current in a resistor", "I", "A", "a digital ammeter", 2, (20, 90), 2,
                "the power P = I²R, where the resistance R is known exactly", "P"),
}
# context: y label, x label, gradient unit, its other written forms, what the graph shows, intercept unit,
# x steps, y steps, the intercept's range in real units
CONTEXTS = {
    "heating": ("temperature θ / °C", "time t / min", "°C min⁻¹", ["°C/min", "°C min^-1", "degrees per minute"],
                "the temperature θ of some water against the time t it was heated", "θ", "t", "°C",
                ["1", "2"], ["0.5", "1", "2"], (16, 26)),
    "spring": ("length L / cm", "load F / N", "cm N⁻¹", ["cm/N", "cm N^-1"],
               "the length L of a spring against the load F hung on it", "L", "F", "cm",
               ["0.5", "1", "2"], ["0.5", "1"], (5, 15)),
    "velocity": ("velocity v / m s⁻¹", "time t / s", "m s⁻²", ["m/s²", "m/s^2", "m s^-2", "ms-2"],
                 "the velocity v of a trolley against the time t", "v", "t", "m s⁻¹",
                 ["0.5", "1", "2"], ["0.2", "0.5", "1"], (1, 6)),
    "resistance": ("resistance R / Ω", "temperature θ / °C", "Ω °C⁻¹", ["Ω/°C", "ohms per °C", "Ω °C^-1"],
                   "the resistance R of a coil of wire against its temperature θ", "R", "θ", "Ω",
                   ["10", "20"], ["0.5", "1", "2"], (20, 50)),
}


def _pairs(lo: int, hi: int) -> list[tuple[int, int]]:
    """(mean, range) in recorded steps whose percentage uncertainty 50·range/mean ends within two decimal places; an even
    range, so half of it is a whole number of the readings' last digit."""
    return [(b, kr) for b in range(lo, hi + 1) for kr in range(2, 9, 2) if (5000 * kr) % b == 0 and 5 * kr < b]


def _repeat(rng: random.Random) -> dict:
    quantity = rng.choice(list(QUANTITIES))
    _, _, _, _, dp, (lo, hi), power, _, _ = QUANTITIES[quantity]
    pairs = _pairs(lo, hi)
    while True:
        b, kr = rng.choice(pairs)
        n = rng.choice([3, 4, 5])
        a = rng.randint(1, kr - 1)
        low, high = b - a, b - a + kr
        for _ in range(200):
            rest = [rng.randint(low, high) for _ in range(n - 2)]
            if low + high + sum(rest) == n * b:
                vals = [low, high] + rest
                rng.shuffle(vals)
                step = Fraction(1, 10 ** dp)
                return {"band": "AL", "kind": "repeat", "quantity": quantity,
                        "readings": [f"{float(v * step):.{dp}f}" for v in vals], "power": power}


def _gradient(rng: random.Random) -> dict:
    context = rng.choice(list(CONTEXTS))
    *_, dxs, ss, (ilo, ihi) = CONTEXTS[context]
    while True:
        s = Fraction(rng.choice(ss))
        cs = [c for c in range(3, 200) if ilo <= c * s <= ihi]
        c = rng.choice(cs)
        g = rng.randint(2, 6)
        noise = [0] + [rng.choice([-1, 0, 1]) for _ in range(4)] + [0]
        if abs(sum(noise)) > 1 or sum(1 for v in noise if v) < 2:
            continue
        worst = rng.choice(["steeper", "shallower"])
        ys = [c + g * k + noise[k - 1] for k in range(1, 7)]
        sign = 1 if worst == "steeper" else -1
        w1, w6 = ys[0] - sign, ys[5] + sign
        grad = Fraction(w6 - w1, 5)
        if all(abs(w1 + grad * (k - 1) - ys[k - 1]) <= 1 for k in range(1, 7)):
            return {"band": "AL", "kind": "gradient", "context": context, "dx": rng.choice(dxs), "s": exact(s), "c": c,
                    "g": g, "noise": noise, "worst": worst, "e": 1}


def sample(rng: random.Random) -> dict:
    return _repeat(rng) if rng.random() < 0.5 else _gradient(rng)


# --- drawing ------------------------------------------------------------------------------------------------------

def _draw_repeat(p: dict):
    what, sym, unit, tool, dp, _, _, _, _ = QUANTITIES[p["quantity"]]
    n = len(p["readings"])
    fig, ax = new_figure(7.4, 4.0)
    ax.set_position([0.02, 0.02, 0.96, 0.96])
    head, col = 2.6, 1.35
    x0 = (12 - head - n * col) / 2
    ax.text(6, 7.45, f"Repeated readings of the {what}", ha="center", va="center", fontsize=12, fontweight="bold")
    ax.text(6, 6.85, f"Instrument: {tool[2:] if tool.startswith('a ') else tool}", ha="center", va="center", fontsize=10)
    rows = [("Reading", [str(i + 1) for i in range(n)]), (f"{sym} / {unit}", p["readings"])]
    for r, (label, cells) in enumerate(rows):
        y = 5.6 - r * 0.9
        ax.add_patch(Rectangle((x0, y), head, 0.9, facecolor="#e8ecef", edgecolor=INK, linewidth=1.0))
        ax.text(x0 + head / 2, y + 0.45, label, ha="center", va="center", fontsize=11,
                fontweight="bold" if r == 0 else "normal")
        for i, v in enumerate(cells):
            ax.add_patch(Rectangle((x0 + head + i * col, y), col, 0.9, facecolor="white" if r else "#e8ecef",
                                   edgecolor=INK, linewidth=1.0))
            ax.text(x0 + head + (i + 0.5) * col, y + 0.45, v, ha="center", va="center", fontsize=11,
                    fontweight="bold" if r == 0 else "normal")
    rules = ["Absolute uncertainty = ½ × range of the readings (largest − smallest)",
             "Percentage uncertainty = absolute uncertainty ÷ mean × 100%",
             "If y = kxⁿ and k is exact, the percentage uncertainty in y is",
             "n × the percentage uncertainty in x."]
    for i, line in enumerate(rules):
        ax.text(0.6, 3.95 - i * 0.62, line, ha="left", va="center", fontsize=10)
    ax.set_xlim(0, 12)
    ax.set_ylim(1.6, 7.9)
    ax.axis("off")
    return fig


def _gy(p: dict) -> list[int]:
    return [p["c"] + p["g"] * k + p["noise"][k - 1] for k in range(1, 7)]


def _view(p: dict) -> tuple[int, int]:
    lo = max(0, (p["c"] - 3) // 5 * 5)
    hi = -(-(p["c"] + Fraction(66, 10) * p["g"] + 3) // 5) * 5
    return lo, int(hi)


def _draw_gradient(p: dict):
    ylab, xlab, *_ = CONTEXTS[p["context"]]
    dx, s, e = Fraction(p["dx"]), Fraction(p["s"]), p["e"]
    lo, hi = _view(p)
    fig, ax = new_figure(6.4, 5.6)
    X = lambda k: float(k * dx)  # noqa: E731
    Y = lambda v: float(v * s)  # noqa: E731
    ax.set_xticks([X(k) for k in range(0, 8)])
    ax.set_xticks([X(Fraction(k, 2)) for k in range(0, 15)], minor=True)
    ax.set_xticklabels([exact(k * dx) for k in range(0, 8)])
    ax.set_yticks([Y(v) for v in range(lo, hi + 1, 5)])
    ax.set_yticklabels([exact(v * s) for v in range(lo, hi + 1, 5)])
    ax.set_yticks([Y(v) for v in range(lo, hi + 1)], minor=True)
    ax.grid(True, which="minor", color=GRID, linewidth=0.45)
    ax.grid(True, which="major", color="#9a9a9a", linewidth=0.8)
    ax.set_axisbelow(True)
    ax.set_xlim(0, X(7))
    ax.set_ylim(Y(lo), Y(hi))
    ys = _gy(p)
    for k, y in zip(range(1, 7), ys):
        ax.plot([X(k), X(k)], [Y(y - e), Y(y + e)], color=INK, linewidth=1.1)
        for end in (y - e, y + e):
            ax.plot([X(k) - X(Fraction(1, 10)), X(k) + X(Fraction(1, 10))], [Y(end), Y(end)], color=INK, linewidth=1.1)
        ax.plot([X(k)], [Y(y)], marker="x", color=INK, markersize=7, markeredgewidth=1.6, linestyle="none")
    c, g = p["c"], p["g"]
    ax.plot([0, X(Fraction(66, 10))], [Y(c), Y(c + g * Fraction(66, 10))], color=INK, linewidth=1.5)
    sign = 1 if p["worst"] == "steeper" else -1
    w1, w6 = ys[0] - sign * e, ys[5] + sign * e
    grad = Fraction(w6 - w1, 5)
    k0, k1 = Fraction(4, 10), Fraction(66, 10)
    ax.plot([X(k0), X(k1)], [Y(w1 + grad * (k0 - 1)), Y(w1 + grad * (k1 - 1))], color=INK, linewidth=1.4,
            linestyle=(0, (5, 3)))
    ax.set_xlabel(xlab, fontsize=11)
    ax.set_ylabel(ylab, fontsize=11)
    ax.tick_params(labelsize=9)
    handles = [Line2D([], [], color=INK, linewidth=1.5, label="line of best fit"),
               Line2D([], [], color=INK, linewidth=1.4, linestyle=(0, (5, 3)), label="worst acceptable line")]
    ax.legend(handles=handles, loc="upper left", fontsize=9.5, framealpha=1.0, edgecolor=INK)
    return fig


def draw(p: dict):
    return _draw_repeat(p) if p["kind"] == "repeat" else _draw_gradient(p)


# --- questions ----------------------------------------------------------------------------------------------------

SETTINGS = ["in a physics practical", "during an AS Level practical test", "in the school laboratory",
            "for a practical assessment", "at the science club", "while planning an experiment",
            "in a practical lesson in Kigali", "for a laboratory report"]


MORE_UNITS = {"m s⁻¹": ("m/s", "m s^-1", "ms-1"), "°C": ("degrees C", "C"), "mm": ("millimetres",), "A": ("amperes",)}


def _with_unit(v: str, unit: str, alts=()) -> list[str]:
    forms = [v]
    for u in (unit, *alts, *MORE_UNITS.get(unit, ()), *UNIT_WORDS.get(unit, ())):
        for f in (f"{v} {u}", f"{v}{u}"):
            if f not in forms:
                forms.append(f)
    return forms


def _pct(v: str) -> list[str]:
    return [v, f"{v}%", f"{v} %", f"±{v}%", f"± {v}%", f"{v} percent"]


def _repeat_questions(p: dict, rng: random.Random) -> list:
    what, sym, unit, tool, dp, _, power, derived, dsym = QUANTITIES[p["quantity"]]
    who, friend = rng.sample(NAMES, 2)
    vals = [Fraction(r) for r in p["readings"]]
    n = len(vals)
    mean = sum(vals) / n
    half = (max(vals) - min(vals)) / 2
    pct = half / mean * 100
    key = f"{float(mean):.{dp}f}"
    u = exact(half)
    again = what.replace(" of a ", " of the ").replace(" in a ", " in the ")
    return [
        short(f"{who} measured the {what} {n} times with {tool} {rng.choice(SETTINGS)}. What is the mean {again}?", key,
              _with_unit(key, unit) + _with_unit(exact(mean), unit)),
        short(f"Taking the absolute uncertainty as half the range of the readings, what is the absolute uncertainty "
              f"in the mean {again}?", u, _with_unit(u, unit) + [f"±{u}", f"± {u}", f"±{u} {unit}", f"± {u} {unit}"]),
        short(f"Using the rule printed under the table, what is the percentage uncertainty in the mean {again}?",
              exact(pct), _pct(exact(pct))),
        short(f"{friend} works out {derived}. Using the rules printed under the table, what is the percentage "
              f"uncertainty in {dsym}?", exact(power * pct), _pct(exact(power * pct))),
    ]


def _gradient_questions(p: dict, rng: random.Random) -> list:
    _, _, unit, alts, shows, ysym, xsym, iunit, *_ = CONTEXTS[p["context"]]
    who = rng.choice(NAMES)
    dx, s, e = Fraction(p["dx"]), Fraction(p["s"]), p["e"]
    ys = _gy(p)
    sign = 1 if p["worst"] == "steeper" else -1
    best = p["g"] * s / dx
    worst = Fraction(ys[5] + sign * e - (ys[0] - sign * e), 5) * s / dx
    graph = f"the graph of {ysym} against {xsym}"
    b, w, d, c = exact(best), exact(worst), exact(abs(best - worst)), exact(p["c"] * s)
    return [
        short(f"{who} plotted {shows} {rng.choice(SETTINGS)}, with error bars, a line of best fit and a worst acceptable "
              f"line. What is the gradient of the line of best fit, in {unit}?", b, _with_unit(b, unit, alts)),
        short(f"What is the gradient of the worst acceptable line (the dashed line) on {graph}, in {unit}?", w,
              _with_unit(w, unit, alts)),
        short(f"Taking the uncertainty in the gradient as the difference between the gradients of the line of best fit "
              f"and the worst acceptable line, what is the absolute uncertainty in the gradient of {graph}?", d,
              _with_unit(d, unit, alts) + [f"±{d}", f"± {d}"]),
        short(f"The line of best fit on {graph} cuts the {ysym} axis where {xsym} = 0. What is the value of {ysym} there?",
              c, _with_unit(c, iunit)),
    ]


def questions(p: dict, rng: random.Random) -> list:
    return _repeat_questions(p, rng) if p["kind"] == "repeat" else _gradient_questions(p, rng)
