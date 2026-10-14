"""The dataset's question writers (P3q), every key recomputed independently over every manifest row of its family."""
import math
import random
import re

import pytest

from figgen.dataset import manifest

pytestmark = pytest.mark.skipif(not manifest.available(), reason="needs the exam-diagram dataset")


def writers():
    from figgen.dataset import writers as w
    return w


def asked(family, limit=None):
    w = writers()
    for k, row in enumerate(manifest.rows({family}, limit)):
        rng = random.Random(k)
        yield row, w.questions(row, rng)


def picked(q):
    return q.options[int(q.answer)]


def nums(text):
    return [float(x) for x in re.findall(r"-?\d+(?:\.\d+)?", text.replace("−", "-"))]


# --- maths -----------------------------------------------------------------------------------------

def solve(mode, g, unknown):
    """The triangle from its givens: a opposite A, b opposite B, c opposite C; right angle at C in the R modes."""
    r, d = math.radians, math.degrees
    if mode.startswith("R_"):
        a, b, c, A, B = (g.get(k) for k in "abcAB")
        if A is None and B is not None:
            A = 90 - B
        if c is None and a is not None and b is not None:
            c = math.hypot(a, b)
        if A is not None:
            if c is None:
                c = a / math.sin(r(A)) if a is not None else b / math.cos(r(A))
        elif a is not None and c is not None:
            A = d(math.asin(a / c))
        elif b is not None and c is not None:
            A = d(math.acos(b / c))
        else:
            A = d(math.atan2(a, b))
        vals = {"a": c * math.sin(r(A)), "b": c * math.cos(r(A)), "c": c, "A": A, "B": 90 - A}
        return vals[unknown]
    A, B, C = g.get("A"), g.get("B"), g.get("C")
    a, b, c = g.get("a"), g.get("b"), g.get("c")
    if mode == "SR_AAS":
        C = 180 - A - B
        k = a / math.sin(r(A))
        return {"b": k * math.sin(r(B)), "c": k * math.sin(r(C)), "C": C}[unknown]
    if mode == "SR_SSA":
        Bv = d(math.asin(b * math.sin(r(A)) / a))
        return {"B": Bv, "C": 180 - A - Bv}[unknown]
    if mode == "CR_SAS":
        return math.sqrt(b * b + c * c - 2 * b * c * math.cos(r(A)))
    if mode == "CR_SSS":
        return d(math.acos((b * b + c * c - a * a) / (2 * b * c)))
    raise AssertionError(mode)


def test_trig_triangle():
    for row, qs in asked("math.trig_triangle"):
        p = row["params"]
        exact = solve(p["mode"], p["given"], p["unknown"])
        for q in qs:
            if "Find the value of x" in q.stem:
                v = float(q.answer)
                if p["unknown"] in "ABC":
                    assert "1 decimal place" in q.stem and q.answer == f"{exact:.1f}", (row["id"], q.answer, exact)
                else:
                    assert "3 significant figures" in q.stem and abs(v - float(f"{exact:.3g}")) < 1e-9, (row["id"], q.answer, exact)


def image(kind, t, x, y):
    if kind == "translation":
        return x + t["dx"], y + t["dy"]
    if kind == "enlargement":
        return t["cx"] + t["k"] * (x - t["cx"]), t["cy"] + t["k"] * (y - t["cy"])
    if kind == "rotation":
        a = math.radians(t["angle"])
        dx, dy = x - t["cx"], y - t["cy"]
        return round(t["cx"] + dx * math.cos(a) - dy * math.sin(a)), round(t["cy"] + dx * math.sin(a) + dy * math.cos(a))
    line = t["line"]
    if line == "y=x":
        return y, x
    if line == "y=-x":
        return -y, -x
    if line == "x":
        return 2 * t["v"] - x, y
    return x, 2 * t["v"] - y


def test_transformation():
    for row, qs in asked("math.transformation"):
        p = row["params"]
        t = p["t"]
        for q in qs:
            if "maps shape A onto shape B" in q.stem:
                key = picked(q).lower()
                assert key.startswith(p["kind"]), (row["id"], key)
                if p["kind"] == "rotation":
                    assert f"{abs(t['angle'])}°" in key
                    if abs(t["angle"]) != 180:  # a half turn has no direction
                        assert ("anticlockwise" if t["angle"] > 0 else "clockwise") in key
                    assert f"({t['cx']}, {t['cy']})" in key
                if p["kind"] == "enlargement":
                    assert f"({t['cx']}, {t['cy']})" in key
            got = re.search(r"image of the corner at \((-?\d+), (-?\d+)\)", q.stem)
            if got:
                x, y = int(got.group(1)), int(got.group(2))
                assert [x, y] == p["at"]
                assert nums(q.answer) == list(map(float, image(p["kind"], t, x, y))), row["id"]


