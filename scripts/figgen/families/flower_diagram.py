"""Half-flower (LS, UP): a flower cut in half from top to bottom (L.S.), drawn as textbooks draw it: the stalk and
receptacle, a sepal and a petal on each side, a stamen on each side (anther on a filament), and in the middle the
carpel (stigma, style and an ovary cut open to show its ovules). Two kinds:

- insect-pollinated: large, brightly coloured petals, a nectary at the base of each, anthers and a sticky stigma
  inside the flower;
- wind-pollinated: small dull petals, no nectary, anthers hanging outside the flower on long filaments, feathery
  stigmas hanging out.

Five or six parts are lettered, always the anther: which letter is a named part, or the job of the part at a letter;
which kind of flower it is, and the feature drawn that shows it; and where pollen grains are made.
"""
from __future__ import annotations

import math
import random

from ..core import INK, NAMES, Question, new_figure
from ._bio_parts import ellipse, letter, letter_choice, letters_for, part, spline, tube

ID = "flower_diagram"
KIND = "diagram.template"
SUBJECT = "biology"
BANDS = ("LS", "UP")
CONCEPTS = tuple(f"biology.{c}" for c in ("flower-structure", "sexual-reproduction", "fertilisation-seed-formation"))
# Integrated Science teaches the parts of a flower and pollination too (P3n).
ALSO = tuple(f"science.{c}" for c in ("plant-reproduction", "pollination", "flowering-plants"))
# A topic whose sections the book lists is reached only if one names flowers or pollination.
NEEDS = r"flower|pollinat"
AVOID = r"asexual"

JOB = {
    "anther": "makes pollen grains",
    "filament": "holds the anther up",
    "stigma": "catches pollen grains during pollination",
    "style": "holds up the stigma; the pollen tube grows down through it",
    "ovary": "contains the ovules, and becomes the fruit",
    "ovule": "contains a female gamete, and becomes a seed",
    "petal": "attracts insects with its colour",
    "sepal": "protects the flower while it is a bud",
    "nectary": "makes sugary nectar that insects feed on",
}
CONFUSE = {"stigma": ["anther", "style", "ovary"], "style": ["filament", "stigma", "ovary"], "ovary": ["ovule", "nectary", "style"],
           "ovule": ["ovary", "anther", "nectary"], "filament": ["style", "anther", "petal"], "petal": ["sepal", "anther", "nectary"],
           "sepal": ["petal", "ovary", "nectary"], "nectary": ["ovule", "ovary", "sepal"]}
JOB_CONFUSE = {"filament": ["style", "anther", "sepal"], "stigma": ["anther", "style", "ovule"], "style": ["filament", "stigma", "ovary"],
               "ovary": ["ovule", "anther", "style"], "ovule": ["ovary", "anther", "stigma"], "petal": ["sepal", "nectary", "anther"],
               "sepal": ["petal", "ovary", "filament"], "nectary": ["petal", "anther", "ovary"]}
PETALS = {"yellow": "#f4d77a", "pink": "#f2a9c4", "purple": "#cdb0ea", "orange": "#f6b97a"}
TYPE = {
    "insect": "Insect-pollinated: it has large petals and a nectary, and its anthers and stigma are inside the flower",
    "wind": "Wind-pollinated: its anthers and feathery stigmas hang outside the flower, and its petals are small",
}
TYPE_WRONG = {
    "insect": ["Wind-pollinated: it has large petals and a nectary",
               "Wind-pollinated: its anthers and feathery stigmas hang outside the flower",
               "Insect-pollinated: its anthers and feathery stigmas hang outside the flower"],
    "wind": ["Insect-pollinated: its anthers and feathery stigmas hang outside the flower",
             "Insect-pollinated: it has large petals and a nectary",
             "Wind-pollinated: it has large petals and a nectary"],
}


def sample(rng: random.Random) -> dict:
    kind = rng.choice(["insect", "wind"])
    # a wind-pollinated flower's small petals sit inside the arch of its stamens, where no leader reaches them cleanly
    pool = ["filament", "stigma", "style", "ovary", "ovule", "sepal"] + (["petal", "nectary"] if kind == "insect" else [])
    chosen = ["anther"] + rng.sample(pool, rng.choice([4, 5]))
    labels = letters_for(chosen, rng)
    colour = rng.choice(sorted(PETALS)) if kind == "insect" else "green"
    return {"band": rng.choice(BANDS), "kind": kind, "colour": colour, "labels": dict(sorted(labels.items()))}


# --- drawing ----------------------------------------------------------------------------------------

