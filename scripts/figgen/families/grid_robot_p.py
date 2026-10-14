"""A floor robot on a grid (P, Primary Computing): a 5 by 5 grid (6 by 6 at the upper level) with a robot on a grey
start square, an arrow on it showing the way it faces, and its program beside the grid as a list of blocks:
"forward 2", "turn left", "turn right". Turns are made on the spot, to the robot's own left or right, not the page's
(Review Focus 5). The path never leaves the grid and never crosses itself.

- trace: three or four squares are lettered. Which letter does the robot stop on, and how many squares does it move?
  The wrong letters are where the slips end: turning to the page's left or right instead of the robot's (always on
  the grid, and always a different square), turning the other way, counting the start square as a move.
- fix: one turn block is missing ("?"), and the robot should stop on an object (a house, a school, a tree, a
  flower). Which block goes there (the robot never faces up the page there, so the page's side is the wrong turn),
  and how many squares does the robot move to reach the object? The other objects stand where wrong blocks lead.
"""
from __future__ import annotations

import random

from matplotlib.patches import Circle, FancyBboxPatch, Polygon, Rectangle

from ..core import FILL, FILL_2, INK, NAMES, Question, mcq, new_figure, short

ID = "grid_robot_p"
KIND = "cs.code"
SUBJECT = "computing"
BANDS = ("P",)
CONCEPTS = tuple(f"computing.{c}" for c in ("algorithms", "coding-implementation", "program-testing-running",
                                            "sequence-control-structure", "robotics"))
# Rwanda SET teaches programming as a science topic ("Programming for Children", P4 to P6), whose concepts are these.
ALSO = ("science.scientific-method",)
# A topic whose sections the book lists is reached only if one names programming, robots or a programming unit.
NEEDS = (r"algorithm|program|robot|turtle|scratch|sequenc|animator|game developer|games developer|problem solver|"
         r"storyteller|innovator|designer|\bartist")
AVOID = r"\bdata\b|network|connected|secret|code cracker|thinking and working scientifically|science in context"

STEP = {"N": (0, 1), "E": (1, 0), "S": (0, -1), "W": (-1, 0)}
LEFT = {"N": "W", "W": "S", "S": "E", "E": "N"}
RIGHT = {v: k for k, v in LEFT.items()}
OBJECTS = ["house", "school", "tree", "flower"]


def walk(start, facing: str, program: list[str], slip: str = "") -> tuple[list[tuple[int, int]], str]:
    """Every square the robot stands on, in order, and the way it faces at the end. A slip: "page" turns to the page's
    left or right, "swap" turns the other way, "count" moves one square short (counting the start square)."""
    x, y = start
    path = [(x, y)]
    for cmd in program:
        if cmd in ("turn left", "turn right"):
            left = (cmd == "turn left") != (slip == "swap")
            facing = ("W" if left else "E") if slip == "page" else (LEFT if left else RIGHT)[facing]
        else:
            for _ in range(int(cmd.split()[1]) - (slip == "count")):
                x, y = x + STEP[facing][0], y + STEP[facing][1]
                path.append((x, y))
    return path, facing


def stages(p: dict) -> tuple[int, int] | None:
    return (3, 6) if p["level"] == "upper" else None


def _program(rng: random.Random, level: str) -> list[str]:
    turn = lambda: rng.choice(["turn left", "turn right"])  # noqa: E731
    if level == "lower":
        return [f"forward {rng.randint(1, 3)}", turn(), f"forward {rng.randint(1, 3)}"]
    shape = rng.choice(["FTFTF", "TFTF"])
    return [turn() if c == "T" else f"forward {rng.randint(1, 4)}" for c in shape]


