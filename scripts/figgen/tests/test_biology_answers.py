"""Answers of the Biology wave (P3i), recomputed from each figure's numbers over 1,000 seeds, with the biology
each figure must obey checked on what is drawn (P3i Review Focus 1)."""
import random
import re
from fractions import Fraction

import pytest

from figgen.families import FAMILIES

SEEDS = range(1, 1001)


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


def num(text):
    return Fraction(re.match(r"-?[\d.]+", text.replace("−", "-")).group())


# --- Task 1: graphs of processes -----------------------------------------------------------------

OPTIMUM = {  # real optima: (low, high)
    "pepsin": (1.5, 2.5), "salivary amylase": (6.5, 7.5), "trypsin": (7.5, 8.5), "lipase": (7.5, 8.5),
    "arginase": (9.5, 10.5), "an enzyme from a human": (35, 40), "an enzyme from a plant": (20, 30),
    "an enzyme from a hot-spring bacterium": (65, 80),
}


def test_enzyme_graph():
    m = fam("enzyme_graph")
    for s in SEEDS:
        p, qs = run(m, s)
        for e in p["enzymes"]:
            lo, hi = OPTIMUM[e["name"]]
            assert lo <= e["opt"] <= hi, (s, e)  # a real enzyme's optimum
            xs = [e["opt"] + d / 10 for d in range(-50, 51)]
            assert max(xs, key=lambda x: m.rate(p, e, x)) == pytest.approx(e["opt"])  # the curve peaks there
            assert e["peak"] % p["ystep"] == 0 and m.rate(p, e, e["opt"]) == pytest.approx(e["peak"])
        by = {e["letter"]: e for e in p["enzymes"]}
        for q in qs:
            got = re.search(r"optimum (?:temperature|pH) of enzyme ([A-Z])", q.stem)
            if got:
                assert num(q.answer) == Fraction(str(by[got.group(1)]["opt"]))
            got = re.search(r"rate of enzyme ([A-Z]) at its optimum", q.stem)
            if got:
                assert num(q.answer) == by[got.group(1)]["peak"]
            got = re.search(r"enzyme ([A-Z]) stop working", q.stem)
            if got:
                e = by[got.group(1)]
                assert num(q.answer) == e["zero"] and m.rate(p, e, e["zero"]) == pytest.approx(0, abs=1e-9)
                assert m.rate(p, e, e["zero"] - 0.5) > 0
            if q.kind == "mcq" and "stomach" in q.stem:
                assert picked(q) == f"enzyme {min(p['enzymes'], key=lambda e: e['opt'])['letter']}" and \
                    min(e["opt"] for e in p["enzymes"]) <= 3
            if q.kind == "mcq" and "Why does the rate fall" in q.stem:
                assert "denatured" in picked(q) and "active site" in picked(q)


def test_photosynthesis_rate():
    m = fam("photosynthesis_rate")
    for s in SEEDS:
        p, qs = run(m, s)
        low, high = p["curves"]  # each {"label", "corner": (light, rate)}, the same slope until each levels off
        slope = Fraction(low["corner"][1], low["corner"][0])
        assert Fraction(high["corner"][1], high["corner"][0]) == slope and high["corner"][1] > low["corner"][1]
        assert all(v % p["xstep"] == 0 for v in (low["corner"][0], high["corner"][0]))
        assert all(v % p["ystep"] == 0 for v in (low["corner"][1], high["corner"][1]))
        for q in qs:
            got = re.search(r"light intensity of (\d+)", q.stem)
            if got and "rate" in q.stem:
                x = int(got.group(1))
                assert x < low["corner"][0] and num(q.answer) == slope * x and (slope * x) % p["ystep"] == 0
            if "levels off" in q.stem:
                assert num(q.answer) == low["corner"][0]
            got = re.search(r"limiting factor at point ([A-Z])", q.stem)
            if got:
                light, rate = p["points"][got.group(1)]
                on_slope = light < low["corner"][0]
                assert picked(q) == ("light intensity" if on_slope else p["other"]), (s, q.stem, picked(q))


