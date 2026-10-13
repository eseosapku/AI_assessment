"""Rays of light (LS, UP): a ray reflected by a plane mirror, or refracted into or out of a block of
glass, Perspex or water, with the normal dashed and the angles marked. The angle of reflection and
the angle to the mirror; the refractive index n = sin i / sin r to 2 d.p., and which way the ray bends.

The rays are drawn at their true angles: the law of reflection holds, and each refracted pair of
whole-degree angles gives an index within 0.03 of the material's own, never on a rounding edge.
"""
from __future__ import annotations

import math
import random
from fractions import Fraction

from matplotlib.patches import Arc, Rectangle

from ..core import FILL_2, INK, NAMES, exact, mcq, new_figure, short

ID = "ray_optics"
KIND = "physics.ray"
SUBJECT = "physics"
BANDS = ("LS", "UP")
CONCEPTS = tuple(f"physics.{c}" for c in ("reflection-of-waves", "plane-mirrors", "refraction-of-waves", "light-and-optics"))
# Not sound, mechanical waves, interference or light's particle nature.
AVOID = r"lens|human eye|optical instruments|\bsound|seismic|ultrasound|plant growth|interference|mechanical waves|particle nature"
INDEX = {"glass": 1.5, "Perspex": 1.49, "water": 1.33}
BENDS = [f"{d} the normal, because it {s}" for d in ("Towards", "Away from") for s in ("slows down", "speeds up")]


def _snell(medium: str, into: bool, rng: random.Random):
    """A whole-degree angle of incidence and of refraction whose index is close to the material's."""
    n0 = INDEX[medium]
    pairs = []
    for i in range(15, 66):
        if into:
            r = round(math.degrees(math.asin(math.sin(math.radians(i)) / n0)))
        else:
            if n0 * math.sin(math.radians(i)) >= 0.95:
                continue
            r = round(math.degrees(math.asin(n0 * math.sin(math.radians(i)))))
        n = math.sin(math.radians(i)) / math.sin(math.radians(r))
        n = n if into else 1 / n
        if abs(n - n0) <= 0.03 and 1.3 <= n <= 1.6 and abs(n * 100 - round(n * 100)) < 0.4 and r != i:
            pairs.append((i, r))
    return rng.choice(pairs)


def sample(rng: random.Random) -> dict:
    band = rng.choice(BANDS)
    side = rng.choice(["left", "right"])
    if rng.random() < 0.45:
        return {"band": band, "kind": "reflection", "i": rng.choice(range(20, 71, 5)), "shown": rng.choice(["normal", "mirror"]), "side": side}
    medium, into = rng.choice(list(INDEX)), rng.random() < 0.6
    i, r = _snell(medium, into, rng)
    return {"band": band, "kind": "refraction", "medium": medium, "into": into, "i": i, "r": r, "side": side}


def ray_angles(p: dict) -> tuple[float, float]:
    """The incoming and outgoing rays' angles to the normal, signed: negative on the left."""
    s = -1 if p["side"] == "left" else 1
    if p["kind"] == "reflection":
        return s * p["i"], -s * p["i"]
    return s * p["i"], -s * p["r"]


def _angle_mark(ax, theta1: float, theta2: float, radius: float, text: str):
    """An arc and its label inside the angle, pushed out until the angle is wide enough to hold the
    label clear of both lines."""
    at = min(3.3, max(radius + 0.45, 0.5 / math.tan(math.radians(theta2 - theta1) / 2)))
    radius = at - 0.45
    ax.add_patch(Arc((0, 0), 2 * radius, 2 * radius, theta1=theta1, theta2=theta2, color=INK, linewidth=1.0))
    mid = math.radians((theta1 + theta2) / 2)
    ax.text(at * math.cos(mid), at * math.sin(mid), text, ha="center", va="center", fontsize=11)


def _ray(ax, angle_from_vertical: float, up: bool, outward: bool):
    """A ray of length 4 from or to the origin, at a signed angle to the normal, above or below."""
    a = math.radians(angle_from_vertical)
    x, y = 4 * math.sin(a), 4 * math.cos(a) * (1 if up else -1)
    ax.plot([0, x], [0, y], color=INK, linewidth=1.8)
    t0, t1 = (0.45, 0.6) if outward else (0.6, 0.45)
    ax.annotate("", xy=(t1 * x, t1 * y), xytext=(t0 * x, t0 * y), arrowprops=dict(arrowstyle="-|>", color=INK, lw=1.6, mutation_scale=18))


