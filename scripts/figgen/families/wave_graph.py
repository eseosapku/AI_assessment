"""Wave graphs (UP, AL): a transverse wave drawn as displacement against distance (ripples in a
ripple tank, a wave on a rope, waves on Lake Kivu) or against time (a buoy on the lake, a point on a
guitar string). The amplitude, the wavelength or period, the frequency, and the speed by v = f λ.

The wavelength or period spans 8 or 12 gridlines, so the peaks, troughs and crossings all fall on
gridlines and read exactly.
"""
from __future__ import annotations

import math
import random
from fractions import Fraction

from ..core import GRID, INK, NAMES, exact, measure, new_figure, short

ID = "wave_graph"
KIND = "physics.wave"
SUBJECT = "physics"
BANDS = ("UP", "AL")  # the lower-secondary physics topics have no waves
CONCEPTS = tuple(f"physics.{c}" for c in ("wave-properties", "waves", "sound", "simple-harmonic-motion"))
# Not light's particle nature, the spectrum, signals, imaging or optics chapters.
AVOID = r"photoelectric|quantum|photon|electromagnetic spectrum|communication|medical imaging|environmental|signals|refraction of light|machines|particle nature"
# axis, x unit, y unit, gridline sizes, the range of the wavelength or period, the amplitudes (in y gridlines)
CONTEXTS = {
    "ripple tank": ("distance", "cm", "mm", ("0.25", "0.5", "1"), (2, 12), 1, (2, 3, 4, 5)),
    "rope": ("distance", "m", "cm", ("0.1", "0.25", "0.5"), (0.8, 6), 5, (1, 2, 3, 4)),
    "lake": ("distance", "m", "cm", ("0.5", "1"), (4, 12), 10, (1, 2, 3, 4)),
    "buoy": ("time", "s", "cm", ("0.25", "0.5"), (2, 4), 10, (1, 2, 3, 4)),
    "string": ("time", "ms", "mm", ("0.25", "0.5", "1", "2.5"), (2, 20), 1, (1, 2, 3, 4)),
}
FREQ = {"ripple tank": ("5", "10", "15", "20"), "rope": ("1", "2", "3", "4"), "lake": ("0.2", "0.25", "0.5")}
SPAN = 24  # gridlines across the graph


def _period_ok(context: str, L: Fraction) -> bool:
    if CONTEXTS[context][0] == "distance":
        return True
    seconds = L / 1000 if CONTEXTS[context][1] == "ms" else L
    return ((1 / seconds) * 100).denominator == 1  # the frequency exact to 2 d.p.


def sample(rng: random.Random) -> dict:
    band = rng.choice(BANDS)
    while True:
        context = rng.choice(list(CONTEXTS))
        axis, unit, yunit, cells, (lo, hi), ycell, amps = CONTEXTS[context]
        cell, n = rng.choice(cells), rng.choice([8, 12])
        L = Fraction(cell) * n
        if lo <= L <= hi and _period_ok(context, L):
            return {"band": band, "context": context, "axis": axis, "unit": unit, "yunit": yunit, "cell": cell, "cells": n,
                    "amp": rng.choice(amps) * ycell, "ycell": ycell, "phase": rng.choice([0, 1])}


def displacement(p: dict, x: float) -> float:
    L = float(Fraction(p["cell"]) * p["cells"])
    return p["amp"] * math.sin(2 * math.pi * x / L + p["phase"] * math.pi / 2)


def draw(p: dict):
    cell = Fraction(p["cell"])
    xs_grid = [cell * k for k in range(SPAN + 1)]
    fig, ax = new_figure(6.6, 4.0)
    every = 4 if p["cells"] == 8 else 3
    ax.set_xticks([float(x) for x in xs_grid[::every]])
    ax.set_xticklabels([exact(x) for x in xs_grid[::every]])
    ax.set_xticks([float(x) for x in xs_grid], minor=True)
    top = p["amp"] + p["ycell"]
    ys = list(range(-top, top + 1, p["ycell"]))
    ax.set_yticks(ys)
    ax.grid(True, which="both", color=GRID, linewidth=0.5)
    ax.set_axisbelow(True)
    end = float(cell * SPAN)
    ax.set_xlim(0, end)
    ax.set_ylim(-top, top)
    ax.plot([0, end], [0, 0], color=INK, linewidth=0.9)
    xs = [end * i / 1200 for i in range(1201)]
    ax.plot(xs, [displacement(p, x) for x in xs], color=INK, linewidth=1.8)
    ax.set_xlabel(f"{'Distance' if p['axis'] == 'distance' else 'Time'} ({p['unit']})")
    ax.set_ylabel(f"Displacement ({p['yunit']})")
    ax.tick_params(labelsize=8)
    return fig


SETTINGS = ["in the school laboratory", "at the science club", "for a class practical", "during a physics lesson", "for a science fair"]


def questions(p: dict, rng: random.Random) -> list:
    name = rng.choice(NAMES)
    L = Fraction(p["cell"]) * p["cells"]
    unit, yunit = p["unit"], p["yunit"]
    intro = {
        "ripple tank": f"{name} made ripples in a ripple tank {rng.choice(SETTINGS)}. The graph shows the water's surface at one moment.",
        "rope": f"{name} shook one end of a long rope {rng.choice(SETTINGS)}. The graph shows the rope at one moment.",
        "lake": f"{name} drew the waves on Lake Kivu {rng.choice(['from a photograph', 'from a boat', 'for a project', 'at Rubavu', 'at Karongi'])}. "
                "The graph shows the water's surface at one moment.",
        "buoy": f"{name} timed a buoy bobbing on Lake Kivu {rng.choice(['at Rubavu', 'at Karongi', 'at Rusizi', 'from a boat', 'for a project'])}. "
                "The graph shows its displacement over time.",
        "string": f"{name} plucked a guitar string {rng.choice(SETTINGS)}. The graph shows how one point on the string moves.",
    }[p["context"]]
    qs = [short(f"{intro} What is the amplitude of the wave?", p["amp"], measure(p["amp"], yunit))]
    if p["axis"] == "distance":
        f = Fraction(rng.choice(FREQ[p["context"]]))
        metres = L / 100 if unit == "cm" else L
        qs += [short("What is the wavelength?", exact(L), measure(L, unit)),
               short(f"The wave's frequency is {exact(f)} Hz. What is its speed, in m/s?", exact(f * metres), measure(f * metres, "m/s"))]
    else:
        seconds = L / 1000 if unit == "ms" else L
        lam = Fraction(rng.choice(["0.5", "0.6", "0.8", "1.2", "1.3"] if p["context"] == "string" else ["4", "5", "6", "8", "10"]))
        qs += [short("What is the period of the wave?", exact(L), measure(L, unit)),
               short("What is the frequency of the wave?", exact(1 / seconds), measure(1 / seconds, "Hz")),
               short(f"The wavelength is {exact(lam)} m. What is the speed of the wave, in m/s?", exact(lam / seconds),
                     measure(lam / seconds, "m/s"))]
    return qs
