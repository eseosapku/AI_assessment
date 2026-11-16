"""Hooke's law (AL, Further Mathematics "Hooke's law"): light elastic strings and springs, T = λx/l and EPE = λx²/2l.

Four kinds of figure, each printing Hooke's law, the elastic potential energy and g = 10 m s⁻²:
- hang: a particle P hangs in equilibrium from a fixed point A on a light elastic string or spring (natural length and
  modulus printed). The extension, the length AP, the energy stored, the acceleration just after P is pulled down a
  stated distance and released.
- table: P lies on a smooth horizontal table between fixed points A and B, joined to each by a light elastic string
  (each string's natural length and modulus printed beside it), AB printed. The length AP, the tension, the energy
  stored in both strings.
- drop: P is released from rest at the fixed point O to which its string is tied, and falls vertically. The greatest
  extension (from the energy equation), the greatest distance below O, the speed when the string becomes taut.
- release: P on a smooth horizontal table is held with its string stretched (OP printed) and released. The tension
  and acceleration at release, the energy stored, the speed when the string becomes slack.

Every key is a whole number or a short terminating decimal.
"""
from __future__ import annotations

import math
import random
from fractions import Fraction

from matplotlib.patches import Circle

from ..core import FILL_2, INK, NAMES, mcq, new_figure
from ._mech import G, answer, arrow, fmt, hatch

ID = "elastic_string_m"
KIND = "physics.force"
SUBJECT = "mathematics"
BANDS = ("AL",)
CONCEPTS = ("mathematics.objects-equilibrium", "mathematics.work-energy-principle", "mathematics.mechanics")
NEEDS = r"hooke|elastic"
# Only the chapter named for it: chapters without sections ("Chapter 9: Integration") share the work-energy principle.
AVOID = r"^(?!.*(hooke|elastic))"

F = Fraction
MASSES = [F(1, 5), F(1, 4), F(2, 5), F(1, 2), F(3, 5), F(4, 5), F(1), F(6, 5), F(3, 2), F(2), F(5, 2), F(3), F(4), F(5)]
LENGTHS = [F(2, 5), F(1, 2), F(3, 5), F(3, 4), F(4, 5), F(1), F(6, 5), F(3, 2), F(2), F(5, 2)]
FORMULAS = ["T = λx / l", "EPE = λx² / (2l)", f"g = {G} m s⁻²"]
HANG_LEADS = ["{n} hangs a particle P from a fixed point A on a light elastic {w}.",
              "{n} attaches a particle P to one end of a light elastic {w}, whose other end is fixed at A.",
              "{n} sets up a particle P hanging in equilibrium below a fixed point A on a light elastic {w}."]
TABLE_LEADS = ["{n} fixes two light elastic strings to a particle P on a smooth horizontal table.",
               "{n} holds a particle P between two fixed points A and B on a smooth horizontal table with elastic strings.",
               "{n} sets up a particle P on a smooth horizontal table, joined to fixed points A and B by elastic strings."]
DROP_LEADS = ["{n} ties a particle P to a fixed point O with a light elastic string and lets it fall from O.",
              "{n} releases a particle P from rest at a fixed point O; P is tied to O by a light elastic string.",
              "{n} drops a particle P from rest at O, the fixed end of the light elastic string tied to P."]
RELEASE_LEADS = ["{n} pulls a particle P across a smooth horizontal table, stretching its elastic string, and lets go.",
                 "{n} holds a particle P on a smooth horizontal table with its elastic string stretched, then releases it.",
                 "{n} releases a particle P from rest on a smooth horizontal table, its elastic string stretched."]


def _short(x: Fraction, places: int = 3) -> bool:
    return (x * 10 ** places).denominator == 1


