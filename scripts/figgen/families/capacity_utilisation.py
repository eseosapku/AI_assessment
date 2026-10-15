"""Capacity utilisation (AL): a table of a Rwandan producer's maximum capacity and actual output, by month or by
factory, with the formula printed under it: capacity utilisation = actual output ÷ maximum capacity × 100. Two
sub-types: four to six months at one plant whose capacity grows part-way (a new machine), or four to six factories
of one firm in different towns, each with its own capacity.

The capacity utilisation of a named month or factory (a whole percentage), the month or factory where it was highest
(an MCQ; never the one with the highest output, which is among the options, as the capacities differ), and the spare
capacity of another (its formula in the stem). The highest utilisation leads the next by 3 points at least.
"""
from __future__ import annotations

import random

from matplotlib.patches import Rectangle

from ..core import INK, NAMES, mcq, new_figure, short

ID = "capacity_utilisation"
KIND = "business.document"
SUBJECT = "business"
BANDS = ("AL",)
CONCEPTS = ("business.capacity-and-capacity-utilisation",)
# A topic whose sections the book lists is reached only if one names what this figure teaches.
NEEDS = r"capacity"
# AS Level chapters listed without sections that share capacity but teach other things.
AVOID = r"marketing mix|inventory|lean production|costs \(A Level\)|operations planning|nature of operations"

MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October",
          "November", "December"]
TOWNS = ["Kigali", "Huye", "Musanze", "Rubavu", "Muhanga", "Nyagatare", "Rusizi", "Rwamagana"]
# (the plant, the firm with factories in several towns, the unit, the capacity range in the unit, its step)
MAKERS = [
    ("a shoe factory in Kigali", "a shoe company", "pairs", (2000, 6000), 500),
    ("a juice factory in Rwamagana", "a juice company", "bottles", (20000, 60000), 5000),
    ("a bakery in Huye", "a bakery chain", "loaves", (5000, 15000), 1000),
    ("a printing works in Muhanga", "a printing company", "books", (4000, 12000), 1000),
    ("a garment factory in Kigali", "a garment company", "shirts", (3000, 9000), 500),
    ("a maize mill in Nyagatare", "a milling company", "bags", (1000, 4000), 500),
]


def fr(n: int) -> str:
    return f"{n:,}".replace(",", " ")


def sample(rng: random.Random) -> dict:
    plant, company, unit, (lo, hi), step = rng.choice(MAKERS)
    by = rng.choice(["month", "factory"])
    while True:
        k = rng.randint(4, 6)
        if by == "month":
            start = rng.randrange(12 - k + 1)
            labels = MONTHS[start:start + k]
            before = rng.randrange(lo, hi + 1, step)
            after = before + step * rng.randint(1, 4)  # a new machine part-way through
            change = rng.randint(1, k - 1)
            caps = [before] * change + [after] * (k - change)
        else:
            labels = rng.sample(TOWNS, k)
            caps = [rng.randrange(lo, hi + 1, step) for _ in range(k)]
        utils = [rng.randint(55, 97) for _ in range(k)]
        if len(set(utils)) < k or sorted(utils)[-1] - sorted(utils)[-2] < 3:
            continue
        outs = [c * u // 100 for c, u in zip(caps, utils)]
        if any(c * u % 100 for c, u in zip(caps, utils)):
            continue
        best = utils.index(max(utils))
        most = outs.index(max(outs))
        if most == best or outs.count(max(outs)) > 1:
            continue
        rows = [[lab, c, o] for lab, c, o in zip(labels, caps, outs)]
        spare = rng.choice([i for i in range(k) if i != best])
        ask = rng.choice([i for i in range(k) if i not in (spare,)])
        return {"band": "AL", "firm": plant if by == "month" else company, "unit": unit, "by": by, "rows": rows,
                "ask": ask, "spare": spare}


def draw(p: dict):
    rows = p["rows"]
    head = ["Month" if p["by"] == "month" else "Factory", f"Maximum capacity\n({p['unit']})", f"Actual output\n({p['unit']})"]
    widths = [2.2, 2.6, 2.6]
    rh, hh = 0.42, 0.7
    total = sum(widths)
    top = 0.0
    fig, ax = new_figure(7.6, 0.42 * (len(rows) + 6))
    ax.text(0, top + 0.4, f"Capacity and output at {p['firm']}" if p["by"] == "month" else
            f"Capacity and output of {p['firm']}'s factories", ha="left", va="center", fontsize=11.5, fontweight="bold")
    x = 0.0
    for w, h in zip(widths, head):
        ax.add_patch(Rectangle((x, top - hh), w, hh, facecolor="#d9dee3", edgecolor=INK, linewidth=0.9))
        ax.text(x + w / 2, top - hh / 2, h, ha="center", va="center", fontsize=9.5, fontweight="bold")
        x += w
    for r, (label, cap, out) in enumerate(rows):
        y = top - hh - (r + 1) * rh
        x = 0.0
        for c, (w, v) in enumerate(zip(widths, (label, fr(cap), fr(out)))):
            ax.add_patch(Rectangle((x, y), w, rh, facecolor="white", edgecolor="#888888", linewidth=0.7))
            ax.text(x + 0.15 if c == 0 else x + w - 0.25, y + rh / 2, v, ha="left" if c == 0 else "right",
                    va="center", fontsize=10)
            x += w
    bottom = top - hh - len(rows) * rh
    ax.add_patch(Rectangle((0, bottom - 0.75), total, 0.5, facecolor="#fff6cc", edgecolor=INK, linewidth=1.0))
    ax.text(0.15, bottom - 0.5, "Capacity utilisation (%) = actual output ÷ maximum capacity × 100", ha="left",
            va="center", fontsize=9.5, fontweight="bold", gid="formula")
    ax.set_xlim(-0.05, total + 0.05)
    ax.set_ylim(bottom - 0.85, top + 0.65)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


VERBS = ["checks", "studies", "is given", "analyses", "reviews"]
SETTINGS = ["for the operations manager", "for a board meeting", "for an A Level business lesson",
            "before planning more output", "for a case study", "for homework"]


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    rows, unit = p["rows"], p["unit"]
    prep = "in" if p["by"] == "month" else "at"
    util = {lab: o * 100 // c for lab, c, o in rows}
    best = max(util, key=util.get)
    most = max(rows, key=lambda r: r[2])[0]
    label, cap, out = rows[p["ask"]]
    s_label, s_cap, s_out = rows[p["spare"]]
    u = util[label]
    others = [lab for lab, _, _ in rows if lab not in (best, most)]
    rng.shuffle(others)
    where = "month" if p["by"] == "month" else "factory"
    return [
        short(f"{who} {rng.choice(VERBS)} these figures for {p['firm']} {rng.choice(SETTINGS)}. "
              f"What was the capacity utilisation {prep} {label}, in %?", u, [f"{u}%", f"{u} %", f"{u} percent"]),
        mcq(rng.choice([f"In which {where} was capacity utilisation highest for {p['firm']}?",
                        f"For {p['firm']}, in which {where} was capacity utilisation highest?"]),
            best, [most] + others, rng),
        short(f"Spare capacity = maximum capacity − actual output. What was the spare capacity {prep} {s_label}, "
              f"in {unit}?", s_cap - s_out, [f"{s_cap - s_out} {unit}", f"{fr(s_cap - s_out)} {unit}",
                                             f"{s_cap - s_out} units"]),
    ]
