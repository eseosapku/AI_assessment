"""Respiration data (LS, UP, AL): three experiments the respiration chapters set.

- Yeast (LS, UP, AL): bubbles of carbon dioxide counted in one minute from yeast in sugar solution at six
  temperatures, as a bar chart; the count rises to one clear peak and falls. Asks the temperature with the most bubbles,
  how many more bubbles at one temperature than another, and how the count changed over a stated range.
- RQ (UP, AL): a table of four kinds of germinating seed, lettered, with the oxygen taken in and the carbon dioxide
  given out in 10 minutes; RQ = CO2 given out / O2 taken in printed, and a table of the RQ of each respiratory
  substrate (carbohydrate 1.0, protein 0.9, lipid 0.7). Asks one seed's RQ, which substrate a seed is respiring by the
  printed table, and which seed gives out the most CO2 for each cm3 of O2.
- Respirometer (UP, AL): a line graph of the distance a coloured drop moved in a respirometer (soda lime absorbing
  CO2, so the drop moves as O2 is taken in) with germinating seeds at two temperatures and boiled seeds as the
  control; points every 2 minutes on 2 mm gridlines. Asks a distance, a rate in mm per minute, a difference.
"""
from __future__ import annotations

import random

from matplotlib.patches import Rectangle

from ..core import GRID, INK, NAMES, exact, mcq, new_figure, short
from ._bio_parts import letter_choice

ID = "respiration_data"
KIND = "graph.line"
SUBJECT = "biology"
BANDS = ("LS", "UP", "AL")
CONCEPTS = tuple(f"biology.{c}" for c in ("anaerobic-respiration", "aerobic-respiration", "respiration-overview",
                                           "respiration-rate-factors", "alternative-respiratory-substrates"))
# A topic whose sections the book lists is reached only if one names respiration, ATP or fermentation.
NEEDS = r"(?<!\w)respiration|\bATP\b|respiratory (?:quotient|substrate)|yeast|ferment|anaerobic"
AVOID = (r"nutrition and transport|breath|respiratory system|plant nutrition|photosynth|sexual|STIs|HIV|glossary|"
         r"science in context|social factors|reproduction system")

SUBSTRATES = [("carbohydrate", 1.0), ("protein", 0.9), ("lipid (fat)", 0.7)]


def concepts_for(p: dict) -> tuple:
    if p["kind"] == "yeast":
        return tuple(f"biology.{c}" for c in ("anaerobic-respiration", "respiration-overview", "respiration-rate-factors"))
    if p["kind"] == "rq":
        return tuple(f"biology.{c}" for c in ("alternative-respiratory-substrates", "aerobic-respiration",
                                               "respiration-overview", "respiration-rate-factors"))
    return tuple(f"biology.{c}" for c in ("respiration-rate-factors", "aerobic-respiration", "respiration-overview"))


def _yeast(rng: random.Random) -> dict:
    temps = [10, 20, 30, 40, 50, 60]
    peak = rng.choice([2, 3])  # 30 or 40 °C
    top = rng.randint(28, 40)
    bubbles = [0] * 6
    bubbles[peak] = top
    for i in range(peak - 1, -1, -1):
        bubbles[i] = max(2 + i, bubbles[i + 1] - rng.randint(5, 10))
    for i in range(peak + 1, 6):
        bubbles[i] = max(1, bubbles[i - 1] - rng.randint(6, 14))
    for i in range(peak + 1, 6):  # strictly falling after the peak
        if bubbles[i] >= bubbles[i - 1]:
            bubbles[i] = bubbles[i - 1] - 1
    if bubbles[-1] < 1:
        return _yeast(rng)
    return {"kind": "yeast", "sugar": rng.choice(["glucose", "sucrose"]), "temps": temps, "bubbles": bubbles}


def _rq(rng: random.Random) -> dict:
    rqs = [1.0, 0.9, 0.8, 0.7]
    rng.shuffle(rqs)
    seeds = []
    for letter, rq in zip("ABCD", rqs):
        o2 = rng.choice([20, 30, 40, 50, 60])
        seeds.append({"letter": letter, "o2": o2, "co2": int(round(o2 * rq))})
    return {"kind": "rq", "seeds": seeds}


def _respirometer(rng: random.Random) -> dict:
    t1 = rng.choice([10, 15, 20])
    t2 = t1 + rng.choice([10, 15])
    s1 = rng.randint(1, 3)
    s2 = s1 + rng.randint(1, 3)
    return {"kind": "respirometer", "temps": [t1, t2], "rates": [s1, s2], "times": [0, 2, 4, 6, 8, 10]}


def sample(rng: random.Random) -> dict:
    band = rng.choice(BANDS)
    kind = "yeast" if band == "LS" else rng.choice(["yeast", "rq", "respirometer", "rq", "respirometer"])
    p = {"yeast": _yeast, "rq": _rq, "respirometer": _respirometer}[kind](rng)
    return {"band": band, **p}