GREEN, PALE, CARPEL = "#9cc58a", "#cfe3bd", "#d7e8c3"
STALK = [(-0.22, 0.0), (0.22, 0.0), (0.22, 1.85), (-0.22, 1.85)]
RECEPTACLE = [(-1.35, 2.45), (-0.9, 1.95), (-0.25, 1.75), (0.25, 1.75), (0.9, 1.95), (1.35, 2.45), (0.9, 2.65), (-0.9, 2.65)]
SEPAL = [(1.1, 2.35), (1.95, 2.3), (2.95, 1.7), (2.05, 1.8), (1.15, 2.05)]
OVARY = [(0, 2.6), (0.55, 2.72), (0.86, 3.3), (0.66, 4.0), (0.2, 4.35), (-0.2, 4.35), (-0.66, 4.0), (-0.86, 3.3), (-0.55, 2.72)]
CAVITY = [(0, 2.98), (0.42, 3.05), (0.58, 3.45), (0.45, 3.9), (0, 4.05), (-0.45, 3.9), (-0.58, 3.45), (-0.42, 3.05)]
OVULES = [(0.3, 3.3), (0.3, 3.75)]
STIGMA_KNOB = [(-0.45, 7.0), (-0.5, 7.3), (-0.25, 7.5), (0, 7.36), (0.25, 7.5), (0.5, 7.3), (0.45, 7.0), (0, 6.9)]
INSECT = {
    "petal": [(1.25, 2.45), (2.7, 3.05), (4.1, 4.5), (4.95, 6.3), (4.9, 7.45), (4.15, 6.95), (3.35, 5.4), (2.3, 3.9), (1.05, 2.65)],
    "filament": [(1.25, 2.55), (1.3, 3.6), (1.5, 4.5), (1.68, 5.25)],
    "anther": (1.7, 5.65, 0.22, 0.42),
    "nectary": (0.95, 2.62, 0.15, 0.11),
    "style_top": 6.95,
}
WIND = {
    "petal": [(1.0, 2.5), (1.5, 2.9), (1.95, 3.7), (1.75, 3.75), (1.3, 3.2), (0.9, 2.7)],
    "filament": [(0.75, 2.6), (0.95, 3.4), (1.6, 4.1), (2.6, 4.3), (3.3, 4.0), (3.6, 3.35)],
    "anther": (3.62, 2.85, 0.24, 0.5),
    "stigma": [(0.08, 5.0), (0.55, 5.9), (1.2, 6.8), (2.0, 7.55)],
    "style_top": 5.05,
}


def _mirror(pts):
    return [(-x, y) for x, y in pts]


def _at(path, y):
    """The point on a polyline at height y (the first segment that reaches it)."""
    for (x0, y0), (x1, y1) in zip(path, path[1:]):
        if (y0 - y) * (y1 - y) <= 0 and y0 != y1:
            return (x0 + (y - y0) / (y1 - y0) * (x1 - x0), y)
    raise ValueError(y)


