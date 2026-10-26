"""Trends in physical properties (UP, AL): data-book values of the elements, drawn as textbooks draw them.

- value: one property across Period 3 (melting point, atomic radius, first ionisation energy, electronegativity) or
  down Group 1 (UP), Group 2 or Group 17, one bar per element with its value printed on the bar; asks the difference
  between two named elements, how many lie above a stated value, and one element's value;
- states: the melting and boiling points of the halogens side by side, values printed; asks a halogen's state at a
  stated temperature (solid below its melting point, gas above its boiling point, liquid between: printed), how many
  are gases at a temperature, and the gap between one halogen's boiling and melting points;
- hydrides (AL): the boiling points of the hydrides of two of Groups 14 to 17 against their period, each point
  labelled with its formula and value; asks one boiling point, the difference between two, how many are gases at a
  stated temperature;
- successive: the first ten successive ionisation energies of an unnamed element X (one of Na, Mg, Si, P, Cl, K, Ca)
  as bars of log10(energy); asks X's group, its outer-shell electrons and which ionisation is the first to take an
  electron from an inner shell — all read from the big jump the bars show. Aluminium and sulfur are left out: their
  first big step (3p to 3s) is nearly as tall as the jump to the inner shell, and a reader could take the wrong one.

Every value is a rounded data-book value (melting and boiling points and ionisation energies as the RSC periodic table
gives them; metallic radii for metals and covalent radii for non-metals as the Cambridge 9701 data booklet gives them;
Pauling electronegativities to one place). Nothing is asked that the chart does not show: the element with the highest
melting point is never asked, since a student may know it.
"""
from __future__ import annotations

import math
import random
from decimal import Decimal

from ..core import FILL, FILL_2, GRID, INK, NAMES, Question, count, exact, mcq, measure, new_figure, short, sub

ID = "property_trend"
KIND = "graph.bar"
SUBJECT = "chemistry"
BANDS = ("UP", "AL")
CONCEPTS = tuple(f"chemistry.{c}" for c in (
    "periodic-trends", "ionization-energy", "group-1-alkali-metals", "group-2-alkaline-earth-metals",
    "group-17-halogens", "hydrogen-bonding", "intermolecular-forces", "electronic-configuration"))
# Where the book lists sections, one must name the trend: periodicity, a group's physical properties, ionisation
# energies, radii, electronegativity, hydrogen bonding or intermolecular forces.
NEEDS = (r"periodic|periodicity|trends?\b|physical properties|ionis|ioniz|radi(i|us)\b|electronegativ|hydrogen bond|"
         r"intermolecular|states of matter|alkali metals|halogens|group (1|2|7|17)\b|electronic structure|"
         r"evidence for electronic|deducing the position|location of elements")
AVOID = (r"redox|alloy|reactivity|extraction|corrosion|ionic and metallic|lattice|npk|fertili|masses of atoms|"
         r"elements and atoms|radioactiv|organic|alkane|alcohol|carbonyl|carboxylic|amine|polymer|halogenoalkane|"
         r"chromatograph|group 1[345]|nature of matter|glossary")

# --- data-book values -----------------------------------------------------------------------------------------------

ELEMENT = {"Li": "lithium", "Na": "sodium", "K": "potassium", "Rb": "rubidium", "Cs": "caesium", "Be": "beryllium",
           "Mg": "magnesium", "Ca": "calcium", "Sr": "strontium", "Ba": "barium", "Al": "aluminium", "Si": "silicon",
           "P": "phosphorus", "S": "sulfur", "Cl": "chlorine", "Ar": "argon", "F": "fluorine", "Br": "bromine",
           "I": "iodine"}
# series: (elements in order, words for them)
SERIES = {"period3": (["Na", "Mg", "Al", "Si", "P", "S", "Cl", "Ar"], "the Period 3 elements"),
          "group1": (["Li", "Na", "K", "Rb", "Cs"], "the Group 1 elements"),
          "group2": (["Be", "Mg", "Ca", "Sr", "Ba"], "the Group 2 elements"),
          "group17": (["F", "Cl", "Br", "I"], "the Group 17 elements (the halogens)")}
