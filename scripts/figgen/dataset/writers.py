"""Questions for the dataset's diagrams, computed from each row's params (P3q). A writer that cannot compute a key asks
nothing. Every first stem names a person, as the drawn families' do, so a quiz never drops a figure for a repeated
wording.

Conventions checked against the images (2026-10-15):
- trig triangles: side a is opposite angle A, and the R modes have their right angle at C;
- transformations: angles anticlockwise-positive; `at` is the shape's lower-left corner;
  reflections `{"line": "x", "v": 0}` = the line x = 0;
- vectors on a square grid, y up;
- cell and leaf letters follow the `labelled` order. The AS template cells are shuffled by `order`, so they are skipped.
"""
from __future__ import annotations

import functools
import math
import random
import re

from ..core import NAMES, mcq, short

SETTINGS = ["in a lesson", "for homework", "on a revision card", "for a class test", "in a past paper", "before an exam"]
MINUS = "−"


def _lead(rng: random.Random, what: str) -> str:
    return f"{rng.choice(NAMES)} studies this {what} {rng.choice(SETTINGS)}."


def _n(v) -> str:
    """A number as written: whole numbers without .0, a minus sign as typed."""
    if isinstance(v, float) and v.is_integer():
        v = int(v)
    return str(v)


def _pair(x, y) -> list[str]:
    x, y = _n(x), _n(y)
    forms = [f"({x}, {y})", f"({x},{y})", f"{x}, {y}", f"({x} {y})"]
    return forms + [f.replace("-", MINUS) for f in forms if "-" in f]


# --- maths -----------------------------------------------------------------------------------------

def _triangle(mode: str, g: dict, unknown: str) -> float:
    r, d = math.radians, math.degrees
    if mode.startswith("R_"):  # right angle at C: a = c sin A, b = c cos A
        a, b, c, A, B = (g.get(k) for k in "abcAB")
        if A is None and B is not None:
            A = 90 - B
        if A is None:
            if a is not None and b is not None:
                A = d(math.atan2(a, b))
            elif a is not None:
                A = d(math.asin(a / c))
            else:
                A = d(math.acos(b / c))
        if c is None:
            c = a / math.sin(r(A)) if a is not None else b / math.cos(r(A))
        return {"a": c * math.sin(r(A)), "b": c * math.cos(r(A)), "c": c, "A": A, "B": 90 - A}[unknown]
    A, B, a, b, c = g.get("A"), g.get("B"), g.get("a"), g.get("b"), g.get("c")
    if mode == "SR_AAS":
        k = a / math.sin(r(A))
        return {"b": k * math.sin(r(B)), "c": k * math.sin(r(180 - A - B)), "C": 180 - A - B}[unknown]
    if mode == "SR_SSA":
        Bv = d(math.asin(b * math.sin(r(A)) / a))
        return {"B": Bv, "C": 180 - A - Bv}[unknown]
    if mode == "CR_SAS":
        return math.sqrt(b * b + c * c - 2 * b * c * math.cos(r(A)))
    if mode == "CR_SSS":
        return d(math.acos((b * b + c * c - a * a) / (2 * b * c)))
    raise ValueError(mode)


def trig_triangle(row: dict, rng: random.Random) -> list:
    p = row["params"]
    v = _triangle(p["mode"], p["given"], p["unknown"])
    if p["unknown"] in "ABC":
        ans = f"{v:.1f}"
        return [short(f"{_lead(rng, 'triangle')} Find the value of x. Give your answer correct to 1 decimal place.", ans,
                      [ans, f"{ans}°", f"x = {ans}", f"x = {ans}°"], tolerance=0.1)]
    ans = f"{v:.3g}"
    four = f"{v:.4g}"
    step = 10 ** (math.floor(math.log10(abs(v))) - 2)
    return [short(f"{_lead(rng, 'triangle')} Find the value of x. Give your answer correct to 3 significant figures.", ans,
                  [ans, four, f"{ans} cm", f"x = {ans}", f"{four} cm"], tolerance=step)]


def _line_name(t: dict) -> str:
    line = t["line"]
    if line == "y=x":
        return "y = x"
    if line == "y=-x":
        return f"y = {MINUS}x"
    v = _n(t["v"]).replace("-", MINUS)
    return f"{line} = {v}"


def _describe(kind: str, t: dict) -> str:
    if kind == "rotation":
        a = t["angle"]
        turn = f"{abs(a)}°" if abs(a) == 180 else f"{abs(a)}° {'anticlockwise' if a > 0 else 'clockwise'}"
        return f"Rotation, {turn}, centre ({t['cx']}, {t['cy']})"
    if kind == "reflection":
        return f"Reflection in the line {_line_name(t)}"
    if kind == "translation":
        return f"Translation by the vector ({_n(t['dx'])}, {_n(t['dy'])})"
    return f"Enlargement, scale factor {_n(t['k'])}, centre ({t['cx']}, {t['cy']})"


