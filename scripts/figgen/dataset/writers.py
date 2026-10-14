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

import math
import random

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

CELL = {"membrane": ("cell membrane", ["membrane", "plasma membrane", "cell surface membrane"]), "cytoplasm": ("cytoplasm", []),
        "nucleus": ("nucleus", []), "mitochondrion": ("mitochondrion", ["mitochondria"]), "ribosome": ("ribosome", ["ribosomes"]),
        "vacuole": ("vacuole", ["permanent vacuole", "sap vacuole"]), "chloroplast": ("chloroplast", ["chloroplasts"]),
        "wall": ("cell wall", ["wall"]), "dna": ("circular DNA", ["DNA", "loop of DNA", "chromosome"]),
        "plasmid": ("plasmid", ["plasmids"]), "flagellum": ("flagellum", ["flagella"])}
LEAF = {"cuticle": ("cuticle", ["waxy cuticle"]), "upper_epidermis": ("upper epidermis", []), "xylem": ("xylem", []),
        "lower_epidermis": ("lower epidermis", []), "stoma": ("stoma", ["stomata", "stomatal pore"]),
        "chloroplast": ("chloroplast", ["chloroplasts"]), "palisade": ("palisade mesophyll", ["palisade layer", "palisade cells"]),
        "air_space": ("air space", ["air spaces"]), "guard_cell": ("guard cell", ["guard cells"]),
        "spongy": ("spongy mesophyll", ["spongy layer", "spongy cells"]), "phloem": ("phloem", [])}


def _labels(row: dict, rng: random.Random, names: dict, what: str) -> list:
    p = row["params"]
    letters = rng.sample(range(len(p["labelled"])), min(2, len(p["labelled"])))
    qs = []
    for k, i in enumerate(letters):
        name, more = names[p["labelled"][i]]
        lead = f"{_lead(rng, what)} " if k == 0 else ""
        qs.append(short(f"{lead}Name the part labelled {'ABCDEFGH'[i]}.", name, [name, name.lower(), *more]))
    return qs


def bio_cell(row: dict, rng: random.Random) -> list:
    p = row["params"]
    if p["style"] == "letters":
        return _labels(row, rng, CELL, "cell")
    key = {"animal": "An animal cell", "plant": "A plant cell", "bacterium": "A bacterial cell"}[p["kind"]]
    return [mcq(f"{_lead(rng, 'diagram')} What kind of cell is this?", key,
                [x for x in ("An animal cell", "A plant cell", "A bacterial cell", "A fungal cell") if x != key], rng)]


def leaf_section(row: dict, rng: random.Random) -> list:
    p = row["params"]
    if p["style"] == "letters":
        return _labels(row, rng, LEAF, "section through a leaf")
    n = p["stomata"]
    return [short(f"{_lead(rng, 'section through a leaf')} How many stomata are shown?", n, [str(n), f"{n} stomata"])]


WRITERS = {
    "math.trig_triangle": trig_triangle,
    "math.transformation": transformation,
    "math.vector": vector,
    "math.function_graph": function_graph,
    "math.number_line": number_line,
    "bio.cell": bio_cell,
    "bio.leaf_section": leaf_section,
}


def questions(row: dict, rng: random.Random) -> list:
    w = WRITERS.get(row["family"])
    return w(row, rng) if w else []
