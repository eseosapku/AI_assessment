"""Magnetic fields (LS, UP): one bar magnet with its field lines arrowed and its ends lettered X and Y, or
two magnets end to end, the left one's poles marked and the right one's lettered; a point P for a compass.
Which pole an end is, the way a compass at P points, and whether the two magnets attract or repel.

The field lines are those of a pair of poles at each magnet's ends (an inverse-square sum), the same model
a test uses to check the compass, and P is placed only where the field points clearly along one axis.
"""
from __future__ import annotations

import math
import random

from matplotlib.patches import Circle, FancyArrowPatch, Rectangle

from ..core import FILL_2, INK, NAMES, infinite, mcq, new_figure, short

ID = "magnet_field"
KIND = "physics.field"
SUBJECT = "physics"
BANDS = ("LS", "UP")
CONCEPTS = tuple(f"physics.{c}" for c in ("magnetism", "magnetization-and-demagnetization", "magnetic-fields"))
# Integrated Science teaches this too (P3n): its Lower Secondary topics are reached by these.
ALSO = tuple(f"science.{c}" for c in ('magnetic-field', 'magnetism'))
# Not the motor effect or induction, which have their own figures, nor electric or gravitational fields.
AVOID = r"motor|induction|generator|transformer|electric field|gravitational|electrostatic|magnetic effect of current|forces on currents|glossary|thinking and working scientifically|science in context|scientific method|science skills"
DIRS = {"up": (0, 1), "down": (0, -1), "left": (-1, 0), "right": (1, 0)}
WAYS = {"up": "up the page", "down": "down the page", "left": "left across the page", "right": "right across the page"}
SPOTS = {"single": [(-3.4, 0.0), (3.4, 0.0), (0.0, 1.8), (0.0, -1.8), (-1.0, 1.6), (1.0, -1.6), (0.0, 2.6)],
         "pair": [(0.0, 1.6), (0.0, -1.6), (0.0, 2.4), (0.0, -2.4), (-3.0, 1.6), (3.0, -1.6), (3.0, 1.6)]}
SETTINGS = ["in the school laboratory", "at the science club", "for a class practical", "during a physics lesson", "with iron filings"]


def poles(p: dict) -> list[tuple[tuple[float, float], int]]:
    """Each pole's place and sign, +1 for north: a magnet as a pair of poles near its ends."""
    if p["kind"] == "single":
        left = 1 if p["left"] == "N" else -1
        return [((-1.8, 0.0), left), ((1.8, 0.0), -left)]
    a = 1 if p["left"] == "N" else -1  # the left magnet's left end
    b = 1 if p["right_left"] == "N" else -1  # the right magnet's left end
    return [((-4.8, 0.0), a), ((-1.2, 0.0), -a), ((1.2, 0.0), b), ((4.8, 0.0), -b)]


def field(p: dict, x, y):
    bx = by = 0.0
    for (px, py), s in poles(p):
        dx, dy = x - px, y - py
        r3 = (dx * dx + dy * dy) ** 1.5 + 1e-9
        bx = bx + s * dx / r3
        by = by + s * dy / r3
    return bx, by


def _trace(p: dict, x: float, y: float, bodies, step: float = 0.03, steps: int = 3000) -> list[tuple[float, float]]:
    """A field line from (x, y), followed along the field (midpoint steps) until it reaches a magnet or goes far."""
    pts = [(x, y)]
    for _ in range(steps):
        bx, by = field(p, x, y)
        m = math.hypot(bx, by) or 1.0
        hx, hy = x + 0.5 * step * bx / m, y + 0.5 * step * by / m
        bx, by = field(p, hx, hy)
        m = math.hypot(bx, by) or 1.0
        x, y = x + step * bx / m, y + step * by / m
        if any(x0 - 0.02 <= x <= x1 + 0.02 and abs(y) <= 0.47 for x0, x1 in bodies) or abs(x) > 14 or abs(y) > 10:
            pts.append((x, y))
            break
        pts.append((x, y))
    return pts


def compass(p: dict) -> str:
    bx, by = field(p, *p["P"])
    return max(DIRS, key=lambda d: DIRS[d][0] * bx + DIRS[d][1] * by)


def _clear(p: dict) -> bool:
    """P where the field points within 20 degrees of an axis, so the compass has one answer."""
    bx, by = field(p, *p["P"])
    d = DIRS[compass(p)]
    return (d[0] * bx + d[1] * by) >= math.cos(math.radians(20)) * math.hypot(bx, by)


def sample(rng: random.Random) -> dict:
    band = rng.choice(BANDS)
    while True:
        kind = rng.choice(["single", "pair"])
        p = {"band": band, "kind": kind, "left": rng.choice("NS"), "P": list(rng.choice(SPOTS[kind]))}
        if kind == "pair":
            p["right_left"] = rng.choice("NS")
        if _clear(p):
            return p


def _magnet(ax, x0, x1, left_label, right_label):
    mid = (x0 + x1) / 2
    ax.add_patch(Rectangle((x0, -0.45), mid - x0, 0.9, facecolor=FILL_2, edgecolor=INK, linewidth=1.5, zorder=3))
    # One fill: a shaded half hinted which pole was N (P3g final review).
    ax.add_patch(Rectangle((mid, -0.45), x1 - mid, 0.9, facecolor=FILL_2, edgecolor=INK, linewidth=1.5, zorder=3))
    ax.text(x0 + 0.4, 0, left_label, ha="center", va="center", fontsize=13, fontweight="bold", zorder=4)
    ax.text(x1 - 0.4, 0, right_label, ha="center", va="center", fontsize=13, fontweight="bold", zorder=4)


