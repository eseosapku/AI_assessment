"""Answers of the P4 economics families, recomputed from each figure's params over 1,000 seeds, and the topics the
P4 re-links reach by name.

Nothing here calls a family's own helpers to work out a key: the market and social optima are solved from the lines'
intercepts and slopes, and the welfare loss from the three lettered corners by the shoelace formula; imports, domestic
output and the tariff revenue from the quantities at the world price and the world price plus the tariff; a good's box
from the grid's printed headers and its Yes/No facts; development, banking and population figures from their printed
formulas; and the new AD/AS equilibrium from which curve the stated policy moves, and which way. Every value a question
needs is checked as shown: printed in a table, or on a gridline the drawn curve passes through.
"""
import json
import random
import re
import sqlite3
from collections import Counter, defaultdict
from fractions import Fraction
from pathlib import Path

import matplotlib.pyplot as plt
import pytest

from figgen.core import NAMES
from figgen.families import FAMILIES

SEEDS = range(1, 1001)
DRAWN = 150  # the figure itself is built and read for the first 150 seeds
NEW = ("externality_diagram", "tariff_diagram", "goods_grid", "development_indicators", "credit_creation",
       "population_economics", "ad_as_policy")
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


def fr(n) -> str:
    """Whole numbers as the figures print them: a space for thousands ("12 500"), a true minus."""
    n = int(n)
    return ("−" if n < 0 else "") + f"{abs(n):,}".replace(",", " ")


def texts(fig) -> list[str]:
    return [t.get_text() for ax in fig.axes for t in ax.texts]


def gridlines(ax, axis: str) -> set[float]:
    a = ax.xaxis if axis == "x" else ax.yaxis
    return {round(float(v), 6) for v in list(a.get_majorticklocs()) + list(a.get_minorticklocs())}


def on_grid(ax, x, y) -> bool:
    return round(float(x), 6) in gridlines(ax, "x") and round(float(y), 6) in gridlines(ax, "y")


def curve_at(ax, gid: str, x: float):
    """The height of the drawn line named `gid` at x, by straight-line interpolation of what was drawn."""
    pts = sorted((float(a), float(b)) for ln in ax.lines if ln.get_gid() == gid for a, b in ln.get_xydata())
    assert pts, f"no line {gid} drawn"
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        if x0 <= x <= x1 and x1 > x0:
            return y0 + (y1 - y0) * (x - x0) / (x1 - x0)
    return None


def passes(ax, gid, x, y, tol) -> bool:
    got = curve_at(ax, gid, float(x))
    return got is not None and abs(got - float(y)) <= tol


def first_names_the_person(qs):
    assert any(qs[0].stem.startswith(n) for n in NAMES), qs[0].stem


def dec(f: Fraction) -> str:
    """An exact decimal as a student writes it: 0.8, 2.5, 4."""
    assert (f * 100).denominator == 1, f
    return f"{float(f):.2f}".rstrip("0").rstrip(".")


def key_is(q, v):
    """A short answer's key is the number v (an int or an exact Fraction), written as a student writes it."""
    v = Fraction(v)
    got = Fraction(q.answer.replace("−", "-").replace(" ", "").replace(",", ""))
    assert got == v, (q.stem, q.answer, v)
    if v.denominator == 1 and abs(v) >= 1000:
        assert fr(abs(v)) in q.accepted or f"-{fr(abs(v))}" in q.accepted, q.accepted


def _central(options):
    toks = [Counter(re.findall(r"-?\d+|[a-zA-Z]+|\S", o)) for o in options]
    score = [sum(sum(((t - u) + (u - t)).values()) for u in toks) for t in toks]
    best = min(score)
    return score.index(best) if score.count(best) == 1 else None


def shoelace(pts) -> Fraction:
    (x1, y1), (x2, y2), (x3, y3) = pts
    return abs(Fraction(x1 * (y2 - y3) + x2 * (y3 - y1) + x3 * (y1 - y2), 2))


def labels_clear_of_lines(fig, skip=()):
    """No drawn line (curve, price line or dotted guide) runs through a label in the plot area, in pixels."""
    fig.canvas.draw()
    r = fig.canvas.get_renderer()
    ax = fig.axes[0]
    for t in ax.texts:
        word = t.get_text().strip()
        if not word or word in skip:
            continue
        box = t.get_window_extent(r)
        for ln in ax.lines:
            pts = ln.get_transform().transform(ln.get_xydata())
            for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
                n = max(2, int(((x1 - x0) ** 2 + (y1 - y0) ** 2) ** 0.5 / 1.5))
                for k in range(n + 1):
                    x, y = x0 + (x1 - x0) * k / n, y0 + (y1 - y0) * k / n
                    assert not (box.x0 + 1 < x < box.x1 - 1 and box.y0 + 1 < y < box.y1 - 1), \
                        (word, ln.get_gid(), round(x), round(y))


