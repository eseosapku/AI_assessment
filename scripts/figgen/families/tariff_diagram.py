"""A tariff on imports (UP, AL): domestic demand and supply of a good an economy also buys from abroad (bicycles,
solar lamps, bags of cement), on a grid, with the world price drawn across and the world price plus a tariff above
it, as Cambridge AS Level (chapter 26) and the Rwanda S6 book (tools of protectionism) draw it.

At the world price the economy imports the gap between what its people demand and what its own producers supply; the
tariff raises the price by the tariff, so domestic output rises, demand falls and imports shrink. Asks the imports
before and after the tariff (with imports = quantity demanded - quantity supplied by domestic producers stated),
domestic output after it, and the tariff revenue (tariff per unit × imports after the tariff); at AS Level also the
deadweight loss, the two triangles, with its formula stated.

Demand is P = a - bQ and supply P = c + dQ in grid steps, and the tariff a whole multiple of both slopes, so every
quantity asked falls on a gridline crossing with a dot on it.
"""
from __future__ import annotations

import random

from ..core import INK, NAMES, money, new_figure, short
from . import _micro as g
from .econ_tables import frw

ID = "tariff_diagram"
KIND = "econ.curve"
SUBJECT = "economics"
BANDS = ("UP", "AL")
CONCEPTS = ("economics.trade-protectionism", "economics.international-trade")
# A topic whose sections the book lists is reached only if its name or a section names protection or tariffs; Rwanda
# S6's "Economic Integration" names neither (its stages and case studies), and is left.
NEEDS = r"protection|tariff|commercial policy|trade barrier|barriers to (foreign|international) trade"
AVOID = r"integration|nigeria"

# good: (sold per, plural, period, quantity steps, price steps)
GOODS = {
    "bicycles": ("bicycle", "bicycles", "month", [100, 200], [5000, 10000]),
    "solar lamps": ("lamp", "lamps", "month", [100, 200, 500], [1000, 2000]),
    "bags of cement": ("bag", "bags", "week", [500, 1000], [1000]),
    "school shoes": ("pair", "pairs", "month", [200, 500], [1000, 2000]),
    "mobile phones": ("phone", "phones", "month", [100, 200], [5000, 10000]),
    "roofing sheets": ("sheet", "sheets", "week", [200, 500], [1000, 2000]),
}
QX, PY = 14, 18


def _quantities(p: dict) -> tuple[int, int, int, int]:
    """Domestic supply and demand at the world price, then at the world price plus the tariff, in grid steps."""
    a, b, c, d, pw, t = p["a"], p["b"], p["c"], p["d"], p["pw"], p["t"]
    return (pw - c) // d, (a - pw) // b, (pw + t - c) // d, (a - pw - t) // b


def sample(rng: random.Random) -> dict:
    good = rng.choice(sorted(GOODS))
    band = rng.choice(BANDS)
    while True:
        b, d = rng.choice([1, 2]), rng.choice([1, 2])
        pw = rng.randint(3, 8)
        q1, q2 = rng.randint(1, 4), rng.randint(8, 13)
        c, a = pw - d * q1, pw + b * q2
        t = rng.choice([v for v in (2, 3, 4, 6) if v % b == 0 and v % d == 0])
        q3, q4 = q1 + t // d, q2 - t // b
        if c < 0 or q4 - q3 < 2 or pw + t > PY - 4:
            continue
        dq, dp = rng.choice(GOODS[good][3]), rng.choice(GOODS[good][4])
        if band == "AL" and (t * dp * dq * ((q3 - q1) + (q2 - q4))) % 2:
            continue  # the deadweight loss in whole francs
        return {"band": band, "good": good, "a": a, "b": b, "c": c, "d": d, "pw": pw, "t": t, "dq": dq, "dp": dp,
                "qx": QX, "py": PY}


def _price_label(board, text: str, price: float, size: float = 9.5) -> None:
    """A horizontal price line's name just above or below it, as far right as there is room clear of the curves; on two
    lines where one is too wide for the room between steep curves."""
    for words in (text, text.replace(" ", "\n", 1)):
        w = board._size(words, size)[0]
        q = QX - w / 2 - 0.15
        while q >= w / 2 + 0.1:
            if board.label(words, q, price, size, gap=0.12, where=[(0, 1), (0, -1)]):
                return
            q -= 0.25
    raise ValueError(f"no room for the label {text}")


