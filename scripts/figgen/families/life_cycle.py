"""Life cycles (LS, UP): the stages of an organism in boxes round a ring, joined clockwise by arrows, one box shown as
"?", and beside it a list of stages to choose from: the organism's own and three that belong to no stage of its cycle
(a nymph for a mosquito, a pupa for a frog, a tuber for a bean). Organisms a student in Rwanda knows: the Anopheles
mosquito that spreads malaria, the housefly, a butterfly, a frog, maize and the bean.

Which stage goes in the "?" box (chosen from the list, the wrong choices never a stage of this cycle); how many
stages the cycle has; which stage comes just before a named one (both shown, so the arrows answer it).
"""
from __future__ import annotations

import math
import random

from ..core import NAMES, count, mcq, new_figure
from . import _cycle as cy

ID = "life_cycle"
KIND = "process.flow"
SUBJECT = "biology"
BANDS = ("LS", "UP")
# Insects are arthropods and the frog a chordate (an amphibian): life cycles are taught with those phyla, with
# metamorphosis, and (for plants) with sexual reproduction, fertilisation, seeds and germination.
GROUPS = {"insect": ("metamorphosis-growth-insects-amphibians", "phylum-arthropoda"),
          "amphibian": ("metamorphosis-growth-insects-amphibians", "phylum-chordata"),
          "plant": ("fertilisation-seed-formation", "germination-types-stages", "sexual-reproduction")}
CONCEPTS = tuple(sorted({f"biology.{c}" for g in GROUPS.values() for c in g}))
# A topic whose sections the book lists is reached only if one names life cycles, metamorphosis, the phylum, or
# sexual reproduction and germination in plants ("asexual reproduction" is not; neither is a microbe's life cycle).
NEEDS = r"life cycle|metamorphosis|arthropod|chordat|amphibian|insects?\b|(?<!a)sexual reproduc|germination|fertili[sz]ation and seed"
AVOID = r"microbiolog|culturing|virus|bacteri|human|mitosis|meiosis|\bcells?\b|immun|disease"

ORGANISMS = {
    "mosquito": ("insect", ["egg", "larva", "pupa", "adult"], ["nymph", "caterpillar", "tadpole", "maggot", "chrysalis"]),
    "housefly": ("insect", ["egg", "larva", "pupa", "adult"], ["nymph", "caterpillar", "tadpole", "chrysalis"]),
    "butterfly": ("insect", ["egg", "caterpillar", "chrysalis", "adult"], ["nymph", "maggot", "tadpole", "froglet"]),
    "frog": ("amphibian", ["frogspawn", "tadpole", "froglet", "adult frog"], ["pupa", "nymph", "caterpillar", "chrysalis", "maggot"]),
    "maize": ("plant", ["grain", "seedling", "young plant", "flowering plant", "ripe cob"], ["spore", "tuber", "bulb", "pupa"]),
    "bean": ("plant", ["seed", "seedling", "adult plant", "flower", "pod"], ["spore", "tuber", "bulb", "pupa", "pollen grain"]),
}
TITLES = {"mosquito": "Life cycle of a mosquito", "housefly": "Life cycle of a housefly", "butterfly": "Life cycle of a butterfly",
          "frog": "Life cycle of a frog", "maize": "Life cycle of a maize plant", "bean": "Life cycle of a bean plant"}
BOX_W, BOX_H = 2.3, 0.62
CENTRE = (3.3, 2.45)
RADII = {4: (2.45, 1.8), 5: (2.95, 1.95)}  # five boxes need a wider ring, or the bottom two nearly touch
ROW, BANK_W = 0.44, 2.9
SCALE = 0.6


def concepts_for(p: dict) -> tuple:
    return tuple(f"biology.{c}" for c in GROUPS[ORGANISMS[p["organism"]][0]])


def sample(rng: random.Random) -> dict:
    organism = rng.choice(sorted(ORGANISMS))
    _, stages, decoys = ORGANISMS[organism]
    n = len(stages)
    hidden = rng.randrange(n)
    bank = stages + rng.sample(decoys, 3)
    rng.shuffle(bank)
    return {"band": rng.choice(BANDS), "organism": organism, "start": rng.randrange(n), "hidden": hidden, "bank": bank}


def places(n: int) -> list:
    """Box centres round the ring, clockwise from the top."""
    rx, ry = RADII[n]
    return [(CENTRE[0] + rx * math.cos(math.radians(90 - k * 360 / n)),
             CENTRE[1] + ry * math.sin(math.radians(90 - k * 360 / n))) for k in range(n)]


