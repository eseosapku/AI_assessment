"""A right-angled triangle: Pythagoras at Lower Secondary, sine, cosine and tangent at Upper.

The triangle is drawn to scale from the lengths and angle it prints. Roles: the hypotenuse
(hyp), and the sides opposite (opp) and next to (adj) the angle at the first letter.
"""
from __future__ import annotations

import math
import random

from matplotlib.patches import Arc, Polygon, Rectangle

from ..core import FILL_2, INK, mcq, new_figure, short

ID = "right_triangle"
KIND = "maths.geometry"
SUBJECT = "mathematics"
BANDS = ("LS", "UP")
CONCEPTS = tuple(f"mathematics.{c}" for c in (
    "right-angled-triangles", "pythagorean-triples", "tangent-acute-angle", "trigonometric-concepts", "trigonometric-ratios-exact",
))

LETTERS = [("A", "B", "C"), ("P", "Q", "R"), ("L", "M", "N"), ("D", "E", "F"), ("R", "S", "T"), ("G", "H", "K"), ("U", "V", "W")]
TRIPLES = [(3, 4, 5), (5, 12, 13), (8, 15, 17), (7, 24, 25)]


def _clean(v: float) -> bool:
    """Not within a hair of a rounding boundary, so "to 1 decimal place" has one answer."""
    return abs((v * 10) % 1 - 0.5) > 0.05


def _legs(given: dict) -> tuple[float, float]:
    """The two shorter sides (opp, adj) from what is given."""
    if "angle" in given:
        t = math.radians(given["angle"])
        if "hyp" in given:
            return given["hyp"] * math.sin(t), given["hyp"] * math.cos(t)
        if "opp" in given:
            return given["opp"], given["opp"] / math.tan(t)
        return given["adj"] * math.tan(t), given["adj"]
    if "hyp" not in given:
        return given["opp"], given["adj"]
    other = math.sqrt(given["hyp"] ** 2 - given.get("opp", given.get("adj")) ** 2)
    return (given["opp"], other) if "opp" in given else (other, given["adj"])


