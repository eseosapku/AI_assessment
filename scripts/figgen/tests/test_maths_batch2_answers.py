"""Answers of the second Maths batch (P3c), recomputed from each figure's numbers over 1,000 seeds,
with the invariants that keep every value readable off the drawing."""
import random
import re
from fractions import Fraction

import numpy as np
import pytest

from figgen.families import FAMILIES

SEEDS = range(1, 1001)  # spec 12: every answer holds on 1,000 seeds


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


def value(co, x):
    """A polynomial, highest power first, at x."""
    return sum(c * x ** (len(co) - 1 - i) for i, c in enumerate(co))


def slope(co, x):
    n = len(co) - 1
    return sum(c * (n - i) * x ** (n - i - 1) for i, c in enumerate(co[:-1]))


def line_of(text):
    """("y = -2x + 3") -> (m, c)."""
    mt = re.fullmatch(r"y = (-?\d*)x(?: ([+-]) (\d+))?", text)
    assert mt, text
    m = {"": 1, "-": -1}.get(mt.group(1), None)
    m = int(mt.group(1)) if m is None else m
    c = 0 if not mt.group(2) else int(mt.group(3)) * (1 if mt.group(2) == "+" else -1)
    return m, c


def point_of(text):
    return tuple(int(v) for v in re.findall(r"-?\d+", text))


# --- Task 2: calculus graphs ------------------------------------------------------------------

def test_tangent_gradient():
    m = fam("tangent_gradient")
    for s in SEEDS:
        p, (grad, at_x, eq, normal) = run(m, s)
        co, (xp, yp), (xq, yq) = p["coeffs"], p["P"], p["Q"]
        g = slope(co, xp)
        assert yp == value(co, xp) and g != 0 and abs(g) <= 6, p
        assert yq == yp + g * (xq - xp) and abs(xq - xp) >= 2, p  # Q on the tangent, a lattice point
        x0, x1, y0, y1 = m.view(p)
        assert x0 <= min(xp, xq) and max(xp, xq) <= x1 and y0 <= min(yp, yq) and max(yp, yq) <= y1
        assert int(grad.answer) == g
        xr = int(re.search(r"where x = (-?\d+)", at_x.stem).group(1))
        assert int(at_x.answer) == slope(co, xr) and xr != xp
        assert line_of(picked(eq)) == (g, yp - g * xp)
        assert all(line_of(o) != (g, yp - g * xp) for i, o in enumerate(eq.options) if i != int(eq.answer))
        assert Fraction(normal.answer) == Fraction(-1, g)


def test_stationary_points():
    m = fam("stationary_points")
    for s in SEEDS:
        p, qs = run(m, s)
        co = p["coeffs"]
        turning = [x for x in range(-8, 9) if slope(co, x) == 0]
        assert [tuple(t) for t in p["points"]] == [(x, value(co, x)) for x in turning], p
        assert len(turning) == (2 if p["kind"] == "cubic" else 1)
        x0, x1, y0, y1 = m.view(p)
        assert all(x0 <= x <= x1 and y0 <= y <= y1 for x, y in p["points"])
        first = qs[0]
        if p["kind"] == "cubic":
            (xa, ya), (xb, yb) = p["points"]
            top = (xa, ya) if ya > yb else (xb, yb)
            assert point_of(picked(first)) == top
            assert "maximum" in first.stem
        else:
            assert point_of(picked(first)) == tuple(p["points"][0])
        neg = qs[1]
        lead = co[0]
        if p["kind"] == "cubic":
            (xa, _), (xb, _) = p["points"]
            assert picked(neg) == (f"{xa} < x < {xb}" if lead > 0 else f"x < {xa} or x > {xb}")
        else:
            h = p["points"][0][0]
            assert picked(neg) == (f"x < {h}" if lead > 0 else f"x > {h}")
        count = qs[2]
        k = int(re.search(r"= (-?\d+) has", count.stem).group(1))
        assert y0 <= k <= y1 and all(k != y for _, y in p["points"])
        roots = [r for r in np.roots([*co[:-1], co[-1] - k]) if abs(r.imag) < 1e-9]
        assert int(count.answer) == len({round(r.real, 6) for r in roots}), (p, k)
        if p["band"] == "AL" and p["kind"] == "cubic":
            second = qs[3]
            (xa, ya), (xb, yb) = p["points"]
            assert picked(second) == ("A" if ya < yb else "B")


