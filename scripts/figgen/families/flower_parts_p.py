"""Flowers and seeds (P5, P6, Science): two kinds.

- parts: a flower cut in half, drawn as flower_diagram draws its insect-pollinated flower (the same outline, without
  the nectaries), with four or five parts lettered (always the anther and the ovary), each by a leader that ends on
  its part. A table beside it names all seven parts, each one's job, and whether it is a male part, a female part or
  neither. Which letter shows the part that does a job (from the table), what the part at a letter is called, and how
  many of the lettered parts are female parts (each letter's part read off the drawing, then the table).
- seeds: four seeds or fruits in lettered cards, drawn with what carries them: wings, fine hairs like a parachute,
  hooks, a juicy fruit, or a pod bursting open. A table says how each is spread. Which letter shows a seed spread a
  way (only a way one seed in the figure has), how the seed at a letter is spread, and how many are spread by the wind.

Every key comes from the fixed tables below, which a Primary teacher agrees with.
"""
from __future__ import annotations

import math
import random

from matplotlib.patches import Circle, Ellipse, FancyBboxPatch, Polygon

from ..core import INK, NAMES, Question, count, mcq, new_figure
from ._bio_parts import ellipse, letter, part, spline, tube
from .flower_diagram import CARPEL, CAVITY, GREEN, INSECT, OVARY, OVULES, PALE, PETALS, RECEPTACLE, SEPAL, STALK, \
    STIGMA_KNOB, _mirror, _slots

ID = "flower_parts_p"
KIND = "diagram.template"
SUBJECT = "science"
BANDS = ("P",)
CONCEPTS = tuple(f"science.{c}" for c in ("plant-reproduction", "pollination", "flowering-plants", "seed-dispersal"))
# A topic whose sections the book lists is reached only if its name or a section names flowers, pollination,
# seeds being spread, or plant reproduction.
NEEDS = r"flower|pollinat|seeds? (?:are )?(?:spread|dispers)|dispersal|plant reproduction|reproduction in plants"
AVOID = (r"\bcells?\b|science in context|glossary|reproduction system|human|asexual|sexual behaviour|hiv|pregnan|"
         r"social factors")

JOB = {"anther": "makes pollen", "filament": "holds up the anther", "stigma": "catches pollen",
       "style": "joins the stigma to the ovary", "ovary": "holds the ovules and becomes the fruit",
       "petal": "attracts insects with its colour", "sepal": "protects the flower when it is a bud"}
SEX = {"anther": "male", "filament": "male", "stigma": "female", "style": "female", "ovary": "female", "petal": "neither",
       "sepal": "neither"}
PARTS = list(JOB)
# What each seed or fruit has, as drawn, and how it is spread.
HAS = {"wing": "wings", "parachute": "fine hairs like a parachute", "hooks": "hooks", "juicy": "a juicy fruit",
       "pod": "a pod that bursts open"}
SPREAD = {"wing": "wind", "parachute": "wind", "hooks": "fur", "juicy": "eat", "pod": "pod"}
WAYS = ["wind", "fur", "eat", "pod"]
# How a stem names each way, and how the table and the options say it (four sentences of a like length, so none
# stands in the middle of the others).
STEM_WAY = {"wind": "by the wind", "fur": "on animals' fur", "eat": "by animals that eat the fruit",
            "pod": "by its pod bursting open"}
SAY = {"wind": "The wind blows it away", "fur": "It sticks to animals' fur", "eat": "Animals eat the fruit",
       "pod": "The pod bursts open"}


def stages(p: dict) -> tuple[int, int]:
    return (5, 6)


def concepts_for(p: dict) -> tuple[str, ...]:
    if p["sub"] == "parts":
        return ("science.plant-reproduction", "science.pollination", "science.flowering-plants")
    return ("science.seed-dispersal", "science.plant-reproduction")


def sample(rng: random.Random) -> dict:
    if rng.random() < 0.5:
        others = rng.sample(["filament", "stigma", "style", "petal", "sepal"], rng.choice([2, 3]))
        chosen = ["anther", "ovary"] + others
        rng.shuffle(chosen)
        return {"band": "P", "sub": "parts", "colour": rng.choice(sorted(PETALS)),
                "labels": {chr(65 + i): x for i, x in enumerate(chosen)}}
    seeds = rng.sample(sorted(HAS), 4)
    return {"band": "P", "sub": "seeds", "seeds": seeds}


# --- drawing: the flower ------------------------------------------------------------------------------

