"""A demand and supply diagram on a grid (UP, AL), the concept-linked successor to the supply_demand pilot: a good sold
in a Rwandan market (tomatoes at Kimironko market, cement in Kigali, milk in Nyagatare), priced in francs.

Five sub-types, each with straight curves whose every point asked lies on a gridline crossing:
- shift (UP): D1, D2, S1 and S2 drawn, as Cambridge multiple-choice papers draw them, their four crossings lettered
  A to D. The stem says what moved (demand, supply or both, and which way, with a cause that fits the good); the
  new equilibrium point, price and quantity are asked.
- control (UP): a maximum price below the equilibrium or a minimum price above it, drawn across the grid; the
  quantity bought and sold, the shortage or surplus (two amounts × two sides) and the equilibrium price without it.
- tax and subsidy (AL): a specific tax shifts supply up by the tax, a subsidy down by it; the price consumers pay,
  the price producers receive, the tax revenue or the subsidy's cost, and the consumers' share, each formula stated.
- surplus (AL): consumer and producer surplus as the triangles between the curves, the equilibrium price and the
  price axis; each with its ½ × base × height formula stated, and which is larger by how much.

Demand is P = a - bQ and supply P = c + dQ in grid steps, with b and d whole; every crossing is whole because each
shift is a whole number of (b + d) steps up or down.
"""
from __future__ import annotations

import random
from fractions import Fraction

from ..core import INK, NAMES, mcq, money, new_figure, short
from . import _micro as g
from .econ_tables import frw

ID = "market_diagram"
KIND = "econ.curve"
SUBJECT = "economics"
BANDS = ("UP", "AL")
ALSO_BANDS = {"UP": ("AL",)}  # shifts and price controls are drawn the same in the AS Level chapters named for them
SUB = {
    "shift": ("demand-and-supply", "market-equilibrium", "demand-curve-shifts", "distinguishing-shifts", "price-mechanism"),
    "control": ("demand-and-supply", "market-equilibrium", "price-controls"),
    "tax": ("indirect-taxation", "government-intervention-markets"),
    "subsidy": ("subsidies", "government-intervention-markets"),
    "surplus": ("consumer-surplus", "producer-surplus"),
}
CONCEPTS = tuple(sorted({f"economics.{c}" for cs in SUB.values() for c in cs}))
# Rwanda's Entrepreneurship S4 teaches demand, supply, equilibrium and price control under business.
ALSO = ("business.demand-and-supply-theory", "business.market-equilibrium", "business.price-and-price-fluctuations")
# A topic whose sections the book lists is reached only if its name or a section names what the figure teaches.
NEEDS = (r"demand|supply|equilibri|price (control|mechanism|determination|fluctuation)|maximum (and minimum )?prices?|"
         r"minimum price|indirect tax|\btax(es|ation)?\b|subsid|surplus")
# Chapters that share a demand-and-supply concept but teach another figure: elasticity, utility, indifference curves,
# the macroeconomy and fiscal policy, market structures, IGCSE's decision makers (money, workers, firms), consumer theory
# (utility), and the marketing books' pricing chapters, which the business price ids reach.
AVOID = (r"elasticit|utility|indifference|aggregate|national income|market structure|decision makers|consumer theory|"
         r"revenue|cost|production|firm|labour|money|exchange|balance of pay|trade|integration|introduction|"
         r"fundamental|basic economic|nature and scope|equations|fiscal|marketing|market research|product and pricing")
# What each sub-type must not reach besides: the chapter on taxes and subsidies is no place for a shift alone, and
# consumer surplus has its own chapter.
AVOID_MORE = {
    "shift": r"|\btax|subsid|consumer surplus|market failure",
    "control": r"|theory of (demand|supply)|consumer surplus",
    "tax": r"|consumer surplus|theory of (demand|supply)",
    "subsidy": r"|consumer surplus|theory of (demand|supply)",
    "surplus": r"|\btax|disequilibrium|theory of (demand|supply)",
}

