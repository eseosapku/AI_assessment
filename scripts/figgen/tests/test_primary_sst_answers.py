"""Answers of the Primary Social Studies families (P3x), recomputed from each figure's params over 1,000 seeds.

Nothing here calls a family's own helpers to work out a key. A compass direction is read from the two squares' grid
positions, and a place "to the east" must be the only place anywhere in the east's quarter of the map around it; a
count of map symbols is counted from the symbols placed, and "next to the river" is measured from the river's own
points; a family relation is worked out from who is whose child; the local government ladder is this file's own table
(the 2006 reform); a budget's totals are added up from its rows. Every value a question needs is checked as drawn.
"""
import math
import random
import re
import sqlite3
from collections import Counter
from pathlib import Path

import matplotlib.pyplot as plt
import pytest

from figgen.core import NAMES
from figgen.families import FAMILIES

SEEDS = range(1, 1001)
DRAWN = 120  # the figure itself is built and read for the first seeds
SST = ["compass_map_p", "map_key_p", "family_tree_p", "admin_ladder_p", "budget_p"]
STORE = Path("C:/Users/Stephen/figure-library/figures.db")
RELIGIOUS = ["God's Creation", "Prayer", "Notion of the Bible and Qur'an", "God's Commandments", "Attributes of God",
             "Introduction to Christian and Islamic Faith", "Sin and Its Consequences", "God's Revelation"]


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


def own_wordings(m) -> int:
    """How many of 30 figures carry a stem no other of the 30 has (the shared wording test, P2a)."""
    stems = []
    for seed in range(1, 31):
        rng = random.Random(seed)
        stems.append({q.stem for q in m.questions(m.sample(rng), rng)})
    return sum(1 for i, s in enumerate(stems) if s - set().union(*(t for j, t in enumerate(stems) if j != i)))


def boxes(fig):
    """Each text the figure drew, with its box in data coordinates: (text, gid, x0, y0, x1, y1)."""
    fig.canvas.draw()
    renderer = fig.canvas.get_renderer()
    out = []
    for ax in fig.axes:
        inv = ax.transData.inverted()
        for t in ax.texts:
            if not t.get_text().strip():
                continue
            b = t.get_window_extent(renderer)
            (x0, y0), (x1, y1) = inv.transform([(b.x0, b.y0), (b.x1, b.y1)])
            out.append((t.get_text(), t.get_gid() or "", min(x0, x1), min(y0, y1), max(x0, x1), max(y0, y1)))
    return out


def fr(n) -> str:
    """Francs as the figures print them: a space for thousands ("12 500")."""
    return f"{int(n):,}".replace(",", " ")


@pytest.mark.parametrize("fid", SST)
def test_sst_family_is_worded_and_linked(fid):
    m = fam(fid)
    assert m.SUBJECT == "social-studies" and m.BANDS == ("P",)
    assert m.CONCEPTS and all(c.startswith("social-studies.") for c in m.CONCEPTS)
    assert not [c for c in m.CONCEPTS if re.search(r"god|bible|quran|prayer|faith|sin-concept|religio", c)]
    assert m.NEEDS and m.AVOID
    for name in RELIGIOUS:
        assert re.search(m.AVOID, name, re.I), (fid, name)
    assert own_wordings(m) >= 27, fid
    for seed in range(1, 80):
        p, qs = run(m, seed)
        assert p["band"] == "P" and p["level"] in ("lower", "upper")
        first = next((n for n in NAMES if qs[0].stem.startswith(n)), None)
        assert first, (fid, seed, qs[0].stem)
        for q in qs:
            for owner in re.findall(r"\b(" + "|".join(NAMES) + r")'s\b", q.stem):
                assert owner == first, (fid, seed, q.stem)
            for sentence in re.split(r"(?<=[.?!])\s+", q.stem):
                assert len(sentence.split()) <= 26, (fid, seed, sentence)  # short sentences, for a child of eight
            if q.kind == "short":
                assert q.answer in q.accepted
            else:
                assert len(q.options) >= 3


