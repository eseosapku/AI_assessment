"""Heat transfer and the atmosphere (LS, UP), for IGCSE "Heat transfer", Rwanda S3 "Environmental phenomena", S6
"Climate Change and Greenhouse Effect" and S6 "Application of Physics in Agriculture". Five kinds:

- cooling: three cans of hot water (matt black, dull grey, shiny silver; which is which is not drawn) cooling, every
  reading an even number of degrees on a gridline; the rule "the better emitter cools faster" printed. Asks which can
  is matt black, how far one cooled in the first minutes, a reading.
- conduction: four rods of unnamed metals heated at one end, pins held on by wax; after a printed time the fallen pins
  lie on a shelf under each rod. Asks how many fell from a rod, the best (or worst) conductor, how many fell in all.
- atmosphere: a simplified temperature profile of the atmosphere, three layers lettered; the lowest layer's top and
  its temperatures sit on gridlines. Asks the height where the temperature stops falling, the fall per kilometre, the
  layer that warms with height.
- solar (UP): four imaginary planets of the Sun at printed distances; I = 1360 W/m² × (1 AU ÷ d)² printed. Asks the
  intensity at a planet and how many times greater it is at one planet than at another.
- greenhouse: the greenhouse effect with five lettered arrows (sunlight through, sunlight reflected, infrared absorbed
  by the gases, sent back down, escaping to space), a key of the two kinds of radiation. Asks which arrow shows one.
"""
from __future__ import annotations

import math
import random
from fractions import Fraction

from matplotlib.patches import Circle, Rectangle

from ..core import GRID, INK, NAMES, exact, new_figure, short
from ._bio_parts import letter_choice

ID = "heat_transfer"
KIND = "physics.wave"
SUBJECT = "physics"
BANDS = ("LS", "UP")
CONCEPTS = tuple(f"physics.{c}" for c in ("heat-transfer", "environmental-physics", "climate-and-weather"))
# A topic whose sections the book lists is reached only if one names heat transfer, the atmosphere or the climate.
NEEDS = (r"heat transfer|thermal energy transfer|transfer of (?:thermal|heat)|heat and mass transfer|conduct|convect|"
         r"radiation|insulat|atmospher|greenhouse|climate")
AVOID = (r"glossary|thinking and working scientifically|science in context|scientific method|science skills|nuclear|"
         r"radioactiv|plant growth|electromagnetic spectrum|electric|magnet|telecommunication|signals|stellar|stars|"
         r"^chapter 8: temperature and heat$|^chapter 12: thermal properties of matter$")
HEAT = ("physics.heat-transfer",)
AIR = ("physics.environmental-physics", "physics.climate-and-weather")


def concepts_for(p: dict) -> tuple[str, ...]:
    """Cans and rods teach heat transfer; the atmosphere, the Sun's radiation and the greenhouse effect teach the
    environment and the climate."""
    return HEAT if p["kind"] in ("cooling", "conduction") else AIR


def avoid_for(p: dict) -> str:
    """Cans and rods are no figure for a chapter on climate change."""
    return AVOID + (r"|climate" if p["kind"] in ("cooling", "conduction") else "")


SURFACES = ["matt black", "dull grey", "shiny silver"]
LETTER_SETS = ["ABC", "PQR", "XYZ", "KLM"]
DISTANCES = ["0.4", "0.5", "0.8", "1", "2", "4", "5", "8", "10"]
GREENHOUSE = ["sunlight passing through the atmosphere to the ground",
              "sunlight reflected back into space by the atmosphere",
              "infrared radiation from the ground that the greenhouse gases absorb",
              "infrared radiation that the greenhouse gases send back down to the ground",
              "infrared radiation from the ground that escapes into space"]


# --- sampling -------------------------------------------------------------------------------------------------------

