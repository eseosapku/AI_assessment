"""Work, energy and power at AS Level (AL): Cambridge AS & A Level Physics Chapter 5 "Work, energy and power" and the
elastic potential energy of Chapter 7 "Matter and materials". Four kinds:

- fx: a force–displacement graph of straight pieces with every corner on a gridline crossing, its three parts
  lettered P, Q and R; the work done is the area under it. Asks the total work, the work over the first metres, and
  in which part the most work is done;
- track: a cart, skateboarder or toy car released from rest at A on a track through a dip B, over a hump C, to a
  ledge D, with the heights, the mass, g = 9.8 m s⁻² and the work done against friction between C and D printed.
  Asks the g.p.e. lost from A to B, the speed at B (no energy lost before C: the drop is chosen so the speed is
  exact), the k.e. at C and the k.e. at D;
- power: a table of four motors lifting loads (mass, height, time), g = 9.81 N kg⁻¹ and power = work done ÷ time
  printed. Asks the work one motor does, another's power and which develops the greatest power (never simply the
  heaviest load or the quickest lift);
- elastic: a force–extension graph of a wire, straight to the limit of proportionality and then less steep. Asks the
  elastic potential energy stored at the limit and at a smaller extension (the area under the line, ½Fx), and the
  force constant k = F ÷ x.
"""
from __future__ import annotations

import math
import random
from fractions import Fraction

from matplotlib.patches import Polygon, Rectangle

from ..core import GRID, INK, NAMES, exact, measure, new_figure, short
from ._bio_parts import letter_choice

ID = "work_energy"
KIND = "physics.force"
SUBJECT = "physics"
BANDS = ("AL",)
CONCEPTS = tuple(f"physics.{c}" for c in ("work", "energy", "kinetic-energy", "gravitational-potential-and-energy", "power",
                                           "energy-conversions-and-transfers", "potential-energy"))
# A chapter whose sections name work, kinetic or potential energy, power, or stretching materials.
NEEDS = r"\bwork\b|kinetic energy|potential energy|g\.p\.e|\bpower\b|stretching materials"
AVOID = (r"gravitational fields|oscillation|ideal gas|thermal|momentum|quantum|nuclear|medical|waves|circular|electric|"
         r"capacit|accelerated motion|kinematics|dynamics|planning|practical|glossary")
G_TRACK = Fraction(98, 10)
G_LIFT = Fraction(981, 100)


def concepts_for(p: dict) -> tuple[str, ...]:
    return {"fx": ("physics.work", "physics.energy"),
            "track": ("physics.gravitational-potential-and-energy", "physics.kinetic-energy",
                      "physics.energy-conversions-and-transfers", "physics.work"),
            "power": ("physics.power", "physics.work", "physics.gravitational-potential-and-energy"),
            "elastic": ("physics.potential-energy", "physics.work", "physics.energy")}[p["kind"]]


# --- sampling -----------------------------------------------------------------------------------------------------

FX_CONTEXTS = {
    "tractor": ("a tractor pulls a plough across a field", "the plough"),
    "winch": ("a winch drags a boat up a slipway", "the boat"),
    "box": ("a worker pushes a heavy box along a corridor", "the box"),
    "horse": ("a horse pulls a cart along a track", "the cart"),
    "sledge": ("a rope pulls a sledge of bricks up a ramp", "the sledge"),
}
TRACKS = {
    # who moves, what they move on, masses, drops (k: the drop is 0.1·k² m), heights of the dip, friction unit
    "cart": ("a roller-coaster cart", "a roller-coaster track", [200, 250, 300, 350, 400, 450, 500], range(5, 10),
             ["0.0", "0.5", "1.0", "2.0"], 500),
    "skater": ("a skateboarder", "a skate ramp", [40, 45, 50, 55, 60, 65, 70], range(3, 7), ["0.0", "0.2", "0.5"], 50),
    "toy": ("a toy car", "a toy racing track", ["0.5", "1.0", "1.5", "2.0", "2.5"], range(3, 5), ["0.0", "0.1", "0.2"], 1),
}
WIRES = ["a copper wire", "a steel wire", "a brass wire", "a nylon fishing line", "an aluminium wire"]


