"""Answers of the P3z physical geography diagrams (soil profiles, the rock cycle, the Earth's and the atmosphere's
layers, drainage patterns, river and coast features, plate boundaries), recomputed over 1,000 seeds from each figure's
params with this file's own tables of the geography, and the letters checked against what is drawn: every letter's
leader ends on the part the key says, and no label sits on a line."""
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
DRAWN = range(1, 31)
STORE = Path("C:/Users/Stephen/figure-library/figures.db")
OURS = ["soil_profile", "rock_cycle", "earth_layers", "drainage_pattern", "river_features", "coast_features",
        "plate_boundary"]


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


def _central(options):
    toks = [Counter(re.findall(r"-?\d+|[a-zA-Z]+|\S", o)) for o in options]
    score = [sum(sum(((t - u) + (u - t)).values()) for u in toks) for t in toks]
    best = min(score)
    return score.index(best) if score.count(best) == 1 else None


def dist_to(pt, pts):
    """How far a point is from a polyline."""
    best = math.inf
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        dx, dy = x1 - x0, y1 - y0
        t = 0.0 if dx == dy == 0 else max(0.0, min(1.0, ((pt[0] - x0) * dx + (pt[1] - y0) * dy) / (dx * dx + dy * dy)))
        best = min(best, math.hypot(pt[0] - x0 - t * dx, pt[1] - y0 - t * dy))
    return best


def letter_q(q, key, drawn):
    """A question answered with a letter: the key, every option a drawn letter, in alphabetical order."""
    assert q.kind == "mcq", q.stem
    assert picked(q) == key, (q.stem, q.options, key)
    assert all(o in drawn for o in q.options) and len(set(q.options)) == len(q.options), (q.stem, q.options)
    assert q.options == sorted(q.options), q.options
    assert len(q.options) >= 3, q.options


def number(q, value, unit):
    assert q.kind == "short", q.stem
    assert q.answer == str(value), (q.stem, q.answer, value)
    assert f"{value} {unit}" in q.accepted and f"{value}{unit}" in q.accepted, q.accepted
    if value >= 1000:
        assert f"{value:,}" in q.accepted and f"{value:,}".replace(",", " ") in q.accepted, q.accepted


# --- reading the drawing ------------------------------------------------------------------------------

def _data_path(pa):
    return pa.get_path().transformed(pa.get_patch_transform())


def _filled(pa) -> bool:
    return pa.get_visible() and pa.get_fill() and pa.get_facecolor()[3] > 0


def topmost(ax, pt):
    """The filled shape a reader sees at a point: the highest drawn there (zorder, then drawing order)."""
    hits = [(pa.get_zorder(), k, pa) for k, pa in enumerate(ax.patches)
            if _filled(pa) and pa.get_transform().contains_branch(ax.transData) and _data_path(pa).contains_point(pt)]
    return max(hits, key=lambda h: (h[0], h[1]))[2] if hits else None


def check_letters(m, p):
    """Every letter is drawn once, at least 12 pt; its leader starts at the letter, ends on its own part (the shape a
    reader sees there) and passes through no other letter. Returns the open figure."""
    fig = m.draw(p)
    ax = fig.axes[0]
    fig.canvas.draw()
    renderer = fig.canvas.get_renderer()
    labels = p["labels"]
    texts = {t.get_gid()[7:]: t for t in ax.texts if (t.get_gid() or "").startswith("letter:")}
    leaders = {ln.get_gid()[7:]: ln for ln in ax.lines if (ln.get_gid() or "").startswith("leader:")}
    assert set(texts) == set(labels) == set(leaders), (sorted(texts), sorted(labels), sorted(leaders))
    boxes = {k: t.get_window_extent(renderer) for k, t in texts.items()}
    for L, name in labels.items():
        assert texts[L].get_text() == L and texts[L].get_fontsize() >= 12
        xs, ys = leaders[L].get_data()
        end = (float(xs[-1]), float(ys[-1]))
        seen = topmost(ax, end)
        assert seen is not None and seen.get_gid() == f"part:{name}", (L, name, seen and seen.get_gid())
        sx, sy = ax.transData.transform((float(xs[0]), float(ys[0])))
        b = boxes[L]
        gap = math.hypot(max(b.x0 - sx, 0, sx - b.x1), max(b.y0 - sy, 0, sy - b.y1))
        assert gap <= 20, (L, gap)
        pts = ax.transData.transform(list(zip(xs, ys)))
        for other, ob in boxes.items():
            if other != L:
                for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
                    for k in range(41):
                        x, y = x0 + (x1 - x0) * k / 40, y0 + (y1 - y0) * k / 40
                        assert not (ob.x0 - 1 < x < ob.x1 + 1 and ob.y0 - 1 < y < ob.y1 + 1), (L, "crosses", other)
    return fig


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


def _hits(pts, box, margin=1.0, steps=30):
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        for k in range(steps + 1):
            x, y = x0 + (x1 - x0) * k / steps, y0 + (y1 - y0) * k / steps
            if box.x0 + margin < x < box.x1 - margin and box.y0 + margin < y < box.y1 - margin:
                return True
    return False


