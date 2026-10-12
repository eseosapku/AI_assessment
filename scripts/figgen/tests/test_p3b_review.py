"""Findings of the P3b blind review (job p3b-blind), each pinned so it cannot come back."""
import random
import re

import matplotlib.pyplot as plt
import pytest

from matplotlib.text import Annotation

from figgen.families import (FAMILIES, cuboid, cumulative_frequency, histogram, linear_graph, parallel_lines, pattern_sequence,
                             pictogram, quadratic_graph, ruler, sample_space, transformation, travel_graph, vectors_grid)
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


def test_more_than_a_boundary_is_said_as_the_context_says_it():
    """"Took more than 5 minutes", "are more than 20 cm tall": never "are more than 5 minutes"."""
    for s in SEEDS:
        _, qs = run(histogram, s)
        assert re.search(r"(are more than \d+ cm tall|took more than \d+ minutes|weigh more than \d+ kg|are more than \d+ years old)\?$",
                         qs[3].stem), qs[3].stem


ONE_VARIABLE = ("box_plot", "cumulative_frequency", "stem_leaf")


@pytest.mark.parametrize("fid", ONE_VARIABLE)
def test_one_variable_figures_stay_out_of_two_variable_chapters(fid):
    """A shared word like "dispersion" pulled box plots into Bivariate Statistics (the quiz check, P3b)."""
    avoid = FAMILIES[fid].AVOID
    for name in ("Bivariate Statistics", "Unit 4: Scatter diagrams and correlation", "Regression lines", "Random Variables"):
        assert re.search(avoid, name, re.I), name
    for name in ("Unit 14: Measures of dispersion", "Statistics", "Unit 3: Averages and measures of spread", "Statistics advanced"):
        assert not re.search(avoid, name, re.I), name


def test_a_two_way_table_stays_out_of_averages_and_spread():
    avoid = FAMILIES["two_way_table"].AVOID
    for name in ("Unit 14: Measures of dispersion", "Unit 3: Averages and measures of spread", "Unit 4: Scatter diagrams and correlation",
                 "Random Variables"):
        assert re.search(avoid, name, re.I), name
    for name in ("Bivariate Statistics", "Probability", "Statistics and probability", "16 Interpreting results",
                 "Conditional Probability and Bayes Theorem", "Chapter 12: Mutually exclusive events"):
        assert not re.search(avoid, name, re.I), name



# --- The final review (job p3b-blind): sub-types whose reviewed figures all failed -----------------

def _points(piece):
    if piece[0] == "chair":
        return [piece[1:]]
    return list(piece) if isinstance(piece[0], tuple) else [piece]


def test_every_piece_of_a_pattern_lies_inside_the_space_drawn_for_it():
    """The L of dots had no space of its own and fell back to one unit high: its upright arm was cut
    off, so the drawing showed 5 dots where the key counted 7."""
    kinds = set()
    for s in range(1, 3001):
        p = pattern_sequence.sample(random.Random(s))
        kinds.add(p["kind"])
        for n in (1, 2, 3):
            x0, x1, y0, y1 = pattern_sequence._extent(p, n)
            for x, y in (pt for piece in pattern_sequence.pieces(p, n) for pt in _points(piece)):
                assert x0 - 1e-9 <= x <= x1 + 1e-9 and y0 - 1e-9 <= y <= y1 + 1e-9, (p["kind"], n, (x, y))
    assert kinds == set(pattern_sequence.KINDS)


def test_vertically_opposite_angles_are_acute():
    """Two obtuse arcs round one point close into a ring, and x could be either side (both reviewed failed)."""
    seen = 0
    for s in SEEDS:
        p = parallel_lines.sample(random.Random(s))
        if p["fact"] == "vertically opposite":
            seen += 1
            t = p["theta"]
            assert {"ar": t, "bl": t, "al": 180 - t, "br": 180 - t}[p["given"][1]] < 90, p
    assert seen > 50


def test_the_corner_asked_about_is_not_also_a_corner_of_the_image():
    """When the image shares a corner with the shape, "this corner on shape D" can be read as the shared one."""
    for s in SEEDS:
        p, qs = run(transformation, s)
        x, y = map(int, re.search(r"corner at \((-?\d+), (-?\d+)\)", qs[1].stem).groups())
        assert (x, y) not in {tuple(v) for v in p["B"]}, (s, qs[1].stem)


def _numbers(forms):
    return {float(re.match(r"-?[\d.]+", a).group()) for a in forms}


def test_a_curve_reading_window_takes_in_no_wrong_method_answer():
    """One small square either way must not reach "none", the cumulative reading itself, the position
    n/2, or a quartile read off and left: a mark wrongly given teaches a wrong method (final review)."""
    for s in SEEDS:
        p, (median, iqr, more, fewer) = run(cumulative_frequency, s)
        n, (q1, m, q3), (t, ct) = p["total"], p["quartiles"], p["extra"]
        for q, wrong in ((median, {n / 2, q1, q3}), (iqr, {q1, q3, m, n / 2}), (more, {0, ct, n}), (fewer, {q1})):
            assert not _numbers(q.accepted) & wrong, (s, q.stem, sorted(_numbers(q.accepted) & wrong))


def test_curve_readings_carry_their_tolerance():
    """The slack is stated on the question, so the review allows it there and nowhere else."""
    for s in range(1, 101):
        p, (median, iqr, more, fewer) = run(cumulative_frequency, s)
        step, unit_y = cumulative_frequency.CONTEXTS[p["context"]][5], p["total"] // 20
        assert (median.tolerance, iqr.tolerance, more.tolerance, fewer.tolerance) == (step, 2 * step, unit_y, unit_y)
    for fid in MATHS:
        if fid != "cumulative_frequency":
            for s in range(1, 21):
                assert all(q.tolerance == 0 for q in run(FAMILIES[fid], s)[1]), fid


def test_a_question_tolerance_is_stored_and_an_old_store_gains_the_column(tmp_path):
    import sqlite3
    from figgen.core import Question
    from figgen.store import SCHEMA_FILE, open_store, save_drawn
    old = tmp_path / "old" / "figures.db"
    old.parent.mkdir()
    raw = sqlite3.connect(old)
    raw.executescript(SCHEMA_FILE.read_text(encoding="utf-8").replace("  tolerance REAL NOT NULL DEFAULT 0,\n", ""))
    raw.close()
    db = open_store(old)
    assert "tolerance" in {r[1] for r in db.execute("PRAGMA table_info(figure_questions)")}
    db.execute("INSERT INTO topics (key, source, book, subject, band, name) VALUES ('t:1', 'test', 'Book', 'mathematics', 'UP', 'Statistics')")
    save_drawn(db, figure_id="drawn/x/1", family="x", kind="graph.line", subject="mathematics", band="UP", topics=["t:1"], seed=1,
               spec={}, questions=[Question("short", "s", "14", [], ["14"], "", tolerance=2)], asset="a.svg", preview="a.png",
               width=1, height=1)
    assert db.execute("SELECT tolerance FROM figure_questions").fetchone()[0] == 2
