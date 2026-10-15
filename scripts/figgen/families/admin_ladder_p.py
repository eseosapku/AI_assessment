"""Rwanda's local government ladder (P, Primary Social Studies): six boxes stacked from the smallest level at the
bottom to the largest at the top, Umudugudu (village), Akagari (cell), Umurenge (sector), Akarere (district),
Intara (province) or Kigali City, and Igihugu (country), each with its leader beside it. One box (two at the upper
level, never side by side) is left empty and lettered. The upper level (P4 to P6) also prints how many of each level
Rwanda has. Drawn as a stack that widens as it climbs, or as a staircase.

- Which level goes in the empty box? The wrong options are the levels just above and below it (and the other empty
  box's level), the slips of a child who has the order nearly right.
- Which level comes just above (below) a level, or which is the smallest (largest)? Asked only where every box the
  answer needs is printed.
- Who leads a level? Asked only of a printed level whose leader the table is sure of.
- Upper: how many districts (sectors, cells, villages) are there, or how many more of one than another?

Every fact is the table LADDER below, from the 2006 reform; nothing is asked that it does not hold.
"""
from __future__ import annotations

import random

from matplotlib.patches import FancyArrow, FancyBboxPatch

from ..core import FILL_2, INK, NAMES, count, mcq, new_figure

ID = "admin_ladder_p"
KIND = "diagram.template"
SUBJECT = "social-studies"
BANDS = ("P",)
CONCEPTS = tuple(f"social-studies.{c}" for c in ("local-government", "village-leaders", "cell-leaders", "leadership-sector"))
# A topic whose sections the book lists is reached only if its name or a section names local government or its leaders.
NEEDS = r"local government|our sector|leadership in our district|cell leaders|village leaders|leaders of the sector"
# Never a religious topic; never a Nigerian civics topic (Rwanda's ladder is not theirs, and they list no sections);
# never the school's own leaders.
AVOID = (r"\bgod\b|god's|bible|qur'?an|prayer|faith|\bsin\b|creation|commandment|charity|"
         r"democracy and governance|community helpers|rights and responsibilities|school leaders|historical events")

# Rwanda's levels of local government, smallest first, as set by the 2006 territorial reform (Organic Law
# No. 29/2005 of 31/12/2005 determining the administrative entities of the Republic of Rwanda), with the counts
# MINALOC and NISR (Fourth Population and Housing Census, 2012) give: 4 provinces and the City of Kigali,
# 30 districts, 416 sectors, 2,148 cells and 14,837 villages (imidugudu).
# Each level: as the chart names it, the leader a Primary book gives it (None where a single answer would be unfair:
# a province has a Governor but Kigali City a Mayor), the count, and what the count is of.
LADDER = [("Umudugudu (village)", "a village leader", 14837, "villages"),
          ("Akagari (cell)", "an Executive Secretary", 2148, "cells"),
          ("Umurenge (sector)", "an Executive Secretary", 416, "sectors"),
          ("Akarere (district)", "a Mayor", 30, "districts"),
          ("Intara (province) or Kigali City", None, 4, "provinces"),
          ("Igihugu (country)", "the President", 1, None)]
LEADERS = ["a village leader", "an Executive Secretary", "a Mayor", "a Governor", "the President"]
# The leader as printed beside each box.
LED_BY = ["Led by a village leader", "Led by an Executive Secretary", "Led by an Executive Secretary",
          "Led by a Mayor", "Led by a Governor\n(Kigali City: a Mayor)", "Led by the President"]
SHOWN_COUNT = ["14 837 villages", "2 148 cells", "416 sectors", "30 districts", "4 provinces and\nKigali City",
               "1 country: Rwanda"]


def stages(p: dict) -> tuple[int, int] | None:
    return (4, 6) if p["level"] == "upper" else None  # five-figure counts and their differences


def name(i: int) -> str:
    return LADDER[i][0]


def sample(rng: random.Random) -> dict:
    level = rng.choice(["lower", "upper"])
    if level == "lower":
        blanks = [rng.randrange(6)]
    else:
        blanks = sorted(rng.choice([(a, b) for a in range(6) for b in range(a + 2, 6)]))
    shown = [i for i in range(6) if i not in blanks]
    steps = [["above", i] for i in shown if i + 1 in shown] + [["below", i] for i in shown if i - 1 in shown]
    steps += [["smallest", 0]] if 0 in shown else []
    steps += [["largest", 5]] if 5 in shown else []
    led = [i for i in shown if LADDER[i][1]]
    numbers = [["one", i] for i in shown if i <= 3]
    numbers += [["more", a, b] for a in shown for b in shown if 1 <= a < b <= 3]
    p = {"band": "P", "level": level, "style": rng.choice(["stack", "steps"]), "blanks": blanks,
         "ask": rng.choice(blanks), "step": rng.choice(steps), "leader": rng.choice(led)}
    if level == "upper":
        p["number"] = rng.choice(numbers)
    return p


# --- drawing ----------------------------------------------------------------------------------------

ROW, BOXH = 1.0, 0.74


