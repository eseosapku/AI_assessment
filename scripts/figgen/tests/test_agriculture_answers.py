"""Answers of the Agriculture families (P3t), recomputed from each figure's params over 1,000 seeds.

Every key is worked out here again, by its own code: the Pearson square's parts and the kilograms of each feed, the
fertiliser's nutrient and bags, a farm record's total, mean, income and best row, a soil sample's sand, silt and clay
(and its USDA texture class, by the USDA's own rules), and a crop calendar's months. Every value a question needs is
checked as shown in the figure.
"""
import itertools
import math
import random
import re
import sqlite3
from fractions import Fraction
from pathlib import Path

import matplotlib.pyplot as plt
import pytest

from figgen.core import NAMES
from figgen.families import FAMILIES

SEEDS = range(1, 1001)
DRAWN = 200  # the figure itself is built and read for the first 200 seeds
AGRICULTURE = ["pearson_square", "fertiliser_calc", "farm_record", "soil_texture", "crop_calendar"]
STORE = Path("C:/Users/Stephen/figure-library/figures.db")


def run(m, seed):
    rng = random.Random(seed)
    p = m.sample(rng)
    return p, m.questions(p, rng)


def picked(q):
    return q.options[int(q.answer)]


def fam(fid):
    if fid not in FAMILIES:
        pytest.fail(f"{fid} is not registered")
    return FAMILIES[fid]


def texts(fig) -> list:
    return [t for ax in fig.axes for t in ax.texts]


def by_gid(fig) -> dict:
    return {t.get_gid(): t.get_text() for t in texts(fig) if t.get_gid()}


def value(s: str) -> Fraction:
    """A number as an answer or option writes it: "12.5", "12 500", "20 kg", "1,750 eggs"."""
    m = re.match(r"-?[\d ,]*\d(\.\d+)?", s.strip())
    assert m, s
    return Fraction(m.group(0).replace(" ", "").replace(",", ""))


def one_dp(x: Fraction) -> bool:
    return (x * 10).denominator == 1


def own_wordings(m) -> int:
    """How many of 30 figures carry a stem no other of the 30 has (the shared wording test, P2a)."""
    stems = []
    for seed in range(1, 31):
        rng = random.Random(seed)
        stems.append({q.stem for q in m.questions(m.sample(rng), rng)})
    return sum(1 for i, s in enumerate(stems) if s - set().union(*(t for j, t in enumerate(stems) if j != i)))


def mcq_is_sound(q, key: str):
    assert q.kind == "mcq" and picked(q) == key, (q.stem, q.options, key)
    assert len(q.options) >= 3 and len(set(q.options)) == len(q.options), q.options


@pytest.mark.parametrize("fid", AGRICULTURE)
def test_agriculture_family_is_worded_and_linked(fid):
    m = fam(fid)
    assert m.SUBJECT == "agriculture"
    assert m.CONCEPTS and all(c.startswith("agriculture.") for c in m.CONCEPTS)
    assert m.NEEDS and set(m.BANDS) <= {"LS", "UP"}
    assert own_wordings(m) >= 27, fid
    for seed in range(1, 60):
        p, qs = run(m, seed)
        assert p["band"] in m.BANDS
        first = next((n for n in NAMES if qs[0].stem.startswith(n)), None)
        assert first, (fid, seed, qs[0].stem)
        for q in qs:
            for owner in re.findall(r"\b(" + "|".join(NAMES) + r")'s\b", q.stem):
                assert owner == first, (fid, seed, q.stem)
            if q.kind == "short":
                assert q.answer in q.accepted


