"""Development indicators (UP): a table for four fictional countries, P, Q, R and S (no real country's statistics are
invented), as the IGCSE, Rwanda S6, NERDC and WAEC books compare countries' development.

Four sub-types, each a table of four or five indicators:
- human: GNI, population, life expectancy, adult literacy and the HDI. GNI per capita of a country (GNI ÷ population,
  stated), which country has the highest GNI per capita (never the largest economy, so reading the GNI column is the
  wrong way), how many years longer people live in one country than another, the highest or lowest HDI.
- farming: workers, the share of workers in farming, farming's share of GDP and the maize yield. Which country is most
  dependent on farming by its workers (never the country where farming's share of GDP is highest), how many people
  work in farming (formula stated), the gap between two yields and the highest yield.
- industry: industry's share of GDP ten years apart, total exports and the share of manufactured goods in them. The
  rise in one country's share, which country industrialised fastest (never the most industrialised), the value of
  manufactured exports (formula stated) and the most industrialised country.
- aid: GNI, population, aid received and life expectancy. Aid per person, which country received the most aid per
  person (never the one receiving the most aid), aid as a percentage of GNI, GNI per capita (formulas stated).

Every answer asked is whole or exact to one decimal place, and every "which country" leads the next by a clear margin.
"""
from __future__ import annotations

import random
from fractions import Fraction

from ..core import NAMES, mcq, short
from .econ_tables import frw, titled_table

ID = "development_indicators"
KIND = "table.data"
SUBJECT = "economics"
BANDS = ("UP",)
BASE = ("economic-development", "human-development", "economic-growth-vs-development", "underdevelopment")
MORE = {"human": ("education-development",), "farming": ("agricultural-development",),
        "industry": ("industrial-development",), "aid": ("foreign-aid", "development-planning")}
CONCEPTS = tuple(f"economics.{c}" for c in BASE + tuple(c for cs in MORE.values() for c in cs))
# Rwanda's Entrepreneurship S5 teaches the indicators of socio-economic development under business.
ALSO = ("business.socio-economic-development",)
# A topic whose sections the book lists is reached only if its name or a section names development or its measures.
NEEDS = r"develop|indicator|GNI|HDI|living standard|poverty"
AVOID = r"population|role of work|nigeria"
# The S6 strategy chapters are reached only by the sub-type whose table shows what they teach: agriculture's by the
# farming table, industry's by the industry table, and education and foreign aid (Development Strategies) by the aid one.
AVOID_MORE = {"human": r"|agricultur|industr|strateg", "farming": r"|industr|strateg", "industry": r"|agricultur|strateg",
              "aid": r"|agricultur|industr"}
COUNTRIES = ["P", "Q", "R", "S"]
KINDS = ["human", "farming", "industry", "aid"]


def concepts_for(p: dict) -> tuple[str, ...]:
    return tuple(f"economics.{c}" for c in BASE + MORE[p["kind"]])


def avoid_for(p: dict) -> str:
    return AVOID + AVOID_MORE[p["kind"]]


def _leads(vals: dict, margin) -> str | None:
    """The country whose value is highest by at least `margin` over the next; None if none leads so clearly."""
    ranked = sorted(vals, key=vals.get, reverse=True)
    return ranked[0] if vals[ranked[0]] - vals[ranked[1]] >= margin else None


def _trails(vals: dict, margin) -> str | None:
    ranked = sorted(vals, key=vals.get)
    return ranked[0] if vals[ranked[1]] - vals[ranked[0]] >= margin else None


def _ranked(rng: random.Random, bands: list[tuple[int, int]]) -> list[int]:
    """One value from each band, lowest band first: an indicator that rises with a country's development."""
    return [rng.randint(lo, hi) for lo, hi in bands]


