"""Findings of the P3b blind review (job p3b-blind), each pinned so it cannot come back."""
import random
import re

import matplotlib.pyplot as plt
import pytest

from matplotlib.text import Annotation

from figgen.families import (FAMILIES, cuboid, cumulative_frequency, histogram, linear_graph, pictogram, quadratic_graph,
                             ruler, sample_space, travel_graph, vectors_grid)
from figgen.tests.test_families_layout import drawn_texts

SEEDS = range(1, 501)
MATHS = sorted(f for f, m in FAMILIES.items() if m.SUBJECT == "mathematics")


def run(m, seed):
    rng = random.Random(seed)
    p = m.sample(rng)
    return p, m.questions(p, rng)


def test_curve_estimates_accept_a_small_square_either_way():
    """A reading from a curve is an estimate: mark schemes allow one small square either way."""
    for s in SEEDS:
        p, (median, iqr, more, fewer) = run(cumulative_frequency, s)
        step = cumulative_frequency.CONTEXTS[p["context"]][5]
        m = int(median.answer)
        assert {str(m - step), str(m + step)} <= set(median.accepted)
        i = int(iqr.answer)
        assert {str(i - 2 * step), str(i + 2 * step)} <= set(iqr.accepted)  # two readings, two errors
        unit_y = p["total"] // 20
        assert {str(int(more.answer) - unit_y), str(int(more.answer) + unit_y)} <= set(more.accepted)


def test_curve_readings_ask_for_a_whole_unit_and_take_a_half():
    """A reading from a curve lands between gridlines: the stem says how to give it, and a half-unit
    reading inside the slack ("20.5" for 21) is marked right, as a mark scheme's range would."""
    for s in SEEDS:
        p, (median, iqr, *_) = run(cumulative_frequency, s)
        unit = cumulative_frequency.CONTEXTS[p["context"]][1]
        for q in (median, iqr):
            assert "to the nearest" in q.stem, q.stem
            v = int(q.answer)
            assert {f"{v - 0.5:g}", f"{v + 0.5:g}", f"{v + 0.5:g} {unit}"} <= set(q.accepted), (s, q.accepted)


def test_the_place_is_named_on_a_travel_graph():
    for s in range(1, 41):
        p = travel_graph.sample(random.Random(s))
        fig = travel_graph.draw(p)
        texts = [t.get_text() for t, _ in drawn_texts(fig)]
        plt.close(fig)
        assert p["place"].capitalize() in texts, (s, texts)


def test_a_cuboid_surface_area_question_says_it_is_closed():
    for s in SEEDS:
        p, qs = run(cuboid, s)
        if p["band"] == "LS":
            assert "including the top" in qs[1].stem


def test_a_line_question_reads_well_and_gives_nothing_away():
    for s in SEEDS:
        p, qs = run(linear_graph, s)
        assert "of its" not in qs[0].stem
        given = tuple(map(int, re.search(r"\((-?\d+), (-?\d+)\)", qs[0].stem).groups()))
        x_when = int(qs[4].answer)
        v = int(re.search(r"is y = (-?\d+)\?", qs[4].stem).group(1))
        assert given != (x_when, v), s  # the point given is not the answer to another question


PLURALS = r"\b1 (books|hours|years|students|eggs|mangoes|patients|bottles|trees|goals|people|brothers|cars|days)\b"


@pytest.mark.parametrize("fid", MATHS)
def test_one_of_a_thing_is_singular(fid):
    for s in range(1, 401):
        _, qs = run(FAMILIES[fid], s)
        for q in qs:
            assert not re.search(PLURALS, q.stem), (fid, s, q.stem)
            assert not re.search(r"\ba [aeiou]", q.stem), (fid, s, q.stem)


def test_a_ruler_object_is_one_the_figure_draws():
    for s in SEEDS:
        p, _ = run(ruler, s)
        assert p["object"] in ruler.DRAWN


def test_the_y_intercept_is_asked_only_when_the_y_axis_is_drawn():
    for s in SEEDS:
        p, qs = run(quadratic_graph, s)
        x0, x1, *_ = quadratic_graph._range(p)
        if any("cross the y-axis" in q.stem for q in qs):
            assert x0 <= 0 <= x1, (s, p)


def test_spinners_and_dice_are_said_to_be_fair():
    for s in SEEDS:
        _, qs = run(sample_space, s)
        assert "fair" in qs[0].stem


def test_villages_and_classes_run_in_order():
    for s in SEEDS:
        p, _ = run(pictogram, s)
        rows = pictogram.CONTEXTS[p["context"]][4]
        assert p["cats"] == rows[:len(p["cats"])], p["cats"]


def test_a_vector_arrow_ends_on_its_grid_point():
    """matplotlib stops an arrow two points short of each end; on a grid that reads as off the point."""
    for s in range(1, 21):
        fig = vectors_grid.draw(vectors_grid.sample(random.Random(s)))
        arrows = [a for a in fig.axes[0].texts if isinstance(a, Annotation)]
        plt.close(fig)
        assert arrows and all(a.arrow_patch.shrinkA == 0 and a.arrow_patch.shrinkB == 0 for a in arrows), s


def test_a_histogram_axis_names_one_value():
    """Exam papers label the axis "Age (a years)", not "Ages (a years)"."""
    for s in range(1, 41):
        fig = histogram.draw(histogram.sample(random.Random(s)))
        label = fig.axes[0].get_xlabel()
        plt.close(fig)
        assert label.split(" ")[0] in {"Height", "Time", "Mass", "Age"}, label