@pytest.mark.parametrize("fid", AGRICULTURE)
def test_concepts_are_known_and_reach_the_topics_they_should(fid):
    if not STORE.exists():
        pytest.skip("no figure library here")
    from figgen.link import reach, topic_index
    db = sqlite3.connect(f"file:{STORE}?mode=ro", uri=True)
    db.row_factory = sqlite3.Row
    m = fam(fid)
    known = {r[0] for r in db.execute("SELECT id FROM concepts")}
    for s in range(1, 200):
        p = m.sample(random.Random(s))
        narrow = getattr(m, "concepts_for", None)
        assert set(narrow(p) if narrow else m.CONCEPTS) <= known
    assert set(m.CONCEPTS) <= known, sorted(set(m.CONCEPTS) - known)
    index = topic_index(db)
    names = {t["key"]: (t["band"], t["name"]) for t in index}
    got = {names[k] for k in reach(index, m, samples=200)}
    want = {
        "pearson_square": {("UP", "Feed and nutrition"), ("UP", "Animal husbandry"), ("LS", "Unit 5: Ruminants"),
                           ("LS", "Unit 6: Animals (pigs and poultry)")},
        "fertiliser_calc": {("UP", "Crop production"), ("UP", "Soil science"), ("LS", "Unit 1: Soil"), ("LS", "Unit 2: Cereals"),
                            ("LS", "Unit 4: Legumes"), ("LS", "Unit 4: Fodder")},
        "farm_record": {("UP", "Farm records"), ("UP", "Farm management"), ("UP", "Agricultural economics"),
                        ("UP", "Fisheries and forestry"), ("LS", "Unit 8: Co-operative farming"),
                        ("LS", "Unit 5: Animals (fish and bees)"), ("LS", "Unit 6: Animals (pigs and poultry)")},
        "soil_texture": {("UP", "Soil science"), ("LS", "Unit 1: Soil")},
        "crop_calendar": {("UP", "Crop production"), ("LS", "Unit 2: Cereals"), ("LS", "Unit 4: Legumes")},
    }[fid]
    assert want <= got, sorted(want - got)
    never = {
        "pearson_square": {"Breeding", "Health and disease control", "Soil science", "Unit 4: Fodder"},
        "fertiliser_calc": {"Feed and nutrition", "Farm records", "Animal husbandry", "Unit 2: Mushrooms",
                            "Unit 7: Problems and Solutions of Agriculture", "Unit 8: Co-operative farming"},
        "farm_record": {"Soil science", "Breeding", "Unit 1: Soil", "Farm mechanization"},
        "soil_texture": {"Crop production", "Agricultural economics", "Farm management", "Farm mechanization", "Unit 2: Cereals"},
        "crop_calendar": {"Soil science", "Agricultural economics", "Farm management", "Unit 4: Fodder",
                          "Unit 8: Co-operative farming"},
    }[fid]
    assert not {n for _, n in got} & never, sorted({n for _, n in got} & never)


# --- pearson_square --------------------------------------------------------------------------------

def test_pearson_square():
    m = fam("pearson_square")
    seen = set()
    for s in SEEDS:
        p, qs = run(m, s)
        (lo_name, lo), (hi_name, hi), t, mass = p["low"], p["high"], p["target"], p["mass"]
        assert lo < t < hi and hi - t != t - lo, (s, lo, t, hi)  # a mix of the two, never half and half
        parts = {lo_name: hi - t, hi_name: t - lo}  # across the diagonals
        total = hi - lo
        kg = {f: Fraction(mass * n, total) for f, n in parts.items()}
        assert sum(kg.values()) == mass  # the ration balances exactly
        assert all(one_dp(k) for k in kg.values()), (s, kg)
        pct = {f: Fraction(100 * n, total) for f, n in parts.items()}
        assert all(one_dp(x) for x in pct.values()), (s, pct)
        assert mass in (50, 100)
        box = {p["top"]: "P"}
        box[lo_name if p["top"] == hi_name else hi_name] = "Q"
        if s <= DRAWN:
            fig = m.draw(p)
            g = by_gid(fig)
            plt.close(fig)
            assert f"{lo}%" in g["cp:" + lo_name] and f"{hi}%" in g["cp:" + hi_name], (s, g)
            assert str(mass) in g["title"]
            if p["blank"] == "parts":
                assert g["target"] == f"{t}%"
                assert g["parts:" + lo_name] == box[lo_name] and g["parts:" + hi_name] == box[hi_name], (s, g)
            else:
                assert g["target"] == "?"
                assert g["parts:" + lo_name] == str(parts[lo_name]) and g["parts:" + hi_name] == str(parts[hi_name])
                assert g["total"] == f"Total: {total} parts"
        for q in qs:
            got = re.search(r"How many parts of (.+?) go in box ([PQ])\?", q.stem)
            if got:
                seen.add("parts")
                assert p["blank"] == "parts" and box[got.group(1)] == got.group(2), (s, q.stem)
                assert value(q.answer) == parts[got.group(1)], (s, q.stem, q.answer)
            if "crude protein did the mix aim for" in q.stem:
                seen.add("target")
                assert p["blank"] == "target" and value(q.answer) == t
            got = re.search(r"How many kilograms of (.+?) are in (\d+) kg of", q.stem)
            if got:
                seen.add("kg")
                assert int(got.group(2)) == mass
                key = kg[got.group(1)]
                if q.kind == "mcq":
                    assert value(picked(q)) == key, (s, q.stem, picked(q))
                    assert all(value(o) != key for o in q.options if o != picked(q)), (s, q.options)
                    assert "parts ÷ the total parts" in q.stem
                else:
                    assert value(q.answer) == key, (s, q.stem, q.answer)
            got = re.search(r"What percentage of the .+? is (.+?)\?", q.stem)
            if got:
                seen.add("pct")
                assert value(q.answer) == pct[got.group(1)], (s, q.stem, q.answer)
    assert seen == {"parts", "target", "kg", "pct"}, seen