def _fx(rng: random.Random) -> dict:
    while True:
        x1 = rng.randint(1, 3)
        x2 = x1 + rng.randint(1, 4)
        x3 = x2 + rng.randint(1, 3)
        if x3 > 10:
            continue
        pts = [[0, rng.choice([0, 0, 1, 2, 3])], [x1, rng.randint(3, 8)], [x2, rng.randint(2, 8)], [x3, rng.randint(0, 6)]]
        areas = [Fraction((a[1] + b[1]) * (b[0] - a[0]), 2) for a, b in zip(pts, pts[1:])]
        top = sorted(areas)
        fstep, xstep = rng.choice([10, 20, 50, 100, 200]), rng.choice(["0.5", "1", "2"])
        if top[-1] - top[-2] < 1 or min(areas) == 0 or (sum(areas) * fstep * Fraction(xstep)).denominator != 1:
            continue
        return {"band": "AL", "kind": "fx", "context": rng.choice(list(FX_CONTEXTS)), "fstep": fstep, "xstep": xstep,
                "pts": pts, "upto": rng.choice([1, 2])}


def _track(rng: random.Random) -> dict:
    context = rng.choice(list(TRACKS))
    _, _, masses, ks, dips, unit = TRACKS[context]
    while True:
        m, k, hB = Fraction(str(rng.choice(masses))), rng.choice(list(ks)), Fraction(rng.choice(dips))
        hA = hB + Fraction(k * k, 10)
        tenth = Fraction(1, 10)
        hC = hB + tenth * rng.randint(3, k * k - 3)
        hD = hB + tenth * rng.randint(0, int((hC - hB) * 10) - 2)
        loss = m * G_TRACK * (hA - hD)
        Ws = [w for w in range(unit, int(loss * Fraction(6, 10)) + 1, unit)]
        if not Ws or hA - hC < Fraction(3, 10):
            continue
        return {"band": "AL", "kind": "track", "context": context, "m": exact(m), "k": k, "hA": f"{float(hA):.1f}",
                "hB": f"{float(hB):.1f}", "hC": f"{float(hC):.1f}", "hD": f"{float(hD):.1f}", "W": rng.choice(Ws)}


def _power(rng: random.Random) -> dict:
    while True:
        rows = []
        for L in "ABCD"[:rng.choice([3, 4])]:
            m, h = rng.choice([50, 80, 100, 120, 150, 200, 250, 300, 400, 500]), rng.randint(2, 20)
            # whole joules and whole watts: 100 divides m·h, and 100·t divides 981·m·h
            ts = [t for t in range(4, 61) if (981 * m * h) % (100 * t) == 0]
            if (m * h) % 100 or not ts:
                break
            rows.append([L, m, h, rng.choice(ts)])
        if len(rows) < 3:  # a table cut short by a row with no whole answer still needs three motors
            continue
        P = {L: Fraction(981 * m * h, 100 * t) for L, m, h, t in rows}
        vals = sorted(P.values())
        top = max(P, key=P.get)
        heaviest = max(rows, key=lambda r: r[1])[0]
        quickest = min(rows, key=lambda r: r[3])[0]
        if vals[-1] < Fraction(21, 20) * vals[-2] or top in (heaviest, quickest):
            continue
        if len({r[1] for r in rows}) < len(rows) or len({r[3] for r in rows}) < len(rows):
            continue
        return {"band": "AL", "kind": "power", "rows": rows}


