"""Sectors of production (LS, UP): two sub-types.

- chain: a chain of production for a Rwandan product (coffee, milk, cotton, timber, tea, maize, fish) as four to six
  lettered boxes joined by arrows, each saying what happens at that stage ("A sawmill saws the logs into planks"). Each
  stage's sector comes from a fixed table a teacher would agree with: growing, catching and planting are primary;
  processing and making things in a washing station, a factory or a mill secondary; carrying, advertising, selling
  and insuring tertiary. A bank's loan is no stage of a chain and a tailor was read as a service (P4 blind review), so
  neither is drawn. Which lettered stage is in the secondary or the tertiary sector (only where exactly one stage is),
  which sector a lettered stage is in, and how many stages are in the other of the two sectors.
- chart: the share of workers, or of output, in each sector for an invented country (Country P, Q, R or S; never a
  real one) in two years, as a grouped bar chart on 5% gridlines or as two pie charts with each share printed. The
  share of a sector in a year, the change in a sector's share in percentage points between the years, and which
  sector was largest in a year or grew the most (never a tie).
"""
from __future__ import annotations

import math
import random

from matplotlib.patches import FancyArrowPatch, FancyBboxPatch, Wedge

from ..core import GRID, INK, NAMES, count, mcq, new_figure, short

ID = "sectors_chain"
KIND = "process.flow"
SUBJECT = "business"
BANDS = ("LS", "UP")
CONCEPTS = ("business.sectors-of-production", "business.production-of-goods-and-services")
# A topic whose sections the book lists is reached only if its name or a section names the sectors.
NEEDS = r"sector|business activit|classification of business|chain of production"
# Share the sectors concept but teach forms of business, the environment, careers, resources or markets.
AVOID = r"forms of business|environment|career|resources|market"

SECTORS = ("primary", "secondary", "tertiary")
# Each chain in its order: (what happens at the stage, its sector, whether a chain may leave it out). The stages a
# chain always keeps read as a whole chain on their own.
CHAINS = {
    "coffee": [("Farmers grow and pick coffee cherries", "primary", False),
               ("A washing station washes and dries the beans", "secondary", False),
               ("A factory roasts and packs the coffee", "secondary", True),
               ("Lorries carry the coffee to Kigali", "tertiary", False),
               ("A company advertises the coffee on the radio", "tertiary", True),
               ("A supermarket sells the coffee to shoppers", "tertiary", False)],
    "milk": [("Farmers keep cows and milk them", "primary", False),
             ("A dairy pasteurises the milk and makes yoghurt", "secondary", False),
             ("A van delivers the yoghurt to shops", "tertiary", False),
             ("A company advertises the yoghurt on the radio", "tertiary", True),
             ("A shop sells the yoghurt to families", "tertiary", False)],
    "cotton": [("Farmers grow and pick cotton", "primary", False),
               ("A ginning factory removes the seeds from the cotton", "secondary", True),
               ("A textile mill spins and weaves the cotton into cloth", "secondary", False),
               ("A garment factory sews school uniforms from the cloth", "secondary", False),
               ("A lorry delivers the uniforms to Huye", "tertiary", True),
               ("A market trader sells the uniforms to parents", "tertiary", False)],
    "timber": [("Workers plant trees and cut them down", "primary", False),
               ("A sawmill saws the logs into planks", "secondary", False),
               ("A carpenter makes desks and chairs", "secondary", False),
               ("A lorry delivers the desks to schools", "tertiary", True),
               ("A furniture shop sells chairs to families", "tertiary", False)],
    "tea": [("Farmers grow and pick tea leaves", "primary", False),
            ("A tea factory dries and packs the leaves", "secondary", False),
            ("A lorry carries the tea to the port of Mombasa", "tertiary", False),
            ("An insurance company insures the tea on the way", "tertiary", True),
            ("A supermarket sells the tea to shoppers", "tertiary", True)],
    "maize": [("Farmers grow and harvest maize", "primary", False),
              ("A mill grinds the maize into flour", "secondary", False),
              ("A factory makes maize porridge flour with added vitamins", "secondary", True),
              ("A wholesaler buys the flour in bulk", "tertiary", False),
              ("A kiosk sells the flour in small bags", "tertiary", False)],
    "fish": [("Fishermen catch tilapia in Lake Kivu", "primary", False),
             ("A factory cleans, freezes and packs the fish", "secondary", False),
             ("A truck carries the fish to Kigali", "tertiary", False),
             ("A supermarket sells the fish to shoppers", "tertiary", False)],
}
YEARS = [[1990, 2020], [1995, 2020], [2000, 2020], [2000, 2022], [2002, 2022], [2005, 2023]]
COUNTRIES = ["P", "Q", "R", "S"]
MEASURES = {"workers": ("Share of workers by sector of production", "Workers (%)"),
            "output": ("Share of output (GDP) by sector of production", "Output (%)")}


