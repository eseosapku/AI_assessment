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
        assert "right-hand edge" in part.stem and int(part.answer) == value(co, b) and value(co, b) <= y1  # on the drawing


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
            k, a, up = p["base"], p["scale"], p["up"]
            assert int(qs[0].answer) == a  # the y-intercept
            xq = int(re.search(r"x = (-?\d+)\?", qs[1].stem).group(1))
            y = Fraction(a) * Fraction(k) ** (xq if up else -xq)
            assert y.denominator == 1 and int(qs[1].answer) == y and y <= m.view(p)[3]  # on a gridline, in view
            x0, x1, _, _ = m.view(p)
            assert x0 <= xq <= x1
            assert picked(qs[2]) == m.pure_equation(a, k, up)
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
        assert dec(first.answer) == Fraction(v1 - v0, t1 - t0) and (f"first {t1} seconds" in first.stem or (t1 == 1 and "first second" in first.stem))
        (ta, va), (tb, vb) = pts[-2], pts[-1]
        assert dec(last.answer) == Fraction(va - vb, tb - ta)
        area = sum(Fraction((v0 + v1) * (t1 - t0), 2) for (t0, v0), (t1, v1) in zip(pts, pts[1:]))
        assert area.denominator == 1 and int(distance.answer) == area
        assert int(top.answer) == max(v for _, v in pts)
        for (t0, v0), (t1, v1) in zip(pts, pts[1:]):
            assert (Fraction(v1 - v0, t1 - t0) * 2).denominator == 1 and abs(Fraction(v1 - v0, t1 - t0)) <= 2  # whole or half m/s², no more than 2


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
        top = {1: 100, 2: 1000, 3: 5000, 5: 50000}[lo] if p["money"] else {1: 20, 2: 100, 3: 1000, 5: 10000}[lo]
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


# --- Task 8: chapters a family shares a word with but does not suit (the link report) ----------

@pytest.mark.parametrize("fid, misfit, fit", [
    ("area_under_curve", "Hooke's law", "Unit 3: Integration"),
    ("area_under_curve", "Equilibrium of a rigid body", "Chapter 9: Integration"),
    ("algebra_area", "Glossary and Index", "Algebraic processes"),
    ("algebra_area", "Chapter 12: Simplifying ratios", "Unit 6: Quadratic equations and inequalities"),
    ("matrix_transform", "Bivariate Statistics", "Transformation of Matrices"),
    ("tangent_gradient", "Unit 6: Ratio, rate and proportion", "Unit 5: Curved graphs"),
    ("points_3d", "Circular motion", "Points, Straight Lines, Planes and Sphere in 3D"),
    ("rational_graph", "Hyperbolic functions", "Rational functions"),
    ("velocity_time", "Projectiles", "Unit 9: Differentiation of polynomials, rational and irrational functions"),
    ("price_tag", "Unit 2: Logarithmic and Exponential Functions", "Unit 4: Percentage, discount, profit and loss"),
    ("percent_grid", "Multiplication and division (2)", "Ratios, Proportions and Percentages"),
    ("scale_drawing", "Thales' Theorem", "Ratio and proportion"),
    # The final review: a tangent to a polynomial, not exponential or trigonometric chapters; a modulus
    # chapter suits cubic sketching, not sine graphs.
    ("tangent_gradient", "Unit 2: Logarithmic and Exponential Functions", "Calculus introduction (SS3)"),
    ("tangent_gradient", "Trigonometric Functions and their Inverses", "Unit 9: Differentiation of polynomials, rational and irrational functions"),
    ("trig_graph", "Chapter 5: Solving equations of the type |ax - b| = c", "Trigonometric Formulae, Equations and Inequalities"),
])
def test_a_family_keeps_out_of_chapters_it_does_not_suit(fid, misfit, fit):
    avoid = getattr(fam(fid), "AVOID", None)
    assert avoid and re.search(avoid, misfit, re.I), misfit
    assert not re.search(avoid, fit, re.I), fit



# --- The P3c final review ---------------------------------------------------------------------

NEW = ["tangent_gradient", "stationary_points", "area_under_curve", "limit_graph", "exp_graph", "trig_graph", "rational_graph", "argand",
       "matrix_transform", "points_3d", "prob_distribution", "pdf_graph", "velocity_time", "money", "price_tag", "bar_model",
       "scale_drawing", "percent_grid", "algebra_area", "pascal"]


