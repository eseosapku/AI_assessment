"""Answers of the Geography wave (P3m), recomputed from each figure's params over 1,000 seeds."""
import random
import re

import pytest

from figgen.families import FAMILIES

SEEDS = range(1, 1001)
MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October",
          "November", "December"]


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


# --- Task 1: the pilot families reworked ----------------------------------------------------------

def test_climate_graph():
    m = fam("climate_graph")
    for s in SEEDS:
        p, qs = run(m, s)
        rain, temp = p["rain"], p["temp"]
        assert all(r % 5 == 0 for r in rain) and all(t % 2 == 0 for t in temp)
        if p.get("place"):  # a Rwandan station keeps its two rainy seasons and its dry June to August
            dry = max(rain[5:8])
            assert dry < min(rain[2:5]) and dry < rain[10], (s, rain)
        for q in qs:
            if q.kind == "mcq" and "most rainfall" in q.stem:
                assert picked(q) == MONTHS[rain.index(max(rain))]
                assert rain.count(max(rain)) == 1
            got = re.search(r"How much rain falls in (\w+)", q.stem)
            if got:
                assert int(q.answer) == rain[MONTHS.index(got.group(1))]
            if "temperature range" in q.stem:
                assert int(q.answer) == max(temp) - min(temp)
            got = re.search(r"from (\w+) to (\w+)", q.stem)
            if got:
                a, b = MONTHS.index(got.group(1)), MONTHS.index(got.group(2))
                assert a < b and int(q.answer) == sum(rain[a:b + 1])


def test_cross_section():
    m = fam("cross_section")
    for s in SEEDS:
        p, qs = run(m, s)
        h, x, y, c = p["heights"], p["x"], p["y"], p["cuts"]
        assert all(v % 50 == 0 for v in h)
        grads = [abs(h[b] - h[a]) / (b - a) for a, b in zip(c, c[1:])]
        for q in qs:
            if "height of the land at X" in q.stem:
                assert int(q.answer) == h[x]
            if "difference in height" in q.stem:
                assert int(q.answer) == abs(h[x] - h[y])
            if q.kind == "mcq" and "steepest" in q.stem:
                assert picked(q) == f"Section {grads.index(max(grads)) + 1}"
            if "vertical exaggeration" in q.stem:
                assert p["band"] == "UP"
                assert int(q.answer) == 50000 // p["vertical"] and 50000 % p["vertical"] == 0


def test_population_pyramid():
    m = fam("population_pyramid")
    groups = m.GROUPS
    for s in SEEDS:
        p, qs = run(m, s)
        male, female = p["male"], p["female"]
        assert sum(male) + sum(female) == 100
        for q in qs:
            assert "shape" not in q.stem  # P3b: the shapes were disputed
            got = re.search(r"percentage of the population are (males|females) aged (\S+?)\?", q.stem)
            if got:
                side = male if got.group(1) == "males" else female
                assert int(q.answer) == side[groups.index(got.group(2))]
            if "aged under 20" in q.stem and "60" not in q.stem:
                assert int(q.answer) == sum(male[:2]) + sum(female[:2])
            if "aged under 20 or 60 and over" in q.stem:
                assert int(q.answer) == sum(male[:2]) + sum(female[:2]) + sum(male[6:]) + sum(female[6:])
            if "more males or more females" in q.stem:
                old_m, old_f = sum(male[6:]), sum(female[6:])
                assert old_m != old_f
                assert q.answer == ("Males" if old_m > old_f else "Females")


# --- Task 2: map skills ---------------------------------------------------------------------------

POINTS = ["north", "north-east", "east", "south-east", "south", "south-west", "west", "north-west"]


def compass(dx, dy):
    """The 8-point direction of a move east dx and north dy, and how far it lies from a sector's edge (degrees)."""
    import math
    bearing = math.degrees(math.atan2(dx, dy)) % 360
    sector = round(bearing / 45) % 8
    return POINTS[sector], abs(bearing - 45 * round(bearing / 45))


