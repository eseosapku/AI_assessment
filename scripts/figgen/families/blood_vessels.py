"""Blood vessels in cross-section (LS, UP, AL): an artery, a vein and a capillary side by side in a shuffled order,
lettered P, Q and R, each with its wall thickness and lumen width printed beneath it. The artery is round with a thick
muscular wall and a narrow lumen; the vein is a flattened oval with a thin wall and a wide lumen, the two drawn to one
scale; the capillary is a ring one cell thick round a red blood cell, drawn much larger.

Which letter is the artery (or carries blood at the highest pressure); which is the vein (has valves, lowest pressure)
or the capillary (where substances are exchanged); how many times thicker the artery's wall is than the vein's; and an
outer diameter, with the formula in the stem.

The artery's wall is 2, 3 or 4 times the vein's and its lumen narrower, so the drawing alone tells them apart; every
measurement has one decimal place.
"""
from __future__ import annotations

import random
from fractions import Fraction

from matplotlib.patches import Ellipse

from ..core import INK, NAMES, Question, exact, measure, short

ID = "blood_vessels"
KIND = "diagram.template"
SUBJECT = "biology"
BANDS = ("LS", "UP", "AL")
CONCEPTS = tuple(f"biology.{c}" for c in ("blood-circulatory-system", "transport-systems"))
AVOID = r"plant|immun|reproduc|gas exchange|lymph|kidney|excretion|nervous"
# A topic whose sections the book lists is reached only if one names what this figure teaches.
NEEDS = r"blood vessel|arter|\bveins?\b|capillar|circulat"
TYPES = ["artery", "vein", "capillary"]
LETTERS = "PQR"
GAP = 6.2  # between the vessels' centres
SIZE = 4.4  # the larger of the artery and the vein, drawn this wide
CAP = 3.0  # the capillary, drawn this wide


def sample(rng: random.Random) -> dict:
    while True:
        wv = rng.choice([0.2, 0.3, 0.4, 0.5])
        k = rng.choice([2, 3, 4])
        wa = round(wv * k, 1)
        la = rng.choice([2.0, 2.5, 3.0, 3.5, 4.0])
        lv = round(la + rng.choice([1.0, 1.5, 2.0, 2.5, 3.0]), 1)
        if wa <= 0.6 * la:
            break
    order = TYPES[:]
    rng.shuffle(order)
    return {"band": rng.choice(BANDS), "order": order, "artery": {"wall": wa, "lumen": la}, "vein": {"wall": wv, "lumen": lv},
            "cap_lumen": rng.choice([7, 8, 10]), "first": rng.choice(["artery", "pressure"]),
            "letter_q": rng.choice(["valves", "low", "exchange"]), "diameter": rng.choice(["artery", "vein"])}


def _ring(ax, cx, w, h, colour, gid=None, lw=0.0, edge="none", z=1):
    ax.add_patch(Ellipse((cx, 0), w, h, facecolor=colour, edgecolor=edge, linewidth=lw, zorder=z, gid=gid))


def _artery(ax, cx, s, wall, lumen):
    outer = lumen + 2 * wall
    _ring(ax, cx, outer * s, outer * s, "#f1e4d6", gid="outer:artery", lw=1.4, edge=INK, z=1)  # the tough outer coat
    mid = lumen + 2 * wall * 0.82
    _ring(ax, cx, mid * s, mid * s, "#d9a3a3", lw=0.8, edge=INK, z=2)  # the thick layer of muscle and elastic fibres
    inner = lumen + 2 * wall * 0.1
    _ring(ax, cx, inner * s, inner * s, "#f4f0ea", lw=0.8, edge=INK, z=3)  # the lining
    _ring(ax, cx, lumen * s, lumen * s, "#fbeeee", gid="lumen:artery", lw=1.0, edge=INK, z=4)


def _vein(ax, cx, s, wall, lumen):
    flat = 0.72  # a vein's thin wall lets it sag into an oval
    _ring(ax, cx, (lumen + 2 * wall) * s, (flat * lumen + 2 * wall) * s, "#f1e4d6", gid="outer:vein", lw=1.4, edge=INK, z=1)
    _ring(ax, cx, (lumen + 2 * wall * 0.55) * s, (flat * lumen + 2 * wall * 0.55) * s, "#d9a3a3", lw=0.8, edge=INK, z=2)
    _ring(ax, cx, lumen * s, flat * lumen * s, "#f3e6ea", gid="lumen:vein", lw=1.0, edge=INK, z=4)


