"""The carbon cycle (LS, UP): five boxes (carbon dioxide in the air across the top; green plants, animals,
decomposers and fossil fuels in a row beneath it) joined by seven to nine lettered arrows, as textbooks draw it.
Which process an arrow is follows from the two boxes it joins, by a fixed table: air to plants is photosynthesis;
plants, animals or decomposers to the air is respiration; plants to animals is feeding; plants or animals to
decomposers is death and decay; plants or animals to fossil fuels is fossilisation; fossil fuels to the air is
combustion.

The row's order varies (and so which arrows run straight across and which curve under a box), as do which optional
arrows are drawn (plants' own respiration, a second death-and-decay or fossilisation arrow) and the lettering. Every
box has an arrow in and an arrow out, so the cycle closes; a layout is kept only if no arrow runs through a box it
does not join and no two arrows cross.

Which letter shows photosynthesis or combustion; what process a lettered arrow shows; which arrows put carbon dioxide
into the air.
"""
from __future__ import annotations

import random

from ..core import NAMES, mcq, new_figure
from . import _cycle as cy

ID = "carbon_cycle"
KIND = "bio.ecology"
SUBJECT = "biology"
BANDS = ("LS", "UP")
CONCEPTS = ("biology.biogeochemical-cycles",)
# Integrated Science teaches the carbon cycle too (P3n): its Lower Secondary topics are reached by this.
ALSO = ("science.carbon-cycle",)
# A topic whose sections the book lists is reached only if one names the carbon cycle or nutrient cycles.
NEEDS = r"carbon cycle|nutrient cycl|biogeochemical|cycling of (?:carbon|matter|nutrients)"

BOXES = {"air": "carbon dioxide in the air", "plants": "green plants", "animals": "animals",
         "decomposers": "decomposers", "fossil": "fossil fuels"}
# The process an arrow shows, from the boxes it joins: (from, to).
PROCESS = {("air", "plants"): "photosynthesis", ("plants", "air"): "respiration", ("animals", "air"): "respiration",
           ("decomposers", "air"): "respiration", ("plants", "animals"): "feeding",
           ("plants", "decomposers"): "death and decay", ("animals", "decomposers"): "death and decay",
           ("fossil", "air"): "combustion", ("plants", "fossil"): "fossilisation", ("animals", "fossil"): "fossilisation"}
# The mistakes a student makes for each process: the reverse arrow, another arrow into or out of the same box.
CONFUSED = {"photosynthesis": ["respiration", "combustion", "feeding"],
            "respiration": ["photosynthesis", "combustion", "death and decay"],
            "feeding": ["death and decay", "respiration", "photosynthesis"],
            "death and decay": ["feeding", "fossilisation", "respiration"],
            "combustion": ["respiration", "fossilisation", "photosynthesis"],
            "fossilisation": ["combustion", "death and decay", "feeding"]}
# The row beneath the air, left to right (each also drawn mirrored).
ROWS = [["fossil", "plants", "animals", "decomposers"], ["plants", "animals", "decomposers", "fossil"],
        ["plants", "animals", "fossil", "decomposers"], ["animals", "plants", "decomposers", "fossil"]]
WIDTH = {"plants": 2.05, "animals": 1.5, "decomposers": 2.05, "fossil": 1.8}
XS = [1.3, 4.1, 6.9, 9.7]
ROW_Y, AIR_Y, H = 3.0, 5.25, 0.62
XLIM, TOP = (0.0, 11.0), 5.7


def boxes(row: list) -> dict:
    out = {"air": cy.rect(5.5, AIR_Y, 10.5, H)}
    for x, key in zip(XS, row):
        out[key] = cy.rect(x, ROW_Y, WIDTH[key], H)
    return out


def routes(row: list, pairs: list) -> dict:
    """Each arrow's path: straight up or down between a box and the air (two side by side for the plants when both
    photosynthesis and their respiration are drawn); straight across between neighbours in the row; curving under the
    row between boxes further apart, a wider curve further out."""
    bx = boxes(row)
    both = ("air", "plants") in pairs and ("plants", "air") in pairs
    out = {}
    for f, t in pairs:
        if "air" in (f, t):
            key = t if f == "air" else f
            x = cy.centre(bx[key])[0]
            if key == "plants" and both:
                x += -0.33 if f == "air" else 0.33
            low, high = (x, bx[key][3]), (x, bx["air"][1])
            out[(f, t)] = [high, low] if f == "air" else [low, high]
            continue
        i, j = row.index(f), row.index(t)
        a, b = sorted((i, j))
        span = b - a
        if span == 1:
            ra, rb = bx[row[a]], bx[row[b]]
            pts = [(ra[2], ROW_Y), (rb[0], ROW_Y)]
        else:
            ra, rb = bx[row[a]], bx[row[b]]
            # Down from the box, across under the row, up into the other: a wider curve leaves further out and
            # dips lower, so curves from one box never run together.
            xa = ra[2] - 0.35 - 0.5 * (span - 2)
            xb = rb[0] + 0.35 + 0.5 * (span - 2)
            y = ra[1]
            pts = cy.u_curve((xa, y), (xb, y), 0.6 + 0.45 * (span - 2))
        out[(f, t)] = pts if i < j else pts[::-1]
    return out