def test_area_under_curve():
    m = fam("area_under_curve")
    for s in SEEDS:
        p, (area, which, part) = run(m, s)
        co, a, b = p["coeffs"], p["a"], p["b"]
        anti = [Fraction(c, len(co) - i) for i, c in enumerate(co)] + [0]
        F = lambda x: value(anti, Fraction(x))  # noqa: E731
        assert all(value(co, a + (b - a) * k / 200) > 0 for k in range(201)), p  # under the curve, above the axis
        assert int(area.answer) == F(b) - F(a) and F(b) - F(a) == int(F(b) - F(a))
        x0, x1, y0, y1 = m.view(p)
        assert x0 <= a < b <= x1 and max(value(co, a + (b - a) * k / 200) for k in range(201)) <= y1
        assert picked(which) == f"∫ from {a} to {b} of ({p['equation']}) dx"
        lo, hi = (int(v) for v in re.search(r"from (-?\d+) to (-?\d+)", part.stem).groups())
        assert hi == lo + 1 and int(part.answer) == F(hi) - F(lo)


def test_limit_graph():
    m = fam("limit_graph")
    for s in SEEDS:
        p, (val, left, right, exists, cont) = run(m, s)
        a, L, R, V, case = p["a"], p["L"], p["R"], p["V"], p["case"]
        assert {"jump": L != R and V in (L, R), "hole": L == R and V != L, "continuous": L == R == V}[case], p
        assert int(val.answer) == V and int(left.answer) == L and int(right.answer) == R
        assert picked(exists) == ("No: the limits from the left and the right are different" if case == "jump" else f"Yes: it is {L}")
        assert picked(cont) == {"jump": f"No: the limit as x tends to {a} does not exist",
                                "hole": f"No: the limit is not equal to f({a})", "continuous": "Yes"}[case]
        x0, x1, y0, y1 = m.view(p)
        ends = [L + p["m1"] * (p["x0"] - a), R + p["m2"] * (p["x1"] - a)]
        assert all(y0 <= y <= y1 for y in ends + [L, R, V]) and x0 <= p["x0"] < a < p["x1"] <= x1


# --- Task 3: function graphs ------------------------------------------------------------------

def test_exp_graph():
    m = fam("exp_graph")
    for s in SEEDS:
        p, qs = run(m, s)
        if p["kind"] == "pure":
            k = p["base"]
            assert int(qs[0].answer) == 1  # the y-intercept
            xq = int(re.search(r"x = (-?\d+)\?", qs[1].stem).group(1))
            assert xq >= 0 and int(qs[1].answer) == k ** xq and k ** xq <= m.view(p)[3]  # on a gridline, in view
            assert picked(qs[2]) == f"y = {k}^x"
            assert picked(qs[3]) == "y = 0"
            continue
        N0, T, grow = p["start"], p["period"], p["kind"] == "growth"
        at = lambda t: N0 * (2 if grow else Fraction(1, 2)) ** Fraction(t, T)  # noqa: E731
        start, period, later, eq = qs
        assert int(start.answer) == N0
        assert int(period.answer) == T
        t = int(re.search(r"after (\d+) ", later.stem).group(1))
        assert t % T == 0 and Fraction(later.answer) == at(t) and at(t) % p["ystep"] == 0  # read on a gridline
        assert t <= p["tmax"]
        assert picked(eq) == f"{p['symbol']} = {N0} × {'2' if grow else '(1/2)'}^(t/{T})"


