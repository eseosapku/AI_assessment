"""Answers of the P6 life-science families (biology and Integrated/Primary Science), recomputed independently over
1,000 seeds from each figure's params and this file's own tables; the new sub-types of edited families checked the
same way, and their earlier sub-types checked unchanged; every thin topic each family was written for reached by name.

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
STORE = Path("C:/Users/Stephen/figure-library/figures.db")
# Topics no P6 life family may reach: sexual behaviour, values and health behaviour (the books' own pictures serve
# them), and chapters that are not about one thing a figure shows.
ALWAYS_NEVER = {"Pregnancy prevention", "Reducing risk of STIs and HIV and AIDS", "Sexual behaviour and sexual response",
                "Unit 17: Decision-making regarding sexual relationships",
                "Unit 18: HIV and AIDS (stigma, treatment, care and support)",
                "Unit 19: Sexual behaviour and sexual response", "Unit 16: Social factors that affect good health",
                "Glossary and index", "Science in Context", "Reproduction system"}


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
    """Every string the figure prints: texts, tick labels, titles, axis labels."""
    fig = m.draw(p)
    try:
        return [t.get_text() for ax in fig.axes for t in ax.texts] + \
               [t.get_text() for ax in fig.axes for t in ax.get_xticklabels() + ax.get_yticklabels()] + \
               [ax.get_title() for ax in fig.axes] + [ax.get_ylabel() for ax in fig.axes] + \
               [ax.get_xlabel() for ax in fig.axes] + [t.get_text() for t in fig.texts]
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


def num(text: str):
    t = text.replace(" ", "").replace(",", "")
    return float(t) if "." in t else int(t)


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


# ==== group a ====
# respiration_data, thermoregulation, digestive_system, diet_table, behaviour_data: every key recomputed from the params
# with this group's own tables, every letter checked against the drawing.

NEW_A = ("respiration_data", "thermoregulation", "digestive_system", "diet_table", "behaviour_data")
EDITED_A = ()
TARGETS_A = [
    ("respiration_data", "Unit 9: Cellular respiration", 9), ("respiration_data", "Cellular Respiration", None),
    ("respiration_data", "Energy from Respiration", None), ("respiration_data", "Energy and respiration", None),
    ("thermoregulation", "Regulation of Temperature", None),
    ("thermoregulation", "Unit 10: Skin and homeostatic mechanisms", 9),
    ("thermoregulation", "General Principles of Reception and Response in Animals", None),
    ("digestive_system", "Unit 7: Heterotrophic nutrition", 9), ("digestive_system", "Human nutrition", None),
    ("diet_table", "UNIT 9: VITAMINS AND MINERALS", None), ("diet_table", "Human nutrition", None),
    ("behaviour_data", "Behaviour and Responses in Mammals", None),
]
NEVER_A = {
    "respiration_data": {"Nutrition and transport", "Respiratory System", "Photosynthesis"},
    "thermoregulation": {"Regulation of Glucose", "Enzymes"},
    "digestive_system": {"Plant nutrition", "Photosynthesis"},
    "diet_table": {"Plant nutrition"},
    "behaviour_data": {"Regulation of Temperature"},
}


def _f_a(x) -> str:
    """A number as the family prints it: 0.7, 12, 37.4 (exactly, no trailing zeros)."""
    s = f"{x:.4f}".rstrip("0").rstrip(".")
    return s


# --- reading lettered drawings -------------------------------------------------------------------------

def _data_path_a(pa):
    return pa.get_path().transformed(pa.get_patch_transform())


def _topmost_a(ax, pt):
    hits = [(pa.get_zorder(), k, pa) for k, pa in enumerate(ax.patches)
            if pa.get_visible() and pa.get_fill() and pa.get_facecolor()[3] > 0
            and pa.get_transform().contains_branch(ax.transData) and _data_path_a(pa).contains_point(pt)]
    return max(hits, key=lambda h: (h[0], h[1]))[2] if hits else None


def _check_letters_a(m, p, known):
    """Every letter drawn once, its leader ending on its own part (the shape seen there), starting at its letter and
    crossing no other letter; returns the printed words."""
    fig = m.draw(p)
    try:
        ax = fig.axes[0]
        fig.canvas.draw()
        renderer = fig.canvas.get_renderer()
        labels = p["labels"]
        assert sorted(labels) == [chr(65 + i) for i in range(len(labels))], labels
        assert len(set(labels.values())) == len(labels) and set(labels.values()) <= set(known), labels
        letters = {t.get_gid()[7:]: t for t in ax.texts if (t.get_gid() or "").startswith("letter:")}
        leaders = {ln.get_gid()[7:]: ln for ln in ax.lines if (ln.get_gid() or "").startswith("leader:")}
        assert set(letters) == set(labels) == set(leaders), (sorted(letters), sorted(leaders))
        boxes = {k: t.get_window_extent(renderer) for k, t in letters.items()}
        for L, name in labels.items():
            assert letters[L].get_text() == L and letters[L].get_fontsize() >= 12
            xs, ys = leaders[L].get_data()
            seen = _topmost_a(ax, (float(xs[-1]), float(ys[-1])))
            assert seen is not None and seen.get_gid() == f"part:{name}", (L, name, seen and seen.get_gid())
            sx, sy = ax.transData.transform((float(xs[0]), float(ys[0])))
            b = boxes[L]
            assert math.hypot(max(b.x0 - sx, 0, sx - b.x1), max(b.y0 - sy, 0, sy - b.y1)) <= 20, L
            pts = ax.transData.transform(list(zip(xs, ys)))
            for other, ob in boxes.items():
                if other != L:
                    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
                        for k in range(41):
                            x, y = x0 + (x1 - x0) * k / 40, y0 + (y1 - y0) * k / 40
                            assert not (ob.x0 - 1 < x < ob.x1 + 1 and ob.y0 - 1 < y < ob.y1 + 1), (L, "crosses", other)
        return [t.get_text() for t in ax.texts]
    finally:
        plt.close(fig)


# --- respiration_data ----------------------------------------------------------------------------------

_SUBSTRATE_a = {1.0: "carbohydrate", 0.9: "protein", 0.7: "lipid (fat)"}


def _trend_a(temps, bubbles, a, b):
    seg = bubbles[temps.index(a):temps.index(b) + 1]
    steps = [y - x for x, y in zip(seg, seg[1:])]
    if all(s > 0 for s in steps):
        return "it rose all the way"
    if all(s < 0 for s in steps):
        return "it fell all the way"
    k = seg.index(max(seg))
    assert all(s > 0 for s in steps[:k]) and all(s < 0 for s in steps[k:]), seg
    return "it rose, then fell"


def test_respiration_data():
    m = fam("respiration_data")
    kinds = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        kinds[(p["band"], p["kind"])] += 1
        assert p["kind"] in ("yeast", "rq", "respirometer")
        assert p["band"] != "LS" or p["kind"] == "yeast"
        if p["kind"] == "yeast":
            t, b = p["temps"], p["bubbles"]
            assert b.count(max(b)) == 1 and 0 < b.index(max(b)) < len(b) - 1
            assert qs[0].answer == str(t[b.index(max(b))])
            a, c = map(int, re.search(r"at (\d+) °C than at (\d+) °C", qs[1].stem).groups())
            assert b[t.index(a)] > b[t.index(c)] and qs[1].answer == str(b[t.index(a)] - b[t.index(c)])
            a, c = map(int, re.search(r"from (\d+) °C to (\d+) °C", qs[2].stem).groups())
            assert picked(qs[2]) == _trend_a(t, b, a, c)
            one_correct(qs[2], lambda o: o == _trend_a(t, b, a, c))
        elif p["kind"] == "rq":
            seeds = {x["letter"]: x for x in p["seeds"]}
            rq = {k: x["co2"] / x["o2"] for k, x in seeds.items()}
            assert len({round(v, 6) for v in rq.values()}) == len(rq)
            for x in seeds.values():
                assert isinstance(x["co2"], int) and isinstance(x["o2"], int)
            X = re.search(r"seed ([A-D])\b", qs[0].stem).group(1)
            assert num(qs[0].answer) == pytest.approx(rq[X])
            Y = re.search(r"seed ([A-D])\b", qs[1].stem).group(1)
            assert round(rq[Y], 6) in _SUBSTRATE_a
            assert picked(qs[1]) == _SUBSTRATE_a[round(rq[Y], 6)]
            one_correct(qs[1], lambda o: o == _SUBSTRATE_a[round(rq[Y], 6)])
            top = max(rq, key=rq.get)
            assert picked(qs[2]) == top
            one_correct(qs[2], lambda o: o == top)
        else:
            T1, T2 = p["temps"]
            s1, s2 = p["rates"]
            assert s1 < s2
            rate = {T1: s1, T2: s2}
            T, t = map(int, re.search(r"at (\d+) °C.*?after (\d+) minutes", qs[0].stem).groups())
            assert qs[0].answer == str(rate[T] * t) and t in p["times"]
            T = int(re.search(r"at (\d+) °C", qs[1].stem).group(1))
            assert qs[1].answer == str(rate[T])
            t = int(re.search(r"after (\d+) minutes", qs[2].stem).group(1))
            assert qs[2].answer == str((s2 - s1) * t)
    assert {k for k, _ in kinds} == {"LS", "UP", "AL"} and len(kinds) == 7, kinds


def test_respiration_data_shows_every_value():
    m = fam("respiration_data")
    for s in DRAWN:
        p = m.sample(random.Random(s))
        words = " ".join(texts(m, p))
        if p["kind"] == "rq":
            for x in p["seeds"]:
                assert x["letter"] in words and str(x["o2"]) in words and str(x["co2"]) in words
            assert "RQ =" in words and "0.7" in words and "0.9" in words and "1.0" in words
        elif p["kind"] == "yeast":
            fig = m.draw(p)
            heights = sorted(round(r.get_height()) for r in fig.axes[0].patches if (r.get_gid() or "").startswith("bar:"))
            plt.close(fig)
            assert heights == sorted(p["bubbles"])
        else:
            fig = m.draw(p)
            ax = fig.axes[0]
            lines = {ln.get_gid(): ln for ln in ax.lines if (ln.get_gid() or "").startswith("seeds:")}
            for T, r in zip(p["temps"], p["rates"]):
                xs, ys = lines[f"seeds:{T}"].get_data()
                assert list(xs) == p["times"] and list(ys) == [r * t for t in p["times"]]
            # every value on a gridline: the y gridlines are every 2 mm
            assert all(r * t % 2 == 0 for r in p["rates"] for t in p["times"])
            plt.close(fig)


# --- thermoregulation --------------------------------------------------------------------------------

_SKIN_ROLE_a = {
    "sweat gland": "makes sweat",
    "hair erector muscle": "contracts in the cold",
    "blood vessel": "widens in the heat",
    "fat layer": "insulates",
    "sweat duct": "carries sweat up",
    "hair": "traps a layer of warm air",
    "epidermis": "outer layer",
    "sensory nerve ending": "detects heat",
}


def test_thermoregulation():
    m = fam("thermoregulation")
    kinds = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        kinds[(p["band"], p["kind"])] += 1
        if p["kind"] == "skin":
            at = {v: k for k, v in p["labels"].items()}
            part = re.search(r"Which letter shows the (.+?)\?", qs[0].stem).group(1)
            assert picked(qs[0]) == at[part]
            roles = [k for k, v in _SKIN_ROLE_a.items() if v in qs[1].stem]
            assert len(roles) == 1 and picked(qs[1]) == at[roles[0]], (qs[1].stem, roles)
            L = re.search(r"labelled ([A-H])\b", qs[2].stem).group(1)
            assert picked(qs[2]) == p["labels"][L]
            one_correct(qs[2], lambda o: o == p["labels"][L])
        elif p["kind"] == "endo_ecto":
            endo = next(a for a in p["animals"] if a["endo"])
            ecto = next(a for a in p["animals"] if not a["endo"])
            assert picked(qs[0]) == f"animal {endo['letter']}"
            one_correct(qs[0], lambda o: o == f"animal {endo['letter']}")
            T = int(re.search(r"surroundings were at (\d+) °C", qs[1].stem).group(1))
            assert f"animal {ecto['letter']}" in qs[1].stem and qs[1].answer == str(T + ecto["offset"])
            lo, hi = p["range"]
            assert lo <= T <= hi and lo <= endo["body"] - ecto["offset"] <= hi
            assert qs[2].answer == str(endo["body"] - ecto["offset"])
        else:
            knots = p["knots"]
            vals = [v for _, v in knots]
            ext = max(vals) if p["mode"] == "hot" else min(vals)
            assert vals.count(ext) == 1 and knots[0][1] == 37.0
            assert num(qs[0].answer) == pytest.approx(ext)
            i = vals.index(ext)
            back = next(t for t, v in knots[i:] if v == 37.0)
            assert qs[1].answer == str(back)
            assert num(qs[2].answer) == pytest.approx(round(abs(ext - 37.0), 1))
            assert all(abs(v * 5 - round(v * 5)) < 1e-9 for v in vals)  # on the 0.2 °C gridlines
    assert {k for k, _ in kinds} == {"LS", "UP"} and len(kinds) == 6, kinds


def test_thermoregulation_letters_and_lines():
    m = fam("thermoregulation")
    for s in range(1, 81):
        p = m.sample(random.Random(s))
        if p["kind"] == "skin":
            words = " ".join(_check_letters_a(m, p, _SKIN_ROLE_a))
            for part in p["labels"].values():
                assert part.capitalize() in words  # the role table names every lettered part
        elif p["kind"] == "endo_ecto":
            fig = m.draw(p)
            ax = fig.axes[0]
            for a in p["animals"]:
                xs, ys = next(ln for ln in ax.lines if ln.get_gid() == f"animal:{a['letter']}").get_data()
                for x, y in zip(xs, ys):
                    assert y == (a["body"] if a["endo"] else x + a["offset"])
            plt.close(fig)


# --- digestive_system ----------------------------------------------------------------------------------

_GUT_ROLE_a = {
    "oesophagus": "carries food from the mouth to the stomach",
    "stomach": "digests protein in acid",
    "liver": "makes bile",
    "gall bladder": "stores bile",
    "pancreas": "makes digestive enzymes",
    "small intestine": "absorbs most of the digested food",
    "large intestine": "absorbs water",
    "rectum": "stores faeces",
}
_FORMULA_a = {"human": ([2, 1, 2, 3], [2, 1, 2, 3]), "dog": ([3, 1, 4, 2], [3, 1, 4, 3]), "cat": ([3, 1, 3, 1], [3, 1, 2, 1]),
              "sheep": ([0, 0, 3, 3], [3, 1, 3, 3]), "rabbit": ([2, 0, 3, 3], [1, 0, 2, 3]),
              "pig": ([3, 1, 4, 3], [3, 1, 4, 3])}
_KINDS_a = ["incisor", "canine", "premolar", "molar"]


def test_digestive_system():
    m = fam("digestive_system")
    kinds = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        kinds[(p["band"], p["kind"])] += 1
        if p["kind"] == "canal":
            at = {v: k for k, v in p["labels"].items()}
            for q in (qs[0], qs[2]):
                roles = [k for k, v in _GUT_ROLE_a.items() if v in q.stem]
                assert len(roles) == 1 and roles[0] in at and picked(q) == at[roles[0]], q.stem
            L = re.search(r"labelled ([A-H])\b", qs[1].stem).group(1)
            assert picked(qs[1]) == p["labels"][L]
            one_correct(qs[1], lambda o: o == p["labels"][L])
        else:
            up, low = p["upper"], p["lower"]
            assert (up, low) in _FORMULA_a.values()
            assert qs[0].answer == str(2 * (sum(up) + sum(low)))
            kind = re.search(r"How many (\w+) teeth", qs[1].stem).group(1)
            k = _KINDS_a.index(kind)
            assert qs[1].answer == str(2 * (up[k] + low[k])) and up[k] + low[k] > 0
            jaw = re.search(r"half of the (upper|lower) jaw", qs[2].stem).group(1)
            assert qs[2].answer == str(sum(up if jaw == "upper" else low))
    assert set(kinds) == {("LS", "canal"), ("UP", "canal"), ("LS", "teeth")}, kinds


def test_digestive_system_draws_its_parts_and_teeth():
    m = fam("digestive_system")
    for s in range(1, 81):
        p = m.sample(random.Random(s))
        if p["kind"] == "canal":
            words = _check_letters_a(m, p, _GUT_ROLE_a)
            assert all(name.capitalize() in words for name in p["labels"].values())
        else:
            fig = m.draw(p)
            ax = fig.axes[0]
            got = Counter(pa.get_gid().split(":")[1:3][0] + ":" + pa.get_gid().split(":")[2] for pa in ax.patches
                          if (pa.get_gid() or "").startswith("tooth:"))
            plt.close(fig)
            for jaw, row in (("upper", p["upper"]), ("lower", p["lower"])):
                for kind, n in zip(_KINDS_a, row):
                    assert got[f"{jaw}:{kind}"] == n, (s, jaw, kind, got)


# --- diet_table --------------------------------------------------------------------------------------

_NUTRIENT_a = {"protein": "kwashiorkor", "vitamin C": "scurvy", "iron": "anaemia", "calcium": "rickets"}
_KEY_a = {"protein": "protein", "vitamin C": "vitc", "iron": "iron", "calcium": "calcium"}


def test_diet_table():
    m = fam("diet_table")
    kinds = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        kinds[(p["band"], p["kind"])] += 1
        if p["kind"] == "nutrients":
            foods = {f["letter"]: f for f in p["foods"]}
            nut = re.search(r"best source of (protein|vitamin C|iron|calcium)", qs[0].stem).group(1)
            vals = {k: f[_KEY_a[nut]] for k, f in foods.items()}
            best = max(vals, key=vals.get)
            assert list(vals.values()).count(vals[best]) == 1
            assert picked(qs[0]) == f"food {best}"
            one_correct(qs[0], lambda o: o == f"food {best}")
            X = re.search(r"grams of food ([P-T])\b", qs[1].stem).group(1)
            nut = re.search(r"daily need of (protein|vitamin C|iron|calcium)", qs[1].stem).group(1)
            g = p["need"][_KEY_a[nut]] * 100 / foods[X][_KEY_a[nut]]
            assert g == int(g) and qs[1].answer == str(int(g))
            X, Y = re.search(r"only foods ([P-T]) and ([P-T])\b", qs[2].stem).groups()
            lacking = [n for n, k in _KEY_a.items() if foods[X][k] == 0 and foods[Y][k] == 0]
            assert len(lacking) == 1
            assert _NUTRIENT_a[lacking[0]] in picked(qs[2])
            one_correct(qs[2], lambda o: _NUTRIENT_a[lacking[0]] in o)
        else:
            vol = {j["letter"]: j["volume"] for j in p["juices"]}
            assert len(set(vol.values())) == len(vol)
            most = min(vol, key=vol.get)
            assert picked(qs[0]) == f"juice {most}"
            one_correct(qs[0], lambda o: o == f"juice {most}")
            X = re.search(r"juice ([A-E])\b", qs[1].stem).group(1)
            assert num(qs[1].answer) == pytest.approx(p["mass"] / vol[X])
            if "times" in qs[2].stem:
                X, Y = re.search(r"juice ([A-E]) contain than juice ([A-E])", qs[2].stem).groups()
                r = vol[Y] / vol[X]
                assert r == int(r) and qs[2].answer == str(int(r))
            else:
                least = max(vol, key=vol.get)
                assert picked(qs[2]) == f"juice {least}"
    assert set(kinds) == {("LS", "nutrients"), ("LS", "dcpip"), ("UP", "nutrients"), ("UP", "dcpip")}, kinds


def test_diet_table_prints_every_value():
    m = fam("diet_table")
    for s in DRAWN:
        p = m.sample(random.Random(s))
        words = texts(m, p)
        if p["kind"] == "nutrients":
            for f in p["foods"]:
                row = [w for w in words if w == f"Food {f['letter']}"]
                assert row, f["letter"]
            for d in _NUTRIENT_a.values():
                assert any(d in w for w in words), d
            for k in ("protein", "vitc", "iron", "calcium"):
                assert all(_f_a(f[k]) in words for f in p["foods"])
                assert _f_a(p["need"][k]) in words
        else:
            assert _f_a(p["mass"]) in " ".join(words)
            assert all(f"{j['volume']:.1f}" in words for j in p["juices"])


# --- behaviour_data ----------------------------------------------------------------------------------

_BLOCKS_a = [f"{h:02d}:00" for h in range(0, 24, 2)]


def test_behaviour_data():
    m = fam("behaviour_data")
    kinds = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        kinds[p["kind"]] += 1
        assert p["band"] == "UP"
        if p["kind"] == "maze":
            g = {x["letter"]: x["errors"] for x in p["groups"]}
            X, d = re.search(r"group ([PQ]) make on day (\d+)", qs[0].stem).groups()
            assert qs[0].answer == str(g[X][int(d) - 1])
            X, k = re.search(r"did group ([PQ]) first make fewer than (\d+) errors", qs[1].stem).groups()
            day = next(i + 1 for i, e in enumerate(g[X]) if e < int(k))
            assert qs[1].answer == str(day)
            d = int(re.search(r"on day (\d+)", qs[2].stem).group(1))
            a, b = g["P"][d - 1], g["Q"][d - 1]
            assert a != b
            key = "group P" if a < b else "group Q"
            assert picked(qs[2]) == key
            one_correct(qs[2], lambda o: o == key)
        else:
            c = p["counts"]
            dark = sum(c[i] for i in (0, 1, 2, 9, 10, 11))
            light = sum(c[3:9])
            assert abs(dark - light) >= 100
            key = "mainly at night" if dark > light else "mainly by day"
            assert picked(qs[0]) == key
            one_correct(qs[0], lambda o: o == key)
            h = re.search(r"from (\d\d:00) to", qs[1].stem).group(1)
            assert qs[1].answer == str(c[_BLOCKS_a.index(h)])
            assert qs[2].answer == str(dark)
            assert all(v % 10 == 0 for v in c)
    assert set(kinds) == {"maze", "activity"}, kinds


# ==== group b ====
# Genetics, evolution and cells: gene technology (gels, restriction maps, the steps of making insulin), selection
# (moths in two woods, selective breeding, Hardy-Weinberg, molecular differences), gene mutations read through a
# printed codon table, gametogenesis, the mitotic index and the DNA content of a dividing cell; punnett drawn for
# Lower Secondary too and variation_chart for AS Level.

NEW_B = ("gene_technology", "selection_data", "mutation_sequence", "gametogenesis", "mitotic_index")
# variation_chart is edited too (an AS Level band) but stays out of EDITED_B: its histogram's class labels have printed at
# 7 pt since P3i and its earlier figures must not change; its own tests are below.
EDITED_B = ("punnett",)
TARGETS_B = [
    ("gene_technology", "Genetic technology", None), ("gene_technology", "Principles of Gene Technology", None),
    ("gene_technology", "Application of Gene Technology", None), ("gene_technology", "Unit 21: Gene technology", 9),
    ("selection_data", "Unit 23: Natural and artificial selection", 9),
    ("selection_data", "Natural and Artificial Selection", None), ("selection_data", "Evolution and Speciation", None),
    ("selection_data", "Selection and evolution", None),
    ("mutation_sequence", "Mutations", None),
    ("gametogenesis", "Human Reproductive System and Gametogenesis", None),
    ("mitotic_index", "The mitotic cell cycle", None),
    ("punnett", "Unit 20: Genetics", 9),
    ("variation_chart", "Selection and evolution", None),
]
NEVER_B = {
    "gene_technology": {"Inherited change", "Unit 20: Genetics", "Unit 22: Variation and adaptive features",
                        "UNIT 19: CULTURING MICRO-ORGANISMS", "Microbiology", "DNA Replication"},
    "selection_data": {"Biodiversity, classification and conservation", "Classification", "Variation", "Mutations",
                       "Effect of Human Activities on Ecosystem", "Unit 22: Variation and adaptive features",
                       "UNIT 16: ASEXUAL REPRODUCTION IN PLANTS", "Application of Gene Technology"},
    "mutation_sequence": {"Evolution and Speciation", "Natural and Artificial Selection", "The mitotic cell cycle",
                          "Genetic technology", "Human Reproductive System and Gametogenesis", "Variation"},
    "gametogenesis": {"Mutations", "Unit 6: Mitosis and meiosis", "Inherited change", "Cell and Nuclear Division"},
    "mitotic_index": {"Inherited change", "Nucleic acids and protein synthesis", "Genetic technology"},
    "punnett": {"Unit 6: Mitosis and meiosis", "Unit 23: Natural and artificial selection",
                "Unit 22: Variation and adaptive features"},
    "variation_chart": {"Inherited change", "The mitotic cell cycle"},
}

# --- the standard genetic code, built here from its compact form (bases in the order T C A G) -------------------------
_BASES_b = "TCAG"
_CODE_b = "FFLLSSSSYY**CC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG"
_AA_b = {"F": "phenylalanine", "L": "leucine", "S": "serine", "Y": "tyrosine", "C": "cysteine", "W": "tryptophan",
         "P": "proline", "H": "histidine", "Q": "glutamine", "R": "arginine", "I": "isoleucine", "M": "methionine",
         "T": "threonine", "N": "asparagine", "K": "lysine", "V": "valine", "A": "alanine", "D": "aspartic acid",
         "E": "glutamic acid", "G": "glycine", "*": "stop"}


def _amino_b(triplet: str) -> str:
    i = 16 * _BASES_b.index(triplet[0]) + 4 * _BASES_b.index(triplet[1]) + _BASES_b.index(triplet[2])
    return _AA_b[_CODE_b[i]]


def _triplets_b(seq: str) -> list:
    return [seq[i:i + 3] for i in range(0, len(seq) - 2, 3)]


# --- gene_technology ----------------------------------------------------------------------------------------------

_LADDER_b = [100, 200, 300, 400, 500, 600, 800, 1000, 1200, 1500, 2000, 2500, 3000]
_ENZYME_b = {1: "restriction enzyme", 2: "restriction enzyme", 3: "DNA ligase"}


def test_gene_technology():
    m = fam("gene_technology")
    kinds = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        kinds[p["kind"]] += 1
        if p["kind"] == "steps":
            assert p["band"] in ("LS", "UP")
            letters = p["letters"]
            assert sorted(letters.values()) == [1, 2, 3, 4, 5, 6] and sorted(letters) == list("ABCDEF")
            by_step = {v: k for k, v in letters.items()}
            q = qs[0]
            k = int(re.search(r"step (\d)", q.stem).group(1))
            one_correct(q, lambda o: o == by_step[k])
            q = qs[1]
            x = re.search(r"picture ([A-F])", q.stem).group(1)
            assert q.answer == str(letters[x])
            q = qs[2]
            x = re.search(r"picture ([A-F])", q.stem).group(1)
            one_correct(q, lambda o: o == _ENZYME_b[letters[x]])
            continue
        assert p["band"] in ("UP", "AL")
        lanes = {name: set(b) for name, b in p.get("lanes", [])}
        for name, bands in lanes.items():
            assert bands <= set(_LADDER_b), (s, name)
        if p["kind"] == "forensic":
            scene = lanes["Crime scene"]
            match = [n for n in lanes if n.startswith("Suspect") and lanes[n] == scene]
            assert len(match) == 1, s
            one_correct(qs[0], lambda o: o == match[0])
            assert num(qs[1].answer) == min(scene)
            who = re.search(r"(Suspect \d)", qs[2].stem).group(1)
            assert who != match[0] and num(qs[2].answer) == len(lanes[who] & scene)
        elif p["kind"] == "paternity":
            mother, child = lanes["Mother"], lanes["Child"]
            fromdad = child - mother
            assert fromdad and child & mother
            dads = [n for n in lanes if n.startswith("Man") and fromdad <= lanes[n]]
            assert len(dads) == 1, s
            assert not (lanes[dads[0]] & mother & child), s  # no band of the child could be from either parent
            one_correct(qs[0], lambda o: o == dads[0])
            assert num(qs[1].answer) == max(fromdad)
            assert num(qs[2].answer) == len(child & mother)
        else:
            sites, length = p["sites"], p["length"]
            cuts = [0, *sites, length]
            frags = sorted(b - a for a, b in zip(cuts, cuts[1:]))
            right = [n for n, b in p["gel"].items() if sorted(b) == frags]
            assert len(right) == 1, s
            one_correct(qs[0], lambda o: o == f"lane {right[0]}")
            assert num(qs[1].answer) == len(frags)
            assert num(qs[2].answer) == max(frags)
            for b in p["gel"].values():
                assert set(b) <= set(_LADDER_b)
    assert set(kinds) == {"steps", "forensic", "paternity", "restriction"} and min(kinds.values()) > 120, kinds


def test_gene_technology_prints_what_it_asks():
    m = fam("gene_technology")
    for s in DRAWN:
        p = m.sample(random.Random(s))
        words = " ".join(texts(m, p))
        if p["kind"] == "steps":
            for k in range(1, 7):
                assert f"{k} " in words or f"{k}." in words
            assert "restriction enzyme" in words and "DNA ligase" in words
            fig = m.draw(p)
            pics = {pa.get_gid() for ax in fig.axes for pa in ax.patches if (pa.get_gid() or "").startswith("pic:")}
            plt.close(fig)
            for letter, step in p["letters"].items():
                assert f"pic:{letter}:{step}" in pics, (s, letter, step, pics)
        else:
            for size in _LADDER_b:
                assert str(size) in words, (s, size)
            assert "+" in words and ("−" in words or "-" in words)


# --- selection_data -----------------------------------------------------------------------------------------------

def test_selection_data():
    m = fam("selection_data")
    kinds = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        kinds[(p["kind"], p["band"])] += 1
        if p["kind"] == "moth":
            rows = {(w, f): (r, c) for w, f, r, c in p["rows"]}
            pct = {k: 100 * c / r for k, (r, c) in rows.items()}
            assert all(v == int(v) for v in pct.values()) and len(set(pct.values())) == 4, s
            assert pct[("sooty", "dark")] > pct[("sooty", "pale")] and pct[("clean", "pale")] > pct[("clean", "dark")]
            w, f = p["ask"]
            assert num(qs[0].answer) == pct[(w, f)]
            low = min(pct, key=pct.get)
            one_correct(qs[1], lambda o: o == f"{low[1]} moths in the {low[0]} wood")
            dw = p["diff_wood"]
            assert num(qs[2].answer) == abs(pct[(dw, "dark")] - pct[(dw, "pale")])
        elif p["kind"] == "breeding":
            v = p["values"]
            assert all(b > a for a, b in zip(v, v[1:])) and all(x % p["step"] == 0 for x in v)
            a, b = p["span"]
            assert num(qs[0].answer) == v[b] - v[a]
            first = next(i for i, x in enumerate(v) if x >= p["threshold"])
            assert num(qs[1].answer) == first and p["threshold"] > v[0]
            inc = 100 * (v[-1] - v[0]) / v[0]
            assert inc == int(inc) and num(qs[2].answer) == inc
        elif p["kind"] == "hardy":
            assert p["band"] in ("UP", "AL")
            n, rec = p["total"], p["recessive"]
            q = math.sqrt(rec / n)
            assert abs(q * 10 - round(q * 10)) < 1e-9
            assert abs(num(qs[0].answer) - q) < 1e-9
            assert abs(num(qs[1].answer) - (1 - q)) < 1e-9
            het = 2 * q * (1 - q) * n
            assert abs(num(qs[2].answer) - het) < 1e-6 and abs(het - round(het)) < 1e-6
        else:
            assert p["band"] in ("UP", "AL")
            d, names = p["d"], p["names"]
            k = len(names)
            assert all(d[i][j] == d[j][i] and (d[i][j] > 0) == (i != j) for i in range(k) for j in range(k))
            x = names.index(re.search(r"related to species (\w)\?", qs[0].stem).group(1))
            row = [(d[x][j], names[j]) for j in range(k) if j != x]
            assert sorted(row)[0][0] < sorted(row)[1][0], s
            one_correct(qs[0], lambda o: o == f"species {min(row)[1]}")
            i, j = p["pair"]
            assert num(qs[1].answer) == d[i][j]
            y = names.index(re.search(r"related to species (\w)\?", qs[2].stem).group(1))
            row = [(d[y][j], names[j]) for j in range(k) if j != y]
            assert sorted(row)[-1][0] > sorted(row)[-2][0], s
            one_correct(qs[2], lambda o: o == f"species {max(row)[1]}")
    assert {k for k, _ in kinds} == {"moth", "breeding", "hardy", "molecular"}, kinds
    assert {b for _, b in kinds} == {"LS", "UP", "AL"} and min(kinds.values()) > 25, kinds


def test_selection_data_prints_its_numbers_and_rules():
    m = fam("selection_data")
    for s in range(1, 81):
        p = m.sample(random.Random(s))
        words = " ".join(texts(m, p))
        if p["kind"] == "moth":
            for _, _, r, c in p["rows"]:
                assert str(r) in words and str(c) in words
        elif p["kind"] == "breeding":
            fig = m.draw(p)
            ax = fig.axes[0]
            ticks = [float(t) for t in ax.get_yticks()]
            plt.close(fig)
            assert all(v in ticks for v in p["values"]), (s, ticks)
        elif p["kind"] == "hardy":
            assert "p + q = 1" in words and "p² + 2pq + q² = 1" in words
            assert str(p["total"]) in words and str(p["recessive"]) in words
        else:
            for row in p["d"]:
                for v in row:
                    if v:
                        assert str(v) in words


# --- mutation_sequence --------------------------------------------------------------------------------------------

def test_mutation_sequence():
    m = fam("mutation_sequence")
    kinds = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        a, b = p["original"], p["mutated"]
        kinds[p["type"]] += 1
        assert len(a) % 3 == 0 and a.startswith("ATG")
        for t in _triplets_b(a) + _triplets_b(b):
            assert _amino_b(t) != "stop", (s, t)
        if len(b) == len(a) + 1:
            kind = "insertion"
            assert any(b[:i] + b[i + 1:] == a for i in range(len(b)))
        elif len(b) == len(a) - 1:
            kind = "deletion"
            assert any(a[:i] + a[i + 1:] == b for i in range(len(a)))
        else:
            diff = [i for i in range(len(a)) if a[i] != b[i]]
            if len(diff) == 1:
                kind = "substitution"
            else:
                kind = "inversion"
                i0 = diff[0]
                assert b[i0:i0 + 3] == a[i0:i0 + 3][::-1] and a[:i0] == b[:i0] and a[i0 + 3:] == b[i0 + 3:], s
        assert kind == p["type"]
        assert sorted(qs[0].options) == ["deletion", "insertion", "inversion", "substitution"]
        one_correct(qs[0], lambda o: o == kind)
        k = int(re.search(r"triplet (\d)", qs[1].stem).group(1))
        assert qs[1].answer == _amino_b(_triplets_b(b)[k - 1])
        changed = sum(_amino_b(x) != _amino_b(y) for x, y in zip(_triplets_b(a), _triplets_b(b)))
        assert num(qs[2].answer) == changed
    assert set(kinds) == {"substitution", "insertion", "deletion", "inversion"} and min(kinds.values()) > 150, kinds


def test_mutation_sequence_codon_table_is_the_genetic_code():
    m = fam("mutation_sequence")
    for s in DRAWN:
        p = m.sample(random.Random(s))
        words = texts(m, p)
        for t in set(_triplets_b(p["original"]) + _triplets_b(p["mutated"])):
            # each triplet's row of the table prints the triplet and its amino acid together
            assert any(w.startswith(t) and w.endswith(_amino_b(t)) for w in words), (s, t)


# --- gametogenesis ------------------------------------------------------------------------------------------------

_PLOIDY_b = {"spermatogonium": 2, "primary spermatocyte": 2, "secondary spermatocyte": 1, "spermatid": 1, "sperm": 1,
             "oogonium": 2, "primary oocyte": 2, "secondary oocyte": 1, "first polar body": 1, "ovum": 1,
             "second polar body": 1}
_MADE_BY_b = {"secondary spermatocyte": "meiosis I", "spermatid": "meiosis II", "secondary oocyte": "meiosis I",
              "first polar body": "meiosis I", "ovum": "meiosis II", "second polar body": "meiosis II"}
_CHROMOSOMES_b = {"human": 46, "cow": 60, "goat": 60, "dog": 78, "cat": 38, "rabbit": 44, "pig": 38, "sheep": 54,
                  "horse": 64, "mouse": 40}


def test_gametogenesis():
    m = fam("gametogenesis")
    seen = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        assert p["two_n"] == _CHROMOSOMES_b[p["animal"]]
        cells = p["cells"]
        kind = {c["id"]: c["kind"] for c in cells}
        for letter, q in zip("PQ", qs[:2]):
            assert f"cell {letter}" in q.stem
            assert num(q.answer) == p["two_n"] * _PLOIDY_b[kind[p["letters"][letter]]] // 2
        assert kind[p["letters"]["Q"]] in _MADE_BY_b
        one_correct(qs[2], lambda o: o == _MADE_BY_b[kind[p["letters"]["Q"]]])
        seen[p["process"]] += 1
        if p["process"] == "sperm":
            assert Counter(kind.values()) == {"spermatogonium": 1, "primary spermatocyte": 1,
                                              "secondary spermatocyte": 2, "spermatid": 4, "sperm": 4}
        else:
            got = Counter(kind.values())
            assert got["oogonium"] == got["primary oocyte"] == got["secondary oocyte"] == got["ovum"] == 1
    assert min(seen.values()) > 400


def test_gametogenesis_numbers_shown_and_letters_hidden():
    m = fam("gametogenesis")
    for s in DRAWN:
        p = m.sample(random.Random(s))
        fig = m.draw(p)
        words = [t.get_text() for ax in fig.axes for t in ax.texts]  # what the diagram prints (no hidden ticks)
        plt.close(fig)
        assert f"2n = {p['two_n']}" in " ".join(words)
        for letter in "PQ":
            assert letter in words
        shown = [w for w in words if w.isdigit()]
        lettered = set(p["letters"].values())
        assert len(shown) == len([c for c in p["cells"] if c["id"] not in lettered]), (s, shown)


# --- mitotic_index ------------------------------------------------------------------------------------------------

_MITOSIS_b = {"P": "prophase", "M": "metaphase", "A": "anaphase", "T": "telophase"}


def test_mitotic_index():
    m = fam("mitotic_index")
    kinds = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        kinds[p["kind"]] += 1
        assert p["band"] == "AL"
        if p["kind"] == "field":
            st = p["stages"]
            assert len(st) == p["rows"] * p["cols"]
            dividing = sum(1 for x in st if x != "I")
            mi = dividing / len(st)
            assert num(qs[0].answer) == dividing
            assert abs(num(qs[1].answer) - mi) < 1e-12
            c = Counter(x for x in st if x != "I")
            top = max(c.values())
            assert list(c.values()).count(top) == 1
            one_correct(qs[2], lambda o: o == _MITOSIS_b[max(c, key=c.get)])
            minutes = dividing * p["cycle_hours"] * 60 / len(st)
            assert minutes == int(minutes) and num(qs[3].answer) == minutes
            assert dividing * 10 ** 6 % len(st) == 0  # the index is a terminating decimal
        else:
            g1, sp, g2m, x = p["g1"], p["s"], p["g2m"], p["x"]
            assert num(qs[0].answer) == sp
            assert num(qs[1].answer) == g1 + sp + g2m
            assert num(qs[2].answer) == 2 * x
            assert num(qs[3].answer) == g1 + sp + g2m + g1
    assert set(kinds) == {"field", "dna"}


def test_mitotic_index_draws_each_cell_as_its_stage():
    m = fam("mitotic_index")
    for s in DRAWN:
        p = m.sample(random.Random(s))
        if p["kind"] != "field":
            fig = m.draw(p)
            ax = fig.axes[0]
            xt = [float(t) for t in list(ax.get_xticks(minor=True)) + list(ax.get_xticks())]
            yt = [float(t) for t in ax.get_yticks()]
            plt.close(fig)
            cycle = p["g1"] + p["s"] + p["g2m"]
            for t in (p["g1"], p["g1"] + p["s"], cycle, cycle + p["g1"]):
                assert t in xt, (s, t)
            assert p["x"] in yt and 2 * p["x"] in yt
            continue
        fig = m.draw(p)
        gids = [pa.get_gid() for ax in fig.axes for pa in ax.patches if (pa.get_gid() or "").startswith("cell:")]
        plt.close(fig)
        assert sorted(gids) == sorted(f"cell:{i}:{x}" for i, x in enumerate(p["stages"])), s
        words = " ".join(texts(m, p))
        assert "mitotic index" in words.lower() and str(p["cycle_hours"]) in words


# --- edited families: punnett (Lower Secondary) and variation_chart (AS Level) -------------------------------------

def test_punnett_draws_for_lower_secondary_unchanged():
    m = fam("punnett")
    bands = Counter()
    for s in range(1, 401):
        p, qs = run(m, s)
        bands[p.get("band", "UP")] += 1
        r, c = p["blank"]
        alleles = sorted(p["p1"][r] + p["p2"][c], key=lambda ch: (ch.islower(), ch))
        assert picked(qs[0]) == "".join(alleles)
    assert bands["LS"] > 60 and bands["UP"] > 200, bands
    assert set(m.BANDS) == {"UP", "LS"} and m.BANDS[0] == "UP"


def test_variation_chart_draws_for_as_level_unchanged():
    m = fam("variation_chart")
    bands = Counter(m.sample(random.Random(s))["band"] for s in range(1, 401))
    assert set(bands) == {"LS", "UP", "AL"} and bands["AL"] > 50, bands
    for s in range(1, 200):
        p, qs = run(m, s)
        if p["band"] == "AL":  # the same charts and questions as at LS and UP
            assert picked(qs[0]) == f"chart {p['continuous']['letter']}"


def test_variation_chart_reaches_no_topic_it_cannot_serve(index):
    link, ix, _ = index
    by_key = {t["key"]: t for t in ix}
    reached = {by_key[k]["name"].strip() for k in link.reach(ix, fam("variation_chart"), 200)}
    assert not reached & (ALWAYS_NEVER | NEVER_B["variation_chart"]), sorted(reached)


# ==== group c ====
# Ecology, plants, disease, membranes; quadrat's AL Simpson's index and food tests at AS Level.

NEW_C = ("membrane_transport", "predator_prey", "human_impact", "plant_gas_exchange", "asexual_plants", "disease_data")
EDITED_C = ("quadrat", "food_test_table")
TARGETS_C = [
    ("membrane_transport", "Passive movement of substances across a cell membrane", 8),
    ("membrane_transport", "Active transport", 8),
    ("predator_prey", "Unit 1: Interdependence among organisms in an ecosystem", 9),
    ("predator_prey", "Interdependence Between Organisms Within Their Environment", None),
    ("human_impact", "Unit 4: Effects of human activities on ecosystems 1", 9),
    ("human_impact", "Unit 5: Effects of human activities on ecosystems 2 (conservation and sustainability)", 9),
    ("human_impact", "Effect of Human Activities on Ecosystem", None),
    ("plant_gas_exchange", "UNIT 12: GAS EXCHANGE IN PLANTS", None),
    ("asexual_plants", "UNIT 16: ASEXUAL REPRODUCTION IN PLANTS", None),
    ("disease_data", "UNIT 15: CLASSIFICATION AND PATTERNS OF DISEASE", None),
    ("quadrat", "Biodiversity, classification and conservation", None),
    ("food_test_table", "Biological molecules", None),
]
NEVER_C = {
    "membrane_transport": {"Excretion and Osmoregulation", "Unit 7: Heterotrophic nutrition", "Human nutrition"},
    "predator_prey": {"Classification", "Unit 4: Effects of human activities on ecosystems 1"},
    "human_impact": {"Unit 1: Interdependence among organisms in an ecosystem", "Smoking and Related Diseases"},
    "plant_gas_exchange": {"Gas exchange in humans", "Gas Exchange in Animals"},
    "asexual_plants": {"UNIT 17: SEXUAL REPRODUCTION IN PLANTS", "Human Reproductive System and Gametogenesis"},
    "disease_data": {"Smoking and Related Diseases", "Diseases and immunity"},
    "quadrat": set(),
    "food_test_table": {"Cell membranes and transport"},
}


def _counts_c(q) -> int:
    return int(re.match(r"-?\d+", q.answer).group())


# --- membrane_transport ------------------------------------------------------------------------------------

_DIRS_c = ["into the cell, by diffusion", "out of the cell, by diffusion", "into the cell, by active transport",
           "out of the cell, by active transport"]


def test_membrane_transport():
    m = fam("membrane_transport")
    kinds = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        kinds[p["kind"]] += 1
        if p["kind"] == "diffusion":
            out, inn = len(p["outside"]), len(p["inside"])
            assert abs(out - inn) >= 4 and (out + inn) % 2 == 0, s
            for q in qs:
                if q.kind == "mcq":
                    assert sorted(q.options) == sorted(_DIRS_c)
                    one_correct(q, lambda o: o == ("into" if out > inn else "out of") + " the cell, by diffusion")
                elif "same number" in q.stem:
                    assert int(q.answer) == (out + inn) // 2
                else:
                    where = re.search(r"are (inside|outside) the cell", q.stem).group(1)
                    assert int(q.answer) == (inn if where == "inside" else out)
        elif p["kind"] == "osmosis":
            a, b = p["A"], p["B"]
            # the side with more solute holds fewer water molecules: water moves into it
            strong = "A" if len(a["solute"]) > len(b["solute"]) else "B"
            weak = "B" if strong == "A" else "A"
            assert len(p[strong]["solute"]) > len(p[weak]["solute"]) and len(p[strong]["water"]) < len(p[weak]["water"])
            for q in qs:
                if q.kind == "mcq":
                    one_correct(q, lambda o: o == f"side {strong}")
                else:
                    side = re.search(r"on side ([AB])", q.stem).group(1)
                    what = "water" if "water molecules" in q.stem else "solute"
                    assert int(q.answer) == len(p[side][what]), (s, q.stem)
        else:
            ions, inn, out = p["ions"], p["inside"], p["outside"]
            assert all(v % p["ystep"] == 0 and v > 0 for v in inn + out)
            higher = [i for i, n in enumerate(ions) if inn[i] > out[i]]
            lower = [i for i, n in enumerate(ions) if inn[i] < out[i]]
            assert len(higher) + len(lower) == len(ions)
            for q in qs:
                if "active transport" in q.stem:
                    assert len(higher) == 1
                    one_correct(q, lambda o: o == ions[higher[0]])
                elif "by diffusion" in q.stem:
                    assert len(lower) == 1
                    one_correct(q, lambda o: o == ions[lower[0]])
                elif "How many times" in q.stem:
                    ion = re.search(r"concentrated is (\w+)", q.stem).group(1)
                    i = ions.index(ion)
                    assert inn[i] % out[i] == 0 and int(q.answer) == inn[i] // out[i] >= 2
                else:
                    ion = re.search(r"concentration of (\w+) in the", q.stem).group(1)
                    assert num(q.answer) == out[ions.index(ion)]
    assert min(kinds.values()) > 200, kinds


def test_membrane_transport_draws_every_particle():
    m = fam("membrane_transport")
    for s in range(1, 60):
        p = m.sample(random.Random(s))
        fig = m.draw(p)
        ax = fig.axes[0]
        if p["kind"] in ("diffusion", "osmosis"):
            pts = [tuple(xy) for c in ax.collections for xy in c.get_offsets()]
            want = p["outside"] + p["inside"] if p["kind"] == "diffusion" else \
                p["A"]["water"] + p["A"]["solute"] + p["B"]["water"] + p["B"]["solute"]
            assert len(pts) == len(want), s
            # particles never touch: each can be counted
            for i, a in enumerate(want):
                for b in want[i + 1:]:
                    assert math.dist(a, b) >= 0.07, (s, a, b)
        plt.close(fig)


# --- predator_prey -----------------------------------------------------------------------------------------

def test_predator_prey():
    m = fam("predator_prey")
    kinds = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        kinds[p["kind"]] += 1
        if p["kind"] == "cycle":
            years, prey, pred = p["years"], p["prey_n"], p["pred_n"]
            assert all(v % p["ystep"] == 0 and v >= 0 for v in prey + pred)
            assert prey.count(max(prey)) == 1
            for q in qs:
                if "highest" in q.stem:
                    assert int(re.search(r"\d+", q.answer).group()) == years[prey.index(max(prey))]
                elif q.kind == "mcq":
                    def good(o):
                        a, b = map(int, re.findall(r"\d+", o))
                        return b == a + 1 and prey[b] < prey[a] and pred[b] > pred[a]
                    one_correct(q, good)
                    nums = [n for o in q.options for n in re.findall(r"\d+", o)]
                    assert len(nums) == len(set(nums)), q.options  # no year shared: the key is not the central one
                elif "fall from" in q.stem:
                    a, b = map(int, re.findall(r"(?:year|week) (\d+)", q.stem))
                    assert prey[a] > prey[b] and int(q.answer) == prey[a] - prey[b]
                else:
                    t = int(re.search(r"in (?:year|week) (\d+)", q.stem).group(1))
                    assert int(q.answer) == pred[t]
        else:
            alone, together, w = p["alone"], p["together"], p["winner"]
            lose = "Y" if w == "X" else "X"
            days = p["days"]
            assert together[lose][-1] == 0 and together[w][-1] > 0 and min(alone["X"][1:] + alone["Y"][1:]) > 0
            for q in qs:
                if q.kind == "mcq":
                    one_correct(q, lambda o: o == f"species {w}")
                elif "largest number" in q.stem:
                    sp = re.search(r"species ([XY]) when", q.stem).group(1)
                    assert int(q.answer) == max(alone[sp])
                elif "die out" in q.stem:
                    first = next(d for d, v in zip(days, together[lose]) if v == 0)
                    assert int(re.search(r"\d+", q.answer).group()) == first
                else:
                    d = int(re.search(r"On day (\d+)", q.stem).group(1))
                    i = days.index(d)
                    assert int(q.answer) == alone[w][i] - together[w][i] > 0
    assert min(kinds.values()) > 300, kinds


# --- human_impact ------------------------------------------------------------------------------------------

def test_human_impact():
    m = fam("human_impact")
    kinds = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        kinds[p["kind"]] += 1
        if p["kind"] == "river":
            km, ox, fly, k = p["km"], p["oxygen"], p["mayfly"], p["outlet"]
            up = ox[0]
            assert all(v == up for v in ox[:k + 1]) and min(ox) < up and ox.count(min(ox)) == 1
            assert all(v % 1 == 0 for v in ox) and all(v % p["fly_step"] == 0 for v in fly)
            for q in qs:
                if "lowest" in q.stem:
                    assert int(re.search(r"\d+", q.answer).group()) == km[ox.index(min(ox))]
                elif "mayfly" in q.stem:
                    d = int(re.search(r"at (\d+) km", q.stem).group(1))
                    assert int(q.answer) == fly[km.index(d)]
                elif "get back" in q.stem:
                    first = next(km[i] for i in range(k + 1, len(km)) if ox[i] >= up)
                    assert int(re.search(r"\d+", q.answer).group()) == first
                else:
                    d = int(re.search(r"(\d+) km along", q.stem).group(1))
                    assert num(q.answer) == ox[km.index(d)]
        elif p["kind"] == "forest":
            years, area = p["years"], p["area"]
            assert area.count(min(area)) == 1 and all(v % p["ystep"] == 0 for v in area)
            for q in qs:
                if "smallest" in q.stem:
                    assert int(q.answer) == years[area.index(min(area))]
                elif "percentage" in q.stem:
                    a, b = map(int, re.findall(r"\b(?:19|20)\d\d\b", q.stem))
                    x, y = area[years.index(a)], area[years.index(b)]
                    assert (x - y) * 100 % x == 0 and int(re.match(r"\d+", q.answer).group()) == (x - y) * 100 // x
                elif "gained" in q.stem:
                    a, b = map(int, re.findall(r"\b(?:19|20)\d\d\b", q.stem))
                    assert int(q.answer) == area[years.index(b)] - area[years.index(a)] > 0
                else:
                    a, b = map(int, re.findall(r"\b(?:19|20)\d\d\b", q.stem))
                    assert int(q.answer) == area[years.index(a)] - area[years.index(b)] > 0
        else:
            years, cnt, start = p["years"], p["count"], p["start"]
            assert cnt.count(min(cnt)) == 1 and all(v % p["ystep"] == 0 for v in cnt)
            for q in qs:
                if "lowest" in q.stem:
                    assert int(q.answer) == years[cnt.index(min(cnt))]
                elif "mean increase" in q.stem:
                    a, b = map(int, re.findall(r"\b(?:19|20)\d\d\b", q.stem))
                    gain = cnt[years.index(b)] - cnt[years.index(a)]
                    assert a == start and gain % (b - a) == 0 and int(q.answer) == gain // (b - a) > 0
                else:
                    t = int(re.findall(r"\b(?:19|20)\d\d\b", q.stem)[0])
                    assert int(q.answer) == cnt[years.index(t)]
    assert min(kinds.values()) > 200, kinds


# --- plant_gas_exchange ------------------------------------------------------------------------------------

_COLOUR_c = {"leaf, bright light": "purple", "leaf, dark": "yellow", "leaf, dim light": "red",
             "no leaf, bright light": "red", "snail, bright light": "yellow"}


def test_plant_gas_exchange():
    m = fam("plant_gas_exchange")
    kinds = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        kinds[p["kind"]] += 1
        if p["kind"] == "indicator":
            tubes = p["tubes"]
            assert sorted(tubes) == ["A", "B", "C", "D"] and len(set(tubes.values())) == 4
            for q in qs:
                assert q.kind == "mcq" and sorted(q.options) == ["A", "B", "C", "D"]
                if "took in more carbon dioxide" in q.stem or "take in more carbon dioxide" in q.stem:
                    one_correct(q, lambda o: _COLOUR_c[tubes[o]] == "purple")
                elif "give out more carbon dioxide" in q.stem:
                    one_correct(q, lambda o: _COLOUR_c[tubes[o]] == "yellow" and tubes[o].startswith("leaf"))
                elif "same rate" in q.stem:
                    one_correct(q, lambda o: _COLOUR_c[tubes[o]] == "red" and tubes[o].startswith("leaf"))
                else:
                    pytest.fail(q.stem)
        else:
            low, high, area = p["lower"], p["upper"], p["area"]
            assert len(low) > len(high) >= 0
            for q in qs:
                if "density" in q.stem:
                    assert len(low) / area == int(q.answer)
                elif "more stomata" in q.stem:
                    assert int(q.answer) == len(low) - len(high)
                else:
                    assert int(q.answer) == len(low)
    assert min(kinds.values()) > 300, kinds


def test_plant_gas_exchange_prints_its_key_and_area():
    m = fam("plant_gas_exchange")
    for s in range(1, 80):
        p = m.sample(random.Random(s))
        words = " ".join(texts(m, p))
        if p["kind"] == "indicator":
            for c in ("yellow", "red", "purple"):
                assert c in words
            for letter, cond in p["tubes"].items():
                assert _COLOUR_c[cond] in words
        else:
            assert f"{p['area']} mm²" in words


# --- asexual_plants ----------------------------------------------------------------------------------------

_TYPES_c = {"stem tuber", "bulb", "runner", "rhizome"}


def test_asexual_plants():
    m = fam("asexual_plants")
    kinds = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        kinds[p["kind"]] += 1
        if p["kind"] == "organs":
            organs = p["organs"]
            assert set(organs.values()) == _TYPES_c and sorted(organs) == ["A", "B", "C", "D"]
            for q in qs:
                if q.stem.endswith("?") and "Which letter shows" in q.stem:
                    t = re.search(r"Which letter shows an? ([a-z ]+)\?", q.stem).group(1)
                    one_correct(q, lambda o: organs[o] == t)
                elif q.kind == "mcq":
                    x = re.search(r"letter ([A-D])\b", q.stem).group(1)
                    assert set(q.options) == _TYPES_c
                    one_correct(q, lambda o: o == organs[x])
                elif "eyes" in q.stem:
                    assert int(q.answer) == p["eyes"]
                else:
                    assert int(q.answer) == p["plantlets"]
        else:
            lv, rooted, n = p["levels"], p["rooted"], p["per_group"]
            assert rooted.count(max(rooted)) == 1 and all(0 <= r <= n for r in rooted)
            for q in qs:
                if "most cuttings" in q.stem:
                    assert int(re.match(r"\d+", q.answer).group()) == lv[rooted.index(max(rooted))]
                elif "percentage" in q.stem:
                    c = int(re.search(r"given (\d+) mg", q.stem).group(1))
                    r = rooted[lv.index(c)]
                    assert r * 100 % n == 0 and int(re.match(r"\d+", q.answer).group()) == r * 100 // n
                else:
                    c = int(re.search(r"with (\d+) mg", q.stem).group(1))
                    assert int(q.answer) == rooted[lv.index(c)] - rooted[0] > 0
    assert min(kinds.values()) > 300, kinds


# --- disease_data ------------------------------------------------------------------------------------------

_MONTHS_c = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October",
             "November", "December"]


def test_disease_data():
    m = fam("disease_data")
    kinds = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        kinds[p["kind"]] += 1
        if p["kind"] == "outbreak":
            weeks, cases = p["weeks"], p["cases"]
            assert cases.count(max(cases)) == 1 and all(v % p["ystep"] == 0 for v in cases)
            for q in qs:
                if "most new cases" in q.stem:
                    assert int(re.search(r"\d+", q.answer).group()) == weeks[cases.index(max(cases))]
                elif "altogether" in q.stem:
                    a, b = map(int, re.findall(r"week (\d+)", q.stem))
                    assert int(q.answer) == sum(cases[weeks.index(a):weeks.index(b) + 1])
                elif "first no new cases" in q.stem:
                    peak = cases.index(max(cases))
                    first = next(weeks[i] for i in range(peak, len(weeks)) if cases[i] == 0)
                    assert int(re.search(r"\d+", q.answer).group()) == first
                else:
                    w = int(re.search(r"in week (\d+)", q.stem).group(1))
                    assert int(q.answer) == cases[weeks.index(w)]
        else:
            cases, rain = p["cases"], p["rain"]
            assert cases.count(max(cases)) == 1 and rain.count(max(rain)) == 1
            for q in qs:
                if "most malaria cases" in q.stem:
                    assert q.answer == _MONTHS_c[cases.index(max(cases))]
                elif "months after" in q.stem:
                    assert int(re.match(r"\d+", q.answer).group()) == cases.index(max(cases)) - rain.index(max(rain)) > 0
                elif "rainfall" in q.stem:
                    mo = re.search(r"in (\w+)\?", q.stem).group(1)
                    assert int(q.answer) == rain[_MONTHS_c.index(mo)]
                else:
                    mo = re.search(r"in (\w+)\?", q.stem).group(1)
                    assert int(q.answer) == cases[_MONTHS_c.index(mo)]
    assert min(kinds.values()) > 300, kinds


# --- quadrat: the AL Simpson's index sub-type --------------------------------------------------------------

def test_quadrat_simpson_index():
    from decimal import ROUND_HALF_UP, Decimal
    from fractions import Fraction
    m = fam("quadrat")
    n_al = 0
    for s in SEEDS:
        p, qs = run(m, s)
        if p.get("kind") != "simpson":
            assert p["band"] in ("LS", "UP")
            continue
        n_al += 1
        assert p["band"] == "AL"
        inside = Counter()
        for (x, y), k in zip(p["plants"], p["kinds"]):
            if any(int(x) == cx and int(y) == cy for cx, cy in p["quadrats"].values()):
                inside[k] += 1
        assert set(inside) == set(p["mix"]) and len(p["mix"]) >= 3
        big = sum(inside.values())
        d = 1 - sum(Fraction(v, big) ** 2 for v in inside.values())
        assert abs((d * 100) % 1 - Fraction(1, 2)) > Fraction(1, 10)  # never near a rounding boundary
        for q in qs:
            if "Simpson" in q.stem:
                want = Decimal(d.numerator) / Decimal(d.denominator)
                assert q.answer == str(want.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))
            elif "total number" in q.stem:
                assert int(q.answer) == big
            else:
                name = re.search(r"How many ([a-z ]+) are there", q.stem).group(1)
                k = next(i for i in p["mix"] if m.AL_SPECIES[i][0] == name)
                assert int(q.answer) == inside[k]
    assert n_al > 150, n_al


def test_quadrat_al_figures_print_the_formula_and_a_key():
    m = fam("quadrat")
    seen = 0
    for s in range(1, 200):
        p = m.sample(random.Random(s))
        if p.get("kind") != "simpson":
            continue
        seen += 1
        words = " ".join(texts(m, p))
        assert "D = 1 − Σ(n/N)²" in words
        for i in p["mix"]:
            assert m.AL_SPECIES[i][0] in words
    assert seen > 20


def test_quadrat_earlier_sub_types_are_unchanged():
    """Seeds drawing the LS and UP field still draw and word it exactly as before the AL sub-type came (the stored
    figures depend on it): their params never carry a "kind", and their questions are the three of old."""
    m = fam("quadrat")
    for s in range(1, 200):
        p, qs = run(m, s)
        if p.get("kind") == "simpson":
            continue
        assert set(p) == {"band", "W", "H", "plants", "quadrats", "species", "ask"}
        assert len(qs) == 3 and "mean number" in qs[1].stem and "whole field" in qs[2].stem


# --- food_test_table at AS Level ---------------------------------------------------------------------------

def test_food_test_table_reaches_as_level_biological_molecules_by_name(index):
    link, ix, _ = index
    m = fam("food_test_table")
    reached = link.reach(ix, m, 200)
    by_key = {t["key"]: t for t in ix}
    al = {by_key[k]["name"] for k in reached if by_key[k]["band"] == "AL"}
    assert al == {"Biological molecules"}, al


def test_quadrat_reaches_as_level_biodiversity_only_at_al(index):
    link, ix, _ = index
    m = fam("quadrat")
    by_key = {t["key"]: t for t in ix}
    al = {by_key[k]["name"] for k in link.reach(ix, m, 300) if by_key[k]["band"] == "AL"}
    assert al == {"Biodiversity, classification and conservation"}, al


# ==== group d ====
# fair_test (an investigation's results or four plans), practical_analysis (AS practical skills: uncertainty,
# Spearman's rank, error bars), cell_diagram (plant and animal cells, specialised cells).
from fractions import Fraction  # noqa: E402

NEW_D = ("fair_test", "practical_analysis", "cell_diagram")
EDITED_D = ()
TARGETS_D = [
    ("fair_test", "Thinking and Working Scientifically", None), ("fair_test", "Science Skills", None),
    ("fair_test", "Scientific method", 7), ("fair_test", "Scientific method", 8), ("fair_test", "Scientific method", 9),
    ("fair_test", "9 Magnetism", None), ("fair_test", "2 Properties of materials", None),
    ("practical_analysis", "Practical skills for AS", None),
    ("practical_analysis", "Planning, analysis and evaluation", None),
    ("practical_analysis", "Biodiversity, classification and conservation", None),
    ("cell_diagram", "1 Cells", None),
    ("cell_diagram", "Cells and living systems", 4), ("cell_diagram", "Cells and living systems", 5),
    ("cell_diagram", "Cells and living systems", 6),
]
NEVER_D = {
    "fair_test": {"Biology: cells and reproduction", "Environmental science", "Earth and Space",
                  "Chemistry: elements and compounds", "Physics: motion and energy", "Biology"},
    "practical_analysis": {"Biological molecules", "Energy and respiration", "Genetic technology",
                           "The mitotic cell cycle", "Selection and evolution"},
    "cell_diagram": {"Thinking and Working Scientifically", "Human Sensory Organs", "Muscles",
                     "Passive movement of substances across a cell membrane", "Active transport", "1 Respiration",
                     "7 Diet and growth", "4 Maintaining life", "Scientific method"},
}

# --- fair_test -----------------------------------------------------------------------------------------------
# Each investigation's values of the independent variable, and how many decimal places its readings carry.
_LEVELS_d = {"electromagnet": [10, 20, 30, 40, 50], "dissolving": [20, 30, 40, 50, 60],
             "pendulum": [20, 40, 60, 80, 100], "pondweed": [10, 20, 30, 40, 50], "insulation": [0, 1, 2, 3, 4]}
_PLACES_d = {"electromagnet": 0, "dissolving": 0, "pendulum": 1, "pondweed": 0, "insulation": 0}


def _fr(v) -> Fraction:
    return Fraction(str(v))


def _same(answer: str, value: Fraction) -> bool:
    return abs(_fr(num(answer)) - value) < Fraction(1, 10 ** 6)


def _anomaly_d(trials):
    """The one reading far from the others in its row: the largest relative distance from its row's median."""
    devs = []
    for i, row in enumerate(trials):
        med = sorted(row)[1]
        for j, v in enumerate(row):
            devs.append((abs(_fr(v) - _fr(med)) / _fr(med), i, j))
    devs.sort(reverse=True)
    return devs[0], devs[1]