# Values as printed: whole numbers, or decimal strings kept exact.
DATA = {
    "period3": {"mp": {"Na": 98, "Mg": 650, "Al": 660, "Si": 1414, "P": 44, "S": 115, "Cl": -101, "Ar": -189},
                "radius": {"Na": "0.186", "Mg": "0.160", "Al": "0.143", "Si": "0.117", "P": "0.110", "S": "0.104",
                           "Cl": "0.099"},
                "ie1": {"Na": 496, "Mg": 738, "Al": 578, "Si": 787, "P": 1012, "S": 1000, "Cl": 1251, "Ar": 1521},
                "en": {"Na": "0.9", "Mg": "1.3", "Al": "1.6", "Si": "1.9", "P": "2.2", "S": "2.6", "Cl": "3.2"}},
    "group1": {"mp": {"Li": 181, "Na": 98, "K": 63, "Rb": 39, "Cs": 28},
               "radius": {"Li": "0.152", "Na": "0.186", "K": "0.231", "Rb": "0.244", "Cs": "0.262"},
               "ie1": {"Li": 520, "Na": 496, "K": 419, "Rb": 403, "Cs": 376}},
    "group2": {"mp": {"Be": 1287, "Mg": 650, "Ca": 842, "Sr": 777, "Ba": 727},
               "radius": {"Be": "0.112", "Mg": "0.160", "Ca": "0.197", "Sr": "0.215", "Ba": "0.224"},
               "ie1": {"Be": 900, "Mg": 738, "Ca": 590, "Sr": 550, "Ba": 503}},
    "group17": {"mp": {"F": -220, "Cl": -101, "Br": -7, "I": 114}, "bp": {"F": -188, "Cl": -34, "Br": 59, "I": 184},
                "radius": {"F": "0.072", "Cl": "0.099", "Br": "0.114", "I": "0.133"},
                "en": {"F": "4.0", "Cl": "3.2", "Br": "3.0", "I": "2.7"}},
}
# property: (words, axis label, unit printed after a value, threshold step)
PROPS = {"mp": ("melting point", "Melting point (°C)", "°C", "100"), "bp": ("boiling point", "Boiling point (°C)", "°C", "50"),
         "radius": ("atomic radius", "Atomic radius (nm)", "nm", "0.01"),
         "ie1": ("first ionisation energy", "First ionisation energy (kJ mol⁻¹)", "kJ mol⁻¹", "100"),
         "en": ("electronegativity", "Electronegativity (Pauling scale)", "", "0.5")}
# Boiling points (°C) of the hydrides, by group, periods 2 to 5.
HYDRIDES = {14: [("CH4", -162), ("SiH4", -112), ("GeH4", -88), ("SnH4", -52)],
            15: [("NH3", -33), ("PH3", -88), ("AsH3", -62), ("SbH3", -17)],
            16: [("H2O", 100), ("H2S", -60), ("H2Se", -41), ("H2Te", -2)],
            17: [("HF", 20), ("HCl", -85), ("HBr", -67), ("HI", -35)]}
# The first ten successive ionisation energies (kJ mol⁻¹), and the group each element is in.
SUCCESSIVE = {"Na": (1, [496, 4562, 6910, 9543, 13354, 16613, 20117, 25496, 28932, 141362]),
              "Mg": (2, [738, 1451, 7733, 10543, 13630, 18020, 21711, 25661, 31653, 35458]),
              "Si": (14, [787, 1577, 3232, 4356, 16091, 19805, 23780, 29287, 33878, 38726]),
              "P": (15, [1012, 1907, 2914, 4964, 6274, 21267, 25431, 29872, 35905, 40950]),
              "Cl": (17, [1251, 2298, 3822, 5159, 6542, 9362, 11018, 33604, 38600, 43961]),
              "K": (1, [419, 3052, 4420, 5877, 7975, 9590, 11343, 14944, 16964, 48610]),
              "Ca": (2, [590, 1145, 4912, 6491, 8153, 10496, 12270, 14206, 18191, 20385])}
