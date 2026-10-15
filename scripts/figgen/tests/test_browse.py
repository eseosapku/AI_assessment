import json

from figgen.browse import asset_path, families, figure, figures, summary, topics
from figgen.core import Question
from figgen.store import open_store, save_drawn


def store(tmp_path):
    db = open_store(tmp_path / "figures.db")
    db.executemany("INSERT INTO topics (key, source, book, subject, band, name) VALUES (?, 'rwanda', ?, ?, ?, ?)",
                   [("db:1", "Maths S1", "mathematics", "LS", "Bar charts"),
                    ("db:2", "Maths S1", "mathematics", "LS", "Angles"),
                    ("db:3", "Biology S2", "biology", "LS", "The heart")])
    for seed in range(1, 6):
        draw(db, "bar_chart", seed, "mathematics", ["db:1"])
    draw(db, "heart_diagram", 1, "biology", ["db:3"])
    draw(db, "heart_diagram", 2, "biology", ["db:3"])
    db.execute("UPDATE figures SET status = 'approved' WHERE id <> 'drawn/heart_diagram/2'")
    db.commit()
    return db


def draw(db, family, seed, subject, topic_keys):
    save_drawn(db, figure_id=f"drawn/{family}/{seed}", family=family, kind="graph.bar", subject=subject, band="LS",
               topics=topic_keys, seed=seed, spec={},
               questions=[Question("short", f"How many? ({seed})", "3", [], ["3", "three"]),
                          Question("mcq", "Which bar is tallest?", "1", ["A", "B", "C"], [], "B is 7 tall.")],
               asset=f"assets/drawn/{family}/{seed}.svg", preview=f"assets/drawn/{family}/{seed}.png", width=800, height=600)


def test_summary_counts_only_approved_figures_and_their_questions(tmp_path):
    s = summary(store(tmp_path))
    assert (s["figures"], s["questions"]) == (6, 12)
    assert s["subjects"] == [{"subject": "mathematics", "figures": 5}, {"subject": "biology", "figures": 1}]


def test_families_and_topics_count_approved_figures_only(tmp_path):
    db = store(tmp_path)
    assert families(db, "biology") == [{"family": "heart_diagram", "figures": 1}]
    rows = topics(db, "mathematics")
    assert [(t["key"], t["figures"]) for t in rows] == [("db:2", 0), ("db:1", 5)]  # alphabetical by name
    assert rows[1]["book"] == "Maths S1" and rows[1]["band"] == "LS"


def test_figures_filter_by_family_or_topic_and_paginate(tmp_path):
    db = store(tmp_path)
    page = figures(db, family="bar_chart", page=1, per=2)
    assert page["total"] == 5 and [f["id"] for f in page["items"]] == ["drawn/bar_chart/3", "drawn/bar_chart/4"]
    assert page["items"][0]["preview"] == "assets/drawn/bar_chart/3.png"
    assert figures(db, topic="db:3")["total"] == 1  # the unapproved heart is never shown
    assert figures(db, subject="biology", band="AL")["total"] == 0


def test_a_real_image_is_found_by_its_origin(tmp_path):
    db = store(tmp_path)
    db.execute("""INSERT INTO figures (id, origin, kind, subject, band, asset, preview, credit, source_url, spec, status, created_at)
                  VALUES ('openstax/9', 'openstax', 'photo', 'biology', 'AL', 'assets/openstax/9.webp',
                          'assets/openstax/9-512.jpg', '', 'https://openstax.org/x', '{"source": "Biology 2e, 4.1"}',
                          'approved', 'now')""")
    db.commit()
    assert {"family": "openstax", "figures": 1} in families(db, "biology")
    assert [f["id"] for f in figures(db, family="openstax")["items"]] == ["openstax/9"]
    assert figure(db, "openstax/9")["source"] == "Biology 2e, 4.1"


def test_figure_shows_its_questions_in_order_with_the_key(tmp_path):
    f = figure(store(tmp_path), "drawn/bar_chart/2")
    assert f["family"] == "bar_chart" and f["topics"] == [{"key": "db:1", "name": "Bar charts", "book": "Maths S1"}]
    short, mcq = f["questions"]
    assert (short["stem"], short["answer"], short["accepted"]) == ("How many? (2)", "3", ["3", "three"])
    assert (mcq["options"], mcq["answer"], mcq["explanation"]) == (["A", "B", "C"], "1", "B is 7 tall.")


def test_figure_hides_what_is_not_approved(tmp_path):
    db = store(tmp_path)
    assert figure(db, "drawn/heart_diagram/2") is None
    assert figure(db, "drawn/nothing/1") is None


def test_asset_path_stays_inside_the_library_and_serves_images_only(tmp_path):
    (tmp_path / "assets" / "drawn").mkdir(parents=True)
    png = tmp_path / "assets" / "drawn" / "1.png"
    png.write_bytes(b"x")
    (tmp_path / "figures.db").write_bytes(b"x")
    assert asset_path(tmp_path, "assets/drawn/1.png") == png.resolve()
    assert asset_path(tmp_path, "assets/drawn/2.png") is None  # missing
    assert asset_path(tmp_path, "figures.db") is None  # not an image
    assert asset_path(tmp_path, "../outside.png") is None
    assert asset_path(tmp_path, "assets/../../outside.png") is None
    assert json.dumps(str(asset_path(tmp_path, "assets/drawn/1.png")))  # a plain path the server can open
