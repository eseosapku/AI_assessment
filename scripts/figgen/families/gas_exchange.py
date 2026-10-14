"""Gas exchange at an alveolus (LS, UP, AL): an alveolus pressed against a capillary, the alveolus wall one thin cell
thick, red blood cells in the capillary and the direction of blood flow, with two unnamed arrows across the walls (one
from the air into the blood, one out of it). The wall, a red blood cell and the two arrows are lettered A to D. Beside
it, a table: the percentages of oxygen and carbon dioxide in inhaled and exhaled air, or at A level their partial
pressures in the alveolus air and in the blood arriving at it.

Which letter shows oxygen (or carbon dioxide) diffusing, the difference between the table's two values for a gas,
and how the lettered wall makes diffusion fast.

Exhaled air has 15 to 17 % oxygen and 3 to 5 % carbon dioxide, about as much carbon dioxide gained as oxygen lost;
the partial pressures make oxygen's gradient run into the blood and carbon dioxide's out of it, as the arrows do.
"""
from __future__ import annotations

import math
import random
from fractions import Fraction

from matplotlib.patches import Ellipse, PathPatch, Rectangle
from matplotlib.path import Path

from ..core import INK, NAMES, Question, exact, mcq, short

ID = "gas_exchange"
KIND = "diagram.template"
SUBJECT = "biology"
BANDS = ("LS", "UP", "AL")
CONCEPTS = tuple(f"biology.{c}" for c in ("gas-exchange", "respiration-overview"))
# Integrated Science teaches this too (P3n): its respiration chapter has a section on gas exchange.
ALSO = tuple(f"science.{c}" for c in ("gas-exchange", "human-respiratory-system"))
AVOID = r"in plants$|transport|immun|reproduc|cellular respiration|energy from respiration|energy and respiration"
# A topic whose sections the book lists is reached only if one names what this figure teaches.
NEEDS = r"gas(eous)? exchange|alveol|respiratory surface"
PARTS = ["wall", "rbc", "oxygen", "carbon dioxide"]

CX, CY, A, B = 6.0, 6.4, 4.2, 3.3  # the alveolus: an oval sac
THETA = math.radians(35)  # its flat floor, pressed on the capillary, starts this far below its middle
CHORD = round(CY - B * math.sin(THETA), 6)
WALL = 0.2
X_O2, X_CO2 = 4.7, 7.6
RBC = [2.0, 4.7, 10.0]  # oxygen's arrow ends on the middle cell


def sample(rng: random.Random) -> dict:
    band = rng.choice(BANDS)
    if band == "AL":
        table = "pressure"
        values = {"air in the alveolus": {"oxygen": rng.choice(["13.0", "13.3", "13.5", "13.7"]),
                                          "carbon dioxide": rng.choice(["4.8", "5.0", "5.3"])},
                  "blood arriving": {"oxygen": rng.choice(["5.0", "5.3", "5.5", "6.0"]),
                                     "carbon dioxide": rng.choice(["6.0", "6.1", "6.3", "6.5"])}}
    else:
        table = "percent"
        while True:
            drop = rng.choice([4.0, 4.5, 5.0, 5.5, 6.0])
            co2 = round(drop * rng.choice([0.7, 0.75, 0.8, 0.85, 0.9]), 1)
            if 3 <= co2 <= 5 and Fraction("0.65") <= (Fraction(str(co2)) - Fraction("0.04")) / Fraction(str(drop)) <= 1:
                break
        values = {"inhaled air": {"oxygen": "21", "carbon dioxide": "0.04"},
                  "exhaled air": {"oxygen": _num(21 - drop), "carbon dioxide": _num(co2)}}
    letters = dict(sorted(zip(rng.sample("ABCD", 4), PARTS)))
    return {"band": band, "table": table, "values": values, "letters": letters, "flow": rng.choice([1, -1]),
            "ask_arrow": rng.choice(["oxygen", "carbon dioxide"]), "ask_gas": rng.choice(["oxygen", "carbon dioxide"]), "chord": CHORD}


def _num(x: float) -> str:
    return str(int(x)) if float(x).is_integer() else f"{x:.1f}"


# --- drawing ----------------------------------------------------------------------------------------

