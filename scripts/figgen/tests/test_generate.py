import json
import random

import pytest

from figgen.families import FAMILIES, timeline
from figgen.generate import generate_family
from figgen.pilot import BY_PARAMS, PILOT, TIMELINE, topics_for
from figgen.store import open_store

# The pilot's topics as they are in the staging store (checked 2026-10-12).
TOPICS = {
    "db:410": ("mathematics", "LS"), "db:141": ("mathematics", "UP"), "db:153": ("mathematics", "UP"),
    "db:4295": ("mathematics", "LS"), "db:489": ("mathematics", "P"), "db:111": ("biology", "UP"),
    "db:3856": ("biology", "UP"), "db:1101": ("geography", "LS"), "db:1115": ("geography", "LS"),
    "db:1105": ("geography", "LS"), "db:1112": ("geography", "LS"), "waec:Economics:1": ("economics", "UP"),
    "jamb:Commerce:2": ("business", "UP"), "checkpoint:lower-secondary:0876:0": ("english", "LS"),
    "db:162": ("history", "UP"), "db:1057": ("history", "UP"), "db:1884": ("physics", "LS"),
}


@pytest.fixture
def db(tmp_path):
    store = open_store(tmp_path / "figures.db")
    store.executemany("INSERT INTO topics (key, source, book, subject, band, name) VALUES (?, 'test', 'Book', ?, ?, ?)",
                      [(k, s, b, k) for k, (s, b) in TOPICS.items()])
    store.commit()
    return store


def test_every_family_has_pilot_topics_at_its_level():
    # A family naming its concepts reaches its topics by concept (link.py); the rest keep the pilot's.
    by_hand = {f: m for f, m in FAMILIES.items() if not hasattr(m, "CONCEPTS")}
    assert set(by_hand) <= set(PILOT) | set(BY_PARAMS)
    assert set(TIMELINE) == set(timeline.SETS)
    for fid, m in by_hand.items():
        for s in range(1, 21):
            keys = topics_for(fid, m.sample(random.Random(s)))
            assert keys and all(k in TOPICS for k in keys), fid
            assert TOPICS[keys[0]][1] in m.BANDS, f"{fid} cannot draw for {keys[0]}"


def test_every_figure_spec_survives_json():
    # The spec is stored so any figure can be redrawn exactly (spec 5.2).
    for fid, m in FAMILIES.items():
        for s in range(1, 21):
            p = m.sample(random.Random(s))
            assert json.loads(json.dumps(p)) == p, fid


# A family that keeps the pilot's hand-made topics: climate graphs for Geography LS, db:1115.
BY_HAND = "climate_graph"


def test_draws_distinct_figures_and_their_files(db, tmp_path):
    lib = tmp_path / "lib"
    r = generate_family(db, lib, FAMILIES[BY_HAND], 5)
    assert (r["have"], r["drawn"]) == (5, 5)
    rows = db.execute("SELECT id, spec, asset, preview, width, band, subject FROM figures").fetchall()
    assert len(rows) == 5 and len({row["spec"] for row in rows}) == 5
    for row in rows:
        assert (lib / row["asset"]).read_text(encoding="utf-8").lstrip().startswith("<?xml")
        assert (lib / row["preview"]).read_bytes()[:4] == b"\x89PNG" and row["width"] > 100
        assert (row["band"], row["subject"]) == ("LS", "geography")
    assert db.execute("SELECT COUNT(*) FROM figure_questions").fetchone()[0] == 15  # three questions each
    assert db.execute("SELECT COUNT(*) FROM figure_topics WHERE topic_key = 'db:1115'").fetchone()[0] == 5


def test_a_second_run_keeps_what_is_there(db, tmp_path):
    lib = tmp_path / "lib"
    generate_family(db, lib, FAMILIES[BY_HAND], 5)
    again = generate_family(db, lib, FAMILIES[BY_HAND], 7)
    assert (again["have"], again["drawn"]) == (7, 2)
    assert db.execute("SELECT COUNT(*) FROM figures").fetchone()[0] == 7
    assert db.execute("SELECT COUNT(*) FROM figure_questions").fetchone()[0] == 21