def _box_at(p: dict, i: int) -> tuple[float, float]:
    """The centre x and the width of level i's box."""
    if p["style"] == "stack":
        return 0.0, 3.9 + 0.5 * i
    return -1.25 + 0.5 * i, 4.3


def draw(p: dict):
    upper = p["level"] == "upper"
    fig, ax = new_figure(10.0, 5.3)
    fig.subplots_adjust(left=0.01, right=0.99, bottom=0.01, top=0.99)
    letters = dict(zip(p["blanks"], "AB"))
    right = max(_box_at(p, i)[0] + _box_at(p, i)[1] / 2 for i in range(6))
    left = min(_box_at(p, i)[0] - _box_at(p, i)[1] / 2 for i in range(6))
    for i in range(6):
        cx, w = _box_at(p, i)
        y = i * ROW
        blank = i in letters
        ax.add_patch(FancyBboxPatch((cx - w / 2, y - BOXH / 2), w, BOXH, boxstyle="round,pad=0,rounding_size=0.12",
                                    facecolor="white" if blank else FILL_2, edgecolor=INK, linewidth=1.4,
                                    linestyle="--" if blank else "-", zorder=2))
        if blank:
            ax.text(cx, y, letters[i], ha="center", va="center", fontsize=15, fontweight="bold", gid=f"blank:{letters[i]}")
            continue
        ax.text(cx, y, name(i).replace(" or ", "\nor "), ha="center", va="center", fontsize=11, fontweight="bold",
                linespacing=1.05, gid=f"level:{i}")
        ax.text(right + 0.35, y, LED_BY[i], ha="left", va="center", fontsize=10.5, linespacing=1.05, gid=f"leader:{i}")
        if upper:
            ax.text(left - 0.35, y, SHOWN_COUNT[i], ha="right", va="center", fontsize=10.5, linespacing=1.05,
                    gid=f"count:{i}")
    # an arrow up the side: from the smallest to the largest
    ax_x = left - (3.6 if upper else 0.9)
    ax.add_patch(FancyArrow(ax_x, -0.2, 0, 5.4, width=0.06, head_width=0.32, head_length=0.35, color=INK,
                            length_includes_head=True))
    ax.text(ax_x, -0.62, "smallest", ha="center", va="center", fontsize=10.5)
    ax.text(ax_x, 5.62, "largest", ha="center", va="center", fontsize=10.5)
    ax.text((left + right) / 2 + 1.0, 6.35, "Local government in Rwanda", ha="center", va="center", fontsize=13,
            fontweight="bold")
    ax.set_xlim(ax_x - 0.8, right + 4.4)
    ax.set_ylim(-0.95, 6.75)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


# --- questions --------------------------------------------------------------------------------------

SETTINGS = ["for a Social Studies lesson", "for homework", "for the class wall", "before a visit to the sector office",
            "for a class test", "for a lesson in Huye", "for a lesson in Rubavu", "for a quiz with friends"]
VERBS = ["made", "drew", "copied"]


def _near(i: int) -> list[int]:
    """The other levels, nearest to level i first."""
    return sorted((j for j in range(6) if j != i), key=lambda j: (abs(j - i), j))


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    letters = dict(zip(p["blanks"], "AB"))
    qs = []

    # 1. the empty box
    i = p["ask"]
    others = [j for j in p["blanks"] if j != i] + [j for j in _near(i) if j not in p["blanks"]]
    qs.append(mcq(f"{who} {rng.choice(VERBS)} this chart of local government in Rwanda {rng.choice(SETTINGS)}. "
                  f"Which level goes in box {letters[i]}?", name(i), [name(j) for j in others], rng))

    # 2. a step up or down, or an end of the ladder
    what, i = p["step"]
    if what in ("above", "below"):
        j = i + 1 if what == "above" else i - 1
        wrong = [i - 1 if what == "above" else i + 1, j + 1 if what == "above" else j - 1] + _near(j)
        wrong = [k for k in wrong if 0 <= k < 6 and k not in (i, j)]
        qs.append(mcq(f"Which level comes just {what} the {name(i)} on the chart?", name(j), [name(k) for k in wrong], rng))
    else:
        end = 5 - i  # the other end: top and bottom mixed up
        qs.append(mcq(f"Which is the {what} unit on the chart?", name(i), [name(end)] + [name(k) for k in _near(i)], rng))

    # 3. a leader
    i = p["leader"]
    key = LADDER[i][1]
    near = [LADDER[j][1] for j in _near(i) if LADDER[j][1] and LADDER[j][1] != key]
    article = "the" if i == 5 else "an"
    qs.append(mcq(f"Who leads {article} {name(i)}?", key, near + ["a Governor"], rng))

    # 4. how many (upper)
    if p["level"] == "upper":
        num = p["number"]
        if num[0] == "one":
            n, noun = LADDER[num[1]][2], LADDER[num[1]][3]
            qs.append(count(f"The chart shows how many of each level Rwanda has. How many {noun} are there in Rwanda?",
                            n, noun))
        else:
            a, b = num[1], num[2]
            qs.append(count(f"How many more {LADDER[a][3]} than {LADDER[b][3]} are there in Rwanda?",
                            LADDER[a][2] - LADDER[b][2], LADDER[a][3]))
    return qs
