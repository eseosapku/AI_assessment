"""Medical imaging at A Level (AL): Cambridge AS & A Level Physics Chapter 32 "Medical imaging". Three kinds:

- ascan: an ultrasound A-scan, echo amplitude against time on a grid, the pulse sent at time 0 from a probe on the
  skin and two echoes, P and Q, from the boundaries below; the layers and their speeds of ultrasound are printed.
  Asks each layer's thickness (speed × time ÷ 2, the echo going down and back) and the depth of the deeper boundary;
- attenuation: the intensity of an X-ray beam against the thickness of two materials P and Q it passes through,
  I = I₀e^(−μx) and μ = 0.693 ÷ x½ printed, each curve halving on a whole number of millimetres. Asks a half-value
  thickness, the intensity after a whole number of half-value thicknesses, the thickness that leaves a stated
  intensity, and μ;
- impedance: a table of tissues' densities and speeds of ultrasound (the data the Cambridge coursebook gives), with
  Z = ρc and the intensity reflection coefficient α = (Z₂ − Z₁)² ÷ (Z₂ + Z₁)² printed. Asks one tissue's acoustic
  impedance, and at which of three boundaries the greatest fraction of the intensity is reflected — boundaries between
  three soft tissues, so it is worked out, not remembered (air and bone are not among them).
"""
from __future__ import annotations

import math
import random
from fractions import Fraction

from matplotlib.lines import Line2D
from matplotlib.patches import Polygon, Rectangle

from ..core import GRID, INK, NAMES, exact, new_figure, short

ID = "medical_imaging"
KIND = "graph.line"
SUBJECT = "physics"
BANDS = ("AL",)
CONCEPTS = tuple(f"physics.{c}" for c in ("ultrasound-medical-applications", "x-ray-attenuation", "x-rays"))
NEEDS = r"medical|ultrasound|x-ray|imaging"
AVOID = r"glossary"
# tissue: density / kg m⁻³, speed of ultrasound / m s⁻¹
TISSUES = {"air": (Fraction(13, 10), 330), "water": (1000, 1500), "blood": (1060, 1570), "fat": (925, 1450),
           "muscle": (1075, 1590), "soft tissue": (1060, 1540), "bone": (1900, 4080)}
SOFT = ["water", "blood", "fat", "muscle", "soft tissue"]
# layers below the probe, then the boundary at the bottom of the second layer
LAYERS = [("fat", "muscle", "bone"), ("fat", "soft tissue", "bone"), ("soft tissue", "muscle", "bone")]


def concepts_for(p: dict) -> tuple[str, ...]:
    return ("physics.x-ray-attenuation", "physics.x-rays") if p["kind"] == "attenuation" else CONCEPTS[:1]


def _Z(t: str) -> Fraction:
    rho, c = TISSUES[t]
    return Fraction(rho) * c


def _alpha(a: str, b: str) -> Fraction:
    za, zb = _Z(a), _Z(b)
    return ((zb - za) / (zb + za)) ** 2


def _ascan(rng: random.Random) -> dict:
    first, second, _ = rng.choice(LAYERS)
    tstep = rng.choice([1, 2, 5])
    a, b = rng.randint(4, 12), rng.randint(5, 14)
    return {"band": "AL", "kind": "ascan", "first": first, "second": second, "tstep": tstep, "t1": a * tstep,
            "t2": (a + b) * tstep}


def _attenuation(rng: random.Random) -> dict:
    while True:
        hP, hQ = rng.sample(range(2, 9), 2)
        if max(hP, hQ) < Fraction(3, 2) * min(hP, hQ):
            continue
        n, k = rng.choice([2, 3]), rng.choice([2, 3])
        if max(n * hQ, k * hP) > 20:
            continue
        return {"band": "AL", "kind": "attenuation", "hvt": [hP, hQ], "I0": rng.choice([80, 160, 240, 320, 400, 640, 800]),
                "n": n, "k": k}


