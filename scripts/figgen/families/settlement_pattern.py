"""Settlement (LS, UP; P6 geography): the patterns of rural settlement drawn as four small maps, and the growth of an
invented town, as the Rwanda S2 and S4 "Rural and urban settlement in Rwanda" units and S3 "Urban Settlement in Africa"
teach settlement.

Two sub-types:
- patterns: four small maps W to Z, each drawn in one pattern in a shuffled order (nucleated round a crossroads,
  linear along a road, dispersed farms, and a planned grouped village in straight rows, as Rwanda's imidugudu are
  built), beside a table that describes the four and a key. Which pattern a lettered map shows, which map shows a
  described pattern (never the map the first question named), and how many houses a map shows.
- growth: a line graph of the population of Town P every five years from 1980 to 2020, every value on a gridline.
  The rise between two years, the five-year period in which the town grew the most, how many times larger the town
  was in 2020 than in 1980, and the first year the town passed a stated size.

Every key comes from the fixed table of patterns, the counted houses, or values on gridlines.
"""
from __future__ import annotations

import math
import random
import textwrap

from matplotlib.patches import Rectangle

from ..core import INK, NAMES, count, mcq, new_figure, short
from ._bio_parts import letter_choice
from ._geo_charts import line_chart, num_forms

ID = "settlement_pattern"
KIND = "geo.map"
SUBJECT = "geography"
BANDS = ("LS", "UP")
MORE = {"patterns": ("geography.settlement-types", "geography.rural-settlement"),
        "growth": ("geography.urban-growth-expansion", "geography.urban-settlement")}
CONCEPTS = ("geography.settlement-types", "geography.rural-settlement", "geography.urban-growth-expansion",
            "geography.urban-settlement")
# A topic whose sections the book lists is reached only if its name or a section names settlement, towns or urban
# growth.
NEEDS = r"settlement|urban|\btowns?\b"
AVOID = r"photograph|regional"
PATTERNS = ["nucleated", "linear", "dispersed", "planned"]
NAMED = {"nucleated": "Nucleated", "linear": "Linear", "dispersed": "Dispersed", "planned": "Planned (grouped)"}
TABLE = [("Nucleated", "Houses are grouped closely together round a centre, such as a crossroads or a market."),
         ("Linear", "Houses are built in a line along a road, a river or a ridge."),
         ("Dispersed", "Houses stand far apart from each other, each on its own farm."),
         ("Planned (grouped)", "Houses are built in straight rows on a planned layout, as in an umudugudu.")]
ASK = {"nucleated": "houses grouped closely together round a crossroads",
       "linear": "houses built in a line along a road",
       "dispersed": "houses standing far apart, each on its own farm",
       "planned": "houses built in straight rows on a planned layout"}
LETTERS = ["W", "X", "Y", "Z"]
SIDE = 3.0
ORIGIN = {"W": (0.0, 3.6), "X": (3.6, 3.6), "Y": (0.0, 0.0), "Z": (3.6, 0.0)}
HOUSE = 0.16
TOWN = "Town P"
YEARS = [1980, 1985, 1990, 1995, 2000, 2005, 2010, 2015, 2020]


def concepts_for(p: dict) -> tuple[str, ...]:
    return MORE[p["sub"]]


def avoid_for(p: dict) -> str:
    # the patterns of rural settlement are no figure for a unit on towns alone
    return AVOID + (r"|^urban" if p["sub"] == "patterns" else "")


def _apart(pts, gap) -> bool:
    """Every two houses at least `gap` apart across or up and down (so even diagonal neighbours stand clear)."""
    return all(max(abs(a[0] - b[0]), abs(a[1] - b[1])) >= gap for i, a in enumerate(pts) for b in pts[i + 1:])


def _houses(pattern: str, rng: random.Random) -> tuple[list, dict]:
    """House centres in a unit square (roads kept clear), and the roads each map needs."""
    if pattern == "nucleated":
        cx, cy = rng.uniform(0.42, 0.58), rng.uniform(0.42, 0.58)
        n = rng.randint(10, 14)
        pts = []
        for _ in range(3000):
            if len(pts) == n:
                break
            a, r = rng.uniform(0, 2 * math.pi), rng.uniform(0.09, 0.28)
            q = (cx + r * math.cos(a), cy + r * math.sin(a))
            if abs(q[0] - cx) > 0.06 and abs(q[1] - cy) > 0.06 and _apart(pts + [q], 0.09):
                pts.append(q)
        return pts, {"cross": [cx, cy]}
    if pattern == "linear":
        y = rng.uniform(0.4, 0.6)
        n = rng.randint(4, 7)
        xs = sorted(rng.sample(range(1, 10), n))
        pts = [(0.1 * x, y + 0.08) for x in xs] + [(0.1 * x + 0.05, y - 0.08) for x in sorted(rng.sample(range(1, 9),
                                                                                                           rng.randint(3, 6)))]
        return pts, {"road": y}
    if pattern == "dispersed":
        n = rng.randint(5, 8)
        pts = []
        for _ in range(3000):
            if len(pts) == n:
                break
            q = (rng.uniform(0.1, 0.9), rng.uniform(0.1, 0.9))
            if _apart(pts + [q], 0.2):
                pts.append(q)
        return pts, {}
    # a compact block of identical houses in rows and columns, a road all round it and one road out to the edge
    rows, cols, step = rng.randint(3, 4), rng.randint(3, 5), 0.13
    x0, y0 = 0.5 - step * (cols - 1) / 2, 0.55 - step * (rows - 1) / 2
    pts = [(x0 + step * c, y0 + step * r) for r in range(rows) for c in range(cols)]
    ring = [x0 - 0.1, y0 - 0.1, x0 + step * (cols - 1) + 0.1, y0 + step * (rows - 1) + 0.1]
    return pts, {"ring": [round(v, 4) for v in ring]}


