# -*- coding: utf-8 -*-
"""Extract chapter/unit outline from a Cambridge or REB PDF."""
import json
import re
import sys

import fitz

FULL_CHAPTER_RE = re.compile(
    r"^(?:Chapter|CHAPTER)\s+(\d+)[A-Za-z]?\s*:\s*(.+)$",
    re.MULTILINE,
)
CHAPTER_RE = re.compile(
    r"^(?:Chapter|CHAPTER)\s+(\d+[A-Za-z]?)\s*[:\.\-–—]\s*(.+)$",
    re.MULTILINE,
)
UNIT_RE = re.compile(
    r"^(?:UNIT|Unit|Unité|UNITE)\s+(\d+)\s*[:\.\-–—]\s+(.+)$",
    re.MULTILINE | re.IGNORECASE,
)
# Table-of-contents lines: "Chapter 3   Forces .......... 42"
TOC_CHAPTER_RE = re.compile(
    r"^(?:Chapter|CHAPTER)\s+(\d+[A-Za-z]?)\s+(.+?)(?:\s*[\.\s]{2,}\s*\d+)?\s*$",
    re.MULTILINE,
)
TOC_UNIT_RE = re.compile(
    r"^(?:Unit|UNIT)\s+(\d+)\s+(.+?)(?:\s*[\.\s]{2,}\s*\d+)?\s*$",
    re.MULTILINE | re.IGNORECASE,
)
SECTION_RE = re.compile(
    r"^(\d+)\.(\d+)\s+(.{4,120})$",
    re.MULTILINE,
)
JUNK_RE = re.compile(
    r"\b(assessment|copyright|isbn|shutterstock|contents|index|foreword|preface|acknowledg)\b",
    re.I,
)


def clean_line(line: str) -> str:
    line = re.sub(r"[\x00-\x1f\x7f]", "", line)
    line = re.sub(r"\s+", " ", line).strip()
    line = re.sub(r"[\.\s]+\d+\s*$", "", line)
    line = re.sub(r"^[\.\s]+", "", line)
    return line[:180]


def is_valid_title(title: str) -> bool:
    if not title or len(title.strip()) < 4:
        return False
    if JUNK_RE.search(title):
        return False
    if re.fullmatch(r"[\d\.\s+\-=]+", title):
        return False
    if re.match(r"^(p\d+|page\s*\d+)$", title, re.I):
        return False
    if len(title) > 90:
        return False
    if "=" in title or re.search(r"\b\d+\s*\+\s*\d+", title):
        return False
    if re.fullmatch(r"(?i)(true|false|count|null|void|int|float|string|times|each|link)", title.strip()):
        return False
    if re.fullmatch(r"\d+\s*days?", title.strip(), re.I):
        return False
    if re.search(r"\bcm\)\.?|cm long|grams of oxygen|mole of oxygen", title, re.I):
        return False
    if re.match(r"^(and|or|now|quality|paper|less)\b", title, re.I):
        return False
    if re.search(r"\b(does not|consider this|normal data|tell the user|newton industrial|industrial estate)\b", title, re.I):
        return False
    if re.match(r"^(calculate|find and|work out|you learned)\b", title, re.I):
        return False
    if re.search(r"\bchapter\s+\d+", title, re.I) and title.lower().count("chapter") >= 2:
        return False
    if title.count("(") >= 2:
        return False
    # Needs enough letters to be a heading, not a ledger cell
    letters = sum(1 for c in title if c.isalpha())
    if letters < 4:
        return False
    return True


def is_valid_subtopic(title: str) -> bool:
    if not is_valid_title(title):
        return False
    if len(title) < 6:
        return False
    if re.fullmatch(r"[\d\s]+", title):
        return False
    if re.match(r"^(less|mar|sept|each|terms:|sept\d|mar\d)", title, re.I):
        return False
    if re.search(r"discount for settlement|industrial estate", title, re.I):
        return False
    letters = sum(1 for c in title if c.isalpha())
    if letters < 5:
        return False
    return True


def pick_better_title(new: str, old: str) -> bool:
    if not is_valid_title(new):
        return False
    if not old:
        return True
    bad = lambda t: (
        len(t) > 72
        or t.lower() in {"link", "introduction", "times"}
        or re.match(r"^(introduced|explained|was|chapter|section)\b", t, re.I)
        or re.search(r"financial year ends|following information", t, re.I)
    )
    if bad(new) and not bad(old):
        return False
    if bad(old) and not bad(new):
        return True
    if 8 <= len(new) <= 60 and len(new) < len(old):
        return True
    return len(new) > len(old)


