"""International trade tables (UP; AL by ALSO_BANDS), of two kinds.

Comparative advantage: what one worker in Rwanda and in a neighbour (Kenya, Uganda, Tanzania, Burundi) can make of two
goods in a week, either one or the other. The opportunity cost of one unit of a good in a country, in units of the
other; which pattern of specialisation comparative advantage gives (each country's good, two by two, so the figure
decides it); and which country has the absolute advantage in a good. The two countries' opportunity costs differ by a
quarter at least, and every one terminates (0.4, 1.25, 2.5), so the key is exact; now and then one country makes more
of both goods, so absolute and comparative advantage part company.

Terms of trade: an economy's export and import price indices over four years, the first the base year (both 100).
The terms of trade index in a year, export price index ÷ import price index × 100 (in each stem), always whole; whether
the terms of trade improved or worsened between two years (export prices may rise while the terms worsen); and the
year they were most favourable. Changes and the leading year differ by five points at least.
"""
from __future__ import annotations

import random
from fractions import Fraction

from ..core import NAMES, mcq, short
from .econ_tables import frw, titled_table

ID = "trade_tables"
KIND = "table.data"
SUBJECT = "economics"
BANDS = ("UP",)
ALSO_BANDS = {"UP": ("AL",)}  # Cambridge AS Level's chapter on comparative advantage, which teaches the terms of trade
COMPARATIVE = ("economics.absolute-and-comparative-advantage", "economics.international-trade-theories",
               "economics.free-trade-specialisation")
TOT = ("economics.terms-of-trade",)
CONCEPTS = COMPARATIVE + TOT
# A topic whose sections the book lists is reached only if one names what this figure teaches.
NEEDS = r"comparative|absolute advantage|terms of trade"

COUNTRIES = ["Kenya", "Uganda", "Tanzania", "Burundi"]
GOODS = [("coffee", "tea"), ("maize", "beans"), ("rice", "sugar"), ("bananas", "cassava"), ("Irish potatoes", "wheat")]
# Opportunity costs that terminate both ways round (to two decimal places at most), never 1.
RATIOS = [Fraction(n, d) for n, d in ((1, 5), (1, 4), (2, 5), (1, 2), (4, 5), (5, 4), (2, 1), (5, 2), (4, 1), (5, 1))]
TOTS = [t for t in range(70, 136, 5) if t != 100]


def concepts_for(p: dict) -> tuple[str, ...]:
    return COMPARATIVE if p["kind"] == "comparative" else TOT


def avoid_for(p: dict) -> str:
    """A chapter on the terms of trade alone is no place for an output table, nor a chapter on trade theories or
    protection for a terms of trade table; "Nigerian economy" is another country's."""
    return r"^terms of trade$|nigeria" if p["kind"] == "comparative" else r"theories|protectionism|nigeria"


def _comparative(rng: random.Random) -> dict:
    other = rng.choice(COUNTRIES)
    goods = list(rng.choice(GOODS))
    rng.shuffle(goods)
    while True:
        ra, rb = rng.sample(RATIOS, 2)
        if max(ra, rb) < min(ra, rb) * Fraction(5, 4):
            continue
        out = []
        for r in (ra, rb):
            firsts = [o for o in range(10, 81, 5) if (o * r).denominator == 1 and 10 <= o * r <= 80]
            if not firsts:
                break
            o1 = rng.choice(firsts)
            out.append([o1, int(o1 * r)])
        if len(out) < 2 or out[0][0] == out[1][0] or out[0][1] == out[1][1]:
            continue
        names = ["Rwanda", other] if rng.random() < 0.5 else [other, "Rwanda"]
        return {"band": "UP", "kind": "comparative", "countries": names, "goods": [[g, "kg"] for g in goods], "out": out,
                "ask": [rng.randrange(2), rng.randrange(2)], "abs_good": rng.randrange(2)}


