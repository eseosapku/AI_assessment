"""The exchange rate of the Rwandan franc against the US dollar (UP; AL by ALSO_BANDS), of two kinds.

Market: the demand for and supply of francs on a grid, the price of 1 000 Frw in US dollars up the side and the
quantity of francs across, with D or S shifted (D1 to D2, S1 to S2) and both equilibria lettered and dotted to the
axes. The new rate, read at E2; whether the franc appreciated or depreciated and by how much (two directions by two
amounts: the right change and the curve's own vertical shift, a common misreading); and which event could have caused
it, among four: foreign tourists spending more or less in Rwanda (demand for francs), Rwandan firms spending more or
less on imports (supply of francs). The lines are P = a - bQ and P = c + dQ in grid units, and a shift across by a
multiple of b + d keeps the new equilibrium on a gridline crossing.

Convert: the rate in Frw per US$1 in two years (Year 1 and Year 2, no calendar years, so invented rates never
read as a record), with an imported good's dollar price and a Rwandan export's franc
price printed. The import's price in francs in a year, the export's price in dollars in a year (always whole), and
what happened to the franc and to the franc price of imports, two by two. Each conversion rule is in its stem.
"""
from __future__ import annotations

import random
from fractions import Fraction

from ..core import GRID, NAMES, mcq, money, new_figure, short
from . import _econ_grid as grid
from .econ_tables import frw, titled_table

ID = "exchange_rate"
KIND = "econ.curve"
SUBJECT = "economics"
BANDS = ("UP",)
ALSO_BANDS = {"UP": ("AL",)}  # the same diagram and sums in Cambridge AS Level, whose chapter is named for them
MARKET = ("economics.exchange-rates", "economics.floating-exchange-rate", "economics.foreign-exchange")
CONVERT = ("economics.exchange-rates", "economics.exchange-rate-impact", "economics.foreign-exchange")
CONCEPTS = ("economics.exchange-rates", "economics.floating-exchange-rate", "economics.foreign-exchange",
            "economics.exchange-rate-impact")
# IGCSE Business teaches what a rise or fall in the exchange rate does to exporters' and importers' prices.
ALSO = ("business.international-trade-and-aids",)
# A topic whose sections the book lists is reached only if one names what this figure teaches.
NEEDS = r"exchange rate|foreign exchange|forex|international economy"

XU, CENTS = 10, 5  # billion Frw across, and US cents up the side, in one grid unit
XMAX, YMAX = 16, 26
QEND = 14.2


def concepts_for(p: dict) -> tuple[str, ...]:
    return MARKET if p["kind"] == "market" else CONVERT


def avoid_for(p: dict) -> str:
    """Another country's economy; Commerce's trade topics, which teach no exchange rates; and for the market diagram,
    IGCSE Business, which works the conversions but draws no market for a currency."""
    base = r"nigeria|^trade$|aids to trade|transport and insurance|quality"
    return base + (r"|external influences" if p["kind"] == "market" else "")


IMPORTS = [("laptop", range(400, 1001, 50)), ("solar panel", range(150, 401, 10)), ("mobile phone", range(100, 301, 10)),
           ("water pump", range(200, 601, 20)), ("sewing machine", range(120, 361, 10))]
EXPORTS = ["bag of coffee", "box of tea", "crate of avocados", "box of chilli sauce", "set of baskets"]


def _market(rng: random.Random) -> dict | None:
    b, d = rng.choice([1, 2]), rng.choice([1, 2])
    q1, p1 = rng.randint(5, 10), rng.randint(12, 18)
    a, c = p1 + b * q1, p1 - d * q1
    which = rng.choice(["D", "S"])
    s = rng.choice([1, 2]) * (b + d) * rng.choice([1, -1])
    if which == "D":
        q2 = q1 + b * s // (b + d)
        p2 = c + d * q2
    else:
        q2 = q1 + d * s // (b + d)
        p2 = a - b * q2
    if not (3 <= q2 <= 13 and 9 <= p2 <= 22):
        return None
    return {"band": "UP", "kind": "market", "curve": which, "a": a, "b": b, "c": c, "d": d, "shift": s, "xunit": XU,
            "cents": CENTS, "e1": [q1, p1], "e2": [q2, p2]}


def _convert(rng: random.Random) -> dict:
    y1, y2 = "Year 1", "Year 2"  # no calendar years: the rates are invented, and must not read as Rwanda's record
    r1 = rng.randrange(950, 1501, 25)
    r2 = r1 + rng.choice([-1, 1, 1]) * rng.randrange(50, 251, 25)
    item, prices = rng.choice(IMPORTS)
    ey = rng.randrange(2)
    frw_price = [r1, r2][ey] * rng.randrange(20, 401, 5)
    return {"band": "UP", "kind": "convert", "rates": [[y1, r1], [y2, r2]], "import": [item, rng.choice(list(prices))],
            "export": [rng.choice(EXPORTS), frw_price], "export_year": ey, "import_year": rng.randrange(2)}


def sample(rng: random.Random) -> dict:
    if rng.random() < 0.5:
        return _convert(rng)
    while True:
        p = _market(rng)
        if p:
            return p


def _dollars(units: int) -> str:
    return f"{units * CENTS / 100:.2f}"