def _impedance(rng: random.Random) -> dict:
    while True:
        three = rng.sample(SOFT, 3)
        bounds = [[three[0], three[1]], [three[0], three[2]], [three[1], three[2]]]
        al = sorted(_alpha(a, b) for a, b in bounds)
        if al[-1] < Fraction(6, 5) * al[-2]:
            continue
        rest = [t for t in TISSUES if t not in three]
        tissues = three + rng.sample(rest, rng.choice([1, 2]))
        order = [t for t in TISSUES if t in tissues]  # the table lists tissues in a fixed order
        rng.shuffle(bounds)
        return {"band": "AL", "kind": "impedance", "tissues": order, "ask": rng.choice(order), "bounds": bounds}


def sample(rng: random.Random) -> dict:
    return {"ascan": _ascan, "attenuation": _attenuation, "impedance": _impedance}[
        rng.choice(["ascan", "attenuation", "impedance"])](rng)


# --- drawing ------------------------------------------------------------------------------------------------------

def _draw_ascan(p: dict):
    ts, t1, t2 = p["tstep"], p["t1"], p["t2"]
    steps = t2 // ts + 4
    xmax = steps * ts
    major = 10 if ts <= 2 else 20
    fig, ax = new_figure(6.8, 4.4)
    ax.set_xticks([t for t in range(0, xmax + 1, major)])
    ax.set_xticks([t for t in range(0, xmax + 1, ts)], minor=True)
    ax.set_yticks([])
    ax.grid(True, which="minor", axis="x", color=GRID, linewidth=0.45)
    ax.grid(True, which="major", axis="x", color="#a0a0a0", linewidth=0.8)
    ax.set_axisbelow(True)
    ax.set_xlim(0, xmax)
    ax.set_ylim(0, 1.3)
    w = 0.45 * ts
    ax.plot([0, xmax], [0.06, 0.06], color=INK, linewidth=1.2, zorder=2)
    for t, h, label in ((0, 1.0, "pulse sent"), (t1, 0.72, "P"), (t2, 0.5, "Q")):
        xs = [max(0, t - w), t, t + w]
        ax.add_patch(Polygon([(xs[0], 0.06), (t, h), (xs[2], 0.06)], closed=True, facecolor=INK, edgecolor=INK,
                             linewidth=1.0, zorder=3))
        ax.text(t + (0.6 * ts if t == 0 else 0), h + 0.07, label, ha="left" if t == 0 else "center", va="bottom",
                fontsize=12 if t else 10, fontweight="bold" if t else "normal", zorder=4)
    ax.set_xlabel("time / μs", fontsize=11)
    ax.set_ylabel("echo amplitude", fontsize=11)
    ax.tick_params(labelsize=9)
    a, b, c = p["first"], p["second"], "bone"
    va, vb = TISSUES[a][1], TISSUES[b][1]
    ax.set_title(f"Below the probe on the skin: {a} (speed {va} m s⁻¹), then {b} (speed {vb} m s⁻¹), then {c}.\n"
                 f"Echo P comes from the {a}–{b} boundary; echo Q from the {b}–{c} boundary.", fontsize=10, pad=10)
    return fig


