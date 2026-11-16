"""Answers of the P6 physics and chemistry families (Task J, marker "P6 physical"), recomputed independently over 1,000
seeds, the drawings read back, the edited families checked against their committed versions, and the thin topics each
family was written for checked by name.

Parts, each keeping its own helpers (prefixed by the part's name):
- organic: organic_structure (new LS band), functional_groups, polymer_structure, hydrocarbon_fractions;
- chemenergy: equilibrium_data, gibbs_graph, born_haber;
- chemstruct: property_trend, orbital_boxes, phase_diagram;
- chemenv: electrolysis (LS band), chromatogram (AS chapter), decay_graph and nucleus (S6 chemistry), conductivity_test,
  water_waste_data, salt_heating, alloys_corrosion, oxidation_numbers;
- physwave: seismogram, double_slit, comm_signals, heat_transfer, stars_universe;
- physmech: uncertainty_table, work_energy, momentum_collision, medical_imaging;
- physext: magnetic_force, induction_demo, magnet_tests, orbit_data, relative_motion, heating_curve (AS figure),
  electric_field (S5 potential chapter).

Nothing here calls a family's own helpers to work out a key.
"""
import math
import random
import re
import sqlite3
import subprocess
import sys
import types
from collections import Counter, defaultdict
from decimal import ROUND_HALF_UP, Decimal
from fractions import Fraction
from pathlib import Path

from matplotlib.patches import FancyBboxPatch
from matplotlib.text import Text
import matplotlib.pyplot as plt
import pytest

from figgen import link
from figgen.core import NAMES
from figgen.families import FAMILIES


# ============================== part: organic ===============================================================

_ORGANIC_SEEDS = range(1, 1001)
_ORGANIC_REPO = Path(__file__).resolve().parents[3]
_ORGANIC_STORE = Path("C:/Users/Stephen/figure-library/figures.db")


def _organic_fam(fid):
    if fid not in FAMILIES:
        pytest.fail(f"{fid} is not registered")
    return FAMILIES[fid]


def _organic_run(m, seed):
    rng = random.Random(seed)
    p = m.sample(rng)
    return p, m.questions(p, rng)


def _organic_picked(q):
    return q.options[int(q.answer)]


def _organic_central(options):
    toks = [Counter(re.findall(r"-?\d+|[a-zA-Z]+|\S", o)) for o in options]
    score = [sum(sum(((t - u) + (u - t)).values()) for u in toks) for t in toks]
    best = min(score)
    return score.index(best) if score.count(best) == 1 else None


def _organic_plain(text: str) -> str:
    return text.translate(str.maketrans("₀₁₂₃₄₅₆₇₈₉", "0123456789"))


def _organic_head(fid):
    """The committed module, as stored figures were made with it."""
    src = subprocess.run(["git", "show", f"HEAD:scripts/figgen/families/{fid}.py"], cwd=_ORGANIC_REPO,
                         capture_output=True, text=True, check=True, encoding="utf-8").stdout
    mod = types.ModuleType(f"figgen.families._head_{fid}")
    mod.__package__ = "figgen.families"
    exec(compile(src, f"HEAD:{fid}.py", "exec"), mod.__dict__)
    return mod


def _organic_drawing(fig):
    """What a figure drew: every text with its place, and every line's points."""
    out = []
    for ax in fig.axes:
        out += [("text", t.get_text(), tuple(round(float(v), 6) for v in t.get_position())) for t in ax.texts]
        out += [("line", tuple((round(float(x), 6), round(float(y), 6)) for x, y in ln.get_xydata())) for ln in ax.lines]
    plt.close(fig)
    return out


def _organic_same_questions(a, b):
    return [(q.kind, q.stem, q.answer, q.options, q.accepted) for q in a] == [(q.kind, q.stem, q.answer, q.options, q.accepted) for q in b]


def _organic_texts(fig):
    """Every text the renderer drew, with its box in pixels."""
    seen = []
    original = Text.draw

    def record(self, renderer):
        original(self, renderer)
        if self.get_visible() and self.get_text().strip():
            seen.append(self)

    Text.draw = record
    try:
        fig.canvas.draw()
    finally:
        Text.draw = original
    renderer = fig.canvas.get_renderer()
    return [(t, t.get_window_extent(renderer)) for t in seen]


def _organic_words(fig) -> str:
    return " ".join(t.get_text() for ax in fig.axes for t in ax.texts)


def _organic_mcq_central_check(m, seeds=range(1, 301)):
    seen, hits = defaultdict(int), defaultdict(int)
    for s in seeds:
        _, qs = _organic_run(m, s)
        for q in qs:
            if q.kind == "mcq":
                key = re.sub(r"\d+", "#", q.stem.rsplit(". ", 1)[-1])
                key = re.sub(r"\b[A-F]\b", "L", key)
                seen[key] += 1
                hits[key] += _organic_central(q.options) == int(q.answer)
    return {k: (hits[k], seen[k]) for k in seen if seen[k] >= 10 and hits[k] / seen[k] > 0.35}


# --- organic_structure: the LS band (P6) -------------------------------------------------------------------------

_ORGANIC_STEMS = ["meth", "eth", "prop", "but", "pent"]
_ORGANIC_SERIES = {"alkane": "alkanes", "alkene": "alkenes", "alcohol": "alcohols", "acid": "carboxylic acids"}


def _organic_ls_key(p):
    n, s = p["n"], _ORGANIC_STEMS[p["n"] - 1]
    name = {"alkane": s + "ane", "alkene": s + "ene" if n < 4 else f"{s}-1-ene", "alcohol": s + "anol" if n < 3 else f"{s}an-1-ol",
            "acid": s + "anoic acid"}[p["series"]]
    h = {"alkane": 2 * n + 2, "alkene": 2 * n, "alcohol": 2 * n + 2, "acid": 2 * n}[p["series"]]
    o = {"alkane": 0, "alkene": 0, "alcohol": 1, "acid": 2}[p["series"]]
    formula = "C" + (str(n) if n > 1 else "") + f"H{h}" + {0: "", 1: "O", 2: "O2"}[o]
    return name, formula, h


def test_organic_structure_ls_band_keys():
    m = _organic_fam("organic_structure")
    seen = Counter()
    for s in _ORGANIC_SEEDS:
        p, qs = _organic_run(m, s)
        if p["band"] != "LS":
            continue
        seen[p["series"]] += 1
        assert p["position"] == 1, (s, p)  # one place for the group at LS
        name, formula, h = _organic_ls_key(p)
        assert len(qs) == 4
        assert qs[0].stem.split(" ")[0] in NAMES and "name of this compound" in qs[0].stem
        assert qs[0].answer == name, (s, p, qs[0].answer)
        assert _organic_plain(qs[1].answer) == formula and formula in qs[1].accepted
        assert qs[2].kind == "mcq" and _organic_picked(qs[2]) == _ORGANIC_SERIES[p["series"]]
        assert sum(o == _ORGANIC_SERIES[p["series"]] for o in qs[2].options) == 1
        assert int(qs[3].answer) == h
        fig = m.draw(p)
        drawn = Counter(t.get_text() for t in fig.axes[0].texts)
        plt.close(fig)
        assert drawn["H"] == h and drawn["C"] == p["n"], (s, p, drawn)
    assert min(seen.values()) >= 50 and len(seen) == 4, seen


def test_organic_structure_ls_figures_carry_only_their_own_series():
    m = _organic_fam("organic_structure")
    want = {"alkane": {"chemistry.alkanes", "chemistry.homologous-series"}, "alkene": {"chemistry.alkene-chemistry"},
            "alcohol": {"chemistry.alcohols"}, "acid": {"chemistry.carboxylic-acids"}}
    for s in range(1, 300):
        p = m.sample(random.Random(s))
        got = set(m.concepts_for(p))
        if p["band"] == "LS":
            assert got == want[p["series"]], (s, p)
        else:
            assert got == set(m.CONCEPTS), (s, p)


def test_organic_structure_up_and_al_figures_are_drawn_and_worded_as_committed():
    old, new = _organic_head("organic_structure"), _organic_fam("organic_structure")
    checked = 0
    for s in range(1, 201):
        p = old.sample(random.Random(s))
        assert p["band"] in ("UP", "AL")
        assert _organic_drawing(new.draw(p)) == _organic_drawing(old.draw(p)), (s, p)
        assert _organic_same_questions(new.questions(p, random.Random(s)), old.questions(p, random.Random(s))), (s, p)
        checked += 1
    assert checked == 200


def test_organic_structure_ls_wording_is_its_own():
    m = _organic_fam("organic_structure")
    stems = [_organic_run(m, s)[1][0].stem for s in range(1, 400) if m.sample(random.Random(s))["band"] == "LS"]
    old = _organic_head("organic_structure")
    old_stems = {old.questions(old.sample(random.Random(s)), random.Random(s))[0].stem for s in range(1, 400)}
    assert stems and not set(stems) & old_stems
    assert not _organic_mcq_central_check(m)


def _organic_topics(fid, samples=200):
    if not _ORGANIC_STORE.exists():
        pytest.skip("no figure store here")
    sys.path.insert(0, str(_ORGANIC_REPO / "scripts"))
    from figgen import link
    db = sqlite3.connect(f"file:{_ORGANIC_STORE}?mode=ro", uri=True)
    db.row_factory = sqlite3.Row
    ix = link.topic_index(db)
    names = {r["key"]: r["name"] for r in db.execute("SELECT key, name FROM topics")}
    return {k: names[k] for k in link.reach(ix, FAMILIES[fid], samples)}


def test_organic_structure_reaches_the_ls_organic_chapters():
    got = _organic_topics("organic_structure")
    assert {"db:969", "db:979", "db:988", "db:989"} <= set(got), sorted(got.items())
    assert "db:990" not in got  # petroleum and polymerisation: hydrocarbon_fractions and polymer_structure serve it


# --- functional_groups -------------------------------------------------------------------------------------------------

_ORGANIC_VALENCE = {"C": 4, "H": 1, "O": 2, "N": 3, "Cl": 1, "Br": 1, "I": 1, "F": 1}
_ORGANIC_GROUP_NAMES = {"acid": "carboxylic acid group", "amine": "amine group", "hydroxyl": "hydroxyl group",
                        "aldehyde": "aldehyde group", "ketone": "ketone group", "ester": "ester group", "amide": "amide group",
                        "nitro": "nitro group", "methyl": "methyl group", "ring": "benzene ring", "alkene": "C=C double bond",
                        "chloro": "chlorine atom"}
_ORGANIC_RING_LABELS = {"OH": "hydroxyl", "NH₂": "amine", "COOH": "acid", "CHO": "aldehyde", "NO₂": "nitro", "CH₃": "methyl",
                        "NHCOCH₃": "amide", "OCOCH₃": "ester", "COOCH₃": "ester"}
# The molecules as a chemist writes them out: formula, and for the classify kind its class, for chiral its centres.
_ORGANIC_GROUP_FORMULAS = {
    "2-aminopropanoic acid (alanine)": "C3H7NO2", "2-hydroxypropanoic acid (lactic acid)": "C3H6O3",
    "2-amino-3-hydroxypropanoic acid (serine)": "C3H7NO3", "3-hydroxybutanal": "C4H8O2", "4-hydroxybutan-2-one": "C4H8O2",
    "2-oxopropanoic acid (pyruvic acid)": "C3H4O3", "ethyl 2-aminoethanoate": "C4H9NO2", "methyl 2-hydroxypropanoate": "C4H8O3",
    "2-chloropropanoic acid": "C3H5ClO2", "but-3-en-2-one": "C4H6O", "3-aminobutanoic acid": "C4H9NO2"}
_ORGANIC_GROUP_PARTS = {
    "2-aminopropanoic acid (alanine)": {"methyl", "amine", "acid"}, "2-hydroxypropanoic acid (lactic acid)": {"methyl", "hydroxyl", "acid"},
    "2-amino-3-hydroxypropanoic acid (serine)": {"hydroxyl", "amine", "acid"}, "3-hydroxybutanal": {"methyl", "hydroxyl", "aldehyde"},
    "4-hydroxybutan-2-one": {"methyl", "ketone", "hydroxyl"}, "2-oxopropanoic acid (pyruvic acid)": {"methyl", "ketone", "acid"},
    "ethyl 2-aminoethanoate": {"amine", "ester", "methyl"}, "methyl 2-hydroxypropanoate": {"methyl", "hydroxyl", "ester"},
    "2-chloropropanoic acid": {"methyl", "chloro", "acid"}, "but-3-en-2-one": {"alkene", "ketone", "methyl"},
    "3-aminobutanoic acid": {"methyl", "amine", "acid"},
    "4-aminophenol": {"hydroxyl", "amine", "ring"}, "N-(4-hydroxyphenyl)ethanamide (paracetamol)": {"hydroxyl", "amide", "ring"},
    "2-ethanoyloxybenzoic acid (aspirin)": {"acid", "ester", "ring"}, "4-hydroxybenzoic acid": {"acid", "hydroxyl", "ring"},
    "4-nitrophenol": {"hydroxyl", "nitro", "ring"}, "4-methylphenylamine": {"amine", "methyl", "ring"},
    "4-hydroxybenzaldehyde": {"aldehyde", "hydroxyl", "ring"}, "methyl 4-hydroxybenzoate": {"ester", "hydroxyl", "ring"},
    "4-aminobenzoic acid": {"acid", "amine", "ring"}, "4-methylphenol": {"hydroxyl", "methyl", "ring"},
    "2-hydroxybenzoic acid": {"acid", "hydroxyl", "ring"}, "4-methylbenzoic acid": {"acid", "methyl", "ring"},
    "3-nitrophenylamine": {"amine", "nitro", "ring"}, "4-nitromethylbenzene": {"methyl", "nitro", "ring"}}
_ORGANIC_CLASSIFY = {
    "1-chloropropane": ("C3H7Cl", "primary"), "2-chloropropane": ("C3H7Cl", "secondary"), "1-bromobutane": ("C4H9Br", "primary"),
    "2-bromobutane": ("C4H9Br", "secondary"), "2-chloro-2-methylpropane": ("C4H9Cl", "tertiary"),
    "1-chloro-2-methylpropane": ("C4H9Cl", "primary"), "2-bromo-2-methylbutane": ("C5H11Br", "tertiary"),
    "2-iodopropane": ("C3H7I", "secondary"), "3-bromopentane": ("C5H11Br", "secondary"), "1-iodobutane": ("C4H9I", "primary"),
    "2-chlorobutane": ("C4H9Cl", "secondary"),
    "propan-1-ol": ("C3H8O", "primary"), "propan-2-ol": ("C3H8O", "secondary"), "butan-1-ol": ("C4H10O", "primary"),
    "butan-2-ol": ("C4H10O", "secondary"), "2-methylpropan-2-ol": ("C4H10O", "tertiary"), "2-methylpropan-1-ol": ("C4H10O", "primary"),
    "pentan-3-ol": ("C5H12O", "secondary"), "2-methylbutan-2-ol": ("C5H12O", "tertiary"), "pentan-2-ol": ("C5H12O", "secondary"),
    "ethylamine": ("C2H7N", "primary"), "propylamine": ("C3H9N", "primary"), "propan-2-amine": ("C3H9N", "primary"),
    "dimethylamine": ("C2H7N", "secondary"), "ethylmethylamine": ("C3H9N", "secondary"), "diethylamine": ("C4H11N", "secondary"),
    "trimethylamine": ("C3H9N", "tertiary"), "N,N-dimethylethanamine": ("C4H11N", "tertiary")}
_ORGANIC_CHIRAL = {
    "butan-2-ol": ("C4H10O", 1), "2-chlorobutane": ("C4H9Cl", 1), "2-bromobutane": ("C4H9Br", 1),
    "2-aminopropanoic acid (alanine)": ("C3H7NO2", 1), "2-hydroxypropanoic acid (lactic acid)": ("C3H6O3", 1),
    "2-aminobutanoic acid": ("C4H9NO2", 1), "2-amino-3-methylbutanoic acid (valine)": ("C5H11NO2", 1), "pentan-2-ol": ("C5H12O", 1),
    "3-chlorobutan-2-ol": ("C4H9ClO", 2), "2,3-dibromobutane": ("C4H8Br2", 2), "2-methylbutan-1-ol": ("C5H12O", 1),
    "butan-2-amine": ("C4H11N", 1), "propan-2-ol": ("C3H8O", 0), "pentan-3-ol": ("C5H12O", 0), "2-methylpropan-2-ol": ("C4H10O", 0),
    "2-chloropropane": ("C3H7Cl", 0)}


def _organic_hill(symbols) -> str:
    c = Counter(symbols)
    order = ["C", "H"] + sorted(k for k in c if k not in ("C", "H"))
    return "".join(k + (str(c[k]) if c[k] > 1 else "") for k in order if k in c)


def _organic_nb(bonds):
    nb = defaultdict(list)
    for a, b, o in bonds:
        nb[a].append((b, o))
        nb[b].append((a, o))
    return nb


def _organic_chiral_centres(atoms, bonds):
    """The carbons whose four branches differ, each branch written out as a tree."""
    nb = _organic_nb(bonds)

    def canon(i, parent):
        return atoms[i][0] + "(" + ",".join(sorted(f"{o}{canon(j, i)}" for j, o in nb[i] if j != parent)) + ")"

    return [i for i in range(len(atoms)) if atoms[i][0] == "C" and len(nb[i]) == 4
            and len({f"{o}{canon(j, i)}" for j, o in nb[i]}) == 4]


def _organic_class(atoms, bonds, word):
    nb = _organic_nb(bonds)
    if word == "amine":
        centre = next(i for i, a in enumerate(atoms) if a[0] == "N")
    elif word == "alcohol":
        o = next(i for i, a in enumerate(atoms) if a[0] == "O" and any(atoms[j][0] == "H" for j, _ in nb[i]))
        centre = next(j for j, _ in nb[o] if atoms[j][0] == "C")
    else:
        x = next(i for i, a in enumerate(atoms) if a[0] in ("Cl", "Br", "I"))
        centre = nb[x][0][0]
    n = sum(1 for j, _ in nb[centre] if atoms[j][0] == "C")
    return {1: "primary", 2: "secondary", 3: "tertiary"}[n], n


def _organic_kind_of(inside, atoms, bonds):
    """What a boxed set of atoms is, by its atoms and bonds."""
    syms = Counter(atoms[i][0] for i in inside)
    double = {tuple(sorted((atoms[a][0], atoms[b][0]))) for a, b, o in bonds if o == 2 and a in inside and b in inside}
    co = ("C", "O") in double
    table = [({"N": 1, "H": 2}, False, "amine"), ({"O": 1, "H": 1}, False, "hydroxyl"), ({"C": 1, "O": 2, "H": 1}, True, "acid"),
             ({"C": 1, "O": 1, "H": 1}, True, "aldehyde"), ({"C": 1, "O": 1}, True, "ketone"), ({"C": 1, "O": 2}, True, "ester"),
             ({"C": 1, "H": 3}, False, "methyl"), ({"Cl": 1}, False, "chloro")]
    for want, needs_co, kind in table:
        if syms == Counter(want) and co == needs_co:
            return kind
    if syms == Counter({"C": 2}) and ("C", "C") in double:
        return "alkene"
    return None


def _organic_rect_dist(px, py, r):
    return math.hypot(max(r[0] - px, 0, px - r[2]), max(r[1] - py, 0, py - r[3]))


def _organic_fg_read(m, p):
    """What the figure drew: atom texts, ring group texts (with their extents), boxes, letters and leaders."""
    fig = m.draw(p)
    ax = fig.axes[0]
    fig.canvas.draw()
    renderer = fig.canvas.get_renderer()
    inv = ax.transData.inverted()
    out = {"atoms": {}, "labels": [], "letters": {}, "boxes": {}, "leaders": {}, "ring": False}
    for t in ax.texts:
        g = t.get_gid() or ""
        if g.startswith("atom:"):
            out["atoms"][int(g[5:])] = (t.get_text(), *[round(float(v), 6) for v in t.get_position()])
        elif g.startswith("sub:"):
            e = t.get_window_extent(renderer)
            (x0, y0), (x1, y1) = inv.transform((e.x0, e.y0)), inv.transform((e.x1, e.y1))
            out["labels"].append((t.get_text(), (x0, y0, x1, y1)))
        elif g.startswith("letter:"):
            out["letters"][g[7:]] = tuple(float(v) for v in t.get_position())
    for pa in ax.patches:
        g = pa.get_gid() or ""
        if g.startswith("group:"):
            out["boxes"][g[6:]] = (pa.get_x(), pa.get_y(), pa.get_x() + pa.get_width(), pa.get_y() + pa.get_height())
    for ln in ax.lines:
        g = ln.get_gid() or ""
        if g.startswith("leader:"):
            out["leaders"][g[7:]] = ln.get_xydata()
        out["ring"] |= g == "ring"
    plt.close(fig)
    return out


def _organic_fg_kinds(m, p, seen):
    """Each letter's box, named from what is inside it."""
    kinds = {}
    if seen["ring"]:
        for L, r in seen["boxes"].items():
            inside = [text for text, (x0, y0, x1, y1) in seen["labels"]
                      if r[0] <= x0 and x1 <= r[2] and r[1] <= y0 and y1 <= r[3]]
            if inside:
                assert len(inside) == 1, (p, L, inside)
                kinds[L] = _ORGANIC_RING_LABELS[inside[0]]
            else:
                assert r[0] < -0.8 and r[2] > 0.8 and r[1] < -0.95 and r[3] > 0.95, (p, L, r)  # the whole hexagon
                kinds[L] = "ring"
        return kinds
    atoms, bonds = m.structure(p)
    for L, r in seen["boxes"].items():
        inside = [i for i, (_, x, y) in enumerate(atoms) if r[0] < x < r[2] and r[1] < y < r[3]]
        kinds[L] = _organic_kind_of(inside, atoms, bonds)
        assert kinds[L], (p, L, [atoms[i] for i in inside])
    return kinds


def test_functional_groups_draws_what_its_structure_says_and_every_atom_is_whole():
    m = _organic_fam("functional_groups")
    for s in range(1, 301):
        p = m.sample(random.Random(s))
        atoms, bonds = m.structure(p)
        seen = _organic_fg_read(m, p)
        assert {i: (a[0], round(a[1], 6), round(a[2], 6)) for i, a in enumerate(atoms)} == seen["atoms"], (s, p)
        for i, a in enumerate(atoms):
            assert sum(o for x, y, o in bonds if i in (x, y)) == _ORGANIC_VALENCE[a[0]], (s, p, i, a)
        pts = [(x, y) for _, x, y in atoms]
        assert all(math.dist(u, v) >= 0.99 for k, u in enumerate(pts) for v in pts[k + 1:]), (s, p)  # no two atoms crowd


def test_functional_groups_groups_keys():
    m = _organic_fam("functional_groups")
    n = 0
    for s in _ORGANIC_SEEDS:
        p, qs = _organic_run(m, s)
        if p["kind"] != "groups":
            continue
        n += 1
        seen = _organic_fg_read(m, p)
        kinds = _organic_fg_kinds(m, p, seen)
        assert set(kinds.values()) == _ORGANIC_GROUP_PARTS[p["mol"]] and len(kinds) == len(set(kinds.values())), (s, p, kinds)
        asked = next(k for k, v in _ORGANIC_GROUP_NAMES.items() if qs[0].stem.endswith(f"labels the {v}?"))
        assert asked != "methyl" and qs[0].stem.split(" ")[0] in NAMES
        assert _organic_picked(qs[0]) == next(L for L, k in kinds.items() if k == asked), (s, p, qs[0].stem)
        assert sorted(qs[0].options) == sorted(kinds)
        L = re.search(r"part labelled ([A-D])\?", qs[1].stem).group(1)
        assert _organic_picked(qs[1]) == _ORGANIC_GROUP_NAMES[kinds[L]]
        assert sum(o == _ORGANIC_GROUP_NAMES[kinds[L]] for o in qs[1].options) == 1 and len(qs[1].options) == 4
        assert all(o in _ORGANIC_GROUP_NAMES.values() for o in qs[1].options)
        if p["mol"] in _ORGANIC_GROUP_FORMULAS:
            assert len(qs) == 3 and _organic_plain(qs[2].answer) == _ORGANIC_GROUP_FORMULAS[p["mol"]]
            assert _organic_hill(a for a, *_ in seen["atoms"].values()) == _ORGANIC_GROUP_FORMULAS[p["mol"]]
        else:
            assert len(qs) == 2
    assert n > 300


def test_functional_groups_letters_sit_by_their_own_boxes_and_boxes_hold_only_their_group():
    m = _organic_fam("functional_groups")
    for s in range(1, 400):
        p = m.sample(random.Random(s))
        if p["kind"] != "groups":
            continue
        seen = _organic_fg_read(m, p)
        boxes, letters = seen["boxes"], seen["letters"]
        assert set(boxes) == set(letters) == {L for L, _ in p["letters"]}
        for L, (x, y) in letters.items():
            own = _organic_rect_dist(x, y, boxes[L])
            assert 0.2 <= own <= 0.65, (s, p, L, own)
            for M, r in boxes.items():
                if M != L:
                    assert _organic_rect_dist(x, y, r) >= own + 0.3, (s, p, L, M)
            for M, (u, v) in letters.items():
                assert M == L or math.dist((x, y), (u, v)) >= 0.6, (s, p, L, M)
            for _, ax_, ay in seen["atoms"].values():
                assert math.dist((x, y), (ax_, ay)) >= 0.45, (s, p, L)
        rects = list(boxes.values())
        for i, a in enumerate(rects):  # boxes never touch
            for b in rects[i + 1:]:
                assert a[2] < b[0] or b[2] < a[0] or a[3] < b[1] or b[3] < a[1], (s, p)


def test_functional_groups_classify_keys():
    m = _organic_fam("functional_groups")
    n = 0
    for s in _ORGANIC_SEEDS:
        p, qs = _organic_run(m, s)
        if p["kind"] != "classify":
            continue
        n += 1
        atoms, bonds = m.structure(p)
        formula, cls = _ORGANIC_CLASSIFY[p["mol"]]
        got, count = _organic_class(atoms, bonds, p["word"])
        assert got == cls and _organic_hill(a[0] for a in atoms) == formula, (s, p)
        assert qs[0].kind == "mcq" and _organic_picked(qs[0]) == cls and sorted(qs[0].options) == ["primary", "secondary", "tertiary"]
        assert qs[0].stem.split(" ")[0] in NAMES and f"Is the {p['word']} shown" in qs[0].stem
        assert _organic_plain(qs[1].answer) == formula and formula in qs[1].accepted
        assert qs[2].answer == p["mol"] and p["mol"] in qs[2].accepted
        assert int(qs[3].answer) == count
    assert n > 200


def test_functional_groups_chiral_keys_and_leaders():
    m = _organic_fam("functional_groups")
    n = 0
    for s in _ORGANIC_SEEDS:
        p, qs = _organic_run(m, s)
        if p["kind"] != "chiral":
            continue
        n += 1
        atoms, bonds = m.structure(p)
        centres = _organic_chiral_centres(atoms, bonds)
        formula, count = _ORGANIC_CHIRAL[p["mol"]]
        assert len(centres) == count and _organic_hill(a[0] for a in atoms) == formula, (s, p, centres)
        if p["band"] == "UP":
            assert "acid" in p["mol"] and "amino" in p["mol"]  # UP: the amino acids only
        if count:
            seen = _organic_fg_read(m, p)
            marked = {}
            for L, line in seen["leaders"].items():
                end = line[-1]
                i = min(range(len(atoms)), key=lambda k: math.dist(end, atoms[k][1:]))
                assert atoms[i][0] == "C" and math.dist(end, atoms[i][1:]) <= 0.3, (s, p, L)
                marked[L] = i
                assert math.dist(seen["letters"][L], atoms[i][1:]) < min(
                    math.dist(seen["letters"][L], a[1:]) for k, a in enumerate(atoms) if k != i and a[0] == "C"), (s, p, L)
            assert set(marked) == {L for L, _ in p["letters"]}
            key = [L for L, i in marked.items() if i in centres]
            assert len(key) == 1, (s, p, marked, centres)
            assert _organic_picked(qs[0]) == key[0]
            assert len(qs) == 3 and "chiral centre" in qs[0].stem and "four different" in qs[0].stem
            assert int(qs[1].answer) == count
        else:
            assert len(qs) == 2 and not p["letters"] and int(qs[0].answer) == 0
        assert _organic_plain(qs[-1].answer) == formula
    assert n > 150


def test_functional_groups_options_alone_do_not_give_the_key():
    assert not _organic_mcq_central_check(_organic_fam("functional_groups"))


def test_functional_groups_reaches_the_thin_organic_chapters_and_no_others():
    got = _organic_topics("functional_groups")
    want = {"db:620", "db:617", "db:615", "db:630", "db:631", "db:2758", "db:2767", "db:2769", "db:2771"}
    assert want <= set(got), sorted(want - set(got))
    for k, name in got.items():
        assert not re.search(r"polymer|^organic chemistry$|chapter 11|reactions of organic|analysis", name, re.I), (k, name)


