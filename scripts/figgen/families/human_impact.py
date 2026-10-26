"""Human effects on ecosystems (LS, UP), three sub-types, all with invented places:

- river: dissolved oxygen sampled every kilometre along a river, with an outlet (a sewage works, a coffee washing
  station, a sugar factory) between two sampling points, and below it the mayfly nymphs (a clean-water animal)
  counted at each point; where the oxygen was lowest, a reading, a count, and where the oxygen first got back to its
  level above the outlet;
- forest: a district's forest cover every five years, falling until a tree-planting programme began and rising
  after; the year it was smallest, a fall, the percentage fall to that year, and the forest gained since;
- species: the numbers of an endangered animal in a park every two years, falling until patrols against poaching
  began and rising after; the year of the fewest, a reading, and the mean increase per year since the patrols began.

Every value asked sits on a gridline at a marked point; the smallest value is never tied; the percentage and the
mean increase come out whole.
"""
from __future__ import annotations

import random

from ..core import FILL, GRID, INK, NAMES, new_figure, short

ID = "human_impact"
KIND = "graph.line"
SUBJECT = "biology"
BANDS = ("LS", "UP")
CONCEPTS = tuple(f"biology.{c}" for c in ("pollution", "human-activities-ecosystem-impacts", "habitat-destruction",
                                           "natural-resources-conservation", "conservation-benefits",
                                           "biological-conservation-restoration"))
# A topic whose sections the book lists is reached only if one names what these graphs teach.
NEEDS = r"human activit|pollution|habitat destruction|deforest|conservation|sustainab|endangered|sewage|eutrophication|restoration"
AVOID = (r"cell|enzyme|genetic|inherit|immun|disease|reproduc|digest|photosynth|respiration|selection|interdependen|"
         r"smoking|glossary|science in context|thinking and working scientifically|scientific method|science skills|"
         r"sexual|\bSTIs?\b|HIV|pregnancy|social factors")

SOURCES = ["a sewage works", "a coffee washing station", "a sugar factory"]
DISTRICTS = ["District K", "District M", "District T", "District W"]
ANIMALS = ["antelopes", "cranes", "monkeys", "elephants"]
PARKS = ["Park Z", "Park Q", "Park V"]


def concepts_for(p: dict) -> tuple:
    ids = {"river": ("pollution", "human-activities-ecosystem-impacts"),
           "forest": ("habitat-destruction", "human-activities-ecosystem-impacts", "natural-resources-conservation"),
           "species": ("conservation-benefits", "biological-conservation-restoration", "natural-resources-conservation")}
    return tuple(f"biology.{c}" for c in ids[p["kind"]])


def _sample_river(rng: random.Random) -> dict:
    while True:
        k = rng.choice([2, 3])
        up, low = rng.choice([8, 9, 10]), rng.choice([2, 3, 4])
        m = k + rng.choice([2, 3])
        ox = [up] * (k + 1)
        first = up - rng.randint(2, 4)
        n_down = m - k  # points from k+1 to m
        for j in range(1, n_down + 1):
            ox.append(round(first + (low - first) * (j - 1) / max(1, n_down - 1)) if n_down > 1 else low)
        ox[m] = low
        while len(ox) < 11:
            ox.append(min(up, ox[-1] + rng.choice([1, 2])))
        if ox.count(low) == 1 and up in ox[m:] and all(ox[i] < ox[i - 1] for i in range(k + 2, m + 1)):
            break
    step = rng.choice([2, 5])
    fly = [step * max(0, round((v - low - 1) * rng.uniform(0.8, 1.2))) for v in ox]
    d = rng.choice([i for i in range(k + 1, 11) if ox[i] != up] or [m])
    return {"band": rng.choice(BANDS), "kind": "river", "source": rng.randrange(len(SOURCES)), "km": list(range(11)),
            "outlet": k, "oxygen": ox, "mayfly": fly, "fly_step": step, "ask": d, "count_at": rng.randint(0, 10)}


def _sample_forest(rng: random.Random) -> dict:
    years = list(range(1990, 2021, 5))
    while True:
        step = rng.choice([10, 20])
        start = step * rng.randint(10, 25)
        pct = rng.choice([10, 20, 25, 30, 40, 50])
        low = start * (100 - pct) // 100
        if (start * (100 - pct)) % 100 or low % step:
            continue
        s = rng.choice([2, 3, 4])  # the bar at which planting began
        area = [start]
        for i in range(1, s):
            area.append(step * round((start + (low - start) * i / s + rng.uniform(-0.4, 0.4) * step) / step))
        area.append(low)
        for _ in range(s + 1, len(years)):
            area.append(area[-1] + step * rng.randint(1, 3))
        if area.count(low) == 1 and all(area[i] > area[i + 1] for i in range(s)):
            break
    a = rng.randrange(s)
    b = rng.randint(a + 1, s)
    return {"band": rng.choice(BANDS), "kind": "forest", "district": rng.choice(DISTRICTS), "years": years, "area": area,
            "ystep": step, "start": years[s], "fall": [years[a], years[b]], "pct": [years[0], years[s]],
            "gain_to": rng.choice(years[s + 1:]), "ask": rng.choice(["fall", "pct", "gain"])}


