"""Completing the square (LS, UP, AL), read from a figure: a quadratic's graph with its turning point at a grid
point, or the area model of x² + 2kx (the square, two strips and the missing corner).

- graph: the curve y = ax² + bx + c on a grid, a printed (1 at Lower Secondary; 1 or −1 at Upper Secondary; also 2 or
  −2 at AS Level), b and c not printed, the turning point dotted at a grid point. Write it in completed-square form
  (four offered: the two signs crossed), find b and c, the line of symmetry, the least or greatest value, the range
  (AS Level), and solve ax² + bx + c = 0 (whole roots at Lower Secondary; exact surds above, four offered).
- area: the square of side x with two strips k wide and the missing k × k corner dashed, the shaded area printed.
  Which equation the shape shows, the corner's area, (x + k)² as a number, and x.
As Rwanda Mathematics S3 "Solving quadratic equations by completing square method", Cambridge IGCSE "Completing the
square", Additional Mathematics "Maximum and minimum values of a quadratic function" and AS Pure 1 chapter 1 teach it.
"""
from __future__ import annotations

import math
import random

from matplotlib.patches import Rectangle

from ..core import FILL_2, INK, NAMES, curve, function_axes, mcq, new_figure, short
from ._exact_up import simplest_surd, surd_text

ID = "completing_square"
KIND = "maths.coordinate"
SUBJECT = "mathematics"
BANDS = ("LS", "UP", "AL")
CONCEPTS = ("mathematics.quadratic-equations-completing-square", "mathematics.completing-the-square",
            "mathematics.quadratics")
# A topic whose sections the book lists is reached only where its name or a section is about completing the square
# (or a quadratic's greatest and least values, which it finds).
NEEDS = r"complet\w*(?: the)? square|maximum and minimum values of a quadratic"
AVOID = r"projectile|induction|summation|roots of polynomial"


def concepts_for(p: dict) -> tuple[str, ...]:
    return {"LS": ("mathematics.quadratic-equations-completing-square",), "UP": ("mathematics.completing-the-square",),
            "AL": ("mathematics.completing-the-square", "mathematics.quadratics")}[p["band"]]


def avoid_for(p: dict) -> str:
    # The AS Level chapters list no sections: only the chapter named for completing the square.
    return AVOID + "|^(?!.*complete the square)" if p["band"] == "AL" else AVOID


def sample(rng: random.Random) -> dict:
    band = rng.choice(["LS", "LS", "UP", "AL", "AL"])
    p = {"band": band, "name": rng.choice(NAMES)}
    if band != "AL" and rng.random() < 0.3:
        k = rng.randint(1, 6)
        s = rng.randint(2, 12)
        p.update(kind="area", k=k, x=s, area=s * s + 2 * k * s,
                 asks=sorted(rng.sample(["equation", "corner", "square", "x"], 3)))
        return p
    a = {"LS": [1], "UP": [1, -1], "AL": [1, -1, 2, -2]}[band][rng.randrange({"LS": 1, "UP": 2, "AL": 4}[band])]
    while True:
        h = rng.choice([v for v in range(-5, 6) if v != 0])
        if band == "LS":
            r = rng.randint(1, 4)
            k = -a * r * r if rng.random() < 0.8 else a * rng.randint(1, 5)
        else:
            k = rng.choice([v for v in range(-10, 11) if v != 0])
            if abs(a) == 2 and k % 2:
                continue
        if abs(h * h * a + k) <= 40:
            break
    asks = ["form", "bc", "symmetry", "extreme"] + (["range"] if band == "AL" else []) + (["roots"] if k * a < 0 else [])
    rest = [x for x in asks if x != "form"]
    p.update(kind="graph", a=a, h=h, k=k, asks=["form"] + sorted(rng.sample(rest, 2), key=asks.index))
    return p


# --- drawing --------------------------------------------------------------------------------------------

def _window(p: dict) -> tuple[int, int, int, int]:
    a, h, k = p["a"], p["h"], p["k"]
    half = 4 if abs(a) == 1 else 3
    x0, x1 = min(h - half, -1), max(h + half, 1)
    rise = a * (half - 1) ** 2  # the curve shown well up both arms
    lo, hi = sorted((k, k + rise))
    y0, y1 = min(lo - 1, -1), max(hi + 1, 1)
    return x0, x1, y0, y1


