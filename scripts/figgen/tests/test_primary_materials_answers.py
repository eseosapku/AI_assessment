"""Answers of the Primary materials, Earth and investigation families (P3s, Task 2), recomputed from each
figure's params over 1,000 seeds.

Nothing here calls a family's own helpers to work out a key. The ticks and crosses are checked against this
file's own table of what a test of each material shows; the water through each soil, the arrows of the
changes of state, the week's weather and the plants' heights are read from the params and the drawn figure,
and every key is worked out again from them. Every value asked is checked as shown: printed, drawn as a
symbol, or on a tick or gridline.
"""
import random
import re
from collections import Counter

import matplotlib.pyplot as plt
import pytest

from figgen.core import NAMES
from figgen.families import FAMILIES

SEEDS = range(1, 1001)
DRAWN = 200  # the figure is built and read for the first 200 seeds of each family
IDS = ("materials_test_p", "soil_drainage_p", "state_changes_p", "weather_chart_p", "plant_growth_p")


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


def texts(fig) -> list[str]:
    return [t.get_text() for ax in fig.axes for t in ax.texts]


def by_gid(fig) -> dict:
    """Every artist the figure tagged, by its gid: texts, lines and patches."""
    out = {}
    for ax in fig.axes:
        for a in [*ax.texts, *ax.lines, *ax.patches]:
            if a.get_gid():
                out[a.get_gid()] = a
    return out


def gridlines(ax) -> set[float]:
    return {round(float(v), 6) for v in list(ax.yaxis.get_majorticklocs()) + list(ax.yaxis.get_minorticklocs())}


def first_names_the_person(qs):
    assert any(qs[0].stem.startswith(n) for n in NAMES), qs[0].stem


def find(qs, pattern):
    hits = [q for q in qs if re.search(pattern, q.stem)]
    return hits[0] if hits else None


def own_wordings(m) -> int:
    """How many of 30 figures carry a stem no other of the 30 has (the shared wording test, P2a)."""
    stems = []
    for seed in range(1, 31):
        rng = random.Random(seed)
        stems.append({q.stem for q in m.questions(m.sample(rng), rng)})
    return sum(1 for i, s in enumerate(stems) if s - set().union(*(t for j, t in enumerate(stems) if j != i)))


def accepts(q, n, unit):
    assert q.kind == "short" and q.answer == str(n), (q.stem, q.answer, n)
    assert f"{n} {unit}" in q.accepted, (q.stem, q.accepted)


@pytest.mark.parametrize("fid", IDS)
def test_family_is_primary_science_worded_and_linked(fid):
    import sqlite3
    from pathlib import Path
    m = fam(fid)
    assert m.SUBJECT == "science" and m.BANDS == ("P",)
    assert m.CONCEPTS and all(c.startswith("science.") for c in m.CONCEPTS)
    assert m.NEEDS
    store = Path("C:/Users/Stephen/figure-library/figures.db")
    if store.exists():
        db = sqlite3.connect(f"file:{store}?mode=ro", uri=True)
        known = {r[0] for r in db.execute("SELECT id FROM concepts")}
        assert set(m.CONCEPTS) <= known, sorted(set(m.CONCEPTS) - known)
    assert own_wordings(m) >= 27, fid
    for seed in range(1, 80):
        p, qs = run(m, seed)
        assert p["band"] == "P" and p["level"] in ("lower", "upper")
        first = next((n for n in NAMES if qs[0].stem.startswith(n)), None)
        assert first, (fid, seed, qs[0].stem)
        assert len({q.stem for q in qs}) == len(qs), (fid, seed)
        for q in qs:
            for owner in re.findall(r"\b(" + "|".join(NAMES) + r")'s\b", q.stem):
                assert owner == first, (fid, seed, q.stem)
            if q.kind == "mcq":
                assert len(q.options) >= 3 and len(set(q.options)) == len(q.options), (fid, seed, q.options)


