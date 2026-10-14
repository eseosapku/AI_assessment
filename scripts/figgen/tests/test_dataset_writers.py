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


def test_label_questions_skip_what_the_drawings_leave_ambiguous():
    """P3q review: nucleus lines end by the nucleolus, ribosome dots are unidentifiable, stomata are two loose circles,
    and bundle lines end on the whole bundle; a fungal cell could not be ruled out with no wall drawn."""
    for family, skip in (("bio.cell", {"nucleus", "ribosome"}),
                         ("bio.leaf_section", {"stoma", "guard cell", "xylem", "phloem", "chloroplast"})):
        for row, qs in asked(family):
            for q in qs:
                assert q.answer not in skip, (family, q.stem, q.answer)
                assert "How many stomata" not in q.stem
                assert "A fungal cell" not in q.options
                if "Name the part labelled" in q.stem and q.answer.endswith("mesophyll"):
                    assert f"{q.answer} cell" in q.accepted and f"{q.answer} cells" in q.accepted


# --- batch 2: titration, decay, statistics ---------------------------------------------------------

def test_titration_curve():
    for row, qs in asked("chem.titration_curve"):
        p = row["params"]
        assert qs, row["id"]  # every row asks something
        for q in qs:
            if "equivalence point" in q.stem and "concentration" not in q.stem:
                assert float(q.answer) == p["v_eq"] and q.tolerance > 0
            if "find the concentration" in q.stem:
                want = p["c_acid"] if p["analyte"] == "acid" else p["c_base"]
                assert abs(float(q.answer) - want) < 1e-9, row["id"]
                # what the stem gives is the other solution's concentration and the analyte's volume
                given = p["c_base"] if p["analyte"] == "acid" else p["c_acid"]
                assert _n(given) in q.stem and _n(p["analyte_volume"]) in q.stem


def _n(v):
    return str(int(v)) if float(v).is_integer() else str(v)


def test_decay_curve():
    for row, qs in asked("phys.decay_curve"):
        p = row["params"]
        assert qs, row["id"]  # every row asks something
        for q in qs:
            if "half-life" in q.stem:
                assert float(q.answer) == p["half_life"]
            got = re.search(r"after ([\d.]+) ", q.stem)
            if got:
                assert float(got.group(1)) == 2 * p["half_life"]
                assert float(q.answer) == p["N0"] / 4


def test_box_plot():
    for row, qs in asked("math.box_plot"):
        p = row["params"]
        assert qs, row["id"]  # every row asks something
        groups = p["groups"] or [None]
        for q in qs:
            k = next((i for i, g in enumerate(groups) if g and g in q.stem), 0)
            lo, q1, med, q3, hi = p["plots"][k]
            if "median" in q.stem:
                assert float(q.answer) == med
            if "interquartile range" in q.stem:
                assert float(q.answer) == q3 - q1
            if q.stem.endswith("What is the range?") or " range of " in q.stem and "interquartile" not in q.stem:
                assert float(q.answer) == hi - lo


def test_histogram():
    for row, qs in asked("math.histogram"):
        p = row["params"]
        assert qs, row["id"]  # every row asks something
        b, f = p["bounds"], p["freqs"]
        for q in qs:
            got = re.search(r"class from (\d+) to (\d+)", q.stem)
            if got:
                i = b.index(int(got.group(1)))
                assert b[i + 1] == int(got.group(2)) and int(q.answer) == f[i]
            if "altogether" in q.stem:
                assert int(q.answer) == sum(f)


def test_scatter():
    for row, qs in asked("math.scatter"):
        p = row["params"]
        assert qs or p["correlation"] == "none", row["id"]  # a "none" diagram near ±0.4 asks nothing
        xs, ys = zip(*p["points"])
        mx, my = sum(xs) / len(xs), sum(ys) / len(ys)
        slope = sum((x - mx) * (y - my) for x, y in p["points"])
        for q in qs:
            if "correlation" in q.stem:
                want = "No correlation" if p["correlation"] == "none" else ("Positive" if slope > 0 else "Negative")
                assert picked(q) == want, row["id"]


