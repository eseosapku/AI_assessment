"""Each family's answers, worked out a second time from the numbers it drew.

A drawn figure is only worth having if its answer key is right every time; these
tests recompute every answer independently over many seeds.
"""
import math
import random
import re
from fractions import Fraction

import pytest

from figgen.families import (angles, bar_chart, box_plot, break_even, climate_graph, coordinates, cross_section,
                             food_web, line_graph, notice, number_line, pie_chart, population_pyramid, punnett,
                             scale_reading, scatter_graph, supply_demand, timeline, timetable, tree_diagram)

SEEDS = range(1, 1001)  # spec 12: every answer holds on 1,000 seeds


def run(m, seed):
    rng = random.Random(seed)
    p = m.sample(rng)
    return p, m.questions(p, rng)


def picked(q):
    return q.options[int(q.answer)]


def test_bar_chart():
    for s in SEEDS:
        p, (most, diff, total, which) = run(bar_chart, s)
        assert picked(most) == p["cats"][p["values"].index(max(p["values"]))]
        assert int(total.answer) == sum(p["values"])
        assert all(v % p["step"] == 0 for v in p["values"])  # every bar ends on a gridline
        ranked = sorted(p["values"], reverse=True)
        assert int(diff.answer) == ranked[1] - ranked[-1]
        # Which bar has this height: the height is named, and only one bar has it.
        v = int(which.stem.split(" shows ")[1].split(" ")[0])
        assert p["values"].count(v) == 1 and picked(which) == p["cats"][p["values"].index(v)]
        assert p["band"] in ("P", "LS") and (p["step"] in (1, 2) if p["band"] == "P" else p["step"] in (2, 5))


def test_pie_chart():
    for s in SEEDS:
        p, (count, fraction, more) = run(pie_chart, s)
        assert p["band"] in ("LS", "UP") and f"Of the {p['total']} {p['unit']}" in more.stem
        assert sum(p["angles"]) == 360
        name = count.stem.split("chose ")[1].rstrip("?")
        i = p["cats"].index(name)
        assert int(count.answer) * 360 == p["angles"][i] * p["total"]
        x = more.stem.split("chose ")[1].split(" than")[0]
        y = more.stem.split("than chose ")[1].rstrip("?")
        diff = p["angles"][p["cats"].index(x)] - p["angles"][p["cats"].index(y)]
        assert int(more.answer) * 360 == diff * p["total"] and int(more.answer) > 0
        j = p["angles"].index(max(p["angles"]))
        assert Fraction(picked(fraction)) == Fraction(p["angles"][j], 360)


def test_line_graph():
    for s in SEEDS:
        p, (reading, hottest, change) = run(line_graph, s)
        t = p["temps"]
        hours = line_graph.HOURS
        at = int(reading.stem.split(" at ")[1][:2])
        assert int(reading.answer) == t[hours.index(at)]
        assert int(picked(hottest)[:2]) == hours[t.index(max(t))]
        times = [int(x[:2]) for x in change.stem.split(" at ")[1].split(",")[0].split(" and ")]
        assert int(change.answer) == abs(t[hours.index(times[1])] - t[hours.index(times[0])]) > 0
        assert all(v % 2 == 0 for v in t)  # on the 2 °C gridlines
        assert p["band"] in ("P", "LS") and all(p["place"] in q.stem for q in (reading, hottest, change))


def test_scatter_graph():
    for s in SEEDS:
        p, (trend, reading, above) = run(scatter_graph, s)
        expected = {"positive": "Positive correlation", "negative": "Negative correlation", "none": "No correlation"}
        assert picked(trend) == expected[p["trend"]]
        assert int(reading.answer) in p["ys"] and all(y % 5 == 0 for y in p["ys"])
        assert len(set(p["xs"])) == len(p["xs"])
        # Counted from the points: none sits on the threshold, so "more than" is never in doubt.
        t = int(above.stem.split("more than ")[1].rstrip("?"))
        assert t not in p["ys"] and int(above.answer) == sum(1 for y in p["ys"] if y > t) > 0


def test_box_plot():
    for s in SEEDS:
        p, (median, iqr, rng_, upper, lower) = run(box_plot, s)
        mn, q1, md, q3, mx = p["five"]
        assert mn < q1 < md < q3 < mx
        assert (int(median.answer), int(iqr.answer), int(rng_.answer)) == (md, q3 - q1, mx - mn)
        # A quarter of the data lies above the upper quartile and below the lower one.
        assert f"more than {q3}" in upper.stem and upper.answer == "25" and "25%" in upper.accepted
        assert f"less than {q1}" in lower.stem and lower.answer == "25"


