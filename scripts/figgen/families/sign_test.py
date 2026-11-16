"""Non-parametric tests on a small data table (AL): the sign test and the Wilcoxon signed-rank test, on one sample
against a stated median or on paired before-and-after values, as Cambridge AS & A Level Further Mathematics
"Non-parametric tests" teaches them.

The figure prints the data, the hypotheses, the significance level (one-tailed) and what the test needs from the
tables: for the sign test, P(X <= k) for X ~ B(n, 0.5) at every k up to n/2; for the Wilcoxon test, how P, Q and T are
defined, the decision rule and the critical value from the standard table. No difference is zero, and in a Wilcoxon
figure no two differences have the same size, so the ranks are never shared. The data always lean the way H1 says, so
T (the smaller rank sum) is the sum for the sign H1 expects to be rare; no p-value lies within 0.005 of the level and
no T equals its critical value.
"""
from __future__ import annotations

import math
import random
from decimal import ROUND_HALF_UP, Decimal
from fractions import Fraction

from matplotlib.patches import Rectangle

from ..core import FILL_2, INK, NAMES, count, mcq, new_figure, short

ID = "sign_test"
KIND = "table.data"
SUBJECT = "mathematics"
BANDS = ("AL",)
CONCEPTS = tuple(f"mathematics.{c}" for c in ("hypothesis-tests-means", "median", "sign-test-single-sample",
                                                "wilcoxon-signed-rank-test"))
# The Further Mathematics chapter lists its sections: a sign test or a Wilcoxon test is named there.
NEEDS = r"sign test|wilcoxon|non-parametric"
# Only a chapter named for these tests: "Types of data" (median) and the binomial chapters share a concept but no test.
AVOID = r"^(?!.*(non-parametric|sign test|wilcoxon))"

MINUS = "−"
# The standard table of critical values of T for the Wilcoxon signed-rank test, one-tailed.
WILCOXON = {8: {"5%": 5, "2.5%": 3}, 9: {"5%": 8, "2.5%": 5}, 10: {"5%": 10, "2.5%": 8}, 11: {"5%": 13, "2.5%": 10},
            12: {"5%": 17, "2.5%": 13}}
# (row label, what was recorded for the stem, range of the median tested, the largest difference)
SINGLE = [
    ("Time (s)", "the times, in seconds, that {n} pupils took to finish a puzzle", (40, 80), 25),
    ("Mass (g)", "the masses, in grams, of {n} packets of beans from a Musanze cooperative", (480, 520), 20),
    ("Customers", "the numbers of customers at a Kigali shop on {n} days", (40, 80), 25),
    ("Height (cm)", "the heights, in cm, of {n} maize plants on a Huye farm", (120, 180), 30),
    ("Wait (min)", "the waiting times, in minutes, of {n} patients at a health centre", (25, 40), 18),
    ("Mark", "the marks of {n} students in a mathematics test", (45, 65), 25),
    ("Length (mm)", "the lengths, in mm, of {n} leaves from one avocado tree", (60, 90), 22),
    ("Speed (km/h)", "the speeds, in km/h, of {n} cars passing a school in Rubavu", (35, 55), 20),
    ("Eggs", "the numbers of eggs collected on a Nyagatare farm on {n} days", (60, 90), 20),
]
# (plural, row label for each one, value label, what was recorded, range of the before values, largest difference,
# the way the change is expected to go: H1 says so, and the data lean that way)
PAIRED = [
    ("students", "Student", "Mark", "the marks of {n} students before and after a revision course", (30, 70), 16, "greater"),
    ("runners", "Runner", "Time (s)", "the 400 m times, in seconds, of {n} runners before and after a training programme",
     (60, 90), 12, "less"),
    ("plots", "Plot", "Yield (kg)", "the yields, in kg, of {n} plots of beans before and after a new fertiliser was used",
     (20, 50), 14, "greater"),
    ("drivers", "Driver", "Time (ms)", "the reaction times, in ms, of {n} drivers before and after a long journey",
     (200, 300), 30, "greater"),
    ("clerks", "Clerk", "Words/min", "the typing speeds, in words per minute, of {n} clerks before and after a typing course",
     (25, 45), 14, "greater"),
    ("people", "Person", "Mass (kg)", "the masses, in kg, of {n} people before and after a fitness course", (60, 90), 12,
     "less"),
    ("patients", "Patient", "Pulse", "the resting pulse rates, in beats per minute, of {n} patients before and after an "
     "exercise course", (65, 90), 14, "less"),
    ("cows", "Cow", "Milk (litres)", "the daily milk yields, in litres, of {n} cows before and after a change of feed",
     (8, 20), 6, "greater"),
]


