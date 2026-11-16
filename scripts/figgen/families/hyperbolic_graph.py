"""Graphs of the hyperbolic functions on a grid (AL), as Cambridge AS & A Level Further Mathematics "Hyperbolic functions"
teaches them, with the exponential definitions printed above the graph.

Four kinds of figure:
- tanh: y = a + b tanh(x - h) with its two asymptotes dashed and its centre (h, a) dotted, every one on a gridline: find
  a, b or h, or the range (a - |b| < y < a + |b|);
- cosh: y = a cosh x + c with its turning point dotted on the y-axis and a point P(ln k, y) printed: find a and c (from
  cosh(ln k) = (k + 1/k)/2), the range, or the exact value of y at x = ln m;
- sinh: y = a sinh x + c through its dotted y-intercept and a printed point P: find a, c, or the exact y at x = ln m;
- which: y = p cosh x, y = q sinh x and y = r tanh x drawn together and lettered P, Q, R: which letter is which, and the
  asymptote a lettered tanh curve approaches.
Every printed y-coordinate ends after at most two decimal places, and every answer is exact.
"""
from __future__ import annotations

import math
import random
from fractions import Fraction

from ..core import INK, NAMES, curve, frac, function_axes, infinite, mcq, new_figure, short
from ._p6_al_labels import place, ring

ID = "hyperbolic_graph"
KIND = "maths.coordinate"
SUBJECT = "mathematics"
BANDS = ("AL",)
CONCEPTS = ("mathematics.hyperbolic-functions",)
NEEDS = r"hyperbolic"
AVOID = r"^(?!.*hyperbolic)"  # only a chapter on the hyperbolic functions

MINUS = "−"
DEFS = r"$\cosh x = (e^{x} + e^{-x})\,/\,2$,    $\sinh x = (e^{x} - e^{-x})\,/\,2$,    $\tanh x = \sinh x\,/\cosh x$"
LEADS = ["drew the curve", "sketched the curve", "plotted the curve", "graphed the curve"]


def g_cosh(k: int) -> Fraction:
    return (Fraction(k) + Fraction(1, k)) / 2


def g_sinh(k: int) -> Fraction:
    return (Fraction(k) - Fraction(1, k)) / 2


def _dec(f: Fraction) -> str:
    return str(f.numerator) if f.denominator == 1 else f"{float(f):g}"


def _neg(text: str) -> str:
    return text.replace("-", MINUS)


def sample(rng: random.Random) -> dict:
    sub = rng.choice(["tanh", "cosh", "sinh", "which"])
    p = {"band": "AL", "sub": sub, "name": rng.choice(NAMES)}
    if sub == "tanh":
        p.update(a=rng.randint(-4, 4), b=rng.choice([-3, -2, -1, 1, 2, 3]), h=rng.randint(-2, 2))
        return p
    if sub == "which":
        order = ["cosh", "sinh", "tanh"]
        rng.shuffle(order)
        p.update(order=order, coef=[rng.randint(1, 4) for _ in order])
        return p
    g = g_cosh if sub == "cosh" else g_sinh
    while True:
        a, c, k, side = rng.choice([-4, -3, -2, -1, 1, 2, 3, 4]), rng.randint(-5, 5), rng.choice([2, 3, 4]), rng.choice([1, -1])
        y = a * g(k) * (side if sub == "sinh" else 1) + c
        if y.denominator in (1, 2, 4):
            p.update(a=a, c=c, k=k, side=side, yP=_dec(y))
            return p


# --- drawing -------------------------------------------------------------------------------------------------------

def _yrange(vals, pad_lo=1, pad_hi=1):
    lo = math.floor(min(0, *vals)) - pad_lo
    hi = math.ceil(max(0, *vals)) + pad_hi
    return lo, hi


def _f(p: dict):
    if p["sub"] == "tanh":
        return lambda x: p["a"] + p["b"] * math.tanh(x - p["h"])
    if p["sub"] == "cosh":
        return lambda x: p["a"] * math.cosh(x) + p["c"]
    return lambda x: p["a"] * math.sinh(x) + p["c"]


