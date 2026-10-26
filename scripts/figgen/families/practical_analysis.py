"""Practical analysis (AS & A Level Biology): three skills of the practical chapters, each with its rule printed.

Uncertainty: a results table of three repeats at five values, the instrument's smallest division printed with
"uncertainty = ± half the smallest division" and "percentage error = uncertainty ÷ reading × 100". Asks a row's
mean, the percentage error of a named reading, the range of a row's repeats, and the uncertainty of each reading.

Spearman's rank: two variables measured in 6 to 10 quadrats, their ranks, d and d², one row left as "?", and Σd²
printed; the formula, the ranking rule and the critical value at p = 0.05 for that n printed (Zar's table). Asks a
missing rank, rs to 2 decimal places, and what rs shows (sign, and significant or not by the printed value; never
within 0.08 of it).

Error bars: three groups' means as bars with mean ± 2SE error bars on gridlines, and the printed rule that bars which
do not overlap show a significant difference. Asks which pair differs significantly (or none), a mean, the top of an
error bar. Every overlap or gap is at least one gridline step.
"""
from __future__ import annotations

import random
from fractions import Fraction

from matplotlib.patches import Rectangle

from ..core import FILL_2, GRID, INK, NAMES, exact, mcq, new_figure, short

ID = "practical_analysis"
KIND = "table.data"
SUBJECT = "biology"
BANDS = ("AL",)
CONCEPTS = tuple(f"biology.{c}" for c in (
    "variables-measurement", "error-sources-improvements", "apparatus-selection-practical", "scientific-data-description",
    "correlation-pearson", "scientific-analysis-conclusions-evaluation", "bar-charts-histograms"))
SUB_CONCEPTS = {
    "uncertainty": ("variables-measurement", "error-sources-improvements", "apparatus-selection-practical",
                    "scientific-data-description"),
    "spearman": ("correlation-pearson", "scientific-analysis-conclusions-evaluation", "scientific-data-description"),
    "error_bars": ("scientific-analysis-conclusions-evaluation", "scientific-data-description", "bar-charts-histograms"),
}
# The practical chapters' sections name what this teaches; the conservation chapter's "Correlation" section takes
# the Spearman sub-type only (avoid_for).
NEEDS = (r"practical|planning|analysis|evaluat|uncertaint|variables|correlation|spearman|statistic|making calculations|"
         r"sources of error|describing data|recording")
AVOID = r"glossary|science in context|sexual|pregnan|hiv|reproduction system|social factors"


def concepts_for(p: dict) -> tuple:
    return tuple(f"biology.{c}" for c in SUB_CONCEPTS[p["kind"]])


def avoid_for(p: dict) -> str:
    return AVOID if p["kind"] == "spearman" else AVOID + "|biodiversity"


# --- uncertainty -------------------------------------------------------------------------------------------
UNC = {
    "catalase": {"title": "Oxygen released by catalase from potato", "iv_head": "Temperature / °C",
                 "levels": [20, 30, 40, 50, 60], "unit": "°C", "dv_head": "Volume of oxygen in 2 minutes / cm³",
                 "instrument": "gas syringe", "shape": [0.45, 0.75, 1.0, 0.7, 0.3]},
    "yeast": {"title": "Carbon dioxide released by yeast", "iv_head": "Glucose concentration / %",
              "levels": [1, 2, 3, 4, 5], "unit": "%", "dv_head": "Volume of carbon dioxide in 10 minutes / cm³",
              "instrument": "measuring cylinder", "shape": [0.3, 0.5, 0.7, 0.85, 1.0]},
    "pondweed": {"title": "Oxygen released by pondweed", "iv_head": "Light intensity / arbitrary units",
                 "levels": [1, 2, 3, 4, 5], "unit": "units", "dv_head": "Volume of oxygen in 5 minutes / cm³",
                 "instrument": "gas syringe", "shape": [0.25, 0.45, 0.65, 0.85, 1.0]},
}
# Readings whose percentage error terminates within two decimal places, by smallest division.
CLEAN = {1: [5, 8, 10, 20, 25, 40, 50], 2: [4, 8, 10, 20, 40, 50]}


def _level(setup: dict, v) -> str:
    return f"{v} °C" if setup["unit"] == "°C" else (f"{v}%" if setup["unit"] == "%" else f"{v} units")


