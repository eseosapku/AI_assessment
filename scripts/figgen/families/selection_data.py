"""Selection and evolution (LS, UP, AL).

Four sub-types:
- moth (LS, UP, AL): a mark-release-recapture study of the peppered moth's dark and pale forms in a sooty wood near
  factories and a clean wood, as a table (released, recaptured) with a drawing of each form. Each recaptured share is a
  whole percentage and the four differ; as in the real studies, the dark form does better in the sooty wood and the
  pale form in the clean wood. The percentage of one group recaptured; which group had the lowest percentage (four
  options, wood by form); the difference between the two forms in one wood, in percentage points.
- breeding (LS, UP, AL): selective breeding of maize, dairy cows, hens or beans: a line graph of the mean of the chosen
  feature over the generations, each value on a gridline and rising every generation. The increase between two
  generations; the first generation whose mean reached a value; the percentage increase over the whole programme.
- hardy (UP, AL): a population with the number showing the recessive phenotype, and the Hardy-Weinberg equations
  printed; q is a whole number of tenths. q, p, and the expected number of heterozygous individuals.
- molecular (UP, AL): the number of amino acid differences in one protein between five species, as a table built
  from a tree (closer relatives differ less). Which species is most closely related to a named one (one smallest
  value in its row); the number of differences between two species; which is least closely related to another.
"""
from __future__ import annotations

import random

from matplotlib.patches import Ellipse, Polygon

from ..core import GRID, INK, NAMES, mcq, new_figure, short

ID = "selection_data"
KIND = "table.data"
SUBJECT = "biology"
BANDS = ("LS", "UP", "AL")
CONCEPTS = tuple(f"biology.{c}" for c in ("darwin-wallace-natural-selection", "evolution", "artificial-selection",
                                          "hardy-weinberg-population-genetic-variation", "evolution-evidence",
                                          "continuous-discontinuous-variation"))
# A topic whose sections the book lists is reached only if one names selection, evolution or allele frequencies.
NEEDS = (r"natural selection|artificial selection|selective breeding|hardy|allele frequenc|evolution|speciation|"
         r"molecular comparison")
AVOID = (r"sexual|contracept|pregnan|\bstis?\b|\bhiv\b|social factors|glossary|science in context|reproduction system|"
         r"classification|biodiversity|^variation$|mutation|human activities|gene technology|asexual|^genetics$")

WOODS = {"sooty": "Sooty wood (near factories)", "clean": "Clean wood (countryside)"}
CROPS = {  # feature, axis label, start range, grid step, rise per generation (in steps)
    "maize": ("mean cob length", "Mean length of cobs (cm)", (10, 14), 1, (1, 2), "cm"),
    "dairy cows": ("mean milk yield", "Mean milk yield per cow (litres per day)", (6, 10), 1, (1, 2), "litres per day"),
    "hens": ("mean number of eggs", "Mean number of eggs per hen per year", (12, 16), 10, (1, 3), "eggs"),
    "beans": ("mean mass of 100 seeds", "Mean mass of 100 seeds (g)", (10, 15), 2, (1, 2), "g"),
}
CHOSEN = {"maize": "the plants with the longest cobs", "dairy cows": "the cows that gave the most milk",
          "hens": "the hens that laid the most eggs", "beans": "the plants with the heaviest seeds"}
ORGANISMS = {  # population, dominant phenotype, recessive phenotype
    "mice": ("mice", "dark fur", "white fur"),
    "fruit flies": ("fruit flies", "normal wings", "vestigial wings"),
    "cattle": ("cattle", "no horns", "horns"),
    "moths": ("moths", "dark wings", "pale wings"),
}
SPECIES = ["P", "Q", "R", "S", "T"]
PROTEINS = ["cytochrome c", "haemoglobin"]


def concepts_for(p: dict) -> list:
    k = p["kind"]
    if k == "moth":
        return ["biology.darwin-wallace-natural-selection", "biology.evolution",
                "biology.continuous-discontinuous-variation"]
    if k == "breeding":
        return ["biology.artificial-selection"]
    if k == "hardy":
        return ["biology.hardy-weinberg-population-genetic-variation", "biology.evolution"]
    return ["biology.evolution-evidence", "biology.evolution"]


# --- sampling -----------------------------------------------------------------------------------------------------

