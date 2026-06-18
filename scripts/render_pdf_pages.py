# -*- coding: utf-8 -*-
"""Render PDF pages as base64 PNG for vision-based syllabus extraction."""
import base64
import json
import sys

import fitz

if __name__ == "__main__":
    sys.stdout = open(sys.stdout.fileno(), mode="w", encoding="utf-8", errors="replace", buffering=1)
    pdf_path = sys.argv[1]
    max_pages = int(sys.argv[2]) if len(sys.argv) > 2 else 12

    doc = fitz.open(pdf_path)
    images = []
    for i in range(min(max_pages, doc.page_count)):
        pix = doc[i].get_pixmap(dpi=150)
        png = pix.tobytes("png")
        images.append({
            "page": i + 1,
            "base64": base64.b64encode(png).decode("ascii"),
            "mime": "image/png",
        })
    doc.close()
    print(json.dumps({"images": images[:8]}, ensure_ascii=False))