def sample(rng: random.Random) -> dict:
    sub = rng.choice(["hang", "table", "drop", "release"])
    name = rng.choice(NAMES)
    while True:
        if sub == "hang":
            m, l = rng.choice(MASSES), rng.choice(LENGTHS)
            lam = F(rng.randint(5, 120))
            x = m * G * l / lam
            if not (_short(x) and l / 10 <= x <= l and _short(lam * x * x / (2 * l), 4)):
                continue
            d = rng.choice([d for d in (F(1, 20), F(1, 10), F(3, 20), F(1, 5), F(1, 4)) if d <= x] or [None])
            if d is None or not _short(lam * d / (m * l)):
                continue
            return {"band": "AL", "sub": sub, "what": rng.choice(["string", "spring"]), "m": fmt(m), "l": fmt(l),
                    "lam": fmt(lam), "d": fmt(d), "name": name}
        if sub == "table":
            l1, l2 = rng.choice(LENGTHS[:8]), rng.choice(LENGTHS[:8])
            k1, k2 = rng.randint(5, 60), rng.randint(5, 60)
            lam1, lam2 = k1 * l1, k2 * l2
            s = rng.choice([F(3, 10), F(2, 5), F(1, 2), F(3, 5), F(4, 5), F(1), F(6, 5)])
            e1 = s * k2 / (k1 + k2)
            if k1 == k2 or not (_short(lam1, 1) and _short(lam2, 1) and _short(e1) and lam1 >= 3 and lam2 >= 3):
                continue
            e2 = s - e1
            if not _short(F(1, 2) * (k1 * e1 * e1 + k2 * e2 * e2), 4):
                continue
            return {"band": "AL", "sub": sub, "l": [fmt(l1), fmt(l2)], "lam": [fmt(lam1), fmt(lam2)],
                    "D": fmt(l1 + l2 + s), "name": name}
        if sub == "drop":
            l = rng.choice([F(1, 5), F(9, 20), F(4, 5), F(5, 4), F(9, 5), F(49, 20), F(16, 5)])  # 2gl a square
            m = rng.choice(MASSES)
            x = rng.choice([F(1, 5), F(1, 4), F(2, 5), F(1, 2), F(3, 5), F(4, 5), F(1), F(6, 5), F(3, 2), F(2)])
            lam = 2 * m * G * l * (l + x) / (x * x)
            if not (x <= 2 * l and _short(lam, 1) and 5 <= lam <= 400):
                continue
            return {"band": "AL", "sub": sub, "m": fmt(m), "l": fmt(l), "lam": fmt(lam), "name": name}
        m, l = rng.choice(MASSES), rng.choice(LENGTHS)
        k = rng.randint(2, 10)  # λ/(ml) = k², so the speed at slack is k x
        lam = k * k * m * l
        x = rng.choice([F(1, 10), F(3, 20), F(1, 5), F(1, 4), F(3, 10), F(2, 5), F(1, 2)])
        if not (_short(lam, 1) and 2 <= lam <= 300 and x <= l and _short(lam * x * x / (2 * l), 4)):
            continue
        return {"band": "AL", "sub": sub, "m": fmt(m), "l": fmt(l), "lam": fmt(lam), "op": fmt(l + x), "name": name}


# --- drawing -----------------------------------------------------------------------------------------------

def _string(ax, x0, y0, x1, y1, spring: bool, gid: str) -> None:
    if not spring:
        ax.plot([x0, x1], [y0, y1], color=INK, linewidth=1.6, gid=gid)
        return
    n, amp = 12, 0.13
    L = math.hypot(x1 - x0, y1 - y0)
    ux, uy = (x1 - x0) / L, (y1 - y0) / L
    pts = [(x0, y0), (x0 + ux * 0.15 * L, y0 + uy * 0.15 * L)]
    for i in range(1, n):
        t = 0.15 + 0.7 * i / n
        side = amp if i % 2 else -amp
        pts.append((x0 + ux * t * L - uy * side, y0 + uy * t * L + ux * side))
    pts += [(x0 + ux * 0.85 * L, y0 + uy * 0.85 * L), (x1, y1)]
    ax.plot([p[0] for p in pts], [p[1] for p in pts], color=INK, linewidth=1.4, gid=gid)


