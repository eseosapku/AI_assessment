"""Magnification (LS, UP, AL): a drawing of a cell or organelle above a millimetre ruler, dashed lines from its
ends to the ruler, and either the magnification stated or a scale bar. The image's length on the ruler, the
actual length in µm, and from a scale bar the magnification.

The ends fall on whole millimetres; the specimen's actual size is a real one (a cheek cell 40–80 µm, a red
blood cell 6–9 µm, a bacterium 1–5 µm); a scale bar's length gives the magnification exactly.
"""
from __future__ import annotations

import math
import random
from fractions import Fraction

from matplotlib.patches import Circle, Ellipse, FancyBboxPatch

from ..core import INK, NAMES, exact, new_figure, short

ID = "magnification"
KIND = "instrument.reading"
SUBJECT = "biology"
BANDS = ("LS", "UP", "AL")
CONCEPTS = tuple(f"biology.{c}" for c in ("cell-structure", "animal-plant-cells", "electron-microscopes", "cell-importance"))
AVOID = r"enzyme|genetic|inherit|immun|disease|reproduc|excretion|digest|photosynth|respiration|hormone|ecolog|population|biological molecules|mitotic|transport|division|classification|living things|movement|gene technology|protein synthesis|skeleton|gas exchange|testing for"
# specimen: its real size (µm), the magnifications it is drawn at, and its shape
SPECIMENS = {"a cheek cell": ((40, 80), [400, 500, 1000], "blob"), "a palisade cell": ((40, 120), [400, 500], "palisade"),
             "an onion epidermis cell": ((100, 300), [100, 200], "brick"), "a red blood cell": ((6, 9), [4000, 5000], "disc"),
             "a bacterium": ((1, 5), [10000, 20000], "rod"), "a mitochondrion": ((0.5, 5), [10000, 20000], "mito"),
             "a pollen grain": ((20, 60), [500, 1000], "pollen")}
BARS = [1, 2, 5, 10, 20, 50, 100]  # µm


