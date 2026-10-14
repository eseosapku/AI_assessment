"""Answers of the biology structure diagrams (P3w), recomputed over 1,000 seeds from the test's own tables, and every
letter checked against the drawing: the letter "letter:<L>" is drawn, its leader "leader:<L>" ends on the part the
key says, and that part is what a reader sees there (the topmost filled shape at the leader's end)."""
import math
import random
import re
import sqlite3
from fractions import Fraction
from pathlib import Path

import matplotlib.pyplot as plt
import pytest

from figgen.core import NAMES
from figgen.families import FAMILIES

SEEDS = range(1, 1001)
DRAWN = 40  # the figure itself is built and read for the first seeds
STORE = Path("C:/Users/Stephen/figure-library/figures.db")
STRUCTURES = ["heart_diagram", "flower_diagram", "nephron_diagram", "reflex_arc", "arm_muscles"]


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


def parts_named(ax, name):
    return [pa for pa in ax.patches if pa.get_gid() == f"part:{name}"]


def centre(pa):
    v = _data_path(pa).vertices
    return (v[:, 0].min() + v[:, 0].max()) / 2, (v[:, 1].min() + v[:, 1].max()) / 2


def bbox(pa):
    v = _data_path(pa).vertices
    return v[:, 0].min(), v[:, 1].min(), v[:, 0].max(), v[:, 1].max()


def check_letters(m, p, known_parts):
    """Every letter is drawn once, its leader ends on its own part (the shape seen there), starts at the letter, and
    passes through no other letter. Returns the figure's axes texts for further checks (the figure is closed)."""
    fig = m.draw(p)
    ax = fig.axes[0]
    fig.canvas.draw()
    renderer = fig.canvas.get_renderer()
    labels = p["labels"]
    assert sorted(labels) == [chr(65 + i) for i in range(len(labels))], labels  # A, B, C ... with none skipped
    assert len(set(labels.values())) == len(labels) and set(labels.values()) <= set(known_parts), labels
    texts = {t.get_gid()[7:]: t for t in ax.texts if (t.get_gid() or "").startswith("letter:")}
    leaders = {ln.get_gid()[7:]: ln for ln in ax.lines if (ln.get_gid() or "").startswith("leader:")}
    assert set(texts) == set(labels) == set(leaders), (sorted(texts), sorted(labels), sorted(leaders))
    boxes = {k: t.get_window_extent(renderer) for k, t in texts.items()}
    for L, name in labels.items():
        assert texts[L].get_text() == L
        assert texts[L].get_fontsize() >= 12
        xs, ys = leaders[L].get_data()
        end = (float(xs[-1]), float(ys[-1]))
        seen = topmost(ax, end)
        assert seen is not None and seen.get_gid() == f"part:{name}", (L, name, seen and seen.get_gid())
        # the leader starts at its letter: within 20 px of the letter's box
        sx, sy = ax.transData.transform((float(xs[0]), float(ys[0])))
        b = boxes[L]
        gap = math.hypot(max(b.x0 - sx, 0, sx - b.x1), max(b.y0 - sy, 0, sy - b.y1))
        assert gap <= 20, (L, gap)
        # and crosses no other letter
        pts = ax.transData.transform(list(zip(xs, ys)))
        for other, ob in boxes.items():
            if other != L:
                for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
                    for k in range(41):
                        x, y = x0 + (x1 - x0) * k / 40, y0 + (y1 - y0) * k / 40
                        assert not (ob.x0 - 1 < x < ob.x1 + 1 and ob.y0 - 1 < y < ob.y1 + 1), (L, "crosses", other)
    words = [t.get_text() for t in ax.texts]
    flows = {t.get_gid()[5:]: t for t in ax.texts if (t.get_gid() or "").startswith("flow:")}
    return fig, ax, words, flows


