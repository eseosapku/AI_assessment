"""The history and kinds of computers (P Stage 6, LS, UP), of three kinds.

- generations: a timeline of the five generations of computers, each a band with its number and years printed
  (first 1940-1956, second 1956-1963, third 1964-1971, fourth 1971 to the present, fifth the present and beyond, as
  Click Start Computing and the Rwanda ICT books print them), and under each band a simple picture of its main part
  (a vacuum tube, a transistor, an integrated circuit, a microprocessor, an AI robot) with the part named. The pictures
  are lettered in a shuffled order. Which letter shows the part of a computer built in a stated year, which generation
  a lettered picture belongs to, and how many years lie between two printed dates.
- classes: a table of the five kinds of computer (supercomputer, mainframe, minicomputer, microcomputer, embedded
  computer) with each one's size, how many people use it at one time and an example use, the rows lettered in a
  shuffled order. Which letter serves the most users at one time, how many more users one lettered computer serves
  than another, and which letter is built into a machine to control it.
- early (Know your computer): a timeline of four or five early calculating devices (Napier's bones 1617, the slide
  rule 1622, the Pascaline 1642, the stepped reckoner 1673, the Difference Engine 1822, the Analytical Engine 1837),
  each a simple picture with its name and year, lettered in a shuffled order. Which letter shows the oldest device
  (or the device made in a stated year) and how many years lie between two devices.

Every key is read from the dates and numbers printed in the figure.
"""
from __future__ import annotations

import random

from matplotlib.patches import Circle, Ellipse, FancyBboxPatch, Polygon, Rectangle

from ..core import FILL, FILL_2, INK, NAMES, Question, mcq, new_figure, short

ID = "computer_generations"
KIND = "timeline"
SUBJECT = "computing"
BANDS = ("P", "LS", "UP")
GENERATIONS = tuple(f"computing.{c}" for c in ("integrated-circuit-generation", "computer-system-types"))
CLASSES = tuple(f"computing.{c}" for c in ("mainframe-computers", "microcomputers", "minicomputers",
                                           "computer-system-types"))
EARLY = tuple(f"computing.{c}" for c in ("napier-bones", "pascaline", "analytical-engine", "computer-system-types"))
CONCEPTS = tuple(dict.fromkeys(GENERATIONS + CLASSES + EARLY))
# A topic whose sections the book lists is reached only if its name or a section names the history, generations,
# evolution or classification of computers, early calculating devices or the computer family.
NEEDS = (r"histor|generation|evolution|classification|types of computer|calculating|computer family|"
         r"computer fundamentals|know your computer|mainframe|supercomputer|napier|pascaline|analytical engine")
# Topics sharing the broad "kinds of computer" concept that teach parts, networks, robots or software.
AVOID = (r"computer parts|citizenship|network|connected|robot|everywhere|computer scientist|\bdata\b|software|laptop|"
         r"architecture|^introduction$|programming|operating system|hardware|keyboard|safety|storage|memory|"
         r"types and components")

GENS = [("First generation", 1940, 1956, "vacuum tube"), ("Second generation", 1956, 1963, "transistor"),
        ("Third generation", 1964, 1971, "integrated circuit"), ("Fourth generation", 1971, None, "microprocessor"),
        ("Fifth generation", None, None, "artificial intelligence")]
# Each kind of computer: its size, the users it serves at one time (choices), an example use.
KINDS = [("Supercomputer", "fills a large hall", list(range(10, 51, 5)), "weather forecasting"),
         ("Mainframe", "fills a large room", list(range(2000, 9001, 500)), "a bank's accounts"),
         ("Minicomputer", "the size of a cupboard", list(range(50, 301, 10)), "a small factory's stock"),
         ("Microcomputer", "fits on a desk or a lap", [1], "a student's homework"),
         ("Embedded computer", "a chip inside a machine", [0], "controlling a washing machine")]
DEVICES = [("Napier's bones", 1617), ("slide rule", 1622), ("Pascaline", 1642), ("stepped reckoner", 1673),
           ("Difference Engine", 1822), ("Analytical Engine", 1837)]
ORDINAL = {1: "first", 2: "second", 3: "third", 4: "fourth", 5: "fifth"}


