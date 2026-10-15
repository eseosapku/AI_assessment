"""Arm muscles (LS, UP): the bones and muscles of the human arm, seen from the side, drawn as textbooks draw the
antagonistic pair. The humerus hangs from the shoulder blade; at the elbow joint (a hinge, its capsule drawn round
the end of the humerus) the forearm's two bones, the radius (in front) and the ulna (its olecranon behind the
elbow), swing as one. The biceps lies in front of the humerus, joined by tendons to the shoulder blade and the radius;
the triceps behind, joined to the shoulder blade and the olecranon. "front of the arm" and "back of the arm" are
printed on each side, so the drawing decides which muscle is which (p3w-blind). Two kinds:

- bending: the forearm a little above level, the biceps drawn short and fat (contracting), the triceps long and thin;
- straightening: the forearm a little below level, the triceps short and fat, the biceps long and thin;

with a curved arrow from the hand to where it goes. Four to six parts are lettered, always the two muscles and the
joint or a tendon, never the humerus. Every leader ends on a dot well inside its part and passes over no other part:
which letter is the muscle that contracts to make the movement drawn; which letter is the joint, or a tendon (only
one that is lettered); and what it means that the two lettered muscles are an antagonistic pair.
"""
from __future__ import annotations

import math
import random

from ..core import INK, NAMES, Question, new_figure
from ._bio_parts import ellipse, letter, letter_choice, letters_for, part, spline, tube

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

ANGLE = {"bend": 20, "straighten": -20}  # the forearm, in degrees above the horizontal
SWING = 28  # how far the arrow from the hand turns
P = (0.0, 2.4)  # the elbow's hinge
KNOB, CAPSULE = 0.42, 0.95  # the humerus's rounded end, and the joint capsule round it
BONE, MUSCLE, TENDON, SKIN, JOINT = "#f3ead2", "#e39b8f", "#f7f3e8", "#f2d2bd", "#cfe3f3"
# Each muscle's belly: (centre x, top, bottom, half-width), contracting (short and fat) or relaxed (long and thin).
BELLY = {("biceps", True): (0.95, 7.6, 4.4, 0.75), ("biceps", False): (0.75, 8.2, 3.8, 0.42),
         ("triceps", True): (-1.0, 7.6, 4.4, 0.75), ("triceps", False): (-0.8, 8.2, 3.8, 0.42)}


def sample(rng: random.Random) -> dict:
    move = rng.choice(["bend", "straighten"])
    chosen = ["biceps", "triceps"] + rng.choice([["elbow joint"], ["tendon"], ["elbow joint", "tendon"]])
    # never the humerus: no leader reaches it without crossing a muscle or a tendon, and reviewers read such a leader
    # as the muscle (p3w-blind)
    chosen += rng.sample(["radius", "ulna"], rng.choice([1, 2]))
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


def _ring(deg: float) -> tuple[float, float]:
    """A point in the joint capsule, midway between the humerus's end and the capsule's edge."""
    r = (KNOB + CAPSULE) / 2
    return P[0] + r * math.cos(math.radians(deg)), P[1] + r * math.sin(math.radians(deg))


def _slots(move: str) -> dict:
    """Where each part's letter sits and where its leader ends: well inside the part, passing over no other."""
    (x0, y0), (x1, y1) = _geometry(move)["triceps bottom"]
    tendon = (x0 + 0.25 * (x1 - x0), y0 + 0.25 * (y1 - y0))  # a quarter of the way down: clear of the muscle and the joint
    bend = move == "bend"
    b, t = BELLY[("biceps", bend)], BELLY[("triceps", not bend)]
    slots = {"triceps": ((-3.3, 6.0), (t[0], 6.0)), "biceps": ((2.7, 7.0), (b[0], 6.2)), "tendon": ((-3.3, tendon[1]), tendon)}
    if bend:
        slots.update({"radius": ((2.6, 4.9), _at(2.6, 0.3, move)), "ulna": ((3.0, 1.5), _at(2.6, -0.25, move)),
                      "elbow joint": ((0.9, 0.3), _ring(290))})
    else:
        slots.update({"radius": ((2.9, 3.3), _at(2.4, 0.3, move)), "ulna": ((1.3, -0.6), _at(2.4, -0.25, move)),
                      "elbow joint": ((-1.9, 0.3), _ring(240))})
    return slots


