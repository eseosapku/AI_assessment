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