def _draw_graph(p: dict):
    a, h, k = p["a"], p["h"], p["k"]
    x0, x1, y0, y1 = _window(p)
    span = y1 - y0
    fig, ax = new_figure(5.6, max(4.6, min(7.5, 0.3 * span + 1.2)))
    function_axes(ax, x0, x1, y0, y1, ystep=1 if span <= 14 else 2)
    curve(ax, lambda x: a * (x - h) ** 2 + k, x0 - 0.5, x1 + 0.5, y0 - 0.5, y1 + 0.5, gid="curve")
    ax.plot([h], [k], "o", color=INK, markersize=6, zorder=5, gid="vertex")
    lead = "" if a == 1 else "−" if a == -1 else str(a).replace("-", "−")
    ax.set_title(f"y = {lead}x² + bx + c", fontsize=12)
    for t in ax.get_xticklabels() + ax.get_yticklabels():
        t.set_fontsize(8)
    return fig


def _draw_area(p: dict):
    k, s, area = p["k"], p["x"], p["area"]
    X = 3.2
    w = min(1.6, max(0.7, X * k / s))
    fig, ax = new_figure(5.4, 5.0)
    ax.add_patch(Rectangle((0, 0), X, X, facecolor=FILL_2, edgecolor="none", gid="behind-square"))
    ax.add_patch(Rectangle((X, 0), w, X, facecolor=FILL_2, edgecolor="none", gid="behind-strip"))
    ax.add_patch(Rectangle((0, -w), X, w, facecolor=FILL_2, edgecolor="none", gid="behind-strip"))
    ax.plot([0, X + w, X + w, X, X, 0, 0], [X, X, 0, 0, -w, -w, X], color=INK, linewidth=1.8, gid="outline")
    ax.plot([X, X], [0, X], color=INK, linewidth=1.0, gid="inner")
    ax.plot([0, X], [0, 0], color=INK, linewidth=1.0, gid="inner")
    ax.plot([X, X + w, X + w], [-w, -w, 0], color=INK, linewidth=1.2, linestyle=(0, (4, 3)), gid="corner")
    ax.text(X / 2, X + 0.25, "x", ha="center", va="bottom", fontsize=13, style="italic")
    ax.text(-0.25, X / 2, "x", ha="right", va="center", fontsize=13, style="italic")
    ax.text(X + w / 2, X + 0.25, str(k), ha="center", va="bottom", fontsize=13)
    ax.text(-0.25, -w / 2, str(k), ha="right", va="center", fontsize=13)
    ax.text(X / 2, X / 2, "x²", ha="center", va="center", fontsize=14)
    ax.text(X + w / 2, -w / 2, "?", ha="center", va="center", fontsize=14)
    ax.text((X + w) / 2, -w - 0.45, f"Shaded area = {area} cm²", ha="center", va="top", fontsize=12)
    ax.text((X + w) / 2, -w - 1.05, "Lengths in cm. Not to scale.", ha="center", va="top", fontsize=10)
    ax.set_xlim(-0.9, X + w + 0.5)
    ax.set_ylim(-w - 1.6, X + 0.8)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def draw(p: dict):
    return _draw_area(p) if p["kind"] == "area" else _draw_graph(p)


# --- questions ------------------------------------------------------------------------------------------

def _sq(h: int) -> str:
    return f"(x − {h})²" if h > 0 else f"(x + {-h})²"


def form_text(a: int, h: int, k: int) -> str:
    """a(x − h)² + k as printed: "(x − 3)² + 2", "−(x + 1)² − 4", "2(x − 3)² + 5"."""
    lead = "" if a == 1 else "−" if a == -1 else str(a).replace("-", "−")
    return f"{lead}{_sq(h)} {'+' if k > 0 else '−'} {abs(k)}"


def _poly(a: int, h: int, k: int) -> tuple[int, int, int]:
    return a, -2 * a * h, a * h * h + k


