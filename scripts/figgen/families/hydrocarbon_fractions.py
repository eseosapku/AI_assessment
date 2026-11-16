"""Crude oil fractions and the alkanes' boiling points (LS, UP), for Rwanda S2 "Properties of Organic Compounds and Uses
of Alkanes", S3 "Petroleum products and polymerisation" and IGCSE "Petrochemicals and polymers". Two kinds:

- column: a fractionating column, crude oil vapour from a furnace entering at the bottom; six outlets lettered, each with
  the column's temperature at that level printed, and a table of the fractions by name (carbon atoms per molecule,
  boiling range), its rows in a shuffled order. Each printed temperature lies inside one fraction's boiling range, so a
  letter is matched to a fraction through the table. Asks which letter collects a named fraction, which lettered
  fraction has the largest molecules, how many carbon atoms the largest molecules collected at a letter have.
- boiling: the boiling points of six to eight alkanes in a row of the homologous series plotted against the number of
  carbon atoms, each value printed by its point (data-book values); "a substance above its boiling point is a gas" and
  "every alkane shown melts below 0 °C" printed. Asks how many are gases at a temperature, the difference between two
  boiling points, the state of one alkane at a temperature.
"""
from __future__ import annotations

import random

from matplotlib.patches import Polygon, Rectangle

from ..core import GRID, INK, NAMES, mcq, new_figure, short
from ._bio_parts import letter_choice

ID = "hydrocarbon_fractions"
KIND = "chem.structure"
SUBJECT = "chemistry"
BANDS = ("LS", "UP")
CONCEPTS = tuple(f"chemistry.{c}" for c in ("crude-oil-fractionation", "separation-techniques", "alkanes", "homologous-series"))
# A topic whose sections the book lists is reached only if one names crude oil, its refining, the alkanes' properties
# or the homologous series.
NEEDS = (r"crude oil|petroleum|petrochemical|refin|fraction|fuels?\b|alkanes|homologous|hydrocarbon")
AVOID = (r"glossary|thinking and working scientifically|amine|benzene|halogeno|carbonyl|alcohol|carboxylic|ester|"
         r"aldehyde|polymers and polymerization$|^chapter 12: polymers$|biological|enthalp|energetics|reactions of organic|rates?\b")


def concepts_for(p: dict) -> tuple[str, ...]:
    """The column teaches fractional distillation; the graph teaches a homologous series' boiling points."""
    c = "chemistry."
    if p["kind"] == "column":
        return (c + "crude-oil-fractionation", c + "separation-techniques")
    return (c + "alkanes", c + "homologous-series")


# The fractions as a school textbook tables them: name, carbon atoms per molecule, boiling range (°C), the column's
# temperature where it is drawn off (inside its range). The gases leave at the top, the residue at the bottom.
FRACTIONS = [("refinery gas", "1 to 4", "below 30", 25),
             ("petrol (gasoline)", "5 to 10", "30 to 110", 70),
             ("naphtha", "8 to 12", "110 to 180", 145),
             ("kerosene (paraffin)", "10 to 16", "180 to 260", 220),
             ("diesel oil", "14 to 20", "260 to 340", 300),
             ("fuel oil", "20 to 30", "340 to 400", 370),
             ("bitumen", "more than 30", "above 400", 420)]
SIX = [0, 1, 3, 4, 5, 6]  # naphtha is left out of the six-outlet column some books draw; the other six drawn
# Boiling points of the alkanes (°C), as data books print them.
ALKANES = [("methane", -162), ("ethane", -89), ("propane", -42), ("butane", -1), ("pentane", 36), ("hexane", 69),
           ("heptane", 98), ("octane", 126), ("nonane", 151), ("decane", 174)]
LETTER_SETS = ["ABCDEF", "PQRSTU", "JKLMNO", "UVWXYZ"]