def _wrong(kind: str, t: dict) -> list[str]:
    if kind == "rotation":
        out = [_describe(kind, {**t, "cx": t["cx"] + 1}), _describe(kind, {**t, "cy": t["cy"] - 1})]
        out.append(_describe(kind, {**t, "angle": -t["angle"]}) if abs(t["angle"]) != 180 else _describe(kind, {**t, "cx": t["cx"] - 1, "cy": t["cy"] + 1}))
        return out
    if kind == "reflection":
        others = [{"line": "y=x"}, {"line": "y=-x"}, {"line": "x", "v": 0}, {"line": "y", "v": 0}, {"line": "x", "v": 1}, {"line": "y", "v": -1}]
        return [_describe(kind, o) for o in others if _describe(kind, o) != _describe(kind, t)][:3]
    if kind == "translation":
        dx, dy = t["dx"], t["dy"]
        cands = [{"dx": dy, "dy": dx}, {"dx": -dx, "dy": -dy}, {"dx": dx, "dy": -dy}, {"dx": -dx, "dy": dy}]
        return list(dict.fromkeys(_describe(kind, c) for c in cands if _describe(kind, c) != _describe(kind, t)))[:3]
    k = t["k"]
    ks = [v for v in (-k, 1 / k if k not in (0,) else 2, k + 1) if v != k]
    out = [_describe(kind, {**t, "k": round(v, 3) if isinstance(v, float) else v}) for v in ks[:2]]
    out.append(_describe(kind, {**t, "cx": t["cx"] + 1}))
    return out


def _image(kind: str, t: dict, x: int, y: int) -> tuple:
    if kind == "translation":
        return x + t["dx"], y + t["dy"]
    if kind == "enlargement":
        return t["cx"] + t["k"] * (x - t["cx"]), t["cy"] + t["k"] * (y - t["cy"])
    if kind == "rotation":
        q = round(t["angle"] / 90) % 4  # quarter turns anticlockwise
        dx, dy = x - t["cx"], y - t["cy"]
        for _ in range(q):
            dx, dy = -dy, dx
        return t["cx"] + dx, t["cy"] + dy
    if t["line"] == "y=x":
        return y, x
    if t["line"] == "y=-x":
        return -y, -x
    return (2 * t["v"] - x, y) if t["line"] == "x" else (x, 2 * t["v"] - y)


CORNER_SHAPES = {"triangle", "triangle2", "flag", "L"}  # shapes whose `at` (the lower-left corner) is a vertex


def _verb(kind: str, t: dict) -> str:
    if kind == "rotation":
        a = t["angle"]
        return f"rotated {abs(a)}°{'' if abs(a) == 180 else (' anticlockwise' if a > 0 else ' clockwise')} about ({t['cx']}, {t['cy']})"
    if kind == "reflection":
        return f"reflected in the line {_line_name(t)}"
    if kind == "translation":
        return f"translated by the vector ({_n(t['dx'])}, {_n(t['dy'])})"
    return f"enlarged by scale factor {_n(t['k'])} with centre ({t['cx']}, {t['cy']})"


def transformation(row: dict, rng: random.Random) -> list:
    p = row["params"]
    kind, t = p["kind"], p["t"]
    if p["show"] in ("both", "working"):
        return [mcq(f"{_lead(rng, 'grid')} Describe fully the single transformation that maps shape A onto shape B.",
                    _describe(kind, t), _wrong(kind, t), rng)]
    if p["shape"] in CORNER_SHAPES:
        x, y = p["at"]
        ix, iy = _image(kind, t, x, y)
        return [short(f"{_lead(rng, 'grid')} Shape A is {_verb(kind, t)}. What are the coordinates of the image of the corner at "
                      f"({x}, {y})?", f"({_n(ix)}, {_n(iy)})", _pair(ix, iy))]
    return []


def _combo(ka: int, kb: int) -> str:
    a = {1: "a", -1: "-a"}.get(ka, f"{ka}a")
    b = {1: "b", -1: "b"}.get(abs(kb), f"{abs(kb)}b")
    return f"{a} {'+' if kb > 0 else MINUS} {b}"


def vector(row: dict, rng: random.Random) -> list:
    p = row["params"]
    if p["kind"] != "grid":
        return []
    a, b = p["a"], p["b"]
    if p["show"] in ("combo", "sum"):
        ka, kb = p["coefs"]["a"], p["coefs"]["b"]
    else:
        ka, kb = rng.choice([(1, 1), (2, -1), (1, -2), (3, 1)])
    v = (ka * a[0] + kb * b[0], ka * a[1] + kb * b[1])
    qs = [short(f"{_lead(rng, 'vector diagram')} Write {_combo(ka, kb)} as a column vector.", f"({_n(v[0])}, {_n(v[1])})", _pair(*v))]
    which = rng.choice("ab")
    w = a if which == "a" else b
    qs.append(short(f"Write {which} as a column vector.", f"({_n(w[0])}, {_n(w[1])})", _pair(*w)))
    return qs


def function_graph(row: dict, rng: random.Random) -> list:
    p = row["params"]
    if p["kind"] == "linear" and not p.get("show_eq"):
        m = p["m"]
        forms = [_n(m), _n(m).replace("-", MINUS)]
        if abs(m) == 0.5:
            forms += ["-1/2" if m < 0 else "1/2"]
        return [short(f"{_lead(rng, 'sketch')} What is the gradient of the line?", _n(m), forms)]
    if p["kind"] == "quadratic":
        s = (p["r1"] + p["r2"]) / 2
        return [short(f"{_lead(rng, 'sketch')} What is the equation of the line of symmetry of the curve?", f"x = {_n(s)}",
                      [f"x = {_n(s)}", f"x={_n(s)}", _n(s)])]
    if p["kind"] == "cubic":
        n = len(set(p["roots"]))
        return [short(f"{_lead(rng, 'sketch')} How many times does the curve meet the x-axis?", n, [str(n), f"{n} times"])]
    return []


def _ineq(lo, lo_op, hi, hi_op) -> str:
    sign = {"<": "<", "<=": "≤"}
    s = ""
    if lo is not None:
        s += f"{_n(lo).replace('-', MINUS)} {sign[lo_op]} "
    s += "x"
    if hi is not None:
        s += f" {sign[hi_op]} {_n(hi).replace('-', MINUS)}"
    return s