# good: sold per, quantity unit, period, quantity step, price step, places, demand up / down, supply up / down causes
GOODS = {
    "tomatoes": ("kg", "kg", "day", 50, 50, ["at Kimironko market, Kigali", "at Nyabugogo market, Kigali", "in Musanze"],
                 ["Incomes in the area rise", "The price of cabbages, a substitute, rises"],
                 ["Incomes in the area fall", "The price of cabbages, a substitute, falls"],
                 ["Good rains bring a large tomato harvest", "Farmers nearby start growing tomatoes in greenhouses"],
                 ["A drought damages the tomato harvest", "A plant disease destroys many tomato plants"]),
    "milk": ("litre", "litres", "day", 50, 25, ["in Nyagatare", "at milk collection centres in Gicumbi", "in Rwamagana"],
             ["Incomes in the area rise", "A school milk programme starts buying milk"],
             ["Incomes in the area fall", "The price of soya drinks, a substitute, falls"],
             ["Farmers buy more high-yield dairy cows", "Good rains give the cows plenty of grass"],
             ["A drought dries up the pasture", "A cattle disease spreads among dairy herds"]),
    "Irish potatoes": ("kg", "kg", "day", 50, 25, ["in Musanze", "in Nyabihu", "in Rubavu"],
                       ["Incomes in the area rise", "The price of sweet potatoes, a substitute, rises"],
                       ["Incomes in the area fall", "The price of sweet potatoes, a substitute, falls"],
                       ["Good rains bring a large potato harvest", "Farmers start using improved seed potatoes"],
                       ["Heavy rains rot many potatoes in the fields", "Potato blight spreads through the farms"]),
    "cement": ("bag", "bags", "week", 20, 500, ["in Kigali", "in Musanze", "in Huye"],
               ["A building boom starts in the area", "Incomes in the area rise"],
               ["Fewer new houses are being built", "Incomes in the area fall"],
               ["A new cement factory opens", "New machines lower the cost of making cement"],
               ["The cost of fuel for the kilns rises", "A power shortage slows the cement factories"]),
    "eggs": ("tray", "trays", "week", 10, 200, ["in Huye", "in Muhanga", "at Kimironko market, Kigali"],
             ["Incomes in the area rise", "The price of meat, a substitute, rises"],
             ["Incomes in the area fall", "The price of meat, a substitute, falls"],
             ["Farmers keep more laying hens", "The price of chicken feed falls"],
             ["The price of chicken feed rises", "A poultry disease kills many hens"]),
    "maize flour": ("kg", "kg", "week", 50, 50, ["in Rwamagana", "in Kayonza", "in Huye"],
                    ["Incomes in the area rise", "The price of cassava flour, a substitute, rises"],
                    ["Incomes in the area fall", "The price of cassava flour, a substitute, falls"],
                    ["A large maize harvest lowers the mills' cost of grain", "New milling machines lower costs"],
                    ["A poor maize harvest raises the mills' cost of grain", "The cost of electricity for the mills rises"]),
    "sugar": ("kg", "kg", "week", 50, 100, ["in Kigali", "in Nyanza", "in Rusizi"],
              ["Incomes in the area rise", "The price of honey, a substitute, rises"],
              ["Incomes in the area fall", "The price of honey, a substitute, falls"],
              ["A good sugar-cane harvest lowers the cost of making sugar", "A new sugar refinery opens"],
              ["A drought damages the sugar-cane crop", "The cost of fuel for transport rises"]),
    "bananas": ("bunch", "bunches", "week", 10, 250, ["in Karongi", "in Rubavu", "in Ngoma"],
                ["Incomes in the area rise", "The price of Irish potatoes, a substitute, rises"],
                ["Incomes in the area fall", "The price of Irish potatoes, a substitute, falls"],
                ["Good rains bring a large banana harvest", "Farmers plant new disease-free banana suckers"],
                ["Banana wilt disease spreads", "A drought damages the banana plantations"]),
}
QX, PY = 14, 18  # the grid: 14 steps of quantity, 18 of price
WEIGHTS = {"shift": 3, "control": 3, "tax": 2, "subsidy": 2, "surplus": 2}


