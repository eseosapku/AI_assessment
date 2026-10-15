"""Business documents (UP, LS), laid out as Cambridge IGCSE Accounting 0452 (chapter 6) and Rwanda's S4 Financial
Accounting book ("Accounting Source Documents") show them: a header with the seller, the buyer, the document's number
and date, a numbered table of goods, and the totals. Four sub-types:

- an invoice (UP): quantities, unit prices and line amounts, their total, then "Less trade discount d%", "Net amount",
  "Add VAT at 18%" and "Total amount due" left as "?". Asks the net amount, the VAT and the total due.
- a simple invoice (LS, for Rwanda's S2 Entrepreneurship "Source documents" and "Documents used for taxation"): no
  trade discount; one line's amount, the total before VAT, the VAT at 18% and the total due left as "?". Asks the
  line's amount, the total before VAT and the total due.
- a credit note (UP) for goods returned: priced as an invoice is, against an invoice whose number and total are printed
  on it. Asks the total credited and what is still owed on the invoice.
- a statement of account (UP): the opening balance, then invoices (debit), credit notes, payments received and
  discounts allowed (credit), with the balance column left to the student. Asks the closing balance, the balance after
  a dated line, and what is owed after a later payment named in the stem.

Every amount is whole francs: a gross total in whole thousands keeps the trade discount, the net amount and the VAT at
18% whole (18% of a multiple of 50 is whole).
"""
from __future__ import annotations

import calendar
import random

from ..core import GRID, INK, NAMES, mcq, money, short
from ._accounts import MONTHS, PLACES, SHORT_MONTHS, SUPPLIERS, TOWNS, YEARS, article, frw, page, rule
from .econ_tables import fit

ID = "business_document"
KIND = "business.document"
SUBJECT = "accounting"
BANDS = ("UP", "LS")
CONCEPTS = ("accounting.business-documents", "accounting.invoice-and-related-documents", "accounting.discounts-in-accounting")
# Rwanda's Entrepreneurship books teach source documents under business (S2 "Initial accounting entries", S5 prime
# books), and the VAT on an invoice under their tax chapters (S2 "Taxes in Rwanda", S6 "Taxes and Customs Procedures").
ALSO = ("business.prime-books-and-source-documents", "business.taxation")
# A topic whose sections the book lists is reached only if one names these documents, or VAT worked on a document.
NEEDS = (r"invoice|credit note|statement of account|source documents?|business documents|documents used for taxation|"
         r"computation of VAT")
AVOID = r"journal|petty cash|ledger|reconcil|control account|labou?r|coding|inventory|registration|law|finance"


def concepts_for(p: dict) -> tuple[str, ...]:
    """A statement of account carries no trade discount."""
    return CONCEPTS[:2] if p["kind"] == "statement" else CONCEPTS


def avoid_for(p: dict) -> str:
    """A statement of account has no VAT on it: no tax chapter for it."""
    return AVOID + r"|\btax" if p["kind"] == "statement" else AVOID


