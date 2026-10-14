"""Shadows (Primary), seen from the side. Three sub-types.

Side: a lamp on a stand, or the Sun, to one side of a stick, a child or a tree. Three dashed outlines on the
ground, lettered A to C in no fixed order: one away from the light (the true shadow), one the same length on the
light's side (the slip of putting the shadow next to the light, and the true shadow if the light moved to the
other side), and one on the far side of the light. Which outline is the shadow; and which it would be if the light
were just as high on the other side.

Height: two drawings (three at the upper level) of the same 1 m stick and a lamp the same distance from it, the
lamp's height printed beside it. Which drawing gives the longest shadow, and what happens to the shadow when the
lamp moves from one height to another. No shadow is drawn: the pupil predicts it.

Sun (upper level): a school flagpole in three drawings lettered A to C, with the Sun in the east in the morning,
high at noon and in the west in the afternoon, and the shadow each makes. West and East are marked on the ground.
Which drawing shows noon (the shortest shadow), which the morning or the afternoon, and which has the longest
shadow.

Every shadow's length comes from a straight ray from the light past the top of the object: h × d / (H − h) for an
object h high, a light H high and d across. The outlines and the drawn shadows are that long.
"""
from __future__ import annotations

import math
import random

from matplotlib.patches import Circle, FancyBboxPatch, Polygon, Rectangle

from ..core import FILL, FILL_2, INK, NAMES, mcq, new_figure

ID = "shadows_p"
KIND = "physics.ray"
SUBJECT = "science"
BANDS = ("P",)
CONCEPTS = ("science.shadow", "science.light-propagation")
# A topic whose sections the book lists is reached only if one names shadows or how light travels, or asks whether
# the Sun moves (where the flagpole's shadows over a day are taught).
NEEDS = r"shadow|propagation|does the sun move"


def avoid_for(p: dict) -> str | None:
    """Only the Sun over a day belongs in a unit on the Earth's movements; a lamp's shadow does not."""
    return None if p["kind"] == "sun" else r"earth'?s movements"

HEIGHT = {"stick": 1.5, "child": 1.5, "tree": 2.0}
NOON = 5.4  # how high the noon Sun is drawn over the flagpole
GROUND = "#e9ecef"
SHADE = "#7d858c"  # a drawn shadow


def stages(p: dict) -> tuple[int, int] | None:
    return (4, 6) if p["level"] == "upper" else None


def _length(h: float, d: float, H: float) -> float:
    return h * d / (H - h)


def _side(rng: random.Random, level: str) -> dict:
    obj = rng.choice(["stick", "child"] if level == "lower" else ["stick", "child", "tree"])
    light = "sun" if obj == "tree" else rng.choice(["lamp", "sun"])  # no tree stands in a dark room
    h = HEIGHT[obj]
    while True:
        d = rng.choice([3.0, 3.5, 4.0])
        H = rng.choice([3.5, 4.0, 4.5, 5.0]) if light == "lamp" else rng.choice([4.0, 4.5, 5.0])
        L = _length(h, d, H)
        if 1.4 <= L <= d - 0.7:
            break
    s = rng.choice([-1, 1])  # the light's side
    gap = 0.2  # the outlines next to the object start just clear of it
    spans = [[-s * gap, -s * L], [s * gap, s * L], [s * (d + 0.55), s * (d + 0.55 + L)]]
    spans = [sorted(sp) for sp in spans]
    letters = rng.sample("ABC", 3)
    return {"band": "P", "level": level, "kind": "side", "light": light, "object": obj, "s": s, "d": d, "H": H, "h": h,
            "spots": {k: sp for k, sp in sorted(zip(letters, spans))}}


def _height(rng: random.Random, level: str) -> dict:
    n = 2 if level == "lower" else 3
    while True:
        hs = rng.sample([2, 3, 4, 5, 6], n)
        Ls = sorted(_length(1, 2, H) for H in hs)
        if all(b >= 1.5 * a for a, b in zip(Ls, Ls[1:])):
            break
    return {"band": "P", "level": level, "kind": "height", "h": 1, "d": 2, "heights": hs, "s": rng.choice([-1, 1])}