@pytest.mark.parametrize("fid", OURS)
def test_no_label_sits_on_a_line(fid):
    """A label must not cover a line (P3z brief): every piece of text in the drawing is clear of every drawn line and
    every outlined shape's edge, except a letter's own leader."""
    m = fam(fid)
    for s in range(1, 25):
        fig = m.draw(m.sample(random.Random(s)))
        ax = fig.axes[0]
        texts = [(t, b) for t, b in drawn_texts(fig) if t.axes is ax and t in ax.texts]
        outlines = []
        for ln in ax.lines:
            if ln.get_visible() and ln.get_linestyle() not in ("None", "none", "") and ln.get_linewidth() > 0:
                outlines.append((ln.get_gid() or "", ax.transData.transform(ln.get_xydata())))
        for pa in ax.patches:
            if pa.get_visible() and pa.get_linewidth() > 0 and pa.get_edgecolor()[3] > 0:
                for poly in pa.get_path().to_polygons(pa.get_patch_transform(), closed_only=False):
                    outlines.append((pa.get_gid() or "", ax.transData.transform(poly)))
        for t, box in texts:
            own = "leader:" + (t.get_gid() or "")[7:] if (t.get_gid() or "").startswith("letter:") else None
            for gid, pts in outlines:
                if gid == own or (t.get_gid() or "").startswith("label:") and gid == "box:" + t.get_gid()[6:]:
                    continue
                assert not _hits(pts, box), (fid, s, t.get_text(), gid)
        plt.close(fig)


# --- linking -------------------------------------------------------------------------------------------

TARGETS = [
    ("soil_profile", "Soils"), ("soil_profile", "Soils in Rwanda"), ("soil_profile", "Soils in Africa and the World"),
    ("rock_cycle", "Rocks"), ("rock_cycle", "Weathering and Rocks"), ("rock_cycle", "Rocks and minerals in Rwanda"),
    ("rock_cycle", "Rocks and Minerals"), ("rock_cycle", "Chapter 1: Formation of rocks"),
    ("earth_layers", "The structure of the Earth"),
    ("earth_layers", "Chapter 7: The structure and composition of the atmosphere"),
    ("drainage_pattern", "General organisation of hydrography"), ("drainage_pattern", "Drainage in Africa"),
    ("river_features", "General organisation of hydrography"), ("river_features", "Drainage in Africa"),
    ("coast_features", "Wave Erosion and Deposition"),
    ("plate_boundary", "Tectonic Processes"),
    ("earth_layers", "Vegetation"),
    ("soil_profile", "External Landform Processes and Related Features"),
]


@pytest.fixture(scope="module")
def index():
    if not STORE.exists():
        pytest.skip("no figure store")
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
    from figgen import link
    db = sqlite3.connect(f"file:{STORE}?mode=ro", uri=True)
    db.row_factory = sqlite3.Row
    return link, link.topic_index(db), db


@pytest.mark.parametrize("fid", OURS)
def test_family_is_worded_and_linked(fid, index):
    link, ix, db = index
    m = fam(fid)
    assert m.SUBJECT == "geography" and set(m.BANDS) <= {"LS", "UP"} and m.NEEDS
    known = {r[0] for r in db.execute("SELECT id FROM concepts")}
    assert set(m.CONCEPTS) <= known, sorted(set(m.CONCEPTS) - known)
    bands = set()
    for seed in range(1, 150):
        p, qs = run(m, seed)
        bands.add(p["band"])
        first = next((n for n in NAMES if qs[0].stem.startswith(n)), None)
        assert first, (fid, seed, qs[0].stem)
        for q in qs:
            for owner in re.findall(r"\b(" + "|".join(NAMES) + r")'s\b", q.stem):
                assert owner == first, (fid, seed, q.stem)
    assert bands == set(m.BANDS), (fid, bands)


@pytest.mark.parametrize("fid,topic", TARGETS)
def test_reaches_the_empty_topic_by_name(fid, topic, index):
    link, ix, db = index
    names = {t["key"]: t["name"] for t in ix}
    reached = {names[k] for k in link.reach(ix, fam(fid), 120)}
    assert topic in reached, (fid, topic)


# --- options alone ---------------------------------------------------------------------------------------

@pytest.mark.parametrize("fid", OURS)
def test_an_mcq_cannot_be_picked_from_its_options_alone(fid):
    m = fam(fid)
    seen, hits = defaultdict(int), defaultdict(int)
    for s in range(1, 301):
        _, qs = run(m, s)
        for q in qs:
            if q.kind == "mcq":
                key = re.sub(r"\b[A-Z]\b", "#", re.sub(r"\d+", "#", q.stem.rsplit(". ", 1)[-1]))
                seen[key] += 1
                hits[key] += _central(q.options) == int(q.answer)
    bad = {k: (hits[k], seen[k]) for k in seen if seen[k] >= 10 and hits[k] / seen[k] > 0.35}
    assert not bad, (fid, bad)


# --- soil_profile ---------------------------------------------------------------------------------------

# The names the figure's own table prints, for each layer (P3z review: questions used terms the figure never defined).
SOIL_SHOWN = {"leaf litter": "litter", "topsoil": "topsoil", "subsoil": "subsoil", "weathered parent rock": "parent",
              "bedrock": "bedrock"}
SOIL_ORDER = ["litter", "topsoil", "subsoil", "parent", "bedrock"]
# A deep weathering profile of the humid tropics (Rwanda S6 "Weathering in humid tropical ... regions"): the
# weathering front is the boundary between weathered rock and the solid bedrock beneath it, drawn and labelled.
WEATHER_SHOWN = {"soil": "soil", "rotted rock": "rotted rock", "corestones": "corestones", "bedrock": "bedrock"}
WEATHER_ORDER = ["soil", "rotted rock", "corestones", "bedrock"]


