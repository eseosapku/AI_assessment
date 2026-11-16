"""The tangent to an exponential or a logarithmic curve (UP), as Cambridge IGCSE & O Level Additional Mathematics
"Derivatives of exponential functions" teaches it: the gradient of the tangent at a point is the derivative there.

Three kinds of curve, each drawn on a unit grid with its tangent at T drawn through two marked lattice points (T and
one more), and its equation printed with one unknown constant:
- exp: y = A e^(kx) + c, T where x = 0, so the gradient there is Ak; the unknown is k;
- aln: y = A ln(x + b) + c, T where x + b = 1 (ln 1 = 0), so the gradient there is A; the unknown is A;
- ln: y = ln(ax + b) + c, T where ax + b = 1, so the gradient there is a; the unknown is a.
Questions: the unknown from the tangent's gradient (read from the two marked points), the tangent's equation (MCQ,
the signs of gradient and intercept varied), where the tangent meets the x-axis, and the normal's gradient.
"""
from __future__ import annotations

import math
import random
from fractions import Fraction

from ..core import INK, NAMES, curve, function_axes, infinite, mcq, new_figure, short

ID = "exp_tangent"
KIND = "maths.coordinate"
SUBJECT = "mathematics"
BANDS = ("UP",)
CONCEPTS = ("mathematics.derivatives-exponential-functions", "mathematics.logarithmic-functions-derivatives")
# A topic whose sections the book lists is reached only if its name or a section is about these curves' derivatives.
NEEDS = r"exponential|logarithm"
AVOID = (r"integrat|differentiation reversed|taylor|financial|calculus basics|polynomials|"
         r"exponential and logarithmic functions and equations")

MINUS = "−"
KS = [(1, 1), (2, 1), (3, 1), (-1, 1), (-2, 1), (1, 2), (3, 2), (-1, 2), (-3, 2), (1, 3), (2, 3), (-1, 3)]
LEADS = ["{n} draws the curve {eq} and its tangent at the point T.",
         "{n} sketches the curve {eq} and its tangent at the point T.",
         "{n} plots the curve {eq} and its tangent at the point T.",
         "{n} studies the curve {eq} and its tangent at the point T."]


def _gradient_point(p: dict) -> tuple[int, int, int]:
    """T's coordinates and the gradient there."""
    if p["sub"] == "exp":
        k = Fraction(*p["k"])
        return 0, p["A"] + p["c"], int(p["A"] * k)
    if p["sub"] == "aln":
        return 1 - p["b"], p["c"], p["A"]
    return (1 - p["b"]) // p["a"], p["c"], p["a"]


def sample(rng: random.Random) -> dict:
    sub = rng.choice(["exp", "aln", "ln"])
    while True:
        p = {"band": "UP", "sub": sub, "name": rng.choice(NAMES)}
        if sub == "exp":
            A, k = rng.choice([-3, -2, -1, 1, 2, 3]), rng.choice(KS)
            if (A * k[0]) % k[1]:
                continue
            p.update(A=A, k=list(k), c=rng.randint(-3, 3), unknown="k")
        elif sub == "aln":
            p.update(A=rng.choice([-3, -2, -1, 1, 2, 3]), b=rng.randint(-2, 3), c=rng.randint(-3, 3), unknown="A")
        else:
            a, x0 = rng.choice([1, 2, 3]), rng.randint(-2, 2)
            p.update(a=a, b=1 - a * x0, c=rng.randint(-3, 3), unknown="a")
        x0, y0, g = _gradient_point(p)
        if g == 0 or abs(g) > 6 or y0 - g * x0 == 0:
            continue
        steps = [d for d in (-2, -1, 1, 2) if abs(g * d) <= 6]
        p["x2"] = x0 + rng.choice(steps)
        return p


# --- writing ------------------------------------------------------------------------------------------------

def _signed(v: int) -> str:
    return "" if v == 0 else f" + {v}" if v > 0 else f" {MINUS} {-v}"


def _coef(v: int, body: str) -> str:
    return body if v == 1 else f"{MINUS}{body}" if v == -1 else f"{str(v).replace('-', MINUS)}{body}"


