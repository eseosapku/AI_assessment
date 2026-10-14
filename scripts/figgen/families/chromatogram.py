"""Chromatograms (LS, UP): paper on a 1 cm grid, the pencil baseline and the dashed solvent front, a mixture M
and three or four reference dyes spotted along the baseline. The mixture's spots match two or three dyes,
and sometimes one spot that matches none. The Rf value of a dye, which dyes M contains, how many substances
are in M, and at UP which dye travelled furthest.

Every spot sits on a gridline a whole number of cm above the baseline, each dye at its own height, so every
Rf is exact.
"""
from __future__ import annotations

import random
from decimal import ROUND_HALF_UP, Decimal
from fractions import Fraction

from matplotlib.patches import Ellipse, Rectangle

from ..core import GRID, INK, NAMES, exact, mcq, new_figure, short

ID = "chromatogram"
KIND = "chem.chromatogram"
SUBJECT = "chemistry"
BANDS = ("LS", "UP")
CONCEPTS = tuple(f"chemistry.{c}" for c in ("chromatography", "separation-techniques", "laboratory-techniques",
                                             "purity"))
AVOID = r"organic|alkane|electrolysis|isotope|periodic|bonding|enthalpy|rate|titration|gas-chromatograph"
WHAT = ["a black ink", "a food colouring", "a fruit drink colouring", "a felt-tip pen ink", "a sweet coating"]


def sample(rng: random.Random) -> dict:
    front = rng.choice([5, 8, 10])
    n = rng.choice([3, 4]) if front > 5 else 3
    letters = "ABCD"[:n]
    heights = rng.sample(range(1, front), n + 1)
    dyes = dict(zip(letters, heights[:n]))
    mix = sorted(rng.sample(letters, rng.choice([2, 3]) if n == 4 else 2))
    unknown = heights[n] if rng.random() < 0.4 else None
    return {"band": rng.choice(BANDS), "front": front, "dyes": dyes, "mixture": mix, "unknown": unknown,
            "what": rng.randrange(len(WHAT)), "m_first": rng.choice([True, False])}


def lanes(p: dict) -> list[str]:
    return (["M"] + list(p["dyes"])) if p["m_first"] else (list(p["dyes"]) + ["M"])


def draw(p: dict):
    names = lanes(p)
    width, top = len(names) + 1, p["front"] + 2
    fig, ax = new_figure(0.5 * width + 1.9, 0.5 * top + 0.4)
    ax.add_patch(Rectangle((0, 0), width, top, facecolor="#fbfaf6", edgecolor=INK, linewidth=1.2, zorder=0))
    for x in range(1, width):
        ax.plot([x, x], [0, top], color=GRID, linewidth=0.5, zorder=1)
    for y in range(1, top):
        ax.plot([0, width], [y, y], color=GRID, linewidth=0.5, zorder=1)
    ax.plot([0, width], [1, 1], color="#555555", linewidth=1.4, zorder=2)
    ax.plot([0, width], [1 + p["front"], 1 + p["front"]], color=INK, linewidth=1.4, linestyle=(0, (5, 3)), zorder=2)
    ax.text(width + 0.2, 1, "baseline", ha="left", va="center", fontsize=9)
    ax.text(width + 0.2, 1 + p["front"], "solvent front", ha="left", va="center", fontsize=9)
    for i, name in enumerate(names):
        x = i + 1
        ax.text(x, 0.45, name, ha="center", va="center", fontsize=11, fontweight="bold")
        spots = [p["dyes"][name]] if name != "M" else [p["dyes"][d] for d in p["mixture"]] + ([p["unknown"]] if p["unknown"] else [])
        for h in spots:
            ax.add_patch(Ellipse((x, 1 + h), 0.5, 0.36, facecolor="#4a4a4a", edgecolor=INK, linewidth=0.8, zorder=3))
    ax.set_xlim(-0.1, width + 2.1)
    ax.set_ylim(-0.1, top + 0.1)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


SETTINGS = ["in a chemistry lesson", "in the school laboratory", "for a class practical", "at the science club"]


def _rf(f: Fraction) -> list[str]:
    forms = [exact(f), f"{f.numerator}/{f.denominator}"]
    two = format(Decimal(f.numerator) / Decimal(f.denominator), "f")
    rounded = str(Decimal(two).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))
    if rounded not in forms and rounded.rstrip("0") != forms[0]:
        forms.append(rounded)
    return forms


def _letters(mix: list[str]) -> list[str]:
    joined = " and ".join([", ".join(mix[:-1]), mix[-1]]) if len(mix) > 1 else mix[0]
    return [joined, ", ".join(mix), "".join(mix), " and ".join(mix), " ".join(mix), "&".join(mix), " & ".join(mix),
            " and ".join(reversed(mix)), ", ".join(reversed(mix))]


def questions(p: dict, rng: random.Random) -> list:
    who, friend = rng.sample(NAMES, 2)
    dyes = list(p["dyes"])
    x = rng.choice(dyes)
    rf = Fraction(p["dyes"][x], p["front"])
    count = len(p["mixture"]) + (p["unknown"] is not None)
    shown = ", ".join(dyes[:-1]) + " and " + dyes[-1]
    qs = [short(f"{who} ran a chromatogram of {WHAT[p['what']]}, M, beside dyes {shown} {rng.choice(SETTINGS)}. "
                f"What is the Rf value of dye {x}?", exact(rf), _rf(rf)),
          short("Which dyes does M contain?", _letters(p["mixture"])[0], _letters(p["mixture"])),
          short(f"{friend} counts the spots. How many different substances are in M?", count, [str(count), f"{count} substances"])]
    if p["band"] == "UP":
        best = max(dyes, key=lambda d: p["dyes"][d])
        qs.append(mcq(f"Which of the dyes {shown} is the most soluble in the solvent, so travelled furthest?", best,
                      [d for d in dyes if d != best], rng))
    return qs
