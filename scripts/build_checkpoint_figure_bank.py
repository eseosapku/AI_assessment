# -*- coding: utf-8 -*-
"""Cut every figure out of the Checkpoint past papers WITH the question it belonged to.

The library already holds these figures, and it holds them badly: each one
carries a vision caption written from the picture alone and a 50-character
scrap of page text. Both proved worthless as a basis for a question. A
magnesium-ion lattice from a Science paper was captioned "a lattice structure
in graph theory", and the scrap beside it read "g 2+". The writer cannot see a
picture, so whatever the caption says is what the question is about.

The paper itself says what each figure is. The question printed around it
names it ("The diagram shows the pathway of water moving through a plant"),
the words printed on it are its labels, and the parts that follow show what a
Cambridge examiner thought it was good for. All three are read here, by
position, from the PDF:

  * the figure is found with the SAME geometry as extract_vector_figures.py,
    so a crop here is the crop the library has;
  * its question runs from the question number above it to the next one, which
    may be pages later;
  * the text inside the crop is its labels, and is taken out of the question
    text so the two are not confused.

Emits data/checkpoint-figure-bank.raw.json and writes the crops under
public/textbook-images/checkpoint-bank/. Run:

    python scripts/build_checkpoint_figure_bank.py "<folder of past papers>"
"""
import hashlib
import json
import os
import re
import sys

import fitz

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from extract_vector_figures import DPI, figures_on, looks_like_question, with_labels  # noqa: E402

fitz.TOOLS.mupdf_display_errors(False)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "public", "textbook-images", "checkpoint-bank")
OUT_JSON = os.path.join(ROOT, "data", "checkpoint-figure-bank.raw.json")
URL_BASE = "/textbook-images/checkpoint-bank"

#: Every Checkpoint syllabus, so a paper supplied later is picked up unchanged.
CODES = {
    "0893": ("Science", 9), "0097": ("Science", 6),
    "0862": ("Mathematics", 9), "0096": ("Mathematics", 6),
    "0876": ("English as a Second Language", 9), "0057": ("English as a Second Language", 6),
    "0861": ("English", 9), "0058": ("English", 6),
}

#: Running heads and feet. Never part of a question.
FURNITURE = re.compile(
    r"^(©|�|©)?\s*UCLES|^\[?Turn over|^BLANK PAGE|DO NOT WRITE|^\d{4}/\d{2}/|"
    r"Permission to reproduce|Cambridge Assessment|copyright", re.I)
#: A run of answer dots or rules. The marks after it are kept.
DOTS = re.compile(r"[.…_]{4,}")
QNUM = re.compile(r"^(\d{1,2})(?:\s+(\S.*))?$")


def paper_identity(path, doc):
    name = os.path.basename(path)
    m = re.search(r"(0\d{3})", name)
    if not m or m.group(1) not in CODES:
        return None
    code = m.group(1)
    subject, stage = CODES[code]
    # The component is printed in the running foot: 0893/01/A/M/25.
    component = None
    for pno in range(1, min(4, doc.page_count)):
        foot = re.search(r"%s/(\d{2})/" % code, doc[pno].get_text())
        if foot:
            component = int(foot.group(1))
            break
    if component is None:
        p = re.search(r"(?:Paper-?|paper-|qp_)(\d)", name, re.I)
        component = int(p.group(1)) if p else 1
    session = ""
    s = re.search(r"(January|February|March|April|May|June|October|November)-?(\d{4})", name, re.I)
    if s:
        session = "%s %s" % (s.group(1).title(), s.group(2))
    else:
        s = re.search(r"_([smw])(\d{2})_", name)
        if s:
            session = "%s 20%s" % ({"s": "May", "w": "October", "m": "March"}[s.group(1)], s.group(2))
    return {"code": code, "subject": subject, "stage": stage, "component": component, "session": session}