def concepts_for(p: dict) -> tuple[str, ...]:
    return tuple(f"economics.{c}" for c in SUB[p["kind"]])


def avoid_for(p: dict) -> str:
    return AVOID + AVOID_MORE[p["kind"]]


def _meet(a: int, c: int, b: int, d: int) -> tuple[Fraction, Fraction]:
    q = Fraction(a - c, b + d)
    return q, c + d * q


def _inside(q, p, margin: int = 1) -> bool:
    return q.denominator == 1 and p.denominator == 1 and margin <= q <= QX - margin and margin <= p <= PY - margin


def _base(rng: random.Random, kind: str) -> dict:
    good = rng.choice(sorted(GOODS))
    per, qunit, period, dq, dp, places = GOODS[good][:6]
    return {"band": "UP" if kind in ("shift", "control") else "AL", "kind": kind, "good": good, "place": rng.choice(places),
            "dq": dq, "dp": dp, "qx": QX, "py": PY, "a2": None, "c2": None, "story": None, "points": {}, "pc": None,
            "ctrl": None, "why": rng.randrange(2), "cause_d": rng.randrange(2), "cause_s": rng.randrange(2)}


def _shift(rng: random.Random, p: dict) -> dict | None:
    b, d = rng.choice([1, 2]), rng.choice([1, 2])
    qe, pe = rng.randint(4, 9), rng.randint(5, 12)
    a, c = pe + b * qe, pe - d * qe
    if c < 0:
        return None
    a2 = a + rng.choice([-1, 1]) * (b + d) * rng.choice([1, 2])
    c2 = c + rng.choice([-1, 1]) * (b + d) * rng.choice([1, 2])
    meets = [_meet(ai, ci, b, d) for ai in (a, a2) for ci in (c, c2)]
    if not all(_inside(q, pr) for q, pr in meets) or c2 < -4:
        return None
    story = rng.choice(["demand", "supply", "both"])
    ordered = sorted((int(q), int(pr)) for q, pr in meets)
    p.update(b=b, d=d, a=a, c=c, a2=a2, c2=c2, story=story, points={k: list(v) for k, v in zip("ABCD", ordered)})
    return p


def _control(rng: random.Random, p: dict) -> dict | None:
    b, d = rng.choice([1, 2]), rng.choice([1, 2])
    qe, pe = rng.randint(4, 9), rng.randint(5, 12)
    a, c = pe + b * qe, pe - d * qe
    if c < 0:
        return None
    ctrl = rng.choice(["max", "min"])
    fits = []
    for pc in (range(pe - 5, pe) if ctrl == "max" else range(pe + 1, pe + 6)):
        qd, qs = Fraction(a - pc, b), Fraction(pc - c, d)
        if qd.denominator == 1 and qs.denominator == 1 and 1 <= min(qd, qs) and max(qd, qs) <= QX - 4 \
                and abs(qd - qs) >= 2 and 1 <= pc <= PY - 2:
            fits.append(pc)
    if not fits:
        return None
    p.update(b=b, d=d, a=a, c=c, ctrl=ctrl, pc=rng.choice(fits))
    return p


def _tax(rng: random.Random, p: dict, sign: int) -> dict | None:
    b, d = rng.choice([1, 2]), rng.choice([1, 2])
    qe, pe = rng.randint(4, 9), rng.randint(5, 12)
    a, c = pe + b * qe, pe - d * qe
    if c < 0:
        return None
    t = (b + d) * rng.choice([1, 2])
    c2 = c + sign * t
    q1, p1 = _meet(a, c2, b, d)
    if not (_inside(q1, p1) and _inside(Fraction(qe), Fraction(pe)) and 1 <= p1 - sign * t <= PY - 1 and c2 >= -4):
        return None
    p.update(b=b, d=d, a=a, c=c, c2=c2)
    return p


