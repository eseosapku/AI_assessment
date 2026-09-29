# -*- coding: utf-8 -*-
"""Pull real question stems out of the Checkpoint papers, as STYLE references.

`study_past_papers.py` counted the papers -- how many parts, which command
words, how long a demand runs. This takes the next step and keeps the demands
themselves, so the generator can be shown what one looks like instead of being
described one.

The obvious hazard is the one this codebase keeps hitting: an example in a
prompt comes back as content. Three separate times -- the iron chains, the
marble-and-crater graph, the walk/bus bar chart. So two things are true of
everything written here:

  * the CONTENT is stripped. Numbers become <n>, units stay, names become
    <name>. What survives is the shape of the demand, not its subject.
  * the caller must never show a stem from the topic it is asking about.

A stem is kept only if it is plainly a demand: it opens with a command word,
ends in a question mark or a printed mark total, and is short enough to be a
demand rather than a paragraph of stimulus.

    python scripts/extract_paper_questions.py <root> [--limit N]

Writes data/paper-styles.json: {code: {command: [shapes]}}
"""
import json
import os
import re
import sys
from collections import defaultdict

import fitz

fitz.TOOLS.mupdf_display_errors(False)

COMMAND = re.compile(
    r"^(write down|write|complete|draw a ring around|draw|tick|circle|calculate|work out|"
    r"find|give|state|name|explain|describe|suggest|identify|show|look at|match|"
    r"put|order|estimate|measure|predict|compare|choose|underline|label|shade|plot)\b",
    re.I,
)

# The cover page. "Write your name, centre number and candidate number in the
# boxes at the top of the page." opens with a command and ends in a full stop,
# so it was kept as a demand -- and shown to composition slots as one of three
# real questions from the paper.
RUBRIC = re.compile(
    r"candidate number|centre number|space provided|in the boxes at the top|"
    r"answer all questions|blank pages?|this document has",
    re.I,
)

NUMBERED = re.compile(r"^\s*\d{1,2}\s{1,4}(?=[A-Z(])")
PART = re.compile(r"^\s*\([a-z]\)\s*")
SUBPART = re.compile(r"^\s*\((?:i|ii|iii|iv|v)\)\s*")
MARKS = re.compile(r"\s*\[\d{1,2}\]\s*$")

# A capitalised word that is not the first word of the sentence is a name.
NAME = re.compile(r"(?<!^)(?<![.!?] )\b[A-Z][a-z]{2,}\b")
NUMBER = re.compile(r"\b\d+(?:\.\d+)?\b")


def paper_code(name):
    m = re.search(r"\b(0\d{3})\b", name)
    return m.group(1) if m else None


# Private-use glyphs from the symbol fonts the papers set ticks and boxes in.
# They render as a tick in Wingdings and as a black diamond everywhere else.
PUA = re.compile("[" + chr(0xE000) + "-" + chr(0xF8FF) + "]")


def shape_of(stem):
    """Strip the content, keep the demand."""
    s = PUA.sub("", stem)
    s = s.replace("–", "-").replace("—", "-")
    s = s.replace("‘", "'").replace("’", "'")
    s = s.replace("“", '"').replace("”", '"')
    s = MARKS.sub("", s).strip()
    s = NAME.sub("<name>", s)
    s = NUMBER.sub("<n>", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def stems_from(pdf):
    out = []
    doc = fitz.open(pdf)
    for page in doc:
        try:
            text = page.get_text("text")
        except Exception:
            continue
        for raw in text.split("\n"):
            line = PART.sub("", SUBPART.sub("", NUMBERED.sub("", raw.strip())))
            line = line.strip()
            if len(line) < 12 or len(line) > 150:
                continue
            m = COMMAND.match(line)
            if not m or RUBRIC.search(line):
                continue
            # A demand ends in a question mark, a full stop, or its marks.
            if not (line.endswith("?") or line.endswith(".") or MARKS.search(line)):
                continue
            out.append((m.group(1).lower(), line))
    doc.close()
    return out


def main():
    if len(sys.argv) < 2:
        print("usage: extract_paper_questions.py <root> [--limit N]")
        return 1
    root = sys.argv[1]
    limit = 0
    for i, a in enumerate(sys.argv):
        if a == "--limit" and i + 1 < len(sys.argv):
            limit = int(sys.argv[i + 1])

    pdfs = []
    for dirpath, _, files in os.walk(root):
        for f in files:
            low = f.lower()
            if not low.endswith(".pdf"):
                continue
            if ("mark" in low and "scheme" in low) or "insert" in low:
                continue
            if not paper_code(f):
                continue
            pdfs.append(os.path.join(dirpath, f))
    if limit:
        pdfs = pdfs[:limit]

    by_code = defaultdict(lambda: defaultdict(list))
    seen = defaultdict(set)
    for pdf in pdfs:
        code = paper_code(os.path.basename(pdf))
        try:
            for command, stem in stems_from(pdf):
                shape = shape_of(stem)
                if len(shape) < 12:
                    continue
                key = shape.lower()
                if key in seen[code]:
                    continue
                seen[code].add(key)
                by_code[code][command].append(shape)
        except Exception as err:
            print("  skipped %s: %s" % (os.path.basename(pdf)[:48], str(err)[:60]))

    # Keep the most useful handful per command: short, varied, and never the
    # same opening twice.
    report = {}
    for code, commands in by_code.items():
        kept = {}
        for command, shapes in commands.items():
            shapes.sort(key=len)
            picked = []
            starts = set()
            for s in shapes:
                head = " ".join(s.split()[:4]).lower()
                if head in starts:
                    continue
                starts.add(head)
                picked.append(s)
                if len(picked) >= 6:
                    break
            if picked:
                kept[command] = picked
        report[code] = kept

    out_dir = os.path.join(os.path.dirname(__file__), "..", "data")
    out = os.path.join(out_dir, "paper-styles.json")
    with open(out, "w", encoding="utf-8") as fh:
        json.dump(report, fh, indent=2, ensure_ascii=False)

    total = sum(len(v) for c in report.values() for v in c.values())
    for code in sorted(report):
        n = sum(len(v) for v in report[code].values())
        print("%s: %d shapes across %d commands" % (code, n, len(report[code])))
        for command in list(report[code])[:4]:
            line = report[code][command][0][:78]
            safe = line.encode("ascii", "replace").decode("ascii")
            print("    %-20s %s" % (command, safe))
    print("\n%d shapes -> %s" % (total, out))
    return 0


if __name__ == "__main__":
    sys.exit(main())
