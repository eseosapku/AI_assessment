"""Light and the planets (P5-P6), of three kinds.

- mirror: a flat mirror on the floor, drawn on a square grid seen from the side, with the dotted line straight up from
  where a torch's beam hits it, and three children's heads lettered A to C on the far side. "Light bounces off a
  mirror at the same angle as it hits it" is printed. Exactly one head sits on the bounced beam (as many squares across
  for every square up as the beam came down); the others are at least a square's width off it. Which child can see the
  torch's light in the mirror.
- surfaces: a bar chart of how much light (lux, read by a light meter) four surfaces reflected when a torch shone on
  each; shinier surfaces reflect more (a mirror, kitchen foil, white paper, a wooden board, black cloth, in that order),
  and every bar ends on a gridline. A reading, a difference, how many surfaces reflected more than a value no bar has.
- planets: a bar chart of three or four planets, in order from the Sun, by their distance from the Sun (million km)
  or the days they take to go round it, each value printed on its bar (Mercury 58, Venus 108, Earth 150, Mars 228,
  Jupiter 778 million km; Mercury 88, Venus 225, Earth 365, Mars 687 days). A value, a difference, and how many of the
  planets shown are closer to the Sun than Earth.
"""
from __future__ import annotations

import math
import random

from matplotlib.patches import Circle, Polygon, Rectangle

from ..core import FILL, GRID, INK, NAMES, Question, count, new_figure, short

ID = "light_p"
KIND = "physics.ray"
SUBJECT = "science"
BANDS = ("P",)
CONCEPTS = ("science.light-reflection", "science.light-propagation", "science.solar-system")
# A topic whose sections the book lists is reached only if its name or a section names reflection, mirrors, light or
# the Solar System.
NEEDS = r"reflect|mirror|solar system|\blight\b"
AVOID = (r"\bcells?\b|light and heat|light and dark|shadows|science in context|glossary|reproduct|sexual|\bHIV\b|STIs|"
         r"social factors")

SHINY = ["a mirror", "kitchen foil", "white paper", "a wooden board", "black cloth"]
DIST = {"Mercury": 58, "Venus": 108, "Earth": 150, "Mars": 228, "Jupiter": 778}
ORBIT = {"Mercury": 88, "Venus": 225, "Earth": 365, "Mars": 687}
SKIN = "#8d5524"
HAIR = "#2c2c2c"


def concepts_for(p: dict) -> tuple[str, ...]:
    return {"mirror": ("science.light-reflection", "science.light-propagation"), "surfaces": ("science.light-reflection",),
            "planets": ("science.solar-system",)}[p["kind"]]


def stages(p: dict) -> tuple[int, int]:
    return (5, 6)


def _off(h, mx, a, b) -> float:
    """How far a point is from the bounced beam's line, in squares."""
    return abs((h[0] - mx) * b - h[1] * a) / math.hypot(a, b)


def _mirror(rng: random.Random) -> dict:
    while True:
        a, b = rng.choice([(1, 1), (1, 2), (2, 1)])
        mx = rng.randrange(5, 9)
        ks = [k for k in range(1, 8) if 4 <= b * k <= 7 and mx - a * k >= 1.5]
        js = [j for j in range(1, 8) if 2.5 <= b * j <= 7 and mx + a * j <= 12]
        if not ks or not js:
            continue
        k, j = rng.choice(ks), rng.choice(js)
        key = [mx + a * j, b * j]
        heads = [key]
        spots = [[x, y] for x in range(mx, 13) for y in range(2, 8)]
        rng.shuffle(spots)
        for h in spots:
            if len(heads) == 3:
                break
            if (_off(h, mx, a, b) >= 0.9 and all(math.dist(h, g) >= 1.9 for g in heads)
                    and math.dist(h, [mx - a * k, b * k]) >= 2.0):
                heads.append(h)
        if len(heads) < 3:
            continue
        rng.shuffle(heads)
        return {"band": "P", "kind": "mirror", "mx": mx, "a": a, "b": b, "k": k, "heads": heads}


def _surfaces(rng: random.Random) -> dict:
    surf = sorted(rng.sample(SHINY, 4), key=SHINY.index)
    while True:
        lux = sorted(rng.sample(range(50, 1001, 50), 4), reverse=True)
        if all(x - y >= 100 for x, y in zip(lux, lux[1:])):
            break
    order = list(range(4))
    rng.shuffle(order)
    return {"band": "P", "kind": "surfaces", "surfaces": [surf[i] for i in order], "lux": [lux[i] for i in order]}


