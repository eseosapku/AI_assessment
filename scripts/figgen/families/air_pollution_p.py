"""Air pollution (P5 to P6, Science and Elementary Technology), of two kinds.

- scene: five things in a row of boxes, each lettered and named: some that pollute the air (a factory, a car, burning
  rubbish, a cooking fire), each drawn giving out grey smoke, and some that do not (a tree, a bicycle, a solar panel),
  drawn with none. How many of the lettered things pollute the air? Which letter shows something that pollutes the air
  (or does not)? -- the options are one thing of the asked kind and things of the other, so exactly one is right.
- days: a bar chart of the pollution level in an invented town on each day of one week, with the safe limit drawn as
  a dashed line; every bar on a gridline and none on the limit. On how many days was the pollution above the safe
  limit? On which day was the air most polluted? How much higher was the level on one day than another?

Which things pollute comes from the fixed table POLLUTES below, which a Primary teacher would agree with.
"""
from __future__ import annotations

import math
import random

from matplotlib.patches import Circle, FancyBboxPatch, Polygon, Rectangle

from ..core import GRID, INK, NAMES, Question, count, mcq, new_figure, short

ID = "air_pollution_p"
KIND = "diagram.template"
SUBJECT = "science"
BANDS = ("P",)
CONCEPTS = ("science.air-pollution",)
# A topic whose sections the book lists is reached only if its name or a section names pollution or smoke.
NEEDS = r"pollut|smoke|air quality"
AVOID = r"science in context|glossary|water pollution|\bwastes?\b|wind and sound|sexual|reproduction system|hiv"

POLLUTES = {"factory": True, "car": True, "burning rubbish": True, "cooking fire": True, "tree": False,
            "bicycle": False, "solar panel": False}
DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
TOWNS = ["Town K", "Town M", "Town P", "Town R", "Town T", "Town V"]
LETTERS = "ABCDE"


def stages(p: dict) -> tuple[int, int]:
    return (5, 6)


def sample(rng: random.Random) -> dict:
    if rng.random() < 0.5:
        k = rng.choice([2, 3])
        things = rng.sample(sorted(t for t in POLLUTES if POLLUTES[t]), k) + \
            rng.sample(sorted(t for t in POLLUTES if not POLLUTES[t]), 5 - k)
        rng.shuffle(things)
        return {"band": "P", "sub": "scene", "things": things}
    limit = rng.choice([40, 50, 60])
    while True:
        levels = [rng.choice([v for v in range(10, 101, 10) if v != limit]) for _ in DAYS]
        above = sum(v > limit for v in levels)
        if levels.count(max(levels)) == 1 and 1 <= above <= 6:
            break
    return {"band": "P", "sub": "days", "town": rng.choice(TOWNS), "names": DAYS, "levels": levels, "limit": limit,
            "step": 10, "top": 100}


# --- pictures -------------------------------------------------------------------------------------------------

SMOKE = "#99a3a4"


def _smoke(ax, pts, gid: str) -> None:
    for x, y, r in pts:
        ax.add_patch(Circle((x, y), r, facecolor=SMOKE, edgecolor="#616a6b", linewidth=1.0, zorder=4, gid=gid))