def _sun(rng: random.Random) -> dict:
    h, R = 2.0, 2.6  # the morning and afternoon Suns, R from the top of the pole along the ray
    while True:
        Lm, La = rng.sample([1.5, 2.0, 2.5, 3.0], 2)
        if max(Lm, La) >= 1.3 * min(Lm, La):
            break
    suns = {}
    for when, L, east in (("morning", Lm, 1), ("afternoon", La, -1)):
        r = math.hypot(L, h)
        suns[when] = [east * R * L / r, h + R * h / r]
    suns["noon"] = [0.0, NOON]  # overhead, and plainly higher than either
    order = rng.sample(["morning", "noon", "afternoon"], 3)
    width = 7.2
    return {"band": "P", "level": "upper", "kind": "sun", "h": h, "place": rng.choice(PLACES),
            "suns": {k: suns[w] for k, w in zip("ABC", order)}, "times": {k: w for k, w in zip("ABC", order)},
            "centres": {k: i * width for i, k in enumerate("ABC")}}


def sample(rng: random.Random) -> dict:
    level = rng.choice(["lower", "upper"])
    kind = rng.choice(["side", "height"] if level == "lower" else ["side", "height", "sun"])
    if kind == "side":
        return _side(rng, level)
    if kind == "height":
        return _height(rng, level)
    return _sun(rng)


# --- drawing ---------------------------------------------------------------------------------------------

def _ground(ax, x0, x1):
    ax.add_patch(Rectangle((x0, -0.95), x1 - x0, 0.95, facecolor=GROUND, edgecolor="none", zorder=0))
    ax.plot([x0, x1], [0, 0], color=INK, linewidth=1.6, zorder=1)


def _lamp(ax, x, H):
    """A lamp on a stand: the bulb at (x, H) under its shade, the stand down to the ground."""
    ax.add_patch(Rectangle((x - 0.35, 0), 0.7, 0.12, facecolor=FILL, edgecolor=INK, linewidth=1.2, zorder=3))
    ax.plot([x, x], [0.12, H - 0.16], color=INK, linewidth=2.2, zorder=3)
    ax.add_patch(Polygon([(x - 0.48, H + 0.06), (x + 0.48, H + 0.06), (x + 0.26, H + 0.46), (x - 0.26, H + 0.46)], closed=True,
                         facecolor=FILL, edgecolor=INK, linewidth=1.3, zorder=4))
    ax.add_patch(Circle((x, H), 0.16, facecolor="white", edgecolor=INK, linewidth=1.4, zorder=5))
    for a in (200, 235, 270, 305, 340):
        t = math.radians(a)
        ax.plot([x + 0.25 * math.cos(t), x + 0.45 * math.cos(t)], [H + 0.25 * math.sin(t), H + 0.45 * math.sin(t)],
                color=INK, linewidth=1.2, zorder=3)


def _sun_at(ax, x, y):
    ax.add_patch(Circle((x, y), 0.36, facecolor="#f2f2f2", edgecolor=INK, linewidth=1.6, zorder=4))
    for i in range(8):
        t = math.radians(45 * i + 22.5)
        ax.plot([x + 0.46 * math.cos(t), x + 0.66 * math.cos(t)], [y + 0.46 * math.sin(t), y + 0.66 * math.sin(t)],
                color=INK, linewidth=1.3, zorder=4)


def _thing(ax, kind, x, h):
    """A stick, a child or a tree standing at x, h high."""
    if kind == "stick":
        ax.add_patch(Rectangle((x - 0.06, 0), 0.12, h, facecolor="#8b7d6b", edgecolor=INK, linewidth=1.2, zorder=3))
    elif kind == "tree":
        ax.add_patch(Rectangle((x - 0.12, 0), 0.24, 1.0, facecolor="#8b7d6b", edgecolor=INK, linewidth=1.2, zorder=3))
        ax.add_patch(Circle((x, h - 0.55), 0.55, facecolor="#b9c4b0", edgecolor=INK, linewidth=1.4, zorder=4))
    else:  # a child, h high: legs, body, arms, head
        ax.plot([x - 0.14, x, x + 0.14], [0, 0.62, 0], color=INK, linewidth=2.2, zorder=3)
        ax.add_patch(Rectangle((x - 0.15, 0.6), 0.3, 0.52, facecolor=FILL_2, edgecolor=INK, linewidth=1.3, zorder=4))
        ax.plot([x - 0.36, x - 0.15], [0.72, 1.05], color=INK, linewidth=2.0, zorder=3)
        ax.plot([x + 0.36, x + 0.15], [0.72, 1.05], color=INK, linewidth=2.0, zorder=3)
        ax.add_patch(Circle((x, h - 0.19), 0.19, facecolor="white", edgecolor=INK, linewidth=1.4, zorder=4))


def _outline(ax, a, b, gid):
    ax.add_patch(FancyBboxPatch((a, 0.02), b - a, 0.22, boxstyle="round,pad=0,rounding_size=0.1", facecolor="none",
                                edgecolor=INK, linewidth=1.5, linestyle=(0, (3, 2)), gid=gid, zorder=2))