def _surplus(rng: random.Random, p: dict) -> dict | None:
    b, d = rng.sample([1, 2], 2) if rng.random() < 0.8 else rng.choice([(1, 3), (3, 1)])  # b != d: the two areas differ
    qe, pe = rng.randint(3, 8), rng.randint(4, 12)
    a, c = pe + b * qe, pe - d * qe
    if not (1 <= c and a <= PY - 1):
        return None
    p.update(b=b, d=d, a=a, c=c)
    return p


def sample(rng: random.Random) -> dict:
    kinds = sorted(WEIGHTS)
    kind = rng.choices(kinds, [WEIGHTS[k] for k in kinds])[0]
    while True:
        p = _base(rng, kind)
        if kind == "shift":
            got = _shift(rng, p)
        elif kind == "control":
            got = _control(rng, p)
        elif kind in ("tax", "subsidy"):
            got = _tax(rng, p, 1 if kind == "tax" else -1)
        else:
            got = _surplus(rng, p)
        if got:
            return got


def draw(p: dict):
    good = p["good"]
    per, qunit, period = GOODS[good][:3]
    a, b, c, d, dq, dp, kind = p["a"], p["b"], p["c"], p["d"], p["dq"], p["dp"], p["kind"]
    fig, ax = new_figure(6.4, 5.6)
    g.grid(ax, QX, PY, dq, dp, f"Quantity ({qunit} per {period})", f"Price (Frw per {per})")
    board = g.Board(ax, QX, PY, dq, dp)
    names = {"shift": ("D1", "S1"), "control": ("D", "S"), "tax": ("D", "S1"), "subsidy": ("D", "S1"), "surplus": ("D", "S")}
    dname, sname = names[kind]
    ends = [(dname, board.line(a, -b, "D1"), -b), (sname, board.line(c, d, "S1"), d)]
    qe, pe = _meet(a, c, b, d)
    if kind == "shift":
        ends += [("D2", board.line(p["a2"], -b, "D2", "--"), -b), ("S2", board.line(p["c2"], d, "S2", "--"), d)]
        for letter, (q, pr) in p["points"].items():
            ax.plot([q * dq], [pr * dp], "o", color=INK, markersize=5.5, zorder=4)
            board.block(q - 0.15, q + 0.15, pr - 0.2, pr + 0.2)
        for letter, (q, pr) in p["points"].items():
            others = [v for k, v in p["points"].items() if k != letter]
            if not board.label(letter, q, pr, 11.5, gap=0.12, pad=0.05, others=others,
                               where=[(1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1)]):
                raise ValueError("no room for a point's letter")
    elif kind == "control":
        pc = p["pc"]
        ax.plot([0, QX * dq], [pc * dp] * 2, color=INK, linestyle="-.", linewidth=1.6, gid="price")
        board.path([(0, pc), (QX, pc)])
        g.to_axes(ax, qe, pe, dq, dp)
        qd, qs = Fraction(a - pc, b), Fraction(pc - c, d)
        for q in (qd, qs):
            g.dotted(ax, [(q, 0), (q, pc)], dq, dp)
        word = "Maximum price" if p["ctrl"] == "max" else "Minimum price"
        # past both crossings: above a maximum price (supply is higher there), below a minimum (demand is lower)
        w = board._size(word, 9.5)[0]
        right = QX - 0.15
        y = pc + 0.55 if p["ctrl"] == "max" else pc - 0.55
        board.block(right - w, right, y - 0.4, y + 0.4)
        ax.text(right * dq, y * dp, word, ha="right", va="center", fontsize=9.5, fontweight="bold")
    elif kind in ("tax", "subsidy"):
        c2 = p["c2"]
        ends.append(("S2", board.line(c2, d, "S2", "--"), d))
        q1, p1 = _meet(a, c2, b, d)
        received = p1 - (c2 - c)
        g.to_axes(ax, qe, pe, dq, dp)
        g.dotted(ax, [(q1, 0), (q1, max(p1, received))], dq, dp)
        g.dotted(ax, [(0, p1), (q1, p1)], dq, dp)
        g.dotted(ax, [(0, received), (q1, received)], dq, dp)
    else:
        g.to_axes(ax, qe, pe, dq, dp)
    for name, end, slope in ends:
        board.end_label(name, end, slope)
    ax.set_title(f"The market for {good} {p['place']}", fontsize=11.5)
    return fig


