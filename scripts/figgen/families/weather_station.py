"""Weather station records (LS, UP): a week's readings at a school weather station in Rwanda, the rain gauge's
millimetres as bars on 2 mm gridlines, and a table of each day's maximum and minimum temperatures. The week's total
rainfall, the mean maximum temperature, and the day with the greatest range of temperature.

Every key is the readings: the mean is a whole number of degrees, and one day plainly has the greatest range.
"""
from __future__ import annotations

import random

from matplotlib.patches import Rectangle

from ..core import FILL, GRID, INK, NAMES, new_figure, short

ID = "weather_station"
KIND = "geo.climate"
SUBJECT = "geography"
BANDS = ("LS", "UP")
CONCEPTS = tuple(f"geography.{c}" for c in ("weather-data-collection", "weather-elements", "humidity-precipitation", "temperature"))
# A topic whose sections the book lists is reached only if one names what this figure teaches.
NEEDS = r"weather|climat|rain|temperature|instrument|station|precipitation"
DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
SCHOOLS = ["Huye", "Musanze", "Rubavu", "Kayonza", "Nyanza", "Rusizi", "Muhanga", "Gicumbi"]


def sample(rng: random.Random) -> dict:
    while True:
        rain = [rng.choice([0, 0, 2, 4, 6, 8, 10, 12, 14, 16, 20, 24]) for _ in range(7)]
        tmax = [rng.randint(22, 29) for _ in range(7)]
        tmin = [t - rng.randint(6, 13) for t in tmax]
        spans = [a - b for a, b in zip(tmax, tmin)]
        if sum(tmax) % 7 == 0 and spans.count(max(spans)) == 1 and sum(1 for r in rain if r) >= 3:
            return {"band": rng.choice(BANDS), "school": rng.choice(SCHOOLS), "rain": rain, "tmax": tmax, "tmin": tmin}


def draw(p: dict):
    fig, ax = new_figure(7.2, 5.0)
    short_days = [d[:3] for d in DAYS]
    top = max(26, max(p["rain"]) + 2)
    for k, r in enumerate(p["rain"]):
        ax.add_patch(Rectangle((k + 0.15, 0), 0.7, r, facecolor=FILL, edgecolor=INK, linewidth=1.0, zorder=3))
    for v in range(0, top + 1, 2):
        ax.plot([0, 7], [v, v], color=GRID, linewidth=0.6, zorder=1)
        if v % 4 == 0:
            ax.text(-0.1, v, str(v), ha="right", va="center", fontsize=8.5)
    ax.plot([0, 0], [0, top], color=INK, linewidth=1.0)
    ax.plot([0, 7], [0, 0], color=INK, linewidth=1.0)
    ax.text(-0.75, top / 2, "Rainfall (mm)", rotation=90, ha="center", va="center", fontsize=10)
    ax.set_title(f"A week at the weather station of a school in {p['school']}", fontsize=11)
    # the temperature table under the days
    rows = [("Day", short_days), ("Max (°C)", [str(t) for t in p["tmax"]]), ("Min (°C)", [str(t) for t in p["tmin"]])]
    rh = top * 0.08
    for r, (label, cells) in enumerate(rows):
        y = -(r + 1) * rh
        ax.text(-0.1, y + rh / 2, label, ha="right", va="center", fontsize=9, fontweight="bold" if r == 0 else "normal")
        for k, c in enumerate(cells):
            ax.add_patch(Rectangle((k, y), 1, rh, facecolor="#eef1f3" if r == 0 else "white", edgecolor="#777777", linewidth=0.7))
            ax.text(k + 0.5, y + rh / 2, c, ha="center", va="center", fontsize=9.5, fontweight="bold" if r == 0 else "normal")
    ax.set_xlim(-1.7, 7.1)
    ax.set_ylim(-3 * rh - 0.3, top + 0.5)
    ax.axis("off")
    return fig


SETTINGS = ["in a geography lesson", "for homework", "for the school weather club", "for a class test", "in a science and geography project"]


def questions(p: dict, rng: random.Random) -> list:
    who, friend = rng.sample(NAMES, 2)
    total = sum(p["rain"])
    mean = sum(p["tmax"]) // 7
    spans = [a - b for a, b in zip(p["tmax"], p["tmin"])]
    day = DAYS[spans.index(max(spans))]
    return [short(f"{who} reads the rain gauge at the school in {p['school']} every day {rng.choice(SETTINGS)}. What was the total rainfall for the week, in mm?",
                  total, [str(total), f"{total} mm", f"{total}mm"]),
            short(f"{friend} works out the mean maximum temperature for the week. What is it, in °C?", mean,
                  [str(mean), f"{mean} °C", f"{mean}°C"]),
            short("Which day had the greatest range of temperature, from minimum to maximum?", day, [day, day[:3]])]
