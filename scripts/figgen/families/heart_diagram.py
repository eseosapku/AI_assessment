"""Heart (LS, UP): a section through the human heart seen from the front, drawn as textbooks draw it: the four
chambers in a muscular wall (the left ventricle's wall thickest), the septum, the tricuspid and bicuspid valves open
into the ventricles, semilunar valves at the base of the arteries, the vena cava into the right atrium, the
pulmonary artery from the right ventricle branching to both lungs, the pulmonary veins into the left atrium and the
aorta arching from the left ventricle. Arrows show the blood's one-way path. The heart's left side is drawn on the
viewer's right, and a note under each half says which side of the body it is. Half the figures shade oxygenated blood
red and deoxygenated blood blue, with a key.

Six (or five) parts are lettered A-F, always the aorta and the left ventricle, two or three other vessels and a
chamber besides: which letter is a named part; the job of the part at a letter; which vessel carries oxygenated blood
to the body; and which chamber has the thickest wall.
"""
from __future__ import annotations

import random

from ..core import FILL_2, INK, NAMES, Question, new_figure
from ._bio_parts import flow, letter, letter_choice, letters_for, part, spline, vessel

ID = "heart_diagram"
KIND = "diagram.template"
SUBJECT = "biology"
BANDS = ("UP", "LS")
CONCEPTS = tuple(f"biology.{c}" for c in ("heart", "blood-circulatory-system", "transport-systems"))
# A topic whose sections the book lists is reached only if one names the heart or circulation.
NEEDS = r"heart|circulat|transport in (?:animals|mammals|humans)|cardiovascular"
AVOID = r"plant"

JOB = {
    "right atrium": "receives deoxygenated blood from the body",
    "left atrium": "receives oxygenated blood from the lungs",
    "right ventricle": "pumps deoxygenated blood to the lungs",
    "left ventricle": "pumps oxygenated blood to the rest of the body",
    "septum": "keeps oxygenated and deoxygenated blood apart",
    "vena cava": "brings deoxygenated blood from the body to the heart",
    "pulmonary artery": "carries deoxygenated blood from the heart to the lungs",
    "pulmonary vein": "brings oxygenated blood from the lungs to the heart",
    "aorta": "carries oxygenated blood from the heart to the body",
    "tricuspid valve": "stops blood flowing back from the right ventricle into the right atrium",
    "bicuspid valve": "stops blood flowing back from the left ventricle into the left atrium",
}
# The slips a learner makes for each part: the other side, the other chamber, the vessel the other way.
CONFUSE = {
    "vena cava": ["pulmonary vein", "pulmonary artery", "right atrium"],
    "pulmonary artery": ["aorta", "pulmonary vein", "vena cava"],
    "pulmonary vein": ["vena cava", "pulmonary artery", "left atrium"],
    "right atrium": ["left atrium", "right ventricle", "left ventricle"],
    "left atrium": ["right atrium", "left ventricle", "right ventricle"],
    "right ventricle": ["left ventricle", "right atrium", "left atrium"],
    "septum": ["left ventricle", "right ventricle", "bicuspid valve"],
    "tricuspid valve": ["bicuspid valve", "septum", "right ventricle"],
    "bicuspid valve": ["tricuspid valve", "septum", "left ventricle"],
}
JOB_CONFUSE = {
    "right atrium": ["left atrium", "right ventricle", "left ventricle"],
    "left atrium": ["right atrium", "left ventricle", "right ventricle"],
    "right ventricle": ["left ventricle", "right atrium", "left atrium"],
    "septum": ["left ventricle", "bicuspid valve", "right atrium"],
    "vena cava": ["pulmonary vein", "aorta", "pulmonary artery"],
    "pulmonary artery": ["aorta", "pulmonary vein", "vena cava"],
    "pulmonary vein": ["vena cava", "pulmonary artery", "aorta"],
    "tricuspid valve": ["bicuspid valve", "septum", "right atrium"],
    "bicuspid valve": ["tricuspid valve", "septum", "left atrium"],
}
OXYGENATED = ("left atrium", "left ventricle", "pulmonary vein", "aorta")


