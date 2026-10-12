# Figure Library P1a: Drawn-Figure Pilot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Draw 30 figures from each of 20 drawn families into the local staging store, blind-review every one with Sonnet (27 of 30 must pass per family), and give the user a sample sheet to approve. That approval is the P1a exit gate.

**Architecture:** A Python package, `scripts/figgen/`, draws exam-style figures with matplotlib and computes every answer in the same code. It writes SVG and PNG files to the local library folder, and rows to the SQLite staging store. The store's tables now live in one file, `scripts/figure-library/schema.sql`, which both Node and Python create from. A Node script sends each figure's PNG and questions to Sonnet 5.5 for a blind check, and records spend in the existing ledger under the $600 cap. A Python script turns the store into one self-contained HTML sample sheet.

**Tech Stack:** Python 3.12, matplotlib 3.11.2, pytest 9.1.1, Python's built-in sqlite3. Node `node:sqlite`, vitest (node), jiti, and `@aws-sdk/client-bedrock-runtime`. Model: Sonnet 5.5 (`eu.anthropic.claude-sonnet-5-5`, $2.20 / $11 per M tokens).

**Spec:** `docs/superpowers/specs/2026-10-10-figure-library-design.md`. P1 is in section 9; the drawn figures in 5.2; the reviews in 5.5; local-first in 5.6; the budget in 8.

**Where the family code comes from:** the 20 family modules, `core.py` and the two family test files were written and verified before this plan, in the session scratchpad: 120 tests over 60 to 1,000 seeds. Task 1 moves them into the repo unchanged, except that the answer tests go up to 1,000 seeds. Their full text is in Task 1's commit, not repeated here. Every other task's code is given in full.

## Global Constraints

- Model spend never passes $600 in total (`capUsd()`, code-enforced). This plan's review job (`p1a-review`) has its own cap of $8. Spec section 8 sets P1 at $25 for both pilots; P1a should use about $5.
- No OpenStax. No AI-generated images. Every figure in this plan is drawn by code.
- Library files stay outside the repository: `FIGURE_LIBRARY_DIR`, default `C:/Users/Stephen/figure-library`. Both stores refuse a path inside the repo.
- Pipeline runs never write to the production database.
- Never print secrets. Spend reports show totals only.
- Blind review: the reviewer is never told how a figure was made or which family it is from. Pass mark 27 of 30 per family (spec 3.3). Failures are fixed and re-reviewed, never waved through (spec 5.5).
- Sonnet 5.5 refuses `temperature`. Send `output_config: { effort: 'low' }`, as the repo's other Sonnet scripts do.
- tsc is strict, target ES2017 (no regex `s` flag). vitest runs in node.
- Commits stay local on `aws_deploy`; do not push. Leave three files out of every commit: `scripts/build_checkpoint_figure_bank.py`, `scripts/textbook-figure-raw.ts`, and the deletion of `data/audit/paper-style.json`.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **A stopped run is started again** (a budget stop, a crash, Ctrl-C). Expected: no figure is drawn twice, no review is paid for twice, and no question rows are duplicated. Pinned in Task 4 (`test_a_second_run_keeps_what_is_there`) and Task 6 (`takes the earliest seeds of each family, and skips any already reviewed`).
2. **A family is fixed after failing review and drawn again.** Expected: its old verdicts and rejections do not survive into the new figures. Pinned in Task 3 (`test_saving_again_replaces_and_clears_old_reviews`) and Task 4 (`test_redo_redraws_the_family_and_drops_its_reviews`).
3. **A reviewer reply is malformed, skips a question, or claims a pass its own judgements contradict.** Expected: it is never counted as a pass. Pinned in Task 6 (`refuses a reply that skips a question or a judgement`, `works the pass out itself`).
4. **A figure's PNG is missing on disk at review time.** Expected: it is skipped and named, and nothing is sent or paid for. Pinned in Task 6 (`is null when the file is missing`).
5. **A question contains HTML characters** (`<`, `&`). Expected: the sample sheet shows them as text and does not break the page. Pinned in Task 7 (`test_text_is_escaped`).

## File Structure

| File | Responsibility |
|---|---|
| `scripts/figgen/__init__.py`, `core.py`, `families/*.py` | The 20 drawn families and their shared style (Task 1) |
| `scripts/figgen/requirements.txt` | Python dependencies |
| `scripts/figgen/tests/*.py` | pytest: family checks, answer recomputation, store, generator, sheet |
| `scripts/figure-library/schema.sql` | Every staging-store table, shared by Node and Python (Task 2) |
| `scripts/figure-library/store.ts` | Reads `schema.sql` instead of an inline string |
| `scripts/figgen/store.py` | The same store from Python: open it, save a drawn figure, delete a family (Task 3) |
| `scripts/figgen/pilot.py` | Which pilot topic each family draws for (Task 4) |
| `scripts/figgen/generate.py` | Draws N distinct figures per family into files and rows; resumable (Task 4) |
| `scripts/figure-library/claude.ts` | Gains images and Sonnet's effort setting (Task 5) |
| `scripts/figure-library/review.ts` | The blind review: prompt, verdict, selection, scores (Task 6) |
| `scripts/figure-library/review-drawn.ts` | Runs the review under the budget (Task 6) |
| `scripts/figgen/sample_sheet.py` | The sample sheet HTML (Task 7) |

---

### Task 1: Land the drawn families

**Files:**
- Create: `scripts/figgen/__init__.py`, `scripts/figgen/core.py`, `scripts/figgen/families/__init__.py` plus 20 family modules, `scripts/figgen/tests/conftest.py`, `scripts/figgen/tests/test_families_common.py`, `scripts/figgen/tests/test_families_answers.py`, `scripts/figgen/requirements.txt`
- Modify: `.gitignore`

**Interfaces:**
- Produces:
  - `figgen.families.FAMILIES: dict[str, module]`. Each module has `ID`, `KIND` (a figure kind id), `SUBJECT`, `BANDS` (a tuple drawn from P, LS, UP, AL), `sample(rng) -> dict` (JSON-stable), `draw(params) -> matplotlib Figure`, `questions(params, rng) -> list[Question]`, and an optional `MIN_VARIETY`.
  - `figgen.core.Question(kind, stem, answer, options, accepted, explanation)`: an mcq's `answer` is the index of the correct option, as a string; a short answer's `accepted[0] == answer`.
  - `figgen.core.render(fig) -> Rendered(svg: str, png: bytes)`, at 150 dpi, which closes the figure.
  - The same seed always gives the same figure and questions: `rng = Random(seed); p = sample(rng); qs = questions(p, rng)`.

- [ ] **Step 1: Run the tests where the package will live, before it exists**

Run: `python -m pytest scripts/figgen -q`
Expected: FAIL: `file or directory not found: scripts/figgen`.

- [ ] **Step 2: Copy the verified package in, without caches, and raise the answer checks to 1,000 seeds**

```bash
SRC="C:/Users/Stephen/AppData/Local/Temp/claude/c--Users-Stephen-AI-assessment/f074eea3-3819-4555-a6c3-5b91497514b5/scratchpad/p1a/figgen"
mkdir -p scripts/figgen/families scripts/figgen/tests
cp "$SRC"/__init__.py "$SRC"/core.py scripts/figgen/
cp "$SRC"/families/*.py scripts/figgen/families/
cp "$SRC"/tests/*.py scripts/figgen/tests/
sed -i 's/^SEEDS = range(1, 81)$/SEEDS = range(1, 1001)  # spec 12: every answer holds on 1,000 seeds/' scripts/figgen/tests/test_families_answers.py
```

Write `scripts/figgen/requirements.txt`:

```
# Drawn figures (scripts/figgen). Install: python -m pip install --user -r scripts/figgen/requirements.txt
matplotlib==3.11.2
# Tests: python -m pytest scripts/figgen -q
pytest==9.1.1
```

Append to `.gitignore`:

```
# Python caches (scripts/figgen)
__pycache__/
.pytest_cache/
```

- [ ] **Step 3: Run the family tests**

Run: `python -m pytest scripts/figgen -q`
Expected: PASS, 120 passed (100 common, 20 answers).

- [ ] **Step 4: Commit**

```bash
git add .gitignore scripts/figgen
git commit -m "feat(figgen): twenty drawn figure families with computed answers"
```

---

### Task 2: One schema file for Node and Python

**Files:**
- Create: `scripts/figure-library/schema.sql`
- Modify: `scripts/figure-library/store.ts` (the inline `SCHEMA` string)
- Test: `scripts/figure-library/store.test.ts`

**Interfaces:**
- Produces:
  - Tables `figures`, `figure_topics`, `figure_questions` and `reviews`, columns as in the SQL below.
  - A figure id looks like `drawn/<family>/<seed>`. Its asset key is `assets/<id>.svg` and its preview key is `assets/<id>.png`.
  - A question id is `<figure id>#<n>`.
  - `reviews` holds one row per (job, figure_id).
  - `SCHEMA` (exported by `store.ts`) is the text of `schema.sql`.

- [ ] **Step 1: Write the failing tests**

In `scripts/figure-library/store.test.ts`, change the import to `import { SCHEMA, openStore, readJson } from './store'`, and add inside `describe('the staging store', ...)`:

```ts
  it('creates the figure tables from the schema file it shares with Python', () => {
    // scripts/figgen/store.py creates the same tables from the same file, so
    // the two languages cannot drift apart.
    const db = openStore(':memory:')
    const tables = (db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as { name: string }[]).map((r) => r.name)
    expect(tables).toEqual(expect.arrayContaining(['figures', 'figure_topics', 'figure_questions', 'reviews']))
    expect(SCHEMA).toBe(fs.readFileSync(path.resolve('scripts/figure-library/schema.sql'), 'utf8'))
    db.close()
  })

  it('keeps one review per figure per job', () => {
    const db = openStore(':memory:')
    db.prepare("INSERT INTO figures (id, origin, kind, subject, band, asset, status, created_at) VALUES ('drawn/x/1', 'drawn', 'graph.bar', 'mathematics', 'LS', 'assets/drawn/x/1.svg', 'stored', 'now')").run()
    const add = db.prepare("INSERT INTO reviews (job, figure_id, model, pass, detail, at) VALUES ('j', 'drawn/x/1', 'm', 1, '{}', 'now')")
    add.run()
    expect(() => add.run()).toThrow(/UNIQUE/)
    db.close()
  })
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run scripts/figure-library/store.test.ts`
Expected: FAIL. The first test fails because the `figures` table is missing; the second fails with "no such table: figures".

