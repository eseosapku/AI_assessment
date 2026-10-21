"""Family and community history for Primary 1 to 3: a family tree with faces, a family timeline, or a timeline of a
school or a village. Every person, school and village is invented.

- tree (NERDC Primary 1-3 "Family and community history"): three generations drawn as simple faces with a name under
  each: a grandfather and a grandmother joined as a married couple, their children below them and their grandchildren
  below those, each joined to their parent by a line. A woman or girl wears a headwrap, a man or boy has short hair, as
  the key under the tree shows. One grandchild drew the tree. Who is the grandchild's grandmother (grandfather), who is
  the grandchild's aunt (uncle; the tree has exactly one), and how many grandchildren the grandparents have.
- family (NERDC; Rwanda P1 "Family Historical Events", P2 "Main Historical Events at Home and at School"): a child's
  family timeline, a tick and a number for every year and each event over its own year: the child's birth, a brother
  or sister's birth, starting Primary 1, moving house, Grandma coming to live with the family. Which of three or four
  events happened first (never a pair that common sense orders), in which year an event happened, how many years after
  one event another happened, and how old the child was at an event (the child's birthday is 1 January, as the stem
  says).
- school (Rwanda P2 "...at School"; NERDC): the same timeline for a school (it opens, gets a library, electricity, a
  water tank...) or a village (a borehole, a health centre, a market...). Which happened first, in which year, how
  many years after.

Big print, small whole numbers, events two years apart at least, and short sentences read aloud easily.
"""
from __future__ import annotations

import random
import textwrap

from matplotlib.patches import Arc, Circle, Ellipse, Wedge

from ..core import INK, NAMES, mcq, new_figure, short

ID = "family_history_p"
KIND = "timeline"
SUBJECT = "history"
BANDS = ("P",)
CONCEPTS = ("history.family-values",)
# Rwanda's Primary Social Studies teaches family and school events on a timeline (P1 "Family Historical Events", P2
# "Main Historical Events at Home and at School").
ALSO = ("social-studies.family-events", "social-studies.historical-events-family", "social-studies.historical-events-school",
        "social-studies.timeline")
# A topic whose sections the book lists is reached only if its name or a section names the family, historical events or
# community history.
NEEDS = r"family|historical events|community history"
AVOID = r"genocide|religio|\bgod\b|faith|rights"
TOPICS = {"ng": r"family and community history", "rw:family": r"family historical events|historical events at home",
          "rw:school": r"historical events at home"}

# The child who made the figure: names whose sex is plain, so a stem can say "her" or "his".
RW_GIRLS = ["Aline", "Grace", "Uwase", "Keza", "Teta", "Mutoni", "Ingabire", "Umutoni"]
RW_BOYS = ["Eric", "Mugisha", "Kevin", "Jean", "Gasana", "Kalisa", "Habimana"]
NG_GIRLS = ["Ngozi", "Amina", "Ifeoma", "Funke", "Chioma", "Kemi", "Zainab", "Aisha"]
NG_BOYS = ["Chinedu", "Tunde", "Emeka", "Musa", "Ibrahim", "Obinna", "Femi"]
NG_NAMES = NG_GIRLS + NG_BOYS + ["Bola"]
# Everyone else in a tree: Nigerian names, by generation, none of them a questioner's.
GRANDMOTHERS = ["Adunni", "Hauwa", "Nneka", "Abike", "Halima", "Uzoamaka"]
GRANDFATHERS = ["Olumide", "Abdullahi", "Okonkwo", "Babatunde", "Garba", "Chukwuma"]
WOMEN = ["Folake", "Hadiza", "Nkechi", "Yetunde", "Safiya", "Adaeze", "Bisi", "Ronke"]
MEN = ["Segun", "Usman", "Ikenna", "Dayo", "Yusuf", "Chidi", "Kunle", "Bello"]
GIRLS3 = ["Tolu", "Hafsat", "Ada", "Simi", "Maryam", "Ebele", "Fatima"]
BOYS3 = ["Dapo", "Sadiq", "Kelechi", "Wale", "Umar", "Nnamdi", "Jide"]
# A brother's or sister's name, for a family timeline.
SIBS = {"rw": (["Isimbi", "Ineza", "Gaju", "Kirezi"], ["Shema", "Hirwa", "Cyusa", "Ganza"]),
        "ng": (["Tolu", "Ada", "Simi", "Maryam"], ["Dapo", "Wale", "Umar", "Jide"])}