def _thing(ax, kind: str, cx: float, cy: float, i: int) -> None:
    """A thing standing on y = cy - 0.5, inside x +-0.75; smoke up to cy + 0.85."""
    gid = f"thing:{i}:{kind}"

    def P(x, y):
        return (cx + x, cy + y)

    def poly(pts, face, z=3, lw=1.3):
        ax.add_patch(Polygon([P(*q) for q in pts], closed=True, facecolor=face, edgecolor=INK, linewidth=lw, zorder=z,
                             gid=gid))

    def circ(x, y, r, face, z=3.2, lw=1.2):
        ax.add_patch(Circle(P(x, y), r, facecolor=face, edgecolor=INK, linewidth=lw, zorder=z, gid=gid))

    def line(*pts, color=INK, lw=2.0, z=3.1):
        ax.plot([P(*q)[0] for q in pts], [P(*q)[1] for q in pts], color=color, linewidth=lw, zorder=z,
                solid_capstyle="round", gid=gid)

    smoke = f"smoke:{i}"
    if kind == "factory":
        poly([(-0.7, -0.5), (0.3, -0.5), (0.3, -0.05), (0.05, 0.12), (0.05, -0.05), (-0.2, 0.12), (-0.2, -0.05),
              (-0.45, 0.12), (-0.45, -0.05), (-0.7, 0.12)], "#cd6155")
        poly([(0.38, -0.5), (0.6, -0.5), (0.6, 0.38), (0.38, 0.38)], "#7b7d7d")
        for x in (-0.55, -0.25, 0.0):
            poly([(x, -0.35), (x + 0.15, -0.35), (x + 0.15, -0.2), (x, -0.2)], "#f9e79f", z=3.1, lw=0.8)
        _smoke(ax, [P(0.5, 0.5) + (0.11,), P(0.32, 0.62) + (0.13,), P(0.08, 0.72) + (0.12,)], smoke)
    elif kind == "car":
        poly([(-0.7, -0.35), (0.7, -0.35), (0.7, -0.05), (0.4, 0.0), (0.22, 0.25), (-0.3, 0.25), (-0.45, 0.0),
              (-0.7, -0.05)], "#2e86c1")
        poly([(-0.22, 0.02), (0.15, 0.02), (0.15, 0.2), (-0.25, 0.2)], "#d6eaf8", z=3.1, lw=0.8)
        for x in (-0.4, 0.42):
            circ(x, -0.38, 0.13, "#1c1c1c", z=3.3)
        _smoke(ax, [P(-0.78, -0.12) + (0.09,), P(-0.68, 0.08) + (0.11,), P(-0.6, 0.32) + (0.12,)], smoke)
    elif kind == "burning rubbish":
        poly([(-0.65, -0.5), (0.65, -0.5), (0.4, -0.2), (0.1, -0.08), (-0.25, -0.12), (-0.5, -0.28)], "#7e5109")
        poly([(-0.35, -0.2), (-0.22, 0.12), (-0.12, -0.05), (0.0, 0.3), (0.12, -0.02), (0.25, 0.1), (0.35, -0.2)],
             "#e67e22", z=3.2)
        poly([(-0.18, -0.18), (-0.08, 0.02), (0.0, -0.06), (0.1, 0.05), (0.18, -0.18)], "#f4d03f", z=3.3, lw=0.8)
        _smoke(ax, [P(0.0, 0.45) + (0.12,), P(-0.15, 0.6) + (0.13,), P(0.1, 0.72) + (0.12,)], smoke)
    elif kind == "cooking fire":
        for x in (-0.45, 0.0, 0.45):
            circ(x, -0.4, 0.13, "#909497", z=3.0)
        poly([(-0.3, -0.38), (-0.1, -0.12), (0.0, -0.3), (0.1, -0.12), (0.3, -0.38)], "#e67e22", z=3.1)
        bowl = [(0.4 * math.cos(math.pi + math.pi * k / 16), 0.16 + 0.3 * math.sin(math.pi + math.pi * k / 16))
                for k in range(17)]
        poly(bowl, "#1c1c1c", z=3.2)
        poly([(-0.47, 0.14), (0.47, 0.14), (0.47, 0.2), (-0.47, 0.2)], "#424949", z=3.3, lw=1.0)
        _smoke(ax, [P(0.05, 0.38) + (0.11,), P(-0.12, 0.54) + (0.13,), P(0.08, 0.7) + (0.12,)], smoke)
    elif kind == "tree":
        poly([(-0.1, -0.5), (0.1, -0.5), (0.1, 0.0), (-0.1, 0.0)], "#7e5109")
        circ(0.0, 0.3, 0.42, "#27ae60", z=3.1)
    elif kind == "bicycle":
        for x in (-0.42, 0.42):
            circ(x, -0.25, 0.25, "none", z=3.0, lw=2.0)
        line((-0.42, -0.25), (-0.1, 0.12), (0.3, 0.12), (0.42, -0.25), lw=2.2, color="#c0392b")
        line((-0.1, 0.12), (0.0, -0.25), (-0.42, -0.25), lw=2.2, color="#c0392b")
        line((0.0, -0.25), (0.3, 0.12), lw=2.2, color="#c0392b")
        line((-0.12, 0.12), (-0.15, 0.25), lw=2.0)
        line((-0.27, 0.27), (-0.03, 0.27), lw=4.0)
        line((0.3, 0.12), (0.33, 0.32), (0.45, 0.35), lw=2.0)
    elif kind == "solar panel":
        line((0.0, -0.5), (0.0, -0.05), lw=3.0, color="#5d6d7e")
        poly([(-0.65, -0.12), (0.55, -0.12), (0.7, 0.32), (-0.5, 0.32)], "#1f618d")
        for t in (1 / 3, 2 / 3):
            line((-0.65 + 1.2 * t, -0.12), (-0.5 + 1.2 * t, 0.32), lw=1.0, color="#d6eaf8", z=3.2)
        line((-0.575, 0.1), (0.625, 0.1), lw=1.0, color="#d6eaf8", z=3.2)
    else:
        raise ValueError(kind)


# --- drawing ----------------------------------------------------------------------------------------------------

BW, GAP, BH = 2.05, 0.22, 2.35