def test_number_line():
    from decimal import Decimal
    for s in SEEDS:
        p, (q, along) = run(number_line, s)
        ticks = [Decimal(t) for t in p["ticks"]]
        step = ticks[1] - ticks[0]
        assert all(b - a == step for a, b in zip(ticks, ticks[1:]))  # evenly spaced
        assert Decimal(q.answer) == ticks[0] + step * p["target"]
        assert 0 < p["target"] < len(ticks) - 1  # an unlabelled tick, so it must be worked out
        assert f"from {p['ticks'][0]} to {p['ticks'][-1]}" in q.stem
        # Counting on or back from the arrow, staying on the line.
        m = re.search(r"is (\d+) marks? to the (left|right)", along.stem)
        k, sign = int(m.group(1)), (1 if m.group(2) == "right" else -1)
        assert 0 <= p["target"] + sign * k <= len(ticks) - 1
        assert Decimal(along.answer) == ticks[0] + step * (p["target"] + sign * k)
        if p["band"] == "P":  # whole numbers and tenths at Primary, never below zero
            assert all(t >= 0 for t in ticks)


def test_angles():
    for s in SEEDS:
        p, (q,) = run(angles, s)
        assert sum(p["parts"]) == p["total"]
        known = [a for i, a in enumerate(p["parts"]) if i != p["unknown"]]
        assert int(q.answer) == p["total"] - sum(known)
        assert all(f"{a}°" in q.stem for a in known)  # the stem names the angles it gives


def test_coordinates():
    for s in SEEDS:
        p, (coords, which, moved) = run(coordinates, s)
        # A point moved: the new position is recomputed from the move the stem names, on the grid.
        m = re.search(r"Point ([ABCD]) moves (.+)\. What", moved.stem)
        px, py = p["points"]["ABCD".index(m.group(1))]
        for amount, unit, way in re.findall(r"(\d+) (squares?) (left|right|up|down)", m.group(2)):
            k = int(amount)
            px, py = px + {"left": -k, "right": k}.get(way, 0), py + {"up": k, "down": -k}.get(way, 0)
            assert unit == ("square" if k == 1 else "squares")
        assert moved.answer == f"({px}, {py})" and p["lo"] <= px <= p["hi"] and p["lo"] <= py <= p["hi"]
        if p["lo"] == 0:
            assert px >= 1 and py >= 1  # stays inside the first quadrant's grid
        name = coords.stem.split("point ")[1][0]
        x, y = p["points"]["ABCD".index(name)]
        assert coords.answer == f"({x}, {y})"
        target = which.stem.split(" at ")[1].rstrip("?")
        assert f"({p['points']['ABCD'.index(picked(which))][0]}, {p['points']['ABCD'.index(picked(which))][1]})" == target
        assert len({tuple(pt) for pt in p["points"]}) == 4
        if p["band"] == "LS":
            assert p["lo"] < 0  # four quadrants at Lower Secondary


def test_tree_diagram():
    for s in SEEDS:
        p, (both, mixed) = run(tree_diagram, s)
        pa = Fraction(p["a"], p["n"])
        setup = tree_diagram.SETUPS[p["setup"]]
        named = 0 if setup["both"][0] in both.stem else 1
        assert setup["both"][named] in both.stem and setup["mixed"] in mixed.stem
        pn = pa if named == 0 else 1 - pa
        assert Fraction(both.answer) == pn * pn
        assert Fraction(picked(mixed)) == 2 * pa * (1 - pa)
        assert p["band"] in ("LS", "UP")


def test_punnett():
    for s in SEEDS:
        p, (cell, pct) = run(punnett, s)
        r, c = p["blank"]
        alleles = sorted(p["p1"][r] + p["p2"][c], key=lambda ch: (ch.islower(), ch))
        assert picked(cell) == "".join(alleles)
        rec = sum(1 for a in p["p1"] for b in p["p2"] if a.islower() and b.islower())
        assert picked(pct) == f"{rec * 25}%"


def test_food_web():
    for s in SEEDS:
        p, (producer, herbivore, chains) = run(food_web, s)
        links = [tuple(l) for l in p["links"]]
        eaters = {e for _, e in links}
        assert picked(producer) not in eaters  # a producer eats nothing
        foods = {f for f, e in links if e == picked(herbivore)}
        assert foods and all(f not in eaters for f in foods)  # eats only producers
        # Count chains by brute force: every path from a producer to an animal nothing eats.
        foods_of = {n: [e for f, e in links if f == n] for n in {x for l in links for x in l}}

        def walk(n):
            return 1 if not foods_of[n] else sum(walk(m) for m in foods_of[n])

        starts = [n for n in foods_of if n not in eaters]
        assert int(chains.answer) == sum(walk(n) for n in starts)
        for f, e in links:  # every relation comes from the real web
            assert (f, e) in food_web.WEBS[p["name"]]


def test_scale_reading():
    for s in SEEDS:
        p, (q,) = run(scale_reading, s)
        assert float(q.answer) == p["value"]
        steps = (p["value"] - p["lo"]) / p["minor"]
        assert abs(steps - round(steps)) < 1e-9  # on a marked division


def test_climate_graph():
    for s in SEEDS:
        p, (wettest, rain, trange) = run(climate_graph, s)
        assert picked(wettest) == climate_graph.FULL[p["rain"].index(max(p["rain"]))]
        month = rain.stem.split(" in ")[1].split(",")[0]
        assert int(rain.answer) == p["rain"][climate_graph.FULL.index(month)]
        assert int(trange.answer) == max(p["temp"]) - min(p["temp"])
        assert all(r % 5 == 0 for r in p["rain"]) and all(t % 2 == 0 for t in p["temp"])