def test_population_curve():
    m = fam("population_curve")
    for s in SEEDS:
        p, qs = run(m, s)
        knots = p["knots"]  # [(time, number)] on gridlines, the curve drawn through them
        assert all(t % p["xstep"] == 0 and n % p["ystep"] == 0 for t, n in knots)
        K = p["K"]
        assert max(n for _, n in knots) == K
        for q in qs:
            if "carrying capacity" in q.stem:
                assert num(q.answer) == K
            got = re.search(r"population (?:size )?(?:after|at) (\d+) (?:days|hours|months)", q.stem)
            if got:
                t = int(got.group(1))
                assert num(q.answer) == dict(knots)[t]
            got = re.search(r"between (\d+) and (\d+) (?:days|hours|months)", q.stem)
            if got:
                t1, t2 = int(got.group(1)), int(got.group(2))
                assert num(q.answer) == Fraction(dict(knots)[t2] - dict(knots)[t1], t2 - t1)
            if q.kind == "mcq" and "exponential" in q.stem:
                assert p["phases"][picked(q)] == "exponential"


def test_osmosis_graph():
    m = fam("osmosis_graph")
    for s in SEEDS:
        p, qs = run(m, s)
        pts = p["points"]  # [(concentration in tenths, % change)]
        zero = p["zero"]
        assert dict(pts)[zero] == 0 and all(v % 5 == 0 for _, v in pts)
        assert all((v > 0) == (c < zero) for c, v in pts if c != zero)  # gains below the cells' own, loses above
        for q in qs:
            if "no change in mass" in q.stem:
                assert num(q.answer) == Fraction(zero, 10)
            got = re.search(r"in ([\d.]+) mol/dm³ sucrose", q.stem)
            if got and q.kind == "short":
                c = round(float(got.group(1)) * 10)
                assert num(q.answer) == dict(pts)[c]
            if got and q.kind == "mcq":
                c = round(float(got.group(1)) * 10)
                assert picked(q).startswith("gains" if c < zero else "loses")
                assert ("into" in picked(q)) == (c < zero)


def test_glucose_graph():
    m = fam("glucose_graph")
    for s in SEEDS:
        p, qs = run(m, s)
        people = {x["letter"]: x for x in p["people"]}
        diabetic = next(x for x in p["people"] if x["diabetic"])
        other = next(x for x in p["people"] if not x["diabetic"])
        assert max(v for _, v in diabetic["knots"]) > max(v for _, v in other["knots"])
        assert diabetic["knots"][-1][1] > other["knots"][-1][1]  # still high at the end
        assert 3.5 <= other["knots"][0][1] <= 6 and max(v for _, v in other["knots"]) <= 9  # a healthy range, mmol/dm³
        for q in qs:
            got = re.search(r"highest blood glucose of person ([A-Z])", q.stem)
            if got:
                assert num(q.answer) == Fraction(str(max(v for _, v in people[got.group(1)]["knots"])))
            got = re.search(r"person ([A-Z])'s blood glucose back", q.stem)
            if got:
                x = people[got.group(1)]
                start = x["knots"][0][1]
                back = next(t for t, v in x["knots"][1:] if v == start)
                assert num(q.answer) == back
            if q.kind == "mcq" and "diabetes" in q.stem:
                assert picked(q) == f"person {diabetic['letter']}"
            if q.kind == "mcq" and "hormone" in q.stem and "rises" in q.stem:
                assert picked(q) == "insulin"


def test_spirometer_trace():
    m = fam("spirometer_trace")
    for s in SEEDS:
        p, qs = run(m, s)
        assert 12 <= p["rate"] <= 20 and 0.4 <= p["tidal"] <= 0.6 and 3.0 <= p["vital"] <= 5.0
        for q in qs:
            if "breaths per minute" in q.stem or "breathing rate" in q.stem:
                assert num(q.answer) == p["rate"]
                assert m.peaks(p) * 60 // p["quiet"] == p["rate"]  # the peaks drawn in the quiet part give the rate
            if "tidal volume" in q.stem:
                assert num(q.answer) == Fraction(str(p["tidal"]))
            if "vital capacity" in q.stem:
                assert num(q.answer) == Fraction(str(p["vital"]))
            if "per minute" in q.stem and "volume of air" in q.stem:
                assert num(q.answer) == Fraction(str(p["tidal"])) * p["rate"]


# --- Task 2: inheritance and DNA -----------------------------------------------------------------