def own_wordings(m) -> int:
    stems = []
    for seed in range(1, 31):
        rng = random.Random(seed)
        stems.append({q.stem for q in m.questions(m.sample(rng), rng)})
    return sum(1 for i, s in enumerate(stems) if s - set().union(*(t for j, t in enumerate(stems) if j != i)))


@pytest.mark.parametrize("fid", STRUCTURES)
def test_structure_family_is_worded_and_linked(fid):
    m = fam(fid)
    assert m.SUBJECT == "biology" and m.CONCEPTS and all(c.startswith("biology.") for c in m.CONCEPTS)
    assert m.NEEDS
    if STORE.exists():
        db = sqlite3.connect(f"file:{STORE}?mode=ro", uri=True)
        known = {r[0] for r in db.execute("SELECT id FROM concepts")}
        assert set(m.CONCEPTS) | set(getattr(m, "ALSO", ())) <= known, sorted((set(m.CONCEPTS) | set(getattr(m, "ALSO", ()))) - known)
    assert own_wordings(m) >= 27, fid
    bands = set()
    for seed in range(1, 120):
        p, qs = run(m, seed)
        bands.add(p["band"])
        first = next((n for n in NAMES if qs[0].stem.startswith(n)), None)
        assert first, (fid, seed, qs[0].stem)
        for q in qs:
            for owner in re.findall(r"\b(" + "|".join(NAMES) + r")'s\b", q.stem):
                assert owner == first, (fid, seed, q.stem)
    assert bands == set(m.BANDS), (fid, bands)


@pytest.mark.parametrize("fid,topic", [
    ("heart_diagram", "Transport in animals"), ("heart_diagram", "Unit 8: Circulatory system in humans"),
    ("flower_diagram", "Unit 14: Sexual reproduction in flowering plants"), ("flower_diagram", "Structure of a flower"),
    ("nephron_diagram", "Excretion in humans"), ("nephron_diagram", "Structure and functions of the nephron"),
    ("reflex_arc", "Nervous Coordination"), ("reflex_arc", "Reflex arcs and reflex actions"),
    ("arm_muscles", "UNIT 14: SUPPORT AND LOCOMOTION"), ("arm_muscles", "Joints and movement"),
    ("arm_muscles", "Skeletons, Muscles and Movement"), ("arm_muscles", "7.4 Moving the body"),
])
def test_needs_match_the_topics_each_family_is_for(fid, topic):
    assert re.search(fam(fid).NEEDS, topic, re.I), (fid, topic)


@pytest.mark.parametrize("fid,misfit", [
    ("flower_diagram", "UNIT 16: ASEXUAL REPRODUCTION IN PLANTS"), ("reflex_arc", "Hormonal Coordination in Animals"),
    ("reflex_arc", "Gas Exchange in Animals"),
])
def test_avoid_turns_away_topics_that_share_a_word(fid, misfit):
    assert re.search(fam(fid).AVOID, misfit, re.I), (fid, misfit)


# --- heart_diagram -------------------------------------------------------------------------------------

HEART_JOB = {
    "right atrium": "receives deoxygenated blood from the body",
    "left atrium": "receives oxygenated blood from the lungs",
    "right ventricle": "pumps deoxygenated blood to the lungs",
    "left ventricle": "pumps oxygenated blood to the rest of the body",
    "septum": "keeps oxygenated and deoxygenated blood apart",
    "vena cava": "brings deoxygenated blood from the body to the heart",
    "pulmonary artery": "carries deoxygenated blood from the heart to the lungs",
    "pulmonary vein": "brings oxygenated blood from the lungs to the heart",
    "aorta": "carries oxygenated blood from the heart to the body",
    "tricuspid valve": "stops blood flowing back from the right ventricle into the right atrium",
    "bicuspid valve": "stops blood flowing back from the left ventricle into the left atrium",
}
OXYGENATED = {"left atrium", "left ventricle", "pulmonary vein", "aorta"}
DEOXYGENATED = {"right atrium", "right ventricle", "vena cava", "pulmonary artery"}
VESSELS = {"vena cava", "pulmonary artery", "pulmonary vein", "aorta"}
CHAMBERS = {"right atrium", "left atrium", "right ventricle", "left ventricle"}
# Where each flow arrow runs, as (from, to): blood enters the atria from the veins and leaves the ventricles by the
# arteries, through the valves, never the other way.
HEART_FLOWS = {("vena cava", "right atrium"), ("right atrium", "right ventricle"), ("right ventricle", "pulmonary artery"),
               ("pulmonary artery", "lungs"), ("pulmonary vein", "left atrium"), ("left atrium", "left ventricle"),
               ("left ventricle", "aorta"), ("aorta", "body")}


