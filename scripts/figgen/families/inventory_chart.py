"""Inventory (stock) control charts (UP): the saw-tooth of a Rwandan shop's stock over 12 to 20 weeks, as the Cambridge
IGCSE Business coursebook draws it. Stock is used at a steady rate; an order is placed when it falls to the reorder
level, and arrives a lead time later, just as the stock reaches the buffer stock, lifting it back to the maximum. The
reorder level and the buffer stock are labelled horizontal lines; weeks across, units up.

The maximum stock, the reorder quantity (the size of a delivery), the lead time in weeks (the stem says when an order
is placed), and the buffer stock. Every level is on a labelled gridline and every delivery and order falls on a
whole week, so each value reads exactly.
"""
from __future__ import annotations

import random

from ..core import GRID, INK, NAMES, count, new_figure

ID = "inventory_chart"
KIND = "graph.line"
SUBJECT = "business"
BANDS = ("UP",)
ALSO_BANDS = {"UP": ("AL",)}  # the same chart in Cambridge AS Level Business
# IGCSE teaches the chart under "Production of goods and services"; Rwanda S6 under "Stock control".
CONCEPTS = ("business.inventory-management", "business.production-of-goods-and-services")
# A topic whose sections the book lists is reached only if one names what this figure teaches.
NEEDS = r"stock|inventor|buffer|re-?order|lead time|warehous|production of goods"
AVOID = r"office"
# Cost accounting's materials control teaches the same chart: reorder level, minimum (buffer) and maximum stock.
ALSO = ("accounting.materials-management",)

# (what is stocked, its unit, where)
ITEMS = [
    ("bags of cement", "bags", "a hardware shop in Musanze"),
    ("crates of soda", "crates", "a shop in Kigali"),
    ("sacks of flour", "sacks", "a bakery in Huye"),
    ("boxes of exercise books", "boxes", "a stationery shop in Muhanga"),
    ("bags of animal feed", "bags", "a farm supply store in Nyagatare"),
    ("cartons of milk", "cartons", "a supermarket in Rubavu"),
    ("bags of rice", "bags", "a wholesaler in Rusizi"),
    ("tins of paint", "tins", "a hardware shop in Rwamagana"),
]


def sample(rng: random.Random) -> dict:
    item, unit, place = rng.choice(ITEMS)
    while True:
        step = rng.choice([10, 20, 50, 100])
        cycle = rng.randint(4, 8)  # weeks between deliveries
        lead = rng.randint(1, min(3, cycle - 2))
        use = step * rng.choice([1, 2, 3, 4, 5, 6]) // rng.choice([1, 2])  # units used a week
        buffer = step * rng.randint(1, 4)
        reorder, top = buffer + use * lead, buffer + use * cycle
        if reorder % step or top % step or top // step > 12 or top - reorder < step:
            continue
        before = rng.randint(0, cycle - lead - 1)  # weeks of the first cycle gone by at week 0
        first = cycle - before
        weeks = first + cycle * rng.randint(1, 3) + rng.randint(1, cycle - 1)  # never ends on a delivery
        if not 12 <= weeks <= 20:
            continue
        return {"band": "UP", "item": item, "unit": unit, "place": place, "step": step, "use": use, "max": top,
                "buffer": buffer, "reorder": reorder, "lead": lead, "cycle": cycle, "first": first, "weeks": weeks}


def _line(p: dict) -> tuple[list, list]:
    """The stock level's corners: falling at the weekly rate, jumping from the buffer to the maximum at each delivery."""
    top, low, use, weeks = p["max"], p["buffer"], p["use"], p["weeks"]
    x, y = [0], [low + use * p["first"]]
    t = p["first"]
    while t <= weeks:
        x += [t, t]
        y += [low, top]
        t += p["cycle"]
    end = t - p["cycle"]
    x.append(weeks)
    y.append(top - use * (weeks - end))
    return x, y


def draw(p: dict):
    fig, ax = new_figure(7.4, 4.6)
    weeks, step = p["weeks"], p["step"]
    room = 0.21 * weeks + 0.8  # past the last week, where the two levels are named; the labels' width in weeks
    ymax = p["max"] + step
    x, y = _line(p)
    ax.plot(x, y, color=INK, linewidth=2.0, gid="stock")
    ax.plot([0, weeks + room], [p["reorder"]] * 2, color=INK, linewidth=1.3, linestyle="--", gid="reorder")
    ax.plot([0, weeks + room], [p["buffer"]] * 2, color=INK, linewidth=1.3, linestyle=":", gid="buffer")
    gap = (ymax / 30)
    ax.text(weeks + 0.25, p["reorder"] + gap, "Reorder level", ha="left", va="bottom", fontsize=9, fontweight="bold")
    ax.text(weeks + 0.25, p["buffer"] + gap, "Buffer stock", ha="left", va="bottom", fontsize=9, fontweight="bold")
    ax.set_xticks(range(0, weeks + 1))
    ax.set_yticks(range(0, ymax + 1, step))
    ax.grid(True, color=GRID, linewidth=0.6)
    ax.set_axisbelow(True)
    ax.set_xlim(0, weeks + room)
    ax.set_ylim(0, ymax)
    ax.tick_params(labelsize=8)
    ax.set_xlabel("Time (weeks)")
    ax.set_ylabel(f"Stock ({p['unit']})")
    ax.set_title(f"Stock of {p['item']}")
    return fig


VERBS = ["manages", "keeps track of", "controls", "records"]
SETTINGS = ["with this chart", "using this stock chart", "and draws this chart", "and plots it on this chart"]


def questions(p: dict, rng: random.Random) -> list:
    who, friend = rng.sample(NAMES, 2)
    unit = p["unit"]
    quantity = p["max"] - p["buffer"]
    lead = (p["reorder"] - p["buffer"]) // p["use"]
    return [
        count(f"{who} {rng.choice(VERBS)} the stock of {p['item']} at {p['place']} {rng.choice(SETTINGS)}. "
              f"What is the maximum stock level, in {unit}?", p["max"], unit, "units"),
        count(rng.choice([f"How many {unit} arrive in each delivery (the reorder quantity)?",
                          f"{friend} unpacks each delivery. What is the reorder quantity, in {unit}?",
                          f"What is the reorder quantity: how many {unit} come in each delivery?"]), quantity, unit, "units"),
        count(rng.choice(["An order is placed each time the stock falls to the reorder level. What is the lead time, in weeks?",
                          f"{friend} places an order when the stock falls to the reorder level. How long is the lead "
                          f"time, in weeks?"]), lead, "weeks"),
        count(rng.choice([f"What is the buffer stock, in {unit}?",
                          f"How many {unit} are kept as buffer stock?"]), p["buffer"], unit, "units"),
    ]