def _human(rng: random.Random) -> dict | None:
    pcs = sorted(rng.sample(range(6, 121), 4))  # GNI per capita in hundreds of US$, poorest first
    pops = [rng.randint(4, 60) for _ in range(4)]
    life = _ranked(rng, [(52, 59), (58, 65), (64, 71), (70, 79)])
    lit = _ranked(rng, [(45, 62), (60, 76), (74, 88), (86, 99)])
    hdi = _ranked(rng, [(430, 500), (510, 590), (600, 690), (700, 850)])
    order = rng.sample(COUNTRIES, 4)
    rows = {c: {"gni": pc * pop, "pop": pop, "life": lf, "lit": lt, "hdi": h}
            for c, pc, pop, lf, lt, h in zip(order, pcs, pops, life, lit, hdi)}
    pc = {c: Fraction(r["gni"] * 100, r["pop"]) for c, r in rows.items()}
    best = _leads(pc, max(pc.values()) / 10)
    if not best or len({r["gni"] for r in rows.values()}) < 4 or best == _leads({c: r["gni"] for c, r in rows.items()}, 1):
        return None
    if len({r["life"] for r in rows.values()}) < 4 or not _leads({c: r["hdi"] for c, r in rows.items()}, 10) \
            or not _trails({c: r["hdi"] for c, r in rows.items()}, 10):
        return None
    x, y = rng.sample(COUNTRIES, 2)
    if rows[x]["life"] < rows[y]["life"]:
        x, y = y, x
    return {"rows": rows, "ask": {"pc": rng.choice(COUNTRIES), "life": [x, y], "hdi": rng.choice(["high", "low"])}}


def _farming(rng: random.Random) -> dict | None:
    farm = sorted(rng.sample(range(20, 81), 4), reverse=True)  # most farm workers in the least developed
    rows = {}
    order = rng.sample(COUNTRIES, 4)
    gdp = _ranked(rng, [(28, 45), (20, 34), (12, 24), (5, 14)])
    yields = _ranked(rng, [(8, 16), (14, 24), (20, 32), (28, 45)])
    for c, f, gd, yd in zip(order, farm, gdp, yields):
        rows[c] = {"workers": rng.randint(3, 30), "farm": f, "farm_gdp": gd, "yield": yd}
    # a country whose farmers are a smaller share can still earn farming a bigger share of GDP
    second = order[1]
    rows[second]["farm_gdp"] = max(r["farm_gdp"] for r in rows.values()) + rng.randint(1, 4)
    shares = {c: r["farm"] for c, r in rows.items()}
    if not _leads(shares, 3) or _leads(shares, 3) == _leads({c: r["farm_gdp"] for c, r in rows.items()}, 1):
        return None
    if not _leads({c: r["yield"] for c, r in rows.items()}, 2) or len({r["yield"] for r in rows.values()}) < 4:
        return None
    whole = [c for c, r in rows.items() if r["workers"] * r["farm"] % 10 == 0]
    if not whole:
        return None
    x, y = rng.sample(COUNTRIES, 2)
    if rows[x]["yield"] < rows[y]["yield"]:
        x, y = y, x
    if rows[x]["yield"] - rows[y]["yield"] < 3:
        return None
    return {"rows": rows, "ask": {"workers": rng.choice(whole), "yield": [x, y]}}


def _industry(rng: random.Random) -> dict | None:
    rows = {}
    for c in COUNTRIES:
        a = rng.randint(10, 34)
        rows[c] = {"ind_a": a, "ind_b": a + rng.randint(-4, 12), "exports": rng.randint(20, 300), "manuf": rng.randint(5, 60)}
    rise = {c: r["ind_b"] - r["ind_a"] for c, r in rows.items()}
    top = _leads(rise, 2)
    most = _leads({c: r["ind_b"] for c, r in rows.items()}, 2)
    if not top or not most or top == most or rise[top] <= 0:
        return None
    risers = [c for c in COUNTRIES if rise[c] > 0]
    whole = [c for c, r in rows.items() if r["exports"] * r["manuf"] % 100 == 0]
    if len(risers) < 2 or not whole:
        return None
    year = rng.randint(2008, 2012)
    return {"rows": rows, "years": [year, year + 10], "ask": {"rise": rng.choice(risers), "exports": rng.choice(whole)}}


