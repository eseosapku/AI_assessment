"""Circular motion (AL, Further Mathematics "Circular motion"): horizontal circles and vertical circles.

Three kinds of figure, each printing g = 10 m s⁻² where weight matters:
- conical: a particle P moves in a horizontal circle, either on a light inextensible string from a fixed point A (a
  conical pendulum) or on the smooth inner surface of a hemispherical bowl of centre O; the line to P makes an angle θ
  with the vertical, cos θ printed. The tension (or the reaction), the radius of the circle, the speed, the angular speed.
- disc: P rests on a rough horizontal disc turning about its centre O with angular speed ω (seen from above), at a
  printed distance from O. The speed of P, the friction the disc must give it, the least coefficient of friction.
- vertical: P moves in a vertical circle of centre O on a light inextensible string (or inside a smooth hollow
  sphere); its speed at the lowest point A is printed. The speed at the highest point B by energy, the tension (or the
  reaction) at A and at B.

Every key is a whole number or a short terminating decimal.
"""
from __future__ import annotations

import math
import random
from fractions import Fraction

from matplotlib.patches import Arc, Circle, Ellipse, FancyArrowPatch

from ..core import FILL_2, INK, NAMES, mcq, new_figure
from ._mech import G, answer, arrow, fmt, hatch

ID = "circular_motion_m"
KIND = "physics.force"
SUBJECT = "mathematics"
BANDS = ("AL",)
CONCEPTS = ("mathematics.horizontal-circles", "mathematics.vertical-circles")
NEEDS = r"circular motion|horizontal circle|vertical circle"
AVOID = r"^(?!.*circular motion)"

F = Fraction
MASSES = [F(1, 10), F(1, 5), F(1, 4), F(3, 10), F(2, 5), F(1, 2), F(3, 5), F(7, 10), F(3, 4), F(4, 5), F(9, 10), F(1),
          F(6, 5), F(7, 5), F(3, 2), F(8, 5), F(2), F(5, 2), F(3), F(4), F(5), F(6)]
# cos θ, and the speeds that make the string's length a short decimal: v² = g L sin²θ / cos θ
CONICAL = {(4, 5): [F(3, 4), F(3, 2), F(9, 4), F(3), F(15, 4), F(9, 2), F(6)], (3, 5): [F(2), F(4), F(6), F(8)]}
LEADS = {
    "string": ["{n} whirls a particle P on a light inextensible string fixed at A, so that P moves in a horizontal circle.",
               "{n} sets up a conical pendulum: a particle P on a light inextensible string from a fixed point A.",
               "{n} watches a particle P on a light inextensible string from A move in a horizontal circle."],
    "bowl": ["{n} watches a particle P move in a horizontal circle on the smooth inner surface of a fixed hemispherical bowl.",
             "{n} sets a particle P moving in a horizontal circle inside a smooth hemispherical bowl of centre O.",
             "{n} rolls a small particle P round the smooth inside of a fixed hemispherical bowl, in a horizontal circle."],
    "disc": ["{n} places a particle P on a rough horizontal disc that turns about its centre O.",
             "{n} puts a small coin P on a rough horizontal turntable rotating about its centre O.",
             "{n} watches a particle P turn, without slipping, with a rough horizontal disc of centre O."],
    "vstring": ["{n} swings a particle P in a vertical circle of centre O on a light inextensible string.",
                "{n} sets a particle P moving in a complete vertical circle on a light inextensible string fixed at O.",
                "{n} watches a particle P, tied to O by a light inextensible string, move in a vertical circle."],
    "sphere": ["{n} watches a particle P move in a vertical circle on the smooth inner surface of a hollow sphere of centre O.",
               "{n} sets a particle P moving in a complete vertical circle inside a smooth hollow sphere of centre O.",
               "{n} sends a particle P round a vertical circle on the smooth inside of a fixed hollow sphere, centre O."],
}


def _vertical_cases():
    out = []
    for r in (F(2, 5), F(1, 2), F(4, 5), F(1), F(8, 5), F(2), F(5, 2)):  # 1/r terminates, so m u²/r does
        for u in range(3, 16):
            v2 = u * u - 4 * G * r
            if v2.denominator == 1 and v2 > G * r and math.isqrt(int(v2)) ** 2 == v2:
                out.append((r, u, math.isqrt(int(v2))))
    return out


VERTICAL = _vertical_cases()


