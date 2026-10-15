"""Answers of the second Business wave (P3y, Task E), recomputed from each figure's params over 1,000 seeds.

Nothing here calls a family's own helpers to work out a key: the organisation chart is walked from its boss links,
the life cycle's stages are named from their order, the Boston matrix's quadrants from the split lines, the survey's
counts from its sample, the break-even chart from its price and costs, the decision tree's expected values from its
branches, capacity utilisation from its formula, PAYE from the printed bands, and the budget from its lines.
"""
import random
import re
from collections import Counter, defaultdict

import matplotlib.pyplot as plt
import pytest

from figgen.core import NAMES
from figgen.families import FAMILIES

SEEDS = range(1, 1001)
MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October",
          "November", "December"]
WAVE = ("org_chart", "product_life_cycle", "boston_matrix", "market_research", "break_even_chart", "decision_tree",
        "capacity_utilisation", "payslip", "personal_budget")


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


def words_of(m, p) -> str:
    fig = m.draw(p)
    fig.canvas.draw()
    words = " ".join(t.get_text() for ax in fig.axes for t in ax.texts)
    words += " " + " ".join(ax.get_title() + " " + ax.get_xlabel() + " " + ax.get_ylabel() for ax in fig.axes)
    words += " " + " ".join(t.get_text() for ax in fig.axes for t in ax.get_xticklabels() + ax.get_yticklabels())
    plt.close(fig)
    return words


def fr(n: int) -> str:
    return f"{n:,}".replace(",", " ")


def number(text: str) -> int:
    return int(text.replace(" ", "").replace(",", ""))


def stem_money(stem: str) -> list[int]:
    return [number(x) for x in re.findall(r"(\d{1,3}(?: \d{3})+|\d+) Frw", stem)]


def accepts_money(q, n: int) -> None:
    assert q.answer == str(n), (q.stem, q.answer, n)
    forms = set(q.accepted)
    assert str(n) in forms and f"{n} Frw" in forms
    if n >= 1000:
        assert fr(n) in forms and f"{n:,}" in forms, (n, q.accepted)


def _central(options):
    toks = [Counter(re.findall(r"-?\d+|[a-zA-Z]+|\S", o)) for o in options]
    score = [sum(sum(((t - u) + (u - t)).values()) for u in toks) for t in toks]
    best = min(score)
    return score.index(best) if score.count(best) == 1 else None


# --- organisation chart ----------------------------------------------------------------------------

