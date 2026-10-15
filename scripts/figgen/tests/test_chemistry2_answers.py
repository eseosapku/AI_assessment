"""Answers of the lower-secondary chemistry figures (P3z, Task C), recomputed from each figure's params over 1,000 seeds.

Nothing here calls a family's own helpers to work out a key: the apparatus parts and the purpose of each separation
come from this file's own tables, the way to collect a gas from its density and solubility by the rule the figure
prints, a solution's colour from this file's universal-indicator chart, the percentages and sector angles from the
pie's numbers, concentrations from mass and volume, and the reactivity order from the bubbles or the displacement
results. The drawings are read back too: letters end on their parts, the condenser's water enters at its lower end,
the syringe's plunger stops at its reading, and no label sits on a line.
"""
import itertools
import math
import random
import re
import sqlite3
from collections import Counter, defaultdict
from fractions import Fraction
from pathlib import Path

import matplotlib.pyplot as plt
import pytest
from matplotlib.text import Text

from figgen.core import NAMES
from figgen.families import FAMILIES

SEEDS = range(1, 1001)
DRAWN = range(1, 41)
STORE = Path("C:/Users/Stephen/figure-library/figures.db")
WAVE = ("separation_apparatus", "gas_collection", "ph_scale", "air_composition", "concentration_table", "reactivity_test")


def run(m, seed):
    rng = random.Random(seed)
    p = m.sample(rng)
    return p, m.questions(p, rng)


def picked(q):
    return q.options[int(q.answer)]


def wrong(q):
    return [o for i, o in enumerate(q.options) if i != int(q.answer)]


def fam(fid):
    if fid not in FAMILIES:
        pytest.fail(f"{fid} is not registered")
    return FAMILIES[fid]


def _central(options):
    toks = [Counter(re.findall(r"-?\d+|[a-zA-Z]+|\S", o)) for o in options]
    score = [sum(sum(((t - u) + (u - t)).values()) for u in toks) for t in toks]
    best = min(score)
    return score.index(best) if score.count(best) == 1 else None


def words_of(m, p) -> str:
    fig = m.draw(p)
    fig.canvas.draw()
    words = " ".join(t.get_text() for ax in fig.axes for t in ax.texts)
    words += " " + " ".join(ax.get_title() + " " + ax.get_xlabel() + " " + ax.get_ylabel() for ax in fig.axes)
    words += " " + " ".join(t.get_text() for ax in fig.axes for t in ax.get_xticklabels() + ax.get_yticklabels())
    plt.close(fig)
    return words


def frac(text: str) -> Fraction:
    return Fraction(text.replace(" ", "").replace(",", ""))


def drawn_texts(fig):
    """Every piece of text the renderer actually drew, with its box in pixels."""
    seen = []
    original = Text.draw

    def record(self, renderer):
        original(self, renderer)
        if self.get_visible() and self.get_text().strip():
            seen.append(self)

    Text.draw = record
    try:
        fig.canvas.draw()
    finally:
        Text.draw = original
    renderer = fig.canvas.get_renderer()
    return [(t, t.get_window_extent(renderer)) for t in seen]


def _seg_hits(p, q, b, m=1.0) -> bool:
    """Whether the segment p-q passes through the box b (shrunk by m pixels), exactly (Liang-Barsky)."""
    x0, y0, x1, y1 = b.x0 + m, b.y0 + m, b.x1 - m, b.y1 - m
    if x0 >= x1 or y0 >= y1:
        return False
    t0, t1 = 0.0, 1.0
    dx, dy = q[0] - p[0], q[1] - p[1]
    for pp, qq in ((-dx, p[0] - x0), (dx, x1 - p[0]), (-dy, p[1] - y0), (dy, y1 - p[1])):
        if pp == 0:
            if qq < 0:
                return False
        else:
            t = qq / pp
            if pp < 0:
                t0 = max(t0, t)
            else:
                t1 = min(t1, t)
            if t0 > t1:
                return False
    return True


def strokes(ax):
    """Every visible stroke on the axes, in pixels, with what drew it: lines and the outlines of patches."""
    out = []
    for ln in ax.lines:
        if ln.get_linestyle() in ("None", "none", "", " ") or len(ln.get_xydata()) < 2 or not ln.get_visible():
            continue
        out.append((ln.get_gid() or "", ln.get_transform().transform(ln.get_xydata())))
    for pa in ax.patches:
        edge = pa.get_edgecolor()
        if not pa.get_visible() or pa.get_linewidth() == 0 or edge[3] == 0:
            continue
        for poly in pa.get_path().to_polygons(pa.get_transform(), closed_only=False):
            out.append((pa.get_gid() or "", poly))
    return out


OWN = {"letter": "leader", "label": "pieleader"}  # a text and the one stroke that may start at it


def labels_clear_of_lines(fig):
    """No stroke runs through any drawn text, but a letter's own leader (which starts just clear of it)."""
    texts = drawn_texts(fig)
    bad = []
    for ax in fig.axes:
        lines = strokes(ax)
        for t, box in texts:
            if t.axes is not ax:
                continue
            gid = t.get_gid() or ""
            kind, _, name = gid.partition(":")
            mine = f"{OWN[kind]}:{name}" if kind in OWN else None
            for lgid, pts in lines:
                if mine and lgid == mine:
                    continue
                if any(_seg_hits(a, b, box) for a, b in zip(pts, pts[1:])):
                    bad.append((t.get_text(), lgid))
                    break
    return bad


# --- separation apparatus ------------------------------------------------------------------------------

SEP_PARTS = {
    "filtration": {"filter funnel", "filter paper", "residue", "filtrate", "conical flask"},
    "simple distillation": {"thermometer", "distillation flask", "condenser", "water inlet", "water outlet", "distillate",
                            "Bunsen burner"},
    "evaporation": {"evaporating basin", "solution", "gauze", "tripod", "Bunsen burner"},
}
# what each mixture is separated by: a teacher's table
SEP_MIXTURES = {
    "filtration": {"muddy water", "a mixture of chalk and water", "a mixture of sand and salt solution"},
    "simple distillation": {"sea water", "salty water", "ink"},
    "evaporation": {"salt solution", "sea water", "potassium chloride solution"},
}
SEP_PURPOSE = {
    "separate sand from a mixture of sand and water": "filtration",
    "remove insoluble chalk from water": "filtration",
    "collect the sand from muddy water": "filtration",
    "get pure water from sea water": "simple distillation",
    "collect pure water from ink": "simple distillation",
    "get drinking water from salty water": "simple distillation",
    "get solid salt from salt solution, letting the water escape into the air": "evaporation",
    "obtain dry salt from sea water without collecting the water": "evaporation",
    "obtain crystals of copper(II) sulfate from its solution": "crystallisation",
    "grow crystals of alum from a hot saturated solution": "crystallisation",
}
SEP_METHODS = {"filtration", "simple distillation", "evaporation", "crystallisation"}
# Parts where one lines or holds the other: a figure letters one of them at most (P3z review: "A and D both label
# the funnel walls"; a basin and its solution). The paper holds the residue as a flask holds its contents.
NESTED = [("filter funnel", "filter paper"), ("filter paper", "residue"), ("conical flask", "filtrate"),
          ("evaporating basin", "solution")]