def equation(p: dict) -> str:
    """The curve's equation as printed in a stem, its unknown constant as a letter."""
    if p["sub"] == "exp":
        return f"y = {_coef(p['A'], 'e^(kx)')}{_signed(p['c'])}"
    if p["sub"] == "aln":
        if p["b"] == 0:
            return f"y = A ln x{_signed(p['c'])}"
        return f"y = A ln(x{_signed(p['b'])}){_signed(p['c'])}"
    return f"y = ln(ax{_signed(p['b'])}){_signed(p['c'])}"


def _plain(v: int) -> str:
    return "" if v == 0 else f"+{v}" if v > 0 else f"-{-v}"


def _tex(p: dict) -> str:
    """The same equation in mathtext, for the figure."""
    c = _plain(p["c"])
    if p["sub"] == "exp":
        A = {1: "", -1: "-"}.get(p["A"], str(p["A"]))
        return rf"$y = {A}e^{{kx}}{c}$"
    if p["sub"] == "aln":
        inner = r"\,x" if p["b"] == 0 else rf"(x{_plain(p['b'])})"
        return rf"$y = A\,\ln{inner}{c}$"
    return rf"$y = \ln(ax{_plain(p['b'])}){c}$"


def line_text(m: int, c: int) -> str:
    lead = {1: "", -1: MINUS}.get(m, str(m).replace("-", MINUS))
    return f"y = {lead}x" + ("" if c == 0 else f" {'+' if c > 0 else MINUS} {abs(c)}")


def _frac_forms(v: Fraction) -> tuple[str, list[str]]:
    key = str(v.numerator) if v.denominator == 1 else f"{v.numerator}/{v.denominator}"
    forms = [key]
    if v.denominator != 1 and (v * 10000).denominator == 1:
        forms.append(format(float(v), "g"))
    elif v.denominator != 1:
        forms += [f"{float(v):.3g}", f"{float(v):.4g}"]
    forms += [f.replace("-", MINUS) for f in forms if f.startswith("-")]
    return key, forms


# --- drawing ------------------------------------------------------------------------------------------------

def _f(p: dict):
    if p["sub"] == "exp":
        k = p["k"][0] / p["k"][1]
        return lambda x: p["A"] * math.exp(k * x) + p["c"]
    if p["sub"] == "aln":
        return lambda x: p["A"] * math.log(x + p["b"]) + p["c"] if x + p["b"] > 0 else float("nan")
    return lambda x: math.log(p["a"] * x + p["b"]) + p["c"] if p["a"] * x + p["b"] > 0 else float("nan")


def _passes(a, b, box, margin=1.0, steps=60) -> bool:
    return any(box.x0 + margin < a[0] + (b[0] - a[0]) * k / steps < box.x1 - margin and
               box.y0 + margin < a[1] + (b[1] - a[1]) * k / steps < box.y1 - margin for k in range(steps + 1))


def _clear(ax, text, renderer, others=()) -> bool:
    box = text.get_window_extent(renderer)
    for o in others:
        ob = o.get_window_extent(renderer)
        if min(box.x1, ob.x1) - max(box.x0, ob.x0) > -2 and min(box.y1, ob.y1) - max(box.y0, ob.y0) > -2:
            return False
    ax_box = ax.get_window_extent(renderer)
    if box.x0 < ax_box.x0 + 2 or box.x1 > ax_box.x1 - 2 or box.y0 < ax_box.y0 + 2 or box.y1 > ax_box.y1 - 2:
        return False
    for ln in ax.lines:
        pts = ln.get_transform().transform(ln.get_xydata())
        if any(_passes(a, b, box) for a, b in zip(pts, pts[1:])):
            return False
    for t in ax.get_xticklabels() + ax.get_yticklabels():
        if t.get_text() and t.get_visible():
            tb = t.get_window_extent(renderer)
            if min(box.x1, tb.x1) - max(box.x0, tb.x0) > 0 and min(box.y1, tb.y1) - max(box.y0, tb.y0) > 0:
                return False
    return True


