# -*- coding: utf-8 -*-
"""Read the Cambridge Checkpoint papers and report how they are actually written.

Not to copy questions -- that is both illegal and pointless -- but to settle,
from evidence rather than assumption, the things the generator keeps getting
wrong:

  * how a question is numbered and parted: 1, 1(a), 1(b)(i)
  * how many parts a numbered question really has
  * which command words open a stem, and how often
  * how long a stem is
  * how marks are printed and distributed
  * how a figure is referred to

Every one of those has been guessed at so far. The paper knows.

    python scripts/study_past_papers.py <root> [--subject 0862] [--limit 40]

Writes data/audit/paper-style.json and prints a summary.
"""
import json
import os
import re
import sys
from collections import Counter, defaultdict

import fitz

fitz.TOOLS.mupdf_display_errors(False)

# "1", "12", "1(a)", "(a)", "(b)(i)" at the start of a line.
NUMBERED = re.compile(r"^\s*(\d{1,2})\s{1,4}(?=[A-Z(])")
BARE_NUMBER = re.compile(r"^\s*(\d{1,2})\s*$")
PART = re.compile(r"^\s*\(([a-z])\)\s*")
SUBPART = re.compile(r"^\s*\((i|ii|iii|iv|v)\)\s*")
MARKS = re.compile(r"\[(\d{1,2})\]\s*$")

# The opening words of a demand, counted as written.
COMMAND = re.compile(
    r"^(write down|write|complete|draw a ring around|draw|tick|circle|calculate|work out|"
    r"find|give|state|name|explain|describe|suggest|identify|show|use|look at|match|"
    r"put|order|estimate|measure|predict|compare|choose|underline|label|add|shade|plot)\b",
    re.I,
)

FIGURE_REF = re.compile(
    r"\b(look at the \w+|the diagram shows|the table shows|the graph shows|the chart shows|"
    r"here is|shown (?:above|below)|in the diagram|on the grid|the picture shows)\b",
    re.I,
)


def paper_code(name):
    m = re.search(r"\b(0\d{3})\b", name)
    return m.group(1) if m else "?"


def lines_of(pdf):
    doc = fitz.open(pdf)
    out = []
    for page in doc:
        try:
            text = page.get_text("text")
        except Exception:
            continue
        for raw in text.split("\n"):
            line = raw.rstrip()
            if line.strip():
                out.append(line)
    doc.close()
    return out


def study(pdf, stats):
    name = os.path.basename(pdf)
    code = paper_code(name)
    stats["papers"][code] += 1

    lines = lines_of(pdf)
    parts_in_question = 0
    saw_question = False
    want = 1

    for i, line in enumerate(lines):
        stripped = line.strip()

        # Marks are printed at the end of the demand they belong to.
        m = MARKS.search(stripped)
        if m:
            stats["marks"][code][int(m.group(1))] += 1

        # A question number is the NEXT number in sequence, printed either
        # before its text ("1   Look at ...") or -- far more often in these
        # PDFs -- on a line of its own. Only the first form was counted, so
        # Science read as 5.1 numbered questions a paper when a real 0893
        # paper has sixteen or more and 0097 fourteen, and the blueprint built
        # six topics with five parts each instead. A bare number followed by
        # the copyright line is a page number, not a question.
        nm = NUMBERED.match(line) or BARE_NUMBER.match(line)
        next_line = lines[i + 1].strip() if i + 1 < len(lines) else ""
        is_page_number = BARE_NUMBER.match(line) and next_line.startswith("©")
        if nm and int(nm.group(1)) == want and not is_page_number:
            want += 1
            if saw_question:
                stats["parts_per_question"][code][parts_in_question] += 1
            saw_question = True
            parts_in_question = 0
            stats["numbered"][code] += 1

        if PART.match(line):
            parts_in_question += 1
            stats["lettered_parts"][code] += 1
        if SUBPART.match(line):
            stats["roman_subparts"][code] += 1

        body = PART.sub("", SUBPART.sub("", NUMBERED.sub("", line))).strip()
        c = COMMAND.match(body)
        if c:
            stats["commands"][code][c.group(1).lower()] += 1
            # Stem length, in words, for a line that plainly opens a demand.
            stats["stem_words"][code].append(len(body.split()))

        f = FIGURE_REF.search(body)
        if f:
            stats["figure_refs"][code][f.group(1).lower()] += 1

    if saw_question:
        stats["parts_per_question"][code][parts_in_question] += 1


