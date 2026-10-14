"""The nitrogen cycle (LS, UP): five boxes (nitrogen gas in the air, ammonium compounds in the soil, nitrates in the
soil, protein in plants, protein in animals) joined by seven lettered arrows, as textbooks draw it. Which process an
arrow is follows from the boxes it joins, by a fixed table: air to ammonium compounds is nitrogen fixation;
ammonium compounds to nitrates is nitrification; nitrates to the air is denitrification; nitrates to plant protein
is absorption by roots; plant to animal protein is feeding; plant or animal protein to ammonium compounds is
decomposition.

Two layouts, each also drawn mirrored, and the lettering vary; every layout keeps each arrow clear of the boxes it
does not join, with no two arrows crossing. About half the figures carry a key of the microbes in the soil, and only
those are asked which microbes carry out a lettered process.

Which letter shows nitrogen fixation, nitrification, denitrification or absorption; what process a lettered arrow
shows; and either which microbes in the key do the work at an arrow, or which two arrows show decomposition.
"""
from __future__ import annotations

import random

from ..core import NAMES, mcq, new_figure
from . import _cycle as cy

ID = "nitrogen_cycle"
KIND = "bio.ecology"
SUBJECT = "biology"
BANDS = ("LS", "UP")
CONCEPTS = ("biology.biogeochemical-cycles",)
# A topic whose sections the book lists is reached only if one names the nitrogen cycle or nutrient cycles.
NEEDS = r"nitrogen cycle|nutrient cycl|biogeochemical"

BOXES = {"air": "nitrogen gas in the air", "ammonium": "ammonium compounds\nin the soil",
         "nitrates": "nitrates\nin the soil", "plants": "protein\nin plants", "animals": "protein\nin animals"}
PROCESS = {("air", "ammonium"): "nitrogen fixation", ("ammonium", "nitrates"): "nitrification",
           ("nitrates", "air"): "denitrification", ("nitrates", "plants"): "absorption by roots",
           ("plants", "animals"): "feeding", ("plants", "ammonium"): "decomposition",
           ("animals", "ammonium"): "decomposition"}
# Who does the work, as the key names them.
WORKERS = {"nitrogen fixation": "nitrogen-fixing bacteria", "nitrification": "nitrifying bacteria",
           "denitrification": "denitrifying bacteria", "decomposition": "decomposers (bacteria and fungi)"}
CONFUSED = {"nitrogen fixation": ["nitrification", "denitrification", "decomposition"],
            "nitrification": ["denitrification", "nitrogen fixation", "decomposition"],
            "denitrification": ["nitrification", "nitrogen fixation", "absorption by roots"],
            "absorption by roots": ["nitrification", "feeding", "decomposition"],
            "feeding": ["decomposition", "absorption by roots", "nitrogen fixation"],
            "decomposition": ["nitrification", "feeding", "denitrification"]}
SIZE = {"air": (3.5, 0.62), "ammonium": (2.75, 0.95), "nitrates": (1.75, 0.95), "plants": (1.6, 0.95),
        "animals": (1.75, 0.95)}
# Box centres. The proteins sit under the cycle of air, ammonium and nitrates: side by side in the middle, or the
# plants' under the nitrates.
LAYOUTS = [{"air": (5.0, 5.6), "ammonium": (1.75, 3.3), "nitrates": (8.25, 3.3), "plants": (6.7, 0.9),
            "animals": (3.3, 0.9)},
           {"air": (5.0, 5.6), "ammonium": (1.75, 3.3), "nitrates": (8.25, 3.3), "plants": (8.25, 0.9),
            "animals": (4.9, 0.9)}]
KEY_TOP = -0.05


def boxes(p: dict) -> dict:
    out = {}
    for key, (x, y) in LAYOUTS[p["layout"]].items():
        out[key] = cy.rect(10 - x if p["mirror"] else x, y, *SIZE[key])
    return out


def routes(p: dict) -> dict:
    bx = boxes(p)
    return {pair: cy.straight(bx[pair[0]], bx[pair[1]]) for pair in PROCESS}