def number_line(row: dict, rng: random.Random) -> list:
    p = row["params"]
    lo, hi, lo_op, hi_op = p["lo"], p["hi"], p["lo_op"], p["hi_op"]
    flip = {"<": "<=", "<=": "<"}
    key = _ineq(lo, lo_op, hi, hi_op)
    if lo is not None and hi is not None:
        wrong = [_ineq(lo, flip[lo_op], hi, hi_op), _ineq(lo, lo_op, hi, flip[hi_op]), _ineq(lo, flip[lo_op], hi, flip[hi_op])]
    elif hi is not None:
        wrong = [_ineq(None, lo_op, hi, flip[hi_op]), f"x > {_n(hi).replace('-', MINUS)}", f"x ≥ {_n(hi).replace('-', MINUS)}"]
        wrong = [w for w in wrong if w != key]
    else:
        wrong = [_ineq(lo, flip[lo_op], None, hi_op), f"x < {_n(lo).replace('-', MINUS)}", f"x ≤ {_n(lo).replace('-', MINUS)}"]
        wrong = [w for w in wrong if w != key]
    qs = [mcq(f"{_lead(rng, 'number line')} Which inequality does the number line show?", key, wrong, rng)]
    if lo is not None and hi is not None:
        ints = [n for n in range(math.floor(lo) - 1, math.ceil(hi) + 2)
                if (n > lo if lo_op == "<" else n >= lo) and (n < hi if hi_op == "<" else n <= hi)]
        if ints:
            text = ", ".join(str(n) for n in ints)
            qs.append(short("List the integers that satisfy the inequality shown.", text,
                            [text, text.replace(", ", ","), text.replace(", ", " "), text.replace("-", MINUS)]))
    return qs


# --- biology labels --------------------------------------------------------------------------------

CELL = {"membrane": ("cell membrane", ["membrane", "plasma membrane", "cell surface membrane", "cell (plasma) membrane"]), "cytoplasm": ("cytoplasm", []),
        "nucleus": ("nucleus", []), "mitochondrion": ("mitochondrion", ["mitochondria"]), "ribosome": ("ribosome", ["ribosomes"]),
        "vacuole": ("vacuole", ["permanent vacuole", "sap vacuole"]), "chloroplast": ("chloroplast", ["chloroplasts"]),
        "wall": ("cell wall", ["wall"]), "dna": ("circular DNA", ["DNA", "loop of DNA", "chromosome"]),
        "plasmid": ("plasmid", ["plasmids"]), "flagellum": ("flagellum", ["flagella"])}
LEAF = {"cuticle": ("cuticle", ["waxy cuticle"]), "upper_epidermis": ("upper epidermis", []), "xylem": ("xylem", []),
        "lower_epidermis": ("lower epidermis", []), "stoma": ("stoma", ["stomata", "stomatal pore"]),
        "chloroplast": ("chloroplast", ["chloroplasts"]), "palisade": ("palisade mesophyll", ["palisade layer", "palisade cells"]),
        "air_space": ("air space", ["air spaces"]), "guard_cell": ("guard cell", ["guard cells"]),
        "spongy": ("spongy mesophyll", ["spongy layer", "spongy cells"]), "phloem": ("phloem", [])}


# Parts the drawings leave ambiguous (P3q review): a nucleus line ends by the nucleolus, ribosome dots cannot be told from
# other dots, stomata are two loose circles, bundle lines end on the whole bundle, chloroplast lines in a crowd.
UNCLEAR = {"nucleus", "ribosome", "stoma", "guard_cell", "xylem", "phloem", "chloroplast"}


def _labels(row: dict, rng: random.Random, names: dict, what: str) -> list:
    p = row["params"]
    clear = [i for i, part in enumerate(p["labelled"]) if part not in UNCLEAR]
    letters = rng.sample(clear, min(2, len(clear)))
    qs = []
    for k, i in enumerate(letters):
        name, more = names[p["labelled"][i]]
        lead = f"{_lead(rng, what)} " if k == 0 else ""
        extra = [f"{name} cell", f"{name} cells", f"{name} layer"] if name.endswith("mesophyll") else []
        qs.append(short(f"{lead}Name the part labelled {'ABCDEFGH'[i]}.", name, [name, name.lower(), *more, *extra]))
    return qs


def bio_cell(row: dict, rng: random.Random) -> list:
    p = row["params"]
    if p["style"] == "letters":
        return _labels(row, rng, CELL, "cell")
    key = {"animal": "An animal cell", "plant": "A plant cell", "bacterium": "A bacterial cell"}[p["kind"]]
    # no fungal option: with no wall drawn it could not be ruled out from an animal cell's figure (P3q review)
    return [mcq(f"{_lead(rng, 'diagram')} What kind of cell is this?", key,
                [x for x in ("An animal cell", "A plant cell", "A bacterial cell") if x != key], rng)]


def leaf_section(row: dict, rng: random.Random) -> list:
    p = row["params"]
    # names-style sections ask nothing: their stomata are two loose circles, so a count is ambiguous (P3q review)
    return _labels(row, rng, LEAF, "section through a leaf") if p["style"] == "letters" else []


# --- batch 2: titration, decay, statistics ---------------------------------------------------------

