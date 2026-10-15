"""The systems life cycle (UP; AL by ALSO_BANDS where the AS chapter is named for it): six boxes round a loop, joined
by arrows, in the order of the Cambridge IGCSE ICT (0417) syllabus: analysis, design, testing, implementation,
documentation, evaluation, and back to analysis. The boxes are lettered A to F by place (A at the top, then
clockwise), the cycle starts in any box and runs either way round, so a letter says nothing about a stage until the
arrows are read. One or two boxes are blank ("?").

- Which letter shows a blank stage (found from the fixed order and its printed neighbours)?
- Which stage comes straight after the stage in a box, where that box or the next is blank? The wrong options are
  the stage before it (reading the arrows backwards), the stage itself and the stage two on.
- In which box is the stage where something happens (a fixed table of what each stage does, the stage blank)?
"""
from __future__ import annotations

import math
import random

from matplotlib.patches import Circle, FancyBboxPatch, Polygon

from ..core import FILL_2, INK, NAMES, Question, mcq, new_figure

ID = "system_life_cycle"
KIND = "process.flow"
SUBJECT = "computing"
BANDS = ("UP",)
ALSO_BANDS = {"UP": ("AL",)}  # Cambridge AS Level IT chapter 15, "System life cycle", draws the same cycle
CONCEPTS = tuple(f"computing.{c}" for c in ("system-analysis", "system-implementation", "requirement-analysis",
                                            "problem-investigation"))
# A topic whose sections the book lists is reached only if its name or a section names the life cycle, systems
# analysis or its stages; an AS Level topic only if its name does.
NEEDS = (r"life ?cycle|systems? analysis|analysis of the current system|\banalysis\s*$|\bevaluation\b|"
         r"system implementation")
# The program development life cycle (IGCSE Computer Science) has other stages; databases and Visual Basic projects
# analyse requirements without this cycle.
AVOID = r"program development|visual basic|database|hardware"

ORDER = ["Analysis", "Design", "Testing", "Implementation", "Documentation", "Evaluation"]
DOES = {"Analysis": "the current system is studied and the users' needs are found",
        "Design": "the file structures, input forms and outputs of the new system are planned",
        "Testing": "the new system is tried out with normal, extreme and abnormal test data",
        "Implementation": "the old system is changed over to the new one",
        "Documentation": "the user guide and the technical guide are written",
        "Evaluation": "the new system is compared with the requirements"}
# The boxes' places, clockwise from the top, on an oval.
PLACES = [(3.75 * math.cos(math.radians(90 - 60 * k)), 2.3 * math.sin(math.radians(90 - 60 * k))) for k in range(6)]
BW, BH = 2.75, 0.72
OUTSIDE = [(0, BH / 2 + 0.38), (BW / 2 + 0.4, 0), (BW / 2 + 0.4, 0), (0, -BH / 2 - 0.38), (-BW / 2 - 0.4, 0),
           (-BW / 2 - 0.4, 0)]


def sample(rng: random.Random) -> dict:
    way = rng.choice(["cw", "cw", "acw"])
    # never analysis in box A running clockwise: the letters would then follow the stages, and A, B, C... be a guess
    start = rng.randrange(1, 6) if way == "cw" else rng.randrange(6)
    step = 1 if way == "cw" else -1
    at = {stage: (start + step * i) % 6 for i, stage in enumerate(ORDER)}
    boxes = [["ABCDEF"[k], next(s for s, pl in at.items() if pl == k)] for k in range(6)]
    blank = rng.sample(ORDER, rng.choice([1, 2, 2]))
    ask = rng.choice(blank)
    # the "after" box: one whose own stage or next stage is blank
    choices = [b[0] for b in boxes if b[1] in blank or ORDER[(ORDER.index(b[1]) + 1) % 6] in blank]
    after = rng.choice(choices)
    does = next((b for b in blank if b != ask), None)
    return {"band": "UP", "dir": way, "boxes": boxes, "blank": sorted(blank, key=ORDER.index), "ask": ask,
            "after": after, "does": does}


# --- drawing ----------------------------------------------------------------------------------------

def _leave(a, b, gap: float = 0.08) -> float:
    """How far along the segment from a to b it leaves a box centred on a (as a fraction of its length)."""
    dx, dy = b[0] - a[0], b[1] - a[1]
    tx = (BW / 2 + gap) / abs(dx) if dx else math.inf
    ty = (BH / 2 + gap) / abs(dy) if dy else math.inf
    return min(tx, ty)


