"""Budgets against actual results (UP, AL) and cost behaviour (AL), as Cambridge AS & A Level Business ("Budgets",
"Costs") and Rwanda S4 Entrepreneurship ("Financial Management") set them. Two sub-types:

- variance (UP, AL): a Rwandan business's budget and actual figures for a month (sales revenue, materials, labour,
  overheads, sometimes electricity), with one row's variance worked as an example and the rest left "?"; the convention
  is printed: favourable (F) when actual sales are higher than budget or actual costs lower, adverse (A) otherwise.
  Asks one row's variance in Frw, which of four options (two amounts by favourable/adverse) describes another row's
  variance, and which describes the total profit variance (the wrong amount is the variances added up regardless of
  side). Sides are mixed, so those two amounts always differ.
- costs (AL): a table of five monthly costs at two outputs (two fixed, two variable, one semi-variable), with the three
  kinds defined under it. Asks which of four costs is fixed, variable or semi-variable (exactly one option of that
  kind), the semi-variable cost's variable cost per unit (formula in the stem), and the total cost at a third output.

Every amount is whole francs; every name is two words sharing no word with another, so no option stands apart.
"""
from __future__ import annotations

import random

from ..core import NAMES, mcq, money, short
from .econ_tables import frw, titled_table

ID = "budget_variance"
KIND = "business.document"
SUBJECT = "business"
BANDS = ("UP", "AL")
CONCEPTS = ("business.budgeting-and-forecasting", "business.costs-and-revenue")
# A topic whose sections the book lists is reached only if its name or a section names what this figure teaches.
NEEDS = r"budget|variance|financial management|costs"
# Listed without sections and sharing budgeting, but teaching sources of finance (JAMB/WAEC Commerce "Finance").
AVOID = r"^finance$"


def concepts_for(p: dict) -> tuple[str, ...]:
    return ("business.budgeting-and-forecasting",) if p["kind"] == "variance" else ("business.costs-and-revenue",)


def avoid_for(p: dict) -> str:
    """The AS Level chapters list no sections and share budgeting and costs widely (cash flow, business finance,
    marketing planning): an AL budget serves "Budgets" alone, and an AL cost table "Costs" alone."""
    if p["band"] == "UP":
        return AVOID
    return r"^(?!.*Budgets)" if p["kind"] == "variance" else r"^(?!.*Costs \(A Level\))"


FIRMS = ["a bakery in Huye", "a tailoring workshop in Kigali", "a juice factory in Rwamagana",
         "a furniture workshop in Musanze", "a hotel in Rubavu", "a printing business in Muhanga",
         "a dairy in Nyagatare", "a coffee roaster in Nyamasheke"]
MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October",
          "November", "December"]
# Each cost's share of budgeted sales, as a range of percentages.
COSTS = [("Materials", 25, 40), ("Labour", 15, 25), ("Overheads", 5, 12)]
EXTRA = ("Electricity", 2, 6)

# Cost behaviour: (the maker, its unit, the unit's plural)
MAKERS = [("a juice factory in Rwamagana", "bottle", "bottles"), ("a brick maker in Bugesera", "brick", "bricks"),
          ("a soap factory in Rubavu", "bar", "bars"), ("a bakery in Huye", "loaf", "loaves"),
          ("a shoe factory in Kigali", "pair", "pairs"), ("a printing business in Muhanga", "book", "books")]
FIXED = ["Factory rent", "Fire insurance", "Manager salary", "Loan interest", "Security guards"]
VARIABLE = ["Raw materials", "Packing boxes", "Piece wages", "Sales commission"]
SEMI = ["Electricity supply", "Telephone service", "Van running", "Machine upkeep", "Water supply"]
OUTPUTS = [(1_000, 2_000), (2_000, 3_000), (2_000, 4_000), (4_000, 6_000), (5_000, 8_000), (3_000, 5_000)]