# --- fertiliser_calc -------------------------------------------------------------------------------

GRADES = {"DAP": [18, 46, 0], "Urea": [46, 0, 0], "NPK 17-17-17": [17, 17, 17], "NPK 20-10-10": [20, 10, 10]}
NUTRIENTS = ["N", "P₂O₅", "K₂O"]


def test_fertiliser_calc():
    m = fam("fertiliser_calc")
    seen = set()
    for s in SEEDS:
        p, qs = run(m, s)
        grade = GRADES[p["fert"]]
        assert p["grade"] == grade, (s, p["fert"], p["grade"])
        area = Fraction(p["length"] * p["width"], 10000)  # hectares
        total = p["rate"] * area  # kg of fertiliser for the field
        bags = total / p["bag"]
        assert bags.denominator == 1 and 1 <= bags <= 40, (s, total, p["bag"])
        plots = p["rows"] * p["cols"]
        assert plots >= 2
        per_plot = total / plots
        assert one_dp(per_plot), (s, per_plot)
        if s <= DRAWN:
            fig = m.draw(p)
            words = " ".join(t.get_text() for t in texts(fig))
            g = by_gid(fig)
            dashed = [ln for ax in fig.axes for ln in ax.lines if (ln.get_gid() or "").startswith("plot-line")]
            plt.close(fig)
            assert "-".join(map(str, grade)) in words and f"{p['bag']} kg" in words, (s, words)
            assert g["length"] == f"{p['length']} m" and g["width"] == f"{p['width']} m", (s, g)
            assert f"{p['rate']} kg" in g["rate"] and "per hectare" in g["rate"]
            assert "10 000 m²" in words
            assert len(dashed) == (p["rows"] - 1) + (p["cols"] - 1), s  # the plots, counted by the lines between them
        for q in qs:
            got = re.search(r"How many kilograms of (N|P₂O₅|K₂O) are in one bag\?", q.stem)
            if got:
                seen.add("bag")
                pct = grade[NUTRIENTS.index(got.group(1))]
                assert pct > 0
                key = Fraction(p["bag"] * pct, 100)
                assert one_dp(key)
                assert "-".join(map(str, grade)) in q.stem and "percentages of N, P₂O₅ and K₂O" in q.stem
                if q.kind == "mcq":
                    assert value(picked(q)) == key and all(value(o) != key for o in q.options if o != picked(q))
                else:
                    assert value(q.answer) == key
            got = re.search(r"How many (\d+) kg bags", q.stem)
            if got:
                seen.add("bags")
                assert int(got.group(1)) == p["bag"] and value(q.answer) == bags, (s, q.stem, q.answer)
            got = re.search(r"(\d+) equal plots", q.stem)
            if got:
                seen.add("plot")
                assert int(got.group(1)) == plots and value(q.answer) == per_plot, (s, q.stem, q.answer)
            got = re.search(r"How many kilograms of (N|P₂O₅|K₂O) does the whole field (?:receive|get)\?", q.stem)
            if got:
                seen.add("field")
                key = total * grade[NUTRIENTS.index(got.group(1))] / 100
                assert one_dp(key) and value(q.answer) == key, (s, q.stem, q.answer)
    assert seen == {"bag", "bags", "plot", "field"}, seen


# --- farm_record -----------------------------------------------------------------------------------