# --- batch 3: circuits -----------------------------------------------------------------------------

RESISTIVE = {"resistor", "lamp", "thermistor", "ldr", "variable_resistor"}


def _parts(p):
    return [c for side in ("top", "right", "bottom", "left") for c in p.get(side) or []]


def test_circuit():
    asking = values = 0
    for row, qs in asked("phys.circuit"):
        p = row["params"]
        switch = any("switch" in c["kind"] for c in _parts(p))  # open and closed are drawn alike, a gap between two circles
        unvalued = any(c["kind"] in ("fuse", "motor") for c in _parts(p))  # no value printed; a fuse looks like a resistor
        # parallel: the first branch lies on the main wire, and every reviewer read it as in series with the rest
        if p["labels"] != "values" or p["kind"] in ("diode", "parallel") or switch or unvalued:
            assert not qs
            continue
        drawn = set(row["labels"])
        source = next(c["value"] for c in _parts(p) if c["kind"] in ("battery", "cell"))
        total = sum(c["value"] for c in _parts(p) if c["kind"] in RESISTIVE)
        current = source / total
        if p["show_readings"]:
            # a printed voltage is exact, or subtracting it (6.0 V − 5.5 V) lands far from the key (0.545 V); a rounded
            # current only scales, so within 1% it stays within the key's 2%
            volts = [float(d.split()[0]) for d in row["labels"] if d.endswith(" V")]
            volts.remove(source)
            amps = [float(d.split()[0]) for d in row["labels"] if d.endswith(" A")]
            across = next((c["value"] for c in _parts(p) if p.get("voltmeter") and c["id"] == p["voltmeter"]["across"]), None)
            if any(abs(a - current) > 0.01 * current for a in amps) or (across and any(abs(v - current * across) > 1e-9 for v in volts)):
                assert not qs, row["id"]
                continue
        values += 1
        asking += bool(qs)  # a circuit whose every value is printed asks nothing
        for q in qs:
            v = float(q.answer)
            # a meter reading is printed rounded (2.3 V for 2.25 V), so working from it lands within 2%
            assert q.tolerance >= 0.0199 * max(abs(v), 0.01), (row["id"], q.tolerance)  # of the unrounded value
            printed = [float(d.split()[0]) for d in drawn if d[:1].isdigit()]
            assert not any(abs(v - x) < 1e-9 for x in printed), (row["id"], q.answer)  # never a printed value
            if "total resistance" in q.stem:
                assert abs(v - total) <= 0.006 * total + 1e-9, (row["id"], v, total)
            if "current in the circuit" in q.stem:
                assert abs(v - current) <= 0.006 * max(current, 0.01) + 1e-9, (row["id"], v, current)
            got = re.search(r"p\.d\. across the ([\d.]+) Ω", q.stem)
            if got:
                assert abs(v - current * float(got.group(1))) <= 0.01 * max(current * float(got.group(1)), 0.01) + 1e-9
    assert asking >= 0.8 * values, (asking, values)


def test_no_correlation_is_asked_only_where_r_is_near_0():
    """"No correlation" diagrams with r near ±0.4 were fairly read as weak correlation (P3q review)."""
    for row, qs in asked("math.scatter"):
        p = row["params"]
        if p["correlation"] == "none" and qs:
            xs, ys = zip(*p["points"])
            mx, my = sum(xs) / len(xs), sum(ys) / len(ys)
            sxy = sum((x - mx) * (y - my) for x, y in p["points"])
            r = sxy / math.sqrt(sum((x - mx) ** 2 for x in xs) * sum((y - my) ** 2 for y in ys))
            assert abs(r) < 0.2, (row["id"], r)


