"""Answers of the P6 geography families (human geography: forests, farming, fishing, mining, energy, settlement,
transport, trade, tourism, conservation, climate change, photographs, fieldwork, hazards), recomputed independently
over 1,000 seeds from each figure's params, the drawing read back where a key depends on it, and the thin topics each
family was written for checked by name.

Nothing here calls a family's own helpers to work out a key.
"""
import math
import random
import re
import sqlite3
import sys
from collections import Counter, defaultdict
from fractions import Fraction
from pathlib import Path

import matplotlib.pyplot as plt
import pytest
from matplotlib.text import Text

from figgen.core import NAMES
from figgen.families import FAMILIES

SEEDS = range(1, 1001)
DRAWN = range(1, 31)
STORE = Path("C:/Users/Stephen/figure-library/figures.db")
OURS = ["forest_cover", "soil_conservation", "energy_mix", "fish_catch", "farm_production", "tourism_data",
        "trade_balance", "waste_recycling", "water_resources", "hazard_events", "hiv_impact", "climate_change",
        "mining_methods", "settlement_pattern", "transport_network", "photo_sketch", "industry_location",
        "fieldwork_data"]


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


def only(q, key):
    """An MCQ whose key is `key` and whose other options are all different from it (exactly one option is right)."""
    assert q.kind == "mcq", q.stem
    assert picked(q) == key, (q.stem, q.options, key)
    assert q.options.count(key) == 1 and len(set(q.options)) == len(q.options) >= 3, q.options


def number(q, value, *forms):
    assert q.kind == "short", q.stem
    assert q.answer == str(value), (q.stem, q.answer, value)
    for f in forms:
        assert f in q.accepted, (q.stem, f, q.accepted)


def _central(options):
    toks = [Counter(re.findall(r"-?\d+|[a-zA-Z]+|\S", o)) for o in options]
    score = [sum(sum(((t - u) + (u - t)).values()) for u in toks) for t in toks]
    best = min(score)
    return score.index(best) if score.count(best) == 1 else None


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


def crosses(line, box, margin=1.0, steps=60) -> bool:
    pts = line.get_transform().transform(line.get_xydata())
    for a, b in zip(pts, pts[1:]):
        if any(inside((a[0] + (b[0] - a[0]) * k / steps, a[1] + (b[1] - a[1]) * k / steps), box, margin)
               for k in range(steps + 1)):
            return True
    return False


def words_of(fig) -> str:
    texts = [t.get_text() for ax in fig.axes for t in ax.texts]
    texts += [lab.get_text() for ax in fig.axes for lab in ax.get_xticklabels() + ax.get_yticklabels()]
    texts += [ax.get_xlabel() + " " + ax.get_ylabel() for ax in fig.axes]
    return re.sub(r"\s+", " ", " ".join(texts))


def bars(fig, series=0):
    """The heights of a chart's bars of one series, read back from the drawing, in order."""
    ax = fig.axes[0]
    got = {}
    for pa in ax.patches:
        g = pa.get_gid() or ""
        m = re.fullmatch(r"bar:(\d+):(\d+)", g)
        if m and int(m.group(1)) == series:
            got[int(m.group(2))] = pa.get_height()
    return [got[i] for i in sorted(got)]


def gridlines(fig) -> set:
    ax = fig.axes[0]
    return {round(float(ln.get_ydata()[0]), 6) for ln in ax.lines
            if (ln.get_gid() or "").startswith("grid:") and not (ln.get_gid() or "").startswith("grid:x")}


# --- forest_cover --------------------------------------------------------------------------------------------------

def test_forest_cover():
    m = fam("forest_cover")
    subs = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        subs[(p["band"], p["sub"])] += 1
        years, ask = p["years"], p["ask"]
        if p["sub"] == "trend":
            area = p["area"]
            assert all(v % 10 == 0 and 60 <= v <= 450 for v in area), area
            assert all(b - a == 5 for a, b in zip(years, years[1:]))
            a, b = ask["drop"]
            assert b == a + 1 and area[b] < area[a]
            number(qs[0], area[a] - area[b], f"{area[a] - area[b]} km²")
            assert f"from {years[a]} to {years[b]}" in qs[0].stem
            i, j = ask["run"]
            loss = Fraction(area[i] - area[j], years[j] - years[i])
            assert loss > 0 and loss.denominator == 1
            number(qs[1], int(loss))
            assert f"from {years[i]} to {years[j]}" in qs[1].stem
            k = ask["share"]
            pct = Fraction(area[k] * 100, p["land"])
            assert pct.denominator == 1
            number(qs[2], f"{int(pct)}%", str(int(pct)), f"{int(pct)}%")
            assert f"{p['land']:,} km²".replace(",", " ") in qs[2].stem and str(years[k]) in qs[2].stem
            falls = {f"{years[t]} to {years[t + 1]}": area[t] - area[t + 1] for t in range(4)}
            worst = max(falls, key=falls.get)
            assert sorted(falls.values())[-1] - sorted(falls.values())[-2] >= 20
            only(qs[3], worst)
        else:
            cut, planted = p["cut"], p["planted"]
            assert all(v % 5 == 0 for v in cut + planted)
            net = [x - c for x, c in zip(planted, cut)]
            assert 0 not in net
            k = ask["loss"]
            assert net[k] < 0
            number(qs[0], cut[k] - planted[k], f"{cut[k] - planted[k]} thousand")
            assert str(years[k]) in qs[0].stem
            losses = sorted(net)
            assert losses[1] - losses[0] >= 10
            only(qs[1], str(years[net.index(losses[0])]))
            number(qs[2], sum(planted), str(sum(planted) * 1000))
            gains = sum(1 for n in net if n > 0)
            number(qs[3], gains, f"{gains} years")
    assert set(subs) == {(b, s) for b in ("LS", "UP") for s in ("trend", "planting")}, subs


def test_forest_cover_draws_its_numbers_on_gridlines():
    m = fam("forest_cover")
    for s in DRAWN:
        p = m.sample(random.Random(s))
        fig = m.draw(p)
        words = words_of(fig)
        grid = gridlines(fig)
        if p["sub"] == "trend":
            assert bars(fig) == p["area"]
            assert f"Land area of District P: {p['land']:,} km²".replace(",", " ") in words
            assert "fall in forest area ÷ number of years" in words and "forest area ÷ land area × 100" in words
            assert set(p["area"]) <= grid
        else:
            assert bars(fig, 0) == p["cut"] and bars(fig, 1) == p["planted"]
            assert "trees planted − trees cut down" in words
            assert set(p["cut"] + p["planted"]) <= grid
        plt.close(fig)


# --- soil_conservation ---------------------------------------------------------------------------------------------

