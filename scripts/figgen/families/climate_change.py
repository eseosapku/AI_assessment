"""Climate change (UP; P6 geography): the greenhouse effect, carbon dioxide emissions and a warming record, as Rwanda
S6 "Climate Change", the IGCSE Geography global theme "Reducing Carbon Emissions" and the NERDC and WAEC environmental
management chapters teach it. The countries and the weather station are invented.

Three sub-types:
- greenhouse: the greenhouse effect drawn as a diagram: the Sun, space, the atmosphere with its greenhouse gases and the
  Earth's surface, with five arrows lettered P to T: short-wave radiation from the Sun reaching the surface, short-wave
  radiation reflected back to space by the atmosphere, long-wave radiation from the surface absorbed by the greenhouse
  gases, long-wave radiation from the surface escaping to space, and long-wave radiation the greenhouse gases send
  back to the surface. A key tells short-wave (straight) from long-wave (wavy) arrows. Which letter shows a stated
  arrow, and what a lettered arrow shows; every key comes from this module's fixed table of the arrows.
- emissions: a table of the carbon dioxide emitted per person and the population of Countries P to S, with total =
  per person × population printed. One country's total, the country that emits the most in total (never the one that
  emits the most per person), the gap per person between two countries, and the lowest emitter per person.
- warming: a line graph of the mean yearly temperature at Weather Station X every ten years from 1960 to 2020. The rise from 1960 to 2020, the average rise each decade (rise ÷ number of decades,
  printed), and the first year the station's mean passed a stated temperature. Every value sits on a 0.1 °C
  gridline.
"""
from __future__ import annotations

import math
import random
from fractions import Fraction

from matplotlib.patches import Circle, Rectangle

from ..core import INK, NAMES, mcq, new_figure, short
from ._bio_parts import letter_choice
from ._geo_charts import line_chart, num_forms
from .econ_tables import titled_table

ID = "climate_change"
KIND = "process.flow"
SUBJECT = "geography"
BANDS = ("UP",)
MORE = {"greenhouse": ("geography.greenhouse-effect", "geography.climate-change"),
        "emissions": ("geography.climate-change", "geography.atmospheric-pollution",
                      "geography.climate-change-mitigation-adaptation"),
        "warming": ("geography.climate-change",)}
CONCEPTS = ("geography.greenhouse-effect", "geography.climate-change", "geography.atmospheric-pollution",
            "geography.climate-change-mitigation-adaptation")
# A topic whose sections the book lists is reached only if its name or a section names the climate, carbon, the
# greenhouse effect, global warming or emissions.
NEEDS = r"climate|carbon|greenhouse|global warming|emission"
# Climate as weather and climatic regions shares the climate-change concept, but teaches the weather.
AVOID = r"weather|climatic region|climate zone|natural vegetation"
ARROWS = ["incoming", "reflected", "absorbed", "escaping", "returned"]
# What each arrow shows, as a question names it.
SHOWS = {"incoming": "short-wave radiation from the Sun reaching the Earth's surface",
         "reflected": "short-wave radiation reflected back to space by the atmosphere",
         "absorbed": "long-wave radiation from the Earth's surface absorbed by the greenhouse gases",
         "escaping": "long-wave radiation from the Earth's surface escaping to space",
         "returned": "long-wave radiation sent back to the Earth's surface by the greenhouse gases"}
LETTERS = ["P", "Q", "R", "S", "T"]
COUNTRIES = ["P", "Q", "R", "S"]
YEARS = [1960, 1970, 1980, 1990, 2000, 2010, 2020]


def concepts_for(p: dict) -> tuple[str, ...]:
    return MORE[p["sub"]]


def _greenhouse(rng: random.Random) -> dict:
    letters = LETTERS[:]
    rng.shuffle(letters)
    slots = ["absorbed", "escaping", "returned"]
    rng.shuffle(slots)
    asked = rng.sample(ARROWS, 3)
    return {"band": "UP", "sub": "greenhouse", "labels": dict(zip(letters, ARROWS)), "slots": slots,
            "ask": {"which": asked[:2], "what": asked[2]}}


