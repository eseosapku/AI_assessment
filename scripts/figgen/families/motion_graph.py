"""Motion graphs (LS, UP, AL): a distance–time graph (moving, stopped, moving on) or a speed–time graph
(speeding up, steady, slowing down) of a runner, a bicycle, a moto or a minibus.

Every corner lies on gridlines: times in steps of 10 s, distances and speeds in whole steps, so every
speed, acceleration and distance asked for is exact. The speed–time graph also asks the resultant force
(F = ma) for a stated mass.
"""
from __future__ import annotations

import random
from fractions import Fraction

from ..core import GRID, INK, NAMES, exact, measure, new_figure, short

ID = "motion_graph"
KIND = "graph.line"
SUBJECT = "physics"
BANDS = ("LS", "UP", "AL")
CONCEPTS = tuple(f"physics.{c}" for c in ("speed", "velocity", "acceleration", "distance-time-graphs"))
# Integrated Science teaches this too (P3n): its Lower Secondary topics are reached by these.
ALSO = tuple(f"science.{c}" for c in ('speed-and-velocity',))
# Waves, oscillations, circular motion, sound, quakes and relativity share speed but not motion graphs.
AVOID = r"wave|oscillat|circular|\bsound|earthquake|relativity|work and power|glossary|thinking and working scientifically|science in context|scientific method|science skills"
# what moves, its top speed (m/s), and the mass with its rider (kg)
MOVERS = [("runner", 6, 60), ("bicycle", 8, 80), ("moto", 16, 200), ("minibus", 20, 2000)]


def sample(rng: random.Random) -> dict:
    band = rng.choice(BANDS)
    mover, top, _ = rng.choice(MOVERS)
    if rng.random() < 0.5:
        while True:
            ystep = rng.choice([10, 20, 50])
            corners, t, d = [[0, 0]], 0, 0
            for moving in (True, False, True):
                dur = 10 * rng.randint(1, 4)
                speed = rng.choice([v / 2 for v in range(2, 2 * top + 1)]) if moving else 0
                if (speed * dur) % ystep:
                    break
                t, d = t + dur, d + int(speed * dur)
                corners.append([t, d])
            else:
                if (Fraction(d, t) * 2).denominator == 1 and corners[1][1] > 0 and corners[3][1] > corners[2][1]:
                    return {"band": band, "kind": "dt", "mover": mover, "corners": corners, "tstep": 10, "ystep": ystep}
        # unreachable
    while True:
        speeds = [0, rng.randint(2, top), None, 0]
        speeds[2] = speeds[1]
        corners, t, ok = [[0, 0]], 0, True
        for v0, v1 in zip(speeds, speeds[1:]):
            durs = [d for d in range(2, 21, 2) if v0 == v1 or ((Fraction(abs(v1 - v0), d) * 2).denominator == 1 and Fraction(abs(v1 - v0), d) <= 2)]
            if not durs:
                ok = False
                break
            t += rng.choice(durs)
            corners.append([t, v1])
        area = sum(Fraction((a[1] + b[1]) * (b[0] - a[0]), 2) for a, b in zip(corners, corners[1:]))
        if ok and area.denominator == 1 and t <= 50:
            return {"band": band, "kind": "vt", "mover": mover, "corners": corners, "tstep": 2, "ystep": 1}


def draw(p: dict):
    pts = p["corners"]
    T, Y = pts[-1][0], max(y for _, y in pts)
    fig, ax = new_figure(6.4, 4.2)
    ax.plot([t for t, _ in pts], [y for _, y in pts], color=INK, linewidth=1.9)
    ts, ys = p["tstep"], p["ystep"]
    # Numbers every 2 s on a short speed-time graph, so no reading falls between two unnumbered lines.
    ax.set_xticks(range(0, T + 1, ts * (1 if ts == 10 else 5 if T > 30 else 2 if T > 12 else 1)))
    ax.set_xticks(range(0, T + 1, ts), minor=True)
    top = Y + ys
    ax.set_yticks(range(0, top + 1, ys * (2 if top // ys > 10 else 1)))
    ax.set_yticks(range(0, top + 1, ys), minor=True)
    ax.grid(True, which="both", color=GRID, linewidth=0.6)
    ax.set_axisbelow(True)
    ax.set_xlim(0, T + ts)
    ax.set_ylim(0, top)
    ax.set_xlabel("Time (s)")
    ax.set_ylabel("Distance (m)" if p["kind"] == "dt" else "Speed (m/s)")
    ax.tick_params(labelsize=9)
    return fig


def _seconds(t: int) -> str:
    return "second" if t == 1 else f"{t} seconds"


def questions(p: dict, rng: random.Random) -> list:
    pts, mover = p["corners"], p["mover"]
    name = rng.choice(NAMES)
    if p["kind"] == "dt":
        (t0, d0), (t1, d1) = pts[0], pts[1]
        v = Fraction(d1 - d0, t1 - t0)
        stop = sum(b[0] - a[0] for a, b in zip(pts, pts[1:]) if b[1] == a[1])
        avg = Fraction(pts[-1][1], pts[-1][0])
        return [
            short(f"{name} timed a {mover} on this journey. What was the {mover}'s speed in the first {_seconds(t1)}?", exact(v), measure(v, "m/s")),
            short(f"For how long was the {mover} stopped?", stop, measure(stop, "s")),
            short(f"What was the {mover}'s average speed for the whole journey?", exact(avg), measure(avg, "m/s")),
            short(f"How far did the {mover} travel altogether?", pts[-1][1], measure(pts[-1][1], "m")),
        ]
    mass = dict((m, kg) for m, _, kg in MOVERS)[mover]
    (t0, v0), (t1, v1) = pts[0], pts[1]
    a1 = Fraction(v1 - v0, t1 - t0)
    while (mass * a1).denominator != 1:
        mass += 10
    area = int(sum(Fraction((a[1] + b[1]) * (b[0] - a[0]), 2) for a, b in zip(pts, pts[1:])))
    d = -Fraction(pts[-1][1] - pts[-2][1], pts[-1][0] - pts[-2][0])
    return [
        short(f"{name} watched a {mover} start from rest. What was the {mover}'s acceleration in the first {_seconds(t1)}?", exact(a1),
              measure(a1, "m/s²") + measure(a1, "m/s2")[1:]),
        short(f"How far did the {mover} travel altogether?", area, measure(area, "m")),
        short(("The runner has a mass of" if mover == "runner" else f"The {mover} and the people on board have a mass of")
              + f" {mass} kg. What resultant force speeds {'the runner' if mover == 'runner' else 'them'} up in the first {_seconds(t1)}?",
              int(mass * a1), measure(int(mass * a1), "N")),
        short(f"What was the {mover}'s deceleration in the last {_seconds(pts[-1][0] - pts[-2][0])}?", exact(d), measure(d, "m/s²") + measure(d, "m/s2")[1:]),
    ]
