"""Our senses (P): the parts of the body we sense with, of two kinds.

- organs (stages 1-4): four sense organs drawn as big simple pictures in boxes lettered A to D (an eye, an ear, a nose,
  a tongue poking out of a mouth, a hand), never named. Which letter shows the part you use to hear a drum or taste a
  lemon; what you do with the part at a letter (see, hear, smell, taste, feel).
- eye (stages 3-4): one eye from the front, as big as the page allows: eyebrow, eyelid, eyelashes, iris and pupil,
  four of them lettered by leader lines that end on their part, with a table of what each lettered part does (named, so
  the table never gives the letter). Which letter shows the part that does a job the table states; what the part at a
  letter is called.

Every key comes from the fixed tables below, which a Primary teacher would agree with.
"""
from __future__ import annotations

import math
import random

from matplotlib.patches import Circle, Ellipse, FancyBboxPatch, Polygon, Rectangle

from ..core import INK, NAMES, Question, mcq, new_figure

ID = "senses_p"
KIND = "diagram.template"
SUBJECT = "science"
BANDS = ("P",)
CONCEPTS = tuple(f"science.{c}" for c in ("human-sensory-systems", "sight-and-eye", "hearing-and-ear", "smell-and-taste",
                                          "skin-and-touch"))
# A topic whose sections the book lists is reached only if its name or a section names the senses, a sense organ or
# the parts of the head.
NEEDS = r"senses|sensory|our ears|hearing|taste|smell|\btouch\b|\bsight\b|\beyes?\b|parts of the head"
AVOID = (r"\bcells?\b|reproduct|circulat|digest|science in context|glossary|sexual|\bHIV\b|STIs|pregnan|programming|"
         r"computer|light and the solar|social factors")

SENSE = {"eye": "see", "ear": "hear", "nose": "smell", "tongue": "taste", "hand": "feel"}
THINGS = {"see": ["see a rainbow", "see the colours of a flower", "read a book"],
          "hear": ["hear a drum", "hear a bird sing", "hear the school bell"],
          "smell": ["smell a flower", "smell bread baking", "smell smoke from a fire"],
          "taste": ["taste a lemon", "taste salt in food", "taste sweet honey"],
          "feel": ["feel a hot cup", "feel soft cotton wool", "feel a rough stone"]}
PARTS = ["eyebrow", "eyelid", "eyelashes", "iris", "pupil"]
JOB = {"eyebrow": "stops sweat running into the eye", "eyelid": "closes to keep out dust and bright light",
       "eyelashes": "catch dust before it gets into the eye",
       "iris": "the coloured ring that makes the pupil bigger or smaller",
       "pupil": "the hole that lets light into the eye"}
# How a question names a part by its job.
ASK = {"eyebrow": "the part that stops sweat running into the eye",
       "eyelid": "the part that closes to keep out dust and bright light",
       "eyelashes": "the hairs that catch dust before it gets into the eye",
       "iris": "the coloured ring that makes the pupil bigger or smaller",
       "pupil": "the hole that lets light into the eye"}

SKIN = "#c68642"
LIP = "#a0522d"
TONGUE = "#f1948a"
IRIS = "#7e5109"


def concepts_for(p: dict) -> tuple[str, ...]:
    if p["kind"] == "eye":
        return ("science.human-sensory-systems", "science.sight-and-eye")
    return CONCEPTS


def stages(p: dict) -> tuple[int, int]:
    return (1, 4) if p["kind"] == "organs" else (3, 4)


def sample(rng: random.Random) -> dict:
    kind = rng.choice(["organs", "organs", "eye"])
    if kind == "organs":
        return {"band": "P", "kind": "organs", "organs": rng.sample(sorted(SENSE), 4)}
    return {"band": "P", "kind": "eye", "parts": rng.sample(PARTS, 4)}


# --- the organs ---------------------------------------------------------------------------------------------

