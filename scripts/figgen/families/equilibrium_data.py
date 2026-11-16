"""Equilibrium data (UP, AL): five kinds of figure for reversible reactions.

- time: the concentrations of every substance in a sealed flask against time, for a stated reaction (H₂ + I₂ ⇌ 2HI
  from either side, N₂O₄ ⇌ 2NO₂, PCl₅ ⇌ PCl₃ + Cl₂, 2SO₂ + O₂ ⇌ 2SO₃); each curve meets its level line at a visible
  corner on a gridline. Asks when equilibrium was first reached and an equilibrium concentration; with the Kc expression
  printed (always at AL, half the UP figures), the value of Kc, otherwise how far a reactant's concentration fell.
- table: an initial and equilibrium amounts table for a stated reaction, one equilibrium amount printed and the others
  marked ?, the volume and the Kc expression printed; asks an equilibrium amount, a concentration and Kc.
- yield: the percentage of product at equilibrium against temperature at three pressures, for a stated reaction whose
  forward reaction is exothermic and makes fewer gas molecules (no real reaction: its data would not be ours to invent);
  each marked point on a gridline. Asks a reading, the temperature giving a percentage, a rise with pressure, and which
  marked conditions give a percentage.
- bag: two NPK fertiliser bags (grade and net mass printed, the grade convention printed); the mass of N, P₂O₅ or K₂O in
  a bag, which bag holds more nitrogen, the total mass of the three nutrients.
- nitrogen: a table of nitrogen fertilisers (name, formula, Mr) with Ar(N) and the percentage formula printed; the
  percentage of nitrogen by mass, the richest in nitrogen, the mass of nitrogen in a sack.

Every value is exact: concentrations are whole multiples of the grid step, Kc has at most two decimal places, the
percentages and masses are worked from printed numbers (one decimal place where a percentage does not terminate).
The Kc figures stay out of the IGCSE chapters (IGCSE does not teach Kc); the fertiliser figures reach only topics named
for fertilisers, the IGCSE workbook chapter with its Fertilisers section, industrial chemistry and (AL) "Nitrogen gas",
whose "Ammonia and ammonium compounds" section teaches ammonium fertilisers.
"""
from __future__ import annotations

import random
from decimal import ROUND_HALF_UP, Decimal
from fractions import Fraction

from matplotlib.patches import Polygon

from ..core import GRID, INK, NAMES, Question, exact, measure, new_figure, short, sub
from ._bio_parts import letter_choice

ID = "equilibrium_data"
KIND = "graph.line"
SUBJECT = "chemistry"
BANDS = ("UP", "AL")
CONCEPTS = tuple(f"chemistry.{c}" for c in ("equilibrium", "equilibrium-constant", "le-chatelier-principle", "fertilizers",
                                             "nitrogen-compounds", "chemical-formulae"))
# A topic whose sections the book lists is reached only if one names equilibrium, reversible reactions, Kc or fertilisers.
NEEDS = r"equilibri|reversible|\bkc\b|fertili|npk|ammoni|nitrogen gas|industr"
# Equilibrium figures are no figure for phases, solubility, acids, cells, rates, energetics or fertilisers.
AVOID = (r"phase|solubility|\bph\b|acid|electrochem|redox|\brates?\b|kinetic|stoichiometr|energetic|conductiv|titration|"
         r"colligative|solvent|indicator|environment|nitrogen gas|group|npk|fertili|industr")
# IGCSE teaches equilibrium but not Kc.
NO_KC = r"|^(chapter 14: )?reversible reactions and equilibrium$"
# Fertiliser figures: only topics named for fertilisers, industrial chemistry, or the IGCSE workbook chapter.
FERT_ONLY = r"^(?!.*(?:npk|fertili|industrial chemistry)|reversible reactions and equilibrium$)"
NITROGEN_AL = r"^(?!.*nitrogen gas)"


def concepts_for(p: dict) -> tuple[str, ...]:
    kind = p["kind"]
    c = "chemistry."
    if kind == "time":
        return (c + "equilibrium",) + ((c + "equilibrium-constant",) if p["kc"] else ())
    if kind == "table":
        return (c + "equilibrium", c + "equilibrium-constant")
    if kind == "yield":
        return (c + "equilibrium", c + "le-chatelier-principle")
    if kind == "bag":
        return (c + "fertilizers",)
    return (c + "fertilizers", c + "nitrogen-compounds") + ((c + "chemical-formulae",) if p["band"] == "AL" else ())


def avoid_for(p: dict) -> str:
    kind = p["kind"]
    if kind in ("bag", "nitrogen"):
        return NITROGEN_AL if p["band"] == "AL" else FERT_ONLY
    if kind == "yield":
        return AVOID.replace("|industr", "") + r"|quantitative"
    if kind == "table" or p["kc"]:
        return AVOID + NO_KC
    return AVOID


