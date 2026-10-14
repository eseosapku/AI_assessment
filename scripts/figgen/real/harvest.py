"""Harvests the real-image pilot from Wikimedia Commons into the staging store (spec 5.3, steps 1, 2 and 4).

Run from the repo root:  python scripts/figgen/real/harvest.py [--per-topic 100] [--per-term 25] [--topics db:2,db:36]

Each kept file is stored at <FIGURE_LIBRARY_DIR>/assets/wikimedia/<pageid>.webp (at most 1200 px) with a 512 px
JPEG beside it, for screening and sample sheets. Resumable: files already held are never fetched again.
"""
from __future__ import annotations

import argparse
import io
import json
import sys
from pathlib import Path

if __package__ in (None, ""):  # run as a script: make "figgen" importable
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from PIL import Image  # noqa: E402

from figgen.real.commons import Fetcher, parse_search, search_url  # noqa: E402
from figgen.real.hashing import MIN_DISTANCE, dhash, distance  # noqa: E402
from figgen.real.rules import is_scan, reject_reason  # noqa: E402
from figgen.store import library_dir, open_store, save_real, topic  # noqa: E402

# Pilot topics (P1b), one for each kind of real image: topic key -> figure kind.
PILOT = {
    "db:2": "photo.micrograph",     # Cambridge IGCSE Biology: Cells
    "db:36": "photo.specimen",      # Rwanda S1-S3 Biology: Classification of Kingdom Animalia
    "db:1098": "photo.landscape",   # Rwanda S1-S3 Geography: Forms of relief
    "db:162": "source.historical",  # Cambridge IGCSE History: The Cold War, 1945-75
    "db:948": "photo.apparatus",    # Rwanda S1-S3 Chemistry: Laboratory safety and apparatus
    "db:579": "photo.specimen",     # Cambridge Primary Science: The life cycle of flowering plants
}


def kinds_for(keys: list[str], kind: str | None) -> dict[str, str]:
    """The image kind to file each topic's images under: the stated one, else a pilot topic's own."""
    if kind:
        return {k: kind for k in keys}
    unknown = [k for k in keys if k not in PILOT]
    if unknown:
        raise ValueError(f"not pilot topics, so --kind is needed: {', '.join(unknown)}")
    return {k: PILOT[k] for k in keys}


def figure_id(pageid: int) -> str:
    return f"wikimedia/{pageid}"


def store_image(lib: Path, fid: str, data: bytes) -> tuple[str, str, int, int, int]:
    """Writes the WebP (at most 1200 px) and the 512 px JPEG; returns (asset, preview, width, height, hash)."""
    img = Image.open(io.BytesIO(data))
    img.load()
    if img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info):
        # Diagrams often have a transparent background, which turns black as plain RGB: put them on white.
        rgba = img.convert("RGBA")
        img = Image.new("RGB", rgba.size, "white")
        img.paste(rgba, mask=rgba.split()[3])
    else:
        img = img.convert("RGB")
    h = dhash(img)
    big, small = img.copy(), img.copy()
    big.thumbnail((1200, 1200), Image.Resampling.LANCZOS)
    small.thumbnail((512, 512), Image.Resampling.LANCZOS)
    asset, preview = f"assets/{fid}.webp", f"assets/{fid}-512.jpg"
    (lib / asset).parent.mkdir(parents=True, exist_ok=True)
    big.save(lib / asset, "WEBP", quality=85)
    small.save(lib / preview, "JPEG", quality=82)
    return asset, preview, big.width, big.height, h


def credit_line(c: dict) -> str:
    name = c["title"].removeprefix("File:").rsplit(".", 1)[0]
    return f"{name} by {c['author'] or 'an unknown author'}, {c['licence']}, via Wikimedia Commons"


def topic_terms(db, key: str) -> list[str]:
    """The topic's search terms: those made from its syllabus points (diagrams first), else the concept map's."""
    rows = db.execute("SELECT term FROM search_terms WHERE topic_key = ? "
                      "ORDER BY CASE kind WHEN 'diagram' THEN 0 ELSE 1 END, rowid", (key,)).fetchall()
    if rows:
        return [r[0] for r in rows]
    return json.loads(db.execute("SELECT terms FROM topic_map WHERE topic_key = ?", (key,)).fetchone()[0])