GROUPS = [1, 2, 13, 14, 15, 16, 17]

VALUE_PROPS = {"UP": {"period3": ["mp", "radius", "ie1", "en"], "group1": ["mp", "radius", "ie1"],
                      "group2": ["mp", "radius", "ie1"], "group17": ["radius", "en"]},
               "AL": {"period3": ["mp", "radius", "ie1", "en"], "group2": ["mp", "radius", "ie1"],
                      "group17": ["radius", "en"]}}


def concepts_for(p: dict) -> tuple[str, ...]:
    """Each chart carries what it shows: a period's trend, a group's own id, hydrogen bonding, ionisation energies."""
    c = "chemistry."
    kind = p["kind"]
    if kind == "successive":
        return (c + "ionization-energy",)
    if kind == "hydrides":
        return (c + "hydrogen-bonding", c + "intermolecular-forces")
    series = p["series"]
    out = {"period3": [c + "periodic-trends"], "group1": [c + "group-1-alkali-metals"],
           "group2": [c + "group-2-alkaline-earth-metals"], "group17": [c + "group-17-halogens"]}[series]
    if kind == "states" and p["band"] == "AL":  # AS Level explains these by intermolecular forces; IGCSE by state
        out.append(c + "intermolecular-forces")
    if p.get("prop") == "ie1":
        out.append(c + "ionization-energy")
    return tuple(out)


def avoid_for(p: dict) -> str:
    """A period's chart is no figure for a chapter on one group, nor a group's chart for another group's chapter."""
    kind, series = p["kind"], p.get("series")
    extra = []
    if kind in ("value", "states"):
        others = {"period3": r"group", "group1": r"group (2|1[3-7]|7)\b|halogen", "group2": r"group (1|1[3-7]|7)\b|halogen",
                  "group17": r"group (1|2|1[3-6])\b|alkali"}[series]
        extra.append(others)
        if kind == "value" and p["prop"] != "mp":  # IGCSE teaches no radii, ionisation energies or electronegativity
            extra.append(r"^the periodic table$|^chapter 6: the periodic table$")
        if p.get("prop") != "en":  # a chapter on covalent bonds teaches electronegativity, not melting points or radii
            extra.append(r"covalent bond")
    if kind == "hydrides":
        extra.append(r"group|chromatograph|periodic")
    if kind == "successive":
        extra.append(r"group|bond")
    return AVOID + "|" + "|".join(extra) if extra else AVOID


# --- numbers --------------------------------------------------------------------------------------------------------

def dec(v) -> Decimal:
    return Decimal(str(v))


def shown(v) -> str:
    """A value as the chart prints it: a true minus sign, decimals kept to their places."""
    s = str(v)
    return s.replace("-", "−") if s.startswith("-") else s


def _thresholds(values, step: str) -> list[str]:
    """Round values to ask "how many above" with: not equal to any value, at least 2% of the range from each, and
    with at least one value on each side."""
    vs = [dec(v) for v in values]
    lo, hi = min(vs), max(vs)
    gap = (hi - lo) * Decimal("0.02")
    out: list[Decimal] = []
    for st in (Decimal(step), Decimal(step) / 5):  # a finer step where the coarse one leaves under two choices
        t = (lo / st).to_integral_value(rounding="ROUND_FLOOR") * st
        while t <= hi:
            if lo < t < hi and all(abs(v - t) >= gap and v != t for v in vs) and t not in out:
                out.append(t)
            t += st
        if len(out) >= 2:
            break
    return [str(t.normalize()) if "." in step else str(int(t)) for t in sorted(out)]


# --- sampling -------------------------------------------------------------------------------------------------------