def _particle(ax, x, y, gid="P"):
    ax.add_patch(Circle((x, y), 0.17, facecolor=FILL_2, edgecolor=INK, linewidth=1.5, gid="particle"))


def _note(ax, lines, x=0.99, y=0.98, ha="right"):
    ax.text(x, y, "\n".join(lines), transform=ax.transAxes, ha=ha, va="top", fontsize=10.5, linespacing=1.5, gid="note", multialignment="left",
            bbox={"boxstyle": "round,pad=0.4", "facecolor": "white", "edgecolor": INK, "linewidth": 0.9})


def _draw_hang(p: dict):
    fig, ax = new_figure(6.4, 4.8)
    m, l, lam = F(p["m"]), F(p["l"]), F(p["lam"])
    x = m * G * l / lam
    total = float(l + x)
    scale = 3.0 / total
    hatch(ax, -0.9, 3.4, 0.9, 3.4, side=1, size=0.18, gid="ceiling")
    ax.text(-0.18, 3.2, "A", ha="right", va="top", fontsize=12, fontweight="bold", gid="A")
    py = 3.4 - total * scale
    _string(ax, 0, 3.4, 0, py + 0.17, p["what"] == "spring", "string")
    _particle(ax, 0, py)
    ax.text(0.3, py, "P", ha="left", va="center", fontsize=12, fontweight="bold", gid="Plabel")
    ax.text(-0.3, py, f"{p['m']} kg", ha="right", va="center", fontsize=11, gid="mass")
    _note(ax, [f"light elastic {p['what']} AP", f"natural length {p['l']} m", f"modulus λ = {p['lam']} N", *FORMULAS])
    ax.set_xlim(-2.0, 4.6)
    ax.set_ylim(py - 0.5, 3.75)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def _draw_table(p: dict):
    fig, ax = new_figure(7.4, 3.6)
    l1, l2 = (F(v) for v in p["l"])
    k1, k2 = F(p["lam"][0]) / l1, F(p["lam"][1]) / l2
    D = F(p["D"])
    s = D - l1 - l2
    e1 = s * k2 / (k1 + k2)
    W = 7.0
    sc = W / float(D)
    ax.add_patch(Circle((0, 0), 0.12, facecolor=INK, edgecolor=INK))
    ax.add_patch(Circle((W, 0), 0.12, facecolor=INK, edgecolor=INK))
    ax.text(-0.2, 0, "A", ha="right", va="center", fontsize=12, fontweight="bold", gid="A")
    ax.text(W + 0.2, 0, "B", ha="left", va="center", fontsize=12, fontweight="bold", gid="B")
    px = float(l1 + e1) * sc
    ax.plot([0.12, px - 0.17], [0, 0], color=INK, linewidth=1.6, gid="string-AP")
    ax.plot([px + 0.17, W - 0.12], [0, 0], color=INK, linewidth=1.6, gid="string-PB")
    _particle(ax, px, 0)
    ax.text(px, -0.3, "P", ha="center", va="top", fontsize=12, fontweight="bold", gid="Plabel")
    for xm, l, lam, gid in ((px / 2, p["l"][0], p["lam"][0], "AP"), ((px + W) / 2, p["l"][1], p["lam"][1], "PB")):
        ax.text(xm, 0.25, f"natural length {l} m\nλ = {lam} N", ha="center", va="bottom", fontsize=10.5,
                linespacing=1.4, gid=f"label-{gid}")
    y = -0.95
    arrow(ax, W / 2, y, 0, y, lw=1.0, head=8, gid="D-left")
    arrow(ax, W / 2, y, W, y, lw=1.0, head=8, gid="D-right")
    ax.text(W / 2, y - 0.12, f"AB = {p['D']} m", ha="center", va="top", fontsize=11, gid="D")
    ax.text(W / 2, 1.55, "   ".join(FORMULAS[:2]), ha="center", va="bottom", fontsize=10.5, gid="note")
    ax.set_xlim(-0.8, W + 0.8)
    ax.set_ylim(-1.55, 2.0)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def _draw_drop(p: dict):
    fig, ax = new_figure(6.4, 4.8)
    hatch(ax, -0.6, 3.4, 0.6, 3.4, side=1, size=0.18, gid="ceiling")
    ax.plot([0], [3.4], "o", color=INK, markersize=4)
    ax.text(-0.3, 3.28, "O", ha="right", va="top", fontsize=12, fontweight="bold", gid="O")
    _particle(ax, 0.0, 3.23)
    ax.text(0.3, 3.23, "P", ha="left", va="center", fontsize=12, fontweight="bold", gid="Plabel")
    ax.text(0.62, 3.23, f"({p['m']} kg)", ha="left", va="center", fontsize=11, gid="mass")
    ax.plot([0, 0], [3.0, 1.4], color=INK, linewidth=0.9, linestyle=(0, (4, 3)), gid="fall")
    arrow(ax, 0, 1.4, 0, 0.6, lw=1.6, gid="down")
    ax.text(0.2, 1.0, "P falls from rest at O", ha="left", va="center", fontsize=10.5, style="italic", gid="falls")
    _note(ax, ["light elastic string OP", f"natural length {p['l']} m", f"modulus λ = {p['lam']} N", *FORMULAS])
    ax.set_xlim(-2.0, 4.6)
    ax.set_ylim(0.3, 3.75)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def _draw_release(p: dict):
    fig, ax = new_figure(7.2, 3.4)
    W = 6.0
    ax.add_patch(Circle((0, 0), 0.12, facecolor=INK, edgecolor=INK))
    ax.text(-0.2, 0, "O", ha="right", va="center", fontsize=12, fontweight="bold", gid="O")
    ax.plot([0.12, W - 0.17], [0, 0], color=INK, linewidth=1.6, gid="string")
    _particle(ax, W, 0)
    ax.text(W, -0.3, "P", ha="center", va="top", fontsize=12, fontweight="bold", gid="Plabel")
    ax.text(W + 0.3, 0.0, f"{p['m']} kg", ha="left", va="center", fontsize=11, gid="mass")
    y = -0.85
    arrow(ax, W / 2, y, 0, y, lw=1.0, head=8, gid="OP-left")
    arrow(ax, W / 2, y, W, y, lw=1.0, head=8, gid="OP-right")
    ax.text(W / 2, y - 0.12, f"OP = {p['op']} m", ha="center", va="top", fontsize=11, gid="OP")
    ax.text(W / 2, 0.3, f"light elastic string: natural length {p['l']} m, λ = {p['lam']} N", ha="center",
            va="bottom", fontsize=10.5, gid="string-label")
    ax.text(W / 2, 1.1, "   ".join(FORMULAS[:2]), ha="center", va="bottom", fontsize=10.5, gid="note")
    ax.text(W / 2, 1.7, "smooth horizontal table, seen from above; P is released from rest", ha="center", va="bottom",
            fontsize=10, style="italic", gid="table")
    ax.set_xlim(-0.8, W + 1.4)
    ax.set_ylim(-1.45, 2.2)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def draw(p: dict):
    return {"hang": _draw_hang, "table": _draw_table, "drop": _draw_drop, "release": _draw_release}[p["sub"]](p)