# --- shared --------------------------------------------------------------------------------------------

@pytest.mark.parametrize("fid", NEW)
def test_family_is_worded_and_linked(fid):
    m = fam(fid)
    assert m.SUBJECT == "economics"
    assert m.CONCEPTS and all(c.startswith("economics.") for c in m.CONCEPTS)
    assert m.NEEDS
    for seed in range(1, 120):
        p, qs = run(m, seed)
        assert p["band"] in m.BANDS
        first = next((n for n in NAMES if qs[0].stem.startswith(n)), None)
        assert first, (fid, seed, qs[0].stem)
        for q in qs:
            for owner in re.findall(r"\b(" + "|".join(NAMES) + r")'s\b", q.stem):
                assert owner == first, (fid, seed, q.stem)
            # one question per figure in a quiz: no stem leans on another
            assert not re.search(r"\b(that|this) (price|amount|output|answer|country|year)\b|the answer above|"
                                 r"the same (person|firm|country)|as before", q.stem), (fid, q.stem)


@pytest.mark.parametrize("fid", NEW)
def test_most_figures_have_a_wording_of_their_own(fid):
    m = fam(fid)
    stems = []
    for seed in range(1, 31):
        rng = random.Random(seed)
        stems.append({q.stem for q in m.questions(m.sample(rng), rng)})
    own = sum(1 for i, s in enumerate(stems) if s - set().union(*(t for j, t in enumerate(stems) if j != i)))
    assert own >= 27, f"{fid}: only {own} of 30 figures have a wording of their own"


@pytest.mark.parametrize("fid", NEW)
def test_an_mcq_cannot_be_picked_from_its_options_alone(fid):
    m = fam(fid)
    seen, hits = defaultdict(int), defaultdict(int)
    for s in range(1, 301):
        _, qs = run(m, s)
        for q in qs:
            if q.kind == "mcq":
                key = re.sub(r"\d+", "#", q.stem.rsplit(". ", 1)[-1])
                seen[key] += 1
                hits[key] += _central(q.options) == int(q.answer)
    bad = {k: (hits[k], seen[k]) for k in seen if seen[k] >= 10 and hits[k] / seen[k] > 0.35}
    assert not bad, (fid, bad)


@pytest.mark.parametrize("fid", NEW)
def test_params_are_json(fid):
    m = fam(fid)
    for s in range(1, 41):
        p = m.sample(random.Random(s))
        assert json.loads(json.dumps(p)) == p, (fid, s)


# --- topics reached by name ----------------------------------------------------------------------------

REACH = {
    "ppc": ({"db:2347", "db:2378", "db:2351", "db:710"}, {"db:2348", "db:709", "db:711"}),
    "price_index": ({"db:2366", "db:2367", "db:726"}, set()),
    "cost_revenue": ({"db:723", "db:722"}, {"db:721"}),
    "production_table": ({"db:720"}, {"db:719"}),
    "externality_diagram": ({"db:2379", "db:2358"}, {"db:2352"}),
    "tariff_diagram": ({"db:2372", "db:739"}, {"db:742", "db:737"}),
    "goods_grid": ({"db:2352"}, {"db:2358"}),
    "development_indicators": ({"db:3033", "db:744", "db:745", "db:746", "db:747", "db:3741", "db:3893", "db:4045",
                                "waec:Economics:7"}, {"db:734"}),
    "credit_creation": ({"jamb:Economics:3", "waec:Economics:5", "db:728", "db:729"}, set()),
    "population_economics": ({"db:734"}, set()),
    "ad_as_policy": ({"db:2364", "db:2368", "db:2369", "db:2370"}, {"db:2375"}),
}


@pytest.mark.parametrize("fid", sorted(REACH))
def test_reaches_the_topics_named_for_it(fid):
    if not STORE.exists():
        pytest.skip("no figure store here")
    from figgen import link
    db = sqlite3.connect(f"file:{STORE}?mode=ro", uri=True)
    db.row_factory = sqlite3.Row
    got = link.reach(link.topic_index(db), fam(fid), 200)
    want, never = REACH[fid]
    assert want <= got, (fid, sorted(want - got))
    assert not (never & got), (fid, sorted(never & got))


def test_ppc_reaches_the_efficiency_chapter_only_with_the_point_inside_the_curve():
    m = fam("ppc")
    for s in range(1, 200):
        p = m.sample(random.Random(s))
        avoid = m.avoid_for(p)
        if p["ask"] == "outside":
            assert avoid and re.search(avoid, "Chapter 32: Introduction to efficiency", re.I)
        else:
            assert not avoid or not re.search(avoid, "Chapter 32: Introduction to efficiency", re.I)


# --- externality_diagram -------------------------------------------------------------------------------

