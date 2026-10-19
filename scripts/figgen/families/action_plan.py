"""Action plans for a personal goal (LS, UP; Rwanda Entrepreneurship S2 and S4 "Setting personal goals"): a student's
SMART goal with its deadline week, and the plan to reach it: four to six steps in a table (start week, number of
weeks) beside a week grid with one bar per step. The rule is printed: a step that starts in week 3 and lasts 2 weeks
runs in weeks 3 and 4. Lower Secondary goals are a student's (saving for a bicycle, a better mark, a vegetable
garden); Upper Secondary goals start a small business or prepare for the national exam.

Which step ends last (one step plainly last; the step that starts last and the longest step are offered); for how
many weeks two named steps overlap (always at least one); and the week the last step ends and the goal is reached, or
how many steps are under way in a stated week.
"""
from __future__ import annotations

import random

from matplotlib.patches import Rectangle

from ..core import GRID, INK, NAMES, mcq, new_figure, short

ID = "action_plan"
KIND = "timeline"
SUBJECT = "business"
BANDS = ("LS", "UP")
CONCEPTS = ("business.goal-setting-and-types", "business.creating-timeline")
# A topic whose sections the book lists is reached only if its name or a section names goals or a timeline.
NEEDS = r"goal|timeline|action plan"
# Listed without sections, sharing goal setting, but teaching forms of business or bookkeeping.
AVOID = r"forms of business|bookkeeping"

# (goal, with {d} for the deadline week; the steps it may use, in the order they are done)
GOALS = {
    "LS": [
        ("Save 30 000 Frw to buy a bicycle by the end of week {d}",
         ["Make a savings plan", "Open a savings box", "Sell eggs at the market", "Do weekend jobs",
          "Collect money owed", "Compare bicycle prices"]),
        ("Score at least 70% in the mathematics exam in week {d}",
         ["Draw up a revision timetable", "Ask my teacher for help", "Revise fractions", "Join a study group",
          "Practise past papers", "Sit a practice test"]),
        ("Grow and sell 100 cabbages by the end of week {d}",
         ["Prepare the garden", "Plant seedlings", "Water and weed", "Find buyers", "Harvest cabbages",
          "Sell at Kimironko market"]),
        ("Read six storybooks in English by the end of week {d}",
         ["Borrow books from the library", "Read every evening", "Learn new words", "Write short summaries",
          "Discuss stories with friends", "Tell the class about one book"]),
    ],
    "UP": [
        ("Start a poultry project with 50 chickens by the end of week {d}",
         ["Write a business plan", "Raise start-up money", "Register with the sector office", "Build a chicken house",
          "Buy chicks and feed", "Find egg customers"]),
        ("Open a phone-charging kiosk in Huye by the end of week {d}",
         ["Survey possible customers", "Get a trading licence", "Rent a kiosk", "Buy solar panels",
          "Train one helper", "Advertise on local radio"]),
        ("Get grade A in the national entrepreneurship exam in week {d}",
         ["Draw up a revision timetable", "Finish my notes", "Meet a study group", "Visit three local businesses",
          "Answer past papers", "Sit a mock exam"]),
        ("Save 200 000 Frw for university fees by the end of week {d}",
         ["Open a mobile savings account", "Cut weekly spending", "Work at a holiday job", "Sell second-hand books",
          "Apply for a bursary", "Track savings every Friday"]),
    ],
}


def sample(rng: random.Random) -> dict:
    band = rng.choice(BANDS)
    goal, labels = rng.choice(GOALS[band])
    while True:
        k = rng.randint(4, 6)
        names = [labels[i] for i in sorted(rng.sample(range(len(labels)), k))]
        steps, start = [], 1
        for i, lab in enumerate(names):
            if i:
                start = max(1, start + rng.randint(-1, 3))
            steps.append([lab, start, rng.randint(1, 5)])
        ends = [s + d - 1 for _, s, d in steps]
        last = max(ends)
        if last > 15 or ends.count(last) > 1:
            continue
        spans = [(s, s + d - 1) for _, s, d in steps]
        pairs = [(i, j) for i in range(k) for j in range(i + 1, k)
                 if min(spans[i][1], spans[j][1]) - max(spans[i][0], spans[j][0]) >= 0]
        if not pairs:
            continue
        deadline = last + rng.randint(0, 2)
        return {"band": band, "name": rng.choice(NAMES), "goal": goal.format(d=deadline), "deadline": deadline,
                "steps": steps}