def sample(rng: random.Random) -> dict:
    sub = rng.choice(["conical", "disc", "vertical"])
    name = rng.choice(NAMES)
    m = rng.choice(MASSES)
    if sub == "conical":
        while True:
            cos = rng.choice(sorted(CONICAL))
            v = rng.choice(CONICAL[cos])
            c, h = F(cos[0], cos[1]), F(math.isqrt(cos[1] ** 2 - cos[0] ** 2), cos[1])
            L = v * v * c / (G * h * h)
            p = {"band": "AL", "sub": sub, "what": rng.choice(["string", "bowl"]), "m": fmt(m), "L": fmt(L),
                 "cos": list(cos), "name": name}
            if len(_conical_keys(p)) >= 3:  # only keys a paper would print exactly are asked
                return p
            m = rng.choice(MASSES)
    if sub == "disc":
        while True:
            r = rng.choice([F(1, 10), F(3, 20), F(1, 5), F(1, 4), F(3, 10), F(2, 5), F(1, 2), F(3, 5), F(4, 5)])
            w = rng.choice([F(1), F(3, 2), F(2), F(5, 2), F(3), F(4), F(5), F(6)])
            mu = r * w * w / G
            if F(1, 20) <= mu <= F(9, 10) and (mu * 1000).denominator == 1 and (r * w * w * m * 1000).denominator == 1:
                return {"band": "AL", "sub": sub, "m": fmt(m), "r": fmt(r), "w": fmt(w), "name": name}
    r, u, v = rng.choice(VERTICAL)
    return {"band": "AL", "sub": sub, "what": rng.choice(["vstring", "sphere"]), "m": fmt(m), "r": fmt(r), "u": u,
            "name": name}


# --- drawing -----------------------------------------------------------------------------------------------

def _note(ax, lines, x=0.99, y=0.98, ha="right"):
    ax.text(x, y, "\n".join(lines), transform=ax.transAxes, ha=ha, va="top", fontsize=10.5, linespacing=1.5,
            multialignment="left", gid="note",
            bbox={"boxstyle": "round,pad=0.4", "facecolor": "white", "edgecolor": INK, "linewidth": 0.9})