def _sample_cooling(rng: random.Random, band: str) -> dict:
    while True:
        start, room, dt = rng.choice([80, 84, 86, 90]), rng.choice([20, 22, 24]), rng.choice([2, 4, 5])
        rates = sorted(rng.uniform(0.25, 0.75) for _ in range(3))[::-1]  # fraction of the excess lost over the run
        rows = []
        for f in rates:
            k = -math.log(1 - f) / (5 * dt)
            rows.append([start] + [2 * round((room + (start - room) * math.exp(-k * dt * i)) / 2) for i in range(1, 6)])
        black, grey, silver = rows
        ok = all(all(a > b for a, b in zip(r, r[1:])) and r[-1] > room for r in rows)
        ok = ok and all(black[i] < grey[i] < silver[i] for i in range(1, 6))
        ok = ok and grey[-1] - black[-1] >= 6 and silver[-1] - grey[-1] >= 6
        if ok:
            break
    letters = rng.choice(LETTER_SETS)
    order = rng.sample(range(3), 3)
    cans = [[letters[k], SURFACES[order[k]], rows[order[k]]] for k in range(3)]
    t_drop = dt * rng.randint(2, 5)
    t_read = dt * rng.randint(1, 5)
    return {"band": band, "kind": "cooling", "start": start, "room": room, "dt": dt, "cans": cans,
            "drop": [rng.choice(letters), t_drop], "read": [rng.choice(letters), t_read]}


def _sample_conduction(rng: random.Random, band: str) -> dict:
    pins = rng.choice([5, 6])
    fallen = rng.sample(range(pins + 1), 4)
    return {"band": band, "kind": "conduction", "pins": pins, "minutes": rng.choice([2, 3, 4, 5]),
            "rods": [[L, f] for L, f in zip("ABCD", fallen)], "ask": rng.choice("ABCD"),
            "last": rng.choice(["worst", "total"])}


def _sample_atmosphere(rng: random.Random, band: str) -> dict:
    while True:
        T0, lapse, top = rng.choice([15, 20, 25, 30]), rng.choice(["5", "5.5", "6", "6.5", "7"]), rng.choice([10, 12, 14, 16])
        drop = Fraction(lapse) * top
        if drop.denominator == 1 and drop % 5 == 0 and -75 <= T0 - drop <= -40:
            break
    return {"band": band, "kind": "atmosphere", "T0": T0, "lapse": lapse, "top": top,
            "strat": rng.choice([-10, -5, 0]), "meso": rng.choice([-90, -85]), "letters": list(rng.choice(LETTER_SETS))}


def _sample_solar(rng: random.Random, band: str) -> dict:
    while True:
        ds = sorted(rng.sample(DISTANCES, 4), key=Fraction)
        pairs = [(a, b) for a in ds for b in ds if Fraction(b) > Fraction(a) and ((Fraction(b) / Fraction(a)) ** 2).denominator == 1]
        if pairs:
            break
    letters = rng.choice(["PQRS", "ABCD", "WXYZ", "KLMN"])
    a, b = rng.choice(pairs)
    return {"band": "UP", "kind": "solar", "planets": [[L, d] for L, d in zip(letters, ds)], "at": rng.choice(letters),
            "pair": [letters[ds.index(a)], letters[ds.index(b)]]}


def _sample_greenhouse(rng: random.Random, band: str) -> dict:
    letters = rng.sample("ABCDEFGHJKLMNPQRSTUVWXYZ", 5)
    return {"band": band, "kind": "greenhouse", "letters": letters, "asked": rng.sample(range(5), 3)}


def sample(rng: random.Random) -> dict:
    kind = rng.choice(["cooling", "conduction", "atmosphere", "solar", "greenhouse"])
    band = rng.choice(BANDS)
    return {"cooling": _sample_cooling, "conduction": _sample_conduction, "atmosphere": _sample_atmosphere,
            "solar": _sample_solar, "greenhouse": _sample_greenhouse}[kind](rng, band)


# --- drawing --------------------------------------------------------------------------------------------------------