def test_velocity_time_reads_every_corner_on_a_gridline():
    """A speed between two lines, or a corner a unit off a labelled line, is read wrong (final review)."""
    import matplotlib.pyplot as plt
    m = fam("velocity_time")
    for s in range(1, 301):
        p = m.sample(random.Random(s))
        fig = m.draw(p)
        ax = fig.axes[0]
        ys = {round(v, 6) for v in ax.get_yticks(minor=True)} | {round(v, 6) for v in ax.get_yticks()}
        major_x = [round(v, 6) for v in ax.get_xticks()]
        plt.close(fig)
        assert all(round(v, 6) in ys for _, v in p["corners"]), (s, p["corners"])
        assert all(x % p["tstep"] == 0 for x in major_x), (s, major_x, p["tstep"])


def test_a_half_acceleration_accepts_its_fraction():
    m = fam("velocity_time")
    for s in range(1, 301):
        _, (first, last, _, _) = run(m, s)
        for q in (first, last):
            if "." in q.answer:
                f = Fraction(q.answer)
                assert f"{f.numerator}/{f.denominator}" in q.accepted, q.accepted


def test_bar_model_options_use_only_the_numbers_shown():
    """Every wrong sentence printed the hidden number, so the key was the one without it (final review)."""
    m = fam("bar_model")
    for s in SEEDS:
        p, (_, sentence) = run(m, s)
        hidden = p["numbers"][p["hole"]]
        shown = {v for i, v in enumerate(p["numbers"]) if i != p["hole"]}
        for o in sentence.options:
            used = {int(v.replace(",", "")) for v in re.findall(r"\d[\d,]*", o)}
            assert hidden not in used or hidden in shown, (s, o, p["numbers"], p["hole"])


@pytest.mark.parametrize("fid", NEW)
def test_a_number_of_a_thousand_or_more_accepts_its_comma(fid):
    m = fam(fid)
    for s in range(1, 301):
        _, qs = run(m, s)
        for q in qs:
            if q.kind != "short":
                continue
            for a in list(q.accepted):
                mt = re.fullmatch(r"(-?\d{4,})(\D*)", a)
                if mt:
                    assert f"{int(mt.group(1)):,}{mt.group(2)}" in q.accepted, (fid, s, a, q.accepted)
                    assert f"{int(mt.group(1)):,}".replace(",", " ") + mt.group(2) in q.accepted, (fid, s, a, q.accepted)


@pytest.mark.parametrize("fid", NEW)
def test_a_decimal_accepts_its_fair_forms(fid):
    """".78" for 0.78, and three significant figures for a long decimal (0.234 for 0.234375)."""
    m = fam(fid)
    for s in range(1, 301):
        _, qs = run(m, s)
        for q in qs:
            if q.kind != "short":
                continue
            for a in list(q.accepted):
                if re.fullmatch(r"-?0\.\d+", a):
                    assert a.replace("0.", ".", 1) in q.accepted, (fid, s, a, q.accepted)
                if re.fullmatch(r"-?\d*\.\d{4,}", a):
                    assert f"{float(a):.3g}" in q.accepted, (fid, s, a, q.accepted)


def test_fair_forms_the_final_review_found_missing():
    from figgen.core import money as forms, short
    assert "Frw 1,500" in forms(1500) and "RWF 1500" in forms(1500)
    assert "15m/s" in short("s", 15, ["15 m/s"]).accepted
    for s in range(1, 301):
        _, qs = run(fam("rational_graph"), s)
        c = int(qs[2].answer)
        assert {f"y = {c}", f"(0,{c})"} <= set(qs[2].accepted)
        _, qs = run(fam("argand"), s)
        if "sum" in qs[3].stem and re.fullmatch(r"-?\d*i", qs[3].answer):
            assert any(a.startswith("0 +") or a.startswith("0 -") for a in qs[3].accepted), qs[3].accepted