def draw(p: dict):
    _, stages, _ = ORGANISMS[p["organism"]]
    n = len(stages)
    fig, ax = new_figure()
    rects = [cy.rect(x, y, BOX_W, BOX_H) for x, y in places(n)]
    for k, r in enumerate(rects):
        stage = (p["start"] + k) % n
        hidden = stage == p["hidden"]
        words = "?" if hidden else stages[stage]
        cy.draw_box(ax, str(k), r, words, 15 if hidden else 10.5)
        ax.texts[-1].set_gid(f"stage:{k}")
        if hidden:
            ax.texts[-1].set_fontweight("bold")
    for k in range(n):
        a, b = rects[k], rects[(k + 1) % n]
        start, end = cy.edge_toward(a, cy.centre(b)), cy.edge_toward(b, cy.centre(a))
        ax.annotate("", xy=end, xytext=start, gid=f"arrow:{k}",
                    arrowprops={"arrowstyle": "-|>", "color": "#111111", "linewidth": 1.5, "mutation_scale": 15,
                                "shrinkA": 1, "shrinkB": 1, "connectionstyle": "arc3,rad=-0.25"})
    rx, ry = RADII[n]
    ax.text(CENTRE[0], CENTRE[1] + ry + BOX_H / 2 + 0.45, TITLES[p["organism"]], ha="center", va="center", fontsize=11.5,
            fontweight="bold")
    # The list of stages to choose from, beside the ring.
    from matplotlib.patches import Rectangle
    from ..core import INK
    x0 = CENTRE[0] + rx + BOX_W / 2 + 0.5
    rows = len(p["bank"])
    top = CENTRE[1] + ROW * rows / 2
    bottom = top - ROW * rows - 0.3
    ax.add_patch(Rectangle((x0, bottom), BANK_W, top + 0.35 - bottom, facecolor="white", edgecolor=INK, linewidth=1.0))
    ax.text(x0 + 0.18, top, "Choose from:", ha="left", va="center", fontsize=9.5, fontweight="bold", gid="bank:head")
    for i, word in enumerate(p["bank"]):
        ax.text(x0 + 0.3, top - ROW * (i + 1), word, ha="left", va="center", fontsize=10, gid=f"bank:{i}")
    xlim = (CENTRE[0] - rx - BOX_W / 2 - 0.15, x0 + BANK_W + 0.15)
    ylim = (min(CENTRE[1] - ry - BOX_H / 2, bottom) - 0.2, max(CENTRE[1] + ry + BOX_H / 2 + 0.75, top + 0.5))
    cy.fit(fig, ax, xlim, ylim, SCALE)
    return fig


SETTINGS = {"mosquito": ["for a lesson on stopping malaria", "for the school health club in Nyagatare",
                         "after a talk on malaria at the health centre", "for a poster on mosquito nets"],
            "housefly": ["for a lesson on hygiene", "for the school health club", "for a poster on keeping food clean"],
            "butterfly": ["after a walk in Nyungwe Forest", "for the school garden club", "in a biology lesson"],
            "frog": ["after a visit to the wetland at Nyandungu", "in a biology lesson", "after a trip to a pond near Rubavu"],
            "maize": ["on a farm near Musanze", "for the school garden club", "for an agriculture lesson"],
            "bean": ["in the school garden in Huye", "for an agriculture lesson", "on a farm near Nyanza"]}
VERBS = ["drew", "copied", "sketched"]
CALLED = {"mosquito": "an Anopheles mosquito", "housefly": "a housefly", "butterfly": "a butterfly", "frog": "a frog",
          "maize": "maize", "bean": "a bean plant"}


def questions(p: dict, rng: random.Random) -> list:
    _, stages, decoys = ORGANISMS[p["organism"]]
    n = len(stages)
    h = p["hidden"]
    who = rng.choice(NAMES)
    wrong = [w for w in p["bank"] if w not in stages]
    qs = [mcq(f"{who} {rng.choice(VERBS)} the life cycle of {CALLED[p['organism']]} {rng.choice(SETTINGS[p['organism']])}. "
              "Which stage from the list goes in the box with the question mark?", stages[h], wrong, rng)]
    qs.append(count("How many stages are there in this life cycle?", n, "stages"))
    # A stage whose box and the box before it are both shown.
    x = rng.choice([k for k in range(n) if k != h and (k - 1) % n != h])
    before, after = stages[(x - 1) % n], stages[(x + 1) % n]
    rest = [s for s in stages if s not in (stages[x], before, after)]
    rng.shuffle(rest)
    qs.append(mcq(f"Which stage comes just before the {stages[x]}?", before, [after] + rest, rng))
    return qs
