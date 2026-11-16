"""Waste, water and air data (LS, UP): what a class measured about pollution near an invented school, drawn as the S1–S2
Rwanda Chemistry books and the IGCSE environment chapter draw it. Four kinds:

- waste_bar (LS): a bar chart of the mass of each type of waste a school threw away in one week, the bars of the types
  sent for recycling hatched (key printed); the mass of a type, the mass recycled, a type's percentage of all the waste
  (the masses add to 100 kg or 200 kg, so it is whole), the type with the largest mass;
- waste_pie (LS): a pie chart of the percentage of each type in a week's waste, the total mass printed in the title and
  one sector's percentage shown "?"; the missing percentage, the mass of a type, how many kilograms more of one type;
- water (LS, UP): a table of four water samples (pH, nitrate, lead, bacteria) under the safe limits printed in the
  table (WHO drinking-water guideline values); the one sample safe by every limit, how many have too much nitrate,
  how many times the limit a sample's lead is, the one sample whose pH is outside the safe range;
- air (LS, UP): a bar chart of the nitrogen dioxide measured at five places in a town with the limit drawn as a
  dashed line and printed (40 µg/m³, the EU and former WHO annual limit); how many places were above it, by how much
  one place was above it, the place with the lowest level.

Every mass and level sits on a gridline; the places, schools and samples are invented.
"""
from __future__ import annotations

import math
import random
import textwrap

from matplotlib.patches import Patch, Rectangle, Wedge

from ..core import FILL, INK, NAMES, Question, count, grid_y, mcq, new_figure, short
from ._bio_parts import letter_choice

ID = "water_waste_data"
KIND = "graph.bar"
SUBJECT = "chemistry"
BANDS = ("LS", "UP")
CONCEPTS = tuple(f"chemistry.{c}" for c in ("waste-management", "water-pollution", "air-composition-pollution", "ph-scale",
                                             "nitrogen-compounds"))
# A topic whose sections the book lists is reached only if one names waste, pollution, water, air or the environment.
NEEDS = r"waste|pollut|recycl|\bwater\b|air quality|\bair\b|environment"
AVOID = (r"chemistry and society|acid|\bbases?\b|alkal|indicator|analysis|solubility|amine|equilibri|fertili|chlorine|petro|"
         r"polymer|\borganic|carbon|sulphur|sulfur|pure substances|oxygen|glossary")


def concepts_for(p: dict) -> tuple[str, ...]:
    """Each kind carries only what it shows; at UP the water table's pH and nitrate and the air chart's nitrogen
    dioxide are what the IGCSE environment chapter carries."""
    if p["kind"] in ("waste_bar", "waste_pie"):
        return ("chemistry.waste-management",)
    if p["kind"] == "water":
        return ("chemistry.water-pollution",) + (("chemistry.ph-scale", "chemistry.nitrogen-compounds") if p["band"] == "UP" else ())
    return ("chemistry.air-composition-pollution",) + (("chemistry.nitrogen-compounds",) if p["band"] == "UP" else ())


def avoid_for(p: dict) -> str:
    """A waste chart is no figure for a chapter on water or air, and the water table none for waste or air."""
    other = {"waste_bar": r"\bwater\b|\bair\b", "waste_pie": r"\bwater\b|\bair\b", "water": r"waste|\bair\b",
             "air": r"waste|\bwater\b"}[p["kind"]]
    return AVOID + "|" + other


WASTES = ["food waste", "paper and card", "plastic bottles", "plastic bags", "glass jars", "metal cans"]
RECYCLABLE = ["paper and card", "plastic bottles", "glass jars", "metal cans"]
SCHOOLS = ["Imena Secondary School", "Ubumwe Secondary School", "Urumuri Secondary School", "Isano Secondary School",
           "Ineza Secondary School", "Umucyo Secondary School", "Ituze Secondary School", "Amizero Secondary School"]
SOURCES = ["stream beside a farm", "school borehole", "river below a factory", "rainwater tank", "pond near a market",
           "village well", "spring on a hillside", "tap in a classroom"]
SITES = ["bus park", "school garden", "main road junction", "market", "hospital gate", "cement works gate", "tea farm",
         "football pitch"]
PH_SAFE = ["6.6", "6.8", "7.0", "7.2", "7.4", "7.6", "7.8", "8.0", "8.2"]
PH_BAD = ["5.2", "5.6", "5.8", "6.0", "6.2", "8.8", "9.0", "9.2"]
LEAD_SAFE = ["0.002", "0.004", "0.005", "0.008"]
LEAD_BAD = ["0.02", "0.03", "0.04", "0.05", "0.06", "0.08"]
NO2_LIMIT = 40


