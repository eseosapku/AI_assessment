import io
import json

import pytest
from PIL import Image
from pictures import picture

from figgen.real.choose import choose
from figgen.real.harvest import harvest_topic, topic_terms
from figgen.store import open_store


def page(pageid, title, licence="CC BY 4.0", width=2000, height=1500, author="A. Person", cats=("Cells",)):
    return {"pageid": pageid, "title": f"File:{title}.jpg",
            "imageinfo": [{"width": width, "height": height, "mime": "image/jpeg", "thumburl": f"https://img/{pageid}.jpg",
                           "descriptionurl": f"https://commons.wikimedia.org/wiki/File:{title}.jpg",
                           "extmetadata": {"LicenseShortName": {"value": licence}, "LicenseUrl": {"value": "https://cc/by"},
                                           "Artist": {"value": author}, "ImageDescription": {"value": title}}}],
            "categories": [{"title": f"Category:{c}"} for c in cats]}


class FakeFetch:
    """Search replies by term, and an image for each file; file 4 is a resized copy of file 1."""

    def __init__(self):
        self.downloads = 0
        self.pages = {
            "cell micrograph": [page(1, "Onion cells"), page(2, "Cheek cells", licence="CC BY-NC 2.0"),
                                page(3, "Tiny cells", width=500, height=400), page(4, "Onion cells copy")],
            "plant cell": [page(5, "Leaf cells"), page(6, "Portrait of Hooke", cats=("Portraits of scientists",))],
        }

    def json(self, url):
        for term, pages in self.pages.items():
            if term.replace(" ", "+") in url or term.replace(" ", "%20") in url:
                return {"query": {"pages": pages}}
        return {}

    def bytes(self, url):
        self.downloads += 1
        pageid = int(url.rsplit("/", 1)[1].split(".")[0])
        img = picture(1, (1600, 1200)) if pageid in (1, 4) else picture(pageid, (1600, 1200))
        if pageid == 4:
            img = img.resize((1400, 1050))
        buf = io.BytesIO()
        img.save(buf, "JPEG", quality=90)
        return buf.getvalue()


@pytest.fixture
def db(tmp_path):
    store = open_store(tmp_path / "figures.db")
    store.execute("INSERT INTO topics (key, source, book, subject, band, name) VALUES ('db:2', 'cambridge', 'Biology', 'biology', 'UP', 'Cells')")
    store.execute("INSERT INTO topic_map (topic_key, concepts, kinds, terms, visual, model, mapped_at) VALUES "
                  "('db:2', '[]', '[\"photo.micrograph\"]', '[\"cell micrograph\", \"plant cell\"]', 'mostly real', 'm', 'now')")
    store.commit()
    return store


def test_harvests_usable_files_with_their_credit(db, tmp_path):
    lib = tmp_path / "lib"
    r = harvest_topic(db, lib, FakeFetch(), "db:2", "photo.micrograph", want=10)
    assert r["have"] == 2  # onion and leaf cells; the NC licence, the tiny file, the copy and the portrait are turned away
    rows = db.execute("SELECT * FROM figures ORDER BY id").fetchall()
    assert [row["id"] for row in rows] == ["wikimedia/1", "wikimedia/5"]
    onion = rows[0]
    assert (onion["origin"], onion["kind"], onion["subject"], onion["band"], onion["status"]) == ("wikimedia", "photo.micrograph", "biology", "UP", "candidate")
    assert onion["licence"] == "CC BY 4.0" and onion["author"] == "A. Person"
    assert onion["credit"] == "Onion cells by A. Person, CC BY 4.0, via Wikimedia Commons"
    assert onion["source_url"].endswith("File:Onion cells.jpg")
    assert json.loads(onion["spec"])["licence_url"] == "https://cc/by"
    big = Image.open(lib / onion["asset"])
    assert big.format == "WEBP" and max(big.size) <= 1200
    assert Image.open(lib / onion["preview"]).size[0] <= 512
    assert db.execute("SELECT COUNT(*) FROM figure_topics WHERE topic_key = 'db:2'").fetchone()[0] == 2
    assert r["turned"]["licence"] == 1 and r["turned"]["too"] == 1 and r["turned"]["category"] == 1


def test_a_near_copy_is_not_stored(db, tmp_path):
    r = harvest_topic(db, tmp_path / "lib", FakeFetch(), "db:2", "photo.micrograph", want=10)
    assert r["turned"].get("a", 0) == 1  # "a near-copy of an image already held"
    assert db.execute("SELECT COUNT(*) FROM figures WHERE id = 'wikimedia/4'").fetchone()[0] == 0
    assert not (tmp_path / "lib" / "assets" / "wikimedia" / "4.webp").exists()


def test_stops_at_the_number_wanted(db, tmp_path):
    assert harvest_topic(db, tmp_path / "lib", FakeFetch(), "db:2", "photo.micrograph", want=1)["have"] == 1