def test_soil_conservation():
    m = fam("soil_conservation")
    subs, lowest = Counter(), Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        subs[(p["band"], p["sub"])] += 1
        ask = p["ask"]
        if p["sub"] == "methods":
            names, loss = p["names"], p["loss"]
            assert names[0] == "Bare soil" and all(v % 5 == 0 for v in loss) and len(set(loss)) == len(loss)
            assert all(loss[0] > v for v in loss[1:])
            if "Crops in rows up and down the slope" in names:
                k = names.index("Crops in rows up and down the slope")
                assert all(loss[k] > v for i, v in enumerate(loss[1:], 1) if i != k)
            i, j, k = ask["more"], ask["times"], ask["cut"]
            number(qs[0], loss[0] - loss[i])
            assert names[i][1:] in qs[0].stem
            assert loss[0] % loss[j] == 0
            number(qs[1], loss[0] // loss[j], f"{loss[0] // loss[j]} times")
            cut = Fraction((loss[0] - loss[k]) * 100, loss[0])
            assert cut.denominator == 1
            number(qs[2], f"{int(cut)}%", str(int(cut)))
            assert "÷ loss from bare soil × 100" in qs[2].stem
            crops = {names[x]: loss[x] for x in range(1, len(loss))}
            best = min(crops, key=crops.get)
            assert sorted(crops.values())[1] - crops[best] >= 5
            only(qs[3], best)
            assert "Bare soil" not in qs[3].options
            lowest[best] += 1
        else:
            w, tr = p["without"], p["terraced"]
            assert w == sorted(w) and len(set(w)) == 5 and tr == sorted(tr) and len(set(tr)) == 5
            assert all(a > b for a, b in zip(w, tr)) and all(v % 5 == 0 for v in w + tr)
            sl = [5, 10, 15, 20, 25]
            x = ask["saved"]
            number(qs[0], w[x] - tr[x])
            assert f"{sl[x]}° slope" in qs[0].stem
            j = ask["times"]
            assert w[j] % tr[j] == 0
            number(qs[1], w[j] // tr[j])
            a, b = ask["steeper"]
            assert a < b
            number(qs[2], w[b] - w[a])
            assert f"on the {sl[b]}° slope than on the {sl[a]}° slope" in qs[2].stem
            assert p["limit"] not in tr
            n = sum(1 for v in tr if v > p["limit"])
            assert 0 < n < 5
            number(qs[3], n, f"{n} slopes")
    assert set(subs) == {(b, s) for b in ("LS", "UP") for s in ("methods", "slopes")}, subs
    assert len(lowest) >= 3, lowest  # the least soil is not always lost by the same method


def test_soil_conservation_draws_its_numbers_on_gridlines():
    m = fam("soil_conservation")
    for s in DRAWN:
        p = m.sample(random.Random(s))
        fig = m.draw(p)
        words = words_of(fig)
        grid = gridlines(fig)
        if p["sub"] == "methods":
            assert bars(fig) == p["loss"] and set(p["loss"]) <= grid
            assert f"{p['slope']}° slope" in words and "Reduction in soil loss" in words
        else:
            assert bars(fig, 0) == p["without"] and bars(fig, 1) == p["terraced"]
            assert set(p["without"] + p["terraced"]) <= grid
            assert all(f"{v}°" in words for v in (5, 10, 15, 20, 25))
        plt.close(fig)


# --- energy_mix ----------------------------------------------------------------------------------------------------

# How textbooks class each source of electricity (this file's own table).
RENEWS = {"Hydro-electric power": True, "Solar power": True, "Wind power": True, "Geothermal power": True,
          "Methane gas": False, "Peat": False, "Diesel": False, "Coal": False}


def test_energy_mix():
    m = fam("energy_mix")
    subs = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        subs[(p["band"], p["sub"])] += 1
        ask = p["ask"]
        if p["sub"] in ("electricity", "cooking"):
            share = {n: v for n, v in p["parts"]}
            assert sum(share.values()) == 100 and all(v % 5 == 0 and v >= 5 for v in share.values())
        if p["sub"] == "electricity":
            ren = sum(v for n, v in share.items() if RENEWS[n])
            assert 0 < ren < 100
            number(qs[0], f"{ren}%", str(ren))
            a = ask["amount"]
            amt = Fraction(share[a] * p["total"], 100)
            assert amt.denominator == 1
            number(qs[1], int(amt), f"{int(amt)} GWh")
            assert a.lower() in qs[1].stem
            g = ask["angle"]
            ang = Fraction(share[g] * 18, 5)
            assert ang.denominator == 1
            number(qs[2], f"{int(ang)}°", str(int(ang)))
            non = sorted(((v, n) for n, v in share.items() if not RENEWS[n]), reverse=True)
            assert non[0][0] - non[1][0] >= 5
            only(qs[3], non[0][1])
        elif p["sub"] == "cooking":
            wood = share.get("Firewood", 0) + share.get("Charcoal", 0)
            assert 0 < wood < 100
            number(qs[0], f"{wood}%", str(wood))
            f = ask["households"]
            homes = Fraction(share[f] * p["surveyed"], 100)
            assert homes.denominator == 1
            number(qs[1], int(homes))
            ranked = sorted(share.values(), reverse=True)
            assert ranked[0] - ranked[1] >= 5
            only(qs[2], max(share, key=share.get))
            g = ask["angle"]
            number(qs[3], f"{share[g] * 18 // 5}°")
            assert share[g] * 18 % 5 == 0
        else:
            names, before, after = p["names"], p["before"], p["after"]
            assert all(v % 20 == 0 and v > 0 for v in before + after)
            rise = {n: a - b for n, a, b in zip(names, after, before)}
            r = ask["rise"]
            assert rise[r] > 0
            number(qs[0], rise[r], f"{rise[r]} GWh")
            ranked = sorted(rise.values(), reverse=True)
            assert ranked[0] - ranked[1] >= 20
            only(qs[1], max(rise, key=rise.get))
            number(qs[2], sum(after))
            low = sorted(after)
            assert low[1] - low[0] >= 20
            only(qs[3], names[after.index(low[0])])
    assert set(subs) == {(b, s) for b in ("LS", "UP") for s in ("electricity", "cooking", "growth")}, subs


def test_energy_mix_draws_its_shares():
    m = fam("energy_mix")
    for s in DRAWN:
        p = m.sample(random.Random(s))
        fig = m.draw(p)
        words = words_of(fig)
        ax = fig.axes[0]
        if p["sub"] == "growth":
            assert bars(fig, 0) == p["before"] and bars(fig, 1) == p["after"]
            assert set(p["before"] + p["after"]) <= gridlines(fig)
        else:
            wedges = {pa.get_gid(): pa for pa in ax.patches if (pa.get_gid() or "").startswith("slice:")}
            assert len(wedges) == len(p["parts"])
            for i, (name, v) in enumerate(p["parts"]):
                w = wedges[f"slice:{i}"]
                sweep = (w.theta2 - w.theta1) % 360 or 360
                assert abs(sweep - 3.6 * v) < 1e-6, (name, sweep, v)
                assert f"{v}%" in words
                if p["sub"] == "electricity":
                    assert f"{name} ({'renewable' if RENEWS[name] else 'non-renewable'})" in words
                else:
                    assert name in words
            assert "percentage × 3.6°" in words
            if p["sub"] == "electricity":
                assert f"{p['total']:,} GWh".replace(",", " ") in words and "percentage × total ÷ 100" in words
            else:
                assert f"Households surveyed: {p['surveyed']:,}".replace(",", " ") in words
        plt.close(fig)


# --- fish_catch ----------------------------------------------------------------------------------------------------

def test_fish_catch():
    m = fam("fish_catch")
    subs = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        subs[(p["band"], p["sub"])] += 1
        if p["sub"] == "kinds":
            kinds, t = p["kinds"], p["tonnes"]
            assert all(v % 50 == 0 for v in t) and len(set(t)) == len(t)
            number(qs[0], sum(t), f"{sum(t)} tonnes")
            ranked = sorted(t, reverse=True)
            assert ranked[0] - ranked[1] >= 100
            only(qs[1], kinds[t.index(ranked[0])])
            a, b = p["ask"]["more"]
            assert t[a] > t[b]
            number(qs[2], t[a] - t[b])
            k = kinds.index(p["ask"]["share"])
            pct = Fraction(t[k] * 100, sum(t))
            assert pct.denominator == 1
            number(qs[3], f"{int(pct)}%", str(int(pct)))
            assert (kinds[k] if kinds[k] == "Nile perch" else kinds[k].lower()) in qs[3].stem
        elif p["sub"] == "trend":
            years, c, lim = p["years"], p["catch"], p["limit"]
            assert all(v % 2 == 0 for v in c + [lim]) and lim not in c
            hi = c.index(max(c))
            assert c.count(max(c)) == 1
            assert all(x < y for x, y in zip(c[:hi], c[1:hi + 1])) and all(x > y for x, y in zip(c[hi:], c[hi + 1:]))
            over = [k for k in range(8) if c[k] > lim]
            assert over == list(range(over[0], over[-1] + 1)) and over[0] > 0
            only(qs[0], str(years[over[0]]))
            number(qs[1], len(over))
            number(qs[2], c[hi] - c[-1])
            only(qs[3], str(years[hi]))
        else:
            area, stocked, harvest = p["area"], p["stocked"], p["harvest"]
            d = p["ask"]["density"]
            assert stocked[d] % area[d] == 0
            number(qs[0], stocked[d] // area[d])
            rate = [Fraction(h, a) for h, a in zip(harvest, area)]
            best = max(range(4), key=lambda i: rate[i])
            assert sorted(rate)[-1] - sorted(rate)[-2] >= Fraction(1, 2)
            assert best != harvest.index(max(harvest))
            only(qs[1], f"Pond {'ABCD'[best]}")
            number(qs[2], sum(harvest))
            y = rate[p["ask"]["yield"]]
            assert (y * 10).denominator == 1
            number(qs[3], str(y.numerator) if y.denominator == 1 else f"{float(y):.1f}")
    assert set(subs) == {(b, s) for b in ("LS", "UP") for s in ("kinds", "trend", "ponds")}, subs


def test_fish_catch_draws_what_it_asks():
    m = fam("fish_catch")
    for s in DRAWN:
        p = m.sample(random.Random(s))
        fig = m.draw(p)
        words = words_of(fig)
        if p["sub"] == "kinds":
            assert bars(fig) == p["tonnes"] and set(p["tonnes"]) <= gridlines(fig)
            assert all(k in words for k in p["kinds"])
        elif p["sub"] == "trend":
            ax = fig.axes[0]
            line = next(ln for ln in ax.lines if ln.get_gid() == "line:catch")
            assert [float(v) for v in line.get_ydata()] == p["catch"]
            assert set(p["catch"]) <= gridlines(fig)
            limit = next(ln for ln in ax.lines if ln.get_gid() == "limit")
            assert float(limit.get_ydata()[0]) == p["limit"] and f"({p['limit']} thousand tonnes)" in words
        else:
            for a, st, h in zip(p["area"], p["stocked"], p["harvest"]):
                for v in (a, st, h):
                    assert f"{v:,}".replace(",", " ") in words
            assert "fingerlings stocked ÷ pond area" in words and "fish harvested ÷ pond area" in words
        plt.close(fig)


# --- farm_production -----------------------------------------------------------------------------------------------

def one_dp(x: Fraction) -> str:
    assert (x * 10).denominator == 1, x
    return str(x.numerator) if x.denominator == 1 else f"{x.numerator / x.denominator:.1f}"


def test_farm_production():
    m = fam("farm_production")
    subs = Counter()
    small = {"Goats", "Sheep", "Pigs", "Rabbits", "Chickens"}
    for s in SEEDS:
        p, qs = run(m, s)
        subs[(p["band"], p["sub"])] += 1
        if p["sub"] == "farms":
            area = [Fraction(a) for a in p["area"]]
            harvest = [Fraction(h) for h in p["harvest"]]
            y = [h / a for h, a in zip(harvest, area)]
            k = p["ask"]["yield"]
            number(qs[0], one_dp(y[k]))
            assert f"Farm {'ABCDE'[k]}" in qs[0].stem and p["crop"] in qs[0].stem
            best = max(range(5), key=lambda i: y[i])
            assert sorted(y)[-1] > sorted(y)[-2] and best != harvest.index(max(harvest))
            only(qs[1], f"Farm {'ABCDE'[best]}")
            number(qs[2], one_dp(sum(harvest)))
            number(qs[3], one_dp(sum(area)))
        elif p["sub"] == "modernise":
            ways, y = p["ways"], [Fraction(v, 10) for v in p["yield"]]
            assert ways[0] == "Local seed, no fertiliser" and all(y[0] < v for v in y[1:])
            assert all(v % 2 == 0 for v in p["yield"])
            g, c, f = p["ask"]["gain"], p["ask"]["pct"], p["ask"]["farm"]
            number(qs[0], one_dp(y[g] - y[0]))
            assert ways[g].lower() in qs[0].stem
            pct = (y[c] - y[0]) * 100 / y[0]
            assert pct.denominator == 1
            number(qs[1], f"{int(pct)}%")
            assert ways[c].lower() in qs[1].stem
            ha = p["ask"]["hectares"]
            number(qs[2], one_dp(y[f] * ha))
            assert f"on {ha} hectares" in qs[2].stem and ways[f].lower() in qs[2].stem
        else:
            animals, n = p["animals"], p["count"]
            assert "Cattle" in animals and len(animals) >= 5 and all(v % 200 == 0 for v in n)
            ranked = sorted(n, reverse=True)
            assert ranked[0] - ranked[1] >= 200
            only(qs[0], animals[n.index(ranked[0])])
            a, b = p["ask"]["more"]
            number(qs[1], n[a] - n[b])
            assert n[a] > n[b]
            number(qs[2], sum(v for x, v in zip(animals, n) if x in small))
    assert set(subs) == {(b, s) for b in ("LS", "UP") for s in ("farms", "modernise", "livestock")}, subs


def test_farm_production_draws_what_it_asks():
    m = fam("farm_production")
    for s in DRAWN:
        p = m.sample(random.Random(s))
        fig = m.draw(p)
        words = words_of(fig)
        if p["sub"] == "farms":
            for a, h in zip(p["area"], p["harvest"]):
                assert one_dp(Fraction(a)) in words and one_dp(Fraction(h)) in words
            assert "Yield = harvest ÷ area" in words
        elif p["sub"] == "modernise":
            got = bars(fig)
            assert [round(v * 10) for v in got] == p["yield"]
            assert {round(v / 10, 6) for v in p["yield"]} <= gridlines(fig)
            assert "Harvest = yield × area" in words and "× 100" in words
        else:
            assert bars(fig) == p["count"] and set(p["count"]) <= gridlines(fig)
            assert "Small animals: goats, sheep, pigs, rabbits and chickens" in words
        plt.close(fig)


# --- tourism_data --------------------------------------------------------------------------------------------------

MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October",
               "November", "December"]


def test_tourism_data():
    m = fam("tourism_data")
    subs = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        subs[(p["band"], p["sub"])] += 1
        if p["sub"] == "months":
            v, y = p["visitors"], p["year"]
            assert all(x % 100 == 0 and x >= 300 for x in v)
            # the dry seasons are busier than the long rains
            assert min(v[5:9]) > max(v[2:5]) - 1000
            ranked = sorted(v, reverse=True)
            assert ranked[0] - ranked[1] >= 200
            only(qs[0], MONTH_NAMES[v.index(ranked[0])])
            a, b = p["ask"]["more"]
            assert v[a] > v[b]
            number(qs[1], v[a] - v[b])
            assert f"in {MONTH_NAMES[a]} {y} than in {MONTH_NAMES[b]} {y}" in qs[1].stem
            number(qs[2], v[5] + v[6] + v[7] + v[8])
            f = p["ask"]["fee"]
            number(qs[3], v[f] * p["fee"], f"US${v[f] * p['fee']}")
            assert f"in {MONTH_NAMES[f]} {y}" in qs[3].stem
        else:
            years, e = p["years"], p["earnings"]
            assert all(x % 10 == 0 for x in e)
            i, j = p["ask"]["rise"]
            number(qs[0], abs(e[j] - e[i]))
            assert ("fall" if e[j] < e[i] else "rise") in qs[0].stem
            x, z = p["ask"]["pct"]
            pct = Fraction((e[z] - e[x]) * 100, e[x])
            assert pct.denominator == 1 and pct > 0
            number(qs[1], f"{int(pct)}%")
            rises = [e[k + 1] - e[k] for k in range(7)]
            ranked = sorted(rises, reverse=True)
            assert ranked[0] - ranked[1] >= 20
            only(qs[2], str(years[rises.index(ranked[0]) + 1]))
            assert p["mark"] not in e
            first = next(k for k in range(8) if e[k] > p["mark"])
            assert first > 0
            only(qs[3], str(years[first]))
    assert set(subs) == {(b, s) for b in ("LS", "UP") for s in ("months", "earnings")}, subs


def test_tourism_data_draws_what_it_asks():
    m = fam("tourism_data")
    for s in DRAWN:
        p = m.sample(random.Random(s))
        fig = m.draw(p)
        words = words_of(fig)
        if p["sub"] == "months":
            assert bars(fig) == p["visitors"] and set(p["visitors"]) <= gridlines(fig)
            assert f"Entry fee: {p['fee']} US$ per visitor" in words
        else:
            line = next(ln for ln in fig.axes[0].lines if ln.get_gid() == "line:earnings")
            assert [float(v) for v in line.get_ydata()] == p["earnings"] and set(p["earnings"]) <= gridlines(fig)
            assert "increase ÷ earnings in the first year × 100" in words
        plt.close(fig)


# --- trade_balance -------------------------------------------------------------------------------------------------

def test_trade_balance():
    m = fam("trade_balance")
    subs = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        subs[(p["band"], p["sub"])] += 1
        if p["sub"] == "balance":
            years, ex, im = p["years"], p["exports"], p["imports"]
            assert all(v % 50 == 0 and v > 0 for v in ex + im)
            bal = [a - b for a, b in zip(ex, im)]
            k = p["ask"]["deficit"]
            assert bal[k] < 0
            number(qs[0], -bal[k])
            assert str(years[k]) in qs[0].stem
            worst = sorted(bal)
            assert worst[1] - worst[0] >= 50
            only(qs[1], str(years[bal.index(worst[0])]))
            n = sum(1 for b in bal if b > 0)
            number(qs[2], n)
            number(qs[3], sum(ex))
        else:
            share = {n: v for n, v in p["parts"]}
            assert sum(share.values()) == 100 and min(share.values()) >= 5 and "Coffee" in share and "Tea" in share
            a = p["ask"]["value"]
            val = Fraction(share[a] * p["total"], 100)
            assert val.denominator == 1
            number(qs[0], int(val))
            assert a.lower() in qs[0].stem
            number(qs[1], f"{share['Coffee'] + share['Tea']}%")
            g = p["ask"]["angle"]
            assert share[g] * 18 % 5 == 0
            number(qs[2], f"{share[g] * 18 // 5}°")
            ranked = sorted(share.values(), reverse=True)
            assert ranked[0] - ranked[1] >= 5
            only(qs[3], max(share, key=share.get))
    assert set(subs) == {(b, s) for b in ("LS", "UP") for s in ("balance", "exports")}, subs


def test_trade_balance_draws_what_it_asks():
    m = fam("trade_balance")
    for s in DRAWN:
        p = m.sample(random.Random(s))
        fig = m.draw(p)
        words = words_of(fig)
        if p["sub"] == "balance":
            assert bars(fig, 0) == p["exports"] and bars(fig, 1) == p["imports"]
            assert set(p["exports"] + p["imports"]) <= gridlines(fig)
            assert "Balance of trade = exports − imports" in words
        else:
            wedges = [pa for pa in fig.axes[0].patches if (pa.get_gid() or "").startswith("slice:")]
            assert [round(((w.theta2 - w.theta1) % 360 or 360) / 3.6, 6) for w in wedges] == [v for _, v in p["parts"]]
            assert f"{p['total']:,} million US$".replace(",", " ") in words
        plt.close(fig)


# --- waste_recycling -----------------------------------------------------------------------------------------------

RECYCLABLE = {"Plastic", "Paper and card", "Glass", "Metal"}


def test_waste_recycling():
    m = fam("waste_recycling")
    subs = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        subs[(p["band"], p["sub"])] += 1
        if p["sub"] == "waste":
            share = {n: v for n, v in p["parts"]}
            assert sum(share.values()) == 100 and min(share.values()) >= 5
            rec = {n: v for n, v in share.items() if n in RECYCLABLE}
            number(qs[0], f"{sum(rec.values())}%")
            t = p["ask"]["tonnes"]
            tonnes = Fraction(share[t] * p["total"], 100)
            assert tonnes.denominator == 1
            number(qs[1], int(tonnes))
            assert t.lower() in qs[1].stem
            g = p["ask"]["angle"]
            number(qs[2], f"{share[g] * 18 // 5}°")
            ranked = sorted(rec.values(), reverse=True)
            assert ranked[0] - ranked[1] >= 5
            only(qs[3], max(rec, key=rec.get))
            assert "Food and garden waste" not in qs[3].options
        else:
            years, col, rec = p["years"], p["collected"], p["recycled"]
            assert col == sorted(col) and all(c % 100 == 0 and r % 100 == 0 and r < c for c, r in zip(col, rec))
            rate = [Fraction(r * 100, c) for r, c in zip(rec, col)]
            assert all(x.denominator == 1 for x in rate)
            k = p["ask"]["rate"]
            number(qs[0], f"{int(rate[k])}%")
            ranked = sorted(rate, reverse=True)
            assert ranked[0] - ranked[1] >= 5
            best = rate.index(ranked[0])
            assert best != rec.index(max(rec))
            only(qs[1], str(years[best]))
            number(qs[2], rec[-1] - rec[0])
            assert rec[-1] > rec[0]
            number(qs[3], sum(col))
    assert set(subs) == {("UP", "waste"), ("UP", "rates")}, subs


def test_waste_recycling_draws_what_it_asks():
    m = fam("waste_recycling")
    for s in DRAWN:
        p = m.sample(random.Random(s))
        fig = m.draw(p)
        words = words_of(fig)
        if p["sub"] == "waste":
            for n, v in p["parts"]:
                mark = "can be recycled" if n in RECYCLABLE else "can be composted" if n.startswith("Food") else \
                    "cannot be recycled"
                assert f"{n} ({mark})" in words and f"{v}%" in words
            assert f"Total waste collected: {p['total']} tonnes" in words
        else:
            assert bars(fig, 0) == p["collected"] and bars(fig, 1) == p["recycled"]
            assert set(p["collected"] + p["recycled"]) <= gridlines(fig)
            assert "waste recycled ÷ waste collected × 100" in words
        plt.close(fig)


# --- water_resources -----------------------------------------------------------------------------------------------

def test_water_resources():
    m = fam("water_resources")
    subs = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        subs[(p["band"], p["sub"])] += 1
        if p["sub"] == "stress":
            rows = p["rows"]
            per = {c: Fraction(r["water"], r["pop"]) for c, r in rows.items()}
            assert all(v.denominator == 1 for v in per.values())
            c = p["ask"]["per"]
            number(qs[0], int(per[c]), f"{int(per[c])} m³")
            ranked = sorted(per.values(), reverse=True)
            assert ranked[0] - ranked[1] >= 100
            best = max(per, key=per.get)
            assert best != max(rows, key=lambda k: rows[k]["water"])
            only(qs[1], f"Country {best}")
            scarce = [k for k, v in per.items() if 500 <= v < 1000]
            assert len(scarce) == 1
            only(qs[2], f"Country {scarce[0]}")
            assert all(not (abs(v - t) < 50) for v in per.values() for t in (500, 1000, 1700))
            number(qs[3], sum(1 for v in per.values() if v < 1700))
        else:
            names, shares, totals = p["names"], p["shares"], p["totals"]
            assert all(sum(sh) == 100 and min(sh) >= 5 for sh in shares)
            farms = [sh[0] for sh in shares]
            assert sorted(farms)[-1] - sorted(farms)[-2] >= 10
            only(qs[0], f"Country {names[farms.index(max(farms))]}")
            h = p["ask"]["home"]
            number(qs[1], f"{shares[h][2]}%")
            a, b = p["ask"]["gap"]
            number(qs[2], shares[a][1] - shares[b][1])
            assert shares[a][1] > shares[b][1]
            ind = [Fraction(sh[1] * t, 100) for sh, t in zip(shares, totals)]
            ranked = sorted(ind, reverse=True)
            assert ranked[0] - ranked[1] >= 100
            only(qs[3], f"Country {names[ind.index(ranked[0])]}")
            # the country whose industry takes the biggest share is not the one using the most water for industry
            assert ind.index(ranked[0]) != [sh[1] for sh in shares].index(max(sh[1] for sh in shares))
    assert set(subs) == {("UP", "stress"), ("UP", "use")}, subs


def test_water_resources_prints_the_thresholds():
    m = fam("water_resources")
    for s in DRAWN:
        p = m.sample(random.Random(s))
        fig = m.draw(p)
        words = words_of(fig)
        if p["sub"] == "stress":
            for c, r in p["rows"].items():
                assert f"Country {c}" in words and f"{r['water']:,}".replace(",", " ") in words
            for t in ("below 1 700 m³", "below 1 000 m³", "below 500 m³"):
                assert t in words
        else:
            for k in range(3):
                assert bars(fig, k) == [sh[k] for sh in p["shares"]]
            for c, t in zip(p["names"], p["totals"]):
                assert f"Country {c}" in words and f"(uses {t:,} million m³)".replace(",", " ") in words
        plt.close(fig)


# --- hazard_events -------------------------------------------------------------------------------------------------

def test_hazard_events():
    m = fam("hazard_events")
    subs = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        subs[(p["band"], p["sub"])] += 1
        if p["sub"] == "types":
            kinds, v = p["kinds"], p["events"]
            y0, y1 = p["years"]
            assert y1 - y0 == 9 and all(x % 2 == 0 and x > 0 for x in v) and len(set(v)) == len(v)
            ranked = sorted(v, reverse=True)
            assert ranked[0] - ranked[1] >= 4
            only(qs[0], kinds[v.index(ranked[0])])
            number(qs[1], sum(v))
            a, b = p["ask"]["more"]
            number(qs[2], v[a] - v[b])
            assert v[a] > v[b]
            pct = Fraction(v[kinds.index("Floods")] * 100, sum(v))
            assert pct.denominator == 1
            number(qs[3], f"{int(pct)}%")
        else:
            years, f, sl = p["years"], p["floods"], p["slides"]
            both = [x + y for x, y in zip(f, sl)]
            k = p["ask"]["year"]
            number(qs[0], both[k])
            ranked = sorted(both, reverse=True)
            assert ranked[0] - ranked[1] >= 20
            only(qs[1], str(years[both.index(ranked[0])]))
            assert sum(f) > sum(sl)
            number(qs[2], sum(f) - sum(sl))
            n = sum(1 for x, y in zip(f, sl) if y > x)
            assert all(x != y for x, y in zip(f, sl)) and n > 0
            number(qs[3], n)
    assert set(subs) == {(b, s) for b in ("LS", "UP") for s in ("types", "houses")}, subs


def test_hazard_events_draws_what_it_asks():
    m = fam("hazard_events")
    for s in DRAWN:
        p = m.sample(random.Random(s))
        fig = m.draw(p)
        if p["sub"] == "types":
            assert bars(fig) == p["events"] and set(p["events"]) <= gridlines(fig)
        else:
            assert bars(fig, 0) == p["floods"] and bars(fig, 1) == p["slides"]
            assert set(p["floods"] + p["slides"]) <= gridlines(fig)
        plt.close(fig)


# --- hiv_impact ----------------------------------------------------------------------------------------------------

def test_hiv_impact():
    m = fam("hiv_impact")
    subs = Counter()
    years = [1985, 1990, 1995, 2000, 2005, 2010, 2015, 2020]
    for s in SEEDS:
        p, qs = run(m, s)
        subs[(p["band"], p["sub"])] += 1
        if p["sub"] == "life":
            lp, lq = p["p"], p["q"]
            assert all(v % 2 == 0 and 40 <= v <= 80 for v in lp + lq)
            low = lp.index(min(lp))
            assert lp.count(min(lp)) == 1 and low >= 3
            assert all(a > b for a, b in zip(lp[1:low], lp[2:low + 1])) and all(a < b for a, b in zip(lp[low:], lp[low + 1:]))
            assert all(a <= b for a, b in zip(lq, lq[1:]))
            number(qs[0], lp[1] - lp[low])
            only(qs[1], str(years[low]))
            k = p["ask"]["gap"]
            number(qs[2], abs(lq[k] - lp[k]))
            hi = "Country Q" if lq[k] > lp[k] else "Country P"
            assert f"longer was life expectancy in {hi}" in qs[2].stem
            number(qs[3], lp[-1] - lp[low])
        else:
            v = p["vals"]
            ranked = sorted(v, reverse=True)
            assert ranked[0] - ranked[1] >= 2
            groups = ["15–19", "20–24", "25–29", "30–34", "35–39", "40–44", "45–49"]
            only(qs[0], f"{groups[v.index(ranked[0])]} years")
            a, b = p["ask"]["gap"]
            number(qs[1], v[a] - v[b])
            k = p["ask"]["people"]
            people = Fraction(v[k] * p["size"], 100)
            assert people.denominator == 1
            number(qs[2], int(people))
            assert f"{p['size']:,}".replace(",", " ") in qs[2].stem and groups[k] in qs[2].stem
    assert set(subs) == {("UP", "life"), ("UP", "ages")}, subs


def test_hiv_impact_draws_what_it_asks():
    m = fam("hiv_impact")
    for s in DRAWN:
        p = m.sample(random.Random(s))
        fig = m.draw(p)
        ax = fig.axes[0]
        if p["sub"] == "life":
            got = {ln.get_gid(): [float(v) for v in ln.get_ydata()] for ln in ax.lines}
            assert got["line:Country P"] == p["p"] and got["line:Country Q"] == p["q"]
            assert set(p["p"] + p["q"]) <= gridlines(fig)
        else:
            assert bars(fig) == p["vals"] and set(p["vals"]) <= gridlines(fig)
        plt.close(fig)


# --- climate_change ------------------------------------------------------------------------------------------------

# What each arrow of the greenhouse diagram shows (this file's own table), and where it must start and end: on the
# ground (y 1.2), in the atmosphere (y 3.2 to 4.6) or in space (above 4.6).
GREENHOUSE = {"incoming": "short-wave radiation from the Sun reaching the Earth's surface",
              "reflected": "short-wave radiation reflected back to space by the atmosphere",
              "absorbed": "long-wave radiation from the Earth's surface absorbed by the greenhouse gases",
              "escaping": "long-wave radiation from the Earth's surface escaping to space",
              "returned": "long-wave radiation sent back to the Earth's surface by the greenhouse gases"}


def _where(y):
    return "ground" if y < 1.7 else "air" if 3.2 <= y <= 4.6 else "space" if y > 4.6 else "between"


ENDS = {"incoming": ("space", "ground"), "reflected": ("air", "space"), "absorbed": ("ground", "air"),
        "escaping": ("ground", "space"), "returned": ("air", "ground")}


def dist_to(pt, pts):
    best = math.inf
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        dx, dy = x1 - x0, y1 - y0
        t = 0.0 if dx == dy == 0 else max(0.0, min(1.0, ((pt[0] - x0) * dx + (pt[1] - y0) * dy) / (dx * dx + dy * dy)))
        best = min(best, math.hypot(pt[0] - x0 - t * dx, pt[1] - y0 - t * dy))
    return best


def test_climate_change():
    m = fam("climate_change")
    subs = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        subs[(p["band"], p["sub"])] += 1
        if p["sub"] == "greenhouse":
            at = {v: k for k, v in p["labels"].items()}
            assert sorted(p["labels"]) == ["P", "Q", "R", "S", "T"] and set(at) == set(GREENHOUSE)
            (x, y), z = p["ask"]["which"], p["ask"]["what"]
            assert len({x, y, z}) == 3
            only(qs[0], at[x])
            assert GREENHOUSE[x] in qs[0].stem and qs[0].options == sorted(qs[0].options)
            only(qs[1], at[y])
            assert GREENHOUSE[y] in qs[1].stem
            only(qs[2], GREENHOUSE[z][0].upper() + GREENHOUSE[z][1:])
            assert f"arrow {at[z]} " in qs[2].stem
        elif p["sub"] == "emissions":
            rows = {c: (Fraction(r["per"]), r["pop"]) for c, r in p["rows"].items()}
            total = {c: per * pop for c, (per, pop) in rows.items()}
            assert all(t.denominator == 1 for t in total.values())
            c = p["ask"]["total"]
            number(qs[0], int(total[c]))
            top = max(total, key=total.get)
            assert sorted(total.values())[-1] - sorted(total.values())[-2] >= 10
            assert top != max(rows, key=lambda k: rows[k][0])
            only(qs[1], f"Country {top}")
            a, b = p["ask"]["gap"]
            gap = rows[a][0] - rows[b][0]
            assert gap > 0
            number(qs[2], f"{float(gap):.1f}".rstrip("0").rstrip("."))
            low = sorted(r[0] for r in rows.values())
            assert low[1] - low[0] >= Fraction(1, 2)
            only(qs[3], f"Country {min(rows, key=lambda k: rows[k][0])}")
        else:
            t, mark = p["temps"], p["mark"]
            assert all(a <= b for a, b in zip(t, t[1:])) and (t[-1] - t[0]) in (6, 12, 18) and mark not in t
            number(qs[0], f"{(t[-1] - t[0]) / 10:.1f}")
            number(qs[1], f"{(t[-1] - t[0]) / 60:.1f}")
            first = next(k for k, v in enumerate(t) if v > mark)
            assert first > 0
            only(qs[2], str([1960, 1970, 1980, 1990, 2000, 2010, 2020][first]))
            assert f"{mark / 10:.1f} °C" in qs[2].stem
    assert set(subs) == {("UP", "greenhouse"), ("UP", "emissions"), ("UP", "warming")}, subs


def test_climate_change_arrows_run_where_their_letters_say():
    """Each lettered arrow starts and ends where the arrow it names must (the Sun's light reaches the ground, the heat the
    gases send back runs from the atmosphere down), is straight for short-wave and wavy for long-wave radiation, and is
    the arrow nearest its letter by a clear margin."""
    m = fam("climate_change")
    n = 0
    for s in range(1, 200):
        p = m.sample(random.Random(s))
        if p["sub"] != "greenhouse" or n >= 25:
            continue
        n += 1
        fig = m.draw(p)
        ax = fig.axes[0]
        arrows = {ln.get_gid()[6:]: ln.get_xydata() for ln in ax.lines if (ln.get_gid() or "").startswith("arrow:")}
        letters = {t.get_gid()[7:]: t.get_position() for t in ax.texts if (t.get_gid() or "").startswith("letter:")}
        assert set(arrows) == set(GREENHOUSE) and sorted(letters) == ["P", "Q", "R", "S", "T"]
        for name, pts in arrows.items():
            start, end = ENDS[name]
            assert _where(pts[0][1]) == start, (s, name, pts[0])
            assert _where(pts[-1][1]) == end, (s, name, pts[-1])
            assert (len(pts) == 2) == (name in ("incoming", "reflected")), name
        for L, name in p["labels"].items():
            d = {k: dist_to(letters[L], pts) for k, pts in arrows.items()}
            own = d.pop(name)
            assert own < 0.5 and min(d.values()) >= 2 * own, (s, L, name, own, d)
        plt.close(fig)
    assert n >= 20


def test_climate_change_draws_its_numbers():
    m = fam("climate_change")
    for s in DRAWN:
        p = m.sample(random.Random(s))
        fig = m.draw(p)
        words = words_of(fig)
        if p["sub"] == "emissions":
            for c, r in p["rows"].items():
                assert f"{float(Fraction(r['per'])):.1f}" in words
            assert "CO₂ per person (tonnes) × population (millions)" in words
        elif p["sub"] == "warming":
            line = next(ln for ln in fig.axes[0].lines if ln.get_gid() == "line:temperature")
            assert [round(float(v) * 10) for v in line.get_ydata()] == p["temps"]
            assert {round(v / 10, 6) for v in p["temps"]} <= gridlines(fig)
        else:
            assert "short-wave radiation from the Sun" in words and "long-wave (heat) radiation" in words
        plt.close(fig)


# --- mining_methods ------------------------------------------------------------------------------------------------

MINING = {"quarry": "Quarrying", "open-cast": "Open-cast mining", "underground": "Underground (shaft) mining",
          "alluvial": "Alluvial mining"}


def _filled(pa) -> bool:
    return pa.get_visible() and pa.get_fill() and pa.get_facecolor()[3] > 0


def topmost(ax, pt):
    """The filled shape a reader sees at a point: the highest drawn there."""
    hits = [(pa.get_zorder(), k, pa) for k, pa in enumerate(ax.patches)
            if _filled(pa) and pa.get_transform().contains_branch(ax.transData)
            and pa.get_path().transformed(pa.get_patch_transform()).contains_point(pt)]
    return max(hits, key=lambda h: (h[0], h[1]))[2] if hits else None


def test_mining_methods():
    m = fam("mining_methods")
    subs = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        subs[(p["band"], p["sub"])] += 1
        if p["sub"] == "methods":
            at = {v: k for k, v in p["labels"].items()}
            assert sorted(p["labels"]) == ["W", "X", "Y", "Z"] and set(at) == set(MINING) == set(p["order"])
            w, z = p["ask"]["which"], p["ask"]["what"]
            assert w != z
            only(qs[0], at[w])
            assert MINING[w].lower() in qs[0].stem and qs[0].options == sorted(qs[0].options)
            only(qs[1], MINING[z])
            assert f"letter {at[z]} " in qs[1].stem
            t = p["tunnels"]
            assert t == sorted(t) and all(d % 20 == 0 and 0 < d <= 160 for d in t)
            number(qs[2], f"{max(t)} m", f"{max(t)}")
        else:
            b, a, pr = p["before"], p["after"], p["prices"]
            assert all(v % 50 == 0 and v > 0 for v in a + b)
            y0, y1 = p["years"]
            r = p["ask"]["rise"]
            rise = [x - y for x, y in zip(a, b)]
            assert rise[r] > 0
            number(qs[0], rise[r])
            ranked = sorted(rise, reverse=True)
            assert ranked[0] - ranked[1] >= 100
            only(qs[1], ["Cassiterite (tin ore)", "Coltan", "Wolframite (tungsten ore)"][rise.index(ranked[0])])
            number(qs[2], sum(a))
            v = p["ask"]["value"]
            val = Fraction(a[v] * pr[v], 1000)
            assert (val * 10).denominator == 1
            number(qs[3], str(val.numerator) if val.denominator == 1 else f"{float(val):.1f}")
    assert set(subs) == {(b, s) for b in ("LS", "UP") for s in ("methods", "output")}, subs


def test_mining_methods_letters_end_on_their_sites_and_the_scale_reads_true():
    m = fam("mining_methods")
    n = 0
    for s in range(1, 200):
        p = m.sample(random.Random(s))
        if p["sub"] != "methods" or n >= 25:
            continue
        n += 1
        fig = m.draw(p)
        ax = fig.axes[0]
        leaders = {ln.get_gid()[7:]: ln for ln in ax.lines if (ln.get_gid() or "").startswith("leader:")}
        assert sorted(leaders) == ["W", "X", "Y", "Z"]
        for L, kind in p["labels"].items():
            xs, ys = leaders[L].get_data()
            seen = topmost(ax, (float(xs[-1]), float(ys[-1])))
            assert seen is not None and seen.get_gid() == f"part:{kind}", (s, L, kind, seen and seen.get_gid())
        # the deepest tunnel's centre lies on the scale's mark for its depth
        depths = {int(t.get_gid()[6:]): t.get_position()[1] for t in ax.texts if (t.get_gid() or "").startswith("depth:")}
        tunnels = sorted(pa.get_y() + pa.get_height() / 2 for pa in ax.patches
                         if pa.get_gid() == "part:underground" and pa.get_width() > 1)
        assert len(tunnels) == len(p["tunnels"])
        unit = (depths[40] - depths[80]) / 40
        surface = depths[40] + 40 * unit
        assert [round((surface - y) / unit) for y in sorted(tunnels, reverse=True)] == p["tunnels"]
        plt.close(fig)
    assert n >= 20


# --- settlement_pattern --------------------------------------------------------------------------------------------

SETTLE = {"nucleated": "Nucleated", "linear": "Linear", "dispersed": "Dispersed", "planned": "Planned (grouped)"}
SETTLE_ASK = {"nucleated": "grouped closely together round a crossroads", "linear": "in a line along a road",
              "dispersed": "far apart, each on its own farm", "planned": "in straight rows on a planned layout"}


def test_settlement_pattern():
    m = fam("settlement_pattern")
    subs = Counter()
    years = [1980, 1985, 1990, 1995, 2000, 2005, 2010, 2015, 2020]
    for s in SEEDS:
        p, qs = run(m, s)
        subs[(p["band"], p["sub"])] += 1
        if p["sub"] == "patterns":
            maps = p["maps"]
            at = {v: k for k, v in maps.items()}
            assert sorted(maps) == ["W", "X", "Y", "Z"] and set(at) == set(SETTLE)
            L = p["ask"]["what"]
            only(qs[0], SETTLE[maps[L]])
            pat = p["ask"]["which"]
            assert at[pat] != L
            only(qs[1], at[pat])
            assert SETTLE_ASK[pat] in qs[1].stem
            C = p["ask"]["count"]
            number(qs[2], len(p["houses"][C]))
            # each pattern drawn as its row says: the dispersed farms far apart, the nucleated houses close together
            d = p["houses"][at["dispersed"]]
            assert min(math.dist(a, b) for i, a in enumerate(d) for b in d[i + 1:]) >= 0.2 and len(d) >= 5
            nu = p["houses"][at["nucleated"]]
            cx, cy = p["roads"][at["nucleated"]]["cross"]
            assert len(nu) >= 8 and all(math.dist(h, (cx, cy)) < 0.3 for h in nu)
            pl = p["houses"][at["planned"]]
            assert len({h[0] for h in pl}) * len({h[1] for h in pl}) == len(pl)  # a full grid of rows and columns
        else:
            v = p["pop"]
            assert all(x % 5 == 0 for x in v) and all(a < b for a, b in zip(v, v[1:]))
            i, j = p["ask"]["rise"]
            number(qs[0], v[j] - v[i])
            steps = [b - a for a, b in zip(v, v[1:])]
            ranked = sorted(steps, reverse=True)
            assert ranked[0] - ranked[1] >= 10
            k = steps.index(ranked[0])
            only(qs[1], f"{years[k]} to {years[k + 1]}")
            assert v[-1] % v[0] == 0
            number(qs[2], v[-1] // v[0])
            assert p["mark"] not in v
            first = next(k for k, x in enumerate(v) if x > p["mark"])
            only(qs[3], str(years[first]))
    assert set(subs) == {(b, s) for b in ("LS", "UP") for s in ("patterns", "growth")}, subs


def test_settlement_houses_are_drawn_apart_and_off_the_roads():
    m = fam("settlement_pattern")
    n = 0
    for s in range(1, 200):
        p = m.sample(random.Random(s))
        if p["sub"] != "patterns" or n >= 25:
            continue
        n += 1
        fig = m.draw(p)
        ax = fig.axes[0]
        fig.canvas.draw()
        for L in "WXYZ":
            houses = [pa for pa in ax.patches if pa.get_gid() == f"house:{L}"]
            assert len(houses) == len(p["houses"][L]), (s, L)
            frame = next(pa for pa in ax.patches if pa.get_gid() == f"map:{L}")
            fx, fy = frame.get_x(), frame.get_y()
            boxes = [h.get_window_extent() for h in houses]
            for h in houses:
                assert fx < h.get_x() and h.get_x() + h.get_width() < fx + 3 and fy < h.get_y() < fy + 3
            for i, a in enumerate(boxes):
                for b in boxes[i + 1:]:
                    gap = max(b.x0 - a.x1, a.x0 - b.x1, b.y0 - a.y1, a.y0 - b.y1)
                    assert gap >= 4, (s, L, gap)  # every house stands clear of the next, in pixels
            for road in (ln for ln in ax.lines if ln.get_gid() == f"road:{L}"):
                for box in boxes:
                    assert not crosses(road, box, margin=-3), (s, L)
        plt.close(fig)
    assert n >= 20


# --- transport_network ---------------------------------------------------------------------------------------------

def _dijkstra(edges, km, a):
    dist = {a: 0}
    todo = {a}
    while todo:
        u = min(todo, key=dist.get)
        todo.remove(u)
        for x, y in edges:
            for s_, t_ in ((x, y), (y, x)):
                if s_ == u:
                    d = dist[u] + km[f"{x}{y}"]
                    if d < dist.get(t_, math.inf):
                        dist[t_] = d
                        todo.add(t_)
    return dist


def test_transport_network():
    m = fam("transport_network")
    subs, keys = Counter(), Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        subs[(p["band"], p["sub"])] += 1
        if p["sub"] == "network":
            edges, km = p["edges"], p["km"]
            assert len(edges) >= 4 and all(v % 5 == 0 for v in km.values())
            a, b = p["ask"]["route"]
            best = _dijkstra(edges, km, a)[b]
            # the second-best route, with any one road of the best route closed, is at least 10 km longer
            number(qs[0], f"{best} km", str(best))
            assert not any({a, b} == {x, y} for x, y in edges)
            t = p["ask"]["links"]
            number(qs[1], sum(1 for e in edges if t in e))
            if p["band"] == "UP":
                assert qs[2].answer == f"{len(edges) / 5:g}"
            else:
                number(qs[2], f"{sum(km.values())} km")
        else:
            rows, t = p["rows"], p["tonnes"]
            cost = {k: r["rate"] * r["km"] * t for k, r in rows.items()}
            number(qs[0], cost[p["ask"]["cost"]])
            ranked = sorted(cost.values())
            assert ranked[1] - ranked[0] >= ranked[0] // 20
            cheap = min(cost, key=cost.get)
            only(qs[1], cheap)
            fast = {k: c for k, c in cost.items() if rows[k]["days"] <= p["days"]}
            assert cheap not in fast and len(fast) >= 2
            pick = min(fast, key=fast.get)
            only(qs[2], pick)
            assert f"in {p['days']} days or fewer" in qs[2].stem
            keys[cheap] += 1
            keys["in time: " + pick] += 1
    assert set(subs) == {(b, s) for b in ("LS", "UP") for s in ("network", "modes")}, subs
    assert max(keys["Lake and road"], keys["Railway"]) < 0.7 * (keys["Lake and road"] + keys["Railway"]), keys


def test_transport_network_prints_every_road_beside_its_road():
    m = fam("transport_network")
    n = 0
    for s in range(1, 200):
        p = m.sample(random.Random(s))
        if p["sub"] != "network" or n >= 25:
            continue
        n += 1
        fig = m.draw(p)
        ax = fig.axes[0]
        labels = {t.get_gid()[3:]: t.get_text() for t in ax.texts if (t.get_gid() or "").startswith("km:")}
        assert labels == {k: f"{v} km" for k, v in p["km"].items()}
        roads = {ln.get_gid()[5:] for ln in ax.lines if (ln.get_gid() or "").startswith("road:")}
        assert roads == set(p["km"])
        # each length is nearer its own road than any other
        pos = p["pos"]
        for k in p["km"]:
            pt = next(t.get_position() for t in ax.texts if t.get_gid() == f"km:{k}")
            d = {j: dist_to(pt, [pos[j[0]], pos[j[1]]]) for j in p["km"]}
            own = d.pop(k)
            assert all(own < 0.8 * v for v in d.values()), (s, k, own, d)
        plt.close(fig)
    assert n >= 20


# --- photo_sketch --------------------------------------------------------------------------------------------------

PHOTO_COLS = ["Left", "Centre", "Right"]
PHOTO_ROWS = ["foreground", "middle ground", "background"]
PHOTO_SHOWN = {"lake": "A lake", "forest": "A forest", "houses": "A group of houses",
               "tea plantation": "A tea plantation", "banana plantation": "A banana plantation", "school": "A school"}
PHOTO_TYPES = {"ground": "Ground (horizontal) photograph", "oblique": "Oblique aerial photograph",
               "vertical": "Vertical aerial photograph"}
CHANGE = {"reduced to half its size": Fraction(1, 2), "reduced to two-thirds of its size": Fraction(2, 3),
          "reduced to three-quarters of its size": Fraction(3, 4), "enlarged to twice its size": Fraction(2),
          "enlarged to one and a half times its size": Fraction(3, 2)}


def test_photo_sketch():
    m = fam("photo_sketch")
    subs = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        subs[(p["band"], p["sub"])] += 1
        if p["sub"] == "sections":
            cells, feats, letters = p["cells"], p["features"], p["letters"]
            assert len({tuple(c) for c in cells}) == 5 and len(set(feats)) == 5 and sorted(letters) == list("PQRST")
            a, b, c = p["ask"]["where"], p["ask"]["which"], p["ask"]["what"]
            ca, ra = cells[a]
            only(qs[0], f"{PHOTO_COLS[ca]} {PHOTO_ROWS[ra]}")
            assert f"feature {letters[a]}?" in qs[0].stem
            cb, rb = cells[b]
            only(qs[1], letters[b])
            assert f"in the {PHOTO_COLS[cb].lower()} {PHOTO_ROWS[rb]}?" in qs[1].stem
            only(qs[2], PHOTO_SHOWN[feats[c]])
            assert f"letter {letters[c]} " in qs[2].stem
            change = next(f for t, f in CHANGE.items() if t in qs[3].stem)
            width = p["size"][0] * change
            assert width.denominator == 1
            number(qs[3], f"{int(width)} cm", str(int(width)))
        else:
            at = {kind: "PQR"[k] for k, kind in enumerate(p["order"])}
            x, y = p["ask"]["which"], p["ask"]["what"]
            only(qs[0], at[x])
            assert PHOTO_TYPES[x].lower() in qs[0].stem
            only(qs[1], PHOTO_TYPES[y])
            assert f"photograph {at[y]}?" in qs[1].stem
            only(qs[2], " and ".join(sorted((at["ground"], at["oblique"]))))
    assert set(subs) == {(b, s) for b in ("LS", "UP") for s in ("sections", "types")}, subs


def test_photo_sketch_features_and_letters_share_their_section():
    m = fam("photo_sketch")
    n = 0
    for s in range(1, 200):
        p = m.sample(random.Random(s))
        if n >= 25:
            break
        fig = m.draw(p)
        ax = fig.axes[0]
        if p["sub"] == "types":
            # the horizon is drawn in the ground and oblique photographs only
            horizons = [ln for ln in ax.lines if ln.get_gid() == "horizon"]
            xs = sorted(float(h.get_xdata()[0]) for h in horizons)
            assert len(horizons) == 2 and all(round(x / 3.8) in (p["order"].index("ground"), p["order"].index("oblique"))
                                              for x in xs)
            plt.close(fig)
            continue
        n += 1
        texts = {t.get_gid()[7:]: t.get_position() for t in ax.texts if (t.get_gid() or "").startswith("letter:")}
        for k, (cell, L) in enumerate(zip(p["cells"], p["letters"])):
            c, r = cell
            x, y = texts[L]
            assert 3 * c < x < 3 * c + 3 and 2 * r < y < 2 * r + 2, (s, L, cell, (x, y))
            pa = next(q for q in ax.patches if q.get_gid() == f"feature:{k}")
            ext = pa.get_path().transformed(pa.get_patch_transform()).get_extents()
            assert 3 * c < ext.x0 and ext.x1 < 3 * c + 3 and 2 * r < ext.y0 and ext.y1 < 2 * r + 2, (s, k, ext)
        assert f"{p['size'][0]} cm wide" in words_of(fig)
        plt.close(fig)
    assert n >= 15


# --- industry_location ---------------------------------------------------------------------------------------------

def test_industry_location():
    m = fam("industry_location")
    subs = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        subs[(p["band"], p["sub"])] += 1
        if p["sub"] == "site":
            km, letters, L = p["km"], p["letters"], p["length"]
            rr, ro = p["rates"]
            assert km == sorted(km) and 0 < km[0] and km[-1] < L and sorted(letters) == list("WXYZ")
            cost = [p["ratio"] * x * rr + (L - x) * ro for x in km]
            k = p["ask"]["cost"]
            number(qs[0], cost[k])
            assert f"site {letters[k]}," in qs[0].stem
            ranked = sorted(cost)
            assert ranked[1] - ranked[0] >= 500
            only(qs[1], letters[cost.index(ranked[0])])
            a, b = p["ask"]["more"]
            assert cost[a] > cost[b]
            number(qs[2], cost[a] - cost[b])
        else:
            names, v = p["names"], p["workers"]
            assert "Food and drink processing" in names and len(set(v)) == len(v) and all(x % 50 == 0 for x in v)
            ranked = sorted(v, reverse=True)
            assert ranked[0] - ranked[1] >= 100
            only(qs[0], names[v.index(ranked[0])])
            number(qs[1], sum(v))
            pct = Fraction(v[names.index("Food and drink processing")] * 100, sum(v))
            assert pct.denominator == 1
            number(qs[2], f"{int(pct)}%")
            a, b = p["ask"]["more"]
            number(qs[3], v[a] - v[b])
    assert set(subs) == {("LS", "site"), ("LS", "zone")}, subs


def test_industry_location_prints_what_the_rule_needs():
    m = fam("industry_location")
    for s in DRAWN:
        p = m.sample(random.Random(s))
        fig = m.draw(p)
        words = words_of(fig)
        if p["sub"] == "site":
            assert f"It needs {p['ratio']} tonnes of {p['raw']}" in words
            assert f"for 1 km: {p['rates'][0]} Frw" in words and f"for 1 km: {p['rates'][1]} Frw" in words
            ax = fig.axes[0]
            xs = {pa.get_gid()[5:]: pa.get_x() + pa.get_width() / 2 for pa in ax.patches
                  if (pa.get_gid() or "").startswith("site:")}
            order = [L for _, L in sorted(zip(p["km"], p["letters"]))]
            assert sorted(xs, key=xs.get) == order  # the sites stand along the road in the order of their distances
            for km in p["km"]:
                assert f"{km} km" in words
        else:
            assert bars(fig) == p["workers"] and set(p["workers"]) <= gridlines(fig)
        plt.close(fig)


# --- fieldwork_data ------------------------------------------------------------------------------------------------

def two_dp(x: Fraction) -> str:
    assert (x * 100).denominator == 1, x
    return str(x.numerator) if x.denominator == 1 else f"{float(x):.2f}".rstrip("0")


def test_fieldwork_data():
    m = fam("fieldwork_data")
    subs = Counter()
    kinds = ["Cars", "Motorcycles", "Minibuses", "Lorries", "Bicycles"]
    for s in SEEDS:
        p, qs = run(m, s)
        subs[(p["band"], p["sub"])] += 1
        if p["sub"] == "traffic":
            c = p["counts"]
            number(qs[0], sum(c))
            ranked = sorted(c, reverse=True)
            assert ranked[0] - ranked[1] >= 3
            only(qs[1], kinds[c.index(ranked[0])])
            h = p["ask"]["hour"]
            number(qs[2], c[h] * 4)
            assert kinds[h].lower() in qs[2].stem
            k = p["ask"]["share"]
            pct = Fraction(c[k] * 100, sum(c))
            assert pct.denominator == 1
            number(qs[3], f"{int(pct)}%")
        else:
            d, w, t = p["depths"], p["width"], p["times"]
            mean = Fraction(sum(d), 50)
            area = w * mean
            vel = Fraction(10) / Fraction(sum(t), 3)
            number(qs[0], two_dp(mean))
            number(qs[1], two_dp(area))
            number(qs[2], two_dp(vel))
            number(qs[3], two_dp(area * vel))
    assert set(subs) == {("UP", "traffic"), ("UP", "river")}, subs


def test_fieldwork_tallies_and_depths_are_drawn_as_counted():
    m = fam("fieldwork_data")
    for s in range(1, 41):
        p = m.sample(random.Random(s))
        fig = m.draw(p)
        ax = fig.axes[0]
        words = words_of(fig)
        if p["sub"] == "traffic":
            for k, n in enumerate(p["counts"]):
                strokes = [ln for ln in ax.lines if ln.get_gid() == f"tally:{k}"]
                assert len(strokes) == n, (s, k, len(strokes), n)  # each upright and each cross stroke stands for one
                across = sum(1 for ln in strokes if ln.get_xdata()[0] != ln.get_xdata()[1])
                assert across == n // 5
        else:
            assert f"Width of the river: {p['width']} m" in words
            for v in p["depths"]:
                assert f"{v / 10:.1f} m" in words
            for t in p["times"]:
                assert str(t) in words
            gauges = sorted((ln for ln in ax.lines if (ln.get_gid() or "").startswith("gauge:")),
                            key=lambda ln: ln.get_xdata()[0])
            lengths = [abs(ln.get_ydata()[1] - ln.get_ydata()[0]) for ln in gauges]
            unit = lengths[0] / p["depths"][0]
            assert [round(x / unit) for x in lengths] == p["depths"]  # every gauge drawn to its depth
        plt.close(fig)


# --- shared checks -------------------------------------------------------------------------------------------------

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


@pytest.mark.parametrize("fid", OURS)
def test_most_figures_have_a_wording_of_their_own(fid):
    m = fam(fid)
    stems = []
    for seed in range(1, 31):
        rng = random.Random(seed)
        stems.append({q.stem for q in m.questions(m.sample(rng), rng)})
    own = sum(1 for i, s in enumerate(stems) if s - set().union(*(t for j, t in enumerate(stems) if j != i)))
    assert own >= 27, f"{fid}: only {own} of 30 figures have a wording of their own"


@pytest.mark.parametrize("fid", OURS)
def test_a_figure_belongs_to_the_person_in_the_first_question(fid):
    m = fam(fid)
    for seed in range(1, 150):
        rng = random.Random(seed)
        qs = m.questions(m.sample(rng), rng)
        first = next((n for n in NAMES if qs[0].stem.startswith(n)), None)
        assert first, qs[0].stem
        for q in qs:
            for owner in re.findall(r"\b(" + "|".join(NAMES) + r")'s\b", q.stem):
                assert owner == first, (fid, seed, q.stem)
            assert q.kind == "mcq" or len(q.answer) <= 40


@pytest.mark.parametrize("fid", OURS)
def test_no_two_texts_overlap_and_no_line_runs_through_a_label(fid):
    m = fam(fid)
    for s in range(1, 41):
        fig = m.draw(m.sample(random.Random(s)))
        boxes = drawn_texts(fig)
        for i, (t, a) in enumerate(boxes):
            for u, b in boxes[i + 1:]:
                assert not (min(a.x1, b.x1) - max(a.x0, b.x0) > 1 and min(a.y1, b.y1) - max(a.y0, b.y0) > 1), \
                    (fid, s, t.get_text(), u.get_text())
        for ax in fig.axes:
            for ln in ax.lines:
                g = ln.get_gid() or ""
                if g.startswith(("grid", "leader:")) or not ln.get_visible():
                    continue
                for t, box in boxes:
                    if t.get_gid() and g.endswith(":" + t.get_gid().split(":", 1)[-1]) and g.startswith("leader:"):
                        continue
                    assert not crosses(ln, box), (fid, s, g, t.get_text())
        plt.close(fig)


@pytest.mark.parametrize("fid", OURS)
def test_declares_its_concepts_and_bands(fid):
    m = fam(fid)
    assert m.SUBJECT == "geography" and m.CONCEPTS and all(c.startswith("geography.") for c in m.CONCEPTS)
    assert m.NEEDS and re.compile(m.NEEDS)
    bands = set()
    for s in range(1, 300):
        p = m.sample(random.Random(s))
        bands.add(p["band"])
        if hasattr(m, "concepts_for"):
            assert set(m.concepts_for(p)) <= set(m.CONCEPTS), (fid, s)
    assert bands == set(m.BANDS), (fid, bands)
    if STORE.exists():
        db = sqlite3.connect(f"file:{STORE}?mode=ro", uri=True)
        known = {r[0] for r in db.execute("SELECT id FROM concepts")}
        assert set(m.CONCEPTS) <= known, sorted(set(m.CONCEPTS) - known)


# --- reach by name (read-only figure store) --------------------------------------------------------------------------

TARGETS = [
    ("forest_cover", "LS", "Forestry in Rwanda"), ("forest_cover", "LS", "Forestry in Africa"),
    ("forest_cover", "UP", "Forestry in Rwanda"), ("forest_cover", "UP", "Chapter 9: The ecosystem"),
    ("forest_cover", "LS", "Environmental Conservation in Rwanda"), ("forest_cover", "LS", "Environmental Conservation"),
    ("forest_cover", "UP", "Environmental Conservation and Tourism"), ("forest_cover", "UP", "Environmental management"),
    ("soil_conservation", "LS", "Agricultural Systems in Rwanda"), ("soil_conservation", "LS", "Agricultural Systems in Africa"),
    ("soil_conservation", "LS", "Environmental Conservation in Rwanda"),
    ("soil_conservation", "LS", "Environmental Conservation"),
    ("soil_conservation", "UP", "Environmental Conservation and Tourism"),
    ("soil_conservation", "UP", "Environmental management"),
    ("energy_mix", "LS", "Economic activities"), ("energy_mix", "LS", "Power and Energy in Rwanda"),
    ("energy_mix", "LS", "Power and Energy in Africa"), ("energy_mix", "UP", "Power and energy in Rwanda"),
    ("energy_mix", "UP", "Power and Energy Production in the World"), ("energy_mix", "UP", "Chapter 2: Fossil fuels"),
    ("energy_mix", "UP", "Global Theme 2: Reducing Carbon Emissions"),
    ("fish_catch", "LS", "Economic activities"), ("fish_catch", "LS", "Fishing and Fish Farming in Rwanda"),
    ("fish_catch", "LS", "Fishing in Africa"), ("fish_catch", "UP", "Fishing in Rwanda"),
    ("fish_catch", "UP", "Chapter 5: The resource potential of the oceans"),
    ("farm_production", "LS", "Economic activities"), ("farm_production", "LS", "Agricultural Systems in Rwanda"),
    ("farm_production", "LS", "Agricultural Systems in Africa"), ("farm_production", "UP", "Agriculture in Rwanda"),
    ("tourism_data", "LS", "Economic activities"), ("tourism_data", "LS", "Tourism in Africa"),
    ("tourism_data", "UP", "Environmental Conservation and Tourism"),
    ("trade_balance", "LS", "Transport, Communication and Trade in Africa"),
    ("trade_balance", "UP", "Transport, Communication and Trade in Rwanda"),
    ("trade_balance", "UP", "Trade and Commerce in the World"),
    ("waste_recycling", "UP", "Global Theme 3: Reduce, reuse, recycle"), ("waste_recycling", "UP", "Environmental management"),
    ("waste_recycling", "UP", "Environmental Conservation and Tourism"),
    ("water_resources", "UP", "Chapter 4: The distribution of water on Earth"),
    ("hazard_events", "LS", "Hazards"), ("hazard_events", "UP", "Environmental Conservation and Tourism"),
    ("hiv_impact", "UP", "Global Theme 1: HIV/AIDS"),
    ("climate_change", "UP", "Climate Change"), ("climate_change", "UP", "Global Theme 2: Reducing Carbon Emissions"),
    ("climate_change", "UP", "Environmental management"),
    ("mining_methods", "LS", "Mining and Quarrying in Rwanda"), ("mining_methods", "LS", "Mining in Africa"),
    ("mining_methods", "UP", "Mining in Rwanda"),
    ("settlement_pattern", "LS", "Rural and Urban Settlement in Rwanda"),
    ("settlement_pattern", "LS", "Urban Settlement in Africa"),
    ("settlement_pattern", "UP", "Rural and urban settlement in Rwanda"),
    ("transport_network", "LS", "Transport, Communication and Trade in Africa"),
    ("transport_network", "UP", "Transport, Communication and Trade in Rwanda"),
    ("transport_network", "UP", "Transport and Communication in the World"),
    ("photo_sketch", "LS", "Types of Photographs"), ("photo_sketch", "LS", "Interpretation of Photographs and Video Images"),
    ("photo_sketch", "UP", "Interpretation of Photographs and Video Images"),
    ("industry_location", "LS", "Industry in Rwanda"), ("industry_location", "LS", "Industrial Development in Africa"),
    ("industry_location", "LS", "Economic activities"),
    ("fieldwork_data", "UP", "Fieldwork techniques"),
]
NOT_REACHED = [
    ("forest_cover", "UP", "Global Theme 3: Reduce, reuse, recycle"), ("forest_cover", "UP", "Climate Change"),
    ("forest_cover", "LS", "Hazards"),
    ("soil_conservation", "LS", "Mining and Quarrying in Rwanda"), ("soil_conservation", "LS", "Forestry in Rwanda"),
    ("soil_conservation", "UP", "Global Theme 3: Reduce, reuse, recycle"),
    ("energy_mix", "LS", "Industry in Rwanda"), ("energy_mix", "LS", "Mining and Quarrying in Rwanda"),
    ("fish_catch", "LS", "General organisation of hydrography"), ("fish_catch", "LS", "Drainage in Africa"),
    ("tourism_data", "LS", "Drainage in Africa"), ("tourism_data", "UP", "Formation of relief features in Rwanda"),
    ("trade_balance", "UP", "Transport and Communication in the World"), ("trade_balance", "UP", "Regional geography"),
    ("waste_recycling", "UP", "Chapter 9: The ecosystem"), ("waste_recycling", "UP", "Fieldwork techniques"),
    ("settlement_pattern", "LS", "Types of Photographs"),
    ("transport_network", "UP", "Trade and Commerce in the World"),
    ("fieldwork_data", "UP", "Introduction"), ("fieldwork_data", "UP", "Exam-Style Questions"),
    ("photo_sketch", "UP", "Exam-Style Questions"), ("photo_sketch", "UP", "Map reading"),
    ("hazard_events", "UP", "Introduction"), ("waste_recycling", "UP", "Global Theme 2: Reducing Carbon Emissions"),
    ("farm_production", "LS", "Fishing and Fish Farming in Rwanda"), ("farm_production", "UP", "Fishing in Rwanda"),
    ("forest_cover", "LS", "Mining and Quarrying in Rwanda"), ("soil_conservation", "LS", "Drainage in Africa"),
    ("settlement_pattern", "UP", "Regional studies"),
]


@pytest.fixture(scope="module")
def index():
    if not STORE.exists():
        pytest.skip("no figure store")
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
    from figgen import link
    db = sqlite3.connect(f"file:{STORE}?mode=ro", uri=True)
    db.row_factory = sqlite3.Row
    return link, link.topic_index(db)


@pytest.fixture(scope="module")
def reached(index):
    link, ix = index
    names = {t["key"]: (t["band"], t["name"].strip()) for t in ix}
    cache = {}

    def get(fid):
        if fid not in cache:
            cache[fid] = Counter(names[k] for k in link.reach(ix, fam(fid), 300))
        return cache[fid]
    return get


@pytest.mark.parametrize("fid,band,topic", TARGETS)
def test_reaches_the_thin_topic_by_name(fid, band, topic, reached):
    assert reached(fid)[(band, topic)] >= 1, (fid, band, topic)


@pytest.mark.parametrize("fid,band,topic", NOT_REACHED)
def test_leaves_the_misfits_alone(fid, band, topic, reached):
    assert reached(fid)[(band, topic)] == 0, (fid, band, topic)
