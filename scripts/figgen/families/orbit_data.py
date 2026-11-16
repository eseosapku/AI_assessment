"""Orbits (UP), for IGCSE "Earth and the Solar System" and Rwanda S5 "Motion in Orbits". Two kinds, every planet, moon and
satellite invented:

- kepler: a planet and four of its moons drawn on their orbits, a table of each moon's orbital radius and period with
  one period (or radius) missing; "T² ÷ r³ is the same for every moon of a planet" printed. Radii are k² units and
  periods k³ units, so every answer is whole. Asks the missing value and how many times further out one moon is.
- speed: three satellites of an invented planet with their orbital radius and period in a table; v = 2πr ÷ T with
  π = 3.14 printed (periods chosen so every speed is a whole number of km/s). Asks a satellite's speed, the fastest,
  and the distance one travels in one orbit.
"""
from __future__ import annotations

import math
import random
from fractions import Fraction

from matplotlib.patches import Circle

from ..core import INK, NAMES, exact, mcq, new_figure, short

ID = "orbit_data"
KIND = "table.data"
SUBJECT = "physics"
BANDS = ("UP",)
CONCEPTS = tuple(f"physics.{c}" for c in ("kepler-laws", "orbiting-under-gravity", "satellites", "solar-system-structure"))
# A topic whose sections the book lists is reached only if one names orbits, Kepler, satellites or the Solar System.
NEEDS = r"orbit|kepler|satellite|solar system|planet"
AVOID = r"glossary|stars|stellar|universe|galax|electric|magnet|circuit|wave|optic|radioactiv|nuclear|thermal|heat"
PLANETS = ["Zuri", "Keza-b", "Nyota", "Amahoro", "Inyenyeri"]
MOONS = ["Ana", "Bwiza", "Cyiza", "Duha", "Eza", "Fura"]


def sample(rng: random.Random) -> dict:
    planet = rng.choice(PLANETS)
    if rng.random() < 0.5:
        ks = [1] + sorted(rng.sample(range(2, 6), 3))  # the innermost moon is one unit out, so ratios are whole
        r0, t0 = rng.choice([10, 20, 25, 50]), rng.choice([1, 2, 3])  # thousand km; days
        moons = rng.sample(MOONS, 4)
        missing, hole = rng.choice(["T", "r"]), rng.randrange(1, 4)
        far = rng.choice([j for j in range(1, 4) if not (missing == "r" and j == hole)])
        return {"band": "UP", "kind": "kepler", "planet": planet, "r0": r0, "t0": t0,
                "moons": [[n, k] for n, k in zip(moons, ks)], "missing": missing, "hole": hole, "pair": [0, far]}
    sats = []
    for name in rng.sample(["S1", "S2", "S3", "S4", "S5"], 3):
        while True:
            r, v = rng.choice(range(6000, 48001, 1000)), rng.randint(2, 9)
            if (Fraction(628, 100) * r / v).denominator == 1 and all(v != s[2] for s in sats):
                break
        sats.append([name, r, v])
    sats.sort(key=lambda s: s[1])
    return {"band": "UP", "kind": "speed", "planet": planet, "sats": sats, "ask": rng.randrange(3), "around": rng.randrange(3)}


def period(s) -> int:
    """T = 2πr ÷ v, π = 3.14, in seconds."""
    _, r, v = s
    return int(Fraction(628, 100) * r / v)