- [ ] **Step 3: Move the schema to `schema.sql` and add the figure tables**

Create `scripts/figure-library/schema.sql`:

```sql
-- scripts/figure-library/schema.sql
-- Every table in the staging store (spec 5.6). Node (store.ts) and Python
-- (scripts/figgen/store.py) both create the store from this one file.
CREATE TABLE IF NOT EXISTS topics (
  key TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  textbook_id INTEGER,
  book TEXT NOT NULL,
  subject TEXT NOT NULL,
  band TEXT NOT NULL,
  name TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS subtopics (
  key TEXT PRIMARY KEY,
  topic_key TEXT NOT NULL REFERENCES topics(key),
  name TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS concepts (
  id TEXT PRIMARY KEY,
  subject TEXT NOT NULL,
  name TEXT NOT NULL,
  bands TEXT NOT NULL,
  aliases TEXT NOT NULL DEFAULT '[]'
);
CREATE TABLE IF NOT EXISTS topic_map (
  topic_key TEXT PRIMARY KEY REFERENCES topics(key),
  concepts TEXT NOT NULL,
  kinds TEXT NOT NULL,
  terms TEXT NOT NULL,
  visual TEXT NOT NULL,
  dropped INTEGER NOT NULL DEFAULT 0,
  model TEXT NOT NULL,
  mapped_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS subtopic_map (
  subtopic_key TEXT PRIMARY KEY REFERENCES subtopics(key),
  concepts TEXT NOT NULL,
  kinds TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS supply (
  term TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  hits INTEGER NOT NULL,
  probed_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS spend (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job TEXT NOT NULL,
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL,
  usd REAL NOT NULL,
  at TEXT NOT NULL
);
-- One figure, drawn or real (spec 5.4). A drawn figure keeps its seed and spec,
-- so it can be redrawn exactly. asset and preview are keys under the library
-- folder, laid out as the S3 keys will be: assets/drawn/<family>/<seed>.svg.
CREATE TABLE IF NOT EXISTS figures (
  id TEXT PRIMARY KEY,
  origin TEXT NOT NULL,
  family TEXT,
  kind TEXT NOT NULL,
  subject TEXT NOT NULL,
  band TEXT NOT NULL,
  concepts TEXT NOT NULL DEFAULT '[]',
  asset TEXT NOT NULL,
  preview TEXT,
  width INTEGER,
  height INTEGER,
  seed INTEGER,
  spec TEXT,
  licence TEXT,
  author TEXT,
  source_url TEXT,
  credit TEXT,
  phash TEXT,
  status TEXT NOT NULL,
  reason TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS figures_by_family ON figures(family, seed);
CREATE TABLE IF NOT EXISTS figure_topics (
  figure_id TEXT NOT NULL REFERENCES figures(id),
  topic_key TEXT NOT NULL REFERENCES topics(key),
  PRIMARY KEY (figure_id, topic_key)
);
-- mcq: answer is the index of the correct option. short: answer is accepted[0].
CREATE TABLE IF NOT EXISTS figure_questions (
  id TEXT PRIMARY KEY,
  figure_id TEXT NOT NULL REFERENCES figures(id),
  n INTEGER NOT NULL,
  band TEXT NOT NULL,
  kind TEXT NOT NULL,
  stem TEXT NOT NULL,
  options TEXT NOT NULL DEFAULT '[]',
  answer TEXT NOT NULL,
  accepted TEXT NOT NULL DEFAULT '[]',
  explanation TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job TEXT NOT NULL,
  figure_id TEXT NOT NULL REFERENCES figures(id),
  model TEXT NOT NULL,
  pass INTEGER NOT NULL,
  detail TEXT NOT NULL,
  at TEXT NOT NULL,
  UNIQUE (job, figure_id)
);
```

In `scripts/figure-library/store.ts`, replace the whole `export const SCHEMA = \`...\`` block with:

```ts
/**
 * Every table in the store. Kept in schema.sql because the Python figure
 * generator (scripts/figgen/store.py) creates the store from the same file.
 */
export const SCHEMA = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8')
```

- [ ] **Step 4: Run the store tests, including the jiti one**

Run: `npx vitest run scripts/figure-library/store.test.ts`
Expected: PASS, 8 tests. The jiti test proves `__dirname` resolves under jiti too.

- [ ] **Step 5: Run the whole figure-library suite and tsc**

Run: `npx vitest run scripts/figure-library && npx tsc --noEmit -p .`
Expected: every test passes; tsc prints nothing.

- [ ] **Step 6: Commit**

```bash
git add scripts/figure-library/schema.sql scripts/figure-library/store.ts scripts/figure-library/store.test.ts
git commit -m "feat(figure-library): figure, question and review tables in a schema shared with Python"
```

---

### Task 3: The store from Python

**Files:**
- Create: `scripts/figgen/store.py`
- Test: `scripts/figgen/tests/test_store.py`

**Interfaces:**
- Consumes: `scripts/figure-library/schema.sql` (Task 2); `figgen.core.Question` (Task 1).
- Produces:
  - `figgen.store.REPO: Path`
  - `library_dir() -> Path`
  - `open_store(file=None, repo=REPO) -> sqlite3.Connection` (rows are `sqlite3.Row`)
  - `topic(db, key) -> dict`, with keys `key`, `subject`, `band` and `name`; raises `KeyError` if the topic is missing
  - `has_figure(db, figure_id) -> bool`
  - `save_drawn(db, *, figure_id, family, kind, subject, band, topics, seed, spec, questions, asset, preview, width, height) -> None`
  - `delete_family(db, family) -> list[str]`, which returns the file keys to delete

- [ ] **Step 1: Write the failing tests**

Create `scripts/figgen/tests/test_store.py`:

```python
import json
import sqlite3

import pytest

from figgen.core import Question
from figgen.store import REPO, delete_family, has_figure, open_store, save_drawn, topic


def add_topic(db, key="db:410"):
    db.execute("INSERT INTO topics (key, source, book, subject, band, name) VALUES (?, 'rwanda', 'Book', 'mathematics', 'LS', 'A topic')", (key,))
    db.commit()


def save(db, seed=1, family="bar_chart", topics=("db:410",)):
    save_drawn(db, figure_id=f"drawn/{family}/{seed}", family=family, kind="graph.bar", subject="mathematics", band="LS",
               topics=list(topics), seed=seed, spec={"values": [1, 2]},
               questions=[Question("short", "How many?", "3", [], ["3"]), Question("mcq", "Which?", "1", ["a", "b", "c"], [])],
               asset=f"assets/drawn/{family}/{seed}.svg", preview=f"assets/drawn/{family}/{seed}.png", width=800, height=600)


def test_refuses_to_live_inside_the_repository():
    with pytest.raises(ValueError, match="outside the repository"):
        open_store(REPO / "data" / "figures.db")


def test_creates_the_shared_tables(tmp_path):
    db = open_store(tmp_path / "figures.db")
    names = {r[0] for r in db.execute("SELECT name FROM sqlite_master WHERE type = 'table'")}
    assert {"topics", "spend", "figures", "figure_topics", "figure_questions", "reviews"} <= names
    assert db.execute("PRAGMA busy_timeout").fetchone()[0] == 10000
    assert db.execute("PRAGMA foreign_keys").fetchone()[0] == 1


def test_saves_a_figure_with_its_questions_and_topics(tmp_path):
    db = open_store(tmp_path / "figures.db")
    add_topic(db)
    save(db)
    f = db.execute("SELECT * FROM figures WHERE id = 'drawn/bar_chart/1'").fetchone()
    assert (f["origin"], f["status"], json.loads(f["spec"])) == ("drawn", "stored", {"values": [1, 2]})
    qs = db.execute("SELECT id, n, kind, answer, options, accepted, model FROM figure_questions ORDER BY n").fetchall()
    assert [q["id"] for q in qs] == ["drawn/bar_chart/1#1", "drawn/bar_chart/1#2"]
    assert json.loads(qs[1]["options"]) == ["a", "b", "c"] and qs[0]["model"] == "code"
    assert db.execute("SELECT topic_key FROM figure_topics").fetchone()[0] == "db:410"
    assert has_figure(db, "drawn/bar_chart/1") and not has_figure(db, "drawn/bar_chart/2")


def test_saving_again_replaces_and_clears_old_reviews(tmp_path):
    # A family fixed after a failed review is redrawn; the old verdict must not stand.
    db = open_store(tmp_path / "figures.db")
    add_topic(db)
    save(db)
    db.execute("UPDATE figures SET status = 'rejected', reason = 'key wrong'")
    db.execute("INSERT INTO reviews (job, figure_id, model, pass, detail, at) VALUES ('p1a-review', 'drawn/bar_chart/1', 'm', 0, '{}', 'now')")
    db.commit()
    save(db)
    assert db.execute("SELECT COUNT(*) FROM figure_questions").fetchone()[0] == 2
    assert db.execute("SELECT COUNT(*) FROM reviews").fetchone()[0] == 0
    assert tuple(db.execute("SELECT status, reason FROM figures").fetchone()) == ("stored", None)


def test_an_unknown_topic_saves_nothing(tmp_path):
    db = open_store(tmp_path / "figures.db")
    with pytest.raises(sqlite3.IntegrityError):
        save(db, topics=("db:999",))
    assert not has_figure(db, "drawn/bar_chart/1")
    with pytest.raises(KeyError):
        topic(db, "db:999")


def test_delete_family_removes_everything_and_names_the_files(tmp_path):
    db = open_store(tmp_path / "figures.db")
    add_topic(db)
    save(db, 1)
    save(db, 2)
    save(db, 1, family="pie_chart")
    files = delete_family(db, "bar_chart")
    assert sorted(files) == sorted(["assets/drawn/bar_chart/1.svg", "assets/drawn/bar_chart/1.png",
                                    "assets/drawn/bar_chart/2.svg", "assets/drawn/bar_chart/2.png"])
    assert db.execute("SELECT COUNT(*) FROM figures").fetchone()[0] == 1
    assert db.execute("SELECT COUNT(*) FROM figure_questions").fetchone()[0] == 2
```

- [ ] **Step 2: Run them to see them fail**

Run: `python -m pytest scripts/figgen/tests/test_store.py -q`
Expected: FAIL: `ModuleNotFoundError: No module named 'figgen.store'`.

- [ ] **Step 3: Write `scripts/figgen/store.py`**