@pytest.mark.parametrize("fid", SST)
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
        "compass_map_p": {"Direction and Location", "Map of Our Province and Its Location", "Our Country", "Our Sector",
                          "Environment in Our Sector"},
        "map_key_p": {"Map of Our Province and Its Location", "Our Country", "Our Sector",
                      "Social Services and Important Places in Our Province"},
        "family_tree_p": {"Family Members", "An Extended Family"},
        "admin_ladder_p": {"Local Government Organisation", "Local Government Organization", "Our Sector",
                           "Civics and Governance"},
        "budget_p": {"Budget", "Economy", "Economic Activities"},
    }[fid]
    assert want <= got, sorted(want - got)
    never = set(RELIGIOUS) | {"Democracy and governance", "Community helpers", "Rights and responsibilities"}
    never |= {
        "compass_map_p": {"Budget", "Family Members", "Economy", "An Extended Family", "Main Historical Events of Our Sector"},
        "map_key_p": {"Budget", "Family Members", "Local Government Organisation", "Economy",
                      "Main Historical Events of Our Sector"},
        "family_tree_p": {"Family Property", "Budget", "Our Sector", "Economy"},
        "admin_ladder_p": {"School Leaders and School Symbols", "Budget", "Family Members", "Direction and Location",
                           "Main Historical Events of Our Sector"},
        "budget_p": {"An Extended Family", "Family Property", "Our Sector", "Family Members"},
    }[fid]
    assert not got & never, sorted(got & never)


# --- compass_map_p ---------------------------------------------------------------------------------

DIRS = {"north": (0, 1), "north-east": (1, 1), "east": (1, 0), "south-east": (1, -1), "south": (0, -1),
        "south-west": (-1, -1), "west": (-1, 0), "north-west": (-1, 1)}
CARDINAL = ["north", "east", "south", "west"]
LETTERS = {"north": "N", "north-east": "NE", "east": "E", "south-east": "SE", "south": "S", "south-west": "SW",
           "west": "W", "north-west": "NW"}


def _sign(v):
    return (v > 0) - (v < 0)


def exact_direction(a, b):
    """The compass point from square a to square b, only where b lies exactly on it: the same row, the same column or
    the same diagonal. None otherwise."""
    dx, dy = b[0] - a[0], b[1] - a[1]
    if (dx, dy) == (0, 0) or not (dx == 0 or dy == 0 or abs(dx) == abs(dy)):
        return None
    return next(k for k, v in DIRS.items() if v == (_sign(dx), _sign(dy)))


def in_quarter(d, a, b) -> bool:
    """Whether square b lies anywhere in the quarter of the map around point d, seen from a, edges included: the
    widest a child could read "east of" (or "north-east of")."""
    dx, dy = b[0] - a[0], b[1] - a[1]
    if (dx, dy) == (0, 0):
        return False
    ux, uy = DIRS[d]
    if d in CARDINAL:
        along, across = dx * ux + dy * uy, abs(dx * uy - dy * ux)
        return along > 0 and across <= along
    return dx * ux >= 0 and dy * uy >= 0


COLUMNS = "ABCDEFGH"


def grid_square(cell) -> str:
    """A square as a Primary map names it: its column's letter, then its row's number counted from the bottom."""
    return f"{COLUMNS[cell[0]]}{cell[1] + 1}"