def test_population_pyramid():
    for s in SEEDS:
        p, (shape, males, young) = run(population_pyramid, s)
        assert picked(shape) == population_pyramid.NAMES[p["shape"]]
        group = males.stem.split("aged ")[1].rstrip("?")
        assert int(males.answer) == p["male"][population_pyramid.GROUPS.index(group)]
        assert int(young.answer) == p["male"][0] + p["male"][1] + p["female"][0] + p["female"][1]


def test_cross_section():
    for s in SEEDS:
        p, (hx, diff, steep) = run(cross_section, s)
        h = p["heights"]
        assert int(hx.answer) == h[p["x"]] and int(diff.answer) == abs(h[p["x"]] - h[p["y"]])
        assert all(v % 50 == 0 for v in h)
        c = p["cuts"]
        grads = [abs(h[b] - h[a]) / (b - a) for a, b in zip(c, c[1:])]
        assert picked(steep) == f"Section {grads.index(max(grads)) + 1}"


def test_supply_demand():
    for s in SEEDS:
        p, (pe, qe, direction, p2) = run(supply_demand, s)
        a, b, c, d = p["a"], p["b"], p["c"], p["d"]
        assert a - b * p["qe"] == c + d * p["qe"] == p["pe"]
        if p["change"].startswith("demand"):
            assert a - b * (p["q2"] - p["shift"]) == c + d * p["q2"] == p["p2"]
        else:
            assert a - b * p["q2"] == c + d * (p["q2"] - p["shift"]) == p["p2"]
        assert (int(pe.answer), int(qe.answer), int(p2.answer)) == (p["pe"], p["qe"], p["p2"])
        assert picked(direction) == ("It rises" if p["p2"] > p["pe"] else "It falls")
        assert p["p2"] != p["pe"]


def test_break_even():
    for s in SEEDS:
        p, (fixed, be, profit) = run(break_even, s)
        assert p["fixed"] == (p["price"] - p["var"]) * p["be"]  # revenue equals total cost at break-even
        q = int(profit.stem.split("output of ")[1].split(" ")[0])
        assert int(profit.answer) == (p["price"] - p["var"]) * q - p["fixed"]
        assert int(fixed.answer) == p["fixed"] and p["fixed"] % 200 == 0
        assert int(be.answer) == p["be"]


def test_notice():
    for s in SEEDS:
        p, (start, hours, room, place) = run(notice, s)
        assert int(hours.answer) == p["end"] - p["start"]
        assert room.answer == f"Room {p['room']}" and place.answer == p["place"]
        assert start.answer.split(":")[0] == str(p["start"] % 12 or 12)


def test_timetable():
    for s in SEEDS:
        p, (arrival, where, latest, note) = run(timetable, s)
        rows = timetable.times(p)
        wb = int(where.stem.split("Bus ")[1].split(" ")[0]) - 1
        hh, mm = where.stem.split(" reach at ")[1].rstrip("?").split(":")
        assert rows[wb][p["stops"].index(where.answer)] == int(hh) * 60 + int(mm)
        assert picked(note) == timetable.NOTES[p["note"]][2]
        bus = int(arrival.stem.split("Bus ")[1].split(" ")[0]) - 1
        stop = arrival.stem.split("reach ")[1].rstrip("?")
        m = rows[bus][p["stops"].index(stop)]
        assert arrival.answer == f"{m // 60:02d}:{m % 60:02d}"
        hh, mm = latest.stem.split(" by ")[1].split(".")[0].split(":")
        deadline = int(hh) * 60 + int(mm)
        ok = [i for i, r in enumerate(rows) if r[-1] <= deadline]
        assert picked(latest) == f"Bus {max(ok) + 1}"


def test_timeline():
    for s in SEEDS:
        p, (first, gap) = run(timeline, s)
        years = {name: year for name, year in p["events"]}
        assert picked(first) == min(years, key=years.get)
        a, b = gap.stem.split('"')[1], gap.stem.split('"')[3]
        assert int(gap.answer) == years[b] - years[a] > 0
        for name, year in p["events"]:
            assert (name, year) in timeline.SETS[p["title"]]


# ---- P3a: the maths wave ------------------------------------------------------------------

from figgen.families import fraction_model, pattern_sequence, pictogram, place_value  # noqa: E402


def _num(text: str) -> int:
    return int(text.replace(",", "").replace(" ", ""))


def test_place_value():
    cols = place_value.COLUMNS
    for s in SEEDS:
        p, (shown, added, worth) = run(place_value, s)
        digits = p["digits"]
        number = int("".join(map(str, digits)))
        assert digits[0] != 0 and all(0 <= d <= 9 for d in digits)
        assert _num(picked(shown)) == number and len({_num(o) for o in shown.options}) == len(shown.options)
        m = re.search(r"adds (\d+) more counters? to the (.+?) column", added.stem)
        k, col = int(m.group(1)), cols.index(m.group(2))
        assert digits[len(digits) - 1 - col] + k <= 9  # no exchanging at this stage
        assert _num(added.answer) == number + k * 10 ** col
        assert {added.answer.replace(",", ""), added.answer} <= set(added.accepted)
        col = cols.index(re.search(r"counters in the (.+?) column", worth.stem).group(1))
        assert _num(worth.answer) == digits[len(digits) - 1 - col] * 10 ** col > 0


