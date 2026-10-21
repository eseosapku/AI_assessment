"""Community helpers and their tools or workplaces (P1 to P3, Social and Citizenship Studies), of two kinds.

- tools: four helpers in a row, each a simple picture of a person in a work uniform with the helper's job printed
  under them and a letter (A to D) in the box's corner; under them four tools, each drawn in a box headed Tool 1 to
  Tool 4 (never named), one for each helper, in a shuffled order. Which letter shows the helper who uses tool 3? Which
  tool does the farmer use?
- places: the same four helpers, and four workplaces drawn (never named), headed Place 1 to Place 4. Which letter shows
  the helper who works in place 2? Where does the mechanic work?

Every key comes from the fixed tables below, which a Primary teacher would agree with: a doctor's stethoscope, a
nurse's syringe, a farmer's hoe, a teacher's chalkboard, a mechanic's spanner, a tailor's sewing machine, a
carpenter's saw, a traffic police officer's whistle; the health centre, the farm, the school, the garage, the tailor's
shop and the carpenter's workshop. A doctor and a nurse never stand in one figure (they share their tools and their
workplace), nor a teacher and a police officer among the tools (a teacher may blow a whistle at games).
"""
from __future__ import annotations

import math
import random

from matplotlib.patches import Circle, Ellipse, FancyBboxPatch, Polygon, Rectangle

from ..core import INK, NAMES, Question, new_figure

ID = "community_helpers_p"
KIND = "diagram.template"
SUBJECT = "social-studies"
BANDS = ("P",)
CONCEPTS = ("social-studies.community-helpers",)
# A topic whose sections the book lists is reached only if its name or a section names community helpers or jobs.
NEEDS = r"community helpers|helpers|occupations|jobs"
# Never a religious, values or behaviour topic.
AVOID = (r"\bgod\b|god's|bible|qur'?an|prayer|faith|\bsin\b|creation|commandment|charity|"
         r"democracy and governance|rights|historical events|conflict|genocide|values|behaviour|peace|harmony|"
         r"environmental responsibility|national unity|rules and fairness")

TOOL = {"doctor": "stethoscope", "nurse": "syringe", "farmer": "hoe", "teacher": "chalkboard", "mechanic": "spanner",
        "tailor": "sewing machine", "carpenter": "saw", "police officer": "whistle"}
PLACE = {"doctor": "health centre", "nurse": "health centre", "farmer": "farm", "teacher": "school",
         "mechanic": "garage", "tailor": "tailor's shop", "carpenter": "carpenter's workshop"}
APART = {"tools": [{"doctor", "nurse"}, {"teacher", "police officer"}], "places": [{"doctor", "nurse"}]}


def stages(p: dict) -> tuple[int, int]:
    return (1, 3)


def sample(rng: random.Random) -> dict:
    sub = rng.choice(["tools", "places"])
    table = TOOL if sub == "tools" else PLACE
    while True:
        helpers = rng.sample(sorted(table), 4)
        if not any(pair <= set(helpers) for pair in APART[sub]):
            break
    things = [table[h] for h in helpers]
    rng.shuffle(things)
    return {"band": "P", "sub": sub, "helpers": helpers, "things": things, "ask_thing": rng.randrange(4),
            "ask_helper": rng.choice(helpers)}


# --- the people -----------------------------------------------------------------------------------------

SKIN = "#8d5524"
UNIFORM = {"doctor": ("#fdfefe", "#5d6d7e"), "nurse": ("#d6eaf8", "#d6eaf8"), "farmer": ("#58d68d", "#7e5109"),
           "teacher": ("#af7ac5", "#34495e"), "mechanic": ("#2e86c1", "#2e86c1"), "tailor": ("#f5b041", "#5d6d7e"),
           "carpenter": ("#ec7063", "#7e5109"), "police officer": ("#1b4f72", "#1b4f72")}


