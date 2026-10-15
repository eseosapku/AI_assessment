"""Payslips (UP; LS): a Rwandan employee's payslip for one month, laid out as a payslip is: the employer, the month,
the employee's name, job and number, the earnings (basic salary and allowances) and the deductions, with the gross
pay, PAYE, the pension contribution and the net pay left as "?". Beside it, the monthly PAYE band table the slip
uses, printed in full, so no question relies on the student knowing Rwanda's current rates. Two sub-types: Upper
Secondary (Taxation S4, Entrepreneurship S6), with two or three allowances, three or four bands and a pension
contribution at a printed percentage of gross pay; Lower Secondary (Entrepreneurship S2 "Taxes in Rwanda"), with one
allowance, two bands and no pension.

Gross pay, the PAYE (band by band on gross pay, as the slip says), the pension contribution (UP), and net pay. Every
amount is a whole number of francs: earnings in thousands, rates in whole percentages.
"""
from __future__ import annotations

import random

from matplotlib.patches import Rectangle

from ..core import INK, NAMES, article, money, new_figure, short

ID = "payslip"
KIND = "business.document"
SUBJECT = "business"
BANDS = ("UP", "LS")
CONCEPTS = ("business.taxation",)
# Rwanda Taxation S4 teaches the payslip under "Taxation of Employment Income", mapped to labour payment.
ALSO = ("accounting.taxation-employment-income", "accounting.labour-payment-methods")
# A topic whose sections the book lists is reached only if one names what this figure teaches.
NEEDS = r"income tax|employment income|\bPAYE\b|pay ?slip|payroll|\bRSSB\b|taxes in rwanda|types of taxes"
# Listed with sections that share the tax concepts but teach other taxes.
AVOID = r"depreciation|investment income"

MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October",
          "November", "December"]
SURNAMES = ["Niyonzima", "Uwimana", "Mukamana", "Nsengiyumva", "Hakizimana", "Uwamahoro", "Niyitegeka", "Mukeshimana",
            "Bizimana", "Uwineza"]
# (employer, the job, basic salary range in thousands of francs)
EMPLOYERS = [
    ("Huye Bakery Ltd", "Baker", (80, 250)),
    ("Rubavu Lakeside Hotel", "Receptionist", (100, 300)),
    ("Musanze Furniture Works", "Carpenter", (90, 280)),
    ("Kigali Bus Services", "Driver", (120, 320)),
    ("Nyagatare Dairy Ltd", "Machine Operator", (100, 260)),
    ("Muhanga Printing Press", "Designer", (150, 400)),
    ("Rwamagana Juice Ltd", "Accounts Clerk", (120, 350)),
    ("Nyamasheke Coffee Station", "Quality Officer", (140, 380)),
]
ALLOWANCES = [("Transport allowance", (10, 40)), ("Housing allowance", (20, 80)), ("Overtime", (5, 30)),
              ("Lunch allowance", (10, 30))]
# PAYE bands: [from, to (None: no limit), rate %]. Illustrative tables, each printed in full on the figure.
UP_BANDS = [
    [[0, 60000, 0], [60000, 100000, 10], [100000, 200000, 20], [200000, None, 30]],
    [[0, 30000, 0], [30000, 100000, 20], [100000, None, 30]],
    [[0, 50000, 0], [50000, 150000, 15], [150000, None, 25]],
    [[0, 60000, 0], [60000, 150000, 15], [150000, 300000, 25], [300000, None, 30]],
]
LS_BANDS = [[[0, 60000, 0], [60000, None, 10]], [[0, 30000, 0], [30000, None, 20]], [[0, 50000, 0], [50000, None, 15]]]
PENSIONS = [3, 5, 6]


def fr(n: int) -> str:
    return f"{n:,}".replace(",", " ")


def paye(gross: int, bands: list) -> int:
    return sum((min(gross, hi if hi is not None else gross) - lo) * rate for lo, hi, rate in bands if gross > lo) // 100


