"""Answers of the accounting statements and adjustments families (P3y, Task B), recomputed from each figure's params
over 1,000 seeds.

Each key is worked out here on its own, from the numbers the figure prints: the statement of financial position
added up, the expense or income account adjusted for what is owing or paid in advance, the provision for doubtful
debts at its printed rate, the partnership's profit appropriated, the club's accounts balanced, the manufacturing
account totalled and the project appraised. None of the families' helpers is called to do it.
"""
import calendar
import random
import re
from collections import Counter, defaultdict
from fractions import Fraction

import matplotlib.pyplot as plt
import pytest

from figgen.core import NAMES
from figgen.families import FAMILIES

SEEDS = range(1, 1001)
MONTHS = list(calendar.month_name)[1:]
OURS = ("financial_position", "accrual_prepayment", "doubtful_debts", "partnership_appropriation", "club_accounts",
        "manufacturing_account", "investment_appraisal")


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


def frw(n) -> str:
    """An amount as an account prints it: a space for thousands."""
    assert Fraction(n).denominator == 1, n
    return f"{int(n):,}".replace(",", " ")


def money_ok(q, n):
    """The key is the amount, and the forms a student writes are accepted."""
    assert q.kind == "short", q.stem
    assert Fraction(n).denominator == 1, (q.stem, n)
    n = int(n)
    assert int(q.answer) == n, (q.stem, q.answer, n)
    for form in (str(n), frw(n), f"{frw(n)} Frw"):
        assert form in q.accepted, (q.stem, form)


def shown_texts(m, p) -> list[str]:
    fig = m.draw(p)
    try:
        return [t.get_text() for ax in fig.axes for t in ax.texts]
    finally:
        plt.close(fig)


def printed(texts, n) -> bool:
    """Whether an amount is printed on its own, or inside a line of text ("Rent: 40 000 Frw a month")."""
    # not a piece of a longer amount: "18 000" is not printed in "1 218 000" nor "500" in "1 500"
    pat = re.compile(r"(?<!\d)(?<!\d )" + re.escape(frw(n)) + r"(?!\d)(?! \d)")
    return any(pat.search(t) for t in texts)


def first_names_a_person(qs):
    assert any(qs[0].stem.startswith(n) for n in NAMES), qs[0].stem


def mcq_ok(q, key: str):
    assert q.kind == "mcq", q.stem
    assert picked(q) == key, (q.stem, q.options, key)
    assert len(q.options) >= 3 and len(set(q.options)) == len(q.options), q.options
    assert sum(o == key for o in q.options) == 1


# --- financial_position --------------------------------------------------------------------------

def test_financial_position():
    m = fam("financial_position")
    blanks, loans = Counter(), set()
    for s in SEEDS:
        p, qs = run(m, s)
        assert p["band"] == "UP"
        nca = sum(v for _, v in p["non_current"])
        ca = sum(v for _, v in p["current_assets"])
        cl = sum(v for _, v in p["current_liabilities"])
        wc = ca - cl
        assert 2 <= len(p["non_current"]) <= 4 and 3 <= len(p["current_assets"]) <= 4 and 1 <= len(p["current_liabilities"]) <= 3
        assert wc > 0 and p["opening"] > 0 and p["profit"] > 0 and p["drawings"] > 0, s
        closing = p["opening"] + p["profit"] - p["drawings"]
        # the two halves agree: what the business owns less what it owes is the owner's capital
        assert nca + wc - p["loan"] == closing, s
        loans.add(p["loan"] > 0)
        blanks[p["blank"]] += 1
        first_names_a_person(qs)
        seen = set()
        for q in qs:
            if "net current assets" in q.stem:
                money_ok(q, wc)
                seen.add("wc")
            elif "closing capital" in q.stem:
                assert p["blank"] == "closing"
                if q.kind == "mcq":
                    mcq_ok(q, f"{frw(closing)} Frw")
                else:
                    money_ok(q, closing)
                seen.add("closing")
            elif "profit for the year" in q.stem:
                assert p["blank"] == "profit"
                money_ok(q, closing - p["opening"] + p["drawings"])
                seen.add("profit")
            elif "drawings" in q.stem:
                assert p["blank"] == "drawings"
                money_ok(q, p["opening"] + p["profit"] - closing)
                seen.add("drawings")
            else:
                pytest.fail(f"seed {s}: unrecognised question {q.stem!r}")
        assert seen == {"wc", p["blank"]}, (s, seen)
    assert set(blanks) == {"closing", "profit", "drawings"} and loans == {True, False}