def _possible(people):
    """Every genotype (0, 1 or 2 recessive alleles) each person can have, given who is affected and who their parents
    are: an independent backtracking solver over all assignments consistent with Mendel."""
    order = sorted(people, key=lambda n: people[n]["generation"])
    seen = {n: set() for n in people}

    def options(n, g):
        q = people[n]
        mine = [2] if q["affected"] else [0, 1]
        if q["parents"]:
            a, b = (g[x] for x in q["parents"])
            can = {x + y for x in ({0} if a == 0 else {1} if a == 2 else {0, 1}) for y in ({0} if b == 0 else {1} if b == 2 else {0, 1})}
            mine = [x for x in mine if x in can]
        return mine

    def go(i, g):
        if i == len(order):
            for n in people:
                seen[n].add(g[n])
            return
        n = order[i]
        for x in options(n, g):
            g[n] = x
            go(i + 1, g)
        g.pop(n, None)

    go(0, {})
    return seen


def test_pedigree():
    m = fam("pedigree")
    for s in range(1, 401):
        p, qs = run(m, s)
        people = {int(k): v for k, v in p["people"].items()}
        possible = _possible(people)
        assert all(possible[n] for n in people), s  # the chart is consistent with a recessive allele
        couples = [(a, b) for a in people for b in people if a < b and any(set(q["parents"]) == {a, b} for q in people.values())]
        assert any(not people[a]["affected"] and not people[b]["affected"] and
                   any(set(q["parents"]) == {a, b} and q["affected"] for q in people.values()) for a, b in couples), s
        big, small = p["allele"], p["allele"].lower()
        names = {0: big + big, 1: big + small, 2: small + small}
        for q in qs:
            got = re.search(r"genotype of person (\d+)", q.stem)
            if got:
                n = int(got.group(1))
                assert len(possible[n]) == 1, (s, n, possible[n])  # only a genotype the chart decides
                assert picked(q) == names[next(iter(possible[n]))]
            got = re.search(r"persons? (\d+) and (\d+) have another child", q.stem)
            if got:
                a, b = int(got.group(1)), int(got.group(2))
                assert len(possible[a]) == 1 and len(possible[b]) == 1
                ga, gb = next(iter(possible[a])), next(iter(possible[b]))
                pa, pb = Fraction(ga, 2), Fraction(gb, 2)  # the chance each passes on the recessive allele
                assert num(q.answer) == pa * pb * 100
            if q.kind == "mcq" and "dominant or recessive" in q.stem:
                assert picked(q).startswith("recessive")


PAIR = {"A": "T", "T": "A", "G": "C", "C": "G"}


def test_dna_strand():
    m = fam("dna_strand")
    for s in SEEDS:
        p, qs = run(m, s)
        top, bottom = p["top"], p["bottom"]
        assert all(PAIR[a] == b for a, b in zip(top, bottom))  # every pair drawn is complementary
        shown = p["shown"]  # positions of the lower strand that are printed
        for q in qs:
            got = re.search(r"position (\d+) on the lower strand", q.stem)
            if got:
                k = int(got.group(1))
                assert k - 1 not in shown and q.answer == bottom[k - 1]  # asked only where it is hidden
            got = re.search(r"How many (\w+) bases", q.stem)
            if got:
                base = {"adenine": "A", "thymine": "T", "guanine": "G", "cytosine": "C"}[got.group(1)]
                assert int(q.answer) == (top + bottom).count(base)
            got = re.search(r"percentage of the bases .* are (\w+)", q.stem)
            if got:
                base = {"adenine": "A", "thymine": "T", "guanine": "G", "cytosine": "C"}[got.group(1)]
                assert num(q.answer) == Fraction(100 * (top + bottom).count(base), 2 * len(top))
            got = re.search(r"bases (\d+) to (\d+) of the lower strand", q.stem)
            if got:
                i, j = int(got.group(1)), int(got.group(2))
                assert q.answer == "".join(top[i - 1:j]).replace("T", "U")  # the mRNA matches the other strand, U for T
            got = re.search(r"hydrogen bonds hold base pair (\d+)", q.stem)
            if got:
                k = int(got.group(1))
                assert int(q.answer) == (2 if top[k - 1] in "AT" else 3)


