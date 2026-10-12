"""A cumulative frequency curve: estimate the median, the interquartile range, and how many are
above a value (UP).

The curve is a monotone cubic (Fritsch-Carlson) through chosen points -- the quartiles among
them -- so it rises like a real S-curve and passes exactly through every value asked.
"""
from __future__ import annotations

import random

from ..core import GRID, INK, NAMES, new_figure, short

ID = "cumulative_frequency"
KIND = "graph.stats"
SUBJECT = "mathematics"
BANDS = ("UP",)
CONCEPTS = tuple(f"mathematics.{c}" for c in ("cumulative-distribution-function", "quartiles", "dispersion-measures",
                                             "calculating-statistics-grouped-data"))

# what, unit, who, the axis's end, how to say "more than t", and the grid's small step (the
# quartiles and the reading fall on it)
CONTEXTS = [("marks in a test", "marks", "students", 100, "scored more than {t} marks", 2, "the marks of {n} students in a test"),
            ("times taken to finish a puzzle", "minutes", "students", 60, "took more than {t} minutes", 2,
             "the times {n} students took to finish a puzzle"),
            ("heights of seedlings", "cm", "seedlings", 40, "had a height of more than {t} cm", 1, "the heights of {n} seedlings"),
            ("masses of parcels", "kg", "parcels", 20, "had a mass of more than {t} kg", 1, "the masses of {n} parcels")]


def _knots(p: dict) -> list[tuple[float, float]]:
    n, (q1, m, q3), (t, ct) = p["total"], p["quartiles"], p["extra"]
    return [(0, 0), (q1, n / 4), (m, n / 2), (q3, 3 * n / 4), (t, ct), (p["xmax"], n)]


def _slopes(xs, ys):
    h = [b - a for a, b in zip(xs, xs[1:])]
    d = [(b - a) / w for a, b, w in zip(ys, ys[1:], h)]
    m = [0.0] * len(xs)
    for k in range(1, len(xs) - 1):
        if d[k - 1] * d[k] > 0:
            w1, w2 = 2 * h[k] + h[k - 1], h[k] + 2 * h[k - 1]
            m[k] = (w1 + w2) / (w1 / d[k - 1] + w2 / d[k])
    for k, (h0, h1, d0, d1) in ((0, (h[0], h[1], d[0], d[1])), (len(xs) - 1, (h[-1], h[-2], d[-1], d[-2]))):
        e = ((2 * h0 + h1) * d0 - h0 * d1) / (h0 + h1)
        if e * d0 <= 0:
            e = 0.0
        elif d0 * d1 <= 0 and abs(e) > 3 * abs(d0):
            e = 3 * d0
        m[k] = e
    return m


def cf(p: dict, x: float) -> float:
    """The curve's height at x: a monotone cubic through the knots."""
    pts = _knots(p)
    xs, ys = [q[0] for q in pts], [q[1] for q in pts]
    if x <= xs[0]:
        return ys[0]
    if x >= xs[-1]:
        return ys[-1]
    m = _slopes(xs, ys)
    k = max(i for i in range(len(xs) - 1) if xs[i] <= x)
    h = xs[k + 1] - xs[k]
    s = (x - xs[k]) / h
    h00, h10, h01, h11 = 2 * s**3 - 3 * s**2 + 1, s**3 - 2 * s**2 + s, -2 * s**3 + 3 * s**2, s**3 - s**2
    return h00 * ys[k] + h10 * h * m[k] + h01 * ys[k + 1] + h11 * h * m[k + 1]


