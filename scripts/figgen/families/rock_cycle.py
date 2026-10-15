"""The rock cycle (LS, UP): five boxes round a loop (magma, igneous rock, sediments, sedimentary rock, metamorphic
rock) joined by lettered arrows, as geography and science textbooks draw it. Which process an arrow shows follows from
the two boxes it joins, by a fixed table: magma to igneous rock is cooling; a rock to sediments is weathering and
erosion; sediments to sedimentary rock is compaction and cementation; a rock to metamorphic rock is heat and pressure;
a rock to magma is melting. The process names are never printed: the letters are the question.

The loop is always drawn; up to two short cuts are added (igneous rock changed by heat and pressure, sedimentary rock
melted, metamorphic rock weathered), kept only where no arrow crosses another or runs through a box; the layout is
sometimes mirrored, and sometimes one rock box shows "Rock X" in place of its name, to be worked out from its arrows.

Which letter shows a process (one drawn once); what process a lettered arrow shows; and which rock the process at a
lettered arrow forms, or which rock X is.
"""
from __future__ import annotations

import random

from ..core import NAMES, mcq, new_figure
from . import _cycle as cy
from ._bio_parts import letter_choice

ID = "rock_cycle"
KIND = "process.flow"
SUBJECT = "geography"
BANDS = ("LS", "UP")
CONCEPTS = tuple(f"geography.{c}" for c in ("rock-formation", "rock-classification", "minerals-rocks-definition"))
# A topic whose sections the book lists is reached only if its name or a section names rocks or the rock cycle.
NEEDS = r"\brocks?\b|rock cycle"
# Mining and quarrying chapters share the rock concepts but teach extraction, not how rocks form.
AVOID = r"mining|quarr|extraction|fossil fuel"

BOXES = {"magma": "magma (molten rock)", "igneous": "igneous rock", "sediments": "sediments",
         "sedimentary": "sedimentary rock", "metamorphic": "metamorphic rock"}
ROCKS = {"igneous": "igneous rock", "sedimentary": "sedimentary rock", "metamorphic": "metamorphic rock"}
PROCESS = {("magma", "igneous"): "cooling", ("igneous", "sediments"): "weathering and erosion",
           ("metamorphic", "sediments"): "weathering and erosion", ("sediments", "sedimentary"): "compaction and cementation",
           ("sedimentary", "metamorphic"): "heat and pressure", ("igneous", "metamorphic"): "heat and pressure",
           ("metamorphic", "magma"): "melting", ("sedimentary", "magma"): "melting"}
# The mistakes a student makes for each process, likeliest first.
CONFUSED = {"cooling": ["melting", "heat and pressure", "compaction and cementation"],
            "melting": ["cooling", "heat and pressure", "weathering and erosion"],
            "weathering and erosion": ["compaction and cementation", "melting", "heat and pressure"],
            "compaction and cementation": ["weathering and erosion", "heat and pressure", "cooling"],
            "heat and pressure": ["melting", "compaction and cementation", "cooling"]}
LOOP = [("magma", "igneous"), ("igneous", "sediments"), ("sediments", "sedimentary"), ("sedimentary", "metamorphic"),
        ("metamorphic", "magma")]
SHORT_CUTS = [[], [("igneous", "metamorphic")], [("sedimentary", "magma")], [("metamorphic", "sediments")],
              [("igneous", "metamorphic"), ("metamorphic", "sediments")]]
CENTRES = {"sediments": (5.7, 6.55), "igneous": (1.5, 4.2), "sedimentary": (9.75, 4.2), "metamorphic": (8.25, 1.0),
           "magma": (3.05, 1.0)}
WIDTH = {"sediments": 2.1, "igneous": 2.4, "sedimentary": 2.9, "metamorphic": 2.95, "magma": 3.1}
H = 0.72
XLIM, YLIM = (0.0, 11.4), (0.3, 7.2)


def boxes(mirror: bool) -> dict:
    out = {}
    for k, (x, y) in CENTRES.items():
        out[k] = cy.rect(XLIM[1] - x if mirror else x, y, WIDTH[k], H)
    return out


