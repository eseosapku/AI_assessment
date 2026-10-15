"""A Scratch-style block program and a sprite on a grid (P, Primary Computing Stages 2 to 5): a 5 by 5 grid (6 by 6 at
the upper level) with the sprite on a grey start square, an arrow on it showing the way it faces, and beside the grid
its program as coloured blocks under a "when flag clicked" hat: "move 2 steps", "turn right", "turn left", and a
"repeat 3" block wrapped round the blocks it repeats. One step is one square, and the sprite turns on its square to
its own right or left (both printed). The path never leaves the grid and never crosses itself.

Lower (Stages 2 and 3): three or four blocks, a repeat (if any) round one "move 1 step". Upper (Stages 4 and 5): a
repeat always, round two or four blocks.

- trace: three or four squares are lettered. Which letter does the sprite stop on? The wrong letters are where the
  slips end: running a repeat's blocks once, turning the other way, turning to the page's right or left. How many
  steps does it move altogether, and how many times does it turn?
- fix: the sprite should stop on an object (an apple, a star, a ball, a flower). Either one block is missing ("?"):
  which block goes there (the only one of the choices that ends on the object; no other choice even passes over it);
  or the repeat's number is missing: what number should go in it (the only count from 1 to 9 that ends there, so a
  loop that comes back round never gives a second answer). Another object stands where a slip leads, off the path.
"""
from __future__ import annotations

import random

from matplotlib.patches import Circle, FancyBboxPatch, Polygon, Rectangle

from ..core import FILL, FILL_2, INK, NAMES, Question, count, mcq, new_figure, short

ID = "block_code_p"
KIND = "cs.code"
SUBJECT = "computing"
BANDS = ("P",)
CONCEPTS = tuple(f"computing.{c}" for c in ("algorithms", "coding-implementation", "program-testing-running",
                                            "scratch-game-development", "sequence-control-structure", "iteration-control",
                                            "sprite-manipulation"))
# A topic whose sections the book lists is reached only if its name or a section names programs, Scratch, repetition,
# instructions or bugs (Stage 3 "Hardware and software work together" teaches software instructions and bugs).
NEEDS = (r"algorithm|program|scratch|repeat|repetition|loop|sprite|\bcode\b|coding|\bbugs?\b|instruction|animator|"
         r"games? developer|storyteller|problem solver|innovator")
# Floor robots are grid_robot_p's; a cipher's code is not a program.
AVOID = r"robot|network|connected|\bdata\b|secret|code cracker|cipher|musician|designer|artist|everywhere|control things"

STEP = {"N": (0, 1), "E": (1, 0), "S": (0, -1), "W": (-1, 0)}
CLOCKWISE = "NESW"
OBJECTS = ["apple", "star", "ball", "flower"]
CHOICES = [["move", 1], ["move", 2], ["move", 3], ["turn", "left"], ["turn", "right"]]


def stages(p: dict) -> tuple[int, int]:
    return (2, 3) if p["level"] == "lower" else (4, 5)


def text(b: list) -> str:
    if b[0] == "move":
        return f"move {b[1]} step" + ("s" if b[1] != 1 else "")
    return f"turn {b[1]}"


def flat(program: list, slip: str = "") -> list:
    """The blocks in the order they run. A slip: "once" runs a repeat's blocks once."""
    out = []
    for b in program:
        if b[0] == "repeat":
            out += flat(b[2], slip) * (1 if slip == "once" else b[1])
        else:
            out.append(b)
    return out


def walk(start, facing: str, program: list, slip: str = "") -> list[tuple[int, int]]:
    """Every square the sprite stands on, in order. A slip: "swap" turns the other way, "page" turns to the page's
    right or left instead of the sprite's own, "once" runs each repeat's blocks once."""
    x, y = start
    path = [(x, y)]
    for b in flat(program, slip):
        if b[0] == "move":
            for _ in range(b[1]):
                x, y = x + STEP[facing][0], y + STEP[facing][1]
                path.append((x, y))
        else:
            right = (b[1] == "right") != (slip == "swap")
            if slip == "page":
                facing = "E" if right else "W"
            else:
                facing = CLOCKWISE[(CLOCKWISE.index(facing) + (1 if right else -1)) % 4]
    return path