def test_grid_reference():
    m = fam("grid_reference")
    for s in SEEDS:
        p, qs = run(m, s)
        e0, n0 = p["e0"], p["n0"]
        sym = {x["name"]: x for x in p["symbols"]}
        for q in qs:
            got = re.search(r"four-figure grid reference of the square with the (.+?) in it", q.stem)
            if got:
                x = sym[got.group(1)]
                assert q.answer == f"{e0 + x['i']:02d}{n0 + x['j']:02d}"
            got = re.search(r"six-figure grid reference of the (.+?)\?", q.stem)
            if got:
                x = sym[got.group(1)]
                assert q.answer == f"{e0 + x['i']:02d}{x['a']}{n0 + x['j']:02d}{x['b']}"
                assert 1 <= x["a"] <= 9 and 1 <= x["b"] <= 9  # never on a gridline
            got = re.search(r"direction from the (.+?) to the (.+?)\?", q.stem)
            if got:
                a, b = sym[got.group(1)], sym[got.group(2)]
                dx = (b["i"] + b["a"] / 10) - (a["i"] + a["a"] / 10)
                dy = (b["j"] + b["b"] / 10) - (a["j"] + a["b"] / 10)
                way, off = compass(dx, dy)
                assert q.answer == way and off <= 12, (s, way, off)  # plainly inside its sector
            assert "eastings" not in q.stem or "first" in q.stem


def test_map_distance():
    m = fam("map_distance")
    for s in SEEDS:
        p, qs = run(m, s)
        (x1, y1), (x2, y2) = p["road"]
        km = ((x2 - x1) ** 2 + (y2 - y1) ** 2) ** 0.5  # one grid square is 1 km at 1 : 50 000
        assert abs(km - round(km)) < 1e-9
        for q in qs:
            if "road" in q.stem and "how long" in q.stem.lower():
                assert float(q.answer) == round(km)
            if "area of the forest" in q.stem:
                assert int(q.answer) == len(p["forest"])
            got = re.search(r"A line (\d+) cm long", q.stem)
            if got:
                assert float(q.answer) == int(got.group(1)) * 50000 / 100000  # cm on the map to km on the ground


def test_contour_map():
    m = fam("contour_map")
    for s in SEEDS:
        p, qs = run(m, s)
        base, step = p["base"], p["interval"]
        for q in qs:
            if "contour interval" in q.stem:
                assert int(q.answer) == step
            got = re.search(r"height of the land at point ([A-C])", q.stem)
            if got:
                k = p["points"][got.group(1)]
                assert int(q.answer) == base + k * step
            if q.kind == "mcq" and "steeper" in q.stem:
                assert picked(q) == p["steep"].capitalize() + " side"
            if "gradient" in q.stem:
                rise = abs(p["points"]["A"] - p["points"]["B"]) * step
                assert p["run"] % rise == 0 and q.answer == f"1 in {p['run'] // rise}"


# --- Task 3: weather and the globe ----------------------------------------------------------------

DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


def test_weather_station():
    m = fam("weather_station")
    for s in SEEDS:
        p, qs = run(m, s)
        rain, hi, lo = p["rain"], p["tmax"], p["tmin"]
        assert len(rain) == len(hi) == len(lo) == 7 and all(a > b for a, b in zip(hi, lo))
        spans = [a - b for a, b in zip(hi, lo)]
        for q in qs:
            if "total rainfall" in q.stem:
                assert int(q.answer) == sum(rain)
            if "mean maximum" in q.stem:
                assert sum(hi) % 7 == 0 and int(q.answer) == sum(hi) // 7
            if "greatest range" in q.stem:
                assert spans.count(max(spans)) == 1 and q.answer == DAYS[spans.index(max(spans))]


def test_wind_rose():
    m = fam("wind_rose")
    for s in SEEDS:
        p, qs = run(m, s)
        days, calm = p["days"], p["calm"]
        assert sum(days.values()) + calm == p["month"]
        for q in qs:
            if "prevailing wind" in q.stem:
                top = max(days.values())
                assert list(days.values()).count(top) == 1
                assert q.answer == max(days, key=days.get)
            got = re.search(r"blow from the (\S+?)\?", q.stem)
            if got:
                assert int(q.answer) == days[got.group(1)]
            if "calm" in q.stem:
                assert int(q.answer) == calm