# What each kind of shop buys from a wholesaler: (goods, lowest and highest unit price, step).
GOODS = {
    "hardware shop": [("bags of cement", 9_000, 13_000, 500), ("iron sheets", 7_000, 12_000, 500),
                      ("tins of paint", 15_000, 32_000, 1_000), ("boxes of nails", 3_000, 7_000, 500),
                      ("door locks", 6_000, 15_000, 500)],
    "bakery": [("bags of wheat flour", 38_000, 55_000, 1_000), ("bags of sugar", 45_000, 65_000, 1_000),
               ("tins of margarine", 14_000, 24_000, 1_000), ("trays of eggs", 3_000, 4_500, 100),
               ("packets of yeast", 1_500, 3_500, 100)],
    "pharmacy": [("boxes of paracetamol", 2_500, 6_000, 100), ("bottles of cough syrup", 1_800, 4_500, 100),
                 ("packs of bandages", 1_200, 3_000, 100), ("boxes of gloves", 4_000, 9_000, 500),
                 ("thermometers", 3_000, 8_000, 500)],
    "stationery shop": [("reams of paper", 4_500, 7_000, 100), ("boxes of pens", 2_500, 5_000, 100),
                        ("packs of exercise books", 6_000, 12_000, 500), ("calculators", 8_000, 16_000, 500),
                        ("boxes of chalk", 1_500, 3_500, 100)],
    "grocery": [("bags of rice", 28_000, 42_000, 1_000), ("jerrycans of cooking oil", 30_000, 48_000, 1_000),
                ("bags of beans", 22_000, 35_000, 1_000), ("cartons of soap", 15_000, 25_000, 500),
                ("cartons of matches", 4_000, 7_000, 500)],
    "phone shop": [("phone chargers", 2_500, 6_000, 100), ("earphones", 2_000, 5_000, 100),
                   ("phone covers", 1_000, 3_000, 100), ("memory cards", 4_000, 9_000, 500),
                   ("power banks", 9_000, 18_000, 500)],
    "shoe shop": [("pairs of school shoes", 9_000, 16_000, 500), ("pairs of sandals", 3_000, 7_000, 500),
                  ("pairs of sports shoes", 15_000, 30_000, 1_000), ("tins of shoe polish", 800, 2_000, 100)],
    "tailoring workshop": [("metres of cotton cloth", 2_000, 4_500, 100), ("spools of thread", 500, 1_500, 100),
                           ("packets of buttons", 800, 2_000, 100), ("metres of kitenge", 3_000, 6_000, 100)],
}
SHOP_WORD = {"hardware shop": "Hardware", "bakery": "Bakery", "pharmacy": "Pharmacy", "stationery shop": "Stationers",
             "grocery": "Grocers", "phone shop": "Mobile Shop", "shoe shop": "Shoes", "tailoring workshop": "Tailors"}
DISCOUNTS = [5, 10, 15, 20, 25]
REASONS = ["damaged", "the wrong size", "past their expiry date", "not ordered", "faulty"]
PAID = ["Payment received, thank you", "Bank transfer received", "Mobile money received", "Cheque received"]
KINDS = {"invoice": 3, "cash_invoice": 3, "credit_note": 2, "statement": 3}


def _priced(lines, pct):
    gross = sum(q * u for q, _, u in lines)
    disc = gross * pct // 100
    net = gross - disc
    vat = net * 18 // 100
    return gross, disc, net, vat, net + vat


