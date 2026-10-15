"""A monopolist's cost and revenue curves (AL): AR = D and MR straight, MR falling twice as fast; MC the textbook
swoosh, MC = m + k(Q - q0)²; and AC built from it (fixed cost plus the area under MC, over output), so MC cuts AC
at AC's lowest point, as it must. The firm is the only seller in a Rwandan market (the only cinema in Huye, the only
ferry company on a Lake Kivu route), its price in francs.

Asks the profit-maximising output, where MC = MR (distractors: the output where MC = AR, the output where MR = 0,
and the output where AC or MC is lowest), the price it charges there, read from AR, and its supernormal profit,
(price - average cost) × output, the formula stated. MC = MR, MC = AR and MR = 0 all fall at whole steps of output,
and price and average cost at that output on gridlines, so the profit rectangle has its corners on the grid. AC at
that output is marked with a dot and a dotted line to the price axis, as textbooks draw it (P3y review: unmarked, a
point of the AC curve among close gridlines was read as a range and the profit guessed); the rectangle is not shaded.
"""
from __future__ import annotations

import random
from fractions import Fraction

from ..core import INK, NAMES, curve, mcq, money, new_figure, short
from . import _micro as g
from .econ_tables import frw

ID = "monopoly_diagram"
KIND = "econ.curve"
SUBJECT = "economics"
BANDS = ("AL",)
# Rwanda's S5 "Market Structures" and WAEC's "Market structures" teach the monopolist's equilibrium with this diagram.
ALSO_BANDS = {"AL": ("UP",)}
CONCEPTS = ("economics.monopoly", "economics.market-structures", "economics.revenue-and-profit")
# A topic whose sections the book lists is reached only if its name or a section names monopoly or market structures.
NEEDS = r"monopol|market structure"
AVOID = r"introduction to production|theory of a firm|revenues and profits|cost"

# the firm, what it sells (plural, singular), price steps in francs, output steps
FIRMS = [
    ("the only ferry company on a Lake Kivu route", "tickets", "ticket", [200, 250, 500], [10, 20]),
    ("the only cinema in Huye", "tickets", "ticket", [100, 200, 250], [20, 50]),
    ("the only bus company on a route in Nyamagabe", "tickets", "ticket", [100, 200], [20, 50]),
    ("the only water supplier in a small town", "cubic metres", "cubic metre", [50, 100], [20, 50]),
    ("the only cement maker in a region", "bags", "bag", [500, 1000], [20, 50]),
    ("the only internet provider in a district", "subscriptions", "subscription", [1000, 2000], [10, 20]),
]
QX = 14


def _mc(k, q0, m, q):
    return m + k * (q - q0) ** 2


def _ac(k, q0, m, fixed, q):
    vc = m * q + k * ((q - q0) ** 3 + q0 ** 3) / 3
    return (fixed + vc) / q


def _lowest(k: float, q0: int, m: int, fixed: float) -> float:
    """The output, to a tenth, at which AC is lowest."""
    return min(range(10, 10 * QX), key=lambda t: (fixed + m * t / 10 + k * ((t / 10 - q0) ** 3 + q0 ** 3) / 3) / (t / 10)) / 10


def _search() -> list[tuple]:
    """Every curve set whose crossings fall on whole steps: (a, b, k, q0, m, Q*, fixed)."""
    out = []
    for b in (Fraction(1, 2), Fraction(2, 3), Fraction(3, 4), Fraction(1), Fraction(5, 4), Fraction(3, 2), Fraction(2)):
        for k in (Fraction(1, 6), Fraction(1, 5), Fraction(1, 4), Fraction(1, 3), Fraction(2, 5), Fraction(1, 2),
                  Fraction(2, 3), Fraction(3, 4), Fraction(1), Fraction(3, 2)):
            for q0 in (1, 2, 3, 4, 5):
                for m in range(1, 11):
                    for qs in range(max(3, q0), 10):
                        a = _mc(k, q0, m, qs) + 2 * b * qs
                        if a.denominator != 1 or not 10 <= a <= 24 or _mc(k, q0, m, 0) >= a:
                            continue
                        mr0 = a / (2 * b)
                        price = a - b * qs
                        if mr0.denominator != 1 or not qs < mr0 <= QX - 1 or price.denominator != 1:
                            continue
                        if _mc(k, q0, m, qs).denominator != 1:
                            continue
                        roots = [q for q in range(1, 2 * QX) if _mc(k, q0, m, q) == a - b * q]
                        if len(roots) != 1 or not qs < roots[0] <= QX - 1 or roots[0] == mr0:
                            continue
                        for ac in range(int(_mc(k, q0, m, q0)) + 1, int(price) - 1):
                            fixed = ac * qs - (m * qs + k * ((qs - q0) ** 3 + q0 ** 3) / 3)
                            if fixed <= 0:
                                continue
                            low = _lowest(float(k), q0, m, float(fixed))
                            if 2 <= low <= QX - 2 and _ac(k, q0, m, fixed, Fraction(1)) > ac + 2:
                                out.append((int(a), b, k, q0, m, qs, fixed))
    return out


_SETS: list[tuple] = []


def sets() -> list[tuple]:
    """The curve sets, found once when first needed (not at import)."""
    if not _SETS:
        _SETS.extend(_search())
    return _SETS


