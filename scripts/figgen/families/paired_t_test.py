"""A paired t-test or a t confidence interval from a small table of paired data (AL), as Cambridge AS & A Level Further
Mathematics "Inferential statistics" teaches them: the differences d = after - before, their mean, the unbiased estimate
of their variance, the test statistic t = mean / sqrt(s^2 / n) and its conclusion against the printed critical value,
or the ends and width of the interval mean +/- t sqrt(s^2 / n).

Five to eight pairs, whole numbers. The mean of d has at most two decimal places and s^2 at most three, so both are
exact; t and the interval are asked to 3 significant figures with a tolerance of one unit in the third figure. The
figure prints the hypotheses, the level, the formula and the t value from the tables (with its degrees of freedom).
No t lies within 0.1 of its critical value, and the data lean the way H1 says.
"""
from __future__ import annotations

import math
import random
from decimal import Decimal
from fractions import Fraction

from matplotlib.patches import Rectangle

from ..core import FILL_2, INK, NAMES, mcq, new_figure, short

ID = "paired_t_test"
KIND = "table.data"
SUBJECT = "mathematics"
BANDS = ("AL",)
CONCEPTS = tuple(f"mathematics.{c}" for c in ("t-distribution", "confidence-intervals-mean", "hypothesis-tests-means"))
# The Further Mathematics chapter lists its sections; a t-test or a small-sample interval is named there.
NEEDS = r"t-distribution|t-tests?\b|difference in means|small sample"
AVOID = r"non-parametric|chi-squared|types of data"

MINUS = "−"
# Upper percentage points of the t-distribution, by degrees of freedom.
T_TABLE = {4: {"5%": "2.132", "2.5%": "2.776", "1%": "3.747"}, 5: {"5%": "2.015", "2.5%": "2.571", "1%": "3.365"},
           6: {"5%": "1.943", "2.5%": "2.447", "1%": "3.143"}, 7: {"5%": "1.895", "2.5%": "2.365", "1%": "2.998"}}
CI_TAIL = {"95%": "2.5%", "90%": "5%"}
# (plural, each one, what is measured, what was recorded, range of the before values, largest change, the way the
# change is expected to go: a training programme cuts times, a fertiliser raises yields)
CONTEXTS = [
    ("students", "Student", "Mark", "the marks of {n} students before and after a revision course", (30, 70), 12, "greater"),
    ("runners", "Runner", "Time (s)", "the 400 m times, in seconds, of {n} runners before and after a training programme",
     (60, 90), 8, "less"),
    ("plots", "Plot", "Yield (kg)", "the yields, in kg, of {n} plots of beans before and after a new fertiliser was used",
     (20, 50), 9, "greater"),
    ("drivers", "Driver", "Time (ms)", "the reaction times, in ms, of {n} drivers before and after a long journey",
     (200, 300), 20, "greater"),
    ("clerks", "Clerk", "Words/min", "the typing speeds, in words per minute, of {n} clerks before and after a typing course",
     (25, 45), 10, "greater"),
    ("people", "Person", "Mass (kg)", "the masses, in kg, of {n} people before and after a fitness course", (60, 90), 7,
     "less"),
    ("patients", "Patient", "Pulse", "the resting pulse rates, in beats per minute, of {n} patients before and after an "
     "exercise course", (65, 90), 10, "less"),
    ("cows", "Cow", "Milk (litres)", "the daily milk yields, in litres, of {n} cows before and after a change of feed",
     (8, 20), 6, "greater"),
    ("shops", "Shop", "Sales", "the numbers of loaves sold by {n} Kigali shops in a week before and after an advert",
     (40, 90), 15, "greater"),
]


def _dec(f: Fraction) -> str:
    return format((Decimal(f.numerator) / Decimal(f.denominator)).normalize(), "f")


def _sig3(x: float) -> str:
    """To 3 significant figures, keeping the zeros a student writes: 2.00, 12.3, 0.0420."""
    return f"{x:#.3g}".rstrip(".")


