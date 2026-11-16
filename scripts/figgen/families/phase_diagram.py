"""Phase diagrams and partition (UP): three kinds.

- pt: the pressure–temperature phase diagram of an invented substance X on a grid (temperature every 10 °C, pressure
  every 20 kPa); the sublimation, vaporisation and melting lines, the triple point T and critical point C marked (a key
  says which is which), the three regions lettered. Asks the state at a stated temperature and pressure, which letter is
  a region, the triple point's temperature or pressure, the lowest pressure at which liquid X exists, the boiling point
  at 100 kPa, the critical temperature, or whether X expands or contracts on freezing (the rule printed in the stem).
  The melting line leans left (water-like: the solid is less dense) or right (most substances).
- colligative: the phase diagram of a pure solvent (solid lines) and of a solution of a non-volatile solute in it
  (dashed lines) around the 100 kPa line, temperature gridded every 5 °C; the four crossings of the 100 kPa line
  marked. Asks the elevation of the boiling point, the depression of the freezing point, or the solution's boiling or
  freezing point.
- partition: a separating funnel with an organic layer over or under water (by density, printed), each layer's volume
  and the mass of solute X in it printed, K_pc = concentration in the organic solvent ÷ concentration in water printed.
  Asks K_pc, the concentration in one layer, and the percentage of X extracted into the organic layer.

Every value asked sits on a gridline crossing or is printed; the substances are invented, so nothing is recalled.
"""
from __future__ import annotations

import math
import random
from fractions import Fraction

from matplotlib.patches import Circle, Polygon

from ..core import FILL_2, GRID, INK, NAMES, Question, exact, mcq, measure, new_figure, short
from ._bio_parts import letter_choice

ID = "phase_diagram"
KIND = "graph.line"
SUBJECT = "chemistry"
BANDS = ("UP",)
CONCEPTS = tuple(f"chemistry.{c}" for c in ("phase-diagrams", "colligative-properties", "solvent-extraction"))
# Where the book lists sections, one must name phase diagrams, partition or colligative properties.
NEEDS = (r"phase diagram|phase equilibri|partition|solvent extraction|colligative|raoult|triple point|"
         r"boiling point elevation|freezing point depression")
AVOID = r"^states of matter$|nature of matter|chromatograph|organic|polymer|glossary|separation techniques"


def concepts_for(p: dict) -> tuple[str, ...]:
    c = "chemistry."
    return {"pt": (c + "phase-diagrams",), "colligative": (c + "colligative-properties", c + "phase-diagrams"),
            "partition": (c + "solvent-extraction",)}[p["kind"]]


def avoid_for(p: dict) -> str:
    """A pure substance's diagram is no figure for solvent extraction; partition is no figure for phase diagrams."""
    return AVOID + {"pt": r"|solvent extraction", "colligative": "", "partition": r"|phase diagram"}[p["kind"]]


# --- the curves -----------------------------------------------------------------------------------------------------

def pchip(xs, ys, x):
    """A smooth curve through the points that never overshoots them (Fritsch–Carlson), at x."""
    h = [xs[i + 1] - xs[i] for i in range(len(xs) - 1)]
    d = [(ys[i + 1] - ys[i]) / h[i] for i in range(len(h))]
    m = [d[0]] + [0.0 if d[i - 1] * d[i] <= 0 else 3 * (h[i - 1] + h[i]) / ((2 * h[i] + h[i - 1]) / d[i - 1] + (h[i] + 2 * h[i - 1]) / d[i])
                  for i in range(1, len(d))] + [d[-1]]
    i = min(len(h) - 1, max(0, next((j for j in range(len(h)) if x <= xs[j + 1]), len(h) - 1)))
    t = (x - xs[i]) / h[i]
    h00, h10, h01, h11 = 2 * t ** 3 - 3 * t ** 2 + 1, t ** 3 - 2 * t ** 2 + t, -2 * t ** 3 + 3 * t ** 2, t ** 3 - t ** 2
    return h00 * ys[i] + h10 * h[i] * m[i] + h01 * ys[i + 1] + h11 * h[i] * m[i + 1]


