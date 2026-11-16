"""Circular measure (UP, AL), as Cambridge IGCSE & O Level Additional Mathematics "Circular measure" (length of an arc,
area of a sector) and Cambridge AS & A Level Mathematics "Convert between degrees and radians" and "Trigonometry" teach
it: angles in radians, arc length s = rθ and sector area ½r²θ.

Kinds of figure:
- sector (UP, AL): a sector OAB, its radius printed and its angle at O in radians (a decimal such as 1.2, or a
  fraction of π). The arc length AB, the perimeter of the sector, its area -- exact, in terms of π where the angle is.
- arc (UP): a sector with its radius and its arc length printed. The angle AOB in radians.
- segment (UP): a quarter circle with the chord AB drawn and the segment shaded. The shaded area, exactly.
- convert (AL): a circle with an angle marked at its centre, in degrees or in radians. The angle in the other unit.
- unit (AL): the unit circle with the point P at an angle θ from the positive x-axis (θ printed in radians). The
  exact value of cos θ, sin θ or tan θ (MCQ: the sign and the size varied, 2 by 2).
"""
from __future__ import annotations

import math
import random
from fractions import Fraction

from matplotlib.patches import Arc, Circle, Polygon, Wedge

from ..core import FILL_2, INK, NAMES, mcq, new_figure, short

ID = "circular_measure"
KIND = "maths.geometry"
SUBJECT = "mathematics"
BANDS = ("UP", "AL")
CONCEPTS = ("mathematics.pi-constant", "mathematics.circle-elements", "mathematics.degrees-conversion",
            "mathematics.trigonometric-concepts")
# A topic whose sections the book lists is reached only if its name or a section names arcs, sectors or radians.
NEEDS = r"circular measure|\barcs?\b|sector|radian|degrees|trigonometry"
AVOID = r"polar|circular motion|bearings|symmetry"

PI = "π"
SECTOR_LEADS = ["{n} cuts a sector OAB from a circle of centre O.", "{n} draws a sector OAB of a circle with centre O.",
                "{n} designs a fan-shaped badge, the sector OAB.", "{n} marks out a sector-shaped flower bed OAB."]
UNIT_LEADS = ["{n} marks a point P on the unit circle.", "{n} draws the unit circle and the point P on it.",
              "{n} plots P on a circle of radius 1 centred at the origin.", "{n} shows the angle θ on the unit circle."]
CONVERT_LEADS = ["{n} marks an angle at the centre of a circle.", "{n} draws an angle at the centre O of a circle.",
                 "{n} measures the angle at the centre of the circle shown.", "{n} labels an angle at the centre of a circle."]
NICE = [Fraction(1, 6), Fraction(1, 4), Fraction(1, 3), Fraction(1, 2), Fraction(2, 3), Fraction(3, 4), Fraction(5, 6)]
UNIT_ANGLES = [Fraction(k, 6) for k in (1, 2, 4, 5, 7, 8, 10, 11)] + [Fraction(k, 4) for k in (1, 3, 5, 7)]


def concepts_for(p: dict) -> tuple[str, ...]:
    if p["band"] == "AL":
        return ("mathematics.degrees-conversion", "mathematics.trigonometric-concepts")
    return ("mathematics.pi-constant", "mathematics.circle-elements")


def sample(rng: random.Random) -> dict:
    band = rng.choice(BANDS)
    sub = rng.choice(["sector", "arc", "segment", "sector"] if band == "UP" else ["sector", "convert", "unit"])
    p = {"band": band, "sub": sub, "name": rng.choice(NAMES)}
    if sub in ("sector", "arc"):
        r = rng.randint(3, 15)
        if sub == "sector" and rng.random() < 0.5:
            f = rng.choice(NICE)
            p.update(r=r, pi=[f.numerator, f.denominator])
        else:
            p.update(r=r, theta=rng.randint(4, 25) / 10)
        p["ask"] = rng.choice(["arc", "perimeter", "area"])
        return p
    if sub == "segment":
        p.update(r=rng.choice([2, 4, 6, 8, 10, 12]))
        return p
    if sub == "convert":
        deg = rng.choice([d for d in range(15, 360, 15) if d not in (90, 180, 270)])
        p.update(deg=deg, shown=rng.choice(["deg", "rad"]))
        return p
    t = rng.choice(UNIT_ANGLES)
    p.update(t=[t.numerator, t.denominator], fn=rng.choice(["cos", "sin", "tan"]))
    return p