def test_compass_map_p():
    m = fam("compass_map_p")
    levels, asked_diag = Counter(), Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        levels[p["level"]] += 1
        allowed = CARDINAL if p["level"] == "lower" else list(DIRS)
        places = {k: tuple(v) for k, v in p["places"].items()}
        n = len(places)
        assert (5 <= n <= 6) if p["level"] == "lower" else (6 <= n <= 7), (s, n)
        cols, rows = p["cols"], p["rows"]
        assert cols <= len(COLUMNS)
        assert all(0 <= x < cols and 0 <= y < rows for x, y in places.values())
        cells = list(places.values())
        for i, a in enumerate(cells):  # no two places in touching squares: every label has room
            for b in cells[i + 1:]:
                assert max(abs(a[0] - b[0]), abs(a[1] - b[1])) >= 2, (s, a, b)
        along, k = p["river"]
        assert along in ("col", "row")
        assert all((x if along == "col" else y) != k for x, y in cells), (s, "a place on the river")
        # the road joins two places, straight or with one turn, never through another place or along the river
        road_from, road_to, corner = p["road"]
        pa, pb, c = places[road_from], places[road_to], tuple(corner)
        assert (pa[0] == c[0] or pa[1] == c[1]) and (pb[0] == c[0] or pb[1] == c[1]), (s, p["road"])
        path, cur = [pa], pa
        for target in (c, pb):
            while cur != target:
                cur = (cur[0] + _sign(target[0] - cur[0]), cur[1] + _sign(target[1] - cur[1]))
                path.append(cur)
        assert len(path) == len(set(path)), (s, "the road doubles back")
        assert not set(path[1:-1]) & set(cells), (s, "the road runs through another place")
        for u, v in zip(path, path[1:]):
            assert not ((u[0] == v[0] == k) if along == "col" else (u[1] == v[1] == k)), (s, "the road runs along the river")
        seen = set()
        for q in qs:
            st = q.stem
            got = re.search(r"In which direction is the (.+?) from the (.+?)\?$", st)
            if got:
                b, a = got.groups()
                key = exact_direction(places[a], places[b])
                assert key in allowed, (s, a, b, key)
                assert picked(q) == key, (s, st, q.options)
                assert set(q.options) <= set(allowed) and len(q.options) == 4
                asked_diag[key not in CARDINAL] += p["level"] == "upper"
                seen.add("direction")
                continue
            got = re.search(r"Which place is ([a-z-]+) of the (.+?)\?$", st)
            if got:
                d, x = got.groups()
                assert d in allowed
                quarter = [k for k, v in places.items() if k != x and in_quarter(d, places[x], v)]
                assert quarter == [picked(q)], (s, st, quarter)
                assert exact_direction(places[x], places[picked(q)]) == d  # and exactly that way, on its row or column
                for o in wrong(q):
                    assert o in places and o != x and not in_quarter(d, places[x], places[o]), (s, o)
                seen.add("which")
                continue
            got = re.search(r"Which place is the furthest (north|south|east|west) on the map\?$", st)
            if got:
                ux, uy = DIRS[got.group(1)]
                score = {k: v[0] * ux + v[1] * uy for k, v in places.items()}
                best = max(score.values())
                tops = [k for k, v in score.items() if v == best]
                assert tops == [picked(q)], (s, st, tops)
                assert all(score[o] < best and o in places for o in wrong(q))
                seen.add("far")
                continue
            got = re.search(r"In which square is the (.+?)\? Give the letter, then the number\.$", st)
            if got:
                key = grid_square(places[got.group(1)])
                assert q.kind == "short" and q.answer == key, (s, q.answer, key)
                assert {key.lower(), f"{key[0]} {key[1:]}"} <= set(q.accepted), q.accepted
                seen.add("square")
                continue
            pytest.fail(f"seed {s}: an unexpected question {st}")
        assert seen == {"direction", "which", "far", "square"}, (s, seen)
        if s <= DRAWN:
            fig = m.draw(p)
            texts = boxes(fig)
            road = [ln for ax in fig.axes for ln in ax.lines if ln.get_gid() == "road"]
            plt.close(fig)
            for name, (x, y) in places.items():
                label = [(x0, y0, x1, y1) for t, g, x0, y0, x1, y1 in texts if g == f"place:{name}"]
                assert len(label) == 1, (s, name)
                x0, y0, x1, y1 = label[0]
                assert x - 0.05 <= x0 and x1 <= x + 1.05 and y - 0.05 <= y0 and y1 <= y + 1.05, (s, name, label)
            # the grid's letters along the bottom and numbers up the side, each in line with its column or row
            for t, g, x0, y0, x1, y1 in texts:
                if g.startswith("col:"):
                    i = COLUMNS.index(g[4:])
                    assert t == g[4:] and abs((x0 + x1) / 2 - (i + 0.5)) < 0.05 and y1 < 0, (s, t)
                if g.startswith("row:"):
                    j = int(g[4:]) - 1
                    assert t == g[4:] and abs((y0 + y1) / 2 - (j + 0.5)) < 0.05 and x1 < 0, (s, t)
            assert {g[4:] for t, g, *_ in texts if g.startswith("col:")} == set(COLUMNS[:cols])
            assert {g[4:] for t, g, *_ in texts if g.startswith("row:")} == {str(j + 1) for j in range(rows)}
            letters = {g[8:]: ((x0 + x1) / 2, (y0 + y1) / 2) for t, g, x0, y0, x1, y1 in texts if g.startswith("compass:")}
            want = {LETTERS[d] for d in allowed}
            assert set(letters) == want, (s, set(letters))
            assert letters["N"][1] > letters["S"][1] and letters["E"][0] > letters["W"][0]  # north is up the page
            assert len(road) == 1
            pts = [tuple(round(float(v), 6) for v in pt) for pt in road[0].get_xydata()]
            ends = [(pa[0] + 0.5, pa[1] + 0.5), (c[0] + 0.5, c[1] + 0.5), (pb[0] + 0.5, pb[1] + 0.5)]
            assert pts[0] == ends[0] and pts[-1] == ends[2] and ends[1] in pts, (s, pts, ends)
    assert min(levels.values()) > 300
    assert asked_diag[True] > 150  # the upper level asks the in-between points too