# --- materials_test_p -------------------------------------------------------------------------------

# What a class test of each material shows, as a Primary teacher would mark it. None: the test does not
# give a clear answer (cloth and paper float, then soak and sink; a nail cannot be dripped on), so the
# figure must never show that cell.
MATERIAL_TRUTH = {
    "cotton cloth": {"waterproof": False, "floats": None, "magnetic": False, "see-through": False, "bends": True},
    "clear plastic bag": {"waterproof": True, "floats": True, "magnetic": False, "see-through": True, "bends": True},
    "paper": {"waterproof": False, "floats": None, "magnetic": False, "see-through": None, "bends": True},
    "cardboard": {"waterproof": False, "floats": None, "magnetic": False, "see-through": False, "bends": True},
    "aluminium foil": {"waterproof": True, "floats": None, "magnetic": False, "see-through": False, "bends": True},
    "wooden block": {"waterproof": None, "floats": True, "magnetic": False, "see-through": False, "bends": False},
    "glass": {"waterproof": True, "floats": False, "magnetic": False, "see-through": True, "bends": False},
    "iron nail": {"waterproof": None, "floats": False, "magnetic": True, "see-through": False, "bends": False},
    "steel paper clip": {"waterproof": None, "floats": False, "magnetic": True, "see-through": False, "bends": True},
    "stone": {"waterproof": None, "floats": False, "magnetic": False, "see-through": False, "bends": False},
    "copper wire": {"waterproof": None, "floats": False, "magnetic": False, "see-through": False, "bends": True},
    "rubber band": {"waterproof": None, "floats": None, "magnetic": False, "see-through": False, "bends": True},
}
# Each job: what the material must do, and the one material a teacher would choose for it.
JOB_TRUTH = {
    "an umbrella": ({"waterproof": True, "bends": True}, "clear plastic bag"),
    "a raincoat": ({"waterproof": True, "bends": True}, "clear plastic bag"),
    "a window": ({"see-through": True, "bends": False}, "glass"),
    "a see-through book cover": ({"see-through": True, "bends": True}, "clear plastic bag"),
    "a toy raft": ({"floats": True, "bends": False}, "wooden block"),
}
COND_WORDS = {("waterproof", True): "be waterproof", ("bends", True): "bend", ("bends", False): "not bend",
              ("see-through", True): "be see-through", ("floats", True): "float", ("magnetic", True): "be magnetic"}
COUNT_WORDS = {"floats": "float?", "waterproof": "are waterproof?", "magnetic": "are magnetic?",
               "see-through": "are see-through?", "bends": "bend?"}
BOTH_WORDS = {"floats": "floats", "waterproof": "is waterproof", "magnetic": "is magnetic", "see-through": "is see-through",
              "bends": "bends"}
HEADERS = {"waterproof": "Waterproof?", "floats": "Floats?", "magnetic": "Magnetic?", "see-through": "See-through?",
           "bends": "Bends?"}