def _slots(kind: str) -> dict:
    """Where each part's letter sits and where its leader ends, on the part."""
    R = 5.6
    if kind == "insect":
        return {"stigma": ((0, 8.55), (0, 7.25)), "style": ((2.6, 8.6), (0.0, 6.3)), "ovule": ((-2.3, 8.5), (-0.3, 3.75)),
                "ovary": ((-1.3, 0.35), (-0.52, 2.95)), "nectary": ((0.75, 0.3), (0.95, 2.62)), "petal": ((R, 6.2), (4.4, 6.2)),
                "anther": ((R, 5.1), (1.75, 5.5)), "filament": ((R, 4.0), _at(INSECT["filament"], 4.0)),
                "sepal": ((R, 1.7), (2.1, 2.0))}
    fil = spline(WIND["filament"], closed=False, per=10)
    return {"stigma": ((R, 6.9), _at(spline(WIND["stigma"], closed=False, per=10), 6.9)), "style": ((R, 4.75), (0.0, 4.75)),
            "filament": ((R, 3.95), _at(fil[len(fil) * 3 // 4:], 3.85)), "anther": ((R, 2.85), (3.62, 2.85)),
            "sepal": ((R, 1.7), (2.1, 2.0)), "ovule": ((-3.0, 6.6), (-0.3, 3.75)), "ovary": ((-1.3, 0.35), (-0.52, 2.95))}


def _feathery(ax, path) -> None:
    """A feathery stigma: a thin branch with fine hairs along both sides."""
    line = spline(path, closed=False, per=10)
    part(ax, tube(line, 0.13), "stigma", "#e6efd8", lw=1.0, z=3.3)
    total = sum(math.dist(a, b) for a, b in zip(line, line[1:]))
    done, step, nxt = 0.0, 0.17, 0.35
    for a, b in zip(line, line[1:]):
        seg = math.dist(a, b)
        while nxt <= done + seg and nxt < total - 0.05:
            t = (nxt - done) / seg
            x, y = a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])
            ux, uy = (b[0] - a[0]) / seg, (b[1] - a[1]) / seg
            for s in (1, -1):  # each hair leans forward, like a feather's barbs
                hx, hy = -uy * s * 0.3 + ux * 0.12, ux * s * 0.3 + uy * 0.12
                ax.plot([x, x + hx], [y, y + hy], color=INK, linewidth=0.7, zorder=3.25, gid="stigma-hair")
            nxt += step
        done += seg


def draw(p: dict):
    kind = p["kind"]
    shape = INSECT if kind == "insect" else WIND
    fig, ax = new_figure(6.6, 6.0)
    from matplotlib.patches import Polygon
    ax.add_patch(Polygon(STALK, closed=True, facecolor=GREEN, edgecolor=INK, linewidth=1.2, zorder=1, gid="stalk"))
    ax.add_patch(Polygon(spline(RECEPTACLE, per=8), closed=True, facecolor=PALE, edgecolor=INK, linewidth=1.2, zorder=1.2,
                         gid="receptacle"))
    petal_face = PETALS.get(p["colour"], "#cfe0b4")
    for flip in (lambda q: q, _mirror):
        part(ax, spline(flip(SEPAL), per=8), "sepal", GREEN, z=1.5)
        part(ax, spline(flip(shape["petal"]), per=10), "petal", petal_face, z=2)
        part(ax, tube(spline(flip(shape["filament"]), closed=False, per=10), 0.11), "filament", "#f7f2df", lw=1.0, z=2.6)
        x, y, rx, ry = shape["anther"]
        x = flip([(x, y)])[0][0]
        part(ax, ellipse(x, y, rx, ry), "anther", "#e9c25a", z=2.7)
        ax.plot([x, x], [y - ry * 0.75, y + ry * 0.75], color=INK, linewidth=0.8, zorder=2.75)  # the two pollen sacs
        if kind == "insect":
            nx, ny, nrx, nry = shape["nectary"]
            part(ax, ellipse(flip([(nx, ny)])[0][0], ny, nrx, nry), "nectary", "#e0a93b", lw=1.0, z=2.5)
    # the carpel: ovary cut open on its ovules, the style, and the stigma
    part(ax, spline(OVARY, per=8), "ovary", CARPEL, z=3)
    ax.add_patch(Polygon(spline(CAVITY, per=8), closed=True, facecolor="white", edgecolor=INK, linewidth=1.0, zorder=3.1, gid="cavity"))
    for ox, oy in OVULES:
        for sx in (1, -1):
            ax.plot([sx * (ox + 0.14), sx * 0.56], [oy, oy], color=INK, linewidth=1.0, zorder=3.15)  # its stalk to the wall
            part(ax, ellipse(sx * ox, oy, 0.14, 0.18), "ovule", "#f3e3a6", lw=1.0, z=3.2)
    style = [(0, 4.2), (0, shape["style_top"])]
    part(ax, tube(style, 0.24), "style", CARPEL, lw=1.0, z=3.05)
    if kind == "insect":
        part(ax, spline(STIGMA_KNOB, per=8), "stigma", "#bfd99a", z=3.3)
    else:
        _feathery(ax, WIND["stigma"])
        _feathery(ax, _mirror(WIND["stigma"]))
    slots = _slots(kind)
    for L, name in p["labels"].items():
        at, end = slots[name]
        letter(ax, L, at, end, gap=0.32)
    ax.set_xlim(-6.2, 6.2)
    ax.set_ylim(-0.3, 9.1)
    ax.set_aspect("equal")
    ax.axis("off")
    ax.set_title("Half-flower: a flower cut in half from top to bottom", fontsize=12)
    return fig


# --- questions --------------------------------------------------------------------------------------

INTROS = ["{name} cut a flower in half {setting} and drew this half-flower.", "{name} drew this half-flower {setting}.",
          "{name} is studying this drawing of a flower cut in half {setting}.",
          "{name} made this drawing of a half-flower {setting}."]
SETTINGS = ["in a biology practical in Huye", "in the school garden in Kigali", "during a lesson on pollination",
            "for a revision poster", "at the science club in Nyanza", "on a field trip near Musanze", "for homework",
            "from a flower picked near Lake Kivu"]


def _cap(s: str) -> str:
    return s[0].upper() + s[1:]


def questions(p: dict, rng: random.Random) -> list:
    labels, kind = p["labels"], p["kind"]
    at = {v: k for k, v in labels.items()}
    rest = lambda *keep: [k for k in labels if k not in keep]  # noqa: E731
    intro = rng.choice(INTROS).format(name=rng.choice(NAMES), setting=rng.choice(SETTINGS))
    ask = rng.choice(sorted(x for x in at if x != "anther"))
    if rng.random() < 0.5:
        wrong = [at[c] for c in CONFUSE[ask] if c in at] + rng.sample(rest(at[ask]), len(labels) - 1)
        qs = [letter_choice(f"{intro} Which letter shows the {ask}?", at[ask], wrong)]
    else:
        options = [_cap(JOB[ask])] + [_cap(JOB[c]) for c in JOB_CONFUSE[ask]]
        rng.shuffle(options)
        qs = [Question("mcq", f"{intro} What is the job of the part labelled {at[ask]}?", str(options.index(_cap(JOB[ask]))), options)]
    options = [TYPE[kind]] + TYPE_WRONG[kind]
    rng.shuffle(options)
    qs.append(Question("mcq", rng.choice(["What type of flower is this, and which feature in the drawing shows it?",
                                          "Which type of flower is this, and how does the drawing show it?"]),
                       str(options.index(TYPE[kind])), options))
    wrong = [at[c] for c in ("stigma", "ovule", "ovary", "filament") if c in at] + rest(at["anther"])
    qs.append(letter_choice(rng.choice(["Which letter shows where pollen grains are made?",
                                        "Which letter shows the part where pollen grains are made?"]), at["anther"], wrong))
    return qs