def test_farm_record():
    m = fam("farm_record")
    kinds = set()
    for s in SEEDS:
        p, qs = run(m, s)
        kinds.add(p["kind"])
        rows, vals = p["rows"], p["values"]  # one list of numbers per row; milk has morning and evening
        assert len(rows) == len(vals) >= 4
        per_row = [sum(v) for v in vals]
        total = sum(per_row)
        n = len(rows)
        assert total % n == 0, (s, total, n)
        mean = total // n
        income = total * p["price"]
        best = sorted(range(n), key=lambda i: -per_row[i])
        assert per_row[best[0]] - per_row[best[1]] >= 2, (s, per_row)  # no near-tie for the best
        if s <= DRAWN:
            fig = m.draw(p)
            g = by_gid(fig)
            plt.close(fig)
            for i, row in enumerate(rows):
                assert g[f"cell:{i}:label"] == row
                for k, v in enumerate(vals[i]):
                    assert value(g[f"cell:{i}:{k}"]) == v, (s, i, k)
            assert value(g["price"].split(":")[-1]) == p["price"], g["price"]
            assert "Frw" in g["price"]
        asked = set()
        for q in qs:
            if "in total" in q.stem:
                asked.add("total")
                assert value(q.answer) == total, (s, q.stem, q.answer)
            elif re.search(r"\bmean\b", q.stem):
                asked.add("mean")
                assert value(q.answer) == mean, (s, q.stem, q.answer)
                assert "÷" in q.stem
            elif "Frw" in q.stem:
                asked.add("income")
                assert value(q.answer) == income, (s, q.stem, q.answer)
                assert f"{income}" in q.accepted and f"{income:,}".replace(",", " ") in q.accepted
            else:
                asked.add("best")
                mcq_is_sound(q, rows[best[0]])
        assert asked == {"total", "mean", "income", "best"}, (s, asked)
    assert kinds == {"eggs", "milk", "maize", "fish", "honey", "coop"}, kinds


# --- soil_texture ----------------------------------------------------------------------------------

def usda(sand: float, silt: float, clay: float) -> str:
    """The USDA texture class, by the USDA's rules (Soil Survey Manual), not by the drawn polygons."""
    if silt + 1.5 * clay < 15:
        return "Sand"
    if silt + 2 * clay < 30:
        return "Loamy sand"
    if (7 <= clay < 20 and sand > 52) or (clay < 7 and silt < 50):
        return "Sandy loam"
    if 7 <= clay < 27 and 28 <= silt < 50 and sand <= 52:
        return "Loam"
    if (silt >= 50 and 12 <= clay < 27) or (50 <= silt < 80 and clay < 12):
        return "Silt loam"
    if silt >= 80 and clay < 12:
        return "Silt"
    if 20 <= clay < 35 and silt < 28 and sand > 45:
        return "Sandy clay loam"
    if 27 <= clay < 40 and 20 < sand <= 45:
        return "Clay loam"
    if 27 <= clay < 40 and sand <= 20:
        return "Silty clay loam"
    if clay >= 35 and sand > 45:
        return "Sandy clay"
    if clay >= 40 and silt >= 40:
        return "Silty clay"
    return "Clay"


H = math.sqrt(3) / 2


def place(sand, silt, clay):
    return silt + clay / 2, clay * H


def unplace(x, y):
    clay = y / H
    silt = x - clay / 2
    return 100 - silt - clay, silt, clay


def well_inside(v, r=4.0) -> bool:
    """The class is the same everywhere within r (of 100 along a side) of the point, in every direction."""
    x, y = place(*v)
    want = usda(*v)
    for k in range(24):
        a = 2 * math.pi * k / 24
        u = unplace(x + r * math.cos(a), y + r * math.sin(a))
        if min(u) < 0:
            continue
        if usda(*u) != want:
            return False
    return True


