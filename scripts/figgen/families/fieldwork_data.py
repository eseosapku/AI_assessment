"""Fieldwork data (UP; P6 geography): the record sheets of two fieldwork methods, as the Rwanda S4 "Fieldwork techniques"
unit (fieldwork methods and procedures) and the WAEC geographic techniques teach them. The places and numbers are
invented.

Two sub-types:
- traffic: a tally sheet of a 15-minute traffic count at a junction in Town P (cars, motorcycles, minibuses, lorries,
  bicycles), every count drawn as tally marks in fives. The vehicles counted altogether, the commonest kind, the
  vehicles of one kind to expect in an hour (count in 15 minutes × 4, printed) and the share of one kind (percentage =
  count ÷ total × 100, printed).
- river: a cross-section of River K drawn from a student's measurements (the width, and five depths at equal steps
  across), with a table of three float timings over a 10 m stretch and the rules printed: mean depth = sum of depths ÷
  number of depths; cross-sectional area = width × mean depth; velocity = distance ÷ mean time; discharge = area ×
  velocity. The mean depth, the cross-sectional area, the velocity and the discharge.

Every answer is exact to two decimal places at most.
"""
from __future__ import annotations

import random
from fractions import Fraction

from matplotlib.patches import Polygon

from ..core import INK, NAMES, mcq, new_figure, short
from ._geo_charts import num_forms, pct_forms
from .econ_tables import table

ID = "fieldwork_data"
KIND = "table.data"
SUBJECT = "geography"
BANDS = ("UP",)
CONCEPTS = ("geography.fieldwork-methods", "geography.fieldwork-statistics", "geography.fieldwork-procedures")
# A topic whose sections the book lists is reached only if its name or a section names fieldwork or practical geography.
NEEDS = r"field ?work|practical geography|geographic techniques"
# The coursebook's introduction and its practice questions share the fieldwork concepts but teach no method.
AVOID = r"^introduction$|exam-style"
VEHICLES = ["Cars", "Motorcycles", "Minibuses", "Lorries", "Bicycles"]


def _traffic(rng: random.Random) -> dict | None:
    counts = [rng.randint(3, 28) for _ in VEHICLES]
    ranked = sorted(counts, reverse=True)
    total = sum(counts)
    if ranked[0] - ranked[1] < 3 or len(set(counts)) < 5:
        return None
    whole = [i for i, c in enumerate(counts) if c * 100 % total == 0]
    if not whole:
        return None
    return {"band": "UP", "sub": "traffic", "counts": counts, "start": rng.choice(["7:30", "8:00", "12:15", "16:45"]),
            "ask": {"hour": rng.randrange(5), "share": rng.choice(whole)}}


def _river(rng: random.Random) -> dict | None:
    width = rng.randint(4, 10)
    depths = [rng.randint(2, 9) for _ in range(5)]  # tenths of a metre
    depths[0], depths[-1] = min(depths[0], 4), min(depths[-1], 4)
    mean = Fraction(sum(depths), 50)
    area = width * mean
    t = rng.choice([20, 25, 40, 50])
    times = [t + d for d in rng.choice([[-2, 0, 2], [-1, 0, 1], [-3, 1, 2], [-2, -1, 3], [0, 0, 0], [-4, 1, 3]])]
    rng.shuffle(times)
    velocity = Fraction(10, t)
    discharge = area * velocity
    if (area * 100).denominator != 1 or (discharge * 100).denominator != 1:
        return None
    return {"band": "UP", "sub": "river", "width": width, "depths": depths, "times": times}


def sample(rng: random.Random) -> dict:
    sub = rng.choice(["traffic", "river"])
    while True:
        p = (_traffic if sub == "traffic" else _river)(rng)
        if p:
            return p


HOUR = "Vehicles in an hour = vehicles counted in 15 minutes × 4"
SHARE = "Percentage of the vehicles = count of the kind ÷ total count × 100"
RULES = ["Mean depth = sum of the depths ÷ number of depths", "Cross-sectional area = width × mean depth",
         "Velocity = distance ÷ mean time", "Discharge = cross-sectional area × velocity"]