def _draw_attenuation(p: dict):
    (hP, hQ), I0 = p["hvt"], p["I0"]
    xmax = max(p["n"] * hQ, p["k"] * hP, 2 * max(hP, hQ)) + 2
    fig, ax = new_figure(6.6, 4.8)
    ax.set_xticks(range(0, xmax + 1, 2))
    ax.set_xticks(range(0, xmax + 1), minor=True)
    ax.set_yticks([I0 * k // 8 for k in range(0, 9)])
    ax.set_yticks([I0 * k / 16 for k in range(0, 17)], minor=True)
    ax.grid(True, which="major", color="#a8a8a8", linewidth=0.7)
    ax.grid(True, which="minor", color=GRID, linewidth=0.4)
    ax.set_axisbelow(True)
    ax.set_xlim(0, xmax)
    ax.set_ylim(0, I0 * 1.05)
    xs = [xmax * i / 400 for i in range(401)]
    ax.plot(xs, [I0 * 2 ** (-x / hP) for x in xs], color=INK, linewidth=1.9)
    ax.plot(xs, [I0 * 2 ** (-x / hQ) for x in xs], color=INK, linewidth=1.9, linestyle=(0, (6, 3)))
    ax.set_xlabel("thickness of material x / mm", fontsize=11)
    ax.set_ylabel("intensity I / mW m⁻²", fontsize=11)
    ax.tick_params(labelsize=9)
    handles = [Line2D([], [], color=INK, linewidth=1.9, label="material P"),
               Line2D([], [], color=INK, linewidth=1.9, linestyle=(0, (6, 3)), label="material Q")]
    ax.legend(handles=handles, loc="upper right", fontsize=10, framealpha=1.0, edgecolor=INK)
    ax.set_title("X-rays through material:  I = I₀e^(−μx),   μ = 0.693 ÷ x½   (x½ is the half-value thickness)",
                 fontsize=10, pad=10)
    return fig


def _draw_impedance(p: dict):
    rows = p["tissues"]
    fig, ax = new_figure(7.0, 4.2)
    ax.set_position([0.02, 0.02, 0.96, 0.96])
    heads = ["Tissue", "Density ρ / kg m⁻³", "Speed of ultrasound c / m s⁻¹"]
    widths = [2.2, 3.0, 3.8]
    x0 = (10 - sum(widths)) / 2
    for r, cells in enumerate([heads] + [[t, exact(TISSUES[t][0]), str(TISSUES[t][1])] for t in rows]):
        y = 6.6 - r * 0.7
        x = x0
        for c, (w, v) in enumerate(zip(widths, cells)):
            ax.add_patch(Rectangle((x, y - 0.35), w, 0.7, facecolor="#e8ecef" if r == 0 or c == 0 else "white",
                                   edgecolor=INK, linewidth=1.0))
            ax.text(x + w / 2, y, v, ha="center", va="center", fontsize=10.5, fontweight="bold" if r == 0 else "normal")
            x += w
    yb = 6.6 - (len(rows) + 1) * 0.7 - 0.2
    ax.text(5, yb, "acoustic impedance  Z = ρc", ha="center", va="center", fontsize=10.5)
    ax.text(5, yb - 0.6, "fraction of the intensity reflected at a boundary  α = (Z₂ − Z₁)² ÷ (Z₂ + Z₁)²", ha="center",
            va="center", fontsize=10.5)
    ax.set_xlim(0, 10)
    ax.set_ylim(yb - 1.0, 7.1)
    ax.axis("off")
    return fig


def draw(p: dict):
    return {"ascan": _draw_ascan, "attenuation": _draw_attenuation, "impedance": _draw_impedance}[p["kind"]](p)


# --- questions ----------------------------------------------------------------------------------------------------

SETTINGS = ["in a physics lesson", "for an A Level homework", "on a visit to a hospital in Kigali", "for a revision exercise",
            "at the science club", "while revising medical physics", "for a class test", "in a lesson on medical imaging"]


def _forms(v: Fraction, unit: str, extra=()) -> list[str]:
    x = exact(v)
    forms = short("_", x).accepted
    for n in list(forms):
        for u in (unit, *extra):
            for f in (f"{n} {u}", f"{n}{u}"):
                if f not in forms:
                    forms.append(f)
    return forms


def _sci(v: Fraction) -> list[str]:
    """3 and 4 significant figures in standard form, as students write them: 1.34 × 10⁶, 1.34 x 10^6, 1.34e6."""
    e = int(math.floor(math.log10(float(v))))
    out = []
    for n in (3, 4):
        m = f"{float(v) / 10 ** e:.{n - 1}f}"
        sup = str(e).translate(str.maketrans("0123456789-", "⁰¹²³⁴⁵⁶⁷⁸⁹⁻"))
        out += [f"{m} × 10{sup}", f"{m} × 10^{e}", f"{m}×10^{e}", f"{m} x 10^{e}", f"{m}x10^{e}", f"{m}e{e}", f"{m}E{e}"]
    return out


def _ascan_questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    a, b = p["first"], p["second"]
    d1 = Fraction(TISSUES[a][1] * p["t1"], 2000)
    d2 = Fraction(TISSUES[b][1] * (p["t2"] - p["t1"]), 2000)
    return [
        short(f"{who} studied this ultrasound A-scan {rng.choice(SETTINGS)}. Using distance = speed × time, and "
              f"remembering the pulse travels down and back, what is the thickness of the {a} layer, in mm?", exact(d1),
              _forms(d1, "mm", ["millimetres"])),
        short(f"From the A-scan, what is the thickness of the {b} layer between the {a} and the bone, in mm?", exact(d2),
              _forms(d2, "mm", ["millimetres"])),
        short(f"From the A-scan, how far below the skin is the boundary between the {b} and the bone, in mm?",
              exact(d1 + d2), _forms(d1 + d2, "mm", ["millimetres"])),
    ]


def _attenuation_questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    (hP, hQ), I0, n, k = p["hvt"], p["I0"], p["n"], p["k"]
    after = Fraction(I0, 2 ** n)
    target = Fraction(I0, 2 ** k)
    mu = Fraction(693, 1000) / hP
    unit = ["mW m⁻²", "mW/m²", "mW/m^2", "mW m^-2"]
    return [
        short(f"{who} measured how the intensity of an X-ray beam falls through materials P and Q {rng.choice(SETTINGS)}. "
              f"What is the half-value thickness of material P?", hP, _forms(Fraction(hP), "mm", ["millimetres"])),
        short(f"An X-ray beam of intensity {I0} mW m⁻² passes through {n * hQ} mm of material Q. What is its intensity "
              f"afterwards?", exact(after), _forms(after, unit[0], unit[1:])),
        short(f"What thickness of material P reduces the X-ray intensity from {I0} mW m⁻² to {exact(target)} mW m⁻²?",
              k * hP, _forms(Fraction(k * hP), "mm", ["millimetres"])),
        short("Using μ = 0.693 ÷ x½, what is the linear attenuation coefficient of material P, in mm⁻¹?", exact(mu),
              _forms(mu, "mm⁻¹", ["mm^-1", "per mm", "/mm"])),
    ]


def _impedance_questions(p: dict, rng: random.Random) -> list:
    from ..core import Question
    who = rng.choice(NAMES)
    t = p["ask"]
    Z = _Z(t)
    names = {f"{a}–{b}": _alpha(a, b) for a, b in p["bounds"]}
    top = max(names, key=names.get)
    options = list(names)
    rng.shuffle(options)
    units = ["kg m⁻² s⁻¹", "kg m^-2 s^-1", "kg/m²/s", "kg/(m² s)"]
    zf = _forms(Z, units[0], units[1:])
    if Z >= 1000:
        zf += [f for f in _sci(Z) if f not in zf]
    return [
        short(f"{who} used this table of ultrasound data {rng.choice(SETTINGS)}. Using Z = ρc, what is the acoustic "
              f"impedance of {t}, in kg m⁻² s⁻¹?", exact(Z), zf),
        Question("mcq", "Using the table of ultrasound data and the formulas printed with it, at which of these boundaries "
                        "is the greatest fraction of the ultrasound intensity reflected?", str(options.index(top)), options),
    ]


def questions(p: dict, rng: random.Random) -> list:
    return {"ascan": _ascan_questions, "attenuation": _attenuation_questions,
            "impedance": _impedance_questions}[p["kind"]](p, rng)