def test_fraction_model():
    for s in SEEDS:
        p, qs = run(fraction_model, s)
        n, k = p["n"], len(p["shaded"])
        assert 0 < k < n and len(set(p["shaded"])) == k and all(0 <= i < n for i in p["shaded"])
        shaded, more = qs[0], qs[1]
        values = [Fraction(o) for o in shaded.options]
        assert len(set(values)) == len(values)  # no two options equal: 3/4 and 6/8 never both offered
        assert values[int(shaded.answer)] == Fraction(k, n) and picked(shaded) == f"{Fraction(k, n).numerator}/{Fraction(k, n).denominator}"
        found = re.search(r"so that (\d+/\d+) of", more.stem)
        target = Fraction(found.group(1)) if found else Fraction(1)
        assert found or "so that the whole" in more.stem
        assert target * n == int(target * n) and int(more.answer) == target * n - k > 0
        if p["band"] == "P":
            assert n <= 12 and len(qs) == 2
        else:
            rest = qs[2]
            left = Fraction(n - k, n)
            if "percentage" in rest.stem:
                assert Fraction(int(rest.answer), 100) == left and f"{rest.answer}%" in rest.accepted
            else:
                assert rest.answer == f"{left.numerator}/{left.denominator}" and "simplest form" in rest.stem


def test_pattern_sequence():
    for s in SEEDS:
        p, qs = run(pattern_sequence, s)
        a, c = p["a"], p["c"]
        # The rule holds for the three patterns as drawn: count the pieces the drawing puts down.
        for n in (1, 2, 3):
            assert len(set(pattern_sequence.pieces(p, n))) == a * n + c
        for q in qs[:2]:
            n = int(re.search(r"in pattern (\d+)\?", q.stem).group(1))
            assert int(q.answer) == a * n + c
        assert int(re.search(r"in pattern (\d+)\?", qs[1].stem).group(1)) >= 10  # far enough to need the rule
        if p["band"] == "LS":
            rule = qs[2]
            assert picked(rule) == pattern_sequence.expression(a, c) and len(set(rule.options)) == len(rule.options)
        else:
            assert len(qs) == 2


def test_pictogram():
    for s in SEEDS:
        p, (one, diff, total, which) = run(pictogram, s)
        key, values, cats = p["key"], p["values"], p["cats"]
        unit = key // 2 if key % 2 == 0 else key  # half symbols only when the key halves exactly
        assert all(v % unit == 0 and 0 < v <= 8 * key for v in values) and len(set(values)) == len(values)
        cat = next(c for c in cats if f" on {c}?" in one.stem or f" by {c}?" in one.stem)
        assert int(one.answer) == values[cats.index(cat)]
        a, b = re.search(r"(?:on|by) (.+?) than (?:on|by) (.+?)\?", diff.stem).groups()
        assert int(diff.answer) == values[cats.index(a)] - values[cats.index(b)] > 0
        assert int(total.answer) == sum(values)
        v = int(re.search(r" (\d+) ", which.stem).group(1))
        assert values.count(v) == 1 and picked(which) == cats[values.index(v)]


from figgen.families import clock, ruler  # noqa: E402


def _hm(text: str) -> int:
    """Minutes past 12 for "7:25" or "7.25" on a 12-hour clock."""
    h, m = re.split(r"[:.]", text)
    return (int(h) % 12) * 60 + int(m)


def test_clock():
    for s in SEEDS:
        p, (shown, ends, until) = run(clock, s)
        h, m = p["hour"], p["minute"]
        assert 1 <= h <= 12 and m % 5 == 0 and 0 <= m < 60
        hour_angle, minute_angle = clock.hand_angles(p)
        assert minute_angle == 6 * m and hour_angle == (30 * (h % 12) + m / 2)  # the hour hand moves on through the hour
        assert picked(shown) == f"{h}:{m:02d}" and len(set(shown.options)) == len(shown.options)
        d = int(re.search(r"lasts (\d+) minutes", ends.stem).group(1))
        assert _hm(ends.answer) == (_hm(f"{h}:{m:02d}") + d) % 720
        assert all(_hm(a.replace(" ", "")) == _hm(ends.answer) for a in ends.accepted)
        target = int(re.search(r"by (\d+) o'clock", until.stem).group(1))
        assert int(until.answer) == ((target % 12) * 60 - _hm(f"{h}:{m:02d}")) % 720 > 0