def test_prices_fit_what_is_bought():
    """An egg at 400 Frw and a bicycle at 8,500 Frw are not prices a learner in Rwanda would believe."""
    money_m, tag = fam("money"), fam("price_tag")
    for s in SEEDS:
        p, qs = run(money_m, s)
        if p["kind"] == "purse":
            item, cost = re.search(r"one (.+?) costing ([\d,]+) Frw", qs[1].stem).groups()
            lv = money_m.LEVELS[tuple(p["years"])]
            lo, hi = next((a, b) for one, _, a, b in lv["items"] if one == item)
            assert lo <= francs(cost) <= hi, (s, item, cost)
        p, _ = run(tag, s)
        if p["kind"] == "sale":
            lo, hi = tag.GOODS[p["item"]]
            assert lo <= p["was"] <= hi, (s, p["item"], p["was"])


EQUATION_MCQS = ("Which equation", "Which is the equation", "maximum point", "turning point", "Which matrix", "Which integral")


def _central(options):
    """The option nearest all the others, word by word; None on a tie."""
    from collections import Counter
    toks = [Counter(re.findall(r"-?\d+|[a-zA-Z]+|\S", o)) for o in options]
    score = [sum(sum(((t - u) + (u - t)).values()) for u in toks) for t in toks]
    best = min(score)
    return score.index(best) if score.count(best) == 1 else None


@pytest.mark.parametrize("fid", ["trig_graph", "rational_graph", "exp_graph", "stationary_points", "tangent_gradient", "matrix_transform",
                                 "area_under_curve"])
def test_an_equation_mcq_cannot_be_picked_from_its_options_alone(fid):
    """Each wrong option changed one feature of the key, so the key was the option nearest all the others
    (final review): a student or a blind reviewer needs no figure."""
    m = fam(fid)
    seen = hits = 0
    for s in range(1, 301):
        _, qs = run(m, s)
        for q in qs:
            if q.kind == "mcq" and any(w in q.stem for w in EQUATION_MCQS):
                seen += 1
                hits += _central(q.options) == int(q.answer)
    assert seen and hits / seen <= 0.35, (fid, hits, seen)


def test_a_jump_offers_no_second_defensible_reason():
    m = fam("limit_graph")
    for s in SEEDS:
        p, qs = run(m, s)
        if p["case"] == "jump":
            assert not any("not equal to f(" in o for o in qs[4].options), qs[4].options


def test_the_plan_caption_never_covers_the_plan():
    import matplotlib.pyplot as plt
    from figgen.tests.test_families_layout import drawn_texts
    m = fam("scale_drawing")
    for s in range(1, 121):
        p = m.sample(random.Random(s))
        fig = m.draw(p)
        ax = fig.axes[0]
        top_px = ax.transData.transform((1, 1 + p["h"]))[1]
        for t, box in drawn_texts(fig):
            if "Plan of" in t.get_text():
                assert box.y0 >= top_px - 1, (s, p)
        plt.close(fig)


def test_more_figures_where_they_were_few():
    exp_m, sp = fam("exp_graph"), fam("stationary_points")
    pure = {repr({k: v for k, v in p.items() if k != "name"}) for s in range(1, 3001) if (p := exp_m.sample(random.Random(s)))["kind"] == "pure"}
    assert len(pure) >= 10, len(pure)
    cubics = {repr(p["coeffs"]) for s in range(1, 6001) if (p := sp.sample(random.Random(s)))["band"] == "AL"}
    assert len(cubics) >= 60, len(cubics)



def test_cubic_sketching_chapters_keep_stationary_points():
    avoid = fam("stationary_points").AVOID
    assert not re.search(avoid, "Chapter 5: Solving equations of the type |ax - b| = c", re.I)



# --- The P3d blind review's triage --------------------------------------------------------------

def _region(text):
    """"-1 < x < 2", "x < -1 or x > 2", "x < 3", "x > -2" as a test on x."""
    if m := re.fullmatch(r"(-?\d+) < x < (-?\d+)", text):
        lo, hi = map(int, m.groups())
        return lambda x: lo < x < hi
    if m := re.fullmatch(r"x < (-?\d+) or x > (-?\d+)", text):
        lo, hi = map(int, m.groups())
        return lambda x: x < lo or x > hi
    if m := re.fullmatch(r"x ([<>]) (-?\d+)", text):
        op, t = m.group(1), int(m.group(2))
        return (lambda x: x < t) if op == "<" else (lambda x: x > t)
    raise AssertionError(text)