# what each set-up must show, so a reader can tell the method from the drawing
SEP_MARKS = {"filtration": {"funnel"}, "simple distillation": {"condenser", "flame"}, "evaporation": {"basin", "flame"},
             "crystallisation": {"basin", "crystals"}}


def test_separation_apparatus_single():
    m = fam("separation_apparatus")
    seen, methods = Counter(), Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        if p["layout"] != "single":
            continue
        method, labels = p["method"], p["labels"]
        methods[method] += 1
        assert sorted(labels) == [chr(65 + i) for i in range(len(labels))], (s, labels)
        assert set(labels.values()) <= SEP_PARTS[method] and 3 <= len(labels) <= 6, (s, labels)
        assert len(set(labels.values())) == len(labels)
        at = {v: k for k, v in labels.items()}
        mix = re.search(r"to separate the substances in (.+?)\. ", qs[0].stem).group(1)
        assert mix in SEP_MIXTURES[method], (s, method, mix)
        for q in qs:
            assert q.kind == "mcq" and len(q.options) >= 3 and len(set(q.options)) == len(q.options), (s, q.stem)
            got = re.search(r"Which letter shows the (.+?)\?", q.stem)
            if got:
                assert picked(q) == at[got.group(1)], (s, q.stem)
                assert set(q.options) <= set(labels), (s, q.options)
                seen["which"] += 1
            elif "cooling water enter" in q.stem:
                assert method == "simple distillation" and "water outlet" in at
                assert picked(q) == at["water inlet"], (s, q.options)
                assert at["water outlet"] in q.options  # the other end of the condenser is offered
                seen["inlet"] += 1
            elif (got := re.search(r"part labelled ([A-Z]) called\?", q.stem)):
                assert picked(q) == labels[got.group(1)], (s, q.stem)
                assert set(q.options) <= SEP_PARTS[method]
                seen["name"] += 1
            elif "Which method of separation does it show?" in q.stem:
                assert picked(q) == method and set(q.options) <= SEP_METHODS | {"chromatography"}, (s, q.options)
                assert "crystallisation" not in q.options  # an evaporating basin on a flame is also crystallisation's first step
                seen["method"] += 1
            else:
                pytest.fail(f"seed {s}: unknown question {q.stem}")
    assert set(seen) == {"which", "inlet", "name", "method"}, seen
    assert set(methods) == set(SEP_PARTS), methods


def test_separation_apparatus_panel():
    m = fam("separation_apparatus")
    seen = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        if p["layout"] != "panel":
            continue
        setups = p["setups"]
        assert list(setups) == ["P", "Q", "R"], (s, setups)
        methods = set(setups.values())
        assert len(methods) == 3 and methods <= SEP_METHODS and not {"evaporation", "crystallisation"} <= methods, (s, setups)
        by_method = {v: k for k, v in setups.items()}
        for q in qs:
            assert q.kind == "mcq" and len(q.options) >= 3
            got = re.search(r"Which method does set-up ([PQR]) show\?", q.stem)
            if got:
                assert picked(q) == setups[got.group(1)]
                assert set(q.options) <= methods | {"chromatography"}, (s, q.options)
                seen["method"] += 1
                continue
            got = re.search(r"Which set-up should (?:\w+ use|be used) to (.+)\?$", q.stem)
            assert got, (s, q.stem)
            purpose = got.group(1)
            assert purpose in SEP_PURPOSE, (s, purpose)
            assert SEP_PURPOSE[purpose] in methods
            assert picked(q) == by_method[SEP_PURPOSE[purpose]], (s, q.stem)
            assert sorted(q.options) == ["P", "Q", "R"]
            seen["purpose"] += 1
    assert seen["method"] > 100 and seen["purpose"] > 200, seen


def _data_path(pa):
    return pa.get_path().transformed(pa.get_patch_transform())


def _filled(pa) -> bool:
    return pa.get_visible() and pa.get_fill() and pa.get_facecolor()[3] > 0


def topmost(ax, pt):
    hits = [(pa.get_zorder(), k, pa) for k, pa in enumerate(ax.patches)
            if _filled(pa) and pa.get_transform().contains_branch(ax.transData) and _data_path(pa).contains_point(pt)]
    return max(hits, key=lambda h: (h[0], h[1]))[2] if hits else None


def centre_y(pa):
    v = _data_path(pa).vertices
    return (v[:, 1].min() + v[:, 1].max()) / 2


def test_separation_apparatus_letters_end_on_their_parts():
    m = fam("separation_apparatus")
    for s in DRAWN:
        p = m.sample(random.Random(s))
        if p["layout"] != "single":
            continue
        fig = m.draw(p)
        ax = fig.axes[0]
        fig.canvas.draw()
        renderer = fig.canvas.get_renderer()
        labels = p["labels"]
        texts = {t.get_gid()[7:]: t for t in ax.texts if (t.get_gid() or "").startswith("letter:")}
        leaders = {ln.get_gid()[7:]: ln for ln in ax.lines if (ln.get_gid() or "").startswith("leader:")}
        assert set(texts) == set(labels) == set(leaders), (s, sorted(texts), sorted(leaders))
        for L, name in labels.items():
            assert texts[L].get_text() == L and texts[L].get_fontsize() >= 12
            xs, ys = leaders[L].get_data()
            end = (float(xs[-1]), float(ys[-1]))
            seen = topmost(ax, end)
            assert seen is not None and seen.get_gid() == f"part:{name}", (s, L, name, seen and seen.get_gid())
            sx, sy = ax.transData.transform((float(xs[0]), float(ys[0])))
            b = texts[L].get_window_extent(renderer)
            assert math.hypot(max(b.x0 - sx, 0, sx - b.x1), max(b.y0 - sy, 0, sy - b.y1)) <= 20, (s, L)
        words = " ".join(t.get_text() for t in ax.texts).lower()
        for part in set().union(*SEP_PARTS.values()):
            assert part.lower() not in words, (s, part)  # only letters: the names are what is asked
        for meth in SEP_METHODS:
            assert meth not in words
        if p["method"] == "simple distillation":
            ports = {n: [pa for pa in ax.patches if pa.get_gid() == f"part:{n}"] for n in ("water inlet", "water outlet")}
            assert len(ports["water inlet"]) == 1 and len(ports["water outlet"]) == 1
            # cooling water goes in at the lower end of the condenser, so the jacket fills
            assert centre_y(ports["water inlet"][0]) < centre_y(ports["water outlet"][0]) - 0.5, s
        plt.close(fig)