def person(ax, kind: str, cx: float, y0: float, s: float = 1.0) -> None:
    """A helper standing, feet at y0, about 1.7 units tall at size 1, in the job's uniform and hat."""
    shirt, trousers = UNIFORM[kind]

    def R(x, y, w, h, face, z=3, lw=1.2):
        ax.add_patch(Rectangle((cx + x * s, y0 + y * s), w * s, h * s, facecolor=face, edgecolor=INK, linewidth=lw,
                               zorder=z))

    R(-0.2, 0.0, 0.17, 0.62, trousers)
    R(0.03, 0.0, 0.17, 0.62, trousers)
    ax.add_patch(FancyBboxPatch((cx - 0.3 * s, y0 + 0.55 * s), 0.6 * s, 0.68 * s,
                                boxstyle=f"round,pad=0,rounding_size={0.1 * s}", facecolor=shirt, edgecolor=INK,
                                linewidth=1.2, zorder=3.1))
    for side in (-1, 1):
        ax.add_patch(Polygon([(cx + side * 0.3 * s, y0 + 1.18 * s), (cx + side * 0.44 * s, y0 + 0.62 * s),
                              (cx + side * 0.34 * s, y0 + 0.6 * s), (cx + side * 0.28 * s, y0 + 0.9 * s)],
                             closed=True, facecolor=shirt, edgecolor=INK, linewidth=1.2, zorder=3))
        ax.add_patch(Circle((cx + side * 0.39 * s, y0 + 0.57 * s), 0.06 * s, facecolor=SKIN, edgecolor=INK,
                            linewidth=1.0, zorder=3.2))
    ax.add_patch(Circle((cx, y0 + 1.42 * s), 0.21 * s, facecolor=SKIN, edgecolor=INK, linewidth=1.2, zorder=3.3))
    if kind == "doctor":  # a white coat open over a shirt and tie
        ax.add_patch(Polygon([(cx - 0.08 * s, y0 + 1.22 * s), (cx + 0.08 * s, y0 + 1.22 * s), (cx, y0 + 0.9 * s)],
                             closed=True, facecolor="#2e86c1", edgecolor=INK, linewidth=0.8, zorder=3.2))
        R(-0.28, 0.35, 0.56, 0.22, "#fdfefe", z=3.05)
    elif kind == "nurse":  # a white cap with a red cross
        ax.add_patch(Polygon([(cx - 0.2 * s, y0 + 1.55 * s), (cx + 0.2 * s, y0 + 1.55 * s), (cx + 0.15 * s, y0 + 1.72 * s),
                              (cx - 0.15 * s, y0 + 1.72 * s)], closed=True, facecolor="white", edgecolor=INK,
                             linewidth=1.0, zorder=3.4))
        R(-0.025, 1.58, 0.05, 0.12, "#e74c3c", z=3.5, lw=0)
        R(-0.06, 1.615, 0.12, 0.05, "#e74c3c", z=3.5, lw=0)
    elif kind == "farmer":  # a wide straw hat
        ax.add_patch(Ellipse((cx, y0 + 1.58 * s), 0.7 * s, 0.14 * s, facecolor="#f4d03f", edgecolor=INK, linewidth=1.0,
                             zorder=3.4))
        ax.add_patch(Polygon([(cx - 0.17 * s, y0 + 1.6 * s), (cx + 0.17 * s, y0 + 1.6 * s), (cx + 0.12 * s, y0 + 1.76 * s),
                              (cx - 0.12 * s, y0 + 1.76 * s)], closed=True, facecolor="#f4d03f", edgecolor=INK,
                             linewidth=1.0, zorder=3.5))
    elif kind == "teacher":  # short hair and a book under the arm
        ax.add_patch(Ellipse((cx, y0 + 1.56 * s), 0.42 * s, 0.16 * s, facecolor="#1c1c1c", edgecolor=INK, linewidth=0.8,
                             zorder=3.4))
        R(0.3, 0.68, 0.22, 0.28, "#c0392b", z=3.3)
    elif kind == "mechanic":  # overalls and a cap
        R(-0.12, 0.62, 0.24, 0.4, "#1f618d", z=3.2, lw=0.8)
        ax.add_patch(Polygon([(cx - 0.21 * s, y0 + 1.5 * s), (cx + 0.32 * s, y0 + 1.5 * s), (cx + 0.18 * s, y0 + 1.58 * s),
                              (cx + 0.18 * s, y0 + 1.68 * s), (cx - 0.18 * s, y0 + 1.68 * s)], closed=True,
                             facecolor="#e74c3c", edgecolor=INK, linewidth=1.0, zorder=3.4))
    elif kind == "tailor":  # a tape measure round the neck
        ax.plot([cx - 0.12 * s, cx - 0.14 * s, cx - 0.12 * s], [y0 + 1.22 * s, y0 + 0.95 * s, y0 + 0.7 * s],
                color="#f7dc6f", linewidth=4, zorder=3.3, solid_capstyle="butt")
        ax.plot([cx + 0.12 * s, cx + 0.14 * s, cx + 0.12 * s], [y0 + 1.22 * s, y0 + 0.95 * s, y0 + 0.7 * s],
                color="#f7dc6f", linewidth=4, zorder=3.3, solid_capstyle="butt")
        ax.add_patch(Ellipse((cx, y0 + 1.57 * s), 0.42 * s, 0.14 * s, facecolor="#1c1c1c", edgecolor=INK, linewidth=0.8,
                             zorder=3.4))
    elif kind == "carpenter":  # an apron and a cap
        R(-0.22, 0.45, 0.44, 0.6, "#a0522d", z=3.2, lw=0.8)
        ax.add_patch(Polygon([(cx - 0.2 * s, y0 + 1.52 * s), (cx + 0.2 * s, y0 + 1.52 * s), (cx + 0.16 * s, y0 + 1.68 * s),
                              (cx - 0.16 * s, y0 + 1.68 * s)], closed=True, facecolor="#5d6d7e", edgecolor=INK,
                             linewidth=1.0, zorder=3.4))
    elif kind == "police officer":  # a peaked cap with a badge
        ax.add_patch(Polygon([(cx - 0.24 * s, y0 + 1.53 * s), (cx + 0.24 * s, y0 + 1.53 * s), (cx + 0.28 * s, y0 + 1.7 * s),
                              (cx - 0.28 * s, y0 + 1.7 * s)], closed=True, facecolor="#1b4f72", edgecolor=INK,
                             linewidth=1.0, zorder=3.4))
        R(-0.26, 1.48, 0.52, 0.06, INK, z=3.45, lw=0)
        ax.add_patch(Circle((cx, y0 + 1.62 * s), 0.04 * s, facecolor="#f4d03f", edgecolor=INK, linewidth=0.6, zorder=3.5))
        ax.add_patch(Circle((cx - 0.15 * s, y0 + 1.05 * s), 0.05 * s, facecolor="#f4d03f", edgecolor=INK, linewidth=0.6,
                            zorder=3.3))
    else:
        raise ValueError(kind)