def _elastic(rng: random.Random) -> dict:
    while True:
        xL, fL = rng.randint(4, 8), rng.randint(4, 8)
        Xs = [X for X in range(1, xL) if (fL * X) % xL == 0]
        x2, f2 = xL + rng.randint(2, 4), fL + rng.randint(1, 2)
        if not Xs or Fraction(f2 - fL, x2 - xL) >= Fraction(fL, xL) or x2 > 11:
            continue
        fstep, xstep = rng.choice([2, 5, 10, 20]), rng.choice(["0.1", "0.2", "0.5", "1"])
        if (Fraction(fL * fstep) / (xL * Fraction(xstep) / 1000)).denominator != 1:  # a whole force constant in N m⁻¹
            continue
        X = rng.choice(Xs)
        energies = [Fraction(fL * fstep * xL, 2) * Fraction(xstep) / 1000,
                    Fraction(fL * X, xL) * fstep * X * Fraction(xstep) / 2000]
        if any((e * 10 ** 4).denominator != 1 for e in energies):  # energies end within four decimal places of a joule
            continue
        return {"band": "AL", "kind": "elastic", "wire": rng.choice(WIRES), "fstep": fstep, "xstep": xstep,
                "L": [xL, fL], "end": [x2, f2], "X": X}


def sample(rng: random.Random) -> dict:
    return {"fx": _fx, "track": _track, "power": _power, "elastic": _elastic}[rng.choice(["fx", "track", "power", "elastic"])](rng)


# --- drawing ------------------------------------------------------------------------------------------------------

def _grid(ax, xmax: int, ymax: int, xstep: Fraction, fstep: int, xlabel: str, ylabel: str) -> None:
    ax.set_xticks([float(i * xstep) for i in range(0, xmax + 1)])
    ax.set_xticklabels([exact(i * xstep) for i in range(0, xmax + 1)])
    ax.set_xticks([float(Fraction(i, 2) * xstep) for i in range(0, 2 * xmax + 1)], minor=True)
    ax.set_yticks([i * fstep for i in range(0, ymax + 1)])
    ax.set_yticks([Fraction(i, 2) * fstep for i in range(0, 2 * ymax + 1)], minor=True)
    ax.grid(True, which="major", color="#a8a8a8", linewidth=0.7)
    ax.grid(True, which="minor", color=GRID, linewidth=0.4)
    ax.set_axisbelow(True)
    ax.set_xlim(0, float(xmax * xstep))
    ax.set_ylim(0, ymax * fstep)
    ax.set_xlabel(xlabel, fontsize=11)
    ax.set_ylabel(ylabel, fontsize=11)
    ax.tick_params(labelsize=9)


def _draw_fx(p: dict):
    xs, fs, pts = Fraction(p["xstep"]), p["fstep"], p["pts"]
    fig, ax = new_figure(6.4, 4.6)
    xmax, ymax = pts[-1][0] + 1, max(f for _, f in pts) + 2
    _grid(ax, xmax, ymax, xs, fs, "displacement / m", "force / N")
    X = lambda x: float(x * xs)  # noqa: E731
    shades = ["#dfe5ea", "#c9d2da", "#dfe5ea"]
    for i, (a, b) in enumerate(zip(pts, pts[1:])):
        ax.add_patch(Polygon([(X(a[0]), 0), (X(a[0]), a[1] * fs), (X(b[0]), b[1] * fs), (X(b[0]), 0)], closed=True,
                             facecolor=shades[i], edgecolor="none", zorder=1))
        top = min(a[1], b[1])
        ax.text(X(Fraction(a[0] + b[0], 2)), max(0.8, top * 0.45) * fs, "PQR"[i], ha="center", va="center", fontsize=13,
                fontweight="bold", zorder=4)
    for x, f in pts[1:-1]:
        ax.plot([X(x), X(x)], [0, f * fs], color=INK, linewidth=0.8, linestyle=(0, (3, 2)), zorder=2)
    ax.plot([X(x) for x, _ in pts], [f * fs for _, f in pts], color=INK, linewidth=1.9, zorder=3)
    return fig


