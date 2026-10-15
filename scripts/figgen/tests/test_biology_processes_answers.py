"""Answers of the P3w process diagrams (the carbon and nitrogen cycles, cell division, tropism experiments, life
cycles), recomputed over 1,000 seeds from each figure's params with this file's own tables of the biology, and the
letters, boxes and results checked against what is drawn."""
import math
import random
import re

import matplotlib.pyplot as plt
import pytest

from figgen.families import FAMILIES

SEEDS = range(1, 1001)
DRAWN = range(1, 41)


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


def letter_set(option):
    return frozenset(re.findall(r"\b[A-J]\b", option))


# --- geometry read back from the drawing -----------------------------------------------------------

def boxes_of(ax):
    return {pa.get_gid()[4:]: pa for pa in ax.patches if (pa.get_gid() or "").startswith("box:")}


def extent(box):
    x0, y0 = box.get_x(), box.get_y()
    return x0, y0, x0 + box.get_width(), y0 + box.get_height()


def on_edge(pt, box, tol=0.08):
    x, y = pt
    x0, y0, x1, y1 = extent(box)
    if not (x0 - tol <= x <= x1 + tol and y0 - tol <= y <= y1 + tol):
        return False
    return min(abs(x - x0), abs(x - x1), abs(y - y0), abs(y - y1)) <= tol


def strictly_inside(pt, box, margin=0.05):
    x0, y0, x1, y1 = extent(box)
    return x0 + margin < pt[0] < x1 - margin and y0 + margin < pt[1] < y1 - margin


def dense(pts, step=0.04):
    out = []
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        n = max(1, int(math.hypot(x1 - x0, y1 - y0) / step))
        out += [(x0 + (x1 - x0) * k / n, y0 + (y1 - y0) * k / n) for k in range(n)]
    return out + [tuple(pts[-1])]


def dist_to(pt, pts):
    return min(math.hypot(pt[0] - x, pt[1] - y) for x, y in dense(pts, 0.02))


def segments_cross(a, b, c, d):
    def orient(p, q, r):
        return (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])
    o1, o2, o3, o4 = orient(a, b, c), orient(a, b, d), orient(c, d, a), orient(c, d, b)
    return o1 * o2 < 0 and o3 * o4 < 0


def polylines_cross(p, q):
    return any(segments_cross(a, b, c, d) for a, b in zip(p, p[1:]) for c, d in zip(q, q[1:]))


def check_cycle_drawing(m, p, labels, seed):
    """Each lettered arrow runs from the edge of its own `from` box to the edge of its `to` box, through no other box and
    across no other arrow; its head is at the `to` end; its letter sits nearer it than any other arrow; and each box
    says what the tables say it is."""
    fig = m.draw(p)
    ax = fig.axes[0]
    try:
        boxes = boxes_of(ax)
        texts = {t.get_gid(): t for t in ax.texts if t.get_gid()}
        assert set(boxes) == set(labels), seed
        for key, words in labels.items():
            t = texts[f"label:{key}"]
            assert " ".join(t.get_text().split()) == words, (seed, key, t.get_text())
            assert strictly_inside(t.get_position(), boxes[key]), (seed, key)
        lines = {ln.get_gid().split(":")[1]: [tuple(xy) for xy in ln.get_xydata()]
                 for ln in ax.lines if (ln.get_gid() or "").startswith("arrow:")}
        pairs = {a["letter"]: (a["from"], a["to"]) for a in p["arrows"]}
        assert set(lines) == set(pairs), seed
        for letter, (f, t) in pairs.items():
            pts = lines[letter]
            assert on_edge(pts[0], boxes[f]) and on_edge(pts[-1], boxes[t]), (seed, letter, f, t, pts[0], pts[-1])
            for k, b in boxes.items():
                if k not in (f, t):
                    assert not any(strictly_inside(pt, b, -0.03) for pt in dense(pts)), (seed, letter, "runs through", k)
            head = texts[f"head:{letter}"]
            assert math.hypot(head.xy[0] - pts[-1][0], head.xy[1] - pts[-1][1]) < 1e-6, (seed, letter)
            lt = texts[f"letter:{letter}"]
            assert lt.get_text() == letter
            d = {L: dist_to(lt.get_position(), q) for L, q in lines.items()}
            assert min(d, key=d.get) == letter and d[letter] < 0.6, (seed, letter, d)
        for a in lines:
            for b in lines:
                if a < b:
                    assert not polylines_cross(lines[a], lines[b]), (seed, a, b)
    finally:
        plt.close(fig)


