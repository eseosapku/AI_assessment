"""Enzyme graphs (LS, UP, AL): the rate of an enzyme-controlled reaction against temperature (one or two
enzymes: from a human, a plant, a hot-spring bacterium) or against pH (two digestive enzymes). The optimum,
the rate there, where a heated enzyme stops working, which enzyme works in the stomach, and why the rate
falls past the optimum.

Each curve peaks at its real optimum, on a gridline, at a rate on a gridline; heated past it, the rate falls
to zero at a gridline.
"""
from __future__ import annotations

import math
import random

from ..core import GRID, INK, NAMES, mcq, measure, new_figure, short

ID = "enzyme_graph"
KIND = "graph.line"
SUBJECT = "biology"
BANDS = ("LS", "UP", "AL")
CONCEPTS = tuple(f"biology.{c}" for c in ("enzymes", "enzyme-technology-applications", "biological-molecules"))
AVOID = r"photosynth|respiration|genetic|inherit|ecolog|population|immun|disease|reproduc|excretion|transport|passive|skin|autotroph|cell biology|dna|movement into|plant nutrition|gene technology|food components|testing for|carbohydrates|vitamins|culturing"
TEMP = {"an enzyme from a human": (40, 60), "an enzyme from a plant": (25, 45),
        "an enzyme from a hot-spring bacterium": (70, 90)}  # optimum, the temperature it stops working at
PH = {"pepsin": 2, "salivary amylase": 7, "trypsin": 8, "arginase": 10}
STYLES = ["-", (0, (6, 3))]


def sample(rng: random.Random) -> dict:
    mode = rng.choice(["temperature", "pH"])
    ystep = rng.choice([1, 2, 5])
    letters = rng.choice([["A", "B"], ["X", "Y"], ["P", "Q"]])
    if mode == "temperature":
        names = rng.sample(list(TEMP), rng.choice([1, 2]))
        enzymes = [{"name": n, "opt": TEMP[n][0], "zero": TEMP[n][1]} for n in names]
    else:
        pairs = [(a, b) for a in PH for b in PH if a < b and abs(PH[a] - PH[b]) >= 3]
        enzymes = [{"name": n, "opt": PH[n], "zero": None} for n in rng.choice(pairs)]
    heights = rng.sample(range(6, 11), len(enzymes))
    for e, letter, h in zip(enzymes, letters, heights):
        e["letter"], e["peak"], e["width"] = letter, h * ystep, rng.choice([3, 3.5, 4])
    return {"band": rng.choice(BANDS), "mode": mode, "ystep": ystep, "enzymes": enzymes, "ask": rng.randrange(len(enzymes))}


def rate(p: dict, e: dict, x: float) -> float:
    if p["mode"] == "temperature":
        if x <= e["opt"]:  # rising more steeply as it warms, level at the top
            u = max(0.0, x) / e["opt"]
            return e["peak"] * (0.05 + 0.95 * math.sin(math.pi * u / 2) ** 2)
        if x >= e["zero"]:
            return 0.0
        v = (x - e["opt"]) / (e["zero"] - e["opt"])  # then falling fast as it is denatured
        return e["peak"] * (1 - v * v)
    d = (x - e["opt"]) / e["width"]
    return max(0.0, e["peak"] * (1 - d * d))


def draw(p: dict):
    temp = p["mode"] == "temperature"
    two = len(p["enzymes"]) > 1
    fig, ax = new_figure(7.2 if two else 6.4, 4.4)
    end = (100 if any(e["opt"] == 70 for e in p["enzymes"]) else 70) if temp else 14
    top = max(e["peak"] for e in p["enzymes"]) + 2 * p["ystep"]
    ax.set_xticks(range(0, end + 1, 10 if temp else 2))
    ax.set_xticks(range(0, end + 1, 5 if temp else 1), minor=True)
    ax.set_yticks(range(0, top + 1, p["ystep"]))
    ax.grid(True, which="both", color=GRID, linewidth=0.5)
    ax.set_axisbelow(True)
    ax.set_xlim(0, end)
    ax.set_ylim(0, top)
    xs = [end * k / 1000 for k in range(1001)]
    for e, style in zip(p["enzymes"], STYLES):
        ax.plot(xs, [rate(p, e, x) for x in xs], color=INK, linewidth=1.8, linestyle=style, label=f"enzyme {e['letter']}")
    ax.set_xlabel("Temperature (°C)" if temp else "pH")
    ax.set_ylabel("Rate of reaction (arbitrary units)")
    ax.tick_params(labelsize=8)
    if two:
        ax.legend(loc="upper left", bbox_to_anchor=(1.01, 1.0), fontsize=9, frameon=False, handlelength=2.6)
    else:
        ax.text(0.02, 0.97, f"enzyme {p['enzymes'][0]['letter']}", transform=ax.transAxes, ha="left", va="top", fontsize=10)
    return fig


SETTINGS = ["in a biology lesson", "in the school laboratory", "for a class practical", "at the science club"]
WHY = [f"the enzyme is {a}: {b}" for a in ("denatured", "killed") for b in ("its active site changes shape", "it is used up in the reaction")]


def questions(p: dict, rng: random.Random) -> list:
    who, friend = rng.sample(NAMES, 2)
    temp = p["mode"] == "temperature"
    e = p["enzymes"][p["ask"]]
    x = e["letter"]
    what = "temperature" if temp else "pH"
    opt_forms = measure(e["opt"], "°C") if temp else [str(e["opt"]), f"pH {e['opt']}"]
    qs = [short(f"{who} measured the rate of an enzyme-controlled reaction at different {'temperatures' if temp else 'pH values'} "
                f"{rng.choice(SETTINGS)}. What is the optimum {what} of enzyme {x}?", e["opt"], opt_forms, tolerance=2 if temp else 0.5),
          short(f"What is the rate of enzyme {x} at its optimum, in arbitrary units?", e["peak"],
                [str(e["peak"]), f"{e['peak']} arbitrary units", f"{e['peak']} au", f"{e['peak']} a.u."])]
    if temp:
        qs.append(short(f"{friend} heats the reaction further. At what temperature does enzyme {x} stop working altogether?",
                        e["zero"], measure(e["zero"], "°C")))
    elif any(z["opt"] <= 3 for z in p["enzymes"]):
        stomach = min(p["enzymes"], key=lambda z: z["opt"])["letter"]
        others = [f"enzyme {z['letter']}" for z in p["enzymes"] if z["letter"] != stomach]
        qs.append(mcq(f"{friend} asks which enzyme works in the stomach, where the pH is about 2. Which one?", f"enzyme {stomach}",
                      others + ["both enzymes equally", "neither enzyme"], rng))
    if p["band"] != "LS":
        past = "above the optimum temperature" if temp else "far from the optimum pH"
        qs.append(mcq(f"Why does the rate fall {past}?", WHY[0], WHY[1:], rng))
    return qs