def _chain(rng: random.Random, band: str) -> dict:
    product = rng.choice(list(CHAINS))
    stages = CHAINS[product]
    must = [i for i, st in enumerate(stages) if not st[2]]
    may = [i for i, st in enumerate(stages) if st[2]]
    while True:
        k = rng.randint(max(4, len(must)), min(6, len(stages)))
        keep = sorted(must + rng.sample(may, k - len(must)))
        chosen = [[stages[i][0], stages[i][1]] for i in keep]
        secs = [s for _, s in chosen]
        if any(secs.count(x) == 1 for x in ("secondary", "tertiary")) and "secondary" in secs and "tertiary" in secs:
            return {"band": band, "kind": "chain", "product": product, "stages": chosen}


def _chart(rng: random.Random, band: str) -> dict:
    while True:
        p1 = 5 * rng.randint(9, 15)
        s1 = 5 * rng.randint(2, 5)
        t1 = 100 - p1 - s1
        p2 = p1 - 5 * rng.randint(2, 6)
        s2 = s1 + 5 * rng.randint(0, 3)
        t2 = 100 - p2 - s2
        rows = [[p1, s1, t1], [p2, s2, t2]]
        if min(t1, t2, s1, s2, p2) < 5 or any(len(set(r)) < 3 for r in rows):
            continue
        d = [b - a for a, b in zip(*rows)]
        if sorted(d)[-1] == sorted(d)[-2]:
            continue
        return {"band": band, "kind": "chart", "chart": rng.choice(["bars", "pies"]),
                "measure": rng.choice(list(MEASURES)), "country": rng.choice(COUNTRIES), "years": rng.choice(YEARS),
                "shares": rows}


def sample(rng: random.Random) -> dict:
    band = rng.choice(BANDS)
    return _chain(rng, band) if rng.random() < 0.5 else _chart(rng, band)


def _wrap(text: str, width: int = 17) -> str:
    lines, line = [], ""
    for w in text.split():
        if line and len(line) + 1 + len(w) > width:
            lines.append(line)
            line = w
        else:
            line = f"{line} {w}".strip()
    lines.append(line)
    return "\n".join(lines)


def _draw_chain(p: dict):
    stages = p["stages"]
    n = len(stages)
    bw, gap, bh = 1.8, 0.55, 1.35
    width = n * bw + (n - 1) * gap
    fig, ax = new_figure(1.0 + 0.95 * width, 3.0)
    ax.text(width / 2, 2.35, f"Chain of production for {p['product']}", ha="center", va="center", fontsize=12,
            fontweight="bold")
    for i, (text, _) in enumerate(stages):
        x = i * (bw + gap)
        ax.add_patch(FancyBboxPatch((x, 0), bw, bh, boxstyle="round,pad=0,rounding_size=0.08", facecolor="#eef1f4",
                                    edgecolor=INK, linewidth=1.1))
        ax.text(x + bw / 2, bh / 2, _wrap(text), ha="center", va="center", fontsize=9.5, linespacing=1.25)
        ax.add_patch(plt_circle((x + bw / 2, bh + 0.4), 0.22))
        ax.text(x + bw / 2, bh + 0.4, "ABCDEF"[i], ha="center", va="center", fontsize=11, fontweight="bold")
        if i < n - 1:
            ax.add_patch(FancyArrowPatch((x + bw + 0.04, bh / 2), (x + bw + gap - 0.04, bh / 2), arrowstyle="-|>",
                                         mutation_scale=14, color=INK, linewidth=1.4))
    ax.set_xlim(-0.1, width + 0.1)
    ax.set_ylim(-0.1, 2.65)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def plt_circle(centre, r):
    from matplotlib.patches import Circle
    return Circle(centre, r, facecolor="white", edgecolor=INK, linewidth=1.2)


SHADES = ["#5f6b77", "#aab4be", "#e3e7eb"]


def _draw_bars(p: dict):
    fig, ax = new_figure(6.6, 4.4)
    (y1, y2), rows = p["years"], p["shares"]
    top = max(max(r) for r in rows) + 10
    top += (-top) % 10
    w = 0.36
    for k, (yr, row, shade) in enumerate(zip((y1, y2), rows, ("#c9d0d7", "#5f6b77"))):
        ax.bar([i + (k - 0.5) * w for i in range(3)], row, width=w, color=shade, edgecolor=INK, linewidth=1.0,
               label=str(yr), zorder=3)
    ax.set_xticks(range(3))
    ax.set_xticklabels([s.capitalize() for s in SECTORS], fontsize=10)
    ax.set_yticks(range(0, top + 1, 10))
    ax.set_yticks(range(0, top + 1, 5), minor=True)
    ax.tick_params(which="minor", length=0)
    ax.tick_params(axis="y", labelsize=9)
    ax.yaxis.grid(True, which="both", color=GRID, linewidth=0.7)
    ax.set_axisbelow(True)
    ax.set_ylim(0, top)
    ax.set_xlim(-0.6, 2.6)
    title, ylabel = MEASURES[p["measure"]]
    ax.set_ylabel(ylabel)
    ax.set_xlabel("Sector of production")
    ax.set_title(f"{title} in Country {p['country']}", fontsize=11, pad=10)
    ax.legend(title="Year", fontsize=9, title_fontsize=9, loc="upper right", frameon=True)
    return fig


