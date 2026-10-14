"""Magnets (Primary). Two sub-types.

Poles: pairs of bar magnets laid end to end, lettered A to D, each end printed N or S. Which pairs attract (pull
together) and which repel (push apart), one pair's way, and how many. At the upper level one more pair has a
magnet whose facing end is marked "?" (its other end left blank and unshaded): the stem says whether that pair
pulls together or pushes apart, and the pupil names the hidden pole.

Objects: a magnet beside four to six everyday objects, each drawn simply, lettered and named with its material
where that matters (an iron nail, a copper coin, a plastic spoon). Which objects the magnet picks up, how many,
and (upper level) how many metal objects it does not pick up. What is magnetic comes from the table below, as a
Primary teacher teaches it: things made of iron or steel, and nothing else.
"""
from __future__ import annotations

import math
import random

from matplotlib.patches import Arc, Circle, Ellipse, FancyBboxPatch, Polygon, Rectangle, Wedge

from ..core import FILL, FILL_2, INK, NAMES, count, mcq, new_figure

ID = "magnets_p"
KIND = "physics.field"
SUBJECT = "science"
BANDS = ("P",)
CONCEPTS = ("science.magnetism", "science.magnetic-materials", "science.magnetic-properties")
# A topic whose sections the book lists is reached only if one names magnets.
NEEDS = r"magnet"

# Each object: is it a metal, and does a magnet pick it up? Iron and steel only.
OBJECTS = {
    "iron nail": (True, True), "paper clip": (True, True), "steel scissors": (True, True), "steel spoon": (True, True),
    "safety pin": (True, True),
    "copper coin": (True, False), "aluminium can": (True, False),
    "plastic spoon": (False, False), "eraser": (False, False), "wooden ruler": (False, False),
    "glass marble": (False, False), "wooden pencil": (False, False),
}
N_SHADE = "#c3c9cf"  # the N half of a magnet is shaded, as the red half is in a book


def stages(p: dict) -> tuple[int, int] | None:
    return (4, 6) if p["level"] == "upper" else None


def sample(rng: random.Random) -> dict:
    level = rng.choice(["lower", "upper"])
    if rng.random() < 0.5:
        n = 3 if level == "upper" else rng.choice([3, 4])
        while True:
            pairs = [{"letter": k, "left": rng.choice(["NS", "SN"]), "right": rng.choice(["NS", "SN"])} for k in "ABC"[:n] + ("D" if n == 4 else "")]
            pulls = [pr["left"][1] != pr["right"][0] for pr in pairs]
            if any(pulls) and not all(pulls):
                break
        hidden = None
        if level == "upper":
            pairs.append({"letter": "D", "left": rng.choice(["NS", "SN"]), "right": rng.choice(["NS", "SN"])})
            hidden = "D"
        return {"band": "P", "level": level, "kind": "poles", "pairs": pairs, "hidden": hidden}
    names = sorted(OBJECTS)
    while True:
        n = rng.choice([4, 5]) if level == "lower" else rng.choice([5, 6])
        chosen = rng.sample(names, n)
        picks = [o for o in chosen if OBJECTS[o][1]]
        metal_not = [o for o in chosen if OBJECTS[o][0] and not OBJECTS[o][1]]
        if picks and len(picks) < n and (metal_not or level == "lower"):
            break
    return {"band": "P", "level": level, "kind": "objects", "magnet": rng.choice(["bar", "horseshoe"]),
            "objects": [{"letter": "ABCDEF"[i], "name": o} for i, o in enumerate(chosen)]}


# --- drawing ---------------------------------------------------------------------------------------------

def _bar(ax, x, y, poles, w=3.0, h=0.8, hide=False):
    """A bar magnet from x to x + w: poles is "NS" or "SN", left end first. hide: the left end shows "?" and the
    right end nothing, both unshaded."""
    for i, pole in enumerate(poles):
        shade = "white" if hide else (N_SHADE if pole == "N" else "white")
        ax.add_patch(Rectangle((x + i * w / 2, y - h / 2), w / 2, h, facecolor=shade, edgecolor=INK, linewidth=1.8))
        label = ("?" if i == 0 else "") if hide else pole
        if label:
            ax.text(x + i * w / 2 + w / 4, y, label, ha="center", va="center", fontsize=15, fontweight="bold")