TOWNS = {"rw": ["Huye", "Musanze", "Rubavu", "Nyagatare", "Muhanga"], "ng": ["Ibadan", "Enugu", "Kano", "Jos", "Abeokuta"]}
SCHOOLS = {"rw": ["Umucyo Primary School", "Ineza Primary School", "Urumuri Primary School", "Hope Primary School"],
           "ng": ["Unity Primary School", "Sunrise Primary School", "Bright Star Primary School"]}
# Each event: (key, the label drawn, "in which year ...?", "how many years after ...").
SCHOOL_EVENTS = [("classrooms", "A new classroom block is built", "was the new classroom block built",
                  "the new classroom block was built"),
                 ("library", "The school library opens", "did the school library open", "the school library opened"),
                 ("power", "The school gets electricity", "did the school get electricity", "the school got electricity"),
                 ("tank", "A water tank is built", "was the water tank built", "the water tank was built"),
                 ("garden", "The school garden is planted", "was the school garden planted", "the school garden was planted"),
                 ("computers", "The computer room opens", "did the computer room open", "the computer room opened"),
                 ("cup", "The school wins the district football cup", "did the school win the district football cup",
                  "the school won the district football cup")]
VILLAGE_EVENTS = [("borehole", "The village gets a borehole", "did the village get a borehole", "the village got a borehole"),
                  ("clinic", "The health centre opens", "did the health centre open", "the health centre opened"),
                  ("market", "The new market opens", "did the new market open", "the new market opened"),
                  ("road", "The road to the town is tarred", "was the road to the town tarred",
                   "the road to the town was tarred"),
                  ("power", "Electricity comes to the village", "did electricity come to the village",
                   "electricity came to the village"),
                  ("hall", "The village hall is built", "was the village hall built", "the village hall was built"),
                  ("village-school", "The village school opens", "did the village school open", "the village school opened")]


def concepts_for(p: dict) -> tuple[str, ...]:
    return CONCEPTS


def avoid_for(p: dict) -> str:
    key = "ng" if p["nation"] == "ng" else f"rw:{p['sub']}"
    return f"{AVOID}|^(?!.*(?:{TOPICS[key]}))"


def stages(p: dict) -> tuple[int, int]:
    return (2, 3) if p["sub"] == "school" else (1, 3)


# --- sampling ---------------------------------------------------------------------------------------------

def relation(people: list, y: int, z: int):
    """What y is to z (z a grandchild)."""
    a, b = people[y], people[z]
    f = a["sex"] == "F"
    if a["gen"] == 1:
        return "grandmother" if f else "grandfather"
    if a["gen"] == 2:
        return ("mother" if f else "father") if b["parent"] == y else ("aunt" if f else "uncle")
    return None


def _tree(rng: random.Random) -> dict:
    while True:
        n2 = rng.choice([2, 3])
        n3 = rng.randint(3, 5)
        split = [1] * n2
        for _ in range(n3 - n2):
            split[rng.randrange(n2)] += 1
        if max(split) > 3:
            continue
        if n2 == 3 and rng.random() < 0.4:  # one child of the grandparents may have no children yet
            i = rng.randrange(3)
            if split[i] == 1:
                split[i] = 0
        gp = [{"name": rng.choice(GRANDFATHERS), "sex": "M", "gen": 1, "parent": None},
              {"name": rng.choice(GRANDMOTHERS), "sex": "F", "gen": 1, "parent": None}]
        rng.shuffle(gp)
        women, men, girls, boys = (rng.sample(x, len(x)) for x in (WOMEN, MEN, GIRLS3, BOYS3))
        people = list(gp)
        for k in split:
            sex = rng.choice("FM")
            people.append({"name": (women if sex == "F" else men).pop(), "sex": sex, "gen": 2, "parent": None})
            parent = len(people) - 1
            for _ in range(k):
                sex = rng.choice("FM")
                people.append({"name": (girls if sex == "F" else boys).pop(), "sex": sex, "gen": 3, "parent": parent})
        me = rng.choice([i for i, q in enumerate(people) if q["gen"] == 3])
        people[me]["name"] = rng.choice(NG_GIRLS if people[me]["sex"] == "F" else NG_BOYS)
        words = [w for w in ("aunt", "uncle") if sum(1 for i in range(len(people)) if relation(people, i, me) == w) == 1]
        if not words:
            continue
        return {"band": "P", "sub": "tree", "nation": "ng", "people": people, "me": me,
                "gp": rng.choice(["grandmother", "grandfather"]), "rel": rng.choice(words),
                "ask": rng.sample(["gp", "rel", "count"], 3)}


