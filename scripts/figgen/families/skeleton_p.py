"""The skeleton, joints and muscles (P), of three kinds.

- bones (stages 3-6): a simple human skeleton from the front, four of its bones lettered by leader lines (skull, ribs,
  backbone, pelvis, thigh bone), with a table of the lettered bones' names and jobs (never their letters). Which
  letter shows the bones that protect the heart and lungs; what the bone at a letter is called.
- joints (stages 4-6): the same skeleton with three joints lettered, one of each kind (a hinge joint at the elbow or
  knee, a ball and socket joint at the shoulder or hip, the fixed joints of the skull), and a table of how each kind
  moves. Which letter shows a joint that bends one way only; what kind of joint is at a letter.
- muscles (stages 4-6): an arm bent at the elbow, from the side: the biceps in front of the upper arm bone drawn short
  and fat, the triceps behind it long and thin, and the bone, lettered A to C in any order. Which letter shows the
  muscle that contracts to bend the arm (the biceps), and the one that contracts to straighten it (the triceps).

Every key comes from the fixed tables below, which a Primary teacher would agree with.
"""
from __future__ import annotations

import random

from matplotlib.patches import Arc, Circle, Ellipse, FancyBboxPatch, Polygon

from ..core import INK, NAMES, Question, mcq, new_figure

ID = "skeleton_p"
KIND = "diagram.template"
SUBJECT = "science"
BANDS = ("P",)
CONCEPTS = tuple(f"science.{c}" for c in ("human-skeleton", "skeletal-movement-and-joints", "muscles", "body-movement"))
# A topic whose sections the book lists is reached only if its name or a section names the skeleton, bones, joints or
# muscles, or the body's structure and function.
NEEDS = r"skelet|\bbones?\b|\bjoints?\b|muscles?|structure and function"
AVOID = (r"\bcells?\b|animals classification|simple machines|writing skills|science in context|glossary|reproduct|sexual|\bHIV\b|"
         r"STIs|social factors")

BONES = ["skull", "ribs", "backbone", "pelvis", "thigh bone"]
JOB = {"skull": "protects the brain", "ribs": "protect the heart and lungs",
       "backbone": "holds the body up and protects the spinal cord", "pelvis": "joins the legs to the backbone",
       "thigh bone": "the longest bone; holds us up when we stand"}
ASK = {"skull": "the bone that protects the brain", "ribs": "the bones that protect the heart and lungs",
       "backbone": "the bones that hold the body up and protect the spinal cord",
       "pelvis": "the bones that join the legs to the backbone", "thigh bone": "the longest bone in the body"}
JOINT = {"elbow": "hinge joint", "knee": "hinge joint", "shoulder": "ball and socket joint",
         "hip": "ball and socket joint", "skull": "fixed joint"}
MOVES = {"hinge joint": "bends one way only, like a door", "ball and socket joint": "can move round in a circle",
         "fixed joint": "does not move at all"}
BONE = "#f7f1e1"


def concepts_for(p: dict) -> tuple[str, ...]:
    return {"bones": ("science.human-skeleton",),
            "joints": ("science.human-skeleton", "science.skeletal-movement-and-joints", "science.body-movement"),
            "muscles": ("science.muscles", "science.body-movement", "science.skeletal-movement-and-joints")}[p["kind"]]


def avoid_for(p: dict) -> str:
    # The bones and joints are no figure for a chapter on muscles, nor the muscle pair for one on the skeleton's bones.
    return AVOID + (r"|^muscles$" if p["kind"] != "muscles" else r"|^human skeleton$")


def stages(p: dict) -> tuple[int, int]:
    return (3, 6) if p["kind"] == "bones" else (4, 6)


def sample(rng: random.Random) -> dict:
    kind = rng.choice(["bones", "joints", "muscles"])
    if kind == "bones":
        return {"band": "P", "kind": "bones", "parts": rng.sample(BONES, 4)}
    if kind == "joints":
        joints = [rng.choice(["elbow", "knee"]), rng.choice(["shoulder", "hip"]), "skull"]
        rng.shuffle(joints)
        return {"band": "P", "kind": "joints", "joints": joints}
    parts = ["biceps", "triceps", "bone"]
    rng.shuffle(parts)
    return {"band": "P", "kind": "muscles", "facing": rng.choice(["right", "left"]), "parts": parts}


# --- the skeleton -----------------------------------------------------------------------------------------------