# --- batch 4: constructions, energy profiles, pedigrees, molecules, electron shells -----------------

CONSTRUCTIONS = {"perp_bisector": "The perpendicular bisector of a line segment", "angle_bisector": "The bisector of an angle",
                 "perp_from_point": "The perpendicular from a point to a line", "triangle_sss": "A triangle from its three sides"}
LOCUS = {"perp_bisector": "It is the same distance from A and from B",
         "angle_bisector": "It is the same distance from the lines BA and BC"}


def test_construction():
    seen = set()
    for row, qs in asked("math.construction"):
        p = row["params"]
        assert qs, row["id"]
        for q in qs:
            if "Which construction" in q.stem:
                assert picked(q) == CONSTRUCTIONS[p["kind"]]
                seen.add("which")
            if "every point on" in q.stem.lower():
                assert picked(q) == LOCUS[p["kind"]]
                seen.add("locus")
            if "angle BAC" in q.stem:
                ab, ac, bc = p["AB"], p["AC"], p["BC"]
                want = math.degrees(math.acos((ab * ab + ac * ac - bc * bc) / (2 * ab * ac)))
                assert p["kind"] == "triangle_sss" and q.answer == f"{want:.1f}", (row["id"], q.answer, want)
                seen.add("angle")
    assert seen == {"which", "locus", "angle"}


def test_energy_profile():
    seen = set()
    for row, qs in asked("chem.energy_profile"):
        p = row["params"]
        assert qs, row["id"]
        for q in qs:
            if "exothermic or endothermic" in q.stem:
                assert picked(q) == ("Exothermic" if p["h_prod"] < p["h_react"] else "Endothermic")
                seen.add("exo")
            if "Which letter shows the enthalpy change" in q.stem:
                # the letters run Ea, then the catalysed Ea if there is one, then ΔH (checked on the images)
                assert p["arrow_labels"] == "lettered" and p["diagram"] == "profile"
                assert picked(q) == ("C" if p["h_peak_cat"] is not None else "B")
                seen.add("dh")
            if "Which letter shows the activation energy" in q.stem:
                assert p["arrow_labels"] == "lettered" and p["h_peak_cat"] is None and picked(q) == "A"
                seen.add("ea")
            if "catalyst" in q.stem:
                assert p["h_peak_cat"] is not None and p["h_peak_cat"] < p["h_peak"]
                assert picked(q) == "It lowers the activation energy"
                seen.add("cat")
    assert seen == {"exo", "dh", "ea", "cat"}


def drawn_order(row):
    """The people's ids in the order the drawing numbers them 1, 2, 3 ..., read from the SVG (data, never run)."""
    svg = (manifest.root() / row["svg"]).read_text(encoding="utf-8")
    return [int(x) for x in re.findall(r'class="number" data-pid="(\d+)"', svg)]


def test_pedigree_numbers_follow_the_drawing():
    from figgen.dataset import writers as w
    for row in manifest.rows({"bio.pedigree"}):
        assert w.pedigree_numbers(row["params"]["people"]) == {pid: k + 1 for k, pid in enumerate(drawn_order(row))}, row["id"]


