"""Tropism experiments (LS, UP): seedlings lettered A to D in two kinds of investigation, drawn as textbooks draw them.

- light: four potted seedlings, one each lit from one side, in a box with a slit facing a lamp, with a foil cap over
  the tip and lit from one side, and a control lit evenly (from above, or turned on a clinostat beside a lamp);
- gravity: three or four germinating bean seedlings in the dark, pinned on their side, pinned upside down, and a
  control on its side on a turning clinostat.

Some seedlings are drawn after three days, the others at the start with a "?". What each does follows fixed rules: a
shoot bends towards light from one side unless its tip is covered; light from above, or a clinostat turning it, lights
it evenly, so it grows straight up; a shoot grows away from gravity and a root towards it, unless a clinostat turns
them, when both grow straight on.

Which way the shoot (or root) of a "?" seedling will grow; which seedling is the control; the response a drawn
seedling shows (positive or negative phototropism or gravitropism).
"""
from __future__ import annotations

import math
import random

from matplotlib.patches import Arc, Circle, Ellipse, Polygon, Rectangle

from ..core import FILL, FILL_2, INK, NAMES, mcq, new_figure

ID = "tropism_experiment"
KIND = "diagram.template"
SUBJECT = "biology"
BANDS = ("LS", "UP")
CONCEPTS = tuple(f"biology.{c}" for c in ("plant-responses", "auxins-shoot-growth"))
# A topic whose sections the book lists is reached only if one names tropisms or how plants respond.
NEEDS = r"tropism|plant responses?|responses? (?:and coordination )?in plants|coordination in plants|auxin|phytohormone|plant movements"

# Which way each set-up makes the shoot grow (light) or each organ grow (gravity): the fixed rules.
LIGHT = {"side": "towards", "slit": "towards", "foil": "up", "above": "up", "clinostat": "up"}
GRAVITY = {("flat", "shoot"): "up", ("flat", "root"): "down", ("upside", "shoot"): "up", ("upside", "root"): "down",
           ("clinostat", "shoot"): "on", ("clinostat", "root"): "on"}
CONTROL = {"light": ("above", "clinostat"), "gravity": ("clinostat",)}
CAPTION = {"light": {"side": "light from one side", "slit": "box with a slit,\nlamp outside",
                     "foil": "foil cap on the tip,\nlight from one side", "above": "light from above",
                     "clinostat": "turning clinostat,\nlight from one side"},
           "gravity": {"flat": "pinned on its side", "upside": "pinned upside down",
                       "clinostat": "on its side on a\nturning clinostat"}}
WAYS = {"light": ["bends to the left", "bends to the right", "grows straight up"],
        "gravity": ["curves upwards", "curves downwards", "keeps growing straight"]}
GAP = 3.3  # from one seedling's centre to the next
SCALE = 0.54
SOIL = 1.25
LAMP_Y = 3.6  # a lamp at the side, level with the rays' middle
SLIT = (3.3, 3.9)


def way(mode: str, pot: dict, organ: str = "shoot") -> str:
    """The answer, in the words of the options."""
    if mode == "light":
        r = LIGHT[pot["setup"]]
        return f"bends to the {pot['side']}" if r == "towards" else "grows straight up"
    return {"up": "curves upwards", "down": "curves downwards", "on": "keeps growing straight"}[GRAVITY[(pot["setup"], organ)]]


def sample(rng: random.Random) -> dict:
    mode = rng.choice(["light", "gravity"])
    if mode == "light":
        pots = [{"setup": s, "side": rng.choice(["left", "right"])} for s in ("side", "slit", "foil")]
        pots.append({"setup": rng.choice(CONTROL["light"]), "side": rng.choice(["left", "right"])})
        for x in pots:
            if x["setup"] == "above":
                x["side"] = "above"
        bending = ("side", "slit")
    else:
        others = rng.sample([("flat", "left"), ("flat", "right"), ("upside", "down")], rng.choice([2, 3]))
        pots = [{"setup": s, "side": d} for s, d in others] + [{"setup": "clinostat", "side": rng.choice(["left", "right"])}]
        bending = ("flat", "upside")
    rng.shuffle(pots)
    if mode == "light":
        # No two lamps back to back between neighbours (whose would be whose?): a lamp on the right of one seedling
        # means none on the left of the next. Then half the figures are mirrored, so neither side is favoured.
        for a, b in zip(pots, pots[1:]):
            if a["side"] == "right" and b["side"] == "left":
                b["side"] = "right"
        if rng.random() < 0.5:
            pots.reverse()
            for x in pots:
                x["side"] = {"left": "right", "right": "left"}.get(x["side"], x["side"])
    # One seedling that responds is drawn after three days (its response is asked); at least one other is not.
    shown = rng.choice([i for i, x in enumerate(pots) if x["setup"] in bending])
    for i, x in enumerate(pots):
        x["letter"] = "ABCD"[i]
        x["shown"] = i == shown or rng.random() < 0.3
    if all(x["shown"] for x in pots):
        rng.choice([x for i, x in enumerate(pots) if i != shown])["shown"] = False
    return {"band": rng.choice(BANDS), "mode": mode, "pots": pots}