def _eye_small(ax, cx, cy, s):
    up = [(cx + s * x, cy + s * 0.45 * math.cos(x * math.pi / 2)) for x in [i / 20 - 1 for i in range(41)]]
    low = [(cx + s * x, cy - s * 0.38 * math.cos(x * math.pi / 2)) for x in [1 - i / 20 for i in range(41)]]
    ax.add_patch(Polygon(up + low, closed=True, facecolor="white", edgecolor=INK, linewidth=1.6, zorder=3))
    ax.add_patch(Circle((cx, cy), 0.33 * s, facecolor=IRIS, edgecolor=INK, linewidth=1.2, zorder=4))
    ax.add_patch(Circle((cx, cy), 0.14 * s, facecolor=INK, edgecolor=INK, zorder=5))
    ax.add_patch(Circle((cx + 0.08 * s, cy + 0.08 * s), 0.05 * s, facecolor="white", edgecolor="none", zorder=6))
    for x in (-0.6, -0.3, 0.0, 0.3, 0.6):
        y = 0.45 * math.cos(x * math.pi / 2)
        ax.plot([cx + s * x, cx + s * x * 1.15], [cy + s * y, cy + s * (y + 0.2)], color=INK, linewidth=1.4, zorder=3)
    br = [(cx + s * x, cy + s * (0.85 + 0.18 * math.cos(x * math.pi / 2))) for x in [i / 10 - 1 for i in range(21)]]
    ax.plot([u for u, _ in br], [v for _, v in br], color="#3e2723", linewidth=5, solid_capstyle="round", zorder=3)


def _ear(ax, cx, cy, s):
    """An ear from the side: a tall rounded shell with a soft lobe, the rim curling in, and the dark hole."""
    outer = [(cx + s * 0.5 * math.cos(math.radians(a)), cy + 0.15 * s + s * 0.72 * math.sin(math.radians(a)))
             for a in range(-90, 271, 6)]
    ax.add_patch(Polygon(outer, closed=True, facecolor=SKIN, edgecolor=INK, linewidth=1.6, zorder=3))
    ax.add_patch(Ellipse((cx - 0.02 * s, cy - 0.62 * s), 0.42 * s, 0.4 * s, facecolor=SKIN, edgecolor=INK,
                         linewidth=1.6, zorder=2.9))
    rim = [(cx + s * 0.34 * math.cos(math.radians(a)), cy + 0.2 * s + s * 0.52 * math.sin(math.radians(a)))
           for a in range(-40, 215, 8)]
    ax.plot([u for u, _ in rim], [v for _, v in rim], color=INK, linewidth=1.6, zorder=4)
    ax.add_patch(Ellipse((cx + 0.02 * s, cy - 0.02 * s), 0.22 * s, 0.3 * s, facecolor="#4e342e", edgecolor=INK,
                         linewidth=1.0, zorder=4))


def _nose(ax, cx, cy, s):
    pts = [(cx - 0.12 * s, cy + 0.85 * s), (cx + 0.12 * s, cy + 0.85 * s), (cx + 0.22 * s, cy - 0.1 * s),
           (cx + 0.5 * s, cy - 0.35 * s), (cx + 0.45 * s, cy - 0.62 * s), (cx, cy - 0.7 * s),
           (cx - 0.45 * s, cy - 0.62 * s), (cx - 0.5 * s, cy - 0.35 * s), (cx - 0.22 * s, cy - 0.1 * s)]
    ax.add_patch(Polygon(pts, closed=True, facecolor=SKIN, edgecolor=INK, linewidth=1.6, joinstyle="round", zorder=3))
    for dx in (-0.2, 0.2):
        ax.add_patch(Ellipse((cx + dx * s, cy - 0.52 * s), 0.2 * s, 0.11 * s, facecolor="#3e2723", edgecolor=INK,
                             linewidth=1.0, zorder=4))


def _tongue(ax, cx, cy, s):
    ax.add_patch(Ellipse((cx, cy + 0.25 * s), 1.3 * s, 0.75 * s, facecolor=LIP, edgecolor=INK, linewidth=1.6, zorder=3))
    ax.add_patch(Ellipse((cx, cy + 0.25 * s), 0.95 * s, 0.42 * s, facecolor="#4a1c1c", edgecolor=INK, linewidth=1.0,
                         zorder=4))
    tongue = [(cx - 0.32 * s, cy + 0.2 * s)] + [(cx + 0.32 * s * math.cos(math.radians(a)), cy - 0.35 * s +
                                                 0.38 * s * math.sin(math.radians(a))) for a in range(180, 361, 10)]
    tongue += [(cx + 0.32 * s, cy + 0.2 * s)]
    ax.add_patch(Polygon(tongue, closed=True, facecolor=TONGUE, edgecolor=INK, linewidth=1.4, zorder=5))
    ax.plot([cx, cx], [cy + 0.12 * s, cy - 0.45 * s], color="#c0392b", linewidth=1.2, zorder=6)