def _draw_side(p: dict):
    s, d, H, L = p["s"], p["d"], p["H"], _length(p["h"], p["d"], p["H"])
    far = d + 0.55 + L + 0.35
    x0, x1 = (-far, L + 0.6) if s < 0 else (-(L + 0.6), far)
    top = H + (0.75 if p["light"] == "sun" else 0.55)
    width, height = x1 - x0, top + 0.95
    scale = min(7.0 / width, 0.62)
    fig, ax = new_figure(scale * width, scale * height)
    _ground(ax, x0, x1)
    if p["light"] == "lamp":
        _lamp(ax, s * d, H)
    else:
        _sun_at(ax, s * d, H)
    for k, (a, b) in p["spots"].items():
        _outline(ax, a, b, f"spot-{k}")
        ax.text((a + b) / 2, -0.47, k, ha="center", va="center", fontsize=15, fontweight="bold")
    _thing(ax, p["object"], 0, p["h"])
    ax.set_xlim(x0, x1)
    ax.set_ylim(-0.95, top)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def _draw_height(p: dict):
    hs, s, d = p["heights"], p["s"], p["d"]
    pw = 5.2  # one drawing's width
    top = max(hs) + 0.75
    fig, ax = new_figure(0.42 * pw * len(hs), 0.42 * (top + 1.6))
    for i, H in enumerate(hs):
        c = i * pw + (1.4 if s > 0 else pw - 1.4)  # the stick, with the lamp d across from it
        lamp = c + s * d
        _ground(ax, i * pw + 0.1, (i + 1) * pw - 0.1)
        _lamp(ax, lamp, H)
        _thing(ax, "stick", c, p["h"])
        # how high the lamp is, measured beside its stand on the side away from the stick
        mx = lamp + s * 0.75
        ax.annotate("", xy=(mx, H), xytext=(mx, 0), arrowprops=dict(arrowstyle="<|-|>", color=INK, lw=1.2, shrinkA=0, shrinkB=0,
                                                                       mutation_scale=10))
        ax.text(mx + s * 0.18, H / 2, f"{H} m", ha="left" if s > 0 else "right", va="center", fontsize=11,
                bbox=dict(facecolor="white", edgecolor="none", pad=1.0))
        ax.text(c - s * 0.22, p["h"] / 2, f"{p['h']} m", ha="right" if s > 0 else "left", va="center", fontsize=10)
        ax.text(c + s * d / 2, -1.25, f"Drawing {i + 1}", ha="center", va="center", fontsize=12, fontweight="bold")
    ax.set_xlim(0, pw * len(hs))
    ax.set_ylim(-1.6, top)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def _draw_sun(p: dict):
    h = p["h"]
    half = 3.45
    fig, ax = new_figure(9.0, 3.0)
    for k, (sx, sy) in p["suns"].items():
        c = p["centres"][k]
        _ground(ax, c - half, c + half)
        if sx == 0:
            ax.add_patch(FancyBboxPatch((c - 0.3, 0.0), 0.6, 0.16, boxstyle="round,pad=0,rounding_size=0.07", facecolor=SHADE,
                                        edgecolor="none", gid=f"shadow-{k}", zorder=2))
        else:
            L = _length(h, abs(sx), sy)
            a, b = sorted([c, c - math.copysign(L, sx)])
            ax.add_patch(Rectangle((a, 0.0), b - a, 0.16, facecolor=SHADE, edgecolor="none", gid=f"shadow-{k}", zorder=2))
        _sun_at(ax, c + sx, sy)
        ax.add_patch(Rectangle((c - 0.06, 0), 0.12, h, facecolor="#b0b0b0", edgecolor=INK, linewidth=1.2, zorder=3))
        ax.add_patch(Polygon([(c + 0.06, h - 0.02), (c + 0.06, h - 0.42), (c + 0.62, h - 0.22)], closed=True, facecolor=FILL_2,
                             edgecolor=INK, linewidth=1.1, zorder=3))
        ax.text(c - half + 0.1, -0.5, "West", ha="left", va="center", fontsize=10)
        ax.text(c + half - 0.1, -0.5, "East", ha="right", va="center", fontsize=10)
        ax.text(c, -0.5, k, ha="center", va="center", fontsize=15, fontweight="bold")
    last = max(p["centres"].values())
    ax.set_xlim(-half, last + half)
    ax.set_ylim(-0.95, NOON + 0.75)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def draw(p: dict):
    return {"side": _draw_side, "height": _draw_height, "sun": _draw_sun}[p["kind"]](p)


# --- questions -------------------------------------------------------------------------------------------