# --- drawing --------------------------------------------------------------------------------------

def _bezier(p0, c, p1, n=24):
    return [((1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * c[0] + t ** 2 * p1[0],
             (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * c[1] + t ** 2 * p1[1]) for t in (k / n for k in range(n + 1))]


def _arc(centre, r, a0, a1, n=14):
    return [(centre[0] + r * math.cos(math.radians(a0 + (a1 - a0) * k / n)),
             centre[1] + r * math.sin(math.radians(a0 + (a1 - a0) * k / n))) for k in range(n + 1)]


def _leaves(ax, pts, back: float = 0.0, size: float = 0.3) -> None:
    """Two small leaves where the shoot ends, or `back` units below its end (under a foil cap)."""
    k = len(pts) - 1
    x1, y1 = pts[k]
    while back > 0 and k > 0:
        (x0, y0) = pts[k - 1]
        seg = math.hypot(x1 - x0, y1 - y0)
        if seg >= back:
            x1, y1 = x1 + (x0 - x1) * back / seg, y1 + (y0 - y1) * back / seg
            break
        back -= seg
        k -= 1
        x1, y1 = pts[k]
    (x0, y0) = pts[max(k - 1, 0)] if k > 0 else pts[0]
    ang = math.degrees(math.atan2(y1 - y0, x1 - x0)) if (x1, y1) != (x0, y0) else 90.0
    for turn in (40, -40):
        a = math.radians(ang + turn)
        ax.add_patch(Ellipse((x1 + math.cos(a) * size * 0.45, y1 + math.sin(a) * size * 0.45), size, size * 0.38,
                             angle=ang + turn, facecolor="white", edgecolor=INK, linewidth=1.1, zorder=4))


def _lamp(ax, letter, x, y, toward) -> None:
    """A lamp: a bulb on a little cap, and three rays (arrows) running from it the way `toward` points."""
    ax.add_patch(Circle((x, y), 0.17, facecolor="white", edgecolor=INK, linewidth=1.3, zorder=3, gid=f"lamp:{letter}"))
    dx, dy = toward
    ax.add_patch(Rectangle((x - dx * 0.21 - 0.07, y - dy * 0.21 - 0.07), 0.14, 0.14,
                           facecolor=FILL, edgecolor=INK, linewidth=1.0, zorder=2))
    nx, ny = -dy, dx
    for k in (-1, 0, 1):
        sx, sy = x + dx * 0.27 + nx * 0.2 * k, y + dy * 0.27 + ny * 0.2 * k
        ax.annotate("", xy=(sx + dx * 0.36, sy + dy * 0.36), xytext=(sx, sy),
                    arrowprops={"arrowstyle": "-|>", "color": INK, "linewidth": 1.0, "mutation_scale": 9,
                                "shrinkA": 0, "shrinkB": 0})


def _shoot_light(cx: float, pot: dict) -> list:
    base = (cx, SOIL)
    if not pot["shown"]:
        return [base, (cx, SOIL + 0.95)]
    if LIGHT[pot["setup"]] == "up":
        return [base, (cx, SOIL + 1.45), (cx, SOIL + 1.9)]
    s = -1 if pot["side"] == "left" else 1
    return _bezier(base, (cx, SOIL + 1.15), (cx + s * 0.55, SOIL + 1.75))


def _draw_light(ax, cx: float, pot: dict) -> float:
    L = pot["letter"]
    setup = pot["setup"]
    s = -1 if pot["side"] == "left" else 1
    if setup == "slit":  # a dark box round the pot, open only at a slit facing the lamp
        x0, x1, y0, y1 = cx - 0.8, cx + 0.8, 0.3, 4.15
        ax.add_patch(Rectangle((x0, y0), x1 - x0, y1 - y0, facecolor=FILL_2, edgecolor="none", zorder=0))
        wall, other = (x0, x1) if s < 0 else (x1, x0)
        # The walls all round, broken only by the slit in the wall facing the lamp.
        ax.plot([wall, wall, other, other, wall, wall], [SLIT[1], y1, y1, y0, y0, SLIT[0]], color=INK, linewidth=2.2,
                zorder=1)
    if setup == "clinostat":  # the pot stands on a plate a motor turns slowly
        ax.add_patch(Rectangle((cx - 0.7, 0.33), 1.4, 0.1, facecolor=FILL, edgecolor=INK, linewidth=1.0, zorder=2))
        ax.plot([cx, cx], [0.12, 0.33], color=INK, linewidth=2.0, zorder=1)
        ax.add_patch(Rectangle((cx - 0.4, 0.0), 0.8, 0.12, facecolor=FILL, edgecolor=INK, linewidth=1.0, zorder=2))
        ax.text(cx + 0.62, 0.15, "↻", ha="center", va="center", fontsize=17)  # turning
    # The pot and its soil.
    ax.add_patch(Polygon([(cx - 0.4, 0.45), (cx + 0.4, 0.45), (cx + 0.55, SOIL), (cx - 0.55, SOIL)], closed=True,
                         facecolor="white", edgecolor=INK, linewidth=1.3, zorder=2))
    ax.add_patch(Polygon([(cx - 0.53, SOIL - 0.13), (cx + 0.53, SOIL - 0.13), (cx + 0.55, SOIL), (cx - 0.55, SOIL)],
                         closed=True, facecolor=FILL, edgecolor=INK, linewidth=1.0, zorder=2))
    pts = _shoot_light(cx, pot)
    xs, ys = zip(*pts)
    ax.plot(xs, ys, color=INK, linewidth=2.4, zorder=3, solid_capstyle="round", gid=f"shoot:{L}")
    if setup == "foil":
        _leaves(ax, pts, 0.38, 0.26)
        (x0, y0), (x1, y1) = pts[-2], pts[-1]
        d = math.hypot(x1 - x0, y1 - y0)
        ux, uy = (x1 - x0) / d, (y1 - y0) / d
        # A cap over the last bit of the shoot: straight sides, a rounded top, open at the bottom.
        nx, ny = -uy, ux
        w, back = 0.09, 0.2
        cap = [(x1 - ux * back + nx * w, y1 - uy * back + ny * w)]
        for k in range(13):
            a = math.pi * k / 12
            cap.append((x1 + nx * w * math.cos(a) + ux * w * math.sin(a), y1 + ny * w * math.cos(a) + uy * w * math.sin(a)))
        cap.append((x1 - ux * back - nx * w, y1 - uy * back - ny * w))
        ax.add_patch(Polygon(cap, closed=True, facecolor="#555555", edgecolor=INK, linewidth=1.0, zorder=5))
    else:
        _leaves(ax, pts)
    if setup == "above":
        _lamp(ax, L, cx, 4.35, (0, -1))
    else:
        _lamp(ax, L, cx + s * (1.22 if setup == "slit" else 1.18), LAMP_Y, (-s, 0))
    if not pot["shown"]:
        ax.text(cx, SOIL + 1.45, "?", ha="center", va="center", fontsize=15, fontweight="bold", gid=f"ask:{L}")
    return -0.3


def _gravity_parts(c, pot):
    """The shoot's and the root's paths, from the seed out."""
    cx, cy = c
    setup, side = pot["setup"], pot["side"]
    if setup == "upside":
        s0, r0 = (cx, cy - 0.23), (cx, cy + 0.23)
        if not pot["shown"]:
            return [s0, (cx, cy - 0.7)], [r0, (cx, cy + 0.65)]
        p1, q1 = (cx, cy - 0.38), (cx, cy + 0.38)
        shoot = [s0] + _arc((p1[0] + 0.22, p1[1]), 0.22, 180, 360) + [(cx + 0.44, cy - 0.12)]
        root = [r0] + _arc((q1[0] - 0.22, q1[1]), 0.22, 0, 180) + [(cx - 0.44, cy + 0.12)]
        return shoot, root
    d = -1 if side == "left" else 1  # the way the shoot points
    s0, r0 = (cx + d * 0.23, cy), (cx - d * 0.23, cy)
    if not pot["shown"]:
        return [s0, (cx + d * 0.7, cy)], [r0, (cx - d * 0.62, cy)]
    if setup == "clinostat":
        return [s0, (cx + d * 0.95, cy)], [r0, (cx - d * 0.88, cy)]
    # On along the way it points, then a quarter turn: the shoot up, the root down.
    p1, q1 = cx + d * 0.42, cx - d * 0.4
    shoot = [s0] + _arc((p1, cy + 0.3), 0.3, -90, -180 if d < 0 else 0) + [(p1 + d * 0.3, cy + 0.55)]
    root = [r0] + _arc((q1, cy - 0.3), 0.3, 90, 0 if d < 0 else 180) + [(q1 - d * 0.3, cy - 0.55)]
    return shoot, root


def _draw_gravity(ax, cx: float, pot: dict) -> float:
    L = pot["letter"]
    c = (cx, 2.3)
    if pot["setup"] == "clinostat":  # a cork disc on an axle a motor turns slowly, on a stand
        ax.plot([cx, cx], [0.3, 1.15], color=INK, linewidth=2.0, zorder=0)
        ax.add_patch(Rectangle((cx - 0.45, 0.18), 0.9, 0.12, facecolor=FILL, edgecolor=INK, linewidth=1.0, zorder=1))
        ax.add_patch(Circle(c, 1.15, facecolor=FILL_2, edgecolor=INK, linewidth=1.3, zorder=1))
        ax.add_patch(Circle(c, 0.06, facecolor=INK, edgecolor=INK, zorder=2))
        ax.add_patch(Arc(c, 2.6, 2.6, theta1=-35, theta2=35, color=INK, linewidth=1.2, zorder=1))
        a = math.radians(35)
        end = (cx + 1.3 * math.cos(a), 2.3 + 1.3 * math.sin(a))
        ax.annotate("", xy=(end[0] - 0.15 * math.sin(a), end[1] + 0.15 * math.cos(a)), xytext=end,
                    arrowprops={"arrowstyle": "-|>", "color": INK, "linewidth": 1.2, "mutation_scale": 10, "shrinkA": 0, "shrinkB": 0})
    else:  # a square of cork, standing still
        ax.add_patch(Rectangle((cx - 1.1, 1.2), 2.2, 2.2, facecolor=FILL_2, edgecolor=INK, linewidth=1.3, zorder=1))
    shoot, root = _gravity_parts(c, pot)
    for organ, pts, lw in (("root", root, 1.5), ("shoot", shoot, 2.4)):
        xs, ys = zip(*pts)
        ax.plot(xs, ys, color=INK, linewidth=lw, zorder=3, solid_capstyle="round", gid=f"{organ}:{L}")
    _leaves(ax, shoot, 0.0, 0.24)
    ang = 90 if pot["setup"] == "upside" else 0
    ax.add_patch(Ellipse(c, 0.5, 0.32, angle=ang, facecolor=FILL, edgecolor=INK, linewidth=1.2, zorder=4))
    # Names beside where each organ leaves the seed, on the side it does not turn to.
    if pot["setup"] == "upside" and pot["shown"]:  # under the shoot's U, over the root's
        ax.text(cx + 0.22, 2.3 - 0.85, "shoot", ha="center", va="center", fontsize=8.5, zorder=5)
        ax.text(cx - 0.22, 2.3 + 0.85, "root", ha="center", va="center", fontsize=8.5, zorder=5)
    elif pot["setup"] == "upside":
        ax.text(cx - 0.36, 2.3 - 0.42, "shoot", ha="right", va="center", fontsize=8.5, zorder=5)
        ax.text(cx + 0.36, 2.3 + 0.42, "root", ha="left", va="center", fontsize=8.5, zorder=5)
    else:
        d = -1 if pot["side"] == "left" else 1
        ax.text(cx + d * 0.55, 2.3 - 0.3, "shoot", ha="center", va="center", fontsize=8.5, zorder=5)
        ax.text(cx - d * 0.5, 2.3 + 0.3, "root", ha="center", va="center", fontsize=8.5, zorder=5)
    if not pot["shown"]:
        ax.text(cx, 3.75, "?", ha="center", va="center", fontsize=15, fontweight="bold", gid=f"ask:{L}")
    return -0.05


def draw(p: dict):
    fig, ax = new_figure()
    n = len(p["pots"])
    for i, pot in enumerate(p["pots"]):
        cx = 1.6 + i * GAP
        top = (_draw_light if p["mode"] == "light" else _draw_gravity)(ax, cx, pot)
        ax.text(cx, top, pot["letter"], ha="center", va="top", fontsize=13, fontweight="bold", gid=f"pot:{pot['letter']}")
        ax.text(cx, top - 0.42, CAPTION[p["mode"]][pot["setup"]], ha="center", va="top", fontsize=8.5, linespacing=1.2)
    width = 3.2 + (n - 1) * GAP
    head = ("Seedlings marked ? are drawn at the start; the others after three days." if p["mode"] == "light" else
            "All the seedlings are kept in the dark. Seedlings marked ? are drawn\nat the start; the others after three days.")
    y1 = 5.05 if p["mode"] == "light" else 4.75
    ax.text(width / 2, y1 - 0.05, head, ha="center", va="top", fontsize=9, linespacing=1.25)
    ylim = (-1.35, y1 + (0.05 if p["mode"] == "light" else 0.35))
    ax.set_xlim(0, width)
    ax.set_ylim(*ylim)
    ax.set_aspect("equal")
    ax.axis("off")
    fig.set_size_inches(SCALE * width, SCALE * (ylim[1] - ylim[0]))
    ax.set_position([0, 0, 1, 1])
    return fig


# --- questions ------------------------------------------------------------------------------------

SETTINGS = ["in the school lab in Huye", "at the science club", "for a project on plant growth", "in a biology lesson",
            "on a farm school near Musanze", "for a class investigation in Rubavu"]
PLANTS = {"light": ["bean", "maize", "sunflower"], "gravity": ["bean"]}


def questions(p: dict, rng: random.Random) -> list:
    mode = p["mode"]
    pots = {x["letter"]: x for x in p["pots"]}
    who = rng.choice(NAMES)
    plant = rng.choice(PLANTS[mode])
    n = len(pots)
    if mode == "light":
        lead = (f"{who} set up {n} {plant} seedlings {rng.choice(SETTINGS)} to find out how shoots respond to light "
                "from one side. Seedlings marked ? are drawn at the start; the others after three days.")
    else:
        lead = (f"{who} pinned {n} germinating {plant} seeds to cork {rng.choice(SETTINGS)} to find out how roots and "
                "shoots respond to gravity, and kept them in the dark. Seedlings marked ? are drawn at the start.")
    hidden = sorted(L for L, x in pots.items() if not x["shown"])
    tests = [L for L in hidden if pots[L]["setup"] not in CONTROL[mode]]
    target = rng.choice(tests or hidden)
    organ = "shoot" if mode == "light" else rng.choice(["shoot", "root"])
    right = way(mode, pots[target], organ)
    qs = [mcq(f"{lead} Which way will the {organ} of seedling {target} grow?", right,
              [w for w in WAYS[mode] if w != right], rng)]
    control = next(L for L, x in pots.items() if x["setup"] in CONTROL[mode])
    qs.append(mcq("Which seedling is the control?", control, [L for L in sorted(pots) if L != control], rng))
    bent = sorted(L for L, x in pots.items() if x["shown"] and x["setup"] not in CONTROL[mode]
                  and (mode == "gravity" or LIGHT[x["setup"]] == "towards"))
    seen = rng.choice(bent)
    organ2 = "shoot" if mode == "light" else rng.choice(["shoot", "root"])
    w = way(mode, pots[seen], organ2)
    key = ("positive phototropism" if mode == "light" else
           "negative gravitropism" if w == "curves upwards" else "positive gravitropism")
    names = [f"{a} {b}" for a in ("positive", "negative") for b in ("phototropism", "gravitropism")]
    qs.append(mcq(f"Which response does the {organ2} of seedling {seen} show?", key, [x for x in names if x != key], rng))
    return qs