def _meet(l1, l2):
    """Where P = p0 + s0·Q meets P = p1 + s1·Q, in grid steps."""
    (p0, s0), (p1, s1) = l1, l2
    q = Fraction(p1 - p0, s0 - s1)
    return q, p0 + s0 * q


def _ext_lines(p):
    a, b, c, d, e, kind = p["a"], p["b"], p["c"], p["d"], p["e"], p["kind"]
    mpb, mpc = (a, -b), (c, d)
    msb, msc = {"neg_prod": (mpb, (c + e, d)), "pos_prod": (mpb, (c - e, d)),
                "neg_cons": ((a - e, -b), mpc), "pos_cons": ((a + e, -b), mpc)}[kind]
    return mpb, mpc, msb, msc


def test_externality_diagram():
    m = fam("externality_diagram")
    kinds = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        first_names_the_person(qs)
        kind = p["kind"]
        kinds[kind] += 1
        assert p["band"] == "AL"
        dq, dp, qx, py = p["dq"], p["dp"], p["qx"], p["py"]
        mpb, mpc, msb, msc = _ext_lines(p)
        qm, pm = _meet(mpb, mpc)
        qs_, ps = _meet(msb, msc)
        social_line = msc if kind.endswith("prod") else msb
        private_line = mpc if kind.endswith("prod") else mpb
        third = (qm, social_line[0] + social_line[1] * qm)
        decoy = (qs_, private_line[0] + private_line[1] * qs_)
        roles = {"market": (qm, pm), "social": (qs_, ps), "third": third, "decoy": decoy}
        for name, (x, y) in roles.items():
            assert x.denominator == 1 and y.denominator == 1 and 1 <= x <= qx - 1 and 1 <= y <= py - 1, (s, name, x, y)
        # overproduced with an external cost, underproduced with an external benefit
        assert (qs_ < qm) == kind.startswith("neg") and abs(qs_ - qm) >= 2, (s, kind, qm, qs_)
        pts = {k: tuple(v) for k, v in p["points"].items()}
        assert sorted(pts) == list("ABCD") and set(pts.values()) == {(int(x), int(y)) for x, y in roles.values()}, (s, pts)
        letter = {v: k for k, v in pts.items()}
        per_unit = p["e"] * dp
        loss = Fraction(abs(qs_ - qm) * dq * per_unit, 2)
        assert loss.denominator == 1
        fig = m.draw(p) if s <= DRAWN else None
        asked = 0
        for q in qs:
            if "left to itself" in q.stem:
                asked += 1
                key_is(q, qm * dq)
            elif q.kind == "short" and "socially optimal output" in q.stem:
                asked += 1
                key_is(q, qs_ * dq)
            elif q.kind == "mcq":
                asked += 1
                assert "socially optimal" in q.stem and len(q.options) == 4
                assert sorted(o[-1] for o in q.options) == list("ABCD")
                assert picked(q) == f"Point {letter[(int(qs_), int(ps))]}", (s, q.options)
            elif re.search(r"external (cost|benefit) of each unit", q.stem):
                asked += 1
                word = re.search(r"external (cost|benefit) of each unit", q.stem).group(1)
                assert word == ("cost" if kind.startswith("neg") else "benefit"), (s, kind, q.stem)
                key_is(q, per_unit)
            elif "welfare loss" in q.stem:
                asked += 1
                corners = re.search(r"points ([A-D]), ([A-D]) and ([A-D])", q.stem).groups()
                assert "½ × base × height" in q.stem
                area = shoelace([pts[c] for c in corners]) * dq * dp
                assert area == loss, (s, corners, area, loss)
                key_is(q, loss)
            else:
                pytest.fail(q.stem)
        assert asked == len(qs) == 4, (s, [q.stem for q in qs])
        if fig:
            ax = fig.axes[0]
            words = texts(fig)
            for k, (x, y) in pts.items():
                assert on_grid(ax, x * dq, y * dp) and k in words, (s, k)
            # three lines: the private pair and the social curve that differs from its private one
            drawn = {"MPB": mpb, "MPC": mpc} | ({"MSC": msc} if kind.endswith("prod") else {"MSB": msb})
            for gid, (p0, slope) in drawn.items():
                for x, y in roles.values():
                    if y == p0 + slope * x:
                        assert passes(ax, gid, x * dq, y * dp, dp * 0.01), (s, gid, x, y)
            names = {"D = MPB = MSB", "S = MPC", "MSC"} if kind.endswith("prod") else {"S = MPC = MSC", "D = MPB", "MSB"}
            assert names <= set(words), (s, words)
            labels_clear_of_lines(fig)
            plt.close(fig)
    assert set(kinds) == {"neg_prod", "pos_prod", "neg_cons", "pos_cons"} and min(kinds.values()) > 150, kinds


