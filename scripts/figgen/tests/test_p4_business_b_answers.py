"""Answers of the P4 Business wave, Task D (markets, consumers, finance), recomputed from each figure's params over
1,000 seeds.

Nothing here calls a family's own helpers to work out a key: channel prices are built up mark-up by mark-up, the label's
price per 100 g from its price and mass, shelf lives and expiry checks from the printed dates, cost per sale and
click-through rates from their formulas, the checkout total from its lines, variances from the printed convention,
cost behaviour from the two outputs, share-price changes and dividend yields from their formulas, the cheapest
transport within a deadline from the quotes, and insurance from the premium rate and the average clause.
"""
import datetime
import math
import random
import re
from collections import Counter, defaultdict
from fractions import Fraction

import matplotlib.pyplot as plt
import pytest

from figgen.core import NAMES
from figgen.families import FAMILIES

SEEDS = range(1, 1001)
MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October",
          "November", "December"]
WAVE = ("distribution_channels", "product_label", "promotion_results", "ecommerce_checkout", "budget_variance",
        "share_prices", "transport_insurance")


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


def accepts_money(q, n: int) -> None:
    assert q.kind == "short" and q.answer == str(n), (q.stem, q.answer, n)
    forms = set(q.accepted)
    assert str(n) in forms and f"{n} Frw" in forms, (q.stem, q.accepted)
    if n >= 1000:
        assert fr(n) in forms and f"{n:,}" in forms, (n, q.accepted)


def accepts_number(q, n) -> None:
    assert q.kind == "short", q.stem
    assert float(q.answer) == float(n), (q.stem, q.answer, n)


def date_in(stem: str) -> datetime.date:
    d, mo, y = re.search(r"(\d{1,2}) (" + "|".join(MONTHS) + r") (\d{4})", stem).groups()
    return datetime.date(int(y), MONTHS.index(mo) + 1, int(d))


def months_between(a, b) -> int:
    return (b[0] - a[0]) * 12 + b[1] - a[1]


def _central(options):
    toks = [Counter(re.findall(r"-?\d+|[a-zA-Z]+|\S", o)) for o in options]
    score = [sum(sum(((t - u) + (u - t)).values()) for u in toks) for t in toks]
    best = min(score)
    return score.index(best) if score.count(best) == 1 else None


# --- distribution channels -------------------------------------------------------------------------

def _selling_prices(start, chain):
    """The price each member of the chain sells at, built up mark-up by mark-up."""
    out, price = [], Fraction(start)
    for _, up in chain:
        price = price * (100 + up) / 100
        out.append(price)
    return out


def test_distribution_channels():
    m = fam("distribution_channels")
    kinds = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        assert p["band"] == "UP"
        chans = p["channels"]
        assert 3 <= len(chans) <= 4, s
        assert len({tuple(r for r, _ in c) for c in chans}) == len(chans), s  # no channel drawn twice
        for c in chans:
            for price in _selling_prices(p["price"], c):
                assert price.denominator == 1, (s, c)
        consumer = [(_selling_prices(p["price"], c) or [Fraction(p["price"])])[-1] for c in chans]
        assert len(set(consumer)) == len(consumer), s  # no two channels give the consumer one price
        letter = {L: i for i, L in enumerate("ABCD"[:len(chans)])}
        assert len(qs) == 3
        q = qs[0]
        assert q.stem.split()[0] in NAMES
        got = re.search(r"in channel ([A-D])\?$", q.stem)
        assert got and "intermediaries" in q.stem, q.stem
        assert q.answer == str(len(chans[letter[got.group(1)]])), s
        q = qs[1]
        got = re.search(r"bought through channel ([A-D]), in Frw\?$", q.stem)
        assert got, q.stem
        c = chans[letter[got.group(1)]]
        assert len(c) >= 1, s
        accepts_money(q, int(_selling_prices(p["price"], c)[-1]))
        q = qs[2]
        assert "profit" not in q.stem, q.stem  # the figure gives a mark-up, not a profit (P4 review)
        got = re.search(r"In channel ([A-D]), how many francs does the (\w+) add to the price of each (\w+) as its "
                        r"mark-up\?$", q.stem)
        if got:
            c = chans[letter[got.group(1)]]
            roles = [r.lower() for r, _ in c]
            assert got.group(2) in roles, (s, q.stem)
            i = roles.index(got.group(2))
            sells = _selling_prices(p["price"], c)
            buys = Fraction(p["price"]) if i == 0 else sells[i - 1]
            accepts_money(q, int(sells[i] - buys))
            kinds["profit"] += 1
        else:
            got = re.search(r"through channel ([A-D]) than through channel ([A-D]), in Frw\?$", q.stem)
            assert got, q.stem
            a, b = (consumer[letter[x]] for x in got.groups())
            assert a > b, s
            accepts_money(q, int(a - b))
            kinds["difference"] += 1
    assert min(kinds.values()) > 200, kinds


