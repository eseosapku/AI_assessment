"""A family reaches the topics that teach what it draws, at the level it draws for."""
import json
import types

from figgen.link import band_of, concepts_of, link_report, topic_index, topics_for, unknown_concepts
from figgen.store import open_store


def store(tmp_path):
    db = open_store(tmp_path / "figures.db")
    rows = [("db:1", "P", "Fractions", ["mathematics.fractions", "mathematics.decimals"], 0),
            ("db:2", "LS", "Fractions and decimals", ["mathematics.fractions"], 0),
            ("db:3", "P", "Time", ["mathematics.time-general"], 0),
            ("db:4", "P", "Fractions again", ["mathematics.fractions"], 1)]  # dropped by the map
    for key, band, name, concepts, dropped in rows:
        db.execute("INSERT INTO topics (key, source, book, subject, band, name) VALUES (?, 'x', 'B', 'mathematics', ?, ?)", (key, band, name))
        db.execute("INSERT INTO topic_map (topic_key, concepts, kinds, terms, visual, dropped, model, mapped_at) "
                   "VALUES (?, ?, '[]', '[]', 'high', ?, 'm', 'now')", (key, json.dumps(concepts), dropped))
    for cid in ("mathematics.fractions", "mathematics.decimals", "mathematics.time-general"):
        db.execute("INSERT INTO concepts (id, subject, name, bands) VALUES (?, 'mathematics', ?, '[]')", (cid, cid))
    db.commit()
    return db


def family(**kw):
    base = dict(ID="f", BANDS=("P", "LS"), CONCEPTS=("mathematics.fractions",))
    return types.SimpleNamespace(**{**base, **kw})


def test_an_instance_reaches_topics_at_its_own_level_that_share_a_concept(tmp_path):
    index = topic_index(store(tmp_path))
    m = family()
    assert topics_for(index, m, {"band": "P"}) == ["db:1"]
    assert topics_for(index, m, {"band": "LS"}) == ["db:2"]
    assert topics_for(index, m, {}) == ["db:1"]  # no band in the params: the family's first


def test_a_family_may_narrow_its_concepts_per_instance(tmp_path):
    index = topic_index(store(tmp_path))
    m = family(CONCEPTS=("mathematics.fractions", "mathematics.time-general"),
               concepts_for=lambda p: frozenset({"mathematics.time-general"}) if p.get("clock") else frozenset({"mathematics.fractions"}))
    assert topics_for(index, m, {"band": "P", "clock": True}) == ["db:3"]
    assert concepts_of(m, {}) == frozenset({"mathematics.fractions"})
    assert band_of(m, {"band": "LS"}) == "LS"


def test_unknown_concepts_are_named_and_reach_is_reported_per_level(tmp_path):
    db = store(tmp_path)
    assert unknown_concepts(db, family(CONCEPTS=("mathematics.fractions", "mathematics.nope"))) == ["mathematics.nope"]
    drawn = family(sample=lambda rng: {"band": rng.choice(("P", "LS"))})  # reach is counted over drawn figures
    assert link_report(db, {"f": drawn}) == {"f": {"P": 1, "LS": 1}}


def test_a_topic_teaches_what_its_sections_teach(tmp_path):
    db = store(tmp_path)
    db.execute("INSERT INTO subtopics (key, topic_key, name) VALUES ('s:1', 'db:3', 'Telling the time and fractions of an hour')")
    db.execute("INSERT INTO subtopic_map (subtopic_key, concepts, kinds) VALUES ('s:1', '[\"mathematics.fractions\"]', '[]')")
    db.commit()
    assert topics_for(topic_index(db), family(), {"band": "P"}) == ["db:1", "db:3"]


def test_the_stage_of_a_book():
    from figgen.link import stage_of
    cases = {"P1 Mathematics PB ,": 1, "NERDC Primary 3 – Mathematics": 3, "Cambridge Primary Mathematics Learner’s Book 2, 2nd Edition": 2,
             "Cambridge Primary Mathematics Stage 4 Learners Book 4": 4, "CAMBRIDGE PRIMARY MATHEMATICS LEARNERS BOOK3": 3,
             "Cambridge Lower Secondary Mathematics Learners Book 7": 7, "Mathematics-S2-SB": 8, "NERDC Junior Secondary 1 – Mathematics": 7,
             "P5-Mathematics-PB (2)": 5, "Cambridge IGCSE 3rd (Third Edition)": None}
    assert {b: stage_of(b) for b in cases} == cases


def test_an_instance_reaches_only_topics_at_stages_it_suits(tmp_path):
    db = store(tmp_path)
    db.execute("UPDATE topics SET book = 'P1 Mathematics PB' WHERE key = 'db:1'")
    db.execute("INSERT INTO topics (key, source, book, subject, band, name) VALUES ('db:5', 'x', 'P6 Mathematics PB', 'mathematics', 'P', 'Fractions 6')")
    db.execute("INSERT INTO topic_map (topic_key, concepts, kinds, terms, visual, dropped, model, mapped_at) "
               "VALUES ('db:5', '[\"mathematics.fractions\"]', '[]', '[]', 'high', 0, 'm', 'now')")
    db.commit()
    index = topic_index(db)
    m = family(stages=lambda p: (5, 6) if p.get("hard") else None)
    assert topics_for(index, m, {"band": "P", "hard": True}) == ["db:5"]  # db:1 is a Primary 1 book
    assert topics_for(index, m, {"band": "P"}) == ["db:1", "db:5"]  # no stage given: every stage


def test_a_family_can_avoid_topics_that_share_a_word_but_not_a_subject(tmp_path):
    index = topic_index(store(tmp_path))
    m = family(AVOID=r"decimals")
    assert topics_for(index, m, {"band": "LS"}) == []  # "Fractions and decimals" is avoided
    assert topics_for(index, m, {"band": "P"}) == ["db:1"]



def test_a_figure_can_name_chapters_it_does_not_suit():
    """A family may avoid chapters figure by figure (avoid_for): a bar model of cows is no figure for
    a chapter on Rwandan francs, while one of francs is."""
    import types
    from figgen.link import topics_for
    m = types.SimpleNamespace(ID="x", BANDS=("P",), CONCEPTS=("mathematics.a",),
                              avoid_for=lambda p: None if p["money"] else r"franc")
    index = [{"key": "t:1", "band": "P", "subject": "mathematics", "name": "Rwandan Francs up to 1000 FRW", "stage": None,
              "concepts": frozenset({"mathematics.a"})},
             {"key": "t:2", "band": "P", "subject": "mathematics", "name": "Addition", "stage": None, "concepts": frozenset({"mathematics.a"})}]
    assert topics_for(index, m, {"band": "P", "money": True}) == ["t:1", "t:2"]
    assert topics_for(index, m, {"band": "P", "money": False}) == ["t:2"]