def titration_curve(row: dict, rng: random.Random) -> list:
    """All the acids and bases here are monoprotic, so the reaction is 1 : 1 and c1 V1 = c2 V2."""
    p = row["params"]
    acid_flask = p["analyte"] == "acid"
    flask, burette = (p["acid"], p["base"]) if acid_flask else (p["base"], p["acid"])
    c_flask, c_burette = (p["c_acid"], p["c_base"]) if acid_flask else (p["c_base"], p["c_acid"])
    v, vol = p["v_eq"], p["analyte_volume"]
    tol_v = p["x_max"] / 40
    v_s = _n(v)
    qs = [short(f"{_lead(rng, 'titration curve')} What volume of {burette} has been added at the equivalence point, in cm³?", v_s,
                [v_s, f"{v_s} cm³", f"{v_s} cm3", f"{v:.1f}"], tolerance=tol_v)]
    c_s = _n(c_flask)
    qs.append(short(f"The {flask} in the flask had a volume of {_n(vol)} cm³, and the {burette} has a concentration of "
                    f"{_n(c_burette)} mol/dm³. Use the graph to find the concentration of the {flask}, in mol/dm³.", c_s,
                    [c_s, f"{c_flask:.3f}", f"{c_s} mol/dm³", f"{c_s} mol dm⁻³", f"{c_s} M"], tolerance=c_burette * tol_v / vol))
    return qs


DECAY_UNITS = {"mass": "g", "activity": "Bq", "nuclei": "", "count rate": "counts/min"}
DECAY_WHAT = {"mass": "the mass of the isotope", "activity": "the activity", "nuclei": "the number of undecayed nuclei",
              "count rate": "the count rate"}


def decay_curve(row: dict, rng: random.Random) -> list:
    p = row["params"]
    t, unit = p["half_life"], p["unit"]
    t_s = _n(t)
    qs = [short(f"{_lead(rng, 'decay curve')} Use the graph to find the half-life, in {unit}.", t_s,
                [t_s, f"{t_s} {unit}", f"{t:.1f}"], tolerance=t / 10)]
    left = p["N0"] / 4
    u = DECAY_UNITS[p["quantity"]]
    l_s = _n(left)
    qs.append(short(f"What is {DECAY_WHAT[p['quantity']]} after {_n(2 * t)} {unit}?", l_s,
                    [l_s] + ([f"{l_s} {u}"] if u else []), tolerance=p["N0"] / 40))
    return qs


def box_plot(row: dict, rng: random.Random) -> list:
    p = row["params"]
    groups = p["groups"] or [None]
    k = rng.randrange(len(groups))
    lo, q1, med, q3, hi = p["plots"][k]
    of = f" for {groups[k]}" if groups[k] else ""
    ask = rng.sample(["median", "iqr", "range"], 2)
    qs = []
    for j, what in enumerate(ask):
        lead = f"{_lead(rng, 'box-and-whisker plot')} " if j == 0 else ""
        if what == "median":
            qs.append(short(f"{lead}What is the median{of}?", _n(med), [_n(med)], tolerance=1))
        elif what == "iqr":
            qs.append(short(f"{lead}What is the interquartile range{of}?", _n(q3 - q1), [_n(q3 - q1)], tolerance=1))
        else:
            qs.append(short(f"{lead}What is the range{of}?" if of else f"{lead}What is the range?", _n(hi - lo), [_n(hi - lo)], tolerance=1))
    return qs


def histogram(row: dict, rng: random.Random) -> list:
    p = row["params"]
    b, f = p["bounds"], p["freqs"]
    i = rng.randrange(len(f))
    total = sum(f)
    return [short(f"{_lead(rng, 'histogram')} How many values lie in the class from {_n(b[i])} to {_n(b[i + 1])}?", f[i], [str(f[i])]),
            short("How many values does the histogram show altogether?", total, [str(total)])]


def scatter(row: dict, rng: random.Random) -> list:
    p = row["params"]
    pts = p["points"]
    mx, my = sum(x for x, _ in pts) / len(pts), sum(y for _, y in pts) / len(pts)
    slope = sum((x - mx) * (y - my) for x, y in pts)
    if p["correlation"] == "none":
        r = slope / math.sqrt(sum((x - mx) ** 2 for x, _ in pts) * sum((y - my) ** 2 for _, y in pts))
        if abs(r) >= 0.2:
            return []  # near ±0.4 it was fairly read as weak correlation (P3q review)
    key = "No correlation" if p["correlation"] == "none" else ("Positive" if slope > 0 else "Negative")
    return [mcq(f"{_lead(rng, 'scatter diagram')} What type of correlation does it show?", key,
                [x for x in ("Positive", "Negative", "No correlation") if x != key], rng)]


# --- batch 3: circuits -----------------------------------------------------------------------------

RESISTIVE = {"resistor", "lamp", "thermistor", "ldr", "variable_resistor"}
PART_NAME = {"resistor": "resistor", "lamp": "lamp", "thermistor": "thermistor", "ldr": "LDR", "variable_resistor": "variable resistor"}


def _parts(p: dict) -> list[dict]:
    return [c for side in ("top", "right", "bottom", "left") for c in p.get(side) or []]


def _sf(v: float) -> str:
    """Three significant figures, whole numbers as they are."""
    return str(int(round(v))) if abs(v - round(v)) < 1e-9 else f"{v:.3g}"


def _q(stem: str, v: float, unit: str) -> object:
    a = _sf(v)
    forms = [a, f"{a} {unit}", f"{a}{unit}", f"{v:.2g}", f"{v:.2f}"]
    # 2%: a meter reading is printed rounded (2.3 V for 2.25 V), and working from it lands within that
    return short(stem, a, list(dict.fromkeys(forms)), tolerance=0.02 * max(abs(v), 0.01))