def _wall_at(ax, name, y, side):
    """How far a lumen sits in from the heart's outer wall at height y, on the given side."""
    def xs_at(path):
        v = path.vertices
        out = []
        for (x0, y0), (x1, y1) in zip(v, v[1:]):
            if (y0 - y) * (y1 - y) <= 0 and y0 != y1:
                out.append(x0 + (y - y0) / (y1 - y0) * (x1 - x0))
        return out
    wall = next(pa for pa in ax.patches if pa.get_gid() == "wall")
    outer, lumen = xs_at(_data_path(wall)), xs_at(_data_path(parts_named(ax, name)[0]))
    return (max(outer) - max(lumen)) if side == "right" else (min(lumen) - min(outer))


def test_heart_diagram():
    m = fam("heart_diagram")
    shaded = 0
    for s in SEEDS:
        p, qs = run(m, s)
        labels = p["labels"]
        at = {v: k for k, v in labels.items()}
        assert "left ventricle" in at and "aorta" in at, s
        assert 5 <= len(labels) <= 6, s
        shaded += p["shaded"]
        if s <= DRAWN:
            fig, ax, words, flows = check_letters(m, p, HEART_JOB)
            # every part is drawn, on the side textbooks draw it: the heart's left on the viewer's right
            for name in HEART_JOB:
                assert parts_named(ax, name), (s, name)
            for left, right in (("left ventricle", "right ventricle"), ("left atrium", "right atrium")):
                assert centre(parts_named(ax, left)[0])[0] > centre(parts_named(ax, right)[0])[0], s
            text = " ".join(words)
            assert "left side of the body" in text and "right side of the body" in text, s
            note = {t.get_text(): t.get_position()[0] for t in ax.texts}
            assert note["left side of the body"] > note["right side of the body"], s
            # the left ventricle's wall is drawn thickest, well over the right ventricle's
            y = centre(parts_named(ax, "left ventricle")[0])[1]
            assert _wall_at(ax, "left ventricle", y, "right") > 1.6 * _wall_at(ax, "right ventricle", y, "left"), s
            # blood flows one way round: each arrow's head is nearer where the blood goes than its tail is
            assert {tuple(k.split(">")) for k in flows} == HEART_FLOWS, (s, sorted(flows))
            heart = centre(next(pa for pa in ax.patches if pa.get_gid() == "wall"))
            for t in (t for t in ax.texts if (t.get_gid() or "").startswith("flow:")):
                src, dst = t.get_gid()[5:].split(">")
                goal = heart if dst in ("lungs", "body") else centre(parts_named(ax, dst)[0])
                d_head, d_tail = math.dist(t.xy, goal), math.dist(t.xyann, goal)
                assert (d_head > d_tail) if dst in ("lungs", "body") else (d_head < d_tail), (s, t.get_gid())
            if p["shaded"]:
                assert "oxygenated blood" in words and "deoxygenated blood" in words, s
                for name in OXYGENATED | DEOXYGENATED:
                    r, g, b, _ = parts_named(ax, name)[0].get_facecolor()
                    assert (r > b) == (name in OXYGENATED), (s, name)
            plt.close(fig)
        seen = set()
        for q in qs:
            st = q.stem
            if re.search(r"oxygenated blood (?:away )?from the heart to the (?:rest of the )?body", st):
                assert labels[picked(q)] == "aorta", (s, st)
                assert all(o in labels and labels[o] != "aorta" for o in wrong(q))
                seen.add("oxygen")
            elif "thickest" in st:
                assert labels[picked(q)] == "left ventricle", (s, st)
                assert all(o in labels and labels[o] != "left ventricle" for o in wrong(q))
                seen.add("thick")
            elif got := re.search(r"part labelled ([A-F])", st):
                name = labels[got.group(1)]
                assert name not in ("aorta", "left ventricle"), (s, st)  # those letters are other questions' keys
                assert picked(q).lower() == HEART_JOB[name], (s, st, picked(q))
                for o in wrong(q):
                    assert o.lower() in HEART_JOB.values() and o.lower() != HEART_JOB[name], (s, o)
                seen.add("job")
            elif got := re.search(r"Which letter shows the ([a-z ]+)\?$", st):
                name = got.group(1)
                assert name in HEART_JOB and name not in ("aorta", "left ventricle"), (s, st)
                assert labels[picked(q)] == name, (s, st)
                assert all(o in labels and labels[o] != name for o in wrong(q))
                seen.add("named")
            else:
                pytest.fail(f"seed {s}: an unexpected question {st}")
            if q.kind == "mcq":
                assert len(q.options) >= 3
        assert seen == {"oxygen", "thick", "job", "named"}, (s, seen)
        # the job and the named part are different parts
        job = next(labels[re.search(r"part labelled ([A-F])", q.stem).group(1)] for q in qs if "part labelled" in q.stem)
        named = next(re.search(r"shows the ([a-z ]+)\?$", q.stem).group(1) for q in qs
                     if re.search(r"Which letter shows the ([a-z ]+)\?$", q.stem) and "oxygenated" not in q.stem
                     and "thickest" not in q.stem)
        assert job != named, s
    assert 300 < shaded < 700