def _years_ok(years: list) -> bool:
    ys = sorted(years)
    return len(set(ys)) == len(ys) and all(b - a >= 2 for a, b in zip(ys, ys[1:])) and ys[-1] - ys[0] <= 10


def _family(rng: random.Random, nation: str) -> dict:
    girls, boys = (RW_GIRLS, RW_BOYS) if nation == "rw" else (NG_GIRLS, NG_BOYS)
    sex = rng.choice("FM")
    me = rng.choice(girls if sex == "F" else boys)
    sib_sex = rng.choice("FM")
    sib = rng.choice(SIBS[nation][0 if sib_sex == "F" else 1])
    town = rng.choice(TOWNS[nation])
    rel = "sister" if sib_sex == "F" else "brother"
    pool = {"married": ("Mum and Dad get married", "did Mum and Dad get married", "Mum and Dad got married"),
            "sibling": (f"{me}'s {rel} {sib} is born", f"was {sib} born", f"{sib} was born"),
            "school": (f"{me} starts Primary 1", f"did {me} start Primary 1", f"{me} started Primary 1"),
            "move": (f"The family moves to {town}", f"did the family move to {town}", f"the family moved to {town}"),
            "grandma": ("Grandma comes to live with the family", "did Grandma come to live with the family",
                        "Grandma came to live with the family"),
            "tree": ("The family plants a mango tree", "did the family plant a mango tree", "the family planted a mango tree"),
            "cow": ("The family is given a cow", "was the family given a cow", "the family was given a cow")}
    while True:
        born = rng.randint(2010, 2016)
        keys = rng.sample(sorted(pool), 4)
        years = {"born": born}
        for k in keys:
            # a brother or sister may be older or younger than the child
            years[k] = {"married": born - rng.choice([2, 3]), "sibling": born + rng.choice([-4, -3, -2, 2, 3, 4]),
                        "school": born + 6}.get(k, born + rng.randint(-3, 8))
        if not _years_ok(list(years.values())):
            continue
        if "married" in years and "sibling" in years and years["sibling"] < years["married"]:
            continue
        events = [["born", f"{me} is born", f"was {me} born", f"{me} was born", born]]
        events += [[k, *pool[k], years[k]] for k in keys]
        events.sort(key=lambda e: e[-1])
        free = [e for e in events if e[0] not in ("married", "born", "school")]
        if not any(e[-1] > born for e in free) or len([e for e in events if e[0] != "married"]) < 4:
            continue
        return {"band": "P", "sub": "family", "nation": nation, "me": me, "sex": sex, "events": events}


def _school(rng: random.Random, nation: str) -> dict:
    village = nation == "ng" and rng.random() < 0.5
    place = "our village" if village else rng.choice(SCHOOLS[nation])
    while True:
        first = rng.randint(2006, 2014)
        if village:
            chosen = rng.sample(VILLAGE_EVENTS, 5)
            years = sorted(rng.sample(range(first, first + 11), 5))
        else:
            chosen = [("opens", f"{place} opens", f"did {place} open", f"{place} opened")] + rng.sample(SCHOOL_EVENTS, 4)
            years = [first] + sorted(rng.sample(range(first + 2, first + 11), 4))
        if not _years_ok(years):
            continue
        if village:
            rng.shuffle(chosen)
        events = [[*e, y] for e, y in zip(chosen, years)]
        return {"band": "P", "sub": "school", "nation": nation, "place": place, "events": events}