def test_distribution_channels_prints_every_mark_up_and_the_producer_price():
    m = fam("distribution_channels")
    for s in range(1, 60):
        p = m.sample(random.Random(s))
        words = words_of(m, p)
        assert fr(p["price"]) in words, s
        for i, c in enumerate(p["channels"]):
            assert f"Channel {'ABCD'[i]}" in words, s
            for role, up in c:
                assert role in words and f"{up}%" in words, (s, role, up)
        assert "Producer" in words and "Consumer" in words


# --- product label ---------------------------------------------------------------------------------

PART_WORDS = {"expiry date": "exp", "manufacture date": "mfd", "batch number": "batch", "net mass": "mass",
              "net volume": "mass", "price": "price", "standards mark": "mark", "list of ingredients": "ingredients",
              "maker's address": "address", "product name": "name"}


def test_product_label():
    m = fam("product_label")
    kinds = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        assert p["band"] in ("LS", "UP")
        kinds[p["kind"]] += 1
        assert qs[0].stem.split()[0] in NAMES, qs[0].stem
        if p["kind"] == "label":
            letters = {part: L for L, part in p["letters"]}
            assert len(letters) == len(p["letters"]) >= 5, s
            assert p["unit"] in ("g", "ml")
            q = qs[0]
            assert q.kind == "mcq"
            part = next(k for w, k in PART_WORDS.items() if f"shows the {w}" in q.stem)
            assert picked(q) == letters[part], (s, q.stem)
            assert set(q.options) <= set(letters.values())
            q = qs[1]
            assert f"per 100 {p['unit']}" in q.stem
            per = Fraction(p["price"] * 100, p["mass"])
            assert per.denominator == 1
            accepts_money(q, int(per))
            q = qs[2]
            mfd, exp = p["mfd"], p["exp"]
            assert mfd[2] == exp[2]
            accepts_number(q, months_between(mfd, exp))
            assert 3 <= months_between(mfd, exp) <= 36
        else:
            packs = p["packs"]
            assert len(packs) == 4 and [x[0] for x in packs] == ["P", "Q", "R", "S"]
            # no pack is made after a date the questions ask about (P4 review)
            for q in qs[:2]:
                assert all(datetime.date(*x[2]) <= date_in(q.stem) for x in packs), (s, q.stem, packs)
            assert all(x[2][2] == x[3][2] for x in packs)
            assert len({x[1] for x in packs}) == 4  # batch numbers differ
            exps = [datetime.date(*x[3]) for x in packs]
            assert len(set(exps)) == 4, s
            q = qs[0]
            day = date_in(q.stem)
            assert day not in exps
            gone = [x[0] for x, e in zip(packs, exps) if e < day]
            assert len(gone) == 1, (s, day, exps)
            assert picked(q) == gone[0], s
            q = qs[1]
            day = date_in(q.stem)
            assert day not in exps
            ok = sum(1 for e in exps if e >= day)
            assert 0 < ok < 4, s
            accepts_number(q, ok)
            q = qs[2]
            got = re.search(r"pack ([PQRS])\b", q.stem)
            x = packs["PQRS".index(got.group(1))]
            accepts_number(q, months_between(x[2], x[3]))
    assert min(kinds.values()) > 300, kinds


