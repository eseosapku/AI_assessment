"""Sound samples (UP, AL): a sound wave on a grid of 4-bit sample values (0 to 15), sampled at a regular interval
of a fraction of a millisecond, each sample marked by a dot on a gridline with a line down to the time axis. The
sample value at a time, the sample rate, and the size in bytes of a recording at that rate and resolution.

Every key is read off the samples drawn: the rate is 1000 / interval samples a second, and the file size is
rate x seconds x 4 bits / 8, with no header.
"""
from __future__ import annotations

import math
import random

from ..core import INK, NAMES, new_figure, short

ID = "sound_samples"
KIND = "graph.line"
SUBJECT = "computing"
BANDS = ("UP", "AL")
CONCEPTS = tuple(f"computing.{c}" for c in ("data-representation-structure-management", "data-storage-measurement"))
AVOID = r"spreadsheet|database|network|internet|security|graphic|document|presentation|email|python|html|animation|expert system|monitoring and control|modelling|mail merge|data, information, knowledge|data processing and information|project management|operating systems|magnetic media|storage devices|role of the cpu|computer applications|data management|software and hardware|^storage$|^images$|graphics"
# A topic whose sections the book lists is reached only if one names what this figure teaches.
NEEDS = r"sound|audio|sampl|data representation|file size|storage|multimedia"
INTERVALS = [0.1, 0.2, 0.25, 0.5]  # ms: 10 000, 5 000, 4 000 and 2 000 samples a second
BITS = 4


def _t(k: int, step: float) -> str:
    return f"{round(k * step, 3):g}"


def sample(rng: random.Random) -> dict:
    step = rng.choice(INTERVALS)
    n = rng.randint(9, 12)
    a, f, ph = rng.uniform(4.5, 7.0), rng.uniform(0.7, 1.6), rng.uniform(0, 2 * math.pi)
    b, g = rng.uniform(0.0, 1.5), rng.uniform(2.0, 3.0)
    curve = {"a": round(a, 3), "f": round(f, 3), "ph": round(ph, 3), "b": round(b, 3), "g": round(g, 3)}
    vals = [max(0, min(15, round(_level(curve, k / (n - 1))))) for k in range(n)]
    return {"band": rng.choice(BANDS), "interval_ms": step, "samples": vals, "curve": curve, "ask": rng.randrange(1, n),
            "seconds": rng.randint(2, 10)}


def _level(c: dict, u: float) -> float:
    """The wave at u, from 0 (first sample) to 1 (last), centred on 7.5."""
    return 7.5 + c["a"] * math.sin(2 * math.pi * c["f"] * u + c["ph"]) + c["b"] * math.sin(2 * math.pi * c["g"] * u)


def draw(p: dict):
    vals, step = p["samples"], p["interval_ms"]
    n = len(vals)
    fig, ax = new_figure(7.6, 4.4)
    end = (n - 1) * step
    xs = [end * k / 400 for k in range(401)]
    ax.plot(xs, [min(15.4, max(-0.4, _level(p["curve"], x / end))) for x in xs], color="#7a8a99", linewidth=1.4, zorder=2)
    for k, v in enumerate(vals):
        t = k * step
        ax.plot([t, t], [0, v], color=INK, linewidth=1.0, zorder=3)
        ax.plot([t], [v], marker="o", markersize=6, color=INK, zorder=4)
    ax.set_xticks([k * step for k in range(n)])
    ax.set_xticklabels([_t(k, step) for k in range(n)], fontsize=9)
    ax.set_yticks(range(16))
    ax.tick_params(axis="y", labelsize=8.5)
    ax.grid(True, color="#c8c8c8", linewidth=0.7)
    ax.set_xlim(-step * 0.4, end + step * 0.4)
    ax.set_ylim(-0.5, 15.5)
    ax.set_xlabel("Time (ms)")
    ax.set_ylabel(f"Sample value ({BITS}-bit)")
    return fig


SETTINGS = ["in a computing lesson", "for homework", "on a revision card", "at the coding club", "for a class test"]


def _num(v: int) -> list[str]:
    forms = [str(v)]
    if v >= 1000:
        forms += [f"{v:,}", f"{v:,}".replace(",", " ")]
    return forms


def questions(p: dict, rng: random.Random) -> list:
    who, friend = rng.sample(NAMES, 2)
    vals, step = p["samples"], p["interval_ms"]
    k = p["ask"]
    rate = round(1000 / step)
    secs = p["seconds"]
    size = rate * secs * BITS // 8
    return [short(f"{who} samples this sound {rng.choice(SETTINGS)}. What is the sample value at {_t(k, step)} ms?", vals[k], [str(vals[k])]),
            short("What is the sample rate of this sound, in samples per second (Hz)?", rate,
                  _num(rate) + [f"{x} Hz" for x in _num(rate)] + [f"{rate // 1000} kHz"]),
            short(f"{friend} records this sound, sampled as in the graph, with a sample resolution of {BITS} bits, for {secs} seconds. "
                  "What is the file size in bytes, with no header?", size, _num(size) + [f"{x} bytes" for x in _num(size)])]