# --- the tools ---------------------------------------------------------------------------------------------

def tool(ax, kind: str, cx: float, cy: float, s: float = 1.0) -> None:
    """A tool centred on (cx, cy), about 1.5 units wide and 1.1 high at size 1."""
    def P(x, y):
        return (cx + x * s, cy + y * s)

    def line(*pts, color=INK, lw=2.0, z=3):
        ax.plot([P(*q)[0] for q in pts], [P(*q)[1] for q in pts], color=color, linewidth=lw, zorder=z,
                solid_capstyle="round")

    if kind == "stethoscope":
        for side in (-1, 1):
            line((side * 0.32, 0.5), (side * 0.3, 0.3), (side * 0.12, 0.05), (0.0, -0.05), lw=3.0, color="#2c3e50")
            ax.add_patch(Circle(P(side * 0.32, 0.52), 0.05 * s, facecolor="#7f8c8d", edgecolor=INK, linewidth=1.0, zorder=4))
        arc = [(0.0 + 0.35 * math.sin(t), -0.05 - 0.35 * (1 - math.cos(t))) for t in [k * math.pi / 16 for k in range(9)]]
        line(*arc, lw=3.0, color="#2c3e50")
        end = arc[-1]
        ax.add_patch(Circle(P(end[0] + 0.05, end[1] - 0.08), 0.13 * s, facecolor="#bdc3c7", edgecolor=INK, linewidth=1.4,
                            zorder=4))
    elif kind == "syringe":
        ax.add_patch(Rectangle(P(-0.45, -0.12), 0.75 * s, 0.24 * s, facecolor="#ebf5fb", edgecolor=INK, linewidth=1.4,
                               zorder=3))
        ax.add_patch(Rectangle(P(-0.1, -0.1), 0.38 * s, 0.2 * s, facecolor="#85c1e9", edgecolor="none", zorder=3.1))
        for k in range(5):
            line((-0.35 + 0.13 * k, 0.12), (-0.35 + 0.13 * k, 0.03), lw=1.2, z=3.2)
        line((-0.75, 0.0), (-0.45, 0.0), lw=3.0)
        line((-0.75, -0.16), (-0.75, 0.16), lw=4.0)
        ax.add_patch(Polygon([P(0.3, -0.06), P(0.42, -0.03), P(0.42, 0.03), P(0.3, 0.06)], closed=True, facecolor="#bdc3c7",
                             edgecolor=INK, linewidth=1.0, zorder=3))
        line((0.42, 0.0), (0.75, 0.0), lw=1.4)
    elif kind == "hoe":
        line((-0.25, -0.2), (0.65, 0.55), color="#a0522d", lw=6.0)
        ax.add_patch(Polygon([P(-0.5, -0.18), P(-0.1, -0.26), P(0.08, -0.6), P(-0.68, -0.58)], closed=True,
                             facecolor="#7f8c8d", edgecolor=INK, linewidth=1.4, zorder=4))
    elif kind == "chalkboard":
        ax.add_patch(Rectangle(P(-0.75, -0.45), 1.5 * s, 0.95 * s, facecolor="#a0522d", edgecolor=INK, linewidth=1.4,
                               zorder=3))
        ax.add_patch(Rectangle(P(-0.67, -0.37), 1.34 * s, 0.79 * s, facecolor="#1e5631", edgecolor=INK, linewidth=1.0,
                               zorder=3.1))
        for k, y in enumerate((0.22, 0.02, -0.18)):
            xs = [-0.55 + 0.02 * i for i in range(46 - 12 * (k == 2))]
            ax.plot([P(x, 0)[0] for x in xs], [P(0, y + 0.04 * math.sin(i * 1.3))[1] for i, x in enumerate(xs)],
                    color="white", linewidth=1.6, zorder=3.2)
        ax.add_patch(Rectangle(P(0.35, -0.5), 0.22 * s, 0.07 * s, facecolor="white", edgecolor=INK, linewidth=0.8,
                               zorder=3.3))
    elif kind == "spanner":
        ang = math.radians(25)
        ca, sa = math.cos(ang), math.sin(ang)

        def rot(x, y):
            return P(x * ca - y * sa, x * sa + y * ca)

        ax.add_patch(Polygon([rot(-0.55, -0.07), rot(0.55, -0.07), rot(0.55, 0.07), rot(-0.55, 0.07)], closed=True,
                             facecolor="#aab7b8", edgecolor=INK, linewidth=1.4, zorder=3))
        for end in (-1, 1):
            x0 = end * 0.62
            jaw = [rot(x0 + end * 0.2 * math.cos(t), 0.2 * math.sin(t)) for t in
                   [math.radians(a) for a in range(-150 if end > 0 else 30, 160 if end > 0 else 340, 10)]]
            ax.add_patch(Polygon(jaw, closed=True, facecolor="#aab7b8", edgecolor=INK, linewidth=1.4, zorder=3.1))
            ax.add_patch(Polygon([rot(x0 + end * 0.04, -0.075), rot(x0 + end * 0.25, -0.075), rot(x0 + end * 0.25, 0.075),
                                  rot(x0 + end * 0.04, 0.075)], closed=True, facecolor="#f4f6f7", edgecolor="none",
                                 zorder=3.2))
    elif kind == "sewing machine":
        ax.add_patch(Rectangle(P(-0.75, -0.5), 1.5 * s, 0.14 * s, facecolor="#a0522d", edgecolor=INK, linewidth=1.4,
                               zorder=3))
        ax.add_patch(Polygon([P(0.25, -0.36), P(0.55, -0.36), P(0.55, 0.4), P(-0.6, 0.4), P(-0.6, 0.1), P(0.25, 0.1)],
                             closed=True, facecolor="#1c1c1c", edgecolor=INK, linewidth=1.4, zorder=3))
        ax.add_patch(Rectangle(P(-0.62, -0.05), 0.14 * s, 0.17 * s, facecolor="#1c1c1c", edgecolor=INK, linewidth=1.2,
                               zorder=3))
        line((-0.55, -0.05), (-0.55, -0.3), lw=1.8, color="#7f8c8d")
        ax.add_patch(Circle(P(0.62, 0.15), 0.17 * s, facecolor="#7f8c8d", edgecolor=INK, linewidth=1.2, zorder=3.2))
        line((-0.35, 0.3), (0.2, 0.3), lw=2.0, color="#f4d03f", z=3.3)
        ax.add_patch(Circle(P(-0.1, 0.48), 0.07 * s, facecolor="#e74c3c", edgecolor=INK, linewidth=1.0, zorder=3.1))
    elif kind == "saw":
        teeth = [P(-0.35 + 0.1 * k + (0.05 if j else 0.0), -0.2 - (0.08 if j else 0.0)) for k in range(10) for j in (0, 1)]
        blade = [P(-0.35, 0.2), P(0.75, 0.08), P(0.75, -0.2)] + teeth[::-1][1:] + [P(-0.35, -0.2)]
        ax.add_patch(Polygon(blade, closed=True, facecolor="#d5dbdb", edgecolor=INK, linewidth=1.3, zorder=3))
        ax.add_patch(FancyBboxPatch(P(-0.75, -0.3), 0.42 * s, 0.6 * s, boxstyle=f"round,pad=0,rounding_size={0.12 * s}",
                                    facecolor="#a0522d", edgecolor=INK, linewidth=1.4, zorder=3.1))
        ax.add_patch(Ellipse(P(-0.54, 0.0), 0.2 * s, 0.3 * s, facecolor="white", edgecolor=INK, linewidth=1.0, zorder=3.2))
    elif kind == "whistle":
        ax.add_patch(Circle(P(-0.15, -0.05), 0.3 * s, facecolor="#d5dbdb", edgecolor=INK, linewidth=1.4, zorder=3))
        ax.add_patch(Rectangle(P(-0.15, 0.03), 0.75 * s, 0.22 * s, facecolor="#d5dbdb", edgecolor=INK, linewidth=1.4,
                               zorder=3.1))
        ax.add_patch(Rectangle(P(-0.05, 0.25), 0.15 * s, 0.07 * s, facecolor="#1c1c1c", edgecolor=INK, linewidth=0.8,
                               zorder=3.2))
        ax.add_patch(Circle(P(-0.43, 0.18), 0.08 * s, facecolor="none", edgecolor=INK, linewidth=1.4, zorder=3.2))
        ax.add_patch(Ellipse(P(-0.43, 0.48), 0.26 * s, 0.44 * s, facecolor="none", edgecolor="#e74c3c", linewidth=2.0,
                             zorder=3.1))  # the cord, hanging from the ring
    else:
        raise ValueError(kind)


