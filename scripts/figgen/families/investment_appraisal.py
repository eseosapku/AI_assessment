"""Investment appraisal of one project (AL), as Cambridge AS & A Level Accounting 9706 chapter 39 and Business 9609
set it: a table of the project's initial cost in Year 0 and its net cash flows for four or five years, with the
discount factors at a printed rate beside them, for a Rwandan business buying a machine or a vehicle.

Asks the payback period in years and months, the accounting rate of return (ARR = average annual profit ÷ initial
cost × 100, the average annual profit being the total net cash flows less the initial cost, over the years; the
formula is in the stem) and the net present value (the flows times their factors, less the initial cost). The
figures are chosen so the payback falls on a whole month, the ARR is exact to one decimal place and the net present
value is whole francs. The payback is a choice of two years by two months (a year too many; the months of the year
left rather than used), so it cannot be told from the options alone.
"""
from __future__ import annotations

import random
from fractions import Fraction

from ..core import NAMES, mcq, money, short
from .econ_tables import titled_table, frw

ID = "investment_appraisal"
KIND = "business.document"
SUBJECT = "accounting"
BANDS = ("AL",)
CONCEPTS = ("accounting.investment-appraisal",)
ALSO = ("business.investment-appraisal",)  # AS & A Level Business and Rwanda's Entrepreneurship books teach it too
# A topic whose sections the book lists is reached only if one names investment appraisal or one of its methods.
NEEDS = r"investment appraisal|payback|net present value|discounted cash|discounting|accounting rate of return"
# The AS Business book's chapters were cut apart badly: its "Business structure" chapter lists a payback table among
# its sections, and "Business finance" (sources of finance) carries the concept. Only a topic named for investment
# appraisal teaches it.
AVOID = r"^(?!.*(investment|appraisal))|staff|consumption"

FACTORS = {5: ["0.952", "0.907", "0.864", "0.823", "0.784"], 8: ["0.926", "0.857", "0.794", "0.735", "0.681"],
           10: ["0.909", "0.826", "0.751", "0.683", "0.621"], 12: ["0.893", "0.797", "0.712", "0.636", "0.567"],
           15: ["0.870", "0.756", "0.658", "0.572", "0.497"]}
# (what is bought, who buys it, the size of a year's net cash flow in hundreds of thousands of francs)
PROJECTS = [("a new maize mill", "a maize milling cooperative in Musanze", (15, 60)),
            ("a delivery lorry", "a wholesaler in Kigali", (20, 80)),
            ("a solar fruit dryer", "a fruit processing business in Rwamagana", (5, 25)),
            ("a coffee roaster", "a coffee cooperative in Huye", (10, 40)),
            ("a block-making machine", "a building contractor in Muhanga", (10, 50)),
            ("ten new sewing machines", "a tailoring workshop in Kigali", (5, 20)),
            ("a refrigerated van", "a dairy in Nyagatare", (10, 45)),
            ("a minibus", "a transport company in Rubavu", (15, 60)),
            ("a water bottling line", "a bottling firm in Rusizi", (20, 90))]


def appraise(p: dict) -> tuple[int, int, Fraction, int]:
    """The payback in whole years and months, the ARR (%) and the net present value."""
    cost, flows = p["cost"], p["flows"]
    cum = 0
    for t, cf in enumerate(flows, start=1):
        if cum + cf >= cost:
            years, months = t - 1, Fraction((cost - cum) * 12, cf)
            break
        cum += cf
    arr = Fraction(sum(flows) - cost, len(flows)) * 100 / cost
    npv = sum(cf * Fraction(f) for cf, f in zip(flows, p["factors"])) - cost
    return years, int(months), arr, int(npv)


def sample(rng: random.Random) -> dict:
    project, owner, (lo, hi) = rng.choice(PROJECTS)
    while True:
        n = rng.choice([4, 5])
        rate = rng.choice(list(FACTORS))
        k = rng.randint(2, n - 1)  # the year in which the cost is paid back; a later year is still to come
        m = rng.choice([1, 2, 3, 4, 5, 7, 8, 9, 10, 11])
        flows = [rng.randint(lo, hi) * 100_000 for _ in range(n)]
        flows[k - 1] = rng.randint(max(1, lo // 6), hi // 6 + 1) * 600_000  # a twelfth of it a whole sum of francs
        cost = sum(flows[:k - 1]) + flows[k - 1] * m // 12
        # the last year's flow sets the total, and so an ARR exact to one decimal place
        arr = Fraction(rng.randint(6, 60), 2)
        total = cost + n * cost * arr / 100
        last = total - sum(flows[:-1])
        if total.denominator != 1 or last % 10_000 or not lo * 50_000 <= last <= hi * 150_000:
            continue
        flows[-1] = int(last)
        p = {"band": "AL", "project": project, "owner": owner, "cost": cost, "flows": flows, "rate": rate,
             "factors": FACTORS[rate][:n]}
        years, months, arr_, npv = appraise(p)
        if (years, months) != (k - 1, m) or arr_ != arr or abs(npv) < 20_000:
            continue
        return p


def draw(p: dict):
    rows = [["0", f"({frw(p['cost'])})", "1.000"]]
    rows += [[str(t), frw(cf), f] for t, (cf, f) in enumerate(zip(p["flows"], p["factors"]), start=1)]
    return titled_table(f"Investment appraisal: {p['project']}", ["Year", "Net cash flow\n(Frw)",
                                                                  f"Discount factor\nat {p['rate']}%"],
                        rows, ["c", "r", "r"],
                        notes=[f"A project of {p['owner']}", f"Initial cost, paid in Year 0: {frw(p['cost'])} Frw"])


def period(years: int, months: int) -> str:
    return f"{years} year{'s' if years != 1 else ''} {months} month{'s' if months != 1 else ''}"


def signed(n: int) -> list[str]:
    """A net present value in every form a student may fairly write: a loss as -125 000, −125 000 or (125 000)."""
    if n >= 0:
        return money(n)
    forms = []
    for body in dict.fromkeys([str(-n), f"{-n:,}", frw(-n)]):
        for f in (f"-{body}", f"−{body}", f"({body})"):
            forms += [f, f"{f} Frw"]
    return list(dict.fromkeys(forms))


VERBS = ["is advising", "is the accountant for", "prepares the investment plans of", "works in the finance office of"]


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    years, months, arr, npv = appraise(p)
    options = [period(y, mo) for y in (years, years + 1) for mo in (months, 12 - months)]
    pct = str(arr.numerator // arr.denominator) if arr.denominator == 1 else f"{float(arr):.1f}"
    return [
        mcq(f"{who} {rng.choice(VERBS)} {p['owner']}, which plans to buy {p['project']}. The net cash flows come in evenly "
            "through each year. What is the payback period of the investment?", options[0], options[1:], rng),
        short(f"The accounting rate of return (ARR) is the average annual profit ÷ the initial cost × 100, where the "
              f"average annual profit is (total net cash flows − initial cost) ÷ number of years. What is the ARR of "
              f"the investment in {p['project']}, as a percentage?", pct, [f"{pct}%", f"{pct} %", f"{pct} percent"]),
        short(f"The net present value is the total of each year's net cash flow × its discount factor at {p['rate']}%, "
              f"less the initial cost. What is the net present value of the investment in {p['project']}?", npv, signed(npv)),
    ]
