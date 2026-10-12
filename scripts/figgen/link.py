"""Which topics a drawn figure serves: those at its level that teach a concept it draws (spec 5.2).

A family names the P0 concepts it serves; a topic carries the concepts the P0 map gave it. An
instance reaches every topic at its own level sharing one, so a bar chart for Lower Secondary
serves every Lower Secondary topic on bar charts in every book, not one pilot topic.
"""
from __future__ import annotations

import json
import sqlite3

TopicIndex = list[dict]


def topic_index(db: sqlite3.Connection) -> TopicIndex:
    """Every topic the P0 map kept, with its level and concepts."""
    rows = db.execute("SELECT t.key, t.band, t.subject, t.name, m.concepts FROM topics t "
                      "JOIN topic_map m ON m.topic_key = t.key WHERE m.dropped = 0 ORDER BY t.key").fetchall()
    return [{"key": r["key"], "band": r["band"], "subject": r["subject"], "name": r["name"],
             "concepts": frozenset(json.loads(r["concepts"] or "[]"))} for r in rows]


def concepts_of(m, params: dict) -> frozenset[str]:
    """The concepts this instance draws: the family's, or fewer where the family narrows them."""
    narrow = getattr(m, "concepts_for", None)
    return frozenset(narrow(params)) if narrow else frozenset(m.CONCEPTS)


def band_of(m, params: dict) -> str:
    return params.get("band") or m.BANDS[0]


def topics_for(index: TopicIndex, m, params: dict) -> list[str]:
    band, concepts = band_of(m, params), concepts_of(m, params)
    return sorted(t["key"] for t in index if t["band"] == band and t["concepts"] & concepts)


def unknown_concepts(db: sqlite3.Connection, m) -> list[str]:
    known = {r[0] for r in db.execute("SELECT id FROM concepts")}
    return [c for c in m.CONCEPTS if c not in known]


def link_report(db: sqlite3.Connection, families: dict) -> dict[str, dict[str, int]]:
    """For each family, how many topics it reaches at each level it draws for."""
    index = topic_index(db)
    out = {}
    for fid, m in families.items():
        concepts = frozenset(m.CONCEPTS)
        out[fid] = {b: sum(1 for t in index if t["band"] == b and t["concepts"] & concepts) for b in m.BANDS}
    return out
