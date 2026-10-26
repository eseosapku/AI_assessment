"""Trade balance (LS, UP; P6 geography): an invented country's exports and imports, as the Rwanda S3 "Transport,
Communication and Trade in Africa", S4 "Transport, Communication and Trade in Rwanda" and S6 "Trade and Commerce in
the World" units teach trade with data.

Two sub-types:
- balance: a grouped bar chart of Country P's exports and imports (million US$) in five years, with balance of trade =
  exports − imports printed. How far imports were above exports in a year of deficit, the year of the biggest
  deficit, the number of years with a surplus, and the exports over the five years.
- exports: a pie chart of what Country P exported in a year (coffee, tea, minerals, fruit and vegetables, hides and
  skins, pyrethrum), with the total printed. The value of one export (value = percentage × total ÷ 100, printed), the
  share of the two drinks crops (coffee and tea, named in the stem), a sector's angle, and the main export.

Every value sits on a gridline or is printed; every "which" is clear by a gridline or more.
"""
from __future__ import annotations

import random

from ..core import NAMES, count, mcq, short
from ._geo_charts import fr, grouped_bars, num_forms, pct_forms, pie_chart

ID = "trade_balance"
KIND = "graph.bar"
SUBJECT = "geography"
BANDS = ("LS", "UP")
CONCEPTS = ("geography.trade-commerce", "geography.international-trade")
# A topic whose sections the book lists is reached only if its name or a section names trade, commerce or exports.
NEEDS = r"trade|commerce|export"
# A regional survey or the rise of industry shares trade as a concept, but teaches places and factories.
AVOID = r"regional geography|industriali"
COUNTRY = "Country P"
EXPORTS = ["Coffee", "Tea", "Minerals", "Fruit and vegetables", "Hides and skins", "Pyrethrum"]
COLOUR = {"Coffee": "#6f4e37", "Tea": "#5aa55a", "Minerals": "#8c8c8c", "Fruit and vegetables": "#f28e2b",
          "Hides and skins": "#c9a26b", "Pyrethrum": "#f6e27a"}
TOTALS = [400, 600, 800, 1000, 1200]


def _balance(rng: random.Random, band: str) -> dict | None:
    start = rng.randint(2010, 2018)
    exports = [50 * rng.randint(4, 12) for _ in range(5)]
    imports = [e + 50 * rng.randint(-3, 5) for e in exports]
    bal = [e - i for e, i in zip(exports, imports)]
    if 0 in bal or sum(1 for b in bal if b < 0) < 2 or max(imports) > 800:
        return None
    worst = sorted(b for b in bal if b < 0)
    if len(worst) > 1 and worst[1] - worst[0] < 50:
        return None
    deficits = [k for k in range(5) if bal[k] < 0]
    return {"band": band, "sub": "balance", "years": [start + k for k in range(5)], "exports": exports,
            "imports": imports, "ask": {"deficit": rng.choice(deficits)}}


def _exports(rng: random.Random, band: str) -> dict | None:
    names = rng.sample(EXPORTS, rng.randint(4, 6))
    if "Coffee" not in names or "Tea" not in names:
        return None
    cuts = sorted(rng.sample(range(1, 20), len(names) - 1))
    pct = [5 * (b - a) for a, b in zip([0] + cuts, cuts + [20])]
    if min(pct) < 5:
        return None
    ranked = sorted(pct, reverse=True)
    if ranked[0] - ranked[1] < 5:
        return None
    total = rng.choice(TOTALS)
    exact = [n for n, v in zip(names, pct) if v * total % 100 == 0]
    return {"band": band, "sub": "exports", "year": rng.randint(2016, 2023), "parts": [list(x) for x in zip(names, pct)],
            "total": total, "ask": {"value": rng.choice(exact), "angle": rng.choice(names)}}


def sample(rng: random.Random) -> dict:
    band = rng.choice(BANDS)
    sub = rng.choice(["balance", "exports"])
    while True:
        p = (_balance if sub == "balance" else _exports)(rng, band)
        if p:
            return p


