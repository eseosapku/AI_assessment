"""Rate graphs (LS, UP, AL): the volume of gas collected against time for one experiment, or two lettered
experiments where one runs twice as fast to the same total. The total volume, the volume at a time, when
the reaction stopped, at UP and AL the mean rate over the first seconds, and which experiment was faster.

Each curve rises fastest at the start and meets its plateau at a visible corner on gridlines; the half-way time and the
volume collected by then also sit on gridlines (three-quarters of the total), so every reading is exact.
"""
from __future__ import annotations

import random
from fractions import Fraction

from ..core import GRID, INK, NAMES, exact, mcq, measure, new_figure, short

ID = "rate_graph"
KIND = "graph.line"
SUBJECT = "chemistry"
BANDS = ("LS", "UP", "AL")
CONCEPTS = tuple(f"chemistry.{c}" for c in ("reaction-rate", "factors-affecting-reaction-rate", "catalysis"))
# Integrated Science teaches this too (P3n): its Lower Secondary topics are reached by these.
ALSO = tuple(f"science.{c}" for c in ('chemical-reactions',))
AVOID = r"organic|alkane|electrolysis|titration|isotope|periodic|bonding|enthalpy|equilibrium-constant|transition|alcohol|energ|environment|equilibri|categories|experimental design|nitrogen gas|arenes|chirality|glossary|thinking and working scientifically|science in context|scientific method|science skills|respiration"
# what reacts, and the gas it gives off
REACTIONS = [("magnesium ribbon and dilute hydrochloric acid", "hydrogen"),
             ("marble chips and dilute hydrochloric acid", "carbon dioxide"),
             ("hydrogen peroxide with a manganese(IV) oxide catalyst", "oxygen"),
             ("zinc granules and dilute sulfuric acid", "hydrogen"),
             ("calcium carbonate powder and dilute nitric acid", "carbon dioxide")]
# the changes that make sense for each reaction, in REACTIONS' order (P3g final review: no acid in peroxide)
CHANGES = [["at a higher temperature", "with more concentrated acid, the magnesium still used up first",
            "with magnesium powder instead of ribbon"],
           ["at a higher temperature", "with more concentrated acid, the marble still used up first",
            "with powdered marble instead of chips"],
           ["at a higher temperature", "with more of the catalyst", "with the catalyst as a finer powder"],
           ["at a higher temperature", "with more concentrated acid, the zinc still used up first",
            "with zinc powder instead of granules", "with a little copper(II) sulfate added as a catalyst"],
           ["at a higher temperature", "with more concentrated acid, the calcium carbonate still used up first"]]


def sample(rng: random.Random) -> dict:
    xstep = rng.choice([5, 10, 20, 30])
    ystep = rng.choice([5, 10])
    n = rng.choice([4, 6, 8])
    T = n * xstep
    vmax = ystep * 4 * rng.randint(1, 3)
    band = rng.choice(BANDS)
    runs = [{"label": "A", "T": T}]
    if band != "LS" and rng.random() < 0.6:
        fast = {"label": "B", "T": T // 2}
        runs = [{"label": "A", "T": T}, fast] if rng.random() < 0.5 else [{"label": "B", "T": T}, {"label": "A", "T": T // 2}]
    reaction = rng.randrange(len(REACTIONS))
    return {"band": band, "xstep": xstep, "ystep": ystep, "vmax": vmax, "runs": runs, "end": T + xstep * rng.randint(2, 4),
            "reaction": reaction, "change": rng.randrange(len(CHANGES[reaction]))}


def volume(p: dict, run: dict, t: float) -> float:
    """Fastest at the start, level from the run's time T: vmax(2.5u - 2.5u² + u³) with u = t/T. Three-quarters
    of the total at half-time, and still rising at T, so the corner where it stops shows (P3g final review)."""
    T = run["T"]
    if t >= T:
        return p["vmax"]
    u = t / T
    return p["vmax"] * (2.5 * u - 2.5 * u * u + u ** 3)


def draw(p: dict):
    fig, ax = new_figure(7.2 if len(p["runs"]) > 1 else 6.4, 4.4)
    end, top = p["end"], p["vmax"] + 2 * p["ystep"]
    ax.set_xticks(range(0, end + 1, p["xstep"]))
    ax.set_yticks(range(0, top + 1, p["ystep"]))
    ax.grid(True, color=GRID, linewidth=0.6)
    ax.set_axisbelow(True)
    ax.set_xlim(0, end)
    ax.set_ylim(0, top)
    styles = ["-", (0, (5, 3))]
    for run, style in zip(p["runs"], styles):
        ts = [end * k / 600 for k in range(601)]
        ax.plot(ts, [volume(p, run, t) for t in ts], color=INK, linewidth=1.8, linestyle=style,
                label=f"experiment {run['label']}")
    ax.set_xlabel("Time (s)")
    ax.set_ylabel(f"Volume of {REACTIONS[p['reaction']][1]} (cm³)")
    ax.tick_params(labelsize=8)
    if len(p["runs"]) > 1:
        ax.legend(loc="upper left", bbox_to_anchor=(1.01, 1.0), fontsize=9, frameon=False, handlelength=2.6)
    return fig


SETTINGS = ["in a chemistry lesson", "in the school laboratory", "for a class practical", "at the science club"]


def questions(p: dict, rng: random.Random) -> list:
    who, friend = rng.sample(NAMES, 2)
    what, gas = REACTIONS[p["reaction"]]
    main = p["runs"][0]
    T, vmax = main["T"], p["vmax"]
    two = len(p["runs"]) > 1
    of = f" in experiment {main['label']}" if two else ""
    half = T // 2
    v_half = Fraction(3, 4) * vmax
    lead = f"{who} reacted {what} {rng.choice(SETTINGS)} and collected the {gas} in a gas syringe."
    if two:
        lead += f" Experiment {p['runs'][1]['label']} was done {CHANGES[p['reaction']][p['change']]}."
    qs = [short(f"{lead} What total volume of gas was collected{of}?", vmax, measure(vmax, "cm³")),
          short(f"What volume of gas had been collected{of} after {half} s?", exact(v_half), measure(v_half, "cm³")),
          short(f"{friend} wants to know when the reaction{of} stopped. After how many seconds did it stop?", T, measure(T, "s"))]
    if p["band"] != "LS":
        rate = v_half / half
        if (rate * 100).denominator == 1:
            qs.append(short(f"What was the mean rate of reaction{of} over the first {half} s, in cm³/s?", exact(rate),
                            measure(rate, "cm³/s")))
        if two:
            labels = [r["label"] for r in p["runs"]]
            fast = min(p["runs"], key=lambda r: r["T"])["label"]
            qs.append(mcq("Which experiment was faster?", f"experiment {fast}",
                          [f"experiment {x}" for x in labels if x != fast] + ["both were the same speed", "the graph cannot show this"], rng))
    return qs
