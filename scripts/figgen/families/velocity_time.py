"""A velocity–time graph of a journey in straight stages: the acceleration at the start, the
deceleration at the end, the distance travelled (the area) and the greatest speed (UP, AL).

Every corner is a grid point: the times are multiples of the grid step and the speeds whole metres per
second. Each acceleration is a whole or half number of m/s², and the area is a whole number of metres.
"""
from __future__ import annotations

import random
from fractions import Fraction

from ..core import GRID, INK, NAMES, new_figure, num, short

ID = "velocity_time"
KIND = "graph.line"
SUBJECT = "mathematics"
BANDS = ("UP", "AL")
CONCEPTS = tuple(f"mathematics.{c}" for c in ("acceleration-time", "acceleration-displacement", "differentiation-kinematics", "kinematic-graphs"))
# Straight-line motion: not circular motion, projectiles, vectors or trig.
AVOID = r"circular motion|projectile|vector|trigonometric|gradient function"
# what moves, and its greatest speed in m/s
MOVERS = [("minibus", 16), ("moto", 14), ("bus", 14), ("car", 20), ("cyclist", 8), ("train", 20)]


def _stage(rng, v0: int, v1: int, tstep: int) -> int | None:
    """A duration (a multiple of tstep) that changes the speed from v0 to v1 at a whole or half m/s², at most
    2 m/s²: a minibus, a moto or a cyclist speeds up no faster than that."""
    times = [t for t in range(tstep, 21, tstep) if (Fraction(abs(v1 - v0), t) * 2).denominator == 1 and Fraction(abs(v1 - v0), t) <= 2]
    return rng.choice(times) if times else None


def sample(rng: random.Random) -> dict:
    while True:
        mover, vmax = rng.choice(MOVERS)
        tstep = rng.choice([1, 2])
        top = rng.randint(4, vmax)
        speeds = [0, top, top, 0] if rng.random() < 0.6 else [0, rng.randint(2, top - 2), rng.randint(2, top - 2), top, 0]
        if len(speeds) == 5 and speeds[1] != speeds[2]:
            speeds[2] = speeds[1]  # the second stage is steady
        times, ok = [0], True
        for v0, v1 in zip(speeds, speeds[1:]):
            d = rng.choice(range(tstep * 2, 21, tstep)) if v0 == v1 else _stage(rng, v0, v1, tstep)
            if d is None:
                ok = False
                break
            times.append(times[-1] + d)
        if not ok or times[-1] > 50:
            continue
        corners = [[t, v] for t, v in zip(times, speeds)]
        area = sum(Fraction((a[1] + b[1]) * (b[0] - a[0]), 2) for a, b in zip(corners, corners[1:]))
        if area.denominator == 1:
            return {"band": rng.choice(BANDS), "mover": mover, "tstep": tstep, "corners": corners, "name": rng.choice(NAMES)}


def draw(p: dict):
    pts = p["corners"]
    T = pts[-1][0]
    V = max(v for _, v in pts)
    fig, ax = new_figure(6.4, 4.2)
    ax.plot([t for t, _ in pts], [v for _, v in pts], color=INK, linewidth=1.9)
    # A gridline at every whole m/s and every time step, numbered at a multiple of the step: every
    # corner lies on two lines, and no numbered line falls between them.
    vstep = 1
    big = p["tstep"] * (5 if T > 30 else 2 if T > 12 else 1)
    ax.set_xticks(range(0, T + 1, big))
    ax.set_xticks(range(0, T + 1, p["tstep"]), minor=True)
    ax.set_yticks(range(0, V + vstep + 1, 2 if V > 10 else 1))
    ax.set_yticks(range(0, V + vstep + 1, vstep), minor=True)
    ax.grid(True, which="both", color=GRID, linewidth=0.6)
    ax.set_axisbelow(True)
    ax.set_xlim(0, T + p["tstep"])
    ax.set_ylim(0, V + vstep)
    ax.set_xlabel("Time (s)")
    ax.set_ylabel("Velocity (m/s)")
    ax.tick_params(labelsize=9)
    return fig


def _seconds(t: int) -> str:
    return "second" if t == 1 else f"{t} seconds"  # "the first second", never "the first 1 seconds"


def _rate(f: Fraction) -> list[str]:
    """An acceleration as a student writes it: 1.5, 3/2, with m/s² or m/s2."""
    values = [num(f)] + ([f"{f.numerator}/{f.denominator}"] if f.denominator > 1 else [])
    return values + [f"{v} {u}" for v in values for u in ("m/s²", "m/s2")]


def questions(p: dict, rng: random.Random) -> list:
    pts = p["corners"]
    (t0, v0), (t1, v1) = pts[0], pts[1]
    a1 = Fraction(v1 - v0, t1 - t0)
    first = short(f"{p['name']} watched a {p['mover']} start from rest. What is its acceleration in the first {_seconds(t1)}?", num(a1),
                  _rate(a1))
    (ta, va), (tb, vb) = pts[-2], pts[-1]
    d = Fraction(va - vb, tb - ta)
    last = short(f"What is its deceleration in the last {_seconds(tb - ta)}?", num(d), _rate(d))
    area = int(sum(Fraction((a[1] + b[1]) * (b[0] - a[0]), 2) for a, b in zip(pts, pts[1:])))
    distance = short("How far does it travel altogether?", area, [f"{area} m", f"{area} metres"])
    V = max(v for _, v in pts)
    top = short("What is its greatest speed?", V, [f"{V} m/s"])
    return [first, last, distance, top]
