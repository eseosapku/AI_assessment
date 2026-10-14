"""Energy transfer diagrams (LS, UP): a Sankey diagram for a device a learner knows, the energy in and
the useful and wasted energy out in joules, the arrows' widths to scale, one value shown as "?". The
missing energy, the efficiency, the useful form, and at Upper Secondary the input power for a stated
time.

Energy is conserved and the efficiency is a whole number per cent.
"""
from __future__ import annotations

import random
from fractions import Fraction

from matplotlib.patches import Polygon

from ..core import FILL, FILL_2, INK, NAMES, article, exact, mcq, measure, new_figure, short

ID = "energy_sankey"
KIND = "process.flow"
SUBJECT = "physics"
BANDS = ("LS", "UP")
CONCEPTS = tuple(f"physics.{c}" for c in ("energy-conversions-and-transfers", "conservation-of-energy", "energy", "power"))
# Energy transfers and efficiency: not waves, light, nuclei, fields, signals or forces chapters.
AVOID = (r"electrostatic|static electricity|environmental|friction|induction|magnet|plant growth|telecommunication|resistors|signals|agriculture|optical fib|radioactiv|nuclear|nuclei|changes of state|sound|hearing|motor effect|turning|forces and matter|climate|earthquake|field|oscillation|orbit|wave|relativity|stellar|projectile|light"
         r"|^chapter 9: heat transfer$|^heat and temperature$|^current electricity|^electrical quantities$")
# the device, the energy in, the useful output, the wasted outputs, and its efficiency range (%)
DEVICES = [("filament lamp", "electrical", "light", ["heat"], (5, 15)), ("LED lamp", "electrical", "light", ["heat"], (40, 80)),
           ("electric kettle", "electrical", "heat in the water", ["heat to the air", "sound"], (80, 95)),
           ("solar panel", "light", "electrical", ["heat"], (15, 25)), ("charcoal stove", "chemical", "heat in the pot", ["heat to the air"], (20, 40)),
           ("electric motor", "electrical", "kinetic", ["heat", "sound"], (60, 85)), ("radio", "electrical", "sound", ["heat"], (5, 20)),
           ("moto engine", "chemical", "kinetic", ["heat", "sound"], (20, 30))]
# The options: these forms, and the figure's own named ones ("heat in the water"), never another device's.
FORMS = ["light", "heat", "sound", "kinetic", "electrical", "chemical"]
# Powers each device really works at, in watts (P3f review: a 200 W LED lamp).
POWER = {"filament lamp": [40, 60, 100], "LED lamp": [5, 8, 10, 20], "electric kettle": [1000, 1500, 2000, 2500],
         "solar panel": [100, 200, 250, 400], "charcoal stove": [1000, 2000, 2500, 4000], "electric motor": [50, 100, 200, 250, 500],
         "radio": [4, 5, 8, 10, 20, 25], "moto engine": [4000, 5000, 8000, 10000]}


def avoid_for(p: dict) -> str:
    """Only the electric motor's diagram belongs in the motor and generator chapters."""
    return AVOID + ("" if p["device"] == "electric motor" else "|motor|generator")