def test_separation_apparatus_leaders_end_inside_their_own_part_only():
    """P3z review: leaders ended in the funnel's contents, near a basin's rim, and on a gauze drawn as the tripod's top.
    Each leader now ends inside its own part, a margin clear of its edges, and inside no other part and none of the
    contents; the gauze is a hatched mesh sitting on the tripod, and the filter paper a cone line, not the funnel's
    inside."""
    m = fam("separation_apparatus")
    seen = Counter()
    for s in range(1, 81):
        p = m.sample(random.Random(s))
        if p["layout"] != "single":
            continue
        fig = m.draw(p)
        ax = fig.axes[0]
        parts, contents = defaultdict(list), []
        for pa in ax.patches:
            g = pa.get_gid() or ""
            if g.startswith("part:"):
                parts[g[5:]].append(_data_path(pa))
            elif g == "contents":
                contents.append(_data_path(pa))
        leaders = {ln.get_gid()[7:]: ln for ln in ax.lines if (ln.get_gid() or "").startswith("leader:")}
        for L, name in p["labels"].items():
            xs, ys = leaders[L].get_data()
            x, y = float(xs[-1]), float(ys[-1])
            for dx, dy in ((0, 0), (0.03, 0), (-0.03, 0), (0, 0.03), (0, -0.03)):
                assert any(path.contains_point((x + dx, y + dy)) for path in parts[name]), (s, L, name, dx, dy)
            for other, paths in parts.items():
                if other != name:
                    assert not any(path.contains_point((x, y)) for path in paths), (s, L, name, other)
            assert not any(path.contains_point((x, y)) for path in contents), (s, L, name, "contents")
            seen[name] += 1
        if p["method"] == "evaporation":
            gauze = next(pa for pa in ax.patches if pa.get_gid() == "part:gauze")
            assert gauze.get_hatch(), s
            tripod_top = max(path.vertices[:, 1].max() for path in parts["tripod"])
            assert _data_path(gauze).vertices[:, 1].min() >= tripod_top - 1e-6, s  # the mesh sits on the tripod
        if p["method"] == "filtration":
            for path in contents:  # the paper lines the funnel: the middle of what is in it is not paper
                v = path.vertices
                assert not any(pp.contains_point((v[:, 0].mean(), v[:, 1].mean())) for pp in parts["filter paper"]), s
        plt.close(fig)
    # every part is lettered somewhere but the filter paper, which lines the funnel and holds the residue
    assert set(seen) == set().union(*SEP_PARTS.values()) - {"filter paper"}, set(seen)


def test_separation_apparatus_letters_one_part_of_a_nested_pair():
    """No figure letters both parts of a nested pair, and no question asks about a part the figure does not letter;
    the funnel, where lettered, is pointed at on its stem below the cone (below the paper's tip), not on the cone."""
    m = fam("separation_apparatus")
    counts = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        if p["layout"] != "single":
            continue
        names = set(p["labels"].values())
        for a, b in NESTED:
            assert not {a, b} <= names, (s, a, b)
        counts[len(names)] += 1
        for q in qs:
            got = re.search(r"Which letter shows the (.+?)\?", q.stem)
            if got:
                assert got.group(1) in names, (s, q.stem)
    assert min(counts) >= 3, counts
    for s in range(1, 81):
        p = m.sample(random.Random(s))
        if p["layout"] != "single" or "filter funnel" not in p["labels"].values():
            continue
        fig = m.draw(p)
        ax = fig.axes[0]
        L = next(k for k, v in p["labels"].items() if v == "filter funnel")
        leader = next(ln for ln in ax.lines if ln.get_gid() == f"leader:{L}")
        tip = min(_data_path(pa).vertices[:, 1].min() for pa in ax.patches if pa.get_gid() == "part:filter paper")
        assert float(leader.get_ydata()[-1]) < tip - 0.1, s  # on the stem, below the cone
        plt.close(fig)


def test_separation_apparatus_panel_shows_each_method():
    m = fam("separation_apparatus")
    for s in DRAWN:
        p = m.sample(random.Random(s))
        if p["layout"] != "panel":
            continue
        fig = m.draw(p)
        ax = fig.axes[0]
        marks = defaultdict(set)
        for art in list(ax.patches) + list(ax.lines):
            g = art.get_gid() or ""
            if g.startswith("mark:"):
                _, L, what = g.split(":")
                marks[L].add(what)
        letters = sorted(t.get_text() for t in ax.texts if (t.get_gid() or "").startswith("setup:"))
        plt.close(fig)
        assert letters == ["P", "Q", "R"]
        for L, method in p["setups"].items():
            assert marks[L] == SEP_MARKS[method], (s, L, method, marks[L])


# --- gas collection -----------------------------------------------------------------------------------

GAS = {  # density in g/dm³ at room temperature (molar mass ÷ 24), and solubility in water
    "oxygen": (1.33, "slightly soluble"), "hydrogen": (0.08, "insoluble"), "nitrogen": (1.17, "insoluble"),
    "carbon monoxide": (1.17, "insoluble"), "methane": (0.67, "insoluble"), "ammonia": (0.71, "very soluble"),
    "hydrogen chloride": (1.52, "very soluble"), "sulfur dioxide": (2.67, "very soluble"), "chlorine": (2.96, "soluble"),
    "nitrogen dioxide": (1.92, "soluble"),
}
AIR = 1.2
REACTIONS = {  # what fills the syringe
    "marble chips reacted with dilute hydrochloric acid", "magnesium ribbon reacted with dilute sulfuric acid",
    "zinc granules reacted with dilute hydrochloric acid", "hydrogen peroxide solution decomposed over manganese(IV) oxide",
    "calcium carbonate powder reacted with dilute nitric acid",
}


def collect_by(gas: str) -> str:
    """The printed rule: over water unless the gas dissolves; a soluble gas by its density against air's."""
    d, sol = GAS[gas]
    if sol in ("insoluble", "slightly soluble"):
        return "over water"
    return "upward delivery" if d < AIR else "downward delivery"


