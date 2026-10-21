"""Weather and climate records of an invented school or weather station (P3 to P6, Primary Social Studies), of three
kinds. (The science family weather_chart_p draws a school week's weather for Primary Science; this one serves the
Social Studies topics on weather and climate, and draws a whole week and whole years.)

- week (P3 to P6): a table of one week, Monday to Sunday, with a weather picture for each day (sunny, cloudy, rainy or
  windy, from a printed key) and the rain that fell in millimetres (0 on every day without rain). On how many days was
  it sunny (cloudy, windy) or did it rain? Which day had the most rain (one day, at least 3 mm ahead of the next)?
  Lower: how much rain fell on a day. Upper: how much more fell on one day than another, and in the whole week.
- rain (P4 to P6): a bar chart of the rain in each month of one year at a weather station, every bar ending on a 10 mm
  gridline. Which month had the most rain (one month, at least 20 mm ahead)? How much more rain fell in one month than
  in another? In how many months did less than 30, 50 or 70 mm fall (never a month on the line)?
- temp (P4 to P6): a line graph of each month's average temperature at a weather station, every point on a 1 °C
  gridline. Which month was the hottest, which the coolest (one month each)? How many degrees warmer was one month than
  another?

The year follows Rwanda's two rainy seasons (March to May, September to December) and its mild temperatures, with each
station's own months: the numbers belong to the invented station, not to a real town.
"""
from __future__ import annotations

import math
import random

from matplotlib.patches import Arc, Circle, Polygon, Rectangle

from ..core import GRID, INK, NAMES, count, mcq, new_figure, short

ID = "weather_data_p"
KIND = "geo.climate"
SUBJECT = "social-studies"
BANDS = ("P",)
CONCEPTS = ("social-studies.climate-weather", "social-studies.climate-types-characteristics")
# A topic whose sections the book lists is reached only if its name or a section names the weather or the climate.
NEEDS = r"weather(?!ing)|climate"
# Never a religious, values or behaviour topic, nor the NERDC civics topics (they list no sections).
AVOID = (r"\bgod\b|god's|bible|qur'?an|prayer|faith|\bsin\b|creation|commandment|charity|"
         r"democracy and governance|community helpers|rights|historical events|conflict|genocide|values|behaviour|"
         r"peace|harmony|environmental responsibility|national unity|rules and fairness")

DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
WEATHER = ["sunny", "cloudy", "rainy", "windy"]
MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October",
          "November", "December"]
# A year's rain in mm in a Rwanda-like place: two rainy seasons, a long dry season in June to August.
RAIN_YEAR = [80, 90, 120, 150, 110, 30, 20, 30, 80, 110, 120, 90]
# Average temperature in °C above the station's coolest level: warmest at the end of the dry season.
WARMTH = [1, 2, 2, 1, 1, 2, 3, 4, 3, 1, 0, 0]
SCHOOLS = ["Sunrise School", "Green Hills School", "Lakeside School", "Hilltop School", "Valley View School",
           "Morning Star School"]
STATIONS = ["Green Hills weather station", "Lakeside weather station", "Hilltop weather station",
            "Valley View weather station", "Sunrise weather station", "Twin Hills weather station"]


def stages(p: dict) -> tuple[int, int]:
    if p["sub"] == "week":
        return (3, 4) if p["level"] == "lower" else (5, 6)
    return (4, 6)


def _week(rng: random.Random) -> dict:
    level = rng.choice(["lower", "upper"])
    while True:
        weather = rng.choices(WEATHER, weights=[3, 2, 2, 1], k=7)
        wet = [i for i, w in enumerate(weather) if w == "rainy"]
        if not 2 <= len(wet) <= 4 or len(set(weather)) < 3:
            continue
        rain = [rng.randint(2, 30) if w == "rainy" else 0 for w in weather]
        top = sorted((rain[i] for i in wet), reverse=True)
        if top[0] - top[1] < 3:
            continue
        pairs = [(a, b) for a in wet for b in wet if rain[a] > rain[b]]
        return {"band": "P", "sub": "week", "level": level, "place": rng.choice(SCHOOLS), "weather": weather,
                "rain": rain, "ask": {"count": rng.choice(sorted(set(weather))), "one": rng.choice(wet),
                                      "more": list(rng.choice(pairs))}}