def _smooth(xs, ys, n: int = 24):
    """A monotone curve through the readings (Fritsch–Carlson), so it never bulges past a reading."""
    h = [b - a for a, b in zip(xs, xs[1:])]
    d = [(y1 - y0) / w for y0, y1, w in zip(ys, ys[1:], h)]
    m = [d[0]] + [0.0 if d[i - 1] * d[i] <= 0 else 2 / (1 / d[i - 1] + 1 / d[i]) for i in range(1, len(d))] + [d[-1]]
    out_x, out_y = [], []
    for i, w in enumerate(h):
        for k in range(n + (1 if i == len(h) - 1 else 0)):
            t = k / n
            h00, h10, h01, h11 = 2 * t ** 3 - 3 * t ** 2 + 1, t ** 3 - 2 * t ** 2 + t, -2 * t ** 3 + 3 * t ** 2, t ** 3 - t ** 2
            out_x.append(xs[i] + t * w)
            out_y.append(h00 * ys[i] + h10 * w * m[i] + h01 * ys[i + 1] + h11 * w * m[i + 1])
    return out_x, out_y


def _draw_cooling(p: dict):
    fig, ax = new_figure(7.0, 5.0)
    dt = p["dt"]
    times = [dt * i for i in range(6)]
    lo = (min(r[-1] for _, _, r in p["cans"]) - 6) // 10 * 10
    hi = p["start"] + 6
    ax.set_ylim(lo, hi)
    ax.set_yticks(range(lo, hi + 1, 10))
    ax.set_yticks(range(lo, hi + 1, 2), minor=True)
    ax.set_xlim(0, times[-1] * 1.16)
    ax.set_xticks(times)
    ax.set_xticks(range(0, times[-1] + 1, 1), minor=True)
    ax.grid(True, which="major", color=GRID, linewidth=0.8)
    ax.grid(True, which="minor", color=GRID, linewidth=0.4)
    ax.set_axisbelow(True)
    styles = ["-", (0, (6, 3)), (0, (1.5, 2))]
    for k, (L, _, temps) in enumerate(p["cans"]):
        sx, sy = _smooth(times, temps)
        ax.plot(sx, sy, color=INK, linewidth=1.6, linestyle=styles[k], gid=f"curve:{L}")
        ax.plot(times, temps, "o", color=INK, markersize=4.5, gid=f"readings:{L}")
        ax.text(times[-1] + times[-1] * 0.04, temps[-1], f"can {L}", ha="left", va="center", fontsize=11,
                fontweight="bold", gid=f"can:{L}")
    ax.set_xlabel("Time (minutes)", fontsize=11)
    ax.set_ylabel("Temperature of the water (°C)", fontsize=11)
    ax.set_title("Three cans, matt black, dull grey and shiny silver, each full of hot water\n"
                 "The better emitter of radiation cools faster", fontsize=10.5)
    ax.tick_params(labelsize=9.5)
    return fig


def _draw_conduction(p: dict):
    fig, ax = new_figure(7.4, 6.0)
    pins = p["pins"]
    ax.add_patch(Rectangle((0.0, 0.2), 1.6, 9.0, facecolor="#f2c9a5", edgecolor=INK, linewidth=1.4))
    ax.text(0.8, 4.7, "very hot\nwater", ha="center", va="center", fontsize=10.5)
    gap = 5.6 / pins
    for row, (L, fallen) in enumerate(p["rods"]):
        y = 8.1 - 2.2 * row
        ax.add_patch(Rectangle((1.6, y), 7.0, 0.32, facecolor="#c8ccd0", edgecolor=INK, linewidth=1.1))
        ax.text(8.9, y + 0.16, f"rod {L}", ha="left", va="center", fontsize=11, fontweight="bold", gid=f"rod:{L}")
        for k in range(pins):
            x = 2.4 + k * gap
            if k >= fallen:  # the far pins still hang from their wax
                ax.add_patch(Circle((x, y - 0.08), 0.1, facecolor="#f3e7b3", edgecolor=INK, linewidth=0.7))
                ax.plot([x, x], [y - 0.16, y - 0.95], color=INK, linewidth=1.4, gid=f"pin:{L}")
        shelf = y - 1.35
        ax.plot([1.9, 8.6], [shelf, shelf], color=INK, linewidth=1.0, gid=f"shelf:{L}")
        for k in range(fallen):  # fallen pins lie flat on the shelf, under where they hung
            x = 2.4 + k * gap
            ax.plot([x - 0.38, x + 0.38], [shelf + 0.07, shelf + 0.07], color=INK, linewidth=1.4, gid=f"fallen:{L}")
    ax.set_title(f"Four rods of different metals, heated at one end for {p['minutes']} minutes\n"
                 "Each pin is held on by wax; the better the conductor, the more pins fall", fontsize=10.5)
    ax.set_xlim(-0.2, 10.4)
    ax.set_ylim(0.0, 9.4)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def _profile(p: dict):
    T0, top = p["T0"], p["top"]
    Tt = T0 - Fraction(p["lapse"]) * top
    return [(T0, 0), (float(Tt), top), (p["strat"], 50), (p["meso"], 85)]