def draw(p: dict):
    sub = p["sub"]
    if sub == "tanh":
        a, b, h = p["a"], p["b"], p["h"]
        lo, hi = _yrange([a - abs(b), a + abs(b)])
        x0, x1 = -6, 6
    elif sub == "which":
        lo, hi, x0, x1 = -6, 6, -3, 3
    else:
        base = p["a"] + p["c"] if sub == "cosh" else p["c"]
        yp = float(Fraction(p["yP"]))
        lo, hi = _yrange([base, yp], 1, 2)
        x0, x1 = -3, 3
    step = 1 if hi - lo <= 12 else 2
    fig, ax = new_figure(6.4, max(4.6, min(7.0, 0.32 * (hi - lo) + 2.2)))
    function_axes(ax, x0, x1, lo, hi, ystep=step)
    ax.set_title(DEFS, fontsize=10, pad=10)
    L, H = x0 - 0.5, x1 + 0.5
    if sub == "which":
        fns = {"cosh": math.cosh, "sinh": math.sinh, "tanh": math.tanh}
        for fn, coef in zip(p["order"], p["coef"]):
            curve(ax, lambda x, f=fns[fn], k=coef: k * f(x), L, H, lo - 0.5, hi + 0.5)
        shown = ",   ".join(f"y = {'' if c == 1 else c}{'' if c == 1 else ' '}{fn} x"
                            for fn, c in sorted(zip(p["order"], p["coef"])))
        ax.text(0.5, -0.06, "The curves are " + shown, transform=ax.transAxes, ha="center", va="top", fontsize=10)
        for letter, fn, coef in zip("PQR", p["order"], p["coef"]):
            if fn == "tanh":
                spot, tries = (x1 + 0.1, coef * math.tanh(x1 + 0.1)), [(6, 0, "left", "center"), (0, 10, "center", "bottom"),
                                                                        (0, -10, "center", "top")]
            elif fn == "cosh":
                xe = -math.acosh((hi - 0.2) / coef)
                spot, tries = (xe, coef * math.cosh(xe)), [(-8, -6, "right", "top"), (-8, -18, "right", "top"),
                                                           (-14, 0, "right", "center")]
            else:
                xe = -math.asinh((-lo - 0.2) / coef)
                spot, tries = (xe, coef * math.sinh(xe)), [(8, 6, "left", "bottom"), (10, 18, "left", "bottom"),
                                                           (14, 0, "left", "center")]
            place(fig, ax, spot[0], spot[1], letter, tries + ring(), f"label:{letter}", fontsize=12, weight="bold")
        return fig
    f = _f(p)
    curve(ax, f, L, H, lo - 0.5, hi + 0.5)
    if sub == "tanh":
        for v in (a - abs(b), a + abs(b)):
            infinite(ax.plot([L, H], [v, v], color=INK, linewidth=1.1, linestyle=(0, (6, 3))))
        ax.plot([h], [a], marker="o", markersize=6, color=INK, linestyle="none", zorder=5)
        ax.text(0.5, -0.06, "y = a + b tanh(x " + MINUS + " h), where a, b and h are constants; the asymptotes are dashed",
                transform=ax.transAxes, ha="center", va="top", fontsize=10)
        return fig
    base = p["a"] + p["c"] if sub == "cosh" else p["c"]
    xp = p["side"] * math.log(p["k"])
    yp = float(Fraction(p["yP"]))
    ax.plot([0], [base], marker="o", markersize=6, color=INK, linestyle="none", zorder=5)
    ax.plot([xp], [yp], marker="o", markersize=6, color=INK, linestyle="none", zorder=5)
    word = "cosh" if sub == "cosh" else "sinh"
    ax.text(0.5, -0.06, f"y = a {word} x + c, where a and c are constants", transform=ax.transAxes, ha="center", va="top",
            fontsize=10)
    # P's label on the outer side of the bend (where the curve is not), then anywhere clear.
    bends_up = (p["a"] > 0) if sub == "cosh" else (p["a"] * p["side"] > 0)
    out = p["side"]
    first = [(8 * out, -8 if bends_up else 8, "left" if out > 0 else "right", "top" if bends_up else "bottom"),
             (14 * out, -14 if bends_up else 14, "left" if out > 0 else "right", "top" if bends_up else "bottom")]
    label = f"P({'' if p['side'] > 0 else MINUS}ln {p['k']}, {_neg(p['yP'])})"
    place(fig, ax, xp, yp, label, first + ring(), "label:P", fontsize=11)
    return fig