def sample(rng: random.Random) -> dict:
    sub, nation = rng.choice([("tree", "ng"), ("family", "ng"), ("family", "rw"), ("school", "ng"), ("school", "rw")])
    if sub == "tree":
        return _tree(rng)
    return _family(rng, nation) if sub == "family" else _school(rng, nation)


# --- drawing ----------------------------------------------------------------------------------------------

SKIN, WRAP, HAIR, GREY = "#c68642", "#e07b39", "#2b2b2b", "#9a9a9a"
SLOT, FACE = 1.75, 0.34
Y1, Y2, Y3 = 4.6, 2.75, 0.95


def face(ax, x: float, y: float, sex: str, old: bool, r: float = FACE, gid: str | None = None) -> None:
    """A simple face: a headwrap for a woman or girl, short hair for a man or boy (grey for a grandfather)."""
    if sex == "F":
        ax.add_patch(Ellipse((x, y + r * 0.78), r * 2.2, r * 1.1, facecolor=WRAP, edgecolor=INK,
                             linewidth=1.1, zorder=2))
    else:
        ax.add_patch(Wedge((x, y + r * 0.05), r * 1.06, 15, 165, facecolor=GREY if old else HAIR, edgecolor=INK,
                           linewidth=1.1, zorder=2))
    ax.add_patch(Circle((x, y), r, facecolor=SKIN, edgecolor=INK, linewidth=1.3, zorder=3, gid=gid))
    for dx in (-0.35, 0.35):
        ax.add_patch(Circle((x + dx * r, y + 0.15 * r), 0.09 * r, facecolor=INK, edgecolor=INK, zorder=4))
    ax.add_patch(Arc((x, y - 0.12 * r), 0.9 * r, 0.6 * r, theta1=200, theta2=340, color=INK, linewidth=1.3, zorder=4))


def tree_layout(people: list) -> dict:
    pos, x = {}, 0.0
    for i, q in enumerate(people):
        if q["gen"] != 2:
            continue
        kids = [j for j, r in enumerate(people) if r["gen"] == 3 and r["parent"] == i]
        for n, j in enumerate(kids):
            pos[j] = (x + n * SLOT, Y3)
        width = max(1, len(kids))
        pos[i] = (x + (width - 1) * SLOT / 2, Y2)
        x += width * SLOT + 0.3
    xs = [pos[i][0] for i, q in enumerate(people) if q["gen"] == 2]
    mid = (min(xs) + max(xs)) / 2
    gp = [i for i, q in enumerate(people) if q["gen"] == 1]
    pos[gp[0]], pos[gp[1]] = (mid - 1.3, Y1), (mid + 1.3, Y1)
    return pos


