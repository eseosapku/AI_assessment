"""What a student sees must be readable and true to life.

Each check here comes from looking at the pilot's first figures before review:
labels ran into each other, a leader line ran through another event's label, a
cross-section's sections had no boundaries, and Lagos was 12 °C at dawn.
"""
import math
import random
from math import gcd

import matplotlib.pyplot as plt
import pytest
from matplotlib.text import Text

from figgen.families import (FAMILIES, angles, break_even, climate_graph, coordinates, cross_section, food_web, line_graph, notice,
                             pie_chart, population_pyramid, punnett, scale_reading, scatter_graph, supply_demand, timeline,
                             timetable, tree_diagram)


def drawn_texts(fig):
    """Every piece of text the renderer actually drew, with its box in pixels."""
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


def overlap(a, b, margin=1.0) -> bool:
    return min(a.x1, b.x1) - max(a.x0, b.x0) > margin and min(a.y1, b.y1) - max(a.y0, b.y0) > margin


def inside(pt, box, margin=1.0) -> bool:
    return box.x0 + margin < pt[0] < box.x1 - margin and box.y0 + margin < pt[1] < box.y1 - margin


def segment_hits(p0, p1, box, margin=1.0, steps=80) -> bool:
    """Whether a straight segment between two pixel points passes through a box."""
    return any(inside((p0[0] + (p1[0] - p0[0]) * k / steps, p0[1] + (p1[1] - p0[1]) * k / steps), box, margin)
               for k in range(steps + 1))


def crosses(line, box, margin=1.0) -> bool:
    """Whether any part of a drawn line passes through a box, in pixels."""
    pts = line.get_transform().transform(line.get_xydata())
    return any(segment_hits(a, b, box, margin) for a, b in zip(pts, pts[1:]))


def points_drawn(ax):
    """Every point a figure drew in data coordinates, with what drew it: line vertices, patch outlines
    (arcs sampled along their sweep, curves flattened), and collections' offsets and paths."""
    from matplotlib.patches import Arc, Circle, Ellipse
    data = ax.transData
    for ln in ax.lines:
        # A whole straight line (core.infinite) runs to the frame's edge on purpose.
        if ln.get_transform().contains_branch(data) and not getattr(ln, "figgen_infinite", False):
            yield from ((x, y, ln) for x, y in ln.get_xydata())
    for pa in ax.patches:
        if not pa.get_transform().contains_branch(data):
            continue
        if isinstance(pa, Arc):
            (cx, cy), w, h, rot = pa.center, pa.width, pa.height, math.radians(pa.angle)
            for k in range(33):
                t = math.radians(pa.theta1 + (pa.theta2 - pa.theta1) * k / 32)
                x, y = w / 2 * math.cos(t), h / 2 * math.sin(t)
                yield cx + x * math.cos(rot) - y * math.sin(rot), cy + x * math.sin(rot) + y * math.cos(rot), pa
        elif isinstance(pa, (Circle, Ellipse)):
            (cx, cy), w, h = pa.center, pa.width, pa.height
            yield from ((cx + dx, cy + dy, pa) for dx, dy in ((w / 2, 0), (-w / 2, 0), (0, h / 2), (0, -h / 2)))
        else:
            for poly in pa.get_path().to_polygons(pa.get_patch_transform(), closed_only=False):
                yield from ((x, y, pa) for x, y in poly)
    for c in ax.collections:
        offsets = c.get_offsets()
        if len(offsets) and c.get_offset_transform().contains_branch(data):
            yield from ((x, y, c) for x, y in offsets)
        if c.get_transform().contains_branch(data):
            for p in c.get_paths():
                yield from ((x, y, c) for x, y in p.vertices)


@pytest.mark.parametrize("fid", sorted(FAMILIES))
def test_everything_drawn_lies_inside_the_axes(fid):
    """A piece drawn past the axes' limits is cut off: the L of dots lost its upright arm, and the key
    counted dots the figure did not show (P3b final review)."""
    m = FAMILIES[fid]
    for seed in range(1, 13):
        fig = m.draw(m.sample(random.Random(seed)))
        try:
            for ax in fig.axes:
                (x0, x1), (y0, y1) = sorted(ax.get_xlim()), sorted(ax.get_ylim())
                slack = 1e-6 * max(1.0, x1 - x0, y1 - y0)
                for x, y, art in points_drawn(ax):
                    assert x0 - slack <= x <= x1 + slack and y0 - slack <= y <= y1 + slack, \
                        (fid, seed, type(art).__name__, (round(float(x), 3), round(float(y), 3)), (x0, x1, y0, y1))
        finally:
            plt.close(fig)