def test_product_label_prints_its_parts():
    m = fam("product_label")
    for s in range(1, 60):
        p = m.sample(random.Random(s))
        words = words_of(m, p)
        if p["kind"] == "label":
            assert fr(p["price"]) in words and f"{p['mass']} {p['unit']}" in words, s
            assert p["batch"] in words and "Standards mark" in words, s
            for d in (p["mfd"], p["exp"]):
                assert f"{d[2]:02d}/{d[1]:02d}/{d[0]}" in words, s
            for L, _ in p["letters"]:
                assert L in words.split(), (s, L)
        else:
            for L, batch, mfd, exp in p["packs"]:
                assert batch in words and f"{exp[2]:02d}/{exp[1]:02d}/{exp[0]}" in words, s
                assert f"{mfd[2]:02d}/{mfd[1]:02d}/{mfd[0]}" in words, s
        assert "day/month/year" in words, s


# --- promotion results -----------------------------------------------------------------------------

def test_promotion_results():
    m = fam("promotion_results")
    kinds = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        kinds[p["kind"]] += 1
        rows = p["rows"]
        assert len({r[0] for r in rows}) == len(rows)
        assert p["band"] == ("LS" if p["kind"] == "simple" else "UP"), s
        cost = {r[0]: r[1] for r in rows}
        sales = {r[0]: r[-1] for r in rows}
        per = {k: Fraction(cost[k], sales[k]) for k in cost}
        assert all(v.denominator == 1 for v in per.values()), s
        best = min(per, key=per.get)
        assert sorted(per.values())[1] - per[best] >= 50, s  # no near-tie for the cheapest per sale
        assert best != min(cost, key=cost.get) and best != max(sales, key=sales.get), s
        assert qs[0].stem.split()[0] in NAMES
        row = {r[0].lower(): r for r in rows}  # a stem names a medium in lower case mid-sentence
        for q in qs:
            got = re.search(r"cost per (?:sale|new customer) (?:of|for) the (.+?) (?:advert|campaign)", q.stem)
            if q.kind == "mcq":
                assert "lowest cost per" in q.stem
                assert picked(q) == best, s
                assert min(cost, key=cost.get) in q.options and max(sales, key=sales.get) in q.options
            elif "What is the click-through rate" in q.stem:
                r = row[re.search(r"rate of the (.+?) advert", q.stem).group(1)]
                ctr = Fraction(r[3] * 100, r[2])
                assert ctr.denominator == 1
                accepts_number(q, int(ctr))
            elif "cost per click" in q.stem:
                r = row[re.search(r"click for the (.+?) advert", q.stem).group(1)]
                cpc = Fraction(r[1], r[3])
                assert cpc.denominator == 1
                accepts_money(q, int(cpc))
            elif "share of the" in q.stem:
                r = row[re.search(r"spent on (?:the )?(.+?)(?: advert)?, in %\?$", q.stem).group(1)]
                share = Fraction(r[1] * 100, sum(cost.values()))
                assert share.denominator == 1
                accepts_number(q, int(share))
            elif "spent in total" in q.stem:
                accepts_money(q, sum(cost.values()))
            else:
                assert got, q.stem
                r = row[got.group(1)]
                accepts_money(q, int(Fraction(r[1], r[-1])))
    assert min(kinds.values()) > 150, kinds


def test_promotion_results_prints_its_rows_and_formulas():
    m = fam("promotion_results")
    for s in range(1, 60):
        p = m.sample(random.Random(s))
        words = words_of(m, p)
        for r in p["rows"]:
            assert r[0] in words and all(fr(v) in words for v in r[1:]), (s, r)
        assert ("cost per sale" in words.lower()) or ("cost per new customer" in words.lower()), s
        if p["kind"] == "digital":
            assert "Click-through rate" in words


