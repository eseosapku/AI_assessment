"""Findings of the P3a whole-branch review, each pinned so it cannot come back.

The quiz asks one question per figure (lib/figure-library/pick.ts), so every question must
stand alone; and short answers are marked by exact match, so every fair form must be listed.
"""
import random
import re
import sqlite3
from pathlib import Path

import matplotlib.pyplot as plt
import pytest
from matplotlib.lines import Line2D

from figgen.families import (FAMILIES, angles, area_shapes, bearings, circle_theorem, cumulative_frequency, fraction_model,
                             frequency_table, histogram, inequality_region, line_graph, linear_graph, nets, number_line,
                             place_value, polygon_angles, quadratic_graph, ruler, sample_space)
from figgen.link import topic_index, topics_for
from figgen.tests.test_families_layout import crosses, drawn_texts

SEEDS = range(1, 1001)
MATHS = sorted(f for f, m in FAMILIES.items() if m.SUBJECT == "mathematics")


def run(m, seed):
    rng = random.Random(seed)
    p = m.sample(rng)
    return p, m.questions(p, rng)


def test_two_lines_are_named_and_never_confused():
    for s in SEEDS:
        p, qs = run(linear_graph, s)
        if p["band"] != "UP":
            continue
        other = linear_graph.equation(p["m2"], p["c2"])
        assert all("line A" in q.stem for q in qs[:5]), s
        assert other not in qs[2].options, s
        x, y = map(int, re.search(r"\((-?\d+), (-?\d+)\)", qs[0].stem).groups())
        from fractions import Fraction
        assert Fraction(p["m2"]) * x + p["c2"] != y, s  # the point given is on line A only


def test_cumulative_frequency_readings_sit_on_the_grid():
    for s in SEEDS:
        p, _ = run(cumulative_frequency, s)
        step = cumulative_frequency.CONTEXTS[p["context"]][5]
        assert all(v % step == 0 for v in [*p["quartiles"], p["extra"][0]]), (s, p["quartiles"], p["extra"])


def test_a_net_area_question_carries_its_own_size():
    for s in SEEDS:
        p, qs = run(nets, s)
        if p["band"] == "LS" and p["solid"] == "cube":
            assert f"{p['size']} cm" in qs[2].stem, s


@pytest.mark.parametrize("fid", MATHS)
def test_a_whole_number_key_accepts_the_whole_number(fid):
    m = FAMILIES[fid]
    for s in range(1, 301):
        _, qs = run(m, s)
        for q in qs:
            if q.kind == "short" and re.fullmatch(r"-?\d+\.0", q.answer):
                assert q.answer[:-2] in q.accepted, (fid, s, q.stem, q.accepted)


@pytest.mark.parametrize("fid", MATHS)
def test_a_count_accepts_its_noun(fid):
    """'15 eggs' for 15: the marker matches exactly, and a student writes the noun."""
    m = FAMILIES[fid]
    for s in range(1, 301):
        _, qs = run(m, s)
        for q in qs:
            if q.kind == "short" and "How many" in q.stem and re.fullmatch(r"\d+", q.answer):
                assert any(a.startswith(f"{q.answer} ") for a in q.accepted), (fid, s, q.stem, q.accepted)


def test_histogram_values_lie_on_gridlines():
    for s in SEEDS:
        p, _ = run(histogram, s)
        minor = histogram.minor_step(p)
        heights = p["freqs"] if p["band"] == "LS" else [f / (hi - lo) for (lo, hi), f in zip(p["classes"], p["freqs"])]
        assert all(abs(h / minor - round(h / minor)) < 1e-9 for h in heights), (s, heights, minor)


def test_grouped_tables_have_equal_class_widths():
    """With unequal widths "the modal class" means different things in different syllabuses."""
    for s in SEEDS:
        p, _ = run(frequency_table, s)
        if p["grouped"]:
            assert len({hi - lo for lo, hi in p["classes"]}) == 1, s


def test_squared_paper_questions_all_give_the_scale():
    for s in SEEDS:
        p, qs = run(area_shapes, s)
        if p["band"] == "P":
            assert all("Each square is 1" in q.stem for q in qs), s


def test_no_dashed_boundary_lies_on_an_axis():
    for s in SEEDS:
        p, _ = run(inequality_region, s)
        assert not any("m" not in c and c["k"] == 0 for c in p["conds"]), s


def test_sample_space_names_the_first_and_second():
    for s in SEEDS:
        p, qs = run(sample_space, s)
        assert f"first {p['names'][0]}" in qs[0].stem and f"second {p['names'][1]}" in qs[0].stem, s