def test_trig_graph():
    import math
    m = fam("trig_graph")
    for s in SEEDS:
        p, (amp, period, top, eq, count, reading) = run(m, s)
        a, b, c, fn = p["a"], p["b"], p["c"], p["fn"]
        f = lambda x: a * (math.sin if fn == "sin" else math.cos)(math.radians(b * x)) + c  # noqa: E731
        assert int(amp.answer) == a and int(period.answer) == 360 // b and int(top.answer) == a + c
        assert picked(eq) == m.equation(a, b, c, fn)
        k = float(re.search(r"line y = (-?[\d.]+) ", count.stem).group(1))
        assert c - a < k < c + a and not (fn == "sin" and k == c)
        # Samples between the special angles, so no root falls on one and is counted twice.
        sols = sum(1 for x in range(0, 360 * 8) if (f((x + 0.37) / 8) - k) * (f((x + 1.37) / 8) - k) < 0)
        assert int(count.answer) == sols, (p, k, sols)
        xq = int(re.search(r"x = (\d+)\?", reading.stem).group(1))
        assert (b * xq) % 90 == 0 and int(reading.answer) == round(f(xq)) and abs(f(xq) - round(f(xq))) < 1e-9


def test_rational_graph():
    m = fam("rational_graph")
    for s in SEEDS:
        p, (vert, horiz, cross, eq, toward, reading) = run(m, s)
        k, h, q = p["k"], p["p"], p["q"]
        f = lambda x: Fraction(k, x - h) + q  # noqa: E731
        assert h != 0 and k % h == 0
        assert vert.answer == f"x = {h}" and str(h) in vert.accepted
        assert horiz.answer == f"y = {q}" and str(q) in horiz.accepted
        assert Fraction(cross.answer) == f(0) and f(0).denominator == 1
        assert picked(eq) == m.equation(k, h, q)
        assert picked(toward) == ("increases without limit" if k > 0 else "decreases without limit")
        xq = int(re.search(r"when x = (-?\d+)\?", reading.stem).group(1))
        assert xq != h and f(xq).denominator == 1 and int(reading.answer) == f(xq)
        x0, x1, y0, y1 = m.view(p)
        assert x0 <= xq <= x1 and y0 <= f(xq) <= y1 and y0 <= f(0) <= y1


# --- Task 4: complex numbers, matrices and 3D ---------------------------------------------------

def cx(text):
    """"3 - 2i" -> (3, -2); "i" -> (0, 1); "-4" -> (-4, 0)."""
    t = text.replace(" ", "")
    both = re.fullmatch(r"(-?\d+)([+-])(\d*)i", t)
    if both:
        im = int(both.group(3) or 1)
        return int(both.group(1)), -im if both.group(2) == "-" else im
    pure = re.fullmatch(r"(-?)(\d*)i", t)
    if pure:
        im = int(pure.group(2) or 1)
        return 0, -im if pure.group(1) else im
    return int(t), 0


def test_argand():
    import math
    m = fam("argand")
    for s in SEEDS:
        p, (which, number, modulus, last) = run(m, s)
        pts = {k: tuple(v) for k, v in p["points"].items()}
        assert len(set(pts.values())) == 3 and (0, 0) not in pts.values()
        target = cx(re.search(r"represents (.+)\?$", which.stem).group(1))
        assert pts[picked(which)] == target
        assert cx(picked(number)) == pts["A"]
        xc, yc = pts["C"]
        r = math.hypot(xc, yc)
        if r == int(r):
            assert int(modulus.answer) == int(r)
        else:
            assert modulus.answer == f"{r:.1f}" and f"√{xc * xc + yc * yc}" in modulus.accepted
        if "conjugate" in last.stem:
            xa, ya = pts["A"]
            assert ya != 0 and pts[picked(last)] == (xa, -ya)
        else:
            assert cx(last.answer) == (pts["A"][0] + pts["C"][0], pts["A"][1] + pts["C"][1])
        x0, x1, y0, y1 = m.view(p)
        assert all(x0 <= x <= x1 and y0 <= y <= y1 for x, y in pts.values())


