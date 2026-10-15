"""Tropism experiments (LS, UP): seedlings lettered A to D in two kinds of investigation, drawn as textbooks draw them.

- light: four potted seedlings, each lit from one side, in a box with a slit facing a lamp, with a foil cap (labelled)
  over its tip and lit from one side, lit from above, or turned on a clinostat beside a lamp (two may both be lit from
  one side, from opposite sides);
- gravity: three or four germinating bean seeds in the dark, pinned to squares of cork on their side or upside down,
  or pinned on their side to a cork disc on a turning clinostat.

Some seedlings are drawn after three days, the others at the start with a "?". What each does follows fixed rules: a
shoot bends towards light from one side unless its tip is covered; light from above, or a clinostat turning it, lights
it evenly, so it grows straight up; a shoot grows away from gravity and a root towards it, unless a clinostat turns
them, when both grow straight on. The first question says exactly what was set up: how many seedlings, and how many
were pinned still and how many turned.

Which way the shoot (or root) of a "?" seedling will grow; how many of the seedlings will bend to one side (or turn to
grow up or down) by the rules, drawn or not; the response a drawn seedling shows (positive or negative phototropism or
gravitropism). No "which is the control?": what a control is depends on what is tested, and the p3w blind review
found several seedlings each arguable.
"""
from __future__ import annotations

import math
import random

from matplotlib.patches import Arc, Circle, Ellipse, Polygon, Rectangle

from ..core import FILL, FILL_2, INK, NAMES, count, mcq, new_figure

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
WORD = {1: "one", 2: "two", 3: "three", 4: "four"}
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
# The slit in a box: a clear gap at the shoot's height, the lamp level with it (p3w-fix review: a slit up by the lid
# was not seen, and the rays hit the wall above the seedling).
SLIT = (SOIL + 0.85, SOIL + 1.55)
# The tropisms a question may name, by the set-up: never phototropism and gravitropism side by side, since a shoot that
# grows up and bends to light fits both (p3w-fix review). The stem names the stimulus.
TROPISMS = {"light": ("phototropism", "hydrotropism"), "gravity": ("gravitropism", "hydrotropism")}
NOTE = "Seedlings marked ? are shown at the start, before they grow; the others are shown after three days."


def way(mode: str, pot: dict, organ: str = "shoot") -> str:
    """The answer, in the words of the options."""
    if mode == "light":
        r = LIGHT[pot["setup"]]
        return f"bends to the {pot['side']}" if r == "towards" else "grows straight up"
    return {"up": "curves upwards", "down": "curves downwards", "on": "keeps growing straight"}[GRAVITY[(pot["setup"], organ)]]


def sample(rng: random.Random) -> dict:
    mode = rng.choice(["light", "gravity"])
    if mode == "light":
        # Four seedlings from these set-ups (two may both be lit from one side), at least one of them bending.
        while True:
            setups = rng.sample(["side", "side", "slit", "foil", "above", "clinostat"], 4)
            if any(x in ("side", "slit") for x in setups):
                break
        pots = [{"setup": x, "side": "above" if x == "above" else rng.choice(["left", "right"])} for x in setups]
        bending = ("side", "slit")
    else:
        # Three or four seeds, at least one pinned still (so one turns to grow up and down).
        while True:
            picks = rng.sample([("flat", "left"), ("flat", "right"), ("upside", "down"), ("clinostat", "left"),
                                ("clinostat", "right")], rng.choice([3, 4]))
            if any(x != "clinostat" for x, _ in picks):
                break
        pots = [{"setup": x, "side": d} for x, d in picks]
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