def _emissions(rng: random.Random) -> dict | None:
    rows = {c: {"per": Fraction(rng.randint(2, 160), 10), "pop": rng.randint(2, 60)} for c in COUNTRIES}
    total = {c: r["per"] * r["pop"] for c, r in rows.items()}
    if any(t.denominator != 1 for t in total.values()):
        return None
    per = {c: r["per"] for c, r in rows.items()}
    top_t = sorted(total.values(), reverse=True)
    top_p = sorted(per.values(), reverse=True)
    low_p = sorted(per.values())
    if top_t[0] - top_t[1] < 10 or top_p[0] - top_p[1] < 1 or low_p[1] - low_p[0] < Fraction(1, 2):
        return None
    if max(total, key=total.get) == max(per, key=per.get) or len(set(per.values())) < 4:
        return None
    a, b = rng.sample(COUNTRIES, 2)
    if per[a] < per[b]:
        a, b = b, a
    return {"band": "UP", "sub": "emissions", "rows": {c: {"per": str(r["per"]), "pop": r["pop"]} for c, r in rows.items()},
            "year": rng.randint(2015, 2022), "ask": {"total": rng.choice(COUNTRIES), "gap": [a, b]}}


def _warming(rng: random.Random) -> dict | None:
    """Tenths of a degree: a rise of 0.6, 1.2 or 1.8 °C over six decades, never falling, every value on a 0.1 °C
    gridline; the stated temperature lies between plotted values, never on one."""
    rise = rng.choice([6, 12, 18])
    base = rng.randint(160, 220)
    inner = sorted(rng.choices(range(0, rise + 1), k=5))
    vals = [base] + [base + i for i in inner] + [base + rise]
    marks = [m for m in range(base + 1, base + rise) if m not in vals]
    if len(set(vals)) < 5 or not marks:
        return None
    return {"band": "UP", "sub": "warming", "temps": vals, "mark": rng.choice(marks)}


def sample(rng: random.Random) -> dict:
    sub = rng.choice(["greenhouse", "emissions", "warming"])
    make = {"greenhouse": _greenhouse, "emissions": _emissions, "warming": _warming}[sub]
    while True:
        p = make(rng)
        if p:
            return p


# --- the greenhouse diagram ------------------------------------------------------------------------------------------

SHORT = "#e08a00"
LONG = "#c0392b"
GROUND = (0.0, 1.2)
AIR = (3.2, 4.6)
TOP = 6.9
SLOT_X = [3.9, 5.3, 6.7]


def _wavy(ax, a, b, gid, color=LONG):
    """A wavy arrow from a to b: long-wave (heat) radiation."""
    (x0, y0), (x1, y1) = a, b
    n = 120
    length = math.hypot(x1 - x0, y1 - y0)
    ux, uy = (x1 - x0) / length, (y1 - y0) / length
    px, py = -uy, ux
    pts = []
    for k in range(n + 1):
        t = k / n * (length - 0.32)
        w = 0.09 * math.sin(t / length * 2 * math.pi * 5)
        pts.append((x0 + ux * t + px * w, y0 + uy * t + py * w))
    ax.plot(*zip(*pts), color=color, linewidth=2.0, zorder=5, gid=gid)
    tail = (x0 + ux * (length - 0.34), y0 + uy * (length - 0.34))
    ax.annotate("", xy=b, xytext=tail, zorder=5,
                arrowprops=dict(arrowstyle="-|>,head_length=0.6,head_width=0.32", color=color, lw=2.0, shrinkA=0,
                                shrinkB=0))


def _straight(ax, a, b, gid, color=SHORT):
    ax.plot([a[0], b[0] - (b[0] - a[0]) * 0.06], [a[1], b[1] - (b[1] - a[1]) * 0.06], color=color, linewidth=2.4,
            zorder=5, gid=gid)
    ax.annotate("", xy=b, xytext=(a[0] + (b[0] - a[0]) * 0.8, a[1] + (b[1] - a[1]) * 0.8), zorder=5,
                arrowprops=dict(arrowstyle="-|>,head_length=0.6,head_width=0.32", color=color, lw=2.4, shrinkA=0,
                                shrinkB=0))


def _arrow_path(name: str, slots: list[str]):
    """Each arrow's start and end, in the diagram's units."""
    if name == "incoming":
        return (1.55, 5.65), (2.9, GROUND[1] + 0.02)
    if name == "reflected":
        return (2.2, AIR[1]), (3.1, TOP - 0.25)
    x = SLOT_X[slots.index(name)]
    if name == "absorbed":
        return (x, GROUND[1] + 0.05), (x + 0.35, (AIR[0] + AIR[1]) / 2)
    if name == "escaping":
        return (x, GROUND[1] + 0.05), (x + 0.75, TOP - 0.25)
    return (x + 0.35, (AIR[0] + AIR[1]) / 2 - 0.1), (x, GROUND[1] + 0.05)  # returned: from the gases down to the ground