def _sample_species(rng: random.Random) -> dict:
    years = list(range(2000, 2021, 2))
    while True:
        step = rng.choice([5, 10])
        s = rng.randint(3, 5)
        low = step * rng.randint(4, 8)
        top = low + step * rng.randint(4, 10)
        cnt = [step * round((top + (low - top) * i / s) / step) for i in range(s)] + [low]
        g = rng.choice([5, 10]) if step == 5 else 10  # the mean increase per year
        rest = len(years) - 1 - s
        total = g * 2 * rest
        path = []
        for i in range(1, rest + 1):
            target = low + total * i // rest
            jitter = 0 if i == rest else step * rng.choice([-1, 0, 1])
            path.append(target + jitter)
        cnt += path
        if cnt.count(low) == 1 and min(cnt) == low and all(v % step == 0 for v in cnt):
            break
    return {"band": rng.choice(BANDS), "kind": "species", "animal": rng.randrange(len(ANIMALS)), "park": rng.choice(PARKS),
            "years": years, "count": cnt, "ystep": step, "start": years[s], "ask": rng.choice(years)}


def sample(rng: random.Random) -> dict:
    kind = rng.choice(["river", "forest", "species"])
    return {"river": _sample_river, "forest": _sample_forest, "species": _sample_species}[kind](rng)


# --- drawing -----------------------------------------------------------------------------------------------------

def draw(p: dict):
    return {"river": _draw_river, "forest": _draw_forest, "species": _draw_species}[p["kind"]](p)