def circuit(row: dict, rng: random.Random) -> list:
    """Values circuits only, with no diode (its voltage drop is a convention the figure does not state) and no switch
    (open and closed are drawn alike, a gap between two circles, so the reviewers read a closed one as open). A value
    the figure prints, such as a meter reading, is never asked."""
    p = row["params"]
    if p["labels"] != "values" or p["kind"] == "diode" or any("switch" in c["kind"] for c in _parts(p)):
        return []
    if any(c["kind"] in ("fuse", "motor") for c in _parts(p)):  # no value printed; a fuse looks like a resistor without one
        return []
    printed = [float(d.split()[0]) for d in row["labels"] if d[:1].isdigit()]

    def shown(v: float) -> bool:
        return any(abs(float(_sf(v)) - x) < 1e-9 for x in printed)

    parts = _parts(p)
    source = next(c for c in parts if c["kind"] in ("battery", "cell"))
    V = source["value"]
    closed = not any(c["kind"] == "switch_open" for c in parts)
    lead = _lead(rng, "circuit")
    qs = []
    if p["kind"] == "parallel":
        branches = [[c for c in br if c["kind"] in RESISTIVE] for br in p["parallel"]]
        total = 1 / sum(1 / sum(c["value"] for c in br) for br in branches)
        if not shown(total):
            qs.append(_q(f"{lead} What is the combined resistance of the parallel part of the circuit, in Ω?", total, "Ω"))
        if not shown(V / total):
            qs.append(_q(f"What is the current from the {source['kind']}, in A?", V / total, "A"))
        single = [br[0] for br in branches if len(br) == 1]
        if single:
            c = rng.choice(single)
            if not shown(V / c["value"]):
                qs.append(_q(f"What is the current in the {_sf(c['value'])} Ω {PART_NAME[c['kind']]}, in A?", V / c["value"], "A"))
    else:
        rs = [c for c in parts if c["kind"] in RESISTIVE]
        total = sum(c["value"] for c in rs)
        current = V / total if closed else 0.0
        if not shown(total):
            qs.append(_q(f"{lead} What is the total resistance of the circuit, in Ω?", total, "Ω"))
        if not shown(current):
            qs.append(_q("What is the current in the circuit, in A?" + ("" if closed else " Look at the switch."), current, "A"))
        if closed:
            c = rng.choice(rs)
            pd = current * c["value"]
            if not shown(pd):
                qs.append(_q(f"What is the p.d. across the {_sf(c['value'])} Ω {PART_NAME[c['kind']]}, in V?", pd, "V"))
    if qs and not any(qs[0].stem.startswith(n) for n in NAMES):  # the lead goes on whichever question comes first
        qs[0].stem = f"{lead} {qs[0].stem}"
    return qs


# --- constructions -----------------------------------------------------------------------------------

CONSTRUCTIONS = {"perp_bisector": "The perpendicular bisector of a line segment", "angle_bisector": "The bisector of an angle",
                 "perp_from_point": "The perpendicular from a point to a line", "triangle_sss": "A triangle from its three sides"}
LOCUS = {"perp_bisector": ("It is the same distance from A and from B",
                           ["It is closer to A than to B", "It is on a circle with centre A", "It is twice as far from A as from B"]),
         "angle_bisector": ("It is the same distance from the lines BA and BC",
                            ["It is the same distance from the points A and B", "It is twice as far from BA as from BC",
                             "It is on a circle with centre B"])}


def construction(row: dict, rng: random.Random) -> list:
    """Every kind: which construction the arcs show. The bisectors: the locus property of the line drawn. The triangle:
    the angle at A from its three printed sides."""
    p = row["params"]
    kind = p["kind"]
    qs = [mcq(f"{_lead(rng, 'construction')} It was drawn with compasses and a ruler, and the arcs are left in. "
              "Which construction is shown?", CONSTRUCTIONS[kind], [v for k, v in CONSTRUCTIONS.items() if k != kind], rng)]
    if kind in LOCUS:
        key, wrong = LOCUS[kind]
        qs.append(mcq("Which is true of every point on the line drawn through the crossing arcs?", key, wrong, rng))
    if kind == "triangle_sss":
        ab, ac, bc = p["AB"], p["AC"], p["BC"]
        a = f"{math.degrees(math.acos((ab * ab + ac * ac - bc * bc) / (2 * ab * ac))):.1f}"
        qs.append(short("Use the cosine rule to work out angle BAC. Give your answer correct to 1 decimal place.", a,
                        [a, f"{a}°", f"BAC = {a}°"], tolerance=0.1))
    return qs


# --- energy profiles ---------------------------------------------------------------------------------

def _in_order(q):
    """Letter options read A, B, C rather than shuffled."""
    key = q.options[int(q.answer)]
    q.options = sorted(q.options)
    q.answer = str(q.options.index(key))
    return q


def energy_profile(row: dict, rng: random.Random) -> list:
    """Exothermic or endothermic from the two levels. On lettered profiles the letters run Ea, then the catalysed Ea if
    there is one, then ΔH (checked on the images); with a catalyst the two Ea letters crowd each other, so only ΔH is
    asked there. The catalysed curve is the dashed one."""
    p = row["params"]
    exo = p["h_prod"] < p["h_react"]
    what = "energy level diagram" if p["diagram"] == "levels" else "energy profile"
    qs = [mcq(f"{_lead(rng, what)} Is the reaction exothermic or endothermic?", "Exothermic" if exo else "Endothermic",
              ["Endothermic" if exo else "Exothermic"], rng)]
    if p["diagram"] != "profile":
        return qs
    cat = p["h_peak_cat"] is not None
    if p["arrow_labels"] == "lettered":
        letters = ["A", "B", "C"] if cat else ["A", "B"]
        if cat or rng.random() < 0.5:
            qs.append(_in_order(mcq("Which letter shows the enthalpy change, ΔH, of the reaction?", letters[-1], letters[:-1], rng)))
        else:
            qs.append(_in_order(mcq("Which letter shows the activation energy?", "A", ["B"], rng)))
    if cat:
        qs.append(mcq("The dashed curve is the same reaction with a catalyst. What does the catalyst do?",
                      "It lowers the activation energy",
                      ["It changes ΔH", "It raises the energy of the products", "It raises the activation energy"], rng))
    return qs