def test_org_chart():
    m = fam("org_chart")
    depths = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        assert p["band"] == "UP"
        people = p["people"]
        names = [x[0] for x in people]
        assert len(set(names)) == len(names) and set(names) <= set(NAMES), s
        tops = [i for i, x in enumerate(people) if x[2] == -1]
        assert tops == [0], s
        assert all(0 <= x[2] < i for i, x in enumerate(people) if i), s  # each boss is drawn before the people under them
        boss = {x[0]: (people[x[2]][0] if x[2] >= 0 else None) for x in people}
        title = {x[0]: x[1] for x in people}
        under = defaultdict(list)
        for x in people[1:]:
            under[boss[x[0]]].append(x[0])

        def level(n):
            return 0 if boss[n] is None else 1 + level(boss[n])

        def everyone_below(n):
            return sum(1 + everyone_below(c) for c in under[n])

        depth = 1 + max(level(n) for n in names)
        assert depth in (3, 4), s
        depths[depth] += 1
        top = names[0]
        seen = set()
        for q in qs:
            got = re.search(r"span of control of (\w+), the (.+)\?", q.stem)
            if got:
                n = got.group(1)
                assert got.group(2) == title[n]
                assert q.answer == str(len(under[n])) and len(under[n]) >= 2, s
                assert everyone_below(n) > len(under[n]), s  # counting everyone below gives another number
                seen.add("span")
            if "levels of hierarchy" in q.stem:
                assert q.answer == str(depth), s
                seen.add("levels")
            if q.kind == "mcq":
                assert "chain of command" in q.stem
                start = re.search(r"from (\w+), the", q.stem).group(1)
                end = re.search(r"to (\w+), an? ", q.stem).group(1)
                assert start == top, s
                path = []
                n = boss[end]
                while n != top:
                    path.insert(0, n)
                    n = boss[n]
                assert path, s
                assert picked(q) == ", then ".join(path), (s, picked(q), path)
                if len(path) == 1:  # one person in between: no order to give (P3y review)
                    assert "in order" not in q.stem and q.stem.endswith(f"on to {end}?"), (s, q.stem)
                    assert all(", then" not in o for o in q.options)
                assert all(o != picked(q) for o in q.options if o is not picked(q))
                assert len(q.options) >= 3
                seen.add("chain")
            got = re.search(r"Who does (\w+), an? (.+), report to\?", q.stem)
            if got:
                n = got.group(1)
                assert got.group(2) == title[n]
                assert boss[n] != top, s  # never the head of the firm, which needs no chart
                assert q.answer == boss[n], s
                seen.add("boss")
        assert seen == {"span", "levels", "chain", "boss"}, (s, seen)
        assert re.match(rf"({'|'.join(NAMES)}) ", qs[0].stem), qs[0].stem
        asker = qs[0].stem.split()[0]
        assert asker not in names, s  # the person asking is not on the chart
        # nor is any name on the chart inside another, or the asker's: "Mutoni" beside "Umutoni" confused a reviewer
        for a in names + [asker]:
            for b in names:
                assert a == b or (a.lower() not in b.lower() and b.lower() not in a.lower()), (s, a, b)
    assert depths[3] > 200 and depths[4] > 200, depths


def test_org_chart_prints_every_name_and_title():
    m = fam("org_chart")
    for s in range(1, 61):
        p = m.sample(random.Random(s))
        words = words_of(m, p)
        for name, title, _ in p["people"]:
            assert name in words and title in words, (s, name, title)


# --- product life cycle ----------------------------------------------------------------------------

def test_product_life_cycle():
    """Four stages from launch, each shape unmistakable (P3y re-review: a development stage first left reviewers unsure
    whether II was introduction or growth); the extension strategy a dashed line on a year, sales rising after it."""
    m = fam("product_life_cycle")
    asks = Counter()
    names = ["Introduction", "Growth", "Maturity", "Decline"]
    for s in SEEDS:
        p, qs = run(m, s)
        assert p["band"] in ("UP", "AL")
        sales, step, start = p["sales"], p["step"], p["start"]
        stages = p["stages"]
        assert [st[0] for st in stages] == ["I", "II", "III", "IV"], s
        assert all(v % step == 0 and v > 0 for v in sales), s  # every year's sales on a gridline, none zero
        # the stages cover the years in order, with no gap: one stage for each yearly point
        assert stages[0][1] == 0 and stages[-1][2] == len(sales) - 1, s
        assert all(b[1] == a[2] + 1 for a, b in zip(stages, stages[1:])), s
        intro, growth, mature, decline = (list(range(st[1], st[2] + 1)) for st in stages)
        assert len(intro) >= 2 and len(growth) >= 3 and len(mature) >= 4 and len(decline) >= 2, s
        rise = lambda i: sales[i] - sales[i - 1]  # noqa: E731
        slow = max(rise(i) for i in intro[1:])
        steep = min(rise(i) for i in growth)
        assert all(rise(i) > 0 for i in intro[1:]), s
        assert steep >= 2 * slow, s  # growth rises at least twice as fast as introduction
        flat = max(abs(rise(i)) for i in mature)
        assert 2 * flat <= steep, s  # maturity barely moves next to growth
        assert all(rise(i) < 0 and -rise(i) > flat for i in decline), s  # decline falls faster than maturity moves
        peak = max(sales)
        top = sales.index(peak)
        assert sales.count(peak) == 1 and top in mature, s
        launch = p["ext"]
        assert launch in mature and launch + 1 in mature and launch > top, s
        assert all(sales[i] <= sales[i - 1] for i in range(top + 1, launch + 1)), s  # flat or falling up to the launch
        assert sales[launch + 1] > sales[launch], s  # and rising in the year after it
        seen = set()
        for q in qs:
            if q.kind == "mcq":
                year = int(re.search(r"(\d{4})\?$", q.stem).group(1))
                i = year - start
                k = next(k for k, st in enumerate(stages) if st[1] <= i <= st[2])
                assert picked(q) == names[k] and set(q.options) <= set(names), s
                assert "numbered I to IV" in q.stem, s
                seen.add("stage")
            elif "peak" in q.stem:
                assert q.answer == str(start + top), s
                seen.add("peak")
            elif "year after the extension strategy was launched" in q.stem:
                assert q.answer == str(sales[launch + 1]), s
                asks["after"] += 1
                seen.add("ext")
            elif "extension strategy" in q.stem:
                assert "launched" in q.stem and q.answer == str(start + launch), s
                asks["year"] += 1
                seen.add("ext")
            elif "growth stage (stage II)" in q.stem:
                assert "yearly sales points" in q.stem and q.answer == str(len(growth)), s
                seen.add("growth")
        assert seen == {"stage", "peak", "ext", "growth"}, (s, seen)
    assert asks["year"] > 300 and asks["after"] > 300, asks