def test_gas_collection_methods():
    m = fam("gas_collection")
    seen = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        if p["kind"] != "methods":
            continue
        setups, gases = p["setups"], p["gases"]
        assert sorted(setups) == ["A", "B", "C"] and sorted(setups.values()) == ["downward delivery", "over water", "upward delivery"]
        assert len(gases) == 4 and len(set(gases)) == 4 and set(gases) <= set(GAS), (s, gases)
        at = {v: k for k, v in setups.items()}
        for q in qs:
            got = re.search(r"which set-up should be used to collect (.+)\?$", q.stem)
            if got:
                gas = got.group(1)
                assert "rule" in q.stem
                assert gas in gases and picked(q) == at[collect_by(gas)], (s, q.stem, picked(q))
                assert sorted(q.options) == ["A", "B", "C"]
                seen["which"] += 1
            elif (got := re.search(r"which gas in the table should be collected with set-up ([ABC])\?", q.stem)):
                assert "rule" in q.stem
                fits = [g for g in gases if collect_by(g) == setups[got.group(1)]]
                assert len(fits) == 1 and picked(q) == fits[0], (s, fits, q.options)
                assert sorted(q.options) == sorted(gases)
                seen["gas"] += 1
            elif "How many of the gases in the table should be collected over water?" in q.stem:
                assert int(q.answer) == sum(collect_by(g) == "over water" for g in gases), s
                seen["count"] += 1
            else:
                pytest.fail(f"seed {s}: unknown question {q.stem}")
    assert set(seen) == {"which", "gas", "count"}, seen


def test_gas_collection_syringe():
    m = fam("gas_collection")
    seen = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        if p["kind"] != "syringe":
            continue
        v = p["volume"]
        assert v % 6 == 0 and 12 <= v <= 96, (s, v)
        for q in qs:
            if "What volume of gas is in the syringe?" in q.stem:
                reaction = re.search(r"given off when (.+?) (?:in|at|for|during|on) ", q.stem).group(1)
                assert reaction in REACTIONS, (s, reaction)
                assert q.answer == str(v) and f"{v} cm³" in q.accepted and f"{v} cm3" in q.accepted
                seen["volume"] += 1
            elif "How many moles of gas are in the syringe?" in q.stem:
                assert "24 000 cm³" in q.stem
                assert frac(q.answer) == Fraction(v, 24000), (s, q.answer)
                assert f"{q.answer} mol" in q.accepted
                seen["moles"] += 1
            else:
                pytest.fail(f"seed {s}: unknown question {q.stem}")
    assert set(seen) == {"volume", "moles"}, seen


def test_gas_collection_figures_draw_what_they_ask():
    m = fam("gas_collection")
    for s in DRAWN:
        p = m.sample(random.Random(s))
        fig = m.draw(p)
        ax = fig.axes[0]
        if p["kind"] == "syringe":
            ticks = {ln.get_gid()[5:]: ln for ln in ax.lines if (ln.get_gid() or "").startswith("tick:")}
            assert sorted(int(t) for t in ticks) == list(range(0, 101, 2)), s
            tip = next(ln for ln in ax.lines if ln.get_gid() == "plunger-tip")
            x = ticks[str(p["volume"])].get_xdata()[0]
            assert abs(tip.get_xdata()[0] - x) < 1e-9, s
            # P3z review: a thick plunger read at either edge (18 or 20); its face is a thin line, an arrow points at it
            assert tip.get_linewidth() <= 1.2
            arrow = next(t for t in ax.texts if t.get_gid() == "read-arrow")
            assert abs(arrow.xy[0] - x) < 1e-9 and arrow.xyann[0] == arrow.xy[0], s
            words = " ".join(t.get_text() for t in ax.texts)
            assert "Read the scale at the arrow" in words
            for pa in ax.patches:  # nothing of the plunger sits on the gas side of its face
                if (pa.get_gid() or "").startswith("plunger"):
                    assert _data_path(pa).vertices[:, 0].min() >= x - 1e-9, s
        else:
            words = " ".join(t.get_text() for t in ax.texts)
            for g in p["gases"]:
                d, sol = GAS[g]
                assert g in words and f"{d:.2f}" in words, (s, g)
            assert "1.20" in words and "insoluble or only slightly soluble" in words
            # P3z review: hydrogen suits over water and upward delivery; the printed rule picks one, first that fits
            assert "Use the FIRST method in this list that suits the gas" in words
            rule = [t.get_text() for t in ax.texts if (t.get_gid() or "").startswith("rule:")]
            assert [r[:1] for r in rule] == ["1", "2", "3"], rule
            assert "over water" in rule[0] and "insoluble or only slightly soluble" in rule[0]
            assert "downward delivery" in rule[1] and "soluble, denser than air" in rule[1]
            assert "upward delivery" in rule[2] and "soluble, less dense than air" in rule[2]
            for name in ("over water", "upward delivery", "downward delivery"):
                assert sum(r.count(name) for r in rule) == 1  # named once, in the rule; the set-ups stay lettered
            jars = {}
            for pa in ax.patches:
                g = pa.get_gid() or ""
                if g.startswith("jar:"):
                    _, L, mouth = g.split(":")
                    v = _data_path(pa).vertices
                    jars[L] = (mouth, v[:, 1].min(), v[:, 1].max())
            troughs = {(pa.get_gid() or "")[7:] for pa in ax.patches if (pa.get_gid() or "").startswith("trough:")}
            tubes = {ln.get_gid()[5:]: ln for ln in ax.lines if (ln.get_gid() or "").startswith("tube:")}
            for L, method in p["setups"].items():
                mouth, lo, hi = jars[L]
                end_y = float(tubes[L].get_ydata()[-1])
                if method == "over water":
                    assert mouth == "down" and L in troughs, (s, L)
                elif method == "upward delivery":
                    assert mouth == "down" and L not in troughs and end_y >= lo + 0.7 * (hi - lo), (s, L)
                else:
                    assert mouth == "up" and L not in troughs and end_y <= lo + 0.3 * (hi - lo), (s, L)
        plt.close(fig)


# --- pH scale -----------------------------------------------------------------------------------------

UI = [("red", 0, 2), ("orange", 3, 4), ("yellow", 5, 6), ("green", 7, 7), ("blue", 8, 10), ("purple", 11, 14)]


def colour_at(ph: int) -> str:
    return next(n for n, lo, hi in UI if lo <= ph <= hi)