def test_financial_position_prints_all_but_its_blanks():
    m = fam("financial_position")
    for s in range(1, 61):
        p, _ = run(m, s)
        texts = shown_texts(m, p)
        nca = sum(v for _, v in p["non_current"])
        ca = sum(v for _, v in p["current_assets"])
        cl = sum(v for _, v in p["current_liabilities"])
        for name, v in p["non_current"] + p["current_assets"] + p["current_liabilities"]:
            assert name in texts and frw(v) in texts, (s, name, v)
        for v in (nca, ca, cl, p["opening"]) + ((p["loan"],) if p["loan"] else ()):
            assert frw(v) in texts, (s, v)
        closing = p["opening"] + p["profit"] - p["drawings"]
        values = {"closing": closing, "profit": p["profit"], "drawings": p["drawings"]}
        for b, v in values.items():
            assert (frw(v) in texts) == (b != p["blank"]), (s, b)
        if p["blank"] != "profit":
            assert frw(p["opening"] + p["profit"]) in texts, s
        assert frw(ca - cl) not in texts, s  # the net current assets are the student's to work out
        assert texts.count("?") >= 3, s


# --- accrual_prepayment --------------------------------------------------------------------------

def balance_words(kind: str, state: str, amount: int) -> str:
    if kind == "expense":
        return f"{frw(amount)} Frw accrued (owing)" if state == "accrued" else f"{frw(amount)} Frw prepaid (paid in advance)"
    return f"{frw(amount)} Frw accrued (still to be received)" if state == "accrued" else f"{frw(amount)} Frw received in advance"


def adjusted(p):
    """The year's charge (or income), the balance at the year end and its kind, and the foot of the balanced account."""
    side, opening = p["opening"]
    cash = sum(e[2] for e in p["entries"])
    # an expense paid in advance, or income still to come, is a debit balance brought down; the other two credit
    ahead = side == ("Dr" if p["kind"] == "expense" else "Cr")
    net = cash + (opening if ahead else -opening)
    if p["mode"] == "rate":
        charge = 12 * p["rate"]
        diff = net - charge
        assert diff != 0
        state, bal = ("prepaid" if diff > 0 else "accrued"), abs(diff)
    else:
        state, bal = p["closing"]
        charge = net + (bal if state == "accrued" else -bal)
    foot = cash + (opening if ahead else 0) + (bal if state == "accrued" else 0)
    other = (0 if ahead else opening) + charge + (bal if state == "prepaid" else 0)
    assert foot == other, p
    return charge, state, bal, foot


def test_accrual_prepayment():
    m = fam("accrual_prepayment")
    combos, states, bands = set(), set(), set()
    for s in SEEDS:
        p, qs = run(m, s)
        combos.add((p["kind"], p["mode"]))
        bands.add(p["band"])
        assert p["opening"][0] in ("Dr", "Cr") and p["opening"][1] > 0
        days = [(e[0], e[1]) for e in p["entries"]]
        assert days == sorted(days) and len(set(days)) == len(days) and 2 <= len(days) <= 5, s
        for mon, day, amount in p["entries"]:
            assert 1 <= mon <= 12 and 1 <= day <= calendar.monthrange(p["year"], mon)[1] and amount > 0
        charge, state, bal, foot = adjusted(p)
        assert charge > 0 and bal > 0, s
        states.add((p["kind"], state))
        first_names_a_person(qs)
        seen = set()
        for q in qs:
            if "income statement" in q.stem:
                money_ok(q, charge)
                seen.add("charge")
            elif "foot" in q.stem:
                assert p["mode"] == "closing"
                money_ok(q, foot)
                seen.add("foot")
            elif "carried down" in q.stem:
                assert p["mode"] == "rate"
                mcq_ok(q, balance_words(p["kind"], state, bal))
                assert len(q.options) == 4
                seen.add("balance")
            else:
                pytest.fail(f"seed {s}: unrecognised question {q.stem!r}")
        assert seen == ({"charge", "balance"} if p["mode"] == "rate" else {"charge", "foot"}), (s, seen)
    assert combos == {(k, md) for k in ("expense", "income") for md in ("rate", "closing")}
    assert states == {(k, st) for k in ("expense", "income") for st in ("accrued", "prepaid")}
    assert bands == {"UP", "AL"}


