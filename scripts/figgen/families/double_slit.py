"""Interference of light (UP, AL): Young's double slit and the diffraction grating. Two kinds:

- fringes (UP, AL): a laser, a double slit (separation a printed) and a screen a distance D away (printed), with the
  pattern on the screen drawn enlarged below; an arrow from the centre of one bright fringe to the centre of another,
  k fringe spacings apart, is labelled with its length. Asks the fringe spacing (the length ÷ the spacings counted),
  the wavelength by λ = ax ÷ D, and the new spacing when the screen is moved. x = λD ÷ a is exact to 0.01 mm and the
  arrow's length to 0.1 mm.
- grating (AL): a top view of a laser, a grating (lines per mm printed) and a screen at D, the first-order spots at y
  either side of the central spot, D and y printed in a 3:4, 4:3 or 7:24 ratio so sin θ is exactly 0.6, 0.8 or 0.28.
  Asks sin θ, the wavelength by d sin θ = nλ (d = 1/N mm), and the highest order the grating can give.

The light is drawn in a colour that fits its wavelength (blue, green, yellow, orange or red).
"""
from __future__ import annotations

import math
import random
from fractions import Fraction

from matplotlib.patches import FancyArrowPatch, Rectangle

from ..core import INK, NAMES, exact, measure, new_figure, short

ID = "double_slit"
KIND = "physics.wave"
SUBJECT = "physics"
BANDS = ("UP", "AL")
CONCEPTS = tuple(f"physics.{c}" for c in ("young-double-slit-experiment", "interference-of-light", "diffraction-gratings"))
NEEDS = r"interference|young|double.slit|superposition|diffraction"
# The IGCSE light chapter lists no sections and does not teach Young's slits.
AVOID = r"^chapter 15: light$|glossary|thinking and working scientifically"

LAMS = [450, 480, 500, 520, 540, 560, 580, 600, 620, 640, 650, 680, 700]
DS = ["1.0", "1.2", "1.5", "1.6", "2.0", "2.4", "2.5", "3.0"]
AS = ["0.20", "0.25", "0.30", "0.40", "0.50", "0.60", "0.80"]
# The screen's distances (D, y) by the ratio y : D, and the gratings (lines per mm) giving a visible whole wavelength.
GRATING = {(3, 4): (["0.40", "0.80", "1.20", "0.60"], ["0.30", "0.60", "0.90", "0.45"], [1000, 1200, 1500, 960, 1250]),
           (4, 3): (["0.30", "0.45", "0.60"], ["0.40", "0.60", "0.80"], [1600, 1250, 2000]),
           (7, 24): (["0.48", "0.96", "1.20", "2.40"], ["0.14", "0.28", "0.35", "0.70"], [400, 500, 625])}


def concepts_for(p: dict) -> tuple[str, ...]:
    return CONCEPTS[:2] if p["kind"] == "fringes" else CONCEPTS[1:]


def _spacing(lam, D, a) -> Fraction:
    return Fraction(lam) * Fraction(D) / (1000 * Fraction(a))


def sample(rng: random.Random) -> dict:
    band = rng.choice(BANDS)
    if band == "AL" and rng.random() < 0.5:
        ratio = rng.choice(list(GRATING))
        Ds, ys, Ns = GRATING[ratio]
        i = rng.randrange(len(Ds))
        return {"band": "AL", "kind": "grating", "ratio": list(ratio), "D": Ds[i], "y": ys[i], "N": rng.choice(Ns)}
    while True:
        lam, D, a = rng.choice(LAMS), rng.choice(DS), rng.choice(AS)
        x = _spacing(lam, D, a)
        if (x * 100).denominator != 1 or not Fraction(8, 10) <= x <= 6:
            continue
        ks = [k for k in range(4, 9) if (k * x * 10).denominator == 1]
        D2s = [d for d in DS if d != D and (_spacing(lam, d, a) * 100).denominator == 1]
        if ks and D2s:
            k = rng.choice(ks)
            return {"band": band, "kind": "fringes", "lam": lam, "D": D, "a": a, "k": k, "span": f"{float(k * x):.1f}",
                    "first": rng.randint(1, 3), "D2": rng.choice(D2s)}


# --- drawing ------------------------------------------------------------------------------------------------------

def colour(lam: int):
    if lam < 495:
        return (0.25, 0.45, 1.0)
    if lam < 565:
        return (0.15, 0.78, 0.25)
    if lam < 595:
        return (0.95, 0.85, 0.1)
    if lam < 625:
        return (1.0, 0.55, 0.1)
    return (0.92, 0.12, 0.1)


