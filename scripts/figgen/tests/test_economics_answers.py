"""Answers of the Economics families (P3p), recomputed from each figure's params over 1,000 seeds.

Every key is worked out here again, by its own code: the opportunity cost read off the curve, the PED from the
original values, the average and marginal cost from the table, the weighted index and GDP by expenditure. Every
value a question needs is checked as shown: printed in the figure's table, or on a gridline of its graph.
"""
import random
import re
from fractions import Fraction

import matplotlib.pyplot as plt
import pytest

from figgen.core import NAMES
from figgen.families import FAMILIES

SEEDS = range(1, 1001)
DRAWN = 300  # the figure itself is built and read for the first 300 seeds (5,000 figures took three minutes)


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
    """Francs as the figures print them: a space for thousands ("12 500")."""
    return f"{int(n):,}".replace(",", " ")


def unfr(s: str) -> int:
    return int(s.replace(" ", "").replace(",", ""))


def texts(fig) -> list[str]:
    return [t.get_text() for ax in fig.axes for t in ax.texts]


def gridlines(ax, axis: str) -> set[float]:
    a = ax.xaxis if axis == "x" else ax.yaxis
    return {round(float(v), 6) for v in list(a.get_majorticklocs()) + list(a.get_minorticklocs())}


def first_names_the_person(qs):
    assert any(qs[0].stem.startswith(n) for n in NAMES), qs[0].stem


def own_wordings(m) -> int:
    """How many of 30 figures carry a stem no other of the 30 has (the shared wording test, P2a)."""
    stems = []
    for seed in range(1, 31):
        rng = random.Random(seed)
        stems.append({q.stem for q in m.questions(m.sample(rng), rng)})
    return sum(1 for i, s in enumerate(stems) if s - set().union(*(t for j, t in enumerate(stems) if j != i)))


@pytest.mark.parametrize("fid", ["ppc", "elasticity", "cost_revenue", "price_index", "national_income"])
def test_economics_family_is_worded_and_linked(fid):
    m = fam(fid)
    assert m.SUBJECT == "economics"
    assert m.CONCEPTS and all(c.startswith("economics.") for c in m.CONCEPTS)
    assert m.NEEDS
    assert own_wordings(m) >= 27, fid
    for seed in range(1, 60):
        p, qs = run(m, seed)
        first = next((n for n in NAMES if qs[0].stem.startswith(n)), None)
        assert first, (fid, seed, qs[0].stem)
        for q in qs:
            for owner in re.findall(r"\b(" + "|".join(NAMES) + r")'s\b", q.stem):
                assert owner == first, (fid, seed, q.stem)


# --- ppc ------------------------------------------------------------------------------------------

