"""Answers of the P6 maths families (thin mathematics topics), recomputed independently over 1,000 seeds.

Nothing here calls a family's own helpers to work out a key: each test reads the params, works the mathematics out
again in this file (a base-b numeral digit by digit, a prime factorisation by trial division, a projectile's range from
u, the angle and g), and checks the key, that every MCQ has exactly one right option, that every value a question needs
is printed in the figure, and that no MCQ key can be picked from its options alone.

The checks every P6 family shares come first (`common`); each family's own test follows: number_base, early_numbers_p,
halves_p, measures_p, factor_tree, surd_shapes, ratio_bar, decimal_chart, circular_measure, solid_mensuration, thales,
symmetry_p, turns_p, angle_measure_p, solids_p, algebraic_fraction; then the A Level mechanics (projectile_m,
collision_m, elastic_string_m, circular_motion_m, rigid_body_m), the A Level statistics and pure families (sign_test,
paired_t_test, hyperbolic_graph, arrangements, exp_tangent) and cayley_table, sequence_plot, coord_geometry,
completing_square.
"""
import itertools
import json
import math
import random
import re
import sqlite3
from collections import Counter, defaultdict
from decimal import ROUND_HALF_UP, Decimal
from fractions import Fraction
from pathlib import Path

import matplotlib.pyplot as plt
import pytest
from matplotlib.lines import Line2D
from matplotlib.text import Text

from figgen.core import NAMES
from figgen.families import FAMILIES

SEEDS = range(1, 1001)
DRAWN = range(1, 41)  # the figure itself is built and read for these seeds
STORE = Path("C:/Users/Stephen/figure-library/figures.db")


def fam(fid):
    if fid not in FAMILIES:
        pytest.fail(f"{fid} is not registered")
    return FAMILIES[fid]


def run(m, seed):
    rng = random.Random(seed)
    p = m.sample(rng)
    return p, m.questions(p, rng)


def picked(q):
    return q.options[int(q.answer)]


def wrong(q):
    return [o for i, o in enumerate(q.options) if i != int(q.answer)]


def one_correct(q, good) -> None:
    """Exactly one option is right, and it is the key."""
    right = [o for o in q.options if good(o)]
    assert right == [picked(q)], (q.stem, q.options, right)


def _central(options):
    toks = [Counter(re.findall(r"-?\d+|[a-zA-Z]+|\S", o)) for o in options]
    score = [sum(sum(((t - u) + (u - t)).values()) for u in toks) for t in toks]
    best = min(score)
    return score.index(best) if score.count(best) == 1 else None


def drawn_texts(fig):
    """Every piece of text the renderer drew, with its box in pixels."""
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


def words(m, p) -> str:
    """All the text a figure prints, joined (tick labels and titles too)."""
    fig = m.draw(p)
    try:
        return " | ".join(t.get_text() for t, _ in drawn_texts(fig))
    finally:
        plt.close(fig)


def own_wordings(m) -> int:
    """How many of 30 figures carry a stem no other of the 30 has (the shared wording test, P2a)."""
    stems = []
    for seed in range(1, 31):
        rng = random.Random(seed)
        stems.append({q.stem for q in m.questions(m.sample(rng), rng)})
    return sum(1 for i, s in enumerate(stems) if s - set().union(*(t for j, t in enumerate(stems) if j != i)))


def reach_names(m, samples=200) -> set:
    from figgen.link import reach, topic_index
    db = sqlite3.connect(f"file:{STORE}?mode=ro", uri=True)
    db.row_factory = sqlite3.Row
    index = topic_index(db)
    names = {t["key"]: t["name"] for t in index}
    return {names[k] for k in reach(index, m, samples=samples)}


def variety(m, seeds=3000) -> int:
    """How many different figures (the person aside) the first seeds draw: generate.py draws 1,000 a family."""
    return len({json.dumps({k: v for k, v in m.sample(random.Random(s)).items() if k != "name"}, sort_keys=True)
                for s in range(1, seeds + 1)})


def common(fid, want=(), never=(), primary=False, min_pt=8, distinct=1000):
    """What every P6 family must do: be maths, linked by known concepts, worded figure by figure, with a person in the
    first stem, MCQs of three or four different options that cannot be picked unseen, JSON-safe params, readable text,
    enough different figures for a volume draw, and reach the thin topics it was written for (and none of the misfits
    named)."""
    m = fam(fid)
    assert m.SUBJECT == "mathematics" and set(m.BANDS) <= {"P", "LS", "UP", "AL"}
    assert m.CONCEPTS and all(c.startswith("mathematics.") for c in m.CONCEPTS)
    assert own_wordings(m) >= 27, fid
    assert variety(m) >= distinct, (fid, variety(m))
    seen, hits = defaultdict(int), defaultdict(int)
    for s in range(1, 301):
        p, qs = run(m, s)
        assert json.loads(json.dumps(p)) == p, (fid, s, "params must survive JSON")
        assert p["band"] in m.BANDS
        if primary or p["band"] == "P":
            lo, hi = m.stages(p)
            assert 1 <= lo <= hi <= 6
        assert any(qs[0].stem.startswith(n) for n in NAMES), (fid, s, qs[0].stem)
        for q in qs:
            assert not re.search(r"the answer above|that (?:price|number|value|graph)\b|the same (?:figure|graph)", q.stem), q.stem
            if q.kind == "mcq":
                assert 3 <= len(q.options) <= 4 and len(set(q.options)) == len(q.options), (fid, s, q.options)
                key = re.sub(r"\d+(?:\.\d+)?", "#", q.stem.rsplit(". ", 1)[-1])
                seen[key] += 1
                hits[key] += _central(q.options) == int(q.answer)
            else:
                assert q.answer == q.accepted[0] and len(q.answer) <= 40
    bad = {k: (hits[k], seen[k]) for k in seen if seen[k] >= 10 and hits[k] / seen[k] > 0.35}
    assert not bad, (fid, bad)
    small = 10 if primary else min_pt
    for s in range(1, 13):
        fig = m.draw(m.sample(random.Random(s)))
        for t, _ in drawn_texts(fig):
            assert t.get_fontsize() >= small, (fid, s, t.get_text(), t.get_fontsize())
        plt.close(fig)
    if STORE.exists() and (want or never):
        got = reach_names(m)
        assert set(want) <= got, (fid, sorted(set(want) - got))
        assert not got & set(never), (fid, sorted(got & set(never)))


# --- number_base ---------------------------------------------------------------------------------------------

def nb_to_int(s: str, b: int) -> int:
    v = 0
    for ch in s:
        d = int(ch)
        assert 0 <= d < b, (s, b)
        v = v * b + d
    return v


def nb_from_int(n: int, b: int) -> str:
    out = ""
    while n:
        out = str(n % b) + out
        n //= b
    return out or "0"


NB_SUB = str.maketrans("₀₁₂₃₄₅₆₇₈₉", "0123456789")


def test_number_base_common():
    common("number_base", want={"Number Bases", "Number bases", "Number and numeration"},
           never={"Unit 3: Binary operations", "Unit 4: Set of real numbers", "Indices and Surds"})


