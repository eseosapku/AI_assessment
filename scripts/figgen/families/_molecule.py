"""Displayed formulas drawn the way the textbooks draw them (P6 organic): shared by functional_groups and
polymer_structure.

A molecule is a backbone of atoms left to right. Each backbone atom's other bonds go straight up or down, and at the
two ends left or right. A single atom (H, a halogen, =O) sits one bond out; OH puts its H a second bond further out;
a CH3 or NH2 branch going up or down sits two rows out, so its own side hydrogens clear its neighbours' (the way the
coursebooks draw 2-methylpropane). A backbone "atom" may also be a condensed piece such as (CH₂)₄ or C₆H₄, drawn as
text with room made for it.

Every atom is the text "atom:<i>"; every group box is a dashed FancyBboxPatch "group:<L>" and its letter the text
"letter:<L>". Units: one unit is 0.62 inch on the page, the scale every figure is drawn at, so text widths are known
before drawing.
"""
from __future__ import annotations

import math

from matplotlib.font_manager import FontProperties
from matplotlib.patches import FancyBboxPatch
from matplotlib.textpath import TextPath

from ..core import INK

GAP = 1.3  # backbone atom to backbone atom
ARM = 1.0  # an atom to a single atom on it
INCH = 0.62  # one unit on the page
UNIT_PT = INCH * 72
ATOM_SIZE = 15
LETTER_SIZE = 13
PAD = 0.36  # a group box's margin round its atoms' centres
DIRS = {"up": (0, 1), "down": (0, -1), "left": (-1, 0), "right": (1, 0)}
_FONT = FontProperties(family="DejaVu Sans")


def text_width(s: str, size: float = ATOM_SIZE) -> float:
    """The printed width of a piece of text, in units."""
    if not s:
        return 0.0
    return TextPath((0, 0), s, size=size, prop=_FONT).get_extents().width / UNIT_PT


class Mol:
    """Atoms [sym, x, y], bonds [i, j, order], and which atoms each backbone atom and substituent drew."""

    def __init__(self):
        self.atoms: list[list] = []
        self.bonds: list[list] = []
        self.refs: dict[tuple, list[int]] = {}

    def add(self, sym: str, x: float, y: float) -> int:
        self.atoms.append([sym, round(x, 6), round(y, 6)])
        return len(self.atoms) - 1

    def bond(self, i: int, j: int, order: int = 1) -> None:
        self.bonds.append([i, j, order])

    def group(self, refs) -> list[int]:
        """The atoms of a list of references: ("b", k) a backbone atom, ("s", k, slot) a substituent's atoms."""
        out: list[int] = []
        for r in refs:
            out += self.refs[tuple(r)]
        return out


def _substituent(mol: Mol, at: int, k: int, slot: str, spec: str) -> None:
    _, x, y = mol.atoms[at]
    dx, dy = DIRS[slot]
    vertical = dx == 0
    made: list[int] = []
    if spec in ("H", "F", "Cl", "Br", "I"):
        made.append(mol.add(spec, x + dx * ARM, y + dy * ARM))
        mol.bond(at, made[0])
    elif spec == "=O":
        made.append(mol.add("O", x + dx * ARM, y + dy * ARM))
        mol.bond(at, made[0], 2)
    elif spec == "OH":
        o = mol.add("O", x + dx * ARM, y + dy * ARM)
        h = mol.add("H", x + 2 * dx * ARM, y + 2 * dy * ARM)
        mol.bond(at, o)
        mol.bond(o, h)
        made += [o, h]
    elif spec in ("NH2", "CH3"):
        heavy = "N" if spec == "NH2" else "C"
        if vertical:  # two rows out, its hydrogens to either side (and outward for CH3)
            c = mol.add(heavy, x, y + 2 * dy * ARM)
            hs = [(x - ARM, y + 2 * dy * ARM), (x + ARM, y + 2 * dy * ARM)]
            if heavy == "C":
                hs.append((x, y + 3 * dy * ARM))
        else:  # at an end: one bond out, its hydrogens up and down (and outward for CH3)
            c = mol.add(heavy, x + dx * ARM, y)
            hs = [(x + dx * ARM, y + ARM), (x + dx * ARM, y - ARM)]
            if heavy == "C":
                hs.append((x + 2 * dx * ARM, y))
        mol.bond(at, c)
        made.append(c)
        for hx, hy in hs:
            h = mol.add("H", hx, hy)
            mol.bond(c, h)
            made.append(h)
    else:
        raise ValueError(spec)
    mol.refs[("s", k, slot)] = made


