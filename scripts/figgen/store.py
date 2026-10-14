"""The staging store from Python: the same SQLite file and tables the Node pipeline uses (spec 5.6).

The tables are defined once, in scripts/figure-library/schema.sql, and both
languages create the store from that file, so they cannot disagree.
"""
from __future__ import annotations

import functools
import json
import os
import random
import sqlite3
import time
from datetime import datetime, timezone
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
SCHEMA_FILE = REPO / "scripts" / "figure-library" / "schema.sql"
DEFAULT_DIR = "C:/Users/Stephen/figure-library"


def with_retry(fn, tries: int = 30, wait: float = 3.0):
    """Runs a write, trying again while another process holds the lock: SQLite's wait is not fair, and with eight
    writers at once a run that waited a minute and stopped lost hours. Any other error is raised at once."""
    for k in range(tries):
        try:
            return fn()
        except sqlite3.OperationalError as e:
            if "locked" not in str(e) or k == tries - 1:
                raise
            time.sleep(wait * (0.5 + random.random()))


def _retrying(f):
    """A write whose `with db:` rolls back on failure, so trying it again is safe."""
    @functools.wraps(f)
    def g(*args, **kwargs):
        return with_retry(lambda: f(*args, **kwargs))
    return g


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
    db = sqlite3.connect(target, timeout=60)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA foreign_keys = ON")
    # Another writer (a review run, a probe) may hold the file; wait rather than fail.
    db.execute("PRAGMA busy_timeout = 60000")
    if target != ":memory:":
        db.execute("PRAGMA journal_mode = WAL")
    db.executescript(SCHEMA_FILE.read_text(encoding="utf-8"))
    # A store made before questions carried a tolerance gains the column (0: exact).
    if "tolerance" not in {r[1] for r in db.execute("PRAGMA table_info(figure_questions)")}:
        db.execute("ALTER TABLE figure_questions ADD COLUMN tolerance REAL NOT NULL DEFAULT 0")
    return db


def topic(db: sqlite3.Connection, key: str) -> dict:
    row = db.execute("SELECT key, subject, band, name FROM topics WHERE key = ?", (key,)).fetchone()
    if row is None:
        raise KeyError(f"No topic {key} in the store; export the curriculum first")
    return dict(row)


def has_figure(db: sqlite3.Connection, figure_id: str) -> bool:
    return db.execute("SELECT 1 FROM figures WHERE id = ?", (figure_id,)).fetchone() is not None


@_retrying
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
            """INSERT INTO figure_questions (id, figure_id, n, band, kind, stem, options, answer, accepted, explanation, tolerance,
                                            model)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'code')""",
            [(f"{figure_id}#{n}", figure_id, n, band, q.kind, q.stem, json.dumps(q.options), q.answer,
              json.dumps(q.accepted), q.explanation, q.tolerance) for n, q in enumerate(questions, 1)])


@_retrying
def relink(db: sqlite3.Connection, figure_id: str, topics: list[str]) -> bool:
    """Points a stored figure at these topics instead of the ones it was saved with; the figure, its
    questions, reviews and status stay as they are. True when its topics changed."""
    had = {r[0] for r in db.execute("SELECT topic_key FROM figure_topics WHERE figure_id = ?", (figure_id,))}
    if had == set(topics):
        return False
    with db:
        db.execute("DELETE FROM figure_topics WHERE figure_id = ?", (figure_id,))
        db.executemany("INSERT INTO figure_topics (figure_id, topic_key) VALUES (?, ?)", [(figure_id, k) for k in topics])
    return True


@_retrying
def delete_family(db: sqlite3.Connection, family: str) -> list[str]:
    """Removes a drawn family's figures with their questions, topics and reviews; returns the file keys to delete."""
    rows = db.execute("SELECT id, asset, preview FROM figures WHERE origin = 'drawn' AND family = ?", (family,)).fetchall()
    ids = [(r["id"],) for r in rows]
    with db:
        for table in ("reviews", "figure_questions", "figure_topics"):
            db.executemany(f"DELETE FROM {table} WHERE figure_id = ?", ids)
        db.executemany("DELETE FROM figures WHERE id = ?", ids)
    return [key for r in rows for key in (r["asset"], r["preview"]) if key]


@_retrying
def save_real(db: sqlite3.Connection, *, figure_id: str, origin: str, kind: str, subject: str, band: str,
              topic_key: str, asset: str, preview: str, width: int, height: int, spec: dict, licence: str,
              author: str, source_url: str, credit: str, phash: str) -> None:
    """One real image, a candidate for screening, with its licence and credit (spec 5.3). Saving it again changes nothing."""
    now = datetime.now(timezone.utc).isoformat()
    with db:
        db.execute(
            """INSERT INTO figures (id, origin, family, kind, subject, band, asset, preview, width, height, spec,
                                    licence, author, source_url, credit, phash, status, created_at)
               VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'candidate', ?)
               ON CONFLICT(id) DO NOTHING""",
            (figure_id, origin, kind, subject, band, asset, preview, width, height, json.dumps(spec, sort_keys=True),
             licence, author, source_url, credit, phash, now))
        db.execute("INSERT OR IGNORE INTO figure_topics (figure_id, topic_key) VALUES (?, ?)", (figure_id, topic_key))
