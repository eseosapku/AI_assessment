"""What each real Checkpoint paper actually covered.

The platform builds a Checkpoint paper from `STRAND_FOCI` in
`lib/checkpoint-paper.ts` — a hand-written list of syllabus topics. That is a
reasonable spread, but it is not what any real paper did. A learner revising
for Checkpoint wants "a paper like the one sat in May 2025", and the form had
no way to offer it: the past papers were used for the paper's SHAPE (how many
1/2/3-mark questions) and for figures, and their content was never read.

This reads the question papers and records, per paper, which of those foci it
actually examined, by matching the focus wording against the paper's text.

It deliberately does NOT store the questions. Cambridge's questions are theirs;
what is extracted here is topic coverage — which parts of the published
syllabus a given sitting drew on, and in what proportion. That is the same
observation a revision guide makes, and it is what lets the generator write
ORIGINAL questions with a real paper's balance.

Writes data/checkpoint-past-papers.json.

Run:
  python scripts/extract-checkpoint-coverage.py
  python scripts/extract-checkpoint-coverage.py --root "C:/path/to/papers"
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys

try:
    import fitz  # PyMuPDF
except ImportError:
    sys.exit("PyMuPDF is required: pip install pymupdf")

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_ROOTS = [
    r"C:\Users\Stephen\Downloads\Cambridge Past Papers_Etoile X Brain Ink-20260919T214745Z-1-001",
    r"C:\Users\Stephen\Downloads\pastPapers-20260919T222238Z-1-001",
]
OUT = os.path.join(REPO, "data", "checkpoint-past-papers.json")

# Only the subjects the product can actually build.
CODES = {"0862": "Mathematics", "0893": "Science", "0096": "Mathematics", "0097": "Science"}
PROGRAMME = {"0862": "lower-secondary", "0893": "lower-secondary", "0096": "primary", "0097": "primary"}

# A mark scheme names the answers; a question paper asks the questions. Only
# the question papers say what was examined in the learner's words.
SKIP = re.compile(r"mark[-_ ]?scheme|\bms\b|insert|report", re.I)


def foci_from_ts() -> dict[str, list[str]]:
    """Read STRAND_FOCI out of the TypeScript so the two can never drift."""
    src = open(os.path.join(REPO, "lib", "checkpoint-paper.ts"), encoding="utf-8").read()
    start = src.index("export const STRAND_FOCI")
    end = src.index("\n}", start)
    block = src[start:end]

    out: dict[str, list[str]] = {}
    for m in re.finditer(r"['\"]?([A-Za-z ,]+?)['\"]?:\s*\[(.*?)\]", block, re.S):
        strand = m.group(1).strip().strip("'\"")
        items = re.findall(r"'([^']+)'", m.group(2))
        if strand and items:
            out[strand] = items
    return out


#: The supplied papers are filed by subject, so the folder carries the code
#: when the filename does not. "Science/2023/October 2023 paper 1.pdf" is a
#: real 0893 paper and was being dropped silently -- which is why Science
#: appeared to start at 2025 when four years were supplied.
FOLDER_SUBJECT = {"mathematics": ("0862", "0096"), "science": ("0893", "0097"), "english": ("0861",)}


def paper_meta(path: str) -> dict | None:
    base = os.path.basename(path)
    if SKIP.search(base):
        return None

    code = next((c for c in CODES if c in base), None)
    if not code:
        # Fall back to the subject folder. Lower Secondary is the default of
        # the pair because that is what these folders hold; a Primary paper
        # names its code in the filename.
        folder = path.lower().replace("\\", "/")
        for word, codes in FOLDER_SUBJECT.items():
            if f"/{word}/" in folder:
                code = codes[0]
                break
    if not code or code not in CODES:
        return None

    year = None
    ym = re.search(r"[/\\](20\d{2})[/\\]", path) or re.search(r"\b(20\d{2})\b", base)
    if ym:
        year = int(ym.group(1))

    cm = (re.search(r"paper[-_ ]?0?([12])\b", base, re.I)
          or re.search(r"_0?([12])_", base)
          or re.search(r"\bp([12])\b", base, re.I))
    component = f"0{cm.group(1)}" if cm else None

    sm = re.search(r"\b(april|may|june|october|november)\b", base, re.I)
    session = sm.group(1).capitalize() if sm else None
    if not session:
        # Cambridge's own filenames lead with the month: 04_0862_01_...
        lead = re.match(r"(\d{2})_", base)
        if lead:
            session = {"04": "April", "05": "May", "06": "June", "10": "October", "11": "November"}.get(lead.group(1))

    return {"code": code, "subject": CODES[code], "programme": PROGRAMME[code],
            "year": year, "component": component, "session": session, "file": base}


def text_of(path: str) -> str:
    try:
        with fitz.open(path) as doc:
            return " ".join(page.get_text() for page in doc)
    except Exception as exc:  # a corrupt or encrypted paper must not stop the run
        print(f"  ! could not read {os.path.basename(path)}: {exc}")
        return ""


def focus_hits(text: str, foci: dict[str, list[str]], strands: list[str]) -> list[str]:
    """Which foci this paper examined.

    Matched on the focus's content words rather than the whole phrase: a paper
    says "Work out the size of angle x" and never "angles in triangles and
    quadrilaterals". Two content words is the bar, the same one the figure
    matcher uses and for the same reason -- one is noise.
    """
    low = text.lower()
    hits = []
    for strand in strands:
        for focus in foci.get(strand, []):
            words = [w for w in re.findall(r"[a-z]{4,}", focus.lower())
                     if w not in {"from", "with", "into", "between", "their", "using", "real", "this", "that"}]
            if not words:
                continue
            found = sum(1 for w in words if w in low)
            if found >= 2 or (len(words) == 1 and found == 1):
                hits.append(focus)
    return sorted(set(hits))


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", action="append", default=None)
    args = ap.parse_args()
    roots = args.root or DEFAULT_ROOTS

    foci = foci_from_ts()
    maths_strands = ["Number", "Algebra, Geometry and Measure", "Statistics and Probability"]
    sci_strands = [s for s in foci if s not in maths_strands]
    print(f"STRAND_FOCI: {sum(len(v) for v in foci.values())} foci across {len(foci)} strands")

    pdfs: list[str] = []
    for root in roots:
        if not os.path.isdir(root):
            print(f"  (skipping missing root {root})")
            continue
        for dirpath, _, names in os.walk(root):
            pdfs += [os.path.join(dirpath, n) for n in names if n.lower().endswith(".pdf")]
    print(f"scanning {len(pdfs)} PDFs")

    papers = []
    for path in sorted(pdfs):
        meta = paper_meta(path)
        if not meta or not meta["year"] or not meta["component"]:
            continue
        text = text_of(path)
        if len(text) < 500:
            continue
        strands = maths_strands if meta["subject"] == "Mathematics" else sci_strands
        meta["foci"] = focus_hits(text, foci, strands)
        meta["questionCount"] = len(re.findall(r"(?m)^\s*\d{1,2}\s", text))
        papers.append(meta)
        print(f"  {meta['code']}/{meta['component']} {meta['session'] or '?'} {meta['year']}: {len(meta['foci'])} foci")

    # One row per sitting: Cambridge issues several variants of a paper and
    # they examine the same syllabus, so they are merged rather than offered
    # as separate choices nobody can tell apart.
    merged: dict[str, dict] = {}
    for p in papers:
        key = f"{p['code']}-{p['year']}-{p['component']}"
        if key not in merged:
            merged[key] = {**p, "foci": list(p["foci"]), "sources": [p["file"]]}
            del merged[key]["file"]
        else:
            merged[key]["foci"] = sorted(set(merged[key]["foci"]) | set(p["foci"]))
            merged[key]["sources"].append(p["file"])

    rows = sorted(merged.values(), key=lambda r: (r["code"], -r["year"], r["component"]))
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump({"generatedAt": __import__("datetime").datetime.now().isoformat(timespec="seconds"),
                   "note": "Topic coverage only. No Cambridge question text is stored.",
                   "papers": rows}, fh, indent=1)

    print(f"\n{len(rows)} sittings -> {os.path.relpath(OUT, REPO)}")
    for r in rows:
        print(f"  {r['code']}/{r['component']} {r['session'] or '?':9} {r['year']}  {len(r['foci']):2} foci  ({len(r['sources'])} variant(s))")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
