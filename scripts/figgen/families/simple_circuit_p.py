"""Simple circuits (Primary): three or four small circuits side by side, lettered A to D, each a loop with a cell,
wires, a bulb and sometimes a switch. Some loops are complete; each of the others has exactly one fault: a gap in
a wire, an open switch, or no cell at all. (Both wires taken to one end of the cell was dropped: blind reviewers
missed it.)

Two levels. The lower one draws the parts as pictures, as a Primary 2 to 4 book does: a cell with its + and -
ends, a bulb in a holder, a switch with a lever. The upper one (Rwanda P5 to P6, Cambridge Stage 6) draws circuit
symbols, and a loop may hold two bulbs. Every switch is large and labelled "switch", its lever over a unit long and
much thicker than the wires: drawn open it is lifted at 35 degrees, well clear of its far contact; drawn closed it
lies flat on both contacts. (A thin closed switch read as a gap at review size.)

Which bulbs light, how many, and why one does not (or what would make it light). Every key comes from each
circuit's connections in the params: a bulb lights when its loop has a cell, the two wires reach different ends
of the cell, no wire has a gap, and no switch is open. Wrong options never name a part the circuit does not have.
"""
from __future__ import annotations

import math
import random

from matplotlib.patches import Circle, FancyBboxPatch, Rectangle

from ..core import FILL, FILL_2, GRID, INK, NAMES, count, mcq, new_figure

ID = "simple_circuit_p"
KIND = "physics.circuit"
SUBJECT = "science"
BANDS = ("P",)
CONCEPTS = ("science.simple-circuits", "science.electricity-basics", "science.electrical-components")
# A topic whose sections the book lists is reached only if one names electricity, circuits or switches.
NEEDS = r"electric|circuit|switch"

FAULTS = ["gap", "open", "nocell"]
# Why a bulb does not light, and what would make it light: the faults, then the slips a child makes.
REASON = {"gap": "There is a gap in the wire.", "open": "The switch is open.", "nocell": "There is no cell in the circuit.",
          "turn": "The cell is the wrong way round.", "far": "The bulb is too far from the cell.",
          "long": "The wires are too long."}
FIX = {"gap": "Join the gap in the wire", "open": "Close the switch", "nocell": "Add a cell to the circuit",
       "turn": "Turn the cell round", "far": "Move the bulb closer to the cell", "long": "Use shorter wires"}

# One panel, in its own units: the loop's corners, the bulb on the top wire, the switch to its right, the cell
# on the bottom wire.
LX, RX, BY, TY = 0.4, 4.0, 0.9, 3.4
PW, PH = 4.9, 5.75  # one panel's width and height, with the space between panels
HINGE, FAR = 2.6, 3.7  # the switch's two contacts on the top wire
OPEN = 35  # degrees a lever is lifted when the switch is open


def stages(p: dict) -> tuple[int, int] | None:
    """Circuit symbols are taught from P5 (Cambridge Stage 6); the pictures suit any Primary year."""
    return (5, 6) if p["level"] == "upper" else None


def sample(rng: random.Random) -> dict:
    level = rng.choice(["lower", "upper"])
    n = rng.choice([3, 4])
    n_lit = rng.randint(1, n - 1)
    kinds = ["ok"] * n_lit + rng.sample(FAULTS, n - n_lit)
    rng.shuffle(kinds)
    circuits = []
    for letter, kind in zip("ABCD", kinds):
        plus = rng.choice(["left", "right"])
        ends = ["+", "-"] if plus == "left" else ["-", "+"]  # the cell's left end, then its right end
        leads = list(ends)  # the left wire meets the cell's left end, the right wire its right end
        bulbs = 1 if level == "lower" else rng.choice([1, 2])
        circuits.append({
            "letter": letter, "cell": kind != "nocell", "plus": plus if kind != "nocell" else None, "leads": leads,
            "gap": (rng.choice(["left", "right"]) if bulbs == 1 else "right") if kind == "gap" else None,
            "switch": "open" if kind == "open" else rng.choice([None, "closed"]),
            "bulbs": bulbs,
        })
    return {"band": "P", "level": level, "circuits": circuits}


def _fault(c: dict) -> str | None:
    if not c["cell"]:
        return "nocell"
    if c["gap"]:
        return "gap"
    if c["switch"] == "open":
        return "open"
    return None


# --- drawing ---------------------------------------------------------------------------------------------

def _wire(ax, letter, pts, ox, oy):
    ax.plot([ox + x for x, _ in pts], [oy + y for _, y in pts], color=INK, linewidth=2.0, solid_capstyle="round",
            solid_joinstyle="round", gid=f"wire-{letter}", zorder=2)


