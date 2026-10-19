"""Population in economics (UP): tables and rates as Rwanda's Economics S5 "Population" works them, for a fictional
Country P or Q and Regions P to S (no real country's figures are invented). The population pyramid is geography's
(population_pyramid); this family draws the tables.

Three sub-types:
- ages: the population aged 0-14, 15-64 and 65 and over, in thousands, in four census years. The dependency ratio in
  a year, with (aged 0-14 + aged 65 and over) ÷ aged 15-64 × 100 stated; the year it was highest (never the year with
  the most children, so reading one column is the wrong way); the percentage aged 65 and over in a year.
- rates: birth and death rates per 1 000 people over five years. The natural increase rate in a year, with
  (birth rate - death rate) ÷ 10 stated; the year the population grew fastest (never the year of the highest birth
  rate); how far the death rate fell.
- density: four regions' population and area. A region's density (population ÷ area, stated), the most densely
  populated region (never the most populous) and how many more people per km² live in one region than another.

Every asked ratio or percentage is exact to one decimal place, and every "which year" or "which region" leads clearly.
"""
from __future__ import annotations

import random
from fractions import Fraction
from math import gcd

from ..core import NAMES, mcq, short
from .econ_tables import frw, titled_table

ID = "population_economics"
KIND = "table.data"
SUBJECT = "economics"
BANDS = ("UP",)
SUB = {"ages": ("population", "population-structure"), "rates": ("population", "demographic-transition"),
       "density": ("population",)}
CONCEPTS = tuple(sorted({f"economics.{c}" for cs in SUB.values() for c in cs}))
# A topic whose sections the book lists is reached only if its name or a section names population.
NEEDS = r"population|demograph|dependency"
AVOID = r"nigeria"
KINDS = ["ages", "rates", "density"]
REGIONS = ["Region P", "Region Q", "Region R", "Region S"]


def concepts_for(p: dict) -> tuple[str, ...]:
    return tuple(f"economics.{c}" for c in SUB[p["kind"]])


