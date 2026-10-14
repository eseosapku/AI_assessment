"""Reflex arc (LS, UP, AL): a finger touching a hot surface, drawn as textbooks draw the withdrawal reflex. A
receptor in the skin of the fingertip; a sensory neurone running to the spinal cord, its cell body in the dorsal root
ganglion outside the cord; a relay neurone lying wholly in the grey matter of the cord (a butterfly of grey matter in
white matter, cut across); a motor neurone, its cell body in the grey matter, leaving the cord for the effector, a
muscle in the arm, where it ends in motor end plates. Small arrows beside each neurone show the way the impulse goes.

The five parts of the arc are lettered, and sometimes the grey or the white matter too, the letters never running in
the arc's own order: which letter is the relay neurone; the order an impulse passes through the letters; and which
letter is the effector, with what it does.
"""
from __future__ import annotations

import random

from ..core import INK, NAMES, Question, new_figure
from ._bio_parts import ellipse, flow, letter, letter_choice, letters_for, part, spline, tube

ID = "reflex_arc"
KIND = "diagram.template"
SUBJECT = "biology"
BANDS = ("LS", "UP", "AL")
CONCEPTS = tuple(f"biology.{c}" for c in ("nervous-system-components", "neurones-structure-function",
                                          "control-coordination-mammals-overview", "coordination"))
# A topic whose sections the book lists is reached only if one names reflexes, neurones or the nervous system.
NEEDS = r"reflex|nervous|neurone|neuron"
# "Gas Exchange in Animals" names the nervous control of breathing, not a reflex arc.
AVOID = r"hormon|endocrine|behaviour|plants|gas exchange"

ARC = ["receptor", "sensory neurone", "relay neurone", "motor neurone", "effector"]


def sample(rng: random.Random) -> dict:
    extra = rng.choice([[], ["grey matter"], ["white matter"]])
    while True:
        labels = letters_for(ARC + extra, rng)
        at = {v: k for k, v in labels.items()}
        order = [at[x] for x in ARC]
        if order != sorted(order) and order != sorted(order, reverse=True):  # the letters must not give the order away
            break
    return {"band": rng.choice(BANDS), "labels": dict(sorted(labels.items()))}


# --- drawing ----------------------------------------------------------------------------------------

CORD = (10.6, 4.6)
NEURONE, SKIN, MUSCLE = "#f6e3a6", "#f2d2bd", "#e6a8a0"
GREY_HALF = [(0.12, 0.55), (0.5, 0.85), (0.92, 1.38), (1.12, 1.22), (0.82, 0.62), (0.72, 0.12), (1.2, -0.3), (1.38, -0.88),
             (1.02, -1.18), (0.55, -0.92), (0.22, -0.48)]
SENSORY = [(1.6, 6.48), (1.6, 7.6), (2.0, 8.6), (3.0, 9.1), (4.6, 9.2), (6.4, 9.0), (7.3, 8.45), (7.95, 7.92), (8.7, 7.15),
           (9.35, 6.45), (9.7, 5.75)]
RELAY = [(9.95, 5.38), (10.12, 5.0), (10.16, 4.62), (10.1, 4.3), (10.0, 4.1)]
MOTOR = [(9.6, 3.62), (8.9, 3.15), (7.6, 2.75), (5.5, 2.38), (3.9, 2.18), (3.1, 2.0)]
FINGER = [(0.95, 8.9), (0.95, 6.6), (1.1, 6.15), (1.6, 5.95), (2.1, 6.15), (2.25, 6.6), (2.25, 8.9)]
SLOT = {"receptor": ((-0.5, 6.3), (1.6, 6.3)), "sensory neurone": ((4.6, 10.15), (4.6, 9.2)),
        "relay neurone": ((13.8, 4.45), None), "motor neurone": ((6.2, 1.15), None), "effector": ((-0.5, 1.6), (1.15, 1.6)),
        "grey matter": ((13.8, 5.6), (11.3, 5.45)), "white matter": ((13.8, 3.25), (12.0, 3.4))}


def _grey() -> list[list[float]]:
    right = [(CORD[0] + x, CORD[1] + y) for x, y in GREY_HALF]
    left = [(CORD[0] - x, CORD[1] + y) for x, y in reversed(GREY_HALF)]
    return spline(right + left, per=6)


