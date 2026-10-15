"""The multiplier (UP): a table for an economy in billions of francs, of one of three kinds. A consumption schedule
(national income and consumption, with autonomous consumption, so C ÷ Y is not the MPC); a saving schedule (income and
saving, saving negative at low incomes); or the first three rounds of the multiplier process after an injection,
each round's extra consumption becoming the next round's extra income.

The MPC (or the MPS) from the change in one column over the change in income; the multiplier, 1 ÷ (1 − MPC) or
1 ÷ MPS; and the final change in national income after an injection, the multiplier times the injection. Every
formula is in the stem that needs it. The MPC is 0.5, 0.6, 0.75, 0.8 or 0.9, so the multiplier is 2, 2.5, 4, 5 or 10,
and every number in the table and every answer is whole or exact.
"""
from __future__ import annotations

import random
from fractions import Fraction

from ..core import NAMES, short
from .econ_tables import titled_table

ID = "multiplier"
KIND = "table.data"
SUBJECT = "economics"
BANDS = ("UP",)
CONCEPTS = ("economics.multiplier", "economics.consumption-function", "economics.savings-function",
            "economics.marginal-propensity-save")
# "Unemployment" teaches the employment multiplier, not this one; IGCSE's macroeconomy unit lists the multiplier
# among its concepts but its syllabus does not teach it; "Nigerian economy" is another country's economy.
AVOID = r"unemployment|government and the macroeconomy|nigeria"
# A topic whose sections the book lists is reached only if one names what this figure teaches.
NEEDS = r"multiplier|propensity|consumption function|consumption theory|savings? function|savings theory"

MPCS = [(1, 2), (3, 5), (3, 4), (4, 5), (9, 10)]
INJECTIONS = ["Investment", "Government spending", "Spending on exports"]


def concepts_for(p: dict) -> tuple[str, ...]:
    """The multiplier always; the consumption or saving function only where its schedule is drawn."""
    extra = {"consumption": ("economics.consumption-function",),
             "saving": ("economics.savings-function", "economics.marginal-propensity-save")}.get(p["kind"], ())
    return ("economics.multiplier",) + extra


def sample(rng: random.Random) -> dict:
    kind = rng.choice(["consumption", "saving", "rounds"])
    num, den = rng.choice(MPCS)
    b = Fraction(num, den)
    if kind == "rounds":
        # an injection whose third round is still whole: a multiple of den³ (and of ten)
        js = {2: range(200, 1201, 40), 5: range(250, 1501, 125), 4: [320, 640, 960, 1280, 1600], 10: [1000, 2000, 3000]}[den]
        j = rng.choice([v for v in js if (v / (1 - b)).denominator == 1])  # and whose final change is whole
        rows, inc = [], Fraction(j)
        for r in range(1, 4):
            rows.append([r, int(inc), int(inc * b)])
            inc *= b
        return {"band": "UP", "kind": kind, "mpc": [num, den], "rows": rows, "what": rng.choice(INJECTIONS)}
    dy = rng.choice([d for d in (200, 400, 500, 1000) if d * num % den == 0])
    y0 = dy * rng.randint(0, 2)
    a = 10 * rng.randint(5, 40)  # autonomous consumption
    ys = [y0 + dy * i for i in range(5)]
    vals = [int(a + b * y) if kind == "consumption" else int(-a + (1 - b) * y) for y in ys]
    j = 10 * rng.randint(5, 80)
    return {"band": "UP", "kind": kind, "mpc": [num, den], "rows": [[y, v] for y, v in zip(ys, vals)],
            "what": rng.choice(INJECTIONS), "injection": j}


def _signed(v: int) -> str:
    """A whole number as printed, with a space for thousands and a true minus: −150, 2 400."""
    return ("−" if v < 0 else "") + f"{abs(v):,}".replace(",", " ")


def draw(p: dict):
    if p["kind"] == "rounds":
        heads = ["Round", "Increase in income\n(billion Frw)", "Increase in consumption\n(billion Frw)"]
        rows = [[str(r), _signed(y), _signed(c)] for r, y, c in p["rows"]]
        notes = ["Each round's extra consumption becomes the next round's extra income."]
        return titled_table("The multiplier process", heads, rows, ["c", "r", "r"], notes, least=1.0)
    what = "Consumption" if p["kind"] == "consumption" else "Saving"
    heads = ["National income, Y\n(billion Frw)", f"{what}, {what[0]}\n(billion Frw)"]
    rows = [[_signed(y), _signed(v)] for y, v in p["rows"]]
    return titled_table(f"{what} schedule of an economy", heads, rows, ["r", "r"], least=1.8)


VERBS = ["studies", "is given", "copies", "looks at", "works from"]
SETTINGS = ["in an economics lesson", "for homework", "on a revision card", "for a class test", "at the economics club",
            "before a mock exam", "in a study group in Huye", "while revising in Kigali"]


def _dec(f: Fraction) -> str:
    return f"{float(f):.4f}".rstrip("0").rstrip(".")


def _forms(f: Fraction) -> list[str]:
    out = [_dec(f)]
    if f.denominator != 1:
        out.append(f"{f.numerator}/{f.denominator}")
    return out


def _bn(v: int) -> list[str]:
    out = []
    for n in (str(v), f"{v:,}", f"{v:,}".replace(",", " ")):
        for unit in ("", " billion", " billion Frw", " bn", " billion francs"):
            if n + unit not in out:
                out.append(n + unit)
    return out


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    mpc = Fraction(*p["mpc"])
    k = 1 / (1 - mpc)
    saving = p["kind"] == "saving"
    what = {"consumption": "consumption schedule", "saving": "saving schedule", "rounds": "table of the multiplier process"}
    intro = f"{who} {rng.choice(VERBS)} this {what[p['kind']]} {rng.choice(SETTINGS)}."
    if saving:
        first = short(f"{intro} MPS = change in saving ÷ change in income. What is the marginal propensity to save (MPS) "
                      "in this economy?", _dec(1 - mpc), _forms(1 - mpc) + [f"{int((1 - mpc) * 100)}%"])
        rule = "The multiplier = 1 ÷ MPS."
        using = "Using multiplier = 1 ÷ MPS"
    else:
        first = short(f"{intro} MPC = change in consumption ÷ change in income. What is the marginal propensity to consume "
                      "(MPC) in this economy?", _dec(mpc), _forms(mpc) + [f"{int(mpc * 100)}%"])
        rule = "The multiplier = 1 ÷ (1 − MPC)."
        using = "Using multiplier = 1 ÷ (1 − MPC)"
    qs = [first, short(f"{rule} What is the value of the multiplier for this economy?", _dec(k), _forms(k))]
    if p["kind"] == "rounds":
        j = p["rows"][0][1]
        total = int(k * j)
        qs.append(short(f"The table shows the first rounds after {p['what'].lower()} rises by {_signed(j)} billion Frw (round 1). "
                        f"{using}, by how much does national income rise in total, in billion Frw?", total, _bn(total)))
    else:
        j = p["injection"]
        total = int(k * j)
        qs.append(short(f"{p['what']} rises by {_signed(j)} billion Frw. {using}, by how much does national income rise in the end, "
                        "in billion Frw?", total, _bn(total)))
    return qs