def _ages(rng: random.Random) -> dict | None:
    first = rng.choice([1980, 1985, 1990])
    years = [first + 10 * i for i in range(4)]
    peak = rng.randrange(4)
    top = rng.randint(170, 200) * 5  # dependency ratio in tenths of a per cent, a multiple of 0.5
    ratios = [top - 5 * sum(rng.randint(6, 18) for _ in range(abs(i - peak))) for i in range(4)]
    work = [10 * rng.randint(200, 500)]
    for _ in range(3):
        work.append(work[-1] + 10 * (work[-1] * rng.randint(15, 30) // 1000))  # 15% to 30% more a decade
    i1, i3 = rng.sample(range(4), 2)
    work[i1] = 200 * (work[i1] // 200)  # a ratio of whole halves of a per cent comes out exact on this row
    if any(b <= a for a, b in zip(work, work[1:])):
        return None
    dep = [w * r // 1000 for w, r in zip(work, ratios)]
    olds = [round(d * (0.06 + 0.03 * i + rng.random() * 0.03)) for i, d in enumerate(dep)]
    # the percentage aged 65 and over on row i3: the number old a multiple of total ÷ gcd(total, 1000)
    total = work[i3] + dep[i3]
    step = total // gcd(total, 1000)
    want = olds[i3]
    near = [k * step for k in (want // step, want // step + 1) if 0.6 * want <= k * step <= 1.4 * want and k > 0]
    if not near:
        return None
    olds[i3] = near[0]
    rows = [[y, d - o, w, o] for y, d, w, o in zip(years, dep, work, olds)]
    ratio = [Fraction(100 * (r[1] + r[3]), r[2]) for r in rows]
    best = max(range(4), key=lambda i: ratio[i])
    if sorted(ratio)[-1] - sorted(ratio)[-2] < 1 or best == max(range(4), key=lambda i: rows[i][1]):
        return None
    if (ratio[i1] * 10).denominator != 1 or min(r[1] for r in rows) <= 0:
        return None
    return {"rows": rows, "ask": [years[i1], years[i3]], "country": "P"}


def _rates(rng: random.Random) -> dict | None:
    first = rng.choice([1990, 1995, 2000])
    step = rng.choice([5, 6])
    births = [rng.randint(42, 48)]
    deaths = [rng.randint(17, 24)]
    for _ in range(4):
        births.append(births[-1] - rng.randint(0, 4))
        deaths.append(max(6, deaths[-1] - rng.randint(1, 6)))
    years = [first + step * i for i in range(5)]
    gap = [b - d for b, d in zip(births, deaths)]
    ranked = sorted(gap, reverse=True)
    fast = gap.index(ranked[0])
    if ranked[0] - ranked[1] < 2 or births.count(max(births)) > 1 or fast == births.index(max(births)):
        return None
    if deaths[0] <= deaths[-1]:
        return None
    rows = [[y, b, d] for y, b, d in zip(years, births, deaths)]
    return {"rows": rows, "ask": rng.choice([y for y in years if y != years[fast]]), "country": "Q"}


def _density(rng: random.Random) -> dict | None:
    dens = [10 * rng.randint(5, 90) for _ in range(4)]
    areas = [100 * rng.randint(4, 60) for _ in range(4)]
    rows = [[r, d * a // 1000, a] for r, d, a in zip(REGIONS, dens, areas)]
    ranked = sorted(dens, reverse=True)
    best = dens.index(ranked[0])
    most = max(range(4), key=lambda i: rows[i][1])
    if ranked[0] < ranked[1] * Fraction(11, 10) or best == most or len({r[1] for r in rows}) < 4:
        return None
    x, y = rng.sample(range(4), 2)
    if dens[x] < dens[y]:
        x, y = y, x
    if dens[x] == dens[y]:
        return None
    return {"rows": rows, "ask": [REGIONS[rng.randrange(4)], REGIONS[x], REGIONS[y]]}


def sample(rng: random.Random) -> dict:
    kind = rng.choice(KINDS)
    make = {"ages": _ages, "rates": _rates, "density": _density}[kind]
    while True:
        got = make(rng)
        if got:
            return {"band": "UP", "kind": kind, **got}


def draw(p: dict):
    kind, rows = p["kind"], p["rows"]
    if kind == "ages":
        heads = ["Year", "Aged 0–14\n(thousands)", "Aged 15–64\n(thousands)", "Aged 65 and over\n(thousands)"]
        body = [[str(r[0])] + [frw(v) for v in r[1:]] for r in rows]
        return titled_table(f"Population of Country {p['country']} by age group", heads, body, ["c", "r", "r", "r"],
                            least=1.3)
    if kind == "rates":
        heads = ["Year", "Birth rate\n(per 1 000 people)", "Death rate\n(per 1 000 people)"]
        body = [[str(r[0])] + [frw(v) for v in r[1:]] for r in rows]
        return titled_table(f"Birth and death rates in Country {p['country']}", heads, body, ["c", "r", "r"], least=1.3)
    heads = ["Region", "Population\n(thousands)", "Area\n(km²)"]
    body = [[r[0], frw(r[1]), frw(r[2])] for r in rows]
    return titled_table("Population and area of four regions", heads, body, ["l", "r", "r"], least=1.3)


VERBS = ["studies", "is given", "copies", "looks at", "works from"]
SETTINGS = ["in an economics lesson", "for homework", "on a revision card", "for a class test", "at the economics club",
            "before a mock exam", "in a study group in Huye", "while revising in Kigali"]
DEP = "Dependency ratio = (aged 0–14 + aged 65 and over) ÷ aged 15–64 × 100."
NIR = "Natural increase rate (%) = (birth rate − death rate) ÷ 10."
DENSITY = "Population density = population ÷ area."


def _pct(f: Fraction) -> tuple[str, list[str]]:
    s = f"{float(f):.1f}".rstrip("0").rstrip(".")
    forms = [s, f"{float(f):.1f}"]
    return s, forms + [f"{x}{u}" for x in forms for u in ("%", " %", " per cent", " percent")]


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    kind, rows = p["kind"], p["rows"]
    about = {"ages": f"Country {p.get('country')}'s population by age group", "rates": f"birth and death rates in Country "
             f"{p.get('country')}", "density": "the population and area of four regions"}[kind]
    opening = f"{who} {rng.choice(VERBS)} this table of {about} {rng.choice(SETTINGS)}. "
    if kind == "ages":
        by = {r[0]: r[1:] for r in rows}
        ratio = {y: Fraction(100 * (v[0] + v[2]), v[1]) for y, v in by.items()}
        y1, y3 = p["ask"]
        best = max(ratio, key=ratio.get)
        key, forms = _pct(ratio[y1])
        old, oforms = _pct(Fraction(100 * by[y3][2], sum(by[y3])))
        return [
            short(f"{opening}{DEP} What was the dependency ratio in {y1}?", key, forms[:2] + [f"{key} dependants per 100"]),
            mcq(f"{DEP} In which year was the dependency ratio highest?", str(best), [str(y) for y in by if y != best], rng),
            short(f"What percentage of the population of Country {p['country']} was aged 65 and over in {y3}?", old, oforms),
        ]
    if kind == "rates":
        by = {r[0]: r[1:] for r in rows}
        y = p["ask"]
        key, forms = _pct(Fraction(by[y][0] - by[y][1], 10))
        gap = {k: b - d for k, (b, d) in by.items()}
        fast = max(gap, key=gap.get)
        born = max(by, key=lambda k: by[k][0])
        others = [born] + rng.sample([k for k in by if k not in (fast, born)], 2)
        y0, yn = rows[0][0], rows[-1][0]
        fall = by[y0][1] - by[yn][1]
        return [
            short(f"{opening}{NIR} What was the natural increase rate in {y}, as a percentage?", key, forms),
            mcq(f"{NIR} In which year was the population of Country {p['country']} growing fastest by natural increase?",
                str(fast), [str(k) for k in others], rng),
            short(f"By how much did the death rate in Country {p['country']} fall between {y0} and {yn}, in deaths per "
                  "1 000 people?", fall, [f"{fall} per 1 000", f"{fall} per 1000", f"{fall} deaths"]),
        ]
    dens = {r[0]: r[1] * 1000 // r[2] for r in rows}
    z, x, y = p["ask"]
    best = max(dens, key=dens.get)
    unit = ["people per km²", "people per km2", "per km²", "per km2", "people per square kilometre"]
    return [
        short(f"{opening}{DENSITY} What is the population density of {z}, in people per km²?", dens[z],
              [f"{dens[z]} {u}" for u in unit]),
        mcq(f"{DENSITY} Which region is the most densely populated?", best, [r for r in REGIONS if r != best], rng),
        short(f"{DENSITY} How many more people per km² live in {x} than in {y}?", dens[x] - dens[y],
              [f"{dens[x] - dens[y]} {u}" for u in unit]),
    ]