# --- pedigrees ---------------------------------------------------------------------------------------

WHY = {True: "dominant: two affected parents have an unaffected child", False: "recessive: two unaffected parents have an affected child"}
WHY_WRONG = ["dominant: two unaffected parents have an affected child", "recessive: two affected parents have an unaffected child"]
ALLELES = {"AR": "The alleles are A (dominant) and a (recessive), and the condition is caused by a.",
           "AD": "The alleles are D (dominant) and d (recessive), and the condition is caused by D.",
           "XR": "The condition is sex-linked: it is caused by the recessive allele Xᵃ on the X chromosome, and Xᴬ is the "
                 "dominant allele."}
GENOTYPES = {"AR": ["AA", "Aa", "aa"], "AD": ["DD", "Dd", "dd"],
             "f": ["XᴬXᴬ", "XᴬXᵃ", "XᵃXᵃ", "XᴬY"], "m": ["XᴬY", "XᵃY", "XᴬXᵃ", "XᵃXᵃ"]}


def pedigree_numbers(people: list[dict]) -> dict[int, int]:
    """The number the drawing gives each person: generation by generation, left to right, as it lays them out. The
    founders in id order; then each couple's children in the order their parents were drawn, children by id, each
    followed by the spouse who married in. (The ids are not the drawn numbers: P3q review read them as such.)"""
    spouses: dict[int, list[int]] = {}
    for x in people:
        if x.get("spouse_of"):
            spouses.setdefault(x["spouse_of"], []).append(x["id"])
    order = sorted(x["id"] for x in people if x["gen"] == 1 and not x.get("spouse_of"))
    drawn = list(order)
    while True:
        couples = []
        for pid in order:
            for x in sorted(people, key=lambda y: y["id"]):
                c = tuple(x["parents"] or ())
                if pid in c and c not in couples:
                    couples.append(c)
        nxt = []
        for c in couples:
            for kid in sorted(x["id"] for x in people if tuple(x["parents"] or ()) == c):
                nxt += [kid] + sorted(spouses.get(kid, []))
        nxt = [i for i in nxt if i not in drawn]
        if not nxt:
            break
        drawn += nxt
        order = nxt
    return {pid: k + 1 for k, pid in enumerate(drawn)}


def pedigree(row: dict, rng: random.Random) -> list:
    """Dominant or recessive, asked only where the chart proves it (a couple alike with a child unlike them). A genotype,
    asked only of a person whose genotype the chart decides, preferring the ones it takes a step to decide."""
    p = row["params"]
    mode = p["mode"]
    people = {x["id"]: x for x in p["people"]}
    kids = {i: [x for x in p["people"] if x["parents"] and i in x["parents"]] for i in people}
    couples = {tuple(x["parents"]) for x in p["people"] if x["parents"]}

    def near(x):
        return [people[i] for i in (x["parents"] or [])] + kids[x["id"]]

    qs = []
    dominant = mode == "AD"
    if any(people[a]["affected"] == dominant and people[b]["affected"] == dominant
           and any(k["affected"] != dominant for k in kids[a] if k in kids[b]) for a, b in couples):
        qs.append(mcq("Is the condition caused by a dominant or a recessive allele? Choose the answer with the reason the "
                      "chart gives.", WHY[dominant], [WHY[not dominant], *WHY_WRONG], rng))
    everyone = list(people.values())
    if mode == "AR":
        sure = [(x, "Aa") for x in everyone if not x["affected"] and any(y["affected"] for y in near(x))]
        plain = [(x, "aa") for x in everyone if x["affected"]]
    elif mode == "AD":
        sure = [(x, "Dd") for x in everyone if x["affected"] and any(not y["affected"] for y in near(x))]
        plain = [(x, "dd") for x in everyone if not x["affected"]]
    else:
        sure = [(x, "XᴬXᵃ") for x in everyone
                if x["sex"] == "f" and not x["affected"] and any(y["affected"] and y["sex"] == "m" for y in near(x))]
        plain = [(x, "XᵃY") for x in everyone if x["sex"] == "m" and x["affected"]]
    pick = sure or plain
    if pick:
        x, key = rng.choice(pick)
        options = GENOTYPES[mode] if mode != "XR" else GENOTYPES[x["sex"]]
        number = pedigree_numbers(p["people"])[x["id"]]
        qs.append(mcq(f"{ALLELES[mode]} What is the genotype of person {number}?", key, options, rng))
    if qs:
        qs[0].stem = f"{_lead(rng, 'family tree')} Shaded symbols are people with an inherited condition. {qs[0].stem}"
    return qs


# --- electron shells ---------------------------------------------------------------------------------

ELEMENTS = ["hydrogen", "helium", "lithium", "beryllium", "boron", "carbon", "nitrogen", "oxygen", "fluorine", "neon", "sodium",
            "magnesium", "aluminium", "silicon", "phosphorus", "sulfur", "chlorine", "argon", "potassium", "calcium"]
