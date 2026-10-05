# -*- coding: utf-8 -*-
"""Figures from Cambridge textbooks that the book itself asks a question about.

The past-paper bank works because every figure in it came with the question an
examiner wrote for it. A textbook has the same thing in its exercises -- "Look
at the diagram. 1 Which ..." -- beside a great many figures that are only
illustration: a photo of a scientist, a cartoon of two children talking, a
chapter-opening landscape. Those are what reached quizzes before, matched on
two shared words, and a question was written about a picture that was never
meant to carry one.

So a figure is kept here only when the text after it asks something: a
numbered or lettered question near it, under an exercise heading or with a
pointer to a figure ("the diagram", "the graph", "the table"). The question
text is kept with it, as the past-paper bank keeps the examiner's.

Emits data/textbook-question-figures.raw.json and crops under
public/textbook-images/textbook-bank/<textbookId>/. Run:

    python scripts/build_textbook_question_figures.py <book-map.json> [--only=34]

where the map is [{"id": 34, "name": "...", "pdf": "C:/.../book.pdf"}, ...].
"""
import collections
import json
import os
import re
import sys

import fitz

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from extract_vector_figures import figures_on  # noqa: E402
from build_checkpoint_figure_bank import grow_to_labels, is_stem_text  # noqa: E402

fitz.TOOLS.mupdf_display_errors(False)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "public", "textbook-images", "textbook-bank")
OUT_JSON = os.path.join(ROOT, "data", "textbook-question-figures.raw.json")
URL_BASE = "/textbook-images/textbook-bank"
DPI = 150

#: Headings a textbook puts over work for the learner.
EXERCISE_HEADING = re.compile(
    r"^(questions?|activity|activities|think like a (scientist|mathematician|computer scientist)|"
    r"check your progress|exam[- ]style questions?|exercises?|practice|self[- ]assessment|try this|"
    r"let'?s (talk|practise|investigate)|talk partners?|investigate|summary questions|end[- ]of[- ]unit questions?|"
    r"worked example|test yourself|review questions?|challenge)\b", re.I)
#: A numbered or lettered item: "1 Which ...", "a) Name ...", "2. Look ...".
ITEM = re.compile(r"^\s*(\d{1,2}|[a-h]|i{1,3}|iv|v)[\.\)]?\s+\S")
#: A demand, as opposed to prose.
DEMAND = re.compile(
    r"\?|\b(which|what|why|how|name|write|state|describe|explain|calculate|work out|find|draw|label|"
    r"complete|copy|list|give|suggest|predict|compare|measure|estimate|identify|use the|look at|sort|match|"
    r"count|show|tick|circle|choose)\b", re.I)
#: The text points at a figure.
POINTER = re.compile(r"\b(diagram|picture|photo(graph)?|graph|chart|table|drawing|map|image|figure|shown|below|above|"
                     r"illustration|pictogram|grid|number line|bar|pie|shape|triangle|rectangle|square|circle|"
                     r"polygon|net|spinner|scale|angle|coordinates|axes|line|pattern|sequence|cuboid|prism|"
                     r"clock|ruler|thermometer|measuring|tally|frequency)\b", re.I)


def lines_of(page):
    rows = []
    h = page.rect.height
    for b in page.get_text("dict")["blocks"]:
        for ln in b.get("lines", []):
            t = "".join(s["text"] for s in ln["spans"]).strip()
            if not t:
                continue
            x0, y0, x1, y1 = ln["bbox"]
            if y0 < 28 or y1 > h - 28:
                continue  # running heads and page numbers
            rows.append({"x": x0, "y": y0, "x1": x1, "y1": y1, "t": t})
    rows.sort(key=lambda r: (round(r["y"] / 3), r["x"]))
    # One printed line can arrive as fragments: a Mathematics book sets the
    # part letter "a" apart from "Write a formula for the area", and read
    # separately neither looks like a question.
    joined = []
    for r in rows:
        last = joined[-1] if joined else None
        if last and abs(r["y"] - last["y"]) < 3 and 0 <= r["x"] - last["x1"] < 40:
            last["t"] = last["t"] + " " + r["t"]
            last["x1"] = r["x1"]
            last["y1"] = max(last["y1"], r["y1"])
        else:
            joined.append(dict(r))
    return joined


def raster_rects(page, common_xrefs):
    """Placed raster images worth considering: not icons, not page backgrounds."""
    out = []
    area = page.rect.width * page.rect.height
    for info in page.get_image_info(xrefs=True):
        r = fitz.Rect(info["bbox"]) & page.rect
        if r.is_empty or r.width < 90 or r.height < 70:
            continue
        if r.width * r.height > area * 0.7:
            continue
        if info.get("xref") in common_xrefs:
            continue  # a logo, an icon or a decoration repeated through the book
        out.append(r)
    return out


def vector_rects(page, rows):
    """Vector clusters that hold a drawing, not a coloured text panel."""
    out = []
    for rect, paths in figures_on(page):
        if paths < 10:
            continue
        words = sum(len(r["t"].split()) for r in rows if fitz.Rect(r["x"], r["y"], r["x1"], r["y1"]).intersects(rect))
        if words > 45:
            continue  # a text box with a border is not a figure
        out.append(rect)
    return out