def facing_at(start, facing: str, program: list, upto: int) -> str:
    """The way the sprite faces before the `upto`-th block that runs."""
    for b in flat(program)[:upto]:
        if b[0] == "turn":
            facing = CLOCKWISE[(CLOCKWISE.index(facing) + (1 if b[1] == "right" else -1)) % 4]
    return facing


def _fits(path, n: int) -> bool:
    return all(0 <= x < n and 0 <= y < n for x, y in path) and len(set(path)) == len(path)


def _program(rng: random.Random, level: str) -> list:
    turn = lambda: ["turn", rng.choice(["left", "right"])]  # noqa: E731
    move = lambda lo=1, hi=3: ["move", rng.randint(lo, hi)]  # noqa: E731
    if level == "lower":
        k = rng.randint(2, 4)
        shape = rng.choice(["RTM", "MTR", "MTM", "TMTM"])
        return {"RTM": [["repeat", k, [["move", 1]]], turn(), move()],
                "MTR": [move(), turn(), ["repeat", k, [["move", 1]]]],
                "MTM": [move(), turn(), move()],
                "TMTM": [turn(), move(), turn(), move()]}[shape]
    k = rng.randint(2, 3)
    shape = rng.choice(["M[MT]", "[MT]M", "T[M]TM", "[TM]", "[MTMT]"])
    if shape == "M[MT]":
        return [move(1, 2), ["repeat", k, [move(1, 2), turn()]]]
    if shape == "[MT]M":
        return [["repeat", k, [move(1, 2), turn()]], move(1, 2)]
    if shape == "T[M]TM":
        return [turn(), ["repeat", rng.randint(2, 4), [["move", 1]]], turn(), move(1, 3)]
    if shape == "[TM]":
        return [["repeat", k, [turn(), move(1, 2)]]]
    first = rng.choice(["left", "right"])
    other = "right" if first == "left" else "left"
    return [["repeat", 3 if k == 2 else 2, [["move", 1], ["turn", first], ["move", 1], ["turn", other]]]]


def _blocks(program: list) -> list[tuple[list, int]]:
    """Every simple block of the program with its place (a top-level index, or 100 times a repeat's index plus 1 and
    the index inside it)."""
    out = []
    for i, b in enumerate(program):
        if b[0] == "repeat":
            out += [(c, 100 * (i + 1) + j) for j, c in enumerate(b[2])]
        else:
            out.append((b, i))
    return out