# --- the reactions ------------------------------------------------------------------------------------------------

# reaction: (equation as printed, reactants {species: coefficient}, products {species: coefficient}, Kc expression)
REACTIONS = {
    "HI": ("H2(g) + I2(g) ⇌ 2HI(g)", {"H2": 1, "I2": 1}, {"HI": 2}, "Kc = [HI]² / ([H2][I2])"),
    "N2O4": ("N2O4(g) ⇌ 2NO2(g)", {"N2O4": 1}, {"NO2": 2}, "Kc = [NO2]² / [N2O4]"),
    "PCl5": ("PCl5(g) ⇌ PCl3(g) + Cl2(g)", {"PCl5": 1}, {"PCl3": 1, "Cl2": 1}, "Kc = [PCl3][Cl2] / [PCl5]"),
    "SO3": ("2SO2(g) + O2(g) ⇌ 2SO3(g)", {"SO2": 2, "O2": 1}, {"SO3": 2}, "Kc = [SO3]² / ([SO2]²[O2])"),
    "NH3": ("N2(g) + 3H2(g) ⇌ 2NH3(g)", {"N2": 1, "H2": 3}, {"NH3": 2}, "Kc = [NH3]² / ([N2][H2]³)"),
    "ester": ("CH3COOH(l) + C2H5OH(l) ⇌ CH3COOC2H5(l) + H2O(l)", {"CH3COOH": 1, "C2H5OH": 1},
              {"CH3COOC2H5": 1, "H2O": 1}, "Kc = [CH3COOC2H5][H2O] / ([CH3COOH][C2H5OH])"),
}
TIME_REACTIONS = ["HI", "HI", "N2O4", "PCl5", "SO3"]
TABLE_REACTIONS = ["HI", "N2O4", "PCl5", "SO3", "NH3", "ester"]


def printed(text: str) -> str:
    """A formula or equation as printed: digits after a letter or a bracket are subscripts; a leading coefficient,
    the ² and ³ of powers, and the arrows stay as they are."""
    out, prev = [], ""
    for ch in text:
        out.append(sub(ch) if ch.isdigit() and prev and (prev.isalpha() or prev in ")₀₁₂₃₄₅₆₇₈₉") else ch)
        prev = out[-1]
    return "".join(out)


def species(reaction: str) -> list[str]:
    _, left, right, _ = REACTIONS[reaction]
    return list(left) + list(right)


def at_equilibrium(reaction: str, start: dict, x: int) -> dict:
    """Each substance's amount at equilibrium, in the figure's units, after x units of the forward reaction."""
    _, left, right, _ = REACTIONS[reaction]
    out = {s: start[s] - k * x for s, k in left.items()}
    out.update({s: start[s] + k * x for s, k in right.items()})
    return out


def kc_of(reaction: str, conc: dict) -> Fraction:
    _, left, right, _ = REACTIONS[reaction]
    top, bottom = Fraction(1), Fraction(1)
    for s, k in right.items():
        top *= conc[s] ** k
    for s, k in left.items():
        bottom *= conc[s] ** k
    return top / bottom


def _neat_kc(v: Fraction) -> bool:
    return (v * 100).denominator == 1 and Fraction(1, 100) <= v <= 10000


# --- sampling -----------------------------------------------------------------------------------------------------