def sample(rng: random.Random) -> dict:
    ci = rng.randrange(len(CONTEXTS))
    xmax, step = CONTEXTS[ci][3], CONTEXTS[ci][5]
    while True:
        n = rng.choice([40, 60, 80, 100, 120, 160, 200])
        start = step * round(0.15 * xmax / step)  # on a gridline, so every reading is exact
        q = sorted(rng.sample(range(start, round(0.75 * xmax) + 1, step), 3))
        # Quartiles spread like a real distribution's, so the curve is a smooth S.
        if not all(0.08 * xmax <= gap <= 0.35 * xmax for gap in (q[1] - q[0], q[2] - q[1])):
            continue
        # One hump in the data: each middle quarter packed tighter than the outer quarter beside
        # it, so the curve rises slowly, then steeply, then slowly -- the S of real data.
        if not (q[1] - q[0] < q[0] and q[2] - q[1] < xmax - q[2]):
            continue
        t = rng.choice(range(q[2] + 2 * step, xmax - 2 * step + 1, step))
        unit_y = n // 20
        # The reading above the upper quartile where a flattening S-curve would put it.
        f = (t - q[2]) / (xmax - q[2])
        ct = unit_y * round((0.75 * n + 0.25 * n * (1 - (1 - f) ** 2)) / unit_y)
        ct = min(max(ct, int(0.75 * n) + unit_y), n - unit_y)
        p = {"band": "UP", "context": ci, "total": n, "xmax": xmax, "quartiles": q, "extra": [t, ct], "name": rng.choice(NAMES)}
        # The slopes between the points rise to one peak and fall: a single S, no second steep step.
        pts = _knots(p)
        slopes = [(y1 - y0) / (x1 - x0) for (x0, y0), (x1, y1) in zip(pts, pts[1:])]
        top = slopes.index(max(slopes))
        if not (all(a < b for a, b in zip(slopes[:top], slopes[1:top + 1])) and all(a > b for a, b in zip(slopes[top:], slopes[top + 1:]))):
            continue
        xs = [x * xmax / 400 for x in range(401)]
        ys = [cf(p, x) for x in xs]
        if all(b >= a - 1e-9 for a, b in zip(ys, ys[1:])):
            return p


def draw(p: dict):
    what, unit, _, xmax, _, step, _ = CONTEXTS[p["context"]]
    n = p["total"]
    fig, ax = new_figure(6.4, 5.0)
    xs = [x * xmax / 400 for x in range(401)]
    ax.plot(xs, [cf(p, x) for x in xs], color=INK, linewidth=1.8)
    ax.set_xticks(range(0, xmax + 1, xmax // 5))
    ax.set_xticks(range(0, xmax + 1, step), minor=True)
    ax.set_yticks(range(0, n + 1, n // 5))
    ax.set_yticks(range(0, n + 1, n // 20), minor=True)
    ax.grid(True, which="major", color="#a8a8a8", linewidth=0.8)
    ax.grid(True, which="minor", color=GRID, linewidth=0.4)
    ax.set_axisbelow(True)
    ax.set_xlim(0, xmax)
    ax.set_ylim(0, n)
    word = what.split(" ")[0].capitalize()
    ax.set_xlabel(word if word.lower() == unit else f"{word} ({unit})")
    ax.set_ylabel("Cumulative frequency")
    title = CONTEXTS[p["context"]][6].format(n=n)
    ax.set_title(title[0].upper() + title[1:], fontsize=11)
    return fig


def questions(p: dict, rng: random.Random) -> list:
    what, unit, who, _, more, _, of_n = CONTEXTS[p["context"]]
    of_n = of_n.format(n=p["total"])
    n, (q1, m, q3), (t, ct) = p["total"], p["quartiles"], p["extra"]
    low = {"marks": f"scored {q1} marks or fewer", "minutes": f"took {q1} minutes or less", "cm": f"were {q1} cm tall or less",
           "kg": f"had a mass of {q1} kg or less"}[unit]
    return [
        short(f"{p['name']} drew this graph of {of_n}. Use it to estimate the median.", m, [f"{m} {unit}"]),
        short(f"Use the graph to estimate the interquartile range of {of_n}.", q3 - q1, [f"{q3 - q1} {unit}"]),
        short(f"Use the graph to estimate how many of the {who} {more.format(t=t)}.", n - ct),
        short(f"Use {p['name']}'s graph to estimate how many of the {who} {low}.", n // 4),
    ]
