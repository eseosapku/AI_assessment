import json
import random

import pytest

from figgen.families import FAMILIES, timeline
from figgen.generate import generate_family
from figgen.pilot import PILOT, TIMELINE, topics_for
from figgen.store import open_store

# The pilot's topics as they are in the staging store (checked 2026-10-12).
TOPICS = {
    "db:410": ("mathematics", "LS"), "db:141": ("mathematics", "UP"), "db:153": ("mathematics", "UP"),
    "db:4295": ("mathematics", "LS"), "db:489": ("mathematics", "P"), "db:111": ("biology", "UP"),
    "db:3856": ("biology", "UP"), "db:1101": ("geography", "LS"), "db:1115": ("geography", "LS"),
    "db:1105": ("geography", "LS"), "db:1112": ("geography", "LS"), "waec:Economics:1": ("economics", "UP"),
    "jamb:Commerce:2": ("business", "UP"), "checkpoint:lower-secondary:0876:0": ("english", "LS"),
    "db:162": ("history", "UP"), "db:1057": ("history", "UP"),
}


@pytest.fixture
def db(tmp_path):
    store = open_store(tmp_path / "figures.db")
    store.executemany("INSERT INTO topics (key, source, book, subject, band, name) VALUES (?, 'test', 'Book', ?, ?, ?)",
                      [(k, s, b, k) for k, (s, b) in TOPICS.items()])
    store.commit()
    return store


def test_every_family_has_pilot_topics_at_its_level():
    assert set(PILOT) | {"timeline"} == set(FAMILIES)
    assert set(TIMELINE) == set(timeline.SETS)
    for fid, m in FAMILIES.items():
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


def test_draws_distinct_figures_and_their_files(db, tmp_path):
    lib = tmp_path / "lib"
    r = generate_family(db, lib, FAMILIES["bar_chart"], 5)
    assert (r["have"], r["drawn"]) == (5, 5)
    rows = db.execute("SELECT id, spec, asset, preview, width, band, subject FROM figures").fetchall()
    assert len(rows) == 5 and len({row["spec"] for row in rows}) == 5
    for row in rows:
        assert (lib / row["asset"]).read_text(encoding="utf-8").lstrip().startswith("<?xml")
        assert (lib / row["preview"]).read_bytes()[:4] == b"\x89PNG" and row["width"] > 100
        assert (row["band"], row["subject"]) == ("LS", "mathematics")
    assert db.execute("SELECT COUNT(*) FROM figure_questions").fetchone()[0] == 15  # three questions each
    assert db.execute("SELECT COUNT(*) FROM figure_topics WHERE topic_key = 'db:410'").fetchone()[0] == 5


def test_a_second_run_keeps_what_is_there(db, tmp_path):
    lib = tmp_path / "lib"
    generate_family(db, lib, FAMILIES["bar_chart"], 5)
    again = generate_family(db, lib, FAMILIES["bar_chart"], 7)
    assert (again["have"], again["drawn"]) == (7, 2)
    assert db.execute("SELECT COUNT(*) FROM figures").fetchone()[0] == 7
    assert db.execute("SELECT COUNT(*) FROM figure_questions").fetchone()[0] == 21


def test_redo_redraws_the_family_and_drops_its_reviews(db, tmp_path):
    lib = tmp_path / "lib"
    generate_family(db, lib, FAMILIES["bar_chart"], 3)
    db.execute("INSERT INTO reviews (job, figure_id, model, pass, detail, at) SELECT 'p1a-review', id, 'm', 0, '{}', 'now' FROM figures")
    db.commit()
    r = generate_family(db, lib, FAMILIES["bar_chart"], 3, redo=True)
    assert r["drawn"] == 3
    assert db.execute("SELECT COUNT(*) FROM reviews").fetchone()[0] == 0


def test_refuses_a_topic_outside_the_family_levels(db, tmp_path):
    db.execute("UPDATE topics SET band = 'AL' WHERE key = 'db:410'")
    db.commit()
    with pytest.raises(ValueError, match="db:410"):
        generate_family(db, tmp_path / "lib", FAMILIES["bar_chart"], 1)


def test_timeline_figures_go_to_the_topic_of_their_set(db, tmp_path):
    generate_family(db, tmp_path / "lib", FAMILIES["timeline"], 6)
    rows = db.execute("SELECT f.spec, t.topic_key FROM figures f JOIN figure_topics t ON t.figure_id = f.id").fetchall()
    assert len(rows) == 6
    for row in rows:
        assert row["topic_key"] == TIMELINE[json.loads(row["spec"])["title"]][0]
