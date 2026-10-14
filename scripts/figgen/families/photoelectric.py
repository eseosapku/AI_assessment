"""The photoelectric effect (UP, AL): the greatest kinetic energy of the electrons (eV) against the frequency
of the light (10¹⁴ Hz) for a metal, a straight line of gradient h (about 4 × 10⁻¹⁵ eV s, so 0.4 eV per
10¹⁴ Hz) from the threshold frequency, extended back to the energy axis to show the work function. The
threshold frequency, the work function, the energy at a stated frequency, and at AL the gradient.

The work functions are the real ones rounded to a gridline (caesium 2.0, sodium 2.4, calcium 2.8,
magnesium 3.6, zinc 4.4 eV and others), so both intercepts lie on gridlines.
"""
from __future__ import annotations

import random
from fractions import Fraction

from ..core import GRID, INK, NAMES, exact, measure, new_figure, short

ID = "photoelectric"
KIND = "graph.line"
SUBJECT = "physics"
BANDS = ("UP", "AL")
CONCEPTS = tuple(f"physics.{c}" for c in ("photoelectric-effect", "photon-and-light-energy", "wave-particle-duality",
                                          "spectra-and-quantum-physics"))
AVOID = r"radioactiv|nuclear|decay|circuit|lens|mirror|\bwaves$|superposition|medical|stellar|electromagnetic spectrum"
# Threshold frequencies (10¹⁴ Hz) from real work functions rounded to a gridline of 0.4 eV.
METALS = {"caesium": 5, "sodium": 6, "potassium": 6, "calcium": 7, "lithium": 7, "magnesium": 9, "aluminium": 10, "zinc": 11, "copper": 12}
H = Fraction(4, 10)  # eV per 10¹⁴ Hz


def sample(rng: random.Random) -> dict:
    metal = rng.choice(list(METALS))
    return {"band": rng.choice(BANDS), "metal": metal, "f0": METALS[metal], "fmax": rng.choice([15, 16, 18, 20])}


def energy(p: dict, f: float) -> float:
    return float(H) * (f - p["f0"])


def draw(p: dict):
    fmax, f0 = p["fmax"], p["f0"]
    top = float(H) * (fmax - f0)
    lo = -float(H) * 12
    fig, ax = new_figure(6.2, 4.8)
    ax.set_xticks(range(0, fmax + 1, 2))
    ax.set_xticks(range(0, fmax + 1), minor=True)
    ticks = [Fraction(4, 10) * k for k in range(-12, int(top / 0.4) + 2)]
    ax.set_yticks([float(t) for t in ticks if Fraction(t * 10).denominator == 1 and int(t * 10) % 8 == 0],
                  [exact(t) for t in ticks if Fraction(t * 10).denominator == 1 and int(t * 10) % 8 == 0])
    ax.set_yticks([float(t) for t in ticks], minor=True)
    ax.grid(True, which="both", color=GRID, linewidth=0.5)
    ax.set_axisbelow(True)
    ax.set_xlim(0, fmax)
    ax.set_ylim(lo, float(ticks[-1]))
    ax.plot([0, fmax], [0, 0], color=INK, linewidth=0.9)
    ax.plot([f0, fmax], [0, top], color=INK, linewidth=1.9)
    ax.plot([0, f0], [-float(H) * f0, 0], color=INK, linewidth=1.1, linestyle=(0, (5, 4)))  # extended back to the energy axis
    ax.set_xlabel("Frequency of the light (× 10¹⁴ Hz)")
    ax.set_ylabel("Greatest kinetic energy (eV)")
    ax.tick_params(labelsize=8)
    return fig


def _freq(v) -> list[str]:
    s = exact(v)
    return [s, f"{s} × 10¹⁴ Hz", f"{s} × 10¹⁴", f"{s} x 10^14 Hz", f"{s}x10^14", f"{s} x 10^14", f"{s}e14"]


def questions(p: dict, rng: random.Random) -> list:
    name, friend = rng.sample(NAMES, 2)
    f0 = Fraction(p["f0"])
    f1 = rng.choice([f for f in range(p["f0"] + 1, p["fmax"] + 1)])
    qs = [short(f"{name} shone light of different frequencies on {p['metal']}. What is the threshold frequency, in units of 10¹⁴ Hz?",
                exact(f0), _freq(f0)),
          short(f"What is the work function of {p['metal']}, in eV?", exact(H * f0), measure(H * f0, "eV") + [f"{exact(H * f0)} electronvolts"]),
          short(f"{friend} uses light with a frequency of {f1} × 10¹⁴ Hz. What is the greatest kinetic energy of the electrons, in eV?",
                exact(H * (f1 - f0)), measure(H * (f1 - f0), "eV"))]
    if p["band"] == "AL":
        qs.append(short("What is the gradient of the line, in eV per 10¹⁴ Hz?", exact(H), [exact(H), ".4", "0.4 eV per 10^14 Hz"]))
    return qs