def _arrow(ax, a, b, both=True, **kw):
    ax.add_patch(FancyArrowPatch(a, b, arrowstyle="<|-|>" if both else "-|>", mutation_scale=10, color=INK, linewidth=1.0,
                                 shrinkA=0, shrinkB=0, **kw))


def _draw_fringes(p: dict):
    import matplotlib.pyplot as plt
    fig = plt.figure(figsize=(7.4, 5.0))
    top = fig.add_axes([0.03, 0.42, 0.94, 0.56])
    low = fig.add_axes([0.08, 0.04, 0.84, 0.25])
    rgb = colour(p["lam"])
    # the apparatus
    top.add_patch(Rectangle((0.2, 1.25), 1.5, 0.6, facecolor="#e9ecef", edgecolor=INK, linewidth=1.1))
    top.text(0.95, 1.55, "laser", ha="center", va="center", fontsize=10)
    top.plot([1.7, 4.0], [1.55, 1.55], color=rgb, linewidth=2.0)
    for y0, y1 in ((0.45, 1.42), (1.48, 1.62), (1.68, 2.65)):
        top.plot([4.0, 4.0], [y0, y1], color=INK, linewidth=3.0, solid_capstyle="butt")
    for ys in (1.45, 1.65):
        for yt in (0.7, 1.15, 1.55, 1.95, 2.4):
            top.plot([4.0, 9.0], [ys, yt], color=rgb, linewidth=0.6, alpha=0.6)
    top.plot([9.0, 9.0], [0.35, 2.75], color=INK, linewidth=2.2)
    top.text(4.0, 2.82, "double slit", ha="center", va="bottom", fontsize=10)
    top.text(4.0, 3.32, f"slit separation a = {p['a']} mm", ha="center", va="bottom", fontsize=10)
    top.text(9.0, 2.82, "screen", ha="center", va="bottom", fontsize=10)
    _arrow(top, (4.0, 0.12), (9.0, 0.12))
    top.text(6.5, 0.2, f"D = {p['D']} m", ha="center", va="bottom", fontsize=10,
             bbox=dict(facecolor="white", edgecolor="none", pad=1.0))
    top.text(9.6, 1.55, "not to\nscale", ha="center", va="center", fontsize=9)
    top.set_xlim(0, 10.3)
    top.set_ylim(0, 3.8)
    top.axis("off")
    # the pattern on the screen
    n = p["k"] + 4
    cols = 900
    row = []
    for i in range(cols):
        u = n * (i + 0.5) / cols
        inten = math.cos(math.pi * (u - 0.5)) ** 2 * (0.75 + 0.25 * math.cos(math.pi * (u - n / 2) / n))
        row.append([c * inten for c in rgb])
    low.imshow([row] * 4, extent=[0, n, 0, 1], aspect="auto", interpolation="bilinear")
    c0, c1 = p["first"] + 0.5, p["first"] + p["k"] + 0.5
    for c in (c0, c1):
        low.plot([c, c], [1.05, 1.55], color=INK, linewidth=1.1, gid=f"fringe-end:{c}")
    _arrow(low, (c0, 1.3), (c1, 1.3))
    low.text((c0 + c1) / 2, 1.42, f"{p['span']} mm", ha="center", va="bottom", fontsize=10.5,
             bbox=dict(facecolor="white", edgecolor="none", pad=1.0))
    low.text(n / 2, 2.25, "Bright fringes on the screen (enlarged)", ha="center", va="bottom", fontsize=10)
    low.set_xlim(0, n)
    low.set_ylim(0, 2.75)
    low.axis("off")
    return fig


