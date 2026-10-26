"""The mitotic cell cycle (AL).

Two sub-types:
- field: a field of view of a stained root tip squash, 40 or 50 brick-shaped cells in rows, each drawn as interphase
  (a round nucleus with a nucleolus), prophase (a nucleus of coiled threads), metaphase (chromosomes in a line across
  the middle), anaphase (two groups at the ends) or telophase (two small nuclei and a new wall forming), with a key
  drawing each stage. The mitotic index formula and the length of the cell cycle are printed. How many cells are in
  mitosis (counted); the mitotic index (a terminating decimal); the most common stage of mitosis (one tallest count);
  the time in minutes each cycle spends in mitosis (mitotic index x cycle length, printed; a whole number).
- dna: the mass of DNA in a cell over two cell cycles, on a grid: steady through G1, doubling steadily through S,
  steady through G2 and mitosis, halving when the cell divides; every change on a gridline. How long S lasted; the
  length of one cycle; the DNA mass just before division; when replication began in the second cycle.
"""
from __future__ import annotations

import random

from matplotlib.patches import Circle, Ellipse, Rectangle

from ..core import FILL_2, GRID, INK, NAMES, count, mcq, new_figure, short

ID = "mitotic_index"
KIND = "bio.genetics"
SUBJECT = "biology"
BANDS = ("AL",)
CONCEPTS = tuple(f"biology.{c}" for c in ("cell-division", "chromosomes"))
# A topic whose sections the book lists is reached only if one names mitosis or the cell cycle.
NEEDS = r"mitosis|mitotic|cell cycle"
AVOID = (r"sexual|contracept|pregnan|\bstis?\b|\bhiv\b|social factors|glossary|science in context|reproduction system|"
         r"inherited change|nucleic|meiosis|genetics|gene technology|genetic technology")

STAGE = {"P": "prophase", "M": "metaphase", "A": "anaphase", "T": "telophase"}
STAGES = ["prophase", "metaphase", "anaphase", "telophase"]
LAYOUTS = [(5, 8), (4, 10), (5, 10)]


def _field(rng: random.Random) -> dict:
    rows, cols = rng.choice(LAYOUTS)
    total = rows * cols
    while True:
        k = rng.randint(5, 14)
        split = [rng.randint(0, k) for _ in range(3)]
        cuts = sorted(split)
        counts = [cuts[0], cuts[1] - cuts[0], cuts[2] - cuts[1], k - cuts[2]]
        if counts.count(max(counts)) == 1:
            break
    hours = 20 if total == 50 else rng.choice([16, 20, 24])
    stages = ["I"] * (total - k) + [s for s, n in zip("PMAT", counts) for _ in range(n)]
    rng.shuffle(stages)
    return {"band": "AL", "kind": "field", "rows": rows, "cols": cols, "stages": stages, "cycle_hours": hours}


def _dna(rng: random.Random) -> dict:
    return {"band": "AL", "kind": "dna", "g1": rng.randint(4, 9), "s": rng.randint(3, 7), "g2m": rng.randint(2, 5),
            "x": rng.randint(2, 6)}


def sample(rng: random.Random) -> dict:
    return _field(rng) if rng.random() < 0.6 else _dna(rng)


# --- drawing ------------------------------------------------------------------------------------------------------

CW, CH = 1.0, 0.72


def _cell(ax, x: float, y: float, stage: str, gid: str):
    """One cell with its lower left corner at (x, y), drawn as the stage it is in."""
    ax.add_patch(Rectangle((x, y), CW, CH, facecolor="white", edgecolor=INK, linewidth=1.0, gid=gid))
    cx, cy = x + CW / 2, y + CH / 2
    if stage == "I":
        ax.add_patch(Circle((cx, cy), 0.17, facecolor=FILL_2, edgecolor=INK, linewidth=0.9))
        ax.add_patch(Circle((cx + 0.04, cy + 0.03), 0.045, facecolor=INK, edgecolor=INK))
    elif stage == "P":
        ax.add_patch(Circle((cx, cy), 0.19, facecolor="white", edgecolor=INK, linewidth=0.9, linestyle=(0, (2, 1.5))))
        for dx, dy, w, h, a in ((-0.07, 0.06, 0.16, 0.05, 30), (0.06, -0.05, 0.17, 0.05, -40),
                                (0.05, 0.08, 0.13, 0.05, 80), (-0.06, -0.07, 0.14, 0.05, -10)):
            ax.add_patch(Ellipse((cx + dx, cy + dy), w, h, angle=a, facecolor=INK, edgecolor=INK))
    elif stage == "M":
        for k in range(4):
            ax.add_patch(Ellipse((cx, cy - 0.21 + 0.14 * k), 0.16, 0.06, facecolor=INK, edgecolor=INK))
    elif stage == "A":
        for side in (-1, 1):
            for k in range(4):
                ax.add_patch(Ellipse((cx + side * 0.3, cy - 0.17 + 0.115 * k), 0.12, 0.05, facecolor=INK,
                                     edgecolor=INK))
    else:
        for side in (-1, 1):
            ax.add_patch(Circle((cx + side * 0.28, cy), 0.11, facecolor=FILL_2, edgecolor=INK, linewidth=0.9))
        ax.add_patch(Rectangle((cx - 0.01, y + 0.05), 0.02, CH - 0.1, facecolor=INK, edgecolor="none", alpha=0.6))