def _uncertainty(rng: random.Random) -> dict:
    key = rng.choice(sorted(UNC))
    s = UNC[key]
    d = rng.choice([1, 2])
    while True:
        top = rng.randrange(36, 61, 2)
        rows = []
        for f in s["shape"]:
            t = round(top * f / d) * d
            row = [max(d * 2, t + d * rng.randint(-2, 2)) for _ in range(3)]
            rows.append(row)
        clean = [(i, j) for i in range(5) for j in range(3) if rows[i][j] in CLEAN[d]]
        means = [i for i in range(5) if sum(rows[i]) % 3 == 0]
        spread = [i for i in range(5) if max(rows[i]) > min(rows[i])]
        if clean and means and spread:
            break
    ask_pct = list(rng.choice(clean))
    return {"setup": key, "division": d, "trials": rows, "ask_pct": ask_pct, "ask_mean": rng.choice(means),
            "ask_range": rng.choice(spread)}


# --- Spearman ----------------------------------------------------------------------------------------------
SPEAR = {
    "light": {"x": "Light intensity / lux", "x_short": "light intensity", "y": "Number of plantain plants",
              "y_short": "number of plantain plants", "xr": (150, 2000, 10), "yr": (0, 40, 1)},
    "water": {"x": "Soil water content / %", "x_short": "soil water content", "y": "Percentage cover of moss / %",
              "y_short": "percentage cover of moss", "xr": (8, 60, 1), "yr": (2, 95, 1)},
    "path": {"x": "Distance from the footpath / m", "x_short": "distance from the footpath",
             "y": "Number of daisy plants", "y_short": "number of daisy plants", "xr": (1, 30, 1), "yr": (0, 50, 1)},
}
# Critical values of rs at p = 0.05 (two-tailed), Zar's table.
CRITICAL = {6: "0.886", 7: "0.786", 8: "0.738", 9: "0.700", 10: "0.648"}
CLASSES = ["sig+", "sig-", "ns+", "ns-"]


def ranks(vals: list) -> list[int]:
    order = sorted(vals)
    return [order.index(v) + 1 for v in vals]


def rs_of(x: list, y: list) -> tuple[int, Fraction]:
    n = len(x)
    d2 = sum((a - b) ** 2 for a, b in zip(ranks(x), ranks(y)))
    return d2, 1 - Fraction(6 * d2, n * (n * n - 1))


def _spearman(rng: random.Random) -> dict:
    key = rng.choice(sorted(SPEAR))
    s = SPEAR[key]
    want = rng.choice(CLASSES)
    while True:
        n = rng.randint(7, 10)
        lo, hi, st = s["xr"]
        x = sorted(rng.sample(range(lo, hi + 1, st), n))
        rng.shuffle(x)
        rx = ranks(x)
        # y's ranks: x's ranks (or reversed), then a few swaps; more swaps for a weak correlation
        base = list(rx) if want.endswith("+") else [n + 1 - r for r in rx]
        for _ in range(rng.randint(0, 2) if want.startswith("sig") else rng.randint(3, 8)):
            i, j = rng.sample(range(n), 2)
            base[i], base[j] = base[j], base[i]
        ylo, yhi, _ = s["yr"]
        yvals = sorted(rng.sample(range(ylo, yhi + 1), n))
        y = [yvals[r - 1] for r in base]
        d2, rs = rs_of(x, y)
        crit = Fraction(CRITICAL[n])
        if d2 == 0 or rs == 0 or abs(abs(rs) - crit) < Fraction(8, 100):  # never a perfect line
            continue
        if (rs * 1000).denominator == 1 and (rs * 1000) % 10 == 5:
            continue
        got = ("sig" if abs(rs) >= crit else "ns") + ("+" if rs > 0 else "-")
        if got == want:
            break
    return {"setup": key, "x": x, "y": y, "labels": [chr(65 + i) for i in range(n)], "blank": rng.randrange(n)}


# --- error bars --------------------------------------------------------------------------------------------
BARS = {
    "soil": {"title": "Bean seedlings grown in three soils", "groups": ["Soil A", "Soil B", "Soil C"],
             "y": "Mean height after 3 weeks / mm", "what": "mean height"},
    "temperature": {"title": "Yeast kept at three temperatures", "groups": ["15 °C", "25 °C", "35 °C"],
                    "y": "Mean volume of carbon dioxide / cm³", "what": "mean volume of carbon dioxide"},
    "leaves": {"title": "Leaves from three parts of a tree", "groups": ["Top", "Middle", "Bottom"],
               "y": "Mean leaf length / mm", "what": "mean leaf length"},
}


