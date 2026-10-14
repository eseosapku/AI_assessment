"""Answers of the Accounting families (P3p, Task 3), recomputed from each figure's params over 1,000 seeds.

Each key is worked out here on its own: the ledger account balanced, the trial balance added up, the
depreciation run year by year, the bank reconciled, the income statement and the ratios computed. None of the
families' helpers is called to do it.
"""
import calendar
import random
import re
from fractions import Fraction

import matplotlib.pyplot as plt
import pytest

from figgen.core import NAMES
from figgen.families import FAMILIES

SEEDS = range(1, 1001)
MONTHS = list(calendar.month_name)[1:]
OURS = ("t_account", "trial_balance", "depreciation", "bank_reconciliation", "income_statement", "ratio_analysis")


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


def frw(n: int) -> str:
    """An amount as an account prints it: a space for thousands."""
    return f"{n:,}".replace(",", " ")


def key(q) -> int:
    assert q.kind == "short"
    return int(q.answer)


def money_ok(q, n: int):
    """The key is the amount, and the forms a student writes are accepted."""
    assert key(q) == n, (q.stem, q.answer, n)
    for form in (str(n), frw(n), f"{frw(n)} Frw"):
        assert form in q.accepted, (q.stem, form)


def shown_texts(m, p) -> list[str]:
    fig = m.draw(p)
    try:
        return [t.get_text() for ax in fig.axes for t in ax.texts]
    finally:
        plt.close(fig)


def first_names_a_person(qs):
    assert any(qs[0].stem.startswith(n) for n in NAMES), qs[0].stem


# --- t_account -----------------------------------------------------------------------------------

# What each side of an account may hold, written out here, apart from the family: a balance on the wrong side
# starts with an entry on the wrong side (Review Focus 1).
MONEY_IN = {"Sales", "Capital", "Loan", "Rent received", "Commission received"}
MONEY_OUT = {"Purchases", "Rent", "Wages", "Electricity", "Drawings", "Equipment", "Insurance", "Transport", "Stationery",
             "Water", "Motor vehicle", "Advertising"}
PERSONAL = {"customer": ({"Balance b/d", "Sales"}, {"Bank", "Cash", "Sales returns", "Discount allowed"}),
            "supplier": ({"Bank", "Cash", "Purchases returns", "Discount received"}, {"Balance b/d", "Purchases"})}


def test_t_account():
    m = fam("t_account")
    kinds, sides = set(), set()
    for s in SEEDS:
        p, qs = run(m, s)
        dr_rows, cr_rows = p["debits"], p["credits"]
        assert 3 <= sum(1 for r in dr_rows + cr_rows if r[1] != "Balance b/d") <= 5, s
        assert dr_rows and cr_rows, s
        kind = p["kind"]
        kinds.add(kind)
        # every entry on the side it belongs to
        if kind in ("bank", "cash"):
            assert not {r[1] for r in dr_rows} & MONEY_OUT, (s, dr_rows)
            assert not {r[1] for r in cr_rows} & MONEY_IN, (s, cr_rows)
        else:
            ok_dr, ok_cr = PERSONAL[kind]
            assert {r[1] for r in dr_rows} <= ok_dr and {r[1] for r in cr_rows} <= ok_cr, (s, dr_rows, cr_rows)
        # dated in order within the month, an opening balance on the 1st only
        last = calendar.monthrange(p["year"], p["month"])[1]
        for rows in (dr_rows, cr_rows):
            days = [r[0] for r in rows]
            assert days == sorted(days) and all(1 <= d <= last for d in days), (s, rows)
            assert all((r[1] == "Balance b/d") == (r[0] == 1) for r in rows), (s, rows)
        # balanced here, independently: the larger side keeps the balance b/d
        dr, cr = sum(r[2] for r in dr_rows), sum(r[2] for r in cr_rows)
        assert dr != cr, s
        bal = abs(dr - cr)
        side = "Debit" if dr > cr else "Credit"
        sides.add((kind, side))
        if kind in ("cash", "customer"):
            assert side == "Debit", (s, kind)
        if kind == "supplier":
            assert side == "Credit", s
        # cash never runs out, a customer never owes less than nothing, a supplier is never owed less than nothing
        if kind != "bank":
            events = sorted([(r[0], 0, r[2]) for r in dr_rows] + [(r[0], 1, -r[2]) for r in cr_rows])
            running = 0
            for _, _, v in events:
                running += v
                assert (running >= 0) if kind in ("cash", "customer") else (running <= 0), (s, kind, events)
        first_names_a_person(qs)
        seen = set()
        for q in qs:
            if "carried down" in q.stem:
                assert f"{last} {MONTHS[p['month'] - 1]} {p['year']}" in q.stem, q.stem
                money_ok(q, bal)
                seen.add("cd")
            elif "brought down" in q.stem:
                assert q.kind == "mcq"
                assert picked(q) == f"{side} side, {frw(bal)} Frw", (s, q.options, side, bal)
                for o in q.options:
                    if o != picked(q):
                        assert o != f"{side} side, {frw(bal)} Frw"
                seen.add("bd")
            elif "foot of the debit side" in q.stem:
                money_ok(q, max(dr, cr))
                seen.add("total")
            else:
                pytest.fail(f"seed {s}: unrecognised question {q.stem!r}")
        assert seen == {"cd", "bd", "total"}, (s, seen)
    assert kinds == {"bank", "cash", "customer", "supplier"}
    assert ("bank", "Credit") in sides and ("bank", "Debit") in sides  # an overdraft is drawn too