def harvest_topic(db, lib: Path, fetch, key: str, kind: str, want: int, per_term: int = 25) -> dict:
    """Fills one topic up to `want` stored candidates from its search terms, turning away what cannot be used."""
    t = topic(db, key)
    terms = topic_terms(db, key)
    have = db.execute("SELECT COUNT(*) FROM figure_topics ft JOIN figures f ON f.id = ft.figure_id "
                      "WHERE ft.topic_key = ? AND f.origin = 'wikimedia'", (key,)).fetchone()[0]
    hashes = [int(r[0], 16) for r in db.execute("SELECT phash FROM figures WHERE phash IS NOT NULL")]
    turned: dict[str, int] = {}
    for term in terms:
        if have >= want:
            break
        for c in parse_search(fetch.json(search_url(term, per_term)), term):
            if have >= want:
                break
            fid = figure_id(c["pageid"])
            if db.execute("SELECT 1 FROM figures WHERE id = ?", (fid,)).fetchone():
                continue  # held already, from this topic or another
            why = reject_reason(c)
            stored = None
            if why is None:
                try:
                    stored = store_image(lib, fid, fetch.bytes(c["thumb"]))
                except Exception as e:  # a file that will not download or open is skipped, and counted
                    why = f"unreadable {type(e).__name__}"
            if stored and any(distance(stored[4], x) < MIN_DISTANCE for x in hashes):
                why = "a near-copy of an image already held"
                (lib / stored[0]).unlink(missing_ok=True)
                (lib / stored[1]).unlink(missing_ok=True)
            if why:
                turned[why.split(" ")[0]] = turned.get(why.split(" ")[0], 0) + 1
                continue
            asset, preview, width, height, h = stored
            save_real(db, figure_id=fid, origin="wikimedia", kind=kind, subject=t["subject"], band=t["band"],
                      topic_key=key, asset=asset, preview=preview, width=width, height=height,
                      spec={"pageid": c["pageid"], "title": c["title"], "term": term, "description": c["description"],
                            "categories": c["categories"][:20], "licence_url": c["licence_url"], "mime": c["mime"]},
                      licence=c["licence"], author=c["author"], source_url=c["page"], credit=credit_line(c),
                      phash=f"{h:016x}")
            hashes.append(h)
            have += 1
    return {"topic": key, "have": have, "turned": turned}


def reject_held_scans(db) -> int:
    """Rejects held images that the scanned-page rule now turns away, and their screenings. Returns how many."""
    n = 0
    for r in db.execute("SELECT id, spec FROM figures WHERE origin <> 'drawn' AND status <> 'rejected'").fetchall():
        spec = json.loads(r["spec"] or "{}")
        if is_scan(spec.get("title", ""), spec.get("categories", [])):
            with db:
                db.execute("UPDATE figures SET status = 'rejected', reason = 'a scanned book page' WHERE id = ?", (r["id"],))
                # Marked as the rule's, so regrading the screen never undoes it; the questions go with the image.
                db.execute("UPDATE screenings SET keep = 0, detail = json_set(detail, '$.rule', 'a scanned book page') "
                           "WHERE figure_id = ?", (r["id"],))
                db.execute("DELETE FROM figure_questions WHERE figure_id = ?", (r["id"],))
            n += 1
    return n


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="Harvest the P1b real-image pilot from Wikimedia Commons")
    ap.add_argument("--per-topic", type=int, default=100)
    ap.add_argument("--per-term", type=int, default=25)
    ap.add_argument("--topics", default="", help="comma-separated topic keys; the pilot's six when left out")
    ap.add_argument("--recheck", action="store_true", help="only reject held images the current rules turn away")
    ap.add_argument("--kind", default=None, help="the image kind for topics beyond the pilot's, e.g. photo.history")
    a = ap.parse_args(argv)
    if a.recheck:
        db = open_store()
        print(f"{reject_held_scans(db)} held scanned pages rejected")
        db.close()
        return 0
    keys = [k.strip() for k in a.topics.split(",") if k.strip()] or list(PILOT)
    try:
        kinds = kinds_for(keys, a.kind)
    except ValueError as e:
        ap.error(str(e))
    lib, db, fetch = library_dir(), open_store(), Fetcher()
    for key in keys:
        r = harvest_topic(db, lib, fetch, key, kinds[key], a.per_topic, a.per_term)
        print(f"{key:8s} {r['have']:4d} held; turned away: {r['turned']}")
    total = db.execute("SELECT COUNT(*) FROM figures WHERE origin = 'wikimedia'").fetchone()[0]
    print(f"{total} real candidates in the store at {lib}")
    db.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