def _bone(ax, pts, w=6.0, z=3):
    xs, ys = [x for x, _ in pts], [y for _, y in pts]
    ax.plot(xs, ys, color=INK, linewidth=w + 2.4, solid_capstyle="round", zorder=z)
    ax.plot(xs, ys, color=BONE, linewidth=w, solid_capstyle="round", zorder=z + 0.1)
    for x, y in (pts[0], pts[-1]):
        ax.add_patch(Circle((x, y), 0.13, facecolor=BONE, edgecolor=INK, linewidth=1.2, zorder=z + 0.2))


def _rib(k: int, side: int) -> list[tuple[float, float]]:
    """One rib, from the backbone's edge out to one side: a curve that droops towards its end."""
    y, reach = 6.95 - 0.36 * k, 1.38 - 0.05 * k
    return [(side * (0.22 + (reach - 0.22) * t), y - 0.42 * t ** 2) for t in [i / 20 for i in range(21)]]


def _skeleton(ax):
    # skull and jaw, with eye holes and the wavy line where its bones meet
    ax.add_patch(Ellipse((0, 9.05), 1.5, 1.6, facecolor=BONE, edgecolor=INK, linewidth=1.6, zorder=3))
    ax.add_patch(FancyBboxPatch((-0.42, 7.95), 0.84, 0.55, boxstyle="round,pad=0,rounding_size=0.18", facecolor=BONE,
                                edgecolor=INK, linewidth=1.4, zorder=2.9))
    for dx in (-0.3, 0.3):
        ax.add_patch(Ellipse((dx, 9.0), 0.36, 0.42, facecolor="#5d4037", edgecolor=INK, linewidth=1.0, zorder=4))
    ax.add_patch(Polygon([(0, 8.75), (-0.09, 8.55), (0.09, 8.55)], closed=True, facecolor="#5d4037", edgecolor=INK,
                         linewidth=0.8, zorder=4))
    ax.plot([-0.5 + 0.1 * k for k in range(11)], [9.62 + (0.05 if k % 2 else -0.05) for k in range(11)], color=INK,
            linewidth=1.0, zorder=4)
    # neck and backbone: a stack of small bones
    for k in range(14):
        y = 7.75 - 0.27 * k
        ax.add_patch(FancyBboxPatch((-0.2, y - 0.1), 0.4, 0.2, boxstyle="round,pad=0,rounding_size=0.06", facecolor=BONE,
                                    edgecolor=INK, linewidth=1.0, zorder=3))
    # collar bones, shoulder knobs
    for s in (-1, 1):
        _bone(ax, [(s * 0.25, 7.3), (s * 1.45, 7.45)], w=4.5)
    # ribs: curved bones from the backbone out to each side, drooping as they go
    for k in range(6):
        for side in (-1, 1):
            pts = _rib(k, side)
            ax.plot([x for x, _ in pts], [y for _, y in pts], color=INK, linewidth=6.0, solid_capstyle="round", zorder=2.6)
            ax.plot([x for x, _ in pts], [y for _, y in pts], color=BONE, linewidth=3.8, solid_capstyle="round", zorder=2.7)
    # pelvis
    ax.add_patch(Polygon([(-1.25, 4.1), (-0.3, 3.8), (0.3, 3.8), (1.25, 4.1), (1.05, 3.25), (0.4, 2.95), (-0.4, 2.95),
                          (-1.05, 3.25)], closed=True, facecolor=BONE, edgecolor=INK, linewidth=1.5, zorder=3.3))
    for s in (-1, 1):
        ax.add_patch(Ellipse((s * 0.5, 3.3), 0.36, 0.3, facecolor="#5d4037", edgecolor=INK, linewidth=0.8, zorder=3.4))
        # arms: upper arm bone, the two forearm bones, a hand
        _bone(ax, [(s * 1.6, 7.25), (s * 2.15, 5.25)])
        _bone(ax, [(s * 2.15, 5.25), (s * 2.5, 3.55)], w=3.4)
        _bone(ax, [(s * 2.27, 5.2), (s * 2.65, 3.6)], w=3.0)
        ax.add_patch(Ellipse((s * 2.62, 3.3), 0.42, 0.55, facecolor=BONE, edgecolor=INK, linewidth=1.2, zorder=3.2))
        # legs: thigh bone, knee cap, the two lower-leg bones, a foot
        _bone(ax, [(s * 0.78, 3.1), (s * 0.88, 1.25)], w=7)
        ax.add_patch(Circle((s * 0.88, 1.2), 0.17, facecolor=BONE, edgecolor=INK, linewidth=1.2, zorder=3.4))
        _bone(ax, [(s * 0.82, 1.05), (s * 0.85, -0.55)], w=5)
        _bone(ax, [(s * 1.04, 1.0), (s * 1.06, -0.5)], w=2.6)
        ax.add_patch(Ellipse((s * 1.12, -0.75), 0.75, 0.3, facecolor=BONE, edgecolor=INK, linewidth=1.2, zorder=3.2))