def test_fair_test_results():
    m = fam("fair_test")
    layouts = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        layouts[(p["inv"], p["layout"])] += 1
        assert p["band"] == "LS"
        if p["layout"] != "results":
            continue
        trials, levels = p["trials"], p["levels"]
        assert levels == _LEVELS_d[p["inv"]] and len(trials) == len(levels) and all(len(r) == 3 for r in trials)
        for row in trials:
            for v in row:
                assert _fr(v) * 10 ** _PLACES_d[p["inv"]] == int(_fr(v) * 10 ** _PLACES_d[p["inv"]]), (s, v)
        (big, ai, aj), (second, _, _) = _anomaly_d(trials)
        assert big >= Fraction(1, 4) and big >= 4 * second, (s, trials)
        assert [ai, aj] == p["anomaly"], (s, p["anomaly"], ai, aj)
        blank = p["blank"]
        assert blank != ai
        # Q1: the mean of the blank row
        mean = sum(_fr(v) for v in trials[blank]) / 3
        assert qs[0].kind == "short" and _same(qs[0].answer, mean), (s, qs[0].stem, qs[0].answer, mean)
        assert qs[0].stem.startswith(p["name"]) and f"at {levels[blank]}" in qs[0].stem
        # Q2: the anomalous result, named by its row and trial
        q = qs[1]
        assert q.kind == "mcq"

        def where(o):
            mm = re.match(r"(\d+)\D.*trial (\d)$", o)
            return int(mm.group(1)), int(mm.group(2))
        one_correct(q, lambda o: where(o) == (levels[ai], aj + 1))
        # Q3: the anomalous row's mean, leaving out the anomaly
        others = [_fr(v) for j, v in enumerate(trials[ai]) if j != aj]
        assert _same(qs[2].answer, sum(others) / 2) and f"at {levels[ai]}" in qs[2].stem, (s, qs[2].stem)
        assert (sum(others) * 10 ** _PLACES_d[p["inv"]]) % 2 == 0  # a clean mean
        # Q4: the difference between two printed means
        a, b = [int(x) for x in re.findall(r"at (\d+)", qs[3].stem)]
        ra, rb = levels.index(a), levels.index(b)
        assert {ra, rb}.isdisjoint({ai, blank})
        diff = abs(sum(_fr(v) for v in trials[ra]) / 3 - sum(_fr(v) for v in trials[rb]) / 3)
        assert _same(qs[3].answer, diff), (s, qs[3].stem, qs[3].answer, diff)
        for r in range(len(levels)):
            if r not in (ai, blank):
                assert (sum(_fr(v) for v in trials[r]) * 10 ** _PLACES_d[p["inv"]]) % 3 == 0, (s, trials[r])
    assert all(layouts[(inv, lay)] >= 40 for inv in _LEVELS_d for lay in ("results", "plans")), layouts