def _draw_atmosphere(p: dict):
    fig, ax = new_figure(6.4, 5.6)
    pts = _profile(p)
    ax.set_xlim(-100, 50)
    ax.set_ylim(0, 92)
    ax.set_xticks(range(-100, 41, 20))
    ax.set_xticks(range(-100, 51, 5), minor=True)
    ax.set_yticks(range(0, 91, 10))
    ax.set_yticks(range(0, 93, 2), minor=True)
    ax.grid(True, which="major", color=GRID, linewidth=0.8)
    ax.grid(True, which="minor", color=GRID, linewidth=0.35)
    ax.set_axisbelow(True)
    ax.plot([x for x, _ in pts], [y for _, y in pts], color=INK, linewidth=2.0, gid="profile")
    for h in (p["top"], 50, 85):
        ax.plot([-100, 32], [h, h], color=INK, linewidth=0.9, linestyle=(0, (5, 3)), gid=f"boundary:{h}")
    for L, (y0, y1) in zip(p["letters"], ((0, p["top"]), (p["top"], 50), (50, 85))):
        ax.text(41, (y0 + y1) / 2, L, ha="center", va="center", fontsize=13, fontweight="bold", gid=f"layer:{L}",
                bbox=dict(boxstyle="circle,pad=0.2", facecolor="white", edgecolor=INK, linewidth=1.0))
    ax.set_xlabel("Temperature (°C)", fontsize=11)
    ax.set_ylabel("Height above the ground (km)", fontsize=11)
    ax.set_title("Temperature of the atmosphere at different heights (simplified)\n"
                 "Layers lettered; dashed lines mark where one layer ends", fontsize=10.5)
    ax.tick_params(labelsize=9.5)
    return fig


def _draw_solar(p: dict):
    fig, ax = new_figure(7.6, 3.6)
    ax.add_patch(Circle((0.6, 1.6), 0.55, facecolor="#f6c945", edgecolor=INK, linewidth=1.2))
    ax.text(0.6, 0.75, "the Sun", ha="center", va="center", fontsize=10.5)
    ax.plot([1.2, 9.6], [1.6, 1.6], color=INK, linewidth=0.7, linestyle=(0, (2, 3)), gid="orbit-line")
    for k, (L, d) in enumerate(p["planets"]):
        x = 2.6 + 2.2 * k
        ax.add_patch(Circle((x, 1.6), 0.22, facecolor="#9aa4ad", edgecolor=INK, linewidth=1.0))
        ax.text(x, 2.2, f"planet {L}", ha="center", va="center", fontsize=11, fontweight="bold", gid=f"planet:{L}")
        ax.text(x, 1.0, f"{d} AU", ha="center", va="center", fontsize=10.5, gid=f"dist:{L}")
    ax.text(5.0, 3.15, "Intensity of the Sun's radiation:  I = 1360 W/m² × (1 AU ÷ d)²", ha="center", va="center",
            fontsize=11)
    ax.text(5.0, 0.3, "d = distance from the Sun; 1 AU is the Earth's distance from the Sun (not to scale)",
            ha="center", va="center", fontsize=9.5)
    ax.set_xlim(0, 10)
    ax.set_ylim(0, 3.5)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