# --- tariff_diagram ------------------------------------------------------------------------------------

def test_tariff_diagram():
    m = fam("tariff_diagram")
    bands = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        first_names_the_person(qs)
        bands[p["band"]] += 1
        a, b, c, d, pw, t, dq, dp, qx, py = (p[k] for k in ("a", "b", "c", "d", "pw", "t", "dq", "dp", "qx", "py"))
        q1, q2 = Fraction(pw - c, d), Fraction(a - pw, b)  # home supply and demand at the world price
        q3, q4 = Fraction(pw + t - c, d), Fraction(a - pw - t, b)  # and at the world price plus the tariff
        for v in (q1, q2, q3, q4):
            assert v.denominator == 1, (s, v)
        assert 1 <= q1 < q3 < q4 < q2 <= qx - 1, (s, q1, q3, q4, q2)
        qe = Fraction(a - c, b + d)
        assert pw + t < c + d * qe and t > 0 and pw >= 1 and pw + t <= py - 2, s  # still imports after the tariff
        before, after = (q2 - q1) * dq, (q4 - q3) * dq
        revenue = t * dp * after
        dwl = Fraction(t * dp * (q3 - q1) * dq + t * dp * (q2 - q4) * dq, 2)
        assert dwl.denominator == 1
        asked = 0
        for q in qs:
            assert f"{fr(t * dp)} Frw" in q.stem, (s, q.stem)
            if "deadweight" in q.stem:
                asked += 1
                assert p["band"] == "AL"
                key_is(q, dwl)
            elif "tariff revenue" in q.stem:
                asked += 1
                assert "tariff per unit × imports after the tariff" in q.stem
                key_is(q, revenue)
            elif "imported" in q.stem and "before the tariff" in q.stem.lower():
                asked += 1
                key_is(q, before)
            elif "imported" in q.stem and "after the tariff" in q.stem.lower():
                asked += 1
                key_is(q, after)
            elif "domestic producers" in q.stem:
                asked += 1
                key_is(q, q3 * dq)
            else:
                pytest.fail(q.stem)
        assert asked == len(qs) == 4, (s, [q.stem for q in qs])
        if s <= DRAWN:
            fig = m.draw(p)
            ax = fig.axes[0]
            words = " ".join(" ".join(t.split()) for t in texts(fig))  # a label set on two lines reads the same
            assert "World price" in words and "World price + tariff" in words
            for x, y, gid in ((q1, pw, "S"), (q2, pw, "D"), (q3, pw + t, "S"), (q4, pw + t, "D")):
                assert on_grid(ax, x * dq, y * dp), (s, x, y)
                assert passes(ax, gid, x * dq, y * dp, dp * 0.01), (s, gid, x, y)
            assert passes(ax, "world", dq, pw * dp, dp * 0.01) and passes(ax, "tariff", dq, (pw + t) * dp, dp * 0.01)
            labels_clear_of_lines(fig)
            plt.close(fig)
    assert set(bands) == {"UP", "AL"} and min(bands.values()) > 250, bands


# --- goods_grid ----------------------------------------------------------------------------------------

def _grid_boxes(fig):
    """Which box letter the drawn grid puts under each pair of headers: from where the headers and letters sit."""
    found = {t.get_text(): t.get_position() for t in fig.axes[0].texts}
    cols = {w: found[w][0] for w in ("Rival", "Non-rival")}
    rows = {w: found[w][1] for w in ("Excludable", "Non-excludable")}
    boxes = {}
    for letter in "WXYZ":
        x, y = found[letter]
        col = min(cols, key=lambda w: abs(cols[w] - x))
        row = min(rows, key=lambda w: abs(rows[w] - y))
        boxes[(col == "Rival", row == "Excludable")] = letter
    assert len(boxes) == 4, boxes
    return boxes