def test_soil_texture():
    m = fam("soil_texture")
    modes = set()
    for s in SEEDS:
        p, qs = run(m, s)
        modes.add(p["mode"])
        pts = p["points"]
        assert sorted(pts) == list("ABCD")
        for k, v in pts.items():
            assert sum(v) == 100 and all(x % 10 == 0 and x >= 10 for x in v), (s, k, v)  # on gridline crossings
        for a, b in itertools.combinations(pts, 2):
            # never on neighbouring crossings: a gridline crossing at least between them (B and C crowded, P3t review)
            assert math.dist(place(*pts[a]), place(*pts[b])) > 10.5, (s, a, b, pts)
        if p["mode"] == "class":
            # clear of every class line: bold USDA lines 2-3% off a gridline read as gridlines (/27, P3t review)
            assert all(well_inside(v, 4.0) for v in pts.values()), (s, pts)
        grams, total = p["sample"]["grams"], p["sample"]["total"]
        assert sum(grams) == total
        pct = [Fraction(100 * g, total) for g in grams]
        assert all(x.denominator == 1 for x in pct), (s, pct)
        pct = [int(x) for x in pct]
        if p["mode"] == "point":
            assert [k for k, v in pts.items() if v == pct] != [], (s, pct)
            assert len([k for k, v in pts.items() if v == pct]) == 1
        else:
            assert all(x % 5 == 0 for x in pct)
            assert well_inside(pct), (s, pct, usda(*pct))
        if s <= DRAWN:
            fig = m.draw(p)
            g = by_gid(fig)
            if p["mode"] == "class":
                _check_drawn_classes(fig, s)
            if s <= 120:
                _no_text_overlaps(fig, s)
            _points_sit_on_crossings(fig, pts, s)
            plt.close(fig)
            for k, i in zip(("sand", "silt", "clay"), range(3)):
                assert value(g[f"grams:{k}"]) == grams[i]
            assert value(g["grams:total"]) == total
            for k in "ABCD":
                assert g[f"point:{k}"] == k
        asked = set()
        for q in qs:
            got = re.search(r"percentage of (sand|silt|clay) is in sample ([A-D])\?", q.stem)
            if got:
                asked.add("read")
                if got.group(1) == "silt":  # silt is the hard direction to read (P3t review): worked from the other two
                    assert "silt = 100 − sand − clay" in q.stem, q.stem
                assert value(q.answer) == pts[got.group(2)][["sand", "silt", "clay"].index(got.group(1))], (s, q.stem)
            if "the most clay" in q.stem:
                asked.add("most")
                clay = {k: v[2] for k, v in pts.items()}
                top = max(clay.values())
                assert list(clay.values()).count(top) == 1
                mcq_is_sound(q, f"Sample {max(clay, key=clay.get)}")
            if "Which lettered sample" in q.stem:
                asked.add("which")
                assert "sand and clay" in q.stem  # matched without reading silt
                mcq_is_sound(q, f"Sample {next(k for k, v in pts.items() if v == pct)}")
            if "texture class" in q.stem:
                asked.add("class")
                assert p["mode"] == "class"
                mcq_is_sound(q, usda(*pct))
        assert {"read", "most"} <= asked and ("which" in asked) == (p["mode"] == "point") and ("class" in asked) == (p["mode"] == "class"), (s, asked)
    assert modes == {"point", "class"}


def _points_sit_on_crossings(fig, pts, s):
    """Every dot, from its drawn coordinates, is exactly where three 10% gridlines cross, at its params; each letter is
    nearer its own dot than any other; and no two side numbers crowd a corner (P3t review)."""
    ax = fig.axes[0]
    dots = {ln.get_gid()[4:]: tuple(ln.get_xydata()[0]) for ln in ax.lines if (ln.get_gid() or "").startswith("dot:")}
    grid = [ln.get_xydata() for ln in ax.lines if ln.get_gid() == "grid"]
    assert sorted(dots) == list("ABCD"), sorted(dots)
    for k, (x, y) in dots.items():
        u = unplace(x, y)
        assert all(abs(c - 10 * round(c / 10)) < 1e-6 for c in u), (s, k, u)
        assert [10 * round(c / 10) for c in u] == pts[k], (s, k, u, pts[k])
        through = 0
        for (x0, y0), (x1, y1) in grid:
            cross = (x1 - x0) * (y - y0) - (y1 - y0) * (x - x0)
            within = min(x0, x1) - 1e-6 <= x <= max(x0, x1) + 1e-6 and min(y0, y1) - 1e-6 <= y <= max(y0, y1) + 1e-6
            through += abs(cross) < 1e-6 and within
        assert through == 3, (s, k, through)
    for t in ax.texts:
        if (t.get_gid() or "").startswith("point:"):
            tx, ty = t.get_position()
            near = min(dots, key=lambda k: math.dist(dots[k], (tx, ty)))
            assert near == t.get_text(), (s, t.get_text(), near)
    for t in ax.texts:
        if (t.get_gid() or "").startswith("tick:"):
            # a side number lies on its own gridline carried past the edge, so that part is the same there
            _, part, k = t.get_gid().split(":")
            assert abs(unplace(*t.get_position())[["sand", "silt", "clay"].index(part)] - int(k)) < 1e-6, (s, t.get_gid())
    ticks = [(t.get_text(), t.get_position()) for t in ax.texts if (t.get_gid() or "").startswith("tick:")]
    assert ticks and all(text != "0" for text, _ in ticks), s
    for text, (x, y) in ticks:
        # beyond an edge, not on a corner: the 100s were printed on the vertices themselves (P3t review)
        assert min(unplace(x, y)) * H <= -3, (s, text, (x, y))
    for i, (a, pa) in enumerate(ticks):
        for b, pb in ticks[i + 1:]:
            assert math.dist(pa, pb) >= 6, (s, a, b, pa, pb)


