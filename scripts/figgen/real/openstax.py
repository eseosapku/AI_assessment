"""Harvests OpenStax textbook figures into the staging store as real candidates (P3r), for the screen, the writer and the
blind review that Wikimedia images go through (spec 5.3).

The inventory (`<FIGURE_LIBRARY_DIR>/openstax/inventory.jsonl`, one line per figure image, made from the books' CNXML on
GitHub) gives each figure's book, licence, section, caption and credit. Every book is taken under the user's licensing
agreement with OpenStax (confirmed by the user on 2026-10-14; most books are otherwise CC BY-NC-SA, which
rules.licence_ok bans): no credit is shown in the app, and the source is kept in the spec. An image whose own credit
names another rights holder ("© 2012 University of Michigan", Getty) is still left out: it is not OpenStax's to license.
Each figure goes to the topic of its subject whose name and sections share the most words with the figure's section
title and caption; the screen judges the fit after.

Run from the repo root:  python scripts/figgen/real/openstax.py [--books "Physics,Statistics"] [--limit 150]
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

if __package__ in (None, ""):  # run as a script: make "figgen" importable
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from figgen.real.harvest import store_image  # noqa: E402
from figgen.real.hashing import MIN_DISTANCE, distance  # noqa: E402
from figgen.store import library_dir, open_store, save_real  # noqa: E402

RAW = "https://raw.githubusercontent.com/openstax/{repo}/HEAD/{media}"
SUBJECTS = {
    "Biology 2e": "biology", "Concepts of Biology": "biology", "Biology for AP Courses": "biology", "Microbiology": "biology",
    "Anatomy and Physiology 2e": "biology", "Chemistry 2e": "chemistry", "Chemistry: Atoms First 2e": "chemistry",
    "Physics": "physics", "College Physics 2e": "physics", "Astronomy 2e": "physics",
    "Introductory Statistics 2e": "mathematics", "Statistics": "mathematics", "Prealgebra 2e": "mathematics",
    "Elementary Algebra 2e": "mathematics", "Intermediate Algebra 2e": "mathematics", "College Algebra 2e": "mathematics",
    "Algebra and Trigonometry 2e": "mathematics", "Precalculus 2e": "mathematics", "Calculus Volume 1": "mathematics",
    "Principles of Economics 3e": "economics", "Principles of Microeconomics 3e": "economics",
    "Principles of Macroeconomics 3e": "economics",
    "Principles of Accounting, Volume 1: Financial Accounting": "accounting",
    "Principles of Accounting, Volume 2: Managerial Accounting": "accounting",
    "Introduction to Business 2e": "business", "Entrepreneurship": "business",
    "World History, Volume 1": "history", "World History, Volume 2": "history", "Psychology 2e": "psychology"}
# University-level books feed A level only: their figures run beyond upper secondary (the user's look at the pilot:
# Microbiology's tree of life, Anatomy's organ systems, College Physics's 2D collisions).
UNIVERSITY = {"Microbiology", "Anatomy and Physiology 2e", "College Physics 2e", "Calculus Volume 1", "Astronomy 2e",
              "Psychology 2e"}
MIN_SIDE = 400  # textbook diagrams are wide and short; the 600 px rule is for photographs (spec 5.3)
STOP = set("""about above after again also among an and another any are around as at be because been before being below
between both but by can could did does doing down during each either every few figure for from further had has have here
how into is it its just like made make many more most much must near not now of off on once only other our out over own
same shown shows show some such than that the their them then there these they this those through to too under until up
upon very was way well were what when where which while who why will with within without would you your credit
modification work image photo""".split())


def words(text: str) -> set[str]:
    out = set()
    for w in re.findall(r"[a-z]+", (text or "").lower()):
        if len(w) < 4 or w in STOP:
            continue
        out.add(w[:-1] if w.endswith("s") and len(w) > 4 else w)
    return out


def unusable(line: dict) -> str | None:
    """Why a figure is not taken, or None. The licence is not checked: the agreement covers OpenStax's own books."""
    if line.get("credit_flag"):
        return "credit names another rights holder"
    if not (line.get("caption") or "").strip():
        return "caption missing"
    if (line.get("media_ext") or "").lower() not in ("jpg", "jpeg", "png"):
        return "format"
    return None


