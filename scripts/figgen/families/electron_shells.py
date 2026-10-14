"""Electron shells (LS, UP): an atom of one of the first twenty elements, its nucleus marked with its number
of protons and its electrons drawn in shells, filling 2, 8, 8, 2. The electronic configuration ("2,8,1"),
the group and period, and at UP the charge on the ion it forms.

The element is not named: its configuration, group and period are read from the electrons drawn.
"""
from __future__ import annotations

import math
import random

from matplotlib.patches import Circle

from ..core import FILL_2, INK, NAMES, new_figure, short

ID = "electron_shells"
KIND = "chem.particle"
SUBJECT = "chemistry"
BANDS = ("LS", "UP")
CONCEPTS = tuple(f"chemistry.{c}" for c in ("electronic-configuration", "atomic-structure", "bohr-model", "periodic-table-structure"))
AVOID = r"organic|alkane|alcohol|electrolysis|equilibrium|rate|enthalpy|titration|benzene|chemical reactions|alloy|transition"


def shells(p: dict) -> list[int]:
    out, left = [], p["Z"]
    for cap in (2, 8, 8, 2):
        if left <= 0:
            break
        out.append(min(cap, left))
        left -= out[-1]
    return out


def group(p: dict) -> int:
    s = shells(p)
    return 8 if p["Z"] == 2 or s[-1] == 8 else s[-1]


def sample(rng: random.Random) -> dict:
    return {"band": rng.choice(BANDS), "Z": rng.randint(1, 20), "turn": rng.randint(0, 3)}


def draw(p: dict):
    fig, ax = new_figure(4.8, 4.8)
    ax.add_patch(Circle((0, 0), 0.45, facecolor=FILL_2, edgecolor=INK, linewidth=1.4, zorder=3))
    ax.text(0, 0, f"{p['Z']}p", ha="center", va="center", fontsize=12, fontweight="bold", zorder=4)
    for i, n in enumerate(shells(p)):
        R = 0.95 + 0.62 * i
        ax.add_patch(Circle((0, 0), R, facecolor="none", edgecolor=INK, linewidth=1.0))
        for j in range(n):
            # Pairs side by side, as textbooks draw them: two at a time round the shell.
            pairs = (n + 1) // 2
            k, side = divmod(j, 2)
            base = math.pi / 2 + p["turn"] * math.pi / 8 + 2 * math.pi * k / max(pairs, 1)
            a = base + (0.11 if side else -0.11) * (1 if n > 1 else 0)
            ax.plot([R * math.cos(a)], [R * math.sin(a)], marker="X", markersize=7, color=INK, zorder=4)
    top = 0.95 + 0.62 * (len(shells(p)) - 1) + 0.3
    ax.set_xlim(-top, top)
    ax.set_ylim(-top, top)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


SETTINGS = ["in a chemistry lesson", "on a revision card", "for homework", "at the science club", "for a class test"]


def questions(p: dict, rng: random.Random) -> list:
    name, friend = rng.sample(NAMES, 2)
    s = shells(p)
    conf = ",".join(map(str, s))
    forms = [conf, ".".join(map(str, s)), ", ".join(map(str, s)), " ".join(map(str, s)), "-".join(map(str, s))]
    g = group(p)
    qs = [short(f"{name} drew the electrons of an atom {rng.choice(SETTINGS)}. What is its electronic configuration?", conf, forms),
          short(f"{friend} wants to place this element in the periodic table. In which group is it?", g,
                [str(g), f"group {g}", f"Group {g}"] + (["0", "group 0", "VIII", "group VIII"] if g == 8 else [])),
          short("In which period of the periodic table is this element?", len(s), [str(len(s)), f"period {len(s)}", f"Period {len(s)}"])]
    charges = {1: "1+", 2: "2+", 3: "3+", 5: "3-", 6: "2-", 7: "1-"}
    if p["band"] == "UP" and g in charges and p["Z"] > 2:
        c = charges[g]
        sign = c[-1]
        qs.append(short("This atom forms an ion with a full outer shell. What is the charge on the ion?", c,
                        [c, f"{sign}{c[0]}", c.replace("1", "") if c[0] == "1" else c, f"{c[0]} {sign}", f"{sign}{c[0]} charge"]))
    return qs