def _whole(lines, pct) -> bool:
    gross = sum(q * u for q, _, u in lines)
    return gross * pct % 100 == 0 and (gross - gross * pct // 100) * 18 % 100 == 0


def _lines(rng, trade: str, n: int, qty: tuple[int, int]):
    goods = rng.sample(GOODS[trade], n)
    return [[rng.randint(*qty), g, rng.randrange(lo, hi + 1, step)] for g, lo, hi, step in goods]


def _parties(rng):
    trade = rng.choice(list(GOODS))
    town = rng.choice(TOWNS)
    place = rng.choice(PLACES) if town == "Kigali" else town
    seller = rng.choice(SUPPLIERS)
    where = seller.split()[0]  # a wholesaler is named for where it trades
    return {"customer": f"{place} {SHOP_WORD[trade]}", "business": f"{article(trade)} {trade} in {town}",
            "address": f"{place}, {town}" if place != town else town, "trade": trade, "seller": seller,
            "seller_address": where if where in TOWNS else f"{where}, Kigali"}


def sample(rng: random.Random) -> dict:
    kind = rng.choices(list(KINDS), weights=list(KINDS.values()))[0]
    year, month = rng.choice(YEARS), rng.randint(1, 12)
    last = calendar.monthrange(year, month)[1]
    base = {"kind": kind, "year": year, "month": month, **_parties(rng)}
    while True:
        if kind == "invoice":
            lines = _lines(rng, base["trade"], rng.randint(2, 4), (3, 30))
            pct = rng.choice(DISCOUNTS)
            if not _whole(lines, pct):
                continue
            gross, disc, net, vat, due = _priced(lines, pct)
            shown = {u for _, _, u in lines} | {q * u for q, _, u in lines} | {gross}
            if len({disc, net, vat, due}) < 4 or shown & {disc, net, vat, due}:
                continue
            return {"band": "UP", **base, "number": f"{rng.randrange(120, 9900):04d}", "day": rng.randint(2, last - 1),
                    "lines": lines, "discount": pct}
        if kind == "cash_invoice":
            lines = _lines(rng, base["trade"], rng.randint(3, 4), (2, 12))
            amounts = [q * u for q, _, u in lines]
            sub = sum(amounts)
            if sub * 18 % 100:
                continue
            blank = rng.randrange(len(lines))
            vat = sub * 18 // 100
            shown = {u for _, _, u in lines} | {a for i, a in enumerate(amounts) if i != blank}
            if len(set(amounts)) < len(amounts) or shown & {amounts[blank], sub, vat, sub + vat}:
                continue
            return {"band": "LS", **base, "number": f"{rng.randrange(120, 9900):04d}", "day": rng.randint(2, last - 1),
                    "lines": lines, "blank": blank}
        if kind == "credit_note":
            lines = _lines(rng, base["trade"], rng.randint(1, 2), (2, 8))
            pct = rng.choice(DISCOUNTS)
            if not _whole(lines, pct):
                continue
            gross, disc, net, vat, credited = _priced(lines, pct)
            # the invoice the goods came on: several times what is sent back, its total as the invoice printed it
            invoice_total = round(credited * rng.uniform(3, 9) / 100) * 100
            owed = invoice_total - credited
            shown = {u for _, _, u in lines} | {q * u for q, _, u in lines} | {gross, invoice_total}
            if len({disc, net, vat, credited, owed}) < 5 or shown & {disc, net, vat, credited, owed}:
                continue
            day = rng.randint(8, last - 1)
            inv_day = rng.randint(1, day - 5)
            return {"band": "UP", **base, "number": f"CN {rng.randrange(11, 99):03d}", "day": day, "lines": lines,
                    "discount": pct, "reason": rng.choice(REASONS), "invoice_no": f"{rng.randrange(120, 9900):04d}",
                    "invoice_day": inv_day, "invoice_total": invoice_total}
        # a statement of account for the month
        opening = rng.randrange(60_000, 600_001, 5_000)
        events = [["inv", rng.randrange(80_000, 900_001, 1_000)]]
        if rng.random() < 0.7:
            events.append(["inv", rng.randrange(80_000, 900_001, 1_000)])
        if rng.random() < 0.6:
            events.append(["cn", rng.randrange(5_000, 60_001, 500)])
        disc = opening // 20 if opening % 20_000 == 0 and rng.random() < 0.6 else 0
        rng.shuffle(events)
        days = sorted(rng.sample(range(2, last), len(events) + 1))
        pay_day = days.pop(rng.randrange(len(days) - 1))  # the old balance is settled before the month's last line
        rows, first_inv = [], None
        numbers = iter(range(rng.randrange(150, 9000), 10_000, rng.randint(3, 17)))
        cn_numbers = iter(range(rng.randrange(11, 80), 1000, rng.randint(1, 4)))
        events_by_day = list(zip(days, events))
        for day, (what, amount) in events_by_day:
            if what == "inv":
                no = f"{next(numbers):04d}"
                first_inv = first_inv or no
                rows.append([day, f"Invoice {no}", amount, 0])
            elif first_inv is None:
                rows.append([day, f"Goods returned (credit note CN {next(cn_numbers):03d})", 0, amount])
            else:
                rows.append([day, f"Credit note CN {next(cn_numbers):03d}", 0, amount])
        rows.append([pay_day, rng.choice(PAID), 0, opening - disc])
        if disc:
            rows.append([pay_day, "Discount allowed", 0, disc])
        rows.sort(key=lambda r: (r[0], r[1].startswith("Discount")))
        bal, ok, after = opening, True, {}
        for r in rows:
            bal += r[2] - r[3]
            ok = ok and bal > 0
            after[(r[0], r[1])] = bal
        closing = bal
        amounts = [opening] + [r[2] or r[3] for r in rows]
        if not ok or closing < 50_000 or len(set(amounts)) < len(amounts) or closing in amounts:
            continue
        # a line that takes something off, the last on its day: its balance is the day's
        mids = [r for r, nxt in zip(rows, rows[1:]) if r[3] and not r[1].startswith("Discount") and nxt[0] != r[0]]
        mid = rng.choice(mids) if mids else None
        if mid and (after[(mid[0], mid[1])] in amounts or after[(mid[0], mid[1])] == closing):
            continue
        payment = round(closing * rng.uniform(0.3, 0.8) / 5_000) * 5_000
        if not 0 < payment < closing or closing - payment in amounts:
            continue
        return {"band": "UP", **base, "opening": opening, "rows": rows, "mid": [mid[0], mid[1]] if mid else None,
                "payment": payment}


X0, FS = 0.14, 10


def _header(ax, p: dict, width: float, top: float, title: str, number: str | None, date: str) -> float:
    """The seller and the document's name at the top, the buyer under them; returns where the table starts."""
    ax.text(X0, top, p["seller"], ha="left", va="top", fontsize=12, fontweight="bold")
    ax.text(X0, top - 0.3, p["seller_address"], ha="left", va="top", fontsize=9.5, color="#333333")
    ax.text(width - X0, top, title, ha="right", va="top", fontsize=13, fontweight="bold")
    y = top - 0.32
    if number:
        ax.text(width - X0, y, f"No. {number}", ha="right", va="top", fontsize=FS)
        y -= 0.26
    ax.text(width - X0, y, f"Date: {date}", ha="right", va="top", fontsize=FS)
    ax.text(X0, top - 0.72, f"To: {p['customer']}, {p['address']}", ha="left", va="top", fontsize=FS)
    rule(ax, X0, width - X0, top - 1.04, width=1.2)
    return top - 1.16


def _goods_table(ax, p: dict, width: float, top: float, widths, lines, blank=None) -> float:
    """The numbered table of goods; returns the y of its bottom rule."""
    heads = ["No.", "Quantity", "Description", "Unit price\nFrw", "Amount\nFrw"]
    xs = [X0]
    for w in widths:
        xs.append(xs[-1] + w)
    hh, rh = 0.5, 0.3
    for j, h in enumerate(heads):
        ax.text(xs[j] + widths[j] / 2, top - hh / 2, h, ha="center", va="center", fontsize=9.5, fontweight="bold",
                linespacing=1.1)
    rule(ax, X0, xs[-1], top, width=0.9)
    rule(ax, X0, xs[-1], top - hh, width=0.9)
    for i, (qty, item, unit) in enumerate(lines):
        y = top - hh - (i + 0.5) * rh
        ax.text(xs[0] + widths[0] / 2, y, str(i + 1), ha="center", va="center", fontsize=FS)
        ax.text(xs[2] - 0.12, y, str(qty), ha="right", va="center", fontsize=FS)
        ax.text(xs[2] + 0.1, y, item, ha="left", va="center", fontsize=FS)
        ax.text(xs[4] - 0.1, y, frw(unit), ha="right", va="center", fontsize=FS)
        amount = "?" if i == blank else frw(qty * unit)
        ax.text(xs[5] - 0.1, y, amount, ha="right", va="center", fontsize=FS, fontweight="bold" if i == blank else "normal")
    bottom = top - hh - len(lines) * rh - 0.06
    rule(ax, X0, xs[-1], bottom, width=0.9)
    for j, x in enumerate(xs):
        ax.plot([x, x], [top, bottom], color=INK if j in (0, len(xs) - 1) else GRID, linewidth=0.9)
    return bottom


def _totals(ax, x_amount: float, x_label: float, top: float, lines) -> float:
    """Summary lines under the amount column: (label, amount or "?", ruled above, double ruled below)."""
    rh = 0.3
    for i, (label, value, above, double) in enumerate(lines):
        y = top - (i + 0.6) * rh
        bold = "bold" if double or value == "?" else "normal"
        ax.text(x_label, y, label, ha="right", va="center", fontsize=FS, fontweight="bold" if double else "normal")
        ax.text(x_amount - 0.1, y, value if value == "?" else frw(value), ha="right", va="center", fontsize=FS,
                fontweight=bold)
        if above:
            rule(ax, x_amount - 1.05, x_amount - 0.04, y + rh / 2, width=0.8)
        if double:
            rule(ax, x_amount - 1.05, x_amount - 0.04, y - rh / 2 + 0.02, width=0.8, double=True)
    return top - len(lines) * rh - 0.1


def _date(p: dict, day: int) -> str:
    return f"{day} {MONTHS[p['month'] - 1]} {p['year']}"


def _priced_document(p: dict, title: str, number: str, date: str, notes: list[str], summary):
    widths = [0.5, 0.92, fit(*(ln[1] for ln in p["lines"]), size=FS, bold=False, least=2.5, pad=0.3), 1.12, 1.25]
    width = 2 * X0 + sum(widths)
    height = 1.3 + 0.5 + 0.3 * len(p["lines"]) + 0.1 + 0.3 * len(summary) + 0.15 + 0.3 * len(notes) + 0.15
    fig, ax = page(width, height)
    top = _header(ax, p, width, height - 0.12, title, number, date)
    bottom = _goods_table(ax, p, width, top, widths, p["lines"], p.get("blank"))
    x_amount = width - X0
    y = _totals(ax, x_amount, x_amount - widths[-1] - 0.15, bottom, summary)
    for i, note in enumerate(notes):
        ax.text(X0, y - 0.05 - i * 0.3, note, ha="left", va="top", fontsize=9.5, style="italic")
    return fig


def draw(p: dict):
    kind = p["kind"]
    if kind == "invoice":
        gross = sum(q * u for q, _, u in p["lines"])
        summary = [("Total", gross, False, False), (f"Less trade discount {p['discount']}%", "?", False, False),
                   ("Net amount", "?", True, False), ("Add VAT at 18%", "?", False, False),
                   ("Total amount due", "?", True, True)]
        return _priced_document(p, "INVOICE", p["number"], _date(p, p["day"]), ["Terms: payment within 30 days"], summary)
    if kind == "cash_invoice":
        summary = [("Total before VAT", "?", False, False), ("VAT at 18%", "?", False, False),
                   ("Total amount due", "?", True, True)]
        return _priced_document(p, "INVOICE", p["number"], _date(p, p["day"]), ["VAT is charged at 18% of the total before VAT."],
                                summary)
    if kind == "credit_note":
        gross = sum(q * u for q, _, u in p["lines"])
        summary = [("Total", gross, False, False), (f"Less trade discount {p['discount']}%", "?", False, False),
                   ("Net amount", "?", True, False), ("Add VAT at 18%", "?", False, False),
                   ("Total credited", "?", True, True)]
        notes = [f"Goods returned: {p['reason']}.",
                 f"Re: our invoice no. {p['invoice_no']} of {_date(p, p['invoice_day'])}, total due {frw(p['invoice_total'])} Frw"]
        return _priced_document(p, "CREDIT NOTE", p["number"], _date(p, p["day"]), notes, summary)
    return _statement(p)


def _statement(p: dict):
    last = calendar.monthrange(p["year"], p["month"])[1]
    details = ["Balance", "Amount now due"] + [r[1] for r in p["rows"]]
    widths = [0.82, fit(*details, size=FS, bold=False, least=2.4, pad=0.3), 1.12, 1.12, 1.2]
    width = 2 * X0 + sum(widths)
    n = len(p["rows"]) + 2
    rh, hh = 0.3, 0.5
    height = 1.3 + hh + n * rh + 0.2 + 0.4
    fig, ax = page(width, height)
    top = _header(ax, p, width, height - 0.12, "STATEMENT OF ACCOUNT", None, _date(p, last))
    heads = ["Date", "Details", "Debit\nFrw", "Credit\nFrw", "Balance\nFrw"]
    xs = [X0]
    for w in widths:
        xs.append(xs[-1] + w)
    for j, h in enumerate(heads):
        ax.text(xs[j] + widths[j] / 2, top - hh / 2, h, ha="center", va="center", fontsize=9.5, fontweight="bold",
                linespacing=1.1)
    rule(ax, X0, xs[-1], top, width=0.9)
    rule(ax, X0, xs[-1], top - hh, width=0.9)
    mon = SHORT_MONTHS[p["month"] - 1]
    lines = [[1, "Balance", 0, 0, frw(p["opening"])]] + [[d, t, dr, cr, ""] for d, t, dr, cr in p["rows"]]
    lines.append([last, "Amount now due", 0, 0, "?"])
    for i, (day, text, dr, cr, bal) in enumerate(lines):
        y = top - hh - (i + 0.5) * rh
        ax.text(xs[0] + 0.08, y, f"{mon} {day}", ha="left", va="center", fontsize=FS)
        ax.text(xs[1] + 0.1, y, text, ha="left", va="center", fontsize=FS,
                fontweight="bold" if text == "Amount now due" else "normal")
        if dr:
            ax.text(xs[3] - 0.1, y, frw(dr), ha="right", va="center", fontsize=FS)
        if cr:
            ax.text(xs[4] - 0.1, y, frw(cr), ha="right", va="center", fontsize=FS)
        if bal:
            ax.text(xs[5] - 0.1, y, bal, ha="right", va="center", fontsize=FS, fontweight="bold" if bal == "?" else "normal")
    bottom = top - hh - n * rh - 0.06
    rule(ax, X0, xs[-1], bottom, width=0.9)
    for j, x in enumerate(xs):
        ax.plot([x, x], [top, bottom], color=INK if j in (0, len(xs) - 1) else GRID, linewidth=0.9)
    ax.text(X0, bottom - 0.1, "Debit: an amount the customer owes more; credit: an amount taken off what is owed.",
            ha="left", va="top", fontsize=9, style="italic", color="#333333")
    return fig


def _of(name: str) -> str:
    """A business's possessive: "Huye Bakery's", "Huye Tailors'"."""
    return name + ("'" if name.endswith("s") else "'s")


ROLE = ["keeps the books of", "is the bookkeeper at", "works in the office of", "checks the paperwork for"]


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    kind, cust, seller = p["kind"], p["customer"], p["seller"]
    intro = f"{who} {rng.choice(ROLE)} {cust}, {p['business']}."
    if kind == "invoice":
        gross, disc, net, vat, due = _priced(p["lines"], p["discount"])
        no = p["number"]
        # the slips: the discount forgotten, the VAT forgotten, the VAT worked on the total before the discount
        slips = [gross + gross * 18 // 100, net, net + gross * 18 // 100, gross - disc - vat]
        return [short(f"{intro} Invoice no. {no} arrives from {seller}. What is the net amount of invoice no. {no} after "
                      "the trade discount?", net, money(net)),
                short(f"How much VAT at 18% is charged on invoice no. {no} from {seller}?", vat, money(vat)),
                mcq(f"What is the total amount due on invoice no. {no} from {seller} to {cust}?", f"{frw(due)} Frw",
                    [f"{frw(v)} Frw" for v in slips if v > 0], rng)]
    if kind == "cash_invoice":
        qty, item, unit = p["lines"][p["blank"]]
        sub = sum(q * u for q, _, u in p["lines"])
        due = sub + sub * 18 // 100
        no = p["number"]
        return [short(f"{who} buys goods for {cust} from {seller} and is given invoice no. {no}. "
                      f"What is the amount for the {qty} {item} on invoice no. {no}?", qty * unit, money(qty * unit)),
                short(f"What is the total of invoice no. {no} from {seller} before VAT is added?", sub, money(sub)),
                short(f"With VAT at 18%, what is the total amount due on invoice no. {no} from {seller}?", due, money(due))]
    if kind == "credit_note":
        gross, disc, net, vat, credited = _priced(p["lines"], p["discount"])
        no, inv = p["number"], p["invoice_no"]
        owed = p["invoice_total"] - credited
        slips = [p["invoice_total"] - net, p["invoice_total"] + credited, p["invoice_total"] - gross]
        return [short(f"{intro} Credit note no. {no} arrives from {seller} for goods returned. What is the total amount "
                      f"credited on credit note no. {no}, VAT included?", credited, money(credited)),
                mcq(f"Credit note no. {no} from {seller} is set against invoice no. {inv}. How much does {cust} still owe "
                    f"on invoice no. {inv}?", f"{frw(owed)} Frw", [f"{frw(v)} Frw" for v in slips if v > 0], rng)]
    # a statement of account
    month, year = MONTHS[p["month"] - 1], p["year"]
    bal, after = p["opening"], {}
    for d, t, dr, cr in p["rows"]:
        bal += dr - cr
        after[(d, t)] = bal
    nm, ny = MONTHS[p["month"] % 12], year + (p["month"] == 12)
    out = [short(f"{intro} A statement of account for {month} {year} arrives from {seller}. What balance does {cust} "
                 f"owe {seller} at the end of {month} {year}?", bal, money(bal))]
    if p["mid"] and rng.random() < 0.5:
        d, t = p["mid"]
        v = after[(d, t)]
        out.append(short(f"On {_of(cust)} statement of account from {seller}, what is the balance after the line "
                         f"\"{t}\" on {d} {month}?", v, money(v)))
    else:
        pay = p["payment"]
        left = bal - pay
        out.append(short(f"On {rng.randint(2, 9)} {nm} {ny}, {cust} pays {frw(pay)} Frw towards the amount due on the "
                         f"{month} statement from {seller}. How much does {cust} still owe {seller}?", left, money(left)))
    return out