# --- questions -----------------------------------------------------------------------------------------------------

def _int(v: int, stem: str):
    return short(stem, str(v), [_neg(str(v))] if v < 0 else [])


def _exact(v: Fraction, stem: str):
    forms = [_neg(frac(v))] if v < 0 else []
    if v.denominator > 1 and (v * 100).denominator == 1:
        forms += [f"{float(v):g}", _neg(f"{float(v):g}")] if v < 0 else [f"{float(v):g}"]
    return short(stem, frac(v), forms)


def questions(p: dict, rng: random.Random) -> list:
    sub, name = p["sub"], p["name"]
    lead = rng.choice(LEADS)
    if sub == "which":
        eqs = ", ".join(f"y = {'' if c == 1 else str(c) + ' '}{fn} x" for fn, c in sorted(zip(p["order"], p["coef"])))
        fn = rng.choice(p["order"])
        i = p["order"].index(fn)
        c = p["coef"][i]
        q1 = mcq(f"{name} {lead}s {eqs} on the same axes. Which curve is y = {'' if c == 1 else str(c) + ' '}{fn} x?",
                 "PQR"[i], [x for x in "PQR" if x != "PQR"[i]], rng)
        t = p["order"].index("tanh")
        q2 = short(f"The curves {eqs} are drawn and lettered. Write down the equation of the horizontal asymptote that curve "
                   f"{'PQR'[t]} approaches as x increases.", f"y = {p['coef'][t]}", [f"y={p['coef'][t]}", str(p["coef"][t])])
        return [q1, q2]
    if sub == "tanh":
        eq = f"y = a + b tanh(x {MINUS} h)"
        vals = {"a": p["a"], "b": p["b"], "h": p["h"]}
        order = rng.sample(["a", "b", "h"], 3)
        q1 = _int(vals[order[0]], f"{name} {lead} {eq}, where a, b and h are constants, with its asymptotes dashed. Find the "
                                  f"value of {order[0]}.")
        q2 = _int(vals[order[1]], f"The curve {eq} is drawn with its asymptotes. Find the value of {order[1]}.")
        if p["a"] != 0 and rng.random() < 0.5:
            lo, hi, bb = p["a"] - abs(p["b"]), p["a"] + abs(p["b"]), abs(p["b"])
            opts = [_neg(f"{u} {s} y {s} {v}") for u, v in ((lo, hi), (-bb, bb)) for s in ("<", "≤")]
            key = _neg(f"{lo} < y < {hi}")
            q3 = mcq(f"The curve {eq} is drawn with its asymptotes. What is the range of the curve {eq} shown?", key,
                     [o for o in opts if o != key], rng)
        else:
            q3 = _int(vals[order[2]], f"The curve {eq} is drawn, its asymptotes dashed. Find the value of {order[2]}.")
        return [q1, q2, q3]
    word = sub
    eq = f"y = a {word} x + c"
    pt = f"P({'' if p['side'] > 0 else MINUS}ln {p['k']}, {_neg(p['yP'])})"
    order = rng.sample(["a", "c"], 2)
    vals = {"a": p["a"], "c": p["c"]}
    q1 = _int(vals[order[0]], f"{name} {lead} {eq}, where a and c are constants. It passes through {pt}. Find the value "
                              f"of {order[0]}.")
    q2 = _int(vals[order[1]], f"The curve {eq} shown passes through {pt}. Find the value of {order[1]}.")
    if sub == "cosh" and rng.random() < 0.5:
        ext = p["a"] + p["c"]
        opts = [_neg(f"y {s} {v}") for v in (ext, p["c"]) for s in ("≥", "≤")]
        key = _neg(f"y {'≥' if p['a'] > 0 else '≤'} {ext}")
        q3 = mcq(f"The curve {eq} shown passes through {pt}. What is the range of the curve {eq} shown?", key,
                 [o for o in opts if o != key], rng)
    else:
        mm = rng.choice([m for m in (2, 3, 4, 5) if m != p["k"]])
        g = g_cosh(mm) if sub == "cosh" else g_sinh(mm)
        q3 = _exact(p["a"] * g + p["c"], f"The curve {eq} shown passes through {pt}. Find the exact value of y on the "
                                         f"curve {eq} when x = ln {mm}.")
    return [q1, q2, q3]