def test_bearing_labels_are_clear_of_the_lines():
    for s in range(1, 41):
        fig = bearings.draw(bearings.sample(random.Random(s)))
        texts = [(t, b) for t, b in drawn_texts(fig) if t.get_text() != "N"]
        lines = [ln for ln in fig.axes[0].get_lines() if isinstance(ln, Line2D) and len(ln.get_xydata()) > 1]
        plt.close(fig)
        for t, box in texts:
            assert not any(crosses(ln, box, margin=2.0) for ln in lines), (s, t.get_text())


def test_primary_figures_suit_the_years_they_reach():
    for s in SEEDS:
        p, _ = run(fraction_model, s)
        if p["band"] == "P" and p["n"] not in (2, 4):
            assert fraction_model.stages(p)[0] >= 2, s  # thirds, fifths and eighths are not Stage 1
        p, _ = run(ruler, s)
        if p["band"] == "P" and (p["end"] - p["start"]) % 10:
            assert ruler.stages(p)[0] >= 4, s  # decimals of a centimetre come with decimals
        p, _ = run(number_line, s)
        if p["band"] == "P" and "." not in "".join(p["ticks"]) and int(p["ticks"][-1]) > 100:
            assert number_line.stages(p)[0] >= 3, s
        p, _ = run(place_value, s)
        number = int("".join(map(str, p["digits"])))
        if number > 20:
            assert place_value.stages(p)[0] >= 2, s  # Stage 1 counts to 20


def test_no_real_place_is_given_invented_temperatures():
    towns = {"Kigali", "Huye", "Musanze", "Lagos", "Nairobi", "Kampala", "Rubavu", "Nyagatare", "Rusizi", "Muhanga", "Rwamagana"}
    for s in SEEDS:
        p, qs = run(line_graph, s)
        assert not any(t in q.stem for t in towns for q in qs), s


def test_questions_need_the_figure():
    for s in SEEDS:
        _, (q,) = run(angles, s)
        assert "°" not in q.stem, s  # the given angles are on the figure, not in the question
        _, qs = run(polygon_angles, s)
        assert "°" not in qs[0].stem and "°" not in qs[2].stem, s
        _, qs = run(bearings, s)
        assert not re.search(r"\d", qs[1].stem), s  # the bearing back is read from the figure too


def test_a_cyclic_quadrilateral_never_has_a_right_angle():
    """At 90 degrees BD is a diameter, and the angle in a semicircle would also give x."""
    for s in range(1, 5001):
        p = circle_theorem.sample(random.Random(s))
        if p["theorem"] == "cyclic":
            assert p["g"] != 90, s


def test_quadratic_options_give_two_different_roots():
    for s in SEEDS:
        _, qs = run(quadratic_graph, s)
        for q in qs:
            for o in q.options:
                m = re.fullmatch(r"x = (-?\d+) or x = (-?\d+)", o)
                assert not m or m.group(1) != m.group(2), (s, o)


STORE = Path("C:/Users/Stephen/figure-library/figures.db")
# Topics each family must never reach: subjects it shares a concept word with but does not teach.
DENY = {
    "linear_graph": r"gradient function|derivative|calculus|integration", "travel_graph": r"differentiat|trigonometric|managing money",
    "bearings": r"\bratio\b", "vectors_grid": r"subspace", "circle_theorem": r"circumference|circular measure",
    "quadratic_graph": r"modulus|\|", "right_triangle": r"circular measure|formulae, equations", "sample_space": r"mapping",
    "frequency_table": r"sequence", "scatter_graph": r"pascal|polynomial", "number_line": r"polynomial",
    "area_shapes": r"quadratic", "fraction_model": r"simple interest",
}


@pytest.mark.skipif(not STORE.exists(), reason="needs the local staging store")
def test_no_family_reaches_a_topic_it_does_not_teach():
    db = sqlite3.connect(f"file:{STORE.as_posix()}?mode=ro", uri=True)
    db.row_factory = sqlite3.Row
    index = topic_index(db)
    names = {t["key"]: t["name"] for t in index}
    db.close()
    for fid, pattern in DENY.items():
        m = FAMILIES[fid]
        reached = set()
        for s in range(1, 301):
            reached |= set(topics_for(index, m, m.sample(random.Random(s))))
        bad = sorted(names[k] for k in reached if re.search(pattern, names[k], re.I))
        assert not bad, (fid, bad)