def sample(rng: random.Random) -> dict:
    employer, job, (lo, hi) = rng.choice(EMPLOYERS)
    band = "UP" if rng.random() < 0.7 else "LS"
    while True:
        if band == "UP":
            basic = 1000 * rng.randrange(lo, hi + 1, 5)
            extras = rng.sample(ALLOWANCES, rng.randint(2, 3))
        else:
            basic = 1000 * rng.randrange(max(50, lo - 30), min(hi, 180) + 1, 5)
            extras = rng.sample(ALLOWANCES, 1)
        earnings = [["Basic salary", basic]] + [[name, 1000 * rng.randrange(a, b + 1, 5)] for name, (a, b) in extras]
        gross = sum(a for _, a in earnings)
        bands = rng.choice(UP_BANDS if band == "UP" else LS_BANDS)
        if gross <= bands[1][0]:
            continue
        if band == "UP" and len(bands) == 4 and gross <= bands[2][0]:
            continue  # a four-band table is used where the pay reaches its third band
        return {"band": band, "employer": employer, "job": job, "employee": [rng.choice(NAMES), rng.choice(SURNAMES)],
                "number": f"{rng.randint(100, 999):04d}", "month": rng.choice(MONTHS), "year": rng.randint(2024, 2026),
                "earnings": earnings, "bands": bands, "pension": rng.choice(PENSIONS) if band == "UP" else 0}


def _band_text(lo: int, hi, first: bool) -> str:
    if hi is None:
        return f"Above {fr(lo)}"
    return f"First {fr(hi)}" if first else f"{fr(lo + 1)} – {fr(hi)}"