def test_t_account_shows_its_entries_and_no_balance():
    m = fam("t_account")
    for s in range(1, 41):
        p, _ = run(m, s)
        texts = shown_texts(m, p)
        for r in p["debits"] + p["credits"]:
            assert frw(r[2]) in texts and r[1] in texts, (s, r)
        assert "Balance c/d" not in texts, s  # the balancing is the student's
        dr, cr = sum(r[2] for r in p["debits"]), sum(r[2] for r in p["credits"])
        amounts = {r[2] for r in p["debits"] + p["credits"]}
        for v in (abs(dr - cr), max(dr, cr)):
            if v not in amounts:
                assert frw(v) not in texts, (s, v)


# --- trial_balance -------------------------------------------------------------------------------

NATURAL = {
    "Dr": {"Premises", "Equipment", "Fixtures and fittings", "Motor vehicle", "Inventory", "Trade receivables", "Bank", "Cash",
           "Purchases", "Wages", "Rent", "Electricity", "Insurance", "Drawings", "Sales returns", "Carriage inwards",
           "Discount allowed", "Advertising", "Transport", "Telephone", "General expenses"},
    "Cr": {"Capital", "Sales", "Trade payables", "Bank loan", "Purchases returns", "Discount received", "Rent received",
           "Commission received", "Bank overdraft"},
}


def test_trial_balance():
    m = fam("trial_balance")
    blanks = set()
    for s in SEEDS:
        p, qs = run(m, s)
        rows = p["rows"]
        names = [r[0] for r in rows]
        assert 6 <= len(rows) <= 9 and len(set(names)) == len(names), s
        assert not ({"Bank", "Bank overdraft"} <= set(names)), s
        for name, side, amount in rows:
            assert name in NATURAL[side], (s, name, side)  # assets and expenses Dr; capital, liabilities and income Cr
            assert amount > 0
        dr = sum(r[2] for r in rows if r[1] == "Dr")
        cr = sum(r[2] for r in rows if r[1] == "Cr")
        assert dr == cr, s
        missing = rows[p["blank"]]
        blanks.add(missing[0])
        # the missing figure is the other column's total less the rest of its own column
        other = cr if missing[1] == "Dr" else dr
        own_rest = sum(r[2] for i, r in enumerate(rows) if r[1] == missing[1] and i != p["blank"])
        first_names_a_person(qs)
        seen = set()
        for q in qs:
            if "missing" in q.stem:
                assert missing[0] in q.stem
                money_ok(q, other - own_rest)
                assert other - own_rest == missing[2]
                seen.add("missing")
            elif "total" in q.stem:
                money_ok(q, dr)
                seen.add("total")
            else:
                pytest.fail(f"seed {s}: unrecognised question {q.stem!r}")
        assert seen == {"missing", "total"}, s
    assert {"Capital", "Sales"} < blanks and len(blanks) > 8


def test_trial_balance_shows_all_but_the_blank():
    m = fam("trial_balance")
    for s in range(1, 41):
        p, _ = run(m, s)
        texts = shown_texts(m, p)
        for i, (name, _, amount) in enumerate(p["rows"]):
            assert name in texts
            if i != p["blank"]:
                assert frw(amount) in texts, (s, name)
        assert texts.count("?") == 3, s  # the missing figure and the two totals
        total = sum(r[2] for r in p["rows"] if r[1] == "Dr")
        assert frw(total) not in texts, s


# --- depreciation --------------------------------------------------------------------------------

def schedule(p, years):
    """Depreciation and net book value at the end of each year, run here: straight-line on (cost - residual)
    over the life, straight-line at a percentage of cost, or reducing balance at a rate of the value at the start."""
    out, nbv = [], Fraction(p["cost"])
    for _ in range(years):
        if p["method"] == "sl":
            d = Fraction(p["cost"] - p["residual"], p["life"])
        elif p["method"] == "pc":
            d = Fraction(p["cost"] * p["rate"], 100)
        else:
            d = nbv * p["rate"] / 100
        nbv -= d
        out.append((d, nbv))
    return out


