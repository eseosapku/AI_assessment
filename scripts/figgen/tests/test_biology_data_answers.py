"""Answers of the Biology investigation and data families (P3w): potometer, menstrual_cycle, antibody_response,
blood_vessels and gas_exchange, recomputed from each figure's params over 1,000 seeds.

Nothing here calls a family's own helpers to work out a key. Condition names, vessel types and gas values come from
this file's own tables; peaks are found on the curves the figure actually drew; letters are checked against the part
their leader line ends on. The biology each figure must obey is checked on what is drawn: the bubble moves toward the
shoot, more light or moving air never slows uptake, the lining thickens after menstruation and oestrogen peaks before
ovulation, the secondary response is faster and larger, the artery's wall is the thick one, and oxygen's arrow runs
from the air into the blood.
"""
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
DRAWN = 80  # the figure itself is built and read for the first seeds
STORE = Path("C:/Users/Stephen/figure-library/figures.db")
DATA = ["potometer", "menstrual_cycle", "antibody_response", "blood_vessels", "gas_exchange"]


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


def num(text):
    return Fraction(re.match(r"-?[\d.]+", text.replace("−", "-")).group())


def F(v):
    return Fraction(str(v))


def boxes(fig):
    """Each text the figure drew, with its box in its own axes' data coordinates: (text, gid, x0, y0, x1, y1, axes)."""
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
            out.append((t.get_text(), t.get_gid() or "", min(x0, x1), min(y0, y1), max(x0, x1), max(y0, y1), ax))
    return out


def gid_lines(fig):
    return {ln.get_gid(): ln for ax in fig.axes for ln in ax.lines if ln.get_gid()}


def gid_patches(fig):
    return {pa.get_gid(): pa for ax in fig.axes for pa in ax.patches if pa.get_gid()}


def gid_texts(fig):
    return {t.get_gid(): t for ax in fig.axes for t in ax.texts if t.get_gid()}


def ends_on(line, patch) -> bool:
    """Whether a leader line's last point lies inside a patch, judged in pixels as the reader sees it."""
    ax = line.axes
    end = line.get_xydata()[-1]
    return patch.contains_point(ax.transData.transform(end))


def peak(line, lo=None, hi=None):
    """The highest point of a drawn curve between two x values: (x, y)."""
    pts = [(float(x), float(y)) for x, y in line.get_xydata() if (lo is None or x >= lo - 1e-9) and (hi is None or x <= hi + 1e-9)]
    return max(pts, key=lambda t: t[1])


def at(line, x):
    """The drawn curve's value at an x it was sampled on."""
    for u, v in line.get_xydata():
        if abs(u - x) < 1e-9:
            return float(v)
    raise AssertionError(f"the curve was not drawn through x = {x}")


def first_named(q):
    return next((n for n in NAMES if q.stem.startswith(n)), None)


# --- shared: worded, linked to the right topics -------------------------------------------------------

# Topics each family must reach, by name, and topics it must not.
REACH = {
    "potometer": ["Transport in plants", "Transport of water, minerals and organic foods in plants", "Transport System in Plants"],
    "menstrual_cycle": ["Unit 15: Reproduction in human beings", "Human Reproduction"],
    "antibody_response": ["Immunity and vaccination", "Diseases and immunity", "Immune System, Vaccination and Antibiotics", "Immunity"],
    "blood_vessels": ["Transport in animals", "Unit 8: Circulatory system in humans", "The Circulatory System", "Transport in mammals"],
    "gas_exchange": ["Gaseous exchange in humans and plants", "Respiration and gas exchange", "Gas exchange and smoking",
                     "Respiration and excretion"],
}
NOT_REACH = {
    "potometer": r"animal|mammal|human|immun|reproduc|circulat",
    "menstrual_cycle": r"plant|immun|transport|gas|circulat|glucose|nervous|physiology",
    "antibody_response": r"plant|transport|reproduc|gas|circulat|classification and patterns",
    "blood_vessels": r"plant|immun|reproduc|gas exchange",
    "gas_exchange": r"in plants$|transport|immun|reproduc|cellular respiration|energy from respiration",
}