def rows_of(text):
    a, b, c, d = (int(v) for v in re.findall(r"-?\d+", text))
    return a, b, c, d


def test_matrix_transform():
    m = fam("matrix_transform")
    for s in SEEDS:
        p, qs = run(m, s)
        a, b, c, d = p["M"]
        square = [(0, 0), (1, 0), (1, 1), (0, 1)]
        image = lambda M: {(M[0] * x + M[1] * y, M[2] * x + M[3] * y) for x, y in square}  # noqa: E731
        assert b != c and a * d - b * c != 0
        which, corner, area = qs[:3]
        assert rows_of(picked(which)) == (a, b, c, d)
        for i, o in enumerate(which.options):
            if i != int(which.answer):
                assert image(rows_of(o)) != image((a, b, c, d)), (p, o)  # no other option draws the same image
        x, y = point_of(re.search(r"the point (\(.+?\))", corner.stem).group(1))
        assert point_of(corner.answer) == (a * x + b * y, c * x + d * y)
        assert int(area.answer) == abs(a * d - b * c)
        if len(qs) > 3:
            assert int(qs[3].answer) == a * d - b * c
        x0, x1, y0, y1 = m.view(p)
        assert all(x0 <= x <= x1 and y0 <= y <= y1 for x, y in image((a, b, c, d)) | set(square))


def test_points_3d():
    import math
    m = fam("points_3d")
    for s in SEEDS:
        p, (coords, length, middle, vertex) = run(m, s)
        P, Q, R = p["size"]
        corners = m.corners(P, Q, R)
        assert corners["F"] == (P, Q, R) and corners["E"] == (P, 0, R) and corners["O"] == (0, 0, 0)
        assert point_of(coords.answer) == corners[re.search(r"coordinates of ([A-G])\?", coords.stem).group(1)]
        d = math.sqrt(P * P + Q * Q + R * R)
        if d == int(d):
            assert int(length.answer) == int(d)
        else:
            assert length.answer == f"{d:.1f}" and f"√{P * P + Q * Q + R * R}" in length.accepted
        assert tuple(Fraction(v) for v in re.findall(r"-?[\d.]+", middle.answer)) == (Fraction(P, 2), Fraction(Q, 2), Fraction(R, 2))
        target = point_of(re.search(r"coordinates (\(.+?\))", vertex.stem).group(1))
        assert corners[picked(vertex)] == target


# --- Task 5: A Level statistics and motion ----------------------------------------------------

def dec(text):
    return Fraction(text) if "/" in text else Fraction(text)


def test_prob_distribution():
    m = fam("prob_distribution")
    for s in SEEDS:
        p, (missing, tail, mean, mode) = run(m, s)
        xs, ps, k = p["xs"], [Fraction(v, 20) for v in p["twentieths"]], p["missing"]
        assert sum(ps) == 1 and all(v >= Fraction(1, 20) for v in ps)
        P = dict(zip(xs, ps))
        assert Fraction(1, 20) <= P[k] <= Fraction(1, 2)
        assert dec(missing.answer) == P[k] and f"P(X = {k})" in missing.stem
        sign, t = re.search(r"P\(X ([≥≤]) (\d+)\)", tail.stem).groups()
        want = sum(v for x, v in P.items() if (x >= int(t) if sign == "≥" else x <= int(t)))
        assert dec(tail.answer) == want
        assert dec(mean.answer) == sum(x * v for x, v in P.items())
        top = max(ps)
        assert ps.count(top) == 1 and int(mode.answer) == xs[ps.index(top)]


