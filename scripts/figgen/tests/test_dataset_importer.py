"""The dataset importer (P3q), on a tiny dataset made in a temporary folder: files copied, figures stored with their
questions and topics, a second run resumed, and rows with no writer or no topic left out."""
import json
import sqlite3

from figgen.store import open_store


def tiny_dataset(tmp_path):
    root = tmp_path / "share"
    img = root / "dataset" / "images" / "maths" / "igcse_year10" / "t" / "s"
    img.mkdir(parents=True)
    rows = []
    for k, (fam, params, labels) in enumerate([
        ("math.number_line", {"lo": -1, "hi": 2, "lo_op": "<", "hi_op": "<=", "range": [-3, 7], "show_ineq": False}, ["0"]),
        ("math.number_line", {"lo": None, "hi": 0, "lo_op": "<", "hi_op": "<", "range": [-6, 4], "show_ineq": False}, ["0"]),
        ("chem.mystery", {"x": 1}, ["C"]),  # no writer: not imported
    ]):
        name = f"s__{fam}__{k:08x}"
        (img / f"{name}.svg").write_text("<?xml version='1.0'?><svg xmlns='http://www.w3.org/2000/svg'/>", encoding="utf-8")
        (img / f"{name}.png").write_bytes(b"\x89PNG\r\n\x1a\n" + b"0" * 64)
        rows.append({"id": name, "family": fam, "qualification": "igcse", "year_group": 10, "subtopic_id": "s", "subtopic_name": "S",
                     "params": params, "labels": labels, "width_px": 300, "height_px": 200,
                     "svg": f"dataset/images/maths/igcse_year10/t/s/{name}.svg", "png": f"dataset/images/maths/igcse_year10/t/s/{name}.png"})
    (root / "dataset" / "manifest.jsonl").write_text("\n".join(json.dumps(r) for r in rows) + "\n", encoding="utf-8")
    return root


def store_with_topic(tmp_path):
    db = open_store(tmp_path / "figures.db")
    db.execute("INSERT INTO topics (key, source, book, subject, band, name) VALUES ('db:1', 'x', 'B', 'mathematics', 'UP', 'Inequalities')")
    db.execute("INSERT INTO topic_map (topic_key, concepts, kinds, terms, visual, dropped, model, mapped_at) "
               "VALUES ('db:1', ?, '[]', '[]', 'high', 0, 'm', 'now')", (json.dumps(["mathematics.linear-inequalities-solving"]),))
    db.execute("INSERT INTO concepts (id, subject, name, bands) VALUES ('mathematics.linear-inequalities-solving', 'mathematics', 'x', '[]')")
    db.commit()
    return db


def test_imports_copies_and_resumes(tmp_path, monkeypatch):
    from figgen.dataset import importer
    monkeypatch.setenv("FIGGEN_DATASET", str(tiny_dataset(tmp_path)))
    db = store_with_topic(tmp_path)
    lib = tmp_path / "lib"
    r = importer.import_rows(db, lib, families={"math.number_line", "chem.mystery"})
    assert r == {"stored": 2, "kept": 0, "no_writer": 1, "no_topic": 0}
    rows = db.execute("SELECT id, family, band, subject, asset, preview, status FROM figures ORDER BY id").fetchall()
    assert [row[1] for row in rows] == ["ds.math.number_line", "ds.math.number_line"]
    assert all(row[2] == "UP" and row[3] == "mathematics" and row[6] == "stored" for row in rows)
    for row in rows:
        assert (lib / row[4]).read_text(encoding="utf-8").startswith("<?xml") and (lib / row[5]).read_bytes()[:4] == b"\x89PNG"
    assert db.execute("SELECT COUNT(*) FROM figure_topics WHERE topic_key = 'db:1'").fetchone()[0] == 2
    assert db.execute("SELECT COUNT(*) FROM figure_questions").fetchone()[0] >= 3
    again = importer.import_rows(db, lib, families={"math.number_line"})
    assert again["stored"] == 0 and again["kept"] == 2


def test_a_row_that_reaches_no_topic_is_not_stored(tmp_path, monkeypatch):
    from figgen.dataset import importer
    monkeypatch.setenv("FIGGEN_DATASET", str(tiny_dataset(tmp_path)))
    db = open_store(tmp_path / "figures.db")  # no topics at all
    r = importer.import_rows(db, tmp_path / "lib", families={"math.number_line"})
    assert r["stored"] == 0 and r["no_topic"] == 2
