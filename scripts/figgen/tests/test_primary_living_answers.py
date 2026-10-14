"""Answers of the Primary living things and ICT families (P3s, Task 3), recomputed from each figure's params over
1,000 seeds.

Nothing here calls a family's own helpers to work out a key. Each animal's box comes from this file's own table of
what a Primary teacher agrees an animal has, and an animal whose place could be argued is never placed or offered;
a food chain is read from its links, each one a real feeding relation listed here; the pulse rates, heights and
tallies are worked out from the numbers drawn; the teeth from the tooth formula of a child's or an adult's jaw; and
the robot is walked square by square, turning to its own left or right (Review Focus 4 and 5).
"""
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
LIVING = ["carroll_sort_p", "food_chain_p", "body_data_p", "teeth_p", "grid_robot_p"]
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


@pytest.mark.parametrize("fid", LIVING)
def test_living_family_is_worded_and_linked(fid):
    m = fam(fid)
    subject = "computing" if fid == "grid_robot_p" else "science"
    assert m.SUBJECT == subject and m.BANDS == ("P",)
    assert m.CONCEPTS and all(c.startswith(f"{subject}.") for c in m.CONCEPTS)
    assert m.NEEDS
    if fid == "grid_robot_p":
        assert m.ALSO and all(c.startswith("science.") for c in m.ALSO)  # Rwanda SET teaches programming
    if STORE.exists():
        db = sqlite3.connect(f"file:{STORE}?mode=ro", uri=True)
        known = {r[0] for r in db.execute("SELECT id FROM concepts")}
        assert set(m.CONCEPTS) | set(getattr(m, "ALSO", ())) <= known, sorted(set(m.CONCEPTS) - known)
    assert own_wordings(m) >= 27, fid
    for seed in range(1, 80):
        p, qs = run(m, seed)
        assert p["band"] == "P"
        first = next((n for n in NAMES if qs[0].stem.startswith(n)), None)
        assert first, (fid, seed, qs[0].stem)
        for q in qs:
            for owner in re.findall(r"\b(" + "|".join(NAMES) + r")'s\b", q.stem):
                assert owner == first or fid == "body_data_p", (fid, seed, q.stem)  # pupils in a chart are named
            # short sentences, for a child of eight
            for sentence in re.split(r"(?<=[.?!])\s+", q.stem):
                assert len(sentence.split()) <= 26, (fid, seed, sentence)


# --- carroll_sort_p --------------------------------------------------------------------------------

# What a Primary teacher agrees each animal has. None: arguable, so the animal is never sorted by it (a fish farm,
# a puff adder that gives birth to live young, a chicken that eats worms and grain).
HAS = {
    "cow": dict(legs=True, wings=False, backbone=True, farm=True, eggs=False, meat=False),
    "goat": dict(legs=True, wings=False, backbone=True, farm=True, eggs=False, meat=False),
    "fish": dict(legs=False, wings=False, backbone=True, farm=None, eggs=True, meat=None),
    "frog": dict(legs=True, wings=False, backbone=True, farm=False, eggs=True, meat=True),
    "snake": dict(legs=False, wings=False, backbone=True, farm=False, eggs=None, meat=True),
    "chicken": dict(legs=True, wings=True, backbone=True, farm=True, eggs=True, meat=None),
    "duck": dict(legs=True, wings=True, backbone=True, farm=True, eggs=True, meat=None),
    "butterfly": dict(legs=True, wings=True, backbone=False, farm=False, eggs=True, meat=False),
    "spider": dict(legs=True, wings=False, backbone=False, farm=False, eggs=True, meat=True),
    "earthworm": dict(legs=False, wings=False, backbone=False, farm=None, eggs=None, meat=False),
    "crocodile": dict(legs=True, wings=False, backbone=True, farm=False, eggs=True, meat=True),
    "hippo": dict(legs=True, wings=False, backbone=True, farm=False, eggs=False, meat=False),
}
# The headings as printed, and how a stem names a group of animals.
HEADING = {"Has legs": ("legs", True), "No legs": ("legs", False), "Has wings": ("wings", True), "No wings": ("wings", False),
           "Has a backbone": ("backbone", True), "No backbone": ("backbone", False), "Farm animal": ("farm", True),
           "Not a farm animal": ("farm", False), "Lays eggs": ("eggs", True), "Does not lay eggs": ("eggs", False),
           "Eats other animals": ("meat", True), "Does not eat other animals": ("meat", False)}