def test_pedigree():
    seen = set()
    for row, qs in asked("bio.pedigree"):
        p = row["params"]
        order = drawn_order(row)
        people = {x["id"]: x for x in p["people"]}
        kids = {i: [x for x in p["people"] if x["parents"] and i in x["parents"]] for i in people}
        couples = {tuple(x["parents"]) for x in p["people"] if x["parents"]}
        assert qs, row["id"]
        for q in qs:
            if "dominant or a recessive" in q.stem:
                dominant = p["mode"] == "AD"
                assert picked(q).startswith("dominant" if dominant else "recessive")
                # only asked where the chart proves it
                assert any(people[a]["affected"] == dominant and people[b]["affected"] == dominant
                           and any(k["affected"] != dominant for k in kids[a] if k in kids[b]) for a, b in couples)
                seen.add("mode")
            m = re.search(r"genotype of person (\d+)", q.stem)
            if m:
                x = people[order[int(m.group(1)) - 1]]
                near = [people[i] for i in (x["parents"] or [])] + kids[x["id"]]
                g = picked(q)
                if p["mode"] == "AR":
                    assert g == ("aa" if x["affected"] else "Aa")
                    assert x["affected"] or any(y["affected"] for y in near)
                elif p["mode"] == "AD":
                    assert g == ("Dd" if x["affected"] else "dd")
                    assert not x["affected"] or any(not y["affected"] for y in near)
                elif x["sex"] == "m":
                    assert g == ("XᵃY" if x["affected"] else "XᴬY")
                else:
                    assert g == ("XᵃXᵃ" if x["affected"] else "XᴬXᵃ")
                    assert x["affected"] or any(y["affected"] and y["sex"] == "m" for y in near)
                seen.add(p["mode"])
    assert seen == {"mode", "AR", "AD", "XR"}


Z = {"H": 1, "He": 2, "Li": 3, "Be": 4, "B": 5, "C": 6, "N": 7, "O": 8, "F": 9, "Ne": 10, "Na": 11, "Mg": 12, "Al": 13, "Si": 14,
     "P": 15, "S": 16, "Cl": 17, "Ar": 18, "K": 19, "Ca": 20}
IONS = {("O", -2): "an oxide ion, O²⁻", ("S", -2): "a sulfide ion, S²⁻", ("N", -3): "a nitride ion, N³⁻", ("F", -1): "a fluoride ion, F⁻",
        ("Cl", -1): "a chloride ion, Cl⁻", ("Na", 1): "a sodium ion, Na⁺", ("Li", 1): "a lithium ion, Li⁺", ("K", 1): "a potassium ion, K⁺",
        ("Mg", 2): "a magnesium ion, Mg²⁺", ("Ca", 2): "a calcium ion, Ca²⁺", ("Be", 2): "a beryllium ion, Be²⁺",
        ("Al", 3): "an aluminium ion, Al³⁺"}


def test_electron_shells():
    seen = set()
    for row, qs in asked("chem.electron_shells"):
        p = row["params"]
        assert qs or (p["symbol"], p["charge"]) == ("H", -1), row["id"]  # H⁻ is not taught at IGCSE
        for q in qs:
            if "electronic configuration" in q.stem:
                n, shells = Z[p["symbol"]] - p["charge"], []
                for cap in (2, 8, 8, 2):
                    if n > 0:
                        shells.append(min(cap, n))
                        n -= min(cap, n)
                assert q.answer == ",".join(map(str, shells)), (row["id"], q.answer)
                seen.add("config")
            if "Which particle" in q.stem:
                assert p["nucleus"] == "particles"
                if p["charge"]:
                    assert picked(q) == IONS[(p["symbol"], p["charge"])]
                else:
                    assert picked(q).endswith(" atom") and p["symbol"] not in picked(q)
                    assert sum(o.endswith(" atom") for o in q.options) >= 2
                seen.add("particle")
            if "mass number" in q.stem:
                n = int(next(lab[:-1] for lab in row["labels"] if re.fullmatch(r"\d+n", lab)))
                assert p["nucleus"] == "particles" and int(q.answer) == Z[p["symbol"]] + n
                seen.add("mass")
    assert seen == {"config", "particle", "mass"}


SERIES = {"ethanol": "Alcohols", "ethane-1,2-diol": "Alcohols", "ethyl ethanoate": "Esters", "butane": "Alkanes",
          "2,2-dimethylpropane": "Alkanes", "propene": "Alkenes", "penta-1,3-diene": "Alkenes", "ethanoic acid": "Carboxylic acids",
          "propanone": "Ketones", "ethanal": "Aldehydes", "methylamine": "Amines", "bromoethane": "Halogenoalkanes"}