SUN, IR = "#d9a400", "#c0392b"


def _arrow(ax, a, b, colour):
    ax.annotate("", xy=b, xytext=a, arrowprops=dict(arrowstyle="-|>,head_length=0.6,head_width=0.3", color=colour,
                                                       linewidth=2.2, shrinkA=0, shrinkB=0))


def _draw_greenhouse(p: dict):
    fig, ax = new_figure(7.4, 6.2)
    ax.add_patch(Rectangle((0, 0), 10, 1.2, facecolor="#c9b48a", edgecolor="none"))
    ax.plot([0, 10], [1.2, 1.2], color=INK, linewidth=1.2, gid="ground")
    ax.add_patch(Rectangle((0, 3.4), 10, 1.6, facecolor="#e3ecf2", edgecolor="none"))
    ax.plot([0, 10], [3.4, 3.4], color=INK, linewidth=0.8, linestyle=(0, (4, 3)), gid="layer-bottom")
    ax.plot([0, 10], [5.0, 5.0], color=INK, linewidth=0.8, linestyle=(0, (4, 3)), gid="layer-top")
    ax.text(0.25, 0.6, "ground", ha="left", va="center", fontsize=10.5)
    ax.text(2.25, 4.68, "atmosphere with greenhouse gases", ha="left", va="center", fontsize=10)
    ax.text(9.75, 7.6, "space", ha="right", va="center", fontsize=10.5)
    ax.add_patch(Circle((0.9, 7.6), 0.55, facecolor="#f6c945", edgecolor=INK, linewidth=1.1))
    ax.text(0.9, 6.75, "Sun", ha="center", va="center", fontsize=10)
    L = p["letters"]
    # (start, end, colour, where the letter sits) in the order of GREENHOUSE; each letter sits beside its own arrow,
    # well away from every other arrow
    arrows = [((1.35, 7.15), (2.4, 1.25), SUN, (1.6, 2.6)),
              ((3.6, 5.05), (4.9, 7.6), SUN, (5.05, 6.2)),
              ((4.6, 1.25), (5.0, 4.0), IR, (4.25, 2.35)),
              ((6.4, 3.75), (6.0, 1.25), IR, (6.65, 2.35)),
              ((7.4, 1.25), (8.2, 7.4), IR, (8.15, 2.35))]
    _arrow(ax, (1.5, 7.45), (3.6, 5.05), SUN)  # the reflected sunlight comes in from the Sun before it turns back
    for k, (a, b, colour, spot) in enumerate(arrows):
        _arrow(ax, a, b, colour)
        ax.text(*spot, L[k], ha="center", va="center", fontsize=12, fontweight="bold", gid=f"arrow:{L[k]}",
                bbox=dict(boxstyle="circle,pad=0.2", facecolor="white", edgecolor=INK, linewidth=1.0))
    ax.plot([3.35, 3.95], [9.05, 9.05], color=SUN, linewidth=2.6, gid="key-sun")
    ax.text(4.1, 9.05, "sunlight (mostly visible light)", ha="left", va="center", fontsize=10)
    ax.plot([3.35, 3.95], [8.55, 8.55], color=IR, linewidth=2.6, gid="key-ir")
    ax.text(4.1, 8.55, "infrared radiation", ha="left", va="center", fontsize=10)
    ax.set_xlim(0, 10)
    ax.set_ylim(0, 9.5)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def draw(p: dict):
    return {"cooling": _draw_cooling, "conduction": _draw_conduction, "atmosphere": _draw_atmosphere,
            "solar": _draw_solar, "greenhouse": _draw_greenhouse}[p["kind"]](p)


# --- questions ------------------------------------------------------------------------------------------------------

SETTINGS = ["in the school laboratory", "in a lesson on heat transfer", "at the science club in Huye", "for homework",
            "in a physics class in Rubavu", "in a revision session in Musanze", "for a class test in Kigali",
            "in a practical lesson in Nyagatare"]