VERBS = ["studies", "is given", "draws", "copies", "looks at", "works from"]
SETTINGS = ["in an economics lesson", "for homework", "on a revision card", "for a class test", "at the economics club",
            "before an exam"]


def _story(p: dict) -> str:
    good = p["good"]
    up_d, down_d, up_s, down_s = GOODS[good][6:10]
    d_up, s_up = p["a2"] > p["a"], p["c2"] < p["c"]
    dem = (f"{(up_d if d_up else down_d)[p['cause_d']]}, so demand for {good} "
           f"{'increases' if d_up else 'decreases'} from D1 to D2")
    sup_cause = (up_s if s_up else down_s)[p["cause_s"]]
    sup = f"{sup_cause}, so the supply of {good} {'increases' if s_up else 'decreases'} from S1 to S2"
    if p["story"] == "demand":
        return f"{dem}, while supply stays at S1."
    if p["story"] == "supply":
        return f"{sup}, while demand stays at D1."
    return f"{dem}; at the same time, {sup[0].lower() + sup[1:]}."


def _forms(n: int, unit: str) -> list[str]:
    forms = [str(n), f"{n} {unit}"]
    if n >= 1000:
        forms += [frw(n), f"{n:,}", f"{frw(n)} {unit}"]
    return forms


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    good, kind, dq, dp = p["good"], p["kind"], p["dq"], p["dp"]
    per, qunit, period = GOODS[good][:3]
    a, b, c, d = p["a"], p["b"], p["c"], p["d"]
    qe, pe = _meet(a, c, b, d)
    opening = f"{who} {rng.choice(VERBS)} this diagram {rng.choice(SETTINGS)}. It shows the market for {good} {p['place']}. "
    if kind == "shift":
        story = _story(p)
        q2, p2 = _meet(p["a2"] if p["story"] != "supply" else a, p["c2"] if p["story"] != "demand" else c, b, d)
        letter = next(k for k, v in p["points"].items() if v == [int(q2), int(p2)])
        n2 = int(p2) * dp
        return [
            mcq(f"{opening}{story} Which point shows the new equilibrium?", f"Point {letter}",
                [f"Point {k}" for k in "ABCD" if k != letter], rng),
            short(f"{story} What is the new equilibrium price of {good}, in Frw per {per}?", n2, money(n2)),
            short(f"{story} What is the new equilibrium quantity of {good}, in {qunit} per {period}?", int(q2) * dq,
                  _forms(int(q2) * dq, qunit)),
        ]
    if kind == "control":
        pc, high = p["pc"], p["ctrl"] == "min"
        word = "minimum" if high else "maximum"
        why = (["to protect farmers' incomes", "to keep producers in business"] if high else
               ["to help poorer families", "to keep the price within reach of most families"])[p["why"]]
        setup = f"The government sets a {word} price of {frw(pc * dp)} Frw per {per} for {good} {p['place']} {why}."
        qd, qs = int(Fraction(a - pc, b)), int(Fraction(pc - c, d))
        gap = abs(qd - qs) * dq
        mistakes = [x * dq for x in (abs(qd - int(qe)), abs(int(qe) - qs), qd, qs) if 0 < x * dq != gap]
        wrong = rng.choice(mistakes)
        side, other = ("surplus", "shortage") if high else ("shortage", "surplus")
        unit = f"{qunit} per {period}"
        traded = min(qd, qs) * dq
        return [
            short(f"{opening}{setup} How many {qunit} per {period} are bought and sold at the {word} price?", traded,
                  _forms(traded, qunit) + [f"{traded} {unit}"]),
            mcq(f"{setup} At the {word} price, what is there in the market for {good}?", f"A {side} of {frw(gap)} {unit}",
                [f"A {other} of {frw(gap)} {unit}", f"A {side} of {frw(wrong)} {unit}", f"A {other} of {frw(wrong)} {unit}"], rng),
            short(f"Without the {word} price, what would the equilibrium price of {good} {p['place']} be, in Frw per {per}?",
                  int(pe) * dp, money(int(pe) * dp)),
        ]
    if kind in ("tax", "subsidy"):
        c2 = p["c2"]
        t = c2 - c
        q1, p1 = _meet(a, c2, b, d)
        paid, received, sold = int(p1) * dp, int(p1 - t) * dp, int(q1) * dq
        per_unit = abs(t) * dp
        total = per_unit * sold
        share = int(abs(p1 - pe)) * dp * sold
        if kind == "tax":
            setup = f"A specific tax of {frw(per_unit)} Frw per {per} on {good} shifts supply from S1 to S2."
            return [
                short(f"{opening}{setup} What price do consumers pay for {good} after the tax, in Frw per {per}?", paid, money(paid)),
                short(f"{setup} What price do producers of {good} receive after the tax (the price paid less the tax), in Frw "
                      f"per {per}?", received, money(received)),
                short(f"{setup} Tax revenue = tax per unit × quantity sold after the tax. What is the government's tax "
                      f"revenue from {good}, in Frw per {period}?", total, money(total)),
                short(f"{setup} The consumers' share of the tax = (price paid after the tax − equilibrium price before it) × "
                      f"quantity sold after the tax. What is the consumers' share of the tax revenue, in Frw per {period}?",
                      share, money(share)),
            ]
        setup = f"A subsidy of {frw(per_unit)} Frw per {per}, paid to producers of {good}, shifts supply from S1 to S2."
        return [
            short(f"{opening}{setup} What price do consumers pay for {good} after the subsidy, in Frw per {per}?", paid, money(paid)),
            short(f"{setup} What price do producers of {good} receive, including the subsidy, in Frw per {per}?", received,
                  money(received)),
            short(f"{setup} Cost of the subsidy = subsidy per unit × quantity sold after the subsidy. What does the subsidy "
                  f"cost the government, in Frw per {period}?", total, money(total)),
            short(f"{setup} The consumers' share of the subsidy = (equilibrium price before the subsidy − price paid after "
                  f"it) × quantity sold after it. What is the consumers' share of the subsidy, in Frw per {period}?",
                  share, money(share)),
        ]
    cs = int(qe) * dq * (a - int(pe)) * dp // 2
    ps = int(qe) * dq * (int(pe) - c) * dp // 2
    diff = abs(cs - ps)
    big, small = ("Consumer surplus", "Producer surplus") if cs > ps else ("Producer surplus", "Consumer surplus")
    return [
        short(f"{opening}Consumer surplus = ½ × quantity bought × (the price where the demand curve meets the price axis − "
              f"the market price). What is the consumer surplus at the equilibrium, in Frw per {period}?", cs, money(cs)),
        short(f"Producer surplus = ½ × quantity sold × (the market price − the price where the supply curve meets the "
              f"price axis). What is the producer surplus at the equilibrium in the market for {good} {p['place']}, in Frw "
              f"per {period}?", ps, money(ps)),
        mcq(f"In the market for {good} {p['place']}, at the equilibrium, which is larger, consumer surplus or producer "
            "surplus, and by how much?", f"{big}, by {frw(diff)} Frw",
            [f"{small}, by {frw(diff)} Frw", f"{big}, by {frw(2 * diff)} Frw", f"{small}, by {frw(2 * diff)} Frw"], rng),
    ]