# --- Task 3: ecology, keys and variation ---------------------------------------------------------

def test_quadrat():
    m = fam("quadrat")
    for s in SEEDS:
        p, qs = run(m, s)
        W, H, plants, quads = p["W"], p["H"], p["plants"], p["quadrats"]
        cells = {tuple(c) for c in quads.values()}
        assert len(cells) == len(quads) and all(0 <= x < W and 0 <= y < H for x, y in cells)
        assert all(max(abs(a[0] - b[0]), abs(a[1] - b[1])) >= 2 for a in cells for b in cells if a != b)  # none touch
        for x, y in plants:  # no plant near a gridline, so none sits on a quadrat's edge
            assert 0.1 <= x % 1 <= 0.9 and 0.1 <= y % 1 <= 0.9, (s, x, y)
        for i, (x1, y1) in enumerate(plants):  # plants in a cell stand apart, so each can be counted
            for x2, y2 in plants[i + 1:]:
                if int(x1) == int(x2) and int(y1) == int(y2):
                    assert ((x1 - x2) ** 2 + (y1 - y2) ** 2) ** 0.5 >= 0.25, (s, x1, y1, x2, y2)
        count = {k: sum(1 for x, y in plants if int(x) == c[0] and int(y) == c[1]) for k, c in quads.items()}
        mean = Fraction(sum(count.values()), len(count))
        for q in qs:
            got = re.search(r"in quadrat ([A-Z])\b", q.stem)
            if got and "How many" in q.stem:
                assert int(q.answer) == count[got.group(1)]
            if "mean number" in q.stem:
                assert num(q.answer) == mean
            if "whole field" in q.stem:
                assert num(q.answer) == mean * W * H


def test_dichotomous_key():
    m = fam("dichotomous_key")
    for s in SEEDS:
        p, qs = run(m, s)
        plants = {x["letter"]: x for x in p["plants"]}
        vectors = [tuple(sorted(x["features"].items())) for x in p["plants"]]
        assert len(set(vectors)) == len(vectors) and len({x["name"] for x in p["plants"]}) == len(vectors)
        key = p["key"]  # couplets: {"feature", "yes": [kind, value], "no": [kind, value]}
        for x in p["plants"]:  # every leaf, followed through the key, reaches its own name
            at, steps = 1, 0
            while True:
                c = key[at - 1]
                kind, value = c["yes"] if x["features"][c["feature"]] else c["no"]
                steps += 1
                assert steps <= len(key)
                if kind == "name":
                    assert value == x["name"], (s, x["name"], value)
                    break
                at = value
        for q in qs:
            got = re.search(r"name the plant that leaf ([A-Z]) comes from", q.stem)
            if got:
                assert q.answer == plants[got.group(1)]["name"]
            if q.kind == "mcq" and "Which leaf" in q.stem:
                f = p["unique"]
                have = [x["letter"] for x in p["plants"] if x["features"][f]]
                assert have == [picked(q)]


def test_variation_chart():
    m = fam("variation_chart")
    for s in SEEDS:
        p, qs = run(m, s)
        cont, disc = p["continuous"], p["discrete"]
        assert sorted(cont["freq"]).count(max(cont["freq"])) == 1  # one modal class
        for q in qs:
            if q.kind == "mcq" and "continuous variation" in q.stem:
                assert picked(q) == f"chart {cont['letter']}"
            got = re.search(r"How many students (?:have|had|are|were|can) (.+?)\?", q.stem)
            if got:
                i = disc["categories"].index(p["ask"])
                assert int(q.answer) == disc["freq"][i]
            if "modal class" in q.stem:
                i = cont["freq"].index(max(cont["freq"]))
                assert q.answer == cont["classes"][i]


# --- Task 4: cells and the laboratory ------------------------------------------------------------

SIZE_UM = {"a cheek cell": (40, 80), "a palisade cell": (40, 120), "an onion epidermis cell": (100, 300),
           "a red blood cell": (6, 9), "a bacterium": (1, 5), "a mitochondrion": (0.5, 5), "a pollen grain": (20, 60)}


