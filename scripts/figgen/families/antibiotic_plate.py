"""Antibiotic plates (UP, AL): an agar plate grown over with bacteria, a 5 mm grid printed under it, and four
lettered discs of antibiotic, each with its clear zone where no bacteria grew (one may have none). The zone's
diameter, the most effective antibiotic, and at AL the zone's area (π = 3.14).

Every zone's edge lies on a gridline (a zone of an odd number of 5 mm is centred half a square across), and
one zone is the largest.
"""
from __future__ import annotations

import random
from fractions import Fraction

from matplotlib.patches import Circle

from ..core import INK, NAMES, exact, mcq, new_figure, short

ID = "antibiotic_plate"
KIND = "diagram.template"
SUBJECT = "biology"
BANDS = ("UP", "AL")
CONCEPTS = tuple(f"biology.{c}" for c in ("antibiotics", "aseptic-technique", "bacterial-diseases-plants-animals",
                                           "infectious-diseases"))
AVOID = r"plant nutrition|photosynth|genetic|inherit|ecolog|population|digest|respiration|hormone|enzyme|classification|testing for"
G = 5  # mm a grid square
R = 45  # the plate's radius, mm
SPOTS = [(-20, 20), (20, 20), (-20, -20), (20, -20)]


def sample(rng: random.Random) -> dict:
    while True:
        zones = rng.sample([0, 10, 15, 20, 25, 30], 4)
        if sorted(zones)[-1] > sorted(zones)[-2]:
            break
    letters = rng.choice(["ABCD", "PQRS", "WXYZ"])
    discs = []
    for (x, y), z, letter in zip(SPOTS, zones, letters):
        if z and (z // G) % 2:  # an odd number of squares across: centred half a square off, so its edges meet gridlines
            x, y = x + (2.5 if x < 0 else -2.5), y + (2.5 if y < 0 else -2.5)
        discs.append({"letter": letter, "x": x, "y": y, "zone": z})
    with_zone = [d["letter"] for d in discs if d["zone"]]
    return {"band": rng.choice(BANDS), "grid": G, "discs": discs, "ask": rng.choice(with_zone), "area": rng.choice(with_zone),
            "germ": rng.choice(["E. coli", "Staphylococcus", "a soil bacterium", "Bacillus"])}


def draw(p: dict):
    fig, ax = new_figure(5.0, 5.0)
    plate = Circle((0, 0), R, facecolor="#c9ced3", edgecolor=INK, linewidth=2.0, zorder=1)
    ax.add_patch(plate)
    for v in range(-R + 5, R, G):
        for line in (ax.plot([v, v], [-R, R], color="#8d959c", linewidth=0.5, zorder=3)[0],
                     ax.plot([-R, R], [v, v], color="#8d959c", linewidth=0.5, zorder=3)[0]):
            line.set_clip_path(plate)
    for d in p["discs"]:
        if d["zone"]:
            ax.add_patch(Circle((d["x"], d["y"]), d["zone"] / 2, facecolor="#fbfbf8", edgecolor=INK, linewidth=0.9, zorder=2))
        ax.add_patch(Circle((d["x"], d["y"]), 3, facecolor="white", edgecolor=INK, linewidth=1.0, zorder=4))
        ax.text(d["x"], d["y"], d["letter"], ha="center", va="center", fontsize=8, fontweight="bold", zorder=5)
    ax.set_xlim(-R - 2, R + 2)
    ax.set_ylim(-R - 2, R + 2)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


SETTINGS = ["in a biology practical", "in the school laboratory", "for a class investigation", "at the science club"]


def _area_forms(v: Fraction) -> list[str]:
    n = exact(v)
    forms = [n, f"{n} mm²", f"{n} mm2"]
    for d in (0, 1, 2):
        r = exact(round(v, d)) if d else str(round(v))
        for f in (r, f"{r} mm²"):
            if f not in forms:
                forms.append(f)
    return forms


def questions(p: dict, rng: random.Random) -> list:
    who, friend = rng.sample(NAMES, 2)
    by = {d["letter"]: d for d in p["discs"]}
    x = p["ask"]
    best = max(p["discs"], key=lambda d: d["zone"])["letter"]
    qs = [short(f"{who} grew {p['germ']} on an agar plate with four antibiotic discs {rng.choice(SETTINGS)}. The grid squares are "
                f"5 mm wide. What is the diameter of the clear zone around disc {x}, in mm?", by[x]["zone"],
                [str(by[x]["zone"]), f"{by[x]['zone']} mm", f"{by[x]['zone']}mm"]),
          mcq(f"Which antibiotic is the most effective against {p['germ']}?", best, [d["letter"] for d in p["discs"] if d["letter"] != best], rng)]
    if p["band"] == "AL":
        y = p["area"]
        a = Fraction(314, 100) * Fraction(by[y]["zone"], 2) ** 2
        qs.append(short(f"{friend} calculates the area of the clear zone around disc {y}. Take π = 3.14. What is the area, in mm²?",
                        exact(a), _area_forms(a), tolerance=float(a) * 0.01))
    return qs
