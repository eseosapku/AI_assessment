"""Osmosis graphs (UP, AL): the percentage change in mass of potato pieces left in sucrose solutions from 0 to
1.0 mol/dm³, the points joined by ruled lines, crossing zero where the solution matches the cells. The
concentration with no change in mass, the change in a given solution, whether a piece gains or loses mass
and why, and at AL the solution whose water potential equals the cells'.

Every point lies on a gridline, and the graph falls through zero once: pieces gain mass in weaker
solutions and lose it in stronger ones.
"""
from __future__ import annotations

import random

from ..core import GRID, INK, NAMES, mcq, new_figure, short

ID = "osmosis_graph"
KIND = "graph.line"
SUBJECT = "biology"
BANDS = ("UP", "AL")
CONCEPTS = tuple(f"biology.{c}" for c in ("osmosis", "cell-membranes-transport", "plasma-membrane-gradients"))
AVOID = r"enzyme|genetic|inherit|immun|disease|reproduc|ecolog|population|photosynth|respiration|digest"
TISSUES = ["potato", "carrot", "sweet potato", "beetroot"]


def sample(rng: random.Random) -> dict:
    zero = rng.choice([2, 3, 4])  # tenths of a mol/dm³
    slope = rng.choice([5, 10]) if zero <= 3 else 5  # % per 0.1 mol/dm³: every point a whole 5%
    cs = sorted({0, 2, 4, 6, 8, 10, zero})
    pts = [[c, -slope * (c - zero)] for c in cs if c <= 6]
    pts.append([8, pts[-1][1] - 5])  # levelling off as the cells lose what water they can
    pts.append([10, pts[-1][1] - 5 * rng.choice([0, 1])])
    others = [c for c, _ in pts if c != zero]
    return {"band": rng.choice(BANDS), "zero": zero, "points": pts, "tissue": rng.choice(TISSUES),
            "ask": rng.choice(others), "why": rng.choice(others)}


def draw(p: dict):
    fig, ax = new_figure(6.4, 4.6)
    vals = [v for _, v in p["points"]]
    lo, hi = 5 * (min(vals) // 5) - 5, 5 * -(-max(vals) // 5) + 5
    ax.set_xticks([c / 10 for c in range(0, 11, 2)])
    ax.set_xticks([c / 10 for c in range(0, 11)], minor=True)
    ax.set_yticks(range(lo, hi + 1, 5))
    ax.grid(True, which="both", color=GRID, linewidth=0.5)
    ax.set_axisbelow(True)
    ax.set_xlim(0, 1.0)
    ax.set_ylim(lo, hi)
    ax.axhline(0, color=INK, linewidth=0.9)
    xs, ys = [c / 10 for c, _ in p["points"]], vals
    ax.plot(xs, ys, color=INK, linewidth=1.6, marker="x", markersize=7, markeredgewidth=1.6)
    ax.set_xlabel("Concentration of sucrose solution (mol/dm³)")
    ax.set_ylabel("Change in mass (%)")
    ax.tick_params(labelsize=8)
    return fig


SETTINGS = ["in a biology practical", "in the school laboratory", "for a class practical", "at the science club"]
WHY = [f"{a}: water moves {b} the cells by osmosis" for a in ("gains mass", "loses mass") for b in ("into", "out of")]


def _pct(v: int) -> list[str]:
    forms = [str(v), f"{v}%", f"{v} %"]
    if v > 0:
        forms += [f"+{v}", f"+{v}%", f"a gain of {v}%", f"{v}% increase", f"increase of {v}%"]
    elif v < 0:
        forms += [f"−{-v}", f"−{-v}%", f"a loss of {-v}%", f"{-v}% decrease", f"decrease of {-v}%"]
    return forms


def questions(p: dict, rng: random.Random) -> list:
    who, friend = rng.sample(NAMES, 2)
    zero = p["zero"]
    at = dict((c, v) for c, v in p["points"])
    z = f"0.{zero}"
    c, w = p["ask"], p["why"]
    cs, ws = (f"{c / 10:g}" if c < 10 else "1.0"), (f"{w / 10:g}" if w < 10 else "1.0")
    qs = [short(f"{who} left pieces of {p['tissue']} in sucrose solutions {rng.choice(SETTINGS)} and found the change in mass. "
                "At what sucrose concentration is there no change in mass?", z, [z, f"{z}0", f"{z} mol/dm³", f"{z} M", f"{z} mol/L"]),
          short(f"What was the percentage change in mass of the {p['tissue']} pieces in {cs} mol/dm³ sucrose?", at[c], _pct(at[c])),
          mcq(f"{friend} left a {p['tissue']} piece in {ws} mol/dm³ sucrose. Did it gain or lose mass, and why?",
              WHY[0 if w < zero else 3], [x for x in WHY if x != WHY[0 if w < zero else 3]], rng)]
    if p["band"] == "AL":
        qs.append(short(f"The water potential of the {p['tissue']} cells equals that of which sucrose solution, in mol/dm³?", z,
                        [z, f"{z}0", f"{z} mol/dm³"]))
    return qs
