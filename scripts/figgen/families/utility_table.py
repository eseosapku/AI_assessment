"""Utility tables (UP, AL), for a student in Rwanda buying snacks (brochettes, mandazi, mangoes, cups of tea).

- UP: total and marginal utility of one good as more units are consumed, in utils, with two cells left blank. Asks
  the blanks (MU = the change in total utility from one more unit, stated) and the unit at which marginal utility
  first falls to zero or below. MU falls strictly at every unit, so that unit is one only.
- AL: the equi-marginal choice between two goods: the marginal utility of each of six units of each, with the two
  prices and the income printed. Asks which combination maximises total utility (spending all the income where
  MU ÷ price is the same for both goods, as the stem says) and the total utility it gives. Every other option is
  affordable too, with more of one good than the answer and less total utility, and two of them spend all the
  income as the answer does (P3y review: options the income could not buy let the budget alone decide). MU ÷ price falls strictly
  for each good, so one combination meets the rule; and trying every affordable combination finds the same one best.
"""
from __future__ import annotations

import random

from ..core import NAMES, mcq, short
from ._micro import ordinal
from .econ_tables import frw, titled_table

ID = "utility_table"
KIND = "business.document"
SUBJECT = "economics"
BANDS = ("UP", "AL")
CONCEPTS = ("economics.utility-diminishing-marginal-utility", "economics.consumer-theory",
            "economics.equimarginal-principle", "economics.consumer-equilibrium")
# A topic whose sections the book lists is reached only if its name or a section names utility or the equi-marginal
# principle.
NEEDS = r"utility|equi.?marginal|consumer equilibrium|consumer behaviour"
# IGCSE's decision makers (money, workers, firms) and the demand chapters share consumer concepts but teach no utility.
AVOID = r"decision makers|theory of demand|demand and supply|indifference|elasticit|market structure"

# plural, singular
GOODS = [("brochettes", "brochette"), ("mandazi", "mandazi"), ("mangoes", "mango"), ("cups of tea", "cup of tea"),
         ("bananas", "banana"), ("chapatis", "chapati"), ("glasses of juice", "glass of juice"), ("samosas", "samosa"),
         ("avocados", "avocado"), ("bottles of water", "bottle of water")]
PLACES = ["at school in Huye", "after football in Kigali", "at a market in Musanze", "on a trip to Rubavu",
          "at a canteen in Nyanza", "during a holiday in Karongi"]


def concepts_for(p: dict) -> tuple[str, ...]:
    """The equi-marginal principle and consumer equilibrium only where the figure shows a choice: at AS Level."""
    return CONCEPTS if p["kind"] == "choice" else CONCEPTS[:2]


def _sample_tu(rng: random.Random) -> dict:
    while True:
        n = rng.choice([6, 7, 8])
        first = rng.randint(4, n - 1)  # the first unit whose MU is zero or below
        mu = [rng.randint(18, 40)]
        for _ in range(n - 1):
            mu.append(mu[-1] - rng.randint(2, 9))
        if mu[first - 2] <= 0 or mu[first - 1] > 0 or mu[first - 1] < -6:
            continue
        cells = _blanks(rng, n)
        return {"band": "UP", "kind": "tu", "good": rng.randrange(len(GOODS)), "place": rng.choice(PLACES), "mu": mu,
                "blanks": cells}


def _blanks(rng: random.Random, n: int) -> list[list]:
    """A total and a marginal utility in different rows from the 2nd unit on, each worked out in one step: a TU from
    the TU above and its MU, an MU from its TU and the one above."""
    while True:
        r_tu, r_mu = rng.sample(range(2, n + 1), 2)
        if r_mu in (r_tu, r_tu + 1):  # the MU's row and the row above must show their TUs
            continue
        return sorted([["tu", r_tu], ["mu", r_mu]], key=lambda c: c[1])


def _ratios(rng: random.Random, at: int, star: int) -> list[int] | None:
    """Six values falling strictly, `star` at position `at` (1-based)."""
    up = [star]
    for _ in range(at - 1):
        up.append(up[-1] + rng.randint(1, 5))
    down = [star]
    for _ in range(6 - at):
        down.append(down[-1] - rng.randint(1, 4))
    vals = up[::-1] + down[1:]
    return vals if min(vals) >= 1 else None


def _best(mux, muy, px, py, income):
    """Every affordable bundle tried: the greatest total utility and where it is."""
    best, where = None, []
    for x in range(len(mux) + 1):
        for y in range(len(muy) + 1):
            if x * px + y * py <= income:
                u = sum(mux[:x]) + sum(muy[:y])
                if best is None or u > best:
                    best, where = u, [(x, y)]
                elif u == best:
                    where.append((x, y))
    return best, where


def _rivals(mux, muy, px, py, income, x, y) -> list[tuple[int, int]]:
    """The bundles a student might fairly pick instead of the best one: each affordable, each with more of one good
    than the best bundle (so "more of both" never picks the best), the ones spending most of the income first. Their
    total utility is less: the best bundle is the only one with the most."""
    out = [(i, j) for i in range(1, len(mux) + 1) for j in range(1, len(muy) + 1)
           if i * px + j * py <= income and (i > x or j > y) and (i, j) != (x, y)]
    return sorted(out, key=lambda b: (-(b[0] * px + b[1] * py), b))


