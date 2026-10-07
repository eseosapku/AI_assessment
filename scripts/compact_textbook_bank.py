# -*- coding: utf-8 -*-
"""Shrink the textbook figure bank before it ships.

A scanned page cropped at print resolution is a photograph of paper, and as a
PNG one runs to 200 KB; the first two Science books alone came to 60 MB. As a
JPEG at quality 82 the same crop is a fifth of that and looks no different on
screen. Line art from a digital book stays PNG, where it is already small.

Crops no figure in data/textbook-figure-bank.json uses are deleted -- the
judge refused them, and nothing has printed them. Run AFTER the merge and
BEFORE any paper is saved with these figures; once papers reference them,
never delete (see merge-checkpoint-figure-bank.ts).

    python scripts/compact_textbook_bank.py [--only=13,14]

--only limits it to those books' folders: crops already shipped elsewhere are
never touched by a run meant for newly cropped books.
"""
import json
import os
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BANK = os.path.join(ROOT, "data", "textbook-figure-bank.json")
DIR = os.path.join(ROOT, "public", "textbook-images", "textbook-bank")
BIG = 120 * 1024
MAX_W = 1000


def books(directory):
    only = next((a.split("=", 1)[1] for a in sys.argv if a.startswith("--only=")), None)
    names = os.listdir(directory)
    return [n for n in names if n in only.split(",")] if only else names


def main():
    bank = json.load(open(BANK, encoding="utf-8"))
    used = {f["localPath"] for f in bank["figures"]}
    before = after = converted = deleted = 0
    for book in books(DIR):
        folder = os.path.join(DIR, book)
        for name in os.listdir(folder):
            path = os.path.join(folder, name)
            url = "/textbook-images/textbook-bank/%s/%s" % (book, name)
            size = os.path.getsize(path)
            before += size
            if url not in used:
                os.remove(path)
                deleted += 1
                continue
            # A scanned crop ("s<page>-f<n>") is a photograph of paper, so it is
            # a JPEG at any size; only a digital book's line art stays PNG.
            if name.endswith(".png") and (size > BIG or name.startswith("s")):
                jpg = path[:-4] + ".jpg"
                Image.open(path).convert("RGB").save(jpg, "JPEG", quality=82, optimize=True)
                os.remove(path)
                for f in bank["figures"]:
                    if f["localPath"] == url:
                        f["localPath"] = url[:-4] + ".jpg"
                after += os.path.getsize(jpg)
                converted += 1
            else:
                after += size
        if not os.listdir(folder):
            os.rmdir(folder)
    # Nothing wider than the screen needs. A figure is shown in a panel about
    # 500 px wide; 1000 px covers a high-density screen. Scan crops came out
    # at 1400 px and more, and the 3,163-figure bank was 165 MB.
    shrunk = 0
    for book in books(DIR):
        folder = os.path.join(DIR, book)
        for name in os.listdir(folder):
            path = os.path.join(folder, name)
            img = Image.open(path)
            if img.width <= MAX_W:
                img.close()
                continue
            h = round(img.height * MAX_W / img.width)
            small = img.resize((MAX_W, h), Image.LANCZOS)
            img.close()
            if name.endswith(".jpg"):
                small.convert("RGB").save(path, "JPEG", quality=80, optimize=True)
            else:
                small.save(path, optimize=True)
            shrunk += 1
    total = sum(os.path.getsize(os.path.join(DIR, b, n)) for b in os.listdir(DIR) for n in os.listdir(os.path.join(DIR, b)))
    print("downscaled %d wider than %d px; now %.1f MB" % (shrunk, MAX_W, total / 1e6))
    json.dump(bank, open(BANK, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("deleted %d unused, converted %d to JPEG; %.1f MB -> %.1f MB" % (deleted, converted, before / 1e6, after / 1e6))


if __name__ == "__main__":
    main()