def _draw_field(p: dict):
    rows, cols = p["rows"], p["cols"]
    fig, ax = new_figure()
    top = rows * CH
    for i, st in enumerate(p["stages"]):
        r, c = i // cols, i % cols
        _cell(ax, c * CW, top - (r + 1) * CH, st, f"cell:{i}:{st}")
    ax.text(0, top + 0.35, "Cells in a root tip squash, seen through a light microscope", ha="left", va="center",
            fontsize=10.5, fontweight="bold")
    # the key: one cell of each stage, named
    ky = -1.25
    ax.text(0, ky + CH + 0.25, "Key", ha="left", va="center", fontsize=10, fontweight="bold")
    names = ["interphase", *STAGES]
    gap = (cols * CW - 5 * CW) / 4
    for k, (code, name) in enumerate(zip("IPMAT", names)):
        x = k * (CW + gap)
        _cell(ax, x, ky, code, f"key:{code}")
        ax.text(x + CW / 2, ky - 0.15, name, ha="center", va="top", fontsize=9)
    ly = ky - 0.75
    for j, line in enumerate(["Mitotic index = number of cells in mitosis ÷ total number of cells",
                              "(cells in interphase are not in mitosis)",
                              f"One cell cycle of these cells lasts {p['cycle_hours']} hours.",
                              "Time in mitosis = mitotic index × length of the cell cycle"]):
        ax.text(0, ly - 0.42 * j, line, ha="left", va="top", fontsize=9.5)
    bottom = ly - 0.42 * 3 - 0.45
    ax.set_xlim(-0.1, cols * CW + 0.1)
    ax.set_ylim(bottom, top + 0.6)
    ax.set_aspect("equal")
    ax.axis("off")
    w = cols * CW + 0.2
    fig.set_size_inches(0.82 * max(w, 8.4), 0.82 * (top + 0.6 - bottom))
    if w < 8.4:
        ax.set_xlim(-0.1, 8.3)
    ax.set_position([0, 0, 1, 1])
    return fig


def _draw_dna(p: dict):
    g1, s, g2m, x = p["g1"], p["s"], p["g2m"], p["x"]
    cyc = g1 + s + g2m
    end = 2 * cyc + 2
    ts, ys = [], []
    for k in range(2):
        t0 = k * cyc
        ts += [t0, t0 + g1, t0 + g1 + s, t0 + cyc, t0 + cyc]
        ys += [x, x, 2 * x, 2 * x, x]
    ts.append(end)
    ys.append(x)
    fig, ax = new_figure(7.2, 4.0)
    ax.plot(ts, ys, color=INK, linewidth=1.8)
    ax.set_xticks(range(0, end + 1, 2))
    ax.set_xticks(range(0, end + 1), minor=True)
    ax.set_yticks(range(0, 2 * x + 3))
    ax.set_xlim(0, end)
    ax.set_ylim(0, 2 * x + 2)
    ax.grid(True, which="both", color=GRID, linewidth=0.6)
    ax.set_axisbelow(True)
    ax.tick_params(labelsize=9)
    ax.set_xlabel("Time (hours)", fontsize=10)
    ax.set_ylabel("Mass of DNA per cell (arbitrary units)", fontsize=10)
    ax.set_title("DNA in one cell and its daughter cells over two cell cycles", fontsize=10.5)
    return fig


def draw(p: dict):
    return _draw_field(p) if p["kind"] == "field" else _draw_dna(p)


# --- questions ----------------------------------------------------------------------------------------------------

SETTINGS = ["in a practical lesson", "for revision", "for a class test", "in the school laboratory in Muhanga",
            "for homework", "while revising for AS Level"]


def _num(v: float) -> str:
    return f"{v:.6f}".rstrip("0").rstrip(".")


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    if p["kind"] == "field":
        st = p["stages"]
        total = len(st)
        k = sum(1 for x in st if x != "I")
        mi = _num(k / total)
        counts = {c: st.count(c) for c in "PMAT"}
        top = STAGE[max(counts, key=counts.get)]
        minutes = k * p["cycle_hours"] * 60 // total
        pct = _num(100 * k / total)
        return [count(f"{who} counts the cells in this field of view {rng.choice(SETTINGS)}. How many of the cells are "
                      f"in mitosis?", k, "cells"),
                short("What is the mitotic index of this field of view, as a decimal?", mi,
                      [f"{k}/{total}", f"{pct}%"]),
                mcq("Which stage of mitosis has the most cells in this field of view?", top,
                    [s_ for s_ in STAGES if s_ != top], rng),
                short("Estimate how many minutes of each cell cycle these cells spend in mitosis.", minutes,
                      [f"{minutes} minutes", f"{minutes} min", f"{minutes} mins"])]
    g1, s, g2m, x = p["g1"], p["s"], p["g2m"], p["x"]
    cyc = g1 + s + g2m
    return [short(f"{who} reads this graph {rng.choice(SETTINGS)}. For how many hours did the cell copy its DNA (the "
                  f"S phase) in one cycle?", s, [f"{s} hours", f"{s} h"]),
            short("How long does one cell cycle last, in hours?", cyc, [f"{cyc} hours", f"{cyc} h"]),
            short("What is the mass of DNA in a cell just before it divides, in arbitrary units?", 2 * x,
                  [f"{2 * x} units", f"{2 * x} arbitrary units"]),
            short("At what time, in hours, did the cell begin to copy its DNA in the second cell cycle?", cyc + g1,
                  [f"{cyc + g1} hours", f"{cyc + g1} h"])]
