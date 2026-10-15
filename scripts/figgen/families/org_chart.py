"""Organisation charts (UP; the same chart in AS Level Business): the hierarchy of a Rwandan firm (a hotel in Rubavu,
a dairy in Nyagatare, a bus company in Kigali), each person a box with a job title and a name, joined by lines to
the person they report to, as Cambridge IGCSE Business and Rwanda S4 Entrepreneurship draw it. Three or four levels.

The span of control of a named manager (someone with people under the people under them, so counting everyone below
gives a different number), the number of levels of hierarchy, the chain of command from the head of the firm down to a
named worker (an MCQ: the manager, or the manager and then the supervisor, in a balanced two-by-two set of options),
and who a named worker reports to.
"""
from __future__ import annotations

import random

from matplotlib.patches import Rectangle

from ..core import INK, NAMES, article, count, mcq, new_figure, short

ID = "org_chart"
KIND = "diagram.template"
SUBJECT = "business"
BANDS = ("UP",)
ALSO_BANDS = {"UP": ("AL",)}  # the same chart in Cambridge AS Level Business, "Organisation structure"
CONCEPTS = ("business.organisation-structure", "business.management-and-managerial-functions")
# A topic whose sections the book lists is reached only if one names what this figure teaches.
NEEDS = r"organi[sz]ation(al)? (structure|chart)|organisation and management|span of control|chain of command|hierarch"
# Listed without sections and sharing management: forms of business ownership and office work, not hierarchies.
AVOID = r"business organisation|business units|office|records management|business ethics"

# (the firm, the head's title, its departments: (manager, the level below, the level below that))
FIRMS = [
    ("a hotel in Rubavu", "General Manager", [("Rooms Manager", "Housekeeper", "Room Attendant"),
                                              ("Head Chef", "Cook", "Kitchen Assistant"),
                                              ("Finance Manager", "Accountant", "Accounts Clerk"),
                                              ("Sales Manager", "Sales Officer", "Receptionist")]),
    ("a dairy in Nyagatare", "Managing Director", [("Production Manager", "Supervisor", "Machine Operator"),
                                                   ("Sales Manager", "Sales Supervisor", "Sales Assistant"),
                                                   ("Finance Manager", "Accountant", "Accounts Clerk"),
                                                   ("Transport Manager", "Head Driver", "Driver")]),
    ("a furniture company in Musanze", "Managing Director", [("Production Manager", "Supervisor", "Carpenter"),
                                                             ("Sales Manager", "Sales Supervisor", "Sales Assistant"),
                                                             ("Finance Manager", "Accountant", "Accounts Clerk"),
                                                             ("Purchasing Manager", "Buyer", "Store Keeper")]),
    ("a bakery in Huye", "Managing Director", [("Production Manager", "Head Baker", "Baker"),
                                               ("Sales Manager", "Shop Supervisor", "Shop Assistant"),
                                               ("Finance Manager", "Accountant", "Cashier"),
                                               ("Transport Manager", "Head Driver", "Driver")]),
    ("a supermarket in Kigali", "General Manager", [("Store Manager", "Floor Supervisor", "Shelf Packer"),
                                                    ("Purchasing Manager", "Buyer", "Store Keeper"),
                                                    ("Finance Manager", "Accountant", "Cashier"),
                                                    ("HR Manager", "HR Officer", "Clerk")]),
    ("a coffee washing station in Nyamasheke", "Station Manager", [("Production Manager", "Supervisor", "Machine Operator"),
                                                                   ("Quality Manager", "Quality Officer", "Sorter"),
                                                                   ("Finance Manager", "Accountant", "Cashier"),
                                                                   ("Field Manager", "Field Officer", "Collector")]),
    ("a bus company in Kigali", "Managing Director", [("Operations Manager", "Route Supervisor", "Driver"),
                                                      ("Workshop Manager", "Head Mechanic", "Mechanic"),
                                                      ("Finance Manager", "Accountant", "Ticket Clerk"),
                                                      ("Marketing Manager", "Marketing Officer", "Designer")]),
    ("a printing company in Muhanga", "Managing Director", [("Production Manager", "Supervisor", "Printer"),
                                                            ("Sales Manager", "Sales Officer", "Sales Assistant"),
                                                            ("Finance Manager", "Accountant", "Cashier"),
                                                            ("Design Manager", "Designer", "Typist")]),
]
MAX_LEAVES = 6


