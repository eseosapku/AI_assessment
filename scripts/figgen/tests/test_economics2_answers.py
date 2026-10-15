"""Answers of the Economics families on markets and the firm (P3y Task C), recomputed from each figure's params over
1,000 seeds.

Nothing here calls a family's own helpers to work out a key: equilibria are solved from the lines' intercepts and
slopes, shortages and surpluses from the quantities at the controlled price, the tax and subsidy shares from the old
and new equilibria, the surpluses as triangles; schedules are summed and compared row by row; marginal products and
utilities are differenced from the totals; the utility-maximising bundle is found by trying every affordable bundle;
the budget lines' affordability by each bundle's cost; and the monopolist's output by solving MC = MR from the
curves' own formulas, its average cost by integrating MC. Every asked value is checked as shown: printed in a table,
or on a gridline that the drawn curve passes through.
"""
import random
import re
from collections import Counter, defaultdict
from fractions import Fraction

import matplotlib.pyplot as plt
import pytest

from figgen.core import NAMES
from figgen.families import FAMILIES

SEEDS = range(1, 1001)
DRAWN = 200  # the figure itself is built and read for the first 200 seeds
MICRO = ("market_diagram", "demand_schedule", "production_table", "utility_table", "budget_line", "monopoly_diagram")


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
    """Francs (or any whole number) as the figures print them: a space for thousands ("12 500")."""
    return f"{int(n):,}".replace(",", " ")


def unfr(s: str) -> int:
    return int(s.replace(" ", "").replace(",", ""))


def ordinal(n: int) -> str:
    return f"{n}{'th' if 10 <= n % 100 <= 20 else {1: 'st', 2: 'nd', 3: 'rd'}.get(n % 10, 'th')}"


def texts(fig) -> list[str]:
    return [t.get_text() for ax in fig.axes for t in ax.texts]


def gridlines(ax, axis: str) -> set[float]:
    a = ax.xaxis if axis == "x" else ax.yaxis
    return {round(float(v), 6) for v in list(a.get_majorticklocs()) + list(a.get_minorticklocs())}


def on_grid(ax, x, y):
    return round(float(x), 6) in gridlines(ax, "x") and round(float(y), 6) in gridlines(ax, "y")


def curve_at(ax, gid: str, x: float) -> float | None:
    """The height of the drawn curve named `gid` at x, by straight-line interpolation of what was drawn."""
    pts = sorted((float(a), float(b)) for ln in ax.lines if ln.get_gid() == gid for a, b in ln.get_xydata())
    assert pts, f"no curve {gid} drawn"
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        if x0 <= x <= x1 and x1 > x0:
            return y0 + (y1 - y0) * (x - x0) / (x1 - x0)
    return None


def passes(ax, gid, x, y, tol) -> bool:
    got = curve_at(ax, gid, float(x))
    return got is not None and abs(got - float(y)) <= tol


def first_names_the_person(qs):
    assert any(qs[0].stem.startswith(n) for n in NAMES), qs[0].stem


def money_key(q, n: int):
    assert q.answer == str(n), (q.stem, q.answer, n)
    assert str(n) in q.accepted and f"{n} Frw" in q.accepted
    if n >= 1000:
        assert fr(n) in q.accepted and f"{n:,}" in q.accepted


# --- shared --------------------------------------------------------------------------------------------

@pytest.mark.parametrize("fid", MICRO)
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
            assert not re.search(r"\b(that|this) (price|amount|output|answer)\b|the answer above|the same (person|firm)",
                                 q.stem), (fid, q.stem)


@pytest.mark.parametrize("fid", MICRO)
def test_most_figures_have_a_wording_of_their_own(fid):
    m = fam(fid)
    stems = []
    for seed in range(1, 31):
        rng = random.Random(seed)
        stems.append({q.stem for q in m.questions(m.sample(rng), rng)})
    own = sum(1 for i, s in enumerate(stems) if s - set().union(*(t for j, t in enumerate(stems) if j != i)))
    assert own >= 27, f"{fid}: only {own} of 30 figures have a wording of their own"


