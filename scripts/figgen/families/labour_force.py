"""The labour force and unemployment (UP; AL by ALSO_BANDS): a table from a labour survey, in thousands of people.

Two layouts. Districts: four Rwandan districts, each with the numbers employed and unemployed; the unemployment rate
of one district, the labour force of another, and which district has the highest rate (never the district with the
most people out of work, so reading the raw column is the wrong way). Years: an economy's labour force, employed and
unemployed over four or five years, one middle cell marked "?"; the missing number, the rate in a year, and how the
rate changed between the first and last year (rose or fell, by the right amount or the amount a misread row gives).

Labour force = employed + unemployed and unemployment rate = unemployed ÷ labour force × 100 are written in each stem
that needs them. Every rate asked is exact to one decimal place, and the highest rate leads the next by 1.5 points.
"""
from __future__ import annotations

import random
from fractions import Fraction

from ..core import NAMES, mcq, short
from .econ_tables import frw, titled_table

ID = "labour_force"
KIND = "table.data"
SUBJECT = "economics"
BANDS = ("UP",)
ALSO_BANDS = {"UP": ("AL",)}  # the same table in Cambridge AS Level, whose chapter is named for unemployment
CONCEPTS = ("economics.unemployment", "economics.labour-force", "economics.employment-rates")
# another country's economy; S5 "Inflation", whose Phillips-curve section names unemployment but works no labour
# force table
AVOID = r"nigeria|inflation"
# A topic whose sections the book lists is reached only if one names what this figure teaches.
NEEDS = r"unemploy|labour force"

DISTRICTS = ["Huye", "Musanze", "Rubavu", "Nyagatare", "Rusizi", "Muhanga", "Kayonza", "Bugesera", "Gicumbi", "Karongi",
             "Nyamagabe", "Rwamagana"]
# (labour force, rate in tenths of a per cent) pairs whose number unemployed is whole: a district's, and an economy's
PAIRS = [(lf, t) for lf in range(80, 321) for t in range(50, 251) if lf * t % 1000 == 0]
BIG = [(lf, t) for lf in range(2500, 6001, 50) for t in range(40, 201) if lf * t % 1000 == 0]
BIG_SET = set(BIG)


def _rate(u: int, lf: int) -> Fraction:
    return Fraction(100 * u, lf)


