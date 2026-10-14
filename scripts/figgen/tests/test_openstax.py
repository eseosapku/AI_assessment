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
        buf = io.BytesIO()
        Image.new("RGB", self.size, "white").save(buf, "PNG")
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