def _draw_river(p: dict):
    fig, axes = new_figure(7.0, 6.0)
    fig.clf()
    top_ax, low_ax = fig.subplots(2, 1, sharex=True, gridspec_kw={"height_ratios": [1.3, 1]})
    km, ox, fly, k = p["km"], p["oxygen"], p["mayfly"], p["outlet"]
    top_ax.plot(km, ox, color=INK, linewidth=1.8, marker="o", markersize=5)
    top_ax.set_yticks(range(0, 13, 2))
    top_ax.set_yticks(range(0, 13), minor=True)
    top_ax.set_ylim(0, 12.4)
    top_ax.set_ylabel("Dissolved oxygen\n(mg/dm³)")
    top_ax.set_title(f"Samples along a river; the outlet from {SOURCES[p['source']]} is between {k} km and {k + 1} km",
                     fontsize=10)
    step = p["fly_step"]
    fmax = step * (max(fly) // step + 2)
    low_ax.bar(km, fly, width=0.55, color=FILL, edgecolor=INK, linewidth=1.0, zorder=3)
    low_ax.set_yticks(range(0, fmax + 1, step * (2 if fmax / step > 10 else 1)))
    low_ax.set_yticks(range(0, fmax + 1, step), minor=True)
    low_ax.set_ylim(0, fmax)
    low_ax.set_ylabel("Mayfly nymphs\nin the sample")
    low_ax.set_xlabel("Distance along the river (km)")
    for ax in (top_ax, low_ax):
        ax.grid(True, which="both", color=GRID, linewidth=0.6)
        ax.set_axisbelow(True)
        ax.axvline(k + 0.5, color=INK, linewidth=1.3, linestyle=(0, (4, 3)))
        ax.set_xticks(km)
        ax.set_xlim(-0.4, 10.4)
        ax.tick_params(labelsize=9)
    top_ax.tick_params(labelbottom=True)
    fig.tight_layout()
    return fig


def _draw_forest(p: dict):
    fig, ax = new_figure(6.8, 4.4)
    years, area, step = p["years"], p["area"], p["ystep"]
    top = step * (max(area) // step + 2)
    ax.bar(years, area, width=3.0, color=FILL, edgecolor=INK, linewidth=1.0, zorder=3)
    ax.set_xticks(years)
    ax.set_yticks(range(0, top + 1, step * (2 if top / step > 14 else 1)))
    ax.set_yticks(range(0, top + 1, step), minor=True)
    ax.grid(True, axis="y", which="both", color=GRID, linewidth=0.6)
    ax.set_axisbelow(True)
    ax.set_ylim(0, top)
    ax.set_xlim(years[0] - 3, years[-1] + 3)
    ax.tick_params(labelsize=9)
    ax.set_xlabel("Year")
    ax.set_ylabel("Forest cover (km²)")
    ax.set_title(f"Forest cover in {p['district']}; a tree-planting programme began in {p['start']}",
                 fontsize=10)
    return fig


def _draw_species(p: dict):
    fig, ax = new_figure(6.8, 4.4)
    years, cnt, step = p["years"], p["count"], p["ystep"]
    top = step * (max(cnt) // step + 2)
    ax.plot(years, cnt, color=INK, linewidth=1.8, marker="o", markersize=5)
    ax.axvline(p["start"], color=INK, linewidth=1.3, linestyle=(0, (4, 3)))
    ax.set_xticks(years)
    ax.set_yticks(range(0, top + 1, step * (2 if top / step > 14 else 1)))
    ax.set_yticks(range(0, top + 1, step), minor=True)
    ax.grid(True, which="both", color=GRID, linewidth=0.6)
    ax.set_axisbelow(True)
    ax.set_ylim(0, top)
    ax.set_xlim(years[0] - 0.5, years[-1] + 0.5)
    ax.tick_params(labelsize=9)
    ax.set_xlabel("Year")
    plural = ANIMALS[p["animal"]]
    ax.set_ylabel(f"Number of {plural}")
    ax.set_title(f"{plural.capitalize()} counted in {p['park']}; patrols against poaching began in {p['start']} "
                 f"(dashed line)", fontsize=10)
    return fig


# --- questions ---------------------------------------------------------------------------------------------------

SETTINGS = ["for a field study", "for an ecology project", "for a class report", "at the environment club",
            "for a school debate"]


def _km(v: int) -> list[str]:
    return [f"{v} km", f"{v}km", f"at {v} km", f"{v} kilometres"]


def _mg(v: int) -> list[str]:
    return [f"{v} mg/dm³", f"{v}mg/dm³", f"{v} mg per dm³", f"{v} mg/L"]


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    if p["kind"] == "river":
        km, ox, fly, k = p["km"], p["oxygen"], p["mayfly"], p["outlet"]
        source = SOURCES[p["source"]]
        lowest = km[ox.index(min(ox))]
        d, c = p["ask"], p["count_at"]
        back = next(km[i] for i in range(k + 1, len(km)) if ox[i] >= ox[0])
        return [short(f"{who} sampled a river above and below {source} {rng.choice(SETTINGS)}. At what distance along "
                      f"the river was the dissolved oxygen lowest, in km?", lowest, _km(lowest)),
                short(f"What was the dissolved oxygen {d} km along the river, in mg/dm³?", ox[d], _mg(ox[d])),
                short(f"How many mayfly nymphs were in the sample at {c} km?", fly[c], [f"{fly[c]} nymphs", f"{fly[c]} mayfly nymphs"]),
                short(f"At what distance below the outlet did the oxygen first get back to {ox[0]} mg/dm³, its level "
                      f"above the outlet?", back, _km(back))]
    if p["kind"] == "forest":
        years, area = p["years"], p["area"]
        low = years[area.index(min(area))]
        district = p["district"]
        qs = [short(f"{who} graphed the forest cover of {district} {rng.choice(SETTINGS)}. In which year was the forest "
                    f"cover smallest?", low, [f"in {low}"])]
        a, b = p["fall"]
        x, y = area[years.index(a)], area[years.index(b)]
        qs.append(short(f"By how many km² did the forest cover of {district} fall between {a} and {b}?", x - y,
                        [f"{x - y} km²", f"{x - y} km2", f"{x - y} square kilometres"]))
        a, b = p["pct"]
        x, y = area[years.index(a)], area[years.index(b)]
        pc = (x - y) * 100 // x
        qs.append(short(f"By what percentage did the forest cover of {district} fall from {a} to {b}?", f"{pc}%",
                        [str(pc), f"{pc} %", f"{pc} percent"]))
        b = p["gain_to"]
        g = area[years.index(b)] - area[years.index(p["start"])]
        qs.append(short(f"How much forest, in km², was gained between {p['start']} and {b}?", g,
                        [f"{g} km²", f"{g} km2", f"{g} square kilometres"]))
        return qs
    years, cnt, start = p["years"], p["count"], p["start"]
    plural = ANIMALS[p["animal"]]
    low = years[cnt.index(min(cnt))]
    t = p["ask"]
    gain = cnt[-1] - cnt[years.index(start)]
    per = gain // (years[-1] - start)
    return [short(f"{who} graphed the numbers of {plural} in {p['park']} {rng.choice(SETTINGS)}. In which year was the "
                  f"number of {plural} lowest?", low, [f"in {low}"]),
            short(f"How many {plural} were counted in {t}?", cnt[years.index(t)], [f"{cnt[years.index(t)]} {plural}"]),
            short(f"What was the mean increase in the number of {plural} per year from {start} to {years[-1]}?", per,
                  [f"{per} {plural} per year", f"{per} per year", f"{per} {plural}"])]