# Where a lettered part's leader ends, and where its letter sits.
BONE_AT = {"skull": ((0.62, 9.25), (3.3, 9.4)), "ribs": (_rib(2, -1)[16], (-3.4, 6.4)),
           "backbone": ((0.2, 4.75), (3.3, 4.95)), "pelvis": ((-1.12, 3.55), (-3.4, 3.7)),
           "thigh bone": ((0.84, 2.1), (3.3, 2.1))}
JOINT_AT = {"skull": ((-0.2, 9.62), (-3.4, 9.6)), "elbow": ((2.15, 5.25), (3.4, 6.2)),
            "knee": ((-0.88, 1.2), (-3.4, 1.4)), "shoulder": ((-1.6, 7.25), (-3.4, 7.8)), "hip": ((0.78, 3.1), (3.4, 2.7))}


def _letter(ax, letter, at, slot):
    (ax_, ay), (lx, ly) = at, slot
    d = ((ax_ - lx) ** 2 + (ay - ly) ** 2) ** 0.5
    ux, uy = (ax_ - lx) / d, (ay - ly) / d
    ax.plot([lx + ux * 0.32, ax_], [ly + uy * 0.32, ay], color=INK, linewidth=1.4, zorder=6, gid=f"leader:{letter}")
    ax.add_patch(Circle((ax_, ay), 0.07, facecolor=INK, edgecolor=INK, zorder=6))
    ax.add_patch(Circle((lx, ly), 0.3, facecolor="white", edgecolor=INK, linewidth=1.6, zorder=7, gid=f"ring:{letter}"))
    ax.text(lx, ly, letter, ha="center", va="center", fontsize=15, fontweight="bold", zorder=8, gid=f"letter:{letter}")


def _table(ax, x0, top, heads, rows, col):
    ax.text(x0, top, heads[0], ha="left", va="center", fontsize=12, fontweight="bold")
    ax.text(x0 + col, top, heads[1], ha="left", va="center", fontsize=12, fontweight="bold")
    ax.plot([x0 - 0.05, x0 + col + 6.6], [top - 0.35, top - 0.35], color=INK, linewidth=1.0)
    for j, (a, b) in enumerate(rows):
        y = top - 0.95 - 0.75 * j
        ax.text(x0, y, a, ha="left", va="center", fontsize=11.5)
        ax.text(x0 + col, y, b, ha="left", va="center", fontsize=11.5)
    return top - 0.95 - 0.75 * (len(rows) - 1)


def _draw_body(p: dict):
    fig, ax = new_figure(12.0, 7.0)
    _skeleton(ax)
    if p["kind"] == "bones":
        for i, b in enumerate(p["parts"]):
            _letter(ax, "ABCD"[i], *BONE_AT[b])
        rows = [(b.capitalize(), JOB[b]) for b in BONES if b in p["parts"]]
        _table(ax, 4.5, 8.2, ("Bone", "Its job"), rows, 2.5)
    else:
        for i, j in enumerate(p["joints"]):
            _letter(ax, "ABC"[i], *JOINT_AT[j])
        rows = [(k.capitalize(), f"{MOVES[k]}") for k in ("hinge joint", "ball and socket joint", "fixed joint")]
        _table(ax, 4.5, 8.2, ("Kind of joint", "How it moves"), rows, 4.0)
    ax.set_xlim(-3.9, 15.4)
    ax.set_ylim(-1.1, 10.1)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


# --- the arm ------------------------------------------------------------------------------------------------------