# --- exact numbers ----------------------------------------------------------------------------------------

def pi_text(f: Fraction) -> str:
    """aπ/b as printed: π/3, 2π/3, 4π, 0."""
    if f == 0:
        return "0"
    a, b = f.numerator, f.denominator
    head = ("" if a == 1 else "−" if a == -1 else str(a).replace("-", "−")) + PI
    return head if b == 1 else f"{head}/{b}"


def pi_forms(f: Fraction, unit: str = "") -> list[str]:
    a, b = f.numerator, f.denominator
    k = "" if a == 1 else str(a)
    base = [pi_text(f), (f"{k}pi" if b == 1 else f"{k}pi/{b}"), (f"{k}π" if b == 1 else f"({a}/{b})π"),
            (f"{k} π" if b == 1 else f"{a}/{b} π"), (f"{k}π" if b == 1 else f"{a}π/{b}")]
    out = list(dict.fromkeys(base))
    if unit:
        out += [f"{x} {unit}" for x in out]
    return out


def dec_forms(v: Fraction, unit: str) -> list[str]:
    s = format(float(v), ".10g")
    out = [s]
    out += [f"{s} {unit}", f"{s}{unit}"]
    return out


def theta(p: dict) -> tuple[Fraction, bool]:
    """The sector's angle: the multiple of π (and True), or the decimal in radians (and False)."""
    if "pi" in p:
        return Fraction(*p["pi"]), True
    return Fraction(str(p["theta"])), False


# --- drawing ------------------------------------------------------------------------------------------------