def _sac(shrink: float) -> list[tuple[float, float]]:
    """The alveolus outline: an oval's top and sides, closed by its flat floor; `shrink` moves it inward."""
    a, b = A - shrink, B - shrink
    floor = CHORD + shrink
    t0 = math.asin((CY - floor) / b)
    ts = [-t0 + (math.pi + 2 * t0) * k / 120 for k in range(121)]
    return [(CX + a * math.cos(t), CY + b * math.sin(t)) for t in ts]


def _alveolus(ax) -> None:
    outer, inner = _sac(0.0), _sac(WALL)
    verts = outer + [outer[0]] + inner[::-1] + [inner[-1]]
    codes = [Path.MOVETO] + [Path.LINETO] * (len(outer) - 1) + [Path.CLOSEPOLY] + \
        [Path.MOVETO] + [Path.LINETO] * (len(inner) - 1) + [Path.CLOSEPOLY]
    ax.add_patch(PathPatch(Path(inner + [inner[0]], [Path.MOVETO] + [Path.LINETO] * (len(inner) - 1) + [Path.CLOSEPOLY]),
                           facecolor="#f3f8fc", edgecolor="none", zorder=1))
    ax.add_patch(PathPatch(Path(verts, codes), facecolor="#e7c3b3", edgecolor=INK, linewidth=1.2, zorder=2, gid="part:wall"))
    ax.text(CX, CY + 1.9, "air in the alveolus", ha="center", va="center", fontsize=9.5, style="italic", zorder=3)


def _capillary(ax, flow: int) -> None:
    lo, hi = 1.75, CHORD
    ax.add_patch(Rectangle((0.3, lo + WALL), 11.4, hi - lo - 2 * WALL, facecolor="#f6dcdc", edgecolor="none", zorder=1))
    for y in (lo, hi - WALL):
        ax.add_patch(Rectangle((0.3, y), 11.4, WALL, facecolor="#e7c3b3", edgecolor=INK, linewidth=1.0, zorder=2))
    for i, x in enumerate(RBC):
        ax.add_patch(Ellipse((x, (lo + hi) / 2), 1.5, 0.95, facecolor="#c96a6a", edgecolor=INK, linewidth=1.0, zorder=3,
                             gid="part:rbc" if i == 0 else None))
        ax.add_patch(Ellipse((x, (lo + hi) / 2), 0.62, 0.36, facecolor="#e09a9a", edgecolor="none", zorder=3))
    x0, x1 = (7.0, 10.2) if flow > 0 else (10.2, 7.0)
    ax.annotate("", xy=(x1, 1.05), xytext=(x0, 1.05), arrowprops=dict(arrowstyle="-|>", color=INK, lw=1.3, mutation_scale=12))
    ax.text(8.6, 0.55, "blood flow", ha="center", va="center", fontsize=9.5, style="italic")


def draw(p: dict):
    import matplotlib.pyplot as plt
    fig = plt.figure(figsize=(10.4, 4.6))
    ax = fig.add_axes([0.0, 0.0, 0.6, 1.0])
    _alveolus(ax)
    _capillary(ax, p["flow"])
    mid = (1.75 + CHORD) / 2
    gas_arrow = {"oxygen": ((X_O2, CHORD + 2.2), (X_O2, mid + 0.5)), "carbon dioxide": ((X_CO2, mid - 0.45), (X_CO2, CHORD + 2.2))}
    for gas, (tail, head) in gas_arrow.items():
        ax.annotate("", xy=head, xytext=tail, gid=f"arrow:{gas}", zorder=6,
                    arrowprops=dict(arrowstyle="-|>", color=INK, lw=2.0, mutation_scale=16, shrinkA=0, shrinkB=0))
    for letter, part in p["letters"].items():
        if part == "wall":
            t = math.radians(142)
            on = (CX + (A - WALL / 2) * math.cos(t), CY + (B - WALL / 2) * math.sin(t))
            at = (0.75, 9.15)
            ax.plot([at[0] + 0.3, on[0]], [at[1] - 0.15, on[1]], color=INK, linewidth=0.9, zorder=7, gid=f"leader:{letter}")
        elif part == "rbc":
            on = (RBC[0], mid)
            at = (RBC[0] - 1.2, 0.55)
            ax.plot([at[0] + 0.25, on[0]], [at[1] + 0.2, on[1]], color=INK, linewidth=0.9, zorder=7, gid=f"leader:{letter}")
        else:
            x = X_O2 - 0.45 if part == "oxygen" else X_CO2 + 0.45
            at = (x, CHORD + 1.1)
        ax.text(*at, letter, ha="center", va="center", fontsize=13, fontweight="bold", zorder=8, gid=f"letter:{letter}")
    ax.set_xlim(0.0, 12.0)
    ax.set_ylim(0.1, 10.0)
    ax.set_aspect("equal")
    ax.axis("off")
    _table(fig.add_axes([0.63, 0.3, 0.37, 0.4]), p)
    return fig