def test_accrual_prepayment_prints_what_it_asks_about():
    m = fam("accrual_prepayment")
    for s in range(1, 61):
        p, _ = run(m, s)
        texts = shown_texts(m, p)
        for _, _, amount in p["entries"]:
            assert frw(amount) in texts, (s, amount)
        assert frw(p["opening"][1]) in texts and "Balance b/d" in " ".join(texts), s
        if p["mode"] == "rate":
            assert any(f"{frw(p['rate'])} Frw a month" in t for t in texts), s
        else:
            assert printed(texts, p["closing"][1]), s
        charge, _, _, foot = adjusted(p)
        assert not printed(texts, charge) or charge in [e[2] for e in p["entries"]], s


# --- doubtful_debts ------------------------------------------------------------------------------

def provisions(p):
    (r1, r2), (w1, w2), (c1, c2) = p["receivables"], p["written_off"], p["rates"]
    a, b = Fraction(c1 * (r1 - w1), 100), Fraction(c2 * (r2 - w2), 100)
    assert a.denominator == 1 and b.denominator == 1
    return int(a), int(b)


def test_doubtful_debts():
    m = fam("doubtful_debts")
    ways, bands, written = set(), set(), set()
    for s in SEEDS:
        p, qs = run(m, s)
        bands.add(p["band"])
        (r1, r2), (w1, w2) = p["receivables"], p["written_off"]
        assert r1 > w1 >= 0 and r2 > w2 >= 0
        written.add(w2 > 0)
        if p["band"] == "UP":
            assert p["rates"][0] == p["rates"][1]
        before, after = provisions(p)
        change = after - before
        assert change != 0 and before > 0, s
        ways.add(change > 0)
        first_names_a_person(qs)
        seen = set()
        for q in qs:
            if "statement of financial position" in q.stem:
                money_ok(q, r2 - w2 - after)
                seen.add("net")
            elif q.kind == "mcq":
                word, effect = ("Increase", "reduces") if change > 0 else ("Decrease", "increases")
                mcq_ok(q, f"{word} of {frw(abs(change))} Frw, which {effect} profit")
                assert len(q.options) == 4
                seen.add("change")
            elif "provision" in q.stem:
                money_ok(q, after)
                seen.add("provision")
            else:
                pytest.fail(f"seed {s}: unrecognised question {q.stem!r}")
        assert seen == {"provision", "change", "net"}, (s, seen)
    assert ways == {True, False} and bands == {"UP", "AL"} and written == {True, False}


def test_doubtful_debts_prints_the_receivables_and_rates():
    m = fam("doubtful_debts")
    for s in range(1, 61):
        p, _ = run(m, s)
        texts = shown_texts(m, p)
        for v in p["receivables"]:
            assert frw(v) in texts, (s, v)
        for v in p["written_off"]:
            if v:
                assert frw(v) in texts, (s, v)
        for c in p["rates"]:
            assert f"{c}%" in texts, (s, c)
        before, after = provisions(p)
        assert not printed(texts, after) and not printed(texts, before), s


# --- partnership_appropriation -------------------------------------------------------------------

def appropriate(p):
    """Each partner's interest on capital and on drawings, salary, share of the residual profit and total."""
    parts = p["partners"]
    ioc = [Fraction(c * p["ioc"], 100) for _, c, _, _, _ in parts]
    iod = [Fraction(d * p["iod"], 100) for _, _, d, _, _ in parts]
    residual = p["profit"] + sum(iod) - sum(x[3] for x in parts) - sum(ioc)
    ratio = sum(x[4] for x in parts)
    shares = [residual * x[4] / ratio for x in parts]
    totals = [x[3] + i + sh - d for x, i, sh, d in zip(parts, ioc, shares, iod)]
    for v in ioc + iod + shares + [residual]:
        assert v.denominator == 1, p
    return {x[0]: (int(sh), int(t)) for x, sh, t in zip(parts, shares, totals)}, residual, ioc, iod