def test_fair_test_results_shows_every_value_and_hides_the_asked_means():
    m = fam("fair_test")
    for s in range(1, 81):
        p, qs = run(m, s)
        if p["layout"] != "results":
            continue
        shown = texts(m, p)
        ai, _ = p["anomaly"]
        fmt = (lambda v: f"{float(v):.1f}") if p["inv"] == "pendulum" else (lambda v: str(int(v)))
        for r, row in enumerate(p["trials"]):
            assert str(p["levels"][r]) in shown, (s, p["levels"][r])
            for v in row:
                assert fmt(v) in shown, (s, v)
            if r not in (ai, p["blank"]):
                assert fmt(sum(_fr(v) for v in row) / 3) in shown, (s, r)
        assert shown.count("?") == 2, (s, shown.count("?"))


def test_fair_test_plans():
    m = fam("fair_test")
    for s in SEEDS:
        p, qs = run(m, s)
        if p["layout"] != "plans":
            continue
        plans = p["plans"]
        assert sorted(plans) == ["A", "B", "C", "D"] and all(len(v) == 4 for v in plans.values())
        assert len({tuple(v) for v in plans.values()}) == 4, (s, plans)
        fair = [k for k, v in plans.items() if v == [True, False, False, False]]
        assert len(fair) == 1
        assert qs[0].stem.startswith(p["name"])
        one_correct(qs[0], lambda o: o == f"Plan {fair[0]}")
        k = p["ask_control"]
        only = [L for L, v in plans.items() if v[k] and sum(v) == 1]
        assert len(only) == 1 and 1 <= k <= 3
        one_correct(qs[1], lambda o: o == f"Plan {only[0]}")
        many = sum(1 for v in plans.values() if sum(v) >= 2)
        assert qs[2].kind == "short" and int(qs[2].answer) == many, (s, plans, qs[2].answer)


