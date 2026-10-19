"""Product labels (LS, UP) for consumer education (NERDC JSS "Consumer education", WAEC/NERDC Commerce "Consumer
protection", Rwanda S4 Entrepreneurship "Role of Standards in Business"). Two sub-types:

- label: one food label from an invented Rwandan maker, with the product name, net mass (or volume), price,
  ingredients, manufacture date (MFD), expiry date (EXP), batch number, a generic standards mark (an "S" in a circle,
  captioned "Standards mark"; no real organisation's logo) and the maker's address; six of the nine parts are lettered.
  Asks which letter shows a part, the price per 100 g (formula in the stem), and how many months after manufacture it
  expires.
- shelf: four packs of one product from different batches, lettered P to S, each with its batch number, MFD and EXP,
  under the printed rule that a product must not be sold after its expiry date. Asks which pack must come off the
  shelf on a date (exactly one has expired), how many may still be sold on another date, and one pack's shelf life in
  months.

Dates print as day/month/year, and the figure says so. No asked date is an expiry date, so "after" is never in doubt.
"""
from __future__ import annotations

import random

from matplotlib.patches import Circle, FancyBboxPatch

from ..core import INK, NAMES, count, mcq, money, short
from ._accounts import MONTHS, page
from .econ_tables import fit

ID = "product_label"
KIND = "business.document"
SUBJECT = "business"
BANDS = ("LS", "UP")
CONCEPTS = ("business.standardisation-concept", "business.metrology-and-quality-testing")
# A topic whose sections the book lists is reached only if one names what this figure teaches.
NEEDS = r"consumer|standard|certif|label"

# (product, unit, container, maker, town, ingredients, price per 100 units range and step, shelf life months range)
PRODUCTS = [
    ("Milk powder", "g", "tin", "Nyanza Dairy Ltd", "Nyanza", "Whole milk, vitamins A and D", (500, 1100, 20), (12, 24)),
    ("Peanut butter", "g", "jar", "Huye Foods Ltd", "Huye", "Roasted groundnuts, salt", (300, 700, 20), (6, 12)),
    ("Passion fruit juice", "ml", "bottle", "Rwamagana Juices Ltd", "Rwamagana", "Water, passion fruit pulp, sugar",
     (100, 260, 20), (6, 12)),
    ("Maize flour", "g", "bag", "Nyagatare Mills Ltd", "Nyagatare", "Maize, vitamins and iron", (60, 140, 20), (3, 6)),
    ("Tomato sauce", "g", "bottle", "Kigali Sauces Ltd", "Kigali", "Tomatoes, sugar, vinegar, salt", (200, 460, 20),
     (12, 18)),
    ("Honey", "g", "jar", "Nyamagabe Beekeepers Cooperative", "Nyamagabe", "Pure natural honey", (600, 1400, 20),
     (24, 36)),
    ("Biscuits", "g", "packet", "Muhanga Bakery Ltd", "Muhanga", "Wheat flour, sugar, vegetable oil, salt",
     (200, 500, 20), (6, 12)),
    ("Cooking oil", "ml", "bottle", "Rubavu Oils Ltd", "Rubavu", "Refined sunflower oil", (200, 420, 20), (12, 18)),
    ("Chilli sauce", "ml", "bottle", "Rusizi Spices Ltd", "Rusizi", "Chillies, vinegar, salt", (300, 640, 20), (12, 24)),
    ("Sorghum flour", "g", "bag", "Gicumbi Mills Ltd", "Gicumbi", "Whole sorghum, vitamins", (80, 180, 20), (4, 8)),
]
SIZES = [200, 250, 400, 500, 750, 1000]
PARTS = ["name", "mass", "price", "ingredients", "mfd", "exp", "batch", "mark", "address"]
YEARS = [2024, 2025]


def _words(part: str, unit: str) -> str:
    return {"name": "product name", "mass": "net mass" if unit == "g" else "net volume", "price": "price",
            "ingredients": "list of ingredients", "mfd": "manufacture date", "exp": "expiry date",
            "batch": "batch number", "mark": "standards mark", "address": "maker's address"}[part]


def fr(n: int) -> str:
    return f"{n:,}".replace(",", " ")