def _tally(ax, x, y, n, gid):
    """n tally marks from (x, y): four upright strokes and a fifth across them for each group of five."""
    gx = x
    for g in range(n // 5 + (1 if n % 5 else 0)):
        k = min(5, n - 5 * g)
        for i in range(min(k, 4)):
            ax.plot([gx + 0.09 * i, gx + 0.09 * i], [y - 0.13, y + 0.13], color=INK, linewidth=1.3, gid=gid)
        if k == 5:
            ax.plot([gx - 0.05, gx + 0.32], [y - 0.1, y + 0.1], color=INK, linewidth=1.3, gid=gid)
        gx += 0.52


def _draw_traffic(p: dict):
    fig, ax = new_figure(9.0, 4.6)
    widths = [1.9, 3.7]
    rows = [[v, ""] for v in VEHICLES]
    bottom = table(ax, ["Kind of vehicle", "Tally"], rows, widths, top=-0.75, rh=0.42, hh=0.45, align=["l", "l"],
                   fontsize=10.5)
    for k, n in enumerate(p["counts"]):
        y = -0.75 - 0.45 - 0.42 * k - 0.21
        _tally(ax, 2.05, y, n, f"tally:{k}")
    ax.text(0.1, -0.25, f"Traffic count at the junction in Town P, 15 minutes from {p['start']}", ha="left", va="center",
            fontsize=11.5, fontweight="bold")
    ax.text(0.1, bottom - 0.35, HOUR, ha="left", va="center", fontsize=10)
    ax.text(0.1, bottom - 0.75, SHARE, ha="left", va="center", fontsize=10)
    ax.set_xlim(0, 7.6)
    ax.set_ylim(bottom - 1.05, 0.05)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def _draw_river(p: dict):
    fig, ax = new_figure(9.6, 6.2)
    w, d = p["width"], [v / 10 for v in p["depths"]]
    sx = 8.0 / w  # drawing units per metre across
    sy = 2.6  # drawing units per metre of depth
    xs = [0.5 + sx * w * (k + 1) / 6 for k in range(5)]
    bed = [(0.5, 0.0)] + [(x, -sy * v) for x, v in zip(xs, d)] + [(0.5 + 8.0, 0.0)]
    ax.add_patch(Polygon(bed, closed=True, facecolor="#aed6f1", edgecolor="none", zorder=1, gid="water"))
    ax.plot(*zip(*bed), color="#7a5230", linewidth=2.2, zorder=2, gid="bed")
    ax.plot([0.5, 8.5], [0, 0], color="#1f5f9e", linewidth=1.6, zorder=2, gid="surface")
    for k, (x, v) in enumerate(zip(xs, d)):
        ax.plot([x, x], [0, -sy * v], color=INK, linewidth=1.0, linestyle="--", zorder=3, gid=f"gauge:{k}")
        ax.text(x, 0.22, f"{v:.1f} m", ha="center", va="center", fontsize=10, zorder=4, gid=f"depth:{k}")
    ax.text(0.5, 0.62, "Depth at each measuring point:", ha="left", va="center", fontsize=9.5, style="italic")
    low = -sy * 0.9 - 0.3
    ax.annotate("", xy=(8.5, low), xytext=(0.5, low), arrowprops=dict(arrowstyle="<->", color=INK, lw=1.2))
    ax.plot([0.5, 0.5], [low - 0.12, 0], color=INK, linewidth=0.6, linestyle=":", gid="edge-left")
    ax.plot([8.5, 8.5], [low - 0.12, 0], color=INK, linewidth=0.6, linestyle=":", gid="edge-right")
    ax.text(4.5, low - 0.25, f"Width of the river: {w} m", ha="center", va="center", fontsize=10.5, gid="width")
    ax.text(0.5, 1.15, "Cross-section of River K measured on a fieldwork day (depths at equal steps across)", ha="left",
            va="center", fontsize=11.5, fontweight="bold")
    top = low - 0.6
    table(ax, ["Float timed over 10 m", "Trial 1", "Trial 2", "Trial 3"],
          [["Time (seconds)"] + [str(t) for t in p["times"]]], [3.3, 1.1, 1.1, 1.1], top=top, rh=0.42, hh=0.45,
          align=["l", "r", "r", "r"], fontsize=10, x0=0.5)
    for k, rule in enumerate(RULES):
        ax.text(0.5, top - 1.2 - 0.38 * k, rule, ha="left", va="center", fontsize=10, gid=f"rule:{k}")
    ax.set_xlim(0, 9.4)
    ax.set_ylim(top - 1.2 - 0.38 * 3 - 0.3, 1.4)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def draw(p: dict):
    return _draw_traffic(p) if p["sub"] == "traffic" else _draw_river(p)


VERBS = ["studies", "copies", "looks at", "is given"]
SETTINGS = ["after a fieldwork day", "for a fieldwork report", "in a geography lesson", "for homework",
            "at the geography club", "while revising in Huye", "for a class test", "while revising in Rubavu"]


def _dec(x: Fraction) -> tuple[str, float | int]:
    """An exact number to two decimal places at most, as text and as a number."""
    if x.denominator == 1:
        return str(x.numerator), x.numerator
    s = f"{float(x):.2f}".rstrip("0")
    return s, float(s)


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    if p["sub"] == "traffic":
        lead = f"{who} {rng.choice(VERBS)} this traffic count sheet {rng.choice(SETTINGS)}."
        c = p["counts"]
        total = sum(c)
        top = VEHICLES[c.index(max(c))]
        h = p["ask"]["hour"]
        k = p["ask"]["share"]
        return [
            short(f"{lead} How many vehicles were counted at the junction in Town P altogether?", total,
                  num_forms(total, "vehicles")),
            mcq("Which kind of vehicle passed the junction in Town P most often during the count?", top,
                [v for v in VEHICLES if v != top], rng),
            short(f"{HOUR}. How many {VEHICLES[h].lower()} would pass the junction in Town P in an hour?", c[h] * 4,
                  num_forms(c[h] * 4, VEHICLES[h].lower())),
            short(f"{SHARE}. What percentage of the vehicles counted at the junction in Town P were "
                  f"{VEHICLES[k].lower()}?", f"{c[k] * 100 // total}%", pct_forms(c[k] * 100 // total)),
        ]
    lead = f"{who} {rng.choice(VERBS)} these River K measurements {rng.choice(SETTINGS)}."
    mean = Fraction(sum(p["depths"]), 50)
    area = p["width"] * mean
    t = Fraction(sum(p["times"]), 3)
    velocity = 10 / t
    discharge = area * velocity
    m_s, m_v = _dec(mean)
    a_s, a_v = _dec(area)
    v_s, v_v = _dec(velocity)
    q_s, q_v = _dec(discharge)
    return [
        short(f"{lead} {RULES[0]}. What is the mean depth of River K, in metres?", m_s, num_forms(m_v, "m", "metres")),
        short(f"{RULES[1]}. What is the cross-sectional area of River K, in m²?", a_s, num_forms(a_v, "m²", "m2")),
        short(f"{RULES[2]}. Using the mean of the three float times, what is the velocity of River K, in m/s?", v_s,
              num_forms(v_v, "m/s", "metres per second")),
        short(f"{RULES[3]}. What is the discharge of River K, in m³/s?", q_s,
              num_forms(q_v, "m³/s", "m3/s", "cubic metres per second", "cumecs")),
    ]