def _capillary(ax, cx):
    _ring(ax, cx, CAP, CAP, "#f1e4d6", gid="outer:capillary", lw=1.4, edge=INK, z=1)
    _ring(ax, cx, CAP - 0.26, CAP - 0.26, "#fbeeee", gid="lumen:capillary", lw=1.0, edge=INK, z=2)
    for x, y, a in ((-0.0, CAP / 2 - 0.13, 0), (0.0, -CAP / 2 + 0.13, 0)):  # the nuclei of the wall's two cells
        ax.add_patch(Ellipse((cx + x, y), 0.75, 0.3, angle=a, facecolor="#7d6b7d", edgecolor=INK, linewidth=0.8, zorder=3))
    ax.add_patch(Ellipse((cx, 0), CAP * 0.72, CAP * 0.62, facecolor="#c96a6a", edgecolor=INK, linewidth=1.0, zorder=3))  # a red cell
    ax.add_patch(Ellipse((cx, 0), CAP * 0.3, CAP * 0.24, facecolor="#e09a9a", edgecolor="none", zorder=3))


def draw(p: dict):
    import matplotlib.pyplot as plt
    fig, ax = plt.subplots(figsize=(8.4, 4.0))
    a, v = p["artery"], p["vein"]
    s = SIZE / max(a["lumen"] + 2 * a["wall"], v["lumen"] + 2 * v["wall"])  # one scale for the artery and the vein
    for i, t in enumerate(p["order"]):
        cx = i * GAP
        if t == "artery":
            _artery(ax, cx, s, a["wall"], a["lumen"])
            lines = [f"wall: {a['wall']:.1f} mm", f"lumen: {a['lumen']:.1f} mm"]
        elif t == "vein":
            _vein(ax, cx, s, v["wall"], v["lumen"])
            lines = [f"wall: {v['wall']:.1f} mm", f"lumen: {v['lumen']:.1f} mm"]
        else:
            _capillary(ax, cx)
            lines = ["wall: one cell thick", f"lumen: {p['cap_lumen']} µm"]
        ax.text(cx, -2.95, LETTERS[i], ha="center", va="center", fontsize=15, fontweight="bold", gid=f"letter:{LETTERS[i]}")
        ax.text(cx, -3.75, lines[0], ha="center", va="center", fontsize=10)
        ax.text(cx, -4.35, lines[1], ha="center", va="center", fontsize=10)
    ax.text(GAP, 2.95, "The artery and the vein are drawn to one scale; the capillary is magnified much more.",
            ha="center", va="center", fontsize=9, style="italic")
    ax.set_xlim(-SIZE / 2 - 0.6, 2 * GAP + SIZE / 2 + 0.6)
    ax.set_ylim(-4.8, 3.35)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


# --- questions --------------------------------------------------------------------------------------

SETTINGS = ["in a biology lesson in Huye", "from microscope slides at a school in Musanze", "for a class display in Kigali",
            "in a practical at a school in Rubavu", "from a textbook at a school in Nyagatare", "at the science club in Muhanga",
            "for revision at a school near Lake Kivu"]
VERBS = ["drew", "copied", "labelled", "studied"]
FIRST = {"artery": ["Which letter shows an artery?", "Which letter labels an artery?"],
         "pressure": ["Which letter shows the vessel that carries blood at the highest pressure?",
                      "Which letter shows the vessel that carries blood at the highest pressure, straight from the heart?"]}
LETTER_Q = {"valves": ("vein", ["Which letter shows the kind of vessel that has valves to stop blood flowing backwards?",
                                "Which letter shows the kind of vessel that has valves along its length?"]),
            "low": ("vein", ["Which letter shows the vessel that carries blood at the lowest pressure?"]),
            "exchange": ("capillary", ["Which letter shows the vessel where substances are exchanged between the blood and the cells?",
                                       "Which letter shows the vessel where oxygen and glucose are exchanged with the tissues?"])}


def _letter(stem: str, key: str) -> Question:
    """A letter chosen from P, Q and R, offered in order."""
    return Question("mcq", stem, str(LETTERS.index(key)), list(LETTERS))


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    letter = {t: LETTERS[i] for i, t in enumerate(p["order"])}
    a, v = p["artery"], p["vein"]
    qs = [_letter(f"{who} {rng.choice(VERBS)} cross-sections of three blood vessels {rng.choice(SETTINGS)}. "
                  f"{rng.choice(FIRST[p['first']])}", letter["artery"])]
    k = Fraction(str(a["wall"])) / Fraction(str(v["wall"]))
    qs.append(short("How many times thicker is the wall of the artery than the wall of the vein?", int(k),
                    [str(int(k)), f"{int(k)} times", f"{int(k)} times thicker", f"×{int(k)}", f"{int(k)}x"]))
    want, stems = LETTER_Q[p["letter_q"]]
    qs.append(_letter(rng.choice(stems), letter[want]))
    t = p["diameter"]
    w, lum = Fraction(str(p[t]["wall"])), Fraction(str(p[t]["lumen"]))
    dia = lum + 2 * w
    qs.append(short(f"What is the outer diameter of the {t}? (outer diameter = lumen width + 2 × wall thickness)", exact(dia),
                    measure(dia, "mm") + ([f"{float(dia):.1f}", f"{float(dia):.1f} mm"] if dia.denominator == 1 else [])))
    return qs