def test_ruler():
    for s in SEEDS:
        p, qs = run(ruler, s)
        start, end = p["start"], p["end"]  # millimetres along the ruler
        assert 0 <= start < end <= 150 and isinstance(start, int) and isinstance(end, int)
        length = end - start
        cm = f"{length // 10}" if length % 10 == 0 else f"{length / 10:g}"
        long_, more = qs[0], qs[1]
        assert long_.answer == cm and f"{cm} cm" in long_.accepted and f"{length} mm" in long_.accepted
        k = int(re.search(r"longer than (\d+) cm", more.stem).group(1))
        diff = length - 10 * k
        assert diff > 0 and float(more.answer) * 10 == diff
        if p["band"] == "P":
            assert start % 10 == 0 and len(qs) == 2  # Primary: from a whole centimetre
        else:
            assert qs[2].answer == str(length) and f"{length} mm" in qs[2].accepted


from figgen.families import area_shapes, bearings, parallel_lines, polygon_angles  # noqa: E402

FACTS = {"corresponding": "Corresponding angles are equal", "alternate": "Alternate angles are equal",
         "co-interior": "Co-interior angles add up to 180°", "vertically opposite": "Vertically opposite angles are equal"}


def test_parallel_lines():
    # The angle in each corner where the transversal meets a line, from its slope alone.
    for s in SEEDS:
        p, (find, fact) = run(parallel_lines, s)
        t = p["theta"]
        size = {"ar": t, "al": 180 - t, "bl": t, "br": 180 - t}
        (gi, gp), (ui, up) = p["given"], p["unknown"]
        g, x = size[gp], size[up]
        assert f"{g}°" in find.stem and int(find.answer) == x
        if gi == ui:
            kind = "vertically opposite"
            assert {gp, up} in ({"ar", "bl"}, {"al", "br"})
        elif gp == up:
            kind = "corresponding"
        elif {gp, up} in ({"bl", "ar"}, {"br", "al"}) and {gi + gp, ui + up} in ({"Pbl", "Qar"}, {"Pbr", "Qal"}):
            kind = "alternate"
        else:
            kind = "co-interior"
            assert {gi + gp, ui + up} in ({"Pbl", "Qal"}, {"Pbr", "Qar"})
            assert g + x == 180
        assert picked(fact) == FACTS[kind] and 30 <= t <= 150 and abs(t - 90) >= 15


def _interior_angles(pts):
    n, out = len(pts), []
    for i in range(n):
        (ax, ay), (bx, by), (cx, cy) = pts[i - 1], pts[i], pts[(i + 1) % n]
        a1 = math.atan2(ay - by, ax - bx)
        a2 = math.atan2(cy - by, cx - bx)
        out.append(math.degrees((a1 - a2) % (2 * math.pi)))
    return out


def test_polygon_angles():
    for s in SEEDS:
        p, (find, total, exterior) = run(polygon_angles, s)
        n, angles = len(p["angles"]), p["angles"]
        assert sum(angles) == (n - 2) * 180 and all(60 <= a <= 165 for a in angles)
        drawn = _interior_angles(polygon_angles.vertices(p))
        if abs(sum(drawn) - (n - 2) * 180) > 1:  # the vertices run the other way round
            drawn = [360 - a for a in drawn]
        assert all(abs(d - a) < 0.5 for d, a in zip(drawn, angles))  # drawn as labelled, so convex too
        x = angles[p["unknown"]]
        assert int(find.answer) == x and all(f"{a}°" in find.stem for i, a in enumerate(angles) if i != p["unknown"])
        assert int(total.answer) == (n - 2) * 180
        assert int(exterior.answer) == 180 - x
        if p["band"] == "LS":
            assert n in (4, 5)


def _shoelace(pts):
    return abs(sum(x0 * y1 - x1 * y0 for (x0, y0), (x1, y1) in zip(pts, pts[1:] + pts[:1]))) / 2


def test_area_shapes():
    for s in SEEDS:
        p, qs = run(area_shapes, s)
        pts = area_shapes.vertices(p)
        area = qs[0]
        assert float(area.answer) == _shoelace(pts) and f"{area.answer} {p['unit']}²" in area.accepted
        assert f"{area.answer} {p['unit']}2" in area.accepted
        if p["shape"] in ("grid", "L"):
            perim = sum(math.dist(a, b) for a, b in zip(pts, pts[1:] + pts[:1]))
            assert float(qs[1].answer) == perim
        if p["shape"] == "L":
            assert float(qs[2].answer) == p["sides"][p["missing"]]
        if p["band"] == "P":
            assert p["shape"] == "grid"


def test_bearings():
    for s in SEEDS:
        p, (find, back) = run(bearings, s)
        (ax_, ay), (bx, by) = bearings.positions(p)
        theta = round(math.degrees(math.atan2(bx - ax_, by - ay))) % 360  # clockwise from north
        assert theta == p["theta"] and theta % 90 != 0
        assert find.answer == f"{theta:03d}°" and {f"{theta:03d}", str(theta)} <= set(find.accepted)
        assert f"is {theta:03d}°" in back.stem and back.answer == f"{(theta + 180) % 360:03d}°"
        assert 0 < p["given"] < 90  # the angle printed is measured from the nearest of N, E, S and W


from figgen.families import circle_theorem, cuboid, nets, right_triangle  # noqa: E402