def _link(ax, gid, a, b, ox, oy):
    """An unseen line between a part's two terminals, so a reader of the drawing knows what joins what."""
    ax.plot([ox + a[0], ox + b[0]], [oy + a[1], oy + b[1]], visible=False, gid=gid)


def _vertical(ax, letter, x, y_top, y_bottom, cuts, ox, oy):
    """A wire down one side, broken where a part or a gap sits: cuts are (top, bottom) stretches left out."""
    y = y_top
    for a, b in sorted(cuts, reverse=True):
        _wire(ax, letter, [(x, y), (x, a)], ox, oy)
        y = b
    _wire(ax, letter, [(x, y), (x, y_bottom)], ox, oy)


def _picture_cell(ax, c, ox, oy) -> tuple[tuple, tuple]:
    """A cell lying on the bottom wire: its body, the nub at its + end, + and - printed on it. Returns where the
    left and right wires meet it."""
    x0, x1 = 1.45, 2.95
    ax.add_patch(FancyBboxPatch((ox + x0, oy + BY - 0.27), x1 - x0, 0.54, boxstyle="round,pad=0,rounding_size=0.08",
                                facecolor=FILL_2, edgecolor=INK, linewidth=1.6, zorder=3))
    if c["plus"] == "right":
        ax.add_patch(Rectangle((ox + x1, oy + BY - 0.17), 0.16, 0.34, facecolor=FILL, edgecolor=INK, linewidth=1.4, zorder=3))
        left, right = (x0, BY), (x1 + 0.16, BY)
        ax.text(ox + x1 - 0.28, oy + BY, "+", ha="center", va="center", fontsize=13, fontweight="bold", zorder=4)
        ax.text(ox + x0 + 0.28, oy + BY, "−", ha="center", va="center", fontsize=13, fontweight="bold", zorder=4)
    else:
        ax.add_patch(Rectangle((ox + x0 - 0.16, oy + BY - 0.17), 0.16, 0.34, facecolor=FILL, edgecolor=INK, linewidth=1.4, zorder=3))
        left, right = (x0 - 0.16, BY), (x1, BY)
        ax.text(ox + x0 + 0.28, oy + BY, "+", ha="center", va="center", fontsize=13, fontweight="bold", zorder=4)
        ax.text(ox + x1 - 0.28, oy + BY, "−", ha="center", va="center", fontsize=13, fontweight="bold", zorder=4)
    return left, right


def _symbol_cell(ax, c, ox, oy) -> tuple[tuple, tuple]:
    """The cell symbol: the long thin plate is +, the short thick plate is -."""
    a, b = 2.08, 2.34
    long_x, short_x = (a, b) if c["plus"] == "left" else (b, a)
    ax.plot([ox + long_x] * 2, [oy + BY - 0.38, oy + BY + 0.38], color=INK, linewidth=1.8, zorder=3)
    ax.plot([ox + short_x] * 2, [oy + BY - 0.19, oy + BY + 0.19], color=INK, linewidth=4.5, zorder=3)
    return (a, BY), (b, BY)


def _picture_bulb(ax, letter, ox, oy) -> tuple[tuple, tuple]:
    """A bulb screwed into a holder on the top wire; the wires meet the holder's two ends."""
    cx = 1.6
    ax.add_patch(Rectangle((ox + cx - 0.6, oy + TY - 0.16), 1.2, 0.32, facecolor=FILL_2, edgecolor=INK, linewidth=1.5, zorder=3))
    ax.add_patch(Rectangle((ox + cx - 0.2, oy + TY + 0.16), 0.4, 0.2, facecolor=FILL, edgecolor=INK, linewidth=1.3, zorder=3))
    ax.add_patch(Circle((ox + cx, oy + TY + 0.78), 0.43, facecolor="white", edgecolor=INK, linewidth=1.6, zorder=3))
    # the filament: two supports and a coil between them
    ax.plot([ox + cx - 0.1, ox + cx - 0.12], [oy + TY + 0.38, oy + TY + 0.8], color=INK, linewidth=1.0, zorder=4)
    ax.plot([ox + cx + 0.1, ox + cx + 0.12], [oy + TY + 0.38, oy + TY + 0.8], color=INK, linewidth=1.0, zorder=4)
    xs = [cx - 0.12 + 0.24 * i / 8 for i in range(9)]
    ax.plot([ox + x for x in xs], [oy + TY + 0.8 + (0.05 if i % 2 else -0.03) for i in range(9)], color=INK, linewidth=1.0, zorder=4)
    left, right = (cx - 0.6, TY), (cx + 0.6, TY)
    _link(ax, f"bulb-{letter}", left, right, ox, oy)
    return left, right


