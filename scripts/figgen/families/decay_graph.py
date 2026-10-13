"""Radioactive decay curves (UP, AL): the activity of a sample, or a Geiger counter's count rate, falling
over four half-lives. The isotopes are real ones with their real half-lives: iodine-131 and
phosphorus-32 used in hospitals, technetium-99m for scans, carbon-11 and nitrogen-13 for PET scans,
sodium-24 as a tracer, caesium-137 from fallout, and protactinium-234 from a school generator. The
half-life, the activity after a whole number of half-lives, and the time to fall to a stated value.

The half-life is a whole number of gridlines, and the activity at each whole half-life falls on a
gridline, so every reading is exact.
"""
from __future__ import annotations

import random
from fractions import Fraction

from ..core import GRID, INK, NAMES, exact, measure, new_figure, short

ID = "decay_graph"
KIND = "graph.line"
SUBJECT = "physics"
BANDS = ("UP", "AL")
CONCEPTS = tuple(f"physics.{c}" for c in ("radioactivity", "radioactive-decay", "decay-constant-and-half-life"))
AVOID = r"the nuclear atom|fission|fusion|reactor|photoelectric|quantum"
# isotope: half-life, its unit, the gridline step, and what is measured
ISOTOPES = {
    "iodine-131": (8, "days", 1, "activity"), "phosphorus-32": (14, "days", 2, "activity"), "technetium-99m": (6, "hours", 1, "activity"),
    "carbon-11": (20, "minutes", 5, "activity"), "nitrogen-13": (10, "minutes", 2, "activity"), "sodium-24": (15, "hours", 5, "activity"),
    "caesium-137": (30, "years", 10, "activity"), "protactinium-234": (70, "seconds", 10, "count rate"),
}
WHERE = {"iodine-131": "for a thyroid treatment at a hospital in Kigali", "phosphorus-32": "at a hospital laboratory",
         "technetium-99m": "for a bone scan at a hospital", "carbon-11": "for a PET scan", "nitrogen-13": "for a PET scan",
         "sodium-24": "used as a tracer to find a leak in a water pipe", "caesium-137": "in soil after a nuclear accident",
         "protactinium-234": "from the school's protactinium generator"}


def sample(rng: random.Random) -> dict:
    isotope = rng.choice(list(ISOTOPES))
    half, unit, xstep, quantity = ISOTOPES[isotope]
    ystep = rng.choice([25, 50, 100, 200])
    return {"band": rng.choice(BANDS), "isotope": isotope, "half": half, "unit": unit, "xstep": xstep, "quantity": quantity,
            "ystep": ystep, "A0": ystep * rng.choice([8, 16]), "end": rng.choice([4, 5])}


def activity(p: dict, t: float) -> float:
    return p["A0"] * 2 ** (-t / p["half"])


def _per(p: dict) -> str:
    return "Bq" if p["quantity"] == "activity" else "counts per second"


def draw(p: dict):
    end = p["half"] * p["end"]
    fig, ax = new_figure(6.4, 4.6)
    ax.set_xticks(range(0, end + 1, p["xstep"]), minor=True)
    ax.set_xticks(range(0, end + 1, p["xstep"] * (2 if end // p["xstep"] > 12 else 1)))
    ax.set_yticks(range(0, p["A0"] + 1, p["ystep"]), minor=True)
    ax.set_yticks(range(0, p["A0"] + 1, p["ystep"] * (2 if p["A0"] // p["ystep"] > 10 else 1)))
    ax.grid(True, which="both", color=GRID, linewidth=0.5)
    ax.set_axisbelow(True)
    ax.set_xlim(0, end)
    ax.set_ylim(0, p["A0"] * 1.05)
    ts = [end * i / 800 for i in range(801)]
    ax.plot(ts, [activity(p, t) for t in ts], color=INK, linewidth=1.8)
    ax.set_xlabel(f"Time ({p['unit']})")
    ax.set_ylabel("Activity (Bq)" if p["quantity"] == "activity" else "Count rate (counts per second)")
    ax.tick_params(labelsize=8)
    return fig


def questions(p: dict, rng: random.Random) -> list:
    name, friend = rng.sample(NAMES, 2)
    T, A0, unit, iso = p["half"], p["A0"], p["unit"], p["isotope"]
    what = "activity" if p["quantity"] == "activity" else "count rate"
    n = rng.choice([n for n in (2, 3, 4, 5, 6) if (Fraction(A0, 2 ** n) * 100).denominator == 1])  # exact to 2 d.p.
    k = rng.choice([1, 2, 3])
    target = Fraction(A0, 2 ** k)
    words = {"days": ("d",), "hours": ("h", "hrs"), "minutes": ("min", "mins"), "years": ("y", "yrs"), "seconds": ("s", "secs")}[unit]
    times = lambda v: [str(v), f"{v} {unit}", *(f"{v} {w}" for w in words), *(f"{v}{w}" for w in words)]  # noqa: E731
    left = Fraction(A0, 2 ** n)
    rate = lambda v: ([str(v), *measure(v, "Bq")[1:]] if p["quantity"] == "activity"  # noqa: E731
                      else [str(v), f"{v} counts per second", f"{v} counts/s", f"{v} cps"])
    return [
        short(f"{name} plotted the {what} of a sample of {iso} {WHERE[iso]}. What is the half-life of {iso}?", T, times(T)),
        short(f"What will the {what} be after {n * T} {unit}?", exact(left), rate(exact(left))),
        short(f"{friend} wants to know how long the {what} takes to fall to {exact(target)} {_per(p)}. How long does it take?", k * T,
              times(k * T)),
    ]