def sample(rng: random.Random) -> dict:
    while True:
        row = list(rng.choice(ROWS))
        if rng.random() < 0.5:
            row.reverse()
        pairs = [("air", "plants"), ("plants", "animals"), ("animals", "air"), ("decomposers", "air"), ("fossil", "air")]
        if rng.random() < 0.65:
            pairs.append(("plants", "air"))
        pairs += rng.choice([[("animals", "decomposers")], [("plants", "decomposers")],
                             [("animals", "decomposers"), ("plants", "decomposers")]])
        pairs += rng.choice([[("plants", "fossil")], [("animals", "fossil")], [("plants", "fossil"), ("animals", "fossil")]])
        if len(pairs) > 9 or not cy.clean(routes(row, pairs), boxes(row)):
            continue
        rng.shuffle(pairs)
        arrows = [{"letter": "ABCDEFGHIJ"[k], "from": f, "to": t} for k, (f, t) in enumerate(pairs)]
        return {"band": rng.choice(BANDS), "row": row, "arrows": arrows}


def draw(p: dict):
    pairs = [(a["from"], a["to"]) for a in p["arrows"]]
    bx = boxes(p["row"])
    paths = routes(p["row"], pairs)
    at = cy.place_letters(paths, bx)
    fig, ax = new_figure()
    for key, r in bx.items():
        cy.draw_box(ax, key, r, BOXES[key])
    for a in p["arrows"]:
        pair = (a["from"], a["to"])
        cy.draw_arrow(ax, a["letter"], pair, paths[pair], at[pair])
    low = min([y for pts in paths.values() for _, y in pts] + [y for _, y in at.values()] + [bx["plants"][1]])
    cy.fit(fig, ax, XLIM, (low - 0.3, TOP), 0.64)
    return fig


SETTINGS = ["in a biology lesson", "for homework", "on a revision card", "for a science club poster in Huye",
            "after a lesson on Nyungwe Forest", "for a class display in Musanze", "while revising for a test"]
VERBS = ["drew", "copied", "labelled", "made"]


def _letters(s) -> str:
    s = sorted(s)
    return s[0] if len(s) == 1 else ", ".join(s[:-1]) + " and " + s[-1]


def questions(p: dict, rng: random.Random) -> list:
    proc = {a["letter"]: PROCESS[(a["from"], a["to"])] for a in p["arrows"]}
    into = {a["letter"] for a in p["arrows"] if a["to"] == "air"}
    who = rng.choice(NAMES)
    ask = rng.choice(["photosynthesis", "combustion"])
    key = next(L for L, x in proc.items() if x == ask)
    # Wrong letters: the arrows a student confuses with it first (the reverse process, then the rest).
    order = CONFUSED[ask] + sorted(set(proc.values()) - set(CONFUSED[ask]) - {ask})
    wrong = sorted((L for L in proc if L != key), key=lambda L: (order.index(proc[L]), rng.random()))
    qs = [mcq(f"{who} {rng.choice(VERBS)} this diagram of the carbon cycle {rng.choice(SETTINGS)}. "
              f"Which letter shows {ask}?", key, wrong[:3], rng)]
    other = rng.choice(sorted(L for L in proc if L != key))
    qs.append(mcq(f"What process does arrow {other} show?", proc[other], CONFUSED[proc[other]], rng))
    # Plausible wrong sets, each one slip from the key: photosynthesis put in (every arrow touching the air), one arrow
    # into the air left out (most often combustion, which is not respiration), or both.
    photo = next(L for L, x in proc.items() if x == "photosynthesis")
    comb = next(L for L, x in proc.items() if x == "combustion")
    drop = comb if rng.random() < 0.5 else rng.choice(sorted(into - {comb}))
    sets = [into | {photo}, into - {drop}, (into | {photo}) - {drop}]
    qs.append(mcq("Which arrows show carbon dioxide being released into the air?", _letters(into),
                  [_letters(s) for s in sets], rng))
    return qs