def test_fair_test_plans_print_what_each_plan_changes():
    m = fam("fair_test")
    for s in range(1, 81):
        p, _ = run(m, s)
        if p["layout"] != "plans":
            continue
        shown = texts(m, p)
        assert shown.count("changed") == sum(sum(v) for v in p["plans"].values()), s
        assert shown.count("kept the same") == sum(4 - sum(v) for v in p["plans"].values()), s


def test_fair_test_links_each_investigation_to_its_own_topics_only():
    m = fam("fair_test")
    for s in range(1, 200):
        p = m.sample(random.Random(s))
        c = set(m.concepts_for(p))
        assert "science.scientific-method" in c
        if p["inv"] == "electromagnet":
            assert "science.electromagnets" in c
        elif p["inv"] == "dissolving":
            assert c == {"science.scientific-method", "science.dissolving-and-solubility"}
        else:
            assert c == {"science.scientific-method"}, (p["inv"], c)


# --- practical_analysis -----------------------------------------------------------------------------------------
# Critical values of Spearman's rs at p = 0.05 (two-tailed), as the figure must print them (Zar's table).
_CRIT_d = {6: Fraction("0.886"), 7: Fraction("0.786"), 8: Fraction("0.738"), 9: Fraction("0.700"), 10: Fraction("0.648")}


def _ranks_d(vals):
    order = sorted(vals)
    return [order.index(v) + 1 for v in vals]


def _round2(x: Fraction) -> str:
    sign = "-" if x < 0 else ""
    a = abs(x) * 100
    whole = int(a)
    if a - whole >= Fraction(1, 2):
        whole += 1
    return f"{sign}{whole // 100}.{whole % 100:02d}"


def test_practical_analysis_uncertainty():
    m = fam("practical_analysis")
    kinds = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        kinds[p["kind"]] += 1
        assert p["band"] == "AL"
        if p["kind"] != "uncertainty":
            continue
        trials, d = p["trials"], p["division"]
        assert d in (1, 2) and all(len(r) == 3 for r in trials)
        r0 = p["ask_mean"]
        assert sum(trials[r0]) % 3 == 0
        assert qs[0].stem.startswith(p["name"]) and int(qs[0].answer) == sum(trials[r0]) // 3, (s, qs[0].stem)
        i, j = p["ask_pct"]
        reading = trials[i][j]
        pct = Fraction(d, 2) / reading * 100
        assert (pct * 100).denominator == 1, (s, reading, d)
        assert str(reading) in qs[1].stem and _same(qs[1].answer, pct), (s, qs[1].stem, qs[1].answer, pct)
        r2 = p["ask_range"]
        assert int(qs[2].answer) == max(trials[r2]) - min(trials[r2]) and max(trials[r2]) > min(trials[r2])
        unit = "cm³"
        u = Fraction(d, 2)
        one_correct(qs[3], lambda o: o == f"±{float(u):g} {unit}")
    assert all(kinds[k] >= 250 for k in ("uncertainty", "spearman", "error_bars")), kinds


def test_practical_analysis_spearman():
    m = fam("practical_analysis")
    for s in SEEDS:
        p, qs = run(m, s)
        if p["kind"] != "spearman":
            continue
        x, y, n = p["x"], p["y"], len(p["x"])
        assert n == len(y) and 6 <= n <= 10 and len(set(x)) == n and len(set(y)) == n
        rx, ry = _ranks_d(x), _ranks_d(y)
        d2 = sum((a - b) ** 2 for a, b in zip(rx, ry))
        rs = 1 - Fraction(6 * d2, n * (n * n - 1))
        b = p["blank"]
        assert int(qs[0].answer) == rx[b] and qs[0].stem.startswith(p["name"]), (s, qs[0].stem, qs[0].answer, rx[b])
        assert p["labels"][b] in qs[0].stem
        assert (rs * 1000).denominator != 1 or (rs * 1000) % 10 != 5  # never exactly half way at 2 places
        assert qs[1].answer == _round2(rs), (s, qs[1].answer, rs)
        assert "−" + qs[1].answer[1:] in qs[1].accepted if rs < 0 else True
        crit = _CRIT_d[n]
        assert abs(abs(rs) - crit) >= Fraction(8, 100), (s, rs, crit)
        sig = abs(rs) >= crit
        sign = "positive" if rs > 0 else "negative"
        want = f"a significant {sign} correlation" if sig else f"a {sign} correlation that is not significant"
        one_correct(qs[2], lambda o: o == want)
        shown = texts(m, p)
        assert str(d2) in shown and any(f"{float(crit):.3f}" in t for t in shown), (s, d2)
        assert shown.count("?") == 4


def test_practical_analysis_error_bars():
    m = fam("practical_analysis")
    keys = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        if p["kind"] != "error_bars":
            continue
        means, half, step, groups = p["means"], p["half"], p["step"], p["groups"]
        assert len(means) == len(half) == len(groups) == 3
        for mu, h in zip(means, half):
            assert mu % step == 0 and h % step == 0 and h > 0 and mu - h > 0
        apart = []
        for a in range(3):
            for b in range(a + 1, 3):
                lo_a, hi_a, lo_b, hi_b = means[a] - half[a], means[a] + half[a], means[b] - half[b], means[b] + half[b]
                gap = max(lo_a, lo_b) - min(hi_a, hi_b)  # > 0: the bars do not overlap
                assert abs(gap) >= step, (s, means, half)
                if gap > 0:
                    apart.append(f"{groups[a]} and {groups[b]}")
        assert len(apart) <= 1
        want = apart[0] if apart else "none of the pairs"
        keys[want == "none of the pairs"] += 1
        assert qs[0].stem.startswith(p["name"])
        one_correct(qs[0], lambda o: o == want or (o.replace(" and ", "|").split("|")[::-1] == want.split(" and ")))
        g = p["ask_mean"]
        assert groups[g] in qs[1].stem and _same(qs[1].answer, Fraction(means[g]))
        g2 = p["ask_top"]
        assert groups[g2] in qs[2].stem and _same(qs[2].answer, Fraction(means[g2] + half[g2]))
    assert keys[True] >= 30 and keys[False] >= 100, keys