def _graph_qs(p: dict, rng: random.Random) -> list:
    a, h, k, name = p["a"], p["h"], p["k"], p["name"]
    _, b, c = _poly(a, h, k)
    lead = "" if a == 1 else "−" if a == -1 else str(a).replace("-", "−")
    quad = f"{lead}x² + bx + c"
    x0, x1, _, _ = _window(p)
    dom = f"for {x0} ≤ x ≤ {x1}".replace("-", "−")
    opener = rng.choice([f"{name} draws the graph of y = {quad} {dom}.", f"{name} plots the curve y = {quad} {dom}.",
                         f"{name} plots y = {quad} {dom} and marks its turning point."])
    qs = []
    for ask in p["asks"]:
        if ask == "form":
            want = f"{lead}(x + p)² + q" if lead else "(x + p)² + q"
            opts = [form_text(a, h, k), form_text(a, -h, k), form_text(a, h, -k), form_text(a, -h, -k)]
            qs.append(mcq(f"{opener} Use the graph to write {quad} in the form {want}.", opts[0], opts[1:], rng))
        elif ask == "bc":
            key = f"b = {b}, c = {c}".replace("-", "−")
            plain = f"b = {b}, c = {c}"
            qs.append(short(f"From the turning point of the graph of y = {quad}, find the values of b and c.", key,
                            [plain, plain.replace(" ", ""), f"b={b} c={c}", f"{b}, {c}", f"{b}, {c}".replace("-", "−")]))
        elif ask == "symmetry":
            qs.append(short(f"What is the equation of the line of symmetry of the curve y = {quad} in the graph?",
                            f"x = {h}".replace("-", "−"), [f"x = {h}", f"x={h}", str(h)]))
        elif ask == "extreme":
            word = "least" if a > 0 else "greatest"
            qs.append(short(f"What is the {word} value of {quad} for the curve in the graph?", str(k).replace("-", "−"),
                            [str(k), f"y = {k}"]))
        elif ask == "range":
            sign = "≥" if a > 0 else "≤"
            key = f"f(x) {sign} {k}".replace("-", "−")
            alt = ">=" if a > 0 else "<="
            qs.append(short(f"The graph shows y = f(x), where f(x) = {quad} for all real x. State the range of f.", key,
                            [f"f(x) {sign} {k}", f"y {sign} {k}", f"f(x) {alt} {k}", f"y {alt} {k}", f"f(x){sign}{k}"]))
        else:
            n = -k // a  # (x - h)^2 = -k/a, a whole number: k is even when a is 2 or -2
            kk, m = simplest_surd(n)
            if m == 1:
                lo, hi = h - kk, h + kk
                key = f"x = {lo} or x = {hi}".replace("-", "−")
                qs.append(short(f"Use the graph's turning point to solve {quad} = 0 by completing the square.", key,
                                [f"x = {lo} or x = {hi}", f"{lo}, {hi}", f"x = {lo}, x = {hi}", f"{lo} and {hi}",
                                 f"x = {hi} or x = {lo}"]))
            else:
                root = surd_text(kk, m)
                opts = [f"x = {h} ± {root}", f"x = {-h} ± {root}", f"x = {h} ± {n}", f"x = {-h} ± {n}"]
                opts = [o.replace("-", "−") for o in opts]
                qs.append(mcq(f"Use the graph's turning point to solve {quad} = 0 exactly.", opts[0], opts[1:], rng))
    return qs


def _area_qs(p: dict, rng: random.Random) -> list:
    k, s, area, name = p["k"], p["x"], p["area"], p["name"]
    opener = rng.choice([f"{name} cuts a shape of area {area} cm² into a square and two strips.",
                         f"{name} uses a shaded shape of area {area} cm² to solve a quadratic equation.",
                         f"{name} draws an area model whose shaded area is {area} cm²."])
    qs = []
    for ask in p["asks"]:
        if ask == "equation":
            opts = [f"x² + {2 * k}x = {area}", f"x² + {k}x = {area}", f"x² + {2 * k}x + {k * k} = {area}",
                    f"x² + {k}x + {k * k} = {area}"]
            if k == 1:
                opts = [o.replace(" 1x", " x") for o in opts]
            qs.append(mcq("Which equation does the shaded shape show?", opts[0], opts[1:], rng))
        elif ask == "corner":
            v = k * k
            qs.append(short("What area, in cm², must be added at the corner marked ? to complete the square?", str(v),
                            [f"{v} cm²", f"{v} cm2", f"{v}cm²"]))
        elif ask == "square":
            v = area + k * k
            qs.append(short(f"Complete the square for the shaded shape: (x + {k})² = ?", str(v),
                            [f"(x + {k})² = {v}", f"{v} cm²"]))
        else:
            qs.append(short("Find the value of x, the side of the square, in cm.", str(s), [f"{s} cm", f"x = {s}", f"{s}cm"]))
    qs[0].stem = f"{opener} {qs[0].stem}"
    return qs


def questions(p: dict, rng: random.Random) -> list:
    return _area_qs(p, rng) if p["kind"] == "area" else _graph_qs(p, rng)
