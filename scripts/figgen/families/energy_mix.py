"""Energy mix (LS, UP; P6 geography): where an invented country's electricity, or an invented district's cooking fuel,
comes from, as the Rwanda S2-S6 power and energy units, IGCSE Environmental Management's "Energy resources" and the
IGCSE Geography theme on reducing carbon emissions teach it with charts. The places and numbers are invented.

Three sub-types:
- electricity: a pie chart of the electricity Country P generated in a year by source, each source marked renewable or
  non-renewable in the key, the total printed. The percentage from renewable sources, the gigawatt-hours from one
  source (amount = percentage × total ÷ 100, printed), a sector's angle (percentage × 3.6°, printed), and the
  non-renewable source that generated the most.
- cooking: a pie chart of the main cooking fuel of the households surveyed in District Q (firewood and charcoal the
  most used, as surveys in Rwanda find), the number surveyed printed.
  The percentage cooking with wood fuels (firewood or charcoal, so named in the stem), how many households use a fuel,
  the most used fuel, a sector's angle.
- growth: a grouped bar chart of the electricity Country P generated from each source in two years. The rise from one
  source, the source that grew the most, the total in the later year, and the source that generated the least then.

Every percentage is a multiple of 5 (so every angle is whole), every bar ends on a gridline, and every "which" leads
the next by 5 or more.
"""
from __future__ import annotations

import random

from ..core import NAMES, mcq, short
from ._geo_charts import fr, grouped_bars, num_forms, pct_forms, pie_chart

ID = "energy_mix"
KIND = "graph.pie"
SUBJECT = "geography"
BANDS = ("LS", "UP")
CONCEPTS = ("geography.renewable-energy", "geography.energy-production-factors", "geography.energy-importance",
            "geography.fossil-fuels")
# A topic whose sections the book lists is reached only if its name or a section names energy, power, fuel, or the
# economic activities.
NEEDS = r"energy|power|fuel|economic activit"
COUNTRY = "Country P"
DISTRICT = "District Q"
# Sources of electricity as textbooks class them.
RENEWABLE = {"Hydro-electric power": True, "Solar power": True, "Wind power": True, "Geothermal power": True,
             "Methane gas": False, "Peat": False, "Diesel": False, "Coal": False}
FUELS = ["Firewood", "Charcoal", "LPG gas", "Biogas", "Electricity", "Crop waste"]
WOOD = {"Firewood", "Charcoal"}
TOTALS = [400, 600, 800, 1000, 1200, 2000]
# A colour for each source and fuel, the same in every figure.
COLOUR = {"Hydro-electric power": "#2b6cb0", "Solar power": "#f6c344", "Wind power": "#9ecae1",
          "Geothermal power": "#e07b39", "Methane gas": "#9467bd", "Peat": "#8c6d46", "Diesel": "#9a9a9a",
          "Coal": "#4d4d4d", "Firewood": "#a0522d", "Charcoal": "#555555", "LPG gas": "#3182bd", "Biogas": "#5aa55a",
          "Electricity": "#f6c344", "Crop waste": "#c5b358"}
SURVEYED = [200, 400, 500, 600, 800, 1000]


def _split(rng: random.Random, n: int, lo: int = 5) -> list[int] | None:
    """n percentages, multiples of 5, each at least `lo`, adding to 100."""
    cuts = sorted(rng.sample(range(1, 20), n - 1))
    parts = [5 * (b - a) for a, b in zip([0] + cuts, cuts + [20])]
    return parts if min(parts) >= lo else None


def _leads(vals: dict, margin: int = 5) -> str | None:
    ranked = sorted(vals, key=vals.get, reverse=True)
    return ranked[0] if len(ranked) == 1 or vals[ranked[0]] - vals[ranked[1]] >= margin else None


def _electricity(rng: random.Random, band: str) -> dict | None:
    ren = rng.sample(["Hydro-electric power", "Solar power", "Wind power", "Geothermal power"], rng.randint(2, 3))
    non = rng.sample(["Methane gas", "Peat", "Diesel", "Coal"], rng.randint(2, 3))
    names = ren + non
    rng.shuffle(names)
    pct = _split(rng, len(names))
    if not pct:
        return None
    share = dict(zip(names, pct))
    if not _leads({n: share[n] for n in non}):
        return None
    total = rng.choice(TOTALS)
    exact = [n for n in names if share[n] * total % 100 == 0]
    return {"band": band, "sub": "electricity", "year": rng.randint(2016, 2023), "parts": [[n, share[n]] for n in names],
            "total": total, "ask": {"amount": rng.choice(exact), "angle": rng.choice(names)}}