def _symbol_bulb(ax, letter, cx, cy, vertical, ox, oy, k) -> tuple[tuple, tuple]:
    r = 0.32
    ax.add_patch(Circle((ox + cx, oy + cy), r, facecolor="white", edgecolor=INK, linewidth=1.8, zorder=3))
    d = r * math.cos(math.radians(45))
    for sx in (-1, 1):
        ax.plot([ox + cx - d, ox + cx + d], [oy + cy - sx * d, oy + cy + sx * d], color=INK, linewidth=1.5, zorder=4)
    a, b = ((cx, cy + r), (cx, cy - r)) if vertical else ((cx - r, cy), (cx + r, cy))
    _link(ax, f"bulb-{letter}-{k}", a, b, ox, oy)
    return a, b


def _switch(ax, c, picture, ox, oy):
    """Two contacts on the top wire and a thick lever hinged at the left one: lying flat on both contacts when
    closed, lifted well clear of the right one when open. Labelled, so no reader takes it for a gap."""
    letter = c["letter"]
    length = FAR - HINGE
    if c["switch"] == "open":
        a = math.radians(OPEN)
        end = (HINGE + length * math.cos(a), TY + length * math.sin(a))
    else:
        end = (FAR, TY)
    if picture:
        ax.add_patch(Rectangle((ox + HINGE - 0.2, oy + TY - 0.3), length + 0.4, 0.2, facecolor=FILL_2, edgecolor=INK,
                               linewidth=1.3, zorder=2))
        for x in (HINGE, FAR):
            ax.add_patch(Circle((ox + x, oy + TY), 0.12, facecolor=FILL, edgecolor=INK, linewidth=1.4, zorder=5))
        width = 5.5
    else:
        for x in (HINGE, FAR):
            ax.add_patch(Circle((ox + x, oy + TY), 0.11, facecolor="white", edgecolor=INK, linewidth=1.8, zorder=5))
        width = 4.2
    ax.plot([ox + HINGE, ox + end[0]], [oy + TY, oy + end[1]], color=INK, linewidth=width, solid_capstyle="round",
            gid=f"lever-{letter}", zorder=6)
    ax.text(ox + (HINGE + FAR) / 2, oy + TY - 0.62, "switch", ha="center", va="center", fontsize=10.5)


def _panel(ax, c, picture, ox, oy):
    letter = c["letter"]
    ax.add_patch(FancyBboxPatch((ox + 0.0, oy - 0.85), 4.4, 5.55, boxstyle="round,pad=0,rounding_size=0.2", facecolor="none",
                                edgecolor=GRID, linewidth=1.0, zorder=1))
    ax.text(ox + 2.2, oy - 0.5, letter, ha="center", va="center", fontsize=16, fontweight="bold")
    # The bulb, or two (upper level: the second on the left side).
    if picture:
        bl, br = _picture_bulb(ax, letter, ox, oy)
    else:
        bl, br = _symbol_bulb(ax, letter, 1.6, TY, False, ox, oy, 1)
    cuts_left, cuts_right = [], []
    if c["bulbs"] == 2:
        top, bottom = _symbol_bulb(ax, letter, LX, 2.15, True, ox, oy, 2)
        cuts_left.append((top[1], bottom[1]))
    if c["gap"] == "left":
        cuts_left.append((2.4, 1.92))
    elif c["gap"] == "right":
        cuts_right.append((2.4, 1.92))
    # The top wire: corner to bulb, bulb to switch (or the corner).
    _wire(ax, letter, [(LX, TY), bl], ox, oy)
    if c["switch"]:
        _wire(ax, letter, [br, (HINGE, TY)], ox, oy)
        _wire(ax, letter, [(FAR, TY), (RX, TY)], ox, oy)
        _switch(ax, c, picture, ox, oy)
    else:
        _wire(ax, letter, [br, (RX, TY)], ox, oy)
    # The bottom: the cell between the corners, or a plain wire where there is none.
    if not c["cell"]:
        _vertical(ax, letter, LX, TY, BY, cuts_left, ox, oy)
        _vertical(ax, letter, RX, TY, BY, cuts_right, ox, oy)
        _wire(ax, letter, [(LX, BY), (RX, BY)], ox, oy)
        return
    cl, cr = (_picture_cell if picture else _symbol_cell)(ax, c, ox, oy)
    plus_at = cl if c["plus"] == "left" else cr
    minus_at = cr if c["plus"] == "left" else cl
    _link(ax, f"cell-{letter}", plus_at, minus_at, ox, oy)
    _vertical(ax, letter, LX, TY, BY, cuts_left, ox, oy)
    _vertical(ax, letter, RX, TY, BY, cuts_right, ox, oy)
    _wire(ax, letter, [(LX, BY), cl], ox, oy)
    _wire(ax, letter, [cr, (RX, BY)], ox, oy)