def test_goods_grid():
    m = fam("goods_grid")
    seen = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        first_names_the_person(qs)
        goods = {g: (r, e) for g, r, e in p["goods"]}
        assert 5 <= len(goods) <= 6
        public = [g for g, (r, e) in goods.items() if not r and not e]
        private = [g for g, (r, e) in goods.items() if r and e]
        assert public and private, (s, goods)
        # the grid as drawn: reading order W X / Y Z, columns and rows in the printed order
        cols, rows = p["cols"], p["rows"]
        boxes = {(r, e): "WXYZ"[2 * rows.index(e) + cols.index(r)] for r in (True, False) for e in (True, False)}
        if s <= DRAWN:
            fig = m.draw(p)
            assert _grid_boxes(fig) == boxes, s
            words = texts(fig)
            plt.close(fig)
            for g in goods:
                assert f"Good {g}" in words, (s, g)
            assert words.count("Yes") + words.count("No") == 2 * len(goods)
        asked = 0
        for q in qs:
            got = re.search(r"in which box of the grid does Good ([A-Z]) belong", q.stem)
            if got:
                asked += 1
                assert sorted(q.options) == ["Box W", "Box X", "Box Y", "Box Z"]
                assert picked(q) == f"Box {boxes[goods[got.group(1)]]}", (s, q.options)
                seen["box"] += 1
            elif "How many of the goods in the table are public goods" in q.stem:
                asked += 1
                key_is(q, len(public))
                seen[len(public)] += 1
            elif q.kind == "mcq":
                asked += 1
                kind = re.search(r"is an? (private|public) good\?", q.stem).group(1)
                want = private if kind == "private" else public
                hits = [o for o in q.options if o.removeprefix("Good ") in want]
                assert hits == [picked(q)] and len(q.options) == 4, (s, q.options, want)
                seen[kind] += 1
            else:
                pytest.fail(q.stem)
        assert asked == len(qs) == 3, (s, [q.stem for q in qs])
    assert seen["private"] > 200 and seen["public"] > 200 and seen[1] > 100 and seen[2] > 100, seen


# --- development_indicators ----------------------------------------------------------------------------

def _named(stem, pattern):
    return re.search(pattern, stem).groups()


def test_development_indicators():
    m = fam("development_indicators")
    kinds = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        first_names_the_person(qs)
        kind = p["kind"]
        kinds[kind] += 1
        rows = p["rows"]
        names = sorted(rows)
        assert names == ["P", "Q", "R", "S"], (s, names)

        def top(f, rows=rows):
            vals = sorted(((f(r), c) for c, r in rows.items()), reverse=True)
            assert vals[0][0] > vals[1][0], (s, vals)
            return vals[0][1]

        def low(f, rows=rows):
            vals = sorted((f(r), c) for c, r in rows.items())
            assert vals[0][0] < vals[1][0], (s, vals)
            return vals[0][1]

        pc = lambda r: Fraction(r["gni"] * 100, r["pop"])  # noqa: E731  GNI (tenths of a billion) ÷ population (millions)
        if s <= DRAWN:
            fig = m.draw(p)
            words = texts(fig)
            plt.close(fig)
            for c, r in rows.items():
                assert f"Country {c}" in words
                for k, v in r.items():
                    shown = {"gni": f"{v / 10:.1f}", "exports": f"{v / 10:.1f}", "yield": f"{v / 10:.1f}",
                             "hdi": f"0.{v:03d}"}.get(k, fr(v))
                    assert shown in words, (s, c, k, v, shown)
        asked = 0
        for q in qs:
            stem = q.stem
            if "GNI per capita = GNI ÷ population" in stem and q.kind == "short":
                asked += 1
                (c,) = _named(stem, r"GNI per capita of Country ([PQRS])")
                assert pc(rows[c]).denominator == 1
                key_is(q, pc(rows[c]))
            elif "highest GNI per capita" in stem:
                asked += 1
                best = top(pc)
                assert best != top(lambda r: r["gni"]), s  # the largest economy is not the richest per person
                assert picked(q) == f"Country {best}" and len(q.options) == 4
            elif "life expectancy" in stem:
                asked += 1
                x, y = _named(stem, r"in Country ([PQRS]) than in Country ([PQRS])")
                assert rows[x]["life"] > rows[y]["life"]
                key_is(q, rows[x]["life"] - rows[y]["life"])
            elif "HDI" in stem:
                asked += 1
                want = top(lambda r: r["hdi"]) if "highest" in stem else low(lambda r: r["hdi"])
                assert picked(q) == f"Country {want}" and len(q.options) == 4
            elif "most dependent on farming" in stem:
                asked += 1
                best = top(lambda r: r["farm"])
                assert best != top(lambda r: r["farm_gdp"]), s
                assert picked(q) == f"Country {best}" and len(q.options) == 4
            elif "work in farming" in stem:
                asked += 1
                (c,) = _named(stem, r"in Country ([PQRS]) work in farming")
                v = Fraction(rows[c]["workers"] * rows[c]["farm"], 100)
                assert (v * 10).denominator == 1
                key_is(q, v)
            elif "maize yield" in stem and q.kind == "short":
                asked += 1
                x, y = _named(stem, r"in Country ([PQRS]) higher than in Country ([PQRS])")
                key_is(q, Fraction(rows[x]["yield"] - rows[y]["yield"], 10))
                assert rows[x]["yield"] > rows[y]["yield"]
            elif "most maize per hectare" in stem:
                asked += 1
                assert picked(q) == f"Country {top(lambda r: r['yield'])}"
            elif "rise the most" in stem:
                asked += 1
                best = top(lambda r: r["ind_b"] - r["ind_a"])
                assert best != top(lambda r: r["ind_b"]), s
                assert picked(q) == f"Country {best}" and len(q.options) == 4
            elif "percentage points" in stem:
                asked += 1
                (c,) = _named(stem, r"in Country ([PQRS]) rise")
                assert rows[c]["ind_b"] > rows[c]["ind_a"]
                key_is(q, rows[c]["ind_b"] - rows[c]["ind_a"])
            elif "manufactured exports" in stem:
                asked += 1
                (c,) = _named(stem, r"Country ([PQRS])'s manufactured exports")
                v = Fraction(rows[c]["exports"] * rows[c]["manuf"], 1000)  # tenths of a billion × per cent
                assert (v * 10).denominator == 1
                key_is(q, v)
            elif "most industrialised" in stem:
                asked += 1
                assert picked(q) == f"Country {top(lambda r: r['ind_b'])}"
            elif "aid per person" in stem.lower() and q.kind == "short":
                asked += 1
                (c,) = _named(stem, r"did Country ([PQRS]) receive")
                v = Fraction(rows[c]["aid"], rows[c]["pop"])
                assert v.denominator == 1
                key_is(q, v)
            elif "most aid per person" in stem:
                asked += 1
                best = top(lambda r: Fraction(r["aid"], r["pop"]))
                assert best != top(lambda r: r["aid"]), s
                assert picked(q) == f"Country {best}"
            elif "percentage of GNI" in stem:
                asked += 1
                (c,) = _named(stem, r"in Country ([PQRS])")
                v = Fraction(rows[c]["aid"], rows[c]["gni"])  # million ÷ (tenths of a billion × 100) × 100
                assert (v * 10).denominator == 1
                key_is(q, v)
            else:
                pytest.fail(stem)
        assert asked == len(qs) == 4, (s, [q.stem for q in qs])
    assert set(kinds) == {"human", "farming", "industry", "aid"} and min(kinds.values()) > 150, kinds


