"""The electromagnetic spectrum (UP): its seven regions as a band, radio waves at one end or the
other, one region left blank, and an arrow for increasing frequency or increasing wavelength. The
missing region (typed: any list of regions would give it away, six being on the figure), the region
at an extreme, and the region a use or a danger belongs to.

The band's order and the arrow agree: frequency rises from radio waves to gamma rays and wavelength
falls. The use question never offers a neighbouring region's use, since neighbours share some uses
(infrared and microwaves both heat food; X-rays and gamma rays both treat cancer).
"""
from __future__ import annotations

import random

from matplotlib.patches import Rectangle

from ..core import FILL_2, INK, NAMES, mcq, new_figure, short

ID = "em_spectrum"
KIND = "physics.wave"
SUBJECT = "physics"
BANDS = ("UP",)  # the lower-secondary physics topics never reach the spectrum
CONCEPTS = tuple(f"physics.{c}" for c in ("electromagnetic-spectrum", "light-and-optics"))
# Not sound, mechanical waves, or lens, eye and refraction chapters.
AVOID = r"block diagram|analog|stars and the universe|\bsound|seismic|ultrasound|ripple|refraction|lens|human eye|interference|mechanical waves|optical instruments|reflection of light"
# A topic whose sections the book lists is reached only if one names what this figure teaches.
NEEDS = r"electromagnetic|spectrum|radio|optical fib|light|infra-?red|waves?\b|x-ray|gamma|ultraviolet|microwave"
# Two orders, two arrows and seven blanks: 28 figures in all, so 60 seeds cannot show 40.
MIN_VARIETY = 22
EM = ["radio waves", "microwaves", "infrared", "visible light", "ultraviolet", "X-rays", "gamma rays"]
SHORT = {"radio waves": "radio\nwaves", "microwaves": "micro-\nwaves", "visible light": "visible\nlight", "ultraviolet": "ultra-\nviolet", "gamma rays": "gamma\nrays"}
# What each region is used for, as a learner meets it; heating food is microwaves' only (infrared, its
# neighbour, grills), and a use question never offers a neighbour's use.
USES = {"radio waves": ["broadcasting radio and television programmes"],
        "microwaves": ["carrying mobile phone signals to and from the masts", "heating and cooking food in an oven"],
        "infrared": ["sending signals from a TV remote control", "thermal cameras that see warm bodies at night"],
        "visible light": ["carrying pictures along the optical fibre of an endoscope"],
        "ultraviolet": ["making the hidden marks on bank notes glow"],
        "X-rays": ["taking pictures of broken bones"],
        "gamma rays": ["killing cancer cells in radiotherapy"]}
FORMS = {"radio waves": ["radio", "radio wave", "radiowaves", "Radio waves"],
         "microwaves": ["microwave", "micro waves", "Microwaves"],
         "infrared": ["infra-red", "infra red", "IR", "infrared radiation", "infrared waves", "Infrared"],
         "visible light": ["visible", "light", "visible spectrum", "Visible light"],
         "ultraviolet": ["ultra-violet", "ultra violet", "UV", "ultraviolet radiation", "ultraviolet light", "Ultraviolet"],
         "X-rays": ["X-ray", "x-rays", "x-ray", "X rays", "x rays", "xrays"],
         "gamma rays": ["gamma", "gamma ray", "gamma radiation", "γ-rays", "Gamma rays"]}


def sample(rng: random.Random) -> dict:
    return {"band": rng.choice(BANDS), "order": rng.choice(["radio-first", "gamma-first"]), "arrow": rng.choice(["frequency", "wavelength"]),
            "blank": rng.randrange(len(EM))}


def regions(p: dict) -> list:
    """The regions left to right, None where the blank is."""
    shown = [None if i == p["blank"] else r for i, r in enumerate(EM)]
    return shown if p["order"] == "radio-first" else shown[::-1]


def arrow_right(p: dict) -> bool:
    """Frequency rises towards gamma rays; wavelength towards radio waves."""
    return (p["arrow"] == "frequency") == (p["order"] == "radio-first")


def draw(p: dict):
    fig, ax = new_figure(7.4, 2.6)
    w = 1.4
    for k, r in enumerate(regions(p)):
        x = k * w
        ax.add_patch(Rectangle((x, 0), w, 1.3, facecolor="white" if r else FILL_2, edgecolor=INK, linewidth=1.4))
        if r is None:
            ax.text(x + w / 2, 0.65, "?", ha="center", va="center", fontsize=22, fontweight="bold")
        else:
            ax.text(x + w / 2, 0.65, SHORT.get(r, r), ha="center", va="center", fontsize=10, linespacing=1.1)
            if r == "visible light":  # its colours, red at the long-wavelength end
                colours = ["#d62728", "#ff7f0e", "#f2d21b", "#2ca02c", "#1f77b4", "#3b1f8f", "#7b2cbf"]
                if p["order"] == "gamma-first":
                    colours = colours[::-1]
                for j, c in enumerate(colours):
                    ax.add_patch(Rectangle((x + 0.1 + j * (w - 0.2) / 7, 0.08), (w - 0.2) / 7, 0.16, facecolor=c, edgecolor="none"))
    end = 7 * w
    tail, head = (0.3, end - 0.3) if arrow_right(p) else (end - 0.3, 0.3)
    ax.annotate("", xy=(head, -0.45), xytext=(tail, -0.45), arrowprops=dict(arrowstyle="-|>", color=INK, lw=1.8, mutation_scale=20))
    ax.text(end / 2, -0.65, f"increasing {p['arrow']}", ha="center", va="top", fontsize=11)
    ax.set_xlim(-0.1, end + 0.1)
    ax.set_ylim(-1.2, 1.4)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


SOURCES = ["on the board", "on a revision poster", "in a science magazine", "on a worksheet", "in the textbook", "in a quiz"]
EXTREMES = {"longest wavelength": "radio waves", "lowest frequency": "radio waves", "least energy": "radio waves",
            "shortest wavelength": "gamma rays", "highest frequency": "gamma rays", "most energy": "gamma rays"}


def questions(p: dict, rng: random.Random) -> list:
    name, friend = rng.sample(NAMES, 2)
    missing = EM[p["blank"]]
    first = short(f"{name} saw the electromagnetic spectrum {rng.choice(SOURCES)} with one region missing. Which region is missing?",
                  missing, [missing, *FORMS[missing]])
    # Typed, like the missing region: a list of regions would name the blank among its options.
    prop = rng.choice(list(EXTREMES))
    key = EXTREMES[prop]
    extreme = short(f"{friend} asks: which region of the spectrum has the {prop}?", key, [key, *FORMS[key]])
    # The use of the region marked "?": the figure, and the missing region, are needed to answer.
    k = p["blank"]
    far = rng.sample([i for i in range(len(EM)) if abs(i - k) > 1], 3)
    use = mcq("What is the region marked ? used for?", rng.choice(USES[EM[k]]), [rng.choice(USES[EM[i]]) for i in far], rng)
    return [first, extreme, use]