def _patterns(rng: random.Random, band: str) -> dict:
    order = PATTERNS[:]
    rng.shuffle(order)
    maps = dict(zip(LETTERS, order))
    houses, roads = {}, {}
    for L, pat in maps.items():
        pts, extra = _houses(pat, rng)
        houses[L] = [[round(x, 4), round(y, 4)] for x, y in pts]
        roads[L] = extra
    first = rng.choice(LETTERS)
    second = rng.choice([L for L in LETTERS if L != first])
    return {"band": band, "sub": "patterns", "maps": maps, "houses": houses, "roads": roads,
            "ask": {"what": first, "which": maps[second], "count": rng.choice(LETTERS)}}


def _growth(rng: random.Random, band: str) -> dict | None:
    """Thousands of people, every value a multiple of 5; the town in 2020 a whole number of times its size in 1980."""
    start = rng.choice([20, 25, 30, 40, 50])
    final = start * rng.randint(3, 5)
    if final > 240:
        return None
    units = (final - start) // 5
    if units < 8:
        return None
    cuts = sorted(rng.sample(range(1, units), 7))
    steps = [5 * (b - a) for a, b in zip([0] + cuts, cuts + [units])]
    ranked = sorted(steps, reverse=True)
    if ranked[0] - ranked[1] < 10:
        return None
    vals = [start]
    for st in steps:
        vals.append(vals[-1] + st)
    marks = [v + 5 for v in vals[1:-2] if v + 5 not in vals]
    if not marks:
        return None
    i, j = sorted(rng.sample(range(9), 2))
    return {"band": band, "sub": "growth", "pop": vals, "mark": rng.choice(marks), "ask": {"rise": [i, j]}}


def sample(rng: random.Random) -> dict:
    band = rng.choice(BANDS)
    if rng.random() < 0.5:
        return _patterns(rng, band)
    while True:
        p = _growth(rng, band)
        if p:
            return p


# --- drawing -----------------------------------------------------------------------------------------------------------

ROAD = "#9e9e9e"
FARM = "#eef5e1"


def _road(ax, pts, L):
    ax.plot(*zip(*pts), color=ROAD, linewidth=4.0, solid_capstyle="butt", zorder=2, gid=f"road:{L}")


def _draw_map(ax, L, pat, p):
    ox, oy = ORIGIN[L]
    ax.add_patch(Rectangle((ox, oy), SIDE, SIDE, facecolor=FARM, edgecolor=INK, linewidth=1.1, zorder=0.5,
                           gid=f"map:{L}"))
    ax.text(ox + SIDE / 2, oy + SIDE + 0.12, f"Map {L}", ha="center", va="bottom", fontsize=11, fontweight="bold")
    to = lambda u, v: (ox + SIDE * u, oy + SIDE * v)  # noqa: E731
    extra = p["roads"][L]
    if pat == "nucleated":
        cx, cy = extra["cross"]
        _road(ax, [to(0.0, cy), to(1.0, cy)], L)
        _road(ax, [to(cx, 0.0), to(cx, 1.0)], L)
    elif pat == "linear":
        _road(ax, [to(0.0, extra["road"]), to(1.0, extra["road"])], L)
    elif pat == "planned":
        a, b, c, d = extra["ring"]
        _road(ax, [to(a, b), to(c, b), to(c, d), to(a, d), to(a, b)], L)
        _road(ax, [to((a + c) / 2, b), to((a + c) / 2, 0.0)], L)
    for x, y in p["houses"][L]:
        hx, hy = to(x, y)
        ax.add_patch(Rectangle((hx - HOUSE / 2, hy - HOUSE / 2), HOUSE, HOUSE, facecolor="#b03a2e", edgecolor=INK,
                               linewidth=0.7, zorder=3, gid=f"house:{L}"))


