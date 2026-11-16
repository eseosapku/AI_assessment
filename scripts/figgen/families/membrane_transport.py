"""Movement across a cell membrane (LS, UP), three sub-types:

- diffusion: particles of one substance drawn on each side of a cell membrane (outside and inside the cell), counted;
  the way the net movement goes (from the side with more to the side with fewer, by diffusion), how many are on one
  side, and how many on each side once they have spread out evenly;
- osmosis: water molecules (small, open) and sugar or salt molecules (big, filled) on two sides of a partially
  permeable membrane; the side water moves into (the one with more solute and fewer water molecules) and counts;
- ions: a bar chart of four ions' concentrations inside a root hair cell (or a pond alga's cell) and in the water
  around it; the one ion that must be taken in by active transport (higher inside than out) or the one that could
  enter by diffusion (higher outside), a reading, and how many times more concentrated one ion is inside.

The two sides of a membrane hold the same volume, so an even spread is the same number each side; counts differ by
four at least, so the direction is plain; no two particles touch, so each can be counted.
"""
from __future__ import annotations

import random

from matplotlib.patches import Rectangle

from ..core import FILL, FILL_2, GRID, INK, NAMES, mcq, new_figure, short

ID = "membrane_transport"
KIND = "diagram.template"
SUBJECT = "biology"
BANDS = ("LS", "UP")
CONCEPTS = tuple(f"biology.{c}" for c in ("osmosis", "active-transport", "cell-membranes-transport",
                                           "plasma-membrane-gradients"))
# A topic whose sections the book lists is reached only if one names what these figures teach.
NEEDS = r"diffusion|osmosis|active transport|across (?:the |a )?(?:cell )?membrane|into and out of cells|passive (?:transport|movement)"
AVOID = (r"enzyme|genetic|inherit|immun|disease|reproduc|ecolog|population|photosynth|digest|gas exchange|excretion|"
         r"nutrition|respiration|glossary|science in context|thinking and working scientifically|scientific method|"
         r"science skills|sexual|\bSTIs?\b|HIV|pregnancy|social factors|reproduction system")

SUBSTANCES = ["oxygen", "glucose", "carbon dioxide", "urea"]
SOLUTES = ["sugar", "salt"]
IONS = ["potassium", "nitrate", "phosphate", "magnesium", "calcium", "sulfate", "sodium", "chloride"]
CELLS = [("root hair cell", "soil water"), ("pond alga cell", "pond water")]
DIRS = ["into the cell, by diffusion", "out of the cell, by diffusion", "into the cell, by active transport",
        "out of the cell, by active transport"]
GAP = 0.09  # no two particle centres closer, in data units (each side is 1 wide)


def concepts_for(p: dict) -> tuple:
    if p["kind"] == "ions":
        return tuple(f"biology.{c}" for c in ("active-transport", "cell-membranes-transport", "plasma-membrane-gradients"))
    return tuple(f"biology.{c}" for c in ("osmosis", "cell-membranes-transport", "plasma-membrane-gradients"))


def avoid_for(p: dict) -> str:
    """Particles crossing by diffusion or osmosis are not the active-transport chapter's figure; a chart whose one
    question is active transport is not the passive chapter's."""
    if p["kind"] in ("diffusion", "osmosis"):
        return AVOID + r"|^active transport$"
    if p["variant"] == "active":
        return AVOID + r"|passive"
    return AVOID


def _scatter(rng: random.Random, n: int, x0: float, avoid: list, gap: float) -> list:
    """n points in one side's box (x0 to x0 + 1), clear of each other and of `avoid`."""
    pts: list = []
    while len(pts) < n:
        x, y = round(x0 + rng.uniform(0.1, 0.9), 3), round(rng.uniform(0.12, 0.8), 3)
        if all((x - a) ** 2 + (y - b) ** 2 >= gap ** 2 for a, b in pts + avoid):
            pts.append([x, y])
    return pts


def _sample_diffusion(rng: random.Random) -> dict:
    while True:
        out, inn = rng.randint(2, 16), rng.randint(2, 16)
        if abs(out - inn) >= 4 and (out + inn) % 2 == 0:
            break
    left = _scatter(rng, out, 0.0, [], GAP)
    right = _scatter(rng, inn, 1.0, [], GAP)
    return {"band": rng.choice(BANDS), "kind": "diffusion", "substance": rng.choice(SUBSTANCES), "outside": left,
            "inside": right, "ask": rng.choice(["inside", "outside"])}