def sample(rng: random.Random) -> dict:
    v, c, e = rng.choice([(2, 1, 1), (2, 2, 0), (3, 1, 0), (2, 1, 0)])
    chosen = ["aorta", "left ventricle"]
    chosen += rng.sample(["vena cava", "pulmonary artery", "pulmonary vein"], v)
    chosen += rng.sample(["right atrium", "left atrium", "right ventricle"], c)
    chosen += rng.sample(["septum", "tricuspid valve", "bicuspid valve"], e)
    labels = letters_for(chosen, rng)
    return {"band": rng.choice(BANDS), "shaded": rng.random() < 0.5, "labels": dict(sorted(labels.items()))}


# --- drawing ----------------------------------------------------------------------------------------

WALL = [(1.25, 6.5), (1.7, 7.05), (3.0, 7.15), (5.0, 6.95), (7.0, 7.15), (8.3, 7.05), (8.8, 6.5), (8.95, 4.6), (8.7, 3.0),
        (7.8, 1.85), (6.5, 1.0), (5.6, 0.75), (4.6, 1.05), (2.9, 1.8), (1.6, 2.95), (1.15, 4.6)]
LUMEN = {
    "right atrium": [(1.8, 4.95), (3.35, 4.95), (3.45, 5.9), (3.2, 6.6), (2.0, 6.65), (1.75, 5.9)],
    "left atrium": [(6.6, 4.95), (8.2, 4.95), (8.3, 5.9), (8.05, 6.6), (6.85, 6.65), (6.55, 5.9)],
    "right ventricle": [(1.75, 4.5), (4.45, 4.5), (4.45, 3.0), (4.1, 2.05), (3.3, 2.1), (2.3, 2.85), (1.75, 3.7)],
    "left ventricle": [(5.55, 4.5), (7.65, 4.5), (7.7, 3.4), (7.2, 2.35), (6.3, 1.75), (5.6, 2.05)],
}
SEPTUM = [(4.5, 4.48), (5.5, 4.48), (5.55, 2.1), (5.2, 1.4), (4.7, 1.5), (4.5, 2.6)]
OPENING = {"right": (2.25, 3.15), "left": (6.85, 7.65)}  # the gaps between each atrium and its ventricle
FLAPS = {"tricuspid valve": [((2.3, 4.5), (2.55, 3.75)), ((3.1, 4.5), (2.85, 3.75))],
         "bicuspid valve": [((6.9, 4.5), (7.1, 3.75)), ((7.6, 4.5), (7.4, 3.75))]}
OXY, DEOXY = "#ec9c9c", "#9fbfe6"
LEFT_X, RIGHT_X = -0.7, 11.3


def _flap(base, tip) -> list[list[float]]:
    (bx, by), (tx, ty) = base, tip
    return spline([(bx - 0.1, by), (bx + 0.1, by), (tx + 0.05, ty + 0.15), (tx, ty), (tx - 0.05, ty + 0.15)], per=8)


def _on_flap(base, tip, f: float = 0.25) -> tuple[float, float]:
    """A point a quarter of the way down a valve flap: on the flap, clear of the arrow between the flaps."""
    return base[0] + f * (tip[0] - base[0]), base[1] - 0.05 + f * (tip[1] - base[1])


# Each part's letter: where the letter sits and where its leader ends: well inside a chamber or on a vessel's middle,
# clear of every arrow, passing over no other part on the way (p3w-blind: leaders near a wall read as the wall).
SLOT = {
    "vena cava": ((LEFT_X, 9.05), (2.1, 9.05)),
    "pulmonary artery": ((4.0, 10.45), (4.0, 9.05)),
    "right atrium": ((LEFT_X, 5.95), (2.6, 5.95)),
    "tricuspid valve": ((LEFT_X, 4.27), _on_flap(*FLAPS["tricuspid valve"][0])),
    "right ventricle": ((LEFT_X, 2.85), (3.2, 2.85)),
    "aorta": ((RIGHT_X, 9.3), (9.7, 9.3)),
    "left atrium": ((RIGHT_X, 7.0), (7.5, 6.05)),
    "pulmonary vein": ((RIGHT_X, 5.62), (10.0, 5.62)),
    "bicuspid valve": ((RIGHT_X, 4.27), _on_flap(*FLAPS["bicuspid valve"][1])),
    "left ventricle": ((RIGHT_X, 2.75), (6.62, 2.75)),
    "septum": ((5.0, -0.3), (5.0, 2.8)),
}