def _planets(rng: random.Random) -> dict:
    measure = rng.choice(["distance", "orbit"])
    table = DIST if measure == "distance" else ORBIT
    n = rng.choice([3, 4])
    names = list(table)
    while True:
        chosen = sorted(rng.sample(names, n), key=names.index)
        if measure == "orbit" or ("Earth" in chosen and chosen.index("Earth") > 0):
            return {"band": "P", "kind": "planets", "measure": measure, "planets": chosen}


def sample(rng: random.Random) -> dict:
    return {"mirror": _mirror, "surfaces": _surfaces, "planets": _planets}[rng.choice(["mirror", "surfaces", "planets"])](rng)


# --- drawing ----------------------------------------------------------------------------------------------------

def _head(ax, x, y, letter):
    ax.add_patch(Circle((x, y), 0.42, facecolor=SKIN, edgecolor=INK, linewidth=1.4, zorder=4))
    ax.add_patch(Polygon([(x - 0.42, y + 0.05), (x - 0.3, y + 0.38), (x + 0.1, y + 0.45), (x + 0.42, y + 0.1),
                          (x + 0.3, y + 0.32)], closed=True, facecolor=HAIR, edgecolor=INK, linewidth=0.8, zorder=4.1))
    ax.add_patch(Circle((x - 0.2, y - 0.02), 0.07, facecolor="white", edgecolor=INK, linewidth=0.8, zorder=4.2))
    ax.text(x + 0.72, y, letter, ha="center", va="center", fontsize=15, fontweight="bold", zorder=5, gid=f"letter:{letter}")


def _draw_mirror(p: dict):
    mx, a, b, k = p["mx"], p["a"], p["b"], p["k"]
    fig, ax = new_figure(7.6, 5.4)
    ax.set_xticks(range(0, 15))
    ax.set_yticks(range(0, 9))
    ax.set_xticklabels([])
    ax.set_yticklabels([])
    ax.tick_params(length=0)
    ax.grid(True, color=GRID, linewidth=0.7)
    ax.set_axisbelow(True)
    for s in ax.spines.values():
        s.set_visible(False)
    # the mirror, silvered on its back
    ax.plot([0.5, 13.5], [0, 0], color="#5dade2", linewidth=5, solid_capstyle="butt", zorder=3, gid="mirror")
    for x in [0.7 + 0.5 * i for i in range(26)]:
        ax.plot([x, x - 0.25], [-0.08, -0.4], color=INK, linewidth=0.9, zorder=3)
    ax.plot([mx, mx], [0, 7.6], color=INK, linewidth=1.2, linestyle=(0, (2, 3)), zorder=2, gid="normal")
    # the torch, pointing down at the mirror, and its beam
    tx, ty = mx - a * k, b * k
    ux, uy = a / math.hypot(a, b), -b / math.hypot(a, b)
    back = (tx - ux * 0.9, ty - uy * 0.9)
    ax.plot([back[0], tx], [back[1], ty], color=INK, linewidth=11, solid_capstyle="round", zorder=4)
    ax.plot([back[0], tx], [back[1], ty], color="#f4d03f", linewidth=8, solid_capstyle="round", zorder=4.1)
    ax.add_patch(Circle((tx, ty), 0.2, facecolor="white", edgecolor=INK, linewidth=1.2, zorder=4.2))
    ax.plot([tx, mx], [ty, 0], color="#e67e22", linewidth=2.2, zorder=3.5, gid="beam")
    cx, cy = (tx + mx) / 2, ty / 2
    nx, ny = -uy, ux
    ax.add_patch(Polygon([(cx + ux * 0.3, cy + uy * 0.3), (cx - ux * 0.15 + nx * 0.18, cy - uy * 0.15 + ny * 0.18),
                          (cx - ux * 0.15 - nx * 0.18, cy - uy * 0.15 - ny * 0.18)], closed=True, facecolor="#e67e22",
                         edgecolor="#e67e22", zorder=3.6))
    for i, (hx, hy) in enumerate(p["heads"]):
        _head(ax, hx, hy, "ABC"[i])
    ax.text(7.0, 8.45, "Light bounces off a mirror at the same angle as it hits it.", ha="center", va="center",
            fontsize=11.5)
    ax.text(mx + 0.15, -0.75, "mirror", ha="left", va="center", fontsize=11)
    ax.set_xlim(0, 14)
    ax.set_ylim(-1.05, 8.9)
    ax.set_aspect("equal")
    return fig


