"""Externalities (AL): marginal private and social cost and benefit on a grid, as Cambridge AS Level draws them, for a
Rwandan market with a spillover (smoke from a cement works near Musanze, bees from a Nyamagabe apiary pollinating
farms, vaccinations at a Huye clinic, car journeys into central Kigali).

Four sub-types, one for each kind of externality: a negative or positive externality of production (MSC above or
below MPC = S, with D = MPB = MSB), or of consumption (MSB below or above MPB = D, with S = MPC = MSC). The external
cost or benefit is the same for every unit, so the social curve runs parallel to its private one, and the gap is a
whole number of grid steps.

Four lettered points, their letters shuffled: the free-market equilibrium (MPB = MPC), the social optimum
(MSB = MSC), the point on the social curve at the market output (the third corner of the welfare-loss triangle) and
the point on the private curve at the socially optimal output. Asks the output the free market produces or the
socially optimal output, which point is the social optimum, the external cost (or benefit) of each unit, and the
welfare loss, the triangle named by its letters with ½ × base × height stated.

The lines are P = a - bQ and P = c + dQ in grid steps; the external cost is k(b + d) steps, so the social optimum is
k whole steps of output from the market's (the supply_demand pilot's rule).
"""
from __future__ import annotations

import random
from fractions import Fraction

from ..core import INK, NAMES, mcq, money, new_figure, short
from . import _micro as g
from .econ_tables import frw

ID = "externality_diagram"
KIND = "econ.curve"
SUBJECT = "economics"
BANDS = ("AL",)
CONCEPTS = ("economics.externalities", "economics.market-failure", "economics.costs-benefits-analysis",
            "economics.efficiency")
# A topic whose sections the book lists is reached only if its name or a section names externalities or market failure.
NEEDS = r"externalit|market failure|social (cost|benefit)|spillover"

# kind: (the market, the good, its unit (plural, singular), the period, quantity step, price step, what spills over)
CONTEXTS = {
    "neg_prod": [
        ("the market for cement from a works near Musanze", "cement", "tonnes", "tonne", "week", 10, 10000,
         "Dust from the cement works harms the health of families living nearby, a cost the works does not pay."),
        ("the market for leather from a tannery in Huye", "leather", "hides", "hide", "week", 20, 500,
         "Waste from the tannery pollutes the river that farmers downstream use, a cost the tannery does not pay."),
        ("the market for charcoal in Nyamasheke", "charcoal", "sacks", "sack", "week", 20, 1000,
         "Cutting trees for charcoal causes soil erosion on nearby farms, a cost the charcoal makers do not pay."),
        ("the market for bricks in Bugesera", "bricks", "thousand bricks", "thousand bricks", "week", 5, 5000,
         "Smoke from the brick kilns harms the health of people living nearby, a cost the brick makers do not pay."),
    ],
    "pos_prod": [
        ("the market for honey from an apiary in Nyamagabe", "honey", "kg", "kg", "month", 20, 500,
         "The apiary's bees pollinate crops on nearby farms, a benefit the beekeepers are not paid for."),
        ("the market for tree seedlings from a nursery in Gakenke", "tree seedlings", "hundred seedlings",
         "hundred seedlings", "month", 10, 1000,
         "Seedlings planted on the hillsides protect farms below from landslides, a benefit the nursery is not paid for."),
        ("the market for furniture from a workshop in Kigali", "furniture", "pieces", "piece", "month", 10, 2000,
         "Apprentices trained at the workshop later work for other firms, a benefit the workshop is not paid for."),
    ],
    "neg_cons": [
        ("the market for car journeys into central Kigali", "car journeys", "journeys", "journey", "day", 500, 100,
         "Each journey adds to traffic jams and fumes for other road users, a cost drivers do not pay."),
        ("the market for cigarettes in a district", "cigarettes", "packets", "packet", "week", 20, 200,
         "Smoking harms the health of people nearby, a cost smokers do not pay."),
        ("the market for bottled beer in a town", "bottled beer", "crates", "crate", "week", 20, 1000,
         "Heavy drinking leads to road accidents that harm other people, a cost drinkers do not pay."),
    ],
    "pos_cons": [
        ("the market for vaccinations at a clinic in Huye", "vaccinations", "doses", "dose", "month", 20, 500,
         "Each vaccinated person makes others less likely to catch the disease, a benefit the buyer is not paid for."),
        ("the market for mosquito nets in Bugesera", "mosquito nets", "nets", "net", "month", 50, 500,
         "Each net used means fewer mosquitoes spread malaria to neighbours, a benefit the buyer is not paid for."),
        ("the market for evening literacy classes in Rusizi", "literacy classes", "class places", "class place", "term",
         10, 1000,
         "Adults who learn to read help their children with schoolwork, a benefit the learner is not paid for."),
    ],
}
QX, PY = 14, 18