def _blood(p: dict, name: str) -> str:
    if not p["shaded"]:
        return "white"
    return OXY if name in OXYGENATED else DEOXY


def draw(p: dict):
    fig, ax = new_figure(6.8, 6.8)
    from matplotlib.patches import Polygon, Rectangle
    wall_face = "#f3e1db" if p["shaded"] else FILL_2
    ax.add_patch(Polygon(spline(WALL), closed=True, facecolor=wall_face, edgecolor=INK, linewidth=1.6, zorder=1, gid="wall"))
    part(ax, SEPTUM, "septum", wall_face, edge="none", z=1.5)
    for name, pts in LUMEN.items():
        part(ax, spline(pts, per=10), name, _blood(p, name), z=2)
    # the openings between atrium and ventricle on each side, and their valves, open into the ventricles
    for side, (x0, x1) in OPENING.items():
        face = _blood(p, "right atrium" if side == "right" else "left atrium")
        ax.add_patch(Rectangle((x0, 4.42), x1 - x0, 0.6, facecolor=face, edgecolor="none", zorder=2.05))
    for name, flaps in FLAPS.items():
        for base, tip in flaps:
            part(ax, _flap(base, tip), name, "white", lw=1.0, z=3.2)
    # the vessels, each opening into its own chamber and crossing no other (p3w-blind): the vena cava into the right
    # atrium, the pulmonary artery up out of the right ventricle, the aorta arching out of the left ventricle, one
    # pulmonary vein into the left atrium
    import math
    vessel(ax, [(2.1, 6.3), (2.1, 9.6)], 0.8, "vena cava", _blood(p, "vena cava"), z=4)
    ax.plot([1.7, 2.5], [9.6, 9.6], color=INK, linewidth=1.2, zorder=4.01)
    vessel(ax, [(4.0, 4.3), (4.0, 9.6)], 0.8, "pulmonary artery", _blood(p, "pulmonary artery"), z=4)
    ax.plot([3.6, 4.4], [9.6, 9.6], color=INK, linewidth=1.2, zorder=4.01)
    arch = [(6.0, 4.3), (6.0, 8.4)] + [(6.9 + 0.9 * math.cos(math.radians(a)), 8.4 + 0.9 * math.sin(math.radians(a)))
                                      for a in range(175, 89, -5)] + [(10.4, 9.3)]
    vessel(ax, arch, 0.8, "aorta", _blood(p, "aorta"), z=4)
    ax.plot([10.4, 10.4], [8.9, 9.7], color=INK, linewidth=1.2, zorder=4.01)
    vessel(ax, [(8.0, 5.62), (10.4, 5.62)], 0.6, "pulmonary vein", _blood(p, "pulmonary vein"), z=4)
    ax.plot([10.4, 10.4], [5.32, 5.92], color=INK, linewidth=1.2, zorder=4.01)
    # semilunar valves: small pockets on the inside of each artery's base
    for x0, x1 in ((3.6, 4.4), (5.6, 6.4)):
        for x, s in ((x0, 1), (x1, -1)):
            ax.add_patch(Polygon([(x, 4.72), (x + s * 0.2, 4.86), (x + s * 0.24, 5.02), (x, 5.02)], closed=True,
                                 facecolor="white", edgecolor=INK, linewidth=0.9, zorder=4.5, gid="semilunar valve"))
    # the blood's path
    flow(ax, (2.1, 8.55), (2.1, 6.75), "vena cava>right atrium")
    flow(ax, (2.7, 5.2), (2.7, 3.6), "right atrium>right ventricle")
    flow(ax, (4.0, 3.4), (4.0, 6.2), "right ventricle>pulmonary artery")
    flow(ax, (4.0, 7.0), (4.0, 8.5), "pulmonary artery>lungs")
    flow(ax, (9.5, 5.62), (8.4, 5.62), "pulmonary vein>left atrium")
    flow(ax, (7.22, 5.25), (7.22, 3.6), "left atrium>left ventricle")
    flow(ax, (6.0, 3.4), (6.0, 7.4), "left ventricle>aorta")
    flow(ax, (7.1, 9.3), (9.0, 9.3), "aorta>body")
    for L, name in p["labels"].items():
        at, end = SLOT[name]
        letter(ax, L, at, end, gap=0.32, dot=True)
    ax.text(2.6, -1.05, "right side of the body", ha="center", va="center", fontsize=10, style="italic")
    ax.text(7.6, -1.05, "left side of the body", ha="center", va="center", fontsize=10, style="italic")
    bottom = -1.5
    if p["shaded"]:
        for x, face, words in ((0.3, OXY, "oxygenated blood"), (5.4, DEOXY, "deoxygenated blood")):
            ax.add_patch(Rectangle((x, -2.15), 0.5, 0.4, facecolor=face, edgecolor=INK, linewidth=0.9))
            ax.text(x + 0.75, -1.95, words, ha="left", va="center", fontsize=10)
        bottom = -2.4
    ax.set_xlim(-1.4, 12.0)
    ax.set_ylim(bottom, 10.85)
    ax.set_aspect("equal")
    ax.axis("off")
    ax.set_title("Section through the human heart, seen from the front", fontsize=12)
    return fig