def test_product_life_cycle_marks_its_stages_and_the_launch_on_the_grid():
    m = fam("product_life_cycle")
    for s in range(1, 81):
        p = m.sample(random.Random(s))
        fig = m.draw(p)
        ax = fig.axes[0]
        texts = [t.get_text() for t in ax.texts]
        lines = {ln.get_gid(): ln for ln in ax.lines if ln.get_gid()}
        ys = [float(v) for v in lines["sales"].get_ydata()]
        xs = [float(v) for v in lines["sales"].get_xdata()]
        plt.close(fig)
        start, stages = p["start"], p["stages"]
        assert ys == [float(v) for v in p["sales"]] and xs == [float(start + i) for i in range(len(ys))], s
        for st in stages:
            assert st[0] in texts, s
        words = " ".join(" ".join(texts).lower().split())
        assert not any(w in words for w in ("introduction", "growth", "maturity", "decline", "development")), s
        assert not any(t.strip() in list("ABCDE") for t in texts), s  # no stage letter for an option letter to clash with
        # each boundary halfway between two years, so every yearly point sits inside one stage
        bounds = sorted(float(ln.get_xdata()[0]) for gid, ln in lines.items() if gid.startswith("boundary"))
        assert bounds == [start + st[1] - 0.5 for st in stages[1:]], s
        for x in xs:
            assert sum(1 for a, b in zip([xs[0] - 1] + bounds, bounds + [xs[-1] + 1]) if a < x < b) == 1, s
        # the launch: a dashed vertical line exactly on a year, labelled
        launch = lines["extension"]
        lx = [float(v) for v in launch.get_xdata()]
        assert lx[0] == lx[1] == start + p["ext"] and lx[0].is_integer(), s
        assert launch.get_linestyle() == "--"
        assert "extension strategy launched" in words, s


# --- Boston matrix ---------------------------------------------------------------------------------

QUADRANTS = {(True, True): "star", (False, True): "question mark", (True, False): "cash cow", (False, False): "dog"}