def page_lines(page):
    """Text lines on a page in reading order, with same-row fragments joined."""
    rows = []
    for b in page.get_text("dict")["blocks"]:
        for ln in b.get("lines", []):
            t = "".join(s["text"] for s in ln["spans"]).strip()
            if not t:
                continue
            x0, y0, x1, y1 = ln["bbox"]
            rows.append([x0, y0, x1, y1, t])
    rows.sort(key=lambda r: (round(r[1] / 3), r[0]))
    out = []
    for r in rows:
        if r[1] < 50 or r[1] > 780:
            continue
        if FURNITURE.search(r[4]):
            continue
        out.append({"x": r[0], "y": r[1], "x1": r[2], "y1": r[3], "t": r[4]})
    return out


def is_question_start(line, next_line):
    """A question number in the left margin: "3" alone, or "3 The diagram ..."."""
    if line["x"] > 62:
        return None
    m = QNUM.match(line["t"])
    if not m:
        return None
    n = int(m.group(1))
    if not 1 <= n <= 60:
        return None
    # A bare number with nothing beside it and nothing following on its row is
    # a value in a table, not a question number.
    if not m.group(2) and not (next_line and abs(next_line["y"] - line["y"]) < 4 and next_line["x"] > line["x"]):
        return None
    return n


def is_stem_text(text):
    """A sentence of the QUESTION inside a figure's crop, rather than a label.

    The clusterer joins drawings that sit close together, and a tick box or an
    answer grid printed under a chart is a drawing -- so the crop of a pie
    chart ran on through "A total of 324 pizzas are sold ... Tick to show if
    Mia is correct or not correct. You must show your working." A learner
    shown that above a question of ours is reading two questions at once.

    `looks_like_question` catches demands; a premise is caught as a sentence:
    a capital, six or more real words, a full stop. Labels, titles and axis
    names are never that.
    """
    t = " ".join(str(text or "").split())
    if looks_like_question(t):
        return True
    # "Mia says, '20 more cheese pizzas ...'" -- a claim to judge is the stem.
    if re.search(r"\b(says|said|thinks|writes|claims),", t):
        return True
    # "(a) Triangle T is rotated by 180° ..." -- a lettered part is the stem.
    if re.match(r"^\((?:[a-h]|i{1,3}|iv|v)\)\s+\S", t):
        return True
    words = [w for w in t.split() if len(w) > 2]
    # Four words, not six: "A total of 324 pizzas are sold." is five, and it
    # is the premise the question turns on. A full stop after a closing quote
    # still ends a sentence.
    ends = re.search(r"[.!][’'\"]?$", t.rstrip())
    return bool(t) and t[0].isupper() and bool(ends) and len(words) >= 4


def is_furniture_row(text):
    """An answer line, a mark, a question number: printed beside figures, never part of one."""
    t = " ".join(str(text or "").split())
    if not t:
        return True
    if DOTS.search(t) and len(DOTS.sub("", t).strip()) < 6:
        return True
    if re.fullmatch(r"\[\d+\]", t) or re.fullmatch(r"\d{1,2}", t):
        return True
    return False


def grow_to_labels(clip, rows):
    """Take in the labels a crop cuts through, and the row labels beside a table.

    The extractor grows a crop only to text within a fixed band of the
    drawing, so a label that runs past the band is sliced -- "ntainer of
    sand" -- and a table whose first column is plain text with no ruling
    loses that column whole. A table of Group 1 properties shipped with its
    element names cut off, under a question asking about "lithium to
    rubidium": unanswerable from the figure.

    A row that crosses the crop's edge is taken whole. A row standing beside
    the crop, within its height and close to it, is a row label and is taken
    too. Stem sentences, answer lines and marks never are.
    """
    out = fitz.Rect(clip)
    for _ in range(4):
        changed = False
        for r in rows:
            rr = fitz.Rect(r["x"], r["y"], r["x1"], r["y1"])
            if rr.is_empty or out.contains(rr):
                continue
            if is_stem_text(r["t"]) or is_furniture_row(r["t"]):
                continue
            crosses = rr.intersects(out)
            beside = (rr.y0 >= out.y0 - 2 and rr.y1 <= out.y1 + 2
                      and (0 <= out.x0 - rr.x1 < 70 or 0 <= rr.x0 - out.x1 < 70))
            if crosses or beside:
                out |= rr
                changed = True
        if not changed:
            break
    if out == clip:
        return clip
    return fitz.Rect(out.x0 - 4, out.y0 - 4, out.x1 + 4, out.y1 + 4)