def test_ph_scale():
    m = fam("ph_scale")
    seen, kinds = Counter(), Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        kind, tubes = p["kind"], dict(p["tubes"])
        kinds[kind] += 1
        assert len(tubes) == 4 and len(set(tubes.values())) == 4 and all(0 <= v <= 14 for v in tubes.values()), (s, tubes)
        letters = [t[0] for t in p["tubes"]]
        assert letters == (["W", "X", "Y", "Z"] if kind == "oxides" else ["A", "B", "C", "D"])
        if kind == "colour":
            assert len({colour_at(v) for v in tubes.values()}) == 4, (s, tubes)  # each tube its own colour
        if kind == "oxides":
            assert 7 not in tubes.values()  # an insoluble oxide also gives pH 7: no neutral tube to argue over
            acidic = [L for L, v in tubes.items() if v < 7]
            assert len(acidic) in (1, 3), (s, tubes)
        for q in qs:
            if (got := re.search(r"most (acidic|alkaline) solution\?", q.stem)):
                key = (min if got.group(1) == "acidic" else max)(tubes, key=tubes.get)
                assert picked(q) == key, (s, q.stem)
                seen["most"] += 1
            elif (got := re.search(r"turn universal indicator (\w+), according", q.stem)):
                fits = [L for L, v in tubes.items() if colour_at(v) == got.group(1)]
                assert len(fits) == 1 and picked(q) == fits[0], (s, fits)
                seen["turn"] += 1
            elif (got := re.search(r"How many of the (?:four solutions are|tubes hold) (acidic|alkaline)", q.stem)):
                want = sum((v < 7) if got.group(1) == "acidic" else (v > 7) for v in tubes.values())
                assert int(q.answer) == want, s
                seen["count"] += 1
            elif "Which tube holds a neutral solution?" in q.stem:
                assert picked(q) == next(L for L, v in tubes.items() if v == 7)
                seen["neutral"] += 1
            elif (got := re.search(r"Between which pH values is the solution in tube ([A-Z]),", q.stem)):
                c = colour_at(tubes[got.group(1)])
                lo, hi = next((a, b) for n, a, b in UI if n == c)
                assert picked(q) == f"pH {lo} to {hi}" and c != "green", (s, picked(q))
                seen["between"] += 1
            elif (got := re.search(r"What colour would universal indicator turn in the solution of the oxide of ([A-Z])\?", q.stem)):
                assert picked(q) == colour_at(tubes[got.group(1)]), s
                assert set(q.options) <= {n for n, *_ in UI}
                seen["colour"] += 1
            elif (got := re.search(r"Which element's oxide is an? (basic|acidic) oxide\?", q.stem)):
                fits = [L for L, v in tubes.items() if (v > 7) == (got.group(1) == "basic")]
                assert len(fits) == 1 and picked(q) == fits[0], (s, tubes, q.stem)
                seen["oxide"] += 1
            else:
                pytest.fail(f"seed {s}: unknown question {q.stem}")
    assert set(kinds) == {"ph", "colour", "oxides"}, kinds
    assert set(seen) == {"most", "turn", "count", "neutral", "between", "colour", "oxide"}, seen


def test_ph_scale_chart_and_tubes_are_drawn_true():
    m = fam("ph_scale")
    for s in DRAWN:
        p = m.sample(random.Random(s))
        fig = m.draw(p)
        ax = fig.axes[0]
        cells = {int(pa.get_gid()[5:]): pa for pa in ax.patches if (pa.get_gid() or "").startswith("cell:")}
        assert sorted(cells) == list(range(15)), s
        face = {ph: tuple(cells[ph].get_facecolor()) for ph in cells}
        for n, lo, hi in UI:
            assert len({face[v] for v in range(lo, hi + 1)}) == 1, (s, n)  # one colour across a band
        assert len({face[lo] for _, lo, _ in UI}) == len(UI)  # and each band its own
        names = {t.get_gid()[5:]: t for t in ax.texts if (t.get_gid() or "").startswith("band:")}
        assert set(names) == {n for n, *_ in UI}
        for n, lo, hi in UI:
            x = names[n].get_position()[0]
            left = _data_path(cells[lo]).vertices[:, 0].min()
            right = _data_path(cells[hi]).vertices[:, 0].max()
            assert left - 1e-9 <= x <= right + 1e-9, (s, n)  # each name over its own band
        nums = {t.get_text() for t in ax.texts if (t.get_gid() or "").startswith("num:")}
        assert nums == {str(v) for v in range(15)}
        liquids = {pa.get_gid()[7:]: pa for pa in ax.patches if (pa.get_gid() or "").startswith("liquid:")}
        tags = {t.get_gid()[8:]: t.get_text() for t in ax.texts if (t.get_gid() or "").startswith("tubetag:")}
        for L, v in p["tubes"]:
            if p["kind"] == "colour":
                assert tuple(liquids[L].get_facecolor()) == face[v], (s, L)
                assert tags[L] == colour_at(v)
            else:
                assert tags[L] == f"pH {v}"
                assert tuple(liquids[L].get_facecolor()) not in set(face.values())  # no indicator added
        plt.close(fig)


# --- composition of air -------------------------------------------------------------------------------

PIE_RANGES = {  # oxygen, carbon dioxide: what such a sample really holds
    "rest": ((15, 17), (3, 5)), "run": ((13, 15), (5, 7)), "candle": ((14, 17), (2, 4)), "soil": ((16, 20), (1, 4)),
}


def test_air_composition_pie():
    m = fam("air_composition")
    seen = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        if p["kind"] != "pie":
            continue
        gases = dict(p["gases"])
        assert set(gases) == {"nitrogen", "oxygen", "carbon dioxide", "other gases"} and sum(gases.values()) == 100, (s, gases)
        (o_lo, o_hi), (c_lo, c_hi) = PIE_RANGES[p["context"]]
        assert o_lo <= gases["oxygen"] <= o_hi and c_lo <= gases["carbon dioxide"] <= c_hi, (s, gases)
        assert 74 <= gases["nitrogen"] <= 80 and 1 <= gases["other gases"] <= 6
        names = [g for g, _ in p["gases"]]
        assert abs(names.index("carbon dioxide") - names.index("other gases")) == 2  # the two thin sectors apart
        for q in qs:
            if (got := re.search(r"What percentage of the sample is (.+)\?", q.stem)):
                assert got.group(1) == p["hidden"]
                assert int(q.answer) == 100 - sum(v for g, v in gases.items() if g != p["hidden"]), s
                assert f"{q.answer}%" in q.accepted
                seen["hidden"] += 1
            elif (got := re.search(r"What angle does the (.+) sector make", q.stem)):
                want = Fraction(gases[got.group(1)] * 36, 10)
                assert want.denominator == 1 and frac(q.answer) == want, (s, q.answer)
                assert f"{q.answer}°" in q.accepted
                seen["angle"] += 1
            elif "Fresh air is 21% oxygen." in q.stem:
                assert int(q.answer) == 21 - gases["oxygen"], s
                seen["fresh"] += 1
            else:
                pytest.fail(f"seed {s}: unknown question {q.stem}")
    assert set(seen) == {"hidden", "angle", "fresh"}, seen


