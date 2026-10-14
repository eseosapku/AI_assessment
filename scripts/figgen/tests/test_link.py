"""A family reaches the topics that teach what it draws, at the level it draws for."""
import json
import types

from figgen.link import band_of, concepts_of, link_report, topic_index, topics_for, unknown_concepts
from figgen.store import open_store


def store(tmp_path):
    db = open_store(tmp_path / "figures.db")
    rows = [("db:1", "P", "Fractions", ["mathematics.fractions", "mathematics.decimals"], 0),
            ("db:2", "LS", "Fractions and decimals", ["mathematics.fractions"], 0),
            ("db:3", "P", "Time", ["mathematics.time-general"], 0)]
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


def test_a_family_that_needs_words_reaches_only_topics_whose_sections_name_them(tmp_path):
    """A shared broad concept is not enough where the book lists its sections: "Effect of Human Activities"
    shared an ecology concept with quadrats but teaches no sampling (the user's curriculum question, P3j)."""
    db = store(tmp_path)
    db.execute("INSERT INTO topics (key, source, book, subject, band, name) VALUES ('db:5', 'x', 'B', 'mathematics', 'P', 'Parts of a whole')")
    db.execute("INSERT INTO topic_map (topic_key, concepts, kinds, terms, visual, dropped, model, mapped_at) "
               "VALUES ('db:5', ?, '[]', '[]', 'high', 0, 'm', 'now')", (json.dumps(["mathematics.fractions"]),))
    for key, topic, name in (("s1", "db:5", "Halves and quarters"), ("s2", "db:1", "Shading a fraction of a shape")):
        db.execute("INSERT INTO subtopics (key, topic_key, name) VALUES (?, ?, ?)", (key, topic, name))
    db.commit()
    index = topic_index(db)
    m = family(NEEDS=r"shad")
    # db:1 has a section that names shading; db:5 has sections, none of them shading; db:3 shares no concept
    assert topics_for(index, m, {"band": "P"}) == ["db:1"]
    db.execute("DELETE FROM subtopics WHERE key = 's1'")  # a topic the store lists no sections for is judged by its concepts
    db.commit()
    assert topics_for(topic_index(db), m, {"band": "P"}) == ["db:1", "db:5"]


def test_needs_turn_away_the_misfits_the_p3j_review_found():
    """Each pattern must miss the section or name a fresh reviewer found it reaching, and still match what it is for."""
    import re
    from figgen.families import FAMILIES
    cases = {
        "osmosis_graph": ("Excretion and Osmoregulation", "Osmosis"),
        "variation_chart": ("Inheritance: variations from Mendel's pattern", "Continuous and discontinuous variation"),
        "spring_graph": ("Unit 4: Work, Energy and Power", "Hooke's law"),
        "electrolysis": ("Redox and oxidation number", "Electrolysis of brine"),
        "density_displacement": ("Sources of errors in measurement of physical quantities", "Making measurements"),
    }
    for fid, (misfit, fit) in cases.items():
        needs = FAMILIES[fid].NEEDS
        assert not re.search(needs, misfit, re.I), (fid, misfit)
        assert re.search(needs, fit, re.I), (fid, fit)
    # food tests keep the units on carbohydrates and proteins, but not plant nutrition's leaves
    assert re.search(FAMILIES["food_test_table"].AVOID, "Plant nutrition", re.I)


def test_a_topic_whose_map_dropped_an_invalid_id_still_teaches_its_valid_concepts(tmp_path):
    """`dropped` counts the invalid ids the mapper returned and the loader threw away; the topic and its valid
    concepts stand (P0). Reading it as "the topic was dropped" hid 491 mapped topics, AL "Cell membranes and
    transport" among them (P3j final review)."""
    db = store(tmp_path)
    db.execute("INSERT INTO topics (key, source, book, subject, band, name) VALUES ('db:4', 'x', 'B', 'mathematics', 'P', 'Fractions again')")
    db.execute("INSERT INTO topic_map (topic_key, concepts, kinds, terms, visual, dropped, model, mapped_at) "
               "VALUES ('db:4', ?, '[]', '[]', 'high', 2, 'm', 'now')", (json.dumps(["mathematics.fractions"]),))
    db.commit()
    assert topics_for(topic_index(db), family(), {"band": "P"}) == ["db:1", "db:4"]


def test_newly_indexed_topics_that_teach_none_of_it_are_named_in_avoid():
    """Indexing every mapped topic reached a further 234; these were read by name and do not teach the family
    (P3j index fix). energy_sankey had gained a second AVOID that the first silently overrode."""
    import re
    from figgen.families import FAMILIES
    cases = [("place_value", "Main parts of the day and days of the week"), ("ruler", "Kilogram, the Standard Unit of Mass"),
             ("energy_sankey", "Unit 12: General Structure of the Solar System"), ("binary_search", "Chapter 7: Expert systems"),
             ("rational_graph", "Chapter 5: Trigonometry"), ("pie_chart", "UNIT 1: BIVARIATE STATISTICS"),
             ("glucose_graph", "Coordination"), ("linear_graph", "Unit 4: Ordinary Differential Equations")]
    for fid, name in cases:
        assert re.search(FAMILIES[fid].AVOID, name, re.I), (fid, name)
    # and the AVOID does not turn away what the family teaches
    assert not re.search(FAMILIES["trig_graph"].AVOID, "Trigonometric Formulae, Equations and Inequalities", re.I)
    assert not re.search(FAMILIES["place_value"].AVOID, "Numbers from 0 up to 200", re.I)


def test_a_family_also_reaches_another_subjects_topics_by_the_concepts_it_also_teaches(tmp_path):
    """Integrated Science teaches density with a science.* concept; a physics family that says so (ALSO) reaches it, at
    its own level only (P3n)."""
    db = store(tmp_path)
    for key, band in (("db:7", "LS"), ("db:8", "P")):
        db.execute("INSERT INTO topics (key, source, book, subject, band, name) VALUES (?, 'x', 'B', 'science', ?, 'Forces and energy')", (key, band))
        db.execute("INSERT INTO topic_map (topic_key, concepts, kinds, terms, visual, dropped, model, mapped_at) "
                   "VALUES (?, ?, '[]', '[]', 'high', 0, 'm', 'now')", (key, json.dumps(["science.density"])))
    db.commit()
    index = topic_index(db)
    m = family(CONCEPTS=("mathematics.nope",), ALSO=("science.density",))
    assert topics_for(index, m, {"band": "LS"}) == ["db:7"]
    assert topics_for(index, family(CONCEPTS=("mathematics.nope",)), {"band": "LS"}) == []