def _bars(ax, labels, values, step, label_every, ylabel, title, printed):
    for i, v in enumerate(values):
        bar = ax.bar(i, v, 0.6, color=FILL, edgecolor=INK, linewidth=1.0)
        bar[0].set_gid(f"bar:{i}")
        if printed:
            ax.text(i, v + 0.02 * max(values), str(v), ha="center", va="bottom", fontsize=11, fontweight="bold")
    top = max(values) * 1.12
    top = math.ceil(top / label_every) * label_every
    ax.set_xticks(range(len(values)))
    ax.set_xticklabels(labels, fontsize=11)
    ax.set_yticks(range(0, top + 1, label_every))
    ax.set_yticks(range(0, top + 1, step), minor=True)
    ax.tick_params(axis="y", labelsize=10.5)
    ax.tick_params(axis="y", which="minor", length=0)
    ax.set_ylim(0, top)
    ax.set_xlim(-0.6, len(values) - 0.4)
    ax.yaxis.grid(True, which="both", color=GRID, linewidth=0.7)
    ax.set_axisbelow(True)
    ax.set_ylabel(ylabel, fontsize=11)
    ax.set_title(title, fontsize=12)


def _draw_surfaces(p: dict):
    fig, ax = new_figure(7.4, 4.8)
    labels = [s.replace("a wooden board", "a wooden\nboard").replace("kitchen foil", "kitchen\nfoil")
              .replace("white paper", "white\npaper").replace("black cloth", "black\ncloth") for s in p["surfaces"]]
    _bars(ax, labels, p["lux"], 50, 100, "Light reflected (lux)", "Light bouncing back from each surface", False)
    return fig


def _draw_planets(p: dict):
    fig, ax = new_figure(7.0, 4.8)
    table = DIST if p["measure"] == "distance" else ORBIT
    values = [table[x] for x in p["planets"]]
    if p["measure"] == "distance":
        _bars(ax, p["planets"], values, 50 if max(values) < 300 else 100, 50 if max(values) < 300 else 200,
              "Distance from the Sun (million km)", "How far each planet is from the Sun", True)
    else:
        _bars(ax, p["planets"], values, 50, 100 if max(values) < 400 else 200, "Days to go round the Sun once",
              "How long each planet takes to go round the Sun", True)
    ax.set_xlabel("Planets in order from the Sun", fontsize=11)
    return fig


def draw(p: dict):
    return {"mirror": _draw_mirror, "surfaces": _draw_surfaces, "planets": _draw_planets}[p["kind"]](p)


# --- questions --------------------------------------------------------------------------------------------------

SETTINGS = ["in a dark classroom", "in the science room", "at home one evening", "in the school hall"]


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    if p["kind"] == "mirror":
        mx, a, b = p["mx"], p["a"], p["b"]
        key = next(i for i, h in enumerate(p["heads"]) if h[0] > mx and (h[0] - mx) * b == h[1] * a)
        return [Question("mcq", f"{who} shines a torch at a mirror on the floor {rng.choice(SETTINGS)}. Which child can see "
                                "the torch's light in the mirror?", str(key), list("ABC"))]
    if p["kind"] == "surfaces":
        surf, lux = p["surfaces"], p["lux"]
        x = rng.choice(surf)
        hi, lo = rng.sample(range(4), 2)
        if lux[hi] < lux[lo]:
            hi, lo = lo, hi
        gaps = [g for g in range(min(lux) + 50, max(lux), 50) if g not in lux]
        n = rng.choice(gaps)
        unit = lambda v: [f"{v} lux", f"{v}lux"]  # noqa: E731
        return [short(f"{who} shines a torch on four surfaces and measures the light that bounces back. How much light "
                      f"did {x} reflect, in lux?", lux[surf.index(x)], unit(lux[surf.index(x)])),
                short(f"How much more light did {surf[hi]} reflect than {surf[lo]}?", lux[hi] - lux[lo], unit(lux[hi] - lux[lo])),
                count(f"How many surfaces reflected more than {n} lux?", sum(v > n for v in lux), "surfaces")]
    planets = p["planets"]
    x = rng.choice(planets)
    far, near = sorted(rng.sample(planets, 2), key=planets.index, reverse=True)
    lead = f"{who} makes a chart about the planets."
    if p["measure"] == "distance":
        km = lambda v: [f"{v} million km", f"{v} million kilometres", f"{v}000000", f"{v} 000 000 km"]  # noqa: E731
        qs = [short(f"{lead} How far is {x} from the Sun, in million kilometres?", DIST[x], km(DIST[x])),
              short(f"How many million kilometres farther from the Sun is {far} than {near}?", DIST[far] - DIST[near],
                    km(DIST[far] - DIST[near]))]
        qs.append(count("How many of the planets in the chart are closer to the Sun than Earth?",
                        sum(DIST[k] < DIST["Earth"] for k in planets), "planets"))
        return qs
    days = lambda v: [f"{v} days"]  # noqa: E731
    return [short(f"{lead} How many days does {x} take to go round the Sun?", ORBIT[x], days(ORBIT[x])),
            short(f"How many more days does {far} take than {near} to go round the Sun?", ORBIT[far] - ORBIT[near],
                  days(ORBIT[far] - ORBIT[near]))]