def sample(rng: random.Random) -> dict:
    level = rng.choice(["lower", "upper"])
    mode = rng.choice(["trace", "fix"])
    n = 5 if level == "lower" else 6
    grid = {(x, y) for x in range(n) for y in range(n)}
    while True:
        start, facing = (rng.randrange(n), rng.randrange(n)), rng.choice("NESW")
        program = _program(rng, level)
        path, _ = walk(start, facing, program)
        if not set(path) <= grid or len(set(path)) != len(path):  # on the grid, never crossing itself
            continue
        end = path[-1]
        p = {"band": "P", "level": level, "mode": mode, "size": n, "start": list(start), "facing": facing}
        if mode == "trace":
            page = walk(start, facing, program, "page")[0][-1]
            if page == end or page not in grid or page == start:
                continue  # the page-turn slip must land on its own square of the grid
            spots = [end, page]
            for slip in ("swap", "count"):
                q = walk(start, facing, program, slip)[0][-1]
                if q in grid and q not in spots and q != start:
                    spots.append(q)
            spare = sorted(grid - set(spots) - {start})
            while len(spots) < 3 or (len(spots) < 4 and rng.random() < 0.5):
                spots.append(spare.pop(rng.randrange(len(spare))))
            letters = rng.sample("ABCD"[:len(spots)], len(spots))
            p.update(program=program, letters={k: list(v) for k, v in sorted(zip(letters, spots))})
            return p
        turns = [i for i, c in enumerate(program) if c.startswith("turn")]
        gap = rng.choice(turns)
        if walk(start, facing, program[:gap])[1] == "N":
            continue  # facing up the page, the page's side and the robot's agree: no slip to catch
        target = rng.choice(OBJECTS)
        objects = {target: end}
        other = "turn right" if program[gap] == "turn left" else "turn left"
        wrong = walk(start, facing, program[:gap] + [other] + program[gap + 1:])[0][-1]
        decoys = [o for o in OBJECTS if o != target]
        rng.shuffle(decoys)
        if wrong in grid and wrong != start and wrong != end:
            objects[decoys.pop()] = wrong
        spare = sorted(grid - set(objects.values()) - {start})
        objects[decoys.pop()] = spare[rng.randrange(len(spare))]
        shown = program[:gap] + ["?"] + program[gap + 1:]
        p.update(program=shown, target=target, objects={k: list(v) for k, v in sorted(objects.items())})
        p["answer"] = program[gap]
        return p


# --- drawing ----------------------------------------------------------------------------------------

def _icon(ax, name: str, cx: float, cy: float) -> None:
    """A simple picture of an object, above its name, inside a square."""
    y = cy + 0.14
    if name in ("house", "school"):
        w = 0.2 if name == "house" else 0.28
        ax.add_patch(Rectangle((cx - w, y - 0.16), 2 * w, 0.2, facecolor="white", edgecolor=INK, linewidth=1.2))
        ax.add_patch(Polygon([(cx - w - 0.05, y + 0.04), (cx + w + 0.05, y + 0.04), (cx, y + 0.2)], closed=True,
                             facecolor=FILL, edgecolor=INK, linewidth=1.2))
        if name == "school":  # a flag on the roof
            ax.plot([cx, cx], [y + 0.2, y + 0.32], color=INK, linewidth=1.2)
            ax.add_patch(Polygon([(cx, y + 0.32), (cx + 0.12, y + 0.28), (cx, y + 0.24)], closed=True, facecolor=INK,
                                 edgecolor=INK, linewidth=0.8))
    elif name == "tree":
        ax.add_patch(Rectangle((cx - 0.035, y - 0.17), 0.07, 0.14, facecolor=INK, edgecolor=INK))
        ax.add_patch(Circle((cx, y + 0.08), 0.15, facecolor=FILL, edgecolor=INK, linewidth=1.2))
    else:  # a flower: petals round a middle, on a stem
        ax.plot([cx, cx], [y - 0.17, y + 0.02], color=INK, linewidth=1.2)
        for dx, dy in ((0.08, 0), (-0.08, 0), (0, 0.08), (0, -0.08)):
            ax.add_patch(Circle((cx + dx, y + 0.08 + dy), 0.055, facecolor="white", edgecolor=INK, linewidth=1.0))
        ax.add_patch(Circle((cx, y + 0.08), 0.04, facecolor=INK, edgecolor=INK))
    ax.text(cx, cy - 0.3, name, ha="center", va="center", fontsize=10, gid=f"object:{name}")


