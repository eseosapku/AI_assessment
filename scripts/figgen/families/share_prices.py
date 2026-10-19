"""Share prices on a stock exchange (UP), for Rwanda S6 Entrepreneurship "Financial Markets", S4 "Financial
Institutions" and WAEC Commerce "Finance and banking". The companies are invented, never real listed ones. Two
sub-types:

- table: three or four companies' share prices at the end of each of six months, with each company's dividend per
  share for the year; dividend yield (%) = dividend per share ÷ share price × 100 printed under it.
- chart: two companies' share prices over six months as a line chart, every price on a gridline, each line named at
  its end, with the dividends per share and the yield formula printed above.

Asks how far one company's price rose or fell between two months (or what a number of its shares were worth in a
month), the percentage rise or fall between two months (formula in the stem, a whole number), and a dividend yield in a
month (whole or a half), or, on a table, which company gave the highest yield in a month (never the one paying the
biggest dividend, which is among the options; the best leads the next by half a point at least).
"""
from __future__ import annotations

import random
from fractions import Fraction

from ..core import GRID, INK, NAMES, mcq, money, new_figure, short
from .econ_tables import frw, titled_table

ID = "share_prices"
KIND = "business.document"
SUBJECT = "business"
BANDS = ("UP",)
CONCEPTS = ("business.financial-markets", "business.capital-market-and-instruments")
# A topic whose sections the book lists is reached only if its name or a section names markets for shares.
NEEDS = r"financial (market|institution)|capital market|stock exchange|shares|finance and banking"

COMPANIES = ["Hilltop Tea Ltd", "Lakeside Cement Ltd", "Unity Bank Ltd", "Greenfield Foods Ltd", "Bluewave Telecom Ltd",
             "Highland Coffee Ltd", "Riverside Insurance Ltd", "Kivu Transport Ltd"]
MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October",
          "November", "December"]
HOLDINGS = [100, 200, 250, 400, 500, 1000, 1500, 2000]


def _pct_pairs(prices: list) -> list[tuple[int, int]]:
    """Pairs of months (earlier, later) whose percentage change is a whole number and not zero."""
    return [(i, j) for i in range(len(prices)) for j in range(i + 1, len(prices))
            if prices[j] != prices[i] and (prices[j] - prices[i]) * 100 % prices[i] == 0]


def _yield_months(prices: list, div: int) -> list[int]:
    return [i for i, x in enumerate(prices) if Fraction(div * 100, x).denominator in (1, 2)]


def _dividend(rng: random.Random, prices: list) -> int:
    """A year's dividend per share of 2% to 10% of the first price, an even number of francs."""
    return max(2, round(prices[0] * rng.randint(2, 10) / 200) * 2)


def _walk(rng: random.Random, start: int, step: int, n: int, lo: int, hi: int) -> list[int]:
    out = [start]
    while len(out) < n:
        nxt = out[-1] + step * rng.choice([-2, -1, -1, 1, 1, 2])
        if lo <= nxt <= hi:
            out.append(nxt)
    return out


def sample(rng: random.Random) -> dict:
    kind = rng.choice(["table", "chart"])
    first = rng.choice([0, 6])
    months = MONTHS[first:first + 6]
    year = rng.choice([2024, 2025])
    while True:
        if kind == "table":
            k = rng.randint(3, 4)
            names = rng.sample(COMPANIES, k)
            comps = []
            for n in names:
                prices = _walk(rng, rng.randrange(200, 901, 20), 10, 6, 150, 1000)
                comps.append([n, prices, _dividend(rng, prices)])
            step = 10
        else:
            step = rng.choice([20, 50])
            names = rng.sample(COMPANIES, 2)
            top = 900 if step == 50 else 400
            comps = []
            for n in names:
                prices = _walk(rng, rng.randrange(7 * step, top - 2 * step + 1, step), step, 6, 5 * step, top)
                comps.append([n, prices, _dividend(rng, prices)])
            if abs(comps[0][1][-1] - comps[1][1][-1]) < 2 * step:
                continue  # the names at the lines' ends would crowd
            if any(abs(a - b) < step for a, b in zip(comps[0][1], comps[1][1])):
                continue  # two points nearly on top of each other read as one
        if not all(_pct_pairs(c[1]) and _yield_months(c[1], c[2]) for c in comps):
            continue
        if kind == "table":
            good = []
            for i in range(6):
                ys = sorted(((Fraction(c[2], c[1][i]), c[0]) for c in comps), reverse=True)
                biggest = max(comps, key=lambda c: c[2])[0]
                if ys[0][0] - ys[1][0] >= Fraction(1, 200) and ys[0][1] != biggest:
                    good.append(i)
            if len({c[2] for c in comps}) < len(comps) or not good:
                continue
        return {"band": "UP", "kind": kind, "months": months, "year": year, "companies": comps, "step": step}


