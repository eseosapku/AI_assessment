"""Office records (UP; WAEC Office Practice, Rwanda Entrepreneurship S5 "Office Procedures"): three sub-types.

- letter: a fully blocked business letter from an invented Rwandan firm on a page, with six of its parts lettered from
  the margin (letterhead, reference, date, inside address, salutation, subject line, body, complimentary close, the
  writer's signature). Which label marks a named part (three parts asked). The close matches the greeting as Office
  Practice teaches it: "Dear Sir/Madam" with "Yours faithfully", a named greeting with "Yours sincerely".
- filing: five or six file cards (surname, first name, file number, date opened), lettered P to U. Which card comes
  first, third, last ... when filed by a rule named in the stem: alphabetical by surname (first name where surnames are
  the same), numerical by file number (smallest first; the numbers have different lengths, so ordering them as text
  gives another order), or chronological by date opened (oldest first).
- visitors: a reception's visitors' book for one day (visitor, organisation, time in, time out, person visited), in
  order of arrival. How many minutes a visitor stayed, who stayed the longest (no tie), and how many visitors were in
  the building at a stated time (never within ten minutes of anyone arriving or leaving).

Each sub-type reaches its own Office Practice topic (avoid_for): the letter "Communication and correspondence", the
cards "Records management" and "Office Procedures", the visitors' book "Reception duties"; all three "Office
organisation".
"""
from __future__ import annotations

import datetime
import random

from matplotlib.patches import FancyBboxPatch, Rectangle

from ..core import INK, NAMES, mcq, new_figure, short

ID = "office_records"
KIND = "business.document"
SUBJECT = "business"
BANDS = ("UP",)
CONCEPTS = ("business.office-organisation-and-procedures", "business.records-management-and-filing")
# A topic whose sections the book lists is reached only if its name or a section names office work or records.
NEEDS = r"office|filing|record|correspondence|reception"
# Share records management but teach office machines, or the records of accounting and stock.
AVOID = r"office equipment|prime books|ledgers|stock control|initial accounting"
ONLY = {"letter": r"|records management|reception|office procedures", "filing": r"|correspondence|reception",
        "visitors": r"|correspondence|records management|office procedures"}


def avoid_for(p: dict) -> str:
    return AVOID + ONLY[p["kind"]]


MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October",
          "November", "December"]
SURNAMES = ["Habimana", "Hakizimana", "Mukamana", "Uwimana", "Niyonzima", "Nshimiyimana", "Mugabo", "Ndayisaba",
            "Bizimana", "Nsengiyumva", "Mutesi", "Kamanzi", "Gatete", "Rukundo", "Munyaneza", "Twagirayezu", "Ntwali",
            "Kayitesi", "Murenzi", "Uwamahoro"]
FIRMS = [("Ubumwe Furniture Ltd", "P.O. Box 4512, Kigali", "UF"), ("Inzozi Bakery Ltd", "P.O. Box 318, Huye", "IB"),
         ("Kivu Lake Hotel", "P.O. Box 77, Rubavu", "KH"), ("Umucyo Juice Ltd", "P.O. Box 902, Rwamagana", "UJ"),
         ("Akagera Tours Ltd", "P.O. Box 1450, Musanze", "AT")]
RECIPIENTS = [("The Manager", "Isange Office Supplies", "P.O. Box 2210, Kigali"),
              ("The Head Teacher", "Ineza Secondary School", "P.O. Box 65, Muhanga"),
              ("The Sales Manager", "Karisimbi Printers Ltd", "P.O. Box 811, Musanze"),
              ("The Purchasing Officer", "Amahoro Clinic", "P.O. Box 140, Nyanza"),
              ("The Director", "Intwari Transport Ltd", "P.O. Box 530, Kigali")]