def test_practical_analysis_links_by_sub_type():
    m = fam("practical_analysis")
    for s in range(1, 200):
        p = m.sample(random.Random(s))
        c = set(m.concepts_for(p))
        assert ("biology.correlation-pearson" in c) == (p["kind"] == "spearman")
        av = m.avoid_for(p)
        assert bool(re.search(av, "Biodiversity, classification and conservation", re.I)) == (p["kind"] != "spearman")


# --- cell_diagram ------------------------------------------------------------------------------------------------
_PLANT_ONLY_d = {"cell wall", "chloroplast", "vacuole"}
_SHARED_d = {"nucleus", "cytoplasm", "cell membrane", "mitochondrion"}
_JOB_d = {"nucleus": "controls the activities of the cell", "cell membrane": "controls what enters and leaves the cell",
          "cell wall": "supports the cell and keeps its shape", "cytoplasm": "is where most chemical reactions happen",
          "chloroplast": "absorbs light for photosynthesis", "vacuole": "stores cell sap and keeps the cell firm",
          "mitochondrion": "releases energy by aerobic respiration"}
_CELL_JOB_d = {"red blood cell": "carries oxygen around the body",
               "nerve cell": "carries electrical impulses around the body",
               "root hair cell": "takes in water and mineral ions from the soil",
               "palisade cell": "carries out most of the photosynthesis in a leaf",
               "ciliated cell": "moves mucus along the airways",
               "muscle cell": "contracts to move part of the body"}


def test_cell_diagram_plant_and_animal():
    m = fam("cell_diagram")
    bands = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        bands[(p["band"], p["kind"])] += 1
        if p["kind"] != "plant_animal":
            continue
        letters = p["letters"]
        parts = [part for _, part in letters.values()]
        assert len(parts) == len(set(parts)), (s, letters)
        assert len(letters) == (3 if p["band"] == "P" else 4)
        for cell, part in letters.values():
            assert part in _PLANT_ONLY_d | _SHARED_d
            assert cell == "plant" or part not in _PLANT_ONLY_d
            if part == "cell membrane":
                assert cell == "animal"  # a plant cell's membrane hugs its wall: too close to letter
            if p["band"] == "P":
                assert part != "mitochondrion"
        only = [L for L, (cell, part) in letters.items() if part in _PLANT_ONLY_d]
        assert len(only) == 1
        ask = p["ask"]
        key = [L for L, (_, part) in letters.items() if part == ask]
        assert len(key) == 1 and ask in _SHARED_d
        assert qs[0].stem.startswith(p["name"])
        if p["band"] == "P":
            assert ask in qs[0].stem
        else:
            assert _JOB_d[ask] in qs[0].stem
        one_correct(qs[0], lambda o: o == key[0])
        one_correct(qs[1], lambda o: o == only[0])
        k = 1 if p["plant_side"] == "left" else 2
        assert f"Cell {k}" in qs[2].stem and int(qs[2].answer) == p["chloroplasts"]
    for b in ("P", "LS", "UP"):
        assert bands[(b, "plant_animal")] >= 100, bands
    for b in ("LS", "UP"):
        assert bands[(b, "specialised")] >= 100, bands
    assert bands[("P", "specialised")] == 0


def test_cell_diagram_specialised_cells():
    m = fam("cell_diagram")
    for s in SEEDS:
        p, qs = run(m, s)
        if p["kind"] != "specialised":
            continue
        cells = p["cells"]
        assert len(cells) == 4 == len(set(cells)) and set(cells) <= set(_CELL_JOB_d)
        letters = "ABCD"
        ask = p["ask_job"]
        assert _CELL_JOB_d[ask] in qs[0].stem and qs[0].stem.startswith(p["name"])
        one_correct(qs[0], lambda o: o == letters[cells.index(ask)])
        if "no nucleus" in qs[1].stem:
            want = letters[cells.index("red blood cell")]
        else:
            assert "chloroplasts" in qs[1].stem
            want = letters[cells.index("palisade cell")]
        one_correct(qs[1], lambda o: o == want)
        assert want != picked(qs[0])
        third = re.search(r"cell ([ABCD])\b", qs[2].stem).group(1)
        one_correct(qs[2], lambda o: o == _CELL_JOB_d[cells[letters.index(third)]])
        shown = " ".join(texts(m, p))
        for c in cells:
            assert c in shown.lower() and _CELL_JOB_d[c] in shown, (s, c)


def test_cell_diagram_leaders_end_on_their_part():
    """Every letter's leader line ends on the part it names: inside a nucleus, vacuole, chloroplast or
    mitochondrion; between wall and membrane for the wall; on the outline for a membrane; in the cytoplasm clear of
    every organelle."""
    from matplotlib.patches import Patch
    m = fam("cell_diagram")
    for s in range(1, 81):
        p = m.sample(random.Random(s))
        if p["kind"] != "plant_animal":
            continue
        fig = m.draw(p)
        ax = fig.axes[0]
        fig.canvas.draw()
        patches = [pa for pa in ax.patches if isinstance(pa, Patch)]

        def hit(gid_prefix, pt):
            disp = ax.transData.transform(pt)
            return [pa for pa in patches if (pa.get_gid() or "").startswith(gid_prefix) and pa.contains_point(disp)]
        for L, (cell, part) in p["letters"].items():
            ln = next(x for x in ax.lines if x.get_gid() == f"leader:{L}")
            end = ln.get_xydata()[-1]
            if part in ("nucleus", "vacuole", "chloroplast", "mitochondrion"):
                assert hit(f"part:{cell}:{part}", end), (s, L, part)
            elif part == "cell wall":
                assert hit(f"part:{cell}:outline", end) and not hit(f"part:{cell}:inner", end), (s, L)
            elif part == "cytoplasm":
                assert hit(f"part:{cell}:inner" if cell == "plant" else f"part:{cell}:outline", end)
                for other in ("nucleus", "vacuole", "chloroplast", "mitochondrion"):
                    assert not hit(f"part:{cell}:{other}", end), (s, L, other)
            elif part == "cell membrane":
                outline = next(pa for pa in patches if pa.get_gid() == f"part:{cell}:outline")
                verts = outline.get_patch_transform().transform(outline.get_path().vertices)
                assert min(math.dist(end, v) for v in verts) < 0.12, (s, L)
        plt.close(fig)


def test_cell_diagram_draws_the_chloroplasts_it_counts():
    m = fam("cell_diagram")
    for s in range(1, 81):
        p = m.sample(random.Random(s))
        if p["kind"] != "plant_animal":
            continue
        fig = m.draw(p)
        n = sum(1 for pa in fig.axes[0].patches if (pa.get_gid() or "").startswith("part:plant:chloroplast"))
        a = sum(1 for pa in fig.axes[0].patches if (pa.get_gid() or "").startswith("part:animal:chloroplast"))
        plt.close(fig)
        assert n == p["chloroplasts"] and a == 0, (s, n, p["chloroplasts"])


# ==== group e ====

NEW_E = ("senses_p", "sound_p", "skeleton_p", "breathing_p", "illness_data_p", "light_p")
EDITED_E = ()
TARGETS_E = [  # (family, topic, the school year its book is for; None where the book names none)
    ("senses_p", "Hearing sounds", None), ("senses_p", "Our five senses", None), ("senses_p", "Human Sensory Organs", 4),
    ("sound_p", "Sound", None), ("sound_p", "Hearing sounds", None), ("sound_p", "Air, Wind and Sound", 4),
    ("skeleton_p", "Human Skeleton", 4), ("skeleton_p", "Muscles", 4), ("skeleton_p", "Humans and animals", None),
    ("breathing_p", "Respiratory System", 6), ("illness_data_p", "Human Diseases", 5),
    ("light_p", "The way we see things", None), ("light_p", "Light and the Solar System", 6),
]
NEVER_E = {  # topics a family must not reach
    "senses_p": {"Light", "Light and dark", "Shadows", "Circulatory System", "Human Digestive System",
                 "Air, Wind and Sound", "Programming for Children"},
    "skeleton_p": {"Animals Classification", "Writing Skills", "Cells and living systems", "The Main Parts of the Human Body",
                   "Living things", "Ourselves"},
    "breathing_p": {"Air pollution", "Circulatory System", "Animals Classification", "Human Diseases",
                    "Cells and living systems"},
    "illness_data_p": {"Respiratory System", "Animals", "Rabbits and Chickens Management", "Human Digestive System",
                       "Drinking Water", "Muscles", "Circulatory System", "Air pollution", "Looking after ourselves"},
    "light_p": {"Light and Heat", "Light and dark", "Shadows", "The Earth and the Sun", "Rocks, the rock cycle and soil",
                "Looking at rocks"},
    "sound_p": {"Programming for Children", "Human Sensory Organs", "Ourselves", "Light"},
}

# --- senses_p ---------------------------------------------------------------------------------------------------

_ORGAN_SENSE_e = {"eye": "see", "ear": "hear", "nose": "smell", "tongue": "taste", "hand": "feel"}
_THING_SENSE_e = {  # what a child does, and the sense it needs, by this file's own table
    "see a rainbow": "see", "see the colours of a flower": "see", "read a book": "see",
    "hear a drum": "hear", "hear a bird sing": "hear", "hear the school bell": "hear",
    "smell a flower": "smell", "smell bread baking": "smell", "smell smoke from a fire": "smell",
    "taste a lemon": "taste", "taste salt in food": "taste", "taste sweet honey": "taste",
    "feel a hot cup": "feel", "feel soft cotton wool": "feel", "feel a rough stone": "feel"}
_EYE_JOB_e = {"eyebrow": "stops sweat running into the eye", "eyelid": "closes to keep out dust and bright light",
              "eyelashes": "catch dust before it gets into the eye",
              "iris": "the coloured ring that makes the pupil bigger or smaller",
              "pupil": "the hole that lets light into the eye"}

_EYE_ASK_e = {"eyebrow": "the part that stops sweat running into the eye",
              "eyelid": "the part that closes to keep out dust and bright light",
              "eyelashes": "the hairs that catch dust before it gets into the eye",
              "iris": "the coloured ring that makes the pupil bigger or smaller",
              "pupil": "the hole that lets light into the eye"}


def test_senses_p_organs_and_eye():
    m = fam("senses_p")
    kinds = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        kinds[p["kind"]] += 1
        letters = "ABCD"
        if p["kind"] == "organs":
            organs = p["organs"]
            assert len(organs) == 4 and len(set(organs)) == 4 and set(organs) <= set(_ORGAN_SENSE_e)
            thing = re.search(r"the part you use to (.+)\?$", qs[0].stem).group(1)
            sense = _THING_SENSE_e[thing]
            assert qs[0].options == list(letters)
            one_correct(qs[0], lambda o: _ORGAN_SENSE_e[organs[letters.index(o)]] == sense)
            L = re.search(r"letter ([A-D])\?", qs[1].stem).group(1)
            one_correct(qs[1], lambda o: o == _ORGAN_SENSE_e[organs[letters.index(L)]])
            assert set(qs[1].options) <= set(_ORGAN_SENSE_e.values())
        else:
            parts = p["parts"]
            assert len(parts) == 4 and len(set(parts)) == 4 and set(parts) <= set(_EYE_JOB_e)
            job = re.search(r"Which letter shows (.+)\?$", qs[0].stem).group(1)
            want = [k for k, v in _EYE_ASK_e.items() if v == job]
            assert len(want) == 1, (job, want)
            one_correct(qs[0], lambda o: parts[letters.index(o)] == want[0])
            L = re.search(r"letter ([A-D])\?", qs[1].stem).group(1)
            one_correct(qs[1], lambda o: o == parts[letters.index(L)])
            shown = " ".join(texts(m, p))
            for part in parts:  # the table prints every lettered part's name and job
                assert part.capitalize() in shown and _EYE_JOB_e[part] in shown, (s, part)
    assert kinds["organs"] > 400 and kinds["eye"] > 200, kinds


def test_senses_p_letters_have_their_own_picture_or_leader():
    m = fam("senses_p")
    for s in DRAWN:
        p = m.sample(random.Random(s))
        fig = m.draw(p)
        ax = fig.axes[0]
        gids = {t.get_gid() for t in ax.texts if t.get_gid()}
        plt.close(fig)
        assert {f"letter:{k}" for k in "ABCD"} <= gids, (s, gids)
        if p["kind"] == "eye":
            leaders = {ln.get_gid() for ln in ax.lines if (ln.get_gid() or "").startswith("leader:")}
            assert leaders == {f"leader:{k}" for k in "ABCD"}, (s, leaders)

# --- skeleton_p -------------------------------------------------------------------------------------------------

_BONE_JOB_e = {"skull": "protects the brain", "ribs": "protect the heart and lungs",
               "backbone": "holds the body up and protects the spinal cord", "pelvis": "joins the legs to the backbone",
               "thigh bone": "the longest bone; holds us up when we stand"}
_BONE_ASK_e = {"skull": "the bone that protects the brain", "ribs": "the bones that protect the heart and lungs",
               "backbone": "the bones that hold the body up and protect the spinal cord",
               "pelvis": "the bones that join the legs to the backbone", "thigh bone": "the longest bone in the body"}
_JOINT_TYPE_e = {"elbow": "hinge joint", "knee": "hinge joint", "shoulder": "ball and socket joint",
                 "hip": "ball and socket joint", "skull": "fixed joint"}
_JOINT_ASK_e = {"hinge joint": "a joint that bends one way only, like a door", "ball and socket joint":
                "a joint that can move round in a circle", "fixed joint": "a joint that does not move at all"}


def test_skeleton_p_keys():
    m = fam("skeleton_p")
    kinds = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        kinds[p["kind"]] += 1
        if p["kind"] == "bones":
            parts, letters = p["parts"], "ABCD"
            assert len(parts) == 4 and len(set(parts)) == 4 and set(parts) <= set(_BONE_JOB_e)
            ask = re.search(r"Which letter shows (.+)\?$", qs[0].stem).group(1)
            want = [k for k, v in _BONE_ASK_e.items() if v == ask]
            assert len(want) == 1 and want[0] in parts, ask
            one_correct(qs[0], lambda o: parts[letters.index(o)] == want[0])
            L = re.search(r"at letter ([A-D])\?", qs[1].stem).group(1)
            one_correct(qs[1], lambda o: o == parts[letters.index(L)])
            shown = texts(m, p)
            for b in parts:
                assert b.capitalize() in shown and _BONE_JOB_e[b] in shown, (s, b)
        elif p["kind"] == "joints":
            joints, letters = p["joints"], "ABC"
            types = [_JOINT_TYPE_e[j] for j in joints]
            assert sorted(types) == sorted(set(_JOINT_TYPE_e.values())), joints
            ask = re.search(r"Which letter shows (.+)\?$", qs[0].stem).group(1)
            want = [k for k, v in _JOINT_ASK_e.items() if v == ask]
            assert len(want) == 1, ask
            one_correct(qs[0], lambda o: types[letters.index(o)] == want[0])
            L = re.search(r"at letter ([A-C])\?", qs[1].stem).group(1)
            one_correct(qs[1], lambda o: o == types[letters.index(L)])
            shown = " ".join(texts(m, p))
            for t, how in _JOINT_ASK_e.items():
                assert t.capitalize() in shown, (s, t)
        else:
            parts, letters = p["parts"], "ABC"
            assert sorted(parts) == ["biceps", "bone", "triceps"]
            for q in qs:
                want = "biceps" if "bend the arm" in q.stem else "triceps"
                assert "bend the arm" in q.stem or "straighten the arm" in q.stem, q.stem
                one_correct(q, lambda o: parts[letters.index(o)] == want)
    assert min(kinds.values()) > 250, kinds


def test_skeleton_p_letters_point_at_their_parts():
    """Every letter has a leader line, and no two letter rings overlap."""
    m = fam("skeleton_p")
    for s in DRAWN:
        p = m.sample(random.Random(s))
        fig = m.draw(p)
        ax = fig.axes[0]
        n = 4 if p["kind"] == "bones" else 3
        leaders = {ln.get_gid() for ln in ax.lines if (ln.get_gid() or "").startswith("leader:")}
        rings = [pa for pa in ax.patches if (pa.get_gid() or "").startswith("ring:")]
        plt.close(fig)
        assert leaders == {f"leader:{k}" for k in "ABCD"[:n]}, (s, leaders)
        assert len(rings) == n
        for i, a in enumerate(rings):
            for b in rings[i + 1:]:
                assert math.dist(a.center, b.center) > a.radius + b.radius + 0.1, s

# --- sound_p ----------------------------------------------------------------------------------------------------

_SOFT_e = {"a towel", "cotton wool", "foam", "a woollen jumper"}
_THIN_e = {"kitchen foil", "newspaper", "a plastic bag", "a sheet of paper"}


def test_sound_p_keys():
    m = fam("sound_p")
    kinds = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        kinds[p["kind"]] += 1
        if p["kind"] == "distance":
            kids, steps = p["children"], p["steps"]
            assert len(set(steps)) == len(steps) == len(kids) and min(b - a for a, b in zip(sorted(steps), sorted(steps)[1:])) >= 2
            near, far = kids[steps.index(min(steps))], kids[steps.index(max(steps))]
            for q in qs:
                if "loudest" in q.stem:
                    one_correct(q, lambda o: o == near)
                elif "most quietly" in q.stem:
                    one_correct(q, lambda o: o == far)
                else:
                    who = re.search(r"How many steps is (\w+) from", q.stem).group(1)
                    assert int(q.answer) == steps[kids.index(who)]
            shown = texts(m, p)
            for k, n in zip(kids, steps):
                assert k in shown and f"{n} steps" in shown, (s, k, n)
        elif p["kind"] == "muffle":
            mats, levels = p["materials"], p["levels"]
            assert "no cover" in mats and levels[mats.index("no cover")] == max(levels)
            softs = [x for x in mats if x in _SOFT_e]
            assert len(softs) == 2 and all(x in _SOFT_e | _THIN_e | {"no cover"} for x in mats)
            assert max(levels[mats.index(x)] for x in softs) < min(levels[mats.index(x)] for x in mats if x in _THIN_e)
            assert len(set(levels)) == len(levels) and all(v % p["step"] == 0 for v in levels)
            best = mats[levels.index(min(levels))]
            assert sorted(abs(a - b) for a in levels for b in levels if a != b)[0] >= p["step"]
            for q in qs:
                if "best" in q.stem:
                    one_correct(q, lambda o: o == best)
                elif "How much quieter" in q.stem:
                    x = re.search(r"with (.+) than with no cover", q.stem).group(1)
                    assert int(q.answer) == levels[mats.index("no cover")] - levels[mats.index(x)]
                else:
                    x = re.search(r"with (.+) round the clock", q.stem).group(1)
                    assert int(q.answer) == levels[mats.index(x)]
            shown = texts(m, p)
            assert all(str(v) in shown for v in levels), s
        else:
            lengths = p["lengths"]
            assert len(set(lengths)) == len(lengths) and min(abs(a - b) for a in lengths for b in lengths if a != b) >= 2
            letters = "ABCD"[:len(lengths)]
            for q in qs:
                want = min(lengths) if "highest" in q.stem else max(lengths)
                assert "highest" in q.stem or "lowest" in q.stem
                one_correct(q, lambda o: lengths[letters.index(o)] == want)
            shown = texts(m, p)
            assert all(f"{n} cm" in shown for n in lengths), s
    assert min(kinds.values()) > 250, kinds