def _angle_at(v, a, b) -> float:
    """The angle at v between the rays to a and b, in degrees."""
    a1 = math.atan2(a[1] - v[1], a[0] - v[0])
    a2 = math.atan2(b[1] - v[1], b[0] - v[0])
    d = abs(math.degrees(a1 - a2)) % 360
    return min(d, 360 - d)


def test_right_triangle():
    for s in SEEDS:
        p, (find, which) = run(right_triangle, s)
        pts = right_triangle.vertices(p)  # {letter: (x, y)}; the right angle at the third letter
        a_, b_, c_ = p["letters"]
        assert abs(_angle_at(pts[c_], pts[a_], pts[b_]) - 90) < 1e-6
        true = {"hyp": math.dist(pts[a_], pts[b_]), "opp": math.dist(pts[b_], pts[c_]), "adj": math.dist(pts[a_], pts[c_]),
                "angle": _angle_at(pts[a_], pts[b_], pts[c_])}
        for role, v in p["given"].items():  # what the figure prints is what it draws
            assert abs(true[role] - v) < 1e-6
        want = true[p["unknown"]]
        if p["exact"]:
            assert float(find.answer) == round(want) and abs(want - round(want)) < 1e-9
        else:
            assert find.answer == f"{want:.1f}" and "1 decimal place" in find.stem
        if p["band"] == "LS":
            assert p["unknown"] != "angle" and "angle" not in p["given"]
            assert picked(which) == f"{a_}{b_}"  # the hypotenuse, opposite the right angle
        else:
            assert picked(which) in ("sin", "cos", "tan")
            roles = set(p["given"]) | {p["unknown"]}
            assert picked(which) == {frozenset({"opp", "hyp"}): "sin", frozenset({"adj", "hyp"}): "cos",
                                     frozenset({"opp", "adj"}): "tan"}[frozenset(roles - {"angle"})]


def test_circle_theorem():
    for s in SEEDS:
        p, (find, reason) = run(circle_theorem, s)
        pts = circle_theorem.points(p)
        for name in p["on_circle"]:  # every point said to be on the circle is on it
            assert abs(math.hypot(*pts[name]) - 1) < 1e-9
        values = {"given": p["given"], "x": int(find.answer)}
        for vertex, a, b, which in circle_theorem.marks(p):
            assert abs(_angle_at(pts[vertex], pts[a], pts[b]) - values[which]) < 1e-6, (s, p["theorem"], which)
        assert f"{p['given']}°" in find.stem and picked(reason) == circle_theorem.REASONS[p["theorem"]]
        if p["band"] == "LS":
            assert p["theorem"] in ("semicircle", "tangent", "isosceles")


def test_cuboid():
    for s in SEEDS:
        p, qs = run(cuboid, s)
        l, w, h = p["l"], p["w"], p["h"]
        assert all(isinstance(v, int) and 1 <= v <= 12 for v in (l, w, h))
        assert int(qs[0].answer) == l * w * h and f"{l * w * h} {p['unit']}³" in qs[0].accepted
        if p["band"] == "LS":
            sa = 2 * (l * w + l * h + w * h)
            assert int(qs[1].answer) == sa and f"{sa} {p['unit']}²" in qs[1].accepted
        else:
            assert l <= 5 and w <= 5 and h <= 5  # cubes a child can count


def _folds_to_cube(cells) -> bool:
    """Roll a die across the net: a cube net puts a different face down on every square."""
    cells = set(map(tuple, cells))
    start = next(iter(cells))
    # A die as (bottom, top, north, south, east, west) face numbers.
    roll = {(1, 0): lambda d: (d[4], d[5], d[2], d[3], d[1], d[0]), (-1, 0): lambda d: (d[5], d[4], d[2], d[3], d[0], d[1]),
            (0, 1): lambda d: (d[2], d[3], d[1], d[0], d[4], d[5]), (0, -1): lambda d: (d[3], d[2], d[0], d[1], d[4], d[5])}
    seen, stack = {start: (0, 1, 2, 3, 4, 5)}, [start]
    while stack:
        c = stack.pop()
        for (dx, dy), f in roll.items():
            n = (c[0] + dx, c[1] + dy)
            if n in cells and n not in seen:
                seen[n] = f(seen[c])
                stack.append(n)
    return len(seen) == 6 and len({d[0] for d in seen.values()}) == 6


def test_nets():
    counts = {"cube": (6, 12, 8), "cuboid": (6, 12, 8), "triangular prism": (5, 9, 6), "square-based pyramid": (5, 8, 5),
              "tetrahedron": (4, 6, 4)}
    for s in SEEDS:
        p, qs = run(nets, s)
        solid, which, count = p["solid"], qs[0], qs[1]
        assert picked(which) == solid
        if solid == "cube":
            assert _folds_to_cube(p["cells"]) and "cuboid" not in which.options  # a cube is a cuboid too
        feature = re.search(r"How many (faces|edges|vertices)", count.stem).group(1)
        assert int(count.answer) == counts[solid][("faces", "edges", "vertices").index(feature)]
        if p["band"] == "LS" and solid in ("cube", "cuboid"):
            l, w, h = p["dims"]
            assert int(qs[2].answer) == 2 * (l * w + l * h + w * h)