def test_boston_matrix():
    m = fam("boston_matrix")
    asked = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        assert p["band"] == "AL"
        prods = p["products"]
        assert 4 <= len(prods) <= 6
        names = [x[0] for x in prods]
        assert len(set(names)) == len(names) and all(" " not in n for n in names)
        ss, gs = p["share_split"], p["growth_split"]
        for name, share, growth in prods:
            assert share % p["share_step"] == 0 and growth % p["growth_step"] == 0, s  # on gridline crossings
            assert abs(share - ss) >= p["share_step"] and abs(growth - gs) >= p["growth_step"], s  # clear of the splits
            assert 0 < share < p["share_max"] and 0 < growth < p["growth_max"], s
        quad = {name: QUADRANTS[(share > ss, growth > gs)] for name, share, growth in prods}
        seen = set()
        for q in qs:
            got = re.search(r"Which product is an? (star|question mark|cash cow|dog)\?", q.stem)
            if got:
                inside = [n for n in names if quad[n] == got.group(1)]
                assert len(inside) == 1, s
                assert picked(q) == inside[0] and set(q.options) <= set(names), s
                asked[got.group(1)] += 1
                seen.add("quadrant")
            if "largest market share" in q.stem:
                shares = sorted((x[1] for x in prods), reverse=True)
                assert shares[0] - shares[1] >= p["share_step"], s
                assert picked(q) == max(prods, key=lambda x: x[1])[0], s
                seen.add("share")
            got = re.search(r"market growth rate (?:of|for) (\w+)", q.stem)
            if got:
                g = next(x[2] for x in prods if x[0] == got.group(1))
                assert q.answer == str(g) and f"{g}%" in q.accepted, s
                seen.add("growth")
        assert seen == {"quadrant", "share", "growth"}, (s, seen)
    assert set(asked) == set(QUADRANTS.values()), asked


def test_boston_matrix_names_its_quadrants_and_prints_its_splits():
    m = fam("boston_matrix")
    for s in range(1, 41):
        p = m.sample(random.Random(s))
        words = words_of(m, p)
        for name in ("Star", "Question mark", "Cash cow", "Dog"):
            assert name in words, (s, name)
        for name, _, _ in p["products"]:
            assert name in words, (s, name)
        fig = m.draw(p)
        ax = fig.axes[0]
        x0, x1 = ax.get_xlim()
        plt.close(fig)
        assert x0 > x1, s  # market share runs from high on the left to low on the right, as the textbooks draw it


# --- market research -------------------------------------------------------------------------------

def test_market_research():
    m = fam("market_research")
    charts = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        assert p["band"] in ("UP", "AL")
        n = p["n"]
        counts = {label: c for label, c in p["options"]}
        assert sum(counts.values()) == n and all(c > 0 for c in counts.values()), s
        assert all(" " not in label for label in counts)
        assert all(c * 100 % n == 0 for c in counts.values()), s  # every share a whole percentage
        charts[p["chart"]] += 1
        if p["chart"] == "bar":
            assert all(c % p["step"] == 0 for c in counts.values()), s  # every bar ends on a gridline
        ranked = sorted(counts.values(), reverse=True)
        assert ranked[0] > ranked[1] and ranked[-1] < ranked[-2], s
        seen = set()
        for q in qs:
            got = re.search(r"How many of the respondents chose (\w+)\?", q.stem)
            if got:
                assert q.answer == str(counts[got.group(1)]), s
                seen.add("count")
            got = re.search(r"What percentage of the respondents chose (\w+)\?", q.stem)
            if got:
                assert p["chart"] == "bar"
                pct = counts[got.group(1)] * 100 // n
                assert q.answer == str(pct) and f"{pct}%" in q.accepted, s
                seen.add("second")
            got = re.search(r"How many more respondents chose (\w+) than (\w+)\?", q.stem)
            if got:
                assert p["chart"] == "pie"
                d = counts[got.group(1)] - counts[got.group(2)]
                assert d > 0 and q.answer == str(d), s
                seen.add("second")
            if q.kind == "mcq":
                if "most popular" in q.stem:
                    key = max(counts, key=counts.get)
                else:
                    assert "least popular" in q.stem
                    key = min(counts, key=counts.get)
                assert picked(q) == key and set(q.options) <= set(counts), s
                seen.add("popular")
        assert seen == {"count", "second", "popular"}, (s, seen)
    assert charts["bar"] > 300 and charts["pie"] > 300


