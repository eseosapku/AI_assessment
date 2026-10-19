"""An online shop's checkout page (UP; LS for Rwanda ICT S2 "ICT in Financial Transactions"; AL for the AS Business
chapter on e-commerce), drawn as a browser window: the address bar with its padlock and https address, the basket
(item, quantity, unit price, amount), the subtotal, a discount code at a printed % off the items, VAT at 18% of the
items after the discount (printed), a delivery fee, the total to pay left as "?", and the payment choice with a
"Pay now" button. Four parts are lettered, the padlock always among them.

The saving from the discount code (or the VAT), the total payable, and which lettered part shows that the payment page
is secure. Every amount is whole francs: the subtotal less the discount is a multiple of 50, so 18% of it is whole.
"""
from __future__ import annotations

import random

import numpy as np
from matplotlib.patches import Circle, FancyBboxPatch, Rectangle

from ..core import INK, NAMES, mcq, money, short
from ._accounts import page

ID = "ecommerce_checkout"
KIND = "business.document"
SUBJECT = "business"
BANDS = ("UP", "LS", "AL")
CONCEPTS = ("business.e-commerce", "business.ict-in-business", "business.technology-in-business-operations")
# Rwanda's ICT books teach online shopping and paying under computing (S2 "ICT in Financial Transactions", S5
# "E-Commerce, Social Media and Online Services").
ALSO = ("computing.online-payment-methods", "computing.computer-financial-transactions")
# A topic whose sections the book lists is reached only if its name or a section names online selling.
NEEDS = r"e-?commerce|online business|financial transactions|ict in business|technology in business"
# Sharing e-commerce or ICT but teaching other things: channels, online promotion, research, offices, aids to trade.
AVOID = (r"distribution|digital marketing|market research|aids to trade|^trade|office|reception|correspondence|records|"
         r"equipment|applications")
# The AS Level book lists its chapters without sections, and its e-commerce chapter shares only the marketing mix.
AL_CONCEPTS = ("business.e-commerce", "business.marketing-mix")
AL_AVOID = r"^(?!.*e-commerce)"


def concepts_for(p: dict) -> tuple[str, ...]:
    return AL_CONCEPTS if p["band"] == "AL" else CONCEPTS


def avoid_for(p: dict) -> str:
    """An AS Level checkout serves the chapter on e-commerce alone: its other chapters share the marketing mix."""
    return AL_AVOID if p["band"] == "AL" else AVOID


# (the shop as a question names it, its name on the page, its web address, goods with price range and step)
SHOPS = [
    ("an online craft shop in Kigali", "Imigongo Crafts", "www.imigongocrafts.rw",
     [("Woven basket", 8_000, 20_000, 500), ("Sisal table mat", 2_000, 5_000, 500), ("Beaded earrings", 3_000, 8_000, 500),
      ("Imigongo wall art", 15_000, 40_000, 1_000), ("Wooden bowl", 5_000, 12_000, 500)]),
    ("an online bookshop in Huye", "Huye Book Corner", "www.huyebookcorner.rw",
     [("Maths textbook", 6_000, 12_000, 500), ("Story book", 3_000, 7_000, 500), ("Atlas", 9_000, 16_000, 500),
      ("Dictionary", 8_000, 15_000, 500), ("Exercise books (10)", 2_000, 4_000, 500)]),
    ("an online farm shop in Musanze", "Musanze Farm Supplies", "www.musanzefarm.rw",
     [("Bean seeds (2 kg)", 3_000, 6_000, 500), ("Watering can", 4_000, 9_000, 500), ("Hoe", 3_000, 7_000, 500),
      ("Fertiliser (5 kg)", 6_000, 12_000, 500), ("Sprayer", 20_000, 40_000, 1_000)]),
    ("an online electronics shop in Kigali", "Nyarutarama Electronics", "www.nyarutaramaelectronics.rw",
     [("Headphones", 8_000, 25_000, 500), ("Phone charger", 3_000, 8_000, 500), ("Power bank", 12_000, 30_000, 1_000),
      ("Memory card", 5_000, 15_000, 500), ("Solar lamp", 10_000, 25_000, 1_000)]),
    ("an online clothes shop in Rubavu", "Rubavu Fashion", "www.rubavufashion.rw",
     [("Kitenge dress", 15_000, 35_000, 1_000), ("T-shirt", 4_000, 9_000, 500), ("Sandals", 5_000, 12_000, 500),
      ("School socks (3 pairs)", 2_000, 4_000, 500), ("Sun hat", 3_000, 8_000, 500)]),
]
CODES = ["KARIBU", "SAVE", "SHULE", "MURAKOZE", "PROMO"]
TOWNS = ["Huye", "Musanze", "Rubavu", "Nyagatare", "Muhanga", "Rusizi", "Rwamagana", "Kayonza", "Nyanza", "Karongi"]
DISCOUNTS = [5, 10, 15, 20, 25]
PARTS = ["padlock", "basket", "code", "delivery", "pay", "momo"]