def letter_question(q, key_letter, drawn):
    assert q.kind == "mcq" and picked(q) == key_letter, q.stem
    assert all(o in drawn for o in q.options)
    assert len(set(q.options)) == len(q.options)


def set_question(q, key, drawn):
    assert q.kind == "mcq"
    sets = [letter_set(o) for o in q.options]
    assert sets[int(q.answer)] == key, (q.stem, q.options)
    assert sum(s == key for s in sets) == 1, q.options
    assert all(s <= set(drawn) for s in sets)


# --- the carbon cycle -----------------------------------------------------------------------------

CARBON = {("air", "plants"): "photosynthesis", ("plants", "air"): "respiration", ("animals", "air"): "respiration",
          ("decomposers", "air"): "respiration", ("plants", "animals"): "feeding",
          ("plants", "decomposers"): "death and decay", ("animals", "decomposers"): "death and decay",
          ("fossil", "air"): "combustion", ("plants", "fossil"): "fossilisation", ("animals", "fossil"): "fossilisation"}
CARBON_BOXES = {"air": "carbon dioxide in the air", "plants": "green plants", "animals": "animals",
                "decomposers": "decomposers", "fossil": "fossil fuels"}
# Processes that overlap the key for an arrow, so are never offered beside it (p3w blind review): decomposers giving
# out carbon dioxide is respiration, and could be read as decay; dead plants or animals reaching decomposers is death
# and decay, and could be read as the decomposers feeding; dead remains becoming fossil fuels could be read as death.
CARBON_NEVER = {("decomposers", "air"): {"death and decay", "feeding"}, ("plants", "decomposers"): {"feeding"},
                ("animals", "decomposers"): {"feeding"}, ("plants", "fossil"): {"death and decay"},
                ("animals", "fossil"): {"death and decay"}}


def test_carbon_cycle():
    m = fam("carbon_cycle")
    for s in SEEDS:
        p, qs = run(m, s)
        pairs = {a["letter"]: (a["from"], a["to"]) for a in p["arrows"]}
        assert sorted(pairs) == list("ABCDEFGHIJ"[:len(pairs)]) and 7 <= len(pairs) <= 9, s
        assert all(pr in CARBON for pr in pairs.values()) and len(set(pairs.values())) == len(pairs), s
        proc = {L: CARBON[pr] for L, pr in pairs.items()}
        for box in CARBON_BOXES:  # carbon reaches every box and leaves it: the cycle closes
            assert any(f == box for f, _ in pairs.values()) and any(t == box for _, t in pairs.values()), (s, box)
        assert list(proc.values()).count("photosynthesis") == 1 and list(proc.values()).count("combustion") == 1
        seen = set()
        for q in qs:
            got = re.search(r"Which letter shows (photosynthesis|combustion)\?$", q.stem)
            if got:
                letter_question(q, next(L for L, x in proc.items() if x == got.group(1)), pairs)
                seen.add("letter")
            got = re.search(r"What process does arrow ([A-J]) show\?$", q.stem)
            if got:
                assert picked(q) == proc[got.group(1)], (s, q.stem, q.options)
                assert all(o in set(CARBON.values()) for o in q.options)
                assert sum(o == proc[got.group(1)] for o in q.options) == 1
                assert not set(q.options) & CARBON_NEVER.get(pairs[got.group(1)], set()), (s, pairs[got.group(1)], q.options)
                seen.add("process")
            if q.stem.endswith("released into the air?"):
                set_question(q, frozenset(L for L, (f, t) in pairs.items() if t == "air"), pairs)
                seen.add("set")
        assert seen == {"letter", "process", "set"}, s
    for s in DRAWN:
        p = m.sample(random.Random(s))
        check_cycle_drawing(m, p, CARBON_BOXES, s)
        # One head an arrow, and no two arrows' ends close enough to read as one arrow with two heads (p3w blind
        # review: a curve and a straight arrow met the fossil fuels box side by side).
        fig = m.draw(p)
        ax = fig.axes[0]
        heads = [t.get_gid() for t in ax.texts if (t.get_gid() or "").startswith("head:")]
        ends = {ln.get_gid().split(":")[1]: [tuple(ln.get_xydata()[0]), tuple(ln.get_xydata()[-1])]
                for ln in ax.lines if (ln.get_gid() or "").startswith("arrow:")}
        plt.close(fig)
        assert sorted(heads) == sorted(f"head:{a['letter']}" for a in p["arrows"]), s
        for a in ends:
            for b in ends:
                if a < b:
                    for u in ends[a]:
                        for v in ends[b]:
                            assert math.hypot(u[0] - v[0], u[1] - v[1]) > 0.55, (s, a, b, u, v)