def draw(p: dict):
    if p["kind"] == "convert":
        (item, usd), (good, price) = p["import"], p["export"]
        rows = [[y, frw(r)] for y, r in p["rates"]]
        notes = [f"Price of an imported {item}: US$ {frw(usd)}", f"Price of a {good} for export: {frw(price)} Frw"]
        return titled_table("Exchange rate of the Rwandan franc", ["Year", "Frw per US$1"], rows, ["c", "r"], notes,
                            least=1.6)
    # drawn in real units, billions of francs across and dollars up, so each gridline is the value it marks
    fig, ax = new_figure(6.2, 5.4)
    a, b, c, d, s = p["a"], p["b"], p["c"], p["d"], p["shift"]
    u = CENTS / 100
    xmax, ymax, qend = XMAX * XU, YMAX * u, QEND * XU
    line = lambda c0, slope, text, style="-": grid.line(  # noqa: E731
        ax, lambda x: u * (c0 + slope * x / XU), text, qend, xmax, ymax, style)
    shift_d = p["curve"] == "D"
    line(a, -b, "D1" if shift_d else "D")
    line(c, d, "S" if shift_d else "S1")
    if shift_d:
        line(a + b * s, -b, "D2", "--")
    else:
        line(c - d * s, d, "S2", "--")
    dirs = [(XU, -b * u), (-XU, b * u), (XU, d * u), (-XU, -d * u)]
    for name in ("E1", "E2"):
        q, pp = p[name.lower()]
        grid.mark(ax, fig, name, (XU * q, u * pp), dirs, xmax, ymax)
    ax.set_xticks(range(0, xmax + 1, 2 * XU))
    ax.set_xticks(range(0, xmax + 1, XU), minor=True)
    ax.set_yticks([u * k for k in range(0, YMAX + 1, 2)])
    ax.set_yticks([u * k for k in range(0, YMAX + 1)], minor=True)
    ax.set_yticklabels([_dollars(k) for k in range(0, YMAX + 1, 2)])
    ax.set_xlim(0, xmax)
    ax.set_ylim(0, ymax)
    ax.grid(True, which="both", color=GRID, linewidth=0.6)
    ax.set_axisbelow(True)
    ax.tick_params(labelsize=8.5)
    ax.tick_params(which="minor", length=0)
    ax.set_xlabel("Quantity of Rwandan francs (billion Frw per week)")
    ax.set_ylabel("Price of 1 000 Frw (US$)")
    ax.set_title("The market for Rwandan francs", fontsize=11.5)
    return fig


VERBS = ["studies", "is given", "copies", "looks at", "works from"]
SETTINGS = ["in an economics lesson", "for homework", "on a revision card", "for a class test", "at the economics club",
            "before a mock exam", "in a study group in Huye", "while revising in Kigali"]
EVENTS = {("D", 1): "Foreign tourists spend more in Rwanda", ("D", -1): "Foreign tourists spend less in Rwanda",
          ("S", 1): "Rwandan firms spend more on imports", ("S", -1): "Rwandan firms spend less on imports"}


def _usd_forms(v: str) -> list[str]:
    cents = int(round(float(v) * 100))
    short_v = v.rstrip("0").rstrip(".") if "." in v else v
    out = [v, short_v, f"${v}", f"${short_v}", f"US${v}", f"US$ {v}", f"{v} US$", f"{v} dollars", f"{v} US dollars",
           f"{cents} cents", f"{cents} US cents"]
    return [f for i, f in enumerate(out) if f not in out[:i]]


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    if p["kind"] == "convert":
        (y1, r1), (y2, r2) = p["rates"]
        rates = dict(p["rates"])
        (item, usd), (good, price) = p["import"], p["export"]
        yi = p["rates"][p["import_year"]][0]
        ye = p["rates"][p["export_year"]][0]
        in_frw, in_usd = usd * rates[yi], price // rates[ye]
        way = "depreciated" if r2 > r1 else "appreciated"
        cost = "more" if r2 > r1 else "less"
        options = [f"The franc {w}, so imports cost {c} in francs" for w in ("depreciated", "appreciated")
                   for c in ("more", "less")]
        return [
            short(f"{who} {rng.choice(VERBS)} these exchange rates {rng.choice(SETTINGS)}. A price in Frw = the price in US$ "
                  f"× the number of Frw per US$1. What is the price of the imported {item} in Frw in {yi}?", in_frw,
                  money(in_frw)),
            short(f"A price in US$ = the price in Frw ÷ the number of Frw per US$1. What is the price of the {good} in US "
                  f"dollars in {ye}?", in_usd, [f"${in_usd}", f"US${in_usd}", f"US$ {in_usd}", f"{in_usd} dollars",
                                                f"{in_usd} US dollars"]),
            mcq(f"Between {y1} and {y2}, what happened to the value of the franc against the dollar, and to the franc "
                "price of imports?", f"The franc {way}, so imports cost {cost} in francs", options, rng),
        ]
    a, b, c, d, s = p["a"], p["b"], p["c"], p["d"], p["shift"]
    r1, r2 = p["e1"][1], p["e2"][1]
    key = _dollars(r2)
    change = abs(r2 - r1)
    misread = abs(b * s) if p["curve"] == "D" else abs(d * s)  # the curve's own vertical shift
    way = "appreciated" if r2 > r1 else "depreciated"
    amounts = [_dollars(change), _dollars(misread)]
    options = [f"It {w} by ${x} per 1 000 Frw" for w in ("appreciated", "depreciated") for x in amounts]
    return [
        short(f"{who} {rng.choice(VERBS)} this diagram of the market for Rwandan francs {rng.choice(SETTINGS)}. What is the "
              "exchange rate at the new equilibrium E2, in US dollars per 1 000 Frw?", key, _usd_forms(key)),
        mcq("Against the US dollar, how did the franc's value change from E1 to E2?",
            f"It {way} by ${_dollars(change)} per 1 000 Frw", options, rng),
        mcq("Which event could have caused the move from E1 to E2?", EVENTS[(p["curve"], 1 if s > 0 else -1)],
            list(EVENTS.values()), rng),
    ]
