"""The wave's sample sheet: every family's figures and keys, the topics it reaches, and what the wave adds."""
import types

from figgen.families import box_plot, place_value
from figgen.wave_sheet import build_wave_sheet, coverage_rows


def topic(key, band, name, concepts):
    return {"key": key, "band": band, "subject": "mathematics", "name": name, "concepts": frozenset(concepts)}


INDEX = [topic("db:1", "P", "Place value", ["mathematics.place-value"]),
         topic("db:2", "UP", "Averages and spread", ["mathematics.quartiles"]),
         topic("db:3", "P", "Shapes", ["mathematics.2d-shapes"])]


def test_every_family_shows_its_figures_keys_levels_and_topics():
    html = build_wave_sheet({"place_value": place_value, "box_plot": box_plot}, per_family=2, index=INDEX, before={})
    assert html.count("data:image/png;base64,") == 4
    assert "Place value" in html and "Averages and spread" in html  # the topics each reaches
    assert "Primary" in html and "Upper Secondary" in html
    assert 'class="key"' in html or "Answer:" in html  # keys marked
    assert "<title>" in html and "prefers-color-scheme: dark" in html


def test_a_level_that_reaches_no_topic_is_flagged():
    lonely = types.SimpleNamespace(**{k: getattr(place_value, k) for k in ("ID", "KIND", "SUBJECT", "sample", "draw", "questions")},
                                   BANDS=("P", "LS"), CONCEPTS=place_value.CONCEPTS)
    html = build_wave_sheet({"place_value": lonely}, per_family=1, index=INDEX, before={})
    assert "reaches no Lower Secondary topic" in html


def test_coverage_counts_topics_by_how_many_families_reach_them():
    rows = coverage_rows({"place_value": place_value, "box_plot": box_plot}, INDEX, before={"db:1": 7})
    # before: db:1 had 7 sources, the others none; with the wave: db:1 and db:2 reached by one family each.
    assert rows == [("No family", 2, 1), ("1-2", 0, 1), ("3-5", 0, 0), ("6 or more", 1, 1)]


def test_coverage_counts_only_the_years_a_family_suits():
    stage_one = [dict(INDEX[0], stage=1)] + INDEX[1:]
    late = types.SimpleNamespace(**{k: getattr(place_value, k) for k in ("ID", "KIND", "SUBJECT", "BANDS", "CONCEPTS", "sample", "draw", "questions")},
                                 stages=lambda p: (5, 6))
    rows = coverage_rows({"place_value": late}, stage_one, before={})
    assert rows[0] == ("No family", 3, 3)  # a Stage 1 place value topic is not reached by Stage 5-6 charts