def sample(rng: random.Random) -> dict:
    band = rng.choice(BANDS)
    if rng.random() < 0.5:
        rows = SIX if rng.random() < 0.5 else [0, 1, 2, 3, 4, 6]
        order = rows[:]
        rng.shuffle(order)
        letters = list(rng.choice(LETTER_SETS))
        rng.shuffle(letters)  # not in alphabetical order down the column, or the order would give the answers away
        return {"band": band, "kind": "column", "outlets": [[L, k] for L, k in zip(letters, rows)], "table": order,
                "ask": rng.choice(rows), "big": rng.sample(rows, 3), "carbon": rng.choice([k for k in rows if k != 6])}
    n = rng.randint(6, 8)
    first = rng.randint(1, 10 - n + 1)
    shown = list(range(first, first + n))
    temps = [t for t in (0, 20, 25, 40, 50, 60, 80, 100) if any(ALKANES[c - 1][1] < t for c in shown)
             and any(ALKANES[c - 1][1] > t for c in shown)]
    a, b = rng.sample(shown, 2)
    one = rng.choice(shown)
    t_state = rng.choice([t for t in (0, 20, 25, 30, 50, 60, 80, 100, 120, 150) if abs(ALKANES[one - 1][1] - t) >= 8])
    return {"band": band, "kind": "boiling", "carbons": shown, "gas_at": rng.choice(temps), "pair": sorted([a, b]),
            "state": [one, t_state]}


# --- drawing --------------------------------------------------------------------------------------------------------

def _draw_column(p: dict):
    fig, ax = new_figure(8.6, 6.6)
    outlets = p["outlets"]
    n = len(outlets)
    top, bottom = 8.6, 1.4
    ax.add_patch(Rectangle((1.6, bottom), 1.8, top - bottom, facecolor="#eef1f3", edgecolor=INK, linewidth=1.6))
    ys = [top - 0.5 - k * (top - bottom - 1.0) / (n - 1) for k in range(n)]
    for k, ((L, idx), y) in enumerate(zip(outlets, ys)):
        if 0 < k < n - 1:
            ax.plot([1.6, 3.4], [y - 0.35, y - 0.35], color=INK, linewidth=0.8, gid=f"tray:{k}")
        ax.plot([3.4, 4.3], [y, y], color=INK, linewidth=1.4, gid=f"pipe:{L}")
        ax.add_patch(Polygon([(4.3, y + 0.12), (4.55, y), (4.3, y - 0.12)], closed=True, facecolor=INK, edgecolor=INK))
        ax.text(5.0, y, L, ha="center", va="center", fontsize=13, fontweight="bold", gid=f"outlet:{L}",
                bbox=dict(boxstyle="circle,pad=0.2", facecolor="white", edgecolor=INK, linewidth=1.0))
        temp = FRACTIONS[idx][3]
        ax.text(1.45, y, f"{temp} °C", ha="right", va="center", fontsize=10, gid=f"temp:{L}")
    # the furnace and the crude oil coming in
    ax.add_patch(Rectangle((0.2, 0.2), 1.2, 0.8, facecolor="#f2c9a5", edgecolor=INK, linewidth=1.2))
    ax.text(0.8, 0.6, "furnace", ha="center", va="center", fontsize=9.5)
    ax.plot([1.4, 2.5, 2.5], [0.6, 0.6, bottom], color=INK, linewidth=1.4, gid="feed")
    ax.text(2.7, 0.75, "crude oil vapour in", ha="left", va="center", fontsize=9.5)
    ax.text(2.5, top + 0.3, "fractionating column", ha="center", va="bottom", fontsize=10)
    # the table of fractions, by name, rows shuffled
    x0, y0 = 5.8, 7.9
    cols = [x0, x0 + 3.1, x0 + 5.5]
    ax.text(cols[0], y0 + 0.7, "Fraction", fontsize=10, fontweight="bold", va="center")
    ax.text(cols[1], y0 + 0.7, "Carbon atoms\nper molecule", fontsize=10, fontweight="bold", va="center")
    ax.text(cols[2], y0 + 0.7, "Boiling range\n(°C)", fontsize=10, fontweight="bold", va="center")
    ax.plot([x0 - 0.1, x0 + 7.6], [y0 + 0.2, y0 + 0.2], color=INK, linewidth=1.0, gid="table-rule")
    for r, idx in enumerate(p["table"]):
        name, carbons, rng_, _ = FRACTIONS[idx]
        y = y0 - 0.25 - r * 0.62
        ax.text(cols[0], y, name, fontsize=10, va="center", gid=f"row:{idx}")
        ax.text(cols[1], y, carbons, fontsize=10, va="center")
        ax.text(cols[2], y, rng_, fontsize=10, va="center")
    ax.set_xlim(0, 13.6)
    ax.set_ylim(0, 9.4)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def _draw_boiling(p: dict):
    shown = p["carbons"]
    fig, ax = new_figure(7.2, 5.4)
    bps = [ALKANES[c - 1][1] for c in shown]
    lo = (min(bps) - 30) // 20 * 20
    hi = (max(bps) + 40) // 20 * 20
    ax.set_ylim(lo, hi)
    ax.set_yticks(range(lo, hi + 1, 20))
    ax.set_xlim(shown[0] - 0.6, shown[-1] + 0.8)
    ax.set_xticks(shown)
    ax.set_xticklabels([f"{c}\n{ALKANES[c - 1][0]}" for c in shown], fontsize=9)
    ax.grid(True, color=GRID, linewidth=0.6)
    ax.set_axisbelow(True)
    ax.plot(shown, bps, color=INK, linewidth=1.5, gid="curve")
    ax.plot(shown, bps, "o", color=INK, markersize=5, gid="points")
    for c, b in zip(shown, bps):
        ax.text(c + 0.12, b - 0.04 * (hi - lo), f"{b} °C".replace("-", "−"), ha="left", va="top", fontsize=9.5,
                gid=f"bp:{c}")
    ax.axhline(0, color=INK, linewidth=0.8)
    ax.set_xlabel("Number of carbon atoms in one molecule", fontsize=10.5)
    ax.set_ylabel("Boiling point (°C)", fontsize=10.5)
    ax.set_title("Boiling points of some alkanes\nAbove its boiling point a substance is a gas.\n"
                 "Every alkane shown melts below 0 °C.", fontsize=10)
    ax.tick_params(axis="y", labelsize=9.5)
    return fig


