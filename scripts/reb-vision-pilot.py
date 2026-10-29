"""Pilot REB vision extraction for one subject. Stops after the first page unless --subject is passed twice as --run-subject."""
import json
import sys
from pathlib import Path

import pymupdf as fitz

ROOT = Path(r"C:\Users\hp\Desktop\pastPapers\REB\P6")

def pages_of(folder: Path):
    rows = []
    for path in sorted(folder.glob("*Mathematics*.pdf")):
        try:
            doc = fitz.open(path)
        except Exception as error:
            rows.append({"file": path.name, "pages": 0, "error": str(error)})
            continue
        header = path.read_bytes()[:5]
        rows.append({"file": path.name, "pages": doc.page_count, "pdf": header.startswith(b"%PDF")})
        doc.close()
    return rows

def render(path: Path, index: int) -> bytes:
    doc = fitz.open(path)
    page = doc[index]
    pix = page.get_pixmap(dpi=200)
    data = pix.tobytes("png")
    doc.close()
    return data

if __name__ == "__main__":
    rows = pages_of(ROOT)
    good = [row for row in rows if row.get("pdf")]
    total_pages = sum(row["pages"] for row in good)
    print(json.dumps({"files": len(rows), "readable": len(good), "pages": total_pages, "files_detail": rows[:8]}, indent=2))
    if "--one-page" not in sys.argv:
        sys.exit(0)
    first = next(row for row in rows if row.get("pdf"))
    src = ROOT / first["file"]
    out = Path("data/past-paper-corpus/reb-pilot-page.png")
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_bytes(render(src, 0))
    print("WROTE", out, "from", src.name)