```python
"""The staging store from Python: the same SQLite file and tables the Node pipeline uses (spec 5.6).

The tables are defined once, in scripts/figure-library/schema.sql, and both
languages create the store from that file, so they cannot disagree.
"""
from __future__ import annotations

import json
import os
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
SCHEMA_FILE = REPO / "scripts" / "figure-library" / "schema.sql"
DEFAULT_DIR = "C:/Users/Stephen/figure-library"


def library_dir() -> Path:
    """Where the library is built until S3 exists: outside the repository, as in store.ts."""
    return Path(os.environ.get("FIGURE_LIBRARY_DIR") or DEFAULT_DIR).resolve()


def open_store(file: str | Path | None = None, repo: Path = REPO) -> sqlite3.Connection:
    target = str(file) if file is not None else str(library_dir() / "figures.db")
    if target != ":memory:":
        path = Path(target).resolve()
        root = repo.resolve()
        if path == root or root in path.parents:
            raise ValueError(f"The figure library must live outside the repository, not at {path}")
        path.parent.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(target, timeout=10)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA foreign_keys = ON")
    # Another writer (a review run, a probe) may hold the file; wait rather than fail.
    db.execute("PRAGMA busy_timeout = 10000")
    if target != ":memory:":
        db.execute("PRAGMA journal_mode = WAL")
    db.executescript(SCHEMA_FILE.read_text(encoding="utf-8"))
    return db


def topic(db: sqlite3.Connection, key: str) -> dict:
    row = db.execute("SELECT key, subject, band, name FROM topics WHERE key = ?", (key,)).fetchone()
    if row is None:
        raise KeyError(f"No topic {key} in the store; export the curriculum first")
    return dict(row)


def has_figure(db: sqlite3.Connection, figure_id: str) -> bool:
    return db.execute("SELECT 1 FROM figures WHERE id = ?", (figure_id,)).fetchone() is not None


def save_drawn(db: sqlite3.Connection, *, figure_id: str, family: str, kind: str, subject: str, band: str,
               topics: list[str], seed: int, spec: dict, questions: list, asset: str, preview: str,
               width: int, height: int) -> None:
    """One drawn figure with its topics and questions, all or nothing.

    Saving an id again replaces it and drops its reviews: a redrawn figure is
    reviewed afresh, never judged on the verdict its old drawing got.
    """
    now = datetime.now(timezone.utc).isoformat()
    with db:
        db.execute(
            """INSERT INTO figures (id, origin, family, kind, subject, band, asset, preview, width, height, seed, spec,
                                    status, created_at)
               VALUES (?, 'drawn', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'stored', ?)
               ON CONFLICT(id) DO UPDATE SET family = excluded.family, kind = excluded.kind, subject = excluded.subject,
                 band = excluded.band, asset = excluded.asset, preview = excluded.preview, width = excluded.width,
                 height = excluded.height, seed = excluded.seed, spec = excluded.spec, status = 'stored', reason = NULL""",
            (figure_id, family, kind, subject, band, asset, preview, width, height, seed,
             json.dumps(spec, sort_keys=True), now))
        for table in ("reviews", "figure_questions", "figure_topics"):
            db.execute(f"DELETE FROM {table} WHERE figure_id = ?", (figure_id,))
        db.executemany("INSERT OR IGNORE INTO figure_topics (figure_id, topic_key) VALUES (?, ?)",
                       [(figure_id, key) for key in topics])
        db.executemany(
            """INSERT INTO figure_questions (id, figure_id, n, band, kind, stem, options, answer, accepted, explanation, model)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'code')""",
            [(f"{figure_id}#{n}", figure_id, n, band, q.kind, q.stem, json.dumps(q.options), q.answer,
              json.dumps(q.accepted), q.explanation) for n, q in enumerate(questions, 1)])


def delete_family(db: sqlite3.Connection, family: str) -> list[str]:
    """Removes a drawn family's figures with their questions, topics and reviews; returns the file keys to delete."""
    rows = db.execute("SELECT id, asset, preview FROM figures WHERE origin = 'drawn' AND family = ?", (family,)).fetchall()
    ids = [(r["id"],) for r in rows]
    with db:
        for table in ("reviews", "figure_questions", "figure_topics"):
            db.executemany(f"DELETE FROM {table} WHERE figure_id = ?", ids)
        db.executemany("DELETE FROM figures WHERE id = ?", ids)
    return [key for r in rows for key in (r["asset"], r["preview"]) if key]
```

- [ ] **Step 4: Run them to see them pass**

Run: `python -m pytest scripts/figgen/tests/test_store.py -q`
Expected: PASS, 6 passed.

- [ ] **Step 5: Commit**

```bash
git add scripts/figgen/store.py scripts/figgen/tests/test_store.py
git commit -m "feat(figgen): open the staging store from Python and save drawn figures"
```

---

### Task 4: Pilot topics and the generator

**Files:**
- Create: `scripts/figgen/pilot.py`, `scripts/figgen/generate.py`
- Test: `scripts/figgen/tests/test_generate.py`

**Interfaces:**
- Consumes: `FAMILIES` and `render` (Task 1); `open_store`, `topic`, `has_figure`, `save_drawn`, `delete_family` and `library_dir` (Task 3).
- Produces:
  - `figgen.pilot.PILOT: dict[str, list[str]]`, `TIMELINE: dict[str, list[str]]`, and `topics_for(family, params) -> list[str]`
  - `figgen.generate.figure_id(family, seed) -> str`
  - `generate_family(db, lib, module, count, redo=False) -> {"family", "have", "drawn"}`
  - CLI: `python scripts/figgen/generate.py [--per-family N] [--families a,b] [--redo]`
  - A figure takes its subject and band from the first topic it is made for.

**Pilot topics.** Each one's mapped kinds include the family's kind, and its level is one the family draws for. These were checked against the staging store on 2026-10-12:

| Family | Topic | Subject, band |
|---|---|---|
| bar_chart, pie_chart, scatter_graph | db:410 Statistical investigations | maths LS |
| line_graph, box_plot | db:141 Averages and measures of spread | maths UP |
| tree_diagram | db:153 Probability using tree diagrams | maths UP |
| angles | db:4295 Calculating angles | maths LS |
| number_line, coordinates | db:489 Numbers and sequences | maths P |
| punnett | db:111 Genetics | biology UP |
| food_web | db:3856 Ecology (NERDC SS2) | biology UP |
| scale_reading | db:1101 Weather and climate | geography LS |
| climate_graph | db:1115 Climate and climate change in Rwanda | geography LS |
| population_pyramid | db:1105 Population and settlement | geography LS |
| cross_section | db:1112 Relief in Rwanda | geography LS |
| supply_demand | waec:Economics:1 Demand and supply | economics UP |
| break_even | jamb:Commerce:2 Finance | business UP |
| notice, timetable | checkpoint:lower-secondary:0876:0 Reading and Usage | English LS |
| timeline | db:162 The Cold War, or db:1057 African nationalism, depending on its set | history UP |

- [ ] **Step 1: Write the failing tests**

Create `scripts/figgen/tests/test_generate.py`:

```python
import json
import random

import pytest

from figgen.families import FAMILIES, timeline
from figgen.generate import generate_family
from figgen.pilot import PILOT, TIMELINE, topics_for
from figgen.store import open_store

# The pilot's topics as they are in the staging store (checked 2026-10-12).
TOPICS = {
    "db:410": ("mathematics", "LS"), "db:141": ("mathematics", "UP"), "db:153": ("mathematics", "UP"),
    "db:4295": ("mathematics", "LS"), "db:489": ("mathematics", "P"), "db:111": ("biology", "UP"),
    "db:3856": ("biology", "UP"), "db:1101": ("geography", "LS"), "db:1115": ("geography", "LS"),
    "db:1105": ("geography", "LS"), "db:1112": ("geography", "LS"), "waec:Economics:1": ("economics", "UP"),
    "jamb:Commerce:2": ("business", "UP"), "checkpoint:lower-secondary:0876:0": ("english", "LS"),
    "db:162": ("history", "UP"), "db:1057": ("history", "UP"),
}


@pytest.fixture
def db(tmp_path):
    store = open_store(tmp_path / "figures.db")
    store.executemany("INSERT INTO topics (key, source, book, subject, band, name) VALUES (?, 'test', 'Book', ?, ?, ?)",
                      [(k, s, b, k) for k, (s, b) in TOPICS.items()])
    store.commit()
    return store


def test_every_family_has_pilot_topics_at_its_level():
    assert set(PILOT) | {"timeline"} == set(FAMILIES)
    assert set(TIMELINE) == set(timeline.SETS)
    for fid, m in FAMILIES.items():
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


def test_draws_distinct_figures_and_their_files(db, tmp_path):
    lib = tmp_path / "lib"
    r = generate_family(db, lib, FAMILIES["bar_chart"], 5)
    assert (r["have"], r["drawn"]) == (5, 5)
    rows = db.execute("SELECT id, spec, asset, preview, width, band, subject FROM figures").fetchall()
    assert len(rows) == 5 and len({row["spec"] for row in rows}) == 5
    for row in rows:
        assert (lib / row["asset"]).read_text(encoding="utf-8").lstrip().startswith("<?xml")
        assert (lib / row["preview"]).read_bytes()[:4] == b"\x89PNG" and row["width"] > 100
        assert (row["band"], row["subject"]) == ("LS", "mathematics")
    assert db.execute("SELECT COUNT(*) FROM figure_questions").fetchone()[0] == 15  # three questions each
    assert db.execute("SELECT COUNT(*) FROM figure_topics WHERE topic_key = 'db:410'").fetchone()[0] == 5


def test_a_second_run_keeps_what_is_there(db, tmp_path):
    lib = tmp_path / "lib"
    generate_family(db, lib, FAMILIES["bar_chart"], 5)
    again = generate_family(db, lib, FAMILIES["bar_chart"], 7)
    assert (again["have"], again["drawn"]) == (7, 2)
    assert db.execute("SELECT COUNT(*) FROM figures").fetchone()[0] == 7
    assert db.execute("SELECT COUNT(*) FROM figure_questions").fetchone()[0] == 21


def test_redo_redraws_the_family_and_drops_its_reviews(db, tmp_path):
    lib = tmp_path / "lib"
    generate_family(db, lib, FAMILIES["bar_chart"], 3)
    db.execute("INSERT INTO reviews (job, figure_id, model, pass, detail, at) SELECT 'p1a-review', id, 'm', 0, '{}', 'now' FROM figures")
    db.commit()
    r = generate_family(db, lib, FAMILIES["bar_chart"], 3, redo=True)
    assert r["drawn"] == 3
    assert db.execute("SELECT COUNT(*) FROM reviews").fetchone()[0] == 0


def test_refuses_a_topic_outside_the_family_levels(db, tmp_path):
    db.execute("UPDATE topics SET band = 'AL' WHERE key = 'db:410'")
    db.commit()
    with pytest.raises(ValueError, match="db:410"):
        generate_family(db, tmp_path / "lib", FAMILIES["bar_chart"], 1)


def test_timeline_figures_go_to_the_topic_of_their_set(db, tmp_path):
    generate_family(db, tmp_path / "lib", FAMILIES["timeline"], 6)
    rows = db.execute("SELECT f.spec, t.topic_key FROM figures f JOIN figure_topics t ON t.figure_id = f.id").fetchall()
    assert len(rows) == 6
    for row in rows:
        assert row["topic_key"] == TIMELINE[json.loads(row["spec"])["title"]][0]
```