def _draw_conical(p: dict):
    fig, ax = new_figure(6.8, 4.8)
    a, b = p["cos"]
    c = a / b
    s = math.sqrt(1 - c * c)
    R = 3.0  # the drawn length of the string (or the bowl's radius)
    top = 3.2
    px, py = R * s, top - R * c
    if p["what"] == "string":
        hatch(ax, -0.7, top, 0.7, top, side=1, size=0.16, gid="ceiling")
        ax.text(-0.15, top - 0.12, "A", ha="right", va="top", fontsize=12, fontweight="bold", gid="A")
        ax.plot([0, px], [top, py], color=INK, linewidth=1.6, gid="string")
        mid = (px / 2 + 0.18 * c, (top + py) / 2 + 0.18 * s)
        ax.text(*mid, f"{p['L']} m", ha="left", va="bottom", fontsize=11, rotation=0, gid="L")
    else:
        ax.add_patch(Arc((0, top), 2 * R, 2 * R, theta1=180, theta2=360, color=INK, linewidth=1.8, gid="bowl"))
        ax.plot([-R, R], [top, top], color=INK, linewidth=0.9, linestyle=(0, (4, 3)), gid="rim")
        ax.plot([0], [top], "o", color=INK, markersize=4)
        ax.text(-0.15, top + 0.08, "O", ha="right", va="bottom", fontsize=12, fontweight="bold", gid="O")
        ax.plot([0, px], [top, py], color=INK, linewidth=1.1, linestyle=(0, (5, 3)), gid="radius")
        ax.text(px / 2 + 0.2, (top + py) / 2 + 0.1, f"{p['L']} m", ha="left", va="bottom", fontsize=11, gid="L")
    ax.plot([0, 0], [top, py - 0.3], color=INK, linewidth=0.9, linestyle=(0, (2, 3)), gid="vertical")
    ax.add_patch(Ellipse((0, py), 2 * px, 0.7, fill=False, edgecolor=INK, linewidth=1.0, linestyle=(0, (5, 3)),
                         gid="circle"))
    ax.add_patch(Circle((px, py), 0.15, facecolor=FILL_2, edgecolor=INK, linewidth=1.4, zorder=5))
    if p["what"] == "string":
        ax.text(px + 0.25, py + 0.05, "P", ha="left", va="bottom", fontsize=12, fontweight="bold", gid="P")
    else:  # outside the bowl, along the radius, clear of its rim
        ax.text(px + 0.45 * s, py - 0.45 * c, "P", ha="center", va="center", fontsize=12, fontweight="bold", gid="P")
    ang = math.degrees(math.acos(c))
    ax.add_patch(Arc((0, top), 1.4, 1.4, theta1=270, theta2=270 + ang, color=INK, linewidth=1.1))
    mid = math.radians(270 + ang / 2)
    ax.text(1.0 * math.cos(mid), top + 1.0 * math.sin(mid), "θ", ha="center", va="center", fontsize=12, gid="theta")
    _note(ax, [f"mass of P {p['m']} kg", f"cos θ = {a}/{b}", f"g = {G} m s⁻²"])
    ax.set_xlim(-3.4, 6.2)
    ax.set_ylim(min(py - 0.6, top - R - 0.2), top + 0.55)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def _draw_disc(p: dict):
    fig, ax = new_figure(6.4, 4.4)
    R = 2.0
    ax.add_patch(Circle((0, 0), R, facecolor="#f4f4f4", edgecolor=INK, linewidth=1.8, gid="behind-disc"))
    ax.plot([0], [0], "o", color=INK, markersize=4)
    ax.text(-0.12, -0.12, "O", ha="right", va="top", fontsize=12, fontweight="bold", gid="O")
    r = float(F(p["r"]))
    pr = 1.3
    ax.plot([0, pr], [0, 0], color=INK, linewidth=1.0, linestyle=(0, (4, 3)), gid="radius")
    ax.add_patch(Circle((pr, 0), 0.13, facecolor=FILL_2, edgecolor=INK, linewidth=1.4, zorder=5))
    ax.text(pr + 0.2, 0.1, "P", ha="left", va="bottom", fontsize=12, fontweight="bold", gid="P")
    ax.text(pr / 2, 0.1, f"{p['r']} m", ha="center", va="bottom", fontsize=11, gid="r")
    ax.add_patch(FancyArrowPatch((R * 0.92 * math.cos(math.radians(200)), R * 0.92 * math.sin(math.radians(200))),
                                 (R * 0.92 * math.cos(math.radians(250)), R * 0.92 * math.sin(math.radians(250))),
                                 connectionstyle="arc3,rad=0.25", arrowstyle="-|>", mutation_scale=13, color=INK,
                                 linewidth=1.4))
    ax.text(-1.0, -1.15, "ω", ha="center", va="center", fontsize=12, gid="omega")
    _note(ax, ["seen from above", f"ω = {p['w']} rad s⁻¹", f"mass of P {p['m']} kg", f"g = {G} m s⁻²"])
    ax.set_xlim(-2.3, 6.0)
    ax.set_ylim(-2.3, 2.3)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def _draw_vertical(p: dict):
    fig, ax = new_figure(6.6, 4.8)
    R = 2.0
    sphere = p["what"] == "sphere"
    ax.add_patch(Circle((0, 0), R, fill=False, edgecolor=INK, linewidth=1.8 if sphere else 1.0,
                        linestyle="-" if sphere else (0, (5, 3)), gid="circle"))
    ax.plot([0], [0], "o", color=INK, markersize=4)
    ax.text(0.15, 0.1, "O", ha="left", va="bottom", fontsize=12, fontweight="bold", gid="O")
    if sphere:
        ax.plot([0, 0], [0, -R], color=INK, linewidth=0.9, linestyle=(0, (4, 3)), gid="radius")
    else:
        ax.plot([0, 0], [0, -R + 0.15], color=INK, linewidth=1.6, gid="string")
    ax.text(-0.15, -R / 2, f"{p['r']} m", ha="right", va="center", fontsize=11, gid="r")
    ax.add_patch(Circle((0, -R), 0.15, facecolor=FILL_2, edgecolor=INK, linewidth=1.4, zorder=5))
    ax.text(-0.22, -R - 0.18, "A", ha="right", va="top", fontsize=12, fontweight="bold", gid="A")
    ax.text(0.22, -R + 0.22, "P", ha="left", va="bottom", fontsize=12, fontweight="bold", gid="P")
    arrow(ax, 0.0, -R - 0.38, 1.2, -R - 0.38, lw=1.6, gid="u")
    ax.text(1.35, -R - 0.38, f"{p['u']} m s⁻¹", ha="left", va="center", fontsize=11, gid="speed")
    ax.plot([0], [R], "o", color=INK, markersize=4)
    ax.text(0, R + 0.15, "B", ha="center", va="bottom", fontsize=12, fontweight="bold", gid="B")
    _note(ax, [f"mass of P {p['m']} kg", f"g = {G} m s⁻²",
               "smooth hollow sphere" if sphere else "light inextensible string OP"])
    ax.set_xlim(-2.4, 6.4)
    ax.set_ylim(-2.75, 2.75)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def draw(p: dict):
    return {"conical": _draw_conical, "disc": _draw_disc, "vertical": _draw_vertical}[p["sub"]](p)