# --- credit_creation -----------------------------------------------------------------------------------

def test_credit_creation():
    m = fam("credit_creation")
    kinds = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        first_names_the_person(qs)
        kinds[p["kind"]] += 1
        if p["kind"] == "rounds":
            r, n = p["ratio"], p["rows"]
            assert r in (10, 20, 25)
            deposits = [Fraction(p["initial"])]
            for _ in range(n):  # the n banks shown, and the next one, asked about
                deposits.append(deposits[-1] * (100 - r) / 100)
            table = [[dep, dep * r / 100, dep * (100 - r) / 100] for dep in deposits]
            assert all(v.denominator == 1 for row in table for v in row), (s, table)
            row_of = {f"Bank {k}": i for i, k in enumerate("ABCDE"[:n + 1])}
            blank = p["blank"]
            assert blank[0] >= 1 and 0 <= blank[1] <= 2
            if s <= DRAWN:
                fig = m.draw(p)
                words = texts(fig)
                plt.close(fig)
                assert words.count("?") == 1 and any(f"{r}%" in w for w in words)
                for i, row in enumerate(table[:n]):
                    for j, v in enumerate(row):
                        if [i, j] != blank:
                            assert fr(v) in words, (s, i, j, v)
                assert f"Bank {'ABCDE'[n]}" not in words
            asked = 0
            for q in qs:
                if "What is the credit multiplier" in q.stem:
                    asked += 1
                    assert "1 ÷ reserve ratio" in q.stem
                    key_is(q, Fraction(100, r))
                elif "total deposits" in q.stem.lower() and "credit created" not in q.stem:
                    asked += 1
                    key_is(q, p["initial"] * Fraction(100, r))
                elif "credit created" in q.stem:
                    asked += 1
                    key_is(q, p["initial"] * Fraction(100, r) - p["initial"])
                elif "marked ?" in q.stem:
                    asked += 1
                    key_is(q, table[blank[0]][blank[1]])
                else:
                    got = re.search(r"(loan made|reserves kept) by (Bank [A-E])", q.stem)
                    assert got, q.stem
                    asked += 1
                    i = row_of[got.group(2)]
                    assert i == n, (s, q.stem)  # the bank after the last one shown: worked out, not read
                    key_is(q, table[i][2 if got.group(1) == "loan made" else 1])
            assert asked == len(qs) == 4, (s, [q.stem for q in qs])
        else:
            it = p["items"]
            liab = it["deposits"] + it["capital"] + it["retained"]
            assets = it["cash"] + it["central"] + it["loans"] + it["bonds"] + it["premises"]
            assert liab == assets, (s, it)
            reserves = it["cash"] + it["central"]
            crr = Fraction(100 * reserves, it["deposits"])
            excess = reserves - Fraction(p["req"] * it["deposits"], 100)
            assert (crr * 10).denominator == 1 and excess > 0 and excess.denominator == 1, (s, crr, excess)
            if s <= DRAWN:
                fig = m.draw(p)
                words = texts(fig)
                plt.close(fig)
                assert words.count("?") == 1 and words.count(fr(liab)) == 2, (s, words)
                for k, v in it.items():
                    if k != p["blank"]:
                        assert fr(v) in words, (s, k)
            asked = 0
            for q in qs:
                if "marked ?" in q.stem:
                    asked += 1
                    assert "total assets = total liabilities" in q.stem
                    key_is(q, it[p["blank"]])
                elif "cash reserve ratio" in q.stem.lower():
                    asked += 1
                    key_is(q, crr)
                elif "excess reserves" in q.stem:
                    asked += 1
                    assert f"{p['req']}%" in q.stem
                    key_is(q, excess)
                else:
                    pytest.fail(q.stem)
            assert asked == len(qs) == 3, (s, [q.stem for q in qs])
    assert set(kinds) == {"rounds", "balance"} and min(kinds.values()) > 300, kinds