def test_market_research_prints_its_sample_and_its_options():
    m = fam("market_research")
    for s in range(1, 61):
        p = m.sample(random.Random(s))
        words = words_of(m, p)
        assert f"{p['n']} " in words or f"{p['n']}" in words.split(), s
        assert re.search(rf"\b{p['n']}\b", words), s
        for label, c in p["options"]:
            assert label in words, (s, label)
            if p["chart"] == "pie":
                assert f"{c * 100 // p['n']}%" in words, (s, label)


# --- break-even chart ------------------------------------------------------------------------------

def test_break_even_chart():
    m = fam("break_even_chart")
    sides = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        assert p["band"] == "UP"
        price, var, fixed, be = p["price"], p["var"], p["fixed"], p["be"]
        assert 0 < var < price, s
        assert fixed == (price - var) * be, s  # total revenue meets total costs at the break-even output
        xs, ys = p["xstep"], p["ystep"]
        assert be % xs == 0 and p["qmax"] % xs == 0 and be < p["qmax"], s
        assert fixed % ys == 0 and price * xs % ys == 0 and var * xs % ys == 0, s  # every gridline crossing exact
        seen = set()
        for q in qs:
            if "break-even output" in q.stem and "margin" not in q.stem:
                assert q.answer == str(be), s
                seen.add("be")
            elif "margin of safety" in q.stem:
                planned = number(re.search(r"sell (\d{1,3}(?: \d{3})*|\d+) ", q.stem).group(1))
                assert planned % xs == 0 and be < planned <= p["qmax"], s
                assert "planned output − break-even output" in q.stem
                assert q.answer == str(planned - be), s
                seen.add("margin")
            elif q.kind == "mcq":
                out = number(re.search(r"output of (\d{1,3}(?: \d{3})*|\d+) ", q.stem).group(1))
                assert out % xs == 0 and 0 < out <= p["qmax"] and out != be, s
                profit = price * out - (fixed + var * out)
                key = f"{'Profit' if profit > 0 else 'Loss'} of {fr(abs(profit))} Frw"
                assert picked(q) == key, (s, picked(q), key)
                assert len(q.options) == 4
                sides["profit" if profit > 0 else "loss"] += 1
                seen.add("profit")
        assert seen == {"be", "margin", "profit"}, (s, seen)
    assert sides["profit"] > 300 and sides["loss"] > 300, sides


def test_break_even_chart_lines_meet_where_the_key_says():
    m = fam("break_even_chart")
    for s in range(1, 81):
        p = m.sample(random.Random(s))
        fig = m.draw(p)
        ax = fig.axes[0]
        lines = {ln.get_gid(): ln for ln in ax.lines if ln.get_gid()}
        words = " ".join(t.get_text() for t in ax.texts)
        yticks = [float(t) for t in ax.get_yticks(minor=True)] + [float(t) for t in ax.get_yticks()]
        plt.close(fig)
        assert {"fixed", "total_costs", "revenue"} <= set(lines)
        assert "Total revenue" in words and "Total costs" in words and "Fixed costs" in words
        tr, tc = lines["revenue"], lines["total_costs"]
        assert list(tr.get_xdata()) == [0, p["qmax"]] and list(tr.get_ydata()) == [0, p["price"] * p["qmax"]]
        assert list(tc.get_ydata()) == [p["fixed"], p["fixed"] + p["var"] * p["qmax"]]
        assert float(p["fixed"]) in yticks, s
        if p["shown"]:
            assert fr(p["price"]) in words and fr(p["var"]) in words, s


# --- decision tree ---------------------------------------------------------------------------------