def stages(p: dict):
    return (6, 6) if p["band"] == "P" else None


def concepts_for(p: dict) -> tuple[str, ...]:
    own = {"generations": GENERATIONS, "classes": CLASSES, "early": EARLY}[p["sub"]]
    # A Primary figure carries only the history's own ids: "kinds of computer" is shared by every Primary unit on parts.
    return tuple(c for c in own if c != "computing.computer-system-types") if p["band"] == "P" else own


def sample(rng: random.Random) -> dict:
    band = rng.choice(["P", "P", "LS", "UP"])
    sub = rng.choice(["generations", "classes", "early"])
    if sub == "generations":
        letters = list("ABCDE")
        rng.shuffle(letters)
        g = rng.randrange(4)  # a year inside one of the first four generations' printed years
        lo, hi = GENS[g][1], GENS[g][2] or 2020
        year = rng.randint(lo + 1, hi - 1)
        a, b = sorted(rng.sample(range(4), 2))
        return {"band": band, "sub": sub, "letters": letters, "year": year, "pick": rng.randrange(5),
                "span": [a, b]}
    if sub == "classes":
        users = [rng.choice(k[2]) for k in KINDS]
        letters = list("ABCDE")
        rng.shuffle(letters)
        return {"band": band, "sub": sub, "users": users, "letters": letters,
                "pair": [1, rng.choice([0, 2])]}
    n = rng.randint(4, 5)
    picks = sorted(rng.sample(range(len(DEVICES)), n))
    letters = list("ABCDE"[:n])
    rng.shuffle(letters)
    a, b = sorted(rng.sample(range(n), 2))
    return {"band": band, "sub": sub, "devices": [list(DEVICES[i]) for i in picks], "letters": letters,
            "ask": rng.choice(["oldest", "year"]), "year_of": rng.randrange(n), "pair": [a, b]}


# --- drawing ----------------------------------------------------------------------------------------

def _frame(w: float, h: float):
    fig, ax = new_figure(w, h)
    fig.subplots_adjust(left=0, right=1, bottom=0, top=1)
    ax.set_xlim(0, w)
    ax.set_ylim(0, h)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig, ax


def _part(ax, kind: str, x: float, y: float) -> None:
    """A simple picture of a generation's main part, about 1.2 wide and 1.2 tall, centred on (x, y)."""
    if kind == "vacuum tube":
        ax.add_patch(FancyBboxPatch((x - 0.28, y - 0.3), 0.56, 0.8, boxstyle="round,pad=0.02,rounding_size=0.25",
                                    facecolor="#eef0f2", edgecolor=INK, linewidth=1.4))
        ax.add_patch(Rectangle((x - 0.32, y - 0.5), 0.64, 0.22, facecolor=FILL, edgecolor=INK, linewidth=1.3))
        for dx in (-0.18, 0, 0.18):
            ax.plot([x + dx, x + dx], [y - 0.62, y - 0.5], color=INK, linewidth=1.4)
        ax.plot([x - 0.12, x + 0.12], [y + 0.12, y + 0.12], color=INK, linewidth=1.0)
        ax.plot([x, x], [y - 0.25, y + 0.3], color=INK, linewidth=1.0)
    elif kind == "transistor":
        ax.add_patch(FancyBboxPatch((x - 0.3, y - 0.05), 0.6, 0.5, boxstyle="round,pad=0.02,rounding_size=0.2",
                                    facecolor=FILL, edgecolor=INK, linewidth=1.4))
        for dx in (-0.18, 0, 0.18):
            ax.plot([x + dx, x + dx], [y - 0.6, y - 0.05], color=INK, linewidth=1.6)
    elif kind == "integrated circuit":
        ax.add_patch(Rectangle((x - 0.5, y - 0.25), 1.0, 0.5, facecolor=INK, edgecolor=INK, linewidth=1.2))
        for k in range(6):
            px = x - 0.42 + k * 0.168
            ax.plot([px, px], [y + 0.25, y + 0.42], color=INK, linewidth=1.6)
            ax.plot([px, px], [y - 0.42, y - 0.25], color=INK, linewidth=1.6)
        ax.add_patch(Circle((x - 0.36, y + 0.1), 0.05, facecolor="white", edgecolor="white"))
    elif kind == "microprocessor":
        ax.add_patch(Rectangle((x - 0.5, y - 0.5), 1.0, 1.0, facecolor=FILL, edgecolor=INK, linewidth=1.4))
        ax.add_patch(Rectangle((x - 0.25, y - 0.25), 0.5, 0.5, facecolor=FILL_2, edgecolor=INK, linewidth=1.2))
        for k in range(5):
            t = -0.4 + k * 0.2
            for (x0, y0, x1, y1) in ((x + t, y + 0.5, x + t, y + 0.62), (x + t, y - 0.62, x + t, y - 0.5),
                                     (x - 0.62, y + t, x - 0.5, y + t), (x + 0.5, y + t, x + 0.62, y + t)):
                ax.plot([x0, x1], [y0, y1], color=INK, linewidth=1.3)
    else:  # an AI robot's head
        ax.add_patch(FancyBboxPatch((x - 0.42, y - 0.4), 0.84, 0.72, boxstyle="round,pad=0.02,rounding_size=0.12",
                                    facecolor=FILL_2, edgecolor=INK, linewidth=1.4))
        for dx in (-0.18, 0.18):
            ax.add_patch(Circle((x + dx, y + 0.02), 0.09, facecolor=INK, edgecolor=INK))
        ax.plot([x - 0.18, x + 0.18], [y - 0.2, y - 0.2], color=INK, linewidth=1.6)
        ax.plot([x, x], [y + 0.32, y + 0.5], color=INK, linewidth=1.4)
        ax.add_patch(Circle((x, y + 0.55), 0.06, facecolor=INK, edgecolor=INK))