def _draw_table(ax):
    x0, x1, xm = 7.3, 14.9, 9.75
    top, row = 6.6, 1.25
    ax.text(x0 + 0.1, top + 0.12, "Settlement patterns", ha="left", va="bottom", fontsize=10.5, fontweight="bold")
    ax.plot([x0, x1, x1, x0, x0], [top, top, top - 4 * row, top - 4 * row, top], color=INK, linewidth=1.0, gid="table")
    ax.plot([xm, xm], [top, top - 4 * row], color=INK, linewidth=0.8, gid="table")
    for k, (name, words) in enumerate(TABLE):
        y = top - (k + 0.5) * row
        if k:
            ax.plot([x0, x1], [top - k * row, top - k * row], color=INK, linewidth=0.8, gid="table")
        ax.text(x0 + 0.15, y, name.replace(" (", "\n("), ha="left", va="center", fontsize=10, fontweight="bold")
        ax.text(xm + 0.15, y, "\n".join(textwrap.wrap(words, 36)), ha="left", va="center", fontsize=9.3, linespacing=1.2)


def _draw_key(ax):
    y = -0.7
    ax.text(-0.05, y, "Key:", ha="left", va="center", fontsize=9.5, fontweight="bold")
    ax.add_patch(Rectangle((0.95 - HOUSE / 2, y - HOUSE / 2), HOUSE, HOUSE, facecolor="#b03a2e", edgecolor=INK,
                           linewidth=0.7, zorder=3))
    ax.text(1.2, y, "house", ha="left", va="center", fontsize=9)
    ax.plot([2.4, 3.0], [y, y], color=ROAD, linewidth=4.0, solid_capstyle="butt", gid="key-road")
    ax.text(3.15, y, "road", ha="left", va="center", fontsize=9)
    ax.add_patch(Rectangle((4.3, y - 0.1), 0.45, 0.2, facecolor=FARM, edgecolor=INK, linewidth=0.8))
    ax.text(4.9, y, "farmland", ha="left", va="center", fontsize=9)


def draw(p: dict):
    if p["sub"] == "growth":
        top = -(-(max(p["pop"]) + 10) // 20) * 20
        fig, _ = line_chart(YEARS, {"population": p["pop"]}, top=top, major=20, minor=5,
                            ylabel="Population (thousands)", xlabel="Year", title=f"The population of {TOWN}",
                            size=(8.2, 5.4))
        return fig
    fig, ax = new_figure(10.4, 6.6)
    for L, pat in p["maps"].items():
        _draw_map(ax, L, pat, p)
    _draw_table(ax)
    _draw_key(ax)
    ax.set_xlim(-0.2, 15.05)
    ax.set_ylim(-1.1, 7.2)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


INTROS = ["{name} drew these four maps of villages {setting}.", "{name} is comparing these four settlement maps {setting}.",
          "{name} copied these maps of four villages {setting}.", "{name} sketched four rural settlements {setting}."]
SETTINGS = ["for a geography lesson", "for homework", "for a project on settlement", "after a fieldwork walk",
            "at the geography club in Huye", "while revising in Kigali", "for a class display in Nyamagabe",
            "after a lesson on rural settlement"]
VERBS = ["studies", "reads", "looks at", "copies", "is given"]


def questions(p: dict, rng: random.Random) -> list:
    name = rng.choice(NAMES)
    if p["sub"] == "patterns":
        maps = p["maps"]
        at = {v: k for k, v in maps.items()}
        intro = rng.choice(INTROS).format(name=name, setting=rng.choice(SETTINGS))
        L = p["ask"]["what"]
        pat = p["ask"]["which"]
        C = p["ask"]["count"]
        return [
            mcq(f"{intro} Using the table, which settlement pattern does map {L} show?", NAMED[maps[L]],
                [NAMED[k] for k in PATTERNS if k != maps[L]], rng),
            letter_choice(f"Using the table of settlement patterns, which map shows {ASK[pat]}?", at[pat],
                          [k for k in LETTERS if k != at[pat]]),
            count(f"How many houses are there in map {C} of the four settlement maps?", len(p["houses"][C]), "houses"),
        ]
    lead = f"{name} {rng.choice(VERBS)} this graph of the population of {TOWN} {rng.choice(SETTINGS)}."
    v = p["pop"]
    i, j = p["ask"]["rise"]
    steps = [b - a for a, b in zip(v, v[1:])]
    best = steps.index(max(steps))
    period = lambda k: f"{YEARS[k]} to {YEARS[k + 1]}"  # noqa: E731
    first = next(k for k, x in enumerate(v) if x > p["mark"])
    return [
        short(f"{lead} By how many thousand people did the population of {TOWN} grow from {YEARS[i]} to {YEARS[j]}?",
              v[j] - v[i], num_forms(v[j] - v[i], "thousand", "thousand people") + [str((v[j] - v[i]) * 1000)]),
        mcq(f"In which five-year period did the population of {TOWN} grow the most?", period(best),
            [period(k) for k in sorted(range(8), key=lambda k: -steps[k])[1:4]], rng),
        short(f"How many times larger was the population of {TOWN} in 2020 than in 1980?", v[-1] // v[0],
              num_forms(v[-1] // v[0], "times")),
        mcq(f"In which year shown on the graph did the population of {TOWN} first go above {p['mark']} thousand?",
            str(YEARS[first]), [str(YEARS[k]) for k in sorted(range(9), key=lambda k: (abs(k - first), k))[1:4]], rng),
    ]
