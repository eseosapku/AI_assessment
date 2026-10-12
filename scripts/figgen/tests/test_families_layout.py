"""What a student sees must be readable and true to life.

Each check here comes from looking at the pilot's first figures before review:
labels ran into each other, a leader line ran through another event's label, a
cross-section's sections had no boundaries, and Lagos was 12 °C at dawn.
"""
import random
from math import gcd

import matplotlib.pyplot as plt
import pytest
from matplotlib.text import Text

from figgen.families import FAMILIES, coordinates, cross_section, line_graph, notice, timeline, tree_diagram


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


def crosses(line, box, margin=1.0, steps=80) -> bool:
    """Whether any part of a drawn line passes through a box, in pixels."""
    pts = line.get_transform().transform(line.get_xydata())
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        for k in range(steps + 1):
            x, y = x0 + (x1 - x0) * k / steps, y0 + (y1 - y0) * k / steps
            if box.x0 + margin < x < box.x1 - margin and box.y0 + margin < y < box.y1 - margin:
                return True
    return False


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
        lo, hi = line_graph.CLIMATE[p["place"]]
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
