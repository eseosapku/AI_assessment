"""Cell division (LS, UP): a parent cell with 2n = 4 or 6 chromosomes, drawn as homologous pairs (the two of a pair
the same length, one dark and one light, the pairs different lengths), and the daughter cells it makes: two cells
each with all 2n after mitosis, or four cells each with one chromosome of every pair (n) after meiosis. Meiosis is
drawn as it happens without crossing over: the first division parts each pair, the second copies each set, so the
four cells are two of one mix and two of the other. The arrangement (beside or below), the pair lengths, and the
order the chromosomes lie in vary; in about a third of the figures the daughter cells are drawn empty, marked "?".

How many chromosomes are in each daughter cell (counted, or worked out when not drawn); which division it is, decided
by the cells drawn; how the daughter cells compare with the parent; the diploid or haploid number.
"""
from __future__ import annotations

import math
import random

from matplotlib.patches import Circle

from ..core import INK, NAMES, count, mcq, new_figure, short

ID = "cell_division"
KIND = "bio.genetics"
SUBJECT = "biology"
BANDS = ("LS", "UP")
CONCEPTS = tuple(f"biology.{c}" for c in ("cell-division", "chromosomes"))
# A topic whose sections the book lists is reached only if one names mitosis, meiosis or cell division.
NEEDS = r"mitosis|meiosis|cell division|nuclear division|haploid|diploid"

LENGTHS = [0.95, 0.68, 0.42]  # a third apart at least, so the pairs read as three sizes
SCALE = 0.62  # inches a unit
COMPARE = {(s, g): f"{s} number of chromosomes, genetically {g}" for s in ("same", "half the") for g in ("identical", "different")}


def sample(rng: random.Random) -> dict:
    n = rng.choice([2, 3])
    pairs = sorted(rng.sample(LENGTHS, n), reverse=True)
    parent = [[i, sh] for i in range(n) for sh in (0, 1)]
    rng.shuffle(parent)
    division = rng.choice(["mitosis", "meiosis"])
    if division == "mitosis":
        daughters = [parent, parent]
    else:
        # Meiosis I parts each pair at random; meiosis II copies each half: two cells of one mix, two of the other.
        mix = [rng.randint(0, 1) for _ in range(n)]
        one = [[i, mix[i]] for i in range(n)]
        other = [[i, 1 - mix[i]] for i in range(n)]
        daughters = [one, one, other, other] if rng.random() < 0.5 else [one, other, one, other]
    return {"band": rng.choice(BANDS), "division": division, "pairs": pairs, "parent": parent, "daughters": daughters,
            "show": rng.random() < 0.65, "layout": rng.choice(["side", "below"]), "ask": rng.choice(["diploid", "haploid"])}


def _places(p: dict) -> tuple:
    """The parent's centre and radius, the daughters' centres and radius, and the drawing's limits."""
    k = len(p["daughters"])
    if p["layout"] == "side":
        parent = (1.6, 2.2, 1.3)
        if k == 2:
            kids, r = [(6.0, 3.35), (6.0, 1.05)], 0.98
        else:  # one column, so no arrow passes another daughter on its way
            kids, r = [(6.0, 4.75), (6.0, 3.05), (6.0, 1.35), (6.0, -0.35)], 0.8
        return parent, kids, r
    parent = (4.2, 4.0, 1.3)
    if k == 2:
        kids, r = [(2.7, 0.9), (5.7, 0.9)], 0.98
    else:
        kids, r = [(1.05, 0.9), (3.15, 0.9), (5.25, 0.9), (7.35, 0.9)], 0.88
    return parent, kids, r


def _chromosomes(ax, cell: str, cx: float, cy: float, rods: list, lengths: list, gap: float) -> None:
    for k, (i, sh) in enumerate(rods):
        x = cx + (k - (len(rods) - 1) / 2) * gap
        half = lengths[i] / 2
        ax.plot([x, x], [cy - half, cy + half], color=INK, linewidth=7, solid_capstyle="round", zorder=3,
                gid=f"chrom:{cell}:{i}:{sh}")
        if sh:  # the light one of a pair: an outlined rod
            ax.plot([x, x], [cy - half, cy + half], color="white", linewidth=4.2, solid_capstyle="round", zorder=4)


