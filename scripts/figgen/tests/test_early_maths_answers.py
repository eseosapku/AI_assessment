"""Answers of the early primary maths families (P3z, Task A), recomputed from each figure's params over 1,000 seeds.

Nothing here calls a family's own helpers to work out a key. A clock's time is read from where its two hands point
(the hour hand's angle, the minute hand's angle) and checked against the params; a position in the picture grid is
worked out from the grid's rows and columns, and "just to the left of" means the next cell along in the same row, as
the reader looks; a length is counted cube by cube or read off the metre gridlines; a shape's corners, sides and right
angles come from this file's own table; litres are read from the water's top against the jug's marks; a balance's
heavier side is the side that hangs lower; and the weekday of a date comes from Zeller's congruence, not from Python's
calendar module. Every value a question needs is checked as drawn, and every MCQ is checked against being picked from
its options alone.
"""
import math
import random
import re
import sqlite3
from collections import Counter, defaultdict
from pathlib import Path

import matplotlib.pyplot as plt
import pytest
from matplotlib.lines import Line2D
from matplotlib.text import Text

from figgen.core import NAMES
from figgen.families import FAMILIES

SEEDS = range(1, 1001)
DRAWN = 120  # the figure itself is built and read for the first seeds
EARLY = ["clock_early_p", "position_p", "compare_length_p", "shapes_p", "capacity_mass_p", "calendar_p"]
STORE = Path("C:/Users/Stephen/figure-library/figures.db")


def fam(fid):
    if fid not in FAMILIES:
        pytest.fail(f"{fid} is not registered")
    return FAMILIES[fid]


def run(m, seed):
    rng = random.Random(seed)
    p = m.sample(rng)
    return p, m.questions(p, rng)


def picked(q):
    return q.options[int(q.answer)]


def wrong(q):
    return [o for i, o in enumerate(q.options) if i != int(q.answer)]


def by(qs, pattern):
    found = [q for q in qs if re.search(pattern, q.stem)]
    return found[0] if found else None


def own_wordings(m) -> int:
    """How many of 30 figures carry a stem no other of the 30 has (the shared wording test, P2a)."""
    stems = []
    for seed in range(1, 31):
        rng = random.Random(seed)
        stems.append({q.stem for q in m.questions(m.sample(rng), rng)})
    return sum(1 for i, s in enumerate(stems) if s - set().union(*(t for j, t in enumerate(stems) if j != i)))


def drawn_texts(fig):
    """Every piece of text the renderer drew, with its box in pixels."""
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


def centres(fig) -> dict:
    """Each text with a gid, by gid: its centre in data coordinates."""
    out = {}
    for t, b in drawn_texts(fig):
        g = t.get_gid()
        if g:
            inv = t.axes.transData.inverted()
            (x0, y0), (x1, y1) = inv.transform([(b.x0, b.y0), (b.x1, b.y1)])
            out[g] = ((x0 + x1) / 2, (y0 + y1) / 2, t.get_text())
    return out


def by_gid(fig, gid):
    for ax in fig.axes:
        for a in list(ax.lines) + list(ax.patches):
            if a.get_gid() == gid:
                return a
    return None


def _central(options):
    toks = [Counter(re.findall(r"-?\d+|[a-zA-Z]+|\S", o)) for o in options]
    score = [sum(sum(((t - u) + (u - t)).values()) for u in toks) for t in toks]
    best = min(score)
    return score.index(best) if score.count(best) == 1 else None


# --- every family ----------------------------------------------------------------------------------------

@pytest.mark.parametrize("fid", EARLY)
def test_family_is_early_primary_worded_and_linked(fid):
    m = fam(fid)
    assert m.SUBJECT == "mathematics" and m.BANDS == ("P",)
    assert m.CONCEPTS and all(c.startswith("mathematics.") for c in m.CONCEPTS)
    assert m.NEEDS and m.AVOID
    assert own_wordings(m) >= 27, fid
    for seed in range(1, 300):
        p, qs = run(m, seed)
        assert p["band"] == "P"
        lo, hi = m.stages(p)
        assert lo == 1 and hi in (2, 3), (fid, seed, (lo, hi))  # Stage 1 to 2 topics only (3 where the skill runs on)
        first = next((n for n in NAMES if qs[0].stem.startswith(n)), None)
        assert first, (fid, seed, qs[0].stem)
        for q in qs:
            for owner in re.findall(r"\b(" + "|".join(NAMES) + r")'s\b", q.stem):
                assert owner == first, (fid, seed, q.stem)
            # Short sentences a six-year-old can follow when they are read aloud.
            for sentence in re.split(r"(?<=[.?!])\s+", q.stem):
                assert len(sentence.split()) <= 16, (fid, seed, sentence)
            assert not re.search(r"\bthat (?:price|time|jug|clock|shape|day)\b|the answer above|the same (?:clock|jug)",
                                 q.stem), (fid, seed, q.stem)
            if q.kind == "mcq":
                assert 3 <= len(q.options) <= 4, (fid, seed, q.options)
                assert len(set(q.options)) == len(q.options)
            else:
                assert q.answer in q.accepted


@pytest.mark.parametrize("fid", EARLY)
def test_an_early_maths_mcq_cannot_be_picked_from_its_options_alone(fid):
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


def _segments(art):
    """The straight pieces of a line or a patch's outline, in pixels."""
    if isinstance(art, Line2D):
        pts = art.get_transform().transform(art.get_xydata())
        return list(zip(pts, pts[1:]))
    out = []
    for poly in art.get_path().to_polygons(art.get_transform(), closed_only=False):  # curves flattened, in pixels
        out += list(zip(poly, poly[1:]))
    return out