SYMBOLS = ["H", "He", "Li", "Be", "B", "C", "N", "O", "F", "Ne", "Na", "Mg", "Al", "Si", "P", "S", "Cl", "Ar", "K", "Ca"]
ANIONS = {"N": "nitride", "O": "oxide", "F": "fluoride", "S": "sulfide", "Cl": "chloride", "P": "phosphide"}
ION_CHARGE = {"Li": 1, "Na": 1, "K": 1, "Be": 2, "Mg": 2, "Ca": 2, "Al": 3, "N": -3, "P": -3, "O": -2, "S": -2, "F": -1, "Cl": -1}
SUPERSCRIPT = str.maketrans("0123456789+-", "⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻")


def _a(word: str) -> str:
    return ("an " if word[0] in "aeiou" else "a ") + word


def _particle(z: int, charge: int) -> str:
    sym, name = SYMBOLS[z - 1], ELEMENTS[z - 1]
    if not charge:
        return _a(f"{name} atom")
    sup = ((str(abs(charge)) if abs(charge) > 1 else "") + ("+" if charge > 0 else "-")).translate(SUPERSCRIPT)
    return _a(f"{ANIONS[sym] if charge < 0 else name} ion, {sym}{sup}")


def _shells(electrons: int) -> list[int]:
    out = []
    for cap in (2, 8, 8, 2):
        if electrons > 0:
            out.append(min(cap, electrons))
            electrons -= out[-1]
    return out


def electron_shells(row: dict, rng: random.Random) -> list:
    """The configuration from the electrons drawn (2, 8, 8, 2). Where the nucleus shows its protons and neutrons, which
    particle it is (against the atoms beside it, the atom of an ion, and particles with the same electrons) and the
    mass number. H⁻ is left out: it is not taught at IGCSE."""
    p = row["params"]
    sym, charge = p["symbol"], p["charge"]
    if sym == "H" and charge < 0:
        return []
    z = SYMBOLS.index(sym) + 1
    e = z - charge
    which = "ion" if charge else "atom"
    shells = _shells(e)
    a = ",".join(map(str, shells))
    forms = [a, ".".join(map(str, shells)), ", ".join(map(str, shells)), " ".join(map(str, shells)), "-".join(map(str, shells))]
    qs = [short(f"{_lead(rng, 'diagram')} It shows the electrons in their shells. What is the electronic configuration of this "
                f"{which}?", a, list(dict.fromkeys(forms)))]
    if p["nucleus"] != "particles":
        return qs
    near = []
    if charge:
        near.append(_particle(z, 0))
        if 1 <= e <= 20:
            near.append(_particle(e, 0))
        same = [_particle(SYMBOLS.index(s) + 1, c) for s, c in ION_CHARGE.items() if SYMBOLS.index(s) + 1 - c == e and s != sym]
        near += rng.sample(same, len(same))
    else:
        near += [_particle(k, 0) for k in (z - 1, z + 1) if 1 <= k <= 20]
        if sym in ION_CHARGE:
            near.append(_particle(z, ION_CHARGE[sym]))
        near += [_particle(k, 0) for k in (z - 2, z + 2) if 1 <= k <= 20]
    qs.append(mcq("Which particle does the diagram show?", _particle(z, charge), near, rng))
    neutrons = next((int(lab[:-1]) for lab in row["labels"] if lab[:-1].isdigit() and lab.endswith("n")), None)
    if neutrons is not None:
        qs.append(short(f"What is the mass number of this {which}?", z + neutrons, [str(z + neutrons)]))
    return qs


# --- molecules ---------------------------------------------------------------------------------------

_ATOM = re.compile(r"Cl|Br|[BCNOSPFI]|[cnos]")
SUBSCRIPT = str.maketrans("0123456789", "₀₁₂₃₄₅₆₇₈₉")
SERIES_RULES = [("Halogenoalkanes", r"(chloro|bromo|iodo)[a-z\d,-]*ane$"), ("Esters", r"^\S+ \S+oate$"),
                ("Carboxylic acids", r"oic acid$"), ("Alcohols", r"ane?(-[\d,]+-)?(di|tri)?ol$"), ("Aldehydes", r"anal$"),
                ("Ketones", r"an(-\d-)?one$"), ("Amines", r"amine$"), ("Amides", r"amide$"), ("Nitriles", r"nitrile$"),
                ("Acyl chlorides", r"oyl chloride$"), ("Alkenes", r"ene$"), ("Alkanes", r"ane$")]
OTHER_GROUPS = r"hydroxy|amino|oxo|cyano|nitro|benz|phen|cyclo|oxy|-en-|enoic|enoate|anhydride|aspirin|paracetamol|serine|alanine|salicyl"
IGCSE_SERIES = ["Alkanes", "Alkenes", "Alcohols", "Carboxylic acids", "Esters"]
AS_SERIES = IGCSE_SERIES + ["Aldehydes", "Ketones", "Amines", "Halogenoalkanes", "Nitriles", "Amides", "Acyl chlorides"]
IGCSE_NAME = re.compile(r"^(meth|eth|prop|but)(ane|ene|anol|an-[12]-ol|anoic acid)$|^but-[12]-ene$"
                        r"|^(methyl|ethyl|propyl|butyl) (methan|ethan|propan|butan)oate$")


def series_of(name: str) -> str | None:
    """The homologous series a name puts a compound in, or None where it has more than one functional group."""
    if re.search(OTHER_GROUPS, name):
        return None
    for series, rule in SERIES_RULES:
        if re.search(rule, name):
            if series != "Halogenoalkanes" and re.search(r"chloro|bromo|iodo", name):
                return None
            return series
    return None


