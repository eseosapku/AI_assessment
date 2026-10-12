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
    assert link_report(db, {"f": family()}) == {"f": {"P": 1, "LS": 1}}