def add_topic_to_map(by_num: dict, num: str, kind: str, title: str):
    title = clean_line(title)
    if not is_valid_title(title):
        return
    try:
        n = int(re.sub(r"\D", "", num) or "999")
        if n > 40 or n <= 0:
            return
    except ValueError:
        return
    key = (kind.lower(), n)
    prev = by_num.get(key)
    prev_title = prev["name"].split(":", 1)[-1].strip() if prev else ""
    if not prev or pick_better_title(title, prev_title):
        by_num[key] = {"name": f"{kind} {num}: {title}"[:180], "subtopics": []}


def finalize_topics(topics: list[dict]) -> list[dict]:
    """Deduplicate by chapter/unit number, drop junk, keep syllabus order without big gaps."""
    by_num: dict[int, dict] = {}
    kind_default = "Chapter"

    for t in topics:
        m = re.match(r"^(Chapter|Unit)\s+(\d+)[A-Za-z]?\s*:?\s*(.*)$", t["name"], re.I)
        if not m:
            continue
        kind_default = m.group(1).title()
        num = int(re.sub(r"\D", "", m.group(2)) or "0")
        if num <= 0 or num > 40:
            continue
        title = clean_line(m.group(3) or "")
        if title and not is_valid_title(title):
            continue
        name = f"{kind_default} {num}: {title}" if title else f"{kind_default} {num}"
        if not title and not (t.get("subtopics") or []):
            continue
        candidate = {
            "name": name[:180],
            "subtopics": filter_subtopics(t.get("subtopics") or []),
        }
        prev = by_num.get(num)
        prev_title = prev["name"].split(":", 1)[-1].strip() if prev else ""
        new_title = title or ""
        if not prev or pick_better_title(new_title or name, prev_title):
            by_num[num] = candidate

    if not by_num:
        return []

    nums = sorted(by_num.keys())
    kept: list[dict] = []
    prev = 0
    for num in nums:
        if kept and num - prev >= 2:
            break
        kept.append(by_num[num])
        prev = num
    return kept


def sort_key_num(value: str) -> tuple:
    m = re.search(r"(\d+)", value)
    return (int(m.group(1)) if m else 9999, value.lower())


def merge_chapter_titles(topics: list[dict], text: str) -> list[dict]:
    """Fill in bare 'Chapter N' names from TOC lines elsewhere in the text."""
    titles_by_num: dict[str, str] = {}
    for pat in (TOC_CHAPTER_RE, CHAPTER_RE):
        for m in pat.finditer(text):
            num, title = m.group(1), clean_line(m.group(2))
            if is_valid_title(title):
                titles_by_num[num] = title
    for t in topics:
        m = re.match(r"^Chapter\s+(\d+[A-Za-z]?)\s*:?\s*(.*)$", t["name"], re.I)
        if not m:
            continue
        num, rest = m.group(1), m.group(2).strip()
        if not rest and num in titles_by_num:
            t["name"] = f"Chapter {num}: {titles_by_num[num]}"
        elif rest and len(rest) < 4 and num in titles_by_num:
            t["name"] = f"Chapter {num}: {titles_by_num[num]}"
    return topics


def extract_from_sections(text: str, kind: str = "Chapter") -> list[dict]:
    """Group 1.1, 1.2 headings under Chapter/Unit 1 with real subtopic names."""
    by_chapter: dict[str, dict] = {}
    first_section_title: dict[str, str] = {}

    for m in SECTION_RE.finditer(text):
        ch, sec, title = m.group(1), m.group(2), clean_line(m.group(3))
        if not is_valid_title(title):
            continue
        try:
            ch_num = int(ch)
            if ch_num > 35 or ch_num == 0:
                continue
        except ValueError:
            continue

        if sec == "1" and ch not in first_section_title:
            first_section_title[ch] = title

        entry = by_chapter.setdefault(
            ch,
            {"name": f"{kind} {ch}", "subtopics": [], "_seen": set()},
        )
        key = title.lower()
        if key in entry["_seen"]:
            continue
        entry["_seen"].add(key)
        entry["subtopics"].append(title)

    topics = []
    for ch in sorted(by_chapter.keys(), key=lambda x: int(x)):
        item = by_chapter[ch]
        del item["_seen"]
        if item["subtopics"]:
            lead = first_section_title.get(ch) or item["subtopics"][0]
            item["name"] = f"{kind} {ch}: {lead}"
            topics.append(item)
    return topics


def detect_section_kind(text: str) -> str:
    unit_hits = len(re.findall(r"(?m)^Unit\s+\d+", text, re.I))
    chapter_hits = len(re.findall(r"(?m)^Chapter\s+\d+", text, re.I))
    return "Unit" if unit_hits > chapter_hits else "Chapter"


JUNK_SUB_RE = re.compile(
    r"^(understand|deduce|explain|describe|define|state|calculate|use|apply|analyse|analyze)\b",
    re.I,
)