def lines(p: dict) -> list[tuple[list[tuple[float, float]], int | None]]:
    """Each field line from the magnet's surface, and where its arrow sits: on the first stretch inside the frame, at
    least 1.0 along from the pole, or none on a stub too short to hold one (P3h review: lines that began in mid-air
    with small arrows beside the pole read as pointing into N)."""
    single = p["kind"] == "single"
    W, H = (4.6, 3.2) if single else (6.4, 3.2)
    bodies = [(-2.0, 2.0)] if single else [(-5.0, -1.0), (1.0, 5.0)]
    lefts = (-1.8,) if single else (-4.8, 1.2)  # poles at the left end of their magnet: their field leaves leftwards
    out_lines = []
    for (px, py), sign in poles(p):
        if sign < 0:
            continue
        out = -1 if any(abs(px - x) < 1e-9 for x in lefts) else 1
        x0, x1 = next(b for b in bodies if b[0] <= px <= b[1])
        # Lines leave a north pole all round, not only from its end face: traced from a ring about it, outside the
        # magnet, so those leaving sideways loop back to the south end; each is drawn from the magnet's surface.
        for deg in (-140, -110, -80, -50, -20, 20, 50, 80, 110, 140):
            a = math.radians(deg)
            sx, sy = px + out * 0.62 * math.cos(a), 0.62 * math.sin(a)
            if any(b0 - 0.05 <= sx <= b1 + 0.05 and abs(sy) <= 0.5 for b0, b1 in bodies):
                continue
            # Traced from just off the surface, where the ring's direction meets the magnet: a stub to the ring left a kink
            # that read as a line turning into N (P3h fix review).
            if x0 <= sx <= x1:
                start = (sx, math.copysign(0.5, sy))
            else:
                start = (x1 + 0.05 if sx > x1 else x0 - 0.05, max(-0.4, min(0.4, sy * 0.65)))
            pts = _trace(p, *start, bodies)
            k, along, at = 1, 0.0, None
            while k < len(pts) and abs(pts[k][0]) < W - 0.3 and abs(pts[k][1]) < H - 0.3:
                along += math.dist(pts[k - 1], pts[k])
                k += 1
            first = along  # the length of the first stretch inside the frame
            if first >= 1.6:
                want, along = max(1.0, 0.5 * first), 0.0
                for j in range(1, k - 1):
                    along += math.dist(pts[j - 1], pts[j])
                    if along >= want:
                        at = j
                        break
            out_lines.append((pts, at))
    return out_lines


def draw(p: dict):
    single = p["kind"] == "single"
    W, H = (4.6, 3.2) if single else (6.4, 3.2)
    fig, ax = new_figure(6.4 if single else 7.2, 4.6)
    for pts, i in lines(p):
        line = ax.plot([x for x, _ in pts], [y for _, y in pts], color=INK, linewidth=0.9)
        infinite(line)  # a field line runs on past the frame and is cut there on purpose
        if i is not None:
            ax.add_patch(FancyArrowPatch(pts[i - 1], pts[i + 1], arrowstyle="-|>", mutation_scale=15, color=INK, lw=0.9, zorder=4))
    if single:
        _magnet(ax, -2.0, 2.0, "X", "Y")
    else:
        other = {"N": "S", "S": "N"}
        _magnet(ax, -5.0, -1.0, p["left"], other[p["left"]])
        _magnet(ax, 1.0, 5.0, "X", "Y")
    px, py = p["P"]
    ax.add_patch(Circle((px, py), 0.28, facecolor="white", edgecolor=INK, linewidth=1.4, zorder=5))
    ax.text(px + 0.45, py + 0.3, "P", ha="left", va="bottom", fontsize=12, fontweight="bold", zorder=6)
    ax.set_xlim(-W, W)
    ax.set_ylim(-H, H)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def questions(p: dict, rng: random.Random) -> list:
    name, friend = rng.sample(NAMES, 2)
    if p["kind"] == "single":
        x_pole = p["left"]
        intro = f"{name} drew the field around a bar magnet {rng.choice(SETTINGS)}. Is end X a north pole or a south pole?"
    else:
        x_pole = p["right_left"]
        intro = f"{name} drew the field between two bar magnets {rng.choice(SETTINGS)}. Is end X a north pole or a south pole?"
    word = "north" if x_pole == "N" else "south"
    key = WAYS[compass(p)]
    qs = [short(intro, word, [word, word[0].upper(), f"{word} pole", f"a {word} pole", f"{word.capitalize()} pole"]),
          mcq(f"{friend} places a small compass at P. Which way does the north end of its needle point?", key, [w for w in WAYS.values() if w != key],
              rng)]
    if p["kind"] == "pair":
        facing_alike = ({"N": "S", "S": "N"}[p["left"]]) == p["right_left"]
        keys = [f"{a}: the facing poles are {b}" for a in ("Attract", "Repel") for b in ("unlike", "alike")]
        k = keys[3] if facing_alike else keys[0]
        qs.append(mcq("Do the two magnets attract or repel each other?", k, [x for x in keys if x != k], rng))
    return qs