def _hand(ax, cx, cy, s):
    def box(x, y, w, h, angle=0.0):
        ax.add_patch(FancyBboxPatch((cx + x * s, cy + y * s), w * s, h * s, boxstyle=f"round,pad=0,rounding_size={0.1 * s}",
                                    facecolor=SKIN, edgecolor=INK, linewidth=1.4, zorder=3))

    box(-0.4, -0.85, 0.8, 0.85)
    for i, (x, h) in enumerate(((-0.4, 0.62), (-0.19, 0.75), (0.02, 0.72), (0.23, 0.58))):
        box(x, -0.08, 0.18, h)
    thumb = [(cx - 0.38 * s, cy - 0.25 * s), (cx - 0.38 * s, cy - 0.55 * s), (cx - 0.75 * s, cy - 0.12 * s),
             (cx - 0.62 * s, cy + 0.0 * s)]
    ax.add_patch(Polygon(thumb, closed=True, facecolor=SKIN, edgecolor=INK, linewidth=1.4, joinstyle="round", zorder=3))


DRAW = {"eye": _eye_small, "ear": _ear, "nose": _nose, "tongue": _tongue, "hand": _hand}
BOX, GAP = 2.6, 0.35


def _draw_organs(p: dict):
    fig, ax = new_figure(9.6, 3.0)
    for i, organ in enumerate(p["organs"]):
        x0 = i * (BOX + GAP)
        ax.add_patch(FancyBboxPatch((x0, 0), BOX, BOX, boxstyle="round,pad=0,rounding_size=0.15", facecolor="#fbfbf6",
                                    edgecolor=INK, linewidth=1.4, zorder=1, gid=f"box:{i}"))
        DRAW[organ](ax, x0 + BOX / 2 + 0.1, BOX / 2 - 0.12, 0.95)
        ax.add_patch(Circle((x0 + 0.36, BOX - 0.36), 0.25, facecolor="white", edgecolor=INK, linewidth=1.6, zorder=7,
                            gid=f"ring:{i}"))
        ax.text(x0 + 0.36, BOX - 0.36, "ABCD"[i], ha="center", va="center", fontsize=15, fontweight="bold", zorder=8,
                gid=f"letter:{'ABCD'[i]}")
    ax.set_xlim(-0.05, 4 * BOX + 3 * GAP + 0.05)
    ax.set_ylim(-0.05, BOX + 0.05)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


# --- one eye ------------------------------------------------------------------------------------------------

W, UP, LOW, R_IRIS, R_PUPIL = 1.6, 0.7, 0.58, 0.52, 0.2
LASHES, LASH = [-1.2 + 0.3 * k for k in range(9)], 0.26


def _upper(x: float) -> float:
    return UP * math.cos(x / W * math.pi / 2)


def _crease(x: float) -> float:
    return 1.0 * math.cos(x / 1.75 * math.pi / 2) + 0.05


def _brow(x: float) -> float:
    return 1.38 + 0.25 * math.cos(x / 1.9 * math.pi / 2)


# Where each part's leader ends, on the part, and where its letter sits.
ANCHOR = {"eyebrow": (-1.0, _brow(-1.0)), "eyelid": (1.05, (_upper(1.05) + _crease(1.05)) / 2),
          "eyelashes": (-0.6 * 1.04, _upper(-0.6) + LASH / 2), "iris": (0.38, -0.2), "pupil": (0.0, 0.0)}
SLOT = {"eyebrow": (-2.8, 1.7), "eyelashes": (-2.8, 0.75), "pupil": (-2.8, -0.65), "eyelid": (2.8, 1.25),
        "iris": (2.8, -0.65)}


