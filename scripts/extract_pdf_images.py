# -*- coding: utf-8 -*-
"""Extract raster images and figure-page screenshots from textbook PDFs."""
import hashlib
import json
import os
import re
import sys

import io

import fitz
from PIL import Image, ImageOps

# Keep MuPDF repair warnings off stdout so Node can parse JSON metadata.
fitz.TOOLS.mupdf_display_errors(False)

FIGURE_RE = re.compile(
    r"\b(figure|fig\.|diagram|illustration|graph|chart|sketch|drawing|photo|picture|map)\b",
    re.I,
)

# extract_image() returns an image as STORED, and two kinds came out wrong: 404 of the library's
# 15,103 images are drawn flipped, mirrored or turned by their placement matrix (a phasor diagram
# reached a quiz upside down), and 343 are stored as ink amounts or a stencil and saved as a
# negative. Both are put right here, so the saved file looks the way the page shows it.
_T = Image.Transpose
_TURN = {
    "flip_v": _T.FLIP_TOP_BOTTOM,
    "mirror": _T.FLIP_LEFT_RIGHT,
    "rot180": _T.ROTATE_180,
    "rot_cw": _T.ROTATE_270,  # PIL's ROTATE_270 turns 90 degrees clockwise
    "rot_ccw": _T.ROTATE_90,
    "transpose": _T.TRANSPOSE,
    "transverse": _T.TRANSVERSE,
}


def placement_turn(page, xref):
    """How the page turns the image ('flip_v', 'mirror', ...), or None when it is drawn upright.

    From the first placement, in page coordinates (y down) after the page's own rotation. A
    matrix that is neither upright nor a quarter turn (a photo set at a slant) is left alone.
    """
    try:
        placed = page.get_image_rects(xref, transform=True)
    except Exception:
        return None
    if not placed:
        return None
    m = placed[0][1] * page.rotation_matrix
    a, b, c, d = m.a, m.b, m.c, m.d
    tiny = max(abs(a), abs(b), abs(c), abs(d)) * 1e-3
    if abs(b) <= tiny and abs(c) <= tiny:
        if a > 0 and d > 0:
            return None
        return "flip_v" if a > 0 else "mirror" if d > 0 else "rot180"
    if abs(a) <= tiny and abs(d) <= tiny:
        if b > 0:
            return "rot_cw" if c < 0 else "transpose"
        return "rot_ccw" if c > 0 else "transverse"
    return None


def stored_as_negative(doc, img, ext):
    """True for a stencil mask, or a one-ink (Separation / one-colorant DeviceN) image kept as raw JPEG.

    Those samples are amounts of ink, and a JPEG passed through unconverted shows full ink as
    white. Images MuPDF converts on the way out (PNG) already come out right.
    """
    xref, cs_name = img[0], img[5]
    if doc.xref_get_key(xref, "ImageMask")[1] == "true":
        return True
    if cs_name not in ("Separation", "DeviceN") or ext not in ("jpeg", "jpg", "jpx"):
        return False
    kind, val = doc.xref_get_key(xref, "ColorSpace")
    body = doc.xref_object(int(val.split()[0])) if kind == "xref" else val
    colorants = re.findall(r"/(\w+)", re.split(r"/Device(?:CMYK|RGB|Gray)", body)[0])
    colorants = [c for c in colorants if c not in ("Separation", "DeviceN")]
    return len(colorants) == 1


def as_shown(data, ext, turn, negative):
    """The stored bytes re-encoded the way the page shows them."""
    im = Image.open(io.BytesIO(data))
    im.load()
    if im.mode == "CMYK":
        im = im.convert("RGB")
    if turn:
        im = im.transpose(_TURN[turn])
    if negative:
        if im.mode in ("1", "P", "I", "F", "I;16"):
            im = im.convert("L")
        if im.mode in ("LA", "RGBA"):
            *colour, alpha = im.split()
            im = ImageOps.invert(Image.merge("L" if im.mode == "LA" else "RGB", colour))
            im.putalpha(alpha)
        else:
            im = ImageOps.invert(im)
    buf = io.BytesIO()
    if ext == "png":
        im.save(buf, format="PNG")
    else:
        im.convert("RGB" if im.mode not in ("RGB", "L") else im.mode).save(buf, format="JPEG", quality=95)
    return buf.getvalue(), im.size


def extract_from_pdf(
    pdf_path,
    max_pages=None,
    min_px=72,
    min_bytes=2500,
    render_figure_pages=False,
    dpi=144,
    out_dir=None,
    max_per_page=0,
    dedup=False,
):
    doc = fitz.open(pdf_path)
    images = []
    page_count = doc.page_count
    limit = min(page_count, max_pages) if max_pages else page_count
    seen_hashes = set()  # per-document content dedup (kills repeated logos/headers)
    dropped_dupes = 0

    for i in range(limit):
        page = doc[i]
        page_num = i + 1
        text = (page.get_text() or "").strip()
        snippet = re.sub(r"\s+", " ", text)[:240]
        has_figure_cue = bool(FIGURE_RE.search(text))
        embedded_on_page = 0

        for img_idx, img in enumerate(page.get_images(full=True)):
            if max_per_page and embedded_on_page >= max_per_page:
                break
            try:
                info = doc.extract_image(img[0])
            except Exception:
                continue
            w, h = info.get("width", 0), info.get("height", 0)
            data = info.get("image", b"")
            if w < min_px or h < min_px or len(data) < min_bytes:
                continue
            if dedup:
                digest = hashlib.md5(data).hexdigest()
                if digest in seen_hashes:
                    dropped_dupes += 1
                    continue
                seen_hashes.add(digest)
            ext = info.get("ext") or "png"
            turn = placement_turn(page, img[0])
            negative = stored_as_negative(doc, img, ext)
            if turn or negative:
                if ext not in ("png", "jpeg", "jpg"):
                    ext = "png"
                try:
                    data, (w, h) = as_shown(data, ext, turn, negative)
                except Exception:
                    turn = negative = None
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
            if turn:
                entry["orientationFixed"] = turn
            if negative:
                entry["inverted"] = True
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
    return {
        "page_count": page_count,
        "pages_scanned": limit,
        "images": images,
        "dropped_dupes": dropped_dupes,
    }


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

    def env_int(name, default):
        try:
            return int(os.environ.get(name, "") or default)
        except ValueError:
            return default

    min_px = env_int("EXTRACT_MIN_PX", 72)
    min_bytes = env_int("EXTRACT_MIN_BYTES", 2500)
    max_per_page = env_int("EXTRACT_MAX_PER_PAGE", 0)
    dedup = os.environ.get("EXTRACT_DEDUP", "") in ("1", "true", "yes")
    try:
        result = extract_from_pdf(
            pdf_path,
            max_pages=max_pages or None,
            out_dir=out_dir,
            min_px=min_px,
            min_bytes=min_bytes,
            max_per_page=max_per_page,
            dedup=dedup,
        )
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
