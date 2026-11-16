"""Illness and body temperature (P2-P6), of four kinds.

- thermometer (stages 2-4): one thermometer, 35 to 42 °C with a mark every degree, its red liquid ending on a whole
  degree from 38 to 41 °C, and "Normal body temperature: 37 °C" printed. The reading; how many degrees above normal.
- clinic (stages 5-6): three pupils' thermometers at the school clinic, a mark every half degree, one reading above
  37.5 °C and the others 36 to 37 °C, with "A temperature above 37.5 °C is a fever" printed. Which pupil has a fever; a
  reading.
- cases (stages 4-6): a bar chart of the cases of malaria, flu or diarrhoea an invented health centre saw each month
  for six months, every bar ending on a gridline. The month with most cases (plainly most); a month's cases; how many
  more in one month than another.
- chart (stages 5-6): a sick pupil's temperature each morning from Monday to Saturday as a line graph on half-degree
  gridlines, with the normal 37 °C dashed. The day it was highest, a day's reading, and the day it first came back
  down to 37 °C.

Health centres are invented; no number belongs to a real place.
"""
from __future__ import annotations

import random

from matplotlib.patches import Circle, FancyBboxPatch, Rectangle

from ..core import FILL, GRID, INK, NAMES, mcq, measure, new_figure, num, short

ID = "illness_data_p"
KIND = "graph.bar"
SUBJECT = "science"
BANDS = ("P",)
CONCEPTS = ("science.diseases-and-health", "science.body-temperature-measurement")
# A topic whose sections the book lists is reached only if its name or a section names human or infectious diseases,
# body temperature, a fever or illness.
NEEDS = r"human diseases|infectious diseases|body temperature|\bfever|illness"
AVOID = (r"\bcells?\b|animals|rabbit|respiratory system|circulatory|digest|science in context|glossary|reproduct|sexual|"
         r"\bHIV\b|STIs|social factors")

DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October",
          "November", "December"]
DISEASES = ["malaria", "flu", "diarrhoea"]
CENTRES = ["Hill View Health Centre", "Lakeside Health Centre", "Green Valley Health Centre", "Sunrise Health Centre",
           "Riverside Health Centre"]
RED = "#c0392b"


def concepts_for(p: dict) -> tuple[str, ...]:
    return ("science.diseases-and-health",) if p["kind"] == "cases" else CONCEPTS


def stages(p: dict) -> tuple[int, int]:
    return {"thermometer": (2, 4), "clinic": (5, 6), "cases": (4, 6), "chart": (5, 6)}[p["kind"]]


def _chart(rng: random.Random) -> dict:
    while True:
        start = rng.choice([37.0, 37.5])
        rise = rng.choice([1, 2])
        peak = rng.choice([39.0, 39.5, 40.0])
        temps = [start]
        for k in range(rise):
            temps.append(round((start + (peak - start) * (k + 1) / rise) * 2) / 2)
        down = rng.choice([2, 3])
        for k in range(down):
            temps.append(round((peak - (peak - 37.0) * (k + 1) / down) * 2) / 2)
        while len(temps) < 6:
            temps.append(rng.choice([36.5, 37.0]))
        temps = temps[:6]
        if len(temps) == 6 and temps.count(max(temps)) == 1 and temps[-1] <= 37 and all(36 <= t <= 40 for t in temps):
            return {"band": "P", "kind": "chart", "temps": [float(t) for t in temps]}


def sample(rng: random.Random) -> dict:
    kind = rng.choice(["thermometer", "clinic", "cases", "chart"])
    if kind == "thermometer":
        return {"band": "P", "kind": "thermometer", "reading": rng.choice([38, 39, 40, 41])}
    if kind == "clinic":
        kids = rng.sample(NAMES, 3)
        temps = rng.sample([36.0, 36.5, 37.0], 2) + [rng.choice([38.0, 38.5, 39.0, 39.5, 40.0])]
        rng.shuffle(temps)
        return {"band": "P", "kind": "clinic", "children": kids, "temps": temps}
    if kind == "cases":
        step = rng.choice([5, 10])
        first = rng.randrange(12)
        while True:
            cases = [rng.randrange(step, 12 * step + 1, step) for _ in range(6)]
            top = sorted(cases)
            if top[-1] - top[-2] >= step and len(set(cases)) >= 4:
                break
        return {"band": "P", "kind": "cases", "step": step, "disease": rng.choice(DISEASES),
                "centre": rng.choice(CENTRES), "months": [MONTHS[(first + k) % 12] for k in range(6)], "cases": cases}
    return _chart(rng)


