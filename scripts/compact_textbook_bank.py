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

    python scripts/compact_textbook_bank.py
"""
import json
import os

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BANK = os.path.join(ROOT, "data", "textbook-figure-bank.json")
DIR = os.path.join(ROOT, "public", "textbook-images", "textbook-bank")
BIG = 120 * 1024


def main():
    bank = json.load(open(BANK, encoding="utf-8"))
    used = {f["localPath"] for f in bank["figures"]}
    before = after = converted = deleted = 0
    for book in os.listdir(DIR):
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
            if name.endswith(".png") and size > BIG:
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
    json.dump(bank, open(BANK, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("deleted %d unused, converted %d to JPEG; %.1f MB -> %.1f MB" % (deleted, converted, before / 1e6, after / 1e6))


if __name__ == "__main__":
    main()
