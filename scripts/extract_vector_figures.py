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
            clip = fitz.Rect(rect.x0 - PAD, rect.y0 - PAD, rect.x1 + PAD, rect.y1 + PAD) & page.rect
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