def vapour(p: dict, T: float) -> float:
    """The liquid–vapour line of the pure substance, from the triple point through the boiling point to C."""
    return pchip([p["tt"], p["tb"], p["tc"]], [p["pt"], 100, p["pc"]], T)


def sublimation(p: dict, T: float) -> float:
    """The solid–vapour line: falling away steeply below the triple point."""
    return p["pt"] * math.exp((T - p["tt"]) * math.log(12) / 40)


def melting(p: dict, pressure: float) -> float:
    """The temperature on the solid–liquid line at a pressure: straight, leaning p["lean"] °C per 100 kPa."""
    return p["tt"] + p["lean"] * (pressure - p["pt"]) / 100


def state(p: dict, T: float, pressure: float) -> str:
    """The region a point lies in: below the triple pressure, solid above the sublimation line and gas below it;
    above it, solid left of the melting line, and right of it liquid above the vapour line and gas below."""
    if T > p["tc"]:
        return "gas" if pressure < p["pc"] else "supercritical"
    if pressure <= p["pt"]:
        return "solid" if T <= p["tt"] and pressure > sublimation(p, T) else "gas"
    if T < melting(p, pressure):
        return "solid"
    if T <= p["tt"]:
        return "liquid"
    return "liquid" if pressure > vapour(p, T) else "gas"


# --- sampling -------------------------------------------------------------------------------------------------------

def _pt_points(rng):
    while True:
        tt = rng.choice(range(-60, 31, 10))
        pt = rng.choice([20, 40, 60])
        tb = tt + rng.choice([40, 50, 60, 70, 80])
        tc = tb + rng.choice([40, 50, 60, 70])
        pc = rng.choice([200, 220, 240, 260, 280])
        if (pc - 100) / (tc - tb) > 1.3 * (100 - pt) / (tb - tt):  # the line steepens towards C, as real ones do
            return tt, pt, tb, tc, pc


def _clear(p, T, pressure, need) -> bool:
    """A grid crossing well inside one region: 10 °C from the melting line, 20 kPa from the other lines."""
    if abs(T - melting(p, pressure)) < 10:
        return False
    if T <= p["tt"] and abs(pressure - sublimation(p, T)) < 20:
        return False
    if p["tt"] <= T <= p["tc"] and abs(pressure - vapour(p, T)) < 20:
        return False
    return state(p, T, pressure) == need and not (T > p["tc"] or pressure > p["pc"])


def sample(rng: random.Random) -> dict:
    kind = rng.choice(["pt", "pt", "colligative", "partition"])
    if kind == "pt":
        tt, pt, tb, tc, pc = _pt_points(rng)
        p = {"band": "UP", "kind": kind, "tt": tt, "pt": pt, "tb": tb, "tc": tc, "pc": pc,
             "lean": rng.choice([-8, -5, 5, 8]), "letters": rng.sample(["A", "B", "C", "D", "P", "Q", "R", "S"], 3)}
        need = rng.choice(["solid", "liquid", "gas"])
        spots = [(T, q) for T in range(tt - 30, tc + 1, 10) for q in range(20, pc + 1, 20) if _clear(p, T, q, need)]
        p["ask"] = list(rng.choice(spots))
        p["asks"] = rng.sample(["state", "region", "triple", "lowest", "boil", "critical", "freeze"], 3)
        p["region"] = rng.choice(["solid", "liquid", "gas"])
        return p
    if kind == "colligative":
        tt = rng.choice(range(-20, 31, 5))
        pt = rng.choice([20, 50])
        tb = tt + rng.choice([50, 55, 60, 65, 70])
        # The solvent freezes 5 °C below its triple point at 100 kPa (its melting line leans left, as water's does).
        return {"band": "UP", "kind": kind, "tt": tt, "pt": pt, "tb": tb, "tc": tb + 60, "pc": 220,
                "lean": -500 / (100 - pt), "df": rng.choice([5, 10]), "db": rng.choice([5, 10, 15]),
                "asks": rng.sample(["elevation", "depression", "solution boils", "solution freezes"], 3)}
    while True:
        k = rng.randint(2, 12)
        v_org = rng.choice([20, 25, 50])
        v_aq = rng.choice([50, 100, 200])
        share = Fraction(k * v_org, k * v_org + v_aq)
        m_aq = Fraction(rng.choice([2, 4, 5, 6, 8, 10, 12]), 10)
        m_org = Fraction(k * v_org) * m_aq / v_aq
        if (share * 100).denominator == 1 and (m_org * 100).denominator == 1 and 0 < share < 1 and m_org <= 6:
            break
    return {"band": "UP", "kind": kind, "solvent": rng.choice(sorted(SOLVENTS)), "v_org": v_org, "v_aq": v_aq,
            "m_org": str(m_org.numerator / m_org.denominator), "m_aq": str(float(m_aq)),
            "ask": rng.choice(["conc_org", "conc_aq"])}