@pytest.mark.parametrize("fid", sorted(FAMILIES))
def test_no_two_pieces_of_text_overlap(fid):
    m = FAMILIES[fid]
    for seed in range(1, 16):
        fig = m.draw(m.sample(random.Random(seed)))
        texts = drawn_texts(fig)
        plt.close(fig)
        for i, (t, a) in enumerate(texts):
            for u, b in texts[i + 1:]:
                assert not overlap(a, b), f"{fid} seed {seed}: {t.get_text()!r} overlaps {u.get_text()!r}"


def test_timeline_leaders_never_cross_another_label():
    for seed in range(1, 41):
        p = timeline.sample(random.Random(seed))
        fig = timeline.draw(p)
        texts = drawn_texts(fig)
        labels = {t.get_gid(): box for t, box in texts if (t.get_gid() or "").startswith("label-")}
        leaders = {line.get_gid(): line for line in fig.axes[0].lines if (line.get_gid() or "").startswith("leader-")}
        plt.close(fig)
        assert len(labels) == len(leaders) == len(p["events"]), f"seed {seed}"
        for lid, line in leaders.items():
            for gid, box in labels.items():
                if gid.split("-")[1] != lid.split("-")[1]:
                    assert not crosses(line, box), f"seed {seed}: {lid} runs through {gid}"


def test_cross_section_sections_are_marked_and_each_climbs_or_falls():
    for seed in range(1, 41):
        p = cross_section.sample(random.Random(seed))
        h, cuts = p["heights"], p["cuts"]
        for a, b in zip(cuts, cuts[1:]):
            steps = [h[k + 1] - h[k] for k in range(a, b)]
            assert all(s >= 0 for s in steps) or all(s <= 0 for s in steps), f"seed {seed}: {a}-{b} goes up and down"
        g = sorted((abs(h[b] - h[a]) / (b - a) for a, b in zip(cuts, cuts[1:])), reverse=True)
        assert g[0] >= 1.5 * g[1], f"seed {seed}: the steepest section is not clearly the steepest: {g}"
        fig = cross_section.draw(p)
        verticals = {float(line.get_xdata()[0]) for line in fig.axes[0].lines
                     if len(line.get_xdata()) == 2 and line.get_xdata()[0] == line.get_xdata()[1]}
        plt.close(fig)
        assert set(cuts[1:-1]) <= verticals, f"seed {seed}: section boundaries are not drawn"


def test_tree_probabilities_sit_clear_of_the_branches():
    for seed in range(1, 21):
        p = tree_diagram.sample(random.Random(seed))
        fig = tree_diagram.draw(p)
        probs = [(t, box) for t, box in drawn_texts(fig) if "/" in t.get_text()]
        assert len(probs) == 6
        for line in fig.axes[0].lines:
            for t, box in probs:
                assert not crosses(line, box), f"seed {seed}: a branch runs through {t.get_text()!r}"
        plt.close(fig)


def test_tree_stated_probabilities_are_in_lowest_terms():
    # "A spinner lands on green with probability 2/6" is not how a paper would put it.
    for seed in range(1, 300):
        p = tree_diagram.sample(random.Random(seed))
        if "{a}/{n}" in p["text"]:
            assert gcd(p["a"], p["n"]) == 1, f"seed {seed}: {p['a']}/{p['n']}"


def test_line_graph_temperatures_fit_the_place_and_the_day():
    for seed in range(1, 300):
        p = line_graph.sample(random.Random(seed))
        lo, hi = line_graph.CLIMATE[p["kind"]]
        t = p["temps"]
        assert lo <= min(t) and max(t) <= hi, f"seed {seed}: {p['place']} {t}"
        k = t.index(max(t))
        assert line_graph.HOURS[k] in (12, 14, 16), f"seed {seed}: peak at {line_graph.HOURS[k]}"
        assert all(a <= b for a, b in zip(t[:k], t[1:k + 1])), f"seed {seed}: falls before the peak {t}"
        assert all(a >= b for a, b in zip(t[k:], t[k + 1:])), f"seed {seed}: rises after the peak {t}"