# --- flower_diagram ------------------------------------------------------------------------------------

FLOWER_JOB = {
    "anther": "makes pollen grains",
    "filament": "holds the anther up",
    "stigma": "catches pollen grains during pollination",
    "style": "holds up the stigma; the pollen tube grows down through it",
    "ovary": "contains the ovules, and becomes the fruit",
    "ovule": "contains a female gamete, and becomes a seed",
    "petal": "attracts insects with its colour",
    "sepal": "protects the flower while it is a bud",
    "nectary": "makes sugary nectar that insects feed on",
}
FEATURES = {"insect": ("large", "nectary", "inside"), "wind": ("hang outside", "feathery", "small")}


def test_flower_diagram():
    m = fam("flower_diagram")
    kinds = {"insect": 0, "wind": 0}
    for s in SEEDS:
        p, qs = run(m, s)
        labels, kind = p["labels"], p["kind"]
        kinds[kind] += 1
        assert "anther" in labels.values(), s
        if kind == "wind":
            assert "nectary" not in labels.values(), s
        if s <= DRAWN:
            fig, ax, words, _ = check_letters(m, p, FLOWER_JOB)
            petals = [bbox(pa) for pa in parts_named(ax, "petal")]
            anthers = [bbox(pa) for pa in parts_named(ax, "anther")]
            reach = max(max(abs(b[0]), abs(b[2])) for b in petals)  # how far out the petals reach
            top = max(b[3] for b in petals)
            hairs = [ln for ln in ax.lines if ln.get_gid() == "stigma-hair"]
            if kind == "insect":
                assert parts_named(ax, "nectary") and not hairs, s
                # anthers inside the flower: within the petals' reach and below their tips
                assert all(max(abs(b[0]), abs(b[2])) < reach and b[3] < top for b in anthers), s
            else:
                assert not parts_named(ax, "nectary") and len(hairs) >= 20, s
                # anthers hang outside the small petals
                assert all(min(abs(b[0]), abs(b[2])) > reach for b in anthers), s
            # the flower is a half-flower: each side part is drawn on both sides of the middle
            for name in ("petal", "sepal", "anther", "filament"):
                xs = [centre(pa)[0] for pa in parts_named(ax, name)]
                assert min(xs) < 0 < max(xs), (s, name)
            plt.close(fig)
        seen = set()
        for q in qs:
            st = q.stem
            if "type of flower" in st:
                ans = picked(q)
                assert ans.startswith("Insect" if kind == "insect" else "Wind"), (s, ans)
                assert all(f in ans for f in FEATURES[kind]), (s, ans)
                for o in wrong(q):
                    other = "wind" if kind == "insect" else "insect"
                    # a wrong option names the wrong type, or a feature this flower is not drawn with
                    wrong_type = o.startswith("Insect" if other == "insect" else "Wind")
                    false_feature = any(f in o for f in FEATURES[other] if f not in FEATURES[kind])
                    assert wrong_type or false_feature, (s, o)
                seen.add("type")
            elif re.search(r"pollen grains (?:are|is) made", st):
                assert labels[picked(q)] == "anther", (s, st)
                assert all(labels[o] != "anther" for o in wrong(q))
                seen.add("pollen")
            elif got := re.search(r"part labelled ([A-F])", st):
                name = labels[got.group(1)]
                assert name != "anther" and not (kind == "wind" and name == "petal"), (s, st)
                assert picked(q).lower() == FLOWER_JOB[name], (s, picked(q))
                assert all(o.lower() in FLOWER_JOB.values() and o.lower() != FLOWER_JOB[name] for o in wrong(q)), s
                seen.add("job")
            elif got := re.search(r"Which letter shows the ([a-z ]+)\?$", st):
                name = got.group(1)
                assert name in FLOWER_JOB and name != "anther", (s, st)
                assert labels[picked(q)] == name and all(labels[o] != name for o in wrong(q)), (s, st)
                seen.add("named")
            else:
                pytest.fail(f"seed {s}: an unexpected question {st}")
            assert len(q.options) >= 3
        assert {"type", "pollen"} <= seen and len(seen & {"job", "named"}) == 1, (s, seen)
    assert min(kinds.values()) > 350