def _parts(rng: random.Random, n: int, total: int, step: int, lo: int, hi: int) -> list[int]:
    """n different multiples of step from lo to hi that add up to total."""
    while True:
        vals = rng.sample(range(lo, hi + 1, step), n - 1)
        last = total - sum(vals)
        if lo <= last <= hi and last not in vals:
            return vals + [last]


def sample(rng: random.Random) -> dict:
    kind = rng.choice(["waste_bar", "waste_pie", "water", "air"])
    band = "LS" if kind.startswith("waste") else rng.choice(BANDS)
    school = rng.choice(SCHOOLS)
    if kind == "waste_bar":
        types = sorted(rng.sample(WASTES, 5), key=WASTES.index)
        total = rng.choice([100, 200])
        step = 5 if total == 100 else 10
        masses = _parts(rng, 5, total, step, step, 8 * step)
        present = [t for t in types if t in RECYCLABLE]
        recycled = sorted(rng.sample(present, min(len(present), rng.choice([2, 3]))), key=WASTES.index)
        return {"band": band, "kind": kind, "school": school, "masses": [[t, v] for t, v in zip(types, masses)],
                "recycled": recycled}
    if kind == "waste_pie":
        n = rng.choice([4, 5])
        types = sorted(rng.sample(WASTES, n), key=WASTES.index)
        pcts = _parts(rng, n, 100, 5, 10, 45)
        return {"band": band, "kind": kind, "school": school, "parts": [[t, v] for t, v in zip(types, pcts)],
                "hidden": rng.choice(types), "total": rng.choice([200, 300, 400, 500, 800])}
    if kind == "water":
        letters = "ABCD"
        safe = rng.randrange(4)
        bad = [k for k in range(4) if k != safe]
        rng.shuffle(bad)
        fails = {bad[0]: {"pH"}, bad[1]: {"lead"}, bad[2]: {rng.choice(["bacteria", "nitrate"])}}
        for k in bad:  # a second failure now and then, never a second bad pH
            if rng.random() < 0.4:
                fails[k].add(rng.choice(["nitrate", "lead", "bacteria"]))
        sources = rng.sample(SOURCES, 4)
        samples = []
        for k, L in enumerate(letters):
            f = fails.get(k, set())
            samples.append([L, sources[k], rng.choice(PH_BAD if "pH" in f else PH_SAFE),
                            rng.randint(55, 120) if "nitrate" in f else rng.randint(4, 45),
                            rng.choice(LEAD_BAD if "lead" in f else LEAD_SAFE),
                            rng.randint(2, 40) if "bacteria" in f else 0])
        return {"band": band, "kind": kind, "school": school, "samples": samples}
    sites = rng.sample(SITES, 5)
    while True:
        values = rng.sample(range(10, 95, 5), 5)
        if NO2_LIMIT not in values and any(v > NO2_LIMIT for v in values) and any(v < NO2_LIMIT for v in values):
            break
    return {"band": band, "kind": kind, "school": school, "sites": [[s, v] for s, v in zip(sites, values)], "limit": NO2_LIMIT}


# --- drawing ------------------------------------------------------------------------------------------------------

COLOURS = {"food waste": "#e3a857", "paper and card": "#9fc5e8", "plastic bottles": "#76b7a5", "plastic bags": "#c39bd3",
           "glass jars": "#f4d35e", "metal cans": "#b0b0b0"}


def _wrap(text: str, width: int = 12) -> str:
    return "\n".join(textwrap.wrap(text, width))


