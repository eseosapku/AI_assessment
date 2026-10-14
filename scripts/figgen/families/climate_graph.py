"""Climate graph: rainfall bars and a temperature line, both on gridlines. A Rwandan station (Kigali, Huye, Rubavu,
Musanze or Nyagatare) keeps Rwanda's two rainy seasons, March to May and September to December, and its dry June to
August; the other climate types are an unnamed weather station. The wettest month, a month's rainfall, the annual
temperature range, and the total rainfall over three or four months (P3m: named leads, a season's total).
"""
from __future__ import annotations

import random

from ..core import FILL, GRID, NAMES, mcq, new_figure, short

ID = "climate_graph"
KIND = "geo.climate"
SUBJECT = "geography"
BANDS = ("LS", "UP")
CONCEPTS = tuple(f"geography.{c}" for c in ("weather-elements", "temperature", "humidity-precipitation", "climate-zones",
                                            "climate-factors", "equatorial-climate", "hot-desert-climate", "weather-climate-definition"))
# A topic whose sections the book lists is reached only if one names what this figure teaches.
NEEDS = r"climat|weather(?!ing)|rainfall|temperature|season|precipitation"
# Rwandan stations' normals, rain to the nearest 10 mm and temperature to 2 °C (P3m review: noise had given 50 mm in July
# and 4 °C jumps). The graph names no station, so a rounded profile is never passed off as one place's record.
STATIONS = {
    "Kigali": ([80, 90, 110, 150, 90, 20, 10, 30, 70, 100, 110, 80], [20, 20, 20, 20, 20, 20, 20, 22, 22, 20, 20, 20]),
    "Huye": ([100, 110, 140, 170, 110, 20, 10, 40, 90, 120, 130, 110], [20, 20, 20, 20, 20, 18, 18, 20, 20, 20, 20, 20]),
    "Musanze": ([70, 90, 140, 190, 150, 40, 20, 50, 100, 140, 150, 100], [16, 16, 16, 16, 16, 16, 16, 16, 18, 16, 16, 16]),
    "Rubavu": ([100, 100, 130, 150, 120, 30, 20, 50, 100, 130, 130, 100], [20, 20, 20, 20, 20, 20, 20, 20, 22, 20, 20, 20]),
    "Nyagatare": ([50, 60, 100, 140, 80, 10, 10, 20, 50, 90, 100, 60], [22, 22, 22, 22, 22, 22, 22, 24, 24, 22, 22, 22]),
}
DRY_CAP = {5: 40, 6: 30, 7: 60}  # June, July and August

MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
FULL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October",
        "November", "December"]

# Monthly shapes (rainfall in 25 mm units, temperature in °C) for real climate types.
# (rain step in mm, rain in steps, temperature in °C) by month. A hot desert's rain is a few
# millimetres in its cooler months, so it is counted in 5 mm steps on its own scale.
TYPES = {
    "equatorial, two rainy seasons": (25, [3, 4, 5, 6, 4, 1, 1, 2, 3, 4, 5, 4],
                                      [21, 21, 21, 21, 20, 20, 20, 21, 21, 21, 20, 20]),
    "tropical wet and dry": (25, [0, 0, 1, 2, 4, 6, 8, 8, 6, 3, 1, 0], [24, 26, 29, 31, 30, 28, 27, 26, 27, 28, 27, 25]),
    "hot desert": (5, [2, 2, 1, 1, 0, 0, 0, 0, 0, 1, 2, 3], [14, 16, 20, 24, 28, 32, 34, 34, 30, 26, 20, 16]),
    "temperate, southern hemisphere": (25, [2, 2, 3, 3, 4, 4, 4, 3, 3, 2, 2, 2],
                                       [22, 22, 20, 18, 14, 12, 12, 12, 14, 16, 18, 20]),
}


def concepts_for(p: dict) -> frozenset[str]:
    """Equatorial or hot desert only where the graph is that type."""
    drop = {"equatorial-climate": "equatorial" not in p["name"], "hot-desert-climate": p["name"] != "hot desert"}
    return frozenset(c for c in CONCEPTS if not drop.get(c.split(".", 1)[1], False))