def draw(p: dict):
    fig, ax = new_figure(8.2, 5.8)
    step = 1 if p["dir"] == "cw" else -1
    blank = set(p["blank"])
    for k, (letter, stage) in enumerate(p["boxes"]):
        x, y = PLACES[k]
        ax.add_patch(FancyBboxPatch((x - BW / 2, y - BH / 2), BW, BH, boxstyle="round,pad=0.04",
                                    facecolor="white" if stage in blank else FILL_2, edgecolor=INK, linewidth=1.4,
                                    linestyle="--" if stage in blank else "-"))
        ax.text(x, y, "?" if stage in blank else stage, ha="center", va="center",
                fontsize=13 if stage in blank else 10.5, fontweight="bold", gid=f"box:{letter}")
        # the letter, outside the loop, clear of the arrows: above the top box, below the bottom one, beside the rest
        dx, dy = OUTSIDE[k]
        lx, ly = x + dx, y + dy
        ax.add_patch(Circle((lx, ly), 0.24, facecolor="white", edgecolor=INK, linewidth=1.2))
        ax.text(lx, ly, letter, ha="center", va="center", fontsize=12, fontweight="bold", gid=f"letter:{letter}")
    for k in range(6):
        a, b = PLACES[k], PLACES[(k + step) % 6]
        t0, t1 = _leave(a, b), 1 - _leave(b, a)
        s = (a[0] + (b[0] - a[0]) * t0, a[1] + (b[1] - a[1]) * t0)
        e = (a[0] + (b[0] - a[0]) * t1, a[1] + (b[1] - a[1]) * t1)
        ux, uy = (e[0] - s[0]), (e[1] - s[1])
        n = math.hypot(ux, uy)
        ux, uy = ux / n, uy / n
        tip = e
        base = (e[0] - 0.24 * ux, e[1] - 0.24 * uy)
        ax.plot([s[0], base[0]], [s[1], base[1]], color=INK, linewidth=1.8, gid=f"arrow:{k}")
        ax.add_patch(Polygon([tip, (base[0] - 0.1 * uy, base[1] + 0.1 * ux), (base[0] + 0.1 * uy, base[1] - 0.1 * ux)],
                             closed=True, facecolor=INK, edgecolor=INK))
    ax.text(0, 0.18, "The systems", ha="center", va="center", fontsize=11, color="#333333")
    ax.text(0, -0.18, "life cycle", ha="center", va="center", fontsize=11, color="#333333")
    ax.set_xlim(-5.85, 5.85)
    ax.set_ylim(-3.5, 3.5)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


# --- questions --------------------------------------------------------------------------------------

SETTINGS = ["in an ICT lesson", "for homework", "on a revision card", "for a class test", "at the computer club"]
VERBS = ["drew", "sketched", "copied"]
TEAMS = ["for a new library system at a school in Huye", "for a new booking system at a Rubavu hotel",
         "for a new stock system at a Kigali shop", "for a new records system at a Musanze clinic",
         "for a new payroll system at a Nyanza cooperative"]


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    letter = {stage: k for k, stage in p["boxes"]}
    stage_in = {k: stage for k, stage in p["boxes"]}
    step = 1 if p["dir"] == "cw" else -1
    by_place = [b[0] for b in p["boxes"]]

    def near(lt: str, d: int) -> str:
        return by_place[(by_place.index(lt) + d) % 6]

    ask = p["ask"]
    key = letter[ask]
    slips = [near(key, step), near(key, -step)] + [letter[b] for b in p["blank"] if b != ask]
    slips += [x for x in by_place if x not in slips and x != key]
    options = sorted([key] + [x for x in dict.fromkeys(slips) if x != key][:3])
    out = [Question("mcq", f"{who} {rng.choice(VERBS)} the systems life cycle {rng.choice(TEAMS)} {rng.choice(SETTINGS)}. "
                           f"Which letter shows the {ask.lower()} stage?", str(options.index(key)), options)]
    box = p["after"]
    here = stage_in[box]
    nxt = ORDER[(ORDER.index(here) + 1) % 6]
    wrong = [ORDER[(ORDER.index(here) - 1) % 6], here, ORDER[(ORDER.index(here) + 2) % 6]]
    out.append(mcq(f"The arrows show the order of the stages. Which stage comes straight after the stage in box {box}?",
                   nxt, wrong, rng))
    if p["does"]:
        st = p["does"]
        k = letter[st]
        slips = [near(k, step), near(k, -step), letter[ask]]
        slips += [x for x in by_place if x not in slips and x != k]
        options = sorted([k] + [x for x in dict.fromkeys(slips) if x != k][:3])
        out.append(Question("mcq", f"In which box is the stage where {DOES[st]}?", str(options.index(k)), options))
    return out