def _lamp(ax, letter, x, y, toward, reach: float = 0.36) -> None:
    """A lamp: a bulb on a little cap, and three rays (arrows) `reach` long running from it the way `toward` points."""
    ax.add_patch(Circle((x, y), 0.17, facecolor="white", edgecolor=INK, linewidth=1.3, zorder=3, gid=f"lamp:{letter}"))
    dx, dy = toward
    ax.add_patch(Rectangle((x - dx * 0.21 - 0.07, y - dy * 0.21 - 0.07), 0.14, 0.14,
                           facecolor=FILL, edgecolor=INK, linewidth=1.0, zorder=2))
    nx, ny = -dy, dx
    for k in (-1, 0, 1):
        sx, sy = x + dx * 0.27 + nx * 0.2 * k, y + dy * 0.27 + ny * 0.2 * k
        ax.annotate("", xy=(sx + dx * reach, sy + dy * reach), xytext=(sx, sy), gid=f"ray:{letter}:{k}",
                    arrowprops={"arrowstyle": "-|>", "color": INK, "linewidth": 1.0, "mutation_scale": 9,
                                "shrinkA": 0, "shrinkB": 0})


def _shoot_light(cx: float, pot: dict) -> list:
    base = (cx, SOIL)
    if not pot["shown"]:
        return [base, (cx, SOIL + 0.95)]
    if LIGHT[pot["setup"]] == "up":
        return [base, (cx, SOIL + 1.45), (cx, SOIL + 1.9)]
    s = -1 if pot["side"] == "left" else 1
    lean = 0.45 if pot["setup"] == "slit" else 0.55  # inside a box, clear of its wall
    return _bezier(base, (cx, SOIL + 1.15), (cx + s * lean, SOIL + 1.75))


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
                zorder=1, gid=f"wall:{L}")
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
        _leaves(ax, pts, 0.64, 0.26)
        (x0, y0), (x1, y1) = pts[-2], pts[-1]
        d = math.hypot(x1 - x0, y1 - y0)
        ux, uy = (x1 - x0) / d, (y1 - y0) / d
        # A cap over the last bit of the shoot, big enough to see as a cap: straight sides, a rounded top, open at
        # the bottom; labelled "foil" on the side away from the lamp (p3w blind review: too small, unlabelled).
        nx, ny = -uy, ux
        w, back = 0.14, 0.32
        cap = [(x1 - ux * back + nx * w, y1 - uy * back + ny * w)]
        for k in range(13):
            a = math.pi * k / 12
            cap.append((x1 + ux * 0.02 + nx * w * math.cos(a) + ux * w * math.sin(a),
                        y1 + uy * 0.02 + ny * w * math.cos(a) + uy * w * math.sin(a)))
        cap.append((x1 - ux * back - nx * w, y1 - uy * back - ny * w))
        ax.add_patch(Polygon(cap, closed=True, facecolor="#9ba3ab", edgecolor=INK, linewidth=1.2, zorder=5,
                             gid=f"cap:{L}"))
        ax.plot([x1 - s * 0.16, x1 - s * 0.42], [y1 - 0.12, y1 - 0.12], color=INK, linewidth=0.9, zorder=5)
        ax.text(x1 - s * 0.47, y1 - 0.12, "foil", ha="right" if s > 0 else "left", va="center", fontsize=9,
                zorder=5, gid=f"foil:{L}")
    else:
        _leaves(ax, pts)
    if setup == "above":
        _lamp(ax, L, cx, 4.35, (0, -1))
    elif setup == "slit":  # level with the slit, its rays running through it into the box
        _lamp(ax, L, cx + s * 1.22, sum(SLIT) / 2, (-s, 0), reach=0.53)
    else:
        _lamp(ax, L, cx + s * 1.18, LAMP_Y, (-s, 0))
    if not pot["shown"]:
        qx = cx - s * 0.2 if setup == "slit" else cx  # clear of the rays coming through a slit
        ax.text(qx, SOIL + 1.45, "?", ha="center", va="center", fontsize=15, fontweight="bold", gid=f"ask:{L}")
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
        return [s0, (cx + d * 0.78, cy)], [r0, (cx - d * 0.75, cy)]  # clear of the rim, leaves and all
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
        ax.add_patch(Circle(c, 1.15, facecolor=FILL_2, edgecolor=INK, linewidth=1.3, zorder=1, gid=f"disc:{L}"))
        ax.add_patch(Circle(c, 0.06, facecolor=INK, edgecolor=INK, zorder=2))
        ax.add_patch(Arc(c, 2.6, 2.6, theta1=-35, theta2=35, color=INK, linewidth=1.2, zorder=1))
        a = math.radians(35)
        end = (cx + 1.3 * math.cos(a), 2.3 + 1.3 * math.sin(a))
        ax.annotate("", xy=(end[0] - 0.15 * math.sin(a), end[1] + 0.15 * math.cos(a)), xytext=end,
                    arrowprops={"arrowstyle": "-|>", "color": INK, "linewidth": 1.2, "mutation_scale": 10, "shrinkA": 0, "shrinkB": 0})
    else:  # a square of cork, standing still
        ax.add_patch(Rectangle((cx - 1.1, 1.2), 2.2, 2.2, facecolor=FILL_2, edgecolor=INK, linewidth=1.3, zorder=1,
                               gid=f"board:{L}"))
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
    head = (NOTE if p["mode"] == "light" else
            "All the seedlings are kept in the dark. Seedlings marked ? are shown at the start,\n"
            "before they grow; the others are shown after three days.")
    y1 = 5.05 if p["mode"] == "light" else 4.75
    ax.text(width / 2, y1 - 0.05, head, ha="center", va="top", fontsize=9, linespacing=1.25, gid="note")
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
    # The set-up, said exactly as drawn.
    if mode == "light":
        lead = (f"{who} grew {WORD[n]} {plant} seedlings in pots {rng.choice(SETTINGS)} and lit them as shown, to find "
                "out how shoots respond to light. Seedlings marked ? are shown at the start, before they grow; the others "
                "after three days.")
    else:
        still = sum(x["setup"] != "clinostat" for x in pots.values())
        turned = n - still
        what = (f"{WORD[still]} germinating {plant} seed{'s' if still > 1 else ''} to "
                f"{'a square' if still == 1 else 'squares'} of cork")
        if turned:
            what += f" and {WORD[turned]} to " + ("a cork disc on a turning clinostat" if turned == 1 else
                                                  "cork discs on turning clinostats")
        lead = (f"{who} pinned {what} {rng.choice(SETTINGS)}, and kept them all in the dark. Seedlings marked ? are shown "
                "at the start, before they grow; the others after three days.")
    hidden = sorted(L for L, x in pots.items() if not x["shown"])
    target = rng.choice(hidden)
    organ = "shoot" if mode == "light" else rng.choice(["shoot", "root"])
    right = way(mode, pots[target], organ)
    qs = [mcq(f"{lead} Which way will the {organ} of seedling {target} grow?", right,
              [w for w in WAYS[mode] if w != right], rng)]
    # How many respond, by the rules, the drawn ones and the "?" ones alike.
    if mode == "light":
        k = sum(LIGHT[x["setup"]] == "towards" for x in pots.values())
        qs.append(count(f"Predict for every seedling, including those marked ?. After three days, how many of the "
                        f"{WORD[n]} seedlings will have shoots bending to one side?", k, "seedlings"))
    else:
        organ3 = rng.choice(["shoot", "root"])
        k = sum(GRAVITY[(x["setup"], organ3)] in ("up", "down") for x in pots.values())
        words = "roots turned to grow downwards" if organ3 == "root" else "shoots turned to grow upwards"
        qs.append(count(f"Predict for every seedling, including those marked ?. After three days, how many of the "
                        f"{WORD[n]} seedlings will have {words}?", k, "seedlings"))
    bent = sorted(L for L, x in pots.items() if x["shown"]
                  and (LIGHT[x["setup"]] == "towards" if mode == "light" else x["setup"] != "clinostat"))
    seen = rng.choice(bent)
    organ2 = "shoot" if mode == "light" else rng.choice(["shoot", "root"])
    w = way(mode, pots[seen], organ2)
    key = ("positive phototropism" if mode == "light" else
           "negative gravitropism" if w == "curves upwards" else "positive gravitropism")
    if mode == "light":
        said = f"Seedling {seen}'s shoot has bent towards the light. What is this response to light called?"
    else:
        said = (f"Seedling {seen}'s {organ2} has turned to grow {'upwards' if organ2 == 'shoot' else 'downwards'}. "
                "What is this response to gravity called?")
    names = [f"{a} {b}" for a in ("positive", "negative") for b in TROPISMS[mode]]
    qs.append(mcq(said, key, [x for x in names if x != key], rng))
    return qs