BALANCE = "Balance of trade = exports − imports"
VALUE = "Value = percentage × total ÷ 100"
ANGLE = "Angle of a sector = percentage × 3.6°"


def draw(p: dict):
    if p["sub"] == "balance":
        top = -(-(max(p["exports"] + p["imports"]) + 50) // 200) * 200
        fig, _ = grouped_bars([str(y) for y in p["years"]], {"Exports": p["exports"], "Imports": p["imports"]}, top=top,
                              major=100, minor=50, ylabel="Value (million US$)", xlabel="Year",
                              title=f"{COUNTRY}'s exports and imports", notes=[BALANCE],
                              colors=["#2b6cb0", "#e07b39"], size=(8.2, 5.2))
        return fig
    fig, _ = pie_chart(p["parts"], title=f"{COUNTRY}'s exports in {p['year']}",
                       notes=[f"Total value of exports: {fr(p['total'])} million US$", VALUE, ANGLE], size=(8.4, 5.0),
                       colors=[COLOUR[n] for n, _ in p["parts"]])
    return fig


VERBS = ["studies", "reads", "looks at", "copies", "is given"]
SETTINGS = ["in a geography lesson", "for homework", "for a project on trade", "for a class test",
            "at the geography club", "while revising in Kigali", "for a lesson on international trade",
            "on a revision card", "while revising in Rubavu", "for a debate on exports"]


def _musd(v: int) -> list[str]:
    forms = num_forms(v, "million US$", "million", "million dollars")
    for b in num_forms(v):
        for f in (f"US${b} million", f"${b} million", f"US$ {b} million"):
            if f not in forms:
                forms.append(f)
    return forms


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    if p["sub"] == "balance":
        lead = f"{who} {rng.choice(VERBS)} this bar chart of {COUNTRY}'s trade {rng.choice(SETTINGS)}."
        years, ex, im = p["years"], p["exports"], p["imports"]
        bal = [e - i for e, i in zip(ex, im)]
        k = p["ask"]["deficit"]
        worst = min(range(5), key=lambda y: bal[y])
        surplus = sum(1 for b in bal if b > 0)
        return [
            short(f"{lead} {BALANCE}. By how many million US$ were {COUNTRY}'s imports greater than its exports in "
                  f"{years[k]}?", -bal[k], _musd(-bal[k])),
            mcq(f"In which year did {COUNTRY} have its biggest trade deficit (imports greater than exports)?",
                str(years[worst]), [str(y) for i, y in enumerate(years) if i != worst], rng),
            count(f"In how many of the five years did {COUNTRY} have a trade surplus (exports greater than imports)?",
                  surplus, "years"),
            short(f"What was the total value of {COUNTRY}'s exports in the five years {years[0]} to {years[-1]}, in "
                  "million US$?", sum(ex), _musd(sum(ex))),
        ]
    lead = f"{who} {rng.choice(VERBS)} this pie chart of {COUNTRY}'s exports {rng.choice(SETTINGS)}."
    share = {n: v for n, v in p["parts"]}
    a = p["ask"]["value"]
    value = share[a] * p["total"] // 100
    drinks = share["Coffee"] + share["Tea"]
    g = p["ask"]["angle"]
    top = max(share, key=share.get)
    return [
        short(f"{lead} {VALUE}. What was the value of {COUNTRY}'s {a.lower()} exports in {p['year']}, in million US$?",
              value, _musd(value)),
        short(f"What percentage of {COUNTRY}'s exports in {p['year']} were coffee and tea together?", f"{drinks}%",
              pct_forms(drinks)),
        short(f"{ANGLE}. What is the angle of the {g.lower()} sector in the pie chart of {COUNTRY}'s exports?",
              f"{share[g] * 18 // 5}°", num_forms(share[g] * 18 // 5, "°", "degrees")),
        mcq(f"Which product earned {COUNTRY} the most from exports in {p['year']}?", top,
            [n for n in share if n != top], rng),
    ]
