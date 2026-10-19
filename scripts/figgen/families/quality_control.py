"""Quality control and metrology (LS, UP; AS Level "Lean production and quality management" by name): three sub-types.

- chart: a control chart of ten to twelve samples of a Rwandan product (500 g bags of maize flour, 1 litre bottles of
  juice, 250 g bars of soap, 2 kg bags of sugar, 220 mm bricks), each sample's measurement on a gridline, with the
  target and the upper and lower control limits drawn and printed. How many samples are outside the limits, the first
  sample outside them, and how far a sample was above or below the target. No sample sits on a limit.
- batch: an inspection record of four or five batches (items checked, and the defective items by type of defect, each
  defective item counted once), with the formula printed: defect rate (%) = number of defective items ÷ number of
  items checked × 100. The defect rate of a batch (a whole number), the most common type of defect over all batches,
  and the batch with the highest defect rate (never the batch with the most defective items).
- ruler: three or four items (bars of soap, chalk sticks, candles, floor tiles) each measured on a ruler in cm and mm,
  with the standard length and its allowance printed. An item's length in cm, the one item that fails (or the only one
  that meets) the standard, and by how many millimetres an item is longer or shorter than the standard. No item is on
  the edge of the allowance. Upper Secondary rulers may start the item at 1 cm or 2 cm, so the length is a difference.
"""
from __future__ import annotations

import random

from matplotlib.patches import Rectangle

from ..core import GRID, INK, NAMES, mcq, new_figure, short

ID = "quality_control"
KIND = "graph.line"
SUBJECT = "business"
BANDS = ("LS", "UP")
# The inspection record and the control chart are the quality control of Cambridge AS Level Business's "Lean
# production and quality management", where that chapter's name says so.
ALSO_BANDS = {"UP": ("AL",)}
CONCEPTS = ("business.quality-management-and-control", "business.metrology-and-quality-testing",
            "business.standardisation-concept", "business.lean-production")
# A topic whose sections the book lists is reached only if its name or a section names quality, metrology or standards.
NEEDS = r"quality|metrolog|standard"
# Listed without sections, sharing quality, but teaching consumers' rights; or the environment.
AVOID = r"consumer|environment"


def concepts_for(p: dict) -> tuple:
    if p["kind"] == "ruler":
        return ("business.metrology-and-quality-testing", "business.standardisation-concept",
                "business.quality-management-and-control")
    return ("business.quality-management-and-control", "business.standardisation-concept", "business.lean-production")


# (product, what is measured, unit, target, limit either side, gridline step)
CHART_PRODUCTS = [("500 g bags of maize flour", "Mass", "g", 500, 10, 2), ("1 litre bottles of juice", "Volume", "ml", 1000, 15, 5),
                  ("250 g bars of soap", "Mass", "g", 250, 6, 2), ("2 kg bags of sugar", "Mass", "g", 2000, 20, 5),
                  ("220 mm bricks", "Length", "mm", 220, 4, 1)]
# (product, its defect types)
BATCH_PRODUCTS = [("school shirts", ["Loose button", "Torn seam", "Wrong size", "Stain"]),
                  ("bottles of juice", ["Leaking cap", "Torn label", "Underfilled", "Cracked bottle"]),
                  ("bags of maize flour", ["Torn bag", "Underweight", "Wet flour", "Missing date"]),
                  ("pairs of shoes", ["Loose sole", "Scratched leather", "Broken buckle", "Uneven stitching"]),
                  ("trays of eggs", ["Cracked shell", "Dirty shell", "Undersized egg", "Broken tray"])]
CHECKED = [50, 100, 200, 250, 400, 500]
# (items measured, standard lengths in mm to choose from, allowance in mm)
RULER_ITEMS = [("bars of soap", [80, 90, 100], 2), ("chalk sticks", [70, 80, 90], 2), ("candles", [110, 120, 130], 3),
               ("floor tiles", [100, 110, 120], 2), ("wooden pegs", [60, 70, 80], 2)]
SITES = ["at a factory in Kigali", "at a Huye workshop", "at a Musanze cooperative", "at a Rwamagana factory",
         "at a Muhanga plant", "at a Rubavu workshop"]