def _clash(a: str, b: str) -> bool:
    """Two different names one of which holds the other: "Mutoni" and "Umutoni" read as one person (P3y review)."""
    return a != b and (a.lower() in b.lower() or b.lower() in a.lower())


def _levels(people: list) -> list[int]:
    out = []
    for _, _, boss in people:
        out.append(0 if boss < 0 else out[boss] + 1)
    return out


def _under(people: list) -> dict[int, list[int]]:
    out: dict[int, list[int]] = {i: [] for i in range(len(people))}
    for i, (_, _, boss) in enumerate(people):
        if boss >= 0:
            out[boss].append(i)
    return out


def _below(under: dict, i: int) -> int:
    return sum(1 + _below(under, c) for c in under[i])


def sample(rng: random.Random) -> dict:
    firm, head, depts = rng.choice(FIRMS)
    while True:
        depth = rng.choice([3, 4])
        k = rng.choice([3, 4]) if depth == 3 else rng.choice([2, 3, 4])
        chosen = rng.sample(depts, k)
        shape = []  # for each manager, for each person under them, how many people are under that person
        for _ in chosen:
            n = rng.randint(1, 3)
            shape.append([rng.choice([0, 0, 1, 2, 3]) if depth == 4 else 0 for _ in range(n)])
        if depth == 4 and not any(c for kids in shape for c in kids):
            continue
        leaves = sum(max(1, c) for kids in shape for c in kids)
        size = 1 + k + sum(len(kids) + sum(kids) for kids in shape)
        if leaves > MAX_LEAVES or size > 14:
            continue
        names = rng.sample(NAMES, size)
        if any(_clash(a, b) for a in names for b in names):
            continue
        people = [[names[0], head, -1]]
        for (manager, second, third), kids in zip(chosen, shape):
            people.append([names[len(people)], manager, 0])
            m = len(people) - 1
            for c in kids:
                people.append([names[len(people)], second, m])
                s = len(people) - 1
                for _ in range(c):
                    people.append([names[len(people)], third, s])
        under = _under(people)
        spans = [i for i in range(len(people)) if len(under[i]) >= 2 and _below(under, i) > len(under[i])]
        if not spans:
            continue
        return {"band": "UP", "firm": firm, "people": people}


# --- drawing ----------------------------------------------------------------------------------------

W, H, PITCH, GAP = 1.5, 0.62, 1.68, 1.12  # a box's width and height, the space a leaf takes, the drop per level (inches)


def _layout(people: list) -> dict[int, tuple[float, float]]:
    under, levels = _under(people), _levels(people)
    xs: dict[int, float] = {}
    nxt = [0]

    def place(i):
        if not under[i]:
            xs[i] = nxt[0] * PITCH
            nxt[0] += 1
            return
        for c in under[i]:
            place(c)
        xs[i] = (xs[under[i][0]] + xs[under[i][-1]]) / 2

    place(0)
    return {i: (xs[i], -levels[i] * GAP) for i in range(len(people))}


def draw(p: dict):
    people = p["people"]
    at, under = _layout(people), _under(people)
    left = min(x for x, _ in at.values()) - W / 2 - 0.1
    right = max(x for x, _ in at.values()) + W / 2 + 0.1
    bottom = min(y for _, y in at.values()) - H / 2 - 0.1
    top = H / 2 + 0.55
    fig, ax = new_figure(right - left, top - bottom)
    fig.subplots_adjust(left=0, right=1, bottom=0, top=1)
    for i, kids in under.items():
        if not kids:
            continue
        x, y = at[i]
        mid = y - GAP / 2
        ax.plot([x, x], [y - H / 2, mid], color=INK, linewidth=1.1)
        ax.plot([at[kids[0]][0], at[kids[-1]][0]], [mid, mid], color=INK, linewidth=1.1)
        for c in kids:
            ax.plot([at[c][0]] * 2, [mid, at[c][1] + H / 2], color=INK, linewidth=1.1)
    for i, (name, title, _) in enumerate(people):
        x, y = at[i]
        ax.add_patch(Rectangle((x - W / 2, y - H / 2), W, H, facecolor="#eef1f4" if i == 0 else "white",
                               edgecolor=INK, linewidth=1.2, zorder=3))
        ax.text(x, y + 0.12, title, ha="center", va="center", fontsize=8.5, fontweight="bold", zorder=4, gid=f"title-{i}")
        ax.text(x, y - 0.14, name, ha="center", va="center", fontsize=9, zorder=4, gid=f"name-{i}")
    ax.text((left + right) / 2, top - 0.25, f"Organisation chart of {p['firm']}", ha="center", va="center",
            fontsize=11.5, fontweight="bold")
    ax.set_xlim(left, right)
    ax.set_ylim(bottom, top)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