def test_air_composition_bars():
    m = fam("air_composition")
    seen = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        if p["kind"] != "bars":
            continue
        inh, exh = p["inhaled"], p["exhaled"]
        assert inh["oxygen"] == 21 and inh["carbon dioxide"] == 0.04 and 1 <= inh["water vapour"] <= 3
        assert 14 <= exh["oxygen"] <= 17 and 3 <= exh["carbon dioxide"] <= 6 and 5 <= exh["water vapour"] <= 7, (s, exh)
        for q in qs:
            if (got := re.search(r"What percentage of the exhaled air is (.+)\?", q.stem)):
                assert frac(q.answer) == Fraction(str(exh[got.group(1)])), s
                seen["read"] += 1
            elif "oxygen lower in exhaled air" in q.stem:
                assert int(q.answer) == inh["oxygen"] - exh["oxygen"]
                seen["oxygen"] += 1
            elif "water vapour higher in exhaled air" in q.stem:
                assert int(q.answer) == exh["water vapour"] - inh["water vapour"]
                seen["water"] += 1
            else:
                pytest.fail(f"seed {s}: unknown question {q.stem}")
    assert set(seen) == {"read", "oxygen", "water"}, seen


def test_air_composition_charts_draw_their_numbers():
    from matplotlib.patches import Wedge
    m = fam("air_composition")
    for s in DRAWN:
        p = m.sample(random.Random(s))
        fig = m.draw(p)
        ax = fig.axes[0]
        if p["kind"] == "pie":
            wedges = {pa.get_gid()[6:]: pa for pa in ax.patches if isinstance(pa, Wedge)}
            labels = {t.get_gid()[6:]: t.get_text() for t in ax.texts if (t.get_gid() or "").startswith("label:")}
            for g, v in p["gases"]:
                w = wedges[g]
                assert abs((w.theta2 - w.theta1) - v * 3.6) < 1e-6, (s, g)
                assert labels[g].startswith(g) and labels[g].endswith("?" if g == p["hidden"] else f"{v}%"), (s, labels[g])
        else:
            bars = {pa.get_gid()[4:]: pa for pa in ax.patches if (pa.get_gid() or "").startswith("bar:")}
            words = " ".join(t.get_text() for t in ax.texts)
            for series in ("inhaled", "exhaled"):
                for g, v in p[series].items():
                    assert abs(bars[f"{series}:{g}"].get_height() - v) < 1e-9, (s, series, g)
                    assert f"{v}" in words
        plt.close(fig)


# --- concentration ------------------------------------------------------------------------------------

def test_concentration_table():
    m = fam("concentration_table")
    seen, kinds = Counter(), Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        kinds[p["kind"]] += 1
        rows = {r[0]: r for r in p["rows"]}
        assert list(rows) == ["A", "B", "C", "D"]
        g_dm3 = {L: Fraction(str(r[2])) * 1000 / r[3] for L, r in rows.items()}
        mol_dm3 = {L: g_dm3[L] / r[4] for L, r in rows.items()} if p["kind"] == "moles" else None
        if p["kind"] == "mass":
            assert len({r[1] for r in rows.values()}) == 1 and all(r[4] is None for r in rows.values())
        conc = mol_dm3 or g_dm3
        top = sorted(conc.values(), reverse=True)
        low = sorted(conc.values())
        assert top[0] >= Fraction(6, 5) * top[1] and low[1] >= Fraction(6, 5) * low[0], (s, conc)  # no near-ties
        for q in qs:
            if (got := re.search(r"concentration of solution ([A-D]) in (g|mol)/dm³\?", q.stem)):
                L, unit = got.groups()
                want = g_dm3[L] if unit == "g" else mol_dm3[L]
                assert frac(q.answer) == want and f"{q.answer} {unit}/dm³" in q.accepted, (s, q.answer, want)
                seen[unit] += 1
            elif (got := re.search(r"Which solution (?:is the (most|least) concentrated|has the (highest|lowest) concentration in mol/dm³)\?", q.stem)):
                high = got.group(1) == "most" or got.group(2) == "highest"
                if got.group(2):
                    assert p["kind"] == "moles"
                key = (max if high else min)(conc, key=conc.get)
                assert picked(q) == key and sorted(q.options) == ["A", "B", "C", "D"], (s, q.stem)
                seen["rank"] += 1
            elif (got := re.search(r"wants to make (\d+) cm³ of (.+?) solution with the same concentration as solution ([A-D])\.", q.stem)):
                v, solute, L = int(got.group(1)), got.group(2), got.group(3)
                assert solute == rows[L][1]
                assert frac(q.answer) == g_dm3[L] * v / 1000 and f"{q.answer} g" in q.accepted, (s, q.answer)
                seen["mass"] += 1
            elif (got := re.search(r"What mass of (.+?) is needed to make (\d+) cm³ of a ([\d.]+) mol/dm³ solution\?", q.stem)):
                solute, v, c = got.group(1), int(got.group(2)), Fraction(got.group(3))
                row = next(r for r in rows.values() if r[1] == solute)
                assert frac(q.answer) == c * v / 1000 * row[4] and f"{q.answer} g" in q.accepted, (s, q.answer)
                seen["molar mass"] += 1
            else:
                pytest.fail(f"seed {s}: unknown question {q.stem}")
    assert set(kinds) == {"mass", "moles"}
    assert set(seen) == {"g", "mol", "rank", "mass", "molar mass"}, seen


def test_concentration_table_prints_its_numbers_and_formula():
    m = fam("concentration_table")
    for s in range(1, 61):
        p = m.sample(random.Random(s))
        words = words_of(m, p)
        for L, solute, mass, vol, molar in p["rows"]:
            assert f"{mass:g}" in words and f"{vol}" in words and solute in words, (s, L)
            if molar:
                assert str(molar) in words
        assert "1 dm³ = 1000 cm³" in words and "÷" in words
        if p["kind"] == "moles":
            assert "molar mass" in words


# --- reactivity ---------------------------------------------------------------------------------------

