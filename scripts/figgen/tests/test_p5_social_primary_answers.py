"""Answers of the P5 primary social studies families, recomputed independently over 1,000 seeds: the pictures sorted
into land, water and air by this file's own table, the journey table's fastest and cheapest found from its rows, the
sector map read square by square (what stands where, the compass direction from the grid, the place nearest the lake
measured from the drawn lake, the road's length from the squares and the printed scale), the weather and the community
data read from their own rows, the community helpers matched to their tools and places by this file's own table.

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
from matplotlib.patches import Circle, Polygon, Rectangle
from matplotlib.text import Text

from figgen.core import NAMES
from figgen.families import FAMILIES

SEEDS = range(1, 1001)
DRAWN = range(1, 41)
NEW = ("transport_communication_p", "sector_map_p", "weather_data_p", "community_data_p", "community_helpers_p")
STORE = Path("C:/Users/Stephen/figure-library/figures.db")
RELIGIOUS = ["God's Creation", "Prayer", "Notion of the Bible and Qur'an", "God's Commandments", "Attributes of God",
             "Introduction to Christian and Islamic Faith", "Sin and Its Consequences", "God's Revelation",
             "Values in the Bible and Qur'an", "Acts of Charity in the Community and Faith", "Respect for God's Creatures"]
MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October",
          "November", "December"]


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


def texts(m, p) -> list:
    fig = m.draw(p)
    try:
        return [t.get_text() for ax in fig.axes for t in ax.texts] + \
               [t.get_text() for ax in fig.axes for t in ax.get_xticklabels() + ax.get_yticklabels()] + \
               [ax.get_title() for ax in fig.axes] + [ax.get_ylabel() for ax in fig.axes] + [ax.get_xlabel() for ax in fig.axes]
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


def one_correct(q, good) -> None:
    """Exactly one option is right, and it is the key."""
    right = [o for o in q.options if good(o)]
    assert right == [picked(q)], (q.stem, q.options, right)


def num(text: str) -> int:
    return int(text.replace(" ", "").replace(",", ""))


# --- transport_communication_p --------------------------------------------------------------------------

CLASS = {"bicycle": "land", "motorbike": "land", "car": "land", "bus": "land", "lorry": "land", "train": "land",
         "boat": "water", "canoe": "water", "ship": "water", "plane": "air", "helicopter": "air",
         "phone": "communication", "radio": "communication", "television": "communication",
         "newspaper": "communication", "computer": "communication"}
LETTER_ASK = [("travels on water", "water"), ("flies in the air", "air"), ("travels on land", "land"),
              ("a means of communication", "communication")]
COUNT_ASK = [("water transport", "water"), ("air transport", "air"), ("land transport", "land"),
             ("means of communication", "communication")]


def test_transport_communication_p():
    m = fam("transport_communication_p")
    subs = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        subs[p["sub"]] += 1
        assert p["band"] == "P"
        if p["sub"] in ("sort", "mixed"):
            items = p["items"]
            assert len(items) == 6 == len(set(items)) and all(i in CLASS for i in items), (s, items)
            cls = [CLASS[i] for i in items]
            if p["sub"] == "sort":
                assert "communication" not in cls and cls.count("land") >= 2
            else:
                assert 2 <= cls.count("communication") <= 3, (s, cls)
            for q in qs:
                if q.kind == "mcq":
                    want = next(c for ph, c in LETTER_ASK if ph in q.stem)
                    good = ["ABCDEF"[i] for i, c in enumerate(cls) if c == want]
                    assert len(good) == 1, (s, q.stem, good)
                    assert set(q.options) <= set("ABCDEF") and len(q.options) == 4
                    one_correct(q, lambda o: o in good)
                else:
                    want = next(c for ph, c in COUNT_ASK if ph in q.stem)
                    assert q.answer == str(cls.count(want)) and cls.count(want) >= 1, (s, q.stem)
        else:
            rows = p["rows"]
            assert len(rows) == 4 and len({r[0] for r in rows}) == 4
            times = sorted(r[1] for r in rows)
            fares = sorted(r[2] for r in rows)
            assert times[1] - times[0] >= 5 and fares[1] - fares[0] >= 100, (s, rows)
            assert all(r[1] % 5 == 0 and r[2] % 100 == 0 and r[2] > 0 for r in rows)
            time = {r[0]: r[1] for r in rows}
            fare = {r[0]: r[2] for r in rows}
            shown = " ".join(texts(m, p)) if s <= 60 else None
            if shown is not None:
                for name, t, f in rows:
                    assert name in shown and f"{t} minutes" in shown and f"{f:,} Frw".replace(",", " ") in shown, (s, name)
            for q in qs:
                stem = q.stem
                if "fastest" in stem:
                    assert set(q.options) <= set(time)
                    one_correct(q, lambda o: time[o] == min(time.values()))
                elif "cheapest" in stem:
                    assert set(q.options) <= set(fare)
                    one_correct(q, lambda o: fare[o] == min(fare.values()))
                elif "cost" in stem and "more" in stem:
                    a, b = re.search(r"by (\w+) than by (\w+)", stem).groups()
                    assert fare[a] > fare[b] and num(q.answer) == fare[a] - fare[b], (s, stem)
                elif "minutes longer" in stem:
                    a, b = re.search(r"by (\w+) than by (\w+)", stem).groups()
                    assert time[a] > time[b] and num(q.answer) == time[a] - time[b], (s, stem)
                elif "altogether" in stem:
                    a = re.search(r"by (\w+)", stem).group(1)
                    n = {"Two": 2, "Three": 3}[re.search(r"(Two|Three) friends", stem).group(1)]
                    assert num(q.answer) == n * fare[a], (s, stem)
                else:
                    pytest.fail(f"unchecked question: {stem}")
    assert set(subs) == {"sort", "mixed", "journey"}, subs


def test_transport_communication_p_letters_sit_in_their_own_boxes():
    """Every letter's ring lies inside its own picture's box, no two rings come near, and the picture's name is
    printed under it (P4 review: letters need to sit unmistakably inside their area)."""
    m = fam("transport_communication_p")
    for s in range(1, 121):
        p = m.sample(random.Random(s))
        if p["sub"] == "journey":
            continue
        fig = m.draw(p)
        ax = fig.axes[0]
        rings = {pa.get_gid(): pa for pa in ax.patches if (pa.get_gid() or "").startswith("ring:")}
        boxes = {pa.get_gid(): pa for pa in ax.patches if (pa.get_gid() or "").startswith("box:")}
        names = {t.get_gid(): t.get_text() for t in ax.texts if (t.get_gid() or "").startswith("name:")}
        letters = {t.get_gid(): t.get_text() for t in ax.texts if (t.get_gid() or "").startswith("letter:")}
        plt.close(fig)
        assert len(rings) == len(boxes) == len(names) == len(letters) == 6, s
        for i in range(6):
            ring, box = rings[f"ring:{i}"], boxes[f"box:{i}"]
            (cx, cy), r = ring.center, ring.radius
            x0, y0 = box.get_x(), box.get_y()
            assert x0 + r < cx < x0 + box.get_width() - r and y0 + r < cy < y0 + box.get_height() - r, (s, i)
            assert letters[f"letter:{i}"] == "ABCDEF"[i]
            assert names[f"name:{i}"] == p["items"][i], (s, i)
        cs = list(rings.values())
        for i, a in enumerate(cs):
            for b in cs[i + 1:]:
                assert math.dist(a.center, b.center) > a.radius + b.radius + 1.0, s


# --- sector_map_p -------------------------------------------------------------------------------------------

DIRS = {"north": (0, 1), "north-east": (1, 1), "east": (1, 0), "south-east": (1, -1), "south": (0, -1),
        "south-west": (-1, -1), "west": (-1, 0), "north-west": (-1, 1)}
PLURAL = {"school": "schools", "hill": "hills", "forest": "forests"}
BUILDINGS = ("school", "health centre", "market", "community hall")


def _sign(v):
    return (v > 0) - (v < 0)


def exact_direction(a, b):
    dx, dy = b[0] - a[0], b[1] - a[1]
    if (dx, dy) == (0, 0) or not (dx == 0 or dy == 0 or abs(dx) == abs(dy)):
        return None
    return next(k for k, v in DIRS.items() if v == (_sign(dx), _sign(dy)))


def square_name(c, r) -> str:
    return f"{'ABCDEFGH'[c]}{r + 1}"


def river_squares(p) -> set:
    along, k, side = p["river"]
    c0, r0, w, h = p["lake"]
    if along == "col":
        rows = range(r0 + h, p["rows"]) if side == "top" else range(0, r0)
        return {(k, r) for r in rows}
    cols = range(c0 + w, p["cols"]) if side == "right" else range(0, c0)
    return {(c, k) for c in cols}


def test_sector_map_p():
    m = fam("sector_map_p")
    levels = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        levels[p["level"]] += 1
        syms = p["symbols"]
        cells = {(c, r): kind for kind, c, r in syms}
        assert len(cells) == len(syms), s
        c0, r0, w, h = p["lake"]
        lake = {(c, r) for c in range(c0, c0 + w) for r in range(r0, r0 + h)}
        river = river_squares(p)
        assert not (set(cells) & lake) and not (set(cells) & river), s
        along, k, _ = p["river"]
        assert (c0 <= k < c0 + w) if along == "col" else (r0 <= k < r0 + h), s  # the river runs into the lake
        kinds = Counter(cells.values())
        assert all(kinds[b] == 1 for b in BUILDINGS if b != "school") and kinds["school"] >= 1, (s, kinds)
        unique = {kind: cell for cell, kind in cells.items() if kinds[kind] == 1}
        for q in qs:
            stem = q.stem
            if "What is in square" in stem:
                sq = re.search(r"square ([A-H])(\d)", stem)
                cell = ("ABCDEFGH".index(sq.group(1)), int(sq.group(2)) - 1)
                assert cell in cells, (s, stem)
                one_correct(q, lambda o: o == cells[cell])
            elif "In which direction" in stem:
                b, a = re.search(r"is the ([a-z ]+) from the ([a-z ]+)\?", stem).groups()
                d = exact_direction(unique[a], unique[b])
                assert d, (s, stem)
                if p["level"] == "lower":
                    assert d in ("north", "east", "south", "west")
                one_correct(q, lambda o: o == d)
            elif "How many" in stem and "on the map" in stem:
                kind = next(k for k, v in PLURAL.items() if f"How many {v} " in stem)
                assert q.answer == str(kinds[kind]), (s, stem)
            elif "nearest the lake" in stem:
                assert p["level"] == "upper"
                cx, cy, ax_, ay_ = c0 + w / 2, r0 + h / 2, w / 2 - 0.15, h / 2 - 0.15
                ring = [(cx + ax_ * math.cos(2 * math.pi * i / 360), cy + ay_ * math.sin(2 * math.pi * i / 360)) for i in range(360)]
                gap = {}
                for (c, r), kind in cells.items():
                    if kind in BUILDINGS:
                        d = min(math.dist((c + 0.5, r + 0.5), pt) for pt in ring)
                        gap[kind] = min(gap.get(kind, 99), d)
                key = picked(q)
                assert all(gap[o] >= gap[key] + 1.0 for o in gap if o != key), (s, gap, key)
                assert set(q.options) <= set(gap)
            elif "How long is the road" in stem:
                a, b = re.search(r"joins the ([a-z ]+) and the ([a-z ]+)\.", stem).groups()
                (xa, ya), (xb, yb) = unique[a], unique[b]
                assert xa == xb or ya == yb
                squares = abs(xa - xb) + abs(ya - yb)
                between = {(x, y) for x in range(min(xa, xb), max(xa, xb) + 1) for y in range(min(ya, yb), max(ya, yb) + 1)}
                assert not (between - {(xa, ya), (xb, yb)}) & (set(cells) | lake | river), (s, stem)
                assert sorted(p["road"]) == sorted([a, b])
                assert q.answer == f"{squares * p['km']} km", (s, stem, q.answer)
            else:
                pytest.fail(f"unchecked question: {stem}")
    assert set(levels) == {"lower", "upper"}


def test_sector_map_p_draws_what_its_params_say():
    """The lake drawn lies inside its block of squares, every symbol stands in its square, the river stays in its
    column or row, and the scale and the key are printed."""
    m = fam("sector_map_p")
    for s in DRAWN:
        p = m.sample(random.Random(s))
        fig = m.draw(p)
        ax = fig.axes[0]
        words = [t.get_text() for t in ax.texts]
        lake = next(pa for pa in ax.patches if pa.get_gid() == "lake")
        pts = lake.get_path().to_polygons(lake.get_patch_transform())[0]
        c0, r0, w, h = p["lake"]
        assert all(c0 + 0.1 <= x <= c0 + w - 0.1 and r0 + 0.1 <= y <= r0 + h - 0.1 for x, y in pts), s
        river = next(ln for ln in ax.lines if ln.get_gid() == "river")
        along, k, _ = p["river"]
        xs, ys = river.get_xdata(), river.get_ydata()
        if along == "col":
            assert all(k + 0.15 <= x <= k + 0.85 for x in xs), s
        else:
            assert all(k + 0.15 <= y <= k + 0.85 for y in ys), s
        for i, (kind, c, r) in enumerate(p["symbols"]):
            first = next(pa for pa in ax.patches if pa.get_gid() == f"sym:{i}:{kind}")
            box = first.get_extents().transformed(ax.transData.inverted())
            assert c < box.x0 and box.x1 < c + 1 and r < box.y0 and box.y1 < r + 1, (s, kind)
        for word in ("school", "health centre", "market", "community hall", "road", "river", "lake", "hill", "forest"):
            assert word in words, (s, word)
        if p["level"] == "upper":
            assert f"1 square = {p['km']} km" in words, s
        plt.close(fig)


# --- weather_data_p --------------------------------------------------------------------------------------

DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


def test_weather_data_p():
    m = fam("weather_data_p")
    subs = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        subs[p["sub"]] += 1
        if p["sub"] == "week":
            w, r = p["weather"], p["rain"]
            assert len(w) == len(r) == 7
            assert all((x > 0) == (k == "rainy") for k, x in zip(w, r)), (s, w, r)
            for q in qs:
                stem = q.stem
                if "On how many days" in stem:
                    kind = "rainy" if "did it rain" in stem else re.search(r"was it (\w+)\?", stem).group(1)
                    assert q.answer == str(w.count(kind)) and w.count(kind) >= 1
                elif "most rain" in stem:
                    one_correct(q, lambda o: r[DAYS.index(o)] == max(r))
                    assert sorted(r)[-1] - sorted(r)[-2] >= 3
                elif "more rain" in stem:
                    a, b = re.search(r"on (\w+) than on (\w+)\?", stem).groups()
                    assert r[DAYS.index(a)] > r[DAYS.index(b)] > 0
                    assert q.answer == f"{r[DAYS.index(a)] - r[DAYS.index(b)]} mm"
                elif "whole week" in stem:
                    assert q.answer == f"{sum(r)} mm"
                elif "How much rain fell on" in stem:
                    d = re.search(r"fell on (\w+)\?", stem).group(1)
                    assert q.answer == f"{r[DAYS.index(d)]} mm" and r[DAYS.index(d)] > 0
                else:
                    pytest.fail(f"unchecked question: {stem}")
            if s <= 60:
                shown = texts(m, p)
                for x in r:
                    assert str(x) in shown, (s, x)
        elif p["sub"] == "rain":
            r = p["rain"]
            assert len(r) == 12 and all(x % p["step"] == 0 for x in r) and max(r) < p["top"]
            for q in qs:
                stem = q.stem
                if "most rain" in stem:
                    one_correct(q, lambda o: r[MONTHS.index(o)] == max(r))
                    assert sorted(r)[-1] - sorted(r)[-2] >= 20
                elif "more rain" in stem:
                    a, b = re.search(r"in (\w+) than in (\w+)\?", stem).groups()
                    assert r[MONTHS.index(a)] > r[MONTHS.index(b)]
                    assert q.answer == f"{r[MONTHS.index(a)] - r[MONTHS.index(b)]} mm"
                elif "less than" in stem:
                    t = int(re.search(r"less than (\d+) mm", stem).group(1))
                    assert t not in r and q.answer == str(sum(x < t for x in r)) and sum(x < t for x in r) >= 1
                else:
                    pytest.fail(f"unchecked question: {stem}")
        else:
            t = p["temps"]
            assert len(t) == 12 and p["lo"] < min(t) and max(t) < p["hi"]
            for q in qs:
                stem = q.stem
                if "hottest" in stem:
                    one_correct(q, lambda o: t[MONTHS.index(o)] == max(t))
                elif "coolest" in stem:
                    one_correct(q, lambda o: t[MONTHS.index(o)] == min(t))
                elif "warmer" in stem:
                    a, b = re.search(r"was (\w+) than (\w+)\?", stem).groups()
                    assert t[MONTHS.index(a)] > t[MONTHS.index(b)]
                    assert q.answer == f"{t[MONTHS.index(a)] - t[MONTHS.index(b)]} °C"
                else:
                    pytest.fail(f"unchecked question: {stem}")
    assert set(subs) == {"week", "rain", "temp"}, subs


def test_weather_data_p_values_sit_on_gridlines():
    m = fam("weather_data_p")
    for s in range(1, 81):
        p = m.sample(random.Random(s))
        if p["sub"] == "week":
            continue
        fig = m.draw(p)
        ax = fig.axes[0]
        lines = {round(float(v), 6) for v in list(ax.get_yticks()) + list(ax.get_yticks(minor=True))}
        if p["sub"] == "rain":
            heights = [round(b.get_height(), 6) for b in ax.patches if (b.get_gid() or "").startswith("bar-")]
            assert heights == [float(x) for x in p["rain"]], s
            assert all(float(x) in lines for x in p["rain"]), s
        else:
            pts = next(ln for ln in ax.lines if ln.get_gid() == "temps").get_ydata()
            assert [int(v) for v in pts] == p["temps"]
            assert all(float(x) in lines for x in p["temps"]), s
        plt.close(fig)


# --- community_data_p ------------------------------------------------------------------------------------

def test_community_data_p():
    m = fam("community_data_p")
    subs = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        subs[(p["band"], p["sub"])] += 1
        cats, vals = p["cats"], p["values"]
        val = dict(zip(cats, vals))
        assert len(set(cats)) == len(cats)
        if p["sub"] == "tourists":  # a year of months may repeat a number; the busiest month is one month
            assert sorted(vals)[-1] - sorted(vals)[-2] >= 200, (s, vals)
        else:
            assert len(set(vals)) == len(vals), (s, vals)
        if p["sub"] == "pictogram":
            unit = p["key"] // 2 if p["level"] == "upper" else p["key"]
            assert all(v % unit == 0 and v > 0 for v in vals), (s, vals)
        for q in qs:
            stem = q.stem
            if q.kind == "mcq" and ("most" in stem or "fewest" in stem):
                top = max(vals) if "most" in stem else min(vals)
                assert set(q.options) <= set(cats)
                one_correct(q, lambda o: val[o] == top)
            elif "percentage" in stem.lower() and "increase" in stem:
                a, b = re.search(r"from (\w+) to (\w+)\?", stem).groups()
                va, vb = val[a], val[b]
                assert (vb - va) * 100 % va == 0 and vb > va
                assert q.answer == f"{(vb - va) * 100 // va}%", (s, stem)
            elif "percentage" in stem.lower():
                c = next(c for c in cats if f"work in {c.lower()}" in stem)
                assert val[c] * 100 % sum(vals) == 0
                assert q.answer == f"{val[c] * 100 // sum(vals)}%", (s, stem)
            elif "more" in stem:
                hits = [(a, b) for a in cats for b in cats if a != b and re.search(
                    rf"\b{re.escape(a)}\b.* than (?:in |as |at )?{re.escape(b)}\b", stem)]
                assert len(hits) == 1, (s, stem, hits)
                a, b = hits[0]
                assert val[a] > val[b] and num(q.answer) == val[a] - val[b], (s, stem)
            elif "altogether" in stem or "in all" in stem:
                if "first three months" in stem:
                    assert num(q.answer) == sum(vals[:3]), (s, stem)
                else:
                    assert num(q.answer) == sum(vals), (s, stem)
            else:
                hits = [c for c in cats if re.search(rf"\b{re.escape(c)}\b", stem)]
                assert len(hits) == 1, (s, stem)
                assert num(q.answer) == val[hits[0]], (s, stem)
    assert set(subs) == {("P", "pictogram"), ("P", "bar"), ("LS", "workers"), ("UP", "tourists")}, subs


def test_community_data_p_shows_every_value():
    """A pictogram's symbols add up to each row's value by its printed key; a bar's height and a line's points are
    the values, on gridlines; the formulas a question uses are printed."""
    m = fam("community_data_p")
    for s in range(1, 81):
        p = m.sample(random.Random(s))
        fig = m.draw(p)
        ax = fig.axes[0]
        words = " ".join(t.get_text() for t in ax.texts)
        if p["sub"] == "pictogram":
            for row, v in enumerate(p["values"]):
                full = sum(1 for pa in ax.patches if pa.get_gid() == f"pict:{row}:full")
                half = sum(1 for pa in ax.patches if pa.get_gid() == f"pict:{row}:half")
                assert full * p["key"] + half * p["key"] // 2 == v, (s, row)
            assert f"= {p['key']} " in words, s
        elif p["sub"] in ("bar", "workers"):
            heights = [round(b.get_height(), 6) for b in ax.patches if (b.get_gid() or "").startswith("bar-")]
            assert heights == [float(v) for v in p["values"]], s
            lines = {round(float(v), 6) for v in list(ax.get_yticks()) + list(ax.get_yticks(minor=True))}
            assert all(float(v) in lines for v in p["values"]), s
            if p["sub"] == "workers":
                assert "× 100" in words, s
        else:
            pts = next(ln for ln in ax.lines if ln.get_gid() == "tourists").get_ydata()
            assert [int(v) for v in pts] == p["values"]
            lines = {round(float(v), 6) for v in list(ax.get_yticks()) + list(ax.get_yticks(minor=True))}
            assert all(float(v) in lines for v in p["values"]), s
            assert "× 100" in words, s
        plt.close(fig)


# --- community_helpers_p ---------------------------------------------------------------------------------

TOOL = {"doctor": "stethoscope", "nurse": "syringe", "farmer": "hoe", "teacher": "chalkboard", "mechanic": "spanner",
        "tailor": "sewing machine", "carpenter": "saw", "police officer": "whistle"}
PLACE = {"doctor": "health centre", "nurse": "health centre", "farmer": "farm", "teacher": "school",
         "mechanic": "garage", "tailor": "tailor's shop", "carpenter": "carpenter's workshop"}


def test_community_helpers_p():
    m = fam("community_helpers_p")
    subs = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        subs[p["sub"]] += 1
        helpers, things = p["helpers"], p["things"]
        assert len(helpers) == 4 == len(set(helpers))
        assert not {"doctor", "nurse"} <= set(helpers)
        table = TOOL if p["sub"] == "tools" else PLACE
        if p["sub"] == "tools":
            assert not {"teacher", "police officer"} <= set(helpers)
        assert all(h in table for h in helpers), (s, helpers)
        assert sorted(things) == sorted(table[h] for h in helpers), (s, things)
        noun = "tool" if p["sub"] == "tools" else "place"
        for q in qs:
            stem = q.stem
            if "Which letter" in stem:
                n = int(re.search(rf"Look at {noun} (\d)\.", stem).group(1))
                thing = things[n - 1]
                assert set(q.options) <= set("ABCD")
                one_correct(q, lambda o: table[helpers["ABCD".index(o)]] == thing)
            else:
                h = next(h for h in table if f"the {h} " in stem)
                assert h in helpers
                one_correct(q, lambda o: things[int(o.split()[-1]) - 1] == table[h])
    assert set(subs) == {"tools", "places"}, subs


def test_community_helpers_p_draws_names_letters_and_numbers():
    m = fam("community_helpers_p")
    for s in range(1, 61):
        p = m.sample(random.Random(s))
        fig = m.draw(p)
        ax = fig.axes[0]
        by_gid = {t.get_gid(): t.get_text() for t in ax.texts if t.get_gid()}
        rings = [pa for pa in ax.patches if (pa.get_gid() or "").startswith("ring:")]
        frames = {pa.get_gid(): pa for pa in ax.patches if (pa.get_gid() or "").startswith("box:")}
        plt.close(fig)
        assert len(frames) == 4, s
        for i, h in enumerate(p["helpers"]):
            assert by_gid[f"helper:{i}"] == h and by_gid[f"letter:{i}"] == "ABCD"[i], (s, i)
        for i in range(len(p["things"])):
            assert by_gid[f"number:{i}"] == f"{'Tool' if p['sub'] == 'tools' else 'Place'} {i + 1}", (s, i)
            # the tool or place is drawn, never named ("farm" may stand inside "farmer")
            assert not re.search(rf"\b{re.escape(p['things'][i])}\b", " ".join(by_gid.values())), s
        assert len(rings) == 4
        for ring in rings:  # each letter sits inside its own helper's box
            i = int(ring.get_gid()[5:])
            box = frames[f"box:{i}"]
            (cx, cy), r = ring.center, ring.radius
            assert box.get_x() + r < cx < box.get_x() + box.get_width() - r, (s, i)
            assert box.get_y() + r < cy < box.get_y() + box.get_height() - r, (s, i)
        for i, a in enumerate(rings):
            for b in rings[i + 1:]:
                assert math.dist(a.center, b.center) > a.radius + b.radius + 0.5, s


# --- shared checks ---------------------------------------------------------------------------------------

@pytest.mark.parametrize("fid", NEW)
def test_an_mcq_cannot_be_picked_from_its_options_alone(fid):
    m = fam(fid)
    seen, hits = defaultdict(int), defaultdict(int)
    for s in range(1, 301):
        _, qs = run(m, s)
        for q in qs:
            if q.kind == "mcq":
                key = re.sub(r"\d+", "#", q.stem.rsplit(". ", 1)[-1])
                key = re.sub(r"\b(" + "|".join(MONTHS + DAYS) + r")\b", "@", key)
                seen[key] += 1
                hits[key] += _central(q.options) == int(q.answer)
    bad = {k: (hits[k], seen[k]) for k in seen if seen[k] >= 10 and hits[k] / seen[k] > 0.35}
    assert not bad, (fid, bad)


@pytest.mark.parametrize("fid", NEW)
def test_no_line_runs_through_a_label(fid):
    """Pictures, roads, rivers and table rules sit beside the words they serve (P3z rule)."""
    m = fam(fid)
    for s in DRAWN:
        fig = m.draw(m.sample(random.Random(s)))
        boxes = drawn_texts(fig)
        for ax in fig.axes:
            for ln in ax.lines:
                for t, box in boxes:
                    assert not crosses(ln, box), (fid, s, ln.get_gid(), t.get_text())
        plt.close(fig)


@pytest.mark.parametrize("fid", ["transport_communication_p", "community_helpers_p", "sector_map_p"])
def test_no_picture_covers_a_word(fid):
    """A picture (a tool, a place, a map symbol, a banana tree) stays clear of every printed word: the review read
    a word half hidden under a picture as a different word. Frames (drawn under everything) and the letter rings,
    which hold their own letter, are left out."""
    m = fam(fid)
    for s in range(1, 41):
        fig = m.draw(m.sample(random.Random(s)))
        boxes = drawn_texts(fig)
        renderer = fig.canvas.get_renderer()
        ax = fig.axes[0]
        for pa in ax.patches:
            gid = pa.get_gid() or ""
            if pa.get_zorder() <= 1 or gid.startswith(("ring:", "box:", "lake")) or not pa.get_visible():
                continue
            ext = pa.get_window_extent(renderer)
            for t, box in boxes:
                hit = min(ext.x1, box.x1) - max(ext.x0, box.x0) > 1 and min(ext.y1, box.y1) - max(ext.y0, box.y0) > 1
                assert not hit, (fid, s, type(pa).__name__, gid, t.get_text())
        plt.close(fig)


@pytest.mark.parametrize("fid", NEW)
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


@pytest.mark.parametrize("fid", NEW)
def test_a_primary_figure_prints_big(fid):
    """Primary figures print at 10 pt at least, ticks included; a secondary one at 8 pt (P3z rule)."""
    m = fam(fid)
    n = Counter()
    for s in range(1, 200):
        p = m.sample(random.Random(s))
        if n[p["band"]] >= 12:
            continue
        n[p["band"]] += 1
        fig = m.draw(p)
        sizes = [t.get_fontsize() for ax in fig.axes for t in ax.texts if t.get_text().strip()]
        sizes += [t.get_fontsize() for ax in fig.axes for t in ax.get_xticklabels() + ax.get_yticklabels()
                  if t.get_text().strip()]
        plt.close(fig)
        assert min(sizes) >= (10 if p["band"] == "P" else 8), (fid, s, min(sizes))
    assert n["P"] >= 10, (fid, n)


@pytest.mark.parametrize("fid", NEW)
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


@pytest.mark.parametrize("fid", NEW)
def test_primary_sentences_are_short(fid):
    """Short sentences a young child can follow read aloud."""
    m = fam(fid)
    for seed in range(1, 120):
        p, qs = run(m, seed)
        if p["band"] != "P":
            continue
        for q in qs:
            for sentence in re.split(r"(?<=[.?!])\s+", q.stem):
                assert len(sentence.split()) <= 22, (fid, seed, sentence)


@pytest.mark.parametrize("fid", NEW)
def test_declares_its_concepts_bands_and_stages(fid):
    m = fam(fid)
    assert m.SUBJECT == "social-studies" and m.CONCEPTS and all(c.startswith("social-studies.") for c in m.CONCEPTS)
    assert not [c for c in m.CONCEPTS if re.search(r"god|bible|quran|prayer|faith|sin-concept|religio|genocide|"
                                                   r"behaviour|values|conflict|rights", c)]
    assert m.NEEDS and re.compile(m.NEEDS) and m.AVOID
    for name in RELIGIOUS:
        assert re.search(m.AVOID, name, re.I), (fid, name)
    bands = set()
    for s in range(1, 200):
        p = m.sample(random.Random(s))
        bands.add(p["band"])
        if hasattr(m, "concepts_for"):
            assert set(m.concepts_for(p)) <= set(m.CONCEPTS), (fid, s)
        if p["band"] == "P":
            lo, hi = m.stages(p)
            assert 1 <= lo <= hi <= 6, (fid, s)
    assert bands == set(m.BANDS), (fid, bands)


def test_links_turn_away_the_misfits_and_keep_the_fits():
    cases = {  # fid: (names AVOID turns away, names NEEDS matches and AVOID lets through)
        "transport_communication_p": (["Main Historical Events of Our Sector", "Democracy and governance"],
                                      ["Transport and Communication", "Unit 7: Transport, employment, unemployment and "
                                                                      "their impact on the economy"]),
        "sector_map_p": (["Main Historical Events of Our Sector", "Environmental responsibility",
                          "Socio-Economic Activities in Our District", "Our Country"],
                         ["Infrastructure", "Natural Resources", "Physical Features and Effects of Climate Change",
                          "Major physical features and infrastructure located in our sector"]),
        "weather_data_p": (["Environmental responsibility", "Human rights"],
                           ["Weather, Flora and Fauna", "Environment and Climate in Our Province",
                            "Physical Features and Effects of Climate Change"]),
        "community_data_p": (["Unit 13: Relationship between tourism and culture",
                              "Preservation of National Heritage and Culture Through the Arts"],
                             ["Population", "Socio-Economic Activities in Our District", "Tourism and Development",
                              "Economics basics"]),
        "community_helpers_p": (["Rights and responsibilities", "Rules and fairness"], ["Community helpers"]),
    }
    for fid, (misfits, fits) in cases.items():
        m = fam(fid)
        for name in misfits:
            assert re.search(m.AVOID, name, re.I), (fid, name)
        for name in fits:
            assert re.search(m.NEEDS, name, re.I) and not re.search(m.AVOID, name, re.I), (fid, name)


# --- reach by name (read-only figure store) --------------------------------------------------------------

TARGETS = [  # (family, topic, the school year its book is for; None where the book names none)
    ("transport_communication_p", "Transport and Communication", 1),
    ("transport_communication_p", "Transport and Communication", 2),
    ("transport_communication_p", "Transport and Communication", 3),
    ("transport_communication_p", "Transport and Communication", 6),
    ("transport_communication_p", "Infrastructure", 4),
    ("sector_map_p", "Infrastructure", 4), ("sector_map_p", "Natural Resources", 6),
    ("sector_map_p", "Physical Features and Effects of Climate Change", 6),
    ("weather_data_p", "Weather, Flora and Fauna", 4), ("weather_data_p", "Environment and Climate in Our Province", 5),
    ("weather_data_p", "Physical Features and Effects of Climate Change", 6),
    ("community_data_p", "Population", 5), ("community_data_p", "Socio-Economic Activities in Our District", 4),
    ("community_data_p", "Tourism and Development", None), ("community_data_p", "Economics basics", 7),
    ("community_helpers_p", "Community helpers", 1), ("community_helpers_p", "Community helpers", 2),
    ("community_helpers_p", "Community helpers", 3),
]
NEVER = {  # topics a family must not reach: religion, values and behaviour, and topics that teach something else
    "transport_communication_p": {"Main Historical Events of Our Sector", "Community helpers", "Economy"},
    "sector_map_p": {"Main Historical Events of Our Sector", "Environmental responsibility", "Weather, Flora and Fauna",
                     "Socio-Economic Activities in Our District", "Economy", "Our Country"},
    "weather_data_p": {"Environmental responsibility", "Natural Resources", "Economy", "Environment"},
    "community_data_p": {"Unit 13: Relationship between tourism and culture", "Budget", "Environment in Our Sector",
                         "Preservation of National Heritage and Culture Through the Arts"},
    "community_helpers_p": {"Transport and Communication", "Main Historical Events of Our Sector", "Our Sector",
                            "Environment", "Environmental responsibility"},
}
ALWAYS_NEVER = set(RELIGIOUS) | {"Democracy and governance", "Rights and responsibilities", "Human rights",
                                 "Conflict resolution", "The 1994 Genocide Against the Tutsi",
                                 "Rwandan Values and Risky Behaviours in Society", "Living in Harmony and Good Behaviours",
                                 "Relationships and Good Behaviours", "Promoting Peace and Honesty"}


@pytest.fixture(scope="module")
def index():
    if not STORE.exists():
        pytest.skip("no figure store")
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
    from figgen import link
    db = sqlite3.connect(f"file:{STORE}?mode=ro", uri=True)
    db.row_factory = sqlite3.Row
    known = {r[0] for r in db.execute("SELECT id FROM concepts")}
    return link, link.topic_index(db), known


@pytest.mark.parametrize("fid,topic,stage", TARGETS)
def test_reaches_the_empty_topic_by_name(fid, topic, stage, index):
    link, ix, _ = index
    by_key = {t["key"]: t for t in ix}
    reached = {(by_key[k]["name"].strip(), by_key[k]["stage"]) for k in link.reach(ix, fam(fid), 200)}
    assert (topic, stage) in reached, (fid, topic, stage)


@pytest.mark.parametrize("fid", NEW)
def test_reaches_no_topic_it_cannot_serve(fid, index):
    link, ix, known = index
    m = fam(fid)
    assert set(m.CONCEPTS) <= known, sorted(set(m.CONCEPTS) - known)
    by_key = {t["key"]: t for t in ix}
    reached = {by_key[k]["name"].strip() for k in link.reach(ix, m, 200)}
    bad = reached & (ALWAYS_NEVER | NEVER[fid])
    assert not bad, (fid, sorted(bad))