def _draw_eye(p: dict):
    fig, ax = new_figure(8.4, 6.6)
    xs = [W * (i / 40 - 0.5) * 2 for i in range(41)]
    ax.add_patch(FancyBboxPatch((-2.2, -1.0), 4.4, 3.1, boxstyle="round,pad=0,rounding_size=0.4", facecolor=SKIN,
                                edgecolor="none", zorder=0.5))
    up = [(x, _upper(x)) for x in xs]
    low = [(x, -LOW * math.cos(x / W * math.pi / 2)) for x in reversed(xs)]
    ax.add_patch(Polygon(up + low, closed=True, facecolor="white", edgecolor=INK, linewidth=2.0, zorder=2))
    ax.add_patch(Circle((0, 0), R_IRIS, facecolor=IRIS, edgecolor=INK, linewidth=1.5, zorder=3))
    ax.add_patch(Circle((0, 0), R_PUPIL, facecolor=INK, edgecolor=INK, zorder=4))
    ax.add_patch(Circle((0.08, 0.08), 0.06, facecolor="white", edgecolor="none", zorder=5))
    cx = [1.75 * (i / 40 - 0.5) * 2 for i in range(41)]
    ax.plot(cx, [_crease(x) for x in cx], color=INK, linewidth=1.5, zorder=2)
    for x in LASHES:
        y = _upper(x)
        ax.plot([x, x * 1.08], [y, y + LASH], color=INK, linewidth=2.0, zorder=2.5)
    bx = [1.9 * (i / 30 - 0.5) * 2 for i in range(31)]
    ax.plot(bx, [_brow(x) for x in bx], color="#3e2723", linewidth=9, solid_capstyle="round", zorder=2)
    for part in p["parts"]:
        letter = "ABCD"[p["parts"].index(part)]
        (lx, ly), (ax_, ay) = SLOT[part], ANCHOR[part]
        d = math.hypot(ax_ - lx, ay - ly)
        ux, uy = (ax_ - lx) / d, (ay - ly) / d
        ax.plot([lx + ux * 0.3, ax_], [ly + uy * 0.3, ay], color=INK, linewidth=1.3, zorder=6, gid=f"leader:{letter}")
        ax.add_patch(Circle((ax_, ay), 0.05, facecolor=INK, edgecolor=INK, zorder=6))
        ax.add_patch(Circle((lx, ly), 0.25, facecolor="white", edgecolor=INK, linewidth=1.5, zorder=7, gid=f"ring:{letter}"))
        ax.text(lx, ly, letter, ha="center", va="center", fontsize=15, fontweight="bold", zorder=8, gid=f"letter:{letter}")
    # the table: each lettered part's name and what it does, in the order of the five parts, never by letter
    y0 = -1.55
    ax.text(-3.1, y0, "Part", ha="left", va="center", fontsize=12, fontweight="bold")
    ax.text(-1.3, y0, "What it does", ha="left", va="center", fontsize=12, fontweight="bold")
    ax.plot([-3.15, 4.3], [y0 - 0.25, y0 - 0.25], color=INK, linewidth=1.0)
    for j, part in enumerate(k for k in PARTS if k in p["parts"]):
        y = y0 - 0.58 - 0.48 * j
        ax.text(-3.1, y, part.capitalize(), ha="left", va="center", fontsize=11.5)
        ax.text(-1.3, y, JOB[part], ha="left", va="center", fontsize=11.5)
    ax.set_xlim(-3.2, 4.4)
    ax.set_ylim(y0 - 0.58 - 0.48 * 3 - 0.35, 2.2)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def draw(p: dict):
    return _draw_organs(p) if p["kind"] == "organs" else _draw_eye(p)


# --- questions ----------------------------------------------------------------------------------------------

VERBS = ["looks at", "points at", "talks about", "colours in"]
SETTINGS = ["in a science lesson", "at school", "at home", "with a friend", "in class", "for homework"]


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    lead = f"{who} {rng.choice(VERBS)} the pictures {rng.choice(SETTINGS)}."
    letters = list("ABCD")
    if p["kind"] == "organs":
        organs = p["organs"]
        organ = rng.choice(organs)
        thing = rng.choice(THINGS[SENSE[organ]])
        key = letters[organs.index(organ)]
        other = rng.choice([L for L in letters if L != key])
        senses = sorted(set(SENSE.values()))
        right = SENSE[organs[letters.index(other)]]
        return [Question("mcq", f"{lead} Which letter shows the part you use to {thing}?", str(letters.index(key)), letters),
                mcq(f"What do you do with the part at letter {other}?", right, [v for v in senses if v != right], rng)]
    parts = p["parts"]
    part = rng.choice(parts)
    key = letters[parts.index(part)]
    other = rng.choice([L for L in letters if L != key])
    name = parts[letters.index(other)]
    lead = f"{who} {rng.choice(VERBS)} this drawing of an eye {rng.choice(SETTINGS)}."
    return [Question("mcq", f"{lead} Which letter shows {ASK[part]}?", str(letters.index(key)), letters),
            mcq(f"What is the name of the part at letter {other}?", name, [k for k in parts if k != name], rng)]