def test_pdf_graph():
    m = fam("pdf_graph")
    for s in SEEDS:
        p, qs = run(m, s)
        kind, lo, hi = p["kind"], p["lo"], p["hi"]
        w = hi - lo
        # The area under f by integration, from lo to c, of the straight-line shape drawn.
        f = {"uniform": lambda x: Fraction(1, w), "ramp": lambda x: Fraction(2, w) * (x - lo) / w,
             "fall": lambda x: Fraction(2, w) * (hi - x) / w,
             "tent": lambda x: Fraction(2, w) * (1 - abs(2 * x - lo - hi) / Fraction(w))}[kind]
        mid = Fraction(lo + hi, 2)

        def integral(g, a, b):
            """Simpson's rule on each straight piece of f (split at the tent's peak): exact up to cubics."""
            cuts = [a] + ([mid] if a < mid < b else []) + [b]
            return sum((v - u) / 6 * (g(u) + 4 * g((u + v) / 2) + g(v)) for u, v in zip(cuts, cuts[1:]))
        F = lambda c: integral(f, Fraction(lo), Fraction(c))  # noqa: E731
        k = max(f(Fraction(lo)), f(Fraction(hi)), f(mid))
        E = integral(lambda x: x * f(x), Fraction(lo), Fraction(hi))
        assert integral(f, Fraction(lo), Fraction(hi)) == 1  # the area is 1
        height, below, mean = qs[:3]
        assert dec(height.answer) == k
        c = int(re.search(r"P\(X < (\d+)\)", below.stem).group(1))
        assert dec(below.answer) == F(c) and 0 < F(c) < 1
        assert dec(mean.answer) == E
        if kind == "uniform":
            assert dec(qs[3].answer) == mid  # the median of a uniform distribution


def test_velocity_time():
    m = fam("velocity_time")
    for s in SEEDS:
        p, (first, last, distance, top) = run(m, s)
        pts = [tuple(c) for c in p["corners"]]
        assert pts[0] == (0, 0) and pts[-1][1] == 0 and all(t1 > t0 for (t0, _), (t1, _) in zip(pts, pts[1:]))
        assert all(t % p["tstep"] == 0 for t, _ in pts)  # every corner on a gridline
        (t0, v0), (t1, v1) = pts[0], pts[1]
        assert dec(first.answer) == Fraction(v1 - v0, t1 - t0) and f"first {t1} seconds" in first.stem
        (ta, va), (tb, vb) = pts[-2], pts[-1]
        assert dec(last.answer) == Fraction(va - vb, tb - ta)
        area = sum(Fraction((v0 + v1) * (t1 - t0), 2) for (t0, v0), (t1, v1) in zip(pts, pts[1:]))
        assert area.denominator == 1 and int(distance.answer) == area
        assert int(top.answer) == max(v for _, v in pts)
        for (t0, v0), (t1, v1) in zip(pts, pts[1:]):
            assert (Fraction(v1 - v0, t1 - t0) * 2).denominator == 1  # whole or half m/s²


# --- Task 6: money ----------------------------------------------------------------------------

def francs(text):
    return int(text.replace(",", "").replace(" ", ""))


def test_money():
    from figgen.core import money as forms
    m = fam("money")
    for s in SEEDS:
        p, qs = run(m, s)
        lo, hi = m.stages(p)
        limit = {1: 1000, 3: 5000, 5: 50000}[lo]
        for q in qs:
            if q.kind == "short" and not q.stem.startswith("How many"):
                assert set(forms(int(q.answer))) <= set(q.accepted), q.accepted  # every fair form of an amount
        if p["kind"] == "board":
            price = {it["one"]: it["price"] for it in p["items"]} | {it["many"]: it["price"] for it in p["items"]}
            total, change, dearest, more = qs
            n1, i1, n2, i2 = re.search(r"How much do (\d+) (.+?) and (\d+) (.+?) cost altogether\?", total.stem).groups()
            assert francs(total.answer) == int(n1) * price[i1] + int(n2) * price[i2] <= limit
            item, paid = re.search(r"for one (.+?) with ([\d,]+) Frw", change.stem).groups()
            assert francs(change.answer) == francs(paid) - price[item] > 0
            top = max(it["price"] for it in p["items"])
            assert [it["price"] for it in p["items"]].count(top) == 1 and price[picked(dearest)] == top
            a, b = re.search(r"does one (.+?) cost than one (.+?)\?", more.stem).groups()
            assert francs(more.answer) == price[a] - price[b] > 0
        else:
            pieces = p["pieces"]
            total, spend, how_many = qs
            assert francs(total.answer) == sum(pieces) <= limit
            cost = francs(re.search(r"costing ([\d,]+) Frw", spend.stem).group(1))
            assert francs(spend.answer) == abs(cost - sum(pieces)) and cost != sum(pieces)
            assert ("need" in spend.stem) == (cost > sum(pieces))
            v = francs(re.search(r"How many ([\d,]+) Frw", how_many.stem).group(1))
            assert int(how_many.answer) == pieces.count(v) >= 1
        assert all(it["price"] % {1: 10, 3: 50, 5: 500}[lo] == 0 for it in p.get("items", []))