def test_notice_writes_noon_as_noon():
    found = False
    for seed in range(1, 300):
        p = notice.sample(random.Random(seed))
        fig = notice.draw(p)
        words = " ".join(t.get_text() for t in fig.axes[0].texts)
        plt.close(fig)
        assert "12:00 p.m." not in words
        if p["end"] == 12:
            found = True
            assert "12 noon" in words
    assert found


def test_coordinate_points_stay_clear_of_the_axis_numbers():
    for seed in range(1, 300):
        p = coordinates.sample(random.Random(seed))
        if p["lo"] < 0:
            assert all(abs(x) >= 2 and abs(y) >= 2 for x, y in p["points"]), f"seed {seed}: {p['points']}"


# From the blind review's rejections (round two).

def test_food_web_arrows_never_pass_through_another_box_and_their_heads_show():
    # Arrows that skipped a level ran behind the box between, so the web read as other links.
    for seed in range(1, 81):
        p = food_web.sample(random.Random(seed))
        fig = food_web.draw(p)
        fig.canvas.draw()
        renderer = fig.canvas.get_renderer()
        ax = fig.axes[0]
        boxes = {t.get_text(): t.get_bbox_patch().get_window_extent(renderer) for t in ax.texts if t.get_bbox_patch()}
        arrows = [a for a in ax.texts if (a.get_gid() or "").startswith("edge:")]
        assert len(arrows) == len(p["links"]), f"seed {seed}"
        for a in arrows:
            food, eater = a.get_gid()[5:].split(">")
            start, end = ax.transData.transform(a.xyann), ax.transData.transform(a.xy)
            for name, box in boxes.items():
                assert not inside(end, box), f"seed {seed}: the head of {food}->{eater} is hidden in {name}"
                if name not in (food, eater):
                    assert not segment_hits(start, end, box), f"seed {seed}: {food}->{eater} passes through {name}"
        plt.close(fig)


def test_food_web_question_says_what_a_chain_is():
    rng = random.Random(1)
    stem = food_web.questions(food_web.sample(rng), rng)[2].stem
    assert "producer" in stem and "nothing" in stem


def test_angle_arcs_each_mark_one_angle():
    from matplotlib.patches import Arc
    for seed in range(1, 120):
        p = angles.sample(random.Random(seed))
        if p["total"] == 360:
            assert all(abs(a - 180) > 15 for a in p["parts"]), f"seed {seed}: {p['parts']}: two rays look like one line"
        fig = angles.draw(p)
        sizes = [a.width for a in fig.axes[0].patches if isinstance(a, Arc)]
        plt.close(fig)
        assert len(sizes) == len(p["parts"])
        assert len(set(sizes)) == len(sizes), f"seed {seed}: two arcs share a radius and can join up"
        # A bigger angle never gets the smaller arc: the review read a 105 degree angle with the
        # inner arc as the smaller of the two.
        for i, a in enumerate(p["parts"]):
            for j, b in enumerate(p["parts"]):
                if a > b:
                    assert sizes[i] > sizes[j], f"seed {seed}: {a} has a smaller arc than {b}"


def test_climate_values_sit_on_gridlines_both_axes_share():
    for seed in range(1, 60):
        p = climate_graph.sample(random.Random(seed))
        assert sum(1 for r in p["rain"] if r > 0) >= 3, f"seed {seed}: {p['name']} {p['rain']}"
        fig = climate_graph.draw(p)
        ax, ax2 = fig.axes[0], fig.axes[1]
        assert ax.get_ylim()[0] == 0 and ax2.get_ylim()[0] == 0
        top, ttop = ax.get_ylim()[1], ax2.get_ylim()[1]
        lines = {round(float(v), 6) for v in list(ax.get_yticks()) + list(ax.get_yticks(minor=True))}
        plt.close(fig)
        for r in p["rain"]:
            assert round(float(r), 6) in lines, f"seed {seed}: {r} mm is between gridlines"
        for t in p["temp"]:
            assert round(t / ttop * top, 6) in lines, f"seed {seed}: {t} degrees is between gridlines"


def test_scatter_points_stay_inside_the_plot():
    for seed in range(1, 200):
        p = scatter_graph.sample(random.Random(seed))
        assert all(5 <= y <= 95 for y in p["ys"]), f"seed {seed}: a point on the plot's edge"