def half_width(sym: str) -> float:
    return text_width(sym) / 2


def chain(spec: list[dict], orders: list[int] | None = None) -> Mol:
    """A backbone left to right: each entry {"sym": "C", "up": "H", "down": "OH", "left": ..., "right": ...};
    `orders` are the bonds between neighbours (single unless said)."""
    orders = orders or [1] * (len(spec) - 1)
    mol = Mol()
    x = 0.0
    back = []
    for k, a in enumerate(spec):
        if k:
            x += GAP + max(0.0, half_width(spec[k - 1]["sym"]) - 0.15) + max(0.0, half_width(a["sym"]) - 0.15)
        back.append(mol.add(a["sym"], x, 0.0))
        mol.refs[("b", k)] = [back[-1]]
    for k in range(1, len(spec)):
        mol.bond(back[k - 1], back[k], orders[k - 1])
    for k, a in enumerate(spec):
        for slot in ("up", "down", "left", "right"):
            if a.get(slot):
                _substituent(mol, back[k], k, slot, a[slot])
    return mol


def mirrored(mol: Mol) -> Mol:
    """The same drawing left to right reversed."""
    out = Mol()
    out.atoms = [[s, round(-x, 6), y] for s, x, y in mol.atoms]
    out.bonds = [list(b) for b in mol.bonds]
    out.refs = dict(mol.refs)
    return out


def valency_ok(mol: Mol) -> bool:
    need = {"C": 4, "H": 1, "O": 2, "N": 3, "Cl": 1, "Br": 1, "I": 1, "F": 1}
    for i, (sym, _, _) in enumerate(mol.atoms):
        if sym in need and sum(o for a, b, o in mol.bonds if i in (a, b)) != need[sym]:
            return False
    return True


def _clear(sym: str, ux: float, uy: float) -> float:
    """How far along a bond's direction the bond stops short of an atom's letters."""
    # a condensed piece such as (CH₂)₄ prints wider than its ink, brackets and subscripts and all: more room
    hw = max(0.17, half_width(sym)) + (0.22 if len(sym) > 2 else 0.1)
    hh = 0.27
    if abs(ux) < 1e-9:
        return hh
    if abs(uy) < 1e-9:
        return max(0.27, hw)
    return min(hw / abs(ux), hh / abs(uy))


def draw_bonds(ax, atoms, bonds, lw: float = 1.4) -> None:
    for i, j, order in bonds:
        (s1, x1, y1), (s2, x2, y2) = atoms[i], atoms[j]
        L = math.hypot(x2 - x1, y2 - y1)
        ux, uy = (x2 - x1) / L, (y2 - y1) / L
        a, b = _clear(s1, ux, uy), _clear(s2, ux, uy)
        for n in range(order):
            off = (n - (order - 1) / 2) * 0.13
            ox, oy = -uy * off, ux * off
            ax.plot([x1 + ux * a + ox, x2 - ux * b + ox], [y1 + uy * a + oy, y2 - uy * b + oy], color=INK, linewidth=lw,
                    gid=f"bond:{i}-{j}")