def _years(g: tuple) -> str:
    name, start, end, _ = g
    if start is None:
        return "the present and beyond"
    return f"{start} to {end}" if end else f"{start} to the present"


def _draw_generations(p: dict):
    fig, ax = _frame(13.2, 4.7)
    w = 2.5
    for i, g in enumerate(GENS):
        x0 = 0.2 + i * (w + 0.1)
        ax.add_patch(Rectangle((x0, 3.45), w, 0.95, facecolor=[FILL_2, "#eef0f2"][i % 2], edgecolor=INK, linewidth=1.2))
        ax.text(x0 + w / 2, 4.12, g[0], ha="center", va="center", fontsize=11, fontweight="bold")
        ax.text(x0 + w / 2, 3.72, _years(g), ha="center", va="center", fontsize=10.5)
        if i < 4:
            ax.add_patch(Polygon([(x0 + w + 0.02, 3.8), (x0 + w + 0.1, 3.92), (x0 + w + 0.02, 4.05)], closed=True,
                                 facecolor=INK, edgecolor=INK))
        cx = x0 + w / 2
        _part(ax, g[3], cx, 2.2)
        ax.text(cx, 1.15, g[3], ha="center", va="center", fontsize=10.5)
        ax.add_patch(Circle((x0 + 0.35, 2.85), 0.24, facecolor="white", edgecolor=INK, linewidth=1.3))
        ax.text(x0 + 0.35, 2.85, p["letters"][i], ha="center", va="center", fontsize=12, fontweight="bold",
                gid=f"letter:{i}")
    ax.text(0.2, 0.45, "Each picture shows the main electronic part of the computers of the generation above it.",
            ha="left", va="center", fontsize=10.5)
    return fig