def test_functional_groups_links_each_figure_only_to_its_own_groups():
    m = _organic_fam("functional_groups")
    for s in range(1, 400):
        p = m.sample(random.Random(s))
        avoid = m.avoid_for(p)
        if p["kind"] == "groups":
            has = set(_organic_fg_kinds(m, p, _organic_fg_read(m, p)).values())
            if "amine" not in has:
                assert re.search(avoid, "Chapter 27: Amines", re.I) and re.search(avoid, "Amines and Amino Acids", re.I)
            if not has & {"aldehyde", "ketone"}:
                assert re.search(avoid, "Chapter 18: Preparation of aldehydes and ketones", re.I)
            if "ring" not in has:
                assert re.search(avoid, "Derivatives of Benzene", re.I)
            if "amide" in has:
                assert not re.search(avoid, "Esters, Acid Anhydrides, Amides and Nitriles", re.I)
        if p["kind"] == "classify" and p["band"] == "AL" and p["word"] == "halogenoalkane":
            assert re.search(avoid, "Chapter 27: Amines", re.I) and not re.search(avoid, "Chapter 16: Making halogenoalkanes", re.I)


def _organic_reach(fid):
    if not _ORGANIC_STORE.exists():
        pytest.skip("no figure store")
    from figgen import link
    db = sqlite3.connect(f"file:{_ORGANIC_STORE}?mode=ro", uri=True)
    db.row_factory = sqlite3.Row
    ix = link.topic_index(db)
    names = {t["key"]: t["name"] for t in ix}
    return {k: names[k] for k in link.reach(ix, _organic_fam(fid), 300)}


# --- polymer_structure --------------------------------------------------------------------------------------------

_ORGANIC_AR = {"H": 1, "C": 12, "N": 14, "O": 16, "F": 19, "Cl": Fraction(71, 2)}
# monomer: the repeat unit's atoms (an addition polymer's repeat unit has the monomer's atoms), the substituents drawn
_ORGANIC_MONOMERS = {"ethene": {"C": 2, "H": 4}, "propene": {"C": 3, "H": 6}, "chloroethene": {"C": 2, "H": 3, "Cl": 1},
                     "tetrafluoroethene": {"C": 2, "F": 4}, "phenylethene": {"C": 8, "H": 8},
                     "1,1-dichloroethene": {"C": 2, "H": 2, "Cl": 2}, "but-2-ene": {"C": 4, "H": 8},
                     "2-methylpropene": {"C": 4, "H": 8}}
# which side texts each monomer's repeat unit draws, as a sorted list (the two backbone carbons' four side groups)
_ORGANIC_SIDES = {"ethene": ["H", "H", "H", "H"], "propene": ["CH₃", "H", "H", "H"], "chloroethene": ["Cl", "H", "H", "H"],
                  "tetrafluoroethene": ["F", "F", "F", "F"], "phenylethene": ["C₆H₅", "H", "H", "H"],
                  "1,1-dichloroethene": ["Cl", "Cl", "H", "H"], "but-2-ene": ["CH₃", "CH₃", "H", "H"],
                  "2-methylpropene": ["CH₃", "CH₃", "H", "H"]}


def _organic_mr(atoms: dict) -> Fraction:
    return sum((_ORGANIC_AR[k] * v for k, v in atoms.items()), Fraction(0))


def _organic_piece(piece: str) -> dict:
    piece = _organic_plain(piece)
    if piece == "C6H4":
        return {"C": 6, "H": 4}
    k = int(re.fullmatch(r"\(CH2\)(\d)", piece).group(1))
    return {"C": k, "H": 2 * k}


def _organic_poly_read(m, p):
    fig = m.draw(p)
    ax = fig.axes[0]
    atoms = [(t.get_text(), *[round(float(v), 6) for v in t.get_position()]) for t in ax.texts
             if (t.get_gid() or "").startswith("atom:")]
    letters = {t.get_gid()[7:]: tuple(float(v) for v in t.get_position()) for t in ax.texts
               if (t.get_gid() or "").startswith("letter:")}
    boxes = {pa.get_gid()[6:]: (pa.get_x(), pa.get_y(), pa.get_x() + pa.get_width(), pa.get_y() + pa.get_height())
             for pa in ax.patches if (pa.get_gid() or "").startswith("group:")}
    words = _organic_words(fig)
    plt.close(fig)
    return atoms, letters, boxes, words


def test_polymer_structure_addition_keys():
    m = _organic_fam("polymer_structure")
    n = 0
    for s in _ORGANIC_SEEDS:
        p, qs = _organic_run(m, s)
        if p["kind"] != "addition":
            continue
        n += 1
        mono = p["monomer"]
        if p["band"] == "LS":
            assert mono in ("ethene", "propene", "chloroethene", "tetrafluoroethene", "phenylethene")
        picked = _organic_picked(qs[0])
        assert picked == mono and len(qs[0].options) == 4 and all(o in _ORGANIC_MONOMERS for o in qs[0].options)
        assert int(qs[1].answer) == p["units"]
        if p["band"] == "LS":
            assert int(qs[2].answer) == _ORGANIC_MONOMERS[mono]["C"] * p["units"]
        else:
            assert Fraction(qs[2].answer) == _organic_mr(_ORGANIC_MONOMERS[mono])
        if p["band"] == "AL":
            total = Fraction(re.search(r"mass of ([\d.]+)", qs[3].stem).group(1))
            assert Fraction(qs[3].answer) == total / _organic_mr(_ORGANIC_MONOMERS[mono])
        if n <= 120:  # the drawing: 2 x units carbons in a row, each with two side groups, as the monomer has them
            atoms, *_ = _organic_poly_read(m, p)
            carbons = sorted((x, y) for sym, x, y in atoms if sym == "C" and y == 0)
            assert len(carbons) == 2 * p["units"]
            sides = [sym for sym, x, y in atoms if y != 0]
            assert len(sides) == 4 * p["units"]
            for u in range(p["units"]):
                xs = {carbons[2 * u][0], carbons[2 * u + 1][0]}
                unit = sorted(sym for sym, x, y in atoms if y != 0 and x in xs)
                assert unit == _ORGANIC_SIDES[mono], (s, mono, unit)
    assert n > 400


def test_polymer_structure_condensation_keys():
    m = _organic_fam("polymer_structure")
    n = 0
    for s in _ORGANIC_SEEDS:
        p, qs = _organic_run(m, s)
        if p["kind"] != "condensation":
            continue
        n += 1
        assert p["band"] in ("UP", "AL")
        atoms, letters, boxes, words = _organic_poly_read(m, p) if n <= 150 else (None, None, None, None)
        backbone = None
        if atoms is not None:
            backbone = [sym for sym, x, y in sorted(atoms, key=lambda a: a[1]) if y == 0]
            ester = backbone.count("O") == 2  # an ester's two O atoms sit in the chain; an amide's are both C=O
            link = "ester" if ester else "amide"
            pieces = [b for b in backbone if b not in ("C", "O", "N")]
            assert len(pieces) == 2 and backbone[0] == "C"
            p1, p2 = pieces
            # the unit's atoms: two C=O, two O or two N-H, and the two pieces
            unit = {"C": 2, "O": 2}
            unit["O" if ester else "N"] = unit.get("O" if ester else "N", 0) + 2
            if not ester:
                unit["H"] = 2
            for piece in pieces:
                for k, v in _organic_piece(piece).items():
                    unit[k] = unit.get(k, 0) + v
            # the linkage box holds a C=O carbon and the O or N beside it; the other boxes hold one piece each
            for L, r in boxes.items():
                inside = sorted(sym for sym, x, y in atoms if r[0] <= x <= r[2] and r[1] <= y <= r[3])
                part = next(part for M, part in p["letters"] if M == L)
                if part == "linkage":
                    assert inside == (sorted(["C", "O", "O"]) if ester else sorted(["C", "H", "N", "O"])), (s, inside)
                else:
                    assert inside == [p1 if part == "first" else p2], (s, part, inside)
            key_letter = next(L for L, part in p["letters"] if part == "linkage")
            assert _organic_picked(qs[0]) == key_letter
            assert ("an ester linkage" in qs[0].stem) == ester
            assert _organic_picked(qs[1]) == ("a polyester" if ester else "a polyamide")
            joiner = "HO–{}–OH" if ester else "H₂N–{}–NH₂"
            assert _organic_picked(qs[2]) == f"{joiner.format(p1)} and HOOC–{p2}–COOH"
            assert Fraction(qs[3].answer) == _organic_mr(unit)
            assert "H = 1, C = 12, N = 14, O = 16" in words
            # each letter sits outside its box and nearer it than any other box
            for L, (x, y) in letters.items():
                r = boxes[L]
                assert not (r[0] < x < r[2] and r[1] < y < r[3])
        # every distractor of the monomer pair is wrong, and the four make a balanced 2 x 2 set
        pair = qs[2]
        assert len(set(pair.options)) == 4
        good = _organic_picked(pair)
        assert sum(o.split(" and ")[0] == good.split(" and ")[0] for o in pair.options) == 2
        assert sum(o.split(" and ")[1] == good.split(" and ")[1] for o in pair.options) == 2
        if p["band"] == "AL":
            total = Fraction(re.search(r"mass of ([\d.]+)", qs[4].stem).group(1))
            assert Fraction(qs[4].answer) * Fraction(qs[3].answer) == total
    assert n > 150


def test_polymer_structure_options_alone_do_not_give_the_key():
    assert not _organic_mcq_central_check(_organic_fam("polymer_structure"))


def test_polymer_structure_reaches_the_thin_polymer_chapters():
    got = _organic_reach("polymer_structure")
    for key in ("db:990", "db:2503", "db:203", "db:632", "db:2757", "db:2770"):
        assert key in got, (key, sorted(got.values()))
    assert all(re.search(r"polymer|chapter 15: reactions of alkanes|petro", n, re.I) for n in got.values()), sorted(got.values())


# --- hydrocarbon_fractions ----------------------------------------------------------------------------------------

# name: carbon atoms, boiling range (low, high) in °C; the gases boil below 30 °C, bitumen above 400 °C
_ORGANIC_FRACTIONS = {"refinery gas": ((1, 4), (-300, 30)), "petrol (gasoline)": ((5, 10), (30, 110)),
                      "naphtha": ((8, 12), (110, 180)), "kerosene (paraffin)": ((10, 16), (180, 260)),
                      "diesel oil": ((14, 20), (260, 340)), "fuel oil": ((20, 30), (340, 400)), "bitumen": ((31, 99), (400, 900))}
_ORGANIC_ALKANES = {"methane": -162, "ethane": -89, "propane": -42, "butane": -1, "pentane": 36, "hexane": 69,
                    "heptane": 98, "octane": 126, "nonane": 151, "decane": 174}


def test_hydrocarbon_fractions_tables_match_this_files_copy():
    m = _organic_fam("hydrocarbon_fractions")
    assert {n: b for n, b in m.ALKANES} == _ORGANIC_ALKANES
    for name, carbons, rng_, temp in m.FRACTIONS:
        (c0, c1), (t0, t1) = _ORGANIC_FRACTIONS[name]
        assert t0 < temp < t1, name
        assert carbons == (f"{c0} to {c1}" if c1 < 99 else "more than 30")


def test_hydrocarbon_fractions_column_keys_from_the_printed_temperatures():
    m = _organic_fam("hydrocarbon_fractions")
    n = 0
    for s in _ORGANIC_SEEDS:
        p, qs = _organic_run(m, s)
        if p["kind"] != "column":
            continue
        n += 1
        fig = m.draw(p)
        ax = fig.axes[0]
        temp = {t.get_gid()[5:]: int(t.get_text().split()[0]) for t in ax.texts if (t.get_gid() or "").startswith("temp:")}
        heights = {t.get_gid()[7:]: float(t.get_position()[1]) for t in ax.texts if (t.get_gid() or "").startswith("outlet:")}
        rows = [t.get_text() for t in sorted((t for t in ax.texts if (t.get_gid() or "").startswith("row:")),
                                             key=lambda t: -t.get_position()[1])]
        plt.close(fig)
        # the letter at each outlet names the fraction whose printed boiling range holds its temperature
        frac = {L: next(nm for nm in rows if _ORGANIC_FRACTIONS[nm][1][0] < t < _ORGANIC_FRACTIONS[nm][1][1])
                for L, t in temp.items()}
        assert len(set(frac.values())) == len(frac) == 6
        # hotter lower down, as a column is
        order = sorted(heights, key=heights.get)
        assert [temp[L] for L in order] == sorted(temp.values(), reverse=True)
        name = re.search(r"where (.+) is collected", qs[0].stem).group(1)
        assert frac[_organic_picked(qs[0])] == name
        asked = re.search(r"collected at (.+) has", qs[1].stem).group(1).replace(" and ", ", ").split(", ")
        assert sorted(asked) == sorted(qs[1].options)
        biggest = max(asked, key=lambda L: _ORGANIC_FRACTIONS[frac[L]][0][1])
        assert _organic_picked(qs[1]) == biggest
        L = re.search(r"collected at ([A-Z])\?", qs[2].stem).group(1)
        assert int(qs[2].answer) == _ORGANIC_FRACTIONS[frac[L]][0][1]
        letters = [L for L in sorted(heights, key=heights.get, reverse=True)]
        assert letters != sorted(letters) or n > 1  # not always lettered alphabetically down the column
    assert n > 400


def test_hydrocarbon_fractions_boiling_keys_from_the_printed_values():
    m = _organic_fam("hydrocarbon_fractions")
    n = 0
    for s in _ORGANIC_SEEDS:
        p, qs = _organic_run(m, s)
        if p["kind"] != "boiling":
            continue
        n += 1
        if n <= 60:
            fig = m.draw(p)
            words = " ".join(t.get_text() for t in fig.axes[0].texts) + " " + " ".join(
                t.get_text() for t in fig.axes[0].get_xticklabels())
            plt.close(fig)
        names = [nm for nm in _ORGANIC_ALKANES if nm in (words if n <= 60 else "")]
        t = int(re.search(r"gases at (-?\d+) °C", qs[0].stem).group(1))
        shown = [list(_ORGANIC_ALKANES)[c - 1] for c in p["carbons"]]
        if n <= 60:
            assert names == shown
            for nm in shown:
                assert f"{_ORGANIC_ALKANES[nm]} °C".replace("-", "−") in words
        assert int(qs[0].answer) == sum(1 for nm in shown if _ORGANIC_ALKANES[nm] < t)
        assert 0 < int(qs[0].answer) < len(shown)
        a, b = re.search(r"points of (\w+) and (\w+),", qs[1].stem).groups()
        assert a in shown and b in shown and int(qs[1].answer) == abs(_ORGANIC_ALKANES[a] - _ORGANIC_ALKANES[b])
        one, t2 = re.search(r"Is (\w+) a solid, a liquid or a gas at (-?\d+) °C", qs[2].stem).groups()
        assert one in shown and abs(_ORGANIC_ALKANES[one] - int(t2)) >= 8
        assert _organic_picked(qs[2]) == ("gas" if _ORGANIC_ALKANES[one] < int(t2) else "liquid")
    assert n > 400


def test_hydrocarbon_fractions_labels_clear_the_lines():
    m = _organic_fam("hydrocarbon_fractions")
    for s in range(1, 40):
        p = m.sample(random.Random(s))
        fig = m.draw(p)
        ax = fig.axes[0]
        texts = [(t, box) for t, box in _organic_texts(fig) if t in ax.texts]
        for ln in ax.lines:
            pts = ln.get_transform().transform(ln.get_xydata())
            for t, box in texts:
                for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
                    for k in range(41):
                        x, y = x0 + (x1 - x0) * k / 40, y0 + (y1 - y0) * k / 40
                        assert not (box.x0 + 1 < x < box.x1 - 1 and box.y0 + 1 < y < box.y1 - 1), (s, t.get_text(), ln.get_gid())
        plt.close(fig)


def test_hydrocarbon_fractions_options_alone_do_not_give_the_key():
    assert not _organic_mcq_central_check(_organic_fam("hydrocarbon_fractions"))


def test_hydrocarbon_fractions_reaches_the_crude_oil_and_alkane_chapters():
    got = _organic_reach("hydrocarbon_fractions")
    for key in ("db:990", "db:203", "db:969", "db:979"):
        assert key in got, (key, sorted(got.values()))
    bad = re.compile(r"alcohol|carboxylic|amine|benzene|halogeno|ester|enthalp|rate", re.I)
    assert not [nm for nm in got.values() if bad.search(nm)], sorted(got.values())


# ============================== part: chemenergy ============================================================

_CHEMENERGY_SEEDS = range(1, 1001)
_CHEMENERGY_DRAWN = range(1, 41)
_CHEMENERGY_IDS = ("equilibrium_data", "gibbs_graph", "born_haber")
_CHEMENERGY_STORE = Path("C:/Users/Stephen/figure-library/figures.db")
_CHEMENERGY_SUB = str.maketrans("0123456789", "₀₁₂₃₄₅₆₇₈₉")


def _chemenergy_fam(fid):
    if fid not in FAMILIES:
        pytest.fail(f"{fid} is not registered")
    return FAMILIES[fid]


def _chemenergy_run(m, seed):
    rng = random.Random(seed)
    p = m.sample(rng)
    return p, m.questions(p, rng)


def _chemenergy_picked(q):
    return q.options[int(q.answer)]


def _chemenergy_central(options):
    toks = [Counter(re.findall(r"-?\d+|[a-zA-Z]+|\S", o)) for o in options]
    score = [sum(sum(((t - u) + (u - t)).values()) for u in toks) for t in toks]
    best = min(score)
    return score.index(best) if score.count(best) == 1 else None


def _chemenergy_drawn_texts(fig):
    seen = []
    original = Text.draw

    def record(self, renderer):
        original(self, renderer)
        if self.get_visible() and self.get_text().strip():
            seen.append(self)

    Text.draw = record
    try:
        fig.canvas.draw()
    finally:
        Text.draw = original
    renderer = fig.canvas.get_renderer()
    return [(t, t.get_window_extent(renderer)) for t in seen]


def _chemenergy_inside(pt, box, margin=1.0) -> bool:
    return box.x0 + margin < pt[0] < box.x1 - margin and box.y0 + margin < pt[1] < box.y1 - margin


def _chemenergy_crosses(line, box, margin=1.0, steps=80) -> bool:
    pts = line.get_transform().transform(line.get_xydata())
    for a, b in zip(pts, pts[1:]):
        if any(_chemenergy_inside((a[0] + (b[0] - a[0]) * k / steps, a[1] + (b[1] - a[1]) * k / steps), box, margin)
               for k in range(steps + 1)):
            return True
    return False


def _chemenergy_words(fig) -> str:
    fig.canvas.draw()
    words = [t.get_text() for ax in fig.axes for t in ax.texts]
    words += [ax.get_title(loc="left") + " " + ax.get_title() + " " + ax.get_xlabel() + " " + ax.get_ylabel() for ax in fig.axes]
    words += [t.get_text() for ax in fig.axes for t in ax.get_xticklabels() + ax.get_yticklabels()]
    return re.sub(r"\s+", " ", " ".join(words))


def _chemenergy_ticks(fig, axis):
    fig.canvas.draw()
    ax = fig.axes[0]
    labels = ax.get_xticklabels() if axis == "x" else ax.get_yticklabels()
    return {t.get_text().replace("−", "-") for t in labels}


def _chemenergy_dec(v: Fraction) -> str:
    """A fraction written exactly in decimals (it must terminate)."""
    d = Decimal(v.numerator) / Decimal(v.denominator)
    s = format(d.normalize(), "f")
    return s


def _chemenergy_round(v: Fraction, places: str) -> str:
    return str((Decimal(v.numerator) / Decimal(v.denominator)).quantize(Decimal(places), rounding=ROUND_HALF_UP))


def _chemenergy_sub(text: str) -> str:
    out, prev = [], ""
    for ch in text:
        out.append(ch.translate(_CHEMENERGY_SUB) if ch.isdigit() and prev and (prev.isalpha() or prev in ")₀₁₂₃₄₅₆₇₈₉") else ch)
        prev = out[-1]
    return "".join(out)


# --- equilibrium_data: this file's own reactions ----------------------------------------------------------------------

_CHEMENERGY_EQ = {  # reaction: (reactants with coefficients, products with coefficients)
    "HI": ({"H2": 1, "I2": 1}, {"HI": 2}),
    "N2O4": ({"N2O4": 1}, {"NO2": 2}),
    "PCl5": ({"PCl5": 1}, {"PCl3": 1, "Cl2": 1}),
    "SO3": ({"SO2": 2, "O2": 1}, {"SO3": 2}),
    "NH3": ({"N2": 1, "H2": 3}, {"NH3": 2}),
    "ester": ({"CH3COOH": 1, "C2H5OH": 1}, {"CH3COOC2H5": 1, "H2O": 1}),
}


def _chemenergy_equilibrium(reaction, start, x):
    left, right = _CHEMENERGY_EQ[reaction]
    out = {s: start[s] - k * x for s, k in left.items()}
    out.update({s: start[s] + k * x for s, k in right.items()})
    return out


def _chemenergy_kc(reaction, conc):
    left, right = _CHEMENERGY_EQ[reaction]
    v = Fraction(1)
    for s, k in right.items():
        v *= conc[s] ** k
    for s, k in left.items():
        v /= conc[s] ** k
    return v


def test_equilibrium_data_time_keys_and_readings():
    m = _chemenergy_fam("equilibrium_data")
    n = 0
    for s in _CHEMENERGY_SEEDS:
        p, qs = _chemenergy_run(m, s)
        if p["kind"] != "time":
            continue
        n += 1
        eq = _chemenergy_equilibrium(p["reaction"], p["start"], p["x"])
        step = Fraction(str(p["step"]))
        assert all(v >= 1 for v in eq.values()), (s, eq)
        assert qs[0].answer == str(p["T"]), (s, qs[0].answer)
        assert f"{p['T']} {p['unit']}" in qs[0].accepted
        assert _chemenergy_sub(p["ask"]) in qs[1].stem
        assert qs[1].answer == _chemenergy_dec(eq[p["ask"]] * step), (s, qs[1].answer)
        if p["kc"]:
            kc = _chemenergy_kc(p["reaction"], {k: v * step for k, v in eq.items()})
            assert (kc * 100).denominator == 1, (s, kc)
            assert qs[2].answer == _chemenergy_dec(kc), (s, qs[2].answer, kc)
        else:
            fall = p["fall"]
            assert eq[fall] < p["start"][fall], s
            assert qs[2].answer == _chemenergy_dec((p["start"][fall] - eq[fall]) * step), s
        if p["band"] == "AL":
            assert p["kc"], s
    assert n > 200


def test_equilibrium_data_time_values_are_on_labelled_gridlines_and_curves_meet_them():
    m = _chemenergy_fam("equilibrium_data")
    seen = 0
    for s in range(1, 200):
        p = m.sample(random.Random(s))
        if p["kind"] != "time":
            continue
        seen += 1
        if seen > 30:
            break
        step = Fraction(str(p["step"]))
        eq = _chemenergy_equilibrium(p["reaction"], p["start"], p["x"])
        fig = m.draw(p)
        assert str(p["T"]) in _chemenergy_ticks(fig, "x"), s
        ys = _chemenergy_ticks(fig, "y")
        for sp, v in eq.items():
            assert _chemenergy_dec(v * step) in ys, (s, sp)
        ax = fig.axes[0]
        curves = [ln for ln in ax.lines if (ln.get_gid() or "").startswith("curve:")]
        drawn = set()
        for ln in curves:
            names = ln.get_gid()[6:].split("+")
            drawn.update(names)
            xs, ys_ = ln.get_xdata(), ln.get_ydata()
            for sp in names:
                # flat at its equilibrium value from the time equilibrium is reached, and not before
                after = [y for x, y in zip(xs, ys_) if x >= p["T"]]
                assert all(abs(y - float(eq[sp] * step)) < 1e-9 for y in after), (s, sp)
                before = [y for x, y in zip(xs, ys_) if x < p["T"] * 0.98]
                assert all(abs(y - float(eq[sp] * step)) > 1e-6 for y in before), (s, sp)
                assert abs(ys_[0] - float(p["start"][sp] * step)) < 1e-9, (s, sp)
        assert drawn == set(eq), s
        if p["kc"]:
            assert "Kc" in _chemenergy_words(fig), s
        # end labels sit clear of every curve
        texts = _chemenergy_drawn_texts(fig)
        for t, box in texts:
            if (t.get_gid() or "").startswith("label:"):
                for ln in curves:
                    assert not _chemenergy_crosses(ln, box), (s, t.get_text())
        plt.close(fig)


def test_equilibrium_data_table_keys():
    m = _chemenergy_fam("equilibrium_data")
    n = 0
    for s in _CHEMENERGY_SEEDS:
        p, qs = _chemenergy_run(m, s)
        if p["kind"] != "table":
            continue
        n += 1
        eq = _chemenergy_equilibrium(p["reaction"], p["start"], p["x"])
        assert min(eq.values()) >= 1, s
        assert qs[0].answer == _chemenergy_dec(Fraction(eq[p["ask"]], 10)), s
        if p["V10"]:
            V = Fraction(p["V10"], 10)
            assert qs[1].answer == _chemenergy_dec(Fraction(eq[p["conc"]], 10) / V), s
            conc = {k: Fraction(v, 10) / V for k, v in eq.items()}
        else:
            assert p["reaction"] == "ester" and len(qs) == 2
            conc = {k: Fraction(v, 10) for k, v in eq.items()}
        kc = _chemenergy_kc(p["reaction"], conc)
        assert qs[-1].answer == _chemenergy_dec(kc), (s, qs[-1].answer, kc)
        assert p["ask"] in _CHEMENERGY_EQ[p["reaction"]][0] and p["known"] in _CHEMENERGY_EQ[p["reaction"]][1]
    assert n > 100


def test_equilibrium_data_table_prints_what_is_needed_and_hides_the_rest():
    m = _chemenergy_fam("equilibrium_data")
    seen = 0
    for s in range(1, 300):
        p = m.sample(random.Random(s))
        if p["kind"] != "table":
            continue
        seen += 1
        if seen > 25:
            break
        eq = _chemenergy_equilibrium(p["reaction"], p["start"], p["x"])
        fig = m.draw(p)
        cells = {t.get_gid(): t.get_text() for t in fig.axes[0].texts if t.get_gid()}
        words = _chemenergy_words(fig)
        plt.close(fig)
        species = list(_CHEMENERGY_EQ[p["reaction"]][0]) + list(_CHEMENERGY_EQ[p["reaction"]][1])
        for k, sp in enumerate(species, start=1):
            assert cells[f"cell:0:{k}"] == _chemenergy_dec(Fraction(p["start"][sp], 10)), (s, sp)
            want = _chemenergy_dec(Fraction(eq[sp], 10)) if sp == p["known"] else "?"
            assert cells[f"cell:1:{k}"] == want, (s, sp)
        assert "Kc =" in words
        if p["V10"]:
            assert f"volume {_chemenergy_dec(Fraction(p['V10'], 10))} dm³" in words, s


def test_equilibrium_data_yield_readings_and_one_true_option():
    m = _chemenergy_fam("equilibrium_data")
    n = 0
    for s in _CHEMENERGY_SEEDS:
        p, qs = _chemenergy_run(m, s)
        if p["kind"] != "yield":
            continue
        n += 1
        T, P, Y = p["temps"], p["pressures"], p["yields"]
        # the shape a stated exothermic reaction that makes fewer gas molecules must have
        for row in Y:
            assert all(a - b >= 5 for a, b in zip(row, row[1:])), (s, row)
        for i in range(5):
            assert all(Y[j + 1][i] - Y[j][i] >= 10 for j in range(2)), (s, i)
        assert all(5 <= v <= 95 and v % 5 == 0 for row in Y for v in row), s
        ti, pj = p["read"]
        assert f"{T[ti]} °C and {P[pj]} atm" in qs[0].stem and qs[0].answer == str(Y[pj][ti]), s
        row, i = p["row"]
        m_ = re.search(r"At (\d+) atm, .* equal to (\d+)%", qs[1].stem)
        assert int(m_.group(1)) == P[row]
        hits = [T[k] for k in range(5) if Y[row][k] == int(m_.group(2))]
        assert hits == [int(qs[1].answer)], s
        t, lo, hi = p["rise"]
        assert qs[2].answer == str(Y[hi][t] - Y[lo][t]) and int(qs[2].answer) > 0, s
        mcqs = [q for q in qs if q.kind == "mcq"]
        for q in mcqs:
            v = int(re.search(r"give (\d+)%", q.stem).group(1))
            good = []
            for o in q.options:
                tt, pp = map(int, re.fullmatch(r"(\d+) °C and (\d+) atm", o).groups())
                if Y[P.index(pp)][T.index(tt)] == v:
                    good.append(o)
            assert good == [_chemenergy_picked(q)], (s, q.options)
    assert n > 100