def test_ppc():
    m = fam("ppc")
    for s in SEEDS:
        p, qs = run(m, s)
        first_names_the_person(qs)
        n, c, sx = p["n"], p["c"], p["sx"]

        def curve(x):  # the curve drawn: y = c(n² - (x/sx)²)
            k = Fraction(x, sx)
            return c * (n * n - k * k)

        pts = p["points"]
        assert sorted(pts) == list("ABCDE")
        xs = [pts[k][0] for k in "ABCDE"]
        assert xs == sorted(xs) and len(set(xs)) == 5, (s, pts)  # lettered left to right, no two above each other
        status = {k: ("on" if y == curve(x) else "in" if y < curve(x) else "out") for k, (x, y) in pts.items()}
        assert sorted(status.values()) == ["in", "on", "on", "on", "out"], (s, status)
        inside = next(k for k, v in status.items() if v == "in")
        outside = next(k for k, v in status.items() if v == "out")
        top = p["top"]
        # plainly off the curve: at least an eighth of the height away from it, and inside the frame
        for k in (inside, outside):
            x, y = pts[k]
            assert abs(y - curve(x)) >= Fraction(c * n * n, 8), (s, k)
            assert 0 < y < top and 0 < x < n * sx, (s, k)
        if s <= DRAWN:
            fig = m.draw(p)
            ax = fig.axes[0]
            gx, gy = gridlines(ax, "x"), gridlines(ax, "y")
            words = texts(fig)
            plt.close(fig)
            for k, (x, y) in pts.items():
                assert round(float(x), 6) in gx and round(float(y), 6) in gy, (s, k, x, y)
                assert k in words, (s, k)
        asked = 0
        for q in qs:
            got = re.search(r"from point ([A-E]) to point ([A-E]), what is the opportunity cost of the extra (.+?), in (.+?) of (.+?)\?",
                            q.stem)
            if got:
                asked += 1
                a, b, extra, _, given = got.groups()
                assert status[a] == status[b] == "on", (s, q.stem)
                (xa, ya), (xb, yb) = pts[a], pts[b]
                if xb > xa:  # more of the good on the x-axis, paid for in the good on the y-axis
                    assert extra == p["x_good"] and given == p["y_good"], (s, q.stem)
                    assert int(q.answer) == ya - yb > 0, (s, q.stem, q.answer)
                else:
                    assert extra == p["y_good"] and given == p["x_good"], (s, q.stem)
                    assert int(q.answer) == xa - xb > 0, (s, q.stem, q.answer)
            if q.kind == "mcq":
                asked += 1
                want = outside if "not reach" in q.stem else inside
                assert "not reach" in q.stem or "unemployed" in q.stem, q.stem
                assert picked(q) == f"Point {want}", (s, q.stem, q.options)
                for o in q.options:
                    if o != picked(q):
                        assert status[o[-1]] != status[want], (s, o)
        assert asked == len(qs) == 3, s


# --- elasticity -----------------------------------------------------------------------------------

def ped(rows: dict, p1: int, p2: int) -> Fraction:
    """|PED| with each % change from the original value (never the midpoint)."""
    q1, q2 = rows[p1], rows[p2]
    return abs(Fraction(q2 - q1, q1) / Fraction(p2 - p1, p1))


def test_elasticity():
    m = fam("elasticity")
    shows = set()
    for s in SEEDS:
        p, qs = run(m, s)
        first_names_the_person(qs)
        shows.add(p["show"])
        rows = {pr: qd for pr, qd in p["rows"]}
        assert all(qd > 0 and pr > 0 for pr, qd in p["rows"])
        # the drawn line: quantity demanded falls by the same amount for each step in price
        line = lambda pr: p["dq"] * (p["n0"] - Fraction(p["m"] * pr, p["dp"]))  # noqa: E731
        assert all(line(pr) == qd for pr, qd in rows.items()), (s, p)
        if s <= DRAWN:
            fig = m.draw(p)
            words = texts(fig)
            if p["show"] == "table":
                for pr, qd in rows.items():
                    assert fr(pr) in words and fr(qd) in words, (s, pr, qd, words)
            else:
                ax = fig.axes[0]
                gx, gy = gridlines(ax, "x"), gridlines(ax, "y")
                for pr, qd in rows.items():
                    assert float(qd) in gx and float(pr) in gy, (s, pr, qd)
                assert {"A", "B", "D"} <= set(words), (s, words)
            plt.close(fig)
        asked = 0
        for q in qs:
            got = re.search(r"from ([\d ]+) Frw to ([\d ]+) Frw(?: \(point A to point B\))?, what is the PED", q.stem)
            if got:
                asked += 1
                assert "% change in quantity demanded ÷ % change in price" in q.stem and "original" in q.stem
                assert "midpoint" not in q.stem.lower() and "average" not in q.stem.lower()
                e = ped(rows, unfr(got.group(1)), unfr(got.group(2)))
                assert (e * 100).denominator == 1, (s, e)  # exact to two decimal places
                assert q.answer == f"{float(e):.2f}", (s, q.answer, e)
                assert not q.answer.startswith(("-", "−"))  # the key is the absolute value
            got = re.search(r"price change from ([\d ]+) Frw to ([\d ]+) Frw, is demand", q.stem)
            if got:
                asked += 1
                p1, p2 = unfr(got.group(1)), unfr(got.group(2))
                e = ped(rows, p1, p2)
                assert e != 1 and (e >= Fraction(5, 4) or e <= Fraction(4, 5)), (s, e)
                # the same either way round and by the midpoint too, so no method disputes the answer
                back = ped(rows, p2, p1)
                mid = abs(Fraction(rows[p2] - rows[p1], rows[p2] + rows[p1]) / Fraction(p2 - p1, p2 + p1))
                assert (e > 1) == (back > 1) == (mid > 1) and back != 1 and mid != 1, (s, e, back, mid)
                assert picked(q) == ("Price elastic" if e > 1 else "Price inelastic"), (s, q.options)
                assert ("Price inelastic" if e > 1 else "Price elastic") in q.options
            got = re.search(r"total revenue .*when the price is ([\d ]+) Frw per", q.stem)
            if got:
                asked += 1
                pr = unfr(got.group(1))
                assert int(q.answer) == pr * rows[pr], (s, q.stem, q.answer)
                assert fr(pr * rows[pr]) + " Frw" in q.accepted
        assert asked == len(qs) == 3, (s, [q.stem for q in qs])
    assert shows == {"table", "graph"}


