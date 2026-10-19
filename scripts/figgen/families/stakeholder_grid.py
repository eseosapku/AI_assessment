"""Stakeholder mapping (AL; Cambridge AS Level Business "Stakeholders in a business"): a power-interest grid (Mendelow's
matrix) for an invented Rwandan firm's plan, with six or seven stakeholders plotted as lettered points and a key
naming them. The grid is split at its middle on both axes and each quarter prints its strategy: high power and high
interest "Manage closely", high power and low interest "Keep satisfied", low power and high interest "Keep informed",
low power and low interest "Monitor".

Which of four stakeholders the firm should treat by a named strategy (exactly one option sits in that quarter); which
stakeholder has the most power (one plainly highest; the most interested is offered); and the strategy for a lettered
stakeholder (the four strategies as options), or how many stakeholders the firm should treat by a strategy. Points
sit two squares or more from the split lines, so no point is on a border, and the positions belong to the case, so
the figure decides every key. Each stakeholder's power suits it: shareholders, the government and the district
council have high power, competitors low, and only they or a lending bank hold the most power over the plan.
"""
from __future__ import annotations

import random

from matplotlib.patches import Circle, Rectangle

from ..core import GRID, INK, NAMES, mcq, new_figure, short

ID = "stakeholder_grid"
KIND = "diagram.template"
SUBJECT = "business"
BANDS = ("AL",)
CONCEPTS = ("business.stakeholders-definition",)
# A topic whose sections the book lists is reached only if its name or a section names stakeholders.
NEEDS = r"stakeholder"
# AS Level chapters listed without sections that share the concept but teach other things.
AVOID = r"external|communication|marketing|market research|e-commerce|globali"

FIRMS = [("Rusizi Cement", "build a second factory near Lake Kivu"), ("Kivu Lake Hotel", "add fifty rooms on the shore"),
         ("Huye Hill Dairy", "move its factory out of Huye town"), ("Ikaze Bus Company", "close three of its routes"),
         ("Umucyo Juice", "open a new factory in Rwamagana"), ("Akagera Tea Estate", "use machines to pick its tea"),
         ("Inzozi Bakery", "open twenty kiosks in Kigali"), ("Gishwati Furniture", "import its timber instead of buying locally")]
STAKEHOLDERS = ["Shareholders", "Employees", "Customers", "Suppliers", "Local community", "District council",
                "Bank (lender)", "Trade union", "Competitors", "Environmental group", "Government"]
SPOTS = [1, 2, 3, 7, 8, 9]  # interest
POWERS = [2, 3, 7, 8]  # power: clear of the quarter names along the top and bottom edges
# Power that suits the stakeholder (P4 blind review: competitors had the most power over a firm's own plan).
HIGH_POWER = {"Shareholders", "Government", "District council"}
LOW_POWER = {"Competitors"}
MOST_POWER = HIGH_POWER | {"Bank (lender)"}  # who may hold the most power over the plan
HIGH_INTEREST = {"Shareholders"}
STRATEGIES = ["Manage closely", "Keep satisfied", "Keep informed", "Monitor"]
AS_VERB = {"Manage closely": "manage closely", "Keep satisfied": "keep satisfied", "Keep informed": "keep informed",
           "Monitor": "monitor"}
AS_DONE = {"Manage closely": "managed closely", "Keep satisfied": "kept satisfied", "Keep informed": "kept informed",
           "Monitor": "monitored"}


def strategy(interest: int, power: int) -> str:
    if power > 5:
        return "Manage closely" if interest > 5 else "Keep satisfied"
    return "Keep informed" if interest > 5 else "Monitor"


def sample(rng: random.Random) -> dict:
    firm, plan = rng.choice(FIRMS)
    while True:
        k = rng.randint(6, 7)
        names = rng.sample(STAKEHOLDERS, k)
        cells = rng.sample([(x, y) for x in SPOTS for y in POWERS], k)
        powers = sorted((y for _, y in cells), reverse=True)
        if powers[0] == powers[1]:
            continue
        fits = all((y > 5 or n not in HIGH_POWER) and (y < 5 or n not in LOW_POWER) and (x > 5 or n not in HIGH_INTEREST)
                   for n, (x, y) in zip(names, cells))
        top = names[[y for _, y in cells].index(powers[0])]
        if not fits or top not in MOST_POWER:
            continue
        strats = [strategy(x, y) for x, y in cells]
        if len(set(strats)) < 3:
            continue
        points = [[letter, n, x, y] for letter, n, (x, y) in zip("ABCDEFG", names, cells)]
        return {"band": "AL", "firm": firm, "plan": plan, "points": points}


