"""A school prefect election's results (LS, UP): votes for three to five candidates as a bar chart (upright or sideways)
or a table, every count printed, on gridlines. The results are made up and say so ("Example results"), and the
election is a school's, so no real election is implied.

The winner; the margin over the runner-up; the total votes cast; one candidate's share as a whole percent (the counts
are chosen so it is exact); and whether the winner won a majority, defined in the stem as more than half of all the
votes (a winner with the most votes but under half has none: the slip the options test).
"""
from __future__ import annotations

import random

from matplotlib.patches import Rectangle

from ..core import FILL, GRID, INK, NAMES, mcq, new_figure, short

ID = "election_chart"
KIND = "graph.bar"
SUBJECT = "social-studies"
BANDS = ("LS", "UP")
CONCEPTS = tuple(f"social-studies.{c}" for c in ("democracy-concept", "good-governance", "civic-participation-responsibility",
                                                  "political-parties"))
ALSO = ("history.democracy-definition-principles",)
# A topic whose sections the book lists is reached only if its name or a section names democracy, elections or voting,
# governance, civic participation or political parties.
NEEDS = r"democra|election|vot|governance|civic|political part|leadership"
# Units that share a civic concept word but teach rights, media, money, culture or foreign affairs, not elections.
AVOID = (r"human rights|media|scam|financ|money|gender|pluralism|national service|transport|fair operating|official documents|"
         r"cultism|substance|international|foreign|global|arms of government|law and order|constitution|nigerian government|"
         r"ideolog|contemporary|source")

PLACES = ["Kigali", "Huye", "Musanze", "Rubavu", "Nyagatare", "Rusizi", "Muhanga", "Karongi", "Rwamagana", "Nyanza"]
TOTALS = [200, 250, 300, 400, 500]


def sample(rng: random.Random) -> dict:
    k = rng.choice([3, 4, 4, 5])
    majority = rng.random() < 0.5
    while True:
        total = rng.choice(TOTALS)
        names = rng.sample(NAMES, k)
        cuts = sorted(rng.sample(range(1, total), k - 1))
        votes = [b - a for a, b in zip([0, *cuts], [*cuts, total])]
        ranked = sorted(votes, reverse=True)
        if (min(votes) < 12 or len(set(votes)) < k or ranked[0] - ranked[1] < 4 or 2 * ranked[0] == total
                or (2 * ranked[0] > total) != majority):
            continue
        exact = [i for i, v in enumerate(votes) if (100 * v) % total == 0]
        if exact:
            return {"band": rng.choice(BANDS), "place": rng.choice(PLACES), "candidates": names, "votes": votes,
                    "style": rng.choice(["bar", "barh", "table"]), "ask": rng.choice(exact)}


def _step(top: int) -> int:
    return 10 if top <= 120 else 20 if top <= 240 else 50


TITLE = "School prefect election: votes for each candidate"


def draw(p: dict):
    names, votes = p["candidates"], p["votes"]
    sub = f"Example results from a secondary school in {p['place']}"
    if p["style"] == "table":
        return _table(p, sub)
    fig, ax = new_figure(6.6, 4.4)
    step = _step(max(votes))
    top = (max(votes) // step + 2) * step
    pos = list(range(len(names)))
    if p["style"] == "bar":
        ax.bar(pos, votes, width=0.6, color=FILL, edgecolor=INK)
        for x, v in zip(pos, votes):
            ax.text(x, v + top * 0.015, str(v), ha="center", va="bottom", fontsize=10)
        ax.set_xticks(pos, names)
        ax.set_yticks(range(0, top + 1, step))
        ax.set_ylim(0, top)
        ax.set_ylabel("Number of votes")
        ax.set_xlabel("Candidate")
        ax.yaxis.grid(True, color=GRID, linewidth=0.6)
    else:
        ax.barh(pos, votes, height=0.6, color=FILL, edgecolor=INK)
        for y, v in zip(pos, votes):
            ax.text(v + top * 0.012, y, str(v), ha="left", va="center", fontsize=10)
        ax.set_yticks(pos, names)
        ax.set_xticks(range(0, top + 1, step))
        ax.set_xlim(0, top)
        ax.set_ylim(len(names) - 0.5, -0.5)
        ax.set_xlabel("Number of votes")
        ax.xaxis.grid(True, color=GRID, linewidth=0.6)
    ax.set_axisbelow(True)
    ax.tick_params(labelsize=9.5)
    ax.set_title(f"{TITLE}\n{sub}", fontsize=11)
    return fig


def _table(p: dict, sub: str):
    names, votes = p["candidates"], p["votes"]
    fig, ax = new_figure(5.2, 3.4)
    rh, w1, w2 = 0.5, 2.4, 1.8
    n = len(names)
    for c, (text, x, w) in enumerate((("Candidate", 0, w1), ("Votes", w1, w2))):
        ax.add_patch(Rectangle((x, n * rh), w, rh, facecolor="#d9dee3", edgecolor=INK, linewidth=1.0))
        ax.text(x + w / 2, n * rh + rh / 2, text, ha="center", va="center", fontsize=10, fontweight="bold")
        for r, (name, v) in enumerate(zip(names, votes)):
            y = (n - 1 - r) * rh
            ax.add_patch(Rectangle((x, y), w, rh, facecolor="white", edgecolor=INK, linewidth=0.8))
            if c == 0:
                ax.text(x + 0.15, y + rh / 2, name, ha="left", va="center", fontsize=10)
            else:
                ax.text(x + w - 0.2, y + rh / 2, str(v), ha="right", va="center", fontsize=10)
    ax.set_xlim(-0.1, w1 + w2 + 0.1)
    ax.set_ylim(-0.1, (n + 1) * rh + 0.1)
    ax.set_aspect("equal")
    ax.axis("off")
    ax.set_title(f"{TITLE}\n{sub}", fontsize=10.5)
    return fig


# --- questions --------------------------------------------------------------------------------------

SETTINGS = ["for the school notice board", "as the class monitor", "for the school newsletter", "at the end of election day",
            "in a citizenship lesson", "for the student council"]


def questions(p: dict, rng: random.Random) -> list:
    names, votes = p["candidates"], p["votes"]
    who, friend = rng.sample([n for n in NAMES if n not in names], 2)
    by = dict(zip(names, votes))
    ranked = sorted(names, key=by.get, reverse=True)
    win, second = ranked[0], ranked[1]
    total = sum(votes)
    ask = names[p["ask"]]
    pct = 100 * by[ask] // total
    yes = 2 * by[win] > total
    right = f"Yes: {win} won more than half of the {total} votes" if yes else f"No: {win} won fewer than half of the {total} votes"
    wrong = [f"No: {win} won fewer than half of the {total} votes" if yes else f"Yes: {win} won more than half of the {total} votes",
             "Yes: getting the most votes is always a majority", "No: a majority needs two-thirds of the votes"]
    return [
        mcq(f"{who} counts the votes in this school prefect election {rng.choice(SETTINGS)}. Who won the election?", win,
            ranked[1:], rng),
        short(f"By how many votes did {win} beat {second}, who came second?", by[win] - by[second],
              [f"{by[win] - by[second]} votes"]),
        short(rng.choice([f"{friend} adds up the votes. How many votes were cast altogether in this election?",
                          "Each student had one vote. How many students voted altogether in this election?"]), total,
              [f"{total} votes", f"{total} students"]),
        short(f"What percentage of all the votes did {ask} get?", pct, [f"{pct}%", f"{pct} %"]),
        mcq(f"A candidate wins a majority by getting more than half of all the votes. Did {win} win a majority?", right, wrong, rng),
    ]
