"""Answers of the accounting books and documents (P3y, Task A), recomputed from each figure's params over 1,000 seeds.

Each key is worked out here on its own: the petty cash book added up and the imprest restored, the invoice and credit
note priced, the statement of account run, the day book totalled, the control account balanced from its own table of
sides, the suspense account and corrected profit from its own table of what each error does, and the accounting
equation before and after a transaction. None of the families' helpers is called to do it.
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
OURS = ("petty_cash_book", "business_document", "day_book", "control_account", "suspense_account", "accounting_equation")


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


def amount_ok(q, n: int):
    """A short answer or a choice of amounts: either way the key is n francs, and no other option is."""
    if q.kind == "mcq":
        assert picked(q) == f"{frw(n)} Frw", (q.stem, q.options, n)
        assert sum(o == f"{frw(n)} Frw" for o in q.options) == 1
    else:
        money_ok(q, n)


def shown_texts(m, p) -> list[str]:
    fig = m.draw(p)
    try:
        return [t.get_text() for ax in fig.axes for t in ax.texts]
    finally:
        plt.close(fig)


def first_names_a_person(qs):
    assert any(qs[0].stem.startswith(n) for n in NAMES), qs[0].stem


def next_month(p):
    return MONTHS[p["month"] % 12], p["year"] + (p["month"] == 12)


# --- petty_cash_book -----------------------------------------------------------------------------

def test_petty_cash_book():
    m = fam("petty_cash_book")
    asked, variants = Counter(), set()
    for s in SEEDS:
        p, qs = run(m, s)
        last = calendar.monthrange(p["year"], p["month"])[1]
        # the imprest system: the month opens with the float in hand
        opening = sum(r[2] for r in p["opening"])
        assert opening == p["imprest"], s
        assert all(r[0] == 1 for r in p["opening"]) and p["opening"][0][1] == "Balance b/d", s
        variants.add(len(p["opening"]))
        if len(p["opening"]) == 2:
            assert p["opening"][1][1] == "Bank" and p["opening"][0][2] < p["imprest"], s  # restored at the start
        other = sum(r[2] for r in p["receipts"])
        pays = p["payments"]
        assert 5 <= len(pays) <= 8, s
        # dated in order, vouchers numbered in order
        days = [r[0] for r in pays]
        assert days == sorted(days) and all(1 <= d <= last for d in days), s
        vouchers = [r[2] for r in pays]
        assert vouchers == list(range(vouchers[0], vouchers[0] + len(pays))), s
        spent = sum(r[3] for r in pays)
        cols = defaultdict(int)
        for r in pays:
            cols[p["columns"][r[4]]] += r[3]
        assert sum(cols.values()) == spent
        bal = opening + other - spent
        assert bal > 0, s
        restore = p["imprest"] - bal
        assert restore == spent - other
        # the cash never runs out in the month
        running = 0
        for _, _, v in sorted([(r[0], 0, r[2]) for r in p["opening"] + p["receipts"]] + [(r[0], 1, -r[3]) for r in pays]):
            running += v
            assert running >= 0, s
        first_names_a_person(qs)
        seen = set()
        for q in qs:
            if "column" in q.stem:
                col = [c for c in p["columns"] if f"the {c} column" in q.stem]
                assert len(col) == 1, (s, q.stem)
                assert sum(1 for r in pays if p["columns"][r[4]] == col[0]) >= 2, s  # a total to add, not one entry read
                money_ok(q, cols[col[0]])
                seen.add("column")
            elif "back up to the float" in q.stem:
                # "restore the imprest" was read as "repay what was spent" by two blind reviewers (P3y): the stem says
                # the cash in hand is made up to the float, which counts any cash received into petty cash
                assert f"{frw(p['imprest'])} Frw" in q.stem and "cash in hand" in q.stem, q.stem
                amount_ok(q, restore)
                seen.add("restore")
            elif "carried down" in q.stem:
                assert f"{last} {MONTHS[p['month'] - 1]} {p['year']}" in q.stem
                amount_ok(q, bal)
                seen.add("balance")
            elif "paid out of petty cash" in q.stem:
                money_ok(q, spent)
                seen.add("spent")
            else:
                pytest.fail(f"seed {s}: unrecognised question {q.stem!r}")
            assert p["trader"] in q.stem or MONTHS[p["month"] - 1] in q.stem, q.stem
        assert {"column", "balance"} <= seen and seen & {"restore", "spent"}, (s, seen)
        if not other:
            assert not {"restore", "spent"} <= seen, s  # the same amount, asked twice
        asked.update(seen)
    assert variants == {1, 2}
    assert asked["restore"] > 200 and asked["spent"] > 200


def test_petty_cash_book_small_items_cost_what_they_cost():
    """A moto fare of 17 500 Frw (P3y review, seed 11) is no fare in Rwanda: fares, refreshments, airtime and postage
    stay small whatever the float."""
    m = fam("petty_cash_book")
    caps = {"Transport": 6_000, "Refreshments": 8_000, "Airtime": 10_000, "Postage": 12_000}
    for s in SEEDS:
        p, _ = run(m, s)
        for r in p["payments"]:
            col = p["columns"][r[4]]
            assert r[3] <= caps.get(col, p["imprest"] * 18 // 100), (s, col, r)


def test_petty_cash_book_shows_its_entries_and_no_totals():
    m = fam("petty_cash_book")
    for s in range(1, 61):
        p, _ = run(m, s)
        texts = shown_texts(m, p)
        words = " ".join(texts)
        assert frw(p["imprest"]) in words, s  # the float is printed
        heads = {t.split("\n")[0] for t in texts}
        for c in p["columns"]:
            assert c in heads, (s, c)
        for r in p["opening"] + p["receipts"]:
            assert frw(r[2]) in texts and r[1] in texts, (s, r)
        for day, details, voucher, amount, _ in p["payments"]:
            assert texts.count(frw(amount)) >= 2, (s, amount)  # in the total column and in its analysis column
            assert details in texts and str(voucher) in texts, (s, details)
        shown = {r[2] for r in p["opening"] + p["receipts"]} | {r[3] for r in p["payments"]}
        spent = sum(r[3] for r in p["payments"])
        bal = p["imprest"] + sum(r[2] for r in p["receipts"]) - spent
        cols = defaultdict(int)
        for r in p["payments"]:
            cols[r[4]] += r[3]
        for v in [spent, bal, *cols.values()]:
            if v not in shown:
                assert frw(v) not in texts, (s, v)
        assert "Balance c/d" not in texts, s  # the balancing is the student's


# --- business_document ---------------------------------------------------------------------------

VAT = Fraction(18, 100)


def priced(lines, pct):
    """Gross, trade discount, net, VAT at 18% and total, worked out here."""
    gross = sum(q * u for q, _, u in lines)
    disc = Fraction(gross * pct, 100)
    net = gross - disc
    vat = net * VAT
    total = net + vat
    for v in (disc, net, vat, total):
        assert v.denominator == 1, (lines, pct)
    return gross, int(disc), int(net), int(vat), int(total)


def test_business_document():
    m = fam("business_document")
    kinds, bands = Counter(), set()
    for s in SEEDS:
        p, qs = run(m, s)
        kind = p["kind"]
        kinds[kind] += 1
        bands.add(p["band"])
        assert (p["band"] == "LS") == (kind == "cash_invoice"), s
        first_names_a_person(qs)
        seen = set()
        if kind == "invoice":
            gross, disc, net, vat, due = priced(p["lines"], p["discount"])
            assert disc > 0 and len({gross, disc, net, vat, due}) == 5, s
            for q in qs:
                assert p["number"] in q.stem, q.stem  # the invoice is named in every stem
                if "net amount" in q.stem:
                    money_ok(q, net)
                    seen.add("net")
                elif "How much VAT" in q.stem:
                    money_ok(q, vat)
                    seen.add("vat")
                elif "total amount due" in q.stem:
                    amount_ok(q, due)
                    seen.add("due")
                else:
                    pytest.fail(f"seed {s}: unrecognised question {q.stem!r}")
            assert seen == {"net", "vat", "due"}, (s, seen)
        elif kind == "cash_invoice":
            amounts = [q * u for q, _, u in p["lines"]]
            sub = sum(amounts)
            vat = sub * VAT
            assert vat.denominator == 1, s
            due = sub + int(vat)
            for q in qs:
                assert p["number"] in q.stem, q.stem
                if "amount for the" in q.stem:
                    qty, item, unit = p["lines"][p["blank"]]
                    assert item in q.stem
                    money_ok(q, qty * unit)
                    seen.add("line")
                elif "before VAT" in q.stem:
                    money_ok(q, sub)
                    seen.add("sub")
                elif "total amount due" in q.stem:
                    amount_ok(q, due)
                    seen.add("due")
                else:
                    pytest.fail(f"seed {s}: unrecognised question {q.stem!r}")
            assert seen == {"line", "sub", "due"}, (s, seen)
        elif kind == "credit_note":
            gross, disc, net, vat, credited = priced(p["lines"], p["discount"])
            owed = p["invoice_total"] - credited
            assert owed > 0, s
            for q in qs:
                assert p["number"] in q.stem, q.stem
                if "total amount credited" in q.stem:
                    amount_ok(q, credited)
                    seen.add("credited")
                elif "still owe" in q.stem:
                    assert p["invoice_no"] in q.stem
                    amount_ok(q, owed)
                    seen.add("owed")
                else:
                    pytest.fail(f"seed {s}: unrecognised question {q.stem!r}")
            assert seen == {"credited", "owed"}, (s, seen)
        else:
            assert kind == "statement", kind
            bal = p["opening"]
            after = {}
            for day, details, dr, cr in p["rows"]:
                assert (dr == 0) != (cr == 0), (s, details)  # each line on one side
                assert dr == 0 or details.startswith("Invoice"), (s, details)  # only an invoice adds to what is owed
                bal += dr - cr
                assert bal > 0, s
                after[(day, details)] = bal
            closing = bal
            for q in qs:
                if "still owe" in q.stem:
                    pay = p["payment"]
                    assert f"{frw(pay)} Frw" in q.stem and 0 < pay < closing
                    amount_ok(q, closing - pay)
                    seen.add("after")
                elif "balance after" in q.stem:
                    day, details = p["mid"]
                    assert details in q.stem and f"{day} {MONTHS[p['month'] - 1]}" in q.stem, q.stem
                    amount_ok(q, after[(day, details)])
                    seen.add("mid")
                elif "end of" in q.stem and "balance" in q.stem:
                    amount_ok(q, closing)
                    seen.add("closing")
                else:
                    pytest.fail(f"seed {s}: unrecognised question {q.stem!r}")
                assert p["customer"] in q.stem, q.stem
            assert "closing" in seen and len(seen) >= 2, (s, seen)
    assert set(kinds) == {"invoice", "cash_invoice", "credit_note", "statement"} and min(kinds.values()) > 100
    assert bands == {"LS", "UP"}


def test_business_document_prints_what_is_asked_from():
    m = fam("business_document")
    for s in range(1, 81):
        p, _ = run(m, s)
        texts = shown_texts(m, p)
        words = " ".join(texts)
        kind = p["kind"]
        if kind in ("invoice", "credit_note"):
            assert f"{p['discount']}%" in words and "18%" in words, s  # the rates are printed
            gross, disc, net, vat, due = priced(p["lines"], p["discount"])
            for qty, item, unit in p["lines"]:
                assert item in texts and frw(unit) in texts and frw(qty * unit) in texts, (s, item)
            assert frw(gross) in texts, s
            shown = {frw(u) for _, _, u in p["lines"]} | {frw(q * u) for q, _, u in p["lines"]} | {frw(gross)}
            for v in (disc, net, vat, due):
                if frw(v) not in shown:
                    assert frw(v) not in texts, (s, v)
            if kind == "credit_note":
                assert frw(p["invoice_total"]) in words and p["invoice_no"] in words, s
        elif kind == "cash_invoice":
            assert "18%" in words, s
            for i, (qty, item, unit) in enumerate(p["lines"]):
                assert item in texts and frw(unit) in texts, (s, item)
                if i != p["blank"]:
                    assert frw(qty * unit) in texts, s
            assert texts.count("?") == 4, s  # the blank line, the subtotal, the VAT and the total
        else:
            assert frw(p["opening"]) in texts, s
            for day, details, dr, cr in p["rows"]:
                assert details in texts and frw(dr or cr) in texts, (s, details)
            assert texts.count("?") == 1, s


# --- day_book ------------------------------------------------------------------------------------

# Where a day book's total goes, written out here: the account named for the book, on the side the book feeds.
POSTED = {"sales": ("Sales", "Credit"), "purchases": ("Purchases", "Debit"),
          "sales_returns": ("Sales returns", "Debit"), "purchases_returns": ("Purchases returns", "Credit")}


def test_day_book():
    m = fam("day_book")
    kinds = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        kinds[p["kind"]] += 1
        rows = p["rows"]
        assert 5 <= len(rows) <= 8, s
        last = calendar.monthrange(p["year"], p["month"])[1]
        days = [r[0] for r in rows]
        assert days == sorted(days) and all(1 <= d <= last for d in days), s
        numbers = [r[2] for r in rows]
        assert len(set(numbers)) == len(numbers), s
        total = sum(r[4] for r in rows)
        counts = Counter(r[1] for r in rows)
        assert counts[p["repeat"]] >= 2, s  # the person asked about appears more than once
        person = sum(r[4] for r in rows if r[1] == p["repeat"])
        assert person != total, s
        account, side = POSTED[p["kind"]]
        first_names_a_person(qs)
        seen = set()
        for q in qs:
            assert MONTHS[p["month"] - 1] in q.stem, q.stem
            if "Which entry" in q.stem:
                assert q.kind == "mcq" and f"{account.lower()} account" in q.stem.lower()
                assert picked(q) == f"{side}, {frw(total)} Frw", (s, q.options)
                assert sum(o.endswith(f" {frw(total)} Frw") for o in q.options) == 2  # both sides of the right amount
                seen.add("total")
            elif "What total is posted" in q.stem:
                money_ok(q, total)
                seen.add("total")
            elif p["repeat"] in q.stem:
                money_ok(q, person)
                seen.add("person")
            else:
                pytest.fail(f"seed {s}: unrecognised question {q.stem!r}")
        assert seen == {"total", "person"}, (s, seen)
    assert set(kinds) == set(POSTED) and min(kinds.values()) > 100


def test_day_book_shows_every_entry_and_no_total():
    m = fam("day_book")
    for s in range(1, 61):
        p, _ = run(m, s)
        texts = shown_texts(m, p)
        for day, name, number, folio, amount in p["rows"]:
            assert name in texts and number in texts and folio in texts and frw(amount) in texts, (s, name)
        total = sum(r[4] for r in p["rows"])
        person = sum(r[4] for r in p["rows"] if r[1] == p["repeat"])
        amounts = {r[4] for r in p["rows"]}
        for v in (total, person):
            if v not in amounts:
                assert frw(v) not in texts, (s, v)


# --- control_account -----------------------------------------------------------------------------

# The side of a control account each item goes to, written out here; None for an item that does not belong in it.
SIDES = {
    "sales": {"opening": "Dr", "credit_sales": "Dr", "dishonoured": "Dr", "interest": "Dr",
              "receipts": "Cr", "discounts_allowed": "Cr", "sales_returns": "Cr", "irrecoverable": "Cr", "contra": "Cr",
              "cash_sales": None},
    "purchases": {"opening": "Cr", "credit_purchases": "Cr",
                  "payments": "Dr", "discounts_received": "Dr", "purchases_returns": "Dr", "contra": "Dr",
                  "cash_purchases": None},
}


def test_control_account():
    m = fam("control_account")
    forms, kinds = Counter(), Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        kind = p["kind"]
        forms[p["form"]] += 1
        kinds[kind] += 1
        codes = [r[1] for r in p["items"]]
        assert len(set(codes)) == len(codes) and "opening" in codes and "contra" in codes, s
        if kind == "sales":
            assert "irrecoverable" in codes, s
        dr = sum(r[2] for r in p["items"] if SIDES[kind][r[1]] == "Dr")
        cr = sum(r[2] for r in p["items"] if SIDES[kind][r[1]] == "Cr")
        natural = "Debit" if kind == "sales" else "Credit"
        bal = dr - cr if kind == "sales" else cr - dr
        assert bal > 0, s  # receivables are owed to the business; payables are owed by it
        if p["form"] == "account":
            assert all(SIDES[kind][c] for c in codes), s  # nothing out of place is posted to an account
        first_names_a_person(qs)
        name = "sales ledger control account" if kind == "sales" else "purchases ledger control account"
        last = calendar.monthrange(p["year"], p["month"])[1]
        seen = set()
        for q in qs:
            assert name in q.stem, q.stem
            if "carried down" in q.stem:
                assert f"{last} {MONTHS[p['month'] - 1]} {p['year']}" in q.stem
                money_ok(q, bal)
                seen.add("cd")
            elif "brought down" in q.stem:
                nm, ny = next_month(p)
                assert f"1 {nm} {ny}" in q.stem
                assert picked(q) == f"{natural}, {frw(bal)} Frw", (s, q.options)
                other = "Credit" if natural == "Debit" else "Debit"
                assert f"{other}, {frw(bal)} Frw" in q.options  # the side is chosen, not read off the options
                seen.add("bd")
            else:
                pytest.fail(f"seed {s}: unrecognised question {q.stem!r}")
        assert seen == {"cd", "bd"}, (s, seen)
    assert set(forms) == {"account", "list"} and min(forms.values()) > 250
    assert set(kinds) == {"sales", "purchases"} and min(kinds.values()) > 250


def test_control_account_lists_every_item_and_no_balance():
    m = fam("control_account")
    ignored = 0
    for s in range(1, 81):
        p, _ = run(m, s)
        texts = shown_texts(m, p)
        for _, code, amount in p["items"]:
            assert frw(amount) in texts, (s, code)
        ignored += any(SIDES[p["kind"]][c] is None for _, c, _ in p["items"])
        assert "Balance c/d" not in texts, s
        dr = sum(r[2] for r in p["items"] if SIDES[p["kind"]][r[1]] == "Dr")
        cr = sum(r[2] for r in p["items"] if SIDES[p["kind"]][r[1]] == "Cr")
        if abs(dr - cr) not in {r[2] for r in p["items"]}:
            assert frw(abs(dr - cr)) not in texts, s
    assert ignored > 10  # cash sales and cash purchases, which do not belong in it, are listed too


# --- suspense_account ----------------------------------------------------------------------------

# What each kind of error does, written out here: by how much it overstates the debit total and the credit total of
# the trial balance, and by how much the draft profit must be raised (+) or lowered (-) to correct it.
EFFECT = {
    "omit_expense": lambda a, w: (-a, 0, -a),
    "omit_income": lambda a, w: (0, -a, a),
    "expense_as": lambda a, w: (w - a, 0, w - a),
    "income_as": lambda a, w: (0, w - a, a - w),
    "principle_asset": lambda a, w: (0, 0, a),
    "principle_drawings": lambda a, w: (0, 0, a),
    "principle_repairs": lambda a, w: (0, 0, -a),
    "wrong_side_income": lambda a, w: (a, -a, 2 * a),
    "wrong_side_expense": lambda a, w: (-a, a, -2 * a),
}


def test_suspense_account():
    m = fam("suspense_account")
    bands, types = Counter(), Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        bands[p["band"]] += 1
        errors = p["errors"]
        assert len(errors) == (3 if p["band"] == "UP" else 4), s
        effects = [EFFECT[e[0]](e[2], e[3]) for e in errors]
        types.update(e[0] for e in errors)
        if p["band"] == "UP":
            assert not any(e[0].startswith("wrong_side") for e in errors), s
        else:
            assert any(e[0].startswith("wrong_side") for e in errors), s
        # the errors explain the difference exactly: corrected, both columns come to the same true total
        assert p["dr_total"] - sum(e[0] for e in effects) == p["cr_total"] - sum(e[1] for e in effects), s
        assert p["dr_total"] != p["cr_total"], s
        diff = abs(p["dr_total"] - p["cr_total"])
        side = "Debit" if p["dr_total"] < p["cr_total"] else "Credit"  # the short side takes the difference
        profit = p["draft_profit"] + sum(e[2] for e in effects)
        assert profit > 0 and profit != p["draft_profit"], s
        neutral = [i + 1 for i, e in enumerate(effects) if e[0] == e[1] == 0]
        first_names_a_person(qs)
        seen = set()
        for q in qs:
            assert p["trader"] in q.stem, q.stem
            if "suspense account" in q.stem and "opened" in q.stem:
                assert q.kind == "mcq"
                assert picked(q) == f"{side}, {frw(diff)} Frw", (s, q.options)
                other = "Credit" if side == "Debit" else "Debit"
                assert f"{other}, {frw(diff)} Frw" in q.options
                seen.add("suspense")
            elif "corrected profit" in q.stem:
                money_ok(q, profit)
                seen.add("profit")
            elif "does not affect" in q.stem:
                assert len(neutral) == 1, s
                assert picked(q) == f"Error {neutral[0]}", (s, q.options)
                assert set(q.options) <= {f"Error {i + 1}" for i in range(len(errors))}, q.options
                seen.add("neutral")
            else:
                pytest.fail(f"seed {s}: unrecognised question {q.stem!r}")
        assert {"suspense", "profit"} <= seen, (s, seen)
        assert ("neutral" in seen) == (len(neutral) == 1), (s, seen)
    assert set(bands) == {"UP", "AL"} and min(bands.values()) > 250
    assert set(types) == set(EFFECT), types


# The correcting journal entry a student writes for each error, as its effect on the suspense account: (debit to
# suspense, credit to suspense). Worked from the entries, not from the table above, so a sign slip in either shows.
def suspense_entry(kind, a, w):
    if kind == "omit_expense":          # Dr the expense, Cr suspense
        return 0, a
    if kind == "omit_income":           # Dr suspense, Cr the income
        return a, 0
    if kind == "expense_as":            # too much debited: Dr suspense, Cr the expense (or the reverse when too little)
        return (w - a, 0) if w > a else (0, a - w)
    if kind == "income_as":             # too much credited: Dr the income, Cr suspense (or the reverse)
        return (0, w - a) if w > a else (a - w, 0)
    if kind == "wrong_side_income":     # debited instead of credited: Dr suspense, Cr the income, twice the amount
        return 2 * a, 0
    if kind == "wrong_side_expense":    # credited instead of debited: Dr the expense, Cr suspense, twice the amount
        return 0, 2 * a
    assert kind.startswith("principle"), kind
    return 0, 0                         # two ledger accounts swapped: the suspense account is not touched


def test_suspense_account_is_cleared_exactly_by_the_listed_errors():
    """A textbook question's errors clear the suspense account: its opening balance (the difference, on the short
    side), with every correcting entry posted, comes to nothing (P3y blind review)."""
    m = fam("suspense_account")
    for s in SEEDS:
        p, _ = run(m, s)
        diff = abs(p["dr_total"] - p["cr_total"])
        dr, cr = (diff, 0) if p["dr_total"] < p["cr_total"] else (0, diff)  # opened on the side of the smaller total
        for kind, _, a, w in p["errors"]:
            d, c = suspense_entry(kind, a, w)
            dr, cr = dr + d, cr + c
        assert dr == cr, (s, p["dr_total"], p["cr_total"], p["errors"], dr, cr)
        # and the trial balance agrees once corrected: every error that moves a total is listed
        touched = [e for e in p["errors"] if suspense_entry(e[0], e[2], e[3]) != (0, 0)]
        assert len(touched) >= 2, s


def test_suspense_account_errors_say_the_other_entry_was_right():
    """Read alone, "posted to the rent account as 64 000" could mean both entries were wrong; the figure says each
    error is in the one account it names."""
    m = fam("suspense_account")
    for s in range(1, 21):
        p, _ = run(m, s)
        words = " ".join(shown_texts(m, p))
        assert "other half of the double entry was correct" in words, s
        for kind, _, _, _ in p["errors"]:
            if kind.startswith("wrong_side"):
                assert "instead of the" in words, s


def test_suspense_account_prints_the_totals_the_profit_and_each_error():
    m = fam("suspense_account")
    for s in range(1, 61):
        p, _ = run(m, s)
        texts = shown_texts(m, p)
        words = " ".join(texts)
        for v in (p["dr_total"], p["cr_total"], p["draft_profit"]):
            assert frw(v) in words, (s, v)
        for i, (kind, account, a, w) in enumerate(p["errors"]):
            assert f"{frw(a)} Frw" in words and account.lower() in words.lower(), (s, kind)
            if w is not None:
                assert f"{frw(w)} Frw" in words, (s, kind)
        diff = abs(p["dr_total"] - p["cr_total"])
        # the difference is the student's to find: printed nowhere as a whole amount
        assert not re.search(rf"(?<!\d)(?<!\d ){frw(diff)}(?!\d)(?! \d)", words), s


# --- accounting_equation -------------------------------------------------------------------------

# What each transaction does, written out here: the change to each asset and liability it touches.
CHANGES = {
    "drawings_cash": lambda a, b: ({"Cash": -a}, {}),
    "capital_bank": lambda a, b: ({"Bank": a}, {}),
    "buy_credit": lambda a, b: ({"Inventory": a}, {"Trade payables": a}),
    "pay_supplier": lambda a, b: ({"Bank": -a}, {"Trade payables": -a}),
    "buy_equipment": lambda a, b: ({"Equipment": a, "Bank": -a}, {}),
    "loan": lambda a, b: ({"Bank": a}, {"Bank loan": a}),
    "receive_debtor": lambda a, b: ({"Bank": a, "Trade receivables": -a}, {}),
    "sell_goods": lambda a, b: ({"Inventory": -a, "Cash": b}, {}),
    "goods_own_use": lambda a, b: ({"Inventory": -a}, {}),
}


def test_accounting_equation():
    m = fam("accounting_equation")
    bands, events, blanks = Counter(), Counter(), Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        bands[p["band"]] += 1
        assets, liabilities = dict(p["assets"]), dict(p["liabilities"])
        assert len(assets) == len(p["assets"]) and len(liabilities) == len(p["liabilities"]), s
        capital = sum(assets.values()) - sum(liabilities.values())
        assert capital == p["capital"] and capital > 0, s
        kind, a, b = p["event"]
        events[kind] += 1
        if p["band"] == "LS":
            assert kind not in ("sell_goods", "goods_own_use"), s
        da, dl = CHANGES[kind](a, b)
        for name, d in da.items():
            assert name in assets and assets[name] + d >= 0, (s, kind, name)
        for name, d in dl.items():
            assert name in liabilities and liabilities[name] + d >= 0, (s, kind, name)
        new_capital = (sum(assets.values()) + sum(da.values())) - (sum(liabilities.values()) + sum(dl.values()))
        where = p["blank"]
        blanks[where[0]] += 1
        missing = capital if where[0] == "capital" else p[where[0]][where[1]][1]
        first_names_a_person(qs)
        seen = set()
        for q in qs:
            assert p["owner"] in q.stem, q.stem
            if "missing figure" in q.stem:
                name = "capital" if where[0] == "capital" else p[where[0]][where[1]][0]
                assert name.lower() in q.stem.lower(), (q.stem, name)
                money_ok(q, missing)
                seen.add("blank")
            elif "capital after" in q.stem:
                amount_ok(q, new_capital)
                seen.add("capital")
            else:
                pytest.fail(f"seed {s}: unrecognised question {q.stem!r}")
        assert seen == {"blank", "capital"}, (s, seen)
    assert set(bands) == {"LS", "UP"} and min(bands.values()) > 250
    assert set(events) == set(CHANGES), events
    assert set(blanks) == {"capital", "assets", "liabilities"}
    # a transaction that leaves capital as it was is asked often: the trap is to change it
    assert sum(events[k] for k in ("buy_credit", "pay_supplier", "buy_equipment", "loan", "receive_debtor")) > 250


def test_accounting_equation_prints_all_but_the_blank():
    m = fam("accounting_equation")
    for s in range(1, 61):
        p, _ = run(m, s)
        texts = shown_texts(m, p)
        words = " ".join(texts)
        where = p["blank"]
        for part in ("assets", "liabilities"):
            for i, (name, v) in enumerate(p[part]):
                assert name in texts, (s, name)
                if where != [part, i]:
                    assert frw(v) in texts, (s, name)
        if where[0] != "capital":
            assert frw(p["capital"]) in texts, s
        assert texts.count("?") == 1, s
        kind, a, b = p["event"]
        assert f"{frw(a)} Frw" in words, s  # the transaction is printed with its amount
        if b:
            assert f"{frw(b)} Frw" in words, s
        assert "Assets = Liabilities + Capital" in words, s  # the equation is stated


# --- all six -------------------------------------------------------------------------------------

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
                k = re.sub(r"\d+", "#", q.stem.rsplit(". ", 1)[-1])
                seen[k] += 1
                hits[k] += _central(q.options) == int(q.answer)
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
    """The app shows one question with the figure: no stem leans on another ("that account", "the same")."""
    m = fam(fid)
    for s in range(1, 201):
        _, qs = run(m, s)
        for q in qs:
            low = q.stem.lower()
            assert not re.search(r"\b(that|the same|above|previous|this) (account|amount|invoice|figure|answer|balance|customer|supplier)\b", low), q.stem


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
