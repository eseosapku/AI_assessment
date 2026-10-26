"""Making drinking water safe (P3 to P4, Science and Elementary Technology), of two kinds.

- dose: a bottle of water disinfectant whose label says how much to use ("1 cap for every 10 litres of water"), beside
  two to five jerrycans or buckets, each marked with how many litres it holds. How many litres are there altogether?
  How many caps of disinfectant clean all the water? The label's dose is printed, and the containers are chosen so the
  caps come out whole (and not always one cap a container). The product is a generic one, not a brand.
- filter: a home-made water filter drawn in section, three to five layers from the top -- small stones, coarse sand,
  fine sand, charcoal, and a cloth at the bottom -- each lettered, with a key of what each layer looks like. Which
  letter shows the charcoal layer? Dirty water is poured in at the top: which layer does it pass through last?
"""
from __future__ import annotations

import math
import random

from matplotlib.patches import Circle, FancyArrowPatch, FancyBboxPatch, Polygon, Rectangle

from ..core import INK, NAMES, Question, count, new_figure, short

ID = "drinking_water_p"
KIND = "diagram.template"
SUBJECT = "science"
BANDS = ("P",)
CONCEPTS = ("science.water-purification",)
# A topic whose sections the book lists is reached only if its name or a section names drinking water or its cleaning.
NEEDS = r"drinking water|purif|safe water|clean water|filter|boil"
AVOID = r"science in context|glossary|water pollution|^water$|\bwastes?\b|sexual|reproduction system|hiv"

SIZE = {"jerrycan": 20, "bucket": 10}
ORDER = ["small stones", "coarse sand", "fine sand", "charcoal", "cloth"]


def stages(p: dict) -> tuple[int, int]:
    return (3, 4)


def sample(rng: random.Random) -> dict:
    if rng.random() < 0.5:
        while True:
            container = rng.choice(sorted(SIZE))
            n = rng.randint(2, 5)
            per_cap = rng.choice([5, 10, 20])
            total = SIZE[container] * n
            if total <= 100 and total % per_cap == 0 and total // per_cap <= 10:
                break
        return {"band": "P", "sub": "dose", "container": container, "size": SIZE[container], "count": n,
                "per_cap": per_cap}
    top = sorted(rng.sample(["small stones", "coarse sand", "fine sand"], rng.randint(1, 3)), key=ORDER.index)
    layers = top + ["charcoal", "cloth"]
    letters = rng.sample("ABCDE", len(layers))
    return {"band": "P", "sub": "filter", "layers": layers, "letters": letters}


# --- drawing ----------------------------------------------------------------------------------------------------

def _jerrycan(ax, x: float, y: float, litres: int, i: int) -> None:
    ax.add_patch(FancyBboxPatch((x - 0.68, y), 1.36, 1.25, boxstyle="round,pad=0,rounding_size=0.12",
                                facecolor="#f4d03f", edgecolor=INK, linewidth=1.4, zorder=2, gid=f"can:{i}"))
    ax.add_patch(Rectangle((x + 0.25, y + 1.25), 0.2, 0.16, facecolor="#2e86c1", edgecolor=INK, linewidth=1.2, zorder=2))
    ax.add_patch(Rectangle((x - 0.45, y + 1.08), 0.48, 0.24, facecolor="none", edgecolor=INK, linewidth=2.0, zorder=2.1))
    ax.text(x, y + 0.55, f"{litres} litres", ha="center", va="center", fontsize=10, fontweight="bold", zorder=3)


def _bucket(ax, x: float, y: float, litres: int, i: int) -> None:
    ax.add_patch(Polygon([(x - 0.48, y), (x + 0.48, y), (x + 0.62, y + 1.0), (x - 0.62, y + 1.0)], closed=True,
                         facecolor="#85c1e9", edgecolor=INK, linewidth=1.4, zorder=2, gid=f"can:{i}"))
    ts = [k / 20 for k in range(21)]
    ax.plot([x + 0.62 * math.cos(math.pi * t) for t in ts], [y + 1.0 + 0.38 * math.sin(math.pi * t) for t in ts],
            color=INK, linewidth=1.6, zorder=2)
    ax.text(x, y + 0.5, f"{litres} litres", ha="center", va="center", fontsize=10, fontweight="bold", zorder=3)