def _table(ax, p: dict) -> None:
    cols = list(p["values"])
    unit = "%" if p["table"] == "percent" else "kPa"
    heads = ["Gas"] + [f"{c[0].upper() + c[1:]}\n/ {unit}" if p["table"] == "percent" else
                       ("Air in the\nalveolus / kPa" if c == "air in the alveolus" else "Blood arriving\nat it / kPa") for c in cols]
    widths = [2.6, 2.6, 2.6]
    h = 0.75
    x = 0.0
    for j, (w, head) in enumerate(zip(widths, heads)):
        ax.add_patch(Rectangle((x, 2 * h), w, 1.3 * h, facecolor="#eef1f3", edgecolor=INK, linewidth=1.0))
        ax.text(x + w / 2, 2 * h + 0.65 * h, head, ha="center", va="center", fontsize=9.5, fontweight="bold")
        for i, gas in enumerate(["oxygen", "carbon dioxide"]):
            y = (1 - i) * h
            ax.add_patch(Rectangle((x, y), w, h, facecolor="none", edgecolor=INK, linewidth=1.0))
            words = gas if j == 0 else p["values"][cols[j - 1]][gas]
            ax.text(x + w / 2, y + h / 2, words, ha="center", va="center", fontsize=10)
        x += w
    ax.set_xlim(-0.05, x + 0.05)
    ax.set_ylim(-0.05, 2 * h + 1.3 * h + 0.05)
    ax.axis("off")


# --- questions --------------------------------------------------------------------------------------

SETTINGS = ["in a biology lesson in Huye", "for a health club poster in Kigali", "from a textbook at a school in Musanze",
            "for revision at a school in Rubavu", "in a lesson on breathing", "at the science club in Nyamagabe",
            "for a class display in Rwamagana"]
VERBS = ["drew", "copied", "labelled", "studied"]
PICTURES = ["an alveolus and its capillary", "gas exchange at an alveolus", "an air sac in the lungs and the capillary beside it"]
ARROW_Q = {"oxygen": ["Which letter shows oxygen diffusing into the blood?", "Which letter shows oxygen moving from the air into the blood?"],
           "carbon dioxide": ["Which letter shows carbon dioxide diffusing out of the blood?",
                              "Which letter shows carbon dioxide moving from the blood into the air?"]}
THIN = "it is thin, so gases diffuse only a short distance"
NOT_THIN = ["it carries oxygen away from the alveolus, bound to haemoglobin", "it is thick, so it protects the capillary from damage",
            "it pumps blood quickly past the alveolus to keep the gradient steep"]


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    letters = sorted(p["letters"])
    by = {part: L for L, part in p["letters"].items()}
    gas = p["ask_arrow"]
    qs = [Question("mcq", f"{who} {rng.choice(VERBS)} this diagram of {rng.choice(PICTURES)} {rng.choice(SETTINGS)}. "
                          f"{rng.choice(ARROW_Q[gas])}", str(letters.index(by[gas])), letters)]
    g = p["ask_gas"]
    cols = list(p["values"])
    diff = abs(Fraction(p["values"][cols[0]][g]) - Fraction(p["values"][cols[1]][g]))
    n = exact(diff)
    if p["table"] == "percent":
        qs.append(short(f"What is the difference between the percentage of {g} in inhaled air and in exhaled air?", n,
                        [n, f"{n}%", f"{n} %", f"{n} percent"]))
    else:
        qs.append(short(f"What is the difference between the partial pressure of {g} in the air in the alveolus and in the blood "
                        "arriving at it, in kPa?", n, [n, f"{n} kPa", f"{n}kPa"]))
    qs.append(mcq(f"How does the part labelled {by['wall']} help gases to diffuse quickly?", THIN, NOT_THIN, rng))
    return qs