# --- cost_revenue ---------------------------------------------------------------------------------

def test_cost_revenue():
    m = fam("cost_revenue")
    seen = set()
    for s in SEEDS:
        p, qs = run(m, s)
        first_names_the_person(qs)
        tc = p["tc"]
        n = len(tc) - 1
        mc = [None] + [tc[k] - tc[k - 1] for k in range(1, n + 1)]
        assert all(v > 0 for v in mc[1:])
        low = mc.index(min(mc[1:]))
        assert all(a > b for a, b in zip(mc[1:low], mc[2:low + 1])) and all(a < b for a, b in zip(mc[low:], mc[low + 1:])), (s, mc)
        mode = p.get("mode")
        seen.add((p["band"], mode))
        if s <= DRAWN:
            fig = m.draw(p)
            words = texts(fig)
            plt.close(fig)
            assert all(fr(v) in words for v in tc), (s, tc, words)
            if mode == "price":
                assert any(fr(p["price"]) in w and "Frw" in w for w in words), (s, words)
            if mode == "tr":
                assert all(fr(v) in words for v in p["tr"]), (s, p["tr"])
        asked = 0
        for q in qs:
            got = re.search(r"average cost when (\d+) .+? are made", q.stem)
            if got:
                asked += 1
                assert "total cost ÷ output" in q.stem
                k = int(got.group(1))
                assert k >= 2 and tc[k] % k == 0, (s, k)
                assert int(q.answer) == tc[k] // k, (s, q.answer)
            got = re.search(r"output rises from (\d+) to (\d+) ", q.stem)
            if got:
                asked += 1
                a, b = int(got.group(1)), int(got.group(2))
                assert b == a + 1
                assert int(q.answer) == tc[b] - tc[a], (s, q.answer)
            if "profit-maximising output" in q.stem:
                asked += 1
                assert p["band"] == "AL" and "MC = MR" in q.stem
                tr = [p["price"] * k for k in range(n + 1)] if mode == "price" else p["tr"]
                profit = [r - c for r, c in zip(tr, tc)]
                best = max(profit)
                assert profit.count(best) == 1, (s, profit)  # one output, no tie
                k = profit.index(best)
                mr = [None] + [tr[j] - tr[j - 1] for j in range(1, n + 1)]
                assert all(mr[j] > mc[j] for j in range(1, k + 1)) and all(mr[j] < mc[j] for j in range(k + 1, n + 1)), (s, mr, mc)
                assert 1 <= k < n and int(q.answer) == k, (s, q.answer, k)
        assert asked == len(qs) == (3 if p["band"] == "AL" else 2), (s, [q.stem for q in qs])
    assert seen == {("UP", None), ("AL", "price"), ("AL", "tr")}