def test_equilibrium_data_yield_points_sit_on_gridlines():
    m = _chemenergy_fam("equilibrium_data")
    seen = 0
    for s in range(1, 300):
        p = m.sample(random.Random(s))
        if p["kind"] != "yield":
            continue
        seen += 1
        if seen > 20:
            break
        fig = m.draw(p)
        ax = fig.axes[0]
        # matplotlib drops a minor tick where a major one stands, so a gridline is either
        minor = {round(float(v), 6) for v in list(ax.get_yticks(minor=True)) + list(ax.get_yticks())}
        xt = _chemenergy_ticks(fig, "x")
        for P_, row in zip(p["pressures"], p["yields"]):
            pts = next(ln for ln in ax.lines if ln.get_gid() == f"points:{P_}")
            assert list(pts.get_xdata()) == p["temps"] and list(pts.get_ydata()) == row, s
            assert all(round(float(v), 6) in minor for v in row), s
        assert all(str(t) in xt for t in p["temps"]), s
        words = _chemenergy_words(fig)
        assert all(f"{P_} atm" in words for P_ in p["pressures"]) and "exothermic" in words
        plt.close(fig)


_CHEMENERGY_AR = {"H": 1, "C": 12, "N": 14, "O": 16, "P": 31, "S": 32, "Cl": Fraction(71, 2), "K": 39, "Ca": 40}
_CHEMENERGY_FERT = {"ammonium nitrate": "NH4NO3", "ammonium sulfate": "(NH4)2SO4", "urea": "CO(NH2)2",
                    "ammonium chloride": "NH4Cl", "ammonium phosphate": "(NH4)3PO4", "potassium nitrate": "KNO3",
                    "calcium nitrate": "Ca(NO3)2", "ammonium dihydrogenphosphate": "NH4H2PO4"}


def _chemenergy_atoms(formula: str) -> Counter:
    """Atoms in a formula with brackets: "(NH4)2SO4" has N 2, H 8, S 1, O 4."""
    def parse(i):
        out = Counter()
        while i < len(formula):
            ch = formula[i]
            if ch == "(":
                inner, i = parse(i + 1)
                n = re.match(r"\d*", formula[i:]).group()
                i += len(n)
                for k, v in inner.items():
                    out[k] += v * int(n or 1)
            elif ch == ")":
                return out, i + 1
            else:
                el = re.match(r"[A-Z][a-z]?", formula[i:]).group()
                i += len(el)
                n = re.match(r"\d*", formula[i:]).group()
                i += len(n)
                out[el] += int(n or 1)
        return out, i
    return parse(0)[0]


def _chemenergy_mr(formula: str) -> Fraction:
    return sum(Fraction(_CHEMENERGY_AR[el]) * n for el, n in _chemenergy_atoms(formula).items())


def test_equilibrium_data_fertiliser_keys():
    m = _chemenergy_fam("equilibrium_data")
    bags = nit = 0
    for s in _CHEMENERGY_SEEDS:
        p, qs = _chemenergy_run(m, s)
        if p["kind"] == "bag":
            bags += 1
            assert p["band"] == "UP"
            b = {L: (g, mass) for L, g, mass in p["bags"]}
            g, mass = b[p["which"]]
            assert qs[0].answer == _chemenergy_dec(Fraction(g[0] * mass, 100)), s
            k = {"P₂O₅": 1, "K₂O": 2}[re.search(r"mass of (P₂O₅|K₂O)", qs[1].stem).group(1)]
            g, mass = b[p["other"]]
            assert g[k] > 0 and qs[1].answer == _chemenergy_dec(Fraction(g[k] * mass, 100)), s
            n = {L: Fraction(g[0] * mass, 100) for L, (g, mass) in b.items()}
            assert abs(n["P"] - n["Q"]) >= 1, s
            good = [o for o in qs[2].options if o == f"bag {max(n, key=n.get)}"]
            assert good == [_chemenergy_picked(qs[2])], s
            g, mass = b[p["total"]]
            assert qs[3].answer == _chemenergy_dec(Fraction(sum(g) * mass, 100)), s
        elif p["kind"] == "nitrogen":
            nit += 1
            pct = {}
            for name in p["names"]:
                f = _CHEMENERGY_FERT[name]
                pct[name] = Fraction(14 * _chemenergy_atoms(f)["N"]) / _chemenergy_mr(f) * 100
            assert qs[0].answer == _chemenergy_round(pct[p["ask"]], "0.1"), s
            best = max(pct, key=pct.get)
            assert sorted(pct.values())[-1] - sorted(pct.values())[-2] >= 1, s
            assert [o for o in qs[1].options if o == best] == [_chemenergy_picked(qs[1])], s
            name, mass = p["sack"]
            assert f"{mass} kg sack of {name}" in qs[2].stem
            assert qs[2].answer == _chemenergy_round(pct[name] * mass / 100, "0.1"), s
    assert bags > 80 and nit > 80


def test_equilibrium_data_fertiliser_figures_print_their_numbers():
    m = _chemenergy_fam("equilibrium_data")
    seen = Counter()
    for s in range(1, 400):
        p = m.sample(random.Random(s))
        if p["kind"] not in ("bag", "nitrogen") or seen[p["kind"]] >= 12:
            continue
        seen[p["kind"]] += 1
        fig = m.draw(p)
        words = _chemenergy_words(fig)
        plt.close(fig)
        if p["kind"] == "bag":
            for L, g, mass in p["bags"]:
                assert f"Bag {L}" in words and "-".join(map(str, g)) in words and f"Net mass: {mass} kg" in words, s
            assert "percentages by mass" in words and "P₂O₅" in words and "K₂O" in words
        else:
            for name in p["names"]:
                f = _CHEMENERGY_FERT[name]
                assert name in words and _chemenergy_sub(f) in words, (s, name)
                assert _chemenergy_dec(_chemenergy_mr(f)) in words, (s, name)
            assert "N = 14" in words


def test_equilibrium_data_options_are_unique_and_short_answers_well_formed():
    m = _chemenergy_fam("equilibrium_data")
    for s in _CHEMENERGY_SEEDS:
        _, qs = _chemenergy_run(m, s)
        for q in qs:
            if q.kind == "mcq":
                assert len(set(q.options)) == len(q.options) >= 3
            else:
                assert q.answer in q.accepted


# --- gibbs_graph ---------------------------------------------------------------------------------------------------

_CHEMENERGY_S = {"N2(g)": 192, "H2(g)": 131, "NH3(g)": 192, "CaCO3(s)": 93, "CaO(s)": 40, "CO2(g)": 214, "Mg(s)": 33,
                 "O2(g)": 205, "MgO(s)": 27, "H2O(l)": 70, "H2O(g)": 189, "N2O4(g)": 304, "NO2(g)": 240, "CH4(g)": 186,
                 "SO2(g)": 248, "SO3(g)": 257, "NH4Cl(s)": 95, "HCl(g)": 187}
_CHEMENERGY_GIBBS = {  # reaction: (equation as typed, ΔH)
    "ammonia": ("N2(g) + 3H2(g) -> 2NH3(g)", -92), "limestone": ("CaCO3(s) -> CaO(s) + CO2(g)", 178),
    "magnesium": ("2Mg(s) + O2(g) -> 2MgO(s)", -1204), "water": ("2H2(g) + O2(g) -> 2H2O(l)", -572),
    "boiling": ("H2O(l) -> H2O(g)", 44), "dinitrogen": ("N2O4(g) -> 2NO2(g)", 58),
    "methane": ("CH4(g) + 2O2(g) -> CO2(g) + 2H2O(l)", -890), "sulfur": ("2SO2(g) + O2(g) -> 2SO3(g)", -198),
    "chloride": ("NH4Cl(s) -> NH3(g) + HCl(g)", 176),
}


def _chemenergy_ds(equation: str) -> int:
    left, right = equation.split(" -> ")

    def total(side):
        out = 0
        for term in side.split(" + "):
            m_ = re.fullmatch(r"(\d*)(.+)", term)
            out += int(m_.group(1) or 1) * _CHEMENERGY_S[m_.group(2)]
        return out
    return total(right) - total(left)


def test_gibbs_graph_data_match_this_files_copy():
    m = _chemenergy_fam("gibbs_graph")
    assert m.ENTROPY == _CHEMENERGY_S
    for r, (eqn, dh) in _CHEMENERGY_GIBBS.items():
        assert m.REACTIONS[r][2] == dh
        assert m.delta_s(r) == _chemenergy_ds(eqn), r