def fr(n: int) -> str:
    return f"{n:,}".replace(",", " ")


def sample(rng: random.Random) -> dict:
    where, name, domain, goods = rng.choice(SHOPS)
    band = rng.choices(BANDS, weights=[7, 1.5, 1.5])[0]
    while True:
        picked = rng.sample(goods, rng.randint(2, 4))
        items = [[g, rng.randint(1, 3), rng.randrange(lo, hi + 1, step)] for g, lo, hi, step in picked]
        sub = sum(q * u for _, q, u in items)
        pct = rng.choice(DISCOUNTS)
        if sub * pct % 100:
            continue
        disc = sub * pct // 100
        if (sub - disc) * 18 % 100:
            continue
        delivery = rng.randrange(1_000, 5_001, 500)
        shown = {u for _, _, u in items} | {q * u for _, q, u in items} | {sub, delivery}
        vat = (sub - disc) * 18 // 100
        if shown & {disc, vat, sub - disc + vat + delivery}:
            continue
        parts = ["padlock"] + rng.sample(PARTS[1:], 3)
        # letters in no order down the page, so the padlock's letter cannot be guessed from where it sits
        letters = sorted([[L, part] for L, part in zip(rng.sample("ABCD", 4), parts)])
        return {"band": band, "shop": where, "name": name, "domain": f"https://{domain}/checkout", "items": items,
                "code": f"{rng.choice(CODES)}{pct}", "discount": pct, "delivery": delivery, "town": rng.choice(TOWNS),
                "letters": letters}


W = 7.6
X0, X1 = 0.75, 7.0  # the browser window's edges
LETTER_X = 0.35


def _letter(ax, y: float, L: str, to: float) -> None:
    ax.add_patch(Circle((LETTER_X, y), 0.15, facecolor="white", edgecolor=INK, linewidth=1.2))
    ax.text(LETTER_X, y, L, ha="center", va="center", fontsize=10.5, fontweight="bold")
    ax.plot([LETTER_X + 0.15, to], [y, y], color=INK, linewidth=0.9, gid=f"leader-{L}")


def _padlock(ax, x: float, y: float) -> None:
    ax.add_patch(Rectangle((x - 0.07, y - 0.08), 0.14, 0.11, facecolor=INK, edgecolor=INK, linewidth=0.8))
    t = np.linspace(0, np.pi, 20)
    ax.plot(x + 0.045 * np.cos(t), y + 0.03 + 0.06 * np.sin(t), color=INK, linewidth=1.4)