def test_partnership_appropriation():
    m = fam("partnership_appropriation")
    layouts, bands, sizes = set(), set(), set()
    for s in SEEDS:
        p, qs = run(m, s)
        layouts.add(p["layout"])
        bands.add(p["band"])
        sizes.add(len(p["partners"]))
        names = [x[0] for x in p["partners"]]
        assert len(set(names)) == len(names) and all(n in NAMES for n in names)
        assert any(x[3] > 0 for x in p["partners"]), s  # someone is paid a salary
        each, residual, _, _ = appropriate(p)
        assert residual > 0 and all(t > 0 for _, t in each.values()), s
        first_names_a_person(qs)
        assert not any(qs[0].stem.startswith(n) for n in names), qs[0].stem  # the bookkeeper is not a partner
        seen = set()
        for q in qs:
            got = re.search(r"\b(\w+)'s total share", q.stem)
            if got:
                money_ok(q, each[got.group(1)][1])
                seen.add("total")
                continue
            got = re.search(r"\b(\w+)'s share of the residual profit", q.stem)
            if got:
                money_ok(q, each[got.group(1)][0])
                seen.add("share")
                continue
            pytest.fail(f"seed {s}: unrecognised question {q.stem!r}")
        assert seen == {"share", "total"}, (s, seen)
    assert layouts == {"agreement", "account"} and bands == {"UP", "AL"} and sizes == {2, 3}


def test_partnership_appropriation_prints_its_terms():
    m = fam("partnership_appropriation")
    for s in range(1, 61):
        p, _ = run(m, s)
        texts = shown_texts(m, p)
        joined = " | ".join(texts)
        each, residual, ioc, iod = appropriate(p)
        assert printed(texts, p["profit"]), s
        for (name, capital, drawings, salary, ratio), i, d in zip(p["partners"], ioc, iod):
            assert name in joined
            if salary:
                assert printed(texts, salary), (s, name)
            if p["layout"] == "agreement":
                assert frw(capital) in texts and frw(drawings) in texts, (s, name)
            else:
                assert frw(i) in texts and frw(d) in texts, (s, name)
        if p["layout"] == "agreement":
            assert f"{p['ioc']}%" in joined and f"{p['iod']}%" in joined, s
        ratio = " : ".join(str(x[4]) for x in p["partners"])
        assert ratio in joined, s
        assert not printed(texts, residual), s
        for share, _ in each.values():
            assert not printed(texts, share), s


# --- club_accounts -------------------------------------------------------------------------------

def club(p):
    if p["kind"] == "rp":
        side, opening = p["opening"]
        dr = sum(v for _, v in p["receipts"]) + (opening if side == "Dr" else 0)
        cr = sum(v for _, v in p["payments"]) + (opening if side == "Cr" else 0)
        return dr - cr, max(dr, cr)
    (a1, a2), (v1, v2) = p["arrears"], p["advance"]
    received = sum(e[2] for e in p["received"])
    income = received - a1 + v1 + a2 - v2
    foot = a1 + income + v2
    assert foot == v1 + received + a2
    return income, foot


def test_club_accounts():
    m = fam("club_accounts")
    kinds, ends, bands = set(), set(), set()
    for s in SEEDS:
        p, qs = run(m, s)
        kinds.add(p["kind"])
        bands.add(p["band"])
        first_names_a_person(qs)
        value, foot = club(p)
        seen = set()
        if p["kind"] == "rp":
            assert value != 0, s
            ends.add(value > 0)
            for q in qs:
                if "foot" in q.stem:
                    money_ok(q, foot)
                    seen.add("foot")
                elif q.kind == "mcq":
                    mcq_ok(q, f"{'Cash at bank' if value > 0 else 'Bank overdraft'} of {frw(abs(value))} Frw")
                    assert len(q.options) == 4
                    seen.add("balance")
                else:
                    pytest.fail(f"seed {s}: unrecognised question {q.stem!r}")
            assert seen == {"balance", "foot"}, (s, seen)
        else:
            assert value > 0 and all(v >= 0 for v in p["arrears"] + p["advance"]), s
            assert p["arrears"][0] + p["advance"][0] > 0 and p["arrears"][1] + p["advance"][1] > 0, s
            for q in qs:
                if "income and expenditure" in q.stem:
                    money_ok(q, value)
                    seen.add("income")
                elif "foot" in q.stem:
                    money_ok(q, foot)
                    seen.add("foot")
                else:
                    pytest.fail(f"seed {s}: unrecognised question {q.stem!r}")
            assert seen == {"income", "foot"}, (s, seen)
    assert kinds == {"rp", "subs"} and ends == {True, False} and bands == {"UP", "AL"}