- [ ] **Step 2: Run them to see them fail**

Run: `python -m pytest scripts/figgen/tests/test_generate.py -q`
Expected: FAIL: `ModuleNotFoundError: No module named 'figgen.generate'`.

- [ ] **Step 3: Write `scripts/figgen/pilot.py`**

```python
"""Which pilot topic each drawn family's figures are made for (P1a).

Each topic's mapped figure kinds include the family's kind, and its level is
one the family draws for. Six subjects: maths, biology, geography, economics
and business, English, history.
"""
from __future__ import annotations

PILOT = {
    "bar_chart": ["db:410"], "pie_chart": ["db:410"], "scatter_graph": ["db:410"],  # Maths LS: Statistical investigations
    "line_graph": ["db:141"], "box_plot": ["db:141"],  # Maths UP: Averages and measures of spread
    "tree_diagram": ["db:153"],  # Maths UP: Probability using tree diagrams
    "angles": ["db:4295"],  # Maths LS: Calculating angles
    "number_line": ["db:489"], "coordinates": ["db:489"],  # Maths P: Numbers and sequences
    "punnett": ["db:111"],  # Biology UP: Genetics
    "food_web": ["db:3856"],  # NERDC SS2 Biology: Ecology
    "scale_reading": ["db:1101"],  # Geography LS: Weather and climate
    "climate_graph": ["db:1115"],  # Geography LS: Climate and climate change in Rwanda
    "population_pyramid": ["db:1105"],  # Geography LS: Population and settlement
    "cross_section": ["db:1112"],  # Geography LS: Relief in Rwanda
    "supply_demand": ["waec:Economics:1"],  # WAEC Economics: Demand and supply
    "break_even": ["jamb:Commerce:2"],  # JAMB Commerce: Finance
    "notice": ["checkpoint:lower-secondary:0876:0"],  # Checkpoint English: Reading and Usage
    "timetable": ["checkpoint:lower-secondary:0876:0"],
}
# A timeline goes to the history topic its events belong to.
TIMELINE = {"The Cold War": ["db:162"], "Independence in Africa": ["db:1057"]}


def topics_for(family: str, params: dict) -> list[str]:
    if family == "timeline":
        return TIMELINE[params["title"]]
    return PILOT[family]
```

- [ ] **Step 4: Write `scripts/figgen/generate.py`**

```python
"""Draws the pilot's figures into the staging store and the local asset folder (spec 5.2, 5.6).

Run from the repo root:
    python scripts/figgen/generate.py [--per-family 30] [--families bar_chart,pie_chart] [--redo]

Files land at <FIGURE_LIBRARY_DIR>/assets/drawn/<family>/<seed>.svg and .png,
laid out as the S3 keys will be. Resumable: seeds already stored are kept, so a
stopped run carries on where it stopped. --redo redraws a family from scratch,
for after a fix, and drops its old reviews.
"""
from __future__ import annotations

import argparse
import json
import random
import sys
from pathlib import Path

if __package__ in (None, ""):  # run as a script: make "figgen" importable
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from figgen.core import render  # noqa: E402
from figgen.families import FAMILIES  # noqa: E402
from figgen.pilot import topics_for  # noqa: E402
from figgen.store import delete_family, has_figure, library_dir, open_store, save_drawn, topic  # noqa: E402


def figure_id(family: str, seed: int) -> str:
    return f"drawn/{family}/{seed}"


def png_size(png: bytes) -> tuple[int, int]:
    return int.from_bytes(png[16:20], "big"), int.from_bytes(png[20:24], "big")


def generate_family(db, lib: Path, m, count: int, redo: bool = False, max_seeds: int = 5000) -> dict:
    """Draws figures for one family until it has `count` different ones."""
    if redo:
        for key in delete_family(db, m.ID):
            (lib / key).unlink(missing_ok=True)
    seen: set[str] = set()
    have = drawn = seed = 0
    while have < count:
        seed += 1
        if seed > max_seeds:
            raise RuntimeError(f"{m.ID}: only {have} different figures in {max_seeds} seeds")
        rng = random.Random(seed)
        params = m.sample(rng)
        key = json.dumps(params, sort_keys=True)
        if key in seen:  # the same figure as an earlier seed: never store it twice
            continue
        seen.add(key)
        fid = figure_id(m.ID, seed)
        if has_figure(db, fid):
            have += 1
            continue
        questions = m.questions(params, rng)
        keys = topics_for(m.ID, params)
        first = topic(db, keys[0])
        if first["band"] not in m.BANDS:
            raise ValueError(f"{m.ID} draws for {', '.join(m.BANDS)}, but {keys[0]} is {first['band']}")
        out = render(m.draw(params))
        asset, preview = f"assets/{fid}.svg", f"assets/{fid}.png"
        (lib / asset).parent.mkdir(parents=True, exist_ok=True)
        (lib / asset).write_text(out.svg, encoding="utf-8")
        (lib / preview).write_bytes(out.png)
        width, height = png_size(out.png)
        save_drawn(db, figure_id=fid, family=m.ID, kind=m.KIND, subject=first["subject"], band=first["band"],
                   topics=keys, seed=seed, spec=params, questions=questions, asset=asset, preview=preview,
                   width=width, height=height)
        have += 1
        drawn += 1
    return {"family": m.ID, "have": have, "drawn": drawn}


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="Draw the P1a pilot's figures into the staging store")
    ap.add_argument("--per-family", type=int, default=30)
    ap.add_argument("--families", default="", help="comma-separated family ids; all when left out")
    ap.add_argument("--redo", action="store_true", help="redraw these families from scratch, dropping their reviews")
    a = ap.parse_args(argv)
    ids = [f.strip() for f in a.families.split(",") if f.strip()] or list(FAMILIES)
    unknown = [f for f in ids if f not in FAMILIES]
    if unknown:
        ap.error(f"unknown families: {', '.join(unknown)}")
    lib = library_dir()
    db = open_store()
    for fid in ids:
        r = generate_family(db, lib, FAMILIES[fid], a.per_family, redo=a.redo)
        print(f"{fid:20s} {r['have']} figures ({r['drawn']} new)")
    total = db.execute("SELECT COUNT(*) FROM figures WHERE origin = 'drawn'").fetchone()[0]
    print(f"{total} drawn figures in the store at {lib}")
    db.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 5: Run the generator tests, then the whole Python suite**

Run: `python -m pytest scripts/figgen/tests/test_generate.py -q && python -m pytest scripts/figgen -q`
Expected: PASS, 7 passed, then 133 passed.

- [ ] **Step 6: Commit**

```bash
git add scripts/figgen/pilot.py scripts/figgen/generate.py scripts/figgen/tests/test_generate.py
git commit -m "feat(figgen): draw the pilot's figures into the staging store, resumably"
```

---

### Task 5: Images and Sonnet in the model call

**Files:**
- Modify: `scripts/figure-library/claude.ts`
- Test: `scripts/figure-library/claude.test.ts`

**Interfaces:**
- Produces:
  - `SONNET = 'eu.anthropic.claude-sonnet-5-5'`
  - `interface ImageInput { mediaType: 'image/png' | 'image/jpeg' | 'image/webp'; data: string }`, where `data` is base64
  - `SendFn = (model, prompt, maxTokens, images?: readonly ImageInput[]) => Promise<ModelReply>`
  - `requestBody(model, prompt, maxTokens, images = []) -> Record<string, unknown>`
  - `askJson({... , images?: readonly ImageInput[]})`, which passes the images to `send`
  - A request with no images is sent exactly as before.

- [ ] **Step 1: Write the failing tests**

In `scripts/figure-library/claude.test.ts`, change the import to:

```ts
import { HAIKU, SONNET, askJson, extractJson, requestBody, runPool, type ImageInput, type SendFn } from './claude'
```

and add:

```ts
describe('the request sent to Bedrock', () => {
  it('sends words alone to Haiku, as before', () => {
    expect(requestBody(HAIKU, 'hello', 100)).toEqual({
      anthropic_version: 'bedrock-2023-05-31', max_tokens: 100, messages: [{ role: 'user', content: 'hello' }],
    })
  })

  it('puts images before the words, and gives Sonnet an effort setting instead of a temperature', () => {
    const body = requestBody(SONNET, 'check this', 500, [{ mediaType: 'image/png', data: 'iVBOR' }]) as {
      messages: { content: unknown }[]; output_config?: unknown
    }
    expect(body.messages[0].content).toEqual([
      { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'iVBOR' } },
      { type: 'text', text: 'check this' },
    ])
    expect(body.output_config).toEqual({ effort: 'low' })
    expect(body).not.toHaveProperty('temperature')
  })
})

describe('asking about an image', () => {
  it('passes the images through to the model', async () => {
    const db = openStore(':memory:')
    let seen: readonly ImageInput[] | undefined
    const send: SendFn = async (_m, _p, _t, images) => {
      seen = images
      return { text: '{"ok":1}', inputTokens: 10, outputTokens: 10 }
    }
    await askJson({ db, job: 't', jobCapUsd: 1, prompt: 'p', maxTokens: 50, send, images: [{ mediaType: 'image/png', data: 'x' }], wait: noWait })
    expect(seen).toEqual([{ mediaType: 'image/png', data: 'x' }])
  })

  it('counts a reply with no usage figures at its worst case, images included', async () => {
    const db = openStore(':memory:')
    const send: SendFn = async () => ({ text: '{"ok":1}', inputTokens: 0, outputTokens: 0 })
    await askJson({ db, job: 't', jobCapUsd: 1, prompt: 'abc', maxTokens: 100, send, model: SONNET, images: [{ mediaType: 'image/png', data: 'x' }], wait: noWait })
    expect(db.prepare('SELECT input_tokens AS i, output_tokens AS o FROM spend').get()).toEqual({ i: 1 + 1600, o: 100 })
  })
})
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run scripts/figure-library/claude.test.ts`
Expected: FAIL: `requestBody` and `SONNET` are not exported (TypeError: requestBody is not a function).

- [ ] **Step 3: Implement**

In `scripts/figure-library/claude.ts`:

Under `export const HAIKU = ...`, add:

```ts
export const SONNET = 'eu.anthropic.claude-sonnet-5-5'