def _track_y(p: dict, x: float) -> float:
    keys = [(-0.6, float(p["hA"])), (0.0, float(p["hA"])), (3.0, float(p["hB"])), (6.0, float(p["hC"])),
            (9.0, float(p["hD"])), (10.4, float(p["hD"]))]
    for (x0, y0), (x1, y1) in zip(keys, keys[1:]):
        if x0 <= x <= x1:
            t = (x - x0) / (x1 - x0)
            return y0 + (y1 - y0) * (1 - math.cos(math.pi * t)) / 2
    return keys[-1][1]


def _draw_track(p: dict):
    who, on, *_ = TRACKS[p["context"]]
    H = float(p["hA"])
    fig, ax = new_figure(7.2, 5.4)
    xs = [-0.6 + i * 11.0 / 400 for i in range(401)]
    ax.add_patch(Rectangle((-0.6, -0.04 * H), 11.0, 0.04 * H, facecolor="#cfc6b4", edgecolor="none", zorder=1))
    ax.plot([-0.6, 10.4], [0, 0], color=INK, linewidth=1.0, zorder=2)
    ax.plot(xs, [_track_y(p, x) for x in xs], color=INK, linewidth=2.2, zorder=3)
    for L, x in (("A", 0.0), ("B", 3.0), ("C", 6.0), ("D", 9.0)):
        y = float(p["h" + L])
        ax.plot([x], [y], marker="o", color=INK, markersize=6, zorder=4)
        ax.plot([x, x], [0, y], color=INK, linewidth=0.8, linestyle=(0, (3, 3)), zorder=2)
        ax.text(x, y + 0.075 * H, L, ha="center", va="bottom", fontsize=14, fontweight="bold", zorder=5)
    lines = [f"Heights above the ground:  A {p['hA']} m,  B {p['hB']} m,  C {p['hC']} m,  D {p['hD']} m",
             f"Mass of {who[2:] if who.startswith('a ') else who} = {p['m']} kg;  starts from rest at A;  g = 9.8 m s⁻²",
             "Friction is negligible from A to C.",
             f"Work done against friction from C to D = {p['W']} J"]
    for i, line in enumerate(lines):
        ax.text(-0.5, -0.17 * H - i * 0.11 * H, line, ha="left", va="center", fontsize=10.5)
    ax.set_xlim(-0.6, 10.4)
    ax.set_ylim(-0.17 * H - 3.6 * 0.11 * H, 1.22 * H)
    ax.axis("off")
    return fig


def _draw_power(p: dict):
    rows = p["rows"]
    fig, ax = new_figure(7.0, 3.6)
    ax.set_position([0.02, 0.02, 0.96, 0.96])
    heads = ["Motor", "Mass lifted / kg", "Height lifted / m", "Time taken / s"]
    widths = [1.6, 2.6, 2.6, 2.4]
    x0 = (10 - sum(widths)) / 2
    ax.text(5, 6.9, "Motors lifting loads at a steady speed", ha="center", va="center", fontsize=12, fontweight="bold")
    for r, cells in enumerate([heads] + [[str(v) for v in row] for row in rows]):
        y = 6.1 - r * 0.72
        x = x0
        for c, (w, v) in enumerate(zip(widths, cells)):
            ax.add_patch(Rectangle((x, y - 0.36), w, 0.72, facecolor="#e8ecef" if r == 0 or c == 0 else "white",
                                   edgecolor=INK, linewidth=1.0))
            ax.text(x + w / 2, y, v, ha="center", va="center", fontsize=10.5, fontweight="bold" if r == 0 or c == 0 else "normal")
            x += w
    yb = 6.1 - (len(rows) + 1) * 0.72 - 0.25
    ax.text(5, yb, "g = 9.81 N kg⁻¹        power = work done ÷ time taken", ha="center", va="center", fontsize=10.5)
    ax.set_xlim(0, 10)
    ax.set_ylim(yb - 0.5, 7.3)
    ax.axis("off")
    return fig