def _sample_osmosis(rng: random.Random) -> dict:
    while True:
        s_strong, s_weak = rng.randint(3, 8), rng.randint(1, 5)
        w_strong, w_weak = rng.randint(6, 12), rng.randint(9, 16)
        if s_strong - s_weak >= 2 and w_weak - w_strong >= 2:
            break
    strong = rng.choice("AB")
    sides = {}
    for side, x0 in (("A", 0.0), ("B", 1.0)):
        ns, nw = (s_strong, w_strong) if side == strong else (s_weak, w_weak)
        solute = _scatter(rng, ns, x0, [], 0.13)
        water = _scatter(rng, nw, x0, solute, 0.1)
        sides[side] = {"water": water, "solute": solute}
    return {"band": rng.choice(BANDS), "kind": "osmosis", "solute": rng.choice(SOLUTES), "A": sides["A"], "B": sides["B"],
            "ask_solute": rng.choice("AB"), "ask_water": rng.choice("AB")}


def _sample_ions(rng: random.Random) -> dict:
    ions = rng.sample(IONS, 4)
    step = rng.choice([5, 10])
    variant = rng.choice(["active", "diffusion"])
    odd = rng.randrange(4)  # the one ion that goes the other way
    inn, out = [], []
    for i in range(4):
        higher_inside = (i == odd) == (variant == "active")
        if higher_inside:
            o = step * rng.randint(1, 3)
            v = o * rng.randint(2, 5)
        else:
            v = step * rng.randint(1, 4)
            o = v + step * rng.randint(1, 4)
        inn.append(v)
        out.append(o)
    ratio = rng.choice([i for i in range(4) if inn[i] > out[i] and inn[i] % out[i] == 0])
    read = rng.choice([i for i in range(4) if i != ratio])
    cell, medium = rng.choice(CELLS)
    return {"band": rng.choice(BANDS), "kind": "ions", "variant": variant, "ions": ions, "inside": inn, "outside": out,
            "ystep": step, "cell": cell, "medium": medium, "ratio": ions[ratio], "read": ions[read]}


def sample(rng: random.Random) -> dict:
    kind = rng.choice(["diffusion", "osmosis", "ions"])
    return {"diffusion": _sample_diffusion, "osmosis": _sample_osmosis, "ions": _sample_ions}[kind](rng)


# --- drawing -----------------------------------------------------------------------------------------------------

def _box(ax, title_l: str, title_r: str, membrane: str) -> None:
    ax.add_patch(Rectangle((0, 0), 2, 1, facecolor="white", edgecolor=INK, linewidth=1.4, zorder=0))
    ax.add_patch(Rectangle((1.0, 0), 1.0, 1, facecolor="#eef1f4", edgecolor="none", zorder=0.5))
    ax.plot([1.0, 1.0], [0, 1], color=INK, linewidth=2.4, linestyle=(0, (4, 3)), zorder=2, gid="membrane")
    ax.text(0.5, 0.9, title_l, ha="center", va="center", fontsize=11, fontweight="bold")
    ax.text(1.5, 0.9, title_r, ha="center", va="center", fontsize=11, fontweight="bold")
    ax.text(1.0, -0.06, membrane, ha="center", va="top", fontsize=10)