def merge_overlapping(clips):
    """One figure where growing the crops made two cover the same picture.

    "Before mixing" and "after mixing" are drawn side by side and labelled as
    one figure; the clusterer split them, and growing each to its labels
    joined them again -- twice, as two identical crops. Kept once, as the
    pair the paper printed, which is also the only form in which a question
    about the change between them can be answered.
    """
    out = []
    for c in clips:
        idx, rect, paths, changed, stem = c
        for k, o in enumerate(out):
            inter = rect & o[1]
            if inter.is_empty:
                continue
            small = min(abs(rect.width * rect.height), abs(o[1].width * o[1].height)) or 1
            if abs(inter.width * inter.height) / small > 0.5:
                out[k] = (o[0], o[1] | rect, o[2] + paths, True, o[4] or stem)
                break
        else:
            out.append(c)
    return out


def trim_stem(page, clip, rows):
    """Cut stem sentences off the top and bottom of a crop.

    Returns (clip, stem_left_inside). A sentence in the MIDDLE of a figure
    cannot be cut away without cutting the figure, so it is reported instead
    and the figure is refused downstream.
    """
    inside = [r for r in rows if fitz.Rect(r["x"], r["y"], r["x1"], r["y1"]).intersects(clip)]
    stems = [r for r in inside if is_stem_text(r["t"])]
    if not stems:
        return clip, False
    mid = (clip.y0 + clip.y1) / 2
    lower = [r for r in stems if r["y"] >= mid]
    upper = [r for r in stems if r["y"] < mid]
    out = fitz.Rect(clip)
    if lower:
        out.y1 = min(r["y"] for r in lower) - 3
    if upper:
        out.y0 = max(r["y1"] for r in upper) + 3
    if out.height < 45 or out.width < 60:
        return clip, True
    left = [r for r in stems if fitz.Rect(r["x"], r["y"], r["x1"], r["y1"]).intersects(out)]
    return out, bool(left)


def tidy(text):
    text = DOTS.sub(" ____ ", text)
    text = re.sub(r"\s{2,}", " ", text).strip()
    return text