def _draw_dose(p: dict):
    fig, ax = new_figure(10.5, 4.0)
    # the bottle and its label
    ax.add_patch(Rectangle((0.55, 0.0), 1.3, 2.1, facecolor="#d5f5e3", edgecolor=INK, linewidth=1.4, zorder=2))
    ax.add_patch(Polygon([(0.75, 2.1), (1.65, 2.1), (1.45, 2.45), (0.95, 2.45)], closed=True, facecolor="#d5f5e3",
                         edgecolor=INK, linewidth=1.4, zorder=2))
    ax.add_patch(Rectangle((0.95, 2.45), 0.5, 0.25, facecolor="#1e8449", edgecolor=INK, linewidth=1.2, zorder=2))
    ax.add_patch(FancyBboxPatch((2.25, 0.35), 3.55, 1.65, boxstyle="round,pad=0,rounding_size=0.12", facecolor="white",
                                edgecolor=INK, linewidth=1.4, zorder=2))
    ax.plot([1.85, 2.25], [1.2, 1.2], color=INK, linewidth=1.2, zorder=1.5)
    ax.text(4.02, 1.62, "Water disinfectant", ha="center", va="center", fontsize=12.5, fontweight="bold", zorder=3)
    ax.text(4.02, 1.12, f"1 cap for every {p['per_cap']} litres", ha="center", va="center", fontsize=12, zorder=3)
    ax.text(4.02, 0.7, "of water", ha="center", va="center", fontsize=12, zorder=3)
    # the containers
    x0 = 6.6
    for i in range(p["count"]):
        x = x0 + i * 1.6
        (_jerrycan if p["container"] == "jerrycan" else _bucket)(ax, x, 0.0, p["size"], i)
    right = x0 + (p["count"] - 1) * 1.6 + 0.85
    ax.text((0.0 + max(right, 10.5)) / 2, 3.15, "Cleaning water to drink", ha="center", va="center", fontsize=14,
            fontweight="bold")
    ax.set_xlim(0.2, max(right, 10.5))
    ax.set_ylim(-0.15, 3.45)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def _pattern(ax, layer: str, x0: float, y0: float, w: float, h: float, gid: str, z: float = 2) -> None:
    """A layer's look: a filled band with its own marks."""
    face = {"small stones": "#d5dbdb", "coarse sand": "#f5cba7", "fine sand": "#fae5d3", "charcoal": "#424949",
            "cloth": "#fdfefe"}[layer]
    ax.add_patch(Rectangle((x0, y0), w, h, facecolor=face, edgecolor=INK, linewidth=1.2, zorder=z, gid=gid))
    rng = random.Random(layer)  # the same marks every time
    if layer == "small stones":
        for k in range(int(w / 0.22)):
            for j in range(int(h / 0.22)):
                ax.add_patch(Circle((x0 + 0.13 + 0.22 * k, y0 + 0.12 + 0.22 * j), 0.08, facecolor="#7f8c8d",
                                    edgecolor=INK, linewidth=0.6, zorder=z + 0.1))
    elif layer in ("coarse sand", "fine sand"):
        n, r = (int(w * h * 30), 0.03) if layer == "coarse sand" else (int(w * h * 70), 0.012)
        for _ in range(n):
            ax.add_patch(Circle((x0 + 0.05 + rng.random() * (w - 0.1), y0 + 0.05 + rng.random() * (h - 0.1)), r,
                                facecolor="#a04000", edgecolor="none", zorder=z + 0.1))
    elif layer == "charcoal":
        for _ in range(int(w * h * 14)):
            cx, cy = x0 + 0.08 + rng.random() * (w - 0.16), y0 + 0.07 + rng.random() * (h - 0.14)
            ax.add_patch(Polygon([(cx - 0.06, cy - 0.04), (cx + 0.05, cy - 0.05), (cx + 0.06, cy + 0.04),
                                  (cx - 0.03, cy + 0.05)], closed=True, facecolor="#17202a", edgecolor="#7f8c8d",
                                 linewidth=0.5, zorder=z + 0.1))
    else:
        for k in range(1, int(w / 0.15)):
            ax.plot([x0 + 0.15 * k, x0 + 0.15 * k - 0.1], [y0 + 0.02, y0 + h - 0.02], color="#aab7b8", linewidth=0.8,
                    zorder=z + 0.1)


