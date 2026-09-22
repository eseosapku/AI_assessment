# -*- coding: utf-8 -*-
"""Render figure regions out of vector-drawn exam papers.

Cambridge question papers contain no embedded bitmaps at all -- every diagram
is vector paths. Raster extraction returns either nothing or a few hundred
text glyphs, so the figures have to be found geometrically and rendered.

The method: cluster the page's drawing rectangles, throw away everything that
is page furniture rather than a figure -- answer rules, table borders, the box
round the page -- and rasterise what is left.

Emits JSON on stdout: {"figures": [{page, x0, y0, x1, y1, paths, file, nearby}]}
"""
import json
import os
import sys

import fitz

fitz.TOOLS.mupdf_display_errors(False)

# Three paths, not ten.
#
# Ten was chosen for complex apparatus diagrams and it silently discarded most
# of a Mathematics paper: a triangle is three lines, a trapezium is four, and
# "Tick the triangle where a^2 + b^2 = c^2" is four separate four-line figures.
# Measured across the Checkpoint papers, 62-75% of every clustered figure had
# fewer than ten paths.
MIN_PATHS = int(os.environ.get("VEC_MIN_PATHS", "3"))
MIN_W = float(os.environ.get("VEC_MIN_W", "60"))
MIN_H = float(os.environ.get("VEC_MIN_H", "45"))
#: A rect covering most of the page is the frame round it, and letting it into
#: the clusterer is why Mathematics yielded NOTHING.
#:
#: The merge grows a box to swallow anything within `GAP` of it, so one
#: page-sized rectangle chains every diagram on the page into a single cluster
#: the size of the paper -- which the "not the page border" rule below then
#: threw away whole. Every page of every 0862 paper collapsed to zero figures
#: this way, and the failure was invisible: the script reported success and
#: wrote nothing.
FRAME_SHARE = float(os.environ.get("VEC_FRAME_SHARE", "0.55"))
GAP = float(os.environ.get("VEC_GAP", "14"))
DPI = int(os.environ.get("VEC_DPI", "200"))
PAD = 6.0


def merge(rects, gap):
    """Union rectangles that touch or nearly touch, repeatedly until stable."""
    boxes = [[r.x0, r.y0, r.x1, r.y1, 1] for r in rects]
    changed = True
    while changed:
        changed = False
        out = []
        for b in boxes:
            hit = None
            for o in out:
                if (b[0] <= o[2] + gap and o[0] <= b[2] + gap
                        and b[1] <= o[3] + gap and o[1] <= b[3] + gap):
                    hit = o
                    break
            if hit:
                hit[0] = min(hit[0], b[0]); hit[1] = min(hit[1], b[1])
                hit[2] = max(hit[2], b[2]); hit[3] = max(hit[3], b[3])
                hit[4] += b[4]
                changed = True
            else:
                out.append(list(b))
        boxes = out
    return boxes


def figures_on(page):
    page_area = abs(page.rect.width * page.rect.height)
    rects = []
    for d in page.get_drawings():
        r = d.get("rect")
        if r is None or r.is_empty or r.is_infinite:
            continue
        # A long flat line is an answer rule or a table edge, never a figure.
        if r.height < 3 and r.width > 60:
            continue
        if r.width < 3 and r.height > 60:
            continue
        # The frame round the page, dropped BEFORE the merge rather than after
        # it. Left in, it touches everything and the clusterer returns one box
        # the size of the paper.
        if abs(r.width * r.height) > page_area * FRAME_SHARE:
            continue
        rects.append(r)
    if not rects:
        return []
    out = []
    for x0, y0, x1, y1, n in merge(rects, GAP):
        w, h = x1 - x0, y1 - y0
        if n < MIN_PATHS or w < MIN_W or h < MIN_H:
            continue
        # The border drawn round the whole page is not a figure.
        if (w * h) > page_area * 0.72:
            continue
        out.append((fitz.Rect(x0, y0, x1, y1), n))
    return out


#: Words that begin a demand rather than name a part of a drawing.
#:
#: A figure label is a noun phrase or a number: "nitrogen gas in atmosphere",
#: "50 cm", "A". A question stem is a sentence. Telling them apart by LENGTH
#: was the mistake -- "Which process occurs at X?" is twenty-six characters
#: and passed the 120-character guard as though it were a label, so it was
#: cropped into the picture. Learners were shown a nitrogen-cycle diagram
#: carrying Cambridge's own question, underneath a different question of ours.
#: That is two questions on one page, and it reproduces the paper besides.
COMMAND_WORDS = (
    "look at", "which", "what", "write down", "explain", "calculate", "complete",
    "give ", "state ", "name the", "describe", "tick ", "circle ", "draw ",
    "the diagram shows", "the table shows", "the graph shows", "the chart shows",
    "use the", "using the", "work out", "find the", "how many", "how much",
    "suggest", "identify", "compare", "predict", "measure", "record",
)