def test_materials_test_p():
    m = fam("materials_test_p")
    jobs, answers = Counter(), Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        first_names_the_person(qs)
        mats, props = p["materials"], p["props"]
        assert len(set(mats)) == len(mats) and len(set(props)) == len(props)
        if p["level"] == "lower":
            assert len(mats) == 4 and len(props) == 3, (s, mats, props)
        else:
            assert 5 <= len(mats) <= 6 and len(props) == 4, (s, mats, props)
        for i, mat in enumerate(mats):
            for j, pr in enumerate(props):
                truth = MATERIAL_TRUTH[mat][pr]
                assert truth is not None, (s, mat, pr)
                assert p["cells"][i][j] is truth, (s, mat, pr)
        if s <= DRAWN:
            fig = m.draw(p)
            words, tagged = texts(fig), by_gid(fig)
            plt.close(fig)
            for mat in mats:
                assert mat in words, (s, mat)
            for pr in props:
                assert HEADERS[pr] in words, (s, pr)
            for i, mat in enumerate(mats):
                for j, pr in enumerate(props):
                    assert tagged[f"cell-{i}-{j}"].get_text() == ("✓" if MATERIAL_TRUTH[mat][pr] else "✗"), (s, mat, pr)
            assert any("✓" in w and "yes" in w for w in words) and any("✗" in w and "no" in w for w in words), s
        # the job: exactly one material on the table does all it needs, and it is the one a teacher would choose
        qjob = qs[0]
        assert re.search(r"Which material (should|is best)", qjob.stem), (s, qjob.stem)
        need, sensible = JOB_TRUTH[p["job"]]
        assert p["job"] in qjob.stem, (s, qjob.stem)
        for pr, want in need.items():
            assert pr in props, (s, pr, props)
            assert COND_WORDS[(pr, want)] in qjob.stem, (s, qjob.stem)
        fits = [mat for mat in mats if all(MATERIAL_TRUTH[mat][pr] == want for pr, want in need.items())]
        assert fits == [sensible], (s, p["job"], fits)
        assert picked(qjob) == sensible
        for o in qjob.options:
            assert o in mats, (s, o)
        # a child's slip: at least one wrong option does half of what the job needs
        half = [o for o in qjob.options if o != sensible and any(MATERIAL_TRUTH[o][pr] == want for pr, want in need.items())]
        assert half, (s, qjob.options)
        jobs[p["job"]] += 1
        # how many of the materials do one thing
        qc = find(qs, r"^How many of the materials")
        pr = p["count"]
        assert qc.stem.endswith(COUNT_WORDS[pr]), (s, qc.stem)
        n = sum(1 for mat in mats if MATERIAL_TRUTH[mat][pr])
        assert 1 <= n <= len(mats) - 1, (s, pr, n)
        assert qc.answer == str(n) and f"{n} materials" in qc.accepted
        # which material does both (or is the only one to do one thing)
        qb = find(qs, r"^Which (material|is the only material)")
        both = p["pair"]
        assert all(pr in props for pr in both) and 1 <= len(both) <= 2
        for pr in both:
            assert BOTH_WORDS[pr] in qb.stem, (s, qb.stem)
        fits = [mat for mat in mats if all(MATERIAL_TRUTH[mat][pr] for pr in both)]
        assert len(fits) == 1 and picked(qb) == fits[0], (s, both, fits)
        assert set(both) != {pr for pr, want in need.items() if want}, s  # not the job asked again
        for o in qb.options:
            assert o in mats
        answers[fits[0]] += 1
    assert len(jobs) == len(JOB_TRUTH), jobs
    assert len(answers) >= 4, answers


# --- soil_drainage_p --------------------------------------------------------------------------------

SOILS = ("sandy soil", "loam soil", "clay soil")  # sand lets the most water through, clay the least
SAME = {"the amount of water poured onto each soil", "the time the water was left to drain"}
CHANGED = {"the type of soil", "the amount of water that came through", "the amount of water that stayed in the soil"}