def _aid(rng: random.Random) -> dict | None:
    rows = {}
    for c in COUNTRIES:
        pop, pc, per = rng.randint(4, 40), rng.randint(5, 30), rng.randint(10, 120)  # pc in hundreds of US$
        rows[c] = {"gni": pc * pop, "pop": pop, "aid": per * pop, "life": rng.randint(50, 75)}
    per = {c: Fraction(r["aid"], r["pop"]) for c, r in rows.items()}
    best = _leads(per, 8)
    if not best or len({r["aid"] for r in rows.values()}) < 4 or best == _leads({c: r["aid"] for c, r in rows.items()}, 1):
        return None
    exact = [c for c, r in rows.items() if r["aid"] * 10 % r["gni"] == 0]
    if not exact:
        return None
    x = rng.choice(exact)
    return {"rows": rows, "ask": {"per": rng.choice(COUNTRIES), "share": x,
                                  "pc": rng.choice([c for c in COUNTRIES if c != x])}}


def sample(rng: random.Random) -> dict:
    kind = rng.choice(KINDS)
    make = {"human": _human, "farming": _farming, "industry": _industry, "aid": _aid}[kind]
    while True:
        got = make(rng)
        if got:
            return {"band": "UP", "kind": kind, **got}


def _one(v: int) -> str:
    return f"{v / 10:.1f}"


def draw(p: dict):
    kind, rows = p["kind"], p["rows"]
    if kind == "human":
        heads = ["Country", "GNI\n(billion US$)", "Population\n(millions)", "Life expectancy\n(years)",
                 "Adult literacy\n(%)", "HDI"]
        cells = lambda r: [_one(r["gni"]), frw(r["pop"]), frw(r["life"]), frw(r["lit"]), f"0.{r['hdi']:03d}"]  # noqa: E731
    elif kind == "farming":
        heads = ["Country", "Workers\n(millions)", "Workers in\nfarming (%)", "Farming's share\nof GDP (%)",
                 "Maize yield\n(tonnes per hectare)"]
        cells = lambda r: [frw(r["workers"]), frw(r["farm"]), frw(r["farm_gdp"]), _one(r["yield"])]  # noqa: E731
    elif kind == "industry":
        ya, yb = p["years"]
        heads = ["Country", f"Industry's share\nof GDP, {ya} (%)", f"Industry's share\nof GDP, {yb} (%)",
                 f"Total exports,\n{yb} (billion US$)", f"Manufactured goods,\n{yb} (% of exports)"]
        cells = lambda r: [frw(r["ind_a"]), frw(r["ind_b"]), _one(r["exports"]), frw(r["manuf"])]  # noqa: E731
    else:
        heads = ["Country", "GNI\n(billion US$)", "Population\n(millions)", "Aid received\n(million US$)",
                 "Life expectancy\n(years)"]
        cells = lambda r: [_one(r["gni"]), frw(r["pop"]), frw(r["aid"]), frw(r["life"])]  # noqa: E731
    body = [[f"Country {c}"] + cells(rows[c]) for c in COUNTRIES]
    return titled_table("Development indicators for four countries", heads, body, ["l"] + ["r"] * (len(heads) - 1),
                        least=1.1)


VERBS = ["studies", "is given", "copies", "looks at", "works from"]
SETTINGS = ["in an economics lesson", "for homework", "on a revision card", "for a class test", "at the economics club",
            "before a mock exam", "in a study group in Huye", "while revising in Kigali"]
PC = "GNI per capita = GNI ÷ population."


def _usd(v: int) -> list[str]:
    n = [str(v), frw(v), f"{v:,}"]
    return n + [f"US${x}" for x in n] + [f"${x}" for x in n] + [f"{x} US$" for x in n] + [f"{x} US dollars" for x in n]


def _dec(f: Fraction, *units: str) -> tuple[str, list[str]]:
    s = f"{float(f):.1f}".rstrip("0").rstrip(".")
    forms = [s, f"{float(f):.1f}"]
    return s, forms + [f"{x} {u}" for x in forms for u in units]