def test_magnification():
    m = fam("magnification")
    for s in SEEDS:
        p, qs = run(m, s)
        L = p["end"] - p["start"]  # mm on the drawing, read off the ruler's mm marks
        assert isinstance(p["start"], int) and isinstance(p["end"], int)
        actual = Fraction(L * 1000, p["mag"])
        lo, hi = SIZE_UM[p["specimen"]]
        assert lo <= actual <= hi, (s, p["specimen"], actual)  # a real cell's size
        if p["bar"]:
            assert Fraction(p["bar"]["mm"] * 1000, p["bar"]["um"]) == p["mag"]  # the scale bar gives the magnification
        for q in qs:
            if "image" in q.stem and "mm" in q.stem and "long" in q.stem:
                assert num(q.answer) == L
            if "actual" in q.stem:
                assert num(q.answer) == actual
            if "What is the magnification" in q.stem:
                assert num(q.answer.lstrip("×x")) == p["mag"]


def test_antibiotic_plate():
    m = fam("antibiotic_plate")
    for s in SEEDS:
        p, qs = run(m, s)
        g = p["grid"]
        for d in p["discs"]:
            r = Fraction(d["zone"], 2)
            if d["zone"]:
                for edge in (d["x"] - r, d["x"] + r, d["y"] - r, d["y"] + r):
                    assert edge % g == 0, (s, d)  # every zone's edge on a gridline
        zones = sorted(d["zone"] for d in p["discs"])
        assert zones[-1] > zones[-2]  # one most effective
        by = {d["letter"]: d for d in p["discs"]}
        for q in qs:
            got = re.search(r"clear zone around disc ([A-Z])", q.stem)
            if got and "diameter" in q.stem:
                assert num(q.answer) == by[got.group(1)]["zone"]
            if got and "area" in q.stem:
                assert num(q.answer) == Fraction(314, 100) * Fraction(by[got.group(1)]["zone"], 2) ** 2
            if q.kind == "mcq" and "most effective" in q.stem:
                assert by[picked(q)]["zone"] == zones[-1]


def test_sa_volume():
    m = fam("sa_volume")
    for s in SEEDS:
        p, qs = run(m, s)
        side = {c["letter"]: c["side"] for c in p["cubes"]}
        assert len(set(side.values())) == len(side)
        for q in qs:
            got = re.search(r"cube ([A-Z])", q.stem)
            if not got:
                continue
            a = side[got.group(1)]
            if "surface area to volume" in q.stem and q.kind == "short":
                assert num(q.answer) == Fraction(6, a)
            elif "surface area" in q.stem:
                assert num(q.answer) == 6 * a * a
            elif "volume" in q.stem:
                assert num(q.answer) == a ** 3
        for q in qs:
            if q.kind == "mcq":
                assert side[picked(q)] == min(side.values())  # the smallest cube has the most surface for its volume


SHOWS = {"starch": ("iodine", "blue-black"), "reducing sugar": ("Benedict's", "brick-red"), "protein": ("biuret", "purple"),
         "fat": ("ethanol", "cloudy white")}


def test_food_test_table():
    m = fam("food_test_table")
    for s in SEEDS:
        p, qs = run(m, s)
        foods = p["foods"]  # {letter: {nutrient: bool}}
        for letter, has in foods.items():
            for nutrient, present in has.items():
                test, colour = SHOWS[nutrient]
                assert (m.result(nutrient, present) == colour) == present  # the colour drawn says what is there
        for q in qs:
            got = re.search(r"Which food contains (starch|reducing sugar|protein|fat)\?", q.stem)
            if got:
                n = got.group(1)
                have = [k for k, v in foods.items() if v[n]]
                assert have == [picked(q)]
            got = re.search(r"How many of the foods contain (starch|reducing sugar|protein|fat)\?", q.stem)
            if got:
                assert int(q.answer) == sum(v[got.group(1)] for v in foods.values())
            got = re.search(r"Which food contains both (\w[\w ]*) and (\w[\w ]*)\?", q.stem)
            if got:
                a, b = got.group(1), got.group(2)
                have = [k for k, v in foods.items() if v[a] and v[b]]
                assert have == [picked(q)]


# --- P3i final review ----------------------------------------------------------------------------