def test_lat_long():
    m = fam("lat_long")
    for s in SEEDS:
        p, qs = run(m, s)
        pts = p["points"]
        assert all(v % 15 == 0 for x in pts.values() for v in x)  # every point on a gridline crossing
        for q in qs:
            got = re.search(r"latitude of point ([A-D])\?", q.stem)
            if got:
                lat = pts[got.group(1)][0]
                assert q.answer == f"{abs(lat)}°{'N' if lat > 0 else 'S'}" and lat != 0
            got = re.search(r"longitude of point ([A-D])\?", q.stem)
            if got:
                lon = pts[got.group(1)][1]
                assert q.answer == f"{abs(lon)}°{'E' if lon > 0 else 'W'}" and lon != 0
            got = re.search(r"noon at point ([A-D]).*local time at point ([A-D])", q.stem)
            if got:
                hours = 12 + (pts[got.group(2)][1] - pts[got.group(1)][1]) // 15  # east is ahead
                assert q.answer == f"{hours:02d}:00" and 0 <= hours <= 23
            got = re.search(r"difference in latitude between points ([A-D]) and ([A-D])", q.stem)
            if got:
                assert int(q.answer.rstrip("°")) == abs(pts[got.group(1)][0] - pts[got.group(2)][0])


# --- Task 4: rivers, soils, population and development --------------------------------------------

def test_hydrograph():
    m = fam("hydrograph")
    for s in SEEDS:
        p, qs = run(m, s)
        rain, flow = p["rain"], p["flow"]
        assert rain.count(max(rain)) == 1 and flow.count(max(flow)) == 1
        tr, tp = rain.index(max(rain)), flow.index(max(flow))
        assert tp > tr
        for q in qs:
            if "lag time" in q.stem:
                assert int(q.answer) == tp - tr
            if "peak discharge" in q.stem:
                assert int(q.answer) == max(flow)
            if "rise" in q.stem and "base flow" in q.stem:
                assert int(q.answer) == max(flow) - flow[0]


def test_ternary_graph():
    m = fam("ternary_graph")
    for s in SEEDS:
        p, qs = run(m, s)
        names = p["parts"]
        for k, v in p["points"].items():
            assert sum(v) == 100 and all(x % 10 == 0 and x > 0 for x in v), (s, k, v)  # on gridline crossings
        for q in qs:
            got = re.search(r"percentage of (\w+)(?: jobs)? (?:is there |are there )?at point ([A-D])", q.stem)
            if got:
                assert int(q.answer) == p["points"][got.group(2)][names.index(got.group(1))]
            got = re.search(r"Which point has the most (\w+)(?: jobs)?\?", q.stem)
            if got:
                i = names.index(got.group(1))
                values = {k: v[i] for k, v in p["points"].items()}
                top = max(values.values())
                assert list(values.values()).count(top) == 1 and picked(q) == f"Point {max(values, key=values.get)}"


def test_dtm():
    m = fam("dtm")
    for s in SEEDS:
        p, qs = run(m, s)
        br, dr = p["birth"], p["death"]  # at the stage boundaries, 0 to 5
        assert all(v % 5 == 0 for v in br + dr)
        for q in qs:
            got = re.search(r"birth rate at the end of stage (\d)", q.stem)
            if got:
                assert int(q.answer) == br[int(got.group(1))]
            got = re.search(r"death rate at the end of stage (\d)", q.stem)
            if got:
                assert int(q.answer) == dr[int(got.group(1))]
            got = re.search(r"natural increase at the end of stage (\d)", q.stem)
            if got:
                k = int(got.group(1))
                assert int(q.answer) == br[k] - dr[k]


def test_employment_structure():
    m = fam("employment_structure")
    for s in SEEDS:
        p, qs = run(m, s)
        rows = p["countries"]
        for name, v in rows.items():
            assert sum(v) == 100 and all(x % 10 == 0 and x > 0 for x in v)
        for q in qs:
            got = re.search(r"percentage of (Country [A-D])'s workers are in the (primary|secondary|tertiary)", q.stem)
            if got:
                assert int(q.answer) == rows[got.group(1)][["primary", "secondary", "tertiary"].index(got.group(2))]
            got = re.search(r"Which country has the largest (primary|secondary|tertiary) sector", q.stem)
            if got:
                i = ["primary", "secondary", "tertiary"].index(got.group(1))
                values = {k: v[i] for k, v in rows.items()}
                top = max(values.values())
                assert list(values.values()).count(top) == 1 and picked(q) == max(values, key=values.get)