# Where each arrow leaves and enters its boxes (unmirrored): on the boxes' edges, the ends of arrows at one box kept
# well apart, so two heads never sit side by side.
ANCHORS = {("magma", "igneous"): ((2.0, 1.36), (1.3, 3.84)), ("igneous", "sediments"): ((2.3, 4.56), (4.65, 6.55)),
           ("sediments", "sedimentary"): ((6.75, 6.55), (9.2, 4.56)),
           ("sedimentary", "metamorphic"): ((9.6, 3.84), (8.9, 1.36)),
           ("metamorphic", "magma"): ((6.775, 1.0), (4.6, 1.0)), ("igneous", "metamorphic"): ((2.4, 3.84), (7.3, 1.36)),
           ("sedimentary", "magma"): ((8.7, 3.84), (3.8, 1.36)), ("metamorphic", "sediments"): ((8.0, 1.36), (6.0, 6.19))}


def routes(mirror: bool, pairs) -> dict:
    flip = (lambda x: XLIM[1] - x) if mirror else (lambda x: x)
    return {pr: [(flip(x), y) for x, y in ANCHORS[pr]] for pr in pairs}


def sample(rng: random.Random) -> dict:
    while True:
        mirror = rng.random() < 0.5
        pairs = LOOP + rng.choice(SHORT_CUTS)
        if not cy.clean(routes(mirror, pairs), boxes(mirror), ends=0.6):
            continue
        rng.shuffle(pairs)
        arrows = [{"letter": "ABCDEFGH"[k], "from": f, "to": t} for k, (f, t) in enumerate(pairs)]
        blank = rng.choice(sorted(ROCKS)) if rng.random() < 0.35 else None
        return {"band": rng.choice(BANDS), "mirror": mirror, "arrows": arrows, "blank": blank}


def draw(p: dict):
    pairs = [(a["from"], a["to"]) for a in p["arrows"]]
    bx = boxes(p["mirror"])
    paths = routes(p["mirror"], pairs)
    at = cy.place_letters(paths, bx, offset=0.3)
    fig, ax = new_figure()
    for key, r in bx.items():
        cy.draw_box(ax, key, r, "Rock X" if key == p["blank"] else BOXES[key], size=10.5)
    for a in p["arrows"]:
        pair = (a["from"], a["to"])
        cy.draw_arrow(ax, a["letter"], pair, paths[pair], at[pair])
    cy.fit(fig, ax, XLIM, YLIM, 0.62)
    return fig


# --- questions --------------------------------------------------------------------------------------

INTROS = ["{name} drew this diagram of the rock cycle {setting}.", "{name} copied this rock cycle diagram {setting}.",
          "{name} is revising the rock cycle from this diagram {setting}.", "{name} made this rock cycle poster {setting}."]
SETTINGS = ["for a geography test", "after a lesson on rocks", "for the class wall", "at the geography club in Huye",
            "after a field trip to a quarry near Rusizi", "for homework", "after a visit to the volcanoes near Musanze",
            "while revising in Nyanza", "for a lesson on the Earth's crust"]


def questions(p: dict, rng: random.Random) -> list:
    pairs = {a["letter"]: (a["from"], a["to"]) for a in p["arrows"]}
    proc = {L: PROCESS[pr] for L, pr in pairs.items()}
    count = {x: list(proc.values()).count(x) for x in set(proc.values())}
    intro = rng.choice(INTROS).format(name=rng.choice(NAMES), setting=rng.choice(SETTINGS))
    ask = rng.choice(sorted(x for x, n in count.items() if n == 1))
    key = next(L for L, x in proc.items() if x == ask)
    order = CONFUSED[ask] + sorted(set(proc.values()) - set(CONFUSED[ask]) - {ask})
    wrong = sorted((L for L in proc if L != key), key=lambda L: (order.index(proc[L]), rng.random()))
    qs = [letter_choice(f"{intro} Which letter shows {ask}?", key, wrong)]
    other = rng.choice(sorted(L for L in proc if L != key))
    qs.append(mcq(rng.choice(["What process does arrow {L} show?"]).format(L=other), proc[other],
                  CONFUSED[proc[other]], rng))
    if p["blank"]:
        qs.append(mcq("One rock box shows Rock X in place of its name. Which type of rock is X?",
                      ROCKS[p["blank"]], [v for k, v in ROCKS.items() if k != p["blank"]], rng))
    else:
        into = sorted(L for L, (f, t) in pairs.items() if t in ROCKS and L not in (key, other))
        L = rng.choice(into)
        to = pairs[L][1]
        qs.append(mcq(f"Which type of rock does the process at arrow {L} form?", ROCKS[to],
                      [v for k, v in ROCKS.items() if k != to], rng))
    return qs
