"""Menstrual cycles (LS, UP, AL): a 28-day graph of the thickness of the lining of the uterus, on a grid of whole days
and half millimetres, with menstruation shaded from day 0. At Lower Secondary ovulation is marked by a dashed line.
Upper Secondary and A level add a panel above, on the same days: oestrogen and progesterone (ovulation still marked),
or LH and FSH (ovulation not marked: the stem says it happened on the day LH peaked).

How many days menstruation lasts, the day of ovulation, the lining's thickness on a day, and from the hormones either
how many days the progesterone peak comes after the oestrogen peak, or how much higher LH peaks than FSH.

The lining breaks down during menstruation, thickens steadily after it and is thickest after ovulation; it runs through
knots on the grid without overshooting them. Oestrogen peaks a day or two before ovulation and progesterone about a
week after it, low until ovulation; LH and FSH peak together on the day of ovulation, FSH with a smaller rise early in
the cycle. Each hormone is a base level plus smooth bumps that are zero beyond their half-widths, so every peak is
exactly on a whole day and a whole unit.
"""
from __future__ import annotations

import math
import random

from matplotlib.patches import Rectangle

from ..core import GRID, INK, NAMES, count, exact, measure, short

ID = "menstrual_cycle"
KIND = "graph.line"
SUBJECT = "biology"
BANDS = ("LS", "UP", "AL")
CONCEPTS = tuple(f"biology.{c}" for c in ("female-reproductive-system", "reproduction-humans", "endocrine-system-structure-function"))
AVOID = r"plant|immun|transport|gas|circulat|glucose|nervous|excretion|homeostasis|digest|genetic|inherit|growth|physiology"
# A topic whose sections the book lists is reached only if one names what this figure teaches.
NEEDS = r"menstru|sex hormones|hormonal communication|birth control"
PAIRS = ["oestrogen-progesterone", "LH-FSH"]


def sample(rng: random.Random) -> dict:
    band = rng.choice(BANDS)
    mens = rng.choice([4, 5, 6])
    ov = rng.choice([12, 14, 16])
    mid = ov - 4
    thickest = rng.choice([20, 22])
    while True:  # a steady rise: no stretch of it more than twice as steep as another, so the curve has no kinks
        low = rng.choice([1.0, 1.5])
        vmid = low + rng.choice([1.0, 1.5, 2.0, 2.5])
        vov = vmid + rng.choice([1.0, 1.5, 2.0])
        top = vov + rng.choice([1.5, 2.0, 2.5, 3.0])
        slopes = [(vmid - low) / (mid - mens), (vov - vmid) / (ov - mid), (top - vov) / (thickest - ov)]
        if max(slopes) <= 2 * min(slopes):
            break
    lining = [[0, top], [mens, low], [mid, vmid], [ov, vov], [thickest, top], [28, top]]
    pair = None if band == "LS" else rng.choice(PAIRS)
    hormones = {}
    if pair == "oestrogen-progesterone":
        e = ov - rng.choice([1, 2])
        pk = rng.choice([d for d in (20, 21, 22) if d - 7 >= ov - 2])
        hormones = {"oestrogen": {"base": 1, "bumps": [[e, rng.choice([5, 6, 7]), 4], [21, rng.choice([2, 3]), 4]]},
                    "progesterone": {"base": 0.5, "bumps": [[pk, rng.choice([6, 7, 8]), 7]]}}
    elif pair == "LH-FSH":
        hormones = {"LH": {"base": 1, "bumps": [[ov, rng.choice([6, 7, 8]), 2.5]]},
                    "FSH": {"base": 1, "bumps": [[3, rng.choice([1, 2]), 4], [ov, rng.choice([3, 4]), 2.5]]}}
    return {"band": band, "menstruation": mens, "ovulation": ov, "lining": lining, "pair": pair, "hormones": hormones,
            "ask_day": rng.choice([mid, ov, thickest])}


def level(h: dict, t: float) -> float:
    return h["base"] + sum(height * (1 + math.cos(math.pi * (t - c) / w)) / 2 for c, height, w in h["bumps"] if abs(t - c) < w)


def _pchip(xs, ys, grid):
    """A monotone cubic through the knots: it never overshoots them, and passes exactly through each."""
    h = [xs[i + 1] - xs[i] for i in range(len(xs) - 1)]
    d = [(ys[i + 1] - ys[i]) / h[i] for i in range(len(h))]
    m = [d[0]] + [0.0 if d[i - 1] * d[i] <= 0 else 3 * (h[i - 1] + h[i]) / ((2 * h[i] + h[i - 1]) / d[i - 1] + (h[i] + 2 * h[i - 1]) / d[i])
                  for i in range(1, len(d))] + [d[-1]]
    out = []
    for x in grid:
        i = next((j for j in range(len(h)) if x <= xs[j + 1]), len(h) - 1)
        t = (x - xs[i]) / h[i]
        h00, h10, h01, h11 = 2 * t ** 3 - 3 * t ** 2 + 1, t ** 3 - 2 * t ** 2 + t, -2 * t ** 3 + 3 * t ** 2, t ** 3 - t ** 2
        out.append(h00 * ys[i] + h10 * h[i] * m[i] + h01 * ys[i + 1] + h11 * h[i] * m[i + 1])
    return out


DAYS = [k / 20 for k in range(0, 28 * 20 + 1)]  # every whole day lies on the grid exactly


