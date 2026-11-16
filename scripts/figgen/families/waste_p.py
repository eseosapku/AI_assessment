"""Waste and where it goes (P2 to P6, Science and Elementary Technology), of two kinds.

- sort (P2 to P4): four to six pieces of waste drawn in a row of boxes, each lettered and named (a banana peel, dry
  leaves, a maize cob, potato peels; a plastic bottle, a tin can, a glass jar, a plastic bag), and a key under them:
  the compost pit takes waste that rots away, the recycling sack waste that does not. How many pieces can go in the
  compost pit (or the recycling sack)? Which letter shows waste for the compost pit (or the sack)? -- the options are
  one piece of that kind and pieces of the other, so exactly one is right.
- data (P5 to P6): a bar chart of the waste a school collected in one week by kind (food waste, paper, plastic, glass,
  metal, garden waste), every bar on a gridline. Which kind was the heaviest? How many kilograms altogether? How many
  more kilograms of one kind than another?

Which waste rots away comes from the fixed table ROTS below (food and plant waste rots; plastic, metal and glass do
not), which a Primary teacher would agree with. Schools are invented.
"""
from __future__ import annotations

import math
import random

from matplotlib.patches import Circle, Ellipse, FancyBboxPatch, Polygon, Rectangle

from ..core import GRID, INK, NAMES, Question, count, mcq, new_figure, short

ID = "waste_p"
KIND = "diagram.template"
SUBJECT = "science"
BANDS = ("P",)
CONCEPTS = tuple(f"science.{c}" for c in ("waste-types", "waste-management", "recycling"))
# A topic whose sections the book lists is reached only if its name or a section names waste or rubbish.
NEEDS = r"\bwastes?\b|rubbish|refuse|recycl"
AVOID = (r"science in context|glossary|water pollution|air pollution|\bmaterials\b|natural and artificial|"
         r"sexual|reproduction system|hiv")

ROTS = {"banana peel": True, "dry leaves": True, "maize cob": True, "potato peels": True,
        "plastic bottle": False, "tin can": False, "glass jar": False, "plastic bag": False}
PLACE = {True: "compost pit", False: "recycling sack"}
KINDS = ["Food waste", "Paper", "Plastic", "Glass", "Metal", "Garden waste"]
SCHOOLS = ["Hill View Primary School", "Sunrise Primary School", "Green Valley Primary School", "Lakeside Primary School",
           "Star Primary School", "Bright Hope Primary School", "Rainbow Primary School", "Twin Hills Primary School"]
LETTERS = "ABCDEF"


def stages(p: dict) -> tuple[int, int]:
    return (2, 4) if p["sub"] == "sort" else (5, 6)


def sample(rng: random.Random) -> dict:
    if rng.random() < 0.5:
        n = rng.choice([4, 5, 6])
        while True:
            k = rng.randint(1, n - 1)
            if k <= 4 and n - k <= 4:
                break
        rot = rng.sample(sorted(t for t in ROTS if ROTS[t]), k)
        other = rng.sample(sorted(t for t in ROTS if not ROTS[t]), n - k)
        items = rot + other
        rng.shuffle(items)
        return {"band": "P", "sub": "sort", "items": items}
    n = rng.choice([4, 5])
    top = rng.choice([20, 24, 30])
    kg = rng.sample(range(2, top + 1, 2), n)
    return {"band": "P", "sub": "data", "school": rng.choice(SCHOOLS), "kinds": rng.sample(KINDS, n), "kg": kg,
            "step": 2, "top": top}


# --- pictures -------------------------------------------------------------------------------------------------