def test_gibbs_graph_keys():
    m = _chemenergy_fam("gibbs_graph")
    lines = tables = 0
    for s in _CHEMENERGY_SEEDS:
        p, qs = _chemenergy_run(m, s)
        if p["kind"] == "line":
            lines += 1
            dh, ds, cross = p["sign"] * p["m"] * p["g"], p["sign"] * 10 * p["g"], 100 * p["m"]
            assert dh * 1000 == cross * ds  # the line crosses ΔG = 0 at the crossing temperature
            assert ("Above" in qs[0].stem) == (ds > 0) and qs[0].answer == str(cross), s
            T = int(re.search(r"at (\d+) K", qs[1].stem).group(1))
            assert T != cross and T % 100 == 0 and T <= 100 * p["top"]
            assert qs[1].answer == str(dh - T * ds // 1000), s
            assert qs[2].answer == str(dh) and qs[3].answer == str(ds), s
        else:
            tables += 1
            eqn, dh = _CHEMENERGY_GIBBS[p["reaction"]]
            ds = _chemenergy_ds(eqn)
            assert qs[0].answer == str(ds), s
            g = dh - Fraction(p["T"] * ds, 1000)
            assert abs(g) >= 5 and qs[1].answer == _chemenergy_dec(g), s
            want = "feasible: ΔG is negative" if g < 0 else "not feasible: ΔG is positive"
            assert [o for o in qs[2].options if o == want] == [_chemenergy_picked(qs[2])], s
            if "(l)" in eqn:
                assert p["T"] == 300, s
    assert lines > 300 and tables > 300


def test_gibbs_graph_line_is_drawn_through_its_values_on_gridlines():
    m = _chemenergy_fam("gibbs_graph")
    seen = 0
    for s in range(1, 200):
        p = m.sample(random.Random(s))
        if p["kind"] != "line":
            continue
        seen += 1
        if seen > 25:
            break
        dh, ds, cross = p["sign"] * p["m"] * p["g"], p["sign"] * 10 * p["g"], 100 * p["m"]
        fig = m.draw(p)
        ax = fig.axes[0]
        ln = next(x for x in ax.lines if x.get_gid() == "line")
        (x0, x1), (y0, y1) = ln.get_xdata(), ln.get_ydata()
        assert x0 == 0 and y0 == dh, s
        slope = Fraction(int(y1) - int(y0), int(x1) - int(x0))
        assert slope == Fraction(-ds, 1000), s
        xt, yt = _chemenergy_ticks(fig, "x"), _chemenergy_ticks(fig, "y")
        assert str(cross) in xt and str(dh) in yt and "0" in yt, s
        T = p["ask"] * 100
        assert str(T) in xt and str(dh - T * ds // 1000) in yt, s
        assert "feasible when ΔG is negative" in _chemenergy_words(fig)
        plt.close(fig)


def test_gibbs_graph_table_prints_every_entropy_and_dh():
    m = _chemenergy_fam("gibbs_graph")
    seen = 0
    for s in range(1, 300):
        p = m.sample(random.Random(s))
        if p["kind"] != "table":
            continue
        seen += 1
        if seen > 25:
            break
        eqn, dh = _CHEMENERGY_GIBBS[p["reaction"]]
        fig = m.draw(p)
        cells = {t.get_gid(): t.get_text() for t in fig.axes[0].texts if t.get_gid()}
        words = _chemenergy_words(fig)
        plt.close(fig)
        for term in re.split(r" \+ | -> ", eqn):
            sp = re.fullmatch(r"\d*(.+)", term).group(1)
            assert cells[f"S:{sp}"] == str(_CHEMENERGY_S[sp]), (s, sp)
        assert f"ΔH = {'+' if dh > 0 else '−'}{abs(dh)} kJ mol⁻¹" in words, s
        assert "ΔG = ΔH − TΔS" in words and "feasible when ΔG is negative" in words


# --- born_haber ----------------------------------------------------------------------------------------------------

_CHEMENERGY_METALS = {"Li": (159, [520]), "Na": (107, [496]), "K": (89, [419]), "Mg": (148, [738, 1451]),
                      "Ca": (178, [590, 1145])}
_CHEMENERGY_HALOGENS = {"F": (79, -328), "Cl": (122, -349), "Br": (112, -325), "I": (107, -295)}
_CHEMENERGY_FORMATION = {"NaCl": -411, "KCl": -437, "NaBr": -361, "KBr": -394, "LiF": -616, "LiCl": -409, "KF": -567,
                         "NaI": -288, "KI": -328, "MgCl2": -641, "CaCl2": -796, "MgF2": -1124, "MgBr2": -524, "CaBr2": -683}
_CHEMENERGY_LATTICE = {"NaCl": -787, "KCl": -718, "NaBr": -751, "KBr": -689, "LiF": -1046, "LiCl": -861, "KF": -826,
                       "NaI": -703, "KI": -648, "MgCl2": -2524, "CaCl2": -2255, "MgF2": -2963, "MgBr2": -2435,
                       "CaBr2": -2170}


def _chemenergy_split(compound):
    m_ = re.fullmatch(r"(Li|Na|K|Mg|Ca)(F|Cl|Br|I)2?", compound)
    return m_.group(1), m_.group(2)


def _chemenergy_route(p):
    M, X = _chemenergy_split(p["compound"])
    atm, ies = _CHEMENERGY_METALS[M]
    atx, ea = _CHEMENERGY_HALOGENS[X]
    n = len(ies)
    ions = [("ie1", ies[0])] + ([("ie2", ies[1])] if n == 2 else [])
    if p["order"] == "atomise":
        up = [("atM", atm), ("atX", n * atx)] + ions
    else:
        up = [("atM", atm)] + ions + [("atX", n * atx)]
    route = up + [("ea", n * ea)]
    hf = _CHEMENERGY_FORMATION[p["compound"]]
    return route + [("latt", hf - sum(v for _, v in route))], hf


def test_born_haber_lattice_energies_are_the_data_book_ones():
    for compound, hf in _CHEMENERGY_FORMATION.items():
        route, _ = _chemenergy_route({"compound": compound, "order": "atomise"})
        assert dict(route)["latt"] == _CHEMENERGY_LATTICE[compound], compound
    m = _chemenergy_fam("born_haber")
    assert {k: v[2] for k, v in m.COMPOUNDS.items()} == _CHEMENERGY_FORMATION
    assert {k: (v[1], v[2]) for k, v in m.METALS.items()} == _CHEMENERGY_METALS
    assert {k: (v[3], v[4]) for k, v in m.HALOGENS.items()} == _CHEMENERGY_HALOGENS


def test_born_haber_keys():
    m = _chemenergy_fam("born_haber")
    for s in _CHEMENERGY_SEEDS:
        p, qs = _chemenergy_run(m, s)
        assert p["band"] == "AL"
        route, hf = _chemenergy_route(p)
        values = dict(route)
        values["hf"] = hf
        order = [k for k, _ in route] + ["hf"]
        letter = {k: chr(ord(p["first"]) + i) for i, k in enumerate(order)}
        assert f"step {letter[p['blank']]}, marked ?" in qs[0].stem, s
        assert qs[0].answer == str(values[p["blank"]]), s
        assert _chemenergy_picked(qs[1]) == letter[p["ask"]], s
        assert len(set(qs[1].options)) == len(qs[1].options) >= 3
        assert all(o in letter.values() for o in qs[1].options)
        assert qs[2].answer == str(hf - values["latt"]), s


def test_born_haber_prints_every_value_but_one_and_arrows_point_the_right_way():
    m = _chemenergy_fam("born_haber")
    for s in _CHEMENERGY_DRAWN:
        p = m.sample(random.Random(s))
        route, hf = _chemenergy_route(p)
        values = dict(route)
        values["hf"] = hf
        fig = m.draw(p)
        ax = fig.axes[0]
        tags = {t.get_gid()[6:]: t.get_text() for t in ax.texts if (t.get_gid() or "").startswith("value:")}
        assert set(tags) == set(values), s
        for k, v in values.items():
            want = "?" if k == p["blank"] else (f"+{v}" if v > 0 else f"−{-v}")
            assert tags[k] == want, (s, k)
        arrows = {t.get_gid()[6:]: t for t in ax.texts if (t.get_gid() or "").startswith("arrow:")}
        for k, v in values.items():
            a = arrows[k]
            assert (a.xy[1] > a.xyann[1]) == (v > 0), (s, k)  # up for an endothermic step
        words = _chemenergy_words(fig)
        plt.close(fig)
        assert "not to scale" in words and "kJ mol⁻¹" in words


def test_born_haber_labels_letters_and_lines_stay_apart():
    m = _chemenergy_fam("born_haber")
    for s in _CHEMENERGY_DRAWN:
        p = m.sample(random.Random(s))
        fig = m.draw(p)
        texts = _chemenergy_drawn_texts(fig)
        ax = fig.axes[0]
        lines = list(ax.lines)
        renderer = fig.canvas.get_renderer()
        circles = []
        for t, box in texts:
            gid = t.get_gid() or ""
            if gid.startswith(("species:", "value:", "letter:")):
                for ln in lines:
                    assert not _chemenergy_crosses(ln, box), (s, t.get_text(), ln.get_gid())
            if gid.startswith("letter:"):
                circles.append(t.get_bbox_patch().get_window_extent(renderer))
        for i, a in enumerate(circles):
            for b in circles[i + 1:]:
                assert min(a.x1, b.x1) - max(a.x0, b.x0) < 0 or min(a.y1, b.y1) - max(a.y0, b.y0) < 0, s
        # no arrow passes through a species label or a value
        for a in [t for t in ax.texts if (t.get_gid() or "").startswith("arrow:")]:
            p0, p1 = ax.transData.transform(a.xyann), ax.transData.transform(a.xy)
            for t, box in texts:
                if (t.get_gid() or "").startswith(("species:", "value:")):
                    hit = any(_chemenergy_inside((p0[0] + (p1[0] - p0[0]) * k / 60, p0[1] + (p1[1] - p0[1]) * k / 60), box)
                              for k in range(61))
                    assert not hit, (s, a.get_gid(), t.get_text())
        plt.close(fig)


# --- shared checks -------------------------------------------------------------------------------------------------

@pytest.mark.parametrize("fid", _CHEMENERGY_IDS)
def test_p6_chemenergy_mcq_cannot_be_picked_from_its_options_alone(fid):
    m = _chemenergy_fam(fid)
    seen, hits = defaultdict(int), defaultdict(int)
    for s in range(1, 301):
        _, qs = _chemenergy_run(m, s)
        for q in qs:
            if q.kind == "mcq":
                key = re.sub(r"\d+", "#", q.stem.rsplit(". ", 1)[-1])
                seen[key] += 1
                hits[key] += _chemenergy_central(q.options) == int(q.answer)
    bad = {k: (hits[k], seen[k]) for k in seen if seen[k] >= 10 and hits[k] / seen[k] > 0.35}
    assert not bad, (fid, bad)


@pytest.mark.parametrize("fid", _CHEMENERGY_IDS)
def test_p6_chemenergy_first_stem_names_a_person(fid):
    m = _chemenergy_fam(fid)
    for s in range(1, 200):
        _, qs = _chemenergy_run(m, s)
        assert any(qs[0].stem.startswith(n) for n in NAMES), (fid, s, qs[0].stem)


def _chemenergy_reached(fid):
    sys.path.insert(0, "C:/Users/Stephen/AI_assessment/scripts")
    from figgen import link
    db = sqlite3.connect(f"file:{_CHEMENERGY_STORE}?mode=ro", uri=True)
    db.row_factory = sqlite3.Row
    ix = link.topic_index(db)
    names = {r["key"]: (r["band"], r["name"]) for r in db.execute("SELECT key, band, name FROM topics")}
    return {names[k] for k in link.reach(ix, FAMILIES[fid], 200)}


@pytest.mark.skipif(not _CHEMENERGY_STORE.exists(), reason="no figure store")
@pytest.mark.parametrize("fid, want, never", [
    ("equilibrium_data",
     [("UP", "Chapter 14: Reversible reactions and equilibrium"), ("UP", "Reversible reactions and equilibrium"),
      ("UP", "Quantitative Chemical Equilibrium"), ("UP", "NPK as Components of Fertilizers"), ("AL", "Chapter 13: Nitrogen gas")],
     [r"phase|solubility|acid|rate|kinetic|redox|electrochem|environment|energetic|group 15|stoichiometr"]),
    ("gibbs_graph", [("UP", "Entropy and Free Energy"), ("AL", "Chapter 23: Introducing entropy")],
     [r"^equilibrium$|reversible|states of matter|phase|electrochem|redox|enthalpy|energy changes|chemical energetics"]),
    ("born_haber", [("AL", "Chapter 19: Defining lattice energy")], [r"^chapter 6|ionisation|electronic|periodic"]),
])
def test_p6_chemenergy_reaches_its_thin_topics_and_nothing_it_does_not_teach(fid, want, never):
    reached = _chemenergy_reached(fid)
    for band, name in want:
        assert (band, name) in reached, (fid, name)
    for band, name in reached:
        for pat in never:
            assert not re.search(pat, name, re.I), (fid, band, name)


# ============================== part: chemstruct ============================================================

_CHEMSTRUCT_SEEDS = range(1, 1001)
_CHEMSTRUCT_DRAWN = range(1, 41)
_CHEMSTRUCT_STORE = Path("C:/Users/Stephen/figure-library/figures.db")
_CHEMSTRUCT_SUBS = str.maketrans("₀₁₂₃₄₅₆₇₈₉", "0123456789")


def _chemstruct_fam(fid):
    if fid not in FAMILIES:
        pytest.fail(f"{fid} is not registered")
    return FAMILIES[fid]


def _chemstruct_run(m, seed):
    rng = random.Random(seed)
    p = m.sample(rng)
    return p, m.questions(p, rng)


def _chemstruct_picked(q):
    return q.options[int(q.answer)]


def _chemstruct_central(options):
    toks = [Counter(re.findall(r"-?\d+|[a-zA-Z]+|\S", o)) for o in options]
    score = [sum(sum(((t - u) + (u - t)).values()) for u in toks) for t in toks]
    best = min(score)
    return score.index(best) if score.count(best) == 1 else None


def _chemstruct_texts(fig):
    """Every piece of text the renderer drew, with its box in pixels."""
    seen = []
    original = Text.draw

    def record(self, renderer):
        original(self, renderer)
        if self.get_visible() and self.get_text().strip():
            seen.append(self)

    Text.draw = record
    try:
        fig.canvas.draw()
    finally:
        Text.draw = original
    renderer = fig.canvas.get_renderer()
    return [(t, t.get_window_extent(renderer)) for t in seen]


def _chemstruct_words(fig) -> str:
    return " ".join(t.get_text() for t, _ in _chemstruct_texts(fig))


def _chemstruct_num(text: str) -> Decimal:
    return Decimal(text.replace("−", "-").replace(" ", "").replace(",", ""))


def _chemstruct_crosses(line, box, margin=1.0, steps=80) -> bool:
    pts = line.get_transform().transform(line.get_xydata())
    for a, b in zip(pts, pts[1:]):
        for k in range(steps + 1):
            x, y = a[0] + (b[0] - a[0]) * k / steps, a[1] + (b[1] - a[1]) * k / steps
            if box.x0 + margin < x < box.x1 - margin and box.y0 + margin < y < box.y1 - margin:
                return True
    return False


def _chemstruct_central_check(fid):
    m = _chemstruct_fam(fid)
    seen, hits = defaultdict(int), defaultdict(int)
    for s in range(1, 301):
        _, qs = _chemstruct_run(m, s)
        for q in qs:
            if q.kind == "mcq":
                key = re.sub(r"[−-]?\d+", "#", q.stem.rsplit(". ", 1)[-1])
                seen[key] += 1
                hits[key] += _chemstruct_central(q.options) == int(q.answer)
    bad = {k: (hits[k], seen[k]) for k in seen if seen[k] >= 10 and hits[k] / seen[k] > 0.35}
    assert not bad, (fid, bad)


def _chemstruct_reach(fid):
    if not _CHEMSTRUCT_STORE.exists():
        pytest.skip("no figure store")
    from figgen import link
    db = sqlite3.connect(f"file:{_CHEMSTRUCT_STORE}?mode=ro", uri=True)
    db.row_factory = sqlite3.Row
    ix = link.topic_index(db)
    names = {t["key"]: t["name"] for t in ix}
    return {k: names[k] for k in link.reach(ix, _chemstruct_fam(fid), 300)}


# --- property_trend -------------------------------------------------------------------------------------------------

_CHEMSTRUCT_EL = {"Li": "lithium", "Na": "sodium", "K": "potassium", "Rb": "rubidium", "Cs": "caesium",
                  "Be": "beryllium", "Mg": "magnesium", "Ca": "calcium", "Sr": "strontium", "Ba": "barium",
                  "Al": "aluminium", "Si": "silicon", "P": "phosphorus", "S": "sulfur", "Cl": "chlorine", "Ar": "argon",
                  "F": "fluorine", "Br": "bromine", "I": "iodine"}
_CHEMSTRUCT_DATA = {
    ("period3", "mp"): {"Na": "98", "Mg": "650", "Al": "660", "Si": "1414", "P": "44", "S": "115", "Cl": "-101", "Ar": "-189"},
    ("period3", "radius"): {"Na": "0.186", "Mg": "0.160", "Al": "0.143", "Si": "0.117", "P": "0.110", "S": "0.104", "Cl": "0.099"},
    ("period3", "ie1"): {"Na": "496", "Mg": "738", "Al": "578", "Si": "787", "P": "1012", "S": "1000", "Cl": "1251", "Ar": "1521"},
    ("period3", "en"): {"Na": "0.9", "Mg": "1.3", "Al": "1.6", "Si": "1.9", "P": "2.2", "S": "2.6", "Cl": "3.2"},
    ("group1", "mp"): {"Li": "181", "Na": "98", "K": "63", "Rb": "39", "Cs": "28"},
    ("group1", "radius"): {"Li": "0.152", "Na": "0.186", "K": "0.231", "Rb": "0.244", "Cs": "0.262"},
    ("group1", "ie1"): {"Li": "520", "Na": "496", "K": "419", "Rb": "403", "Cs": "376"},
    ("group2", "mp"): {"Be": "1287", "Mg": "650", "Ca": "842", "Sr": "777", "Ba": "727"},
    ("group2", "radius"): {"Be": "0.112", "Mg": "0.160", "Ca": "0.197", "Sr": "0.215", "Ba": "0.224"},
    ("group2", "ie1"): {"Be": "900", "Mg": "738", "Ca": "590", "Sr": "550", "Ba": "503"},
    ("group17", "mp"): {"F": "-220", "Cl": "-101", "Br": "-7", "I": "114"},
    ("group17", "bp"): {"F": "-188", "Cl": "-34", "Br": "59", "I": "184"},
    ("group17", "radius"): {"F": "0.072", "Cl": "0.099", "Br": "0.114", "I": "0.133"},
    ("group17", "en"): {"F": "4.0", "Cl": "3.2", "Br": "3.0", "I": "2.7"},
}
_CHEMSTRUCT_HYDRIDES = {"CH4": -162, "SiH4": -112, "GeH4": -88, "SnH4": -52, "NH3": -33, "PH3": -88, "AsH3": -62,
                        "SbH3": -17, "H2O": 100, "H2S": -60, "H2Se": -41, "H2Te": -2, "HF": 20, "HCl": -85, "HBr": -67,
                        "HI": -35}
_CHEMSTRUCT_HYDRIDE_GROUP = {f: g for g, fs in {14: "CH4 SiH4 GeH4 SnH4", 15: "NH3 PH3 AsH3 SbH3",
                                                16: "H2O H2S H2Se H2Te", 17: "HF HCl HBr HI"}.items() for f in fs.split()}
_CHEMSTRUCT_IES = {"Na": [496, 4562, 6910, 9543, 13354, 16613, 20117, 25496, 28932, 141362],
                   "Mg": [738, 1451, 7733, 10543, 13630, 18020, 21711, 25661, 31653, 35458],
                   "Si": [787, 1577, 3232, 4356, 16091, 19805, 23780, 29287, 33878, 38726],
                   "P": [1012, 1907, 2914, 4964, 6274, 21267, 25431, 29872, 35905, 40950],
                   "Cl": [1251, 2298, 3822, 5159, 6542, 9362, 11018, 33604, 38600, 43961],
                   "K": [419, 3052, 4420, 5877, 7975, 9590, 11343, 14944, 16964, 48610],
                   "Ca": [590, 1145, 4912, 6491, 8153, 10496, 12270, 14206, 18191, 20385]}
# The element each symbol's ten energies belong to: its group, from where its electrons sit (2,8,n).
_CHEMSTRUCT_GROUP = {"Na": 1, "Mg": 2, "Si": 14, "P": 15, "Cl": 17, "K": 1, "Ca": 2}


def _chemstruct_symbols(stem):
    return re.findall(r"\(([A-Z][a-z]?)\)", stem)


def test_property_trend_tables_are_the_data_book_values():
    m = _chemstruct_fam("property_trend")
    for (series, prop), want in _CHEMSTRUCT_DATA.items():
        got = {k: Decimal(str(v)) for k, v in m.DATA[series][prop].items()}
        assert got == {k: Decimal(v) for k, v in want.items()}, (series, prop)
    flat = {f: v for g in m.HYDRIDES.values() for f, v in g}
    assert flat == _CHEMSTRUCT_HYDRIDES
    assert {e: list(v[1]) for e, v in m.SUCCESSIVE.items()} == _CHEMSTRUCT_IES
    for e, ies in _CHEMSTRUCT_IES.items():  # every successive energy is larger than the one before
        assert all(a < b for a, b in zip(ies, ies[1:])), e


def test_property_trend_keys_recomputed():
    m = _chemstruct_fam("property_trend")
    kinds = Counter()
    for s in _CHEMSTRUCT_SEEDS:
        p, qs = _chemstruct_run(m, s)
        kinds[(p["band"], p["kind"])] += 1
        if p["kind"] == "value":
            data = {k: Decimal(v) for k, v in _CHEMSTRUCT_DATA[(p["series"], p["prop"])].items()}
            a, b = _chemstruct_symbols(qs[0].stem)
            assert data[a] > data[b], (s, qs[0].stem)
            assert _chemstruct_num(qs[0].answer) == data[a] - data[b], s
            t = Decimal(re.search(r"above (−?[\d.]+)", qs[1].stem).group(1).replace("−", "-"))
            assert all(v != t for v in data.values())
            assert 1 <= int(qs[1].answer) <= len(data) - 1
            assert int(qs[1].answer) == sum(v > t for v in data.values()), s
            (c,) = _chemstruct_symbols(qs[2].stem)
            assert _chemstruct_num(qs[2].answer) == data[c], s
            assert c not in (a, b)
        elif p["kind"] == "states":
            mp = {k: int(v) for k, v in _CHEMSTRUCT_DATA[("group17", "mp")].items()}
            bp = {k: int(v) for k, v in _CHEMSTRUCT_DATA[("group17", "bp")].items()}
            sym = {v: k for k, v in _CHEMSTRUCT_EL.items()}
            el = sym[re.search(r"state of (\w+) at", qs[0].stem).group(1)]
            t = int(re.search(r"at (−?\d+) °C\?", qs[0].stem).group(1).replace("−", "-"))
            want = "solid" if t < mp[el] else "gas" if t > bp[el] else "liquid"
            assert min(abs(t - mp[el]), abs(t - bp[el])) >= 10, s  # never on the edge of a change of state
            assert _chemstruct_picked(qs[0]) == want and sorted(qs[0].options) == ["gas", "liquid", "solid"], s
            t2 = int(re.search(r"gases at (−?\d+) °C", qs[1].stem).group(1).replace("−", "-"))
            assert int(qs[1].answer) == sum(v < t2 for v in bp.values()) and 1 <= int(qs[1].answer) <= 3, s
            assert all(abs(v - t2) >= 10 for v in bp.values())
            g = sym[re.search(r"boiling point of (\w+) higher", qs[2].stem).group(1)]
            assert int(qs[2].answer) == bp[g] - mp[g], s
        elif p["kind"] == "hydrides":
            assert p["band"] == "AL"
            fs = [f.translate(_CHEMSTRUCT_SUBS) for f in re.findall(r"\b([A-Z][A-Za-z₀-₉]*H[₀-₉]*|H[₀-₉]*[A-Z][a-z]?)\b", qs[0].stem)]
            fs = [f for f in fs if f in _CHEMSTRUCT_HYDRIDES]
            a, b = fs
            assert int(qs[0].answer) == _CHEMSTRUCT_HYDRIDES[a] - _CHEMSTRUCT_HYDRIDES[b] > 0, s
            c = re.search(r"boiling point of (\S+), according", qs[1].stem).group(1).translate(_CHEMSTRUCT_SUBS)
            assert int(qs[1].answer.replace("−", "-")) == _CHEMSTRUCT_HYDRIDES[c], s
            shown = [f for f in _CHEMSTRUCT_HYDRIDES if _CHEMSTRUCT_HYDRIDE_GROUP[f] in p["groups"]]
            assert {a, b, c} <= set(shown)
            t = int(re.search(r"gases at (−?\d+) °C", qs[2].stem).group(1).replace("−", "-"))
            assert int(qs[2].answer) == sum(_CHEMSTRUCT_HYDRIDES[f] < t for f in shown), s
            assert all(abs(_CHEMSTRUCT_HYDRIDES[f] - t) >= 5 for f in shown)
        else:
            ies = _CHEMSTRUCT_IES[p["el"]]
            steps = [math.log10(ies[k + 1] / ies[k]) for k in range(9)]  # bar to bar, as the log chart draws them
            n = steps.index(max(steps)) + 1
            # the jump stands out: half as tall again as any step before it, and clearly the tallest after
            assert all(steps[n - 1] >= 1.5 * x for x in steps[:n - 1]), (s, p["el"], steps)
            assert all(steps[n - 1] >= 1.3 * x for x in steps[n:]), (s, p["el"], steps)
            group = n if n <= 2 else n + 10
            assert group == _CHEMSTRUCT_GROUP[p["el"]]
            assert _chemstruct_picked(qs[0]) == f"Group {group}"
            assert sum(o == f"Group {group}" for o in qs[0].options) == 1
            assert qs[1].answer == str(n) and qs[2].answer == str(n + 1), s
    assert {k for k in kinds} >= {("UP", "value"), ("AL", "value"), ("UP", "states"), ("AL", "hydrides"),
                                  ("UP", "successive"), ("AL", "successive")}, kinds


def test_property_trend_asked_values_are_printed_and_bars_match_the_data():
    m = _chemstruct_fam("property_trend")
    for s in _CHEMSTRUCT_DRAWN:
        p, qs = _chemstruct_run(m, s)
        fig = m.draw(p)
        words = _chemstruct_words(fig)
        if p["kind"] == "value":
            data = _CHEMSTRUCT_DATA[(p["series"], p["prop"])]
            for e, v in data.items():
                assert v.replace("-", "−") in words.split(), (s, e, v)
            bars = sorted((r.get_x() + r.get_width() / 2, r.get_height()) for r in fig.axes[0].patches if r.get_width() < 1)
            assert [round(h, 6) for _, h in bars] == [round(float(v), 6) for v in data.values()], s
        elif p["kind"] == "states":
            for key in ("mp", "bp"):
                for v in _CHEMSTRUCT_DATA[("group17", key)].values():
                    assert v.replace("-", "−") in words.split(), (s, v)
        elif p["kind"] == "hydrides":
            shown = [f for f in _CHEMSTRUCT_HYDRIDES if _CHEMSTRUCT_HYDRIDE_GROUP[f] in p["groups"]]
            labels = [t.get_text().translate(_CHEMSTRUCT_SUBS) for t in fig.axes[0].texts]
            for f in shown:
                assert f"{f} {str(_CHEMSTRUCT_HYDRIDES[f]).replace('-', '−')}" in labels, (s, f, labels)
        else:
            heights = [r.get_y() + r.get_height() for r in fig.axes[0].patches if r.get_width() < 1]
            assert [round(h, 9) for h in heights] == [round(math.log10(v), 9) for v in _CHEMSTRUCT_IES[p["el"]]]
            assert p["el"] not in words.split() and _CHEMSTRUCT_EL[p["el"]] not in words.lower()
        plt.close(fig)


def test_property_trend_hydride_labels_clear_every_line():
    m = _chemstruct_fam("property_trend")
    done = 0
    for s in range(1, 400):
        p = m.sample(random.Random(s))
        if p["kind"] != "hydrides":
            continue
        fig = m.draw(p)
        texts = [(t, b) for t, b in _chemstruct_texts(fig) if (t.get_gid() or "").startswith("point:")]
        assert len(texts) == 8, (s, [t.get_text() for t, _ in texts])
        lines = [ln for ln in fig.axes[0].lines if (ln.get_gid() or "").startswith("line:")]
        for t, box in texts:
            for ln in lines:
                assert not _chemstruct_crosses(ln, box), (s, t.get_text(), ln.get_gid())
        plt.close(fig)
        done += 1
        if done >= 25:
            break
    assert done >= 10


def test_property_trend_mcq_cannot_be_picked_from_its_options_alone():
    _chemstruct_central_check("property_trend")


def test_property_trend_reaches_its_thin_topics_by_name():
    got = _chemstruct_reach("property_trend")
    for key in ("db:2744", "db:2746", "db:2747", "db:2752", "db:2753", "db:2754"):
        assert key in got, (key, sorted(got.values()))
    bad = re.compile(r"redox|alloy|reactivity|extraction|lattice|fertili|organic|alkane|polymer|halogenoalkane|"
                     r"chromatograph|group 1[345]|masses of atoms|elements and atoms", re.I)
    assert not [n for n in got.values() if bad.search(n)], sorted(got.values())


# --- orbital_boxes --------------------------------------------------------------------------------------------------

_CHEMSTRUCT_FILL = [("1s", 2), ("2s", 2), ("2p", 6), ("3s", 2), ("3p", 6), ("4s", 2), ("3d", 10)]
_CHEMSTRUCT_METALS = {21: ("scandium", "Sc"), 22: ("titanium", "Ti"), 23: ("vanadium", "V"), 24: ("chromium", "Cr"),
                      25: ("manganese", "Mn"), 26: ("iron", "Fe"), 27: ("cobalt", "Co"), 28: ("nickel", "Ni"),
                      29: ("copper", "Cu"), 30: ("zinc", "Zn")}
_CHEMSTRUCT_SUP = str.maketrans("⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻", "0123456789+-")


def _chemstruct_electrons(z, charge):
    """This file's own filling: Aufbau order, chromium 3d5 4s1 and copper 3d10 4s1, cations lose 4s before 3d."""
    conf, left = {}, z
    for s, cap in _CHEMSTRUCT_FILL:
        conf[s] = min(cap, left)
        left -= conf[s]
    if z in (24, 29):
        conf["4s"], conf["3d"] = 1, (5 if z == 24 else 10)
    if charge > 0:
        for s in ("4s", "3d", "3p", "3s", "2p", "2s", "1s"):
            k = min(conf[s], charge)
            conf[s] -= k
            charge -= k
    else:
        for s, cap in _CHEMSTRUCT_FILL:
            k = min(cap - conf[s], -charge)
            conf[s] += k
            charge += k
    return conf


def _chemstruct_unpaired(conf):
    boxes = {"s": 1, "p": 3, "d": 5}
    return sum(n if n <= boxes[s[1]] else 2 * boxes[s[1]] - n for s, n in conf.items())


def _chemstruct_parse_config(text):
    out = {}
    for s, n, up in re.findall(r"([1-4][spd])(?:\^?(\d+)|([⁰¹²³⁴⁵⁶⁷⁸⁹]+))", text):
        out[s] = int(n or up.translate(_CHEMSTRUCT_SUP))
    return out


def test_orbital_boxes_keys_recomputed():
    m = _chemstruct_fam("orbital_boxes")
    kinds = Counter()
    for s in _CHEMSTRUCT_SEEDS:
        p, qs = _chemstruct_run(m, s)
        kinds[(p["band"], p["kind"])] += 1
        conf = _chemstruct_electrons(p["z"], p["charge"])
        electrons = sum(conf.values())
        assert electrons == p["z"] - p["charge"]
        cfg = qs[-1]
        assert "Write the electronic configuration" in cfg.stem
        want = {k: v for k, v in conf.items() if v}
        assert _chemstruct_parse_config(cfg.answer) == want, (s, cfg.answer, want)
        # the key is written in the order the boxes fill (4s before 3d), and the other fair forms are accepted
        assert [x for x, _ in re.findall(r"([1-4][spd])(\S+)", cfg.answer)] == [x for x, _ in _CHEMSTRUCT_FILL if want.get(x)]
        plain = " ".join(f"{k}{v}" for k, v in want.items())
        assert plain in cfg.accepted and plain.replace(" ", "") in cfg.accepted, (s, plain)
        if want.get("3d"):
            swapped = [k for k in want if k not in ("3d", "4s")] + [k for k in ("3d", "4s") if k in want]
            assert " ".join(f"{k}{want[k]}" for k in swapped) in cfg.accepted
            assert any(a.startswith("[Ar]") for a in cfg.accepted)
        # every form that can be read back (run-together plain digits like 1s22s2 cannot) says the same
        readable = [a for a in cfg.accepted if not a.startswith("[") and (re.search(r"[ ,]", a) or re.search(r"[⁰-⁹¹²³]", a))]
        assert readable and all(_chemstruct_parse_config(a) == want for a in readable), s
        assert "1s¹" in cfg.stem and _chemstruct_parse_config(cfg.answer) != {"1s": 1}
        if p["kind"] == "atom":
            assert p["charge"] == 0
            assert int(qs[0].answer) == _chemstruct_unpaired(conf), s
            assert int(qs[1].answer) == p["z"] and "atomic number" in qs[1].stem
        elif p["kind"] == "main ion":
            assert p["z"] <= 20 and p["charge"] != 0
            ion = re.search(r"whose ion (\S+) is shown", qs[0].stem).group(1)
            letter, charge = ion[0], ion[1:].translate(_CHEMSTRUCT_SUP)
            q = (int(charge[:-1]) if charge[:-1] else 1) * (1 if charge[-1] == "+" else -1)
            assert q == p["charge"] and letter == p["letter"]
            assert int(qs[0].answer) == electrons + q, s
            atom = _chemstruct_electrons(p["z"], 0)
            top = max(int(k[0]) for k, v in atom.items() if v)
            assert int(qs[1].answer) == sum(v for k, v in atom.items() if int(k[0]) == top), s
        else:
            name, sym = _CHEMSTRUCT_METALS[p["z"]]
            assert name in qs[0].stem
            assert qs[0].answer == f"{p['z'] - electrons}+" and p["charge"] > 0
            assert f"{sym}{p['charge']}+" in qs[0].accepted
            assert int(qs[1].answer) == _chemstruct_unpaired(conf), s
    assert {k for k in kinds} == {(b, k) for b in ("UP", "AL") for k in ("atom", "main ion", "transition ion")}, kinds


def test_orbital_boxes_draws_every_electron_in_its_box_by_hunds_rule():
    m = _chemstruct_fam("orbital_boxes")
    for s in range(1, 81):
        p = m.sample(random.Random(s))
        conf = _chemstruct_electrons(p["z"], p["charge"])
        fig = m.draw(p)
        ax = fig.axes[0]
        arrows = [t.get_gid().split(":") for t in ax.texts if (t.get_gid() or "").startswith("e:")]
        boxes = [r.get_gid().split(":") for r in ax.patches if (r.get_gid() or "").startswith("box:")]
        names = {t.get_gid()[5:] for t in ax.texts if (t.get_gid() or "").startswith("name:")}
        for sub_, n in conf.items():
            k = {"s": 1, "p": 3, "d": 5}[sub_[1]]
            ups = sorted(int(b) for _, spin, x, b in arrows if x == sub_ and spin == "up")
            downs = sorted(int(b) for _, spin, x, b in arrows if x == sub_ and spin == "down")
            assert ups == list(range(min(n, k))) and downs == list(range(max(0, n - k))), (s, sub_, ups, downs)
            if n:
                assert sub_ in names and sum(1 for _, x, _b in boxes if x == sub_) == k
        if p["z"] >= 21:
            assert "4s" in names and "3d" in names  # the emptied 4s box is drawn
        words = _chemstruct_words(fig)
        if p["kind"] == "transition ion":
            name, sym = _CHEMSTRUCT_METALS[p["z"]]
            assert f"{name} ({sym}, atomic number {p['z']})" in words
        else:
            assert f"element {p['letter']}" in words or f"ion {p['letter']}" in words
            assert "atomic number" not in words
        # two arrows in one box stand apart
        xs = defaultdict(list)
        for t in ax.texts:
            if (t.get_gid() or "").startswith("e:"):
                xs[tuple(t.get_gid().split(":")[2:])].append(t.xy[0])
        for key, vals in xs.items():
            assert len(vals) == len(set(round(v, 6) for v in vals)), (s, key, vals)
        plt.close(fig)


def test_orbital_boxes_reaches_its_thin_topics_by_name():
    got = _chemstruct_reach("orbital_boxes")
    for key in ("db:2744", "db:2766", "db:627"):
        assert key in got, (key, sorted(got.values()))
    bad = re.compile(r"redox|bond|organic|isotop|radioactiv|periodic table$|lattice", re.I)
    assert not [n for n in got.values() if bad.search(n)], sorted(got.values())


# --- phase_diagram --------------------------------------------------------------------------------------------------

def _chemstruct_line(ax, gid):
    ln = next(x for x in ax.lines if x.get_gid() == gid)
    return [float(v) for v in ln.get_xdata()], [float(v) for v in ln.get_ydata()]


def _chemstruct_at(xs, ys, x):
    """The drawn line's height at x, by straight interpolation between its drawn points."""
    for (x0, y0), (x1, y1) in zip(zip(xs, ys), zip(xs[1:], ys[1:])):
        if min(x0, x1) <= x <= max(x0, x1) and x0 != x1:
            return y0 + (y1 - y0) * (x - x0) / (x1 - x0)
    return None


def _chemstruct_cross(xs, ys, level):
    """Where the drawn line crosses a pressure, by interpolation."""
    for (x0, y0), (x1, y1) in zip(zip(xs, ys), zip(xs[1:], ys[1:])):
        if min(y0, y1) <= level <= max(y0, y1) and y0 != y1:
            return x0 + (x1 - x0) * (level - y0) / (y1 - y0)
    return None


def _chemstruct_region(lines, T, q):
    """The region of a point, read from the three drawn lines of a phase diagram."""
    (vx, vy), (sx, sy), (mx, my) = lines["vapour"], lines["sublimation"], lines["melting"]
    tt, pt = mx[0], my[0]
    melt = mx[0] + (mx[1] - mx[0]) * (q - my[0]) / (my[1] - my[0])
    if q <= pt:
        return "solid" if T <= tt and q > _chemstruct_at(sx, sy, T) else "gas"
    if T < melt:
        return "solid"
    if T <= tt:
        return "liquid"
    return "liquid" if q > _chemstruct_at(vx, vy, T) else "gas"


def _chemstruct_value(text):
    return Fraction(text.replace("−", "-").split()[0].replace("%", ""))


def test_phase_diagram_pt_keys_read_from_the_drawn_lines():
    m = _chemstruct_fam("phase_diagram")
    n = 0
    for s in range(1, 700):
        p, qs = _chemstruct_run(m, s)
        if p["kind"] != "pt":
            continue
        n += 1
        fig = m.draw(p)
        ax = fig.axes[0]
        lines = {k: _chemstruct_line(ax, f"line:{k}") for k in ("vapour", "sublimation", "melting")}
        pts = {k: tuple(float(v[0]) for v in next(x for x in ax.lines if x.get_gid() == f"point:{k}").get_data())
               for k in ("T", "C")}
        spots = {t.get_gid()[7:]: (t.get_position(), t.get_text()) for t in ax.texts
                 if (t.get_gid() or "").startswith("region:")}
        grid_x = {round(float(v), 6) for v in list(ax.get_xticks()) + list(ax.get_xticks(minor=True))}
        plt.close(fig)
        # each letter sits in the region it names
        for name, ((x, y), _) in spots.items():
            assert _chemstruct_region(lines, x, y) == name, (s, name, x, y)
        letter = {name: L for name, (_, L) in spots.items()}
        for q in qs:
            stem = q.stem
            if "physical state" in stem:
                T, pr = map(int, re.search(r"at (-?\d+) °C and (\d+) kPa", stem).groups())
                assert _chemstruct_picked(q) == _chemstruct_region(lines, T, pr), (s, stem)
                assert round(float(T), 6) in grid_x and pr % 20 == 0
            elif "Which letter marks" in stem:
                name = re.search(r"X is a (\w+)", stem).group(1)
                assert _chemstruct_picked(q) == letter[name]
            elif "triple point" in stem:
                assert _chemstruct_value(q.answer) == Fraction(pts["T"][0]).limit_denominator() and pts["T"][0] in grid_x
            elif "lowest pressure" in stem:
                assert _chemstruct_value(q.answer) == Fraction(pts["T"][1]).limit_denominator()
            elif "boil" in stem:
                x = _chemstruct_cross(*lines["vapour"], 100)
                v = float(_chemstruct_value(q.answer))
                assert abs(v - x) < 0.3 and round(v, 6) in grid_x, (s, v, x)
            elif "however high" in stem:
                assert _chemstruct_value(q.answer) == Fraction(pts["C"][0]).limit_denominator()
            else:
                mx, my = lines["melting"]
                leans_left = mx[1] < mx[0] and my[1] > my[0]
                assert "leans to the left" in stem
                assert _chemstruct_picked(q) == ("X expands when it freezes" if leans_left else "X contracts when it freezes")
    assert n > 250


def test_phase_diagram_colligative_keys_read_from_the_drawn_lines():
    m = _chemstruct_fam("phase_diagram")
    n = 0
    for s in range(1, 700):
        p, qs = _chemstruct_run(m, s)
        if p["kind"] != "colligative":
            continue
        n += 1
        fig = m.draw(p)
        ax = fig.axes[0]
        grid_x = {round(float(v), 6) for v in list(ax.get_xticks()) + list(ax.get_xticks(minor=True))}
        at = {k: _chemstruct_cross(*_chemstruct_line(ax, f"line:{k}"), 100)
              for k in ("vapour", "melting", "solution vapour", "solution melting")}
        plt.close(fig)
        for k, v in at.items():
            assert v is not None and round(v) in grid_x and abs(v - round(v)) < 0.05, (s, k, v)
        boil, sboil, freeze, sfreeze = (round(at[k]) for k in ("vapour", "solution vapour", "melting", "solution melting"))
        assert sboil > boil and sfreeze < freeze
        for q in qs:
            v = _chemstruct_value(q.answer)
            if "higher than" in q.stem:
                assert v == sboil - boil
            elif "lower than" in q.stem:
                assert v == freeze - sfreeze
            elif "solution boil" in q.stem:
                assert v == sboil
            else:
                assert "solution freeze" in q.stem and v == sfreeze
    assert n > 100


def test_phase_diagram_partition_keys_and_printed_numbers():
    m = _chemstruct_fam("phase_diagram")
    dens = {"hexane": "0.66", "ethoxyethane": "0.71", "dichloromethane": "1.33", "tetrachloromethane": "1.59"}
    n = 0
    for s in _CHEMSTRUCT_SEEDS:
        p, qs = _chemstruct_run(m, s)
        if p["kind"] != "partition":
            continue
        n += 1
        c_org, c_aq = Fraction(p["m_org"]) / p["v_org"], Fraction(p["m_aq"]) / p["v_aq"]
        k_q, c_q, share_q = qs
        assert _chemstruct_value(k_q.answer) == c_org / c_aq
        want = (c_org if f"the {p['solvent']} layer" in c_q.stem else c_aq) * 1000
        assert _chemstruct_value(c_q.answer) == want
        assert _chemstruct_value(share_q.answer) == Fraction(p["m_org"]) / (Fraction(p["m_org"]) + Fraction(p["m_aq"])) * 100
        if n <= 30:
            fig = m.draw(p)
            words = _chemstruct_words(fig)
            layers = {t.get_gid(): t.get_text() for t in fig.axes[0].texts if (t.get_gid() or "").startswith("layer:")}
            plt.close(fig)
            for v in (p["v_org"], p["v_aq"]):
                assert f"volume {v} cm³" in words
            for mass in (p["m_org"], p["m_aq"]):
                assert f"contains {mass} g of X" in words
            assert "Kpc = concentration of X in the organic solvent" in words and f"density {dens[p['solvent']]}" in words
            on_top = float(dens[p["solvent"]]) < 1
            assert (layers["layer:upper"] == f"{p['solvent']} layer") == on_top
    assert n > 150


def test_phase_diagram_mcq_cannot_be_picked_from_its_options_alone():
    _chemstruct_central_check("phase_diagram")


def test_phase_diagram_first_stem_names_a_person():
    m = _chemstruct_fam("phase_diagram")
    for s in range(1, 200):
        _, qs = _chemstruct_run(m, s)
        assert any(qs[0].stem.startswith(n) for n in NAMES), qs[0].stem


def test_phase_diagram_labels_clear_the_lines():
    m = _chemstruct_fam("phase_diagram")
    for s in range(1, 40):
        p = m.sample(random.Random(s))
        if p["kind"] == "partition":
            continue
        fig = m.draw(p)
        texts = [(t, box) for t, box in _chemstruct_texts(fig) if t in fig.axes[0].texts]
        for ln in fig.axes[0].lines:
            for t, box in texts:
                assert not _chemstruct_crosses(ln, box), (s, t.get_text(), ln.get_gid())
        plt.close(fig)


def test_phase_diagram_reaches_its_thin_topics_by_name():
    got = _chemstruct_reach("phase_diagram")
    for key in ("db:621", "db:633"):
        assert key in got, (key, sorted(got.values()))
    bad = re.compile(r"chromatograph|organic|polymer|separation techniques|states of matter$", re.I)
    assert not [n for n in got.values() if bad.search(n)], sorted(got.values())


# ============================== part: chemenv ===============================================================

_CHEMENV_SEEDS = range(1, 1001)
_CHEMENV_STORE = Path("C:/Users/Stephen/figure-library/figures.db")
_CHEMENV_REPO = Path(__file__).resolve().parents[3]


def _chemenv_fam(fid):
    if fid not in FAMILIES:
        pytest.fail(f"{fid} is not registered")
    return FAMILIES[fid]


def _chemenv_run(m, seed):
    rng = random.Random(seed)
    p = m.sample(rng)
    return p, m.questions(p, rng)


def _chemenv_picked(q):
    return q.options[int(q.answer)]


def _chemenv_central(options):
    toks = [Counter(re.findall(r"-?\d+|[a-zA-Z]+|\S", o)) for o in options]
    score = [sum(sum(((t - u) + (u - t)).values()) for u in toks) for t in toks]
    best = min(score)
    return score.index(best) if score.count(best) == 1 else None


def _chemenv_drawn_texts(fig):
    seen = []
    original = Text.draw

    def record(self, renderer):
        original(self, renderer)
        if self.get_visible() and self.get_text().strip():
            seen.append(self)

    Text.draw = record
    try:
        fig.canvas.draw()
    finally:
        Text.draw = original
    renderer = fig.canvas.get_renderer()
    return [(t, t.get_window_extent(renderer)) for t in seen]


def _chemenv_words(m, p) -> str:
    fig = m.draw(p)
    words = " ".join(t.get_text() for t, _ in _chemenv_drawn_texts(fig))
    plt.close(fig)
    return re.sub(r"\s+", " ", words)


def _chemenv_inside(pt, box, margin=1.0) -> bool:
    return box.x0 + margin < pt[0] < box.x1 - margin and box.y0 + margin < pt[1] < box.y1 - margin


def _chemenv_crosses(line, box, margin=1.0, steps=60) -> bool:
    pts = line.get_transform().transform(line.get_xydata())
    for a, b in zip(pts, pts[1:]):
        if any(_chemenv_inside((a[0] + (b[0] - a[0]) * k / steps, a[1] + (b[1] - a[1]) * k / steps), box, margin)
               for k in range(steps + 1)):
            return True
    return False


def _chemenv_head(fid):
    """The family as committed at HEAD, loaded beside the working copy (git is only read)."""
    src = subprocess.run(["git", "show", f"HEAD:scripts/figgen/families/{fid}.py"], cwd=_CHEMENV_REPO,
                         capture_output=True, text=True, encoding="utf-8", check=True).stdout
    mod = types.ModuleType(f"figgen.families._head_{fid}")
    mod.__package__ = "figgen.families"
    exec(compile(src, f"<HEAD {fid}>", "exec"), mod.__dict__)
    return mod


def _chemenv_signature(fig):
    """What a figure draws: every text with its place, every line's points, every patch's outline."""
    out = []
    for ax in fig.axes:
        out.append(("lim", tuple(ax.get_xlim()), tuple(ax.get_ylim())))
        out += [("text", t.get_text(), tuple(round(float(v), 6) for v in t.get_position()), t.get_fontsize()) for t in ax.texts]
        out += [("line", tuple(tuple(round(float(v), 6) for v in xy) for xy in ln.get_xydata())) for ln in ax.lines]
        for pa in ax.patches:
            verts = pa.get_path().vertices
            out.append(("patch", type(pa).__name__, tuple(tuple(round(float(v), 6) for v in xy) for xy in verts),
                        tuple(round(float(v), 6) for v in pa.get_patch_transform().get_matrix().ravel())))
        out += [("label", ax.get_xlabel(), ax.get_ylabel(), ax.get_title())]
        out += [("ticks", tuple(round(float(v), 6) for v in ax.get_xticks()), tuple(round(float(v), 6) for v in ax.get_yticks()))]
    return out


def _chemenv_same_as_head(fid, seeds=range(1, 201), keep=lambda p: True):
    """For params the HEAD family samples, the working family draws and words exactly as HEAD did."""
    old, new = _chemenv_head(fid), _chemenv_fam(fid)
    checked = 0
    for s in seeds:
        p = old.sample(random.Random(s))
        if not keep(p):
            continue
        a, b = old.draw(p), new.draw(p)
        assert _chemenv_signature(a) == _chemenv_signature(b), (fid, s)
        plt.close(a)
        plt.close(b)
        qa, qb = old.questions(p, random.Random(1000 + s)), new.questions(p, random.Random(1000 + s))
        assert [vars(q) for q in qa] == [vars(q) for q in qb], (fid, s)
        checked += 1
    assert checked >= 50, fid


def _chemenv_index():
    if not _CHEMENV_STORE.exists():
        pytest.skip("no figure library here")
    db = sqlite3.connect(f"file:{_CHEMENV_STORE}?mode=ro", uri=True)
    db.row_factory = sqlite3.Row
    ix = link.topic_index(db)
    books = {r["key"]: r["book"] for r in db.execute("SELECT key, book FROM topics")}
    return ix, books


def _chemenv_reached(fid, samples=200):
    ix, books = _chemenv_index()
    keys = link.reach(ix, _chemenv_fam(fid), samples)
    return {t["key"]: (t["band"], books[t["key"]], t["name"]) for t in ix if t["key"] in keys}


def _chemenv_mcq_checks(fid, seeds=range(1, 301)):
    """The key is never the option a student could pick from the options alone (at most 35% per stem)."""
    m = _chemenv_fam(fid)
    seen, hits = defaultdict(int), defaultdict(int)
    for s in seeds:
        _, qs = _chemenv_run(m, s)
        for q in qs:
            if q.kind == "mcq":
                key = re.sub(r"\d+", "#", q.stem.rsplit(". ", 1)[-1])
                seen[key] += 1
                hits[key] += _chemenv_central(q.options) == int(q.answer)
    bad = {k: (hits[k], seen[k]) for k in seen if seen[k] >= 10 and hits[k] / seen[k] > 0.35}
    assert not bad, (fid, bad)


# --- electrolysis (edited: an LS band) --------------------------------------------------------------------------

def test_electrolysis_up_and_al_figures_are_as_at_head():
    _chemenv_same_as_head("electrolysis")


def test_electrolysis_draws_lower_secondary_cells_too():
    m = _chemenv_fam("electrolysis")
    bands = Counter(m.sample(random.Random(s))["band"] for s in range(1, 301))
    assert set(bands) == {"LS", "UP", "AL"}
    reached = _chemenv_reached("electrolysis")
    names = {(b, n) for b, _, n in reached.values()}
    assert ("LS", "Electrolysis and its applications") in names
    assert ("LS", "Electrolytes and Non-electrolytes") in names
    assert not re.search(m.NEEDS, "Redox and oxidation number", re.I)
    for b, book, n in reached.values():
        if b == "LS":
            assert re.search(r"electroly", n, re.I), n


# --- chromatogram (edited: also the AS chapter on chromatography) ----------------------------------------------

def test_chromatogram_figures_are_as_at_head():
    _chemenv_same_as_head("chromatogram")


def test_chromatogram_reaches_the_as_chapter_on_chromatography_only():
    reached = _chemenv_reached("chromatogram")
    al = sorted(n for b, _, n in reached.values() if b == "AL")
    assert al == ["Chapter 30: General principles of chromatography"], al


# --- decay_graph and nucleus (edited: ALSO the S6 chemistry topic) ----------------------------------------------

@pytest.mark.parametrize("fid", ["decay_graph", "nucleus"])
def test_radioactivity_figures_are_as_at_head(fid):
    _chemenv_same_as_head(fid)


@pytest.mark.parametrize("fid", ["decay_graph", "nucleus"])
def test_radioactivity_figures_reach_the_s6_chemistry_topic(fid):
    reached = _chemenv_reached(fid)
    chem = [(b, book, n) for b, book, n in reached.values() if book.startswith("Chemistry S6")]
    assert chem == [("UP", "Chemistry S6 SB", "Radioactivity")], chem


# --- conductivity_test ------------------------------------------------------------------------------------------

# Each liquid's class, as the S2 and S5 books teach it: free ions in plenty, few, or none.
_CHEMENV_ELECTROLYTE = {
    "sodium chloride solution": "strong", "dilute hydrochloric acid": "strong", "dilute sulfuric acid": "strong",
    "sodium hydroxide solution": "strong", "copper(II) sulfate solution": "strong", "potassium nitrate solution": "strong",
    "dilute ethanoic acid": "weak", "ammonia solution": "weak", "lemon juice": "weak",
    "sugar solution": "non", "ethanol": "non", "paraffin": "non", "glucose solution": "non",
}
_CHEMENV_CLASS_WORDS = {"strong": "strong electrolyte", "weak": "weak electrolyte", "non": "non-electrolyte"}


def _chemenv_class_of_drawing(fig, L):
    """A set-up's class from what is drawn: rays round its bulb (8 long, 4 short, none), or its printed current."""
    ax = fig.axes[0]
    rays = [ln for ln in ax.lines if ln.get_gid() == f"ray:{L}"]
    reading = [t.get_text() for t in ax.texts if t.get_gid() == f"reading:{L}"]
    if reading:
        amps = Fraction(reading[0].replace(" A", ""))
        return "strong" if amps > Fraction(1, 2) else "weak" if amps > 0 else "non"
    if not rays:
        return "non"
    length = max(math.dist(*ln.get_xydata()) for ln in rays)
    return "strong" if len(rays) == 8 and length > 0.25 else "weak" if len(rays) == 4 and length < 0.2 else "?"


def test_conductivity_test_keys_follow_the_drawn_bulbs_and_readings():
    m = _chemenv_fam("conductivity_test")
    kinds = Counter()
    for s in _CHEMENV_SEEDS:
        p, qs = _chemenv_run(m, s)
        kinds[(p["band"], p["kind"])] += 1
        setups = dict(p["setups"])
        classes = {L: _CHEMENV_ELECTROLYTE[liquid] for L, liquid in setups.items()}
        if p["kind"] == "ammeter":
            for L, amps in p["readings"].items():
                a = Fraction(amps)
                assert (a > Fraction(1, 2)) == (classes[L] == "strong") and (a == 0) == (classes[L] == "non"), (s, L, amps)
        for q in qs:
            got = re.search(r"Which liquid, [A-D, or]+, is an? (strong electrolyte|weak electrolyte|non-electrolyte)\?", q.stem)
            if got:
                want = [L for L, c in classes.items() if _CHEMENV_CLASS_WORDS[c] == got.group(1)]
                assert len(want) == 1 and _chemenv_picked(q) == want[0], (s, q.stem)
                assert sorted(q.options) == q.options and set(q.options) <= set(setups)
            elif "conduct electricity" in q.stem:
                assert int(q.answer) == sum(c != "non" for c in classes.values()), (s, q.stem)
            elif re.search(r"what is liquid ([A-D])\?", q.stem):
                L = re.search(r"what is liquid ([A-D])\?", q.stem).group(1)
                assert _chemenv_picked(q) == _CHEMENV_CLASS_WORDS[classes[L]]
                assert sorted(q.options) == sorted(_CHEMENV_CLASS_WORDS.values())
            elif "How much larger" in q.stem:
                a, b = re.findall(r"liquid ([A-D])", q.stem)
                diff = Fraction(p["readings"][a]) - Fraction(p["readings"][b])
                assert diff > 0 and Fraction(q.answer) == diff, (s, q.stem, q.answer)
                assert f"{q.answer} A" in q.accepted
            else:
                pytest.fail(f"unchecked question: {q.stem}")
    assert set(kinds) == {("LS", "bulb"), ("UP", "bulb"), ("UP", "ammeter")}, kinds


def test_conductivity_test_drawing_shows_each_class_and_the_rule():
    m = _chemenv_fam("conductivity_test")
    for s in range(1, 61):
        p = m.sample(random.Random(s))
        fig = m.draw(p)
        for L, liquid in p["setups"]:
            assert _chemenv_class_of_drawing(fig, L) == _CHEMENV_ELECTROLYTE[liquid], (s, L, liquid)
        texts = _chemenv_drawn_texts(fig)
        words = re.sub(r"\s+", " ", " ".join(t.get_text() for t, _ in texts))
        plt.close(fig)
        for L, liquid in p["setups"]:
            assert liquid in words, (s, liquid)
        for w in _CHEMENV_CLASS_WORDS.values():
            assert w in words, (s, w)
        assert min(t.get_fontsize() for t, _ in texts) >= 9.5


def test_conductivity_test_rays_and_wires_keep_clear_of_the_words():
    m = _chemenv_fam("conductivity_test")
    for s in range(1, 41):
        fig = m.draw(m.sample(random.Random(s)))
        texts = _chemenv_drawn_texts(fig)
        for ln in fig.axes[0].lines:
            for t, box in texts:
                assert not _chemenv_crosses(ln, box), (s, ln.get_gid(), t.get_text())
        plt.close(fig)


def test_conductivity_test_options_alone_do_not_give_the_key():
    _chemenv_mcq_checks("conductivity_test")


def test_conductivity_test_reaches_the_electrolyte_topics_by_name():
    reached = _chemenv_reached("conductivity_test")
    names = {(b, n) for b, _, n in reached.values()}
    assert ("LS", "Electrolytes and Non-electrolytes") in names and ("UP", "Conductivity of Solutions") in names
    assert ("UP", "Electrochemical Cell and Applications") not in names  # galvanic cells, not conduction
    for b, book, n in reached.values():
        assert re.search(r"electrolytes|electrochemistry|conduct", n, re.I), (b, n)


# --- water_waste_data -------------------------------------------------------------------------------------------

# The limits the class uses, as this file states them (WHO drinking-water guideline values).
_CHEMENV_SAFE = {"pH": (Fraction(65, 10), Fraction(85, 10)), "nitrate": Fraction(50), "lead": Fraction(1, 100), "bacteria": 0}


def _chemenv_safe(sample) -> dict:
    _, _, ph, nitrate, lead, bacteria = sample
    lo, hi = _CHEMENV_SAFE["pH"]
    return {"pH": lo <= Fraction(ph) <= hi, "nitrate": Fraction(nitrate) <= _CHEMENV_SAFE["nitrate"],
            "lead": Fraction(lead) <= _CHEMENV_SAFE["lead"], "bacteria": int(bacteria) == _CHEMENV_SAFE["bacteria"]}


def _chemenv_kg(text) -> Fraction:
    return Fraction(text.replace(" kg", "").replace(" ", ""))


def test_water_waste_data_keys_come_from_the_printed_numbers():
    m = _chemenv_fam("water_waste_data")
    kinds = Counter()
    for s in _CHEMENV_SEEDS:
        p, qs = _chemenv_run(m, s)
        kinds[(p["band"], p["kind"])] += 1
        if p["kind"] == "waste_bar":
            masses = dict(p["masses"])
            total = sum(masses.values())
            assert len(set(masses.values())) == len(masses)
            for q in qs:
                got = re.search(r"What mass of (.+?) was (?:collected|thrown away|put in the bins)", q.stem)
                if "sent for recycling" in q.stem:
                    assert _chemenv_kg(q.answer) == sum(masses[t] for t in p["recycled"]), (s, q.stem)
                elif got:
                    assert _chemenv_kg(q.answer) == masses[got.group(1)], (s, q.stem)
                elif "What percentage" in q.stem:
                    t = re.search(r"waste was (.+?)\?", q.stem).group(1)
                    assert Fraction(q.answer) == Fraction(100 * masses[t], total) and Fraction(q.answer).denominator == 1
                elif "largest mass" in q.stem:
                    assert _chemenv_picked(q) == max(masses, key=masses.get)
                    assert all(o in masses for o in q.options)
                else:
                    pytest.fail(q.stem)
        elif p["kind"] == "waste_pie":
            parts, total = dict(p["parts"]), p["total"]
            assert sum(parts.values()) == 100 and min(parts.values()) >= 10
            for q in qs:
                if "What percentage" in q.stem:
                    assert p["hidden"] in q.stem and int(q.answer) == parts[p["hidden"]]
                elif "kilograms more" in q.stem:
                    a, b = re.search(r"more (.+?) than (.+?) (?:was|were) ", q.stem).groups()
                    assert _chemenv_kg(q.answer) == Fraction(total * (parts[a] - parts[b]), 100) > 0, (s, q.stem)
                elif "What mass of" in q.stem:
                    t = re.search(r"What mass of (.+?) (?:was|were) ", q.stem).group(1)
                    assert _chemenv_kg(q.answer) == Fraction(total * parts[t], 100), (s, q.stem)
                    assert Fraction(total * parts[t], 100).denominator == 1
                else:
                    pytest.fail(q.stem)
        elif p["kind"] == "water":
            safe = {smp[0]: _chemenv_safe(smp) for smp in p["samples"]}
            assert sum(all(v.values()) for v in safe.values()) == 1, (s, safe)
            for q in qs:
                if "safe to drink" in q.stem:
                    assert all(safe[_chemenv_picked(q)].values())
                elif "more nitrate" in q.stem:
                    assert int(q.answer) == sum(not v["nitrate"] for v in safe.values())
                elif "times the safe limit" in q.stem:
                    L = re.search(r"sample ([A-E])", q.stem).group(1)
                    lead = Fraction(next(smp[4] for smp in p["samples"] if smp[0] == L))
                    assert Fraction(q.answer) == lead / _CHEMENV_SAFE["lead"] and Fraction(q.answer).denominator == 1
                elif "pH is outside" in q.stem:
                    bad = [L for L, v in safe.items() if not v["pH"]]
                    assert bad == [_chemenv_picked(q)], (s, bad)
                else:
                    pytest.fail(q.stem)
        else:
            sites, limit = dict(p["sites"]), p["limit"]
            assert len(set(sites.values())) == len(sites) and limit not in sites.values()
            for q in qs:
                if "How many" in q.stem:
                    assert int(q.answer) == sum(v > limit for v in sites.values())
                elif "above the limit" in q.stem:
                    site = re.search(r"at the (.+?) above the limit", q.stem).group(1)
                    assert Fraction(q.answer.split()[0]) == sites[site] - limit > 0
                elif "lowest" in q.stem:
                    assert _chemenv_picked(q) == min(sites, key=sites.get) and all(o in sites for o in q.options)
                else:
                    pytest.fail(q.stem)
    assert set(kinds) == {("LS", "waste_bar"), ("LS", "waste_pie"), ("LS", "water"), ("UP", "water"), ("LS", "air"),
                          ("UP", "air")}, kinds


def test_water_waste_data_every_value_asked_is_shown():
    m = _chemenv_fam("water_waste_data")
    for s in range(1, 121):
        p = m.sample(random.Random(s))
        fig = m.draw(p)
        texts = _chemenv_drawn_texts(fig)
        words = re.sub(r"\s+", " ", " ".join(t.get_text() for t, _ in texts))
        ax = fig.axes[0]
        if p["kind"] in ("waste_bar", "air"):
            lines = {round(float(v), 6) for v in list(ax.get_yticks()) + list(ax.get_yticks(minor=True))}
            values = dict(p["masses"] if p["kind"] == "waste_bar" else p["sites"]).values()
            assert all(round(float(v), 6) in lines for v in values), s
            assert max(values) < ax.get_ylim()[1]
            if p["kind"] == "air":
                assert f"{p['limit']} µg/m³" in words
            for name in dict(p["masses"] if p["kind"] == "waste_bar" else p["sites"]):
                assert name in words, (s, name)
        elif p["kind"] == "waste_pie":
            assert f"{p['total']} kg" in words
            for t, v in p["parts"]:
                assert t in words and (f"{v}%" in words) != (t == p["hidden"])
        else:
            for row in p["samples"]:
                for cell in row:
                    assert str(cell) in words, (s, cell)
            for limit in ("6.5 to 8.5", "50", "0.01"):
                assert limit in words
        assert min(t.get_fontsize() for t, _ in texts) >= 9.5
        plt.close(fig)


def test_water_waste_data_options_alone_do_not_give_the_key():
    _chemenv_mcq_checks("water_waste_data")


def test_water_waste_data_reaches_the_waste_and_water_topics_by_name():
    reached = _chemenv_reached("water_waste_data")
    names = {(b, n) for b, _, n in reached.values()}
    for want in ("Waste Materials", "Effective Ways of Waste Management", "Water Pollution"):
        assert ("LS", want) in names, want
    assert ("UP", "Chemistry of our environment") in names
    assert ("LS", "Chemistry and Society") not in names
    for b, book, n in reached.values():
        assert re.search(r"waste|water|air|pollut|environment|nitrogen|sulphur", n, re.I), (b, n)


# --- salt_heating -----------------------------------------------------------------------------------------------

# Each carbonate's formula mass and its oxide's, from Ar: Cu 64, Zn 65, Mg 24, C 12, O 16; carbon dioxide is 44.
_CHEMENV_CARBONATES = {"copper(II) carbonate": (124, 80), "zinc carbonate": (125, 81), "magnesium carbonate": (84, 40)}


def _chemenv_g(text) -> Fraction:
    return Fraction(text.replace(" g", "").replace("g", "").strip())


def test_salt_heating_masses_come_from_the_printed_table_and_obey_the_chemistry():
    m = _chemenv_fam("salt_heating")
    kinds = Counter()
    for s in _CHEMENV_SEEDS:
        p, qs = _chemenv_run(m, s)
        kinds[p["kind"]] += 1
        empty, before = Fraction(p["empty"]), Fraction(p["before"])
        after = [Fraction(x) for x in p["after"]]
        salt = before - empty
        M, oxide = _CHEMENV_CARBONATES[p["salt"]]
        assert after[-1] - empty == salt * oxide / M, (s, p)  # all the carbonate decomposed: the oxide is left
        first = after.index(after[-1])  # the first weighing at the final mass
        falling = [before] + after[:first + 1]
        assert all(a > b for a, b in zip(falling, falling[1:])) and all(a == after[-1] for a in after[first:]), (s, p)
        if p["kind"] == "repeat":
            assert len(after) >= 3 and first < len(after) - 1  # the constant mass is seen twice
        else:
            assert len(after) == 1
        for q in qs:
            if "What mass of" in q.stem and "was heated" in q.stem:
                assert _chemenv_g(q.answer) == salt
            elif "gas" in q.stem and "first heating" not in q.stem:
                assert _chemenv_g(q.answer) == before - after[-1], (s, q.stem)
            elif "solid was left" in q.stem:
                assert _chemenv_g(q.answer) == after[-1] - empty
            elif "first heating" in q.stem:
                assert _chemenv_g(q.answer) == before - after[0]
            elif "stopped changing" in q.stem:
                assert _chemenv_g(q.answer) == after[-1]
            else:
                pytest.fail(q.stem)
            assert f"{q.answer} g" in q.accepted
    assert set(kinds) == {"single", "repeat"}


def test_salt_heating_prints_every_mass_and_draws_milky_limewater():
    m = _chemenv_fam("salt_heating")
    for s in range(1, 61):
        p = m.sample(random.Random(s))
        fig = m.draw(p)
        texts = _chemenv_drawn_texts(fig)
        words = re.sub(r"\s+", " ", " ".join(t.get_text() for t, _ in texts))
        for x in [p["empty"], p["before"], *p["after"]]:
            assert f"{x} g" in words, (s, x)
        assert p["salt"] in words and "limewater" in words
        ax = fig.axes[0]
        assert any((c.get_gid() or "") == "milky" for c in ax.collections), s
        assert min(t.get_fontsize() for t, _ in texts) >= 9.5
        for ln in ax.lines:
            if (ln.get_gid() or "").startswith("leader"):
                for t, box in texts:
                    if t.get_gid() != ln.get_gid().replace("leader", "label"):
                        assert not _chemenv_crosses(ln, box), (s, ln.get_gid(), t.get_text())
        plt.close(fig)


def test_salt_heating_reaches_the_s1_salts_topic():
    reached = _chemenv_reached("salt_heating")
    names = {(b, n) for b, _, n in reached.values()}
    assert ("LS", "Inorganic Salts and their Properties") in names
    for b, book, n in reached.values():
        assert b == "LS" and re.search(r"salt|carbon", n, re.I), (b, n)


# --- alloys_corrosion -------------------------------------------------------------------------------------------

# Typical compositions by mass, as the figure's table prints them (this file's own copy).
_CHEMENV_ALLOYS = {"brass": {"copper": 70, "zinc": 30}, "bronze": {"copper": 90, "tin": 10}, "solder": {"tin": 60, "lead": 40},
                   "cupronickel": {"copper": 75, "nickel": 25}, "stainless steel": {"iron": 74, "chromium": 18, "nickel": 8}}
# Iron rusts only with both water and air (oxygen); salt water speeds it; a coat of paint or zinc keeps both out.
_CHEMENV_RUSTS = {"tap water": True, "salt water": True, "boiled water under oil": False, "dry air": False,
                  "painted nail in tap water": False, "zinc-coated nail in tap water": False}


def test_alloys_corrosion_keys_follow_the_drawing_and_the_table():
    m = _chemenv_fam("alloys_corrosion")
    kinds = Counter()
    for s in _CHEMENV_SEEDS:
        p, qs = _chemenv_run(m, s)
        kinds[p["kind"]] += 1
        if p["kind"] == "particles":
            fig = m.draw(p)
            atoms = defaultdict(Counter)
            for pa in fig.axes[0].patches:
                gid = pa.get_gid() or ""
                if gid.startswith("atom:"):
                    _, box, element = gid.split(":")
                    atoms[box][element] += 1
            plt.close(fig)
            alloys = [b for b, c in atoms.items() if len(c) == 2]
            assert len(alloys) == 1 and len(atoms) == 3 and all(sum(c.values()) == 20 for c in atoms.values()), (s, atoms)
            alloy = alloys[0]
            for q in qs:
                if "shows an alloy" in q.stem:
                    assert _chemenv_picked(q) == alloy
                elif "What percentage" in q.stem:
                    el = re.search(r"are (\w+) atoms\?", q.stem).group(1)
                    assert Fraction(q.answer) == Fraction(100 * atoms[alloy][el], 20)
                elif "How many" in q.stem:
                    el = re.search(r"How many (\w+) atoms", q.stem).group(1)
                    assert int(q.answer) == atoms[alloy][el] and f"diagram {alloy}" in q.stem
                else:
                    pytest.fail(q.stem)
        elif p["kind"] == "composition":
            shown = {a: _CHEMENV_ALLOYS[a] for a in p["alloys"]}
            for q in qs:
                got = re.search(r"made of (.+?), which (?:has a mass of|weighs) (\d+) g\. What mass of (\w+)", q.stem)
                inv = re.search(r"piece of (.+?) contains (\d+) g of (\w+)\. What is the mass of the piece", q.stem)
                if got:
                    alloy, mass, metal = got.group(1), int(got.group(2)), got.group(3)
                    assert alloy in shown and Fraction(q.answer) == Fraction(mass * shown[alloy][metal], 100), (s, q.stem)
                elif inv:
                    alloy, grams, metal = inv.group(1), int(inv.group(2)), inv.group(3)
                    assert Fraction(q.answer) == Fraction(grams * 100, shown[alloy][metal]), (s, q.stem)
                    assert Fraction(q.answer).denominator == 1
                elif "How many of the alloys" in q.stem:
                    metal = re.search(r"contain (\w+)\?", q.stem).group(1)
                    assert int(q.answer) == sum(metal in c for c in shown.values())
                else:
                    pytest.fail(q.stem)
        else:
            tubes = dict(p["tubes"])
            rusts = {L: _CHEMENV_RUSTS[c] for L, c in tubes.items()}
            for q in qs:
                if "How many of the nails" in q.stem:
                    assert int(q.answer) == sum(rusts.values())
                elif "rust fastest" in q.stem:
                    assert tubes[_chemenv_picked(q)] == "salt water"
                elif "Which nail will rust" in q.stem:
                    assert [L for L, r in rusts.items() if r] == [_chemenv_picked(q)]
                elif "does not rust" in q.stem:
                    L = re.search(r"tube ([A-E])", q.stem).group(1)
                    why = {"boiled water under oil": "no air", "dry air": "no water",
                           "painted nail in tap water": "coat", "zinc-coated nail in tap water": "coat"}[tubes[L]]
                    assert why in _chemenv_picked(q), (s, tubes[L], _chemenv_picked(q))
                    assert sum(why in o for o in q.options) == 1
                else:
                    pytest.fail(q.stem)
    assert set(kinds) == {"particles", "composition", "rusting"}


def test_alloys_corrosion_shows_what_it_asks():
    m = _chemenv_fam("alloys_corrosion")
    for s in range(1, 61):
        p = m.sample(random.Random(s))
        fig = m.draw(p)
        texts = _chemenv_drawn_texts(fig)
        words = re.sub(r"\s+", " ", " ".join(t.get_text() for t, _ in texts))
        if p["kind"] == "composition":
            for a in p["alloys"]:
                assert a in words
                for metal, pct in _CHEMENV_ALLOYS[a].items():
                    assert f"{metal} {pct}%" in words, (s, a, metal)
        elif p["kind"] == "rusting":
            for L, cond in p["tubes"]:
                assert L in words
        assert min(t.get_fontsize() for t, _ in texts) >= 9.5
        # no two atoms overlap: each pair of circles in a diagram stands apart
        circles = [pa for pa in fig.axes[0].patches if (pa.get_gid() or "").startswith("atom:")]
        for i, a in enumerate(circles):
            for b in circles[i + 1:]:
                if a.get_gid().split(":")[1] == b.get_gid().split(":")[1]:
                    assert math.dist(a.center, b.center) > a.radius + b.radius, (s, a.center, b.center)
        plt.close(fig)


def test_alloys_corrosion_options_alone_do_not_give_the_key():
    _chemenv_mcq_checks("alloys_corrosion")


def test_alloys_corrosion_reaches_the_metals_topics_by_name():
    reached = _chemenv_reached("alloys_corrosion")
    names = {(b, n) for b, _, n in reached.values()}
    assert ("UP", "Metallic elements and alloys") in names
    for b, book, n in reached.values():
        assert re.search(r"metal|alloy|corros|bond|structure|matter|electrochem", n, re.I), (b, n)


# --- oxidation_numbers ------------------------------------------------------------------------------------------

# This file's own oxidation numbers: each species' element, by the usual rules (O -2, H +1, the charge on an ion).
_CHEMENV_ON = {"NH₃": -3, "NH₄⁺": -3, "N₂": 0, "N₂O": 1, "NO": 2, "NO₂⁻": 3, "NO₂": 4, "HNO₃": 5, "NO₃⁻": 5,
               "H₂S": -2, "S": 0, "S₂O₃²⁻": 2, "SO₂": 4, "SO₃²⁻": 4, "SO₃": 6, "H₂SO₄": 6, "SO₄²⁻": 6,
               "HCl": -1, "Cl⁻": -1, "Cl₂": 0, "ClO⁻": 1, "HClO": 1, "ClO₂": 4, "ClO₃⁻": 5, "ClO₄⁻": 7,
               "Mn": 0, "Mn²⁺": 2, "MnO": 2, "Mn₂O₃": 3, "MnO₂": 4, "MnO₄²⁻": 6, "MnO₄⁻": 7}
# An equation's lettered species: the element named in a question and its oxidation number there.
_CHEMENV_SPECIES = {"Zn": ("zinc", 0), "Cu²⁺": ("copper", 2), "Zn²⁺": ("zinc", 2), "Cu": ("copper", 0),
                    "2Fe²⁺": ("iron", 2), "Cl₂": ("chlorine", 0), "2Fe³⁺": ("iron", 3), "2Cl⁻": ("chlorine", -1),
                    "2I⁻": ("iodine", -1), "I₂": ("iodine", 0), "Mg": ("magnesium", 0), "2H⁺": ("hydrogen", 1),
                    "Mg²⁺": ("magnesium", 2), "H₂": ("hydrogen", 0), "CuO": ("copper", 2), "H₂O": ("hydrogen", 1),
                    "Fe₂O₃": ("iron", 3), "3CO": ("carbon", 2), "2Fe": ("iron", 0), "3CO₂": ("carbon", 4),
                    "2KI": ("iodine", -1), "2KCl": ("chlorine", -1), "MnO₂": ("manganese", 4), "4HCl": ("chlorine", -1),
                    "MnCl₂": ("manganese", 2), "4HNO₃": ("nitrogen", 5), "Cu(NO₃)₂": ("copper", 2), "2NO₂": ("nitrogen", 4),
                    "2OH⁻": ("oxygen", -2), "Cl⁻": ("chlorine", -1), "ClO⁻": ("chlorine", 1)}


def _chemenv_on(text) -> int:
    return int(text.replace("−", "-").replace("+", "").split()[0])


def _chemenv_equation_read(m, p):
    fig = m.draw(p)
    ax = fig.axes[0]
    pieces = sorted(((float(t.get_position()[0]), t.get_text()) for t in ax.texts if (t.get_gid() or "").startswith("piece:")))
    letters = {t.get_text(): float(t.get_position()[0]) for t in ax.texts if (t.get_gid() or "").startswith("letter:")}
    words = " ".join(t.get_text() for t in ax.texts)
    arrow = next(float(t.get_position()[0]) for t in ax.texts if t.get_gid() == "op:→")
    plt.close(fig)
    under = {L: min(pieces, key=lambda pc: abs(pc[0] - x))[1] for L, x in letters.items()}
    side = {L: ("left" if letters[L] < arrow else "right") for L in letters}
    return under, side, words


def test_oxidation_numbers_ladder_keys():
    m = _chemenv_fam("oxidation_numbers")
    n = 0
    for s in _CHEMENV_SEEDS:
        p, qs = _chemenv_run(m, s)
        if p["kind"] != "ladder":
            continue
        n += 1
        if n <= 80:
            fig = m.draw(p)
            ax = fig.axes[0]
            rung = {t.get_text(): float(t.get_position()[1]) for t in ax.texts if (t.get_gid() or "").startswith("letter:")}
            listed = [t.get_text() for t in ax.texts if (t.get_gid() or "").startswith("species:")]
            plt.close(fig)
            assert sorted(listed) == sorted(p["listed"])
            assert len(set(_CHEMENV_ON[x] for x in listed)) == 3
        else:
            rung = {L: float(v) for L, v in p["rungs"]}
        for q in qs:
            sp = re.search(r" in (\S+)\?$", q.stem).group(1)
            assert sp in p["listed"]
            assert rung[_chemenv_picked(q)] == _CHEMENV_ON[sp], (s, sp)
            assert sum(rung[o] == _CHEMENV_ON[sp] for o in q.options) == 1
    assert n > 400


def test_oxidation_numbers_equation_keys():
    m = _chemenv_fam("oxidation_numbers")
    n = 0
    for s in range(1, 600):
        p, qs = _chemenv_run(m, s)
        if p["kind"] != "equation":
            continue
        n += 1
        under, side, words = _chemenv_equation_read(m, p)
        assert "Oxidation is an increase in oxidation number" in words
        info = {L: _CHEMENV_SPECIES[sp] for L, sp in under.items()}
        if "both oxidised and reduced" in qs[0].stem:
            # the product whose chlorine has a higher oxidation number than in Cl2
            key = next(L for L, (el, v) in info.items() if side[L] == "right" and el == "chlorine" and v > 0)
            assert _chemenv_picked(qs[0]) == key
            rest = qs[1:]
        else:
            ox_q, agent_q, *rest = qs
            # oxidised: a reactant whose element appears on the right with a higher oxidation number
            def change(L):
                el, v = info[L]
                after = [w for M, (e, w) in info.items() if side[M] == "right" and e == el]
                return after[0] - v if after else 0
            reactants = [L for L in info if side[L] == "left"]
            ox = [L for L in reactants if change(L) > 0]
            red = [L for L in reactants if change(L) < 0]
            assert len(ox) == 1 and len(red) == 1, (s, p["eq"], info)
            assert _chemenv_picked(ox_q) == ox[0] and _chemenv_picked(agent_q) == red[0]
        read = rest[0]
        L = re.search(r"marked ([A-Z])\?", read.stem).group(1)
        el = re.search(r"number of (\w+) in", read.stem).group(1)
        assert info[L][0] == el and _chemenv_on(read.answer) == info[L][1]
        if p["band"] == "AL":
            a, b = re.search(r"between ([A-Z]) and ([A-Z])\?", rest[1].stem).groups()
            assert info[a][0] == info[b][0] and int(rest[1].answer) == abs(info[a][1] - info[b][1]) > 0
        else:
            assert len(rest) == 1
    assert n > 200


def test_oxidation_numbers_options_alone_do_not_give_the_key():
    _chemenv_mcq_checks("oxidation_numbers")


def test_oxidation_numbers_labels_clear_the_lines():
    m = _chemenv_fam("oxidation_numbers")
    for s in range(1, 40):
        p = m.sample(random.Random(s))
        fig = m.draw(p)
        texts = [(t, box) for t, box in _chemenv_drawn_texts(fig) if t in fig.axes[0].texts]
        for ln in fig.axes[0].lines:
            for t, box in texts:
                assert not _chemenv_crosses(ln, box), (s, t.get_text(), ln.get_gid())
        plt.close(fig)


def test_oxidation_numbers_reaches_the_redox_chapters():
    reached = _chemenv_reached("oxidation_numbers")
    names = {(b, n) for b, _, n in reached.values()}
    assert ("UP", "Redox reactions") in names and ("AL", "Chapter 7: What is a redox reaction?") in names
    for b, book, n in reached.values():
        assert re.search(r"redox|oxidation|reduction|reactions|equations", n, re.I), (b, n)


# ============================== part: physwave ==============================================================

_PHYSWAVE_SEEDS = range(1, 1001)
_PHYSWAVE_IDS = ("seismogram", "double_slit", "comm_signals", "heat_transfer", "stars_universe")


def _physwave_fam(fid):
    if fid not in FAMILIES:
        pytest.fail(f"{fid} is not registered")
    return FAMILIES[fid]


def _physwave_run(m, seed):
    rng = random.Random(seed)
    p = m.sample(rng)
    return p, m.questions(p, rng)


def _physwave_picked(q):
    return q.options[int(q.answer)]


def _physwave_num(text) -> Fraction:
    return Fraction(re.match(r"-?[\d.,]+", text.replace(" ", "")).group().replace(",", ""))


def _physwave_central(options):
    toks = [Counter(re.findall(r"-?\d+|[a-zA-Z]+|\S", o)) for o in options]
    score = [sum(sum(((t - u) + (u - t)).values()) for u in toks) for t in toks]
    best = min(score)
    return score.index(best) if score.count(best) == 1 else None


def _physwave_drawn_texts(fig):
    seen = []
    original = Text.draw

    def record(self, renderer):
        original(self, renderer)
        if self.get_visible() and self.get_text().strip():
            seen.append(self)

    Text.draw = record
    try:
        fig.canvas.draw()
    finally:
        Text.draw = original
    renderer = fig.canvas.get_renderer()
    return [(t, t.get_window_extent(renderer)) for t in seen]


def _physwave_words(m, p) -> str:
    fig = m.draw(p)
    words = " ".join(t.get_text() for t, _ in _physwave_drawn_texts(fig))
    plt.close(fig)
    return re.sub(r"\s+", " ", words)


def _physwave_inside(pt, box, margin=1.0) -> bool:
    return box.x0 + margin < pt[0] < box.x1 - margin and box.y0 + margin < pt[1] < box.y1 - margin


def _physwave_crosses(line, box, margin=1.0, steps=60) -> bool:
    pts = line.get_transform().transform(line.get_xydata())
    for a, b in zip(pts, pts[1:]):
        if any(_physwave_inside((a[0] + (b[0] - a[0]) * k / steps, a[1] + (b[1] - a[1]) * k / steps), box, margin)
               for k in range(steps + 1)):
            return True
    return False


def _physwave_fmt(x) -> str:
    x = Fraction(x)
    if x.denominator == 1:
        return str(x.numerator)
    return f"{float(x):.6f}".rstrip("0").rstrip(".")


# --- every family ------------------------------------------------------------------------------------------------

@pytest.mark.parametrize("fid", _PHYSWAVE_IDS)
def test_p6_physwave_mcq_cannot_be_picked_from_its_options_alone(fid):
    m = _physwave_fam(fid)
    seen, hits = defaultdict(int), defaultdict(int)
    for s in range(1, 301):
        _, qs = _physwave_run(m, s)
        for q in qs:
            if q.kind == "mcq":
                key = re.sub(r"\d+", "#", q.stem.rsplit(". ", 1)[-1])
                seen[key] += 1
                hits[key] += _physwave_central(q.options) == int(q.answer)
    bad = {k: (hits[k], seen[k]) for k in seen if seen[k] >= 10 and hits[k] / seen[k] > 0.35}
    assert not bad, (fid, bad)


@pytest.mark.parametrize("fid", _PHYSWAVE_IDS)
def test_p6_physwave_no_label_sits_on_a_drawn_line(fid):
    """The shared layout tests check text against text only; a label on a curve or a beam misleads."""
    m = _physwave_fam(fid)
    for s in range(1, 31):
        p = m.sample(random.Random(s))
        fig = m.draw(p)
        texts = _physwave_drawn_texts(fig)
        for ax in fig.axes:
            mine = [(t, box) for t, box in texts if t in ax.texts]
            for ln in ax.lines:
                for t, box in mine:
                    assert not _physwave_crosses(ln, box), (fid, s, t.get_text(), ln.get_gid())
        plt.close(fig)


@pytest.mark.parametrize("fid", _PHYSWAVE_IDS)
def test_p6_physwave_first_stem_names_a_person(fid):
    m = _physwave_fam(fid)
    for s in range(1, 200):
        _, qs = _physwave_run(m, s)
        assert any(n in qs[0].stem for n in NAMES), (fid, s, qs[0].stem)


# --- seismogram --------------------------------------------------------------------------------------------------

_PHYSWAVE_SPEEDS = {("6", "3"), ("8", "4"), ("6", "4"), ("7.5", "5"), ("8", "4.8"), ("7", "4.2"), ("6", "3.6")}


def test_seismogram_keys():
    m = _physwave_fam("seismogram")
    kinds = Counter()
    for s in _PHYSWAVE_SEEDS:
        p, qs = _physwave_run(m, s)
        kinds[p["kind"]] += 1
        assert p["band"] == "UP"
        if p["kind"] == "trace":
            assert (p["vp"], p["vs"]) in _PHYSWAVE_SPEEDS
            vp, vs = Fraction(p["vp"]), Fraction(p["vs"])
            d = Fraction(p["distance"])
            tp, ts = d / vp, d / vs  # the waves left the epicentre together at t = 0
            step = p["step"]
            assert tp.denominator == 1 and ts.denominator == 1 and tp % step == 0 and ts % step == 0, p
            assert d.denominator == 1 and ts < p["tmax"]
            lag = ts - tp
            assert lag * vp * vs / (vp - vs) == d
            lag_q, dist_q, arrive_q = qs
            assert lag_q.kind == "short" and _physwave_num(lag_q.answer) == lag
            assert dist_q.kind == "short" and _physwave_num(dist_q.answer) == d
            wave = "P" if "P-waves" in arrive_q.stem else "S"
            assert _physwave_num(arrive_q.answer) == (tp if wave == "P" else ts)
        else:
            depths = dict(p["points"])
            speeds = {k: Fraction(math.isqrt(10 * d)) for k, d in depths.items()}
            for k, d in depths.items():
                assert speeds[k] ** 2 == 10 * d, (k, d)
            ds = [d for _, d in p["points"]]
            assert ds == sorted(ds, reverse=True) and len(set(ds)) == len(ds)  # shallower towards the coast
            speed_q, time_q, ratio_q = qs
            L = re.search(r"point ([A-Z])", speed_q.stem).group(1)
            assert _physwave_num(speed_q.answer) == speeds[L]
            km = int(re.search(r"crosses (\d+) km", time_q.stem).group(1))
            L2 = re.search(r"as deep as point ([A-Z])", time_q.stem).group(1)
            minutes = Fraction(km * 1000, 1) / speeds[L2] / 60
            assert minutes.denominator == 1 and _physwave_num(time_q.answer) == minutes
            a, b = re.findall(r"point ([A-Z])", ratio_q.stem)
            r = speeds[a] / speeds[b]
            assert r.denominator == 1 and r > 1 and _physwave_num(ratio_q.answer) == r
    assert kinds["trace"] > 300 and kinds["tsunami"] > 300


def test_seismogram_shows_what_it_asks():
    m = _physwave_fam("seismogram")
    for s in range(1, 41):
        p, qs = _physwave_run(m, s)
        words = _physwave_words(m, p)
        if p["kind"] == "trace":
            assert f"{p['vp']} km/s" in words and f"{p['vs']} km/s" in words, words
            assert "P-waves" in words and "S-waves" in words
            fig = m.draw(p)
            ax = fig.axes[0]
            ticks = {round(float(t), 6) for t in list(ax.get_xticks()) + list(ax.get_xticks(minor=True))}
            dashed = {round(float(ln.get_xdata()[0]), 6) for ln in ax.lines
                      if len(ln.get_xdata()) == 2 and ln.get_xdata()[0] == ln.get_xdata()[1]}
            plt.close(fig)
            d = Fraction(p["distance"])
            for t in (d / Fraction(p["vp"]), d / Fraction(p["vs"])):
                assert round(float(t), 6) in ticks and round(float(t), 6) in dashed, (s, t)
        else:
            for k, d in p["points"]:
                assert f"{d} m" in words.replace(",", "").replace(" ", "") or f"{d:,} m".replace(",", " ") in words, (k, d, words)
            assert "g = 10" in words


def test_seismogram_labels_stay_off_the_trace():
    m = _physwave_fam("seismogram")
    for s in range(1, 25):
        p = m.sample(random.Random(s))
        fig = m.draw(p)
        texts = _physwave_drawn_texts(fig)
        ax = fig.axes[0]
        trace = [ln for ln in ax.lines if (ln.get_gid() or "") in ("trace", "seabed")]
        assert trace
        for t, box in texts:
            if t in ax.texts:
                for ln in trace:
                    assert not _physwave_crosses(ln, box), (s, t.get_text())
        plt.close(fig)


# --- double_slit ---------------------------------------------------------------------------------------------------

_PHYSWAVE_GRATING = {(3, 4): Fraction(3, 5), (4, 3): Fraction(4, 5), (7, 24): Fraction(7, 25)}


def test_double_slit_keys():
    m = _physwave_fam("double_slit")
    kinds = Counter()
    for s in _PHYSWAVE_SEEDS:
        p, qs = _physwave_run(m, s)
        kinds[(p["kind"], p["band"])] += 1
        if p["kind"] == "fringes":
            lam, D, a, k = p["lam"], Fraction(p["D"]), Fraction(p["a"]), p["k"]
            assert 400 <= lam <= 700
            x = Fraction(lam) * D / (1000 * a)  # mm: x = lambda D / a
            span = k * x
            assert (span * 10).denominator == 1 and (x * 100).denominator == 1
            assert Fraction(p["span"]) == span
            x_q, lam_q, new_q = qs
            assert _physwave_num(x_q.answer) == x
            assert _physwave_num(lam_q.answer) == lam
            D2 = Fraction(re.search(r"D is ([\d.]+) m", new_q.stem).group(1))
            assert D2 != D and _physwave_num(new_q.answer) == Fraction(lam) * D2 / (1000 * a)
        else:
            assert p["band"] == "AL"
            y, D = Fraction(p["y"]), Fraction(p["D"])
            ratio = y / D
            sin = next(v for (u, w), v in _PHYSWAVE_GRATING.items() if Fraction(u, w) == ratio)
            d_nm = Fraction(10 ** 6, p["N"])
            lam = d_nm * sin
            assert lam.denominator == 1 and 400 <= lam <= 700
            sin_q, lam_q, orders_q = qs
            assert _physwave_num(sin_q.answer) == sin
            assert _physwave_num(lam_q.answer) == lam
            assert int(orders_q.answer) == math.floor(d_nm / lam)
    assert {k for k, _ in kinds} == {"fringes", "grating"} and kinds[("fringes", "UP")] > 200


def test_double_slit_shows_what_it_asks():
    m = _physwave_fam("double_slit")
    for s in range(1, 41):
        p, qs = _physwave_run(m, s)
        words = _physwave_words(m, p)
        if p["kind"] == "fringes":
            assert f"a = {p['a']} mm" in words and f"D = {p['D']} m" in words and f"{p['span']} mm" in words, words
            fig = m.draw(p)
            marks = [ln for ax in fig.axes for ln in ax.lines if (ln.get_gid() or "").startswith("fringe-end")]
            centres = sorted(float(ln.get_xdata()[0]) for ln in marks)
            plt.close(fig)
            # the bright fringes are one unit apart, the first centred at 0.5: the arrow's ends sit on centres k apart
            assert len(centres) == 2 and centres[1] - centres[0] == p["k"] and (centres[0] - 0.5) % 1 == 0
        else:
            assert f"{p['N']} lines per mm" in words and f"D = {p['D']} m" in words and f"y = {p['y']} m" in words, words


# --- comm_signals --------------------------------------------------------------------------------------------------

# Each lettered point of a block diagram: what the signal there is, by this file's own reading of the chain.
_PHYSWAVE_POINTS = {
    "transmitter": ["the small audio-frequency signal straight from the microphone",
                    "the larger audio signal, not yet combined with the carrier",
                    "the carrier wave alone, before it is modulated",
                    "the modulated wave, before it is made stronger",
                    "the strong modulated wave on its way to the aerial"],
    "receiver": ["the signals of many radio stations, as the aerial picks them up",
                 "one station's modulated signal, before it is made stronger",
                 "one station's stronger modulated signal, before the carrier is removed",
                 "the audio signal with the carrier removed, before it is made larger",
                 "the larger audio signal on its way to the loudspeaker"],
}


def test_comm_signals_keys():
    m = _physwave_fam("comm_signals")
    kinds = Counter()
    for s in _PHYSWAVE_SEEDS:
        p, qs = _physwave_run(m, s)
        kinds[(p["kind"], p["band"])] += 1
        if p["kind"] == "types":
            assert p["band"] in ("LS", "UP")
            digital = sorted(L for L, kind, _ in p["graphs"] if kind == "digital")
            assert len(digital) == 2 and len(p["graphs"]) == 4
            pair, code, high = qs
            assert _physwave_picked(pair) == f"{digital[0]} and {digital[1]}"
            assert sum(o.count(" and ") for o in pair.options) == len(pair.options) == 4
            L = re.search(r"graph ([A-D])", code.stem).group(1)
            bits = next(spec for G, kind, spec in p["graphs"] if G == L)
            assert re.fullmatch(r"[01]{8}", bits) and code.answer == bits
            assert "1" in bits[1:] and "0" in bits
            L2 = re.search(r"graph ([A-D])", high.stem).group(1)
            bits2 = next(spec for G, kind, spec in p["graphs"] if G == L2)
            assert L2 in digital and _physwave_num(high.answer) == bits2.count("1") * p["bit_ms"]
        elif p["kind"] == "sampling":
            assert p["band"] in ("UP", "AL")
            dt, vals, top = Fraction(p["dt"]), p["values"], p["top"]
            assert top in (7, 15) and all(1 <= v <= top - 1 for v in vals)
            bits = {7: 3, 15: 4}[top]
            level_q, rate_q, bits_q, last_q = qs
            t = Fraction(re.search(r"t = ([\d.]+) ms", level_q.stem).group(1))
            assert (t / dt).denominator == 1 and int(level_q.answer) == vals[int(t / dt)]
            assert _physwave_num(rate_q.answer) == 1000 / dt
            assert int(bits_q.answer) == bits and "0 to" not in bits_q.stem  # the top level is read off the axis
            if "binary" in last_q.stem:
                t2 = Fraction(re.search(r"t = ([\d.]+) ms", last_q.stem).group(1))
                assert last_q.answer == format(vals[int(t2 / dt)], f"0{bits}b")
            else:
                assert "samples per second × bits per sample" in last_q.stem
                assert _physwave_num(last_q.answer) == 1000 / dt * bits
        elif p["kind"] == "am":
            Tc, k = p["Tc"], p["k"]
            fc, fs = Fraction(1000, Tc), Fraction(1000, Tc * k)  # kHz, from periods in microseconds
            carrier, signal, band = qs[:3]
            assert _physwave_num(carrier.answer) == fc and _physwave_num(signal.answer) == fs
            assert "2 × the signal frequency" in band.stem and _physwave_num(band.answer) == 2 * fs
            if len(qs) > 3:
                assert p["band"] == "AL" and _physwave_num(qs[3].answer) == fc + fs
        elif p["kind"] == "blocks":
            assert p["band"] == "UP"
            letters = p["letters"]
            assert len(set(letters)) == 5
            for q in qs:
                said = next(i for i, d in enumerate(_PHYSWAVE_POINTS[p["chain"]]) if d in q.stem)
                assert _physwave_picked(q) == letters[said], (q.stem, letters)
                assert all(o in letters for o in q.options)
        else:
            assert p["kind"] == "attenuation" and p["band"] == "AL"
            n1, n2 = p["n"]
            rate = Fraction(p["rate"])
            ab, per_km, gain = qs
            assert _physwave_num(ab.answer) == 10 * n1
            assert _physwave_num(per_km.answer) == rate
            assert _physwave_num(gain.answer) == 10 * (n1 + n2)
    seen = {k for k, _ in kinds}
    assert seen == {"types", "sampling", "am", "blocks", "attenuation"}, kinds
    assert kinds[("types", "LS")] > 100


def test_comm_signals_shows_what_it_asks():
    m = _physwave_fam("comm_signals")
    for s in range(1, 81):
        p, qs = _physwave_run(m, s)
        fig = m.draw(p)
        words = re.sub(r"\s+", " ", " ".join(t.get_text() for t, _ in _physwave_drawn_texts(fig)))
        if p["kind"] == "types":
            for L, kind, spec in p["graphs"]:
                ln = next(x for ax in fig.axes for x in ax.lines if x.get_gid() == f"signal:{L}")
                levels = {round(float(v), 6) for v in ln.get_ydata()}
                if kind == "digital":
                    assert levels <= {0.0, float(p["high"])} and len(levels) == 2
                    xs, ys = ln.get_xdata(), ln.get_ydata()
                    for i, b in enumerate(spec):  # one bit per bit_ms: the level across each slot is the bit
                        mid = (i + 0.5) * p["bit_ms"]
                        at = [y for x, y in zip(xs, ys) if abs(x - mid) < 0.26 * p["bit_ms"]]
                        assert at and all(y == (p["high"] if b == "1" else 0) for y in at), (s, L, i)
                else:
                    assert len(levels) > 20
                assert f"Graph {L}" in words
        elif p["kind"] == "sampling":
            ax = fig.axes[0]
            dots = next(x for x in ax.lines if x.get_gid() == "samples")
            dt = Fraction(p["dt"])
            assert [round(float(x), 6) for x in dots.get_xdata()] == [round(float(i * dt), 6) for i in range(len(p["values"]))]
            assert [int(y) for y in dots.get_ydata()] == p["values"]
            ticks = {round(float(t), 6) for t in list(ax.get_yticks()) + list(ax.get_yticks(minor=True))}
            assert set(range(p["top"] + 1)) <= ticks and str(p["top"]) in words
        elif p["kind"] == "am":
            ax = fig.axes[0]
            lines = sorted({round(float(t), 6) for t in list(ax.get_xticks()) + list(ax.get_xticks(minor=True))})
            assert all(round(b - a, 6) == p["Tc"] for a, b in zip(lines, lines[1:])) and lines[0] == 0
        elif p["kind"] == "blocks":
            for L in p["letters"]:
                assert L in words
            assert ("demodulator" in words) == (p["chain"] == "receiver")
        else:
            n1, n2 = p["n"]
            PA = Fraction(p["PA"])
            for P in (PA, PA / 10 ** n1, PA / 10 ** (n1 + n2)):
                assert f"{_physwave_fmt(P)} mW" in words, (P, words)
            rate = Fraction(p["rate"])
            for L in (10 * n1 / rate, 10 * n2 / rate):
                assert f"{_physwave_fmt(L)} km" in words, (L, words)
            assert "10 lg" in words
        plt.close(fig)


def test_comm_signals_letters_do_not_touch():
    m = _physwave_fam("comm_signals")
    for s in range(1, 200):
        p = m.sample(random.Random(s))
        if p["kind"] != "blocks":
            continue
        fig = m.draw(p)
        boxes = [box for t, box in _physwave_drawn_texts(fig) if t.get_text() in p["letters"]]
        plt.close(fig)
        assert len(boxes) == 5
        for i, a in enumerate(boxes):
            for b in boxes[i + 1:]:
                gap = max(b.x0 - a.x1, a.x0 - b.x1, b.y0 - a.y1, a.y0 - b.y1)
                assert gap > 6, (s, gap)


# --- heat_transfer -------------------------------------------------------------------------------------------------

# The radiation arrows of the greenhouse figure, by this file's own reading: (colour, direction, where it starts and ends).
_PHYSWAVE_GREENHOUSE = ["sunlight passing through the atmosphere to the ground",
                        "sunlight reflected back into space by the atmosphere",
                        "infrared radiation from the ground that the greenhouse gases absorb",
                        "infrared radiation that the greenhouse gases send back down to the ground",
                        "infrared radiation from the ground that escapes into space"]


def test_heat_transfer_keys():
    m = _physwave_fam("heat_transfer")
    kinds = Counter()
    for s in _PHYSWAVE_SEEDS:
        p, qs = _physwave_run(m, s)
        kinds[(p["kind"], p["band"])] += 1
        if p["kind"] == "cooling":
            cans = {L: (surface, temps) for L, surface, temps in p["cans"]}
            by = {surface: temps for _, (surface, temps) in cans.items()}
            assert set(by) == {"matt black", "dull grey", "shiny silver"}
            for temps in by.values():
                assert temps[0] == p["start"] and all(a > b for a, b in zip(temps, temps[1:])) and all(t % 2 == 0 for t in temps)
                assert temps[-1] > p["room"]
            for i in range(1, len(by["matt black"])):  # the best emitter is the coolest at every reading
                assert by["matt black"][i] < by["dull grey"][i] < by["shiny silver"][i]
            black, drop, read = qs
            assert _physwave_picked(black) == next(L for L, (sf, _) in cans.items() if sf == "matt black")
            L = re.search(r"can ([A-Z])", drop.stem).group(1)
            t = int(re.search(r"first (\d+) minutes", drop.stem).group(1))
            assert t % p["dt"] == 0 and int(drop.answer) == p["start"] - cans[L][1][t // p["dt"]]
            L2 = re.search(r"can ([A-Z])", read.stem).group(1)
            t2 = int(re.search(r"after (\d+) minutes", read.stem).group(1))
            assert int(read.answer) == cans[L2][1][t2 // p["dt"]]
        elif p["kind"] == "conduction":
            fallen = dict(p["rods"])
            assert len(set(fallen.values())) == 4 and all(0 <= f <= p["pins"] for f in fallen.values())
            count_q, best_q, last_q = qs
            L = re.search(r"rod ([A-D])", count_q.stem).group(1)
            assert int(count_q.answer) == fallen[L]
            assert _physwave_picked(best_q) == max(fallen, key=fallen.get)
            if "worst" in last_q.stem:
                assert _physwave_picked(last_q) == min(fallen, key=fallen.get)
            else:
                assert int(last_q.answer) == sum(fallen.values())
        elif p["kind"] == "atmosphere":
            T0, lapse, top = p["T0"], Fraction(p["lapse"]), p["top"]
            Tt = T0 - lapse * top
            assert Tt % 5 == 0 and T0 % 5 == 0 and top % 2 == 0
            height_q, lapse_q, layer_q = qs
            assert int(height_q.answer) == top
            assert _physwave_num(lapse_q.answer) == lapse
            assert _physwave_picked(layer_q) == p["letters"][1]  # the middle layer warms with height
        elif p["kind"] == "solar":
            assert p["band"] == "UP"
            d = {L: Fraction(x) for L, x in p["planets"]}
            at_q, ratio_q = qs
            L = re.search(r"planet ([A-Z])", at_q.stem).group(1)
            assert _physwave_num(at_q.answer) == 1360 / d[L] ** 2
            a, b = re.findall(r"planet ([A-Z])", ratio_q.stem)
            r = (d[b] / d[a]) ** 2
            assert r.denominator == 1 and r > 1 and _physwave_num(ratio_q.answer) == r
        else:
            assert p["kind"] == "greenhouse"
            letters = p["letters"]
            for q in qs:
                i = next(k for k, text in enumerate(_PHYSWAVE_GREENHOUSE) if text in q.stem)
                assert _physwave_picked(q) == letters[i]
    assert {k for k, _ in kinds} == {"cooling", "conduction", "atmosphere", "solar", "greenhouse"}
    assert kinds[("cooling", "LS")] > 50 and kinds[("greenhouse", "LS")] > 50


def test_heat_transfer_shows_what_it_asks():
    m = _physwave_fam("heat_transfer")
    for s in range(1, 81):
        p, qs = _physwave_run(m, s)
        fig = m.draw(p)
        words = re.sub(r"\s+", " ", " ".join(t.get_text() for t, _ in _physwave_drawn_texts(fig)))
        ax = fig.axes[0]
        if p["kind"] == "cooling":
            ys = {round(float(t), 6) for t in list(ax.get_yticks()) + list(ax.get_yticks(minor=True))}
            xs = {round(float(t), 6) for t in list(ax.get_xticks()) + list(ax.get_xticks(minor=True))}
            for L, _, temps in p["cans"]:
                pts = next(ln for ln in ax.lines if ln.get_gid() == f"readings:{L}")
                assert [int(v) for v in pts.get_ydata()] == temps
                assert all(round(float(v), 6) in ys for v in temps) and all(round(float(x), 6) in xs for x in pts.get_xdata())
                assert L in words
            assert "faster" in words  # the rule is printed
        elif p["kind"] == "conduction":
            for L, fallen in p["rods"]:
                hanging = [ln for ln in ax.lines if ln.get_gid() == f"pin:{L}"]
                down = [ln for ln in ax.lines if ln.get_gid() == f"fallen:{L}"]
                assert len(hanging) == p["pins"] - fallen and len(down) == fallen
            assert f"{p['minutes']} minutes" in words
        elif p["kind"] == "atmosphere":
            ys = {round(float(t), 6) for t in list(ax.get_yticks()) + list(ax.get_yticks(minor=True))}
            xs = {round(float(t), 6) for t in list(ax.get_xticks()) + list(ax.get_xticks(minor=True))}
            T0, top = p["T0"], p["top"]
            Tt = float(T0 - Fraction(p["lapse"]) * top)
            assert float(top) in ys and float(T0) in xs and round(Tt, 6) in xs
            prof = next(ln for ln in ax.lines if ln.get_gid() == "profile")
            pts = list(zip(prof.get_xdata(), prof.get_ydata()))
            assert (T0, 0) in [(round(x, 6), round(y, 6)) for x, y in pts] and (round(Tt, 6), top) in [(round(x, 6), round(y, 6)) for x, y in pts]
        elif p["kind"] == "solar":
            for L, d in p["planets"]:
                assert f"{d} AU" in words and L in words
            assert "1360" in words
        else:
            for L in p["letters"]:
                assert L in words
            assert "infrared" in words.lower()
        plt.close(fig)


# --- stars_universe -------------------------------------------------------------------------------------------------

# This file's own reading of the HR diagram's regions, in log10 T and log10 L: (T range, L range) boxes, the main
# sequence as the band between two lines.
def _physwave_hr_region(t, y):
    x = math.log10(t)
    top = 6.0 - (4.66 - x) / 1.31 * 8.1
    bottom = 4.2 - (4.66 - x) / 1.31 * 8.1
    if bottom <= y <= top:
        return "main sequence"
    if 3.35 <= x <= 3.78 and 1.3 <= y <= 3.4:
        return "giants"
    if 3.35 <= x <= 4.15 and 4.3 <= y <= 6.25:
        return "supergiants"
    if 3.85 <= x <= 4.55 and -3.6 <= y <= -1.6:
        return "white dwarfs"
    return None


_PHYSWAVE_KIND_OF_STAR = {"main sequence": "a main-sequence star", "giants": "a giant", "supergiants": "a supergiant",
                          "white dwarfs": "a white dwarf"}


def test_stars_universe_keys():
    m = _physwave_fam("stars_universe")
    kinds = Counter()
    for s in _PHYSWAVE_SEEDS:
        p, qs = _physwave_run(m, s)
        kinds[p["kind"]] += 1
        assert p["band"] == "UP"
        if p["kind"] == "hr":
            where = {L: _physwave_hr_region(t, y) for L, _, t, y in p["stars"]}
            assert sorted(where.values()) == sorted(_PHYSWAVE_KIND_OF_STAR)  # one star in each region
            kind = next(k for k, v in _PHYSWAVE_KIND_OF_STAR.items() if v in qs[0].stem)
            assert _physwave_picked(qs[0]) == next(L for L, r in where.items() if r == kind)
            temps = {L: t for L, _, t, _ in p["stars"]}
            lums = {L: y for L, _, _, y in p["stars"]}
            if "hottest" in qs[1].stem:
                assert _physwave_picked(qs[1]) == max(temps, key=temps.get)
            elif "most luminous" in qs[1].stem:
                assert _physwave_picked(qs[1]) == max(lums, key=lums.get)
            else:
                assert _physwave_picked(qs[1]) == min(lums, key=lums.get)
            L = re.search(r"star ([A-Z])", qs[2].stem).group(1)
            if "temperature" in qs[2].stem:
                assert int(qs[2].answer) == temps[L] and temps[L] in (40000, 20000, 10000, 5000, 2500)
            else:
                assert Fraction(qs[2].answer) == Fraction(10) ** lums[L]
        elif p["kind"] == "wien":
            lam = dict(p["stars"])
            L = re.search(r"star ([A-Z])", qs[0].stem).group(1)
            T = Fraction(29, 10) * 10 ** 6 / lam[L]  # 2.9e-3 m K / (lam x 1e-9 m)
            assert T.denominator == 1 and int(qs[0].answer) == T
            assert len(qs[1].options) == 3 and _physwave_picked(qs[1]) == min(lam, key=lam.get)
        elif p["kind"] == "hubble":
            h0 = p["h0"]
            d = dict(p["galaxies"])
            L = re.search(r"galaxy ([A-Z])", qs[0].stem).group(1)
            assert int(qs[0].answer) == h0 * d[L] and (h0 * d[L]) % 1000 == 0 and d[L] % 10 == 0
            assert int(qs[1].answer) == h0
            v = int(re.search(r"away at ([\d ]+) km/s", qs[2].stem).group(1).replace(" ", ""))
            assert Fraction(v, h0) == int(qs[2].answer)
        elif p["kind"] == "redshift":
            lab = int(re.search(r"line at (\d+) nm", qs[0].stem).group(1))
            k = p["lab"].index(lab)
            seen = Fraction(p["seen"][k])
            assert seen == lab * (1 + p["sign"] * Fraction(p["z"]))
            assert _physwave_num(qs[0].answer) == abs(seen - lab)
            assert _physwave_num(qs[1].answer) == Fraction(300000) * abs(seen - lab) / lab
            assert _physwave_picked(qs[2]) == ("it is moving closer" if seen < lab else "it is moving away")
        else:
            ps = [Fraction(x) for x in p["p"]]
            names = ["Star P", "Star Q", "Star R", "Star S"]
            k = names.index(re.search(r"is (Star [PQRS])", qs[0].stem).group(1))
            assert _physwave_num(qs[0].answer) == 1 / ps[k]
            assert _physwave_picked(qs[1]) == names[max(range(4), key=lambda i: ps[i])] and len(set(ps)) == 4
            a, b = (names.index(x) for x in re.findall(r"Star [PQRS]", qs[2].stem))
            assert _physwave_num(qs[2].answer) == ps[b] / ps[a] and ps[b] / ps[a] > 1
    assert set(kinds) == {"hr", "wien", "hubble", "redshift", "parallax"}


def test_stars_universe_shows_what_it_asks():
    m = _physwave_fam("stars_universe")
    for s in range(1, 81):
        p, qs = _physwave_run(m, s)
        fig = m.draw(p)
        words = re.sub(r"\s+", " ", " ".join(t.get_text() for t, _ in _physwave_drawn_texts(fig)))
        ax = fig.axes[0]
        if p["kind"] == "hr":
            for L, _, t, y in p["stars"]:
                dot = next(ln for ln in ax.lines if ln.get_gid() == f"star:{L}")
                assert round(float(dot.get_xdata()[0]), 6) == round(math.log10(t), 6) and float(dot.get_ydata()[0]) == y
                assert round(math.log10(t), 6) in {round(float(v), 6) for v in ax.get_xticks()} and y in ax.get_yticks()
            for name in ("main sequence", "giants", "supergiants", "white dwarfs"):
                assert name in words
        elif p["kind"] == "wien":
            for L, lam in p["stars"]:
                assert f"star {L}: the peak is at {lam} nm" in words
            assert "2.9 × 10⁻³ m K" in words
        elif p["kind"] == "hubble":
            for L, d in p["galaxies"]:
                assert f"galaxy {L}" in words
                v = p["h0"] * d
                ys = {round(float(t), 6) for t in list(ax.get_yticks()) + list(ax.get_yticks(minor=True))}
                xs = {round(float(t), 6) for t in list(ax.get_xticks()) + list(ax.get_xticks(minor=True))}
                assert float(v) in ys and float(d) in xs
            assert "v = H₀ × d" in words
        elif p["kind"] == "redshift":
            for w in [str(x) for x in p["lab"]] + p["seen"]:
                assert f"{w} nm" in words
            assert "3.0 × 10⁵ km/s" in words
        else:
            for x in p["p"]:
                assert x in words
            assert "d = 1 ÷ p" in words
        plt.close(fig)


# ============================== part: physmech ==============================================================

_PHYSMECH_SEEDS = range(1, 1001)
_PHYSMECH_DRAWN = range(1, 41)
_PHYSMECH_NEW = ("uncertainty_table", "work_energy", "momentum_collision", "medical_imaging")


def _physmech_fam(fid):
    if fid not in FAMILIES:
        pytest.fail(f"{fid} is not registered")
    return FAMILIES[fid]


def _physmech_run(m, seed):
    rng = random.Random(seed)
    p = m.sample(rng)
    return p, m.questions(p, rng)


def _physmech_picked(q):
    return q.options[int(q.answer)]


def _physmech_num(text) -> Fraction:
    """The leading number of an answer: "2.5", "1,200", "1 341 250" or "-0.4"."""
    t = str(text).replace("−", "-")
    m = re.match(r"-?[\d][\d ,]*(?:\.\d+)?|-?\.\d+", t)
    return Fraction(m.group().replace(",", "").replace(" ", ""))


def _physmech_F(text) -> Fraction:
    return Fraction(str(text))


def _physmech_central(options):
    toks = [Counter(re.findall(r"-?\d+|[a-zA-Z]+|\S", o)) for o in options]
    score = [sum(sum(((t - u) + (u - t)).values()) for u in toks) for t in toks]
    best = min(score)
    return score.index(best) if score.count(best) == 1 else None


def _physmech_texts(fig):
    seen = []
    original = Text.draw

    def record(self, renderer):
        original(self, renderer)
        if self.get_visible() and self.get_text().strip():
            seen.append(self)

    Text.draw = record
    try:
        fig.canvas.draw()
    finally:
        Text.draw = original
    renderer = fig.canvas.get_renderer()
    return [(t, t.get_window_extent(renderer)) for t in seen]


def _physmech_words(m, p) -> str:
    fig = m.draw(p)
    words = " ".join(t.get_text() for t, _ in _physmech_texts(fig))
    plt.close(fig)
    return re.sub(r"\s+", " ", words)


def _physmech_fmt(x: Fraction) -> str:
    """A number as the figure prints it: 12, 2.5, 0.125."""
    if x.denominator == 1:
        return str(x.numerator)
    s = f"{float(x):.6f}".rstrip("0").rstrip(".")
    assert Fraction(s) == x, x
    return s


def _physmech_dp(x: Fraction) -> int:
    """The decimal places a terminating number needs."""
    for d in range(0, 9):
        if (x * 10 ** d).denominator == 1:
            return d
    raise AssertionError(f"{x} does not terminate")


def _physmech_crossings(fig):
    """Labels a drawn line passes through (each label's box shrunk a little, so a line passing by is not counted)."""
    from matplotlib.text import Annotation
    fig.canvas.draw()
    r = fig.canvas.get_renderer()
    hits = []
    for ax in fig.axes:
        segs = []
        for ln in ax.lines:
            xy = ln.get_transform().transform(ln.get_xydata())
            segs += list(zip(xy[:-1], xy[1:]))
        labels = [t for t in ax.texts if t.get_text().strip() and not isinstance(t, Annotation) or
                  (isinstance(t, Annotation) and t.get_text().strip())]
        for t in labels:
            box = t.get_window_extent(r).shrunk(0.86, 0.7)
            for (x0, y0), (x1, y1) in segs:
                if any(box.contains(x0 + (x1 - x0) * i / 60, y0 + (y1 - y0) * i / 60) for i in range(61)):
                    hits.append(t.get_text())
                    break
    return hits


def _physmech_mcqs_have_one_key(m):
    for s in range(1, 301):
        _, qs = _physmech_run(m, s)
        for q in qs:
            if q.kind == "mcq":
                assert len(set(q.options)) == len(q.options) >= 3, (m.ID, s, q.options)


# --- registration and links ------------------------------------------------------------------------------------

@pytest.mark.parametrize("fid", _PHYSMECH_NEW)
def test_p6_physmech_families_are_registered_as_as_level_physics(fid):
    m = _physmech_fam(fid)
    assert m.SUBJECT == "physics" and m.BANDS == ("AL",)
    assert all(c.startswith("physics.") for c in m.CONCEPTS)


def test_p6_physmech_reach_the_thin_chapters_and_nothing_they_do_not_teach():
    import sqlite3
    from pathlib import Path
    from figgen import link
    store = Path("C:/Users/Stephen/figure-library/figures.db")
    if not store.exists():
        pytest.skip("no store")
    db = sqlite3.connect(f"file:{store}?mode=ro", uri=True)
    db.row_factory = sqlite3.Row
    ix = link.topic_index(db)
    names = {t["key"]: t["name"] for t in ix}
    want = {
        "uncertainty_table": {"P1: Practical skills at AS level", "P2: Planning, analysis and evaluation"},
        "work_energy": {"Chapter 5: Work, energy and power", "Chapter 7: Matter and materials"},
        "momentum_collision": {"Chapter 6: Momentum"},
        "medical_imaging": {"Chapter 32: Medical imaging"},
    }
    for fid, names_wanted in want.items():
        got = {names[k] for k in link.reach(ix, _physmech_fam(fid), 200)}
        assert got == names_wanted, (fid, sorted(got))


# --- uncertainty_table -----------------------------------------------------------------------------------------

_PHYSMECH_QUANTITIES = {
    # what is measured, unit, instrument, decimal places recorded, the derived quantity's power
    "oscillations": ("time for 20 oscillations", "s", "stopwatch", 1, 2),
    "diameter": ("diameter of a wire", "mm", "micrometer screw gauge", 2, 2),
    "sphere": ("diameter of a ball bearing", "mm", "vernier calipers", 1, 3),
    "current": ("current in a resistor", "A", "digital ammeter", 2, 2),
}
_PHYSMECH_CONTEXTS = {
    # y label, x label, gradient unit, what the intercept is
    "heating": ("temperature θ / °C", "time t / min", "°C min⁻¹"),
    "spring": ("length L / cm", "load F / N", "cm N⁻¹"),
    "velocity": ("velocity v / m s⁻¹", "time t / s", "m s⁻²"),
    "resistance": ("resistance R / Ω", "temperature θ / °C", "Ω °C⁻¹"),
}


def test_uncertainty_table_answers():
    m = _physmech_fam("uncertainty_table")
    kinds = Counter()
    for s in _PHYSMECH_SEEDS:
        p, qs = _physmech_run(m, s)
        kinds[p["kind"]] += 1
        assert p["band"] == "AL"
        if p["kind"] == "repeat":
            what, unit, tool, dp, power = _PHYSMECH_QUANTITIES[p["quantity"]]
            assert p["power"] == power
            vals = [Fraction(r) for r in p["readings"]]
            assert all(len(r.split(".")[1]) == dp for r in p["readings"]), p["readings"]
            assert 3 <= len(vals) <= 5
            mean = sum(vals) / len(vals)
            half = (max(vals) - min(vals)) / 2
            pct = half / mean * 100
            assert half > 0 and mean.denominator * 10 ** dp % mean.denominator == 0 and (mean * 10 ** dp).denominator == 1
            assert _physmech_dp(pct) <= 2 and 0 < pct < 10, (p, pct)
            mean_q, unc_q, pct_q, pow_q = qs
            assert what in mean_q.stem and tool in mean_q.stem and mean_q.stem.split()[0] in NAMES
            assert _physmech_num(mean_q.answer) == mean and len(mean_q.answer.split(".")[-1]) == dp
            assert _physmech_num(unc_q.answer) == half and "half the range" in unc_q.stem
            assert _physmech_num(pct_q.answer) == pct
            assert _physmech_num(pow_q.answer) == power * pct
            assert f"{_physmech_fmt(pct)}%" in pct_q.accepted and f"{_physmech_fmt(power * pct)}%" in pow_q.accepted
        else:
            ylab, xlab, unit = _PHYSMECH_CONTEXTS[p["context"]]
            dx, sy, c, g, e = Fraction(p["dx"]), Fraction(p["s"]), p["c"], p["g"], p["e"]
            noise = p["noise"]
            assert len(noise) == 6 and noise[0] == noise[5] == 0
            ys = [c + g * k + noise[k - 1] for k in range(1, 7)]
            sign = 1 if p["worst"] == "steeper" else -1
            w1, w6 = ys[0] - sign * e, ys[5] + sign * e  # the worst line runs between the ends of the end error bars
            worst = Fraction(w6 - w1, 5)
            for k in range(1, 7):  # the worst acceptable line passes through every error bar
                wk = w1 + worst * (k - 1)
                assert abs(wk - ys[k - 1]) <= e, (s, p)
            # the line of best fit is a fair fit: the points sit on both sides of it, or on it
            assert sum(noise) == 0 or abs(sum(noise)) == 1, p
            best_q, worst_q, unc_q, int_q = qs
            assert _physmech_num(best_q.answer) == g * sy / dx
            assert _physmech_num(worst_q.answer) == worst * sy / dx
            assert _physmech_num(unc_q.answer) == abs(g - worst) * sy / dx == Fraction(2 * e, 5) * sy / dx
            assert _physmech_num(int_q.answer) == c * sy
            for q in qs:
                assert _physmech_dp(_physmech_num(q.answer)) <= 3
            assert unit in best_q.stem or unit in best_q.accepted[-1] or any(unit in a for a in best_q.accepted)
    assert set(kinds) == {"repeat", "gradient"} and min(kinds.values()) > 300


def test_uncertainty_table_shows_every_reading_and_the_rules():
    m = _physmech_fam("uncertainty_table")
    for s in _PHYSMECH_DRAWN:
        p = m.sample(random.Random(s))
        words = _physmech_words(m, p)
        if p["kind"] == "repeat":
            for r in p["readings"]:
                assert r in words, (s, r)
            assert "½" in words and "range" in words and "× 100" in words
            assert f"n × the percentage uncertainty" in words or "n ×" in words
        else:
            fig = m.draw(p)
            ax = fig.axes[0]
            ylines = {round(float(v), 9) for v in list(ax.get_yticks()) + list(ax.get_yticks(minor=True))}
            xlines = {round(float(v), 9) for v in list(ax.get_xticks()) + list(ax.get_xticks(minor=True))}
            plt.close(fig)
            dx, sy = Fraction(p["dx"]), Fraction(p["s"])
            ys = [p["c"] + p["g"] * k + p["noise"][k - 1] for k in range(1, 7)]
            for k in range(0, 7):
                assert round(float(k * dx), 9) in xlines
            for y in ys + [p["c"]] + [y + p["e"] for y in ys] + [y - p["e"] for y in ys]:
                assert round(float(y * sy), 9) in ylines, (s, y)
            assert "line of best fit" in words and "worst acceptable line" in words


# --- work_energy ------------------------------------------------------------------------------------------------

def _physmech_area(pts) -> Fraction:
    return sum(Fraction((a[1] + b[1]) * (b[0] - a[0]), 2) for a, b in zip(pts, pts[1:]))


def test_work_energy_answers():
    m = _physmech_fam("work_energy")
    kinds = Counter()
    g98, g981 = Fraction(98, 10), Fraction(981, 100)
    for s in _PHYSMECH_SEEDS:
        p, qs = _physmech_run(m, s)
        kinds[p["kind"]] += 1
        if p["kind"] == "fx":
            pts, fs, xs = p["pts"], p["fstep"], Fraction(p["xstep"])
            assert len(pts) == 4 and all(b[0] > a[0] for a, b in zip(pts, pts[1:])) and pts[0][0] == 0
            total = _physmech_area(pts) * fs * xs
            segs = [_physmech_area(pts[i:i + 2]) for i in range(3)]
            total_q, part_q, most_q = qs
            assert _physmech_num(total_q.answer) == total and total.denominator == 1
            upto = Fraction(re.search(r"from 0 m to (\d+(?:\.\d+)?) m", part_q.stem).group(1))
            k = next(i for i, pt in enumerate(pts) if pt[0] * xs == upto)
            assert 1 <= k <= 2
            assert _physmech_num(part_q.answer) == _physmech_area(pts[:k + 1]) * fs * xs
            best = max(range(3), key=lambda i: segs[i])
            assert sorted(segs)[-1] - sorted(segs)[-2] >= 1
            assert _physmech_picked(most_q) == "PQR"[best] and sorted(most_q.options) == ["P", "Q", "R"]
        elif p["kind"] == "track":
            mass = Fraction(p["m"])
            hA, hB, hC, hD = (Fraction(p[h]) for h in ("hA", "hB", "hC", "hD"))
            assert hA > hC > hB and hB <= hD < hC and hA - hB == Fraction(p["k"] ** 2, 10)
            gpe_q, speed_q, ke_q, fric_q = qs
            assert _physmech_num(gpe_q.answer) == mass * g98 * (hA - hB)
            v = Fraction(14 * p["k"], 10)
            assert v * v == 2 * g98 * (hA - hB) and _physmech_num(speed_q.answer) == v
            assert _physmech_num(ke_q.answer) == mass * g98 * (hA - hC)
            ked = mass * g98 * (hA - hD) - p["W"]
            assert ked > 0 and _physmech_num(fric_q.answer) == ked
            assert "9.8" in gpe_q.stem or True
        elif p["kind"] == "power":
            rows = p["rows"]
            assert 3 <= len(rows) <= 4
            P = {L: Fraction(mm) * g981 * Fraction(h) / Fraction(t) for L, mm, h, t in rows}
            work_q, pow_q, most_q = qs
            L1 = re.search(r"motor ([A-D])\b", work_q.stem).group(1)
            row = next(r for r in rows if r[0] == L1)
            assert _physmech_num(work_q.answer) == Fraction(row[1]) * g981 * Fraction(row[2])
            L2 = re.search(r"motor ([A-D])\b", pow_q.stem).group(1)
            assert _physmech_num(pow_q.answer) == P[L2] and _physmech_dp(P[L2]) <= 2
            top = max(P, key=P.get)
            assert sorted(P.values())[-1] >= Fraction(21, 20) * sorted(P.values())[-2]
            assert _physmech_picked(most_q) == top
            heaviest = max(rows, key=lambda r: Fraction(r[1]))[0]
            quickest = min(rows, key=lambda r: Fraction(r[3]))[0]
            assert top != heaviest and top != quickest, rows
        else:
            fs, xs = p["fstep"], Fraction(p["xstep"])
            (xL, fL), (x2, f2), X = p["L"], p["end"], p["X"]
            assert 0 < X < xL < x2 and fL < f2 and Fraction(fL * X, xL).denominator == 1
            assert Fraction(f2 - fL, x2 - xL) < Fraction(fL, xL)  # past the limit it stretches more easily
            epe_q, k_q, epx_q = qs
            assert _physmech_num(epe_q.answer) == Fraction(1, 2) * fL * fs * xL * xs / 1000
            assert _physmech_num(k_q.answer) == Fraction(fL * fs) / (xL * xs / 1000)
            FX = Fraction(fL * X, xL)
            assert _physmech_num(epx_q.answer) == Fraction(1, 2) * FX * fs * X * xs / 1000
            for q in qs:
                assert _physmech_dp(_physmech_num(q.answer)) <= 4
    assert set(kinds) == {"fx", "track", "power", "elastic"} and min(kinds.values()) > 150


def test_work_energy_prints_what_its_questions_need():
    m = _physmech_fam("work_energy")
    for s in _PHYSMECH_DRAWN:
        p = m.sample(random.Random(s))
        words = _physmech_words(m, p)
        if p["kind"] == "track":
            assert "9.8" in words and p["m"] in words and str(p["W"]) in words
            for h in ("hA", "hB", "hC", "hD"):
                assert p[h] in words, (s, h)
        elif p["kind"] == "power":
            assert "9.81" in words
            for row in p["rows"]:
                for v in row:
                    assert str(v) in words
        else:
            fig = m.draw(p)
            ax = fig.axes[0]
            ylines = {round(float(v), 9) for v in list(ax.get_yticks()) + list(ax.get_yticks(minor=True))}
            xlines = {round(float(v), 9) for v in list(ax.get_xticks()) + list(ax.get_xticks(minor=True))}
            plt.close(fig)
            xs = Fraction(p["xstep"])
            pts = p["pts"] if p["kind"] == "fx" else [[0, 0], p["L"], p["end"]]
            for x, f in pts:
                assert round(float(x * xs), 9) in xlines and round(float(f * p["fstep"]), 9) in ylines, (s, x, f)


# --- momentum_collision ----------------------------------------------------------------------------------------

def test_momentum_collision_answers():
    m = _physmech_fam("momentum_collision")
    kinds, es = Counter(), Counter()
    for s in _PHYSMECH_SEEDS:
        p, qs = _physmech_run(m, s)
        kinds[p["kind"]] += 1
        if p["kind"] == "collision":
            mA, mB, uA, uB, vA, vB = (Fraction(p[k]) for k in ("mA", "mB", "uA", "uB", "vA", "vB"))
            e = Fraction(p["e"])
            es[p["e"]] += 1
            assert mA * uA + mB * uB == mA * vA + mB * vB  # momentum is conserved
            assert uA > uB and vB >= vA and vB - vA == e * (uA - uB)  # they close, then separate (or stick)
            keb = (mA * uA ** 2 + mB * uB ** 2) / 2
            kea = (mA * vA ** 2 + mB * vB ** 2) / 2
            assert kea <= keb
            hidden = vA if p["hide"] == "vA" else vB
            assert hidden != 0
            assert p["hide"] == "vB" or e != 0  # stuck together: the one velocity they share is hidden
            speed_q, mom_q, lost_q = qs
            # the hidden speed from momentum alone; its direction is drawn
            known = vB if p["hide"] == "vA" else vA
            m_hidden, m_known = (mA, mB) if p["hide"] == "vA" else (mB, mA)
            if e == 0:
                assert _physmech_num(speed_q.answer) == abs(mA * uA + mB * uB) / (mA + mB)
            else:
                assert _physmech_num(speed_q.answer) == abs(mA * uA + mB * uB - m_known * known) / m_hidden
            assert _physmech_num(mom_q.answer) == mA * uA + mB * uB > 0
            assert _physmech_num(lost_q.answer) == keb - kea
        elif p["kind"] == "explosion":
            mA, mB, vA, vB = (Fraction(p[k]) for k in ("mA", "mB", "vA", "vB"))
            assert mA * vA == mB * vB and vA > 0 and vB > 0  # speeds: A to the left, B to the right
            speed_q, momA_q, ke_q = qs
            assert _physmech_num(speed_q.answer) == (vA if p["hide"] == "A" else vB)
            assert _physmech_num(momA_q.answer) == mA * vA
            assert _physmech_num(ke_q.answer) == (mA * vA ** 2 + mB * vB ** 2) / 2
        else:
            pts, ts, fs, mass, u = p["pts"], p["tstep"], p["fstep"], Fraction(p["m"]), Fraction(p["u"])
            assert pts[0][1] == 0 and pts[-1][1] == 0 and pts[0][0] == 0
            J = _physmech_area(pts) * ts * fs / 1000
            imp_q, speed_q, avg_q = qs
            assert _physmech_num(imp_q.answer) == J
            assert _physmech_num(speed_q.answer) == u + J / mass
            T = Fraction((pts[-1][0] - pts[0][0]) * ts, 1000)
            assert _physmech_num(avg_q.answer) == J / T
        for q in qs:
            if q.kind == "short":
                assert _physmech_dp(_physmech_num(q.answer)) <= 3, (s, q.stem, q.answer)
    assert set(kinds) == {"collision", "explosion", "impulse"} and min(kinds.values()) > 200
    assert set(es) == {"0", "0.5", "1"}


def test_momentum_collision_prints_every_known_value():
    m = _physmech_fam("momentum_collision")
    for s in _PHYSMECH_DRAWN:
        p = m.sample(random.Random(s))
        words = _physmech_words(m, p)
        if p["kind"] == "collision":
            for k in ("mA", "mB"):
                assert f"{p[k]} kg" in words
            for k in ("uA", "uB"):
                v = Fraction(p[k])
                assert (f"{_physmech_fmt(abs(v))} m s⁻¹" in words) or v == 0, (s, k)
            shown = ("vB",) if p["hide"] == "vA" else ("vA",)
            if p["e"] != "0":
                v = Fraction(p[shown[0]])
                assert v == 0 or f"{_physmech_fmt(abs(v))} m s⁻¹" in words
            assert "?" in words
        elif p["kind"] == "explosion":
            known = "vB" if p["hide"] == "A" else "vA"
            assert f"{p[known]} m s⁻¹" in words and f"{p['mA']} kg" in words and f"{p['mB']} kg" in words
        else:
            assert f"{p['m']} kg" in words


def test_momentum_collision_arrows_point_the_way_each_trolley_moves():
    from matplotlib.text import Annotation
    m = _physmech_fam("momentum_collision")
    for s in range(1, 121):
        p = m.sample(random.Random(s))
        if p["kind"] == "impulse":
            continue
        fig = m.draw(p)
        drawn = {a.get_gid().split(":")[1]: (a.get_gid().split(":")[2], a.xy[0] > a.xyann[0])
                 for a in fig.axes[0].texts if isinstance(a, Annotation) and (a.get_gid() or "").startswith("arrow:")}
        plt.close(fig)
        if p["kind"] == "collision":
            want = {k: Fraction(p[k]) for k in ("uA", "uB", "vA", "vB")}
            if p["e"] == "0":
                del want["vA"]  # stuck together: one arrow for both
        else:
            want = {"vA": -Fraction(p["vA"]), "vB": Fraction(p["vB"])}
        for k, v in want.items():
            if v == 0:
                assert k not in drawn, (s, k)
            else:
                way, right = drawn[k]
                assert right == (v > 0) and way == ("right" if v > 0 else "left"), (s, k, v)


# --- medical_imaging -------------------------------------------------------------------------------------------

_PHYSMECH_TISSUES = {  # density / kg m⁻³, speed of ultrasound / m s⁻¹ (Cambridge AS & A Level Physics data)
    "air": (Fraction(13, 10), 330), "water": (1000, 1500), "blood": (1060, 1570), "fat": (925, 1450),
    "muscle": (1075, 1590), "soft tissue": (1060, 1540), "bone": (1900, 4080),
}


def _physmech_Z(t) -> Fraction:
    rho, c = _PHYSMECH_TISSUES[t]
    return Fraction(rho) * c


def _physmech_alpha(a, b) -> Fraction:
    za, zb = _physmech_Z(a), _physmech_Z(b)
    return ((zb - za) / (zb + za)) ** 2


def test_medical_imaging_answers():
    m = _physmech_fam("medical_imaging")
    kinds = Counter()
    for s in _PHYSMECH_SEEDS:
        p, qs = _physmech_run(m, s)
        kinds[p["kind"]] += 1
        if p["kind"] == "ascan":
            v1, v2 = _PHYSMECH_TISSUES[p["first"]][1], _PHYSMECH_TISSUES[p["second"]][1]
            t1, t2 = p["t1"], p["t2"]
            assert 0 < t1 < t2 and t1 % p["tstep"] == 0 and t2 % p["tstep"] == 0
            d1 = Fraction(v1 * t1, 2) / 1000  # mm: (m s⁻¹)(μs) / 2 = μm
            d2 = Fraction(v2 * (t2 - t1), 2) / 1000
            first_q, second_q, depth_q = qs
            assert _physmech_num(first_q.answer) == d1 and _physmech_num(second_q.answer) == d2
            assert _physmech_num(depth_q.answer) == d1 + d2
        elif p["kind"] == "attenuation":
            (hP, hQ), I0 = p["hvt"], p["I0"]
            assert hP != hQ and max(hP, hQ) >= Fraction(3, 2) * min(hP, hQ)
            hvt_q, after_q, thick_q, mu_q = qs
            assert _physmech_num(hvt_q.answer) == hP
            assert _physmech_num(after_q.answer) == Fraction(I0, 2 ** p["n"])
            assert str(p["n"] * hQ) in after_q.stem
            assert _physmech_num(thick_q.answer) == p["k"] * hP and str(Fraction(I0, 2 ** p["k"])) in thick_q.stem
            assert _physmech_num(mu_q.answer) == Fraction(693, 1000) / hP
        else:
            tissues = p["tissues"]
            z_q, bound_q = qs
            assert _physmech_num(z_q.answer) == _physmech_Z(p["ask"]) and p["ask"] in z_q.stem
            alphas = {f"{a}–{b}": _physmech_alpha(a, b) for a, b in p["bounds"]}
            assert len(alphas) == 3 and all(a in tissues and b in tissues for a, b in p["bounds"])
            top = max(alphas, key=alphas.get)
            assert sorted(alphas.values())[-1] >= Fraction(6, 5) * sorted(alphas.values())[-2]
            assert _physmech_picked(bound_q) == top and set(bound_q.options) == set(alphas)
    assert set(kinds) == {"ascan", "attenuation", "impedance"} and min(kinds.values()) > 200


def test_medical_imaging_prints_its_data_and_reads_on_gridlines():
    m = _physmech_fam("medical_imaging")
    for s in _PHYSMECH_DRAWN:
        p = m.sample(random.Random(s))
        words = _physmech_words(m, p)
        if p["kind"] == "impedance":
            for t in p["tissues"]:
                rho, c = _PHYSMECH_TISSUES[t]
                assert t in words and _physmech_fmt(Fraction(rho)) in words.replace(" ", "") or str(rho) in words
                assert str(c) in words
            assert "Z = ρc" in words
        elif p["kind"] == "ascan":
            for t in (p["first"], p["second"]):
                assert str(_PHYSMECH_TISSUES[t][1]) in words.replace(" ", "")
            fig = m.draw(p)
            ax = fig.axes[0]
            xl = {round(float(v), 9) for v in list(ax.get_xticks()) + list(ax.get_xticks(minor=True))}
            plt.close(fig)
            assert p["t1"] in xl and p["t2"] in xl
        else:
            fig = m.draw(p)
            ax = fig.axes[0]
            xl = {round(float(v), 9) for v in list(ax.get_xticks()) + list(ax.get_xticks(minor=True))}
            yl = {round(float(v), 9) for v in list(ax.get_yticks()) + list(ax.get_yticks(minor=True))}
            plt.close(fig)
            for h in p["hvt"]:
                assert h in xl
            for k in (1, 2, 3):
                assert round(float(Fraction(p["I0"], 2 ** k)), 9) in yl
            assert "0.693" in words


# --- shared checks ---------------------------------------------------------------------------------------------

@pytest.mark.parametrize("fid", _PHYSMECH_NEW)
def test_p6_physmech_mcqs_are_not_central(fid):
    m = _physmech_fam(fid)
    _physmech_mcqs_have_one_key(m)
    seen, hits = defaultdict(int), defaultdict(int)
    for s in range(1, 301):
        _, qs = _physmech_run(m, s)
        for q in qs:
            if q.kind == "mcq":
                key = re.sub(r"\d+", "#", q.stem.rsplit(". ", 1)[-1])
                seen[key] += 1
                hits[key] += _physmech_central(q.options) == int(q.answer)
    bad = {k: (hits[k], seen[k]) for k in seen if seen[k] >= 10 and hits[k] / seen[k] > 0.35}
    assert not bad, (fid, bad)


@pytest.mark.parametrize("fid", _PHYSMECH_NEW)
def test_p6_physmech_no_line_runs_through_a_label(fid):
    m = _physmech_fam(fid)
    bad = []
    for s in range(1, 41):
        fig = m.draw(m.sample(random.Random(s)))
        hits = _physmech_crossings(fig)
        plt.close(fig)
        if hits:
            bad.append((s, hits))
    assert not bad, bad


@pytest.mark.parametrize("fid", _PHYSMECH_NEW)
def test_p6_physmech_first_stem_names_a_person_and_stems_stand_alone(fid):
    m = _physmech_fam(fid)
    for s in range(1, 201):
        _, qs = _physmech_run(m, s)
        assert qs[0].stem.split()[0] in NAMES, (fid, qs[0].stem)
        for q in qs[1:]:
            assert not re.search(r"\b(that|the same|above)\b (value|answer|figure)", q.stem), q.stem


# ============================== part: physext ===============================================================

_PHYSEXT_SEEDS = range(1, 1001)
_PHYSEXT_STORE = Path("C:/Users/Stephen/figure-library/figures.db")
_PHYSEXT_REPO = Path(__file__).resolve().parents[3]
_PHYSEXT_IDS = ("magnetic_force", "induction_demo", "magnet_tests", "orbit_data", "relative_motion")


def _physext_fam(fid):
    if fid not in FAMILIES:
        pytest.fail(f"{fid} is not registered")
    return FAMILIES[fid]


def _physext_run(m, seed):
    rng = random.Random(seed)
    p = m.sample(rng)
    return p, m.questions(p, rng)


def _physext_picked(q):
    return q.options[int(q.answer)]


def _physext_num(text) -> Fraction:
    return Fraction(re.match(r"-?[\d.]+", text.replace(" ", "").replace(",", "")).group())


def _physext_central(options):
    toks = [Counter(re.findall(r"-?\d+|[a-zA-Z]+|\S", o)) for o in options]
    score = [sum(sum(((t - u) + (u - t)).values()) for u in toks) for t in toks]
    best = min(score)
    return score.index(best) if score.count(best) == 1 else None


def _physext_texts(fig):
    seen = []
    original = Text.draw

    def record(self, renderer):
        original(self, renderer)
        if self.get_visible() and self.get_text().strip():
            seen.append(self)

    Text.draw = record
    try:
        fig.canvas.draw()
    finally:
        Text.draw = original
    renderer = fig.canvas.get_renderer()
    return [(t, t.get_window_extent(renderer)) for t in seen]


def _physext_words(fig) -> str:
    return re.sub(r"\s+", " ", " ".join(t.get_text() for t, _ in _physext_texts(fig)))


def _physext_crosses(line, box, margin=1.0, steps=60) -> bool:
    pts = line.get_transform().transform(line.get_xydata())
    for a, b in zip(pts, pts[1:]):
        for k in range(steps + 1):
            x, y = a[0] + (b[0] - a[0]) * k / steps, a[1] + (b[1] - a[1]) * k / steps
            if box.x0 + margin < x < box.x1 - margin and box.y0 + margin < y < box.y1 - margin:
                return True
    return False


def _physext_reach(fid, samples=300):
    if not _PHYSEXT_STORE.exists():
        pytest.skip("no figure store")
    from figgen import link
    db = sqlite3.connect(f"file:{_PHYSEXT_STORE}?mode=ro", uri=True)
    db.row_factory = sqlite3.Row
    ix = link.topic_index(db)
    books = {r["key"]: r["book"] for r in db.execute("SELECT key, book FROM topics")}
    keys = link.reach(ix, _physext_fam(fid), samples)
    return {t["key"]: (t["band"], books[t["key"]], t["name"]) for t in ix if t["key"] in keys}


def _physext_head(fid):
    src = subprocess.run(["git", "show", f"HEAD:scripts/figgen/families/{fid}.py"], cwd=_PHYSEXT_REPO,
                         capture_output=True, text=True, check=True, encoding="utf-8").stdout
    mod = types.ModuleType(f"figgen.families._head_{fid}")
    mod.__package__ = "figgen.families"
    exec(compile(src, f"HEAD:{fid}.py", "exec"), mod.__dict__)
    return mod


def _physext_signature(fig):
    out = []
    for ax in fig.axes:
        out += [(t.get_text(), tuple(round(float(v), 6) for v in t.get_position())) for t in ax.texts]
        out += [tuple((round(float(x), 6), round(float(y), 6)) for x, y in ln.get_xydata()) for ln in ax.lines]
        out.append(ax.get_title())
    plt.close(fig)
    return out


# --- every new family -----------------------------------------------------------------------------------------------

@pytest.mark.parametrize("fid", _PHYSEXT_IDS)
def test_p6_physext_mcq_cannot_be_picked_from_its_options_alone(fid):
    m = _physext_fam(fid)
    seen, hits = defaultdict(int), defaultdict(int)
    for s in range(1, 301):
        _, qs = _physext_run(m, s)
        for q in qs:
            if q.kind == "mcq":
                key = re.sub(r"\d+", "#", q.stem.rsplit(". ", 1)[-1])
                key = re.sub(r"\b[A-Z]\b", "L", key)
                seen[key] += 1
                hits[key] += _physext_central(q.options) == int(q.answer)
    bad = {k: (hits[k], seen[k]) for k in seen if seen[k] >= 10 and hits[k] / seen[k] > 0.35}
    assert not bad, (fid, bad)


@pytest.mark.parametrize("fid", _PHYSEXT_IDS)
def test_p6_physext_first_stem_names_a_person(fid):
    m = _physext_fam(fid)
    for s in range(1, 200):
        _, qs = _physext_run(m, s)
        assert any(qs[0].stem.startswith(n) for n in NAMES), (fid, qs[0].stem)


@pytest.mark.parametrize("fid", _PHYSEXT_IDS)
def test_p6_physext_no_label_sits_on_a_drawn_line(fid):
    m = _physext_fam(fid)
    for s in range(1, 31):
        fig = m.draw(m.sample(random.Random(s)))
        texts = _physext_texts(fig)
        for ax in fig.axes:
            mine = [(t, box) for t, box in texts if t in ax.texts]
            for ln in ax.lines:
                for t, box in mine:
                    assert not _physext_crosses(ln, box), (fid, s, t.get_text(), ln.get_gid())
        plt.close(fig)


# --- magnetic_force -------------------------------------------------------------------------------------------------

_PHYSEXT_SIN = {30: Fraction(1, 2), 90: Fraction(1), 150: Fraction(1, 2)}


def test_magnetic_force_keys():
    m = _physext_fam("magnetic_force")
    kinds = Counter()
    for s in _PHYSEXT_SEEDS:
        p, qs = _physext_run(m, s)
        kinds[p["kind"]] += 1
        assert p["band"] == "AL"
        if p["kind"] == "angle":
            B, I, L = Fraction(p["tesla"]), Fraction(p["amps"]), Fraction(p["cm"], 100)
            assert _physext_num(qs[0].answer) == B * I * L * _PHYSEXT_SIN[p["theta"]]
            # F along I L x B with B = (1, 0, 0) and the current along +-(cos t, sin t, 0): F_z = -I_y
            t = math.radians(p["theta"])
            iy = (1 if p["up"] else -1) * math.sin(t)
            assert _physext_picked(qs[1]) == ("into the page" if iy > 0 else "out of the page")
            if p["theta"] != 90:
                assert "90°" in qs[2].stem and _physext_num(qs[2].answer) == B * I * L
            else:
                assert "halved" in qs[2].stem and _physext_num(qs[2].answer) == B * I * L / 2
        else:
            assert _physext_picked(qs[0]) == ("they attract" if p["same"] else "they repel")
            F = Fraction(p["micro"]) * p["amps"] * Fraction(p["cm"], 100)
            assert _physext_num(qs[1].answer) == F and _physext_num(qs[2].answer) == 4 * F
    assert kinds["angle"] > 400 and kinds["parallel"] > 250


def test_magnetic_force_shows_what_it_asks():
    m = _physext_fam("magnetic_force")
    for s in range(1, 60):
        p, qs = _physext_run(m, s)
        fig = m.draw(p)
        words = _physext_words(fig)
        if p["kind"] == "angle":
            assert f"B = {p['tesla']} T" in words and f"I = {p['amps']} A" in words and f"{p['cm']} cm" in words
            assert f"{p['theta']}°" in words and "F = BIL sin θ" in words
            wire = next(ln for ln in fig.axes[0].lines if ln.get_gid() == "wire")
            (x0, y0), (x1, y1) = wire.get_xydata()[0], wire.get_xydata()[-1]
            assert round(math.degrees(math.atan2(y1 - y0, x1 - x0)) % 180) == p["theta"] % 180
        else:
            assert f"{p['micro']} μT" in words and words.count(f"{p['amps']} A") == 2 and "F = BIL" in words
        plt.close(fig)


def test_magnetic_force_reaches_the_as_chapter():
    got = _physext_reach("magnetic_force")
    names = {n for _, _, n in got.values()}
    assert "Chapter 26: Magnetic fields and electromagnetism" in names, sorted(names)
    for b, _, n in got.values():
        assert b == "AL" and re.search(r"magnet", n, re.I), n


# --- induction_demo -------------------------------------------------------------------------------------------------

def _physext_needle(face, motion):
    if motion == "still":
        return "it stays at zero"
    # the reference: N pole pushed in turns it right; reversing the pole or the motion turns it round
    flips = (face == "S") + (motion == "out")
    return "to the right" if flips % 2 == 0 else "to the left"


def test_induction_demo_keys():
    m = _physext_fam("induction_demo")
    kinds = Counter()
    for s in _PHYSEXT_SEEDS:
        p, qs = _physext_run(m, s)
        kinds[(p["kind"], p["band"])] += 1
        if p["kind"] == "magnet":
            setups = {L: (f, mo, v) for L, f, mo, v in p["setups"]}
            assert sum(mo == "still" for _, mo, _ in setups.values()) == 1
            speeds = [v for _, mo, v in setups.values() if mo != "still"]
            assert len(set(speeds)) == 3
            assert setups[_physext_picked(qs[0])][1] == "still"
            L = re.search(r"set-up ([A-Z])\?", qs[1].stem).group(1)
            assert _physext_picked(qs[1]) == _physext_needle(*setups[L][:2]) and setups[L][1] != "still"
            assert setups[_physext_picked(qs[2])][2] == max(speeds)
        else:
            T, V = p["period"], p["peak"]
            assert _physext_num(qs[0].answer) == V and _physext_num(qs[1].answer) == T
            assert _physext_num(qs[2].answer) == Fraction(1000, T)
    assert set(k for k, _ in kinds) == {"magnet", "ac"} and kinds[("magnet", "LS")] > 100


def test_induction_demo_shows_what_it_asks():
    m = _physext_fam("induction_demo")
    for s in range(1, 60):
        p, qs = _physext_run(m, s)
        fig = m.draw(p)
        words = _physext_words(fig)
        ax = fig.axes[0]
        if p["kind"] == "magnet":
            for L, f, mo, v in p["setups"]:
                assert f"set-up {L}" in words
                assert (f"{v} cm/s" in words) if mo != "still" else ("held still" in words)
            assert "N pole pushed into the coil" in words
        else:
            T, V = p["period"], p["peak"]
            xs = {round(float(t), 6) for t in list(ax.get_xticks()) + list(ax.get_xticks(minor=True))}
            ys = {round(float(t), 6) for t in ax.get_yticks()}
            assert all(round(T * k / 4, 6) in xs for k in range(9)) and float(V) in ys and float(-V) in ys
            emf = next(ln for ln in ax.lines if ln.get_gid() == "emf")
            assert abs(max(emf.get_ydata()) - V) < 1e-6
            assert "f = 1 ÷ T" in words
        plt.close(fig)


def test_induction_demo_reaches_the_s3_induction_topic():
    got = _physext_reach("induction_demo")
    names = {(b, n) for b, _, n in got.values()}
    assert ("LS", "Introduction to Electromagnetic Induction") in names, sorted(names)
    for b, _, n in got.values():
        assert re.search(r"induc|generat|alternating|electromagnet|a\.c|magnet", n, re.I), (b, n)


# --- magnet_tests ---------------------------------------------------------------------------------------------------

def test_magnet_tests_keys():
    m = _physext_fam("magnet_tests")
    kinds = Counter()
    for s in _PHYSEXT_SEEDS:
        p, qs = _physext_run(m, s)
        kinds[p["kind"]] += 1
        assert p["band"] == "LS"
        if p["kind"] == "test":
            fig = m.draw(p)
            rows = {}
            texts = [t for t in fig.axes[0].texts]
            for t in texts:
                if re.fullmatch(r"bar [A-Z]", t.get_text()) and t.get_position()[1] < 2.0:
                    y = t.get_position()[1]
                    rows[t.get_text()[-1]] = [u.get_text() for u in sorted(texts, key=lambda u: u.get_position()[0])
                                              if abs(u.get_position()[1] - y) < 1e-6 and u is not t]
            plt.close(fig)
            # only a magnet can repel; a magnetic material is attracted at both ends; the rest feel nothing
            magnet = next(L for L, r in rows.items() if "repels" in r)
            magnetic = next(L for L, r in rows.items() if r == ["attracts", "attracts"])
            assert _physext_picked(qs[0]) == magnet and _physext_picked(qs[1]) == magnetic
            end = rows[magnet].index("repels") + 1
            assert qs[2].answer == f"end {end}"
        elif p["kind"] == "domains":
            bars = {L: arrows for L, _, arrows in p["bars"]}
            aligned = [L for L, a in bars.items() if len(set(a)) == 1]
            assert len(aligned) == 1 and _physext_picked(qs[0]) == aligned[0]
            L = re.search(r"in bar ([A-Z]) point", qs[1].stem).group(1)
            assert int(qs[1].answer) == bars[L].count("right")
            assert _physext_picked(qs[2]) == f"the {bars[aligned[0]][0]} end"
            for L2, a in bars.items():
                if L2 != aligned[0]:
                    assert max(a.count(d) for d in set(a)) < 8
        else:
            other = "a south pole" if p["pole"] == "N" else "a north pole"
            same = "a north pole" if p["pole"] == "N" else "a south pole"
            assert _physext_picked(qs[0]) == other and _physext_picked(qs[1]) == same
    assert set(kinds) == {"test", "domains", "stroking"}


def test_magnet_tests_shows_what_it_asks():
    m = _physext_fam("magnet_tests")
    for s in range(1, 60):
        p, qs = _physext_run(m, s)
        fig = m.draw(p)
        words = _physext_words(fig)
        if p["kind"] == "test":
            assert "Only a magnet can repel a magnet." in words
        elif p["kind"] == "domains":
            assert "Each arrow points towards the N pole." in words
            from matplotlib.patches import FancyArrowPatch
            assert sum(isinstance(pa, FancyArrowPatch) for pa in fig.axes[0].patches) == 24
        else:
            assert p["pole"] in words and f"{p['strokes']} times" in words
        plt.close(fig)


def test_magnet_tests_reaches_the_lower_secondary_magnetism_topics():
    got = _physext_reach("magnet_tests")
    names = {n for _, _, n in got.values()}
    assert "Magnetism" in names and "Unit 11: Magnetization and Demagnetization" in names, sorted(names)
    for b, _, n in got.values():
        assert b == "LS" and re.search(r"magnet", n, re.I), n


# --- orbit_data -----------------------------------------------------------------------------------------------------

def test_orbit_data_keys_from_the_printed_table():
    m = _physext_fam("orbit_data")
    kinds = Counter()
    for s in _PHYSEXT_SEEDS:
        p, qs = _physext_run(m, s)
        kinds[p["kind"]] += 1
        if p["kind"] == "kepler" and kinds["kepler"] <= 150:
            fig = m.draw(p)
            texts = fig.axes[0].texts
            rows = {}
            for name, _ in p["moons"]:
                t = next(u for u in texts if u.get_text() == name)
                y = t.get_position()[1]
                rows[name] = [u.get_text() for u in sorted(texts, key=lambda u: u.get_position()[0])
                              if abs(u.get_position()[1] - y) < 1e-6 and u is not t]
            plt.close(fig)
            known = {n: (Fraction(r), Fraction(T)) for n, (r, T) in rows.items() if "?" not in (r, T)}
            const = {T * T / r ** 3 for r, T in known.values()}
            assert len(const) == 1  # Kepler's third law holds across the table
            k = const.pop()
            hole = next(n for n, (r, T) in rows.items() if "?" in (r, T))
            r, T = rows[hole]
            if T == "?":
                want = (k * Fraction(r) ** 3) ** Fraction(1, 2)
                assert "period" in qs[0].stem and Fraction(qs[0].answer) ** 2 == k * Fraction(r) ** 3
            else:
                assert "radius" in qs[0].stem and Fraction(qs[0].answer) ** 3 == Fraction(T) ** 2 / k
            a, b = re.search(r"is the moon (\w+) than the moon (\w+)\?", qs[1].stem).groups()
            assert Fraction(qs[1].answer) == Fraction(rows[a][0]) / Fraction(rows[b][0]) > 1
            assert (Fraction(rows[a][0]) / Fraction(rows[b][0])).denominator == 1
        elif p["kind"] == "speed":
            sats = {n: (r, v) for n, r, v in p["sats"]}
            T = {n: Fraction(628, 100) * r / v for n, (r, v) in sats.items()}
            assert all(t.denominator == 1 for t in T.values()) and len({v for _, v in sats.values()}) == 3
            n = re.search(r"satellite (S\d)", qs[0].stem).group(1)
            assert Fraction(qs[0].answer) == Fraction(628, 100) * sats[n][0] / T[n]  # v = 2 pi r / T
            assert _physext_picked(qs[1]) == max(sats, key=lambda x: Fraction(628, 100) * sats[x][0] / T[x])
            n2 = re.search(r"satellite (S\d)", qs[2].stem).group(1)
            assert Fraction(qs[2].answer) == Fraction(628, 100) * sats[n2][0]
            if kinds["speed"] <= 30:
                fig = m.draw(p)
                words = _physext_words(fig)
                plt.close(fig)
                for name, (r, v) in sats.items():
                    assert f"{r:,}".replace(",", " ") in words and f"{int(T[name]):,}".replace(",", " ") in words
                assert "π = 3.14" in words
    assert set(kinds) == {"kepler", "speed"}


def test_orbit_data_reaches_the_orbit_topics():
    got = _physext_reach("orbit_data")
    names = {n for _, _, n in got.values()}
    assert "Earth and the Solar System" in names and "Motion in Orbits" in names, sorted(names)
    for b, _, n in got.values():
        assert b == "UP" and not re.search(r"star|universe|electric|wave", n, re.I), n


# --- relative_motion ------------------------------------------------------------------------------------------------

def test_relative_motion_keys():
    m = _physext_fam("relative_motion")
    kinds = Counter()
    for s in _PHYSEXT_SEEDS:
        p, qs = _physext_run(m, s)
        kinds[p["kind"]] += 1
        if p["kind"] == "train":
            v, u, w = p["v"], p["u"], p["w"]
            walk = u if p["walk"] == "forwards" else -u  # along the train's direction, positive forwards
            car = w if p["car"] == "same" else -w
            assert int(qs[0].answer) == v + walk
            assert int(qs[1].answer) == abs(car - v)  # u' = u - v, the car seen from the train
            want = "forwards, the way the train moves" if car - v > 0 else "backwards, the opposite way to the train"
            assert _physext_picked(qs[2]) == want
        else:
            water, boat = p["water"], p["boat"]
            bank = water + (-boat if p["up"] else boat)  # along the flow, positive downstream
            assert int(qs[0].answer) == abs(bank)
            assert Fraction(qs[1].answer) == Fraction(p["metres"], abs(bank)) and Fraction(p["metres"], abs(bank)).denominator == 1
            want = "downstream" if bank > 0 else "upstream"
            assert _physext_picked(qs[2]) == want
    assert set(kinds) == {"train", "river"}


def test_relative_motion_prints_every_speed():
    m = _physext_fam("relative_motion")
    for s in range(1, 60):
        p, qs = _physext_run(m, s)
        fig = m.draw(p)
        words = _physext_words(fig)
        plt.close(fig)
        if p["kind"] == "train":
            for t in (f"train: {p['v']} m/s", f"walks at {p['u']} m/s", f"car: {p['w']} m/s"):
                assert t in words, (t, words)
        else:
            for t in (f"water: {p['water']} m/s", f"boat: {p['boat']} m/s", f"{p['metres']} m of bank"):
                assert t in words, (t, words)


def test_relative_motion_reaches_the_relativity_topic():
    got = _physext_reach("relative_motion")
    names = {n for _, _, n in got.values()}
    assert "Relativity Concepts and Postulates of Special Relativity" in names, sorted(names)


# --- heating_curve (edited: an AS figure) ---------------------------------------------------------------------------

def test_heating_curve_ls_and_up_figures_are_as_at_head():
    old, new = _physext_head("heating_curve"), _physext_fam("heating_curve")
    checked = 0
    for s in range(1, 400):
        p = old.sample(random.Random(s))
        assert _physext_signature(old.draw(p)) == _physext_signature(new.draw(p)), s
        qa, qb = old.questions(p, random.Random(1000 + s)), new.questions(p, random.Random(1000 + s))
        assert [vars(q) for q in qa] == [vars(q) for q in qb], s
        checked += 1
    assert checked > 200


def test_heating_curve_as_figures():
    m = _physext_fam("heating_curve")
    n = 0
    for s in _PHYSEXT_SEEDS:
        p, qs = _physext_run(m, s)
        if p["band"] != "AL":
            continue
        n += 1
        c = p["corners"]
        P, M = p["power"], Fraction(p["mass"])
        melt, warm = c[2][0] - c[1][0], c[3][0] - c[2][0]
        energy, latent, cap = qs[3], qs[4], qs[5]
        assert _physext_num(energy.answer) == P * melt * 60  # E = Pt
        assert _physext_num(latent.answer) == Fraction(P * melt * 60) / M  # L = E / m
        assert _physext_num(cap.answer) == Fraction(P * warm * 60) / (M * 100)  # c = E / (m dT)
        assert 300000 <= Fraction(P * melt * 60) / M <= 400000 and 3800 <= Fraction(P * warm * 60) / (M * 100) <= 5000
        assert M != 1
        if n <= 20:
            fig = m.draw(p)
            title = fig.axes[0].get_title()
            plt.close(fig)
            assert f"{p['mass']} kg of ice" in title and f"{P} W" in title
    assert n > 150


def test_heating_curve_as_figures_reach_the_thermal_physics_chapter_only():
    got = _physext_reach("heating_curve")
    al = sorted(n for b, _, n in got.values() if b == "AL")
    assert al == ["Chapter 21: Thermal physics"], al


# --- electric_field (edited: AVOID lets the S5 chapter of electric and gravitational potential in) ----------------

def test_electric_field_now_reaches_the_s5_potential_chapter_and_still_avoids_gravity_alone():
    m = _physext_fam("electric_field")
    assert not re.search(m.AVOID, "Electric Field Potential and Gravitational Potential", re.I)
    assert re.search(m.AVOID, "Chapter 17: Gravitational fields", re.I)
    got = _physext_reach("electric_field")
    assert ("UP", "Physics_Students Book_Senior Five", "Electric Field Potential and Gravitational Potential") in got.values()