@pytest.mark.parametrize("fid", DATA)
def test_data_family_is_worded_and_linked(fid):
    m = fam(fid)
    assert m.SUBJECT == "biology" and m.NEEDS and m.CONCEPTS
    assert all(c.startswith("biology.") for c in m.CONCEPTS)
    for seed in range(1, 80):
        p, qs = run(m, seed)
        assert p["band"] in m.BANDS
        first = first_named(qs[0])
        assert first, (fid, seed, qs[0].stem)
        for q in qs:  # a figure belongs to the person in the first question, no one else
            for owner in re.findall(r"\b(" + "|".join(NAMES) + r")'s\b", q.stem):
                assert owner == first, (fid, seed, q.stem)
    if STORE.exists():
        from figgen.link import reach, topic_index
        db = sqlite3.connect(f"file:{STORE}?mode=ro", uri=True)
        db.row_factory = sqlite3.Row
        known = {r[0] for r in db.execute("SELECT id FROM concepts")}
        assert set(m.CONCEPTS) | set(getattr(m, "ALSO", ())) <= known, sorted((set(m.CONCEPTS) | set(getattr(m, "ALSO", ()))) - known)
        index = topic_index(db)
        names = {t["key"]: t["name"] for t in index}
        got = {names[k] for k in reach(index, m, samples=120)}
        for want in REACH[fid]:
            assert want in got, (fid, want, sorted(got))
        bad = sorted(n for n in got if re.search(NOT_REACH[fid], n, re.I))
        assert not bad, (fid, bad)


# --- potometer ----------------------------------------------------------------------------------------

AIR = {"still": "still air", "fan": "fan"}
LIGHT = {"dark": "dark", "dim": "dim light", "bright": "bright light"}
LEVEL = {"still": 0, "fan": 1, "dark": 0, "dim": 1, "bright": 2}
POTOMETER_PARTS = {"shoot", "capillary", "reservoir", "tap"}


def condition(row):
    return f"{AIR[row['air']]}, {LIGHT[row['light']]}"