# --- the places -------------------------------------------------------------------------------------------

def place(ax, kind: str, cx: float, cy: float, s: float = 1.0) -> None:
    """A workplace centred on (cx, cy), about 1.7 units wide and 1.2 high at size 1."""
    def P(x, y):
        return (cx + x * s, cy + y * s)

    def R(x, y, w, h, face, z=3, lw=1.2):
        ax.add_patch(Rectangle(P(x, y), w * s, h * s, facecolor=face, edgecolor=INK, linewidth=lw, zorder=z))

    def roof(x0, x1, y, top, face, z=3.2):
        ax.add_patch(Polygon([P(x0, y), P(x1, y), P((x0 + x1) / 2, top)], closed=True, facecolor=face, edgecolor=INK,
                             linewidth=1.2, zorder=z))

    ax.add_patch(Rectangle(P(-0.85, -0.6), 1.7 * s, 0.12 * s, facecolor="#abebc6", edgecolor="none", zorder=2))
    if kind == "health centre":
        R(-0.7, -0.5, 1.4, 0.75, "white")
        roof(-0.8, 0.8, 0.25, 0.55, "#5dade2")
        R(-0.12, 0.33, 0.24, 0.17, "white", z=3.3, lw=0.8)
        R(-0.025, 0.35, 0.05, 0.13, "#e74c3c", z=3.4, lw=0)
        R(-0.08, 0.39, 0.16, 0.05, "#e74c3c", z=3.4, lw=0)
        R(-0.12, -0.5, 0.24, 0.42, "#85c1e9", z=3.1)
        for x in (-0.55, 0.35):
            R(x, -0.15, 0.2, 0.2, "#d6eaf8", z=3.1)
        R(-0.6, 0.06, 0.3, 0.12, "#e74c3c", z=3.1, lw=0.6)
        R(0.3, 0.06, 0.3, 0.12, "#e74c3c", z=3.1, lw=0.6)
    elif kind == "farm":
        ax.add_patch(Polygon([P(-0.85, -0.48), P(0.85, -0.48), P(0.6, 0.15), P(-0.6, 0.15)], closed=True,
                             facecolor="#a04000", edgecolor=INK, linewidth=1.2, zorder=3))
        for row, y in enumerate((-0.35, -0.12, 0.08)):
            half = 0.75 - 0.12 * row
            for k in range(6):
                x = -half + 2 * half * (k + 0.5) / 6
                ax.add_patch(Ellipse(P(x, y + 0.05), 0.14 * s, 0.12 * s, facecolor="#27ae60", edgecolor=INK,
                                     linewidth=0.6, zorder=3.1))
        line_x = [P(0.55, 0.15), P(0.55, 0.48)]
        ax.plot([q[0] for q in line_x], [q[1] for q in line_x], color="#7e5109", linewidth=3.0, zorder=3)
        for t in (-0.5, 0.0, 0.5, 1.0):
            ax.add_patch(Ellipse(P(0.55 + 0.17 * math.cos(t * 2), 0.48 + 0.09 * math.sin(t * 2)), 0.32 * s, 0.1 * s,
                                 angle=math.degrees(t * 2), facecolor="#58d68d", edgecolor=INK, linewidth=0.6, zorder=3.1))
        R(-0.65, 0.15, 0.4, 0.3, "#f6ddcc", z=3)
        roof(-0.72, -0.18, 0.45, 0.65, "#d4ac0d")
    elif kind == "school":
        R(-0.8, -0.5, 1.6, 0.7, "#fdebd0")
        ax.add_patch(Polygon([P(-0.88, 0.2), P(0.88, 0.2), P(0.7, 0.42), P(-0.7, 0.42)], closed=True, facecolor="#c0392b",
                             edgecolor=INK, linewidth=1.2, zorder=3.2))
        for x in (-0.65, -0.35, 0.2, 0.5):
            R(x, -0.2, 0.18, 0.2, "#d6eaf8", z=3.1)
        R(-0.1, -0.5, 0.2, 0.38, "#7e5109", z=3.1)
        ax.plot([P(0.0, 0.42)[0], P(0.0, 0.7)[0]], [P(0.0, 0.42)[1], P(0.0, 0.7)[1]], color=INK, linewidth=1.6, zorder=3.3)
        ax.add_patch(Polygon([P(0.0, 0.7), P(0.28, 0.65), P(0.0, 0.58)], closed=True, facecolor="#2e86c1", edgecolor=INK,
                             linewidth=0.8, zorder=3.3))
        for x in (-0.55, -0.4):
            ax.add_patch(Circle(P(x + 0.95, -0.42), 0.05 * s, facecolor=SKIN, edgecolor=INK, linewidth=0.6, zorder=3.4))
    elif kind == "garage":
        R(-0.8, -0.5, 1.6, 0.85, "#d5dbdb")
        R(-0.7, -0.5, 0.95, 0.6, "#566573", z=3.1)
        ax.add_patch(Polygon([P(-0.62, -0.42), P(0.15, -0.42), P(0.15, -0.25), P(0.0, -0.23), P(-0.1, -0.1),
                              P(-0.42, -0.1), P(-0.5, -0.23), P(-0.62, -0.25)], closed=True, facecolor="#e74c3c",
                             edgecolor=INK, linewidth=1.0, zorder=3.2))
        for x in (-0.45, -0.05):
            ax.add_patch(Circle(P(x, -0.43), 0.07 * s, facecolor="#1c1c1c", edgecolor=INK, linewidth=0.8, zorder=3.3))
        for k in range(3):
            ax.add_patch(Ellipse(P(0.55, -0.42 + 0.11 * k), 0.36 * s, 0.11 * s, facecolor="#1c1c1c", edgecolor="#7f8c8d",
                                 linewidth=1.0, zorder=3.2))
        ax.add_patch(Polygon([P(0.32, 0.12), P(0.42, 0.22), P(0.66, 0.0), P(0.6, -0.06)], closed=True,
                             facecolor="#aab7b8", edgecolor=INK, linewidth=0.8, zorder=3.3))
    elif kind == "tailor's shop":
        R(-0.8, -0.5, 1.6, 0.8, "#fcf3cf")
        for k in range(6):
            ax.add_patch(Polygon([P(-0.8 + 0.267 * k, 0.3), P(-0.8 + 0.267 * (k + 1), 0.3), P(-0.8 + 0.267 * (k + 1), 0.48),
                                  P(-0.8 + 0.267 * k, 0.48)], closed=True, facecolor="#e74c3c" if k % 2 == 0 else "white",
                                 edgecolor=INK, linewidth=0.8, zorder=3.2))
        R(-0.7, -0.4, 1.0, 0.6, "#d6eaf8", z=3.1)
        ax.plot([P(-0.65, 0.12)[0], P(0.25, 0.12)[0]], [P(0, 0.12)[1]] * 2, color=INK, linewidth=1.4, zorder=3.3)
        ax.add_patch(Polygon([P(-0.55, 0.1), P(-0.3, 0.1), P(-0.22, 0.0), P(-0.27, -0.03), P(-0.3, -0.25),
                              P(-0.55, -0.25), P(-0.58, -0.03), P(-0.63, 0.0)], closed=True, facecolor="#5dade2",
                             edgecolor=INK, linewidth=0.8, zorder=3.4))
        ax.add_patch(Polygon([P(-0.05, 0.1), P(0.12, 0.1), P(0.22, -0.32), P(-0.15, -0.32)], closed=True,
                             facecolor="#f1948a", edgecolor=INK, linewidth=0.8, zorder=3.4))
        R(0.4, -0.5, 0.28, 0.5, "#7e5109", z=3.1)
    elif kind == "carpenter's workshop":
        R(-0.8, -0.5, 1.0, 0.75, "#d7bde2")
        roof(-0.88, 0.28, 0.25, 0.55, "#7e5109")
        R(-0.5, -0.5, 0.35, 0.5, "#7e5109", z=3.1)
        for k in range(3):  # planks leaning on the wall
            ax.add_patch(Polygon([P(0.3 + 0.12 * k, -0.5), P(0.38 + 0.12 * k, -0.5), P(0.25 + 0.12 * k, 0.25),
                                  P(0.17 + 0.12 * k, 0.25)], closed=True, facecolor="#d4ac0d", edgecolor=INK,
                                 linewidth=0.8, zorder=3.2))
        R(0.55, -0.22, 0.3, 0.06, "#a0522d", z=3.3)  # a stool
        for x in (0.57, 0.79):
            R(x, -0.5, 0.04, 0.28, "#a0522d", z=3.3, lw=0.8)
    else:
        raise ValueError(kind)


