"""Earthquakes and tsunamis (UP), for S6 Physics "Earthquakes, Landslides, Tsunami, Floods, and Cyclones". Two kinds:

- trace: a seismogram on a time grid, time counted from the earthquake. The P-waves and the S-waves left the epicentre
  together, so each arrives at distance ÷ speed; both arrivals fall on gridlines and are marked. The speeds and the
  rule distance = time lag × vP × vS ÷ (vP − vS) are printed above the trace. Asks the time lag, the distance to the
  epicentre, and when the P-waves (or the S-waves) arrived.
- tsunami: a cross-section of the ocean from deep water to the coast, four lettered points with their depths printed;
  v = √(g × d) with g = 10 m/s² printed. Depths are tenths of perfect squares, so every speed is a whole number. Asks
  the speed at a point, the minutes to cross a stretch of ocean as deep as a point, and how many times faster the wave
  is at one point than at another.
"""
from __future__ import annotations

import math
import random
from fractions import Fraction

from matplotlib.patches import Polygon

from ..core import GRID, INK, NAMES, exact, new_figure, short

ID = "seismogram"
KIND = "physics.wave"
SUBJECT = "physics"
BANDS = ("UP",)
CONCEPTS = ("physics.natural-hazards",)
NEEDS = r"earthquake|tsunami|seismic"
AVOID = r"glossary|thinking and working scientifically"

# (vP, vS) in km/s: the P-wave arrives r lags after the quake and the S-wave r + 1 lags, r = vS ÷ (vP − vS).
SPEEDS = [("6", "3"), ("8", "4"), ("6", "4"), ("7.5", "5"), ("8", "4.8"), ("7", "4.2"), ("6", "3.6")]
# A tsunami's speed in m/s and the depth giving it with g = 10 m/s²: d = v² ÷ 10.
TSUNAMI = [20, 30, 50, 60, 100, 150, 200, 250]
LETTERS = ["PQRS", "ABCD", "KLMN", "WXYZ"]


