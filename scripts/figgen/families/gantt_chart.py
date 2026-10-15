"""Gantt charts (AL, UP): an IT project's eight tasks on a week grid, as Cambridge AS IT draws them: one bar per task
across the weeks it runs, the tasks it depends on listed beside it and drawn as arrows from the end of one bar to the
start of the next, and a milestone diamond. Five projects: a school computer lab in Kigali, a Musanze cooperative's
website, a Rubavu hotel's booking system, a Huye clinic's records database and a Nyagatare school's Wi-Fi.

The week a task starts or ends (or a milestone is reached), the shortest time the project can take, which task runs in
parallel with another in a week, and the week the project ends if a task takes two weeks longer, worked through the
dependencies with the scheduling rule stated.

Every task starts the week after the last task it depends on ends (week 1 if none), so the bars are the dependencies'
earliest schedule and the project's shortest length is the last bar's end.
"""
from __future__ import annotations

import random

from matplotlib.patches import Rectangle

from ..core import GRID, INK, NAMES, new_figure, short

ID = "gantt_chart"
KIND = "timeline"
SUBJECT = "computing"
BANDS = ("AL", "UP")
CONCEPTS = ("computing.project-management",)
# A topic whose sections the book lists is reached only if one names what this figure teaches.
NEEDS = r"project management|gantt|project plan|critical path|managing a project"
AVOID = r"programming|python|database|spreadsheet|network|security|html|life cycle"
# Each project: its tasks in an order that lists every task after those it depends on, and a milestone at one's end.
PROJECTS = {
    "lab": ("setting up a computer lab at a school in Kigali",
            [("Survey the room", []), ("Order computers", ["A"]), ("Install electrics", ["A"]), ("Lay network cables", ["C"]),
             ("Set up computers", ["B", "D"]), ("Install software", ["E"]), ("Train teachers", ["E"]), ("Test the network", ["F"])],
            ("Computers set up", "E")),
    "website": ("building a website for a Musanze cooperative",
                [("Interview members", []), ("Design the layout", ["A"]), ("Write the text", ["A"]), ("Take photos", ["A"]),
                 ("Build the pages", ["B"]), ("Add text and photos", ["C", "D", "E"]), ("Test the website", ["F"]),
                 ("Train staff", ["F"])],
                ("Pages built", "E")),
    "hotel": ("a new booking system for a Rubavu hotel",
              [("Study the old system", []), ("Design the database", ["A"]), ("Design the screens", ["A"]),
               ("Buy new hardware", ["A"]), ("Write the program", ["B", "C"]), ("Install hardware", ["D"]),
               ("Test the system", ["E", "F"]), ("Train the staff", ["E"])],
              ("Program written", "E")),
    "clinic": ("moving a Huye clinic's records to a database",
               [("Plan the database", []), ("Buy a server", []), ("Build the tables", ["A"]), ("Install the server", ["B"]),
                ("Make input forms", ["C"]), ("Enter old records", ["C", "D"]), ("Test with staff", ["E", "F"]),
                ("Train nurses", ["E"])],
               ("Server installed", "D")),
    "wifi": ("installing Wi-Fi across a school in Nyagatare",
             [("Survey the site", []), ("Plan access points", ["A"]), ("Order equipment", ["B"]), ("Run cables", ["B"]),
              ("Fit access points", ["C", "D"]), ("Set up security", ["E"]), ("Test coverage", ["E"]),
              ("Write a user guide", ["B"])],
             ("Access points fitted", "E")),
}
LETTERS = "ABCDEFGH"
WEEK_IN = 0.4  # inches a week column takes
LABEL_W = 7.6  # the task and dependency columns, in weeks


def plan(tasks: list, longer: dict | None = None) -> tuple[dict, dict]:
    """Each task's first and last week, by the rule: start the week after the last task depended on ends."""
    start, end = {}, {}
    for letter, _, _, dur, after in tasks:
        d = dur + (longer or {}).get(letter, 0)
        start[letter] = max((end[a] for a in after), default=0) + 1
        end[letter] = start[letter] + d - 1
    return start, end


def _parallel(start: dict, end: dict) -> list[tuple[int, list[str]]]:
    weeks = []
    for w in range(1, max(end.values()) + 1):
        busy = sorted(t for t in start if start[t] <= w <= end[t])
        if len(busy) == 2:
            weeks.append((w, busy))
    return weeks


def sample(rng: random.Random) -> dict:
    key = rng.choice(list(PROJECTS))
    _, steps, milestone = PROJECTS[key]
    while True:
        tasks = [[LETTERS[i], name, 0, rng.randint(1, 4), after] for i, (name, after) in enumerate(steps)]
        start, end = plan(tasks)
        for t in tasks:
            t[2] = start[t[0]]
        length = max(end.values())
        weeks = _parallel(start, end)
        if not 9 <= length <= 15 or not weeks:
            continue
        w, busy = rng.choice(weeks)
        late = [t[0] for t in tasks if t[2] > 1]
        return {"band": rng.choice(BANDS), "project": key, "tasks": tasks, "milestone": list(milestone),
                "ask": rng.choice(["start", "end", "end", "milestone"]), "ask_task": rng.choice(late),
                "week": w, "with": rng.choice(busy), "longer": rng.choice(LETTERS), "weeks": length + 2}


