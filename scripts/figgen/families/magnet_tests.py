"""Testing and making magnets (LS), for Rwanda S1 "Magnetism" and S2 "Magnetization and Demagnetization". Three kinds:

- test: the N pole of a bar magnet brought near each end of three bars A, B and C, the results in a table (attracts,
  repels, no effect); "only a magnet can repel a magnet" printed. One bar is a magnet, one a magnetic material, one
  non-magnetic. Asks which bar is a magnet, which is magnetic but not a magnet, which end of the magnet is its N pole.
- domains: three steel bars X, Y and Z with their domains drawn as arrows (all one way, every way, or most one way);
  "in a magnetised bar the domains all point the same way; the arrows point towards the N pole" printed. Asks which
  bar is magnetised, how many of a bar's domains point to the right, which end of the magnetised bar is its N pole.
- stroking: a steel bar PQ stroked again and again from P to Q by one pole of a magnet. Asks which pole forms at Q (the
  end where each stroke finishes gets the opposite pole) and at P.
"""
from __future__ import annotations

import random

from matplotlib.patches import FancyArrowPatch, Rectangle

from ..core import INK, NAMES, count, mcq, new_figure, short
from ._bio_parts import letter_choice

ID = "magnet_tests"
KIND = "physics.field"
SUBJECT = "physics"
BANDS = ("LS",)
CONCEPTS = tuple(f"physics.{c}" for c in ("magnetism", "magnetization-and-demagnetization"))
ALSO = ("science.magnetism",)
# A topic whose sections the book lists is reached only if one names magnets or magnetism.
NEEDS = r"magnet"
AVOID = (r"glossary|electromagnet|motor|induction|generator|transformer|electric field|magnetic effect of|current|"
         r"electricity|earth's magnetism|compass|^physics$")

RESULTS = {"magnet": None, "magnetic": ("attracts", "attracts"), "non-magnetic": ("no effect", "no effect")}
LETTER_SETS = ["ABC", "PQR", "KLM"]


def sample(rng: random.Random) -> dict:
    kind = rng.choice(["test", "domains", "stroking"])
    if kind == "test":
        letters = list(rng.choice(LETTER_SETS))
        kinds = ["magnet", "magnetic", "non-magnetic"]
        rng.shuffle(kinds)
        north = rng.choice([1, 2])  # the magnet's end that repels the N pole is its own N pole
        return {"band": "LS", "kind": kind, "bars": [[L, k] for L, k in zip(letters, kinds)], "north": north}
    if kind == "domains":
        letters = list(rng.choice(["XYZ", "DEF", "STU"]))
        roles = ["magnetised", "unmagnetised", "partly"]
        rng.shuffle(roles)
        way = rng.choice(["right", "left"])
        bars = []
        for L, role in zip(letters, roles):
            if role == "magnetised":
                arrows = [way] * 8
            elif role == "unmagnetised":
                while True:
                    arrows = [rng.choice(["right", "left", "up", "down"]) for _ in range(8)]
                    if max(arrows.count(d) for d in set(arrows)) <= 3:
                        break
            else:
                arrows = [way] * rng.randint(5, 6) + [rng.choice(["left" if way == "right" else "right", "up", "down"])
                                                      for _ in range(2)]
                arrows = arrows[:8]
                while len(arrows) < 8:
                    arrows.append(rng.choice(["up", "down"]))
                rng.shuffle(arrows)
            bars.append([L, role, arrows])
        return {"band": "LS", "kind": kind, "bars": bars, "count": rng.choice(letters)}
    return {"band": "LS", "kind": kind, "pole": rng.choice("NS"), "strokes": rng.choice([10, 15, 20, 30])}


# --- drawing --------------------------------------------------------------------------------------------------------