def _draw_chart(p: dict):
    fig, ax = new_figure(7.4, 4.6)
    n = len(p["months"])
    styles = [{"marker": "o", "linestyle": "-"}, {"marker": "s", "linestyle": "--"}]
    step = p["step"]
    top = max(max(c[1]) for c in p["companies"]) + 2 * step
    for c, st in zip(p["companies"], styles):
        ax.plot(range(n), c[1], color=INK, linewidth=1.8, markersize=6, markerfacecolor="white", **st)
        ax.text(n - 1 + 0.15, c[1][-1], c[0], ha="left", va="center", fontsize=9)
    ax.set_xticks(range(n))
    ax.set_xticklabels(p["months"], fontsize=8.5)
    every = 1 if top // step <= 12 else 2
    ax.set_yticks(range(0, top + 1, step * every))
    ax.set_yticks(range(0, top + 1, step), minor=True)
    ax.tick_params(which="minor", length=0)
    ax.tick_params(axis="y", labelsize=8.5)
    ax.yaxis.grid(True, which="both", color=GRID, linewidth=0.7)
    ax.xaxis.grid(True, color=GRID, linewidth=0.5)
    ax.set_axisbelow(True)
    ax.set_xlim(-0.3, n - 1 + 2.1)
    ax.set_ylim(0, top)
    ax.set_ylabel("Share price (Frw)")
    ax.set_xlabel(f"Month ({p['year']}, price at the end of each month)", fontsize=9.5)
    divs = ";   ".join(f"{c[0]}: {c[2]} Frw" for c in p["companies"])
    ax.set_title(f"Share prices of two companies on a stock exchange\nDividend per share for the year:  {divs}\n"
                 "Dividend yield (%) = dividend per share ÷ share price × 100", fontsize=9.5, pad=10)
    return fig


def draw(p: dict):
    if p["kind"] == "chart":
        return _draw_chart(p)
    heads = ["Company"] + [m[:3] for m in p["months"]] + ["Dividend per\nshare (Frw)"]
    body = [[c[0]] + [str(x) for x in c[1]] + [str(c[2])] for c in p["companies"]]
    return titled_table(f"Share prices (Frw) at the end of each month, {p['year']}", heads, body,
                        ["l"] + ["r"] * 7, notes=["Dividend yield (%) = dividend per share ÷ share price × 100"],
                        least=0.7)


VERBS = ["follows", "studies", "is given", "tracks", "compares", "reads"]
SETTINGS = ["for an entrepreneurship lesson", "before buying shares", "for a project on the stock exchange",
            "for a savings club", "for homework", "for a class debate on investing"]


def _yield(div: int, price: int) -> str:
    y = Fraction(div * 100, price)
    return str(y.numerator) if y.denominator == 1 else f"{float(y):g}"


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    months, comps = p["months"], p["companies"]
    intro = f"{who} {rng.choice(VERBS)} these share prices {rng.choice(SETTINGS)}. "
    a, b, c = (rng.choice(comps) for _ in range(3))
    # the change, or what a holding was worth
    if rng.random() < 0.5:
        i, j = sorted(rng.sample(range(6), 2))
        while a[1][i] == a[1][j]:
            i, j = sorted(rng.sample(range(6), 2))
        d = a[1][j] - a[1][i]
        word = "rise" if d > 0 else "fall"
        first = short(intro + f"By how many francs did the price of one {a[0]} share {word} from {months[i]} to "
                      f"{months[j]}?", abs(d), money(abs(d)))
    else:
        i, n = rng.randrange(6), rng.choice(HOLDINGS)
        v = n * a[1][i]
        first = short(intro + f"What were {frw(n)} shares in {a[0]} worth at the end of {months[i]}, in Frw?", v,
                      money(v))
    i, j = rng.choice(_pct_pairs(b[1]))
    pc = (b[1][j] - b[1][i]) * 100 // b[1][i]
    word = "rise" if pc > 0 else "fall"
    second = short(f"Percentage change = change in price ÷ price at the start × 100. By what percentage did the price of "
                   f"one {b[0]} share {word} from {months[i]} to {months[j]}?", abs(pc),
                   [f"{abs(pc)}%", f"{abs(pc)} %", f"{abs(pc)} percent"])
    if p["kind"] == "table" and rng.random() < 0.5:
        good = []
        biggest = max(comps, key=lambda x: x[2])[0]
        for k in range(6):
            ys = sorted(((Fraction(x[2], x[1][k]), x[0]) for x in comps), reverse=True)
            if ys[0][0] - ys[1][0] >= Fraction(1, 200) and ys[0][1] != biggest:
                good.append((k, ys[0][1]))
        k, best = rng.choice(good)
        others = [biggest] + [x[0] for x in comps if x[0] not in (best, biggest)]
        third = mcq(rng.choice([f"Which company's shares gave the highest dividend yield at the end of {months[k]}?",
                                f"At the end of {months[k]}, which company's shares had the highest dividend yield?"]),
                    best, others, rng)
    else:
        k = rng.choice(_yield_months(c[1], c[2]))
        y = _yield(c[2], c[1][k])
        third = short(f"What was the dividend yield on {c[0]} shares at the end of {months[k]}, in %?", y,
                      [f"{y}%", f"{y} %", f"{y} percent"])
    return [first, second, third]