def sample(rng: random.Random) -> dict:
    band = rng.choice(BANDS)
    kinds = ["value", "value", "value", "states", "successive"] + (["hydrides", "hydrides"] if band == "AL" else [])
    kind = rng.choice(kinds)
    if kind == "value":
        series = rng.choice(sorted(VALUE_PROPS[band]))
        prop = rng.choice(VALUE_PROPS[band][series])
        data = DATA[series][prop]
        els = list(data)
        a, b = rng.sample(els, 2)
        if dec(data[a]) < dec(data[b]):
            a, b = b, a
        while dec(data[a]) == dec(data[b]):
            a, b = rng.sample(els, 2)
        return {"band": band, "kind": kind, "series": series, "prop": prop, "pair": [a, b],
                "t": rng.choice(_thresholds(data.values(), PROPS[prop][3])),
                "ask": rng.choice([e for e in els if e not in (a, b)])}
    if kind == "states":
        mp, bp = DATA["group17"]["mp"], DATA["group17"]["bp"]
        el = rng.choice(list(mp))
        state = rng.choice(["solid", "liquid", "gas"])
        lo, hi = {"solid": (-260, mp[el] - 10), "liquid": (mp[el] + 10, bp[el] - 10), "gas": (bp[el] + 10, 250)}[state]
        temps = [t for t in range(-250, 251, 10) if lo <= t <= hi and t != 0]
        if not temps:
            state = "gas"
            temps = [t for t in range(-250, 251, 10) if t >= bp[el] + 10]
        t2s = [t for t in range(-200, 201, 10) if 1 <= sum(v < t for v in bp.values()) <= 3
               and all(abs(v - t) >= 10 for v in bp.values())]
        return {"band": band, "kind": kind, "series": "group17", "prop": "states", "el": el, "t": rng.choice(temps),
                "t2": rng.choice(t2s), "gap": rng.choice([e for e in mp if e != el])}
    if kind == "hydrides":
        g1, g2 = rng.choice([(14, 15), (14, 16), (14, 17), (15, 16), (16, 17)])
        pts = HYDRIDES[g1] + HYDRIDES[g2]
        a, b = rng.sample(pts, 2)
        if a[1] < b[1]:
            a, b = b, a
        while a[1] == b[1]:
            a, b = rng.sample(pts, 2)
        ts = [t for t in range(-150, 101, 10) if 1 <= sum(v < t for _, v in pts) <= len(pts) - 1
              and all(abs(v - t) >= 5 for _, v in pts)]
        return {"band": "AL", "kind": kind, "groups": [g1, g2], "pair": [a[0], b[0]],
                "ask": rng.choice([f for f, _ in pts if f not in (a[0], b[0])]), "t": rng.choice(ts)}
    return {"band": band, "kind": "successive", "el": rng.choice(sorted(SUCCESSIVE)), "shade": rng.choice([0, 1])}


# --- drawing --------------------------------------------------------------------------------------------------------

def _bars(ax, xs, values, width, face, hatch=None, label=None):
    span = float(max(max(values), 0) - min(min(values), 0))
    pad = span * 0.025
    ax.bar(xs, [float(v) for v in values], width=width, color=face, edgecolor=INK, linewidth=0.9, hatch=hatch,
           label=label, zorder=2)
    for x, v in zip(xs, values):
        f = float(v)
        ax.text(x, f + pad if f >= 0 else f - pad, shown(v), ha="center", va="bottom" if f >= 0 else "top",
                fontsize=9.5, zorder=4, gid=f"value:{x}")


def _value_limits(ax, values):
    lo, hi = min(min(values), 0), max(max(values), 0)
    span = hi - lo
    ax.set_ylim(lo - (span * 0.12 if lo < 0 else 0), hi + span * 0.12)
    ax.yaxis.grid(True, color=GRID, linewidth=0.6)
    ax.set_axisbelow(True)
    if lo < 0:
        ax.axhline(0, color=INK, linewidth=0.9)


def _draw_value(p):
    elements, words = SERIES[p["series"]]
    data = DATA[p["series"]][p["prop"]]
    els = [e for e in elements if e in data]
    values = [dec(data[e]) for e in els]
    fig, ax = new_figure(6.4, 4.3)
    xs = list(range(len(els)))
    _bars(ax, xs, values, 0.6, FILL_2)
    _value_limits(ax, [float(v) for v in values])
    ax.set_xticks(xs)
    ax.set_xticklabels(els, fontsize=12)
    ax.set_xlim(-0.7, len(els) - 0.3)
    name, axis, *_ = PROPS[p["prop"]]
    ax.set_ylabel(axis)
    ax.set_xlabel("Element")
    ax.set_title(f"The {name} of {words}", fontsize=11)
    ax.tick_params(axis="y", labelsize=9)
    return fig