def _central(options):
    toks = [Counter(re.findall(r"-?\d+|[a-zA-Z]+|\S", o)) for o in options]
    score = [sum(sum(((t - u) + (u - t)).values()) for u in toks) for t in toks]
    best = min(score)
    return score.index(best) if score.count(best) == 1 else None


@pytest.mark.parametrize("fid", MICRO)
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


@pytest.mark.parametrize("fid", MICRO)
def test_params_are_json_and_figures_vary(fid):
    import json
    m = fam(fid)
    for s in range(1, 41):
        p = m.sample(random.Random(s))
        assert json.loads(json.dumps(p)) == p, (fid, s)


# --- market_diagram ------------------------------------------------------------------------------------

def _meet(a, c, b, d):
    """Where demand P = a - bQ meets supply P = c + dQ, in grid steps."""
    q = Fraction(a - c, b + d)
    return q, c + d * q


def _amount(option: str) -> int:
    return unfr(re.search(r"(\d[\d ]*\d|\d)", option).group(1))


def test_market_diagram():
    m = fam("market_diagram")
    kinds = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        first_names_the_person(qs)
        kind = p["kind"]
        kinds[kind] += 1
        assert p["band"] == ("UP" if kind in ("shift", "control") else "AL"), (s, kind)
        a, b, c, d, dq, dp, qx, py = (p[k] for k in ("a", "b", "c", "d", "dq", "dp", "qx", "py"))
        qe, pe = _meet(a, c, b, d)
        assert qe.denominator == 1 and pe.denominator == 1 and 1 <= qe < qx and 1 <= pe < py, (s, qe, pe)
        fig = m.draw(p) if s <= DRAWN else None
        ax = fig.axes[0] if fig else None
        asked = 0
        if kind == "shift":
            curves = {("D1", "S1"): (a, c), ("D1", "S2"): (a, p["c2"]), ("D2", "S1"): (p["a2"], c), ("D2", "S2"): (p["a2"], p["c2"])}
            meets = {k: _meet(ai, ci, b, d) for k, (ai, ci) in curves.items()}
            for k, (q, pr) in meets.items():
                assert q.denominator == 1 and pr.denominator == 1 and 1 <= q < qx and 1 <= pr < py, (s, k, q, pr)
            pts = {letter: tuple(v) for letter, v in p["points"].items()}
            assert sorted(pts) == list("ABCD") and set(pts.values()) == {(int(q), int(pr)) for q, pr in meets.values()}, (s, pts)
            for q in qs:
                dem = re.search(r"demand for .+? (increases|decreases) from D1 to D2", q.stem)
                sup = re.search(r"supply of .+? (increases|decreases) from S1 to S2", q.stem)
                assert dem or sup, (s, q.stem)
                if dem:
                    assert (dem.group(1) == "increases") == (p["a2"] > a), (s, q.stem)
                    assert "supply stays at S1" in q.stem or sup
                if sup:
                    assert (sup.group(1) == "increases") == (p["c2"] < c), (s, q.stem)  # more supplied at each price: lower
                    assert "demand stays at D1" in q.stem or dem
                new = meets[("D2" if dem else "D1", "S2" if sup else "S1")]
                if "Which point shows the new equilibrium" in q.stem:
                    asked += 1
                    letter = picked(q)[-1]
                    assert pts[letter] == (int(new[0]), int(new[1])), (s, q.stem, q.options)
                    assert sorted(o[-1] for o in q.options) == list("ABCD")
                elif "new equilibrium price" in q.stem:
                    asked += 1
                    money_key(q, int(new[1]) * dp)
                elif "new equilibrium quantity" in q.stem:
                    asked += 1
                    assert q.answer == str(int(new[0]) * dq), (s, q.answer)
                else:
                    pytest.fail(q.stem)
            if ax:
                for letter, (x, y) in pts.items():
                    assert on_grid(ax, x * dq, y * dp) and letter in texts(fig), (s, letter)
                for (dn, sn), (q, pr) in meets.items():
                    assert passes(ax, dn, q * dq, pr * dp, dp * 0.01) and passes(ax, sn, q * dq, pr * dp, dp * 0.01), (s, dn, sn)
            assert asked == len(qs) == 3, s
        elif kind == "control":
            pc, ctrl = p["pc"], p["ctrl"]
            qd, qs_ = Fraction(a - pc, b), Fraction(pc - c, d)
            assert qd.denominator == 1 and qs_.denominator == 1 and qd >= 1 and qs_ >= 1, (s, qd, qs_)
            assert (pc < pe and qd - qs_ >= 2) if ctrl == "max" else (pc > pe and qs_ - qd >= 2), (s, pc, pe)
            word = "maximum" if ctrl == "max" else "minimum"
            gap = int(abs(qd - qs_)) * dq
            for q in qs:
                assert f"{word} price" in q.stem and fr(pc * dp) in q.stem or "Without" in q.stem, (s, q.stem)
                if "bought and sold" in q.stem:
                    asked += 1
                    assert q.answer == str(int(min(qd, qs_)) * dq), (s, q.answer)
                elif q.kind == "mcq":
                    asked += 1
                    side = "shortage" if ctrl == "max" else "surplus"
                    assert picked(q).startswith(f"A {side} of ") and _amount(picked(q)) == gap, (s, q.options)
                    other = "surplus" if side == "shortage" else "shortage"
                    assert any(o.startswith(f"A {other} of ") and _amount(o) == gap for o in q.options), q.options
                    assert len({_amount(o) for o in q.options}) == 2 and len(q.options) == 4
                elif "Without" in q.stem:
                    asked += 1
                    money_key(q, int(pe) * dp)
                else:
                    pytest.fail(q.stem)
            if ax:
                assert on_grid(ax, int(qd) * dq, pc * dp) and on_grid(ax, int(qs_) * dq, pc * dp) and on_grid(ax, qe * dq, pe * dp)
                assert passes(ax, "D1", qd * dq, pc * dp, dp * 0.01) and passes(ax, "S1", qs_ * dq, pc * dp, dp * 0.01)
                assert passes(ax, "price", dq, pc * dp, dp * 0.01)
                assert any(word.capitalize() in t for t in texts(fig)), s
            assert asked == len(qs) == 3, s
        elif kind in ("tax", "subsidy"):
            t = p["c2"] - c  # the shift of supply: up by a tax, down by a subsidy
            assert (t > 0) == (kind == "tax") and t != 0
            q1, p1 = _meet(a, p["c2"], b, d)
            assert q1.denominator == 1 and p1.denominator == 1 and 1 <= q1 < qx and 1 <= p1 < py
            received = p1 - t  # the price paid, less the tax (or plus the subsidy)
            assert 1 <= received < py
            per_unit = abs(t) * dp
            share = abs(p1 - pe)
            for q in qs:
                assert ("tax" if kind == "tax" else "subsidy") in q.stem, q.stem
                assert f"{fr(per_unit)} Frw" in q.stem, (s, q.stem)
                if "consumers pay" in q.stem:
                    asked += 1
                    money_key(q, int(p1) * dp)
                elif "producers" in q.stem and "receive" in q.stem:
                    asked += 1
                    money_key(q, int(received) * dp)
                elif "tax revenue" in q.stem and "consumers' share" not in q.stem or "cost the government" in q.stem:
                    asked += 1
                    money_key(q, per_unit * int(q1) * dq)
                elif "consumers' share" in q.stem:
                    asked += 1
                    money_key(q, int(share) * dp * int(q1) * dq)
                else:
                    pytest.fail(q.stem)
            if ax:
                assert on_grid(ax, q1 * dq, p1 * dp) and on_grid(ax, q1 * dq, received * dp) and on_grid(ax, qe * dq, pe * dp)
                assert passes(ax, "S2", q1 * dq, p1 * dp, dp * 0.01) and passes(ax, "D1", q1 * dq, p1 * dp, dp * 0.01)
                assert passes(ax, "S1", q1 * dq, received * dp, dp * 0.01)
            assert asked == len(qs) == 4, s
        else:
            assert kind == "surplus"
            assert 1 <= c < pe < a < py, (s, a, c)  # both triangles whole, on the grid
            cs = Fraction(int(qe) * dq * (a - int(pe)) * dp, 2)
            ps = Fraction(int(qe) * dq * (int(pe) - c) * dp, 2)
            assert cs.denominator == 1 and ps.denominator == 1 and cs != ps
            for q in qs:
                if "What is the consumer surplus" in q.stem:
                    asked += 1
                    assert "½" in q.stem
                    money_key(q, int(cs))
                elif "What is the producer surplus" in q.stem:
                    asked += 1
                    assert "½" in q.stem
                    money_key(q, int(ps))
                elif q.kind == "mcq":
                    asked += 1
                    bigger = "Consumer surplus" if cs > ps else "Producer surplus"
                    assert picked(q).startswith(bigger) and _amount(picked(q)) == abs(cs - ps), (s, q.options)
                    assert len(q.options) == 4
                else:
                    pytest.fail(q.stem)
            if ax:
                assert on_grid(ax, 0, a * dp) and on_grid(ax, 0, c * dp) and on_grid(ax, qe * dq, pe * dp)
                assert passes(ax, "D1", qe * dq, pe * dp, dp * 0.01) and passes(ax, "S1", qe * dq, pe * dp, dp * 0.01)
                assert abs(curve_at(ax, "D1", 0) - a * dp) < dp * 0.01 and abs(curve_at(ax, "S1", 0) - c * dp) < dp * 0.01
            assert asked == len(qs) == 3, s
        if fig:
            plt.close(fig)
    assert set(kinds) == {"shift", "control", "tax", "subsidy", "surplus"} and min(kinds.values()) > 100, kinds