def draw(p: dict):
    return _draw_column(p) if p["kind"] == "column" else _draw_boiling(p)


# --- questions ------------------------------------------------------------------------------------------------------

SETTINGS = {"LS": ["in a Senior 2 chemistry lesson", "in a Senior 3 lesson on fuels", "at the science club in Muhanga",
                    "for homework", "while revising in Huye", "for a class test in Kigali"],
            "UP": ["in a chemistry lesson", "at the science club in Rubavu", "for homework", "while revising in Musanze",
                   "for a class test in Kigali", "in a lesson on petrochemicals"]}
VERBS = ["studied", "copied", "was shown", "drew"]


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    setting = rng.choice(SETTINGS[p["band"]])
    if p["kind"] == "column":
        at = {idx: L for L, idx in p["outlets"]}
        letters = sorted(at.values())
        name = FRACTIONS[p["ask"]][0]
        big = max(p["big"])  # further down the column, the bigger the molecules (by the table)
        big_letters = sorted(at[k] for k in p["big"])
        L = at[p["carbon"]]
        most = FRACTIONS[p["carbon"]][1].split()[-1]
        return [letter_choice(f"{who} {rng.choice(VERBS)} this fractionating column {setting}. Using the temperatures and "
                              f"the table, which letter shows where {name} is collected?", at[p["ask"]], letters),
                letter_choice(f"Which of the fractions collected at {', '.join(big_letters[:-1])} and {big_letters[-1]} has "
                              f"the largest molecules?", at[big], big_letters),
                short(f"What is the greatest number of carbon atoms in a molecule of the fraction collected at {L}?", most,
                      [most, f"{most} carbon atoms", f"{most} atoms"])]
    bp = {c: ALKANES[c - 1][1] for c in p["carbons"]}
    t = p["gas_at"]
    gases = sum(1 for v in bp.values() if v < t)
    a, b = p["pair"]
    one, t2 = p["state"]
    key = "gas" if bp[one] < t2 else "liquid"
    na, nb, n1 = ALKANES[a - 1][0], ALKANES[b - 1][0], ALKANES[one - 1][0]
    return [short(f"{who} {rng.choice(VERBS)} this graph {setting}. How many of the alkanes shown are gases at {t} °C?",
                  gases, [f"{gases} alkanes", f"{gases} gases"]),
            short(f"What is the difference between the boiling points of {na} and {nb}, in °C?", abs(bp[b] - bp[a]),
                  [f"{abs(bp[b] - bp[a])} °C", f"{abs(bp[b] - bp[a])}°C", f"{abs(bp[b] - bp[a])} degrees"]),
            mcq(f"Is {n1} a solid, a liquid or a gas at {t2} °C?", key, ["solid", "liquid", "gas"], rng)]