# --- drawing ----------------------------------------------------------------------------------------------------

def _thermometer(ax, y, reading, half: bool, gid: str):
    """A thermometer along y, its scale in °C on the x axis (35 to 42), the liquid from the bulb to the reading."""
    ax.add_patch(FancyBboxPatch((34.35, y - 0.2), 8.1, 0.4, boxstyle="round,pad=0,rounding_size=0.2", facecolor="white",
                                edgecolor=INK, linewidth=1.4, zorder=2))
    ax.add_patch(Circle((34.35, y), 0.33, facecolor=RED, edgecolor=INK, linewidth=1.4, zorder=3))
    ax.add_patch(Rectangle((34.35, y - 0.08), reading - 34.35, 0.16, facecolor=RED, edgecolor="none", zorder=3,
                           gid=f"liquid:{gid}:{reading}"))
    t = 35.0
    while t <= 42.0 + 1e-9:
        whole = abs(t - round(t)) < 1e-9
        ax.plot([t, t], [y + 0.2, y + (0.42 if whole else 0.32)], color=INK, linewidth=1.2 if whole else 0.9, zorder=2)
        if whole:
            ax.text(t, y + 0.62, str(int(round(t))), ha="center", va="center", fontsize=11)
        t += 0.5 if half else 1.0


def _draw_thermometer(p: dict):
    fig, ax = new_figure(8.0, 2.6)
    _thermometer(ax, 0.0, p["reading"], False, "0")
    ax.text(42.75, 0.0, "°C", ha="left", va="center", fontsize=12)
    ax.text(38.5, -0.75, "Normal body temperature: 37 °C", ha="center", va="center", fontsize=12)
    ax.set_xlim(33.8, 43.6)
    ax.set_ylim(-1.1, 1.05)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def _draw_clinic(p: dict):
    fig, ax = new_figure(9.4, 4.6)
    for i, (kid, t) in enumerate(zip(p["children"], p["temps"])):
        y = -1.45 * i
        _thermometer(ax, y, t, True, str(i))
        ax.text(33.85, y, kid, ha="right", va="center", fontsize=12, fontweight="bold")
        ax.text(42.75, y, "°C", ha="left", va="center", fontsize=12)
    ax.text(38.0, -1.45 * 2 - 0.85, "A temperature above 37.5 °C is a fever.", ha="center", va="center", fontsize=12)
    ax.set_xlim(31.6, 43.6)
    ax.set_ylim(-1.45 * 2 - 1.2, 1.05)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def _draw_cases(p: dict):
    fig, ax = new_figure(7.6, 4.8)
    cases, step = p["cases"], p["step"]
    for i, c in enumerate(cases):
        bar = ax.bar(i, c, 0.6, color=FILL, edgecolor=INK, linewidth=1.0)
        bar[0].set_gid(f"bar:{i}")
    top = max(cases) + step
    ax.set_xticks(range(6))
    ax.set_xticklabels([m[:3] for m in p["months"]], fontsize=11)
    label = 2 * step if top / step > 10 else step
    ax.set_yticks(range(0, top + 1, label))
    ax.set_yticks(range(0, top + 1, step), minor=True)
    ax.tick_params(axis="y", labelsize=10.5)
    ax.tick_params(axis="y", which="minor", length=0)
    ax.set_ylim(0, top)
    ax.set_xlim(-0.6, 5.6)
    ax.yaxis.grid(True, which="both", color=GRID, linewidth=0.7)
    ax.set_axisbelow(True)
    ax.set_ylabel("Number of cases", fontsize=11)
    ax.set_title(f"Cases of {p['disease']} at {p['centre']}", fontsize=12)
    return fig