def _flower(p: dict):
    fig, ax = new_figure(14.0, 6.4)
    from matplotlib.patches import Polygon as Poly
    ax.add_patch(Poly(STALK, closed=True, facecolor=GREEN, edgecolor=INK, linewidth=1.2, zorder=1, gid="stalk"))
    ax.add_patch(Poly(spline(RECEPTACLE, per=8), closed=True, facecolor=PALE, edgecolor=INK, linewidth=1.2, zorder=1.2,
                      gid="receptacle"))
    for flip in (lambda q: q, _mirror):
        part(ax, spline(flip(SEPAL), per=8), "sepal", GREEN, z=1.5)
        part(ax, spline(flip(INSECT["petal"]), per=10), "petal", PETALS[p["colour"]], z=2)
        part(ax, tube(spline(flip(INSECT["filament"]), closed=False, per=10), 0.11), "filament", "#f7f2df", lw=1.0, z=2.6)
        x, y, rx, ry = INSECT["anther"]
        x = flip([(x, y)])[0][0]
        part(ax, ellipse(x, y, rx, ry), "anther", "#e9c25a", z=2.7)
        ax.plot([x, x], [y - ry * 0.75, y + ry * 0.75], color=INK, linewidth=0.8, zorder=2.75)
    part(ax, spline(OVARY, per=8), "ovary", CARPEL, z=3)
    ax.add_patch(Poly(spline(CAVITY, per=8), closed=True, facecolor="white", edgecolor=INK, linewidth=1.0, zorder=3.1,
                      gid="cavity"))
    for ox, oy in OVULES:
        for sx in (1, -1):
            ax.plot([sx * (ox + 0.14), sx * 0.56], [oy, oy], color=INK, linewidth=1.0, zorder=3.15)
            part(ax, ellipse(sx * ox, oy, 0.14, 0.18), "ovule", "#f3e3a6", lw=1.0, z=3.2)
    part(ax, tube([(0, 4.2), (0, INSECT["style_top"])], 0.24), "style", CARPEL, lw=1.0, z=3.05)
    part(ax, spline(STIGMA_KNOB, per=8), "stigma", "#bfd99a", z=3.3)
    slots = _slots("insect")
    for L, name in p["labels"].items():
        at, end = slots[name]
        letter(ax, L, at, end, gap=0.32)
    # the table: every part, its job, and whether it is male or female
    x0, x1, x2, x3, top, rh = 7.0, 9.7, 18.6, 22.6, 8.3, 0.95
    ax.fill([x0, x3, x3, x0], [top, top, top - rh, top - rh], color="#dbe9f6", zorder=0)
    for (a, b), head in zip(((x0, x1), (x1, x2), (x2, x3)), ("Part", "Its job", "Male or female?")):
        ax.text((a + b) / 2, top - rh / 2, head, ha="center", va="center", fontsize=11, fontweight="bold")
    for k, name in enumerate(PARTS):
        y = top - (k + 1.5) * rh
        ax.text(x0 + 0.15, y, name.capitalize(), ha="left", va="center", fontsize=11, gid=f"row:{name}")
        ax.text(x1 + 0.15, y, JOB[name], ha="left", va="center", fontsize=11)
        ax.text((x2 + x3) / 2, y, SEX[name], ha="center", va="center", fontsize=11)
    bottom = top - (len(PARTS) + 1) * rh
    for k in range(len(PARTS) + 2):
        ax.plot([x0, x3], [top - k * rh] * 2, color=INK, linewidth=1.5 if k in (0, 1, len(PARTS) + 1) else 0.8)
    for x in (x0, x1, x2, x3):
        ax.plot([x, x], [top, bottom], color=INK, linewidth=1.2)
    ax.set_xlim(-6.2, 22.8)
    ax.set_ylim(-0.3, 9.1)
    ax.set_aspect("equal")
    ax.axis("off")
    ax.set_title("A flower cut in half", fontsize=13)
    return fig


# --- drawing: the seeds -------------------------------------------------------------------------------

SEED = "#8b5a2b"


