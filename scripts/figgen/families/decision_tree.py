"""Decision trees (AL): a Rwandan firm choosing between two projects, drawn as Cambridge AS & A Level Business draws a
decision tree: a square decision node, a branch for each option with its cost, a circle chance node on each, and two
or three outcome branches with their probabilities (in tenths, adding to 1) and payoffs at the ends, every amount in
Frw million.

The expected value of a named option after its cost (the method in the stem), and the option the firm should choose
with its expected value (an MCQ in a balanced two-by-two: either option, with its expected value after costs or
before them). The two expected values after costs differ by at least 2 million; in many trees the cost turns the
choice round, so the option with the larger expected value before costs is the wrong one.
"""
from __future__ import annotations

import random

from matplotlib.patches import Circle, Rectangle

from ..core import INK, NAMES, mcq, new_figure, short

ID = "decision_tree"
KIND = "process.flow"
SUBJECT = "business"
BANDS = ("AL",)
CONCEPTS = ("business.data-interpretation-and-decision-making", "business.investment-appraisal")
# A topic whose sections the book lists is reached only if one names what this figure teaches.
NEEDS = r"decision tree|expected value|strategic choice|decision.?making"
# AS Level chapters listed without sections that share investment appraisal but draw no decision trees.
AVOID = r"human resource|business finance|size of business|accounting fundamentals|for more detailed|business structure"

FIRMS = [
    ("a bakery in Huye", ["Open a second shop", "Buy a bigger oven", "Start home delivery"]),
    ("a hotel in Rubavu", ["Build a conference hall", "Add ten rooms", "Open a lakeside bar"]),
    ("a coffee cooperative in Nyamasheke", ["Buy a pulping machine", "Rent more land", "Open a coffee shop"]),
    ("a juice maker in Rwamagana", ["Launch a new flavour", "Advertise on radio", "Sell in Kigali"]),
    ("a bus company in Kigali", ["Open a new route", "Buy two new buses", "Start a parcel service"]),
    ("a dairy in Nyagatare", ["Start making cheese", "Build a cold store", "Buy more cows"]),
    ("a furniture workshop in Musanze", ["Export to Uganda", "Open a showroom", "Buy a planing machine"]),
]
OUTCOMES = [["Success", "Failure"], ["High demand", "Low demand"], ["High demand", "Medium demand", "Low demand"]]


def _option(rng: random.Random, name: str) -> list:
    labels = rng.choice(OUTCOMES)
    while True:
        probs = [rng.randint(1, 8) for _ in labels]
        if sum(probs) == 10:
            break
    payoffs = sorted((10 * rng.randint(1, 12) for _ in labels), reverse=True)
    if len(set(payoffs)) < len(payoffs):
        return _option(rng, name)
    return [name, 5 * rng.randint(1, 8), [[lab, pr, pay] for lab, pr, pay in zip(labels, probs, payoffs)]]


def values(opt: list) -> tuple[int, int]:
    """An option's expected value before and after its cost, in Frw million."""
    gross = sum(pr * pay for _, pr, pay in opt[2]) // 10
    return gross, gross - opt[1]


def sample(rng: random.Random) -> dict:
    firm, names = rng.choice(FIRMS)
    flip = rng.random() < 0.45  # the option with more before costs is the wrong choice after them
    while True:
        a, b = rng.sample(names, 2)
        opts = [_option(rng, a), _option(rng, b)]
        (ga, na), (gb, nb) = values(opts[0]), values(opts[1])
        if min(na, nb) <= 0 or abs(na - nb) < 2 or len({ga, gb, na, nb}) < 4:
            continue
        if ((ga > gb) != (na > nb)) != flip:
            continue
        return {"band": "AL", "firm": firm, "options": opts, "ask": rng.randrange(2)}


# --- drawing ----------------------------------------------------------------------------------------