def main():
    src = sys.argv[1]
    pdfs = []
    for dirpath, _, files in os.walk(src):
        for f in files:
            if f.lower().endswith(".pdf"):
                pdfs.append(os.path.join(dirpath, f))
    pdfs.sort()

    seen_hash = set()
    bank = []
    for path in pdfs:
        with open(path, "rb") as fh:
            digest = hashlib.sha1(fh.read()).hexdigest()
        if digest in seen_hash:
            continue  # "Paper-1 (1).pdf" is the same file downloaded twice.
        try:
            doc = fitz.open(path)
        except Exception:
            continue
        ident = paper_identity(path, doc)
        if not ident:
            continue
        seen_hash.add(digest)
        slug = re.sub(r"[^a-z0-9]+", "-", os.path.splitext(os.path.basename(path))[0].lower()).strip("-")[:80]

        # Every line of the paper, with the figures on each page.
        lines = []
        figs_by_page = {}
        for pno, page in enumerate(doc, start=1):
            if pno == 1:
                continue
            rows = page_lines(page)
            clips = []
            for idx, (rect, paths) in enumerate(figures_on(page)):
                # A language paper's notice carries its words INSIDE its drawn
                # box, and the question's options sit right beside it -- so
                # growing the crop to nearby text took Cambridge's A, B and C
                # in with seven of thirteen notices. The box alone, there.
                if "Second Language" in ident["subject"] or ident["subject"] == "English":
                    clip = fitz.Rect(rect.x0 - 4, rect.y0 - 4, rect.x1 + 4, rect.y1 + 4) & page.rect
                else:
                    clip = with_labels(page, rect) & page.rect
                cut, stem_inside = clip, False
                # Not on a language paper, where a notice IS sentences.
                if ident["subject"] in ("Science", "Mathematics"):
                    grown = grow_to_labels(clip, rows) & page.rect
                    cut, stem_inside = trim_stem(page, grown, rows)
                clips.append((idx, cut, paths, cut != clip, stem_inside))
            figs_by_page[pno] = merge_overlapping(clips)
            clips = figs_by_page[pno]
            for ln in rows:
                ln["page"] = pno
                inside = None
                for idx, clip, *_ in clips:
                    if fitz.Rect(ln["x"], ln["y"], ln["x1"], ln["y1"]).intersects(clip):
                        inside = idx
                        break
                ln["fig"] = inside
                lines.append(ln)

        # Question numbers, in order.
        starts = []
        for i, ln in enumerate(lines):
            n = is_question_start(ln, lines[i + 1] if i + 1 < len(lines) else None)
            if n is not None and ln["fig"] is None:
                if not starts or n > starts[-1][1]:
                    starts.append((i, n))

        def question_for(pno, clip):
            """The question whose number is the last one printed above this figure."""
            best = None
            for k, (i, n) in enumerate(starts):
                ln = lines[i]
                if ln["page"] < pno or (ln["page"] == pno and ln["y"] <= clip.y0 + 6):
                    best = k
            return best

        page_of = {}
        for pno, clips in figs_by_page.items():
            page = doc[pno - 1]
            for idx, clip, paths, trimmed, stem_inside in clips:
                k = question_for(pno, clip)
                if k is None:
                    continue
                i0, qn = starts[k]
                i1 = starts[k + 1][0] if k + 1 < len(starts) else len(lines)
                parts = []
                labels = []
                marked = set()
                for ln in lines[i0:i1]:
                    if ln["page"] == pno and ln["fig"] == idx:
                        labels.append(ln["t"])
                        if "self" not in marked:
                            parts.append("[THIS DIAGRAM]")
                            marked.add("self")
                        continue
                    if ln["fig"] is not None:
                        key = (ln["page"], ln["fig"])
                        if key not in marked:
                            parts.append("[ANOTHER DIAGRAM]")
                            marked.add(key)
                        continue
                    t = ln["t"]
                    if ln is lines[i0]:
                        t = QNUM.match(t).group(2) or ""
                    parts.append(t)
                question = tidy("\n".join(p for p in parts if p).replace(" \n", "\n"))
                # Rows, not one long string, so a table keeps its shape.
                question = "\n".join(tidy(r) for r in question.split("\n") if tidy(r))

                try:
                    pix = page.get_pixmap(clip=clip, dpi=DPI)
                except Exception:
                    continue
                if pix.width < 60 or pix.height < 50:
                    continue
                os.makedirs(os.path.join(OUT_DIR, slug), exist_ok=True)
                fname = "p%d-fig-%d.png" % (pno, idx)
                pix.save(os.path.join(OUT_DIR, slug, fname))
                bank.append({
                    "id": "%s-p%d-%d" % (slug, pno, idx),
                    **ident,
                    "source": os.path.basename(path),
                    "page": pno,
                    "question_number": qn,
                    "localPath": "%s/%s/%s" % (URL_BASE, slug, fname),
                    "width": pix.width, "height": pix.height, "paths": paths,
                    "labels": [tidy(l) for l in labels if tidy(l)],
                    "trimmed": trimmed, "stem_inside": stem_inside,
                    "question": question,
                })
                page_of[slug] = page_of.get(slug, 0) + 1
        print("%-70s %s/%02d %-12s %3d figures" % (os.path.basename(path)[:70], ident["code"], ident["component"],
                                                   ident["session"], page_of.get(slug, 0)), file=sys.stderr)

    os.makedirs(os.path.dirname(OUT_JSON), exist_ok=True)
    with open(OUT_JSON, "w", encoding="utf-8") as fh:
        json.dump({"figures": bank}, fh, ensure_ascii=False, indent=1)
    print("wrote %d figures" % len(bank), file=sys.stderr)


if __name__ == "__main__":
    main()