def _apart(means, half) -> list[tuple[int, int]]:
    out = []
    for a in range(3):
        for b in range(a + 1, 3):
            gap = max(means[a] - half[a], means[b] - half[b]) - min(means[a] + half[a], means[b] + half[b])
            out.append((a, b, gap))
    return out


def _error_bars(rng: random.Random) -> dict:
    key = rng.choice(sorted(BARS))
    step = rng.choice([2, 5, 10])
    none = rng.random() < 0.25
    while True:
        means = [step * rng.randint(4, 14) for _ in range(3)]
        half = [step * rng.randint(1, 3) for _ in range(3)]
        pairs = _apart(means, half)
        if any(abs(g) < step for _, _, g in pairs) or any(m - h <= 0 for m, h in zip(means, half)):
            continue
        if key == "temperature" and not means[0] < means[1] < means[2]:
            continue  # yeast releases more carbon dioxide as it warms from 15 °C to 35 °C
        n_apart = sum(1 for *_, g in pairs if g > 0)
        if n_apart == (0 if none else 1):
            break
    g1, g2 = rng.randrange(3), rng.randrange(3)
    return {"setup": key, "groups": BARS[key]["groups"], "means": means, "half": half, "step": step,
            "ask_mean": g1, "ask_top": g2}


def sample(rng: random.Random) -> dict:
    kind = rng.choice(["uncertainty", "spearman", "error_bars"])
    p = {"band": "AL", "kind": kind, "name": rng.choice(NAMES)}
    p.update({"uncertainty": _uncertainty, "spearman": _spearman, "error_bars": _error_bars}[kind](rng))
    return p


# --- drawing -----------------------------------------------------------------------------------------------

def _cell(ax, x, y, w, h, text="", size=9.5, bold=False, fill="white"):
    ax.add_patch(Rectangle((x, y), w, h, facecolor=fill, edgecolor=INK, linewidth=1.0))
    if text != "":
        ax.text(x + w / 2, y + h / 2, text, ha="center", va="center", fontsize=size, fontweight="bold" if bold else "normal")