# --- nephron_diagram -----------------------------------------------------------------------------------

NEPHRON = ["glomerulus", "Bowman's capsule", "proximal convoluted tubule", "loop of Henle", "distal convoluted tubule",
           "collecting duct"]
SUBSTANCES = {"protein", "glucose", "urea", "mineral salts"}


def _value(v) -> Fraction:
    return Fraction(str(v))


def test_nephron_diagram():
    m = fam("nephron_diagram")
    for s in SEEDS:
        p, qs = run(m, s)
        labels, table = p["labels"], p["table"]
        at = {v: k for k, v in labels.items()}
        assert "glomerulus" in at, s
        assert set(table) == SUBSTANCES, s
        plasma, filtrate, urine = ({k: _value(v[i]) for k, v in table.items()} for i in range(3))
        # true to life: small molecules are filtered at the plasma's own concentration, protein is not; glucose is all
        # reabsorbed; urea and salts are concentrated in the urine
        assert filtrate["protein"] == 0 < plasma["protein"] and urine["protein"] == 0, s
        assert filtrate["glucose"] == plasma["glucose"] > 0 == urine["glucose"], s
        for k in ("urea", "mineral salts"):
            assert filtrate[k] == plasma[k] and urine[k] > filtrate[k], s
        assert 50 <= urine["urea"] / filtrate["urea"] <= 80, s
        if s <= DRAWN:
            fig, ax, words, _ = check_letters(m, p, NEPHRON)
            for name in NEPHRON:
                assert parts_named(ax, name), (s, name)
            # every value in the table is printed
            shown = set(words)
            for k, row in table.items():
                assert k.capitalize() in shown or k in shown, (s, k)
                for v in row:
                    assert any(_is(w, v) for w in shown), (s, k, v)
            # the glomerulus sits inside the capsule's cup
            gx, gy = centre(parts_named(ax, "glomerulus")[0])
            x0, y0, x1, y1 = bbox(parts_named(ax, "Bowman's capsule")[0])
            assert x0 < gx < x1 and y0 < gy < y1, s
            plt.close(fig)
        seen = set()
        for q in qs:
            st = q.stem
            if "no protein" in st:
                assert "too large" in picked(q), (s, picked(q))
                assert all("too large" not in o for o in wrong(q))
                seen.add("protein")
            elif "in the filtrate but not in the urine" in st:
                keys = [k for k in SUBSTANCES if filtrate[k] > 0 and urine[k] == 0]
                assert len(keys) == 1 and picked(q).lower() == keys[0], (s, picked(q))
                assert all(o.lower() in SUBSTANCES and o.lower() != keys[0] for o in wrong(q))
                seen.add("glucose")
            elif "how many times" in st.lower():
                ratio = urine["urea"] / filtrate["urea"]
                assert ratio.denominator == 1 and q.answer == str(ratio), (s, q.answer, ratio)
                assert "÷" in st  # the calculation is stated
                seen.add("urea")
            elif "filtered" in st:
                assert labels[picked(q)] == "glomerulus", (s, st)
                assert at.get("Bowman's capsule") not in q.options, (s, q.options)  # the capsule is arguable: not offered
                assert all(o in labels and labels[o] != "glomerulus" for o in wrong(q))
                seen.add("filter")
            else:
                pytest.fail(f"seed {s}: an unexpected question {st}")
        assert seen == {"filter", "glucose", "protein", "urea"}, (s, seen)