SOLVENTS = {"hexane": "0.66", "ethoxyethane": "0.71", "dichloromethane": "1.33", "tetrachloromethane": "1.59"}


# --- drawing --------------------------------------------------------------------------------------------------------

def _grid(ax, x0, x1, xstep, ytop, ystep):
    ax.set_xlim(x0, x1)
    ax.set_ylim(0, ytop)
    ax.set_xticks(range(x0, x1 + 1, xstep))
    ax.set_yticks(range(0, ytop + 1, ystep))
    ax.grid(True, color=GRID, linewidth=0.6)
    ax.set_axisbelow(True)
    ax.tick_params(labelsize=8.5)
    ax.set_xlabel("Temperature (°C)")
    ax.set_ylabel("Pressure (kPa)")


def _xs(a, b, n=160):
    return [a + (b - a) * i / n for i in range(n + 1)]


def _draw_pt(p):
    fig, ax = new_figure(6.6, 5.0)
    x0, x1, top = p["tt"] - 40, p["tc"] + 20, p["pc"] + 60
    # a gridline every 10 °C; a wide diagram numbers every other one, so the numbers do not crowd
    _grid(ax, x0, x1, 20 if x1 - x0 > 160 else 10, top, 20)
    ax.set_xticks(range(x0, x1 + 1, 10), minor=True)
    ax.grid(True, which="minor", axis="x", color=GRID, linewidth=0.6)
    xs = _xs(p["tt"], p["tc"])
    ax.plot(xs, [vapour(p, T) for T in xs], color=INK, linewidth=1.8, gid="line:vapour")
    lo = x0
    xs = _xs(lo, p["tt"])
    ax.plot(xs, [sublimation(p, T) for T in xs], color=INK, linewidth=1.8, gid="line:sublimation")
    ax.plot([p["tt"], melting(p, top)], [p["pt"], top], color=INK, linewidth=1.8, gid="line:melting")
    for (T, q), mark in (((p["tt"], p["pt"]), "T"), ((p["tc"], p["pc"]), "C")):
        ax.plot([T], [q], marker="o", color=INK, markersize=6, zorder=4, gid=f"point:{mark}")
        ax.annotate(mark, (T, q), xytext=(8, -12) if mark == "T" else (8, 2), textcoords="offset points", fontsize=11,
                    fontweight="bold", gid=f"mark:{mark}")
    for name, (T, q) in region_spots(p).items():
        L = p["letters"][["solid", "liquid", "gas"].index(name)]
        ax.text(T, q, L, ha="center", va="center", fontsize=14, fontweight="bold", gid=f"region:{name}",
                bbox=dict(boxstyle="circle,pad=0.25", facecolor="white", edgecolor=INK, linewidth=1.0))
    ax.set_title("Phase diagram of substance X\nT: triple point    C: critical point", fontsize=10.5)
    return fig