def test_sound_p_bars_end_on_their_values():
    m = fam("sound_p")
    for s in range(1, 120):
        p = m.sample(random.Random(s))
        if p["kind"] != "muffle":
            continue
        fig = m.draw(p)
        heights = sorted(round(b.get_height(), 6) for b in fig.axes[0].patches if (b.get_gid() or "").startswith("bar:"))
        plt.close(fig)
        assert heights == sorted(p["levels"]), (s, heights)

# --- breathing_p ------------------------------------------------------------------------------------------------

_LUNG_JOB_e = {"nose": "warms and cleans the air we breathe in", "windpipe": "carries air down to the lungs",
               "lungs": "take oxygen from the air into the blood",
               "diaphragm": "a muscle under the lungs that moves down when we breathe in",
               "ribs": "protect the lungs and move out when we breathe in"}
_LUNG_ASK_e = {"nose": "the part that warms and cleans the air we breathe in",
               "windpipe": "the tube that carries air down to the lungs",
               "lungs": "the organs that take oxygen from the air into the blood",
               "diaphragm": "the muscle under the lungs that moves down when we breathe in",
               "ribs": "the bones that protect the lungs"}


def test_breathing_p_keys():
    m = fam("breathing_p")
    kinds = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        kinds[p["kind"]] += 1
        if p["kind"] == "organs":
            parts, letters = p["parts"], "ABCD"
            assert len(parts) == 4 and len(set(parts)) == 4 and set(parts) <= set(_LUNG_JOB_e)
            ask = re.search(r"Which letter shows (.+)\?$", qs[0].stem).group(1)
            want = [k for k, v in _LUNG_ASK_e.items() if v == ask]
            assert len(want) == 1 and want[0] in parts, ask
            one_correct(qs[0], lambda o: parts[letters.index(o)] == want[0])
            L = re.search(r"at letter ([A-D])\?", qs[1].stem).group(1)
            one_correct(qs[1], lambda o: o == parts[letters.index(L)])
            shown = texts(m, p)
            for k in parts:
                assert k.capitalize() in shown and _LUNG_JOB_e[k] in shown, (s, k)
        else:
            kids, rest, after = p["pupils"], p["rest"], p["after"]
            rise = [a - r for a, r in zip(after, rest)]
            top = sorted(rise, reverse=True)
            assert top[0] - top[1] >= 4 and all(v % p["step"] == 0 for v in rest + after)
            for q in qs:
                if q.kind == "mcq":
                    one_correct(q, lambda o: o == kids[rise.index(max(rise))])
                elif "more breaths" in q.stem:
                    who = re.search(r"did (\w+) take after exercise than", q.stem).group(1)
                    assert int(q.answer) == rise[kids.index(who)]
                else:
                    who = re.search(r"did (\w+) take after exercise\?", q.stem).group(1)
                    assert int(q.answer) == after[kids.index(who)]
    assert min(kinds.values()) > 350, kinds


def test_breathing_p_bars_end_on_gridlines():
    m = fam("breathing_p")
    for s in range(1, 120):
        p = m.sample(random.Random(s))
        if p["kind"] != "rate":
            continue
        fig = m.draw(p)
        ax = fig.axes[0]
        heights = sorted(round(b.get_height(), 6) for b in ax.patches if (b.get_gid() or "").startswith("bar:"))
        ticks = set(round(t, 6) for t in ax.get_yticks(minor=True)) | set(round(t, 6) for t in ax.get_yticks())
        plt.close(fig)
        assert heights == sorted(p["rest"] + p["after"]) and set(heights) <= ticks, s


# --- illness_data_p ---------------------------------------------------------------------------------------------

_DAYS_e = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]


def test_illness_data_p_keys():
    m = fam("illness_data_p")
    kinds = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        kinds[p["kind"]] += 1
        if p["kind"] == "thermometer":
            r = p["reading"]
            assert r == int(r) and 38 <= r <= 41
            assert num(qs[0].answer) == r and "37 °C" in " ".join(texts(m, p))
            assert num(qs[1].answer) == r - 37
        elif p["kind"] == "clinic":
            kids, temps = p["children"], p["temps"]
            hot = [k for k, t in zip(kids, temps) if t > 37.5]
            assert len(hot) == 1 and all(t * 2 == int(t * 2) for t in temps)
            one_correct(qs[0], lambda o: o == hot[0])
            who = re.search(r"for (\w+)\?", qs[1].stem).group(1)
            assert num(qs[1].answer) == temps[kids.index(who)]
            assert "37.5 °C" in " ".join(texts(m, p))
        elif p["kind"] == "cases":
            months, cases = p["months"], p["cases"]
            assert sorted(cases)[-1] - sorted(cases)[-2] >= p["step"] and all(c % p["step"] == 0 for c in cases)
            one_correct(qs[0], lambda o: o == months[cases.index(max(cases))])
            mo = re.search(r"in (\w+)\?$", qs[1].stem).group(1)
            assert int(qs[1].answer) == cases[months.index(mo)]
            a, b = re.search(r"in (\w+) than in (\w+)\?$", qs[2].stem).groups()
            assert int(qs[2].answer) == cases[months.index(a)] - cases[months.index(b)] > 0
        else:
            temps = p["temps"]
            peak = temps.index(max(temps))
            assert temps.count(max(temps)) == 1 and temps[-1] <= 37
            back = next(i for i in range(peak, len(temps)) if temps[i] <= 37)
            for q in qs:
                if "highest" in q.stem:
                    one_correct(q, lambda o: o == _DAYS_e[peak])
                elif "come back down" in q.stem:
                    one_correct(q, lambda o: o == _DAYS_e[back])
                else:
                    day = re.search(r"on (\w+)\?$", q.stem).group(1)
                    assert num(q.answer) == temps[_DAYS_e.index(day)]
    assert min(kinds.values()) > 150, kinds


def test_illness_data_p_drawn_values_match_params():
    """The thermometer's liquid ends at the reading; the bars and the line points sit on their values."""
    m = fam("illness_data_p")
    for s in range(1, 160):
        p = m.sample(random.Random(s))
        fig = m.draw(p)
        ax = fig.axes[0]
        if p["kind"] in ("thermometer", "clinic"):
            liquid = [pa for pa in ax.patches if (pa.get_gid() or "").startswith("liquid:")]
            tops = sorted(round(float(pa.get_gid().split(":")[2]), 3) for pa in liquid)
            ends = sorted(round(pa.get_x() + pa.get_width(), 3) for pa in liquid)
            want = [p["reading"]] if p["kind"] == "thermometer" else sorted(p["temps"])
            assert tops == sorted(want) and ends == [round(v, 3) for v in sorted(want)], (s, tops, ends)
        elif p["kind"] == "cases":
            heights = [round(b.get_height(), 6) for b in ax.patches if (b.get_gid() or "").startswith("bar:")]
            assert heights == p["cases"], s
        else:
            line = next(ln for ln in ax.lines if ln.get_gid() == "temps")
            assert [round(y, 3) for y in line.get_ydata()] == p["temps"], s
        plt.close(fig)


# --- light_p ----------------------------------------------------------------------------------------------------

_DIST_e = {"Mercury": 58, "Venus": 108, "Earth": 150, "Mars": 228, "Jupiter": 778}
_ORBIT_e = {"Mercury": 88, "Venus": 225, "Earth": 365, "Mars": 687}
_SHINY_e = ["a mirror", "kitchen foil", "white paper", "a wooden board", "black cloth"]


def test_light_p_keys():
    m = fam("light_p")
    kinds = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        kinds[p["kind"]] += 1
        if p["kind"] == "mirror":
            mx, a, b = p["mx"], p["a"], p["b"]
            letters = "ABC"

            def sees(h):  # on the reflected ray: from the mirror point, a across for every b up, on the far side
                dx, dy = h[0] - mx, h[1]
                return dx > 0 and dx * b == dy * a

            heads = p["heads"]
            assert sum(sees(h) for h in heads) == 1
            for h in heads:  # every other head is plainly off the ray
                if not sees(h):
                    assert abs((h[0] - mx) * b - h[1] * a) / math.hypot(a, b) >= 0.9, (s, h)
            one_correct(qs[0], lambda o: sees(heads[letters.index(o)]))
        elif p["kind"] == "surfaces":
            surf, lux = p["surfaces"], p["lux"]
            order = [x for x in _SHINY_e if x in surf]
            assert sorted(lux, reverse=True) == [lux[surf.index(x)] for x in order]  # shinier reflects more
            for q in qs:
                if "more light" in q.stem:
                    x, y = re.search(r"did (.+) reflect than (.+)\?", q.stem).groups()
                    assert int(q.answer) == lux[surf.index(x)] - lux[surf.index(y)] > 0
                elif "How many surfaces" in q.stem:
                    n = int(re.search(r"more than (\d+) lux", q.stem).group(1))
                    assert n not in lux and int(q.answer) == sum(v > n for v in lux)
                else:
                    x = re.search(r"did (.+) reflect, in lux\?", q.stem).group(1)
                    assert int(q.answer) == lux[surf.index(x)]
        else:
            planets, what = p["planets"], p["measure"]
            table = _DIST_e if what == "distance" else _ORBIT_e
            assert planets == [x for x in table if x in planets]  # in order from the Sun
            for q in qs:
                diff = re.search(r"farther from the Sun is (\w+) than (\w+)\?|more days does (\w+) take than (\w+) to", q.stem)
                read = re.search(r"How far is (\w+) from|How many days does (\w+) take to", q.stem)
                if diff:
                    x, y = [g for g in diff.groups() if g]
                    assert int(q.answer) == table[x] - table[y] > 0, q.stem
                elif "closer to the Sun than Earth" in q.stem:
                    assert what == "distance" and "Earth" in planets
                    assert int(q.answer) == sum(table[x] < table["Earth"] for x in planets)
                else:
                    x = [g for g in read.groups() if g][0]
                    assert int(q.answer) == table[x]
            shown = texts(m, p)
            assert all(str(table[x]) in shown and x in shown for x in planets), s
    assert min(kinds.values()) > 250, kinds


# ==== group f ====
# Primary environment and tools: tools_p, waste_p, air_pollution_p, drinking_water_p, energy_p.

NEW_F = ("tools_p", "waste_p", "air_pollution_p", "drinking_water_p", "energy_p")
EDITED_F = ()
TARGETS_F = [
    ("tools_p", "Agricultural Tools", 3), ("tools_p", "Carpentry Tools", 5), ("tools_p", "Masonry Tools", 5),
    ("tools_p", "Mechanical and blacksmith tools", 6),
    ("waste_p", "Waste and Hygiene", 2), ("waste_p", "Sustainable waste management", 6),
    ("air_pollution_p", "Air pollution", 6),
    ("drinking_water_p", "Drinking Water", 3),
    ("energy_p", "Energy management", 6),
]
NEVER_F = {
    "tools_p": {"Simple Machines", "Simple machines", "ICT Tools", "Objects Production", "Computer My Friend",
                "Soil and Cultivation", "Making Toys and Classroom Learning Materials"},
    "waste_p": {"Water Pollution", "Materials Used at School and at Home", "Natural and Artificial Things",
                "Air pollution", "Water", "Materials in my world"},
    "air_pollution_p": {"Air, Wind and Sound", "Sustainable waste management", "Waste and Hygiene"},
    "drinking_water_p": {"Water", "Water Pollution", "Waste and Hygiene"},
    "energy_p": {"Programming for Children", "Programming for children", "Light and Heat", "Electricity",
                 "Simple machines", "Sound", "Shadows", "Light and dark", "Pushes and pulls", "Food chains and food webs",
                 "Energy and forces"},
}

# --- this file's own tables (a Primary teacher would agree with each) ------------------------------------------

USE_f = {
    "farm": {"hoe": "digging the soil", "machete": "cutting bushes", "rake": "gathering dry leaves",
             "watering can": "watering seedlings", "wheelbarrow": "carrying manure", "garden fork": "turning compost"},
    "carpentry": {"saw": "cutting planks", "hammer": "knocking in nails", "plane": "making wood smooth",
                  "chisel": "cutting holes in wood", "screwdriver": "turning screws", "tape measure": "measuring length",
                  "try square": "marking right angles"},
    "masonry": {"trowel": "spreading mortar", "spirit level": "checking a surface is level",
                "plumb bob": "checking a wall is upright", "float": "smoothing plaster",
                "shovel": "mixing sand and cement", "mason's square": "checking corners are square"},
    "mechanic": {"spanner": "tightening nuts and bolts", "pliers": "gripping and bending wire",
                 "screwdriver": "turning screws", "hacksaw": "cutting metal", "tyre pump": "pumping air into tyres",
                 "oil can": "oiling moving parts"},
    "blacksmith": {"anvil": "resting hot metal on while hammering", "tongs": "holding hot metal",
                   "hammer": "beating metal into shape", "bellows": "blowing air into the fire",
                   "bucket of water": "cooling hot metal"},
}
STAGES_f = {"farm": (3, 4), "carpentry": (5, 6), "masonry": (5, 6), "mechanic": (5, 6), "blacksmith": (5, 6)}
TOOL_CONCEPT_f = {"farm": "science.agricultural-tools", "carpentry": "science.carpentry-tools",
                  "masonry": "science.masonry-tools", "mechanic": "science.mechanical-tools",
                  "blacksmith": "science.mechanical-tools"}
# Two tools that look alike in a small picture never stand in one figure.
APART_f = [{"rake", "garden fork"}, {"chisel", "screwdriver"}, {"saw", "chisel"}]

ROTS_f = {"banana peel", "dry leaves", "maize cob", "potato peels"}
NOT_ROT_f = {"plastic bottle", "tin can", "glass jar", "plastic bag"}
POLLUTES_f = {"factory", "car", "burning rubbish", "cooking fire"}
CLEAN_f = {"tree", "bicycle", "solar panel"}
RENEWABLE_f = {"sun", "wind", "flowing water"}
RUNS_OUT_f = {"petrol", "cooking gas", "coal"}
CHAINS_f = {
    "torch": [("battery", "chemical"), ("wires", "electrical"), ("bulb", "light")],
    "radio": [("battery", "chemical"), ("wires", "electrical"), ("loudspeaker", "sound")],
    "bicycle lamp": [("turning wheel", "kinetic"), ("dynamo", "electrical"), ("lamp", "light")],
    "solar fan": [("sunlight", "light"), ("solar panel", "electrical"), ("fan", "kinetic")],
    "wind kettle": [("wind", "kinetic"), ("generator", "electrical"), ("kettle", "heat")],
    "water radio": [("falling water", "kinetic"), ("generator", "electrical"), ("loudspeaker", "sound")],
}
FORMS_f = ["chemical", "electrical", "light", "sound", "heat", "kinetic"]
LETTERS_f = "ABCDEF"


def _gids_f(m, p) -> list:
    fig = m.draw(p)
    try:
        ax = fig.axes[0]
        return [a.get_gid() for a in list(ax.patches) + list(ax.lines) + list(ax.texts) if a.get_gid()]
    finally:
        plt.close(fig)


@pytest.mark.parametrize("fid", NEW_F)
def test_an_mcq_has_four_options_at_most_f(fid):
    m = fam(fid)
    for s in SEEDS:
        _, qs = run(m, s)
        for q in qs:
            assert q.kind == "short" or 3 <= len(q.options) <= 4, (fid, s, q.options)


# --- tools_p ----------------------------------------------------------------------------------------------------

def test_tools_p():
    m = fam("tools_p")
    sets = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        table = USE_f[p["set"]]
        sets[p["set"]] += 1
        tools = p["tools"]
        assert len(tools) == 4 and len(set(tools)) == 4 and set(tools) <= set(table), (s, p)
        assert not any(pair <= set(tools) for pair in APART_f), (s, tools)
        assert m.stages(p) == STAGES_f[p["set"]]
        assert set(m.concepts_for(p)) == {TOOL_CONCEPT_f[p["set"]]}, (s, p)
        assert qs[0].stem.split()[0] in NAMES
        # Q1: the letter of the tool whose use the stem names
        q = qs[0]
        use = re.search(r"used for (.+)\?$", q.stem).group(1)
        holders = [i for i, t in enumerate(tools) if table[t] == use]
        assert len(holders) == 1, (s, q.stem)
        assert q.kind == "mcq" and q.options == list("ABCD") and picked(q) == "ABCD"[holders[0]], (s, q)
        # Q2: what a lettered tool is used for, by the printed table
        q = qs[1]
        letter = re.search(r"tool ([A-D]) used for", q.stem).group(1)
        key = table[tools["ABCD".index(letter)]]
        assert set(q.options) <= {table[t] for t in tools}, (s, q.options)
        one_correct(q, lambda o: o == key)
    assert all(sets[k] >= 120 for k in USE_f), sets


def test_tools_p_draws_each_tool_in_its_box_and_prints_the_table():
    m = fam("tools_p")
    for s in DRAWN:
        p = m.sample(random.Random(s))
        table = USE_f[p["set"]]
        shown = texts(m, p)
        for t in p["tools"]:
            assert t.capitalize() in shown and table[t] in shown, (s, t)
        gids = _gids_f(m, p)
        drawn = {g for g in gids if g.startswith("tool:")}
        assert {f"tool:{i}:{t}" for i, t in enumerate(p["tools"])} == drawn, (s, drawn)
        assert {f"letter:{c}" for c in "ABCD"} <= set(gids)
        # the table lists the tools in alphabetical order, so its order says nothing about the letters
        rows = [t for t in sorted(p["tools"])]
        names = [x for x in shown if x in {t.capitalize() for t in rows}]
        assert names == [t.capitalize() for t in rows], (s, names)


def test_tools_p_mechanic_figures_never_reach_masonry_or_carpentry(index):
    link, ix, _ = index
    m = fam("tools_p")
    by_key = {t["key"]: t for t in ix}
    for s in range(1, 200):
        p = m.sample(random.Random(s))
        names = {by_key[k]["name"].strip() for k in link.topics_for(ix, m, p)}
        others = {"farm": "Agricultural Tools", "carpentry": "Carpentry Tools", "masonry": "Masonry Tools",
                  "mechanic": "Mechanical and blacksmith tools", "blacksmith": "Mechanical and blacksmith tools"}
        mine = others[p["set"]]
        assert mine in names, (s, p["set"], names)
        assert not (names & (set(others.values()) - {mine})), (s, p["set"], names)


# --- waste_p ----------------------------------------------------------------------------------------------------