def test_soil_profile():
    m = fam("soil_profile")
    kinds_seen = set()
    for s in SEEDS:
        p, qs = run(m, s)
        kinds_seen.add(p["kind"])
        layers = p["layers"]
        names = [n for n, _, _ in layers]
        assert layers[0][1] == 0 and all(a[2] == b[1] for a, b in zip(layers, layers[1:])), (s, layers)
        if p["kind"] == "soil":
            assert names == [n for n in SOIL_ORDER if n in names] and names[-4:] == SOIL_ORDER[1:], (s, names)
            assert all(t % 10 == 0 and b % 10 == 0 and b - t >= 10 for _, t, b in layers), (s, layers)
            # the litter layer lies only under trees or grass, never on a ploughed field
            assert ("litter" in names) == p["cover"], (s, p)
            shown, unit = SOIL_SHOWN, "cm"
        else:
            assert names == WEATHER_ORDER and p["band"] == "UP", (s, p)
            assert all(t % 2 == 0 and b % 2 == 0 and b - t >= 2 for _, t, b in layers), (s, layers)
            assert layers[1][2] - layers[1][1] > layers[2][2] - layers[2][1], s  # the rotted rock is the thickest
            shown, unit = WEATHER_SHOWN, "m"
        # the printed table lists every drawn layer once, in an order that is not the profile's
        assert sorted(p["table"]) == sorted(names), (s, p["table"])
        labels = p["labels"]
        assert sorted(labels) == list("PQRST"[:len(layers)]) and sorted(labels.values()) == sorted(names), (s, labels)
        at = {v: k for k, v in labels.items()}
        span = {n: (t, b) for n, t, b in layers}
        kinds = set()
        for q in qs:
            if got := re.search(r"Which letter shows the (.+)\?$", q.stem):
                letter_q(q, at[shown[got.group(1)]], labels)
                assert "table" in q.stem, q.stem
                kinds.add("which")
            elif got := re.search(r"boundary between layer ([P-T]) and layer ([P-T])\?$", q.stem):
                a, b = labels[got.group(1)], labels[got.group(2)]
                assert names.index(b) == names.index(a) + 1, (s, q.stem)
                number(q, span[a][1], unit)
                kinds.add("depth")
            elif q.stem.endswith("How deep below the surface is the weathering front?"):
                assert p["kind"] == "weathering"
                number(q, span["corestones"][1], unit)
                kinds.add("depth")
            elif got := re.search(r"How thick is layer ([P-T])\?$", q.stem):
                n = labels[got.group(1)]
                assert n != "bedrock"
                number(q, span[n][1] - span[n][0], unit)
                kinds.add("thick")
            else:
                raise AssertionError((s, q.stem))
        assert kinds == {"which", "depth", "thick"}, (s, kinds)
    assert kinds_seen == {"soil", "weathering"}
    for s in DRAWN:
        p = m.sample(random.Random(s))
        fig = check_letters(m, p)
        ax = fig.axes[0]
        # every boundary is on a labelled tick of the depth scale (drawn downwards from 0 at the surface), in the unit
        # the axis names
        ticks = {round(-float(v)) for v in ax.get_yticks()}
        labels = {t.get_text() for t in ax.get_yticklabels()}
        for _, top, bottom in p["layers"][:-1]:
            assert bottom in ticks and str(bottom) in labels, (s, bottom, sorted(ticks))
        assert ax.get_ylabel().endswith("(cm)" if p["kind"] == "soil" else "(m)"), s
        # the table names each layer, in the table's order, and gives no letter away
        shown = SOIL_SHOWN if p["kind"] == "soil" else WEATHER_SHOWN
        rows = [t for t in ax.texts if t.get_gid() == "table-name"]
        assert [shown[t.get_text().lower()] for t in rows] == p["table"], (s, [t.get_text() for t in rows])
        assert all(not re.search(r"\b[P-T]\b", t.get_text()) for t in ax.texts if (t.get_gid() or "").startswith("table")), s
        if p["kind"] == "weathering":
            front = [ln for ln in ax.lines if ln.get_gid() == "weathering-front"]
            assert len(front) == 1 and front[0].get_linestyle() != "-", s
            ys = set(front[0].get_ydata())
            assert ys == {-p["layers"][2][2]}, (s, ys)
            assert [t.get_text() for t in ax.texts if t.get_gid() == "front-label"] == ["weathering front"], s
        plt.close(fig)


# --- rock_cycle ---------------------------------------------------------------------------------------

ROCK = {("magma", "igneous"): "cooling", ("igneous", "sediments"): "weathering and erosion",
        ("metamorphic", "sediments"): "weathering and erosion", ("sediments", "sedimentary"): "compaction and cementation",
        ("sedimentary", "metamorphic"): "heat and pressure", ("igneous", "metamorphic"): "heat and pressure",
        ("metamorphic", "magma"): "melting", ("sedimentary", "magma"): "melting"}
ROCK_BOXES = {"magma": "magma (molten rock)", "igneous": "igneous rock", "sediments": "sediments",
              "sedimentary": "sedimentary rock", "metamorphic": "metamorphic rock"}
ROCKS = {"igneous": "igneous rock", "sedimentary": "sedimentary rock", "metamorphic": "metamorphic rock"}
PROCESSES = sorted(set(ROCK.values()))