def test_club_accounts_print_every_entry():
    m = fam("club_accounts")
    for s in range(1, 61):
        p, _ = run(m, s)
        texts = shown_texts(m, p)
        if p["kind"] == "rp":
            for name, v in p["receipts"] + p["payments"]:
                assert name in texts and frw(v) in texts, (s, name)
            assert frw(p["opening"][1]) in texts
        else:
            for e in p["received"]:
                assert frw(e[2]) in texts, s
            (a1, a2), (v1, v2) = p["arrears"], p["advance"]
            for v in (a1, v1):
                if v:
                    assert frw(v) in texts, (s, v)
            for v in (a2, v2):
                if v:
                    assert printed(texts, v), (s, v)
        value, foot = club(p)
        assert not printed(texts, foot), s


# --- manufacturing_account -----------------------------------------------------------------------

def manufacture(p):
    (r_open, r_close), (w_open, w_close) = p["raw"], p["wip"]
    materials = r_open + p["purchases"] + p["carriage"] - r_close
    prime = materials + p["labour"] + p["royalties"]
    overheads = Fraction(0)
    for name, amount, part in p["overheads"]:
        overheads += Fraction(amount * part[0], part[1]) if part else amount
    cost = prime + overheads + w_open - w_close
    assert overheads.denominator == 1
    profit = cost * p["markup"] / 100
    assert profit.denominator == 1
    return materials, prime, int(overheads), int(cost), int(profit)


def test_manufacturing_account():
    m = fam("manufacturing_account")
    layouts, bands, shared, markups = set(), set(), set(), set()
    for s in SEEDS:
        p, qs = run(m, s)
        layouts.add(p["layout"])
        bands.add(p["band"])
        shared.add(any(o[2] for o in p["overheads"]))
        markups.add(p["markup"] > 0)
        if p["layout"] == "account":
            assert not any(o[2] for o in p["overheads"]) and not p["others"], s  # an account holds only the factory's part
        if p["markup"]:
            assert p["band"] == "AL"
        materials, prime, overheads, cost, profit = manufacture(p)
        assert 0 < materials < prime < cost, s
        first_names_a_person(qs)
        seen = set()
        for q in qs:
            # each stem states its formula, and a later one names the earlier lines: asked last first
            if "factory profit" in q.stem:
                money_ok(q, profit)
                seen.add("profit")
            elif "cost of production" in q.stem:
                money_ok(q, cost)
                seen.add("cost")
            elif "prime cost" in q.stem:
                money_ok(q, prime)
                seen.add("prime")
            else:
                pytest.fail(f"seed {s}: unrecognised question {q.stem!r}")
        assert seen == {"prime", "cost"} | ({"profit"} if p["markup"] else set()), (s, seen)
    assert layouts == {"extract", "account"} and bands == {"UP", "AL"} and shared == {True, False}
    assert markups == {True, False}


def test_manufacturing_account_prints_its_costs():
    m = fam("manufacturing_account")
    for s in range(1, 61):
        p, _ = run(m, s)
        texts = shown_texts(m, p)
        for v in list(p["raw"]) + list(p["wip"]) + [p["purchases"], p["labour"], p["royalties"]] + [o[1] for o in p["overheads"]]:
            assert frw(v) in texts, (s, v)
        if p["carriage"]:
            assert frw(p["carriage"]) in texts
        for name, v in p["others"]:
            assert name in texts and frw(v) in texts
        if p["markup"]:
            assert any(f"{p['markup']}%" in t for t in texts), s
        materials, prime, overheads, cost, profit = manufacture(p)
        for v in (prime, cost):
            assert not printed(texts, v), (s, v)


# --- investment_appraisal ------------------------------------------------------------------------

def appraise(p):
    cost, flows = p["cost"], p["flows"]
    cum, payback = 0, None
    for t, cf in enumerate(flows, start=1):
        if cum + cf >= cost:
            months = Fraction((cost - cum) * 12, cf)
            payback = (t - 1, months)
            break
        cum += cf
    assert payback is not None
    arr = Fraction(sum(flows) - cost, len(flows)) / cost * 100
    npv = sum(cf * Fraction(f) for cf, f in zip(flows, p["factors"])) - cost
    return payback, arr, npv