def looks_like_question(text):
    """Is this text block part of the QUESTION rather than part of the figure?"""
    t = " ".join(str(text or "").split())
    if not t:
        return False
    low = t.lower()

    # A question mark settles it.
    if t.endswith("?") or "?" in t:
        return True
    # "30 The diagram shows part of the nitrogen cycle." -- a numbered stem.
    if len(t) > 12 and t[0].isdigit():
        head = t.lstrip("0123456789").lstrip(" .)(")
        if head[:1].isupper() and " " in head:
            return True
    # A command word anywhere near the front is a demand, not a label.
    if any(low.startswith(w) or (" " + w) in low[:60] for w in COMMAND_WORDS):
        return True
    # A long sentence is prose. Labels do not run to twelve WORDS -- but a
    # month axis does run to twelve tokens, "J F M A M J J A S O N D", and
    # losing it off the bottom of a bar chart is a fault this file already
    # fixed once. So single letters do not count towards the length.
    words = [w for w in t.split() if len(w) > 2]
    if len(words) >= 12:
        return True
    # Marks printed in brackets belong to the question.
    if t.endswith("]") and "[" in t:
        return True
    return False


def with_labels(page, rect):
    """Grow a figure's crop to take in the text that belongs to it.

    The cluster is built from DRAWING rectangles, so it knows about the axes
    and nothing about the numbers printed beside them. Cropped to the drawing
    alone, a graph loses its scale, a bar chart loses "J F M A M J J A S O N D"
    off the bottom, and a pair of labelled diagrams loses the A and B that the
    question refers to -- all of which shipped.

    Only text that touches or nearly touches the drawing is taken, and the
    result is capped: a figure that grew to swallow the question stem would be
    a different fault with the same cause.
    """
    grown = fitz.Rect(rect)
    near = fitz.Rect(rect.x0 - 34, rect.y0 - 22, rect.x1 + 34, rect.y1 + 26)

    try:
        blocks = page.get_text("blocks")
    except Exception:
        blocks = []

    for b in blocks:
        if len(b) < 5:
            continue
        tb = fitz.Rect(b[0], b[1], b[2], b[3])
        if tb.is_empty or tb.is_infinite:
            continue
        # A whole paragraph is the question, not a label on the figure.
        if tb.height > 60 or len(str(b[4]).strip()) > 120:
            continue
        # And so is a short sentence that asks something. Length alone let
        # "Which process occurs at X?" into the crop.
        if looks_like_question(b[4]):
            continue
        if not tb.intersects(near):
            continue
        grown |= tb

    # Never more than half as wide again, or the stem comes with it.
    limit = fitz.Rect(
        rect.x0 - rect.width * 0.5 - PAD, rect.y0 - rect.height * 0.5 - PAD,
        rect.x1 + rect.width * 0.5 + PAD, rect.y1 + rect.height * 0.5 + PAD,
    )
    grown &= limit
    return fitz.Rect(grown.x0 - PAD, grown.y0 - PAD, grown.x1 + PAD, grown.y1 + PAD)


def main():
    pdf_path = sys.argv[1]
    out_dir = sys.argv[2]
    os.makedirs(out_dir, exist_ok=True)
    doc = fitz.open(pdf_path)
    figures = []
    for pno, page in enumerate(doc, start=1):
        # Page 1 of an exam paper is the cover: the board's logo, the barcode
        # boxes and the instructions. Never a figure.
        if pno == 1:
            continue
        for idx, (rect, paths) in enumerate(figures_on(page)):
            clip = with_labels(page, rect) & page.rect
            try:
                pix = page.get_pixmap(clip=clip, dpi=DPI)
            except Exception:
                continue
            if pix.width < 60 or pix.height < 50:
                continue
            name = "p%d-fig-%d.png" % (pno, idx)
            pix.save(os.path.join(out_dir, name))
            # The text just above a figure is what the question calls it.
            above = fitz.Rect(clip.x0 - 30, max(0, clip.y0 - 60), clip.x1 + 30, clip.y0) & page.rect
            nearby = page.get_textbox(above).replace("\n", " ").strip()
            figures.append({
                "page": pno, "imageIndex": idx, "paths": paths,
                "width": pix.width, "height": pix.height,
                "bytes": os.path.getsize(os.path.join(out_dir, name)),
                "file": name, "nearby": nearby[:300],
            })
    print(json.dumps({"page_count": doc.page_count, "figures": figures}))


if __name__ == "__main__":
    main()
