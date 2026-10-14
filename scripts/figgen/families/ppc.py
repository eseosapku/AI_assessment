"""Production possibility curve (UP): the curve for two goods a Rwandan student knows (coffee and tea at a
cooperative, maize and beans on a farm, cement and furniture in an economy), bowed out from the origin, with five
lettered points A to E from left to right: three on the curve, one inside it and one outside it. The opportunity
cost of moving between two points on the curve, each way, and which point is unattainable or inefficient.

The curve is y = c(n² - (x/sx)²): every point on it at a whole step of x lies on a gridline crossing, so each
opportunity cost is read exactly. The points off the curve sit on gridline crossings too, at least an eighth of
the curve's height from it, and plainly clear of it across as well.
"""
from __future__ import annotations

import math
import random

from ..core import GRID, INK, NAMES, mcq, new_figure, short

ID = "ppc"
KIND = "econ.curve"
SUBJECT = "economics"
BANDS = ("UP",)
CONCEPTS = tuple(f"economics.{c}" for c in ("production-possibility-curve", "scarcity-choice-opportunity-cost",
                                            "basic-economic-problems"))
ALSO = ("business.production-possibility-frontier",)
# A topic whose sections the book lists is reached only if one names what this figure teaches.
NEEDS = r"production possibilit|\bPP[CF]\b|opportunity cost"

# The two goods with their units, where they are made, and who chooses between them.
CONTEXTS = {
    "coffee": (("coffee", "tonnes"), ("tea", "tonnes"),
               ["a cooperative in Nyamasheke", "a cooperative in Rusizi", "a cooperative in Nyaruguru"], "the cooperative"),
    "maize": (("maize", "tonnes"), ("beans", "tonnes"),
              ["a farm in Nyagatare", "a farmers' group in Kayonza", "a farm in Bugesera"], "the farm"),
    "cement": (("cement", "thousand tonnes"), ("furniture", "thousand pieces"), ["an economy"], "the economy"),
}
# (n, c, label step): the curve meets the x-axis at n steps and the y-axis at c·n²; a gridline every c up the side.
SCALES = [(4, 2, 4), (4, 5, 10), (4, 10, 20), (5, 2, 10), (5, 4, 20), (5, 10, 50)]


def _curve(p: dict, x: float) -> float:
    k = x / p["sx"]
    return p["c"] * (p["n"] ** 2 - k * k)


def _across(n: int, c: int, sx: int, y: float) -> float:
    """Where the curve is at height y: the x it reaches there."""
    return sx * math.sqrt(max(0.0, n * n - y / c))