def draw(p: dict):
    steps = p["steps"]
    weeks = max(p["deadline"], max(s + d - 1 for _, s, d in steps)) + 1
    widths = [4.3, 1.25, 1.1]
    x0 = sum(widths) + 0.3
    cw, rh, hh = 0.55, 0.55, 0.7
    total = x0 + weeks * cw
    fig, ax = new_figure(1.0 + 0.72 * total, 0.55 * (len(steps) + 6.5))
    fig.subplots_adjust(left=0, right=1, bottom=0, top=1)
    ax.text(0, 1.35, f"{p['name']}'s action plan", ha="left", va="center", fontsize=12.5, fontweight="bold")
    ax.text(0, 0.8, f"SMART goal: {p['goal']}", ha="left", va="center", fontsize=10.5)
    head = ["Step", "Start\nweek", "Number\nof weeks"]
    x = 0.0
    for w, h in zip(widths, head):
        ax.add_patch(Rectangle((x, -hh), w, hh, facecolor="#d9dee3", edgecolor=INK, linewidth=0.9))
        ax.text(x + w / 2, -hh / 2, h, ha="center", va="center", fontsize=9.5, fontweight="bold")
        x += w
    ax.add_patch(Rectangle((x0, -hh), weeks * cw, hh, facecolor="#d9dee3", edgecolor=INK, linewidth=0.9))
    ax.text(x0 + weeks * cw / 2, -0.18, "Week", ha="center", va="center", fontsize=9, fontweight="bold")
    for wk in range(1, weeks + 1):
        ax.text(x0 + (wk - 0.5) * cw, -0.5, str(wk), ha="center", va="center", fontsize=8.5)
    bottom = -hh - len(steps) * rh
    for wk in range(weeks + 1):
        ax.plot([x0 + wk * cw] * 2, [-hh, bottom], color=GRID if 0 < wk < weeks else INK, linewidth=0.7)
    for r, (label, start, dur) in enumerate(steps):
        y = -hh - (r + 1) * rh
        x = 0.0
        for c, (w, v) in enumerate(zip(widths, (label, str(start), str(dur)))):
            ax.add_patch(Rectangle((x, y), w, rh, facecolor="white", edgecolor="#888888", linewidth=0.7))
            ax.text(x + 0.12 if c == 0 else x + w / 2, y + rh / 2, v, ha="left" if c == 0 else "center",
                    va="center", fontsize=10)
            x += w
        ax.plot([x0, x0 + weeks * cw], [y, y], color=GRID, linewidth=0.7)
        ax.add_patch(Rectangle((x0 + (start - 1) * cw + 0.03, y + 0.1), dur * cw - 0.06, rh - 0.2, facecolor="#7f8c99",
                               edgecolor=INK, linewidth=0.9))
    ax.plot([x0, x0 + weeks * cw], [bottom, bottom], color=INK, linewidth=0.9)
    ax.text(0, bottom - 0.45, "A step that starts in week 3 and lasts 2 weeks runs in weeks 3 and 4.", ha="left",
            va="center", fontsize=9.5, style="italic")
    ax.set_xlim(-0.05, max(total, 9.5) + 0.05)
    ax.set_ylim(bottom - 0.75, 1.7)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


VERBS = ["draws up", "writes", "follows", "checks", "shares"]
SETTINGS = ["in an entrepreneurship lesson", "at the start of term", "with a mentor", "for homework",
            "for a class discussion", "in a careers club"]


def questions(p: dict, rng: random.Random) -> list:
    name, steps = p["name"], p["steps"]
    span = {lab: (s, s + d - 1) for lab, s, d in steps}
    last = max(span, key=lambda k: span[k][1])
    late = max(steps, key=lambda r: (r[1], -r[2]))[0]
    long = max(steps, key=lambda r: (r[2], r[1]))[0]
    rest = [lab for lab in span if lab not in (last, late, long)]
    rng.shuffle(rest)
    pairs = [(a, b) for i, a in enumerate(span) for b in list(span)[i + 1:]
             if min(span[a][1], span[b][1]) - max(span[a][0], span[b][0]) >= 0]
    a, b = rng.choice(pairs)
    shared = min(span[a][1], span[b][1]) - max(span[a][0], span[b][0]) + 1
    qs = [
        mcq(f"{name} {rng.choice(VERBS)} this action plan {rng.choice(SETTINGS)}. Which step of the plan ends last?",
            last, [late, long] + rest, rng),
        short(f"For how many weeks do the steps “{a}” and “{b}” overlap in {name}'s plan?", shared,
              [f"{shared} weeks"] if shared != 1 else ["1 week"]),
    ]
    if rng.random() < 0.5:
        end = span[last][1]
        qs.append(short(f"In which week will {name} finish the last step and reach the goal?", end,
                        [f"Week {end}", f"week {end}"]))
    else:
        wk = rng.choice([w for w in range(1, span[last][1] + 1) if any(s <= w <= e for s, e in span.values())])
        n = sum(1 for s, e in span.values() if s <= wk <= e)
        qs.append(short(f"How many steps of {name}'s plan are under way in week {wk}?", n,
                        [f"{n} steps"] if n != 1 else ["1 step"]))
    return qs
