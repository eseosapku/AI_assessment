"""Answers of the P4 computing-a families (data, hardware and systems), recomputed independently over 1,000 seeds:
the what-if models worked through by an evaluator of this file's own, the query grid run on the records, the charts'
covered cells read back, the tables sorted and filtered, the IPOS boxes and ladder items classed by this file's own
rules, the memory pyramid read from where its letters stand, the timelines read from their printed years, the keys and
mouse parts found at the ends of their leaders, the boot cards ordered by this file's own keywords.

Nothing here calls a family's own helpers to work out a key.
"""
import math
import random
import re
import sqlite3
import sys
from collections import Counter, defaultdict
from pathlib import Path

import matplotlib.pyplot as plt
import pytest
from matplotlib.text import Text

from figgen.core import NAMES
from figgen.families import FAMILIES

SEEDS = range(1, 1001)
DRAWN = range(1, 41)
NEW = ("spreadsheet_chart", "data_processing_cycle", "memory_hierarchy", "computer_generations", "keyboard_mouse_p",
       "os_boot")
EDITED = ("spreadsheet_formula", "database_query")
STORE = Path("C:/Users/Stephen/figure-library/figures.db")


def run(m, seed):
    rng = random.Random(seed)
    p = m.sample(rng)
    return p, m.questions(p, rng)


def picked(q):
    return q.options[int(q.answer)]


def fam(fid):
    if fid not in FAMILIES:
        pytest.fail(f"{fid} is not registered")
    return FAMILIES[fid]


def texts(m, p) -> list:
    fig = m.draw(p)
    try:
        return [t.get_text() for ax in fig.axes for t in ax.texts]
    finally:
        plt.close(fig)


def placed(m, p) -> list:
    """Every text drawn, with its place in data coordinates and its font size and weight."""
    fig = m.draw(p)
    try:
        return [(t.get_text(), t.get_position(), t.get_fontsize(), t.get_fontweight(), t.get_gid())
                for ax in fig.axes for t in ax.texts]
    finally:
        plt.close(fig)


def drawn_texts(fig):
    seen = []
    original = Text.draw

    def record(self, renderer):
        original(self, renderer)
        if self.get_visible() and self.get_text().strip():
            seen.append(self)

    Text.draw = record
    try:
        fig.canvas.draw()
    finally:
        Text.draw = original
    renderer = fig.canvas.get_renderer()
    return [(t, t.get_window_extent(renderer)) for t in seen]


def inside(pt, box, margin=1.0) -> bool:
    return box.x0 + margin < pt[0] < box.x1 - margin and box.y0 + margin < pt[1] < box.y1 - margin


def crosses(line, box, margin=1.0, steps=80) -> bool:
    pts = line.get_transform().transform(line.get_xydata())
    for a, b in zip(pts, pts[1:]):
        if any(inside((a[0] + (b[0] - a[0]) * k / steps, a[1] + (b[1] - a[1]) * k / steps), box, margin)
               for k in range(steps + 1)):
            return True
    return False


def _central(options):
    toks = [Counter(re.findall(r"-?\d+|[a-zA-Z]+|\S", o)) for o in options]
    score = [sum(sum(((t - u) + (u - t)).values()) for u in toks) for t in toks]
    best = min(score)
    return score.index(best) if score.count(best) == 1 else None


def subs_of(m, key, n=1000):
    return Counter(key(m.sample(random.Random(s))) for s in range(1, n + 1))


# --- spreadsheet_formula: what-if models -----------------------------------------------------------------

def calc(expr: str, cells: dict) -> int:
    """A formula of cell references, whole numbers, + - and *, worked out with * first."""
    toks = re.findall(r"B\d+|\d+|[+\-*]", expr.lstrip("="))
    total, term, sign, op = 0, None, 1, None
    for t in toks + ["+"]:
        if t in "+-":
            total += sign * term
            sign, term, op = (1 if t == "+" else -1), None, None
        elif t == "*":
            op = "*"
        else:
            v = cells[t] if t.startswith("B") else int(t)
            term = v if term is None else term * v
    return total


def sheet_cells(table, inputs):
    cells = {}
    for r, row in enumerate(table[1:], start=2):
        if row[2] == "":
            cells[f"B{r}"] = inputs.get(f"B{r}", row[1])
    for r, row in enumerate(table[1:], start=2):
        if row[2]:
            cells[f"B{r}"] = calc(row[2], cells)
    return cells


def test_spreadsheet_formula_whatif():
    m = fam("spreadsheet_formula")
    seen = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        if p.get("sub") != "whatif":
            continue
        seen[p["model"]] += 1
        table = p["table"]
        shown = sheet_cells(table, {})
        for r, row in enumerate(table[1:], start=2):  # every printed value is what its formula gives
            assert row[1] == shown[f"B{r}"], (s, r)
        asked = set()
        for q in qs:
            got = re.search(r"If cell (B\d+) is changed from (\d+) to (\d+), what value will cell (B\d+) show\?", q.stem)
            if got:
                asked.add("result")
                ref, old, new, out = got.group(1), int(got.group(2)), int(got.group(3)), got.group(4)
                assert shown[ref] == old and table[int(ref[1:]) - 1][2] == "", s  # an input cell, as printed
                after = sheet_cells(table, {ref: new})
                assert q.answer == str(after[out]) and after[out] != shown[out], (s, q.answer)
            got = re.search(r"the value in cell (B\d+) is changed to (\d+)\. What will cell (B\d+) show then\?", q.stem)
            if got:
                asked.add("middle")
                after = sheet_cells(table, {got.group(1): int(got.group(2))})
                assert q.answer == str(after[got.group(3)]) and after[got.group(3)] != shown[got.group(3)], s
            got = re.search(r"smallest whole number of .+ in cell (B\d+) that makes cell (B\d+) "
                            r"(more than (\d+)|at least (\d+)|(\d+) or less)\?", q.stem)
            if got:
                asked.add("goal")
                ref, out = got.group(1), got.group(2)
                if got.group(4):
                    ok = lambda v, m_=int(got.group(4)): v > m_  # noqa: E731
                elif got.group(5):
                    ok = lambda v, m_=int(got.group(5)): v >= m_  # noqa: E731
                else:
                    ok = lambda v, m_=int(got.group(6)): v <= m_  # noqa: E731
                want = next(v for v in range(0, 5001) if ok(sheet_cells(table, {ref: v})[out]))
                assert q.answer == str(want) and want != shown[ref], (s, q.answer, want)
        assert asked == {"result", "middle", "goal"}, (s, asked)
    assert len(seen) == 4 and min(seen.values()) >= 40, seen


