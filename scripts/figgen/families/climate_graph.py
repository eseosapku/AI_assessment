"""Climate graph: rainfall bars and a temperature line, both on gridlines."""
from __future__ import annotations

import random

from ..core import FILL, GRID, mcq, new_figure, short

ID = "climate_graph"
KIND = "geo.climate"
SUBJECT = "geography"
BANDS = ("LS", "UP")

MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
FULL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October",
        "November", "December"]

# Monthly shapes (rainfall in 25 mm units, temperature in °C) for real climate types.
TYPES = {
    "equatorial, two rainy seasons": ([3, 4, 5, 6, 4, 1, 1, 2, 3, 4, 5, 4], [21, 21, 21, 21, 20, 20, 20, 21, 21, 21, 20, 20]),
    "tropical wet and dry": ([0, 0, 1, 2, 4, 6, 8, 8, 6, 3, 1, 0], [24, 26, 29, 31, 30, 28, 27, 26, 27, 28, 27, 25]),
    "hot desert": ([0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0], [14, 16, 20, 24, 28, 32, 34, 34, 30, 26, 20, 16]),
    "temperate, southern hemisphere": ([2, 2, 3, 3, 4, 4, 4, 3, 3, 2, 2, 2], [22, 22, 20, 18, 14, 12, 12, 12, 14, 16, 18, 20]),
}


def sample(rng: random.Random) -> dict:
    name = rng.choice(sorted(TYPES))
    rain_units, temps = TYPES[name]
    while True:
        rain = [25 * max(0, u + rng.choice([-1, 0, 0, 1])) for u in rain_units]
        temp = [2 * round((t + rng.choice([-2, 0, 0, 2])) / 2) for t in temps]
        if rain.count(max(rain)) == 1 and max(rain) > 0:
            return {"name": name, "rain": rain, "temp": temp}


def draw(p: dict):
    fig, ax = new_figure(7.0, 4.4)
    ax.bar(MONTHS, p["rain"], color=FILL, edgecolor="#111111", width=0.7)
    top = max(250, max(p["rain"]) + 25)
    ax.set_yticks(range(0, top + 1, 25))
    ax.set_ylim(0, top)
    ax.yaxis.grid(True, color=GRID, linewidth=0.6)
    ax.set_axisbelow(True)
    ax.set_ylabel("Rainfall (mm)")
    ax2 = ax.twinx()
    ax2.plot(MONTHS, p["temp"], marker="o", color="#111111")
    ax2.set_yticks(range(0, 41, 2))
    ax2.set_ylim(0, 40)
    ax2.set_ylabel("Temperature (°C)")
    ax2.spines["right"].set_visible(True)
    ax2.tick_params(labelsize=8)
    ax.tick_params(labelsize=8)
    ax.set_title("Climate graph for a weather station")
    return fig


def questions(p: dict, rng: random.Random) -> list:
    wettest = p["rain"].index(max(p["rain"]))
    i = rng.choice([n for n in range(12) if p["rain"][n] > 0])
    rng_range = max(p["temp"]) - min(p["temp"])
    wrong = [FULL[n] for n in sorted(range(12), key=lambda n: -p["rain"][n]) if n != wettest][:3]
    return [
        mcq("Which month has the most rainfall?", FULL[wettest], wrong, rng),
        short(f"How much rain falls in {FULL[i]}, in mm?", p["rain"][i], [f"{p['rain'][i]}mm", f"{p['rain'][i]} mm"]),
        short("What is the annual temperature range, in °C?", rng_range, [f"{rng_range}°C", f"{rng_range} °C"]),
    ]