def _draw_states(p):
    mp, bp = DATA["group17"]["mp"], DATA["group17"]["bp"]
    els = list(mp)
    fig, ax = new_figure(6.4, 4.6)
    xs = list(range(len(els)))
    _bars(ax, [x - 0.19 for x in xs], [mp[e] for e in els], 0.36, "#ffffff", hatch="///", label="melting point")
    _bars(ax, [x + 0.19 for x in xs], [bp[e] for e in els], 0.36, FILL, label="boiling point")
    _value_limits(ax, list(mp.values()) + list(bp.values()))
    ax.set_ylim(-290, 250)
    ax.set_xticks(xs)
    ax.set_xticklabels([f"{ELEMENT[e]} ({e})" for e in els], fontsize=10)
    ax.set_xlim(-0.6, len(els) - 0.4)
    ax.set_ylabel("Temperature (°C)")
    ax.set_title("Melting and boiling points of the halogens", fontsize=11)
    ax.legend(loc="upper left", fontsize=9, frameon=True)
    ax.tick_params(axis="y", labelsize=9)
    return fig


STYLE = {0: ("-", "o"), 1: ((0, (5, 2)), "s")}


def _draw_hydrides(p):
    fig, ax = new_figure(6.8, 4.8)
    groups = p["groups"]
    xs = [2, 3, 4, 5]
    ax.set_xlim(1.45, 5.75)
    ax.set_ylim(-200, 140)
    ax.set_yticks(range(-200, 141, 20))
    ax.yaxis.grid(True, color=GRID, linewidth=0.6)
    ax.set_axisbelow(True)
    ax.axhline(0, color=INK, linewidth=0.8)
    ax.set_xticks(xs)
    ax.set_xticklabels([f"Period {x}" for x in xs])
    ax.set_ylabel("Boiling point (°C)")
    ax.tick_params(axis="y", labelsize=8.5)
    ax.set_title(f"Boiling points of the hydrides of Group {groups[0]} and Group {groups[1]}", fontsize=11)
    upper = max(groups, key=lambda g: HYDRIDES[g][0][1] + HYDRIDES[g][1][1])
    for k, g in enumerate(groups):
        style, marker = STYLE[k]
        vals = [v for _, v in HYDRIDES[g]]
        ax.plot(xs, vals, color=INK, linestyle=style, marker=marker, markersize=6, linewidth=1.6, zorder=3,
                label=f"Group {g} hydrides", gid=f"line:{g}")
    placed = []
    fig.canvas.draw()
    renderer = fig.canvas.get_renderer()
    lines = [ln for ln in ax.lines if (ln.get_gid() or "").startswith("line:")]
    marks = {(x, v): ax.transData.transform((x, v)) for g in groups for x, (_, v) in zip(xs, HYDRIDES[g])}
    for g in groups:
        s = 1 if g == upper else -1  # the upper line's labels go above it, the lower line's below
        for x, (f, v) in zip(xs, HYDRIDES[g]):
            text = f"{sub(f)} {shown(v)}"
            near = [(0, 9 * s), (30, 7 * s), (-30, 7 * s), (36, 0), (-36, 0)]
            far = [(0, 15 * s), (38, 12 * s), (-38, 12 * s), (46, 0), (-46, 0), (0, 22 * s), (44, 18 * s), (-44, 18 * s)]
            other = [(dx, -dy) for dx, dy in near + far if dy]
            for dx, dy in near + far + other:
                t = ax.annotate(text, (x, v), xytext=(dx, dy), textcoords="offset points", ha="center",
                                va="bottom" if dy > 0 else "top" if dy < 0 else "center", fontsize=9.5, zorder=5,
                                gid=f"point:{f}")
                box = t.get_window_extent(renderer)
                frame = ax.get_window_extent(renderer)
                ok = frame.x0 + 2 < box.x0 and box.x1 < frame.x1 - 2 and frame.y0 + 2 < box.y0 and box.y1 < frame.y1 - 2
                ok = ok and not any(_overlaps(box, b) for b in placed)
                ok = ok and not any(_line_hits(ln, box) for ln in lines)
                # A label nearer another point than its own would name the wrong point.
                ok = ok and not any(box.x0 - 10 < px < box.x1 + 10 and box.y0 - 10 < py < box.y1 + 10
                                    for k, (px, py) in marks.items() if k != (x, v))
                if ok:
                    placed.append(box)
                    break
                t.remove()
    ax.legend(loc="upper right", fontsize=9, frameon=True, handlelength=3)
    return fig