def _wing(ax, x, y, gid):
    """A winged seed: a seed at one end of a broad, thin, papery wing with fine veins."""
    sx, sy = x - 0.45, y - 0.5
    edge = [(sx, sy - 0.12), (x - 0.05, y - 0.35), (x + 0.45, y - 0.05), (x + 0.72, y + 0.3), (x + 0.68, y + 0.62),
            (x + 0.4, y + 0.72), (x + 0.05, y + 0.45), (x - 0.25, y + 0.05), (sx - 0.08, sy + 0.12)]
    ax.add_patch(Polygon(spline(edge, per=6), closed=True, facecolor="#f0e0b0", edgecolor=INK, linewidth=1.1, zorder=3,
                         gid=gid))
    for ex, ey in ((x + 0.4, y + 0.72), (x + 0.68, y + 0.62), (x + 0.72, y + 0.3), (x + 0.45, y - 0.05)):
        # each vein runs from the seed most of the way to the wing's edge
        ax.plot([sx + 0.1, sx + 0.8 * (ex - sx)], [sy + 0.05, sy + 0.8 * (ey - sy)], color="#b59a5a", linewidth=0.7,
                zorder=3.05, gid=gid)
    ax.add_patch(Ellipse((sx, sy), 0.42, 0.3, angle=40, facecolor=SEED, edgecolor=INK, linewidth=1.1, zorder=3.1, gid=gid))


def _parachute(ax, x, y, gid):
    ax.add_patch(Ellipse((x, y - 0.6), 0.14, 0.32, facecolor=SEED, edgecolor=INK, linewidth=1.0, zorder=3.1, gid=gid))
    ax.plot([x, x], [y - 0.44, y + 0.25], color=INK, linewidth=1.0, zorder=3, gid=gid)
    for d in range(10, 171, 16):
        t = math.radians(d)
        ax.plot([x, x + 0.6 * math.cos(t)], [y + 0.25, y + 0.25 + 0.45 * math.sin(t)], color="#666666", linewidth=0.8,
                zorder=3, gid=gid)


def _hooks(ax, x, y, gid):
    ax.add_patch(Circle((x, y), 0.32, facecolor="#a0784a", edgecolor=INK, linewidth=1.1, zorder=3.1, gid=gid))
    for d in range(0, 360, 30):
        t = math.radians(d)
        bx, by = x + 0.32 * math.cos(t), y + 0.32 * math.sin(t)
        tx, ty = x + 0.6 * math.cos(t), y + 0.6 * math.sin(t)
        hx, hy = tx - 0.1 * math.cos(t + 1.2), ty - 0.1 * math.sin(t + 1.2)
        ax.plot([bx, tx, hx], [by, ty, hy], color=INK, linewidth=1.1, zorder=3, gid=gid)


def _juicy(ax, x, y, gid):
    ax.plot([x, x + 0.05], [y + 0.45, y + 0.72], color="#3e6b2c", linewidth=2.0, zorder=3, gid=gid)
    ax.add_patch(Ellipse((x + 0.25, y + 0.62), 0.42, 0.18, angle=20, facecolor="#7fb35f", edgecolor=INK, linewidth=0.9,
                         zorder=3.05, gid=gid))
    ax.add_patch(Circle((x, y), 0.48, facecolor="#e74c3c", edgecolor=INK, linewidth=1.2, zorder=3.1, gid=gid))
    ax.add_patch(Ellipse((x - 0.17, y + 0.17), 0.16, 0.1, angle=30, facecolor="#f5b7b1", edgecolor="none", zorder=3.2,
                         gid=gid))


def _pod(ax, x, y, gid):
    for s in (1, -1):
        path = [(x - 0.05, y - 0.55), (x + s * 0.25, y - 0.1), (x + s * 0.55, y + 0.45)]
        ax.add_patch(Polygon(tube(path, 0.2), closed=True, facecolor="#b7a35a", edgecolor=INK, linewidth=1.0, zorder=3,
                             gid=gid))
    for sx, sy, dx, dy in ((0.0, 0.25, 0.0, 1), (-0.35, 0.65, -0.6, 0.8), (0.35, 0.68, 0.6, 0.8)):
        ax.add_patch(Circle((x + sx, y + sy), 0.09, facecolor=SEED, edgecolor=INK, linewidth=0.8, zorder=3.2, gid=gid))
        ax.plot([x + sx - 0.12 * dx, x + sx - 0.3 * dx], [y + sy - 0.12 * dy, y + sy - 0.3 * dy], color="#666666",
                linewidth=0.9, zorder=3.1, gid=gid)


DRAW = {"wing": _wing, "parachute": _parachute, "hooks": _hooks, "juicy": _juicy, "pod": _pod}
W, H, GAP = 2.3, 2.3, 0.3