def _draw_elastic(p: dict):
    xs, fs = Fraction(p["xstep"]), p["fstep"]
    (xL, fL), (x2, f2) = p["L"], p["end"]
    fig, ax = new_figure(6.4, 4.8)
    xmax, ymax = x2 + 1, f2 + 2
    _grid(ax, xmax, ymax, xs, fs, "extension / mm", "force / N")
    X = lambda x: float(x * xs)  # noqa: E731
    ax.plot([0, X(xL), X(x2)], [0, fL * fs, f2 * fs], color=INK, linewidth=1.9, zorder=3)
    ax.plot([X(xL)], [fL * fs], marker="o", color=INK, markersize=5, zorder=4)
    # Above and to the left of the corner: the line there is lower, so the label sits in clear space.
    ax.annotate("limit of proportionality", xy=(X(xL), fL * fs), xytext=(X(xL - Fraction(3, 10)), (fL + 1.3) * fs),
                ha="right", va="center", fontsize=10, zorder=5,
                bbox={"boxstyle": "square,pad=0.15", "facecolor": "white", "edgecolor": "none"},
                arrowprops={"arrowstyle": "->", "color": INK, "linewidth": 1.0, "shrinkA": 2, "shrinkB": 4})
    return fig


def draw(p: dict):
    return {"fx": _draw_fx, "track": _draw_track, "power": _draw_power, "elastic": _draw_elastic}[p["kind"]](p)


# --- questions ----------------------------------------------------------------------------------------------------

SETTINGS = ["in a physics lesson", "for an AS Level homework", "in the school laboratory", "for a revision exercise",
            "while studying for a test", "at the science club", "in a practical in Huye", "for a class discussion in Kigali"]
SPEED = ["m s⁻¹", "m/s", "m s^-1", "ms-1", "metres per second"]


def _sig(v: Fraction, n: int) -> str:
    """v to n significant figures, rounded half up, written out in full: 12005 to 3 is 12000."""
    from decimal import ROUND_HALF_UP, Decimal, localcontext
    with localcontext() as ctx:
        ctx.prec = 40
        d = Decimal(v.numerator) / Decimal(v.denominator)
        return format(d.quantize(Decimal(1).scaleb(d.adjusted() - n + 1), rounding=ROUND_HALF_UP), "f")


def _with(v, unit: str, extra=()) -> list[str]:
    """The exact value and, for a long one, the same to 3 or 4 significant figures, as AS answers give them."""
    v = Fraction(v)
    values = [exact(v)] + [_sig(v, n) for n in (3, 4) if Fraction(_sig(v, n)) != v]
    forms = measure(v, unit)
    for x in values:
        for f in [x, f"{x} {unit}", f"{x}{unit}"] + [g for u in extra for g in (f"{x} {u}", f"{x}{u}")]:
            if f not in forms:
                forms.append(f)
    return forms


def _area(pts) -> Fraction:
    return sum(Fraction((a[1] + b[1]) * (b[0] - a[0]), 2) for a, b in zip(pts, pts[1:]))


def _fx_questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    action, obj = FX_CONTEXTS[p["context"]]
    xs, fs, pts = Fraction(p["xstep"]), p["fstep"], p["pts"]
    total = _area(pts) * fs * xs
    k = p["upto"]
    part = _area(pts[:k + 1]) * fs * xs
    areas = [_area(pts[i:i + 2]) for i in range(3)]
    most = "PQR"[areas.index(max(areas))]
    upto = exact(pts[k][0] * xs)
    return [
        short(f"{who} plotted the force with which {action} against the displacement of {obj} {rng.choice(SETTINGS)}. "
              f"How much work is done on {obj} over the whole displacement shown?", exact(total), _with(total, "J")),
        short(f"On the force–displacement graph for {obj}, how much work is done while the displacement increases "
              f"from 0 m to {upto} m?", exact(part), _with(part, "J")),
        letter_choice(f"The area under the force–displacement graph for {obj} is split into parts P, Q and R. In which "
                      f"part is the most work done on {obj}?", most, ["P", "Q", "R"]),
    ]