def test_price_tag():
    from fractions import Fraction as Fr
    m = fam("price_tag")
    for s in SEEDS:
        p, qs = run(m, s)
        kind = p["kind"]
        if kind == "sale":
            was, r = p["was"], p["rate"]
            now, saved, share = qs
            assert francs(now.answer) == was * (100 - r) // 100 and was * (100 - r) % 100 == 0
            assert francs(saved.answer) == was * r // 100
            assert int(share.answer) == 100 - r
        elif kind == "vat":
            sub = sum(p["prices"])
            subtotal, vat, total = qs
            assert francs(subtotal.answer) == sub and sub * 18 % 100 == 0
            assert francs(vat.answer) == sub * 18 // 100 and francs(total.answer) == sub * 118 // 100
        elif kind == "commission":
            sales, r = sum(p["sales"]), p["rate"]
            total_sales, commission = qs[:2]
            assert francs(total_sales.answer) == sales and francs(commission.answer) == sales * r // 100 and sales * r % 100 == 0
            if len(qs) > 2:
                wage = francs(re.search(r"wage of ([\d,]+) Frw", qs[2].stem).group(1))
                assert francs(qs[2].answer) == wage + sales * r // 100
        else:
            r = p["rate"]
            P = francs(re.search(r"saves ([\d,]+) Frw", qs[0].stem).group(1))
            n = int(re.search(r"for (\d+) years", qs[0].stem).group(1))
            if p["compound"]:
                amount = Fr(P) * (1 + Fr(r, 100)) ** n
                key = int(amount + Fr(1, 2))  # to the nearest franc, a half rounded up
                assert francs(qs[0].answer) == key and "nearest franc" in qs[0].stem
                assert francs(qs[1].answer) == key - P
            else:
                assert francs(qs[0].answer) == P * r * n // 100 and P * r * n % 100 == 0
                assert francs(qs[1].answer) == P + P * r * n // 100


# --- Task 7: Primary number and proportion; algebra; Pascal ----------------------------------

def test_bar_model():
    m = fam("bar_model")
    for s in SEEDS:
        p, (missing, sentence) = run(m, s)
        kind, nums, hole = p["kind"], p["numbers"], p["hole"]
        lo, _ = m.stages(p)
        top = {1: 20, 2: 100, 3: 1000, 5: 10000}[lo]
        if kind == "part_whole":
            whole, parts = nums[0], nums[1:]
            assert whole == sum(parts) <= top and all(v > 0 for v in parts)
        elif kind == "compare":
            big, small, diff = nums
            assert big - small == diff > 0 and big <= top
        else:
            whole, n, each = nums
            assert whole == n * each <= top and n >= 2
        assert int(missing.answer) == nums[hole]
        # The sentence picked works out to the missing number.
        expr = picked(sentence).replace("×", "*").replace("÷", "/").replace("−", "-").replace(",", "").split("=")[0]
        assert eval(expr) == nums[hole], (picked(sentence), nums, hole)  # noqa: S307
        wrong = [o for i, o in enumerate(sentence.options) if i != int(sentence.answer)]
        assert all(eval(o.replace("×", "*").replace("÷", "/").replace("−", "-").replace(",", "").split("=")[0]) != nums[hole]  # noqa: S307
                   for o in wrong)