def _is(word, v) -> bool:
    try:
        return Fraction(word) == Fraction(str(v))
    except (ValueError, ZeroDivisionError):
        return False


# --- reflex_arc ----------------------------------------------------------------------------------------

ARC = ["receptor", "sensory neurone", "relay neurone", "motor neurone", "effector"]
REFLEX_PARTS = ARC + ["grey matter", "white matter"]


def _inside(outer, inner) -> bool:
    path = _data_path(outer)
    return all(path.contains_point(tuple(v)) for v in _data_path(inner).vertices[:-1])


def test_reflex_arc():
    m = fam("reflex_arc")
    for s in SEEDS:
        p, qs = run(m, s)
        labels = p["labels"]
        at = {v: k for k, v in labels.items()}
        assert set(ARC) <= set(at), s
        order = [at[x] for x in ARC]
        assert order != sorted(order) and order != sorted(order, reverse=True), s  # the letters do not give the order away
        if s <= DRAWN:
            fig, ax, words, flows = check_letters(m, p, REFLEX_PARTS)
            grey, white = parts_named(ax, "grey matter")[0], parts_named(ax, "white matter")[0]
            # the relay neurone lies wholly in the grey matter; the sensory neurone's cell body is outside the cord
            # (in the dorsal root ganglion) and the motor neurone's in the grey matter
            for pa in parts_named(ax, "relay neurone"):
                assert _inside(grey, pa), s
            body = {pa.get_gid(): pa for pa in ax.patches if (pa.get_gid() or "").startswith("cell body:")}
            assert not _data_path(white).contains_point(centre(body["cell body:sensory neurone"])), s
            assert _data_path(grey).contains_point(centre(body["cell body:motor neurone"])), s
            # impulses run receptor to effector: along each neurone, the arrow's head is nearer where it goes
            assert set(flows) == {"sensory neurone", "relay neurone", "motor neurone"}, (s, sorted(flows))
            goal = {"sensory neurone": centre(white), "relay neurone": centre(body["cell body:motor neurone"]),
                    "motor neurone": centre(parts_named(ax, "effector")[0])}
            for name, t in flows.items():
                assert math.dist(t.xy, goal[name]) < math.dist(t.xyann, goal[name]), (s, name)
            plt.close(fig)
        seen = set()
        for q in qs:
            st = q.stem
            if "order" in st:
                assert picked(q) == " → ".join(order), (s, picked(q))
                for o in wrong(q):
                    seq = o.split(" → ")
                    assert sorted(seq) == sorted(order) and seq != order, (s, o)
                seen.add("order")
            elif "effector" in st:
                ans = picked(q)
                assert ans.startswith(at["effector"] + ":") and "contracts" in ans, (s, ans)
                for o in wrong(q):
                    assert not (o.startswith(at["effector"] + ":") and "contracts" in o), (s, o)
                seen.add("effector")
            elif "relay neurone?" in st:
                assert labels[picked(q)] == "relay neurone" and all(labels[o] != "relay neurone" for o in wrong(q)), s
                seen.add("relay")
            else:
                pytest.fail(f"seed {s}: an unexpected question {st}")
        assert seen == {"order", "effector", "relay"}, (s, seen)