def test_potometer():
    m = fam("potometer")
    bands = set()
    for s in SEEDS:
        p, qs = run(m, s)
        bands.add(p["band"])
        rows = p["rows"]
        pairs = [(r["air"], r["light"]) for r in rows]
        assert len(rows) == 4 and len(set(pairs)) == 4, s
        d = [F(r["dist"]) for r in rows]
        assert all((x * 2).denominator == 1 and x > 0 for x in d), (s, d)  # whole or .5 mm, so a rate per minute has one decimal
        # More light or moving air never slows the uptake (the shoot transpires faster).
        for i in range(4):
            for j in range(4):
                if i != j and LEVEL[rows[i]["air"]] <= LEVEL[rows[j]["air"]] and LEVEL[rows[i]["light"]] <= LEVEL[rows[j]["light"]]:
                    assert d[i] < d[j], (s, rows)
        ordered = sorted(d, reverse=True)
        assert ordered[0] - ordered[1] >= 2 and all(a - b >= 1 for a, b in zip(ordered, ordered[1:])), (s, d)  # no near-ties
        fast = max(range(4), key=lambda i: d[i])
        # The fastest cannot be told from biology alone: another row has more light or more air.
        assert any(LEVEL[rows[j]["air"]] > LEVEL[rows[fast]["air"]] or LEVEL[rows[j]["light"]] > LEVEL[rows[fast]["light"]]
                   for j in range(4) if j != fast), (s, rows)
        k = p["drawn"]
        assert d[k].denominator == 1 and p["start"] >= 1 and p["start"] + d[k] <= 39, (s, p["start"], d[k])
        letters = p["letters"]
        assert set(letters.values()) == POTOMETER_PARTS and set(letters) == set("ABCD"), s
        labels = [condition(r) for r in rows]
        seen = set()
        for q in qs:
            st = q.stem
            if got := re.search(r'how far did the bubble move in (\d+) minutes in the "([^"]+)" test', st):
                assert int(got.group(1)) == 5 and got.group(2) == labels[k], (s, st)
                assert num(q.answer) == d[k] and "mm" in " ".join(q.accepted), (s, st, q.answer)
                seen.add("scale")
            elif got := re.search(r'rate of water uptake in the "([^"]+)" test', st):
                i = labels.index(got.group(1))
                assert i != k, (s, st)  # its distance is printed in the table
                assert num(q.answer) == d[i] / 5 and (d[i] / 5 * 10).denominator == 1, (s, st, q.answer)
                assert "÷" in st, st  # the formula is in the stem
                seen.add("rate")
            elif "fastest" in st:
                assert q.kind == "mcq" and picked(q) == labels[fast], (s, st)
                assert sorted(q.options) == sorted(labels), (s, q.options)
                seen.add("fastest")
            elif got := re.search(r"Part ([A-D]) was cut under water", st):
                assert letters[got.group(1)] == "shoot", (s, st)
                assert "air" in picked(q) and "xylem" in picked(q), (s, picked(q))
                assert all("air" not in o or "xylem" not in o for o in wrong(q)), (s, q.options)
                seen.add("cut")
            elif "cut under water" in st and "Which letter" in st:
                assert letters[picked(q)] == "shoot" and all(letters[o] != "shoot" for o in wrong(q)), (s, st)
                seen.add("cut")
            else:
                pytest.fail(f"seed {s}: an unexpected question {st}")
        assert seen == {"scale", "rate", "fastest", "cut"}, (s, seen)
        if s <= DRAWN:
            fig = m.draw(p)
            words = [b[0] for b in boxes(fig)]
            lines, patches = gid_lines(fig), gid_patches(fig)
            # the table prints every distance but the one read off the scale
            for i, r in enumerate(rows):
                assert labels[i] in words, (s, labels[i])
            for i in range(4):
                if i != k:
                    assert f"{float(d[i]):.1f}" in words, (s, d[i], words)
            assert "?" in words, s
            # the bubble's two positions, on the scale, toward the shoot
            x0, x1 = float(lines["guide:start"].get_xdata()[0]), float(lines["guide:end"].get_xdata()[0])
            assert x0 == p["start"] and x1 - x0 == d[k], (s, x0, x1)
            shoot = patches["part:shoot"]
            sx = shoot.get_path().vertices[:, 0].mean() if hasattr(shoot.get_path(), "vertices") else None
            assert sx is not None and sx > x1 > x0, (s, sx, x1, x0)
            for v in range(0, 41, 5):
                assert str(v) in words, (s, v)
            for letter, part in letters.items():
                hits = [pa for g, pa in patches.items() if g.startswith(f"part:{part}")]
                assert hits and any(ends_on(lines[f"leader:{letter}"], pa) for pa in hits), (s, letter, part)
            plt.close(fig)
    assert bands == set(m.BANDS)


# --- menstrual_cycle ----------------------------------------------------------------------------------

def level(h, t):
    """A hormone's level from its params, worked out here: a base plus smooth raised-cosine bumps, each zero beyond
    its half-width."""
    import math
    return h["base"] + sum(height * (1 + math.cos(math.pi * (t - c) / w)) / 2 for c, height, w in h["bumps"] if abs(t - c) < w)


def summit(h):
    """The day and level of a hormone's highest point, on a twentieth-of-a-day grid."""
    t = max((k / 20 for k in range(0, 28 * 20 + 1)), key=lambda t: level(h, t))
    return t, level(h, t)