def bands_of(book: str) -> tuple:
    return ("AL",) if book in UNIVERSITY else ("UP", "AL")


def topics(db, subject: str, bands: tuple = ("UP", "AL")) -> list[dict]:
    """The subject's topics at these bands, with the words of their names and sections."""
    sections: dict[str, list[str]] = {}
    for r in db.execute("SELECT topic_key, name FROM subtopics"):
        sections.setdefault(r[0], []).append(r[1])
    return [{"key": r["key"], "band": r["band"], "words": words(" ".join([r["name"], *sections.get(r["key"], [])]))}
            for r in db.execute(f"SELECT key, band, name FROM topics WHERE subject = ? AND band IN ({','.join('?' * len(bands))}) "
                                "ORDER BY key", (subject, *bands))]


def best_topic(index: list[dict], line: dict) -> str | None:
    """The topic sharing most words with the figure: its section title counts double (an "Introduction" section takes
    its chapter's title). None below three: one shared word of a title and one of a caption is too thin."""
    title = line.get("section_title") or ""
    if title.strip().lower() in ("introduction", "") or title.lower().startswith("introduction"):
        title = line.get("chapter_title") or ""
    sec, cap = words(title), words(line.get("caption") or "")
    best, key = 2, None
    for t in index:
        if not sec & t["words"]:
            continue  # a caption alone is too loose: the section must name what the topic teaches
        score = 2 * len(sec & t["words"]) + len(cap & t["words"])
        if score > best:
            best, key = score, t["key"]
    return key


def figure_id(line: dict) -> str:
    tail = f"-{line['subfigure']}" if line.get("subfigure") is not None else ""
    return f"openstax/{line['repo'].removeprefix('osbooks-')}/{line['module_id']}/{line['figure_id']}{tail}"


def source_line(line: dict) -> str:
    """Where the figure came from, kept in the spec (not shown: the agreement asks for no credit)."""
    own = (line.get("credit") or "").strip().removeprefix("credit:").strip()
    return f"{line['book']}, OpenStax, {line['license']}" + (f"; {own}" if own else "")


def harvest(db, lib: Path, fetch, lines: list[dict], limit: int | None = None) -> dict:
    """Stores up to `limit` new candidates from the inventory lines; returns what happened."""
    out = {"stored": 0, "turned": {}}
    index: dict[tuple, list[dict]] = {}
    # books in a bundle share modules: the same image file is held once
    held = set()
    for (spec,) in db.execute("SELECT spec FROM figures WHERE origin = 'openstax'"):
        sp = json.loads(spec)
        held.add((sp.get("repo"), sp.get("media")))
    hashes = [int(r[0], 16) for r in db.execute("SELECT phash FROM figures WHERE phash IS NOT NULL")]
    bands = {}

    def turn(why: str) -> None:
        out["turned"][why.split(" ")[0]] = out["turned"].get(why.split(" ")[0], 0) + 1

    for line in lines:
        if limit is not None and out["stored"] >= limit:
            break
        fid = figure_id(line)
        if db.execute("SELECT 1 FROM figures WHERE id = ?", (fid,)).fetchone():
            continue
        why = unusable(line)
        if why:
            turn(why)
            continue
        if (line["repo"], line["media"]) in held:
            turn("shared with another book")
            continue
        subject = SUBJECTS.get(line["book"])
        if subject is None:
            turn("subject")
            continue
        want = (subject, bands_of(line["book"]))
        if want not in index:
            index[want] = topics(db, subject, want[1])
            bands.update({t["key"]: t["band"] for t in index[want]})
        key = best_topic(index[want], line)
        if key is None:
            turn("topic")
            continue
        try:
            stored = store_image(lib, fid, fetch.bytes(RAW.format(repo=line["repo"], media=line["media"])))
        except Exception as e:  # a file that will not download or open is skipped, and counted
            turn(f"unreadable {type(e).__name__}")
            continue
        asset, preview, width, height, h = stored
        if min(width, height) < MIN_SIDE or any(distance(h, x) < MIN_DISTANCE for x in hashes):
            (lib / asset).unlink(missing_ok=True)
            (lib / preview).unlink(missing_ok=True)
            turn("small" if min(width, height) < MIN_SIDE else "near-copy")
            continue
        save_real(db, figure_id=fid, origin="openstax", kind="textbook.figure", subject=subject, band=bands[key],
                  topic_key=key, asset=asset, preview=preview, width=width, height=height,
                  spec={k: line.get(k) for k in ("book", "repo", "chapter_title", "section_title", "module_id", "figure_id",
                                                 "subfigure", "caption", "alt", "media")}
                  | {"source": source_line(line), "title": f"{line['book']}: {line.get('section_title') or line.get('chapter_title')}",
                     "description": line.get("caption") or ""},  # what the screen and the writer read
                  licence=f"OpenStax agreement ({line['license']})", author="OpenStax",
                  source_url=f"https://github.com/openstax/{line['repo']}", credit="", phash=f"{h:016x}")
        hashes.append(h)
        held.add((line["repo"], line["media"]))
        out["stored"] += 1
    return out