# (subject line, department code for the reference, the body's lines)
LETTERS = [("ORDER FOR OFFICE CHAIRS", "PUR", ["We would like to order twenty office chairs, model C14,",
                                                "as shown in your price list of last month.",
                                                "Please deliver them to our office within two weeks."]),
           ("REQUEST FOR A PRICE LIST", "PUR", ["We are planning to buy stationery for the coming year.",
                                                 "Please send us your latest price list and your terms",
                                                 "of payment for orders of more than 100 000 Frw."]),
           ("LATE DELIVERY OF ORDER NO. 2417", "ADM", ["The goods we ordered on 3 March have not yet arrived,",
                                                         "although you promised delivery within ten days.",
                                                         "Please tell us when we can expect them."]),
           ("INVITATION TO OUR OPEN DAY", "MKT", ["We are pleased to invite you to our open day on Friday,",
                                                   "where we will show our new products and services.",
                                                   "Kindly confirm whether you will attend."]),
           ("PAYMENT FOR INVOICE NO. 1186", "ACC", ["We enclose a cheque for the full amount of invoice",
                                                     "no. 1186, dated 12 February.",
                                                     "Please send us a receipt for this payment."])]
SIGNERS = [("Office Manager", "ADM"), ("Purchasing Officer", "PUR"), ("Accountant", "ACC"), ("Marketing Officer", "MKT"),
           ("Managing Director", "ADM")]
PARTS = ["letterhead", "reference", "date", "inside address", "salutation", "subject line", "body",
         "complimentary close", "writer's signature"]
OFFICES = ["Ubumwe Furniture Ltd in Kigali", "the Huye office of Inzozi Bakery", "Kivu Lake Hotel in Rubavu",
           "Umucyo Juice Ltd in Rwamagana", "Akagera Tours in Musanze", "Karisimbi Printers in Musanze"]
ORGS = ["Isange Office Supplies", "Karisimbi Printers", "Ineza Secondary School", "Amahoro Clinic", "Intwari Transport",
        "Ikaze Insurance", "Gishwati Furniture", "Nyungwe Bank", "Urumuri Solar", "Agaciro Accountants"]
FIRSTS = [n for n in NAMES if n not in SURNAMES]  # a first name that is nobody's surname here
# Staff whose names no visitor, card or question shares (P4 blind review: a visitor and a member of staff were both
# "Teta").
HOSTS = ["Mr Ruzindana (Accounts)", "Mrs Nyiraneza (Manager)", "Ms Umuhoza (Sales)", "Mr Sebagabo (Stores)",
         "Mrs Mukeshimana (Personnel)", "Mr Rwigema (Transport)"]


def _date(rng: random.Random) -> list[int]:
    d = datetime.date(2023, 1, 1) + datetime.timedelta(days=rng.randrange(3 * 365))
    return [d.year, d.month, d.day]


def _show(ymd) -> str:
    return f"{ymd[2]} {MONTHS[ymd[1] - 1]} {ymd[0]}"


def _letter(rng: random.Random) -> dict:
    firm, box, code = rng.choice(FIRMS)
    title, org, addr = rng.choice(RECIPIENTS)
    subject, dept, body = rng.choice(LETTERS)
    signer_title = next(t for t, d in SIGNERS if d == dept) if rng.random() < 0.7 else rng.choice(SIGNERS)[0]
    if rng.random() < 0.5:
        who = None
        salutation, close = "Dear Sir/Madam,", "Yours faithfully,"
    else:
        who = [rng.choice(["Mr", "Mrs", "Ms"]), rng.choice(SURNAMES)]
        salutation, close = f"Dear {who[0]} {who[1]},", "Yours sincerely,"
    inside = ([f"{who[0]} {who[1]}"] if who else []) + [title, org, addr]
    marked = rng.sample(PARTS, 6)
    letters = list("ABCDEF")
    rng.shuffle(letters)
    return {"band": "UP", "kind": "letter", "firm": [firm, box], "inside": inside, "org": org,
            "ref": f"Our ref: {code}/{dept}/{rng.randint(1, 250):03d}", "date": _show(_date(rng)), "subject": subject,
            "body": body, "salutation": salutation, "close": close,
            "signer": [f"{rng.choice(FIRSTS)} {rng.choice(SURNAMES)}", signer_title],
            "marks": [[letter, part] for letter, part in zip(letters, marked)]}