def _lines(p: dict):
    """(intercept, slope) of MPB, MPC, MSB and MSC, in grid steps."""
    a, b, c, d, e, kind = p["a"], p["b"], p["c"], p["d"], p["e"], p["kind"]
    mpb, mpc = (a, -b), (c, d)
    msb, msc = {"neg_prod": (mpb, (c + e, d)), "pos_prod": (mpb, (c - e, d)),
                "neg_cons": ((a - e, -b), mpc), "pos_cons": ((a + e, -b), mpc)}[kind]
    return mpb, mpc, msb, msc


def _meet(l1, l2):
    (p0, s0), (p1, s1) = l1, l2
    q = Fraction(p1 - p0, s0 - s1)
    return q, p0 + s0 * q


def _roles(p: dict) -> dict:
    """The four points, by what each is: market equilibrium, social optimum, the triangle's third corner, the decoy."""
    mpb, mpc, msb, msc = _lines(p)
    prod = p["kind"].endswith("prod")
    social, private = (msc, mpc) if prod else (msb, mpb)
    qm, pm = _meet(mpb, mpc)
    qs, ps = _meet(msb, msc)
    return {"market": (qm, pm), "social": (qs, ps), "third": (qm, social[0] + social[1] * qm),
            "decoy": (qs, private[0] + private[1] * qs)}


def _cornered(p: dict) -> bool:
    """Whether a drawn line ends within two steps of a right-hand corner, where its long name finds no room."""
    mpb, mpc, msb, msc = _lines(p)
    for p0, slope in {mpb, mpc, msb, msc}:
        at_edge = p0 + slope * QX
        if slope < 0:
            end = (QX, at_edge) if at_edge >= 0 else (Fraction(p0, -slope), 0)
            if end[0] > QX - 2 and end[1] < 2:
                return True
        else:
            end = (QX, at_edge) if at_edge <= PY else (Fraction(PY - p0, slope), PY)
            if end[0] > QX - 2 and end[1] > PY - 2:
                return True
    return False


def sample(rng: random.Random) -> dict:
    kind = rng.choice(sorted(CONTEXTS))
    ctx = rng.randrange(len(CONTEXTS[kind]))
    dq, dp = CONTEXTS[kind][ctx][5:7]
    while True:
        b, d = rng.choice([1, 2]), rng.choice([1, 2])
        k = rng.choice([2, 3])
        e = k * (b + d)
        if e > 9:
            continue
        qm, pm = rng.randint(4, 10), rng.randint(5, 12)
        a, c = pm + b * qm, pm - d * qm
        p = {"band": "AL", "kind": kind, "ctx": ctx, "a": a, "b": b, "c": c, "d": d, "e": e, "dq": dq, "dp": dp,
             "qx": QX, "py": PY, "ask": rng.choice(["market", "social"])}
        roles = _roles(p)
        if not all(v.denominator == 1 and 1 <= q <= QX - 1 and 1 <= v <= PY - 1 for q, v in roles.values()):
            continue
        if any(q.denominator != 1 for q, _ in roles.values()) or a > PY + 4 or c < -6:
            continue
        if (k * dq * e * dp) % 2:
            continue  # the welfare loss in whole francs
        if _cornered(p):
            continue
        pts = [[int(q), int(v)] for q, v in roles.values()]
        letters = rng.sample("ABCD", 4)
        p["points"] = {letter: pt for letter, pt in sorted(zip(letters, pts))}
        return p


def _names(kind: str) -> dict:
    """What each drawn line is called on the diagram."""
    if kind.endswith("prod"):
        return {"MPB": "D = MPB = MSB", "MPC": "S = MPC", "MSC": "MSC"}
    return {"MPB": "D = MPB", "MPC": "S = MPC = MSC", "MSB": "MSB"}


