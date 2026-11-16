"""The first terms of a sequence plotted as points (n, uₙ), each point labelled with its value (UP), as Rwanda
Mathematics S5 "Sequences" and Cambridge Additional Mathematics draw them.

Two kinds:
- arith: an arithmetic sequence, 6 to 8 terms. The common difference, the nth term (four formulas offered, one
  right), a later term, the sum of the first m terms (Sₙ = n/2 [2a + (n − 1)d] printed), which term equals a value.
- geom: a geometric sequence with ratio 2, 3, 3/2, 1/2, 1/3, 2/3, −1/2, −1/3 or −2, 5 or 6 terms, every plotted term a
  whole number. The common ratio, the nth term, a later term (an exact fraction), the sum of the first m terms
  (Sₙ = a(1 − rⁿ)/(1 − r) printed), the sum to infinity when |r| < 1 (S∞ = a/(1 − r) printed), and what happens to uₙ
  as n grows.
Every value a question needs comes from the plotted points, whose values are printed beside them.
"""
from __future__ import annotations

import random
from fractions import Fraction

from ..core import GRID, INK, NAMES, mcq, new_figure, short
from ._exact_up import fr, fraction_forms

ID = "sequence_plot"
KIND = "graph.scatter"
SUBJECT = "mathematics"
BANDS = ("UP",)
CONCEPTS = ("mathematics.sequences-arithmetic-general-term", "mathematics.sequences-geometric-changing-difference",
            "mathematics.series-geometric", "mathematics.sequences-convergent-divergent")
# A topic whose sections the book lists is reached only where a section names sequences, progressions or series.
NEEDS = r"sequence|progression|series"
AVOID = r"taylor|maclaurin|power series|financial|interest|surds and sets|pascal"

# (ratio, first terms that keep every plotted term whole, how many terms are plotted)
GEOMETRIC = [((2, 1), [1, 2, 3, 5], 6), ((3, 1), [1, 2], 5), ((3, 2), [16, 32], 5), ((1, 2), [32, 64, 96, 128, 160], 6),
             ((1, 3), [81, 162, 243], 5), ((2, 3), [81, 162], 5), ((-1, 2), [32, 64, 96, 128], 6),
             ((-1, 3), [81, 162], 5), ((-2, 1), [1, 2, 3], 6)]
SUB = str.maketrans("0123456789", "₀₁₂₃₄₅₆₇₈₉")


def _terms(p: dict, upto: int) -> list[Fraction]:
    if p["kind"] == "arith":
        return [Fraction(p["a"] + k * p["d"]) for k in range(upto)]
    r = Fraction(*p["r"])
    return [p["a"] * r ** k for k in range(upto)]


def sample(rng: random.Random) -> dict:
    p = {"band": "UP", "name": rng.choice(NAMES)}
    if rng.random() < 0.55:
        n = rng.randint(6, 8)
        d = rng.choice([-5, -4, -3, -2, -1, 1, 2, 3, 4, 5, 6])
        a = rng.choice([v for v in range(-12, 21) if v not in (0, d)])
        p.update(kind="arith", a=a, d=d, n=n)
        asks = ["formula", "later", "sum", "which"]
        p["k"] = rng.randint(12, 40)
        p["m"] = rng.randint(10, 25)
        p["j"] = rng.randint(n + 4, 50)
    else:
        (rn, rd), firsts, n = rng.choice(GEOMETRIC)
        p.update(kind="geom", a=rng.choice(firsts), r=[rn, rd], n=n)
        asks = ["formula", "later", "sum", "limit"] + (["infinity"] if abs(rn) < rd else [])
        p["k"] = rng.randint(n + 1, n + 4)
        p["m"] = rng.randint(n, n + 3)
    p["asks"] = sorted(rng.sample(asks, 3), key=asks.index)
    return p


# --- drawing --------------------------------------------------------------------------------------------

def _step(span: float) -> int:
    return next(s for s in (1, 2, 5, 10, 20, 25, 50, 100) if span / s <= 10)