def test_soil_drainage_p():
    m = fam("soil_drainage_p")
    kinds = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        first_names_the_person(qs)
        soils, got, poured = p["soils"], p["collected"], p["poured"]
        assert sorted(soils) == sorted(SOILS) and len(got) == 3
        through = dict(zip(soils, got))
        gap = poured * 15 // 100
        assert through["sandy soil"] - through["loam soil"] >= gap, (s, through)
        assert through["loam soil"] - through["clay soil"] >= gap, (s, through)
        assert 0 < through["clay soil"] and through["sandy soil"] < poured <= p["cap"], (s, through)
        assert all(v % p["minor"] == 0 for v in got), (s, got)
        names = list(soils) if p["named"] else [f"Soil {k}" for k in p["letters"]]
        if s <= DRAWN:
            fig = m.draw(p)
            words, tagged = texts(fig), by_gid(fig)
            plt.close(fig)
            joined = " ".join(words)
            for name in names:
                assert name in words, (s, name)
            if not p["named"]:
                assert not any(t in joined.lower() for t in ("sand", "loam", "clay")), (s, joined)
            assert f"{poured} ml" in joined and "10 minutes" in joined, (s, joined)
            for i, v in enumerate(got):
                water = tagged[f"water-{i}"]
                assert round(water.get_y() + water.get_height(), 6) == v, (s, i, v)
                assert f"tick-{i}-{v}" in tagged, (s, i, v)
                for t in range(0, p["cap"] + 1, p["label_step"]):
                    assert tagged[f"num-{i}-{t}"].get_text() == str(t), (s, i, t)
        kinds["named" if p["named"] else "lettered"] += 1
        for q in qs:
            stem = q.stem
            if (mt := re.search(r"How much water came through (.+)\?$", stem)):
                name = mt.group(1).removeprefix("the ")
                accepts(q, got[names.index(name)], "ml")
            elif (mt := re.search(r"How much more water came through the (.+) than the (.+)\?$", stem)):
                a, b = names.index(mt.group(1)), names.index(mt.group(2))
                assert got[a] > got[b]
                accepts(q, got[a] - got[b], "ml")
            elif (mt := re.search(r"How much of the water stayed in the (.+)\?$", stem)):
                accepts(q, poured - got[names.index(mt.group(1))], "ml")
            elif "let the most water through" in stem:
                assert not p["named"]
                assert picked(q) == names[got.index(max(got))]
            elif "held on to the most water" in stem:
                assert not p["named"]
                assert picked(q) == names[got.index(min(got))]
                assert names[got.index(max(got))] in q.options  # the slip: most water through
            elif (mt := re.search(r"most likely to be (sandy|loam|clay) soil", stem)):
                assert not p["named"]
                assert picked(q) == names[soils.index(f"{mt.group(1)} soil")]
            elif "keep the same" in stem:
                assert picked(q) in SAME and all(o in CHANGED for o in q.options if o != picked(q)), (s, q.options)
            else:
                pytest.fail(f"seed {s}: an unexpected question: {stem}")
    assert kinds["named"] >= 300 and kinds["lettered"] >= 200, kinds


# --- state_changes_p --------------------------------------------------------------------------------

PROCESS = {"melting": ("solid", "liquid"), "freezing": ("liquid", "solid"), "boiling": ("liquid", "gas"),
           "evaporating": ("liquid", "gas"), "condensing": ("gas", "liquid")}
HEAT = {("solid", "liquid"): "heating", ("liquid", "gas"): "heating", ("liquid", "solid"): "cooling",
        ("gas", "liquid"): "cooling"}
PICTURE = {"solid": "ice (solid)", "liquid": "water (liquid)", "gas": "steam (gas)"}