def test_a_lobed_leaf_is_one_blade_not_leaflets():
    """Cassava drawn as five free ellipses read as "divided into leaflets", so the key led to neem (P3i review)."""
    from matplotlib.path import Path as MPath
    m = fam("dichotomous_key")
    pts = m.palmate(0.0, 0.0, 2.4)  # one outline
    shape = MPath(pts)
    assert shape.contains_point((0.0, 0.3))  # a palm joins the lobes near the base
    tips = [(0.0, 0.0 + 2.4 * 0.75)]
    assert all(min(((x - tx) ** 2 + (y - ty) ** 2) ** 0.5 for x, y in pts) < 0.15 for tx, ty in tips)
    assert not shape.contains_point((0.45, 1.6))  # deep cuts between the lobes


def test_the_scale_bar_is_measured_on_the_ruler():
    """A bar 30 mm above the ruler with no guides could not be measured on screen (P3i review)."""
    import matplotlib.pyplot as plt
    m = fam("magnification")
    for s in range(1, 300):
        p = m.sample(random.Random(s))
        if not p["bar"]:
            continue
        x0, x1 = m.bar_span(p)
        assert x0 == int(x0) and x1 == int(x1) and x1 - x0 == p["bar"]["mm"]  # whole millimetres on the ruler
        fig = m.draw(p)
        drops = {round(ln.get_xdata()[0], 6) for ln in fig.axes[0].lines
                 if len(ln.get_xdata()) == 2 and ln.get_xdata()[0] == ln.get_xdata()[1] and ln.get_linestyle() != "-"}
        plt.close(fig)
        assert {x0, x1} <= drops, (s, drops)  # dashed guides from the bar's ends down to the ruler


def test_no_biology_question_is_answerable_without_the_figure():
    """The hormone, the "why it falls" and the producer questions needed no figure (P3i review)."""
    for fid, words in (("glucose_graph", "hormone"), ("enzyme_graph", "Why does the rate fall"),
                       ("food_web", "is a producer?")):
        m = fam(fid)
        for s in range(1, 120):
            _, qs = run(m, s)
            assert not any(words in q.stem for q in qs), (fid, s)


def test_osmosis_asks_about_the_points_either_side_of_the_crossing():
    m = fam("osmosis_graph")
    for s in SEEDS:
        p = m.sample(random.Random(s))
        cs = sorted(c for c, _ in p["points"])
        below = max(c for c in cs if c < p["zero"])
        above = min(c for c in cs if c > p["zero"])
        assert p["why"] in (below, above)  # 0 always gains and 1.0 always loses: no reading needed


def test_food_web_asks_what_only_the_web_shows():
    m = fam("food_web")
    for s in SEEDS:
        p, qs = run(m, s)
        links = [tuple(l) for l in p["links"]]
        eaters = {e for _, e in links}
        names = {n for l in links for n in l}
        producers = names - eaters
        q = next(q for q in qs if "How many producers" in q.stem)
        assert int(q.answer) == len(producers)
        q = next((q for q in qs if q.kind == "mcq" and "eats" in q.stem), None)
        if q:
            food = re.search(r"eats (?:the )?([\w -]+?)\?", q.stem).group(1)
            assert {e for f_, e in links if f_ == food} == {picked(q)}  # the one animal that eats it


def test_units_written_several_ways_are_accepted():
    pc = fam("population_curve")
    for s in range(1, 200):
        p, qs = run(pc, s)
        if "millions" in pc.ORGANISMS[p["organism"]][4]:
            q = next(q for q in qs if "carrying capacity" in q.stem)
            assert f"{q.answer} million" in q.accepted and f"{q.answer} million cells per cm³" in q.accepted
    sp = fam("spirometer_trace")
    for s in range(1, 100):
        _, qs = run(sp, s)
        q = next(q for q in qs if "tidal volume" in q.stem)
        assert any(f.endswith(" ml") for f in q.accepted) and any(f.endswith(" mL") for f in q.accepted)
    ph = fam("photosynthesis_rate")
    for s in range(1, 100):
        p, qs = run(ph, s)
        q = next(q for q in qs if "What is the rate" in q.stem)
        unit = ph.RATES[p["units"]][1]
        if "bubbles" in unit:
            assert f"{q.answer} bubbles/min" in q.accepted
        else:
            assert f"{q.answer} cm³ per hour" in q.accepted and f"{q.answer} cm3/h" in q.accepted
    mg = fam("magnification")
    for s in range(1, 300):
        p, qs = run(mg, s)
        for q in qs:
            if "What is the magnification" in q.stem:
                assert f"{q.answer}x" in q.accepted and f"x {q.answer}" in q.accepted
    gl = fam("glucose_graph")
    for s in range(1, 50):
        _, qs = run(gl, s)
        q = next(q for q in qs if "minutes after the meal" in q.stem)
        assert f"{q.answer} mins" in q.accepted
    ft = fam("food_test_table")
    for s in range(1, 300):
        _, qs = run(ft, s)
        q = next(q for q in qs if "How many of the foods" in q.stem)
        if q.answer == "0":
            assert "none" in q.accepted
    vc = fam("variation_chart")
    for s in range(1, 50):
        _, qs = run(vc, s)
        q = next(q for q in qs if "modal class" in q.stem)
        assert q.answer.replace("–", " - ") in q.accepted