def test_scale_readings_are_clear_of_the_bottom_and_thermometers_have_a_bulb():
    from matplotlib.patches import Ellipse  # the bulb: round on the page, though the axes are not square
    for seed in range(1, 120):
        p = scale_reading.sample(random.Random(seed))
        assert p["value"] - p["lo"] >= (p["hi"] - p["lo"]) / 6, f"seed {seed}: {p['value']} is too near the bottom"
        if seed <= 20:
            fig = scale_reading.draw(p)
            bulbs = [c for c in fig.axes[0].patches if isinstance(c, Ellipse)]
            plt.close(fig)
            assert bool(bulbs) == (p["kind"] == "thermometer"), f"seed {seed}"


def test_pyramid_percentages_add_to_100_and_axis_numbers_have_room():
    for seed in range(1, 120):
        p = population_pyramid.sample(random.Random(seed))
        assert sum(p["male"]) + sum(p["female"]) == 100, f"seed {seed}"
        assert min(p["male"] + p["female"]) >= 1
    for seed in range(1, 16):
        fig = population_pyramid.draw(population_pyramid.sample(random.Random(seed)))
        fig.canvas.draw()
        renderer = fig.canvas.get_renderer()
        boxes = sorted((t.get_window_extent(renderer) for t in fig.axes[0].get_xticklabels() if t.get_text()),
                       key=lambda b: b.x0)
        plt.close(fig)
        gap = min(b.x0 - a.x1 for a, b in zip(boxes, boxes[1:]))
        assert gap >= 6, f"seed {seed}: axis numbers only {gap:.1f}px apart"


def test_timetable_questions_are_answered_by_reading_it():
    # The review judged duration sums to be numeracy, not English reading.
    for seed in range(1, 40):
        rng = random.Random(seed)
        p = timetable.sample(rng)
        qs = timetable.questions(p, rng)
        fig = timetable.draw(p)
        words = " ".join(t.get_text() for t, _ in drawn_texts(fig)).lower()
        plt.close(fig)
        for q in qs:
            key = q.options[int(q.answer)] if q.kind == "mcq" else q.answer
            assert key.lower() in words, f"seed {seed}: {key!r} cannot be read off the timetable"
            assert "how many minutes" not in q.stem.lower()


def test_timeline_marks_every_year():
    for seed in range(1, 21):
        p = timeline.sample(random.Random(seed))
        fig = timeline.draw(p)
        ys = {round(float(line.get_ydata()[0]), 6) for line in fig.axes[0].lines
              if len(line.get_ydata()) == 2 and line.get_ydata()[0] == line.get_ydata()[1] and line.get_xdata()[0] < 0}
        plt.close(fig)
        first, last = p["events"][0][1], p["events"][-1][1]
        assert set(range(first - 2, last + 3)) <= ys, f"seed {seed}: some years have no tick"


# From the final code review.

def test_pyramid_shapes_look_like_their_names():
    # Independent noise made most "stable" pyramids bulge in the middle, so "contracting" was also right.
    for seed in range(1, 200):
        p = population_pyramid.sample(random.Random(seed))
        t = [m + f for m, f in zip(p["male"], p["female"])]
        if p["shape"] == "expanding":
            assert all(a >= b for a, b in zip(t, t[1:])) and t[0] >= 2 * t[3], f"seed {seed}: {t}"
        elif p["shape"] == "stable":
            assert t[0] >= max(t[1:]), f"seed {seed}: a stable pyramid wider above its base: {t}"
            assert all(abs(a - b) <= 4 for a, b in zip(t, t[1:])) and 2 * t[-1] >= t[0], f"seed {seed}: {t}"
        else:
            assert max(t[2:6]) >= t[0] + 4, f"seed {seed}: a contracting pyramid with a wide base: {t}"


def test_punnett_genotype_is_chosen_not_typed():
    # The app's marker ignores letter case, so a typed TT, Tt and tt would all mark the same.
    for seed in range(1, 60):
        rng = random.Random(seed)
        p = punnett.sample(rng)
        q = punnett.questions(p, rng)[0]
        letter = p["letter"]
        assert q.kind == "mcq"
        assert sorted(q.options) == sorted([letter * 2, letter + letter.lower(), letter.lower() * 2])