def stats(p: dict) -> tuple[Fraction, Fraction, float]:
    d = [Fraction(a - b) for b, a in zip(p["before"], p["after"])]
    n = len(d)
    mean = sum(d) / n
    s2 = sum((x - mean) ** 2 for x in d) / (n - 1)
    return mean, s2, math.sqrt(s2 / n)


def sample(rng: random.Random) -> dict:
    sub = rng.choice(["test", "ci"])
    ctx = rng.randrange(len(CONTEXTS))
    lo, hi = CONTEXTS[ctx][4]
    big = CONTEXTS[ctx][5]
    p = {"band": "AL", "sub": sub, "context": ctx, "name": rng.choice(NAMES)}
    if sub == "test":
        p.update(h1=CONTEXTS[ctx][6], alpha=rng.choice(["5%", "2.5%", "1%"]))
        reject = rng.random() < 0.5
    else:
        p["ci"] = rng.choice(["95%", "90%"])
    while True:
        n = rng.randint(5, 8)
        sign = 1 if CONTEXTS[ctx][6] == "greater" else -1
        mu = rng.randint(1, max(2, big // 2))
        spread = rng.randint(2, big)
        d = [sign * mu + rng.randint(-spread, spread) for _ in range(n)]
        if 0 in d and rng.random() < 0.7:
            continue
        p["before"] = [rng.randint(lo, hi) for _ in d]
        p["after"] = [b + x for b, x in zip(p["before"], d)]
        if min(p["after"]) < 1:
            continue
        mean, s2, se = stats(p)
        if s2 == 0 or (mean * 100).denominator != 1 or (s2 * 1000).denominator != 1 or mean == 0:
            continue
        t = float(mean) / se
        if sub == "test":
            crit = float(T_TABLE[n - 1][p["alpha"]])
            if (mean > 0) != (p["h1"] == "greater") or abs(abs(t) - crit) < 0.1 or (abs(t) > crit) != reject:
                continue
            tb = float(mean) / math.sqrt(float(s2) * (n - 1) / n / n)
            if _sig3(tb) == _sig3(t):
                continue
        return p


# --- drawing -------------------------------------------------------------------------------------------------------

def _cell(ax, x, y, w, h, text, head=False, gid=None):
    ax.add_patch(Rectangle((x, y), w, h, facecolor=FILL_2 if head else "white", edgecolor=INK, linewidth=1))
    ax.text(x + w / 2, y + h / 2, text, ha="center", va="center", fontsize=10, fontweight="bold" if head else "normal",
            gid=gid)


def lines_of(p: dict) -> list[str]:
    n = len(p["before"])
    out = ["d = after " + MINUS + " before. Assume the differences are normally distributed."]
    if p["sub"] == "test":
        out += [r"H₀: $\mu_d = 0$", rf"H₁: $\mu_d {'>' if p['h1'] == 'greater' else '<'} 0$",
                f"Significance level: {p['alpha']} (one-tailed)",
                r"Test statistic: $t = \bar{d}\,/\sqrt{s^2/n}$, where s² is the unbiased estimate of the variance of d",
                f"From tables, t-distribution with {n - 1} degrees of freedom: upper {p['alpha']} point = "
                f"{T_TABLE[n - 1][p['alpha']]}"]
    else:
        tail = CI_TAIL[p["ci"]]
        out += [rf"A {p['ci']} confidence interval for $\mu_d$ is $\bar{{d}} \pm t\sqrt{{s^2/n}}$,",
                "where s² is the unbiased estimate of the variance of d.",
                f"From tables, t-distribution with {n - 1} degrees of freedom: upper {tail} point = {T_TABLE[n - 1][tail]}"]
    return out


def draw(p: dict):
    n = len(p["before"])
    who, label = CONTEXTS[p["context"]][1:3]
    head_w, w, h = 2.7, 0.66, 0.42
    rows = [(who, [chr(65 + i) for i in range(n)]), (f"Before: {label}", [str(v) for v in p["before"]]),
            (f"After: {label}", [str(v) for v in p["after"]])]
    lines = lines_of(p)
    width = max(head_w + n * w, 7.6)
    height = 3 * h + 0.35 + 0.36 * len(lines)
    fig, ax = new_figure(width, height)
    fig.subplots_adjust(left=0, right=1, bottom=0, top=1)  # a unit is an inch: the cells fit their numbers
    top = height - 3 * h
    for i, (lab, cells) in enumerate(rows):
        y = top + (2 - i) * h
        _cell(ax, 0, y, head_w, h, lab, head=True)
        for j, c in enumerate(cells):
            _cell(ax, head_w + j * w, y, w, h, c, head=i == 0, gid=f"data:{i}:{j}")
    y = top - 0.35
    for k, line in enumerate(lines):
        ax.text(0, y - 0.36 * k - 0.18, line, ha="left", va="center", fontsize=10, gid=f"rule:{k}")
    ax.set_xlim(-0.05, width + 0.05)
    ax.set_ylim(-0.05, height + 0.05)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


# --- questions -----------------------------------------------------------------------------------------------------

def _forms(text: str) -> list[str]:
    return [text.replace("-", MINUS)] if text.startswith("-") else []


def _tol(x: float) -> float:
    return 10.0 ** (math.floor(math.log10(abs(x))) - 2)


def questions(p: dict, rng: random.Random) -> list:
    n = len(p["before"])
    mean, s2, se = stats(p)
    what = CONTEXTS[p["context"]][3].format(n=n)
    m_txt, s_txt = _dec(mean), _dec(s2)
    q1 = short(f"{p['name']} recorded {what}. Taking d = after {MINUS} before, find the mean of the {n} differences.",
               m_txt, _forms(m_txt) + ([str(mean)] if mean.denominator > 1 else []))
    plural = CONTEXTS[p["context"]][0]
    q2 = short(f"The data for the {n} {plural} are shown. Find an unbiased estimate of the variance of the differences d.",
               s_txt, [str(s2)] if s2.denominator > 1 else [])
    t = float(mean) / se
    if p["sub"] == "test":
        crit = float(T_TABLE[n - 1][p["alpha"]])
        reject = t > crit if p["h1"] == "greater" else t < -crit
        q3 = short(f"A paired t-test is carried out on the data for the {n} {plural}. Find the value of the test statistic "
                   "t, correct to 3 significant figures.", _sig3(t), _forms(_sig3(t)) + [f"{t:.3g}", f"{t:.4g}"],
                   tolerance=_tol(t))
        tb = float(mean) / math.sqrt(float(s2) * (n - 1) / n / n)  # the variance divided by n, not n - 1
        opts = [f"t = {_sig3(v)}, so {'reject' if r else 'do not reject'} H₀".replace("-", MINUS)
                for v in (t, tb) for r in (True, False)]
        key = f"t = {_sig3(t)}, so {'reject' if reject else 'do not reject'} H₀".replace("-", MINUS)
        q4 = mcq(f"A paired t-test is carried out on the data for the {n} {plural}. Which is the correct conclusion of the "
                 f"paired t-test at the {p['alpha']} significance level?", key,
                 [o for o in opts if o != key], rng)
        return [q1, q2, q3, q4]
    tc = float(T_TABLE[n - 1][CI_TAIL[p["ci"]]])
    lo, hi = float(mean) - tc * se, float(mean) + tc * se
    end = rng.choice(["lower", "upper"])
    v = lo if end == "lower" else hi
    q3 = short(f"The data for the {n} {plural} are shown. Find the {end} end of the {p['ci']} confidence "
               "interval for the population mean of d, correct to 3 significant figures.", _sig3(v),
               _forms(_sig3(v)) + [f"{v:.4g}"], tolerance=_tol(v))
    width = hi - lo
    q4 = short(f"The data for the {n} {plural} are shown. Find the width of the {p['ci']} confidence "
               "interval for the population mean of d, correct to 3 significant figures.", _sig3(width),
               [f"{width:.4g}"], tolerance=_tol(width))
    return [q1, q2, q3, q4]