# --- population_economics ------------------------------------------------------------------------------

def test_population_economics():
    m = fam("population_economics")
    kinds = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        first_names_the_person(qs)
        kind = p["kind"]
        kinds[kind] += 1
        rows = p["rows"]
        if s <= DRAWN:
            fig = m.draw(p)
            words = texts(fig)
            plt.close(fig)
            for row in rows:
                assert str(row[0]) in words, (s, row[0])  # a year or a region's name
                for v in row[1:]:
                    assert fr(v) in words, (s, v, words)
        asked = 0
        for q in qs:
            stem = q.stem
            if kind == "ages":
                by = {y: (young, work, old) for y, young, work, old in rows}
                ratio = {y: Fraction(100 * (v[0] + v[2]), v[1]) for y, v in by.items()}
                if "dependency ratio in" in stem:
                    asked += 1
                    y = int(re.search(r"dependency ratio in (\d{4})", stem).group(1))
                    assert "(aged 0–14 + aged 65 and over) ÷ aged 15–64 × 100" in stem
                    assert (ratio[y] * 10).denominator == 1
                    key_is(q, ratio[y])
                elif "dependency ratio highest" in stem:
                    asked += 1
                    vals = sorted(((v, y) for y, v in ratio.items()), reverse=True)
                    assert vals[0][0] - vals[1][0] >= 1, (s, vals)
                    most_young = max(by, key=lambda y: by[y][0])
                    assert vals[0][1] != most_young, s
                    assert picked(q) == str(vals[0][1]) and len(q.options) == 4
                elif "aged 65 and over in" in stem:
                    asked += 1
                    y = int(re.search(r"aged 65 and over in (\d{4})", stem).group(1))
                    v = Fraction(100 * by[y][2], sum(by[y]))
                    assert (v * 10).denominator == 1
                    key_is(q, v)
                else:
                    pytest.fail(stem)
            elif kind == "rates":
                by = {y: (b, d) for y, b, d in rows}
                if "natural increase rate in" in stem:
                    asked += 1
                    y = int(re.search(r"natural increase rate in (\d{4})", stem).group(1))
                    assert "(birth rate − death rate) ÷ 10" in stem
                    key_is(q, Fraction(by[y][0] - by[y][1], 10))
                elif "growing fastest" in stem:
                    asked += 1
                    gaps = sorted(((b - d, y) for y, (b, d) in by.items()), reverse=True)
                    assert gaps[0][0] - gaps[1][0] >= 2, (s, gaps)
                    assert gaps[0][1] != max(by, key=lambda y: by[y][0]), s
                    assert picked(q) == str(gaps[0][1]) and len(q.options) == 4
                elif re.search(r"death rate( in Country [PQ])? fall", stem):
                    asked += 1
                    y0, y1 = (int(v) for v in re.search(r"between (\d{4}) and (\d{4})", stem).groups())
                    assert by[y0][1] > by[y1][1]
                    key_is(q, by[y0][1] - by[y1][1])
                else:
                    pytest.fail(stem)
            else:
                by = {r: (pop, area) for r, pop, area in rows}
                dens = {r: Fraction(1000 * pop, area) for r, (pop, area) in by.items()}
                if "population density of" in stem:
                    asked += 1
                    (r,) = re.search(r"population density of (Region [PQRS])", stem).groups()
                    assert dens[r].denominator == 1
                    key_is(q, dens[r])
                elif "most densely populated" in stem:
                    asked += 1
                    vals = sorted(((v, r) for r, v in dens.items()), reverse=True)
                    assert vals[0][0] >= vals[1][0] * Fraction(11, 10), (s, vals)
                    assert vals[0][1] != max(by, key=lambda r: by[r][0]), s
                    assert picked(q) == vals[0][1] and len(q.options) == 4
                elif "more people per km²" in stem:
                    asked += 1
                    x, y = re.search(r"in (Region [PQRS]) than in (Region [PQRS])", stem).groups()
                    assert dens[x] > dens[y] and dens[x].denominator == dens[y].denominator == 1
                    key_is(q, dens[x] - dens[y])
                else:
                    pytest.fail(stem)
        assert asked == len(qs) == 3, (s, [q.stem for q in qs])
    assert set(kinds) == {"ages", "rates", "density"} and min(kinds.values()) > 200, kinds