# --- the nitrogen cycle ---------------------------------------------------------------------------

NITROGEN = {("air", "ammonium"): "nitrogen fixation", ("ammonium", "nitrates"): "nitrification",
            ("nitrates", "air"): "denitrification", ("nitrates", "plants"): "absorption by roots",
            ("plants", "animals"): "feeding", ("plants", "ammonium"): "decomposition",
            ("animals", "ammonium"): "decomposition"}
NITROGEN_BOXES = {"air": "nitrogen gas in the air", "ammonium": "ammonium compounds in the soil",
                  "nitrates": "nitrates in the soil", "plants": "protein in plants", "animals": "protein in animals"}
WORKERS = {"nitrogen fixation": "nitrogen-fixing bacteria", "nitrification": "nitrifying bacteria",
           "denitrification": "denitrifying bacteria", "decomposition": "decomposers (bacteria and fungi)"}


def test_nitrogen_cycle():
    m = fam("nitrogen_cycle")
    legends = 0
    for s in SEEDS:
        p, qs = run(m, s)
        pairs = {a["letter"]: (a["from"], a["to"]) for a in p["arrows"]}
        assert sorted(pairs) == list("ABCDEFG") and sorted(pairs.values()) == sorted(NITROGEN), s
        proc = {L: NITROGEN[pr] for L, pr in pairs.items()}
        seen = set()
        for q in qs:
            got = re.search(r"Which letter shows (nitrogen fixation|nitrification|denitrification|absorption by roots)\?$", q.stem)
            if got:
                letter_question(q, next(L for L, x in proc.items() if x == got.group(1)), pairs)
                seen.add("letter")
            got = re.search(r"What process does arrow ([A-G]) show\?$", q.stem)
            if got:
                assert picked(q) == proc[got.group(1)], (s, q.stem, q.options)
                assert all(o in set(NITROGEN.values()) for o in q.options)
                assert sum(o == proc[got.group(1)] for o in q.options) == 1
                seen.add("process")
            got = re.search(r"carry out the process at arrow ([A-G])\?$", q.stem)
            if got:
                assert p["legend"], s  # the key names the bacteria only where a question needs it
                assert picked(q) == WORKERS[proc[got.group(1)]], (s, q.options)
                assert sorted(q.options) == sorted(WORKERS.values())
                seen.add("bacteria")
            if q.stem.endswith("Which two arrows show decomposition?"):
                set_question(q, frozenset(L for L, x in proc.items() if x == "decomposition"), pairs)
                seen.add("set")
        assert seen == {"letter", "process", "bacteria" if p["legend"] else "set"}, (s, seen)
        legends += p["legend"]
    assert 200 < legends < 800
    for s in DRAWN:
        p = m.sample(random.Random(s))
        check_cycle_drawing(m, p, NITROGEN_BOXES, s)
        fig = m.draw(p)
        words = " ".join(t.get_text() for t in fig.axes[0].texts)
        plt.close(fig)
        assert ("nitrifying bacteria" in words) == p["legend"], s


# --- cell division --------------------------------------------------------------------------------

