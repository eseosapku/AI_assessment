"""A circle with centre O and one circle theorem: an angle given, x to find (LS, UP).

Points are placed on the circle so the marked angles are exactly the sizes printed, turned by
a random amount so no two figures look alike. Lower Secondary has the angle in a semicircle,
the tangent and the isosceles triangle of two radii; Upper Secondary has all six.
"""
from __future__ import annotations

import math
import random

from matplotlib.patches import Arc, Circle

from ..core import INK, mcq, new_figure, short

ID = "circle_theorem"
KIND = "maths.geometry"
SUBJECT = "mathematics"
BANDS = ("LS", "UP")
CONCEPTS = tuple(f"mathematics.{c}" for c in (
    "circle-theorems", "angles-centre-circumference-circle", "angle-in-semicircle", "angles-cyclic-quadrilateral",
    "angles-same-segment", "circle-tangent", "chords-properties", "circle-elements",
))

REASONS = {
    "centre": "The angle at the centre is twice the angle at the circumference",
    "semicircle": "The angle in a semicircle is 90°",
    "cyclic": "Opposite angles of a cyclic quadrilateral add up to 180°",
    "same segment": "Angles in the same segment are equal",
    "tangent": "A tangent meets a radius at 90°",
    "isosceles": "Two radii make an isosceles triangle",
}
BY_BAND = {"LS": ["semicircle", "tangent", "isosceles"], "UP": sorted(REASONS)}
# The letters printed for the points A, B, C, D and T: a different set from figure to figure.
LETTERS = ["ABCDT", "PQRST", "KLMNT", "EFGHT", "UVWYT", "PQRSA", "LMNPK"]


def _on(deg: float) -> tuple[float, float]:
    return math.cos(math.radians(deg)), math.sin(math.radians(deg))


def sample(rng: random.Random) -> dict:
    band = rng.choice(BANDS)
    theorem = rng.choice(BY_BAND[band])
    rot = rng.randrange(0, 360, 5)
    g = {"centre": rng.randint(20, 80), "semicircle": rng.randint(20, 70), "cyclic": rng.randint(60, 120),
         "same segment": rng.randint(20, 70), "tangent": rng.randint(25, 65), "isosceles": 2 * rng.randint(20, 70)}[theorem]
    flip = theorem == "centre" and rng.random() < 0.5  # the angle at the centre given, the one at the edge asked
    return {"band": band, "theorem": theorem, "rot": rot, "g": g, "flip": flip,
            "given": 2 * g if flip else g, "on_circle": _on_circle(theorem), "letters": rng.choice(LETTERS)}


def _shown(p: dict, name: str) -> str:
    """The letter printed for a point; O is always the centre."""
    return name if name == "O" else p["letters"]["ABCDT".index(name)]


def _on_circle(theorem: str) -> list[str]:
    return {"centre": ["A", "B", "C"], "semicircle": ["A", "B", "C"], "cyclic": ["A", "B", "C", "D"],
            "same segment": ["A", "B", "C", "D"], "tangent": ["A"], "isosceles": ["A", "B"]}[theorem]


def points(p: dict) -> dict:
    r, g, t = p["rot"], p["g"], p["theorem"]
    pts = {"O": (0.0, 0.0)}
    if t == "centre":
        pts.update(A=_on(r), B=_on(r + 2 * g), C=_on(r + g + 180))
    elif t == "semicircle":
        pts.update(A=_on(r + 180), B=_on(r), C=_on(r + 2 * g))
    elif t == "cyclic":
        pts.update(B=_on(r), C=_on(r + g), D=_on(r + 2 * g), A=_on(r + g + 180))
    elif t == "same segment":
        rest = 360 - 2 * g
        pts.update(A=_on(r), B=_on(r + 2 * g), C=_on(r + 2 * g + 0.3 * rest), D=_on(r + 2 * g + 0.7 * rest))
    elif t == "tangent":
        a = _on(r + 270)
        tx, ty = -a[1], a[0]  # along the tangent: OA turned a right angle
        k = math.tan(math.radians(g))
        pts.update(A=a, T=(a[0] + k * tx, a[1] + k * ty))
    else:  # isosceles
        pts.update(A=_on(r), B=_on(r + g))
    return pts


def marks(p: dict) -> list[tuple[str, str, str, str]]:
    """The two marked angles: (vertex, one arm's end, the other arm's end, 'given' or 'x')."""
    t = p["theorem"]
    if t == "centre":
        edge, centre = ("C", "A", "B"), ("O", "A", "B")
        return [(*centre, "given"), (*edge, "x")] if p["flip"] else [(*edge, "given"), (*centre, "x")]
    return {"semicircle": [("A", "C", "B", "given"), ("B", "A", "C", "x")],
            "cyclic": [("A", "D", "B", "given"), ("C", "B", "D", "x")],
            "same segment": [("C", "A", "B", "given"), ("D", "A", "B", "x")],
            "tangent": [("O", "A", "T", "given"), ("T", "O", "A", "x")],
            "isosceles": [("O", "A", "B", "given"), ("A", "O", "B", "x")]}[t]