# --- arm_muscles ---------------------------------------------------------------------------------------

ARM = ["humerus", "radius", "ulna", "biceps", "triceps", "elbow joint", "tendon"]


def test_arm_muscles():
    m = fam("arm_muscles")
    moves = {"bend": 0, "straighten": 0}
    for s in SEEDS:
        p, qs = run(m, s)
        labels, move = p["labels"], p["move"]
        moves[move] += 1
        at = {v: k for k, v in labels.items()}
        assert "biceps" in at and "triceps" in at and ({"elbow joint", "tendon"} & set(at)), s
        working = "biceps" if move == "bend" else "triceps"
        resting = "triceps" if move == "bend" else "biceps"
        if s <= DRAWN:
            fig, ax, words, flows = check_letters(m, p, ARM)
            # the muscle that contracts is drawn shorter and fatter than the one that relaxes
            w, r = bbox(parts_named(ax, working)[0]), bbox(parts_named(ax, resting)[0])
            assert (w[3] - w[1]) < (r[3] - r[1]) and (w[2] - w[0]) > (r[2] - r[0]), s
            # the biceps lies in front of the humerus (the forearm's side), the triceps behind
            hx = centre(parts_named(ax, "humerus")[0])[0]
            assert centre(parts_named(ax, "biceps")[0])[0] > hx > centre(parts_named(ax, "triceps")[0])[0], s
            # the arrow shows the movement: the forearm rises to bend, falls to straighten
            (key, arrow), = flows.items()
            assert key == move, (s, key)
            assert (arrow.xy[1] > arrow.xyann[1]) == (move == "bend"), s
            plt.close(fig)
        seen = set()
        for q in qs:
            st = q.stem
            if "antagonistic" in st:
                pair = re.findall(r"\b([A-F])\b", st.split(".")[0])
                assert sorted(pair) == sorted([at["biceps"], at["triceps"]]), (s, st)
                ans = picked(q)
                assert "relaxes" in ans and "opposite" in ans, (s, ans)
                assert all("opposite" not in o for o in wrong(q))
                seen.add("antagonistic")
            elif "contract" in st:
                assert labels[picked(q)] == working, (s, st)
                assert ("bend" in st) == (move == "bend") and ("straighten" in st) == (move == "straighten"), (s, st)
                assert all(labels[o] != working for o in wrong(q))
                assert at[resting] in q.options  # the other muscle of the pair is offered: the likely slip
                seen.add("contract")
            elif got := re.search(r"Which letter shows (?:the|a) (joint|tendon)\b", st):
                name = "elbow joint" if got.group(1) == "joint" else "tendon"
                assert labels[picked(q)] == name and all(labels[o] != name for o in wrong(q)), (s, st)
                seen.add("joint")
            else:
                pytest.fail(f"seed {s}: an unexpected question {st}")
        assert seen == {"antagonistic", "contract", "joint"}, (s, seen)
    assert min(moves.values()) > 350