def draw(p: dict):
    x0, y0, g = _gradient_point(p)
    x2 = p["x2"]
    y2 = y0 + g * (x2 - x0)
    f = _f(p)
    for grow in range(6):
        xl, xr = min(x0, x2, 0) - 2 - grow // 2, max(x0, x2, 0) + 2 + grow // 2
        yl, yr = min(y0, y2, 0) - 2 - grow, max(y0, y2, 0) + 2 + grow
        while xr - xl < 7:
            xl, xr = xl - 1, xr + 1
        while yr - yl < 7:
            yl, yr = yl - 1, yr + 1
        fig, ax = new_figure(6.4, min(8.0, max(4.8, 6.4 * (yr - yl + 1) / (xr - xl + 1))))
        function_axes(ax, xl, xr, yl, yr, ystep=1 if yr - yl <= 12 else 2, xstep=1 if xr - xl <= 12 else 2)
        start = xl - 0.5
        if p["sub"] == "aln":
            start = max(start, -p["b"] + 1e-4)
        elif p["sub"] == "ln":
            start = max(start, -p["b"] / p["a"] + 1e-4)
        curve(ax, f, start, xr + 0.5, yl - 0.5, yr + 0.5, n=1500, gid="curve")
        infinite(ax.plot([xl - 0.5, xr + 0.5], [y0 + g * (xl - 0.5 - x0), y0 + g * (xr + 0.5 - x0)], color=INK,
                         linewidth=1.3, linestyle=(0, (6, 3)), gid="tangent"))
        for x, y in ((x0, y0), (x2, y2)):
            ax.plot([x], [y], "o", color=INK, markersize=6, zorder=5)
        fig.canvas.draw()
        renderer = fig.canvas.get_renderer()
        placed = []
        T = None
        for dx, dy in ((-0.35, 0.35), (0.35, 0.35), (-0.35, -0.35), (0.35, -0.35), (0, 0.45), (0, -0.45), (-0.5, 0), (0.5, 0)):
            T = ax.text(x0 + dx, y0 + dy, "T", ha="center", va="center", fontsize=12, fontweight="bold", gid="label:T")
            if _clear(ax, T, renderer):
                break
            T.remove()
            T = None
        if T is None:
            import matplotlib.pyplot as plt
            plt.close(fig)
            continue
        placed.append(T)
        eq = None
        for fx, fy, ha, va in ((0.03, 0.97, "left", "top"), (0.97, 0.97, "right", "top"), (0.03, 0.03, "left", "bottom"),
                               (0.97, 0.03, "right", "bottom"), (0.5, 0.97, "center", "top"), (0.5, 0.03, "center", "bottom")):
            eq = ax.text(fx, fy, _tex(p), transform=ax.transAxes, ha=ha, va=va, fontsize=12, gid="label:curve",
                         bbox={"boxstyle": "round,pad=0.25", "facecolor": "white", "edgecolor": "none"})
            if _clear(ax, eq, renderer, placed):
                break
            eq.remove()
            eq = None
        if eq is not None:
            return fig
        import matplotlib.pyplot as plt
        plt.close(fig)
    raise RuntimeError(f"exp_tangent: no clear place for the labels: {p}")


# --- questions ----------------------------------------------------------------------------------------------

def questions(p: dict, rng: random.Random) -> list:
    x0, y0, g = _gradient_point(p)
    cc = y0 - g * x0
    eq = equation(p)
    u = p["unknown"]
    truth = Fraction(*p["k"]) if u == "k" else Fraction(p[u])
    key, forms = _frac_forms(truth)
    lead = rng.choice(LEADS).format(n=p["name"], eq=eq)
    q1 = short(f"{lead} The tangent passes through T and the other marked point. Use the tangent to find the value of "
               f"{u}.", key, forms)
    opts = [line_text(g, cc), line_text(g, -cc), line_text(-g, cc), line_text(-g, -cc)]
    pool = [
        lambda: mcq(f"What is the equation of the tangent at T to the curve {eq}?", opts[0], opts[1:], rng),
        lambda: short(f"Find the x-coordinate of the point where the tangent at T to the curve {eq} meets the x-axis.",
                      *_frac_forms(Fraction(-cc, g))),
        lambda: short(f"Find the gradient of the normal to the curve {eq} at T.", *_frac_forms(Fraction(-1, g))),
    ]
    return [q1] + [pool[i]() for i in sorted(rng.sample(range(3), 2))]
