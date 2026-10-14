"""OpenStax figures as real candidates (P3r): every book, under the user's licensing agreement with OpenStax (confirmed
2026-10-14), with no credit shown and the source kept; each figure matched to the topic its section and caption name;
fetched, stored and held once."""
import io
import json

from PIL import Image

from figgen.store import open_store


def line(**kw):
    base = {"book": "Physics", "repo": "osbooks-physics", "license": "CC BY 4.0", "chapter_title": "Electric Current",
            "section_title": "Ohm's Law and Resistance", "module_id": "m1", "figure_id": "fig-1",
            "caption": "A simple circuit with a resistor and a battery: the current through the resistor.",
            "credit": "credit: modification of work by NASA", "credit_flag": False, "media": "media/Fig_1.jpg",
            "media_ext": "jpg", "alt": "A circuit"}
    base.update(kw)
    return base


def store_with_topics(tmp_path):
    db = open_store(tmp_path / "figures.db")
    for key, name, subject in [("db:1", "Electric circuits and resistance", "physics"),
                               ("db:2", "Waves and sound", "physics"),
                               ("db:3", "Cells and tissues", "biology")]:
        db.execute("INSERT INTO topics (key, source, book, subject, band, name) VALUES (?, 'x', 'B', ?, 'UP', ?)", (key, subject, name))
    db.commit()
    return db