def region_spots(p: dict) -> dict:
    """Where each region's letter sits: well inside it."""
    top = p["pc"] + 60
    tt, tb, tc = p["tt"], p["tb"], p["tc"]
    solid = (min(tt - 22, melting(p, (p["pt"] + top) / 2) - 22), (p["pt"] + top) / 2 + 20)
    Tl = (tt + tb) / 2 + 8
    liquid = (max(Tl, melting(p, top - 40) + 18), (max(vapour(p, Tl), 100) + top) / 2 + 10)
    Tg = (tb + tc) / 2
    gas = (Tg, vapour(p, Tg) / 3)
    return {"solid": solid, "liquid": liquid, "gas": gas}


def _colligative_lines(p):
    """The solvent's and the solution's lines: (name, solution?, xs, ys)."""
    tt, pt, tb = p["tt"], p["pt"], p["tb"]
    x0, x1 = tt - 30, tb + 35
    tf = melting(p, 100)
    out = []
    xs = _xs(tt, x1)
    out.append(("vapour", False, xs, [vapour(p, T) for T in xs]))
    xs = _xs(x0, tt)
    out.append(("sublimation", False, xs, [sublimation(p, T) for T in xs]))
    out.append(("melting", False, [tt, melting(p, TOP_C)], [pt, TOP_C]))
    # The solution: its melting line parallel, freezing p["df"] lower at 100 kPa; it meets the solid's line lower down.
    fs = tf - p["df"]

    def smelt(q):
        return fs + p["lean"] * (q - 100) / 100

    lo, hi = x0, tt
    for _ in range(60):  # where the solution's melting line meets the sublimation line
        mid = (lo + hi) / 2
        if sublimation(p, mid) < (mid - fs) * 100 / p["lean"] + 100:
            lo = mid
        else:
            hi = mid
    t3 = (lo + hi) / 2
    p3 = sublimation(p, t3)
    out.append(("solution melting", True, [t3, smelt(TOP_C)], [p3, TOP_C]))
    bs = tb + p["db"]
    xs = _xs(t3, x1)
    end = vapour(p, x1) * 0.82
    out.append(("solution vapour", True, xs, [pchip([t3, bs, x1], [p3, 100, end], T) for T in xs]))
    return out


TOP_C = 200  # the colligative diagram's top, kPa


def _draw_colligative(p):
    fig, ax = new_figure(6.8, 5.0)
    x0, x1 = p["tt"] - 30, p["tb"] + 35
    _grid(ax, x0, x1, 10, TOP_C, 20)  # numbered every 10 °C, a gridline every 5 °C
    ax.set_xticks(range(x0, x1 + 1, 5), minor=True)
    ax.grid(True, which="minor", axis="x", color=GRID, linewidth=0.4)
    for name, dashed, xs, ys in _colligative_lines(p):
        ax.plot(xs, ys, color=INK, linewidth=1.7, linestyle=(0, (5, 3)) if dashed else "-", gid=f"line:{name}",
                label=None)
    ax.plot([x0, x1], [100, 100], color=INK, linewidth=1.0, linestyle=(0, (1.5, 2)), gid="line:100kPa")
    ax.text(x0 + 1, 104, "100 kPa", ha="left", va="bottom", fontsize=9)
    tf = melting(p, 100)
    for T in (tf - p["df"], tf, p["tb"], p["tb"] + p["db"]):
        ax.plot([T], [100], marker="o", color=INK, markersize=5, zorder=4)
        ax.plot([T, T], [0, 100], color=INK, linewidth=0.8, linestyle=(0, (1, 2)))
    ax.plot([], [], color=INK, linewidth=1.7, label="pure solvent")
    ax.plot([], [], color=INK, linewidth=1.7, linestyle=(0, (5, 3)), label="solution")
    ax.legend(loc="upper left", fontsize=9, frameon=True)
    ax.set_title("Phase diagram of a solvent and of a solution in it", fontsize=10.5)
    return fig