def draw(p: dict):
    fig, ax = new_figure(8.4, 6.2)
    fig.subplots_adjust(left=0, right=1, bottom=0, top=1)
    ax.add_patch(Rectangle((-0.2, -0.2), 0.4, 0.4, facecolor="white", edgecolor=INK, linewidth=1.6, zorder=3))
    for k, (name, cost, outcomes) in enumerate(p["options"]):
        y0 = 1.65 if k == 0 else -1.65
        ax.plot([0.2, 0.8, 3.2], [0, y0, y0], color=INK, linewidth=1.4)
        ax.text(2.0, y0 + 0.2, name, ha="center", va="center", fontsize=9.5, fontweight="bold")
        ax.text(2.0, y0 - 0.2, f"Cost: {cost}", ha="center", va="center", fontsize=9.5)
        ax.add_patch(Circle((3.4, y0), 0.2, facecolor="white", edgecolor=INK, linewidth=1.6, zorder=3))
        n = len(outcomes)
        gap = 0.85 if n == 3 else 0.95  # each probability plainly under its own outcome
        for j, (label, prob, payoff) in enumerate(outcomes):
            y = y0 + gap * ((n - 1) / 2 - j)
            ax.plot([3.6, 4.2, 6.6], [y0, y, y], color=INK, linewidth=1.2)
            ax.text(5.4, y + 0.16, label, ha="center", va="center", fontsize=9)
            ax.text(5.4, y - 0.16, f"{prob / 10:.1f}", ha="center", va="center", fontsize=9, fontweight="bold")
            ax.text(6.7, y, str(payoff), ha="left", va="center", fontsize=10, fontweight="bold")
    ax.text(6.95, 2.95, "Payoff", ha="center", va="center", fontsize=9.5, style="italic")
    ax.text(-0.3, 3.45, f"Decision tree for {p['firm']}", ha="left", va="center", fontsize=11.5, fontweight="bold")
    notes = ["All amounts are in Frw million. Under each outcome is its probability.",
             "Square: the decision. Circle: a chance node, where the outcome is uncertain."]
    for i, line in enumerate(notes):
        ax.text(-0.3, -3.1 - 0.33 * i, line, ha="left", va="center", fontsize=8.5, color="#333333")
    ax.set_xlim(-0.4, 7.6)
    ax.set_ylim(-3.6, 3.7)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


VERBS = ["draws", "studies", "is given", "prepares", "checks"]
SETTINGS = ["for the owners", "for a board meeting", "for an A Level business lesson", "before the firm decides",
            "for a case study", "for homework"]


def _forms(v: int) -> list[str]:
    return [str(v), f"{v} million", f"Frw {v} million", f"{v} million Frw", f"{v}m", f"Frw {v}m",
            f"{v * 1_000_000}", f"{v * 1_000_000:,}", f"{v * 1_000_000:,}".replace(",", " ")]


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    opts = p["options"]
    (ga, na), (gb, nb) = values(opts[0]), values(opts[1])
    best, other = (0, 1) if na > nb else (1, 0)
    vals = {0: (ga, na), 1: (gb, nb)}
    options = [f"{opts[k][0]}: Frw {v} million" for k in (best, other) for v in vals[k]]
    key = f"{opts[best][0]}: Frw {vals[best][1]} million"
    asked = opts[p["ask"]]
    net = vals[p["ask"]][1]
    return [
        short(f"{who} {rng.choice(VERBS)} this decision tree for {p['firm']} {rng.choice(SETTINGS)}. Expected value = "
              f"the sum of (probability × payoff) − the cost of the option. What is the expected value of "
              f"\"{asked[0]}\", in Frw million?", net, _forms(net)),
        mcq(rng.choice([f"On expected values after costs, which option should {p['firm']} choose, and what is its "
                        f"expected value?",
                        f"Comparing expected values after costs, which option is better for {p['firm']}, and what is "
                        f"its expected value?"]), key, [o for o in options if o != key], rng),
    ]