def _no_text_overlaps(fig, s):
    """The shared layout test draws 15 figures; class names and letters move about, so 120 are drawn here."""
    fig.canvas.draw()
    r = fig.canvas.get_renderer()
    boxes = [(t.get_text(), t.get_window_extent(r)) for t in texts(fig) if t.get_text().strip()]
    for i, (a, b) in enumerate(boxes):
        for c, d in boxes[i + 1:]:
            assert not (min(b.x1, d.x1) - max(b.x0, d.x0) > 1 and min(b.y1, d.y1) - max(b.y0, d.y0) > 1), (s, a, c)


def _check_drawn_classes(fig, s):
    """The drawn class boundaries are the USDA's: every 2% point well inside a drawn class is in it by the rules too."""
    from matplotlib.path import Path as MPath
    ax = fig.axes[0]
    polys = {pa.get_gid()[6:]: MPath(pa.get_xy()) for pa in ax.patches if (pa.get_gid() or "").startswith("class:")}
    assert len(polys) == 12, sorted(polys)
    labels = {t.get_gid()[6:]: t.get_text().replace("\n", " ") for t in ax.texts if (t.get_gid() or "").startswith("label:")}
    assert set(labels) == set(polys) and all(labels[k].lower() == k.lower() for k in labels)
    for sand in range(0, 101, 2):
        for clay in range(0, 101 - sand, 2):
            v = (sand, 100 - sand - clay, clay)
            if min(v) < 2 or not well_inside(v, 1.5):  # on the triangle's own edge, or on a class boundary
                continue
            x, y = place(*v)
            inside = [k for k, path in polys.items() if path.contains_point((x, y))]
            assert inside == [usda(*v)], (s, v, inside, usda(*v))


# --- crop_calendar ---------------------------------------------------------------------------------

MONTHS = ["September", "October", "November", "December", "January", "February", "March", "April", "May", "June",
          "July", "August"]


def test_crop_calendar():
    m = fam("crop_calendar")
    seen = set()
    for s in SEEDS:
        p, qs = run(m, s)
        crops = {c: (a, b) for c, a, b in p["crops"]}
        named = {c.lower(): c for c in crops}  # as a sentence names a crop: "beans", "Irish potato"
        assert 4 <= len(crops) <= 5
        assert all(0 <= a <= b <= 11 for a, b in crops.values())
        months_in = {c: set(range(a, b + 1)) for c, (a, b) in crops.items()}
        ends = sorted(b for a, b in crops.values())
        assert ends[0] < ends[1], (s, crops)  # one crop is harvested first
        if s <= DRAWN:
            fig = m.draw(p)
            ax = fig.axes[0]
            bars = {pa.get_gid()[4:]: pa for pa in ax.patches if (pa.get_gid() or "").startswith("bar:")}
            words = [t.get_text() for t in texts(fig)]
            plt.close(fig)
            assert set(bars) == set(crops)
            for c, (a, b) in crops.items():
                x0 = bars[c].get_x()
                assert (x0, x0 + bars[c].get_width()) == (a, b + 1), (s, c)
                assert c in words
            for mo in MONTHS:
                assert mo[:3] in words
            assert {"Season A", "Season B"} <= set(words)
        for q in qs:
            got = re.search(r"How many months (?:is|are) (.+?) in the field", q.stem)
            if got:
                seen.add("long")
                a, b = crops[named[got.group(1).lower()]]
                assert value(q.answer) == b - a + 1, (s, q.stem)
            if "harvested first" in q.stem:
                seen.add("first")
                mcq_is_sound(q, min(crops, key=lambda c: crops[c][1]))
            got = re.search(r"In which month are both (.+?) and (.+?) in the field\?", q.stem)
            if got:
                seen.add("both")
                common = months_in[named[got.group(1).lower()]] & months_in[named[got.group(2).lower()]]
                assert len(common) == 1, (s, common)
                mcq_is_sound(q, MONTHS[common.pop()])
                for o in q.options:
                    assert o in MONTHS
            got = re.search(r"In which month (?:is|are) (.+?) harvested\?", q.stem)
            if got:
                seen.add("harvest")
                assert q.answer == MONTHS[crops[named[got.group(1).lower()]][1]]
    assert seen == {"long", "first", "both", "harvest"}, seen
