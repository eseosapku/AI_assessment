"""Short-run production (UP, AL): a table of total product (TP), average product (AP) and marginal product (MP) as a
Rwandan firm adds workers to a fixed amount of land or equipment (a Musanze potato farm, a Huye bakery, a Kigali
tailoring workshop), with two cells left blank. The formulas are stated in each stem: AP = TP ÷ number of workers;
MP = the change in TP when one more worker is employed.

Asks the two blanks (each worked out in one step from cells shown) and the worker after which diminishing marginal
returns set in: MP rises strictly to one worker's and falls strictly after, so there is never a tie, and that worker
is never the first or one of the last two. Distractors: the next worker (the first whose MP falls), the worker at
which AP or TP is greatest, the one before. At AS Level the table also asks the number of workers at which AP is
greatest, which is one number only.

Every AP is whole: the table is built from the APs, and each MP follows from them.
"""
from __future__ import annotations

import random

from ..core import NAMES, mcq, short
from ._micro import ordinal
from .econ_tables import frw, titled_table

ID = "production_table"
KIND = "business.document"
SUBJECT = "economics"
BANDS = ("UP", "AL")
CONCEPTS = ("economics.production-function", "economics.production-theory")
# A topic whose sections the book lists is reached only if its name or a section names the production function or
# diminishing returns.
NEEDS = r"production function|diminishing|input.output|variable proportions|short.run production|\bproduct\b|production theory|theory of production"
# Chapters sharing the concepts but teaching another figure: costs, supply, firms, the factors and types of production.
AVOID = r"\bcosts?\b|supply|theory of a firm|factors of production|introduction to the theory|possibility"

# where, what is made (plural), a scale its numbers come in
FIRMS = {
    "potatoes": ("a potato farm in Musanze", "kg of potatoes", [5, 10]),
    "bread": ("a bakery in Huye", "loaves", [2, 5]),
    "shirts": ("a tailoring workshop in Kigali", "shirts", [1]),
    "bricks": ("a brick maker in Bugesera", "bricks", [10, 20]),
    "coffee": ("a coffee washing station in Nyamasheke", "kg of coffee", [5, 10]),
    "baskets": ("a basket weavers' cooperative in Gisagara", "baskets", [1, 2]),
    "chapati": ("a chapati stall in Rubavu", "chapatis", [2, 4]),
}
NAMES_OF = {"tp": "total product", "ap": "average product", "mp": "marginal product"}


def _aps(rng: random.Random, n: int) -> list[int] | None:
    """Average products for 1..n workers: rising to a peak, then falling."""
    peak = rng.randint(3, n - 1)
    ap = [rng.randint(4, 12)]
    for k in range(2, n + 1):
        ap.append(ap[-1] + (rng.randint(1, 5) if k <= peak else -rng.randint(1, 4)))
    return ap if min(ap) > 0 else None


def sample(rng: random.Random) -> dict:
    firm = rng.choice(sorted(FIRMS))
    band = rng.choice(BANDS)
    while True:
        n = rng.choice([6, 7, 8])
        ap = _aps(rng, n)
        if not ap:
            continue
        scale = rng.choice(FIRMS[firm][2])
        tp = [0] + [scale * k * a for k, a in enumerate(ap, start=1)]
        mp = [None] + [tp[k] - tp[k - 1] for k in range(1, n + 1)]
        top = max(range(1, n + 1), key=lambda k: mp[k])
        rising = all(mp[k] < mp[k + 1] for k in range(1, top))
        falling = all(mp[k] > mp[k + 1] for k in range(top, n))
        if not (rising and falling and 2 <= top <= n - 2) or max(ap) == ap[-1] or ap.count(max(ap)) > 1:
            continue
        if min(tp[1:]) <= 0 or mp[n] < -3 * scale:
            continue
        if any(abs(mp[k + 1] - mp[k]) > 0.4 * mp[top] for k in range(1, n)):
            continue  # smooth, as a textbook's table is: no jump of more than two-fifths of the greatest MP
        blanks = _blanks(rng, n)
        return {"band": band, "firm": firm, "tp": tp, "blanks": blanks}