# --- questions ---------------------------------------------------------------------------------------------

def _force_mcq(stem: str, key: Fraction, wrongs, unit: str, rng):
    opts = []
    for w in wrongs:
        if w > 0 and w != key and fmt(w) not in opts and fmt(w) != fmt(key) and (w * 10000).denominator == 1:
            opts.append(fmt(w))
    return mcq(stem, f"{fmt(key)} {unit}", [f"{o} {unit}" for o in opts[:3]], rng)


def _conical_keys(p: dict) -> dict:
    """The conical figure's four keys -- the tension (or reaction), the radius, the speed, the angular speed -- those
    that are short terminating decimals only."""
    m = F(p["m"])
    a, b = p["cos"]
    c = F(a, b)
    s = F(math.isqrt(b * b - a * a), b)
    r = F(p["L"]) * s
    v2 = G * r * s / c
    v = F(math.isqrt(v2.numerator), math.isqrt(v2.denominator))
    keys = {"force": m * G / c, "radius": r, "speed": v, "omega": v / r}
    return {k: x for k, x in keys.items() if (x * 10000).denominator == 1}


def questions(p: dict, rng: random.Random) -> list:
    sub, name, m = p["sub"], p["name"], F(p["m"])
    if sub == "conical":
        lead = rng.choice(LEADS[p["what"]]).format(n=name)
        a, b = p["cos"]
        c = F(a, b)
        s = F(math.isqrt(b * b - a * a), b)
        keys = _conical_keys(p)
        force = "tension in the string AP" if p["what"] == "string" else "normal reaction of the bowl on P"
        line = "AP" if p["what"] == "string" else "OP"
        make = {
            "force": lambda: (_force_mcq(f"What is the {force}?", m * G / c, [m * G * c, m * G, m * G / s], "N", rng)
                              if rng.random() < 0.5 else answer(f"Find the {force}, in newtons.", m * G / c, "N")),
            "radius": lambda: answer(f"{line} makes the angle θ with the vertical. Find the radius, in metres, of the "
                                     f"horizontal circle in which P moves.", keys["radius"], "m"),
            "speed": lambda: answer("Find the speed of P, in m s⁻¹, as it moves round its horizontal circle.", keys["speed"],
                                    "m/s"),
            "omega": lambda: answer("Find the angular speed of P, in rad s⁻¹, about the vertical through the centre of its "
                                    "circle.", keys["omega"], "rad/s"),
        }
        qs = [make[k] for k in ("force", "radius", "speed", "omega") if k in keys]
    elif sub == "disc":
        lead = rng.choice(LEADS["disc"]).format(n=name)
        r, w = F(p["r"]), F(p["w"])
        qs = [
            lambda: answer("P moves with the disc. Find the speed of P in m s⁻¹.", r * w, "m/s"),
            lambda: answer("Find the magnitude, in newtons, of the friction force that the disc exerts on P.", m * r * w * w, "N"),
            lambda: answer("Find the least possible coefficient of friction between P and the disc.", r * w * w / G),
        ]
    else:
        lead = rng.choice(LEADS[p["what"]]).format(n=name)
        r, u = F(p["r"]), p["u"]
        v2 = u * u - 4 * G * r
        v = math.isqrt(int(v2))
        force = "tension in the string" if p["what"] == "vstring" else "normal reaction of the sphere on P"
        TA = m * u * u / r + m * G
        qs = [
            lambda: answer("Find the speed of P, in m s⁻¹, at the highest point B of the circle.", v, "m/s"),
            lambda: (_force_mcq(f"What is the {force} when P is at the lowest point A?", TA,
                                [m * u * u / r - m * G, m * u * u / r, m * v * v / r + m * G], "N", rng)
                     if rng.random() < 0.5 else
                     answer(f"Find the {force}, in newtons, when P is at the lowest point A.", TA, "N")),
            lambda: answer(f"Find the {force}, in newtons, when P is at the highest point B.", m * v * v / r - m * G, "N"),
        ]
    order = rng.sample(range(len(qs)), 3)
    out = [qs[i]() for i in order]
    out[0].stem = f"{lead} {out[0].stem}"
    return out