def test_scale_drawing():
    m = fam("scale_drawing")
    for s in SEEDS:
        p, qs = run(m, s)
        w, h, sc = p["w"], p["h"], p["scale"]
        assert w != h and 2 <= min(w, h)
        length, width = qs[:2]
        assert int(length.answer) == max(w, h) * sc and int(width.answer) == min(w, h) * sc
        rest = qs[2:]
        if p["band"] == "LS":
            assert int(rest[0].answer) == w * h * sc * sc
            rest = rest[1:]
        real = int(re.search(r"(\d+) m long in real life", rest[0].stem).group(1))
        assert real % sc == 0 and int(rest[0].answer) == real // sc


def test_percent_grid():
    from math import gcd
    m = fam("percent_grid")
    for s in SEEDS:
        p, (pct, fraction, decimal, ratio, more) = run(m, s)
        n = p["shaded"]
        assert 5 <= n <= 95 and len(p["cells"]) == n == len(set(map(tuple, p["cells"])))
        assert int(pct.answer) == n
        assert Fraction(fraction.answer) == Fraction(n, 100) and fraction.answer == f"{Fraction(n, 100).numerator}/{Fraction(n, 100).denominator}"
        assert Fraction(decimal.answer) == Fraction(100 - n, 100)
        g = gcd(n, 100 - n)
        assert ratio.answer == f"{n // g}:{(100 - n) // g}"
        t = int(re.search(r"make (\d+)%", more.stem).group(1))
        assert t > n and int(more.answer) == t - n


def expand(text):
    """("x² + 5x + 6") -> {2: 1, 1: 5, 0: 6}."""
    out = {}
    for sign, coef, power in re.findall(r"([+-]?)\s*(\d*)(x²|x|)(?=\s*[+-]|$)", text.replace(" ", "")):
        if not (coef or power):
            continue
        k = {"x²": 2, "x": 1, "": 0}[power]
        out[k] = out.get(k, 0) + (int(coef) if coef else 1) * (-1 if sign == "-" else 1)
    return out


def test_algebra_area():
    m = fam("algebra_area")
    for s in SEEDS:
        p, qs = run(m, s)
        (a1, b1), (a2, b2) = p["sides"]  # each side a·x + b
        perim, area, value = qs[:3]
        assert expand(picked(perim)) == {k: v for k, v in {1: 2 * (a1 + a2), 0: 2 * (b1 + b2)}.items() if v}
        want = {2: a1 * a2, 1: a1 * b2 + a2 * b1, 0: b1 * b2}
        assert expand(picked(area)) == {k: v for k, v in want.items() if v}
        for i, o in enumerate(area.options):
            if i != int(area.answer):
                assert expand(o) != expand(picked(area))
        x = int(re.search(r"x = (\d+)", value.stem).group(1))
        assert int(value.answer) == (a1 * x + b1) * (a2 * x + b2) and a1 * x + b1 > 0 and a2 * x + b2 > 0
        if p["band"] == "UP":
            N = int(re.search(r"area is (\d+) cm²", qs[3].stem).group(1))
            root = int(qs[3].answer)
            assert (a1 * root + b1) * (a2 * root + b2) == N and root > 0


def test_pascal():
    from math import comb
    m = fam("pascal")
    for s in SEEDS:
        p, (gap, coef, total, row) = run(m, s)
        for label, (r, k) in p["holes"].items():
            assert 0 < k < r <= 7
        label = re.search(r"number at ([PQR])\?", gap.stem).group(1)
        r, k = p["holes"][label]
        assert int(gap.answer) == comb(r, k)
        k2, n = (int(v) for v in re.search(r"x\^?(\d)\D+\(1 \+ x\)\^?(\d)", coef.stem).groups())
        assert int(coef.answer) == comb(n, k2)
        n3 = int(re.search(r"row (\d)\?", total.stem).group(1))
        assert int(total.answer) == 2 ** n3
        n4 = int(re.search(r"\(a \+ b\)\^?(\d)", row.stem).group(1))
        assert picked(row) == f"row {n4}"