def test_spreadsheet_formula_whatif_shows_every_cell():
    m = fam("spreadsheet_formula")
    for s in range(1, 80):
        p = m.sample(random.Random(s))
        if p.get("sub") != "whatif":
            continue
        shown = texts(m, p)
        for row in p["table"]:
            for v in row:
                if v != "":
                    assert str(v) in shown, (s, v)


# --- database_query: the Lower Secondary query grid ------------------------------------------------------

def query(records, where, order):
    field, op, value = where
    test = {">": lambda a: a > value, "<": lambda a: a < value, "=": lambda a: a == value}[op]
    rows = [r for r in records if test(r[field])]
    return sorted(rows, key=lambda r: r[order[0]], reverse=order[1] == "DESC")


def test_database_query_grid():
    m = fam("database_query")
    n = 0
    for s in SEEDS:
        p, qs = run(m, s)
        if p.get("sub") != "grid":
            assert p["band"] in ("UP", "AL"), s
            continue
        n += 1
        assert p["band"] == "LS", s
        q = p["query"]
        rows = query(p["records"], q["where"], q["order"])
        assert 2 <= len(rows) and len({r[q["order"][0]] for r in rows}) == len(rows), s
        first = q["select"][0]
        asked = set()
        for x in qs:
            if "How many records will the results show?" in x.stem:
                asked.add("count")
                assert x.answer == str(len(rows)), s
            if "at the top of the results" in x.stem:
                asked.add("top")
                assert x.answer == str(rows[0][first]), s
            if "at the bottom of the results" in x.stem:
                asked.add("bottom")
                assert x.answer == str(rows[-1][first]), s
        assert asked == {"count", "top", "bottom"}, s
    assert n >= 200, n


def test_database_query_grid_prints_its_criterion_and_sort():
    m = fam("database_query")
    for s in range(1, 80):
        p = m.sample(random.Random(s))
        if p.get("sub") != "grid":
            continue
        shown = texts(m, p)
        field, op, value = p["query"]["where"]
        crit = f'"{value}"' if isinstance(value, str) else f"{op}{value}"
        assert crit in shown and field in shown and p["query"]["order"][0] in shown, s
        assert ("Ascending" if p["query"]["order"][1] == "ASC" else "Descending") in shown, s
        for rec in p["records"]:
            for v in rec.values():
                assert str(v) in shown, (s, v)


# --- spreadsheet_chart ----------------------------------------------------------------------------------

PART_GID = {"chart title": "part:chart title", "legend": None, "vertical axis title": "part:vertical axis title",
            "horizontal axis title": "part:horizontal axis title", "data label": None}


def test_spreadsheet_chart():
    m = fam("spreadsheet_chart")
    seen = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        seen[(p["sub"], p.get("kind", p.get("mode")))] += 1
        if p["sub"] == "parts":
            letters = p["letters"]
            assert len(set(letters.values())) == len(letters), s
            series, cats = p["series"], p["cats"]
            si, ci = p["cover"]
            ref = "BC"[si] + str(ci + 2)
            for q in qs:
                got = re.search(r"Which letter points to the (.+)\?$", q.stem)
                if got:
                    assert picked(q) == letters[got.group(1)] and sorted(q.options) == sorted(letters.values()), s
                if f"cell {ref} is covered" in q.stem:
                    assert q.answer == str(series[si][ci]), s
                got = re.search(r"which .+ has the largest value for (.+)\?$", q.stem)
                if got:
                    k = p["names"].index(got.group(1))
                    vals = series[k]
                    top = sorted(vals, reverse=True)
                    assert q.answer == cats[vals.index(top[0])] and top[0] > top[1], s
            if p["kind"] != "pie":
                step = {"rain": 20, "clubs": 5, "fruit": 10, "visitors": 50, "travel": 5}[p["context"]]
                assert all(v % step == 0 and v > 0 for row in series for v in row), s  # every value on a gridline
        elif p["sub"] == "which":
            vals = p["values"]
            right = [i for i, ch in enumerate(p["charts"]) if ch == vals]
            assert len(right) == 1, s
            one_off = [i for i, ch in enumerate(p["charts"]) if sum(a != b for a, b in zip(ch, vals)) == 1]
            assert len(one_off) == 1, s
            wrong = next(j for j, (a, b) in enumerate(zip(p["charts"][one_off[0]], vals)) if a != b)
            for q in qs:
                if "correctly" in q.stem:
                    assert picked(q) == "ABCD"[right[0]], s
                got = re.search(r"Chart ([A-D]) .+ has one bar drawn at the wrong height", q.stem)
                if got:
                    assert got.group(1) == "ABCD"[one_off[0]] and q.answer == p["cats"][wrong], s
        else:
            rows = p["rows"]
            if p["mode"] == "sort":
                col = {"Name": 0, "Mark": 2}[p["by"]]
                after = sorted(rows, key=lambda r: r[col], reverse=p["way"] == "down")
                for q in qs:
                    if "cell A2 after the sort" in q.stem:
                        assert q.answer == after[0][0] and after[0][0] != rows[0][0], s
                    got = re.search(r"in which row of the sheet will (\w+) be\?", q.stem)
                    if got:
                        row = [r[0] for r in after].index(got.group(1)) + 2
                        assert q.answer == str(row), s
                        assert [r[0] for r in rows].index(got.group(1)) + 2 != row, s  # the student moves
            else:
                field, op, v = p["rule"]
                col = {"Class": 1, "Mark": 2}[field]
                keep = [r for r in rows if {"=": r[col] == v, ">": r[col] > v, "<": r[col] < v}[op]]
                hidden = {r[0] for r in rows} - {r[0] for r in keep}
                for q in qs:
                    if "rows of student data will still show" in q.stem:
                        assert q.answer == str(len(keep)), s
                    if "will be hidden" in q.stem:
                        assert picked(q) in hidden and all(o not in hidden for o in q.options if o != picked(q)), s
    assert min(seen.values()) >= 40 and len(seen) == 7, seen