def _on(path, x=None, y=None):
    """The point on a smooth path at a given x (or y)."""
    pts = spline(path, closed=False, per=12)
    k = 0 if x is not None else 1
    v = x if x is not None else y
    for a, b in zip(pts, pts[1:]):
        if (a[k] - v) * (b[k] - v) <= 0 and a[k] != b[k]:
            t = (v - a[k]) / (b[k] - a[k])
            return (a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1]))
    raise ValueError(v)


def _slots() -> dict:
    slots = dict(SLOT)
    slots["relay neurone"] = (SLOT["relay neurone"][0], _on(RELAY, y=4.45))
    slots["motor neurone"] = (SLOT["motor neurone"][0], _on(MOTOR, x=6.2))
    return slots


def _neurone(ax, path, name: str, width: float = 0.16) -> None:
    part(ax, tube(spline(path, closed=False, per=12), width), name, NEURONE, lw=1.0, z=4)


def draw(p: dict):
    fig, ax = new_figure(7.4, 5.6)
    from matplotlib.patches import Polygon
    # the hot surface and the finger touching it
    ax.add_patch(Polygon([(0.1, 5.35), (3.1, 5.35), (3.1, 5.85), (0.1, 5.85)], closed=True, facecolor="#6b6b6b", edgecolor=INK,
                         linewidth=1.0, zorder=1, gid="hot surface"))
    for x in (0.4, 2.8):  # heat rising from it
        wave = [(x + 0.12 * ((k % 2) * 2 - 1), 6.0 + 0.3 * k) for k in range(5)]
        ax.plot(*zip(*spline(wave, closed=False, per=6)), color="#c0392b", linewidth=1.3, zorder=1)
    ax.text(1.6, 4.95, "hot surface", ha="center", va="center", fontsize=9.5, style="italic")
    ax.add_patch(Polygon(spline(FINGER, closed=False, per=8), closed=True, facecolor=SKIN, edgecolor=INK, linewidth=1.2, zorder=1.5,
                         gid="finger"))
    # the spinal cord, cut across: grey matter in white matter, the central canal, the dorsal root ganglion
    part(ax, ellipse(*CORD, 2.2, 1.85), "white matter", "#f7f3ea", z=2)
    part(ax, _grey(), "grey matter", "#c4c4c4", lw=1.0, z=2.5)
    ax.add_patch(Polygon(ellipse(*CORD, 0.08, 0.08, n=20), closed=True, facecolor="white", edgecolor=INK, linewidth=0.8, zorder=2.6))
    ax.add_patch(Polygon(ellipse(8.0, 7.9, 0.62, 0.42), closed=True, facecolor="#efe7d6", edgecolor=INK, linewidth=1.0, zorder=3,
                         gid="ganglion"))
    # the receptor in the skin, the effector muscle
    part(ax, ellipse(1.6, 6.3, 0.3, 0.18), "receptor", "#f0b44c", lw=1.0, z=3)
    part(ax, spline([(0.5, 1.6), (1.2, 2.15), (2.3, 2.25), (3.3, 1.75), (2.3, 1.1), (1.2, 1.1)], per=10), "effector", MUSCLE, z=3)
    for x in (1.0, 1.5, 2.0, 2.5):
        ax.plot([x, x + 0.25], [1.25, 2.1], color="#b06a62", linewidth=0.8, zorder=3.1)
    # the three neurones
    _neurone(ax, SENSORY, "sensory neurone")
    ax.plot([8.03, 8.08], [7.95, 8.12], color=INK, linewidth=1.0, zorder=4.1)  # the cell body's short stalk
    ax.add_patch(Polygon(ellipse(8.1, 8.2, 0.2, 0.2, n=30), closed=True, facecolor=NEURONE, edgecolor=INK, linewidth=1.0, zorder=4.2,
                         gid="cell body:sensory neurone"))
    _neurone(ax, RELAY, "relay neurone", width=0.13)
    part(ax, ellipse(10.18, 4.62, 0.15, 0.15, n=30), "relay neurone", NEURONE, lw=1.0, z=4.2)
    _neurone(ax, MOTOR, "motor neurone")
    ax.add_patch(Polygon(ellipse(9.78, 3.75, 0.22, 0.22, n=30), closed=True, facecolor=NEURONE, edgecolor=INK, linewidth=1.0, zorder=4.2,
                         gid="cell body:motor neurone"))
    for dx, dy in ((0.05, 0.33), (0.3, 0.2), (0.32, -0.08)):  # its dendrites
        ax.plot([9.78 + dx * 0.65, 9.78 + dx * 1.4], [3.75 + dy * 0.65, 3.75 + dy * 1.4], color=INK, linewidth=1.0, zorder=4.1)
    for dx, dy in ((-0.3, 0.25), (-0.35, -0.1), (-0.2, -0.3)):  # motor end plates on the muscle
        ax.plot([3.1, 3.1 + dx], [2.0, 2.0 + dy], color=INK, linewidth=1.2, zorder=4.1)
        ax.plot([3.1 + dx], [2.0 + dy], marker="o", markersize=3.5, color=INK, zorder=4.1)
    # synapses: the knob at each neurone's end, a gap before the next
    for x, y in ((9.72, 5.68), (10.0, 4.12)):
        ax.plot([x], [y], marker="o", markersize=4.5, color=INK, zorder=4.3)
    flow(ax, (3.4, 8.7), (5.2, 8.78), "sensory neurone", lw=1.4)
    flow(ax, (10.5, 5.5), (10.5, 4.85), "relay neurone", lw=1.4)
    flow(ax, (7.3, 3.2), (5.7, 2.92), "motor neurone", lw=1.4)
    for L, name in p["labels"].items():
        at, end = _slots()[name]
        letter(ax, L, at, end, gap=0.32)
    ax.text(CORD[0], 2.35, "spinal cord", ha="center", va="center", fontsize=9.5, style="italic")
    ax.set_xlim(-1.0, 14.4)
    ax.set_ylim(0.6, 10.5)
    ax.set_aspect("equal")
    ax.axis("off")
    ax.set_title("A reflex arc", fontsize=12)
    return fig