def draw(p: dict):
    fig, ax = new_figure(9.2, 6.4)
    fig.subplots_adjust(left=0, right=1, bottom=0, top=1)
    for v in range(11):
        ax.plot([v, v], [0, 10], color=GRID, linewidth=0.5, zorder=0)
        ax.plot([0, 10], [v, v], color=GRID, linewidth=0.5, zorder=0)
    ax.add_patch(Rectangle((0, 0), 10, 10, fill=False, edgecolor=INK, linewidth=1.4))
    ax.plot([5, 5], [0, 10], color=INK, linewidth=1.3, linestyle=(0, (5, 3)))
    ax.plot([0, 10], [5, 5], color=INK, linewidth=1.3, linestyle=(0, (5, 3)))
    # Each quarter's name sits at its outer edge, well away from the split lines (P4 blind review: names beside the
    # middle line were read as belonging to the quarter across it).
    for (x, y), text in (((2.5, 9.4), "Keep satisfied"), ((7.5, 9.4), "Manage closely"),
                         ((2.5, 0.6), "Monitor"), ((7.5, 0.6), "Keep informed")):
        ax.text(x, y, text, ha="center", va="center", fontsize=10.5, fontweight="bold", color="#333333",
                bbox={"boxstyle": "round,pad=0.25", "facecolor": "#fff6cc", "edgecolor": "#b8a650", "linewidth": 0.8})
    for letter, _, x, y in p["points"]:
        ax.add_patch(Circle((x, y), 0.36, facecolor="white", edgecolor=INK, linewidth=1.3, zorder=3))
        ax.text(x, y, letter, ha="center", va="center", fontsize=11, fontweight="bold", zorder=4)
    ax.text(5, -0.55, "Interest in the plan", ha="center", va="center", fontsize=11)
    ax.text(0, -0.55, "Low", ha="left", va="center", fontsize=9.5)
    ax.text(10, -0.55, "High", ha="right", va="center", fontsize=9.5)
    ax.text(-0.55, 5, "Power over the plan", ha="center", va="center", fontsize=11, rotation=90)
    ax.text(-0.55, 0.15, "Low", ha="center", va="bottom", fontsize=9.5, rotation=90)
    ax.text(-0.55, 9.85, "High", ha="center", va="top", fontsize=9.5, rotation=90)
    ax.text(5, 10.85, f"Power–interest grid: {p['firm']}'s plan to {p['plan']}", ha="center", va="center",
            fontsize=11.5, fontweight="bold")
    ax.text(10.8, 9.6, "Key", ha="left", va="center", fontsize=11, fontweight="bold")
    for i, (letter, name, _, _) in enumerate(p["points"]):
        ax.text(10.8, 8.8 - 0.75 * i, f"{letter}   {name}", ha="left", va="center", fontsize=10.5)
    ax.set_xlim(-1.0, 14.6)
    ax.set_ylim(-1.0, 11.3)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


VERBS = ["draws", "studies", "is given", "analyses", "reviews"]
SETTINGS = ["for the board", "before the plan is announced", "for an A Level business lesson", "for a case study",
            "for homework", "for the managing director"]


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    firm, pts = p["firm"], p["points"]
    strat = {n: strategy(x, y) for _, n, x, y in pts}
    filled = [s for s in STRATEGIES if any(v == s for v in strat.values())]
    want = rng.choice([s for s in filled if sum(v != s for v in strat.values()) >= 3])
    key = rng.choice([n for n, v in strat.items() if v == want])
    others = [n for n, v in strat.items() if v != want]
    rng.shuffle(others)
    strongest = max(pts, key=lambda r: r[3])[1]
    keen = max(pts, key=lambda r: (r[2], r[3]))[1]
    rest = [r[1] for r in pts if r[1] not in (strongest, keen)]
    rng.shuffle(rest)
    qs = [
        mcq(f"{who} {rng.choice(VERBS)} this power–interest grid for {firm} {rng.choice(SETTINGS)}. "
            f"Which of these stakeholders should {firm} {AS_VERB[want]}?", key, others, rng),
        mcq(f"On the power–interest grid for {firm}, which stakeholder has the most power over the plan?", strongest,
            [keen] + rest, rng),
    ]
    if rng.random() < 0.6:
        letter, name, x, y = rng.choice(pts)
        s = strategy(x, y)
        qs.append(mcq(f"Which strategy does the grid give for {firm}'s {name.lower()} (point {letter})?", s,
                      [t for t in STRATEGIES if t != s], rng))
    else:
        s = rng.choice(STRATEGIES)
        n = sum(v == s for v in strat.values())
        qs.append(short(f"How many stakeholders on the grid for {firm} should be {AS_DONE[s]}?", n,
                        [f"{n} stakeholders"] if n != 1 else ["1 stakeholder"]))
    return qs