# --- drawing ----------------------------------------------------------------------------------------

BOX_W, GAP = 2.35, 0.3
TOP_H, LOW_H = 2.7, 2.3
RING = 0.25


def draw(p: dict):
    fig, ax = new_figure(10.0, 6.6)
    width = 4 * BOX_W + 3 * GAP
    y_top = LOW_H + 0.45
    noun = "Tool" if p["sub"] == "tools" else "Place"
    for i, h in enumerate(p["helpers"]):
        x0 = i * (BOX_W + GAP)
        ax.add_patch(FancyBboxPatch((x0, y_top), BOX_W, TOP_H, boxstyle="round,pad=0,rounding_size=0.12",
                                    facecolor="#fbfbf6", edgecolor=INK, linewidth=1.4, zorder=1, gid=f"box:{i}"))
        person(ax, h, x0 + BOX_W / 2 + 0.15, y_top + 0.62, 1.05)
        ax.text(x0 + BOX_W / 2, y_top + 0.3, h, ha="center", va="center", fontsize=13, gid=f"helper:{i}")
        ax.add_patch(Circle((x0 + 0.38, y_top + TOP_H - 0.36), RING, facecolor="white", edgecolor=INK, linewidth=1.6,
                            zorder=6, gid=f"ring:{i}"))
        ax.text(x0 + 0.38, y_top + TOP_H - 0.36, "ABCD"[i], ha="center", va="center", fontsize=15, fontweight="bold",
                zorder=7, gid=f"letter:{i}")
    for i, thing in enumerate(p["things"]):
        x0 = i * (BOX_W + GAP)
        ax.add_patch(FancyBboxPatch((x0, 0), BOX_W, LOW_H, boxstyle="round,pad=0,rounding_size=0.12",
                                    facecolor="#f4f6f7", edgecolor=INK, linewidth=1.4, zorder=1))
        ax.text(x0 + BOX_W / 2, LOW_H - 0.3, f"{noun} {i + 1}", ha="center", va="center", fontsize=13,
                fontweight="bold", gid=f"number:{i}")
        if p["sub"] == "tools":
            tool(ax, thing, x0 + BOX_W / 2, 0.95, 1.05)
        else:
            place(ax, thing, x0 + BOX_W / 2, 0.92, 1.15)
    ax.set_xlim(-0.05, width + 0.05)
    ax.set_ylim(-0.05, y_top + TOP_H + 0.05)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


# --- questions --------------------------------------------------------------------------------------

VERBS = ["looks at", "talks about", "points at", "studies"]
SETTINGS = ["at school", "in class", "at home", "with a friend", "in a Social Studies lesson", "with the class"]


def _choose(stem: str, key: str, options: list) -> Question:
    return Question("mcq", stem, str(options.index(key)), options)


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    helpers, things = p["helpers"], p["things"]
    table = TOOL if p["sub"] == "tools" else PLACE
    noun = "tool" if p["sub"] == "tools" else "place"
    lead = f"{who} {rng.choice(VERBS)} the pictures {rng.choice(SETTINGS)}."
    n = p["ask_thing"]
    holder = next(i for i, h in enumerate(helpers) if table[h] == things[n])
    does = "uses it" if noun == "tool" else "works there"
    h = p["ask_helper"]
    numbers = [f"{noun} {k + 1}" for k in range(4)]
    second = f"Which tool does the {h} use?" if noun == "tool" else f"Where does the {h} work?"
    return [_choose(f"{lead} Look at {noun} {n + 1}. Which letter shows the helper who {does}?", "ABCD"[holder],
                    list("ABCD")),
            _choose(second, f"{noun} {things.index(table[h]) + 1}", numbers)]