def draw(p: dict):
    cs = p["circuits"]
    cols = 3 if len(cs) == 3 else 2
    rows = 1 if len(cs) == 3 else 2
    width, height = cols * PW - 0.5, rows * PH - 0.2
    fig, ax = new_figure(0.5 * width, 0.5 * height)
    for i, c in enumerate(cs):
        _panel(ax, c, p["level"] == "lower", (i % cols) * PW, -(i // cols) * PH)
    ax.set_xlim(-0.1, width + 0.1)
    ax.set_ylim(-0.95 - (rows - 1) * PH, 4.8)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


# --- questions -------------------------------------------------------------------------------------------

VERBS = ["builds", "sets up", "makes", "joins up", "puts together"]
SETTINGS = ["in a science lesson in Huye", "at the science club in Musanze", "at home in Kigali",
            "for a class test in Rubavu", "at a school in Nyanza"]
WORD = {3: "three", 4: "four"}


def _set(ls) -> str:
    ls = sorted(ls)
    if len(ls) == 1:
        return f"{ls[0]} only"
    return ", ".join(ls[:-1]) + f" and {ls[-1]}"


def _options(x: dict, fault: str, table: dict, rng: random.Random) -> list[str]:
    """Wrong answers that match what is drawn: a switch named only where a closed one is drawn, the cell turned or
    moved only where there is one, and no gap offered beside an open switch (an open switch is a gap to some)."""
    allowed = []
    for k in ("turn", "far", "gap", "open", "nocell", "long"):
        if k == fault:
            continue
        if k == "open" and x["switch"] != "closed":
            continue
        if k in ("turn", "far") and not x["cell"]:
            continue
        if k == "gap" and fault == "open":
            continue
        allowed.append(k)
    first = [k for k in allowed if k in ("turn", "far")][:1]  # the slip a child makes, offered wherever it fits
    rest = [k for k in allowed if k not in first]
    rng.shuffle(rest)
    return [table[k] for k in first + rest]


def questions(p: dict, rng: random.Random) -> list:
    cs = p["circuits"]
    upper = p["level"] == "upper"
    name = rng.choice(NAMES)
    lit = [c["letter"] for c in cs if _fault(c) is None]
    broken = [c for c in cs if _fault(c) is not None]
    first = f"{name} {rng.choice(VERBS)} {WORD[len(cs)]} circuits {rng.choice(SETTINGS)}."
    if len(lit) == 1:
        ask = "Which circuit will light up?" if upper else "Which circuit will light the bulb?"
        q1 = mcq(f"{first} {ask}", f"Circuit {lit[0]}", [f"Circuit {c['letter']}" for c in broken], rng)
    else:
        # The slips: every circuit lights; the one with the easiest fault to miss lights too; one lit loop is missed.
        subtle = sorted(broken, key=lambda c: ["open", "gap", "nocell"].index(_fault(c)))[0]["letter"]
        wrong = [_set([c["letter"] for c in cs]), _set(lit + [subtle]), _set(rng.sample(lit, len(lit) - 1)),
                 _set([c["letter"] for c in broken])]
        ask = "Which circuits will light up?" if upper else "In which circuits will the bulb light?"
        q1 = mcq(f"{first} {ask}", _set(lit), wrong, rng)
    on = sum(c["bulbs"] for c in cs if c["letter"] in lit)
    total = sum(c["bulbs"] for c in cs)
    if rng.random() < 0.5:
        q2 = count("How many bulbs will light, in all the circuits together?", on, "bulbs")
    else:
        q2 = count("How many bulbs will not light, in all the circuits together?", total - on, "bulbs")
    x = rng.choice(broken)
    fault = _fault(x)
    noun = "bulbs" if x["bulbs"] == 2 else "bulb"
    if rng.random() < 0.5:
        q3 = mcq(f"Why will the {noun} in circuit {x['letter']} not light?", REASON[fault], _options(x, fault, REASON, rng), rng)
    else:
        q3 = mcq(f"What would make the {noun} in circuit {x['letter']} light?", FIX[fault], _options(x, fault, FIX, rng), rng)
    return [q1, q2, q3]