# --- e-commerce checkout ---------------------------------------------------------------------------

def test_ecommerce_checkout():
    m = fam("ecommerce_checkout")
    bands = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        bands[p["band"]] += 1
        sub = sum(q * u for _, q, u in p["items"])
        disc = Fraction(sub * p["discount"], 100)
        vat = (sub - disc) * Fraction(18, 100)
        total = sub - disc + vat + p["delivery"]
        assert disc.denominator == 1 and vat.denominator == 1, s
        letters = {part: L for L, part in p["letters"]}
        assert "padlock" in letters and p["domain"].startswith("https://"), s
        assert qs[0].stem.split()[0] in NAMES
        seen = set()
        for q in qs:
            if q.kind == "mcq":
                assert "secure" in q.stem
                assert picked(q) == letters["padlock"], s
                assert set(q.options) <= set(letters.values())
                seen.add("secure")
            elif "save" in q.stem:
                accepts_money(q, int(disc))
                seen.add("saving")
            elif "VAT" in q.stem and "total" not in q.stem.lower():
                accepts_money(q, int(vat))
                seen.add("vat")
            else:
                assert "total" in q.stem.lower() and "pay" in q.stem, q.stem
                accepts_money(q, int(total))
                seen.add("total")
        assert {"secure", "total"} <= seen and len(seen) == 3, (s, seen)
    assert bands["UP"] > 500 and bands["LS"] > 80 and bands["AL"] > 80, bands


def test_ecommerce_checkout_prints_its_lines_and_rates():
    m = fam("ecommerce_checkout")
    for s in range(1, 60):
        p = m.sample(random.Random(s))
        words = words_of(m, p)
        for name, qty, unit in p["items"]:
            assert name in words and fr(unit) in words and fr(qty * unit) in words, s
        assert "18%" in words and f"{p['discount']}%" in words and fr(p["delivery"]) in words, s
        assert p["code"] in words and p["domain"].replace("https://", "") in words, s


# --- budget variance -------------------------------------------------------------------------------

def _variance(item, budget, actual):
    """Size and side by the printed convention: sales above budget, or costs below it, are favourable."""
    good = actual > budget if item == "Sales revenue" else actual < budget
    return abs(actual - budget), "favourable" if good else "adverse"


