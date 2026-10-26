"""Shared pieces for the P6 A Level mechanics families (projectile_m, collision_m, elastic_string_m, circular_motion_m,
rigid_body_m): a number as a paper prints it, every fair form of a quantity with its unit, and the few drawing marks
they share (an arrow with its label, a hatched fixed surface, a note box)."""
from __future__ import annotations

import math
from fractions import Fraction

from ..core import INK, exact, short

G = 10  # m s^-2, printed on every figure that uses it


def fmt(v, places: int = 4) -> str:
    """A number of at most `places` decimal places written exactly (2.5, 0.125, 12); any other as a fraction a/b
    (7/40 stays 0.175, but 5/256 is not written 0.01953125)."""
    f = Fraction(v).limit_denominator(10 ** 6) if not isinstance(v, Fraction) else v
    return exact(float(f)) if (f * 10 ** places).denominator == 1 else f"{f.numerator}/{f.denominator}"


def terminates(v, places: int = 3) -> bool:
    """Whether a value is a decimal of at most `places` places."""
    return (Fraction(v) * 10 ** places).denominator == 1


UNITS = {
    "m/s": ["m/s", "m s⁻¹", "m s^-1", "m s-1", "ms-1", "ms⁻¹", "ms^-1"],
    "m/s²": ["m/s²", "m/s^2", "m/s2", "m s⁻²", "m s^-2", "m s-2", "ms-2", "ms⁻²"],
    "N s": ["N s", "Ns", "N·s", "kg m/s", "kg m s⁻¹", "kg m s^-1", "kg m s-1"],
    "rad/s": ["rad/s", "rad s⁻¹", "rad s^-1", "rad s-1"],
    "J": ["J", "joules", "joule"],
    "N": ["N", "newtons", "newton"],
    "m": ["m", "metres", "metre"],
    "s": ["s", "seconds", "second"],
    "cm": ["cm", "centimetres"],
    "kg": ["kg", "kilograms"],
}


def forms(v, unit: str | None = None, extra=()) -> list[str]:
    """Every fair way to write a value: the number (exact; a fraction also as a 3 s.f. decimal), with or without its
    unit. The exact number first, as the key."""
    key = fmt(v)
    numbers = [key]
    f = Fraction(v).limit_denominator(10 ** 6)
    rounded = []
    if "/" in key:  # also as a decimal: exactly where it terminates, and to three and four significant figures
        x = float(f)
        if terminates(f, 10):
            numbers.append(exact(x))
        for sig in (3, 4):
            r = f"{x:.{sig}g}"
            rounded += [r, r[1:] if r.startswith("0.") else r]
    elif f.denominator != 1:
        numbers.append(f"{f.numerator}/{f.denominator}")  # 2.5 as 5/2
    numbers += [n for e in extra for n in [e] if n not in numbers]
    out = []
    for n in numbers:
        for g in short("_", n).accepted:
            if g not in out:
                out.append(g)
    out += [r for r in dict.fromkeys(rounded) if r not in out]
    if unit:
        for n in list(out):
            for u in UNITS.get(unit, [unit]):
                for sp in (" ", ""):
                    if f"{n}{sp}{u}" not in out:
                        out.append(f"{n}{sp}{u}")
    return out


def answer(stem: str, v, unit: str | None = None, extra=()):
    fs = forms(v, unit, extra)
    return short(stem, fs[0], fs)


def arrow(ax, x0, y0, x1, y1, lw=1.6, gid=None, head=12, color=INK):
    """A straight arrow from (x0, y0) to (x1, y1), its head at the end."""
    a = ax.annotate("", xy=(x1, y1), xytext=(x0, y0), arrowprops={"arrowstyle": "-|>", "color": color, "linewidth": lw,
                                                                  "mutation_scale": head, "shrinkA": 0, "shrinkB": 0})
    if gid:
        a.set_gid(gid)
    # the arrow's ends, so the axes-limits test sees them
    ax.plot([x0, x1], [y0, y1], alpha=0, gid=(gid or "arrow") + ":ends")
    return a


def hatch(ax, x0, y0, x1, y1, side: int = -1, n: int | None = None, size: float = 0.25, gid="surface"):
    """A fixed surface from (x0, y0) to (x1, y1), with short hatch strokes on one side (side -1: below or to the
    right as you walk from the first end to the second)."""
    ax.plot([x0, x1], [y0, y1], color=INK, linewidth=1.8, gid=gid)
    length = math.hypot(x1 - x0, y1 - y0)
    n = n or max(4, int(length / (size * 1.6)))
    ux, uy = (x1 - x0) / length, (y1 - y0) / length
    nx, ny = (uy, -ux) if side < 0 else (-uy, ux)
    for k in range(n + 1):
        px, py = x0 + (x1 - x0) * k / n, y0 + (y1 - y0) * k / n
        ax.plot([px, px + size * (nx - ux * 0.7)], [py, py + size * (ny - uy * 0.7)], color=INK, linewidth=0.9,
                gid=gid + ":hatch")


def note(ax, lines: list[str], x: float, y: float, ha: str = "left", va: str = "top", fontsize: float = 10.5, gid="note"):
    """A plain box of printed facts (g, a modulus, a formula), placed in axes coordinates."""
    return ax.text(x, y, "\n".join(lines), transform=ax.transAxes, ha=ha, va=va, fontsize=fontsize, linespacing=1.45,
                   bbox={"boxstyle": "round,pad=0.4", "facecolor": "white", "edgecolor": INK, "linewidth": 0.9}, gid=gid)