def recheck(db) -> dict:
    """Applies the current rules to held figures (P3u): one no topic reaches, or a later copy of an image another book
    holds, is rejected with its questions; the rest are matched again and go back to the screen, approved ones
    included, keeping their questions for the blind review to judge again."""
    from figgen.store import relink
    out = {"rejected": 0, "rescreen": 0, "relinked": 0}
    index: dict[tuple, list[dict]] = {}
    seen = set()
    rows = db.execute("SELECT id, spec, subject FROM figures WHERE origin = 'openstax' AND status <> 'rejected' ORDER BY id").fetchall()
    for fid, spec, subject in rows:
        sp = json.loads(spec)
        media = (sp.get("repo"), sp.get("media"))
        want = (subject, bands_of(sp.get("book", "")))
        if want not in index:
            index[want] = topics(db, *want)
        key = None if media in seen else best_topic(index[want], sp)
        if key is None:
            why = "an image another book holds" if media in seen else "no topic under the P3u rules"
            with db:
                db.execute("UPDATE figures SET status = 'rejected', reason = ? WHERE id = ?", (why, fid))
                db.execute("DELETE FROM figure_questions WHERE figure_id = ?", (fid,))
            out["rejected"] += 1
            continue
        seen.add(media)
        if relink(db, fid, [key]):
            out["relinked"] += 1
        with db:
            db.execute("UPDATE figures SET band = (SELECT band FROM topics WHERE key = ?), status = 'candidate', reason = NULL "
                       "WHERE id = ?", (key, fid))
            db.execute("DELETE FROM screenings WHERE figure_id = ?", (fid,))
        out["rescreen"] += 1
    return out


def main(argv=None) -> int:
    from figgen.real.commons import Fetcher
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--books", default="", help="comma-separated book titles; every book when left out")
    ap.add_argument("--limit", type=int, default=150)
    ap.add_argument("--recheck", action="store_true", help="apply the current rules to the figures held; fetch nothing")
    args = ap.parse_args(argv)
    if args.recheck:
        print(recheck(open_store()))
        return 0
    lib = library_dir()
    books = set(filter(None, args.books.split(",")))
    lines = [json.loads(x) for x in (lib / "openstax" / "inventory.jsonl").read_text(encoding="utf-8").splitlines() if x.strip()]
    lines = [x for x in lines if not books or x["book"] in books]
    # book by book in turn, so a sample spreads over the books instead of filling from the first
    nth: dict[str, int] = {}
    for x in lines:
        x["_n"] = nth[x["book"]] = nth.get(x["book"], -1) + 1
    lines.sort(key=lambda x: x["_n"])
    db = open_store()
    r = harvest(db, lib, Fetcher(), lines, args.limit)
    print(f"{r['stored']} stored; turned away: {r['turned']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