# --- ad_as_policy --------------------------------------------------------------------------------------

# What each stated policy or cause does, decided here from its words: the curve it moves and which way (+1: to the
# right, more at each price level).
POLICY_WORDS = [
    (r"cuts income tax|raises its spending|spending more on", "AD", 1),
    (r"raises income tax|cuts its spending", "AD", -1),
    (r"cuts its policy interest rate|increases the money supply", "AD", 1),
    (r"raises its policy interest rate|reduces the money supply", "AD", -1),
    (r"lowering firms' costs|lowers firms' costs", "AS", 1),
    (r"consumers grow more confident|exports rise", "AD", 1),
]


def _effect(stem):
    hits = [(curve, way) for pattern, curve, way in POLICY_WORDS if re.search(pattern, stem, re.I)]
    assert len(hits) == 1, (stem, hits)
    return hits[0]


def test_ad_as_policy():
    m = fam("ad_as_policy")
    kinds = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        first_names_the_person(qs)
        kind = p["kind"]
        assert p["band"] == "AL"
        b, d, (a1, a2), (c1, c2), xu, yu = p["b"], p["d"], p["ad"], p["sras"], p["xunit"], p["yunit"]
        meet = lambda a, c: (Fraction(a - c, b + d), a - b * Fraction(a - c, b + d))  # noqa: E731
        cross = {(i, j): meet(a, c) for i, a in enumerate((a1, a2)) for j, c in enumerate((c1, c2))}
        for v in cross.values():
            assert v[0].denominator == 1 and v[1].denominator == 1 and 1 <= v[0] <= 15 and 1 <= v[1] <= 19, (s, v)
        pts = {k: tuple(v) for k, v in p["points"].items()}
        assert sorted(pts) == list("ABCD") and set(pts.values()) == {(int(x), int(y)) for x, y in cross.values()}
        assert pts[p["start"]] == tuple(int(v) for v in cross[(0, 0)]), s
        curve, way = _effect(qs[0].stem)
        kinds[(kind, curve, way)] += 1
        if curve == "AD":
            assert (a2 > a1) == (way > 0), (s, a1, a2)
            new = cross[(1, 0)]
        else:
            assert (c2 < c1) == (way > 0), (s, c1, c2)  # SRAS lower down is SRAS to the right
            new = cross[(0, 1)]
        old = cross[(0, 0)]
        asked = 0
        for q in qs:
            assert _effect(q.stem) == (curve, way), (s, q.stem)
            assert f"point {p['start']}" in q.stem, q.stem
            if q.kind == "mcq":
                asked += 1
                assert sorted(o[-1] for o in q.options) == list("ABCD")
                assert pts[picked(q)[-1]] == (int(new[0]), int(new[1])), (s, q.options)
            elif "new price level" in q.stem:
                asked += 1
                key_is(q, new[1] * yu)
            elif "real GDP at the new equilibrium" in q.stem:
                asked += 1
                key_is(q, new[0] * xu)
            elif "rate of economic growth" in q.stem:
                asked += 1
                assert kind == "growth" and new[0] > old[0]
                v = (new[0] - old[0]) / old[0] * 100
                assert (v * 10).denominator == 1
                key_is(q, v)
            elif "change in real GDP" in q.stem:
                asked += 1
                key_is(q, (new[0] - old[0]) * xu)
            else:
                pytest.fail(q.stem)
        assert asked == len(qs) == 3, (s, [q.stem for q in qs])
        if s <= DRAWN:
            fig = m.draw(p)
            ax = fig.axes[0]
            words = texts(fig)
            assert {"AD1", "AD2", "SRAS1", "SRAS2"} <= set(words), (s, words)
            for k, (x, y) in pts.items():
                assert on_grid(ax, x * xu, y * yu) and k in words, (s, k)
            for (i, j), (x, y) in cross.items():
                assert passes(ax, f"AD{i + 1}", x * xu, y * yu, yu * 0.01), (s, i, j)
                assert passes(ax, f"SRAS{j + 1}", x * xu, y * yu, yu * 0.01), (s, i, j)
            labels_clear_of_lines(fig)
            plt.close(fig)
    assert {k for k, _, _ in kinds} == {"fiscal", "monetary", "supply", "growth"}, kinds
    assert ("fiscal", "AD", -1) in kinds and ("monetary", "AD", -1) in kinds and ("growth", "AS", 1) in kinds, kinds