def _robot(ax, x: int, y: int, facing: str) -> None:
    cx, cy = x + 0.5, y + 0.5
    ax.add_patch(Rectangle((x, y), 1, 1, facecolor=FILL_2, edgecolor="none", zorder=0, gid="start"))
    ax.add_patch(FancyBboxPatch((cx - 0.28, cy - 0.28), 0.56, 0.56, boxstyle="round,pad=0.04", facecolor="white",
                                edgecolor=INK, linewidth=1.5, zorder=2))
    dx, dy = STEP[facing]
    px, py = -dy, dx
    ax.add_patch(Polygon([(cx + 0.3 * dx, cy + 0.3 * dy), (cx - 0.14 * dx + 0.2 * px, cy - 0.14 * dy + 0.2 * py),
                          (cx - 0.14 * dx - 0.2 * px, cy - 0.14 * dy - 0.2 * py)], closed=True, facecolor=INK,
                         edgecolor=INK, zorder=3, gid="facing"))


def draw(p: dict):
    n = p["size"]
    fig, ax = new_figure(8.2, 5.2)
    for k in range(n + 1):
        ax.plot([0, n], [k, k], color=INK, linewidth=1.0)
        ax.plot([k, k], [0, n], color=INK, linewidth=1.0)
    _robot(ax, *p["start"], p["facing"])
    if p["mode"] == "trace":
        for letter, (x, y) in p["letters"].items():
            ax.text(x + 0.5, y + 0.5, letter, ha="center", va="center", fontsize=16, fontweight="bold", gid=f"letter:{letter}")
    else:
        for name, (x, y) in p["objects"].items():
            _icon(ax, name, x + 0.5, y + 0.5)
    # the program, as blocks
    left = n + 0.7
    top = n - 0.25
    ax.text(left, top, "Program", ha="left", va="center", fontsize=12, fontweight="bold")
    y = top - 0.75
    for i, cmd in enumerate(p["program"]):
        gap = cmd == "?"
        ax.add_patch(FancyBboxPatch((left + 0.45, y - 0.26), 2.3, 0.52, boxstyle="round,pad=0.05",
                                    facecolor="white" if gap else FILL_2, edgecolor=INK, linewidth=1.3,
                                    linestyle="--" if gap else "-"))
        ax.text(left + 0.15, y, f"{i + 1}", ha="center", va="center", fontsize=11, gid=f"num:{i}")
        ax.text(left + 1.6, y, cmd, ha="center", va="center", fontsize=12, fontweight="bold" if gap else "normal",
                gid=f"block:{i}")
        y -= 0.72
    ax.text(left, y - 0.05, "The arrow shows the way\nthe robot faces. It turns\nto its own left or right,\n"
            "staying on its square.", ha="left", va="top", fontsize=10, linespacing=1.3)
    ax.set_xlim(-0.05, left + 3.0)
    ax.set_ylim(-0.05, n + 0.05)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


# --- questions --------------------------------------------------------------------------------------

SETTINGS = ["at the coding club in Kigali", "in a computing lesson", "at school in Huye", "for a class challenge",
            "at the science fair in Musanze", "in the ICT room"]
VERBS = ["wrote", "made", "built"]


def questions(p: dict, rng: random.Random) -> list:
    who, setting = rng.choice(NAMES), rng.choice(SETTINGS)
    program = p["program"]
    moved = sum(int(c.split()[1]) for c in program if c.startswith("forward"))
    if p["mode"] == "trace":
        letters = sorted(p["letters"])
        end = walk(p["start"], p["facing"], program)[0][-1]
        key = next(k for k in letters if tuple(p["letters"][k]) == end)
        return [
            Question("mcq", f"{who} {rng.choice(VERBS)} this program for a robot {setting}. The robot starts on the grey "
                            f"square, facing the way its arrow points. Which letter does the robot stop on?",
                     str(letters.index(key)), letters),
            short("How many squares does the robot move altogether?", moved, [f"{moved} squares"]),
        ]
    gap = program.index("?")
    target = tuple(p["objects"][p["target"]])
    answer = p["answer"]
    other = "turn right" if answer == "turn left" else "turn left"
    fills = [f"forward {k}" for k in (1, 2, 3) if walk(p["start"], p["facing"], program[:gap] + [f"forward {k}"]
                                                        + program[gap + 1:])[0][-1] != target]
    return [
        mcq(f"{who} wants the robot to stop on the {p['target']} {setting}. One block of the program is missing. "
            f"Which block should go where the ? is?", answer, [other] + fills[:2], rng),
        short(f"How many squares does the robot move on its way to the {p['target']}?", moved, [f"{moved} squares"]),
    ]