def draw(p: dict):
    per, plural, period = GOODS[p["good"]][:3]
    a, b, c, d, pw, t, dq, dp = (p[k] for k in ("a", "b", "c", "d", "pw", "t", "dq", "dp"))
    fig, ax = new_figure(6.4, 5.6)
    # a number on every other line across once the quantities reach thousands, so they never run into each other
    g.grid(ax, QX, PY, dq, dp, f"Quantity ({plural} per {period})", f"Price (Frw per {per})",
           xevery=2 if QX * dq >= 1000 else 1)
    board = g.Board(ax, QX, PY, dq, dp)
    ends = [("D domestic", board.line(a, -b, "D"), -b), ("S domestic", board.line(c, d, "S"), d)]
    for gid, price, style in (("world", pw, "-."), ("tariff", pw + t, "--")):
        ax.plot([0, QX * dq], [price * dp] * 2, color=INK, linestyle=style, linewidth=1.5, gid=gid)
        board.path([(i / 10, price) for i in range(10 * QX + 1)])
    q1, q2, q3, q4 = _quantities(p)
    for q, price in ((q1, pw), (q2, pw), (q3, pw + t), (q4, pw + t)):
        g.dotted(ax, [(q, 0), (q, price)], dq, dp)
        board.path([(q, i / 10) for i in range(10 * price + 1)])
        ax.plot([q * dq], [price * dp], "o", color=INK, markersize=4.5, zorder=4)
        board.block(q - 0.15, q + 0.15, price - 0.2, price + 0.2)
    for name, end, slope in ends:
        board.end_label(name, end, slope, size=10)
    _price_label(board, "World price\n+ tariff", pw + t)
    _price_label(board, "World price", pw)
    ax.set_title(f"The market for {p['good']} in an open economy", fontsize=11)
    return fig


VERBS = ["studies", "is given", "draws", "copies", "looks at", "works from"]
SETTINGS = ["in an economics lesson", "for homework", "on a revision card", "for a class test", "at the economics club",
            "before an exam", "in a study group in Huye", "while revising in Kigali"]
IMPORTS = "Imports = the quantity demanded − the quantity supplied by domestic producers."


def _forms(n: int, unit: str) -> list[str]:
    forms = [str(n), f"{n} {unit}"]
    if n >= 1000:
        forms += [frw(n), f"{n:,}", f"{frw(n)} {unit}"]
    return forms


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    good = p["good"]
    per, plural, period = GOODS[good][:3]
    t, dq, dp = p["t"], p["dq"], p["dp"]
    q1, q2, q3, q4 = _quantities(p)
    unit = f"{plural} per {period}"
    tariff = f"The government puts a tariff of {frw(t * dp)} Frw per {per} on {good} bought from abroad."
    before, after = (q2 - q1) * dq, (q4 - q3) * dq
    revenue = t * dp * after
    qs = [
        short(f"{who} {rng.choice(VERBS)} this diagram of the market for {good} in an economy that trades at the world "
              f"price, {rng.choice(SETTINGS)}. {tariff} {IMPORTS} Before the tariff, at the world price, how many {plural} "
              f"are imported, in {unit}?", before, _forms(before, plural)),
        short(f"{tariff} {IMPORTS} After the tariff, how many {plural} are imported, in {unit}?", after, _forms(after, plural)),
    ]
    if p["band"] == "UP":
        qs.append(short(f"{tariff} After the tariff, how many {plural} do domestic producers supply, in {unit}?", q3 * dq,
                        _forms(q3 * dq, plural)))
    qs.append(short(f"{tariff} The government's tariff revenue = tariff per unit × imports after the tariff. What is its "
                    f"tariff revenue from {good}, in Frw per {period}?", revenue, money(revenue)))
    if p["band"] == "AL":
        dwl = t * dp * dq * ((q3 - q1) + (q2 - q4)) // 2
        qs.append(short(f"{tariff} The deadweight loss of the tariff = ½ × tariff × (rise in domestic output) + ½ × tariff × "
                        f"(fall in the quantity demanded). What is the deadweight loss, in Frw per {period}?", dwl,
                        money(dwl)))
    return qs
