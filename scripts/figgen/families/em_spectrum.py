"""The electromagnetic spectrum (UP): its seven regions as a band, radio waves at one end or the
other, one region left blank, and an arrow for increasing frequency or increasing wavelength. The
missing region (typed: any list of regions would give it away, six being on the figure), the region
at an extreme, and the region a use or a danger belongs to.

The band's order and the arrow agree: frequency rises from radio waves to gamma rays and wavelength
falls. A use question never offers a neighbouring region, since neighbours share some uses (infrared
and microwaves both heat food; X-rays and gamma rays both treat cancer).
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
AVOID = r"\bsound|seismic|ultrasound|ripple|refraction|lens|human eye|interference|mechanical waves|optical instruments"
# Two orders, two arrows and seven blanks: 28 figures in all, so 60 seeds cannot show 40.
MIN_VARIETY = 22
EM = ["radio waves", "microwaves", "infrared", "visible light", "ultraviolet", "X-rays", "gamma rays"]
SHORT = {"radio waves": "radio\nwaves", "microwaves": "micro-\nwaves", "visible light": "visible\nlight", "ultraviolet": "ultra-\nviolet", "gamma rays": "gamma\nrays"}
USES = [("radio waves", "Which region is used to broadcast radio and television programmes?"),
        ("microwaves", "Which region carries mobile phone signals to and from the masts?"),
        ("microwaves", "Which region is used to cook food from the inside?"),
        ("infrared", "Which region does a TV remote control use?"),
        ("infrared", "Which region does a thermal camera detect, to see warm bodies at night?"),
        ("visible light", "Which region carries pictures along the optical fibre of an endoscope?"),
        ("ultraviolet", "Which region makes the hidden marks on a bank note glow?"),
        ("ultraviolet", "Which region in sunlight causes sunburn and skin cancer?"),
        ("X-rays", "Which region is used to take pictures of broken bones?"),
        ("gamma rays", "Which region is used to kill cancer cells in radiotherapy?")]
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
    prop = rng.choice(list(EXTREMES))
    key = EXTREMES[prop]
    other = "gamma rays" if key == "radio waves" else "radio waves"
    middle = rng.sample(EM[1:6], 2)
    extreme = mcq(f"Which region of the spectrum has the {prop}?", key, [other, *middle], rng)
    region, stem = rng.choice(USES)
    k = EM.index(region)
    far = [r for i, r in enumerate(EM) if abs(i - k) > 1]
    use = mcq(f"{friend} asks: {stem}", region, rng.sample(far, 3), rng)
    return [first, extreme, use]