# --- drawing ----------------------------------------------------------------------------------------

def _draw_yeast(p: dict):
    fig, ax = new_figure(6.4, 4.2)
    top = (max(p["bubbles"]) // 5 + 2) * 5
    for x, (t, b) in enumerate(zip(p["temps"], p["bubbles"])):
        ax.add_patch(Rectangle((x - 0.32, 0), 0.64, b, facecolor="#b9c4cf", edgecolor=INK, linewidth=1.0, gid=f"bar:{t}"))
    ax.set_xticks(range(6))
    ax.set_xticklabels([str(t) for t in p["temps"]])
    ax.set_xlim(-0.6, 5.6)
    ax.set_yticks(range(0, top + 1, 5))
    ax.set_yticks(range(0, top + 1), minor=True)
    ax.yaxis.grid(True, which="both", color=GRID, linewidth=0.5)
    ax.set_axisbelow(True)
    ax.set_ylim(0, top)
    ax.set_xlabel("Temperature of the yeast and sugar solution (°C)")
    ax.set_ylabel("Bubbles of CO₂ in 1 minute")
    ax.set_title(f"Yeast in {p['sugar']} solution: bubbles counted at each temperature", fontsize=11)
    ax.tick_params(labelsize=9)
    return fig


def _draw_rq(p: dict):
    fig, ax = new_figure(7.4, 4.0)
    ax.set_xlim(0, 10)
    ax.set_ylim(0.8, 7.2)
    ax.axis("off")
    cols = [0.3, 2.2, 5.2]
    heads = ["Germinating\nseeds", "O₂ taken in\n(cm³ in 10 min)", "CO₂ given out\n(cm³ in 10 min)"]
    y = 6.6
    for x, h in zip(cols, heads):
        ax.text(x, y, h, ha="left", va="center", fontsize=10, fontweight="bold")
    ax.plot([0.2, 7.6], [6.0, 6.0], color=INK, linewidth=1.0)
    for i, s in enumerate(p["seeds"]):
        yy = 5.5 - 0.62 * i
        ax.text(cols[0] + 0.2, yy, f"Seed {s['letter']}", ha="left", va="center", fontsize=10)
        ax.text(cols[1] + 0.9, yy, str(s["o2"]), ha="center", va="center", fontsize=10)
        ax.text(cols[2] + 0.9, yy, str(s["co2"]), ha="center", va="center", fontsize=10)
    ax.plot([0.2, 7.6], [3.2, 3.2], color=INK, linewidth=1.0)
    ax.text(0.3, 2.6, "Respiratory quotient:  RQ = volume of CO₂ given out ÷ volume of O₂ taken in", ha="left",
            va="center", fontsize=10)
    ax.text(0.3, 1.9, "RQ of each respiratory substrate:", ha="left", va="center", fontsize=10, fontweight="bold")
    for k, (name, rq) in enumerate(SUBSTRATES):
        ax.text(0.6 + 3.0 * k, 1.25, f"{name}  {rq:.1f}", ha="left", va="center", fontsize=10)
    ax.set_title("Oxygen taken in and carbon dioxide given out by four kinds of germinating seed", fontsize=11)
    return fig


def _draw_respirometer(p: dict):
    fig, ax = new_figure(6.8, 4.4)
    times = p["times"]
    top = max(p["rates"]) * 10 + 4
    top += top % 2
    styles = ["-", (0, (6, 3))]
    for T, r, st, mk in zip(p["temps"], p["rates"], styles, ["o", "s"]):
        ax.plot(times, [r * t for t in times], color=INK, linewidth=1.6, linestyle=st, marker=mk, markersize=5,
                gid=f"seeds:{T}", label=f"germinating seeds at {T} °C")
    ax.plot(times, [0] * len(times), color=INK, linewidth=1.4, linestyle=":", marker="^", markersize=5,
            gid="control", label=f"boiled seeds at {p['temps'][1]} °C")
    ax.set_xticks(times)
    ax.set_xticks(range(0, 11), minor=True)
    ax.set_yticks(range(0, top + 1, 10))
    ax.set_yticks(range(0, top + 1, 2), minor=True)
    ax.grid(True, which="both", color=GRID, linewidth=0.5)
    ax.set_axisbelow(True)
    ax.set_xlim(0, 10.2)
    ax.set_ylim(-1, top)
    ax.set_xlabel("Time (minutes)")
    ax.set_ylabel("Distance the coloured drop moved (mm)")
    ax.tick_params(labelsize=9)
    ax.legend(loc="upper left", fontsize=9, frameon=True, framealpha=1.0, edgecolor=INK)
    ax.set_title("Respirometer: soda lime absorbs CO₂, so the drop moves as O₂ is taken in", fontsize=10.5)
    return fig


def draw(p: dict):
    return {"yeast": _draw_yeast, "rq": _draw_rq, "respirometer": _draw_respirometer}[p["kind"]](p)


# --- questions --------------------------------------------------------------------------------------

SETTINGS = ["in a biology practical", "at the school science club in Huye", "for a project on bread-making in Musanze",
            "in a lesson on respiration", "during a revision class in Rubavu", "for a class investigation in Nyagatare"]
TRENDS = ["it rose all the way", "it fell all the way", "it rose, then fell", "it stayed the same"]


def _deg(t: int) -> list[str]:
    return [f"{t} °C", f"{t} degrees", f"{t} degrees Celsius", f"{t}° C"]


def _trend(temps, bubbles, a, b) -> str:
    seg = bubbles[temps.index(a):temps.index(b) + 1]
    if all(y > x for x, y in zip(seg, seg[1:])):
        return TRENDS[0]
    if all(y < x for x, y in zip(seg, seg[1:])):
        return TRENDS[1]
    return TRENDS[2]


def _q_yeast(p: dict, rng: random.Random) -> list:
    t, b = p["temps"], p["bubbles"]
    who = rng.choice(NAMES)
    best = t[b.index(max(b))]
    qs = [short(f"{who} counted the bubbles of carbon dioxide given off by yeast in {p['sugar']} solution "
                f"{rng.choice(SETTINGS)}. At which temperature did the yeast give off the most bubbles?",
                best, _deg(best))]
    pairs = [(x, y) for x in t for y in t if b[t.index(x)] > b[t.index(y)]]
    x, y = rng.choice(pairs)
    d = b[t.index(x)] - b[t.index(y)]
    qs.append(short(f"How many more bubbles did the yeast give off in 1 minute at {x} °C than at {y} °C?", d,
                    [f"{d} bubbles"]))
    k = t.index(best)
    choice = rng.choice(["up", "down", "both", "both"])
    if choice == "up":
        a, c = t[rng.randrange(0, k)], best
    elif choice == "down":
        a, c = best, t[rng.randrange(k + 1, 6)]
    else:
        a, c = t[rng.randrange(0, k)], t[rng.randrange(k + 1, 6)]
    key = _trend(t, b, a, c)
    qs.append(mcq(f"How did the number of bubbles change as the temperature went from {a} °C to {c} °C?", key,
                  [x for x in TRENDS if x != key], rng))
    return qs


def _q_rq(p: dict, rng: random.Random) -> list:
    seeds = p["seeds"]
    rq = {s["letter"]: s["co2"] / s["o2"] for s in seeds}
    who = rng.choice(NAMES)
    x = rng.choice(seeds)["letter"]
    val = exact(round(rq[x], 6))
    qs = [short(f"{who} measured the gases exchanged by germinating seeds {rng.choice(SETTINGS)}. Using the formula "
                f"printed, what is the RQ of seed {x}?", val, ["1.0", "1.00"] if val == "1" else [val + "0"])]
    y = rng.choice([s["letter"] for s in seeds if round(rq[s["letter"]], 6) in (1.0, 0.9, 0.7) and s["letter"] != x])
    key = next(n for n, v in SUBSTRATES if v == round(rq[y], 6))
    qs.append(mcq(f"Using the table of RQ values, which respiratory substrate is seed {y} most likely using?", key,
                  [n for n, _ in SUBSTRATES if n != key], rng))
    top = max(rq, key=rq.get)
    qs.append(letter_choice(rng.choice(["Which seed gave out the most carbon dioxide for each cm³ of oxygen it took in?",
                                        "Which seed had the highest respiratory quotient?"]),
                            top, [k for k in "ABCD" if k != top]))
    return qs


def _q_respirometer(p: dict, rng: random.Random) -> list:
    (t1, t2), (s1, s2) = p["temps"], p["rates"]
    who = rng.choice(NAMES)
    T, s = rng.choice([(t1, s1), (t2, s2)])
    t = rng.choice([4, 6, 8, 10])
    qs = [short(f"{who} set up a respirometer {rng.choice(SETTINGS)}. How far had the drop moved for the seeds at {T} °C "
                f"after {t} minutes?", s * t, [f"{s * t} mm", f"{s * t} millimetres"])]
    T, s = rng.choice([(t1, s1), (t2, s2)])
    qs.append(short(f"What was the mean rate at which the drop moved for the seeds at {T} °C, in mm per minute?", s,
                    [f"{s} mm per minute", f"{s} mm/min", f"{s} mm/minute"]))
    t = rng.choice([4, 6, 8, 10])
    d = (s2 - s1) * t
    qs.append(short(f"How many more millimetres had the drop moved for the warmer seeds than for the cooler seeds after "
                    f"{t} minutes?", d, [f"{d} mm", f"{d} millimetres"]))
    return qs


def questions(p: dict, rng: random.Random) -> list:
    return {"yeast": _q_yeast, "rq": _q_rq, "respirometer": _q_respirometer}[p["kind"]](p, rng)