def sample(rng: random.Random) -> dict:
    pairs = list(PROCESS)
    rng.shuffle(pairs)
    return {"band": rng.choice(BANDS), "layout": rng.randrange(len(LAYOUTS)), "mirror": rng.random() < 0.5,
            "arrows": [{"letter": "ABCDEFG"[k], "from": f, "to": t} for k, (f, t) in enumerate(pairs)],
            "legend": rng.random() < 0.5}


def draw(p: dict):
    bx = boxes(p)
    paths = routes(p)
    at = cy.place_letters(paths, bx)
    fig, ax = new_figure()
    for key, r in bx.items():
        cy.draw_box(ax, key, r, BOXES[key])
    for a in p["arrows"]:
        pair = (a["from"], a["to"])
        cy.draw_arrow(ax, a["letter"], pair, paths[pair], at[pair])
    low = min([y for _, y in at.values()] + [r[1] for r in bx.values()]) - 0.25
    if p["legend"]:
        # The key of microbes, under the cycle, two names a row.
        from matplotlib.patches import Rectangle
        from ..core import INK
        top = min(low, KEY_TOP)
        ax.add_patch(Rectangle((0.2, top - 1.45), 9.6, 1.4, facecolor="white", edgecolor=INK, linewidth=1.0))
        ax.text(0.45, top - 0.3, "Key: microbes in the soil", ha="left", va="center", fontsize=9.5, fontweight="bold")
        names = list(WORKERS.values())
        for k, words in enumerate(names):
            ax.text(0.45 + 4.7 * (k % 2), top - 0.75 - 0.42 * (k // 2), words, ha="left", va="center", fontsize=9.5,
                    gid=f"key:{k}")
        low = top - 1.6
    cy.fit(fig, ax, (0, 10), (low, 6.05), 0.68)
    return fig


SETTINGS = ["in a biology lesson", "for homework", "on a revision card", "after a lesson on bean farming near Musanze",
            "for a science club poster in Huye", "while revising for a test", "after a visit to a farm in Nyagatare"]
VERBS = ["drew", "copied", "labelled", "made"]


def questions(p: dict, rng: random.Random) -> list:
    proc = {a["letter"]: PROCESS[(a["from"], a["to"])] for a in p["arrows"]}
    by = {}
    for L, x in proc.items():
        by.setdefault(x, []).append(L)
    who = rng.choice(NAMES)
    ask = rng.choice(["nitrogen fixation", "nitrification", "denitrification", "absorption by roots"])
    key = by[ask][0]
    order = CONFUSED[ask] + sorted(set(proc.values()) - set(CONFUSED[ask]) - {ask})
    wrong = sorted((L for L in proc if L != key), key=lambda L: (order.index(proc[L]), rng.random()))
    qs = [mcq(f"{who} {rng.choice(VERBS)} this diagram of the nitrogen cycle {rng.choice(SETTINGS)}. "
              f"Which letter shows {ask}?", key, wrong[:3], rng)]
    other = rng.choice(sorted(L for L in proc if L != key))
    qs.append(mcq(f"What process does arrow {other} show?", proc[other], CONFUSED[proc[other]], rng))
    if p["legend"]:
        worked = sorted(L for L in proc if proc[L] in WORKERS and L not in (key, other)) or \
            sorted(L for L in proc if proc[L] in WORKERS)
        x = rng.choice(worked)
        right = WORKERS[proc[x]]
        qs.append(mcq(f"Which microbes in the key carry out the process at arrow {x}?", right,
                      [w for w in WORKERS.values() if w != right], rng))
    else:
        # Each wrong pair is one slip from the key or from another wrong pair: an arrow that also ends at the ammonium
        # compounds (fixation), or one that also leaves the plant protein (feeding).
        a, b = rng.sample(by["decomposition"], 2)
        x, y = by["nitrogen fixation"][0], by["feeding"][0]
        pair = lambda u, v: " and ".join(sorted((u, v)))  # noqa: E731
        qs.append(mcq("Which two arrows show decomposition?", pair(a, b), [pair(a, x), pair(b, y), pair(x, y)], rng))
    return qs