from figgen.families import (conversion_graph, inequality_region, linear_graph, quadratic_graph,  # noqa: E402
                             transformation, travel_graph, vectors_grid)


def _pair_of(text: str) -> tuple[float, float]:
    a, b = re.findall(r"-?\d+(?:\.\d+)?", text)[:2]
    return float(a), float(b)


def test_linear_graph():
    for s in SEEDS:
        p, qs = run(linear_graph, s)
        m, c = Fraction(p["m"]), p["c"]
        grad, cross, eq, at, when = qs[:5]
        assert Fraction(grad.answer) == m and int(cross.answer) == c
        assert picked(eq) == linear_graph.equation(m, c) and len(set(eq.options)) == len(eq.options)
        x = int(re.search(r"when x = (-?\d+)", at.stem).group(1))
        assert Fraction(at.answer) == m * x + c and (m * x + c).denominator == 1  # on a gridline
        v = int(re.search(r"is y = (-?\d+)", when.stem).group(1))
        assert m * int(when.answer) + c == v
        lo, hi = p["xlim"]
        assert lo <= x <= hi and lo <= int(when.answer) <= hi
        if p["band"] == "UP":
            sim = qs[5]
            m2, c2 = Fraction(p["m2"]), p["c2"]
            xs = (c2 - c) / (m - m2)
            assert xs.denominator == 1 and (m * xs + c).denominator == 1  # they cross on a grid point
            assert picked(sim) == f"x = {int(xs)}, y = {int(m * xs + c)}"


def test_quadratic_graph():
    for s in SEEDS:
        p, qs = run(quadratic_graph, s)
        a, r1, r2 = p["a"], p["p"], p["q"]
        f = lambda x: a * (x - r1) * (x - r2)  # noqa: E731
        roots, turn, cross, level = qs[:4]
        assert picked(roots) == f"x = {r1} or x = {r2}"
        h = (r1 + r2) // 2
        assert (r1 + r2) % 2 == 0 and picked(turn) == f"({h}, {f(h)})"
        assert int(cross.answer) == f(0)
        k = int(re.search(r"= (-?\d+)\.$", level.stem).group(1))
        x1, x2 = (float(v) for v in re.findall(r"-?\d+", picked(level))[:2])
        assert f(x1) == k and f(x2) == k and x1 != x2
        assert p["equation"] in roots.stem
        if p["band"] == "UP":
            neg = qs[4]
            assert picked(neg) == (f"{r1} < x < {r2}" if a > 0 else f"x < {r1} or x > {r2}")
        xr = int(re.search(r"when x = (-?\d+)\?", qs[-1].stem).group(1))
        assert int(qs[-1].answer) == f(xr) and r1 - 2 <= xr <= r2 + 2  # read off the drawn curve


def test_conversion_graph():
    for s in SEEDS:
        p, qs = run(conversion_graph, s)
        conv = conversion_graph.spec(p)
        to_y = lambda x: Fraction(conv["slope"]) * Fraction(x) + conv["offset"]  # noqa: E731
        fwd, back = qs[0], qs[1]
        x = Fraction(re.search(r"change (-?\d+) ", fwd.stem).group(1))
        assert Fraction(fwd.answer) == to_y(x)
        assert x % conv["xstep"] == 0 and (to_y(x) - conv["offset"]) % conv["ystep"] == 0  # on gridlines
        y = Fraction(re.search(r"change (-?\d+) ", back.stem).group(1))
        assert to_y(Fraction(back.answer)) == y
        if len(qs) > 2:
            big = Fraction(re.search(r"change (\d+) ", qs[2].stem).group(1))
            assert big > conv["xmax"] and Fraction(qs[2].answer) == to_y(big) and conv["offset"] == 0


def test_travel_graph():
    for s in SEEDS:
        p, (where, stop, speed) = run(travel_graph, s)
        pts = p["points"]  # (minutes after the start, km from home)
        assert pts[0][1] == 0 and pts[-1][1] == 0 and all(t % 15 == 0 for t, _ in pts)
        t = travel_graph.minutes(re.search(r"at (\d+:\d\d)", where.stem).group(1), p["start"])
        corner = [d for tt, d in pts if tt == t]
        assert corner and float(where.answer) == corner[0]
        far = max(d for _, d in pts)
        stops = [b[0] - a[0] for a, b in zip(pts, pts[1:]) if a[1] == b[1] == far]
        assert len(stops) == 1 and int(stop.answer) == stops[0]  # the stop at the place, the furthest point
        (t0, d0), (t1, d1) = pts[-2], pts[-1]
        assert float(speed.answer) == (d0 - d1) / ((t1 - t0) / 60) and float(speed.answer).is_integer()


