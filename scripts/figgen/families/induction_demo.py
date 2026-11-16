"""Electromagnetic induction (LS, UP), for Rwanda S3 "Introduction to Electromagnetic Induction" and the induction
chapters that teach the same demonstrations. Two kinds:

- magnet: a reference set-up (the N pole pushed into a coil, the centre-zero meter's needle drawn to the right) and four
  lettered set-ups, each a bar magnet by a coil with an arrow and a printed speed, or "held still"; no needle drawn in
  them. Asks in which set-up no current is induced, which way the needle moves in a set-up (from the reference: pulling
  the N pole out, or pushing the S pole in, turns it round), and in which set-up the current is largest (fastest).
- ac: the output of an a.c. generator, e.m.f. against time over two cycles, each quarter-cycle on a gridline; f = 1 ÷ T
  printed. Asks the peak e.m.f., the period and the frequency.
"""
from __future__ import annotations

import math
import random
from fractions import Fraction

from matplotlib.patches import Circle, Rectangle

from ..core import GRID, INK, NAMES, exact, mcq, measure, new_figure, short
from ._bio_parts import letter_choice

ID = "induction_demo"
KIND = "physics.field"
SUBJECT = "physics"
BANDS = ("LS", "UP")
CONCEPTS = tuple(f"physics.{c}" for c in ("electromagnetic-induction", "generators", "alternating-current", "ac-circuits"))
# A topic whose sections the book lists is reached only if one names induction, generators or alternating current.
NEEDS = r"induc|generator|dynamo|alternating|a\.c\b|e\.m\.f|emf"
AVOID = (r"glossary|transformer|transmission|motor effect|electric motors|electronic|capacit|rectif|telecommunication|"
         r"signals|electrostatic|kirchhoff|magnetic effect of current|^chapter 23: magnetism$|^magnetism$")


def concepts_for(p: dict) -> tuple[str, ...]:
    c = "physics."
    if p["kind"] == "magnet":
        return (c + "electromagnetic-induction",)
    return (c + "electromagnetic-induction", c + "generators", c + "alternating-current", c + "ac-circuits")


LETTER_SETS = ["ABCD", "PQRS", "WXYZ", "KLMN"]
SPEEDS = [1, 2, 3, 4, 5, 6, 8]


def needle(face: str, motion: str) -> str:
    """Pushing the N pole in turns the needle right (the reference); pulling it out, or using the S pole, turns it round."""
    if motion == "still":
        return "it stays at zero"
    right = (face == "N") == (motion == "in")
    return "to the right" if right else "to the left"


def sample(rng: random.Random) -> dict:
    band = rng.choice(BANDS)
    if rng.random() < 0.55:
        while True:
            setups = [[rng.choice("NS"), rng.choice(["in", "out"]), s] for s in rng.sample(SPEEDS, 3)]
            setups.append([rng.choice("NS"), "still", 0])
            rng.shuffle(setups)
            if any(needle(f, m) == "to the left" for f, m, _ in setups) and any(needle(f, m) == "to the right" for f, m, _ in setups):
                break
        letters = rng.choice(LETTER_SETS)
        moving = [L for L, (f, m, _) in zip(letters, setups) if m != "still"]
        return {"band": band, "kind": "magnet", "setups": [[L] + s for L, s in zip(letters, setups)], "ask": rng.choice(moving)}
    return {"band": band, "kind": "ac", "peak": rng.choice([2, 3, 4, 5, 6, 8, 10, 12]), "period": rng.choice([10, 20, 40, 50, 100])}


# --- drawing --------------------------------------------------------------------------------------------------------

def _setup(ax, x0: float, y0: float, face: str, motion: str, speed: int, title: str, show_needle: bool) -> None:
    """One set-up in a 4.4 x 2.6 box at (x0, y0): magnet, coil, meter."""
    ax.add_patch(Rectangle((x0, y0), 4.4, 2.6, facecolor="none", edgecolor="#999999", linewidth=0.8))
    ax.text(x0 + 0.15, y0 + 2.35, title, ha="left", va="center", fontsize=10.5, fontweight="bold")
    # the magnet, its facing pole towards the coil on its right
    other = "S" if face == "N" else "N"
    for k, (pole, fill) in enumerate(((other, "white"), (face, "#d6dade"))):
        ax.add_patch(Rectangle((x0 + 0.25 + 0.55 * k, y0 + 1.05), 0.55, 0.45, facecolor=fill, edgecolor=INK, linewidth=1.0))
        ax.text(x0 + 0.525 + 0.55 * k, y0 + 1.275, pole, ha="center", va="center", fontsize=10, fontweight="bold")
    # the coil: a tube with its turns
    cx = x0 + 1.75
    ax.add_patch(Rectangle((cx, y0 + 0.95), 1.0, 0.65, facecolor="#f1e6d0", edgecolor=INK, linewidth=1.0))
    for k in range(6):
        ax.plot([cx + 0.1 + 0.16 * k, cx + 0.18 + 0.16 * k], [y0 + 0.95, y0 + 1.6], color=INK, linewidth=0.8)
    # the meter: a dial with its zero at the top, wired to the coil's ends
    mx, my = x0 + 3.6, y0 + 0.75
    ax.plot([cx + 1.0, mx - 0.38], [y0 + 1.3, my + 0.1], color=INK, linewidth=0.9)
    ax.plot([cx + 0.05, cx + 0.05, mx, mx], [y0 + 0.95, y0 + 0.3, y0 + 0.3, my - 0.38], color=INK, linewidth=0.9)
    ax.add_patch(Circle((mx, my), 0.38, facecolor="white", edgecolor=INK, linewidth=1.0))
    ax.plot([mx, mx], [my + 0.26, my + 0.34], color=INK, linewidth=0.9)
    if show_needle:
        ax.plot([mx, mx + 0.24], [my - 0.1, my + 0.2], color=INK, linewidth=1.4)
    # the motion
    if motion == "still":
        ax.text(x0 + 0.8, y0 + 0.55, "held still", ha="center", va="center", fontsize=10)
    else:
        a, b = (x0 + 0.35, x0 + 1.3) if motion == "in" else (x0 + 1.3, x0 + 0.35)
        ax.annotate("", xy=(b, y0 + 0.65), xytext=(a, y0 + 0.65),
                    arrowprops=dict(arrowstyle="-|>", color=INK, lw=1.6, mutation_scale=14))
        ax.text(x0 + 0.82, y0 + 0.33, f"{speed} cm/s", ha="center", va="center", fontsize=10)