def _districts(rng: random.Random) -> dict:
    while True:
        names = rng.sample(DISTRICTS, 4)
        picks = rng.sample(PAIRS, 4)
        rows = [[d, lf - lf * t // 1000, lf * t // 1000] for d, (lf, t) in zip(names, picks)]
        rates = {d: _rate(u, e + u) for d, e, u in rows}
        top = sorted(rates.values(), reverse=True)
        most = max(rows, key=lambda r: r[2])[0]
        best = max(rates, key=rates.get)
        if top[0] - top[1] < Fraction(3, 2) or most == best or len({r[2] for r in rows}) < 4 \
                or len({r[1] + r[2] for r in rows}) < 4:
            continue
        ask_rate = rng.choice([d for d in names if d != best])
        ask_lf = rng.choice([d for d in names if d != ask_rate])
        return {"band": "UP", "kind": "districts", "rows": rows, "ask_rate": ask_rate, "ask_lf": ask_lf}


def _years(rng: random.Random) -> dict:
    n = rng.choice([4, 5])
    first = rng.randint(2015, 2020)
    while True:
        # a labour force that grows a little each year, and a rate that drifts by three points at most
        picks = [rng.choice(BIG)]
        for _ in range(n - 1):
            lf = picks[-1][0] + 50 * rng.randint(1, 4)
            ts = [t for t in range(picks[-1][1] - 30, picks[-1][1] + 31) if (lf, t) in BIG_SET and t != picks[-1][1]]
            if not ts:
                break
            picks.append((lf, rng.choice(ts)))
        if len(picks) < n:
            continue
        rows = [[first + i, lf, lf - lf * t // 1000, lf * t // 1000] for i, (lf, t) in enumerate(picks)]
        rates = [_rate(r[3], r[1]) for r in rows]
        d = rates[-1] - rates[0]
        wrong = rates[-1] - rates[-2]  # the change a misread row gives
        if abs(d) < Fraction(1, 2) or abs(abs(wrong) - abs(d)) < Fraction(1, 2) or abs(wrong) < Fraction(1, 2):
            continue
        if len({r[1] for r in rows}) < n:
            continue
        bi = rng.randrange(1, n - 1)
        bj = rng.choice([1, 2, 3])
        full = [list(r) for r in rows]
        rows[bi][bj] = None
        ask = rng.choice([i for i in range(n) if i != bi])
        return {"band": "UP", "kind": "years", "rows": rows, "full": full, "ask_year": rows[ask][0]}


def sample(rng: random.Random) -> dict:
    return _districts(rng) if rng.random() < 0.5 else _years(rng)


def draw(p: dict):
    if p["kind"] == "districts":
        heads = ["District", "Employed\n(thousands)", "Unemployed\n(thousands)"]
        rows = [[d, frw(e), frw(u)] for d, e, u in p["rows"]]
        return titled_table("Labour survey of four districts", heads, rows, ["l", "r", "r"], least=1.3)
    heads = ["Year", "Labour force\n(thousands)", "Employed\n(thousands)", "Unemployed\n(thousands)"]
    rows = [[str(r[0])] + ["?" if v is None else frw(v) for v in r[1:]] for r in p["rows"]]
    return titled_table("Labour force of an economy", heads, rows, ["c", "r", "r", "r"], least=1.2)


VERBS = ["studies", "is given", "copies", "looks at", "works from"]
SETTINGS = ["in an economics lesson", "for homework", "on a revision card", "for a class test", "at the economics club",
            "before a mock exam", "in a study group in Huye", "while revising in Kigali"]
RATE = "unemployment rate = unemployed ÷ labour force × 100"
LF = "labour force = employed + unemployed"


def _pct(r: Fraction) -> tuple[str, list[str]]:
    s = f"{float(r):.1f}".rstrip("0").rstrip(".")
    forms = [s, f"{float(r):.1f}"]
    return s, forms + [f"{f}{u}" for f in forms for u in ("%", " %", " per cent", " percent")]


def _num(v: int, unit: str = "thousand") -> list[str]:
    return [str(v), frw(v), f"{v:,}", f"{v} {unit}", f"{frw(v)} {unit}", f"{v * 1000}", f"{v * 1000:,}",
            f"{v * 1000:,}".replace(",", " ")]


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    if p["kind"] == "districts":
        rows = {d: (e, u) for d, e, u in p["rows"]}
        rates = {d: _rate(u, e + u) for d, (e, u) in rows.items()}
        key, forms = _pct(rates[p["ask_rate"]])
        e, u = rows[p["ask_lf"]]
        best = max(rates, key=rates.get)
        most = max(rows, key=lambda d: rows[d][1])
        others = [d for d in rows if d not in (best, most)]
        return [
            short(f"{who} {rng.choice(VERBS)} these labour survey results {rng.choice(SETTINGS)}. The {LF}, and the {RATE}. "
                  f"What is the unemployment rate in {p['ask_rate']}, as a percentage?", key, forms),
            short(f"The {LF}. What is the labour force in {p['ask_lf']}, in thousands of people?", e + u, _num(e + u)),
            mcq(f"The {RATE}. Which district in this survey has the highest unemployment rate?", best, [most, *others], rng),
        ]
    rows, full = p["rows"], p["full"]
    bi, bj = next((i, j) for i, r in enumerate(rows) for j, v in enumerate(r) if v is None)
    what = {1: "labour force", 2: "number employed", 3: "number unemployed"}[bj]
    val = full[bi][bj]
    r_ask = next(r for r in rows if r[0] == p["ask_year"])
    key, forms = _pct(_rate(r_ask[3], r_ask[1]))
    rates = [_rate(r[3], r[1]) for r in full]
    d, wrong = rates[-1] - rates[0], rates[-1] - rates[-2]
    amt = lambda f: f"{float(abs(f)):.1f}".rstrip("0").rstrip(".")  # noqa: E731
    options = [f"It {way} by {amt(x)} percentage points" for way in ("rose", "fell") for x in (d, wrong)]
    way = "rose" if d > 0 else "fell"
    y0, y1 = rows[0][0], rows[-1][0]
    return [
        short(f"{who} {rng.choice(VERBS)} this table of an economy's labour force {rng.choice(SETTINGS)}. The {LF}. What is "
              f"the {what} in {full[bi][0]}, marked ?, in thousands?", val, _num(val)),
        short(f"The {RATE}. What was the unemployment rate in {p['ask_year']}, as a percentage?", key, forms),
        mcq(f"The {RATE}. How did the unemployment rate change between {y0} and {y1}?",
            f"It {way} by {amt(d)} percentage points", options, rng),
    ]