def _draw_tree(p: dict):
    people = p["people"]
    pos = tree_layout(people)
    xs = [v[0] for v in pos.values()]
    left, right = min(xs) - 1.0, max(xs) + 1.0
    left, right = min(left, (left + right) / 2 - 3.2), max(right, (left + right) / 2 + 3.2)
    fig, ax = new_figure(right - left, Y1 + 1.35 + 0.95)
    fig.subplots_adjust(left=0, right=1, bottom=0, top=1)
    gp = [i for i, q in enumerate(people) if q["gen"] == 1]
    (xa, _), (xb, _) = sorted((pos[i] for i in gp))
    mid = (xa + xb) / 2
    for dy in (0.05, -0.05):
        ax.plot([xa + FACE + 0.08, xb - FACE - 0.08], [Y1 + dy, Y1 + dy], color=INK, linewidth=1.4)
    ax.text(mid, Y1 + 0.3, "married", ha="center", va="center", fontsize=10.5, style="italic")
    bar1, bar2 = Y2 + 0.95, Y3 + 0.95
    for i, q in enumerate(people):
        x, y = pos[i]
        r = FACE if q["gen"] < 3 else FACE * 0.9
        if q["gen"] == 2:
            ax.plot([mid, mid, x, x], [Y1 - 0.06, bar1, bar1, y + r + 0.42], color=INK, linewidth=1.3, gid=f"link:{i}")
        elif q["gen"] == 3:
            px = pos[q["parent"]][0]
            ax.plot([px, px, x, x], [Y2 - FACE - 0.45, bar2, bar2, y + r + 0.42], color=INK, linewidth=1.3, gid=f"link:{i}")
        face(ax, x, y, q["sex"], q["gen"] == 1, r, gid=f"face:{i}")
        ax.text(x, y - r - 0.24, q["name"], ha="center", va="center", fontsize=12, fontweight="bold", gid=f"person:{i}")
    me = people[p["me"]]["name"]
    ax.text((left + right) / 2, Y1 + 1.0, f"{me}'s family tree", ha="center", va="center", fontsize=14, fontweight="bold")
    ky = -0.55
    kx = (left + right) / 2 - 2.7
    for sex, label, dx in (("F", "woman or girl", 0.0), ("M", "man or boy", 3.0)):
        face(ax, kx + dx, ky, sex, False, 0.22)
        ax.text(kx + dx + 0.42, ky, label, ha="left", va="center", fontsize=11)
    ax.set_xlim(left, right)
    ax.set_ylim(ky - 0.4, Y1 + 1.35)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def _draw_timeline(p: dict):
    events = p["events"]
    lo, hi = events[0][-1] - 1, events[-1][-1] + 1
    W = 10.4
    unit = (W - 1.4) / (hi - lo)
    labels = [textwrap.fill(e[1], 15, break_on_hyphens=False) for e in events]
    lines = max(t.count("\n") + 1 for t in labels)
    line_y = 0.85
    H = line_y + 0.75 + lines * 0.24 + 0.35 + 0.65

    def X(year):
        return 0.7 + (year - lo) * unit

    fig, ax = new_figure(W, H)
    fig.subplots_adjust(left=0, right=1, bottom=0, top=1)
    if p["sub"] == "family":
        title = f"{p['me']}'s family"
    else:
        title = "Our village" if p["place"] == "our village" else p["place"]
    ax.text(W / 2, H - 0.35, title + ": a timeline", ha="center", va="center", fontsize=14, fontweight="bold")
    ax.plot([X(lo) - 0.3, X(hi) + 0.3], [line_y, line_y], color=INK, linewidth=2.2)
    for y in range(lo, hi + 1):
        ax.plot([X(y), X(y)], [line_y - 0.1, line_y + 0.1], color=INK, linewidth=1.2)
        ax.text(X(y), line_y - 0.33, str(y), ha="center", va="center", fontsize=11, gid="tick")
    for e, text in zip(events, labels):
        x = X(e[-1])
        ax.plot([x], [line_y], marker="o", markersize=9, color=INK, zorder=4)
        ax.plot([x, x], [line_y + 0.12, line_y + 0.62], color=INK, linewidth=1.2, gid=f"leader:{e[0]}")
        ax.text(x, line_y + 0.75, text, ha="center", va="bottom", fontsize=11.5, linespacing=1.2, gid=f"event:{e[0]}",
                bbox={"boxstyle": "round,pad=0.25", "facecolor": "#f4efe4", "edgecolor": INK, "linewidth": 1.0})
    ax.set_xlim(0, W)
    ax.set_ylim(0, H)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def draw(p: dict):
    return _draw_tree(p) if p["sub"] == "tree" else _draw_timeline(p)


# --- questions --------------------------------------------------------------------------------------------

SETTINGS = ["for a history lesson", "for homework", "to show the class", "for a class display", "after a visit home",
            "during the school holidays", "for a lesson about the past"]