def _chart(rng: random.Random, band: str) -> dict:
    product, what, unit, t, lim, step = rng.choice(CHART_PRODUCTS)
    hi, lo = t + lim, t - lim
    n = rng.randint(10, 12)
    while True:
        inside = [v for v in range(lo + step, hi, step)]
        vals = [rng.choice(inside) for _ in range(n)]
        bad = rng.sample(range(n), rng.randint(1, 3))
        for i in bad:
            k = rng.randint(1, 3) * step
            vals[i] = hi + k if rng.random() < 0.5 else lo - k
        if sum(v == t for v in vals) > 3 or len(set(vals)) < 5:
            continue
        return {"band": band, "kind": "chart", "product": product, "what": what, "unit": unit, "target": t,
                "limit": lim, "step": step, "values": vals, "site": rng.choice(SITES)}


def _batch(rng: random.Random, band: str) -> dict:
    product, types = rng.choice(BATCH_PRODUCTS)
    types = rng.sample(types, rng.choice([3, 4]))
    while True:
        k = rng.randint(4, 5)
        rows = []
        for i in range(k):
            checked = rng.choice(CHECKED)
            rates = [r for r in range(2, 16) if r * checked % 100 == 0]
            total = rng.choice(rates) * checked // 100
            split = [0] * len(types)
            for _ in range(total):
                split[rng.randrange(len(types))] += 1
            rows.append([f"Batch {i + 1}", checked, split])
        rate = [sum(d) * 100 // n for _, n, d in rows]
        totals = [sum(r[2][j] for r in rows) for j in range(len(types))]
        most = [sum(r[2]) for r in rows]
        if sorted(rate)[-1] == sorted(rate)[-2] or sorted(totals)[-1] == sorted(totals)[-2]:
            continue
        if most.count(max(most)) > 1 or most.index(max(most)) == rate.index(max(rate)):
            continue
        return {"band": band, "kind": "batch", "product": product, "types": types, "rows": rows,
                "site": rng.choice(SITES)}


def _ruler(rng: random.Random, band: str) -> dict:
    item, stds, tol = rng.choice(RULER_ITEMS)
    std = rng.choice(stds)
    start = 0 if band == "LS" else rng.choice([0, 10, 20])
    fail_one = rng.random() < 0.5
    while True:
        k = rng.randint(3, 4)
        good = [std + d for d in range(-tol + 1, tol)]
        bad = [std + d for d in range(-tol - 4, tol + 5) if abs(d) > tol]
        if fail_one:
            lengths = rng.sample(good, min(k - 1, len(good))) + [rng.choice(bad)]
        else:
            lengths = rng.sample(bad, k - 1) + [rng.choice(good)]
        if len(lengths) != k or len(set(lengths)) != k:
            continue
        rng.shuffle(lengths)
        return {"band": band, "kind": "ruler", "item": item, "standard_mm": std, "tol_mm": tol, "start_mm": start,
                "lengths": [[letter, mm] for letter, mm in zip("ABCD", lengths)], "site": rng.choice(SITES)}


def sample(rng: random.Random) -> dict:
    band = rng.choice(BANDS)
    return rng.choice([_chart, _batch, _ruler])(rng, band)


def _draw_chart(p: dict):
    t, lim, step, vals, unit = p["target"], p["limit"], p["step"], p["values"], p["unit"]
    n = len(vals)
    fig, ax = new_figure(8.6, 4.8)
    lo_y, hi_y = t - lim - 4 * step, t + lim + 4 * step
    xs = list(range(1, n + 1))
    ax.plot(xs, vals, color=INK, linewidth=1.3, marker="o", markersize=5.5, markerfacecolor="white", zorder=4,
            gid="samples")
    right = n + 0.6
    for y, style, label in ((t + lim, (0, (6, 3)), f"Upper control limit {t + lim} {unit}"),
                            (t, "-", f"Target {t} {unit}"),
                            (t - lim, (0, (6, 3)), f"Lower control limit {t - lim} {unit}")):
        ax.plot([0.5, right], [y, y], color="#333333", linewidth=1.5, linestyle=style, zorder=3)
        ax.text(right + 0.15, y, label, ha="left", va="center", fontsize=9.5, fontweight="bold")
    ax.set_xticks(xs)
    ax.set_xlabel("Sample number")
    ax.set_ylabel(f"{p['what']} ({unit})")
    major = step * (2 if (hi_y - lo_y) / step > 16 else 1)
    first = lo_y + (-lo_y) % major
    ax.set_yticks([v for v in range(first, hi_y + 1, major)])
    ax.set_yticks([v for v in range(lo_y, hi_y + 1, step)], minor=True)
    ax.tick_params(which="minor", length=0)
    ax.tick_params(axis="y", labelsize=8.5)
    ax.yaxis.grid(True, which="both", color=GRID, linewidth=0.6)
    ax.set_axisbelow(True)
    ax.set_xlim(0.5, n + 5.2)
    ax.set_ylim(lo_y, hi_y)
    ax.spines["bottom"].set_bounds(0.5, right)
    ax.set_title(f"Control chart: {p['product']}", fontsize=11.5, pad=10)
    return fig


def _draw_batch(p: dict):
    types, rows = p["types"], p["rows"]
    widths = [1.6, 1.7] + [1.75] * len(types)
    total = sum(widths)
    rh, hh = 0.48, 0.8
    fig, ax = new_figure(1.0 + 0.9 * total, 0.45 * (len(rows) + 6))
    fig.subplots_adjust(left=0, right=1, bottom=0, top=1)
    ax.text(0, 0.5, f"Inspection record: {p['product']}", ha="left", va="center", fontsize=12, fontweight="bold")
    ax.text(sum(widths[:2]) + 0.05, 0.12, "Defective items, by type of defect", ha="left", va="center", fontsize=9.5,
            style="italic")
    head = ["Batch", "Items\nchecked"] + [t.replace(" ", "\n", 1) for t in types]
    x = 0.0
    for w, h in zip(widths, head):
        ax.add_patch(Rectangle((x, -hh), w, hh, facecolor="#d9dee3", edgecolor=INK, linewidth=0.9))
        ax.text(x + w / 2, -hh / 2, h, ha="center", va="center", fontsize=9.5, fontweight="bold")
        x += w
    for r, (label, checked, split) in enumerate(rows):
        y = -hh - (r + 1) * rh
        x = 0.0
        for c, (w, v) in enumerate(zip(widths, [label, checked] + split)):
            ax.add_patch(Rectangle((x, y), w, rh, facecolor="white", edgecolor="#888888", linewidth=0.7))
            ax.text(x + w / 2, y + rh / 2, str(v), ha="center", va="center", fontsize=10)
            x += w
    bottom = -hh - len(rows) * rh
    ax.text(0, bottom - 0.35, "Each defective item has only one defect.", ha="left", va="center", fontsize=9.5)
    ax.add_patch(Rectangle((0, bottom - 1.15), total, 0.5, facecolor="#fff6cc", edgecolor=INK, linewidth=1.0))
    ax.text(0.12, bottom - 0.9, "Defect rate (%) = number of defective items ÷ number of items checked × 100",
            ha="left", va="center", fontsize=9.5, fontweight="bold")
    ax.set_xlim(-0.05, max(total, 8.4) + 0.05)
    ax.set_ylim(bottom - 1.25, 0.8)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def _draw_ruler(p: dict):
    start, items = p["start_mm"], p["lengths"]
    top_mm = max(start + mm for _, mm in items)
    cms = top_mm // 10 + 2
    k = len(items)
    block = 2.3  # height of one item and its ruler, in cm
    fig, ax = new_figure(1.6 + 0.62 * (cms + 3), 1.1 + 0.62 * block * k + 0.9)
    fig.subplots_adjust(left=0, right=1, bottom=0, top=1)
    for i, (letter, mm) in enumerate(items):
        base = -i * block
        ax.add_patch(Rectangle((-0.35, base - 1.1), cms + 0.7, 1.1, facecolor="#f3ecd8", edgecolor=INK, linewidth=1.0))
        for t in range(cms * 10 + 1):
            h = 0.5 if t % 10 == 0 else 0.33 if t % 5 == 0 else 0.2
            ax.plot([t / 10, t / 10], [base, base - h], color=INK, linewidth=0.8 if t % 10 else 1.1)
            if t % 10 == 0:
                ax.text(t / 10, base - 0.78, str(t // 10), ha="center", va="center", fontsize=8.5)
        ax.add_patch(Rectangle((start / 10, base), mm / 10, 0.55, facecolor="#9aa4ad", edgecolor=INK, linewidth=1.0))
        for edge in (start / 10, (start + mm) / 10):
            ax.plot([edge, edge], [base, base + 0.55], color=INK, linewidth=1.2)
        ax.text(-0.55, base + 0.1, f"Item {letter}", ha="right", va="center", fontsize=10.5, fontweight="bold")
    ax.text(cms + 0.3, -(k - 1) * block - 1.35, "cm", ha="right", va="center", fontsize=9)
    std, tol = p["standard_mm"], p["tol_mm"]
    ax.text(-2.5, 1.45, f"Measuring {p['item']}", ha="left", va="center", fontsize=12, fontweight="bold")
    ax.text(-2.5, 0.95, f"Standard length: {std / 10:.1f} cm. An item meets the standard if its length is within "
                        f"{tol / 10:.1f} cm of the standard.", ha="left", va="center", fontsize=9.5)
    ax.set_xlim(-2.6, cms + 0.45)
    ax.set_ylim(-(k - 1) * block - 1.6, 1.75)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def draw(p: dict):
    return {"chart": _draw_chart, "batch": _draw_batch, "ruler": _draw_ruler}[p["kind"]](p)


VERBS = ["checks", "studies", "is given", "analyses", "reviews"]
SETTINGS = ["for the quality manager", "for an entrepreneurship lesson", "for a class test", "for homework",
            "before the goods are sent out", "for a project on quality"]


MEASURES = ["measures", "checks", "tests", "inspects", "compares"]


def _measure(n: int, unit: str) -> list[str]:
    return [f"{n} {unit}", f"{n}{unit}"]


def _chart_questions(p: dict, rng: random.Random, who: str) -> list:
    t, lim, vals, unit, product = p["target"], p["limit"], p["values"], p["unit"], p["product"]
    out = [i + 1 for i, v in enumerate(vals) if v > t + lim or v < t - lim]
    j = rng.choice([i + 1 for i, v in enumerate(vals) if v != t])
    v = vals[j - 1]
    way = "above" if v > t else "below"
    return [
        short(f"{who} {rng.choice(VERBS)} this control chart for {product} {p['site']}. How many samples are outside "
              f"the control limits?", len(out), [f"{len(out)} samples"] if len(out) != 1 else ["1 sample"]),
        short(f"On the control chart for {product}, which is the first sample outside the control limits? Give the "
              f"sample number.", out[0], [f"Sample {out[0]}", f"sample {out[0]}"]),
        short(f"On the control chart for {product}, by how many {unit} was sample {j} {way} the target?", abs(v - t),
              _measure(abs(v - t), unit)),
    ]


def _batch_questions(p: dict, rng: random.Random, who: str) -> list:
    rows, types, product = p["rows"], p["types"], p["product"]
    rate = {lab: sum(d) * 100 // n for lab, n, d in rows}
    label = rng.choice(list(rate))
    totals = [sum(r[2][j] for r in rows) for j in range(len(types))]
    common = types[totals.index(max(totals))]
    best = max(rate, key=rate.get)
    most = max(rows, key=lambda r: sum(r[2]))[0]
    others = [lab for lab in rate if lab not in (best, most)]
    rng.shuffle(others)
    return [
        short(f"{who} {rng.choice(VERBS)} this inspection record for {product} {p['site']}. What was the defect rate "
              f"of {label}, in %?", rate[label], [f"{rate[label]}%", f"{rate[label]} %", f"{rate[label]} percent"]),
        mcq(f"In the inspection record for {product}, which type of defect was the most common over all the batches?",
            common, [x for x in types if x != common], rng),
        mcq(f"In the inspection record for {product}, which batch had the highest defect rate?", best,
            [most] + others, rng),
    ]


def _ruler_questions(p: dict, rng: random.Random, who: str) -> list:
    std, tol, item = p["standard_mm"], p["tol_mm"], p["item"]
    lengths = dict((letter, mm) for letter, mm in p["lengths"])
    letter = rng.choice(list(lengths))
    mm = lengths[letter]
    cm = f"{mm // 10}.{mm % 10}" if mm % 10 else str(mm // 10)
    ok = {k: abs(v - std) < tol for k, v in lengths.items()}
    bad = [k for k, v in ok.items() if not v]
    options = [f"Item {k}" for k in lengths]
    if len(bad) == 1:
        odd = mcq(f"Which of the {item} does not meet the standard?", f"Item {bad[0]}",
                  [o for o in options if o != f"Item {bad[0]}"], rng)
    else:
        good = next(k for k, v in ok.items() if v)
        odd = mcq(f"Which of the {item} is the only one that meets the standard?", f"Item {good}",
                  [o for o in options if o != f"Item {good}"], rng)
    other = rng.choice([k for k, v in lengths.items() if v != std and k != letter] or
                       [k for k, v in lengths.items() if v != std])
    d = lengths[other] - std
    return [
        short(f"{who} {rng.choice(MEASURES)} {item} against the standard {p['site']}. What is the length of item {letter}, "
              f"in cm?", cm, [f"{cm} cm", f"{cm}cm", f"{mm} mm", f"{mm}mm"]),
        odd,
        short(f"By how many millimetres is item {other} {'longer' if d > 0 else 'shorter'} than the standard length?",
              abs(d), _measure(abs(d), "mm")),
    ]


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    return {"chart": _chart_questions, "batch": _batch_questions, "ruler": _ruler_questions}[p["kind"]](p, rng, who)