def test_decision_tree():
    m = fam("decision_tree")
    flips = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        assert p["band"] == "AL"
        opts = p["options"]
        assert len(opts) == 2
        gross, net = {}, {}
        for name, cost, outcomes in opts:
            assert 2 <= len(outcomes) <= 3 and sum(o[1] for o in outcomes) == 10, s  # probabilities in tenths, adding to 1
            g = sum(o[1] * o[2] for o in outcomes)
            assert g % 10 == 0, s  # a whole number of millions
            gross[name], net[name] = g // 10, g // 10 - cost
        a, b = sorted(net, key=net.get, reverse=True)
        assert net[a] - net[b] >= 2 and net[b] > 0, s  # one better option, plainly
        assert len({gross[a], gross[b], net[a], net[b]}) == 4, s
        flips[gross[a] < gross[b]] += 1
        seen = set()
        for q in qs:
            if q.kind == "mcq":
                assert picked(q) == f"{a}: Frw {net[a]} million", (s, picked(q))
                assert set(q.options) == {f"{x}: Frw {v} million" for x in (a, b) for v in (gross[x], net[x])}
                seen.add("choice")
            else:
                name = re.search(r'expected value of "(.+?)"', q.stem).group(1)
                assert "probability × payoff" in q.stem and "cost" in q.stem  # the method is stated
                assert q.answer == str(net[name]), s
                seen.add("ev")
        assert seen == {"choice", "ev"}, (s, seen)
    assert flips[True] > 150 and flips[False] > 150, flips  # the costs often turn the choice round


def test_decision_tree_prints_every_branch():
    m = fam("decision_tree")
    for s in range(1, 61):
        p = m.sample(random.Random(s))
        words = words_of(m, p)
        assert "million" in words
        for name, cost, outcomes in p["options"]:
            assert name in words and f"Cost: {cost}" in words, (s, name)
            for label, prob, payoff in outcomes:
                assert label in words and f"{prob / 10:.1f}" in words and str(payoff) in words, (s, label)


# --- capacity utilisation --------------------------------------------------------------------------

def test_capacity_utilisation():
    m = fam("capacity_utilisation")
    for s in SEEDS:
        p, qs = run(m, s)
        assert p["band"] == "AL"
        rows = p["rows"]
        assert 4 <= len(rows) <= 6
        util = {}
        for label, cap, out in rows:
            assert 0 < out <= cap, s
            assert out * 100 % cap == 0, s  # a whole percentage
            util[label] = out * 100 // cap
        ranked = sorted(util.values(), reverse=True)
        assert ranked[0] - ranked[1] >= 3, s
        best = max(util, key=util.get)
        most = max(rows, key=lambda r: r[2])[0]
        assert most != best, s  # the highest output is not the highest utilisation
        seen = set()
        for q in qs:
            got = re.search(r"capacity utilisation (?:in|at) (\w+), in %", q.stem)
            if got:
                assert q.answer == str(util[got.group(1)]) and f"{util[got.group(1)]}%" in q.accepted, s
                seen.add("util")
            got = re.search(r"spare capacity (?:in|at) (\w+)", q.stem)
            if got:
                cap, out = next((c, o) for lab, c, o in rows if lab == got.group(1))
                assert cap > out and q.answer == str(cap - out), s
                seen.add("spare")
            if q.kind == "mcq":
                assert "highest" in q.stem
                assert picked(q) == best and most in q.options, s
                seen.add("best")
        assert seen == {"util", "spare", "best"}, (s, seen)


def test_capacity_utilisation_prints_its_formula_and_rows():
    m = fam("capacity_utilisation")
    for s in range(1, 41):
        p = m.sample(random.Random(s))
        words = words_of(m, p)
        assert "÷" in words and "× 100" in words
        for label, cap, out in p["rows"]:
            assert label in words and fr(cap) in words and fr(out) in words, (s, label)


# --- payslip ---------------------------------------------------------------------------------------

def paye(gross: int, bands) -> int:
    tax = 0
    for lo, hi, rate in bands:
        top = gross if hi is None else min(gross, hi)
        if top > lo:
            tax += (top - lo) * rate
    assert tax % 100 == 0
    return tax // 100