def draw(p: dict):
    if p["kind"] == "ions":
        return _draw_ions(p)
    fig, ax = new_figure(6.6, 4.0)
    if p["kind"] == "diffusion":
        _box(ax, "Outside the cell", "Inside the cell", "cell membrane")
        pts = p["outside"] + p["inside"]
        ax.scatter([x for x, _ in pts], [y for _, y in pts], s=55, color=INK, zorder=3)
        ax.plot([0.12], [-0.25], marker="o", markersize=7, color=INK, linestyle="none")
        ax.text(0.2, -0.25, f"= one particle of {p['substance']}", ha="left", va="center", fontsize=10)
    else:
        _box(ax, "Side A", "Side B", "partially permeable membrane")
        water = p["A"]["water"] + p["B"]["water"]
        solute = p["A"]["solute"] + p["B"]["solute"]
        ax.scatter([x for x, _ in water], [y for _, y in water], s=34, facecolor="white", edgecolor=INK, linewidth=1.3,
                   zorder=3)
        ax.scatter([x for x, _ in solute], [y for _, y in solute], s=150, color=FILL, edgecolor=INK, linewidth=1.0,
                   zorder=3)
        ax.plot([0.08], [-0.25], marker="o", markersize=6, markerfacecolor="white", markeredgecolor=INK, linestyle="none")
        ax.text(0.15, -0.25, "= water molecule", ha="left", va="center", fontsize=10)
        ax.plot([1.08], [-0.25], marker="o", markersize=11, color=FILL, markeredgecolor=INK, linestyle="none")
        ax.text(1.17, -0.25, f"= {p['solute']} molecule", ha="left", va="center", fontsize=10)
    ax.set_xlim(-0.02, 2.02)
    ax.set_ylim(-0.34, 1.02)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def _draw_ions(p: dict):
    fig, ax = new_figure(6.6, 4.3)
    xs = range(4)
    top = max(p["inside"] + p["outside"])
    step = p["ystep"]
    ymax = step * (top // step + 2)
    ax.bar([x - 0.19 for x in xs], p["inside"], width=0.36, color=FILL, edgecolor=INK, linewidth=1.0, zorder=3,
           label="Inside the cell")
    ax.bar([x + 0.19 for x in xs], p["outside"], width=0.36, color=FILL_2, edgecolor=INK, linewidth=1.0, hatch="//",
           zorder=3, label=f"In the {p['medium']}")
    ax.set_xticks(list(xs))
    ax.set_xticklabels(p["ions"], fontsize=10)
    ax.set_yticks(range(0, ymax + 1, step))
    ax.set_ylim(0, ymax)
    ax.set_xlim(-0.6, 3.6)
    ax.yaxis.grid(True, color=GRID, linewidth=0.8)
    ax.set_axisbelow(True)
    ax.tick_params(axis="y", labelsize=9)
    ax.set_ylabel("Concentration (mmol/dm³)")
    ax.set_xlabel("Ion")
    ax.legend(loc="upper left", fontsize=9, frameon=False, ncol=2, bbox_to_anchor=(0.0, 1.13))
    return fig


# --- questions ---------------------------------------------------------------------------------------------------

SETTINGS = ["in a biology lesson", "for a class poster", "for a wall chart", "for revision", "at the science club",
            "for homework"]
VERBS = ["drew", "sketched", "drew a model of"]


def _amount(v: int) -> list[str]:
    return [str(v), f"{v} mmol/dm³", f"{v}mmol/dm³", f"{v} mmol per dm³"]


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    setting = rng.choice(SETTINGS)
    if p["kind"] == "diffusion":
        sub, out, inn = p["substance"], len(p["outside"]), len(p["inside"])
        key = ("into" if out > inn else "out of") + " the cell, by diffusion"
        where = p["ask"]
        n = inn if where == "inside" else out
        return [mcq(f"{who} {rng.choice(VERBS)} particles of {sub} on each side of a cell membrane {setting}. "
                    f"Which way is the net movement of {sub}, and by what process?", key, [d for d in DIRS if d != key], rng),
                short(f"How many particles of {sub} are {where} the cell?", n, [f"{n} particles"]),
                short(f"The particles of {sub} spread out until both sides have the same number. How many particles will "
                      f"then be on each side?", (out + inn) // 2, [f"{(out + inn) // 2} particles"])]
    if p["kind"] == "osmosis":
        sol = p["solute"]
        strong = "A" if len(p["A"]["solute"]) > len(p["B"]["solute"]) else "B"
        a, b = p["ask_solute"], p["ask_water"]
        ns, nw = len(p[a]["solute"]), len(p[b]["water"])
        return [mcq(f"{who} {rng.choice(VERBS)} water molecules and {sol} molecules on each side of a partially permeable "
                    f"membrane {setting}. Into which side will water move by osmosis?", f"side {strong}",
                    ["side A", "side B", "neither side"], rng),
                short(f"How many {sol} molecules are on side {a}?", ns, [f"{ns} molecules", f"{ns} {sol} molecules"]),
                short(f"How many water molecules are on side {b}?", nw, [f"{nw} molecules", f"{nw} water molecules"])]
    ions, inn, out = p["ions"], p["inside"], p["outside"]
    cell, medium = p["cell"], p["medium"]
    lead = (f"{who} measured four ions inside a {cell} and in the {medium} around it {setting}. ")
    if p["variant"] == "active":
        key = next(n for n, i, o in zip(ions, inn, out) if i > o)
        q1 = mcq(lead + f"Which ion must the {cell} take in by active transport?", key, [n for n in ions if n != key], rng)
    else:
        key = next(n for n, i, o in zip(ions, inn, out) if i < o)
        q1 = mcq(lead + f"Which ion could enter the {cell} by diffusion?", key, [n for n in ions if n != key], rng)
    r = ions.index(p["ratio"])
    k = inn[r] // out[r]
    j = ions.index(p["read"])
    return [q1,
            short(f"What is the concentration of {p['read']} in the {medium}, in mmol/dm³?", out[j], _amount(out[j])),
            short(f"How many times more concentrated is {p['ratio']} inside the cell than in the {medium}?", k,
                  [f"{k} times", f"{k}x", f"{k} ×", f"×{k}"])]

