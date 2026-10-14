"""Solubility curves (UP): the solubility of real salts, in g per 100 g of water, from 0 to 100 °C. Either
three or four of the low salts on a 0–80 g axis gridded every 5 g, or potassium nitrate with two of them on
a 0–250 g axis gridded every 10 g. The solubility of a salt at a temperature, the mass that crystallises
when a saturated solution cools, and which salt is the most soluble at a temperature.

Every curve passes through its real values at 0, 20, ... 100 °C, rounded to the nearest gridline (sodium
chloride, nearly flat, is drawn true and never read); only those points are asked about.
"""
from __future__ import annotations

import random

from ..core import GRID, INK, NAMES, exact, mcq, measure, new_figure, short

ID = "solubility_curve"
KIND = "graph.line"
SUBJECT = "chemistry"
BANDS = ("UP",)
CONCEPTS = tuple(f"chemistry.{c}" for c in ("solutions-and-solubility", "salts", "separation-techniques"))
AVOID = r"organic|alkane|electrolysis|titration|isotope|periodic|bonding|enthalpy|rate|benzene|stoichiometry|analysis|environment|conductivity|npk|petro|phase|colligative|states of matter|group"
TEMPS = (0, 20, 40, 60, 80, 100)
REAL = {"potassium nitrate": (13, 32, 64, 110, 169, 246), "potassium chloride": (28, 34, 40, 45.5, 51, 56),
        "ammonium chloride": (29.4, 37.2, 45.8, 55.2, 65.6, 77.3), "copper(II) sulfate": (14.3, 20.7, 28.5, 40, 55, 75.4),
        "sodium chloride": (35.7, 36.0, 36.6, 37.3, 38.4, 39.8)}
LOW = ["potassium chloride", "ammonium chloride", "copper(II) sulfate", "sodium chloride"]
READ = {"potassium nitrate", "potassium chloride", "ammonium chloride", "copper(II) sulfate"}  # sodium chloride is never read
STYLES = ["-", (0, (6, 3)), (0, (1.5, 2)), (0, (6, 2, 1.5, 2))]


def _points(salt: str, step: int) -> list[float]:
    if salt not in READ:
        return list(REAL[salt])
    return [step * round(v / step) for v in REAL[salt]]


def reading(salt: str, t: int, step: int | None = None) -> float:
    step = step or (10 if salt == "potassium nitrate" else 5)
    return _points(salt, step)[TEMPS.index(t)]


def sample(rng: random.Random) -> dict:
    if rng.random() < 0.4:
        salts = ["potassium nitrate"] + rng.sample(LOW, 2)
        ystep, top = 10, 250
    else:
        salts = rng.sample(LOW, rng.choice([3, 4]))
        ystep, top = 5, 80
    rng.shuffle(salts)
    asked = [s for s in salts if s in READ and (ystep == 5 or s == "potassium nitrate")]
    salt = rng.choice(asked)
    t = rng.choice([20, 40, 60, 80])
    cool_salt = rng.choice([s for s in asked if s != "copper(II) sulfate"])  # its crystals hold water: CuSO4·5H2O
    t1 = rng.choice([40, 60, 80, 100])
    t2 = rng.choice([x for x in TEMPS if x < t1 and reading(cool_salt, x, ystep) < reading(cool_salt, t1, ystep)])
    shown = {"salts": salts, "asked": asked, "ystep": ystep}
    clear = [x for x in TEMPS if _margin(shown, x) >= ystep]
    return {"band": "UP", "salts": salts, "asked": asked, "ystep": ystep, "top": top, "ask": salt, "t": t,
            "cool": [cool_salt, t1, t2],
            "most": rng.choice(clear) if clear else None}


def drawn(p: dict, salt: str, t: int) -> float:
    """The value the curve is drawn through at t: rounded to the grid where the salt is read, true elsewhere."""
    return reading(salt, t, p["ystep"]) if salt in p["asked"] else REAL[salt][TEMPS.index(t)]


def _margin(p: dict, t: int) -> float:
    """How far the top curve stands above the next, as drawn (P3g final review: rounding made two curves meet),
    and zero when the drawn order is not the real one."""
    drawn_order = sorted(p["salts"], key=lambda s: drawn(p, s, t), reverse=True)
    real_top = max(p["salts"], key=lambda s: REAL[s][TEMPS.index(t)])
    if drawn_order[0] != real_top:
        return 0
    return drawn(p, drawn_order[0], t) - drawn(p, drawn_order[1], t)


