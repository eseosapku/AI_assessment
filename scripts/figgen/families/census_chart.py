"""Rwanda's population by province from its censuses (LS, UP): a bar chart (upright or sideways) or a table of the 2022
or the 2012 Population and Housing Census, or of both side by side, on gridlines with every value printed. The counts
are the census's own, rounded to the nearest 10,000 and given in thousands; the figure says so, and names its source.

The most (or least) populous province, how many more people lived in one province than another, the total shown,
and one province's share of it as a whole percent (never one near a rounding boundary). With both censuses: the
province that grew the most, and by how much one province grew.

2012's Eastern and Southern provinces differ by under 6,000 people: the most populous province of 2012 is never asked.
"""
from __future__ import annotations

import random

from matplotlib.patches import Rectangle

from ..core import FILL, FILL_2, GRID, INK, NAMES, mcq, new_figure, short

ID = "census_chart"
KIND = "graph.bar"
SUBJECT = "social-studies"
BANDS = ("LS", "UP")
# GSCS S4 "Environmental Management and Population Dynamics" carries no population concept of its own: NEEDS keeps
# environmental management to the topics that name population.
CONCEPTS = ("social-studies.population", "social-studies.environmental-management")
ALSO = ("geography.population-distribution-density", "geography.population-growth")
NEEDS = r"population|census|demograph|statistical graph"
# Topics on other countries and regions, or on HIV, share the population concepts without teaching Rwanda's census.
AVOID = r"africa|world|hiv|regional|human geography|nigeria"
MIN_VARIETY = 14  # real counts: two censuses, three ways of drawing them and three orders, not a numeric family

PROVINCES = ["City of Kigali", "Southern", "Western", "Northern", "Eastern"]  # NISR's order
LONG = {"City of Kigali": "the City of Kigali", "Southern": "Southern Province", "Western": "Western Province",
        "Northern": "Northern Province", "Eastern": "Eastern Province"}
# Source: NISR, Rwanda Population and Housing Census: the 4th (2012) and the 5th (2022), resident population by
# province. Each year's provinces add to its national total (2012: 10,515,973; 2022: 13,246,394).
CENSUS = {
    2012: {"City of Kigali": 1132686, "Southern": 2589975, "Western": 2471239, "Northern": 1726370, "Eastern": 2595703},
    2022: {"City of Kigali": 1745555, "Southern": 3002699, "Western": 2896484, "Northern": 2038511, "Eastern": 3563145},
}


def shown(v: int) -> int:
    """A census count as the figure prints it: to the nearest 10,000, in thousands."""
    return (v + 5000) // 10000 * 10


def sample(rng: random.Random) -> dict:
    year = rng.choice([2022, 2022, 2012, "both"])
    years = [2012, 2022] if year == "both" else [year]
    style = rng.choice(["bar", "barh", "table"])
    order = rng.choice(["census", "largest", "alphabetical"])
    return {"band": rng.choice(BANDS), "year": year, "style": style, "order": order,
            "values": {str(y): {k: shown(v) for k, v in CENSUS[y].items()} for y in years}}


def _order(p: dict) -> list[str]:
    last = p["values"][max(p["values"])]
    if p["order"] == "largest":
        return sorted(PROVINCES, key=lambda k: -last[k])
    if p["order"] == "alphabetical":
        return sorted(PROVINCES, key=lambda k: k.replace("City of ", ""))
    return list(PROVINCES)


def _label(k: str) -> str:
    return "City of\nKigali" if k == "City of Kigali" else k


def _title(p: dict) -> str:
    return "Population of Rwanda by province, " + ("2012 and 2022 Censuses" if p["year"] == "both" else f"{p['year']} Census")


NOTE = "Source: NISR, Population and Housing Census. Figures rounded to the nearest 10,000."