def merge(rects):
    out = []
    for r in rects:
        for i, o in enumerate(out):
            inter = r & o
            if not inter.is_empty and abs(inter.width * inter.height) > 0.3 * min(abs(r.width * r.height), abs(o.width * o.height)):
                out[i] = o | r
                break
        else:
            out.append(fitz.Rect(r))
    return out


def asks_about(rect, rows):
    """The question the book asks about this figure, or None.

    Read from the lines after it on the page (below it, or level with it in
    the other column), back to the nearest exercise heading above it.
    """
    after = [r for r in rows if r["y"] >= rect.y0 - 4 and not fitz.Rect(r["x"], r["y"], r["x1"], r["y1"]).intersects(rect)]
    after = [r for r in after if r["y"] >= rect.y1 - 6 or r["x"] >= rect.x1 - 4 or r["x1"] <= rect.x0 + 4][:28]
    before = [r for r in rows if r["y1"] <= rect.y0 + 4][-8:]
    heading = next((r["t"] for r in reversed(before) if EXERCISE_HEADING.match(r["t"])), None)
    items = [r for r in after if ITEM.match(r["t"]) and DEMAND.search(r["t"])]
    if not items:
        # A demand that is not numbered, straight after a pointer: "Look at the
        # graph. What happens to ..."
        items = [r for r in after[:6] if DEMAND.search(r["t"]) and POINTER.search(r["t"])]
    if not items:
        return None
    window = " ".join(r["t"] for r in (before[-3:] + after[:16]))
    if not (heading or POINTER.search(window)):
        return None
    start = after.index(items[0])
    text = [r["t"] for r in before[-2:] if not EXERCISE_HEADING.match(r["t"])] + [r["t"] for r in after[max(0, start - 2):start + 12]]
    return {"heading": heading, "question": "\n".join(text)[:1400]}


def main():
    mapping = json.load(open(sys.argv[1], encoding="utf-8"))
    only = next((a.split("=")[1] for a in sys.argv if a.startswith("--only=")), None)
    by_pdf = collections.OrderedDict()
    for m in mapping:
        if m.get("pdf"):
            by_pdf.setdefault(m["pdf"], []).append(m)
    existing = []
    if os.path.exists(OUT_JSON) and only:
        existing = [f for f in json.load(open(OUT_JSON, encoding="utf-8"))["figures"] if str(f["textbookId"]) not in only.split(",")]
    bank = list(existing)
    for pdf, books in by_pdf.items():
        ids = [b["id"] for b in books]
        if only and not any(str(i) in only.split(",") for i in ids):
            continue
        book_id = ids[0]
        try:
            doc = fitz.open(pdf)
        except Exception as e:
            print("cannot open", pdf, e, file=sys.stderr)
            continue
        uses = collections.Counter()
        for page in doc:
            for info in page.get_image_info(xrefs=True):
                uses[info.get("xref")] += 1
        common = {x for x, n in uses.items() if n > 3}
        kept = 0
        seen = 0
        os.makedirs(os.path.join(OUT_DIR, str(book_id)), exist_ok=True)
        for pno, page in enumerate(doc, start=1):
            rows = lines_of(page)
            if not rows:
                continue
            rects = merge(raster_rects(page, common) + vector_rects(page, rows))
            for idx, rect in enumerate(rects):
                seen += 1
                ask = asks_about(rect, rows)
                if not ask:
                    continue
                def text_in(c):
                    return [r["t"] for r in rows if fitz.Rect(r["x"], r["y"], r["x1"], r["y1"]).intersects(c)]

                def mostly_text(ls):
                    return any(is_stem_text(l) for l in ls) and sum(len(l.split()) for l in ls) > 40

                own = fitz.Rect(rect.x0 - 6, rect.y0 - 6, rect.x1 + 6, rect.y1 + 6) & page.rect
                clip = grow_to_labels(own, rows) & page.rect
                labels = text_in(clip)
                if mostly_text(labels):
                    # A Mathematics book sets its figures in the text flow, and
                    # growing the crop to the labels takes the exercise beside
                    # it too. The figure's own box, then, and refuse only if
                    # even that is mostly text.
                    clip, labels = own, text_in(own)
                    if mostly_text(labels):
                        continue
                try:
                    pix = page.get_pixmap(clip=clip, dpi=DPI)
                except Exception:
                    continue
                if pix.width < 120 or pix.height < 90:
                    continue
                name = "p%d-f%d.png" % (pno, idx)
                pix.save(os.path.join(OUT_DIR, str(book_id), name))
                bank.append({
                    "id": "tb%d-p%d-%d" % (book_id, pno, idx),
                    "textbookId": book_id, "textbookIds": ids, "textbookName": books[0]["name"],
                    "page": pno, "localPath": "%s/%d/%s" % (URL_BASE, book_id, name),
                    "width": pix.width, "height": pix.height,
                    "labels": labels[:40], "heading": ask["heading"], "question": ask["question"],
                })
                kept += 1
        print("%4d %-60s pages %4d figures %5d kept %4d" % (book_id, books[0]["name"][:60], doc.page_count, seen, kept), file=sys.stderr)
    json.dump({"figures": bank}, open(OUT_JSON, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("wrote %d" % len(bank), file=sys.stderr)


if __name__ == "__main__":
    main()