ENV_SETTINGS = ["in a lesson on the environment", "for a project on climate change", "at the science club in Huye",
                "for homework", "in a physics class in Rubavu", "in a revision session in Musanze",
                "for a class test in Kigali", "while revising in Muhanga"]


def _deg(v) -> list[str]:
    s = exact(v)
    return [s, f"{s} °C", f"{s}°C", f"{s} degrees", f"{s} C"]


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    if p["kind"] == "cooling":
        cans = {L: (sf, temps) for L, sf, temps in p["cans"]}
        letters = sorted(cans)
        black = next(L for L, (sf, _) in cans.items() if sf == "matt black")
        (L, t), (L2, t2) = p["drop"], p["read"]
        drop = p["start"] - cans[L][1][t // p["dt"]]
        temp = cans[L2][1][t2 // p["dt"]]
        return [letter_choice(f"{who} recorded how hot water cooled in three cans {rng.choice(SETTINGS)}. Matt black is the "
                              f"best emitter of radiation and shiny silver the worst. Which can is matt black?", black, letters),
                short(f"By how many degrees did the water in can {L} cool in the first {t} minutes?", drop, _deg(drop)),
                short(f"What was the temperature of the water in can {L2} after {t2} minutes, in °C?", temp, _deg(temp))]
    if p["kind"] == "conduction":
        fallen = dict(p["rods"])
        letters = sorted(fallen)
        L = p["ask"]
        qs = [short(f"{who} fixed pins with wax along four metal rods heated at one end {rng.choice(SETTINGS)}. How many "
                    f"pins had fallen from rod {L} after {p['minutes']} minutes?", fallen[L],
                    [f"{fallen[L]} pins"] + ([f"{fallen[L]} pin"] if fallen[L] == 1 else [])),
              letter_choice("Which rod is made of the best conductor of heat?", max(fallen, key=fallen.get), letters)]
        if p["last"] == "worst":
            qs.append(letter_choice("Which rod is made of the worst conductor of heat?", min(fallen, key=fallen.get), letters))
        else:
            total = sum(fallen.values())
            qs.append(short("How many pins had fallen altogether from the four rods?", total, [f"{total} pins"]))
        return qs
    if p["kind"] == "atmosphere":
        low, mid, _ = p["letters"]
        lapse = Fraction(p["lapse"])
        return [short(f"{who} studied this graph of the temperature of the atmosphere {rng.choice(ENV_SETTINGS)}. At what "
                      f"height, in km, does the temperature stop falling at the top of layer {low}?", p["top"],
                      [str(p["top"]), f"{p['top']} km", f"{p['top']}km"]),
                short(f"In layer {low}, by how many °C does the temperature fall for each kilometre of height?", exact(lapse),
                      _deg(lapse) + [f"{exact(lapse)} °C per km", f"{exact(lapse)} °C/km"]),
                letter_choice("In which lettered layer does the temperature rise as the height increases?", mid,
                              sorted(p["letters"]))]
    if p["kind"] == "solar":
        d = {L: Fraction(x) for L, x in p["planets"]}
        L = p["at"]
        intensity = Fraction(1360) / d[L] ** 2
        a, b = p["pair"]
        r = (d[b] / d[a]) ** 2
        val = exact(intensity)
        return [short(f"{who} compared four imaginary planets of the Sun {rng.choice(ENV_SETTINGS)}. Using the formula "
                      f"printed, what is the intensity of the Sun's radiation at planet {L}, in W/m²?", val,
                      [val, f"{val} W/m²", f"{val} W/m2", f"{val}W/m²"]),
                short(f"How many times greater is the intensity of the Sun's radiation at planet {a} than at planet {b}?",
                      exact(r), [exact(r), f"{exact(r)} times"])]
    L = p["letters"]
    qs = []
    for n, k in enumerate(p["asked"]):
        lead = f"{who} drew how the greenhouse effect keeps the Earth warm {rng.choice(ENV_SETTINGS)}. " if n == 0 else ""
        qs.append(letter_choice(f"{lead}Which lettered arrow shows {GREENHOUSE[k]}?", L[k], sorted(L)))
    return qs
