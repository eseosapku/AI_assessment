"""Spirometer traces (UP, AL): the volume of air in the lungs over 35 seconds, 20 seconds of quiet breathing
and then one deepest breath in and out. The breathing rate per minute, the tidal volume, the vital capacity,
and at AL the volume breathed in per minute.

Quiet breathing runs 12, 15 or 18 breaths a minute, so 20 seconds hold a whole number of breaths; every
peak and trough asked about lies on a gridline.
"""
from __future__ import annotations

import math
import random
from fractions import Fraction

from ..core import GRID, INK, NAMES, exact, new_figure, short

ID = "spirometer_trace"
KIND = "graph.line"
SUBJECT = "biology"
BANDS = ("UP", "AL")
CONCEPTS = tuple(f"biology.{c}" for c in ("gas-exchange", "breathing-mechanism-humans", "respiratory-diseases-smoking"))
AVOID = r"plant|photosynth|genetic|inherit|ecolog|population|enzyme|reproduc|cell|digest|nutrition|specialized tissues"
# A topic whose sections the book lists is reached only if one names what this figure teaches.
NEEDS = r"breathing|ventilation|lung|spiromet|tidal|vital capacity|gas exchange in humans"
QUIET = 20  # seconds of quiet breathing


def sample(rng: random.Random) -> dict:
    rate = rng.choice([12, 15, 18])
    tidal = rng.choice([0.4, 0.5, 0.6])
    base = rng.choice([2.0, 2.5])
    low = rng.choice([1.0, 1.5])
    vital = rng.choice([3.5, 4.0, 4.5]) if low == 1.0 else rng.choice([3.5, 4.0])
    return {"band": rng.choice(BANDS), "rate": rate, "tidal": tidal, "base": base, "low": low, "vital": vital, "quiet": QUIET,
            "who": rng.choice(["a student", "an athlete", "a teacher", "a volunteer"])}


def volume(p: dict, t: float) -> float:
    period = 60 / p["rate"]
    if t <= QUIET:
        return p["base"] + p["tidal"] * (1 - math.cos(2 * math.pi * t / period)) / 2
    top = p["low"] + p["vital"]
    if t <= QUIET + 4:  # the deepest breath in
        u = (t - QUIET) / 4
        return p["base"] + (top - p["base"]) * (1 - math.cos(math.pi * u)) / 2
    if t <= QUIET + 10:  # all the way out
        u = (t - QUIET - 4) / 6
        return top - (top - p["low"]) * (1 - math.cos(math.pi * u)) / 2
    u = min(1.0, (t - QUIET - 10) / 4)  # back to quiet breathing
    return p["low"] + (p["base"] - p["low"]) * (1 - math.cos(math.pi * u)) / 2


def peaks(p: dict) -> int:
    """The tops of the quiet breaths drawn in the first 20 seconds."""
    period = 60 / p["rate"]
    return sum(1 for k in range(100) if period / 2 + k * period < QUIET)


def draw(p: dict):
    fig, ax = new_figure(7.0, 4.4)
    ax.set_xticks(range(0, 36, 5))
    ax.set_xticks(range(0, 36), minor=True)
    ax.set_yticks([v / 2 for v in range(0, 13)])
    ax.set_yticks([v / 10 for v in range(0, 61)], minor=True)
    ax.grid(True, which="major", color=GRID, linewidth=0.7)
    ax.grid(True, which="minor", color=GRID, linewidth=0.3)
    ax.set_axisbelow(True)
    ax.set_xlim(0, 35)
    ax.set_ylim(0, 6)
    ts = [35 * k / 1400 for k in range(1401)]
    ax.plot(ts, [volume(p, t) for t in ts], color=INK, linewidth=1.6)
    ax.set_xlabel("Time (s)")
    ax.set_ylabel("Volume of air in the lungs (dm³)")
    ax.tick_params(labelsize=8)
    return fig


SETTINGS = ["in a biology lesson", "in a sports science class", "at a health check", "at the science club"]


def _dm3(v) -> list[str]:
    n = exact(v)
    return [n, f"{n} dm³", f"{n} litres", f"{n} L", f"{n} l", f"{n}dm³", f"{n} dm3"] + \
        ([f"{int(Fraction(n) * 1000)} {u}" for u in ("cm³", "cm3", "ml", "mL")] if Fraction(n) < 10 else [])


def questions(p: dict, rng: random.Random) -> list:
    who, friend = rng.sample(NAMES, 2)
    qs = [short(f"{who} recorded the breathing of {p['who']} on a spirometer {rng.choice(SETTINGS)}. Use the first 20 s of quiet "
                "breathing. What is the breathing rate in breaths per minute?", p["rate"],
                [str(p["rate"]), f"{p['rate']} breaths per minute", f"{p['rate']} breaths/min", f"{p['rate']} per minute"]),
          short("What is the tidal volume during quiet breathing?", exact(p["tidal"]), _dm3(p["tidal"])),
          short(f"{friend} looks at the deepest breath. What is the vital capacity?", exact(p["vital"]), _dm3(p["vital"]))]
    if p["band"] == "AL":
        v = Fraction(str(p["tidal"])) * p["rate"]
        qs.append(short("What volume of air is breathed in per minute during quiet breathing, in dm³?", exact(v),
                        [exact(v), f"{exact(v)} dm³", f"{exact(v)} dm³/min", f"{exact(v)} dm³ per minute"]))
    return qs
