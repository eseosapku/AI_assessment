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