def _tree_questions(p: dict, rng: random.Random) -> list:
    people, me = p["people"], p["me"]
    names = [q["name"] for q in people]
    pron = "her" if people[me]["sex"] == "F" else "his"
    lead = f"{names[me]} drew {pron} family tree {rng.choice(SETTINGS)}. "
    qs = []
    for i, a in enumerate(p["ask"]):
        opening = lead if i == 0 else ""
        if a == "gp":
            word = p["gp"]
            sex = "F" if word == "grandmother" else "M"
            key = next(j for j, q in enumerate(people) if q["gen"] == 1 and q["sex"] == sex)
            other = next(j for j, q in enumerate(people) if q["gen"] == 1 and q["sex"] != sex)
            row2 = sorted((j for j, q in enumerate(people) if q["gen"] == 2), key=lambda j: (people[j]["sex"] != sex, rng.random()))
            row3 = sorted((j for j, q in enumerate(people) if q["gen"] == 3 and j != me),
                          key=lambda j: (people[j]["sex"] != sex, rng.random()))
            qs.append(mcq(opening + f"Who is {names[me]}'s {word}?", names[key],
                          [names[other], names[row2[0]], names[row3[0]]], rng))
        elif a == "rel":
            word = p["rel"]
            key = next(j for j in range(len(people)) if relation(people, j, me) == word)
            parent = people[me]["parent"]
            gsex = "F" if word == "aunt" else "M"
            grand = next(j for j, q in enumerate(people) if q["gen"] == 1 and q["sex"] == gsex)
            row3 = [j for j, q in enumerate(people) if q["gen"] == 3 and j != me]
            qs.append(mcq(opening + f"Who is {names[me]}'s {word}?", names[key],
                          [names[parent], names[grand], names[rng.choice(row3)]], rng))
        else:
            g = [names[j] for j, q in enumerate(people) if q["gen"] == 1]
            n = sum(1 for q in people if q["gen"] == 3)
            qs.append(short(opening + f"How many grandchildren do {g[0]} and {g[1]} have?", n,
                            [f"{n} grandchildren", f"{n} children"]))
    return qs


def _timeline_questions(p: dict, rng: random.Random) -> list:
    events = p["events"]
    setting = rng.choice(SETTINGS)
    if p["sub"] == "family":
        pron = "her" if p["sex"] == "F" else "his"
        lead = f"{p['me']} made this timeline of {pron} family {setting}."
        pool = [e for e in events if e[0] != "married"]
        if any(e[0] == "born" for e in pool) and any(e[0] == "school" for e in pool):
            drop = rng.choice(["born", "school"])
            pool = [e for e in pool if e[0] != drop]
    else:
        nation_names = NG_NAMES if p["nation"] == "ng" else NAMES
        who = rng.choice(nation_names)
        theirs = "their village" if p["place"] == "our village" else "their school"
        lead = f"{who}'s class made this timeline of {theirs} {setting}."
        pool = [e for e in events if e[0] != "opens"]
    opts = rng.sample(pool, min(len(pool), rng.choice([3, 4])))
    key = min(opts, key=lambda e: e[-1])
    qs = [mcq(f"{lead} Which of these happened first?", key[1], [e[1] for e in opts if e is not key], rng)]
    e = rng.choice(events)
    qs.append(short(f"In which year {e[2]}?", e[-1]))
    if p["sub"] == "family":
        born = next(x for x in events if x[0] == "born")
        later = [x for x in events if x[0] not in ("married", "born", "school") and x[-1] > born[-1]]
        b = rng.choice(later)
        if rng.random() < 0.5:
            age = b[-1] - born[-1]
            her = "Her" if p["sex"] == "F" else "His"
            qs.append(short(f"How old was {p['me']} when {b[3]}? {her} birthday is on 1 January.", age,
                            [f"{age} years old", f"{age} years"]))
            return qs
        a = rng.choice([x for x in events if x[0] not in ("married", "school") and x[-1] < b[-1]])
    else:
        b = rng.choice([x for x in events[1:] if x[0] != "opens"])
        a = rng.choice([x for x in events if x[-1] < b[-1]])
    gap = b[-1] - a[-1]
    qs.append(short(f"How many years after {a[3]} {b[2]}?", gap, [f"{gap} years"]))
    return qs


def questions(p: dict, rng: random.Random) -> list:
    return _tree_questions(p, rng) if p["sub"] == "tree" else _timeline_questions(p, rng)
