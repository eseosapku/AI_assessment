"""Photosynthesis rate (LS, UP, AL): the rate against light intensity under two conditions (two carbon dioxide
concentrations, or two temperatures). Both rise along one straight line while light limits them, and each
levels off at a corner on gridlines. Point P lies on the shared slope and Q on the lower curve's plateau. The
rate at a light intensity, where the lower curve levels off, and the limiting factor at P and at Q.

On the slope light limits the rate; on the lower plateau the factor that differs between the curves does.
"""
from __future__ import annotations

import random

from ..core import GRID, INK, NAMES, mcq, new_figure, short

ID = "photosynthesis_rate"
KIND = "graph.line"
SUBJECT = "biology"
BANDS = ("LS", "UP", "AL")
CONCEPTS = tuple(f"biology.{c}" for c in ("photosynthesis", "plant-nutrition", "leaf-internal-structure-photosynthesis"))
AVOID = r"respiration|genetic|inherit|immun|disease|reproduc|excretion|digest|enzyme|biological molecules|gas|transport|response and coordination|growth and development|specialized tissues|carbohydrates"
# A topic whose sections the book lists is reached only if one names what this figure teaches.
NEEDS = r"photosynth|limiting factor"
FACTORS = {"carbon dioxide concentration": ("with 0.04% carbon dioxide", "with 0.1% carbon dioxide"),
           "temperature": ("at 15 °C", "at 25 °C")}
# Oxygen, a product, is the fourth: with it no option stands out from the others by its words alone.
OPTIONS = ["light intensity", "carbon dioxide concentration", "temperature", "oxygen concentration"]
RATES = [("Rate of photosynthesis (bubbles per minute)", "bubbles per minute"),
         ("Rate of photosynthesis (cm³ of oxygen per hour)", "cm³ of oxygen per hour")]


def sample(rng: random.Random) -> dict:
    xstep, ystep = rng.choice([1, 2, 5, 10]), rng.choice([1, 2, 5])
    m = rng.choice([1, 2])  # grid squares of rate per grid square of light, on the slope
    lx = rng.randint(3, 6) if m == 1 else rng.randint(2, 4)
    hx = lx + rng.randint(2, 3)
    other = rng.choice(list(FACTORS))
    corners = [[lx * xstep, m * lx * ystep], [hx * xstep, m * hx * ystep]]  # lists: the spec is stored as JSON
    px = rng.randint(1, lx - 1)
    qx = rng.randint(lx + 1, hx + 3)
    return {"band": rng.choice(BANDS), "xstep": xstep, "ystep": ystep, "end": (hx + 4) * xstep, "other": other,
            "curves": [{"label": FACTORS[other][0], "corner": corners[0]}, {"label": FACTORS[other][1], "corner": corners[1]}],
            "points": {"P": [px * xstep, m * px * ystep], "Q": [qx * xstep, corners[0][1]]},
            "units": rng.randrange(len(RATES)), "ask": rng.randint(1, lx - 1)}


def draw(p: dict):
    fig, ax = new_figure(7.4, 4.4)
    end = p["end"]
    top = p["curves"][1]["corner"][1] + 2 * p["ystep"]
    ax.set_xticks(range(0, end + 1, p["xstep"]))
    ax.set_yticks(range(0, top + 1, p["ystep"]))
    ax.grid(True, color=GRID, linewidth=0.6)
    ax.set_axisbelow(True)
    ax.set_xlim(0, end)
    ax.set_ylim(0, top)
    for c, style in zip(p["curves"], ["-", (0, (6, 3))]):
        (cx, cy) = c["corner"]
        ax.plot([0, cx, end], [0, cy, cy], color=INK, linewidth=1.8, linestyle=style, label=c["label"].split(" ", 1)[1])
    for name, (x, y) in p["points"].items():
        ax.plot([x], [y], marker="o", markersize=6, color=INK, zorder=4)
        ax.text(x, y + 0.45 * p["ystep"], name, ha="center", va="bottom", fontsize=12, fontweight="bold")
    ax.set_xlabel("Light intensity (arbitrary units)")
    ax.set_ylabel(RATES[p["units"]][0])
    ax.tick_params(labelsize=8)
    ax.legend(loc="upper left", bbox_to_anchor=(1.01, 1.0), fontsize=9, frameon=False, handlelength=2.6)
    return fig


SETTINGS = ["in a biology lesson", "in the school laboratory", "for a class practical", "at the science club"]


def _rate_forms(r, unit: str) -> list[str]:
    """"10 bubbles/min", "10 cm³ per hour", "10 cm3/h": the ways a rate is written (P3i review)."""
    if "bubbles" in unit:
        return [f"{r} bubbles/min", f"{r} bubbles per min", f"{r} per minute", f"{r} bubbles/minute"]
    return [f"{r} cm³ per hour", f"{r} cm³/h", f"{r} cm3/h", f"{r} cm³/hour", f"{r} cm3 per hour", f"{r} cm³ of oxygen/h"]


def questions(p: dict, rng: random.Random) -> list:
    who, friend = rng.sample(NAMES, 2)
    low = p["curves"][0]
    (lx, ly) = low["corner"]
    x = p["ask"] * p["xstep"]
    r = ly * x // lx
    unit = RATES[p["units"]][1]
    plant = rng.choice(["pondweed", "an aquatic plant", "a water plant", "Elodea"])
    qs = [short(f"{who} measured the rate of photosynthesis of {plant} {rng.choice(SETTINGS)}. What is the rate at a light "
                f"intensity of {x} units, {low['label']}?", r, [str(r), f"{r} {unit}"] + _rate_forms(r, unit)),
          short(f"{low['label'][0].upper()}{low['label'][1:]}, the rate levels off. At what light intensity does it start to level off?", lx, [str(lx), f"{lx} units"])]
    for name in rng.sample(["P", "Q"], 2 if p["band"] != "LS" else 1):
        lx_here = p["points"][name][0]
        key = "light intensity" if lx_here < lx else p["other"]
        qs.append(mcq(f"{friend} looks at the curve {low['label']}. What is the limiting factor at point {name}?",
                      key, [o for o in OPTIONS if o != key], rng))
    return qs