def test_reactivity_test_acid():
    m = fam("reactivity_test")
    seen = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        if p["kind"] != "acid":
            continue
        bubbles = dict(p["tubes"])
        assert [t[0] for t in p["tubes"]] == ["W", "X", "Y", "Z"]
        counts = sorted(bubbles.values())
        assert counts.count(0) <= 1 and len(set(counts)) == 4
        live = [c for c in counts if c]
        assert live[0] >= 3 and all(b >= 2 * a for a, b in zip(live, live[1:])), (s, counts)  # plainly different rates
        order = sorted(bubbles, key=bubbles.get, reverse=True)
        for q in qs:
            if (got := re.search(r"Which metal is the (most|least) reactive\?", q.stem)):
                assert picked(q) == (order[0] if got.group(1) == "most" else order[-1]), (s, q.stem)
                seen["one"] += 1
            elif "order of reactivity" in q.stem:
                assert picked(q) == ", ".join(order), (s, picked(q), order)
                seen["order"] += 1
            elif "Which metal did not react with the acid?" in q.stem:
                assert bubbles[picked(q)] == 0
                seen["none"] += 1
            else:
                pytest.fail(f"seed {s}: unknown question {q.stem}")
    assert set(seen) == {"one", "order", "none"}, seen


def _table(order, metals):
    return {(r, c): ("✓" if order.index(r) < order.index(c) else "✗") for r in metals for c in metals if r != c}


def _missing(p):
    """The cells with no result: metal x added to y's salt, and the reverse too when "both"."""
    x, y = p["hidden"]
    return {(x, y), (y, x)} if p["both"] else {(x, y)}


def test_reactivity_test_displacement():
    m = fam("reactivity_test")
    seen = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        if p["kind"] != "displacement":
            continue
        metals, order, salt, hidden = p["metals"], p["order"], p["salt"], tuple(p["hidden"])
        assert sorted(metals) == metals and sorted(order) == metals and len(metals) in (3, 4)
        assert salt in ("nitrate", "sulfate", "chloride")
        table = _table(order, metals)
        shown = {k: v for k, v in table.items() if k not in _missing(p)}
        # the order is fixed by the results shown: exactly one ranking agrees with them
        fits = [o for o in itertools.permutations(metals) if _table(list(o), metals).items() >= shown.items()]
        assert fits == [tuple(order)], (s, fits)
        for q in qs:
            if (got := re.search(r"Which metal is the (most|least) reactive\?", q.stem)):
                assert picked(q) == (order[0] if got.group(1) == "most" else order[-1])
                seen["one"] += 1
            elif "order of reactivity" in q.stem:
                assert picked(q) == ", ".join(order)
                seen["order"] += 1
            elif (got := re.search(r"no result for metal ([A-Z]) in ([A-Z]) (\w+) solution", q.stem)):
                x, y, sl = got.groups()
                assert (x, y) == hidden and sl == salt  # the very cell that has no result
                reacts = order.index(x) < order.index(y)
                assert picked(q).startswith("A reaction happens" if reacts else "No reaction happens"), (s, picked(q))
                assert (f"{x} is more reactive than {y}" in picked(q)) == reacts
                seen["hidden"] += 1
            elif "word equation" in q.stem:
                eq = re.fullmatch(r"([A-Z]) \+ ([A-Z]) (\w+) → ([A-Z]) (\w+) \+ ([A-Z])", picked(q))
                x, y, s1, x2, s2, y2 = eq.groups()
                assert x == x2 and y == y2 and s1 == s2 == salt, (s, picked(q))
                assert shown.get((x, y)) == "✓", (s, picked(q))  # a reaction the table shows happening
                seen["equation"] += 1
            else:
                pytest.fail(f"seed {s}: unknown question {q.stem}")
    assert set(seen) == {"one", "order", "hidden", "equation"}, seen


def test_reactivity_test_missing_result_is_not_a_pattern():
    """The missing result was always the most and least reactive pair in a 3-metal table (P3z review): a student could
    learn where the "?" sits instead of reading the table. Over 1,000 seeds the missing cell is "displaces" and "no
    reaction" each 40-60% of the time, in 3- and 4-metal tables alike, and is often a pair of neighbours in the order."""
    m = fam("reactivity_test")
    answers, pairs = Counter(), Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        if p["kind"] != "displacement":
            continue
        order, (x, y) = p["order"], p["hidden"]
        n = len(p["metals"])
        q = next(q for q in qs if "no result for metal" in q.stem)
        answers[(n, picked(q).startswith("A reaction happens"))] += 1
        answers[picked(q).startswith("A reaction happens")] += 1
        gap = abs(order.index(x) - order.index(y))
        pairs["neighbours" if gap == 1 else "apart"] += 1
        if gap == 1:
            assert not p["both"], s  # both cells of neighbours missing would leave the order open
        if n == 3:
            pairs["extreme" if {x, y} == {order[0], order[-1]} else "not extreme"] += 1
    total = answers[True] + answers[False]
    assert 0.4 <= answers[True] / total <= 0.6, answers
    for n in (3, 4):
        both = answers[(n, True)] + answers[(n, False)]
        assert 0.4 <= answers[(n, True)] / both <= 0.6, (n, answers)
    assert pairs["neighbours"] >= 0.3 * total and pairs["not extreme"] >= 0.4 * (pairs["extreme"] + pairs["not extreme"]), pairs


def test_reactivity_test_figures_draw_their_results():
    m = fam("reactivity_test")
    for s in DRAWN:
        p = m.sample(random.Random(s))
        fig = m.draw(p)
        ax = fig.axes[0]
        if p["kind"] == "acid":
            got = Counter((pa.get_gid() or "")[7:] for pa in ax.patches if (pa.get_gid() or "").startswith("bubble:"))
            for L, n in p["tubes"]:
                assert got[L] == n, (s, L, got[L], n)
        else:
            cells = {tuple(t.get_gid()[5:].split(":")): t.get_text() for t in ax.texts if (t.get_gid() or "").startswith("cell:")}
            table = _table(p["order"], p["metals"])
            for (r, c), v in table.items():
                want = "?" if (r, c) in _missing(p) else v
                assert cells[(r, c)] == want, (s, r, c)
            for x in p["metals"]:
                assert cells[(x, x)] == "—"
        plt.close(fig)


# --- all six ------------------------------------------------------------------------------------------

@pytest.mark.parametrize("fid", WAVE)
def test_an_mcq_cannot_be_picked_from_its_options_alone(fid):
    m = fam(fid)
    seen, hits = defaultdict(int), defaultdict(int)
    for s in range(1, 301):
        _, qs = run(m, s)
        for q in qs:
            if q.kind == "mcq":
                key = re.sub(r"\d+", "#", q.stem.rsplit(". ", 1)[-1])
                seen[key] += 1
                hits[key] += _central(q.options) == int(q.answer)
    bad = {k: (hits[k], seen[k]) for k in seen if seen[k] >= 10 and hits[k] / seen[k] > 0.35}
    assert not bad, (fid, bad)