def _tot(rng: random.Random) -> dict:
    base = rng.randint(2015, 2020)
    while True:
        rows = [[base, 100, 100]]
        m, last = 100, 100
        for i in range(1, 4):
            m += rng.randint(2, 15)  # import prices rise year on year; the terms of trade drift by 20 points at most
            ts = [t for t in TOTS if t * m % 100 == 0 and 70 <= t * m // 100 <= 190 and abs(t - last) <= 20]
            if not ts:
                break
            t = last = rng.choice(ts)
            rows.append([base + i, t * m // 100, m])
        if len(rows) < 4:
            continue
        tot = {y: Fraction(100 * x, mm) for y, x, mm in rows}
        best = sorted(tot.values(), reverse=True)
        if best[0] - best[1] < 5:
            continue
        pairs = [(a, b) for a in tot for b in tot if a < b and abs(tot[b] - tot[a]) >= 5]
        if not pairs:
            continue
        y0, y1 = rng.choice(pairs)
        return {"band": "UP", "kind": "tot", "base": base, "rows": rows, "ask_year": rng.choice([r[0] for r in rows[1:]]),
                "compare": [y0, y1]}


def sample(rng: random.Random) -> dict:
    return _comparative(rng) if rng.random() < 0.5 else _tot(rng)


def draw(p: dict):
    if p["kind"] == "comparative":
        (g1, u1), (g2, u2) = p["goods"]
        heads = ["Country", f"{g1.capitalize()}\n({u1})", f"{g2.capitalize()}\n({u2})"]
        rows = [[c, frw(o1), frw(o2)] for c, (o1, o2) in zip(p["countries"], p["out"])]
        return titled_table("Output of one worker in a week", heads, rows, ["l", "r", "r"],
                            ["Each worker makes either the one good or the other."], least=1.3)
    heads = ["Year", "Export price\nindex", "Import price\nindex"]
    rows = [[str(y), str(x), str(m)] for y, x, m in p["rows"]]
    return titled_table(f"Price indices of an economy ({p['base']} = 100)", heads, rows, ["c", "r", "r"], least=1.4)


VERBS = ["studies", "is given", "copies", "looks at", "works from"]
SETTINGS = ["in an economics lesson", "for homework", "on a revision card", "for a class test", "at the economics club",
            "before a mock exam", "in a study group in Huye", "while revising in Kigali"]
TOT_RULE = "Terms of trade = export price index ÷ import price index × 100."


def _dec(f: Fraction) -> str:
    return f"{float(f):.4f}".rstrip("0").rstrip(".")


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    if p["kind"] == "comparative":
        (ca, cb), ((g1, u1), (g2, u2)) = p["countries"], p["goods"]
        out = dict(zip(p["countries"], p["out"]))
        ci, gi = p["ask"]
        c, g, other = p["countries"][ci], [g1, g2][gi], [g1, g2][1 - gi]
        oc = Fraction(out[c][1 - gi], out[c][gi])
        key = _dec(oc)
        forms = [key, f"{key} kg", f"{key} kg of {other}"] + ([f"{oc.numerator}/{oc.denominator}"] if oc.denominator > 1 else [])
        # comparative advantage in the first good: the lower opportunity cost of it
        a_first = Fraction(out[ca][1], out[ca][0]) < Fraction(out[cb][1], out[cb][0])
        pattern = lambda a, b: f"{ca} makes {a}; {cb} makes {b}"  # noqa: E731
        options = [pattern(a, b) for a in (g1, g2) for b in (g1, g2)]
        right = pattern(g1, g2) if a_first else pattern(g2, g1)
        ag = [g1, g2][p["abs_good"]]
        leader = ca if out[ca][p["abs_good"]] > out[cb][p["abs_good"]] else cb
        return [
            short(f"{who} {rng.choice(VERBS)} this table of output {rng.choice(SETTINGS)}. With the same resources, each "
                  f"country can make either good. What is the opportunity cost of 1 kg of {g} in {c}, in kg of {other}?",
                  key, forms),
            mcq("Each country should specialise in the good it makes at the lower opportunity cost (its comparative "
                "advantage). Which pattern of specialisation should the two countries follow?", right, options, rng),
            mcq(f"Which country has the absolute advantage in {ag}?", leader, [ca, cb, "Neither country"], rng),
        ]
    tot = {y: Fraction(100 * x, m) for y, x, m in p["rows"]}
    y = p["ask_year"]
    y0, y1 = p["compare"]
    best = max(tot, key=tot.get)
    years = [str(r[0]) for r in p["rows"]]
    return [
        short(f"{who} {rng.choice(VERBS)} these price indices {rng.choice(SETTINGS)}. {TOT_RULE} What is the terms of "
              f"trade index in {y}?", int(tot[y]), [str(int(tot[y]))]),
        mcq(f"{TOT_RULE} Between {y0} and {y1}, did the terms of trade improve or worsen?",
            "They improved" if tot[y1] > tot[y0] else "They worsened", ["They improved", "They worsened",
                                                                        "They stayed the same"], rng),
        mcq(f"{TOT_RULE} In which year were the terms of trade most favourable (highest)?", str(best), years, rng),
    ]