def _overlaps(a, b, margin=1.5) -> bool:
    return min(a.x1, b.x1) - max(a.x0, b.x0) > -margin and min(a.y1, b.y1) - max(a.y0, b.y0) > -margin


def _line_hits(line, box, steps=60) -> bool:
    pts = line.get_transform().transform(line.get_xydata())
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        for k in range(steps + 1):
            x, y = x0 + (x1 - x0) * k / steps, y0 + (y1 - y0) * k / steps
            if box.x0 - 2 < x < box.x1 + 2 and box.y0 - 2 < y < box.y1 + 2:
                return True
    return False


def _draw_successive(p):
    _, ies = SUCCESSIVE[p["el"]]
    fig, ax = new_figure(6.4, 4.3)
    xs = list(range(1, 11))
    # Bars stand on the axis at 2.0, where the scale starts, so nothing is drawn below the frame.
    ax.bar(xs, [math.log10(v) - 2.0 for v in ies], bottom=2.0, width=0.6, color=FILL_2 if p["shade"] else FILL,
           edgecolor=INK, linewidth=0.9, zorder=2)
    ax.set_ylim(2.0, 5.5)
    ax.set_yticks([2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0, 5.5])
    ax.yaxis.grid(True, color=GRID, linewidth=0.6)
    ax.set_axisbelow(True)
    ax.set_xticks(xs)
    ax.set_xlim(0.3, 10.7)
    ax.set_xlabel("Number of the electron removed")
    ax.set_ylabel("log₁₀ (ionisation energy / kJ mol⁻¹)")
    ax.set_title("The first ten ionisation energies of element X", fontsize=11)
    ax.tick_params(labelsize=9)
    return fig


def draw(p: dict):
    return {"value": _draw_value, "states": _draw_states, "hydrides": _draw_hydrides,
            "successive": _draw_successive}[p["kind"]](p)


# --- questions ------------------------------------------------------------------------------------------------------

SETTINGS = ["in a chemistry lesson", "for homework", "on a revision card", "for a class test", "at the science club",
            "from a data book", "for a practical write-up", "while revising for an examination"]
VERBS = ["drew", "made", "copied", "sketched", "plotted"]


def _forms(v, prop: str) -> list[str]:
    unit = PROPS[prop][2] if prop in PROPS else "°C"
    if not unit:
        return short("_", exact(v)).accepted
    if unit == "kJ mol⁻¹":
        forms = measure(v, "kJ/mol")
        for n in short("_", exact(v)).accepted:
            for u in ("kJ mol⁻¹", "kJ mol-1", "kJmol-1", "kJ per mol", "kJ/mole"):
                if f"{n} {u}" not in forms:
                    forms.append(f"{n} {u}")
        return forms
    return measure(v, unit)


def _el(e: str) -> str:
    return f"{ELEMENT[e]} ({e})"