def test_menstrual_cycle():
    m = fam("menstrual_cycle")
    pairs = set()
    for s in SEEDS:
        p, qs = run(m, s)
        mens, ov = p["menstruation"], p["ovulation"]
        assert 4 <= mens <= 6 and ov in (12, 14, 16), s
        knots = p["lining"]
        days = [d for d, _ in knots]
        vals = {d: F(v) for d, v in knots}
        assert days == sorted(days) and days[0] == 0 and days[-1] == 28 and mens in vals, s
        assert all((v * 2).denominator == 1 for v in vals.values()), s  # every knot on a 0.5 mm gridline
        top = max(vals.values())
        assert vals[mens] == min(vals.values()) and vals[0] == vals[28] == top, s  # breaks down, then rebuilt
        peak_day = next(d for d in days if d >= mens and vals[d] == top)
        grow =[vals[d] for d in days if mens <= d <= peak_day]
        assert all(a < b for a, b in zip(grow, grow[1:])), (s, knots)
        assert peak_day > ov, (s, knots)  # the lining is thickest after ovulation
        pair = p["pair"]
        pairs.add(pair)
        assert (pair is None) == (p["band"] == "LS"), s
        seen = set()
        for q in qs:
            st = q.stem
            if "menstruation last" in st:
                assert q.answer == str(mens), (s, st)
                seen.add("mens")
            elif "ovulation" in st and "On which day" in st:
                assert q.answer == str(ov), (s, st)
                if pair == "LH-FSH":
                    assert "LH" in st and "peak" in st, st  # the convention is stated
                seen.add("ov")
            elif got := re.search(r"thickness of the lining of the uterus on day (\d+)", st):
                day = int(got.group(1))
                assert day in vals and day % 2 == 0 and num(q.answer) == vals[day], (s, st, q.answer)
                seen.add("thick")
            elif "after the oestrogen peak" in st:
                (ex, _), (px, _) = summit(p["hormones"]["oestrogen"]), summit(p["hormones"]["progesterone"])
                assert num(q.answer) == F(px) - F(ex) and ov - 2 <= ex < ov < px, (s, st, q.answer)
                seen.add("days")
            elif "higher is the peak of LH" in st:
                (lx, ly), (fx, fy) = summit(p["hormones"]["LH"]), summit(p["hormones"]["FSH"])
                assert lx == fx == ov and num(q.answer) == F(round(ly, 9)) - F(round(fy, 9)) > 0, (s, st, q.answer)
                seen.add("lhfsh")
            else:
                pytest.fail(f"seed {s}: an unexpected question {st}")
        want = {"mens", "ov", "thick"} | ({"days"} if pair == "oestrogen-progesterone" else {"lhfsh"} if pair == "LH-FSH" else set())
        assert seen == want, (s, seen)
        if s <= DRAWN:
            fig = m.draw(p)
            lines, patches, texts = gid_lines(fig), gid_patches(fig), gid_texts(fig)
            band = patches["menstruation"]
            assert band.get_x() == 0 and band.get_width() == mens, s
            lining = lines["lining"]
            for d, v in vals.items():
                assert at(lining, d) == pytest.approx(float(v)), (s, d)
            assert peak(lining, mens, 28)[1] == pytest.approx(float(top)), s  # no overshoot above the knots
            if pair == "LH-FSH":
                assert "ovulation" not in texts, s  # found from the LH peak, not marked
                lx, ly = peak(lines["hormone:LH"])
                fx, fy = peak(lines["hormone:FSH"])
                assert lx == ov and fx == ov and ly > fy and float(ly).is_integer() and float(fy).is_integer(), (s, lx, fx)
                early = peak(lines["hormone:FSH"], 0, 8)
                assert early[1] < fy, s
                for q in qs:
                    if "higher is the peak of LH" in q.stem:
                        assert num(q.answer) == F(ly) - F(fy), (s, q.answer)
            else:
                assert texts["ovulation"].xy[0] == ov, s
            if pair == "oestrogen-progesterone":
                ex, ey = peak(lines["hormone:oestrogen"])
                px, py = peak(lines["hormone:progesterone"])
                assert float(ex).is_integer() and float(px).is_integer(), s
                assert ov - 2 <= ex < ov and px > ov + 4, (s, ex, px, ov)  # oestrogen just before ovulation, progesterone after
                assert max(at(lines["hormone:progesterone"], d) for d in range(0, ov - 1)) <= 1.0 + 1e-9, s  # low before ovulation
                for q in qs:
                    if "after the oestrogen peak" in q.stem:
                        assert num(q.answer) == F(px) - F(ex), (s, q.answer)
            plt.close(fig)
    assert pairs == {None, "oestrogen-progesterone", "LH-FSH"}


# --- antibody_response --------------------------------------------------------------------------------