def test_payslip():
    m = fam("payslip")
    bands_seen = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        assert p["band"] in ("UP", "LS")
        gross = sum(a for _, a in p["earnings"])
        bands = p["bands"]
        assert bands[0][0] == 0 and bands[-1][1] is None
        assert all(b[0] == a[1] for a, b in zip(bands, bands[1:]))
        assert gross > bands[1][0], s  # some pay is taxed
        tax = paye(gross, bands)
        pension = gross * p["pension"] / 100
        assert pension.is_integer(), s
        net = gross - tax - int(pension)
        bands_seen[p["band"]] += 1
        if p["band"] == "LS":
            assert p["pension"] == 0 and len(bands) == 2
        first = p["employee"][0]
        seen = set()
        for q in qs:
            if "gross pay" in q.stem:
                accepts_money(q, gross)
                seen.add("gross")
            elif "PAYE is deducted" in q.stem:
                accepts_money(q, tax)
                seen.add("paye")
            elif "pension" in q.stem:
                assert p["band"] == "UP"
                accepts_money(q, int(pension))
                seen.add("pension")
            elif "net pay" in q.stem:
                accepts_money(q, net)
                seen.add("net")
        assert seen == ({"gross", "paye", "pension", "net"} if p["band"] == "UP" else {"gross", "paye", "net"}), (s, seen)
        assert qs[0].stem.startswith(first)
    assert bands_seen["UP"] > 500 and bands_seen["LS"] > 150


def test_payslip_prints_its_lines_and_bands():
    m = fam("payslip")
    for s in range(1, 61):
        p = m.sample(random.Random(s))
        words = words_of(m, p)
        for label, a in p["earnings"]:
            assert label in words and fr(a) in words, (s, label)
        for lo, hi, rate in p["bands"]:
            assert f"{rate}%" in words, (s, rate)
        if p["pension"]:
            assert f"{p['pension']}%" in words
        assert "?" in words


# --- personal budget -------------------------------------------------------------------------------

def test_personal_budget():
    m = fam("personal_budget")
    sides = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        assert p["band"] == "LS"
        income = sum(a for _, a in p["income"])
        spent = sum(a for _, a in p["expenses"])
        assert income != spent, s
        balance = income - spent
        sides["surplus" if balance > 0 else "deficit"] += 1
        seen = set()
        for q in qs:
            if "total expenses" in q.stem:
                accepts_money(q, spent)
                seen.add("spent")
            elif q.kind == "mcq":
                assert "surplus or a deficit" in q.stem
                key = f"{'Surplus' if balance > 0 else 'Deficit'} of {fr(abs(balance))} Frw"
                assert picked(q) == key, (s, picked(q), key)
                assert len(q.options) == 4
                seen.add("balance")
            elif "left in savings" in q.stem:
                saved, cost = stem_money(q.stem)
                left = saved + balance - cost
                assert left >= 500 and saved + balance > 0, s
                accepts_money(q, left)
                seen.add("left")
        assert seen == {"spent", "balance", "left"}, (s, seen)
    assert sides["surplus"] > 300 and sides["deficit"] > 300, sides


def test_personal_budget_draws_no_empty_rows():
    """An empty row in the shorter table made reviewers wonder whether an item was missing (P3y review): each table
    has a ruled line above and below its heading, one under each of its lines, and one under its total, and no more."""
    m = fam("personal_budget")
    for s in range(1, 61):
        p = m.sample(random.Random(s))
        fig = m.draw(p)
        rules = Counter((ln.get_gid() or "").split(":")[1] for ln in fig.axes[0].lines if (ln.get_gid() or "").startswith("rule:"))
        plt.close(fig)
        assert rules == {"Income": len(p["income"]) + 3, "Expenses": len(p["expenses"]) + 3}, (s, rules)


def test_personal_budget_prints_its_lines():
    m = fam("personal_budget")
    for s in range(1, 61):
        p = m.sample(random.Random(s))
        words = words_of(m, p)
        for label, a in p["income"] + p["expenses"]:
            assert label in words and fr(a) in words, (s, label)