SEGMENTS = {"centre": ["OA", "OB", "CA", "CB"], "semicircle": ["AB", "AC", "BC"], "cyclic": ["AB", "BC", "CD", "DA"],
            "same segment": ["AC", "CB", "AD", "DB"], "tangent": ["OA", "OT"], "isosceles": ["OA", "OB", "AB"]}


def draw(p: dict):
    pts = points(p)
    fig, ax = new_figure(5.0, 5.0)
    ax.add_patch(Circle((0, 0), 1, fill=False, edgecolor=INK, linewidth=1.8))
    for seg in SEGMENTS[p["theorem"]]:
        (x0, y0), (x1, y1) = pts[seg[0]], pts[seg[1]]
        ax.plot([x0, x1], [y0, y1], color=INK, linewidth=1.4)
    if p["theorem"] == "tangent":
        (ax_, ay), (tx, ty) = pts["A"], pts["T"]
        dx, dy = tx - ax_, ty - ay
        ax.plot([ax_ - 0.5 * dx, tx + 0.25 * dx], [ay - 0.5 * dy, ty + 0.25 * dy], color=INK, linewidth=1.4)
    # The centre only where the theorem uses it: in a cyclic quadrilateral or the same segment
    # it is a stray dot where chords may cross.
    centred = p["theorem"] not in ("cyclic", "same segment")
    if centred:
        ax.add_patch(Circle((0, 0), 0.025, color=INK))
    for name, (x, y) in pts.items():
        r = math.hypot(x, y)
        if name == "O":
            if centred:
                ax.text(0.06, -0.1, "O", fontsize=12, fontweight="bold", ha="left", va="top")
        else:
            ax.text(x * (1 + 0.13 / r), y * (1 + 0.13 / r), _shown(p, name), fontsize=12, fontweight="bold", ha="center", va="center")
    labels = {"given": f"{p['given']}°", "x": "x"}
    for vertex, a, b, which in marks(p):
        vx, vy = pts[vertex]
        t1 = math.degrees(math.atan2(pts[a][1] - vy, pts[a][0] - vx))
        t2 = math.degrees(math.atan2(pts[b][1] - vy, pts[b][0] - vx))
        lo, hi = sorted((t1, t2))
        if hi - lo > 180:
            lo, hi = hi, lo + 360
        ax.add_patch(Arc((vx, vy), 0.3, 0.3, theta1=lo, theta2=hi, color=INK, linewidth=1.1))
        mid = math.radians((lo + hi) / 2)
        rad = 0.3 if hi - lo > 50 else 0.38
        ax.text(vx + rad * math.cos(mid), vy + rad * math.sin(mid), labels[which], ha="center", va="center", fontsize=10,
                style="italic" if which == "x" else "normal")
    xs = [q[0] for q in pts.values()] + [-1, 1]
    ys = [q[1] for q in pts.values()] + [-1, 1]
    ax.set_xlim(min(xs) - 0.3, max(xs) + 0.3)
    ax.set_ylim(min(ys) - 0.3, max(ys) + 0.3)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def _answer(p: dict) -> int:
    g, t = p["g"], p["theorem"]
    return {"centre": g if p["flip"] else 2 * g, "semicircle": 90 - g, "cyclic": 180 - g, "same segment": g,
            "tangent": 90 - g, "isosceles": (180 - g) // 2}[t]


def questions(p: dict, rng: random.Random) -> list:
    t, given = p["theorem"], p["given"]
    n = lambda name: _shown(p, name)  # noqa: E731
    v, a, b, _ = marks(p)[0]
    named = f"Angle {n(a)}{n(v)}{n(b)} = {given}°"
    four = f"{n('A')}, {n('B')}, {n('C')} and {n('D')} lie on the circle."
    lead = {"semicircle": f"{n('A')}{n('B')} is a diameter of the circle, centre O.",
            "tangent": f"{n('T')}{n('A')} is a tangent to the circle at {n('A')}, and O is the centre.",
            "cyclic": four, "same segment": four}
    x = _answer(p)
    return [
        short(f"{lead.get(t, 'O is the centre of the circle.')} {named}. Find the angle x.", x, [f"{x}°"]),
        mcq(f"Which fact do you need to find x from the {given}° angle?", REASONS[t], rng.sample([r for k, r in REASONS.items() if k != t], 3), rng),
    ]