/** An image sent with a prompt, base64-encoded. */
export interface ImageInput {
  mediaType: 'image/png' | 'image/jpeg' | 'image/webp'
  data: string
}

/** What one image is counted as when a reply carries no usage figures: a 1,200 px figure is about 1,600 tokens. */
const IMAGE_TOKENS_WORST = 1600
```

Replace the `SendFn` type with:

```ts
export type SendFn = (model: string, prompt: string, maxTokens: number, images?: readonly ImageInput[]) => Promise<ModelReply>

/**
 * The InvokeModel body. Images go before the words. Sonnet refuses a
 * temperature, so it gets an effort setting instead, as the repo's other
 * Sonnet scripts do. A prompt with no images is sent exactly as before.
 */
export function requestBody(model: string, prompt: string, maxTokens: number, images: readonly ImageInput[] = []): Record<string, unknown> {
  const content = images.length
    ? [
        ...images.map((i) => ({ type: 'image', source: { type: 'base64', media_type: i.mediaType, data: i.data } })),
        { type: 'text', text: prompt },
      ]
    : prompt
  return {
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: maxTokens,
    ...(/sonnet|opus/.test(model) ? { output_config: { effort: 'low' } } : {}),
    messages: [{ role: 'user', content }],
  }
}
```

In `bedrockSender`, change `return async (model, prompt, maxTokens) => {` to `return async (model, prompt, maxTokens, images) => {`, and replace the `body: JSON.stringify({...})` property with:

```ts
      body: JSON.stringify(requestBody(model, prompt, maxTokens, images ?? [])),
```

In `askJson`, add `images?: readonly ImageInput[]` to the options type after `send: SendFn`. Change the call to `reply = await o.send(model, o.prompt, o.maxTokens, o.images)`, and change the worst-case input count to:

```ts
      inputTokens: reply.inputTokens || Math.ceil(o.prompt.length / 3) + IMAGE_TOKENS_WORST * (o.images?.length ?? 0),
```

- [ ] **Step 4: Run them to see them pass, then the suite and tsc**

Run: `npx vitest run scripts/figure-library && npx tsc --noEmit -p .`
Expected: every test passes; tsc prints nothing.

- [ ] **Step 5: Commit**

```bash
git add scripts/figure-library/claude.ts scripts/figure-library/claude.test.ts
git commit -m "feat(figure-library): send images to the model, and Sonnet's effort setting"
```

---

### Task 6: The blind review

**Files:**
- Create: `scripts/figure-library/review.ts`, `scripts/figure-library/review-drawn.ts`
- Test: `scripts/figure-library/review.test.ts`

**Interfaces:**
- Consumes:
  - The `figures`, `figure_questions` and `reviews` tables (Task 2).
  - `SONNET`, `ImageInput`, `askJson`, `bedrockSender` and `runPool` (Task 5).
  - `assertBudget`, `totalSpend` and `BudgetExceeded` (spend.ts).
  - `parseArgs` (args.ts), and `libraryDir`, `openStore` and `readJson` (store.ts).
- Produces:
  - `REVIEW_JOB = 'p1a-review'`, `REVIEW_SIZE = 30`, `PASS_MARK = 27`, `REVIEW_USD_PER_ITEM = 0.008`
  - Types `ReviewItem`, `ReviewQuestion`, `Verdict` and `QuestionVerdict`
  - `reviewPrompt(item) -> string`
  - `parseVerdict(raw, item) -> Verdict`, which throws on a malformed reply
  - `itemsToReview(db, {job, size, families?}) -> ReviewItem[]`
  - `saveVerdict(db, {job, model, figureId, verdict})`
  - `familyScores(db, job) -> {family, reviewed, passed, passes}[]`
  - `previewImage(lib, item) -> ImageInput | null`
  - CLI: `npx jiti scripts/figure-library/review-drawn.ts [--families=a,b] [--dry] [--workers=4]`

- [ ] **Step 1: Write the failing tests**

Create `scripts/figure-library/review.test.ts`:

```ts
// scripts/figure-library/review.test.ts
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { openStore, type Store } from './store'
import { PASS_MARK, REVIEW_SIZE, familyScores, itemsToReview, parseVerdict, previewImage, reviewPrompt, saveVerdict, type ReviewItem } from './review'

function store(): Store {
  const db = openStore(':memory:')
  db.prepare("INSERT INTO topics (key, source, book, subject, band, name) VALUES ('db:410', 'rwanda', 'Book', 'mathematics', 'LS', 'Statistics')").run()
  return db
}

function addFigure(db: Store, family: string, seed: number): string {
  const id = `drawn/${family}/${seed}`
  db.prepare(`INSERT INTO figures (id, origin, family, kind, subject, band, asset, preview, seed, spec, status, created_at)
    VALUES (?, 'drawn', ?, 'graph.bar', 'mathematics', 'LS', ?, ?, ?, '{}', 'stored', 'now')`).run(id, family, `assets/${id}.svg`, `assets/${id}.png`, seed)
  db.prepare(`INSERT INTO figure_questions (id, figure_id, n, band, kind, stem, options, answer, accepted, model)
    VALUES (?, ?, 1, 'LS', 'mcq', 'Which fruit was most popular?', '["Mango","Apple","Orange"]', '0', '[]', 'code')`).run(`${id}#1`, id)
  db.prepare(`INSERT INTO figure_questions (id, figure_id, n, band, kind, stem, options, answer, accepted, model)
    VALUES (?, ?, 2, 'LS', 'short', 'How many students were asked?', '[]', '40', '["40","40 students"]', 'code')`).run(`${id}#2`, id)
  return id
}

const item: ReviewItem = {
  figureId: 'drawn/bar_chart/1', family: 'bar_chart', subject: 'mathematics', band: 'LS', preview: 'assets/drawn/bar_chart/1.png',
  questions: [
    { n: 1, kind: 'mcq', stem: 'Which fruit was most popular?', options: ['Mango', 'Apple', 'Orange'], answer: '0', accepted: [] },
    { n: 2, kind: 'short', stem: 'How many students were asked?', options: [], answer: '40', accepted: ['40', '40 students'] },
  ],
}

const good = {
  questions: [
    { n: 1, worked: 'The mango bar is tallest', own_answer: 'A', key_correct: true, answerable: true, problem: '' },
    { n: 2, worked: '12 + 10 + 18', own_answer: '40', key_correct: true, answerable: true, problem: '' },
  ],
  figure_clear: true, educational: true, problems: [],
}

describe('the blind review prompt', () => {
  it('shows every question with its key, options lettered', () => {
    const p = reviewPrompt(item)
    expect(p).toContain('A) Mango')
    expect(p).toContain('Key: A')
    expect(p).toContain('Key: 40 (also accepted: 40 students)')
    expect(p).toContain('Lower Secondary')
  })

  it('does not say where the figure came from', () => {
    // Spec 5.5: the reviewer cannot see where an item came from.
    expect(reviewPrompt(item)).not.toMatch(/bar_chart|drawn|generated|\bcode\b|seed|family/i)
  })
})

describe('reading a verdict', () => {
  it('passes only when the figure and every question are sound', () => {
    expect(parseVerdict(good, item).pass).toBe(true)
    const wrongKey = { ...good, questions: [good.questions[0], { ...good.questions[1], key_correct: false, own_answer: '38' }] }
    expect(parseVerdict(wrongKey, item).pass).toBe(false)
    expect(parseVerdict({ ...good, figure_clear: false }, item).pass).toBe(false)
  })

  it('works the pass out itself, whatever the reviewer claims', () => {
    expect(parseVerdict({ ...good, pass: true, educational: false }, item).pass).toBe(false)
  })

  it('refuses a reply that skips a question or a judgement', () => {
    expect(() => parseVerdict({ ...good, questions: [good.questions[0]] }, item)).toThrow(/question 2/)
    expect(() => parseVerdict({ questions: good.questions }, item)).toThrow(/figure_clear/)
    expect(() => parseVerdict({ ...good, questions: [good.questions[0], { n: 2, key_correct: 'yes', answerable: true }] }, item)).toThrow(/question 2/)
    expect(() => parseVerdict(null, item)).toThrow()
  })
})

describe('choosing figures to review', () => {
  it('takes the earliest seeds of each family, and skips any already reviewed', () => {
    const db = store()
    for (let s = 1; s <= 4; s++) addFigure(db, 'bar_chart', s)
    addFigure(db, 'pie_chart', 1)
    saveVerdict(db, { job: 'j', model: 'm', figureId: 'drawn/bar_chart/1', verdict: parseVerdict(good, item) })
    const items = itemsToReview(db, { job: 'j', size: 3 })
    expect(items.map((i) => i.figureId)).toEqual(['drawn/bar_chart/2', 'drawn/bar_chart/3', 'drawn/pie_chart/1'])
    expect(items[0].questions[1]).toEqual({ n: 2, kind: 'short', stem: 'How many students were asked?', options: [], answer: '40', accepted: ['40', '40 students'] })
  })

  it('keeps to the families asked for', () => {
    const db = store()
    addFigure(db, 'bar_chart', 1)
    addFigure(db, 'pie_chart', 1)
    expect(itemsToReview(db, { job: 'j', size: 30, families: ['pie_chart'] }).map((i) => i.figureId)).toEqual(['drawn/pie_chart/1'])
  })
})

describe('recording a verdict', () => {
  it('rejects a failed figure, with the reviewer reasons', () => {
    const db = store()
    const id = addFigure(db, 'bar_chart', 1)
    const bad = parseVerdict({ ...good, questions: [good.questions[0], { ...good.questions[1], key_correct: false, own_answer: '38', problem: 'the bars add to 38' }] }, item)
    saveVerdict(db, { job: 'j', model: 'm', figureId: id, verdict: bad })
    const f = db.prepare('SELECT status, reason FROM figures WHERE id = ?').get(id) as { status: string; reason: string }
    expect(f.status).toBe('rejected')
    expect(f.reason).toContain('Q2: the bars add to 38')
  })

  it('keeps one verdict per figure per job, the latest', () => {
    const db = store()
    const id = addFigure(db, 'bar_chart', 1)
    saveVerdict(db, { job: 'j', model: 'm', figureId: id, verdict: parseVerdict({ ...good, figure_clear: false }, item) })
    saveVerdict(db, { job: 'j', model: 'm', figureId: id, verdict: parseVerdict(good, item) })
    expect(db.prepare('SELECT COUNT(*) AS n, MAX(pass) AS p FROM reviews').get()).toEqual({ n: 1, p: 1 })
    expect(db.prepare('SELECT status, reason FROM figures WHERE id = ?').get(id)).toEqual({ status: 'stored', reason: null })
  })
})

describe('family scores', () => {
  it('passes a family at 27 of 30, not below, and not before 30 are reviewed', () => {
    const db = store()
    const fill = (family: string, n: number, failures: number) => {
      for (let s = 1; s <= n; s++) {
        const id = addFigure(db, family, s)
        saveVerdict(db, { job: 'j', model: 'm', figureId: id, verdict: { ...parseVerdict(good, item), pass: s > failures } })
      }
    }
    fill('a', 30, 3)
    fill('b', 30, 4)
    fill('c', 20, 0)
    expect(familyScores(db, 'j')).toEqual([
      { family: 'a', reviewed: 30, passed: 27, passes: true },
      { family: 'b', reviewed: 30, passed: 26, passes: false },
      { family: 'c', reviewed: 20, passed: 20, passes: false },
    ])
    expect([REVIEW_SIZE, PASS_MARK]).toEqual([30, 27])
  })
})

describe('the figure image for the reviewer', () => {
  it('is the PNG from the library folder', () => {
    const lib = fs.mkdtempSync(path.join(os.tmpdir(), 'figlib-prev-'))
    fs.mkdirSync(path.join(lib, 'assets/drawn/bar_chart'), { recursive: true })
    fs.writeFileSync(path.join(lib, item.preview), Buffer.from([0x89, 0x50, 0x4e, 0x47]))
    expect(previewImage(lib, item)).toEqual({ mediaType: 'image/png', data: 'iVBORw==' })
  })

  it('is null when the file is missing, so nothing is sent or paid for', () => {
    expect(previewImage(os.tmpdir(), { preview: 'assets/none/0.png' })).toBeNull()
  })
})
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run scripts/figure-library/review.test.ts`
Expected: FAIL: `Failed to resolve import "./review"`.

- [ ] **Step 3: Write `scripts/figure-library/review.ts`**

```ts
// scripts/figure-library/review.ts
import fs from 'node:fs'
import path from 'node:path'
import { readJson, type Store } from './store'
import type { ImageInput } from './claude'

export const REVIEW_JOB = 'p1a-review'
/** Spec 3.3: a family passes a blind review of 30 items scoring 27 or better. */
export const REVIEW_SIZE = 30
export const PASS_MARK = 27
/** A figure (about 800 tokens), the prompt (about 600) and a worked check of each question (about 450 out). */
export const REVIEW_USD_PER_ITEM = 0.008

const LEVELS: Record<string, string> = {
  P: 'Primary (ages 6 to 11)',
  LS: 'Lower Secondary (ages 11 to 14)',
  UP: 'Upper Secondary: IGCSE, senior secondary, WAEC (ages 14 to 17)',
  AL: 'AS and A Level (ages 16 to 18)',
}

export interface ReviewQuestion { n: number; kind: string; stem: string; options: string[]; answer: string; accepted: string[] }
export interface ReviewItem { figureId: string; family: string; subject: string; band: string; preview: string; questions: ReviewQuestion[] }
export interface QuestionVerdict { n: number; ownAnswer: string; keyCorrect: boolean; answerable: boolean; problem: string }
export interface Verdict { pass: boolean; figureClear: boolean; educational: boolean; questions: QuestionVerdict[]; problems: string[] }

const letter = (i: number) => String.fromCharCode(65 + i)

/** The words sent with the figure. Blind: nothing says how the figure was made or what family it is from. */
export function reviewPrompt(item: ReviewItem): string {
  const questions = item.questions.map((q) => {
    if (q.kind === 'mcq') {
      const options = q.options.map((o, i) => `   ${letter(i)}) ${o}`).join('\n')
      return `${q.n}. [multiple choice] ${q.stem}\n${options}\n   Key: ${letter(Number(q.answer))}`
    }
    const also = q.accepted.slice(1)
    return `${q.n}. [short answer] ${q.stem}\n   Key: ${q.answer}${also.length ? ` (also accepted: ${also.join('; ')})` : ''}`
  }).join('\n\n')
  return [
    'You are checking one exam figure and its questions before they are given to students.',
    `Subject: ${item.subject}. Level: ${LEVELS[item.band] ?? item.band}.`,
    '',
    'The figure is attached. These are its questions, each with its answer key:',
    '',
    questions,
    '',
    'For each question, work it out yourself from the figure first, then compare your answer with the key.',
    'Judge:',
    '- key_correct: the key is the right answer, and for multiple choice no other option is also right.',
    '- answerable: a student at this level can answer it from the figure and the question alone; nothing is unclear or missing.',
    '- figure_clear: every label, number and line the questions need is legible and unambiguous; nothing overlaps or is cut off.',
    '- educational: the figure teaches or tests something real in this subject at this level.',
    '',
    'Reply with JSON only, in this shape:',
    '{"questions":[{"n":1,"worked":"one or two lines","own_answer":"...","key_correct":true,"answerable":true,"problem":""}],"figure_clear":true,"educational":true,"problems":[]}',
  ].join('\n')
}

/**
 * The reviewer's reply as a verdict. The pass is worked out here from its
 * parts, never taken from the model, and a reply that leaves out a question
 * or a judgement is refused rather than read as a pass.
 */
export function parseVerdict(raw: unknown, item: ReviewItem): Verdict {
  if (!raw || typeof raw !== 'object') throw new Error('The review is not a JSON object')
  const r = raw as { questions?: unknown; figure_clear?: unknown; educational?: unknown; problems?: unknown }
  if (typeof r.figure_clear !== 'boolean' || typeof r.educational !== 'boolean') {
    throw new Error('The review has no figure_clear or educational judgement')
  }
  const given = Array.isArray(r.questions) ? (r.questions as Record<string, unknown>[]) : []
  const questions = item.questions.map((q) => {
    const v = given.find((x) => x && Number(x.n) === q.n)
    if (!v || typeof v.key_correct !== 'boolean' || typeof v.answerable !== 'boolean') {
      throw new Error(`The review does not judge question ${q.n}`)
    }
    return { n: q.n, ownAnswer: String(v.own_answer ?? ''), keyCorrect: v.key_correct, answerable: v.answerable, problem: String(v.problem ?? '') }
  })
  const problems = Array.isArray(r.problems) ? r.problems.map(String).filter(Boolean) : []
  const pass = r.figure_clear && r.educational && questions.every((q) => q.keyCorrect && q.answerable)
  return { pass, figureClear: r.figure_clear, educational: r.educational, questions, problems }
}

/**
 * Up to `size` figures from each family, earliest seeds first, leaving out
 * any this job has already reviewed, so a stopped run carries on without
 * paying twice. Rejected figures stay in the sample: they count against the
 * family.
 */
export function itemsToReview(db: Store, o: { job: string; size: number; families?: readonly string[] }): ReviewItem[] {
  const families = o.families?.length
    ? o.families
    : (db.prepare("SELECT DISTINCT family FROM figures WHERE origin = 'drawn' ORDER BY family").all() as { family: string }[]).map((r) => r.family)
  const pick = db.prepare("SELECT id, family, subject, band, preview FROM figures WHERE origin = 'drawn' AND family = ? ORDER BY seed LIMIT ?")
  const reviewed = db.prepare('SELECT 1 FROM reviews WHERE job = ? AND figure_id = ?')
  const questionsOf = db.prepare('SELECT n, kind, stem, options, answer, accepted FROM figure_questions WHERE figure_id = ? ORDER BY n')
  const items: ReviewItem[] = []
  for (const family of families) {
    for (const f of pick.all(family, o.size) as { id: string; family: string; subject: string; band: string; preview: string | null }[]) {
      if (reviewed.get(o.job, f.id)) continue
      const questions = (questionsOf.all(f.id) as { n: number; kind: string; stem: string; options: string; answer: string; accepted: string }[])
        .map((q) => ({ n: q.n, kind: q.kind, stem: q.stem, options: readJson<string[]>(q.options, []), answer: q.answer, accepted: readJson<string[]>(q.accepted, []) }))
      items.push({ figureId: f.id, family: f.family, subject: f.subject, band: f.band, preview: f.preview ?? '', questions })
    }
  }
  return items
}

function reasonFor(v: Verdict): string {
  const parts = [
    ...(v.figureClear ? [] : ['figure unclear']),
    ...(v.educational ? [] : ['not educational']),
    ...v.questions
      .filter((q) => !q.keyCorrect || !q.answerable)
      .map((q) => `Q${q.n}: ${q.problem || (q.keyCorrect ? 'not answerable' : `key wrong (reviewer: ${q.ownAnswer})`)}`),
    ...v.problems,
  ]
  return (parts.join('; ') || 'failed review').slice(0, 600)
}

/** Records one verdict, replacing any earlier one for this job. A failed figure is rejected, with the reasons. */
export function saveVerdict(db: Store, o: { job: string; model: string; figureId: string; verdict: Verdict }): void {
  db.exec('BEGIN')
  try {
    db.prepare(`INSERT INTO reviews (job, figure_id, model, pass, detail, at) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(job, figure_id) DO UPDATE SET model = excluded.model, pass = excluded.pass, detail = excluded.detail, at = excluded.at`)
      .run(o.job, o.figureId, o.model, o.verdict.pass ? 1 : 0, JSON.stringify(o.verdict), new Date().toISOString())
    if (o.verdict.pass) {
      db.prepare("UPDATE figures SET status = 'stored', reason = NULL WHERE id = ? AND status = 'rejected'").run(o.figureId)
    } else {
      db.prepare("UPDATE figures SET status = 'rejected', reason = ? WHERE id = ?").run(reasonFor(o.verdict), o.figureId)
    }
    db.exec('COMMIT')
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
}

export interface FamilyScore { family: string; reviewed: number; passed: number; passes: boolean }

/** Each family's score in this job. A family passes at 27 of 30; fewer than 30 reviewed is not yet a pass. */
export function familyScores(db: Store, job: string): FamilyScore[] {
  const rows = db.prepare(`SELECT f.family AS family, COUNT(*) AS reviewed, SUM(r.pass) AS passed
    FROM reviews r JOIN figures f ON f.id = r.figure_id WHERE r.job = ? GROUP BY f.family ORDER BY f.family`)
    .all(job) as { family: string; reviewed: number; passed: number }[]
  return rows.map((r) => ({
    family: r.family,
    reviewed: Number(r.reviewed),
    passed: Number(r.passed),
    passes: Number(r.reviewed) >= REVIEW_SIZE && Number(r.passed) >= PASS_MARK,
  }))
}

/** The figure's PNG for the reviewer, or null when the file is missing: then nothing is sent or paid for. */
export function previewImage(lib: string, item: Pick<ReviewItem, 'preview'>): ImageInput | null {
  if (!item.preview) return null
  const file = path.join(lib, item.preview)
  if (!fs.existsSync(file)) return null
  return { mediaType: 'image/png', data: fs.readFileSync(file).toString('base64') }
}
```

- [ ] **Step 4: Run them to see them pass**

Run: `npx vitest run scripts/figure-library/review.test.ts`
Expected: PASS, 12 tests.

- [ ] **Step 5: Write `scripts/figure-library/review-drawn.ts`**

```ts
// scripts/figure-library/review-drawn.ts
// Run: npx jiti scripts/figure-library/review-drawn.ts [--families=bar_chart,pie_chart] [--dry] [--workers=4]
// The blind review of the drawn families (spec 5.5): Sonnet checks 30 figures
// from each family, with their questions and keys; 27 must pass. Resumable.
import { libraryDir, openStore } from './store'
import { parseArgs } from './args'
import { BudgetExceeded, assertBudget, totalSpend } from './spend'
import { SONNET, askJson, bedrockSender, runPool } from './claude'
import { REVIEW_JOB, REVIEW_SIZE, REVIEW_USD_PER_ITEM, familyScores, itemsToReview, parseVerdict, previewImage, reviewPrompt, saveVerdict } from './review'

/** Spec section 8 gives drawn reviews $60 over about 250 families; the pilot's 20 need about $5. */
const JOB_CAP_USD = 8
/** More unusable replies than this means something is wrong with every call, not with one figure. */
const MAX_UNUSABLE = 10

async function main() {
  const args = parseArgs(process.argv.slice(2), { families: 'string', dry: 'flag', workers: 'int' })
  const families = args.families ? String(args.families).split(',').map((f) => f.trim()).filter(Boolean) : undefined
  const db = openStore()
  const lib = libraryDir()
  const items = itemsToReview(db, { job: REVIEW_JOB, size: REVIEW_SIZE, families })
  const estimate = items.length * REVIEW_USD_PER_ITEM
  console.log(`${items.length} figures to review, estimate $${estimate.toFixed(2)}`)
  if (args.dry) {
    db.close()
    return
  }
  assertBudget(db, { job: REVIEW_JOB, estimateUsd: estimate, jobCapUsd: JOB_CAP_USD })
  const send = bedrockSender()
  const unusable: string[] = []
  let done = 0
  try {
    await runPool(items, (args.workers as number | undefined) ?? 4, async (item) => {
      const image = previewImage(lib, item)
      if (!image) {
        unusable.push(`${item.figureId}: no preview file`)
        return
      }
      try {
        const raw = await askJson({ db, job: REVIEW_JOB, jobCapUsd: JOB_CAP_USD, prompt: reviewPrompt(item), images: [image], maxTokens: 2500, send, model: SONNET })
        saveVerdict(db, { job: REVIEW_JOB, model: SONNET, figureId: item.figureId, verdict: parseVerdict(raw, item) })
      } catch (err) {
        if (err instanceof BudgetExceeded) throw err
        unusable.push(`${item.figureId}: ${(err as Error).message}`)
        if (unusable.length > MAX_UNUSABLE) throw new Error(`Stopping: ${unusable.length} reviews failed. Last: ${unusable[unusable.length - 1]}`)
        return
      }
      if (++done % 20 === 0) console.log(`  ${done}/${items.length} reviewed, $${totalSpend(db, REVIEW_JOB).toFixed(2)}`)
    })
  } catch (err) {
    if (!(err instanceof BudgetExceeded)) throw err
    console.log(err.message)
  } finally {
    for (const s of familyScores(db, REVIEW_JOB)) {
      const state = s.passes ? 'pass' : s.reviewed < REVIEW_SIZE ? 'incomplete' : 'FAIL'
      console.log(`${s.family.padEnd(20)} ${String(s.passed).padStart(2)}/${s.reviewed}  ${state}`)
    }
    if (unusable.length) console.log(`${unusable.length} not reviewed (run again to retry):\n  ${unusable.join('\n  ')}`)
    console.log(`Reviewed ${done} this run. ${REVIEW_JOB} spend $${totalSpend(db, REVIEW_JOB).toFixed(2)}; library total $${totalSpend(db).toFixed(2)}`)
    db.close()
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
```

- [ ] **Step 6: Check it type-checks and runs dry against an empty store**

Run: `npx tsc --noEmit -p . && FIGURE_LIBRARY_DIR="$(mktemp -d)" npx jiti scripts/figure-library/review-drawn.ts --dry`
Expected: tsc prints nothing; the script prints `0 figures to review, estimate $0.00`.

- [ ] **Step 7: Run the figure-library suite, then commit**

Run: `npx vitest run scripts/figure-library`
Expected: every test passes.

```bash
git add scripts/figure-library/review.ts scripts/figure-library/review-drawn.ts scripts/figure-library/review.test.ts
git commit -m "feat(figure-library): blind Sonnet review of drawn families, 27 of 30 to pass"
```

---

### Task 7: The sample sheet

**Files:**
- Create: `scripts/figgen/sample_sheet.py`
- Test: `scripts/figgen/tests/test_sample_sheet.py`

**Interfaces:**
- Consumes: `FAMILIES` (Task 1); `open_store`, `save_drawn` and `library_dir` (Task 3); the `reviews` rows written by Task 6.
- Produces:
  - `build_sheet(db, lib, per_family=3, job="p1a-review") -> str`: an HTML page body following the artifact page contract (its own `<title>`, colour tokens with dark mode, phone width).
  - CLI: `python scripts/figgen/sample_sheet.py [--per-family 3] [--out PATH]`.

- [ ] **Step 1: Write the failing tests**

Create `scripts/figgen/tests/test_sample_sheet.py`:

```python
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
```

- [ ] **Step 2: Run them to see them fail**

Run: `python -m pytest scripts/figgen/tests/test_sample_sheet.py -q`
Expected: FAIL: `ModuleNotFoundError: No module named 'figgen.sample_sheet'`.

- [ ] **Step 3: Write `scripts/figgen/sample_sheet.py`**

```python
"""The sample sheet for the user (spec 5.5): each drawn family's figures with their questions and answers.

Run from the repo root:
    python scripts/figgen/sample_sheet.py [--per-family 3] [--out PATH]

Writes one self-contained HTML page (figures inlined as PNG), by default to
<FIGURE_LIBRARY_DIR>/reports/p1a-samples.html. It follows the artifact page
contract, so it can be published as it is.
"""
from __future__ import annotations

import argparse
import base64
import json
import sys
from html import escape
from pathlib import Path

if __package__ in (None, ""):  # run as a script: make "figgen" importable
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from figgen.families import FAMILIES  # noqa: E402
from figgen.store import library_dir, open_store  # noqa: E402

REVIEW_SIZE, PASS_MARK = 30, 27  # spec 3.3, as in scripts/figure-library/review.ts
LEVELS = {"P": "Primary", "LS": "Lower Secondary", "UP": "Upper Secondary", "AL": "A Level"}

CSS = """
:root{--paper:#f5f4ef;--card:#ffffff;--ink:#1d1f22;--muted:#5c626a;--rule:#dcd8cd;--key:#1c6a44;--key-bg:#e1f0e6;
--fail:#a3311d;--fail-bg:#f6e3dd;--sheet:#ffffff}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--paper:#15171a;--card:#1e2125;--ink:#e7e5e0;
--muted:#a2a7ad;--rule:#32363b;--key:#83d3a6;--key-bg:#1b3125;--fail:#ef937f;--fail-bg:#3a1f1a;color-scheme:dark}}
:root[data-theme="dark"]{--paper:#15171a;--card:#1e2125;--ink:#e7e5e0;--muted:#a2a7ad;--rule:#32363b;--key:#83d3a6;
--key-bg:#1b3125;--fail:#ef937f;--fail-bg:#3a1f1a;color-scheme:dark}
body{background:var(--paper);color:var(--ink);font:15px/1.55 "IBM Plex Sans",system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:1180px;margin:0 auto;padding-inline:16px;padding-block:32px 72px;display:flex;flex-direction:column;gap:40px}
h1,h2{font-family:"Newsreader",Georgia,"Times New Roman",serif;font-weight:600;text-wrap:balance;margin:0;line-height:1.15}
h1{font-size:clamp(28px,5vw,40px)}
h2{font-size:24px}
.eyebrow{text-transform:uppercase;letter-spacing:.08em;font-size:12px;color:var(--muted);margin:0 0 8px}
.lede{max-width:68ch;color:var(--muted);margin:12px 0 0}
.table-wrap{overflow-x:auto;border:1px solid var(--rule);border-radius:6px;background:var(--card)}
table{border-collapse:collapse;width:100%;font-size:14px;font-variant-numeric:tabular-nums}
th,td{text-align:left;padding:8px 12px;border-bottom:1px solid var(--rule);white-space:nowrap}
th{font-weight:600;color:var(--muted);font-size:12px;text-transform:uppercase;letter-spacing:.06em}
tr:last-child td{border-bottom:0}
.family{display:flex;flex-direction:column;gap:16px}
.meta{display:flex;flex-wrap:wrap;gap:6px 18px;color:var(--muted);font-size:14px;margin:0}
.score{font-weight:600;padding:1px 8px;border-radius:4px}
.score.pass{color:var(--key);background:var(--key-bg)}
.score.fail{color:var(--fail);background:var(--fail-bg)}
.score.wait{color:var(--muted);background:transparent;border:1px solid var(--rule)}
.figs{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,330px),1fr));gap:20px}
.fig{margin:0;background:var(--card);border:1px solid var(--rule);border-radius:6px;padding:14px;display:flex;
flex-direction:column;gap:12px;min-width:0}
.fig img{display:block;width:100%;height:auto;background:var(--sheet);border-radius:3px}
.missing{padding:24px;text-align:center;color:var(--fail);background:var(--fail-bg);border-radius:3px}
.fig figcaption{font-size:12px;color:var(--muted);font-family:ui-monospace,"Cascadia Mono",Consolas,monospace}
ol.qs{margin:0;padding-left:1.4em;display:flex;flex-direction:column;gap:12px}
ol.qs p{margin:0}
ol.opts{margin:6px 0 0;padding-left:1.6em;list-style:upper-alpha;display:grid;gap:2px}
ol.opts li{padding:1px 6px;border-radius:3px}
ol.opts li.key{color:var(--key);background:var(--key-bg);font-weight:600}
.ans{color:var(--key);font-weight:600;margin-top:4px!important}
.also{color:var(--muted);font-weight:400}
.notes{margin:0;padding:12px 14px 12px 2em;background:var(--fail-bg);border-radius:6px;font-size:14px}
.notes li+li{margin-top:4px}
"""


def title_of(family: str) -> str:
    return family.replace("_", " ").capitalize()


def score_of(reviewed: int, passed: int) -> tuple[str, str]:
    if not reviewed:
        return "not reviewed", "wait"
    if reviewed < REVIEW_SIZE:
        return f"{passed}/{reviewed} so far", "wait"
    return f"{passed}/{reviewed}", "pass" if passed >= PASS_MARK else "fail"


def card(db, lib: Path, f) -> str:
    file = lib / f["preview"] if f["preview"] else None
    if file and file.exists():
        data = base64.b64encode(file.read_bytes()).decode()
        image = f'<img src="data:image/png;base64,{data}" alt="{escape(f["id"])}" loading="lazy">'
    else:
        image = f'<div class="missing">image missing: {escape(str(f["preview"]))}</div>'
    items = []
    for q in db.execute("SELECT kind, stem, options, answer, accepted FROM figure_questions WHERE figure_id = ? ORDER BY n",
                        (f["id"],)):
        if q["kind"] == "mcq":
            key = int(q["answer"])
            options = "".join(f'<li class="key">{escape(o)}</li>' if i == key else f"<li>{escape(o)}</li>"
                              for i, o in enumerate(json.loads(q["options"])))
            items.append(f'<li><p>{escape(q["stem"])}</p><ol class="opts">{options}</ol></li>')
        else:
            also = json.loads(q["accepted"])[1:]
            extra = f' <span class="also">(also accepted: {escape("; ".join(also))})</span>' if also else ""
            items.append(f'<li><p>{escape(q["stem"])}</p><p class="ans">Answer: {escape(q["answer"])}{extra}</p></li>')
    return (f'<figure class="fig">{image}<figcaption>{escape(f["id"])}</figcaption>'
            f'<ol class="qs">{"".join(items)}</ol></figure>')


def build_sheet(db, lib: Path, per_family: int = 3, job: str = "p1a-review") -> str:
    rows, sections = [], []
    for fid, m in FAMILIES.items():
        figs = db.execute("SELECT id, preview FROM figures WHERE origin = 'drawn' AND family = ? AND status != 'rejected' "
                          "ORDER BY seed LIMIT ?", (fid, per_family)).fetchall()
        rejected = db.execute("SELECT id, reason FROM figures WHERE origin = 'drawn' AND family = ? AND status = 'rejected' "
                              "ORDER BY seed", (fid,)).fetchall()
        if not figs and not rejected:
            continue
        topics = [r[0] for r in db.execute(
            "SELECT DISTINCT t.name FROM figure_topics ft JOIN topics t ON t.key = ft.topic_key "
            "JOIN figures f ON f.id = ft.figure_id WHERE f.family = ? ORDER BY t.name", (fid,))]
        bands = [LEVELS.get(r[0], r[0]) for r in db.execute(
            "SELECT DISTINCT band FROM figures WHERE family = ? ORDER BY band", (fid,))]
        total = db.execute("SELECT COUNT(*) FROM figures WHERE family = ?", (fid,)).fetchone()[0]
        reviewed, passed = db.execute(
            "SELECT COUNT(*), COALESCE(SUM(r.pass), 0) FROM reviews r JOIN figures f ON f.id = r.figure_id "
            "WHERE r.job = ? AND f.family = ?", (job, fid)).fetchone()
        score, state = score_of(reviewed, passed)
        name = escape(title_of(fid))
        rows.append(f"<tr><td>{name}</td><td>{escape(m.KIND)}</td><td>{escape(', '.join(bands))}</td>"
                    f"<td>{escape('; '.join(topics))}</td><td>{total}</td>"
                    f'<td><span class="score {state}">{escape(score)}</span></td></tr>')
        notes = ""
        if rejected:
            notes = ('<ul class="notes">' + "".join(f"<li><b>{escape(r['id'])}</b>: {escape(r['reason'] or '')}</li>"
                                                     for r in rejected) + "</ul>")
        sections.append(
            f'<section class="family" id="{escape(fid)}"><h2>{name}</h2>'
            f'<p class="meta"><span>{escape(m.KIND)}</span><span>{escape(", ".join(bands))}</span>'
            f"<span>{escape('; '.join(topics))}</span>"
            f'<span>Blind review <span class="score {state}">{escape(score)}</span></span></p>'
            f'<div class="figs">{"".join(card(db, lib, f) for f in figs)}</div>{notes}</section>')
    figures = db.execute("SELECT COUNT(*) FROM figures WHERE origin = 'drawn'").fetchone()[0]
    return f"""<title>Drawn Figure Samples</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;600&family=Newsreader:opsz,wght@6..72,600&display=swap">
<style>{CSS}</style>
<main>
<header><p class="eyebrow">StudySquare figure library &middot; pilot P1a</p><h1>Drawn figure samples</h1>
<p class="lede">{len(sections)} families and {figures} figures, drawn by code. Each answer is computed by the same code that drew
the figure. Sonnet reviewed 30 figures from each family without being told how they were made; a family passes at 27 of 30.
Correct options are marked in green. Figures the review rejected are listed under their family with the reason.</p></header>
<div class="table-wrap"><table><thead><tr><th>Family</th><th>Kind</th><th>Level</th><th>Pilot topic</th><th>Figures</th>
<th>Blind review</th></tr></thead><tbody>{"".join(rows)}</tbody></table></div>
{"".join(sections)}
</main>
"""


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="Write the P1a sample sheet")
    ap.add_argument("--per-family", type=int, default=3)
    ap.add_argument("--out", default="", help="where to write the page; the library's reports folder by default")
    a = ap.parse_args(argv)
    lib = library_dir()
    db = open_store()
    out = Path(a.out) if a.out else lib / "reports" / "p1a-samples.html"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(build_sheet(db, lib, a.per_family), encoding="utf-8")
    db.close()
    print(f"Wrote {out} ({out.stat().st_size // 1024} KB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 4: Run them to see them pass, then the whole Python suite**

Run: `python -m pytest scripts/figgen/tests/test_sample_sheet.py -q && python -m pytest scripts/figgen -q`
Expected: PASS, 4 passed, then 137 passed.

- [ ] **Step 5: Commit**

```bash
git add scripts/figgen/sample_sheet.py scripts/figgen/tests/test_sample_sheet.py
git commit -m "feat(figgen): sample sheet of drawn families with answers and review scores"
```

---

### Task 8: Run the pilot

**Files:**
- Modify: `docs/superpowers/specs/2026-10-10-figure-library-design.md` (the P1 result under section 9)
- Writes outside the repo: `C:/Users/Stephen/figure-library/figures.db` and `assets/drawn/**`

**Interfaces:**
- Consumes: everything above.
- Produces:
  - 600 drawn figures in the staging store.
  - A blind-review score for every family.
  - The sample sheet, published as a private artifact.
  - The P1a result recorded in the spec.

- [ ] **Step 1: Draw the pilot**

Run: `python scripts/figgen/generate.py --per-family 30`
Expected: 20 lines of `<family> 30 figures (30 new)`, then `600 drawn figures in the store at C:\Users\Stephen\figure-library`.

- [ ] **Step 2: Price the review**

Run: `npx jiti scripts/figure-library/review-drawn.ts --dry`
Expected: `600 figures to review, estimate $4.80`.

- [ ] **Step 3: Review one family first, to measure the real cost per item**

Run: `npx jiti scripts/figure-library/review-drawn.ts --families=bar_chart`
Expected: `bar_chart  NN/30  pass|FAIL`, and the job's spend. If the spend per item is over $0.012, stop and re-price before reviewing the rest, since the full run could pass the $8 job cap.

- [ ] **Step 4: Review the rest (in the background; it takes about 30 minutes)**

Run: `npx jiti scripts/figure-library/review-drawn.ts`
Expected: a score line for each of the 20 families, and the job's spend under $8.

- [ ] **Step 5: Fix any family that fails**

For each family under 27/30:
1. Read its rejected figures' reasons (`SELECT id, reason FROM figures WHERE family = ? AND status = 'rejected'`) and look at their PNGs.
2. If a key is wrong, first write a failing case in `test_families_answers.py`. If the figure is unclear, write a failing check in `test_families_common.py` where the problem can be tested; otherwise record a ruling.
3. Fix the family, run `python -m pytest scripts/figgen -q`, and commit.
4. Redraw and re-review: `python scripts/figgen/generate.py --families=<id> --redo`, then `npx jiti scripts/figure-library/review-drawn.ts --families=<id>`.

A family is never waved through (spec 5.5). One that still fails after two fix rounds is reported to the user with its reasons, not scaled.

- [ ] **Step 6: Build and publish the sample sheet**

Run: `python scripts/figgen/sample_sheet.py --out "<scratchpad>/p1a-samples.html"`
Expected: `Wrote ... (about 2000 KB)`.

Read every line of the page's text with the image data stripped out: `sed -E 's/base64,[^"]+/base64,…/g'`. Look at a few of the figures. Then publish it with the Artifact tool, icon `chart`.

- [ ] **Step 7: Record the result and commit**

Add a `**Result (date):**` entry under P1 in the spec's section 9. It records:
- figures drawn;
- each family's score, and any fixes made;
- the review spend;
- the sample-sheet link;
- that P1a's exit now waits on the user's approval.

```bash
git add docs/superpowers/specs/2026-10-10-figure-library-design.md
git commit -m "docs: P1a drawn pilot result"
```