def draw(p: dict):
    move = p["move"]
    bend = move == "bend"
    fig, ax = new_figure(6.4, 6.8)
    from matplotlib.patches import Polygon
    # the shoulder blade, the joint capsule at the elbow, the bones
    ax.add_patch(Polygon(spline([(-2.0, 9.9), (0.9, 10.1), (1.15, 9.6), (0.3, 9.0), (-1.4, 9.0)], per=6), closed=True,
                         facecolor=BONE, edgecolor=INK, linewidth=1.2, zorder=1, gid="shoulder blade"))
    part(ax, ellipse(*P, CAPSULE, CAPSULE), "elbow joint", JOINT, lw=1.0, z=2.2)
    part(ax, _stadium(_at(-0.5, -0.25, move), _at(4.3, -0.25, move), 0.16), "ulna", BONE, lw=1.1, z=2.3)
    shaft = [(-0.26, P[1]), (0.26, P[1]), (0.26, 8.8), (0.48, 9.1), (0.32, 9.48), (-0.08, 9.6), (-0.4, 9.35), (-0.3, 8.8)]
    part(ax, shaft, "humerus", BONE, lw=1.1, z=2.5)
    part(ax, ellipse(*P, KNOB, KNOB), "humerus", BONE, lw=1.1, z=2.5)
    ax.plot([-0.26, 0.26], [P[1] + 0.33, P[1] + 0.33], color=BONE, linewidth=2.5, zorder=2.55)  # the knob is the shaft's end
    part(ax, _stadium(_at(0.6, 0.3, move), _at(4.3, 0.3, move), 0.15), "radius", BONE, lw=1.1, z=2.6)
    u, _ = _axes(move)
    hand = ellipse(0, 0, 0.62, 0.38)
    c = _at(4.85, 0.02, move)
    ax.add_patch(Polygon([(c[0] + x * u[0] - y * u[1], c[1] + x * u[1] + y * u[0]) for x, y in hand], closed=True, facecolor=SKIN,
                         edgecolor=INK, linewidth=1.1, zorder=2.7, gid="hand"))
    # the muscles and their tendons
    for name in ("biceps", "triceps"):
        working = (name == "biceps") == bend
        part(ax, _belly(name, working), name, MUSCLE, z=3)
        cx, top, bottom, hw = BELLY[(name, working)]
        for k in (-1, 1):  # fibres along the belly
            ax.plot([cx + k * hw * 0.3, cx + k * hw * 0.45, cx + k * hw * 0.3],
                    [top - (top - bottom) * 0.25, (top + bottom) / 2, bottom + (top - bottom) * 0.25], color="#b4675c",
                    linewidth=0.8, zorder=3.1)
    for a, b in _geometry(move).values():
        part(ax, tube([a, b], 0.16), "tendon", TENDON, lw=1.0, z=2.9)
    # which side is which, so the drawing decides the biceps from the triceps (p3w-blind)
    ax.text(-2.5, 8.6, "back of the arm", ha="center", va="center", fontsize=10, style="italic")
    ax.text(2.4, 8.6, "front of the arm", ha="center", va="center", fontsize=10, style="italic")
    # the movement: an arrow from the hand to where it goes
    r = 5.45
    head = ANGLE[move] + (SWING if bend else -SWING)
    pt = lambda deg: (P[0] + r * math.cos(math.radians(deg)), P[1] + r * math.sin(math.radians(deg)))  # noqa: E731
    ax.annotate("", xy=pt(head), xytext=pt(ANGLE[move]), gid=f"flow:{move}", zorder=6,
                arrowprops=dict(arrowstyle="-|>,head_length=0.7,head_width=0.35", color=INK, lw=2.0,
                                connectionstyle=f"arc3,rad={0.2 if bend else -0.2}", shrinkA=0, shrinkB=0))
    for L, name in p["labels"].items():
        at, end = _slots(move)[name]
        letter(ax, L, at, end, gap=0.32, dot=True)
    ax.set_xlim(-4.0, 6.8)
    ax.set_ylim(-0.3 if bend else -2.0, 10.4)
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
    wrong = [at[resting]] + [at[c] for c in ("tendon", "radius", "ulna", "elbow joint") if c in at]
    qs = [letter_choice(f"{intro} The arrow shows the arm {doing} at the elbow. Which letter shows the muscle that contracts "
                        f"to do this?", at[working], wrong)]
    which = rng.choice(sorted(x for x in ("elbow joint", "tendon") if x in at))
    stem = "Which letter shows the joint?" if which == "elbow joint" else "Which letter shows a tendon, which joins a muscle to a bone?"
    wrong = [at[c] for c in ("tendon", "elbow joint", "radius", "ulna", "biceps", "triceps") if c in at and c != which]
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
