"""Arm muscles (LS, UP): the bones and muscles of the human arm, seen from the side, drawn as textbooks draw the
antagonistic pair. The humerus hangs from the shoulder blade; at the elbow joint (a hinge, its capsule drawn round
the end of the humerus) the forearm's two bones, the radius (in front) and the ulna (its olecranon behind the
elbow), swing as one. The biceps lies in front of the humerus, joined by tendons to the shoulder blade and the radius;
the triceps behind, joined to the shoulder blade and the olecranon. Two kinds:

- bending: the forearm raised, the biceps drawn short and fat (contracting), the triceps long and thin;
- straightening: the forearm lowered, the triceps short and fat, the biceps long and thin;

with a curved arrow at the hand showing the movement. Five or six parts are lettered, always the two muscles: which
letter is the muscle that contracts to make the movement drawn; which letter is the joint, or a tendon; and what it
means that the two lettered muscles are an antagonistic pair.
"""
from __future__ import annotations

import math
import random

from ..core import INK, NAMES, Question, new_figure
from ._bio_parts import ellipse, flow, letter, letter_choice, letters_for, part, spline, tube

ID = "arm_muscles"
KIND = "diagram.template"
SUBJECT = "biology"
BANDS = ("LS", "UP")
CONCEPTS = tuple(f"biology.{c}" for c in ("joints-movement", "joints-types", "muscle-contraction",
                                          "terrestrial-animals-support-locomotion", "animal-skeletons-types"))
# Integrated Science teaches the skeleton, muscles and moving the body too (P3n).
ALSO = tuple(f"science.{c}" for c in ("skeletal-movement-and-joints", "muscles", "body-movement"))
# A topic whose sections the book lists is reached only if one names joints, muscles, skeletons or movement.
NEEDS = r"joint|muscle|skelet|support and locomotion|moving the body|movement of"
AVOID = r"into and out of cells|cell membrane"

ANGLE = {"bend": 30, "straighten": -40}  # the forearm, in degrees above the horizontal
P = (0.0, 2.4)  # the elbow's hinge
BONE, MUSCLE, TENDON, SKIN, JOINT = "#f3ead2", "#e39b8f", "#f7f3e8", "#f2d2bd", "#cfe3f3"
# Each muscle's belly: (centre x, top, bottom, half-width), contracting (short and fat) or relaxed (long and thin).
BELLY = {("biceps", True): (0.95, 7.6, 4.4, 0.75), ("biceps", False): (0.75, 8.2, 3.8, 0.42),
         ("triceps", True): (-1.0, 7.6, 4.4, 0.75), ("triceps", False): (-0.8, 8.2, 3.8, 0.42)}


def sample(rng: random.Random) -> dict:
    move = rng.choice(["bend", "straighten"])
    chosen = ["biceps", "triceps"] + rng.choice([["elbow joint"], ["tendon"], ["elbow joint", "tendon"]])
    chosen += rng.sample(["humerus", "radius", "ulna"], rng.choice([5, 6]) - len(chosen))
    labels = letters_for(chosen, rng)
    return {"band": rng.choice(BANDS), "move": move, "labels": dict(sorted(labels.items()))}


# --- drawing ----------------------------------------------------------------------------------------

def _axes(move: str):
    a = math.radians(ANGLE[move])
    return (math.cos(a), math.sin(a)), (-math.sin(a), math.cos(a))


def _at(t: float, s: float, move: str) -> tuple[float, float]:
    """A point t along the forearm from the hinge and s across it (towards the radius side)."""
    u, n = _axes(move)
    return P[0] + t * u[0] + s * n[0], P[1] + t * u[1] + s * n[1]


def _stadium(a, b, w: float) -> list[list[float]]:
    """A bone: a bar from a to b with round ends, w its half-width."""
    ang = math.degrees(math.atan2(b[1] - a[1], b[0] - a[0]))
    return ellipse(b[0], b[1], w, w, n=16, a0=ang - 90, a1=ang + 90) + ellipse(a[0], a[1], w, w, n=16, a0=ang + 90, a1=ang + 270)