def test_a_wrong_gradient_region_is_false_somewhere():
    """'x > 2' when the gradient is negative for x > -2 is also true (P3d review): every wrong option must
    name somewhere the gradient is not negative."""
    m = fam("stationary_points")
    for s in SEEDS:
        p, qs = run(m, s)
        co, neg = p["coeffs"], qs[1]
        xs = [i / 4 for i in range(-60, 61)]
        for i, o in enumerate(neg.options):
            inside = [x for x in xs if _region(o)(x)]
            if i == int(neg.answer):
                assert all(slope(co, x) < 0 for x in inside), (s, o)
            else:
                assert any(slope(co, x) >= 0 for x in inside), (s, o, neg.options)


def test_a_tangent_letter_sits_by_its_own_point():
    """Q's letter sat beside the curve, away from its dot (P3d review)."""
    import matplotlib.pyplot as plt
    m = fam("tangent_gradient")
    for s in range(1, 201):
        p = m.sample(random.Random(s))
        fig = m.draw(p)
        ax = fig.axes[0]
        labels = {t.get_text(): t.get_position() for t in ax.texts if t.get_text() in ("P", "Q")}
        plt.close(fig)
        co = p["coeffs"]
        curve_pts = [(x / 20, value(co, x / 20)) for x in range(-200, 201)]
        qx, qy = labels["Q"]
        dq = ((qx - p["Q"][0]) ** 2 + (qy - p["Q"][1]) ** 2) ** 0.5
        dc = min(((qx - x) ** 2 + (qy - y) ** 2) ** 0.5 for x, y in curve_pts)
        assert dq < dc, (s, p, labels["Q"])


def test_equal_parts_show_the_part_in_every_part():
    """One number in one of nine cells read as the whole or the part (P3d review)."""
    import matplotlib.pyplot as plt
    m = fam("bar_model")
    for s in SEEDS:
        p, (missing, _) = run(m, s)
        if p["kind"] != "equal":
            continue
        assert "shared equally" not in missing.stem
        if p["hole"] == 0:
            fig = m.draw(p)
            shown = [t.get_text() for t in fig.axes[0].texts]
            plt.close(fig)
            assert shown.count(f"{p['numbers'][2]:,}") == p["numbers"][1], (s, shown)


def test_a_coin_says_it_is_francs():
    import matplotlib.pyplot as plt
    m = fam("money")
    for s in range(1, 121):
        p = m.sample(random.Random(s))
        if p["kind"] != "purse":
            continue
        fig = m.draw(p)
        texts = [t.get_text() for t in fig.axes[0].texts][1:]
        plt.close(fig)
        assert all("Frw" in t for t in texts), (s, texts)


def test_the_shading_never_hides_the_axis_numbers():
    import matplotlib.pyplot as plt
    m = fam("area_under_curve")
    for s in range(1, 21):
        fig = m.draw(m.sample(random.Random(s)))
        ax = fig.axes[0]
        fills = [c for c in ax.collections]
        assert fills and all(c.get_zorder() < ax.yaxis.get_zorder() for c in fills), s
        plt.close(fig)



# --- The P3d review's notes on passing figures --------------------------------------------------

def test_a_gradient_is_asked_where_the_curve_is_drawn():
    """'The gradient of the curve drawn at x = 3' when the drawing stops at x = 2 (10 notes)."""
    m = fam("tangent_gradient")
    for s in SEEDS:
        p, (_, at_x, _, _) = run(m, s)
        xr = int(re.search(r"where x = (-?\d+)", at_x.stem).group(1))
        x0, x1, y0, y1 = m.view(p)
        assert "equation" in at_x.stem and x0 <= xr <= x1 and y0 <= value(p["coeffs"], xr) <= y1, (s, xr)


def test_a_hundred_square_is_called_squares():
    m = fam("percent_grid")
    for s in range(1, 301):
        _, qs = run(m, s)
        assert not re.search(r"seat|stamp|plot|tile", qs[0].stem), qs[0].stem


def test_a_reciprocal_curve_is_drawn_just_where_the_stem_says():
    import matplotlib.pyplot as plt
    m = fam("rational_graph")
    for s in range(1, 121):
        p, qs = run(m, s)
        lo, hi = (int(v) for v in re.search(r"drawn for (-?\d+) ≤ x ≤ (-?\d+)", qs[5].stem).groups())
        xq = int(re.search(r"when x = (-?\d+)\?", qs[5].stem).group(1))
        assert lo < xq < hi, (s, lo, xq, hi)
        fig = m.draw(p)
        for ln in fig.axes[0].lines:
            if ln.get_linestyle() == "-":
                assert all(lo - 1e-9 <= x <= hi + 1e-9 for x in ln.get_xdata()), (s, lo, hi)
        plt.close(fig)