def sample(rng: random.Random) -> dict:
    band = rng.choice(BANDS)
    letters = list(rng.choice(LETTERS))
    flip = rng.random() < 0.5
    while True:
        if band == "LS":
            if rng.random() < 0.6:
                t = rng.choice(TRIPLES)
                k = rng.randint(1, max(1, 30 // t[2]))  # scaled, the longest side at most 30 cm
                a, b, c = (v * k for v in t)
                opp, adj = (a, b) if rng.random() < 0.5 else (b, a)
                sides = {"opp": opp, "adj": adj, "hyp": c}
                unknown = rng.choice(["opp", "adj", "hyp"])
                given = {k: v for k, v in sides.items() if k != unknown}
                exact = True
            else:
                unknown = rng.choice(["hyp", "opp", "adj"])
                if unknown == "hyp":
                    given = {"opp": rng.randint(3, 15), "adj": rng.randint(3, 15)}
                else:
                    c = rng.randint(6, 20)
                    known = "adj" if unknown == "opp" else "opp"
                    given = {"hyp": c, known: rng.randint(3, c - 2)}
                exact = False
        else:
            exact = False
            if rng.random() < 0.6:
                known = rng.choice(["opp", "adj", "hyp"])
                given = {"angle": rng.randint(20, 70), known: rng.randint(4, 20)}
                unknown = rng.choice([r for r in ("opp", "adj", "hyp") if r != known])
            else:
                pair = rng.choice([("opp", "adj"), ("opp", "hyp"), ("adj", "hyp")])
                vals = sorted(rng.sample(range(3, 21), 2))
                given = dict(zip(pair, vals if "hyp" in pair else rng.sample(vals, 2)))
                unknown = "angle"
        opp, adj = _legs(given)
        if min(opp, adj) < 2 or max(opp, adj) / min(opp, adj) > 3:
            continue  # too thin a triangle to read
        value = {"opp": opp, "adj": adj, "hyp": math.hypot(opp, adj), "angle": math.degrees(math.atan2(opp, adj))}[unknown]
        if exact or _clean(value):
            return {"band": band, "letters": letters, "flip": flip, "given": given, "unknown": unknown, "exact": exact}


def vertices(p: dict) -> dict:
    """{letter: (x, y)}: the angle at the first letter, the right angle at the third."""
    opp, adj = _legs(p["given"])
    s = -1 if p["flip"] else 1
    a, b, c = p["letters"]
    return {a: (s * adj, 0.0), b: (0.0, opp), c: (0.0, 0.0)}


def _value(p: dict) -> float:
    opp, adj = _legs(p["given"])
    return {"opp": opp, "adj": adj, "hyp": math.hypot(opp, adj), "angle": math.degrees(math.atan2(opp, adj))}[p["unknown"]]


def draw(p: dict):
    v = vertices(p)
    a, b, c = p["letters"]
    pts = [v[a], v[b], v[c]]
    xs, ys = [q[0] for q in pts], [q[1] for q in pts]
    span = max(max(xs) - min(xs), max(ys) - min(ys))
    k = 4.0 / span  # drawn so the longer leg is 4 units: the same size whatever the lengths
    P = {n: (x * k, y * k) for n, (x, y) in v.items()}
    fig, ax = new_figure(5.4, 4.6)
    ax.add_patch(Polygon([P[a], P[b], P[c]], closed=True, facecolor=FILL_2, edgecolor=INK, linewidth=1.8))
    s = -1 if p["flip"] else 1
    ax.add_patch(Rectangle(P[c], 0.3 * s, 0.3, fill=False, edgecolor=INK, linewidth=1))
    cx, cy = sum(q[0] for q in P.values()) / 3, sum(q[1] for q in P.values()) / 3
    for n, (x, y) in P.items():
        dx, dy = x - cx, y - cy
        r = math.hypot(dx, dy)
        ax.text(x + 0.35 * dx / r, y + 0.35 * dy / r, n, ha="center", va="center", fontsize=12, fontweight="bold")
    label = {r: f"{val} cm" for r, val in p["given"].items() if r != "angle"}
    if p["unknown"] != "angle":
        label[p["unknown"]] = "x"
    ends = {"opp": (b, c, a), "adj": (a, c, b), "hyp": (a, b, c)}
    for role, text in label.items():
        (x0, y0), (x1, y1), (ox, oy) = P[ends[role][0]], P[ends[role][1]], P[ends[role][2]]
        mx, my = (x0 + x1) / 2, (y0 + y1) / 2
        # Out from the side, square to it, on the side away from the opposite corner, and
        # aligned away from the side so a long label never crosses it or its neighbour.
        nx, ny = -(y1 - y0), x1 - x0
        if nx * (mx - ox) + ny * (my - oy) < 0:
            nx, ny = -nx, -ny
        r = math.hypot(nx, ny)
        nx, ny = nx / r, ny / r
        ax.text(mx + 0.2 * nx, my + 0.2 * ny, text, fontsize=12, style="italic" if text == "x" else "normal",
                ha="left" if nx > 0.3 else "right" if nx < -0.3 else "center",
                va="bottom" if ny > 0.3 else "top" if ny < -0.3 else "center")
    if "angle" in p["given"] or p["unknown"] == "angle":
        ax_, ay = P[a]
        t1 = math.degrees(math.atan2(P[c][1] - ay, P[c][0] - ax_))
        t2 = math.degrees(math.atan2(P[b][1] - ay, P[b][0] - ax_))
        lo, hi = sorted((t1, t2))
        if hi - lo > 180:
            lo, hi = hi, lo + 360
        ax.add_patch(Arc((ax_, ay), 1.2, 1.2, theta1=lo, theta2=hi, color=INK, linewidth=1.2))
        mid = math.radians((lo + hi) / 2)
        text = f"{p['given']['angle']}°" if "angle" in p["given"] else "x"
        ax.text(ax_ + 0.95 * math.cos(mid), ay + 0.95 * math.sin(mid), text, ha="center", va="center", fontsize=11,
                style="italic" if text == "x" else "normal")
    ax.set_xlim(min(q[0] for q in P.values()) - 1.0, max(q[0] for q in P.values()) + 1.0)
    ax.set_ylim(-0.9, max(q[1] for q in P.values()) + 0.8)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def questions(p: dict, rng: random.Random) -> list:
    a, b, c = p["letters"]
    name = {"opp": f"{b}{c}", "adj": f"{a}{c}", "hyp": f"{a}{b}"}
    facts = [f"angle {a} = {val}°" if r == "angle" else f"{name[r]} = {val} cm" for r, val in p["given"].items()]
    v = _value(p)
    if p["unknown"] == "angle":
        ask, ans, forms = "Find the angle x. Give your answer to 1 decimal place.", f"{v:.1f}", [f"{v:.1f}°"]
    elif p["exact"]:
        n = round(v)
        ask, ans, forms = "Find the length x.", str(n), [f"{n} cm", f"{n}cm"]
    else:
        ask, ans, forms = "Find the length x. Give your answer to 1 decimal place.", f"{v:.1f}", [f"{v:.1f} cm", f"{v:.1f}cm"]
    find = short(f"In triangle {a}{b}{c}, {' and '.join(facts)}. {ask}", ans, forms)
    if p["band"] == "LS":
        which = mcq(f"Which side of triangle {a}{b}{c} is the hypotenuse?", f"{a}{b}", [f"{b}{c}", f"{a}{c}"], rng)
    else:
        roles = frozenset((set(p["given"]) | {p["unknown"]}) - {"angle"})
        ratio = {frozenset({"opp", "hyp"}): "sin", frozenset({"adj", "hyp"}): "cos", frozenset({"opp", "adj"}): "tan"}[roles]
        which = mcq(f"Which ratio would you use to find x in triangle {a}{b}{c}: sin, cos or tan?", ratio,
                    [r for r in ("sin", "cos", "tan") if r != ratio], rng)
    return [find, which]
