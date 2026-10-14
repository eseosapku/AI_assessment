"""Particle diagrams (LS, UP): four boxes, A to D, each holding a different kind of substance: an element of
single atoms, an element of molecules, a compound, or a mixture, every box spread out as a gas. Which box is
are spread out as gases. Which box is a compound, a mixture, an element of atoms or of molecules, which box
a pure compound, a mixture or a pure element, how many particles a box holds, and how many kinds of atom.

No box is drawn as a solid (P3h review): among element, compound and mixture boxes it read as no solid at all,
and a packed lattice of one kind of atom cannot show molecules.

Atoms of different elements are shaded differently; the atoms of one molecule touch.
"""
from __future__ import annotations

import random

from matplotlib.patches import Circle, Rectangle

from ..core import INK, NAMES, mcq, new_figure, short

ID = "particle_diagram"
KIND = "chem.particle"
SUBJECT = "chemistry"
BANDS = ("LS", "UP")
CONCEPTS = tuple(f"chemistry.{c}" for c in ("states-of-matter", "kinetic-theory", "chemical-formulae", "separation-techniques"))
AVOID = r"organic|alkane|alcohol|acid|electrolysis|redox|equilibrium|rate|waste|polymer|petro|enthalpy|solvent|colligative|group|oxide|salt|oxygen|stoichiometry|equation|bonding|chemical reactions|trends|phase diagram|mole concept"
# A topic whose sections the book lists is reached only if one names what this figure teaches.
NEEDS = r"particle|states of matter|kinetic|element|compound|mixture|molecul|\batoms?\b"
KINDS = ["atoms", "molecules", "compound", "mixture"]
SHADES = ["#111111", "#9aa3ab", "#ffffff"]  # dark, grey and white atoms
R = 0.12  # three atoms in a row span 0.72: a clear gap to the next cell's particle and to the walls


def _particles(kind: str, n: int, rng: random.Random) -> list[list[int]]:
    """Each particle as its atoms' shades: one atom, two alike, two or three unalike, or a mix of kinds."""
    a, b = rng.sample(range(3), 2)
    if kind == "atoms":
        return [[a] for _ in range(n)]
    if kind == "molecules":
        return [[a, a] for _ in range(n)]
    if kind == "compound":
        shape = rng.choice([[a, b], [b, a, b]])
        return [list(shape) for _ in range(n)]
    one, two = rng.choice([([a], [b, b]), ([a, a], [b, b]), ([a], [a, b]), ([a, a], [a, b, a])])
    return [list(one) if k % 2 == 0 else list(two) for k in range(n)]


def sample(rng: random.Random) -> dict:
    kinds = rng.sample(KINDS, 4)
    boxes = []
    for i, kind in enumerate(kinds):
        n = rng.randint(5, 8)
        boxes.append({"letter": "ABCD"[i], "kind": kind, "state": "gas",
                      "particles": _particles(kind, n, rng), "seed": rng.randint(0, 10 ** 6)})
    return {"band": rng.choice(BANDS), "boxes": boxes}


def _draw_particle(ax, x, y, atoms, angle):
    import math
    dx, dy = 2 * R * math.cos(angle), 2 * R * math.sin(angle)
    start = -(len(atoms) - 1) / 2
    for k, shade in enumerate(atoms):
        cx, cy = x + (start + k) * dx, y + (start + k) * dy
        ax.add_patch(Circle((cx, cy), R, facecolor=SHADES[shade], edgecolor=INK, linewidth=1.0, zorder=3))


def _placed(p: dict) -> list[tuple[int, int, float, float, list[int], float]]:
    """Each particle's box, number, centre, atoms and angle."""
    import math
    out = []
    for i, box in enumerate(p["boxes"]):
        x0 = i * 3.3
        rng = random.Random(box["seed"])
        parts = box["particles"]
        # spread out, one particle to a cell of a three-by-three grid, so none overlap or leave the box
        cells = rng.sample([(c, r) for c in range(3) for r in range(3)], len(parts))
        for k, ((c, r), atoms) in enumerate(zip(cells, parts)):
            x = x0 + 0.55 + 0.95 * c + rng.uniform(-0.04, 0.04)
            y = 0.55 + 0.95 * r + rng.uniform(-0.04, 0.04)
            out.append((i, k, x, y, atoms, rng.choice([0.0, math.pi / 4, math.pi / 2, 3 * math.pi / 4])))
    return out


def atoms_drawn(p: dict) -> list[tuple[int, int, float, float]]:
    """Every atom's box, particle and centre, as drawn."""
    import math
    out = []
    for i, k, x, y, atoms, angle in _placed(p):
        dx, dy = 2 * R * math.cos(angle), 2 * R * math.sin(angle)
        start = -(len(atoms) - 1) / 2
        out += [(i, k, x + (start + j) * dx, y + (start + j) * dy) for j in range(len(atoms))]
    return out


def draw(p: dict):
    fig, ax = new_figure(8.4, 2.9)
    for i, box in enumerate(p["boxes"]):
        x0 = i * 3.3
        ax.add_patch(Rectangle((x0, 0), 3.0, 3.0, facecolor="none", edgecolor=INK, linewidth=1.4))
        ax.text(x0 + 1.5, -0.25, box["letter"], ha="center", va="top", fontsize=13, fontweight="bold")
    for i, k, x, y, atoms, angle in _placed(p):
        _draw_particle(ax, x, y, atoms, angle)
    ax.set_xlim(-0.2, 13.1)
    ax.set_ylim(-0.8, 3.15)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


# "pure": the mixture box holds compound molecules or single atoms too (P3h review)
ASKS = {"compound": "a pure compound", "mixture": "a mixture", "atoms": "a pure element made of single atoms",
        "molecules": "a pure element made of molecules"}
SETTINGS = ["in a chemistry lesson", "for homework", "on a revision card", "at the science club", "for a class test"]


def questions(p: dict, rng: random.Random) -> list:
    name, friend = rng.sample(NAMES, 2)
    letters = [b["letter"] for b in p["boxes"]]
    by_kind = {b["kind"]: b["letter"] for b in p["boxes"]}
    first, second = rng.sample(KINDS, 2)
    count_box = rng.choice(p["boxes"])
    unit = "atoms" if count_box["kind"] == "atoms" else "particles"
    molecules = any(len(x) > 1 for x in count_box["particles"])
    sort_box = rng.choice([b for b in p["boxes"] if b["letter"] != count_box["letter"]])
    sorts = len({a for x in sort_box["particles"] for a in x})
    return [mcq(f"{name} drew these four boxes of particles {rng.choice(SETTINGS)}. Which box shows {ASKS[first]}?", by_kind[first],
                [x for x in letters if x != by_kind[first]], rng),
            mcq(f"Which box shows {ASKS[second]}?", by_kind[second], [x for x in letters if x != by_kind[second]], rng),
            short(f"How many separate {unit} are there in box {count_box['letter']}?" + (f" {friend} counts each molecule as one." if molecules else ""),
                  len(count_box["particles"]), [f"{len(count_box['particles'])} {unit}"]),
            short(f"How many kinds of atom are there in box {sort_box['letter']}?", sorts, [str(sorts), f"{sorts} kinds", f"{sorts} kinds of atom"])]