GROUP = {"have legs": ("legs", True), "have no legs": ("legs", False), "have wings": ("wings", True),
         "have no wings": ("wings", False), "have a backbone": ("backbone", True), "have no backbone": ("backbone", False),
         "are farm animals": ("farm", True), "are not farm animals": ("farm", False), "lay eggs": ("eggs", True),
         "do not lay eggs": ("eggs", False), "eat other animals": ("meat", True), "do not eat other animals": ("meat", False)}


def _value(label: str):
    return HEADING[label.replace("\n", " ")]


def carroll_cells(p, fig):
    """Each lettered box's two values, read off the drawing: a Carroll box by the column and row headings it sits
    under, a Venn part by the circles it is inside. Also checks every name sits in the box it is listed in."""
    texts = boxes(fig)
    ax = fig.axes[0]
    centre = {g: ((x0 + x1) / 2, (y0 + y1) / 2) for _, g, x0, y0, x1, y1 in texts}
    cells = {}
    if p["kind"] == "carroll":
        cols = [(centre[g][0], _value(t)) for t, g, *_ in texts if g.startswith("col:")]
        rows = [(centre[g][1], _value(t)) for t, g, *_ in texts if g.startswith("row:")]
        assert len(cols) == len(rows) == 2

        def where(x, y):
            return (min(cols, key=lambda c: abs(c[0] - x))[1], min(rows, key=lambda r: abs(r[0] - y))[1])

        for letter in "ABCD":
            cells[letter] = where(*centre[f"letter:{letter}"])
        for t, g, x0, y0, x1, y1 in texts:
            if g.startswith("animal:") or g.startswith("mark:"):
                letter = g.split(":")[1]
                assert where(x0, y0) == where(x1, y1) == cells[letter], (p, t)
        values = {letter: (a[1], b[1]) for letter, (a, b) in cells.items()}
        attrs = (cols[0][1][0], rows[0][1][0])
        assert {c[1][0] for c in cols} == {attrs[0]} and {r[1][0] for r in rows} == {attrs[1]}
    else:
        from matplotlib.patches import Circle
        circles = [c for c in ax.patches if isinstance(c, Circle) and (c.get_gid() or "").startswith("set:")]
        assert len(circles) == 2
        sets = [(c.center, c.radius, _value(c.get_gid()[4:])) for c in circles]
        assert all(v[1] for *_, v in sets)  # a circle holds the animals that have something

        def inside(x, y):
            return tuple(((x - cx) ** 2 + (y - cy) ** 2) ** 0.5 < r for (cx, cy), r, _ in sets)

        for letter in "ABCD":
            cells[letter] = inside(*centre[f"letter:{letter}"])
        for t, g, x0, y0, x1, y1 in texts:
            if g.startswith("animal:") or g.startswith("mark:"):
                letter = g.split(":")[1]
                for x, y in ((x0, y0), (x0, y1), (x1, y0), (x1, y1)):
                    assert inside(x, y) == cells[letter], (p, t, (x, y))
        values = cells
        attrs = (sets[0][2][0], sets[1][2][0])
    assert sorted(values.values()) == sorted([(a, b) for a in (True, False) for b in (True, False)])
    return attrs, values