def draw(p: dict):
    fig, ax = new_figure(10.0, 5.4)
    fig.subplots_adjust(left=0, right=1, bottom=0, top=1)
    first, surname = p["employee"]
    # the slip: a bordered document
    W, top = 6.4, 5.0
    lines = len(p["earnings"])
    rh = 0.36
    rows = max(lines, 2 if p["pension"] else 1)
    bottom = top - 1.85 - (rows + 1) * rh - 0.75
    ax.add_patch(Rectangle((0, bottom), W, top - bottom, facecolor="white", edgecolor=INK, linewidth=1.4))
    ax.text(W / 2, top - 0.3, p["employer"], ha="center", va="center", fontsize=12, fontweight="bold")
    ax.text(W / 2, top - 0.65, f"PAYSLIP for {p['month']} {p['year']}", ha="center", va="center", fontsize=10.5)
    ax.text(0.15, top - 1.05, f"Employee: {first} {surname}", ha="left", va="center", fontsize=9.5)
    ax.text(W - 0.15, top - 1.05, f"Employee no.: {p['number']}", ha="right", va="center", fontsize=9.5)
    ax.text(0.15, top - 1.35, f"Job: {p['job']}", ha="left", va="center", fontsize=9.5)
    head = top - 1.7
    half = W / 2
    ax.plot([0, W], [head + 0.17, head + 0.17], color=INK, linewidth=0.9)
    ax.text(0.15, head, "Earnings", ha="left", va="center", fontsize=10, fontweight="bold")
    ax.text(half - 0.15, head, "Frw", ha="right", va="center", fontsize=10, fontweight="bold")
    ax.text(half + 0.15, head, "Deductions", ha="left", va="center", fontsize=10, fontweight="bold")
    ax.text(W - 0.15, head, "Frw", ha="right", va="center", fontsize=10, fontweight="bold")
    ax.plot([0, W], [head - 0.17, head - 0.17], color=INK, linewidth=0.9)
    for i, (label, amount) in enumerate(p["earnings"]):
        y = head - (i + 1) * rh
        ax.text(0.15, y, label, ha="left", va="center", fontsize=9.5)
        ax.text(half - 0.15, y, fr(amount), ha="right", va="center", fontsize=9.5)
    deductions = [("PAYE", "?")]
    if p["pension"]:
        deductions.append((f"Pension ({p['pension']}% of gross pay)", "?"))
    for i, (label, shown) in enumerate(deductions):
        y = head - (i + 1) * rh
        ax.text(half + 0.15, y, label, ha="left", va="center", fontsize=9.5)
        ax.text(W - 0.15, y, shown, ha="right", va="center", fontsize=10, fontweight="bold")
    total_y = head - (rows + 1) * rh
    ax.plot([0, W], [total_y + 0.17, total_y + 0.17], color=INK, linewidth=0.9)
    ax.text(0.15, total_y, "Gross pay", ha="left", va="center", fontsize=9.5, fontweight="bold")
    ax.text(half - 0.15, total_y, "?", ha="right", va="center", fontsize=10, fontweight="bold")
    ax.text(half + 0.15, total_y, "Total deductions", ha="left", va="center", fontsize=9.5, fontweight="bold")
    ax.text(W - 0.15, total_y, "?", ha="right", va="center", fontsize=10, fontweight="bold")
    ax.plot([half, half], [head + 0.17, total_y - 0.17], color=INK, linewidth=0.9)
    ax.plot([0, W], [total_y - 0.17, total_y - 0.17], color=INK, linewidth=0.9)
    ax.text(0.15, bottom + 0.3, "Net pay", ha="left", va="center", fontsize=10.5, fontweight="bold")
    ax.text(W - 0.15, bottom + 0.3, "?", ha="right", va="center", fontsize=11, fontweight="bold")
    # the band table beside it
    bx, bw = W + 0.35, 3.1
    btop = top
    n = len(p["bands"])
    bbot = btop - 0.75 - n * 0.36 - 0.75
    ax.add_patch(Rectangle((bx, bbot), bw, btop - bbot, facecolor="#f4f6f8", edgecolor=INK, linewidth=1.1))
    ax.text(bx + bw / 2, btop - 0.25, "PAYE bands (per month)", ha="center", va="center", fontsize=10, fontweight="bold")
    ax.text(bx + 0.15, btop - 0.6, "Gross pay (Frw)", ha="left", va="center", fontsize=9, style="italic")
    ax.text(bx + bw - 0.15, btop - 0.6, "Rate", ha="right", va="center", fontsize=9, style="italic")
    for i, (lo, hi, rate) in enumerate(p["bands"]):
        y = btop - 0.95 - i * 0.36
        ax.text(bx + 0.15, y, _band_text(lo, hi, i == 0), ha="left", va="center", fontsize=9.5)
        ax.text(bx + bw - 0.15, y, f"{rate}%", ha="right", va="center", fontsize=9.5, fontweight="bold")
    ax.text(bx + 0.15, bbot + 0.42, "PAYE is worked out on gross", ha="left", va="center", fontsize=8.5)
    ax.text(bx + 0.15, bbot + 0.18, "pay, band by band.", ha="left", va="center", fontsize=8.5)
    ax.set_xlim(-0.05, bx + bw + 0.05)
    ax.set_ylim(min(bottom, bbot) - 0.05, top + 0.05)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def questions(p: dict, rng: random.Random) -> list:
    first, surname = p["employee"]
    month = p["month"]
    gross = sum(a for _, a in p["earnings"])
    tax = paye(gross, p["bands"])
    pension = gross * p["pension"] // 100
    net = gross - tax - pension
    job = p["job"].lower()
    qs = [
        short(f"{first} {surname} works as {article(job)} {job} for {p['employer']} and "
              f"{rng.choice(['receives', 'is given', 'checks'])} this payslip for {month}. What is {first}'s gross pay "
              f"for {month}, in Frw?", gross, money(gross)),
        short(rng.choice([f"Using the PAYE bands printed beside the payslip, how much PAYE is deducted from {first}'s pay "
                          f"for {month}, in Frw?",
                          f"How much PAYE is deducted from {first}'s pay for {month}, in Frw? Use the bands printed "
                          f"beside the payslip."]), tax, money(tax)),
    ]
    if p["pension"]:
        qs.append(short(f"How much is deducted from {first}'s pay for {month} for the pension, at the rate shown on the "
                        f"payslip, in Frw?", pension, money(pension)))
    qs.append(short(f"What is {first}'s net pay for {month}, in Frw?", net, money(net)))
    return qs