def _draw_sector(p: dict):
    fig, ax = new_figure(5.6, 4.6)
    t, in_pi = theta(p)
    ang = math.degrees(float(t) * math.pi if in_pi else float(t))
    R = 2.4
    start = 90 - ang / 2  # the sector opens upwards, its arc on top
    ax.add_patch(Wedge((0, 0), R, start, start + ang, facecolor=FILL_2, edgecolor=INK, linewidth=2.0, gid="behind-sector"))
    a0, a1 = math.radians(start), math.radians(start + ang)
    A, B = (R * math.cos(a0), R * math.sin(a0)), (R * math.cos(a1), R * math.sin(a1))
    for (x, y), lab in ((A, "A"), (B, "B")):
        d = math.hypot(x, y)
        ax.text(x * (d + 0.32) / d, y * (d + 0.32) / d, lab, ha="center", va="center", fontsize=13, fontweight="bold",
                gid=f"pt:{lab}")
    ax.text(0, -0.32, "O", ha="center", va="center", fontsize=13, fontweight="bold", gid="pt:O")
    ax.add_patch(Arc((0, 0), 0.9, 0.9, theta1=start, theta2=start + ang, color=INK, linewidth=1.2, gid="angle-arc"))
    label = "θ" if p["sub"] == "arc" else pi_text(t) if in_pi else f"{p['theta']} rad"
    mid = math.radians(start + ang / 2)
    rl = 0.82 if ang > 60 else 1.1
    ax.text(rl * math.cos(mid), rl * math.sin(mid), label, ha="center", va="center", fontsize=12, gid="angle",
            bbox={"boxstyle": "round,pad=0.1", "facecolor": FILL_2, "edgecolor": "none"})
    # the radius printed beside OA, outside the sector
    ox, oy = A[0] / 2, A[1] / 2
    nx, ny = math.sin(a0), -math.cos(a0)
    ax.text(ox + 0.38 * nx, oy + 0.38 * ny, f"{p['r']} cm", ha="center", va="center", fontsize=12, gid="radius")
    if p["sub"] == "arc":
        s = Fraction(p["r"]) * t
        ax.text(0, R + 0.55, f"arc AB = {format(float(s), 'g')} cm", ha="center", va="center", fontsize=12, gid="arclen")
    ax.set_xlim(-R - 1.3, R + 1.3)
    ax.set_ylim(min(-0.7, min(A[1], B[1]) - 0.6), R + 0.95)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def _draw_segment(p: dict):
    fig, ax = new_figure(4.8, 4.6)
    R = 2.6
    ax.add_patch(Wedge((0, 0), R, 0, 90, facecolor="white", edgecolor=INK, linewidth=2.0, gid="behind-sector"))
    pts = [(R * math.cos(math.radians(a)), R * math.sin(math.radians(a))) for a in range(0, 91, 2)]
    ax.add_patch(Polygon(pts, closed=True, facecolor="#f6c26b", edgecolor=INK, linewidth=1.4, gid="behind-segment"))
    ax.plot([0.25, 0.25, 0], [0, 0.25, 0.25], color=INK, linewidth=1.1, gid="behind-right")
    ax.text(R + 0.3, -0.05, "A", ha="center", va="center", fontsize=13, fontweight="bold", gid="pt:A")
    ax.text(-0.05, R + 0.3, "B", ha="center", va="center", fontsize=13, fontweight="bold", gid="pt:B")
    ax.text(-0.3, -0.3, "O", ha="center", va="center", fontsize=13, fontweight="bold", gid="pt:O")
    ax.text(R / 2, -0.32, f"{p['r']} cm", ha="center", va="center", fontsize=12, gid="radius")
    ax.set_xlim(-0.7, R + 0.7)
    ax.set_ylim(-0.7, R + 0.7)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def _draw_convert(p: dict):
    fig, ax = new_figure(4.8, 4.6)
    R = 2.2
    ax.add_patch(Circle((0, 0), R, fill=False, edgecolor=INK, linewidth=1.8, gid="circle"))
    deg = p["deg"]
    ax.plot([0, R], [0, 0], color=INK, linewidth=1.6)
    ax.plot([0, R * math.cos(math.radians(deg))], [0, R * math.sin(math.radians(deg))], color=INK, linewidth=1.6)
    ax.add_patch(Arc((0, 0), 0.9, 0.9, theta1=0, theta2=deg, color=INK, linewidth=1.3, gid="angle-arc"))
    label = f"{deg}°" if p["shown"] == "deg" else pi_text(Fraction(deg, 180))
    mid = math.radians(deg / 2)
    ax.text(0.85 * math.cos(mid), 0.85 * math.sin(mid), label, ha="center", va="center", fontsize=12, gid="angle",
            bbox={"boxstyle": "round,pad=0.1", "facecolor": "white", "edgecolor": "none"})
    ax.plot([0], [0], "o", color=INK, markersize=4)
    ax.text(-0.25, -0.25, "O", ha="center", va="center", fontsize=12, fontweight="bold", gid="pt:O")
    ax.set_xlim(-R - 0.3, R + 0.3)
    ax.set_ylim(-R - 0.3, R + 0.3)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def _draw_unit(p: dict):
    fig, ax = new_figure(5.0, 5.0)
    t = Fraction(*p["t"])
    a = float(t) * math.pi
    ax.plot([-1.35, 1.35], [0, 0], color=INK, linewidth=1.0)
    ax.plot([0, 0], [-1.35, 1.35], color=INK, linewidth=1.0)
    ax.text(1.42, -0.02, "x", ha="left", va="center", fontsize=12, gid="axis:x")
    ax.text(0.03, 1.42, "y", ha="left", va="bottom", fontsize=12, gid="axis:y")
    ax.add_patch(Circle((0, 0), 1, fill=False, edgecolor=INK, linewidth=1.6, gid="circle"))
    px, py = math.cos(a), math.sin(a)
    ax.plot([0, px], [0, py], color=INK, linewidth=1.6, gid="radius")
    ax.plot([px], [py], "o", color=INK, markersize=6)
    ax.text(px * 1.17, py * 1.17, "P", ha="center", va="center", fontsize=13, fontweight="bold", gid="pt:P")
    ax.add_patch(Arc((0, 0), 0.5, 0.5, theta1=0, theta2=math.degrees(a), color=INK, linewidth=1.2, gid="angle-arc"))
    mid = a / 2
    ax.text(0.45 * math.cos(mid), 0.45 * math.sin(mid), "θ", ha="center", va="center", fontsize=12, gid="theta")
    ax.text(-1.4, -1.45, f"θ = {pi_text(t)}   (radius 1)", ha="left", va="center", fontsize=12, gid="given")
    ax.set_xlim(-1.55, 1.6)
    ax.set_ylim(-1.6, 1.6)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def draw(p: dict):
    return {"sector": _draw_sector, "arc": _draw_sector, "segment": _draw_segment, "convert": _draw_convert,
            "unit": _draw_unit}[p["sub"]](p)


# --- questions ----------------------------------------------------------------------------------------------