def _countries(key: str, rng: random.Random) -> list:
    return [f"Country {c}" for c in COUNTRIES if c != key]


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    kind, rows, ask = p["kind"], p["rows"], p["ask"]
    opening = f"{who} {rng.choice(VERBS)} this table of development indicators for four countries {rng.choice(SETTINGS)}. "
    if kind in ("human", "aid"):
        pc = {c: r["gni"] * 100 // r["pop"] for c, r in rows.items()}
    if kind == "human":
        c = ask["pc"]
        best = max(pc, key=pc.get)
        x, y = ask["life"]
        hdi = {k: r["hdi"] for k, r in rows.items()}
        word = "highest" if ask["hdi"] == "high" else "lowest"
        want = max(hdi, key=hdi.get) if ask["hdi"] == "high" else min(hdi, key=hdi.get)
        gap = rows[x]["life"] - rows[y]["life"]
        return [
            short(f"{opening}{PC} What is the GNI per capita of Country {c}, in US$?", pc[c], _usd(pc[c])),
            mcq(f"{PC} Which country in the table has the highest GNI per capita?", f"Country {best}",
                _countries(best, rng), rng),
            short(f"How many years longer is life expectancy in Country {x} than in Country {y}?", gap,
                  [f"{gap} years", f"{gap} year"]),
            mcq(f"Which country in the table ranks {word} on the Human Development Index (HDI)?", f"Country {want}",
                _countries(want, rng), rng),
        ]
    if kind == "farming":
        shares = {k: r["farm"] for k, r in rows.items()}
        best = max(shares, key=shares.get)
        c = ask["workers"]
        key, forms = _dec(Fraction(rows[c]["workers"] * rows[c]["farm"], 100), "million", "million people")
        x, y = ask["yield"]
        ykey, yforms = _dec(Fraction(rows[x]["yield"] - rows[y]["yield"], 10), "tonnes", "tonnes per hectare", "t/ha")
        top = max(rows, key=lambda k: rows[k]["yield"])
        return [
            mcq(f"{opening}Which country is most dependent on farming, judged by the share of its workers in farming?",
                f"Country {best}", _countries(best, rng), rng),
            short("Farm workers = workers × share of workers in farming ÷ 100. How many people in Country "
                  f"{c} work in farming, in millions?", key, forms),
            short(f"By how many tonnes per hectare is the maize yield in Country {x} higher than in Country {y}?", ykey, yforms),
            mcq("Which country's farmers grow the most maize per hectare?", f"Country {top}", _countries(top, rng), rng),
        ]
    if kind == "industry":
        ya, yb = p["years"]
        rise = {k: r["ind_b"] - r["ind_a"] for k, r in rows.items()}
        c = ask["rise"]
        top = max(rise, key=rise.get)
        most = max(rows, key=lambda k: rows[k]["ind_b"])
        e = ask["exports"]
        key, forms = _dec(Fraction(rows[e]["exports"] * rows[e]["manuf"], 1000), "billion", "billion US$")
        return [
            short(f"{opening}By how many percentage points did industry's share of GDP in Country {c} rise between {ya} "
                  f"and {yb}?", rise[c], [f"{rise[c]} percentage points", f"{rise[c]} points", f"{rise[c]}%"]),
            mcq(f"In which country did industry's share of GDP rise the most between {ya} and {yb}?", f"Country {top}",
                _countries(top, rng), rng),
            short("Manufactured exports = total exports × share of manufactured goods in exports ÷ 100. What was the value "
                  f"of Country {e}'s manufactured exports in {yb}, in billion US$?", key, forms),
            mcq(f"Which country was the most industrialised in {yb}, judged by industry's share of GDP?", f"Country {most}",
                _countries(most, rng), rng),
        ]
    per = {k: r["aid"] // r["pop"] for k, r in rows.items()}
    c, x, y = ask["per"], ask["share"], ask["pc"]
    best = max(per, key=per.get)
    key, forms = _dec(Fraction(rows[x]["aid"], rows[x]["gni"]), "%", "per cent", "percent")
    forms += [f"{v}%" for v in forms if not v.endswith(("%", "cent"))]
    return [
        short(f"{opening}Aid per person = aid received ÷ population. How much aid per person did Country {c} receive, in "
              "US$?", per[c], _usd(per[c])),
        mcq("Aid per person = aid received ÷ population. Which country received the most aid per person?",
            f"Country {best}", _countries(best, rng), rng),
        short("Aid as a percentage of GNI = aid received ÷ GNI × 100, where 1 billion = 1 000 million. What was aid as a "
              f"percentage of GNI in Country {x}?", key, forms),
        short(f"{PC} What is the GNI per capita of Country {y}, in US$?", pc[y], _usd(pc[y])),
    ]