def draw(p: dict):
    kind, dq, dp = p["kind"], p["dq"], p["dp"]
    market, good, plural, singular, period = CONTEXTS[kind][p["ctx"]][:5]
    mpb, mpc, msb, msc = _lines(p)
    fig, ax = new_figure(6.4, 5.6)
    g.grid(ax, QX, PY, dq, dp, f"Quantity of {good} ({plural} per {period})", f"Costs and benefits (Frw per {singular})")
    board = g.Board(ax, QX, PY, dq, dp)
    lines = {"MPB": mpb, "MPC": mpc} | ({"MSC": msc} if kind.endswith("prod") else {"MSB": msb})
    ends = []
    for gid, (p0, slope) in lines.items():
        style = "--" if gid.startswith("MS") else "-"
        ends.append((_names(kind)[gid], board.line(p0, slope, gid, style), slope))
    # The four points sit on gridline crossings and are read from the grid, as in the market diagram's shift sub-type:
    # dotted guides to the axes from two of them crowded the curves' names off the grid.
    for letter, (q, v) in p["points"].items():
        ax.plot([q * dq], [v * dp], "o", color=INK, markersize=5.5, zorder=4)
        board.block(q - 0.15, q + 0.15, v - 0.2, v + 0.2)
    for letter, (q, v) in p["points"].items():
        others = [pt for k, pt in p["points"].items() if k != letter]
        if not board.label(letter, q, v, 11.5, gap=0.12, pad=0.05, others=others,
                           where=[(1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1)]):
            raise ValueError("no room for a point's letter")
    for name, end, slope in ends:
        board.end_label(name, end, slope, size=10)
    ax.set_title(market[0].upper() + market[1:], fontsize=10.5)
    return fig


VERBS = ["studies", "is given", "draws", "copies", "looks at", "works from"]
SETTINGS = ["in an economics lesson", "for homework", "on a revision card", "for a class test", "at the economics club",
            "before an exam", "in a study group in Huye", "while revising in Kigali"]


def _forms(n: int, unit: str) -> list[str]:
    forms = [str(n), f"{n} {unit}"]
    if n >= 1000:
        forms += [frw(n), f"{n:,}", f"{frw(n)} {unit}"]
    return forms


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    kind, dq, dp = p["kind"], p["dq"], p["dp"]
    market, good, plural, singular, period, _, _, story = CONTEXTS[kind][p["ctx"]]
    roles = _roles(p)
    letter = {tuple(v): k for k, v in p["points"].items()}
    at = lambda name: letter[(int(roles[name][0]), int(roles[name][1]))]  # noqa: E731
    qm, qs = int(roles["market"][0]), int(roles["social"][0])
    word = "cost" if kind.startswith("neg") else "benefit"
    unit = f"{plural} per {period}"
    opening = f"{who} {rng.choice(VERBS)} this diagram of {market} {rng.choice(SETTINGS)}. {story} "
    if p["ask"] == "market":
        first = short(f"{opening}If the market is left to itself, with no government action, what quantity of {good} is "
                      f"bought and sold, in {unit}?", qm * dq, _forms(qm * dq, plural))
    else:
        first = short(f"{opening}What is the socially optimal output of {good}, in {unit}?", qs * dq, _forms(qs * dq, plural))
    per_unit = p["e"] * dp
    loss = abs(qs - qm) * dq * per_unit // 2
    corners = sorted(at(n) for n in ("market", "third", "social"))
    return [
        first,
        mcq(f"In {market}, which point shows the socially optimal level of output?", f"Point {at('social')}",
            [f"Point {k}" for k in "ABCD" if k != at("social")], rng),
        short(f"In {market}, what is the external {word} of each unit of {good}, in Frw per {singular}?", per_unit,
              money(per_unit)),
        short(f"In {market}, the welfare loss from leaving the market to itself is the area of the triangle with corners at "
              f"points {corners[0]}, {corners[1]} and {corners[2]}, and the area of a triangle = ½ × base × height. What "
              f"is the welfare loss, in Frw per {period}?", loss, money(loss)),
    ]