def _draw_poles(p: dict):
    pairs = p["pairs"]
    fig, ax = new_figure(5.2, 0.85 * len(pairs) + 0.3)
    for i, pr in enumerate(pairs):
        y = -1.5 * i
        ax.text(-0.75, y, pr["letter"], ha="center", va="center", fontsize=15, fontweight="bold")
        _bar(ax, 0, y, pr["left"])
        hide = pr["letter"] == p["hidden"]
        _bar(ax, 4.0, y, pr["right"], hide=hide)
    ax.set_xlim(-1.2, 7.2)
    ax.set_ylim(-1.5 * (len(pairs) - 1) - 0.65, 0.65)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def _object(ax, name, cx, cy):
    """Each object as a few plain shapes, about 2 units wide and 1 high."""
    if name == "iron nail":
        ax.add_patch(Polygon([(cx - 0.8, cy - 0.07), (cx + 0.6, cy - 0.07), (cx + 0.9, cy), (cx + 0.6, cy + 0.07), (cx - 0.8, cy + 0.07)],
                             closed=True, facecolor=FILL, edgecolor=INK, linewidth=1.3))
        ax.add_patch(Rectangle((cx - 0.92, cy - 0.22), 0.12, 0.44, facecolor=FILL, edgecolor=INK, linewidth=1.3))
    elif name == "paper clip":
        for w, h, dx in ((1.7, 0.55, 0), (1.25, 0.34, -0.1), (0.9, 0.16, 0.12)):
            ax.add_patch(FancyBboxPatch((cx - w / 2 + dx, cy - h / 2), w, h, boxstyle=f"round,pad=0,rounding_size={h / 2}",
                                        facecolor="none", edgecolor=INK, linewidth=1.8))
    elif name == "steel scissors":
        for sy in (1, -1):
            ax.add_patch(Circle((cx - 0.7, cy + sy * 0.25), 0.2, facecolor="white", edgecolor=INK, linewidth=1.6))
            ax.add_patch(Polygon([(cx - 0.52, cy + sy * 0.18), (cx - 0.2, cy + sy * 0.08), (cx + 0.9, cy - sy * 0.12),
                                  (cx - 0.2, cy - sy * 0.04)], closed=True, facecolor=FILL, edgecolor=INK, linewidth=1.2))
        ax.add_patch(Circle((cx - 0.12, cy + 0.02), 0.05, facecolor=INK, edgecolor=INK))
    elif name in ("steel spoon", "plastic spoon"):
        fill = FILL if name == "steel spoon" else "white"
        ax.add_patch(Rectangle((cx - 0.9, cy - 0.07), 1.1, 0.14, facecolor=fill, edgecolor=INK, linewidth=1.3))
        ax.add_patch(Ellipse((cx + 0.5, cy), 0.8, 0.5, facecolor=fill, edgecolor=INK, linewidth=1.5))
    elif name == "safety pin":
        ax.add_patch(Circle((cx - 0.72, cy), 0.13, facecolor="none", edgecolor=INK, linewidth=1.6))
        ax.plot([cx - 0.62, cx + 0.62], [cy + 0.09, cy + 0.16], color=INK, linewidth=1.6)
        ax.plot([cx - 0.62, cx + 0.62], [cy - 0.09, cy - 0.02], color=INK, linewidth=1.6)
        ax.add_patch(FancyBboxPatch((cx + 0.55, cy - 0.12), 0.35, 0.36, boxstyle="round,pad=0,rounding_size=0.08",
                                    facecolor=FILL, edgecolor=INK, linewidth=1.3))
    elif name == "copper coin":
        ax.add_patch(Circle((cx, cy), 0.42, facecolor=FILL_2, edgecolor=INK, linewidth=1.6))
        ax.add_patch(Circle((cx, cy), 0.3, facecolor="none", edgecolor=INK, linewidth=1.0))
    elif name == "aluminium can":
        ax.add_patch(Rectangle((cx - 0.32, cy - 0.5), 0.64, 0.95, facecolor=FILL_2, edgecolor=INK, linewidth=1.5))
        ax.add_patch(Ellipse((cx, cy + 0.45), 0.64, 0.18, facecolor="white", edgecolor=INK, linewidth=1.3))
        ax.plot([cx - 0.32, cx + 0.32], [cy - 0.05, cy - 0.05], color=INK, linewidth=0.9)
    elif name == "eraser":
        ax.add_patch(FancyBboxPatch((cx - 0.6, cy - 0.25), 1.2, 0.5, boxstyle="round,pad=0,rounding_size=0.1",
                                    facecolor="white", edgecolor=INK, linewidth=1.5))
        ax.add_patch(Rectangle((cx - 0.6, cy - 0.25), 0.5, 0.5, facecolor=FILL_2, edgecolor=INK, linewidth=1.2))
    elif name == "wooden ruler":
        ax.add_patch(Rectangle((cx - 0.95, cy - 0.17), 1.9, 0.34, facecolor="white", edgecolor=INK, linewidth=1.5))
        for i in range(1, 10):
            x = cx - 0.95 + 0.19 * i
            ax.plot([x, x], [cy + 0.17, cy + (0.0 if i % 5 == 0 else 0.07)], color=INK, linewidth=0.9)
    elif name == "glass marble":
        ax.add_patch(Circle((cx, cy), 0.33, facecolor="white", edgecolor=INK, linewidth=1.6))
        ax.add_patch(Arc((cx - 0.04, cy + 0.04), 0.4, 0.4, theta1=100, theta2=175, color=INK, linewidth=1.4))  # a shine
    elif name == "wooden pencil":
        ax.add_patch(Rectangle((cx - 0.9, cy - 0.12), 1.35, 0.24, facecolor="white", edgecolor=INK, linewidth=1.4))
        ax.add_patch(Polygon([(cx + 0.45, cy - 0.12), (cx + 0.85, cy), (cx + 0.45, cy + 0.12)], closed=True, facecolor=FILL_2,
                             edgecolor=INK, linewidth=1.2))
        ax.add_patch(Polygon([(cx + 0.72, cy - 0.04), (cx + 0.85, cy), (cx + 0.72, cy + 0.04)], closed=True, facecolor=INK, edgecolor=INK))
    else:  # pragma: no cover - every name in OBJECTS is drawn above
        raise ValueError(name)