def test_depreciation():
    m = fam("depreciation")
    methods, bands = set(), set()
    for s in SEEDS:
        p, qs = run(m, s)
        methods.add(p["method"])
        bands.add(p["band"])
        k, n = p["shown"], p["nbv_after"]
        assert 2 <= k <= 4 and n >= k, s  # the asked net book value is never printed
        run_ = schedule(p, max(k, n))
        # whole francs, every value the table shows or a question asks (Review Focus 2)
        for d, v in run_:
            assert d.denominator == 1 and v.denominator == 1 and v >= 0, (s, run_)
        if p["method"] == "sl":
            assert n <= p["life"] and run_[-1][1] >= p["residual"]
        first_names_a_person(qs)
        method_words = {"sl": "straight-line", "pc": "straight-line", "rb": "reducing balance"}[p["method"]]
        assert method_words in qs[0].stem, qs[0].stem  # the method is stated
        seen = set()
        for q in qs:
            got = re.search(r"depreciation for the year ended 31 December (\d{4})", q.stem)
            if got:
                year = int(got.group(1)) - p["start"] + 1
                assert year == k, s  # the year left blank
                money_ok(q, int(run_[year - 1][0]))
                seen.add("dep")
                continue
            got = re.search(r"net book value .*after (\d+) years", q.stem)
            if got:
                assert int(got.group(1)) == n
                assert f"31 December {p['start'] + n - 1}" in q.stem
                money_ok(q, int(run_[n - 1][1]))
                seen.add("nbv")
                continue
            pytest.fail(f"seed {s}: unrecognised question {q.stem!r}")
        assert seen == {"dep", "nbv"}, s
    assert methods == {"sl", "pc", "rb"} and bands == {"UP", "AL"}


def test_depreciation_shows_the_years_before_the_blank():
    m = fam("depreciation")
    for s in range(1, 41):
        p, _ = run(m, s)
        texts = shown_texts(m, p)
        k = p["shown"]
        run_ = schedule(p, k)
        for d, v in run_[:-1]:
            assert frw(int(d)) in texts and frw(int(v)) in texts, s
        assert texts.count("?") == 2, s  # the blank year's depreciation and its value at the end
        assert any(frw(p["cost"]) in t for t in texts)
        if run_[-1][0] not in {d for d, _ in run_[:-1]}:
            assert frw(int(run_[-1][0])) not in texts, s


# --- bank_reconciliation -------------------------------------------------------------------------

def test_bank_reconciliation():
    m = fam("bank_reconciliation")
    for s in SEEDS:
        p, qs = run(m, s)
        unpresented = sum(r[2] for r in p["unpresented"])
        lodged = sum(r[1] for r in p["lodgements"])
        assert p["unpresented"] and p["lodgements"] and p["charges"] > 0 and p["transfer"][1] > 0
        adjusted = p["cash_book"] - p["charges"] + p["transfer"][1]
        statement = adjusted + unpresented - lodged
        assert adjusted > 0 and statement > 0, s
        first_names_a_person(qs)
        seen = set()
        for q in qs:
            if "adjusted cash book" in q.stem and "bank statement show" not in q.stem:
                money_ok(q, adjusted)
                seen.add("adjusted")
            elif "bank statement show" in q.stem:
                if q.kind == "mcq":
                    assert picked(q) == f"{frw(statement)} Frw", (s, q.options)
                    wrong = [o for o in q.options if o != picked(q)]
                    assert len(wrong) >= 2 and f"{frw(statement)} Frw" not in wrong
                else:
                    money_ok(q, statement)
                seen.add("statement")
            else:
                pytest.fail(f"seed {s}: unrecognised question {q.stem!r}")
        assert seen == {"adjusted", "statement"}, s


def test_bank_reconciliation_lists_every_item():
    m = fam("bank_reconciliation")
    for s in range(1, 41):
        p, _ = run(m, s)
        texts = shown_texts(m, p)
        for v in [p["cash_book"], p["charges"], p["transfer"][1]] + [r[2] for r in p["unpresented"]] + [r[1] for r in p["lodgements"]]:
            assert frw(v) in texts, (s, v)


# --- income_statement ----------------------------------------------------------------------------