def _draw_test(p: dict):
    fig, ax = new_figure(7.2, 5.0)
    ax.add_patch(Rectangle((0.2, 4.1), 1.2, 0.6, facecolor="#d6dade", edgecolor=INK, linewidth=1.2))
    ax.add_patch(Rectangle((1.4, 4.1), 1.2, 0.6, facecolor="white", edgecolor=INK, linewidth=1.2))
    ax.text(0.8, 4.4, "S", ha="center", va="center", fontsize=13, fontweight="bold")
    ax.text(2.0, 4.4, "N", ha="center", va="center", fontsize=13, fontweight="bold")
    ax.text(3.0, 4.4, "The N pole of this magnet was brought near each end of three bars.", ha="left", va="center",
            fontsize=10)
    for k, (L, _) in enumerate(p["bars"]):
        x = 0.4 + 2.5 * k
        ax.add_patch(Rectangle((x, 3.0), 1.9, 0.45, facecolor="#eeeeee", edgecolor=INK, linewidth=1.0))
        ax.text(x + 0.95, 3.225, f"bar {L}", ha="center", va="center", fontsize=11, fontweight="bold")
        ax.text(x + 0.05, 2.75, "end 1", ha="left", va="center", fontsize=9)
        ax.text(x + 1.85, 2.75, "end 2", ha="right", va="center", fontsize=9)
    rows = [("Bar", "end 1", "end 2")]
    for L, kind in p["bars"]:
        if kind == "magnet":
            res = ("repels", "attracts") if p["north"] == 1 else ("attracts", "repels")
        else:
            res = RESULTS[kind]
        rows.append((f"bar {L}", *res))
    for r, row in enumerate(rows):
        y = 2.05 - 0.45 * r
        for c, text in enumerate(row):
            ax.text(1.0 + 2.4 * c, y, text, ha="center", va="center", fontsize=10.5, fontweight="bold" if r == 0 else "normal")
    ax.plot([0.2, 7.6], [1.82, 1.82], color=INK, linewidth=0.9)
    ax.text(0.2, 0.0, "Only a magnet can repel a magnet.", ha="left", va="center", fontsize=10.5, style="italic")
    ax.set_xlim(0, 7.8)
    ax.set_ylim(-0.3, 4.9)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


ARROW = {"right": (1, 0), "left": (-1, 0), "up": (0, 1), "down": (0, -1)}