def letter_at(name: str, slots: list[str]) -> tuple[float, float]:
    """Where an arrow's letter sits: just left of the arrow, between the ground and the atmosphere for the three arrows
    from or to the ground, and beside the Sun's two arrows, so the arrow nearest a letter is always its own."""
    a, b = _arrow_path(name, slots)
    if name == "incoming":
        y = 2.3
    elif name == "reflected":
        y = 5.6
    else:
        y = 2.05
    t = (y - a[1]) / (b[1] - a[1])
    x = a[0] + (b[0] - a[0]) * t
    return (x + 0.36, y) if name in ("incoming", "reflected") else (x - 0.36, y)


def _draw_greenhouse(p: dict):
    fig, ax = new_figure(9.6, 6.4)
    ax.add_patch(Rectangle((0, GROUND[0]), 10.6, GROUND[1], facecolor="#b5895a", edgecolor=INK, linewidth=1.0, zorder=1,
                           gid="ground"))
    ax.add_patch(Rectangle((0, AIR[0]), 10.6, AIR[1] - AIR[0], facecolor="#d6eaf8", edgecolor="#7fb3d5", linewidth=1.0,
                           zorder=1, gid="atmosphere"))
    for x, y in ((3.55, 4.3), (4.85, 3.45), (6.1, 4.3), (7.45, 3.5), (2.75, 3.5)):
        ax.add_patch(Circle((x, y), 0.07, facecolor="#5d6d7e", edgecolor="none", zorder=2, gid="gas"))
    ax.add_patch(Circle((1.0, 6.1), 0.55, facecolor="#f9d71c", edgecolor="#e0a800", linewidth=1.5, zorder=3, gid="sun"))
    for k in range(12):
        a = 2 * math.pi * k / 12
        ax.plot([1.0 + 0.66 * math.cos(a), 1.0 + 0.82 * math.cos(a)], [6.1 + 0.66 * math.sin(a), 6.1 + 0.82 * math.sin(a)],
                color="#e0a800", linewidth=1.4, zorder=3, gid="ray")
    ax.text(10.5, 6.55, "Space", ha="right", va="center", fontsize=11, fontweight="bold")
    ax.text(10.5, (AIR[0] + AIR[1]) / 2, "Atmosphere with greenhouse\ngases (carbon dioxide,\nmethane, water vapour)",
            ha="right", va="center", fontsize=9.5, gid="atmosphere-label")
    ax.text(10.5, 0.6, "Earth's surface", ha="right", va="center", fontsize=11, fontweight="bold", color="white")
    ax.text(1.0, 5.05, "Sun", ha="center", va="top", fontsize=10.5, fontweight="bold")
    at = {v: k for k, v in p["labels"].items()}
    for name in ARROWS:
        a, b = _arrow_path(name, p["slots"])
        if name in ("incoming", "reflected"):
            _straight(ax, a, b, f"arrow:{name}")
        else:
            _wavy(ax, a, b, f"arrow:{name}")
        lx, ly = letter_at(name, p["slots"])
        ax.text(lx, ly, at[name], ha="center", va="center", fontsize=14, fontweight="bold", zorder=9,
                gid=f"letter:{at[name]}",
                bbox=dict(boxstyle="circle,pad=0.15", facecolor="white", edgecolor=INK, linewidth=1.0))
    # the key: which arrows are which radiation
    ax.plot([0.25, 1.05], [-0.55, -0.55], color=SHORT, linewidth=2.4, gid="key-short")
    ax.text(1.2, -0.55, "short-wave radiation from the Sun", ha="left", va="center", fontsize=9.5)
    xs = [5.4 + 0.8 * k / 60 for k in range(61)]
    ax.plot(xs, [-0.55 + 0.07 * math.sin(k / 60 * 2 * math.pi * 2.5) for k in range(61)], color=LONG, linewidth=2.0,
            gid="key-long")
    ax.text(6.35, -0.55, "long-wave (heat) radiation", ha="left", va="center", fontsize=9.5)
    ax.text(0.1, -0.15, "Key:", ha="left", va="center", fontsize=9.5, fontweight="bold")
    ax.set_xlim(0, 10.6)
    ax.set_ylim(-0.85, TOP + 0.15)
    ax.set_aspect("equal")
    ax.axis("off")
    ax.set_title("The greenhouse effect", fontsize=12.5, fontweight="bold")
    return fig


def draw(p: dict):
    if p["sub"] == "greenhouse":
        return _draw_greenhouse(p)
    if p["sub"] == "emissions":
        rows = []
        for c in COUNTRIES:
            r = p["rows"][c]
            per = Fraction(r["per"])
            rows.append([f"Country {c}", f"{float(per):.1f}", str(r["pop"])])
        return titled_table(f"Carbon dioxide emissions of four countries, {p['year']}",
                            ["Country", "CO₂ emitted per person\n(tonnes a year)", "Population\n(millions)"], rows,
                            ["l", "r", "r"], notes=[TOTAL])
    vals = [v / 10 for v in p["temps"]]
    lo = min(p["temps"]) // 10 - 1
    hi = max(p["temps"]) // 10 + 2
    fig, _ = line_chart(YEARS, {"temperature": vals}, top=hi, bottom=lo, major=1, minor=0.1,
                        ylabel="Mean yearly temperature (°C)", xlabel="Year",
                        title="Mean yearly temperature at Weather Station X", notes=[DECADE], size=(8.0, 5.4))
    return fig