def sample(rng: random.Random) -> dict:
    while True:
        device, source, useful, wasted, (lo, hi) = rng.choice(DEVICES)
        total = rng.choice([100, 200, 400, 500, 1000, 2000])
        eff = rng.choice([e for e in range(lo, hi + 1) if (total * e) % 100 == 0] or [0])
        if not eff:
            continue
        u = total * eff // 100
        rest = total - u
        if len(wasted) == 2:
            small = rng.choice([v for v in range(rest // 10, rest // 3 + 1) if v % 5 == 0] or [0])
            if not small:
                continue
            flows = [[useful, u, "useful"], [wasted[0], rest - small, "wasted"], [wasted[1], small, "wasted"]]
        else:
            flows = [[useful, u, "useful"], [wasted[0], rest, "wasted"]]
        hidden = rng.randrange(len(flows) + 1)
        return {"band": rng.choice(BANDS), "device": device, "source": source, "input": total, "flows": flows, "hidden": hidden}


def draw(p: dict):
    total = p["input"]
    scale = 3.0 / total
    fig, ax = new_figure(7.0, 4.4)
    Hin = total * scale
    label = lambda i, v, what: f"? J {what}" if p["hidden"] == i else f"{v} J {what}"  # noqa: E731
    # The input band, then the useful arrow straight on along the top, and the wasted ones turning down.
    ax.add_patch(Polygon([(0, 0), (4, 0), (4, Hin), (0, Hin)], closed=True, facecolor=FILL_2, edgecolor=INK, linewidth=1.2))
    ax.text(-0.2, Hin / 2, label(0, total, p["source"]), ha="right", va="center", fontsize=10)
    y = Hin
    for i, (what, v, kind) in enumerate(p["flows"], 1):
        h = v * scale
        top, bot = y, y - h
        if kind == "useful":
            ax.add_patch(Polygon([(4, bot), (8, bot), (8, bot - 0.25), (9, (top + bot) / 2), (8, top + 0.25), (8, top), (4, top)], closed=True,
                                 facecolor=FILL, edgecolor=INK, linewidth=1.2))
            ax.text(9.2, (top + bot) / 2, label(i, v, what), ha="left", va="center", fontsize=10)
        else:
            # The lowest band turns down first and each one above it further on, so no drop crosses a band.
            n_wasted = sum(1 for _, _, kk in p["flows"] if kk == "wasted")
            j = sum(1 for _, _, kk in p["flows"][:i - 1] if kk == "wasted")
            x0 = 4.4 + 2.2 * (n_wasted - 1 - j)
            w = h
            ax.add_patch(Polygon([(4, top), (x0 + w, top), (x0 + w, -2.0), (x0 + w + 0.25, -2.0), (x0 + w / 2, -2.8),
                                  (x0 - 0.25, -2.0), (x0, -2.0), (x0, bot), (4, bot)], closed=True, facecolor="white", edgecolor=INK, linewidth=1.2))
            # Each wasted label on its own row, so two never meet.
            ax.text(x0 + w / 2, -3.0 - 0.9 * (n_wasted - 1 - j), label(i, v, what), ha="center", va="top", fontsize=10)
        y = bot
    ax.text(2.0, Hin + 0.35, p["device"], ha="center", va="bottom", fontsize=11, fontweight="bold")
    ax.set_xlim(-5.0, 14.0)
    ax.set_ylim(-5.2, Hin + 1.2)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def questions(p: dict, rng: random.Random) -> list:
    name = rng.choice(NAMES)
    values = [p["input"]] + [v for _, v, _ in p["flows"]]
    hid = values[p["hidden"]]
    useful_name = next(w for w, _, k in p["flows"] if k == "useful")
    useful = sum(v for _, v, k in p["flows"] if k == "useful")
    eff = Fraction(100 * useful, p["input"])
    others = [f for f in FORMS if f != useful_name and f not in [w for w, _, _ in p["flows"]]]
    if useful_name.startswith("heat"):  # a kettle's output is heat, and a stove's pot holds water: no second right answer
        others = [f for f in others if not f.startswith("heat")]
    rng.shuffle(others)
    qs = [
        short(f"{name} drew this energy transfer diagram for {article(p['device'])} {p['device']}. What is the missing amount of energy?", hid,
              measure(hid, "J")),
        short(f"What is the efficiency of the {p['device']}, as a percentage?", exact(eff), [f"{exact(eff)}%", f"{exact(eff)} %"]),
        mcq(f"What is the useful energy output of the {p['device']}?", useful_name,
            [w for w, _, k in p["flows"] if k == "wasted"] + others, rng),
    ]
    powers = [P for P in POWER[p["device"]] if (Fraction(p["input"], P) * 100).denominator == 1]
    if p["band"] == "UP" and powers:
        P = rng.choice(powers)
        t = Fraction(p["input"], P)
        qs.append(short(f"The {p['device']} takes in energy at {P} W. How long does it take to take in the energy in the diagram, in seconds?", exact(t),
                        measure(t, "s")))
    return qs