def _item(ax, kind: str, cx: float, cy: float, gid: str) -> None:
    """A piece of waste centred on (cx, cy), inside x +-0.7 and y +-0.55."""
    def P(x, y):
        return (cx + x, cy + y)

    def poly(pts, face, z=3, lw=1.3):
        ax.add_patch(Polygon([P(*q) for q in pts], closed=True, facecolor=face, edgecolor=INK, linewidth=lw, zorder=z,
                             gid=gid))

    def line(*pts, color=INK, lw=1.2, z=3.4):
        ax.plot([P(*q)[0] for q in pts], [P(*q)[1] for q in pts], color=color, linewidth=lw, zorder=z, gid=gid)

    if kind == "banana peel":
        poly([(-0.06, 0.42), (0.06, 0.42), (0.06, 0.3), (-0.06, 0.3)], "#7e5109", z=3.4)
        for ang in (-50, 0, 50):
            t = math.radians(ang)
            c, s = math.cos(t), math.sin(t)
            pts = [(-0.1, 0.3), (0.1, 0.3), (0.16, 0.0), (0.1, -0.3), (0.0, -0.45), (-0.1, -0.3), (-0.16, 0.0)]
            # each flap hangs from the stem, turned about the stem's foot
            poly([(x * c - (y - 0.3) * s, 0.3 + x * s + (y - 0.3) * c) for x, y in pts], "#f4d03f",
                 z=3.2 if ang else 3.3)
    elif kind == "dry leaves":
        for dx, ang in ((-0.22, 30), (0.22, -25)):
            ax.add_patch(Ellipse(P(dx, 0.0), 0.36, 0.95, angle=ang, facecolor="#ca6f1e", edgecolor=INK, linewidth=1.3,
                                 zorder=3, gid=gid))
            t = math.radians(ang + 90)
            line((dx - 0.45 * math.cos(t), -0.45 * math.sin(t)), (dx + 0.45 * math.cos(t), 0.45 * math.sin(t)),
                 color="#6e2c00")
    elif kind == "maize cob":
        ax.add_patch(Ellipse(P(0.0, 0.0), 1.2, 0.42, facecolor="#f7dc6f", edgecolor=INK, linewidth=1.3, zorder=3,
                             gid=gid))
        for i in range(-4, 5):
            for j in (-1, 0, 1):
                if abs(i) * 0.12 < 0.55 - 0.12 * abs(j):
                    ax.add_patch(Circle(P(i * 0.12, j * 0.11), 0.035, facecolor="#d4ac0d", edgecolor="none",
                                        zorder=3.2, gid=gid))
    elif kind == "potato peels":
        for k, (dy, ph) in enumerate(((0.28, 0.0), (0.0, 1.3), (-0.28, 2.1))):
            xs = [-0.6 + 0.06 * i for i in range(21)]
            top = [(x, dy + 0.06 + 0.08 * math.sin(4 * x + ph)) for x in xs]
            bottom = [(x, dy - 0.06 + 0.08 * math.sin(4 * x + ph)) for x in reversed(xs)]
            poly(top + bottom, "#b9770e", z=3 + 0.1 * k, lw=1.0)
    elif kind == "plastic bottle":
        poly([(-0.5, -0.17), (0.25, -0.17), (0.38, -0.08), (0.45, -0.06), (0.45, 0.06), (0.38, 0.08), (0.25, 0.17),
              (-0.5, 0.17)], "#aed6f1")
        poly([(0.45, -0.07), (0.6, -0.07), (0.6, 0.07), (0.45, 0.07)], "#2e86c1", z=3.1)
        poly([(-0.32, -0.17), (0.05, -0.17), (0.05, 0.17), (-0.32, 0.17)], "#e74c3c", z=3.1, lw=1.0)
    elif kind == "tin can":
        poly([(-0.3, -0.45), (0.3, -0.45), (0.3, 0.35), (-0.3, 0.35)], "#b3bcc0")
        ax.add_patch(Ellipse(P(0.0, 0.35), 0.6, 0.16, facecolor="#d5dbdb", edgecolor=INK, linewidth=1.2, zorder=3.1,
                             gid=gid))
        poly([(-0.3, -0.2), (0.3, -0.2), (0.3, 0.12), (-0.3, 0.12)], "#c0392b", z=3.1, lw=1.0)
    elif kind == "glass jar":
        poly([(-0.32, -0.48), (0.32, -0.48), (0.32, 0.18), (0.2, 0.3), (-0.2, 0.3), (-0.32, 0.18)], "#d1f2eb")
        poly([(-0.22, 0.3), (0.22, 0.3), (0.22, 0.44), (-0.22, 0.44)], "#7f8c8d", z=3.1)
        line((-0.18, -0.35), (-0.18, 0.1), color="white", lw=3.0)
    elif kind == "plastic bag":
        poly([(-0.42, -0.5), (0.42, -0.5), (0.36, 0.2), (0.16, 0.2), (0.16, 0.42), (0.04, 0.42), (0.04, 0.2),
              (-0.04, 0.2), (-0.04, 0.42), (-0.16, 0.42), (-0.16, 0.2), (-0.36, 0.2)], "#5dade2")
        line((-0.3, -0.35), (0.3, -0.35), color="#21618c", lw=1.0)
    else:
        raise ValueError(kind)