def _draw_domains(p: dict):
    fig, ax = new_figure(6.8, 5.4)
    for k, (L, _, arrows) in enumerate(p["bars"]):
        y = 3.95 - 1.55 * k
        ax.add_patch(Rectangle((0.8, y), 4.8, 1.1, facecolor="#f2f3f4", edgecolor=INK, linewidth=1.3))
        for i in range(1, 4):
            ax.plot([0.8 + 1.2 * i, 0.8 + 1.2 * i], [y, y + 1.1], color="#888888", linewidth=0.7)
        ax.plot([0.8, 5.6], [y + 0.55, y + 0.55], color="#888888", linewidth=0.7)
        for j, d in enumerate(arrows):
            cx, cy = 1.4 + 1.2 * (j % 4), y + 0.825 - 0.55 * (j // 4)
            dx, dy = ARROW[d]
            ax.add_patch(FancyArrowPatch((cx - 0.3 * dx, cy - 0.17 * dy), (cx + 0.3 * dx, cy + 0.17 * dy), arrowstyle="-|>",
                                         mutation_scale=11, color=INK, linewidth=1.3))
        ax.text(0.45, y + 0.55, L, ha="center", va="center", fontsize=13, fontweight="bold")
    ax.text(0.2, 5.5, "Domains in three steel bars (seen from above)", ha="left", va="center", fontsize=10.5)
    ax.text(0.2, 0.2, "In a magnetised bar the domains all point the same way.\nEach arrow points towards the N pole.",
            ha="left", va="center", fontsize=10, style="italic")
    ax.set_xlim(0, 6.2)
    ax.set_ylim(-0.25, 5.75)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def _draw_stroking(p: dict):
    fig, ax = new_figure(6.6, 4.4)
    ax.add_patch(Rectangle((0.6, 0.6), 4.8, 0.5, facecolor="#e7e9eb", edgecolor=INK, linewidth=1.3))
    ax.text(0.35, 0.85, "P", ha="center", va="center", fontsize=13, fontweight="bold")
    ax.text(5.65, 0.85, "Q", ha="center", va="center", fontsize=13, fontweight="bold")
    ax.text(3.0, 0.3, "steel bar", ha="center", va="center", fontsize=10)
    # the magnet, upright, its stroking pole at the bottom touching the bar
    other = "S" if p["pole"] == "N" else "N"
    ax.add_patch(Rectangle((1.0, 1.1), 0.5, 0.8, facecolor="#d6dade", edgecolor=INK, linewidth=1.1))
    ax.add_patch(Rectangle((1.0, 1.9), 0.5, 0.8, facecolor="white", edgecolor=INK, linewidth=1.1))
    ax.text(1.25, 1.5, p["pole"], ha="center", va="center", fontsize=12, fontweight="bold")
    ax.text(1.25, 2.3, other, ha="center", va="center", fontsize=12, fontweight="bold")
    # along the bar from P to Q, then lifted high and back to P
    ax.add_patch(FancyArrowPatch((1.7, 1.25), (5.1, 1.25), arrowstyle="-|>", mutation_scale=16, color=INK, linewidth=1.5))
    ax.add_patch(FancyArrowPatch((5.1, 1.5), (1.7, 2.9), connectionstyle="arc3,rad=0.35", arrowstyle="-|>", mutation_scale=14,
                                 color="#666666", linewidth=1.2, linestyle=(0, (4, 3))))
    ax.text(3.4, 3.35, f"stroked from P to Q {p['strokes']} times, lifted clear each time", ha="center", va="center",
            fontsize=10)
    ax.set_xlim(0, 6.0)
    ax.set_ylim(0.0, 3.7)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def draw(p: dict):
    return {"test": _draw_test, "domains": _draw_domains, "stroking": _draw_stroking}[p["kind"]](p)


# --- questions ------------------------------------------------------------------------------------------------------

SETTINGS = ["in a Senior 1 physics lesson", "at the science club in Huye", "for homework", "while revising in Musanze",
            "for a class test in Kigali", "in a practical lesson in Rubavu"]
POLES = ["a north pole", "a south pole", "no pole"]


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    setting = rng.choice(SETTINGS)
    if p["kind"] == "test":
        bars = {kind: L for L, kind in p["bars"]}
        letters = sorted(bars.values())
        L = bars["magnet"]
        end = f"end {p['north']}"
        return [letter_choice(f"{who} tested three bars with a magnet {setting}. Which bar is a magnet?", L, letters),
                letter_choice("Which bar is made of a magnetic material but is not a magnet?", bars["magnetic"], letters),
                short(f"Which end of bar {L} is its north pole, end 1 or end 2?", end, [end, str(p["north"]), f"end{p['north']}"])]
    if p["kind"] == "domains":
        bars = {L: (role, arrows) for L, role, arrows in p["bars"]}
        letters = sorted(bars)
        mag = next(L for L, (role, _) in bars.items() if role == "magnetised")
        way = bars[mag][1][0]
        L = p["count"]
        right = bars[L][1].count("right")
        return [letter_choice(f"{who} drew the domains in three steel bars {setting}. Which bar is magnetised?", mag, letters),
                count(f"How many of the domains in bar {L} point to the right?", right, "domains"),
                mcq(f"Which end of bar {mag} is its north pole?", f"the {way} end",
                    ["the left end", "the right end", "neither end"], rng)]
    at_q = "a south pole" if p["pole"] == "N" else "a north pole"
    at_p = "a north pole" if p["pole"] == "N" else "a south pole"
    return [mcq(f"{who} stroked a steel bar with a magnet {setting}, as shown. Each stroke ends at Q. Which pole forms at "
                f"end Q of the steel bar?", at_q, POLES, rng),
            mcq("Which pole forms at end P of the steel bar?", at_p, POLES, rng)]