def _draw_partition(p):
    fig, ax = new_figure(6.4, 5.4)
    dens = SOLVENTS[p["solvent"]]
    org_top = float(dens) < 1
    # The funnel: a pear-shaped bulb, the tap and the stem; lower layer up to y = 4, upper layer up to y = 6.2.
    import numpy as np
    ys = np.linspace(1.6, 7.2, 60)

    def half(y):
        return 1.8 * math.sin(math.pi * (y - 1.6) / 5.6) ** 0.8 + 0.18

    left = [(-half(y), y) for y in ys]
    right = [(half(y), y) for y in ys[::-1]]
    for lo, hi, face in ((1.6, 4.0, "#b9c6d0"), (4.0, 6.2, "#e7ecef")):
        pts = [(-half(y), y) for y in np.linspace(lo, hi, 30)] + [(half(y), y) for y in np.linspace(hi, lo, 30)]
        ax.add_patch(Polygon(pts, closed=True, facecolor=face, edgecolor="none", zorder=1))
    ax.add_patch(Polygon(left + right, closed=True, facecolor="none", edgecolor=INK, linewidth=1.5, zorder=2))
    ax.plot([-0.18, -0.18], [1.6, 0.2], color=INK, linewidth=1.5)
    ax.plot([0.18, 0.18], [1.6, 0.2], color=INK, linewidth=1.5)
    ax.add_patch(Polygon([(-0.45, 1.0), (0.45, 1.0), (0.45, 1.3), (-0.45, 1.3)], closed=True, facecolor=FILL_2,
                         edgecolor=INK, linewidth=1.2, zorder=3))  # the tap
    ax.plot([-0.25, -0.25, 0.25, 0.25], [7.2, 7.7, 7.7, 7.2], color=INK, linewidth=1.5)  # the stopper
    ax.plot([-half(4.0), half(4.0)], [4.0, 4.0], color=INK, linewidth=1.0)
    ax.plot([-half(6.2), half(6.2)], [6.2, 6.2], color=INK, linewidth=1.0)
    org = (f"{p['solvent']} layer", f"density {dens} g/cm³")
    water = ("water layer", "density 1.00 g/cm³")
    upper, lower = (org, water) if org_top else (water, org)
    v_up, v_lo = (p["v_org"], p["v_aq"]) if org_top else (p["v_aq"], p["v_org"])
    m_up, m_lo = (p["m_org"], p["m_aq"]) if org_top else (p["m_aq"], p["m_org"])
    for y, (name, density), v, m, tag in ((5.1, upper, v_up, m_up, "upper"), (2.8, lower, v_lo, m_lo, "lower")):
        ax.plot([half(y) - 0.1, 2.6], [y, y], color=INK, linewidth=0.8)
        ax.text(2.75, y + 0.5, name, ha="left", va="center", fontsize=10, fontweight="bold", gid=f"layer:{tag}")
        ax.text(2.75, y, f"{density}, volume {v} cm³", ha="left", va="center", fontsize=9.5)
        ax.text(2.75, y - 0.5, f"contains {m} g of X", ha="left", va="center", fontsize=9.5, gid=f"mass:{tag}")
    ax.text(-2.2, 8.75, "Kpc = concentration of X in the organic solvent", ha="left", va="center", fontsize=9.5)
    ax.text(-1.2, 8.25, "÷ concentration of X in water", ha="left", va="center", fontsize=9.5)
    ax.set_xlim(-2.4, 9.0)
    ax.set_ylim(-0.1, 9.1)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def draw(p: dict):
    return {"pt": _draw_pt, "colligative": _draw_colligative, "partition": _draw_partition}[p["kind"]](p)


# --- questions ------------------------------------------------------------------------------------------------------

SETTINGS = ["in a chemistry lesson", "for homework", "on a revision card", "for a class test", "at the science club",
            "while revising for an examination", "for a group discussion"]
VERBS = ["drew", "copied", "studied", "labelled", "sketched"]
FREEZE_RULE = ("(A melting line that leans to the left as the pressure rises shows a solid less dense than its liquid; "
               "one that leans to the right shows a solid denser than its liquid.)")