def test_line_graph_asks_for_a_difference_that_is_never_zero():
    # "By how many degrees did it change" had answers of 0, and a fair "-2" was marked wrong.
    for seed in range(1, 120):
        rng = random.Random(seed)
        q = line_graph.questions(line_graph.sample(rng), rng)[2]
        assert "difference" in q.stem and int(q.answer) > 0, f"seed {seed}: {q.stem} {q.answer}"


def test_fair_ways_of_writing_a_time_are_accepted():
    for seed in range(1, 60):
        rng = random.Random(seed)
        p = notice.sample(rng)
        q = notice.questions(p, rng)[0]
        h = p["start"]
        h12, ap = h % 12 or 12, ("am" if h < 12 else "pm")
        dotted = "a.m." if h < 12 else "p.m."
        for form in (f"{h12} {ap}", f"{h12}{ap}", f"{h12}:00 {ap}", f"{h12} {dotted}", f"{h:02d}:00"):
            assert form in q.accepted, f"seed {seed}: {form!r} not in {q.accepted}"
        rng = random.Random(seed)
        p = timetable.sample(rng)
        q = timetable.questions(p, rng)[0]
        hh, mm = q.answer.split(":")
        assert f"{int(hh)}.{mm}" in q.accepted and f"{int(hh)}:{mm}" in q.accepted, f"seed {seed}: {q.accepted}"


# From the blind review (round three).

def test_pyramid_each_side_shows_the_shape_on_its_own():
    # Noise on each bar left most pyramids between two shapes; each side is now a clean profile.
    for seed in range(1, 200):
        p = population_pyramid.sample(random.Random(seed))
        for side in (p["male"], p["female"]):
            assert sum(side) == 50, f"seed {seed}"
            if p["shape"] == "expanding":
                assert all(a > b for a, b in zip(side[:6], side[1:6])), f"seed {seed}: {side}"
                assert all(a >= b for a, b in zip(side[5:], side[6:])), f"seed {seed}: {side}"
                assert side[0] >= 3 * side[4] and side[0] >= 2 * side[3], f"seed {seed}: {side}"
            elif p["shape"] == "stable":
                assert len(set(side[:4])) == 1, f"seed {seed}: {side}"
                assert all(0 <= a - b <= 2 for a, b in zip(side[3:], side[4:])) and 2 * side[-1] >= side[0], f"seed {seed}: {side}"
            else:
                assert all(a < b for a, b in zip(side[:5], side[1:5])), f"seed {seed}: {side}"
                assert all(a >= b for a, b in zip(side[4:], side[5:])) and side[0] <= side[4] - 3, f"seed {seed}: {side}"


def test_break_even_profit_stays_on_the_chart_and_names_the_variable_cost():
    for seed in range(1, 120):
        rng = random.Random(seed)
        p = break_even.sample(rng)
        q = break_even.questions(p, rng)[2]
        out = int(q.stem.split("output of ")[1].split(" ")[0])
        assert out <= 2 * p["be"], f"seed {seed}: {out} units is off the chart"
        assert "variable cost" in q.stem


def test_pie_questions_need_working_not_a_printed_label():
    for seed in range(1, 60):
        rng = random.Random(seed)
        qs = pie_chart.questions(pie_chart.sample(rng), rng)
        assert not any("angle" in q.stem.lower() for q in qs)


def test_punnett_questions_read_naturally():
    for seed in range(1, 60):
        rng = random.Random(seed)
        for q in punnett.questions(punnett.sample(rng), rng):
            assert "have short" not in q.stem and "have tall" not in q.stem and "for tall;" not in q.stem, q.stem


def test_supply_changes_have_a_cause_that_fits_the_good():
    for seed in range(1, 200):
        rng = random.Random(seed)
        p = supply_demand.sample(rng)
        text = supply_demand.questions(p, rng)[2].stem
        if p["good"] in ("cement", "school uniforms", "mobile phones"):
            assert "harvest" not in text, f"seed {seed}: {text}"


def test_pyramids_are_drawn_only_in_shapes_a_reader_cannot_dispute():
    # The blind review failed 8 of 8 "stable" pyramids as also contracting or expanding; it
    # passed every expanding and contracting one. Stable stays as a wrong option.
    shapes = {population_pyramid.sample(random.Random(s))["shape"] for s in range(1, 200)}
    assert shapes == {"expanding", "contracting"}
    rng = random.Random(1)
    q = population_pyramid.questions(population_pyramid.sample(rng), rng)[0]
    assert "Stable" in q.options