def draw(p: dict):
    H = 1.4 + 0.32 * (len(p["items"]) + 1) + 0.3 + 5 * 0.36 + 0.12 + 0.55  # tall enough for the basket's rows
    fig, ax = page(W, H)
    where = {part: L for L, part in p["letters"]}
    # the window and its address bar
    ax.add_patch(FancyBboxPatch((X0, 0.15), X1 - X0, H - 0.3, boxstyle="round,pad=0,rounding_size=0.08",
                                facecolor="white", edgecolor=INK, linewidth=1.4))
    ax.add_patch(Rectangle((X0, H - 0.75), X1 - X0, 0.6, facecolor="#e4e7ea", edgecolor=INK, linewidth=1.0))
    bar_y = H - 0.45
    ax.add_patch(FancyBboxPatch((X0 + 0.2, bar_y - 0.16), X1 - X0 - 0.4, 0.32, boxstyle="round,pad=0,rounding_size=0.1",
                                facecolor="white", edgecolor="#777777", linewidth=0.9))
    _padlock(ax, X0 + 0.42, bar_y)
    ax.text(X0 + 0.62, bar_y, p["domain"], ha="left", va="center", fontsize=9.5)
    if "padlock" in where:
        _letter(ax, bar_y, where["padlock"], X0 + 0.3)
    ax.text(X0 + 0.25, H - 1.05, f"{p['name']}: Checkout", ha="left", va="center", fontsize=12, fontweight="bold")
    # the basket
    cols = [X0 + 0.25, X0 + 2.55, X0 + 3.1, X0 + 4.55, X1 - 0.25]  # item | qty | unit price | amount edges
    top = H - 1.4
    rh = 0.32
    heads = ["Item", "Qty", "Unit price (Frw)", "Amount (Frw)"]
    ax.add_patch(Rectangle((cols[0], top - rh), cols[-1] - cols[0], rh, facecolor="#d9dee3", edgecolor=INK, linewidth=0.9))
    for j, h in enumerate(heads):
        ax.text((cols[j] + cols[j + 1]) / 2, top - rh / 2, h, ha="center", va="center", fontsize=9, fontweight="bold")
    if "basket" in where:
        _letter(ax, top - rh / 2, where["basket"], cols[0] - 0.04)
    y = top - rh
    for item, qty, unit in p["items"]:
        ax.add_patch(Rectangle((cols[0], y - rh), cols[-1] - cols[0], rh, facecolor="white", edgecolor="#888888",
                               linewidth=0.7))
        ax.text(cols[0] + 0.1, y - rh / 2, item, ha="left", va="center", fontsize=9.5)
        ax.text((cols[1] + cols[2]) / 2, y - rh / 2, str(qty), ha="center", va="center", fontsize=9.5)
        ax.text(cols[3] - 0.12, y - rh / 2, fr(unit), ha="right", va="center", fontsize=9.5)
        ax.text(cols[4] - 0.12, y - rh / 2, fr(qty * unit), ha="right", va="center", fontsize=9.5)
        y -= rh
    # the summary
    sub = sum(q * u for _, q, u in p["items"])
    amount_x = cols[4] - 0.12
    lines = [("subtotal", "Subtotal (items)", fr(sub), False),
             ("code", f"Discount code {p['code']}: {p['discount']}% off the items", "?", False),
             ("vat", "VAT at 18% of the items after the discount", "?", False),
             ("delivery", f"Delivery to {p['town']}", fr(p["delivery"]), False),
             ("total", "Total to pay", "?", True)]
    y -= 0.3
    for key, label, amount, bold in lines:
        if key == "code":
            ax.add_patch(Rectangle((cols[0], y - 0.15), 1.35, 0.3, facecolor="#f4f6f8", edgecolor="#777777", linewidth=0.8))
            ax.text(cols[0] + 0.08, y, p["code"], ha="left", va="center", fontsize=9.5, fontweight="bold")
            ax.text(cols[0] + 1.45, y, f"code applied: {p['discount']}% off the items", ha="left", va="center",
                    fontsize=9.5)
        else:
            ax.text(cols[0] + 0.08, y, label, ha="left", va="center",
                    fontsize=10 if bold else 9.5, fontweight="bold" if bold else "normal")
        ax.text(amount_x, y, amount, ha="right", va="center", fontsize=10 if bold else 9.5,
                fontweight="bold" if bold or amount == "?" else "normal")
        if key in where:
            _letter(ax, y, where[key], cols[0] - 0.04)
        if key == "total":
            ax.plot([cols[3], cols[4]], [y + 0.2, y + 0.2], color=INK, linewidth=0.9)
        y -= 0.36
    # paying
    y -= 0.12
    ax.text(cols[0] + 0.08, y, "Pay with:", ha="left", va="center", fontsize=9.5, fontweight="bold")
    for k, (choice, xx) in enumerate((("Mobile money", cols[0] + 1.05), ("Card", cols[0] + 2.55))):
        ax.add_patch(Circle((xx, y), 0.07, facecolor=INK if k == 0 else "white", edgecolor=INK, linewidth=1.0))
        ax.text(xx + 0.13, y, choice, ha="left", va="center", fontsize=9.5)
    if "momo" in where:
        _letter(ax, y, where["momo"], cols[0] - 0.04)
    bx = cols[4] - 1.25
    ax.add_patch(FancyBboxPatch((bx, y - 0.17), 1.25, 0.34, boxstyle="round,pad=0,rounding_size=0.08",
                                facecolor="#4a5560", edgecolor=INK, linewidth=1.0))
    ax.text(bx + 0.625, y, "Pay now", ha="center", va="center", fontsize=10, fontweight="bold", color="white")
    if "pay" in where:
        L = where["pay"]
        ax.add_patch(Circle((W - 0.3, y), 0.15, facecolor="white", edgecolor=INK, linewidth=1.2))
        ax.text(W - 0.3, y, L, ha="center", va="center", fontsize=10.5, fontweight="bold")
        ax.plot([cols[4] + 0.04, W - 0.45], [y, y], color=INK, linewidth=0.9, gid=f"leader-{L}")
    return fig


VERBS = ["is buying from", "orders from", "shops at", "buys a gift from", "places an order with"]
SETTINGS = ["on a phone", "on a laptop at home", "for a school project", "during a lesson on e-commerce",
            "with a parent", "before the holidays"]


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    sub = sum(q * u for _, q, u in p["items"])
    disc = sub * p["discount"] // 100
    vat = (sub - disc) * 18 // 100
    total = sub - disc + vat + p["delivery"]
    intro = f"{who} {rng.choice(VERBS)} {p['shop']} {rng.choice(SETTINGS)}. "
    if rng.random() < 0.6:
        first = short(intro + f"How much does the discount code {p['code']} save on this order, in Frw?", disc,
                      money(disc))
    else:
        first = short(intro + "How much VAT is charged on this order, in Frw?", vat, money(vat))
    pad = next(L for L, part in p["letters"] if part == "padlock")
    others = [L for L, part in p["letters"] if part != "padlock"]
    rng.shuffle(others)
    return [
        first,
        short(rng.choice(["What is the total to pay for this order, in Frw?",
                          f"What is the total amount to pay {p['name']} for this order, in Frw?"]), total, money(total)),
        mcq(rng.choice([f"Which lettered part of the {p['name']} checkout page shows that it is secure to pay on?",
                        f"Before paying {p['name']} online, which lettered part shows that the page is secure?"]),
            pad, others, rng),
    ]
