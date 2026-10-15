"""Answers of the macroeconomics and trade families (P3y, Task D), recomputed from each figure's params over 1,000 seeds.

Nothing here calls a family's own helpers to work out a key: the missing flow comes from the households' identity,
the new equilibria from the straight lines the params describe, the unemployment rate from its formula, the
multiplier from the MPC worked out from the table's differences, opportunity costs and the terms of trade from their
ratios, the current account from its parts, a converted price from its rate, and an income share from the
cumulative shares. Every value a question needs is checked as shown: printed in the figure, or on a gridline.
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
DRAWN = 150  # the figure itself is built and read for the first 150 seeds
MACRO = ("circular_flow", "ad_as", "labour_force", "multiplier", "trade_tables", "balance_of_payments", "exchange_rate",
         "lorenz_curve")


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
    """Francs and other whole numbers as the figures print them: a space for thousands ("12 500"), a true minus."""
    n = int(n)
    return ("−" if n < 0 else "") + f"{abs(n):,}".replace(",", " ")


def texts(fig) -> list[str]:
    return [t.get_text() for ax in fig.axes for t in ax.texts]


def gridlines(ax, axis: str) -> set[float]:
    a = ax.xaxis if axis == "x" else ax.yaxis
    return {round(float(v), 6) for v in list(a.get_majorticklocs()) + list(a.get_minorticklocs())}


def first_names_the_person(qs):
    assert any(qs[0].stem.startswith(n) for n in NAMES), qs[0].stem


def dec(f: Fraction) -> str:
    """An exact decimal as a student writes it: 0.8, 2.5, 4."""
    assert (f * 10000).denominator == 1, f
    s = f"{float(f):.4f}".rstrip("0").rstrip(".")
    return s


def signed_ok(q, v: int):
    """A signed amount: the key is the number with a hyphen minus; the true minus and spaced forms are accepted too."""
    assert int(q.answer) == v, (q.stem, q.answer, v)
    if v < 0:
        assert f"−{abs(v)}" in q.accepted, q.accepted
        if abs(v) >= 1000:
            assert f"-{fr(abs(v))}" in q.accepted or f"−{fr(abs(v))}" in q.accepted, q.accepted


def _central(options):
    toks = [Counter(re.findall(r"-?\d+|[a-zA-Z]+|\S", o)) for o in options]
    score = [sum(sum(((t - u) + (u - t)).values()) for u in toks) for t in toks]
    best = min(score)
    return score.index(best) if score.count(best) == 1 else None


# --- all eight --------------------------------------------------------------------------------------

@pytest.mark.parametrize("fid", MACRO)
def test_family_is_worded_and_linked(fid):
    m = fam(fid)
    assert m.SUBJECT == "economics"
    assert m.CONCEPTS and all(c.startswith("economics.") for c in m.CONCEPTS)
    assert m.NEEDS
    stems = []
    for seed in range(1, 31):
        rng = random.Random(seed)
        stems.append({q.stem for q in m.questions(m.sample(rng), rng)})
    own = sum(1 for i, s in enumerate(stems) if s - set().union(*(t for j, t in enumerate(stems) if j != i)))
    assert own >= 27, f"{fid}: only {own} of 30 figures have a wording of their own"
    for seed in range(1, 120):
        p, qs = run(m, seed)
        first = next((n for n in NAMES if qs[0].stem.startswith(n)), None)
        assert first, (fid, seed, qs[0].stem)
        for q in qs:
            for owner in re.findall(r"\b(" + "|".join(NAMES) + r")'s\b", q.stem):
                assert owner == first, (fid, seed, q.stem)
            # one question per figure in a quiz: no stem leans on another
            assert not re.search(r"\b(that price|the answer above|the same partner|as before)\b", q.stem, re.I), q.stem


@pytest.mark.parametrize("fid", MACRO)
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


# --- circular_flow ----------------------------------------------------------------------------------

LEAK = {2: "S", 3: "ST", 4: "STM"}
INJECT = {2: "I", 3: "IG", 4: "IGX"}


def test_circular_flow():
    m = fam("circular_flow")
    seen = set()
    for s in SEEDS:
        p, qs = run(m, s)
        first_names_the_person(qs)
        n, f = p["sectors"], p["flows"]
        seen.add((n, p["blank"]))
        assert set(f) == {"Y", "C"} | set(LEAK[n]) | set(INJECT[n]), (s, f)
        assert all(v > 0 and v % 10 == 0 for v in f.values()), (s, f)
        assert f["Y"] == f["C"] + sum(f[k] for k in LEAK[n]), (s, f)  # households spend or withdraw all their income
        assert f["C"] >= f["Y"] // 2, (s, f)
        inj, wd = sum(f[k] for k in INJECT[n]), sum(f[k] for k in LEAK[n])
        if inj != wd:
            assert abs(inj - wd) >= max(30, wd // 20), (s, inj, wd)  # no near-tie
        if s <= DRAWN:
            fig = m.draw(p)
            words = texts(fig)
            plt.close(fig)
            for k, v in f.items():
                shown = "?" if k == p["blank"] else fr(v)
                assert any(f"({k})" in w and w.split("\n")[-1] == shown for w in words), (s, k, shown, words)
            assert sum(1 for w in words if w.split("\n")[-1] == "?") == 1
            for box in ["Households", "Firms"] + (["Financial sector"] if n >= 2 else []) + (["Government"] if n >= 3 else []) \
                    + (["Rest of the world"] if n == 4 else []):
                assert any(box in w for w in words), (s, box)
        asked = 0
        for q in qs:
            if "marked ?" in q.stem:
                asked += 1
                ident = "Y = C + " + " + ".join(LEAK[n])
                assert ident in q.stem, (s, q.stem)
                want = f["Y"] - wd if p["blank"] == "C" else f["C"] + wd
                assert f"({p['blank']})" in q.stem
                assert int(q.answer) == want, (s, q.stem, q.answer)
            elif "total injections" in q.stem.lower() and "What are" in q.stem:
                asked += 1
                assert " + ".join(INJECT[n]) in q.stem
                assert int(q.answer) == inj, (s, q.answer)
            elif "total withdrawals" in q.stem.lower() and "What are" in q.stem:
                asked += 1
                assert " + ".join(LEAK[n]) in q.stem
                assert int(q.answer) == wd, (s, q.answer)
            elif "difference between them" in q.stem:
                asked += 1
                assert n == 2 and inj != wd
                assert int(q.answer) == abs(inj - wd), (s, q.answer)
            elif q.kind == "mcq":
                asked += 1
                assert "greater than" in q.stem and "smaller" in q.stem
                want = "It rises" if inj > wd else "It falls" if inj < wd else "It stays the same"
                assert picked(q) == want, (s, q.options, inj, wd)
                assert sorted(q.options) == ["It falls", "It rises", "It stays the same"]
        assert asked == len(qs) == 3, (s, [q.stem for q in qs])
    assert {k for k, _ in seen} == {2, 3, 4} and {b for _, b in seen} == {"C", "Y"}


def test_circular_flow_is_sometimes_in_equilibrium_but_mostly_not():
    m = fam("circular_flow")
    keys = Counter()
    for s in range(1, 401):
        p, qs = run(m, s)
        keys[picked(qs[-1])] += 1
    assert keys["It rises"] > 100 and keys["It falls"] > 100 and 10 < keys["It stays the same"] < 120, keys


# --- ad_as ------------------------------------------------------------------------------------------

def _meet(ad, asc, q_lo=0, q_hi=40):
    """Where a falling line P = a - bQ meets a rising (or flat, or upright) AS made of straight pieces, by search over
    exact fractions: the one Q where AD - AS changes sign."""
    a, b = ad
    for (q0, p0), (q1, p1) in zip(asc, asc[1:]):
        if q0 == q1:  # an upright piece: AD crosses it at Q = q0 if its P lies between
            pq = a - b * Fraction(q0)
            if min(p0, p1) <= pq <= max(p0, p1):
                return Fraction(q0), pq
            continue
        slope = Fraction(p1 - p0, q1 - q0)
        # a - bQ = p0 + slope (Q - q0)
        qq = (a - p0 + slope * q0) / (b + slope)
        if q0 <= qq <= q1:
            return qq, a - b * qq
    return None


def test_ad_as():
    m = fam("ad_as")
    seen = set()
    for s in SEEDS:
        p, qs = run(m, s)
        first_names_the_person(qs)
        assert p["band"] == "AL"
        kind = p["kind"]
        seen.add((kind, p.get("curve")))
        xu, yu = p["xunit"], p["yunit"]  # billion Frw and index points per grid unit
        if kind == "short":
            ad1 = (p["a"], p["b"])
            as1 = [(0, p["c"]), (40, p["c"] + 40 * p["d"])]
            ad2 = (p["a2"], p["b"]) if p["curve"] == "AD" else ad1
            as2 = [(0, p["c2"]), (40, p["c2"] + 40 * p["d"])] if p["curve"] == "AS" else as1
        else:
            k = p["kinks"]  # (0, h), (qa, h), (qf, top), (qf, very top)
            as1 = as2 = [tuple(pt) for pt in k]
            ad1, ad2 = (p["a"], p["b"]), (p["a2"], p["b"])
        e1, e2 = _meet(ad1, as1), _meet(ad2, as2)
        assert e1 and e2, (s, p)
        assert e1[0].denominator == e1[1].denominator == e2[0].denominator == e2[1].denominator == 1, (s, e1, e2)
        assert [int(e1[0]), int(e1[1])] == p["e1"] and [int(e2[0]), int(e2[1])] == p["e2"], (s, e1, e2, p)
        assert e1 != e2
        q2, p2 = int(e2[0]) * xu, int(e2[1]) * yu
        if s <= DRAWN:
            fig = m.draw(p)
            ax = fig.axes[0]
            gx, gy = gridlines(ax, "x"), gridlines(ax, "y")
            words = texts(fig)
            plt.close(fig)
            for qq, pp in (p["e1"], p["e2"]):
                assert float(qq * xu) in gx and float(pp * yu) in gy, (s, qq, pp)
            want = {"E1", "E2", "AD1", "AD2"} if p["curve"] == "AD" else {"E1", "E2", "AD", "SRAS1", "SRAS2"}
            assert want <= set(words), (s, words)
        asked = 0
        for q in qs:
            if "new price level" in q.stem:
                asked += 1
                assert int(q.answer) == p2, (s, q.answer, p2)
            elif "real GDP at the new equilibrium" in q.stem:
                asked += 1
                assert int(q.answer) == q2, (s, q.answer, q2)
                assert fr(q2) in q.accepted
            elif q.kind == "mcq" and kind == "short":
                asked += 1
                if p["curve"] == "AD":
                    want = "A rise in government spending" if p["a2"] > p["a"] else "A fall in government spending"
                else:
                    want = "A fall in firms' costs of production" if p["c2"] < p["c"] else "A rise in firms' costs of production"
                assert picked(q) == want, (s, q.options)
                assert len(q.options) == 4
            elif q.kind == "mcq":
                asked += 1
                assert p["a2"] > p["a"]
                dq = "rises" if e2[0] > e1[0] else "stays the same"
                dp = "rises" if e2[1] > e1[1] else "stays the same"
                assert picked(q) == f"Real GDP {dq} and the price level {dp}", (s, q.options, e1, e2)
                assert len(q.options) == 4
        assert asked == len(qs) == 3, (s, [q.stem for q in qs])
    assert {k for k, _ in seen} == {"short", "keynes"} and ("short", "AD") in seen and ("short", "AS") in seen


def test_ad_as_keynesian_shifts_land_in_every_range():
    m = fam("ad_as")
    outcomes = Counter()
    for s in range(1, 600):
        p, qs = run(m, s)
        if p["kind"] == "keynes":
            outcomes[picked(qs[-1])] += 1
    assert set(outcomes) == {"Real GDP rises and the price level stays the same", "Real GDP rises and the price level rises",
                             "Real GDP stays the same and the price level rises"}, outcomes


# --- labour_force -----------------------------------------------------------------------------------

def rate(u: int, lf: int) -> Fraction:
    return Fraction(100 * u, lf)


def pct_ok(q, r: Fraction):
    assert (r * 10).denominator == 1, r
    assert Fraction(q.answer) == r, (q.stem, q.answer, r)
    assert f"{q.answer}%" in q.accepted


def test_labour_force():
    m = fam("labour_force")
    kinds = set()
    for s in SEEDS:
        p, qs = run(m, s)
        first_names_the_person(qs)
        kinds.add(p["kind"])
        if p["kind"] == "districts":
            rows = {d: (e, u) for d, e, u in p["rows"]}
            rates = {d: rate(u, e + u) for d, (e, u) in rows.items()}
            top = sorted(rates.values(), reverse=True)
            assert top[0] - top[1] >= Fraction(3, 2), (s, rates)  # no near-tie
            most = max(rows, key=lambda d: rows[d][1])
            best = max(rates, key=rates.get)
            assert most != best, (s, rows)  # the biggest number unemployed is not the highest rate
            if s <= DRAWN:
                fig = m.draw(p)
                words = texts(fig)
                plt.close(fig)
                for d, (e, u) in rows.items():
                    assert d in words and fr(e) in words and fr(u) in words, (s, d, words)
            asked = 0
            for q in qs:
                got = re.search(r"unemployment rate in (\w+), as a percentage", q.stem)
                if got:
                    asked += 1
                    assert "unemployed ÷ labour force × 100" in q.stem and "employed + unemployed" in q.stem
                    pct_ok(q, rates[got.group(1)])
                got = re.search(r"What is the labour force in (\w+)", q.stem)
                if got:
                    asked += 1
                    e, u = rows[got.group(1)]
                    assert int(q.answer) == e + u
                if q.kind == "mcq":
                    asked += 1
                    assert "unemployed ÷ labour force × 100" in q.stem
                    assert picked(q) == best and most in q.options, (s, q.options)
            assert asked == len(qs) == 3, (s, [q.stem for q in qs])
        else:
            rows = p["rows"]  # [year, labour force, employed, unemployed], one cell None (the blank)
            blanks = [(i, j) for i, r in enumerate(rows) for j, v in enumerate(r) if v is None]
            assert len(blanks) == 1 and 0 < blanks[0][0] < len(rows) - 1 and blanks[0][1] in (1, 2, 3), (s, rows)
            bi, bj = blanks[0]
            full = [list(r) for r in rows]
            yr, lf, e, u = full[bi]
            full[bi][bj] = {1: (e or 0) + (u or 0), 2: (lf or 0) - (u or 0), 3: (lf or 0) - (e or 0)}[bj]
            for r in full:
                assert r[1] == r[2] + r[3] and r[3] > 0, (s, full)
            if s <= DRAWN:
                fig = m.draw(p)
                words = texts(fig)
                plt.close(fig)
                assert words.count("?") == 1
                for r in rows:
                    assert str(r[0]) in words and all(fr(v) in words for v in r[1:] if v is not None), (s, r, words)
            asked = 0
            for q in qs:
                if "marked ?" in q.stem:
                    asked += 1
                    assert "employed + unemployed" in q.stem and str(full[bi][0]) in q.stem
                    assert int(q.answer) == full[bi][bj], (s, q.answer)
                got = re.search(r"unemployment rate in (\d{4}), as a percentage", q.stem)
                if got:
                    asked += 1
                    r = next(r for r in rows if r[0] == int(got.group(1)))
                    assert None not in r
                    pct_ok(q, rate(r[3], r[1]))
                if q.kind == "mcq":
                    asked += 1
                    y0, y1 = (int(y) for y in re.search(r"between (\d{4}) and (\d{4})", q.stem).groups())
                    r0 = next(r for r in rows if r[0] == y0)
                    r1 = next(r for r in rows if r[0] == y1)
                    assert None not in r0 and None not in r1
                    d = rate(r1[3], r1[1]) - rate(r0[3], r0[1])
                    assert abs(d) >= Fraction(1, 2) and (d * 10).denominator == 1, (s, d)
                    way = "rose" if d > 0 else "fell"
                    assert picked(q) == f"It {way} by {dec(abs(d))} percentage points", (s, q.options, d)
                    assert len(q.options) == 4
            assert asked == len(qs) == 3, (s, [q.stem for q in qs])
    assert kinds == {"districts", "years"}


# --- multiplier -------------------------------------------------------------------------------------

def test_multiplier():
    m = fam("multiplier")
    kinds = set()
    for s in SEEDS:
        p, qs = run(m, s)
        first_names_the_person(qs)
        kinds.add(p["kind"])
        rows = p["rows"]
        if p["kind"] == "rounds":
            mpcs = {Fraction(c, y) for _, y, c in rows}
            assert all(rows[i + 1][1] == rows[i][2] for i in range(len(rows) - 1)), (s, rows)  # spent becomes income
            injection = rows[0][1]
        else:
            ys = [r[0] for r in rows]
            assert len(set(ys[i + 1] - ys[i] for i in range(len(ys) - 1))) == 1
            slopes = {Fraction(rows[i + 1][1] - rows[i][1], rows[i + 1][0] - rows[i][0]) for i in range(len(rows) - 1)}
            assert len(slopes) == 1
            slope = slopes.pop()
            mpcs = {slope if p["kind"] == "consumption" else 1 - slope}
            if p["kind"] == "consumption":
                assert any(Fraction(c, y) != slope for y, c in rows if y), (s, rows)  # APC is not the MPC
            injection = None
        assert len(mpcs) == 1
        mpc = mpcs.pop()
        k = 1 / (1 - mpc)
        if s <= DRAWN:
            fig = m.draw(p)
            words = texts(fig)
            plt.close(fig)
            for r in rows:
                assert all(fr(v) in words for v in r), (s, r, words)
        asked = 0
        for q in qs:
            if "What is the marginal propensity to consume" in q.stem:
                asked += 1
                assert "MPC = change in consumption ÷ change in income" in q.stem
                assert Fraction(q.answer) == mpc and q.answer == dec(mpc), (s, q.answer, mpc)
            elif "What is the marginal propensity to save" in q.stem:
                asked += 1
                assert "MPS = change in saving ÷ change in income" in q.stem
                assert Fraction(q.answer) == 1 - mpc, (s, q.answer)
            elif "value of the multiplier" in q.stem:
                asked += 1
                assert ("1 ÷ (1 − MPC)" in q.stem) if p["kind"] != "saving" else ("1 ÷ MPS" in q.stem)
                assert Fraction(q.answer) == k, (s, q.answer, k)
            elif "in the end" in q.stem or "in total" in q.stem:
                asked += 1
                assert "1 ÷ (1 − MPC)" in q.stem or "1 ÷ MPS" in q.stem
                j = injection if injection is not None else int(re.search(r"by ([\d ]+) billion Frw", q.stem).group(1).replace(" ", ""))
                if injection is not None:
                    assert fr(j) in q.stem or str(j) in q.stem or "round 1" in q.stem
                total = k * j
                assert total.denominator == 1 and int(q.answer) == total, (s, q.answer, total)
        assert asked == len(qs) == 3, (s, [q.stem for q in qs])
    assert kinds == {"consumption", "saving", "rounds"}


# --- trade_tables -----------------------------------------------------------------------------------

def test_trade_tables():
    m = fam("trade_tables")
    kinds = set()
    for s in SEEDS:
        p, qs = run(m, s)
        first_names_the_person(qs)
        kinds.add(p["kind"])
        if p["kind"] == "comparative":
            (ca, cb), ((g1, u1), (g2, u2)) = p["countries"], p["goods"]
            out = {ca: p["out"][0], cb: p["out"][1]}
            oc = {(c, 0): Fraction(out[c][1], out[c][0]) for c in out} | {(c, 1): Fraction(out[c][0], out[c][1]) for c in out}
            # a plain comparative advantage: one cost at least a quarter more than the other
            hi, lo = max(oc[(ca, 0)], oc[(cb, 0)]), min(oc[(ca, 0)], oc[(cb, 0)])
            assert hi >= lo * Fraction(5, 4), (s, oc)
            assert out[ca][0] != out[cb][0] and out[ca][1] != out[cb][1]
            if s <= DRAWN:
                fig = m.draw(p)
                words = texts(fig)
                plt.close(fig)
                assert ca in words and cb in words and all(fr(v) in words for c in out for v in out[c]), (s, words)
            asked = 0
            for q in qs:
                got = re.search(r"opportunity cost of 1 (\S+) of (.+?) in (\w+), in \S+ of (.+?)\?", q.stem)
                if got:
                    asked += 1
                    _, g, c, other = got.groups()
                    gi = [g1, g2].index(g)
                    assert other == [g1, g2][1 - gi]
                    assert Fraction(q.answer) == oc[(c, gi)] and q.answer == dec(oc[(c, gi)]), (s, q.answer)
                elif "pattern of specialisation" in q.stem:
                    asked += 1
                    a_good = g1 if oc[(ca, 0)] < oc[(cb, 0)] else g2
                    b_good = g2 if a_good == g1 else g1
                    assert picked(q) == f"{ca} makes {a_good}; {cb} makes {b_good}", (s, q.options, oc)
                    assert len(q.options) == 4
                else:
                    got = re.search(r"absolute advantage in (.+?)\?", q.stem)
                    assert got, q.stem
                    asked += 1
                    gi = [g1, g2].index(got.group(1))
                    want = ca if out[ca][gi] > out[cb][gi] else cb
                    assert picked(q) == want and set(q.options) == {ca, cb, "Neither country"}, (s, q.options)
            assert asked == len(qs) == 3, (s, [q.stem for q in qs])
        else:
            rows = p["rows"]  # [year, export price index, import price index]
            assert rows[0][1] == rows[0][2] == 100 and rows[0][0] == p["base"]
            tot = {y: Fraction(100 * x, mm) for y, x, mm in rows}
            assert all(t.denominator == 1 for t in tot.values()), (s, tot)
            if s <= DRAWN:
                fig = m.draw(p)
                words = texts(fig)
                plt.close(fig)
                for y, x, mm in rows:
                    assert str(y) in words and str(x) in words and str(mm) in words, (s, y, words)
            asked = 0
            for q in qs:
                assert "export price index ÷ import price index × 100" in q.stem
                got = re.search(r"terms of trade index in (\d{4})\?", q.stem)
                if got:
                    asked += 1
                    y = int(got.group(1))
                    assert y != rows[0][0] and int(q.answer) == tot[y], (s, q.answer, tot)
                elif "improve or worsen" in q.stem:
                    asked += 1
                    y0, y1 = (int(v) for v in re.search(r"Between (\d{4}) and (\d{4})", q.stem).groups())
                    assert abs(tot[y1] - tot[y0]) >= 5
                    assert picked(q) == ("They improved" if tot[y1] > tot[y0] else "They worsened"), (s, q.options)
                else:
                    asked += 1
                    assert "most favourable" in q.stem
                    best = sorted(tot.values(), reverse=True)
                    assert best[0] - best[1] >= 5
                    assert picked(q) == str(max(tot, key=tot.get)), (s, q.options, tot)
            assert asked == len(qs) == 3, (s, [q.stem for q in qs])
    assert kinds == {"comparative", "tot"}


def test_trade_tables_terms_of_trade_can_worsen_while_export_prices_rise():
    m = fam("trade_tables")
    traps = 0
    for s in range(1, 600):
        p, qs = run(m, s)
        if p["kind"] != "tot":
            continue
        q = next(q for q in qs if "improve or worsen" in q.stem)
        y0, y1 = (int(v) for v in re.search(r"Between (\d{4}) and (\d{4})", q.stem).groups())
        r = {y: (x, mm) for y, x, mm in p["rows"]}
        traps += r[y1][0] > r[y0][0] and picked(q) == "They worsened"
    assert traps >= 10


# --- balance_of_payments ----------------------------------------------------------------------------

def test_balance_of_payments():
    m = fam("balance_of_payments")
    blanks = set()
    for s in SEEDS:
        p, qs = run(m, s)
        first_names_the_person(qs)
        it = p["items"]
        blanks.add(p["blank"])
        goods, services = it["xg"] - it["mg"], it["xs"] - it["ms"]
        ca = goods + services + it["pi"] + it["si"]
        assert ca != 0 and it["pi"] < 0 < it["si"]
        if s <= DRAWN:
            fig = m.draw(p)
            words = texts(fig)
            plt.close(fig)
            for k, v in list(it.items()) + [("ca", ca)]:
                assert (("?" if k == p["blank"] else fr(v)) in words), (s, k, v, words)
            assert words.count("?") == 1
        asked = 0
        for q in qs:
            if "trade in goods balance = exports of goods − imports of goods" in q.stem:
                asked += 1
                signed_ok(q, goods)
            elif "trade in services balance = exports of services − imports of services" in q.stem:
                asked += 1
                signed_ok(q, services)
            elif "goods and services balance" in q.stem:
                asked += 1
                signed_ok(q, goods + services)
            elif "marked ?" in q.stem:
                asked += 1
                assert p["blank"] in ("pi", "si")
                assert "net primary income + net secondary income" in q.stem
                signed_ok(q, it[p["blank"]])
            else:
                asked += 1
                assert q.kind == "mcq" and p["blank"] == "ca"
                way = "surplus" if ca > 0 else "deficit"
                assert picked(q) == f"A {way} of {fr(abs(ca))} billion Frw", (s, q.options, ca)
                assert len(q.options) == 4
        assert asked == len(qs) == 3, (s, [q.stem for q in qs])
    assert blanks == {"ca", "pi", "si"}


def test_balance_of_payments_has_surpluses_and_deficits():
    m = fam("balance_of_payments")
    signs = Counter()
    for s in range(1, 300):
        p, _ = run(m, s)
        it = p["items"]
        signs[(it["xg"] - it["mg"] + it["xs"] - it["ms"] + it["pi"] + it["si"]) > 0] += 1
    assert signs[True] > 40 and signs[False] > 100, signs


# --- exchange_rate ----------------------------------------------------------------------------------

def test_exchange_rate():
    m = fam("exchange_rate")
    kinds = set()
    for s in SEEDS:
        p, qs = run(m, s)
        first_names_the_person(qs)
        kinds.add(p["kind"])
        if p["kind"] == "market":
            a, b, c, d, sh = p["a"], p["b"], p["c"], p["d"], p["shift"]
            # D: P = a - bQ; S: P = c + dQ; the shifted curve moved sh grid units across
            q1 = Fraction(a - c, b + d)
            if p["curve"] == "D":
                q2 = Fraction(a + b * sh - c, b + d)
            else:
                q2 = Fraction(a - c + d * sh, b + d)
            p1, p2 = a - b * q1, a - b * q2 + (b * sh if p["curve"] == "D" else 0)
            assert q1.denominator == q2.denominator == p1.denominator == p2.denominator == 1
            assert [int(q1), int(p1)] == p["e1"] and [int(q2), int(p2)] == p["e2"], (s, p)
            cents = p["cents"]  # US cents per grid unit up the side
            r1, r2 = Fraction(int(p1) * cents, 100), Fraction(int(p2) * cents, 100)
            if s <= DRAWN:
                fig = m.draw(p)
                ax = fig.axes[0]
                gx, gy = gridlines(ax, "x"), gridlines(ax, "y")
                words = texts(fig)
                plt.close(fig)
                for qq, pp in (p["e1"], p["e2"]):
                    assert round(float(qq * p["xunit"]), 6) in gx and round(float(Fraction(pp * cents, 100)), 6) in gy, (s, qq, pp)
                assert {"E1", "E2"} <= set(words) and ({"D1", "D2"} <= set(words) or {"S1", "S2"} <= set(words)), (s, words)
            asked = 0
            for q in qs:
                if "new equilibrium E2" in q.stem:
                    asked += 1
                    assert Fraction(q.answer) == r2 and f"${q.answer}" in q.accepted, (s, q.answer, r2)
                elif "how did the franc's value change" in q.stem:
                    asked += 1
                    way = "appreciated" if r2 > r1 else "depreciated"
                    assert picked(q) == f"It {way} by ${abs(r2 - r1):.2f} per 1 000 Frw", (s, q.options, r1, r2)
                    assert len(q.options) == 4
                else:
                    asked += 1
                    assert "Which event" in q.stem
                    up = (p["curve"] == "D") == (sh > 0)
                    if p["curve"] == "D":
                        want = f"Foreign tourists spend {'more' if sh > 0 else 'less'} in Rwanda"
                    else:
                        want = f"Rwandan firms spend {'more' if sh > 0 else 'less'} on imports"
                    assert picked(q) == want, (s, q.options, up)
                    assert len(q.options) == 4
            assert asked == len(qs) == 3, (s, [q.stem for q in qs])
        else:
            (y1, r1), (y2, r2) = p["rates"]
            item, usd = p["import"]
            good, frw = p["export"]
            assert r1 != r2 and frw % p["rates"][p["export_year"]][1] == 0
            if s <= DRAWN:
                fig = m.draw(p)
                words = " | ".join(texts(fig))
                plt.close(fig)
                assert all(s_ in words for s_ in (y1, y2, fr(r1), fr(r2), f"US$ {fr(usd)}", f"{fr(frw)} Frw")), (s, words)
                assert not re.search(r"\b(19|20)\d\d\b", words), (s, words)  # invented rates carry no calendar year
            asked = 0
            for q in qs:
                if "price of the imported" in q.stem:
                    asked += 1
                    y = re.search(r"in Frw in (Year \d)", q.stem).group(1)
                    rate_ = dict(p["rates"])[y]
                    assert "× the number of Frw per US$1" in q.stem
                    assert int(q.answer) == usd * rate_, (s, q.answer)
                elif "in US dollars in" in q.stem:
                    asked += 1
                    y = re.search(r"in US dollars in (Year \d)", q.stem).group(1)
                    rate_ = dict(p["rates"])[y]
                    assert "÷ the number of Frw per US$1" in q.stem
                    assert Fraction(frw, rate_).denominator == 1 and int(q.answer) == frw // rate_, (s, q.answer)
                else:
                    asked += 1
                    assert q.kind == "mcq"
                    way = "depreciated" if r2 > r1 else "appreciated"
                    cost = "more" if r2 > r1 else "less"
                    assert picked(q) == f"The franc {way}, so imports cost {cost} in francs", (s, q.options)
                    assert len(q.options) == 4
            assert asked == len(qs) == 3, (s, [q.stem for q in qs])
    assert kinds == {"market", "convert"}


def test_exchange_rate_franc_both_rises_and_falls():
    m = fam("exchange_rate")
    ways = Counter()
    for s in range(1, 400):
        p, qs = run(m, s)
        q = next(q for q in qs if q.kind == "mcq")
        ways["appreciated" in picked(q)] += 1
    assert ways[True] > 60 and ways[False] > 60, ways


# --- lorenz_curve -----------------------------------------------------------------------------------

def test_lorenz_curve():
    m = fam("lorenz_curve")
    for s in SEEDS:
        p, qs = run(m, s)
        first_names_the_person(qs)
        assert p["band"] == "AL"
        names = p["countries"]
        cum = dict(zip(names, p["cum"]))
        for c, ys in cum.items():
            assert ys[0] == 0 and ys[-1] == 100 and len(ys) == 6
            shares = [b - a for a, b in zip(ys, ys[1:])]
            assert all(x > 0 for x in shares) and all(a <= b for a, b in zip(shares, shares[1:])), (s, c, ys)  # bowed
            assert all(y < 20 * i for i, y in enumerate(ys) if 0 < i < 5)
        more = [c for c in names if all(a >= b + 5 for a, b in zip(cum[c][1:5], cum[[x for x in names if x != c][0]][1:5]))]
        assert len(more) == 1, (s, cum)  # one curve plainly nearer the line of equality everywhere
        if s <= DRAWN:
            fig = m.draw(p)
            ax = fig.axes[0]
            gx, gy = gridlines(ax, "x"), gridlines(ax, "y")
            words = texts(fig)
            plt.close(fig)
            for c, ys in cum.items():
                assert c in words, (s, c, words)
                assert all(float(20 * i) in gx and float(y) in gy for i, y in enumerate(ys)), (s, c)
            assert "Line of equality" in words
        asked = 0
        for q in qs:
            got = re.search(r"poorest (\d+)% of the population in (Country \w)", q.stem)
            if got:
                asked += 1
                k, c = int(got.group(1)) // 20, got.group(2)
                assert int(q.answer) == cum[c][k] and f"{q.answer}%" in q.accepted, (s, q.answer)
            got = re.search(r"richest (\d+)% of the population in (Country \w)", q.stem)
            if got:
                asked += 1
                k, c = int(got.group(1)) // 20, got.group(2)
                assert int(q.answer) == 100 - cum[c][5 - k], (s, q.answer)
            if q.kind == "mcq":
                asked += 1
                assert picked(q) == more[0] and len(q.options) == 3, (s, q.options)
        assert asked == len(qs) == 3, (s, [q.stem for q in qs])