def _gap(pt, box) -> float:
    """How far a point is from a box, in pixels (0 inside it)."""
    dx = max(box.x0 - pt[0], 0, pt[0] - box.x1)
    dy = max(box.y0 - pt[1], 0, pt[1] - box.y1)
    return math.hypot(dx, dy)


def test_spreadsheet_chart_letter_sits_by_its_part():
    """The part nearest each letter, as drawn, is the part the questions say the letter points to."""
    from matplotlib.transforms import Bbox
    m = fam("spreadsheet_chart")
    for s in DRAWN:
        p = m.sample(random.Random(s))
        if p["sub"] != "parts":
            continue
        fig = m.draw(p)
        boxes = drawn_texts(fig)
        plt.close(fig)
        entries = p["cats"] if p["kind"] == "pie" else p["names"]
        parts = {}
        legend = [b for t, b in boxes if t.get_text() in entries and t.get_fontsize() == 9.5 and not t.get_gid()]
        parts["legend"] = Bbox.union(legend)
        for t, b in boxes:
            gid = t.get_gid() or ""
            if gid.startswith("part:"):
                parts[gid[5:]] = b
            if gid == f"label:{p.get('pointed')}":
                parts["data label"] = b
        assert set(parts) == set(p["letters"]), (s, sorted(parts))
        letters = {t.get_text(): ((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2) for t, b in boxes
                   if t.get_text() in "PQRS" and len(t.get_text()) == 1 and t.get_fontweight() == "bold"}
        for part, letter in p["letters"].items():
            near = min(parts, key=lambda k: _gap(letters[letter], parts[k]))
            assert near == part, (s, letter, part, near)


def test_spreadsheet_chart_shows_its_table():
    m = fam("spreadsheet_chart")
    for s in range(1, 80):
        p = m.sample(random.Random(s))
        shown = texts(m, p)
        if p["sub"] == "parts":
            si, ci = p["cover"]
            assert "?" in shown, s
            for k, row in enumerate(p["series"]):
                for i, v in enumerate(row):
                    if (k, i) != (si, ci):
                        assert str(v) in shown, (s, v)
            if p["kind"] == "pie":
                assert shown.count(str(p["series"][0][ci])) >= 1, s  # the covered value is on its data label
        elif p["sub"] == "which":
            for v in p["values"]:
                assert str(v) in shown, s
        else:
            for r in p["rows"]:
                assert r[0] in shown and str(r[2]) in shown, s


# --- data_processing_cycle --------------------------------------------------------------------------------

def stage_of(text: str) -> str:
    """This file's own reading of a happening: what a system takes in, gives out, keeps, or works out."""
    t = text.lower()
    if re.search(r"scanned|typed in|types the|taps|read by", t):
        return "input"
    if re.search(r"printed|shown on the screen|is sent|are sent", t):
        return "output"
    if re.search(r"saved|kept|changed to", t):
        return "storage"
    assert re.search(r"counts|works out|worked out|calculated|sorted|checks|added up", t), text
    return "processing"


def step_of(text: str) -> str:
    """Data is bare figures; knowledge is information used to decide ("so ..."); information is the rest."""
    if re.fullmatch(r"[\d.:\s]+", text):
        return "Data"
    if re.search(r"\bso\b", text):
        return "Knowledge"
    return "Information"


def test_data_processing_cycle():
    m = fam("data_processing_cycle")
    seen = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        seen[p["sub"]] += 1
        items = placed(m, p)
        if p["sub"] == "ipos":
            letters = {t: pos for t, pos, fs, fw, gid in items if len(t) == 1 and t in "ABCD" and fs == 12}
            assert len(letters) == 4, s
            xs = sorted(letters, key=lambda k: letters[k][0])
            low = min(letters, key=lambda k: letters[k][1])
            where = {"input": xs[0], "output": xs[-1], "storage": low}
            where["processing"] = next(k for k in letters if k not in where.values())
            boxes = [(t, pos) for t, pos, fs, fw, gid in items if fs == 10.5]
            for t, pos in boxes:  # each drawn happening stands in its own stage's box
                near = min(letters, key=lambda k: (letters[k][0] + 1.5 - pos[0]) ** 2 + (letters[k][1] - 0.7 - pos[1]) ** 2)
                assert where[stage_of(t.replace("\n", " "))] == near, (s, t)
            blank_pos = next(pos for t, pos, fs, fw, gid in items if t == "?")
            blank = min(letters, key=lambda k: (letters[k][0] + 1.5 - blank_pos[0]) ** 2 + (letters[k][1] - 0.7 - blank_pos[1]) ** 2)
            stage = next(st for st, k in where.items() if k == blank)
            for q in qs:
                got = re.search(r"Which letter shows the (input|processing|output|storage) stage\?", q.stem)
                if got:
                    assert picked(q) == where[got.group(1)] and got.group(1) != stage, s
                if "is blank" in q.stem:
                    assert f"Box {blank} " in q.stem, s
                    assert stage_of(picked(q)) == stage, (s, picked(q))
                    assert all(stage_of(o) != stage for o in q.options if o != picked(q)), (s, q.options)
                    assert all(o not in [t.replace("\n", " ") for t, _ in boxes] for o in q.options), s
        else:
            rows = [(t, pos) for t, pos, fs, fw, gid in items if fs == 10.5 and abs(pos[0] - 0.85) < 0.01]
            marks = {t: pos for t, pos, fs, fw, gid in items if t in ("P", "Q", "R") and fs == 11.5}
            assert len(rows) == 3 and len(marks) == 3, s
            step = {}
            for letter, lp in marks.items():
                text = min(rows, key=lambda r: abs(r[1][1] - lp[1]))[0]
                step[letter] = step_of(text)
            assert sorted(step.values()) == ["Data", "Information", "Knowledge"], (s, step)
            for q in qs:
                got = re.search(r"which item is (data|information|knowledge)\?", q.stem)
                if got:
                    assert step[picked(q)] == got.group(1).capitalize(), s
                got = re.search(r"does item ([PQR]) belong", q.stem)
                if got:
                    assert picked(q) == step[got.group(1)], s
            for word in ("Data", "Information", "Knowledge", "What the words mean"):
                assert any(t == word for t, *_ in items), (s, word)
    assert min(seen.values()) >= 300, seen


# --- memory_hierarchy -------------------------------------------------------------------------------------

UNIT_NS = {"ns": 1, "µs": 1000, "ms": 1000000}
UNIT_BYTES = {"bytes": 1, "KB": 1000, "MB": 10 ** 6, "GB": 10 ** 9, "TB": 10 ** 12}
PYRAMID_ORDER = ["registers", "cache memory", "RAM (main memory)", "solid-state drive (SSD)", "hard disk drive (HDD)"]


def test_memory_hierarchy():
    m = fam("memory_hierarchy")
    seen = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        seen[(p["band"], p["sub"])] += 1
        if p["sub"] == "pyramid":
            items = placed(m, p)
            letters = sorted([(t, pos) for t, pos, fs, fw, gid in items if len(t) == 1 and t in "ABCDE" and fs == 12],
                             key=lambda lp: -lp[1][1])
            facts = sorted([(t, pos) for t, pos, fs, fw, gid in items if t.startswith("access time")],
                           key=lambda tp: -tp[1][1])
            assert len(letters) == len(facts) == 5, s
            name_at = {PYRAMID_ORDER[i]: letters[i][0] for i in range(5)}  # the top layer is the registers
            time_of, size_of = {}, {}
            for (letter, _), (fact, _) in zip(letters, facts):
                got = re.fullmatch(r"access time (\d+) (ns|µs|ms)\s+\|\s+capacity (\d+) (bytes|KB|MB|GB|TB)", fact)
                time_of[letter] = int(got.group(1)) * UNIT_NS[got.group(2)]
                size_of[letter] = int(got.group(3)) * UNIT_BYTES[got.group(4)]
            for q in qs:
                got = re.search(r"Which letter shows (cache memory|RAM \(main memory\)|solid-state drive \(SSD\))\?", q.stem)
                if got:
                    assert picked(q) == name_at[got.group(1)], s
                if "the fastest level" in q.stem:
                    assert picked(q) == min(q.options, key=time_of.get) == min(time_of, key=time_of.get), s
                if "largest capacity" in q.stem:
                    assert picked(q) == max(size_of, key=size_of.get), s
                got = re.search(r"how many times faster is level ([A-E]) than level ([A-E])\?", q.stem)
                if got:
                    a, b = time_of[got.group(1)], time_of[got.group(2)]
                    assert b % a == 0 and q.answer == str(b // a) and b // a > 1, s
        elif p["sub"] == "devices":
            rows = p["rows"]
            shown = texts(m, p)
            for nm, kind, cap, speed, price in rows:
                assert nm in shown and f"{cap} GB" in shown and f"{speed} MB/s" in shown, s
                assert f"{price:,}".replace(",", " ") + " Frw" in shown and price % cap == 0, s
            for q in qs:
                if "cheapest per gigabyte" in q.stem:
                    per = sorted((r[4] / r[2], r[0]) for r in rows)
                    assert picked(q) == per[0][1] and per[1][0] - per[0][0] >= 10, s
                if "read data the fastest" in q.stem:
                    fast = sorted((r[3], r[0]) for r in rows)
                    assert picked(q) == fast[-1][1] and fast[-1][0] > fast[-2][0], s
                got = re.search(r"Each photo is (\d+) MB\. How many photos can be stored on the (.+) in the table\?", q.stem)
                if got:
                    cap = next(r[2] for r in rows if r[0] == got.group(2))
                    assert cap * 1000 % int(got.group(1)) == 0 and q.answer == str(cap * 1000 // int(got.group(1))), s
                got = re.search(r"read a (\d+) MB video file from the (.+) in the table\?", q.stem)
                if got:
                    speed = next(r[3] for r in rows if r[0] == got.group(2))
                    assert int(got.group(1)) % speed == 0 and q.answer == str(int(got.group(1)) // speed), s
        elif p["sub"] == "laptop":
            room = p["max"] - p["slot1"]
            for q in qs:
                got = re.search(r"puts the (\d+) GB module", q.stem)
                if got:
                    assert int(got.group(1)) <= room and q.answer == str(p["slot1"] + int(got.group(1))), s
                if "largest RAM module" in q.stem:
                    assert picked(q) == f"{max(x for x in p['modules'] if x <= room)} GB", s
                    assert any(x > room for x in p["modules"]), s
                if "free space" in q.stem:
                    assert q.answer == str(p["disk"] - p["used"]), s
        else:
            caps = {k: c for letter, k, c in p["devices"]}
            let = {k: letter for letter, k, c in p["devices"]}
            for q in qs:
                if "hold the most" in q.stem:
                    assert picked(q) == let[max(caps, key=lambda k: float(caps[k]))], s
                got = re.search(r"A film is (\d+) GB\. How many films can the (.+) hold\?", q.stem)
                if got:
                    c, f = caps[got.group(2)], int(got.group(1))
                    assert c % f == 0 and q.answer == str(c // f), s
                got = re.search(r"How many more gigabytes can the (.+) hold than the (.+)\?", q.stem)
                if got:
                    d = caps[got.group(1)] - caps[got.group(2)]
                    assert d > 0 and q.answer == str(d), s
    assert min(seen.values()) >= 80 and len(seen) == 6, seen


# --- computer_generations ---------------------------------------------------------------------------------

def test_computer_generations():
    m = fam("computer_generations")
    seen = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        seen[(p["band"], p["sub"])] += 1
        items = placed(m, p)
        if p["sub"] == "generations":
            bands = sorted([(t, pos) for t, pos, fs, fw, gid in items if re.fullmatch(r"\d{4} to (\d{4}|the present)", t)
                            or t == "the present and beyond"], key=lambda tp: tp[1][0])
            letters = sorted([(t, pos) for t, pos, fs, fw, gid in items if len(t) == 1 and fs == 12],
                             key=lambda lp: lp[1][0])
            names = sorted([(t, pos) for t, pos, fs, fw, gid in items if t.endswith("generation")], key=lambda tp: tp[1][0])
            assert len(bands) == len(letters) == len(names) == 5, s
            for q in qs:
                got = re.search(r"A computer was built in (\d{4})\.", q.stem)
                if got:
                    y = int(got.group(1))
                    hits = []
                    for i, (t, _) in enumerate(bands):
                        g = re.fullmatch(r"(\d{4}) to (\d{4}|the present)", t)
                        if g and int(g.group(1)) < y < (int(g.group(2)) if g.group(2).isdigit() else 2100):
                            hits.append(i)
                    assert len(hits) == 1 and picked(q) == letters[hits[0]][0], (s, y)
                got = re.search(r"Which generation does picture ([A-E])", q.stem)
                if got:
                    i = [t for t, _ in letters].index(got.group(1))
                    assert picked(q) == names[i][0], s
                got = re.search(r"after the (\w+) generation began did the (\w+) generation begin", q.stem)
                if got:
                    start = {t.split()[0].lower(): int(b[0][:4]) for (t, _), b in zip(names, bands) if b[0][:4].isdigit()}
                    assert q.answer == str(start[got.group(2)] - start[got.group(1)]) and int(q.answer) > 0, s
        elif p["sub"] == "classes":
            rows = sorted([(t, pos) for t, pos, fs, fw, gid in items if len(t) == 1 and fw == "bold"], key=lambda r: -r[1][1])
            cells = [(t, pos) for t, pos, fs, fw, gid in items if fw != "bold"]
            table = {}
            for letter, lp in rows:
                row = sorted([c for c in cells if abs(c[1][1] - lp[1]) < 0.01], key=lambda c: c[1][0])
                table[letter] = [c[0] for c in row]  # kind, size, users, example
            users = {k: (0 if v[2] == "none" else int(v[2].replace(" ", ""))) for k, v in table.items()}
            for q in qs:
                if "serves the most users" in q.stem:
                    assert picked(q) == max(users, key=users.get), s
                got = re.search(r"how many more users can computer ([A-E]) serve at one time than computer ([A-E])\?", q.stem)
                if got:
                    assert q.answer == str(users[got.group(1)] - users[got.group(2)]), s
                if "built into a machine" in q.stem:
                    assert "machine" in table[picked(q)][1] and table[picked(q)][0] == "Embedded computer", s
        else:
            years = sorted([(int(t), pos) for t, pos, fs, fw, gid in items if re.fullmatch(r"1\d{3}", t)],
                           key=lambda yp: yp[1][0])
            letters = sorted([(t, pos) for t, pos, fs, fw, gid in items if len(t) == 1 and fs == 12], key=lambda lp: lp[1][0])
            names = sorted([(t, pos) for t, pos, fs, fw, gid in items if fs == 10.5 and not t.startswith("Early")],
                           key=lambda tp: tp[1][0])
            assert len(years) == len(letters) == len(names), s
            year_of = {letters[i][0]: years[i][0] for i in range(len(years))}
            year_by_name = {names[i][0]: years[i][0] for i in range(len(years))}
            for q in qs:
                if "oldest calculating device" in q.stem:
                    assert picked(q) == min(year_of, key=year_of.get), s
                got = re.search(r"the device made in (\d{4})\?", q.stem)
                if got:
                    assert year_of[picked(q)] == int(got.group(1)), s
                got = re.search(r"how many years after (?:the )?(.+?) (?:was|were) (?:the )?(.+) made\?", q.stem)
                if got:
                    d = year_by_name[got.group(2)] - year_by_name[got.group(1)]
                    assert d > 0 and q.answer == str(d), (s, q.stem)
    assert min(seen.values()) >= 60 and len(seen) == 9, seen


# --- keyboard_mouse_p -------------------------------------------------------------------------------------

JOB_KEY = [("start a new line", "Enter"), ("just to the left of the cursor", "Backspace"),
           ("just to the right of the cursor", "Delete"), ("just one capital letter", "Shift"),
           ("without holding a key down", "Caps Lock"), ("space between two words", "space"),
           ("up one line", "↑"), ("one place to the left", "←")]
MOUSE_PART = [("shortcut menu", "right button"), ("scroll", "wheel"), ("choose", "left button")]


def test_keyboard_mouse_p():
    m = fam("keyboard_mouse_p")
    for s in SEEDS:
        p, qs = run(m, s)
        fig = m.draw(p)
        ax = fig.axes[0]
        labels = [(t.get_text(), t.get_position()) for t in ax.texts if t.get_fontsize() == 10]
        circles = [(t.get_text(), t.get_position()) for t in ax.texts if t.get_fontsize() == 13]
        ends = {}
        for ln in ax.lines:
            gid = ln.get_gid() or ""
            if not gid.startswith("leader:"):
                continue
            (x0, y0), (x1, y1) = ln.get_xydata()[0], ln.get_xydata()[-1]
            letter = min(circles, key=lambda c: math.dist(c[1], (x0, y0)))[0]
            ends[letter] = (x1, y1)
        plt.close(fig)
        assert len(ends) == 7, s

        def key_at(pt):
            """The key a leader ends on: the nearest key label; the space bar has none, so its end is lowest-middle."""
            near = min(labels, key=lambda lb: math.dist(lb[1], pt))
            if math.dist(near[1], pt) > 0.6:
                return "space"
            return near[0]

        mouse_x = min(x for x, _ in ends.values() if x > 10)
        for q in qs:
            for phrase, key in JOB_KEY:
                if phrase in q.stem and "key" in q.stem:
                    assert key_at(ends[picked(q)]) == key, (s, q.stem)
                    assert all(key_at(ends[o]) != key for o in q.options if o != picked(q)), s
            for phrase, part in MOUSE_PART:
                if phrase in q.stem and "mouse" in q.stem:
                    x, y = ends[picked(q)]
                    cx = 12.1
                    want = {"left button": x < cx - 0.1, "right button": x > cx + 0.1,
                            "wheel": abs(x - cx) <= 0.1 and y > 1.75 + 0.5}[part]
                    assert want, (s, part, (x, y))
        assert mouse_x > 10, s


def test_keyboard_mouse_p_prints_big_and_every_job_names_one_key():
    m = fam("keyboard_mouse_p")
    for s in range(1, 13):
        fig = m.draw(m.sample(random.Random(s)))
        sizes = [t.get_fontsize() for ax in fig.axes for t in ax.texts if t.get_text().strip()]
        plt.close(fig)
        assert min(sizes) >= 10, (s, min(sizes))
    phrases = [ph for ph, _ in JOB_KEY]
    for job in m.JOBS.values():
        assert sum(ph in job for ph in phrases) == 1, job


# --- os_boot ---------------------------------------------------------------------------------------------

P_ORDER = ["power button", "POST", "BIOS finds", "loads into memory", "screen appears"]
UP_ORDER = ["Power on", "POST", "loads the boot loader", "kernel into RAM", "device drivers", "log-in screen"]
LAYER_WORDS = [("person", "user"), ("task for the user", "application software"), ("kernel", "operating system"),
               ("physical parts", "hardware")]
BELONG = {"a spreadsheet program": "application software", "a game": "application software",
          "a photo editor": "application software", "Linux": "operating system", "Windows": "operating system",
          "Android": "operating system", "the RAM": "hardware", "a printer": "hardware", "the hard disk": "hardware"}


def test_os_boot():
    m = fam("os_boot")
    seen = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        seen[(p["band"], p["sub"])] += 1
        items = placed(m, p)
        if p["sub"] == "boot":
            order = P_ORDER if p["band"] == "P" else UP_ORDER
            cards = {t: pos for t, pos, fs, fw, gid in items if len(t) == 1 and fs == 12}
            words = [(t.replace("\n", " "), pos) for t, pos, fs, fw, gid in items if fs == 10.5]
            rank = {}
            for letter, lp in cards.items():
                text = min(words, key=lambda w: math.dist((w[1][0] - 0.33, w[1][1] + 0.3), lp))[0]
                hits = [i for i, kw in enumerate(order) if kw in text]
                assert len(hits) == 1, (s, text)
                rank[letter] = hits[0]
            assert sorted(rank.values()) == list(range(len(order))), s
            assert all(rank[letter] != i for i, letter in enumerate(sorted(rank))), s  # every card out of its place
            by_rank = {r: letter for letter, r in rank.items()}
            for q in qs:
                got = re.search(r"straight after card ([A-F])\?", q.stem)
                if got:
                    assert picked(q) == by_rank[rank[got.group(1)] + 1], s
                got = re.search(r"which card is the (\w+) step\?", q.stem)
                if got:
                    k = ["first", "second", "third", "fourth", "fifth", "sixth"].index(got.group(1))
                    assert picked(q) == by_rank[k], s
        elif p["sub"] == "layers":
            marks = {t: pos for t, pos, fs, fw, gid in items if len(t) == 1 and fs == 13}
            says = [(t, pos) for t, pos, fs, fw, gid in items if fs == 11]
            layer = {}
            for letter, lp in marks.items():
                text = min(says, key=lambda w: abs(w[1][1] - lp[1]))[0]
                layer[letter] = next(name for word, name in LAYER_WORDS if word in text)
            assert sorted(layer.values()) == sorted(n for _, n in LAYER_WORDS), s
            for q in qs:
                got = re.search(r"Which letter shows the (application software|operating system|hardware) layer\?", q.stem)
                if got:
                    assert layer[picked(q)] == got.group(1), s
                got = re.search(r"in which lettered layer does (.+) belong\?", q.stem)
                if got:
                    assert layer[picked(q)] == BELONG[got.group(1)], s
        else:
            heads = {t: pos for t, pos, fs, fw, gid in items if t in ("Screen 1", "Screen 2")}
            start = next(pos for t, pos, fs, fw, gid in items if t == "Start")
            gui = min(heads, key=lambda h: abs(heads[h][0] - start[0]))
            icons = [t for t, pos, fs, fw, gid in items if fs == 10 and t in
                     ("Documents", "Recycle Bin", "Browser", "Calculator", "Paint", "Music", "Photos", "Games")]
            prompts = [t for t, pos, fs, fw, gid in items if re.search(r"(> |\$ )\S", t) and not t.endswith("_")]
            for q in qs:
                if "graphical user interface (GUI)?" in q.stem:
                    assert picked(q) == gui, s
                if "How many icons" in q.stem:
                    assert q.answer == str(len(icons)), s
                if "How many commands" in q.stem:
                    assert q.answer == str(len(prompts)) and len(prompts) >= 2, s
    assert min(seen.values()) >= 60 and len(seen) == 6, seen


# --- shared checks ---------------------------------------------------------------------------------------

@pytest.mark.parametrize("fid", NEW + EDITED)
def test_an_mcq_cannot_be_picked_from_its_options_alone(fid):
    m = fam(fid)
    seen, hits = defaultdict(int), defaultdict(int)
    for s in range(1, 301):
        _, qs = run(m, s)
        for q in qs:
            if q.kind == "mcq":
                key = re.sub(r"\d+", "#", q.stem.rsplit(". ", 1)[-1])
                seen[key] += 1
                hits[key] += _central(q.options) == int(q.answer)
    bad = {k: (hits[k], seen[k]) for k in seen if seen[k] >= 10 and hits[k] / seen[k] > 0.35}
    assert not bad, (fid, bad)


@pytest.mark.parametrize("fid", NEW)
def test_no_line_runs_through_a_label(fid):
    """Leaders, arrows and gridlines sit beside the text they serve (P3z rule)."""
    m = fam(fid)
    for s in DRAWN:
        fig = m.draw(m.sample(random.Random(s)))
        boxes = drawn_texts(fig)
        for ln in fig.axes[0].lines:
            for t, box in boxes:
                assert not crosses(ln, box), (fid, s, ln.get_gid(), t.get_text())
        plt.close(fig)


@pytest.mark.parametrize("fid", NEW + EDITED)
def test_no_two_texts_overlap_in_any_sub_type(fid):
    m = fam(fid)
    for s in range(1, 61):
        fig = m.draw(m.sample(random.Random(s)))
        boxes = drawn_texts(fig)
        plt.close(fig)
        for i, (t, a) in enumerate(boxes):
            for u, b in boxes[i + 1:]:
                assert not (min(a.x1, b.x1) - max(a.x0, b.x0) > 1 and min(a.y1, b.y1) - max(a.y0, b.y0) > 1), \
                    (fid, s, t.get_text(), u.get_text())


@pytest.mark.parametrize("fid", [f for f in NEW if "P" in FAMILIES[f].BANDS])
def test_a_primary_figure_prints_big(fid):
    """Primary figures print at 10 pt at least (P3z rule)."""
    m = fam(fid)
    n = 0
    for s in range(1, 120):
        p = m.sample(random.Random(s))
        if p["band"] != "P" or n >= 15:
            continue
        n += 1
        fig = m.draw(p)
        sizes = [t.get_fontsize() for ax in fig.axes for t in ax.texts if t.get_text().strip()]
        plt.close(fig)
        assert min(sizes) >= 10, (fid, s, min(sizes))
    assert n >= 10, (fid, n)


@pytest.mark.parametrize("fid", NEW + EDITED)
def test_a_figure_belongs_to_the_person_in_the_first_question(fid):
    m = fam(fid)
    for seed in range(1, 120):
        rng = random.Random(seed)
        qs = m.questions(m.sample(rng), rng)
        first = next((n for n in NAMES if qs[0].stem.startswith(n)), None)
        assert first, qs[0].stem
        for q in qs:
            for owner in re.findall(r"\b(" + "|".join(NAMES) + r")'s\b", q.stem):
                assert owner == first, (fid, seed, q.stem)


@pytest.mark.parametrize("fid", NEW + EDITED)
def test_declares_its_concepts_bands_and_stages(fid):
    m = fam(fid)
    assert m.SUBJECT == "computing" and m.CONCEPTS and all(c.startswith("computing.") for c in m.CONCEPTS)
    assert m.NEEDS and re.compile(m.NEEDS)
    bands = set()
    for s in range(1, 200):
        p = m.sample(random.Random(s))
        bands.add(p["band"])
        if hasattr(m, "concepts_for"):
            assert set(m.concepts_for(p)) <= set(m.CONCEPTS), (fid, s)
        if p["band"] == "P":
            assert m.stages(p), (fid, s)
    assert bands == set(m.BANDS), (fid, bands)


def test_links_turn_away_the_misfits_and_keep_the_fits():
    cases = {  # fid: (names AVOID turns away, names NEEDS matches and AVOID lets through)
        "spreadsheet_formula": (["Charts", "Exporting Excel files to PDF or other file types", "Unit 13: Functions in C++ Programming",
                                 "Chapter 3: The functions of operating systems"],
                                ["Spreadsheets", "Chapter 8: Spreadsheets", "Modelling", "Google sheets",
                                 "Chapter 20: Create a data model "]),
        "spreadsheet_chart": (["Algorithms and flowcharts", "Presentation", "Databases", "Data"],
                              ["Charts and Objects in Spreadsheets", "Worksheet Data Presentation", "Chart types",
                               "Graphs and charts", "Data organization", "Spreadsheets"]),
        "data_processing_cycle": (["Chapter 1: Information representation", "Word processing basics I", "ICT in society"],
                                  ["Data processing and information", "Chapter 1: Data, information, knowledge and processing",
                                   "Data and information", "Introduction to ICT", "Computer applications"]),
        "memory_hierarchy": (["Chapter 20: System software", "Memory Management", "Unit 7: Booting and operating systems",
                              "Chapter 18: Hardware and virtual machines"],
                             ["Unit 5: Memory and storage", "Chapter 3: Hardware", "Hardware and software",
                              "Chapter 1: Components of a computer system and modes of use",
                              "Unit 1: Fundamentals of Laptop and Portable Devices"]),
        "computer_generations": (["Computer parts and uses", "Software and hardware", "Unit 5: We can network"],
                                 ["Unit 2: Evolution of computers", "Unit 3: Classification of computers",
                                  "Unit 1: Know your computer"]),
        "keyboard_mouse_p": (["Digital citizenship", "Internet safety", "Unit 4: Be a designer"],
                             ["Keyboard and mouse skills"]),
        "os_boot": (["Keyboard and mouse skills", "Memory Management", "Process Management and Scheduling Algorithm"],
                    ["Unit 7: Booting and operating systems", "Unit 8: Operating system interfaces",
                     "Unit 6: Categorisation of software", "Unit 15: Introduction to Operating Systems",
                     "Unit 6: Operating systems", "Chapter 4: Types of software", "Chapter 8: System software"]),
    }
    for fid, (misfits, fits) in cases.items():
        m = fam(fid)
        for name in misfits:
            assert re.search(m.AVOID, name, re.I), (fid, name)
        for name in fits:
            assert re.search(m.NEEDS, name, re.I) and not re.search(m.AVOID, name, re.I), (fid, name)


# --- reach by name (read-only figure store) --------------------------------------------------------------

TARGETS = [
    ("spreadsheet_formula", "Spreadsheets"), ("spreadsheet_formula", "Chapter 20: Create a data model "),
    ("spreadsheet_formula", "Google sheets"), ("spreadsheet_formula", "Chapter 8: Spreadsheets"),
    ("spreadsheet_formula", "Modelling"),
    ("database_query", "Big Data modelling and analysis: Databases and spreadsheets"),
    ("spreadsheet_chart", "Charts and Objects in Spreadsheets"), ("spreadsheet_chart", "Charts and Advanced Objects"),
    ("spreadsheet_chart", "Worksheet Data Presentation"), ("spreadsheet_chart", "Charts"),
    ("spreadsheet_chart", "Chapter 16: Chart types "), ("spreadsheet_chart", "Graphs and charts"),
    ("spreadsheet_chart", "Data organization"),
    ("data_processing_cycle", "Data processing and information"),
    ("data_processing_cycle", "Chapter 1: Data, information, knowledge and processing"),
    ("data_processing_cycle", "Data and information"),
    ("data_processing_cycle", "Information and Communication Technology Foundation"),
    ("data_processing_cycle", "Introduction to ICT"), ("data_processing_cycle", "Computer applications"),
    ("memory_hierarchy", "Unit 5: Memory and storage"), ("memory_hierarchy", "Chapter 3: Hardware"),
    ("memory_hierarchy", "Chapter 1: Components of a computer system and modes of use"),
    ("memory_hierarchy", "Hardware and software"), ("memory_hierarchy", "Chapter 2: Hardware and software"),
    ("memory_hierarchy", "Unit 1: Fundamentals of Laptop and Portable Devices"),
    ("computer_generations", "Unit 2: Evolution of computers"), ("computer_generations", "Unit 3: Classification of computers"),
    ("computer_generations", "Unit 1: Know your computer"),
    ("keyboard_mouse_p", "Keyboard and mouse skills"),
    ("os_boot", "Unit 7: Booting and operating systems"), ("os_boot", "Unit 8: Operating system interfaces"),
    ("os_boot", "Unit 6: Categorisation of software"), ("os_boot", "Unit 15: Introduction to Operating Systems"),
    ("os_boot", "Unit 6: Operating systems"), ("os_boot", "Chapter 4: Types of software"),
    ("os_boot", "Chapter 8: System software"),
]


@pytest.fixture(scope="module")
def index():
    if not STORE.exists():
        pytest.skip("no figure store")
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
    from figgen import link
    db = sqlite3.connect(f"file:{STORE}?mode=ro", uri=True)
    db.row_factory = sqlite3.Row
    return link, link.topic_index(db)


@pytest.mark.parametrize("fid,topic", TARGETS)
def test_reaches_the_empty_topic_by_name(fid, topic, index):
    link, ix = index
    names = {t["key"]: t["name"].replace(chr(8), "").strip() for t in ix}  # some book titles carry a stray control mark
    reached = {names[k] for k in link.reach(ix, fam(fid), 200)}
    assert topic.strip() in reached, (fid, topic)