def _add_months(d: list, n: int) -> list:
    k = d[1] - 1 + n
    return [d[0] + k // 12, k % 12 + 1, d[2]]


def _day(d: list) -> int:
    import datetime
    return datetime.date(*d).toordinal()


def _date(d: list) -> str:
    return f"{d[2]:02d}/{d[1]:02d}/{d[0]}"


def _said(d: list) -> str:
    return f"{d[2]} {MONTHS[d[1] - 1]} {d[0]}"


def _from_day(n: int) -> list:
    import datetime
    x = datetime.date.fromordinal(n)
    return [x.year, x.month, x.day]


def sample(rng: random.Random) -> dict:
    product, unit, box, maker, town, ingredients, (lo, hi, step), (s_lo, s_hi) = rng.choice(PRODUCTS)
    band = rng.choice(BANDS)
    base = {"band": band, "product": product, "unit": unit, "container": box, "maker": maker, "town": town}
    if rng.random() < 0.5:
        while True:
            mass = rng.choice(SIZES)
            per = rng.randrange(lo, hi + 1, step)
            if per * mass % 100:
                continue
            price = per * mass // 100
            if price % 50 or price == per:
                continue
            break
        mfd = [rng.choice(YEARS), rng.randint(1, 12), rng.randint(1, 28)]
        exp = _add_months(mfd, rng.randint(max(3, s_lo), s_hi))
        lettered = rng.sample(PARTS, 6)
        # letters in no order down the label, so no part's letter follows from where it sits
        letters = sorted([[L, part] for L, part in zip(rng.sample("ABCDEF", 6), lettered)])
        return {**base, "kind": "label", "mass": mass, "price": price, "mfd": mfd, "exp": exp,
                "batch": f"B{rng.randint(1000, 9999)}", "ingredients": ingredients,
                "po_box": rng.randint(100, 4999), "letters": letters}
    shortest = max(3, s_lo)
    while True:
        # Every pack is made within a window shorter than the shortest shelf life, so all were made before the first
        # expires, and so before either date a question asks about (P4 review: a pack made after the shelf check).
        start = rng.randint(_day([2024, 1, 1]), _day([2025, 12, 28]))
        packs = []
        for L in "PQRS":
            mfd = _from_day(start + rng.randint(0, 28 * shortest - 15))
            mfd[2] = min(mfd[2], 28)  # a day every month has, so the expiry falls on the same day
            packs.append([L, f"B{rng.randint(1000, 9999)}", mfd, _add_months(mfd, rng.randint(shortest, s_hi))])
        ends = sorted(_day(x[3]) for x in packs)
        if len({x[1] for x in packs}) < 4 or min(b - a for a, b in zip(ends, ends[1:])) < 10:
            continue
        first = _from_day(rng.randint(ends[0] + 1, ends[1] - 1))
        k = rng.choice([2, 3])
        second = _from_day(rng.randint(ends[k - 1] + 1, ends[k] - 1))
        if max(_day(x[2]) for x in packs) > _day(first):
            continue
        return {**base, "kind": "shelf", "packs": packs, "check": first, "check2": second}


def _mark(ax, x: float, y: float, r: float = 0.22, caption: bool = True) -> None:
    """A generic standards mark: an S in a circle (no real organisation's logo)."""
    ax.add_patch(Circle((x, y), r, facecolor="white", edgecolor=INK, linewidth=1.6))
    ax.add_patch(Circle((x, y), r * 0.8, facecolor="none", edgecolor=INK, linewidth=0.8))
    ax.text(x, y, "S", ha="center", va="center", fontsize=13 if r > 0.2 else 10, fontweight="bold")
    if caption:
        ax.text(x, y - r - 0.13, "Standards mark", ha="center", va="center", fontsize=8)


def _letter(ax, x: float, y: float, L: str) -> None:
    ax.add_patch(Circle((x, y), 0.15, facecolor="white", edgecolor=INK, linewidth=1.2))
    ax.text(x, y, L, ha="center", va="center", fontsize=10.5, fontweight="bold")


def _leader(ax, x0: float, x1: float, y: float, L: str) -> None:
    ax.plot([x0, x1], [y, y], color=INK, linewidth=0.9, gid=f"leader-{L}")


def _draw_label(p: dict):
    width, height = 6.6, 4.35
    fig, ax = page(width, height)
    x0, y0, w, h = 0.85, 0.5, 4.9, 3.55
    ax.add_patch(FancyBboxPatch((x0, y0), w, h, boxstyle="round,pad=0,rounding_size=0.15", facecolor="#fbfaf4",
                                edgecolor=INK, linewidth=1.5))
    left, right = x0 + 0.22, x0 + 2.85
    noun = "Net weight" if p["unit"] == "g" else "Net volume"
    rows = {  # part: (x, y, text, size, bold, which side its letter is on)
        "name": (x0 + w / 2, y0 + 3.15, p["product"], 17, True, "l"),
        "mass": (left, y0 + 2.62, f"{noun}: {p['mass']} {p['unit']}", 10, False, "l"),
        "price": (right, y0 + 2.62, f"Price: {fr(p['price'])} Frw", 10, True, "r"),
        "ingredients": (left, y0 + 2.17, f"Ingredients: {p['ingredients']}", 9.5, False, "l"),
        "mfd": (left, y0 + 1.72, f"MFD: {_date(p['mfd'])}", 10, False, "l"),
        "exp": (right, y0 + 1.72, f"EXP: {_date(p['exp'])}", 10, True, "r"),
        "batch": (left, y0 + 1.2, f"Batch No: {p['batch']}", 10, False, "l"),
        "address": (left, y0 + 0.42, f"Made by {p['maker']}, P.O. Box {p['po_box']}, {p['town']}, Rwanda", 8.5, False,
                    "l"),
    }
    letter_of = {part: L for L, part in p["letters"]}
    for part, (x, y, text, size, bold, side) in rows.items():
        centred = part == "name"
        ax.text(x, y, text, ha="center" if centred else "left", va="center", fontsize=size,
                fontweight="bold" if bold else "normal")
        if part in letter_of:
            tw = fit(text, size=size, bold=bold, pad=0)
            if side == "l":
                start = x - tw / 2 if centred else x
                _letter(ax, 0.4, y, letter_of[part])
                _leader(ax, 0.55, start - 0.06, y, letter_of[part])
            else:
                _letter(ax, width - 0.4, y, letter_of[part])
                _leader(ax, x + tw + 0.06, width - 0.55, y, letter_of[part])
    mx, my = right + 0.55, y0 + 1.25
    _mark(ax, mx, my)
    if "mark" in letter_of:
        _letter(ax, width - 0.4, my, letter_of["mark"])
        _leader(ax, mx + 0.24, width - 0.55, my, letter_of["mark"])
    ax.text(x0, 0.2, "Dates are day/month/year.", ha="left", va="center", fontsize=9, style="italic")
    return fig


def _draw_shelf(p: dict):
    width, height = 7.6, 3.9
    fig, ax = page(width, height)
    ax.text(0.15, height - 0.25, f"Four {p['container']}s of {p['product'].lower()} on a shop shelf", ha="left",
            va="center", fontsize=11.5, fontweight="bold")
    ax.text(0.15, height - 0.55, "Dates are day/month/year. A product must not be sold after its expiry date.",
            ha="left", va="center", fontsize=9.5)
    pw, gap = 1.7, 0.2
    for i, (L, batch, mfd, exp) in enumerate(p["packs"]):
        x = 0.15 + i * (pw + gap)
        ax.text(x + pw / 2, 2.95, f"Pack {L}", ha="center", va="center", fontsize=11, fontweight="bold")
        ax.add_patch(FancyBboxPatch((x, 0.35), pw, 2.3, boxstyle="round,pad=0,rounding_size=0.1", facecolor="#fbfaf4",
                                    edgecolor=INK, linewidth=1.3))
        ax.text(x + pw / 2, 2.38, p["product"], ha="center", va="center", fontsize=9 if len(p["product"]) > 14 else 10,
                fontweight="bold")
        ax.text(x + 0.12, 1.92, f"Batch: {batch}", ha="left", va="center", fontsize=9)
        ax.text(x + 0.12, 1.55, f"MFD: {_date(mfd)}", ha="left", va="center", fontsize=9)
        ax.text(x + 0.12, 1.18, f"EXP: {_date(exp)}", ha="left", va="center", fontsize=9, fontweight="bold")
        _mark(ax, x + pw / 2, 0.8, r=0.17)
    ax.plot([0.05, width - 0.05], [0.25, 0.25], color=INK, linewidth=2.2)
    return fig


def draw(p: dict):
    return _draw_label(p) if p["kind"] == "label" else _draw_shelf(p)


VERBS = ["reads", "checks", "looks at", "studies", "is shown"]
SETTINGS = ["in a supermarket in Kigali", "for a consumer education lesson", "before buying it", "at a shop in Huye",
            "for homework", "at a market stall in Musanze"]


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    product = p["product"].lower()
    if p["kind"] == "label":
        letters = [L for L, _ in p["letters"]]
        L, part = rng.choice(p["letters"])
        others = [x for x in letters if x != L]
        rng.shuffle(others)
        unit = p["unit"]
        noun = "net mass" if unit == "g" else "net volume"
        per = p["price"] * 100 // p["mass"]
        months = (p["exp"][0] - p["mfd"][0]) * 12 + p["exp"][1] - p["mfd"][1]
        return [
            mcq(f"{who} {rng.choice(VERBS)} this label on a {p['container']} of {product} {rng.choice(SETTINGS)}. "
                f"Which letter shows the {_words(part, unit)}?", L, others[:3], rng),
            short(f"Price per 100 {unit} = price ÷ {noun} × 100. What is the price per 100 {unit} of the {product} on "
                  f"this label, in Frw?", per, money(per)),
            short(rng.choice([f"How many months after its manufacture date does the {product} on this label expire?",
                              f"For how many months after it was made may the {product} on this label be sold?"]),
                  months, [f"{months} months", f"{months} month"]),
        ]
    packs = p["packs"]
    gone = min(packs, key=lambda x: _day(x[3]))[0]
    day2 = _day(p["check2"])
    ok = sum(1 for x in packs if _day(x[3]) >= day2)
    x = rng.choice(packs)
    months = (x[3][0] - x[2][0]) * 12 + x[3][1] - x[2][1]
    return [
        mcq(f"{who} works in a shop and checks these {p['container']}s of {product} on {_said(p['check'])}. Which pack "
            f"must be taken off the shelf that day?", gone, [y[0] for y in packs if y[0] != gone], rng),
        count(f"How many of the four {p['container']}s of {product} may still be sold on {_said(p['check2'])}?", ok,
              f"{p['container']}s", "packs"),
        short(f"For how many months after it was made may pack {x[0]} of the {product} be sold?", months,
              [f"{months} months", f"{months} month"]),
    ]