def test_antibody_response():
    m = fam("antibody_response")
    for s in SEEDS:
        p, qs = run(m, s)
        f, d2, t1, t2 = p["first"], p["second"], p["t1"], p["t2"]
        p1, k, step = F(p["p1"]), p["k"], F(p["ystep"])
        p2 = p1 * k
        assert all(v % 2 == 0 for v in (f, d2, t1, t2)), s  # every asked day on a gridline
        assert t2 < t1 and t2 <= 8 and 8 <= t1 <= 16, s  # the secondary response is faster
        assert d2 - (f + t1) >= 10, s
        assert p1 % step == 0 and k >= 3 and p2 <= F(p["top"]) - step, s  # larger, and on the grid
        early, late = p["letters"]
        assert early != late, s
        seen = set()
        for q in qs:
            st = q.stem
            if got := re.search(r"highest antibody concentration after the (first|second)", st):
                assert num(q.answer) == (p1 if got.group(1) == "first" else p2), (s, st)
                seen.add("peak")
            elif got := re.search(r"How many days after the (first|second) .* did the antibody concentration reach its peak", st):
                assert q.answer == str(t1 if got.group(1) == "first" else t2), (s, st)
                seen.add("days")
            elif "How many times" in st:
                assert q.answer == str(k), (s, st)
                seen.add("ratio")
            elif "Which arrow" in st:
                assert picked(q) == f"{late}, day {d2}", (s, st, q.options)
                assert f"{early}, day {f}" in q.options, q.options  # the plausible mistake: the first exposure
                seen.add("arrow")
            else:
                pytest.fail(f"seed {s}: an unexpected question {st}")
        assert seen == {"peak", "days", "ratio", "arrow"}, (s, seen)
        if s <= DRAWN:
            fig = m.draw(p)
            lines, texts = gid_lines(fig), gid_texts(fig)
            curve = lines["antibody"]
            x, y = peak(curve, 0, d2)
            assert x == f + t1 and y == pytest.approx(float(p1)), (s, x, y)
            x, y = peak(curve, d2, None)
            assert x == d2 + t2 and y == pytest.approx(float(p2)), (s, x, y)
            assert all(abs(v) < 1e-9 for u, v in curve.get_xydata() if u <= f + 2), s  # a lag before the primary response
            assert texts[f"arrow:{early}"].xy[0] == f and texts[f"arrow:{late}"].xy[0] == d2, s
            plt.close(fig)


# --- blood_vessels ------------------------------------------------------------------------------------

def test_blood_vessels():
    m = fam("blood_vessels")
    orders = set()
    for s in SEEDS:
        p, qs = run(m, s)
        order = p["order"]
        orders.add(tuple(order))
        assert sorted(order) == ["artery", "capillary", "vein"], s
        letter = {t: "PQR"[i] for i, t in enumerate(order)}
        wa, la, wv, lv = F(p["artery"]["wall"]), F(p["artery"]["lumen"]), F(p["vein"]["wall"]), F(p["vein"]["lumen"])
        ratio = wa / wv
        assert ratio.denominator == 1 and 2 <= ratio <= 4, (s, ratio)
        assert la < lv and all((v * 10).denominator == 1 for v in (wa, la, wv, lv)), s
        seen = set()
        for q in qs:
            st = q.stem
            if "Which letter" in st:
                assert sorted(q.options) == ["P", "Q", "R"], q.options
                if "artery" in st or "highest pressure" in st:
                    want = "artery"
                elif "valves" in st or "lowest pressure" in st:
                    want = "vein"
                elif "exchanged" in st:
                    want = "capillary"
                else:
                    pytest.fail(st)
                assert picked(q) == letter[want], (s, st)
                assert "artery" not in st or "pressure" not in st
                seen.add(want)
            elif "How many times thicker" in st:
                assert q.answer == str(ratio), (s, st)
                seen.add("ratio")
            elif got := re.search(r"outer diameter of the (artery|vein)", st):
                w, l_ = (wa, la) if got.group(1) == "artery" else (wv, lv)
                assert num(q.answer) == l_ + 2 * w and "+ 2 ×" in st, (s, st, q.answer)
                seen.add("diameter")
            else:
                pytest.fail(f"seed {s}: an unexpected question {st}")
        assert {"ratio", "diameter"} <= seen and "artery" in seen and seen & {"vein", "capillary"}, (s, seen)
        if s <= DRAWN:
            fig = m.draw(p)
            patches, texts = gid_patches(fig), gid_texts(fig)
            # the artery and vein are drawn to one scale: wall and lumen as printed
            size = {}
            for t in ("artery", "vein"):
                out, lum = patches[f"outer:{t}"], patches[f"lumen:{t}"]
                size[t] = ((out.width - lum.width) / 2, lum.width)
            assert size["artery"][0] / size["vein"][0] == pytest.approx(float(ratio)), s
            assert size["artery"][1] / size["vein"][1] == pytest.approx(float(la / lv)), s
            assert size["artery"][0] / size["artery"][1] > size["vein"][0] / size["vein"][1], s  # thick wall, narrow lumen
            words = " ".join(b[0] for b in boxes(fig))
            for v in (wa, la, wv, lv):
                assert f"{float(v):.1f} mm" in words, (s, v)
            for t in order:  # each letter sits under its own vessel
                lx = texts[f"letter:{letter[t]}"].get_position()[0]
                assert patches[f"outer:{t}"].center[0] == pytest.approx(lx), (s, t)
            plt.close(fig)
    assert len(orders) == 6


