import json

from PIL import Image

from figgen.real.real_sheet import HAIKU, SONNET, build_real_sheet
from figgen.store import open_store, save_real


def setup(tmp_path):
    db = open_store(tmp_path / "figures.db")
    db.execute("INSERT INTO topics (key, source, book, subject, band, name) VALUES ('db:2', 'cambridge', 'Biology', 'biology', 'UP', 'Cells')")
    db.commit()
    lib = tmp_path / "lib"
    (lib / "assets/wikimedia").mkdir(parents=True)
    for n in (1, 2):
        Image.new("RGB", (40, 30), "white").save(lib / f"assets/wikimedia/{n}-512.jpg", "JPEG")
        save_real(db, figure_id=f"wikimedia/{n}", origin="wikimedia", kind="photo.micrograph", subject="biology", band="UP",
                  topic_key="db:2", asset=f"assets/wikimedia/{n}.webp", preview=f"assets/wikimedia/{n}-512.jpg", width=40, height=30,
                  spec={"title": f"File:Cells {n}.jpg", "licence_url": "https://creativecommons.org/licenses/by/4.0"},
                  licence="CC BY 4.0", author="Anne & <Bob>", source_url=f"https://commons.wikimedia.org/wiki/File:Cells_{n}.jpg",
                  credit=f"Cells {n} by Anne & <Bob>, CC BY 4.0, via Wikimedia Commons", phash="0")
    db.execute("INSERT INTO screenings (figure_id, model, keep, shows, detail, at) VALUES "
               "('wikimedia/1', 'nova', 1, 'Onion cells with nuclei', '{}', 'now'), ('wikimedia/2', 'nova', 0, 'A blurred slide', '{}', 'now')")
    db.execute("UPDATE figures SET status = 'rejected', reason = 'not clear enough' WHERE id = 'wikimedia/2'")
    for model, tag, answer in ((HAIKU, "haiku", "0"), (SONNET, "sonnet", "2")):
        db.execute("INSERT INTO figure_questions (id, figure_id, n, band, kind, stem, options, answer, accepted, model) VALUES "
                   "(?, 'wikimedia/1', 1, 'UP', 'mcq', 'What is the dark dot?', '[\"Nucleus\",\"Vacuole\",\"Wall\",\"Membrane\"]', ?, '[]', ?)",
                   (f"wikimedia/1#{tag}#1", answer, model))
        db.execute("INSERT INTO question_checks (question_id, figure_id, writer, keep, reason, question, at) VALUES (?, 'wikimedia/1', ?, 1, '', '{}', 'now')",
                   (f"wikimedia/1#{tag}#1", model))
    verdict = {"pass": True, "figureClear": True, "educational": True, "problems": [],
               "questions": [{"n": 1, "keyCorrect": True, "answerable": True, "singleAnswer": True, "ownAnswer": "A", "key": "A) Nucleus", "problem": ""}]}
    db.execute("INSERT INTO reviews (job, figure_id, model, pass, detail, at) VALUES ('p1b-blind-haiku', 'wikimedia/1', 'm', 1, ?, 'now')", (json.dumps(verdict),))
    db.commit()
    return db, lib


def test_the_sheet_shows_each_passing_image_with_its_credit_and_questions(tmp_path):
    db, lib = setup(tmp_path)
    page = build_real_sheet(db, lib)
    assert "<title>" in page[:8000]
    assert "Anne &amp; &lt;Bob&gt;" in page and "<Bob>" not in page
    assert 'href="https://creativecommons.org/licenses/by/4.0"' in page and "CC BY 4.0" in page
    assert 'href="https://commons.wikimedia.org/wiki/File:Cells_1.jpg"' in page
    assert "What is the dark dot?" in page and '<li class="key">Nucleus</li>' in page
    assert "Onion cells with nuclei" in page


def test_the_sheet_shows_what_screening_turned_away(tmp_path):
    db, lib = setup(tmp_path)
    page = build_real_sheet(db, lib)
    assert "not clear enough" in page and page.count("data:image/jpeg;base64,") == 2


def test_the_sheet_compares_the_writers(tmp_path):
    db, lib = setup(tmp_path)
    page = build_real_sheet(db, lib)
    assert "1/1" in page  # Haiku: one clean question of one
    assert "Sonnet" in page and '<li class="key">Wall</li>' in page


def test_round_two_shows_only_its_writer_and_the_image_type(tmp_path):
    db, lib = setup(tmp_path)
    db.execute("UPDATE screenings SET detail = '{\"image_type\": \"diagram\"}' WHERE figure_id = 'wikimedia/1'")
    db.execute("INSERT INTO reviews (job, figure_id, model, pass, detail, at) VALUES ('p1b2-blind', 'wikimedia/1', 'm', 0, ?, 'now')",
               (json.dumps({"figureClear": True, "educational": True, "questions": [{"keyCorrect": False, "answerable": True, "singleAnswer": True}]}),))
    db.commit()
    page = build_real_sheet(db, lib, jobs={SONNET: "p1b2-blind"})
    assert '<span class="type">diagram</span>' in page
    assert "Haiku" not in page.split("<main>")[1].split("</table>")[1]  # no Haiku questions on the cards
    assert "blind review failed" in page and "0/1" in page