def _belly(name: str, working: bool) -> list[list[float]]:
    cx, top, bottom, hw = BELLY[(name, working)]
    h = top - bottom
    return spline([(cx, top), (cx + hw * 0.6, top - h * 0.18), (cx + hw, top - h * 0.5), (cx + hw * 0.6, bottom + h * 0.18),
                   (cx, bottom), (cx - hw * 0.6, bottom + h * 0.18), (cx - hw, top - h * 0.5), (cx - hw * 0.6, top - h * 0.18)], per=8)


def _geometry(move: str) -> dict:
    """Where each tendon runs: (from, to)."""
    bend = move == "bend"
    b = BELLY[("biceps", bend)]
    t = BELLY[("triceps", not bend)]
    olecranon = _at(-0.5, -0.25, move)
    return {"biceps top": ((b[0], b[1]), (0.45, 9.45)), "biceps bottom": ((b[0], b[2]), _at(1.0, 0.44, move)),
            "triceps top": ((t[0], t[1]), (-0.65, 9.2)), "triceps bottom": ((t[0], t[2]), olecranon)}


def _slots(move: str) -> dict:
    g = _geometry(move)
    (x0, y0), (x1, y1) = g["triceps bottom"]
    tendon = ((x0 + x1) / 2, (y0 + y1) / 2)
    bend = move == "bend"
    b, t = BELLY[("biceps", bend)], BELLY[("triceps", not bend)]
    slots = {"triceps": ((-3.3, 6.0), (t[0], 6.0)), "humerus": ((-3.3, 7.3), (0.0, 7.3)), "tendon": ((-3.3, tendon[1]), tendon),
             "biceps": ((2.9, 6.6), (b[0], 6.3))}
    if bend:
        slots.update({"radius": ((2.9, 5.15), _at(2.6, 0.3, move)), "ulna": ((3.1, 1.5), _at(2.6, -0.25, move)),
                      "elbow joint": ((0.9, 0.45), (0.3, 1.9))})
    else:
        slots.update({"radius": ((3.6, 2.6), _at(2.4, 0.3, move)), "ulna": ((0.4, -0.75), _at(2.4, -0.25, move)),
                      "elbow joint": ((-2.2, 0.6), (-0.39, 1.96))})
    return slots


def draw(p: dict):
    move = p["move"]
    bend = move == "bend"
    fig, ax = new_figure(6.4, 6.6)
    from matplotlib.patches import Polygon
    # the shoulder blade, the joint capsule at the elbow, the bones
    ax.add_patch(Polygon(spline([(-2.0, 9.9), (0.9, 10.1), (1.15, 9.6), (0.3, 9.0), (-1.4, 9.0)], per=6), closed=True,
                         facecolor=BONE, edgecolor=INK, linewidth=1.2, zorder=1, gid="shoulder blade"))
    part(ax, ellipse(*P, 0.68, 0.68), "elbow joint", JOINT, lw=1.0, z=2.2)
    part(ax, _stadium(_at(-0.5, -0.25, move), _at(4.3, -0.25, move), 0.16), "ulna", BONE, lw=1.1, z=2.3)
    shaft = [(-0.26, P[1]), (0.26, P[1]), (0.26, 8.8), (0.48, 9.1), (0.32, 9.48), (-0.08, 9.6), (-0.4, 9.35), (-0.3, 8.8)]
    part(ax, shaft, "humerus", BONE, lw=1.1, z=2.5)
    part(ax, ellipse(*P, 0.42, 0.42), "humerus", BONE, lw=1.1, z=2.5)
    ax.plot([-0.26, 0.26], [P[1] + 0.33, P[1] + 0.33], color=BONE, linewidth=2.5, zorder=2.55)  # the knob is the shaft's end
    part(ax, _stadium(_at(0.6, 0.3, move), _at(4.3, 0.3, move), 0.15), "radius", BONE, lw=1.1, z=2.6)
    u, _ = _axes(move)
    hand = ellipse(0, 0, 0.62, 0.38)
    c = _at(4.85, 0.02, move)
    ax.add_patch(Polygon([(c[0] + x * u[0] - y * u[1], c[1] + x * u[1] + y * u[0]) for x, y in hand], closed=True, facecolor=SKIN,
                         edgecolor=INK, linewidth=1.1, zorder=2.7, gid="hand"))
    # the muscles and their tendons
    for name, front in (("biceps", True), ("triceps", False)):
        working = (name == "biceps") == bend
        part(ax, _belly(name, working), name, MUSCLE, z=3)
        cx, top, bottom, hw = BELLY[(name, working)]
        for k in (-1, 1):  # fibres along the belly
            ax.plot([cx + k * hw * 0.3, cx + k * hw * 0.45, cx + k * hw * 0.3],
                    [top - (top - bottom) * 0.25, (top + bottom) / 2, bottom + (top - bottom) * 0.25], color="#b4675c",
                    linewidth=0.8, zorder=3.1)
    for key, (a, b) in _geometry(move).items():
        part(ax, tube([a, b], 0.13), "tendon", TENDON, lw=1.0, z=2.9)
    # the movement
    r = 5.6
    if bend:
        tail, head, rad = (ANGLE[move] - 22, ANGLE[move], 0.2)
    else:
        tail, head, rad = (ANGLE[move] + 22, ANGLE[move], -0.2)
    pt = lambda deg: (P[0] + r * math.cos(math.radians(deg)), P[1] + r * math.sin(math.radians(deg)))  # noqa: E731
    ax.annotate("", xy=pt(head), xytext=pt(tail), gid=f"flow:{move}", zorder=6,
                arrowprops=dict(arrowstyle="-|>,head_length=0.7,head_width=0.35", color=INK, lw=2.0, connectionstyle=f"arc3,rad={rad}",
                                shrinkA=0, shrinkB=0))
    for L, name in p["labels"].items():
        at, end = _slots(move)[name]
        letter(ax, L, at, end, gap=0.32)
    ax.set_xlim(-4.0, 6.8)
    ax.set_ylim(-1.7 if not bend else -0.2, 10.4)
    ax.set_aspect("equal")
    ax.axis("off")
    ax.set_title("Bones and muscles of the arm", fontsize=12)
    return fig