def _draw_filter(p: dict):
    layers, letters = p["layers"], p["letters"]
    fig, ax = new_figure(9.0, 5.6)
    h, x0, w = 0.62, 1.4, 1.8
    bottom = 1.0
    top = bottom + h * len(layers)
    # the bottle's wall, open at the top, a spout at the bottom dripping into a cup
    ax.plot([x0, x0, x0 + w, x0 + w], [top + 0.55, bottom, bottom, top + 0.55], color=INK, linewidth=2.0, zorder=3)
    for k, layer in enumerate(layers):
        y = top - h * (k + 1)
        _pattern(ax, layer, x0, y, w, h, f"layer:{k}:{layer}")
        ax.add_patch(Circle((0.55, y + h / 2), 0.22, facecolor="white", edgecolor=INK, linewidth=1.5, zorder=6,
                            gid=f"ring:{k}"))
        ax.text(0.55, y + h / 2, letters[k], ha="center", va="center", fontsize=14, fontweight="bold", zorder=7,
                gid=f"letter:{letters[k]}")
        ax.plot([0.77, x0 - 0.04], [y + h / 2] * 2, color=INK, linewidth=1.0, zorder=5, gid=f"leader:{k}")
    ax.add_patch(Polygon([(x0 + 0.65, bottom), (x0 + w - 0.65, bottom), (x0 + w - 0.8, bottom - 0.3),
                          (x0 + 0.8, bottom - 0.3)], closed=True, facecolor="#d5dbdb", edgecolor=INK, linewidth=1.2,
                         zorder=3))
    for y in (bottom - 0.42, bottom - 0.58):
        ax.add_patch(Circle((x0 + w / 2, y), 0.04, facecolor="#5dade2", edgecolor="none", zorder=3))
    ax.add_patch(Polygon([(x0 + 0.45, 0.0), (x0 + w - 0.45, 0.0), (x0 + w - 0.35, 0.3), (x0 + 0.35, 0.3)],
                         closed=True, facecolor="#d6eaf8", edgecolor=INK, linewidth=1.3, zorder=3))
    ax.text(x0 + w + 0.25, 0.15, "clean water", ha="left", va="center", fontsize=11)
    # dirty water poured in at the top
    ax.add_patch(FancyArrowPatch((x0 + w / 2, top + 1.05), (x0 + w / 2, top + 0.15), arrowstyle="-|>",
                                 mutation_scale=18, color="#7e5109", linewidth=2.0, zorder=4))
    ax.text(x0 + w / 2 + 0.25, top + 0.8, "dirty water poured in", ha="left", va="center", fontsize=11)
    # the key
    kx = 5.3
    ax.text(kx, top + 0.15, "Key", ha="left", va="center", fontsize=12.5, fontweight="bold")
    for k, layer in enumerate(ORDER):
        y = top - 0.55 - 0.6 * k
        _pattern(ax, layer, kx, y - 0.2, 0.8, 0.4, f"key:{layer}")
        ax.text(kx + 1.0, y, layer.capitalize(), ha="left", va="center", fontsize=11.5)
    ax.text((0.3 + 8.4) / 2, top + 1.45, "A water filter", ha="center", va="center", fontsize=14, fontweight="bold")
    ax.set_xlim(0.2, 8.4)
    ax.set_ylim(min(-0.1, top - 0.55 - 0.6 * (len(ORDER) - 1) - 0.35), top + 1.75)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def draw(p: dict):
    return _draw_dose(p) if p["sub"] == "dose" else _draw_filter(p)


# --- questions --------------------------------------------------------------------------------------------------

VERBS = ["looks at", "studies", "talks about", "points at"]
SETTINGS = ["in a science lesson", "at school", "in class", "with a friend", "at home", "for homework"]


def _litres(n: int) -> list[str]:
    return [f"{n} litres", f"{n} l", f"{n} L", f"{n}l", f"{n}L"]


def questions(p: dict, rng: random.Random) -> list:
    who, verb, setting = rng.choice(NAMES), rng.choice(VERBS), rng.choice(SETTINGS)
    if p["sub"] == "dose":
        total = p["size"] * p["count"]
        things = p["container"] + "s"
        return [short(f"{who} {verb} the picture {setting}. How many litres of water are in all the {things}?", total,
                      _litres(total)),
                count(f"Read the label. How many caps of disinfectant are needed for all the water in the {things}?",
                      total // p["per_cap"], "caps")]
    layers, letters = p["layers"], p["letters"]
    asked = rng.choice(layers[:-1])

    def options(right: str) -> list:  # the right letter and three others at most, in order
        return sorted([right, *rng.sample([x for x in letters if x != right], min(3, len(letters) - 1))])

    first, last = letters[layers.index(asked)], letters[-1]
    o1, o2 = options(first), options(last)
    return [Question("mcq", f"{who} {verb} the water filter {setting}. Which letter shows the {asked} layer?",
                     str(o1.index(first)), o1),
            Question("mcq", "Dirty water is poured in at the top of the filter. Which letter shows the layer it "
                            "passes through last?", str(o2.index(last)), o2)]