def test_rock_cycle():
    m = fam("rock_cycle")
    for s in SEEDS:
        p, qs = run(m, s)
        pairs = {a["letter"]: (a["from"], a["to"]) for a in p["arrows"]}
        assert sorted(pairs) == list("ABCDEFGH"[:len(pairs)]) and 5 <= len(pairs) <= 7, s
        assert all(pr in ROCK for pr in pairs.values()) and len(set(pairs.values())) == len(pairs), s
        for box in ROCK_BOXES:  # the cycle closes: every box has an arrow in and out
            assert any(f == box for f, _ in pairs.values()) and any(t == box for _, t in pairs.values()), (s, box)
        proc = {L: ROCK[pr] for L, pr in pairs.items()}
        kinds = set()
        for q in qs:
            if got := re.search(r"Which letter shows (" + "|".join(PROCESSES) + r")\?$", q.stem):
                keys = [L for L, x in proc.items() if x == got.group(1)]
                assert len(keys) == 1, (s, q.stem)
                letter_q(q, keys[0], pairs)
                kinds.add("letter")
            elif got := re.search(r"What process does arrow ([A-H]) show\?$", q.stem):
                assert picked(q) == proc[got.group(1)], (s, q.stem, q.options)
                assert all(o in PROCESSES for o in q.options) and len(q.options) >= 3
                kinds.add("process")
            elif got := re.search(r"Which type of rock does the process at arrow ([A-H]) form\?$", q.stem):
                to = pairs[got.group(1)][1]
                assert to in ROCKS and picked(q) == ROCKS[to], (s, q.stem)
                assert sorted(q.options) == sorted(ROCKS.values())
                kinds.add("forms")
            elif q.stem.endswith("Which type of rock is X?"):
                assert p["blank"] in ROCKS and picked(q) == ROCKS[p["blank"]], (s, q.stem)
                assert sorted(q.options) == sorted(ROCKS.values())
                kinds.add("blank")
            else:
                raise AssertionError((s, q.stem))
        # the letter and process questions never share a key: one would give the other away
        assert {"letter", "process"} <= kinds and len(kinds) == 3, (s, kinds)
        assert ("blank" in kinds) == bool(p["blank"]), s
    for s in DRAWN:
        p = m.sample(random.Random(s))
        fig = m.draw(p)
        ax = fig.axes[0]
        texts = {t.get_gid(): t for t in ax.texts if t.get_gid()}
        for key, words in ROCK_BOXES.items():
            shown = " ".join(texts[f"label:{key}"].get_text().split())
            assert shown == ("Rock X" if key == p["blank"] else words), (s, key, shown)
        lines = {ln.get_gid().split(":")[1]: ln.get_xydata() for ln in ax.lines if (ln.get_gid() or "").startswith("arrow:")}
        assert set(lines) == {a["letter"] for a in p["arrows"]}, s
        for a in p["arrows"]:
            assert texts[f"head:{a['letter']}"].xy == tuple(lines[a["letter"]][-1]), s
            lt = texts[f"letter:{a['letter']}"].get_position()
            d = {L: dist_to(lt, pts) for L, pts in lines.items()}
            assert min(d, key=d.get) == a["letter"] and d[a["letter"]] < 0.6, (s, a, d)
        plt.close(fig)


# --- earth_layers ----------------------------------------------------------------------------------------

EARTH = ["crust", "mantle", "outer core", "inner core"]
AIR = ["troposphere", "stratosphere", "mesosphere", "thermosphere"]
# Vegetation zones up a high mountain in East Africa, lowest first (Rwanda S1-S4 "Vegetation": altitude is a factor
# in where vegetation grows).
ZONES = ["farmland", "montane forest", "bamboo", "heath and moorland", "alpine"]
LAYER_DESC = {"the thin, solid, rocky outer layer": "crust",
              "the thick layer of hot rock in which convection currents flow": "mantle",
              "the layer of liquid iron and nickel": "outer core",
              "the solid ball of iron and nickel at the centre": "inner core",
              "the layer in which almost all weather happens": "troposphere",
              "the layer that holds the ozone layer": "stratosphere",
              "the layer in which most meteors burn up": "mesosphere",
              "the highest layer, where auroras are seen": "thermosphere"}