# --- price_index ----------------------------------------------------------------------------------

def test_price_index():
    m = fam("price_index")
    for s in SEEDS:
        p, qs = run(m, s)
        first_names_the_person(qs)
        goods = p["goods"]  # [item, sold per, weight, base-year price, current price]
        assert 3 <= len(goods) <= 4 and sum(w for _, _, w, _, _ in goods) in (10, 100)
        rel = {g: Fraction(p1 * 100, p0) for g, _, w, p0, p1 in goods}
        assert all(r.denominator == 1 for r in rel.values()), (s, rel)
        index = sum(w * rel[g] for g, _, w, _, _ in goods) / sum(w for _, _, w, _, _ in goods)
        assert (index * 10).denominator == 1 and index > 100, (s, index)
        if s <= DRAWN:
            fig = m.draw(p)
            words = texts(fig)
            plt.close(fig)
            for g, per, w, p0, p1 in goods:
                assert f"{g.capitalize()} ({per})" in words, (s, g, words)
                assert str(w) in words and fr(p0) in words and fr(p1) in words, (s, g, words)
            assert any(str(p["base"]) in w for w in words) and any(str(p["year"]) in w for w in words)
        asked = 0
        for q in qs:
            got = re.search(r"price index for (.+?) in (\d{4})\?", q.stem)
            if got:
                asked += 1
                assert int(got.group(2)) == p["year"] and "× 100" in q.stem
                assert rel[got.group(1)] != 100
                assert int(q.answer) == rel[got.group(1)], (s, q.answer)
            if "weighted price index" in q.stem.lower() and "What is the weighted" in q.stem:
                asked += 1
                assert "weight × each good's price index" in q.stem
                assert q.answer == f"{float(index):.1f}", (s, q.answer, index)
            if "rate of inflation" in q.stem:
                asked += 1
                assert q.answer == f"{float(index - 100):.1f}%", (s, q.answer)
                assert f"{float(index - 100):.1f}" in q.accepted
        assert asked == len(qs) == 3, (s, [q.stem for q in qs])


# --- national_income ------------------------------------------------------------------------------

def test_national_income():
    m = fam("national_income")
    negative = 0
    for s in SEEDS:
        p, qs = run(m, s)
        first_names_the_person(qs)
        c, i, g, x, mm = (p[k] for k in "CIGXM")
        gdp = c + i + g + x - mm
        nx = x - mm
        negative += nx < 0
        if s <= DRAWN:
            fig = m.draw(p)
            words = texts(fig)
            plt.close(fig)
            assert all(fr(v) in words for v in (c, i, g, x, mm)), (s, words)
        asked = 0
        for q in qs:
            if "expenditure method" in q.stem:
                asked += 1
                assert "C + I + G + (X − M)" in q.stem
                assert int(q.answer) == gdp, (s, q.answer)
            if "net exports" in q.stem:
                asked += 1
                assert int(q.answer.replace("−", "-")) == nx, (s, q.answer)
                if nx < 0:
                    assert f"−{fr(-nx)}" in q.accepted or f"−{-nx}" in q.accepted
            got = re.search(r"population is ([\d.]+) million", q.stem)
            if got:
                asked += 1
                pop = Fraction(got.group(1))
                head = Fraction(gdp * 10 ** 9) / (pop * 10 ** 6)
                assert head.denominator == 1, (s, head)
                assert int(q.answer) == head, (s, q.answer, head)
                assert fr(head) + " Frw" in q.accepted
        assert asked == len(qs) == 3, (s, [q.stem for q in qs])
    assert 300 < negative < 1000  # net exports are often negative, but not always
