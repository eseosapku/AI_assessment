"""Behaviour data (UP): two experiments on mammal behaviour.

- Maze learning: the mean number of errors two groups of rats made in a maze on each of 10 days, on a 1-error grid.
  Group P found food in the goal box every day and its errors fell steadily; group Q found food only from a stated
  day, and its errors stayed high until then and fell sharply after (latent learning). Asks a group's errors on a day,
  the first day a group made fewer than a stated number, and which group made fewer errors on a day.
- Activity rhythm: the turns of a running wheel an animal made in each 2-hour block of a day, as a bar chart with the
  dark hours (18:00 to 06:00) shaded and marked. Asks whether it is active mainly by day or at night, the turns in one
  block, and the total in the dark.
"""
from __future__ import annotations

import random

from matplotlib.patches import Rectangle

from ..core import GRID, INK, NAMES, count, mcq, new_figure

ID = "behaviour_data"
KIND = "graph.line"
SUBJECT = "biology"
BANDS = ("UP",)
CONCEPTS = tuple(f"biology.{c}" for c in ("behaviour-types", "learning-conditioning", "behavioural-rhythms-biological-clocks"))
# A topic whose sections the book lists is reached only if one names behaviour, learning or rhythms.
NEEDS = r"behaviou?r|learning|conditioning|rhythm|biological clock"
AVOID = (r"sexual|temperature|plant|STIs|HIV|glossary|science in context|social factors|reproduction system|"
         r"decision-making")
BLOCKS = [f"{h:02d}:00" for h in range(0, 24, 2)]
DARK = (0, 1, 2, 9, 10, 11)  # the blocks from 18:00 to 06:00


def concepts_for(p: dict) -> tuple:
    if p["kind"] == "maze":
        return ("biology.learning-conditioning", "biology.behaviour-types")
    return ("biology.behavioural-rhythms-biological-clocks", "biology.behaviour-types")


def _maze(rng: random.Random) -> dict:
    start = rng.randint(11, 14)
    end = rng.randint(1, 3)
    p_err = [start]
    for d in range(1, 10):
        left = 9 - d
        floor = end + max(0, left - 6)  # leaves room to finish near `end`
        step = rng.choice([0, 1, 1, 2, 2]) if p_err[-1] > floor else 0
        p_err.append(max(end, p_err[-1] - step))
    p_err[-1] = end if p_err[-1] > end else p_err[-1]
    reward = rng.choice([6, 7])
    q_err = []
    for d in range(1, 11):
        if d == 1:
            q_err.append(start + rng.randint(0, 1))
        elif d <= reward:  # no food yet: errors stay high, falling slowly
            q_err.append(max(p_err[d - 1] + 2, q_err[-1] - rng.randint(0, 1)))
        else:
            q_err.append(min(q_err[-1] - 3, p_err[d - 1] + rng.randint(0, 2)))
    q_err = [max(1, e) for e in q_err]
    letters = ["P", "Q"]
    return {"kind": "maze", "reward_from": reward,
            "groups": [{"letter": letters[0], "errors": p_err}, {"letter": letters[1], "errors": q_err}]}


def _activity(rng: random.Random) -> dict:
    night = rng.random() < 0.5
    counts = []
    for i in range(12):
        active = (i in DARK) == night
        counts.append(rng.randrange(120, 381, 20) if active else rng.randrange(20, 81, 20))
    return {"kind": "activity", "counts": counts, "animal": rng.choice(["X", "Y", "Z"])}


def sample(rng: random.Random) -> dict:
    p = _maze(rng) if rng.random() < 0.5 else _activity(rng)
    return {"band": "UP", **p}


# --- drawing ----------------------------------------------------------------------------------------

def _draw_maze(p: dict):
    fig, ax = new_figure(7.0, 4.6)
    days = list(range(1, 11))
    for g, st, mk in zip(p["groups"], ["-", (0, (6, 3))], ["o", "s"]):
        label = ("group P: food in the goal box every day" if g["letter"] == "P"
                 else f"group Q: food in the goal box from day {p['reward_from']}")
        ax.plot(days, g["errors"], color=INK, linewidth=1.7, linestyle=st, marker=mk, markersize=5, gid=f"group:{g['letter']}",
                label=label)
    top = max(max(g["errors"]) for g in p["groups"]) + 5
    ax.set_xticks(days)
    ax.set_yticks(range(0, top + 1, 2))
    ax.set_yticks(range(0, top + 1), minor=True)
    ax.grid(True, which="both", color=GRID, linewidth=0.5)
    ax.set_axisbelow(True)
    ax.set_xlim(0.5, 10.5)
    ax.set_ylim(0, top)
    ax.set_xlabel("Day")
    ax.set_ylabel("Mean number of errors in the maze")
    ax.tick_params(labelsize=9)
    ax.legend(loc="upper right", fontsize=9, frameon=True, framealpha=1.0, edgecolor=INK)
    ax.set_title("Two groups of rats learning the same maze", fontsize=11)
    return fig


