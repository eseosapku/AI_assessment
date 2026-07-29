# -*- coding: utf-8 -*-
"""Convert a JPEG2000 (.jpx) image to PNG using PyMuPDF's codecs."""
import sys
import fitz

src, dst = sys.argv[1], sys.argv[2]
pix = fitz.Pixmap(src)
if pix.n > 4:  # CMYK / alpha -> RGB
    pix = fitz.Pixmap(fitz.csRGB, pix)
pix.save(dst)
print(f"{pix.width}x{pix.height}")