# --- questions --------------------------------------------------------------------------------------

INTROS = ["{name} drew this diagram of the arm {setting}.", "{name} copied this diagram of the bones and muscles of the arm {setting}.",
          "{name} is studying this drawing of the human arm {setting}.", "{name} made this diagram of an arm {setting}."]
SETTINGS = ["in a biology lesson in Huye", "after a football match in Musanze", "for a revision poster", "for homework",
            "at the science club in Rwamagana", "in a lesson on movement", "before a test in Kigali"]


def questions(p: dict, rng: random.Random) -> list:
    labels, move = p["labels"], p["move"]
    at = {v: k for k, v in labels.items()}
    bend = move == "bend"
    working, resting = ("biceps", "triceps") if bend else ("triceps", "biceps")
    intro = rng.choice(INTROS).format(name=rng.choice(NAMES), setting=rng.choice(SETTINGS))
    doing = "bending" if bend else "straightening"
    wrong = [at[resting]] + [at[c] for c in ("tendon", "humerus", "radius", "ulna", "elbow joint") if c in at]
    qs = [letter_choice(f"{intro} The arrow shows the arm {doing} at the elbow. Which letter shows the muscle that contracts "
                        f"to do this?", at[working], wrong)]
    which = rng.choice(sorted(x for x in ("elbow joint", "tendon") if x in at))
    stem = "Which letter shows the joint?" if which == "elbow joint" else "Which letter shows a tendon, which joins a muscle to a bone?"
    wrong = [at[c] for c in ("tendon", "elbow joint", "humerus", "radius", "ulna", "biceps", "triceps") if c in at and c != which]
    qs.append(letter_choice(stem, at[which], wrong))
    x, y = rng.sample([at["biceps"], at["triceps"]], 2)
    good = f"When {x} contracts, {y} relaxes: they pull the forearm in opposite directions"
    options = [good, f"{x} and {y} contract at the same time to bend the arm", f"{x} pushes the forearm up and {y} pulls it down",
               f"{x} and {y} pull on the same side of the elbow joint"]
    rng.shuffle(options)
    qs.append(Question("mcq", rng.choice([f"Muscles {x} and {y} work as an antagonistic pair. What does this mean?",
                                          f"Muscles {x} and {y} are an antagonistic pair. What does antagonistic mean here?"]),
                       str(options.index(good)), options))
    return qs