def test_cell_division():
    m = fam("cell_division")
    for s in SEEDS:
        p, qs = run(m, s)
        n = len(p["pairs"])
        assert n in (2, 3) and len(set(p["pairs"])) == n  # the pairs differ in length, so each can be told apart
        parent = sorted(map(tuple, p["parent"]))
        assert parent == sorted((i, sh) for i in range(n) for sh in (0, 1)), s  # 2n: one of each pair from each parent
        cells = [sorted(map(tuple, c)) for c in p["daughters"]]
        if p["division"] == "mitosis":
            assert len(cells) == 2 and all(c == parent for c in cells), s
            each, alike = 2 * n, True
        else:
            assert len(cells) == 4, s
            for c in cells:
                assert sorted(i for i, _ in c) == list(range(n)), s  # one chromosome from each pair
            combos = sorted(tuple(c) for c in cells)
            assert combos[0] == combos[1] and combos[2] == combos[3] and combos[1] != combos[2], s
            assert all({sh for i, sh in combos[0] if i == k} != {sh for i, sh in combos[2] if i == k} for k in range(n)), s
            each, alike = n, False
        seen = set()
        for q in qs:
            if q.stem.endswith("How many chromosomes are there in each daughter cell?"):
                assert q.answer == str(each) and f"{each} chromosomes" in q.accepted, s
                seen.add("count")
            if q.stem.endswith("Which type of cell division is shown?"):
                key = picked(q)
                assert key.startswith(p["division"]) and str(len(cells)) in key, (s, key)
                assert sum(o.startswith(p["division"]) and str(len(cells)) in o for o in q.options) == 1
                seen.add("type")
            if q.stem.endswith("How do the daughter cells compare with the parent cell?"):
                key = picked(q)
                assert (("same number" in key and "identical" in key) if alike else
                        ("half the number" in key and "different" in key)), (s, key)
                seen.add("compare")
            got = re.search(r"What is the (diploid|haploid) number", q.stem)
            if got:
                assert q.answer == str(2 * n if got.group(1) == "diploid" else n), s
                seen.add("number")
        assert seen == {"count", "type", "compare", "number"}, (s, seen)
    for s in DRAWN:
        p = m.sample(random.Random(s))
        fig = m.draw(p)
        ax = fig.axes[0]
        cells = {pa.get_gid()[5:] for pa in ax.patches if (pa.get_gid() or "").startswith("cell:")}
        chrom = {}
        for ln in ax.lines:
            gid = ln.get_gid() or ""
            if gid.startswith("chrom:"):
                _, cell, i, sh = gid.split(":")
                chrom.setdefault(cell, []).append((int(i), int(sh)))
        marks = [t for t in ax.texts if t.get_text() == "?"]
        plt.close(fig)
        assert cells == {"P"} | {f"D{k}" for k in range(len(p["daughters"]))}, s
        assert sorted(chrom["P"]) == sorted(map(tuple, p["parent"])), s
        for k, c in enumerate(p["daughters"]):
            if p["show"]:
                assert sorted(chrom[f"D{k}"]) == sorted(map(tuple, c)), s
            else:
                assert f"D{k}" not in chrom
        assert len(marks) == (0 if p["show"] else len(p["daughters"])), s


# --- tropism experiments --------------------------------------------------------------------------

# Which way each organ grows in each set-up, by the rules a textbook states: a shoot grows towards light from one
# side unless its tip is covered; light from above, or a clinostat turning it, gives no one side; a shoot grows
# away from gravity and a root towards it unless a clinostat turns it.
LIGHT_RESULT = {"side": "towards", "slit": "towards", "foil": "straight up", "above": "straight up", "clinostat": "straight up"}
GRAVITY_RESULT = {("flat", "shoot"): "curves upwards", ("flat", "root"): "curves downwards",
                  ("upside", "shoot"): "curves upwards", ("upside", "root"): "curves downwards",
                  ("clinostat", "shoot"): "keeps growing straight", ("clinostat", "root"): "keeps growing straight"}
WORDS = {"one": 1, "two": 2, "three": 3, "four": 4}
# The tropisms an option set may name, by the set-up (p3w-fix review: a shoot growing up and bending to light fits both
# "positive phototropism" and "negative gravitropism", so a light set never offers gravitropism, nor a gravity set
# phototropism). The stem names the stimulus.
TROPISMS = {"light": {"phototropism", "hydrotropism"}, "gravity": {"gravitropism", "hydrotropism"}}


def expected_way(mode, pot, organ):
    if mode == "light":
        r = LIGHT_RESULT[pot["setup"]]
        return f"bends to the {pot['side']}" if r == "towards" else "grows straight up"
    return GRAVITY_RESULT[(pot["setup"], organ)]