def test_budget_variance():
    m = fam("budget_variance")
    kinds = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        kinds[(p["kind"], p["band"])] += 1
        assert qs[0].stem.split()[0] in NAMES
        if p["kind"] == "variance":
            rows = {r[0]: (r[1], r[2]) for r in p["rows"]}
            assert list(rows)[0] == "Sales revenue" and len(rows) >= 4
            assert all(b != a for b, a in rows.values())
            q = qs[0]
            item = re.search(r"variance for (.+?), in Frw\?$", q.stem).group(1)
            item = next(k for k in rows if k.lower() == item.lower())
            assert item != p["rows"][p["example"]][0], s  # never the worked row
            accepts_money(q, _variance(item, *rows[item])[0])
            q = qs[1]
            item = re.search(r"describes the (.+?) variance", q.stem).group(1)
            item = next(k for k in rows if k.lower() == item.lower())
            assert item != p["rows"][p["example"]][0], s
            size, side = _variance(item, *rows[item])
            assert picked(q) == f"{fr(size)} Frw {side}", (s, q.options)
            q = qs[2]
            assert "profit variance" in q.stem
            b_profit = rows["Sales revenue"][0] - sum(b for k, (b, _) in rows.items() if k != "Sales revenue")
            a_profit = rows["Sales revenue"][1] - sum(a for k, (_, a) in rows.items() if k != "Sales revenue")
            assert a_profit != b_profit
            key = f"{fr(abs(a_profit - b_profit))} Frw {'favourable' if a_profit > b_profit else 'adverse'}"
            assert picked(q) == key, (s, q.options, key)
            for q in qs[1:]:
                assert len(q.options) == 4
                sides = Counter(o.rsplit(" ", 1)[1] for o in q.options)
                amounts = Counter(o.rsplit(" ", 2)[0] for o in q.options)
                assert sides == Counter({"favourable": 2, "adverse": 2}) and len(amounts) == 2, q.options
        else:
            assert p["band"] == "AL"
            q1, q2 = p["outputs"]
            kind = {}
            for name, c1, c2 in p["rows"]:
                if c1 == c2:
                    kind[name] = "fixed"
                elif Fraction(c2, c1) == Fraction(q2, q1):
                    kind[name] = "variable"
                else:
                    assert c2 > c1 and Fraction(c2, c1) < Fraction(q2, q1)
                    kind[name] = "semi-variable"
            q = qs[0]
            want = re.search(r"Which of these costs is (fixed|variable|semi-variable)\?", q.stem).group(1)
            assert [o for o in q.options if kind[o] == want] == [picked(q)], (s, q.options)
            q = qs[1]
            name = re.search(r"variable cost per (?:\w+) (?:of|in) the (.+?) cost", q.stem).group(1)
            c1, c2 = next((r[1], r[2]) for r in p["rows"] if r[0].lower() == name.lower())
            v = Fraction(c2 - c1, q2 - q1)
            assert v.denominator == 1
            accepts_money(q, int(v))
            q = qs[2]
            q3 = int(re.search(r"total cost of making (\d[\d ]*) ", q.stem).group(1).replace(" ", ""))
            assert q3 not in (q1, q2)
            total = Fraction(0)
            for name, c1, c2 in p["rows"]:
                rate = Fraction(c2 - c1, q2 - q1)
                total += c1 + rate * (q3 - q1)
            assert total.denominator == 1
            accepts_money(q, int(total))
    assert kinds[("variance", "UP")] > 250 and kinds[("variance", "AL")] > 150 and kinds[("costs", "AL")] > 150, kinds


def test_budget_variance_prints_its_convention_and_rows():
    m = fam("budget_variance")
    for s in range(1, 60):
        p = m.sample(random.Random(s))
        words = words_of(m, p)
        for r in p["rows"]:
            assert r[0] in words and fr(r[1]) in words and fr(r[2]) in words, (s, r)
        if p["kind"] == "variance":
            assert "favourable" in words.lower() and "adverse" in words.lower()
        else:
            assert "Semi-variable" in words and all(fr(q) in words for q in p["outputs"])


# --- share prices ----------------------------------------------------------------------------------

def test_share_prices():
    m = fam("share_prices")
    kinds = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        assert p["band"] == "UP"
        kinds[p["kind"]] += 1
        months = p["months"]
        comp = {c[0]: (c[1], c[2]) for c in p["companies"]}
        assert len(comp) == len(p["companies"]) and all(len(v[0]) == len(months) for v in comp.values())
        if p["kind"] == "chart":
            assert all(x % p["step"] == 0 for v in comp.values() for x in v[0]), s
        assert qs[0].stem.split()[0] in NAMES
        for q in qs:
            asked = [mo for mo in months if re.search(rf"\b{mo}\b", q.stem)]
            if q.kind == "mcq":
                assert len(asked) == 1, q.stem
                i = months.index(asked[0])
                yields = {n: Fraction(v[1] * 100, v[0][i]) for n, v in comp.items()}  # in %
                best = max(yields, key=yields.get)
                assert picked(q) == best and set(q.options) == set(comp), s
                assert best != max(comp, key=lambda n: comp[n][1]), s  # not the biggest dividend
                assert sorted(yields.values())[-1] - sorted(yields.values())[-2] >= Fraction(1, 2), s
                continue
            name = next((n for n in comp if n in q.stem), None)
            assert name, q.stem
            prices, div = comp[name]
            if "dividend yield" in q.stem.lower() and "What was the dividend yield" in q.stem:
                i = months.index(asked[0])
                y = Fraction(div * 100, prices[i])
                assert y.denominator in (1, 2), s
                accepts_number(q, float(y))
            elif "percentage" in q.stem:
                a, b = (prices[months.index(mo)] for mo in sorted(asked, key=months.index))
                ch = Fraction((b - a) * 100, a)
                assert ch.denominator == 1 and ch != 0
                assert ("rise" in q.stem) == (ch > 0) and ("fall" in q.stem) == (ch < 0), q.stem
                accepts_number(q, abs(int(ch)))
            elif "worth" in q.stem:
                n = int(re.search(r"(\d[\d ]*) shares", q.stem).group(1).replace(" ", ""))
                accepts_money(q, n * prices[months.index(asked[0])])
            else:
                a, b = (prices[months.index(mo)] for mo in sorted(asked, key=months.index))
                assert a != b
                assert ("rise" in q.stem) == (b > a) and ("fall" in q.stem) == (b < a), q.stem
                accepts_money(q, abs(b - a))
    assert min(kinds.values()) > 300, kinds


