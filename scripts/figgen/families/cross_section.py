"""Cross-section of the land from A to B. Heights sit on 50 m gridlines at whole kilometres. The height at X, the
difference in height between X and Y, the steepest section, and at Upper Secondary the vertical exaggeration from
the two scales printed under the section (P3m: named leads, the exaggeration).
"""
from __future__ import annotations

import random

from ..core import GRID, NAMES, mcq, new_figure, short

ID = "cross_section"
KIND = "geo.section"
SUBJECT = "geography"
BANDS = ("LS", "UP")
CONCEPTS = tuple(f"geography.{c}" for c in ("cross-sections-sketch-maps", "topographic-maps", "relief-landforms"))
AVOID = r"exam-style|^introduction$"  # topics that teach none of it, read by name and section (P3m)
# A topic whose sections the book lists is reached only if one names what this figure teaches.
NEEDS = r"cross.section|contour|relief|topographic|map work|map reading|sketch map|vertical exaggeration"
VERTICAL = [5000, 10000, 25000]  # 1 : this, under a horizontal 1 : 50 000


def sample(rng: random.Random) -> dict:
    cuts = [0, 3, 7, 10]
    while True:
        heights = [rng.randrange(1200, 1800, 50)]
        for a, b in zip(cuts, cuts[1:]):
            # Each section only climbs or only falls, so how steep it is can be seen at a glance.
            sign = rng.choice([-1, 1])
            for _ in range(b - a):
                heights.append(heights[-1] + sign * rng.choice([0, 50, 100, 150, 200]))
        if min(heights) < 1050 or max(heights) > 2450:
            continue
        rises = sorted((abs(heights[b] - heights[a]) / (b - a) for a, b in zip(cuts, cuts[1:])), reverse=True)
        if rises[0] < 1.5 * rises[1]:  # the steepest section must be clearly the steepest
            continue
        x, y = sorted(rng.sample(range(1, 10), 2))
        if heights[x] != heights[y]:
            return {"band": rng.choice(BANDS), "heights": heights, "cuts": cuts, "x": x, "y": y, "vertical": rng.choice(VERTICAL)}


def draw(p: dict):
    h = p["heights"]
    fig, ax = new_figure(7.0, 3.8)
    km = list(range(len(h)))
    ax.plot(km, h, color="#111111")
    ax.fill_between(km, h, 1000, color="#d6dade")
    ax.set_xticks(km)
    lo, hi = 1000, max(h) + 100
    # Numbers every 100 m, gridlines every 50 m: every height is a multiple of 50.
    ax.set_yticks(range(lo, hi + 1, 100))
    ax.set_yticks(range(lo, hi + 1, 50), minor=True)
    ax.set_ylim(lo, hi)
    ax.tick_params(axis="y", labelsize=8)
    ax.grid(True, which="both", color=GRID, linewidth=0.5)
    ax.set_axisbelow(True)
    ax.set_xlabel("Distance from A (km)")
    ax.set_ylabel("Height above sea level (m)")
    for name, k in (("X", p["x"]), ("Y", p["y"])):
        ax.plot(k, h[k], marker="o", color="#111111")
        ax.text(k, h[k] + 25, name, ha="center", fontweight="bold")
    for c in p["cuts"][1:-1]:
        ax.plot([c, c], [lo, hi], color="#111111", linewidth=1, linestyle="--")
    for n, (a, b) in enumerate(zip(p["cuts"], p["cuts"][1:]), start=1):
        ax.text((a + b) / 2, lo + 15, f"Section {n}", ha="center", fontsize=9)
    if p.get("band") == "UP":
        ax.set_title(f"Horizontal scale 1 : 50 000      Vertical scale 1 : {p['vertical']:,}".replace(",", " "), fontsize=9.5)
    ax.text(0, hi - 40, "A", fontweight="bold")
    ax.text(len(h) - 1, hi - 40, "B", fontweight="bold", ha="right")
    return fig


SETTINGS = ["in a geography lesson", "for homework", "on a revision card", "for a class test", "on a field trip"]


def questions(p: dict, rng: random.Random) -> list:
    who, friend = rng.sample(NAMES, 2)
    h, x, y = p["heights"], p["x"], p["y"]
    cuts = p["cuts"]
    rises = [abs(h[b] - h[a]) / (b - a) for a, b in zip(cuts, cuts[1:])]
    steepest = rises.index(max(rises)) + 1
    qs = [
        short(f"{who} drew this cross-section from A to B {rng.choice(SETTINGS)}. What is the height of the land at X, {x} km from A, in metres?",
              h[x], [f"{h[x]}m", f"{h[x]} m"]),
        short(f"{friend} compares X and Y, {y - x} km apart. What is the difference in height between X and Y, in metres?", abs(h[x] - h[y]),
              [f"{abs(h[x] - h[y])}m", f"{abs(h[x] - h[y])} m"]),
        mcq(f"On average, which section of {who}'s cross-section is steepest?", f"Section {steepest}",
            [f"Section {n}" for n in (1, 2, 3) if n != steepest], rng),
    ]
    if p.get("band") == "UP":
        ve = 50000 // p["vertical"]
        qs.append(short("Using the two scales printed above the cross-section, what is its vertical exaggeration?", ve,
                        [str(ve), f"{ve} times", f"x{ve}", f"×{ve}", f"{ve}x"]))
    return qs