def _draw_classes(p: dict):
    fig, ax = _frame(12.0, 4.0)
    cols = [("", 0.6), ("Kind of computer", 2.5), ("Size", 2.7), ("Users at one time", 2.2), ("Example use", 3.7)]
    ytop, rh = 3.8, 0.55
    x = 0.2
    for head, w in cols:
        ax.add_patch(Rectangle((x, ytop - rh), w, rh, facecolor=FILL_2, edgecolor=INK, linewidth=1.0))
        ax.text(x + 0.1, ytop - rh / 2, head, ha="left", va="center", fontsize=10.5, fontweight="bold")
        x += w
    order = sorted(range(5), key=lambda i: p["letters"][i])
    for r, i in enumerate(order):
        name, size, _, use = KINDS[i]
        y = ytop - (r + 2) * rh
        users = "none" if p["users"][i] == 0 else f"{p['users'][i]:,}".replace(",", " ")
        cells = [p["letters"][i], name, size, users, use]
        x = 0.2
        for c, ((head, w), v) in enumerate(zip(cols, cells)):
            ax.add_patch(Rectangle((x, y), w, rh, facecolor="white", edgecolor=INK, linewidth=0.8))
            ax.text(x + (w / 2 if c == 0 else 0.1), y + rh / 2, v, ha="center" if c == 0 else "left", va="center",
                    fontsize=10.5, fontweight="bold" if c == 0 else "normal")
            x += w
    return fig


def _device(ax, name: str, x: float, y: float) -> None:
    """A simple picture of an early calculating device, centred on (x, y)."""
    if name == "Napier's bones":
        for k in range(4):
            ax.add_patch(Rectangle((x - 0.5 + k * 0.26, y - 0.55), 0.22, 1.1, facecolor="#eef0f2", edgecolor=INK,
                                   linewidth=1.1))
            for j in range(4):
                ax.plot([x - 0.5 + k * 0.26, x - 0.28 + k * 0.26], [y - 0.55 + j * 0.275] * 2, color=INK, linewidth=0.7)
    elif name == "slide rule":
        ax.add_patch(Rectangle((x - 0.75, y - 0.25), 1.5, 0.5, facecolor="#eef0f2", edgecolor=INK, linewidth=1.2))
        ax.add_patch(Rectangle((x - 0.45, y - 0.08), 1.5 - 0.3, 0.16, facecolor=FILL_2, edgecolor=INK, linewidth=1.0))
        for k in range(9):
            ax.plot([x - 0.65 + k * 0.16] * 2, [y + 0.12, y + 0.22], color=INK, linewidth=0.8)
    elif name == "Pascaline":
        ax.add_patch(Rectangle((x - 0.7, y - 0.4), 1.4, 0.8, facecolor="#c9b18a", edgecolor=INK, linewidth=1.2))
        for k in range(3):
            ax.add_patch(Circle((x - 0.42 + k * 0.42, y), 0.17, facecolor="#eef0f2", edgecolor=INK, linewidth=1.0))
    elif name == "stepped reckoner":
        ax.add_patch(Rectangle((x - 0.7, y - 0.35), 1.4, 0.55, facecolor="#c9b18a", edgecolor=INK, linewidth=1.2))
        ax.add_patch(Ellipse((x, y + 0.32), 1.2, 0.22, facecolor=FILL_2, edgecolor=INK, linewidth=1.0))
        ax.plot([x + 0.7, x + 0.9, x + 0.9], [y - 0.05, y - 0.05, y + 0.25], color=INK, linewidth=1.5)
    elif name == "Difference Engine":
        for k in range(3):
            ax.plot([x - 0.45 + k * 0.45] * 2, [y - 0.6, y + 0.6], color=INK, linewidth=1.2)
            for j in range(4):
                ax.add_patch(Circle((x - 0.45 + k * 0.45, y - 0.45 + j * 0.3), 0.12, facecolor=FILL_2, edgecolor=INK,
                                    linewidth=0.9))
    else:  # the Analytical Engine: gears and a punched card
        for (dx, dy, r) in ((-0.3, 0.2, 0.28), (0.2, 0.3, 0.2), (0.0, -0.15, 0.18)):
            ax.add_patch(Circle((x + dx, y + dy), r, facecolor=FILL_2, edgecolor=INK, linewidth=1.1))
        ax.add_patch(Rectangle((x + 0.2, y - 0.6), 0.55, 0.38, facecolor="#f3e7c4", edgecolor=INK, linewidth=1.0))
        for k in range(3):
            ax.add_patch(Circle((x + 0.32 + k * 0.15, y - 0.41), 0.035, facecolor=INK, edgecolor=INK))