def _filing(rng: random.Random) -> dict:
    while True:
        k = rng.randint(5, 6)
        surnames = rng.sample(SURNAMES, k)
        if rng.random() < 0.3:
            surnames[1] = surnames[0]  # two people with one surname: the first names decide
        firsts = rng.sample(FIRSTS, k)
        numbers = [rng.randint(10, 99), rng.randint(100, 999)] + [rng.randint(100, 4999) for _ in range(k - 2)]
        rng.shuffle(numbers)
        dates = [_date(rng) for _ in range(k)]
        cards = [[letter, s, f, n, d] for letter, s, f, n, d in zip("PQRSTU", surnames, firsts, numbers, dates)]
        rng.shuffle(cards)
        cards = [["PQRSTU"[i]] + c[1:] for i, c in enumerate(cards)]
        if len({c[3] for c in cards}) < k or len({tuple(c[4]) for c in cards}) < k:
            continue
        if sorted(cards, key=lambda c: str(c[3])) == sorted(cards, key=lambda c: c[3]):
            continue
        return {"band": "UP", "kind": "filing", "office": rng.choice(OFFICES), "cards": cards}


def _visitors(rng: random.Random) -> dict:
    while True:
        k = rng.randint(5, 7)
        t = 8 * 60 + 5 * rng.randint(0, 6)
        rows = []
        firsts = rng.sample(FIRSTS, k)
        surnames = rng.sample(SURNAMES, k)
        orgs = rng.sample(ORGS, k)
        for i in range(k):
            t += 5 * rng.randint(1, 8)
            stay = 5 * rng.randint(2, 24)
            rows.append([f"{firsts[i]} {surnames[i]}", orgs[i], t, t + stay, rng.choice(HOSTS)])
        stays = sorted(r[3] - r[2] for r in rows)
        if stays[-1] == stays[-2]:
            continue
        marks = [x for r in rows for x in r[2:4]]
        free = [m for m in range(rows[0][2] + 10, max(marks) - 10, 5) if all(abs(m - x) >= 10 for x in marks)
                and sum(1 for r in rows if r[2] < m < r[3]) >= 1]
        if not free:
            continue
        d = _date(rng)
        return {"band": "UP", "kind": "visitors", "office": rng.choice(OFFICES), "date": _show(d), "rows": rows,
                "at": rng.choice(free)}


def sample(rng: random.Random) -> dict:
    return rng.choice([_letter, _filing, _visitors])(rng)


def hm(m: int) -> str:
    return f"{m // 60:02d}:{m % 60:02d}"