def sample(rng: random.Random) -> dict:
    name = rng.choice(sorted(TYPES))
    step, rain_units, temps = TYPES[name]
    place = rng.choice(sorted(STATIONS)) if name.startswith("equatorial") else None
    while True:
        if place:
            step = 20
            normals, temp = STATIONS[place]
            # the wet months vary by 10 mm; the dry June to August keep their normals, never an empty July
            rain = [r if k in DRY_CAP else r + rng.choice([-10, 0, 0, 10]) for k, r in enumerate(normals)]
            temp = list(temp)
            if rain.index(max(rain)) != 3:
                continue  # April, the peak of the long rains
        else:
            rain = [step * max(0, u + rng.choice([-1, 0, 0, 1])) for u in rain_units]
            temp = [2 * round((t + rng.choice([-2, 0, 0, 2])) / 2) for t in temps]
        if rain.count(max(rain)) != 1 or sum(1 for r in rain if r) < 3:
            continue
        if place and not (max(rain[5:8]) < min(rain[2:5]) and max(rain[5:8]) < rain[10]):
            continue  # Rwanda's long rains, short rains and dry June to August
        start = rng.choice([2, 8]) if place else rng.choice([k for k in range(0, 9) if sum(rain[k:k + 3]) > 0])
        return {"band": rng.choice(BANDS), "name": name, "place": place, "step": step, "rain": rain, "temp": temp,
                "season": [start, start + (3 if place and start == 8 else 2)]}


def draw(p: dict):
    fig, ax = new_figure(7.0, 4.4)
    step = p["step"]
    ax.bar(MONTHS, p["rain"], color=FILL, edgecolor="#111111", width=0.7)
    # Twenty gridlines up each side: every 2 °C on the right falls on a line every half step
    # of rain on the left, so both readings sit on gridlines.
    top = 10 * step
    ax.set_yticks([step * i for i in range(11)])
    ax.set_yticks([step * i / 2 for i in range(21)], minor=True)
    ax.set_ylim(0, top)
    ax.yaxis.grid(True, which="both", color=GRID, linewidth=0.6)
    ax.set_axisbelow(True)
    ax.set_ylabel("Rainfall (mm)")
    ax2 = ax.twinx()
    ax2.plot(MONTHS, p["temp"], marker="o", color="#111111")
    ax2.set_yticks(range(0, 41, 2))
    ax2.set_ylim(0, 40)
    ax2.set_ylabel("Temperature (\u00b0C)")
    ax2.spines["right"].set_visible(True)
    ax2.tick_params(labelsize=8)
    ax.tick_params(labelsize=8)
    ax.set_title("Climate graph for a weather station in Rwanda" if p.get("place") else "Climate graph for a weather station")
    return fig


SETTINGS = ["in a geography lesson", "for homework", "on a revision card", "for a class test", "at the school weather club"]


def questions(p: dict, rng: random.Random) -> list:
    who, friend = rng.sample(NAMES, 2)
    where = "this weather station"
    wettest = p["rain"].index(max(p["rain"]))
    i = rng.choice([n for n in range(12) if p["rain"][n] > 0])
    rng_range = max(p["temp"]) - min(p["temp"])
    wrong = [FULL[n] for n in sorted(range(12), key=lambda n: -p["rain"][n]) if n != wettest][:3]
    a, b = p["season"]
    total = sum(p["rain"][a:b + 1])
    t = rng.randrange(12)
    return [
        mcq(f"{who} studies this climate graph {rng.choice(SETTINGS)}. Which month has the most rainfall at {where}?",
            FULL[wettest], wrong, rng),
        short(f"How much rain falls in {FULL[i]} at {where}, in mm?", p["rain"][i], [f"{p['rain'][i]}mm", f"{p['rain'][i]} mm"]),
        # a Rwandan station's range is 0 to 2 °C in every graph, a key learnt once; a month's temperature varies
        short(f"What is the temperature in {FULL[t]} at {where}, in °C?", p["temp"][t], [str(p["temp"][t]), f"{p['temp'][t]}°C", f"{p['temp'][t]} °C"])
        if p.get("place") else
        short(f"What is the annual temperature range at {where}, in °C?", rng_range, [f"{rng_range}°C", f"{rng_range} °C"]),
        short(f"{friend} adds up the rain at {where} from {FULL[a]} to {FULL[b]}. What is the total, in mm?", total,
              [f"{total}mm", f"{total} mm"]),
    ]