def test_number_base():
    m = fam("number_base")
    subs = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        b = p["b"]
        subs[(p["band"], p["sub"])] += 1
        assert 2 <= b <= 9
        if p["sub"] == "chart":
            ds = "".join(str(d) for d in p["digits"])
            v = nb_to_int(ds, b)
            assert ds[0] != "0"
            for q in qs:
                if "Which base-ten number does the chart show?" in q.stem:
                    one_correct(q, lambda o: o == str(v))
                elif q.stem.endswith("What is the number in base ten?"):
                    assert q.answer == str(v)
                else:
                    got = re.search(r"digit in the (\d+)s column\?$", q.stem)
                    assert got, q.stem
                    place = int(got.group(1))
                    k = round(math.log(place, b))
                    assert b ** k == place and k >= 1
                    assert q.answer == str(int(ds[len(ds) - 1 - k]) * place)
            if s in DRAWN:
                text = words(m, p)
                for k in range(len(ds)):
                    assert f"= {b ** k}" in text
                assert f"base {b}" in text
        elif p["sub"] == "ladder":
            n = p["n"]
            want = nb_from_int(n, b)
            # the ladder worked again: each row's quotient and remainder
            rows, x = [(n, None)], n
            while x:
                rows.append((x // b, x % b))
                x //= b
            for q in qs:
                if q.kind == "mcq":
                    one_correct(q, lambda o: o.translate(NB_SUB)[:-1] == want and o[-1] == "₀₁₂₃₄₅₆₇₈₉"[b])
                    for o in q.options:
                        assert all(int(c) < b for c in o[:-1]), (s, o)
                elif "remainder belongs in the box" in q.stem:
                    assert p["hide"] == "r" and q.answer == str(rows[p["row"] + 1][1])
                elif "number belongs in the box" in q.stem:
                    assert p["hide"] == "q" and q.answer == str(rows[p["row"]][0])
                else:
                    assert q.stem.endswith(f"What is the number in base {b}?") and q.answer == want
                    assert f"{want}_{b}" in q.accepted and f"{want} base {b}" in q.accepted
            if s in DRAWN:
                text = words(m, p)
                assert str(n) in text and f"base {b}" in text
                shown_r = set(re.findall(r"r (\d)", text))
                assert shown_r <= {str(r) for _, r in rows[1:]}
        else:
            top = "".join(map(str, p["top"]))
            bot = "".join(map(str, p["bottom"]))
            va, vb = nb_to_int(top, b), nb_to_int(bot, b)
            res = nb_from_int(va + vb if p["sub"] == "add" else va - vb, b)
            assert p["sub"] == "add" or va - vb > 0
            for q in qs:
                got = re.search(r"which digit of the answer goes in the (.+) column\?$", q.stem)
                if got:
                    place = got.group(1)
                    k = 0 if place == "units" else 1 if place == f"{b}s" else "⁰¹²³⁴⁵".index(place[1]) if len(place) == 3 else None
                    assert k is not None, place
                    assert q.answer == res[len(res) - 1 - k], (s, q.stem, res)
                else:
                    assert re.search(r"What is the (sum|difference) in base \d\?$", q.stem)
                    assert ("sum" in q.stem) == (p["sub"] == "add") and q.answer == res, (s, q.answer, res)
            if s in DRAWN:
                text = words(m, p)
                assert f"base {b}" in text
                # each digit in its own column, units first as drawn: both numbers, nothing else, before the base note
                assert re.sub(r"\D", "", text) == top[::-1] + bot[::-1] + str(b), (s, text)
    assert len(subs) == 8 and min(subs.values()) > 80, subs


# --- Primary checks shared by the P6 Primary families ----------------------------------------------------------

def short_sentences(q, most=16):
    """Short sentences a child can follow when they are read aloud."""
    for sentence in re.split(r"(?<=[.?!])\s+", q.stem):
        assert len(sentence.split()) <= most, sentence


def p6_segments(art):
    from matplotlib.lines import Line2D
    if isinstance(art, Line2D):
        pts = art.get_transform().transform(art.get_xydata())
        return list(zip(pts, pts[1:]))
    out = []
    for poly in art.get_path().to_polygons(art.get_transform(), closed_only=False):
        out += list(zip(poly, poly[1:]))
    return out


def p6_passes(a, b, box, margin=1.5, steps=60) -> bool:
    return any(box.x0 + margin < a[0] + (b[0] - a[0]) * k / steps < box.x1 - margin and
               box.y0 + margin < a[1] + (b[1] - a[1]) * k / steps < box.y1 - margin for k in range(steps + 1))


def no_line_through_text(fig, tag):
    """No line or outline runs through a piece of text (fills marked 'behind' aside)."""
    texts = drawn_texts(fig)
    for ax in fig.axes:
        for art in list(ax.lines) + list(ax.patches):
            if (art.get_gid() or "").startswith("behind") or not art.get_visible():
                continue
            for a, b in p6_segments(art):
                for t, box in texts:
                    assert not p6_passes(a, b, box), (tag, art.get_gid() or type(art).__name__, t.get_text())


def patches(fig, prefix):
    return [pa for ax in fig.axes for pa in list(ax.patches) + list(ax.lines) if (pa.get_gid() or "").startswith(prefix)]


# --- early_numbers_p -------------------------------------------------------------------------------------------

def test_early_numbers_p_common():
    common("early_numbers_p", primary=True, distinct=600,
           want={"Numbers to 10", "Numbers to 20", "Numbers from 1 up to 5", "Numbers from 0 up to 100",
                 "Number patterns"},
           never={"Main parts of the day and days of the week", "Rwandan currency from 1 frw up to 100 frw", "Time",
                  "Working with numbers to 10", "Working with numbers to 20", "Pictographs", "Basic operations",
                  "Multiplication and division by 2", "Fractions"})


def test_early_numbers_p():
    m = fam("early_numbers_p")
    subs = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        sub = p["sub"]
        subs[sub] += 1
        assert m.stages(p) == (1, 2)
        for q in qs:
            short_sentences(q)
        if sub == "frames":
            n, cells = p["n"], 10 * p["frames"]
            assert 1 <= n < cells and (n > 10) == (p["frames"] == 2)
            assert qs[0].answer == str(n) and qs[1].answer == str(cells - n)
        elif sub == "compare":
            (ca, cb), (a, b) = p["colours"], p["counts"]
            q = qs[0]
            want = f"more {ca}" if a > b else f"more {cb}" if b > a else "the same number"
            one_correct(q, lambda o: o == want)
            if a != b:
                assert qs[1].answer == str(abs(a - b)) and f"more {ca if a > b else cb} counters" in qs[1].stem
            else:
                assert qs[1].answer == str(a)
        elif sub == "track":
            nums, gap, step = p["nums"], p["gap"], p["step"]
            assert all(y - x == step for x, y in zip(nums, nums[1:]))
            shown = [v for i, v in enumerate(nums) if i != gap]
            assert len(shown) >= 5 and 0 <= min(nums) and max(nums) <= 100
            assert qs[0].answer == str(nums[gap])
            assert ("comes next" in qs[0].stem) == (gap == len(nums) - 1)
            if step > 1:
                assert f"{step}s" in qs[0].stem
        elif sub == "pairs":
            n = p["n"]
            for q in qs:
                if "odd or even" in q.stem:
                    assert q.answer == ("odd" if n % 2 else "even")
                else:
                    assert q.answer == str(n)
        else:
            t, o = p["tens"], p["ones"]
            assert qs[0].answer == str(10 * t + o) and qs[1].answer == str(t)
        if s in DRAWN:
            fig = m.draw(p)
            if sub == "frames":
                assert len(patches(fig, "counter:")) == p["n"] and len(patches(fig, "cell:")) == 10 * p["frames"]
            elif sub == "compare":
                for word, n in zip(p["colours"], p["counts"]):
                    assert len(patches(fig, f"{word}:")) == n
            elif sub == "track":
                shown = sorted(int(t.get_text()) for t, _ in drawn_texts(fig) if (t.get_gid() or "").startswith("num:"))
                assert shown == sorted(v for i, v in enumerate(p["nums"]) if i != p["gap"])
            elif sub == "pairs":
                assert len(patches(fig, "bean:")) == p["n"]
            else:
                assert len(patches(fig, "behind-loose:")) == p["ones"]
                assert len(patches(fig, "behind-band:")) == p["tens"]
                assert len(patches(fig, "behind-stick:")) == 10 * p["tens"]
            no_line_through_text(fig, ("early_numbers_p", s))
            plt.close(fig)
    assert len(subs) == 5 and min(subs.values()) > 150, subs


# --- halves_p --------------------------------------------------------------------------------------------------

def hp_area(poly) -> float:
    pts = list(poly)
    return abs(sum(x0 * y1 - x1 * y0 for (x0, y0), (x1, y1) in zip(pts, pts[1:] + pts[:1]))) / 2


def hp_shapes(fig) -> dict:
    """Each drawn shape's parts, measured: {gid prefix: [(area, coloured?)]}."""
    out = defaultdict(list)
    for pa in patches(fig, "shape"):
        bits = pa.get_gid().split(":part:")
        idx, on = bits[1].split(":")
        out[bits[0]].append((hp_area(pa.get_xy()[:-1]), on == "on"))
    return out


HP_WORDS = {Fraction(1, 2): "one half", Fraction(1, 4): "one quarter", Fraction(3, 4): "three quarters",
            Fraction(1, 8): "one eighth"}


def test_halves_p_common():
    common("halves_p", primary=True, distinct=500,
           want={"Fractions", "Fractions (2)", "Fractions and decimals", "Fractions 1/2, 1/4 and 1/8"},
           never={"Multiplication and division by 2", "Numbers to 10", "Measures (2)", "Time", "12 More fractions",
                  "Fractions having a denominator less than or equal to 10"})


def test_halves_p():
    m = fam("halves_p")
    subs = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        subs[p["sub"]] += 1
        for q in qs:
            short_sentences(q)
        if p["sub"] == "set":
            t, part = p["total"], p["part"]
            assert t % part == 0 and qs[0].answer == str(t // part) and qs[1].answer == str(t)
            assert ("half" in qs[0].stem) == (part == 2) and ("quarter" in qs[0].stem) == (part == 4)
            if s in DRAWN:
                fig = m.draw(p)
                assert len([pa for pa in patches(fig, "thing:") if pa.get_gid().count(":") == 1]) == t
                plt.close(fig)
            continue
        if s not in DRAWN and s > 300:
            continue
        fig = m.draw(p)
        shapes = hp_shapes(fig)
        plt.close(fig)
        measured = {}
        for gid, pieces in shapes.items():
            areas = [a for a, _ in pieces]
            same = max(areas) / min(areas) < 1.01
            frac = sum(a for a, on in pieces if on) / sum(areas)
            measured[gid] = (same, frac, len(pieces))
        if p["sub"] == "shapes":
            want = 0.5 if p["ask"] == "half" else 0.25
            good = {g.split(":")[1] for g, (same, frac, n) in measured.items() if same and abs(frac - want) < 0.005}
            assert len(good) == 1, (s, measured)
            one_correct(qs[0], lambda o: o == f"Shape {next(iter(good))}")
            assert qs[1].answer == str(sum(1 for same, _, _ in measured.values() if same)), (s, measured)
        else:
            (same, frac, n), = measured.values()
            assert same and n == p["n"]
            word = HP_WORDS[Fraction(frac).limit_denominator(8)]
            one_correct(qs[0], lambda o: o == word)
            assert qs[1].answer == str(n)
            assert m.stages(p) == ((2, 2) if n == 8 else (1, 2))
    assert len(subs) == 3 and min(subs.values()) > 150, subs
    for s in DRAWN:
        fig = m.draw(m.sample(random.Random(s)))
        no_line_through_text(fig, ("halves_p", s))
        plt.close(fig)


# --- measures_p ------------------------------------------------------------------------------------------------

def mp_two(v, big, small):
    return f"{v // 1000} {big} {v % 1000} {small}"


def test_measures_p_common():
    common("measures_p", primary=True, distinct=600,
           want={"Capacity measurements from liter to milliliter", "Mass measurements from kilogram to gram",
                 "Capacity Measurements", "Mass Measurements"},
           never={"Measures (2)", "Litre, the Standard Unit of Capacity Measurements", "Kilogram, the Standard Unit of Mass",
                  "Relationship Between Volume, Capacity and Mass", "Length Measurement", "Time"})


def test_measures_p():
    m = fam("measures_p")
    subs = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        sub = p["sub"]
        subs[sub] += 1
        assert m.stages(p) == ((4, 4) if p["top"] > 1000 else (3, 4))
        for q in qs:
            short_sentences(q)
        v = sum(p["weights"]) if sub == "weights" else p["v"]
        if sub != "weights":
            assert v % p["minor"] == 0 and 0 < v < p["top"]
        unit, big = ("ml", "l") if sub == "jug" else ("g", "kg")
        assert qs[0].answer == str(v) and f"{v} {unit}" in qs[0].accepted
        q = qs[1]
        if "more" in q.stem:
            assert v < 1000 and q.answer == str(1000 - v)
        elif "litres and millilitres" in q.stem or "kilograms and grams" in q.stem:
            assert v > 1000 and q.answer == mp_two(v, big, unit)
        elif "heaviest" in q.stem:
            one_correct(q, lambda o: o == ("1 kg" if max(p["weights"]) == 1000 else f"{max(p['weights'])} g"))
        else:
            assert v == 1000 and q.answer == "1"
        if s in DRAWN:
            fig = m.draw(p)
            text = " | ".join(t.get_text() for t, _ in drawn_texts(fig))
            if sub == "jug":
                liquid = [pa for pa in patches(fig, "behind-liquid")][0]
                mark = [ln for ln in patches(fig, f"mark:{v}")][0]
                assert abs(liquid.get_y() + liquid.get_height() - mark.get_ydata()[0]) < 1e-9
                assert liquid.get_y() == 0 and "1 litre = 1000 ml" in text
                ys = sorted(ln.get_ydata()[0] for ln in patches(fig, "mark:"))
                steps = {round(b - a, 9) for a, b in zip(ys, ys[1:])}
                assert len(steps) == 1, (s, "marks evenly spaced")
                for k in range(p["label"], p["top"] + 1, p["label"]):
                    assert f"{k} ml" in text
            elif sub == "scale":
                ax = fig.axes[0]
                arrow = [a for a in ax.texts if a.get_gid() == "pointer"][0]
                x, y = arrow.xy
                deg = math.degrees(math.atan2(y, x))
                deg = deg + 360 if deg < -61 else deg  # the dial runs from 240 degrees down to -60
                read = (240 - deg) * p["top"] / 300
                assert abs(read - v) < 1e-6, (s, read, v)
                assert "1 kg = 1000 g" in text and "grams" in text
            else:
                shown = [t.get_text() for t, _ in drawn_texts(fig) if (t.get_gid() or "").startswith("weight:")]
                total = sum(1000 if w == "1 kg" else int(w.split()[0]) for w in shown)
                assert total == v, (s, shown)
            no_line_through_text(fig, ("measures_p", s))
            plt.close(fig)
    assert len(subs) == 3 and min(subs.values()) > 250, subs


# --- factor_tree -----------------------------------------------------------------------------------------------

def ft_is_prime(n: int) -> bool:
    return n > 1 and all(n % d for d in range(2, int(n ** 0.5) + 1))


def ft_primes(n: int) -> Counter:
    out, d = Counter(), 2
    while n > 1:
        while n % d == 0:
            out[d] += 1
            n //= d
        d += 1
    return out


def ft_index(c: Counter) -> str:
    sup = str.maketrans("0123456789", "⁰¹²³⁴⁵⁶⁷⁸⁹")
    return " × ".join(str(q) + (str(e).translate(sup) if e > 1 else "") for q, e in sorted(c.items()))


def ft_walk(t, path=""):
    if isinstance(t, int):
        assert ft_is_prime(t), t
        yield path, t
        return
    n, left, right = t
    lv = left if isinstance(left, int) else left[0]
    rv = right if isinstance(right, int) else right[0]
    assert lv * rv == n and lv > 1 and rv > 1, t
    yield path, n
    yield from ft_walk(left, path + "0")
    yield from ft_walk(right, path + "1")


def test_factor_tree_common():
    common("factor_tree",
           want={"Prime Factorization and Divisibility Tests", "Powers, Indices, LCM and GCF", "Numbers and sequences",
                 "Unit 1: Review of number concepts", "Indices and Surds"},
           never={"Glossary and Index", "Number Bases", "Multiplication and division (1)", "Unit 2: Sets of numbers",
                  "Classifying Numbers by Their Properties", "Quadratic Equations", "Chapter 1: Irrational numbers"})


def test_factor_tree():
    m = fam("factor_tree")
    subs = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        sub = p["sub"]
        subs[(p["band"], sub)] += 1
        if p["band"] == "P":
            assert m.stages(p) == (5, 6)
        if sub in ("tree", "root", "ladder"):
            n = p["n"]
            c = ft_primes(n)
            assert len(c) >= 2
            mcqs = [q for q in qs if q.kind == "mcq"]
            assert len(mcqs) == 1
            one_correct(mcqs[0], lambda o: o == ft_index(c))
        if sub in ("tree", "root"):
            values = dict(ft_walk(p["tree"]))
            assert values[""] == p["n"]
            if sub == "root":
                r = math.isqrt(p["n"])
                assert r * r == p["n"] and all(e % 2 == 0 for e in c.values())
                assert qs[0].answer == str(r)
            else:
                assert p["blank"] and qs[0].answer == str(values[p["blank"]])
            if s in DRAWN:
                fig = m.draw(p)
                shown = {t.get_gid()[5:]: int(t.get_text()) for t, _ in drawn_texts(fig) if (t.get_gid() or "").startswith("node:")}
                plt.close(fig)
                assert shown == {k: v for k, v in values.items() if k != p["blank"]}, (s, shown)
        elif sub == "ladder":
            n, rows, x = p["n"], [], p["n"]
            while x > 1:
                d = next(d for d in range(2, x + 1) if x % d == 0)  # the smallest prime that divides
                rows.append((d, x))
                x //= d
            rows.append((0, 1))
            if p["blank"] == "d":
                assert "prime" in qs[0].stem and qs[0].answer == str(rows[p["row"]][0])
            else:
                assert qs[0].answer == str(rows[p["row"] + 1][1])
            if s in DRAWN:
                text = words(m, p)
                assert str(n) in text
        else:
            A = math.prod(p["common"] + p["a_only"])
            B = math.prod(p["common"] + p["b_only"])
            assert math.gcd(A, B) == math.prod(p["common"]) and not set(p["a_only"]) & set(p["b_only"])
            for q in qs:
                if "number A?" in q.stem:
                    assert q.answer == str(A)
                elif "number B?" in q.stem:
                    assert q.answer == str(B)
                elif "HCF" in q.stem or "GCF" in q.stem:
                    assert q.answer == str(math.gcd(A, B)) and ("GCF" in q.stem) == (p["band"] == "P")
                else:
                    assert "LCM" in q.stem and q.answer == str(math.lcm(A, B))
            if s in DRAWN:
                fig = m.draw(p)
                got = defaultdict(list)
                for t, _ in drawn_texts(fig):
                    g = t.get_gid() or ""
                    if g[:2] in ("a:", "b:", "c:"):
                        got[g[0]].append(int(t.get_text()))
                plt.close(fig)
                assert sorted(got["a"]) == p["a_only"] and sorted(got["b"]) == p["b_only"] and sorted(got["c"]) == p["common"]
    assert min(subs.values()) > 40 and len(subs) == 10, subs


# --- surd_shapes -----------------------------------------------------------------------------------------------

def ss_square(text: str) -> Fraction:
    """The square of a printed exact length: 2√5 -> 20, 29√7/7 -> 841/7, 16 -> 256."""
    got = re.fullmatch(r"(\d*)√(\d+)(?:/(\d+))?", text)
    if not got:
        return Fraction(text) ** 2
    k = int(got.group(1) or 1)
    m = int(got.group(2))
    d = int(got.group(3) or 1)
    return Fraction(k * k * m, d * d)


def ss_simplest(text: str) -> bool:
    got = re.fullmatch(r"(\d*)√(\d+)(?:/(\d+))?", text)
    if not got:
        return True
    m = int(got.group(2))
    return all(m % (q * q) for q in range(2, m + 1)) and m > 1


def test_surd_shapes_common():
    common("surd_shapes",
           want={"Indices and Surds", "Chapter 3: Simplifying expressions involving indices", "Unit 4: Set of real numbers",
                 "UNIT 1: ARITHMETICS"},
           never={"Glossary and Index", "Unit 2: Fractions, percentages and standard form", "Number and numeration",
                  "Unit 13: Points, straight lines and circles in 2D"})


def test_surd_shapes():
    m = fam("surd_shapes")
    subs = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        sub = p["sub"]
        subs[(p["band"], sub)] += 1
        for q in qs:
            key = q.options[int(q.answer)] if q.kind == "mcq" else q.answer
            if "simplest surd form" in q.stem:
                assert ss_simplest(key), (s, key)
            if sub == "triangle":
                if "longest side" in q.stem:
                    want = Fraction(p["a"] ** 2 + p["b"] ** 2)
                    if q.kind == "mcq":
                        one_correct(q, lambda o: ss_square(o) == want)
                    else:
                        assert ss_square(key) == want and f"{key} cm" in q.accepted
                else:
                    assert Fraction(key) == Fraction(p["a"] * p["b"], 2)
            elif sub == "square":
                if "side length" in q.stem:
                    assert ss_square(key) == p["area"]
                else:
                    assert ss_square(key) == 16 * p["area"]
            elif sub == "rectangle":
                if p["form"] == "roots":
                    a, b = p["sides"]
                    assert Fraction(key) ** 2 == a * b
                elif p["form"] == "like":
                    (c1, c2), mm = p["coef"], p["m"]
                    if "area" in q.stem:
                        assert Fraction(key) == c1 * c2 * mm
                    else:
                        assert ss_square(key) == (2 * (c1 + c2)) ** 2 * mm
                else:
                    c, mm = p["c"], p["m"]
                    assert c * c > mm
                    assert Fraction(key) == (c * c - mm if "area" in q.stem else 4 * c)  # (c + √m)(c − √m) = c² − m
            else:
                A, mm = p["area"], p["m"]
                assert ss_square(key) == Fraction(A * A, mm) and "/" not in key.split("√")[-1].split("/")[0]
                if "/" in key:
                    assert int(key.split("/")[1]) != 1
        if s in DRAWN:
            text = words(m, p)
            if sub == "square":
                assert f"Area = {p['area']} cm²" in text
            elif sub == "divide":
                assert f"Area = {p['area']} cm²" in text and f"√{p['m']} cm" in text
            elif sub == "triangle":
                assert "1 square = 1 cm" in text
                fig = m.draw(p)
                tri = patches(fig, "behind-tri")[0].get_xy()[:3]
                plt.close(fig)
                xs, ys = sorted({x for x, _ in tri}), sorted({y for _, y in tri})
                assert xs[1] - xs[0] == p["a"] and ys[1] - ys[0] == p["b"], (s, tri)
    assert len(subs) == 7 and min(subs.values()) > 60, subs


# --- ratio_bar -------------------------------------------------------------------------------------------------

RB_UNITS = {"g": "grams", "ml": "millilitres"}


def test_ratio_bar_common():
    common("ratio_bar",
           want={"Chapter 12: Simplifying ratios", "Unit 2: Fractions, percentages and standard form", "UNIT 1: ARITHMETICS",
                 "Unit 4: Understanding measurement"},
           never={"Thales' Theorem", "Trigonometry introduction", "Project 4 Mule and spares", "Unit 5: Managing money",
                  "Chapter 15: Converting between miles and kilometres"})


def test_ratio_bar():
    m = fam("ratio_bar")
    subs = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        sub = p["sub"]
        subs[(p["band"], sub)] += 1
        text = words(m, p) if s in DRAWN else None
        if sub == "share":
            (a, b), total = p["parts"], p["total"]
            assert a != b and total % (a + b) == 0 and p["other"] != p["name"]
            unit = Fraction(total, a + b)
            got = re.search(r"How much does (\w+) get\?$", qs[0].stem)
            assert int(qs[0].answer) == unit * (a if got.group(1) == p["name"] else b)
            if "one box" in qs[1].stem:
                assert int(qs[1].answer) == unit
            else:
                assert int(qs[1].answer) == unit * abs(a - b)
            if text:
                assert f"{total:,}".replace(",", " ") + " Frw" in text
                fig = m.draw(p)
                assert len(patches(fig, "box:0:")) == a and len(patches(fig, "box:1:")) == b
                plt.close(fig)
        elif sub == "simplify":
            (x, y, u), (a, b) = p["mix"], p["amounts"]
            g = math.gcd(a, b)
            assert g > 1
            for q in qs:
                first = q.stem.split("ratio of ")[1].split(" to ")[0]
                want = f"{a // g} : {b // g}" if first == x else f"{b // g} : {a // g}"
                assert q.answer == want and want.replace(" ", "") in q.accepted
            if text:
                assert f"{a} {u}" in text and f"{b} {u}" in text
        elif sub == "proportion":
            k, new, serves = p["ask"], p["new"], p["serves"]
            v = Fraction(p["amounts"][k] * new, serves)
            assert v.denominator == 1 and qs[0].answer == str(v) and f"for {new} people" in qs[0].stem
            if text:
                assert f"serves {serves}" in text
        elif sub == "percent":
            pct, new = p["pct"], p["new"]
            factor = Fraction(100 + (pct if p["kind"] == "increase" else -pct), 100)
            orig = Fraction(new) / factor
            assert orig.denominator == 1
            assert int(qs[0].answer) == orig and int(qs[1].answer) == abs(new - orig)
            if text:
                assert f"{new:,}".replace(",", " ") + " Frw" in text and f"{pct}%" in text
                fig = m.draw(p)
                shaded = len(patches(fig, "part:")) and len([pa for pa in patches(fig, "part:") if pa.get_gid().endswith(":new")])
                plt.close(fig)
                assert Fraction(shaded, 10) == factor  # each part is 10% of the original
        else:
            k, rate, amount = p["ask"], Fraction(str(p["rates"][p["ask"]])), p["amount"]
            code = p["currencies"][k].split("(")[1].rstrip(")")
            assert code in qs[0].stem
            if p["way"] == "to_frw":
                assert Fraction(qs[0].answer) == amount * rate
            else:
                assert qs[0].answer == str(amount) and f"{int(amount * rate):,}".replace(",", " ") + " Frw" in qs[0].stem
            if text:
                assert re.search(r"= " + re.escape(f"{p['rates'][k]:,}".replace(",", " ")) + " Frw", text), text
    assert len(subs) == 7 and min(subs.values()) > 80, subs


# --- decimal_chart ---------------------------------------------------------------------------------------------

def dc_read_row(fig, row, cols):
    """The number written in one row of a drawn place-value chart, read digit by digit from its columns."""
    from decimal import Decimal
    ones = cols.index("O")
    v = Decimal(0)
    for t, _ in drawn_texts(fig):
        g = t.get_gid() or ""
        if g.startswith(f"digit:{row}:"):
            j = int(g.split(":")[2])
            v += int(t.get_text()) * Decimal(10) ** (ones - j)
    return v.normalize()


def test_decimal_chart_common():
    common("decimal_chart",
           want={"4 Decimals", "Chapter 3: Multiplying and dividing by powers of", "Unit 2: Fractions, percentages and standard form",
                 "Unit 4: Understanding measurement", "Number and numeration"},
           never={"Number Bases", "Number bases", "Glossary and Index", "Project 4 Mule and spares", "Unit 2: Sets of numbers",
                  "Chapter 7: Fractions and recurring decimals", "10 Percentages"})


def test_decimal_chart():
    from decimal import Decimal
    m = fam("decimal_chart")
    subs = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        sub = p["sub"]
        subs[(p["band"], sub)] += 1
        drawn = s in DRAWN
        if sub == "shift":
            place = [Decimal(10) ** (3 - i) for i in range(7)]
            before = sum(d * place[p["start"] + i] for i, d in enumerate(p["digits"]))
            f = Decimal(10) ** p["k"]
            after = (before * f if p["op"] == "×" else before / f).normalize()
            q = qs[0]
            if p["ask"] == "op":
                one_correct(q, lambda o: o == f"{p['op']} {10 ** p['k']}")
            else:
                assert Decimal(q.answer) == after
            if drawn:
                fig = m.draw(p)
                cols = ["Th", "H", "T", "O", "t", "h", "th"]
                assert dc_read_row(fig, 0, cols) == before.normalize()
                if p["ask"] == "op":
                    assert dc_read_row(fig, 1, cols) == after
                plt.close(fig)
        elif sub == "line":
            lo, step = Decimal(p["lo"]), Decimal(p["step"])
            val = {L: lo + step * i for i, L in zip(p["marks"], p["letters"])}
            for q in qs:
                if q.kind == "short":
                    L = re.search(r"at ([PQR])\?$", q.stem).group(1)
                    assert Decimal(q.answer) == val[L]
                elif "greatest" in q.stem:
                    one_correct(q, lambda o: val[o] == max(val.values()))
                else:
                    x = Decimal(re.search(r"shows ([\d.]+)\?$", q.stem).group(1))
                    one_correct(q, lambda o: val[o] == x)
            if drawn:
                text = words(m, p)
                assert f"{lo.normalize():f}" in text and f"{(lo + 10 * step).normalize():f}" in text
        elif sub == "standard":
            sig, e = p["sig"], p["e"]
            value = (Decimal("".join(map(str, sig))) * Decimal(10) ** (e - len(sig) + 1)).normalize()
            sup = str.maketrans("⁰¹²³⁴⁵⁶⁷⁸⁹⁻", "0123456789-")
            for q in qs:
                if q.kind == "mcq":
                    def is_value(o):
                        mant, power = o.split(" × 10")
                        return (Decimal(mant) * Decimal(10) ** int(power.translate(sup))).normalize() == value
                    one_correct(q, is_value)
                    assert 1 <= Decimal(picked(q).split(" × ")[0]) < 10
                else:
                    assert q.answer == str(e)
            if drawn:
                fig = m.draw(p)
                assert dc_read_row(fig, 0, ["M", "HTh", "TTh", "Th", "H", "T", "O", "t", "h", "th", "tth", "hth", "m"]) == value
                plt.close(fig)
        else:
            v, a = Decimal(p["value"]), Decimal(p["acc"])
            lo, hi = v - a / 2, v + a / 2
            assert (v / a) == (v / a).to_integral()  # the reading is given to its accuracy
            for q in qs:
                if "lower bound" in q.stem:
                    assert Decimal(q.answer) == lo
                elif "upper bound" in q.stem:
                    assert Decimal(q.answer) == hi
                else:
                    want = f"{lo.normalize():f} ≤ {p['letter']} < {hi.normalize():f}"
                    one_correct(q, lambda o: o == want)
            if drawn:
                text = words(m, p)
                assert f"{p['value']} {p['unit']}" in text and "correct to" in text
    assert len(subs) == 6 and min(subs.values()) > 80, subs


# --- circular_measure ------------------------------------------------------------------------------------------

def cm_pi(text: str) -> Fraction:
    """The coefficient of π in 2π/3, π, −π/6, 845π/12."""
    got = re.fullmatch(r"(−?)(\d*)π(?:/(\d+))?", text)
    assert got, text
    return (-1 if got.group(1) else 1) * Fraction(int(got.group(2) or 1), int(got.group(3) or 1))


def cm_exact(text: str) -> float:
    """−√3/2 and friends as a number."""
    sign = -1 if text.startswith("−") else 1
    t = text.lstrip("−")
    num, _, den = t.partition("/")
    v = math.sqrt(int(num[1:])) if num.startswith("√") else float(num)
    return sign * v / (float(den) if den else 1)


def test_circular_measure_common():
    common("circular_measure",
           want={"Chapter 8: Circular measure", "Chapter 4: Convert between degrees and", "Chapter 5: Trigonometry"},
           never={"Polar coordinates", "Circular motion", "Unit 13: Points, straight lines and circles in 2D", "Conics",
                  "Unit 4: Scale drawings, bearings and trigonometry", "Unit 5: Symmetry"})


def test_circular_measure():
    m = fam("circular_measure")
    subs = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        sub = p["sub"]
        subs[(p["band"], sub)] += 1
        q = qs[0]
        if sub in ("sector", "arc"):
            r = Fraction(p["r"])
            in_pi = "pi" in p
            t = Fraction(*p["pi"]) if in_pi else Fraction(str(p["theta"]))
            assert 0 < t < (1 if in_pi else Fraction(13, 5))
            if sub == "arc":
                assert Fraction(q.answer) == t
                if s in DRAWN:
                    assert f"arc AB = {format(float(r * t), 'g')} cm" in words(m, p)
                continue
            if "arc AB" in q.stem:
                want = r * t
            elif "area" in q.stem:
                want = r * r * t / 2
            else:
                want = None
                if in_pi:
                    a, b = q.answer.split(" + ")
                    assert Fraction(a) == 2 * r and cm_pi(b) == r * t
                else:
                    assert Fraction(q.answer) == 2 * r + r * t
            if want is not None:
                assert (cm_pi(q.answer) if in_pi else Fraction(q.answer)) == want, (s, q.answer, want)
                assert ("in terms of π" in q.stem) == in_pi
            if s in DRAWN:
                text = words(m, p)
                assert f"{p['r']} cm" in text and (q.stem and (in_pi or f"{p['theta']} rad" in text))
        elif sub == "segment":
            r = p["r"]
            got = re.fullmatch(r"(\d*)π − (\d+)", q.answer)
            assert got and Fraction(int(got.group(1) or 1)) == Fraction(r * r, 4) and int(got.group(2)) == r * r // 2
        elif sub == "convert":
            if p["shown"] == "deg":
                assert cm_pi(q.answer) == Fraction(p["deg"], 180)
            else:
                assert q.answer == str(p["deg"])
            if s in DRAWN:
                text = words(m, p)
                assert (f"{p['deg']}°" in text) == (p["shown"] == "deg")
        else:
            t = Fraction(*p["t"])
            a = float(t) * math.pi
            v = {"cos": math.cos(a), "sin": math.sin(a), "tan": math.tan(a)}[p["fn"]]
            one_correct(q, lambda o: abs(cm_exact(o) - v) < 1e-9)
            if s in DRAWN:
                assert "θ = " in words(m, p)
    assert len(subs) == 6 and min(subs.values()) > 60, subs


# --- solid_mensuration -----------------------------------------------------------------------------------------

def sm_pi(text: str) -> Fraction:
    got = re.fullmatch(r"(\d+)π(?:/(\d+))?", text)
    assert got, text
    return Fraction(int(got.group(1)), int(got.group(2) or 1))


def test_solid_mensuration_common():
    common("solid_mensuration", want={"Unit 2: Perimeter, area and volume", "Mensuration"},
           never={"Unit 1: Lines, angles and shapes", "Unit 4: Scale drawings, bearings and trigonometry",
                  "Chapter 8: Circular measure", "Unit 3: Pythagoras' theorem and similar shapes"})


def test_solid_mensuration():
    m = fam("solid_mensuration")
    subs = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        sub = p["sub"]
        subs[sub] += 1
        q = qs[0]
        if sub == "prism":
            a, b, c = p["tri"]
            L = p["length"]
            assert a * a + b * b == c * c
            want = Fraction(a * b, 2) * L if "volume" in q.stem else a * b + L * (a + b + c)  # two ends and three faces
            assert Fraction(q.answer) == want
        elif sub == "cylinder":
            r, h = p["r"], p["h"]
            want = r * r * h if "volume" in q.stem else 2 * r * h if "curved" in q.stem else 2 * r * r + 2 * r * h
            assert sm_pi(q.answer) == want
        elif sub == "cone":
            r, h, l = p["r"], p["h"], p["l"]
            assert r * r + h * h == l * l
            want = Fraction(r * r * h, 3) if "volume" in q.stem else r * l
            assert sm_pi(q.answer) == want
        elif sub == "sphere":
            r = p["r"]
            want = Fraction(4 * r ** 3, 3) if "volume" in q.stem else 4 * r * r
            assert sm_pi(q.answer) == want
        else:
            L, W = p["length"], p["width"]
            r = Fraction(W, 2)
            a, b = q.answer.split(" + ")
            if "area" in q.stem:
                assert Fraction(a) == L * W and sm_pi(b) == r * r / 2
            else:
                assert Fraction(a) == 2 * L + W and sm_pi(b) == r  # two lengths, one width, half a circle of diameter W
        assert q.answer in q.accepted
        if s in DRAWN:
            text = words(m, p)
            for k in ("r", "h", "l", "length", "width"):
                if k in p:
                    assert f"{p[k]} cm" in text, (s, k, text)
            if sub == "prism":
                assert all(f"{x} cm" in text for x in p["tri"])
            if sub in ("cone", "sphere"):
                assert "π" in text
            fig = m.draw(p)
            no_line_through_text(fig, ("solid_mensuration", s))
            plt.close(fig)
    assert len(subs) == 5 and min(subs.values()) > 150, subs


# --- thales ----------------------------------------------------------------------------------------------------

def test_thales_common():
    common("thales", want={"Thales' Theorem"},
           never={"Geometry: angles and triangles", "Trigonometry introduction", "Chapter 14: Bearings",
                  "Unit 5: Ratio and proportion", "Right-Angled Triangles"})


def test_thales():
    m = fam("thales")
    subs = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        sub = p["sub"]
        subs[sub] += 1
        q = qs[0]
        if sub == "triangle":
            if p["ask"] == "EC":  # AD/DB = AE/EC
                want = Fraction(p["ae"]) * p["db"] / p["ad"]
                assert "EC" in q.stem
            else:  # AD/AB = DE/BC
                want = Fraction(p["de"]) * p["ab"] / p["ad"]
                assert "BC" in q.stem and p["ab"] > p["ad"]
        elif sub == "midpoint":
            want = Fraction(p["bc"], 2) if p["ask"] == "DE" else Fraction(p["bc"])
        elif sub == "trapezium":  # AE/ED = BF/FC
            want = Fraction(p["bf"]) * p["ed"] / p["ae"]
        else:
            yes = p["ad"] * p["ec"] == p["ae"] * p["db"]
            assert q.answer == ("yes" if yes else "no")
            if not yes:
                assert abs(Fraction(p["ad"], p["db"]) - Fraction(p["ae"], p["ec"])) >= Fraction(1, 5)
            want = None
        if want is not None:
            assert Fraction(q.answer) == want and (want * 10).denominator == 1
        if s in DRAWN:
            text = words(m, p)
            for k, lab in (("ad", None), ("db", None), ("ae", None), ("ec", None), ("bf", None), ("ed", None), ("de", None)):
                if k in p and not (sub == "triangle" and k == "db" and p["ask"] == "BC"):
                    assert f"{p[k]} cm" in text, (s, k, text)
            if sub == "triangle" and p["ask"] == "BC":
                assert f"AB = {p['ab']} cm" in text
            fig = m.draw(p)
            no_line_through_text(fig, ("thales", s))
            plt.close(fig)
    assert len(subs) == 4 and min(subs.values()) > 120, subs


# --- symmetry_p ------------------------------------------------------------------------------------------------

def sy_reflect(pt, a, b):
    (x, y), (x1, y1), (x2, y2) = pt, a, b
    dx, dy = x2 - x1, y2 - y1
    t = ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy)
    fx, fy = x1 + t * dx, y1 + t * dy
    return 2 * fx - x, 2 * fy - y


def sy_same(pts, qts, tol=1e-6) -> bool:
    return all(any(abs(x - u) < tol and abs(y - v) < tol for u, v in qts) for x, y in pts)


def sy_axes(pts) -> int:
    """Lines of symmetry of a polygon, found by trying every line through its centre (each half degree)."""
    cx = sum(x for x, _ in pts) / len(pts)
    cy = sum(y for _, y in pts) / len(pts)
    found = 0
    for k in range(360):
        a = math.radians(k / 2)
        b = (cx + math.cos(a), cy + math.sin(a))
        if sy_same([sy_reflect(q, (cx, cy), b) for q in pts], pts, 1e-4):
            found += 1
    return found


def test_symmetry_p_common():
    common("symmetry_p", primary=True, distinct=300,
           want={"17 Pattern and symmetry", "Regular Polygons and Bearings"},
           never={"7 Fractions of shapes", "15 Angles and movement", "Fractions (2)", "Square, Rectangle and Triangle",
                  "Constructing Angles and Describing Angles Formed by Intersecting Lines", "Time"})


def test_symmetry_p():
    m = fam("symmetry_p")
    subs = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        sub = p["sub"]
        subs[sub] += 1
        q = qs[0]
        short_sentences(q)
        if s > 200 and s not in DRAWN:
            continue
        fig = m.draw(p)
        if sub == "line":
            good = []
            for i, L in enumerate("PQRS"[:len(p["lines"])]):
                shape = [pa for pa in patches(fig, f"behind-shape:{i}")][0].get_xy()[:-1]
                line = [ln for ln in patches(fig, f"behind-line:{i}")][0].get_xydata()
                if sy_same([sy_reflect(pt, line[0], line[1]) for pt in shape], shape, 1e-6):
                    good.append(L)
            assert len(good) == 1, (s, good)
            one_correct(q, lambda o: o == f"Shape {good[0]}")
        elif sub == "count":
            shape = [pa for pa in patches(fig, "behind-shape")][0].get_xy()[:-1]
            assert q.answer == str(sy_axes([tuple(v) for v in shape])), (s, p["shape"])
        else:
            cols = p["cols"]
            on = {(int(g.split(":")[1]), int(g.split(":")[2])) for g in
                  (pa.get_gid() for pa in patches(fig, "behind-cell:")) if g.endswith(":on")}
            letters = {t.get_text(): (int(t.get_position()[0] - 0.5), int(t.get_position()[1] - 0.5))
                       for t, _ in drawn_texts(fig) if (t.get_gid() or "").startswith("letter:")}
            mirror = lambda c: 2 * cols - 1 - c  # noqa: E731
            good = [L for L, (c, r) in letters.items()
                    if (c, r) not in on and all((mirror(x), y) in on | {(c, r)} for x, y in on | {(c, r)})]
            assert len(good) == 1, (s, good, letters, on)
            one_correct(q, lambda o: o == good[0])
        if s in DRAWN:
            no_line_through_text(fig, ("symmetry_p", s))
        plt.close(fig)
    assert len(subs) == 3 and min(subs.values()) > 250, subs


# --- turns_p ---------------------------------------------------------------------------------------------------

TP_DIRS = ["north", "east", "south", "west"]


def tp_facing(fig, gid):
    """Which way a drawn robot arrow points, from its two ends."""
    (x0, y0), (x1, y1) = [ln for ln in patches(fig, f"behind-ends:{gid}")][0].get_xydata()
    a = math.degrees(math.atan2(y1 - y0, x1 - x0)) % 360
    return {0: "east", 90: "north", 180: "west", 270: "south"}[round(a / 90) * 90 % 360]


def test_turns_p_common():
    common("turns_p", primary=True, distinct=150, want={"15 Angles and movement"},
           never={"Time", "17 Pattern and symmetry", "7 Fractions of shapes", "Grid", "Position",
                  "Directions, location of objects and lines", "Shapes in the Plane"})


def test_turns_p():
    m = fam("turns_p")
    subs = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        sub = p["sub"]
        subs[sub] += 1
        q = qs[0]
        short_sentences(q)
        if s > 300 and s not in DRAWN:
            continue
        fig = m.draw(p)
        if sub == "face":
            start = TP_DIRS.index(tp_facing(fig, "c"))
            words_ = re.search(r"makes (a [\w-]+ turn(?: \w+)?)\.", q.stem).group(1)
            quarters = {"quarter": 1, "half": 2, "three-quarter": 3}[re.search(r"a ([\w-]+) turn", words_).group(1)]
            sign = -1 if "anticlockwise" in words_ else 1
            want = TP_DIRS[(start + sign * quarters) % 4]
            one_correct(q, lambda o: o == want)
        else:
            a, b = TP_DIRS.index(tp_facing(fig, "before")), TP_DIRS.index(tp_facing(fig, "after"))
            diff = (b - a) % 4
            if sub == "which":
                want = {1: "a quarter turn clockwise", 2: "a half turn", 3: "a quarter turn anticlockwise"}[diff]
                one_correct(q, lambda o: o == want)
            else:
                way = "clockwise" if " clockwise" in q.stem else "anticlockwise"
                n = diff if way == "clockwise" else (4 - diff) % 4
                assert q.answer == str(n) and n >= 1
                assert (p["steps"] > 0) == (way == "clockwise")
        if s in DRAWN:
            no_line_through_text(fig, ("turns_p", s))
        plt.close(fig)
    assert len(subs) == 3 and min(subs.values()) > 250, subs


# --- angle_measure_p -------------------------------------------------------------------------------------------

def am_arc(fig, gid):
    from matplotlib.patches import Arc
    arc = [pa for ax in fig.axes for pa in ax.patches if isinstance(pa, Arc) and pa.get_gid() == f"behind-arc:{gid}"][0]
    return arc.theta2 - arc.theta1


def am_dir(p0, p1) -> float:
    return math.degrees(math.atan2(p1[1] - p0[1], p1[0] - p0[0])) % 360


def test_angle_measure_p_common():
    common("angle_measure_p", primary=True, distinct=500,
           want={"Angles", "Constructing Angles and Describing Angles Formed by Intersecting Lines",
                 "Regular Polygons and Bearings"},
           never={"Length Measurements", "Shapes in the Plane", "15 Angles and movement", "17 Pattern and symmetry",
                  "Construction of Polygons and Nets for Cuboids and Prisms", "Time"})


def test_angle_measure_p():
    m = fam("angle_measure_p")
    subs = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        sub = p["sub"]
        subs[sub] += 1
        q = qs[0]
        short_sentences(q, 18)
        if s > 300 and s not in DRAWN:
            continue
        fig = m.draw(p)
        if sub == "protractor":
            arms = []
            for g in ("arm:0:in", "arm:1:in"):
                (x0, y0), (x1, y1) = [ln for ln in patches(fig, g)][0].get_xydata()
                arms.append(am_dir((x0, y0), (x1, y1)))
            size = round(abs(arms[0] - arms[1]))
            size = min(size, 360 - size)
            one_correct(q, lambda o: o == f"{size}°")
        elif sub == "triangle":
            A, B, C = [tuple(v) for v in [pa for pa in patches(fig, "behind-tri")][0].get_xy()[:3]]
            def at(v, u, w):
                a = abs(am_dir(v, u) - am_dir(v, w))
                return min(a, 360 - a)
            assert abs(at(A, B, C) - p["a"]) < 1e-6 and abs(at(B, A, C) - p["b"]) < 1e-6  # drawn to size
            assert abs(float(q.answer) - at(C, A, B)) < 1e-6
        elif sub in ("lines", "parallel"):
            assert abs(am_arc(fig, "angle:a") - p["a"]) < 1e-9
            x = am_arc(fig, "angle:x")
            assert float(q.answer) == round(x), (s, x, q.answer)
            if sub == "parallel":
                ys = sorted({round(float(ln.get_ydata()[0]), 6) for ln in patches(fig, "behind-par:")})
                assert len(ys) == 2  # two horizontal lines, the parallels
                (x0, y0), (x1, y1) = [ln for ln in patches(fig, "behind-trans")][0].get_xydata()
                assert abs(am_dir((x0, y0), (x1, y1)) - p["a"]) < 1e-6  # the transversal at the marked angle
        elif sub == "bearing":
            (ax_, ay), (bx, by) = [ln for ln in patches(fig, "behind-AB")][0].get_xydata()
            bearing = round((90 - am_dir((ax_, ay), (bx, by))) % 360)
            assert q.answer == f"{bearing:03d}°" and "clockwise from north" in q.stem
            shown = int(re.search(r"(\d+)°", words(m, p)).group(1))
            assert shown in (bearing, 180 - bearing, bearing - 180, 360 - bearing) and shown < 90
        else:
            n = len([pa for pa in patches(fig, "behind-poly")][0].get_xy()) - 1
            assert q.answer == str((n - 2) * 180 // n) and (n - 2) * 180 % n == 0
            assert f"{(n - 2) * 180}°" in words(m, p)
        if s in DRAWN:
            no_line_through_text(fig, ("angle_measure_p", s))
        plt.close(fig)
    assert len(subs) == 6 and min(subs.values()) > 80, subs


# --- solids_p --------------------------------------------------------------------------------------------------

SP_CURVED = {"cylinder": True, "cone": True, "sphere": True, "cube": False, "cuboid": False, "pyramid": False, "prism": False}
SP_NAMES = {"cube": "cube", "cuboid": "cuboid", "cylinder": "cylinder", "cone": "cone", "sphere": "sphere",
            "pyramid": "square-based pyramid", "prism": "triangular prism"}


def test_solids_p_common():
    common("solids_p", primary=True, distinct=400, want={"4 3D shapes"},
           never={"17 Pattern and symmetry", "Measures (2)", "Time", "7 Fractions of shapes", "Position"})


def test_solids_p():
    m = fam("solids_p")
    subs = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        sub = p["sub"]
        subs[sub] += 1
        q = qs[0]
        short_sentences(q)
        if sub == "which":
            assert p["shapes"].count(p["ask"]) == 1 and SP_NAMES[p["ask"]] in q.stem
            one_correct(q, lambda o: o == "PQRST"[p["shapes"].index(p["ask"])])
        elif sub == "curved":
            assert q.answer == str(sum(SP_CURVED[k] for k in p["shapes"]))
        else:
            if s > 300 and s not in DRAWN:
                continue
            fig = m.draw(p)
            edges = set()
            for ln in patches(fig, "behind-shape:"):
                if ln.get_gid().endswith(("edge", "hidden")):
                    (x0, y0), (x1, y1) = ln.get_xydata()
                    a, b = (round(x0, 6), round(y0, 6)), (round(x1, 6), round(y1, 6))
                    edges.add(tuple(sorted((a, b))))
            plt.close(fig)
            verts = {v for e in edges for v in e}
            E, V = len(edges), len(verts)
            F = 2 - V + E  # Euler, from what is drawn
            want = {"faces": F, "edges": E, "vertices": V}[re.search(r"How many (\w+)", q.stem).group(1)]
            assert q.answer == str(want), (s, p["shape"], E, V)
        if s in DRAWN:
            fig = m.draw(p)
            no_line_through_text(fig, ("solids_p", s))
            plt.close(fig)
    assert len(subs) == 3 and min(subs.values()) > 250, subs


# ==============================================================================================================
# A Level mechanics (projectile_m, collision_m, elastic_string_m, circular_motion_m, rigid_body_m)
#
# P6 maths, A Level mechanics (part file; merged into test_p6_maths_answers.py): projectiles, collisions, elastic
# strings, circular motion and rigid bodies, every key worked out again here from the values the figure prints.
#
# A projectile's components come from the printed speed and tan α (or the printed components), its flight from the
# quadratic for its height; a collision from the conservation of momentum and Newton's experimental law; an elastic
# string from Hooke's law T = λx/l and EPE = λx²/2l; circular motion from F = mv²/r and the conservation of energy; a
# lamina's centre of mass from its pieces' areas and centres, a beam's reactions from moments about each support.
# ==============================================================================================================


MECH = ["projectile_m", "collision_m", "elastic_string_m", "circular_motion_m", "rigid_body_m"]
G = 10


def val(s: str) -> Fraction:
    """A key as a number: 12, 2.5, -3, 7/40."""
    s = s.strip()
    if "/" in s:
        a, b = s.split("/")
        return Fraction(int(a), int(b))
    return Fraction(s)


def mech_segments(art):
    if isinstance(art, Line2D):
        pts = art.get_transform().transform(art.get_xydata())
        return list(zip(pts, pts[1:]))
    out = []
    for poly in art.get_path().to_polygons(art.get_transform(), closed_only=False):
        out += list(zip(poly, poly[1:]))
    return out


def mech_passes(a, b, box, margin=1.5, steps=60) -> bool:
    return any(box.x0 + margin < a[0] + (b[0] - a[0]) * k / steps < box.x1 - margin and
               box.y0 + margin < a[1] + (b[1] - a[1]) * k / steps < box.y1 - margin for k in range(steps + 1))


def labels_clear(fig, tag):
    """No line, arrow or outline runs through a label (fills marked 'behind' and the axes' own spines aside)."""
    texts = drawn_texts(fig)
    for ax in fig.axes:
        for art in list(ax.lines) + list(ax.patches):
            gid = art.get_gid() or ""
            if gid.startswith("behind") or not art.get_visible():
                continue
            if isinstance(art, Line2D) and art.get_alpha() == 0 and not gid.endswith(":ends"):
                continue
            for a, b in mech_segments(art):
                for t, box in texts:
                    assert not mech_passes(a, b, box), (tag, gid or type(art).__name__, t.get_text())


def has_forms(q, *forms):
    for f in forms:
        assert f in q.accepted, (q.stem, f, q.accepted[:12])


# --- projectile_m ----------------------------------------------------------------------------------------

def test_projectile_m_common():
    common("projectile_m", want={"Projectiles"},
           never={"Momentum", "Hooke's law", "Circular motion", "Equilibrium of a rigid body",
                  "Linear motion under a variable force", "Chapter 1: Complete the square and solve"})


def _components(p):
    """The initial velocity from what the figure prints: a speed and tan α, the two components, or a horizontal speed."""
    if p["form"] == "angle":
        speed, b, a = p["shown"]
        c = math.isqrt(a * a + b * b)
        assert c * c == a * a + b * b and math.gcd(a, b) == 1
        assert speed % c == 0
        return speed // c * a, speed // c * b
    if p["form"] == "components":
        return p["shown"][0], p["shown"][1]
    return p["shown"][0], 0


def test_projectile_m():
    m = fam("projectile_m")
    Counter_ = {}
    for s in SEEDS:
        p, qs = run(m, s)
        Counter_[p["sub"]] = Counter_.get(p["sub"], 0) + 1
        ux, uy = _components(p)
        assert (ux, uy) == (p["ux"], p["uy"]), (s, p)
        assert len(qs) == 3
        if p["sub"] == "cliff":
            h = p["h"]
            # 5t^2 - uy t - h = 0, the positive root
            T = Fraction(uy + math.isqrt(uy * uy + 20 * h), 10)
            assert 5 * T * T - uy * T == h, (s, p)
        else:
            T = Fraction(2 * uy, G)
        for q in qs:
            st = q.stem
            if "travel from O to A" in st or "travel from O to B" in st:
                assert val(q.answer) == T, (s, st, q.answer)
                has_forms(q, f"{q.answer} s")
            elif "greatest height" in st:
                H = Fraction(uy * uy, 2 * G) + (p["h"] if p["sub"] == "cliff" else 0)
                if q.kind == "mcq":
                    one_correct(q, lambda o: val(o.replace(" m", "")) == H)
                    # the distractors: forgetting the 2, using the speed, using the horizontal component
                    for o in wrong(q):
                        assert val(o.replace(" m", "")) in {Fraction(uy * uy, G), Fraction(ux * ux + uy * uy, 2 * G),
                                                            Fraction(ux * ux, 2 * G), Fraction(uy, 2)}
                else:
                    assert val(q.answer) == H, (s, st)
                    has_forms(q, f"{q.answer} m")
            elif "distance OA" in st:
                assert p["sub"] == "ground" and val(q.answer) == ux * T
            elif "distance FB" in st:
                assert p["sub"] == "cliff" and val(q.answer) == ux * T
            elif "y = ax − bx²" in st:
                b = Fraction(G, 2 * ux * ux)
                assert val(q.answer) == b, (s, q.answer, b)
                assert str(b) in q.accepted, (s, q.accepted)
            elif "vertical component" in st:
                assert p["sub"] == "cliff" and val(q.answer) == G * T - uy > 0
            elif "height of P" in st:
                t = Fraction(p["d"]) / ux
                assert 0 < t < T and val(q.answer) == uy * t - 5 * t * t > 0
            elif "to the point P" in st:
                assert val(q.answer) == Fraction(p["d"]) / ux
            elif "rising or falling" in st:
                t = Fraction(p["d"]) / ux
                state = "rising" if t < Fraction(uy, G) else "falling" if t > Fraction(uy, G) else "at its highest point"
                one_correct(q, lambda o: o == state)
            else:
                pytest.fail(f"seed {s}: an unexpected question {st}")
            if q.kind == "short":
                v = val(q.answer)
                assert (v * 10000).denominator == 1 or "/" in q.answer, (s, q.answer)
        if s in DRAWN:
            text = words(m, p)
            assert "g = 10 m s⁻²" in text
            if p["form"] == "angle":
                assert f"{p['shown'][0]} m s⁻¹" in text and f"tan α = {p['shown'][1]}/{p['shown'][2]}" in text, (s, text)
            elif p["form"] == "components":
                assert f"{ux} m s⁻¹ horizontally" in text and f"{uy} m s⁻¹ vertically upwards" in text
            else:
                assert f"{ux} m s⁻¹" in text and "projected horizontally" in text
            if p["sub"] == "cliff":
                assert f"{p['h']} m" in text and {"O", "F", "B"} <= set(text.split(" | "))
            elif p["sub"] == "post":
                assert f"{p['d']} m" in text and {"O", "A", "P"} <= set(text.split(" | "))
            else:
                assert {"O", "A"} <= set(text.split(" | "))
            fig = m.draw(p)
            path = next(ln for ln in fig.axes[0].lines if ln.get_gid() == "path")
            (x0, y0), (x1, y1) = path.get_xydata()[0], path.get_xydata()[-1]
            assert abs(x0) < 1e-9 and abs(y0 - p.get("h", 0)) < 1e-9
            assert abs(x1 - float(ux * T)) < 1e-6 and abs(y1) < 1e-6, (s, x1, y1)
            ys = path.get_ydata()
            assert abs(max(ys) - float(p.get("h", 0) + Fraction(uy * uy, 20))) < 0.02 * float(ux * T)
            labels_clear(fig, ("projectile_m", s))
            plt.close(fig)
    assert min(Counter_.values()) > 250, Counter_


# --- collision_m -----------------------------------------------------------------------------------------

def test_collision_m_common():
    common("collision_m", want={"Momentum"},
           never={"Projectiles", "Hooke's law", "Circular motion", "Equilibrium of a rigid body",
                  "Linear motion under a variable force"})


def _arrow_way(fig, gid):
    """+1 for an arrow drawn to the right, -1 to the left, None for no arrow."""
    for ln in fig.axes[0].lines:
        if ln.get_gid() == gid + ":arrow:ends":
            (x0, _), (x1, _) = ln.get_xydata()
            return 1 if x1 > x0 else -1
    return None


def test_collision_m():
    m = fam("collision_m")
    subs = {}
    for s in SEEDS:
        p, qs = run(m, s)
        subs[p["sub"]] = subs.get(p["sub"], 0) + 1
        assert len(qs) == 3
        if p["sub"] == "wall":
            b, a = p["tan"]
            c = math.isqrt(a * a + b * b)
            assert c * c == a * a + b * b and p["speed"] % c == 0 and p["speed"] <= 30
            U, e, mass = p["speed"], val(p["e"]), val(p["m"])
            along, towards = Fraction(U * a, c), Fraction(U * b, c)
            assert 0 < e < 1
            for q in qs:
                st = q.stem
                if "tan β" in st:
                    assert val(q.answer) == e * towards / along, (s, q.answer)
                elif "impulse" in st:
                    assert val(q.answer) == mass * towards * (1 + e)
                    assert f"{q.answer} N s" in q.accepted
                elif "loses" in st:
                    assert val(q.answer) == Fraction(1, 2) * mass * (towards ** 2 - (e * towards) ** 2) > 0
                elif "speed" in st:
                    assert val(q.answer) ** 2 == along ** 2 + (e * towards) ** 2
                else:
                    pytest.fail(f"seed {s}: an unexpected question {st}")
            if s in DRAWN:
                text = words(m, p)
                assert f"{U} m s⁻¹" in text and f"tan θ = {b}/{a}" in text and f"e = {p['e']}" in text
                assert f"mass {p['m']} kg" in text and {"I", "θ", "β"} <= set(text.split(" | "))
                fig = m.draw(p)
                labels_clear(fig, ("collision_m", s))
                plt.close(fig)
            continue
        m1, m2 = (val(x) for x in p["m"])
        u1, u2 = (val(x) for x in p["u"])
        v1, v2 = (val(x) for x in p["v"])
        assert u1 > u2 and u1 > 0  # A catches B up
        assert m1 * u1 + m2 * u2 == m1 * v1 + m2 * v2, (s, "momentum is conserved")
        assert v2 >= v1 and (v2 - v1) <= (u1 - u2), (s, "0 <= e <= 1")
        loss = Fraction(1, 2) * (m1 * u1 ** 2 + m2 * u2 ** 2 - m1 * v1 ** 2 - m2 * v2 ** 2)
        assert loss >= 0
        if p["sub"] == "momentum":
            X = p["unknown"]
            # the unknown from the momentum of the three velocities the figure prints
            if X == "A":
                vx = (m1 * u1 + m2 * u2 - m2 * v2) / m1
            else:
                vx = (m1 * u1 + m2 * u2 - m1 * v1) / m2
            assert vx != 0
        else:
            e = val(p["e"])
            # Cramer's rule on m1 x + m2 y = P, -x + y = e (u1 - u2)
            P, S = m1 * u1 + m2 * u2, e * (u1 - u2)
            det = m1 * 1 - m2 * (-1)
            x, y = (P * 1 - m2 * S) / det, (m1 * S - (-1) * P) / det
            assert (x, y) == (v1, v2) and y > 0
        for q in qs:
            st = q.stem
            if "moves with speed v m s⁻¹ as shown" in st:
                assert val(q.answer) == abs(vx)
            elif "impulse that sphere" in st:
                who = re.search(r"sphere ([AB]) receives", st).group(1)
                assert who != p["unknown"]
                mm, uu, vv = (m1, u1, v1) if who == "A" else (m2, u2, v2)
                assert val(q.answer) == mm * abs(vv - uu) > 0
            elif "kinetic energy" in st:
                assert val(q.answer) == loss > 0
            elif "coefficient of restitution" in st:
                assert val(q.answer) == (v2 - v1) / (u1 - u2)
            elif "Find v_B" in st:
                assert val(q.answer) == v2
            elif "speed, in m s⁻¹, of sphere A" in st:
                assert val(q.answer) == abs(v1)
            elif "which of these is true of sphere A" in st:
                truth = "A moves to the right" if v1 > 0 else "A moves to the left" if v1 < 0 else "A is at rest"
                one_correct(q, lambda o: o == truth)
            else:
                pytest.fail(f"seed {s}: an unexpected question {st}")
        if s in DRAWN:
            text = words(m, p)
            assert f"{p['m'][0]} kg" in text and f"{p['m'][1]} kg" in text
            fig = m.draw(p)
            for letter, u in (("A", u1), ("B", u2)):
                if u == 0:
                    assert _arrow_way(fig, f"vel:Before:{letter}") is None and "at rest" in text
                else:
                    assert f"{fmt_m(abs(u))} m s⁻¹" in text
                    assert _arrow_way(fig, f"vel:Before:{letter}") == (1 if u > 0 else -1), (s, letter)
            if p["sub"] == "momentum":
                for letter, v in (("A", v1), ("B", v2)):
                    way = _arrow_way(fig, f"vel:After:{letter}")
                    if letter == p["unknown"]:
                        assert way == (1 if v > 0 else -1)
                    elif v == 0:
                        assert way is None
                    else:
                        assert way == (1 if v > 0 else -1)
                assert "v m s⁻¹" in text
            else:
                assert f"coefficient of restitution e = {p['e']}" in text
                assert _arrow_way(fig, "vel:After:A") == 1 and _arrow_way(fig, "vel:After:B") == 1
            labels_clear(fig, ("collision_m", s))
            plt.close(fig)
    assert min(subs.values()) > 250, subs


def fmt_m(x: Fraction) -> str:
    return str(int(x)) if x.denominator == 1 else str(float(x))


# --- elastic_string_m ------------------------------------------------------------------------------------

def test_elastic_string_m_common():
    common("elastic_string_m", want={"Hooke's law"},
           never={"Projectiles", "Momentum", "Circular motion", "Equilibrium of a rigid body",
                  "Linear motion under a variable force", "Chapter 9: Integration", "Chapter 6: you will"})


def test_elastic_string_m():
    m = fam("elastic_string_m")
    subs = {}
    for s in SEEDS:
        p, qs = run(m, s)
        sub = p["sub"]
        subs[sub] = subs.get(sub, 0) + 1
        assert len(qs) == 3
        if sub == "table":
            (l1, l2), (lam1, lam2) = [val(v) for v in p["l"]], [val(v) for v in p["lam"]]
            D = val(p["D"])
            assert D > l1 + l2, (s, "both strings stretched")
            # equal tensions: lam1 e1 / l1 = lam2 (D - l1 - l2 - e1) / l2
            e1 = (lam2 / l2) * (D - l1 - l2) / (lam1 / l1 + lam2 / l2)
            e2 = D - l1 - l2 - e1
            assert lam1 * e1 / l1 == lam2 * e2 / l2
            for v in (lam1, lam2):
                assert (v * 10).denominator == 1
        else:
            mass, l, lam = val(p["m"]), val(p["l"]), val(p["lam"])
            assert (lam * 10).denominator == 1
        for q in qs:
            st = q.stem
            if sub == "hang":
                x = mass * G * l / lam
                assert 0 < x <= l
                if "extension" in st:
                    assert val(q.answer) == x
                elif "length AP" in st:
                    assert val(q.answer) == l + x
                elif "elastic potential energy" in st:
                    key = lam * x * x / (2 * l)
                    if q.kind == "mcq":
                        one_correct(q, lambda o: val(o.replace(" J", "")) == key)
                    else:
                        assert val(q.answer) == key
                elif "pulled down a further" in st:
                    d = val(re.search(r"further ([\d.]+) m", st).group(1))
                    assert d == val(p["d"]) and 0 < d <= x
                    # just after release: T - mg = ma with T = λ(x + d)/l
                    assert val(q.answer) == (lam * (x + d) / l - mass * G) / mass
                else:
                    pytest.fail(f"seed {s}: an unexpected question {st}")
            elif sub == "table":
                if "distance AP" in st:
                    assert val(q.answer) == l1 + e1
                elif "tension" in st:
                    assert val(q.answer) == lam1 * e1 / l1
                elif "total elastic potential energy" in st:
                    assert val(q.answer) == lam1 * e1 ** 2 / (2 * l1) + lam2 * e2 ** 2 / (2 * l2)
                else:
                    pytest.fail(f"seed {s}: an unexpected question {st}")
            elif sub == "drop":
                xs = [x for x in (Fraction(k, 100) for k in range(1, 2000))
                      if mass * G * (l + x) == lam * x * x / (2 * l)]  # the energy equation, by search
                assert len(xs) == 1, (s, xs)
                x = xs[0]
                if "greatest extension" in st:
                    assert val(q.answer) == x
                elif "greatest distance" in st:
                    assert val(q.answer) == l + x
                elif "becomes taut" in st:
                    assert val(q.answer) ** 2 == 2 * G * l
                else:
                    pytest.fail(f"seed {s}: an unexpected question {st}")
            else:
                x = val(p["op"]) - l
                assert 0 < x <= l
                if "tension" in st:
                    assert val(q.answer) == lam * x / l
                elif "acceleration" in st:
                    assert val(q.answer) == lam * x / (l * mass)
                elif "elastic potential energy" in st:
                    assert val(q.answer) == lam * x * x / (2 * l)
                elif "becomes slack" in st:
                    assert Fraction(1, 2) * mass * val(q.answer) ** 2 == lam * x * x / (2 * l)
                else:
                    pytest.fail(f"seed {s}: an unexpected question {st}")
            if q.kind == "short":
                assert (val(q.answer) * 10000).denominator == 1, (s, q.answer)
        if s in DRAWN:
            text = words(m, p)
            assert "T = λx / l" in text and "EPE = λx² / (2l)" in text
            if sub == "table":
                assert f"AB = {p['D']} m" in text
                for l_, lam_ in zip(p["l"], p["lam"]):
                    assert f"natural length {l_} m\nλ = {lam_} N" in text
            else:
                assert f"{p['l']} m" in text and f"λ = {p['lam']} N" in text and f"{p['m']} kg" in text
                if sub != "release":
                    assert "g = 10 m s⁻²" in text
                else:
                    assert f"OP = {p['op']} m" in text
            fig = m.draw(p)
            labels_clear(fig, ("elastic_string_m", s))
            plt.close(fig)
    assert min(subs.values()) > 200, subs


# --- circular_motion_m -----------------------------------------------------------------------------------

def test_circular_motion_m_common():
    common("circular_motion_m", want={"Circular motion"},
           never={"Projectiles", "Momentum", "Hooke's law", "Equilibrium of a rigid body", "Polar coordinates",
                  "Linear motion under a variable force"})


def cm_sqrt(f: Fraction) -> Fraction:
    n, d = math.isqrt(f.numerator), math.isqrt(f.denominator)
    assert n * n == f.numerator and d * d == f.denominator, f
    return Fraction(n, d)


def test_circular_motion_m():
    m = fam("circular_motion_m")
    subs = {}
    for s in SEEDS:
        p, qs = run(m, s)
        sub = p["sub"]
        subs[sub] = subs.get(sub, 0) + 1
        mass = val(p["m"])
        assert len(qs) == 3
        if sub == "conical":
            a, b = p["cos"]
            c = Fraction(a, b)
            sn = cm_sqrt(1 - c * c)
            L = val(p["L"])
            r = L * sn
            v = cm_sqrt(G * r * sn / c)  # R sinθ = mv²/r and R cosθ = mg, so v² = g r tanθ
            force = mass * G / c
        elif sub == "disc":
            r, w = val(p["r"]), val(p["w"])
            assert r * w * w / G <= 1
        else:
            r, u = val(p["r"]), p["u"]
            v = cm_sqrt(Fraction(u * u) - 4 * G * r)  # energy from A to B: a rise of 2r
            assert v * v >= G * r, (s, "P reaches the top with the string taut")
        for q in qs:
            st = q.stem
            got = q.options[int(q.answer)] if q.kind == "mcq" else q.answer
            value = val(got.replace(" N", "")) if q.kind == "mcq" else val(q.answer)
            if q.kind == "mcq":
                assert len({val(o.replace(" N", "")) for o in q.options}) == len(q.options)
            if sub == "conical":
                if re.search(r"tension in the string AP|normal reaction of the bowl on P", st):
                    assert ("string" in st) == (p["what"] == "string")
                    assert value == force, (s, st)
                elif "radius, in metres, of the horizontal circle" in st:
                    assert value == r
                elif "speed of P, in m s⁻¹, as it moves round" in st:
                    assert value == v
                elif "angular speed" in st:
                    assert value == v / r
                else:
                    pytest.fail(f"seed {s}: an unexpected question {st}")
            elif sub == "disc":
                if "Find the speed of P in m s⁻¹" in st:
                    assert value == r * w
                elif "friction force" in st:
                    assert value == mass * r * w * w
                elif "least possible coefficient of friction" in st:
                    assert value == r * w * w / G
                else:
                    pytest.fail(f"seed {s}: an unexpected question {st}")
            else:
                if "speed of P, in m s⁻¹, at the highest point B" in st:
                    assert value == v
                elif "lowest point A" in st:
                    assert value == mass * u * u / r + mass * G
                elif "highest point B" in st:
                    assert value == mass * v * v / r - mass * G
                else:
                    pytest.fail(f"seed {s}: an unexpected question {st}")
            if q.kind == "short":
                assert (val(q.answer) * 10000).denominator == 1, (s, q.answer)
        if s in DRAWN:
            text = words(m, p)
            assert f"mass of P {p['m']} kg" in text and "g = 10 m s⁻²" in text
            if sub == "conical":
                assert f"cos θ = {p['cos'][0]}/{p['cos'][1]}" in text and f"{p['L']} m" in text
            elif sub == "disc":
                assert f"ω = {p['w']} rad s⁻¹" in text and f"{p['r']} m" in text
            else:
                assert f"{p['u']} m s⁻¹" in text and f"{p['r']} m" in text
            fig = m.draw(p)
            labels_clear(fig, ("circular_motion_m", s))
            plt.close(fig)
    assert min(subs.values()) > 200, subs


# --- rigid_body_m ----------------------------------------------------------------------------------------

def test_rigid_body_m_common():
    common("rigid_body_m", want={"Equilibrium of a rigid body"},
           never={"Momentum", "Hooke's law", "Circular motion", "Projectiles", "Chapter 6: you will", "Chapter 9: Integration"})


def rb_cells(p):
    """The lamina's unit squares, counted one by one (the hole's squares taken away)."""
    cells = set()
    for x, y, w, h in p["rects"]:
        cells |= {(i, j) for i in range(x, x + w) for j in range(y, y + h)}
    if p["hole"]:
        x, y, w, h = p["hole"]
        cells -= {(i, j) for i in range(x, x + w) for j in range(y, y + h)}
    return cells


def test_rigid_body_m():
    m = fam("rigid_body_m")
    subs = {}
    for s in SEEDS:
        p, qs = run(m, s)
        sub = p["sub"]
        subs[sub] = subs.get(sub, 0) + 1
        q = qs[0]
        if sub == "lamina":
            cells = rb_cells(p)
            cx = Fraction(sum(2 * i + 1 for i, _ in cells), 2 * len(cells))  # each square's centre, averaged
            cy = Fraction(sum(2 * j + 1 for _, j in cells), 2 * len(cells))
            assert val(q.answer) == (cx if p["ask"] == "x" else cy), (s, q.answer, cx, cy)
            if p["hole"]:
                assert (cx, cy) != (Fraction(p["rects"][0][2], 2), Fraction(p["rects"][0][3], 2))
        elif sub == "beam":
            L, c, d, W, P, xp = p["L"], p["c"], p["d"], p["W"], p["P"], p["xp"]
            # moments about D and about C, each on its own
            rc = (W * (d - Fraction(L, 2)) + P * (d - xp)) / (d - c)
            rd = (W * (Fraction(L, 2) - c) + P * (xp - c)) / (d - c)
            assert rc > 0 and rd > 0 and rc + rd == W + P
            assert val(q.answer) == (rc if re.search(r"reaction at ([CD])", q.stem).group(1) == "C" else rd)
            if s in DRAWN:
                text = words(m, p)
                assert f"{W} N" in text and f"{P} N" in text
                marks = sorted({0, c, d, xp, L})
                for a, b in zip(marks, marks[1:]):
                    assert f"{b - a} m" in text
        else:
            L, W, p1, p2 = p["L"], p["W"], p["P1"], p["P2"]
            # the support at x: moments about it balance
            x = val(q.answer)
            assert p1 * x + W * (x - Fraction(L, 2)) == p2 * (L - x), (s, x)
            assert 0 < x < L
            if s in DRAWN:
                text = words(m, p)
                assert f"AB = {L} m" in text and f"{p1} N" in text and f"{p2} N" in text
                assert ("light rod" in text) == (W == 0)
        assert (val(q.answer) * 10 ** 6).denominator == 1 or "/" in q.answer
        if s in DRAWN and sub != "lamina":
            fig = m.draw(p)
            labels_clear(fig, ("rigid_body_m", s))
            plt.close(fig)
    assert len(subs) == 3 and min(subs.values()) > 250, subs


# ==============================================================================================================
# A Level statistics and pure, and the exponential tangent (sign_test, paired_t_test, hyperbolic_graph, arrangements, exp_tangent)
#
# P6 maths, the AL statistics and pure part: sign_test, paired_t_test, hyperbolic_graph, arrangements and exp_tangent.
#
# Every key is worked again here from the params: a sign test's p-value from the binomial sum, the Wilcoxon statistic by
# ranking the differences, a paired t statistic from the differences, a hyperbolic curve's constants from where it is
# drawn, arrangements by listing them (itertools) where there are few enough, and a tangent's gradient by differentiating
# the curve at its point. Critical values come from this file's own copies of the standard tables.
# ==============================================================================================================


MINUS = "−"


def al_dec(f: Fraction, places: int) -> str:
    """A fraction to so many decimal places, half up, as printed."""
    d = Decimal(f.numerator) / Decimal(f.denominator)
    return str(d.quantize(Decimal(1).scaleb(-places), rounding=ROUND_HALF_UP))


def al_num(text: str) -> Fraction:
    return Fraction(text.replace(MINUS, "-").replace(" ", ""))


def al_sig3(x: float) -> str:
    """3 significant figures with the zeros kept: 2.00, 12.3."""
    out = f"{x:.3g}"
    digits = len(re.sub(r"\D", "", out).lstrip("0"))
    if digits < 3:
        out += ("" if "." in out else ".") + "0" * (3 - digits)
    return out


def al_segments(art):
    pts = art.get_transform().transform(art.get_xydata())
    return list(zip(pts, pts[1:]))


def al_passes(a, b, box, margin=1.0, steps=60) -> bool:
    return any(box.x0 + margin < a[0] + (b[0] - a[0]) * k / steps < box.x1 - margin and
               box.y0 + margin < a[1] + (b[1] - a[1]) * k / steps < box.y1 - margin for k in range(steps + 1))


def al_labels_clear_of_lines(fig, tag="label"):
    """No drawn line (curve, tangent, asymptote) runs through a text whose gid starts with tag."""
    texts = [(t, b) for t, b in drawn_texts(fig) if (t.get_gid() or "").startswith(tag)]
    for ax in fig.axes:
        for ln in ax.lines:
            for a, b in al_segments(ln):
                for t, box in texts:
                    assert not al_passes(a, b, box), (t.get_text(), ln.get_gid())
    return len(texts)


# --- sign_test ---------------------------------------------------------------------------------------------------

# Critical values of the Wilcoxon signed-rank statistic T, one-tailed (reject H0 when T is at most the value).
WILCOXON = {8: {"5%": 5, "2.5%": 3}, 9: {"5%": 8, "2.5%": 5}, 10: {"5%": 10, "2.5%": 8}, 11: {"5%": 13, "2.5%": 10},
            12: {"5%": 17, "2.5%": 13}}


def st_diffs(p):
    if p["paired"]:
        return [a - b for b, a in zip(p["before"], p["after"])]
    return [x - p["m0"] for x in p["values"]]


def st_cum(n, k) -> Fraction:
    return Fraction(sum(math.comb(n, i) for i in range(k + 1)), 2 ** n)


def test_sign_test_common():
    common("sign_test", want={"Non-parametric tests"},
           never={"Inferential statistics", "Chi-squared tests", "Chapter 1: Types of data",
                  "Chapter 7: The binomial distribution", "Chapter 4: Experiments, events and outcomes"})


def test_sign_test():
    m = fam("sign_test")
    kinds, decisions = Counter(), Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        assert p["band"] == "AL"
        kinds[(p["sub"], p["paired"])] += 1
        d = st_diffs(p)
        n = len(d)
        assert all(x != 0 for x in d), (s, d)
        pos = sum(x > 0 for x in d)
        neg = n - pos
        few = neg if p["h1"] == "greater" else pos  # the sign H1 says should be rare
        alpha = al_num(p["alpha"].rstrip("%")) / 100
        if p["sub"] == "sign":
            assert 8 <= n <= 14
            pv = st_cum(n, few)
            assert abs(pv - alpha) >= Fraction(5, 1000), (s, float(pv), p["alpha"])
            shown = al_dec(pv, 4)
            reject = pv < alpha
            other = al_dec(st_cum(n, few - 1 if few >= 1 else few + 1), 4)
            assert other != shown
        else:
            mags = [abs(x) for x in d]
            assert len(set(mags)) == n and 8 <= n <= 12, (s, d)
            rank = {v: i + 1 for i, v in enumerate(sorted(mags))}
            P = sum(rank[abs(x)] for x in d if x > 0)
            Q = sum(rank[abs(x)] for x in d if x < 0)
            assert P + Q == n * (n + 1) // 2
            T = min(P, Q)
            against = Q if p["h1"] == "greater" else P
            assert against == T < max(P, Q), (s, P, Q, p["h1"])
            cv = WILCOXON[n][p["alpha"]]
            assert p["crit"] == cv and T != cv, (s, T, cv)
            reject = T <= cv
        decisions[(p["sub"], reject)] += 1
        for q in qs:
            st = q.stem
            got = re.search(r"How many of the (\d+) values are (above|below) (\d+)\?$", st)
            if got:
                assert not p["paired"] and int(got.group(1)) == n and int(got.group(3)) == p["m0"]
                assert q.answer == str(pos if got.group(2) == "above" else neg), (s, st)
                continue
            got = re.search(r"For how many of the (\d+) (\w+) is the after value (higher|lower) than the before value\?$", st)
            if got:
                assert p["paired"] and int(got.group(1)) == n
                assert q.answer == str(pos if got.group(3) == "higher" else neg), (s, st)
                continue
            if re.search(r"find the p-value of the sign test\.$", st):
                assert p["sub"] == "sign" and q.answer == shown, (s, q.answer, shown)
                continue
            got = re.search(r"Find (P|Q), the sum of the ranks of the (positive|negative) differences\.$", st)
            if got:
                assert p["sub"] == "wilcoxon" and (got.group(1) == "P") == (got.group(2) == "positive")
                assert q.answer == str(P if got.group(1) == "P" else Q), (s, st)
                continue
            if re.search(r"Find the value of the Wilcoxon test statistic T\.$", st):
                assert q.answer == str(T)
                continue
            if re.search(r"Which is the correct conclusion of the test at the ([\d.]+%) significance level\?$", st):
                assert q.kind == "mcq" and p["alpha"] in st
                if p["sub"] == "sign":
                    def good(o):
                        g = re.fullmatch(r"p-value (0\.\d{4}), so (reject|do not reject) H₀", o)
                        assert g, o
                        return g.group(1) == shown and (g.group(2) == "reject") == reject
                    assert sorted(re.fullmatch(r"p-value (0\.\d{4}), .*", o).group(1) for o in q.options) == \
                        sorted([shown, shown, other, other])
                else:
                    def good(o):
                        g = re.fullmatch(r"T = (\d+), so (reject|do not reject) H₀", o)
                        assert g, o
                        return int(g.group(1)) == T and (g.group(2) == "reject") == reject
                    assert sorted(int(re.fullmatch(r"T = (\d+), .*", o).group(1)) for o in q.options) == \
                        sorted([T, T, max(P, Q), max(P, Q)])
                one_correct(q, good)
                continue
            raise AssertionError(f"seed {s}: an unexpected question {st}")
        if s in DRAWN:
            text = words(m, p)
            if p["paired"]:
                for v in p["before"] + p["after"]:
                    assert re.search(rf"(^|\| ){v}( \||$)", text), (s, v)
            else:
                for v in p["values"]:
                    assert re.search(rf"(^|\| ){v}( \||$)", text), (s, v)
                assert str(p["m0"]) in text
            assert p["alpha"] in text and "H₀" in text and "H₁" in text
            if p["sub"] == "sign":
                for k in range(n // 2 + 1):
                    assert al_dec(st_cum(n, k), 4) in text, (s, k)
            else:
                assert re.search(rf"\b{p['crit']}\b", text.split("ritical value")[-1]), (s, "the critical value is printed")
    assert all(kinds[k] > 150 for k in [("sign", False), ("sign", True), ("wilcoxon", False), ("wilcoxon", True)]), kinds
    assert all(v > 100 for v in decisions.values()) and len(decisions) == 4, decisions


# --- paired_t_test -----------------------------------------------------------------------------------------------

# Upper percentage points of t with nu degrees of freedom.
T_TABLE = {4: {"5%": "2.132", "2.5%": "2.776", "1%": "3.747"}, 5: {"5%": "2.015", "2.5%": "2.571", "1%": "3.365"},
           6: {"5%": "1.943", "2.5%": "2.447", "1%": "3.143"}, 7: {"5%": "1.895", "2.5%": "2.365", "1%": "2.998"}}


def pt_close(answer: str, x: float, q) -> bool:
    return abs(float(answer) - x) <= max(q.tolerance, 1e-9)


def test_paired_t_test_common():
    common("paired_t_test", want={"Inferential statistics"},
           never={"Non-parametric tests", "Chi-squared tests", "Chapter 1: Types of data"})


def test_paired_t_test():
    m = fam("paired_t_test")
    subs, decisions = Counter(), Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        assert p["band"] == "AL"
        subs[p["sub"]] += 1
        d = [Fraction(a - b) for b, a in zip(p["before"], p["after"])]
        n = len(d)
        assert 5 <= n <= 8 and len(p["before"]) == len(p["after"])
        mean = sum(d) / n
        s2 = sum((x - mean) ** 2 for x in d) / (n - 1)
        assert s2 > 0 and (mean * 100).denominator == 1 and (s2 * 1000).denominator == 1, (s, mean, s2)
        se = math.sqrt(s2 / n)
        t = float(mean) / se
        if p["sub"] == "test":
            crit = float(T_TABLE[n - 1][p["alpha"]])
            assert abs(abs(t) - crit) >= 0.1, (s, t, crit)
            assert (mean > 0) == (p["h1"] == "greater")
            reject = t > crit if p["h1"] == "greater" else t < -crit
            decisions[reject] += 1
            tb = float(mean) / math.sqrt(float(sum((x - mean) ** 2 for x in d) / n) / n)  # the variance divided by n
            assert al_sig3(tb) != al_sig3(t)
        else:
            tail = {"95%": "2.5%", "90%": "5%"}[p["ci"]]
            tc = float(T_TABLE[n - 1][tail])
            lo, hi = float(mean) - tc * se, float(mean) + tc * se
        for q in qs:
            st = q.stem
            got = re.search(r"find the mean of the (\d+) differences\.$", st)
            if got:
                assert int(got.group(1)) == n and al_num(q.answer) == mean, (s, q.answer, mean)
                continue
            if re.search(r"Find an unbiased estimate of the variance of the differences d\.$", st):
                assert al_num(q.answer) == s2, (s, q.answer, s2)
                continue
            if re.search(r"Find the value of the test statistic t, correct to 3 significant figures\.$", st):
                assert q.answer == al_sig3(t) and 0 < q.tolerance <= 0.011 * max(1, abs(t)), (s, q.answer, t)
                continue
            if re.search(r"Which is the correct conclusion of the paired t-test at the ([\d.]+%) significance level\?$", st):
                def good(o):
                    g = re.fullmatch(r"t = (-?[\d.]+), so (reject|do not reject) H₀", o.replace(MINUS, "-"))
                    assert g, o
                    return g.group(1) == al_sig3(t) and (g.group(2) == "reject") == reject
                vals = sorted(re.match(r"t = (\S+),", o.replace(MINUS, "-")).group(1) for o in q.options)
                assert vals == sorted([al_sig3(t)] * 2 + [al_sig3(tb)] * 2), (s, q.options)
                one_correct(q, good)
                continue
            got = re.search(r"Find the (lower|upper) end of the (\d+%) confidence interval for the population mean of d, "
                            r"correct to 3 significant figures\.$", st)
            if got:
                want = lo if got.group(1) == "lower" else hi
                assert got.group(2) == p["ci"] and q.answer == al_sig3(want), (s, q.answer, want)
                assert 0 < q.tolerance and abs(float(q.answer) - want) <= q.tolerance
                continue
            got = re.search(r"Find the width of the (\d+%) confidence interval for the population mean of d, correct to 3 "
                            r"significant figures\.$", st)
            if got:
                assert q.answer == al_sig3(hi - lo), (s, q.answer, hi - lo)
                continue
            raise AssertionError(f"seed {s}: an unexpected question {st}")
        if s in DRAWN:
            text = words(m, p)
            for v in p["before"] + p["after"]:
                assert re.search(rf"(^|\| ){v}( \||$)", text), (s, v)
            if p["sub"] == "test":
                assert T_TABLE[n - 1][p["alpha"]] in text and p["alpha"] in text and "H₁" in text
            else:
                assert T_TABLE[n - 1][{"95%": "2.5%", "90%": "5%"}[p["ci"]]] in text
    assert subs["test"] > 300 and subs["ci"] > 300, subs
    assert decisions[True] > 100 and decisions[False] > 100, decisions


# --- hyperbolic_graph --------------------------------------------------------------------------------------------

def hy_cosh(x):
    return (math.exp(x) + math.exp(-x)) / 2


def hy_sinh(x):
    return (math.exp(x) - math.exp(-x)) / 2


def hy_cosh_ln(k: int) -> Fraction:
    return (Fraction(k) + Fraction(1, k)) / 2


def hy_sinh_ln(k: int) -> Fraction:
    return (Fraction(k) - Fraction(1, k)) / 2


def test_hyperbolic_graph_common():
    common("hyperbolic_graph", want={"Hyperbolic functions"})


def test_hyperbolic_graph():
    m = fam("hyperbolic_graph")
    subs = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        assert p["band"] == "AL"
        sub = p["sub"]
        subs[sub] += 1
        if sub == "tanh":
            a, b, h = p["a"], p["b"], p["h"]
            assert b != 0
            key = {"a": a, "b": b, "h": h}
        elif sub in ("cosh", "sinh"):
            a, c, k, side = p["a"], p["c"], p["k"], p["side"]
            assert a != 0 and k in (2, 3, 4) and side in (1, -1)
            yp = a * (hy_cosh_ln(k) if sub == "cosh" else side * hy_sinh_ln(k)) + c
            assert yp.denominator in (1, 2, 4), (s, yp)
            assert al_num(p["yP"]) == yp
            # the constants the figure decides: from the turning point (or the y-intercept) and P
            base = a + c if sub == "cosh" else c
            a_back = (yp - base) / ((hy_cosh_ln(k) - 1) if sub == "cosh" else side * hy_sinh_ln(k))
            assert a_back == a
            key = {"a": a, "c": c}
        for q in qs:
            st = q.stem
            got = re.search(r"Find the value of (a|b|c|h)\.$", st)
            if got:
                assert int(q.answer.replace(MINUS, "-")) == key[got.group(1)], (s, st, q.answer)
                if key[got.group(1)] < 0:
                    assert q.answer.replace("-", MINUS) in q.accepted
                continue
            got = re.search(r"Find the exact value of y on the curve .* when x = ln (\d+)\.$", st)
            if got:
                mm = int(got.group(1))
                assert sub in ("cosh", "sinh") and mm != p["k"]
                want = a * (hy_cosh_ln(mm) if sub == "cosh" else hy_sinh_ln(mm)) + c
                assert al_num(q.answer) == want, (s, q.answer, want)
                continue
            if re.search(r"What is the range of the curve .* shown\?$", st):
                if sub == "tanh":
                    lo, hi = a - abs(b), a + abs(b)
                    assert a != 0
                    one_correct(q, lambda o: o == f"{lo} < y < {hi}".replace("-", MINUS))
                else:
                    assert sub == "cosh"
                    ext = a + c
                    one_correct(q, lambda o: o == (f"y ≥ {ext}" if a > 0 else f"y ≤ {ext}").replace("-", MINUS))
                continue
            got = re.search(r"Which curve is y = (?:(\d) )?(cosh|sinh|tanh) x\?$", st)
            if got:
                fn = got.group(2)
                coef = int(got.group(1) or 1)
                i = p["order"].index(fn)
                assert p["coef"][i] == coef
                one_correct(q, lambda o: o == "PQR"[i])
                continue
            got = re.search(r"Write down the equation of the horizontal asymptote that curve ([PQR]) approaches as x "
                            r"increases\.$", st)
            if got:
                i = "PQR".index(got.group(1))
                assert p["order"][i] == "tanh"
                assert q.answer == f"y = {p['coef'][i]}"
                continue
            raise AssertionError(f"seed {s}: an unexpected question {st}")
        if s in DRAWN:
            fig = m.draw(p)
            ax = fig.axes[0]
            (x0, x1), (y0, y1) = ax.get_xlim(), ax.get_ylim()
            texts = " | ".join(t.get_text() for t, _ in drawn_texts(fig))
            if sub in ("cosh", "sinh"):
                xP = p["side"] * math.log(p["k"])
                assert f"ln {p['k']}" in texts and p["yP"].replace("-", MINUS) in texts, (s, texts)
                base = (0, a + c) if sub == "cosh" else (0, c)
                dots = [ln for ln in ax.lines if ln.get_marker() == "o"]
                spots = {(round(float(ln.get_xdata()[0]), 6), round(float(ln.get_ydata()[0]), 6)) for ln in dots}
                assert (0.0, float(base[1])) in spots and (round(xP, 6), round(float(yp), 6)) in spots, (s, spots)
                assert y0 < base[1] < y1 and y0 < float(yp) < y1
            if sub == "tanh":
                assert y0 < a - abs(b) and a + abs(b) < y1 and x0 < h - 3 and h + 3 < x1
                dashed = [ln for ln in ax.lines if ln.get_linestyle() not in ("-", "solid", "None") and len(ln.get_ydata()) > 1
                          and len(set(ln.get_ydata())) == 1]
                assert sorted(float(ln.get_ydata()[0]) for ln in dashed) == [a - abs(b), a + abs(b)], (s, "asymptotes")
            if sub == "which":
                for fn, coef in zip(p["order"], p["coef"]):
                    assert f"y = {'' if coef == 1 else str(coef) + ' '}{fn} x" in texts, (s, fn, texts)
            # every whole number from the bottom to the top is a gridline, and numbered at least every 2
            ys = [round(float(v), 6) for v in ax.get_yticks(minor=True)]
            assert all(float(v).is_integer() for v in ys)
            al_labels_clear_of_lines(fig)
            plt.close(fig)
    assert min(subs.values()) > 150 and len(subs) == 4, subs


# --- arrangements --------------------------------------------------------------------------------------------------

def ar_count(items, ok=lambda t: True) -> int:
    return sum(1 for t in set(itertools.permutations(items)) if ok(t))


def ar_multi(items) -> int:
    out = math.factorial(len(items))
    for v in Counter(items).values():
        out //= math.factorial(v)
    return out


def ar_together(t, x) -> bool:
    idx = [i for i, v in enumerate(t) if v == x]
    return idx[-1] - idx[0] == len(idx) - 1


def ar_next(t, x, y) -> bool:
    return abs(t.index(x) - t.index(y)) == 1


def test_arrangements_common():
    common("arrangements", want={"Chapter 5: The factorial function"},
           never={"Chapter 6: Discrete random variables", "Chapter 7: The binomial distribution",
                  "Probability generating functions", "Proof by induction", "Chapter 4: Experiments, events and outcomes"})


def test_arrangements():
    m = fam("arrangements")
    subs = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        assert p["band"] == "AL"
        sub = p["sub"]
        subs[sub] += 1
        if sub in ("word", "cards", "beads"):
            items = p["tiles"] if sub == "word" else p["cards"] if sub == "cards" else p["beads"]
            n = len(items)
            assert 5 <= n <= 8
            assert max(Counter(items).values()) >= 2, (s, items)  # repeats make the counting worth doing
            small = n <= 7
            perms = set(itertools.permutations(items)) if small else None
        for q in qs:
            st = q.stem
            if sub == "word":
                if re.search(r"How many different arrangements of all (\d+) tiles in a row are there\?$", st):
                    want = len(perms) if small else ar_multi(items)
                    assert q.answer == str(want) == str(ar_multi(items))
                    continue
                got = re.search(r"How many different arrangements of the (\d+) tiles begin with ([A-Z])\?$", st)
                if got:
                    x = got.group(2)
                    rest = list(items)
                    rest.remove(x)
                    want = sum(1 for t in perms if t[0] == x) if small else ar_multi(rest)
                    assert q.answer == str(want) == str(ar_multi(rest)), (s, st)
                    continue
                got = re.search(r"How many different arrangements of the (\d+) tiles have all the ([A-Z])s next to each other\?$", st)
                if got:
                    x = got.group(2)
                    assert items.count(x) >= 2
                    block = [v for v in items if v != x] + ["#"]
                    want = sum(1 for t in perms if ar_together(t, x)) if small else ar_multi(block)
                    assert q.answer == str(want) == str(ar_multi(block)), (s, st)
                    continue
                got = re.search(r"How many different arrangements of the (\d+) tiles have the ([A-Z]) and the ([A-Z]) next to each other\?$", st)
                if got:
                    x, y = got.group(2), got.group(3)
                    assert items.count(x) == 1 == items.count(y) and x != y
                    joined = [v for v in items if v not in (x, y)] + ["#"]
                    want = sum(1 for t in perms if ar_next(t, x, y)) if small else 2 * ar_multi(joined)
                    assert q.answer == str(want) == str(2 * ar_multi(joined)), (s, st)
                    continue
                got = re.search(r"How many different arrangements of the (\d+) tiles begin and end with ([A-Z])\?$", st)
                if got:
                    x = got.group(2)
                    rest = list(items)
                    rest.remove(x)
                    rest.remove(x)
                    want = sum(1 for t in perms if t[0] == x == t[-1]) if small else ar_multi(rest)
                    assert q.answer == str(want) == str(ar_multi(rest)), (s, st)
                    continue
            if sub == "cards":
                digits = items
                okn = lambda t: t[0] != 0  # noqa: E731
                got = re.search(r"How many different (\d)-digit numbers can be made using all (\d) cards\?", st)
                if got:
                    want = sum(1 for t in perms if okn(t)) if small else None
                    lead0 = 0
                    if 0 in digits:
                        rest = list(digits)
                        rest.remove(0)
                        lead0 = ar_multi(rest)
                        assert "cannot begin with 0" in st
                    assert q.answer == str(ar_multi(digits) - lead0) and (want is None or str(want) == q.answer), (s, st)
                    continue
                if re.search(r"How many of the different (\d)-digit numbers made from all (\d) cards are even\?$", st):
                    want = sum(1 for t in perms if okn(t) and t[-1] % 2 == 0) if small else None
                    total = 0
                    for e in sorted(set(x for x in digits if x % 2 == 0)):
                        rest = list(digits)
                        rest.remove(e)
                        total += ar_multi(rest)
                        if 0 in rest:
                            r2 = list(rest)
                            r2.remove(0)
                            total -= ar_multi(r2)
                    assert q.answer == str(total) and (want is None or str(want) == q.answer), (s, st)
                    continue
                got = re.search(r"How many of the different (\d)-digit numbers made from all (\d) cards begin with (\d)\?$", st)
                if got:
                    x = int(got.group(3))
                    assert x != 0 and x in digits
                    rest = list(digits)
                    rest.remove(x)
                    want = sum(1 for t in perms if t[0] == x) if small else ar_multi(rest)
                    assert q.answer == str(want) == str(ar_multi(rest)), (s, st)
                    continue
            if sub == "beads":
                colours = {"R": "red", "B": "blue", "G": "green", "Y": "yellow", "W": "white"}
                if re.search(r"How many different orders of the (\d+) beads are there\?$", st):
                    assert q.answer == str(ar_multi(items)) and (not small or q.answer == str(len(perms)))
                    continue
                got = re.search(r"How many different orders of the (\d+) beads have all the (\w+) beads next to each other\?$", st)
                if got:
                    x = next(k for k, v in colours.items() if v == got.group(2))
                    assert items.count(x) >= 2
                    block = [v for v in items if v != x] + ["#"]
                    want = sum(1 for t in perms if ar_together(t, x)) if small else ar_multi(block)
                    assert q.answer == str(want) == str(ar_multi(block)), (s, st)
                    continue
                got = re.search(r"How many different orders of the (\d+) beads have a (\w+) bead at each end\?$", st)
                if got:
                    x = next(k for k, v in colours.items() if v == got.group(2))
                    rest = list(items)
                    rest.remove(x)
                    rest.remove(x)
                    want = sum(1 for t in perms if t[0] == x == t[-1]) if small else ar_multi(rest)
                    assert q.answer == str(want) == str(ar_multi(rest)), (s, st)
                    continue
            if sub == "committee":
                (g1, a), (g2, b) = p["groups"]
                r = p["size"]
                people = [(g1, i) for i in range(a)] + [(g2, i) for i in range(b)]
                teams = list(itertools.combinations(people, r))
                if re.search(rf"How many different committees of {r} are possible\?$", st):
                    assert q.answer == str(len(teams)) == str(math.comb(a + b, r))
                    continue
                got = re.search(rf"How many different committees of {r} have exactly (\d) {g1}\?$", st)
                if got:
                    j = int(got.group(1))
                    want = sum(1 for t in teams if sum(x[0] == g1 for x in t) == j)
                    assert q.answer == str(want) == str(math.comb(a, j) * math.comb(b, r - j)), (s, st)
                    continue
                got = re.search(rf"How many different committees of {r} include at least one of the {g2}\?$", st)
                if got:
                    want = sum(1 for t in teams if any(x[0] == g2 for x in t))
                    assert q.answer == str(want), (s, st)
                    continue
                got = re.search(rf"Which expression gives the number of committees of {r} with exactly (\d) {g1}\?$", st)
                if got:
                    j = int(got.group(1))
                    want = math.comb(a, j) * math.comb(b, r - j)

                    def value(o):
                        sup = str.maketrans("⁰¹²³⁴⁵⁶⁷⁸⁹₀₁₂₃₄₅₆₇₈₉", "01234567890123456789")
                        g = re.fullmatch(r"(\S+)C(\S+) ([×+]) (\S+)C(\S+)", o)
                        assert g, o
                        n1, k1, op, n2, k2 = g.groups()
                        v1 = math.comb(int(n1.translate(sup)), int(k1.translate(sup)))
                        v2 = math.comb(int(n2.translate(sup)), int(k2.translate(sup)))
                        return v1 * v2 if op == "×" else v1 + v2
                    assert [o for o in q.options if value(o) == want] == [picked(q)], (s, q.options)
                    continue
            raise AssertionError(f"seed {s}: an unexpected question {st}")
        if s in DRAWN:
            fig = m.draw(p)
            shown = [t.get_text() for t, _ in drawn_texts(fig) if (t.get_gid() or "").startswith("item")]
            people = [pa.get_gid().split(":")[1] for ax in fig.axes for pa in ax.patches
                      if (pa.get_gid() or "").startswith("person:")]
            heads = sorted(t.get_text().lower() for t, _ in drawn_texts(fig) if (t.get_gid() or "").startswith("group"))
            plt.close(fig)
            if sub == "word":
                assert shown == p["tiles"], (s, shown)
            elif sub == "cards":
                assert shown == [str(x) for x in p["cards"]], (s, shown)
            elif sub == "beads":
                assert shown == p["beads"], (s, shown)
            else:
                (g1, a), (g2, b) = p["groups"]
                assert Counter(people) == Counter({g1: a, g2: b}), (s, people)  # one drawn person each, in its box
                assert heads == sorted([g1, g2]), (s, heads)
    assert min(subs.values()) > 150 and len(subs) == 4, subs


# --- exp_tangent ---------------------------------------------------------------------------------------------------

def ex_point(p):
    """The point T, the curve's gradient there (by differentiating), worked from the curve's own constants."""
    if p["sub"] == "exp":
        A, k, c = p["A"], Fraction(*p["k"]), p["c"]
        return Fraction(0), Fraction(A + c), A * k
    if p["sub"] == "aln":  # y = A ln(x + b) + c: ln 1 = 0 where x + b = 1, gradient A / (x + b) = A
        A, b, c = p["A"], p["b"], p["c"]
        x0 = Fraction(1 - b)
        return x0, Fraction(c), Fraction(A) / (x0 + b)
    a, b, c = p["a"], p["b"], p["c"]  # y = ln(ax + b) + c
    x0 = Fraction(1 - b, a)
    return x0, Fraction(c), Fraction(a) / (a * x0 + b)


def ex_curve(p, x):
    if p["sub"] == "exp":
        return p["A"] * math.exp(p["k"][0] / p["k"][1] * x) + p["c"]
    if p["sub"] == "aln":
        return p["A"] * math.log(x + p["b"]) + p["c"]
    return math.log(p["a"] * x + p["b"]) + p["c"]


def ex_line(mm, cc) -> str:
    lead = {1: "", -1: MINUS}.get(mm, str(mm).replace("-", MINUS))
    return f"y = {lead}x" + ("" if cc == 0 else f" {'+' if cc > 0 else MINUS} {abs(cc)}")


def test_exp_tangent_common():
    common("exp_tangent", want={"Chapter 14: Derivatives of exponential functions"},
           never={"Chapter 15: Differentiation reversed", "Integration", "Calculus basics", "Taylor and Maclaurin's Expansions",
                  "Unit 9: Differentiation of polynomials, rational and irrational functions, and their applications",
                  "UNIT 3: EXPONENTIAL AND LOGARITHMIC FUNCTIONS AND EQUATIONS", "UNIT 5: FINANCIAL MATHEMATICS"})


def test_exp_tangent():
    m = fam("exp_tangent")
    subs = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        assert p["band"] == "UP"
        subs[p["sub"]] += 1
        x0, y0, g = ex_point(p)
        assert x0.denominator == 1 and y0.denominator == 1 and g.denominator == 1 and g != 0, (s, x0, y0, g)
        assert abs(ex_curve(p, float(x0)) - float(y0)) < 1e-9
        cc = y0 - g * x0
        assert cc != 0
        x2 = p["x2"]
        assert abs(x2 - x0) in (1, 2)
        unknown = p["unknown"]
        truth = {"k": Fraction(*p["k"]) if "k" in p else None, "A": p.get("A"), "a": p.get("a")}[unknown]
        for q in qs:
            st = q.stem
            got = re.search(r"Use the tangent to find the value of (k|A|a)\.$", st)
            if got:
                assert got.group(1) == unknown and al_num(q.answer) == truth, (s, q.answer, truth)
                assert unknown in st.split(" and its tangent")[0]
                continue
            if re.search(r"What is the equation of the tangent at T to the curve .*\?$", st):
                one_correct(q, lambda o: o == ex_line(int(g), int(cc)))
                continue
            if re.search(r"Find the x-coordinate of the point where the tangent at T to the curve .* meets the x-axis\.$", st):
                assert al_num(q.answer) == -cc / g, (s, q.answer)
                continue
            if re.search(r"Find the gradient of the normal to the curve .* at T\.$", st):
                assert al_num(q.answer) == -1 / g, (s, q.answer)
                continue
            raise AssertionError(f"seed {s}: an unexpected question {st}")
        if s in DRAWN:
            fig = m.draw(p)
            ax = fig.axes[0]
            (lx, hx), (ly, hy) = ax.get_xlim(), ax.get_ylim()
            dots = [ln for ln in ax.lines if ln.get_marker() == "o"]
            spots = {(float(ln.get_xdata()[0]), float(ln.get_ydata()[0])) for ln in dots}
            two = {(float(x0), float(y0)), (float(x2), float(y0 + g * (x2 - x0)))}
            assert spots == two, (s, spots, two)
            for x, y in two:
                assert lx + 0.4 < x < hx - 0.4 and ly + 0.4 < y < hy - 0.4, (s, x, y)
            # a gridline on every whole number (minor ticks under a major one are merged into it)
            ticks = list(ax.get_xticks(minor=True)) + list(ax.get_xticks())
            assert set(range(math.ceil(lx), math.floor(hx) + 1)) <= {round(float(v)) for v in ticks}
            texts = " | ".join(t.get_text() for t, _ in drawn_texts(fig))
            assert "T" in texts
            al_labels_clear_of_lines(fig)
            plt.close(fig)
    assert min(subs.values()) > 200 and len(subs) == 3, subs


# ==============================================================================================================
# Upper secondary and A Level pure (cayley_table, sequence_plot, coord_geometry, completing_square)
#
# P6 maths, upper-secondary and AS families (part file; merged into test_p6_maths_answers.py later): Cayley tables,
# sequences plotted term by term, coordinate geometry on a grid, completing the square, circular measure, and the
# volumes and surface areas of solids. Every key is worked out again here from the params, never with the family's
# own helpers.
# ==============================================================================================================



def up_segments(art):
    """The straight pieces of a line or a patch's outline, in pixels."""
    if isinstance(art, Line2D):
        pts = art.get_transform().transform(art.get_xydata())
        return list(zip(pts, pts[1:]))
    out = []
    for poly in art.get_path().to_polygons(art.get_transform(), closed_only=False):
        out += list(zip(poly, poly[1:]))
    return out


def up_passes(a, b, box, margin=1.5, steps=60) -> bool:
    return any(box.x0 + margin < a[0] + (b[0] - a[0]) * k / steps < box.x1 - margin and
               box.y0 + margin < a[1] + (b[1] - a[1]) * k / steps < box.y1 - margin for k in range(steps + 1))


def up_no_line_through_text(m, seeds=range(1, 25), skip=("grid",)):
    """No drawn line or outline runs through a label (the shared layout tests check text against text only).
    Gridlines and axis spines are not drawn as lines of the axes, so they are not checked; nor are the axis numbers of
    a coordinate grid, which a graph crosses on paper too."""
    for seed in seeds:
        fig = m.draw(m.sample(random.Random(seed)))
        ticks = {id(t) for ax in fig.axes for t in ax.get_xticklabels() + ax.get_yticklabels()}
        texts = [(t, b) for t, b in drawn_texts(fig) if not (t.get_gid() or "").startswith("free") and id(t) not in ticks]
        for ax in fig.axes:
            for art in list(ax.lines) + list(ax.patches):
                if not art.get_visible() or (art.get_gid() or "").startswith(("behind", *skip)):
                    continue
                for a, b in up_segments(art):
                    for t, box in texts:
                        assert not up_passes(a, b, box), (m.ID, seed, art.get_gid() or type(art).__name__, t.get_text())
        plt.close(fig)


def up_num(s: str) -> Fraction:
    s = s.replace("−", "-").strip()
    return Fraction(s)


# --- cayley_table ------------------------------------------------------------------------------------------

def test_cayley_table_common():
    common("cayley_table", want={"Unit 3: Binary operations"},
           never={"Number and numeration", "Unit 2: Propositional and predicate logic", "Unit 4: Set of real numbers",
                  "Complex Numbers", "UNIT 1: BASIC CONCEPTS OF ALGEBRA"})


def _op(p):
    els = p["elements"]
    return {(x, y): p["table"][i][j] for i, x in enumerate(els) for j, y in enumerate(els)}


def _identity(els, op):
    found = [e for e in els if all(op[(e, x)] == x and op[(x, e)] == x for x in els)]
    assert len(found) <= 1
    return found[0] if found else None


def test_cayley_table():
    m = fam("cayley_table")
    kinds = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        kinds[p["kind"]] += 1
        els = p["elements"]
        assert 3 <= len(els) <= 6 and len(set(els)) == len(els)
        op = _op(p)
        assert all(v in els for v in op.values()), "the table is closed"
        e = _identity(els, op)
        group = p["kind"] in ("cyclic", "klein", "modular")
        if group:
            assert e is not None
            for x in els:  # a group table: each element once in every row and column
                assert sorted(op[(x, y)] for y in els) == sorted(els)
                assert sorted(op[(y, x)] for y in els) == sorted(els)
        bad = sorted({tuple(sorted((x, y))) for x in els for y in els if op[(x, y)] != op[(y, x)]})
        if p["kind"] == "skew":
            assert len(bad) == 1, (s, bad)
        else:
            assert not bad
        if s in DRAWN:
            text = words(m, p)
            for v in list(op.values()) + els:
                assert v in text
            assert "row" in text and "column" in text
        for q in qs:
            st = q.stem
            got = re.search(r"find (\w+) \* (\w+)\.$", st)
            if got and "(" not in st:
                assert q.answer == op[(got.group(1), got.group(2))], (s, st)
                continue
            got = re.search(r"find \((\w+) \* (\w+)\) \* (\w+)\.$", st)
            if got:
                a, b, c = got.groups()
                assert q.answer == op[(op[(a, b)], c)], (s, st)
                continue
            if "identity element" in st:
                assert group or p["kind"] == "skew"
                assert picked(q) == e, (s, st)
                one_correct(q, lambda o: o == e)
                continue
            got = re.search(r"inverse of (\w+)", st)
            if got:
                x = got.group(1)
                inv = [y for y in els if op[(x, y)] == e and op[(y, x)] == e]
                assert len(inv) == 1 and picked(q) == inv[0], (s, st)
                one_correct(q, lambda o: o in inv)
                continue
            got = re.search(r"x \* (\w+) = (\w+)", st)
            if got:
                b, c = got.groups()
                assert b != e, (s, st, "x * e = c needs no table")
                sol = [x for x in els if op[(x, b)] == c]
                assert sol == [q.answer], (s, st, sol)
                continue
            if "their own inverse" in st:
                n = sum(1 for x in els if op[(x, x)] == e)
                assert q.answer == str(n), (s, st)
                continue
            if "do not commute" in st or "does not commute" in st or "not commute" in st:
                assert p["kind"] == "skew"
                key = picked(q)
                pair = tuple(sorted(re.findall(r"\b(\w+)\b and \b(\w+)\b", key)[0]))
                assert [pair] == bad, (s, key, bad)
                one_correct(q, lambda o: tuple(sorted(re.findall(r"\b(\w+)\b and \b(\w+)\b", o)[0])) in bad)
                continue
            pytest.fail(f"seed {s}: an unexpected question {st}")
    assert min(kinds.values()) >= 100, kinds
    up_no_line_through_text(m)


# --- sequence_plot -----------------------------------------------------------------------------------------

def test_sequence_plot_common():
    common("sequence_plot", want={"Sequences"},
           never={"Taylor and Maclaurin's Expansions", "UNIT 5: FINANCIAL MATHEMATICS", "Unit 3: Sequences, surds and sets"})


def _terms(p, upto):
    if p["kind"] == "arith":
        return [Fraction(p["a"] + k * p["d"]) for k in range(upto)]
    r = Fraction(*p["r"])
    return [Fraction(p["a"]) * r ** k for k in range(upto)]


def _seq_value(text):
    return up_num(text.replace(" ", ""))


def test_sequence_plot():
    m = fam("sequence_plot")
    kinds = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        kinds[p["kind"]] += 1
        n = p["n"]
        shown = _terms(p, n)
        assert all(v.denominator == 1 for v in shown), (s, shown)
        if p["kind"] == "geom":
            r = Fraction(*p["r"])
            assert r not in (0, 1, -1)
        else:
            assert p["d"] != 0
        if s in DRAWN:
            text = words(m, p)
            for v in shown:
                assert re.search(rf"(?<![\d.]){str(int(v)).replace('-', '[-−]')}(?![\d.])", text), (s, v)
        a = shown[0]
        for q in qs:
            st = q.stem
            if "common difference" in st:
                assert up_num(q.answer) == p["d"]
                continue
            if "common ratio" in st:
                assert up_num(q.answer) == Fraction(*p["r"])
                continue
            got = re.search(r"Find u(\d+)\b|find u(\d+)\b|the (\d+)(?:st|nd|rd|th) term", st)
            if got and "sum" not in st:
                k = int(next(g for g in got.groups() if g))
                assert up_num(q.answer) == _terms(p, k)[k - 1], (s, st)
                continue
            got = re.search(r"sum of the first (\d+) terms", st)
            if got:
                k = int(got.group(1))
                assert up_num(q.answer) == sum(_terms(p, k)), (s, st)
                if p["kind"] == "arith":
                    assert "n/2" in st
                else:
                    assert "(1 − r" in st
                continue
            if "sum to infinity" in st:
                r = Fraction(*p["r"])
                assert abs(r) < 1 and "a/(1 − r)" in st
                assert up_num(q.answer) == a / (1 - r)
                continue
            got = re.search(r"Which term of the sequence is equal to ([-−]?\d+)\?", st)
            if got:
                t = int(got.group(1).replace("−", "-"))
                k = int(q.answer)
                assert k > n and _terms(p, k)[k - 1] == t, (s, st)
                continue
            if "nth term" in st:
                assert q.kind == "mcq"

                def value(o, k):
                    o = o.replace("−", "-")
                    lin = re.fullmatch(r"uₙ = (-?\d*)n(?: ([+-]) (\d+))?", o)
                    if lin:
                        c = int(lin.group(1)) if lin.group(1) not in ("", "-") else (-1 if lin.group(1) == "-" else 1)
                        b = int(lin.group(3) or 0) * (-1 if lin.group(2) == "-" else 1)
                        return Fraction(c * k + b)
                    geo = re.fullmatch(r"uₙ = (-?\d+)?\((-?\d+(?:/\d+)?)\)\^(\(n - 1\)|n)", o)
                    assert geo, o
                    power = k - 1 if geo.group(3) != "n" else k
                    return int(geo.group(1) or 1) * Fraction(geo.group(2)) ** power

                one_correct(q, lambda o: all(value(o, k) == _terms(p, k)[k - 1] for k in range(1, 6)))
                continue
            if "converge" in st or "large" in st:
                r = Fraction(*p["r"])
                key = "It converges to 0" if abs(r) < 1 else "It diverges"
                assert picked(q) == key, (s, st, q.options)
                continue
            pytest.fail(f"seed {s}: an unexpected question {st}")
    assert min(kinds.values()) > 300, kinds
    up_no_line_through_text(m)


# --- coord_geometry ----------------------------------------------------------------------------------------

def test_coord_geometry_common():
    common("coord_geometry",
           want={"Unit 13: Points, straight lines and circles in 2D", "Chapter 3: Find the equation of a line with a",
                 "Conics"},
           never={"Unit 1: Lines, angles and shapes", "Unit 4: Scale drawings, bearings and trigonometry", "Unit 5: Symmetry",
                  "Points, Straight Lines, Planes and Sphere in 3D", "Vector Space of Real Numbers", "Matrices 1",
                  "Matrices 2", "Chapter 8: Circular measure", "Chapter 7: Differentiate constant multiples,"})


def cg_line(o):
    """'3x − 4y = −7' as (a, b, c)."""
    o = o.replace("−", "-").replace(" ", "")
    got = re.fullmatch(r"(-?\d*)x(?:([+-]\d*)y)?=(-?\d+)|(-?\d*)y=(-?\d+)", o)
    assert got, o

    def coef(t):
        return 1 if t in ("", "+") else -1 if t == "-" else int(t)
    if got.group(4) is not None:
        return 0, coef(got.group(4)), int(got.group(5))
    return coef(got.group(1)), coef(got.group(2)) if got.group(2) is not None else 0, int(got.group(3))


def cg_on(line, pt):
    a, b, c = line
    return a * pt[0] + b * pt[1] == c


def cg_surd(n):
    k, m, f = 1, n, 2
    while f * f <= m:
        while m % (f * f) == 0:
            m //= f * f
            k *= f
        f += 1
    return str(k) if m == 1 else f"{'' if k == 1 else k}√{m}"


def cg_point(text):
    got = re.fullmatch(r"\(([-−]?[\d/.]+), ([-−]?[\d/.]+)\)", text)
    assert got, text
    return up_num(got.group(1)), up_num(got.group(2))


def cg_conic(o):
    """'(x − 2)²/25 + (y + 1)²/16 = 1' or a circle '(x − 2)² + y² = 25' as (h, k, A, B, rhs)."""
    o = o.replace("−", "-")
    parts = re.fullmatch(r"(x²|\(x [+-] \d+\)²)(?:/(\d+))? \+ (y²|\(y [+-] \d+\)²)(?:/(\d+))? = (\d+)", o)
    assert parts, o

    def centre(t, letter):
        if t == f"{letter}²":
            return 0
        g = re.fullmatch(rf"\({letter} ([+-]) (\d+)\)²", t)
        assert g, t
        return int(g.group(2)) * (1 if g.group(1) == "-" else -1)
    return (centre(parts.group(1), "x"), centre(parts.group(3), "y"), int(parts.group(2) or 1), int(parts.group(4) or 1),
            int(parts.group(5)))


def test_coord_geometry():
    m = fam("coord_geometry")
    kinds = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        kinds[p["kind"]] += 1
        assert (p["band"] == "AL") == (p["kind"] == "line")
        pts = [p[k] for k in ("A", "B", "C", "D", "P", "Q") if k in p and isinstance(p[k], list)]
        for x, y in pts:
            assert -7 <= x <= 7 and -7 <= y <= 7
        if s in DRAWN:
            text = words(m, p)
            for k in ("A", "B", "C", "D", "P", "Q"):
                if k in p and p["kind"] != "ellipse":
                    assert k in text
        for q in qs:
            st = q.stem
            if p["kind"] in ("points", "line", "lines"):
                a, b = p["A"], p["B"]
                mab = Fraction(b[1] - a[1], b[0] - a[0])
            if "length of AB" in st:
                assert q.answer == cg_surd((b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2), (s, st, q.answer)
            elif "midpoint of AB" in st:
                assert cg_point(q.answer) == (Fraction(a[0] + b[0], 2), Fraction(a[1] + b[1], 2))
            elif "gradient of the line AB" in st:
                assert up_num(q.answer) == mab
            elif "gradient of the line CD" in st:
                c, d = p["C"], p["D"]
                assert up_num(q.answer) == Fraction(d[1] - c[1], d[0] - c[0])
            elif "perpendicular to AB" in st:
                assert up_num(q.answer) * mab == -1
            elif "line through A and B" in st:
                one_correct(q, lambda o: cg_on(cg_line(o), a) and cg_on(cg_line(o), b))
            elif "parallel, perpendicular or neither" in st:
                c, d = p["C"], p["D"]
                mcd = Fraction(d[1] - c[1], d[0] - c[0])
                rel = "parallel" if mab == mcd else "perpendicular" if mab * mcd == -1 else "neither parallel nor perpendicular"
                assert picked(q) == rel
                if rel == "parallel":
                    assert not cg_on((mab.numerator, -mab.denominator, mab.numerator * a[0] - mab.denominator * a[1]), c)
            elif "acute angle between AB and CD" in st:
                c, d = p["C"], p["D"]
                ang = math.degrees(abs(math.atan2(b[1] - a[1], b[0] - a[0]) - math.atan2(d[1] - c[1], d[0] - c[0]))) % 180
                ang = min(ang, 180 - ang)
                assert int(q.answer) == round(ang) and abs(ang % 1 - 0.5) > 0.05, (s, ang)
            elif "Which is its equation" in st:
                (cx, cy), r = p["C"], p["r"]
                assert (p["P"][0] - cx) ** 2 + (p["P"][1] - cy) ** 2 == r * r
                one_correct(q, lambda o: cg_conic(o) == (cx, cy, 1, 1, r * r))
            elif "radius of the circle" in st:
                cx, cy = p["C"]
                assert int(q.answer) ** 2 == (p["P"][0] - cx) ** 2 + (p["P"][1] - cy) ** 2
            elif "x² + y² + 2gx + 2fy + c = 0" in st:
                cx, cy = p["C"]
                r2 = (p["P"][0] - cx) ** 2 + (p["P"][1] - cy) ** 2
                assert up_num(q.answer) == cx * cx + cy * cy - r2
            elif "is the point Q inside" in st:
                cx, cy = p["C"]
                r2 = (p["P"][0] - cx) ** 2 + (p["P"][1] - cy) ** 2
                d2 = (p["Q"][0] - cx) ** 2 + (p["Q"][1] - cy) ** 2
                assert picked(q) == ("inside the circle" if d2 < r2 else "on the circle" if d2 == r2 else "outside the circle")
            elif "tangent to the circle at P" in st:
                cx, cy = p["C"]
                px, py = p["P"]
                assert up_num(q.answer) * Fraction(py - cy, px - cx) == -1
            elif "equation of the ellipse" in st:
                (h, k), A, B = p["centre"], p["a"], p["b"]
                want = (h, k, A * A, B * B, 1) if p["across"] else (h, k, B * B, A * A, 1)
                one_correct(q, lambda o: cg_conic(o) == want)
            elif "major axis" in st:
                assert int(q.answer) == 2 * max(p["a"], p["b"])
            elif "two foci" in st:
                (h, k), A, B = p["centre"], p["a"], p["b"]
                c = math.isqrt(A * A - B * B)
                assert c * c == A * A - B * B
                want = {(h - c, k), (h + c, k)} if p["across"] else {(h, k - c), (h, k + c)}
                got = {tuple(int(v) for v in g) for g in re.findall(r"\(([-−]?\d+), ([-−]?\d+)\)", q.answer.replace("−", "-"))}
                assert got == want, (s, q.answer, want)
            elif "distance from the centre of the ellipse to a focus" in st:
                assert q.answer == cg_surd(p["a"] ** 2 - p["b"] ** 2)
            elif "eccentricity" in st:
                e = math.sqrt(p["a"] ** 2 - p["b"] ** 2) / p["a"]
                ans = q.answer.replace("√", "math.sqrt(")
                ans = re.sub(r"math\.sqrt\((\d+)", r"math.sqrt(\1)", ans)
                ans = re.sub(r"(\d)math", r"\1*math", ans)
                assert abs(eval(ans) - e) < 1e-9, (s, q.answer, e)
            elif "parallel to AB" in st:
                c = p["C"]
                one_correct(q, lambda o: cg_on(cg_line(o), c) and Fraction(-cg_line(o)[0], cg_line(o)[1]) == mab)
            elif "perpendicular bisector of AB" in st:
                mid = (Fraction(a[0] + b[0], 2), Fraction(a[1] + b[1], 2))
                one_correct(q, lambda o: cg_line(o)[0] * mid[0] + cg_line(o)[1] * mid[1] == cg_line(o)[2]
                            and cg_line(o)[1] != 0 and Fraction(-cg_line(o)[0], cg_line(o)[1]) * mab == -1)
            elif "crosses the y-axis" in st:
                x0, y0 = cg_point(q.answer)
                assert x0 == 0 and y0 == a[1] - mab * a[0]
            else:
                pytest.fail(f"seed {s}: an unexpected question {st}")
    assert min(kinds.values()) > 120, kinds
    up_no_line_through_text(m)


# --- completing_square -------------------------------------------------------------------------------------

def test_completing_square_common():
    common("completing_square", want={"Quadratic Equations", "Chapter 1: Complete the square and solve"},
           never={"Projectiles", "Proof by induction", "Summation of series", "Roots of polynomial equations",
                  "Chapter 2: Functions", "Chapter 3: Find the equation of a line with a", "Unit 3: Straight lines and quadratic equations",
                  "Unit 6: Quadratic equations and inequalities"})


def cs_form(o):
    """'−2(x + 3)² − 4' as (a, h, k) for a(x − h)² + k."""
    o = o.replace("−", "-")
    got = re.fullmatch(r"(-?\d*)\(x ([+-]) (\d+)\)² ([+-]) (\d+)", o)
    assert got, o
    a = {"": 1, "-": -1}.get(got.group(1)) or int(got.group(1))
    h = int(got.group(3)) * (1 if got.group(2) == "-" else -1)
    k = int(got.group(5)) * (1 if got.group(4) == "+" else -1)
    return a, h, k


def test_completing_square():
    m = fam("completing_square")
    kinds = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        kinds[(p["kind"], p["band"])] += 1
        if p["kind"] == "area":
            k, x, area = p["k"], p["x"], p["area"]
            assert x * x + 2 * k * x == area and p["band"] in ("LS", "UP")
            if s in DRAWN:
                text = words(m, p)
                assert f"{area} cm²" in text and re.search(rf"(?<!\d){k}(?!\d)", text) and "?" in text
            for q in qs:
                st = q.stem
                if "Which equation" in st:
                    def ok(o):
                        g = re.fullmatch(r"x² \+ (\d*)x(?: \+ (\d+))? = (\d+)", o)
                        assert g, o
                        bb = int(g.group(1) or 1)
                        cc = int(g.group(2) or 0)
                        return bb == 2 * k and int(g.group(3)) - cc == area
                    one_correct(q, ok)
                elif "added at the corner" in st:
                    assert int(q.answer) == k * k
                elif "Complete the square" in st:
                    assert f"(x + {k})²" in st and int(q.answer) == (x + k) ** 2
                elif "value of x" in st:
                    assert int(q.answer) == x
                else:
                    pytest.fail(f"seed {s}: an unexpected question {st}")
            continue
        a, h, k = p["a"], p["h"], p["k"]
        assert a in {"LS": (1,), "UP": (1, -1), "AL": (1, -1, 2, -2)}[p["band"]] and h and k
        b, c = -2 * a * h, a * h * h + k
        if s in DRAWN:
            fig = m.draw(p)
            ax = fig.axes[0]
            (x0, x1), (y0, y1) = ax.get_xlim(), ax.get_ylim()
            assert x0 < h < x1 and y0 < k < y1 and x0 < 0 < x1
            vx = [ln for ln in ax.lines if ln.get_gid() == "vertex"][0].get_xydata()[0]
            assert tuple(vx) == (h, k)
            assert any(abs(a * xx * xx + b * xx + c - yy) < 1e-6 for ln in ax.lines if ln.get_gid() == "curve"
                       for xx, yy in ln.get_xydata())
            lead = "" if a == 1 else "−" if a == -1 else str(a).replace("-", "−")
            assert ax.get_title() == f"y = {lead}x² + bx + c"
            plt.close(fig)
        for q in qs:
            st = q.stem
            if "in the form" in st:
                def ok(o):
                    aa, hh, kk = cs_form(o)
                    return (aa, -2 * aa * hh, aa * hh * hh + kk) == (a, b, c)
                one_correct(q, ok)
            elif "values of b and c" in st:
                got = re.fullmatch(r"b = ([-−]?\d+), c = ([-−]?\d+)", q.answer)
                assert (int(got.group(1).replace("−", "-")), int(got.group(2).replace("−", "-"))) == (b, c)
            elif "line of symmetry" in st:
                assert q.answer.replace("−", "-") == f"x = {h}"
            elif "least value" in st or "greatest value" in st:
                assert ("least" in st) == (a > 0) and int(q.answer.replace("−", "-")) == k
            elif "range of f" in st:
                assert p["band"] == "AL"
                assert q.answer.replace("−", "-") == f"f(x) {'≥' if a > 0 else '≤'} {k}"
            elif "= 0" in st:
                assert a * k < 0
                if q.kind == "short":
                    roots = [int(v) for v in re.findall(r"-?\d+", q.answer.replace("−", "-"))]
                    assert len(roots) == 2 and roots[0] != roots[1]
                    assert all(a * r * r + b * r + c == 0 for r in roots), (s, roots)
                    assert p["band"] == "LS" or math.isqrt(-k // a) ** 2 == -k // a
                else:
                    def roots_ok(o):
                        g = re.fullmatch(r"x = (-?\d+) ± (\d*)√(\d+)|x = (-?\d+) ± (\d+)", o.replace("−", "-"))
                        assert g, o
                        if g.group(1) is not None:
                            centre, d = int(g.group(1)), int(g.group(2) or 1) * math.sqrt(int(g.group(3)))
                        else:
                            centre, d = int(g.group(4)), int(g.group(5))
                        return all(abs(a * r * r + b * r + c) < 1e-9 for r in (centre - d, centre + d))
                    one_correct(q, roots_ok)
            else:
                pytest.fail(f"seed {s}: an unexpected question {st}")
    assert min(kinds.values()) > 40, kinds
    up_no_line_through_text(m)


# --- algebraic_fraction ----------------------------------------------------------------------------------------

def af_value(expr: str, x: Fraction) -> Fraction:
    """An printed expression worked out at x, exactly: (170x + 800)/(x(x + 10)), x − 3."""
    e = expr.replace("−", "-").replace(" ", "")
    e = re.sub(r"(\d)x", r"\1*x", e)
    e = re.sub(r"x\(", "x*(", e)
    e = re.sub(r"\)\(", ")*(", e)
    assert re.fullmatch(r"[\dx+\-*/()]+", e), e
    return eval(e, {"__builtins__": {}}, {"x": x})


def test_algebraic_fraction_common():
    common("algebraic_fraction", want={"Algebraic Fractions"},
           never={"Integration", "Chapter 12: The gradient function", "Chapter 3: Simplifying expressions involving indices",
                  "Unit 4: Further solving of equations and inequalities", "Unit 3: Linear functions, equations and inequalities"})


def test_algebraic_fraction():
    m = fam("algebraic_fraction")
    subs = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        subs[(p["band"], p["sub"])] += 1
        q = qs[0]
        xs = [Fraction(7), Fraction(13), Fraction(5, 2)]
        if p["sub"] == "area":
            a, b = p["p"], p["q"]
            text = words(m, p) if s in DRAWN else None
            area = lambda x: x * x + (a + b) * x + a * b  # noqa: E731
            one_correct(q, lambda o: all(af_value(o, x) == area(x) / (x + a) for x in xs))
            if text:
                assert f"x + {a}" in text and "Area = (x²" in text
        else:
            d1, d2, k = p["d1"], p["d2"], p["k"]
            c1, c2 = (0, k) if p["faster"] == "second" else (k, 0)
            total = lambda x: Fraction(d1) / (x + c1) + Fraction(d2) / (x + c2)  # noqa: E731
            one_correct(q, lambda o: all(af_value(o, x) == total(x) for x in xs))
            if s in DRAWN:
                text = words(m, p)
                assert f"{d1} km" in text and f"{d2} km" in text and f"(x + {k}) km/h" in text
    assert len(subs) == 4 and min(subs.values()) > 150, subs