def sample(rng: random.Random) -> dict:
    a, b, k, q0, m, qs, fixed = rng.choice(sets())
    firm = rng.randrange(len(FIRMS))
    dp, dq = rng.choice(FIRMS[firm][3]), rng.choice(FIRMS[firm][4])
    return {"band": "AL", "firm": firm, "a": a, "b": float(b), "k": [k.numerator, k.denominator], "q0": q0, "m": m,
            "fixed": [fixed.numerator, fixed.denominator], "dq": dq, "dp": dp, "qx": QX, "py": a + 2}


def _parts(p: dict):
    b = Fraction(p["b"]).limit_denominator(4)
    return p["a"], b, Fraction(*p["k"]), p["q0"], p["m"], Fraction(*p["fixed"])


def _answers(p: dict):
    a, b, k, q0, m, fixed = _parts(p)
    qs = next(q for q in range(1, QX) if _mc(k, q0, m, q) == a - 2 * b * q)
    return qs, a - b * qs, _ac(k, q0, m, fixed, qs)


def draw(p: dict):
    a, b, k, q0, m, fixed = _parts(p)
    plural, singular = FIRMS[p["firm"]][1:3]
    dq, dp, py = p["dq"], p["dp"], p["py"]
    kf, ff = float(k), float(fixed)
    fig, ax = new_figure(6.4, 5.6)
    g.grid(ax, QX, py, dq, dp, f"Output ({plural} per week)", f"Price, cost and revenue (Frw per {singular})")
    board = g.Board(ax, QX, py, dq, dp)
    ends = [("AR = D", board.line(a, -b, "AR"), -float(b)), ("MR", board.line(a, -2 * b, "MR"), -2 * float(b))]
    mc = lambda q: m + kf * (q - q0) ** 2  # noqa: E731
    ac = lambda q: (ff + m * q + kf * ((q - q0) ** 3 + q0 ** 3) / 3) / q  # noqa: E731
    for gid, f, start in (("MC", mc, 0.0), ("AC", ac, 0.3)):
        n = len(ax.lines)
        curve(ax, lambda x, f=f: f(x / dq) * dp, start * dq, QX * dq, 0, py * dp, n=900, linewidth=1.9)
        pts = []
        for ln in ax.lines[n:]:
            ln.set_gid(gid)
            pts += [(x / dq, y / dp) for x, y in ln.get_xydata()]
        board.path(pts)
        q, v = max(pts)  # the end of greater output
        ends.append((gid, (q, v), (f(q) - f(q - 0.1)) / 0.1, pts))
    # AC at the output where MC = MR, marked as the textbooks do: a dot on the AC curve and a dotted line across to
    # the price axis, on a gridline (P3y review: unmarked, it was read as "about 4 000 to 4 050" and the profit guessed)
    qs, _, cost = _answers(p)
    ax.plot([0, qs * dq], [float(cost) * dp] * 2, color=INK, linestyle=(0, (1.5, 2.2)), linewidth=1.1, gid="ac-guide")
    ax.plot([qs * dq], [float(cost) * dp], "o", color=INK, markersize=5, zorder=4)
    board.path([(t / 10, float(cost)) for t in range(0, 10 * qs + 1)])
    for name, end, slope, *path in ends:
        board.end_label(name, end, slope, path=path[0] if path else None)
    ax.set_title(f"A monopoly: {FIRMS[p['firm']][0]}", fontsize=11)
    return fig


VERBS = ["studies", "is given", "draws", "copies", "looks at", "works from"]
SETTINGS = ["in an economics lesson", "for homework", "on a revision card", "for a class test", "at the economics club",
            "before an exam"]


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    a, b, k, q0, m, fixed = _parts(p)
    firm, plural, singular = FIRMS[p["firm"]][:3]
    dq, dp = p["dq"], p["dp"]
    qs, price, cost = _answers(p)
    mr0 = int(a / (2 * b))
    mcar = next(q for q in range(qs + 1, 2 * QX) if _mc(k, q0, m, q) == a - b * q)
    low = _lowest(float(k), q0, m, float(fixed))
    wrong = [mcar, mr0]
    for extra in (round(low), q0, qs + 1, qs - 1):
        if extra >= 1 and extra not in wrong and extra != qs:
            wrong.append(extra)
    out = int(qs) * dq
    profit = int((price - cost) * qs) * dq * dp
    unit = f"{plural} per week"
    title = firm[0].upper() + firm[1:]
    return [
        mcq(f"{who} {rng.choice(VERBS)} the cost and revenue curves of {firm}, a monopoly, {rng.choice(SETTINGS)}. "
            f"What is its profit-maximising output, in {unit}?", f"{frw(out)} {plural}",
            [f"{frw(w * dq)} {plural}" for w in wrong[:3]], rng),
        short(f"{title} produces the output where MC = MR and sets its price on the AR curve. What price does it charge, "
              f"in Frw per {singular}?", int(price) * dp, money(int(price) * dp)),
        short(f"Supernormal profit = (price − average cost) × output. If {firm} produces where MC = MR, what supernormal "
              "profit does it make, in Frw per week?", profit, money(profit)),
    ]