# --- demand_schedule -----------------------------------------------------------------------------------

def _side(dem, sup):
    return "shortage" if dem > sup else "surplus"


def test_demand_schedule():
    m = fam("demand_schedule")
    kinds = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        first_names_the_person(qs)
        kinds[p["kind"]] += 1
        prices, supply = p["prices"], p["qs"]
        assert prices == sorted(prices) and len(set(prices)) == len(prices) >= 5
        if p["kind"] == "market":
            demand = p["qd"]
        else:
            demand = [x + y for x, y in zip(p["ha"], p["hb"])]
        # the law of demand and of supply, row by row; one price clears the market, and it is not an end row
        assert all(x > y for x, y in zip(demand, demand[1:])) and all(x < y for x, y in zip(supply, supply[1:])), (s, p)
        clear = [i for i in range(len(prices)) if demand[i] == supply[i]]
        assert len(clear) == 1 and 0 < clear[0] < len(prices) - 1, (s, demand, supply)
        eq = prices[clear[0]]
        if s <= DRAWN:
            fig = m.draw(p)
            words = texts(fig)
            ax = next(a for a in fig.axes if a.lines)
            cols = [demand if p["kind"] == "market" else p["ha"], supply] + ([p["hb"]] if p["kind"] == "households" else [])
            for col in cols:
                assert all(fr(v) in words for v in col), (s, col)
            assert all(fr(v) in words for v in prices)
            plotted = (("D", demand), ("S", supply)) if p["kind"] == "market" else (("DA", p["ha"]), ("DB", p["hb"]))
            for gid, col in plotted:
                for pr, v in zip(prices, col):
                    assert on_grid(ax, v, pr) and passes(ax, gid, v, pr, 0.01 * (prices[1] - prices[0])), (s, gid, v, pr)
            plt.close(fig)
        asked = 0
        for q in qs:
            at = re.search(r"price of ([\d ]+) Frw", q.stem)
            i = prices.index(unfr(at.group(1))) if at else None
            if "equilibrium price" in q.stem or "market demand equal the market supply" in q.stem:
                asked += 1
                money_key(q, eq)
            elif "excess demand" in q.stem:
                asked += 1
                assert i is not None and demand[i] > supply[i], (s, q.stem)
                assert q.answer == str(demand[i] - supply[i]), (s, q.answer)
            elif "What is the market demand" in q.stem:
                asked += 1
                assert q.answer == str(p["ha"][i] + p["hb"][i]) and i != clear[0], (s, q.answer)
            elif q.kind == "mcq":
                asked += 1
                assert i is not None and i != clear[0]
                gap = abs(demand[i] - supply[i])
                assert picked(q).startswith(f"A {_side(demand[i], supply[i])} of ") and _amount(picked(q)) == gap, (s, q.options)
                assert len(q.options) == 4 and len({_amount(o) for o in q.options}) == 2
            else:
                pytest.fail(q.stem)
        assert asked == len(qs) == 3, s
    assert set(kinds) == {"market", "households"}