def test_carroll_sort_p():
    m = fam("carroll_sort_p")
    kinds, levels, asked = Counter(), Counter(), Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        kinds[p["kind"]] += 1
        levels[p["level"]] += 1
        a, b = p["attrs"]
        placed = {name: letter for letter, names in p["placed"].items() for name in names}
        assert 6 <= len(placed) <= 9, (s, placed)
        assert len(p["marks"]) == (1 if p["level"] == "lower" else 2)
        if s <= DRAWN:
            fig = m.draw(p)
            attrs, value = carroll_cells(p, fig)
            words = [t for t, *_ in boxes(fig)]
            plt.close(fig)
            assert set(attrs) == {a, b}
            assert words.count("?") == len(p["marks"])
            value = {k: (v[0], v[1]) if attrs == (a, b) else (v[1], v[0]) for k, v in value.items()}
        else:
            value = p["boxes"] and {k: tuple(v) for k, v in p["boxes"].items()}
        assert {k: tuple(v) for k, v in p["boxes"].items()} == value, s
        # every animal sits in its own box, by the teacher's table, and none is arguable
        for name, letter in placed.items():
            assert HAS[name][a] is not None and HAS[name][b] is not None, (s, name)
            assert (HAS[name][a], HAS[name][b]) == value[letter], (s, name, letter)
        seen = set()
        for q in qs:
            got = re.search(r"missing from (?:box|part) ([A-D])\b", q.stem)
            if got:
                letter = got.group(1)
                assert letter in p["marks"], s
                key = picked(q)
                assert key not in placed and (HAS[key][a], HAS[key][b]) == value[letter], (s, key, letter)
                assert len(q.options) >= 3
                for o in wrong(q):
                    assert o not in placed and o in HAS, (s, o)
                    assert HAS[o][a] is not None and HAS[o][b] is not None, (s, o)  # never an arguable animal
                    assert (HAS[o][a], HAS[o][b]) != value[letter], (s, o)
                seen.add("missing")
                continue
            got = re.search(r"How many animals are in (?:box|part) ([A-D])\?", q.stem)
            if got:
                letter = got.group(1)
                assert letter not in p["marks"]
                assert q.answer == str(len(p["placed"][letter])), s
                seen.add("count")
                continue
            got = re.search(r"How many animals in the diagram (.+?)\?", q.stem)
            if got:
                attr, val = GROUP[got.group(1)]
                assert attr in (a, b)
                letters = [k for k, v in value.items() if v[(a, b).index(attr)] == val]
                assert not set(letters) & set(p["marks"]), s  # no "?" in the group counted
                assert q.answer == str(sum(1 for n in placed if HAS[n][attr] == val)), (s, q.stem)
                seen.add("count")
                continue
            got = re.search(r"^An? (\w+) is added to", q.stem)
            if got:
                name = got.group(1)
                assert name not in placed and HAS[name][a] is not None and HAS[name][b] is not None
                key = next(k for k, v in value.items() if v == (HAS[name][a], HAS[name][b]))
                assert picked(q) == key and q.options == ["A", "B", "C", "D"], (s, q.options)
                seen.add("new")
                asked[key in p["marks"]] += 1
                continue
            pytest.fail(f"seed {s}: an unexpected question {q.stem}")
        assert seen == {"missing", "count", "new"}, (s, seen)
    assert min(kinds.values()) > 300 and set(kinds) == {"carroll", "venn"}
    assert min(levels.values()) > 300


# --- food_chain_p ----------------------------------------------------------------------------------

# Real feeding relations, (eaten, eater), as a Primary book draws them.
REAL = {("grass", "rabbit"), ("rabbit", "fox"), ("maize", "grasshopper"), ("grasshopper", "bird"), ("bird", "hawk"),
        ("grass", "grasshopper"), ("grasshopper", "frog"), ("frog", "snake"), ("maize", "rat"), ("rat", "snake"),
        ("snake", "hawk"), ("grass", "zebra"), ("zebra", "lion"), ("grass", "impala"), ("impala", "leopard"),
        ("impala", "lion"), ("algae", "tilapia"), ("tilapia", "heron"), ("cabbage", "caterpillar"),
        ("caterpillar", "chicken"), ("leaves", "caterpillar"), ("caterpillar", "chameleon"), ("chameleon", "snake"),
        ("grasshopper", "chicken"), ("chicken", "hawk"), ("rat", "owl"), ("leaves", "monkey"), ("monkey", "eagle"),
        ("grasshopper", "lizard"), ("lizard", "eagle"), ("beans", "caterpillar"), ("caterpillar", "bird"),
        ("algae", "tadpole"), ("tadpole", "heron"), ("tilapia", "kingfisher"), ("snake", "eagle"), ("maize", "chicken"),
        ("lizard", "hawk")}
PLANTS = {"grass", "maize", "algae", "cabbage", "leaves", "beans"}
# How a stem names them, as many: "the number of rabbits", "the amount of grass".
MANY = {"rabbits": "rabbit", "foxes": "fox", "grasshoppers": "grasshopper", "birds": "bird", "hawks": "hawk",
        "frogs": "frog", "snakes": "snake", "rats": "rat", "zebras": "zebra", "lions": "lion", "impala": "impala",
        "leopards": "leopard", "tilapia": "tilapia", "herons": "heron", "caterpillars": "caterpillar",
        "chickens": "chicken", "chameleons": "chameleon", "owls": "owl", "monkeys": "monkey", "eagles": "eagle",
        "lizards": "lizard", "tadpoles": "tadpole", "kingfishers": "kingfisher", "grass": "grass", "maize": "maize",
        "algae": "algae", "cabbages": "cabbage", "leaves": "leaves", "beans": "beans"}