TOTAL = "Total emissions (million tonnes) = CO₂ per person (tonnes) × population (millions)"
DECADE = "Average rise each decade = rise in temperature ÷ number of decades"
VERBS = ["studies", "reads", "looks at", "copies", "is given"]
SETTINGS = ["in a geography lesson", "for homework", "for a project on climate change", "for a class test",
            "at the environment club", "while revising in Kigali", "for a lesson on global warming",
            "on a revision card", "while revising in Musanze", "for a debate on reducing emissions"]


def _deg(t: int) -> tuple[str, list[str]]:
    """Tenths of a degree as a student writes them: "1.2" (and "1.2 °C")."""
    s = f"{t / 10:.1f}"
    v = float(s)
    return s, num_forms(v, "°C", "degrees")


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    if p["sub"] == "greenhouse":
        lead = f"{who} {rng.choice(VERBS)} this diagram of the greenhouse effect {rng.choice(SETTINGS)}."
        at = {v: k for k, v in p["labels"].items()}
        (x, y), z = p["ask"]["which"], p["ask"]["what"]
        others = [n for n in ARROWS if n != z]
        rng.shuffle(others)
        return [
            letter_choice(f"{lead} Which letter shows {SHOWS[x]}?", at[x], [L for L in LETTERS if L != at[x]]),
            letter_choice(f"In the diagram of the greenhouse effect, which letter shows {SHOWS[y]}?", at[y],
                          [L for L in LETTERS if L != at[y]]),
            mcq(f"What does arrow {at[z]} in the diagram of the greenhouse effect show?", SHOWS[z][0].upper() + SHOWS[z][1:],
                [SHOWS[n][0].upper() + SHOWS[n][1:] for n in others], rng),
        ]
    if p["sub"] == "emissions":
        lead = f"{who} {rng.choice(VERBS)} this table of carbon dioxide emissions {rng.choice(SETTINGS)}."
        rows = {c: (Fraction(r["per"]), r["pop"]) for c, r in p["rows"].items()}
        total = {c: int(per * pop) for c, (per, pop) in rows.items()}
        c = p["ask"]["total"]
        top = max(total, key=total.get)
        a, b = p["ask"]["gap"]
        gap = rows[a][0] - rows[b][0]
        low = min(rows, key=lambda k: rows[k][0])
        g = f"{float(gap):.1f}".rstrip("0").rstrip(".")
        return [
            short(f"{lead} {TOTAL}. What were Country {c}'s total carbon dioxide emissions in {p['year']}, in million "
                  "tonnes?", total[c], num_forms(total[c], "million tonnes", "million")),
            mcq(f"{TOTAL}. Which country emitted the most carbon dioxide in total in {p['year']}?", f"Country {top}",
                [f"Country {k}" for k in COUNTRIES if k != top], rng),
            short(f"How many more tonnes of carbon dioxide per person did Country {a} emit than Country {b} in "
                  f"{p['year']}?", g, num_forms(float(g) if "." in g else int(g), "tonnes", "tonnes per person")),
            mcq(f"Which country emitted the least carbon dioxide per person in {p['year']}?", f"Country {low}",
                [f"Country {k}" for k in COUNTRIES if k != low], rng),
        ]
    lead = f"{who} {rng.choice(VERBS)} this graph from Weather Station X {rng.choice(SETTINGS)}."
    t = p["temps"]
    rise, rforms = _deg(t[-1] - t[0])
    per, pforms = _deg((t[-1] - t[0]) // 6)
    first = next(k for k, v in enumerate(t) if v > p["mark"])
    mark = f"{p['mark'] / 10:.1f}"
    return [
        short(f"{lead} By how many °C did the mean yearly temperature at Weather Station X rise from 1960 to 2020?",
              rise, rforms),
        short(f"{DECADE}. What was the average rise in the mean yearly temperature at Weather Station X each decade from "
              "1960 to 2020, in °C?", per, pforms),
        mcq(f"In which year shown on the graph did the mean yearly temperature at Weather Station X first go above "
            f"{mark} °C?", str(YEARS[first]), [str(YEARS[k]) for k in sorted(range(7), key=lambda k: (abs(k - first), k))[1:4]],
            rng),
    ]