# --- questions ---------------------------------------------------------------------------------------------

def _epe(stem: str, lam: Fraction, l: Fraction, x: Fraction, rng: random.Random):
    """The energy stored, typed or chosen; the wrong options forget the half, square the stretched length instead of
    the extension, or leave x unsquared."""
    key = lam * x * x / (2 * l)
    if rng.random() < 0.5:
        return answer(stem, key, "J")
    wrongs = [lam * x * x / l, lam * (l + x) ** 2 / (2 * l), lam * x / (2 * l)]
    opts = []
    for w in wrongs:
        if w != key and fmt(w) not in opts and fmt(w) != fmt(key):
            opts.append(fmt(w))
    return mcq(stem.replace("Find the", "What is the").replace(", in joules,", "").replace("equilibrium.", "equilibrium?"),
               f"{fmt(key)} J", [f"{o} J" for o in opts], rng)


def questions(p: dict, rng: random.Random) -> list:
    sub, name = p["sub"], p["name"]
    if sub == "hang":
        lead = rng.choice(HANG_LEADS).format(n=name, w=p["what"])
        m, l, lam, d = F(p["m"]), F(p["l"]), F(p["lam"]), F(p["d"])
        x = m * G * l / lam
        w = p["what"]
        qs = [
            lambda: answer(f"P hangs in equilibrium. Find the extension, in metres, of the {w} AP.", x, "m"),
            lambda: answer(f"P hangs in equilibrium. Find the length AP, in metres, of the stretched {w}.", l + x, "m"),
            lambda: _epe(f"Find the elastic potential energy, in joules, stored in the {w} AP when P hangs in equilibrium.",
                         lam, l, x, rng),
            lambda: answer(f"P is pulled down a further {p['d']} m from its equilibrium position and released from rest. "
                           f"Find the magnitude of its acceleration, in m s⁻², at that moment.", lam * d / (m * l), "m/s²"),
        ]
    elif sub == "table":
        lead = rng.choice(TABLE_LEADS).format(n=name)
        l1, l2 = (F(v) for v in p["l"])
        lam1, lam2 = (F(v) for v in p["lam"])
        k1, k2 = lam1 / l1, lam2 / l2
        s = F(p["D"]) - l1 - l2
        e1, e2 = s * k2 / (k1 + k2), s * k1 / (k1 + k2)
        qs = [
            lambda: answer("P rests in equilibrium on the line AB. Find the distance AP in metres.", l1 + e1, "m"),
            lambda: answer("P rests in equilibrium on the line AB. Find the tension, in newtons, in the string AP.",
                           k1 * e1, "N"),
            lambda: answer("With P in equilibrium, find the total elastic potential energy, in joules, stored in the "
                           "strings AP and PB.", F(1, 2) * (k1 * e1 * e1 + k2 * e2 * e2), "J"),
        ]
    elif sub == "drop":
        lead = rng.choice(DROP_LEADS).format(n=name)
        m, l, lam = F(p["m"]), F(p["l"]), F(p["lam"])
        # mg(l + x) = λx²/2l: the positive root of λx² - 2mglx - 2mgl² = 0
        a, b, c = lam, -2 * m * G * l, -2 * m * G * l * l
        disc = b * b - 4 * a * c
        root = F(math.isqrt(disc.numerator), math.isqrt(disc.denominator))
        x = (-b + root) / (2 * a)
        v = F(math.isqrt((2 * G * l).numerator), math.isqrt((2 * G * l).denominator))
        qs = [
            lambda: answer("Find the greatest extension, in metres, of the string OP as P falls.", x, "m"),
            lambda: answer("Find the greatest distance, in metres, of P below O.", l + x, "m"),
            lambda: answer("Find the speed of P, in m s⁻¹, at the moment the string OP becomes taut.", v, "m/s"),
        ]
    else:
        lead = rng.choice(RELEASE_LEADS).format(n=name)
        m, l, lam = F(p["m"]), F(p["l"]), F(p["lam"])
        x = F(p["op"]) - l
        k2 = lam / (m * l)
        k = F(math.isqrt(k2.numerator), math.isqrt(k2.denominator))
        qs = [
            lambda: answer("Find the tension, in newtons, in the string OP at the moment P is released.", lam * x / l, "N"),
            lambda: answer("Find the acceleration of P, in m s⁻², at the moment it is released.", lam * x / (m * l), "m/s²"),
            lambda: answer("Find the elastic potential energy, in joules, stored in the string OP before P is released.",
                           lam * x * x / (2 * l), "J"),
            lambda: answer("Find the speed of P, in m s⁻¹, at the moment the string OP becomes slack.", k * x, "m/s"),
        ]
    order = rng.sample(range(len(qs)), 3)
    out = [qs[i]() for i in order]
    out[0].stem = f"{lead} {out[0].stem}"
    return out