def _draw_scene(p: dict):
    fig, ax = new_figure(10.5, 3.8)
    width = 5 * BW + 4 * GAP
    for i, t in enumerate(p["things"]):
        x0 = i * (BW + GAP)
        ax.add_patch(FancyBboxPatch((x0, 0), BW, BH, boxstyle="round,pad=0,rounding_size=0.1", facecolor="#fbfbf6",
                                    edgecolor=INK, linewidth=1.3, zorder=1, gid=f"box:{i}"))
        ax.add_patch(Rectangle((x0 + 0.05, 0.5), BW - 0.1, 0.06, facecolor="#abebc6", edgecolor="none", zorder=1.5))
        _thing(ax, t, x0 + BW / 2 + 0.08, 1.06, i)
        ax.text(x0 + BW / 2, 0.25, t, ha="center", va="center", fontsize=11.5, gid=f"name:{i}")
        ax.add_patch(Circle((x0 + 0.3, BH - 0.3), 0.22, facecolor="white", edgecolor=INK, linewidth=1.5, zorder=6,
                            gid=f"ring:{i}"))
        ax.text(x0 + 0.3, BH - 0.3, LETTERS[i], ha="center", va="center", fontsize=14, fontweight="bold", zorder=7,
                gid=f"letter:{LETTERS[i]}")
    ax.set_xlim(-0.05, width + 0.05)
    ax.set_ylim(-0.05, BH + 0.05)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def _draw_days(p: dict):
    fig, ax = new_figure(10.5, 5.4)
    bars = ax.bar(range(7), p["levels"], width=0.6, color="#aab7b8", edgecolor=INK, linewidth=1.0, zorder=3)
    for i, b in enumerate(bars):
        b.set_gid(f"bar-{i}")
    ax.set_yticks(range(0, p["top"] + 1, p["step"]))
    ax.set_ylim(0, p["top"] + 12)
    ax.yaxis.grid(True, color=GRID, linewidth=0.8)
    ax.set_axisbelow(True)
    ax.set_xticks(range(7))
    ax.set_xticklabels(p["names"], fontsize=11)
    ax.set_xlim(-0.6, 7.7)
    ax.tick_params(axis="y", labelsize=11)
    ax.plot([-0.6, 6.45], [p["limit"]] * 2, color="#c0392b", linewidth=2.2, linestyle="--", zorder=4, gid="limit")
    ax.text(6.5, p["limit"], "Safe limit", ha="left", va="center", fontsize=11, color="#c0392b", fontweight="bold")
    ax.set_ylabel("Pollution level (units)", fontsize=12)
    ax.set_title(f"Air pollution in {p['town']} in one week", fontsize=13, fontweight="bold")
    return fig


def draw(p: dict):
    return _draw_scene(p) if p["sub"] == "scene" else _draw_days(p)


# --- questions --------------------------------------------------------------------------------------------------

VERBS = ["looks at", "studies", "talks about", "points at"]
SETTINGS = ["in a science lesson", "at school", "in class", "with a friend", "at home", "for homework"]


def questions(p: dict, rng: random.Random) -> list:
    who, verb, setting = rng.choice(NAMES), rng.choice(VERBS), rng.choice(SETTINGS)
    if p["sub"] == "scene":
        things = p["things"]
        n = sum(POLLUTES[t] for t in things)
        qs = [count(f"{who} {verb} the pictures {setting}. How many of the lettered things pollute the air?", n,
                    "things")]
        ask = rng.choice([True, False])
        right = rng.choice([LETTERS[i] for i, t in enumerate(things) if POLLUTES[t] == ask])
        wrong = [LETTERS[i] for i, t in enumerate(things) if POLLUTES[t] != ask][:3]
        options = sorted([right, *wrong])
        what = "pollutes the air" if ask else "does not pollute the air"
        qs.append(Question("mcq", f"Which letter shows something that {what}?", str(options.index(right)), options))
        return qs
    names, levels, limit = p["names"], p["levels"], p["limit"]
    n = sum(v > limit for v in levels)
    qs = [count(f"{who} {verb} the chart for {p['town']} {setting}. On how many days was the pollution above the "
                f"safe limit?", n, "days")]
    top = names[levels.index(max(levels))]
    qs.append(mcq("On which day was the air most polluted?", top, rng.sample([d for d in names if d != top], 3), rng))
    a, b = rng.sample([i for i in range(7)], 2)
    while levels[a] == levels[b]:
        a, b = rng.sample(range(7), 2)
    if levels[a] < levels[b]:
        a, b = b, a
    d = levels[a] - levels[b]
    qs.append(short(f"How much higher was the pollution level on {names[a]} than on {names[b]}?", d,
                    [f"{d} units"]))
    return qs