def _draw_activity(p: dict):
    fig, ax = new_figure(7.4, 4.4)
    top = max(p["counts"]) + 60
    top = (top // 100 + 1) * 100
    for x0, x1 in ((-0.5, 2.5), (8.5, 11.5)):
        ax.add_patch(Rectangle((x0, 0), x1 - x0, top, facecolor="#dcdcdc", edgecolor="none", zorder=0, gid="dark"))
    for i, c in enumerate(p["counts"]):
        ax.add_patch(Rectangle((i - 0.32, 0), 0.64, c, facecolor="#8f9ba6", edgecolor=INK, linewidth=0.9, zorder=2,
                               gid=f"bar:{BLOCKS[i]}"))
    ax.set_xticks(range(12))
    ax.set_xticklabels(BLOCKS)
    ax.set_xlim(-0.5, 11.5)
    ax.set_yticks(range(0, top + 1, 100))
    ax.set_yticks(range(0, top + 1, 20), minor=True)
    ax.yaxis.grid(True, which="both", color=GRID, linewidth=0.5, zorder=1)
    ax.set_axisbelow(True)
    ax.set_ylim(0, top)
    ax.set_xlabel("Start of each 2-hour period (24-hour clock)")
    ax.set_ylabel("Turns of the running wheel")
    ax.tick_params(labelsize=8.5)
    for x, words in ((1.0, "dark"), (5.5, "light"), (10.0, "dark")):
        ax.text(x, 1.02, words, transform=ax.get_xaxis_transform(), ha="center", va="bottom", fontsize=9.5, style="italic")
    ax.set_title(f"Activity of animal {p['animal']} over one day (dark from 18:00 to 06:00)", fontsize=11, pad=18)
    return fig


def draw(p: dict):
    return _draw_maze(p) if p["kind"] == "maze" else _draw_activity(p)


# --- questions --------------------------------------------------------------------------------------

SETTINGS = ["in a biology lesson in Huye", "for a revision poster", "from a textbook in the school library in Musanze",
            "before a test on behaviour", "for homework", "at the science club in Rubavu", "in a lesson on learning",
            "for a class display in Nyagatare"]
WAYS = ["mainly by day", "mainly at night", "equally by day and at night"]


def _q_maze(p: dict, rng: random.Random) -> list:
    g = {x["letter"]: x["errors"] for x in p["groups"]}
    who = rng.choice(NAMES)
    X, d = rng.choice("PQ"), rng.randint(1, 10)
    qs = [count(f"{who} is studying this graph of rats learning a maze {rng.choice(SETTINGS)}. How many errors did group "
                f"{X} make on day {d}?", g[X][d - 1], "errors")]
    X = rng.choice("PQ")
    ks = [k for k in range(2, max(g[X])) if any(e < k for e in g[X]) and g[X][0] >= k]
    k = rng.choice(ks)
    day = next(i + 1 for i, e in enumerate(g[X]) if e < k)
    qs.append(count(f"On which day did group {X} first make fewer than {k} errors?", day, "day"))
    d = rng.choice([i + 1 for i in range(10) if g["P"][i] != g["Q"][i]])
    key = "group P" if g["P"][d - 1] < g["Q"][d - 1] else "group Q"
    qs.append(mcq(f"Which group made fewer errors on day {d}?", key,
                  [x for x in ("group P", "group Q", "both made the same number") if x != key], rng))
    return qs


def _q_activity(p: dict, rng: random.Random) -> list:
    c = p["counts"]
    who = rng.choice(NAMES)
    dark = sum(c[i] for i in DARK)
    light = sum(c) - dark
    key = WAYS[1] if dark > light else WAYS[0]
    qs = [mcq(f"{who} is studying this record of animal {p['animal']}'s running wheel {rng.choice(SETTINGS)}. Is animal "
              f"{p['animal']} active mainly by day or at night?", key, [w for w in WAYS if w != key], rng)]
    i = rng.randrange(12)
    end = f"{(2 * i + 2) % 24:02d}:00"
    qs.append(count(f"How many turns did animal {p['animal']} make from {BLOCKS[i]} to {end}?", c[i], "turns"))
    qs.append(count(f"How many turns did animal {p['animal']} make in the dark, from 18:00 to 06:00, altogether?", dark,
                    "turns"))
    return qs


def questions(p: dict, rng: random.Random) -> list:
    return _q_maze(p, rng) if p["kind"] == "maze" else _q_activity(p, rng)
