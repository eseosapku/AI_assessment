"""Break-even chart: fixed costs, total costs and revenue. Break-even falls on a gridline."""
from __future__ import annotations

import random

from ..core import GRID, new_figure, short

ID = "break_even"
KIND = "econ.curve"
SUBJECT = "business"
BANDS = ("UP",)

FIRMS = ["a bakery", "a tailoring workshop", "a juice stall", "a printing shop", "a furniture maker"]


def sample(rng: random.Random) -> dict:
    while True:
        price = rng.choice([4, 5, 6, 8, 10])
        var = rng.choice([v for v in (1, 2, 3, 4, 5, 6) if v < price])
        units = rng.choice([200, 300, 400, 500])  # break-even output
        fixed = (price - var) * units
        # Fixed costs on a labelled $200 gridline, and the whole chart on one $200 scale.
        if fixed % 200 == 0 and price * units * 2 <= 4000:
            return {"firm": rng.choice(FIRMS), "price": price, "var": var, "fixed": fixed, "be": units}


def draw(p: dict):
    fig, ax = new_figure(6.0, 4.6)
    qmax = 2 * p["be"]
    q = [0, qmax]
    ax.plot(q, [p["fixed"]] * 2, color="#111111", linestyle=":", label="Fixed costs")
    ax.plot(q, [p["fixed"], p["fixed"] + p["var"] * qmax], color="#111111", linestyle="--", label="Total costs")
    ax.plot(q, [0, p["price"] * qmax], color="#111111", label="Total revenue")
    top = p["price"] * qmax
    ax.set_yticks(range(0, top + 200, 200))
    ax.set_xticks(range(0, qmax + 1, 100))
    ax.set_xlim(0, qmax)
    ax.set_ylim(0, top)
    ax.tick_params(labelsize=8)
    ax.grid(True, color=GRID, linewidth=0.5)
    ax.set_axisbelow(True)
    ax.set_xlabel("Output (units per month)")
    ax.set_ylabel("Costs and revenue ($)")
    ax.legend(loc="upper left", fontsize=9, frameon=False)
    ax.set_title(f"Break-even chart for {p['firm']}")
    return fig


def questions(p: dict, rng: random.Random) -> list:
    # Above break-even, so the answer is a profit, and on the chart, which ends at twice break-even.
    q = p["be"] + rng.choice([d for d in (100, 200, 300) if d <= p["be"]])
    profit = (p["price"] - p["var"]) * q - p["fixed"]
    return [
        short("What are the fixed costs, in $?", p["fixed"], [f"${p['fixed']}"]),
        short("What is the break-even output, in units?", p["be"], [f"{p['be']} units"]),
        short(f"Each unit sells for ${p['price']} and has a variable cost of ${p['var']}. What profit is made at an output of {q} units, in $?",
              profit, [f"${profit}"]),
    ]