def test_food_chain_p():
    m = fam("food_chain_p")
    kinds = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        links = [tuple(l) for l in p["links"]]
        assert set(links) <= REAL, (s, set(links) - REAL)
        names = {n for l in links for n in l}
        foods = {n: {f for f, e in links if e == n} for n in names}
        eaters = {n: {e for f, e in links if f == n} for n in names}
        producers = {n for n in names if not foods[n]}
        assert producers <= PLANTS and not (names - producers) & PLANTS, s
        kinds[p["kind"]] += 1
        if p["kind"] == "chain":
            assert p["level"] == "lower" and 3 <= len(names) <= 4 and len(links) == len(names) - 1
            assert all(len(foods[n]) <= 1 and len(eaters[n]) <= 1 for n in names) and len(producers) == 1, s
        else:
            assert p["level"] == "upper" and 5 <= len(names) <= 6, s
        seen = set()
        for q in qs:
            st = q.stem
            if "How many consumers" in st:
                assert q.answer == str(len(names - producers)), s
                seen.add("consumers")
            elif "producer" in st:
                key = picked(q)
                assert key in producers, (s, key)
                for o in wrong(q):
                    assert o not in producers, (s, o)
                seen.add("producer")
            elif re.search(r"what eats the (.+?)\?", st):
                x = re.search(r"what eats the (.+?)\?", st).group(1)
                assert len(eaters[x]) == 1 and picked(q) in eaters[x], (s, st, q.options)
                assert not set(wrong(q)) & eaters[x]
                seen.add("eats")
            elif re.search(r"If all the (.+?) died, what would happen to the (?:number|amount) of (?:the )?(.+?)\?", st):
                z, y = (MANY[g] for g in re.search(r"If all the (.+?) died, what would happen to the (?:number|amount) of (?:the )?(.+?)\?", st).groups())
                assert p["kind"] == "chain"
                if (z, y) in links:
                    key = "It would go down."
                else:
                    assert (y, z) in links, (s, st)  # only next to it in the chain: unambiguous
                    key = "It would go up."
                assert picked(q) == key, (s, st, q.options)
                seen.add("gone")
            elif re.search(r"If all the (.+?) in this food web died, which animal would have nothing left to eat\?", st):
                z = MANY[re.search(r"If all the (.+?) in this food web died", st).group(1)]
                starving = [n for n in names if foods[n] == {z}]
                assert starving == [picked(q)], (s, st, q.options)
                assert all(foods[o] != {z} for o in wrong(q) if o in names)
                seen.add("gone")
            elif re.search(r"How many different living things does the (.+?) eat", st):
                y = re.search(r"How many different living things does the (.+?) eat", st).group(1)
                assert len(foods[y]) >= 2 and q.answer == str(len(foods[y])), s
                seen.add("gone")
            else:
                pytest.fail(f"seed {s}: an unexpected question {st}")
            if q.kind == "mcq":
                assert len(q.options) >= 3
        assert seen == {"consumers", "producer", "eats", "gone"}, (s, seen)
    assert kinds["chain"] > 300 and kinds["web"] > 300


def inside(pt, box, margin=1.0) -> bool:
    return box.x0 + margin < pt[0] < box.x1 - margin and box.y0 + margin < pt[1] < box.y1 - margin


def segment_hits(p0, p1, box, margin=1.0, steps=80) -> bool:
    """Whether a straight segment between two pixel points passes through a box (as the food web's layout test)."""
    return any(inside((p0[0] + (p1[0] - p0[0]) * k / steps, p0[1] + (p1[1] - p0[1]) * k / steps), box, margin)
               for k in range(steps + 1))


def test_food_chain_p_arrows_show_and_say_what_they_mean():
    m = fam("food_chain_p")
    for s in range(1, 81):
        p = m.sample(random.Random(s))
        fig = m.draw(p)
        fig.canvas.draw()
        renderer = fig.canvas.get_renderer()
        ax = fig.axes[0]
        words = " ".join(t.get_text() for t in ax.texts)
        assert "is eaten by" in words or "gives energy to" in words, s
        named = {t.get_gid()[4:]: t.get_bbox_patch().get_window_extent(renderer) for t in ax.texts
                 if (t.get_gid() or "").startswith("box:")}
        arrows = [a for a in ax.texts if (a.get_gid() or "").startswith("edge:")]
        assert set(named) == {n for l in p["links"] for n in l}
        assert sorted(a.get_gid()[5:] for a in arrows) == sorted(f"{f}>{e}" for f, e in p["links"]), s
        for a in arrows:
            food, eater = a.get_gid()[5:].split(">")
            start, end = ax.transData.transform(a.xyann), ax.transData.transform(a.xy)
            for name, box in named.items():
                assert not inside(end, box), (s, food, eater, name)
                if name not in (food, eater):
                    assert not segment_hits(start, end, box), (s, food, eater, name)
            # the head is at the eater's end
            assert _far(end, named[eater]) < _far(end, named[food]), (s, food, eater)
        plt.close(fig)