def _draw_chart(p: dict):
    fig, ax = new_figure(7.4, 4.6)
    temps = p["temps"]
    ax.plot(range(6), temps, color=INK, linewidth=2.0, marker="o", markersize=6, zorder=3, gid="temps")
    ax.plot([-0.4, 5.4], [37, 37], color=RED, linewidth=1.4, linestyle=(0, (5, 3)), zorder=2, gid="normal")
    ax.text(5.45, 37, "normal\n37 °C", ha="left", va="center", fontsize=10.5, color=RED)
    ax.set_xticks(range(6))
    ax.set_xticklabels([d[:3] for d in DAYS], fontsize=11)
    ax.set_yticks([36 + k for k in range(5)])
    ax.set_yticks([36 + 0.5 * k for k in range(9)], minor=True)
    ax.set_yticklabels([str(36 + k) for k in range(5)], fontsize=10.5)
    ax.tick_params(axis="y", which="minor", length=0)
    ax.set_ylim(36, 40.5)
    ax.set_xlim(-0.4, 6.4)
    ax.yaxis.grid(True, which="both", color=GRID, linewidth=0.7)
    ax.xaxis.grid(True, color=GRID, linewidth=0.7)
    ax.set_axisbelow(True)
    ax.set_ylabel("Temperature (°C)", fontsize=11)
    ax.set_title("Temperature each morning", fontsize=12)
    return fig


def draw(p: dict):
    return {"thermometer": _draw_thermometer, "clinic": _draw_clinic, "cases": _draw_cases, "chart": _draw_chart}[p["kind"]](p)


# --- questions --------------------------------------------------------------------------------------------------

def _deg(v) -> list[str]:
    return measure(v, "°C") + [f"{num(v)} degrees", f"{num(v)} degrees Celsius", f"{num(v)}°"]


def questions(p: dict, rng: random.Random) -> list:
    if p["kind"] == "thermometer":
        who, carer = rng.sample(NAMES, 2)
        r = p["reading"]
        return [short(f"{who} feels hot and tired. {carer} measures the temperature. What temperature does the "
                      "thermometer show?", f"{r}", _deg(r)),
                short("How many degrees above normal body temperature is this?", f"{r - 37}", _deg(r - 37))]
    if p["kind"] == "clinic":
        kids, temps = p["children"], p["temps"]
        nurse = rng.choice([n for n in NAMES if n not in kids])
        hot = kids[[t > 37.5 for t in temps].index(True)]
        other = rng.choice(kids)
        t = temps[kids.index(other)]
        return [mcq(f"{nurse}, the school nurse, checks three pupils. Which pupil has a fever?", hot,
                    [k for k in kids if k != hot], rng),
                short(f"What temperature did the nurse read for {other}?", num(t), _deg(t))]
    if p["kind"] == "cases":
        months, cases = p["months"], p["cases"]
        who = rng.choice(NAMES)
        best = months[cases.index(max(cases))]
        second = months[cases.index(sorted(cases)[-2])]
        m1 = rng.choice(months)
        a, b = rng.sample([k for k in range(6)], 2)
        if cases[a] == cases[b]:
            b = next(k for k in range(6) if cases[k] != cases[a])
        a, b = (a, b) if cases[a] > cases[b] else (b, a)
        others = [m for m in months if m not in (best, second)]
        return [mcq(f"{who} reads the {p['centre']} chart. In which month were there most cases of {p['disease']}?",
                    best, [second] + rng.sample(others, 2), rng),
                count_q(f"How many cases of {p['disease']} were there in {m1}?", cases[months.index(m1)]),
                count_q(f"How many more cases were there in {months[a]} than in {months[b]}?", cases[a] - cases[b])]
    temps = p["temps"]
    who = rng.choice(NAMES)
    peak = temps.index(max(temps))
    back = next(i for i in range(peak, 6) if temps[i] <= 37)
    day = rng.choice(DAYS)
    near = lambda i: [DAYS[k] for k in sorted(range(6), key=lambda k: abs(k - i)) if k != i]  # noqa: E731
    return [mcq(f"{who} was ill for a week. On which day was the temperature highest?", DAYS[peak], near(peak), rng),
            short(f"What was the temperature on {day}?", num(temps[DAYS.index(day)]), _deg(temps[DAYS.index(day)])),
            mcq("On which day did the temperature first come back down to 37 °C?", DAYS[back], near(back), rng)]


def count_q(stem: str, n: int):
    return short(stem, n, [f"{n} cases"])