def draw(p: dict):
    order = _order(p)
    years = sorted(p["values"])
    if p["style"] == "table":
        return _table(p, order, years)
    fig, ax = new_figure(7.2, 4.8)
    both = len(years) == 2
    width = 0.38 if both else 0.6
    for j, y in enumerate(years):
        vals = [p["values"][y][k] for k in order]
        shift = (j - 0.5) * width if both else 0
        pos = [i + shift for i in range(len(order))]
        colour = (FILL_2, FILL)[j] if both else FILL
        if p["style"] == "bar":
            ax.bar(pos, vals, width=width, color=colour, edgecolor=INK, label=y)
            for x, v in zip(pos, vals):
                ax.text(x, v + 60, f"{v:,}", ha="center", va="bottom", fontsize=8 if both else 9)
        else:
            ax.barh(pos, vals, height=width, color=colour, edgecolor=INK, label=y)
            for x, v in zip(pos, vals):
                ax.text(v + 50, x, f"{v:,}", ha="left", va="center", fontsize=8 if both else 9)
    names = [_label(k) for k in order]
    axis = ax.yaxis if p["style"] == "bar" else ax.xaxis
    biggest = max(v for y in years for v in p["values"][y].values())
    top = -(-(biggest + (450 if p["style"] == "barh" else 250)) // 500) * 500  # room for the printed values
    if p["style"] == "bar":
        ax.set_xticks(range(len(order)), names)
        ax.set_yticks(range(0, top + 1, 500))
        ax.set_ylim(0, top)
        ax.set_ylabel("Population (thousands)")
        ax.set_xlabel("Province")
    else:
        ax.set_yticks(range(len(order)), names)
        ax.set_xticks(range(0, top + 1, 500))
        ax.set_xlim(0, top)
        ax.set_ylim(len(order) - 0.5, -0.5)  # the first province at the top
        ax.set_xlabel("Population (thousands)")
    axis.grid(True, color=GRID, linewidth=0.6)
    ax.set_axisbelow(True)
    ax.tick_params(labelsize=9)
    if both:  # beside the plot, where no bar or printed value can reach it
        ax.legend(title="Census", fontsize=9, title_fontsize=9, frameon=False, loc="upper left", bbox_to_anchor=(1.01, 1.0))
    ax.set_title(_title(p), fontsize=11.5)
    # the source just under the axis label, wherever the province names have put it
    ax.annotate(NOTE, xy=(0.5, 0), xycoords=ax.xaxis.label, xytext=(0, -6), textcoords="offset points", ha="center",
                va="top", fontsize=8.5, style="italic")
    return fig


def _table(p: dict, order: list[str], years: list[str]):
    fig, ax = new_figure(6.4 if len(years) == 2 else 5.0, 3.4)
    cols = [("Province", 2.6)] + [(f"{y} Census\n(thousands)" if len(years) == 2 else "Population\n(thousands)", 1.8) for y in years]
    rh, head = 0.5, 0.8
    n = len(order)
    top = head + n * rh
    x = 0.0
    for c, (name, w) in enumerate(cols):
        ax.add_patch(Rectangle((x, n * rh), w, head, facecolor="#d9dee3", edgecolor=INK, linewidth=1.0))
        ax.text(x + w / 2, n * rh + head / 2, name, ha="center", va="center", fontsize=9.5, fontweight="bold", linespacing=1.15)
        for r, k in enumerate(order):
            y = (n - 1 - r) * rh
            ax.add_patch(Rectangle((x, y), w, rh, facecolor="white", edgecolor=INK, linewidth=0.8))
            if c == 0:
                ax.text(x + 0.12, y + rh / 2, k, ha="left", va="center", fontsize=10)
            else:
                ax.text(x + w - 0.15, y + rh / 2, f"{p['values'][years[c - 1]][k]:,}", ha="right", va="center", fontsize=10)
        x += w
    ax.text(x / 2, -0.35, NOTE, ha="center", va="center", fontsize=8.5, style="italic")
    ax.set_xlim(-0.1, x + 0.1)
    ax.set_ylim(-0.6, top + 0.15)
    ax.axis("off")
    ax.set_title(_title(p), fontsize=11.5)
    return fig


# --- questions --------------------------------------------------------------------------------------

SETTINGS = ["in a geography lesson", "for homework", "in a citizenship lesson", "on a revision card", "before a class test",
            "for a project on Rwanda's population"]
VERBS = ["studies", "reads", "looks at", "copies"]


def _thousands(n: int) -> list[str]:
    return [f"{n} thousand", f"{n:,} thousand", f"{n * 1000}", f"{n * 1000:,}", f"{n * 1000:,}".replace(",", " ")]


def _near(v: dict, key: str) -> list[str]:
    """The other provinces, nearest in population first: the likeliest misreadings."""
    return [LONG[k] for k in sorted(v, key=lambda k: abs(v[k] - v[key])) if k != key]


def _share_ok(v: dict, k: str) -> bool:
    share = 100 * v[k] / sum(v.values())
    return abs(share - int(share) - 0.5) >= 0.1


def questions(p: dict, rng: random.Random) -> list:
    who, friend = rng.sample(NAMES, 2)
    thing = "table" if p["style"] == "table" else "chart"
    vals = {int(y): v for y, v in p["values"].items()}
    qs = []
    if p["year"] == "both":
        growth = {k: vals[2022][k] - vals[2012][k] for k in PROVINCES}
        top = max(growth, key=growth.get)
        qs.append(mcq(f"{who} {rng.choice(VERBS)} this {thing} of Rwanda's 2012 and 2022 censuses {rng.choice(SETTINGS)}. "
                      f"Which province's population grew the most between 2012 and 2022?", LONG[top], _near(growth, top), rng))
        k = rng.choice(PROVINCES)
        qs.append(short(f"By how many thousand did the population of {LONG[k]} grow between 2012 and 2022?", growth[k],
                        _thousands(growth[k])))
        year = rng.choice([2012, 2022])
    else:
        year = p["year"]
        v = vals[year]
        most = year == 2022 and rng.random() < 0.6  # 2012's two largest provinces are 10 thousand apart: never asked
        key = (max if most else min)(v, key=v.get)
        qs.append(mcq(f"{who} {rng.choice(VERBS)} this {thing} of Rwanda's {year} census {rng.choice(SETTINGS)}. "
                      f"Which province had the {'most' if most else 'fewest'} people?", LONG[key], _near(v, key), rng))
        a, b = rng.choice([(a, b) for a in PROVINCES for b in PROVINCES if v[a] - v[b] >= 100])
        d = v[a] - v[b]
        qs.append(short(f"How many more people lived in {LONG[a]} than in {LONG[b]} in {year}, in thousands?", d, _thousands(d)))
    v = vals[year]
    total = sum(v.values())
    qs.append(short(f"{friend} adds up the five provinces for {year}. What total population does the {thing} show, in thousands?",
                    total, _thousands(total)))
    k = rng.choice([k for k in PROVINCES if _share_ok(v, k)])
    pct = round(100 * v[k] / total)
    qs.append(short(f"What percentage of the population shown for {year} lived in {LONG[k]}? Give your answer to the nearest "
                    f"whole number.", pct, [f"{pct}%", f"{pct} %"]))
    return qs