# --- questions --------------------------------------------------------------------------------------

INTROS = ["{name} drew this diagram of the heart {setting}.", "{name} copied this section through the heart {setting}.",
          "{name} is using this diagram of the human heart {setting}.", "{name} sketched this heart {setting}."]
SETTINGS = ["in a biology lesson in Huye", "for a revision poster", "from a textbook in the school library in Musanze",
            "before a test on circulation", "for homework", "at the science club in Rubavu", "in a lesson on blood vessels",
            "for a class display in Nyagatare"]


def _cap(s: str) -> str:
    return s[0].upper() + s[1:]


def questions(p: dict, rng: random.Random) -> list:
    labels = p["labels"]
    at = {v: k for k, v in labels.items()}
    rest = lambda *keep: [k for k in labels if k not in keep]  # noqa: E731
    others = sorted(x for x in at if x not in ("aorta", "left ventricle"))
    ask, job = rng.sample(others, 2)
    intro = rng.choice(INTROS).format(name=rng.choice(NAMES), setting=rng.choice(SETTINGS))
    wrong = [at[c] for c in CONFUSE[ask] if c in at] + rng.sample(rest(at[ask]), len(labels) - 1)
    qs = [letter_choice(f"{intro} Which letter shows the {ask}?", at[ask], wrong)]
    options = [_cap(JOB[job])] + [_cap(JOB[c]) for c in JOB_CONFUSE[job]]
    rng.shuffle(options)
    stem = rng.choice(["What is the job of the part labelled {L}?", "What does the part labelled {L} do?"]).format(L=at[job])
    qs.append(Question("mcq", stem, str(options.index(_cap(JOB[job]))), options))
    wrong = [at[c] for c in ("pulmonary vein", "pulmonary artery", "vena cava", "left ventricle") if c in at] + rest(at["aorta"])
    qs.append(letter_choice(rng.choice(["Which letter shows the blood vessel that carries oxygenated blood from the heart to the body?",
                                        "Which letter shows the vessel that takes oxygenated blood away from the heart to the rest of the body?"]),
                            at["aorta"], wrong))
    wrong = [at[c] for c in ("right ventricle", "left atrium", "right atrium", "septum") if c in at] + rest(at["left ventricle"])
    qs.append(letter_choice(rng.choice(["Which letter shows the chamber with the thickest muscular wall?",
                                        "Which letter shows the chamber whose wall is thickest, because it pumps blood all round the body?"]),
                            at["left ventricle"], wrong))
    return qs