def _far(pt, box) -> float:
    return ((pt[0] - (box.x0 + box.x1) / 2) ** 2 + (pt[1] - (box.y0 + box.y1) / 2) ** 2) ** 0.5


# --- body_data_p -----------------------------------------------------------------------------------

def test_body_data_p():
    m = fam("body_data_p")
    kinds = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        kinds[p["kind"]] += 1
        seen = set()
        if p["kind"] == "pulse":
            names, before, after, step = p["pupils"], p["before"], p["after"], p["step"]
            assert len(set(names)) == len(names) >= 4
            assert all(v % step == 0 for v in before + after) and step in (5, 10)
            assert all(60 <= b <= 105 and b + 15 <= a <= 170 for b, a in zip(before, after)), s
            rise = [a - b for a, b in zip(after, before)]
            top = sorted(rise, reverse=True)
            assert top[0] - top[1] >= 10, (s, rise)  # one pupil plainly went up the most
            if s <= DRAWN:
                fig = m.draw(p)
                ax = fig.axes[0]
                lines = {round(float(v), 6) for v in list(ax.get_yticks()) + list(ax.get_yticks(minor=True))}
                bars = sorted(round(float(r.get_height()), 6) for r in ax.patches if (r.get_gid() or "").startswith("bar:"))
                plt.close(fig)
                assert bars == sorted(float(v) for v in before + after), s
                assert all(float(v) in lines for v in before + after), s
            for q in qs:
                st = q.stem
                if got := re.search(r"What was (\w+)'s pulse after exercise", st):
                    assert q.answer == str(after[names.index(got.group(1))])
                    seen.add("read")
                elif got := re.search(r"did (\w+)'s pulse go up", st):
                    i = names.index(got.group(1))
                    assert q.answer == str(after[i] - before[i]) and after[i] > before[i]
                    seen.add("difference")
                elif "went up the most" in st:
                    assert picked(q) == names[rise.index(top[0])]
                    seen.add("most")
                elif got := re.search(r"higher than (\d+) beats per minute after exercise", st):
                    x = int(got.group(1))
                    assert x % step == 0 and x not in after
                    assert q.answer == str(sum(1 for a in after if a > x)) and 0 < int(q.answer) < len(after)
                    seen.add("more than")
                else:
                    pytest.fail(f"seed {s}: an unexpected question {st}")
        elif p["kind"] == "height":
            names, heights = p["pupils"], p["heights"]
            assert len(set(names)) == len(names) >= 5 and len(set(heights)) == len(heights)
            assert all(100 <= h <= 160 for h in heights)
            tall = sorted(heights, reverse=True)
            assert tall[0] - tall[1] >= 2, s
            if s <= DRAWN:
                fig = m.draw(p)
                words = [t for t, *_ in boxes(fig)]
                plt.close(fig)
                for n, h in zip(names, heights):
                    assert n in words and str(h) in words, (s, n, h)
            for q in qs:
                st = q.stem
                if got := re.search(r"How tall is (\w+)", st):
                    assert q.answer == str(heights[names.index(got.group(1))])
                    seen.add("read")
                elif "tallest" in st:
                    assert picked(q) == names[heights.index(tall[0])]
                    seen.add("most")
                elif got := re.search(r"taller than (\d+) cm", st):
                    x = int(got.group(1))
                    assert x not in heights
                    assert q.answer == str(sum(1 for h in heights if h > x)) and 0 < int(q.answer) < len(heights)
                    seen.add("more than")
                elif got := re.search(r"How much taller is (\w+) than (\w+)", st):
                    i, j = names.index(got.group(1)), names.index(got.group(2))
                    assert q.answer == str(heights[i] - heights[j]) and heights[i] > heights[j]
                    seen.add("difference")
                else:
                    pytest.fail(f"seed {s}: an unexpected question {st}")
        else:
            spans, counts = p["spans"], p["counts"]
            assert spans == list(range(spans[0], spans[0] + len(spans))) and 11 <= spans[0] and spans[-1] <= 18
            assert all(1 <= c <= 12 for c in counts)
            most = sorted(counts, reverse=True)
            assert most[0] > most[1], s
            if s <= DRAWN:
                fig = m.draw(p)
                gids = [ln.get_gid() for ln in fig.axes[0].lines if (ln.get_gid() or "").startswith("tally:")]
                strokes = Counter(g.split(":")[1] for g in gids)
                slants = Counter(g.split(":")[1] for g in gids if g.endswith(":gate"))
                plt.close(fig)
                for sp, c in zip(spans, counts):
                    assert strokes[str(sp)] == c, (s, sp, c, strokes)  # one stroke a pupil, the fifth across four
                    assert slants[str(sp)] == c // 5, (s, sp)
            for q in qs:
                st = q.stem
                if got := re.search(r"hand span of (\d+) cm\?", st):
                    assert q.answer == str(counts[spans.index(int(got.group(1)))])
                    seen.add("read")
                elif "most common" in st:
                    assert picked(q) == f"{spans[counts.index(most[0])]} cm"
                    seen.add("most")
                elif "altogether" in st:
                    assert q.answer == str(sum(counts))
                    seen.add("total")
                elif got := re.search(r"longer than (\d+) cm", st):
                    x = int(got.group(1))
                    assert q.answer == str(sum(c for sp, c in zip(spans, counts) if sp > x)) and int(q.answer) > 0
                    seen.add("more than")
                else:
                    pytest.fail(f"seed {s}: an unexpected question {st}")
        assert len(seen) == len(qs) >= 4, (s, seen)
    assert min(kinds.values()) > 250 and len(kinds) == 3