def _draw_early(p: dict):
    n = len(p["devices"])
    w = 2.6
    fig, ax = _frame(0.4 + n * w, 4.2)
    ax.plot([0.3, 0.1 + n * w], [3.6, 3.6], color=INK, linewidth=2.0)
    ax.add_patch(Polygon([(0.1 + n * w, 3.5), (0.3 + n * w, 3.6), (0.1 + n * w, 3.7)], closed=True, facecolor=INK,
                         edgecolor=INK))
    for i, (name, year) in enumerate(p["devices"]):
        cx = 0.2 + i * w + w / 2
        ax.plot([cx, cx], [3.45, 3.75], color=INK, linewidth=1.6)
        ax.text(cx, 3.95, str(year), ha="center", va="center", fontsize=11, fontweight="bold")
        _device(ax, name, cx, 2.35)
        ax.text(cx, 1.3, name, ha="center", va="center", fontsize=10.5)
        ax.add_patch(Circle((cx - 1.0, 3.05), 0.24, facecolor="white", edgecolor=INK, linewidth=1.3))
        ax.text(cx - 1.0, 3.05, p["letters"][i], ha="center", va="center", fontsize=12, fontweight="bold",
                gid=f"letter:{i}")
    ax.text(0.2, 0.6, "Early calculating devices, in the order they were made", ha="left", va="center", fontsize=10.5)
    return fig


def draw(p: dict):
    return {"generations": _draw_generations, "classes": _draw_classes, "early": _draw_early}[p["sub"]](p)


# --- questions --------------------------------------------------------------------------------------

SETTINGS = ["in an ICT lesson", "for homework", "on a revision card", "for a class test", "at the computer club",
            "in a history of computing lesson"]


def _letters(stem: str, key: str, letters) -> Question:
    options = sorted(letters)
    return Question("mcq", stem, str(options.index(key)), options)


def _years_forms(n: int) -> list:
    return [str(n), f"{n} years"]


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    setting = rng.choice(SETTINGS)
    if p["sub"] == "generations":
        letters = p["letters"]
        g = next(i for i, (_, lo, hi, _) in enumerate(GENS[:4]) if lo < p["year"] < (hi or 10000))
        others = rng.sample([letters[i] for i in range(5) if i != g], 3)
        pick = p["pick"]
        a, b = p["span"]
        gap = GENS[b][1] - GENS[a][1]
        return [_letters(f"{who} studies this timeline {setting}. A computer was built in {p['year']}. Which letter "
                         f"shows its main electronic part?", letters[g], [letters[g]] + others),
                mcq(f"Which generation does picture {letters[pick]} on the timeline belong to?", GENS[pick][0],
                    rng.sample([x[0] for x in GENS], 5), rng),
                short(f"How many years after the {ORDINAL[a + 1]} generation began did the {ORDINAL[b + 1]} generation "
                      f"begin, by the timeline?", gap, _years_forms(gap))]
    if p["sub"] == "classes":
        letters, users = p["letters"], p["users"]
        most = max(range(5), key=lambda i: users[i])
        a, b = p["pair"]
        diff = users[a] - users[b]
        embedded = 4
        return [_letters(f"{who} reads this table {setting}. Which letter shows the computer that serves the most "
                         f"users at one time?", letters[most], letters),
                short(f"By the table, how many more users can computer {letters[a]} serve at one time than computer "
                      f"{letters[b]}?", diff, [str(diff), f"{diff} users"]),
                _letters("Which letter in the table shows a computer that is built into a machine to control it?",
                         letters[embedded], letters)]
    devices, letters = p["devices"], p["letters"]
    a, b = p["pair"]
    gap = devices[b][1] - devices[a][1]
    if p["ask"] == "oldest":
        q1 = _letters(f"{who} studies this timeline {setting}. Which letter shows the oldest calculating device?",
                      letters[0], letters)
    else:
        i = p["year_of"]
        q1 = _letters(f"{who} studies this timeline {setting}. Which letter shows the device made in "
                      f"{devices[i][1]}?", letters[i], letters)
    the = lambda name: name if name == "Napier's bones" else f"the {name}"  # noqa: E731
    made = "were" if devices[b][0] == "Napier's bones" else "was"
    return [q1, short(f"By the timeline, how many years after {the(devices[a][0])} {made} {the(devices[b][0])} made?",
                      gap, _years_forms(gap))]