def _magnet(ax, kind, cx, cy):
    if kind == "bar":
        ax.add_patch(Rectangle((cx - 1.0, cy - 0.3), 1.0, 0.6, facecolor=N_SHADE, edgecolor=INK, linewidth=1.8))
        ax.add_patch(Rectangle((cx, cy - 0.3), 1.0, 0.6, facecolor="white", edgecolor=INK, linewidth=1.8))
        ax.text(cx - 0.5, cy, "N", ha="center", va="center", fontsize=13, fontweight="bold")
        ax.text(cx + 0.5, cy, "S", ha="center", va="center", fontsize=13, fontweight="bold")
        return cy - 0.3
    # A horseshoe magnet, its two ends pointing down: N on the left, S on the right.
    ax.add_patch(Wedge((cx, cy + 0.2), 0.95, 0, 180, width=0.5, facecolor="white", edgecolor=INK, linewidth=1.8))
    for sx, pole in ((-1, "N"), (1, "S")):
        x0 = cx + sx * 0.7 - 0.25
        ax.add_patch(Rectangle((x0, cy - 0.3), 0.5, 0.5, facecolor="white", edgecolor=INK, linewidth=1.8))
        ax.add_patch(Rectangle((x0, cy - 0.85), 0.5, 0.55, facecolor=N_SHADE if pole == "N" else "white", edgecolor=INK, linewidth=1.8))
        ax.text(x0 + 0.25, cy - 0.575, pole, ha="center", va="center", fontsize=13, fontweight="bold")
    return cy - 0.85


def _draw_objects(p: dict):
    objs = p["objects"]
    cols = 3
    rows = math.ceil(len(objs) / cols)
    cw, ch = 3.2, 2.3
    left = 3.0
    fig, ax = new_figure(6.8, 1.2 * rows + 0.5)
    mid = -(rows - 1) * ch / 2
    bottom = _magnet(ax, p["magnet"], 1.2, mid + 0.25)
    ax.text(1.2, bottom - 0.4, "magnet", ha="center", va="center", fontsize=11, fontweight="bold")
    for i, o in enumerate(objs):
        r, c = divmod(i, cols)
        x0, top = left + c * cw, -r * ch + 0.95
        ax.add_patch(FancyBboxPatch((x0, top - 2.1), cw - 0.15, 2.05, boxstyle="round,pad=0,rounding_size=0.15", facecolor="none",
                                    edgecolor="#d0d0d0", linewidth=1.0))
        ax.text(x0 + 0.32, top - 0.4, o["letter"], ha="center", va="center", fontsize=13, fontweight="bold")
        _object(ax, o["name"], x0 + (cw - 0.15) / 2 + 0.1, top - 0.95)
        ax.text(x0 + (cw - 0.15) / 2, top - 1.78, o["name"], ha="center", va="center", fontsize=10.5)
    ax.set_xlim(-0.1, left + cols * cw)
    ax.set_ylim(-(rows - 1) * ch - 1.25, 1.05)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def draw(p: dict):
    return _draw_poles(p) if p["kind"] == "poles" else _draw_objects(p)


# --- questions -------------------------------------------------------------------------------------------

POLE_VERBS = ["lays out", "puts down", "places", "lines up", "sets out"]
OBJECT_PHRASES = ["holds a magnet near each object", "brings a magnet close to each object", "tests each object with a magnet",
                  "touches each object with a magnet", "moves a magnet next to each object"]