def test_waste_p():
    m = fam("waste_p")
    subs = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        subs[p["sub"]] += 1
        assert qs[0].stem.split()[0] in NAMES
        if p["sub"] == "sort":
            items = p["items"]
            assert 4 <= len(items) <= 6 and len(set(items)) == len(items) and set(items) <= ROTS_f | NOT_ROT_f
            assert m.stages(p) == (2, 4)
            rots = [i for i, t in enumerate(items) if t in ROTS_f]
            for q in qs:
                if q.kind == "short":
                    if "compost pit" in q.stem:
                        assert int(q.answer) == len(rots), (s, q.stem)
                    else:
                        assert "recycling sack" in q.stem and int(q.answer) == len(items) - len(rots), (s, q.stem)
                    assert re.search(r"How many", q.stem)
                else:
                    want_rot = "compost pit" in q.stem
                    assert want_rot or "recycling sack" in q.stem
                    assert q.options == sorted(q.options) and len(q.options) >= 3
                    one_correct(q, lambda o: (items[LETTERS_f.index(o)] in ROTS_f) == want_rot)
            assert {q.kind for q in qs} == {"mcq", "short"}
        else:
            kinds, kg = p["kinds"], p["kg"]
            assert len(set(kg)) == len(kg) and all(v % p["step"] == 0 and 0 < v <= p["top"] for v in kg)
            assert m.stages(p) == (5, 6)
            q = qs[0]
            one_correct(q, lambda o: kinds.index(o) == kg.index(max(kg)))
            assert int(qs[1].answer) == sum(kg), (s, qs[1].stem)
            a, b = re.search(r"more kilograms of (.+?) than (.+?) were", qs[2].stem).groups()
            ia, ib = [k.lower() for k in kinds].index(a.lower()), [k.lower() for k in kinds].index(b.lower())
            assert int(qs[2].answer) == kg[ia] - kg[ib] > 0, (s, qs[2].stem)
    assert subs["sort"] >= 400 and subs["data"] >= 400, subs


def test_waste_p_prints_what_it_asks():
    m = fam("waste_p")
    for s in DRAWN:
        p = m.sample(random.Random(s))
        shown = texts(m, p)
        if p["sub"] == "sort":
            for i, t in enumerate(p["items"]):
                assert t in shown and LETTERS_f[i] in shown, (s, t)
            assert any("compost pit" in x.lower() for x in shown) and any("recycling sack" in x.lower() for x in shown)
            gids = _gids_f(m, p)
            assert {f"item:{i}:{t}" for i, t in enumerate(p["items"])} <= set(gids), (s, gids)
        else:
            for k in p["kinds"]:
                assert k in shown, (s, k)
            ticks = {int(x) for x in shown if re.fullmatch(r"\d+", x)}
            assert set(range(0, p["top"] + 1, p["step"])) <= ticks, (s, ticks)


# --- air_pollution_p ----------------------------------------------------------------------------------------------

def test_air_pollution_p():
    m = fam("air_pollution_p")
    subs = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        subs[p["sub"]] += 1
        assert m.stages(p) == (5, 6) and qs[0].stem.split()[0] in NAMES
        if p["sub"] == "scene":
            things = p["things"]
            assert len(things) == 5 and len(set(things)) == 5 and set(things) <= POLLUTES_f | CLEAN_f
            n = sum(t in POLLUTES_f for t in things)
            assert 2 <= n <= 3
            assert int(qs[0].answer) == n, (s, qs[0].stem)
            q = qs[1]
            want = "does not pollute" not in q.stem
            one_correct(q, lambda o: (things[LETTERS_f.index(o)] in POLLUTES_f) == want)
        else:
            days, limit = p["levels"], p["limit"]
            assert len(days) == 7 and all(v % p["step"] == 0 and v != limit for v in days)
            assert len({v for v in days if v == max(days)}) == 1 and days.count(max(days)) == 1
            assert int(qs[0].answer) == sum(v > limit for v in days), (s, qs[0].stem)
            one_correct(qs[1], lambda o: p["names"].index(o) == days.index(max(days)))
            a, b = re.search(r"level on (\w+) than on (\w+)\?", qs[2].stem).groups()
            assert int(qs[2].answer) == days[p["names"].index(a)] - days[p["names"].index(b)] > 0
    assert subs["scene"] >= 400 and subs["days"] >= 400, subs


def test_air_pollution_p_draws_smoke_only_where_it_pollutes():
    m = fam("air_pollution_p")
    for s in DRAWN:
        p = m.sample(random.Random(s))
        if p["sub"] != "scene":
            shown = texts(m, p)
            assert "Safe limit" in shown and str(p["limit"]) in shown, (s, shown)
            continue
        gids = _gids_f(m, p)
        smoke = {int(g.split(":")[1]) for g in gids if g.startswith("smoke:")}
        assert smoke == {i for i, t in enumerate(p["things"]) if t in POLLUTES_f}, (s, smoke, p["things"])
        shown = texts(m, p)
        for i, t in enumerate(p["things"]):
            assert t in shown and LETTERS_f[i] in shown


# --- drinking_water_p ---------------------------------------------------------------------------------------------

def test_drinking_water_p():
    m = fam("drinking_water_p")
    subs = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        subs[p["sub"]] += 1
        assert m.stages(p) == (3, 4) and qs[0].stem.split()[0] in NAMES
        if p["sub"] == "dose":
            total = p["size"] * p["count"]
            assert total <= 100 and total % p["per_cap"] == 0 and total // p["per_cap"] <= 10
            assert int(qs[0].answer) == total, (s, qs[0].stem)
            assert int(qs[1].answer) == total // p["per_cap"], (s, qs[1].stem)
            assert total // p["per_cap"] != p["count"] or p["size"] == p["per_cap"]
        else:
            layers, letters = p["layers"], p["letters"]
            assert 3 <= len(layers) <= 5 and len(set(letters)) == len(letters)
            order = ["small stones", "coarse sand", "fine sand", "charcoal", "cloth"]
            assert layers == [x for x in order if x in layers] and layers[-1] == "cloth"
            q = qs[0]
            asked = re.search(r"shows the (.+) layer\?", q.stem).group(1)
            one_correct(q, lambda o: o == letters[layers.index(asked)])
            for q in qs:
                assert q.options == sorted(q.options) and set(q.options) <= set(letters)
                assert len(q.options) == min(4, len(letters))
            one_correct(qs[1], lambda o: o == letters[-1])
    assert subs["dose"] >= 400 and subs["filter"] >= 400, subs
    # a dose figure is not always one cap a container
    dose = [m.sample(random.Random(s)) for s in range(1, 300)]
    assert sum(1 for p in dose if p["sub"] == "dose" and p["size"] != p["per_cap"]) >= 50


def test_drinking_water_p_prints_the_label_and_the_key():
    m = fam("drinking_water_p")
    for s in DRAWN:
        p = m.sample(random.Random(s))
        shown = " | ".join(texts(m, p))
        if p["sub"] == "dose":
            assert f"1 cap for every {p['per_cap']} litres" in shown, (s, shown)
            assert shown.count(f"{p['size']} litres") >= p["count"], (s, shown)
        else:
            for layer, letter in zip(p["layers"], p["letters"]):
                assert layer in shown.lower() and letter in shown


# --- energy_p -----------------------------------------------------------------------------------------------------

def test_energy_p():
    m = fam("energy_p")
    subs = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        subs[p["sub"]] += 1
        assert m.stages(p) == (5, 6) and qs[0].stem.split()[0] in NAMES
        if p["sub"] == "chain":
            chain = CHAINS_f[p["device"]]
            key = chain[p["blank"]][1] + " energy"
            one_correct(qs[0], lambda o: o == key)
            assert all(o.replace(" energy", "") in FORMS_f for o in qs[0].options)
            if p["blank"] != 2:
                assert len(qs) == 2
                q = qs[1]
                assert f"into {chain[2][1]} energy" in q.stem
                one_correct(q, lambda o: o == chain[2][0])
            else:
                assert len(qs) == 1
        elif p["sub"] == "sources":
            things = p["things"]
            assert len(things) == 5 and len(set(things)) == 5 and set(things) <= RENEWABLE_f | RUNS_OUT_f
            k = sum(t in RENEWABLE_f for t in things)
            assert 2 <= k <= 3 and int(qs[0].answer) == k
            q = qs[1]
            want_renew = "will not run out" in q.stem
            assert want_renew or "will run out" in q.stem
            one_correct(q, lambda o: (things[LETTERS_f.index(o)] in RENEWABLE_f) == want_renew)
        else:
            items, units = p["items"], p["units"]
            assert len(set(units)) == len(units) and all(0 < u <= p["top"] for u in units)
            one_correct(qs[0], lambda o: items.index(o) == units.index(max(units)))
            assert int(qs[1].answer) == sum(units)
            a, b = re.search(r"more units did the (.+?) use than the (.+?)\?", qs[2].stem).groups()
            low = [i.lower() for i in items]
            assert int(qs[2].answer) == units[low.index(a)] - units[low.index(b)] > 0
    assert all(subs[k] >= 250 for k in ("chain", "sources", "use")), subs


def test_energy_p_prints_what_it_asks():
    m = fam("energy_p")
    for s in DRAWN:
        p = m.sample(random.Random(s))
        shown = texts(m, p)
        joined = " | ".join(shown)
        if p["sub"] == "chain":
            chain = CHAINS_f[p["device"]]
            for i, (part, form) in enumerate(chain):
                assert part.capitalize() in shown, (s, part)
                if i == p["blank"]:
                    assert f"{form} energy" not in shown
                else:
                    assert f"{form} energy" in shown
            assert "?" in shown
        elif p["sub"] == "sources":
            for i, t in enumerate(p["things"]):
                assert t in shown and LETTERS_f[i] in shown
            assert "will not run out" in joined and "will run out" in joined
        else:
            for it in p["items"]:
                assert it in shown


# ==== group g ====
# Primary plants and animals: animal_care_p (feed tables, egg and milk records), plant_parts_p (a plant's parts, a
# garden's cultivated plants, trees planted and cut), natural_made_p (natural things and things made by people),
# flower_parts_p (a flower's parts and seed dispersal). carroll_sort_p and flower_diagram were NOT edited: their own
# answer tests read every seed as their one sub-type (an animal's HAS row, a "type of flower" question), so a new
# sub-type in either breaks a test this wave may not change.

NEW_G = ("animal_care_p", "plant_parts_p", "natural_made_p", "flower_parts_p")
EDITED_G = ()
TARGETS_G = [
    ("animal_care_p", "Rabbits and Chickens Management", 4), ("animal_care_p", "Animals", 6),
    ("plant_parts_p", "Plants", 1), ("plant_parts_p", "Plants", 2), ("plant_parts_p", "Plants and Environment", 5),
    ("natural_made_p", "Natural and Artificial Things", 2),
    ("flower_parts_p", "Plant reproduction", 6), ("flower_parts_p", "The life cycle of flowering plants", None),
]
NEVER_G = {
    "animal_care_p": {"Plants", "Human Diseases", "Animals Classification", "Living and non-living things"},
    "plant_parts_p": {"Plant reproduction", "Rabbits and Chickens Management", "Writing Skills", "Agricultural Tools",
                      "Cells and living systems", "Soil and Cultivation", "Natural and Artificial Things"},
    "natural_made_p": {"Making Toys and Classroom Learning Materials", "Objects Production", "Waste and Hygiene",
                       "Looking at rocks", "Materials Used at School and at Home", "Plants"},
    "flower_parts_p": {"Plants", "Plants and Environment", "Plants Germination", "Living things",
                       "UNIT 16: ASEXUAL REPRODUCTION IN PLANTS"},
}

_DAYS_g = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


def _ints_g(words) -> set:
    """Every whole number printed in the figure's strings."""
    return {int(x) for w in words for x in re.findall(r"\d+", w.replace(" ", ""))}


def _topmost_g(fig, pt):
    """The filled patch a reader sees at a data point: the highest one containing it."""
    ax = fig.axes[0]
    disp = ax.transData.transform(pt)
    best = None
    for k, pa in enumerate(ax.patches):
        if not pa.get_visible() or not pa.get_fill() or pa.get_facecolor()[3] == 0:
            continue
        if pa.contains_point(disp):
            if best is None or (pa.get_zorder(), k) >= (best[0], best[1]):
                best = (pa.get_zorder(), k, pa)
    return best and best[2]


def _leader_end_g(fig, letter):
    ax = fig.axes[0]
    ln = [x for x in ax.lines if x.get_gid() == f"leader:{letter}"]
    assert len(ln) == 1, letter
    xs, ys = ln[0].get_data()
    return float(xs[-1]), float(ys[-1])


# --- animal_care_p ---------------------------------------------------------------------------------------

# Food for one animal each day, as a Primary book gives it (a farmer's own amounts, never a real farm's figures).
_FEED_g = {"rabbits": "bundles of grass", "hens": "cups of grain", "goats": "kg of grass", "cows": "kg of grass"}
_FARM_g = {"small": {"rabbits", "hens"}, "big": {"goats", "cows"}}
_BREEDS_g = ("Friesian", "Ankole")  # a Friesian cow gives far more milk than an Ankole cow


def test_animal_care_p():
    m = fam("animal_care_p")
    subs, asked = Counter(), Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        sub = p["sub"]
        subs[sub] += 1
        assert p["band"] == "P"
        lo, hi = m.stages(p)
        assert (lo, hi) == ((3, 5) if sub == "eggs" or (sub == "feed" and p["farm"] == "small") else (5, 6)), (s, p)
        words = texts(m, p) if s <= 60 else None
        if sub == "eggs":
            eggs, days = p["eggs"], p["days"]
            assert days == _DAYS_g[:len(days)] and len(days) == len(eggs) == 6
            assert all(1 <= e <= 12 for e in eggs) and eggs.count(max(eggs)) == 1, (s, eggs)
            if words:
                assert {d[:3] for d in days} <= {w[:3] for w in words}
            for q in qs:
                if got := re.search(r"How many eggs were collected on (\w+)\?$", q.stem):
                    assert q.answer == str(eggs[days.index(got.group(1))]), (s, q.stem)
                    asked["read"] += 1
                elif q.stem.endswith("On which day were the most eggs collected?"):
                    one_correct(q, lambda o: eggs[days.index(o)] == max(eggs))
                    asked["most"] += 1
                elif q.stem.endswith("How many eggs were collected altogether in the six days?"):
                    assert q.answer == str(sum(eggs)), s
                    asked["total"] += 1
                elif got := re.search(r"How many more eggs were collected on (\w+) than on (\w+)\?$", q.stem):
                    d = eggs[days.index(got.group(1))] - eggs[days.index(got.group(2))]
                    assert d > 0 and q.answer == str(d), (s, q.stem)
                    asked["more"] += 1
                else:
                    pytest.fail(f"{s}: {q.stem}")
        elif sub == "milk":
            days, litres = p["days"], p["litres"]
            assert p["cows"] == list(_BREEDS_g) and days == _DAYS_g[:5]
            fr, an = litres
            assert all(8 <= v <= 15 for v in fr) and all(1 <= v <= 6 for v in an), (s, litres)
            assert fr.count(max(fr)) == 1 and an.count(max(an)) == 1
            for q in qs:
                if got := re.search(r"How many litres of milk did the (\w+) cow give on (\w+)\?$", q.stem):
                    v = litres[_BREEDS_g.index(got.group(1))][days.index(got.group(2))]
                    assert q.answer == str(v) and f"{v} litres" in q.accepted, (s, q.stem)
                    asked["milk"] += 1
                elif got := re.search(r"How many litres did the two cows give together on (\w+)\?$", q.stem):
                    j = days.index(got.group(1))
                    assert q.answer == str(fr[j] + an[j]), s
                    asked["together"] += 1
                elif got := re.search(r"How many more litres did the Friesian cow give than the Ankole cow on (\w+)\?$",
                                      q.stem):
                    j = days.index(got.group(1))
                    assert q.answer == str(fr[j] - an[j]), s
                    asked["more"] += 1
                elif got := re.search(r"On which day did the (\w+) cow give the most milk\?$", q.stem):
                    row = litres[_BREEDS_g.index(got.group(1))]
                    one_correct(q, lambda o: row[days.index(o)] == max(row))
                    asked["best"] += 1
                else:
                    pytest.fail(f"{s}: {q.stem}")
        else:
            rows = p["rows"]
            assert {r[0] for r in rows} == _FARM_g[p["farm"]] and len(rows) == 2
            for animal, n, amount, unit in rows:
                assert unit == _FEED_g[animal] and n >= 2 and amount >= 1
                if words:
                    shown = unit if amount > 1 else unit.replace("bundles", "bundle").replace("cups", "cup")
                    assert str(n) in words and f"{amount} {shown}" in words, (s, animal, words)
            per = {r[0]: (r[1], r[2]) for r in rows}
            for q in qs:
                if got := re.search(r"How many ([a-z ]+) do all the (\w+) eat in one day\?$", q.stem):
                    n, a = per[got.group(2)]
                    assert got.group(1) == _FEED_g[got.group(2)] and q.answer == str(n * a), (s, q.stem)
                    asked["day"] += 1
                elif got := re.search(r"There are 7 days in a week\. How many ([a-z ]+) do all the (\w+) eat in one week\?$",
                                      q.stem):
                    n, a = per[got.group(2)]
                    assert q.answer == str(n * a * 7), (s, q.stem)
                    asked["week"] += 1
                elif got := re.search(r"The farm gets (\d+) more (\w+)\. How many ([a-z ]+) will all the \2 eat each day\?$",
                                      q.stem):
                    n, a = per[got.group(2)]
                    assert q.answer == str((n + int(got.group(1))) * a), (s, q.stem)
                    asked["more"] += 1
                else:
                    pytest.fail(f"{s}: {q.stem}")
    assert min(subs.values()) > 250 and len(subs) == 3, subs
    assert min(asked.values()) > 60, asked


def test_animal_care_p_draws_every_value_on_a_gridline():
    m = fam("animal_care_p")
    for s in range(1, 81):
        p = m.sample(random.Random(s))
        if p["sub"] == "feed":
            continue
        fig = m.draw(p)
        ax = fig.axes[0]
        heights = sorted(round(b.get_height(), 6) for b in ax.patches if (b.get_gid() or "").startswith("bar:"))
        values = sorted(p["eggs"] if p["sub"] == "eggs" else p["litres"][0] + p["litres"][1])
        ticks = set(round(t, 6) for t in ax.get_yticks(minor=True)) | set(round(t, 6) for t in ax.get_yticks())
        plt.close(fig)
        assert heights == values, (s, heights, values)
        assert all(h in ticks for h in heights), s


# --- plant_parts_p ---------------------------------------------------------------------------------------

_JOB_g = {"root": "takes in water from the soil", "stem": "holds the plant up", "leaf": "makes food for the plant",
          "flower": "makes seeds", "fruit": "keeps the seeds safe"}
_CROPS_g = {"maize", "beans", "cabbage", "banana"}
_WILD_g = {"grass", "bush", "weed", "wild tree"}