def _sample_choice(rng: random.Random) -> dict:
    while True:
        gx, gy = rng.sample(range(len(GOODS)), 2)
        px, py = rng.sample([100, 200, 300, 400, 500], 2)
        x, y = rng.randint(2, 4), rng.randint(2, 4)
        star = rng.randint(5, 14)
        rx, ry = _ratios(rng, x, star), _ratios(rng, y, star)
        if not rx or not ry:
            continue
        mux, muy = [r * px // 100 for r in rx], [r * py // 100 for r in ry]
        income = x * px + y * py
        best, where = _best(mux, muy, px, py, income)
        rivals = _rivals(mux, muy, px, py, income, x, y)
        if where != [(x, y)] or max(mux + muy) > 99 or len(rivals) < 3 or                 sum(1 for i, j in rivals if i * px + j * py == income) < 2:
            continue  # two rivals spend all the income too, so "spends it all" alone cannot pick the answer
        return {"band": "AL", "kind": "choice", "goods": [gx, gy], "place": rng.choice(PLACES), "px": px, "py": py,
                "income": income, "mux": mux, "muy": muy}


def sample(rng: random.Random) -> dict:
    return _sample_choice(rng) if rng.random() < 0.5 else _sample_tu(rng)


def _num(v: int) -> str:
    return str(v) if v >= 0 else f"−{-v}"


def draw(p: dict):
    if p["kind"] == "tu":
        plural, singular = GOODS[p["good"]]
        hidden = {(c, k) for c, k in p["blanks"]}
        rows, tu = [["0", "0", "–"]], 0
        for k, m in enumerate(p["mu"], start=1):
            tu += m
            rows.append([str(k), "?" if ("tu", k) in hidden else _num(tu), "?" if ("mu", k) in hidden else _num(m)])
        heads = [f"Number of\n{plural}", "Total utility\n(utils)", "Marginal utility\n(utils)"]
        return titled_table(f"Utility from {plural}", heads, rows, ["c", "c", "c"],
                            [f"MU = change in total utility from one more {singular}"], least=1.5)
    (xs, x1), (ys, y1) = GOODS[p["goods"][0]], GOODS[p["goods"][1]]
    rows = [[str(k), str(a), str(b)] for k, (a, b) in enumerate(zip(p["mux"], p["muy"]), start=1)]
    heads = ["Unit", f"Marginal utility of\n{xs} (utils)", f"Marginal utility of\n{ys} (utils)"]
    notes = [f"Price of one {x1}: {frw(p['px'])} Frw    Price of one {y1}: {frw(p['py'])} Frw",
             f"Income to spend: {frw(p['income'])} Frw"]
    return titled_table(f"Marginal utility of {xs} and {ys}", heads, rows, ["c", "c", "c"], notes, least=1.0)


VERBS = ["studies", "is given", "copies", "looks at", "works from", "fills in"]
SETTINGS = ["in an economics lesson", "for homework", "on a revision card", "for a class test", "at the economics club",
            "before an exam"]


def _ask_tu(p: dict, cell: list, lead: str):
    plural, singular = GOODS[p["good"]]
    col, k = cell
    mu = p["mu"]
    value = sum(mu[:k]) if col == "tu" else mu[k - 1]
    where = f"total utility for {k} {plural}" if col == "tu" else f"marginal utility of the {ordinal(k)} {singular}"
    forms = [str(value), f"{value} utils"] + ([f"−{-value}", f"−{-value} utils"] if value < 0 else [])
    return short(f"{lead}MU = the change in total utility from one more {singular}. What is the missing {where}, in "
                 "utils?", value, forms)


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    if p["kind"] == "tu":
        plural, singular = GOODS[p["good"]]
        mu = p["mu"]
        first = next(k for k in range(1, len(mu) + 1) if mu[k - 1] <= 0)
        wrong = [k for k in (first - 1, first + 1, first - 2, first + 2) if 1 <= k <= len(mu)][:3]
        a, b = p["blanks"] if rng.random() < 0.5 else p["blanks"][::-1]
        return [
            _ask_tu(p, a, f"{who} {rng.choice(VERBS)} this table {rng.choice(SETTINGS)}. It shows the utility a student "
                          f"gets from {plural} {p['place']}. "),
            _ask_tu(p, b, f"A table shows the utility a student gets from {plural} {p['place']}. "),
            mcq(f"A table shows the utility a student gets from {plural} {p['place']}. At which {singular} does marginal "
                "utility first fall to zero or below?", f"The {ordinal(first)} {singular}", [f"The {ordinal(k)} {singular}" for k in wrong],
                rng),
        ]
    (xs, x1), (ys, y1) = GOODS[p["goods"][0]], GOODS[p["goods"][1]]
    mux, muy, px, py, income = p["mux"], p["muy"], p["px"], p["py"], p["income"]
    best, where = _best(mux, muy, px, py, income)
    x, y = where[0]

    def bundle(i, j):
        return f"{i} {xs if i != 1 else x1} and {j} {ys if j != 1 else y1}"

    rivals = _rivals(mux, muy, px, py, income, x, y)
    whole = [b for b in rivals if b[0] * px + b[1] * py == income]
    rest = [b for b in rivals if b not in whole]
    # two that spend all the income, as the answer does, and the one of the rest that spends most of it
    wrong = rng.sample(whole, 2) + (rest[:1] or [b for b in whole if b not in whole[:2]][:1])
    rule = (f"{who} has {frw(income)} Frw to spend on {xs} and {ys} at the prices shown, and spends it all on the "
            "combination where MU ÷ price is the same for both goods.")
    return [
        mcq(f"{who} {rng.choice(VERBS)} this table {p['place']}. {rule} Which combination of the two gives the greatest "
            "total utility?", bundle(x, y), [bundle(i, j) for i, j in wrong[:3]], rng),
        short(f"{who} spends exactly {frw(income)} Frw on {xs} ({frw(px)} Frw each) and {ys} ({frw(py)} Frw each), choosing "
              "the combination where MU ÷ price is the same for both goods. Total utility = the sum of the marginal "
              "utilities of the units bought. What total utility does this combination give, in utils?", best,
              [f"{best} utils"]),
    ]
