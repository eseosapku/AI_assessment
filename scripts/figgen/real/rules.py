"""Checks on a Wikimedia file before anything is downloaded or paid for (spec 5.3, step 2)."""
from __future__ import annotations

import re

# Public domain, CC0, CC BY and CC BY-SA in any version; never NC or ND (spec 3.5).
LICENCE = re.compile(r"^(?:cc0|cc-zero|public domain|pd(?:\b|-)|cc[ -]by(?:-sa)?[ -]\d)", re.I)
BANNED = re.compile(r"(?:\b|-)(?:nc|nd)\b|non-?commercial|no ?deriv", re.I)
FREE_WITHOUT_AUTHOR = re.compile(r"^(?:cc0|cc-zero|public domain|pd(?:\b|-))", re.I)
# The subject is a person, or the file is a logo or decoration (spec section 4).
PEOPLE = re.compile(r"portrait|selfie|\bpeople\b|\bmen\b|\bwomen\b|\bpersons?\b|\blogos?\b|\bicons?\b|clip ?art|"
                    r"\bemblems?\b|coats? of arms|\bsignatures?\b", re.I)
# A translated copy of a diagram, such as "...-zh.jpg" or "... tr.svg", has labels that are not in English.
LANGS = ("zh|fr|es|de|ru|ar|ja|ko|it|pt|nl|pl|uk|fa|tr|he|cs|sv|fi|hu|vi|id|ca|el|ro|bg|sr|hr|th|hi|bn|ta|da|nb|"
         "sk|sl|lt|lv|et|eu|gl|ms|sw|rw")
TRANSLATED = re.compile(rf"[-_( ](?:{LANGS})(?:-[a-z]{{2,4}})?\)?\.(?:jpe?g|png|tiff?|webp|gif|svg)$", re.I)
# A scanned page of an old book, catalogue or document, which the user does not want however good the
# drawing on it (2026-10-12): DPLA and Biodiversity Heritage Library scans, Internet Archive book pages.
SCANNED_TITLE = re.compile(r"\bDPLA\b|\bBHL\d|\(page \d+\)|\bimage from page\b|\bpage \d+ of\b", re.I)
SCANNED_CATEGORY = re.compile(r"internet archive book images|biodiversity heritage library|\bbook scans?\b", re.I)
MIN_SHORT_SIDE = 600  # spec 5.3: at least 600 px on the short side
TYPES = ("image/jpeg", "image/png", "image/webp", "image/tiff", "image/svg+xml")


def licence_ok(name: str) -> bool:
    name = name.strip()
    return bool(name) and bool(LICENCE.search(name)) and not BANNED.search(name)


def is_scan(title: str, categories) -> bool:
    return bool(SCANNED_TITLE.search(title)) or any(SCANNED_CATEGORY.search(cat) for cat in categories)


def reject_reason(c: dict) -> str | None:
    """Why a candidate is turned away before download, or None to keep it."""
    if not licence_ok(c["licence"]):
        return f"licence {c['licence'] or 'missing'}"
    if c["restrictions"]:
        return f"restricted: {c['restrictions']}"
    if not c["author"] and not FREE_WITHOUT_AUTHOR.search(c["licence"]):
        return "no author to credit"
    if c["mime"] != "image/svg+xml" and min(c["width"], c["height"]) < MIN_SHORT_SIDE:  # a vector diagram renders sharp at any size
        return f"too small ({c['width']}x{c['height']})"
    if c["mime"] not in TYPES:
        return f"file type {c['mime']}"
    hits = [cat for cat in c["categories"] if PEOPLE.search(cat)]
    if hits:
        return f"category {hits[0]}"
    if TRANSLATED.search(c["title"]):
        return "a translated copy"
    if is_scan(c["title"], c["categories"]):
        return "a scanned book page"
    return None