def _days_axis(ax, labels: bool) -> None:
    ax.set_xlim(0, 28)
    ax.set_xticks(range(0, 29, 2))
    ax.set_xticks(range(0, 29), minor=True)
    ax.tick_params(labelsize=8.5, labelbottom=labels)


def draw(p: dict):
    import matplotlib.pyplot as plt
    pair = p["pair"]
    if pair:
        fig, (hx, ax) = plt.subplots(2, 1, figsize=(7.2, 6.6), sharex=False, gridspec_kw={"height_ratios": [1, 1.15], "hspace": 0.12})
    else:
        fig, ax = plt.subplots(figsize=(7.2, 4.2))
    knots = p["lining"]
    top = max(v for _, v in knots)
    ytop = math.ceil(top) + 2
    _days_axis(ax, True)
    ax.set_ylim(0, ytop)
    ax.set_yticks(range(0, ytop + 1))
    ax.set_yticks([v / 2 for v in range(0, 2 * ytop + 1)], minor=True)
    ax.grid(True, which="major", color=GRID, linewidth=0.8)
    ax.grid(True, which="minor", color=GRID, linewidth=0.35)
    ax.set_axisbelow(True)
    mens = p["menstruation"]
    ax.add_patch(Rectangle((0, 0), mens, ytop, facecolor="#e4c9c9", edgecolor="none", alpha=0.7, zorder=0.5, gid="menstruation"))
    ax.text(0.3, ytop - 0.55, "menstruation", ha="left", va="center", fontsize=8.5, style="italic")
    ax.plot(DAYS, _pchip([d for d, _ in knots], [v for _, v in knots], DAYS), color=INK, linewidth=2.0, gid="lining")
    ax.set_xlabel("Day of the menstrual cycle")
    ax.set_ylabel("Thickness of the lining\nof the uterus (mm)")
    ax.tick_params(labelsize=8.5)
    if pair != "LH-FSH":
        ov = p["ovulation"]
        ax.plot([ov, ov], [0, ytop - 1.25], color=INK, linewidth=1.0, linestyle=(0, (4, 3)))
        ax.annotate("ovulation", xy=(ov, ytop - 1.25), xytext=(ov, ytop - 0.55), ha="center", va="center", fontsize=8.5,
                    gid="ovulation")
    if pair:
        _days_axis(hx, False)
        hx.set_ylim(0, 10)
        hx.set_yticks(range(0, 11, 2))
        hx.set_yticks(range(0, 11), minor=True)
        hx.grid(True, which="major", color=GRID, linewidth=0.8)
        hx.grid(True, which="minor", color=GRID, linewidth=0.35)
        hx.set_axisbelow(True)
        for (name, h), style in zip(p["hormones"].items(), ["-", (0, (6, 3))]):
            hx.plot(DAYS, [level(h, t) for t in DAYS], color=INK, linewidth=1.8, linestyle=style, label=name, gid=f"hormone:{name}")
        hx.set_ylabel("Hormone level\n(arbitrary units)")
        hx.legend(loc="upper right", fontsize=9, frameon=True, framealpha=1.0, edgecolor=GRID, handlelength=2.6)
        hx.tick_params(labelsize=8.5)
    return fig


# --- questions --------------------------------------------------------------------------------------

SETTINGS = ["in a biology lesson", "for a health club talk in Kigali", "for revision at a school in Huye", "in a lesson on puberty",
            "for a class project in Musanze", "at the school health club in Rubavu", "from a textbook at a school in Nyanza"]
VERBS = ["studied", "copied", "looked at", "drew"]
GRAPHS = ["graph", "chart", "diagram"]
OVULATION = ["On which day of the cycle does ovulation happen?", "On which day is the egg released (ovulation)?",
             "On which day of this cycle does ovulation take place?"]


def _day(n: int) -> list[str]:
    return [str(n), f"day {n}", f"Day {n}", f"on day {n}"]


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    mens, ov = p["menstruation"], p["ovulation"]
    thick = dict((d, v) for d, v in p["lining"])
    d = p["ask_day"]
    qs = [count(f"{who} {rng.choice(VERBS)} this {rng.choice(GRAPHS)} of the menstrual cycle {rng.choice(SETTINGS)}. "
                "For how many days does menstruation last?", mens, "days")]
    if p["pair"] == "LH-FSH":
        qs.append(short("In this cycle, ovulation happened on the day that LH was at its peak. On which day did ovulation happen?",
                        ov, _day(ov)))
    else:
        qs.append(short(rng.choice(OVULATION), ov, _day(ov)))
    v = thick[d]
    qs.append(short(f"What is the thickness of the lining of the uterus on day {d}?", exact(v),
                    measure(v, "mm") + [f"{v:.1f}", f"{v:.1f} mm", f"{v:.1f}mm"]))
    hs = p["hormones"]
    if p["pair"] == "oestrogen-progesterone":
        e = max(DAYS, key=lambda t: level(hs["oestrogen"], t))
        pk = max(DAYS, key=lambda t: level(hs["progesterone"], t))
        gap = int(pk - e)
        qs.append(count("How many days after the oestrogen peak does progesterone reach its peak?", gap, "days"))
    elif p["pair"] == "LH-FSH":
        lh = max(level(hs["LH"], t) for t in DAYS)
        fsh = max(level(hs["FSH"], t) for t in DAYS)
        diff = int(round(lh - fsh))
        qs.append(short("How much higher is the peak of LH than the peak of FSH, in arbitrary units?", diff,
                        [str(diff), f"{diff} units", f"{diff} arbitrary units", f"{diff} au", f"{diff} a.u."]))
    return qs