def _pchip(xs, ys, n=300):
    """A smooth curve through the points that never overshoots them (Fritsch–Carlson)."""
    h = [xs[i + 1] - xs[i] for i in range(len(xs) - 1)]
    d = [(ys[i + 1] - ys[i]) / h[i] for i in range(len(h))]
    m = [d[0]] + [0.0 if d[i - 1] * d[i] <= 0 else 3 * (h[i - 1] + h[i]) / ((2 * h[i] + h[i - 1]) / d[i - 1] + (h[i] + 2 * h[i - 1]) / d[i])
                  for i in range(1, len(d))] + [d[-1]]
    px, py = [], []
    for k in range(n + 1):
        x = xs[0] + (xs[-1] - xs[0]) * k / n
        i = min(len(h) - 1, max(0, next((j for j in range(len(h)) if x <= xs[j + 1]), len(h) - 1)))
        t = (x - xs[i]) / h[i]
        h00, h10, h01, h11 = 2 * t ** 3 - 3 * t ** 2 + 1, t ** 3 - 2 * t ** 2 + t, -2 * t ** 3 + 3 * t ** 2, t ** 3 - t ** 2
        px.append(x)
        py.append(h00 * ys[i] + h10 * h[i] * m[i] + h01 * ys[i + 1] + h11 * h[i] * m[i + 1])
    return px, py


def draw(p: dict):
    fig, ax = new_figure(7.4, 4.6)
    step, top = p["ystep"], p["top"]
    ax.set_xticks(range(0, 101, 10))
    ax.set_xticks(range(0, 101, 5), minor=True)
    ax.set_yticks(range(0, top + 1, step * 2))
    ax.set_yticks(range(0, top + 1, step), minor=True)
    ax.grid(True, which="both", color=GRID, linewidth=0.5)
    ax.set_axisbelow(True)
    ax.set_xlim(0, 100)
    ax.set_ylim(0, top)
    for salt, style in zip(p["salts"], STYLES):
        # A salt never asked about here is drawn true: rounded to this axis's 10 g it would wobble.
        values = [drawn(p, salt, t) for t in TEMPS]
        xs, ys = _pchip(list(TEMPS), [float(v) for v in values])
        ax.plot(xs, ys, color=INK, linewidth=1.7, linestyle=style, label=salt)
    ax.set_xlabel("Temperature (°C)")
    ax.set_ylabel("Solubility (g per 100 g of water)")
    ax.tick_params(labelsize=8)
    ax.legend(loc="upper left", bbox_to_anchor=(1.01, 1.0), fontsize=9, frameon=False, handlelength=3)
    return fig


SETTINGS = ["in a chemistry lesson", "for homework", "on a revision card", "for a class test", "at the science club"]


def _g(v) -> list[str]:
    forms = measure(v, "g")
    for n in [f for f in forms if " " not in f and "g" not in f]:
        forms += [f"{n} g per 100 g of water", f"{n} g per 100 g water", f"{n} g per 100g water", f"{n} g/100 g water", f"{n} g/100 g"]
    return forms


def questions(p: dict, rng: random.Random) -> list:
    who, friend = rng.sample(NAMES, 2)
    step = p["ystep"]
    v = reading(p["ask"], p["t"], step)
    salt, t1, t2 = p["cool"]
    drop = reading(salt, t1, step) - reading(salt, t2, step)
    qs = [short(f"{who} plotted these solubility curves {rng.choice(SETTINGS)}. What is the solubility of {p['ask']} at {p['t']} °C?",
                exact(v), _g(v)),
          short(f"In {friend}'s experiment, a saturated solution of {salt} in 100 g of water is cooled from {t1} °C to {t2} °C. "
                "What mass of crystals forms?", exact(drop), measure(drop, "g"))]
    if p["most"] is not None:
        k = TEMPS.index(p["most"])
        best = max(p["salts"], key=lambda s: drawn(p, s, p["most"]))
        qs.append(mcq(f"Which salt is the most soluble at {p['most']} °C?", best, [s for s in p["salts"] if s != best], rng))
    return qs