def test_compass_map_p_no_wrong_option_lies_that_way_at_all():
    """P3x blind review: "Which place is west of the water tap?" also fitted the football field, west of it but higher
    up. A wrong option must not lie that way even loosely: for west it is level with the place or east of it (its x is
    no smaller), and so for each point, its half of the map (for north-east, dx + dy <= 0). The answer lies exactly that
    way, on the place's own row, column or diagonal."""
    m = fam("compass_map_p")
    for s in SEEDS:
        p, qs = run(m, s)
        places = {k: tuple(v) for k, v in p["places"].items()}
        q = next(q for q in qs if re.search(r"Which place is ([a-z-]+) of the (.+?)\?$", q.stem))
        d, x = re.search(r"Which place is ([a-z-]+) of the (.+?)\?$", q.stem).groups()
        ux, uy = DIRS[d]
        X = places[x]
        assert exact_direction(X, places[picked(q)]) == d, (s, q.stem)
        assert len(q.options) >= 3
        for o in wrong(q):
            dx, dy = places[o][0] - X[0], places[o][1] - X[1]
            assert dx * ux + dy * uy <= 0, (s, q.stem, o, (dx, dy))


# --- map_key_p ------------------------------------------------------------------------------------

KINDS = ["school", "hospital", "market", "church", "water tap", "forest"]
PLURAL = {"schools": "school", "hospitals": "hospital", "markets": "market", "churches": "church",
          "water taps": "water tap", "forests": "forest"}