LAMP_SETTINGS = ["in a dark classroom in Huye", "in the science room in Musanze", "at home in Kigali one evening",
                 "in the school hall in Rubavu", "in a dark room in Nyanza"]
SUN_SETTINGS = ["at a school in Huye", "in a garden in Musanze", "on a football field in Kigali", "by the market in Nyagatare",
                "near Lake Kivu in Rubavu"]
PLACES = ["Huye", "Musanze", "Kigali", "Rubavu", "Nyagatare", "Nyanza"]
OBJECT_WORDS = {"stick": "stick", "child": "child", "tree": "tree"}


def _side_questions(p, rng, name, friend):
    obj = OBJECT_WORDS[p["object"]]
    s = p["s"]
    away = next(k for k, (a, b) in p["spots"].items() if (a + b) * s < 0)
    mirror = next(k for k, (a, b) in p["spots"].items() if (a + b) * s > 0 and min(abs(a), abs(b)) < 0.5)
    beyond = next(k for k in p["spots"] if k not in (away, mirror))
    if p["light"] == "lamp":
        first = f"{name} {rng.choice(['sets up', 'puts', 'places'])} a lamp near a {obj} {rng.choice(LAMP_SETTINGS)}."
        later = (f"{friend} moves the lamp to the other side of the {obj}, just as high and just as far away. "
                 "Which outline shows the shadow now?")
    else:
        first = f"{name} {rng.choice(['looks at', 'draws', 'watches'])} a {obj} in the sunshine {rng.choice(SUN_SETTINGS)}."
        later = f"Later the Sun is just as high, on the other side of the {obj}. Which outline shows the shadow then?"
    ask = rng.choice([f"Which outline shows where the {obj}'s shadow will fall?",
                      f"Where will the shadow of the {obj} be: A, B or C?"])
    return [mcq(f"{first} {ask}", away, [mirror, beyond], rng),
            mcq(later, mirror, [away, beyond], rng)]


def _height_questions(p, rng, name, friend):
    hs = p["heights"]
    Ls = [_length(p["h"], p["d"], H) for H in hs]
    n = len(hs)
    drawings = [f"Drawing {i + 1}" for i in range(n)]
    same = "They are the same length" if n == 2 else "They are all the same length"
    longest = max(range(n), key=lambda i: Ls[i])
    shortest = min(range(n), key=lambda i: Ls[i])
    first = (f"{name} {rng.choice(['sets up', 'tests', 'places'])} a lamp and a 1 m stick {rng.choice(LAMP_SETTINGS)}. "
             "The lamp is the same distance from the stick in each drawing.")
    word = "longer" if n == 2 else "longest"
    qs = [mcq(f"{first} In which drawing will the stick's shadow be {word}?", drawings[longest],
              [d for i, d in enumerate(drawings) if i != longest] + [same], rng)]
    if n == 3:
        qs.append(mcq("In which drawing will the shadow be shortest?", drawings[shortest],
                      [d for i, d in enumerate(drawings) if i != shortest] + [same], rng))
    a, b = rng.sample(range(n), 2)
    way = "It gets longer" if Ls[b] > Ls[a] else "It gets shorter"
    qs.append(mcq(f"{friend} moves the lamp from the height in drawing {a + 1} to the height in drawing {b + 1}. "
                  "What happens to the shadow?", way,
                  ["It gets shorter" if way == "It gets longer" else "It gets longer", "It stays the same length"], rng))
    return qs


def _sun_questions(p, rng, name, friend):
    times = p["times"]
    by_time = {w: k for k, w in times.items()}
    h = p["h"]
    Ls = {k: (0.0 if x == 0 else _length(h, abs(x), y)) for k, (x, y) in p["suns"].items()}
    longest = max(Ls, key=Ls.get)
    letters = sorted(times)
    opts = lambda key: (f"Drawing {key}", [f"Drawing {k}" for k in letters if k != key])  # noqa: E731
    first = (f"{name} {rng.choice(['draws', 'watches', 'records'])} the school flagpole in {p['place']} at three times "
             "on one sunny day.")
    when = rng.choice(["morning", "afternoon"])
    return [mcq(f"{first} Which drawing shows noon, in the middle of the day?", *opts(by_time["noon"]), rng),
            mcq(f"In which drawing is it {when}?", *opts(by_time[when]), rng),
            mcq("In which drawing is the shadow longest?", *opts(longest), rng)]


def questions(p: dict, rng: random.Random) -> list:
    name, friend = rng.sample(NAMES, 2)
    return {"side": _side_questions, "height": _height_questions, "sun": _sun_questions}[p["kind"]](p, rng, name, friend)