# --- all nine --------------------------------------------------------------------------------------

@pytest.mark.parametrize("fid", WAVE)
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


@pytest.mark.parametrize("fid", WAVE)
def test_most_figures_have_a_wording_of_their_own(fid):
    """As the shared test asks of a worded subject: of 30 figures, 27 carry a stem no other has."""
    m = fam(fid)
    stems = []
    for seed in range(1, 31):
        rng = random.Random(seed)
        stems.append({q.stem for q in m.questions(m.sample(rng), rng)})
    own = sum(1 for i, s in enumerate(stems) if s - set().union(*(t for j, t in enumerate(stems) if j != i)))
    assert own >= 27, f"{fid}: only {own} of 30 figures have a wording of their own"


@pytest.mark.parametrize("fid", WAVE)
def test_a_figure_belongs_to_the_person_in_the_first_question(fid):
    m = fam(fid)
    for seed in range(1, 120):
        rng = random.Random(seed)
        qs = m.questions(m.sample(rng), rng)
        first = next((n for n in NAMES if qs[0].stem.startswith(n)), None)
        assert first, qs[0].stem
        for q in qs:
            for owner in re.findall(r"\b(" + "|".join(NAMES) + r")'s\b", q.stem):
                assert owner == first, (fid, seed, q.stem)


@pytest.mark.parametrize("fid", WAVE)
def test_declares_its_concepts_and_links(fid):
    m = fam(fid)
    assert m.SUBJECT == "business" and m.CONCEPTS and all(c.startswith("business.") for c in m.CONCEPTS)
    assert m.NEEDS and re.compile(m.NEEDS)


def test_links_turn_away_the_misfits_and_keep_the_fits():
    """Each family's NEEDS and AVOID as read against the topics' names and sections (P3y reach check): what it must
    reach, and the sectionless topics sharing a broad concept that it must not."""
    cases = {  # fid: (names it must turn away by AVOID, names or sections NEEDS must match and AVOID must not)
        "org_chart": (["Business organisation", "Business units", "Office organisation"],
                      ["Organisation and management", "Chapter 14: Organisation structure", "Organizational structure"]),
        "product_life_cycle": (["Promotion", "Distribution", "Chapter 17: Market research", "Marketing"],
                               ["Product and pricing", "Chapter 18: The marketing mix \u2013 product and price",
                                "The marketing mix: product"]),
        "boston_matrix": (["Chapter 16: What is marketing?", "Chapter 20: Marketing planning (A Level)"],
                          ["Chapter 18: The marketing mix \u2013 product and price"]),
        "market_research": (["Product and pricing", "Digital marketing", "Chapter 21: Globalisation and international marketing"],
                            ["Market research", "Chapter 17: Market research", "Customer survey"]),
        "break_even_chart": (["Product and pricing", "Finance"],
                             ["Costs, scale of production and break-even analysis", "Chapter 35: Marginal costing"]),
        "capacity_utilisation": (["Chapter 24: Inventory management", "Chapter 18: The marketing mix \u2013 product and price"],
                                 ["Chapter 25: Capacity utilisation"]),
        "payslip": (["Tax Depreciation", "The Taxation of Investment Income"],
                    ["Taxation of Employment Income", "Computation of personal income tax", "Taxes in Rwanda"]),
        "personal_budget": (["Consumer education"], ["Personal budgeting", "Unit 5: Financial awareness"]),
    }
    for fid, (misfits, fits) in cases.items():
        m = fam(fid)
        for name in misfits:
            assert re.search(m.AVOID, name, re.I), (fid, name)
        for name in fits:
            assert re.search(m.NEEDS, name, re.I) and not re.search(m.AVOID, name, re.I), (fid, name)
    # S6 is reached by its section on personal income tax; a pattern once meant for customs alone turned it away
    assert not re.search(fam("payslip").AVOID, "Taxes and Customs Procedures", re.I)