def _signed(item: str, budget: int, actual: int) -> int:
    """A variance as profit sees it: positive when favourable."""
    return actual - budget if item == "Sales revenue" else budget - actual


def sample(rng: random.Random) -> dict:
    kind = rng.choices(["variance", "costs"], weights=[3, 1])[0]
    if kind == "variance":
        band = rng.choices(["UP", "AL"], weights=[3, 2])[0]
        while True:
            sales = rng.randrange(2_000_000, 10_000_001, 100_000)
            rows = [["Sales revenue", sales]]
            for name, lo, hi in COSTS + ([EXTRA] if rng.random() < 0.4 else []):
                rows.append([name, sales * rng.randint(lo, hi) // 100 // 10_000 * 10_000])
            for r in rows:  # actual within about a quarter of budget, to the nearest 5 000
                r.append(r[1] + rng.choice([-1, 1]) * max(1, r[1] * rng.randint(2, 25) // 100 // 5_000) * 5_000)
            signed = [_signed(*r) for r in rows]
            sizes = [abs(v) for v in signed]
            if len(set(sizes)) < len(sizes) or all(v > 0 for v in signed) or all(v < 0 for v in signed):
                continue
            profit = sum(signed)
            if profit == 0 or abs(profit) in sizes:
                continue
            return {"band": band, "kind": kind, "firm": rng.choice(FIRMS),
                    "period": f"{rng.choice(MONTHS)} {rng.choice([2024, 2025])}", "rows": rows,
                    "example": rng.randrange(len(rows))}
    maker, unit, units = rng.choice(MAKERS)
    while True:
        q1, q2 = rng.choice(OUTPUTS)
        rows = [[n, v, v] for n, v in ((n, rng.randrange(100_000, 900_001, 10_000)) for n in rng.sample(FIXED, 2))]
        rows += [[n, r * q1, r * q2] for n, r in ((n, rng.randrange(50, 801, 10)) for n in rng.sample(VARIABLE, 2))]
        semi, part, rate = rng.choice(SEMI), rng.randrange(50_000, 300_001, 10_000), rng.randrange(10, 201, 5)
        rows.append([semi, part + rate * q1, part + rate * q2])
        if len({r[1] for r in rows}) < 5:
            continue
        rng.shuffle(rows)
        q3 = rng.choice([q for q in range(q1 // 2, q2 + q1 + 1, 500) if q not in (q1, q2) and q > 0])
        return {"band": "AL", "kind": kind, "firm": maker, "unit": unit, "units": units, "outputs": [q1, q2],
                "rows": rows, "ask": q3}


def _side(item: str, budget: int, actual: int) -> str:
    return "favourable" if _signed(item, budget, actual) > 0 else "adverse"


def draw(p: dict):
    if p["kind"] == "variance":
        body = []
        for i, (item, b, a) in enumerate(p["rows"]):
            if i == p["example"]:
                body.append([item, frw(b), frw(a), frw(abs(a - b)), "F" if _side(item, b, a) == "favourable" else "A"])
            else:
                body.append([item, frw(b), frw(a), "?", "?"])
        notes = ["Favourable (F): actual sales higher than budget, or actual costs lower than budget.",
                 "Adverse (A): actual sales lower than budget, or actual costs higher than budget.",
                 "Profit = sales revenue − all the costs."]
        return titled_table(f"Budget and actual results of {p['firm']}, {p['period']}",
                            ["Item", "Budget (Frw)", "Actual (Frw)", "Variance (Frw)", "F or A"], body,
                            ["l", "r", "r", "r", "c"], notes=notes)
    q1, q2 = p["outputs"]
    body = [[n, frw(c1), frw(c2)] for n, c1, c2 in p["rows"]]
    notes = ["Fixed cost: the same at both outputs.", "Variable cost: rises in proportion to output.",
             "Semi-variable cost: rises with output, but not in proportion (it has a fixed part)."]
    return titled_table(f"Monthly costs of {p['firm']}", ["Cost", f"At {frw(q1)} {p['units']}\n(Frw)",
                                                          f"At {frw(q2)} {p['units']}\n(Frw)"], body,
                        ["l", "r", "r"], notes=notes)


VERBS = ["checks", "analyses", "is given", "reviews", "prepares notes on", "explains"]
SETTINGS = ["for the owner", "for a business studies lesson", "for a board meeting", "for the finance manager",
            "for homework", "before the next budget is set"]


def _pair(size: int, wrong: int, rng: random.Random, key_side: str) -> tuple[str, list[str]]:
    """Two amounts by two sides: every option differs from two others by one thing, so none stands in the middle."""
    other = "adverse" if key_side == "favourable" else "favourable"
    key = f"{frw(size)} Frw {key_side}"
    return key, [f"{frw(size)} Frw {other}", f"{frw(wrong)} Frw {key_side}", f"{frw(wrong)} Frw {other}"]


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    if p["kind"] == "variance":
        rows = p["rows"]
        open_rows = [i for i in range(len(rows)) if i != p["example"]]
        a, b = rng.sample(open_rows, 2)
        item, bud, act = rows[a]
        size = abs(act - bud)
        first = short(f"{who} {rng.choice(VERBS)} the budget report of {p['firm']} for {p['period']} "
                      f"{rng.choice(SETTINGS)}. What is the variance for {item.lower()}, in Frw?", size, money(size))
        item2, bud2, act2 = rows[b]
        size2 = abs(act2 - bud2)
        # the wrong amount is another row's variance: the row misread (every row's variance differs)
        wrong2 = rng.choice([abs(r[2] - r[1]) for i, r in enumerate(rows) if i != b])
        key, others = _pair(size2, wrong2, rng, _side(item2, bud2, act2))
        second = mcq(f"In the {p['period']} budget report of {p['firm']}, which describes the {item2.lower()} variance?",
                     key, others, rng)
        signed = [_signed(*r) for r in rows]
        profit = sum(signed)
        lump = sum(abs(v) for v in signed)
        key, others = _pair(abs(profit), lump, rng, "favourable" if profit > 0 else "adverse")
        third = mcq(rng.choice([f"Which describes the total profit variance of {p['firm']} for {p['period']}?",
                                f"For {p['firm']} in {p['period']}, which describes the total profit variance?"]),
                    key, others, rng)
        return [first, second, third]
    q1, q2 = p["outputs"]
    kinds = {}
    for n, c1, c2 in p["rows"]:
        kinds[n] = "fixed" if c1 == c2 else "variable" if c2 * q1 == c1 * q2 else "semi-variable"
    want = rng.choice(["fixed", "variable", "semi-variable"])
    key = rng.choice([n for n in kinds if kinds[n] == want])
    others = [n for n in kinds if kinds[n] != want]
    rng.shuffle(others)
    semi, s1, s2 = next(r for r in p["rows"] if kinds[r[0]] == "semi-variable")
    rate = (s2 - s1) // (q2 - q1)
    q3 = p["ask"]
    total = sum(c1 + (c2 - c1) // (q2 - q1) * (q3 - q1) for _, c1, c2 in p["rows"])
    return [
        mcq(f"{who} {rng.choice(VERBS)} the monthly costs of {p['firm']} {rng.choice(SETTINGS)}. "
            f"Which of these costs is {want}?", key, others[:3], rng),
        short(f"Variable cost per unit = change in cost ÷ change in output. What is the variable cost per {p['unit']} "
              f"in the {semi.lower()} cost of {p['firm']}, in Frw?", rate, money(rate)),
        short(f"Each cost of {p['firm']} changes at the same rate per {p['unit']} as it does between the two outputs "
              f"shown. What is the total cost of making {frw(q3)} {p['units']} in a month, in Frw?", total, money(total)),
    ]