def draw(p: dict):
    tasks, weeks = p["tasks"], p["weeks"]
    start, end = plan(tasks)
    rows = len(tasks) + 1  # and the milestone's
    fig, ax = new_figure((LABEL_W + weeks + 0.3) * WEEK_IN, 0.42 * (rows + 3.4))
    x0 = -LABEL_W
    # Header: the columns' names and the week numbers.
    ax.text(x0 + 0.1, 0.5, "Task", ha="left", va="center", fontsize=10, fontweight="bold")
    ax.text(-1.6, 0.5, "After", ha="left", va="center", fontsize=10, fontweight="bold")
    ax.text(weeks / 2, 1.35, "Week", ha="center", va="center", fontsize=10, fontweight="bold")
    for w in range(1, weeks + 1):
        ax.text(w - 0.5, 0.5, str(w), ha="center", va="center", fontsize=9)
    for w in range(weeks + 1):
        ax.plot([w, w], [-rows, 1], color=GRID, linewidth=0.7, zorder=1)
    ax.plot([x0, weeks], [0, 0], color=INK, linewidth=1.0, zorder=1)
    ax.plot([x0, weeks], [1, 1], color=INK, linewidth=1.0, zorder=1)
    ax.plot([x0, weeks], [-rows, -rows], color=INK, linewidth=1.0, zorder=1)
    ax.plot([0, 0], [-rows, 1], color=INK, linewidth=1.0, zorder=1)
    ax.plot([-1.75, -1.75], [-len(tasks), 1], color=GRID, linewidth=0.7, zorder=1)  # the milestone's name runs across
    y = {}
    for i, (letter, name, s, dur, after) in enumerate(tasks):
        yc = -(i + 0.5)
        y[letter] = yc
        ax.plot([x0, weeks], [-(i + 1), -(i + 1)], color=GRID, linewidth=0.6, zorder=1)
        ax.text(x0 + 0.1, yc, f"{letter}  {name}", ha="left", va="center", fontsize=9.5)
        ax.text(-1.6, yc, ", ".join(after) if after else "–", ha="left", va="center", fontsize=9.5)
        ax.add_patch(Rectangle((s - 1, yc - 0.27), end[letter] - s + 1, 0.54, facecolor="#9fb3c8", edgecolor=INK, linewidth=1.0,
                               zorder=2, gid=f"bar-{letter}"))
    # Dependencies: out of the end of one bar, then down onto the start of the next.
    for letter, _, s, _, after in tasks:
        for a in after:
            xa, xb = end[a], s - 1 + 0.3
            ax.plot([xa, xb], [y[a], y[a]], color=INK, linewidth=1.0, zorder=3)
            ax.annotate("", xy=(xb, y[letter] + 0.27), xytext=(xb, y[a]),
                        arrowprops=dict(arrowstyle="-|>", color=INK, lw=1.0, shrinkA=0, shrinkB=0, mutation_scale=9), zorder=3)
    # The milestone.
    label, after = p["milestone"]
    ym = -(len(tasks) + 0.5)
    ax.text(x0 + 0.1, ym, f"Milestone: {label}", ha="left", va="center", fontsize=9.5, style="italic")
    ax.plot([end[after]], [ym], marker="D", markersize=9, color=INK, zorder=4)
    ax.text(x0, -rows - 0.75, "An arrow joins a task to one that cannot start until it ends. ◆ marks a milestone, reached at "
            "the end of a week.", ha="left", va="center", fontsize=8.5, color="#333333")
    ax.set_xlim(x0 - 0.1, weeks + 0.2)
    ax.set_ylim(-rows - 1.2, 1.7)
    ax.axis("off")
    return fig


VERBS = ["plans", "manages", "draws this Gantt chart for", "schedules", "is in charge of"]
SETTINGS = ["for an IT lesson", "with the project team", "before work starts", "for a class test", "for the head teacher"]


def _week(n: int) -> list[str]:
    return [str(n), f"week {n}", f"Week {n}"]


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    tasks = p["tasks"]
    start, end = plan(tasks)
    title = PROJECTS[p["project"]][0]
    first = f"{who} {rng.choice(VERBS)} {title} {rng.choice(SETTINGS)}."
    if p["ask"] == "milestone":
        label, after = p["milestone"]
        q1 = short(f"{first} At the end of which week is the milestone '{label}' reached?", end[after], _week(end[after]))
    else:
        x = p["ask_task"]
        n = start[x] if p["ask"] == "start" else end[x]
        q1 = short(f"{first} In which week does task {x} {p['ask']}?", n, _week(n))
    length = max(end.values())
    q2 = short(rng.choice(["What is the shortest time in which the whole project can be completed, in weeks?",
                           "How many weeks does the whole project take, at the earliest?",
                           "What is the shortest length of the project, in weeks?"]), length, [f"{length} weeks"])
    w, x = p["week"], p["with"]
    other = next(t for t in start if t != x and start[t] <= w <= end[t])
    name = next(t[1] for t in tasks if t[0] == other)
    q3 = short(f"In week {w}, which task runs in parallel with task {x}?", other,
               [other, f"task {other}", f"Task {other}", name, name.lower(), f"{other} {name}"])
    late = max(plan(tasks, {p["longer"]: 2})[1].values())
    q4 = short(f"Each task starts as soon as the tasks it depends on have finished. If task {p['longer']} takes 2 weeks longer "
               "than planned, in which week does the project now end?", late, _week(late))
    return [q1, q2, q3, q4]