def _draw_pies(p: dict):
    fig, ax = new_figure(10.0, 4.4)
    (y1, y2), rows = p["years"], p["shares"]
    for cx, yr, row in ((-2.1, y1, rows[0]), (2.1, y2, rows[1])):
        angle = 90.0
        for i, (sec, v) in enumerate(zip(SECTORS, row)):
            sweep = 3.6 * v
            ax.add_patch(Wedge((cx, 0), 1.0, angle - sweep, angle, facecolor=SHADES[i], edgecolor=INK, linewidth=1.0))
            mid = math.radians(angle - sweep / 2)
            x, y = cx + 1.13 * math.cos(mid), 1.13 * math.sin(mid)
            ax.text(x, y, f"{sec.capitalize()} {v}%", ha="left" if math.cos(mid) >= 0 else "right", va="center",
                    fontsize=9.5)
            angle -= sweep
        ax.text(cx, -1.55, str(yr), ha="center", va="center", fontsize=11, fontweight="bold")
    title, _ = MEASURES[p["measure"]]
    ax.text(0, 1.55, f"{title} in Country {p['country']}", ha="center", va="center", fontsize=11)
    ax.set_xlim(-4.5, 4.5)
    ax.set_ylim(-1.75, 1.75)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def draw(p: dict):
    if p["kind"] == "chain":
        return _draw_chain(p)
    return _draw_bars(p) if p["chart"] == "bars" else _draw_pies(p)


VERBS = ["studies", "is given", "looks at", "reads", "copies"]
SETTINGS = ["in a business studies lesson", "for homework", "for a class test", "for a group project",
            "before a visit to a factory", "for revision"]


def _chain_questions(p: dict, rng: random.Random, who: str) -> list:
    product = p["product"]
    secs = [s for _, s in p["stages"]]
    letters = "ABCDEF"[:len(secs)]
    one = rng.choice([x for x in ("secondary", "tertiary") if secs.count(x) == 1])
    key = letters[secs.index(one)]
    wrong = [x for x in letters if x != key]
    rng.shuffle(wrong)
    ask = rng.choice(letters[1:])
    named = secs[letters.index(ask)].capitalize()
    tally = "tertiary" if one == "secondary" else "secondary"  # the other sector, so the count is not the first key
    return [
        mcq(f"{who} {rng.choice(VERBS)} this chain of production for {product} {rng.choice(SETTINGS)}. "
            f"Which lettered stage is in the {one} sector?", key, wrong, rng),
        mcq(f"In the chain of production for {product}, which sector is stage {ask} in?", named,
            [s.capitalize() for s in SECTORS if s.capitalize() != named], rng),
        count(f"How many stages of the {product} chain of production are in the {tally} sector?", secs.count(tally),
              "stages"),
    ]


def _chart_questions(p: dict, rng: random.Random, who: str) -> list:
    (y1, y2), rows, c = p["years"], p["shares"], p["country"]
    noun = p["measure"]
    sec = rng.randrange(3)
    k = rng.randrange(2)
    v = rows[k][sec]
    asked = (f"What percentage of workers were in the {SECTORS[sec]} sector in {(y1, y2)[k]}?" if noun == "workers"
             else f"What percentage of output came from the {SECTORS[sec]} sector in {(y1, y2)[k]}?")
    d = [b - a for a, b in zip(*rows)]
    moved = rng.choice([i for i in range(3) if d[i] != 0 and i != sec] or [i for i in range(3) if d[i] != 0])
    way = "rise" if d[moved] > 0 else "fall"
    names = [s.capitalize() for s in SECTORS]
    if rng.random() < 0.5:
        yr = rng.randrange(2)
        row = rows[yr]
        key = names[row.index(max(row))]
        third = mcq(f"In Country {c}, which sector had the largest share of {noun} in {(y1, y2)[yr]}?", key,
                    [x for x in names if x != key], rng)
    else:
        key = names[d.index(max(d))]
        third = mcq(f"In Country {c}, which sector's share of {noun} rose the most from {y1} to {y2}?", key,
                    [x for x in names if x != key], rng)
    return [
        short(f"{who} {rng.choice(VERBS)} this chart for Country {c} {rng.choice(SETTINGS)}. {asked}", v,
              [f"{v}%", f"{v} %", f"{v} percent"]),
        short(f"By how many percentage points did the {SECTORS[moved]} sector's share of {noun} in Country {c} "
              f"{way} from {y1} to {y2}?", abs(d[moved]), [f"{abs(d[moved])}%", f"{abs(d[moved])} percentage points",
                                                         f"{abs(d[moved])} points"]),
        third,
    ]


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    return _chain_questions(p, rng, who) if p["kind"] == "chain" else _chart_questions(p, rng, who)