def _blanks(rng: random.Random, n: int) -> list[list]:
    """Two cells, in different rows from the 2nd worker on, each worked out in one step from cells shown: a TP from
    its AP, an AP from its TP, an MP from the TPs above and beside it."""
    while True:
        rows = rng.sample(range(2, n + 1), 2)
        cells = [[rng.choice(["tp", "ap", "mp"]), r] for r in rows]
        hidden = {(c, r) for c, r in cells}
        ok = True
        for c, r in cells:
            if c == "tp" and ("ap", r) in hidden:
                ok = False
            if c == "ap" and ("tp", r) in hidden:
                ok = False
            if c == "mp" and (("tp", r) in hidden or ("tp", r - 1) in hidden):
                ok = False
        if ok and len({c for c, _ in cells}) == 2:  # two different columns, so the questions differ
            return sorted(cells, key=lambda x: x[1])


def _num(v: int) -> str:
    return frw(v) if v >= 0 else "−" + frw(-v)


def draw(p: dict):
    place, made = FIRMS[p["firm"]][:2]
    tp = p["tp"]
    n = len(tp) - 1
    hidden = {(c, r) for c, r in p["blanks"]}
    rows = [["0", "0", "–", "–"]]
    for k in range(1, n + 1):
        cells = {"tp": _num(tp[k]), "ap": _num(tp[k] // k), "mp": _num(tp[k] - tp[k - 1])}
        rows.append([str(k)] + ["?" if (c, k) in hidden else cells[c] for c in ("tp", "ap", "mp")])
    heads = ["Number of\nworkers", f"Total product (TP)\n({made} per day)", f"Average product (AP)\n({made} per worker)",
             f"Marginal product (MP)\n({made})"]
    return titled_table(f"Output at {place}", heads, rows, ["c", "c", "c", "c"],
                        ["AP = TP ÷ number of workers;  MP = change in TP when one more worker is employed"], least=1.2)


VERBS = ["studies", "is given", "copies", "looks at", "works from", "completes"]
SETTINGS = ["in an economics lesson", "for homework", "on a revision card", "for a class test", "at the economics club",
            "before an exam"]
RULE = "AP = TP ÷ number of workers; MP = the change in TP when one more worker is employed."


def _ask(p: dict, cell: list, lead: str):
    place, made = FIRMS[p["firm"]][:2]
    tp = p["tp"]
    col, k = cell
    value = {"tp": tp[k], "ap": tp[k] // k, "mp": tp[k] - tp[k - 1]}[col]
    unit = {"tp": f"{made} per day", "ap": f"{made} per worker", "mp": made}[col]
    where = f"of the {ordinal(k)} worker" if col == "mp" else f"for {k} workers"
    forms = [str(value), f"{value} {made}", f"{value} {unit}"]
    if value < 0:
        forms += [f"−{-value}", f"−{-value} {made}"]
    if value >= 1000:
        forms += [frw(value), f"{value:,}"]
    return short(f"{lead}{RULE} What is the missing {NAMES_OF[col]} {where} at {place}, in {unit}?", value, forms)


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    place = FIRMS[p["firm"]][0]
    tp = p["tp"]
    n = len(tp) - 1
    mp = [None] + [tp[k] - tp[k - 1] for k in range(1, n + 1)]
    ap = [None] + [tp[k] // k for k in range(1, n + 1)]
    top = max(range(1, n + 1), key=lambda k: mp[k])
    ap_top = max(range(1, n + 1), key=lambda k: ap[k])
    tp_top = max(range(1, n + 1), key=lambda k: tp[k])
    wrong = []
    for k in (top + 1, ap_top, tp_top, top - 1, top + 2):
        if 1 <= k <= n and k != top and k not in wrong:
            wrong.append(k)
    first, second = p["blanks"]
    if rng.random() < 0.5:
        first, second = second, first
    qs = [
        _ask(p, first, f"{who} {rng.choice(VERBS)} this table of output at {place} {rng.choice(SETTINGS)}. "),
        _ask(p, second, ""),
        mcq(f"At {place}, after which worker do diminishing marginal returns set in, so that each further worker adds "
            "less to total product than the one before?", f"After the {ordinal(top)} worker",
            [f"After the {ordinal(k)} worker" for k in wrong[:3]], rng),
    ]
    if p["band"] == "AL":
        qs.append(short(f"AP = TP ÷ number of workers. At {place}, with how many workers is average product greatest?",
                        ap_top, [f"{ap_top} workers", f"{ap_top} worker"]))
    return qs