MIXED = {"prop-2-en-1-ol", "2-hydroxypropanoic acid", "aspirin", "propenoic acid", "benzaldehyde", "ethyl propenoate",
         "2-aminoethanoic acid", "ethanoic anhydride", "benzene", "cyclohexene", "phenol", "methoxymethane"}
FORMULA = {"benzene": "C6H6", "cyclohexene": "C6H10", "ethanenitrile": "C2H3N", "methylamine": "CH5N", "ethyl ethanoate": "C4H8O2",
           "chloromethane": "CH3Cl", "methane": "CH4", "propan-2-ol": "C3H8O", "butanal": "C4H8O", "1-iodobutane": "C4H9I"}
IGCSE_NAMES = re.compile(r"^(meth|eth|prop|but)(ane|ene|anol|an-[12]-ol|anoic acid)$|^but-[12]-ene$"
                         r"|^(methyl|ethyl|propyl|butyl) (methan|ethan|propan|butan)oate$")


def drawn_formula(labels):
    """The molecular formula from the atoms the drawing shows: C, H, then the rest alphabetically."""
    n = {}
    for lab in labels:
        for el, k in re.findall(r"(Cl|Br|[A-Z])(\d*)", lab):
            n[el] = n.get(el, 0) + int(k or 1)
    order = ["C", "H"] + sorted(e for e in n if e not in ("C", "H"))
    return "".join(e + (str(n[e]) if n[e] > 1 else "") for e in order if e in n)


def test_molecule():
    seen = set()
    for row, qs in asked("chem.molecule"):
        p = row["params"]
        for q in qs:
            if "name of this compound" in q.stem:
                assert picked(q) == p["name"]
                if row["qualification"] == "igcse":
                    assert all(IGCSE_NAMES.match(o) for o in q.options), q.options
                seen.add("name")
            if "homologous series" in q.stem:
                assert p["name"] not in MIXED
                if p["name"] in SERIES:
                    assert picked(q) == SERIES[p["name"]]
                seen.add("series")
            if "molecular formula" in q.stem:
                if p["mode"] != "skeletal":
                    assert q.answer == drawn_formula(row["labels"]), (p["name"], q.answer, row["labels"])
                if p["name"] in FORMULA:
                    assert q.answer == FORMULA[p["name"]]
                seen.add("formula")
    assert seen == {"name", "series", "formula"}


# --- batch 5: inequality regions, motion graphs, cumulative frequency, Punnett squares -------------

def satisfies(cons, x, y):
    ops = {"<": lambda u, v: u < v, "<=": lambda u, v: u <= v, ">": lambda u, v: u > v, ">=": lambda u, v: u >= v}
    return all(ops[op](a * x + b * y, c) for a, b, c, op in cons)


def on_a_line(cons, x, y):
    return any(abs(a * x + b * y - c) < 1e-9 for a, b, c, _ in cons)


def parsed(text):
    """An option's inequalities as a test of (x, y): '2y ≥ x, x + y < 9' -> callable. Test-only, our own strings."""
    parts = [t.strip() for t in text.replace(" and ", ", ").split(",")]
    exprs = []
    for t in parts:
        e = t.replace("≤", "<=").replace("≥", ">=").replace("−", "-")
        e = re.sub(r"(\d)([xy])", r"\1*\2", e)
        exprs.append(e)
    return lambda x, y: all(eval(e, {}, {"x": x, "y": y}) for e in exprs)