def _cum(n: int, k: int) -> Fraction:
    return Fraction(sum(math.comb(n, i) for i in range(k + 1)), 2 ** n)


def _r4(f: Fraction) -> str:
    return str((Decimal(f.numerator) / Decimal(f.denominator)).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP))


def diffs(p: dict) -> list[int]:
    if p["paired"]:
        return [a - b for b, a in zip(p["before"], p["after"])]
    return [x - p["m0"] for x in p["values"]]


def ranks(d: list[int]) -> tuple[int, int]:
    """P and Q: the sums of the ranks of the positive and of the negative differences (ranked by size)."""
    order = sorted(abs(x) for x in d)
    r = {v: i + 1 for i, v in enumerate(order)}
    return sum(r[abs(x)] for x in d if x > 0), sum(r[abs(x)] for x in d if x < 0)


def _sign_data(rng: random.Random, n: int, h1: str, alpha: Fraction, spread: int):
    """The size of each difference and the number of differences of the sign H1 says is rare."""
    reject = rng.random() < 0.5
    ks = [k for k in range(n // 2) if abs(_cum(n, k) - alpha) >= Fraction(5, 1000) and (_cum(n, k) < alpha) == reject]
    if not ks:
        return None
    few = rng.choice(ks)
    rare = 1 if h1 == "less" else -1  # H1 "less": few values above, so few positive differences
    signs = [rare] * few + [-rare] * (n - few)
    return [s * rng.randint(1, spread) for s in signs]


def _wilcoxon_data(rng: random.Random, n: int, h1: str, cv: int, spread: int):
    mags = sorted(rng.sample(range(1, max(spread, n + 6) + 1), n))
    reject = rng.random() < 0.5
    total = n * (n + 1) // 2
    for _ in range(400):
        j = rng.randint(1, max(1, n // 2 - 1))
        pool = list(range(1, (cv + 1 if reject else n) + 1))
        if len(pool) < j:
            continue
        chosen = rng.sample(pool, j)
        t = sum(chosen)
        if t == cv or (t <= cv) != reject or 2 * t >= total:
            continue
        rare = 1 if h1 == "less" else -1
        return [(rare if r in chosen else -rare) * mags[r - 1] for r in range(1, n + 1)]
    return None


def sample(rng: random.Random) -> dict:
    while True:
        sub = rng.choice(["sign", "wilcoxon"])
        paired = rng.random() < 0.5
        h1 = rng.choice(["greater", "less"])
        ctx = rng.randrange(len(PAIRED if paired else SINGLE))
        spread = PAIRED[ctx][5] if paired else SINGLE[ctx][3]
        if paired:
            h1 = PAIRED[ctx][6]
        if sub == "sign":
            n = rng.randint(8, 14)
            alpha = rng.choice(["5%", "10%"])
            d = _sign_data(rng, n, h1, Fraction(alpha.rstrip("%")) / 100, spread)
            crit = None
        else:
            n = rng.randint(8, 12)
            alpha = rng.choice(["5%", "2.5%"])
            crit = WILCOXON[n][alpha]
            d = _wilcoxon_data(rng, n, h1, crit, spread)
        if d is None:
            continue
        rng.shuffle(d)
        p = {"band": "AL", "sub": sub, "paired": paired, "context": ctx, "h1": h1, "alpha": alpha,
             "name": rng.choice(NAMES)}
        if crit is not None:
            p["crit"] = crit
        if paired:
            lo, hi = PAIRED[ctx][4]
            before = [rng.randint(lo, hi) for _ in d]
            p.update(before=before, after=[b + x for b, x in zip(before, d)])
        else:
            lo, hi = SINGLE[ctx][2]
            m0 = rng.randint(lo, hi)
            if m0 - spread < 1:
                continue
            p.update(m0=m0, values=[m0 + x for x in d])
        return p


# --- drawing -------------------------------------------------------------------------------------------------------

def _cell(ax, x, y, w, h, text, head=False, gid=None):
    ax.add_patch(Rectangle((x, y), w, h, facecolor=FILL_2 if head else "white", edgecolor=INK, linewidth=1))
    ax.text(x + w / 2, y + h / 2, text, ha="center", va="center", fontsize=10, fontweight="bold" if head else "normal",
            gid=gid)


def draw(p: dict):
    n = len(diffs(p))
    head_w, w, h = 1.9, 0.62, 0.42
    width = head_w + n * w
    rows: list[tuple[str, list[str]]] = []
    if p["paired"]:
        plural, who, label, *_ = PAIRED[p["context"]]
        rows = [(who, [chr(65 + i) for i in range(n)]), (f"Before: {label}", [str(v) for v in p["before"]]),
                (f"After: {label}", [str(v) for v in p["after"]])]
        head_w = 2.5
        width = head_w + n * w
    else:
        rows = [(SINGLE[p["context"]][0], [str(v) for v in p["values"]])]
    lines = []
    if p["paired"]:
        lines.append("d = after " + MINUS + " before")
        lines.append("H₀: population median of d = 0")
        lines.append(f"H₁: population median of d {'>' if p['h1'] == 'greater' else '<'} 0")
    else:
        lines.append(f"H₀: population median = {p['m0']}")
        lines.append(f"H₁: population median {'>' if p['h1'] == 'greater' else '<'} {p['m0']}")
    lines.append(f"Significance level: {p['alpha']} (one-tailed)")
    if p["sub"] == "wilcoxon":
        lines.append("Rank the differences d by size, ignoring their signs." if p["paired"] else
                     f"Difference = value {MINUS} {p['m0']}; rank the differences by size, ignoring their signs.")
        lines.append("P = sum of the ranks of the positive differences")
        lines.append("Q = sum of the ranks of the negative differences")
        lines.append("T = the smaller of P and Q; reject H₀ if T ≤ the critical value")
        lines.append(f"Critical value of T for n = {n}, one-tailed {p['alpha']}: {p['crit']}")
    top = len(rows) * h
    gap = 0.35
    text_h = 0.36 * len(lines)
    table_h = 2 * h + 0.45 if p["sub"] == "sign" else 0
    height = top + gap + text_h + (gap + table_h if table_h else 0)
    width = max(width, 7.2)
    fig, ax = new_figure(width, height)
    fig.subplots_adjust(left=0, right=1, bottom=0, top=1)  # a unit is an inch: the table's cells fit their numbers
    y = height - top
    for i, (label, cells) in enumerate(rows):
        ry = y + (len(rows) - 1 - i) * h
        _cell(ax, 0, ry, head_w, h, label, head=True)
        for j, c in enumerate(cells):
            _cell(ax, head_w + j * w, ry, w, h, c, head=p["paired"] and i == 0, gid=f"data:{i}:{j}")
    y -= gap
    for k, line in enumerate(lines):
        ax.text(0, y - 0.36 * k - 0.18, line, ha="left", va="center", fontsize=10, gid=f"rule:{k}")
    y -= text_h
    if p["sub"] == "sign":
        y -= gap
        ax.text(0, y - 0.2, f"Cumulative binomial probabilities, X ~ B({n}, 0.5):", ha="left", va="center", fontsize=10)
        ks = list(range(n // 2 + 1))
        cw, lw = 0.82, 1.2
        by = y - 0.45 - 2 * h
        _cell(ax, 0, by + h, lw, h, "k", head=True)
        _cell(ax, 0, by, lw, h, "P(X ≤ k)", head=True)
        for j, k in enumerate(ks):
            _cell(ax, lw + j * cw, by + h, cw, h, str(k))
            _cell(ax, lw + j * cw, by, cw, h, _r4(_cum(n, k)), gid=f"binom:{k}")
    ax.set_xlim(-0.05, width + 0.05)
    ax.set_ylim(-0.05, height + 0.05)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


# --- questions -----------------------------------------------------------------------------------------------------

def questions(p: dict, rng: random.Random) -> list:
    d = diffs(p)
    n = len(d)
    pos, neg = sum(x > 0 for x in d), sum(x < 0 for x in d)
    few = neg if p["h1"] == "greater" else pos
    alpha = Fraction(p["alpha"].rstrip("%")) / 100
    if p["paired"]:
        plural = PAIRED[p["context"]][0]
        what = PAIRED[p["context"]][3].format(n=n)
        unit = f"{n} pairs"
    else:
        what = SINGLE[p["context"]][1].format(n=n)
        unit = f"{n} values"
    lead = f"{p['name']} recorded {what}."
    test = "sign test" if p["sub"] == "sign" else "Wilcoxon signed-rank test"
    concl = f"A {test} is carried out on the {unit} shown. Which is the correct conclusion of the test at the {p['alpha']} " \
            "significance level?"
    if p["sub"] == "sign":
        word = rng.choice(["above", "below"]) if not p["paired"] else rng.choice(["higher", "lower"])
        got = pos if word in ("above", "higher") else neg
        # A count is accepted with its noun too ("5 values", "3 runners", "1 person"), as a student writes it.
        if p["paired"]:
            who = PAIRED[p["context"]][1].lower()
            q1 = count(f"{lead} For how many of the {n} {plural} is the after value {word} than the before value?", got,
                       plural if got != 1 else who)
        else:
            q1 = count(f"{lead} How many of the {n} values are {word} {p['m0']}?", got, "values")
        pv = _r4(_cum(n, few))
        other = _r4(_cum(n, few - 1 if few >= 1 else few + 1))
        q2 = short(f"The data and a table of P(X ≤ k) for X ~ B({n}, 0.5) are shown. Use the table to find the p-value of "
                   "the sign test.", pv, [format(Decimal(pv).normalize(), "f")])
        reject = _cum(n, few) < alpha
        opts = [f"p-value {v}, so {'reject' if r else 'do not reject'} H₀" for v in (pv, other) for r in (True, False)]
        key = f"p-value {pv}, so {'reject' if reject else 'do not reject'} H₀"
        q3 = mcq(concl, key, [o for o in opts if o != key], rng)
        return [q1, q2, q3]
    P, Q = ranks(d)
    T = min(P, Q)
    letter = rng.choice("PQ")
    q1 = short(f"{lead} Find {letter}, the sum of the ranks of the {'positive' if letter == 'P' else 'negative'} differences.",
               P if letter == "P" else Q)
    q2 = short(f"A Wilcoxon signed-rank test is carried out on the {unit} shown. Find the value of the Wilcoxon test "
               "statistic T.", T)
    reject = T <= p["crit"]
    opts = [f"T = {v}, so {'reject' if r else 'do not reject'} H₀" for v in (T, max(P, Q)) for r in (True, False)]
    key = f"T = {T}, so {'reject' if reject else 'do not reject'} H₀"
    q3 = mcq(concl, key, [o for o in opts if o != key], rng)
    return [q1, q2, q3]