def _seg_dist(p, a, b):
    (px, py), (ax, ay), (bx, by) = p, a, b
    vx, vy = bx - ax, by - ay
    t = max(0.0, min(1.0, ((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy)))
    return math.hypot(px - ax - t * vx, py - ay - t * vy)


def line_dist(p, pts):
    return min(_seg_dist(p, a, b) for a, b in zip(pts, pts[1:]))


# A map symbol reaches 0.3 of a unit from its centre at size 1, and the map draws them at 1.1: a symbol's box.
SYMBOL_HALF = 0.33
# "Next to" a line: the symbol's centre at most half a symbol and a little from the line's middle, so its edge meets
# the line's edge (P3x review).
ADJOIN = 0.5


def test_map_key_p():
    m = fam("map_key_p")
    levels, lines, counted = Counter(), Counter(), Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        levels[p["level"]] += 1
        sym = [(k, (x, y)) for k, x, y in p["symbols"]]
        assert {k for k, _ in sym} <= set(KINDS)
        tally = Counter(k for k, _ in sym)
        assert len(tally) >= 4, s
        w, h = p["width"], p["height"]
        river, road = [tuple(v) for v in p["river"]], [tuple(v) for v in p["road"]]
        for i, (k, (x, y)) in enumerate(sym):
            assert 0.4 <= x <= w - 0.4 and 0.4 <= y <= h - 0.4, (s, k)
            assert line_dist((x, y), river) >= 0.4 and line_dist((x, y), road) >= 0.4, (s, k, "a symbol on a line")
            for k2, (x2, y2) in sym[i + 1:]:
                assert math.hypot(x - x2, y - y2) >= 1.0, (s, k, k2)
        seen = set()
        for q in qs:
            st = q.stem
            got = (re.search(r"How many more (.+?) than (.+?) are on the map\?$", st)
                   or re.search(r"How many (.+?) and (.+?) are on the map altogether\?$", st))
            if got:
                a, b = (PLURAL[g] for g in got.groups())
                assert p["level"] == "upper"
                key = tally[a] - tally[b] if "more" in st else tally[a] + tally[b]
                assert key > 0 and q.answer == str(key), (s, st, q.answer)
                counted["two"] += 1
                seen.add("count")
                continue
            got = re.search(r"How many (.+?) are on the map\?$", st)
            if got:
                kind = PLURAL[got.group(1)]
                assert tally[kind] >= 2 and q.answer == str(tally[kind]), (s, st, q.answer)
                counted["one"] += 1
                seen.add("count")
                continue
            got = re.search(r"What is at the place marked ([A-Z])\? Use the key\.$", st)
            if got:
                assert got.group(1) == p["letter"]
                kind = sym[p["marked"]][0]
                assert picked(q) == f"a {kind}", (s, q.options)
                assert all(o.startswith("a ") and o[2:] in KINDS and o[2:] != kind for o in wrong(q))
                seen.add("symbol")
                continue
            got = re.search(r"Which place in \w+ Cell is next to the (river|road)\?$", st)
            if got:
                line = river if got.group(1) == "river" else road
                lines[got.group(1)] += 1
                near = [i for i, (k, xy) in enumerate(sym) if line_dist(xy, line) <= ADJOIN]
                assert len(near) == 1, (s, st, near)
                d0 = line_dist(sym[near[0]][1], line)
                assert all(line_dist(xy, line) >= 3 * d0 for i, (k, xy) in enumerate(sym) if i != near[0]), s
                kind = sym[near[0]][0]
                assert kind != "forest" and picked(q) == f"a {kind}", (s, q.options)
                for o in wrong(q):
                    assert o[2:] in tally and o[2:] != kind, (s, o)  # each is on the map, and none is by the line
                seen.add("near")
                continue
            pytest.fail(f"seed {s}: an unexpected question {st}")
        assert seen == {"count", "symbol", "near"}, (s, seen)
        if s <= DRAWN:
            fig = m.draw(p)
            texts = boxes(fig)
            ax = fig.axes[0]
            drawn = Counter(g.split(":")[2] for g in (pa.get_gid() or "" for pa in ax.patches) if g.startswith("sym:"))
            keyed = {g[4:] for t, g, *_ in texts if g.startswith("key:")}
            marks = [((x0 + x1) / 2, (y0 + y1) / 2) for t, g, x0, y0, x1, y1 in texts if g == "mark" and t == p["letter"]]
            river_line = [ln for ln in ax.lines if ln.get_gid() == "river"]
            plt.close(fig)
            assert drawn == tally, (s, drawn, tally)
            assert keyed == set(KINDS) | {"road", "river"}, (s, keyed)
            assert len(marks) == 1
            dist = sorted((math.hypot(marks[0][0] - x, marks[0][1] - y), i) for i, (k, (x, y)) in enumerate(sym))
            assert dist[0][1] == p["marked"] and dist[1][0] - dist[0][0] >= 0.35, (s, dist[:2])
            assert len(river_line) == 1
            assert [tuple(round(float(v), 6) for v in pt) for pt in river_line[0].get_xydata()] == \
                [tuple(round(float(v), 6) for v in pt) for pt in river]
    assert min(levels.values()) > 300 and min(lines.values()) > 300 and counted["two"] > 150


def test_map_key_p_marker_points_at_its_symbol():
    """P3x blind review: a letter's arrow pointed at empty ground. The arrow's tip lands inside the marked symbol's box
    and no other symbol's, and the letter itself sits nearer that symbol than any other."""
    m = fam("map_key_p")
    for s in range(1, 301):
        p = m.sample(random.Random(s))
        fig = m.draw(p)
        marks = [t for t in fig.axes[0].texts if t.get_gid() == "mark"]
        plt.close(fig)
        assert len(marks) == 1 and marks[0].get_text() == p["letter"], s
        (tx, ty), (lx, ly) = marks[0].xy, marks[0].xyann
        kind, x, y = p["symbols"][p["marked"]]
        assert abs(tx - x) <= SYMBOL_HALF and abs(ty - y) <= SYMBOL_HALF, (s, kind, (tx, ty), (x, y))
        for j, (k, u, v) in enumerate(p["symbols"]):
            if j != p["marked"]:
                assert not (abs(tx - u) <= SYMBOL_HALF and abs(ty - v) <= SYMBOL_HALF), (s, k)
                assert math.hypot(lx - u, ly - v) > math.hypot(lx - x, ly - y) + 0.3, (s, k)


def test_map_key_p_next_to_means_touching_and_nothing_else_close():
    """P3x blind review: no option touched the road or river, and several stood at like distances. The answer's symbol
    adjoins the line (centre within ADJOIN of the line's middle), and every other symbol on the map, so every wrong
    option, stands at least three times as far from it."""
    m = fam("map_key_p")
    for s in SEEDS:
        p, qs = run(m, s)
        q = next(q for q in qs if "is next to the" in q.stem)
        which = re.search(r"next to the (river|road)\?$", q.stem).group(1)
        line = [tuple(v) for v in p[which]]
        dists = sorted((line_dist((x, y), line), k) for k, x, y in p["symbols"])
        d0, kind = dists[0]
        assert d0 <= ADJOIN and picked(q) == f"a {kind}", (s, dists[:2], q.options)
        assert dists[1][0] >= 3 * d0, (s, dists[:2])
        for o in wrong(q):
            nearest = min(line_dist((x, y), line) for k, x, y in p["symbols"] if k == o[2:])
            assert nearest >= 3 * d0, (s, o, nearest, d0)


# --- family_tree_p --------------------------------------------------------------------------------

# The asker is a grandchild in the tree, so the first stem says "her" or "his": only names whose sex is plain.
GIRLS = {"Aline", "Grace", "Uwase", "Keza", "Teta", "Mutoni", "Ingabire", "Umutoni"}
BOYS = {"Eric", "Mugisha", "Kevin", "Jean", "Gasana", "Kalisa", "Habimana"}


def relation(people, y, z):
    """What y is to z, from who is whose child: the word a Primary book uses."""
    gy, gz = people[y]["gen"], people[z]["gen"]
    female = people[y]["sex"] == "F"

    def parents(i):
        if people[i]["gen"] == 2:
            return {j for j, q in enumerate(people) if q["gen"] == 1}
        if people[i]["gen"] == 3:
            return {people[i]["parent"]}
        return set()

    if gy == 1 and gz == 3:
        return "grandmother" if female else "grandfather"
    if gy == 1 and gz == 2:
        return "mother" if female else "father"
    if gy == 2 and gz == 3:
        if y in parents(z):
            return "mother" if female else "father"
        return "aunt" if female else "uncle"
    if gy == gz:
        if parents(y) == parents(z):
            return "sister" if female else "brother"
        return "cousin"
    if gy == 3 and gz == 2:
        if z in parents(y):
            return "daughter" if female else "son"
        return "niece" if female else "nephew"
    return None


def test_family_tree_p():
    m = fam("family_tree_p")
    levels, rels = Counter(), Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        levels[p["level"]] += 1
        people = p["people"]
        gen = Counter(q["gen"] for q in people)
        assert gen[1] == 2 and {q["sex"] for q in people if q["gen"] == 1} == {"F", "M"}
        if p["level"] == "lower":
            assert gen[2] == 2 and 3 <= gen[3] <= 4, (s, gen)
        else:
            assert gen[2] == 3 and 5 <= gen[3] <= 6, (s, gen)
        names = [q["name"] for q in people]
        assert len(set(names)) == len(names)
        me = p["me"]
        assert people[me]["gen"] == 3 and names[me] in NAMES
        assert people[me]["sex"] == ("F" if names[me] in GIRLS else "M") and names[me] in GIRLS | BOYS
        assert not set(names) - {names[me]} & set(NAMES), s  # nobody else in the tree shares a name with a questioner
        for i, q in enumerate(people):
            if q["gen"] == 3:
                assert people[q["parent"]]["gen"] == 2, s
        assert len({q["parent"] for q in people if q["gen"] == 3}) >= 2, s  # cousins to find
        seen = set()
        for q in qs:
            st = q.stem
            got = re.search(r"Who is (\w+)'s (grandmother|grandfather)\?$", st)
            if got:
                who, word = got.groups()
                z = names.index(who)
                assert z == me and st.startswith(who)
                assert (" her " if people[me]["sex"] == "F" else " his ") in st
                key = [names[y] for y in range(len(people)) if relation(people, y, z) == word]
                assert key == [picked(q)], (s, st, key)
                assert all(o in names and relation(people, names.index(o), z) != word for o in wrong(q))
                seen.add("grand")
                continue
            got = re.search(r"How many (grandchildren|children|cousins) does (\w+) have\?$", st)
            if got:
                word, who = got.groups()
                x = names.index(who)
                if word == "grandchildren":  # those x is a grandparent to
                    key = sum(1 for y in range(len(people)) if relation(people, x, y) in ("grandmother", "grandfather"))
                elif word == "children":  # those who are x's son or daughter
                    key = sum(1 for y in range(len(people)) if y != x and relation(people, y, x) in ("son", "daughter"))
                else:
                    assert p["level"] == "upper"
                    key = sum(1 for y in range(len(people)) if y != x and relation(people, y, x) == "cousin")
                assert key >= 1 and q.answer == str(key), (s, st, q.answer, key)
                seen.add("count")
                continue
            got = re.search(r"What is (\w+) to (\w+)\?$", st)
            if got:
                y, z = (names.index(g) for g in got.groups())
                key = relation(people, y, z)
                assert key in ("aunt", "uncle", "cousin", "sister", "brother", "niece", "nephew"), (s, key)
                if key in ("niece", "nephew"):
                    assert p["level"] == "upper"
                assert picked(q) == key, (s, st, q.options)
                assert key not in wrong(q)
                rels[key] += 1
                seen.add("relation")
                continue
            pytest.fail(f"seed {s}: an unexpected question {st}")
        assert seen == {"grand", "count", "relation"}, (s, seen)
        if s <= DRAWN:
            fig = m.draw(p)
            texts = boxes(fig)
            ax = fig.axes[0]
            styles = {g.split(":")[1]: g.split(":")[2] for g in (pa.get_gid() or "" for pa in ax.patches) if g.startswith("box:")}
            links = {ln.get_gid()[5:]: ln.get_xydata() for ln in ax.lines if (ln.get_gid() or "").startswith("link:")}
            plt.close(fig)
            where = {}
            for t, g, x0, y0, x1, y1 in texts:
                if g.startswith("person:"):
                    i = int(g[7:])
                    assert t == names[i], (s, t)
                    where[i] = ((x0 + x1) / 2, (y0 + y1) / 2)
            assert sorted(where) == list(range(len(people)))
            assert styles == {str(i): q["sex"] for i, q in enumerate(people)}, s  # each box drawn as a girl's or a boy's
            ys = {g: [where[i][1] for i, q in enumerate(people) if q["gen"] == g] for g in (1, 2, 3)}
            assert min(ys[1]) > max(ys[2]) and min(ys[2]) > max(ys[3]), s  # the generations in rows, oldest on top
            words = [t for t, *_ in texts]
            assert "married" in words
            gp = [i for i, q in enumerate(people) if q["gen"] == 1]
            mid = (where[gp[0]][0] + where[gp[1]][0]) / 2
            want = {f"couple>{i}" for i, q in enumerate(people) if q["gen"] == 2}
            want |= {f"{q['parent']}>{i}" for i, q in enumerate(people) if q["gen"] == 3}
            assert set(links) == want, (s, set(links) ^ want)
            for k, xy in links.items():
                a, b = k.split(">")
                top_x = mid if a == "couple" else where[int(a)][0]
                assert abs(xy[0][0] - top_x) < 0.02 and abs(xy[-1][0] - where[int(b)][0]) < 0.02, (s, k)
                assert xy[0][1] > xy[-1][1]
    assert min(levels.values()) > 300
    assert min(rels[k] for k in ("aunt", "uncle", "cousin", "sister", "brother")) > 40, rels


# --- admin_ladder_p -------------------------------------------------------------------------------

# Rwanda's levels of local government, smallest first, after the 2006 territorial reform (Organic Law No. 29/2005):
# the level as the chart names it, its leader, and how many there are in Rwanda (MINALOC; NISR, 2012 census).
LADDER = [("Umudugudu (village)", "a village leader", 14837, "villages"),
          ("Akagari (cell)", "an Executive Secretary", 2148, "cells"),
          ("Umurenge (sector)", "an Executive Secretary", 416, "sectors"),
          ("Akarere (district)", "a Mayor", 30, "districts"),
          ("Intara (province) or Kigali City", None, 4, "provinces"),
          ("Igihugu (country)", "the President", 1, None)]
LEVEL = [r[0] for r in LADDER]


def test_admin_ladder_p():
    m = fam("admin_ladder_p")
    levels, steps = Counter(), Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        levels[p["level"]] += 1
        blanks = p["blanks"]
        assert len(blanks) == (1 if p["level"] == "lower" else 2) and blanks == sorted(blanks)
        assert all(b - a >= 2 for a, b in zip(blanks, blanks[1:])), s  # never two blanks side by side
        letter = dict(zip("AB", blanks))
        shown = [i for i in range(6) if i not in blanks]
        seen = set()
        for q in qs:
            st = q.stem
            got = re.search(r"Which level goes in box ([AB])\?$", st)
            if got:
                key = LEVEL[letter[got.group(1)]]
                assert picked(q) == key, (s, st, q.options)
                assert all(o in LEVEL and o != key for o in wrong(q))
                seen.add("blank")
                continue
            got = re.search(r"Which level comes just (above|below) the (.+?) on the chart\?$", st)
            if got:
                way, x = got.groups()
                i = LEVEL.index(x)
                j = i + 1 if way == "above" else i - 1
                assert i in shown and j in shown, (s, st)  # both printed: the chart answers it
                assert picked(q) == LEVEL[j] and all(o in LEVEL and o != LEVEL[j] for o in wrong(q))
                steps[way] += 1
                seen.add("step")
                continue
            got = re.search(r"Which is the (smallest|largest) unit on the chart\?$", st)
            if got:
                j = 0 if got.group(1) == "smallest" else 5
                assert j in shown and picked(q) == LEVEL[j]
                assert all(o in LEVEL and o != LEVEL[j] for o in wrong(q))
                steps[got.group(1)] += 1
                seen.add("step")
                continue
            got = re.search(r"Who leads (?:an?|the) (.+?)\?$", st)
            if got:
                i = LEVEL.index(got.group(1))
                assert i in shown and LADDER[i][1], (s, st)
                key = LADDER[i][1]
                assert picked(q) == key and all(o != key for o in wrong(q)), (s, q.options)
                assert all(o in {r[1] for r in LADDER if r[1]} | {"a Governor"} for o in q.options)
                seen.add("leader")
                continue
            got = re.search(r"How many (\w+) are there in Rwanda\?$", st)
            if got and "more" not in st:
                i = next(k for k, r in enumerate(LADDER) if r[3] == got.group(1))
                assert p["level"] == "upper" and i in shown and q.answer == str(LADDER[i][2]), (s, st)
                seen.add("count")
                continue
            got = re.search(r"How many more (\w+) than (\w+) are there in Rwanda\?$", st)
            if got:
                a, b = (next(k for k, r in enumerate(LADDER) if r[3] == g) for g in got.groups())
                assert p["level"] == "upper" and a in shown and b in shown, (s, st)
                assert q.answer == str(LADDER[a][2] - LADDER[b][2]) and LADDER[a][2] > LADDER[b][2]
                seen.add("count")
                continue
            pytest.fail(f"seed {s}: an unexpected question {st}")
        assert seen == ({"blank", "step", "leader"} | ({"count"} if p["level"] == "upper" else set())), (s, seen)
        if s <= DRAWN:
            fig = m.draw(p)
            texts = boxes(fig)
            plt.close(fig)
            rows = {}
            for t, g, x0, y0, x1, y1 in texts:
                if g.startswith("level:"):
                    i = int(g[6:])
                    assert t.replace("\n", " ") == LEVEL[i] and i in shown, (s, t)
                    rows[i] = (y0 + y1) / 2
                elif g.startswith("blank:"):
                    assert t == g[6:] and g[6:] in letter
                    rows[letter[g[6:]]] = (y0 + y1) / 2
            assert sorted(rows) == list(range(6))
            assert [rows[i] for i in range(6)] == sorted(rows[i] for i in range(6)), s  # the smallest at the bottom
            words = " ".join(t for t, *_ in texts)
            for i in shown:
                if LADDER[i][1]:
                    leader = LADDER[i][1].split(" ", 1)[1]
                    assert any(g == f"leader:{i}" and leader in t for t, g, *_ in texts), (s, i)
                if p["level"] == "upper" and LADDER[i][3]:
                    assert f"{fr(LADDER[i][2])} {LADDER[i][3]}" in words, (s, i)
            for i in blanks:
                assert not any(g in (f"leader:{i}", f"count:{i}") for t, g, *_ in texts), (s, "a blank box gives itself away")
    assert min(levels.values()) > 300 and min(steps.values()) > 80


# --- budget_p -------------------------------------------------------------------------------------

def test_budget_p():
    m = fam("budget_p")
    levels, verdicts = Counter(), Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        levels[p["level"]] += 1
        ins, outs = p["money_in"], p["money_out"]
        step = 500 if p["level"] == "lower" else 100
        assert all(a > 0 and a % step == 0 for _, a in ins + outs), s
        if p["level"] == "lower":
            assert len(ins) == 2 and 2 <= len(outs) <= 3
        else:
            assert len(ins) == 3 and 3 <= len(outs) <= 4
        total_in = sum(a for _, a in ins)
        total_out = sum(a for _, a in outs)
        saved = total_in - total_out
        assert saved >= 500, s
        item, cost = p["item"]
        assert cost % step == 0 and abs(cost - saved) >= 500, (s, cost, saved)  # plainly enough or plainly not
        seen = set()
        for q in qs:
            st = q.stem
            if re.search(r"How much money comes in altogether(?: in \w+)?\?$", st):
                assert q.answer == str(total_in) and f"{fr(total_in)} Frw" in q.accepted
                seen.add("in")
            elif re.search(r"How much money goes out altogether(?: in \w+)?\?$", st):
                assert q.answer == str(total_out) and f"{fr(total_out)} Frw" in q.accepted
                seen.add("out")
            elif re.search(r"How much money is saved\?$", st):
                assert q.answer == str(saved), (s, q.answer, saved)
                seen.add("saved")
            elif re.search(r"Is the money saved enough to buy (.+?) for ([\d ]+) Frw\?$", st):
                got = re.search(r"Is the money saved enough to buy (.+?) for ([\d ]+) Frw\?$", st)
                assert got.group(1) == item and int(got.group(2).replace(" ", "")) == cost
                assert got.group(2) == fr(cost)
                key = (f"Yes. {fr(saved - cost)} Frw is left over." if saved > cost
                       else f"No. {fr(cost - saved)} Frw more is needed.")
                assert picked(q) == key, (s, q.options, key)
                assert len(q.options) >= 3 and key not in wrong(q)
                verdicts[saved > cost] += 1
                seen.add("enough")
            else:
                pytest.fail(f"seed {s}: an unexpected question {st}")
        assert seen == {"in", "out", "saved", "enough"}, (s, seen)
        if s <= DRAWN:
            fig = m.draw(p)
            texts = boxes(fig)
            plt.close(fig)
            words = [t for t, *_ in texts]
            for label, a in ins + outs:
                assert label in words and f"{fr(a)} Frw" in words, (s, label, a)
            assert "Money in" in words and "Money out" in words
            assert not any(g == "total" and t.strip() not in ("", "?") for t, g, *_ in texts)  # the totals are asked
    assert min(levels.values()) > 300 and min(verdicts.values()) > 300