def test_the_genotype_question_names_its_condition():
    m = fam("pedigree")
    for s in range(1, 100):
        p, qs = run(m, s)
        q = next(q for q in qs if "genotype of person" in q.stem)
        assert p["condition"] in q.stem


BIOLOGY = sorted(f for f, m in FAMILIES.items() if m.SUBJECT == "biology")


def _central(options):
    from collections import Counter
    toks = [Counter(re.findall(r"-?\d+|[a-zA-Z]+|\S", o)) for o in options]
    score = [sum(sum(((t - u) + (u - t)).values()) for u in toks) for t in toks]
    best = min(score)
    return score.index(best) if score.count(best) == 1 else None


@pytest.mark.parametrize("fid", BIOLOGY)
def test_a_biology_mcq_cannot_be_picked_from_its_options_alone(fid):
    from collections import defaultdict
    m = FAMILIES[fid]
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


# --- P3j review ----------------------------------------------------------------------------------

def test_quadrat_labels_hide_no_plant_and_plants_stand_clear_of_edges():
    """Letters above the quadrats covered plants, and plants near the edges read as maybe in (P3j review)."""
    m = fam("quadrat")
    for s in range(1, 300):
        p = m.sample(random.Random(s))
        for x, y in p["plants"]:
            assert 0.22 - 1e-9 <= x % 1 <= 0.78 + 1e-9 and 0.22 - 1e-9 <= y % 1 <= 0.78 + 1e-9, (s, x, y)
            for cx, cy in p["quadrats"].values():
                assert not (cx <= x <= cx + 1 and cy + 1 <= y <= cy + 1.5), (s, x, y)  # the letter's patch above


def test_osmosis_accepts_a_change_said_in_words():
    m = fam("osmosis_graph")
    for s in range(1, 200):
        _, qs = run(m, s)
        q = next(q for q in qs if "percentage change" in q.stem)
        v = int(q.answer)
        if v < 0:
            assert f"{-v}% decrease in mass" in q.accepted
        elif v > 0:
            assert f"{v}% increase in mass" in q.accepted


def test_dna_strands_show_their_ends_and_the_codon_says_its_direction():
    """With no 5' and 3' ends the codon could be read either way (P3j review); "written 5′ to 3′" in the stem
    was itself read backwards, so the stem asks for the pairing bases left to right (P3j fix review)."""
    import matplotlib.pyplot as plt
    m = fam("dna_strand")
    fig = m.draw(m.sample(random.Random(1)))
    texts = [t.get_text() for t in fig.axes[0].texts]
    plt.close(fig)
    assert texts.count("5′") == 2 and texts.count("3′") == 2
    for s in range(1, 200):
        _, qs = run(m, s)
        for q in qs:
            if "codon" in q.stem:
                assert "in order from left to right" in q.stem and "5′ to 3′" not in q.stem


def test_the_codon_reads_left_to_right_and_takes_its_ends_written():
    """Reviewers reversed the codon one time in six, and "5′-CCU-3′" was marked wrong (P3j fix review)."""
    m = fam("dna_strand")
    seen = 0
    for s in range(1, 200):
        _, qs = run(m, s)
        for q in qs:
            if "codon" in q.stem:
                seen += 1
                assert "left to right" in q.stem
                assert f"5′-{q.answer}-3′" in q.accepted and f"5'-{q.answer}-3'" in q.accepted
    assert seen > 20