def test_income_statement():
    m = fam("income_statement")
    asked = set()
    for s in SEEDS:
        p, qs = run(m, s)
        cos = p["opening"] + p["purchases"] - p["closing"]
        gp = p["revenue"] - cos
        expenses = sum(e[1] for e in p["expenses"])
        profit = gp - expenses
        assert 3 <= len(p["expenses"]) <= 5 and cos > 0 and gp > 0 and profit > 0, s
        assert len(p["blanks"]) == 2 and set(p["blanks"]) <= {"cos", "gp", "profit"}, s
        assert qs[0].stem.startswith(p["owner"]), qs[0].stem
        seen = set()
        for q in qs:
            if "cost of sales" in q.stem:
                assert q.kind == "mcq"
                assert picked(q) == f"{frw(cos)} Frw", (s, q.options)
                assert len(set(q.options)) == len(q.options) >= 3
                seen.add("cos")
            elif "gross profit" in q.stem:
                money_ok(q, gp)
                seen.add("gp")
            elif "profit for the year" in q.stem:
                money_ok(q, profit)
                seen.add("profit")
            else:
                pytest.fail(f"seed {s}: unrecognised question {q.stem!r}")
        assert seen == set(p["blanks"]), s  # what is asked is what is left blank
        asked |= seen
    assert asked == {"cos", "gp", "profit"}


def test_income_statement_shows_all_but_the_blanks():
    m = fam("income_statement")
    for s in range(1, 41):
        p, _ = run(m, s)
        texts = shown_texts(m, p)
        cos = p["opening"] + p["purchases"] - p["closing"]
        gp = p["revenue"] - cos
        total_exp = sum(e[1] for e in p["expenses"])
        for v in [p["revenue"], p["opening"], p["purchases"], p["closing"], p["opening"] + p["purchases"], total_exp] + [e[1] for e in p["expenses"]]:
            assert frw(v) in texts, (s, v)
        assert texts.count("?") == 2, s
        values = {"cos": cos, "gp": gp, "profit": gp - total_exp}
        for b in p["blanks"]:
            assert frw(values[b]) not in texts, (s, b)  # a blank's value is printed nowhere else either
        for b in set(values) - set(p["blanks"]):
            assert frw(values[b]) in texts, (s, b)


# --- ratio_analysis ------------------------------------------------------------------------------

def two_places(fr: Fraction) -> str:
    assert (fr * 100).denominator == 1, fr
    return f"{float(fr):.2f}"


def test_ratio_analysis():
    m = fam("ratio_analysis")
    bands = set()
    for s in SEEDS:
        p, qs = run(m, s)
        bands.add(p["band"])
        ca = sum(r[1] for r in p["current_assets"])
        cl = sum(r[1] for r in p["current_liabilities"])
        inventory = dict(p["current_assets"])["Inventory"]
        rev, cos, exp = p["revenue"], p["cost_of_sales"], p["expenses"]
        gp, profit = rev - cos, rev - cos - exp
        assert 0 < profit < gp < rev, s
        first_names_a_person(qs)
        seen = set()
        for q in qs:
            if "current assets ÷ current liabilities" in q.stem:
                r = two_places(Fraction(ca, cl))
                assert q.answer == r, (s, q.answer, r)
                assert f"{r} : 1" in q.accepted and f"{r}:1" in q.accepted
                seen.add("current")
            elif "inventory" in q.stem and "÷ current liabilities" in q.stem:
                assert p["band"] == "AL"
                r = two_places(Fraction(ca - inventory, cl))
                assert q.answer == r and f"{r} : 1" in q.accepted
                seen.add("quick")
            elif "gross profit ÷ revenue" in q.stem:
                g = Fraction(gp * 100, rev)
                assert g.denominator == 1
                if q.kind == "mcq":
                    assert picked(q) == f"{g}%", (s, q.options)
                    assert len(q.options) >= 3
                else:
                    assert q.answer == str(g) and f"{g}%" in q.accepted
                seen.add("gross")
            elif "profit for the year ÷ revenue" in q.stem:
                pm = Fraction(profit * 100, rev)
                assert pm.denominator == 1
                assert q.answer == str(pm) and f"{pm}%" in q.accepted
                seen.add("profit")
            else:
                pytest.fail(f"seed {s}: unrecognised question {q.stem!r}")
        assert seen == ({"current", "gross", "profit"} | ({"quick"} if p["band"] == "AL" else set())), (s, seen)
    assert bands == {"UP", "AL"}


def test_ratio_analysis_prints_the_extracts():
    m = fam("ratio_analysis")
    for s in range(1, 41):
        p, _ = run(m, s)
        texts = shown_texts(m, p)
        ca = sum(r[1] for r in p["current_assets"])
        cl = sum(r[1] for r in p["current_liabilities"])
        rev, cos, exp = p["revenue"], p["cost_of_sales"], p["expenses"]
        for v in [r[1] for r in p["current_assets"] + p["current_liabilities"]] + [ca, cl, rev, cos, exp, rev - cos, rev - cos - exp]:
            assert frw(v) in texts, (s, v)


# --- all six -------------------------------------------------------------------------------------

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