def draw(p: dict):
    fig, ax = new_figure(5.4, 4.8)
    a_in, a_out = ray_angles(p)
    if p["kind"] == "reflection":
        ax.plot([-4.6, 4.6], [0, 0], color=INK, linewidth=2.4)
        for k in range(23):  # the mirror's silvered back
            x = -4.3 + 0.4 * k
            ax.plot([x, x - 0.25], [0, -0.3], color=INK, linewidth=0.9)
        ax.plot([0, 0], [0, 4.2], color=INK, linewidth=1.0, linestyle=(0, (5, 4)))
        ax.text(0.1, 4.25, "normal", ha="left", va="bottom", fontsize=9)
        _ray(ax, a_in, True, False)
        _ray(ax, a_out, True, True)
        i = p["i"]
        left = p["side"] == "left"
        if p["shown"] == "normal":
            _angle_mark(ax, 90, 90 + i, 1.3, f"{i}°") if left else _angle_mark(ax, 90 - i, 90, 1.3, f"{i}°")
        else:
            _angle_mark(ax, 180 - (90 - i), 180, 1.0, f"{90 - i}°") if left else _angle_mark(ax, 0, 90 - i, 1.0, f"{90 - i}°")
        ax.text(4.5, -0.45, "mirror", ha="right", va="top", fontsize=9)
        lo = -1.0
    else:
        dense_below = p["into"]
        ax.add_patch(Rectangle((-4.6, -4.4 if dense_below else 0), 9.2, 4.4, facecolor=FILL_2, edgecolor="none"))
        ax.plot([-4.6, 4.6], [0, 0], color=INK, linewidth=1.4)
        ax.plot([0, 0], [-4.4, 4.4], color=INK, linewidth=1.0, linestyle=(0, (5, 4)))
        ax.text(0.1, 4.3, "normal", ha="left", va="top", fontsize=9)
        medium = p["medium"]
        top, bottom = ("air", medium) if dense_below else (medium, "air")
        ax.text(-4.4, 0.25, top, ha="left", va="bottom", fontsize=10)
        ax.text(-4.4, -0.25, bottom, ha="left", va="top", fontsize=10)
        # The light arrives from above, in air or inside the block, and leaves below.
        _ray(ax, a_in, True, False)
        _ray(ax, a_out, False, True)
        i, r = p["i"], p["r"]
        left = p["side"] == "left"
        _angle_mark(ax, 90, 90 + i, 1.4, f"{i}°") if left else _angle_mark(ax, 90 - i, 90, 1.4, f"{i}°")
        _angle_mark(ax, 270, 270 + r, 1.4, f"{r}°") if left else _angle_mark(ax, 270 - r, 270, 1.4, f"{r}°")
        lo = -4.4
    ax.set_xlim(-4.7, 4.7)
    ax.set_ylim(lo, 4.6)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


SETTINGS = ["in the school laboratory", "at the science club", "for a class practical", "during a physics lesson", "for a science fair"]


def questions(p: dict, rng: random.Random) -> list:
    name = rng.choice(NAMES)
    tool = rng.choice(["a ray box", "a laser pointer", "a torch with a narrow slit"])
    if p["kind"] == "reflection":
        i = p["i"]
        return [short(f"{name} shone {tool} at a plane mirror {rng.choice(SETTINGS)}. What is the angle of reflection?", i, [f"{i}°", f"{i} degrees"]),
                short("What is the angle between the reflected ray and the mirror?", 90 - i, [f"{90 - i}°", f"{90 - i} degrees"]),
                short("What is the angle between the incident ray and the reflected ray?", 2 * i, [f"{2 * i}°", f"{2 * i} degrees"])]
    i, r, medium = p["i"], p["r"], p["medium"]
    n = math.sin(math.radians(i)) / math.sin(math.radians(r))
    n = n if p["into"] else 1 / n
    way = f"from air into {medium}" if p["into"] else f"from {medium} into air"
    key = BENDS[0] if p["into"] else BENDS[3]
    two = f"{n:.2f}"  # "1.50" as asked, and "1.5" as the key, since it is the same number
    return [short(f"{name} shone {tool} {way} {rng.choice(SETTINGS)}. What is the refractive index of the {medium}, to 2 decimal places?",
                  exact(Fraction(two)), [two]),
            mcq("Which way does the ray bend as it crosses the boundary, and why?", key, [b for b in BENDS if b != key], rng)]