def test_a_finished_topic_fetches_nothing_again(db, tmp_path):
    lib = tmp_path / "lib"
    harvest_topic(db, lib, FakeFetch(), "db:2", "photo.micrograph", want=2)
    again = FakeFetch()
    r = harvest_topic(db, lib, again, "db:2", "photo.micrograph", want=2)
    assert r["have"] == 2 and again.downloads == 0


def test_a_second_run_downloads_nothing_already_held(db, tmp_path):
    # Only the near-copy is fetched again: it was turned away, so nothing records it.
    lib = tmp_path / "lib"
    harvest_topic(db, lib, FakeFetch(), "db:2", "photo.micrograph", want=10)
    again = FakeFetch()
    harvest_topic(db, lib, again, "db:2", "photo.micrograph", want=10)
    assert again.downloads == 1
    assert db.execute("SELECT COUNT(*) FROM figures").fetchone()[0] == 2


def test_choose_takes_the_same_screened_images_every_time(db, tmp_path):
    harvest_topic(db, tmp_path / "lib", FakeFetch(), "db:2", "photo.micrograph", want=10)
    db.execute("INSERT INTO screenings (figure_id, model, keep, shows, detail, at) VALUES "
               "('wikimedia/1', 'm', 1, 'cells', '{}', 'now'), ('wikimedia/5', 'm', 0, 'blurred', '{}', 'now')")
    db.commit()
    assert choose(db, per_topic=10) == ["wikimedia/1"] == choose(db, per_topic=10)

def test_searches_the_syllabus_terms_first(db, tmp_path):
    db.execute("INSERT INTO search_terms (topic_key, term, kind, model, at) VALUES "
               "('db:2', 'plant cell', 'diagram', 'm', 'now'), ('db:2', 'cell micrograph', 'photo', 'm', 'now')")
    db.commit()
    assert topic_terms(db, "db:2") == ["plant cell", "cell micrograph"]
    fetch = FakeFetch()
    fetch.searched = []
    original = fetch.json
    fetch.json = lambda url: (fetch.searched.append(url), original(url))[1]
    harvest_topic(db, tmp_path / "lib", fetch, "db:2", "photo.micrograph", want=10)
    assert "plant+cell" in fetch.searched[0]
    assert json.loads(db.execute("SELECT spec FROM figures WHERE id = 'wikimedia/5'").fetchone()[0])["mime"] == "image/jpeg"


def test_falls_back_to_the_concept_map_terms(db):
    assert topic_terms(db, "db:2") == ["cell micrograph", "plant cell"]


def test_choose_can_put_diagrams_first(db, tmp_path):
    harvest_topic(db, tmp_path / "lib", FakeFetch(), "db:2", "photo.micrograph", want=10)
    db.execute("INSERT INTO screenings (figure_id, model, keep, shows, detail, at) VALUES "
               "('wikimedia/1', 'm', 1, 'a', '{\"image_type\": \"photo\"}', 'now'), ('wikimedia/5', 'm', 1, 'b', '{\"image_type\": \"diagram\"}', 'now')")
    db.commit()
    assert choose(db, per_topic=1, diagrams_first=True) == ["wikimedia/5"]
    assert sorted(choose(db, per_topic=2, diagrams_first=True)) == ["wikimedia/1", "wikimedia/5"]


def test_a_transparent_diagram_is_stored_on_white(tmp_path):
    # SVG diagrams render with a transparent background; converted to RGB it turned black.
    from PIL import ImageDraw
    from figgen.real.harvest import store_image
    img = Image.new("RGBA", (800, 600), (0, 0, 0, 0))
    ImageDraw.Draw(img).rectangle((300, 200, 500, 400), fill=(20, 120, 60, 255))
    buf = io.BytesIO()
    img.save(buf, "PNG")
    asset, preview, *_ = store_image(tmp_path, "wikimedia/7", buf.getvalue())
    for key in (asset, preview):
        corner = Image.open(tmp_path / key).convert("RGB").getpixel((5, 5))
        assert min(corner) >= 245, f"{key}: background {corner}"


def test_held_scans_are_rejected_by_the_rule(db, tmp_path):
    from figgen.real.harvest import reject_held_scans
    harvest_topic(db, tmp_path / "lib", FakeFetch(), "db:2", "photo.micrograph", want=10)
    db.execute("UPDATE figures SET spec = json_set(spec, '$.title', 'File:Cells (Page 12) BHL123.jpg') WHERE id = 'wikimedia/1'")
    db.execute("INSERT INTO screenings (figure_id, model, keep, shows, detail, at) VALUES ('wikimedia/1', 'm', 1, 'x', '{}', 'now')")
    db.commit()
    assert reject_held_scans(db) == 1
    assert tuple(db.execute("SELECT status, reason FROM figures WHERE id = 'wikimedia/1'").fetchone()) == ("rejected", "a scanned book page")
    assert db.execute("SELECT keep FROM screenings WHERE figure_id = 'wikimedia/1'").fetchone()[0] == 0
    assert reject_held_scans(db) == 0