def _sample_time(rng: random.Random, band: str) -> dict:
    reaction = rng.choice(TIME_REACTIONS)
    back = reaction == "HI" and rng.random() < 0.4
    kc = band == "AL" or rng.random() < 0.5
    step = rng.choice([0.1, 0.2])
    s = Fraction(str(step))
    while True:
        if reaction == "HI" and not back:
            a, b = rng.sample(range(4, 11), 2)
            start, x = {"H2": a, "I2": b, "HI": 0}, rng.randint(2, min(a, b) - 1)
        elif reaction == "HI":
            c = rng.randint(6, 12)
            start, x = {"H2": 0, "I2": 0, "HI": c}, -rng.randint(2, (c - 1) // 2)
        elif reaction == "N2O4":
            a = rng.randint(4, 10)
            start, x = {"N2O4": a, "NO2": 0}, rng.randint(2, a - 1)
        elif reaction == "PCl5":
            a = rng.randint(5, 11)
            start, x = {"PCl5": a, "PCl3": 0, "Cl2": 0}, rng.randint(2, a - 1)
        else:
            a, b = rng.randint(6, 12), rng.randint(3, 8)
            start, x = {"SO2": a, "O2": b, "SO3": 0}, rng.randint(2, min((a - 1) // 2, b - 1))
        eq = at_equilibrium(reaction, start, x)
        levels = [eq[c.split("+")[0]] for c in _curves(reaction, start)]
        if min(eq.values()) < 1 or len(set(levels)) < len(levels):
            continue
        if kc and not _neat_kc(kc_of(reaction, {k: v * s for k, v in eq.items()})):
            continue
        break
    unit = rng.choice(["s", "min"])
    tstep = rng.choice([10, 20, 30, 50]) if unit == "s" else rng.choice([1, 2, 5])
    T = tstep * rng.randint(3, 6)
    curves = _curves(reaction, start)
    ask = rng.choice(curves)
    reactants = [sp for sp in REACTIONS[reaction][1] if start[sp] > 0] or [sp for sp in REACTIONS[reaction][2] if start[sp] > 0]
    return {"band": band, "kind": "time", "reaction": reaction, "start": start, "x": x, "step": step, "unit": unit,
            "tstep": tstep, "T": T, "end": T + tstep * rng.randint(3, 5), "kc": kc, "ask": ask.split("+")[0],
            "fall": rng.choice(reactants)}


def _curves(reaction: str, start: dict) -> list[str]:
    """The curves drawn: substances whose concentrations always match share one curve ("PCl3+Cl2")."""
    seen, out = {}, []
    eq = at_equilibrium(reaction, start, 1)
    for sp in species(reaction):
        key = (start[sp], eq[sp])
        if key in seen:
            out[seen[key]] += "+" + sp
        else:
            seen[key] = len(out)
            out.append(sp)
    return out


def _sample_table(rng: random.Random, band: str) -> dict:
    reaction = rng.choice(TABLE_REACTIONS)
    _, left, right, _ = REACTIONS[reaction]
    while True:
        start = {sp: rng.randint(4, 12) for sp in left}
        start.update({sp: 0 for sp in right})
        x = rng.randint(1, 8)
        eq = at_equilibrium(reaction, start, x)
        if min(eq.values()) < 1:
            continue
        V10 = rng.choice([5, 10, 20, 40, 50])
        conc = {sp: Fraction(n, 10) / Fraction(V10, 10) for sp, n in eq.items()}
        if reaction == "ester":
            V10 = None
        if not _neat_kc(kc_of(reaction, conc)):
            continue
        break
    known = rng.choice(list(right))
    ask = rng.choice(list(left))
    conc_of = rng.choice([sp for sp in species(reaction) if sp != ask])
    return {"band": band, "kind": "table", "reaction": reaction, "start": start, "x": x, "V10": V10, "known": known,
            "ask": ask, "conc": conc_of}


YIELD_REACTIONS = [("2X(g) + Y(g) ⇌ 2Z(g)", "Z"), ("A(g) + 3B(g) ⇌ 2C(g)", "C"), ("2D(g) + E(g) ⇌ 2G(g)", "G")]
PRESSURE_SETS = [[50, 100, 200], [100, 200, 300], [100, 200, 400], [100, 250, 400], [50, 150, 300]]


def _sample_yield(rng: random.Random, band: str) -> dict:
    first = rng.choice([200, 300])
    temps = [first + 100 * k for k in range(5)]
    pressures = rng.choice(PRESSURE_SETS)
    # The lowest pressure's curve falls by 5 to 15 points per 100 °C; each higher pressure lies 10 to 20 points above
    # the one below, the gap never widening as the temperature rises (all the yields shrink together).
    while True:
        bottom = [rng.choice(range(35, 61, 5))]
        for _ in range(4):
            bottom.append(bottom[-1] - rng.choice([5, 10, 10, 15]))
        if bottom[-1] < 5:
            continue
        rows = [bottom]
        for _ in range(2):
            gaps = sorted((rng.choice([10, 15, 20]) for _ in range(5)), reverse=True)
            rows.append([v + g for v, g in zip(rows[-1], gaps)])
        if max(rows[-1]) > 95:
            continue
        break
    flat = [v for r in rows for v in r]
    # the readings asked: (temperature index, pressure index) for a reading; a pressure row for the temperature asked
    ti, pj = rng.randrange(5), rng.randrange(3)
    row = rng.randrange(3)
    rise_t = rng.randrange(5)
    lo, hi = sorted(rng.sample(range(3), 2))
    unique = [(i, j) for i in range(5) for j in range(3) if flat.count(rows[j][i]) == 1 and 0 < i < 4 and j == 1]
    pick = rng.choice(unique) if unique else None
    return {"band": band, "kind": "yield", "reaction": rng.randrange(len(YIELD_REACTIONS)), "temps": temps,
            "pressures": pressures, "yields": rows, "read": [ti, pj], "row": [row, rng.randrange(5)],
            "rise": [rise_t, lo, hi], "pick": list(pick) if pick else None}


GRADES = [[17, 17, 17], [15, 15, 15], [20, 10, 10], [10, 20, 20], [12, 24, 12], [20, 20, 0], [25, 5, 5], [23, 23, 0],
          [16, 16, 8], [14, 28, 14]]
BAG_MASSES = [10, 25, 50]
PLACES = ["in Musanze", "in Nyagatare", "near Huye", "in Rwamagana", "in Kayonza", "near Rubavu", "in Gicumbi", "in Nyanza"]


def _sample_bag(rng: random.Random) -> dict:
    while True:
        g1, g2 = rng.sample(GRADES, 2)
        m1, m2 = rng.choice(BAG_MASSES), rng.choice(BAG_MASSES)
        n1, n2 = Fraction(g1[0] * m1, 100), Fraction(g2[0] * m2, 100)
        if abs(n1 - n2) >= 1:
            break
    nutrient = rng.choice(["P2O5", "K2O"])
    which = rng.choice("PQ")
    other = rng.choice("PQ")
    k = 1 if nutrient == "P2O5" else 2
    if [g1, g2]["PQ".index(other)][k] == 0:
        nutrient = "P2O5" if nutrient == "K2O" else "K2O"
    return {"band": "UP", "kind": "bag", "bags": [["P", g1, m1], ["Q", g2, m2]], "which": which, "other": other,
            "nutrient": nutrient, "total": rng.choice("PQ"), "place": rng.choice(PLACES)}


# fertiliser: (formula as typed, nitrogen atoms per formula, Mr)
FERTILISERS = {
    "ammonium nitrate": ("NH4NO3", 2, "80"), "ammonium sulfate": ("(NH4)2SO4", 2, "132"), "urea": ("CO(NH2)2", 2, "60"),
    "ammonium chloride": ("NH4Cl", 1, "53.5"), "ammonium phosphate": ("(NH4)3PO4", 3, "149"),
    "potassium nitrate": ("KNO3", 1, "101"), "calcium nitrate": ("Ca(NO3)2", 2, "164"),
    "ammonium dihydrogenphosphate": ("NH4H2PO4", 1, "115"),
}
SACKS = [10, 20, 25, 40, 50]


def percent_n(name: str) -> Fraction:
    _, n, mr = FERTILISERS[name]
    return Fraction(14 * n) / Fraction(mr) * 100


def _sample_nitrogen(rng: random.Random, band: str) -> dict:
    while True:
        names = rng.sample(sorted(FERTILISERS), 4)
        ps = sorted((percent_n(n) for n in names), reverse=True)
        if ps[0] - ps[1] >= 1:
            break
    ask = rng.choice(names)
    sack = rng.choice([n for n in names if n != ask])
    return {"band": band, "kind": "nitrogen", "names": names, "ask": ask, "sack": [sack, rng.choice(SACKS)],
            "place": rng.choice(PLACES)}


def sample(rng: random.Random) -> dict:
    kind = rng.choice(["time", "time", "table", "yield", "bag", "nitrogen"])
    if kind == "bag":
        return _sample_bag(rng)
    band = rng.choice(BANDS)
    return {"time": _sample_time, "table": _sample_table, "yield": _sample_yield, "nitrogen": _sample_nitrogen}[kind](rng, band)


# --- drawing ------------------------------------------------------------------------------------------------------

def _rise(u: float) -> float:
    """From 0 to 1 as u goes from 0 to 1, fastest at the start and still changing at 1, so the corner shows."""
    return 2.5 * u - 2.5 * u * u + u ** 3


def _label(curve: str) -> str:
    return " and ".join(printed(sp) for sp in curve.split("+"))


def _draw_time(p: dict):
    reaction, start, x = p["reaction"], p["start"], p["x"]
    eqn, _, _, expr = REACTIONS[reaction]
    eq = at_equilibrium(reaction, start, x)
    step, T, end = p["step"], p["T"], p["end"]
    top_units = max(max(start.values()), max(eq.values())) + 2
    fig, ax = new_figure(7.4, 4.9)
    ax.set_xlim(0, end * 1.2)
    ax.set_ylim(0, top_units * step)
    ax.set_xticks(range(0, end + 1, p["tstep"]))
    ax.set_yticks([k * step for k in range(top_units + 1)])
    ax.set_yticklabels([exact(Fraction(str(step)) * k) for k in range(top_units + 1)])
    ax.grid(True, color=GRID, linewidth=0.6)
    ax.set_axisbelow(True)
    styles = ["-", (0, (6, 3)), (0, (1.5, 2)), (0, (6, 2, 1.5, 2))]
    ts = [end * k / 600 for k in range(601)]
    for k, curve in enumerate(_curves(reaction, start)):
        sp = curve.split("+")[0]
        c0, c1 = start[sp], eq[sp]
        ys = [(c0 + (c1 - c0) * _rise(min(t / T, 1.0))) * step for t in ts]
        ax.plot(ts, ys, color=INK, linewidth=1.8, linestyle=styles[k], gid=f"curve:{curve}")
        ax.text(end * 1.02, c1 * step, _label(curve), ha="left", va="center", fontsize=10, gid=f"label:{curve}")
    ax.set_xlabel(f"Time ({'s' if p['unit'] == 's' else 'min'})")
    ax.set_ylabel("Concentration (mol/dm³)")
    ax.tick_params(labelsize=8.5)
    title = printed(eqn) + ("\n" + printed(expr) if p["kc"] else "")
    ax.set_title(title, fontsize=10.5, loc="left")
    return fig


def _table(ax, heads, rows, widths, top, row_h=0.62, head_h=0.8, size=10.5):
    xs = [0.0]
    for w in widths:
        xs.append(xs[-1] + w)
    ys = [top, top - head_h] + [top - head_h - row_h * (k + 1) for k in range(len(rows))]
    for y in ys:
        ax.plot([0, xs[-1]], [y, y], color=INK, linewidth=1.1 if y in (ys[0], ys[1], ys[-1]) else 0.7)
    for xx in xs:
        ax.plot([xx, xx], [ys[0], ys[-1]], color=INK, linewidth=0.8)
    for k, h in enumerate(heads):
        ax.text((xs[k] + xs[k + 1]) / 2, top - head_h / 2, h, ha="center", va="center", fontsize=size, fontweight="bold")
    for i, row in enumerate(rows):
        y = top - head_h - row_h * (i + 0.5)
        for k, c in enumerate(row):
            ax.text((xs[k] + xs[k + 1]) / 2, y, c, ha="center", va="center", fontsize=size,
                    fontweight="bold" if k == 0 else "normal", gid=f"cell:{i}:{k}")
    return xs[-1], ys[-1]


def _amount(n: int) -> str:
    return exact(Fraction(n, 10))


def _draw_table(p: dict):
    reaction = p["reaction"]
    eqn, left, right, expr = REACTIONS[reaction]
    eq = at_equilibrium(reaction, p["start"], p["x"])
    names = species(reaction)
    widths = [5.0] + [2.6 if len(n) < 8 else 3.4 for n in names]
    heads = [""] + [printed(n) for n in names]
    rows = [["initial amount / mol"] + [_amount(p["start"][n]) for n in names],
            ["equilibrium amount / mol"] + [_amount(eq[n]) if n == p["known"] else "?" for n in names]]
    total = sum(widths)
    W = max(total, 14.0)
    fig, ax = new_figure(W * 0.5 + 0.3, 4.3)
    fig.subplots_adjust(left=0.01, right=0.99, top=0.99, bottom=0.01)
    ax.text(0.05, 0.75, printed(eqn), ha="left", va="center", fontsize=11.5, fontweight="bold")
    w, bottom = _table(ax, heads, rows, widths, 0.0)
    if p["V10"]:
        notes = [f"The mixture is in a sealed container of volume {exact(Fraction(p['V10'], 10))} dm³ at constant temperature.",
                 "concentration (mol/dm³) = amount (mol) ÷ volume (dm³)", printed(expr)]
    else:
        notes = ["The mixture is kept at constant temperature in a sealed flask.",
                 "The volume cancels in Kc, so amounts in mol may be used in place of concentrations.", printed(expr)]
    y = bottom - 0.55
    for n in notes:
        ax.text(0.05, y, n, ha="left", va="center", fontsize=10.5)
        y -= 0.5
    ax.set_xlim(-0.2, W + 0.2)
    ax.set_ylim(y, 1.2)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def _smooth(xs, ys, n: int = 30):
    """A monotone cubic through the points (Fritsch-Carlson): no bumps between marked readings."""
    h = [b - a for a, b in zip(xs, xs[1:])]
    d = [(ys[i + 1] - ys[i]) / h[i] for i in range(len(h))]
    m = [d[0]] + [0.0 if d[i - 1] * d[i] <= 0 else
                  (3 * (h[i - 1] + h[i])) / ((2 * h[i] + h[i - 1]) / d[i - 1] + (h[i] + 2 * h[i - 1]) / d[i])
                  for i in range(1, len(d))] + [d[-1]]
    out_x, out_y = [], []
    for i in range(len(h)):
        for k in range(n + (1 if i == len(h) - 1 else 0)):
            t = k / n
            h00, h10, h01, h11 = 2 * t ** 3 - 3 * t ** 2 + 1, t ** 3 - 2 * t ** 2 + t, -2 * t ** 3 + 3 * t ** 2, t ** 3 - t ** 2
            out_x.append(xs[i] + t * h[i])
            out_y.append(h00 * ys[i] + h10 * h[i] * m[i] + h01 * ys[i + 1] + h11 * h[i] * m[i + 1])
    return out_x, out_y


def _draw_yield(p: dict):
    eqn, prod = YIELD_REACTIONS[p["reaction"]]
    temps = p["temps"]
    fig, ax = new_figure(7.4, 5.0)
    ax.set_xlim(temps[0] - 50, temps[-1] + 130)
    ax.set_ylim(0, 100)
    ax.set_xticks(temps)
    ax.set_xticks(range(temps[0] - 50, temps[-1] + 51, 50), minor=True)
    ax.set_yticks(range(0, 101, 10))
    ax.set_yticks(range(0, 101, 5), minor=True)
    ax.grid(True, which="major", color=GRID, linewidth=0.8)
    ax.grid(True, which="minor", color=GRID, linewidth=0.45)
    ax.set_axisbelow(True)
    styles = ["-", (0, (6, 3)), (0, (1.5, 2))]
    for k, (P, row) in enumerate(zip(p["pressures"], p["yields"])):
        xs, ys = _smooth(temps, row)
        ax.plot(xs, ys, color=INK, linewidth=1.7, linestyle=styles[k], gid=f"curve:{P}")
        ax.plot(temps, row, "o", color=INK, markersize=4.5, gid=f"points:{P}")
        ax.text(temps[-1] + 18, row[-1], f"{P} atm", ha="left", va="center", fontsize=10, gid=f"label:{P}")
    ax.set_xlabel("Temperature (°C)")
    ax.set_ylabel(f"Percentage of {prod} in the equilibrium mixture")
    ax.tick_params(labelsize=8.5)
    ax.set_title(f"{printed(eqn)}     the forward reaction is exothermic", fontsize=10.5, loc="left")
    return fig


def _sack(ax, cx: float, label: str, grade, mass: int) -> None:
    w, h = 3.2, 4.4
    pts = [(cx - w / 2, 0.3), (cx + w / 2, 0.3), (cx + w / 2 - 0.15, h - 0.2), (cx + w / 2 + 0.05, h),
           (cx - w / 2 - 0.05, h), (cx - w / 2 + 0.15, h - 0.2)]
    ax.add_patch(Polygon(pts, closed=True, facecolor="#f1ece0", edgecolor=INK, linewidth=1.4))
    ax.plot([cx - w / 2 + 0.15, cx + w / 2 - 0.15], [h - 0.45, h - 0.45], color=INK, linewidth=0.8)
    ax.text(cx, h - 0.85, f"Bag {label}", ha="center", va="center", fontsize=13, fontweight="bold", gid=f"bag:{label}")
    ax.text(cx, h - 1.55, "NPK fertiliser", ha="center", va="center", fontsize=11)
    ax.text(cx, h - 2.35, "-".join(str(g) for g in grade), ha="center", va="center", fontsize=17, fontweight="bold",
            gid=f"grade:{label}")
    ax.text(cx, h - 3.2, f"Net mass: {mass} kg", ha="center", va="center", fontsize=11, gid=f"mass:{label}")


def _draw_bag(p: dict):
    fig, ax = new_figure(7.0, 5.0)
    fig.subplots_adjust(left=0.01, right=0.99, top=0.99, bottom=0.01)
    for (label, grade, mass), cx in zip(p["bags"], (2.4, 7.6)):
        _sack(ax, cx, label, grade, mass)
    ax.text(5.0, -0.35, "On each bag, the three numbers are the percentages by mass of", ha="center", va="center", fontsize=10.5)
    ax.text(5.0, -0.9, "nitrogen (N), phosphorus as P₂O₅ and potassium as K₂O, in that order.", ha="center", va="center",
            fontsize=10.5)
    ax.set_xlim(0, 10)
    ax.set_ylim(-1.3, 4.7)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def _draw_nitrogen(p: dict):
    rows = [[n, printed(FERTILISERS[n][0]), FERTILISERS[n][2]] for n in p["names"]]
    widths = [6.6, 3.6, 2.0]
    total = sum(widths)
    fig, ax = new_figure(total * 0.5 + 0.3, 4.3)
    fig.subplots_adjust(left=0.01, right=0.99, top=0.99, bottom=0.01)
    ax.text(0.05, 0.75, "Nitrogen fertilisers", ha="left", va="center", fontsize=11.5, fontweight="bold")
    _, bottom = _table(ax, ["Fertiliser", "Formula", "Mr"], rows, widths, 0.0)
    notes = ["Relative atomic mass: N = 14",
             "percentage of N by mass = (number of N atoms × 14) ÷ Mr × 100"]
    y = bottom - 0.55
    for n in notes:
        ax.text(0.05, y, n, ha="left", va="center", fontsize=10.5)
        y -= 0.5
    ax.set_xlim(-0.2, total + 0.2)
    ax.set_ylim(y, 1.2)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def draw(p: dict):
    return {"time": _draw_time, "table": _draw_table, "yield": _draw_yield, "bag": _draw_bag,
            "nitrogen": _draw_nitrogen}[p["kind"]](p)


# --- questions ----------------------------------------------------------------------------------------------------

SETTINGS = ["in the school laboratory", "for a class project in Huye", "at the science club in Musanze",
            "in a chemistry lesson in Kigali", "for a practical in Rubavu", "during revision for a test in Nyagatare",
            "for homework", "in a lesson on equilibrium"]
VERBS = ["followed", "studied", "measured", "recorded the progress of"]


def _conc_forms(v: Fraction) -> tuple[str, list[str]]:
    x = exact(v)
    forms = [x] + [f"{x}{u}" for u in (" mol/dm³", "mol/dm³", " mol/dm3", " mol dm⁻³", " mol dm-3", " M", " mol per dm³")]
    return x, forms


def _number_forms(v: Fraction) -> tuple[str, list[str]]:
    q = short("_", exact(v))
    return q.answer, q.accepted


def _one_dp(v: Fraction) -> str:
    return str((Decimal(v.numerator) / Decimal(v.denominator)).quantize(Decimal("0.1"), rounding=ROUND_HALF_UP))


def _two_dp(v: Fraction) -> str:
    return str((Decimal(v.numerator) / Decimal(v.denominator)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


def _questions_time(p: dict, rng: random.Random) -> list:
    who, friend = rng.sample(NAMES, 2)
    reaction, start, x = p["reaction"], p["start"], p["x"]
    eq = at_equilibrium(reaction, start, x)
    s = Fraction(str(p["step"]))
    word = "seconds" if p["unit"] == "s" else "minutes"
    eqn = printed(REACTIONS[reaction][0])
    qs = [short(f"{who} {rng.choice(VERBS)} the reaction {eqn} in a sealed flask at constant temperature {rng.choice(SETTINGS)}. "
                f"After how many {word} was equilibrium first reached?", p["T"], measure(p["T"], p["unit"]))]
    x_, forms = _conc_forms(eq[p["ask"]] * s)
    qs.append(short(f"What is the concentration of {printed(p['ask'])} at equilibrium, in mol/dm³?", x_, forms))
    if p["kc"]:
        v = kc_of(reaction, {k: n * s for k, n in eq.items()})
        key, forms = _number_forms(v)
        qs.append(short(f"{friend} uses the equilibrium concentrations read from the graph and the Kc expression printed above "
                        "it. What is the value of Kc? (Give the number only.)", key, forms))
    else:
        fall = p["fall"]
        x_, forms = _conc_forms(abs(start[fall] - eq[fall]) * s)
        qs.append(short(f"{friend} looks at the curve for {printed(fall)}. By how much did its concentration fall between the "
                        "start and equilibrium, in mol/dm³?", x_, forms))
    return qs


def _questions_table(p: dict, rng: random.Random) -> list:
    who, friend = rng.sample(NAMES, 2)
    reaction = p["reaction"]
    eq = at_equilibrium(reaction, p["start"], p["x"])
    eqn = printed(REACTIONS[reaction][0])
    key, forms = _number_forms(Fraction(eq[p["ask"]], 10))
    forms += [f"{f} mol" for f in list(forms)] + [f"{f}mol" for f in list(forms)]
    qs = [short(f"{who} mixed the substances in the table {rng.choice(SETTINGS)} and let the reaction {eqn} reach equilibrium. "
                f"What is the amount of {printed(p['ask'])} at equilibrium, in mol?", key, forms)]
    V = Fraction(p["V10"], 10) if p["V10"] else None
    if V is not None:
        x_, forms = _conc_forms(Fraction(eq[p["conc"]], 10) / V)
        qs.append(short(f"What is the concentration of {printed(p['conc'])} at equilibrium, in mol/dm³?", x_, forms))
        conc = {k: Fraction(n, 10) / V for k, n in eq.items()}
    else:
        conc = {k: Fraction(n, 10) for k, n in eq.items()}
    key, forms = _number_forms(kc_of(reaction, conc))
    qs.append(short(f"{friend} works out the equilibrium amounts first. What is the value of Kc for this mixture? "
                    "(Give the number only.)", key, forms))
    return qs


def _questions_yield(p: dict, rng: random.Random) -> list:
    who, friend = rng.sample(NAMES, 2)
    eqn, prod = YIELD_REACTIONS[p["reaction"]]
    temps, Ps, Y = p["temps"], p["pressures"], p["yields"]
    ti, pj = p["read"]
    v = Y[pj][ti]
    qs = [short(f"{who} studied the reaction {printed(eqn)} {rng.choice(SETTINGS)}. The graph shows the percentage of {prod} "
                f"in the mixture at equilibrium. What is the percentage of {prod} at {temps[ti]} °C and {Ps[pj]} atm?",
                v, [str(v), f"{v}%", f"{v} %", f"{v} percent"])]
    row, i = p["row"]
    T = temps[i]
    qs.append(short(f"At {Ps[row]} atm, at which of the marked temperatures is the percentage of {prod} equal to {Y[row][i]}%?",
                    T, [str(T), f"{T} °C", f"{T}°C", f"{T} degrees", f"{T} degrees Celsius", f"{T} C"]))
    t, lo, hi = p["rise"]
    d = Y[hi][t] - Y[lo][t]
    qs.append(short(f"{friend} compares two curves. By how many percentage points does the percentage of {prod} at {temps[t]} °C "
                    f"rise when the pressure is raised from {Ps[lo]} atm to {Ps[hi]} atm?", d, [str(d), f"{d}%", f"{d} %"]))
    if p["pick"]:
        i, j = p["pick"]
        i2 = i + rng.choice([-1, 1])
        j2 = j + rng.choice([-1, 1])
        opts = [(i, j), (i, j2), (i2, j), (i2, j2)]
        text = {o: f"{temps[o[0]]} °C and {Ps[o[1]]} atm" for o in opts}
        key = text[(i, j)]
        options = [text[o] for o in opts]
        rng.shuffle(options)
        qs.append(Question("mcq", f"Which marked conditions give {Y[j][i]}% of {prod} in the equilibrium mixture?",
                           str(options.index(key)), options))
    return qs


NUTRIENT = {"P2O5": ("P₂O₅", 1), "K2O": ("K₂O", 2)}


def _kg_forms(v: Fraction) -> tuple[str, list[str]]:
    key, forms = _number_forms(v)
    return key, forms + [f"{f} kg" for f in list(forms)] + [f"{f}kg" for f in list(forms)]


def _questions_bag(p: dict, rng: random.Random) -> list:
    who, friend = rng.sample(NAMES, 2)
    bags = {b[0]: b for b in p["bags"]}
    _, g, m = bags[p["which"]]
    key, forms = _kg_forms(Fraction(g[0] * m, 100))
    qs = [short(f"{who} buys two bags of fertiliser for a farm {p['place']}. What mass of nitrogen (N) is in bag {p['which']}, "
                "in kg?", key, forms)]
    shown, k = NUTRIENT[p["nutrient"]]
    _, g, m = bags[p["other"]]
    key, forms = _kg_forms(Fraction(g[k] * m, 100))
    qs.append(short(f"What mass of {shown} is in bag {p['other']}, in kg?", key, forms))
    n = {L: Fraction(b[1][0] * b[2], 100) for L, b in bags.items()}
    more = max(n, key=n.get)
    options = ["bag P", "bag Q", "both bags hold the same mass"]
    rng.shuffle(options)
    qs.append(Question("mcq", f"{friend} wants as much nitrogen as possible. Which bag contains the greater mass of nitrogen?",
                       str(options.index(f"bag {more}")), options))
    _, g, m = bags[p["total"]]
    key, forms = _kg_forms(Fraction(sum(g) * m, 100))
    qs.append(short(f"What is the total mass of N, P₂O₅ and K₂O together in bag {p['total']}, in kg?", key, forms))
    return qs


def _pct_forms(v: Fraction) -> tuple[str, list[str]]:
    one, two = _one_dp(v), _two_dp(v)
    forms = []
    for x in (one, two):
        for f in (x, f"{x}%", f"{x} %"):
            if f not in forms:
                forms.append(f)
    return one, forms


def _questions_nitrogen(p: dict, rng: random.Random) -> list:
    who, friend = rng.sample(NAMES, 2)
    ask = p["ask"]
    key, forms = _pct_forms(percent_n(ask))
    qs = [short(f"{who} compares nitrogen fertilisers for a farm {p['place']}. What is the percentage by mass of nitrogen in "
                f"{ask}? Give your answer to one decimal place.", key, forms)]
    best = max(p["names"], key=percent_n)
    options = list(p["names"])
    rng.shuffle(options)
    qs.append(Question("mcq", "Which fertiliser in the table has the highest percentage of nitrogen by mass?",
                       str(options.index(best)), options))
    name, mass = p["sack"]
    v = percent_n(name) * mass / 100
    one, two = _one_dp(v), _two_dp(v)
    forms = []
    for x in (one, two):
        for f in (x, f"{x} kg", f"{x}kg"):
            if f not in forms:
                forms.append(f)
    qs.append(short(f"{friend} has a {mass} kg sack of {name}. What mass of nitrogen does the sack contain? Give your answer "
                    "in kg to one decimal place.", one, forms))
    return qs


def questions(p: dict, rng: random.Random) -> list:
    return {"time": _questions_time, "table": _questions_table, "yield": _questions_yield, "bag": _questions_bag,
            "nitrogen": _questions_nitrogen}[p["kind"]](p, rng)