def period(years: int, months: int) -> str:
    return f"{years} year{'s' if years != 1 else ''} {months} month{'s' if months != 1 else ''}"


def test_investment_appraisal():
    m = fam("investment_appraisal")
    signs = set()
    for s in SEEDS:
        p, qs = run(m, s)
        assert p["band"] == "AL" and len(p["flows"]) == len(p["factors"]) in (4, 5)
        (years, months), arr, npv = appraise(p)
        assert months.denominator == 1 and 1 <= months <= 11 and months != 6 and years >= 1, s
        assert (arr * 10).denominator == 1 and arr > 0, s
        assert npv.denominator == 1 and npv != 0, s
        signs.add(npv > 0)
        first_names_a_person(qs)
        seen = set()
        for q in qs:
            if "payback" in q.stem:
                mcq_ok(q, period(years, int(months)))
                assert len(q.options) == 4
                seen.add("payback")
            elif "ARR" in q.stem:
                assert q.kind == "short" and Fraction(q.answer) == arr, (s, q.answer, arr)
                assert f"{q.answer}%" in q.accepted
                seen.add("arr")
            elif "net present value" in q.stem:
                assert q.kind == "short" and int(q.answer) == npv, (s, q.answer, npv)
                assert frw(abs(npv)) in " ".join(q.accepted)
                if npv < 0:
                    assert f"-{frw(-npv)}" in q.accepted and f"({frw(-npv)})" in q.accepted
                seen.add("npv")
            else:
                pytest.fail(f"seed {s}: unrecognised question {q.stem!r}")
        assert seen == {"payback", "arr", "npv"}, (s, seen)
    assert signs == {True, False}


def test_investment_appraisal_prints_the_flows_and_factors():
    m = fam("investment_appraisal")
    for s in range(1, 61):
        p, _ = run(m, s)
        texts = shown_texts(m, p)
        assert printed(texts, p["cost"]), s
        for cf, f in zip(p["flows"], p["factors"]):
            assert frw(cf) in texts and f in texts, (s, cf, f)
        assert any(f"{p['rate']}%" in t for t in texts), s


# --- all seven -----------------------------------------------------------------------------------

def _central(options):
    toks = [Counter(re.findall(r"-?\d+|[a-zA-Z]+|\S", o)) for o in options]
    score = [sum(sum(((t - u) + (u - t)).values()) for u in toks) for t in toks]
    best = min(score)
    return score.index(best) if score.count(best) == 1 else None


@pytest.mark.parametrize("fid", OURS)
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


@pytest.mark.parametrize("fid", OURS)
def test_most_figures_have_a_wording_of_their_own(fid):
    """The shared wording test, run here too until Accounting joins WORDED_SUBJECTS."""
    m = fam(fid)
    stems = []
    for seed in range(1, 31):
        rng = random.Random(seed)
        stems.append({q.stem for q in m.questions(m.sample(rng), rng)})
    own = sum(1 for i, st in enumerate(stems) if st - set().union(*(t for j, t in enumerate(stems) if j != i)))
    assert own >= 27, f"{fid}: only {own} of 30 figures have a wording of their own"


@pytest.mark.parametrize("fid", OURS)
def test_every_stem_stands_alone(fid):
    """The app shows one question with the figure: no stem leans on another ("the same partner", "the answer above")."""
    m = fam(fid)
    for s in range(1, 101):
        _, qs = run(m, s)
        for q in qs:
            assert not re.search(r"\b(above|that (amount|price|partner|account)|the same|your answer)\b", q.stem, re.I), q.stem


@pytest.mark.parametrize("fid", OURS)
def test_declares_accounting_concepts(fid):
    import sqlite3
    from pathlib import Path
    m = fam(fid)
    assert m.SUBJECT == "accounting" and m.KIND == "business.document"
    assert m.CONCEPTS and all(c.startswith("accounting.") for c in m.CONCEPTS)
    assert re.compile(m.NEEDS)
    store = Path("C:/Users/Stephen/figure-library/figures.db")
    if store.exists():
        db = sqlite3.connect(f"file:{store}?mode=ro", uri=True)
        known = {r[0] for r in db.execute("SELECT id FROM concepts")}
        assert set(m.CONCEPTS) <= known, sorted(set(m.CONCEPTS) - known)
        assert set(getattr(m, "ALSO", ())) <= known
