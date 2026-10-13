"""Which topics a drawn figure serves: those at its level that teach a concept it draws (spec 5.2).

A family names the P0 concepts it serves; a topic carries the concepts the P0 map gave it. An
instance reaches every topic at its own level sharing one, so a bar chart for Lower Secondary
serves every Lower Secondary topic on bar charts in every book, not one pilot topic.
"""
from __future__ import annotations

import json
import re
import sqlite3

TopicIndex = list[dict]


def stage_of(book: str) -> int | None:
    """The school year a book is for, 1 to 9, from its name; None when it does not say (or is past 9)."""
    b = book.lower()
    for pattern, offset in ((r"\bp(\d)\b", 0), (r"\bprimary\s+(\d)\b", 0), (r"\bstage\s*(\d)\b", 0),
                            (r"\bbook\s*(\d)\b", 0), (r"junior secondary\s+(\d)\b", 6),
                            (r"(?:^|[-\s])s([1-3])(?:[-\s]|$)", 6)):
        m = re.search(pattern, b)
        if m:
            return int(m.group(1)) + offset
    return None


def topic_index(db: sqlite3.Connection) -> TopicIndex:
    """Every topic the P0 map kept, with its level, its book's stage, and its concepts -- its own and
    its sections' (a topic teaches what its sections teach)."""
    rows = db.execute("SELECT t.key, t.band, t.subject, t.name, t.book, m.concepts FROM topics t "
                      "JOIN topic_map m ON m.topic_key = t.key WHERE m.dropped = 0 ORDER BY t.key").fetchall()
    sections: dict[str, set[str]] = {}
    for r in db.execute("SELECT s.topic_key, sm.concepts FROM subtopics s JOIN subtopic_map sm ON sm.subtopic_key = s.key"):
        sections.setdefault(r["topic_key"], set()).update(json.loads(r["concepts"] or "[]"))
    return [{"key": r["key"], "band": r["band"], "subject": r["subject"], "name": r["name"], "stage": stage_of(r["book"] or ""),
             "concepts": frozenset(json.loads(r["concepts"] or "[]")) | frozenset(sections.get(r["key"], ()))} for r in rows]


def concepts_of(m, params: dict) -> frozenset[str]:
    """The concepts this instance draws: the family's, or fewer where the family narrows them."""
    narrow = getattr(m, "concepts_for", None)
    return frozenset(narrow(params)) if narrow else frozenset(m.CONCEPTS)


def band_of(m, params: dict) -> str:
    return params.get("band") or m.BANDS[0]


def stages_of(m, params: dict) -> tuple[int, int] | None:
    """The school years an instance suits, where the family says (a 7-digit place value chart is
    Stage 6, not Stage 1); None for any year of its level."""
    fits = getattr(m, "stages", None)
    return fits(params) if fits else None


def topics_for(index: TopicIndex, m, params: dict) -> list[str]:
    band, concepts, years = band_of(m, params), concepts_of(m, params), stages_of(m, params)
    # A topic can share a concept word without teaching the subject: "Polynomials" adds integers. A
    # family may say so figure by figure (avoid_for): a bar model of cows is no figure for francs.
    avoid = m.avoid_for(params) if hasattr(m, "avoid_for") else getattr(m, "AVOID", None)
    return sorted(t["key"] for t in index if t["band"] == band and t["concepts"] & concepts
                  and (years is None or t.get("stage") is None or years[0] <= t["stage"] <= years[1])
                  and not (avoid and re.search(avoid, t["name"], re.I)))


def reach(index: TopicIndex, m, samples: int = 300) -> set[str]:
    """Every topic some figure of the family reaches: its stages, per-figure concepts and avoided
    topics all counted, by drawing `samples` figures."""
    import random
    out: set[str] = set()
    for s in range(1, samples + 1):
        out.update(topics_for(index, m, m.sample(random.Random(s))))
    return out


def unknown_concepts(db: sqlite3.Connection, m) -> list[str]:
    known = {r[0] for r in db.execute("SELECT id FROM concepts")}
    return [c for c in m.CONCEPTS if c not in known]


def link_report(db: sqlite3.Connection, families: dict) -> dict[str, dict[str, int]]:
    """For each family, how many topics it reaches at each level it draws for."""
    index = topic_index(db)
    bands = {t["key"]: t["band"] for t in index}
    out = {}
    for fid, m in families.items():
        keys = reach(index, m)
        out[fid] = {b: sum(1 for k in keys if bands[k] == b) for b in m.BANDS}
    return out
