"""Forms of business (LS, UP; AS Level "Business structure" by name): a table of four to six invented businesses in a
Rwandan town with the facts that decide their legal form -- what each does, its number of owners, whether the owners'
liability for its debts is limited, whether it sells shares to the public, and how its owners vote. The forms are
never printed: a student decides them from the facts, as a case study asks.

The facts follow one fixed table (FORMS) that a Business Studies teacher would agree with: a sole proprietorship has
one owner and unlimited liability; a partnership two to twenty owners and unlimited liability; a private limited
company limited liability, shares not sold to the public and one vote per share; a public limited company the same
but with shares sold to the public and over a thousand owners; a cooperative limited liability and one vote per
owner (member), whatever its shares.

Which business is a named form (an MCQ of the table's businesses; the asked form appears once); how many owners the
partnership has, or how many businesses are limited companies (private or public); and which two businesses share a
form (exactly one form appears twice; the options are a balanced square of pairs, each sharing one business with two
others, so the key is never the central option). Business names share no word, so no option stands out by its words,
and a business's trade says nothing of its form.
"""
from __future__ import annotations

import random

from matplotlib.patches import Rectangle

from ..core import INK, NAMES, mcq, new_figure, short

ID = "forms_of_business"
KIND = "business.document"
SUBJECT = "business"
BANDS = ("LS", "UP")
# The same case table in Cambridge AS Level Business, "Business structure" (legal structure of private-sector firms).
ALSO_BANDS = {"UP": ("AL",)}
CONCEPTS = ("business.business-formation-and-registration",)
# A topic whose sections the book lists is reached only if its name or a section names the forms of business.
NEEDS = (r"forms? of (business|enterprise)|business (units|organi[sz]ation|structure)|types of business organi|"
         r"classification of enterprise|legal forms")
# Listed without sections, sharing business formation, but teaching bookkeeping or taxes.
AVOID = r"bookkeeping|taxes"

# form: (owners low, owners high, step, liability, shares sold to the public, voting)
FORMS = {
    "sole": (1, 1, 1, "Unlimited", "No", "The one owner decides"),
    "partnership": (2, 6, 1, "Unlimited", "No", "As the owners' agreement says"),
    "ltd": (3, 40, 1, "Limited", "No", "One vote per share"),
    "plc": (1200, 9000, 100, "Limited", "Yes", "One vote per share"),
    "coop": (25, 300, 1, "Limited", "No", "One vote per owner"),
}
FORM_TEXT = {"sole": "a sole proprietorship (sole trader)", "partnership": "a partnership",
             "ltd": "a private limited company", "plc": "a public limited company", "coop": "a cooperative"}
# A wrong option is first a business whose form is easily taken for the one asked.
CONFUSED = {"sole": ["partnership", "ltd"], "partnership": ["sole", "ltd", "coop"], "ltd": ["plc", "coop", "partnership"],
            "plc": ["ltd", "coop"], "coop": ["ltd", "partnership", "plc"]}
FIRST = ["Isange", "Ubumwe", "Inzozi", "Umucyo", "Akeza", "Ikaze", "Urumuri", "Imena", "Agaciro", "Intwari", "Ihirwe",
         "Amahoro", "Ineza", "Umurava", "Kivu", "Nyungwe", "Karisimbi", "Akagera", "Gishwati", "Sabyinyo"]
# Trades any form may run, so a trade gives no form away.
TRADES = [("Bakery", "Bakes and sells bread"), ("Dairy", "Makes milk and yoghurt"), ("Coffee", "Grows and washes coffee"),
          ("Juice", "Makes fruit juice"), ("Furniture", "Makes beds and tables"), ("Transport", "Runs buses"),
          ("Hotel", "Runs a hotel"), ("Printing", "Prints books and posters"), ("Hardware", "Sells building materials"),
          ("Tours", "Runs tours to national parks"), ("Bricks", "Makes bricks"), ("Tea", "Grows and packs tea"),
          ("Rice", "Grows and mills rice"), ("Poultry", "Keeps chickens and sells eggs")]
TOWNS = ["Kigali", "Huye", "Musanze", "Rubavu", "Muhanga", "Nyagatare", "Rusizi", "Rwamagana", "Karongi", "Nyanza"]


def fr(n: int) -> str:
    return f"{n:,}".replace(",", " ")


def form_of(row: list) -> str:
    _, _, owners, liability, public, votes = row
    if liability == "Unlimited":
        return "sole" if owners == 1 else "partnership"
    if public == "Yes":
        return "plc"
    return "coop" if votes == "One vote per owner" else "ltd"


def _owners(rng: random.Random, form: str) -> int:
    lo, hi, step = FORMS[form][:3]
    return rng.randrange(lo, hi + 1, step)