def main():
    if len(sys.argv) < 2:
        print("usage: study_past_papers.py <root> [--subject 0862] [--limit N]")
        return 1
    root = sys.argv[1]
    want = None
    limit = 0
    for i, a in enumerate(sys.argv):
        if a == "--subject" and i + 1 < len(sys.argv):
            want = sys.argv[i + 1]
        if a == "--limit" and i + 1 < len(sys.argv):
            limit = int(sys.argv[i + 1])

    stats = {
        "papers": Counter(),
        "numbered": Counter(),
        "lettered_parts": Counter(),
        "roman_subparts": Counter(),
        "marks": defaultdict(Counter),
        "commands": defaultdict(Counter),
        "parts_per_question": defaultdict(Counter),
        "figure_refs": defaultdict(Counter),
        "stem_words": defaultdict(list),
    }

    pdfs = []
    for dirpath, _, files in os.walk(root):
        for f in files:
            if not f.lower().endswith(".pdf"):
                continue
            # Question papers only. A mark scheme is a different document and
            # counting its "answers" as stems would poison every figure here.
            low = f.lower()
            if "mark" in low and "scheme" in low:
                continue
            if "insert" in low:
                continue
            if want and want not in f:
                continue
            pdfs.append(os.path.join(dirpath, f))
    if limit:
        pdfs = pdfs[:limit]

    for pdf in pdfs:
        try:
            study(pdf, stats)
        except Exception as err:
            print("  skipped %s: %s" % (os.path.basename(pdf)[:50], str(err)[:60]))

    report = {}
    for code in sorted(stats["papers"]):
        words = stats["stem_words"][code]
        words.sort()
        n = stats["papers"][code]
        report[code] = {
            "papers": n,
            "numbered_questions_per_paper": round(stats["numbered"][code] / max(1, n), 1),
            "lettered_parts_per_paper": round(stats["lettered_parts"][code] / max(1, n), 1),
            "roman_subparts_per_paper": round(stats["roman_subparts"][code] / max(1, n), 1),
            "parts_per_question": dict(sorted(stats["parts_per_question"][code].items())),
            "marks_seen": dict(sorted(stats["marks"][code].items())),
            "top_commands": stats["commands"][code].most_common(14),
            "figure_phrases": stats["figure_refs"][code].most_common(8),
            "stem_words_median": words[len(words) // 2] if words else 0,
            "stem_words_p90": words[int(len(words) * 0.9)] if words else 0,
        }

    out_dir = os.path.join(os.path.dirname(__file__), "..", "data", "audit")
    os.makedirs(out_dir, exist_ok=True)
    out = os.path.join(out_dir, "paper-style.json")
    with open(out, "w", encoding="utf-8") as fh:
        json.dump(report, fh, indent=2)

    for code, r in report.items():
        print("\n=== %s  (%d papers) ===" % (code, r["papers"]))
        print("  numbered questions / paper : %s" % r["numbered_questions_per_paper"])
        print("  lettered (a)(b) / paper    : %s" % r["lettered_parts_per_paper"])
        print("  roman (i)(ii) / paper      : %s" % r["roman_subparts_per_paper"])
        print("  parts per question         : %s" % r["parts_per_question"])
        print("  marks printed              : %s" % r["marks_seen"])
        print("  stem words  median/p90     : %s / %s" % (r["stem_words_median"], r["stem_words_p90"]))
        print("  commands                   : %s" % r["top_commands"])
        print("  figure phrases             : %s" % r["figure_phrases"])
    print("\nwrote %s" % out)
    return 0


if __name__ == "__main__":
    sys.exit(main())