def _passes(a, b, box, margin=1.5, steps=60) -> bool:
    return any(box.x0 + margin < a[0] + (b[0] - a[0]) * k / steps < box.x1 - margin and
               box.y0 + margin < a[1] + (b[1] - a[1]) * k / steps < box.y1 - margin for k in range(steps + 1))


@pytest.mark.parametrize("fid", EARLY)
def test_text_is_big_and_no_line_runs_through_a_label(fid):
    """Primary figures: every piece of text at 10 pt or more, and no line or outline drawn through a label (the shared
    layout tests check text against text only)."""
    m = fam(fid)
    for seed in range(1, 31):
        fig = m.draw(m.sample(random.Random(seed)))
        texts = drawn_texts(fig)
        for t, box in texts:
            assert t.get_fontsize() >= 10, (fid, seed, t.get_text(), t.get_fontsize())
        for ax in fig.axes:
            arts = [a for a in list(ax.lines) + list(ax.patches) if a.get_visible()]
            for art in arts:
                if (art.get_gid() or "").startswith("behind"):
                    continue  # a fill the text sits on (a cell's shading), never a line through it
                for a, b in _segments(art):
                    for t, box in texts:
                        assert not _passes(a, b, box), (fid, seed, art.get_gid() or type(art).__name__, t.get_text())
        plt.close(fig)


@pytest.mark.parametrize("fid", EARLY)
def test_concepts_are_known_and_reach_the_topics_they_should(fid):
    if not STORE.exists():
        pytest.skip("no figure library here")
    from figgen.link import reach, topic_index
    db = sqlite3.connect(f"file:{STORE}?mode=ro", uri=True)
    db.row_factory = sqlite3.Row
    m = fam(fid)
    known = {r[0] for r in db.execute("SELECT id FROM concepts")}
    assert set(m.CONCEPTS) <= known, sorted(set(m.CONCEPTS) - known)
    index = topic_index(db)
    names = {t["key"]: t["name"] for t in index}
    got = {names[k] for k in reach(index, m, samples=200)}
    want = {
        "clock_early_p": {"Time", "Time (2)", "Telling the time", "Hour, Months of the Year and Days of Each Month"},
        "position_p": {"Position", "Position, direction and patterns", "Symmetry, position and movement",
                       "Directions, location of objects and lines", "Grid"},
        "compare_length_p": {"Measures", "Measuring lengths less than or equal to 10 m", "Length Measurement",
                             "Measurement"},
        "shapes_p": {"Geometry", "Geometry (2)", "Right angle, square and rectangle", "Square, Rectangle and Triangle",
                     "Geometry and shapes"},
        "capacity_mass_p": {"Measures (2)", "Litre, the Standard Unit of Capacity Measurements",
                            "Kilogram, the Standard Unit of Mass"},
        "calendar_p": {"Time", "Time (2)", "Main parts of the day and days of the week",
                       "Hour, Months of the Year and Days of Each Month"},
    }[fid]
    assert want <= got, sorted(want - got)
    never = {
        "clock_early_p": {"Main parts of the day and days of the week", "Position", "Measures", "Geometry", "Grid"},
        "position_p": {"Right angle, square and rectangle", "Square, Rectangle and Triangle", "Geometry", "Geometry (2)",
                       "Main parts of the day and days of the week", "Time", "Measures"},
        "compare_length_p": {"Litre, the Standard Unit of Capacity Measurements", "Kilogram, the Standard Unit of Mass",
                             "Measures (2)", "Time", "Geometry", "Types of Lines and Angles"},
        "shapes_p": {"Position", "Grid", "Measures", "Time", "Symmetry, position and movement", "Fractions of shapes",
                     "Algebra, Geometry and Measure",
                     "7 Fractions of shapes", "17 Pattern and symmetry", "Directions, location of objects and lines"},
        "capacity_mass_p": {"Measures", "Measuring lengths less than or equal to 10 m", "Length Measurement", "Time"},
        "calendar_p": {"Telling the time", "Position", "Measures", "Geometry", "Grid"},
    }[fid]
    assert not got & never, sorted(got & never)


# --- clock_early_p -----------------------------------------------------------------------------------------

def tlabel(h, m) -> str:
    return f"{h} o'clock" if m == 0 else f"half past {h}"


def parse_time(s):
    got = re.fullmatch(r"(\d+) o'clock", s)
    if got:
        return int(got.group(1)), 0
    got = re.fullmatch(r"half past (\d+)", s)
    assert got, s
    return int(got.group(1)), 30


def wrap(h) -> int:
    return (h - 1) % 12 + 1


def hand_angle(line) -> float:
    """Degrees clockwise from 12 of a hand drawn from the centre outwards."""
    (x0, y0), (x1, y1) = line.get_xydata()[0], line.get_xydata()[-1]
    return math.degrees(math.atan2(x1 - x0, y1 - y0)) % 360