def _draw_uncertainty(p: dict):
    s = UNC[p["setup"]]
    fig, ax = new_figure(8.6, 4.8)
    w0, w, h = 2.6, 1.35, 0.5
    rows = p["trials"]
    n = len(rows)
    _cell(ax, 0, n * h, w0, 2 * h, s["iv_head"], 9.5, True, "#eeeeee")
    _cell(ax, w0, (n + 1) * h, 3 * w, h, s["dv_head"], 9.5, True, "#eeeeee")
    for j in range(3):
        _cell(ax, w0 + j * w, n * h, w, h, f"Repeat {j + 1}", 9.5, True, "#eeeeee")
    for i, (lv, row) in enumerate(zip(s["levels"], rows)):
        y = (n - 1 - i) * h
        _cell(ax, 0, y, w0, h, str(lv), 10)
        for j, v in enumerate(row):
            _cell(ax, w0 + j * w, y, w, h, str(v), 10)
    top = (n + 2) * h
    ax.text(0, top + 1.35, f"{p['name']}'s results: {s['title'].lower()}", ha="left", va="center", fontsize=11.5,
            fontweight="bold")
    ax.text(0, top + 0.95, f"Each volume was read from a {s['instrument']} whose smallest division is {p['division']} cm³.",
            ha="left", va="center", fontsize=9.5)
    ax.text(0, top + 0.6, "Uncertainty of a reading = ± half the smallest division", ha="left", va="center", fontsize=9.5)
    ax.text(0, top + 0.25, "Percentage error = uncertainty ÷ reading × 100", ha="left", va="center", fontsize=9.5)
    ax.set_xlim(-0.05, max(w0 + 3 * w, 7.6) + 0.05)
    ax.set_ylim(-0.05, top + 1.6)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def _draw_spearman(p: dict):
    s = SPEAR[p["setup"]]
    x, y, n, b = p["x"], p["y"], len(p["x"]), p["blank"]
    rx, ry = ranks(x), ranks(y)
    d2, _ = rs_of(x, y)
    fig, ax = new_figure(8.8, 6.4)
    widths = [1.25, 2.0, 0.95, 2.0, 0.95, 0.85, 0.95]
    heads = ["Quadrat", s["x"], "Rank", s["y"], "Rank", "d", "d²"]
    h, hh = 0.42, 0.9
    xs = [sum(widths[:k]) for k in range(len(widths))]
    total_w = sum(widths)
    for k, head in enumerate(heads):
        _cell(ax, xs[k], (n + 1) * h, widths[k], hh, _wrap(head, 14 if widths[k] > 1.5 else 8), 9, True, "#eeeeee")
    for i in range(n):
        yy = (n - i) * h
        hide = i == b
        vals = [p["labels"][i], str(x[i]), "?" if hide else str(rx[i]), str(y[i]), "?" if hide else str(ry[i]),
                "?" if hide else str(rx[i] - ry[i]), "?" if hide else str((rx[i] - ry[i]) ** 2)]
        for k, v in enumerate(vals):
            _cell(ax, xs[k], yy, widths[k], h, v, 9.5, v == "?")
    _cell(ax, 0, 0, xs[6], h, "Σd²", 9.5, True, "#eeeeee")
    _cell(ax, xs[6], 0, widths[6], h, str(d2), 9.5, True)
    top = (n + 1) * h + hh
    ax.text(0, top + 1.6, f"{p['name']}'s survey of {n} quadrats", ha="left", va="center", fontsize=11.5, fontweight="bold")
    ax.text(0, top + 1.25, "Rank 1 = the smallest value.  d = rank of the first variable − rank of the second.",
            ha="left", va="center", fontsize=9.5)
    ax.text(0, top + 0.9, f"rs = 1 − (6 × Σd²) ÷ (n(n² − 1)),  where n = {n}.", ha="left", va="center", fontsize=9.5)
    ax.text(0, top + 0.55, f"Critical value of rs at p = 0.05 for n = {n}: {CRITICAL[n]}", ha="left", va="center",
            fontsize=9.5)
    ax.text(0, top + 0.2, "The correlation is significant if rs, ignoring its sign, is at least the critical value.",
            ha="left", va="center", fontsize=9.5)
    ax.set_xlim(-0.05, total_w + 0.05)
    ax.set_ylim(-0.05, top + 1.85)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def _wrap(text: str, width: int) -> str:
    """A column head wrapped to width, its unit kept whole on a line of its own."""
    import textwrap
    words, _, unit = text.partition(" / ")
    return textwrap.fill(words, width) + (f"\n/ {unit}" if unit else "")