def test_share_prices_prints_its_prices_and_formula():
    m = fam("share_prices")
    for s in range(1, 60):
        p = m.sample(random.Random(s))
        words = words_of(m, p)
        assert "Dividend yield" in words
        for name, prices, div in p["companies"]:
            assert name in words and str(div) in words, s
            if p["kind"] == "table":
                assert all(str(x) in words for x in prices), s


# --- transport and insurance -----------------------------------------------------------------------

def test_transport_insurance():
    m = fam("transport_insurance")
    kinds = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        assert p["band"] == "UP"
        kinds[p["kind"]] += 1
        assert qs[0].stem.split()[0] in NAMES
        if p["kind"] == "transport":
            modes = {x[0]: x[1:] for x in p["modes"]}
            q = qs[0]
            t = int(re.search(r"send (\d+) tonnes", q.stem).group(1))
            d = int(re.search(r"within (\d+) days", q.stem).group(1))
            fits = {k: v for k, v in modes.items() if v[1] <= d and v[2] >= t}
            best = min(fits, key=lambda k: fits[k][0])
            assert picked(q) == best, s
            assert min(modes, key=lambda k: modes[k][0]) != best  # the cheapest of all is too slow or too small
            assert set(q.options) == set(modes)
            q = qs[1]
            mode = next(k for k in modes if f"by {k.lower()}" in q.stem)
            t = int(re.search(r"(\d+) tonnes", q.stem).group(1))
            assert t <= modes[mode][2]
            accepts_money(q, t * modes[mode][0])
            q = qs[2]
            if "shipments" in q.stem:
                mode = next(k for k in modes if f"by {k.lower()}" in q.stem)
                t = int(re.search(r"(\d+) tonnes", q.stem).group(1))
                n = math.ceil(t / modes[mode][2])
                assert n >= 2 and t % modes[mode][2], s
                accepts_number(q, n)
            else:
                a, b = (k for k in sorted(modes, key=lambda k: q.stem.find(f"by {k.lower()}")) if f"by {k.lower()}" in q.stem)
                t = int(re.search(r"(\d+) tonnes", q.stem).group(1))
                assert t <= modes[a][2] and t <= modes[b][2]
                accepts_money(q, abs(t * (modes[a][0] - modes[b][0])))
        else:
            value, insured, rate, loss = p["value"], p["insured"], Fraction(str(p["rate"])), p["loss"]
            assert insured < value and loss < insured
            premium = rate * insured / 100
            comp = Fraction(insured, value) * loss
            assert premium.denominator == 1 and comp.denominator == 1
            accepts_money(qs[0], int(premium))
            accepts_money(qs[1], int(comp))
            accepts_money(qs[2], int(loss - comp))
            assert "premium" in qs[0].stem.lower() and "average clause" in qs[1].stem.lower()
    assert min(kinds.values()) > 300, kinds