def _draw_magnet(p: dict):
    fig, ax = new_figure(7.6, 6.4)
    _setup(ax, 0.0, 6.0, "N", "in", 2, "Reference: the needle moves to the right", True)
    ax.text(4.65, 7.3, "N pole pushed into the coil;\nthe meter's zero is in the middle", ha="left", va="center",
            fontsize=9.5)
    for k, (L, face, motion, speed) in enumerate(p["setups"]):
        _setup(ax, (k % 2) * 4.7, 3.1 - (k // 2) * 2.9, face, motion, speed, f"set-up {L}", False)
    ax.set_xlim(-0.1, 9.2)
    ax.set_ylim(0.1, 8.7)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def _draw_ac(p: dict):
    fig, ax = new_figure(7.0, 4.4)
    T, V = p["period"], p["peak"]
    q = Fraction(T, 4)
    ax.set_xlim(0, 2 * T)
    ax.set_xticks([float(q * k) for k in range(0, 9, 2)])
    ax.set_xticks([float(q * k) for k in range(9)], minor=True)
    step = 1 if V <= 6 else 2
    top = V + step
    ax.set_ylim(-top, top)
    ax.set_yticks(range(-top, top + 1, step))
    ax.grid(True, which="both", color=GRID, linewidth=0.6)
    ax.set_axisbelow(True)
    ts = [2 * T * i / 600 for i in range(601)]
    ax.plot(ts, [V * math.sin(2 * math.pi * t / T) for t in ts], color=INK, linewidth=1.8, gid="emf")
    ax.axhline(0, color=INK, linewidth=0.8)
    ax.set_xlabel("Time (ms)", fontsize=10.5)
    ax.set_ylabel("e.m.f. (V)", fontsize=10.5)
    ax.set_title("Output of an a.c. generator      frequency f = 1 ÷ T,  where T is the period", fontsize=10)
    ax.tick_params(labelsize=9)
    return fig


def draw(p: dict):
    return _draw_magnet(p) if p["kind"] == "magnet" else _draw_ac(p)


# --- questions ------------------------------------------------------------------------------------------------------

SETTINGS = {"LS": ["in a Senior 3 physics lesson", "at the science club in Huye", "for homework", "while revising in Rubavu",
                   "for a class test in Kigali"],
            "UP": ["in a physics lesson", "at the science club in Musanze", "for homework", "while revising in Huye",
                   "for a class test in Kigali"]}


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    setting = rng.choice(SETTINGS[p["band"]])
    if p["kind"] == "magnet":
        s = {L: (f, m, v) for L, f, m, v in p["setups"]}
        letters = sorted(s)
        still = next(L for L, (_, m, _) in s.items() if m == "still")
        fastest = max(s, key=lambda L: s[L][2])
        L = p["ask"]
        return [letter_choice(f"{who} tried these set-ups with a magnet, a coil and a meter {setting}. In which set-up is "
                              f"no current induced in the coil?", still, letters),
                mcq(f"Using the reference set-up, which way does the meter's needle move in set-up {L}?", needle(*s[L][:2]),
                    ["to the right", "to the left", "it stays at zero"], rng),
                letter_choice("In which set-up is the induced current largest?", fastest, letters)]
    T, V = p["period"], p["peak"]
    f = Fraction(1000, T)
    return [short(f"{who} looked at the output of this generator {setting}. What is the peak e.m.f., in volts?", V,
                  measure(V, "V")),
            short("What is the period of the alternating e.m.f., in milliseconds?", T, measure(T, "ms")),
            short("What is the frequency of the alternating e.m.f., in hertz?", exact(f), measure(f, "Hz"))]