# --- drawing ----------------------------------------------------------------------------------------------------

BW, GAP, BH = 1.9, 0.25, 2.0
WIDTH = 6 * BW + 5 * GAP


def _draw_sort(p: dict):
    items = p["items"]
    fig, ax = new_figure(10.5, 5.2)
    x_start = (WIDTH - (len(items) * BW + (len(items) - 1) * GAP)) / 2
    y_box = 1.75
    for i, t in enumerate(items):
        x0 = x_start + i * (BW + GAP)
        ax.add_patch(FancyBboxPatch((x0, y_box), BW, BH, boxstyle="round,pad=0,rounding_size=0.1", facecolor="#fbfbf6",
                                    edgecolor=INK, linewidth=1.3, zorder=1, gid=f"box:{i}"))
        _item(ax, t, x0 + BW / 2, y_box + 1.0, f"item:{i}:{t}")
        ax.text(x0 + BW / 2, y_box + 0.24, t, ha="center", va="center", fontsize=11.5, gid=f"name:{i}")
        ax.add_patch(Circle((x0 + 0.3, y_box + BH - 0.3), 0.22, facecolor="white", edgecolor=INK, linewidth=1.5,
                            zorder=6, gid=f"ring:{i}"))
        ax.text(x0 + 0.3, y_box + BH - 0.3, LETTERS[i], ha="center", va="center", fontsize=14, fontweight="bold",
                zorder=7, gid=f"letter:{LETTERS[i]}")
    # the key: where each kind of waste goes
    for k, (rots, x0) in enumerate(((True, 0.0), (False, WIDTH / 2 + 0.15))):
        w = WIDTH / 2 - 0.15
        ax.add_patch(FancyBboxPatch((x0, 0.0), w, 1.35, boxstyle="round,pad=0,rounding_size=0.1", facecolor="#f4f6f7",
                                    edgecolor=INK, linewidth=1.2, zorder=1))
        if rots:  # a pit dug in the ground
            ax.add_patch(Ellipse((x0 + 0.65, 0.62), 0.9, 0.42, facecolor="#6e2c00", edgecolor=INK, linewidth=1.2,
                                 zorder=2))
            ax.add_patch(Ellipse((x0 + 0.65, 0.66), 0.62, 0.22, facecolor="#4a235a", edgecolor="none", zorder=2.1))
        else:  # a sack tied at the top
            ax.add_patch(Polygon([(x0 + 0.35, 0.22), (x0 + 0.95, 0.22), (x0 + 0.88, 0.85), (x0 + 0.72, 0.95),
                                  (x0 + 0.58, 0.95), (x0 + 0.42, 0.85)], closed=True, facecolor="#f8c471",
                                 edgecolor=INK, linewidth=1.2, zorder=2))
            ax.plot([x0 + 0.5, x0 + 0.8], [0.88, 0.88], color=INK, linewidth=1.6, zorder=2.2)
        ax.text(x0 + 1.3, 0.92, PLACE[rots].capitalize(), ha="left", va="center", fontsize=12.5, fontweight="bold")
        ax.text(x0 + 1.3, 0.42, "for waste that rots away" if rots else "for waste that does not rot away",
                ha="left", va="center", fontsize=11.5)
    ax.text(WIDTH / 2, y_box + BH + 0.35, "Waste to sort", ha="center", va="center", fontsize=14, fontweight="bold")
    ax.set_xlim(-0.05, WIDTH + 0.05)
    ax.set_ylim(-0.05, y_box + BH + 0.65)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def _draw_data(p: dict):
    fig, ax = new_figure(9.0, 5.4)
    n = len(p["kinds"])
    bars = ax.bar(range(n), p["kg"], width=0.6, color="#58d68d", edgecolor=INK, linewidth=1.0, zorder=3)
    for i, b in enumerate(bars):
        b.set_gid(f"bar-{i}")
    ax.set_yticks(range(0, p["top"] + 1, p["step"]))
    ax.set_ylim(0, p["top"])
    ax.yaxis.grid(True, color=GRID, linewidth=0.8)
    ax.set_axisbelow(True)
    ax.set_xticks(range(n))
    ax.set_xticklabels(p["kinds"], fontsize=12)
    ax.set_xlim(-0.6, n - 0.4)
    ax.tick_params(axis="y", labelsize=11)
    ax.set_ylabel("Mass of waste (kg)", fontsize=12)
    ax.set_title(f"Waste collected at {p['school']} in one week", fontsize=13, fontweight="bold")
    return fig