def _transform(desc: str, pt):
    x, y = pt
    if m := re.match(r"Reflection in the line x = (-?\d+)", desc):
        k = int(m.group(1)); return (2 * k - x, y)
    if m := re.match(r"Reflection in the line y = (-?\d+)$", desc):
        k = int(m.group(1)); return (x, 2 * k - y)
    if desc == "Reflection in the line y = x":
        return (y, x)
    if desc == "Reflection in the line y = -x":
        return (-y, -x)
    if m := re.match(r"Rotation (90|180)° ?(clockwise|anticlockwise)? about \((-?\d+), (-?\d+)\)", desc):
        a, b = int(m.group(3)), int(m.group(4))
        dx, dy = x - a, y - b
        if m.group(1) == "180":
            return (a - dx, b - dy)
        return (a + dy, b - dx) if m.group(2) == "clockwise" else (a - dy, b + dx)
    if m := re.match(r"Translation by the vector \((-?\d+), (-?\d+)\)", desc):
        return (x + int(m.group(1)), y + int(m.group(2)))
    if m := re.match(r"Enlargement, scale factor (\d+), centre \((-?\d+), (-?\d+)\)", desc):
        k, a, b = int(m.group(1)), int(m.group(2)), int(m.group(3))
        return (a + k * (x - a), b + k * (y - b))
    raise AssertionError(desc)


def _symmetric(pts) -> bool:
    """Whether any turn or flip of the shape lands on itself (after sliding it back)."""
    def norm(ps):
        mx, my = min(x for x, _ in ps), min(y for _, y in ps)
        return {(x - mx, y - my) for x, y in ps}
    maps = [lambda x, y: (-y, x), lambda x, y: (-x, -y), lambda x, y: (y, -x), lambda x, y: (-x, y), lambda x, y: (x, -y),
            lambda x, y: (y, x), lambda x, y: (-y, -x)]
    return any(norm([f(x, y) for x, y in pts]) == norm(pts) for f in maps)


def test_transformation():
    assert not any(_symmetric(shape) for shape in transformation.SHAPES)
    for s in SEEDS:
        p, (which, image) = run(transformation, s)
        A = [tuple(v) for v in p["A"]]
        B = {tuple(v) for v in p["B"]}
        maps = [o for o in which.options if {_transform(o, v) for v in A} == B]
        assert maps == [picked(which)]  # the key maps A onto B, and no other option does
        lo, hi = p["lim"]
        assert all(lo <= c <= hi for v in A + list(B) for c in v)
        P = _pair_of(image.stem)
        assert _pair_of(image.answer) == _transform(picked(which), P) and P in A


def test_vectors_grid():
    for s in SEEDS:
        p, qs = run(vectors_grid, s)
        vec = {n: tuple(v) for n, v in p["vectors"].items()}
        which, combo, move = qs[:3]
        name = re.search(r"Which column vector is (\w)\?", which.stem).group(1)
        assert _pair_of(picked(which)) == vec[name] and len(set(which.options)) == len(which.options)
        m = re.search(r"What is (\d?)(\w) ([+-]) (\w)\?", combo.stem)
        k = int(m.group(1) or 1)
        u, w = vec[m.group(2)], vec[m.group(4)]
        sign = 1 if m.group(3) == "+" else -1
        assert _pair_of(combo.answer) == (k * u[0] + sign * w[0], k * u[1] + sign * w[1])
        start = _pair_of(move.stem)
        n = re.search(r"by the vector (\w)\.", move.stem).group(1)
        assert _pair_of(move.answer) == (start[0] + vec[n][0], start[1] + vec[n][1])
        assert all(v != (0, 0) and all(-5 <= c <= 5 for c in v) for v in vec.values())
        if p["band"] == "UP":
            mag = qs[3]
            n = re.search(r"magnitude of (\w)\?", mag.stem).group(1)
            assert mag.answer == f"{math.hypot(*vec[n]):.1f}"


def _holds(cond: str, x: int, y: int) -> bool:
    left, op, right = re.match(r"\s*(.+?)\s*(≤|≥|<|>)\s*(.+?)\s*$", cond).groups()
    env = {"x": x, "y": y}
    lv, rv = eval(left.replace("−", "-"), {}, env), eval(re.sub(r"(\d)x", r"\1*x", right.replace("−", "-")), {}, env)
    return {"≤": lv <= rv, "≥": lv >= rv, "<": lv < rv, ">": lv > rv}[op]


def test_inequality_region():
    for s in SEEDS:
        p, (which, inside, largest) = run(inequality_region, s)
        grid = [(x, y) for x in range(-8, 9) for y in range(-8, 9)]
        region = {pt for pt in grid if inequality_region.contains(p, *pt)}
        assert region
        ok = [o for o in which.options if {pt for pt in grid if all(_holds(c, *pt) for c in o.split(", "))} == region]
        assert ok == [picked(which)]  # the key describes R exactly, and no other option does
        pts = [_pair_of(o) for o in inside.options]
        assert [pt for pt in pts if (int(pt[0]), int(pt[1])) in region] == [_pair_of(picked(inside))]
        k = int(re.search(r"y = (-?\d+)", largest.stem).group(1))
        assert int(largest.answer) == max(x for x, y in region if y == k)
