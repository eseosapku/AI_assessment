"""Critical path networks (UP, AL): six to eight activities drawn as arrows between numbered nodes, as Cambridge AS
Business draws them: each node a circle with its number on the left, its earliest start time (EST) top right and its
latest finish time (LFT) bottom right; each arrow labelled with its letter and its duration in days. Two sub-types:
the nodes' EST and LFT left blank, for the student to work out, or filled in.

The project's shortest completion time, the activities on the critical path (MCQ), and an activity's total float,
with the formula in the stem. Durations are drawn until one path is the longest by at least two days: one critical
path, no tie and no near-tie. The networks come from eight layouts, each also drawn upside down, and need no dummy
activities; every arrow runs from a lower node number to a higher one.
"""
from __future__ import annotations

import math
import random

from matplotlib.patches import Circle

from ..core import INK, NAMES, mcq, new_figure, short

ID = "critical_path"
KIND = "process.flow"
SUBJECT = "business"
BANDS = ("UP", "AL")
CONCEPTS = ("business.project-management",)
# A topic whose sections the book lists is reached only if one names what this figure teaches.
NEEDS = r"project|network|critical path|float|operations planning"

# Layouts: nodes at (column, row), rows 1, 0 and -1; activities as (from, to) between the nodes listed. No two arrows
# cross, none passes through a node, and their labels sit apart.
LAYOUTS = [
    ([(0, 0), (1, 1), (1, -1), (2, 0), (3, 0)], [(0, 1), (0, 2), (1, 2), (1, 3), (2, 3), (3, 4)]),
    ([(0, 0), (1, 1), (1, -1), (2, 0), (3, 0)], [(0, 1), (0, 2), (0, 3), (1, 3), (2, 3), (3, 4)]),
    ([(0, 0), (1, 1), (1, -1), (2, 1), (2, -1), (3, 0)], [(0, 1), (0, 2), (1, 3), (2, 4), (1, 4), (3, 5), (4, 5)]),
    ([(0, 0), (1, 0), (2, 1), (2, -1), (3, 0), (4, 0)], [(0, 1), (1, 2), (1, 3), (2, 3), (2, 4), (3, 4), (4, 5)]),
    ([(0, 0), (1, 1), (1, -1), (2, 1), (2, -1), (3, 0)], [(0, 1), (0, 2), (1, 3), (2, 4), (3, 4), (3, 5), (4, 5)]),
    ([(0, 0), (1, 1), (1, -1), (2, 1), (2, -1), (3, 0)], [(0, 1), (0, 2), (1, 2), (1, 3), (1, 4), (2, 4), (3, 5), (4, 5)]),
    ([(0, 0), (1, 1), (1, 0), (1, -1), (2, 1), (2, -1), (3, 0)], [(0, 1), (0, 2), (0, 3), (1, 4), (2, 4), (3, 5), (4, 6), (5, 6)]),
    ([(0, 0), (1, 1), (1, -1), (2, 0), (3, 1), (3, -1), (4, 0)], [(0, 1), (0, 2), (1, 3), (2, 3), (3, 4), (3, 5), (4, 6), (5, 6)]),
]
PROJECTS = ["building a classroom block in Nyagatare", "opening a new shop in Kigali", "setting up a bakery in Huye",
            "building a storage shed for a Musanze cooperative", "installing solar panels at a school in Rusizi",
            "organising a trade fair in Kigali", "fitting out a hotel kitchen in Rubavu", "launching a juice factory in Rwamagana"]
DX, DY, R = 2.5, 1.55, 0.46


def _number(nodes: list, edges: list) -> list[int]:
    """Node numbers in a topological order, left to right and top to bottom where there is a choice."""
    order, done = [], set()
    while len(order) < len(nodes):
        ready = [i for i in range(len(nodes)) if i not in done and all(a in done for a, b in edges if b == i)]
        i = min(ready, key=lambda i: (nodes[i][0], -nodes[i][1]))
        order.append(i)
        done.add(i)
    return [order.index(i) + 1 for i in range(len(nodes))]


def _paths(acts: list, end: int) -> list[list]:
    out: list[list] = []

    def walk(node, sofar):
        if node == end:
            out.append(sofar)
        for a in acts:
            if a[1] == node:
                walk(a[2], sofar + [a])

    walk(1, [])
    return out


def times(p: dict) -> tuple[dict, dict, int]:
    """Each node's EST and LFT, by a forward and a backward pass, and the project's length."""
    acts, n = p["acts"], len(p["nodes"])
    est = {1: 0}
    for node in range(2, n + 1):
        est[node] = max(est[a[1]] + a[3] for a in acts if a[2] == node)
    lft = {n: est[n]}
    for node in range(n - 1, 0, -1):
        lft[node] = min(lft[a[2]] - a[3] for a in acts if a[1] == node)
    return est, lft, est[n]