def _draw_grating(p: dict):
    u, w = p["ratio"]
    L = 6.0 if u < w else 3.9
    Y = L * u / w
    fig, ax = new_figure(7.4, max(3.6, 0.5 * (2 * Y + 2.8)))
    rgb = colour(round(1e6 / p["N"] * u / math.hypot(u, w)))
    gx, sx = 3.0, 3.0 + L
    ax.add_patch(Rectangle((0.0, -0.3), 1.6, 0.6, facecolor="#e9ecef", edgecolor=INK, linewidth=1.1))
    ax.text(0.8, 0.0, "laser", ha="center", va="center", fontsize=10)
    ax.plot([1.6, gx], [0, 0], color=rgb, linewidth=2.0)
    ax.plot([gx, gx], [-Y - 0.6, Y + 0.6], color=INK, linewidth=2.6)
    ax.text(gx, Y + 0.75, f"grating: {p['N']} lines per mm", ha="center", va="bottom", fontsize=10)
    ax.plot([sx, sx], [-Y - 0.6, Y + 0.6], color=INK, linewidth=2.6)
    ax.text(sx, Y + 0.75, "screen", ha="center", va="bottom", fontsize=10)
    for yy in (-Y, 0, Y):
        ax.plot([gx, sx], [0, yy], color=rgb, linewidth=1.2)
        ax.plot([sx], [yy], marker="o", markersize=7, color=rgb, markeredgecolor=INK)
    ax.text(sx + 0.25, 0, "central spot", ha="left", va="center", fontsize=9.5)
    ax.text(sx + 0.25, -Y, "first order", ha="left", va="center", fontsize=9.5)
    ax.text(sx + 0.25, Y, "first order", ha="left", va="center", fontsize=9.5)
    _arrow(ax, (sx - 0.35, 0), (sx - 0.35, Y))
    # low down, in the wedge between the straight-through beam and the first-order beam, clear of both
    ax.text(sx - 0.5, max(0.42, 0.2 * Y), f"y = {p['y']} m", ha="right", va="center", fontsize=10)
    _arrow(ax, (gx, -Y - 0.95), (sx, -Y - 0.95))
    ax.text((gx + sx) / 2, -Y - 0.85, f"D = {p['D']} m", ha="center", va="bottom", fontsize=10,
            bbox=dict(facecolor="white", edgecolor="none", pad=1.0))
    ax.text(0.8, -Y - 0.9, "top view,\nnot to scale", ha="center", va="center", fontsize=9)
    ax.set_xlim(-0.2, sx + 2.4)
    ax.set_ylim(-Y - 1.4, Y + 1.4)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def draw(p: dict):
    return _draw_fringes(p) if p["kind"] == "fringes" else _draw_grating(p)


# --- questions ----------------------------------------------------------------------------------------------------

SETTINGS = ["in the physics laboratory", "during a lesson on interference", "for a class practical", "at the science club",
            "in a revision class", "for a practical test", "in a lesson on waves"]


def questions(p: dict, rng: random.Random) -> list:
    who, friend = rng.sample(NAMES, 2)
    if p["kind"] == "fringes":
        x = _spacing(p["lam"], p["D"], p["a"])
        x2 = _spacing(p["lam"], p["D2"], p["a"])
        return [short(f"{who} shone a laser through a double slit {rng.choice(SETTINGS)} and drew the bright fringes seen on "
                      "the screen. What is the fringe spacing x, in mm?", exact(x), measure(x, "mm")),
                short("Using λ = ax ÷ D with the values in the diagram, what is the wavelength of the light, in nm? "
                      "(1 mm = 10⁻³ m and 1 nm = 10⁻⁹ m.)", p["lam"], [str(p["lam"]), f"{p['lam']} nm", f"{p['lam']}nm",
                                                                      f"{p['lam']} × 10⁻⁹ m", f"{p['lam']}e-9"]),
                short(f"{friend} moves the screen so that D is {p['D2']} m, with the same slits and laser. Using x = λD ÷ a, "
                      "what is the new fringe spacing, in mm?", exact(x2), measure(x2, "mm"))]
    u, w = p["ratio"]
    sin = Fraction(u, int(math.isqrt(u * u + w * w)))
    d_nm = Fraction(10 ** 6, p["N"])
    lam = d_nm * sin
    top = math.floor(d_nm / lam)
    return [short(f"{who} shone a laser at a diffraction grating {rng.choice(SETTINGS)}. θ is the angle between the "
                  "straight-through beam and a first-order beam. Using the distances D and y in the diagram, what is sin θ?",
                  exact(sin), [exact(sin), f"{sin.numerator}/{sin.denominator}"]),
            short("The grating spacing is d = 1 ÷ (lines per mm) in mm. Using d sin θ = nλ for the first order (n = 1), "
                  "what is the wavelength of the light, in nm?", exact(lam), [exact(lam), f"{exact(lam)} nm", f"{exact(lam)}nm"]),
            short("Since sin θ cannot be more than 1, what is the highest order n of bright spot this grating can give "
                  "with this light?", top, [str(top), f"n = {top}", f"order {top}"])]