def _seeds(p: dict):
    fig, ax = new_figure(10.4, 4.4)
    for i, kind in enumerate(p["seeds"]):
        L = chr(65 + i)
        col, row = i % 2, i // 2
        x0, y0 = col * (W + GAP), -row * (H + GAP)
        ax.add_patch(FancyBboxPatch((x0, y0), W, H, boxstyle="round,pad=0,rounding_size=0.15", facecolor="white",
                                    edgecolor=INK, linewidth=1.3, zorder=1, gid=f"card:{L}"))
        ax.text(x0 + 0.25, y0 + H - 0.27, L, ha="center", va="center", fontsize=14, fontweight="bold", zorder=5,
                gid=f"letter:{L}")
        DRAW[kind](ax, x0 + W / 2 + 0.1, y0 + H / 2 - 0.05, f"pic:{L}:{kind}")
    # the table: what a seed or fruit has, and how it is spread
    x0, x1, x2, top, rh = 2 * W + GAP + 0.6, 2 * W + GAP + 4.8, 2 * W + GAP + 9.6, H - 0.05, 0.78
    rows = [(HAS[k], SAY[SPREAD[k]]) for k in ("wing", "parachute", "hooks", "juicy", "pod")]
    ax.fill([x0, x2, x2, x0], [top, top, top - rh, top - rh], color="#dbe9f6", zorder=0)
    ax.text((x0 + x1) / 2, top - rh / 2, "If it has", ha="center", va="center", fontsize=11, fontweight="bold")
    ax.text((x1 + x2) / 2, top - rh / 2, "How it is spread", ha="center", va="center", fontsize=11, fontweight="bold")
    for k, (has, way) in enumerate(rows):
        y = top - (k + 1.5) * rh
        ax.text(x0 + 0.15, y, has, ha="left", va="center", fontsize=11)
        ax.text(x1 + 0.15, y, way, ha="left", va="center", fontsize=11)
    bottom = top - (len(rows) + 1) * rh
    for k in range(len(rows) + 2):
        ax.plot([x0, x2], [top - k * rh] * 2, color=INK, linewidth=1.5 if k in (0, 1, len(rows) + 1) else 0.8)
    for x in (x0, x1, x2):
        ax.plot([x, x], [top, bottom], color=INK, linewidth=1.2)
    ax.set_xlim(-0.1, x2 + 0.1)
    ax.set_ylim(min(-H - GAP, bottom) - 0.1, H + 0.1)
    ax.set_aspect("equal")
    ax.axis("off")
    ax.set_title("Seeds and fruits, and how they are spread", fontsize=13)
    return fig


def draw(p: dict):
    return _flower(p) if p["sub"] == "parts" else _seeds(p)


# --- questions --------------------------------------------------------------------------------------

SETTINGS = ["in a science lesson", "in the school garden", "at home in Huye", "for a class display", "near Musanze",
            "at the science club", "for homework", "on a walk near Nyungwe"]


def _cap(s: str) -> str:
    return s[0].upper() + s[1:]


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    if p["sub"] == "parts":
        labels = p["labels"]
        at = {v: k for k, v in labels.items()}
        order = sorted(labels)
        name = rng.choice(sorted(at))
        qs = [Question("mcq", f"{who} drew this flower {rng.choice(SETTINGS)}. Which letter shows the part that "
                              f"{JOB[name]}?", str(order.index(at[name])), order)]
        other = rng.choice([L for L in order if L != at[name]])
        right = labels[other]
        qs.append(mcq(f"What is the part at letter {other} called?", right,
                      rng.sample([x for x in PARTS if x != right], 3), rng))
        qs.append(count("How many of the lettered parts are female parts?",
                        sum(SEX[v] == "female" for v in labels.values()), "parts"))
        return qs
    seeds = p["seeds"]
    letters = [chr(65 + i) for i in range(len(seeds))]
    unique = [w for w in WAYS if sum(SPREAD[k] == w for k in seeds) == 1]
    way = rng.choice(unique)
    key = next(L for L, k in zip(letters, seeds) if SPREAD[k] == way)
    qs = [Question("mcq", f"{who} found these seeds and fruits {rng.choice(SETTINGS)}. Which letter shows a seed "
                          f"spread {STEM_WAY[way]}?", str(letters.index(key)), letters)]
    other = rng.choice([L for L in letters if L != key])
    right = SAY[SPREAD[seeds[letters.index(other)]]]
    options = [SAY[w] for w in WAYS]
    rng.shuffle(options)
    qs.append(Question("mcq", f"How is the seed at letter {other} spread?", str(options.index(right)), options))
    qs.append(count("How many of the seeds are spread by the wind?", sum(SPREAD[k] == "wind" for k in seeds),
                    "seeds"))
    return qs
