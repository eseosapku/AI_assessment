import base64

from figgen.core import Question
from figgen.sample_sheet import build_sheet
from figgen.store import open_store, save_drawn

PNG = base64.b64decode("iVBORw0KGgo=")  # the PNG signature is enough for the page


def setup(tmp_path):
    db = open_store(tmp_path / "figures.db")
    db.execute("INSERT INTO topics (key, source, book, subject, band, name) VALUES ('db:410', 'rwanda', 'Book', 'mathematics', 'LS', '6 Statistical investigations')")
    db.commit()
    lib = tmp_path / "lib"
    (lib / "assets/drawn/bar_chart").mkdir(parents=True)
    for seed in (1, 2, 3):
        fid = f"drawn/bar_chart/{seed}"
        (lib / f"assets/{fid}.png").write_bytes(PNG)
        save_drawn(db, figure_id=fid, family="bar_chart", kind="graph.bar", subject="mathematics", band="LS",
                   topics=["db:410"], seed=seed, spec={"s": seed}, asset=f"assets/{fid}.svg",
                   preview=f"assets/{fid}.png", width=10, height=10,
                   questions=[Question("mcq", f"Which is <b>largest</b> in chart {seed}?", "2", ["Maize", "Beans", "Rice & peas"], []),
                              Question("short", "How many in total?", "40", [], ["40", "40 people"])])
    db.execute("UPDATE figures SET status = 'rejected', reason = 'Q1: two bars equal' WHERE id = 'drawn/bar_chart/2'")
    db.execute("INSERT INTO reviews (job, figure_id, model, pass, detail, at) VALUES "
               "('p1a-review', 'drawn/bar_chart/1', 'm', 1, '{}', 'now'), ('p1a-review', 'drawn/bar_chart/2', 'm', 0, '{}', 'now')")
    db.commit()
    return db, lib


def test_the_sheet_shows_samples_with_their_answers(tmp_path):
    db, lib = setup(tmp_path)
    page = build_sheet(db, lib, per_family=3)
    assert "<title>" in page[:8000]
    assert "Bar chart" in page and "6 Statistical investigations" in page
    assert page.count("data:image/png;base64,") == 2  # the rejected figure is not shown as a sample
    assert '<li class="key">Rice &amp; peas</li>' in page
    assert "40 people" in page
    assert "1/2" in page  # the review score so far


def test_text_is_escaped(tmp_path):
    db, lib = setup(tmp_path)
    page = build_sheet(db, lib)
    assert "&lt;b&gt;largest&lt;/b&gt;" in page and "<b>largest</b>" not in page


def test_rejected_figures_are_listed_with_their_reasons(tmp_path):
    db, lib = setup(tmp_path)
    assert "Q1: two bars equal" in build_sheet(db, lib)


def test_a_missing_image_is_named_not_fatal(tmp_path):
    db, lib = setup(tmp_path)
    (lib / "assets/drawn/bar_chart/1.png").unlink()
    page = build_sheet(db, lib)
    assert "image missing" in page and page.count("data:image/png;base64,") == 1