def draw_atoms(ax, atoms, size: float = ATOM_SIZE) -> None:
    for i, (sym, x, y) in enumerate(atoms):
        ax.text(x, y, sym, ha="center", va="center", fontsize=size, fontweight="bold" if sym not in ("H",) else "normal",
                gid=f"atom:{i}")


def box_of(points, pad: float = PAD) -> tuple[float, float, float, float]:
    xs, ys = [p[0] for p in points], [p[1] for p in points]
    return min(xs) - pad, min(ys) - pad, max(xs) + pad, max(ys) + pad


def _to_rect(px: float, py: float, r) -> float:
    dx = max(r[0] - px, 0.0, px - r[2])
    dy = max(r[1] - py, 0.0, py - r[3])
    return math.hypot(dx, dy)


def place_letters(boxes: dict, obstacles: list, keep_out: list | None = None) -> dict:
    """A spot for each box's letter just outside it, as far as can be from every atom, bond and other box:
    {L: (x, y)}. `obstacles` are points; `keep_out` further rectangles."""
    keep_out = keep_out or []
    spots: dict = {}
    for L, r in boxes.items():
        x0, y0, x1, y1 = r
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        cands = [(x0 - 0.3, y1 + 0.3), (x1 + 0.3, y1 + 0.3), (x0 - 0.3, y0 - 0.3), (x1 + 0.3, y0 - 0.3),
                 (x0 - 0.42, cy), (x1 + 0.42, cy), (cx, y1 + 0.42), (cx, y0 - 0.42)]

        def score(c):
            # clear of atoms and bonds, and plainly nearer its own box than any other
            d = [math.hypot(c[0] - px, c[1] - py) for px, py in obstacles]
            d += [_to_rect(c[0], c[1], o) for o in keep_out]
            d += [math.hypot(c[0] - sx, c[1] - sy) - 0.3 for sx, sy in spots.values()]
            other = [_to_rect(c[0], c[1], o) for M, o in boxes.items() if M != L]
            return min(min(d + other + [9.0]), 0.9) + 0.5 * min(other + [1.5])

        spots[L] = max(cands, key=score)
    return spots


def draw_box(ax, L: str, r, at) -> None:
    x0, y0, x1, y1 = r
    ax.add_patch(FancyBboxPatch((x0, y0), x1 - x0, y1 - y0, boxstyle="round,pad=0,rounding_size=0.12", fill=False,
                                edgecolor="#555555", linewidth=1.1, linestyle=(0, (3, 2)), gid=f"group:{L}", zorder=1))
    ax.text(at[0], at[1], L, ha="center", va="center", fontsize=LETTER_SIZE, fontweight="bold", gid=f"letter:{L}", zorder=5,
            bbox=dict(boxstyle="circle,pad=0.18", facecolor="white", edgecolor=INK, linewidth=1.0))


def bond_midpoints(atoms, bonds) -> list[tuple[float, float]]:
    out = []
    for i, j, _ in bonds:
        (_, x1, y1), (_, x2, y2) = atoms[i], atoms[j]
        out += [((x1 + x2) / 2, (y1 + y2) / 2), ((3 * x1 + x2) / 4, (3 * y1 + y2) / 4), ((x1 + 3 * x2) / 4, (y1 + 3 * y2) / 4)]
    return out


def frame(ax, xmin: float, xmax: float, ymin: float, ymax: float) -> None:
    """Axes limits that put one unit at INCH on the page; the figure's size must be set to match."""
    ax.set_xlim(xmin, xmax)
    ax.set_ylim(ymin, ymax)
    ax.set_aspect("equal")
    ax.axis("off")


def formula(atoms) -> str:
    """The molecular formula in Hill order: C, H, then the rest alphabetically."""
    c = {}
    for sym, *_ in atoms:
        c[sym] = c.get(sym, 0) + 1
    order = ["C", "H"] + sorted(k for k in c if k not in ("C", "H"))
    return "".join(k + (str(c[k]) if c[k] > 1 else "") for k in order if k in c)
