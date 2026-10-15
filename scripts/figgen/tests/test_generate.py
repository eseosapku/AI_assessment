import json
import random

import pytest

from figgen.families import FAMILIES
from figgen.generate import generate_family
from figgen.pilot import BY_PARAMS, PILOT, topics_for
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


# A family that keeps the pilot's hand-made topics: supply and demand for WAEC Economics (climate graphs, the
# example before, now reach topics by concept, P3m).
BY_HAND = "supply_demand"


def test_draws_distinct_figures_and_their_files(db, tmp_path):
    lib = tmp_path / "lib"
    r = generate_family(db, lib, FAMILIES[BY_HAND], 5)
    assert (r["have"], r["drawn"]) == (5, 5)
    rows = db.execute("SELECT id, spec, asset, preview, width, band, subject FROM figures").fetchall()
    assert len(rows) == 5 and len({row["spec"] for row in rows}) == 5
    for row in rows:
        assert (lib / row["asset"]).read_text(encoding="utf-8").lstrip().startswith("<?xml")
        assert (lib / row["preview"]).read_bytes()[:4] == b"\x89PNG" and row["width"] > 100
        assert (row["band"], row["subject"]) == ("UP", "economics")
    assert db.execute("SELECT COUNT(*) FROM figure_questions").fetchone()[0] == 20  # four questions each
    assert db.execute("SELECT COUNT(*) FROM figure_topics WHERE topic_key = 'waec:Economics:1'").fetchone()[0] == 5


def test_a_second_run_keeps_what_is_there(db, tmp_path):
    lib = tmp_path / "lib"
    generate_family(db, lib, FAMILIES[BY_HAND], 5)
    again = generate_family(db, lib, FAMILIES[BY_HAND], 7)
    assert (again["have"], again["drawn"]) == (7, 2)
    assert db.execute("SELECT COUNT(*) FROM figures").fetchone()[0] == 7
    assert db.execute("SELECT COUNT(*) FROM figure_questions").fetchone()[0] == 28


def test_redo_redraws_the_family_and_drops_its_reviews(db, tmp_path):
    lib = tmp_path / "lib"
    generate_family(db, lib, FAMILIES[BY_HAND], 3)
    db.execute("INSERT INTO reviews (job, figure_id, model, pass, detail, at) SELECT 'p1a-review', id, 'm', 0, '{}', 'now' FROM figures")
    db.commit()
    r = generate_family(db, lib, FAMILIES[BY_HAND], 3, redo=True)
    assert r["drawn"] == 3
    assert db.execute("SELECT COUNT(*) FROM reviews").fetchone()[0] == 0


def test_refuses_a_topic_outside_the_family_levels(db, tmp_path):
    db.execute("UPDATE topics SET band = 'AL' WHERE key = 'waec:Economics:1'")
    db.commit()
    with pytest.raises(ValueError, match="waec:Economics:1"):
        generate_family(db, tmp_path / "lib", FAMILIES[BY_HAND], 1)


def test_a_timeline_reaches_the_topics_of_its_era():
    # P3x: the timeline names its concepts era by era (link.py), no longer the pilot's two hand-made topics (TIMELINE in
    # pilot.py): a Cold War timeline reaches a Cold War topic, a timeline of Rwanda since independence a Rwanda one.
    from figgen.link import topics_for as link_topics
    m = FAMILIES["timeline"]
    topic = lambda key, name, concept: {"key": key, "band": "UP", "subject": "history", "name": name, "stage": None,  # noqa: E731
                                        "concepts": frozenset([concept]), "sections": ()}
    index = [topic("t:cold", "The Cold War", "history.cold-war"),
             topic("t:rwanda", "The First and the Second Republics of Rwanda", "history.first-republic-rwanda")]
    seen = set()
    for s in range(1, 200):
        p = m.sample(random.Random(s))
        if p["band"] == "UP":
            want = {"The Cold War": ["t:cold"], "Rwanda since independence": ["t:rwanda"]}.get(p["title"], [])
            assert link_topics(index, m, p) == want, p["title"]
            seen.add(p["title"])
    assert {"The Cold War", "Rwanda since independence"} <= seen


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


def test_a_family_that_reaches_no_topic_is_skipped(db):
    from figgen.generate import families_to_draw
    from figgen.link import topic_index
    mapped(db)
    reaching, nowhere = concept_family(), concept_family(bands=("P",))
    nowhere.ID = "nowhere"
    draw, skipped = families_to_draw({"concept_test": reaching, "nowhere": nowhere, "supply_demand": FAMILIES["supply_demand"]}, topic_index(db))
    assert sorted(draw) == ["concept_test", "supply_demand"] and skipped == ["nowhere"]  # hand-linked families are kept