def _rain(rng: random.Random) -> dict:
    while True:
        rain = [max(10, base + 10 * rng.randint(-4, 4)) for base in RAIN_YEAR]  # every bar shows: no month is dry
        top = sorted(rain, reverse=True)
        if top[0] - top[1] < 20:
            continue
        lines = [t for t in (30, 50, 70) if t not in rain and 1 <= sum(x < t for x in rain) <= 6]
        pairs = [(a, b) for a in range(12) for b in range(12) if rain[a] > rain[b] and rain[a] - rain[b] >= 20]
        if not lines or not pairs:
            continue
        return {"band": "P", "sub": "rain", "station": rng.choice(STATIONS), "rain": rain, "step": 10,
                "top": 10 * (max(rain) // 10) + 20, "ask": {"more": list(rng.choice(pairs)), "less": rng.choice(lines)}}


def _temp(rng: random.Random) -> dict:
    base = rng.randint(15, 21)
    while True:
        temps = [base + w + rng.choice([-1, 0, 0, 1]) for w in WARMTH]
        if temps.count(max(temps)) != 1 or temps.count(min(temps)) != 1:
            continue
        pairs = [(a, b) for a in range(12) for b in range(12) if temps[a] > temps[b]]
        return {"band": "P", "sub": "temp", "station": rng.choice(STATIONS), "temps": temps, "lo": min(temps) - 2,
                "hi": max(temps) + 2, "ask": {"warmer": list(rng.choice(pairs))}}


def sample(rng: random.Random) -> dict:
    sub = rng.choice(["week", "rain", "temp"])
    return {"week": _week, "rain": _rain, "temp": _temp}[sub](rng)


# --- the weather pictures -------------------------------------------------------------------------------

def _cloud(ax, cx, cy, s, fill="#d5d8dc", gid=None):
    puffs = [(cx - 0.36 * s, cy - 0.06 * s, 0.3 * s), (cx, cy + 0.1 * s, 0.4 * s), (cx + 0.38 * s, cy - 0.06 * s, 0.28 * s)]
    for k, (x, y, r) in enumerate(puffs):
        ax.add_patch(Circle((x, y), r, facecolor=fill, edgecolor=INK, linewidth=1.6, zorder=2, gid=gid if k == 1 else None))
    ax.add_patch(Rectangle((cx - 0.36 * s, cy - 0.36 * s), 0.74 * s, 0.3 * s, facecolor=fill, edgecolor=INK,
                           linewidth=1.6, zorder=2))
    for x, y, r in puffs:
        ax.add_patch(Circle((x, y), r, facecolor=fill, edgecolor="none", zorder=3))
    ax.add_patch(Rectangle((cx - 0.36 * s, cy - 0.36 * s), 0.74 * s, 0.3 * s, facecolor=fill, edgecolor="none", zorder=3))


def weather_picture(ax, kind: str, cx: float, cy: float, s: float, gid: str | None = None) -> None:
    if kind == "sunny":
        for k in range(8):
            t = k * math.pi / 4
            ax.add_patch(Polygon([(cx + 0.5 * s * math.cos(t - 0.15), cy + 0.5 * s * math.sin(t - 0.15)),
                                  (cx + 0.82 * s * math.cos(t), cy + 0.82 * s * math.sin(t)),
                                  (cx + 0.5 * s * math.cos(t + 0.15), cy + 0.5 * s * math.sin(t + 0.15))],
                                 closed=True, facecolor="#f39c12", edgecolor="#b9770e", linewidth=0.8, zorder=2))
        ax.add_patch(Circle((cx, cy), 0.42 * s, facecolor="#f7dc6f", edgecolor="#b9770e", linewidth=1.6, zorder=3, gid=gid))
    elif kind == "cloudy":
        _cloud(ax, cx, cy, s, gid=gid)
    elif kind == "rainy":
        _cloud(ax, cx, cy + 0.25 * s, 0.85 * s, fill="#99a3a4", gid=gid)
        for dx in (-0.3, 0.05, 0.4):
            x = cx + dx * s
            ax.add_patch(Polygon([(x, cy - 0.2 * s), (x - 0.08 * s, cy - 0.46 * s), (x + 0.08 * s, cy - 0.46 * s)],
                                 closed=True, facecolor="#2e86c1", edgecolor="#1b4f72", linewidth=0.8, zorder=4))
            ax.add_patch(Circle((x, cy - 0.5 * s), 0.08 * s, facecolor="#2e86c1", edgecolor="#1b4f72", linewidth=0.8,
                                zorder=4))
    else:
        for k, (dy, half) in enumerate(((0.38, 0.62), (0.0, 0.8), (-0.38, 0.5))):
            y = cy + dy * s
            x0, x1 = cx - 0.8 * s, cx - 0.8 * s + 2 * half * s * 0.9
            ax.add_patch(Rectangle((x0, y - 0.04 * s), x1 - x0, 0.08 * s, facecolor="#5d6d7e", edgecolor="none",
                                   zorder=3, gid=gid if k == 0 else None))
            ax.add_patch(Arc((x1, y + 0.13 * s), 0.26 * s, 0.26 * s, theta1=-90, theta2=180, edgecolor="#5d6d7e",
                             linewidth=3.0, zorder=3))


# --- drawing ----------------------------------------------------------------------------------------

def _draw_week(p: dict):
    w0, w = 2.5, 1.75
    rows = [("Day", 0.75), ("Weather", 1.6), ("Rain (mm)", 0.8)]
    heights = [h for _, h in rows]
    total = sum(heights)
    width = w0 + 7 * w
    fig, ax = new_figure(11.5, 5.0)
    tops, y = [], total
    for label, h in rows:
        y -= h
        tops.append(y)
        ax.text(0.15, y + h / 2, label, ha="left", va="center", fontsize=12, fontweight="bold")
    ax.add_patch(Rectangle((0, tops[0]), width, heights[0], facecolor="#e9edf0", edgecolor="none", zorder=0))
    for i, d in enumerate(DAYS):
        cx = w0 + (i + 0.5) * w
        ax.text(cx, tops[0] + heights[0] / 2, d, ha="center", va="center", fontsize=11, fontweight="bold")
        weather_picture(ax, p["weather"][i], cx, tops[1] + heights[1] / 2, 0.55, gid=f"sym-{i}-{p['weather'][i]}")
        ax.text(cx, tops[2] + heights[2] / 2, str(p["rain"][i]), ha="center", va="center", fontsize=13, gid=f"rain-{i}")
    for k, yy in enumerate([total, tops[0], tops[1], 0]):
        ax.plot([0, width], [yy, yy], color=INK, linewidth=1.4 if k in (0, 3) else 0.9)
    for x in [0, w0] + [w0 + j * w for j in range(1, 8)]:
        ax.plot([x, x], [0, total], color=INK, linewidth=1.4 if x in (0, width) else 0.9)
    ax.text(width / 2, total + 0.45, f"The weather at {p['place']} for one week", ha="center", va="center",
            fontsize=14, fontweight="bold")
    ax.text(0.15, -0.75, "Key:", ha="left", va="center", fontsize=12, fontweight="bold")
    for k, kind in enumerate(WEATHER):
        x = 2.3 + k * 3.0
        weather_picture(ax, kind, x, -0.75, 0.36)
        ax.text(x + 0.5, -0.75, kind, ha="left", va="center", fontsize=12)
    ax.set_xlim(-0.05, width + 0.05)
    ax.set_ylim(-1.3, total + 0.85)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def _months_axis(ax):
    ax.set_xticks(range(12), [m[:3] for m in MONTHS])
    ax.set_xlim(-0.6, 11.6)
    ax.tick_params(labelsize=11)
    ax.tick_params(axis="y", which="minor", length=0)
    ax.set_xlabel("Month", fontsize=12)


def _draw_rain(p: dict):
    fig, ax = new_figure(9.0, 5.4)
    bars = ax.bar(range(12), p["rain"], width=0.62, color="#5dade2", edgecolor=INK, linewidth=1.0, zorder=3)
    for i, b in enumerate(bars):
        b.set_gid(f"bar-{i}")
    ax.set_yticks(range(0, p["top"] + 1, 20))
    ax.set_yticks(range(0, p["top"] + 1, p["step"]), minor=True)
    ax.yaxis.grid(True, which="both", color=GRID, linewidth=0.8)
    ax.set_axisbelow(True)
    ax.set_ylim(0, p["top"])
    _months_axis(ax)
    ax.set_ylabel("Rain (mm)", fontsize=12)
    ax.set_title(f"Rain in each month at {p['station']}", fontsize=14, fontweight="bold")
    return fig


def _draw_temp(p: dict):
    fig, ax = new_figure(9.0, 5.4)
    ax.plot(range(12), p["temps"], color="#c0392b", linewidth=2.2, marker="o", markersize=7, markerfacecolor="white",
            markeredgecolor="#c0392b", markeredgewidth=2.0, zorder=3, gid="temps")
    ax.set_yticks(range(p["lo"], p["hi"] + 1))
    ax.set_ylim(p["lo"], p["hi"])
    ax.yaxis.grid(True, color=GRID, linewidth=0.8)
    ax.xaxis.grid(True, color=GRID, linewidth=0.6)
    ax.set_axisbelow(True)
    _months_axis(ax)
    ax.set_ylabel("Average temperature (°C)", fontsize=12)
    ax.set_title(f"Temperature in each month at {p['station']}", fontsize=14, fontweight="bold")
    return fig


def draw(p: dict):
    return {"week": _draw_week, "rain": _draw_rain, "temp": _draw_temp}[p["sub"]](p)


# --- questions --------------------------------------------------------------------------------------

VERBS = ["looks at", "studies", "reads", "talks about"]
SETTINGS = ["in a Social Studies lesson", "for homework", "in class", "with a friend", "at home", "for a class test"]


def _mm(n: int) -> list[str]:
    return [str(n), f"{n} millimetres", f"{n}mm"]


def _degrees(n: int) -> list[str]:
    return [str(n), f"{n}°C", f"{n} degrees", f"{n} degrees Celsius", f"{n} °"]


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    verb, setting = rng.choice(VERBS), rng.choice(SETTINGS)
    ask = p["ask"]
    if p["sub"] == "week":
        w, r = p["weather"], p["rain"]
        kind = ask["count"]
        how = "On how many days did it rain?" if kind == "rainy" else f"On how many days was it {kind}?"
        wettest = DAYS[r.index(max(r))]
        others = [DAYS[i] for i in sorted(range(7), key=lambda i: -r[i])]
        out = [count(f"{who} {verb} the weather table of {p['place']} {setting}. {how}", w.count(kind), "days"),
               mcq("Which day had the most rain?", wettest, others, rng)]
        if p["level"] == "lower":
            d = ask["one"]
            out.append(short(f"How much rain fell on {DAYS[d]}?", f"{r[d]} mm", _mm(r[d])))
        else:
            a, b = ask["more"]
            out.append(short(f"How much more rain fell on {DAYS[a]} than on {DAYS[b]}?", f"{r[a] - r[b]} mm", _mm(r[a] - r[b])))
            out.append(short("How much rain fell in the whole week?", f"{sum(r)} mm", _mm(sum(r))))
        return out
    if p["sub"] == "rain":
        r = p["rain"]
        wettest = MONTHS[r.index(max(r))]
        others = [MONTHS[i] for i in sorted(range(12), key=lambda i: -r[i])]
        a, b = ask["more"]
        t = ask["less"]
        return [mcq(f"{who} {verb} the rain graph of {p['station']} {setting}. Which month had the most rain?",
                    wettest, others, rng),
                short(f"How much more rain fell in {MONTHS[a]} than in {MONTHS[b]}?", f"{r[a] - r[b]} mm", _mm(r[a] - r[b])),
                count(f"In how many months did less than {t} mm of rain fall?", sum(x < t for x in r), "months")]
    t = p["temps"]
    hottest = MONTHS[t.index(max(t))]
    coolest = MONTHS[t.index(min(t))]
    a, b = ask["warmer"]
    return [mcq(f"{who} {verb} the temperature graph of {p['station']} {setting}. Which month was the hottest?",
                hottest, [MONTHS[i] for i in sorted(range(12), key=lambda i: -t[i])], rng),
            mcq("Which month was the coolest?", coolest, [MONTHS[i] for i in sorted(range(12), key=lambda i: t[i])], rng),
            short(f"How many degrees warmer was {MONTHS[a]} than {MONTHS[b]}?", f"{t[a] - t[b]} °C", _degrees(t[a] - t[b]))]