def formula_of(smiles: str) -> str | None:
    """The molecular formula of a neutral molecule written without brackets: hydrogens from the valences
    (H = 2C + 2 + N − halogens − 2 × double-bond equivalents), C and H first, then the rest alphabetically."""
    if "[" in smiles or "%" in smiles:
        return None
    atoms = _ATOM.findall(smiles)
    n: dict[str, int] = {}
    for at in atoms:
        el = at.upper() if len(at) == 1 else at
        n[el] = n.get(el, 0) + 1
    rings = sum(ch.isdigit() for ch in smiles) // 2
    dbe = smiles.count("=") + 2 * smiles.count("#") + rings + sum(at.islower() for at in atoms) // 2
    h = 2 * n.get("C", 0) + 2 + n.get("N", 0) - sum(n.get(x, 0) for x in ("F", "Cl", "Br", "I")) - 2 * dbe
    if h < 0:
        return None
    if h:
        n["H"] = h
    order = ["C", "H"] + sorted(e for e in n if e not in ("C", "H"))
    return "".join(e + (str(n[e]) if n[e] > 1 else "") for e in order if e in n)


def _drawn(labels: list[str]) -> str:
    """The formula of the atoms a drawing labels, in the same order as `formula_of`."""
    n: dict[str, int] = {}
    for lab in labels:
        for el, k in re.findall(r"(Cl|Br|[A-Z])(\d*)", lab):
            n[el] = n.get(el, 0) + int(k or 1)
    order = ["C", "H"] + sorted(e for e in n if e not in ("C", "H"))
    return "".join(e + (str(n[e]) if n[e] > 1 else "") for e in order if e in n)


@functools.lru_cache(maxsize=1)
def _named() -> dict:
    """Every molecule the dataset draws, name -> (formula, series, carbons): the pool the wrong names come from."""
    from . import manifest
    out = {}
    for r in manifest.rows({"chem.molecule"}):
        name, smiles = r["params"]["name"], r["params"]["smiles"]
        f = formula_of(smiles)
        if f:
            out[name] = (f, series_of(name), sum(1 for at in _ATOM.findall(smiles) if at in ("C", "c")))
    return out


def _wrong_names(name: str, igcse: bool, rng: random.Random) -> list[str]:
    """Isomers first, then the same series a carbon longer or shorter, then the same carbons in another series."""
    pool = {k: v for k, v in _named().items() if k != name and (not igcse or IGCSE_NAME.match(k))}
    f, s, c = _named()[name]
    tiers = [[k for k, v in pool.items() if v[0] == f],
             [k for k, v in pool.items() if s and v[1] == s and abs(v[2] - c) == 1],
             [k for k, v in pool.items() if v[2] == c and v[0] != f]]
    out = []
    for t in tiers:
        rng.shuffle(t)
        out += [k for k in t if k not in out]
    return out


def molecule(row: dict, rng: random.Random) -> list:
    """The name (at IGCSE only the names the syllabus teaches: unbranched, up to four carbons, and their esters), the
    homologous series where there is one functional group, and the molecular formula. Polyfunctional A2 molecules are
    named by trivial names, so they are not asked for a name."""
    p = row["params"]
    name, mode = p["name"], p["mode"]
    igcse = row["qualification"] == "igcse"
    qs = []
    if name in _named() and row["qualification"] != "a2" and (not igcse or IGCSE_NAME.match(name)):
        wrong = _wrong_names(name, igcse, rng)
        if len(wrong) >= 3:
            qs.append(mcq("Which is the name of this compound?", name, wrong, rng))
    s = series_of(name)
    if s and (s in IGCSE_SERIES or not igcse):
        others = [x for x in (IGCSE_SERIES if igcse else AS_SERIES) if x != s]
        qs.append(mcq("Which homologous series does this compound belong to?", s, rng.sample(others, len(others)), rng))
    f = formula_of(p["smiles"])
    if mode != "skeletal" and f != _drawn(row["labels"]):
        f = None  # a ring drawn as a bare hexagon in a structural formula: neither skeletal nor showing every atom
    if f and not (mode == "structural" and len(row["labels"]) == 1):  # a lone "CH4" is its own formula
        hint = " The skeletal formula does not show the hydrogen atoms on carbon." if mode == "skeletal" else ""
        qs.append(short(f"What is the molecular formula of this compound?{hint}", f, [f, f.translate(SUBSCRIPT)]))
    if qs:
        what = {"skeletal": "skeletal formula", "structural": "structural formula"}.get(mode, "displayed formula")
        qs[0].stem = f"{_lead(rng, what)} {qs[0].stem}"
    return qs


WRITERS = {
    "phys.circuit": circuit,
    "chem.titration_curve": titration_curve,
    "phys.decay_curve": decay_curve,
    "math.box_plot": box_plot,
    "math.histogram": histogram,
    "math.scatter": scatter,
    "math.trig_triangle": trig_triangle,
    "math.transformation": transformation,
    "math.vector": vector,
    "math.function_graph": function_graph,
    "math.number_line": number_line,
    "bio.cell": bio_cell,
    "math.construction": construction,
    "chem.energy_profile": energy_profile,
    "bio.pedigree": pedigree,
    "chem.electron_shells": electron_shells,
    "chem.molecule": molecule,
    # bio.leaf_section is not imported: its leader lines end between parts (palisade cell or chloroplast, air space or
    # spongy cell), and the blind review passed 18 of 30 even with the clearest parts only (P3q fix review)
}


def questions(row: dict, rng: random.Random) -> list:
    w = WRITERS.get(row["family"])
    return w(row, rng) if w else []