def draw(p: dict):
    return _draw_sort(p) if p["sub"] == "sort" else _draw_data(p)


# --- questions --------------------------------------------------------------------------------------------------

VERBS = ["looks at", "studies", "talks about", "points at"]
SETTINGS = ["in a science lesson", "at school", "in class", "with a friend", "at home", "for homework"]


def _kg(n: int) -> list[str]:
    return [f"{n} kg", f"{n}kg", f"{n} kilograms"]


def questions(p: dict, rng: random.Random) -> list:
    who, verb, setting = rng.choice(NAMES), rng.choice(VERBS), rng.choice(SETTINGS)
    if p["sub"] == "sort":
        items = p["items"]
        rots = rng.choice([True, False])
        n = sum(1 for t in items if ROTS[t] == rots)
        qs = [count(f"{who} {verb} the waste {setting}. How many pieces of waste can go in the {PLACE[rots]}?",
                    n, "pieces", "pieces of waste")]
        # one piece of the asked kind, and pieces of the other: exactly one option is right
        kinds = [k for k in (True, False) if any(ROTS[t] == k for t in items)
                 and sum(1 for t in items if ROTS[t] != k) >= 2]
        ask = rng.choice(kinds)
        right = rng.choice([LETTERS[i] for i, t in enumerate(items) if ROTS[t] == ask])
        wrong = rng.sample([LETTERS[i] for i, t in enumerate(items) if ROTS[t] != ask],
                           min(3, sum(1 for t in items if ROTS[t] != ask)))
        options = sorted([right, *wrong])
        qs.append(Question("mcq", f"Which letter shows waste that goes in the {PLACE[ask]}?", str(options.index(right)),
                           options))
        return qs
    kinds, kg = p["kinds"], p["kg"]
    top = kinds[kg.index(max(kg))]
    qs = [mcq(f"{who} {verb} the waste chart of {p['school']} {setting}. Which kind of waste was the heaviest?", top,
              rng.sample([k for k in kinds if k != top], 3), rng)]
    total = sum(kg)
    qs.append(short("How many kilograms of waste did the school collect altogether?", total, _kg(total)))
    a, b = rng.sample(range(len(kinds)), 2)
    if kg[a] < kg[b]:
        a, b = b, a
    d = kg[a] - kg[b]
    qs.append(short(f"How many more kilograms of {kinds[a].lower()} than {kinds[b].lower()} were collected?", d, _kg(d)))
    return qs