# --- gas_exchange -------------------------------------------------------------------------------------

def test_gas_exchange():
    m = fam("gas_exchange")
    tables = set()
    for s in SEEDS:
        p, qs = run(m, s)
        letters = p["letters"]
        assert set(letters.values()) == {"wall", "rbc", "oxygen", "carbon dioxide"}, s
        v = {c: {g: F(x) for g, x in col.items()} for c, col in p["values"].items()}
        tables.add(p["table"])
        if p["table"] == "percent":
            assert p["band"] != "AL"
            i, e = v["inhaled air"], v["exhaled air"]
            assert i["oxygen"] == 21 and i["carbon dioxide"] == F("0.04"), s
            assert 15 <= e["oxygen"] <= 17.5 and 3 <= e["carbon dioxide"] <= 5, s
            rq = (e["carbon dioxide"] - i["carbon dioxide"]) / (i["oxygen"] - e["oxygen"])
            assert F("0.65") <= rq <= 1, (s, rq)  # about as much carbon dioxide given out as oxygen taken in
        else:
            assert p["band"] == "AL"
            a, b = v["air in the alveolus"], v["blood arriving"]
            assert a["oxygen"] > b["oxygen"] + 5 and b["carbon dioxide"] > a["carbon dioxide"], s  # the gradients the arrows show
        seen = set()
        for q in qs:
            st = q.stem
            if got := re.search(r"Which letter shows (oxygen|carbon dioxide)", st):
                gas = got.group(1)
                assert letters[picked(q)] == gas, (s, st)
                other = "carbon dioxide" if gas == "oxygen" else "oxygen"
                assert any(letters[o] == other for o in wrong(q)), q.options  # the other arrow is offered
                seen.add("arrow")
            elif got := re.search(r"difference between the (?:percentage|partial pressure) of (oxygen|carbon dioxide)", st):
                gas = got.group(1)
                cols = list(v)
                want = abs(v[cols[0]][gas] - v[cols[1]][gas])
                assert num(q.answer) == want, (s, st, q.answer)
                seen.add("table")
            elif got := re.search(r"How does the part labelled ([A-D]) help", st):
                assert letters[got.group(1)] == "wall", (s, st)
                assert "thin" in picked(q) and "short" in picked(q), picked(q)
                seen.add("wall")
            else:
                pytest.fail(f"seed {s}: an unexpected question {st}")
        assert seen == {"arrow", "table", "wall"}, (s, seen)
        if s <= DRAWN:
            fig = m.draw(p)
            lines, patches, texts = gid_lines(fig), gid_patches(fig), gid_texts(fig)
            chord = p["chord"]  # where the alveolus meets the capillary
            o2, co2 = texts["arrow:oxygen"], texts["arrow:carbon dioxide"]
            assert o2.xyann[1] > chord > o2.xy[1], s  # from the air into the blood
            assert co2.xyann[1] < chord < co2.xy[1], s  # from the blood into the air
            for L, part in letters.items():
                if part in ("wall", "rbc"):
                    assert ends_on(lines[f"leader:{L}"], patches[f"part:{part}"]), (s, L, part)
                else:
                    arrow = texts[f"arrow:{part}"]
                    lx, ly = texts[f"letter:{L}"].get_position()
                    ax_, ay = arrow.xy
                    assert abs(lx - ax_) < 1.0 and min(arrow.xy[1], arrow.xyann[1]) < ly < max(arrow.xy[1], arrow.xyann[1]), (s, L)
            words = " ".join(b[0] for b in boxes(fig))
            for col in p["values"].values():
                for x in col.values():
                    assert str(x) in words, (s, x)
            plt.close(fig)
    assert tables == {"percent", "pressure"}
