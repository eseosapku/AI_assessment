"""The saved image must look the way the page shows it.

extract_image() returns an image as stored, and 747 of the library's 15,103 came out wrong:
404 drawn flipped, mirrored or turned by their placement matrix (a phasor diagram reached a
quiz upside down), and 343 stored as ink amounts or a stencil, saved as a negative.

Run: python -m pytest scripts/tests/test_extract_pdf_images.py
"""
import io
import os
import sys

import fitz
from PIL import Image

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from extract_pdf_images import extract_from_pdf  # noqa: E402

RECT = fitz.Rect(50, 50, 170, 170)
RED, GREEN, BLUE, YELLOW = (220, 30, 30), (30, 180, 30), (30, 30, 220), (230, 210, 30)


def quadrants(size=96) -> bytes:
    """Red top-left, green top-right, blue bottom-left, yellow bottom-right: any turn or flip shows."""
    im = Image.new('RGB', (size, size))
    h = size // 2
    for x0, y0, colour in ((0, 0, RED), (h, 0, GREEN), (0, h, BLUE), (h, h, YELLOW)):
        im.paste(colour, (x0, y0, x0 + h, y0 + h))
    buf = io.BytesIO()
    im.save(buf, 'PNG')
    return buf.getvalue()


def corners(im: Image.Image) -> list:
    im = im.convert('RGB')
    w, h = im.size
    return [im.getpixel((int(w * fx), int(h * fy))) for fx, fy in ((0.25, 0.25), (0.75, 0.25), (0.25, 0.75), (0.75, 0.75))]


def close(a, b) -> bool:
    return all(abs(x - y) < 60 for x, y in zip(a, b))


def placed(tmp_path, matrix: str | None = None, rotate: int = 0) -> str:
    doc = fitz.open()
    page = doc.new_page(width=300, height=300)
    page.insert_image(RECT, stream=quadrants(), rotate=rotate)
    if matrix:
        xref = page.get_contents()[-1]
        src = doc.xref_stream(xref).decode()
        lines = [matrix + ' cm' if line.endswith(' cm') else line for line in src.splitlines()]
        doc.update_stream(xref, '\n'.join(lines).encode())
    path = str(tmp_path / 'book.pdf')
    doc.save(path)
    return path


def saved_and_shown(tmp_path, pdf: str):
    out = tmp_path / 'out'
    result = extract_from_pdf(pdf, out_dir=str(out), min_bytes=0)
    entry = result['images'][0]
    saved = Image.open(out / entry['filename'])
    page = fitz.open(pdf)[0]
    xref = page.get_images(full=True)[entry['imageIndex']][0]
    clip = page.get_image_rects(xref)[0]
    shown = Image.open(io.BytesIO(page.get_pixmap(clip=clip, dpi=144).tobytes('png')))
    return saved, shown, entry


def test_an_upright_image_is_saved_as_stored(tmp_path):
    saved, shown, entry = saved_and_shown(tmp_path, placed(tmp_path))
    assert [close(a, b) for a, b in zip(corners(saved), corners(shown))] == [True] * 4
    assert 'orientationFixed' not in entry


def test_an_image_the_page_flips_upside_down_is_saved_the_right_way_up(tmp_path):
    # In PDF space (y up) a negative d with f at the top edge draws the image upside down.
    saved, shown, entry = saved_and_shown(tmp_path, placed(tmp_path, '120 0 0 -120 50 250'))
    assert [close(a, b) for a, b in zip(corners(saved), corners(shown))] == [True] * 4
    assert entry['orientationFixed'] == 'flip_v'


def test_a_mirrored_image_is_saved_unmirrored(tmp_path):
    saved, shown, entry = saved_and_shown(tmp_path, placed(tmp_path, '-120 0 0 120 170 130'))
    assert [close(a, b) for a, b in zip(corners(saved), corners(shown))] == [True] * 4
    assert entry['orientationFixed'] == 'mirror'


def test_a_turned_image_is_saved_turned(tmp_path):
    for rotate in (90, 180, 270):
        sub = tmp_path / str(rotate)
        sub.mkdir()
        saved, shown, _ = saved_and_shown(sub, placed(sub, rotate=rotate))
        assert [close(a, b) for a, b in zip(corners(saved), corners(shown))] == [True] * 4, rotate


def ink_pdf(tmp_path, kind: str) -> str:
    """Top half full ink, bottom half none: the page shows black over white."""
    doc = fitz.open()
    page = doc.new_page(width=300, height=300)
    if kind == 'separation':
        grey = Image.new('L', (96, 96), 0)
        grey.paste(255, (0, 0, 96, 48))  # 255 = full ink
        buf = io.BytesIO()
        grey.save(buf, 'JPEG', quality=95)
        page.insert_image(RECT, stream=buf.getvalue())
        img = page.get_images(full=True)[0][0]
        fn = doc.get_new_xref()
        doc.update_object(fn, '<< /FunctionType 2 /Domain [0 1] /C0 [0 0 0 0] /C1 [0 0 0 1] /N 1 >>')
        doc.xref_set_key(img, 'ColorSpace', f'[/Separation /Black /DeviceCMYK {fn} 0 R]')
    else:
        mask = doc.get_new_xref()
        doc.update_object(mask, '<< /Type /XObject /Subtype /Image /Width 96 /Height 96 /ImageMask true /BitsPerComponent 1 >>')
        doc.update_stream(mask, bytes([0x00] * 12 * 48 + [0xFF] * 12 * 48))  # 0 paints, by default
        doc.xref_set_key(page.xref, 'Resources', f'<< /XObject << /M1 {mask} 0 R >> >>')
        contents = doc.get_new_xref()
        doc.update_object(contents, '<< >>')
        doc.update_stream(contents, b'q 0 0 0 rg 120 0 0 120 50 130 cm /M1 Do Q')
        doc.xref_set_key(page.xref, 'Contents', f'{contents} 0 R')
    path = str(tmp_path / f'{kind}.pdf')
    doc.save(path)
    return path


def dark(pixel) -> bool:
    return sum(pixel) / 3 < 100


def test_an_image_stored_as_black_ink_is_not_saved_as_a_negative(tmp_path):
    saved, shown, entry = saved_and_shown(tmp_path, ink_pdf(tmp_path, 'separation'))
    assert dark(corners(shown)[0]) and not dark(corners(shown)[2])
    assert dark(corners(saved)[0]) and not dark(corners(saved)[2])
    assert entry['inverted'] is True


def test_a_stencil_mask_is_not_saved_as_a_negative(tmp_path):
    saved, shown, entry = saved_and_shown(tmp_path, ink_pdf(tmp_path, 'mask'))
    assert dark(corners(shown)[0]) and not dark(corners(shown)[2])
    assert dark(corners(saved)[0]) and not dark(corners(saved)[2])
    assert entry['inverted'] is True