def test_transport_insurance_prints_its_quotes_and_formulas():
    m = fam("transport_insurance")
    for s in range(1, 60):
        p = m.sample(random.Random(s))
        words = words_of(m, p)
        if p["kind"] == "transport":
            for name, rate, days, load in p["modes"]:
                assert name in words and fr(rate) in words, (s, name)
        else:
            assert fr(p["value"]) in words and fr(p["insured"]) in words and fr(p["loss"]) in words
            assert "average clause" in words.lower() and "Premium" in words


def test_insurance_cover_cause_and_tense_match_the_journey():
    """P4 review: "marine cargo insurance" for a lorry journey, sea water on a road, and "the next order" beside a past
    claim. Road journeys carry goods-in-transit cover and road losses; a voyage carries marine cover and sea losses."""
    m = fam("transport_insurance")
    sea_words = re.compile(r"sea|ship|voyage|port\b|container", re.I)
    seen = Counter()
    for s in range(1, 400):
        p, qs = run(m, s)
        if p["kind"] != "insurance":
            continue
        seen[p["cover"]] += 1
        by_ship = "by ship" in p["journey"]
        assert by_ship == (p["cover"] == "sea"), (s, p["journey"], p["cover"])
        if p["cover"] == "road":
            assert not sea_words.search(p["loss_how"]) and "by lorry" in p["journey"], (s, p["loss_how"])
        else:
            assert sea_words.search(p["loss_how"]), (s, p["loss_how"])
        if s < 60:
            title = "Marine cargo insurance" if p["cover"] == "sea" else "Goods-in-transit insurance"
            other = "Goods-in-transit insurance" if p["cover"] == "sea" else "Marine cargo insurance"
            words = words_of(m, p)
            assert title in words and other not in words and p["journey"] in words, s
        for q in qs:
            assert not re.search(r"\bnext\b|\bmust\b|\bdoes the insurer\b|\binsures\b", q.stem), (s, q.stem)
        assert " did " in qs[0].stem and " did " in qs[1].stem and " did " in qs[2].stem
    assert seen["road"] > 40 and seen["sea"] > 40, seen


# --- all seven -------------------------------------------------------------------------------------

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
def test_mcq_distractors_are_wrong_and_distinct(fid):
    m = fam(fid)
    for s in range(1, 301):
        _, qs = run(m, s)
        for q in qs:
            if q.kind == "mcq":
                assert len(q.options) >= 3 and len(set(q.options)) == len(q.options), (s, q.options)


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
            assert "that price" not in q.stem and "the answer above" not in q.stem


@pytest.mark.parametrize("fid", WAVE)
def test_declares_its_concepts_and_links(fid):
    m = fam(fid)
    assert m.SUBJECT == "business" and m.CONCEPTS and all(c.startswith("business.") for c in m.CONCEPTS)
    assert m.NEEDS and re.compile(m.NEEDS)


def _avoided(m, name, p=None):
    pat = m.avoid_for(p) if p is not None and hasattr(m, "avoid_for") else getattr(m, "AVOID", None)
    return bool(pat and re.search(pat, name, re.I))


