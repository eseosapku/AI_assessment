"""A week's weather at a school (P), in Kigali, Musanze, Huye, Rubavu or Nyagatare, Monday to Friday. Either a weather
chart: a symbol for each day (sun, cloud, rain cloud or wind, with a key) and the temperature at noon in °C; or a bar
chart of each day's rainfall in mm on gridlines.

The chart: on how many days it rained (or was sunny, cloudy or windy), which day was the hottest, what the weather
was on a day, and (upper) how many degrees warmer one day was than another. The rainfall: which day had the most
rain, the rain on two days altogether, the rain on one day or how much more fell on one day than another, and on
how many days no rain fell.

The temperatures suit the town (Musanze stands high and cool), a sunny day is always warmer than a rainy one, the
hottest and the wettest day are each one day, and every rainfall ends on a gridline.
"""
from __future__ import annotations

import math
import random

from matplotlib.patches import Arc, Circle, Rectangle

from ..core import FILL, GRID, INK, NAMES, count, mcq, new_figure, short

ID = "weather_chart_p"
KIND = "geo.climate"
SUBJECT = "science"
BANDS = ("P",)
# No concept names the weather itself: wind, and rain as the water cycle's (and a water source's).
CONCEPTS = ("science.wind", "science.water-cycle", "science.rainwater-management")
# A topic whose sections the book lists is reached only if it names the weather, wind or rain ("Our weather",
# "Air, Wind and Sound", "Simple water cycle and rainwater"), or is the early years' "Water" (sources of water).
NEEDS = r"weather(?!ing)|\bwind|\brain|^water$"

DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
WEATHER = ["sunny", "cloudy", "rainy", "windy"]
# The temperature at noon on a school day, in °C, lowest and highest.
TOWNS = {"Kigali": (23, 29), "Musanze": (18, 24), "Huye": (21, 27), "Rubavu": (22, 28), "Nyagatare": (25, 31)}
# (a gridline every, a number every, the most rain on a day)
RAIN_SCALES = {"lower": [(2, 2, 16)], "upper": [(2, 4, 28), (5, 10, 45)]}


def stages(p: dict) -> tuple[int, int] | None:
    """Rainfall in millimetres on a bar chart is for the older classes; the symbol chart suits every year."""
    return (3, 6) if p["kind"] == "rain" else None


