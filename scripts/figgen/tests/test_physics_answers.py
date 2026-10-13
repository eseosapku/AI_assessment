"""Answers of the Physics wave (P3e), recomputed from each figure's numbers over 1,000 seeds, with the
physics each figure must obey checked on what is drawn (P3e Review Focus 5)."""
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
    """The leading number of an answer: "2.5" or "1,200"."""
    return Fraction(re.match(r"-?[\d.,]+", text).group().replace(",", ""))


# --- Task 2: motion and forces ------------------------------------------------------------------

def test_motion_graph():
    m = fam("motion_graph")
    for s in SEEDS:
        p, qs = run(m, s)
        pts = [tuple(c) for c in p["corners"]]
        assert pts[0] == (0, 0) and all(t1 > t0 for (t0, _), (t1, _) in zip(pts, pts[1:]))
        assert all(t % p["tstep"] == 0 and y % p["ystep"] == 0 for t, y in pts), p  # every corner on a gridline
        rate = lambda a, b: Fraction(b[1] - a[1], b[0] - a[0])  # noqa: E731
        if p["kind"] == "dt":
            first, stopped, average, total = qs
            assert num(first.answer) == rate(pts[0], pts[1]) and rate(pts[0], pts[1]) > 0
            assert all(y1 >= y0 for (_, y0), (_, y1) in zip(pts, pts[1:]))  # distance never falls
            assert int(stopped.answer) == sum(b[0] - a[0] for a, b in zip(pts, pts[1:]) if b[1] == a[1]) > 0
            assert num(average.answer) == Fraction(pts[-1][1], pts[-1][0])
            assert int(total.answer) == pts[-1][1]
        else:
            first, distance, force, last = qs
            a1 = rate(pts[0], pts[1])
            assert num(first.answer) == a1 and (2 * a1).denominator == 1
            area = sum(Fraction((a[1] + b[1]) * (b[0] - a[0]), 2) for a, b in zip(pts, pts[1:]))
            assert area.denominator == 1 and int(distance.answer) == area and pts[-1][1] == 0
            mass = int(re.search(r"mass of (\d+) kg", force.stem).group(1))
            assert num(force.answer) == mass * a1 and (mass * a1).denominator == 1  # F = ma
            assert num(last.answer) == -rate(pts[-2], pts[-1]) > 0


def test_force_diagram():
    m = fam("force_diagram")
    for s in SEEDS:
        p, (resultant, accel, weight) = run(m, s)
        net = sum(f if d == "right" else -f for d, f in p["forces"])
        assert net != 0
        size, way = abs(net), "right" if net > 0 else "left"
        assert picked(resultant) == f"{size} N to the {way}"
        assert all(o != picked(resultant) for i, o in enumerate(resultant.options) if i != int(resultant.answer))
        assert num(accel.answer) == Fraction(size, p["mass"]) and (2 * Fraction(size, p["mass"])).denominator == 1  # a = F/m
        assert "g = 10 N/kg" in weight.stem and num(weight.answer) == 10 * p["mass"]
        total = sum(f for _, f in p["forces"])
        # Size (the resultant, or all the forces added up) by direction: a 2 x 2 set, nothing to pick unseen.
        assert set(resultant.options) == {f"{v} N to the {w}" for v in (size, total) for w in ("right", "left")}


def test_moments():
    m = fam("moments")
    for s in SEEDS:
        p, qs = run(m, s)
        pivot = p["pivot"]
        loads = [(x, f) for x, f in p["loads"]]
        (ux, uf) = p["unknown"]
        weight, moment = qs[:2]
        assert all(x % 5 == 0 and 0 <= x <= 100 for x, _ in loads + [(ux, uf)])
        # Balance: every moment about the pivot, the rule's own weight at its middle included.
        turning = sum(f * (x - pivot) for x, f in loads) + p["rule"] * (50 - pivot)
        assert num(weight.answer) * (ux - pivot) + turning == 0 and num(weight.answer) == uf and uf > 0
        mt = re.search(r"of the (\d+(?:\.\d+)?) N load at (\d+) cm", moment.stem)
        f, x = Fraction(mt.group(1)), int(mt.group(2))
        assert num(moment.answer) == f * abs(x - pivot) / 100  # in N m
        if len(qs) > 2:
            assert num(qs[2].answer) == sum(f for _, f in loads) + uf + p["rule"]  # the pivot holds it all up


def test_spring_graph():
    m = fam("spring_graph")
    for s in SEEDS:
        p, qs = run(m, s)
        e, L = Fraction(p["cm_per_n"]), p["limit"]
        k, ext, limit = qs[:3]
        assert num(k.answer) == 1 / e
        F = int(re.search(r"load of (\d+) N", ext.stem).group(1))
        assert F <= L and num(ext.answer) == F * e and (F * e) % Fraction(p["ystep"]) == 0  # on a gridline
        assert int(limit.answer) == L
        x0, x1, y0, y1 = m.view(p)
        assert L * e <= y1
        if p["band"] == "UP":
            F2 = int(re.search(r"load of (\d+) N", qs[3].stem).group(1))
            assert F2 <= L and num(qs[3].answer) == Fraction(1, 2) * F2 * F2 * e / 100  # ½Fx, x in m