def test_earth_layers():
    m = fam("earth_layers")
    kinds_seen = set()
    for s in SEEDS:
        p, qs = run(m, s)
        kinds_seen.add(p["kind"])
        layers = p["layers"]
        order = {"earth": EARTH, "atmosphere": AIR, "mountain": ZONES}[p["kind"]]
        assert [n for n, _, _ in layers] == order, (s, layers)
        assert all(a[2] == b[1] for a, b in zip(layers, layers[1:])), s
        labels = p["labels"]
        # letters from P on, so they never match the options' own letters A to D (P3z review)
        assert sorted(labels) == list("PQRST"[:len(order)]) and sorted(labels.values()) == sorted(order), s
        at = {v: k for k, v in labels.items()}
        span = {n: (t, b) for n, t, b in layers}
        unit = "m" if p["kind"] == "mountain" else "km"
        if p["kind"] == "earth":
            assert layers[0][1] == 0 and 25 <= span["crust"][1] <= 70 and span["mantle"][1] in (2890, 2900)
            assert span["outer core"][1] in (5100, 5150) and span["inner core"][1] in (6370, 6371)
        elif p["kind"] == "atmosphere":
            assert layers[0][1] == 0 and 8 <= span["troposphere"][1] <= 18 and span["stratosphere"][1] in (48, 50)
            assert span["mesosphere"][1] in (80, 85)
        else:
            assert 1000 <= layers[0][1] and layers[-1][2] <= 5000, s
            assert all(t % 100 == 0 and b % 100 == 0 and b - t >= 300 for _, t, b in layers), (s, layers)
        kinds = set()
        for q in qs:
            if got := re.search(r"Which letter shows the (crust|mantle|outer core|inner core|troposphere|stratosphere|"
                                r"mesosphere|thermosphere)\?$", q.stem):
                letter_q(q, at[got.group(1)], labels)
                kinds.add("which")
            elif got := re.search(r"Which letter shows the (" + "|".join(ZONES) + r") zone\?$", q.stem):
                letter_q(q, at[got.group(1)], labels)
                kinds.add("which")
            elif got := re.search(r"Which letter shows (.+)\?$", q.stem):
                letter_q(q, at[LAYER_DESC[got.group(1)]], labels)
                kinds.add("which")
            elif got := re.search(r"How thick is layer ([P-S])\?$", q.stem):
                n = labels[got.group(1)]
                assert n not in ("inner core", "thermosphere"), (s, q.stem)
                number(q, span[n][1] - span[n][0], "km")
                kinds.add("thick")
            elif got := re.search(r"How many metres of height does zone ([P-T]) cover\?$", q.stem):
                n = labels[got.group(1)]
                assert p["kind"] == "mountain"
                number(q, span[n][1] - span[n][0], "m")
                kinds.add("thick")
            elif got := re.search(r"from the top of layer ([P-S]) to the centre of the Earth\?$", q.stem):
                n = labels[got.group(1)]
                assert n == "inner core"
                number(q, span[n][1] - span[n][0], "km")
                kinds.add("thick")
            elif got := re.search(r"is the boundary between (?:layer|zone) ([P-T]) and (?:layer|zone) ([P-T])\?$",
                                  q.stem):
                a, b = labels[got.group(1)], labels[got.group(2)]
                assert order.index(b) == order.index(a) + 1, (s, q.stem)
                lead = {"earth": "How deep below the surface", "atmosphere": "At what height above the ground",
                        "mountain": "At what height above sea level"}[p["kind"]]
                assert q.stem.startswith(lead), q.stem
                number(q, span[a][1], unit)
                kinds.add("depth")
            else:
                raise AssertionError((s, q.stem))
        assert kinds == {"which", "thick", "depth"}, (s, kinds)
    assert kinds_seen == {"earth", "atmosphere", "mountain"}
    for s in DRAWN:
        p = m.sample(random.Random(s))
        fig = check_letters(m, p)
        words = "|".join(t.get_text() for t in fig.axes[0].texts)
        plt.close(fig)
        unit = "m" if p["kind"] == "mountain" else "km"
        # every boundary's depth or height is printed, as students read it; and the centre, or the mountain's foot
        # and peak
        printed = [b for _, _, b in p["layers"][:-1]]
        if p["kind"] != "atmosphere":
            printed.append(p["layers"][-1][2])
        if p["kind"] == "mountain":
            printed.append(p["layers"][0][1])
        for b in printed:
            assert re.search(rf"(?<!\d)(?<!\d ){b:,} {unit}(?![a-z])".replace(",", " "), words), (s, b, words)
        if p["kind"] == "mountain":
            # a table of the zones and their heights (P3z review: plant symbols alone did not tell bamboo from grass),
            # and an altitude scale
            for n, lo, hi in p["layers"]:
                row = f"{n.capitalize()}: {lo:,}–{hi:,} m".replace(",", " ")
                assert row in words.split("|"), (s, row, words)
            fig = m.draw(p)
            assert fig.axes[0].get_ylabel() == "Height above sea level (m)", s
            ticks = {int(v) for v in fig.axes[0].get_yticks()}
            plt.close(fig)
            assert {v for v in ticks if p["layers"][0][1] <= v <= p["layers"][-1][2]} == set(
                range(-(-p["layers"][0][1] // 500) * 500, p["layers"][-1][2] + 1, 500)), (s, sorted(ticks))
        else:
            for n in EARTH + AIR + ZONES:  # the figure names no layer: the letters are the question
                assert n not in words.lower(), (s, n)


# --- drainage_pattern -------------------------------------------------------------------------------------

PATTERNS = ["dendritic", "trellis", "radial", "rectangular", "centripetal"]
PATTERN_DESC = {"rivers flowing outwards from a central high point": "radial",
                "rivers flowing inwards to a central lake": "centripetal",
                "tributaries joining the main river like the branches of a tree": "dendritic",
                "short tributaries joining at right angles between parallel ridges": "trellis",
                "rivers that bend at right angles along joints in the rock": "rectangular"}


def test_drainage_pattern():
    m = fam("drainage_pattern")
    for s in SEEDS:
        p, qs = run(m, s)
        maps = p["maps"]
        assert sorted(maps) == list("WXYZ") and len(set(maps.values())) == 4 and set(maps.values()) <= set(PATTERNS), s
        at = {v: k for k, v in maps.items()}
        kinds = set()
        for q in qs:
            if got := re.search(r"Which drainage pattern does map ([W-Z]) show\?$", q.stem):
                assert picked(q) == maps[got.group(1)] and all(o in PATTERNS for o in q.options), (s, q.stem)
                kinds.add("name")
            elif got := re.search(r"Which map shows (.+)\?$", q.stem):
                letter_q(q, at[PATTERN_DESC[got.group(1)]], maps)
                kinds.add("which")
            elif got := re.search(r"How many rivers flow (outwards from the high point|into the lake) in map ([W-Z])\?$", q.stem):
                L = got.group(2)
                assert maps[L] == ("radial" if "outwards" in got.group(1) else "centripetal"), (s, q.stem)
                assert q.kind == "short" and q.answer == str(p["count"][L]), (s, q.stem, q.answer)
                assert 5 <= p["count"][L] <= 9
                kinds.add("count")
            else:
                raise AssertionError((s, q.stem))
        assert kinds == {"name", "which", "count"}, (s, kinds)
        # the two letter questions never point at the same map
        name_map = next(re.search(r"map ([W-Z]) show", q.stem).group(1) for q in qs if "drainage pattern does" in q.stem)
        which = next(picked(q) for q in qs if q.stem.startswith("Which map shows"))
        assert name_map != which, s
    for s in DRAWN:
        p = m.sample(random.Random(s))
        fig = m.draw(p)
        ax = fig.axes[0]
        words = [t.get_text() for t in ax.texts]
        for L, pat in p["maps"].items():
            assert f"Map {L}" in words, (s, L)
            if pat in ("radial", "centripetal"):
                rivers = [ln for ln in ax.lines if (ln.get_gid() or "").startswith(f"river:{L}:main")]
                assert len(rivers) == p["count"][L], (s, L, len(rivers))
                heads = [t for t in ax.texts if (t.get_gid() or "").startswith(f"flow:{L}:")]
                assert len(heads) == p["count"][L], (s, L)
                hub = p["hub"][L]
                for t in heads:  # each river's arrow points away from a radial hill, towards a centripetal lake
                    away = math.dist(t.xy, hub) > math.dist(t.xyann, hub)
                    assert away == (pat == "radial"), (s, L)
        # the table names every pattern, drawn or not
        table = " ".join(words).lower()
        assert all(x in table for x in PATTERNS), s
        plt.close(fig)


# --- river_features ---------------------------------------------------------------------------------------

COURSE = ["waterfall", "gorge", "meander", "ox-bow lake", "delta"]
COURSE_FORM = {"where the river drops over a band of hard rock lying on softer rock": "waterfall",
               "the narrow, steep-sided valley left as a waterfall wears back upstream": "gorge",
               "the lake left when the neck of a meander is cut through": "ox-bow lake",
               "a bend whose outer bank is eroded while its inner bank gains sand": "meander"}
MOUTH = {"Which letter shows the feature built where the river drops its sediment as it enters the sea?",
         "Which letter shows the feature built where the river drops its sediment as it enters the lake?"}
BEND = {"river cliff", "slip-off slope", "deepest water"}
BEND_ASK = {"the river cliff": "river cliff", "the slip-off slope": "slip-off slope",
            "the deepest and fastest-flowing water": "deepest water"}


def test_river_features():
    m = fam("river_features")
    kinds_seen = set()
    for s in SEEDS:
        p, qs = run(m, s)
        labels = p["labels"]
        at = {v: k for k, v in labels.items()}
        kinds_seen.add(p["kind"])
        kinds = set()
        if p["kind"] == "course":
            # letters from P on, so they never match the options' own letters A to D (P3z review)
            assert set(labels.values()) == set(COURSE) and sorted(labels) == list("PQRST"), s
        else:
            assert set(labels.values()) == BEND and sorted(labels) == list("PQR"), s
            assert p["outer"] in ("X", "Y"), s
        keys = []
        for q in qs:
            tail = q.stem.rsplit("Which letter shows ", 1)[-1][:-1]
            if got := re.search(r"Which letter shows (?:a|an) (waterfall|gorge|meander|ox-bow lake|delta)\?$", q.stem):
                letter_q(q, at[got.group(1)], labels)
                kinds.add("name")
            elif tail in COURSE_FORM:
                letter_q(q, at[COURSE_FORM[tail]], labels)
                kinds.add("form")
            elif q.stem in MOUTH:
                assert q.stem.endswith(f"enters the {p['water']}?"), (s, q.stem)
                letter_q(q, at["delta"], labels)
                assert len(q.options) == 4, q.options
                kinds.add("deposit")
            elif got := re.search(r"Which letter shows (the [a-z -]+)\?$", q.stem):
                letter_q(q, at[BEND_ASK[got.group(1)]], labels)
                kinds.add("name")
            elif q.stem.endswith("On which bank of the meander is erosion greatest?"):
                assert picked(q) == f"The outer bank, at {p['outer']}", (s, q.options)
                inner = "Y" if p["outer"] == "X" else "X"
                assert sorted(q.options) == sorted([f"The outer bank, at {p['outer']}", f"The inner bank, at {inner}",
                                                    f"The outer bank, at {inner}", f"The inner bank, at {p['outer']}"])
                kinds.add("bank")
            elif q.stem.endswith("Which letter shows where the river is depositing sand and gravel?"):
                letter_q(q, at["slip-off slope"], labels)
                kinds.add("deposit")
            else:
                raise AssertionError((s, q.stem))
            if q.kind == "mcq" and len(picked(q)) == 1:
                keys.append(picked(q))
        assert len(keys) == len(set(keys)), (s, keys)  # no two letter questions share a key
        assert kinds == ({"name", "form", "deposit"} if p["kind"] == "course" else {"name", "bank", "deposit"}), (s, kinds)
    assert kinds_seen == {"course", "meander"}
    for s in DRAWN:
        p = m.sample(random.Random(s))
        fig = check_letters(m, p)
        ax = fig.axes[0]
        if p["kind"] == "course":
            # a key explains the map's symbols; the ox-bow lake lies close beside the channel, cut off from it
            key = " ".join(t.get_text() for t in ax.texts if t.get_gid() == "key")
            assert "waterfall" in key and "steep rock faces" in key, (s, key)
            river = next(pa for pa in ax.patches if pa.get_gid() == "river")
            oxbow = next(pa for pa in ax.patches if pa.get_gid() == "part:ox-bow lake")
            rv, ov = _data_path(river).vertices, _data_path(oxbow).vertices
            gap = min(math.dist(a, b) for a in ov for b in rv[::3])
            assert 0.04 < gap < 0.3, (s, gap)
        if p["kind"] == "meander":
            # the cross-section's river cliff stands on the side of the section's outer end, and is the steeper bank
            ends = {t.get_text(): t.get_position()[0] for t in ax.texts if t.get_gid() == "section-end"}
            assert set(ends) == {"X", "Y"}, s
            cliff = next(pa for pa in ax.patches if pa.get_gid() == "part:river cliff")
            slope = next(pa for pa in ax.patches if pa.get_gid() == "part:slip-off slope")
            cx = _data_path(cliff).vertices[:, 0].mean()
            sx = _data_path(slope).vertices[:, 0].mean()
            assert (cx < sx) == (ends[p["outer"]] < ends["Y" if p["outer"] == "X" else "X"]), s
        plt.close(fig)


# --- coast_features ---------------------------------------------------------------------------------------

COAST_NEXT = {"cave": "arch", "arch": "stack", "stack": "stump"}
COAST_ERODED = {"cave", "arch", "stack", "stump"}
COAST_DEPOSITED = {"beach", "spit"}


def test_coast_features():
    m = fam("coast_features")
    for s in SEEDS:
        p, qs = run(m, s)
        labels = p["labels"]
        at = {v: k for k, v in labels.items()}
        assert sorted(labels) == list("ABCDEF"[:len(labels)]) and 5 <= len(labels) <= 6, s
        assert set(labels.values()) <= COAST_ERODED | COAST_DEPOSITED and {"arch", "stack"} <= set(labels.values()), s
        kinds, keys = set(), []
        for q in qs:
            if got := re.search(r"comes after (?:a|an) (cave|arch|stack) in the erosion of a headland\?$", q.stem):
                letter_q(q, at[COAST_NEXT[got.group(1)]], labels)
                assert all(labels[o] in COAST_ERODED for o in q.options)
                kinds.add("next")
            elif q.stem.endswith("Which letter shows a feature formed by deposition?"):
                assert labels[picked(q)] in COAST_DEPOSITED, (s, q.options)
                letter_q(q, picked(q), labels)
                assert sum(labels[o] in COAST_DEPOSITED for o in q.options) == 1, (s, q.options)
                kinds.add("deposit")
            elif got := re.search(r"Which letter shows (?:a|an) (cave|arch|stack|stump|beach|spit)\?$", q.stem):
                letter_q(q, at[got.group(1)], labels)
                kinds.add("name")
            else:
                raise AssertionError((s, q.stem))
            keys.append(picked(q))
        assert kinds == {"next", "deposit", "name"} and len(set(keys)) == len(keys), (s, kinds, keys)
    for s in DRAWN:
        p = m.sample(random.Random(s))
        fig = check_letters(m, p)
        plt.close(fig)


# --- plate_boundary ---------------------------------------------------------------------------------------

BOUNDARY = {"constructive_ocean": "constructive", "constructive_rift": "constructive", "destructive": "destructive",
            "conservative": "conservative"}
PLATE_FEATURES = {"constructive_ocean": {"mid-ocean ridge", "magma", "oceanic crust", "mantle"},
                  "constructive_rift": {"rift valley", "fault", "volcano", "magma chamber", "continental crust"},
                  "destructive": {"ocean trench", "volcano", "oceanic crust", "continental crust", "magma chamber"},
                  "conservative": {"fault", "river", "road"}}
PLATE_DESC = {"the oceanic plate sinking into the mantle": "oceanic crust",
              "magma rising from the mantle": "magma"}


def test_plate_boundary():
    m = fam("plate_boundary")
    seen_kinds = set()
    for s in SEEDS:
        p, qs = run(m, s)
        seen_kinds.add(p["kind"])
        labels = p["labels"]
        at = {v: k for k, v in labels.items()}
        # letters from P on, so they never match the options' own letters A to D (P3z review)
        assert set(labels.values()) <= PLATE_FEATURES[p["kind"]] and sorted(labels) == list("PQRST"[:len(labels)]), s
        assert len(labels) >= 3, s
        # a Rwandan rift setting only for the rift: the ridge and the trench are not near Musanze
        first = qs[0].stem
        assert ("Musanze" in first or "Rift" in first) <= (p["kind"] == "constructive_rift"), (s, first)
        kinds, keys = set(), []
        for q in qs:
            if re.search(r"What type of plate boundary does the (?:diagram|map) show\?$", q.stem):
                assert picked(q) == BOUNDARY[p["kind"]] and sorted(q.options) == ["conservative", "constructive", "destructive"]
                kinds.add("type")
            elif got := re.search(r"Which letter shows (?:the|a) (ocean trench|mid-ocean ridge|rift valley|fault|volcano|"
                                  r"magma chamber|continental crust|oceanic crust)\?$", q.stem):
                letter_q(q, at[got.group(1)], labels)
                kinds.add("name")
                keys.append(picked(q))
            elif got := re.search(r"Which letter shows (.+)\?$", q.stem):
                letter_q(q, at[PLATE_DESC[got.group(1)]], labels)
                kinds.add("desc")
                keys.append(picked(q))
            else:
                raise AssertionError((s, q.stem))
        assert {"type", "name"} <= kinds and len(set(keys)) == len(keys), (s, kinds)
        if p["kind"] == "destructive":
            assert "ocean trench" in labels.values()
    assert seen_kinds == set(BOUNDARY)
    for s in DRAWN:
        p = m.sample(random.Random(s))
        fig = check_letters(m, p)
        ax = fig.axes[0]
        # the motion arrows: apart at a constructive boundary, together at a destructive one, side by side and
        # opposite at a conservative one
        arrows = [t for t in ax.texts if (t.get_gid() or "").startswith("motion:")]
        assert len(arrows) == 2, s
        bx = p["boundary_x"]
        moves = []
        for t in arrows:
            (x0, y0), (x1, y1) = t.xyann, t.xy
            moves.append((x1 - x0, y1 - y0, (x0 + x1) / 2 - bx))
        if p["kind"] == "constructive_rift":
            # one fault lettered; no other letter's leader ends near either fault
            faults = [pa for pa in ax.patches if pa.get_gid() in ("part:fault", "fault")]
            assert [pa.get_gid() for pa in faults].count("part:fault") == 1 and len(faults) == 2, s
            for ln in ax.lines:
                if (ln.get_gid() or "").startswith("leader:") and p["labels"][ln.get_gid()[7:]] != "fault":
                    end = ln.get_xydata()[-1]
                    for pa in faults:
                        v = [tuple(q) for q in _data_path(pa).vertices]
                        assert dist_to(tuple(end), v + v[:1]) > 0.35, (s, ln.get_gid())
        if p["kind"] == "destructive" and "oceanic crust" in p["labels"].values():
            # the oceanic plate's letter points at its sinking part, beneath the continent's edge or deeper
            L = next(k for k, v in p["labels"].items() if v == "oceanic crust")
            end = next(ln for ln in ax.lines if ln.get_gid() == f"leader:{L}").get_xydata()[-1]
            x = end[0] if not p["mirror"] else 12.0 - end[0]
            assert x > 5.4 and end[1] < 3.0, (s, end)
        kind = BOUNDARY[p["kind"]]
        if kind == "conservative":
            assert all(abs(dy) > 3 * abs(dx) for dx, dy, _ in moves) and moves[0][1] * moves[1][1] < 0, s
            assert moves[0][2] * moves[1][2] < 0, s
        else:
            for dx, dy, side in moves:
                assert abs(dx) > 3 * abs(dy), s
                assert (dx * side > 0) == (kind == "constructive"), (s, kind, dx, side)
        plt.close(fig)



def test_soil_layers_drawn_as_their_rows_describe():
    """P3z re-review: the leaf litter was read as topsoil, and a stony subsoil as the weathered parent rock. Each layer
    shows only what its row says: leaves only in the leaf litter, roots starting below it, a few small stones only in
    the subsoil, and many larger broken pieces only in the weathered parent rock."""
    from matplotlib.patches import Rectangle
    m = fam("soil_profile")
    seen = 0
    for s in range(1, 120):
        p = m.sample(random.Random(s))
        if p["kind"] != "soil":
            continue
        seen += 1
        if seen > 30:
            break
        span = {n: (t, b) for n, t, b in p["layers"]}
        fig = m.draw(p)
        ax = fig.axes[0]
        fig.canvas.draw()
        shapes = {}
        for pa in ax.patches:
            gid = pa.get_gid() or ""
            if gid.startswith("part:") and not isinstance(pa, Rectangle):
                v = _data_path(pa).vertices
                px = ax.transData.transform(v)
                size = max(px[:, 0].max() - px[:, 0].min(), px[:, 1].max() - px[:, 1].min())
                shapes.setdefault(gid[5:], []).append((size, v[:, 1].min(), v[:, 1].max()))
        for n, items in shapes.items():  # every shape lies inside its own band
            t, b = span[n]
            assert all(-b <= lo and hi <= -t for _, lo, hi in items), (s, n)
        assert set(shapes) <= {"litter", "subsoil", "parent"}, (s, sorted(shapes))  # topsoil and bedrock: no shapes
        if p["cover"]:
            assert len(shapes["litter"]) >= 15, s
        stones, pieces = shapes.get("subsoil", []), shapes.get("parent", [])
        assert 1 <= len(stones) <= 4, (s, len(stones))
        assert len(pieces) >= max(6, 2 * len(stones)), (s, len(pieces), len(stones))
        assert min(z for z, _, _ in pieces) > 1.3 * max(z for z, _, _ in stones), (s, pieces, stones)
        # roots: from the top of the topsoil, most ending in it, a few reaching the subsoil, none deeper
        roots = [ln.get_ydata() for ln in ax.lines if ln.get_gid() == "root"]
        top, bottom = span["topsoil"]
        assert all(abs(y[0] + top) < 1e-9 for y in roots), s
        deep = sum(min(y) < -bottom for y in roots)
        assert 1 <= deep < len(roots) - deep, (s, deep, len(roots))
        assert all(min(y) >= -span["subsoil"][1] for y in roots), s
        # the table says so
        rows = {t.get_text().lower(): u.get_text() for t, u in zip([t for t in ax.texts if t.get_gid() == "table-name"],
                                                                   [t for t in ax.texts if t.get_gid() == "table-desc"])}
        top_row = " ".join(rows["topsoil"].split())
        assert ("under the layer of dead leaves" in top_row) == p["cover"], (s, top_row)
        if p["cover"]:
            assert "no soil" in " ".join(rows["leaf litter"].split()), s
        assert "few small stones" in " ".join(rows["subsoil"].split()), s
        assert "many" in " ".join(rows["weathered parent rock"].split()), s
        plt.close(fig)
    assert seen >= 20