def test_tropism_experiment():
    m = fam("tropism_experiment")
    modes, counts = set(), set()
    for s in SEEDS:
        p, qs = run(m, s)
        pots = {x["letter"]: x for x in p["pots"]}
        mode = p["mode"]
        modes.add(mode)
        assert sorted(pots) == list("ABCD"[:len(pots)]) and len(pots) >= 3, s
        assert any(not x["shown"] for x in pots.values()) and any(x["shown"] for x in pots.values()), s
        # No "which is the control?" (p3w blind review: what a control is depends on what is tested, and several
        # seedlings could each be argued).
        assert not any("control" in q.stem for q in qs), s
        # The stem says exactly what is drawn: how many seedlings, and in the gravity set how many are pinned still
        # and how many turn on a clinostat.
        lead = qs[0].stem
        if mode == "light":
            got = re.search(r"grew (\w+) \w+ seedlings in pots", lead)
            assert got and WORDS[got.group(1)] == len(pots), (s, lead)
        else:
            still = sum(x["setup"] != "clinostat" for x in pots.values())
            turned = len(pots) - still
            got = re.search(r"pinned (\w+) germinating \w+ seeds? to (?:a square|squares) of cork", lead)
            assert got and WORDS[got.group(1)] == still, (s, lead)
            got = re.search(r"and (\w+) to (?:a cork disc|cork discs) on (?:a turning clinostat|turning clinostats)", lead)
            assert (WORDS[got.group(1)] if got else 0) == turned, (s, lead)
            assert "dark" in lead
        seen = set()
        for q in qs:
            got = re.search(r"Which way will the (shoot|root) of seedling ([A-D]) grow\?$", q.stem)
            if got:
                organ, L = got.groups()
                assert not pots[L]["shown"], s  # a prediction is asked only where the result is not drawn
                assert picked(q) == expected_way(mode, pots[L], organ), (s, q.stem, q.options, pots[L])
                if mode == "light":
                    assert sorted(q.options) == ["bends to the left", "bends to the right", "grows straight up"]
                else:
                    assert sorted(q.options) == ["curves downwards", "curves upwards", "keeps growing straight"]
                seen.add("way")
            got = re.search(r"After three days, how many of the (\w+) seedlings will have (shoots bending to one side|"
                            r"roots turned to grow downwards|shoots turned to grow upwards)\?$", q.stem)
            if got:
                # A prediction for every seedling, the "?" ones too, and said so (p3w-fix review).
                assert WORDS[got.group(1)] == len(pots)
                assert "including those marked ?" in q.stem, q.stem
                if mode == "light":
                    key = sum(LIGHT_RESULT[x["setup"]] == "towards" for x in pots.values())
                else:
                    organ = "root" if "roots" in got.group(2) else "shoot"
                    want = "curves downwards" if organ == "root" else "curves upwards"
                    key = sum(GRAVITY_RESULT[(x["setup"], organ)] == want for x in pots.values())
                assert q.answer == str(key), (s, q.stem, q.answer, p["pots"])
                counts.add((mode, key))
                seen.add("count")
            got = re.search(r"Seedling ([A-D])'s (shoot|root) .+\. What is this response to (light|gravity) called\?$", q.stem)
            if got:
                L, organ, stimulus = got.groups()
                assert pots[L]["shown"], s  # the response named is one the figure shows
                assert stimulus == mode, s
                way = expected_way(mode, pots[L], organ)
                key = ("positive phototropism" if mode == "light" and way.startswith("bends") else
                       "negative gravitropism" if way == "curves upwards" else
                       "positive gravitropism" if way == "curves downwards" else None)
                assert key and picked(q) == key, (s, way, q.options)
                named = {o.split()[1] for o in q.options}
                assert named <= TROPISMS[mode] and not {"phototropism", "gravitropism"} <= named, (s, q.options)
                assert sorted(q.options) == sorted(f"{a} {b}" for a in ("positive", "negative") for b in TROPISMS[mode])
                seen.add("name")
        assert seen == {"way", "count", "name"}, (s, seen)
    assert modes == {"light", "gravity"}
    assert len({k for md, k in counts if md == "light"}) >= 3 and len({k for md, k in counts if md == "gravity"}) >= 3
    for s in DRAWN:
        p = m.sample(random.Random(s))
        fig = m.draw(p)
        ax = fig.axes[0]
        texts = {t.get_gid(): t for t in ax.texts if t.get_gid()}
        organs = {ln.get_gid(): ln.get_xydata() for ln in ax.lines if (ln.get_gid() or "").split(":")[0] in ("shoot", "root")}
        lamps = {pa.get_gid()[5:]: pa for pa in ax.patches if (pa.get_gid() or "").startswith("lamp:")}
        caps = {pa.get_gid()[4:]: pa for pa in ax.patches if (pa.get_gid() or "").startswith("cap:")}
        holders = [pa.get_gid().split(":")[0] for pa in ax.patches if (pa.get_gid() or "").split(":")[0] in ("board", "disc")]
        walls = {ln.get_gid()[5:]: ln.get_xydata() for ln in ax.lines if (ln.get_gid() or "").startswith("wall:")}
        rays = {}
        for t in ax.texts:
            if (t.get_gid() or "").startswith("ray:"):
                rays.setdefault(t.get_gid().split(":")[1], []).append((t.xyann, t.xy))
        plt.close(fig)
        assert "Seedlings marked ? are shown at the start" in texts["note"].get_text(), s
        if p["mode"] == "gravity":  # a square of cork for each seedling pinned still, a disc for each on a clinostat
            assert holders.count("disc") == sum(x["setup"] == "clinostat" for x in p["pots"]), s
            assert holders.count("board") == sum(x["setup"] != "clinostat" for x in p["pots"]), s
        for x in p["pots"]:
            L = x["letter"]
            assert texts[f"pot:{L}"].get_text() == L
            assert (f"ask:{L}" in texts) == (not x["shown"]), (s, L)
            if p["mode"] == "light":
                lamp = lamps[L].center
                base, tip = organs[f"shoot:{L}"][0], organs[f"shoot:{L}"][-1]
                if x["setup"] == "above":
                    assert abs(lamp[0] - base[0]) < 0.05 and lamp[1] > tip[1], s
                else:
                    assert (lamp[0] < base[0]) == (x["side"] == "left"), (s, L)
                if x["shown"]:
                    dx = tip[0] - base[0]
                    if LIGHT_RESULT[x["setup"]] == "towards":
                        assert (dx < -0.2) if x["side"] == "left" else (dx > 0.2), (s, L, dx)
                    else:
                        assert abs(dx) < 0.03, (s, L, dx)
                # A slit box has a clear gap in the wall facing the lamp, at the shoot's height, and the lamp's rays pass
                # through it into the box (p3w-fix review: the slit was not seen, and the rays hit the wall above).
                assert (L in walls) == (x["setup"] == "slit"), (s, L)
                if x["setup"] == "slit":
                    pts = walls[L]
                    wx, top, bottom = pts[0][0], pts[0][1], pts[-1][1]
                    assert pts[-1][0] == wx and top - bottom >= 0.5, (s, pts[0], pts[-1])
                    assert base[1] + 0.6 <= bottom and top <= base[1] + 1.9, (s, bottom, top)
                    assert bottom < lamp[1] < top and (lamp[0] - wx) * (wx - base[0]) > 0, s
                    assert len(rays[L]) >= 2, s
                    for (x0, y0), (x1, y1) in rays[L]:
                        assert bottom < y0 < top and bottom < y1 < top, (s, y0, y1)
                        assert (x0 - wx) * (x1 - wx) < 0, (s, x0, x1, wx)  # from outside the wall to inside
                # A foil cap is a cap you can see, over the tip, and labelled (p3w blind review).
                assert (L in caps) == (x["setup"] == "foil"), (s, L)
                if x["setup"] == "foil":
                    ext = caps[L].get_path().get_extents()
                    assert ext.width >= 0.24 and ext.height >= 0.3, (s, ext)
                    assert ext.x0 < tip[0] < ext.x1 and ext.y0 < tip[1] < ext.y1, s
                    label = texts[f"foil:{L}"]
                    assert label.get_text() == "foil"
                    lx, ly = label.get_position()
                    assert math.hypot(lx - tip[0], ly - tip[1]) < 1.0, s
            else:
                for organ in ("shoot", "root"):
                    pts = organs[f"{organ}:{L}"]
                    if x["shown"]:
                        way = GRAVITY_RESULT[(x["setup"], organ)]
                        # the drawn tip points the way the rule says: up, down, or on along its start
                        (x0, y0), (x1, y1) = pts[-2], pts[-1]
                        if way == "curves upwards":
                            assert y1 - y0 > abs(x1 - x0), (s, L, organ)
                        elif way == "curves downwards":
                            assert y0 - y1 > abs(x1 - x0), (s, L, organ)
                        else:
                            assert abs(y1 - y0) < 0.2 * abs(x1 - x0), (s, L, organ)