# --- production_table ----------------------------------------------------------------------------------

def test_production_table():
    m = fam("production_table")
    bands = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        first_names_the_person(qs)
        bands[p["band"]] += 1
        tp = p["tp"]
        n = len(tp) - 1
        assert tp[0] == 0 and 6 <= n <= 8
        mp = [None] + [tp[k] - tp[k - 1] for k in range(1, n + 1)]
        assert all(tp[k] % k == 0 for k in range(1, n + 1)), (s, tp)  # every average product is whole
        ap = [None] + [tp[k] // k for k in range(1, n + 1)]
        top = max(range(1, n + 1), key=lambda k: mp[k])
        assert all(mp[k] < mp[k + 1] for k in range(1, top)) and all(mp[k] > mp[k + 1] for k in range(top, n)), (s, mp)
        assert 2 <= top <= n - 2, (s, mp)
        blanks = {(c, k) for c, k in p["blanks"]}
        if s <= DRAWN:
            fig = m.draw(p)
            words = texts(fig)
            plt.close(fig)
            assert words.count("?") == len(blanks), (s, words)
            for k in range(1, n + 1):
                for col, v in (("tp", tp[k]), ("ap", ap[k]), ("mp", mp[k])):
                    if (col, k) not in blanks:
                        assert fr(v).replace("-", "−") in words or fr(v) in words, (s, col, k, v)
        asked = 0
        for q in qs:
            got = re.search(r"missing (total|average) product for (\d+) workers", q.stem)
            got_mp = re.search(r"missing marginal product of the (\d+)(?:st|nd|rd|th) worker", q.stem)
            if got:
                asked += 1
                col, k = {"total": "tp", "average": "ap"}[got.group(1)], int(got.group(2))
                assert (col, k) in blanks
                assert int(q.answer) == (tp[k] if col == "tp" else ap[k]), (s, q.stem, q.answer)
            elif got_mp:
                asked += 1
                k = int(got_mp.group(1))
                assert ("mp", k) in blanks and int(q.answer.replace("−", "-")) == mp[k], (s, q.answer)
            elif "diminishing marginal returns" in q.stem:
                asked += 1
                assert picked(q) == f"After the {ordinal(top)} worker", (s, q.options, mp)
                assert len(q.options) == 4
            elif "average product greatest" in q.stem:
                asked += 1
                best = max(ap[1:])
                assert ap.count(best) == 1 and int(q.answer) == ap.index(best), (s, ap, q.answer)
                assert p["band"] == "AL"
            else:
                pytest.fail(q.stem)
            if "AP = TP ÷" not in q.stem and q.kind == "short" and "average" in q.stem:
                pytest.fail(f"no formula: {q.stem}")
        assert asked == len(qs) == (4 if p["band"] == "AL" else 3), (s, [q.stem for q in qs])
    assert set(bands) == {"UP", "AL"}


# --- utility_table -------------------------------------------------------------------------------------

def test_utility_table():
    m = fam("utility_table")
    kinds = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        first_names_the_person(qs)
        kinds[(p["band"], p["kind"])] += 1
        asked = 0
        if p["kind"] == "tu":
            mu = p["mu"]
            n = len(mu)
            tu = [0]
            for v in mu:
                tu.append(tu[-1] + v)
            assert all(x > y for x, y in zip(mu, mu[1:])), (s, mu)  # diminishing marginal utility
            first = next(k for k in range(1, n + 1) if mu[k - 1] <= 0)  # the first unit whose MU is zero or below
            assert 3 <= first < n, (s, mu)
            blanks = {(c, k) for c, k in p["blanks"]}
            if s <= DRAWN:
                fig = m.draw(p)
                words = texts(fig)
                plt.close(fig)
                assert words.count("?") == len(blanks)
                for k in range(1, n + 1):
                    for col, v in (("tu", tu[k]), ("mu", mu[k - 1])):
                        if (col, k) not in blanks:
                            assert str(v).replace("-", "−") in words, (s, col, k, v, words)
            for q in qs:
                got_tu = re.search(r"missing total utility for (\d+) ", q.stem)
                got_mu = re.search(r"missing marginal utility of the (\d+)(?:st|nd|rd|th) ", q.stem)
                if got_tu:
                    asked += 1
                    k = int(got_tu.group(1))
                    assert ("tu", k) in blanks and int(q.answer) == tu[k], (s, q.answer)
                elif got_mu:
                    asked += 1
                    k = int(got_mu.group(1))
                    assert ("mu", k) in blanks and int(q.answer.replace("−", "-")) == mu[k - 1], (s, q.answer)
                elif "zero or below" in q.stem:
                    asked += 1
                    assert re.match(r"The (\d+)", picked(q)).group(1) == str(first), (s, q.options, mu)
                    assert len(q.options) == 4
                else:
                    pytest.fail(q.stem)
            assert asked == len(qs) == 3, s
        else:
            assert p["band"] == "AL" and p["kind"] == "choice"
            mux, muy, px, py, income = p["mux"], p["muy"], p["px"], p["py"], p["income"]
            assert all(x > y for x, y in zip(mux, mux[1:])) and all(x > y for x, y in zip(muy, muy[1:]))
            best, where = None, []
            for x in range(len(mux) + 1):
                for y in range(len(muy) + 1):
                    if x * px + y * py <= income:
                        u = sum(mux[:x]) + sum(muy[:y])
                        if best is None or u > best:
                            best, where = u, [(x, y)]
                        elif u == best:
                            where.append((x, y))
            assert len(where) == 1, (s, where)  # one best bundle, by trying them all
            x, y = where[0]
            assert x * px + y * py == income and x >= 1 and y >= 1
            assert Fraction(mux[x - 1], px) == Fraction(muy[y - 1], py), (s, x, y)  # the equi-marginal rule holds there
            if s <= DRAWN:
                fig = m.draw(p)
                words = texts(fig)
                plt.close(fig)
                assert all(str(v) in words for v in mux + muy)
                assert any(fr(px) in w for w in words) and any(fr(py) in w for w in words) and any(fr(income) in w for w in words)
            for q in qs:
                if q.kind == "mcq":
                    asked += 1
                    got = re.match(r"(\d+) .+ and (\d+) ", picked(q))
                    assert (int(got.group(1)), int(got.group(2))) == (x, y), (s, q.options, where)
                    assert "MU ÷ price" in q.stem or "per franc" in q.stem
                    # P3y review: every other option is affordable too, with less total utility, and none is a part of
                    # the key's bundle; so neither the budget nor "more of both" picks the key: only the table does
                    for o in q.options:
                        if o == picked(q):
                            continue
                        got = re.match(r"(\d+) .+ and (\d+) ", o)
                        i, j = int(got.group(1)), int(got.group(2))
                        assert i * px + j * py <= income, (s, o, "costs more than the income")
                        assert sum(mux[:i]) + sum(muy[:j]) < best, (s, o)
                        assert i > x or j > y, (s, o, "a part of the key's bundle")
                    # and two of them spend all the income too, as the key does: "spends it all" leaves three options
                    spent = [o for o in q.options if o != picked(q) and
                             sum(int(n) * c for n, c in zip(re.match(r"(\d+) .+ and (\d+) ", o).groups(), (px, py))) == income]
                    assert len(spent) >= 2, (s, q.options)
                elif "total utility" in q.stem:
                    asked += 1
                    assert int(q.answer) == best, (s, q.answer, best)
                else:
                    pytest.fail(q.stem)
            assert asked == len(qs) == 2, s
    assert set(kinds) == {("UP", "tu"), ("AL", "choice")}


# --- budget_line ---------------------------------------------------------------------------------------

def test_budget_line():
    m = fam("budget_line")
    changes = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        first_names_the_person(qs)
        changes[p["change"]] += 1
        inc, x0, y0, inc2, x1, y1 = (p[k] for k in ("income", "x0", "y0", "income2", "x1", "y1"))
        px, py = Fraction(inc, x0), Fraction(inc, y0)
        px2, py2 = Fraction(inc2, x1), Fraction(inc2, y1)
        assert px.denominator == py.denominator == px2.denominator == py2.denominator == 1, (s, p)
        what = p["change"]
        if what == "income":
            assert px2 == px and py2 == py and inc2 != inc
        elif what == "px":
            assert inc2 == inc and py2 == py and px2 != px
        else:
            assert inc2 == inc and px2 == px and py2 != py
        grows = inc2 * 1 > inc if what == "income" else (px2 < px if what == "px" else py2 < py)

        def cost(pt, xi, yi):  # a bundle's share of the income on a budget line: 1 is on it
            return Fraction(pt[0], xi) + Fraction(pt[1], yi)

        pts = {k: tuple(v) for k, v in p["points"].items()}
        assert sorted(pts) == list("ABCD")
        between = [k for k, pt in pts.items() if (cost(pt, x0, y0) > 1) != (cost(pt, x1, y1) > 1)]
        assert len(between) == 1, (s, pts)
        for k, pt in pts.items():  # plainly on one side of each line, never on it
            assert abs(cost(pt, x0, y0) - 1) >= Fraction(1, 10) and abs(cost(pt, x1, y1) - 1) >= Fraction(1, 10), (s, k)
        if s <= DRAWN:
            fig = m.draw(p)
            ax = fig.axes[0]
            words = texts(fig)
            for k, (x, y) in pts.items():
                assert on_grid(ax, x, y) and k in words
            for gid, xi, yi in (("BL1", x0, y0), ("BL2", x1, y1)):
                assert on_grid(ax, xi, 0) and on_grid(ax, 0, yi)
                assert passes(ax, gid, 0, yi, 0.01) and passes(ax, gid, xi, 0, 0.01), (s, gid)
            assert any(fr(inc) in w for w in words), (s, words)
            plt.close(fig)
        asked = 0
        for q in qs:
            got = re.search(r"(new )?price of one (.+?), in Frw", q.stem)
            if got:
                asked += 1
                good = got.group(2)
                is_x = good == p["x_sing"]
                assert is_x or good == p["y_sing"], (s, good)
                want = (px2 if is_x else py2) if got.group(1) else (px if is_x else py)
                money_key(q, int(want))
            elif "new income" in q.stem:
                asked += 1
                money_key(q, inc2)
            elif q.kind == "mcq":
                asked += 1
                assert ("on BL2 but not on BL1" in q.stem) == grows and ("on BL1 but not on BL2" in q.stem) == (not grows)
                assert picked(q) == f"Point {between[0]}", (s, q.options)
            elif "given up" in q.stem:
                asked += 1
                assert p["band"] == "AL"
                oc = Fraction(y0, x0)
                assert Fraction(q.answer) == oc and (oc * 100).denominator == 1, (s, q.answer)
            else:
                pytest.fail(q.stem)
        assert asked == len(qs) == (4 if p["band"] == "AL" else 3), (s, [q.stem for q in qs])
    assert set(changes) == {"income", "px", "py"}


# --- monopoly_diagram ----------------------------------------------------------------------------------

def test_monopoly_diagram():
    m = fam("monopoly_diagram")
    for s in SEEDS:
        p, qs = run(m, s)
        first_names_the_person(qs)
        assert p["band"] == "AL"
        a, b, mm, q0, dq, dp = (p[k] for k in ("a", "b", "m", "q0", "dq", "dp"))
        b = Fraction(b)  # stored as 0.5, 1.0, 1.5 or 2.0: exact in binary
        k = Fraction(*p["k"])
        fixed = Fraction(*p["fixed"])
        assert fixed > 0

        def mc(q):
            return mm + k * (q - q0) ** 2

        def mr(q):
            return a - 2 * b * q

        def ac(q):  # total cost = fixed cost + the area under MC, over output
            vc = mm * q + k * ((q - q0) ** 3 + q0 ** 3) / 3
            return (fixed + vc) / q

        star = [q for q in range(1, p["qx"]) if mc(q) == mr(q)]
        assert len(star) == 1, (s, star)
        qq = star[0]
        # MC crosses MR once, from below: below it before, above it after
        assert all(mc(Fraction(i, 10)) < mr(Fraction(i, 10)) for i in range(0, 10 * qq))
        assert all(mc(Fraction(i, 10)) > mr(Fraction(i, 10)) for i in range(10 * qq + 1, 10 * p["qx"]))
        price, cost = a - b * qq, ac(qq)
        assert cost.denominator == 1 and price - cost >= 2, (s, price, cost)
        profit = (price - cost) * qq * dq * dp
        mr0 = Fraction(a, 2 * b)
        mcar = [q for q in range(1, 2 * p["qx"]) if mc(q) == a - b * q]
        if s <= DRAWN:
            fig = m.draw(p)
            ax = fig.axes[0]
            X, tol = qq * dq, dp * 0.05
            assert on_grid(ax, X, price * dp) and on_grid(ax, X, cost * dp) and on_grid(ax, X, mr(qq) * dp)
            assert passes(ax, "AR", X, price * dp, tol) and passes(ax, "AC", X, cost * dp, tol)
            assert passes(ax, "MC", X, mc(qq) * dp, tol) and passes(ax, "MR", X, mr(qq) * dp, tol)
            assert {"AR = D", "MR", "MC", "AC"} <= set(texts(fig)), texts(fig)
            # P3y review: AC at the profit-maximising output is a whole gridline step, marked on the AC curve with a
            # dot and a dotted line across to the price axis, so the profit is read, not guessed
            assert (cost * dp) % dp == 0 and cost * dp in {round(v) for v in gridlines(ax, "y")}
            assert passes(ax, "AC", X, cost * dp, dp * 0.02)
            assert any(ln.get_gid() == "ac-guide" and list(ln.get_xdata()) == [0, X] and
                       all(abs(v - cost * dp) < 1e-6 for v in ln.get_ydata()) for ln in ax.lines), s
            assert any(ln.get_marker() == "o" and abs(ln.get_xdata()[0] - X) < 1e-6 and
                       abs(ln.get_ydata()[0] - cost * dp) < 1e-6 for ln in ax.lines), s
            plt.close(fig)
        asked = 0
        for q in qs:
            if q.kind == "mcq":
                asked += 1
                got = [unfr(re.match(r"([\d ]+) ", o).group(1)) for o in q.options]
                assert got[int(q.answer)] == qq * dq, (s, q.options)
                assert mr0 * dq in got and len(mcar) == 1 and mcar[0] * dq in got, (s, q.options, mr0, mcar)
                assert len(set(got)) == len(got) == 4
            elif "What price" in q.stem:
                asked += 1
                assert "MC = MR" in q.stem and "AR" in q.stem
                money_key(q, int(price) * dp)
            elif "supernormal profit" in q.stem:
                asked += 1
                assert "(price − average cost) × output" in q.stem and "MC = MR" in q.stem
                money_key(q, int(profit))
            else:
                pytest.fail(q.stem)
        assert asked == len(qs) == 3, s