class FakeFetch:
    def __init__(self, size=(900, 700)):
        self.size, self.urls = size, []

    def bytes(self, url):
        self.urls.append(url)
        img = Image.new("RGB", self.size, "white")
        # each fetch a different picture, so two figures are never near-copies of each other
        from PIL import ImageDraw
        d = ImageDraw.Draw(img)
        for k in range(len(self.urls) + 2):
            x = (k * 97 * len(self.urls)) % self.size[0]
            d.rectangle([x, 0, x + self.size[0] // 6, self.size[1] // (k + 2)], fill="black")
        buf = io.BytesIO()
        img.save(buf, "PNG")
        return buf.getvalue()


def test_any_book_under_the_agreement_but_never_another_rights_holders_image():
    from figgen.real import openstax
    assert openstax.unusable(line()) is None
    assert openstax.unusable(line(license="CC BY-NC-SA 4.0")) is None  # the agreement covers OpenStax's own books
    assert "credit" in openstax.unusable(line(credit_flag=True))  # "© University of Michigan": not OpenStax's to license
    assert "caption" in openstax.unusable(line(caption=""))


def test_a_figure_goes_to_the_topic_its_section_and_caption_name(tmp_path):
    from figgen.real import openstax
    db = store_with_topics(tmp_path)
    topics = openstax.topics(db, "physics")
    assert openstax.best_topic(topics, line()) == "db:1"
    assert openstax.best_topic(topics, line(section_title="Photosynthesis", caption="A leaf in the sun.")) is None


def test_harvest_stores_a_credited_candidate_once(tmp_path):
    from figgen.real import openstax
    db = store_with_topics(tmp_path)
    fetch = FakeFetch()
    r = openstax.harvest(db, tmp_path / "lib", fetch, [line(), line(credit_flag=True, figure_id="fig-2")])
    assert r["stored"] == 1 and r["turned"].get("credit") == 1
    row = db.execute("SELECT id, origin, status, subject, licence, credit, source_url, asset, spec FROM figures").fetchone()
    assert row["origin"] == "openstax" and row["status"] == "candidate" and row["subject"] == "physics"
    assert not row["credit"]  # the app shows a credit only when there is one: none under the agreement
    source = json.loads(row["spec"])["source"]  # kept, to show where it came from if ever asked
    assert "OpenStax" in source and "Physics" in source and "CC BY 4.0" in source and "NASA" in source
    spec = json.loads(row["spec"])  # the screen and the writer read a title and a description
    assert spec["title"] == "Physics: Ohm's Law and Resistance" and spec["description"].startswith("A simple circuit")
    assert fetch.urls == ["https://raw.githubusercontent.com/openstax/osbooks-physics/HEAD/media/Fig_1.jpg"]
    assert (tmp_path / "lib" / row["asset"]).exists()
    assert db.execute("SELECT topic_key FROM figure_topics").fetchone()[0] == "db:1"
    again = openstax.harvest(db, tmp_path / "lib", fetch, [line()])
    assert again["stored"] == 0 and len(fetch.urls) == 1


def test_a_small_image_is_turned_away(tmp_path):
    from figgen.real import openstax
    db = store_with_topics(tmp_path)
    r = openstax.harvest(db, tmp_path / "lib", FakeFetch(size=(500, 200)), [line()])
    assert r["stored"] == 0 and r["turned"].get("small") == 1


def test_a_university_book_reaches_a_level_topics_only(tmp_path):
    # The user's look at the pilot: Microbiology's tree of life and Anatomy's organ systems were beyond upper secondary
    from figgen.real import openstax
    db = store_with_topics(tmp_path)
    db.execute("INSERT INTO topics (key, source, book, subject, band, name) VALUES ('db:9', 'x', 'B', 'physics', 'AL', 'Electric circuits and resistance')")
    db.commit()
    assert openstax.best_topic(openstax.topics(db, "physics", openstax.bands_of("College Physics 2e")), line()) == "db:9"
    assert openstax.best_topic(openstax.topics(db, "physics", openstax.bands_of("Physics")), line()) == "db:1"


def test_a_match_needs_a_word_of_the_section_not_the_caption_alone(tmp_path):
    from figgen.real import openstax
    db = store_with_topics(tmp_path)
    topics = openstax.topics(db, "physics", ("UP", "AL"))
    loose = line(section_title="Introduction to Physics", chapter_title="Physics Basics",
                 caption="A circuit with resistance: electric current through a resistor in a circuit with resistance.")
    assert openstax.best_topic(topics, loose) is None


def test_an_image_two_books_share_is_held_once(tmp_path):
    # Biology 2e and Concepts of Biology share modules: the same tree of life came twice
    from figgen.real import openstax
    db = store_with_topics(tmp_path)
    fetch = FakeFetch()
    r = openstax.harvest(db, tmp_path / "lib", fetch, [line(), line(book="College Physics 2e", module_id="m2", figure_id="fig-9")])
    assert r["stored"] == 1 and r["turned"].get("shared") == 1


def test_recheck_applies_the_rules_to_held_figures(tmp_path):
    # P3u: figures held under the pilot's rules are matched again, a shared copy is turned away, and the rest go back
    # to the screen (its rules changed too), approved ones included, keeping their questions
    from figgen.real import openstax
    db = store_with_topics(tmp_path)
    lib = tmp_path / "lib"
    openstax.harvest(db, lib, FakeFetch(), [line(), line(figure_id="fig-2", media="media/Fig_2.jpg", section_title="Waves",
                                                          caption="Sound waves and their pitch.")])
    db.execute("INSERT INTO figure_questions (id, figure_id, n, band, kind, stem, options, answer, accepted, model) "
               "SELECT id || '#1', id, 1, 'UP', 'short', 's', '[]', '1', '[]', 'w' FROM figures")
    db.execute("INSERT INTO screenings (figure_id, model, keep, shows, detail, at) SELECT id, 'm', 1, 'x', '{}', 'now' FROM figures")
    db.execute("UPDATE figures SET status = 'approved'")
    # the second figure's section no longer reaches a topic once its words change
    sid = openstax.figure_id(line(figure_id="fig-2"))
    spec = json.loads(db.execute("SELECT spec FROM figures WHERE id = ?", (sid,)).fetchone()[0])
    spec["section_title"], spec["caption"] = "Photosynthesis", "A leaf."
    db.execute("UPDATE figures SET spec = ? WHERE id = ?", (json.dumps(spec), sid))
    db.commit()
    r = openstax.recheck(db)
    assert r == {"rejected": 1, "rescreen": 1, "relinked": 0}
    first = openstax.figure_id(line())
    assert db.execute("SELECT status FROM figures WHERE id = ?", (first,)).fetchone()[0] == "candidate"
    assert db.execute("SELECT COUNT(*) FROM screenings WHERE figure_id = ?", (first,)).fetchone()[0] == 0
    assert db.execute("SELECT COUNT(*) FROM figure_questions WHERE figure_id = ?", (first,)).fetchone()[0] == 1
    assert db.execute("SELECT status FROM figures WHERE id = ?", (sid,)).fetchone()[0] == "rejected"