def test_inequality_region():
    seen = set()
    for row, qs in asked("math.inequality_region"):
        p = row["params"]
        cons, (lo, hi) = p["cons"], p["window"]
        grid = [(lo + i / 2, lo + j / 2) for i in range(2 * (hi - lo) + 1) for j in range(2 * (hi - lo) + 1)]
        assert qs, row["id"]
        for q in qs:
            if "Which point lies in the region R" in q.stem:
                pts = [tuple(nums(o)) for o in q.options]
                key = pts[int(q.answer)]
                assert satisfies(cons, *key) and not on_a_line(cons, *key)
                assert all(not satisfies(cons, *pt) and not on_a_line(cons, *pt) for k, pt in enumerate(pts) if k != int(q.answer))
                seen.add("point")
            if "define the region R" in q.stem:
                for k, o in enumerate(q.options):
                    same = all(parsed(o)(x, y) == satisfies(cons, x, y) for x, y in grid)
                    assert same == (k == int(q.answer)), (row["id"], o)
                seen.add("set")
            got = re.search(r"greatest possible value of (.+)\?", q.stem)
            if got:
                obj = got.group(1).replace("−", "-")
                val = lambda x, y: eval(re.sub(r"(\d)([xy])", r"\1*\2", obj), {}, {"x": x, "y": y})
                inside = [(x, y) for x in range(lo, hi + 1) for y in range(lo, hi + 1) if satisfies(cons, x, y)]
                assert int(q.answer) == max(val(x, y) for x, y in inside), (row["id"], q.answer)
                seen.add("max")
    assert seen == {"point", "set", "max"}


def motion(p):
    """Each segment's start and end time, start and end speed, and distance: speed changes evenly over a segment,
    except on the distance-time graphs marked constant, where each segment is at its own steady speed."""
    t, v, out = 0, p["v0"], []
    for d, end in p["segments"]:
        if p.get("constant"):
            out.append((t, t + d, end, end, end * d))
        else:
            out.append((t, t + d, v, end, (v + end) / 2 * d))
        t, v = t + d, end
    return out


def test_motion_graph():
    seen = set()
    for row, qs in asked("phys.motion_graph"):
        p = row["params"]
        segs = motion(p)
        assert qs, row["id"]
        for q in qs:
            span = re.search(r"between t = ([\d.]+) s and t = ([\d.]+) s", q.stem)
            seg = next((s for s in segs if span and (s[0], s[1]) == (float(span.group(1)), float(span.group(2)))), None)
            if "acceleration" in q.stem or "deceleration" in q.stem:
                assert p["kind"] == "speed-time" and seg
                a = (seg[3] - seg[2]) / (seg[1] - seg[0])
                assert a != 0 and abs(float(q.answer) - abs(a)) <= q.tolerance + 1e-9
                assert ("deceleration" in q.stem) == (a < 0)
                seen.add("acc")
            if "total distance" in q.stem:
                assert abs(float(q.answer) - sum(s[4] for s in segs)) <= q.tolerance + 1e-9
                seen.add("dist")
            if "What is the speed between" in q.stem:
                assert p["kind"] == "distance-time" and seg and seg[2] == seg[3]
                assert abs(float(q.answer) - seg[2]) <= q.tolerance + 1e-9
                seen.add("speed")
    assert seen == {"acc", "dist", "speed"}


def cumulative(row):
    p = row["params"]
    xs = [float(x) for x in row["labels"][:len(p["freqs"]) + 1]]
    cum = [0]
    for f in p["freqs"]:
        cum.append(cum[-1] + f)
    return xs, cum


def at(xs, cum, target):
    for k in range(1, len(cum)):
        if cum[k] >= target:
            return xs[k - 1] + (target - cum[k - 1]) / (cum[k] - cum[k - 1]) * (xs[k] - xs[k - 1])