def _value_questions(p, rng, who):
    prop = p["prop"]
    name, _, unit, _ = PROPS[prop]
    data = DATA[p["series"]][prop]
    words = SERIES[p["series"]][1]
    a, b = p["pair"]
    diff = dec(data[a]) - dec(data[b])
    t = p["t"]
    above = sum(dec(v) > dec(t) for v in data.values())
    c = p["ask"]
    tail = f" {unit}" if unit else ""
    more = {"mp": "higher", "radius": "larger", "ie1": "greater", "en": "greater"}[prop]
    return [short(f"{who} {rng.choice(VERBS)} this chart of the {name} of {words} {rng.choice(SETTINGS)}. By how much is "
                  f"the {name} of {_el(a)} {more} than that of {_el(b)}?", exact(diff), _forms(diff, prop)),
            count(f"How many of the elements in the chart have {'an' if name[0] in 'aeiou' else 'a'} {name} above "
                  f"{shown(t)}{tail}?", above, "elements"),
            short(f"What is the {name} of {_el(c)}, according to the chart?", exact(dec(data[c])),
                  _forms(dec(data[c]), prop))]


def state_at(mp: int, bp: int, t: int) -> str:
    return "solid" if t < mp else "gas" if t > bp else "liquid"


def _states_questions(p, rng, who):
    mp, bp = DATA["group17"]["mp"], DATA["group17"]["bp"]
    el, t, t2 = p["el"], p["t"], p["t2"]
    key = state_at(mp[el], bp[el], t)
    gases = sum(v < t2 for v in bp.values())
    g = p["gap"]
    rule = "(A substance is a solid below its melting point, a liquid between its melting and boiling points, and a gas above its boiling point.)"
    return [mcq(f"{who} {rng.choice(VERBS)} this chart {rng.choice(SETTINGS)}. {rule} What is the state of {ELEMENT[el]} "
                f"at {shown(t)} °C?", key, ["solid", "liquid", "gas"], rng),
            count(f"How many of the halogens in the chart are gases at {shown(t2)} °C?", gases, "halogens"),
            short(f"By how many degrees Celsius is the boiling point of {ELEMENT[g]} higher than its melting point?",
                  exact(bp[g] - mp[g]), measure(bp[g] - mp[g], "°C"))]


def _hydride_questions(p, rng, who):
    pts = dict(HYDRIDES[p["groups"][0]] + HYDRIDES[p["groups"][1]])
    a, b = p["pair"]
    c, t = p["ask"], p["t"]
    gases = sum(v < t for v in pts.values())
    return [short(f"{who} {rng.choice(VERBS)} this graph {rng.choice(SETTINGS)}. How many degrees Celsius higher is the "
                  f"boiling point of {sub(a)} than that of {sub(b)}?", exact(pts[a] - pts[b]), measure(pts[a] - pts[b], "°C")),
            short(f"What is the boiling point of {sub(c)}, according to the graph?", exact(pts[c]), measure(pts[c], "°C")),
            count(f"How many of the hydrides on the graph are gases at {shown(t)} °C?", gases, "hydrides")]


def _group_word(g: int) -> str:
    return f"Group {g}"


def _successive_questions(p, rng, who):
    group, ies = SUCCESSIVE[p["el"]]
    ratios = [ies[k + 1] / ies[k] for k in range(9)]
    outer = ratios.index(max(ratios)) + 1
    i = GROUPS.index(group)
    near = [GROUPS[j] for j in (i - 1, i + 1, i + 2, i - 2) if 0 <= j < len(GROUPS)]
    return [mcq(f"{who} {rng.choice(VERBS)} this chart of the successive ionisation energies of an element X "
                f"{rng.choice(SETTINGS)}. In which group of the Periodic Table is X?", _group_word(group),
                [_group_word(g) for g in near], rng),
            short("How many electrons are in the outer shell of an atom of X?", str(outer),
                  [str(outer), f"{outer} electrons", f"{outer} electron"]),
            short("Which ionisation of X is the first to remove an electron from a shell nearer the nucleus? "
                  "Give its number on the chart.", str(outer + 1), [str(outer + 1), _ordinal(outer + 1)])]


def _ordinal(n: int) -> str:
    return f"{n}{'st' if n == 1 else 'nd' if n == 2 else 'rd' if n == 3 else 'th'}"


def questions(p: dict, rng: random.Random) -> list[Question]:
    who = rng.choice(NAMES)
    return {"value": _value_questions, "states": _states_questions, "hydrides": _hydride_questions,
            "successive": _successive_questions}[p["kind"]](p, rng, who)