# --- teeth_p ---------------------------------------------------------------------------------------

# One jaw, from one end of the arch to the other: a child's 10 milk teeth, an adult's 16.
JAW = {"child": ["molar", "molar", "canine", "incisor", "incisor"],
       "adult": ["molar", "molar", "molar", "premolar", "premolar", "canine", "incisor", "incisor"]}
JOB = {"biting": {"incisor"}, "tearing": {"canine"}, "grinding": {"premolar", "molar"}}


def test_teeth_p():
    m = fam("teeth_p")
    ages = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        ages[p["age"]] += 1
        teeth = JAW[p["age"]] + JAW[p["age"]][::-1]
        assert p["teeth"] == teeth and "missing" not in p, s  # every tooth is there: nothing to wonder about (p3s-blind)
        letters = p["letters"]
        lettered = [teeth[i] for i in letters.values()]
        assert len(set(lettered)) == len(lettered) == 3, s  # one of each kind: one answer for each job
        assert len(set(lettered) & {"premolar", "molar"}) == 1, s
        if s <= DRAWN:
            fig = m.draw(p)
            ax = fig.axes[0]
            drawn = {int(g.split(":")[1]): g.split(":")[2] for g in (pa.get_gid() or "" for pa in ax.patches)
                     if g.startswith("tooth:")}
            words = " ".join(t for t, *_ in boxes(fig))
            plt.close(fig)
            assert drawn == dict(enumerate(teeth)), s
            for kind in set(teeth):
                assert kind.capitalize() in words, (s, kind)  # the key names every kind drawn
            for job in JOB:
                assert job in words, (s, job)
        seen = set()
        for q in qs:
            st = q.stem
            assert "fallen" not in st and "missing" not in st and "lost" not in st, st
            if got := re.search(r"Which letter shows a tooth (?:used )?for (\w+)", st):
                kinds = JOB[got.group(1)]
                assert teeth[letters[picked(q)]] in kinds, (s, st)
                assert all(teeth[letters[o]] not in kinds for o in wrong(q))
                seen.add("job")
            elif got := re.search(r"What kind of tooth is tooth ([A-D])\?", st):
                assert picked(q) == teeth[letters[got.group(1)]]
                assert set(q.options) <= set(teeth) and len(q.options) == len(set(teeth))
                seen.add("kind")
            elif got := re.search(r"How many teeth in this jaw are the same kind as tooth ([A-D])\?", st):
                # the kind is read off the drawing (its letter), then counted, lettered tooth included
                assert q.answer == str(teeth.count(teeth[letters[got.group(1)]])), (s, st)
                seen.add("count")
            else:
                pytest.fail(f"seed {s}: an unexpected question {st}")
        assert seen == {"job", "kind", "count"}, (s, seen)
    assert min(ages.values()) > 300