def sample(rng: random.Random) -> dict:
    context = rng.choice(sorted(CONTEXTS))
    (g1, u1), (g2, u2), places, _ = CONTEXTS[context]
    (xg, xu), (yg, yu) = ((g1, u1), (g2, u2)) if rng.random() < 0.5 else ((g2, u2), (g1, u1))
    while True:
        n, c, label = rng.choice(SCALES)
        sx = rng.choice([5, 10, 20])
        ymax = c * n * n
        top = -(-ymax * 6 // 5 // label) * label  # a fifth above the curve, to a labelled line
        gap = ymax / 8  # how far a point off the curve stands from it, at least
        k_in, k_out = rng.sample(range(1, n), 2)
        f_in, f_out = c * (n * n - k_in ** 2), c * (n * n - k_out ** 2)
        lows = [y for y in range(c, f_in, c) if y >= gap and f_in - y >= gap and _across(n, c, sx, y) - k_in * sx >= 0.6 * sx]
        highs = [y for y in range(f_out + c, top - c + 1, c) if y - f_out >= gap
                 and (y >= ymax or k_out * sx - _across(n, c, sx, y) >= 0.6 * sx)]
        if not lows or not highs:
            continue
        on = sorted(rng.sample([k for k in range(n + 1) if k not in (k_in, k_out)], 3))
        pts = [(k * sx, c * (n * n - k * k)) for k in on] + [(k_in * sx, rng.choice(lows)), (k_out * sx, rng.choice(highs))]
        pts.sort()
        points = {letter: [x, y] for letter, (x, y) in zip("ABCDE", pts)}
        inside = next(k for k, (x, y) in points.items() if x == k_in * sx)
        outside = next(k for k, (x, y) in points.items() if x == k_out * sx)
        curve_letters = [k for k in "ABCDE" if k not in (inside, outside)]
        first = sorted(rng.sample(curve_letters, 2))
        second = sorted(rng.choice([pr for pr in ([a, b] for i, a in enumerate(curve_letters) for b in curve_letters[i + 1:])
                                    if pr != first]))
        if rng.random() < 0.5:
            first, second = first, second[::-1]  # first gains the good across, second the good up the side
        else:
            first, second = first[::-1], second
        return {"band": "UP", "context": context, "place": rng.choice(places), "x_good": xg, "x_unit": xu,
                "y_good": yg, "y_unit": yu, "n": n, "c": c, "sx": sx, "label": label, "top": top,
                "points": points, "moves": [first, second], "ask": rng.choice(["outside", "inside"])}


def draw(p: dict):
    n, c, sx, label, top = p["n"], p["c"], p["sx"], p["label"], p["top"]
    fig, ax = new_figure(6.0, 4.8)
    xs = [sx * n * i / 200 for i in range(201)]
    ax.plot(xs, [_curve(p, x) for x in xs], color=INK, linewidth=2.0)
    for letter, (x, y) in p["points"].items():
        ax.plot([x], [y], "o", color=INK, markersize=6, clip_on=False, zorder=4)
        # beside the dot near the top, so the letter never reaches the title
        high = y > 0.9 * top
        ax.annotate(letter, (x, y), xytext=(8, 0) if high else (6, 5), textcoords="offset points", fontsize=12,
                    fontweight="bold", va="center" if high else "baseline", zorder=5)
    right = (n + 1) * sx
    ax.set_xticks(range(0, right + 1, sx))
    ax.set_yticks(range(0, top + 1, label))
    ax.set_yticks(range(0, top + 1, c), minor=True)
    ax.set_xlim(0, right)
    ax.set_ylim(0, top)
    ax.grid(True, which="both", color=GRID, linewidth=0.6)
    ax.set_axisbelow(True)
    ax.tick_params(labelsize=9)
    ax.tick_params(which="minor", length=0)
    ax.set_xlabel(f"{p['x_good'].capitalize()} ({p['x_unit']})")
    ax.set_ylabel(f"{p['y_good'].capitalize()} ({p['y_unit']})")
    ax.set_title(f"Production possibility curve for {p['place']}", fontsize=11.5)
    return fig


VERBS = ["studies", "is given", "draws", "is shown", "looks at"]
SETTINGS = ["in an economics lesson", "for homework", "on a revision card", "for a class test", "at the economics club"]


def _cost(p: dict, a: str, b: str) -> tuple[str, int, str, str]:
    """Moving along the curve from a to b: the good gained, and what is given up of the other, with its unit."""
    (xa, ya), (xb, yb) = p["points"][a], p["points"][b]
    if xb > xa:
        return p["x_good"], ya - yb, p["y_unit"], p["y_good"]
    return p["y_good"], xa - xb, p["x_unit"], p["x_good"]


def _forms(v: int, unit: str, good: str) -> list[str]:
    forms = [str(v), f"{v} {unit}", f"{v} {unit} of {good}"]
    if unit.startswith("thousand "):
        whole = unit.split(" ", 1)[1]
        forms += [f"{v * 1000} {whole}", f"{v * 1000} {whole} of {good}", f"{v} thousand"]
    return forms


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    owner = CONTEXTS[p["context"]][3]
    (a, b), (d, e) = p["moves"]
    gained, cost, unit, given = _cost(p, a, b)
    gained2, cost2, unit2, given2 = _cost(p, d, e)
    letters = sorted(p["points"])
    status = {k: ("on" if y == _curve(p, x) else "in" if y < _curve(p, x) else "out") for k, (x, y) in p["points"].items()}
    inside = next(k for k in letters if status[k] == "in")
    outside = next(k for k in letters if status[k] == "out")
    on = [k for k in letters if status[k] == "on"]
    rng.shuffle(on)
    if p["ask"] == "outside":
        choice = mcq(f"Which point can {owner} not reach with its present resources and technology?",
                     f"Point {outside}", [f"Point {k}" for k in [inside, *on[:2]]], rng)
    else:
        choice = mcq(f"Which point shows {owner} leaving some resources unemployed, or using them inefficiently?",
                     f"Point {inside}", [f"Point {k}" for k in [outside, *on[:2]]], rng)
    return [
        short(f"{who} {rng.choice(VERBS)} this production possibility curve for {p['place']} {rng.choice(SETTINGS)}. "
              f"If {owner} moves from point {a} to point {b}, what is the opportunity cost of the extra {gained}, "
              f"in {unit} of {given}?", cost, _forms(cost, unit, given)),
        choice,
        short(f"If {owner} moves instead from point {d} to point {e}, what is the opportunity cost of the extra {gained2}, "
              f"in {unit2} of {given2}?", cost2, _forms(cost2, unit2, given2)),
    ]