def sample(rng: random.Random) -> dict:
    if rng.random() < 0.5:
        while True:
            vp, vs = rng.choice(SPEEDS)
            r = Fraction(vs) / (Fraction(vp) - Fraction(vs))
            step = rng.choice([1, 2, 5])
            lag = step * rng.randint(3, 12)
            tp, ts = r * lag, (r + 1) * lag
            if tp.denominator != 1 or tp % step or ts % step:
                continue
            label = 5 * step if ts / step > 24 else 2 * step if ts / step > 10 else step
            tmax = (int(ts + Fraction(lag, 2)) // label + 1) * label
            if not 12 <= tmax / step <= 60:
                continue
            distance = lag * Fraction(vp) * Fraction(vs) / (Fraction(vp) - Fraction(vs))
            return {"band": "UP", "kind": "trace", "vp": vp, "vs": vs, "step": step, "label": label, "tmax": tmax,
                    "distance": int(distance), "wiggle": rng.randint(1, 10_000)}
    while True:
        speeds = sorted(rng.sample(TSUNAMI, 4), reverse=True)
        if speeds[0] < 150:
            continue
        pairs = [(a, b) for a in speeds for b in speeds if a > b and a % b == 0]
        if pairs:
            break
    letters = rng.choice(LETTERS)
    deep = rng.choice(speeds[:2])
    minutes = rng.choice([m for m in (10, 15, 20, 30, 40, 45, 60) if (Fraction(6, 100) * deep * m).denominator == 1])
    a, b = rng.choice(pairs)
    return {"band": "UP", "kind": "tsunami", "points": [[L, v * v // 10] for L, v in zip(letters, speeds)],
            "cross": [letters[speeds.index(deep)], int(Fraction(6, 100) * deep * minutes)],
            "pair": [letters[speeds.index(a)], letters[speeds.index(b)]]}


# --- drawing ------------------------------------------------------------------------------------------------------

def _trace(p: dict):
    d = Fraction(p["distance"])
    tp, ts = float(d / Fraction(p["vp"])), float(d / Fraction(p["vs"]))
    rng = random.Random(p["wiggle"])
    n = 2400
    xs = [p["tmax"] * i / n for i in range(n + 1)]
    period = max(0.6, p["step"] / 2)
    ys = []
    for x in xs:
        y = 0.03 * math.sin(2 * math.pi * x / (period * 0.7) + 1.3) + 0.02 * (rng.random() - 0.5)
        if x >= tp:
            k = x - tp
            y += 0.24 * math.exp(-k / (3 * (ts - tp))) * math.sin(2 * math.pi * k / period) * (0.8 + 0.4 * rng.random())
        if x >= ts:
            k = x - ts
            y += 0.78 * math.exp(-k / (1.2 * (ts - tp))) * math.sin(2 * math.pi * k / (1.5 * period)) * (0.85 + 0.3 * rng.random())
        ys.append(y)
    return xs, ys, tp, ts


def _draw_trace(p: dict):
    fig, ax = new_figure(7.4, 4.0)
    step, tmax = p["step"], p["tmax"]
    ax.set_xticks(range(0, tmax + 1, p["label"]))
    ax.set_xticks(range(0, tmax + 1, step), minor=True)
    ax.grid(True, which="both", axis="x", color=GRID, linewidth=0.6)
    ax.set_axisbelow(True)
    ax.set_xlim(0, tmax)
    ax.set_ylim(-1.15, 1.55)
    ax.set_yticks([])
    ax.spines["left"].set_visible(False)
    xs, ys, tp, ts = _trace(p)
    ax.plot(xs, ys, color=INK, linewidth=0.9, gid="trace")
    for t, word in ((tp, "P-waves\narrive"), (ts, "S-waves\narrive")):
        ax.plot([t, t], [-1.1, 1.08], color=INK, linewidth=0.9, linestyle=(0, (4, 3)))
        ax.text(t, 1.13, word, ha="center", va="bottom", fontsize=9.5)
    ax.set_xlabel("Time after the earthquake (s)")
    ax.set_title(f"Speed of P-waves = {p['vp']} km/s     Speed of S-waves = {p['vs']} km/s\n"
                 "distance to epicentre = time lag × vP × vS ÷ (vP − vS)", fontsize=10)
    ax.tick_params(labelsize=9)
    return fig


def _draw_tsunami(p: dict):
    fig, ax = new_figure(7.4, 4.4)
    xs = [1.0, 3.2, 5.4, 7.4]
    scale = 7000.0
    bed = [(0.0, -p["points"][0][1] / scale)] + [(x, -d / scale) for x, (_, d) in zip(xs, p["points"])] + [(8.4, 0.0), (9.4, 0.12)]
    ax.add_patch(Polygon([(0, 0)] + bed[:-1] + [(8.4, 0)], closed=True, facecolor="#dceaf5", edgecolor="none", zorder=0))
    ax.add_patch(Polygon(bed + [(9.4, -1.05), (0.0, -1.05)], closed=True, facecolor="#cdb892", edgecolor="none", zorder=1))
    bx, by = zip(*bed)
    ax.plot(bx, by, color=INK, linewidth=1.4, gid="seabed", zorder=2)
    ax.plot([0, 8.4], [0, 0], color="#2f6fa3", linewidth=1.4, zorder=2)
    ax.text(9.0, 0.2, "coast", ha="center", va="bottom", fontsize=10)
    ax.text(1.15, -0.06, "sea surface", ha="left", va="top", fontsize=9, color="#2f6fa3")
    for x, (L, d) in zip(xs, p["points"]):
        ax.plot([x, x], [0, -d / scale], color=INK, linewidth=0.9, linestyle=(0, (2, 2)), zorder=3)
        ax.text(x, 0.48, L, ha="center", va="center", fontsize=12, fontweight="bold",
                bbox=dict(boxstyle="circle,pad=0.2", facecolor="white", edgecolor=INK, linewidth=1.1))
        ax.text(x, 0.18, f"depth {d} m", ha="center", va="center", fontsize=9.5)
    ax.set_title("Speed of a tsunami: v = √(g × d), where d is the depth of the water\n"
                 "g = 10 m/s²     (depths are printed; not drawn to scale)", fontsize=10)
    ax.set_xlim(0, 9.4)
    ax.set_ylim(-1.05, 0.75)
    ax.axis("off")
    return fig


def draw(p: dict):
    return _draw_trace(p) if p["kind"] == "trace" else _draw_tsunami(p)


# --- questions ----------------------------------------------------------------------------------------------------

SETTINGS = ["in a lesson on earthquakes", "for a project on natural hazards", "at the science club", "for homework",
            "in a physics class in Rubavu", "in a revision session in Musanze", "for a class test"]
WHO_TRACE = ["read this seismogram from the school seismometer", "studied this seismogram", "was given this seismogram",
             "looked at this record from a seismometer"]


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    if p["kind"] == "trace":
        d = Fraction(p["distance"])
        tp, ts = d / Fraction(p["vp"]), d / Fraction(p["vs"])
        lag = ts - tp
        wave, t = rng.choice([("P", tp), ("S", ts)])
        return [short(f"{who} {rng.choice(WHO_TRACE)} {rng.choice(SETTINGS)}. What is the time lag between the arrival of "
                      f"the P-waves and the arrival of the S-waves, in seconds?", exact(lag),
                      [exact(lag), f"{exact(lag)} s", f"{exact(lag)}s", f"{exact(lag)} seconds"]),
                short("Using the speeds and the rule printed above the seismogram, how far from the seismometer is the "
                      "epicentre of the earthquake, in km?", exact(d), [exact(d), f"{exact(d)} km", f"{exact(d)}km"]),
                short(f"How many seconds after the earthquake did the {wave}-waves reach the seismometer?", exact(t),
                      [exact(t), f"{exact(t)} s", f"{exact(t)}s", f"{exact(t)} seconds"])]
    depths = dict(p["points"])
    speed = {L: math.isqrt(10 * d) for L, d in depths.items()}
    L = rng.choice(list(depths))
    (C, km), (a, b) = p["cross"], p["pair"]
    minutes = Fraction(km * 1000, speed[C] * 60)
    ratio = speed[a] // speed[b]
    return [short(f"{who} drew how a tsunami travels towards the coast {rng.choice(SETTINGS)}. Using the formula printed, "
                  f"what is the speed of the tsunami at point {L}, in m/s?", speed[L],
                  [str(speed[L]), f"{speed[L]} m/s", f"{speed[L]}m/s"]),
            short(f"The tsunami crosses {km} km of open ocean as deep as point {C}. How many minutes does this take?",
                  exact(minutes), [exact(minutes), f"{exact(minutes)} minutes", f"{exact(minutes)} min"]),
            short(f"How many times faster does the tsunami travel at point {a} than at point {b}?", ratio,
                  [str(ratio), f"{ratio} times", f"{ratio}x", f"{ratio} times faster"])]