def _outline(pa):
    """A patch's corners in data coordinates."""
    return [tuple(v) for v in pa.get_patch_transform().transform(pa.get_path().vertices)]


def _middle(pts):
    """The middle of a shape's bounding box (a closed outline repeats its first corner, so a mean is lopsided)."""
    xs, ys = [x for x, _ in pts], [y for _, y in pts]
    return (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2


def test_teeth_p_are_drawn_as_the_key_shows_them_in_a_mirrored_jaw():
    """Every tooth is exactly its key's shape, not turned (canines read as skewed parallelograms beside the key's
    diamond); the two halves of the jaw mirror each other; and each leader line ends on its own tooth (one ended on
    the gum). From the p3s-blind review."""
    from matplotlib.path import Path as MPath
    m = fam("teeth_p")
    for s in range(1, DRAWN + 1):
        p = m.sample(random.Random(s))
        fig = m.draw(p)
        ax = fig.axes[0]
        patches = {pa.get_gid(): pa for pa in ax.patches if pa.get_gid()}
        lines = {ln.get_gid(): ln for ln in ax.lines if ln.get_gid()}
        plt.close(fig)
        teeth = p["teeth"]
        n = len(teeth)
        shape = {}
        for kind in set(teeth):
            pts = _outline(patches[f"key:{kind}"])
            cx, cy = _middle(pts)
            shape[kind] = [(round(x - cx, 6), round(y - cy, 6)) for x, y in pts]
        centre = {}
        for i, kind in enumerate(teeth):
            pts = _outline(patches[f"tooth:{i}:{kind}"])
            cx, cy = _middle(pts)
            assert [(round(x - cx, 6), round(y - cy, 6)) for x, y in pts] == shape[kind], (s, i, kind)
            centre[i] = (cx, cy)
        for i in range(n):
            (x0, y0), (x1, y1) = centre[i], centre[n - 1 - i]
            assert abs(x0 + x1) < 1e-6 and abs(y0 - y1) < 1e-6, (s, i)  # mirrored about the jaw's middle
        # no two teeth touch
        for i in range(n - 1):
            a, b = MPath(_outline(patches[f"tooth:{i}:{teeth[i]}"])), MPath(_outline(patches[f"tooth:{i + 1}:{teeth[i + 1]}"]))
            assert not a.intersects_path(b, filled=True), (s, i)
        for letter, i in p["letters"].items():
            xs, ys = lines[f"leader:{letter}"].get_data()
            tooth = MPath(_outline(patches[f"tooth:{i}:{teeth[i]}"]))
            assert tooth.contains_point((xs[-1], ys[-1])), (s, letter)  # it ends on its tooth
            for j, kind in enumerate(teeth):
                if j != i:  # and passes over no other tooth
                    other = MPath(_outline(patches[f"tooth:{j}:{kind}"]))
                    seg = MPath([(xs[0], ys[0]), (xs[-1], ys[-1])])
                    assert not other.intersects_path(seg, filled=True), (s, letter, j)


# --- grid_robot_p ----------------------------------------------------------------------------------

STEP = {"N": (0, 1), "E": (1, 0), "S": (0, -1), "W": (-1, 0)}
LEFT = {"N": "W", "W": "S", "S": "E", "E": "N"}
RIGHT = {v: k for k, v in LEFT.items()}


def walk(start, facing, program, absolute=False):
    """Every square the robot stands on, in order, and the way it faces at the end. A turn is made on the spot, to
    the robot's own left or right; `absolute` is the slip of turning to the page's left or right instead."""
    x, y = start
    path = [(x, y)]
    for cmd in program:
        word, _, n = cmd.partition(" ")
        if cmd == "turn left":
            facing = "W" if absolute else LEFT[facing]
        elif cmd == "turn right":
            facing = "E" if absolute else RIGHT[facing]
        else:
            assert word == "forward" and n.isdigit(), cmd
            for _ in range(int(n)):
                x, y = x + STEP[facing][0], y + STEP[facing][1]
                path.append((x, y))
    return path, facing


def test_grid_robot_p():
    m = fam("grid_robot_p")
    modes, traps = Counter(), Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        n, start, facing, program = p["size"], tuple(p["start"]), p["facing"], p["program"]
        assert n in (5, 6) and facing in STEP
        grid = {(x, y) for x in range(n) for y in range(n)}
        modes[p["mode"]] += 1
        if p["mode"] == "trace":
            assert "?" not in program
            path, _ = walk(start, facing, program)
            assert set(path) <= grid, (s, path)  # never off the grid
            end = path[-1]
            assert end != start
            letters = {k: tuple(v) for k, v in p["letters"].items()}
            assert 3 <= len(letters) <= 4 and len(set(letters.values())) == len(letters) and start not in letters.values()
            slip, _ = walk(start, facing, program, absolute=True)
            assert slip[-1] != end, s  # turning to the page's right is a different answer (Review Focus 5)
            traps[slip[-1] in letters.values()] += 1
            seen = set()
            for q in qs:
                if "Which letter" in q.stem:
                    assert letters[picked(q)] == end, (s, q.options)
                    assert all(letters[o] != end for o in wrong(q))
                    assert q.options == sorted(letters)
                    seen.add("end")
                elif "How many squares" in q.stem:
                    assert q.answer == str(sum(int(c.split()[1]) for c in program if c.startswith("forward")))
                    assert q.answer == str(len(path) - 1)
                    seen.add("squares")
                else:
                    pytest.fail(f"seed {s}: an unexpected question {q.stem}")
            assert seen == {"end", "squares"}
        else:
            gap = program.index("?")
            assert program.count("?") == 1
            target = tuple(p["objects"][p["target"]])
            assert len({tuple(v) for v in p["objects"].values()}) == len(p["objects"]) and start not in [tuple(v) for v in p["objects"].values()]
            # the way it faces at the gap is not up the page: turning to the page's side is a different turn
            _, at_gap = walk(start, facing, program[:gap])
            assert at_gap != "N", s
            seen = set()
            for q in qs:
                if "Which block" in q.stem:
                    assert p["target"] in q.stem
                    fills = {o: walk(start, facing, program[:gap] + [o] + program[gap + 1:])[0] for o in q.options}
                    key = picked(q)
                    assert key.startswith("turn") and fills[key][-1] == target and set(fills[key]) <= grid, (s, key)
                    for o in wrong(q):
                        assert fills[o][-1] != target, (s, o)
                    seen.add("fill")
                elif "How many squares" in q.stem:
                    assert q.answer == str(sum(int(c.split()[1]) for c in program if c.startswith("forward")))
                    seen.add("squares")
                else:
                    pytest.fail(f"seed {s}: an unexpected question {q.stem}")
            assert seen == {"fill", "squares"}
    assert min(modes.values()) > 300
    assert traps[True] >= 0.6 * sum(traps.values()), traps  # the page-turn slip usually lands on a letter


def test_grid_robot_p_is_drawn_as_programmed():
    from matplotlib.patches import Polygon
    m = fam("grid_robot_p")
    for s in range(1, DRAWN + 1):
        p = m.sample(random.Random(s))
        fig = m.draw(p)
        ax = fig.axes[0]
        texts = boxes(fig)
        blocks = {g: t for t, g, *_ in texts if g.startswith("block:")}
        assert [blocks[f"block:{i}"] for i in range(len(p["program"]))] == p["program"], s
        centre = {g: ((x0 + x1) / 2, (y0 + y1) / 2) for _, g, x0, y0, x1, y1 in texts}
        for k, (x, y) in (p["letters"] if p["mode"] == "trace" else {}).items():
            cx, cy = centre[f"letter:{k}"]
            assert x <= cx <= x + 1 and y <= cy <= y + 1, (s, k)
        start = next(pa for pa in ax.patches if pa.get_gid() == "start")
        x0, y0 = start.get_xy()
        assert (round(x0), round(y0)) == tuple(p["start"])
        arrow = next(pa for pa in ax.patches if isinstance(pa, Polygon) and pa.get_gid() == "facing")
        pts = arrow.get_xy()
        cx, cy = p["start"][0] + 0.5, p["start"][1] + 0.5
        tip = max(pts, key=lambda v: (v[0] - cx) ** 2 + (v[1] - cy) ** 2)
        dx, dy = tip[0] - cx, tip[1] - cy
        way = ("E" if dx > 0 else "W") if abs(dx) > abs(dy) else ("N" if dy > 0 else "S")
        assert way == p["facing"], s
        if p["mode"] == "fix":
            for name, (x, y) in p["objects"].items():
                ox, oy = centre[f"object:{name}"]
                assert x <= ox <= x + 1 and y <= oy <= y + 1, (s, name)
        plt.close(fig)