def test_vector():
    for row, qs in asked("math.vector"):
        p = row["params"]
        if p["kind"] != "grid":
            assert not qs
            continue
        a, b = p["a"], p["b"]
        for q in qs:
            got = re.search(r"Write (-?\d*)a ([+−-]) (\d*)b as a column vector", q.stem)
            if got:
                ka = int(got.group(1).replace("−", "-") or 1) if got.group(1) not in ("-", "") else (-1 if got.group(1) == "-" else 1)
                kb = int(got.group(3) or 1) * (-1 if got.group(2) in "−-" else 1)
                assert nums(q.answer) == [ka * a[0] + kb * b[0], ka * a[1] + kb * b[1]], (row["id"], q.stem, q.answer)
            got = re.search(r"Write ([ab]) as a column vector", q.stem)
            if got:
                v = a if got.group(1) == "a" else b
                assert nums(q.answer) == [float(v[0]), float(v[1])]


def test_function_graph():
    for row, qs in asked("math.function_graph"):
        p = row["params"]
        for q in qs:
            if "gradient of the line" in q.stem:
                assert p["kind"] == "linear" and float(q.answer) == p["m"]
            if "line of symmetry" in q.stem:
                assert p["kind"] == "quadratic" and nums(q.answer) == [(p["r1"] + p["r2"]) / 2]
            if "How many times does the curve meet the x-axis" in q.stem:
                assert p["kind"] == "cubic" and int(q.answer) == len(set(p["roots"]))


def test_number_line():
    for row, qs in asked("math.number_line"):
        p = row["params"]
        lo, hi = p["lo"], p["hi"]
        for q in qs:
            if q.kind == "mcq" and "inequality" in q.stem:
                key = picked(q).replace("−", "-").replace(" ", "")
                want = ""
                if lo is not None:
                    want += f"{lo}{'<' if p['lo_op'] == '<' else '≤'}"
                want += "x"
                if hi is not None:
                    want += f"{'<' if p['hi_op'] == '<' else '≤'}{hi}"
                assert key == want, (row["id"], key, want)
            if "integers" in q.stem:
                assert lo is not None and hi is not None
                ints = [n for n in range(int(lo) - 1, int(hi) + 2)
                        if (n > lo if p["lo_op"] == "<" else n >= lo) and (n < hi if p["hi_op"] == "<" else n <= hi)]
                assert [int(v) for v in nums(q.answer)] == ints


# --- biology labels --------------------------------------------------------------------------------

CELL = {"membrane": "cell membrane", "cytoplasm": "cytoplasm", "nucleus": "nucleus", "mitochondrion": "mitochondrion",
        "ribosome": "ribosome", "vacuole": "vacuole", "chloroplast": "chloroplast", "wall": "cell wall", "dna": "circular DNA",
        "plasmid": "plasmid", "flagellum": "flagellum"}
LEAF = {"cuticle": "cuticle", "upper_epidermis": "upper epidermis", "xylem": "xylem", "lower_epidermis": "lower epidermis",
        "stoma": "stoma", "chloroplast": "chloroplast", "palisade": "palisade mesophyll", "air_space": "air space",
        "guard_cell": "guard cell", "spongy": "spongy mesophyll", "phloem": "phloem"}


def test_labelled_diagrams():
    for family, names in (("bio.cell", CELL), ("bio.leaf_section", LEAF)):
        for row, qs in asked(family):
            p = row["params"]
            for q in qs:
                got = re.search(r"part labelled ([A-H])", q.stem)
                if got:
                    assert p["style"] == "letters"
                    assert q.answer == names[p["labelled"]["ABCDEFGH".index(got.group(1))]], row["id"]
                if q.kind == "mcq" and "kind of cell" in q.stem:
                    assert picked(q).lower().startswith({"animal": "an animal", "plant": "a plant", "bacterium": "a bacterial"}[p["kind"]])
                if "How many stomata" in q.stem:
                    assert int(q.answer) == p["stomata"]


def test_every_question_has_a_named_lead_and_the_figure():
    """The quiz drops repeated wordings; each figure's first stem names a person (as the drawn families do)."""
    from figgen.core import NAMES
    w = writers()
    for family in w.WRITERS:
        for row, qs in asked(family, limit=40):
            if qs:
                assert any(qs[0].stem.startswith(n) for n in NAMES), (family, qs[0].stem)