def sample(rng: random.Random) -> dict:
    band = rng.choice(BANDS)
    while True:
        specimen = rng.choice(list(SPECIMENS))
        (lo, hi), mags, _ = SPECIMENS[specimen]
        mag = rng.choice(mags)
        L = rng.randint(20, 75)
        actual = Fraction(L * 1000, mag)
        if not lo <= actual <= hi or (actual * 100).denominator != 1:
            continue
        bar = None
        if band != "LS" and rng.random() < 0.6:
            fits = [b for b in BARS if (b * mag) % 1000 == 0 and 8 <= b * mag // 1000 <= 30]
            if not fits:
                continue
            b = rng.choice(fits)
            bar = {"um": b, "mm": b * mag // 1000}
        start = rng.randint(3, 10)
        return {"band": band, "specimen": specimen, "mag": mag, "start": start, "end": start + L, "bar": bar}


def _shape(ax, kind, x0, x1, y):
    L = x1 - x0
    cx = (x0 + x1) / 2
    fill = "#e6ece4"
    if kind == "blob":
        pts = [(cx + L / 2 * math.cos(t), y + L * 0.32 * math.sin(t) * (1 + 0.08 * math.cos(5 * t)))
               for t in [k * math.pi / 60 for k in range(121)]]  # its ends exactly at the two marks
        from matplotlib.patches import Polygon
        ax.add_patch(Polygon(pts, closed=True, facecolor=fill, edgecolor=INK, linewidth=1.3))
        ax.add_patch(Circle((cx - L * 0.1, y + L * 0.04), L * 0.07, facecolor="#9aa3ab", edgecolor=INK, linewidth=1))
    elif kind == "palisade":
        ax.add_patch(FancyBboxPatch((x0 + 2, y - L * 0.18), L - 4, L * 0.36, boxstyle="round,pad=2", facecolor=fill, edgecolor=INK,
                                    linewidth=1.3))
        for k in range(8):
            ax.add_patch(Ellipse((x0 + L * (0.12 + 0.1 * k), y + (L * 0.12 if k % 2 else -L * 0.12)), L * 0.07, L * 0.045,
                                 facecolor="#7d8a76", edgecolor=INK, linewidth=0.6))
    elif kind == "brick":
        ax.add_patch(FancyBboxPatch((x0 + 1, y - L * 0.14), L - 2, L * 0.28, boxstyle="round,pad=1", facecolor=fill, edgecolor=INK,
                                    linewidth=1.3))
        ax.add_patch(Circle((cx + L * 0.15, y), L * 0.05, facecolor="#9aa3ab", edgecolor=INK, linewidth=1))
    elif kind == "disc":
        ax.add_patch(Circle((cx, y), L / 2, facecolor="#d9b8b8", edgecolor=INK, linewidth=1.3))
        ax.add_patch(Circle((cx, y), L / 5, facecolor="#ecd8d8", edgecolor="none"))
    elif kind == "rod":
        ax.add_patch(FancyBboxPatch((x0 + L * 0.15, y - L * 0.1), L * 0.7, L * 0.2, boxstyle=f"round,pad={L * 0.15}", facecolor=fill,
                                    edgecolor=INK, linewidth=1.3))
    elif kind == "mito":
        ax.add_patch(Ellipse((cx, y), L, L * 0.42, facecolor=fill, edgecolor=INK, linewidth=1.4))
        for k in range(5):
            x = x0 + L * (0.2 + 0.15 * k)
            ax.plot([x, x], [y - L * 0.14 * (1 if k % 2 else -1), y + L * 0.04 * (1 if k % 2 else -1)], color=INK, linewidth=1)
    else:  # pollen: a round grain with short spines inside its outline
        ax.add_patch(Circle((cx, y), L / 2, facecolor="#e8dfb8", edgecolor=INK, linewidth=1.3))
        for k in range(16):
            t = k * math.pi / 8
            ax.plot([cx + L * 0.38 * math.cos(t), cx + L * 0.48 * math.cos(t)], [y + L * 0.38 * math.sin(t), y + L * 0.48 * math.sin(t)],
                    color=INK, linewidth=0.8)


def bar_span(p: dict) -> tuple[int, int]:
    """The scale bar's ends, on whole millimetres of the ruler, clear to the right of the specimen."""
    end = p["end"]
    right = 10 * math.ceil((end + 8) / 10)
    x1 = right - 2
    return x1 - p["bar"]["mm"], x1


def draw(p: dict):
    end = p["end"]
    right = 10 * math.ceil((end + 8) / 10)
    fig, ax = new_figure(7.2, 3.8)
    L = end - p["start"]
    y = 12 + L * 0.5
    _shape(ax, SPECIMENS[p["specimen"]][2], p["start"], end, y)
    for x in (p["start"], end):
        ax.plot([x, x], [y, 7.2], color=INK, linewidth=0.8, linestyle=(0, (3, 2)))
    ax.plot([0, right], [0, 0], color=INK, linewidth=1.2)
    ax.plot([0, right], [7, 7], color=INK, linewidth=1.2)
    for mm in range(0, right + 1):
        h = 3.8 if mm % 10 == 0 else 3.0 if mm % 5 == 0 else 2.0
        ax.plot([mm, mm], [7, 7 - h], color=INK, linewidth=0.9 if mm % 10 else 1.2)
        if mm % 10 == 0:
            ax.text(mm, 1.0, str(mm), ha="center", va="bottom", fontsize=8)
    ax.text(right + 3.5, 3.5, "mm", ha="left", va="center", fontsize=9)
    top = y + L * 0.55 + 4
    if p["bar"]:
        bx, ex = bar_span(p)
        ax.plot([bx, ex], [top, top], color=INK, linewidth=3, solid_capstyle="butt")
        for x in (bx, ex):  # guides down to the ruler, so its length is read there (P3i review)
            ax.plot([x, x], [top, 7.2], color=INK, linewidth=0.8, linestyle=(0, (3, 2)))
        ax.text((bx + ex) / 2, top + 1.5, f"{p['bar']['um']} µm", ha="center", va="bottom", fontsize=10)
    else:
        ax.text(right - 2, top, f"× {p['mag']:,}".replace(",", " "), ha="right", va="center", fontsize=12, fontweight="bold")
    ax.set_xlim(-3, right + 9)
    ax.set_ylim(-1, top + 6)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


SETTINGS = ["in a biology lesson", "from a microscope slide", "in a practical", "from a textbook micrograph", "at the science club"]


def _um(v: Fraction) -> list[str]:
    n = exact(v)
    return [n, f"{n} µm", f"{n} um", f"{n}µm", f"{n} micrometres", f"{n} μm"]


def questions(p: dict, rng: random.Random) -> list:
    who, friend = rng.sample(NAMES, 2)
    L = p["end"] - p["start"]
    actual = Fraction(L * 1000, p["mag"])
    sp = p["specimen"]
    qs = [short(f"{who} drew {sp} {rng.choice(SETTINGS)}. Use the ruler: how long is the image, in mm?", L,
                [str(L), f"{L} mm", f"{L}mm"])]
    if p["bar"]:
        m = p["mag"]
        qs.append(short(f"The scale bar represents {p['bar']['um']} µm. What is the magnification of the drawing?", m,
                        [str(m), f"×{m}", f"x{m}", f"× {m}", f"x {m}", f"{m}x", f"{m}×", f"{m} times", f"{m:,}", f"×{m:,}"]))
        qs.append(short(f"{friend} uses the magnification. What is the actual length of the {sp.split(' ', 1)[1]}, in µm?", exact(actual),
                        _um(actual)))
    else:
        shown = f"{p['mag']:,}".replace(",", " ")  # 10 000, as printed on the figure
        qs.append(short(f"The magnification is × {shown}. What is the actual length of the {sp.split(' ', 1)[1]}, in µm?",
                        exact(actual), _um(actual)))
    return qs