def sample(rng: random.Random) -> dict:
    cells, pairs = rng.choice(LAYOUTS)
    flip = rng.choice([1, -1])
    cells = [(c, r * flip) for c, r in cells]
    numbers = _number(cells, pairs)
    nodes = sorted([numbers[i], c, r] for i, (c, r) in enumerate(cells))
    links = sorted((numbers[a], numbers[b]) for a, b in pairs)
    while True:
        acts = [[chr(65 + i), a, b, rng.randint(2, 9)] for i, (a, b) in enumerate(links)]
        lengths = sorted((sum(a[3] for a in path) for path in _paths(acts, len(nodes))), reverse=True)
        if lengths[0] - lengths[1] >= 2:
            break
    p = {"band": rng.choice(BANDS), "project": rng.choice(PROJECTS), "nodes": nodes, "acts": acts,
         "mode": rng.choice(["blank", "filled"])}
    est, lft, _ = times(p)
    slack = [a[0] for a in acts if lft[a[2]] - a[3] - est[a[1]] > 0]
    p["float_of"] = rng.choice(slack)
    return p


def _xy(node: list) -> tuple[float, float]:
    return node[1] * DX, node[2] * DY


def draw(p: dict):
    nodes = {n[0]: n for n in p["nodes"]}
    est, lft, _ = times(p)
    cols = max(n[1] for n in p["nodes"])
    fig, ax = new_figure(1.55 * cols + 2.6, 4.9)
    for a in p["acts"]:
        (x0, y0), (x1, y1) = _xy(nodes[a[1]]), _xy(nodes[a[2]])
        d = math.hypot(x1 - x0, y1 - y0)
        ux, uy = (x1 - x0) / d, (y1 - y0) / d
        ax.annotate("", xy=(x1 - ux * R, y1 - uy * R), xytext=(x0 + ux * R, y0 + uy * R),
                    arrowprops=dict(arrowstyle="-|>", color=INK, lw=1.4, shrinkA=0, shrinkB=0, mutation_scale=15))
        ax.text((x0 + x1) / 2, (y0 + y1) / 2, f"{a[0]} {a[3]}", ha="center", va="center", fontsize=10.5, fontweight="bold",
                bbox=dict(boxstyle="round,pad=0.18", facecolor="white", edgecolor="none"), gid=f"act-{a[0]}")
    for num, node in nodes.items():
        x, y = _xy(node)
        ax.add_patch(Circle((x, y), R, facecolor="white", edgecolor=INK, linewidth=1.4))
        ax.plot([x, x], [y - R, y + R], color=INK, linewidth=1.0)
        ax.plot([x, x + R], [y, y], color=INK, linewidth=1.0)
        ax.text(x - R / 2, y, str(num), ha="center", va="center", fontsize=11, fontweight="bold", gid=f"node-{num}")
        if p["mode"] == "filled":
            ax.text(x + R * 0.46, y + R * 0.45, str(est[num]), ha="center", va="center", fontsize=9, gid=f"est-{num}")
            ax.text(x + R * 0.46, y - R * 0.45, str(lft[num]), ha="center", va="center", fontsize=9, gid=f"lft-{num}")
    width = cols * DX
    bottom = -DY - R
    key = ["Each arrow: an activity's letter, then its duration in days.",
           "Each node: its number (left), its earliest start time, EST (top right),",
           "and its latest finish time, LFT (bottom right)."]
    for i, line in enumerate(key):
        ax.text(-R, bottom - 0.45 - 0.4 * i, line, ha="left", va="center", fontsize=9, color="#333333")
    ax.set_xlim(-R - 0.1, width + R + 0.1)
    ax.set_ylim(bottom - 0.45 - 0.4 * len(key) - 0.05, DY + R + 0.1)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


VERBS = ["plans the work of", "manages", "is in charge of", "draws this network for", "schedules the work of"]
SETTINGS = ["for the owners", "with the project team", "before work starts", "for a business studies lesson",
            "to agree a finish date"]


def questions(p: dict, rng: random.Random) -> list:
    who, friend = rng.sample(NAMES, 2)
    acts, n = p["acts"], len(p["nodes"])
    est, lft, total = times(p)
    paths = _paths(acts, n)

    def letters(acts_):
        return ", ".join(sorted(a[0] for a in acts_))

    critical = letters(max(paths, key=lambda path: sum(a[3] for a in path)))
    # The classic slip: every activity joining two nodes with EST = LFT, though one may still have float.
    joined = letters(a for a in acts if est[a[1]] == lft[a[1]] and est[a[2]] == lft[a[2]])
    # The activities with the longest durations, as many as are critical: picked by size, not by path.
    biggest = letters(sorted(acts, key=lambda a: (-a[3], a[0]))[:len(critical.split(", "))])
    # Then the next-longest path. (A key flanked by its superset and the paths it shares activities with was the
    # options' middle one 56% of the time; with the biggest durations among them, 22%.)
    others = [letters(path) for path in sorted(paths, key=lambda path: -sum(a[3] for a in path))]
    x = next(a for a in acts if a[0] == p["float_of"])
    fl = lft[x[2]] - x[3] - est[x[1]]
    first = f"{who} {rng.choice(VERBS)} {p['project']} {rng.choice(SETTINGS)}."
    return [
        short(f"{first} What is the shortest time in which the whole project can be completed, in days?", total,
              [f"{total} days"]),
        mcq(rng.choice(["Which activities are on the critical path?",
                        f"{friend} wants to know which activities cannot be delayed without delaying the project. "
                        f"Which activities are on the critical path?",
                        "Which activities make up the critical path of this network?"]),
            critical, [joined, biggest, *others], rng),
        short(f"Total float = LFT at the end of an activity − its duration − EST at its start. What is the total float of "
              f"activity {x[0]}, in days?", fl, [f"{fl} days"] if fl != 1 else ["1 day", "1 days"]),
    ]