def draw(p: dict):
    (px, py, pr), kids, r = _places(p)
    fig, ax = new_figure()
    ax.add_patch(Circle((px, py), pr, facecolor="white", edgecolor=INK, linewidth=1.6, gid="cell:P"))
    _chromosomes(ax, "P", px, py, p["parent"], p["pairs"], 0.34 if len(p["parent"]) == 6 else 0.4)
    first = [i for i, _ in p["parent"]]
    for k, ((x, y), rods) in enumerate(zip(kids, p["daughters"])):
        ax.add_patch(Circle((x, y), r, facecolor="white", edgecolor=INK, linewidth=1.6, gid=f"cell:D{k}"))
        if p["show"]:
            ordered = sorted(rods, key=lambda c: first.index(c[0])) if len(rods) < len(p["parent"]) else rods
            _chromosomes(ax, f"D{k}", x, y, ordered, p["pairs"], 0.25 if len(rods) == 6 else 0.32)
        else:
            ax.text(x, y, "?", ha="center", va="center", fontsize=18, fontweight="bold")
        # An arrow from the parent's edge to the daughter's.
        d = math.hypot(x - px, y - py)
        ux, uy = (x - px) / d, (y - py) / d
        ax.annotate("", xy=(x - ux * (r + 0.08), y - uy * (r + 0.08)), xytext=(px + ux * (pr + 0.08), py + uy * (pr + 0.08)),
                    arrowprops={"arrowstyle": "-|>", "color": INK, "linewidth": 1.4, "mutation_scale": 14,
                                "shrinkA": 0, "shrinkB": 0})
    xs = [x for x, _ in kids]
    ys = [y for _, y in kids]
    if p["layout"] == "side":
        ax.text(px, py - pr - 0.3, "parent cell", ha="center", va="top", fontsize=10.5)
        ax.text(sum(xs) / len(xs), min(ys) - r - 0.3, "daughter cells", ha="center", va="top", fontsize=10.5)
        xlim, ylim = (0.0, max(xs) + r + 0.3), (min(ys) - r - 0.8, max(py + pr, max(ys) + r) + 0.2)
    else:
        ax.text(px + pr + 0.3, py, "parent cell", ha="left", va="center", fontsize=10.5)
        ax.text(sum(xs) / len(xs), min(ys) - r - 0.3, "daughter cells", ha="center", va="top", fontsize=10.5)
        xlim = (min(min(xs) - r, px - pr) - 0.25, max(max(xs) + r, px + pr + 2.3) + 0.2)
        ylim = (min(ys) - r - 0.8, py + pr + 0.2)
    ax.set_xlim(*xlim)
    ax.set_ylim(*ylim)
    ax.set_aspect("equal")
    ax.axis("off")
    fig.set_size_inches(SCALE * (xlim[1] - xlim[0]), SCALE * (ylim[1] - ylim[0]))
    ax.set_position([0, 0, 1, 1])
    return fig


SETTINGS = ["in a biology lesson", "for homework", "on a revision card", "while revising for a test",
            "for the science club in Rubavu", "on the board in a lesson in Huye"]
VERBS = ["drew", "sketched", "copied"]


def questions(p: dict, rng: random.Random) -> list:
    n = len(p["pairs"])
    k = len(p["daughters"])
    mitosis = p["division"] == "mitosis"
    each = 2 * n if mitosis else n
    who = rng.choice(NAMES)
    lead = f"{who} {rng.choice(VERBS)} a cell dividing {rng.choice(SETTINGS)}"
    if not p["show"]:
        lead += ", but left the chromosomes out of the daughter cells"
    qs = [count(f"{lead}. How many chromosomes are there in each daughter cell?", each, "chromosomes")]
    kinds = [f"{d}, because {c} daughter cells are made" for d in ("mitosis", "meiosis") for c in (2, 4)]
    right = f"{p['division']}, because {k} daughter cells are made"
    qs.append(mcq("Which type of cell division is shown?", right, [x for x in kinds if x != right], rng))
    key = COMPARE[("same", "identical") if mitosis else ("half the", "different")]
    qs.append(mcq("How do the daughter cells compare with the parent cell?", key,
                  [x for x in COMPARE.values() if x != key], rng))
    if p["ask"] == "diploid":
        qs.append(short("What is the diploid number of this organism?", 2 * n,
                        [f"2n = {2 * n}", f"2n={2 * n}", f"{2 * n} chromosomes"]))
    else:
        qs.append(short("What is the haploid number of this organism?", n, [f"n = {n}", f"n={n}", f"{n} chromosomes"]))
    return qs