def sample(rng: random.Random) -> dict:
    level = rng.choice(["lower", "upper"])
    kind = rng.choice(["symbols", "rain"])
    town = rng.choice(sorted(TOWNS))
    p = {"band": "P", "level": level, "kind": kind, "town": town, "days": DAYS}
    if kind == "symbols":
        lo, hi = TOWNS[town]
        span = {"sunny": (hi - 2, hi), "cloudy": (lo + 2, hi - 2), "windy": (lo + 2, hi - 2), "rainy": (lo, lo + 2)}
        while True:
            weather = rng.choices(WEATHER, weights=[3, 2, 2, 1], k=5)
            temps = [rng.randint(*span[w]) for w in weather]
            if len(set(weather)) >= 2 and temps.count(max(temps)) == 1 and len(set(temps)) >= 3:
                break
        warmer = sorted(rng.sample(range(5), 2), key=lambda i: -temps[i])
        while temps[warmer[0]] == temps[warmer[1]]:
            warmer = sorted(rng.sample(range(5), 2), key=lambda i: -temps[i])
        p.update(weather=weather, temps=temps,
                 ask={"count": rng.choice(sorted(set(weather))), "day": rng.randrange(5), "warmer": warmer})
        return p
    grid, label, most = rng.choice(RAIN_SCALES[level])
    while True:
        rain = [rng.choice([0, 0] + list(range(grid, most + 1, grid))) for _ in range(5)]
        wet = [i for i in range(5) if rain[i]]
        if len(wet) >= 3 and rain.count(max(rain)) == 1:
            break
    top = -(-(max(rain) + grid) // label) * label
    two = sorted(rng.sample(wet, 2))
    more = sorted(rng.sample(range(5), 2), key=lambda i: -rain[i])
    while rain[more[0]] == rain[more[1]]:
        more = sorted(rng.sample(range(5), 2), key=lambda i: -rain[i])
    p.update(rain=rain, step=grid, label=label, top=top,
             ask={"two": two, "one": rng.choice(wet), "more": more})
    return p


# --- the weather symbols ------------------------------------------------------------------------------

def _cloud(ax, cx: float, cy: float, s: float, gid: str | None = None, fill: str = "#d6dade") -> None:
    """A cloud of three puffs on a flat base: outlined first, then filled over, so no line shows inside it."""
    puffs = [(cx - 0.36 * s, cy - 0.08 * s, 0.32 * s), (cx, cy + 0.1 * s, 0.42 * s), (cx + 0.38 * s, cy - 0.06 * s, 0.3 * s)]
    base = (cx - 0.36 * s, cy - 0.4 * s, 0.74 * s, 0.3 * s)
    for k, (x, y, r) in enumerate(puffs):
        ax.add_patch(Circle((x, y), r, facecolor=fill, edgecolor=INK, linewidth=2.4, zorder=2, gid=gid if k == 1 else None))
    ax.add_patch(Rectangle(base[:2], base[2], base[3], facecolor=fill, edgecolor=INK, linewidth=2.4, zorder=2))
    for x, y, r in puffs:
        ax.add_patch(Circle((x, y), r, facecolor=fill, edgecolor="none", zorder=3))
    ax.add_patch(Rectangle(base[:2], base[2], base[3], facecolor=fill, edgecolor="none", zorder=3))


def _symbol(ax, kind: str, cx: float, cy: float, s: float, gid: str | None = None) -> None:
    if kind == "sunny":
        for k in range(8):
            t = k * math.pi / 4
            ax.plot([cx + 0.55 * s * math.cos(t), cx + 0.85 * s * math.cos(t)],
                    [cy + 0.55 * s * math.sin(t), cy + 0.85 * s * math.sin(t)], color=INK, linewidth=1.8)
        ax.add_patch(Circle((cx, cy), 0.42 * s, facecolor="#ececec", edgecolor=INK, linewidth=1.6, gid=gid))
    elif kind == "cloudy":
        _cloud(ax, cx, cy, s, gid)
    elif kind == "rainy":
        _cloud(ax, cx, cy + 0.25 * s, 0.85 * s, gid, fill="#aab3ba")
        for dx in (-0.3, 0.05, 0.4):
            x = cx + dx * s
            ax.plot([x, x - 0.12 * s], [cy - 0.2 * s, cy - 0.62 * s], color=INK, linewidth=2.0)
    else:
        for k, (dy, half) in enumerate(((0.38, 0.62), (0.0, 0.8), (-0.38, 0.5))):
            y = cy + dy * s
            x0, x1 = cx - 0.8 * s, cx - 0.8 * s + 2 * half * s * 0.9
            ax.plot([x0, x1], [y, y], color=INK, linewidth=2.0, gid=gid if k == 0 else None)
            ax.add_patch(Arc((x1, y + 0.13 * s), 0.26 * s, 0.26 * s, theta1=-90, theta2=180, edgecolor=INK, linewidth=2.0))


def _draw_symbols(p: dict):
    w0, w = 3.0, 2.3
    rows = [("Day", 0.75), ("Weather", 1.8), ("Temperature\nat noon", 0.95)]
    heights = [h for _, h in rows]
    total = sum(heights)
    fig, ax = new_figure(8.8, 5.4)
    width = w0 + 5 * w
    y = total
    tops = []
    for label, h in rows:
        y -= h
        tops.append(y)
        ax.text(0.15, y + h / 2, label, ha="left", va="center", fontsize=11.5, fontweight="bold")
    ax.add_patch(Rectangle((0, tops[0]), width, heights[0], facecolor="#e9edf0", edgecolor="none", zorder=0))
    for i, d in enumerate(DAYS):
        cx = w0 + (i + 0.5) * w
        ax.text(cx, tops[0] + heights[0] / 2, d, ha="center", va="center", fontsize=11, fontweight="bold", gid=f"day-{i}")
        _symbol(ax, p["weather"][i], cx, tops[1] + heights[1] / 2, 0.62, gid=f"sym-{i}-{p['weather'][i]}")
        ax.text(cx, tops[2] + heights[2] / 2, f"{p['temps'][i]} °C", ha="center", va="center", fontsize=12, gid=f"temp-{i}")
    for k, yy in enumerate([0, *[sum(heights[j:]) for j in range(len(heights))]]):
        ax.plot([0, width], [yy, yy], color=INK, linewidth=1.2 if k in (0, len(heights)) else 0.8)
    for x in [0, w0] + [w0 + j * w for j in range(1, 6)]:
        ax.plot([x, x], [0, total], color=INK, linewidth=1.2 if x in (0, width) else 0.8)
    # the key: each symbol with its word
    ax.text(0.15, -0.85, "Key:", ha="left", va="center", fontsize=11.5, fontweight="bold")
    for k, kind in enumerate(WEATHER):
        x = 2.0 + k * 3.0
        _symbol(ax, kind, x, -0.85, 0.42)
        ax.text(x + 0.55, -0.85, kind, ha="left", va="center", fontsize=11)
    ax.set_xlim(-0.05, width + 0.05)
    ax.set_ylim(-1.45, total + 0.05)
    ax.set_aspect("equal")
    ax.axis("off")
    ax.set_title(f"The weather at a school in {p['town']}", fontsize=12.5)
    return fig


def _draw_rain(p: dict):
    fig, ax = new_figure(7.0, 4.5)
    bars = ax.bar(range(5), p["rain"], width=0.6, color=FILL, edgecolor=INK, linewidth=1.0, zorder=3)
    for i, b in enumerate(bars):
        b.set_gid(f"bar-{i}")
    ax.set_xticks(range(5), DAYS)
    ax.set_yticks(range(0, p["top"] + 1, p["label"]))
    ax.set_yticks(range(0, p["top"] + 1, p["step"]), minor=True)
    ax.yaxis.grid(True, which="both", color=GRID, linewidth=0.8)
    ax.set_axisbelow(True)
    ax.set_ylim(0, p["top"])
    ax.set_xlim(-0.6, 4.6)
    ax.tick_params(labelsize=10.5)
    ax.tick_params(axis="y", which="minor", length=0)
    ax.set_ylabel("Rainfall (mm)", fontsize=11)
    ax.set_title(f"Rainfall at a school in {p['town']}", fontsize=12.5)
    return fig


def draw(p: dict):
    return _draw_symbols(p) if p["kind"] == "symbols" else _draw_rain(p)


VERBS = ["records", "keeps a chart of", "writes down", "watches"]
SETTINGS = ["for a school project", "for one week", "with the science club", "in the school weather corner",
            "for homework", "with the class"]


def _mm(n: int) -> list[str]:
    return [f"{n} mm", f"{n}mm", f"{n} millimetres"]


def _degrees(n: int) -> list[str]:
    return [f"{n} °C", f"{n}°C", f"{n} degrees", f"{n} degrees Celsius"]


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    lead = f"{who} {rng.choice(VERBS)} the weather at a school in {p['town']} {rng.choice(SETTINGS)}. "
    ask = p["ask"]
    if p["kind"] == "symbols":
        w, t = p["weather"], p["temps"]
        kind = ask["count"]
        how = "On how many days did it rain?" if kind == "rainy" else f"On how many days was it {kind}?"
        hottest = DAYS[t.index(max(t))]
        warm_next = [DAYS[i] for i in sorted(range(5), key=lambda i: -t[i]) if DAYS[i] != hottest]
        d = ask["day"]
        out = [count(lead + how, w.count(kind), "days"),
               mcq("Which day was the hottest?", hottest, warm_next, rng),
               mcq(f"What was the weather like on {DAYS[d]}?", w[d], [k for k in WEATHER if k != w[d]], rng)]
        if p["level"] == "upper":
            a, b = ask["warmer"]
            out.append(short(f"How many degrees warmer was it on {DAYS[a]} than on {DAYS[b]}?", t[a] - t[b], _degrees(t[a] - t[b])))
        return out
    r = p["rain"]
    wettest = DAYS[r.index(max(r))]
    wet_next = [DAYS[i] for i in sorted(range(5), key=lambda i: -r[i]) if DAYS[i] != wettest]
    a, b = ask["two"]
    out = [mcq(lead + "Which day had the most rain?", wettest, wet_next, rng),
           short(f"How much rain fell on {DAYS[a]} and {DAYS[b]} altogether?", r[a] + r[b], _mm(r[a] + r[b]))]
    if p["level"] == "upper":
        x, y = ask["more"]
        out.append(short(f"How much more rain fell on {DAYS[x]} than on {DAYS[y]}?", r[x] - r[y], _mm(r[x] - r[y])))
    else:
        i = ask["one"]
        out.append(short(f"How much rain fell on {DAYS[i]}?", r[i], _mm(r[i])))
    if r.count(0):
        out.append(count("On how many days did no rain fall?", r.count(0), "days"))
    return out