def sample(rng: random.Random) -> dict:
    band = rng.choice(BANDS)
    k = rng.randint(4, 5) if band == "LS" else rng.randint(4, 6)
    forms = rng.sample(list(FORMS), k - 1)
    twice = rng.choice(forms)
    forms.append(twice)
    rng.shuffle(forms)
    firsts = rng.sample(FIRST, k)
    trades = rng.sample(TRADES, k)
    rows = []
    used = set()
    for f, first, (trade, activity) in zip(forms, firsts, trades):
        while True:
            n = _owners(rng, f)
            if f == "sole" or (f, n) not in used:
                break
        used.add((f, n))
        _, _, _, liability, public, votes = FORMS[f]
        rows.append([f"{first} {trade}", activity, n, liability, public, votes])
    ask = rng.choice([f for f in forms if forms.count(f) == 1])
    return {"band": band, "town": rng.choice(TOWNS), "rows": rows, "ask": ask}


HEAD = ["Business", "What it does", "Number of\nowners", "Owners' liability\nfor its debts", "Shares sold to\nthe public?",
        "Voting at owners'\nmeetings"]
WIDTHS = [2.3, 3.2, 1.3, 1.9, 1.6, 2.7]


def draw(p: dict):
    rows = p["rows"]
    rh, hh = 0.5, 0.8
    total = sum(WIDTHS)
    fig, ax = new_figure(12.0, 0.5 * (len(rows) + 4))
    fig.subplots_adjust(left=0, right=1, bottom=0, top=1)
    ax.text(0, 0.45, f"Businesses in {p['town']}", ha="left", va="center", fontsize=12, fontweight="bold")
    x = 0.0
    for w, h in zip(WIDTHS, HEAD):
        ax.add_patch(Rectangle((x, -hh), w, hh, facecolor="#d9dee3", edgecolor=INK, linewidth=0.9))
        ax.text(x + w / 2, -hh / 2, h, ha="center", va="center", fontsize=9.5, fontweight="bold")
        x += w
    for r, (name, activity, owners, liability, public, votes) in enumerate(rows):
        y = -hh - (r + 1) * rh
        x = 0.0
        for c, (w, v) in enumerate(zip(WIDTHS, (name, activity, fr(owners), liability, public, votes))):
            ax.add_patch(Rectangle((x, y), w, rh, facecolor="white", edgecolor="#888888", linewidth=0.7))
            left = c in (0, 1, 5)
            ax.text(x + 0.12 if left else x + w / 2, y + rh / 2, v, ha="left" if left else "center", va="center",
                    fontsize=10, fontweight="bold" if c == 0 else "normal")
            x += w
    bottom = -hh - len(rows) * rh
    ax.set_xlim(-0.05, total + 0.05)
    ax.set_ylim(bottom - 0.1, 0.8)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


VERBS = ["studies", "is given", "reads", "looks at", "analyses"]
SETTINGS = ["in a business studies lesson", "for homework", "for a class test", "for a case study",
            "before visiting the town", "for a group project"]


def _pairs(rng: random.Random, names: list, a: str, b: str) -> tuple[str, list]:
    """The key pair and three wrong pairs in a square: (a,b), (a,c), (b,d), (c,d)."""
    c, d = rng.sample([n for n in names if n not in (a, b)], 2)

    def pair(x, y):
        x, y = sorted((x, y), key=names.index)
        return f"{x} and {y}"

    return pair(a, b), [pair(a, c), pair(b, d), pair(c, d)]


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    rows, town = p["rows"], p["town"]
    names = [r[0] for r in rows]
    forms = {r[0]: form_of(r) for r in rows}
    ask = p["ask"]
    key = next(n for n in names if forms[n] == ask)
    near = [n for f in CONFUSED[ask] for n in names if forms[n] == f]
    rest = [n for n in names if n != key and n not in near]
    rng.shuffle(rest)
    wrong = (near + rest)[:3]
    tally = {f: list(forms.values()).count(f) for f in set(forms.values())}
    if tally.get("partnership") == 1 and rng.random() < 0.5:
        n = next(r[2] for r in rows if forms[r[0]] == "partnership")
        second = short(f"How many owners does the partnership in the table of {town} businesses have?", n,
                       [f"{n} owners", f"{n} partners", f"{n} people"])
    else:
        n = sum(1 for f in forms.values() if f in ("ltd", "plc"))
        forms_ok = [f"{n} businesses", f"{n} companies"] if n != 1 else ["1 business", "1 company"]
        second = short(f"How many of the {town} businesses in the table are limited companies, private or public?", n,
                       forms_ok + (["none"] if n == 0 else []))
    a, b = [n for n in names if tally[forms[n]] == 2]
    pair, others = _pairs(rng, names, a, b)
    return [
        mcq(f"{who} {rng.choice(VERBS)} this table of businesses in {town} {rng.choice(SETTINGS)}. "
            f"Which of the businesses is {FORM_TEXT[ask]}?", key, wrong, rng),
        second,
        mcq(f"Which two of the {town} businesses in the table have the same form of business?", pair, others, rng),
    ]