def test_state_changes_p():
    m = fam("state_changes_p")
    asked = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        first_names_the_person(qs)
        arrows = {k: tuple(v) for k, v in p["arrows"].items()}
        assert sorted(arrows) == list("ABCD")
        assert sorted(arrows.values()) == sorted(HEAT), (s, arrows)
        assert p["gas_word"] in ("boiling", "evaporating")
        if s <= DRAWN:
            fig = m.draw(p)
            words, tagged = texts(fig), by_gid(fig)
            plt.close(fig)
            joined = " ".join(words).lower()
            for bad in ("melt", "freez", "boil", "evapor", "condens"):
                assert bad not in joined, (s, bad)  # the figure never names a change
            for st, label in PICTURE.items():
                assert label in words, (s, label)
            centre = {st: tagged[f"centre-{st}"].get_xydata()[0] for st in PICTURE}
            for k, (a, b) in arrows.items():
                arrow = tagged[f"arrow-{k}"]
                start, end = arrow.xyann, arrow.xy

                def d(u, v):
                    return ((u[0] - v[0]) ** 2 + (u[1] - v[1]) ** 2) ** 0.5
                assert d(start, centre[a]) < d(start, centre[b]) and d(end, centre[b]) < d(end, centre[a]), (s, k)
                assert tagged[f"word-{k}"].get_text() == HEAT[(a, b)], (s, k)
                assert tagged[f"letter-{k}"].get_text() == k, (s, k)
            if p["level"] == "upper":
                level = tagged["thermo-level"]
                assert round(level.get_y() + level.get_height(), 6) == p["temp"], s
                assert f"thermo-tick-{p['temp']}" in tagged, s
        if p["level"] == "upper":
            assert p["temp"] % 5 == 0 and 10 <= p["temp"] <= 90, s
        else:
            assert p["temp"] is None
        for q in qs:
            stem = q.stem
            if (mt := re.search(r"Which arrow shows (?:the )?(?:water )?(melting|freezing|boiling|evaporating|condensing)", stem)):
                proc = mt.group(1)
                key = next(k for k, v in arrows.items() if v == PROCESS[proc])
                assert picked(q) == f"Arrow {key}", (s, stem, q.options)
                assert all(re.fullmatch(r"Arrow [ABCD]", o) for o in q.options)
                asked[proc] += 1
            elif (mt := re.search(r"at arrow ([ABCD]) called\?", stem)):
                pair = arrows[mt.group(1)]
                right = [o for o in q.options if PROCESS[o] == pair]
                assert right == [picked(q)], (s, q.options)
                assert not {"boiling", "evaporating"} <= set(q.options)
            elif "thermometer show" in stem:
                accepts(q, p["temp"], "°C")
            elif "How many more degrees" in stem:
                assert "100 °C" in stem
                accepts(q, 100 - p["temp"], "°C")
            else:
                pytest.fail(f"seed {s}: an unexpected question: {stem}")
    assert set(asked) >= {"melting", "freezing", "condensing"} and ("boiling" in asked or "evaporating" in asked), asked


# --- weather_chart_p --------------------------------------------------------------------------------

DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
WEATHER = ("sunny", "cloudy", "rainy", "windy")
# A school day's temperature at noon in each town, in °C: Musanze stands high and cool.
TOWN_TEMPS = {"Kigali": (22, 30), "Musanze": (17, 25), "Huye": (20, 28), "Rubavu": (21, 29), "Nyagatare": (24, 32)}