# --- questions --------------------------------------------------------------------------------------

VERBS = ["studies", "is given", "draws", "looks at", "is shown"]
SETTINGS = ["in a business studies lesson", "for homework", "before a job interview", "for a class test",
            "during a visit to the firm", "on a revision card"]


def questions(p: dict, rng: random.Random) -> list:
    people, firm = p["people"], p["firm"]
    on_chart = {x[0] for x in people}
    who = rng.choice([n for n in NAMES if n not in on_chart and not any(_clash(n, x) for x in on_chart)])
    under, levels = _under(people), _levels(people)
    depth = max(levels) + 1
    name = lambda i: people[i][0]  # noqa: E731
    title = lambda i: people[i][1]  # noqa: E731

    spans = [i for i in range(len(people)) if len(under[i]) >= 2 and _below(under, i) > len(under[i])]
    lower = [i for i in spans if i] if rng.random() < 0.7 else []  # a manager more often than the head, where one fits
    span_of = rng.choice(lower or spans)
    span = len(under[span_of])

    # The chain of command, from the head down to someone on the lowest level.
    target = rng.choice([i for i in range(len(people)) if levels[i] == depth - 1])
    path = []
    i = people[target][2]
    while i != 0:
        path.insert(0, i)
        i = people[i][2]
    managers = [i for i in range(len(people)) if levels[i] == 1]
    if len(path) == 1:
        mcq_chain = (name(path[0]), [name(m) for m in managers if m != path[0]])
    else:
        m1, s1 = path
        m2 = rng.choice([m for m in managers if m != m1 and under[m]])
        sisters = [s for s in under[m1] if s != s1]
        s2 = rng.choice(sisters) if sisters else rng.choice(under[m2])
        key = f"{name(m1)}, then {name(s1)}"
        options = [f"{name(m1)}, then {name(s2)}", f"{name(m2)}, then {name(s1)}", f"{name(m2)}, then {name(s2)}"]
        mcq_chain = (key, options)
    thing = rng.choice(["instruction", "message"])
    lead = (f"{article(thing).capitalize()} {thing} from {name(0)}, the {title(0)}, goes down the chain of command to "
            f"{name(target)}, {article(title(target))} {title(target)}.")
    # One person in between: who hands it on. Two: who hands it on, in order (the options read "X, then Y").
    ask = (f"Who passes the {thing} on to {name(target)}?" if len(path) == 1 else
           rng.choice(["Who passes it on, in order?", "Who does it pass through on the way, in order?"]))
    chain = mcq(f"{lead} {ask}", *mcq_chain, rng)

    # Who someone below the managers reports to: never the head, whom no chart is needed for.
    low = [i for i in range(len(people)) if levels[i] >= 2 and i != target] or [target]
    asked = rng.choice(low)
    boss = people[asked][2]
    titles = [x[1] for x in people]
    forms = [name(boss), f"{name(boss)} ({title(boss)})", f"{name(boss)}, the {title(boss)}", f"{name(boss)} the {title(boss)}"]
    if titles.count(title(boss)) == 1:
        forms += [f"the {title(boss)}", title(boss)]
    return [
        count(f"{who} {rng.choice(VERBS)} the organisation chart of {firm} {rng.choice(SETTINGS)}. "
              f"What is the span of control of {name(span_of)}, the {title(span_of)}?", span,
              "people", "subordinates", "workers", "employees"),
        count(rng.choice([f"How many levels of hierarchy does the organisation chart of {firm} have?",
                          f"How many levels of hierarchy are there in {firm}, as its chart shows?"]), depth, "levels"),
        chain,
        short(f"Who does {name(asked)}, {article(title(asked))} {title(asked)}, report to?", name(boss), forms),
    ]