def _replace(program: list, place: int, new) -> list:
    out = [list(b) if b[0] != "repeat" else ["repeat", b[1], [list(c) for c in b[2]]] for b in program]
    if place >= 100:
        out[place // 100 - 1][2][place % 100] = new
    else:
        out[place] = new
    return out


def _run_index(program: list, place: int) -> int:
    """How many blocks run before the block at `place` first runs."""
    k = 0
    for i, b in enumerate(program):
        if b[0] == "repeat":
            if place // 100 - 1 == i:
                return k + place % 100
            k += len(b[2]) * b[1]
        else:
            if place == i:
                return k
            k += 1
    raise ValueError(place)


def sample(rng: random.Random) -> dict:
    level = rng.choice(["lower", "upper"])
    mode = rng.choice(["trace", "fix"])
    n = 5 if level == "lower" else 6
    grid = {(x, y) for x in range(n) for y in range(n)}
    while True:
        start, facing = (rng.randrange(n), rng.randrange(n)), rng.choice("NESW")
        program = _program(rng, level)
        path = walk(start, facing, program)
        if not _fits(path, n):
            continue
        end = path[-1]
        p = {"band": "P", "level": level, "mode": mode, "size": n, "start": list(start), "facing": facing}
        if mode == "trace":
            spots = [end]
            for slip in ("once", "swap", "page"):
                q = walk(start, facing, program, slip)[-1]
                if q in grid and q not in spots and q != start:
                    spots.append(q)
            if len(spots) < 2:
                continue  # no slip lands anywhere: the letters would be guesses
            spare = sorted(grid - set(spots) - {start} - set(path[1:-1]))
            while len(spots) < 3 or (len(spots) < 4 and rng.random() < 0.5):
                spots.append(spare.pop(rng.randrange(len(spare))))
            letters = rng.sample("ABCD"[:len(spots)], len(spots))
            p.update(program=program, letters={k: list(v) for k, v in sorted(zip(letters, spots))})
            return p
        repeats = [i for i, b in enumerate(program) if b[0] == "repeat"]
        missing = "count" if repeats and rng.random() < 0.6 else "block"
        if missing == "count":
            i = repeats[0]
            k = program[i][1]
            ends = {}
            for other in range(1, 10):
                trial = [b if j != i else ["repeat", other, b[2]] for j, b in enumerate(program)]
                ends[other] = walk(start, facing, trial)[-1]
            if any(e == end for o, e in ends.items() if o != k):
                continue  # a loop that comes back round ends on the object again (3 and 7): the key must be the only count
            wrong = [ends[o] for o in (k - 1, k + 1) if o in ends and ends[o] in grid and ends[o] != start]
            shown = [b if j != i else ["repeat", None, b[2]] for j, b in enumerate(program)]
            answer = k
        else:
            place = rng.choice([pl for _, pl in _blocks(program)])
            gone = next(b for b, pl in _blocks(program) if pl == place)
            if gone[0] == "turn" and facing_at(start, facing, program, _run_index(program, place)) == "N":
                continue  # facing up the page, the page's side and the sprite's agree: no slip to catch
            # Every other block must keep the sprite off the object altogether: not ending there, even off the grid,
            # and not passing over it on the way (a loop that carries the sprite over the apple reads as a near miss).
            if any(end in walk(start, facing, _replace(program, place, c)) for c in CHOICES if c != gone):
                continue
            wrong = [walk(start, facing, _replace(program, place, c))[-1] for c in CHOICES if c != gone]
            wrong = [w for w in wrong if w in grid and w != start and w != end]
            shown = _replace(program, place, ["?"])
            answer = text(gone)
        wrong = [w for w in wrong if w not in path]  # the other object never sits on the sprite's way
        goal = rng.choice(OBJECTS)
        objects = {goal: list(end)}
        if wrong:
            objects[rng.choice([o for o in OBJECTS if o != goal])] = list(rng.choice(sorted(set(wrong))))
        p.update(program=shown, missing=missing, goal=goal, goal_at=list(end), objects=dict(sorted(objects.items())),
                 answer=answer)
        return p


# --- drawing ----------------------------------------------------------------------------------------

MOTION, CONTROL, EVENTS = "#cfe0ff", "#ffe0b0", "#fff1a8"


def _icon(ax, name: str, cx: float, cy: float) -> None:
    """A big, simple picture of an object above its name, inside a square."""
    y = cy + 0.12
    if name == "apple":
        ax.add_patch(Circle((cx, y), 0.22, facecolor=FILL, edgecolor=INK, linewidth=1.3))
        ax.add_patch(Polygon([(cx - 0.01, y + 0.2), (cx + 0.01, y + 0.34), (cx + 0.05, y + 0.34), (cx + 0.03, y + 0.2)],
                             closed=True, facecolor=INK, edgecolor=INK))
        ax.add_patch(Polygon([(cx + 0.04, y + 0.29), (cx + 0.2, y + 0.33), (cx + 0.1, y + 0.23)], closed=True,
                             facecolor="white", edgecolor=INK, linewidth=1.0))
    elif name == "star":
        import math
        pts = [(cx + (0.26 if k % 2 == 0 else 0.11) * math.cos(math.pi / 2 + k * math.pi / 5),
                y + 0.02 + (0.26 if k % 2 == 0 else 0.11) * math.sin(math.pi / 2 + k * math.pi / 5)) for k in range(10)]
        ax.add_patch(Polygon(pts, closed=True, facecolor=FILL, edgecolor=INK, linewidth=1.3))
    elif name == "ball":
        ax.add_patch(Circle((cx, y), 0.23, facecolor="white", edgecolor=INK, linewidth=1.4))
        ax.add_patch(Polygon([(cx - 0.09, y - 0.02), (cx, y + 0.09), (cx + 0.09, y - 0.02), (cx + 0.05, y - 0.12),
                              (cx - 0.05, y - 0.12)], closed=True, facecolor=INK, edgecolor=INK))
        for a, b in (((cx - 0.09, y - 0.02), (cx - 0.2, y + 0.1)), ((cx + 0.09, y - 0.02), (cx + 0.2, y + 0.1)),
                     ((cx - 0.05, y - 0.12), (cx - 0.12, y - 0.19)), ((cx + 0.05, y - 0.12), (cx + 0.12, y - 0.19)),
                     ((cx, y + 0.09), (cx, y + 0.22))):
            ax.add_patch(Polygon([a, b], closed=False, fill=False, edgecolor=INK, linewidth=1.0))
    else:  # a flower: petals round a middle, on a stem
        ax.add_patch(Rectangle((cx - 0.015, y - 0.22), 0.03, 0.22, facecolor=INK, edgecolor=INK))
        for dx, dy in ((0.1, 0), (-0.1, 0), (0, 0.1), (0, -0.1)):
            ax.add_patch(Circle((cx + dx, y + 0.08 + dy), 0.07, facecolor="white", edgecolor=INK, linewidth=1.1))
        ax.add_patch(Circle((cx, y + 0.08), 0.05, facecolor=INK, edgecolor=INK))
    ax.text(cx, cy - 0.34, name, ha="center", va="center", fontsize=10, gid=f"object:{name}")


def _sprite(ax, x: int, y: int, facing: str) -> None:
    cx, cy = x + 0.5, y + 0.5
    ax.add_patch(Rectangle((x, y), 1, 1, facecolor=FILL_2, edgecolor="none", zorder=0, gid="start"))
    ax.add_patch(Circle((cx, cy), 0.3, facecolor="white", edgecolor=INK, linewidth=1.5, zorder=2))
    dx, dy = STEP[facing]
    px, py = -dy, dx
    ax.add_patch(Polygon([(cx + 0.27 * dx, cy + 0.27 * dy), (cx - 0.12 * dx + 0.18 * px, cy - 0.12 * dy + 0.18 * py),
                          (cx - 0.12 * dx - 0.18 * px, cy - 0.12 * dy - 0.18 * py)], closed=True, facecolor=INK,
                         edgecolor=INK, zorder=3, gid="facing"))


def _block(ax, x: float, y: float, w: float, label: str, colour: str, gap: bool = False) -> None:
    ax.add_patch(FancyBboxPatch((x, y - 0.26), w, 0.52, boxstyle="round,pad=0.04", facecolor="white" if gap else colour,
                                edgecolor=INK, linewidth=1.3, linestyle="--" if gap else "-"))
    ax.text(x + 0.15, y, label, ha="left", va="center", fontsize=12, fontweight="bold" if gap else "normal")


ROW = 0.72


def draw(p: dict):
    n = p["size"]
    rows = 2 + sum(len(b[2]) + 2 if b[0] == "repeat" else 1 for b in p["program"])
    height = max(n, rows * ROW + 1.5)
    fig, ax = new_figure(8.6, 0.9 * height)
    for k in range(n + 1):
        ax.plot([0, n], [k, k], color=INK, linewidth=1.0, gid="grid")
        ax.plot([k, k], [0, n], color=INK, linewidth=1.0, gid="grid")
    _sprite(ax, *p["start"], p["facing"])
    if p["mode"] == "trace":
        for letter, (x, y) in p["letters"].items():
            ax.text(x + 0.5, y + 0.5, letter, ha="center", va="center", fontsize=16, fontweight="bold", gid=f"letter:{letter}")
    else:
        for name, (x, y) in p["objects"].items():
            _icon(ax, name, x + 0.5, y + 0.5)
    left = n + 0.7
    top = height - 0.45
    # the hat block, with a small green-flag drawing after its words
    ax.add_patch(FancyBboxPatch((left, top - 0.3), 3.1, 0.6, boxstyle="round,pad=0.06,rounding_size=0.25",
                                facecolor=EVENTS, edgecolor=INK, linewidth=1.3))
    ax.text(left + 0.15, top, "when", ha="left", va="center", fontsize=12)
    fx = left + 1.05
    ax.add_patch(Rectangle((fx, top - 0.2), 0.035, 0.42, facecolor=INK, edgecolor=INK))
    ax.add_patch(Polygon([(fx + 0.035, top + 0.22), (fx + 0.33, top + 0.12), (fx + 0.035, top + 0.02)], closed=True,
                         facecolor=FILL, edgecolor=INK, linewidth=1.0))
    ax.text(fx + 0.45, top, "clicked", ha="left", va="center", fontsize=12)
    y = top - ROW
    for b in p["program"]:
        if b[0] == "repeat":
            inner = len(b[2])
            y_top, y_bot = y + 0.3, y - ROW * inner - 0.66
            # the C-shaped repeat block: a top bar, a left arm and a bottom bar round the blocks it repeats
            arm = 0.35
            ax.add_patch(Polygon([(left, y_top), (left + 3.1, y_top), (left + 3.1, y - 0.3), (left + arm, y - 0.3),
                                  (left + arm, y_bot + 0.3), (left + 3.1, y_bot + 0.3), (left + 3.1, y_bot),
                                  (left, y_bot)], closed=True, facecolor=CONTROL, edgecolor=INK, linewidth=1.3))
            label = f"repeat {b[1] if b[1] is not None else '?'}"
            ax.text(left + 0.15, y, label, ha="left", va="center", fontsize=12,
                    fontweight="bold" if b[1] is None else "normal")
            y -= ROW
            for c in b[2]:
                _block(ax, left + arm + 0.08, y, 2.6, "?" if c == ["?"] else text(c), MOTION, gap=c == ["?"])
                y -= ROW
            y -= 0.3  # the next block sits just under the repeat's bottom bar
        else:
            _block(ax, left, y, 3.1, "?" if b == ["?"] else text(b), MOTION, gap=b == ["?"])
            y -= ROW
    ax.text(left, y + 0.05, "1 step = 1 square.\nThe sprite turns on its\nsquare, to its own right\nor left.",
            ha="left", va="top", fontsize=10, linespacing=1.3)
    ax.set_xlim(-0.05, left + 3.35)
    ax.set_ylim(min(-0.05, y - 1.6), height + 0.05)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


# --- questions --------------------------------------------------------------------------------------

SETTINGS = ["at the coding club in Kigali", "in a computing lesson", "at school in Huye", "for a class challenge",
            "at the science fair in Musanze", "in the ICT room", "at home in Rubavu", "for a Scratch project"]
VERBS = ["made", "built", "wrote"]


def questions(p: dict, rng: random.Random) -> list:
    who, setting = rng.choice(NAMES), rng.choice(SETTINGS)
    program = p["program"]
    if p["mode"] == "trace":
        full = program
    elif p["missing"] == "count":
        full = [["repeat", p["answer"], b[2]] if b[0] == "repeat" and b[1] is None else b for b in program]
    else:
        full = _fill(program, next(c for c in CHOICES if text(c) == p["answer"]))
    blocks = flat(full)
    moved = sum(b[1] for b in blocks if b[0] == "move")
    turns = sum(1 for b in blocks if b[0] == "turn")
    out = []
    if p["mode"] == "trace":
        letters = sorted(p["letters"])
        end = walk(p["start"], p["facing"], full)[-1]
        key = next(k for k in letters if tuple(p["letters"][k]) == end)
        out.append(Question("mcq", f"{who} {rng.choice(VERBS)} this Scratch program {setting}. The sprite starts on the "
                                   f"grey square, facing the way its arrow points. Which letter does the sprite stop on?",
                            str(letters.index(key)), letters))
        out.append(count("How many steps does the sprite move altogether?", moved, "steps"))
    else:
        goal = p["goal"]
        if p["missing"] == "count":
            out.append(short(f"{who} wants the sprite to stop on the {goal} {setting}. The number in the repeat block is "
                             f"missing. What number should go in the repeat block?", p["answer"],
                             [f"repeat {p['answer']}", f"{p['answer']} times"]))
        else:
            answer = p["answer"]
            others = [text(c) for c in CHOICES if text(c) != answer]
            kind = answer.split()[0]
            same = [o for o in others if o.startswith(kind)]
            other = [o for o in others if not o.startswith(kind)]
            rng.shuffle(other)
            out.append(mcq(f"{who} wants the sprite to stop on the {goal} {setting}. One block of the program is missing. "
                           f"Which block should go where the ? is?", answer, (same + other)[:3], rng))
        out.append(count(f"How many steps does the sprite move on its way to the {goal}?", moved, "steps"))
    if turns and any(b[0] == "repeat" for b in program):
        out.append(count("How many times does the sprite turn while the program runs?", turns, "times", "turns"))
    return out


def _fill(program: list, block: list) -> list:
    out = []
    for b in program:
        if b == ["?"]:
            out.append(block)
        elif b[0] == "repeat":
            out.append(["repeat", b[1], _fill(b[2], block)])
        else:
            out.append(b)
    return out