def test_weather_chart_p():
    m = fam("weather_chart_p")
    kinds = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        first_names_the_person(qs)
        assert p["days"] == DAYS and p["town"] in TOWN_TEMPS
        kinds[p["kind"]] += 1
        if p["kind"] == "symbols":
            w, t = p["weather"], p["temps"]
            assert len(w) == len(t) == 5 and set(w) <= set(WEATHER)
            lo, hi = TOWN_TEMPS[p["town"]]
            assert all(lo <= x <= hi for x in t), (s, p["town"], t)
            assert t.count(max(t)) == 1, (s, t)
            sunny = [x for x, k in zip(t, w) if k == "sunny"]
            rainy = [x for x, k in zip(t, w) if k == "rainy"]
            if sunny and rainy:
                assert min(sunny) > max(rainy), (s, w, t)  # a rainy day is never warmer than a sunny one
        else:
            r = p["rain"]
            assert len(r) == 5 and all(v >= 0 and v % p["step"] == 0 for v in r), (s, r)
            assert r.count(max(r)) == 1 and max(r) <= p["top"], (s, r)
        if s <= DRAWN:
            fig = m.draw(p)
            words, tagged = texts(fig), by_gid(fig)
            ax = fig.axes[0]
            lines = gridlines(ax)
            labels = [tl.get_text() for tl in ax.get_xticklabels()]
            plt.close(fig)
            if p["kind"] == "symbols":
                for i, d in enumerate(DAYS):
                    assert tagged[f"day-{i}"].get_text() == d, (s, i)
                    assert tagged[f"temp-{i}"].get_text() == f"{p['temps'][i]} °C", (s, i)
                    assert f"sym-{i}-{p['weather'][i]}" in tagged, (s, i)
                for k in set(p["weather"]):
                    assert k in words, (s, k)  # the key names every symbol drawn
            else:
                for i, v in enumerate(p["rain"]):
                    bar = tagged[f"bar-{i}"]
                    assert round(bar.get_height(), 6) == v and round(float(v), 6) in lines, (s, i, v)
                assert labels == DAYS, (s, labels)
        for q in qs:
            stem = q.stem
            if p["kind"] == "symbols":
                w, t = p["weather"], p["temps"]
                if (mt := re.search(r"On how many days (?:was it (sunny|cloudy|windy)|did it (rain))\?", stem)):
                    kind = mt.group(1) or "rainy"
                    n = w.count(kind)
                    assert n >= 1 and q.answer == str(n), (s, stem, q.answer)
                elif "the hottest" in stem:
                    assert picked(q) == DAYS[t.index(max(t))]
                elif (mt := re.search(r"How many degrees warmer was it on (\w+) than on (\w+)\?", stem)):
                    a, b = DAYS.index(mt.group(1)), DAYS.index(mt.group(2))
                    assert t[a] > t[b]
                    accepts(q, t[a] - t[b], "°C")
                elif (mt := re.search(r"What was the weather like on (\w+)\?", stem)):
                    assert picked(q) == w[DAYS.index(mt.group(1))] and set(q.options) <= set(WEATHER)
                else:
                    pytest.fail(f"seed {s}: an unexpected question: {stem}")
            else:
                r = p["rain"]
                if "had the most rain" in stem:
                    assert picked(q) == DAYS[r.index(max(r))]
                elif (mt := re.search(r"How much rain fell on (\w+) and (\w+) altogether\?", stem)):
                    accepts(q, r[DAYS.index(mt.group(1))] + r[DAYS.index(mt.group(2))], "mm")
                elif (mt := re.search(r"How much more rain fell on (\w+) than on (\w+)\?", stem)):
                    a, b = DAYS.index(mt.group(1)), DAYS.index(mt.group(2))
                    assert r[a] > r[b]
                    accepts(q, r[a] - r[b], "mm")
                elif (mt := re.search(r"How much rain fell on (\w+)\?", stem)):
                    accepts(q, r[DAYS.index(mt.group(1))], "mm")
                elif "no rain" in stem:
                    n = r.count(0)
                    assert n >= 1 and q.answer == str(n), (s, r)
                else:
                    pytest.fail(f"seed {s}: an unexpected question: {stem}")
    assert kinds["symbols"] >= 300 and kinds["rain"] >= 300, kinds


# --- plant_growth_p ---------------------------------------------------------------------------------

PHRASE = {"watered every day": "the plant watered every day", "watered once a week": "the plant watered once a week",
          "not watered": "the plant that was not watered", "with compost": "the plant with compost",
          "without compost": "the plant without compost", "soil A": "the plant in soil A", "soil B": "the plant in soil B",
          "soil C": "the plant in soil C"}
CHANGE = {"water": "how often the plant was watered", "compost": "whether compost was added to the soil",
          "soil": "the type of soil"}


