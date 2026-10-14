"""A discrete probability distribution drawn as a stick graph with one stick missing: the missing
probability, a cumulative probability, E(X) and the most likely value (AL).

Every probability is a multiple of 0.05 on a 0.05 grid, they sum to 1, the missing one is from 0.05
to 0.5, and a single value is most likely.
"""
from __future__ import annotations

import random
from fractions import Fraction

from ..core import GRID, INK, NAMES, frac, new_figure, num, short

ID = "prob_distribution"
KIND = "graph.bar"
SUBJECT = "mathematics"
BANDS = ("AL",)
CONCEPTS = tuple(f"mathematics.{c}" for c in ("discrete-random-variables", "cumulative-distribution-function"))
# A discrete distribution: not continuous random variables, nor factorials.
AVOID = r"continuous|factorial|the range"
# what X counts, and its least value
CONTEXTS = [("the number of goals a team scores in a match", 0), ("the number of children in a family", 1),
            ("the number of buses that arrive late in a morning", 0), ("the score on a biased five-sided spinner", 1),
            ("the number of matches a team wins in a four-match tournament", 0), ("the number of eggs a hen lays in a week", 1)]


def sample(rng: random.Random) -> dict:
    ci = rng.randrange(len(CONTEXTS))
    start = CONTEXTS[ci][1]
    while True:
        cuts = sorted(rng.sample(range(1, 20), 4))
        tw = [b - a for a, b in zip([0, *cuts], [*cuts, 20])]
        if tw.count(max(tw)) != 1:
            continue
        k = rng.choice([i for i, v in enumerate(tw) if v <= 10])
        return {"band": "AL", "context": ci, "xs": list(range(start, start + 5)), "twentieths": tw, "missing": start + k,
                "name": rng.choice(NAMES)}


def _forms(f: Fraction) -> tuple[str, list[str]]:
    return num(f), [frac(f)]


def draw(p: dict):
    xs, tw, k = p["xs"], p["twentieths"], p["missing"]
    top = max(tw) / 20
    fig, ax = new_figure(5.8, 4.4)
    for x, v in zip(xs, tw):
        if x != k:
            ax.bar([x], [v / 20], width=0.14, color=INK)
    ax.text(k, 0.02, "?", ha="center", va="bottom", fontsize=15, fontweight="bold")
    y1 = (int(top * 20) + 1) / 20
    ax.set_yticks([i / 10 for i in range(int(y1 * 10) + 1)])
    ax.set_yticks([i / 20 for i in range(int(y1 * 20) + 1)], minor=True)
    ax.yaxis.grid(True, which="both", color=GRID, linewidth=0.6)
    ax.set_axisbelow(True)
    ax.set_xticks(xs)
    ax.set_xlim(xs[0] - 0.7, xs[-1] + 0.7)
    ax.set_ylim(0, y1)
    ax.set_xlabel("x")
    ax.set_ylabel("P(X = x)")
    ax.tick_params(labelsize=9)
    return fig


def questions(p: dict, rng: random.Random) -> list:
    xs, k = p["xs"], p["missing"]
    P = {x: Fraction(v, 20) for x, v in zip(xs, p["twentieths"])}
    what = CONTEXTS[p["context"]][0]
    key, forms = _forms(P[k])
    missing = short(f"{p['name']} drew the probability distribution of X, {what}. One stick is missing. Find P(X = {k}).",
                    key, forms)
    t = rng.choice(xs[1:-1])
    sign = rng.choice("≥≤")
    want = sum(v for x, v in P.items() if (x >= t if sign == "≥" else x <= t))
    key, forms = _forms(want)
    tail = short(f"Find P(X {sign} {t}).", key, forms)
    mean_v = sum(x * v for x, v in P.items())
    key, forms = _forms(mean_v)
    mean = short("Find E(X).", key, forms + ([f"{float(mean_v):.2f}"] if f"{float(mean_v):.2f}" != key else []))
    mode = short("What is the most likely value of X?", max(P, key=P.get), [f"X = {max(P, key=P.get)}"])
    return [missing, tail, mean, mode]
