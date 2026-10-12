import json
import sqlite3

import pytest

from figgen.core import Question
from figgen.store import REPO, delete_family, has_figure, open_store, save_drawn, topic


def add_topic(db, key="db:410"):
    db.execute("INSERT INTO topics (key, source, book, subject, band, name) VALUES (?, 'rwanda', 'Book', 'mathematics', 'LS', 'A topic')", (key,))
    db.commit()


def save(db, seed=1, family="bar_chart", topics=("db:410",)):
    save_drawn(db, figure_id=f"drawn/{family}/{seed}", family=family, kind="graph.bar", subject="mathematics", band="LS",
               topics=list(topics), seed=seed, spec={"values": [1, 2]},
               questions=[Question("short", "How many?", "3", [], ["3"]), Question("mcq", "Which?", "1", ["a", "b", "c"], [])],
               asset=f"assets/drawn/{family}/{seed}.svg", preview=f"assets/drawn/{family}/{seed}.png", width=800, height=600)


def test_refuses_to_live_inside_the_repository():
    with pytest.raises(ValueError, match="outside the repository"):
        open_store(REPO / "data" / "figures.db")


def test_creates_the_shared_tables(tmp_path):
    db = open_store(tmp_path / "figures.db")
    names = {r[0] for r in db.execute("SELECT name FROM sqlite_master WHERE type = 'table'")}
    assert {"topics", "spend", "figures", "figure_topics", "figure_questions", "reviews"} <= names
    assert db.execute("PRAGMA busy_timeout").fetchone()[0] == 10000
    assert db.execute("PRAGMA foreign_keys").fetchone()[0] == 1


def test_saves_a_figure_with_its_questions_and_topics(tmp_path):
    db = open_store(tmp_path / "figures.db")
    add_topic(db)
    save(db)
    f = db.execute("SELECT * FROM figures WHERE id = 'drawn/bar_chart/1'").fetchone()
    assert (f["origin"], f["status"], json.loads(f["spec"])) == ("drawn", "stored", {"values": [1, 2]})
    qs = db.execute("SELECT id, n, kind, answer, options, accepted, model FROM figure_questions ORDER BY n").fetchall()
    assert [q["id"] for q in qs] == ["drawn/bar_chart/1#1", "drawn/bar_chart/1#2"]
    assert json.loads(qs[1]["options"]) == ["a", "b", "c"] and qs[0]["model"] == "code"
    assert db.execute("SELECT topic_key FROM figure_topics").fetchone()[0] == "db:410"
    assert has_figure(db, "drawn/bar_chart/1") and not has_figure(db, "drawn/bar_chart/2")


def test_saving_again_replaces_and_clears_old_reviews(tmp_path):
    # A family fixed after a failed review is redrawn; the old verdict must not stand.
    db = open_store(tmp_path / "figures.db")
    add_topic(db)
    save(db)
    db.execute("UPDATE figures SET status = 'rejected', reason = 'key wrong'")
    db.execute("INSERT INTO reviews (job, figure_id, model, pass, detail, at) VALUES ('p1a-review', 'drawn/bar_chart/1', 'm', 0, '{}', 'now')")
    db.commit()
    save(db)
    assert db.execute("SELECT COUNT(*) FROM figure_questions").fetchone()[0] == 2
    assert db.execute("SELECT COUNT(*) FROM reviews").fetchone()[0] == 0
    assert tuple(db.execute("SELECT status, reason FROM figures").fetchone()) == ("stored", None)


def test_an_unknown_topic_saves_nothing(tmp_path):
    db = open_store(tmp_path / "figures.db")
    with pytest.raises(sqlite3.IntegrityError):
        save(db, topics=("db:999",))
    assert not has_figure(db, "drawn/bar_chart/1")
    with pytest.raises(KeyError):
        topic(db, "db:999")


def test_delete_family_removes_everything_and_names_the_files(tmp_path):
    db = open_store(tmp_path / "figures.db")
    add_topic(db)
    save(db, 1)
    save(db, 2)
    save(db, 1, family="pie_chart")
    files = delete_family(db, "bar_chart")
    assert sorted(files) == sorted(["assets/drawn/bar_chart/1.svg", "assets/drawn/bar_chart/1.png",
                                    "assets/drawn/bar_chart/2.svg", "assets/drawn/bar_chart/2.png"])
    assert db.execute("SELECT COUNT(*) FROM figures").fetchone()[0] == 1
    assert db.execute("SELECT COUNT(*) FROM figure_questions").fetchone()[0] == 2