def test_clock_early_p():
    m = fam("clock_early_p")
    modes = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        modes[p["mode"]] += 1
        clocks = [tuple(c) for c in p["clocks"]]
        assert all(1 <= h <= 12 and mm in (0, 30) for h, mm in clocks), (s, clocks)  # o'clock and half past only
        assert len(clocks) == (1 if p["mode"] == "one" else 4) and len(set(clocks)) == len(clocks)
        letters = "ABCD"[:len(clocks)]
        for q in qs:
            assert q.kind == "mcq"
            for o in q.options:
                parse_time(o) if not re.fullmatch(r"Clock [A-D]", o) else None
            st = q.stem
            got = re.search(r"Which clock shows (.+)\?$", st)
            if got:
                t = parse_time(got.group(1))
                showing = [f"Clock {L}" for L, c in zip(letters, clocks) if c == t]
                assert showing == [picked(q)], (s, st, clocks)
                assert sorted(q.options) == [f"Clock {L}" for L in letters]
                continue
            got = re.search(r"What time does clock ([A-D]) show\?$", st)
            if got:
                h, mm = clocks[letters.index(got.group(1))]
                assert picked(q) == tlabel(h, mm), (s, st, q.options)
                assert {parse_time(o) for o in q.options} == {(h, 0), (h, 30), (wrap(h + 1), 0), (wrap(h + 1), 30)}
                continue
            got = re.search(r"What time is it (1 hour|half an hour) after the time on the clock\?$", st)
            if got:
                h, mm = clocks[0]
                total = (h % 12) * 60 + mm + (60 if got.group(1) == "1 hour" else 30)
                key = (wrap(total // 60 % 12 or 12), total % 60)
                assert picked(q) == tlabel(*key), (s, st, clocks[0], q.options)
                assert tlabel(h, mm) in q.options  # forgetting to add: the time shown
                continue
            got = re.search(r"at the time on the clock\. What time does (\w+) (.+)\?$", st)
            if got:
                assert p["mode"] == "one"
                h, mm = clocks[0]
                assert picked(q) == tlabel(h, mm), (s, st, q.options)
                continue
            pytest.fail(f"seed {s}: an unexpected question {st}")
        if s <= DRAWN:
            fig = m.draw(p)
            cs = centres(fig)
            for L, (h, mm) in zip(letters, clocks):
                hour, minute = by_gid(fig, f"hour:{L}"), by_gid(fig, f"minute:{L}")
                assert hour is not None and minute is not None, (s, L)
                want_h, want_m = (30 * (h % 12) + mm / 2) % 360, 6 * mm % 360
                assert min(abs(hand_angle(hour) - want_h), 360 - abs(hand_angle(hour) - want_h)) < 0.5, (s, L, h, mm)
                assert min(abs(hand_angle(minute) - want_m), 360 - abs(hand_angle(minute) - want_m)) < 0.5, (s, L, h, mm)
                hl = math.dist(*hour.get_xydata()[[0, -1]])
                ml = math.dist(*minute.get_xydata()[[0, -1]])
                assert hl < 0.75 * ml, (s, "the hour hand must be clearly the shorter")
                face = by_gid(fig, f"face:{L}")
                cx, cy = face.center
                r = face.radius
                for n in range(1, 13):
                    x, y, text = cs[f"num:{L}:{n}"]
                    assert text == str(n)
                    a = math.degrees(math.atan2(x - cx, y - cy)) % 360
                    assert min(abs(a - 30 * n % 360), 360 - abs(a - 30 * n % 360)) < 3, (s, L, n)
                    assert math.dist((x, y), (cx, cy)) > ml + 0.05 * r, (s, "the minute hand reaches a number")
                if p["mode"] == "four":
                    x, y, text = cs[f"letter:{L}"]
                    assert text == L and abs(x - cx) < 0.05 * r and y < cy - r, (s, L)
            plt.close(fig)
    assert min(modes.values()) > 300


# --- position_p --------------------------------------------------------------------------------------------

def cell_of(grid, name):
    return next((r, c) for r, row in enumerate(grid) for c, o in enumerate(row) if o == name)


def test_position_p():
    m = fam("position_p")
    asked = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        grid = p["grid"]
        R, C = len(grid), len(grid[0])
        assert (R, C) == (p["rows"], p["cols"]) and 2 <= R <= 3 and 3 <= C <= 4
        flat = [o for row in grid for o in row]
        assert len(set(flat)) == len(flat) and all(re.fullmatch(r"[a-z]+", o) for o in flat)  # one word each
        for q in qs:
            st = q.stem
            assert q.kind == "mcq" and all(o.startswith("the ") and o[4:] in flat for o in q.options), (s, q.options)
            got = re.search(r"(Left|Right) means your (left|right) as you look\. What is just to the (left|right) of the "
                            r"(\w+)\?$", st)
            if got:
                assert got.group(1).lower() == got.group(2) == got.group(3)
                r, c = cell_of(grid, got.group(4))
                cc = c - 1 if got.group(3) == "left" else c + 1
                assert 0 <= cc < C, (s, st)
                assert picked(q) == f"the {grid[r][cc]}", (s, st, grid)
                mirror = c + 1 if got.group(3) == "left" else c - 1
                if 0 <= mirror < C:
                    assert f"the {grid[r][mirror]}" in q.options  # the other way: a child's own left and right
                asked["side"] += 1
                continue
            got = re.search(r"What is just (above|below) the (\w+)\?$", st)
            if got:
                r, c = cell_of(grid, got.group(2))
                rr = r - 1 if got.group(1) == "above" else r + 1
                assert 0 <= rr < R, (s, st)
                assert picked(q) == f"the {grid[rr][c]}", (s, st, grid)
                asked["updown"] += 1
                continue
            got = re.search(r"What is between the (\w+) and the (\w+)\?$", st)
            if got:
                (r1, c1), (r2, c2) = cell_of(grid, got.group(1)), cell_of(grid, got.group(2))
                assert (r1 == r2 and abs(c1 - c2) == 2) or (c1 == c2 and abs(r1 - r2) == 2), (s, st)
                assert picked(q) == f"the {grid[(r1 + r2) // 2][(c1 + c2) // 2]}", (s, st, grid)
                asked["between"] += 1
                continue
            got = re.search(r"What is in row (\d), column (\d)\? Rows count down from the top\.$|"
                            r"What is in row (\d), column (\d)\?$", st)
            if got:
                r, c = [int(v) for v in got.groups() if v][:2]
                assert p["labels"]
                assert picked(q) == f"the {grid[r - 1][c - 1]}", (s, st, grid)
                asked["grid"] += 1
                continue
            pytest.fail(f"seed {s}: an unexpected question {st}")
        assert len(qs) >= 3
        if s <= DRAWN:
            fig = m.draw(p)
            cs = centres(fig)
            plt.close(fig)
            spots = {o: cs[f"object:{o}"][:2] for o in flat}
            assert all(cs[f"object:{o}"][2] == o for o in flat)
            # every row on one level, every column in one line; the reader's left is the smaller x
            for r in range(R):
                ys = [spots[grid[r][c]][1] for c in range(C)]
                assert max(ys) - min(ys) < 0.02, (s, r)
                xs = [spots[grid[r][c]][0] for c in range(C)]
                steps = [b - a for a, b in zip(xs, xs[1:])]
                assert all(st > 0.5 for st in steps) and max(steps) - min(steps) < 0.02, (s, "columns evenly apart")
            for c in range(C):
                ys = [spots[grid[r][c]][1] for r in range(R)]
                assert all(a > b + 0.5 for a, b in zip(ys, ys[1:])), (s, "row 1 at the top")
                xs = [spots[grid[r][c]][0] for r in range(R)]
                assert max(xs) - min(xs) < 0.02
            if p["labels"]:
                for r in range(R):
                    x, y, text = cs[f"row:{r + 1}"]
                    assert text == f"row {r + 1}" and abs(y - spots[grid[r][0]][1]) < 0.6 and x < spots[grid[r][0]][0]
                for c in range(C):
                    x, y, text = cs[f"col:{c + 1}"]
                    assert text == f"column {c + 1}" and abs(x - spots[grid[0][c]][0]) < 0.05 and y > spots[grid[0][c]][1]
    assert min(asked.values()) > 200, asked


# --- compare_length_p --------------------------------------------------------------------------------------

def test_compare_length_p():
    m = fam("compare_length_p")
    modes = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        modes[p["mode"]] += 1
        items = {k: v for k, v in p["items"]}
        assert 3 <= len(items) <= 4 and len(set(items.values())) == len(items)
        assert all(isinstance(v, int) and (2 if p["mode"] == "cubes" else 1) <= v <= 10 for v in items.values())
        unit = "cubes" if p["mode"] == "cubes" else "metres"
        for q in qs:
            st = q.stem
            got = re.search(r"How many cubes long is the (\w+)\?$", st) or re.search(r"How long is the (\w+)\?$", st)
            if got:
                v = items[got.group(1)]
                assert q.kind == "short" and q.answer == str(v), (s, st)
                assert f"{v} {unit}" in q.accepted or (v == 1 and "1 metre" in q.accepted)
                if unit == "metres":
                    assert f"{v} m" in q.accepted
                continue
            got = re.search(r"Which is the (longest|shortest)\?$", st)
            if got:
                best = (max if got.group(1) == "longest" else min)(items, key=items.get)
                assert picked(q) == f"the {best}", (s, st, items)
                assert len(q.options) == len(items) or len(q.options) == 4
                continue
            got = re.search(r"How many (cubes|metres) longer is the (\w+) than the (\w+)\?$", st)
            if got:
                assert got.group(1) == unit
                d = items[got.group(2)] - items[got.group(3)]
                assert d > 0 and q.answer == str(d), (s, st, items)
                continue
            pytest.fail(f"seed {s}: an unexpected question {st}")
        assert len(qs) == 3
        if s <= DRAWN:
            fig = m.draw(p)
            ax = fig.axes[0]
            cs = centres(fig)
            if p["mode"] == "cubes":
                starts = set()
                for name, v in items.items():
                    cubes = sorted((pa for pa in ax.patches if (pa.get_gid() or "").startswith(f"cube:{name}:")),
                                   key=lambda pa: pa.get_x())
                    assert len(cubes) == v, (s, name, len(cubes), v)
                    w = cubes[0].get_width()
                    assert all(abs(c.get_width() - w) < 1e-9 and abs(c.get_height() - w) < 1e-9 for c in cubes)  # squares
                    assert all(abs(b.get_x() - a.get_x() - w) < 1e-9 for a, b in zip(cubes, cubes[1:]))  # touching
                    thing = by_gid(fig, f"thing:{name}")
                    xs = [x for x, _ in thing.get_path().transformed(thing.get_patch_transform()).vertices]
                    assert abs(min(xs) - cubes[0].get_x()) < 1e-6 and abs(max(xs) - (cubes[-1].get_x() + w)) < 1e-6, \
                        (s, name, "the thing is as long as its cubes")
                    starts.add(round(cubes[0].get_x(), 6))
                    assert cs[f"name:{name}"][2] == name and cs[f"name:{name}"][0] < cubes[0].get_x()
                assert len(starts) == 1, (s, "every row starts at the same line")
            else:
                for k in range(11):
                    x, y, text = cs[f"tick:{k}"]
                    assert text == str(k) and abs(x - k) < 0.05, (s, k)
                lines = {round(float(ln.get_xdata()[0]), 6) for ln in ax.lines if (ln.get_gid() or "").startswith("metre:")}
                assert lines == {float(k) for k in range(11)}, (s, lines)
                for name, v in items.items():
                    bar = by_gid(fig, f"bar:{name}")
                    assert abs(bar.get_x()) < 1e-9 and abs(bar.get_width() - v) < 1e-9, (s, name)
                    assert cs[f"name:{name}"][2] == name and cs[f"name:{name}"][0] < 0
            plt.close(fig)
    assert min(modes.values()) > 300


# --- shapes_p ----------------------------------------------------------------------------------------------

CORNERS = {"square": 4, "rectangle": 4, "triangle": 3, "right triangle": 3, "circle": 0}
SIDES = {"square": 4, "rectangle": 4, "triangle": 3, "right triangle": 3, "circle": 1}
RIGHT = {"square": 4, "rectangle": 4, "triangle": 0, "right triangle": 1}
PLURAL = {"squares": ("square",), "rectangles": ("rectangle",), "triangles": ("triangle", "right triangle"),
          "circles": ("circle",)}


def outline(pa):
    return [tuple(v) for v in pa.get_path().transformed(pa.get_patch_transform()).vertices]


def corners_of(pts):
    pts = [tuple(round(v, 6) for v in p) for p in pts]
    out = []
    for q in pts:
        if q not in out:
            out.append(q)
    return out


def test_shapes_p():
    m = fam("shapes_p")
    modes = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        modes[p["mode"]] += 1
        shapes = p["shapes"]
        kinds = [sh["kind"] for sh in shapes]
        assert set(kinds) <= set(CORNERS)
        if p["mode"] == "row":
            letters = [sh["letter"] for sh in shapes]
            assert letters == list("ABCDEF"[:len(shapes)]) and 4 <= len(shapes) <= 5
            assert kinds.count("square") == 1 and kinds.count("rectangle") >= 1
        for q in qs:
            st = q.stem
            got = re.search(r"Which shape has 4 equal sides\?$", st)
            if got:
                sq = [sh["letter"] for sh in shapes if sh["kind"] == "square"]
                assert [picked(q)] == [f"Shape {L}" for L in sq], (s, q.options)
                rect = [f"Shape {sh['letter']}" for sh in shapes if sh["kind"] == "rectangle"]
                assert set(rect) & set(q.options), (s, "4 sides but not equal: the rectangle is offered")
                continue
            got = re.search(r"How many (corners|sides) does shape ([A-F]) have\?$", st)
            if got:
                sh = next(x for x in shapes if x["letter"] == got.group(2))
                table = CORNERS if got.group(1) == "corners" else SIDES
                assert sh["kind"] != "circle" or got.group(1) == "corners"
                assert q.answer == str(table[sh["kind"]]), (s, st, sh["kind"])
                continue
            got = re.search(r"A right angle is a square corner\. How many right angles does shape ([A-F]) have\?$", st)
            if got:
                sh = next(x for x in shapes if x["letter"] == got.group(1))
                assert q.answer == str(RIGHT[sh["kind"]]), (s, st, sh["kind"])
                continue
            got = re.search(r"How many (squares|rectangles|triangles|circles) are (?:there|in the picture)\?$", st)
            if got:
                n = sum(1 for k in kinds if k in PLURAL[got.group(1)])
                assert n >= 1 and q.answer == str(n), (s, st, kinds)
                if got.group(1) == "rectangles":
                    assert "square" not in kinds, (s, "a square is a rectangle too: never asked beside one")
                continue
            pytest.fail(f"seed {s}: an unexpected question {st}")
        assert len(qs) >= 2
        if s <= DRAWN:
            fig = m.draw(p)
            cs = centres(fig)
            ax = fig.axes[0]
            for i, sh in enumerate(shapes):
                pa = by_gid(fig, f"shape:{i}")
                assert pa is not None, (s, i)
                if sh["kind"] == "circle":
                    assert type(pa).__name__ == "Circle"
                else:
                    pts = corners_of(outline(pa))
                    assert len(pts) == CORNERS[sh["kind"]], (s, sh["kind"], pts)
                    sides = [math.dist(a, b) for a, b in zip(pts, pts[1:] + pts[:1])]
                    if sh["kind"] == "square":
                        assert max(sides) - min(sides) < 1e-6
                    if sh["kind"] == "rectangle":
                        assert max(sides) >= 1.6 * min(sides), (s, "a rectangle that could pass for a square")
                    marks = [ln for ln in ax.lines if ln.get_gid() == f"right:{i}"]
                    if p["mode"] == "row":
                        assert len(marks) == RIGHT[sh["kind"]], (s, sh["kind"], len(marks))
                        # drawn over its own shape, not hidden behind it (the first PNGs hid the rectangles' marks)
                        assert all(mk.get_zorder() > pa.get_zorder() for mk in marks), (s, sh["kind"], "a hidden mark")
                    if sh["kind"] in ("square", "rectangle", "right triangle"):
                        n_right = sum(1 for k in range(len(pts))
                                      if abs((pts[k - 1][0] - pts[k][0]) * (pts[(k + 1) % len(pts)][0] - pts[k][0]) +
                                             (pts[k - 1][1] - pts[k][1]) * (pts[(k + 1) % len(pts)][1] - pts[k][1])) < 1e-6)
                        assert n_right == RIGHT[sh["kind"]], (s, sh["kind"])
                if p["mode"] == "row":
                    x, y, text = cs[f"letter:{sh['letter']}"]
                    assert text == sh["letter"]
            if p["mode"] == "row":
                xs = [cs[f"letter:{sh['letter']}"][0] for sh in shapes]
                assert xs == sorted(xs), (s, "letters left to right")
            plt.close(fig)
    assert min(modes.values()) > 300


# --- shapes_p: the P3z blind review ------------------------------------------------------------------------
# The picture sub-type failed 9 of 13: a square train cab measured 152 by 150 px where wheels and the front covered its
# edges, and windows that looked square were not counted; "circles in the house" left out a sun beside the house; and
# small circles (portholes inside the rocket, wheels on the train) were miscounted.

GAP = 0.08  # the least clear space between two outlines, in data units


def _pt_seg(p, a, b) -> float:
    (px, py), (ax_, ay), (bx, by) = p, a, b
    dx, dy = bx - ax_, by - ay
    t = max(0.0, min(1.0, ((px - ax_) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
    return math.hypot(px - ax_ - t * dx, py - ay - t * dy)


def _cross(a, b, c, d) -> bool:
    def turn(p, q, r):
        v = (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])
        return (v > 1e-12) - (v < -1e-12)
    return turn(a, b, c) * turn(a, b, d) < 0 and turn(c, d, a) * turn(c, d, b) < 0


def _edges(pts):
    return list(zip(pts, pts[1:] + pts[:1]))


def _boundary_gap(A, B) -> float:
    """The least distance between two polygons' outlines; 0 where they cross."""
    best = math.inf
    for a, b in _edges(A):
        for c, d in _edges(B):
            if _cross(a, b, c, d):
                return 0.0
            best = min(best, _pt_seg(a, c, d), _pt_seg(b, c, d), _pt_seg(c, a, b), _pt_seg(d, a, b))
    return best


def _inside(pt, poly) -> bool:
    x, y = pt
    hit = False
    for (x1, y1), (x2, y2) in _edges(poly):
        if (y1 > y) != (y2 > y) and x < x1 + (y - y1) * (x2 - x1) / (y2 - y1):
            hit = not hit
    return hit


def _side_lengths(pts):
    return [math.dist(a, b) for a, b in _edges(pts)]


def test_shapes_p_rectangles_are_plainly_not_square_and_squares_are_exact():
    m = fam("shapes_p")
    for s in SEEDS:
        p, _ = run(m, s)
        for sh in p["shapes"]:
            if sh["kind"] not in ("square", "rectangle"):
                continue
            pts = [tuple(v) for v in sh["pts"]]
            sides = _side_lengths(pts)
            assert len(pts) == 4
            assert all(abs((a[0] - b[0]) * (c[0] - b[0]) + (a[1] - b[1]) * (c[1] - b[1])) < 1e-9
                       for a, b, c in zip(pts[-1:] + pts[:-1], pts, pts[1:] + pts[:1])), (s, "square corners")
            if sh["kind"] == "square":
                assert max(sides) - min(sides) < 1e-9 and min(sides) >= 0.6 - 1e-9, (s, sides)
            else:
                assert max(sides) >= 1.6 * min(sides), (s, "a rectangle that could pass for a square", sides)
        if s <= 40:  # and so as drawn, in pixels
            fig = m.draw(p)
            fig.canvas.draw()  # equal aspect is applied when drawn
            ax = fig.axes[0]
            for i, sh in enumerate(p["shapes"]):
                if sh["kind"] == "square":
                    xy = ax.transData.transform(outline(by_gid(fig, f"shape:{i}")))
                    w, h = xy[:, 0].max() - xy[:, 0].min(), xy[:, 1].max() - xy[:, 1].min()
                    assert abs(w - h) < 0.5, (s, i, w, h)
            plt.close(fig)


def test_shapes_p_circles_are_big_and_every_outline_stands_clear():
    """Every circle at least as wide as the smallest square and never small (0.8 units across or more); no circle inside
    another shape, holding one, or touching one; and no two outlines touching or crossing, so every edge is seen whole.
    A shape may lie inside a bigger polygon (a window in a wall) only with clear space all round."""
    m = fam("shapes_p")
    for s in SEEDS:
        p, _ = run(m, s)
        shapes = p["shapes"]
        squares = [min(_side_lengths([tuple(v) for v in sh["pts"]])) for sh in shapes if sh["kind"] == "square"]
        for sh in shapes:
            if sh["kind"] == "circle":
                d = 2 * sh["r"]
                assert d >= 0.8 and (not squares or d >= min(squares) - 1e-9), (s, d, squares)
        for i, a in enumerate(shapes):
            for b in shapes[i + 1:]:
                if a["kind"] == "circle" and b["kind"] == "circle":
                    gap = math.dist(a["c"], b["c"]) - a["r"] - b["r"]
                elif "circle" in (a["kind"], b["kind"]):
                    c, poly = (a, b) if a["kind"] == "circle" else (b, a)
                    pts = [tuple(v) for v in poly["pts"]]
                    assert not _inside(tuple(c["c"]), pts), (s, "a circle inside a shape")
                    gap = min(_pt_seg(tuple(c["c"]), u, v) for u, v in _edges(pts)) - c["r"]
                else:
                    gap = _boundary_gap([tuple(v) for v in a["pts"]], [tuple(v) for v in b["pts"]])
                assert gap >= GAP, (s, a["kind"], b["kind"], round(gap, 3))


def test_shapes_p_count_questions_say_in_the_picture_and_never_name_it():
    m = fam("shapes_p")
    seen = 0
    for s in SEEDS:
        p, qs = run(m, s)
        if p["mode"] != "picture":
            continue
        for q in qs:
            assert re.search(r"How many \w+ are in the picture\?$", q.stem), (s, q.stem)
            assert not re.search(r"house|rocket|train", q.stem, re.I), (s, q.stem)
            seen += 1
    assert seen > 600


# --- capacity_mass_p ---------------------------------------------------------------------------------------

# What a thing may fairly weigh (kg). A parcel, basket or sack may hold anything.
FAIR = {"pumpkin": (2, 10), "cabbage": (2, 4), "pineapple": (2, 3), "watermelon": (3, 10), "parcel": (2, 10),
        "basket": (2, 8), "sack": (2, 10)}


def plausible(p) -> bool:
    """A balance a child would believe: the thing's mass, as the balance shows it, within what it fairly weighs; two
    things compared are of about the same mass (or one may hold anything), so the figure decides which is heavier."""
    if p["mode"] == "weights":
        lo, hi = FAIR[p["left"]]
        t = sum(p["weights"])
        return {"level": lo <= t <= hi, "left": t < hi, "right": t > lo}[p["down"]]
    a, b = p["left"], p["right"]
    if {a, b} & {"parcel", "basket", "sack"}:
        return True
    return abs(sum(FAIR[a]) / 2 - sum(FAIR[b]) / 2) <= 2


def test_capacity_mass_p():
    m = fam("capacity_mass_p")
    modes = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        modes[p["mode"]] += 1
        for q in qs:
            st = q.stem
            if p["mode"] == "jugs":
                jugs = {L: v for L, v in p["jugs"]}
                assert 3 <= len(jugs) <= 4 and len(set(jugs.values())) == len(jugs)
                assert all(1 <= v <= p["top"] for v in jugs.values()) and p["top"] in (5, 10)
                got = re.search(r"How many litres of (\w+) are in jug ([A-D])\?$", st)
                if got:
                    v = jugs[got.group(2)]
                    assert got.group(1) == p["liquid"] and q.answer == str(v)
                    assert {f"{v} litres" if v != 1 else "1 litre", f"{v} L"} <= set(q.accepted), q.accepted
                    continue
                got = re.search(r"Which jug has the (most|least) (\w+)\?$", st)
                if got:
                    best = (max if got.group(1) == "most" else min)(jugs, key=jugs.get)
                    assert picked(q) == f"Jug {best}", (s, st, jugs)
                    continue
                got = re.search(r"How many more litres are in jug ([A-D]) than in jug ([A-D])\?$", st)
                if got:
                    d = jugs[got.group(1)] - jugs[got.group(2)]
                    assert d > 0 and q.answer == str(d)
                    continue
            else:
                down = p["down"]
                assert down in ("left", "right", "level")
                assert plausible(p), (s, p)
                got = re.search(r"How many kilograms does the (\w+) weigh\?$", st)
                if got:
                    assert p["mode"] == "weights" and down == "level" and got.group(1) == p["left"]
                    total = sum(p["weights"])
                    assert q.answer == str(total) and f"{total} kg" in q.accepted
                    continue
                got = re.search(r"How many kilograms of weights are on the balance\?$", st)
                if got:
                    total = sum(p["weights"])
                    assert p["mode"] == "weights" and q.answer == str(total)
                    continue
                got = re.search(r"Which is (heavier|lighter), the (\w+) or the (\w+)\?$", st)
                if got:
                    a, b = got.group(2), got.group(3)
                    right = "weights" if p["mode"] == "weights" else p["right"]
                    assert {a, b} == {p["left"], right}, (s, st)
                    if down == "level":
                        key = "they weigh the same"
                    else:
                        low = p["left"] if down == "left" else right  # the side that hangs lower is heavier
                        high = right if down == "left" else p["left"]
                        key = f"the {low if got.group(1) == 'heavier' else high}"
                    assert picked(q) == key, (s, st, down, q.options)
                    assert sorted(q.options) == sorted([f"the {a}", f"the {b}", "they weigh the same"])
                    continue
            pytest.fail(f"seed {s}: an unexpected question {st}")
        if s <= DRAWN:
            fig = m.draw(p)
            cs = centres(fig)
            if p["mode"] == "jugs":
                for L, v in p["jugs"]:
                    water = by_gid(fig, f"water:{L}")
                    marks = {k: by_gid(fig, f"mark:{L}:{k}") for k in range(1, p["top"] + 1)}
                    assert all(mk is not None for mk in marks.values()), (s, L)
                    top = water.get_y() + water.get_height()
                    assert abs(top - marks[v].get_ydata()[0]) < 1e-9, (s, L, v)
                    ys = [marks[k].get_ydata()[0] for k in range(1, p["top"] + 1)]
                    steps = [b - a for a, b in zip(ys, ys[1:])]
                    assert min(steps) > 0 and max(steps) - min(steps) < 1e-9
                    assert abs(water.get_y() - (ys[0] - steps[0])) < 1e-9, (s, "the water starts at 0")
                    for k in range(1, p["top"] + 1):
                        if p["top"] == 5 or k % 2 == 0:
                            x, y, text = cs[f"marklabel:{L}:{k}"]
                            assert text == f"{k} L" and abs(y - ys[k - 1]) < 0.05, (s, L, k)
                    x, y, text = cs[f"jug:{L}"]
                    assert text == f"Jug {L}"
            else:
                beam = by_gid(fig, "beam")
                (x0, y0), (x1, y1) = beam.get_xydata()[0], beam.get_xydata()[-1]
                assert x0 < x1
                if p["down"] == "level":
                    assert abs(y1 - y0) < 1e-9
                else:
                    tilt = math.degrees(math.atan2(abs(y1 - y0), x1 - x0))
                    assert tilt >= 8, (s, "a tilt a child can see")
                    assert (y0 < y1) == (p["down"] == "left"), (s, p["down"])
                    left, right = by_gid(fig, "pan:left"), by_gid(fig, "pan:right")
                    ly = min(v[1] for v in outline(left))
                    ry = min(v[1] for v in outline(right))
                    assert (ly < ry) == (p["down"] == "left")
                if p["mode"] == "weights":
                    labels = sorted(cs[g][2] for g in cs if g.startswith("weight:"))
                    assert labels == sorted(f"{w} kg" for w in p["weights"]), (s, labels)
                    assert cs[f"item:{p['left']}"][2] == p["left"]
                else:
                    assert cs[f"item:{p['left']}"][2] == p["left"] and cs[f"item:{p['right']}"][2] == p["right"]
                    assert cs[f"item:{p['left']}"][0] < cs[f"item:{p['right']}"][0]
            plt.close(fig)
    assert min(modes.values()) > 200


# --- calendar_p --------------------------------------------------------------------------------------------

MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October",
          "November", "December"]
WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
ORD = {"first": 1, "second": 2, "third": 3, "fourth": 4}


def weekday(y, mth, d) -> int:
    """Zeller's congruence: 0 is Monday."""
    if mth < 3:
        mth += 12
        y -= 1
    k, j = y % 100, y // 100
    h = (d + 13 * (mth + 1) // 5 + k + k // 4 + j // 4 + 5 * j) % 7  # 0 is Saturday
    return (h + 5) % 7


def days_in(y, mth) -> int:
    if mth == 2:
        return 29 if (y % 4 == 0 and y % 100 != 0) or y % 400 == 0 else 28
    return 30 if mth in (4, 6, 9, 11) else 31


HOLIDAYS = {(1, 1): "New Year's Day", (2, 1): "Heroes' Day", (5, 1): "Labour Day", (7, 1): "Independence Day",
            (7, 4): "Liberation Day", (8, 15): "Assumption Day", (12, 25): "Christmas Day", (12, 26): "Boxing Day"}


def test_weekday_is_right_for_known_dates():
    assert weekday(2026, 10, 15) == 3  # a Thursday
    assert weekday(2024, 2, 29) == 3
    assert weekday(2000, 1, 1) == 5


def test_calendar_p():
    m = fam("calendar_p")
    asked = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        y, mth = p["year"], p["month"]
        n = days_in(y, mth)
        day, label = p["event"]
        assert 1 <= day <= n
        if (mth, day) in HOLIDAYS:
            assert label == HOLIDAYS[(mth, day)]
        assert label not in HOLIDAYS.values() or HOLIDAYS.get((mth, day)) == label, (s, "a holiday on its real date")
        if label == "Umuganura Day":
            assert mth == 8 and weekday(y, 8, day) == 4 and day <= 7  # the first Friday of August
        month = MONTHS[mth - 1]
        for q in qs:
            st = q.stem
            got = re.search(r"What day of the week is (\d+) (\w+)\?$", st)
            if got:
                d = int(got.group(1))
                assert got.group(2) == month and 1 <= d <= n
                assert picked(q) == WEEK[weekday(y, mth, d)], (s, st)
                assert all(o in WEEK for o in q.options)
                asked["weekday"] += 1
                continue
            got = re.search(r"How many (\w+)s are there in (\w+) (\d+)\?$", st)
            if got:
                w = WEEK.index(got.group(1))
                assert got.group(2) == month and int(got.group(3)) == y
                c = sum(1 for d in range(1, n + 1) if weekday(y, mth, d) == w)
                assert q.answer == str(c), (s, st)
                asked["count"] += 1
                continue
            got = re.search(r"What is the date of the (first|second|third|fourth) (\w+) in (\w+) (\d+)\?$", st)
            if got:
                w = WEEK.index(got.group(2))
                ds = [d for d in range(1, n + 1) if weekday(y, mth, d) == w]
                d = ds[ORD[got.group(1)] - 1]
                assert q.answer == str(d) and f"{d} {month}" in q.accepted and f"{month} {d}" in q.accepted, (s, st)
                asked["nth"] += 1
                continue
            got = re.search(r"Umuganda is on the last Saturday of the month\. What is its date in (\w+) (\d+)\?$", st)
            if got:
                d = max(d for d in range(1, n + 1) if weekday(y, mth, d) == 5)
                assert q.answer == str(d), (s, st)
                asked["umuganda"] += 1
                continue
            got = re.search(r"(.+) is circled on the calendar\. What day of the week is it\?$", st)
            if got:
                assert got.group(1) == label or got.group(1).endswith(label)
                assert picked(q) == WEEK[weekday(y, mth, day)], (s, st)
                asked["event"] += 1
                continue
            pytest.fail(f"seed {s}: an unexpected question {st}")
        if s <= DRAWN:
            fig = m.draw(p)
            cs = centres(fig)
            heads = [cs[f"head:{k}"] for k in range(7)]
            assert [h[2] for h in heads] == ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
            assert month in cs["title"][2] and str(y) in cs["title"][2]
            first = weekday(y, mth, 1)
            for d in range(1, n + 1):
                x, yy, text = cs[f"date:{d}"]
                assert text == str(d)
                col = weekday(y, mth, d)
                assert abs(x - heads[col][0]) < 0.05, (s, d, "under its weekday")
                assert yy < heads[col][1]
                week = (d - 1 + first) // 7
                if d > 1:
                    px, py, _ = cs[f"date:{d - 1}"]
                    if col == 0:
                        assert py > yy + 0.3, (s, d, "a new week starts a new row")
                    else:
                        assert abs(py - yy) < 1e-6
                assert week <= 5
            assert f"date:{n + 1}" not in cs
            ring = by_gid(fig, "ring")
            x, yy, _ = cs[f"date:{day}"]
            assert math.dist(ring.center, (x, yy)) < 0.05, (s, "the ring is round the event's date")
            assert label in cs["key"][2]
            plt.close(fig)
    assert min(asked.values()) > 150, asked