# --- life cycles ----------------------------------------------------------------------------------

STAGES = {"mosquito": ["egg", "larva", "pupa", "adult"], "housefly": ["egg", "larva", "pupa", "adult"],
          "butterfly": ["egg", "caterpillar", "chrysalis", "adult"],
          "frog": ["frogspawn", "tadpole", "froglet", "adult frog"],
          "maize": ["grain", "seedling", "young plant", "flowering plant", "ripe cob"],
          "bean": ["seed", "seedling", "adult plant", "flower", "pod"]}
# Stages that are not in that life cycle at all (a decoy must be wrong, not merely another name for a right stage).
NOT_IN = {"mosquito": {"nymph", "caterpillar", "tadpole", "maggot", "chrysalis", "seedling"},
          "housefly": {"nymph", "caterpillar", "tadpole", "chrysalis", "froglet"},
          "butterfly": {"nymph", "maggot", "tadpole", "froglet"},
          "frog": {"pupa", "nymph", "caterpillar", "chrysalis", "maggot"},
          "maize": {"spore", "tuber", "bulb", "pupa", "pollen grain"},
          "bean": {"spore", "tuber", "bulb", "pupa", "pollen grain"}}


def test_life_cycle():
    m = fam("life_cycle")
    organisms = set()
    for s in SEEDS:
        p, qs = run(m, s)
        st = STAGES[p["organism"]]
        organisms.add(p["organism"])
        n = len(st)
        assert set(st) <= set(p["bank"]) and len(p["bank"]) == len(set(p["bank"])), s
        assert set(p["bank"]) - set(st) <= NOT_IN[p["organism"]], s
        seen = set()
        for q in qs:
            if q.stem.endswith("goes in the box with the question mark?"):
                assert picked(q) == st[p["hidden"]], s
                assert all(o in p["bank"] for o in q.options)
                assert all(o in NOT_IN[p["organism"]] for o in q.options if o != picked(q)), (s, q.options)
                seen.add("missing")
            if q.stem.endswith("How many stages are there in this life cycle?"):
                assert q.answer == str(n), s
                seen.add("count")
            got = re.search(r"Which stage comes just before the (.+)\?$", q.stem)
            if got:
                x = st.index(got.group(1))
                assert x != p["hidden"] and (x - 1) % n != p["hidden"], s  # both are shown, not the "?"
                assert picked(q) == st[(x - 1) % n], s
                assert all(o in st and o != st[x] for o in q.options)
                seen.add("before")
        assert seen == {"missing", "count", "before"}, (s, seen)
    assert organisms == set(STAGES)
    for s in DRAWN:
        p = m.sample(random.Random(s))
        st = STAGES[p["organism"]]
        n = len(st)
        fig = m.draw(p)
        ax = fig.axes[0]
        texts = {t.get_gid(): t for t in ax.texts if t.get_gid()}
        boxes = boxes_of(ax)
        plt.close(fig)
        assert len(boxes) == n, s
        for k in range(n):  # the box k places round the ring from the start, clockwise, holds stage start + k
            stage = (p["start"] + k) % n
            word = " ".join(texts[f"stage:{k}"].get_text().split())
            assert word == ("?" if stage == p["hidden"] else st[stage]), (s, k, word)
            arrow = texts[f"arrow:{k}"]
            assert on_edge(arrow.xyann, boxes[str(k)]) and on_edge(arrow.xy, boxes[str((k + 1) % n)]), (s, k)
        # clockwise: going round the ring the angle about the centre falls
        cx = sum(b.get_x() + b.get_width() / 2 for b in boxes.values()) / n
        cy = sum(b.get_y() + b.get_height() / 2 for b in boxes.values()) / n
        ang = [math.atan2(boxes[str(k)].get_y() + boxes[str(k)].get_height() / 2 - cy,
                          boxes[str(k)].get_x() + boxes[str(k)].get_width() / 2 - cx) for k in range(n)]
        steps = [(ang[k] - ang[(k + 1) % n]) % (2 * math.pi) for k in range(n)]
        assert all(0 < d < math.pi for d in steps), (s, steps)
        bank = " ".join(t.get_text() for t in ax.texts if (t.get_gid() or "").startswith("bank"))
        assert all(b in bank for b in p["bank"]), s
