"""Each family's answers, worked out a second time from the numbers it drew.

A drawn figure is only worth having if its answer key is right every time; these
tests recompute every answer independently over many seeds.
"""
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