def test_redo_redraws_the_family_and_drops_its_reviews(db, tmp_path):
    lib = tmp_path / "lib"
    generate_family(db, lib, FAMILIES[BY_HAND], 3)
    db.execute("INSERT INTO reviews (job, figure_id, model, pass, detail, at) SELECT 'p1a-review', id, 'm', 0, '{}', 'now' FROM figures")
    db.commit()
    r = generate_family(db, lib, FAMILIES[BY_HAND], 3, redo=True)
    assert r["drawn"] == 3
    assert db.execute("SELECT COUNT(*) FROM reviews").fetchone()[0] == 0


def test_refuses_a_topic_outside_the_family_levels(db, tmp_path):
    db.execute("UPDATE topics SET band = 'AL' WHERE key = 'db:1115'")
    db.commit()
    with pytest.raises(ValueError, match="db:1115"):
        generate_family(db, tmp_path / "lib", FAMILIES[BY_HAND], 1)


def test_timeline_figures_go_to_the_topic_of_their_set(db, tmp_path):
    generate_family(db, tmp_path / "lib", FAMILIES["timeline"], 6)
    rows = db.execute("SELECT f.spec, t.topic_key FROM figures f JOIN figure_topics t ON t.figure_id = f.id").fetchall()
    assert len(rows) == 6
    for row in rows:
        assert row["topic_key"] == TIMELINE[json.loads(row["spec"])["title"]][0]


def test_scale_readings_go_to_the_subject_of_their_instrument():
    # A measuring cylinder is a science skill; the review rejected it in a geography topic.
    for s in range(1, 40):
        params = FAMILIES["scale_reading"].sample(random.Random(s))
        assert topics_for("scale_reading", params) == (["db:1101"] if params["kind"] == "thermometer" else ["db:1884"])


def concept_family(bands=("LS",), concepts=("mathematics.pie-charts",)):
    """bar_chart's drawing, declared as a family linked by concept."""
    import types
    from figgen.families import bar_chart
    return types.SimpleNamespace(ID="concept_test", KIND=bar_chart.KIND, SUBJECT="mathematics", BANDS=bands, CONCEPTS=concepts,
                                 sample=lambda rng: {k: v for k, v in bar_chart.sample(rng).items() if k != "band"},
                                 draw=bar_chart.draw, questions=bar_chart.questions)


def mapped(db):
    db.execute("INSERT INTO topics (key, source, book, subject, band, name) VALUES ('db:900', 'test', 'Book', 'mathematics', 'LS', 'Pie charts')")
    db.execute("INSERT INTO topic_map (topic_key, concepts, kinds, terms, visual, dropped, model, mapped_at) "
               "VALUES ('db:900', '[\"mathematics.pie-charts\"]', '[]', '[]', 'high', 0, 'm', 'now')")
    db.execute("INSERT INTO concepts (id, subject, name, bands) VALUES ('mathematics.pie-charts', 'mathematics', 'Pie charts', '[]')")
    db.commit()
    return db


def test_a_family_with_concepts_is_linked_by_concept_at_its_instances_level(db, tmp_path):
    mapped(db)
    r = generate_family(db, tmp_path / "lib", concept_family(), 3)
    assert r["have"] == 3
    rows = db.execute("SELECT f.band, f.subject, ft.topic_key FROM figures f JOIN figure_topics ft ON ft.figure_id = f.id").fetchall()
    assert [tuple(row) for row in rows] == [("LS", "mathematics", "db:900")] * 3


def test_an_instance_reaching_no_topic_is_not_stored(db, tmp_path):
    mapped(db)
    with pytest.raises(RuntimeError, match="only 0"):
        generate_family(db, tmp_path / "lib", concept_family(bands=("P",)), 3, max_seeds=5)
    assert db.execute("SELECT COUNT(*) FROM figures").fetchone()[0] == 0


def test_a_family_naming_an_unknown_concept_is_refused(db, tmp_path):
    mapped(db)
    with pytest.raises(ValueError, match="mathematics.nope"):
        generate_family(db, tmp_path / "lib", concept_family(concepts=("mathematics.pie-charts", "mathematics.nope")), 1)