def _draw_letter(p: dict):
    fig, ax = new_figure(8.6, 8.9)
    fig.subplots_adjust(left=0, right=1, bottom=0, top=1)
    x = 0.7
    spots = {}
    firm, box = p["firm"]
    ax.text(5, 13.0, firm.upper(), ha="center", va="center", fontsize=13, fontweight="bold")
    ax.text(5, 12.55, box, ha="center", va="center", fontsize=9.5)
    ax.plot([0.5, 9.5], [12.25, 12.25], color=INK, linewidth=1.2)
    spots["letterhead"] = (5 - 0.085 * len(firm), 13.0)
    ax.text(x, 11.8, p["ref"], ha="left", va="center", fontsize=10)
    spots["reference"] = (x, 11.8)
    ax.text(x, 11.15, p["date"], ha="left", va="center", fontsize=10)
    spots["date"] = (x, 11.15)
    y = 10.45
    for line in p["inside"]:
        ax.text(x, y, line, ha="left", va="center", fontsize=10)
        y -= 0.4
    spots["inside address"] = (x - 0.15, 10.45 - 0.2 * (len(p["inside"]) - 1))
    spans = {"inside address": (10.45 + 0.15, y + 0.25)}
    y -= 0.35
    ax.text(x, y, p["salutation"], ha="left", va="center", fontsize=10)
    spots["salutation"] = (x, y)
    y -= 0.66
    ax.text(x, y, p["subject"], ha="left", va="center", fontsize=10, fontweight="bold")
    ax.plot([x, x + 0.118 * len(p["subject"])], [y - 0.2, y - 0.2], color=INK, linewidth=0.9)
    spots["subject line"] = (x, y)
    y -= 0.65
    top = y
    for line in p["body"]:
        ax.text(x, y, line, ha="left", va="center", fontsize=10)
        y -= 0.4
    ax.text(x, y, "We look forward to hearing from you.", ha="left", va="center", fontsize=10)
    spots["body"] = (x - 0.15, (top + y) / 2)
    spans["body"] = (top + 0.15, y - 0.15)
    y -= 0.75
    ax.text(x, y, p["close"], ha="left", va="center", fontsize=10)
    spots["complimentary close"] = (x, y)
    y -= 0.75
    import numpy as np
    s = np.linspace(0, 1, 60)
    ax.plot(x + 2.2 * s, y + 0.18 * np.sin(14 * s) * (1 - s) + 0.05, color="#1a3c7a", linewidth=1.3)
    spots["writer's signature"] = (x, y)
    y -= 0.5
    name, title = p["signer"]
    ax.text(x, y, name, ha="left", va="center", fontsize=10)
    ax.text(x, y - 0.4, title, ha="left", va="center", fontsize=10)
    bottom = y - 1.0
    ax.add_patch(Rectangle((0, bottom), 10, 13.6 - bottom, facecolor="white", edgecolor="#777777", linewidth=1.0,
                           zorder=0))
    for letter, part in p["marks"]:
        sx, sy = spots[part]
        if part in spans:  # a part of several lines is bracketed, so the arrow marks the whole of it
            hi, lo = spans[part]
            ax.plot([x - 0.08, x - 0.15, x - 0.15, x - 0.08], [hi, hi, lo, lo], color=INK, linewidth=1.0)
        ax.annotate("", xy=(sx - 0.08, sy), xytext=(-0.55, sy), arrowprops={"arrowstyle": "-|>", "color": INK,
                                                                             "linewidth": 1.1})
        ax.add_patch(Rectangle((-1.15, sy - 0.24), 0.48, 0.48, facecolor="#fff6cc", edgecolor=INK, linewidth=1.0))
        ax.text(-0.91, sy, letter, ha="center", va="center", fontsize=11, fontweight="bold")
    ax.set_xlim(-1.3, 10.1)
    ax.set_ylim(bottom - 0.1, 13.7)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def _draw_filing(p: dict):
    cards = p["cards"]
    fig, ax = new_figure(10.0, 5.6)
    fig.subplots_adjust(left=0, right=1, bottom=0, top=1)
    ax.text(0, 4.5, f"File cards at {p['office']}", ha="left", va="center", fontsize=12, fontweight="bold")
    for i, (letter, surname, first, number, date) in enumerate(cards):
        cx, cy = (i % 3) * 3.6, 3.7 - (i // 3) * 2.15
        ax.add_patch(FancyBboxPatch((cx, cy - 1.75), 3.3, 1.75, boxstyle="round,pad=0,rounding_size=0.08",
                                    facecolor="#fbfaf3", edgecolor=INK, linewidth=1.1))
        ax.plot([cx + 0.1, cx + 3.2], [cy - 0.55, cy - 0.55], color="#c23b3b", linewidth=0.9)
        ax.text(cx + 0.2, cy - 0.3, f"{surname}, {first}", ha="left", va="center", fontsize=10.5, fontweight="bold")
        ax.text(cx + 0.2, cy - 0.9, f"File no. {number}", ha="left", va="center", fontsize=10)
        ax.text(cx + 0.2, cy - 1.4, f"Opened: {_show(date)}", ha="left", va="center", fontsize=10)
        ax.add_patch(Rectangle((cx + 2.68, cy - 1.62), 0.5, 0.5, facecolor="#fff6cc", edgecolor=INK, linewidth=1.0))
        ax.text(cx + 2.93, cy - 1.37, letter, ha="center", va="center", fontsize=11.5, fontweight="bold")
    ax.set_xlim(-0.1, 10.7)
    ax.set_ylim(3.7 - 2.15 - 1.85, 4.85)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def _draw_visitors(p: dict):
    rows = p["rows"]
    head = ["Visitor's name", "Organisation", "Time in", "Time out", "Person visited"]
    widths = [2.6, 2.7, 1.2, 1.2, 2.8]
    rh, hh = 0.5, 0.55
    total = sum(widths)
    fig, ax = new_figure(11.0, 0.5 * (len(rows) + 4))
    fig.subplots_adjust(left=0, right=1, bottom=0, top=1)
    ax.text(0, 0.45, f"Visitors' book: {p['office']}, {p['date']}", ha="left", va="center", fontsize=12,
            fontweight="bold")
    x = 0.0
    for w, h in zip(widths, head):
        ax.add_patch(Rectangle((x, -hh), w, hh, facecolor="#d9dee3", edgecolor=INK, linewidth=0.9))
        ax.text(x + w / 2, -hh / 2, h, ha="center", va="center", fontsize=9.5, fontweight="bold")
        x += w
    for r, (name, org, tin, tout, host) in enumerate(rows):
        y = -hh - (r + 1) * rh
        x = 0.0
        for c, (w, v) in enumerate(zip(widths, (name, org, hm(tin), hm(tout), host))):
            ax.add_patch(Rectangle((x, y), w, rh, facecolor="white", edgecolor="#888888", linewidth=0.7))
            mid = c in (2, 3)
            ax.text(x + w / 2 if mid else x + 0.12, y + rh / 2, v, ha="center" if mid else "left", va="center",
                    fontsize=10)
            x += w
    bottom = -hh - len(rows) * rh
    ax.set_xlim(-0.05, total + 0.05)
    ax.set_ylim(bottom - 0.1, 0.8)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def draw(p: dict):
    return {"letter": _draw_letter, "filing": _draw_filing, "visitors": _draw_visitors}[p["kind"]](p)


VERBS = ["studies", "checks", "is given", "looks at", "files"]
SETTINGS = ["in an office practice lesson", "on the first day of a new job", "for a class test", "for homework",
            "during work experience", "for revision"]
LETTER_VERBS = ["studies", "checks", "types", "proofreads", "is given"]
FILE_VERBS = ["sorts", "files", "arranges", "checks", "puts away"]
BOOK_VERBS = ["checks", "keeps", "reads", "looks after", "writes up"]
BOOK_SETTINGS = ["at the end of the day", "for the office manager", "during work experience", "in an office practice lesson",
                 "for a security check", "before closing the office"]
NTH = ["first", "second", "third", "fourth", "fifth", "sixth"]


def _letter_questions(p: dict, rng: random.Random, who: str) -> list:
    marks = {part: letter for letter, part in p["marks"]}
    asked = rng.sample(list(marks), 3)
    firm = p["firm"][0]
    qs = []
    for i, part in enumerate(asked):
        key = marks[part]
        wrong = [v for v in marks.values() if v != key]
        rng.shuffle(wrong)
        if i == 0:
            stem = (f"{who} {rng.choice(LETTER_VERBS)} this business letter from {firm} {rng.choice(SETTINGS)}. "
                    f"Which label marks the {part}?")
        elif i == 1:
            stem = f"On the letter from {firm} to {p['org']}, which label marks the {part}?"
        else:
            stem = f"In the letter {firm} wrote to {p['org']}, which label marks the {part}?"
        qs.append(mcq(stem, key, wrong, rng))
    return qs


def _place(n: int, k: int) -> str:
    return "last" if n == k - 1 else NTH[n]


def _filing_questions(p: dict, rng: random.Random, who: str) -> list:
    cards, office = p["cards"], p["office"]
    k = len(cards)
    orders = {"alpha": [c[0] for c in sorted(cards, key=lambda c: (c[1], c[2]))],
              "num": [c[0] for c in sorted(cards, key=lambda c: c[3])],
              "date": [c[0] for c in sorted(cards, key=lambda c: tuple(c[4]))]}
    rules = {"alpha": "Filed in alphabetical order of surname (by first name where two surnames are the same)",
             "num": "Filed in numerical order of file number, smallest first",
             "date": "Filed in chronological order of the date opened, oldest first"}
    qs = []
    for i, rule in enumerate(rng.sample(list(orders), 3)):
        n = rng.randrange(k)
        order = orders[rule]
        key = order[n]
        near = [order[j] for j in (n - 1, n + 1) if 0 <= j < k]
        other = [orders[r][n] for r in orders if r != rule]
        wrong = []
        for c in near + other + [c for c in order if c != key]:
            if c != key and c not in wrong:
                wrong.append(c)
        lead = (f"{who} {rng.choice(FILE_VERBS)} these file cards at {office} {rng.choice(SETTINGS)}. "
                if i == 0 else f"The file cards are from {office}. ")
        qs.append(mcq(f"{lead}{rules[rule]}, which card comes {_place(n, k)}?", key, wrong[:3], rng))
    return qs


def _minutes(m: int) -> list[str]:
    forms = [f"{m} minutes", f"{m} min", f"{m} mins"]
    if m >= 60:
        h, r = divmod(m, 60)
        hours = "1 hour" if h == 1 else f"{h} hours"
        forms += [hours if not r else f"{hours} {r} minutes", f"{h} h {r} min" if r else f"{h} h"]
    return forms


def _visitors_questions(p: dict, rng: random.Random, who: str) -> list:
    rows, office = p["rows"], p["office"]
    stay = {r[0]: r[3] - r[2] for r in rows}
    name = rng.choice(list(stay))
    longest = max(stay, key=stay.get)
    latest = max(rows, key=lambda r: r[3])[0]
    rest = [n for n in stay if n not in (longest, latest)]
    rng.shuffle(rest)
    t = p["at"]
    inside = sum(1 for r in rows if r[2] < t < r[3])
    return [
        short(f"{who} {rng.choice(BOOK_VERBS)} the visitors' book at the reception of {office} {rng.choice(BOOK_SETTINGS)}. "
              f"For how many minutes was {name} in the building?", stay[name], _minutes(stay[name])),
        mcq(f"Which visitor to {office} stayed the longest on {p['date']}?", longest, [latest] + rest, rng),
        short(f"How many visitors were in the building at {office} at {hm(t)}?", inside,
              [f"{inside} visitors", f"{inside} people"] if inside != 1 else ["1 visitor", "1 person"]),
    ]


def people(p: dict) -> set[str]:
    """Every name a figure shows: the person in the questions is never one of them (P4 blind review: the receptionist
    in the stem was also a visitor in the book)."""
    if p["kind"] == "letter":
        shown = [p["signer"][0]] + p["inside"]
    elif p["kind"] == "filing":
        shown = [f"{c[2]} {c[1]}" for c in p["cards"]]
    else:
        shown = [r[0] for r in p["rows"]] + [r[4] for r in p["rows"]]
    return {w.strip("(),") for x in shown for w in x.split()}


def questions(p: dict, rng: random.Random) -> list:
    shown = people(p)
    who = rng.choice([n for n in NAMES if n not in shown])
    return {"letter": _letter_questions, "filing": _filing_questions,
            "visitors": _visitors_questions}[p["kind"]](p, rng, who)