def _moth(rng: random.Random) -> dict:
    while True:
        rows = []
        pcts = []
        for wood in ("sooty", "clean"):
            good = rng.randrange(20, 62, 2)
            bad = rng.randrange(4, good - 8, 2)
            for form in ("dark", "pale"):
                pct = good if (wood, form) in (("sooty", "dark"), ("clean", "pale")) else bad
                released = rng.choice([100, 200, 250, 400, 500])
                rows.append([wood, form, released, released * pct // 100])
                pcts.append(pct)
        if len(set(pcts)) == 4:
            break
    return {"band": rng.choice(BANDS), "kind": "moth", "rows": rows,
            "ask": [rng.choice(["sooty", "clean"]), rng.choice(["dark", "pale"])],
            "diff_wood": rng.choice(["sooty", "clean"])}


def _breeding(rng: random.Random) -> dict:
    crop = rng.choice(sorted(CROPS))
    _, _, (lo, hi), step, (r0, r1), _ = CROPS[crop]
    n = rng.choice([6, 7, 8])
    while True:
        values = [rng.randint(lo, hi) * step]
        for _ in range(n - 1):
            values.append(values[-1] + rng.randint(r0, r1) * step)
        inc = 100 * (values[-1] - values[0]) / values[0]
        if inc == int(inc):
            break
    a = rng.randrange(0, n - 2)
    b = rng.randrange(a + 2, n)
    first = rng.randrange(1, n)
    threshold = values[first] if rng.random() < 0.5 or values[first] - values[first - 1] == step else \
        values[first] - step
    return {"band": rng.choice(BANDS), "kind": "breeding", "crop": crop, "values": values, "step": step,
            "span": [a, b], "threshold": threshold}


def _hardy(rng: random.Random) -> dict:
    org = rng.choice(sorted(ORGANISMS))
    q10 = rng.randint(1, 7)
    total = rng.choice([100, 200, 400, 500, 1000, 2000])
    return {"band": rng.choice(["UP", "AL"]), "kind": "hardy", "organism": org, "total": total,
            "recessive": total * q10 * q10 // 100, "q10": q10}


def _molecular(rng: random.Random) -> dict:
    names = list(SPECIES)
    order = rng.sample(range(5), 5)
    # a tree: ((a, b), c) and (d, e), joined at the root; heights rise towards the root
    a, b, c, d, e = order
    h_ab, h_de = rng.randint(2, 6), rng.randint(3, 9)
    h_abc = h_ab + rng.randint(3, 8)
    h_root = max(h_abc, h_de) + rng.randint(4, 10)

    def lca(i, j):
        pair = {i, j}
        if pair == {a, b}:
            return h_ab
        if pair <= {a, b, c}:
            return h_abc
        if pair == {d, e}:
            return h_de
        return h_root

    d_ = [[0] * 5 for _ in range(5)]
    for i in range(5):
        for j in range(i + 1, 5):
            v = 2 * lca(i, j) + rng.randint(-1, 1)
            d_[i][j] = d_[j][i] = v
    rows = [x for x in range(5) if sorted(d_[x][y] for y in range(5) if y != x)[0]
            < sorted(d_[x][y] for y in range(5) if y != x)[1]]
    far = [x for x in range(5) if sorted(d_[x][y] for y in range(5) if y != x)[-1]
           > sorted(d_[x][y] for y in range(5) if y != x)[-2]]
    if not rows or not far:
        return _molecular(rng)
    near = rng.choice(rows)
    pair = sorted(rng.sample(range(5), 2))
    return {"band": rng.choice(["UP", "AL"]), "kind": "molecular", "protein": rng.choice(PROTEINS), "names": names,
            "d": d_, "near": near, "far": rng.choice(far), "pair": pair}


def sample(rng: random.Random) -> dict:
    kind = rng.choice(["moth", "breeding", "hardy", "molecular"])
    return {"moth": _moth, "breeding": _breeding, "hardy": _hardy, "molecular": _molecular}[kind](rng)


# --- drawing ------------------------------------------------------------------------------------------------------

def _moth_icon(ax, x, y, dark: bool):
    face = "#3a3f44" if dark else "#f2f2ee"
    for s in (-1, 1):
        ax.add_patch(Polygon([(x, y + 0.05), (x + s * 0.42, y + 0.2), (x + s * 0.36, y - 0.12), (x, y - 0.06)],
                             closed=True, facecolor=face, edgecolor=INK, linewidth=1.0))
    ax.add_patch(Ellipse((x, y), 0.08, 0.36, facecolor=INK, edgecolor=INK))


def _table(ax, header: list, rows: list, xs: list, y0: float, dy: float, rule: tuple, size: float = 10):
    for x, h in zip(xs, header):
        ax.text(x, y0, h, ha="center", va="center", fontsize=size, fontweight="bold")
    ax.plot(list(rule), [y0 - dy / 2] * 2, color=INK, linewidth=1.0)
    for i, row in enumerate(rows):
        for x, v in zip(xs, row):
            ax.text(x, y0 - dy * (i + 1), str(v), ha="center", va="center", fontsize=size)


def _draw_moth(p: dict):
    fig, ax = new_figure(8.6, 4.4)
    ax.text(0, 5.3, "Marked peppered moths released in two woods, and the number recaptured a day later",
            ha="left", va="center", fontsize=10.5, fontweight="bold")
    _moth_icon(ax, 0.7, 4.4, True)
    ax.text(1.3, 4.4, "dark form", ha="left", va="center", fontsize=10)
    _moth_icon(ax, 3.4, 4.4, False)
    ax.text(4.0, 4.4, "pale form", ha="left", va="center", fontsize=10)
    xs = [1.6, 4.4, 6.4, 8.4]
    rows = [[WOODS[w], f, r, c] for w, f, r, c in p["rows"]]
    _table(ax, ["Wood", "Form of moth", "Number\nreleased", "Number\nrecaptured"], rows, xs, 3.4, 0.8, (0.0, 9.4))
    ax.set_xlim(-0.2, 9.6)
    ax.set_ylim(-0.3, 5.6)
    ax.axis("off")
    return fig


def _draw_breeding(p: dict):
    feature, label, _, step, _, _ = CROPS[p["crop"]]
    v = p["values"]
    fig, ax = new_figure(6.6, 4.4)
    gens = list(range(len(v)))
    ax.plot(gens, v, color=INK, marker="o", markersize=5, linewidth=1.6)
    lo = max(0, v[0] - 2 * step)
    lo -= lo % step
    hi = v[-1] + 2 * step
    ax.set_yticks(range(lo, hi + 1, step))
    ax.set_ylim(lo, hi)
    ax.set_xticks(gens)
    ax.set_xlim(-0.4, len(v) - 0.6)
    ax.yaxis.grid(True, color=GRID, linewidth=0.8)
    ax.xaxis.grid(True, color=GRID, linewidth=0.5)
    ax.set_axisbelow(True)
    ax.tick_params(labelsize=9)
    ax.set_xlabel("Generation of selective breeding (0 = the start)", fontsize=10)
    ax.set_ylabel(label, fontsize=10)
    ax.set_title(f"Selective breeding of {p['crop']}:\n{CHOSEN[p['crop']]} were bred each generation", fontsize=10.5,
                 pad=10)
    return fig


def _draw_hardy(p: dict):
    pop, dom, rec = ORGANISMS[p["organism"]]
    fig, ax = new_figure(7.6, 4.0)
    ax.text(0, 5.2, f"A population of {p['total']} {pop}", ha="left", va="center", fontsize=11, fontweight="bold")
    xs = [1.4, 4.4]
    _table(ax, ["Phenotype", "Number"], [[dom, p["total"] - p["recessive"]], [rec, p["recessive"]]], xs, 4.3, 0.6, (0.2, 5.4))
    ax.text(0, 2.35, f"{dom.capitalize()} (allele A) is dominant to {rec} (allele a).", ha="left", va="center",
            fontsize=10)
    ax.text(0, 1.75, "Hardy–Weinberg equations:   p + q = 1   and   p² + 2pq + q² = 1", ha="left", va="center",
            fontsize=10)
    ax.text(0, 1.15, "p = frequency of allele A,  q = frequency of allele a", ha="left", va="center", fontsize=10)
    ax.text(0, 0.55, "The population is in Hardy–Weinberg equilibrium.", ha="left", va="center", fontsize=10)
    ax.set_xlim(-0.2, 7.4)
    ax.set_ylim(0.2, 5.5)
    ax.axis("off")
    return fig


def _draw_molecular(p: dict):
    names, d = p["names"], p["d"]
    fig, ax = new_figure(6.6, 4.2)
    ax.text(0, 6.4, f"Number of differences in the amino acid sequence of {p['protein']}", ha="left", va="center",
            fontsize=10.5, fontweight="bold")
    x0, y0, w, h = 1.4, 5.3, 1.0, 0.8
    for j, n in enumerate(names):
        ax.text(x0 + w * (j + 0.5), y0, f"species {n}", ha="center", va="center", fontsize=9, fontweight="bold")
    for i, n in enumerate(names):
        y = y0 - h * (i + 1)
        ax.text(x0 - 0.15, y, f"species {n}", ha="right", va="center", fontsize=9, fontweight="bold")
        for j in range(5):
            ax.text(x0 + w * (j + 0.5), y, "–" if i == j else str(d[i][j]), ha="center", va="center", fontsize=10)
    for k in range(6):
        ax.plot([x0 + w * k, x0 + w * k], [y0 - h / 2, y0 - h * 5.5], color=GRID, linewidth=0.8)
        ax.plot([x0, x0 + 5 * w], [y0 - h / 2 - h * k, y0 - h / 2 - h * k], color=GRID, linewidth=0.8)
    ax.set_xlim(-0.2, x0 + 5 * w + 0.2)
    ax.set_ylim(y0 - h * 5.5 - 0.2, 6.7)
    ax.axis("off")
    return fig


def draw(p: dict):
    return {"moth": _draw_moth, "breeding": _draw_breeding, "hardy": _draw_hardy, "molecular": _draw_molecular}[p["kind"]](p)


# --- questions ----------------------------------------------------------------------------------------------------

SETTINGS = ["in a biology lesson", "for revision", "for a class test", "at the science club in Rubavu",
            "for homework", "on a worksheet in Nyagatare"]
VERBS = ["studies", "looks at", "is given", "examines"]


def _pct(n) -> list:
    return [f"{n}%", f"{n} %", f"{n} percent"]


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    lead = f"{who} {rng.choice(VERBS)} these results {rng.choice(SETTINGS)}."
    k = p["kind"]
    if k == "moth":
        pct = {(w, f): 100 * c // r for w, f, r, c in p["rows"]}
        w, f = p["ask"]
        low = min(pct, key=pct.get)
        dw = p["diff_wood"]
        diff = abs(pct[(dw, "dark")] - pct[(dw, "pale")])
        opts = [f"{f_} moths in the {w_} wood" for w_ in ("sooty", "clean") for f_ in ("dark", "pale")]
        right = f"{low[1]} moths in the {low[0]} wood"
        return [short(f"{lead} What percentage of the {f} moths released in the {w} wood were recaptured?",
                      pct[(w, f)], _pct(pct[(w, f)])),
                mcq("Which group of moths had the lowest percentage recaptured?", right,
                    [o for o in opts if o != right], rng),
                short(f"In the {dw} wood, by how many percentage points did the recaptured percentages of the two "
                      f"forms differ?", diff, [f"{diff} percentage points", *_pct(diff)])]
    if k == "breeding":
        feature, _, _, _, _, unit = CROPS[p["crop"]]
        v = p["values"]
        a, b = p["span"]
        first = next(i for i, x in enumerate(v) if x >= p["threshold"])
        inc = 100 * (v[-1] - v[0]) // v[0]
        return [short(f"{lead} By how much did the {feature} of the {p['crop']} rise from generation {a} to "
                      f"generation {b}?", v[b] - v[a], [f"{v[b] - v[a]} {unit}"]),
                short(f"In which generation did the {feature} first reach {p['threshold']} {unit}?", first,
                      [f"generation {first}"]),
                short(f"By what percentage did the {feature} rise from generation 0 to the last generation shown?",
                      inc, _pct(inc))]
    if k == "hardy":
        pop = ORGANISMS[p["organism"]][0]
        q = p["q10"] / 10
        het = 2 * p["q10"] * (10 - p["q10"]) * p["total"] // 100
        qs_ = f"{q:.1f}"
        ps_ = f"{1 - q:.1f}"
        return [short(f"{lead} What is q, the frequency of the recessive allele a, in this population of {pop}?", qs_,
                      [f"0{qs_[1:]}0", qs_[1:], f"{p['q10']}/10", f"{p['q10'] * 10}%"]),
                short(f"What is p, the frequency of the dominant allele A, in these {pop}?", ps_,
                      [f"{ps_}0", ps_[1:], f"{10 - p['q10']}/10", f"{(10 - p['q10']) * 10}%"]),
                short(f"How many of the {p['total']} {pop} are expected to be heterozygous (Aa)?", het,
                      [f"{het} {pop}"])]
    names, d = p["names"], p["d"]
    x, y = p["near"], p["far"]
    row = {j: d[x][j] for j in range(5) if j != x}
    near = min(row, key=row.get)
    row = {j: d[y][j] for j in range(5) if j != y}
    far = max(row, key=row.get)
    i, j = p["pair"]
    others = [n for n in range(5) if n != x]
    return [mcq(f"{lead} Which species is most closely related to species {names[x]}?", f"species {names[near]}",
                rng.sample([f"species {names[n]}" for n in others if n != near], 3), rng),
            short(f"How many amino acid differences are there between species {names[i]} and species {names[j]}?",
                  d[i][j], [f"{d[i][j]} differences"]),
            mcq(f"Which species is least closely related to species {names[y]}?", f"species {names[far]}",
                rng.sample([f"species {names[n]}" for n in range(5) if n not in (y, far)], 3), rng)]