def test_cumulative_frequency():
    seen = set()
    for row, qs in asked("math.cumulative_frequency"):
        p = row["params"]
        xs, cum = cumulative(row)
        n, width = cum[-1], xs[1] - xs[0]
        assert qs, row["id"]
        for q in qs:
            less = re.search(r"were ([\d.]+) [^?]* or less\?", q.stem)
            more = re.search(r"more than ([\d.]+)", q.stem)
            if less:
                assert int(q.answer) == cum[xs.index(float(less.group(1)))]
                seen.add("less")
            elif more:
                assert int(q.answer) == n - cum[xs.index(float(more.group(1)))]
                seen.add("more")
            if "median" in q.stem:
                assert q.tolerance <= width / 4 and abs(float(q.answer) - at(xs, cum, n / 2)) <= q.tolerance
                seen.add("median")
            if "interquartile range" in q.stem:
                assert p["lines"] == "quartiles"
                iqr = at(xs, cum, 3 * n / 4) - at(xs, cum, n / 4)
                assert q.tolerance <= width / 2 and abs(float(q.answer) - iqr) <= q.tolerance
                seen.add("iqr")
    assert seen == {"less", "more", "median", "iqr"}


def gametes(genotype, kind):
    if kind == "dihybrid":
        a, b = genotype[:2], genotype[2:]
        return [x + y for x in a for y in b]
    return re.findall(r"I[ABO]|X[A-Za-z]|Y|[A-Za-z]", genotype)


def phenotype(child, p):
    kind = p["kind"]
    if kind == "blood":
        al = set(re.findall(r"I[ABO]", child))
        return "AB" if {"IA", "IB"} <= al else "A" if "IA" in al else "B" if "IB" in al else "O"
    if kind == "sex":
        xs = re.findall(r"X([A-Za-z])", child)
        sex = "female" if len(xs) == 2 else "male"
        return f"{p['dominant'] if any(c.isupper() for c in xs) else p['recessive']} {sex}"
    if kind == "dihybrid":
        genes = [[c for c in child if c.lower() == g] for g in dict.fromkeys(c.lower() for c in child)]
        return ", ".join(p["dominant"][k] if any(c.isupper() for c in g) else p["recessive"][k] for k, g in enumerate(genes))
    return p["dominant"] if any(c.isupper() for c in child) else p["recessive"]


def test_punnett():
    from fractions import Fraction
    seen = set()
    for row, qs in asked("bio.punnett"):
        p = row["params"]
        a, b = p["parents"]
        kids = [phenotype(x + y, p) for x in gametes(a, p["kind"]) for y in gametes(b, p["kind"])]
        genos = ["".join(sorted(x + y, key=lambda c: (c.islower(), c))) for x in gametes(a, p["kind"]) for y in gametes(b, p["kind"])]
        assert qs or (len(set(kids)) == 1 and p["kind"] in ("sex", "dihybrid")), row["id"]
        for q in qs:
            got = re.search(r"probability that an offspring (?:has blood group|is an?|is) (.+?)\?", q.stem)
            if got and "heterozygous" not in q.stem:
                want = Fraction(sum(k == got.group(1).replace(" and ", ", ") for k in kids), len(kids))
                assert 0 < want < 1 and Fraction(q.answer) == want, (row["id"], got.group(1), q.answer, want)
                seen.add("prob")
            got = re.search(r"ratio of (.+) to (.+) offspring", q.stem)
            if got:
                assert p["show"] != "full"
                x, y = (sum(k == g for k in kids) for g in got.groups())
                assert [int(v) for v in q.answer.split(":")] == [x // math.gcd(x, y), y // math.gcd(x, y)]
                seen.add("ratio")
            if "genotype of every offspring" in q.stem:
                assert p["kind"] == "mono" and len(set(genos)) == 1 and picked(q) == genos[0]
                seen.add("one genotype")
            if "heterozygous" in q.stem:
                het = Fraction(sum(g[0] != g[1] for g in genos), len(genos))
                assert p["kind"] == "mono" and len(set(kids)) == 1 and 0 < het < 1 and Fraction(q.answer) == het
                seen.add("het")
            if "blood group do all" in q.stem:
                assert len(set(kids)) == 1 and picked(q) == kids[0]
                seen.add("one group")
    assert {"prob", "ratio", "one genotype", "het"} <= seen