def _pt_question(p, ask, rng):
    if ask == "state":
        T, q = p["ask"]
        return mcq(f"What is the physical state of X at {T} °C and {q} kPa?", state(p, T, q), ["solid", "liquid", "gas"], rng)
    if ask == "region":
        names = ["solid", "liquid", "gas"]
        key = p["letters"][names.index(p["region"])]
        return letter_choice(f"Which letter marks the region where X is a {p['region']}?", key, p["letters"])
    if ask == "triple":
        return short("What is the temperature of the triple point of X?", exact(p["tt"]), measure(p["tt"], "°C"))
    if ask == "lowest":
        return short("What is the lowest pressure at which liquid X can exist?", exact(p["pt"]), measure(p["pt"], "kPa"))
    if ask == "boil":
        return short("At what temperature does liquid X boil when the pressure is 100 kPa?", exact(p["tb"]),
                     measure(p["tb"], "°C"))
    if ask == "critical":
        return short("Above what temperature can X not be made liquid, however high the pressure?", exact(p["tc"]),
                     measure(p["tc"], "°C"))
    key = "X expands when it freezes" if p["lean"] < 0 else "X contracts when it freezes"
    return mcq(f"{FREEZE_RULE} What happens to the volume of X when it freezes?", key,
               ["X expands when it freezes", "X contracts when it freezes", "the volume of X does not change when it freezes"],
               rng)


def _colligative_question(p, ask):
    tf = melting(p, 100)
    if ask == "elevation":
        return short("By how many degrees is the boiling point of the solution at 100 kPa higher than that of the pure "
                     "solvent?", exact(p["db"]), measure(p["db"], "°C"))
    if ask == "depression":
        return short("By how many degrees is the freezing point of the solution at 100 kPa lower than that of the pure "
                     "solvent?", exact(p["df"]), measure(p["df"], "°C"))
    if ask == "solution boils":
        v = p["tb"] + p["db"]
        return short("At what temperature does the solution boil at 100 kPa?", exact(v), measure(v, "°C"))
    v = tf - p["df"]
    return short("At what temperature does the solution freeze at 100 kPa?", exact(v), measure(v, "°C"))


def _conc(m: str, v: int) -> Fraction:
    return Fraction(m) / v


def _partition_questions(p, rng, who):
    k = _conc(p["m_org"], p["v_org"]) / _conc(p["m_aq"], p["v_aq"])
    share = Fraction(p["m_org"]) / (Fraction(p["m_org"]) + Fraction(p["m_aq"])) * 100
    lead = f"{who} shook X with water and {p['solvent']} {rng.choice(SETTINGS)} and let the layers separate."
    if p["ask"] == "conc_org":
        c, where = _conc(p["m_org"], p["v_org"]) * 1000, f"the {p['solvent']} layer"
    else:
        c, where = _conc(p["m_aq"], p["v_aq"]) * 1000, "the water layer"
    cq = short(f"What is the concentration of X in {where}, in g/dm³?", exact(float(c)),
               measure(float(c), "g/dm³") + [f"{exact(float(c))} g dm-3", f"{exact(float(c))} g dm⁻³"])
    return [short(f"{lead} What is the partition coefficient, Kpc, of X between {p['solvent']} and water?",
                  exact(float(k)), [exact(float(k))]),
            cq,
            short("What percentage of the X in the funnel is in the organic layer?", exact(float(share)),
                  measure(float(share), "%") + [f"{exact(float(share))}%"])]


def questions(p: dict, rng: random.Random) -> list[Question]:
    who = rng.choice(NAMES)
    if p["kind"] == "partition":
        return _partition_questions(p, rng, who)
    lead = f"{who} {rng.choice(VERBS)} this phase diagram {rng.choice(SETTINGS)}."
    if p["kind"] == "pt":
        qs = [_pt_question(p, a, rng) for a in p["asks"]]
    else:
        qs = [_colligative_question(p, a) for a in p["asks"]]
    qs[0].stem = f"{lead} {qs[0].stem}"
    return qs