def test_links_turn_away_the_misfits_and_keep_the_fits():
    """NEEDS and AVOID read against the topics' names and sections: what each family must reach, and the sectionless
    topics sharing a broad concept that it must not."""
    cases = {  # fid: (names AVOID must turn away, names or sections NEEDS must match and AVOID must not)
        "distribution_channels": (["E-commerce", "Promotion", "Product and pricing", "Digital marketing",
                                   "Transport and insurance", "Market research"],
                                  ["Distribution", "Aids to trade", "Trade and aids to trade", "Trade",
                                   "The marketing mix: place"]),
        "product_label": ([], ["Consumer education", "Consumer protection", "Unit 6: Role Of Standards in Business"]),
        "promotion_results": (["E-commerce", "Distribution", "Market research",
                               "Chapter 18: The marketing mix – product and price",
                               "Chapter 21: Globalisation and international marketing"],
                              ["Promotion", "Digital marketing", "Marketing introduction", "Chapter 16: What is marketing?",
                               "Chapter 20: Marketing planning (A Level)", "The marketing mix: promotion"]),
        "ecommerce_checkout": (["Distribution", "Digital marketing", "Market research", "Aids to trade",
                                "Office organisation"],
                               ["E-commerce", "E-Commerce, Social Media and Online Services", "ICT in Business",
                                "Technology in Business Operations", "ICT in Financial Transactions"]),
        "share_prices": ([], ["Financial Markets", "Unit 9: Financial Institutions", "Finance and banking"]),
        "transport_insurance": (["Trade"], ["Transport and insurance", "Aids to trade", "Trade and aids to trade"]),
    }
    for fid, (misfits, fits) in cases.items():
        m = fam(fid)
        for name in misfits:
            assert _avoided(m, name), (fid, name)
        for name in fits:
            assert re.search(m.NEEDS, name, re.I) and not _avoided(m, name), (fid, name)
    # the AS chapters each family reaches by its own band are named for what it draws, and no other
    bv = fam("budget_variance")
    for s in range(1, 200):
        p = bv.sample(random.Random(s))
        if p["band"] == "AL":
            want = "Chapter 33: Budgets (A Level)" if p["kind"] == "variance" else "Chapter 32: Costs (A Level)"
            other = "Chapter 32: Costs (A Level)" if p["kind"] == "variance" else "Chapter 33: Budgets (A Level)"
            assert not _avoided(bv, want, p) and _avoided(bv, other, p), (s, p["kind"])
            for name in ("Chapter 28: Business finance", "Chapter 31: Forecasting and managing cash flows",
                         "Chapter 20: Marketing planning (A Level)"):
                assert _avoided(bv, name, p), name
        else:
            assert _avoided(bv, "Finance", p) and not _avoided(bv, "Unit 8: Financial Management", p)
    ec = fam("ecommerce_checkout")
    for s in range(1, 200):
        p = ec.sample(random.Random(s))
        if p["band"] == "AL":
            assert not _avoided(ec, "Chapter 19: for e-commerce discussion)", p)
            for name in ("Chapter 16: What is marketing?", "Chapter 18: The marketing mix – product and price"):
                assert _avoided(ec, name, p), name
    ti = fam("transport_insurance")
    for s in range(1, 200):
        p = ti.sample(random.Random(s))
        assert _avoided(ti, "Distribution", p) == (p["kind"] == "insurance"), s


def test_leader_lines_run_through_no_text():
    """A letter's leader line ends short of the part it points to and crosses no other text (P3z rule)."""
    from figgen.tests.test_families_layout import crosses, drawn_texts
    for fid in ("product_label", "ecommerce_checkout"):
        m = fam(fid)
        for s in range(1, 40):
            p = m.sample(random.Random(s))
            fig = m.draw(p)
            texts = drawn_texts(fig)
            leaders = [ln for ln in fig.axes[0].lines if (ln.get_gid() or "").startswith("leader-")]
            assert leaders or p.get("kind") == "shelf", (fid, s)
            for ln in leaders:
                for t, box in texts:
                    assert not crosses(ln, box), (fid, s, ln.get_gid(), t.get_text())
            plt.close(fig)


@pytest.mark.parametrize("fid", WAVE)
def test_no_option_is_the_key_most_of_the_time(fid):
    """A key that is nearly always the same letter or the same way of sending goods can be guessed without the figure."""
    m = fam(fid)
    keys = defaultdict(Counter)
    for s in range(1, 401):
        _, qs = run(m, s)
        for q in qs:
            if q.kind == "mcq":
                keys[re.sub(r"\d+", "#", q.stem.rsplit(". ", 1)[-1])][picked(q)] += 1
                keys["(every MCQ of the family)"][picked(q)] += 1
    for stem, c in keys.items():
        n = sum(c.values())
        if n >= 30:
            assert c.most_common(1)[0][1] / n <= 0.45, (fid, stem, c.most_common(3))