def test_plant_parts_p():
    m = fam("plant_parts_p")
    subs, asked = Counter(), Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        sub = p["sub"]
        subs[sub] += 1
        assert m.stages(p) == {"garden": (1, 1), "parts": (2, 4), "trees": (4, 6)}[sub]
        if sub == "parts":
            labels = p["labels"]
            assert 3 <= len(labels) <= 4 and set(labels.values()) <= set(_JOB_g) and len(set(labels.values())) == len(labels)
            assert sorted(labels) == [chr(65 + i) for i in range(len(labels))]
            if "fruit" in labels.values():
                assert p["pods"] >= 1
            at = {v: k for k, v in labels.items()}
            for q in qs:
                if got := re.search(r"Which letter shows the part that (.+)\?$", q.stem):
                    part = next(k for k, v in _JOB_g.items() if v == got.group(1))
                    assert part in at and q.options == sorted(labels), (s, q.stem)
                    one_correct(q, lambda o: labels[o] == part)
                    asked["job"] += 1
                elif got := re.search(r"What is the part at letter ([A-D]) called\?$", q.stem):
                    one_correct(q, lambda o: o == labels[got.group(1)])
                    assert all(o in _JOB_g for o in q.options)
                    asked["name"] += 1
                elif got := re.search(r"How many (leaves|flowers) does the plant have\?$", q.stem):
                    assert q.answer == str(p[got.group(1)]), s
                    asked["count"] += 1
                else:
                    pytest.fail(f"{s}: {q.stem}")
        elif sub == "garden":
            inside, outside, labels = p["inside"], p["outside"], p["labels"]
            assert set(inside) <= _CROPS_g and set(outside) <= _WILD_g
            assert 2 <= len(inside) <= 6 and 2 <= len(outside) <= 5
            assert sorted(labels) == ["A", "B", "C", "D"]
            sides = Counter(v[0] for v in labels.values())
            assert sorted(sides.values()) == [1, 3], (s, labels)
            for q in qs:
                if q.stem.endswith("How many cultivated plants can you see?"):
                    assert q.answer == str(len(inside)), s
                    asked["in"] += 1
                elif q.stem.endswith("How many plants grow on their own outside the fence?"):
                    assert q.answer == str(len(outside)), s
                    asked["out"] += 1
                elif q.stem.endswith("Which letter shows a cultivated plant?"):
                    one_correct(q, lambda o: labels[o][0] == "in")
                    asked["letter-in"] += 1
                elif q.stem.endswith("Which letter shows a plant that grows on its own?"):
                    one_correct(q, lambda o: labels[o][0] == "out")
                    asked["letter-out"] += 1
                else:
                    pytest.fail(f"{s}: {q.stem}")
        else:
            years, planted, cut = p["years"], p["planted"], p["cut"]
            assert len(years) == len(planted) == len(cut) and all(v % 10 == 0 and 10 <= v <= 90 for v in planted + cut)
            assert all(a != b for a, b in zip(planted, cut))
            assert sum(1 for a, b in zip(planted, cut) if b > a) == 1, (s, planted, cut)
            for q in qs:
                if got := re.search(r"How many trees were planted in (\d{4})\?$", q.stem):
                    assert q.answer == str(planted[years.index(int(got.group(1)))]), s
                    asked["read"] += 1
                elif q.stem.endswith("In which year were more trees cut down than planted?"):
                    one_correct(q, lambda o: cut[years.index(int(o))] > planted[years.index(int(o))])
                    asked["year"] += 1
                elif got := re.search(r"How many more trees were planted than cut down in (\d{4})\?$", q.stem):
                    j = years.index(int(got.group(1)))
                    assert planted[j] > cut[j] and q.answer == str(planted[j] - cut[j]), s
                    asked["more"] += 1
                elif q.stem.endswith("How many trees were cut down altogether in these years?"):
                    assert q.answer == str(sum(cut)), s
                    asked["total"] += 1
                else:
                    pytest.fail(f"{s}: {q.stem}")
    assert min(subs.values()) > 250 and len(subs) == 3, subs
    assert min(asked.values()) > 40, asked


def test_plant_parts_p_letters_point_at_their_parts():
    m = fam("plant_parts_p")
    for s in range(1, 61):
        p = m.sample(random.Random(s))
        if p["sub"] == "trees":
            continue
        fig = m.draw(p)
        ax = fig.axes[0]
        for L, what in p["labels"].items():
            assert [t for t in ax.texts if t.get_gid() == f"letter:{L}" and t.get_text() == L], (s, L)
            end = _leader_end_g(fig, L)
            seen = _topmost_g(fig, end)
            want = f"part:{what}" if p["sub"] == "parts" else f"plant:{what[0]}:{what[1]}"
            assert seen is not None and (seen.get_gid() or "").startswith(want), (s, L, what, seen and seen.get_gid())
        if p["sub"] == "parts":
            for kind, n in (("leaf", p["leaves"]), ("flower", p["flowers"]), ("fruit", p["pods"])):
                assert len([pa for pa in ax.patches if pa.get_gid() == f"part:{kind}"]) == n, (s, kind)
        else:
            fence = next(pa for pa in ax.patches if pa.get_gid() == "fence")
            fx0, fx1 = fence.get_x(), fence.get_x() + fence.get_width()
            for side, names in (("in", p["inside"]), ("out", p["outside"])):
                for i in range(len(names)):
                    pts = [pa.get_extents() for pa in ax.patches if pa.get_gid() == f"plant:{side}:{i}"]
                    pts += [ln.get_window_extent() for ln in ax.lines if ln.get_gid() == f"plant:{side}:{i}"]
                    assert pts, (s, side, i)
                    a, b = ax.transData.transform((fx0, 0))[0], ax.transData.transform((fx1, 0))[0]
                    for e in pts:
                        if side == "in":
                            assert a < e.x0 and e.x1 < b, (s, side, i)
                        else:
                            assert e.x1 < a or e.x0 > b, (s, side, i)
        plt.close(fig)


def test_plant_parts_p_tree_bars_sit_on_gridlines():
    m = fam("plant_parts_p")
    for s in range(1, 81):
        p = m.sample(random.Random(s))
        if p["sub"] != "trees":
            continue
        fig = m.draw(p)
        ax = fig.axes[0]
        heights = sorted(round(b.get_height()) for b in ax.patches if (b.get_gid() or "").startswith("bar:"))
        ticks = {round(t) for t in ax.get_yticks()}
        words = [t.get_text() for t in ax.get_xticklabels()]
        plt.close(fig)
        assert heights == sorted(p["planted"] + p["cut"]) and set(heights) <= ticks, s
        assert words == [str(y) for y in p["years"]], s


# --- natural_made_p --------------------------------------------------------------------------------------

_NATURAL_g = {"stone", "leaf", "feather", "snail shell", "flower", "stick"}
_MADE_g = {"cup", "chair", "ball", "pencil", "bottle", "spoon", "bucket", "book"}


def test_natural_made_p():
    m = fam("natural_made_p")
    asked = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        things = p["things"]
        assert len(things) == 8 and len(set(things)) == 8 and set(things) <= _NATURAL_g | _MADE_g
        n_nat = sum(t in _NATURAL_g for t in things)
        assert 3 <= n_nat <= 5, (s, things)
        letters = {chr(65 + i): t for i, t in enumerate(things)}
        if s <= 40:
            words = texts(m, p)
            for L, t in letters.items():
                assert L in words and t in words, (s, L, t)
        for q in qs:
            if q.stem.endswith("Which letter shows a thing made by people?"):
                one_correct(q, lambda o: letters[o] in _MADE_g)
                asked["made"] += 1
            elif q.stem.endswith("Which letter shows a natural thing?"):
                one_correct(q, lambda o: letters[o] in _NATURAL_g)
                asked["natural"] += 1
            elif q.stem.endswith("How many natural things are in the picture?"):
                assert q.answer == str(n_nat), s
                asked["count"] += 1
            elif q.stem.endswith("How many things in the picture are made by people?"):
                assert q.answer == str(8 - n_nat), s
                asked["count"] += 1
            else:
                pytest.fail(f"{s}: {q.stem}")
    assert min(asked.values()) > 300, asked


def test_natural_made_p_each_picture_sits_in_its_lettered_card():
    m = fam("natural_made_p")
    for s in range(1, 41):
        p = m.sample(random.Random(s))
        fig = m.draw(p)
        ax = fig.axes[0]
        fig.canvas.draw()
        r = fig.canvas.get_renderer()
        for i, t in enumerate(p["things"]):
            L = chr(65 + i)
            card = next(pa for pa in ax.patches if pa.get_gid() == f"card:{L}").get_window_extent(r)
            items = [pa.get_window_extent(r) for pa in ax.patches if (pa.get_gid() or "") == f"pic:{L}:{t}"]
            items += [ln.get_window_extent(r) for ln in ax.lines if (ln.get_gid() or "") == f"pic:{L}:{t}"]
            items += [x.get_window_extent(r) for x in ax.texts if x.get_gid() in (f"letter:{L}", f"name:{L}")]
            assert len(items) >= 3, (s, L, t)
            for e in items:
                assert card.x0 - 1 <= e.x0 and e.x1 <= card.x1 + 1 and card.y0 - 1 <= e.y0 and e.y1 <= card.y1 + 1, (s, L, t)
        plt.close(fig)


# --- flower_parts_p --------------------------------------------------------------------------------------

_FLOWER_JOB_g = {"anther": "makes pollen", "filament": "holds up the anther", "stigma": "catches pollen",
                 "style": "joins the stigma to the ovary", "ovary": "holds the ovules and becomes the fruit",
                 "petal": "attracts insects with its colour", "sepal": "protects the flower when it is a bud"}
_FEMALE_g = {"stigma", "style", "ovary"}
# What each seed or fruit has, as drawn, and how it is spread.
_SPREAD_g = {"wing": "by the wind", "parachute": "by the wind", "hooks": "on animals' fur",
             "juicy": "by animals that eat the fruit", "pod": "by its pod bursting open"}
# The same ways as the table and the options say them.
_SAY_g = {"by the wind": "The wind blows it away", "on animals' fur": "It sticks to animals' fur",
          "by animals that eat the fruit": "Animals eat the fruit", "by its pod bursting open": "The pod bursts open"}


def test_flower_parts_p():
    m = fam("flower_parts_p")
    subs, asked = Counter(), Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        subs[p["sub"]] += 1
        assert m.stages(p) == (5, 6)
        if p["sub"] == "parts":
            labels = p["labels"]
            assert {"anther", "ovary"} <= set(labels.values()) and 4 <= len(labels) <= 5
            assert set(labels.values()) <= set(_FLOWER_JOB_g) and sorted(labels) == [chr(65 + i) for i in range(len(labels))]
            for q in qs:
                if got := re.search(r"Which letter shows the part that (.+)\?$", q.stem):
                    part = next(k for k, v in _FLOWER_JOB_g.items() if v == got.group(1))
                    one_correct(q, lambda o: labels[o] == part)
                    asked["job"] += 1
                elif got := re.search(r"What is the part at letter ([A-E]) called\?$", q.stem):
                    one_correct(q, lambda o: o == labels[got.group(1)])
                    assert all(o in _FLOWER_JOB_g for o in q.options)
                    asked["name"] += 1
                elif q.stem.endswith("How many of the lettered parts are female parts?"):
                    assert q.answer == str(sum(v in _FEMALE_g for v in labels.values())), s
                    asked["female"] += 1
                else:
                    pytest.fail(f"{s}: {q.stem}")
        else:
            seeds = p["seeds"]
            assert len(seeds) == 4 and len(set(seeds)) == 4 and set(seeds) <= set(_SPREAD_g)
            letters = {chr(65 + i): k for i, k in enumerate(seeds)}
            for q in qs:
                if got := re.search(r"Which letter shows a seed spread (.+)\?$", q.stem):
                    way = got.group(1)
                    assert sum(_SPREAD_g[k] == way for k in seeds) == 1, (s, way)
                    one_correct(q, lambda o: _SPREAD_g[letters[o]] == way)
                    asked["which"] += 1
                elif got := re.search(r"How is the seed at letter ([A-D]) spread\?$", q.stem):
                    one_correct(q, lambda o: o == _SAY_g[_SPREAD_g[letters[got.group(1)]]])
                    assert sorted(q.options) == sorted(_SAY_g.values())
                    asked["how"] += 1
                elif q.stem.endswith("How many of the seeds are spread by the wind?"):
                    assert q.answer == str(sum(_SPREAD_g[k] == "by the wind" for k in seeds)), s
                    asked["wind"] += 1
                else:
                    pytest.fail(f"{s}: {q.stem}")
    assert min(subs.values()) > 300, subs
    assert min(asked.values()) > 150, asked


def test_flower_parts_p_letters_point_at_their_parts():
    m = fam("flower_parts_p")
    for s in range(1, 61):
        p = m.sample(random.Random(s))
        fig = m.draw(p)
        ax = fig.axes[0]
        if p["sub"] == "parts":
            for L, part in p["labels"].items():
                seen = _topmost_g(fig, _leader_end_g(fig, L))
                assert seen is not None and seen.get_gid() == f"part:{part}", (s, L, part, seen and seen.get_gid())
            words = " ".join(texts(m, p))
            for part, job in _FLOWER_JOB_g.items():  # the table names every part and its job
                assert part in words.lower() and job in words, (s, part)
        else:
            fig.canvas.draw()
            r = fig.canvas.get_renderer()
            for i, k in enumerate(p["seeds"]):
                L = chr(65 + i)
                card = next(pa for pa in ax.patches if pa.get_gid() == f"card:{L}").get_window_extent(r)
                pics = [x.get_window_extent(r) for x in list(ax.patches) + list(ax.lines) if x.get_gid() == f"pic:{L}:{k}"]
                assert pics, (s, L, k)
                for e in pics:
                    assert card.x0 - 1 <= e.x0 and e.x1 <= card.x1 + 1 and card.y0 - 1 <= e.y0 and e.y1 <= card.y1 + 1
        plt.close(fig)


def test_group_g_reaches_both_p1_plants_books(index):
    link, ix, _ = index
    reached = link.reach(ix, fam("plant_parts_p"), 200)
    assert {"db:1476", "db:1482", "db:1525", "db:1697"} <= reached


# ==== all groups ====
NEW = NEW_A + NEW_B + NEW_C + NEW_D + NEW_E + NEW_F + NEW_G
EDITED = EDITED_A + EDITED_B + EDITED_C + EDITED_D + EDITED_E + EDITED_F + EDITED_G
TARGETS = TARGETS_A + TARGETS_B + TARGETS_C + TARGETS_D + TARGETS_E + TARGETS_F + TARGETS_G
NEVER: dict = {}
for _part in (NEVER_A, NEVER_B, NEVER_C, NEVER_D, NEVER_E, NEVER_F, NEVER_G):
    for _fid, _names in _part.items():
        NEVER.setdefault(_fid, set()).update(_names)


# ==== shared checks (footer) =================================================================================
# In the merged file NEW, EDITED, TARGETS and NEVER join every group's lists; in a group's own file they are that
# group's. NEW: families written in this wave. EDITED: existing families given a new sub-type, band or link.

ALL = NEW + EDITED


@pytest.mark.parametrize("fid", ALL)
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


@pytest.mark.parametrize("fid", ALL)
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
def test_no_line_runs_through_a_label(fid):
    """Leader lines, curves and table rules sit beside the words they serve (P3z rule). A line a family means to
    run through text (none should) would need a gid starting "through:"."""
    m = fam(fid)
    for s in DRAWN:
        fig = m.draw(m.sample(random.Random(s)))
        boxes = drawn_texts(fig)
        for ax in fig.axes:
            for ln in ax.lines:
                if (ln.get_gid() or "").startswith("through:"):
                    continue
                for t, box in boxes:
                    assert not crosses(ln, box), (fid, s, ln.get_gid(), t.get_text())
        plt.close(fig)


@pytest.mark.parametrize("fid", ALL)
def test_a_figure_prints_big_enough(fid):
    """Primary figures print at 10 pt at least, ticks included; a secondary one at 8 pt (P3z rule)."""
    m = fam(fid)
    n = Counter()
    for s in range(1, 300):
        p = m.sample(random.Random(s))
        band = p.get("band") or m.BANDS[0]
        if n[band] >= 12:
            continue
        n[band] += 1
        fig = m.draw(p)
        sizes = [t.get_fontsize() for ax in fig.axes for t in ax.texts if t.get_text().strip()]
        sizes += [t.get_fontsize() for ax in fig.axes for t in ax.get_xticklabels() + ax.get_yticklabels()
                  if t.get_text().strip()]
        plt.close(fig)
        if sizes:
            assert min(sizes) >= (10 if band == "P" else 8), (fid, s, min(sizes))


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


@pytest.mark.parametrize("fid", ALL)
def test_primary_sentences_are_short(fid):
    """Short sentences a young child can follow read aloud."""
    m = fam(fid)
    for seed in range(1, 120):
        p, qs = run(m, seed)
        if p.get("band") != "P":
            continue
        for q in qs:
            for sentence in re.split(r"(?<=[.?!])\s+", q.stem):
                assert len(sentence.split()) <= 22, (fid, seed, sentence)


@pytest.mark.parametrize("fid", NEW)
def test_declares_its_concepts_bands_and_stages(fid):
    m = fam(fid)
    assert m.SUBJECT in ("biology", "science") and m.CONCEPTS and all(c.startswith(m.SUBJECT + ".") for c in m.CONCEPTS)
    assert m.NEEDS and re.compile(m.NEEDS) and m.AVOID
    for name in ALWAYS_NEVER:
        assert re.search(m.AVOID, name, re.I) or not re.search(m.NEEDS, name, re.I), (fid, name)
    bands = set()
    for s in range(1, 300):
        p = m.sample(random.Random(s))
        bands.add(p["band"])
        if hasattr(m, "concepts_for"):
            assert set(m.concepts_for(p)) <= set(m.CONCEPTS), (fid, s)
        if p["band"] == "P":
            lo, hi = m.stages(p)
            assert 1 <= lo <= hi <= 6, (fid, s)
    assert bands == set(m.BANDS), (fid, bands)


@pytest.mark.parametrize("fid,topic,stage", TARGETS)
def test_reaches_the_thin_topic_by_name(fid, topic, stage, index):
    link, ix, _ = index
    by_key = {t["key"]: t for t in ix}
    reached = {(by_key[k]["name"].strip(), by_key[k]["stage"]) for k in link.reach(ix, fam(fid), 200)}
    assert (topic, stage) in reached, (fid, topic, stage)


@pytest.mark.parametrize("fid", ALL)
def test_reaches_no_topic_it_cannot_serve(fid, index):
    link, ix, known = index
    m = fam(fid)
    assert set(m.CONCEPTS) <= known, sorted(set(m.CONCEPTS) - known)
    by_key = {t["key"]: t for t in ix}
    reached = {by_key[k]["name"].strip() for k in link.reach(ix, m, 200)}
    bad = reached & (ALWAYS_NEVER | NEVER.get(fid, set()))
    assert not bad, (fid, sorted(bad))