def _draw_error_bars(p: dict):
    s = BARS[p["setup"]]
    means, half, step = p["means"], p["half"], p["step"]
    fig, ax = new_figure(7.2, 5.0)
    top = max(m + h for m, h in zip(means, half)) + step
    xs = [1, 2, 3]
    ax.bar(xs, means, width=0.55, color=FILL_2, edgecolor=INK, linewidth=1.0, zorder=2)
    for x, m, h in zip(xs, means, half):
        ax.plot([x, x], [m - h, m + h], color=INK, linewidth=1.4, zorder=3)
        ax.plot([x - 0.1, x + 0.1], [m + h, m + h], color=INK, linewidth=1.4, zorder=3)
        ax.plot([x - 0.1, x + 0.1], [m - h, m - h], color=INK, linewidth=1.4, zorder=3)
    ticks = [k * step for k in range(int(top // step) + 1)]
    ax.set_yticks(ticks)
    ax.set_ylim(0, top)
    ax.yaxis.grid(True, color=GRID, linewidth=0.8)
    ax.set_axisbelow(True)
    ax.set_xticks(xs)
    ax.set_xticklabels(s["groups"], fontsize=10)
    ax.set_xlim(0.4, 3.6)
    ax.tick_params(axis="y", labelsize=9 if len(ticks) <= 16 else 8)
    ax.set_ylabel(s["y"], fontsize=10)
    ax.set_title(f"{p['name']}'s results: {s['title'].lower()}\nError bars show the mean ± 2 standard errors. Where two "
                 "bars do not overlap,\nthe difference between the two means is significant.", fontsize=9.5)
    return fig


def draw(p: dict):
    return {"uncertainty": _draw_uncertainty, "spearman": _draw_spearman, "error_bars": _draw_error_bars}[p["kind"]](p)


# --- questions ---------------------------------------------------------------------------------------------

VERBS = ["recorded", "collected", "tabulated", "obtained"]
SETTINGS = ["in a practical lesson", "for a coursework investigation", "at the school field centre", "in the laboratory",
            "for a practical assessment"]


def _questions_uncertainty(p: dict, rng: random.Random) -> list:
    s = UNC[p["setup"]]
    rows, d, levels = p["trials"], p["division"], s["levels"]
    i0 = p["ask_mean"]
    mean = sum(rows[i0]) // 3
    q1 = short(f"{p['name']} {rng.choice(VERBS)} these volumes {rng.choice(SETTINGS)}. What is the mean volume at "
               f"{_level(s, levels[i0])}?", mean, [f"{mean} cm³", f"{mean}cm³", f"{mean} cm3"])
    i, j = p["ask_pct"]
    r = rows[i][j]
    pct = Fraction(d, 2) / r * 100
    text = exact(float(pct))
    q2 = short(f"What is the percentage error in the reading of {r} cm³ at {_level(s, levels[i])}, repeat {j + 1}?",
               text, [f"{text}%", f"{text} %"])
    i2 = p["ask_range"]
    rg = max(rows[i2]) - min(rows[i2])
    q3 = short(f"What is the range of the three repeats at {_level(s, levels[i2])}?", rg, [f"{rg} cm³", f"{rg}cm³", f"{rg} cm3"])
    u = Fraction(d, 2)
    opts = [f"±{float(x):g} cm³" for x in (Fraction(1, 4), Fraction(1, 2), Fraction(1), Fraction(2))]
    key = f"±{float(u):g} cm³"
    q4 = mcq(f"What is the uncertainty in each volume read from the {s['instrument']} in this experiment?", key,
             [o for o in opts if o != key], rng)
    return [q1, q2, q3, q4]


def _questions_spearman(p: dict, rng: random.Random) -> list:
    s = SPEAR[p["setup"]]
    x, y, n, b = p["x"], p["y"], len(p["x"]), p["blank"]
    rank = ranks(x)[b]
    q1 = short(f"{p['name']} measured the {s['x_short']} and the {s['y_short']} in {n} quadrats {rng.choice(SETTINGS)}. "
               f"What is the rank of the {s['x_short']} in quadrat {p['labels'][b]}?", rank)
    _, rs = rs_of(x, y)
    a = abs(rs) * 100
    whole = int(a) + (1 if a - int(a) >= Fraction(1, 2) else 0)
    text = f"{'-' if rs < 0 else ''}{whole // 100}.{whole % 100:02d}"
    forms = [text.replace("-", "−")] if rs < 0 else []
    q2 = short(f"Use Σd² in this table to calculate Spearman's rank correlation coefficient, rs, for the {s['x_short']} "
               "and the " + s["y_short"] + ", to 2 decimal places.", text, forms)
    crit = Fraction(CRITICAL[n])
    sign = "positive" if rs > 0 else "negative"
    opts = {f"a significant {g} correlation" for g in ("positive", "negative")} | \
        {f"a {g} correlation that is not significant" for g in ("positive", "negative")}
    key = f"a significant {sign} correlation" if abs(rs) >= crit else f"a {sign} correlation that is not significant"
    q3 = mcq(f"Using the critical value printed, what does rs show about the {s['x_short']} and the {s['y_short']} "
             "in these quadrats?", key, sorted(o for o in opts if o != key), rng)
    return [q1, q2, q3]


def _questions_error_bars(p: dict, rng: random.Random) -> list:
    s = BARS[p["setup"]]
    groups, means, half = p["groups"], p["means"], p["half"]
    pairs = [(a, b, g) for a, b, g in _apart(means, half)]
    apart = [f"{groups[a]} and {groups[b]}" for a, b, g in pairs if g > 0]
    key = apart[0] if apart else "none of the pairs"
    opts = [f"{groups[a]} and {groups[b]}" for a, b, _ in pairs] + ["none of the pairs"]
    q1 = mcq(f"{p['name']} plotted these results {rng.choice(SETTINGS)}. Between which two groups is the difference in "
             f"{s['what']} significant?", key, [o for o in opts if o != key], rng)
    g = p["ask_mean"]
    q2 = short(f"What is the {s['what']} for {groups[g]} in this bar chart?", means[g])
    g2 = p["ask_top"]
    top = means[g2] + half[g2]
    q3 = short(f"What value does the top of the error bar for {groups[g2]} reach?", top)
    return [q1, q2, q3]


def questions(p: dict, rng: random.Random) -> list:
    return {"uncertainty": _questions_uncertainty, "spearman": _questions_spearman,
            "error_bars": _questions_error_bars}[p["kind"]](p, rng)