def test_the_same_figure_under_another_name_is_stored_once(db, tmp_path):
    """Names change only the wording: the same numbers under another name are a near-duplicate (spec 3.4)."""
    import types
    from figgen.families import bar_chart
    mapped(db)
    fixed = {k: v for k, v in bar_chart.sample(random.Random(3)).items() if k != "band"}
    m = types.SimpleNamespace(ID="named", KIND=bar_chart.KIND, SUBJECT="mathematics", BANDS=("LS",), CONCEPTS=("mathematics.pie-charts",),
                              sample=lambda rng: {**fixed, "name": rng.choice(["Aline", "Eric", "Grace"])},
                              draw=bar_chart.draw, questions=bar_chart.questions)
    assert generate_family(db, tmp_path / "lib", m, 1)["have"] == 1
    with pytest.raises(RuntimeError, match="only 1"):
        generate_family(db, tmp_path / "lib", m, 2, max_seeds=20)


def test_relinking_moves_stored_figures_to_the_topics_they_reach_now(tmp_path):
    """Links are made when a figure is saved; a family that learns to avoid a chapter must leave it."""
    from figgen.generate import relink_family
    db = open_store(tmp_path / "figures.db")
    m = FAMILIES["box_plot"]
    band = m.BANDS[0]
    db.executemany("INSERT INTO topics (key, source, book, subject, band, name) VALUES (?, 'test', 'Book', 'mathematics', ?, ?)",
                   [("t:spread", band, "Measures of dispersion"), ("t:two", band, "Two variables")])
    db.executemany("INSERT INTO concepts (id, subject, name, bands) VALUES (?, 'mathematics', ?, '[]')", [(c, c) for c in m.CONCEPTS])
    db.commit()
    topic = lambda key, concepts: {"key": key, "band": band, "subject": "mathematics", "name": key, "stage": None, "concepts": concepts}
    every = frozenset(m.CONCEPTS)
    generate_family(db, tmp_path, m, 3, index=[topic("t:spread", every), topic("t:two", every)])
    links = lambda: sorted(db.execute("SELECT figure_id, topic_key FROM figure_topics").fetchall(), key=tuple)
    assert {tuple(r)[1] for r in links()} == {"t:spread", "t:two"}
    approved_before = db.execute("SELECT COUNT(*) FROM figures WHERE status = 'stored'").fetchone()[0]

    assert relink_family(db, m, [topic("t:spread", every), topic("t:two", frozenset())]) == (3, 0)
    assert {tuple(r)[1] for r in links()} == {"t:spread"}
    # The figures, their questions and their status are untouched: only where they are served moves.
    assert db.execute("SELECT COUNT(*) FROM figures WHERE status = 'stored'").fetchone()[0] == approved_before
    assert db.execute("SELECT COUNT(*) FROM figure_questions").fetchone()[0] > 0
    assert relink_family(db, m, [topic("t:spread", every), topic("t:two", frozenset())]) == (0, 0)
    assert relink_family(db, m, [topic("t:two", frozenset())]) == (3, 3)  # reaching nothing now: counted



def test_refreshing_forms_widens_what_is_accepted_and_keeps_the_review(tmp_path):
    """A fair form learnt later ("12 800") reaches figures already reviewed, without redrawing them: the
    stem, key and options are the same, so the verdict on them stands. A figure whose wording or options
    changed is left alone (it needs --redo)."""
    from figgen.generate import refresh_forms
    db = open_store(tmp_path / "figures.db")
    m = FAMILIES["quadratic_graph"]  # every figure has a multiple-choice question
    db.executemany("INSERT INTO topics (key, source, book, subject, band, name) VALUES (?, 'test', 'Book', 'mathematics', ?, 'Graphs')",
                   [(f"t:{b}", b) for b in m.BANDS])
    db.executemany("INSERT INTO concepts (id, subject, name, bands) VALUES (?, 'mathematics', ?, '[]')", [(c, c) for c in m.CONCEPTS])
    db.commit()
    index = [{"key": f"t:{b}", "band": b, "subject": "mathematics", "name": "Graphs", "stage": None, "concepts": frozenset(m.CONCEPTS)}
             for b in m.BANDS]
    generate_family(db, tmp_path, m, 4, index=index)
    full = {r[0]: r[1] for r in db.execute("SELECT id, accepted FROM figure_questions")}
    db.execute("UPDATE figure_questions SET accepted = json_array(answer)")  # as if drawn before the forms were learnt
    ids = [r[0] for r in db.execute("SELECT id FROM figures ORDER BY id")]
    db.execute("INSERT INTO reviews (job, figure_id, model, pass, detail, at) VALUES ('j', ?, 'm', 1, '{}', 'now')", (ids[0],))
    db.execute("UPDATE figure_questions SET stem = 'An older wording' WHERE figure_id = ? AND n = 1", (ids[-1],))
    db.execute("UPDATE figure_questions SET options = '[\"an older option\", \"b\", \"c\"]' WHERE figure_id = ? AND kind = 'mcq'", (ids[-2],))
    db.commit()

    assert refresh_forms(db, m) == (2, 2)
    now = {r[0]: r[1] for r in db.execute("SELECT id, accepted FROM figure_questions")}
    assert all(now[q] == full[q] for q in now if not q.startswith((ids[-1], ids[-2])))
    assert db.execute("SELECT COUNT(*) FROM reviews").fetchone()[0] == 1  # the verdict stands
    assert refresh_forms(db, m) == (0, 2)