def _bars(ax, names: list[str], values: list[int], hatched: list[str], step: int) -> None:
    for k, (name, v) in enumerate(zip(names, values)):
        ax.add_patch(Rectangle((k - 0.3, 0), 0.6, v, facecolor="white" if name in hatched else FILL, edgecolor=INK,
                               linewidth=1.1, hatch="///" if name in hatched else None, gid=f"bar:{name}"))
    top = (max(values) // step + 2) * step
    grid_y(ax, top, step)
    if top // step > 12:
        ax.set_yticks([t for t in ax.get_yticks() if round(t / step) % 2 == 0])
        ax.set_yticks([i * step for i in range(top // step + 1)], minor=True)
        ax.yaxis.grid(True, which="minor", color="#c8c8c8", linewidth=0.8)
    ax.set_xticks(range(len(names)))
    ax.set_xticklabels([_wrap(n) for n in names], fontsize=10)
    ax.tick_params(axis="x", length=0)
    ax.tick_params(axis="y", labelsize=10)
    ax.set_xlim(-0.6, len(names) - 0.4)


def _waste_bar(p: dict):
    fig, ax = new_figure(7.4, 5.0)
    names, values = [t for t, _ in p["masses"]], [v for _, v in p["masses"]]
    step = 5 if sum(values) == 100 else 10
    _bars(ax, names, values, p["recycled"], step)
    ax.set_ylabel("Mass of waste (kg)", fontsize=10.5)
    ax.set_title(f"Waste thrown away in one week at\n{p['school']}", fontsize=12, fontweight="bold")
    ax.legend(handles=[Patch(facecolor="white", edgecolor=INK, hatch="///", label="sent for recycling"),
                       Patch(facecolor=FILL, edgecolor=INK, label="not recycled")], loc="upper left",
              bbox_to_anchor=(1.01, 1.0), fontsize=10, framealpha=1.0)
    return fig


def _waste_pie(p: dict):
    fig, ax = new_figure(7.4, 5.0)
    fig.subplots_adjust(left=0.01, right=0.99, top=0.9, bottom=0.02)
    top = 90.0
    for name, v in p["parts"]:
        span = v * 3.6
        ax.add_patch(Wedge((0, 0), 1.0, top - span, top, facecolor=COLOURS[name], edgecolor=INK, linewidth=1.2, gid=f"wedge:{name}"))
        mid = math.radians(top - span / 2)
        ax.text(0.64 * math.cos(mid), 0.64 * math.sin(mid), "?" if name == p["hidden"] else f"{v}%", ha="center",
                va="center", fontsize=12, fontweight="bold", gid=f"pct:{name}")
        top -= span
    for k, (name, _) in enumerate(p["parts"]):
        y = 0.75 - 0.42 * k
        ax.add_patch(Rectangle((1.35, y - 0.12), 0.24, 0.24, facecolor=COLOURS[name], edgecolor=INK, linewidth=1.0))
        ax.text(1.7, y, name, ha="left", va="center", fontsize=11)
    ax.set_title(f"Waste thrown away in one week at {p['school']}\n(total mass {p['total']} kg)", fontsize=12,
                 fontweight="bold")
    ax.set_xlim(-1.1, 3.4)
    ax.set_ylim(-1.15, 1.1)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


COLS = [("Sample", 0.9), ("Where the water\ncame from", 2.4), ("pH", 1.0), ("Nitrate\n(mg/L)", 1.2), ("Lead\n(mg/L)", 1.2),
        ("Bacteria\n(per 100 cm³)", 1.5)]


def _water(p: dict):
    fig, ax = new_figure(8.6, 4.6)
    fig.subplots_adjust(left=0.01, right=0.99, top=0.9, bottom=0.01)
    xs = [0.0]
    for _, w in COLS:
        xs.append(xs[-1] + w)
    rows = [[c for c, _ in COLS]] + [[str(x) for x in s] for s in p["samples"]] + \
           [["Safe\nlimit", "for drinking water", "6.5 to 8.5", "at most\n50", "at most\n0.01", "0"]]
    h = [0.85] + [0.8] * len(p["samples"]) + [0.85]
    y = sum(h)
    for r, row in enumerate(rows):
        y -= h[r]
        shade = "#e9edf0" if r == 0 else "#f6f1df" if r == len(rows) - 1 else "white"
        for c, cell in enumerate(row):
            ax.add_patch(Rectangle((xs[c], y), xs[c + 1] - xs[c], h[r], facecolor=shade, edgecolor=INK, linewidth=0.9))
            text = _wrap(cell, 16) if c == 1 and "\n" not in cell else cell
            bold = r == 0 or r == len(rows) - 1 or c == 0
            ax.text((xs[c] + xs[c + 1]) / 2, y + h[r] / 2, text, ha="center", va="center", fontsize=10,
                    fontweight="bold" if bold else "normal", linespacing=1.1)
    ax.set_title(f"Water tests by a class at {p['school']}", fontsize=12, fontweight="bold")
    ax.set_xlim(-0.05, xs[-1] + 0.05)
    ax.set_ylim(-0.05, sum(h) + 0.05)
    ax.axis("off")
    return fig


def _air(p: dict):
    fig, ax = new_figure(7.4, 5.0)
    names, values = [s for s, _ in p["sites"]], [v for _, v in p["sites"]]
    _bars(ax, names, values, [], 5)
    ax.plot([-0.6, len(names) - 0.4], [p["limit"], p["limit"]], color=INK, linewidth=1.6, linestyle=(0, (6, 3)), gid="limit")
    ax.set_ylabel("Nitrogen dioxide (µg/m³)", fontsize=10.5)
    ax.set_title(f"Nitrogen dioxide in the air, measured by\nstudents of {p['school']}", fontsize=12, fontweight="bold")
    top = ax.get_ylim()[1]
    ax.text(len(names) - 0.45, top - 1.0, f"dashed line: limit of {p['limit']} µg/m³", ha="right", va="top", fontsize=10.5,
            bbox=dict(facecolor="white", edgecolor=INK, linewidth=0.8, pad=3.0))
    return fig


def draw(p: dict):
    return {"waste_bar": _waste_bar, "waste_pie": _waste_pie, "water": _water, "air": _air}[p["kind"]](p)


# --- questions ----------------------------------------------------------------------------------------------------

SETTINGS = ["for a school environment project", "for the school's green club", "during a lesson on waste",
            "for a science fair", "for a class project on pollution", "for the school's cleaning committee"]


def _kg(v) -> list[str]:
    return [str(v), f"{v} kg", f"{v}kg", f"{v} kilograms"]


def _pct(v) -> list[str]:
    return [str(v), f"{v}%", f"{v} %", f"{v} percent"]


def _sample_questions(p: dict, rng: random.Random, who: str) -> list:
    samples = {s[0]: s for s in p["samples"]}
    letters = list(samples)

    def ok(s) -> dict:
        _, _, ph, nitrate, lead, bacteria = s
        return {"pH": 6.5 <= float(ph) <= 8.5, "nitrate": nitrate <= 50, "lead": float(lead) <= 0.01, "bacteria": bacteria == 0}

    safe = next(L for L, s in samples.items() if all(ok(s).values()))
    qs = [letter_choice(f"{who} tested water from four places near {p['school']} {rng.choice(SETTINGS)}. "
                        "Which sample is safe to drink by every limit in the table?", safe, letters),
          count("How many samples have more nitrate than the safe limit?",
                sum(not ok(s)["nitrate"] for s in samples.values()), "samples")]
    leady = [L for L, s in samples.items() if not ok(s)["lead"]]
    if rng.random() < 0.5:
        L = rng.choice(leady)
        times = round(float(samples[L][4]) * 100)
        qs.append(short(f"How many times the safe limit is the lead in sample {L}?", times,
                        [str(times), f"{times} times", f"{times}x", f"{times} ×"]))
    else:
        bad = next(L for L, s in samples.items() if not ok(s)["pH"])
        qs.append(letter_choice("Which sample's pH is outside the safe range?", bad, letters))
    return qs


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    setting = rng.choice(SETTINGS)
    if p["kind"] == "waste_bar":
        masses = dict(p["masses"])
        t = rng.choice(list(masses))
        verb = rng.choice(["was collected", "was thrown away", "was put in the bins"])
        qs = [short(f"{who} weighed the waste from {p['school']} for one week {setting}. What mass of {t} {verb}?",
                    masses[t], _kg(masses[t])),
              short("What mass of waste was sent for recycling that week?", sum(masses[x] for x in p["recycled"]),
                    _kg(sum(masses[x] for x in p["recycled"])))]
        if rng.random() < 0.5:
            u = rng.choice([x for x in masses if x != t])
            pct = 100 * masses[u] // sum(masses.values())
            qs.append(short(f"What percentage of all the waste was {u}?", pct, _pct(pct)))
        else:
            best = max(masses, key=masses.get)
            others = [x for x in masses if x != best]
            rng.shuffle(others)
            qs.append(mcq("Which type of waste had the largest mass?", best, others, rng))
        return qs
    if p["kind"] == "waste_pie":
        parts, total, hidden = dict(p["parts"]), p["total"], p["hidden"]
        qs = [short(f"{who} sorted and weighed a week's waste at {p['school']} {setting}. What percentage of the waste "
                    f"was {hidden}?", parts[hidden], _pct(parts[hidden]))]
        t = rng.choice([x for x in parts if x != hidden])
        qs.append(short(f"What mass of {t} was thrown away that week?", total * parts[t] // 100, _kg(total * parts[t] // 100)))
        a = rng.choice([x for x in parts if parts[x] > min(parts.values())])
        b = rng.choice([x for x in parts if parts[x] < parts[a]])
        diff = total * (parts[a] - parts[b]) // 100
        qs.append(short(f"How many kilograms more {a} than {b} were thrown away?", diff, _kg(diff)))
        return qs
    if p["kind"] == "water":
        return _sample_questions(p, rng, who)
    sites, limit = dict(p["sites"]), p["limit"]
    above = [s for s, v in sites.items() if v > limit]
    s = rng.choice(above)
    units = lambda v: [str(v), f"{v} µg/m³", f"{v} µg/m3", f"{v}µg/m³", f"{v} micrograms per cubic metre"]  # noqa: E731
    low = min(sites, key=sites.get)
    others = [x for x in sites if x != low]
    rng.shuffle(others)
    return [count(f"{who} measured the nitrogen dioxide in the air at five places {setting}. How many of the places "
                  "had more nitrogen dioxide than the limit?", len(above), "places"),
            short(f"By how many µg/m³ was the nitrogen dioxide at the {s} above the limit?", sites[s] - limit,
                  units(sites[s] - limit)),
            mcq("At which place was the nitrogen dioxide lowest?", low, others, rng)]