def filter_subtopics(subs: list[str]) -> list[str]:
    out = []
    seen = set()
    for s in subs:
        s = clean_line(s)
        if not is_valid_subtopic(s) or len(s) > 100:
            continue
        if JUNK_SUB_RE.match(s):
            continue
        key = s.lower()
        if key in seen:
            continue
        seen.add(key)
        out.append(s)
    return out[:20]


def enrich_bare_chapters(topics: list[dict]) -> list[dict]:
    """Turn bare 'Chapter 3' into 'Chapter 3: Forces' using the first real subtopic."""
    for t in topics:
        m = re.match(r"^(Chapter|Unit)\s+(\d+[A-Za-z]?)\s*$", t["name"], re.I)
        if not m:
            continue
        kind, num = m.group(1), m.group(2)
        subs = filter_subtopics(t.get("subtopics") or [])
        t["subtopics"] = subs
        if subs:
            title = subs[0]
            if len(title) > 55:
                title = title[:52] + "..."
            t["name"] = f"{kind} {num}: {title}"
        else:
            t["name"] = f"{kind} {num}"
    return topics


def extract_outline(pdf_path: str, max_pages: int = 80) -> dict:
    doc = fitz.open(pdf_path)
    page_count = doc.page_count

    # Early pages for TOC / chapter headings
    early_indices = list(range(min(25, page_count)))
    if page_count > 25:
        early_indices.extend(range(25, min(max_pages, page_count), 3))
    early_text = "\n".join(doc[i].get_text() for i in early_indices)

    # Full document for numbered sections (1.1, 2.3, …) — lightweight line scan
    full_text = "\n".join(doc[i].get_text() for i in range(page_count))
    text_chars = len(re.sub(r"\s+", "", full_text))
    section_kind = detect_section_kind(early_text + full_text[:50000])

    topics: list[dict] = []
    by_num: dict[tuple[str, int], dict] = {}

    def add_topic(num: str, kind: str, title: str):
        add_topic_to_map(by_num, num, kind, title)

    # 1) Chapter/Unit headings across the full book
    for m in FULL_CHAPTER_RE.finditer(full_text):
        add_topic(m.group(1), "Chapter", m.group(2))
    for m in CHAPTER_RE.finditer(full_text):
        add_topic(m.group(1), "Chapter", m.group(2))
    for m in UNIT_RE.finditer(full_text):
        add_topic(m.group(1), "Unit", m.group(2))
    for m in TOC_CHAPTER_RE.finditer(full_text):
        add_topic(m.group(1), "Chapter", m.group(2))
    for m in TOC_UNIT_RE.finditer(full_text):
        add_topic(m.group(1), "Unit", m.group(2))

    chapter_topics: list[dict] = []
    nums = sorted({k[1] for k in by_num.keys()})
    for n in nums:
        keys = [k for k in by_num if k[1] == n]
        pick = next((k for k in keys if k[0] == "chapter"), keys[0])
        chapter_topics.append(by_num[pick])

    section_topics = extract_from_sections(full_text, kind=section_kind)

    def quality_score(items: list[dict]) -> int:
        score = 0
        for t in items:
            title = t["name"].split(":", 1)[-1].strip()
            if is_valid_title(title) and len(title) <= 72:
                score += 2
            elif t.get("subtopics"):
                score += 1
        return score

    topics = chapter_topics
    if len(chapter_topics) < 5:
        topics = section_topics if len(section_topics) > len(chapter_topics) else chapter_topics
    elif len(section_topics) > len(chapter_topics) and quality_score(section_topics) > quality_score(chapter_topics) + 4:
        topics = section_topics

    # Attach 1.x subtopics under matching chapters
    if topics and any(t["name"].lower().startswith("chapter") for t in topics):
        chap_map = {re.search(r"(\d+)", t["name"]).group(1): t for t in topics if re.search(r"(\d+)", t["name"])}
        for m in SECTION_RE.finditer(full_text):
            ch, title = m.group(1), clean_line(m.group(3))
            if not is_valid_subtopic(title) or ch not in chap_map:
                continue
            subs = chap_map[ch].setdefault("subtopics", [])
            if title not in subs:
                subs.append(title)

    topics = enrich_bare_chapters(topics)
    topics = finalize_topics(topics)

    doc.close()
    return {
        "topics": topics,
        "image_only": text_chars < 200 and page_count > 10,
        "text_chars": text_chars,
    }


if __name__ == "__main__":
    sys.stdout = open(sys.stdout.fileno(), mode="w", encoding="utf-8", errors="replace", buffering=1)
    path = sys.argv[1]
    outline = extract_outline(path)
    print(json.dumps(outline, ensure_ascii=False))
