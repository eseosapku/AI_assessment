"""Breathing (P5-P6), of two kinds.

- organs: the body from the head to the waist with the breathing parts drawn simply (nose, windpipe, two lungs,
  diaphragm, ribs), four of them lettered by leader lines that end on their part, and a table of the lettered parts'
  names and jobs (never their letters). Which letter shows the part that does a job the table states; what the part at
  a letter is called.
- rate: a bar chart of three or four pupils' breathing rates (breaths a minute) at rest and after exercise, every bar
  ending on a gridline. Whose rate went up most (plainly: 4 breaths a minute clear of the next); a reading; a rise.

Every key comes from the fixed tables below, which a Primary teacher would agree with.
"""
from __future__ import annotations

import random

from matplotlib.patches import Circle, Ellipse, FancyBboxPatch, Polygon

from ..core import FILL, FILL_2, GRID, INK, NAMES, Question, mcq, new_figure, short

ID = "breathing_p"
KIND = "diagram.template"
SUBJECT = "science"
BANDS = ("P",)
CONCEPTS = ("science.human-respiratory-system", "science.body-movement")
# A topic whose sections the book lists is reached only if its name or a section names breathing, respiration or lungs.
NEEDS = r"respirat|breath|\blungs?\b"
AVOID = (r"\bcells?\b|animals classification|air pollution|circulatory|science in context|glossary|reproduct|sexual|"
         r"\bHIV\b|STIs|social factors")

PARTS = ["nose", "windpipe", "lungs", "diaphragm", "ribs"]
JOB = {"nose": "warms and cleans the air we breathe in", "windpipe": "carries air down to the lungs",
       "lungs": "take oxygen from the air into the blood",
       "diaphragm": "a muscle under the lungs that moves down when we breathe in",
       "ribs": "protect the lungs and move out when we breathe in"}
ASK = {"nose": "the part that warms and cleans the air we breathe in",
       "windpipe": "the tube that carries air down to the lungs",
       "lungs": "the organs that take oxygen from the air into the blood",
       "diaphragm": "the muscle under the lungs that moves down when we breathe in",
       "ribs": "the bones that protect the lungs"}
SKIN = "#f3e5d8"
LUNG = "#f1948a"
ACTIVITIES = ["skipping for two minutes", "running round the field", "dancing to a song", "doing star jumps",
              "running up and down the steps"]


def concepts_for(p: dict) -> tuple[str, ...]:
    return ("science.human-respiratory-system",) if p["kind"] == "organs" else CONCEPTS


def stages(p: dict) -> tuple[int, int]:
    return (5, 6)


def sample(rng: random.Random) -> dict:
    if rng.random() < 0.5:
        return {"band": "P", "kind": "organs", "parts": rng.sample(PARTS, 4)}
    n, step = rng.choice([3, 4]), 4
    while True:
        rest = [rng.choice([12, 16, 20]) for _ in range(n)]
        rise = [rng.randrange(8, 25, step) for _ in range(n)]
        top = sorted(rise, reverse=True)
        if top[0] - top[1] >= 4:
            return {"band": "P", "kind": "rate", "step": step, "pupils": rng.sample(NAMES, n), "rest": rest,
                    "after": [r + d for r, d in zip(rest, rise)], "activity": rng.choice(ACTIVITIES)}


# --- the body -------------------------------------------------------------------------------------------------

def _lung(side: int) -> list[tuple[float, float]]:
    """One lung, a rounded wedge beside the heart, flat side to the middle."""
    import math
    pts = []
    for k in range(25):
        t = math.radians(90 - 180 * k / 24)
        pts.append((side * (0.55 + 1.05 * max(math.cos(t), 0) ** 0.8), 3.0 + 1.55 * math.sin(t) - 0.15 * (1 - math.sin(t))))
    return pts + [(side * 0.35, 1.25), (side * 0.3, 4.3)]