def test_motion_stems_read_naturally():
    m = fam("velocity_time")
    for s in range(1, 301):
        _, qs = run(m, s)
        for q in qs:
            assert not re.search(r"\b(first|last) 1 seconds", q.stem), q.stem
        assert not re.search(r"'s (minibus|moto|bus|car|cyclist|train)\b", qs[0].stem), qs[0].stem


def test_a_count_runs_as_far_as_its_context_allows():
    """'The number of days in a week that it rains' could be 7, not just 0 to 4."""
    m = fam("prob_distribution")
    for s in range(1, 301):
        _, qs = run(m, s)
        assert "days in a week" not in qs[0].stem, qs[0].stem


def test_a_value_is_read_clear_of_the_plot_edge_and_q_is_on_the_tangent():
    """A reading on the plot's top or bottom edge could not be read reliably; Q's place on the tangent is
    said, since Q is not on the curve (P3d notes)."""
    m = fam("rational_graph")
    for s in SEEDS:
        p, qs = run(m, s)
        xq = int(re.search(r"when x = (-?\d+)\?", qs[5].stem).group(1))
        _, _, y0, y1 = m.view(p)
        y = Fraction(p["k"], xq - p["p"]) + p["q"]
        assert y0 + 1 <= y <= y1 - 1, (s, y, y0, y1)
    for s in range(1, 301):
        _, qs = run(fam("tangent_gradient"), s)
        assert "passes through Q" in qs[0].stem, qs[0].stem



def test_the_integral_options_cannot_be_told_apart_without_the_figure():
    """The other integrand was always the antiderivative, one degree higher: 'pick the lower degree' found
    the key every time (P3d final review). Each option now differs in the limits read off the shading or
    in the curve read off the title."""
    m = fam("area_under_curve")
    by_degree = seen = 0
    for s in SEEDS:
        p, (_, which, _) = run(m, s)
        degree = lambda o: next((d for d, mark in ((3, "x³"), (2, "x²"), (1, "x")) if mark in o.split(" of ")[1]), 0)  # noqa: E731
        # The giveaway: drop the options whose limits run backwards, then take the lowest degree.
        upward = [i for i, o in enumerate(which.options) if int(re.search(r"from (-?\d+)", o).group(1)) < int(re.search(r"to (-?\d+)", o).group(1))]
        lows = [i for i in upward if degree(which.options[i]) == min(degree(which.options[j]) for j in upward)]
        seen += 1
        by_degree += lows == [int(which.answer)]
        limits = {re.search(r"from (-?\d+) to (-?\d+)", o).groups() for o in which.options}
        assert len(limits) == 2 and (str(p["a"]), str(p["b"])) in limits, which.options
    assert by_degree / seen <= 0.05, by_degree



def test_money_bar_models_are_in_francs_and_only_they_reach_the_francs_chapters():
    """The Primary francs chapters drew bar models of cows (P3d): now a third of bar models are about
    money, in the steps a learner pays in, and only those link there."""
    from figgen.core import money as forms
    from figgen.link import topics_for
    m = fam("bar_model")
    francs = {"key": "t:frw", "band": "P", "subject": "mathematics", "name": "Rwandan Francs up to 1000 FRW", "stage": None,
              "concepts": frozenset(m.CONCEPTS)}
    plain = {"key": "t:add", "band": "P", "subject": "mathematics", "name": "Addition and subtraction", "stage": None,
             "concepts": frozenset(m.CONCEPTS)}
    seen = 0
    for s in SEEDS:
        p, (missing, _) = run(m, s)
        reached = topics_for([francs, plain], m, p)
        if p["money"]:
            seen += 1
            lo, _ = m.stages(p)
            step = {1: 10, 2: 50, 3: 100, 5: 500}[lo]
            amounts = [v for i, v in enumerate(p["numbers"]) if not (p["kind"] == "equal" and i == 1)]
            assert all(v % step == 0 for v in amounts), (s, p)
            assert "Frw" in missing.stem and set(forms(int(missing.answer))) <= set(missing.accepted)
            assert "t:frw" in reached
        else:
            assert "t:frw" not in reached and "t:add" in reached
    assert 250 <= seen <= 450, seen