def _track_questions(p: dict, rng: random.Random) -> list:
    who_moves, on, *_ = TRACKS[p["context"]]
    who = rng.choice(NAMES)
    m = Fraction(p["m"])
    hA, hB, hC, hD = (Fraction(p[h]) for h in ("hA", "hB", "hC", "hD"))
    gpe = m * G_TRACK * (hA - hB)
    v = Fraction(14 * p["k"], 10)
    keC = m * G_TRACK * (hA - hC)
    keD = m * G_TRACK * (hA - hD) - p["W"]
    the = "the " + who_moves.split(" ", 1)[1]
    return [
        short(f"{who} followed {who_moves} along {on} {rng.choice(SETTINGS)}. How much gravitational potential energy does "
              f"{the} lose between A and B?", exact(gpe), _with(gpe, "J")),
        short(f"No energy is lost between A and C. What is the speed of {the} at B?", exact(v), _with(v, "m s⁻¹", SPEED[1:])),
        short(f"No energy is lost between A and C. What is the kinetic energy of {the} at C?", exact(keC), _with(keC, "J")),
        short(f"Using the work done against friction printed under the drawing, what is the kinetic energy of {the} "
              f"when it reaches D?", exact(keD), _with(keD, "J")),
    ]


def _power_questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    rows = p["rows"]
    L1, L2 = rng.sample([r[0] for r in rows], 2)
    r1 = next(r for r in rows if r[0] == L1)
    r2 = next(r for r in rows if r[0] == L2)
    work = r1[1] * G_LIFT * r1[2]
    power = r2[1] * G_LIFT * r2[2] / r2[3]
    P = {r[0]: Fraction(r[1] * r[2], r[3]) for r in rows}
    top = max(P, key=P.get)
    return [
        short(f"{who} tested {len(rows)} motors lifting loads {rng.choice(SETTINGS)}. How much work does motor {L1} do "
              f"on its load as it lifts it?", exact(work), _with(work, "J")),
        short(f"What is the useful output power of motor {L2} while it lifts its load?", exact(power), _with(power, "W")),
        letter_choice("Which motor develops the greatest useful output power?", top, [r[0] for r in rows]),
    ]


def _elastic_questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    xs, fs = Fraction(p["xstep"]), p["fstep"]
    (xL, fL), X = p["L"], p["X"]
    to_m = Fraction(1, 1000)
    epe = Fraction(1, 2) * fL * fs * xL * xs * to_m
    k = Fraction(fL * fs) / (xL * xs * to_m)
    FX = Fraction(fL * X, xL) * fs
    epx = Fraction(1, 2) * FX * X * xs * to_m
    wire = p["wire"]
    the = "the " + wire.split(" ", 1)[1]
    return [
        short(f"{who} stretched {wire} {rng.choice(SETTINGS)} and plotted this force–extension graph. How much elastic "
              f"potential energy is stored in {the} when it is stretched to the limit of proportionality? Give your "
              f"answer in joules.", exact(epe), _with(epe, "J")),
        short(f"Using k = F ÷ x below the limit of proportionality, what is the force constant of {the}, in N m⁻¹?",
              exact(k), _with(k, "N m⁻¹", ["N/m", "N m^-1", "Nm-1"])),
        short(f"How much elastic potential energy is stored in {the} when its extension is {exact(X * xs)} mm? Give your "
              f"answer in joules.", exact(epx), _with(epx, "J")),
    ]


def questions(p: dict, rng: random.Random) -> list:
    return {"fx": _fx_questions, "track": _track_questions, "power": _power_questions,
            "elastic": _elastic_questions}[p["kind"]](p, rng)