def _cooking(rng: random.Random, band: str) -> dict | None:
    """Wood fuels first, as surveys in Rwanda find: firewood and charcoal together most of the households, the other
    fuels a few each."""
    others = rng.sample([f for f in FUELS if f not in WOOD], rng.randint(2, 4))
    wood = [5 * rng.randint(4, 12), 5 * rng.randint(3, 9)]
    left = 100 - sum(wood)
    if left < 5 * len(others) or left > 15 * len(others):
        return None
    rest = [5] * len(others)
    for _ in range((left - 5 * len(others)) // 5):
        i = rng.randrange(len(others))
        if rest[i] < 15:
            rest[i] += 5
    if sum(rest) != left:
        return None
    share = dict(zip(["Firewood", "Charcoal"] + others, wood + rest))
    if not _leads(share):
        return None
    names = list(share)
    rng.shuffle(names)
    n = rng.choice(SURVEYED)
    exact = [f for f in names if share[f] * n % 100 == 0]
    return {"band": band, "sub": "cooking", "parts": [[f, share[f]] for f in names], "surveyed": n,
            "ask": {"households": rng.choice(exact), "angle": rng.choice(names)}}


def _growth(rng: random.Random, band: str) -> dict | None:
    names = rng.sample(["Hydro-electric power", "Solar power", "Methane gas", "Peat", "Diesel", "Wind power"], 4)
    before = [20 * rng.randint(1, 12) for _ in names]
    after = [b + 20 * rng.randint(-2, 8) for b in before]
    if min(after) <= 0 or max(after) > 300:
        return None
    rise = {n: a - b for n, a, b in zip(names, after, before)}
    if not _leads(rise, 20) or sum(1 for v in rise.values() if v > 0) < 2:
        return None
    least = {n: -a for n, a in zip(names, after)}
    if not _leads(least, 20):
        return None
    y0 = rng.randint(2010, 2015)
    return {"band": band, "sub": "growth", "names": names, "years": [y0, y0 + 5], "before": before, "after": after,
            "ask": {"rise": rng.choice([n for n in names if rise[n] > 0])}}


def sample(rng: random.Random) -> dict:
    band = rng.choice(BANDS)
    sub = rng.choice(["electricity", "cooking", "growth"])
    make = {"electricity": _electricity, "cooking": _cooking, "growth": _growth}[sub]
    while True:
        p = make(rng, band)
        if p:
            return p


AMOUNT = "Amount = percentage × total ÷ 100"
ANGLE = "Angle of a sector = percentage × 3.6°"


def _label(name: str) -> str:
    return f"{name} ({'renewable' if RENEWABLE[name] else 'non-renewable'})"


def draw(p: dict):
    if p["sub"] == "electricity":
        fig, _ = pie_chart([[_label(n), v] for n, v in p["parts"]],
                           title=f"Electricity generated in {COUNTRY} in {p['year']}, by source",
                           notes=[f"Total electricity generated: {fr(p['total'])} GWh (gigawatt-hours)", AMOUNT, ANGLE],
                           size=(9.0, 5.2), colors=[COLOUR[n] for n, _ in p["parts"]])
        return fig
    if p["sub"] == "cooking":
        fig, _ = pie_chart(p["parts"], title=f"Main cooking fuel of households in {DISTRICT}",
                           notes=[f"Households surveyed: {fr(p['surveyed'])}", ANGLE], size=(8.0, 5.0),
                           colors=[COLOUR[n] for n, _ in p["parts"]])
        return fig
    y0, y1 = p["years"]
    top = max(p["before"] + p["after"]) + 40
    top -= top % 40
    fig, _ = grouped_bars(p["names"], {str(y0): p["before"], str(y1): p["after"]}, top=top, major=40, minor=20,
                          ylabel="Electricity generated (GWh)", xlabel="Source",
                          title=f"Electricity generated in {COUNTRY} from each source", colors=["#9ecae1", "#08519c"],
                          size=(8.4, 5.0), wrap_at=13, legend_title="Year")
    return fig


VERBS = ["studies", "reads", "looks at", "copies", "is given"]
SETTINGS = ["in a geography lesson", "for homework", "for a project on energy", "for a class test",
            "at the environment club", "while revising in Kigali", "for a lesson on power and energy",
            "on a revision card", "while revising in Rusizi", "for a debate on clean energy"]


def _gwh(v: int) -> list[str]:
    return num_forms(v, "GWh", "gigawatt-hours")


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    ask = p["ask"]
    if p["sub"] == "electricity":
        lead = f"{who} {rng.choice(VERBS)} this pie chart of {COUNTRY}'s electricity {rng.choice(SETTINGS)}."
        share = dict((n, v) for n, v in p["parts"])
        ren = sum(v for n, v in share.items() if RENEWABLE[n])
        a = ask["amount"]
        amount = share[a] * p["total"] // 100
        g = ask["angle"]
        angle = share[g] * 36 // 10
        non = {n: v for n, v in share.items() if not RENEWABLE[n]}
        top = max(non, key=non.get)
        return [
            short(f"{lead} What percentage of the electricity generated in {COUNTRY} in {p['year']} came from renewable "
                  "sources?", f"{ren}%", pct_forms(ren)),
            short(f"{AMOUNT}. How many GWh of electricity did {COUNTRY} generate from {a.lower()} in {p['year']}?",
                  amount, _gwh(amount)),
            short(f"{ANGLE}. What is the angle of the {g.lower()} sector in the pie chart of {COUNTRY}'s electricity?",
                  f"{angle}°", num_forms(angle, "°", "degrees")),
            mcq(f"Which non-renewable source generated the most electricity in {COUNTRY} in {p['year']}?", top,
                [n for n in share if n != top], rng),
        ]
    if p["sub"] == "cooking":
        lead = f"{who} {rng.choice(VERBS)} this pie chart of cooking fuels in {DISTRICT} {rng.choice(SETTINGS)}."
        share = dict((n, v) for n, v in p["parts"])
        wood = sum(v for n, v in share.items() if n in WOOD)
        f = ask["households"]
        homes = share[f] * p["surveyed"] // 100
        g = ask["angle"]
        angle = share[g] * 36 // 10
        top = max(share, key=share.get)
        return [
            short(f"{lead} What percentage of the households surveyed in {DISTRICT} cook mainly with wood fuels "
                  "(firewood or charcoal)?", f"{wood}%", pct_forms(wood)),
            short(f"Of the {fr(p['surveyed'])} households surveyed in {DISTRICT}, how many cook mainly with "
                  f"{f if f.startswith('LPG') else f.lower()}?", homes, num_forms(homes, "households")),
            mcq(f"Which cooking fuel do most households surveyed in {DISTRICT} use?", top,
                [n for n in share if n != top], rng),
            short(f"{ANGLE}. What is the angle of the {g if g.startswith('LPG') else g.lower()} sector in the pie chart "
                  f"of {DISTRICT}'s cooking fuels?", f"{angle}°", num_forms(angle, "°", "degrees")),
        ]
    lead = f"{who} {rng.choice(VERBS)} this bar chart of {COUNTRY}'s electricity {rng.choice(SETTINGS)}."
    names, before, after = p["names"], p["before"], p["after"]
    y0, y1 = p["years"]
    rise = {n: a - b for n, a, b in zip(names, after, before)}
    r = ask["rise"]
    best = max(rise, key=rise.get)
    total = sum(after)
    least = min(names, key=lambda n: after[names.index(n)])
    return [
        short(f"{lead} By how many GWh did {COUNTRY}'s electricity from {r.lower()} rise from {y0} to {y1}?", rise[r],
              _gwh(rise[r])),
        mcq(f"Which source's electricity output in {COUNTRY} grew the most from {y0} to {y1}?", best,
            [n for n in names if n != best], rng),
        short(f"How many GWh of electricity did {COUNTRY} generate from these four sources altogether in {y1}?", total,
              _gwh(total)),
        mcq(f"Which of the four sources generated the least electricity in {COUNTRY} in {y1}?", least,
            [n for n in names if n != least], rng),
    ]