SETTINGS = ["in a science lesson in Huye", "at the science club in Musanze", "at home in Kigali", "in a classroom in Rubavu",
            "on a table at school in Nyagatare"]
WAY = {True: "Attract: they pull together", False: "Repel: they push apart"}


def _set(ls) -> str:
    ls = sorted(ls)
    if len(ls) == 1:
        return f"{ls[0]} only"
    return ", ".join(ls[:-1]) + f" and {ls[-1]}"


def _poles_questions(p, rng, name):
    pairs = p["pairs"]
    pulls = {pr["letter"]: pr["left"][1] != pr["right"][0] for pr in pairs}
    shown = [pr["letter"] for pr in pairs if pr["letter"] != p["hidden"]]
    attract = [k for k in shown if pulls[k]]
    repel = [k for k in shown if not pulls[k]]
    look = f" Look at pairs {_set(shown)}." if p["hidden"] else ""
    first = f"{name} {rng.choice(POLE_VERBS)} pairs of bar magnets end to end {rng.choice(SETTINGS)}.{look}"
    ask = rng.choice(["attract", "repel"])
    want, other = (attract, repel) if ask == "attract" else (repel, attract)
    # The slips: like poles attract (the other set); every pair pulls; one pair missed or one too many.
    wrong = [_set(other), _set(shown)]
    if len(want) > 1:
        wrong.append(_set(rng.sample(want, len(want) - 1)))
    wrong.append(_set(want + [rng.choice(other)]))
    verb = "attract (pull together)" if ask == "attract" else "repel (push apart)"
    qs = [mcq(f"{first} Which pairs will {verb}?", _set(want), wrong, rng)]
    k = rng.choice(shown)
    qs.append(mcq(f"Will the magnets in pair {k} attract or repel?", WAY[pulls[k]],
                  [WAY[not pulls[k]], "Nothing happens: they do not move"], rng))
    other_word = "repel" if ask == "attract" else "attract"
    how = f"How many of pairs {_set(shown)} will {other_word}?" if p["hidden"] else f"How many pairs will {other_word}?"
    qs.append(count(how, len(other), "pairs"))
    if p["hidden"]:
        pr = next(x for x in pairs if x["letter"] == p["hidden"])
        together = "pull together" if pulls[pr["letter"]] else "push apart"
        hidden_pole = pr["right"][0]
        qs.append(mcq(f"The magnets in pair {pr['letter']} {together}. Which pole is marked with a question mark?",
                      hidden_pole, ["S" if hidden_pole == "N" else "N", "It could be N or S"], rng))
    return qs


def _objects_questions(p, rng, name):
    objs = p["objects"]
    letter = {o["name"]: o["letter"] for o in objs}
    picks = [o["letter"] for o in objs if OBJECTS[o["name"]][1]]
    nots = [o["letter"] for o in objs if not OBJECTS[o["name"]][1]]
    metals = [o["letter"] for o in objs if OBJECTS[o["name"]][0]]
    metal_not = [letter[o["name"]] for o in objs if OBJECTS[o["name"]][0] and not OBJECTS[o["name"]][1]]
    first = f"{name} {rng.choice(OBJECT_PHRASES)} {rng.choice(SETTINGS)}."
    # The slips: every metal sticks; one more object; one missed; the ones it does not pick up.
    wrong = [_set(metals), _set(picks + [rng.choice(nots)])]
    if len(picks) > 1:
        wrong.append(_set(rng.sample(picks, len(picks) - 1)))
    wrong += [_set(nots), _set([o["letter"] for o in objs])]
    qs = [mcq(f"{first} Which objects will the magnet pick up?", _set(picks), wrong, rng)]
    if rng.random() < 0.5:
        qs.append(count("How many of the objects will the magnet pick up?", len(picks), "objects"))
    else:
        qs.append(count("How many of the objects will the magnet not pick up?", len(nots), "objects"))
    if p["level"] == "upper":
        qs.append(count("How many of the metal objects will the magnet not pick up?", len(metal_not), "objects"))
    else:
        can_not = len(picks) >= 2
        can_pick = len(nots) >= 2
        if can_not and (not can_pick or rng.random() < 0.5):
            k = rng.choice(nots)
            qs.append(mcq("Which object will the magnet not pick up?", f"Object {k}", [f"Object {x}" for x in rng.sample(picks, min(3, len(picks)))], rng))
        else:
            k = rng.choice(picks)
            qs.append(mcq("Which object will the magnet pick up?", f"Object {k}", [f"Object {x}" for x in rng.sample(nots, min(3, len(nots)))], rng))
    return qs


def questions(p: dict, rng: random.Random) -> list:
    name = rng.choice(NAMES)
    return _poles_questions(p, rng, name) if p["kind"] == "poles" else _objects_questions(p, rng, name)
