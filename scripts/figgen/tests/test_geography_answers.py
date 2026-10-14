"""Answers of the Geography wave (P3m), recomputed from each figure's params over 1,000 seeds."""
import random
import re

import pytest

from figgen.families import FAMILIES

SEEDS = range(1, 1001)
MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October",
          "November", "December"]


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


# --- Task 1: the pilot families reworked ----------------------------------------------------------

def test_climate_graph():
    m = fam("climate_graph")
    for s in SEEDS:
        p, qs = run(m, s)
        rain, temp = p["rain"], p["temp"]
        assert all(r % 5 == 0 for r in rain) and all(t % 2 == 0 for t in temp)
        if p.get("place"):  # a Rwandan station keeps its two rainy seasons and its dry June to August
            dry = max(rain[5:8])
            assert dry < min(rain[2:5]) and dry < rain[10], (s, rain)
        for q in qs:
            if q.kind == "mcq" and "most rainfall" in q.stem:
                assert picked(q) == MONTHS[rain.index(max(rain))]
                assert rain.count(max(rain)) == 1
            got = re.search(r"How much rain falls in (\w+)", q.stem)
            if got:
                assert int(q.answer) == rain[MONTHS.index(got.group(1))]
            if "temperature range" in q.stem:
                assert int(q.answer) == max(temp) - min(temp)
            got = re.search(r"from (\w+) to (\w+)", q.stem)
            if got:
                a, b = MONTHS.index(got.group(1)), MONTHS.index(got.group(2))
                assert a < b and int(q.answer) == sum(rain[a:b + 1])


def test_cross_section():
    m = fam("cross_section")
    for s in SEEDS:
        p, qs = run(m, s)
        h, x, y, c = p["heights"], p["x"], p["y"], p["cuts"]
        assert all(v % 50 == 0 for v in h)
        grads = [abs(h[b] - h[a]) / (b - a) for a, b in zip(c, c[1:])]
        for q in qs:
            if "height of the land at X" in q.stem:
                assert int(q.answer) == h[x]
            if "difference in height" in q.stem:
                assert int(q.answer) == abs(h[x] - h[y])
            if q.kind == "mcq" and "steepest" in q.stem:
                assert picked(q) == f"Section {grads.index(max(grads)) + 1}"
            if "vertical exaggeration" in q.stem:
                assert p["band"] == "UP"
                assert int(q.answer) == 50000 // p["vertical"] and 50000 % p["vertical"] == 0


def test_population_pyramid():
    m = fam("population_pyramid")
    groups = m.GROUPS
    for s in SEEDS:
        p, qs = run(m, s)
        male, female = p["male"], p["female"]
        assert sum(male) + sum(female) == 100
        for q in qs:
            assert "shape" not in q.stem  # P3b: the shapes were disputed
            got = re.search(r"percentage of the population are (males|females) aged (\S+?)\?", q.stem)
            if got:
                side = male if got.group(1) == "males" else female
                assert int(q.answer) == side[groups.index(got.group(2))]
            if "aged under 20" in q.stem and "60" not in q.stem:
                assert int(q.answer) == sum(male[:2]) + sum(female[:2])
            if "aged under 20 or 60 and over" in q.stem:
                assert int(q.answer) == sum(male[:2]) + sum(female[:2]) + sum(male[6:]) + sum(female[6:])
            if "more males or more females" in q.stem:
                old_m, old_f = sum(male[6:]), sum(female[6:])
                assert old_m != old_f
                assert q.answer == ("Males" if old_m > old_f else "Females")