def _draw_arm(p: dict):
    s = 1 if p["facing"] == "right" else -1
    fig, ax = new_figure(6.4, 5.6)
    # the arm's outline (skin), lightly, behind everything
    skin = [(-0.85 * s, 4.6), (-0.75 * s, 0.1), (-0.2 * s, -0.35), (3.9 * s, 0.45), (3.95 * s, 1.35), (1.2 * s, 1.35),
            (1.05 * s, 4.6)]
    ax.add_patch(Polygon(skin, closed=True, facecolor="#f3e5d8", edgecolor="#b08968", linewidth=1.2, zorder=1))
    ax.add_patch(Ellipse((4.1 * s, 0.9), 0.75, 1.0, facecolor="#f3e5d8", edgecolor="#b08968", linewidth=1.2, zorder=0.9))
    # bones: the upper arm bone (lettered when asked) and the forearm, meeting at the elbow
    _bone(ax, [(0.05 * s, 4.3), (0.05 * s, 0.35)], w=7)
    _bone(ax, [(0.15 * s, 0.25), (3.55 * s, 0.85)], w=5)
    ax.add_patch(Circle((0.08 * s, 0.3), 0.22, facecolor=BONE, edgecolor=INK, linewidth=1.3, zorder=3.3))
    # biceps: in front of the bone, short and fat (contracted), its tendons to the shoulder and to the forearm
    ax.add_patch(Ellipse((0.58 * s, 2.35), 0.8, 2.3, facecolor="#e74c3c", edgecolor=INK, linewidth=1.4, zorder=4))
    ax.plot([0.5 * s, 0.25 * s], [3.45, 4.3], color=INK, linewidth=2.2, zorder=3.8)
    ax.plot([0.62 * s, 0.85 * s], [1.25, 0.42], color=INK, linewidth=2.2, zorder=3.8)
    # triceps: behind the bone, long and thin (relaxed), its tendon round to the elbow's point
    ax.add_patch(Ellipse((-0.42 * s, 2.45), 0.42, 3.2, facecolor="#f1948a", edgecolor=INK, linewidth=1.4, zorder=4))
    ax.plot([-0.4 * s, -0.25 * s], [0.85, 0.22], color=INK, linewidth=2.2, zorder=3.8)
    at = {"biceps": (0.7 * s, 2.6), "triceps": (-0.45 * s, 3.3), "bone": (0.05 * s, 0.95)}
    slot = {"biceps": (2.6 * s, 3.3), "triceps": (-2.2 * s, 3.8), "bone": (-2.2 * s, 1.4)}
    for i, part in enumerate(p["parts"]):
        _letter(ax, "ABC"[i], at[part], slot[part])
    ax.set_xlim(min(-2.7 * s, 4.6 * s), max(-2.7 * s, 4.6 * s))
    ax.set_ylim(-0.6, 4.9)
    ax.set_aspect("equal")
    ax.axis("off")
    ax.set_title("An arm bent at the elbow", fontsize=12)
    return fig


def draw(p: dict):
    return _draw_arm(p) if p["kind"] == "muscles" else _draw_body(p)


# --- questions ---------------------------------------------------------------------------------------------------

VERBS = ["looks at", "studies", "points at", "talks about"]
SETTINGS = ["in a science lesson", "at school", "at home", "with a friend", "in class", "for homework"]


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    if p["kind"] == "bones":
        parts, letters = p["parts"], list("ABCD")
        part = rng.choice(parts)
        other = rng.choice([L for L in letters if L != letters[parts.index(part)]])
        name = parts[letters.index(other)]
        return [Question("mcq", f"{who} {rng.choice(VERBS)} this skeleton {rng.choice(SETTINGS)}. Which letter shows "
                                f"{ASK[part]}?", str(parts.index(part)), letters),
                mcq(f"What is the name of the bone at letter {other}?", name, [b for b in parts if b != name], rng)]
    if p["kind"] == "joints":
        joints, letters = p["joints"], list("ABC")
        types = [JOINT[j] for j in joints]
        kind = rng.choice(types)
        other = rng.choice([L for L in letters if L != letters[types.index(kind)]])
        right = types[letters.index(other)]
        return [Question("mcq", f"{who} {rng.choice(VERBS)} the joints of this skeleton {rng.choice(SETTINGS)}. Which "
                                f"letter shows a joint that {MOVES[kind]}?", str(types.index(kind)), letters),
                mcq(f"What kind of joint is at letter {other}?", right, [t for t in MOVES if t != right], rng)]
    parts, letters = p["parts"], list("ABC")
    first = rng.choice(["bend", "straighten"])
    order = [first, "straighten" if first == "bend" else "bend"]
    lead = f"{who} {rng.choice(VERBS)} this drawing of an arm {rng.choice(SETTINGS)}. "
    qs = []
    for k, move in enumerate(order):
        muscle = "biceps" if move == "bend" else "triceps"
        stem = f"Which letter shows the muscle that contracts to {move} the arm?"
        qs.append(Question("mcq", (lead if k == 0 else "") + stem, str(parts.index(muscle)), letters))
    return qs