@pytest.mark.parametrize("fid", WAVE)
def test_most_figures_have_a_wording_of_their_own(fid):
    m = fam(fid)
    stems = []
    for seed in range(1, 31):
        rng = random.Random(seed)
        stems.append({q.stem for q in m.questions(m.sample(rng), rng)})
    own = sum(1 for i, s in enumerate(stems) if s - set().union(*(t for j, t in enumerate(stems) if j != i)))
    assert own >= 27, f"{fid}: only {own} of 30 figures have a wording of their own"


@pytest.mark.parametrize("fid", WAVE)
def test_a_figure_belongs_to_the_person_in_the_first_question(fid):
    m = fam(fid)
    bands = set()
    for seed in range(1, 120):
        rng = random.Random(seed)
        p = m.sample(rng)
        bands.add(p["band"])
        qs = m.questions(p, rng)
        first = next((n for n in NAMES if qs[0].stem.startswith(n)), None)
        assert first, qs[0].stem
        for q in qs:
            for owner in re.findall(r"\b(" + "|".join(NAMES) + r")'s\b", q.stem):
                assert owner == first, (fid, seed, q.stem)
    assert bands == set(fam(fid).BANDS) == {"LS", "UP"}, (fid, bands)


@pytest.mark.parametrize("fid", WAVE)
def test_no_label_sits_on_a_line(fid):
    m = fam(fid)
    for s in range(1, 16):
        fig = m.draw(m.sample(random.Random(s)))
        bad = labels_clear_of_lines(fig)
        plt.close(fig)
        assert not bad, (fid, s, bad[:5])


@pytest.mark.parametrize("fid", WAVE)
def test_declares_its_concepts_and_links(fid):
    m = fam(fid)
    assert m.SUBJECT == "chemistry" and m.CONCEPTS and all(c.startswith("chemistry.") for c in m.CONCEPTS)
    assert m.NEEDS and re.compile(m.NEEDS) and re.compile(m.AVOID)
    if STORE.exists():
        db = sqlite3.connect(f"file:{STORE}?mode=ro", uri=True)
        known = {r[0] for r in db.execute("SELECT id FROM concepts")}
        every = set(m.CONCEPTS) | set(getattr(m, "ALSO", ()))
        for s in range(1, 200):
            narrow = getattr(m, "concepts_for", None)
            if narrow:
                got = set(narrow(m.sample(random.Random(s))))
                assert got and got <= set(m.CONCEPTS), (fid, got)  # a figure narrows its family's concepts, never adds
        assert every <= known, sorted(every - known)


LINK_CASES = {  # fid: (names AVOID must turn away, names or sections NEEDS must match and AVOID must not)
    "separation_apparatus": (["Chromatography", "Separation and purification of organic compounds"],
                             ["Treatment and purification of water", "Different Ways of Preparing Normal Salts",
                              "Chapter 15: Separation techniques", "Methods of separating mixtures", "Laboratory apparatus"]),
    "gas_collection": (["Air, Composition and Pollution", "Chemistry of our environment", "Organic chemistry",
                        "Concentration of solutions", "Solubility and Solubility Product of Sparingly Soluble Salts"],
                       ["Methods of collecting gases", "Calculation of Molar Gas Volume under Standard Conditions",
                        "Preparation and test for chlorine", "Laboratory preparation of nitrogen",
                        "Inorganic compounds of sulphur and their properties", "Carbon and its inorganic compounds",
                        "Properties, preparation and testing for carbon dioxide, carbonates and hydrogen carbonates and their uses"]),
    "ph_scale": (["Concentration of solutions", "Indicators and Titration Curves", "Glossary and index",
                  "Trends in Chemical Properties of Group 15 Elements and Their Compounds",
                  "Solubility and Solubility Product of Sparingly Soluble Salts"],
                 ["Acids, Bases and pH", "The pH of a solution", "Chemical properties of acids and bases",
                  "Classification of Oxides", "Chemical analysis", "Acids bases salts"]),
    "air_composition": (["Water Pollution", "Waste Materials"], ["Air, Composition and Pollution", "Components of air and their percentages"]),
    "concentration_table": (["The Mole Concept and Gas Laws", "Introduction to chemistry", "States of matter"],
                            ["Concentration of solutions", "Solutions and Titration", "Calculations on the mole", "Stoichiometry"]),
    "reactivity_test": (["Metallic elements and alloys", "Introduction to chemistry", "Stoichiometry", "Redox reactions", "Radioactivity"],
                        ["Reactivity of metals", "The reactivity series", "Reactions of acids and bases",
                         "Interpreting and translating word equations into chemical equations", "Types of Reactions"]),
}


@pytest.mark.parametrize("fid", WAVE)
def test_links_turn_away_the_misfits_and_keep_the_fits(fid):
    """Each family's NEEDS and AVOID read against topic names and sections (P3z reach check)."""
    m = fam(fid)
    misfits, fits = LINK_CASES[fid]
    for name in misfits:
        assert re.search(m.AVOID, name, re.I) or not re.search(m.NEEDS, name, re.I), (fid, name)
    for name in fits:
        assert re.search(m.NEEDS, name, re.I) and not re.search(m.AVOID, name, re.I), (fid, name)


REACH = {  # the empty topics each family is for, by key (names in the P3z brief)
    "separation_apparatus": {"db:953": "Water and its Composition", "db:965": "Preparation of Salts and Identification of Ions",
                             "db:975": "Preparation of Salts and Identification of Ions"},
    "gas_collection": {"db:966": "The Mole Concept and Gas Laws", "db:976": "The Mole Concept and Gas Laws",
                       "db:980": "Carbon and its inorganic compounds", "db:981": "Nitrogen and its inorganic compounds",
                       "db:982": "Sulphur and its inorganic compounds", "db:983": "Chlorine and its inorganic compounds"},
    "ph_scale": {"db:957": "Acids, Bases and pH", "db:967": "Preparation and Classification of Oxides",
                 "db:977": "Preparation and Classification of Oxides", "db:205": "Chemical analysis"},
    "air_composition": {"db:954": "Air, Composition and Pollution"},
    "concentration_table": {"db:986": "Concentration of solutions"},
    "reactivity_test": {"db:198": "Reactivity of metals", "db:956": "Chemical Equations"},
}


@pytest.mark.skipif(not STORE.exists(), reason="no figure library")
@pytest.mark.parametrize("fid", WAVE)
def test_reaches_the_empty_topics_it_is_for(fid):
    from figgen import link
    db = sqlite3.connect(f"file:{STORE}?mode=ro", uri=True)
    db.row_factory = sqlite3.Row
    index = link.topic_index(db)
    names = {r["key"]: r["name"] for r in db.execute("SELECT key, name FROM topics")}
    got = link.reach(index, fam(fid), 200)
    for key, name in REACH[fid].items():
        assert names[key] == name
        assert key in got, (fid, key, name)