def _draw_kepler(p: dict):
    fig, ax = new_figure(8.2, 4.4)
    ax.add_patch(Circle((2.0, 2.2), 0.35, facecolor="#9aa4ad", edgecolor=INK, linewidth=1.0))
    ax.text(2.0, 1.55, f"planet {p['planet']}", ha="center", va="center", fontsize=10)
    for k, (name, kk) in enumerate(p["moons"]):
        rad = 0.55 + 0.32 * (k + 1)
        ax.add_patch(Circle((2.0, 2.2), rad, fill=False, edgecolor="#999999", linewidth=0.8, linestyle=(0, (3, 3))))
        a = math.radians(70 - 35 * k)
        ax.add_patch(Circle((2.0 + rad * math.cos(a), 2.2 + rad * math.sin(a)), 0.07, facecolor=INK, edgecolor=INK))
    rows = [("Moon", "Orbital radius r\n(thousand km)", "Period T\n(days)")]
    for i, (name, k) in enumerate(p["moons"]):
        r, T = p["r0"] * k * k, p["t0"] * k ** 3
        if i == p["hole"]:
            r, T = (r, "?") if p["missing"] == "T" else ("?", T)
        rows.append((name, str(r), str(T)))
    for j, row in enumerate(rows):
        y = 3.75 - 0.6 * j - (0.15 if j else 0)
        for c, text in enumerate(row):
            ax.text(4.5 + 1.45 * c, y, text, ha="center", va="center", fontsize=10.5, fontweight="bold" if j == 0 else "normal",
                    linespacing=1.1)
    ax.plot([3.85, 8.1], [3.33, 3.33], color=INK, linewidth=0.9)
    ax.text(5.95, 0.25, "T² ÷ r³ is the same for every moon of a planet", ha="center", va="center", fontsize=10.5,
            style="italic")
    ax.set_xlim(0, 8.2)
    ax.set_ylim(0, 4.3)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def _draw_speed(p: dict):
    fig, ax = new_figure(8.0, 3.4)
    rows = [("Satellite", "Orbital radius r (km)", "Time for one orbit T (s)")]
    for name, r, v in p["sats"]:
        rows.append((name, f"{r:,}".replace(",", " "), f"{period([name, r, v]):,}".replace(",", " ")))
    for j, row in enumerate(rows):
        y = 2.6 - 0.55 * j
        for c, text in enumerate(row):
            ax.text((1.0, 3.75, 6.75)[c], y, text, ha="center", va="center", fontsize=10.5,
                    fontweight="bold" if j == 0 else "normal")
    ax.plot([0.1, 8.3], [2.33, 2.33], color=INK, linewidth=0.9)
    ax.text(0.1, 3.3, f"Satellites in circular orbits around the planet {p['planet']}", ha="left", va="center", fontsize=11)
    ax.text(0.1, 0.25, "orbital speed v = 2πr ÷ T;  take π = 3.14", ha="left", va="center", fontsize=10.5, style="italic")
    ax.set_xlim(0, 8.4)
    ax.set_ylim(0, 3.6)
    ax.axis("off")
    return fig


def draw(p: dict):
    return _draw_kepler(p) if p["kind"] == "kepler" else _draw_speed(p)


SETTINGS = ["in a lesson on orbits", "at the astronomy club in Musanze", "for homework", "for a class test in Kigali",
            "while revising in Huye", "in a physics class in Rubavu"]


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    setting = rng.choice(SETTINGS)
    if p["kind"] == "kepler":
        name, k = p["moons"][p["hole"]]
        a, b = p["pair"]
        (na, ka), (nb, kb) = p["moons"][a], p["moons"][b]
        if p["missing"] == "T":
            T = p["t0"] * k ** 3
            first = short(f"{who} studied the moons of planet {p['planet']} {setting}. Using the rule printed, what is the "
                          f"period of the moon {name}, in days?", T, [str(T), f"{T} days"])
        else:
            r = p["r0"] * k * k
            first = short(f"{who} studied the moons of planet {p['planet']} {setting}. Using the rule printed, what is the "
                          f"orbital radius of the moon {name}, in thousand km?", r, [str(r), f"{r} thousand km",
                                                                                     f"{r * 1000} km"])
        ratio = Fraction(kb * kb, ka * ka)
        return [first, short(f"How many times further from planet {p['planet']} is the moon {nb} than the moon {na}?",
                             exact(ratio), [exact(ratio), f"{exact(ratio)} times"])]
    sats = p["sats"]
    name, r, v = sats[p["ask"]]
    fastest = max(sats, key=lambda s: s[2])[0]
    on, rr, _ = sats[p["around"]]
    dist = int(Fraction(628, 100) * rr)
    return [short(f"{who} worked out the speeds of three satellites {setting}. What is the orbital speed of satellite {name}, "
                  f"in km/s?", v, [str(v), f"{v} km/s", f"{v}km/s"]),
            mcq("Which satellite moves fastest?", fastest, [s[0] for s in sats], rng),
            short(f"How far does satellite {on} travel in one orbit, in km?", dist,
                  [str(dist), f"{dist} km", f"{dist:,} km", f"{dist:,}".replace(",", " ")])]