def _trig_exact(fn: str, t: Fraction) -> tuple[int, str]:
    """(sign, size) of cos, sin or tan at tπ, by the reference angle -- size as printed: 1/2, √3/2, √2/2, 1, √3, √3/3."""
    a = float(t) * math.pi
    value = {"cos": math.cos(a), "sin": math.sin(a), "tan": math.tan(a)}[fn]
    sign = 1 if value > 0 else -1
    v = abs(value)
    for size, x in (("1/2", 0.5), ("√3/2", math.sqrt(3) / 2), ("√2/2", math.sqrt(2) / 2), ("1", 1.0), ("√3", math.sqrt(3)),
                    ("√3/3", math.sqrt(3) / 3)):
        if abs(v - x) < 1e-9:
            return sign, size
    raise ValueError((fn, t))


def questions(p: dict, rng: random.Random) -> list:
    name, sub = p["name"], p["sub"]
    if sub in ("sector", "arc"):
        t, in_pi = theta(p)
        r = Fraction(p["r"])
        lead = rng.choice(SECTOR_LEADS).format(n=name)
        if sub == "arc":
            return [short(f"{lead} Find the angle AOB in radians.", format(float(t), "g"),
                          [format(float(t), "g"), f"{format(float(t), 'g')} rad", f"{format(float(t), 'g')} radians"])]
        if p["ask"] == "arc":
            v = r * t
            stem = f"{lead} Find the length of the arc AB" + (", in terms of π." if in_pi else ", in centimetres.")
            return [short(stem, pi_text(v) if in_pi else format(float(v), "g"),
                          pi_forms(v, "cm") if in_pi else dec_forms(v, "cm"))]
        if p["ask"] == "area":
            v = r * r * t / 2
            stem = f"{lead} Find the area of the sector" + (", in terms of π." if in_pi else ", in cm².")
            return [short(stem, pi_text(v) if in_pi else format(float(v), "g"),
                          pi_forms(v, "cm²") if in_pi else dec_forms(v, "cm²"))]
        v = r * t
        if in_pi:
            key = f"{int(2 * r)} + {pi_text(v)}"
            forms = [key, key.replace(" ", ""), key.replace(PI, "pi"), f"{pi_text(v)} + {int(2 * r)}"]
            return [short(f"{lead} Find the perimeter of the sector, in terms of π.", key, forms)]
        return [short(f"{lead} Find the perimeter of the sector, in centimetres.", format(float(2 * r + v), "g"),
                      dec_forms(2 * r + v, "cm"))]
    if sub == "segment":
        r = p["r"]
        a, b = r * r // 4, r * r // 2  # r²π/4 − r²/2
        key = f"{a}{PI} − {b}" if a != 1 else f"{PI} − {b}"
        forms = [key, key.replace(" ", ""), key.replace("−", "-"), key.replace("−", "-").replace(" ", ""),
                 key.replace(PI, "pi").replace("−", "-"), f"{a}(π − 2)" if a != 1 else "π − 2"]
        lead = rng.choice(SECTOR_LEADS).format(n=name).replace("sector OAB", "quarter circle OAB")
        return [short(f"{lead} The chord AB is drawn. Find the exact area of the shaded segment, in cm².", key, forms)]
    if sub == "convert":
        deg = p["deg"]
        lead = rng.choice(CONVERT_LEADS).format(n=name)
        if p["shown"] == "deg":
            f = Fraction(deg, 180)
            return [short(f"{lead} Write the angle in radians, in terms of π.", pi_text(f), pi_forms(f))]
        return [short(f"{lead} Write the angle in degrees.", str(deg), [str(deg), f"{deg}°", f"{deg} degrees"])]
    t, fn = Fraction(*p["t"]), p["fn"]
    sign, size = _trig_exact(fn, t)
    key = ("" if sign > 0 else "−") + size
    other = ({"1": "√3", "√3": "√3/3", "√3/3": "√3"} if fn == "tan" else {"1/2": "√3/2", "√3/2": "1/2", "√2/2": "1/2"})[size]
    opts = [key, ("−" if sign > 0 else "") + size, ("" if sign > 0 else "−") + other, ("−" if sign > 0 else "") + other]
    lead = rng.choice(UNIT_LEADS).format(n=name)
    return [mcq(f"{lead} What is the exact value of {fn} θ?", key, opts[1:], rng)]
