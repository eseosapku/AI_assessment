# -*- coding: utf-8 -*-
"""Extract raster images and figure-page screenshots from textbook PDFs."""
import json
import os
import re
import sys

import fitz

# Keep MuPDF repair warnings off stdout so Node can parse JSON metadata.
fitz.TOOLS.mupdf_display_errors(False)

FIGURE_RE = re.compile(
    r"\b(figure|fig\.|diagram|illustration|graph|chart|sketch|drawing|photo|picture|map)\b",
    re.I,
)


def extract_from_pdf(
    pdf_path,
    max_pages=None,
    min_px=72,
    min_bytes=2500,
    render_figure_pages=False,
    dpi=144,
    out_dir=None,
):
    doc = fitz.open(pdf_path)
    images = []
    page_count = doc.page_count
    limit = min(page_count, max_pages) if max_pages else page_count

    for i in range(limit):
        page = doc[i]
        page_num = i + 1
        text = (page.get_text() or "").strip()
        snippet = re.sub(r"\s+", " ", text)[:240]
        has_figure_cue = bool(FIGURE_RE.search(text))
        embedded_on_page = 0

        for img_idx, img in enumerate(page.get_images(full=True)):
            try:
                info = doc.extract_image(img[0])
            except Exception:
                continue
            w, h = info.get("width", 0), info.get("height", 0)
            data = info.get("image", b"")
            if w < min_px or h < min_px or len(data) < min_bytes:
                continue
            ext = info.get("ext") or "png"
            fname = f"page{page_num}-embedded-{img_idx}.{ext}"
            entry = {
                "page": page_num,
                "imageIndex": img_idx,
                "kind": "embedded",
                "width": w,
                "height": h,
                "ext": ext,
                "bytes": len(data),
                "pageText": snippet,
                "filename": fname,
            }
            if out_dir:
                os.makedirs(out_dir, exist_ok=True)
                with open(os.path.join(out_dir, fname), "wb") as f:
                    f.write(data)
            images.append(entry)
            embedded_on_page += 1

        if render_figure_pages and embedded_on_page == 0:
            drawings = page.get_drawings()
            vector_heavy = len(drawings) > 30
            if has_figure_cue or vector_heavy:
                pix = page.get_pixmap(dpi=dpi)
                png = pix.tobytes("png")
                if len(png) >= min_bytes:
                    fname = f"page{page_num}-page-0.png"
                    entry = {
                        "page": page_num,
                        "imageIndex": 0,
                        "kind": "page",
                        "width": pix.width,
                        "height": pix.height,
                        "ext": "png",
                        "bytes": len(png),
                        "pageText": snippet,
                        "filename": fname,
                    }
                    if out_dir:
                        os.makedirs(out_dir, exist_ok=True)
                        with open(os.path.join(out_dir, fname), "wb") as f:
                            f.write(png)
                    images.append(entry)

    doc.close()
    return {"page_count": page_count, "pages_scanned": limit, "images": images}


if __name__ == "__main__":
    sys.stdout = open(
        sys.stdout.fileno(), mode="w", encoding="utf-8", errors="replace", buffering=1
    )
    sys.stderr = open(
        sys.stderr.fileno(), mode="w", encoding="utf-8", errors="replace", buffering=1
    )
    pdf_path = sys.argv[1]
    max_pages = int(sys.argv[2]) if len(sys.argv) > 2 and str(sys.argv[2]).isdigit() else 0
    out_dir = sys.argv[3] if len(sys.argv) > 3 and sys.argv[3] else None
    try:
        result = extract_from_pdf(pdf_path, max_pages=max_pages or None, out_dir=out_dir)
        print(json.dumps(result, ensure_ascii=False))
    except Exception as exc:
        print(
            json.dumps(
                {
                    "error": str(exc),
                    "page_count": 0,
                    "pages_scanned": 0,
                    "images": [],
                },
                ensure_ascii=False,
            )
        )
        sys.exit(1)