def test_plant_growth_p():
    m = fam("plant_growth_p")
    conds = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        first_names_the_person(qs)
        labels, days, h = p["labels"], p["days"], p["heights"]
        conds[p["cond"]] += 1
        assert len(labels) == len(h) and 2 <= len(labels) <= 3
        assert all(len(row) == len(days) for row in h) and days == sorted(days)
        for row in h:
            assert all(isinstance(v, int) and 0 < v <= p["top"] for v in row), (s, row)
            assert all(a <= b for a, b in zip(row, row[1:])), (s, row)  # a plant never shrinks
        for j in range(1, len(days)):
            col = [row[j] for row in h]
            assert len(set(col)) == len(col), (s, j, col)  # no two plants the same height after the start
        if days[0] == 0:
            assert len({row[0] for row in h}) == 1, s  # a fair test: every plant starts the same height
        final = [row[-1] for row in h]
        ranked = sorted(final, reverse=True)
        assert all(a - b >= 2 for a, b in zip(ranked, ranked[1:])), (s, final)
        if p["cond"] == "water":
            order = [lb for lb in ("watered every day", "watered once a week", "not watered") if lb in labels]
            assert [labels[final.index(v)] for v in ranked] == order, (s, labels, final)
            dry = h[labels.index("not watered")]
            assert dry[-1] - dry[0] <= 3, (s, dry)  # without water it soon stops growing
        elif p["cond"] == "compost":
            assert labels == ["with compost", "without compost"] or labels == ["without compost", "with compost"]
            a, b = h[labels.index("with compost")], h[labels.index("without compost")]
            assert all(x > y for x, y in zip(a[1:], b[1:])), s
        else:
            assert labels == ["soil A", "soil B", "soil C"][:len(labels)]
        if s <= DRAWN:
            fig = m.draw(p)
            words, tagged = texts(fig), by_gid(fig)
            ax = fig.axes[0]
            lines = gridlines(ax)
            legend = [t.get_text() for t in ax.get_legend().get_texts()]
            plt.close(fig)
            assert sorted(legend) == sorted(labels), (s, legend)
            for k, row in enumerate(h):
                for j, v in enumerate(row):
                    assert round(float(v), 6) in lines, (s, v)
                if p["chart"] == "line":
                    line = tagged[f"plant-{k}"]
                    assert list(line.get_ydata()) == row and list(line.get_xdata()) == days, s
                else:
                    for j, v in enumerate(row):
                        assert round(tagged[f"bar-{k}-{j}"].get_height(), 6) == v, s
        for q in qs:
            stem = q.stem
            who = [lb for lb in labels if PHRASE[lb] in stem]
            if (mt := re.search(r"How tall was .+ on day (\d+)\?", stem)):
                assert len(who) == 1
                accepts(q, h[labels.index(who[0])][days.index(int(mt.group(1)))], "cm")
            elif (mt := re.search(r"How much did .+ grow from day (\d+) to day (\d+)\?", stem)):
                assert len(who) == 1
                row = h[labels.index(who[0])]
                g = row[days.index(int(mt.group(2)))] - row[days.index(int(mt.group(1)))]
                assert g > 0
                accepts(q, g, "cm")
            elif (mt := re.search(r"On day (\d+), how much taller was (the plant .+) than (the plant .+)\?", stem)):
                j = days.index(int(mt.group(1)))
                a = next(lb for lb in labels if PHRASE[lb] == mt.group(2))
                b = next(lb for lb in labels if PHRASE[lb] == mt.group(3))
                diff = h[labels.index(a)][j] - h[labels.index(b)][j]
                assert diff > 0
                accepts(q, diff, "cm")
            elif (mt := re.search(r"In which soil was the plant tallest on day (\d+)\?", stem)):
                assert p["cond"] == "soil"
                j = days.index(int(mt.group(1)))
                col = [row[j] for row in h]
                assert picked(q) == labels[col.index(max(col))].replace("soil ", "Soil ")
            elif (mt := re.search(r"On which day was .+ (\d+) cm tall\?", stem)):
                assert len(who) == 1
                row = h[labels.index(who[0])]
                v = int(mt.group(1))
                assert row.count(v) == 1, (s, row, v)
                assert picked(q) == f"Day {days[row.index(v)]}"
            elif "change in this investigation" in stem:
                assert picked(q) == CHANGE[p["cond"]]
                assert "the height of the plants" in q.options  # the slip: what was measured
            else:
                pytest.fail(f"seed {s}: an unexpected question: {stem}")
    assert all(conds[c] >= 200 for c in CHANGE), conds