def _draw_organs(p: dict):
    import math
    fig, ax = new_figure(11.0, 6.4)
    # body outline: head, neck, chest down to the waist
    ax.add_patch(Circle((0, 6.6), 0.85, facecolor=SKIN, edgecolor=INK, linewidth=1.5, zorder=1))
    ax.add_patch(Polygon([(-0.35, 5.85), (0.35, 5.85), (0.4, 5.2), (2.2, 4.8), (2.0, 0.3), (-2.0, 0.3), (-2.2, 4.8),
                          (-0.4, 5.2)], closed=True, facecolor=SKIN, edgecolor=INK, linewidth=1.5, zorder=1))
    # nose (a bump on the face) with the nostril, and the mouth
    ax.add_patch(Polygon([(0, 6.85), (0.18, 6.35), (-0.18, 6.35)], closed=True, facecolor="#e0b896", edgecolor=INK,
                         linewidth=1.2, zorder=2))
    ax.plot([-0.25, 0.25], [6.05, 6.05], color=INK, linewidth=1.4, zorder=2)
    # ribs, behind the lungs' outline but drawn over the chest
    for k in range(6):
        y = 4.35 - 0.48 * k
        for side in (-1, 1):
            xs = [side * (0.25 + 1.6 * t) for t in [i / 12 for i in range(13)]]
            ys = [y - 0.35 * t ** 2 for t in [i / 12 for i in range(13)]]
            ax.plot(xs, ys, color="#a1887f", linewidth=2.6, solid_capstyle="round", zorder=2)
    # lungs
    for side in (-1, 1):
        ax.add_patch(Polygon(_lung(side), closed=True, facecolor=LUNG, edgecolor=INK, linewidth=1.5, alpha=0.95, zorder=3))
    # windpipe from the throat, branching into each lung
    ax.add_patch(FancyBboxPatch((-0.14, 4.2), 0.28, 1.8, boxstyle="round,pad=0,rounding_size=0.08", facecolor="#d5dbdb",
                                edgecolor=INK, linewidth=1.3, zorder=4))
    for side in (-1, 1):
        ax.plot([0, side * 0.55], [4.25, 3.75], color=INK, linewidth=4.2, solid_capstyle="round", zorder=4)
        ax.plot([0, side * 0.55], [4.25, 3.75], color="#d5dbdb", linewidth=2.4, solid_capstyle="round", zorder=4.1)
    for k in range(6):
        ax.plot([-0.14, 0.14], [4.4 + 0.27 * k, 4.4 + 0.27 * k], color=INK, linewidth=0.8, zorder=4.2)
    # diaphragm: a dome under the lungs
    xs = [-1.9 + 3.8 * i / 30 for i in range(31)]
    ax.plot(xs, [1.05 + 0.35 * math.cos(x / 1.9 * math.pi / 2) for x in xs], color="#922b21", linewidth=4.0, zorder=4)
    at = {"nose": (0.12, 6.45), "windpipe": (0.14, 5.3), "lungs": (-1.2, 2.8), "diaphragm": (1.2, 1.05 + 0.35 * math.cos(1.2 / 1.9 * math.pi / 2)),
          "ribs": (1.75, 4.35 - 0.48 * 1 - 0.35 * ((1.75 - 0.25) / 1.6) ** 2)}
    slot = {"nose": (2.9, 6.6), "windpipe": (2.9, 5.4), "lungs": (-3.0, 3.2), "diaphragm": (2.9, 0.8), "ribs": (2.9, 4.2)}
    for i, part in enumerate(p["parts"]):
        letter = "ABCD"[i]
        (lx, ly), (tx, ty) = slot[part], at[part]
        d = ((tx - lx) ** 2 + (ty - ly) ** 2) ** 0.5
        ux, uy = (tx - lx) / d, (ty - ly) / d
        ax.plot([lx + ux * 0.32, tx], [ly + uy * 0.32, ty], color=INK, linewidth=1.4, zorder=6, gid=f"leader:{letter}")
        ax.add_patch(Circle((tx, ty), 0.07, facecolor=INK, edgecolor=INK, zorder=6))
        ax.add_patch(Circle((lx, ly), 0.3, facecolor="white", edgecolor=INK, linewidth=1.6, zorder=7, gid=f"ring:{letter}"))
        ax.text(lx, ly, letter, ha="center", va="center", fontsize=15, fontweight="bold", zorder=8, gid=f"letter:{letter}")
    # the table of the lettered parts, in a fixed order, never by letter
    x0, top = 4.0, 6.2
    ax.text(x0, top, "Part", ha="left", va="center", fontsize=12, fontweight="bold")
    ax.text(x0 + 2.0, top, "Its job", ha="left", va="center", fontsize=12, fontweight="bold")
    ax.plot([x0 - 0.05, x0 + 9.0], [top - 0.35, top - 0.35], color=INK, linewidth=1.0)
    for j, part in enumerate(k for k in PARTS if k in p["parts"]):
        y = top - 0.95 - 0.75 * j
        ax.text(x0, y, part.capitalize(), ha="left", va="center", fontsize=11.5)
        ax.text(x0 + 2.0, y, JOB[part], ha="left", va="center", fontsize=11.5)
    ax.set_xlim(-3.5, 13.2)
    ax.set_ylim(0.1, 7.6)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def _draw_rate(p: dict):
    fig, ax = new_figure(6.8, 4.9)
    n, w = len(p["pupils"]), 0.36
    top = max(p["after"]) + 12
    top += (-top) % 4
    for i in range(n):
        for dx, v, colour, when in ((-w / 2, p["rest"][i], FILL_2, "rest"), (w / 2, p["after"][i], FILL, "after")):
            bar = ax.bar(i + dx, v, w, color=colour, edgecolor=INK, linewidth=1.0,
                         label=("At rest" if when == "rest" else "After exercise") if i == 0 else None)
            bar[0].set_gid(f"bar:{when}:{i}")
    ax.set_xticks(range(n))
    ax.set_xticklabels(p["pupils"], fontsize=11)
    ax.set_yticks(range(0, top + 1, 8))
    ax.set_yticks(range(0, top + 1, p["step"]), minor=True)
    ax.tick_params(axis="y", labelsize=10.5)
    ax.tick_params(axis="y", which="minor", length=0)
    ax.set_ylim(0, top)
    ax.set_xlim(-0.6, n - 0.4)
    ax.yaxis.grid(True, which="both", color=GRID, linewidth=0.7)
    ax.set_axisbelow(True)
    ax.set_ylabel("Breaths in one minute", fontsize=11)
    ax.legend(loc="upper center", ncol=2, fontsize=10.5, frameon=False)
    ax.set_title(f"Breathing before and after {p['activity']}", fontsize=12)
    return fig