# --- questions --------------------------------------------------------------------------------------

STIMULI = ["a hot cooking pot", "the hot side of a charcoal stove", "a hot iron", "a hot saucepan lid", "the hot handle of a kettle",
           "a hot metal roof sheet in the sun"]
SETTINGS = ["at home in Rubavu", "while cooking dinner in Nyamagabe", "in the school kitchen", "at a friend's house in Huye",
            "while making tea", "at a market stall in Kigali"]


def questions(p: dict, rng: random.Random) -> list:
    labels = p["labels"]
    at = {v: k for k, v in labels.items()}
    rest = lambda *keep: [k for k in labels if k not in keep]  # noqa: E731
    intro = (f"{rng.choice(NAMES)} touches {rng.choice(STIMULI)} {rng.choice(SETTINGS)} and pulls the hand away at once. "
             f"The diagram shows the reflex arc.")
    wrong = [at[c] for c in ("sensory neurone", "motor neurone", "grey matter") if c in at] + rest(at["relay neurone"])
    qs = [letter_choice(f"{intro} Which letter shows the relay neurone?", at["relay neurone"], wrong)]
    r, s, re_, m, e = (at[x] for x in ARC)
    right = [r, s, re_, m, e]
    slips = [[e, m, re_, s, r],   # the whole arc backwards
             [r, m, re_, s, e],   # sensory and motor swapped
             [r, re_, s, m, e],   # the relay neurone before the sensory one
             [e, s, re_, m, r]]   # receptor and effector swapped
    options = [" → ".join(right)]
    for slip in slips:
        text = " → ".join(slip)
        if text not in options and len(options) < 4:
            options.append(text)
    rng.shuffle(options)
    qs.append(Question("mcq", rng.choice(["In which order does an impulse pass through the lettered parts?",
                                          "Which order shows the path of an impulse through the lettered parts of this reflex arc?"]),
                       str(options.index(" → ".join(right))), options))
    good = f"{e}: it contracts and pulls the hand away"
    options = [good, f"{e}: it relaxes so the hand drops away", f"{r}: it contracts and pulls the hand away",
               f"{m}: it contracts and pulls the hand away"]
    rng.shuffle(options)
    qs.append(Question("mcq", rng.choice(["Which letter shows the effector, and what does it do?",
                                          "Which letter is the effector in this reflex, and what does it do?"]),
                       str(options.index(good)), options))
    return qs