def draw(p: dict):
    n = p["n"]
    vals = [int(v) for v in _terms(p, n)]
    lo, hi = min(vals + [0]), max(vals + [0])
    step = _step(hi - lo)
    y0 = (lo // step) * step - (step if lo < 0 else 0)
    y1 = -(-hi // step) * step + step
    fig, ax = new_figure(6.4, 4.6)
    ax.set_xticks(range(1, n + 1))
    ax.set_yticks(range(y0, y1 + 1, step))
    ax.grid(True, color=GRID, linewidth=0.6)
    ax.set_axisbelow(True)
    ax.axhline(0, color=INK, linewidth=0.9, gid="grid-zero")
    for k, v in enumerate(vals, start=1):
        ax.plot([k], [v], "o", color=INK, markersize=7, gid=f"point:{k}")
        up = v >= 0
        ax.annotate(f"{v}".replace("-", "−"), (k, v), xytext=(0, 9 if up else -9), textcoords="offset points",
                    ha="center", va="bottom" if up else "top", fontsize=10, gid=f"value:{k}",
                    bbox={"boxstyle": "round,pad=0.12", "facecolor": "white", "edgecolor": "none"})
    ax.set_xlim(0.4, n + 0.6)
    ax.set_ylim(y0, y1)
    ax.set_xlabel("n (term number)", fontsize=10)
    ax.set_ylabel("uₙ", fontsize=11, rotation=0, labelpad=12)
    ax.tick_params(labelsize=9)
    kind = "an arithmetic" if p["kind"] == "arith" else "a geometric"
    ax.set_title(f"The first {n} terms of {kind} sequence", fontsize=11)
    return fig


# --- questions ------------------------------------------------------------------------------------------

def _linear(c: int, b: int) -> str:
    """uₙ = 3n + 2, uₙ = −2n + 7, uₙ = 5n, uₙ = −n − 4."""
    head = {1: "n", -1: "−n"}.get(c, f"{c}n".replace("-", "−"))
    tail = "" if b == 0 else f" + {b}" if b > 0 else f" − {-b}"
    return f"uₙ = {head}{tail}"


def _power(a: int, r: Fraction, shifted: bool) -> str:
    """uₙ = 64(1/2)^(n − 1), uₙ = 3(−2)^n."""
    return f"uₙ = {'' if a == 1 else a}({fr(r)})^{'(n − 1)' if shifted else 'n'}".replace("-", "−")


def _ordinal(k: int) -> str:
    return f"{k}{'th' if 10 <= k % 100 <= 20 else {1: 'st', 2: 'nd', 3: 'rd'}.get(k % 10, 'th')}"


def questions(p: dict, rng: random.Random) -> list:
    n, name = p["n"], p["name"]
    vals = _terms(p, 60)
    a = vals[0]
    qs = []
    if p["kind"] == "arith":
        d = p["d"]
        lead = rng.choice([f"{name} plots the first {n} terms u₁, u₂, u₃, … of an arithmetic sequence.",
                           f"{name} draws the first {n} terms of an arithmetic sequence as points.",
                           f"{name} shows an arithmetic sequence, term by term, on a graph."])
        qs.append(short(f"{lead} What is the common difference?", fr(Fraction(d)), fraction_forms(Fraction(d))))
        for ask in p["asks"]:
            if ask == "formula":
                # Two slips crossed: the sign of the difference, and forgetting to take d from the first term.
                b = int(a) - d
                opts = [_linear(d, b), _linear(d, int(a)), _linear(-d, b), _linear(-d, int(a))]
                qs.append(mcq("Which formula gives the nth term uₙ of the sequence in the graph?", opts[0], opts[1:], rng))
            elif ask == "later":
                k = p["k"]
                v = vals[k - 1]
                qs.append(short(f"Use the plotted terms to find u{k} for this sequence.", fr(v), fraction_forms(v)))
            elif ask == "sum":
                m = p["m"]
                v = sum(vals[:m])
                qs.append(short(f"Using Sₙ = n/2 [2a + (n − 1)d], find the sum of the first {m} terms of the plotted "
                                f"sequence.", fr(v), fraction_forms(v)))
            else:
                j = p["j"]
                t = int(vals[j - 1])
                qs.append(short(f"Which term of the sequence is equal to {t}?".replace("-", "−"), str(j),
                                [f"u{j}", f"the {_ordinal(j)} term", _ordinal(j), f"n = {j}"]))
        return [_fix(q) for q in qs]
    r = Fraction(*p["r"])
    lead = rng.choice([f"{name} plots the first {n} terms u₁, u₂, u₃, … of a geometric sequence.",
                       f"{name} draws the first {n} terms of a geometric sequence as points.",
                       f"{name} shows a geometric sequence, term by term, on a graph."])
    qs.append(short(f"{lead} What is the common ratio?", fr(r), fraction_forms(r)))
    s_inf = a / (1 - r)
    for ask in p["asks"]:
        if ask == "formula":
            # Two slips crossed: the ratio upside down, and the power n for n − 1.
            ai = int(a)
            opts = [_power(ai, r, True), _power(ai, r, False), _power(ai, 1 / r, True), _power(ai, 1 / r, False)]
            qs.append(mcq("Which formula gives the nth term uₙ of the sequence in the graph?", opts[0], opts[1:], rng))
        elif ask == "later":
            k = p["k"]
            v = vals[k - 1]
            qs.append(short(f"Find u{k}, the {_ordinal(k)} term of the plotted sequence, as an exact value.", fr(v),
                            fraction_forms(v)))
        elif ask == "sum":
            m = p["m"]
            v = sum(vals[:m])
            qs.append(short(f"Using Sₙ = a(1 − rⁿ)/(1 − r), find the sum of the first {m} terms of the plotted sequence.",
                            fr(v), fraction_forms(v)))
        elif ask == "infinity":
            qs.append(short("Using S∞ = a/(1 − r), find the sum to infinity of the plotted sequence.", fr(s_inf),
                            fraction_forms(s_inf)))
        else:
            key = "It converges to 0" if abs(r) < 1 else "It diverges"
            opts = ["It converges to 0", f"It converges to {fr(a)}", "It diverges", f"It converges to {fr(s_inf)}"]
            if len(set(opts)) < 4:
                opts[3] = f"It converges to {fr(a * r)}"
            opts = [o.replace("-", "−") for o in opts]
            qs.append(mcq("What happens to the terms uₙ of the plotted sequence as n becomes very large?", key,
                          [o for o in opts if o != key], rng))
    return [_fix(q) for q in qs]


def _fix(q):
    """Minus signs as printed (−), the hyphen kept among the accepted forms."""
    q.stem = q.stem.replace(" -", " −")
    return q