def draw(p: dict):
    return _draw_organs(p) if p["kind"] == "organs" else _draw_rate(p)


# --- questions --------------------------------------------------------------------------------------------------

VERBS = ["looks at", "studies", "points at", "talks about"]
SETTINGS = ["in a science lesson", "at school", "at home", "with a friend", "in class", "for homework"]


def questions(p: dict, rng: random.Random) -> list:
    if p["kind"] == "organs":
        who = rng.choice(NAMES)
        parts, letters = p["parts"], list("ABCD")
        part = rng.choice(parts)
        other = rng.choice([L for L in letters if L != letters[parts.index(part)]])
        name = parts[letters.index(other)]
        return [Question("mcq", f"{who} {rng.choice(VERBS)} this drawing of the body {rng.choice(SETTINGS)}. Which letter "
                                f"shows {ASK[part]}?", str(parts.index(part)), letters),
                mcq(f"What is the name of the part at letter {other}?", name, [k for k in parts if k != name], rng)]
    kids, rest, after = p["pupils"], p["rest"], p["after"]
    who = rng.choice([n for n in NAMES if n not in kids])
    rise = [a - r for a, r in zip(after, rest)]
    best = kids[rise.index(max(rise))]
    i, j = rng.sample(range(len(kids)), 2)
    per = lambda v: [f"{v} breaths", f"{v} breaths a minute", f"{v} breaths per minute"]  # noqa: E731
    # Wrong answers: the tallest bar after exercise, the tallest at rest, then the rest.
    slips = [kids[after.index(max(after))], kids[rest.index(max(rest))]] + kids
    return [mcq(f"{who} counts the breaths of {len(kids)} friends before and after {p['activity']}. "
                "Whose breathing rate went up the most?", best, slips, rng),
            short(f"How many breaths a minute did {kids[i]} take after exercise?", after[i], per(after[i])),
            short(f"How many more breaths a minute did {kids[j]} take after exercise than at rest?", rise[j], per(rise[j]))]
